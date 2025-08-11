const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const db = getFirestore();

// Helper function to verify admin permissions
async function verifyAdminAccess(context) {
    if (!context.auth) {
        throw new HttpsError('unauthenticated', 'Authentication required');
    }

    try {
        const userRecord = await getAuth().getUser(context.auth.uid);
        const customClaims = userRecord.customClaims || {};
        const userRole = customClaims.role || 'user';

        if (!['admin', 'superadmin'].includes(userRole)) {
            throw new HttpsError('permission-denied', 'Admin access required');
        }

        return { userRole, userEmail: userRecord.email };
    } catch (error) {
        console.error('Error verifying admin access:', error);
        throw new HttpsError('permission-denied', 'Invalid user permissions');
    }
}

// Get all follow-up tasks
exports.getFollowUpTasks = onCall(async (request) => {
    const context = request;
    
    try {
        await verifyAdminAccess(context);

        const tasksSnapshot = await db.collection('followUpTaskTemplates')
            .orderBy('category')
            .orderBy('sortOrder')
            .get();

        const tasks = [];
        tasksSnapshot.forEach(doc => {
            tasks.push({
                id: doc.id,
                ...doc.data()
            });
        });

        return {
            success: true,
            tasks
        };
    } catch (error) {
        console.error('Error getting follow-up tasks:', error);
        throw new HttpsError('internal', error.message || 'Failed to get follow-up tasks');
    }
});

// Create a new follow-up task
exports.createFollowUpTask = onCall(async (request) => {
    const context = request;
    const data = request.data;
    
    try {
        const { userEmail } = await verifyAdminAccess(context);

        const { category, taskName, description, enabled, sortOrder } = data;

        if (!category || !taskName) {
            throw new HttpsError('invalid-argument', 'Category and task name are required');
        }

        const taskData = {
            category,
            taskName: taskName.trim(),
            description: description ? description.trim() : '',
            enabled: enabled !== false,
            sortOrder: sortOrder || 0,
            createdAt: new Date(),
            createdBy: userEmail,
            updatedAt: new Date(),
            updatedBy: userEmail
        };

        const docRef = await db.collection('followUpTaskTemplates').add(taskData);

        return {
            success: true,
            taskId: docRef.id,
            task: {
                id: docRef.id,
                ...taskData
            }
        };
    } catch (error) {
        console.error('Error creating follow-up task:', error);
        throw new HttpsError('internal', error.message || 'Failed to create follow-up task');
    }
});

// Update an existing follow-up task
exports.updateFollowUpTask = onCall(async (request) => {
    const context = request;
    const data = request.data;
    
    try {
        const { userEmail } = await verifyAdminAccess(context);

        const { taskId, category, taskName, description, enabled, sortOrder } = data;

        if (!taskId) {
            throw new HttpsError('invalid-argument', 'Task ID is required');
        }

        if (!category || !taskName) {
            throw new HttpsError('invalid-argument', 'Category and task name are required');
        }

        const taskRef = db.collection('followUpTaskTemplates').doc(taskId);
        const taskDoc = await taskRef.get();

        if (!taskDoc.exists) {
            throw new HttpsError('not-found', 'Follow-up task not found');
        }

        const updateData = {
            category,
            taskName: taskName.trim(),
            description: description ? description.trim() : '',
            enabled: enabled !== false,
            sortOrder: sortOrder || 0,
            updatedAt: new Date(),
            updatedBy: userEmail
        };

        await taskRef.update(updateData);

        return {
            success: true,
            taskId,
            task: {
                id: taskId,
                ...taskDoc.data(),
                ...updateData
            }
        };
    } catch (error) {
        console.error('Error updating follow-up task:', error);
        throw new HttpsError('internal', error.message || 'Failed to update follow-up task');
    }
});

// Delete a follow-up task
exports.deleteFollowUpTask = onCall(async (request) => {
    const context = request;
    const data = request.data;
    
    try {
        await verifyAdminAccess(context);

        const { taskId } = data;

        if (!taskId) {
            throw new HttpsError('invalid-argument', 'Task ID is required');
        }

        const taskRef = db.collection('followUpTaskTemplates').doc(taskId);
        const taskDoc = await taskRef.get();

        if (!taskDoc.exists) {
            throw new HttpsError('not-found', 'Follow-up task not found');
        }

        await taskRef.delete();

        return {
            success: true,
            taskId
        };
    } catch (error) {
        console.error('Error deleting follow-up task:', error);
        throw new HttpsError('internal', error.message || 'Failed to delete follow-up task');
    }
});

// Get enabled follow-up tasks for dropdown/selection
exports.getEnabledFollowUpTasks = onCall(async (request) => {
    const context = request;
    
    try {
        // This can be called by any authenticated user to get tasks for creating follow-ups
        if (!context.auth) {
            throw new HttpsError('unauthenticated', 'Authentication required');
        }

        const tasksSnapshot = await db.collection('followUpTaskTemplates')
            .where('enabled', '==', true)
            .orderBy('category')
            .orderBy('sortOrder')
            .get();

        const tasksByCategory = {};
        tasksSnapshot.forEach(doc => {
            const task = { id: doc.id, ...doc.data() };
            const category = task.category || 'uncategorized';
            
            if (!tasksByCategory[category]) {
                tasksByCategory[category] = [];
            }
            
            tasksByCategory[category].push({
                id: task.id,
                taskName: task.taskName,
                description: task.description,
                category: task.category
            });
        });

        return {
            success: true,
            tasksByCategory
        };
    } catch (error) {
        console.error('Error getting enabled follow-up tasks:', error);
        throw new HttpsError('internal', error.message || 'Failed to get enabled follow-up tasks');
    }
});

