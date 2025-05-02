import React, { createContext, useContext, useState, useEffect } from 'react';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from './AuthContext';

const CompanyContext = createContext(null);

export const useCompany = () => useContext(CompanyContext);

export const CompanyProvider = ({ children }) => {
    const { currentUser } = useAuth();
    const [companyData, setCompanyData] = useState(null);
    const [companyIdForAddress, setCompanyIdForAddress] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Check if we have cached company data in localStorage
        const cachedCompanyData = localStorage.getItem('solushipx_company_data');
        const cachedCompanyIdForAddress = localStorage.getItem('solushipx_company_id_for_address');

        if (cachedCompanyData && cachedCompanyIdForAddress) {
            console.log('CompanyContext: Using cached company data');
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
                console.log('CompanyContext: Fetching company ID for user:', currentUser.uid);
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));

                if (!userDoc.exists()) {
                    throw new Error('User data not found.');
                }

                const userData = userDoc.data();
                const companyIdValue = userData.connectedCompanies?.companies?.[0] || userData.companies?.[0];

                if (!companyIdValue) {
                    throw new Error('No company ID found.');
                }

                console.log("CompanyContext: Found companyID value:", companyIdValue);

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

                console.log('CompanyContext: Found company document:', { id: companyDocId, ...companyDocData });

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
                setError(err.message || 'Failed to fetch company data.');
                setLoading(false);
            }
        };

        fetchCompanyData();
    }, [currentUser]);

    // Function to clear company data on logout
    const clearCompanyData = () => {
        localStorage.removeItem('solushipx_company_data');
        localStorage.removeItem('solushipx_company_id_for_address');
        setCompanyData(null);
        setCompanyIdForAddress(null);
    };

    const value = {
        companyData,
        companyIdForAddress,
        loading,
        error,
        clearCompanyData
    };

    return (
        <CompanyContext.Provider value={value}>
            {children}
        </CompanyContext.Provider>
    );
}; 