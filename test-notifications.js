const { initializeApp } = require('firebase/app');
const { getFirestore, connectFirestoreEmulator } = require('firebase/firestore');
const { getFunctions, httpsCallable } = require('firebase/functions');

// Your Firebase config
const firebaseConfig = {
  // Use environment or copy from your app
  apiKey: "AIzaSyA9bX8XUwmJVL8I5J7ik6bOI7nAf5pK_No",
  authDomain: "solushipx.firebaseapp.com",
  projectId: "solushipx",
  storageBucket: "solushipx.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

async function testNotificationSystem() {
  try {
    console.log('Testing notification system...');
    
    // Test 1: Check if migrateToCollectionSystem function exists
    console.log('\n1. Testing migration function...');
    try {
      const migrateFunction = httpsCallable(functions, 'migrateToCollectionSystem');
      const migrationResult = await migrateFunction({ companyId: 'IC' });
      console.log('Migration result:', migrationResult.data);
    } catch (error) {
      console.log('Migration function error:', error.message);
    }
    
    // Test 2: Try to get current notification preferences
    console.log('\n2. Testing get notification preferences...');
    try {
      const getPreferences = httpsCallable(functions, 'getNotificationPreferences');
      const preferencesResult = await getPreferences({ 
        userId: 'TEST_USER_ID', // You'll need to replace this
        companyId: 'IC' 
      });
      console.log('Current preferences:', preferencesResult.data);
    } catch (error) {
      console.log('Get preferences error:', error.message);
    }
    
    // Test 3: Try to send a test notification
    console.log('\n3. Testing send notification...');
    try {
      const sendTest = httpsCallable(functions, 'sendTestNotification');
      const testResult = await sendTest({ 
        type: 'shipment_created',
        shipmentId: 'test_shipment_1'
      });
      console.log('Test notification result:', testResult.data);
    } catch (error) {
      console.log('Test notification error:', error.message);
    }
    
  } catch (error) {
    console.error('Error testing notification system:', error);
  }
}

// Helper function to setup notifications for a user
async function setupUserNotifications(userId, userEmail, companyId) {
  try {
    console.log(`\nSetting up notifications for user ${userEmail} in company ${companyId}...`);
    
    const updatePreferences = httpsCallable(functions, 'updateNotificationPreferences');
    const result = await updatePreferences({
      userId: userId,
      companyId: companyId,
      preferences: {
        shipment_created: true,
        shipment_delivered: true,
        shipment_delayed: true,
        status_changed: true,
        hawkeye_mode: false
      }
    });
    
    console.log('Notification setup result:', result.data);
    return result.data;
    
  } catch (error) {
    console.error('Error setting up notifications:', error.message);
    throw error;
  }
}

if (require.main === module) {
  testNotificationSystem().then(() => {
    console.log('\nTest completed!');
    process.exit(0);
  }).catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
  });
}

module.exports = { testNotificationSystem, setupUserNotifications }; 