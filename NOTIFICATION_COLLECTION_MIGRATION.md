# Notification Subscription System - Collection-Based Migration

## Overview

The notification subscription system has been refactored from storing subscription data in company records to using a separate `notificationSubscriptions` Firestore collection. This new architecture is more scalable and avoids potential issues with large companies that have many employees.

## New System Architecture

### Collection Structure: `notificationSubscriptions`

```
notificationSubscriptions/{subscriptionId}
{
  userId: "user123",
  userEmail: "user@example.com", 
  companyId: "IC",
  notificationType: "shipment_created", // or "shipment_delivered", "status_changed", etc.
  subscribed: true,
  subscribedAt: timestamp,
  updatedAt: timestamp
}
```

### Document ID Format
Document IDs follow the pattern: `{userId}_{companyId}_{notificationType}`
Example: `abc123_IC_shipment_created`

## Benefits of New System

- ✅ **Scalable** - No document size limits, handles thousands of employees
- ✅ **Better concurrency** - No conflicts when multiple users update preferences
- ✅ **Separation of concerns** - Keeps company records clean and focused  
- ✅ **Flexible queries** - Easy to get subscriptions by user, company, or type
- ✅ **Analytics friendly** - Can track subscription patterns, dates, etc.
- ✅ **Easier cleanup** - Remove user's subscriptions when they leave company

## Migration Process

### Step 1: Run Migration for Each Company

Use the new cloud function to migrate existing data:

```javascript
// Call the migration function
const migrateToCollectionSystem = httpsCallable(functions, 'migrateToCollectionSystem');

const result = await migrateToCollectionSystem({
    companyId: 'IC' // Replace with actual company ID
});

console.log(`Migrated ${result.data.migratedCount} subscriptions`);
```

### Step 2: Verify Migration

Query the new collection to verify the migration worked:

```javascript
// Check migrated subscriptions
const subscriptionsRef = db.collection('notificationSubscriptions');
const snapshot = await subscriptionsRef
    .where('companyId', '==', 'IC')
    .get();

console.log(`Found ${snapshot.docs.length} subscription records`);
```

### Step 3: Test New System

The new system is already active. Test by:

1. Updating user notification preferences
2. Creating a new shipment
3. Verifying emails are sent correctly

## API Changes

### Functions Now Using Collection System

- `updateNotificationPreferences` - Uses `updateUserNotificationSubscriptionsV2`
- `getNotificationPreferences` - Uses `getUserCompanyNotificationStatusV2`  
- `sendNotificationEmail` - Uses `getCompanyNotificationSubscribersV2`

### New Cloud Functions

- `migrateToCollectionSystem` - Migrates company from old to new system

## Backward Compatibility

The old functions are maintained for backward compatibility:
- `getCompanyNotificationSubscribers` (legacy)
- `updateUserNotificationSubscriptions` (legacy)  
- `getUserCompanyNotificationStatus` (legacy)

## Querying Examples

### Get All Subscribers for a Notification Type

```javascript
const subscribers = await db.collection('notificationSubscriptions')
  .where('companyId', '==', 'IC')
  .where('notificationType', '==', 'shipment_created')
  .where('subscribed', '==', true)
  .get();

const emails = subscribers.docs.map(doc => doc.data().userEmail);
```

### Get User's Preferences for a Company

```javascript
const userPrefs = await db.collection('notificationSubscriptions')
  .where('userId', '==', 'user123')
  .where('companyId', '==', 'IC')
  .get();

const preferences = {};
userPrefs.docs.forEach(doc => {
    const data = doc.data();
    preferences[data.notificationType] = data.subscribed;
});
```

### Update User Subscription

```javascript
const subscriptionId = `${userId}_${companyId}_shipment_created`;
await db.collection('notificationSubscriptions').doc(subscriptionId).set({
    userId: userId,
    userEmail: userEmail,
    companyId: companyId,
    notificationType: 'shipment_created',
    subscribed: true,
    updatedAt: new Date()
}, { merge: true });
```

## Migration Steps for Each Company

1. **IC (Primary)** - Run migration first to test
2. **Other companies** - Run migration for each company ID
3. **Cleanup** - After confirming everything works, the old `notificationSubscriptions` field can be removed from company records

## Testing Checklist

- [ ] Migration completes without errors
- [ ] User can update notification preferences  
- [ ] Shipment creation emails are sent correctly
- [ ] Status change emails are sent correctly
- [ ] Multiple users in same company receive emails
- [ ] Unsubscribed users don't receive emails
- [ ] Hawkeye mode works correctly

## Rollback Plan

If issues arise, the system can be rolled back by:

1. Reverting the email service to use legacy functions
2. The old company record data is still intact
3. Re-deploy with legacy function calls

## Performance Impact

The new system should perform better because:
- Direct queries instead of scanning company documents
- No document size limitations
- Better indexing capabilities
- Reduced memory usage for large companies

## Security Rules

Ensure Firestore security rules allow appropriate access to the new collection:

```javascript
// Example security rule
match /notificationSubscriptions/{subscriptionId} {
  allow read, write: if request.auth != null 
    && request.auth.uid == resource.data.userId;
}
``` 