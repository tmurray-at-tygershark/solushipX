const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const db = getFirestore();

/**
 * Create a new role with specified permissions
 */
exports.createRole = onCall({
  cors: true,
  timeoutSeconds: 60,
}, async (request) => {
  try {
    const { auth, data } = request;
    
    // Authentication check
    if (!auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Get user role for authorization
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const userRole = userDoc.data()?.role;

    // Only super admins can create roles
    if (userRole !== 'superadmin') {
      throw new HttpsError('permission-denied', 'Only super administrators can create roles');
    }

    // Validate input data
    const { roleId, displayName, description, permissions, color, isActive = true } = data;
    
    if (!roleId || !displayName || !permissions) {
      throw new HttpsError('invalid-argument', 'Role ID, display name, and permissions are required');
    }

    // Validate roleId format (lowercase, no spaces, underscores allowed)
    if (!/^[a-z_]+$/.test(roleId)) {
      throw new HttpsError('invalid-argument', 'Role ID must be lowercase letters and underscores only');
    }

        // Check if role already exists
    const existingRole = await db.collection('roles').doc(roleId).get();
    if (existingRole.exists) {
      throw new HttpsError('already-exists', 'A role with this ID already exists');
    }

    // Validate permissions structure
    if (typeof permissions !== 'object' || Array.isArray(permissions)) {
      throw new HttpsError('invalid-argument', 'Permissions must be an object');
    }

    // Create role document
        const roleData = {
      roleId,
      displayName,
      description: description || '',
      permissions,
            color: color || '#757575',
      isActive,
      isSystemRole: false, // Custom roles are not system roles
      createdAt: new Date(),
      createdBy: auth.uid,
      updatedAt: new Date(),
      updatedBy: auth.uid
    };

    await db.collection('roles').doc(roleId).set(roleData);

    console.log(`Role ${roleId} created by ${auth.email}`);

        return {
            success: true,
      message: `Role "${displayName}" created successfully`,
      roleId
        };

    } catch (error) {
        console.error('Error creating role:', error);
    if (error instanceof HttpsError) {
            throw error;
        }
    throw new HttpsError('internal', 'Failed to create role');
    }
});

/**
 * Update an existing role's permissions or metadata
 */
exports.updateRole = onCall({
  cors: true,
  timeoutSeconds: 60,
}, async (request) => {
  try {
    const { auth, data } = request;
    
    // Authentication check
    if (!auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Get user role for authorization
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const userRole = userDoc.data()?.role;

    // Only super admins can update roles
    if (userRole !== 'superadmin') {
      throw new HttpsError('permission-denied', 'Only super administrators can update roles');
    }

    const { roleId, updates } = data;
    
    if (!roleId || !updates) {
      throw new HttpsError('invalid-argument', 'Role ID and updates are required');
    }

    // Get existing role
    const roleDoc = await db.collection('roles').doc(roleId).get();
    if (!roleDoc.exists) {
      throw new HttpsError('not-found', 'Role not found');
    }

    const existingRole = roleDoc.data();

    // Prevent updating core system roles unless explicitly allowed
    const protectedSystemRoles = ['superadmin', 'admin'];
    if (protectedSystemRoles.includes(roleId) && existingRole.isSystemRole) {
      throw new HttpsError('permission-denied', 'Cannot modify protected system roles');
    }

    // Validate updates
    const allowedUpdates = ['displayName', 'description', 'permissions', 'color', 'isActive'];
    const updateData = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key)) {
        updateData[key] = value;
      }
    }

    if (Object.keys(updateData).length === 0) {
      throw new HttpsError('invalid-argument', 'No valid updates provided');
    }

    // Validate permissions if being updated
    if (updateData.permissions && (typeof updateData.permissions !== 'object' || Array.isArray(updateData.permissions))) {
      throw new HttpsError('invalid-argument', 'Permissions must be an object');
    }

    // Add metadata
    updateData.updatedAt = new Date();
    updateData.updatedBy = auth.uid;

    await db.collection('roles').doc(roleId).update(updateData);

    console.log(`Role ${roleId} updated by ${auth.email}`);

        return {
            success: true,
      message: `Role "${existingRole.displayName}" updated successfully`,
      roleId
        };

    } catch (error) {
        console.error('Error updating role:', error);
    if (error instanceof HttpsError) {
            throw error;
        }
    throw new HttpsError('internal', 'Failed to update role');
    }
});

/**
 * Delete a role (with safety checks)
 */
exports.deleteRole = onCall({
  cors: true,
  timeoutSeconds: 60,
}, async (request) => {
  try {
    const { auth, data } = request;
    
    // Authentication check
    if (!auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Get user role for authorization
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const userRole = userDoc.data()?.role;

    // Only super admins can delete roles
    if (userRole !== 'superadmin') {
      throw new HttpsError('permission-denied', 'Only super administrators can delete roles');
    }

    const { roleId, force = false } = data;

        if (!roleId) {
      throw new HttpsError('invalid-argument', 'Role ID is required');
    }

    // Get existing role
    const roleDoc = await db.collection('roles').doc(roleId).get();
    if (!roleDoc.exists) {
      throw new HttpsError('not-found', 'Role not found');
    }

    const existingRole = roleDoc.data();

    // Prevent deleting core system roles
    const protectedSystemRoles = ['superadmin', 'admin', 'user'];
    if (protectedSystemRoles.includes(roleId) || existingRole.isSystemRole) {
      throw new HttpsError('permission-denied', 'Cannot delete system roles');
    }

    // Check if any users have this role (unless force is true)
    if (!force) {
        const usersWithRole = await db.collection('users')
            .where('role', '==', roleId)
            .limit(1)
            .get();

        if (!usersWithRole.empty) {
        throw new HttpsError('failed-precondition', 
          'Cannot delete role: users are still assigned to this role. Use force=true to proceed anyway.');
      }
    }

    // Delete the role
    await db.collection('roles').doc(roleId).delete();

    // If force is true, update users with this role to 'user' role
    if (force) {
      const usersWithRole = await db.collection('users')
        .where('role', '==', roleId)
            .get();

        const batch = db.batch();
      usersWithRole.docs.forEach(doc => {
        batch.update(doc.ref, { 
          role: 'user',
          updatedAt: new Date(),
          roleChangedAt: new Date(),
          roleChangedBy: auth.uid,
          roleChangeReason: `Role "${roleId}" was deleted`
        });
      });

      if (!usersWithRole.empty) {
        await batch.commit();
        console.log(`Updated ${usersWithRole.size} users from deleted role ${roleId} to "user" role`);
      }
    }

    console.log(`Role ${roleId} deleted by ${auth.email}`);

        return {
            success: true,
      message: `Role "${existingRole.displayName}" deleted successfully`,
      roleId,
      usersUpdated: force ? (await db.collection('users').where('role', '==', 'user').get()).size : 0
        };

    } catch (error) {
        console.error('Error deleting role:', error);
    if (error instanceof HttpsError) {
            throw error;
        }
    throw new HttpsError('internal', 'Failed to delete role');
    }
});

/**
 * Get all roles from database
 */
exports.getRoles = onCall({
  cors: true,
  timeoutSeconds: 60,
}, async (request) => {
  try {
    const { auth } = request;
    
    // Authentication check
    if (!auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Get user role for authorization
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const userRole = userDoc.data()?.role;

    // Only admins and super admins can view roles
    if (!['admin', 'superadmin'].includes(userRole)) {
      throw new HttpsError('permission-denied', 'Insufficient permissions to view roles');
    }

    // Get all roles
    const rolesSnapshot = await db.collection('roles')
      .orderBy('displayName')
      .get();

    const roles = {};
    rolesSnapshot.docs.forEach(doc => {
      const roleData = doc.data();
      roles[doc.id] = {
        ...roleData,
        id: doc.id,
        // Convert Firestore timestamps to ISO strings
        createdAt: roleData.createdAt?.toDate?.()?.toISOString() || roleData.createdAt,
        updatedAt: roleData.updatedAt?.toDate?.()?.toISOString() || roleData.updatedAt
      };
    });

    console.log(`Roles retrieved by ${auth.email}`);

        return {
            success: true,
      roles
        };

    } catch (error) {
    console.error('Error getting roles:', error);
    if (error instanceof HttpsError) {
            throw error;
        }
    throw new HttpsError('internal', 'Failed to get roles');
    }
});

/**
 * Assign a role to a user
 */
exports.assignUserRole = onCall({
  cors: true,
  timeoutSeconds: 60,
}, async (request) => {
  try {
    const { auth, data } = request;
    
    // Authentication check
    if (!auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated');
    }

    // Get user role for authorization
    const userDoc = await db.collection('users').doc(auth.uid).get();
    const userRole = userDoc.data()?.role;

    // Only super admins and admins can assign roles
    if (!['admin', 'superadmin'].includes(userRole)) {
      throw new HttpsError('permission-denied', 'Insufficient permissions to assign roles');
    }

    const { userId, newRole, reason } = data;
    
    if (!userId || !newRole) {
      throw new HttpsError('invalid-argument', 'User ID and new role are required');
    }

    // Verify the role exists
    const roleDoc = await db.collection('roles').doc(newRole).get();
    if (!roleDoc.exists) {
      // Check if it's a hardcoded system role
      const systemRoles = ['superadmin', 'admin', 'user', 'accounting', 'company_staff'];
      if (!systemRoles.includes(newRole)) {
        throw new HttpsError('not-found', 'Role not found');
      }
    }

    // Prevent non-super admins from assigning super admin role
    if (newRole === 'superadmin' && userRole !== 'superadmin') {
      throw new HttpsError('permission-denied', 'Only super administrators can assign super admin role');
    }

    // Get target user
    const targetUserDoc = await db.collection('users').doc(userId).get();
    if (!targetUserDoc.exists) {
      throw new HttpsError('not-found', 'User not found');
    }

    const targetUserData = targetUserDoc.data();
    const oldRole = targetUserData.role;

    // Prevent non-super admins from modifying super admin users
    if (oldRole === 'superadmin' && userRole !== 'superadmin') {
      throw new HttpsError('permission-denied', 'Only super administrators can modify super admin users');
    }

    // Update user role
    await db.collection('users').doc(userId).update({
      role: newRole,
      updatedAt: new Date(),
      roleChangedAt: new Date(),
      roleChangedBy: auth.uid,
      roleChangeReason: reason || 'Role assignment via admin panel'
    });

    console.log(`User ${userId} role changed from ${oldRole} to ${newRole} by ${auth.email}`);

        return {
            success: true,
      message: `User role updated successfully`,
      userId,
      oldRole,
      newRole
        };

    } catch (error) {
    console.error('Error assigning user role:', error);
    if (error instanceof HttpsError) {
            throw error;
        }
    throw new HttpsError('internal', 'Failed to assign user role');
    }
}); 