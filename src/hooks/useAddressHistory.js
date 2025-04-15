import { useState, useCallback } from 'react';

export const useAddressHistory = () => {
    const [addressHistory, setAddressHistory] = useState([]);

    const addToHistory = useCallback((address) => {
        setAddressHistory(prev => {
            const exists = prev.some(a => a.placeId === address.placeId);
            if (!exists) {
                return [address, ...prev].slice(0, 5); // Keep last 5 addresses
            }
            return prev;
        });
    }, []);

    const removeFromHistory = useCallback((placeId) => {
        setAddressHistory(prev => prev.filter(a => a.placeId !== placeId));
    }, []);

    const clearHistory = useCallback(() => {
        setAddressHistory([]);
    }, []);

    return {
        addressHistory,
        addToHistory,
        removeFromHistory,
        clearHistory
    };
}; 