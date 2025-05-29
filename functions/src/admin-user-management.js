const functions = require('firebase-functions/v2');
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');

// Firebase Admin is already initialized in index.js with correct bucket configuration

const db = admin.firestore();

/**
 * Checks if a given user ID is listed as an ownerID in any company.
 */
exports.checkUserCompanyOwnership = onCall(async (request) => {
    console.log('checkUserCompanyOwnership called. Auth:', request.auth, 'Data:', request.data);

    if (!request.auth) {
        console.error('checkUserCompanyOwnership: Authentication failed. No auth context.');
        throw new HttpsError('unauthenticated', 'The function must be called by an authenticated user.');
    }

    const callingUserUid = request.auth.uid;
    const { userIdToCheck } = request.data;

    if (!userIdToCheck) {
        console.error('checkUserCompanyOwnership: Missing userIdToCheck in data.');
        throw new HttpsError('invalid-argument', 'Missing userIdToCheck.');
    }

    try {
        // First, verify the calling user is an admin to even allow this check
        const adminUserDocRef = db.collection('users').doc(callingUserUid);
        const adminUserDoc = await adminUserDocRef.get();
        if (!adminUserDoc.exists || !["admin", "super_admin"].includes(adminUserDoc.data().role)) {
            console.error(`checkUserCompanyOwnership: Caller ${callingUserUid} is not an admin.`);
            throw new HttpsError('permission-denied', 'You do not have privileges to perform this check.');
        }

        console.log(`Admin user ${callingUserUid} checking ownership for user ${userIdToCheck}`);

        const companiesRef = db.collection('companies');
        const snapshot = await companiesRef.where('ownerID', '==', userIdToCheck).limit(1).get();

        if (!snapshot.empty) {
            console.log(`User ${userIdToCheck} IS an owner of at least one company.`);
            return { isOwner: true, companyId: snapshot.docs[0].id, companyName: snapshot.docs[0].data().name };
        }

        console.log(`User ${userIdToCheck} is NOT an owner of any company.`);
        return { isOwner: false };

    } catch (error) {
        console.error(`Error in checkUserCompanyOwnership for user ${userIdToCheck} by admin ${callingUserUid}:`, error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', `An unexpected error occurred: ${error.message}`);
    }
});

/**
 * Deletes a user from Firebase Auth and Firestore by an admin.
 * Requires the calling user to have an 'admin' or 'super_admin' role.
 * IMPORTANT: This function should ideally be called AFTER checkUserCompanyOwnership confirms the user is not an owner.
 */
exports.adminDeleteUser = onCall(async (request) => {
    console.log('adminDeleteUser called. Auth:', request.auth, 'Data:', request.data);

    if (!request.auth) {
        console.error('adminDeleteUser: Authentication failed. No auth context.');
        throw new HttpsError('unauthenticated', 'The function must be called by an authenticated user.');
    }

    const callingUserUid = request.auth.uid;
    const { userIdToDelete } = request.data;

    if (!userIdToDelete) {
        console.error('adminDeleteUser: Missing userIdToDelete in data.');
        throw new HttpsError('invalid-argument', 'userIdToDelete is required.');
    }

    if (callingUserUid === userIdToDelete) {
        console.error('adminDeleteUser: Admins cannot delete themselves using this function.');
        throw new HttpsError('permission-denied', 'Admins cannot delete their own accounts through this function.');
    }

    try {
        // Verify calling user's admin role
        const adminUserDocRef = db.collection('users').doc(callingUserUid);
        const adminUserDoc = await adminUserDocRef.get();

        if (!adminUserDoc.exists) {
            console.error(`adminDeleteUser: Admin user document ${callingUserUid} not found.`);
            throw new HttpsError('permission-denied', 'Your user profile was not found.');
        }
        const adminUserData = adminUserDoc.data();
        const allowedAdminRoles = ["admin", "super_admin"];
        if (!allowedAdminRoles.includes(adminUserData.role)) {
            console.error(`adminDeleteUser: User ${callingUserUid} (role: ${adminUserData.role}) does not have admin privileges.`);
            throw new HttpsError('permission-denied', 'You do not have sufficient privileges to perform this action.');
        }

        console.log(`Admin user ${callingUserUid} (role: ${adminUserData.role}) attempting to delete user ${userIdToDelete}`);

        // 1. Delete from Firebase Authentication
        await admin.auth().deleteUser(userIdToDelete);
        console.log(`Successfully deleted user ${userIdToDelete} from Firebase Authentication.`);

        // 2. Delete from Firestore 'users' collection
        const userDocRef = db.collection('users').doc(userIdToDelete);
        await userDocRef.delete();
        console.log(`Successfully deleted user document for ${userIdToDelete} from Firestore.`);

        // Optionally: Add logic here to clean up other user-related data if necessary

        return { status: 'success', message: `User ${userIdToDelete} has been deleted successfully.` };

    } catch (error) {
        console.error(`Error in adminDeleteUser for target UID ${userIdToDelete} by admin ${callingUserUid}:`, error);
        if (error instanceof HttpsError) {
            throw error; 
        }
        if (error.code === 'auth/user-not-found') {
            // If user is not in Auth, but we still want to clean up Firestore if exists
            try {
                const userDocRef = db.collection('users').doc(userIdToDelete);
                const doc = await userDocRef.get();
                if (doc.exists) {
                    await userDocRef.delete();
                    console.log(`Cleaned up Firestore document for user ${userIdToDelete} not found in Auth.`);
                    return { status: 'success', message: 'User already deleted from Auth, Firestore record cleaned up.' };
                }
                return { status: 'warning', message: 'User not found in Auth or Firestore.' }; 
            } catch (cleanupError) {
                 console.error(`Error cleaning up Firestore for user ${userIdToDelete} not in Auth:`, cleanupError);
                 throw new HttpsError('internal', 'Error during Firestore cleanup for non-existent Auth user.');
            }
        }
        throw new HttpsError('internal', `An unexpected error occurred while deleting user: ${error.message}`);
    }
});

/**
 * Resets a user's password by an admin.
 * Requires the calling user to have an 'admin' or 'super_admin' role.
 */
exports.adminResetUserPassword = onCall(async (request) => {
    console.log('adminResetUserPassword called. Auth:', request.auth, 'Data:', request.data);

    if (!request.auth) {
        console.error('adminResetUserPassword: Authentication failed. No auth context.');
        throw new HttpsError('unauthenticated', 'The function must be called by an authenticated user.');
    }

    const callingUserUid = request.auth.uid;
    const { uid: targetUserUid, newPassword } = request.data;

    if (!targetUserUid || !newPassword) {
        console.error('adminResetUserPassword: Missing targetUserUid or newPassword in data.');
        throw new HttpsError('invalid-argument', 'Missing targetUserUid or newPassword.');
    }

    if (newPassword.length < 6) {
        console.error('adminResetUserPassword: Password too short.');
        throw new HttpsError('invalid-argument', 'Password must be at least 6 characters long.');
    }

    try {
        // Verify calling user's admin role
        const adminUserDocRef = db.collection('users').doc(callingUserUid);
        const adminUserDoc = await adminUserDocRef.get();

        if (!adminUserDoc.exists) {
            console.error(`adminResetUserPassword: Admin user document ${callingUserUid} not found.`);
            throw new HttpsError('permission-denied', 'Your user profile was not found.');
        }

        const adminUserData = adminUserDoc.data();
        const allowedAdminRoles = ["admin", "super_admin"];
        if (!allowedAdminRoles.includes(adminUserData.role)) {
            console.error(`adminResetUserPassword: User ${callingUserUid} (role: ${adminUserData.role}) does not have admin privileges.`);
            throw new HttpsError('permission-denied', 'You do not have sufficient privileges to perform this action.');
        }

        console.log(`Admin user ${callingUserUid} (role: ${adminUserData.role}) attempting to reset password for user ${targetUserUid}`);

        // Update the target user's password
        await admin.auth().updateUser(targetUserUid, {
            password: newPassword,
        });

        console.log(`Successfully reset password for user ${targetUserUid}`);
        return { status: 'success', message: 'Password has been reset successfully.' };

    } catch (error) {
        console.error(`Error in adminResetUserPassword for target UID ${targetUserUid} by admin ${callingUserUid}:`, error);
        if (error instanceof HttpsError) {
            throw error; // Re-throw HttpsError directly
        }
        // Convert other errors to HttpsError
        throw new HttpsError('internal', `An unexpected error occurred: ${error.message}`);
    }
});

/**
 * Retrieves Firebase Authentication data (email, lastLogin) for a list of UIDs.
 * Requires the calling user to have an 'admin' or 'super_admin' role.
 */
exports.adminGetUsersAuthData = onCall(async (request) => {
    console.log('adminGetUsersAuthData called. Auth:', request.auth, 'Data:', request.data);

    if (!request.auth) {
        console.error('adminGetUsersAuthData: Authentication failed. No auth context.');
        throw new HttpsError('unauthenticated', 'The function must be called by an authenticated user.');
    }

    const callingUserUid = request.auth.uid;
    const { uids } = request.data;

    if (!uids || !Array.isArray(uids) || uids.length === 0) {
        console.error('adminGetUsersAuthData: Missing or invalid uids array in data.');
        throw new HttpsError('invalid-argument', 'UIDs array is required.');
    }
    if (uids.length > 100) { // Firebase admin.auth().getUsers() limit
        console.error('adminGetUsersAuthData: Too many UIDs requested. Max 100.');
        throw new HttpsError('invalid-argument', 'Cannot fetch more than 100 users at a time.');
    }

    try {
        // Verify calling user's admin role
        const adminUserDocRef = db.collection('users').doc(callingUserUid);
        const adminUserDoc = await adminUserDocRef.get();
        if (!adminUserDoc.exists || !["admin", "super_admin"].includes(adminUserDoc.data().role)) {
            console.error(`adminGetUsersAuthData: Caller ${callingUserUid} is not an admin.`);
            throw new HttpsError('permission-denied', 'You do not have privileges to perform this action.');
        }

        console.log(`Admin user ${callingUserUid} fetching auth data for UIDs:`, uids);

        const userIdentifiers = uids.map(uid => ({ uid }));
        const getAssignableUsersResult = await admin.auth().getUsers(userIdentifiers);
        
        const usersAuthMap = {};
        getAssignableUsersResult.users.forEach(userRecord => {
            usersAuthMap[userRecord.uid] = {
                email: userRecord.email,
                emailVerified: userRecord.emailVerified,
                displayName: userRecord.displayName,
                photoURL: userRecord.photoURL,
                disabled: userRecord.disabled,
                lastSignInTime: userRecord.metadata.lastSignInTime, // Correct property for last login
                creationTime: userRecord.metadata.creationTime,
            };
        });
        
        getAssignableUsersResult.notFound.forEach(notFoundIdentifier => {
            console.warn(`UID not found in Firebase Auth: ${notFoundIdentifier.uid}`);
            // Optionally include in map with null/default values if needed by frontend
            // usersAuthMap[notFoundIdentifier.uid] = { email: null, lastSignInTime: null }; 
        });

        return { usersAuthMap };

    } catch (error) {
        console.error(`Error in adminGetUsersAuthData for UIDs by admin ${callingUserUid}:`, error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', `An unexpected error occurred: ${error.message}`);
    }
}); 