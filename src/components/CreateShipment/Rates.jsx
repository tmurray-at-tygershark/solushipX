import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShipmentForm } from '../../contexts/ShipmentFormContext';
import { useCompany } from '../../contexts/CompanyContext';
import ReactMarkdown from 'react-markdown';
import { Card, CardHeader, CardContent, Box, Typography, Collapse, IconButton, Link, CircularProgress, Button, Grid, Container, Paper } from '@mui/material';
import { Divider } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, updateDoc, serverTimestamp, collection, addDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import ShipmentRateRequestSummary from './ShipmentRateRequestSummary';
import CarrierLoadingDisplay from './CarrierLoadingDisplay';
import RateErrorDisplay from './RateErrorDisplay';
import EnhancedRateCard from './EnhancedRateCard';
import CarrierStatsPopover from './CarrierStatsPopover';
import { fetchMultiCarrierRates, getEligibleCarriers, getAllCarriers } from '../../utils/carrierEligibility';
import { smartWarmupCarriers, preemptiveWarmup } from '../../utils/warmupCarriers';
import { validateUniversalRate } from '../../utils/universalDataModel';
import { toEShipPlusRequest } from '../../translators/eshipplus/translator';
import { toCanparRequest } from '../../translators/canpar/translator';
import { mapEShipPlusToUniversal, mapCanparToUniversal } from '../../utils/universalDataModel';
import markupEngine from '../../utils/markupEngine';

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
    const { companyData } = useCompany();
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
    const [completedCarriers, setCompletedCarriers] = useState([]);
    const [failedCarriers, setFailedCarriers] = useState([]);

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

    /**
     * Get company's connected and enabled carriers for rate fetching
     * @param {Object} shipmentData - Shipment data for additional filtering
     * @returns {Array} - Array of enabled carrier configurations
     */
    const getCompanyEligibleCarriers = useCallback(async (shipmentData) => {
        console.log('🏢 Getting company-specific eligible carriers with enhanced system...');

        // Get company's connected carriers
        const companyConnectedCarriers = companyData?.connectedCarriers || [];
        console.log('Company connected carriers:', companyConnectedCarriers);

        if (companyConnectedCarriers.length === 0) {
            console.warn('❌ No connected carriers found for company');
            return [];
        }

        // Filter to only enabled carriers with active connections
        const enabledConnectedCarriers = companyConnectedCarriers.filter(cc =>
            cc.enabled === true && cc.carrierID
        );

        console.log('Enabled connected carriers:', enabledConnectedCarriers);

        if (enabledConnectedCarriers.length === 0) {
            console.warn('❌ No enabled carriers found for company');
            return [];
        }

        // Get all eligible carriers from enhanced system (database + static)
        const systemEligibleCarriers = await getEligibleCarriers(shipmentData);

        console.log('🌐 System eligible carriers:', systemEligibleCarriers.map(c => c.name));

        // Map company carrier IDs to system carrier keys
        const carrierIdToKeyMap = {
            'ESHIPPLUS': 'ESHIPPLUS',
            'CANPAR': 'CANPAR',
            'POLARISTRANSPORTATION': 'POLARISTRANSPORTATION'
        };

        // Filter system eligible carriers to only include company's connected carriers
        const companyEligibleCarriers = systemEligibleCarriers.filter(systemCarrier => {
            // Check if company has this carrier connected
            const isConnectedByCompany = enabledConnectedCarriers.some(cc =>
                carrierIdToKeyMap[cc.carrierID] === systemCarrier.key || // Static carriers
                cc.carrierID === systemCarrier.key // Database carriers
            );

            if (isConnectedByCompany) {
                console.log(`✅ ${systemCarrier.name} is connected and eligible for company`);
                return true;
            } else {
                console.log(`❌ ${systemCarrier.name} not connected by company`);
                return false;
            }
        });

        console.log(`\n🌟 Final Company Eligible Carriers: ${companyEligibleCarriers.length} carriers:`,
            companyEligibleCarriers.map(c => `${c.name} (P${c.priority}, ${c.isCustomCarrier ? 'DB' : 'Static'})`));

        return companyEligibleCarriers;
    }, [companyData]);

    const fetchRatesInternal = useCallback(async (currentFormDataForRateRequest) => {
        console.log('🌟 Multi-carrier fetchRatesInternal triggered');
        setIsLoading(true);
        setError(null);
        setRatesLoaded(false);
        setCompletedCarriers([]);
        setFailedCarriers([]);

        try {
            // Get company-specific eligible carriers
            const companyEligibleCarriers = await getCompanyEligibleCarriers(currentFormDataForRateRequest);

            if (companyEligibleCarriers.length === 0) {
                setError('No carriers available for your route and shipment details');
                setRates([]);
                setFilteredRates([]);
                setRawRateApiResponseData(null);
                return;
            }

            console.log(`Using ${companyEligibleCarriers.length} company-configured carriers:`,
                companyEligibleCarriers.map(c => c.name));

            // Preemptive warmup for better cold start handling
            try {
                console.log('🔥 Starting smart carrier warmup...');
                const warmupResult = await smartWarmupCarriers(currentFormDataForRateRequest);
                if (warmupResult.success) {
                    console.log('🔥 Carrier warmup completed:', warmupResult.results);
                } else {
                    console.log('⚠️ Carrier warmup had issues but continuing...');
                }
            } catch (warmupError) {
                console.warn('⚠️ Carrier warmup failed, continuing with rate fetch:', warmupError.message);
            }

            // Use the company-specific carrier list in multi-carrier fetching with enhanced timeout handling
            const multiCarrierResult = await fetchMultiCarrierRates(currentFormDataForRateRequest, {
                customEligibleCarriers: companyEligibleCarriers, // Pass company carriers
                progressiveResults: true,   // Return results as they arrive
                includeFailures: true,      // Include failed carriers in results for debugging
                timeout: 60000,            // 60 second total timeout (increased for cold starts)
                retryAttempts: 2,          // Retry failed requests
                retryDelay: 3000,          // 3 second delay between retries
                onProgress: (progressData) => {
                    console.log('🔄 Rate fetching progress:', progressData);
                    // Update carrier status as results come in
                    if (progressData.completed) {
                        setCompletedCarriers(prev => [...prev, { name: progressData.carrier, rates: progressData.rates?.length || 0 }]);
                    }
                    if (progressData.failed) {
                        setFailedCarriers(prev => [...prev, { name: progressData.carrier, error: progressData.error }]);
                    }
                    if (progressData.retrying) {
                        console.log(`🔄 Retrying ${progressData.carrier} (attempt ${progressData.attempt}/${progressData.maxAttempts})`);
                    }
                }
            });

            console.log('Company-filtered multi-carrier fetch result:', multiCarrierResult);

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

                console.log(`✅ Company multi-carrier fetch successful: ${validRates.length} valid rates from ${multiCarrierResult.summary.successfulCarriers} carriers`);
                console.log('Execution summary:', multiCarrierResult.summary);

                // Update carrier status from results
                const completedCarriersList = multiCarrierResult.results
                    .filter(result => result.success)
                    .map(result => ({ name: result.carrier, rates: result.rates?.length || 0 }));

                const failedCarriersList = multiCarrierResult.results
                    .filter(result => !result.success)
                    .map(result => ({ name: result.carrier, error: result.error }));

                setCompletedCarriers(completedCarriersList);
                setFailedCarriers(failedCarriersList);

                setRates(validRates);
                setFilteredRates(validRates);
                updateFormSection('originalRateRequestData', currentFormDataForRateRequest);
                setRawRateApiResponseData(multiCarrierResult);
                setRatesLoaded(true);

            } else {
                // Handle case where no rates were found from company carriers
                let errorMessage = 'No rates available from your configured carriers.';

                if (multiCarrierResult.results.length > 0) {
                    const errors = multiCarrierResult.results
                        .filter(r => !r.success)
                        .map(r => `${r.carrier}: ${r.error}`)
                        .join('; ');

                    if (errors) {
                        errorMessage += ` Carrier errors: ${errors}`;
                    }

                    // Update failed carriers list
                    const failedCarriersList = multiCarrierResult.results
                        .filter(result => !result.success)
                        .map(result => ({ name: result.carrier, error: result.error }));
                    setFailedCarriers(failedCarriersList);
                }

                console.error('❌ Company multi-carrier fetch failed:', errorMessage);
                console.log('Failed results:', multiCarrierResult.results);

                // For company-specific carriers, don't fall back to single carrier - show the error
                setError(errorMessage);
                setRates([]);
                setFilteredRates([]);
                setRawRateApiResponseData(null);
            }

        } catch (error) {
            console.error("❌ Network or system error in company multi-carrier fetch:", error);
            setError(`Failed to fetch rates from your configured carriers: ${error.message}`);
            setRates([]);
            setFilteredRates([]);
            setRawRateApiResponseData(null);
        } finally {
            setIsLoading(false);
        }
    }, [updateFormSection, getCompanyEligibleCarriers]);

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

    // Update the loading effect to show company eligible carriers
    useEffect(() => {
        if (isLoading && formData.shipFrom && formData.shipTo && formData.packages) {
            // Get company's eligible carriers to show in loading state
            getCompanyEligibleCarriers({
                shipFrom: formData.shipFrom,
                shipTo: formData.shipTo,
                packages: formData.packages,
                shipmentInfo: formData.shipmentInfo
            }).then(companyCarriers => {
                setLoadingCarriers(companyCarriers.map(c => c.name));
            }).catch(error => {
                console.error('Error getting loading carriers:', error);
                setLoadingCarriers([]);
            });
        } else {
            setLoadingCarriers([]);
        }
    }, [isLoading, formData.shipFrom, formData.shipTo, formData.packages, formData.shipmentInfo, getCompanyEligibleCarriers]);

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

            try {
                // Apply markup to the rate BEFORE storing it
                console.log('🔧 Applying markup to selected rate...');
                const rateWithMarkup = await markupEngine.applyMarkupToRate(rate, companyData?.companyID);
                console.log('✅ Markup applied to selected rate:', rateWithMarkup);

                setSelectedRate(rateWithMarkup); // Update local UI state with markup-processed rate
                updateFormSection('selectedRate', rateWithMarkup); // Update context with the markup-processed rate

                // Save the markup-processed rate to database
                const newRateDocId = await saveRateToShipmentRatesCollection(rateWithMarkup, contextFormData.originalRateRequestData, rawRateApiResponseData);
                updateFormSection('selectedRateDocumentId', newRateDocId);
                console.log('Rate selection completed with markup. Document ID:', newRateDocId);
            } catch (error) {
                console.error('Error applying markup or saving rate:', error);

                // Fallback: Use original rate if markup fails
                console.warn('Falling back to original rate without markup');
                setSelectedRate(rate);
                updateFormSection('selectedRate', rate);

                try {
                    const newRateDocId = await saveRateToShipmentRatesCollection(rate, contextFormData.originalRateRequestData, rawRateApiResponseData);
                    updateFormSection('selectedRateDocumentId', newRateDocId);
                    console.log('Rate selection completed without markup. Document ID:', newRateDocId);
                } catch (saveError) {
                    console.error('Error saving rate to shipmentRates collection:', saveError);
                }
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
        const weight = formData.packages?.reduce((sum, pkg) => sum + ((Number(pkg.weight) || 0) * (Number(pkg.packagingQuantity) || 1)), 0) || 0;
        return `${weight.toFixed(2)} lbs`;
    }, [formData.packages]);



    if (isLoading) {
        return (
            <Container maxWidth="lg" sx={{ py: 4 }}>
                <Grid container spacing={4} alignItems="flex-start" justifyContent="center">
                    <Grid item xs={12} md={6}>
                        <ShipmentRateRequestSummary
                            origin={formData.shipFrom}
                            destination={formData.shipTo}
                            shipmentDetails={formData.shipmentInfo}
                            packages={formData.packages}
                        />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <CarrierLoadingDisplay
                            loadingCarriers={loadingCarriers}
                            completedCarriers={completedCarriers}
                            failedCarriers={failedCarriers}
                            isLoading={isLoading}
                        />
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
            <Container maxWidth="lg" sx={{ py: 4 }}>
                <Grid container spacing={4}>
                    <Grid item xs={12} md={6}>
                        <ShipmentRateRequestSummary
                            origin={formData.shipFrom}
                            destination={formData.shipTo}
                            shipmentDetails={formData.shipmentInfo}
                            packages={formData.packages}
                        />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <RateErrorDisplay
                            error={error}
                            failedCarriers={failedCarriers}
                            onRetry={() => {
                                setError(null);
                                fetchRatesInternal({
                                    shipFrom: formData.shipFrom,
                                    shipTo: formData.shipTo,
                                    packages: formData.packages,
                                    shipmentInfo: formData.shipmentInfo
                                });
                            }}
                            onEditShipment={onPrevious}
                            onContactSupport={() => {
                                window.open('mailto:support@solushipx.com?subject=Rate Fetching Issue', '_blank');
                            }}
                        />
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
                    <Button variant="outlined" onClick={onPrevious} type="button">
                        Previous
                    </Button>
                    <Button variant="contained" color="primary" onClick={onNext} disabled={true} type="button">
                        Next
                    </Button>
                </Box>
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

            <div className="form-section active" data-step="5">
                <div className="section-content">
                    <Box sx={{ mb: 3 }}>
                        <Grid container spacing={3} alignItems="center">
                            <Grid item xs={12} sm={6} md={3}>
                                <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                    Sort By
                                </Typography>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        fontSize: '12px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        backgroundColor: '#fff',
                                        color: '#374151'
                                    }}
                                >
                                    <option value="price">Price (Lowest First)</option>
                                    <option value="transit">Transit Time (Fastest First)</option>
                                    <option value="carrier">Carrier (A-Z)</option>
                                </select>
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                    Service Type
                                </Typography>
                                <select
                                    value={serviceFilter}
                                    onChange={(e) => setServiceFilter(e.target.value)}
                                    style={{
                                        width: '100%',
                                        padding: '8px 12px',
                                        fontSize: '12px',
                                        border: '1px solid #d1d5db',
                                        borderRadius: '6px',
                                        backgroundColor: '#fff',
                                        color: '#374151'
                                    }}
                                >
                                    <option value="all">All Services</option>
                                    <option value="guaranteed">Guaranteed Only</option>
                                    <option value="economy">Economy</option>
                                    <option value="express">Express</option>
                                </select>
                            </Grid>
                            <Grid item xs={12} md={6} sx={{ textAlign: { xs: 'left', md: 'right' } }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-start', md: 'flex-end' }, gap: 1 }}>
                                    <CarrierStatsPopover rawRateApiResponseData={rawRateApiResponseData} />
                                    <Button
                                        variant="contained"
                                        onClick={handleAnalyzeRates}
                                        disabled={isAnalyzing || rates.length === 0}
                                        type="button"
                                        sx={{
                                            fontSize: '12px',
                                            textTransform: 'none',
                                            px: 3,
                                            py: 1,
                                            backgroundColor: '#6366f1',
                                            '&:hover': {
                                                backgroundColor: '#4f46e5'
                                            },
                                            '&:disabled': {
                                                backgroundColor: '#9ca3af'
                                            }
                                        }}
                                    >
                                        {isAnalyzing ? 'Analyzing...' : 'Help Me Choose'}
                                    </Button>
                                </Box>
                            </Grid>
                        </Grid>
                    </Box>

                    {ratesLoaded && filteredRates.length > 0 && (analysisResult || isAnalyzing) && (
                        <Card sx={{ mb: 3, bgcolor: 'background.paper' }} elevation={2}>
                            <CardHeader
                                onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
                                sx={{
                                    cursor: 'pointer',
                                }}
                                title={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <SmartToyIcon />
                                        <Typography variant="h6" sx={{ fontSize: '12px' }}>Shipment Analysis</Typography>
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
                                                        <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 'bold', fontSize: '14px' }} {...props} />
                                                    ),
                                                    h3: ({ ...props }) => (
                                                        <Typography variant="subtitle1" sx={{ mt: 1.5, mb: 1, fontWeight: 600, fontSize: '13px' }} {...props} />
                                                    ),
                                                    ul: ({ ...props }) => (
                                                        <Box component="ul" sx={{ pl: 2, mb: 1, fontSize: '12px' }} {...props} />
                                                    ),
                                                    li: ({ ...props }) => (
                                                        <Box component="li" sx={{ mb: 0.5, fontSize: '12px' }} {...props} />
                                                    ),
                                                    p: ({ ...props }) => (
                                                        <Typography variant="body2" sx={{ mb: 1, fontSize: '12px', lineHeight: 1.5 }} {...props} />
                                                    ),
                                                    strong: ({ ...props }) => (
                                                        <Box component="strong" sx={{ fontWeight: 600, fontSize: '12px' }} {...props} />
                                                    )
                                                }}
                                            >
                                                {analysisResult}
                                            </ReactMarkdown>
                                            <Divider sx={{ my: 2 }} />
                                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>
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



                    {analysisError && (
                        <Paper elevation={2} sx={{ p: 2, my: 2, backgroundColor: 'error.lighter', color: 'error.dark' }}>
                            <Typography>{analysisError}</Typography>
                        </Paper>
                    )}

                    {ratesLoaded && filteredRates.length === 0 && !error && (
                        <RateErrorDisplay
                            error="No rates available from your configured carriers."
                            failedCarriers={failedCarriers}
                            onRetry={() => {
                                fetchRatesInternal({
                                    shipFrom: formData.shipFrom,
                                    shipTo: formData.shipTo,
                                    packages: formData.packages,
                                    shipmentInfo: formData.shipmentInfo
                                });
                            }}
                            onEditShipment={onPrevious}
                            onContactSupport={() => {
                                window.open('mailto:support@solushipx.com?subject=No Rates Available', '_blank');
                            }}
                        />
                    )}

                    <Grid container spacing={3}>
                        {filteredRates.map((rate) => (
                            <Grid item xs={12} md={6} lg={4} key={rate.quoteId}>
                                <EnhancedRateCard
                                    rate={rate}
                                    isSelected={selectedRate?.quoteId === (rate.quoteId || rate.rateId)}
                                    onSelect={handleRateSelect}
                                    showDetails={showRateDetails}
                                    onGuaranteeChange={handleGuaranteeChange}
                                />
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
                        sx={{
                            px: 6,
                            py: 1.5,
                            backgroundColor: '#10B981',
                            minWidth: '160px',
                            '&:hover': {
                                backgroundColor: '#059669'
                            },
                            '&:disabled': {
                                backgroundColor: '#cccccc'
                            }
                        }}
                        endIcon={<ArrowForwardIcon />}
                    >
                        Next
                    </Button>
                </Box>
            </div>
        </Container>
    );
};

export default Rates; 