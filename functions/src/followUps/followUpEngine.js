// ===================================================================
// SHIPMENT FOLLOW-UPS ENGINE - CLOUD FUNCTIONS
// ===================================================================
// Backend logic for automated follow-up task generation and management
// Replaces manual spreadsheet tracking with intelligent automation

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');

// Initialize Firestore
const db = admin.firestore();

// ===================================================================
// 1. FOLLOW-UP RULES ENGINE
// ===================================================================

/**
 * Create Follow-Up Rule
 * POST /api/followups/rules
 */
exports.createFollowUpRule = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        // Validate authentication
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        // Validate required fields
        const { name, scope, checkpoint, timing, actions, assignment } = request.data;
        if (!name || !scope || !checkpoint || !timing || !actions || !assignment) {
            throw new HttpsError('invalid-argument', 'Missing required fields');
        }

        // Create rule document
        const ruleData = {
            ...request.data,
            id: admin.firestore().collection('followUpRules').doc().id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: request.auth.uid,
            version: 1,
            isActive: true
        };

        // Save to database
        const ruleRef = db.collection('followUpRules').doc(ruleData.id);
        await ruleRef.set(ruleData);

        logger.info(`Follow-up rule created: ${ruleData.id}`, { ruleData });
        return { success: true, ruleId: ruleData.id };

    } catch (error) {
        logger.error('Error creating follow-up rule:', error);
        throw new HttpsError('internal', 'Failed to create follow-up rule');
    }
});

/**
 * Update Follow-Up Rule
 * PUT /api/followups/rules/:ruleId
 */
exports.updateFollowUpRule = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { ruleId, ...updateData } = request.data;
        if (!ruleId) {
            throw new HttpsError('invalid-argument', 'Rule ID is required');
        }

        // Update rule with version increment
        const updatePayload = {
            ...updateData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            version: admin.firestore.FieldValue.increment(1)
        };

        await db.collection('followUpRules').doc(ruleId).update(updatePayload);

        logger.info(`Follow-up rule updated: ${ruleId}`);
        return { success: true };

    } catch (error) {
        logger.error('Error updating follow-up rule:', error);
        throw new HttpsError('internal', 'Failed to update follow-up rule');
    }
});

/**
 * Get Follow-Up Rules
 * GET /api/followups/rules
 */
exports.getFollowUpRules = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { companyId, includeInactive = false } = request.data;

        let query = db.collection('followUpRules');

        // Filter by company if specified
        if (companyId) {
            query = query.where('scope.value', '==', companyId);
        }

        // Filter active rules only
        if (!includeInactive) {
            query = query.where('isActive', '==', true);
        }

        const snapshot = await query.get();
        const rules = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Sort by createdAt in memory to avoid index requirement
        rules.sort((a, b) => {
            const aDate = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
            const bDate = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
            return bDate.getTime() - aDate.getTime(); // desc order
        });

        return rules;

    } catch (error) {
        logger.error('Error fetching follow-up rules:', error);
        throw new HttpsError('internal', 'Failed to fetch follow-up rules');
    }
});

// ===================================================================
// 2. TASK MANAGEMENT SYSTEM
// ===================================================================

/**
 * Create Follow-Up Task
 * POST /api/followups/tasks
 */
exports.createFollowUpTask = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        logger.info('createFollowUpTask called with data:', { requestData: request.data });
        
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { shipmentId, title, description, category, actionTypes, actions, assignedTo, dueDate } = request.data;
        
        // Handle both 'actions' and 'actionTypes' for backwards compatibility
        const finalActionTypes = actionTypes || actions || ['email'];
        
        // More detailed validation with specific error messages
        const errors = [];
        if (!shipmentId) errors.push('shipmentId is required');
        if (!title) errors.push('title is required');
        if (!assignedTo) errors.push('assignedTo is required');
        // Note: dueDate is optional
        
        // Log the exact values for debugging
        logger.info('Validation check:', { 
            shipmentId: !!shipmentId, 
            title: !!title, 
            assignedTo: !!assignedTo, 
            dueDate: dueDate, 
            dueDateType: typeof dueDate 
        });
        
        if (errors.length > 0) {
            logger.error('Validation errors in createFollowUpTask:', { errors, requestData: request.data });
            throw new HttpsError('invalid-argument', `Missing required fields: ${errors.join(', ')}`);
        }

        // Create task document
        const taskData = {
            id: admin.firestore().collection('followUpTasks').doc().id,
            shipmentId,
            companyId: request.data.companyId || null,
            customerId: request.data.customerId || null,
            ruleId: request.data.ruleId || null,
            parentTaskId: request.data.parentTaskId || null,
            title,
            description: description || '',
            category: category || 'manual',
            actionTypes: finalActionTypes, // Multi-select action types
            checkpoint: request.data.checkpoint || {},
            assignedTo,
            assignedBy: request.auth.uid,
            dueDate: dueDate ? new Date(dueDate) : null,
            scheduledFor: request.data.scheduledFor ? new Date(request.data.scheduledFor) : (dueDate ? new Date(dueDate) : null),
            estimatedDuration: request.data.estimatedDuration || 30,
            status: 'pending',
            progress: 0,
            actions: request.data.actions || [],
            communications: [],
            documents: [],
            notes: [],
            escalation: { level: 0 },
            reminders: [],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            tags: request.data.tags || [],
            customFields: request.data.customFields || {},
            notificationType: request.data.notificationType || 'email' // Fixed to email only
        };

        // Save to database
        const taskRef = db.collection('followUpTasks').doc(taskData.id);
        await taskRef.set(taskData);

        // Create activity log entry
        await createActivityLog({
            shipmentId,
            taskId: taskData.id,
            userId: request.auth.uid,
            action: 'created',
            entity: 'task',
            description: `Task created: ${title}`
        });

        // Schedule reminders if specified
        if (request.data.reminders && request.data.reminders.length > 0) {
            await scheduleTaskReminders(taskData.id, request.data.reminders);
        }

        // Schedule assignment + reminder notifications
        try {
            await scheduleTaskNotifications(taskData);
        } catch (notifyErr) {
            logger.error('Error scheduling task notifications for manual task:', notifyErr);
        }

        logger.info(`Follow-up task created: ${taskData.id}`, { taskData });
        return { success: true, taskId: taskData.id };

    } catch (error) {
        logger.error('Error creating follow-up task:', error);
        throw new HttpsError('internal', 'Failed to create follow-up task');
    }
});

/**
 * Update Follow-Up Task
 * PUT /api/followups/tasks/:taskId
 */
exports.updateFollowUpTask = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { taskId, ...updateData } = request.data;
        if (!taskId) {
            throw new HttpsError('invalid-argument', 'Task ID is required');
        }

        // Convert date fields to proper Date objects
        const processedUpdateData = { ...updateData };
        
        // Convert dueDate if present
        if (processedUpdateData.dueDate) {
            processedUpdateData.dueDate = new Date(processedUpdateData.dueDate);
        }
        
        // Convert scheduledFor if present
        if (processedUpdateData.scheduledFor) {
            processedUpdateData.scheduledFor = new Date(processedUpdateData.scheduledFor);
        }
        
        // Convert reminderDate if present
        if (processedUpdateData.reminderDate) {
            processedUpdateData.reminderDate = new Date(processedUpdateData.reminderDate);
        }

        // Update task with timestamp
        const updatePayload = {
            ...processedUpdateData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('followUpTasks').doc(taskId).update(updatePayload);

        // Create activity log entry
        await createActivityLog({
            shipmentId: updateData.shipmentId,
            taskId,
            userId: request.auth.uid,
            action: 'updated',
            entity: 'task',
            description: `Task updated`
        });

        logger.info(`Follow-up task updated: ${taskId}`);
        return { success: true };

    } catch (error) {
        logger.error('Error updating follow-up task:', error);
        throw new HttpsError('internal', 'Failed to update follow-up task');
    }
});

/**
 * Get Follow-Up Tasks
 * GET /api/followups/tasks
 */
exports.getFollowUpTasks = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        logger.info('getFollowUpTasks called with data:', request.data);
        
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { 
            shipmentId, 
            assignedTo, 
            status, 
            priority, 
            category,
            startDate,
            endDate,
            companyId,
            customerId,
            limit = 50 
        } = request.data || {};

        let query = db.collection('followUpTasks');

        // Apply basic filters only
        if (shipmentId) {
            query = query.where('shipmentId', '==', shipmentId);
        }

        if (assignedTo) {
            query = query.where('assignedTo', '==', assignedTo);
        }

        if (status) {
            query = query.where('status', '==', status);
        }

        if (priority) {
            query = query.where('priority', '==', priority);
        }

        if (category) {
            query = query.where('category', '==', category);
        }

        if (companyId) {
            query = query.where('companyId', '==', companyId);
        }

        if (customerId) {
            query = query.where('customerId', '==', customerId);
        }

        if (startDate) {
            query = query.where('createdAt', '>=', new Date(startDate));
        }

        if (endDate) {
            query = query.where('createdAt', '<=', new Date(endDate));
        }

        logger.info('Executing query with limit:', limit);
        const snapshot = await query.limit(limit).get();
        logger.info('Query executed, found docs:', snapshot.docs.length);
        
        let tasks = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        logger.info('Tasks mapped:', tasks.length);

        // Sort by createdAt in memory (avoiding index issues)
        tasks.sort((a, b) => {
            const aDate = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
            const bDate = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
            return bDate.getTime() - aDate.getTime(); // desc order
        });

        logger.info('Returning tasks:', tasks.length);
        return { tasks };

    } catch (error) {
        logger.error('Error fetching follow-up tasks:', error);
        throw new HttpsError('internal', 'Failed to fetch follow-up tasks');
    }
});

/**
 * Delete Follow-Up Task
 * DELETE /api/followups/tasks/:taskId
 */
exports.deleteFollowUpTask = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { taskId } = request.data;
        if (!taskId) {
            throw new HttpsError('invalid-argument', 'Task ID is required');
        }

        // Get task data before deletion for logging
        const taskDoc = await db.collection('followUpTasks').doc(taskId).get();
        if (!taskDoc.exists) {
            throw new HttpsError('not-found', 'Task not found');
        }

        const taskData = taskDoc.data();

        // Delete the task
        await db.collection('followUpTasks').doc(taskId).delete();

        // Create activity log entry
        await createActivityLog({
            shipmentId: taskData.shipmentId,
            taskId,
            userId: request.auth.uid,
            action: 'deleted',
            entity: 'task',
            description: `Task deleted: ${taskData.title}`
        });

        logger.info(`Follow-up task deleted: ${taskId}`);
        return { success: true };

    } catch (error) {
        logger.error('Error deleting follow-up task:', error);
        throw new HttpsError('internal', 'Failed to delete follow-up task');
    }
});

/**
 * Get Follow-Up Tasks by Shipment
 * GET /api/followups/tasks/shipment/:shipmentId
 */
exports.getFollowUpTasksByShipment = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { shipmentId } = request.data;
        if (!shipmentId) {
            throw new HttpsError('invalid-argument', 'Shipment ID is required');
        }

        const snapshot = await db.collection('followUpTasks')
            .where('shipmentId', '==', shipmentId)
            .orderBy('createdAt', 'desc')
            .get();

        const tasks = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return { tasks };

    } catch (error) {
        logger.error('Error fetching tasks by shipment:', error);
        throw new HttpsError('internal', 'Failed to fetch tasks by shipment');
    }
});

/**
 * Add Task Note
 * POST /api/followups/tasks/:taskId/notes
 */
exports.addTaskNote = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { taskId, note } = request.data;
        if (!taskId || !note) {
            throw new HttpsError('invalid-argument', 'Task ID and note are required');
        }

        const noteData = {
            id: admin.firestore().collection('followUpTasks').doc().id,
            content: note,
            createdAt: new Date(),
            createdBy: request.auth.uid
        };

        await db.collection('followUpTasks').doc(taskId).update({
            notes: admin.firestore.FieldValue.arrayUnion(noteData),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        logger.info(`Note added to task: ${taskId}`);
        return { success: true, noteId: noteData.id };

    } catch (error) {
        logger.error('Error adding task note:', error);
        throw new HttpsError('internal', 'Failed to add task note');
    }
});

/**
 * Complete Task
 * POST /api/followups/tasks/:taskId/complete
 */
exports.completeTask = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { taskId, completionNote } = request.data;
        if (!taskId) {
            throw new HttpsError('invalid-argument', 'Task ID is required');
        }

        const updateData = {
            status: 'completed',
            progress: 100,
            completedAt: admin.firestore.FieldValue.serverTimestamp(),
            completedBy: request.auth.uid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (completionNote) {
            const noteData = {
                id: admin.firestore().collection('followUpTasks').doc().id,
                content: completionNote,
                createdAt: new Date(),
                createdBy: request.auth.uid,
                type: 'completion'
            };
            updateData.notes = admin.firestore.FieldValue.arrayUnion(noteData);
        }

        await db.collection('followUpTasks').doc(taskId).update(updateData);

        // Create activity log entry
        await createActivityLog({
            taskId,
            userId: request.auth.uid,
            action: 'completed',
            entity: 'task',
            description: `Task completed${completionNote ? ': ' + completionNote : ''}`
        });

        logger.info(`Task completed: ${taskId}`);
        return { success: true };

    } catch (error) {
        logger.error('Error completing task:', error);
        throw new HttpsError('internal', 'Failed to complete task');
    }
});

/**
 * Escalate Task
 * POST /api/followups/tasks/:taskId/escalate
 */
exports.escalateTask = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { taskId, escalationReason, newAssignee } = request.data;
        if (!taskId || !escalationReason) {
            throw new HttpsError('invalid-argument', 'Task ID and escalation reason are required');
        }

        const updateData = {
            'escalation.level': admin.firestore.FieldValue.increment(1),
            'escalation.lastEscalatedAt': admin.firestore.FieldValue.serverTimestamp(),
            'escalation.reason': escalationReason,
            'escalation.escalatedBy': request.auth.uid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (newAssignee) {
            updateData.assignedTo = newAssignee;
        }

        await db.collection('followUpTasks').doc(taskId).update(updateData);

        // Create activity log entry
        await createActivityLog({
            taskId,
            userId: request.auth.uid,
            action: 'escalated',
            entity: 'task',
            description: `Task escalated: ${escalationReason}`
        });

        logger.info(`Task escalated: ${taskId}`);
        return { success: true };

    } catch (error) {
        logger.error('Error escalating task:', error);
        throw new HttpsError('internal', 'Failed to escalate task');
    }
});

/**
 * Get Shipment Follow-Up Summary
 * GET /api/followups/shipment/:shipmentId/summary
 */
exports.getShipmentFollowUpSummary = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { shipmentId } = request.data;
        if (!shipmentId) {
            throw new HttpsError('invalid-argument', 'Shipment ID is required');
        }

        const snapshot = await db.collection('followUpTasks')
            .where('shipmentId', '==', shipmentId)
            .get();

        const tasks = snapshot.docs.map(doc => doc.data());

        const summary = {
            totalTasks: tasks.length,
            pendingTasks: tasks.filter(t => t.status === 'pending').length,
            completedTasks: tasks.filter(t => t.status === 'completed').length,
            overdueTasks: tasks.filter(t => t.status === 'pending' && new Date(t.dueDate) < new Date()).length,
            highPriorityTasks: tasks.filter(t => t.priority === 'high' || t.priority === 'urgent').length,
            requiresAttention: tasks.some(t => 
                t.status === 'pending' && 
                (new Date(t.dueDate) < new Date() || t.priority === 'high' || t.priority === 'urgent')
            )
        };

        return { summary };

    } catch (error) {
        logger.error('Error fetching shipment follow-up summary:', error);
        throw new HttpsError('internal', 'Failed to fetch shipment follow-up summary');
    }
});

// ===================================================================
// 3. AUTOMATED TASK GENERATION
// ===================================================================

/**
 * Process Shipment for Follow-Up Rules
 * Triggered when shipment status changes or ETA is updated
 */
exports.processShipmentFollowUps = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        const shipmentId = request.data.shipmentId;
        const before = request.data.before ? request.data.before.data() : null;
        const after = request.data.after ? request.data.after.data() : null;

        // Skip if document was deleted
        if (!after) return;

        logger.info(`Processing follow-ups for shipment: ${shipmentId}`);

        // Get all active follow-up rules
        const rulesSnapshot = await db.collection('followUpRules')
            .where('isActive', '==', true)
            .get();

        const rules = rulesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Process each rule
        for (const rule of rules) {
            await processRuleForShipment(rule, after, before);
        }

    } catch (error) {
        logger.error('Error processing shipment follow-ups:', error);
    }
});

/**
 * Process a specific rule for a shipment
 */
async function processRuleForShipment(rule, shipment, previousShipment) {
    try {
        // Check if rule applies to this shipment
        if (!doesRuleApplyToShipment(rule, shipment)) {
            return;
        }

        // Check if rule should trigger
        const shouldTrigger = shouldRuleTrigger(rule, shipment, previousShipment);
        if (!shouldTrigger) {
            return;
        }

        // Check if task already exists for this rule and shipment
        const existingTasksSnapshot = await db.collection('followUpTasks')
            .where('shipmentId', '==', shipment.shipmentID)
            .where('ruleId', '==', rule.id)
            .where('status', 'in', ['pending', 'in_progress'])
            .get();

        if (!existingTasksSnapshot.empty) {
            logger.info(`Task already exists for rule ${rule.id} and shipment ${shipment.shipmentID}`);
            return;
        }

        // Calculate due date based on rule timing
        const dueDate = calculateTaskDueDate(rule.timing, shipment);

        // Determine assignee
        const assignedTo = determineTaskAssignee(rule.assignment, shipment);

        // Create task
        const taskData = {
            id: admin.firestore().collection('followUpTasks').doc().id,
            shipmentId: shipment.shipmentID,
            companyId: shipment.companyID || shipment.companyId || null,
            ruleId: rule.id,
            title: rule.checkpoint.name,
            description: rule.checkpoint.description || `Automated task: ${rule.checkpoint.name}`,
            category: rule.checkpoint.category,
            priority: rule.checkpoint.priority,
            checkpoint: rule.checkpoint,
            assignedTo,
            assignedBy: 'system',
            dueDate,
            scheduledFor: dueDate,
            estimatedDuration: 30, // Default duration
            status: 'pending',
            progress: 0,
            actions: rule.actions.map(action => ({
                ...action,
                status: 'pending'
            })),
            communications: [],
            documents: [],
            notes: [],
            escalation: { level: 0 },
            reminders: [],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            tags: [`rule:${rule.id}`, `auto-generated`],
            customFields: {}
        };

        // Save task
        await db.collection('followUpTasks').doc(taskData.id).set(taskData);

        // Create activity log
        await createActivityLog({
            shipmentId: shipment.shipmentID,
            taskId: taskData.id,
            userId: 'system',
            action: 'created',
            entity: 'task',
            description: `Automated task created by rule: ${rule.name}`,
            context: {
                automated: true,
                ruleId: rule.id
            }
        });

        // Schedule notifications
        await scheduleTaskNotifications(taskData);

        logger.info(`Automated task created: ${taskData.id} for shipment: ${shipment.shipmentID}`);

    } catch (error) {
        logger.error('Error processing rule for shipment:', error);
    }
}

/**
 * Check if a rule applies to a specific shipment
 */
function doesRuleApplyToShipment(rule, shipment) {
    // Check rule scope
    if (rule.scope.type === 'company' && shipment.companyID !== rule.scope.value) {
        return false;
    }

    if (rule.scope.type === 'shipment_type' && shipment.shipmentType !== rule.scope.value) {
        return false;
    }

    if (rule.scope.type === 'service_level' && shipment.serviceLevel !== rule.scope.value) {
        return false;
    }

    if (rule.scope.type === 'carrier' && shipment.carrier !== rule.scope.value) {
        return false;
    }

    // Check rule conditions
    if (rule.scope.conditions && rule.scope.conditions.length > 0) {
        return evaluateConditions(rule.scope.conditions, shipment);
    }

    return true;
}

/**
 * Evaluate rule conditions against shipment data
 */
function evaluateConditions(conditions, shipment) {
    const results = conditions.map(condition => {
        const fieldValue = getNestedValue(shipment, condition.field);
        
        switch (condition.operator) {
            case 'equals':
                return fieldValue === condition.value;
            case 'contains':
                return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
            case 'greater_than':
                return Number(fieldValue) > Number(condition.value);
            case 'less_than':
                return Number(fieldValue) < Number(condition.value);
            case 'between':
                const [min, max] = condition.value;
                return Number(fieldValue) >= Number(min) && Number(fieldValue) <= Number(max);
            default:
                return false;
        }
    });

    // Apply logical operators
    if (conditions.length === 1) {
        return results[0];
    }

    // For multiple conditions, use the logical operator from the first condition
    const logicalOp = conditions[0].logicalOperator || 'and';
    
    if (logicalOp === 'and') {
        return results.every(result => result);
    } else {
        return results.some(result => result);
    }
}

/**
 * Check if a rule should trigger based on timing configuration
 */
function shouldRuleTrigger(rule, shipment, previousShipment) {
    const timing = rule.timing;
    
    switch (timing.trigger) {
        case 'status_change':
            return previousShipment && shipment.status !== previousShipment.status;
            
        case 'time_before_eta':
            if (!shipment.eta) return false;
            const etaDate = new Date(shipment.eta);
            const triggerTime = new Date(etaDate.getTime() - (timing.offset * getMillisecondsForUnit(timing.offsetUnit)));
            return new Date() >= triggerTime;
            
        case 'time_after_eta':
            if (!shipment.eta) return false;
            const etaAfterDate = new Date(shipment.eta);
            const triggerAfterTime = new Date(etaAfterDate.getTime() + (timing.offset * getMillisecondsForUnit(timing.offsetUnit)));
            return new Date() >= triggerAfterTime;
            
        case 'fixed_time':
            // Check if current time matches the specified time
            const now = new Date();
            const [hours, minutes] = timing.specificTime.split(':');
            const targetTime = new Date();
            targetTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            return Math.abs(now.getTime() - targetTime.getTime()) < 60000; // Within 1 minute
            
        case 'manual':
            return false; // Manual rules don't auto-trigger
            
        default:
            return false;
    }
}

/**
 * Calculate task due date based on timing configuration
 */
function calculateTaskDueDate(timing, shipment) {
    const now = new Date();
    
    switch (timing.trigger) {
        case 'time_before_eta':
            if (shipment.eta) {
                return new Date(new Date(shipment.eta).getTime() - (timing.offset * getMillisecondsForUnit(timing.offsetUnit)));
            }
            break;
            
        case 'time_after_eta':
            if (shipment.eta) {
                return new Date(new Date(shipment.eta).getTime() + (timing.offset * getMillisecondsForUnit(timing.offsetUnit)));
            }
            break;
            
        case 'fixed_time':
            const [hours, minutes] = timing.specificTime.split(':');
            const dueDate = new Date();
            dueDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);
            if (dueDate <= now) {
                dueDate.setDate(dueDate.getDate() + 1); // Next day
            }
            return dueDate;
    }
    
    // Default: 1 hour from now
    return new Date(now.getTime() + 60 * 60 * 1000);
}

/**
 * Determine task assignee based on assignment rules
 */
function determineTaskAssignee(assignment, shipment) {
    // TODO: Implement assignment logic based on method
    // For now, return the specified assignee
    return assignment.assignTo || 'unassigned';
}

// ===================================================================
// 4. NOTIFICATION SYSTEM
// ===================================================================

/**
 * Schedule Task Notifications
 */
async function scheduleTaskNotifications(task) {
    try {
        // Create assignment notification
        const assignmentNotification = {
            id: admin.firestore().collection('notifications').doc().id,
            taskId: task.id,
            recipientId: task.assignedTo,
            companyId: task.companyId || null,
            type: 'assignment',
            channel: task.notificationType || 'email', // Use task notification type
            actionTypes: task.actionTypes || ['email'], // Include action types
            subject: `New Task Assigned: ${task.title}`,
            message: `You have been assigned a new follow-up task for shipment ${task.shipmentId}. Communication methods: ${(task.actionTypes || ['email']).join(', ')}`,
            templateId: 'task_assignment',
            templateData: { task },
            scheduledFor: admin.firestore.FieldValue.serverTimestamp(),
            sent: false,
            status: 'pending',
            retryCount: 0,
            maxRetries: 3,
            retryInterval: 5, // minutes
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('notifications').doc(assignmentNotification.id).set(assignmentNotification);

        // Schedule reminder notification (15 minutes before due date)
        const reminderTime = new Date(task.dueDate.getTime() - 15 * 60 * 1000);
        
        if (reminderTime > new Date()) {
            const reminderNotification = {
                id: admin.firestore().collection('notifications').doc().id,
                taskId: task.id,
                recipientId: task.assignedTo,
                companyId: task.companyId || null,
                type: 'reminder',
                channel: task.notificationType || 'email',
                actionTypes: task.actionTypes || ['email'],
                subject: `Task Due Soon: ${task.title}`,
                message: `Your follow-up task for shipment ${task.shipmentId} is due in 15 minutes. Communication methods: ${(task.actionTypes || ['email']).join(', ')}`,
                templateId: 'task_reminder',
                templateData: { task },
                scheduledFor: reminderTime,
                sent: false,
                status: 'pending',
                retryCount: 0,
                maxRetries: 3,
                retryInterval: 5,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('notifications').doc(reminderNotification.id).set(reminderNotification);
        }

    } catch (error) {
        logger.error('Error scheduling task notifications:', error);
    }
}

/**
 * Process Pending Notifications
 * Scheduled function to send pending notifications
 */
exports.processPendingNotifications = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async () => {
    try {
        const nowTs = admin.firestore.Timestamp.now();

        const pendingSnapshot = await db.collection('notifications')
            .where('status', '==', 'pending')
            .where('scheduledFor', '<=', nowTs)
            .limit(50)
            .get();

        const notifications = pendingSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        logger.info(`Processing ${notifications.length} pending notifications`);

        for (const notification of notifications) {
            await processNotification(notification);
        }
    } catch (error) {
        logger.error('Error processing pending notifications:', error);
    }
});

/**
 * Process a single notification
 */
async function processNotification(notification) {
    try {
        // Minimal email integration using existing sendgridService
        const { sendNotificationEmail } = require('../email/sendgridService');

        if (notification.channel === 'email') {
            const type = notification.type === 'reminder' ? 'status_changed' : 'status_changed';
            // Reuse a generic type; templates can be expanded later if needed
            const companyId = notification.companyId || notification.recipientCompanyId || 'INTERNAL';
            const data = notification.templateData?.task ? {
                shipmentNumber: notification.templateData.task.shipmentId,
                currentStatus: `Follow-up: ${notification.templateData.task.title}`,
                description: notification.message || 'Task notification'
            } : { shipmentNumber: 'N/A', currentStatus: 'Follow-up', description: notification.message || '' };

            try {
                await sendNotificationEmail(type, companyId, data, notification.id);
            } catch (sendErr) {
                logger.error('Error sending follow-up email via SendGrid', sendErr);
            }
        }

        await db.collection('notifications').doc(notification.id).update({
            status: 'sent',
            sent: true,
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        logger.info(`Notification sent: ${notification.id}`);

    } catch (error) {
        logger.error(`Error sending notification ${notification.id}:`, error);
        
        // Update retry count
        const retryCount = (notification.retryCount || 0) + 1;
        
        if (retryCount >= notification.maxRetries) {
            // Mark as failed
            await db.collection('notifications').doc(notification.id).update({
                status: 'failed',
                error: error.message,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } else {
            // Schedule retry
            const retryTime = admin.firestore.Timestamp.fromDate(new Date(Date.now() + (notification.retryInterval || 5) * 60 * 1000));
            
            await db.collection('notifications').doc(notification.id).update({
                retryCount,
                scheduledFor: retryTime,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    }
}

// ===================================================================
// 5. HELPER FUNCTIONS
// ===================================================================

/**
 * Create activity log entry
 */
async function createActivityLog(logData) {
    try {
        const activityData = {
            id: admin.firestore().collection('followUpActivity').doc().id,
            ...logData,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('followUpActivity').doc(activityData.id).set(activityData);
    } catch (error) {
        logger.error('Error creating activity log:', error);
    }
}

/**
 * Get nested object value by path
 */
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
}

/**
 * Convert time unit to milliseconds
 */
function getMillisecondsForUnit(unit) {
    const units = {
        minutes: 60 * 1000,
        hours: 60 * 60 * 1000,
        days: 24 * 60 * 60 * 1000,
        weeks: 7 * 24 * 60 * 60 * 1000
    };
    return units[unit] || units.days;
}

/**
 * Schedule task reminders
 */
async function scheduleTaskReminders(taskId, reminders) {
    try {
        // This would integrate with a scheduling system
        // For now, just log the reminder schedule
        logger.info(`Reminders scheduled for task ${taskId}:`, reminders);
    } catch (error) {
        logger.error('Error scheduling reminders:', error);
    }
} 

/**
 * Schedule a custom reminder notification for a task
 */
exports.scheduleTaskReminder = onCall({ cors: true, timeoutSeconds: 60 }, async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { taskId, scheduledAt, recipientId } = request.data || {};
        if (!taskId || !scheduledAt) {
            throw new HttpsError('invalid-argument', 'taskId and scheduledAt are required');
        }

        const taskSnap = await db.collection('followUpTasks').doc(taskId).get();
        if (!taskSnap.exists) {
            throw new HttpsError('not-found', 'Task not found');
        }
        const task = taskSnap.data();

        const sched = new Date(scheduledAt);
        if (isNaN(sched.getTime())) {
            throw new HttpsError('invalid-argument', 'scheduledAt must be a valid date');
        }

        const notification = {
            id: admin.firestore().collection('notifications').doc().id,
            taskId,
            recipientId: recipientId || task.assignedTo,
            companyId: task.companyId || null,
            type: 'reminder',
            channel: task.notificationType || 'email',
            actionTypes: task.actionTypes || ['email'],
            subject: `Reminder: ${task.title}`,
            message: `Reminder for follow-up task on shipment ${task.shipmentId}.`,
            templateId: 'task_reminder',
            templateData: { task },
            scheduledFor: admin.firestore.Timestamp.fromDate(sched),
            sent: false,
            status: 'pending',
            retryCount: 0,
            maxRetries: 3,
            retryInterval: 5,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('notifications').doc(notification.id).set(notification);

        logger.info('Custom reminder scheduled', { id: notification.id, taskId, scheduledAt: sched.toISOString() });
        return { success: true, notificationId: notification.id };
    } catch (error) {
        logger.error('Error scheduling custom reminder:', error);
        throw new HttpsError('internal', 'Failed to schedule reminder');
    }
});