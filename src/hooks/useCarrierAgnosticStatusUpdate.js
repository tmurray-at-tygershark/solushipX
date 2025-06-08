import { useState, useCallback, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase';

/**
 * Carrier-agnostic status update hook
 * Provides unified interface for updating shipment statuses across all carriers
 */
export const useCarrierAgnosticStatusUpdate = () => {
    const [isUpdating, setIsUpdating] = useState(false);
    const [updateProgress, setUpdateProgress] = useState({
        total: 0,
        completed: 0,
        current: null,
        errors: []
    });
    const [results, setResults] = useState({});
    
    const abortControllerRef = useRef(null);

    /**
     * Determine carrier type and tracking identifier for a shipment
     */
    const getCarrierInfo = useCallback((shipment) => {
        const carrierName = shipment.selectedRate?.carrier || 
                           shipment.selectedRateRef?.carrier || 
                           shipment.carrier || '';
        
        // Enhanced eShipPlus detection logic (matching ShipmentDetail.jsx)
        const isEShipPlus = shipment.selectedRate?.displayCarrierId === 'ESHIPPLUS' ||
                           shipment.selectedRateRef?.displayCarrierId === 'ESHIPPLUS' ||
                           shipment.selectedRate?.sourceCarrierName === 'eShipPlus' ||
                           shipment.selectedRateRef?.sourceCarrierName === 'eShipPlus' ||
                           // Enhanced detection for freight carriers (which are typically eShipPlus)
                           carrierName.toLowerCase().includes('freight') ||
                           carrierName.toLowerCase().includes('fedex freight') ||
                           carrierName.toLowerCase().includes('road runner') ||
                           carrierName.toLowerCase().includes('estes') ||
                           carrierName.toLowerCase().includes('yrc') ||
                           carrierName.toLowerCase().includes('xpo') ||
                           carrierName.toLowerCase().includes('old dominion') ||
                           carrierName.toLowerCase().includes('saia') ||
                           carrierName.toLowerCase().includes('ltl') ||
                           carrierName.toLowerCase().includes('eshipplus');

        let masterCarrier = 'UNKNOWN';
        let trackingIdentifier = null;
        let trackingValue = null;

        if (isEShipPlus) {
            masterCarrier = 'ESHIPPLUS';
            trackingIdentifier = 'bookingReferenceNumber';
            
            // Comprehensive eShipPlus tracking identifier extraction (matching ShipmentDetail.jsx)
            trackingValue = shipment.bookingReferenceNumber ||
                           shipment.selectedRate?.BookingReferenceNumber ||
                           shipment.selectedRate?.bookingReferenceNumber ||
                           shipment.selectedRateRef?.BookingReferenceNumber ||
                           shipment.selectedRateRef?.bookingReferenceNumber ||
                           shipment.carrierTrackingData?.bookingReferenceNumber ||
                           shipment.carrierBookingConfirmation?.bookingReference ||
                           shipment.carrierBookingConfirmation?.confirmationNumber ||
                           shipment.carrierBookingConfirmation?.proNumber ||
                           shipment.trackingNumber;
                           
        } else if (carrierName.toLowerCase().includes('canpar')) {
            masterCarrier = 'CANPAR';
            trackingIdentifier = 'trackingNumber';
            
            // Enhanced Canpar tracking number extraction
            trackingValue = shipment.trackingNumber ||
                           shipment.selectedRate?.TrackingNumber ||
                           shipment.selectedRate?.Barcode ||
                           shipment.selectedRateRef?.TrackingNumber ||
                           shipment.selectedRateRef?.Barcode ||
                           shipment.carrierBookingConfirmation?.trackingNumber ||
                           shipment.carrierBookingConfirmation?.barcode;
                           
        } else if (carrierName.toLowerCase().includes('polaris')) {
            masterCarrier = 'POLARIS_TRANSPORTATION';
            trackingIdentifier = 'proNumber';
            
            // Enhanced Polaris tracking number extraction
            trackingValue = shipment.carrierBookingConfirmation?.proNumber ||
                           shipment.carrierBookingConfirmation?.confirmationNumber ||
                           shipment.trackingNumber ||
                           shipment.selectedRate?.proNumber ||
                           shipment.selectedRateRef?.proNumber;
        } else {
            // Generic carrier handling
            trackingIdentifier = 'trackingNumber';
            trackingValue = shipment.trackingNumber ||
                           shipment.carrierBookingConfirmation?.trackingNumber ||
                           shipment.carrierBookingConfirmation?.proNumber ||
                           shipment.selectedRate?.trackingNumber ||
                           shipment.selectedRateRef?.trackingNumber;
        }

        console.log(`🔍 Carrier detection for shipment ${shipment.shipmentID || shipment.id}:`, {
            carrierName,
            isEShipPlus,
            masterCarrier,
            trackingIdentifier,
            trackingValue,
            shipmentStatus: shipment.status
        });

        return {
            masterCarrier,
            carrierName,
            trackingIdentifier,
            trackingValue,
            isEShipPlus
        };
    }, []);

    /**
     * Check if a shipment is eligible for status updates
     */
    const isEligibleForUpdate = useCallback((shipment) => {
        const status = shipment.status?.toLowerCase();
        
        if (['delivered', 'cancelled', 'canceled', 'void', 'voided', 'draft'].includes(status)) {
            return false;
        }

        const carrierInfo = getCarrierInfo(shipment);
        return !!carrierInfo.trackingValue;
    }, [getCarrierInfo]);

    /**
     * Update status for a single shipment
     */
    const updateSingleShipment = useCallback(async (shipment, options = {}) => {
        const { force = false, timeout = 30000 } = options;

        if (!isEligibleForUpdate(shipment) && !force) {
            return {
                success: false,
                skipped: true,
                reason: 'Shipment not eligible for update',
                shipmentId: shipment.id
            };
        }

        try {
            const carrierInfo = getCarrierInfo(shipment);
            const smartStatusUpdate = httpsCallable(functions, 'smartStatusUpdate');
            
            const updatePayload = {
                shipmentId: shipment.id,
                masterCarrier: carrierInfo.masterCarrier,
                trackingIdentifier: carrierInfo.trackingIdentifier,
                trackingValue: carrierInfo.trackingValue,
                force
            };

            const result = await smartStatusUpdate(updatePayload);

            if (result.data?.success) {
                return {
                    success: true,
                    shipmentId: shipment.id,
                    previousStatus: result.data.previousStatus,
                    newStatus: result.data.newStatus,
                    statusChanged: result.data.statusChanged,
                    trackingUpdatesCount: result.data.trackingUpdatesCount || 0,
                    updated: true
                };
            } else {
                throw new Error(result.data?.error || 'Unknown error occurred');
            }

        } catch (error) {
            let errorMessage = error.message;
            if (error.code === 'functions/deadline-exceeded') {
                errorMessage = 'Request timed out';
            } else if (error.code === 'functions/unavailable') {
                errorMessage = 'Service temporarily unavailable';
            }

            return {
                success: false,
                shipmentId: shipment.id,
                error: errorMessage
            };
        }
    }, [getCarrierInfo, isEligibleForUpdate]);

    /**
     * Update multiple shipments with progress tracking
     */
    const updateMultipleShipments = useCallback(async (shipments, options = {}) => {
        const {
            maxConcurrent = 3,
            force = false,
            onProgress = null,
            retryFailedAttempts = 1
        } = options;

        setIsUpdating(true);
        setUpdateProgress({
            total: shipments.length,
            completed: 0,
            current: null,
            errors: []
        });
        setResults({});

        const batchResults = {};
        const errors = [];
        let completed = 0;

        try {
            const eligibleShipments = force ? shipments : shipments.filter(isEligibleForUpdate);
            
            for (let i = 0; i < eligibleShipments.length; i += maxConcurrent) {
                const batch = eligibleShipments.slice(i, i + maxConcurrent);
                
                setUpdateProgress(prev => ({
                    ...prev,
                    current: batch[0]?.shipmentID || batch[0]?.id
                }));

                if (onProgress) {
                    onProgress({
                        completed,
                        total: eligibleShipments.length,
                        currentBatch: batch
                    });
                }

                const batchPromises = batch.map(async (shipment) => {
                    for (let attempt = 0; attempt <= retryFailedAttempts; attempt++) {
                        try {
                            const result = await updateSingleShipment(shipment, { force });
                            if (result.success || result.skipped) {
                                return { shipment, result };
                            }
                        } catch (error) {
                            if (attempt === retryFailedAttempts) {
                                return {
                                    shipment,
                                    result: {
                                        success: false,
                                        shipmentId: shipment.id,
                                        error: error.message
                                    }
                                };
                            }
                            await new Promise(resolve => setTimeout(resolve, 1000));
                        }
                    }
                });

                const batchResults_ = await Promise.all(batchPromises);

                for (const { shipment, result } of batchResults_) {
                    batchResults[shipment.id] = result;
                    
                    if (!result.success && !result.skipped) {
                        errors.push({
                            shipmentId: shipment.id,
                            shipmentID: shipment.shipmentID || shipment.id,
                            error: result.error
                        });
                    }
                    
                    completed++;
                    setUpdateProgress(prev => ({
                        ...prev,
                        completed
                    }));
                }

                if (i + maxConcurrent < eligibleShipments.length) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            setResults(batchResults);

            return {
                success: true,
                results: batchResults,
                errors,
                totalProcessed: completed
            };

        } catch (error) {
            return {
                success: false,
                results: batchResults,
                errors: [...errors, { error: error.message }],
                totalProcessed: completed
            };
        } finally {
            setIsUpdating(false);
            setUpdateProgress(prev => ({ ...prev, current: null }));
        }
    }, [updateSingleShipment, isEligibleForUpdate]);

    /**
     * Cancel ongoing updates
     */
    const cancelUpdates = useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            setIsUpdating(false);
            setUpdateProgress({
                total: 0,
                completed: 0,
                current: null,
                errors: []
            });
        }
    }, []);

    /**
     * Clear all state
     */
    const clearState = useCallback(() => {
        setResults({});
        setUpdateProgress({
            total: 0,
            completed: 0,
            current: null,
            errors: []
        });
    }, []);

    /**
     * Get update statistics
     */
    const getUpdateStats = useCallback(() => {
        const resultValues = Object.values(results);
        const successful = resultValues.filter(r => r.success).length;
        const failed = resultValues.filter(r => !r.success && !r.skipped).length;
        const skipped = resultValues.filter(r => r.skipped).length;
        const statusChanged = resultValues.filter(r => r.statusChanged).length;

        return {
            total: resultValues.length,
            successful,
            failed,
            skipped,
            statusChanged,
            hasResults: resultValues.length > 0
        };
    }, [results]);

    return {
        // State
        isUpdating,
        updateProgress,
        results,
        
        // Actions
        updateSingleShipment,
        updateMultipleShipments,
        cancelUpdates,
        clearState,
        
        // Utilities
        getCarrierInfo,
        isEligibleForUpdate,
        getUpdateStats
    };
}; 