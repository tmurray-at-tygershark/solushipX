import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

const CompanyContext = createContext(null);

export const useCompany = () => useContext(CompanyContext);

const ADMIN_ROLES = ['super_admin', 'admin', 'business_admin'];

export const CompanyProvider = ({ children }) => {
    const { currentUser, userRole } = useAuth();
    const [companyData, setCompanyData] = useState(null);
    const [companyIdForAddress, setCompanyIdForAddress] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Check if we have cached company data in localStorage
        const cachedCompanyData = localStorage.getItem('solushipx_company_data');
        const cachedCompanyIdForAddress = localStorage.getItem('solushipx_company_id_for_address');

        if (cachedCompanyData && cachedCompanyIdForAddress) {
            setCompanyData(JSON.parse(cachedCompanyData));
            setCompanyIdForAddress(cachedCompanyIdForAddress);
            setLoading(false);
            return;
        }

        const fetchCompanyData = async () => {
            if (!currentUser) {
                setLoading(false);
                return;
            }

            setLoading(true);
            setError(null);

            try {
                // For admin users, don't require company data
                if (ADMIN_ROLES.includes(userRole)) {
                    console.log('Admin user detected, skipping company data requirement');
                    setCompanyData(null);
                    setCompanyIdForAddress(null);
                    setLoading(false);
                    return;
                }

                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));

                if (!userDoc.exists()) {
                    throw new Error('User data not found.');
                }

                const userData = userDoc.data();

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

                // Cache the data in localStorage for future use
                localStorage.setItem('solushipx_company_data', JSON.stringify(companyWithId));
                localStorage.setItem('solushipx_company_id_for_address', companyDocData.companyID);

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
        localStorage.removeItem('solushipx_company_data');
        localStorage.removeItem('solushipx_company_id_for_address');
        setCompanyData(null);
        setCompanyIdForAddress(null);
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

            // Update localStorage cache
            localStorage.setItem('solushipx_company_data', JSON.stringify(freshCompanyData));

            // Update state
            setCompanyData(freshCompanyData);

        } catch (err) {
            console.error('Error refreshing company data:', err);
            setError(err.message || 'Failed to refresh company data');
        }
    };

    const value = {
        companyData,
        companyIdForAddress,
        loading,
        error,
        clearCompanyData,
        refreshCompanyData,
        isAdmin: ADMIN_ROLES.includes(userRole)
    };

    return (
        <CompanyContext.Provider value={value}>
            {children}
        </CompanyContext.Provider>
    );
}; 