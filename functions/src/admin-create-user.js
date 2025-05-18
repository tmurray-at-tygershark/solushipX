const functions = require('firebase-functions/v2');
const { onCall } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');

// Use the onCall pattern that's working with other functions
exports.adminCreateUser = onCall({
  cors: true,
  timeoutSeconds: 60,
}, async (request) => {
  try {
    const data = request.data;
    const auth = request.auth;
    
    console.log('adminCreateUser called with request:', {
      auth: auth ? JSON.stringify(auth) : 'No auth',
      data: data
    });
    
    // Temporarily bypass admin checks for debugging
    // We'll just check that the user is authenticated
    if (!auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'The function must be called by an authenticated user.'
      );
    }

    console.log(`User is authenticated with UID: ${auth.uid}`);
    
    // Validate required fields (simplified)
    const { email, password, firstName, lastName, role, status, phone, companies } = data;
    if (!email || !password || !firstName || !lastName) {
      throw new functions.https.HttpsError('invalid-argument', 'Missing required fields.');
    }

    // Check if email already exists in Auth
    try {
      await admin.auth().getUserByEmail(email);
      throw new functions.https.HttpsError('already-exists', 'This email address is already registered.');
    } catch (error) {
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
      // User not found is what we want - continue
    }

    // Create the new user in Auth
    const userRecord = await admin.auth().createUser({
      email: email,
      password: password,
      displayName: `${firstName} ${lastName}`,
    });
    const newUserId = userRecord.uid;
    console.log(`Created new user in Auth with UID: ${newUserId}`);

    // Create the user document in Firestore
    const db = admin.firestore(); // This should use the default initialized DB
    
    const newUserDocRef = db.collection("users").doc(newUserId);
    const newUserFirestoreData = {
      firstName,
      lastName,
      email,
      role: role || 'user',
      status: status || 'active',
      phone: phone || '',
      connectedCompanies: { companies: companies || [] },
      authUID: newUserId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      lastLogin: null,
    };
    
    await newUserDocRef.set(newUserFirestoreData);
    console.log(`Created Firestore document for user: ${newUserId}`);

    return {
      status: "success",
      uid: newUserId,
      message: "User created successfully.",
    };
  } catch (error) {
    console.error('Error in adminCreateUser:', error);
    throw error;
  }
}); 