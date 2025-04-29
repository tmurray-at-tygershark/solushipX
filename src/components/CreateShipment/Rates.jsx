import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShipmentForm } from '../../contexts/ShipmentFormContext';
import ReactMarkdown from 'react-markdown';
import { Card, CardHeader, CardContent, Box, Typography, Collapse, IconButton, Link, CircularProgress, Button, Grid } from '@mui/material';
import { Divider } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { getFunctions, httpsCallable } from 'firebase/functions';

const Rates = ({ formData, onPrevious, onNext }) => {
    const { updateFormSection } = useShipmentForm();
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
    const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(true);
    const navigate = useNavigate();

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

    const fetchRates = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            setRatesLoaded(false);

            // Use a simple booking reference
            const bookingRef = "shipment 123";

            // Determine shipment bill type and booking reference type based on shipment type
            const shipmentType = formData.shipmentInfo.shipmentType || 'courier';
            const shipmentBillType = 'DefaultLogisticsPlus';
            const bookingReferenceNumberType = 'Shipment';

            const rateRequestData = {
                bookingReferenceNumber: bookingRef,
                bookingReferenceNumberType: bookingReferenceNumberType,
                shipmentBillType: shipmentBillType,
                shipmentDate: formData.shipmentInfo.shipmentDate
                    ? new Date(formData.shipmentInfo.shipmentDate).toISOString()
                    : new Date().toISOString(),
                pickupWindow: {
                    earliest: formData.shipmentInfo.earliestPickup || "09:00",
                    latest: formData.shipmentInfo.latestPickup || "17:00"
                },
                deliveryWindow: {
                    earliest: formData.shipmentInfo.earliestDelivery || "09:00",
                    latest: formData.shipmentInfo.latestDelivery || "17:00"
                },
                fromAddress: {
                    company: formData.shipFrom.company || "",
                    street: formData.shipFrom.street || "",
                    street2: formData.shipFrom.street2 || "",
                    postalCode: formData.shipFrom.zip || formData.shipFrom.postalCode || "",
                    city: formData.shipFrom.city || "",
                    state: formData.shipFrom.state || "",
                    country: formData.shipFrom.country || "US",
                    contactName: formData.shipFrom.contactName || "",
                    contactPhone: formData.shipFrom.contactPhone || "",
                    contactEmail: formData.shipFrom.contactEmail || "",
                    specialInstructions: formData.shipFrom.specialInstructions || "none"
                },
                toAddress: {
                    company: formData.shipTo.company || "",
                    street: formData.shipTo.street || "",
                    street2: formData.shipTo.street2 || "",
                    postalCode: formData.shipTo.postalCode || "",
                    city: formData.shipTo.city || "",
                    state: formData.shipTo.state || "",
                    country: formData.shipTo.country || "US",
                    contactName: formData.shipTo.contactName || "",
                    contactPhone: formData.shipTo.contactPhone || "",
                    contactEmail: formData.shipTo.contactEmail || "",
                    specialInstructions: formData.shipTo.specialInstructions || "none"
                },
                items: formData.packages.map(pkg => ({
                    name: pkg.description || "Package",
                    weight: parseFloat(pkg.weight) || 1,
                    length: parseInt(pkg.length) || 12,
                    width: parseInt(pkg.width) || 12,
                    height: parseInt(pkg.height) || 12,
                    quantity: parseInt(pkg.quantity) || 1,
                    freightClass: String(pkg.freightClass || "50"),
                    value: parseFloat(pkg.value || "0"),
                    stackable: pkg.stackable || false
                }))
            };

            // Validate postal codes before making the API call
            if (!rateRequestData.fromAddress.postalCode || rateRequestData.fromAddress.postalCode.trim() === '') {
                throw new Error('Missing or invalid postal code in origin address');
            }

            if (!rateRequestData.toAddress.postalCode || rateRequestData.toAddress.postalCode.trim() === '') {
                throw new Error('Missing or invalid postal code in destination address');
            }

            // Validate contact names before making the API call
            if (!rateRequestData.fromAddress.contactName || rateRequestData.fromAddress.contactName.trim() === '') {
                throw new Error('Missing or invalid contact name in origin address');
            }

            if (!rateRequestData.toAddress.contactName || rateRequestData.toAddress.contactName.trim() === '') {
                throw new Error('Missing or invalid contact name in destination address');
            }

            // Validate special instructions before making the API call
            if (!rateRequestData.fromAddress.specialInstructions ||
                (rateRequestData.fromAddress.specialInstructions.trim() === '' &&
                    rateRequestData.fromAddress.specialInstructions !== 'none')) {
                throw new Error('Missing or invalid specialInstructions in origin address');
            }

            if (!rateRequestData.toAddress.specialInstructions ||
                (rateRequestData.toAddress.specialInstructions.trim() === '' &&
                    rateRequestData.toAddress.specialInstructions !== 'none')) {
                throw new Error('Missing or invalid specialInstructions in destination address');
            }

            // Add detailed console logging
            console.group('🚢 Rate Request Data');
            console.log('📅 Shipment Details:', {
                bookingReference: rateRequestData.bookingReferenceNumber,
                bookingReferenceType: rateRequestData.bookingReferenceNumberType,
                shipmentBillType: rateRequestData.shipmentBillType,
                shipmentDate: rateRequestData.shipmentDate,
                pickupWindow: rateRequestData.pickupWindow,
                deliveryWindow: rateRequestData.deliveryWindow
            });

            console.log('📍 From Address:', rateRequestData.fromAddress);
            console.log('📍 To Address:', rateRequestData.toAddress);

            console.log('📦 Packages:', rateRequestData.items.map(item => ({
                name: item.name,
                weight: item.weight,
                dimensions: `${item.length}x${item.width}x${item.height}`,
                quantity: item.quantity,
                freightClass: item.freightClass,
                value: item.value,
                stackable: item.stackable
            })));

            console.groupEnd();

            // Initialize Firebase Functions and get the callable function
            const functions = getFunctions();
            const getRatesFunction = httpsCallable(functions, 'getRatesEShipPlus');

            // Call the function
            const result = await getRatesFunction(rateRequestData);
            const data = result.data;

            // --- BEGIN LOG --- 
            console.log("Raw Rate Response Object:", data);
            // --- END LOG --- 

            // Process the response data
            if (data.success && data.data) {
                // Add detailed logging
                console.log('Response structure:', {
                    hasData: !!data.data,
                    dataKeys: Object.keys(data.data),
                    dataType: typeof data.data,
                    isString: typeof data.data === 'string',
                    isObject: typeof data.data === 'object'
                });

                try {
                    // The response is already parsed JSON from the backend
                    const rateData = data.data;
                    console.log('Rate Data:', rateData);

                    // Get available rates from the transformed response
                    const availableRates = rateData?.availableRates || [];

                    if (availableRates.length === 0) {
                        setError('No rates available for this shipment. Please check your shipment details and try again.');
                        setIsLoading(false);
                        return;
                    }

                    console.log('Available Rates:', availableRates);

                    // Transform the rate data
                    const transformedRates = availableRates.map(rate => {
                        // Calculate the total days for delivery
                        const transitTimeDisplay = String(rate.transitTime || '1-2 business days');
                        const transitDays = transitTimeDisplay.match(/\d+/)?.[0] || '1';

                        // Access EstimatedDeliveryDate - use exact case from sample, provide fallback
                        const rawDeliveryDate = rate.EstimatedDeliveryDate || rate.estimatedDeliveryDate; // Check both cases
                        const formattedDeliveryDate = rawDeliveryDate ? rawDeliveryDate.split('T')[0] : 'N/A';
                        console.log(`Rate ID ${rate.id}, Raw Date: ${rawDeliveryDate}, Formatted Date: ${formattedDeliveryDate}`); // Add log for debugging

                        // Create a standardized object for each rate
                        return {
                            id: rate.id || `rate-${Math.random().toString(36).substring(2, 9)}`,
                            carrier: rate.carrierName || rate.originalRate?.carrierName || 'Unknown',
                            service: rate.service || 'Standard',
                            transitDays: parseInt(transitDays),
                            transitTime: transitTimeDisplay,
                            estimatedDeliveryDate: formattedDeliveryDate,
                            price: parseFloat(rate.totalCharges) || 0,
                            currency: rate.currency || 'USD',
                            guaranteeOption: rate.guaranteed || false,
                            guaranteedOptionAvailable: rate.guaranteedOptionAvailable || false,
                            guaranteedPrice: rate.guaranteedPrice || null,
                            charges: rate.charges || [],
                            originalRate: rate,
                            carrierCode: rate.carrierCode || '',
                            serviceCode: rate.serviceCode || '',
                            packageCounts: rate.packageCounts || {}
                        };
                    });

                    console.log('Transformed Rates:', transformedRates);

                    setRates(transformedRates);
                    setFilteredRates(transformedRates);
                    setRatesLoaded(true);
                } catch (parseError) {
                    console.error('Error parsing rate data:', parseError);
                    setError(`Error parsing rate data: ${parseError.message}`);
                }
            } else {
                const errorMessage = data.error || 'Failed to retrieve shipping rates. Please try again.';
                console.error('API Error:', errorMessage);
                setError(errorMessage);
            }
        } catch (error) {
            console.error('Error fetching rates:', error);
            setError(`Error fetching rates: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    }, [formData]);

    useEffect(() => {
        if (formData && Object.keys(formData.shipFrom || {}).length > 0 && Object.keys(formData.shipTo || {}).length > 0) {
            fetchRates();
        }
    }, [formData, fetchRates]);

    useEffect(() => {
        let filtered = [...rates];

        // Apply service filter
        if (serviceFilter !== 'all') {
            filtered = filtered.filter(rate => {
                switch (serviceFilter) {
                    case 'guaranteed':
                        return rate.guaranteed;
                    case 'economy':
                        return rate.service.toLowerCase().includes('economy') ||
                            rate.service.toLowerCase().includes('standard');
                    case 'express':
                        return rate.service.toLowerCase().includes('express') ||
                            rate.service.toLowerCase().includes('priority');
                    default:
                        return true;
                }
            });
        }

        // Apply sorting
        filtered.sort((a, b) => {
            switch (sortBy) {
                case 'price':
                    return (a.price || 0) - (b.price || 0);
                case 'transit':
                    return (a.transitDays || 0) - (b.transitDays || 0);
                case 'carrier':
                    return (a.carrier || '').localeCompare(b.carrier || '');
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
        onNext();
    };

    const handleGuaranteeChange = (rate, checked) => {
        let updatedRateData;
        if (checked) {
            updatedRateData = {
                ...rate,
                rate: rate.rate + (rate.guaranteeCharge || 0),
                guaranteed: true
            };
        } else {
            updatedRateData = {
                ...rate,
                rate: rate.rate - (rate.guaranteeCharge || 0),
                guaranteed: false
            };
        }
        setSelectedRate(updatedRateData);
        updateFormSection('selectedRate', updatedRateData);
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

    const handleRateSelect = (rate) => {
        if (selectedRate?.id === rate.id) {
            setSelectedRate(null);
            updateFormSection('selectedRate', null);
        } else {
            setSelectedRate(rate);
            updateFormSection('selectedRate', rate);
            onNext();
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
                throw new Error(`Failed to analyze rates: ${response.status}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(5));

                            if (!data.success) {
                                throw new Error(data.message || 'Analysis failed');
                            }

                            if (data.chunk) {
                                setAnalysisResult(prev => {
                                    const newResult = prev + data.chunk;
                                    return newResult;
                                });
                            }

                            if (data.done) {
                                setIsAnalyzing(false);
                                break;
                            }
                        } catch (e) {
                            console.error('Error parsing stream data:', e);
                            setAnalysisError('Error processing AI analysis response');
                        }
                    }
                }
            }
        } catch (error) {
            console.error('AI Analysis Error:', error);
            setAnalysisError(error.message);
            setIsAnalyzing(false);
        }
    };

    // --- Helper to calculate total packages ---
    const totalPackages = useMemo(() => {
        return formData.packages?.reduce((sum, pkg) => sum + (Number(pkg.packagingQuantity) || 0), 0) || 0;
    }, [formData.packages]);

    // --- Helper to calculate total weight ---
    const totalWeight = useMemo(() => {
        const weight = formData.packages?.reduce((sum, pkg) => sum + (Number(pkg.weight) || 0), 0) || 0;
        // Assuming imperial units for display here, adjust if unitSystem is tracked
        return `${weight.toFixed(2)} lbs`;
    }, [formData.packages]);

    return (
        <div className="container mt-4">
            <h2>Available Rates</h2>
            <div className="form-section active" data-step="5">
                <div className="section-content">
                    {error && (
                        <div className="alert alert-danger" role="alert">
                            {error}
                        </div>
                    )}

                    {!ratesLoaded ? (
                        <Box sx={{ textAlign: 'center', padding: '20px', width: '100%' }}>
                            {/* Enhanced Shipment Summary Card */}
                            <Card variant="outlined" sx={{ mb: 3, textAlign: 'left', bgcolor: 'grey.50', borderRadius: 2 }}>
                                <CardContent sx={{ p: { xs: 1.5, sm: 2 } }}>
                                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 500, fontSize: '1.1rem' }}>
                                        Fetching Rates For:
                                    </Typography>
                                    {/* --- Location Info --- */}
                                    <Grid container spacing={{ xs: 1, sm: 2 }} sx={{ mb: 1 }}>
                                        <Grid item xs={12} md={6}>
                                            <Typography variant="overline" display="block" color="text.secondary" sx={{ lineHeight: 1.2, mb: 0.5 }}>Origin</Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                {formData.shipFrom?.company || formData.shipFrom?.name || 'N/A'}<br />
                                                {formData.shipFrom?.street || 'N/A'}
                                                {formData.shipFrom?.street2 && <><br />{formData.shipFrom.street2}</>}<br />
                                                {formData.shipFrom?.city || 'N/A'}, {formData.shipFrom?.state || 'N/A'} {formData.shipFrom?.postalCode || ''}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={12} md={6}>
                                            <Typography variant="overline" display="block" color="text.secondary" sx={{ lineHeight: 1.2, mb: 0.5 }}>Destination</Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                {formData.shipTo?.company || formData.shipTo?.name || 'N/A'}<br />
                                                {formData.shipTo?.street || 'N/A'}
                                                {formData.shipTo?.street2 && <><br />{formData.shipTo.street2}</>}<br />
                                                {formData.shipTo?.city || 'N/A'}, {formData.shipTo?.state || 'N/A'} {formData.shipTo?.postalCode || ''}
                                            </Typography>
                                        </Grid>
                                    </Grid>
                                    <Divider sx={{ my: 1.5 }} />
                                    {/* --- Shipment Info --- */}
                                    <Grid container spacing={{ xs: 1, sm: 2 }} sx={{ mb: 1 }}>
                                        <Grid item xs={6} sm={3}>
                                            <Typography variant="caption" display="block" color="text.secondary">Ship Date</Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                {formData.shipmentInfo?.shipmentDate || 'N/A'}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={6} sm={3}>
                                            <Typography variant="caption" display="block" color="text.secondary">Type</Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                {formData.shipmentInfo?.shipmentType?.toUpperCase() || 'N/A'}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <Typography variant="caption" display="block" color="text.secondary">Reference</Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {formData.shipmentInfo?.shipperReferenceNumber || '-'}
                                            </Typography>
                                        </Grid>
                                    </Grid>
                                    <Divider sx={{ my: 1.5 }} />
                                    {/* --- Package Summary --- */}
                                    <Typography variant="overline" display="block" color="text.secondary" sx={{ lineHeight: 1.2, mb: 1 }}>Packages</Typography>
                                    {formData.packages?.map((pkg, index) => (
                                        <Box key={pkg.id || index} sx={{ mb: index < formData.packages.length - 1 ? 1.5 : 0 }}>
                                            <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
                                                {pkg.packagingQuantity || 1} x {pkg.itemDescription || `Package ${index + 1}`}
                                            </Typography>
                                            <Grid container spacing={{ xs: 1, sm: 2 }}>
                                                <Grid item xs={6} sm={4}>
                                                    <Typography variant="caption" display="block" color="text.secondary">Dimensions (LxWxH)</Typography>
                                                    <Typography variant="body2">
                                                        {`${pkg.length || '?'}" x ${pkg.width || '?'}" x ${pkg.height || '?'}"`}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={6} sm={3}>
                                                    <Typography variant="caption" display="block" color="text.secondary">Weight</Typography>
                                                    <Typography variant="body2">{`${pkg.weight || '?'} lbs`}</Typography>
                                                </Grid>
                                                <Grid item xs={6} sm={3}>
                                                    <Typography variant="caption" display="block" color="text.secondary">Freight Class</Typography>
                                                    <Typography variant="body2">{pkg.freightClass || 'N/A'}</Typography>
                                                </Grid>
                                            </Grid>
                                        </Box>
                                    ))}
                                    {/* Display total weight/pieces if needed, but individual breakdown is often more useful */}
                                    {/*
                                     <Grid container spacing={{ xs: 1, sm: 2 }} sx={{ mt: 1 }}>
                                         <Grid item xs={6} sm={3}>
                                            <Typography variant="caption" display="block" color="text.secondary">Pieces</Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{totalPackages}</Typography>
                                        </Grid>
                                        <Grid item xs={6} sm={3}>
                                            <Typography variant="caption" display="block" color="text.secondary">Total Weight</Typography>
                                            <Typography variant="body2" sx={{ fontWeight: 500 }}>{totalWeight}</Typography>
                                        </Grid>
                                    </Grid>
                                    */}
                                </CardContent>
                            </Card>

                            {/* Loading Animation */}
                            <img
                                src="/animations/truck.gif"
                                alt="Loading rates"
                                style={{ width: '200px', height: '200px', margin: '10px auto 0 auto' }} // Smaller size
                            />
                            <Typography sx={{ marginTop: '5px', color: 'text.secondary' }}>
                                <CircularProgress size={16} sx={{ mr: 1, verticalAlign: 'middle' }} />
                                Searching All Carrier Rates{loadingDots}
                            </Typography>
                        </Box>
                    ) : (
                        <>
                            <div className="rate-filters mb-3">
                                <div className="row align-items-center">
                                    <div className="col-md-3">
                                        <label className="form-label">Sort By</label>
                                        <select
                                            className="form-select"
                                            value={sortBy}
                                            onChange={(e) => setSortBy(e.target.value)}
                                        >
                                            <option value="price">Price (Lowest First)</option>
                                            <option value="transit">Transit Time (Fastest First)</option>
                                            <option value="carrier">Carrier (A-Z)</option>
                                        </select>
                                    </div>
                                    <div className="col-md-3">
                                        <label className="form-label">Service Type</label>
                                        <select
                                            className="form-select"
                                            value={serviceFilter}
                                            onChange={(e) => setServiceFilter(e.target.value)}
                                        >
                                            <option value="all">All Services</option>
                                            <option value="guaranteed">Guaranteed Only</option>
                                            <option value="economy">Economy</option>
                                            <option value="express">Express</option>
                                        </select>
                                    </div>
                                    <div className="col-md-6 text-end">
                                        <button
                                            type="button"
                                            className={`btn btn-outline-primary rate-details-toggle me-2 ${showRateDetails ? 'active' : ''}`}
                                            onClick={toggleAllRateDetails}
                                        >
                                            <i className={`bi bi-list-${showRateDetails ? 'check' : 'ul'}`}></i>
                                            {showRateDetails ? ' Hide Details' : ' Rate Details'}
                                        </button>
                                        <button
                                            className="btn btn-primary"
                                            onClick={handleAnalyzeRates}
                                            disabled={isAnalyzing || rates.length === 0}
                                        >
                                            <i className="fas fa-robot"></i> {isAnalyzing ? 'Analyzing...' : 'AI Analysis'}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <Card sx={{ mb: 3, backgroundColor: '#f5f5f5' }}>
                                <CardHeader
                                    onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
                                    sx={{
                                        backgroundColor: '#000000',
                                        color: '#ffffff',
                                        cursor: 'pointer',
                                        '&:hover': {
                                            backgroundColor: '#333333'
                                        },
                                        '& .MuiCardHeader-title': {
                                            color: '#ffffff'
                                        },
                                        '& .MuiCardHeader-action': {
                                            color: '#ffffff'
                                        }
                                    }}
                                    title={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#ffffff' }}>
                                            <SmartToyIcon sx={{ color: '#ffffff' }} />
                                            <Typography variant="h5" sx={{ color: '#ffffff' }}>AI Rate Analysis</Typography>
                                        </Box>
                                    }
                                    action={
                                        <IconButton
                                            sx={{
                                                color: '#ffffff',
                                                transform: isAnalysisExpanded ? 'rotate(180deg)' : 'none',
                                                transition: 'transform 0.3s'
                                            }}
                                        >
                                            <KeyboardArrowDownIcon sx={{ color: '#ffffff' }} />
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
                                                        h2: ({ node, ...props }) => (
                                                            <Typography variant="h6" sx={{ mt: 2, mb: 1, fontWeight: 'bold' }} {...props} />
                                                        ),
                                                        ul: ({ node, ...props }) => (
                                                            <Box component="ul" sx={{ pl: 2, mb: 1 }} {...props} />
                                                        ),
                                                        li: ({ node, ...props }) => (
                                                            <Box component="li" sx={{ mb: 0.5 }} {...props} />
                                                        ),
                                                        p: ({ node, ...props }) => (
                                                            <Typography variant="body1" sx={{ mb: 1 }} {...props} />
                                                        )
                                                    }}
                                                >
                                                    {analysisResult}
                                                </ReactMarkdown>
                                                <Divider sx={{ my: 2 }} />
                                                <Typography variant="subtitle2" color="text.secondary">
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
                                                        color: '#1976d2',
                                                        textDecoration: 'underline',
                                                        cursor: 'pointer',
                                                        '&:hover': {
                                                            color: '#1565c0'
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

                            {analysisError && (
                                <div className="alert alert-danger mb-4">
                                    <i className="fas fa-exclamation-circle me-2"></i>
                                    {analysisError}
                                </div>
                            )}

                            <div className="row g-3">
                                {filteredRates.map((rate) => (
                                    <div key={rate.id} className="col-md-4">
                                        <div className="card mb-4">
                                            <div className="card-header">
                                                <h5 className="mb-0">{rate.carrier}</h5>
                                            </div>
                                            <div className="card-body">
                                                <div className="days-container">
                                                    <i className="fa-light fa-truck"></i>
                                                    <div>
                                                        <span className="days-number">{rate.transitDays}</span>
                                                        <span className="days-text">days</span>
                                                    </div>
                                                </div>

                                                <div className="mb-3">
                                                    <div className="text-muted small">Est. Delivery: {rate.estimatedDeliveryDate}</div>
                                                </div>

                                                <div className="total-charges">
                                                    <div className="label">Total Charges</div>
                                                    <div className="amount">${rate.price.toFixed(2)} <span className="currency-code">{rate.currency}</span></div>
                                                </div>

                                                {rate.guaranteedOptionAvailable && (
                                                    <div className="guarantee-option">
                                                        <div className="form-check">
                                                            <input
                                                                type="checkbox"
                                                                className="form-check-input"
                                                                id={`guarantee-${rate.id}`}
                                                                checked={selectedRate?.id === rate.id && selectedRate.guaranteed}
                                                                onChange={(e) => handleGuaranteeChange(rate, e.target.checked)}
                                                            />
                                                            <label className="form-check-label" htmlFor={`guarantee-${rate.id}`}>
                                                                Add Guarantee (+${rate.guaranteedPrice?.toFixed(2) || '0.00'})
                                                            </label>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className={`rate-details-content ${showRateDetails ? 'show' : ''}`}>
                                                    <ul className="rate-details-list">
                                                        <li>
                                                            <span className="charge-name">Service Mode</span>
                                                            <span className="charge-amount">{rate.originalRate?.serviceMode || 'Standard'}</span>
                                                        </li>
                                                        <li>
                                                            <span className="charge-name">Freight Charges</span>
                                                            <span className="charge-amount">${rate.originalRate?.freightCharges?.toFixed(2) || '0.00'}</span>
                                                        </li>
                                                        <li>
                                                            <span className="charge-name">Fuel Charges</span>
                                                            <span className="charge-amount">${rate.originalRate?.fuelCharges?.toFixed(2) || '0.00'}</span>
                                                        </li>
                                                        <li>
                                                            <span className="charge-name">Service Charges</span>
                                                            <span className="charge-amount">${rate.originalRate?.serviceCharges?.toFixed(2) || '0.00'}</span>
                                                        </li>
                                                        {rate.originalRate?.accessorialCharges > 0 && (
                                                            <li>
                                                                <span className="charge-name">Accessorial Charges</span>
                                                                <span className="charge-amount">${rate.originalRate.accessorialCharges.toFixed(2)}</span>
                                                            </li>
                                                        )}
                                                    </ul>
                                                </div>

                                                <button
                                                    type="button"
                                                    className={`btn ${selectedRate?.id === rate.id ? 'btn-primary' : 'btn-outline-primary'} select-button`}
                                                    onClick={() => handleRateSelect(rate)}
                                                >
                                                    {selectedRate?.id === rate.id ? 'Selected' : 'Select'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                <div className="navigation-buttons">
                    <button
                        type="button"
                        className="btn btn-outline-primary btn-navigation"
                        onClick={onPrevious}
                    >
                        <i className="bi bi-arrow-left"></i> Previous
                    </button>
                    <button
                        type="button"
                        className="btn btn-primary btn-navigation"
                        onClick={handleSubmit}
                        disabled={!selectedRate}
                    >
                        Next <i className="bi bi-arrow-right"></i>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Rates; 