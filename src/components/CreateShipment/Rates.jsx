import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShipmentForm } from '../../contexts/ShipmentFormContext';
import ReactMarkdown from 'react-markdown';
import { Card, CardHeader, CardContent, Box, Typography, Collapse, IconButton, Link, CircularProgress, Button, Grid, Container, Paper } from '@mui/material';
import { Divider } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, updateDoc, serverTimestamp, collection, addDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import ShipmentRateRequestSummary from './ShipmentRateRequestSummary';
import { fetchMultiCarrierRates, getEligibleCarriers } from '../../utils/carrierEligibility';
import { validateUniversalRate } from '../../utils/universalDataModel';
import { toEShipPlusRequest } from '../../translators/eshipplus/translator';
import { toCanparRequest } from '../../translators/canpar/translator';
import { mapEShipPlusToUniversal, mapCanparToUniversal } from '../../utils/universalDataModel';

// Function to recursively remove undefined values from objects
const removeUndefinedValues = (obj) => {
    if (obj === null || typeof obj !== 'object') {
        return obj;
    }

    if (Array.isArray(obj)) {
        return obj.map(removeUndefinedValues).filter(item => item !== undefined);
    }

    const cleaned = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined) {
            cleaned[key] = removeUndefinedValues(value);
        }
    }
    return cleaned;
};

const Rates = ({ formData, onPrevious, onNext, activeDraftId }) => {
    const { updateFormSection, formData: contextFormData } = useShipmentForm();
    const [isLoading, setIsLoading] = useState(true);
    const [rates, setRates] = useState([]);
    const [filteredRates, setFilteredRates] = useState([]);
    const [selectedRate, setSelectedRate] = useState(formData.selectedRate || null);
    const [error, setError] = useState(null);
    const [sortBy, setSortBy] = useState('price');
    const [serviceFilter, setServiceFilter] = useState('all');
    const [showRateDetails, setShowRateDetails] = useState(false);
    const [loadingDots, setLoadingDots] = useState('');
    const [ratesLoaded, setRatesLoaded] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisResult, setAnalysisResult] = useState('');
    const [analysisError, setAnalysisError] = useState(null);
    const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(false);
    const navigate = useNavigate();

    // New state for storing the raw API response from the rating function
    const [rawRateApiResponseData, setRawRateApiResponseData] = useState(null);

    // Add state for multi-carrier loading details
    const [loadingCarriers, setLoadingCarriers] = useState([]);

    useEffect(() => {
        setSelectedRate(formData.selectedRate || null);
    }, [formData.selectedRate]);

    const styles = `
        .card {
            border: 1px solid #e9ecef;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .card-header {
            background-color: #212529;
            border-bottom: none;
            padding: 1rem 1.25rem;
        }

        .card-header h5 {
            font-size: 1.1rem;
            font-weight: 500;
            color: #fff;
            margin: 0;
        }

        .card-body {
            padding: 1.5rem !important;
        }

        .display-4 {
            font-size: 4.5rem !important;
            font-weight: 700;
            line-height: 1;
            color: #212529;
            margin: 0;
        }

        .bi-truck {
            color: #212529;
            font-size: 2rem !important;
            margin-right: 1rem;
        }

        .text-muted {
            color: #6c757d !important;
        }

        .small {
            font-size: 0.875rem;
        }

        .h4 {
            font-size: 1.75rem;
            font-weight: 600;
            color: #212529;
            margin-bottom: 0;
        }

        .btn-outline-primary {
            color: #0d6efd;
            border-color: #0d6efd;
            background-color: transparent;
            padding: 0.75rem 1.25rem;
            font-size: 0.9rem;
            font-weight: 500;
            border-radius: 6px;
            transition: all 0.2s;
        }

        .btn-outline-primary:hover {
            color: #fff;
            background-color: #0d6efd;
            border-color: #0d6efd;
        }

        .btn-outline-primary i {
            font-size: 1.1rem;
        }

        .rate-filters {
            background: #fff;
            padding: 1.25rem;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            margin-bottom: 2rem;
        }

        .rate-filters .form-label {
            font-size: 0.9rem;
            color: #212529;
            margin-bottom: 0.5rem;
            font-weight: 500;
        }

        .rate-filters .form-select {
            font-size: 0.9rem;
            border-color: #e9ecef;
            border-radius: 6px;
            padding: 0.5rem 1rem;
            height: calc(1.5em + 1rem + 2px);
        }

        /* Dark mode adjustments */
        [data-bs-theme="dark"] .card {
            background-color: #212529;
            border-color: #343a40;
        }

        [data-bs-theme="dark"] .card-header {
            background-color: #343a40;
        }

        [data-bs-theme="dark"] .display-4,
        [data-bs-theme="dark"] .h4,
        [data-bs-theme="dark"] .bi-truck {
            color: #fff;
        }

        [data-bs-theme="dark"] .text-muted {
            color: #adb5bd !important;
        }

        [data-bs-theme="dark"] .rate-filters {
            background-color: #212529;
            border-color: #343a40;
        }

        [data-bs-theme="dark"] .rate-filters .form-label {
            color: #fff;
        }

        [data-bs-theme="dark"] .rate-filters .form-select {
            background-color: #343a40;
            border-color: #495057;
            color: #fff;
        }

        .days-container {
            display: flex;
            align-items: center;
            margin-bottom: 1rem;
            gap: 1rem;
        }

        .days-container .fa-truck {
            font-size: 1.25rem;
            color: #212529;
            flex-shrink: 0;
        }

        .days-number {
            font-size: 4.5rem;
            font-weight: 700;
            line-height: 1;
            color: #212529;
            margin: 0;
        }

        .days-text {
            font-size: 1.25rem;
            color: #6c757d;
            margin-left: 0.25rem;
        }

        .guarantee-option {
            margin: 1rem 0;
            padding: 1rem 0;
            border-top: 1px solid #dee2e6;
        }

        .guarantee-option .form-check {
            margin: 0;
            padding: 0;
            display: flex;
            align-items: center;
        }

        .guarantee-option .form-check-input {
            margin-right: 0.75rem;
            width: 1.25rem;
            height: 1.25rem;
            cursor: pointer;
        }

        .guarantee-option .form-check-label {
            font-size: 1rem;
            color: #212529;
            cursor: pointer;
            user-select: none;
        }

        .total-charges {
            margin-bottom: 1rem;
        }

        .total-charges .label {
            font-size: 0.875rem;
            color: #6c757d;
            margin-bottom: 0.25rem;
            font-weight: 600;
        }

        .total-charges .amount {
            font-size: 1.75rem;
            font-weight: normal;
            color: #212529;
        }

        .total-charges .currency-code {
            font-size: 0.75rem;
            font-weight: normal;
            color: #6c757d;
            margin-left: 0.25rem;
            vertical-align: bottom;
            line-height: 1.5;
        }

        .text-muted.small {
            font-weight: 600;
        }

        .select-button {
            width: 100%;
            padding: 0.75rem;
            font-size: 1rem;
            font-weight: 500;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            margin-top: 1rem;
        }

        .rate-details-content {
            max-height: 0;
            overflow: hidden;
            transition: max-height 0.3s ease-out;
            border-top: 1px solid #dee2e6;
            margin-top: 1rem;
            opacity: 0;
        }

        .rate-details-content.show {
            max-height: 500px;
            padding-top: 1rem;
            transition: max-height 0.3s ease-in, opacity 0.3s ease-in;
            opacity: 1;
        }

        .rate-details-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        .rate-details-list li {
            display: flex;
            justify-content: space-between;
            padding: 0.5rem 0;
            border-bottom: 1px solid #dee2e6;
            font-size: 0.9rem;
        }

        .rate-details-list li:last-child {
            border-bottom: none;
        }

        .rate-details-list .charge-name {
            color: #6c757d;
            font-weight: 600;
        }

        .rate-details-list .charge-amount {
            font-weight: normal;
            color: #212529;
        }

        .btn-outline-primary.active {
            color: #fff;
            background-color: #0d6efd;
            border-color: #0d6efd;
        }

        [data-bs-theme="dark"] .fa-truck {
            color: #fff;
        }

        @keyframes spin {
            from {
                transform: rotate(0deg);
            }
            to {
                transform: rotate(360deg);
            }
        }

        .spinner-border {
            display: inline-block;
            width: 1rem;
            height: 1rem;
            vertical-align: text-bottom;
            border: 0.2em solid currentColor;
            border-right-color: transparent;
            border-radius: 50%;
            animation: spinner-border .75s linear infinite;
        }

        @keyframes spinner-border {
            to { transform: rotate(360deg); }
        }
        
        /* Navigation Buttons */
        .navigation-buttons {
            display: flex;
            justify-content: space-between;
            margin-top: 2rem;
            padding: 1rem 0;
        }
        
        .btn-navigation {
            padding: 0.75rem 1.5rem;
            font-size: 1rem;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }
    `;

    useEffect(() => {
        const styleSheet = document.createElement("style");
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);
        return () => {
            document.head.removeChild(styleSheet);
        };
    }, [styles]);

    const fetchRatesInternal = useCallback(async (currentFormDataForRateRequest) => {
        console.log('🌟 Multi-carrier fetchRatesInternal triggered');
        setIsLoading(true);
        setError(null);
        setRatesLoaded(false);

        try {
            // Use the new smart multi-carrier system with carrier-specific timeout configuration
            const multiCarrierResult = await fetchMultiCarrierRates(currentFormDataForRateRequest, {
                progressiveResults: true,   // Return results as they arrive
                includeFailures: true       // Include failed carriers in results for debugging
                // Note: Timeout values are now calculated automatically based on carrier-specific timeouts
                // eShipPlus: 28 seconds, Polaris: 25 seconds, Canpar: 20 seconds
            });

            console.log('Smart multi-carrier fetch result:', multiCarrierResult);

            if (multiCarrierResult.success && multiCarrierResult.rates.length > 0) {
                // Validate all rates
                const validRates = multiCarrierResult.rates.filter(rate => {
                    const validation = validateUniversalRate(rate);
                    if (!validation.valid) {
                        console.warn('Invalid rate found:', validation.errors, rate);
                        return false;
                    }
                    return true;
                });

                console.log(`✅ Multi-carrier fetch successful: ${validRates.length} valid rates from ${multiCarrierResult.summary.successfulCarriers} carriers`);
                console.log('Execution summary:', multiCarrierResult.summary);

                // Log carrier breakdown
                multiCarrierResult.results.forEach(result => {
                    if (result.success) {
                        console.log(`✅ ${result.carrier}: ${result.rates.length} rates (${result.responseTime}ms)`);
                    } else {
                        console.warn(`❌ ${result.carrier}: ${result.error} (${result.responseTime}ms)`);
                    }
                });

                setRates(validRates);
                setFilteredRates(validRates);
                updateFormSection('originalRateRequestData', currentFormDataForRateRequest);
                setRawRateApiResponseData(multiCarrierResult);
                setRatesLoaded(true);

            } else {
                // Handle case where no rates were found
                let errorMessage = 'No rates available from any carrier.';

                if (multiCarrierResult.results.length > 0) {
                    const errors = multiCarrierResult.results
                        .filter(r => !r.success)
                        .map(r => `${r.carrier}: ${r.error}`)
                        .join('; ');

                    if (errors) {
                        errorMessage += ` Carrier errors: ${errors}`;
                    }
                }

                console.error('❌ Multi-carrier fetch failed:', errorMessage);
                console.log('Failed results:', multiCarrierResult.results);

                // FALLBACK: Try single-carrier approach if multi-carrier completely fails
                console.warn('🔄 Attempting fallback to single-carrier rate fetch...');
                await attemptSingleCarrierFallback(currentFormDataForRateRequest);
            }

        } catch (error) {
            console.error("❌ Network or system error in multi-carrier fetch:", error);

            // FALLBACK: Try single-carrier approach on system error
            console.warn('🔄 Multi-carrier system error, attempting single-carrier fallback...');
            await attemptSingleCarrierFallback(currentFormDataForRateRequest);
        } finally {
            setIsLoading(false);
        }
    }, [updateFormSection]);

    // Fallback function for single-carrier rate fetching
    const attemptSingleCarrierFallback = async (currentFormDataForRateRequest) => {
        try {
            console.log('🔄 Executing single-carrier fallback...');

            // Determine carrier based on shipment type (original logic)
            const shipmentType = currentFormDataForRateRequest.shipmentInfo?.shipmentType || 'freight';
            const isFreight = shipmentType === 'freight';
            const isCourier = shipmentType === 'courier';

            console.log(`Fallback: Shipment type: ${shipmentType}, using ${isFreight ? 'eShipPlus' : 'Canpar'} carrier`);

            let rateRequestData;
            let functions;
            let getRatesFunction;
            let result;

            if (isFreight) {
                // Use eShipPlus for freight shipments
                rateRequestData = toEShipPlusRequest(currentFormDataForRateRequest);

                // Auto-fix missing contact fields for eShipPlus
                if (!rateRequestData.Origin.Contact || rateRequestData.Origin.Contact.trim() === '') {
                    rateRequestData.Origin.Contact = "Shipping Department";
                }
                if (!rateRequestData.Destination.Contact || rateRequestData.Destination.Contact.trim() === '') {
                    rateRequestData.Destination.Contact = "Receiving Department";
                }
                if (!rateRequestData.Origin.SpecialInstructions) {
                    rateRequestData.Origin.SpecialInstructions = 'none';
                }
                if (!rateRequestData.Destination.SpecialInstructions) {
                    rateRequestData.Destination.SpecialInstructions = 'none';
                }

                functions = getFunctions();
                getRatesFunction = httpsCallable(functions, 'getRatesEShipPlus');
                result = await getRatesFunction(rateRequestData);

            } else if (isCourier) {
                // Use Canpar for courier shipments
                rateRequestData = toCanparRequest(currentFormDataForRateRequest);

                functions = getFunctions();
                getRatesFunction = httpsCallable(functions, 'getRatesCanpar');
                result = await getRatesFunction(rateRequestData);
            }

            // Safety check for result
            if (!result || !result.data) {
                throw new Error('No result returned from carrier API');
            }

            const data = result.data;

            if (data.success && data.data) {
                const availableRates = data.data.availableRates || [];

                if (Array.isArray(availableRates) && availableRates.length > 0) {
                    const carrierType = isFreight ? 'ESHIPPLUS' : 'CANPAR';
                    const standardizedRates = availableRates.map(rate => {
                        let standardizedRate;
                        if (isFreight) {
                            standardizedRate = mapEShipPlusToUniversal(rate);
                        } else {
                            standardizedRate = mapCanparToUniversal(rate);
                        }

                        standardizedRate.sourceCarrier = {
                            key: carrierType,
                            name: isFreight ? 'eShipPlus' : 'Canpar',
                            system: isFreight ? 'eshipplus' : 'canpar'
                        };

                        standardizedRate.displayCarrier = {
                            name: standardizedRate.carrier?.name,
                            id: standardizedRate.carrier?.id,
                            scac: standardizedRate.carrier?.scac
                        };

                        return standardizedRate;
                    });

                    console.log(`✅ Fallback successful: ${standardizedRates.length} rates from ${carrierType}`);

                    setRates(standardizedRates);
                    setFilteredRates(standardizedRates);
                    updateFormSection('originalRateRequestData', rateRequestData);
                    setRawRateApiResponseData(data.data);
                    setRatesLoaded(true);
                    return;
                }
            }

            // If fallback also fails
            const errorMessage = data?.error || 'Failed to fetch rates even with fallback method.';
            console.error('❌ Fallback also failed:', errorMessage);
            setError(errorMessage);
            setRates([]);
            setFilteredRates([]);
            setRawRateApiResponseData(null);

        } catch (fallbackError) {
            console.error('❌ Fallback method also failed:', fallbackError);
            setError(`Both multi-carrier and fallback methods failed. ${fallbackError.message}`);
            setRates([]);
            setFilteredRates([]);
            setRawRateApiResponseData(null);
        }
    };

    useEffect(() => {
        console.log('useEffect for calling fetchRatesInternal triggered. Checking conditions...');
        const { shipFrom, shipTo, packages, shipmentInfo } = formData;

        if (
            shipFrom?.postalCode &&
            shipTo?.postalCode &&
            packages?.length > 0
        ) {
            console.log('Conditions met, calling fetchRatesInternal with current formData snapshot.');
            fetchRatesInternal({ shipFrom, shipTo, packages, shipmentInfo });
        } else {
            console.log('Conditions for fetchRatesInternal not met, or crucial formData parts not ready.');
            if (isLoading) setIsLoading(false);
        }
    }, [
        formData.shipFrom?.postalCode,
        formData.shipTo?.postalCode,
        JSON.stringify(formData.packages),
        formData.shipmentInfo?.shipmentDate,
        fetchRatesInternal
    ]);

    useEffect(() => {
        let filtered = [...rates];

        if (serviceFilter !== 'all') {
            filtered = filtered.filter(rate => {
                switch (serviceFilter) {
                    case 'guaranteed':
                        return rate.guaranteed;
                    case 'economy':
                        const serviceName = rate.service?.name || (typeof rate.service === 'string' ? rate.service : '');
                        return serviceName.toLowerCase().includes('economy') ||
                            serviceName.toLowerCase().includes('standard');
                    case 'express':
                        const serviceNameExpress = rate.service?.name || (typeof rate.service === 'string' ? rate.service : '');
                        return serviceNameExpress.toLowerCase().includes('express') ||
                            serviceNameExpress.toLowerCase().includes('priority');
                    default:
                        return true;
                }
            });
        }

        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'price':
                    return (a.pricing?.total || a.price || 0) - (b.pricing?.total || b.price || 0);
                case 'transit':
                    return (a.transit?.days || a.transitDays || 0) - (b.transit?.days || b.transitDays || 0);
                case 'carrier':
                    return (a.carrier?.name || a.carrier || '').localeCompare(b.carrier?.name || b.carrier || '');
                default:
                    return 0;
            }
        });

        setFilteredRates(filtered);
    }, [rates, sortBy, serviceFilter]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!selectedRate) {
            alert('Please select a rate before submitting');
            return;
        }
        const rateRef = formData.selectedRateRef || {
            rateId: selectedRate.id,
            carrier: selectedRate.carrier?.name || selectedRate.carrier,
            service: selectedRate.service?.name || (typeof selectedRate.service === 'string' ? selectedRate.service : 'Standard'),
            totalCharges: selectedRate.pricing?.total || selectedRate.totalCharges || selectedRate.price,
            transitDays: selectedRate.transit?.days || selectedRate.transitDays,
            estimatedDeliveryDate: selectedRate.transit?.estimatedDelivery || selectedRate.estimatedDeliveryDate,
            currency: selectedRate.pricing?.currency || selectedRate.currency || 'USD',
            guaranteed: selectedRate.transit?.guaranteed || selectedRate.guaranteed || false
        };
        onNext(rateRef);
    };

    const handleGuaranteeChange = (rate, checked) => {
        const guaranteeAmount = rate.pricing?.guarantee || rate.guaranteeCharge || 0;
        const currentPrice = rate.pricing?.total || rate.totalCharges || rate.price || 0;
        let updatedRateData;

        if (checked) {
            updatedRateData = {
                ...rate,
                pricing: {
                    ...rate.pricing,
                    total: currentPrice + guaranteeAmount
                },
                totalCharges: currentPrice + guaranteeAmount,
                guaranteed: true,
                transit: {
                    ...rate.transit,
                    guaranteed: true
                }
            };
        } else {
            updatedRateData = {
                ...rate,
                pricing: {
                    ...rate.pricing,
                    total: currentPrice - guaranteeAmount
                },
                totalCharges: currentPrice - guaranteeAmount,
                guaranteed: false,
                transit: {
                    ...rate.transit,
                    guaranteed: false
                }
            };
        }

        const updatedRates = rates.map(r => r.id === rate.id ? updatedRateData : r);
        setRates(updatedRates);
        setFilteredRates(updatedRates);

        if (selectedRate?.id === rate.id) {
            setSelectedRate(updatedRateData);
        }
    };

    const toggleAllRateDetails = () => {
        setShowRateDetails(!showRateDetails);
    };

    useEffect(() => {
        let interval;
        if (isLoading) {
            interval = setInterval(() => {
                setLoadingDots(prev => prev.length >= 3 ? '' : prev + '.');
            }, 500);
        }
        return () => clearInterval(interval);
    }, [isLoading]);

    // Update the loading effect to show eligible carriers
    useEffect(() => {
        if (isLoading && formData.shipFrom && formData.shipTo && formData.packages) {
            // Get eligible carriers to show in loading state
            const eligible = getEligibleCarriers({
                shipFrom: formData.shipFrom,
                shipTo: formData.shipTo,
                packages: formData.packages,
                shipmentInfo: formData.shipmentInfo
            });
            setLoadingCarriers(eligible.map(c => c.name));
        } else {
            setLoadingCarriers([]);
        }
    }, [isLoading, formData.shipFrom, formData.shipTo, formData.packages, formData.shipmentInfo]);

    // New function to save selected rate to shipmentRates and get its ID
    const saveRateToShipmentRatesCollection = async (universalRate, originalRateRequestForApi, rawFullRateApiResponse) => {
        const currentShipmentId = activeDraftId || contextFormData.draftFirestoreDocId;
        if (!currentShipmentId) {
            console.warn('No activeDraftId or draftFirestoreDocId available to save selected rate to shipmentRates');
            throw new Error('Shipment ID is missing, cannot save rate.');
        }

        try {
            console.log('Saving universal rate to shipmentRates collection:', universalRate);

            // Create a comprehensive rate document using the universal format
            const rateDocumentForCollection = {
                // Core identifiers
                shipmentId: currentShipmentId,
                rateId: universalRate.id,
                quoteId: universalRate.quoteId,

                // CRITICAL: Source carrier information for booking routing
                // This determines which carrier system endpoints to use for booking
                sourceCarrier: universalRate.sourceCarrier?.key || 'UNKNOWN',
                sourceCarrierName: universalRate.sourceCarrier?.name || 'Unknown',
                sourceCarrierSystem: universalRate.sourceCarrier?.system || 'unknown',

                // Display carrier information (what user sees)
                displayCarrier: universalRate.displayCarrier?.name || universalRate.carrier?.name,
                displayCarrierId: universalRate.displayCarrier?.id || universalRate.carrier?.id,
                displayCarrierScac: universalRate.displayCarrier?.scac || universalRate.carrier?.scac,

                // Legacy carrier fields (now for display only)
                carrier: universalRate.displayCarrier?.name || universalRate.carrier.name,
                carrierId: universalRate.carrier.id,
                carrierScac: universalRate.carrier.scac,
                carrierKey: universalRate.carrier.key,

                // Service information
                service: universalRate.service.name,
                serviceCode: universalRate.service.code,
                serviceType: universalRate.service.type,
                serviceMode: universalRate.service.mode,

                // Pricing information
                totalCharges: universalRate.pricing.total,
                freightCharges: universalRate.pricing.freight,
                fuelCharges: universalRate.pricing.fuel,
                serviceCharges: universalRate.pricing.service,
                accessorialCharges: universalRate.pricing.accessorial,
                insuranceCharges: universalRate.pricing.insurance,
                taxCharges: universalRate.pricing.tax,
                discountAmount: universalRate.pricing.discount,
                guaranteeCharge: universalRate.pricing.guarantee,
                currency: universalRate.pricing.currency,

                // Transit information
                transitTime: universalRate.transit.days,
                transitDays: universalRate.transit.days,
                transitHours: universalRate.transit.hours,
                businessDays: universalRate.transit.businessDays,
                estimatedDeliveryDate: universalRate.transit.estimatedDelivery,
                guaranteed: universalRate.transit.guaranteed,

                // Weight and dimensions
                billedWeight: universalRate.weight.billed,
                ratedWeight: universalRate.weight.rated,
                actualWeight: universalRate.weight.actual,
                dimensionalWeight: universalRate.weight.dimensional,
                weightUnit: universalRate.weight.unit,

                length: universalRate.dimensions.length,
                width: universalRate.dimensions.width,
                height: universalRate.dimensions.height,
                cubicFeet: universalRate.dimensions.cubicFeet,
                dimensionUnit: universalRate.dimensions.unit,

                // Service features
                residential: universalRate.features.residential,
                liftgate: universalRate.features.liftgate,
                insideDelivery: universalRate.features.insideDelivery,
                appointmentDelivery: universalRate.features.appointmentDelivery,
                signatureRequired: universalRate.features.signatureRequired,
                hazmat: universalRate.features.hazmat,
                freezable: universalRate.features.freezable,

                // Additional data
                billingDetails: universalRate.pricing.breakdown,
                guaranteeOptions: universalRate.transit.guaranteeOptions,

                // Store the complete universal rate object for booking
                universalRateData: universalRate,

                // Legacy fields for backward compatibility
                rawRateDetails: universalRate, // This is what the booking function looks for
                rawCarrierData: universalRate.raw || {},

                // Status and metadata
                status: 'selected_in_ui',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),

                // Raw request and response for auditing
                rawRateRequestPayload: originalRateRequestForApi || null,
                rawRateAPIResponse: rawFullRateApiResponse || null,

                // Unified structure flags
                _isUnifiedStructure: true,
                migrationNote: 'Created with unified ID structure'
            };

            // UNIFIED ID STRUCTURE: Use shipment ID as the rate document ID
            // Store in main collection using shipment ID as document ID
            const shipmentRatesRef = doc(db, 'shipmentRates', currentShipmentId);
            await setDoc(shipmentRatesRef, removeUndefinedValues(rateDocumentForCollection));

            // Also store in subcollection for unified structure
            const unifiedRateRef = doc(db, 'shipments', currentShipmentId, 'rates', currentShipmentId);
            await setDoc(unifiedRateRef, removeUndefinedValues(rateDocumentForCollection));

            console.log('Universal rate saved to shipmentRates with unified ID structure:', {
                shipmentId: currentShipmentId,
                rateId: currentShipmentId, // Now using shipment ID as rate ID
                unifiedPath: `shipments/${currentShipmentId}/rates/${currentShipmentId}`,
                legacyPath: `shipmentRates/${currentShipmentId}`
            });

            return currentShipmentId; // Return the unified ID (same as shipment ID)
        } catch (error) {
            console.error('Error saving universal rate to shipmentRates collection:', error);
            throw error; // Re-throw to be caught by handleRateSelect
        }
    };

    const handleRateSelect = async (rate) => {
        // rate here is the full universal rate object
        const newRateId = rate.id || rate.quoteId || rate.rateId;

        if (selectedRate?.id === newRateId) { // Deselect if clicking the same rate
            console.log('Deselecting rate.');
            setSelectedRate(null);
            updateFormSection('selectedRateDocumentId', null);
            updateFormSection('selectedRate', null);
        } else {
            console.log('New universal rate selected:', rate);
            setSelectedRate(rate); // Update local UI state
            updateFormSection('selectedRate', rate); // Update context with the full rate object for immediate use

            try {
                const newRateDocId = await saveRateToShipmentRatesCollection(rate, contextFormData.originalRateRequestData, rawRateApiResponseData);
                updateFormSection('selectedRateDocumentId', newRateDocId);
                console.log('Rate selection completed. Document ID:', newRateDocId);
            } catch (error) {
                console.error('Error saving rate to shipmentRates collection:', error);
                // Optionally, you could show an error message to the user here
                // For now, we'll just log the error and continue
            }
        }
    };

    const handleAnalyzeRates = async () => {
        if (!rates || rates.length === 0) {
            setAnalysisError('No rates available for analysis. Please calculate rates first.');
            return;
        }

        setIsAnalyzing(true);
        setAnalysisError(null);
        setAnalysisResult('');

        try {
            const response = await fetch('https://us-central1-solushipx.cloudfunctions.net/analyzeRatesWithAI', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ rates })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Failed to analyze rates: ${response.status} - ${errorText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let streamedResult = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(5));

                            if (!data.success && data.message) {
                                throw new Error(data.message || 'AI Analysis stream reported an error');
                            }
                            if (!data.success && !data.message) {
                                throw new Error('AI Analysis stream failed without a specific message.');
                            }

                            if (data.chunk) {
                                streamedResult += data.chunk;
                                setAnalysisResult(prev => prev + data.chunk);
                            }

                            if (data.done) {
                                console.log("AI Analysis stream finished.");
                                setIsAnalysisExpanded(true);
                                break;
                            }
                        } catch (e) {
                            console.error('Error parsing stream data:', e);
                            setAnalysisError('Error processing AI analysis response: ' + e.message);
                            setIsAnalyzing(false);
                            setIsAnalysisExpanded(false);
                            return;
                        }
                    }
                }
                if (lines.some(line => line.startsWith('data: ') && JSON.parse(line.slice(5)).done)) {
                    break;
                }
            }
        } catch (error) {
            console.error('AI Analysis Error:', error);
            setAnalysisError(error.message);
            setIsAnalysisExpanded(false);
        } finally {
            setIsAnalyzing(false);
            if (analysisResult && !analysisError) {
                setIsAnalysisExpanded(true);
            }
        }
    };

    const totalPackages = useMemo(() => {
        return formData.packages?.reduce((sum, pkg) => sum + (Number(pkg.packagingQuantity) || 0), 0) || 0;
    }, [formData.packages]);

    const totalWeight = useMemo(() => {
        const weight = formData.packages?.reduce((sum, pkg) => sum + (Number(pkg.weight) || 0), 0) || 0;
        return `${weight.toFixed(2)} lbs`;
    }, [formData.packages]);

    if (isLoading) {
        return (
            <Container maxWidth="lg" sx={{ py: 4 }}>
                <Grid container spacing={4} alignItems="center" justifyContent="center">
                    <Grid item xs={12} md={6}>
                        <ShipmentRateRequestSummary
                            origin={formData.shipFrom}
                            destination={formData.shipTo}
                            shipmentDetails={formData.shipmentInfo}
                            packages={formData.packages}
                        />
                    </Grid>
                    <Grid item xs={12} md={6} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
                        <CircularProgress size={50} sx={{ mb: 3 }} />
                        <Typography variant="h5" component="p" color="text.secondary" textAlign="center">
                            Fetching Multi-Carrier Rates{loadingDots}
                        </Typography>
                        <Typography variant="body2" color="text.tertiary" sx={{ mt: 1 }} textAlign="center">
                            Searching {loadingCarriers.length} eligible carriers simultaneously
                        </Typography>
                        {loadingCarriers.length > 0 && (
                            <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                                {loadingCarriers.map((carrier, index) => (
                                    <Typography
                                        key={index}
                                        variant="caption"
                                        sx={{
                                            px: 1.5,
                                            py: 0.5,
                                            backgroundColor: 'primary.light',
                                            color: 'primary.contrastText',
                                            borderRadius: 1,
                                            fontSize: '0.75rem'
                                        }}
                                    >
                                        {carrier}
                                    </Typography>
                                ))}
                            </Box>
                        )}
                    </Grid>
                </Grid>
                <Box
                    className="navigation-buttons"
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        width: '100%',
                        mt: 5,
                        pt: 2,
                        borderTop: (theme) => `1px solid ${theme.palette.divider}`
                    }}
                >
                    <Button
                        variant="outlined"
                        onClick={onPrevious}
                        type="button"
                    >
                        Previous
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={onNext}
                        disabled={true}
                        type="button"
                    >
                        Next
                    </Button>
                </Box>
            </Container>
        );
    }

    if (error) {
        return (
            <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
                <Typography color="error" gutterBottom>Error fetching rates: {error}</Typography>
                <div className="navigation-buttons" style={{ justifyContent: 'center' }}>
                    <Button variant="outlined" onClick={onPrevious} className="btn-navigation">Previous</Button>
                </div>
            </Container>
        );
    }

    if (!ratesLoaded) {
        return (
            <Container maxWidth="md" sx={{ py: 4, textAlign: 'center' }}>
                <Typography>Preparing to fetch rates...</Typography>
                <CircularProgress sx={{ mt: 2 }} />
                <div className="navigation-buttons" style={{ justifyContent: 'center' }}>
                    <Button variant="outlined" onClick={onPrevious} className="btn-navigation">Previous</Button>
                </div>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ py: 3 }}>
            <Typography variant="h4" component="h2" gutterBottom>
                Available Rates
            </Typography>

            <div className="form-section active" data-step="5">
                <div className="section-content">
                    <Paper elevation={1} sx={{ p: 2, mb: 3 }} className="rate-filters">
                        <Grid container spacing={2} alignItems="center">
                            <Grid item xs={12} sm={6} md={3}>
                                <Typography variant="subtitle2" gutterBottom className="form-label">Sort By</Typography>
                                <select
                                    className="form-select"
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    style={{ width: '100%' }}
                                >
                                    <option value="price">Price (Lowest First)</option>
                                    <option value="transit">Transit Time (Fastest First)</option>
                                    <option value="carrier">Carrier (A-Z)</option>
                                </select>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <Typography variant="subtitle2" gutterBottom className="form-label">Service Type</Typography>
                                <select
                                    className="form-select"
                                    value={serviceFilter}
                                    onChange={(e) => setServiceFilter(e.target.value)}
                                    style={{ width: '100%' }}
                                >
                                    <option value="all">All Services</option>
                                    <option value="guaranteed">Guaranteed Only</option>
                                    <option value="economy">Economy</option>
                                    <option value="express">Express</option>
                                </select>
                            </Grid>
                            <Grid item xs={12} md={6} sx={{ textAlign: { xs: 'left', md: 'right' }, mt: { xs: 2, md: 0 } }}>
                                <Button
                                    variant="outlined"
                                    onClick={toggleAllRateDetails}
                                    type="button"
                                    sx={{ mr: 1 }}
                                >
                                    {showRateDetails ? 'Hide Details' : 'Rate Details'}
                                </Button>
                                <Button
                                    variant="contained"
                                    onClick={handleAnalyzeRates}
                                    disabled={isAnalyzing || rates.length === 0}
                                    startIcon={<SmartToyIcon />}
                                    type="button"
                                >
                                    {isAnalyzing ? 'Analyzing...' : 'AI Analysis'}
                                </Button>
                            </Grid>
                        </Grid>
                    </Paper>

                    {ratesLoaded && filteredRates.length > 0 && isAnalysisExpanded && (
                        <Card sx={{ mb: 3, bgcolor: 'background.paper' }} elevation={2}>
                            <CardHeader
                                onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
                                sx={{
                                    cursor: 'pointer',
                                }}
                                title={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <SmartToyIcon />
                                        <Typography variant="h6">AI Rate Analysis</Typography>
                                    </Box>
                                }
                                action={
                                    <IconButton
                                        sx={{
                                            transform: isAnalysisExpanded ? 'rotate(180deg)' : 'none',
                                            transition: 'transform 0.3s'
                                        }}
                                    >
                                        <KeyboardArrowDownIcon />
                                    </IconButton>
                                }
                            />
                            <Collapse in={isAnalysisExpanded}>
                                <CardContent>
                                    {isAnalyzing ? (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
                                            <CircularProgress />
                                            <Typography>Analyzing rates{loadingDots}</Typography>
                                        </Box>
                                    ) : analysisResult ? (
                                        <Box>
                                            <ReactMarkdown
                                                components={{
                                                    h2: ({ ...props }) => (
                                                        <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }} {...props} />
                                                    ),
                                                    ul: ({ ...props }) => (
                                                        <Box component="ul" sx={{ pl: 2, mb: 1 }} {...props} />
                                                    ),
                                                    li: ({ ...props }) => (
                                                        <Box component="li" sx={{ mb: 0.5 }} {...props} />
                                                    ),
                                                    p: ({ ...props }) => (
                                                        <Typography variant="body1" sx={{ mb: 1 }} {...props} />
                                                    )
                                                }}
                                            >
                                                {analysisResult}
                                            </ReactMarkdown>
                                            <Divider sx={{ my: 2 }} />
                                            <Typography variant="caption" color="text.secondary">
                                                This analysis is based on current market rates and historical shipping data.
                                            </Typography>
                                        </Box>
                                    ) : (
                                        <Typography color="text.primary">
                                            Activate Soluship AI Analysis to see our real-time recommendations.{' '}
                                            <Link
                                                component="button"
                                                onClick={handleAnalyzeRates}
                                                sx={{
                                                    color: 'primary.main',
                                                    textDecoration: 'underline',
                                                    cursor: 'pointer',
                                                    '&:hover': {
                                                        color: 'primary.dark'
                                                    }
                                                }}
                                            >
                                                Click here
                                            </Link>
                                        </Typography>
                                    )}
                                </CardContent>
                            </Collapse>
                        </Card>
                    )}

                    {/* Multi-Carrier Summary Section */}
                    {ratesLoaded && rawRateApiResponseData && rawRateApiResponseData.summary && (
                        <Card sx={{ mb: 3, bgcolor: 'background.paper' }} elevation={2}>
                            <CardHeader
                                title={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="h6">Multi-Carrier Summary</Typography>
                                    </Box>
                                }
                            />
                            <CardContent>
                                <Grid container spacing={2}>
                                    <Grid item xs={6} sm={3}>
                                        <Typography variant="body2" color="text.secondary">Carriers Contacted</Typography>
                                        <Typography variant="h6">{rawRateApiResponseData.summary.totalCarriers}</Typography>
                                    </Grid>
                                    <Grid item xs={6} sm={3}>
                                        <Typography variant="body2" color="text.secondary">Successful</Typography>
                                        <Typography variant="h6" color="success.main">{rawRateApiResponseData.summary.successfulCarriers}</Typography>
                                    </Grid>
                                    <Grid item xs={6} sm={3}>
                                        <Typography variant="body2" color="text.secondary">Total Rates</Typography>
                                        <Typography variant="h6">{rawRateApiResponseData.summary.totalRates}</Typography>
                                    </Grid>
                                    <Grid item xs={6} sm={3}>
                                        <Typography variant="body2" color="text.secondary">Fetch Time</Typography>
                                        <Typography variant="h6">{(rawRateApiResponseData.summary.executionTime / 1000).toFixed(1)}s</Typography>
                                    </Grid>
                                </Grid>

                                {rawRateApiResponseData.results && rawRateApiResponseData.results.length > 0 && (
                                    <Box sx={{ mt: 2 }}>
                                        <Typography variant="subtitle2" sx={{ mb: 1 }}>Carrier Results:</Typography>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                            {rawRateApiResponseData.results.map((result, index) => (
                                                <Typography
                                                    key={index}
                                                    variant="caption"
                                                    sx={{
                                                        px: 1.5,
                                                        py: 0.5,
                                                        backgroundColor: result.success ? 'success.light' : 'error.light',
                                                        color: result.success ? 'success.contrastText' : 'error.contrastText',
                                                        borderRadius: 1,
                                                        fontSize: '0.75rem'
                                                    }}
                                                    title={result.success ? `${result.rates.length} rates in ${result.responseTime}ms` : result.error}
                                                >
                                                    {result.success ? '✅' : '❌'} {result.carrier}
                                                    {result.success && ` (${result.rates.length})`}
                                                </Typography>
                                            ))}
                                        </Box>
                                    </Box>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {analysisError && (
                        <Paper elevation={2} sx={{ p: 2, my: 2, backgroundColor: 'error.lighter', color: 'error.dark' }}>
                            <Typography>{analysisError}</Typography>
                        </Paper>
                    )}

                    {ratesLoaded && filteredRates.length === 0 && !error && (
                        <Paper sx={{ p: 3, textAlign: 'center', my: 3 }} elevation={2}>
                            <Typography variant="h6">No Rates Found</Typography>
                            <Typography>No shipping rates are currently available for the provided details. Please check the addresses and package information, or try again later.</Typography>
                        </Paper>
                    )}

                    <Grid container spacing={3}>
                        {filteredRates.map((rate) => (
                            <Grid item xs={12} md={6} lg={4} key={rate.quoteId}>
                                <Card className="card mb-4" elevation={2}>
                                    <CardHeader
                                        title={
                                            <Box>
                                                <Typography variant="h6" component="div">
                                                    {rate.displayCarrier?.name || rate.carrier?.name || rate.carrierName || 'Unknown Carrier'}
                                                </Typography>
                                            </Box>
                                        }
                                        sx={{ pb: 0 }}
                                    />
                                    <CardContent>
                                        <div className="days-container">
                                            <i className="fa-light fa-truck"></i>
                                            <div>
                                                <span className="days-number">{rate.transit?.days !== undefined ? rate.transit.days : 'N/A'}</span>
                                                <span className="days-text">days</span>
                                            </div>
                                        </div>
                                        <div className="mb-3">
                                            <div className="text-muted small">Est. Delivery: {rate.transit?.estimatedDelivery || 'N/A'}</div>
                                        </div>
                                        <div className="rate-details">
                                            <div className="rate-price">
                                                <span className="price-amount">${rate.pricing?.total?.toFixed(2) || '0.00'}</span>
                                                <span className="price-currency"> {rate.pricing?.currency || 'USD'}</span>
                                            </div>
                                            <div className="rate-carrier">
                                                <span className="carrier-name">{rate.displayCarrier?.name || rate.carrier?.name || 'Unknown Carrier'}</span>
                                            </div>
                                        </div>
                                        {(rate.transit?.guaranteed || rate.guaranteedService) && (rate.pricing?.guarantee || rate.guaranteeCharge) !== undefined && (
                                            <div className="guarantee-option">
                                                <div className="form-check">
                                                    <input
                                                        type="checkbox"
                                                        className="form-check-input"
                                                        id={`guarantee-${rate.quoteId || rate.rateId}`}
                                                        checked={selectedRate?.quoteId === (rate.quoteId || rate.rateId) && selectedRate.guaranteed}
                                                        onChange={(e) => handleGuaranteeChange(rate, e.target.checked)}
                                                    />
                                                    <label className="form-check-label" htmlFor={`guarantee-${rate.quoteId || rate.rateId}`}>
                                                        Add Guarantee (+${(rate.pricing?.guarantee || rate.guaranteeCharge || 0).toFixed(2)})
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                        <div className={`rate-details-content ${showRateDetails ? 'show' : ''}`}>
                                            <ul className="rate-details-list">
                                                <li>
                                                    <span className="charge-name">Service Mode</span>
                                                    <span className="charge-amount">{rate.serviceMode || rate.service?.name || (typeof rate.service === 'string' ? rate.service : 'N/A')}</span>
                                                </li>
                                                <li>
                                                    <span className="charge-name">Source System</span>
                                                    <span className="charge-amount">{rate.sourceCarrier?.name || 'Unknown'}</span>
                                                </li>

                                                {/* Enhanced billing details display */}
                                                {rate.pricing?.billingDetails && rate.pricing.billingDetails.length > 0 ? (
                                                    // Show detailed billing breakdown if available (Canpar)
                                                    rate.pricing.billingDetails.map((detail, index) => (
                                                        <li key={index}>
                                                            <span className="charge-name">{detail.name}</span>
                                                            <span className="charge-amount">${detail.amount.toFixed(2)}</span>
                                                        </li>
                                                    ))
                                                ) : (
                                                    // Fallback to standard display for other carriers
                                                    <>
                                                        <li>
                                                            <span className="charge-name">Freight Charges</span>
                                                            <span className="charge-amount">${(rate.pricing?.baseRate || rate.pricing?.freight || rate.freightCharges || 0).toFixed(2)}</span>
                                                        </li>
                                                        <li>
                                                            <span className="charge-name">Fuel Charges</span>
                                                            <span className="charge-amount">${(rate.pricing?.fuelSurcharge || rate.pricing?.fuel || rate.fuelCharges || 0).toFixed(2)}</span>
                                                        </li>
                                                        <li>
                                                            <span className="charge-name">Service Charges</span>
                                                            <span className="charge-amount">${(rate.pricing?.serviceCharges || rate.pricing?.service || rate.serviceCharges || 0).toFixed(2)}</span>
                                                        </li>
                                                        {(rate.pricing?.accessorialCharges || rate.pricing?.accessorial || rate.accessorialCharges || 0) > 0 && (
                                                            <li>
                                                                <span className="charge-name">Accessorial Charges</span>
                                                                <span className="charge-amount">${(rate.pricing?.accessorialCharges || rate.pricing?.accessorial || rate.accessorialCharges || 0).toFixed(2)}</span>
                                                            </li>
                                                        )}
                                                        {(rate.pricing?.taxes?.total || rate.pricing?.tax || rate.taxCharges || 0) > 0 && (
                                                            <li>
                                                                <span className="charge-name">Tax Charges</span>
                                                                <span className="charge-amount">${(rate.pricing?.taxes?.total || rate.pricing?.tax || rate.taxCharges || 0).toFixed(2)}</span>
                                                            </li>
                                                        )}
                                                    </>
                                                )}

                                                {/* Total line */}
                                                <li style={{ borderTop: '2px solid #dee2e6', paddingTop: '0.5rem', marginTop: '0.5rem', fontWeight: 'bold' }}>
                                                    <span className="charge-name">Total</span>
                                                    <span className="charge-amount">${(rate.pricing?.totalCharges || rate.pricing?.total || rate.totalCharges || rate.price || 0).toFixed(2)}</span>
                                                </li>
                                            </ul>
                                        </div>
                                        <Button
                                            variant={selectedRate?.quoteId === (rate.quoteId || rate.rateId) ? 'contained' : 'outlined'}
                                            onClick={() => handleRateSelect(rate)}
                                            type="button"
                                            fullWidth
                                            sx={{ mt: 2 }}
                                        >
                                            {selectedRate?.quoteId === (rate.quoteId || rate.rateId) ? 'Selected' : 'Select'}
                                        </Button>
                                    </CardContent>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                </div>
                <Box
                    className="navigation-buttons"
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        width: '100%',
                        mt: 3,
                        pt: 2,
                        borderTop: (theme) => `1px solid ${theme.palette.divider}`
                    }}
                >
                    <Button
                        variant="outlined"
                        onClick={onPrevious}
                        type="button"
                    >
                        Previous
                    </Button>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSubmit}
                        disabled={!selectedRate}
                        type="button"
                    >
                        Next
                    </Button>
                </Box>
            </div>
        </Container>
    );
};

export default Rates; 