import { useState, useCallback } from 'react';

/**
 * Custom hook for managing modal navigation state
 * Provides a clean API for handling nested modal navigation
 */
export const useModalNavigation = (initialPage = null) => {
    const [navigationStack, setNavigationStack] = useState(
        initialPage ? [initialPage] : []
    );
    const [currentIndex, setCurrentIndex] = useState(0);

    // Navigate to a new page (push to stack)
    const navigateTo = useCallback((page) => {
        setNavigationStack(prev => [...prev, page]);
        setCurrentIndex(prev => prev + 1);
    }, []);

    // Go back to previous page (pop from stack)
    const goBack = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            // Optionally remove the page from stack or keep it for forward navigation
            setNavigationStack(prev => prev.slice(0, -1));
        }
    }, [currentIndex]);

    // Reset to initial page
    const reset = useCallback((newInitialPage = null) => {
        if (newInitialPage) {
            setNavigationStack([newInitialPage]);
            setCurrentIndex(0);
        } else {
            setNavigationStack([]);
            setCurrentIndex(0);
        }
    }, []);

    // Get current page
    const getCurrentPage = useCallback(() => {
        return navigationStack[currentIndex] || null;
    }, [navigationStack, currentIndex]);

    // Check if we can go back
    const canGoBack = currentIndex > 0;

    // Get navigation object for ModalHeader
    const getNavigationObject = useCallback(() => {
        const currentPage = getCurrentPage();
        const canGoBackNow = currentPage?.component === 'shipment-detail' || canGoBack;
        return {
            title: currentPage?.title || '',
            canGoBack: canGoBackNow,
            onBack: canGoBackNow ? goBack : null,
            backText: canGoBackNow && navigationStack[currentIndex - 1] 
                ? navigationStack[currentIndex - 1].shortTitle || 'Back'
                : 'Back'
        };
    }, [getCurrentPage, canGoBack, goBack, navigationStack, currentIndex]);

    return {
        // State
        navigationStack,
        currentIndex,
        canGoBack,
        
        // Actions
        navigateTo,
        goBack,
        reset,
        getCurrentPage,
        
        // For ModalHeader
        getNavigationObject,
        
        // Direct props for ModalHeader (alternative approach)
        navigation: getNavigationObject()
    };
};

/**
 * Page object structure:
 * {
 *   title: string,           // Full title for the page
 *   shortTitle?: string,     // Short title for breadcrumbs/back button
 *   component?: string,      // Component identifier
 *   data?: object           // Any additional data for the page
 * }
 */

export default useModalNavigation; 