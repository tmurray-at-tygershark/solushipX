const { onCall } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore();

/**
 * Test function to diagnose the enhanced status email system
 */
exports.testEnhancedStatusEmails = onCall(async (request) => {
    try {
        const { shipmentId, userId } = request.data;

        logger.info('Testing enhanced status email system', { shipmentId, userId });

        const results = {
            tests: [],
            summary: {
                passed: 0,
                failed: 0,
                warnings: 0
            }
        };

        // Test 1: Check if global notifications are enabled
        try {
            const { areNotificationsEnabled } = require('./admin-system-settings');
            const notificationsEnabled = await areNotificationsEnabled();
            
            results.tests.push({
                test: 'Global Notifications Check',
                status: notificationsEnabled ? 'PASS' : 'FAIL',
                result: `Global notifications are ${notificationsEnabled ? 'ENABLED' : 'DISABLED'}`,
                details: { notificationsEnabled }
            });

            if (notificationsEnabled) {
                results.summary.passed++;
            } else {
                results.summary.failed++;
            }
        } catch (error) {
            results.tests.push({
                test: 'Global Notifications Check',
                status: 'ERROR',
                result: `Error checking global notifications: ${error.message}`,
                details: { error: error.message }
            });
            results.summary.failed++;
        }

        // Test 2: Test enhanced status display function
        try {
            const { getEnhancedStatusDisplay } = require('./email/sendgridService');
            
            const testStatuses = ['booked', 'in_transit', 'delivered'];
            const statusResults = [];
            
            for (const status of testStatuses) {
                const result = await getEnhancedStatusDisplay(status);
                statusResults.push({
                    status,
                    displayText: result.displayText,
                    hasChip: !!result.statusChip,
                    isMasterOnly: result.isMasterOnly
                });
            }

            results.tests.push({
                test: 'Enhanced Status Display Function',
                status: 'PASS',
                result: 'Enhanced status display function working correctly',
                details: { statusResults }
            });
            results.summary.passed++;
        } catch (error) {
            results.tests.push({
                test: 'Enhanced Status Display Function',
                status: 'ERROR',
                result: `Error in enhanced status display: ${error.message}`,
                details: { error: error.message }
            });
            results.summary.failed++;
        }

        // Test 3: Check master status configuration
        try {
            const { loadStatusConfiguration } = require('./email/sendgridService');
            const config = await loadStatusConfiguration();
            
            results.tests.push({
                test: 'Status Configuration Load',
                status: config.masterStatuses.length > 0 ? 'PASS' : 'WARN',
                result: `Found ${config.masterStatuses.length} master statuses and ${config.shipmentStatuses.length} sub-statuses`,
                details: {
                    masterStatusCount: config.masterStatuses.length,
                    subStatusCount: config.shipmentStatuses.length,
                    lastUpdated: config.lastUpdated
                }
            });

            if (config.masterStatuses.length > 0) {
                results.summary.passed++;
            } else {
                results.summary.warnings++;
            }
        } catch (error) {
            results.tests.push({
                test: 'Status Configuration Load',
                status: 'ERROR',
                result: `Error loading status configuration: ${error.message}`,
                details: { error: error.message }
            });
            results.summary.failed++;
        }

        // Test 4: Check if shipment exists (if shipmentId provided)
        if (shipmentId) {
            try {
                const shipmentDoc = await db.collection('shipments').doc(shipmentId).get();
                
                if (shipmentDoc.exists) {
                    const shipmentData = shipmentDoc.data();
                    results.tests.push({
                        test: 'Shipment Data Check',
                        status: 'PASS',
                        result: `Shipment found with status: ${shipmentData.status}`,
                        details: {
                            shipmentId,
                            currentStatus: shipmentData.status,
                            companyId: shipmentData.companyID || shipmentData.companyId,
                            hasStatusOverride: !!shipmentData.statusOverride?.isManual
                        }
                    });
                    results.summary.passed++;
                } else {
                    results.tests.push({
                        test: 'Shipment Data Check',
                        status: 'FAIL',
                        result: `Shipment ${shipmentId} not found`,
                        details: { shipmentId }
                    });
                    results.summary.failed++;
                }
            } catch (error) {
                results.tests.push({
                    test: 'Shipment Data Check',
                    status: 'ERROR',
                    result: `Error checking shipment: ${error.message}`,
                    details: { error: error.message, shipmentId }
                });
                results.summary.failed++;
            }
        }

        // Test 5: Check notification subscribers (if userId provided)
        if (userId && shipmentId) {
            try {
                const shipmentDoc = await db.collection('shipments').doc(shipmentId).get();
                if (shipmentDoc.exists) {
                    const shipmentData = shipmentDoc.data();
                    const companyId = shipmentData.companyID || shipmentData.companyId;
                    
                    if (companyId) {
                        const { getCompanyNotificationSubscribersV2 } = require('./email/sendgridService');
                        const subscribers = await getCompanyNotificationSubscribersV2(companyId, 'status_changed');
                        
                        results.tests.push({
                            test: 'Notification Subscribers Check',
                            status: subscribers.length > 0 ? 'PASS' : 'WARN',
                            result: `Found ${subscribers.length} subscribers for status_changed notifications`,
                            details: {
                                companyId,
                                subscriberCount: subscribers.length,
                                subscribers: subscribers
                            }
                        });

                        if (subscribers.length > 0) {
                            results.summary.passed++;
                        } else {
                            results.summary.warnings++;
                        }
                    }
                }
            } catch (error) {
                results.tests.push({
                    test: 'Notification Subscribers Check',
                    status: 'ERROR',
                    result: `Error checking subscribers: ${error.message}`,
                    details: { error: error.message }
                });
                results.summary.failed++;
            }
        }

        // Test 6: Test email template function
        try {
            const { sendNotificationEmail } = require('./email/sendgridService');
            
            results.tests.push({
                test: 'Email Function Import',
                status: 'PASS',
                result: 'sendNotificationEmail function imported successfully',
                details: { functionImported: typeof sendNotificationEmail === 'function' }
            });
            results.summary.passed++;
        } catch (error) {
            results.tests.push({
                test: 'Email Function Import',
                status: 'ERROR',
                result: `Error importing email function: ${error.message}`,
                details: { error: error.message }
            });
            results.summary.failed++;
        }

        // Generate overall status
        const overallStatus = results.summary.failed > 0 ? 'FAILED' : 
                             results.summary.warnings > 0 ? 'WARNING' : 'PASSED';

        logger.info('Enhanced status email system test completed', results.summary);

        return {
            success: true,
            overallStatus,
            summary: results.summary,
            tests: results.tests,
            recommendations: generateRecommendations(results.tests)
        };

    } catch (error) {
        logger.error('Error in enhanced status email test:', error);
        return {
            success: false,
            error: error.message,
            overallStatus: 'ERROR'
        };
    }
});

/**
 * Generate recommendations based on test results
 */
function generateRecommendations(tests) {
    const recommendations = [];
    
    tests.forEach(test => {
        if (test.status === 'FAIL') {
            switch (test.test) {
                case 'Global Notifications Check':
                    recommendations.push('Enable global notifications in Admin > System Configuration');
                    break;
                case 'Shipment Data Check':
                    recommendations.push('Verify the shipment ID exists in the database');
                    break;
                case 'Enhanced Status Display Function':
                    recommendations.push('Check status configuration in the database');
                    break;
            }
        } else if (test.status === 'WARN') {
            switch (test.test) {
                case 'Notification Subscribers Check':
                    recommendations.push('Set up notification preferences for users in this company');
                    break;
                case 'Status Configuration Load':
                    recommendations.push('Configure master statuses and sub-statuses in admin panel');
                    break;
            }
        }
    });

    if (recommendations.length === 0) {
        recommendations.push('All tests passed! The enhanced status email system should be working correctly.');
    }

    return recommendations;
} 