import React, { createContext, useContext, useState, useEffect } from 'react';

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
        specialInstructions: ''
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
                return JSON.parse(savedData);
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

    // Update specific section of the form
    const updateFormSection = (section, data) => {
        setFormData(prevData => ({
            ...prevData,
            [section]: {
                ...prevData[section],
                ...data
            }
        }));
    };

    // Clear form data (for when shipment is complete or user wants to start over)
    const clearFormData = () => {
        localStorage.removeItem(STORAGE_KEY);
        setFormData(initialFormState);
    };

    // Complete form submission
    const completeShipment = () => {
        // Here you could implement API calls to submit the shipment
        // Then clear the form:
        clearFormData();
    };

    return (
        <ShipmentFormContext.Provider
            value={{
                formData,
                updateFormSection,
                clearFormData,
                completeShipment
            }}
        >
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