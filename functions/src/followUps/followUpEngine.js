// ===================================================================
// SHIPMENT FOLLOW-UPS ENGINE - CLOUD FUNCTIONS
// ===================================================================
// Backend logic for automated follow-up task generation and management
// Replaces manual spreadsheet tracking with intelligent automation

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { logger } = require('firebase-functions');

// Initialize Firestore
const db = admin.firestore();

// ===================================================================
// 1. FOLLOW-UP RULES ENGINE
// ===================================================================

/**
 * Create Follow-Up Rule
 * POST /api/followups/rules
 */
exports.createFollowUpRule = functions.https.onCall(async (data, context) => {
    try {
        // Validate authentication
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        // Validate required fields
        const { name, scope, checkpoint, timing, actions, assignment } = data;
        if (!name || !scope || !checkpoint || !timing || !actions || !assignment) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
        }

        // Create rule document
        const ruleData = {
            ...data,
            id: admin.firestore().collection('followUpRules').doc().id,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: context.auth.uid,
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
        throw new functions.https.HttpsError('internal', 'Failed to create follow-up rule');
    }
});

/**
 * Update Follow-Up Rule
 * PUT /api/followups/rules/:ruleId
 */
exports.updateFollowUpRule = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { ruleId, ...updateData } = data;
        if (!ruleId) {
            throw new functions.https.HttpsError('invalid-argument', 'Rule ID is required');
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
        throw new functions.https.HttpsError('internal', 'Failed to update follow-up rule');
    }
});

/**
 * Get Follow-Up Rules
 * GET /api/followups/rules
 */
exports.getFollowUpRules = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { companyId, includeInactive = false } = data;

        let query = db.collection('followUpRules');

        // Filter by company if specified
        if (companyId) {
            query = query.where('scope.value', '==', companyId);
        }

        // Filter active rules only
        if (!includeInactive) {
            query = query.where('isActive', '==', true);
        }

        const snapshot = await query.orderBy('createdAt', 'desc').get();
        const rules = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return { rules };

    } catch (error) {
        logger.error('Error fetching follow-up rules:', error);
        throw new functions.https.HttpsError('internal', 'Failed to fetch follow-up rules');
    }
});

// ===================================================================
// 2. TASK MANAGEMENT SYSTEM
// ===================================================================

/**
 * Create Follow-Up Task
 * POST /api/followups/tasks
 */
exports.createFollowUpTask = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { shipmentId, title, description, category, priority, assignedTo, dueDate } = data;
        
        if (!shipmentId || !title || !assignedTo || !dueDate) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing required fields');
        }

        // Create task document
        const taskData = {
            id: admin.firestore().collection('followUpTasks').doc().id,
            shipmentId,
            ruleId: data.ruleId || null,
            parentTaskId: data.parentTaskId || null,
            title,
            description: description || '',
            category: category || 'manual',
            priority: priority || 'medium',
            checkpoint: data.checkpoint || {},
            assignedTo,
            assignedBy: context.auth.uid,
            dueDate: new Date(dueDate),
            scheduledFor: data.scheduledFor ? new Date(data.scheduledFor) : new Date(dueDate),
            estimatedDuration: data.estimatedDuration || 30,
            status: 'pending',
            progress: 0,
            actions: data.actions || [],
            communications: [],
            documents: [],
            notes: [],
            escalation: { level: 0 },
            reminders: [],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            tags: data.tags || [],
            customFields: data.customFields || {}
        };

        // Save to database
        const taskRef = db.collection('followUpTasks').doc(taskData.id);
        await taskRef.set(taskData);

        // Create activity log entry
        await createActivityLog({
            shipmentId,
            taskId: taskData.id,
            userId: context.auth.uid,
            action: 'created',
            entity: 'task',
            description: `Task created: ${title}`
        });

        // Schedule reminders if specified
        if (data.reminders && data.reminders.length > 0) {
            await scheduleTaskReminders(taskData.id, data.reminders);
        }

        logger.info(`Follow-up task created: ${taskData.id}`, { taskData });
        return { success: true, taskId: taskData.id };

    } catch (error) {
        logger.error('Error creating follow-up task:', error);
        throw new functions.https.HttpsError('internal', 'Failed to create follow-up task');
    }
});

/**
 * Update Follow-Up Task
 * PUT /api/followups/tasks/:taskId
 */
exports.updateFollowUpTask = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { taskId, ...updateData } = data;
        if (!taskId) {
            throw new functions.https.HttpsError('invalid-argument', 'Task ID is required');
        }

        // Get current task
        const taskRef = db.collection('followUpTasks').doc(taskId);
        const taskDoc = await taskRef.get();
        
        if (!taskDoc.exists) {
            throw new functions.https.HttpsError('not-found', 'Task not found');
        }

        const currentTask = taskDoc.data();
        const changes = [];

        // Track changes for audit log
        Object.keys(updateData).forEach(key => {
            if (currentTask[key] !== updateData[key]) {
                changes.push({
                    field: key,
                    oldValue: currentTask[key],
                    newValue: updateData[key]
                });
            }
        });

        // Update task
        const updatePayload = {
            ...updateData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // Handle status changes
        if (updateData.status && updateData.status !== currentTask.status) {
            if (updateData.status === 'completed') {
                updatePayload.completedAt = admin.firestore.FieldValue.serverTimestamp();
                updatePayload.completedBy = context.auth.uid;
                updatePayload.progress = 100;
            }
        }

        await taskRef.update(updatePayload);

        // Create activity log entry
        if (changes.length > 0) {
            await createActivityLog({
                shipmentId: currentTask.shipmentId,
                taskId,
                userId: context.auth.uid,
                action: 'updated',
                entity: 'task',
                description: `Task updated`,
                changes
            });
        }

        logger.info(`Follow-up task updated: ${taskId}`);
        return { success: true };

    } catch (error) {
        logger.error('Error updating follow-up task:', error);
        throw new functions.https.HttpsError('internal', 'Failed to update follow-up task');
    }
});

/**
 * Get Follow-Up Tasks
 * GET /api/followups/tasks
 */
exports.getFollowUpTasks = functions.https.onCall(async (data, context) => {
    try {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated');
        }

        const { 
            shipmentId, 
            assignedTo, 
            status, 
            priority, 
            category,
            startDate,
            endDate,
            limit = 50 
        } = data;

        let query = db.collection('followUpTasks');

        // Apply filters
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

        if (startDate) {
            query = query.where('dueDate', '>=', new Date(startDate));
        }

        if (endDate) {
            query = query.where('dueDate', '<=', new Date(endDate));
        }

        // Apply ordering and limit
        query = query.orderBy('dueDate', 'asc').limit(limit);

        const snapshot = await query.get();
        const tasks = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        return { tasks };

    } catch (error) {
        logger.error('Error fetching follow-up tasks:', error);
        throw new functions.https.HttpsError('internal', 'Failed to fetch follow-up tasks');
    }
});

// ===================================================================
// 3. AUTOMATED TASK GENERATION
// ===================================================================

/**
 * Process Shipment for Follow-Up Rules
 * Triggered when shipment status changes or ETA is updated
 */
exports.processShipmentFollowUps = functions.firestore
    .document('shipments/{shipmentId}')
    .onWrite(async (change, context) => {
        try {
            const shipmentId = context.params.shipmentId;
            const before = change.before.exists ? change.before.data() : null;
            const after = change.after.exists ? change.after.data() : null;

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
            type: 'assignment',
            channel: 'email',
            priority: task.priority,
            subject: `New Task Assigned: ${task.title}`,
            message: `You have been assigned a new follow-up task for shipment ${task.shipmentId}`,
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
                type: 'reminder',
                channel: 'email',
                priority: task.priority,
                subject: `Task Due Soon: ${task.title}`,
                message: `Your follow-up task for shipment ${task.shipmentId} is due in 15 minutes`,
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
exports.processPendingNotifications = functions.pubsub
    .schedule('every 1 minutes')
    .onRun(async (context) => {
        try {
            const now = admin.firestore.Timestamp.now();
            
            // Get pending notifications that are due
            const pendingSnapshot = await db.collection('notifications')
                .where('status', '==', 'pending')
                .where('scheduledFor', '<=', now)
                .limit(50)
                .get();

            const notifications = pendingSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            logger.info(`Processing ${notifications.length} pending notifications`);

            // Process each notification
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
        // TODO: Implement actual notification sending (email, SMS, etc.)
        // For now, just mark as sent
        
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
            const retryTime = new Date(Date.now() + notification.retryInterval * 60 * 1000);
            
            await db.collection('notifications').doc(notification.id).update({
                retryCount,
                scheduledFor: retryTime,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    }
}

// ===================================================================
// 5. UTILITY FUNCTIONS
// ===================================================================

/**
 * Create activity log entry
 */
async function createActivityLog(logData) {
    const activityLog = {
        id: admin.firestore().collection('activityLogs').doc().id,
        ...logData,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        metadata: logData.metadata || {}
    };

    await db.collection('activityLogs').doc(activityLog.id).set(activityLog);
}

/**
 * Get nested object value by path
 */
function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
}

/**
 * Get milliseconds for time unit
 */
function getMillisecondsForUnit(unit) {
    switch (unit) {
        case 'minutes': return 60 * 1000;
        case 'hours': return 60 * 60 * 1000;
        case 'days': return 24 * 60 * 60 * 1000;
        default: return 60 * 60 * 1000; // Default to hours
    }
}

/**
 * Schedule task reminders
 */
async function scheduleTaskReminders(taskId, reminders) {
    for (const reminder of reminders) {
        const reminderDoc = {
            id: admin.firestore().collection('taskReminders').doc().id,
            taskId,
            type: reminder.type,
            scheduledFor: new Date(reminder.scheduledFor),
            sent: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        };

        await db.collection('taskReminders').doc(reminderDoc.id).set(reminderDoc);
    }
} 