const { onCall } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore } = require('firebase-admin/firestore');
const { areNotificationsEnabled } = require('./admin-system-settings');

const db = getFirestore();

/**
 * Urgent diagnostic function for QuickShip carrier confirmation email issues
 */
exports.quickShipEmailDiagnostic = onCall(async (request) => {
    try {
        const { shipmentId, carrierName } = request.data || {};
        
        logger.info('🚨 URGENT: QuickShip Email Diagnostic Started', {
            shipmentId,
            carrierName,
            userId: request.auth?.uid
        });

        const results = {
            timestamp: new Date().toISOString(),
            issues: [],
            fixes: [],
            shipmentId,
            carrierName
        };

        // TEST 1: Check global notifications
        logger.info('🔍 Testing global notification settings...');
        try {
            const globalEnabled = await areNotificationsEnabled();
            if (!globalEnabled) {
                results.issues.push({
                    severity: 'CRITICAL',
                    issue: 'Global notifications are DISABLED',
                    description: 'This blocks ALL system emails including QuickShip carrier confirmations',
                    fix: 'Go to /admin/configuration → System Settings → Turn ON "Email Notifications"'
                });
            } else {
                logger.info('✅ Global notifications are ENABLED');
            }
        } catch (error) {
            results.issues.push({
                severity: 'ERROR',
                issue: 'Cannot check global notification settings',
                description: error.message,
                fix: 'Check admin-system-settings cloud function'
            });
        }

        // TEST 2: Check carrier configuration if carrier name provided
        if (carrierName) {
            logger.info('🔍 Testing carrier email configuration...', { carrierName });
            try {
                // Check QuickShip carriers collection
                const carriersSnapshot = await db.collection('quickshipCarriers')
                    .where('name', '==', carrierName)
                    .limit(1)
                    .get();

                if (!carriersSnapshot.empty) {
                    const carrierDoc = carriersSnapshot.docs[0];
                    const carrierData = carrierDoc.data();
                    
                    let hasEmails = false;
                    let emailDetails = {};

                    // Check for legacy email structure
                    if (carrierData.contactEmail) {
                        hasEmails = true;
                        emailDetails.legacy = carrierData.contactEmail;
                        logger.info('✅ Found legacy carrier email:', carrierData.contactEmail);
                    }

                    // Check for new terminal-based structure
                    if (carrierData.emailContacts && Array.isArray(carrierData.emailContacts)) {
                        const terminalsWithEmails = carrierData.emailContacts.filter(terminal => {
                            const contactTypes = terminal.contactTypes || {};
                            return Object.values(contactTypes).some(emails => 
                                Array.isArray(emails) && emails.length > 0 && emails.some(email => email && email.trim())
                            );
                        });

                        if (terminalsWithEmails.length > 0) {
                            hasEmails = true;
                            emailDetails.terminals = terminalsWithEmails.map(terminal => ({
                                name: terminal.name,
                                id: terminal.id,
                                emailCount: Object.values(terminal.contactTypes || {}).flat().filter(email => email && email.trim()).length
                            }));
                            logger.info('✅ Found terminal-based carrier emails:', emailDetails.terminals);
                        }
                    }

                    if (!hasEmails) {
                        results.issues.push({
                            severity: 'CRITICAL',
                            issue: `Carrier "${carrierName}" has NO email addresses configured`,
                            description: 'Without carrier email, confirmation emails cannot be sent',
                            fix: `Go to Carriers management → Edit "${carrierName}" → Add contact email or terminal emails`
                        });
                    } else {
                        logger.info('✅ Carrier has email configuration:', emailDetails);
                    }
                } else {
                    results.issues.push({
                        severity: 'WARNING',
                        issue: `Carrier "${carrierName}" not found in quickshipCarriers collection`,
                        description: 'Carrier might be configured elsewhere or name mismatch',
                        fix: 'Check carrier name spelling or look in main carriers collection'
                    });
                }
            } catch (error) {
                results.issues.push({
                    severity: 'ERROR',
                    issue: 'Cannot check carrier configuration',
                    description: error.message,
                    fix: 'Check carrier database access'
                });
            }
        }

        // TEST 3: Check recent shipment if shipmentId provided
        if (shipmentId) {
            logger.info('🔍 Testing recent shipment data...', { shipmentId });
            try {
                const shipmentsSnapshot = await db.collection('shipments')
                    .where('shipmentID', '==', shipmentId)
                    .limit(1)
                    .get();

                if (!shipmentsSnapshot.empty) {
                    const shipmentDoc = shipmentsSnapshot.docs[0];
                    const shipmentData = shipmentDoc.data();
                    
                    // Check if email notifications were disabled for this shipment
                    if (shipmentData.skipEmailNotifications === true) {
                        results.issues.push({
                            severity: 'HIGH',
                            issue: 'Email notifications were disabled for this shipment',
                            description: 'The "Send Email Notifications" checkbox was unchecked in QuickShip form',
                            fix: 'Ensure "Send Email Notifications" is CHECKED when creating QuickShip shipments'
                        });
                    }

                    // Check carrier details
                    if (!shipmentData.quickShipCarrierDetails || !shipmentData.quickShipCarrierDetails.contactEmail) {
                        results.issues.push({
                            severity: 'HIGH',
                            issue: 'Shipment carrier details missing email',
                            description: 'Carrier email was not captured during QuickShip booking',
                            fix: 'Check carrier configuration and ensure email is properly set up'
                        });
                    }

                    logger.info('📊 Shipment analysis complete', {
                        hasCarrierDetails: !!shipmentData.quickShipCarrierDetails,
                        hasCarrierEmail: !!shipmentData.quickShipCarrierDetails?.contactEmail,
                        skipEmailNotifications: shipmentData.skipEmailNotifications,
                        creationMethod: shipmentData.creationMethod
                    });
                } else {
                    results.issues.push({
                        severity: 'WARNING',
                        issue: `Shipment "${shipmentId}" not found`,
                        description: 'Cannot analyze shipment-specific email settings',
                        fix: 'Check shipment ID spelling or look in drafts'
                    });
                }
            } catch (error) {
                results.issues.push({
                    severity: 'ERROR',
                    issue: 'Cannot check shipment data',
                    description: error.message,
                    fix: 'Check shipment database access'
                });
            }
        }

        // Generate summary and recommendations
        const criticalIssues = results.issues.filter(issue => issue.severity === 'CRITICAL');
        const highIssues = results.issues.filter(issue => issue.severity === 'HIGH');
        
        if (criticalIssues.length > 0) {
            results.summary = {
                status: 'CRITICAL_ISSUES_FOUND',
                message: `Found ${criticalIssues.length} critical issue(s) blocking emails`,
                priority: 'FIX_IMMEDIATELY',
                topIssue: criticalIssues[0]
            };
        } else if (highIssues.length > 0) {
            results.summary = {
                status: 'HIGH_PRIORITY_ISSUES',
                message: `Found ${highIssues.length} high priority issue(s)`,
                priority: 'FIX_SOON',
                topIssue: highIssues[0]
            };
        } else if (results.issues.length > 0) {
            results.summary = {
                status: 'MINOR_ISSUES',
                message: 'Found minor issues that might affect email delivery',
                priority: 'MONITOR',
                topIssue: results.issues[0]
            };
        } else {
            results.summary = {
                status: 'ALL_SYSTEMS_OK',
                message: 'No obvious issues found with email configuration',
                priority: 'CHECK_LOGS',
                recommendation: 'Check Firebase Functions logs for specific error details'
            };
        }

        logger.info('🚨 QuickShip Email Diagnostic Complete', {
            status: results.summary.status,
            issueCount: results.issues.length,
            criticalCount: criticalIssues.length,
            highCount: highIssues.length
        });

        return {
            success: true,
            diagnostic: results
        };

    } catch (error) {
        logger.error('🚨 Diagnostic function failed:', error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}); 