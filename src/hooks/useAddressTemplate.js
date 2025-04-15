import { useState, useCallback } from 'react';

export const useAddressTemplate = () => {
    const [templates, setTemplates] = useState([]);

    const addTemplate = useCallback((address) => {
        setTemplates(prev => {
            const exists = prev.some(t => t.placeId === address.placeId);
            if (!exists) {
                return [...prev, { ...address, isTemplate: true }];
            }
            return prev;
        });
    }, []);

    const removeTemplate = useCallback((placeId) => {
        setTemplates(prev => prev.filter(t => t.placeId !== placeId));
    }, []);

    const updateTemplate = useCallback((placeId, updates) => {
        setTemplates(prev => prev.map(t => 
            t.placeId === placeId ? { ...t, ...updates } : t
        ));
    }, []);

    return {
        templates,
        addTemplate,
        removeTemplate,
        updateTemplate
    };
}; 