const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const logger = require('firebase-functions/logger');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp();
}

// Get Firestore instance
const db = getFirestore();

/**
 * Schedule a report to run automatically
 */
exports.scheduleReport = onCall(async (request) => {
    try {
        const { 
            reportId,
            schedule,
            companyId,
            userId
        } = request.data;

        // Validate required parameters
        if (!reportId || !schedule || !companyId) {
            throw new HttpsError('invalid-argument', 'Report ID, schedule, and company ID are required');
        }

        logger.info(`Scheduling report ${reportId} for company ${companyId}`, {
            reportId,
            schedule,
            companyId,
            userId
        });

        // Get the report configuration
        const reportDoc = await db.collection('reports').doc(reportId).get();
        if (!reportDoc.exists) {
            throw new HttpsError('not-found', 'Report configuration not found');
        }

        const reportConfig = reportDoc.data();

        // Create schedule entry
        const scheduleId = `${reportId}-${Date.now()}`;
        const scheduleData = {
            id: scheduleId,
            reportId,
            companyId,
            userId,
            schedule,
            reportConfig,
            status: 'active',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            lastRun: null,
            nextRun: calculateNextRun(schedule),
            runCount: 0,
            failureCount: 0
        };

        await db.collection('reportSchedules').doc(scheduleId).set(scheduleData);

        logger.info(`Report schedule created: ${scheduleId}`);

        return {
            success: true,
            scheduleId,
            nextRun: scheduleData.nextRun
        };

    } catch (error) {
        logger.error('Error scheduling report:', error);
        
        if (error instanceof HttpsError) {
            throw error;
        }
        
        throw new HttpsError('internal', `Failed to schedule report: ${error.message}`);
    }
});

/**
 * Update an existing report schedule
 */
exports.updateReportSchedule = onCall(async (request) => {
    try {
        const { 
            scheduleId,
            schedule,
            status,
            companyId
        } = request.data;

        if (!scheduleId || !companyId) {
            throw new HttpsError('invalid-argument', 'Schedule ID and company ID are required');
        }

        const scheduleRef = db.collection('reportSchedules').doc(scheduleId);
        const scheduleDoc = await scheduleRef.get();

        if (!scheduleDoc.exists) {
            throw new HttpsError('not-found', 'Report schedule not found');
        }

        const updateData = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (schedule) {
            updateData.schedule = schedule;
            updateData.nextRun = calculateNextRun(schedule);
        }

        if (status) {
            updateData.status = status;
        }

        await scheduleRef.update(updateData);

        logger.info(`Report schedule updated: ${scheduleId}`);

        return {
            success: true,
            scheduleId
        };

    } catch (error) {
        logger.error('Error updating report schedule:', error);
        
        if (error instanceof HttpsError) {
            throw error;
        }
        
        throw new HttpsError('internal', `Failed to update report schedule: ${error.message}`);
    }
});

/**
 * Delete a report schedule
 */
exports.deleteReportSchedule = onCall(async (request) => {
    try {
        const { scheduleId, companyId } = request.data;

        if (!scheduleId || !companyId) {
            throw new HttpsError('invalid-argument', 'Schedule ID and company ID are required');
        }

        await db.collection('reportSchedules').doc(scheduleId).delete();

        logger.info(`Report schedule deleted: ${scheduleId}`);

        return {
            success: true,
            scheduleId
        };

    } catch (error) {
        logger.error('Error deleting report schedule:', error);
        
        if (error instanceof HttpsError) {
            throw error;
        }
        
        throw new HttpsError('internal', `Failed to delete report schedule: ${error.message}`);
    }
});

/**
 * Scheduled function to run reports automatically
 * Runs every hour to check for scheduled reports
 */
exports.runScheduledReports = onSchedule('0 * * * *', async (event) => {
    try {
        logger.info('Running scheduled reports check');

        const now = new Date();
        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);

        // Get all active schedules that should run in the next hour
        const schedulesSnapshot = await db.collection('reportSchedules')
            .where('status', '==', 'active')
            .where('nextRun', '<=', admin.firestore.Timestamp.fromDate(oneHourFromNow))
            .get();

        logger.info(`Found ${schedulesSnapshot.docs.length} scheduled reports to process`);

        const promises = schedulesSnapshot.docs.map(async (doc) => {
            const schedule = { id: doc.id, ...doc.data() };
            
            try {
                await executeScheduledReport(schedule);
            } catch (error) {
                logger.error(`Error executing scheduled report ${schedule.id}:`, error);
                
                // Update failure count
                await doc.ref.update({
                    failureCount: admin.firestore.FieldValue.increment(1),
                    lastError: error.message,
                    lastErrorAt: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        });

        await Promise.all(promises);

        logger.info('Scheduled reports check completed');

    } catch (error) {
        logger.error('Error in scheduled reports function:', error);
    }
});

/**
 * Execute a scheduled report
 */
async function executeScheduledReport(schedule) {
    logger.info(`Executing scheduled report: ${schedule.id}`);

    const { generateReport } = require('./generateReport');

    // Prepare report generation request
    const reportRequest = {
        data: {
            ...schedule.reportConfig,
            companyId: schedule.companyId,
            userId: schedule.userId,
            scheduledExecution: true,
            scheduleId: schedule.id
        }
    };

    try {
        // Generate the report
        const result = await generateReport(reportRequest);

        // Update schedule with successful run
        await db.collection('reportSchedules').doc(schedule.id).update({
            lastRun: admin.firestore.FieldValue.serverTimestamp(),
            nextRun: calculateNextRun(schedule.schedule),
            runCount: admin.firestore.FieldValue.increment(1),
            lastResult: result,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Send notification emails if configured
        if (schedule.reportConfig.emailRecipients && schedule.reportConfig.emailRecipients.length > 0) {
            await sendScheduledReportNotification(schedule, result, 'success');
        }

        logger.info(`Scheduled report executed successfully: ${schedule.id}`);

    } catch (error) {
        logger.error(`Scheduled report execution failed: ${schedule.id}`, error);

        // Update schedule with failure
        await db.collection('reportSchedules').doc(schedule.id).update({
            failureCount: admin.firestore.FieldValue.increment(1),
            lastError: error.message,
            lastErrorAt: admin.firestore.FieldValue.serverTimestamp(),
            nextRun: calculateNextRun(schedule.schedule), // Still schedule next run
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Send failure notification
        if (schedule.reportConfig.emailRecipients && schedule.reportConfig.emailRecipients.length > 0) {
            await sendScheduledReportNotification(schedule, null, 'failure', error.message);
        }

        throw error;
    }
}

/**
 * Calculate the next run time based on schedule configuration
 */
function calculateNextRun(schedule) {
    const now = new Date();
    let nextRun = new Date(now);

    switch (schedule.frequency) {
        case 'daily':
            nextRun.setDate(nextRun.getDate() + 1);
            break;
        
        case 'weekly':
            const daysOfWeek = {
                'sunday': 0, 'monday': 1, 'tuesday': 2, 'wednesday': 3,
                'thursday': 4, 'friday': 5, 'saturday': 6
            };
            const targetDay = daysOfWeek[schedule.dayOfWeek] || 1;
            const currentDay = nextRun.getDay();
            const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7;
            nextRun.setDate(nextRun.getDate() + daysUntilTarget);
            break;
        
        case 'monthly':
            const targetDayOfMonth = schedule.dayOfMonth || 1;
            nextRun.setMonth(nextRun.getMonth() + 1);
            nextRun.setDate(Math.min(targetDayOfMonth, new Date(nextRun.getFullYear(), nextRun.getMonth() + 1, 0).getDate()));
            break;
        
        case 'quarterly':
            nextRun.setMonth(nextRun.getMonth() + 3);
            break;
        
        default:
            // Default to daily if frequency is not recognized
            nextRun.setDate(nextRun.getDate() + 1);
    }

    // Set the time
    if (schedule.time) {
        const [hours, minutes] = schedule.time.split(':').map(Number);
        nextRun.setHours(hours, minutes, 0, 0);
    } else {
        nextRun.setHours(9, 0, 0, 0); // Default to 9 AM
    }

    return admin.firestore.Timestamp.fromDate(nextRun);
}

/**
 * Send notification for scheduled report execution
 */
async function sendScheduledReportNotification(schedule, result, status, errorMessage = null) {
    try {
        const { sendNotificationEmail } = require('./email/sendgridService');

        const emailData = {
            reportName: schedule.reportConfig.name || schedule.reportConfig.type,
            reportType: schedule.reportConfig.type,
            scheduleId: schedule.id,
            executionTime: new Date().toISOString(),
            status,
            downloadUrl: result?.downloadUrl,
            errorMessage,
            nextRun: schedule.nextRun ? schedule.nextRun.toDate().toISOString() : null
        };

        // Send to each recipient
        for (const email of schedule.reportConfig.emailRecipients) {
            await sendNotificationEmail('scheduled_report_executed', schedule.companyId, {
                ...emailData,
                recipientEmail: email
            });
        }

        logger.info(`Sent scheduled report notifications to ${schedule.reportConfig.emailRecipients.length} recipients`);

    } catch (error) {
        logger.error('Error sending scheduled report notification:', error);
        // Don't throw error - report execution should still be considered successful
    }
}

/**
 * Get all scheduled reports for a company
 */
exports.getCompanyReportSchedules = onCall(async (request) => {
    try {
        const { companyId } = request.data;

        if (!companyId) {
            throw new HttpsError('invalid-argument', 'Company ID is required');
        }

        const schedulesSnapshot = await db.collection('reportSchedules')
            .where('companyId', '==', companyId)
            .orderBy('createdAt', 'desc')
            .get();

        const schedules = schedulesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            // Convert Firestore timestamps to ISO strings for client
            createdAt: doc.data().createdAt?.toDate()?.toISOString(),
            updatedAt: doc.data().updatedAt?.toDate()?.toISOString(),
            lastRun: doc.data().lastRun?.toDate()?.toISOString(),
            nextRun: doc.data().nextRun?.toDate()?.toISOString(),
            lastErrorAt: doc.data().lastErrorAt?.toDate()?.toISOString()
        }));

        return {
            success: true,
            schedules
        };

    } catch (error) {
        logger.error('Error getting company report schedules:', error);
        
        if (error instanceof HttpsError) {
            throw error;
        }
        
        throw new HttpsError('internal', `Failed to get report schedules: ${error.message}`);
    }
});

/**
 * Manually trigger a scheduled report
 */
exports.triggerScheduledReport = onCall(async (request) => {
    try {
        const { scheduleId, companyId } = request.data;

        if (!scheduleId || !companyId) {
            throw new HttpsError('invalid-argument', 'Schedule ID and company ID are required');
        }

        const scheduleDoc = await db.collection('reportSchedules').doc(scheduleId).get();
        if (!scheduleDoc.exists) {
            throw new HttpsError('not-found', 'Report schedule not found');
        }

        const schedule = { id: scheduleDoc.id, ...scheduleDoc.data() };

        // Verify company ownership
        if (schedule.companyId !== companyId) {
            throw new HttpsError('permission-denied', 'Access denied to this report schedule');
        }

        // Execute the report
        await executeScheduledReport(schedule);

        return {
            success: true,
            message: 'Report executed successfully'
        };

    } catch (error) {
        logger.error('Error triggering scheduled report:', error);
        
        if (error instanceof HttpsError) {
            throw error;
        }
        
        throw new HttpsError('internal', `Failed to trigger report: ${error.message}`);
    }
}); 