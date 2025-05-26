import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

// Initial empty state for the shipment form
export const initialFormState = {
    draftFirestoreDocId: null,
    // ShipFrom data
    shipFrom: {
        company: '',
        name: '',
        attention: '',
        street: '',
        street2: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'US',
        contactName: '',
        contactPhone: '',
        contactEmail: '',
        specialInstructions: '',
        id: null,
        shipFromAddresses: []
    },
    // ShipTo data
    shipTo: {
        company: '',
        name: '',
        attention: '',
        street: '',
        street2: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'US',
        contactName: '',
        contactPhone: '',
        contactEmail: '',
        specialInstructions: '',
        selectedCustomer: null,
        customerID: null,
        selectedAddressId: null
    },
    // ShipmentInfo data
    shipmentInfo: {
        shipmentType: 'LTL',
        internationalShipment: false,
        shipperReferenceNumber: '',
        bookingReferenceNumber: '',
        bookingReferenceType: 'PO',
        shipmentBillType: 'PREPAID',
        shipmentDate: new Date().toISOString().split('T')[0],
        earliestPickupTime: '09:00',
        latestPickupTime: '17:00',
        earliestDeliveryTime: '09:00',
        latestDeliveryTime: '17:00',
        dangerousGoodsType: 'none',
        signatureServiceType: 'none',
        holdForPickup: false,
        saturdayDelivery: false,
        notes: ''
    },
    // Packages data
    packages: [],
    // Selected rate reference (instead of full rate data)
    selectedRateRef: null,
    // Legacy selectedRate for backward compatibility during transition
    selectedRate: null,
    // The full request object used to get rates, needed for booking
    originalRateRequestData: null
};

const STORAGE_KEY = 'shipmentFormData';

const ShipmentFormContext = createContext();

export const ShipmentFormProvider = ({ children }) => {
    // Initialize state from localStorage or use initialFormState
    const [formData, setFormData] = useState(() => {
        // const savedData = localStorage.getItem(STORAGE_KEY);
        // if (savedData) {
        //     try {
        //         // Ensure packages is always an array after loading from storage
        //         const parsedData = JSON.parse(savedData);
        //         if (!Array.isArray(parsedData.packages)) {
        //             parsedData.packages = [];
        //         }
        //         // Ensure new fields are initialized if not in localStorage
        //         parsedData.draftFirestoreDocId = parsedData.draftFirestoreDocId || null;
        //         parsedData.readableShipmentID = parsedData.readableShipmentID || null;
        //         return parsedData;
        //     } catch (error) {
        //         console.error('Failed to parse saved form data:', error);
        //         return initialFormState;
        //     }
        // }
        return initialFormState; // Always start with initialFormState for this test
    });

    // Sync to localStorage when formData changes
    // useEffect(() => {
    //     localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    // }, [formData]);

    // Memoize update function with useCallback
    const updateFormSection = useCallback((section, data) => {
        setFormData(prevData => {
            let updatedSectionData;
            if (section === 'packages') {
                updatedSectionData = Array.isArray(data) ? data : [];
            } else if (section === 'selectedRate') {
                updatedSectionData = data;
            } else {
                updatedSectionData = {
                    ...(prevData[section] || {}),
                    ...data
                };
            }
            return { ...prevData, [section]: updatedSectionData };
        });
    }, []); // No dependencies needed as it only uses setFormData

    // Enhanced setFormData that properly merges draft data with initial structure
    const setFormDataWithMerge = useCallback((newData) => {
        setFormData(prevData => {
            // Deep merge function to ensure all nested objects are properly merged
            const deepMerge = (target, source) => {
                const result = { ...target };

                for (const key in source) {
                    if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                        // For nested objects, recursively merge
                        result[key] = deepMerge(target[key] || {}, source[key]);
                    } else if (Array.isArray(source[key])) {
                        // For arrays, use the source array directly
                        result[key] = source[key];
                    } else {
                        // For primitive values, use source value
                        result[key] = source[key];
                    }
                }

                return result;
            };

            // Start with initial form state to ensure all required fields exist
            const mergedData = deepMerge(initialFormState, newData);

            console.log('ShipmentFormContext: Merging draft data with initial state:', {
                initialState: initialFormState,
                incomingData: newData,
                mergedResult: mergedData
            });

            return mergedData;
        });
    }, []);

    const setDraftShipmentIdentifiers = useCallback((firestoreDocId) => {
        setFormData(prevData => ({
            ...prevData,
            draftFirestoreDocId: firestoreDocId
        }));
    }, []);

    // Memoize clear function with useCallback
    const clearFormData = useCallback(() => {
        localStorage.removeItem(STORAGE_KEY);
        setFormData(initialFormState);
    }, []); // Depends only on initialFormState (stable)

    // Memoize complete function with useCallback
    const completeShipment = useCallback(() => {
        console.log("Shipment complete action called. Clearing form."); // Added log
        clearFormData();
    }, [clearFormData]); // Depends on stable clearFormData

    // Memoize the context value object with useMemo
    const contextValue = useMemo(() => ({
        formData,
        updateFormSection,
        setFormData: setFormDataWithMerge, // Use the enhanced merge function
        clearFormData,
        completeShipment,
        setDraftShipmentIdentifiers
    }), [formData, updateFormSection, setFormDataWithMerge, clearFormData, completeShipment, setDraftShipmentIdentifiers]); // Dependencies are the state and memoized functions

    return (
        <ShipmentFormContext.Provider value={contextValue}>
            {children}
        </ShipmentFormContext.Provider>
    );
};

// Custom hook for easier context use
export const useShipmentForm = () => {
    const context = useContext(ShipmentFormContext);
    if (!context) {
        throw new Error('useShipmentForm must be used within a ShipmentFormProvider');
    }
    return context;
}; 