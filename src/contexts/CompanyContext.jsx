import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

const CompanyContext = createContext(null);

export const useCompany = () => useContext(CompanyContext);

const ADMIN_ROLES = ['superadmin', 'admin'];

export const CompanyProvider = ({ children }) => {
    const { currentUser, userRole } = useAuth();
    const [companyData, setCompanyData] = useState(null);
    const [companyIdForAddress, setCompanyIdForAddress] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchCompanyData = async () => {
            if (!currentUser) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                // For super admins, check if there's a stored company context first
                if (ADMIN_ROLES.includes(userRole)) {
                    const storedCompanyId = localStorage.getItem('solushipx_selected_company_id');
                    const storedCompanyData = localStorage.getItem('solushipx_selected_company_data');

                    if (storedCompanyId && storedCompanyData) {
                        try {
                            const parsedCompanyData = JSON.parse(storedCompanyData);
                            console.log('🔄 Restoring stored company context for super admin:', storedCompanyId);
                            setCompanyData(parsedCompanyData);
                            setCompanyIdForAddress(storedCompanyId);
                            setLoading(false);
                            return;
                        } catch (parseError) {
                            console.warn('Failed to parse stored company data, falling back to default:', parseError);
                            localStorage.removeItem('solushipx_selected_company_id');
                            localStorage.removeItem('solushipx_selected_company_data');
                        }
                    }
                }

                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));

                if (!userDoc.exists()) {
                    throw new Error('User data not found.');
                }

                const userData = userDoc.data();

                // For super admins, if no stored context, use the first connected company as default
                if (ADMIN_ROLES.includes(userRole)) {
                    const defaultCompanyId = userData.connectedCompanies?.companies?.[0];

                    if (defaultCompanyId) {
                        console.log('Super admin with no stored company context - using first connected company as default:', defaultCompanyId);

                        // Query for the default company document
                        const companiesQuery = query(
                            collection(db, 'companies'),
                            where('companyID', '==', defaultCompanyId),
                            limit(1)
                        );

                        const companiesSnapshot = await getDocs(companiesQuery);

                        if (!companiesSnapshot.empty) {
                            const companyDoc = companiesSnapshot.docs[0];
                            const companyDocData = companyDoc.data();
                            const companyDocId = companyDoc.id;

                            const companyWithId = {
                                ...companyDocData,
                                id: companyDocId
                            };

                            setCompanyData(companyWithId);
                            setCompanyIdForAddress(companyDocData.companyID);
                            setLoading(false);
                            return;
                        }
                    }

                    // If no default company found, set no company context
                    console.log('Super admin with no stored company context and no default company - setting no company context');
                    setCompanyData(null);
                    setCompanyIdForAddress(null);
                    setLoading(false);
                    return;
                }

                // For regular users, use the default company logic
                const companyIdValue = userData.connectedCompanies?.companies?.[0] || userData.companies?.[0];

                if (!companyIdValue) {
                    throw new Error('No company ID found.');
                }

                // Query for the company document where companyID field equals the value
                const companiesQuery = query(
                    collection(db, 'companies'),
                    where('companyID', '==', companyIdValue),
                    limit(1)
                );

                const companiesSnapshot = await getDocs(companiesQuery);

                if (companiesSnapshot.empty) {
                    throw new Error(`No company found with companyID: ${companyIdValue}`);
                }

                // Get the first matching document
                const companyDoc = companiesSnapshot.docs[0];
                const companyDocData = companyDoc.data();
                const companyDocId = companyDoc.id;

                // Save the Firebase document ID and the value for addressBook
                const companyWithId = {
                    ...companyDocData,
                    id: companyDocId
                };

                setCompanyData(companyWithId);
                setCompanyIdForAddress(companyDocData.companyID);
                setLoading(false);

            } catch (err) {
                console.error('Error fetching company data:', err);

                // For admin users, don't treat missing company as an error
                if (ADMIN_ROLES.includes(userRole)) {
                    console.log('Admin user - treating missing company as normal');
                    setCompanyData(null);
                    setCompanyIdForAddress(null);
                    setError(null);
                } else {
                    setError(err.message || 'Failed to fetch company data.');
                }

                setLoading(false);
            }
        };

        fetchCompanyData();
    }, [currentUser, userRole]);

    // Function to clear company data on logout
    const clearCompanyData = () => {
        setCompanyData(null);
        setCompanyIdForAddress(null);

        // Clear stored company context from localStorage
        localStorage.removeItem('solushipx_selected_company_id');
        localStorage.removeItem('solushipx_selected_company_data');
        console.log('🧹 Cleared stored company context from localStorage');
    };

    // Function to clear stored company context (for returning to admin dashboard)
    const clearStoredCompanyContext = () => {
        localStorage.removeItem('solushipx_selected_company_id');
        localStorage.removeItem('solushipx_selected_company_data');
        console.log('🧹 Cleared stored company context');
    };

    // Function to refresh company data from Firestore
    const refreshCompanyData = async () => {
        if (!currentUser || !companyData?.id) {
            return;
        }

        try {
            // Fetch fresh data from Firestore using the document ID
            const companyDoc = await getDoc(doc(db, 'companies', companyData.id));

            if (!companyDoc.exists()) {
                throw new Error('Company document not found');
            }

            const freshCompanyData = {
                ...companyDoc.data(),
                id: companyDoc.id
            };

            // Update state
            setCompanyData(freshCompanyData);

        } catch (err) {
            console.error('Error refreshing company data:', err);
            setError(err.message || 'Failed to refresh company data');
        }
    };

    // Function to force refresh company data from Firestore (for credit hold updates)
    const forceRefreshCompanyData = async () => {
        if (!currentUser) {
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));

            if (!userDoc.exists()) {
                throw new Error('User data not found.');
            }

            const userData = userDoc.data();

            // For super admins, if no stored context, use the first connected company as default
            if (ADMIN_ROLES.includes(userRole)) {
                const defaultCompanyId = userData.connectedCompanies?.companies?.[0];

                if (defaultCompanyId) {
                    console.log('Super admin force refresh with no stored company context - using first connected company as default:', defaultCompanyId);

                    // Query for the default company document
                    const companiesQuery = query(
                        collection(db, 'companies'),
                        where('companyID', '==', defaultCompanyId),
                        limit(1)
                    );

                    const companiesSnapshot = await getDocs(companiesQuery);

                    if (!companiesSnapshot.empty) {
                        const companyDoc = companiesSnapshot.docs[0];
                        const companyDocData = companyDoc.data();
                        const companyDocId = companyDoc.id;

                        const companyWithId = {
                            ...companyDocData,
                            id: companyDocId
                        };

                        setCompanyData(companyWithId);
                        setCompanyIdForAddress(companyDocData.companyID);
                        setLoading(false);
                        return;
                    }
                }

                // If no default company found, set no company context
                console.log('Super admin force refresh with no stored company context and no default company - setting no company context');
                setCompanyData(null);
                setCompanyIdForAddress(null);
                setLoading(false);
                return;
            }

            // For regular users, use the default company logic
            const companyIdValue = userData.connectedCompanies?.companies?.[0] || userData.companies?.[0];

            if (!companyIdValue) {
                throw new Error('No company ID found.');
            }

            // Query for the company document where companyID field equals the value
            const companiesQuery = query(
                collection(db, 'companies'),
                where('companyID', '==', companyIdValue),
                limit(1)
            );

            const companiesSnapshot = await getDocs(companiesQuery);

            if (companiesSnapshot.empty) {
                throw new Error(`No company found with companyID: ${companyIdValue}`);
            }

            const companyDoc = companiesSnapshot.docs[0];
            const companyDocData = companyDoc.data();
            const companyDocId = companyDoc.id;

            const companyWithId = {
                ...companyDocData,
                id: companyDocId
            };

            setCompanyData(companyWithId);
            setCompanyIdForAddress(companyDocData.companyID);
            setLoading(false);

            console.log('🔄 Company data force refreshed - fresh credit hold status loaded');

        } catch (err) {
            console.error('Error force refreshing company data:', err);
            setError(err.message || 'Failed to refresh company data');
            setLoading(false);
        }
    };

    // Function to manually set company data (for admin users switching context)
    const setCompanyContext = async (newCompanyData, returnPath = null) => {
        try {
            // Store the return path for "Return to Admin" functionality
            if (returnPath) {
                localStorage.setItem('solushipx_admin_return_path', returnPath);
            }

            // Update state
            setCompanyData(newCompanyData);
            setCompanyIdForAddress(newCompanyData.companyID);

            // Store the selected company in localStorage for persistence
            if (ADMIN_ROLES.includes(userRole)) {
                localStorage.setItem('solushipx_selected_company_id', newCompanyData.companyID);
                localStorage.setItem('solushipx_selected_company_data', JSON.stringify(newCompanyData));
                console.log('💾 Stored company context in localStorage:', newCompanyData.companyID);
            }

            return Promise.resolve();
        } catch (err) {
            console.error('Error setting company context:', err);
            return Promise.reject(err);
        }
    };

    // Function to get the admin return path
    const getAdminReturnPath = () => {
        return localStorage.getItem('solushipx_admin_return_path') || '/admin/dashboard';
    };

    // Function to clear admin return path (when returning to admin)
    const clearAdminReturnPath = () => {
        localStorage.removeItem('solushipx_admin_return_path');
    };

    const value = {
        companyData,
        companyIdForAddress,
        loading,
        error,
        clearCompanyData,
        refreshCompanyData,
        forceRefreshCompanyData,
        setCompanyContext,
        getAdminReturnPath,
        clearAdminReturnPath,
        clearStoredCompanyContext,
        isAdmin: ADMIN_ROLES.includes(userRole)
    };

    return (
        <CompanyContext.Provider value={value}>
            {children}
        </CompanyContext.Provider>
    );
}; 