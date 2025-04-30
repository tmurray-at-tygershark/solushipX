import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

// Initial empty state for the shipment form
const initialFormState = {
    // ShipFrom data
    shipFrom: {
        name: '',
        company: '',
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
        name: '',
        company: '',
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
        selectedAddressId: null
    },
    // ShipmentInfo data
    shipmentInfo: {
        shipmentDate: '',
        referenceNumber: '',
        referenceType: 'PO',
        shipmentType: 'LTL',
        serviceLevel: 'standard',
        pickupWindow: {
            earliest: '09:00',
            latest: '17:00',
        },
        deliveryWindow: {
            earliest: '09:00',
            latest: '17:00',
        },
        notes: ''
    },
    // Packages data
    packages: [],
    // Selected rate
    selectedRate: null,
};

const STORAGE_KEY = 'shipmentFormData';

const ShipmentFormContext = createContext();

export const ShipmentFormProvider = ({ children }) => {
    // Initialize state from localStorage or use initialFormState
    const [formData, setFormData] = useState(() => {
        const savedData = localStorage.getItem(STORAGE_KEY);
        if (savedData) {
            try {
                // Ensure packages is always an array after loading from storage
                const parsedData = JSON.parse(savedData);
                if (!Array.isArray(parsedData.packages)) {
                    parsedData.packages = [];
                }
                return parsedData;
            } catch (error) {
                console.error('Failed to parse saved form data:', error);
                return initialFormState;
            }
        }
        return initialFormState;
    });

    // Sync to localStorage when formData changes
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    }, [formData]);

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
        clearFormData,
        completeShipment
    }), [formData, updateFormSection, clearFormData, completeShipment]); // Dependencies are the state and memoized functions

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