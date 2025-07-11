const { onCall } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { getFirestore } = require('firebase-admin/firestore');
const { areNotificationsEnabled } = require('./admin-system-settings');

const db = getFirestore();

/**
 * Quick diagnostic test for email notification issues
 */
exports.quickDiagnosticEmailTest = onCall(async (request) => {
    try {
        const { companyId = 'IC' } = request.data || {};
        const userId = request.auth?.uid;
        
        const results = [];
        
        // Test 1: Check global notifications
        try {
            const globalEnabled = await areNotificationsEnabled();
            results.push({
                test: '🌐 Global Notifications',
                status: globalEnabled ? '✅ ENABLED' : '❌ DISABLED',
                issue: globalEnabled ? null : 'Global notifications are turned off - this blocks ALL emails',
                fix: globalEnabled ? null : 'Go to /admin/configuration and turn on Master Notification Switch'
            });
        } catch (error) {
            results.push({
                test: '🌐 Global Notifications', 
                status: '⚠️ ERROR',
                issue: `Cannot check global settings: ${error.message}`,
                fix: 'Check admin-system-settings function'
            });
        }
        
        // Test 2: Check user subscription to status_changed
        if (userId) {
            try {
                const subscriptionDoc = await db.collection('notificationSubscriptions')
                    .doc(`${userId}_${companyId}_status_changed`)
                    .get();
                    
                const isSubscribed = subscriptionDoc.exists && subscriptionDoc.data()?.subscribed === true;
                results.push({
                    test: '📧 User Status Change Subscription',
                    status: isSubscribed ? '✅ SUBSCRIBED' : '❌ NOT SUBSCRIBED',
                    issue: isSubscribed ? null : 'You are not subscribed to status change notifications',
                    fix: isSubscribed ? null : 'Go to /notifications and enable "Status Changes"',
                    details: {
                        docExists: subscriptionDoc.exists,
                        subscribed: subscriptionDoc.exists ? subscriptionDoc.data()?.subscribed : null,
                        docId: `${userId}_${companyId}_status_changed`
                    }
                });
            } catch (error) {
                results.push({
                    test: '📧 User Status Change Subscription',
                    status: '⚠️ ERROR', 
                    issue: `Cannot check subscription: ${error.message}`,
                    fix: 'Check notificationSubscriptions collection'
                });
            }
            
            // Test 3: Check if user has ANY subscriptions
            try {
                const allSubscriptions = await db.collection('notificationSubscriptions')
                    .where('userId', '==', userId)
                    .where('companyId', '==', companyId)
                    .get();
                    
                const subscriptionCount = allSubscriptions.size;
                const activeSubscriptions = allSubscriptions.docs.filter(doc => doc.data().subscribed === true).length;
                
                results.push({
                    test: '📋 All User Subscriptions',
                    status: subscriptionCount > 0 ? '✅ FOUND' : '❌ NONE',
                    issue: subscriptionCount === 0 ? 'User has no notification subscriptions at all' : null,
                    fix: subscriptionCount === 0 ? 'Run migration or set up preferences manually' : null,
                    details: {
                        totalSubscriptions: subscriptionCount,
                        activeSubscriptions: activeSubscriptions,
                        userId: userId,
                        companyId: companyId
                    }
                });
            } catch (error) {
                results.push({
                    test: '📋 All User Subscriptions',
                    status: '⚠️ ERROR',
                    issue: `Cannot check subscriptions: ${error.message}`,
                    fix: 'Check notificationSubscriptions collection'
                });
            }
        } else {
            results.push({
                test: '👤 User Authentication',
                status: '❌ NOT AUTHENTICATED',
                issue: 'Cannot check user subscriptions without authentication',
                fix: 'Call this function while logged in'
            });
        }
        
        // Test 4: Check system settings document
        try {
            const settingsDoc = await db.collection('systemSettings').doc('global').get();
            const settingsExist = settingsDoc.exists;
            const settings = settingsExist ? settingsDoc.data() : null;
            
            results.push({
                test: '⚙️ System Settings Document',
                status: settingsExist ? '✅ EXISTS' : '⚠️ MISSING',
                issue: settingsExist ? null : 'systemSettings/global document does not exist',
                fix: settingsExist ? null : 'Create systemSettings/global document with notificationsEnabled: true',
                details: {
                    exists: settingsExist,
                    notificationsEnabled: settings?.notificationsEnabled,
                    settings: settings
                }
            });
        } catch (error) {
            results.push({
                test: '⚙️ System Settings Document',
                status: '⚠️ ERROR',
                issue: `Cannot check system settings: ${error.message}`,
                fix: 'Check Firestore access permissions'
            });
        }
        
        // Summary
        const passing = results.filter(r => r.status.includes('✅')).length;
        const failing = results.filter(r => r.status.includes('❌')).length;
        const warnings = results.filter(r => r.status.includes('⚠️')).length;
        
        const summary = {
            total: results.length,
            passing: passing,
            failing: failing,
            warnings: warnings,
            diagnosis: failing > 0 ? 'ISSUES FOUND' : warnings > 0 ? 'WARNINGS' : 'ALL GOOD'
        };
        
        logger.info('Email notification diagnostic completed', {
            userId: userId,
            companyId: companyId,
            summary: summary
        });
        
        return {
            success: true,
            summary: summary,
            tests: results,
            timestamp: new Date().toISOString(),
            userId: userId,
            companyId: companyId
        };
        
    } catch (error) {
        logger.error('Error in quickDiagnosticEmailTest:', error);
        return {
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}); 