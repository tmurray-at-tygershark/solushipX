import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import {
    onAuthStateChanged,
    signOut,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail,
    GoogleAuthProvider,
    signInWithPopup,
    getAuth,
    getIdTokenResult
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { initializeRoleService } from '../utils/rolePermissions';

const AuthContext = createContext(null);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userRole, setUserRole] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [initialized, setInitialized] = useState(false);
    const [roleServiceInitialized, setRoleServiceInitialized] = useState(false);

    useEffect(() => {
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    // Force refresh the token to get latest custom claims
                    const idTokenResult = await user.getIdTokenResult(true);

                    // Fetch user data from Firestore for all users
                    const userDocRef = doc(db, "users", user.uid);
                    const docSnap = await getDoc(userDocRef);

                    if (docSnap.exists()) {
                        const userDataFromFirestore = docSnap.data();

                        // Set role based on claims first, then Firestore fallback
                        if (idTokenResult.claims.superadmin === true) {
                            setUserRole('superadmin');
                        } else if (idTokenResult.claims.admin === true) {
                            setUserRole('admin');
                        } else {
                            setUserRole(userDataFromFirestore.role || 'user');
                        }

                        // Always add Firestore data to user object
                        setUser({
                            ...user,
                            companyId: userDataFromFirestore.companyId,
                            role: userDataFromFirestore.role,
                            connectedCompanies: userDataFromFirestore.connectedCompanies
                        });
                    } else {
                        // Handle case where no Firestore document exists
                        if (idTokenResult.claims.superadmin === true) {
                            setUserRole('superadmin');
                        } else if (idTokenResult.claims.admin === true) {
                            setUserRole('admin');
                        } else {
                            setUserRole('user');
                        }
                        setUser(user);
                    }
                } catch (error) {
                    console.error('Error in auth state change:', error);
                    setUser(null);
                    setUserRole(null);
                }
            } else {
                setUser(null);
                setUserRole(null);
            }
            setLoading(false);
            setInitialized(true);
        });

        return () => unsubscribe();
    }, []);

    // Initialize role service on app startup
    useEffect(() => {
        const initRoleService = async () => {
            try {
                await initializeRoleService();
                setRoleServiceInitialized(true);
                console.log('🔐 Role service initialized successfully');
            } catch (error) {
                console.warn('⚠️ Role service initialization failed, using fallback:', error);
                setRoleServiceInitialized(true); // Still proceed with hardcoded roles
            }
        };

        initRoleService();
    }, []);

    const login = async (email, password) => {
        try {
            setError(null);
            setLoading(true);
            const result = await signInWithEmailAndPassword(auth, email, password);

            // Fetch user data from Firestore
            const userDoc = await getDoc(doc(db, 'users', result.user.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                console.log('Login - User data from Firestore:', userData);

                // Set user with additional data from Firestore
                setUser({
                    ...result.user,
                    companyId: userData.companyId,
                    role: userData.role,
                    connectedCompanies: userData.connectedCompanies
                });
                setUserRole(userData.role);

                // Update lastLogin
                await setDoc(doc(db, 'users', result.user.uid), {
                    lastLogin: new Date(),
                    updatedAt: new Date()
                }, { merge: true });
            } else {
                console.log('Login - No user document found, creating new one');
                // Set default role for new users
                await setDoc(doc(db, 'users', result.user.uid), {
                    email: result.user.email,
                    role: 'user',
                    createdAt: new Date(),
                    lastLogin: new Date(),
                    updatedAt: new Date()
                });
                setUser(result.user);
                setUserRole('user');
            }

            return result.user;
        } catch (err) {
            console.error('Login error:', err);
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const signup = async (email, password, role = 'user') => {
        try {
            setError(null);
            const result = await createUserWithEmailAndPassword(auth, email, password);
            // Set user role in Firestore
            await setDoc(doc(db, 'users', result.user.uid), {
                email: result.user.email,
                role: role, // Keep consistent with field name
                createdAt: new Date(),
                lastLogin: new Date()
            });
            setUserRole(role);
            return result.user;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const logout = async () => {
        try {
            console.log('AuthContext - Starting logout process');
            setError(null);
            setLoading(true); // Set loading state while logging out

            // Sign out from Firebase
            await signOut(auth);
            console.log('AuthContext - Firebase signOut successful');

            // Clear local state
            setUser(null);
            setUserRole(null);

            // Clear company data from localStorage
            localStorage.removeItem('solushipx_company_data');
            localStorage.removeItem('solushipx_company_id_for_address');
            console.log('AuthContext - Cleared company data from localStorage');

            // Wait for a moment to ensure state is cleared
            await new Promise(resolve => setTimeout(resolve, 100));

            console.log('AuthContext - User state cleared');
        } catch (err) {
            console.error('AuthContext - Logout error:', err);
            setError(err.message);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    const resetPassword = async (email) => {
        try {
            setError(null);
            await sendPasswordResetEmail(auth, email);
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const signInWithGoogle = async () => {
        try {
            setError(null);
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            // Check if user exists in Firestore
            const userDoc = await getDoc(doc(db, 'users', result.user.uid));
            if (!userDoc.exists()) {
                // Set default role for new Google users
                await setDoc(doc(db, 'users', result.user.uid), {
                    email: result.user.email,
                    role: 'user', // Keep consistent with field name
                    createdAt: new Date(),
                    lastLogin: new Date()
                });
                setUserRole('user');
            } else {
                const userData = userDoc.data();
                setUserRole(userData.role); // Use 'role' instead of 'userRole'
            }
            return result.user;
        } catch (err) {
            setError(err.message);
            throw err;
        }
    };

    const value = {
        currentUser: user,
        userRole,
        loading,
        error,
        initialized,
        roleServiceInitialized,
        isAuthenticated: !!user,
        login,
        signup,
        logout,
        resetPassword,
        signInWithGoogle
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}; 