const functions = require('firebase-functions/v2');
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');

// Firebase Admin is already initialized in index.js with correct bucket configuration

const db = admin.firestore();

/**
 * Checks if a given user ID is listed as an ownerID in any company.
 */
exports.checkUserCompanyOwnership = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
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
        if (!adminUserDoc.exists || !["admin", "superadmin"].includes(adminUserDoc.data().role)) {
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
exports.adminDeleteUser = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
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
        const allowedAdminRoles = ["admin", "superadmin"];
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
exports.adminResetUserPassword = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
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
        const allowedAdminRoles = ["admin", "superadmin"];
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
exports.adminGetUsersAuthData = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
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
        if (!adminUserDoc.exists || !["admin", "superadmin"].includes(adminUserDoc.data().role)) {
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

/**
 * Lists all users from Firebase Auth and merges with Firestore user data.
 * This ensures we see all users, even those without Firestore documents.
 * Requires the calling user to have an 'admin' or 'super_admin' role.
 */
exports.adminListAllUsers = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    console.log('adminListAllUsers called. Auth:', request.auth, 'Data:', request.data);

    if (!request.auth) {
        console.error('adminListAllUsers: Authentication failed. No auth context.');
        throw new HttpsError('unauthenticated', 'The function must be called by an authenticated user.');
    }

    const callingUserUid = request.auth.uid;
    const { maxResults = 1000, pageToken } = request.data || {};

    try {
        // Verify calling user's admin role
        const adminUserDocRef = db.collection('users').doc(callingUserUid);
        const adminUserDoc = await adminUserDocRef.get();
        if (!adminUserDoc.exists || !["admin", "superadmin"].includes(adminUserDoc.data().role)) {
            console.error(`adminListAllUsers: Caller ${callingUserUid} is not an admin.`);
            throw new HttpsError('permission-denied', 'You do not have privileges to perform this action.');
        }

        console.log(`Admin user ${callingUserUid} listing all users`);

        // Get all users from Firebase Auth
        const listUsersResult = await admin.auth().listUsers(maxResults, pageToken);
        
        // Get all user documents from Firestore
        const usersSnapshot = await db.collection('users').get();
        const firestoreUsers = {};
        usersSnapshot.forEach(doc => {
            firestoreUsers[doc.id] = doc.data();
        });

        // Merge Auth and Firestore data
        const mergedUsers = listUsersResult.users.map(authUser => {
            const firestoreData = firestoreUsers[authUser.uid] || {};
            
            return {
                id: authUser.uid,
                // Auth data
                email: authUser.email,
                emailVerified: authUser.emailVerified,
                displayName: authUser.displayName,
                photoURL: authUser.photoURL,
                disabled: authUser.disabled,
                lastSignInTime: authUser.metadata.lastSignInTime,
                creationTime: authUser.metadata.creationTime,
                
                // Firestore data (with defaults if not present)
                firstName: firestoreData.firstName || '',
                lastName: firestoreData.lastName || '',
                role: firestoreData.role || 'user',
                status: firestoreData.status || 'active',
                phone: firestoreData.phone || '',
                connectedCompanies: firestoreData.connectedCompanies || { companies: [] },
                
                // Metadata
                hasFirestoreDocument: !!firestoreData.firstName,
                createdAt: firestoreData.createdAt,
                updatedAt: firestoreData.updatedAt,
                lastLogin: firestoreData.lastLogin
            };
        });

        // Sort by last name, then first name, then email
        mergedUsers.sort((a, b) => {
            const aLastName = a.lastName || '';
            const bLastName = b.lastName || '';
            if (aLastName !== bLastName) {
                return aLastName.localeCompare(bLastName);
            }
            
            const aFirstName = a.firstName || '';
            const bFirstName = b.firstName || '';
            if (aFirstName !== bFirstName) {
                return aFirstName.localeCompare(bFirstName);
            }
            
            return (a.email || '').localeCompare(b.email || '');
        });

        return {
            users: mergedUsers,
            pageToken: listUsersResult.pageToken,
            totalCount: mergedUsers.length
        };

    } catch (error) {
        console.error(`Error in adminListAllUsers by admin ${callingUserUid}:`, error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', `An unexpected error occurred: ${error.message}`);
    }
});

/**
 * Invites a new user by creating their account and sending an email invitation.
 * The user will need to set their password using the invite link.
 * Requires the calling user to have an 'admin' or 'super_admin' role.
 */
exports.adminInviteUser = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    console.log('adminInviteUser called. Auth:', request.auth, 'Data:', request.data);

    if (!request.auth) {
        console.error('adminInviteUser: Authentication failed. No auth context.');
        throw new HttpsError('unauthenticated', 'The function must be called by an authenticated user.');
    }

    const callingUserUid = request.auth.uid;
    const { email, firstName, lastName, role, status, phone, companies } = request.data;

    // Validate required fields
    if (!email || !firstName || !lastName) {
        console.error('adminInviteUser: Missing required fields.');
        throw new HttpsError('invalid-argument', 'Email, first name, and last name are required.');
    }

    try {
        // Verify calling user's admin role
        const adminUserDocRef = db.collection('users').doc(callingUserUid);
        const adminUserDoc = await adminUserDocRef.get();
        if (!adminUserDoc.exists || !["admin", "superadmin"].includes(adminUserDoc.data().role)) {
            console.error(`adminInviteUser: Caller ${callingUserUid} is not an admin.`);
            throw new HttpsError('permission-denied', 'You do not have privileges to perform this action.');
        }

        console.log(`Admin user ${callingUserUid} inviting user: ${email}`);

        // Check if email already exists in Auth
        try {
            await admin.auth().getUserByEmail(email);
            throw new HttpsError('already-exists', 'A user with this email address already exists.');
        } catch (error) {
            if (error.code !== 'auth/user-not-found') {
                throw error;
            }
            // User not found is what we want - continue
        }

        // Generate a temporary password (user will be required to change it)
        const tempPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
        
        // Create the new user in Auth
        const userRecord = await admin.auth().createUser({
            email: email.trim(),
            password: tempPassword,
            displayName: `${firstName.trim()} ${lastName.trim()}`,
            emailVerified: false
        });
        const newUserId = userRecord.uid;
        console.log(`Created new user in Auth with UID: ${newUserId}`);

        // Generate custom token for password reset link
        const customToken = await admin.auth().createCustomToken(newUserId, {
            invite: true,
            email: email.trim()
        });

        // Create the user document in Firestore
        const newUserFirestoreData = {
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            role: role || 'user',
            status: status || 'active',
            phone: phone?.trim() || '',
            connectedCompanies: { companies: companies || [] },
            authUID: newUserId,
            isInvited: true,
            invitedAt: admin.firestore.FieldValue.serverTimestamp(),
            invitedBy: callingUserUid,
            passwordSet: false,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastLogin: null,
        };
        
        await db.collection("users").doc(newUserId).set(newUserFirestoreData);
        console.log(`Created Firestore document for user: ${newUserId}`);

        // Create invite link
        const inviteLink = `https://solushipx.web.app/set-password?token=${customToken}&email=${encodeURIComponent(email.trim())}`;

        // Send invite email
        try {
            const sgMail = require('@sendgrid/mail');
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);

            const adminUserData = adminUserDoc.data();
            const inviterName = `${adminUserData.firstName || ''} ${adminUserData.lastName || ''}`.trim() || adminUserData.email;

            const msg = {
                to: email.trim(),
                from: {
                    email: 'noreply@integratedcarriers.com',
                    name: 'Integrated Carriers'
                },
                subject: 'You\'ve been invited to SolushipX',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background-color: #1c277d; color: white; padding: 30px; border-radius: 0;">
                            <img src="https://solushipx.web.app/images/integratedcarrriers_logo_white.png" alt="Integrated Carriers" style="height: 40px; margin-bottom: 20px; display: block;" />
                            <h1 style="margin: 0; font-size: 24px;">Welcome to SolushipX!</h1>
                            <p style="margin: 10px 0 0 0; opacity: 0.9;">You've been invited to join our shipping platform</p>
                        </div>
                        
                        <div style="background: #f8f9fa; padding: 30px; border-radius: 0; border: 1px solid #e9ecef;">
                            <!-- Welcome Notice -->
                            <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 20px; border-radius: 0; margin-bottom: 20px;">
                                <h3 style="color: #065f46; margin: 0 0 10px 0; font-size: 16px;">🎉 Account Invitation</h3>
                                <p style="color: #047857; margin: 0; font-size: 14px;">Hello <strong>${firstName} ${lastName}</strong>, you've been invited to join SolushipX by ${inviterName}.</p>
                            </div>

                            <!-- Account Details -->
                            <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Account Details</h2>
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Email:</strong></td><td style="padding: 8px 0; font-weight: bold;">${email}</td></tr>
                                    <tr><td style="padding: 8px 0; color: #666;"><strong>Role:</strong></td><td style="padding: 8px 0;">${role || 'User'}</td></tr>
                                    ${companies && companies.length > 0 ? `<tr><td style="padding: 8px 0; color: #666;"><strong>Company Access:</strong></td><td style="padding: 8px 0;">${companies.length} companies</td></tr>` : ''}
                                    <tr><td style="padding: 8px 0; color: #666;"><strong>Invited By:</strong></td><td style="padding: 8px 0;">${inviterName}</td></tr>
                                </table>
                            </div>
                            
                            <!-- Call to Action -->
                            <div style="background: #f5f5f5; padding: 20px; border-radius: 0; text-align: center; margin-bottom: 20px;">
                                <h3 style="color: #1c277d; margin: 0 0 10px 0;">Set Up Your Account</h3>
                                <p style="margin: 0 0 15px 0; font-size: 14px; color: #666;">Click the button below to set your password and activate your account</p>
                                <a href="${inviteLink}" 
                                   style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 0; display: inline-block; border: 2px solid #000;">
                                   Set Up Your Password
                                </a>
                            </div>
                            
                            <!-- Security Warning -->
                            <div style="background: #fef3c7; border: 1px solid #fcd34d; padding: 15px; border-radius: 0; margin-bottom: 20px;">
                                <h3 style="color: #92400e; margin: 0 0 10px 0; font-size: 16px;">⚠️ Important Security Information</h3>
                                <p style="margin: 0; color: #92400e; font-size: 14px;">
                                    This invitation link will expire in 24 hours for security purposes. 
                                    If you don't complete your account setup within this time, please contact your administrator for a new invitation.
                                </p>
                            </div>

                            <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666;">
                                <p style="margin: 0;">Need help? Contact us at <a href="mailto:support@integratedcarriers.com" style="color: #1c277d;">support@integratedcarriers.com</a></p>
                                <p style="margin: 10px 0 0 0; font-size: 14px;">© 2025 Integrated Carriers. All rights reserved.</p>
                            </div>
                        </div>
                    </div>
                `
            };

            await sgMail.send(msg);
            console.log(`Invite email sent successfully to: ${email}`);

        } catch (emailError) {
            console.error('Error sending invite email:', emailError);
            // Don't fail the entire operation if email fails
            console.log('User created successfully but email sending failed');
        }

        return {
            status: "success",
            uid: newUserId,
            message: "User invitation sent successfully.",
            inviteLink: inviteLink // Include for testing/admin purposes
        };

    } catch (error) {
        console.error('Error in adminInviteUser:', error);
        
        // Clean up if user was created but something else failed
        if (error.newUserId) {
            try {
                await admin.auth().deleteUser(error.newUserId);
                await db.collection("users").doc(error.newUserId).delete();
                console.log('Cleaned up partially created user');
            } catch (cleanupError) {
                console.error('Error cleaning up user:', cleanupError);
            }
        }
        
        throw error;
    }
});

/**
 * Resends an invitation email to a user who hasn't accepted their invite.
 * Requires the calling user to have an 'admin' or 'super_admin' role.
 */
exports.adminResendInvite = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    console.log('adminResendInvite called. Auth:', request.auth, 'Data:', request.data);

    if (!request.auth) {
        console.error('adminResendInvite: Authentication failed. No auth context.');
        throw new HttpsError('unauthenticated', 'The function must be called by an authenticated user.');
    }

    const callingUserUid = request.auth.uid;
    const { uid: targetUserUid } = request.data;

    if (!targetUserUid) {
        console.error('adminResendInvite: Missing targetUserUid in data.');
        throw new HttpsError('invalid-argument', 'User ID is required.');
    }

    try {
        // Verify calling user's admin role
        const adminUserDocRef = db.collection('users').doc(callingUserUid);
        const adminUserDoc = await adminUserDocRef.get();
        if (!adminUserDoc.exists || !["admin", "superadmin"].includes(adminUserDoc.data().role)) {
            console.error(`adminResendInvite: Caller ${callingUserUid} is not an admin.`);
            throw new HttpsError('permission-denied', 'You do not have privileges to perform this action.');
        }

        console.log(`Admin user ${callingUserUid} resending invite for user: ${targetUserUid}`);

        // Get the target user's data
        const targetUserDoc = await db.collection('users').doc(targetUserUid).get();
        if (!targetUserDoc.exists) {
            throw new HttpsError('not-found', 'User not found.');
        }

        const userData = targetUserDoc.data();
        
        // Check if user is in a state where resend makes sense
        if (!userData.isInvited || userData.passwordSet) {
            throw new HttpsError('failed-precondition', 'This user has already accepted their invitation or is not in an invited state.');
        }

        // Get user auth data to verify they exist in Auth
        let authUser;
        try {
            authUser = await admin.auth().getUser(targetUserUid);
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                throw new HttpsError('not-found', 'User not found in authentication system.');
            }
            throw error;
        }

        // Generate new custom token for password reset link
        const customToken = await admin.auth().createCustomToken(targetUserUid, {
            invite: true,
            email: userData.email
        });

        // Create new invite link
        const inviteLink = `https://solushipx.web.app/set-password?token=${customToken}&email=${encodeURIComponent(userData.email)}`;

        // Send resend invite email
        try {
            const sgMail = require('@sendgrid/mail');
            sgMail.setApiKey(process.env.SENDGRID_API_KEY);

            const adminUserData = adminUserDoc.data();
            const inviterName = `${adminUserData.firstName || ''} ${adminUserData.lastName || ''}`.trim() || adminUserData.email;

            const msg = {
                to: userData.email,
                from: {
                    email: 'noreply@integratedcarriers.com',
                    name: 'Integrated Carriers'
                },
                subject: 'Reminder: Complete Your SolushipX Account Setup',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
                        <div style="background-color: #1c277d; color: white; padding: 30px; border-radius: 0;">
                            <img src="https://solushipx.web.app/images/integratedcarrriers_logo_white.png" alt="Integrated Carriers" style="height: 40px; margin-bottom: 20px; display: block;" />
                            <h1 style="margin: 0; font-size: 24px;">Complete Your SolushipX Setup</h1>
                            <p style="margin: 10px 0 0 0; opacity: 0.9;">Reminder to activate your account</p>
                        </div>
                        
                        <div style="background: #f8f9fa; padding: 30px; border-radius: 0; border: 1px solid #e9ecef;">
                            <!-- Reminder Notice -->
                            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 0; margin-bottom: 20px;">
                                <h3 style="color: #856404; margin: 0 0 10px 0; font-size: 16px;">⏰ Account Setup Reminder</h3>
                                <p style="color: #856404; margin: 0; font-size: 14px;">Hello <strong>${userData.firstName} ${userData.lastName}</strong>, this is a reminder to complete your SolushipX account setup.</p>
                            </div>

                            <!-- Account Details -->
                            <div style="background: white; padding: 20px; border-radius: 0; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                                <h2 style="color: #1c277d; margin: 0 0 15px 0; font-size: 18px;">Your Account Details</h2>
                                <table style="width: 100%; border-collapse: collapse;">
                                    <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Email:</strong></td><td style="padding: 8px 0; font-weight: bold;">${userData.email}</td></tr>
                                    <tr><td style="padding: 8px 0; color: #666;"><strong>Role:</strong></td><td style="padding: 8px 0;">${userData.role || 'User'}</td></tr>
                                    ${userData.connectedCompanies?.companies?.length > 0 ? `<tr><td style="padding: 8px 0; color: #666;"><strong>Company Access:</strong></td><td style="padding: 8px 0;">${userData.connectedCompanies.companies.length} companies</td></tr>` : ''}
                                    <tr><td style="padding: 8px 0; color: #666;"><strong>Originally Invited By:</strong></td><td style="padding: 8px 0;">${inviterName}</td></tr>
                                </table>
                            </div>
                            
                            <!-- Call to Action -->
                            <div style="background: #f5f5f5; padding: 20px; border-radius: 0; text-align: center; margin-bottom: 20px;">
                                <h3 style="color: #1c277d; margin: 0 0 10px 0;">Complete Your Account Setup</h3>
                                <p style="margin: 0 0 15px 0; font-size: 14px; color: #666;">Click the button below to set your password and activate your account</p>
                                <a href="${inviteLink}" 
                                   style="background: #000; color: white; padding: 12px 24px; text-decoration: none; border-radius: 0; display: inline-block; border: 2px solid #000;">
                                   Set Up Your Password
                                </a>
                            </div>
                            
                            <!-- Security Warning -->
                            <div style="background: #fef3c7; border: 1px solid #fcd34d; padding: 15px; border-radius: 0; margin-bottom: 20px;">
                                <h3 style="color: #92400e; margin: 0 0 10px 0; font-size: 16px;">⚠️ Important Security Information</h3>
                                <p style="margin: 0; color: #92400e; font-size: 14px;">
                                    This new invitation link will expire in 24 hours for security purposes. 
                                    If you don't complete your account setup within this time, please contact your administrator for assistance.
                                </p>
                            </div>

                            <div style="text-align: center; padding-top: 20px; border-top: 1px solid #e9ecef; color: #666;">
                                <p style="margin: 0;">Need help? Contact us at <a href="mailto:support@integratedcarriers.com" style="color: #1c277d;">support@integratedcarriers.com</a></p>
                                <p style="margin: 10px 0 0 0; font-size: 14px;">© 2025 Integrated Carriers. All rights reserved.</p>
                            </div>
                        </div>
                    </div>
                `
            };

            await sgMail.send(msg);
            console.log(`Resend invite email sent successfully to: ${userData.email}`);

        } catch (emailError) {
            console.error('Error sending resend invite email:', emailError);
            throw new HttpsError('internal', 'Failed to send invitation email. Please try again.');
        }

        // Update the user document with resend information
        await db.collection('users').doc(targetUserUid).update({
            lastInviteResent: admin.firestore.FieldValue.serverTimestamp(),
            resentBy: callingUserUid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return {
            status: "success",
            message: "Invitation email resent successfully.",
            email: userData.email
        };

    } catch (error) {
        console.error('Error in adminResendInvite:', error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', `An unexpected error occurred: ${error.message}`);
    }
});

/**
 * Verifies an invite token and allows the user to set their password.
 */
exports.verifyInviteAndSetPassword = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    console.log('verifyInviteAndSetPassword called');

    const { token, newPassword } = request.data;

    if (!token || !newPassword) {
        throw new HttpsError('invalid-argument', 'Token and new password are required.');
    }

    if (newPassword.length < 6) {
        throw new HttpsError('invalid-argument', 'Password must be at least 6 characters long.');
    }

    try {
        // Verify the custom token
        const decodedToken = await admin.auth().verifyIdToken(token);
        const uid = decodedToken.uid;

        if (!decodedToken.invite) {
            throw new HttpsError('invalid-argument', 'Invalid invite token.');
        }

        // Check if user exists and is in invited state
        const userDoc = await db.collection('users').doc(uid).get();
        if (!userDoc.exists()) {
            throw new HttpsError('not-found', 'User not found.');
        }

        const userData = userDoc.data();
        if (!userData.isInvited || userData.passwordSet) {
            throw new HttpsError('failed-precondition', 'This invitation has already been used or is invalid.');
        }

        // Update the user's password
        await admin.auth().updateUser(uid, {
            password: newPassword,
            emailVerified: true
        });

        // Update user document
        await db.collection('users').doc(uid).update({
            passwordSet: true,
            isInvited: false,
            emailVerified: true,
            passwordSetAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`Password set successfully for user: ${uid}`);

        return {
            status: "success",
            message: "Password set successfully. You can now sign in."
        };

    } catch (error) {
        console.error('Error in verifyInviteAndSetPassword:', error);
        throw error;
    }
}); 