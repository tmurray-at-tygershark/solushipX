// Manual test to trigger onShipmentStatusChanged
// Run this in browser console to test the trigger

(async function testTrigger() {
    try {
        console.log('🧪 Testing Firestore trigger for onShipmentStatusChanged...');
        
        const user = firebase.auth().currentUser;
        if (!user) {
            console.error('❌ Must be logged in');
            return;
        }
        
        console.log(`👤 User: ${user.email}`);
        
        // Call updateManualShipmentStatus directly to test the trigger
        const updateFunction = firebase.functions().httpsCallable('updateManualShipmentStatus');
        
        // You'll need to replace this with an actual shipment ID from your system
        const testShipmentId = 'REPLACE_WITH_ACTUAL_SHIPMENT_ID';
        
        console.log(`🎯 Testing with shipment: ${testShipmentId}`);
        
        const result = await updateFunction({
            shipmentId: testShipmentId,
            newStatus: 'scheduled',  // Change to any valid status
            previousStatus: 'pending',
            reason: 'Testing email notifications trigger',
            timestamp: new Date().toISOString(),
            enhancedStatus: {
                test: true,
                timestamp: new Date().toISOString()
            }
        });
        
        console.log('✅ Manual status update result:', result.data);
        
        // Now check Firebase Functions logs
        console.log('📝 Check Firebase Functions logs for:');
        console.log('   - updateManualShipmentStatus execution');
        console.log('   - onShipmentStatusChanged trigger firing');
        console.log('   - Email notification attempts');
        
        // Wait a few seconds then check if notification emails were sent
        setTimeout(() => {
            console.log('⏰ Check your email and SendGrid activity feed');
            console.log('💡 If no emails were sent, the issue is likely:');
            console.log('   1. Global notifications disabled');
            console.log('   2. No users subscribed to notifications');
            console.log('   3. Firestore trigger not firing');
        }, 5000);
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
})(); 