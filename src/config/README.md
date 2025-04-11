# Firebase Admin Configuration

This directory contains configuration files for Firebase Admin SDK integration in the SolushipX application.

## Usage

### Environment Variables

The Firebase Admin SDK requires the following environment variables to be set in your `.env` file:

```
REACT_APP_FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=your-service-account-email
FIREBASE_PRIVATE_KEY="your-private-key"
```

Make sure to replace the placeholder values with your actual Firebase credentials.

### Initializing Firebase Admin

To initialize Firebase Admin in your application, import the `initializeFirebaseAdmin` function from `firebase-admin.js`:

```javascript
const initializeFirebaseAdmin = require('../config/firebase-admin');

// Initialize Firebase Admin
const admin = initializeFirebaseAdmin();
const db = admin.firestore();
```

### Example Usage

See `src/utils/firebase-admin-example.js` for examples of how to use Firebase Admin to interact with Firestore.

## Security Considerations

- Never commit your `.env` file to version control.
- Keep your Firebase Admin credentials secure.
- Use Firebase Admin only for server-side operations or in secure environments.

## Troubleshooting

If you encounter issues with Firebase Admin initialization, check the following:

1. Ensure your environment variables are correctly set.
2. Verify that your service account has the necessary permissions.
3. Check that your private key is correctly formatted (including newlines). 