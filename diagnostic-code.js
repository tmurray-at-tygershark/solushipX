// EMAIL NOTIFICATION DIAGNOSTIC SCRIPT
// Run this in your browser console while logged into SolushipX

(async function diagnoseEmailNotifications() {
    try {
        console.log('🔍 Starting Email Notification Diagnostic...\n');
        
        // Get Firebase Functions and Auth
        const { getFunctions, httpsCallable } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js');
        const { getAuth } = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js');
        
        // Get the functions and auth instances from the global app
        const functions = getFunctions(window.firebase?.app || window.app);
        const auth = getAuth(window.firebase?.app || window.app);
        const user = auth.currentUser;
        
        if (!user) {
            console.error('❌ User not authenticated. Please log in first.');
            return;
        }
        
        console.log(`👤 Running diagnostic for user: ${user.email}`);
        console.log(`🆔 User ID: ${user.uid}\n`);
        
        // Call the diagnostic function
        const quickDiagnosticEmailTest = httpsCallable(functions, 'quickDiagnosticEmailTest');
        const result = await quickDiagnosticEmailTest({ 
            userEmail: user.email,
            userId: user.uid 
        });
        
        console.log('📊 DIAGNOSTIC RESULTS:\n');
        console.log('='.repeat(50));
        
        const data = result.data;
        
        // Global Settings Check
        console.log('🌐 GLOBAL NOTIFICATION SETTINGS:');
        console.log(`   Enabled: ${data.globalEnabled ? '✅ YES' : '❌ NO'}`);
        console.log(`   Settings Doc Exists: ${data.globalSettingsExist ? '✅ YES' : '❌ NO'}`);
        
        if (!data.globalEnabled) {
            console.log('   ⚠️  ISSUE: Global notifications are DISABLED');
            console.log('   💡 FIX: Enable notifications in Admin > System Configuration');
        }
        console.log('');
        
        // User Subscription Check
        console.log('👤 USER SUBSCRIPTION SETTINGS:');
        console.log(`   Status Change Notifications: ${data.userSubscribed ? '✅ SUBSCRIBED' : '❌ NOT SUBSCRIBED'}`);
        console.log(`   Subscription Doc Exists: ${data.subscriptionExists ? '✅ YES' : '❌ NO'}`);
        
        if (!data.userSubscribed) {
            console.log('   ⚠️  ISSUE: User not subscribed to status_changed notifications');
            console.log('   💡 FIX: User needs to be added to notification subscription system');
        }
        console.log('');
        
        // Overall System Health
        console.log('🏥 SYSTEM HEALTH:');
        console.log(`   Overall Status: ${data.systemHealthy ? '✅ HEALTHY' : '❌ ISSUES DETECTED'}`);
        
        if (data.errors && data.errors.length > 0) {
            console.log('   🚨 ERRORS DETECTED:');
            data.errors.forEach(error => console.log(`      • ${error}`));
        }
        console.log('');
        
        // Recommendations
        console.log('💡 RECOMMENDATIONS:');
        if (!data.globalEnabled) {
            console.log('   1. Go to Admin > System Configuration');
            console.log('   2. Enable "Send Email Notifications" toggle');
            console.log('   3. Save settings');
        }
        
        if (!data.userSubscribed) {
            console.log('   4. User needs to be added to notification subscription system');
            console.log('   5. This may require admin intervention');
        }
        
        if (data.systemHealthy && data.globalEnabled && data.userSubscribed) {
            console.log('   ✅ All systems appear healthy!');
            console.log('   🔍 Try triggering a manual status change to test notifications');
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('📋 Raw diagnostic data:', data);
        
    } catch (error) {
        console.error('❌ Diagnostic failed:', error);
        console.log('\n🔧 Alternative check - Run this in console:');
        console.log('firebase.firestore().doc("systemSettings/global").get().then(doc => console.log("Global settings:", doc.exists() ? doc.data() : "No global settings found"));');
    }
})(); 