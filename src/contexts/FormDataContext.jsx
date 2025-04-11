import React, { createContext, useContext, useState, useCallback } from 'react';

// Create the context
const FormDataContext = createContext();

// Custom hook to use the form data context
export const useFormData = () => {
    const context = useContext(FormDataContext);
    if (!context) {
        throw new Error('useFormData must be used within a FormDataProvider');
    }
    return context;
};

// Provider component
export const FormDataProvider = ({ children }) => {
    // Initialize state for form data
    const [formData, setFormData] = useState({
        shipFrom: null,
        shipTo: null,
        packages: [],
        service: null,
        reference: '',
        notes: '',
        // Add any other form fields as needed
    });

    // Update a specific field in the form data
    const updateField = useCallback((field, value) => {
        setFormData(prevData => ({
            ...prevData,
            [field]: value
        }));
    }, []);

    // Reset the form data
    const resetForm = useCallback(() => {
        setFormData({
            shipFrom: null,
            shipTo: null,
            packages: [],
            service: null,
            reference: '',
            notes: '',
            // Reset any other form fields as needed
        });
    }, []);

    // Value object to be provided to consumers
    const value = {
        formData,
        updateField,
        resetForm
    };

    return (
        <FormDataContext.Provider value={value}>
            {children}
        </FormDataContext.Provider>
    );
};

export default FormDataContext; 