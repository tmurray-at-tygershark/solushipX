import { useState, useEffect, useCallback, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

/**
 * Custom hook for smart status updates with intelligent deduplication
 * This hook provides unified status update functionality across all shipment pages
 */
export const useSmartStatusUpdate = (shipmentId, initialShipment = null) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [updateResult, setUpdateResult] = useState(null);
    
    // Use ref to track if component is mounted to prevent state updates after unmount
    const isMountedRef = useRef(true);
    
    // Cloud function references
    const smartStatusUpdateRef = useRef(null);
    const forceStatusRefreshRef = useRef(null);
    
    // Initialize cloud function references
    useEffect(() => {
        smartStatusUpdateRef.current = httpsCallable(functions, 'smartStatusUpdate');
        forceStatusRefreshRef.current = httpsCallable(functions, 'forceStatusRefresh');
        
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    /**
     * Perform smart status update with automatic deduplication
     */
    const performSmartUpdate = useCallback(async (force = false) => {
        if (!shipmentId || !smartStatusUpdateRef.current) {
            console.warn('Cannot perform smart update: missing shipmentId or function reference');
            return null;
        }

        try {
            if (isMountedRef.current) {
                setLoading(true);
                setError(null);
            }

            console.log(`🔄 Performing smart status update for ${shipmentId}${force ? ' (forced)' : ''}`);

            const result = await smartStatusUpdateRef.current({
                shipmentId,
                force
            });

            if (isMountedRef.current) {
                const updateInfo = {
                    success: result.data.success,
                    updated: result.data.updated,
                    skipped: result.data.skipped,
                    statusChanged: result.data.statusChanged,
                    previousStatus: result.data.previousStatus,
                    newStatus: result.data.newStatus,
                    trackingUpdatesCount: result.data.trackingUpdatesCount || 0,
                    reason: result.data.reason,
                    timestamp: new Date().toISOString(),
                    forced: force
                };

                setUpdateResult(updateInfo);
                setLastUpdate(updateInfo.timestamp);

                console.log(`✅ Smart status update completed:`, updateInfo);
                return updateInfo;
            }

            return result.data;

        } catch (err) {
            console.error('Error in smart status update:', err);
            
            if (isMountedRef.current) {
                const errorMessage = err.message || 'Failed to update status';
                setError(errorMessage);
                
                return {
                    success: false,
                    error: errorMessage,
                    timestamp: new Date().toISOString(),
                    forced: force
                };
            }

            throw err;
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [shipmentId]);

    /**
     * Force status refresh (bypasses all rate limiting and intelligent checks)
     */
    const forceRefresh = useCallback(async () => {
        if (!shipmentId || !forceStatusRefreshRef.current) {
            console.warn('Cannot force refresh: missing shipmentId or function reference');
            return null;
        }

        try {
            if (isMountedRef.current) {
                setLoading(true);
                setError(null);
            }

            console.log(`🔄 Force refreshing status for ${shipmentId}`);

            const result = await forceStatusRefreshRef.current({
                shipmentId
            });

            if (isMountedRef.current) {
                const updateInfo = {
                    success: result.data.success,
                    updated: result.data.updated,
                    skipped: result.data.skipped,
                    statusChanged: result.data.statusChanged,
                    previousStatus: result.data.previousStatus,
                    newStatus: result.data.newStatus,
                    trackingUpdatesCount: result.data.trackingUpdatesCount || 0,
                    reason: result.data.reason,
                    timestamp: new Date().toISOString(),
                    forced: true,
                    message: result.data.message
                };

                setUpdateResult(updateInfo);
                setLastUpdate(updateInfo.timestamp);

                console.log(`✅ Force refresh completed:`, updateInfo);
                return updateInfo;
            }

            return result.data;

        } catch (err) {
            console.error('Error in force refresh:', err);
            
            if (isMountedRef.current) {
                const errorMessage = err.message || 'Failed to force refresh status';
                setError(errorMessage);
                
                return {
                    success: false,
                    error: errorMessage,
                    timestamp: new Date().toISOString(),
                    forced: true
                };
            }

            throw err;
        } finally {
            if (isMountedRef.current) {
                setLoading(false);
            }
        }
    }, [shipmentId]);

    /**
     * Check if shipment should have automatic status updates on page load
     */
    const shouldAutoUpdate = useCallback((shipment) => {
        if (!shipment) return false;

        // Don't auto-update final states
        const finalStates = ['delivered', 'cancelled', 'void'];
        if (finalStates.includes(shipment.status?.toLowerCase())) {
            return false;
        }

        // Don't auto-update very new shipments (less than 2 minutes old)
        const createdAt = shipment.createdAt?.toDate ? shipment.createdAt.toDate() : new Date(shipment.createdAt);
        const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
        
        if (createdAt > twoMinutesAgo) {
            return false;
        }

        // Check if last update was recent (within 5 minutes)
        const lastChecked = shipment.statusLastChecked?.toDate ? shipment.statusLastChecked.toDate() : 
                           (shipment.statusLastChecked ? new Date(shipment.statusLastChecked) : null);
        
        if (lastChecked) {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
            if (lastChecked > fiveMinutesAgo) {
                return false;
            }
        }

        return true;
    }, []);

    /**
     * Auto-update status when component mounts (if conditions are met)
     */
    useEffect(() => {
        if (!shipmentId || !initialShipment) return;

        // Only auto-update if conditions are met
        if (shouldAutoUpdate(initialShipment)) {
            console.log(`🔄 Auto-updating status for ${shipmentId} on page load`);
            
            // Small delay to allow component to fully mount
            const timeoutId = setTimeout(() => {
                if (isMountedRef.current) {
                    performSmartUpdate(false);
                }
            }, 1000);

            return () => clearTimeout(timeoutId);
        } else {
            console.log(`⏭️  Skipping auto-update for ${shipmentId} - conditions not met`);
        }
    }, [shipmentId, initialShipment, shouldAutoUpdate, performSmartUpdate]);

    /**
     * Get update status message for UI display
     */
    const getUpdateStatusMessage = useCallback(() => {
        if (loading) {
            return 'Checking for status updates...';
        }

        if (error) {
            return `Update failed: ${error}`;
        }

        if (updateResult) {
            if (updateResult.skipped) {
                return updateResult.reason || 'Status check skipped';
            }

            if (updateResult.statusChanged) {
                return `Status updated: ${updateResult.previousStatus} → ${updateResult.newStatus}`;
            }

            if (updateResult.trackingUpdatesCount > 0) {
                return `${updateResult.trackingUpdatesCount} new tracking updates`;
            }

            if (updateResult.updated) {
                return 'Status confirmed - no changes';
            }

            return 'Status check completed';
        }

        return null;
    }, [loading, error, updateResult]);

    /**
     * Clear update state
     */
    const clearUpdateState = useCallback(() => {
        if (isMountedRef.current) {
            setError(null);
            setUpdateResult(null);
        }
    }, []);

    /**
     * Get the appropriate status check interval based on shipment status
     */
    const getRecommendedCheckInterval = useCallback((shipment) => {
        if (!shipment) return null;

        const status = shipment.status?.toLowerCase();
        
        // Final states don't need checking
        if (['delivered', 'cancelled', 'void'].includes(status)) {
            return null;
        }

        // Active transit states need more frequent checking
        if (['in_transit', 'in transit', 'scheduled'].includes(status)) {
            return 15 * 60 * 1000; // 15 minutes
        }

        // Booked/pending states need less frequent checking
        if (['booked', 'pending', 'awaiting_shipment'].includes(status)) {
            return 30 * 60 * 1000; // 30 minutes
        }

        // Default interval
        return 30 * 60 * 1000; // 30 minutes
    }, []);

    return {
        // State
        loading,
        error,
        lastUpdate,
        updateResult,
        
        // Actions
        performSmartUpdate,
        forceRefresh,
        clearUpdateState,
        
        // Utilities
        shouldAutoUpdate,
        getUpdateStatusMessage,
        getRecommendedCheckInterval,
        
        // Status flags
        isUpdating: loading,
        hasError: !!error,
        hasUpdates: !!updateResult && (updateResult.updated || updateResult.statusChanged),
        wasSkipped: !!updateResult && updateResult.skipped
    };
};

/**
 * Hook for batch status updates (useful for Shipments page)
 */
export const useBatchStatusUpdate = () => {
    const [batchLoading, setBatchLoading] = useState(false);
    const [batchResults, setBatchResults] = useState({});
    const [batchErrors, setBatchErrors] = useState({});
    
    const isMountedRef = useRef(true);
    
    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    /**
     * Update multiple shipments with controlled concurrency
     */
    const updateMultipleShipments = useCallback(async (shipmentIds, options = {}) => {
        const { 
            maxConcurrent = 3, 
            force = false,
            onProgress = null 
        } = options;

        if (!shipmentIds || shipmentIds.length === 0) {
            return { results: {}, errors: {} };
        }

        try {
            if (isMountedRef.current) {
                setBatchLoading(true);
                setBatchResults({});
                setBatchErrors({});
            }

            const smartStatusUpdate = httpsCallable(functions, 'smartStatusUpdate');
            const results = {};
            const errors = {};

            // Process in batches with controlled concurrency
            for (let i = 0; i < shipmentIds.length; i += maxConcurrent) {
                const batch = shipmentIds.slice(i, i + maxConcurrent);
                
                const batchPromises = batch.map(async (shipmentId) => {
                    try {
                        const result = await smartStatusUpdate({
                            shipmentId,
                            force
                        });
                        
                        if (isMountedRef.current) {
                            setBatchResults(prev => ({
                                ...prev,
                                [shipmentId]: result.data
                            }));
                        }
                        
                        return { shipmentId, result: result.data };
                    } catch (error) {
                        console.error(`Error updating ${shipmentId}:`, error);
                        
                        if (isMountedRef.current) {
                            setBatchErrors(prev => ({
                                ...prev,
                                [shipmentId]: error.message
                            }));
                        }
                        
                        return { shipmentId, error: error.message };
                    }
                });

                const batchResults = await Promise.all(batchPromises);
                
                // Report progress
                if (onProgress && isMountedRef.current) {
                    onProgress({
                        completed: i + batch.length,
                        total: shipmentIds.length,
                        currentBatch: batchResults
                    });
                }

                // Small delay between batches to be respectful
                if (i + maxConcurrent < shipmentIds.length) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            return { results, errors };

        } catch (error) {
            console.error('Error in batch status update:', error);
            throw error;
        } finally {
            if (isMountedRef.current) {
                setBatchLoading(false);
            }
        }
    }, []);

    /**
     * Clear batch state
     */
    const clearBatchState = useCallback(() => {
        if (isMountedRef.current) {
            setBatchResults({});
            setBatchErrors({});
        }
    }, []);

    return {
        batchLoading,
        batchResults,
        batchErrors,
        updateMultipleShipments,
        clearBatchState,
        
        // Computed values
        completedCount: Object.keys(batchResults).length,
        errorCount: Object.keys(batchErrors).length,
        hasErrors: Object.keys(batchErrors).length > 0
    };
};

export default useSmartStatusUpdate; 