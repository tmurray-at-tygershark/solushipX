const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { validateAuth, validateRole } = require('./utils/auth');

// Initialize Firestore
const db = admin.firestore();

/**
 * Create a new custom role
 */
exports.adminCreateRole = functions.https.onCall(async (data, context) => {
    try {
        // Validate authentication and super admin role
        validateAuth(context);
        validateRole(context, ['superadmin']);

        const { name, description, color, permissions } = data;

        // Validate required fields
        if (!name || !description) {
            throw new functions.https.HttpsError('invalid-argument', 'Name and description are required');
        }

        // Generate role ID from name
        const roleId = name.toLowerCase().replace(/\s+/g, '_');

        // Check if role already exists
        const existingRoles = await db.collection('roles')
            .where('id', '==', roleId)
            .get();

        if (!existingRoles.empty) {
            throw new functions.https.HttpsError('already-exists', 'A role with this name already exists');
        }

        // Create the role
        const roleRef = db.collection('roles').doc();
        const roleData = {
            id: roleId,
            name,
            description,
            color: color || '#757575',
            isSystem: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: context.auth.uid
        };

        await roleRef.set(roleData);

        // If permissions are provided, create role-permission mappings
        if (permissions && Object.keys(permissions).length > 0) {
            const batch = db.batch();
            
            Object.entries(permissions).forEach(([permissionId, granted]) => {
                if (granted) {
                    const mappingRef = db.collection('rolePermissions').doc(`${roleId}_${permissionId}`);
                    batch.set(mappingRef, {
                        roleId,
                        permissionId,
                        granted: true,
                        createdAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            });

            await batch.commit();
        }

        return {
            success: true,
            roleId: roleRef.id,
            message: 'Role created successfully'
        };

    } catch (error) {
        console.error('Error creating role:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to create role');
    }
});

/**
 * Update an existing role
 */
exports.adminUpdateRole = functions.https.onCall(async (data, context) => {
    try {
        // Validate authentication and super admin role
        validateAuth(context);
        validateRole(context, ['superadmin']);

        const { roleId, name, description, color } = data;

        if (!roleId) {
            throw new functions.https.HttpsError('invalid-argument', 'Role ID is required');
        }

        // Get the role document
        const roleQuery = await db.collection('roles')
            .where('id', '==', roleId)
            .limit(1)
            .get();

        if (roleQuery.empty) {
            throw new functions.https.HttpsError('not-found', 'Role not found');
        }

        const roleDoc = roleQuery.docs[0];
        const roleData = roleDoc.data();

        // Check if it's a system role
        if (roleData.isSystem && roleId === 'superadmin') {
            throw new functions.https.HttpsError('permission-denied', 'Super Admin role cannot be modified');
        }

        // Update the role
        const updateData = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: context.auth.uid
        };

        if (name !== undefined) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (color !== undefined) updateData.color = color;

        await roleDoc.ref.update(updateData);

        return {
            success: true,
            message: 'Role updated successfully'
        };

    } catch (error) {
        console.error('Error updating role:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to update role');
    }
});

/**
 * Delete a custom role
 */
exports.adminDeleteRole = functions.https.onCall(async (data, context) => {
    try {
        // Validate authentication and super admin role
        validateAuth(context);
        validateRole(context, ['superadmin']);

        const { roleId } = data;

        if (!roleId) {
            throw new functions.https.HttpsError('invalid-argument', 'Role ID is required');
        }

        // Get the role document
        const roleQuery = await db.collection('roles')
            .where('id', '==', roleId)
            .limit(1)
            .get();

        if (roleQuery.empty) {
            throw new functions.https.HttpsError('not-found', 'Role not found');
        }

        const roleDoc = roleQuery.docs[0];
        const roleData = roleDoc.data();

        // Check if it's a system role
        if (roleData.isSystem) {
            throw new functions.https.HttpsError('permission-denied', 'System roles cannot be deleted');
        }

        // Check if any users have this role
        const usersWithRole = await db.collection('users')
            .where('role', '==', roleId)
            .limit(1)
            .get();

        if (!usersWithRole.empty) {
            throw new functions.https.HttpsError(
                'failed-precondition', 
                'Cannot delete role. There are users assigned to this role.'
            );
        }

        // Delete role-permission mappings
        const permissionMappings = await db.collection('rolePermissions')
            .where('roleId', '==', roleId)
            .get();

        const batch = db.batch();
        
        // Delete all permission mappings
        permissionMappings.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Delete the role
        batch.delete(roleDoc.ref);

        await batch.commit();

        return {
            success: true,
            message: 'Role deleted successfully'
        };

    } catch (error) {
        console.error('Error deleting role:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to delete role');
    }
});

/**
 * Update role permissions
 */
exports.adminUpdateRolePermissions = functions.https.onCall(async (data, context) => {
    try {
        // Validate authentication and super admin role
        validateAuth(context);
        validateRole(context, ['superadmin']);

        const { roleId, permissions } = data;

        if (!roleId || !permissions) {
            throw new functions.https.HttpsError('invalid-argument', 'Role ID and permissions are required');
        }

        // Check if role exists
        const roleQuery = await db.collection('roles')
            .where('id', '==', roleId)
            .limit(1)
            .get();

        if (roleQuery.empty) {
            throw new functions.https.HttpsError('not-found', 'Role not found');
        }

        const roleData = roleQuery.docs[0].data();

        // Check if it's the super admin role
        if (roleId === 'superadmin') {
            throw new functions.https.HttpsError('permission-denied', 'Super Admin permissions cannot be modified');
        }

        // For system roles (admin, user), we'll store overrides in the database
        // For custom roles, we'll store all permissions

        const batch = db.batch();

        // Process each permission
        for (const [permissionId, granted] of Object.entries(permissions)) {
            const mappingId = `${roleId}_${permissionId}`;
            const mappingRef = db.collection('rolePermissions').doc(mappingId);

            if (granted) {
                // Grant permission
                batch.set(mappingRef, {
                    roleId,
                    permissionId,
                    granted: true,
                    isOverride: roleData.isSystem, // Mark as override for system roles
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    updatedBy: context.auth.uid
                });
            } else {
                // Revoke permission
                if (roleData.isSystem) {
                    // For system roles, store as override with granted: false
                    batch.set(mappingRef, {
                        roleId,
                        permissionId,
                        granted: false,
                        isOverride: true,
                        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                        updatedBy: context.auth.uid
                    });
                } else {
                    // For custom roles, delete the mapping
                    batch.delete(mappingRef);
                }
            }
        }

        await batch.commit();

        return {
            success: true,
            message: 'Permissions updated successfully'
        };

    } catch (error) {
        console.error('Error updating role permissions:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to update permissions');
    }
});

/**
 * Create a new permission
 */
exports.adminCreatePermission = functions.https.onCall(async (data, context) => {
    try {
        // Validate authentication and super admin role
        validateAuth(context);
        validateRole(context, ['superadmin']);

        const { key, name, category, description } = data;

        if (!key || !name || !category) {
            throw new functions.https.HttpsError('invalid-argument', 'Key, name, and category are required');
        }

        // Generate permission ID from key
        const permissionId = key.toLowerCase();

        // Check if permission already exists
        const existingPermission = await db.collection('permissions')
            .where('id', '==', permissionId)
            .get();

        if (!existingPermission.empty) {
            throw new functions.https.HttpsError('already-exists', 'A permission with this key already exists');
        }

        // Create the permission
        const permissionRef = db.collection('permissions').doc();
        await permissionRef.set({
            id: permissionId,
            key: key.toUpperCase(),
            name,
            category,
            description: description || '',
            isSystem: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: context.auth.uid
        });

        return {
            success: true,
            permissionId: permissionRef.id,
            message: 'Permission created successfully'
        };

    } catch (error) {
        console.error('Error creating permission:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to create permission');
    }
});

/**
 * Bulk assign users to a role
 */
exports.adminBulkAssignRole = functions.https.onCall(async (data, context) => {
    try {
        // Validate authentication and admin role
        validateAuth(context);
        validateRole(context, ['superadmin', 'admin']);

        const { userIds, roleId } = data;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            throw new functions.https.HttpsError('invalid-argument', 'User IDs array is required');
        }

        if (!roleId) {
            throw new functions.https.HttpsError('invalid-argument', 'Role ID is required');
        }

        // Verify role exists
        const roleQuery = await db.collection('roles')
            .where('id', '==', roleId)
            .limit(1)
            .get();

        if (roleQuery.empty) {
            throw new functions.https.HttpsError('not-found', 'Role not found');
        }

        // Don't allow assigning super admin role through bulk operation
        if (roleId === 'superadmin') {
            throw new functions.https.HttpsError(
                'permission-denied', 
                'Super Admin role cannot be assigned through bulk operation'
            );
        }

        // Update users in batches
        const batch = db.batch();
        let updateCount = 0;

        for (const userId of userIds) {
            const userRef = db.collection('users').doc(userId);
            batch.update(userRef, {
                role: roleId,
                roleUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
                roleUpdatedBy: context.auth.uid
            });
            updateCount++;

            // Firestore batch limit is 500
            if (updateCount >= 500) {
                await batch.commit();
                updateCount = 0;
            }
        }

        // Commit remaining updates
        if (updateCount > 0) {
            await batch.commit();
        }

        return {
            success: true,
            message: `Successfully assigned ${userIds.length} users to role`,
            count: userIds.length
        };

    } catch (error) {
        console.error('Error bulk assigning roles:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to assign roles');
    }
});

/**
 * Get all role permissions (including overrides for system roles)
 */
exports.adminGetRolePermissions = functions.https.onCall(async (data, context) => {
    try {
        // Validate authentication
        validateAuth(context);

        const { roleId } = data;

        if (!roleId) {
            throw new functions.https.HttpsError('invalid-argument', 'Role ID is required');
        }

        // Get role permissions from database
        const permissionMappings = await db.collection('rolePermissions')
            .where('roleId', '==', roleId)
            .get();

        const permissions = {};
        permissionMappings.forEach(doc => {
            const data = doc.data();
            permissions[data.permissionId] = data.granted;
        });

        return {
            success: true,
            permissions
        };

    } catch (error) {
        console.error('Error getting role permissions:', error);
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        throw new functions.https.HttpsError('internal', 'Failed to get role permissions');
    }
}); 