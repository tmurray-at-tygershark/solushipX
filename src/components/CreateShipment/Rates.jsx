import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShipmentForm } from '../../contexts/ShipmentFormContext';
import ReactMarkdown from 'react-markdown';
import { Card, CardHeader, CardContent, Box, Typography, Collapse, IconButton, Link, CircularProgress, Button, Grid, Container, Paper } from '@mui/material';
import { Divider } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, updateDoc, serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import ShipmentRateRequestSummary from './ShipmentRateRequestSummary';
import { toEShipPlusRequest } from '../../translators/eshipplus/translator';

const Rates = ({ formData, onPrevious, onNext, activeDraftId }) => {
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
    const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(false);
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
        setIsLoading(true);
        setError(null);
        setRatesLoaded(false);

        try {
            // Use the EShipPlus translator to build the request
            const rateRequestData = toEShipPlusRequest(formData);

            // Debug booking reference number
            console.log('DEBUG - Booking Reference:', {
                'shipmentInfo': formData.shipmentInfo,
                'shipperReferenceNumber': formData.shipmentInfo?.shipperReferenceNumber,
                'BookingReferenceNumber (final)': rateRequestData.BookingReferenceNumber
            });

            // Auto-fix missing Contact fields before validation
            if (!rateRequestData.Origin.Contact || rateRequestData.Origin.Contact.trim() === '') {
                console.log("Auto-fixing missing origin Contact");
                rateRequestData.Origin.Contact =
                    rateRequestData.Origin.Attention ||
                    rateRequestData.Origin.Name ||
                    rateRequestData.Origin.Company ||
                    "Shipping Department";
            }

            if (!rateRequestData.Destination.Contact || rateRequestData.Destination.Contact.trim() === '') {
                console.log("Auto-fixing missing destination Contact");
                rateRequestData.Destination.Contact =
                    rateRequestData.Destination.Attention ||
                    rateRequestData.Destination.Name ||
                    rateRequestData.Destination.Company ||
                    "Receiving Department";
            }

            // Auto-fix missing SpecialInstructions fields
            if (!rateRequestData.Origin.SpecialInstructions ||
                rateRequestData.Origin.SpecialInstructions.trim() === '') {
                rateRequestData.Origin.SpecialInstructions = 'none';
            }

            if (!rateRequestData.Destination.SpecialInstructions ||
                rateRequestData.Destination.SpecialInstructions.trim() === '') {
                rateRequestData.Destination.SpecialInstructions = 'none';
            }

            // Basic validation for required fields on rateRequestData
            if (!rateRequestData.Origin.City || rateRequestData.Origin.City.trim() === '') {
                throw new Error('Missing or invalid city in origin address');
            }

            if (!rateRequestData.Origin.PostalCode || rateRequestData.Origin.PostalCode.trim() === '') {
                throw new Error('Missing or invalid postal code in origin address');
            }
            if (!rateRequestData.Origin.Country?.Code || rateRequestData.Origin.Country.Code.trim() === '') {
                throw new Error('Missing or invalid country code in origin address');
            }


            if (!rateRequestData.Destination.City || rateRequestData.Destination.City.trim() === '') {
                throw new Error('Missing or invalid city in destination address');
            }

            if (!rateRequestData.Destination.PostalCode || rateRequestData.Destination.PostalCode.trim() === '') {
                throw new Error('Missing or invalid postal code in destination address');
            }
            if (!rateRequestData.Destination.Country?.Code || rateRequestData.Destination.Country.Code.trim() === '') {
                throw new Error('Missing or invalid country code in destination address');
            }

            // Validate Contact fields before making the API call
            if (!rateRequestData.Origin.Contact || rateRequestData.Origin.Contact.trim() === '') {
                throw new Error('Missing or invalid contact name in origin address');
            }

            if (!rateRequestData.Destination.Contact || rateRequestData.Destination.Contact.trim() === '') {
                throw new Error('Missing or invalid contact name in destination address');
            }

            // Log the complete validated request
            console.group('🚢 Rate Request Data (POST TRANSLATION):');
            console.log('📅 Shipment Details:', {
                BookingReferenceNumber: rateRequestData.BookingReferenceNumber,
                BookingReferenceNumberType: rateRequestData.BookingReferenceNumberType,
                ShipmentBillType: rateRequestData.ShipmentBillType,
                ShipmentDate: rateRequestData.ShipmentDate,
                EarliestPickup: rateRequestData.EarliestPickup,
                LatestPickup: rateRequestData.LatestPickup,
                EarliestDelivery: rateRequestData.EarliestDelivery,
                LatestDelivery: rateRequestData.LatestDelivery
            });

            console.log('📍 Origin Address:', rateRequestData.Origin);
            console.log('📍 Destination Address:', rateRequestData.Destination);

            console.log('📦 Items:', rateRequestData.Items.map(item => ({
                Name: item.Name,
                Type: item.Type,
                Quantity: item.Quantity,
                Weight: item.Weight,
                Length: item.Length,
                Width: item.Width,
                Height: item.Height,
                FreightClass: item.FreightClass,
                Value: item.Value,
                Currency: item.Currency,
                CommodityDescription: item.CommodityDescription,
                Stackable: item.Stackable
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
                        console.log(`Rate Quote ID ${rate.id}, Raw Date: ${rawDeliveryDate}, Formatted Date: ${formattedDeliveryDate}`); // Add log for debugging

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
                            packageCounts: rate.packageCounts || {},

                            // Enhanced charge breakdown fields - using the correct field names from originalRate
                            totalCharges: parseFloat(rate.totalCharges) || 0,
                            freightCharge: parseFloat(rate.originalRate?.freightCharges || 0),
                            fuelCharge: parseFloat(rate.originalRate?.fuelCharges || 0),
                            serviceCharges: parseFloat(rate.originalRate?.serviceCharges || 0),
                            accessorialCharges: parseFloat(rate.originalRate?.accessorialCharges || 0),
                            guaranteeCharge: 0 // Will be updated when guarantee is selected
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
        // Pass the selected rate data to the parent
        onNext(selectedRate);
    };

    const handleGuaranteeChange = (rate, checked) => {
        const guaranteeAmount = rate.guaranteedPrice || 0;
        let updatedRateData;

        if (checked) {
            updatedRateData = {
                ...rate,
                price: rate.price + guaranteeAmount,
                totalCharges: (rate.totalCharges || rate.price) + guaranteeAmount,
                guaranteed: true,
                guaranteeCharge: guaranteeAmount,
                // Preserve all other charge breakdown fields
                freightCharge: rate.freightCharge || 0,
                fuelCharge: rate.fuelCharge || 0,
                serviceCharges: rate.serviceCharges || 0,
                accessorialCharges: rate.accessorialCharges || 0
            };
        } else {
            updatedRateData = {
                ...rate,
                price: rate.price - guaranteeAmount,
                totalCharges: (rate.totalCharges || rate.price) - guaranteeAmount,
                guaranteed: false,
                guaranteeCharge: 0,
                // Preserve all other charge breakdown fields
                freightCharge: rate.freightCharge || 0,
                fuelCharge: rate.fuelCharge || 0,
                serviceCharges: rate.serviceCharges || 0,
                accessorialCharges: rate.accessorialCharges || 0
            };
        }

        // Update the rates array with the modified rate
        const updatedRates = rates.map(r => r.id === rate.id ? updatedRateData : r);
        setRates(updatedRates);
        setFilteredRates(updatedRates);

        // If this rate is currently selected, update it and save to Firestore
        if (selectedRate?.id === rate.id) {
            setSelectedRate(updatedRateData);
            saveSelectedRateToFirestore(updatedRateData);
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

    const handleRateSelect = async (rate) => {
        if (selectedRate?.id === rate.id) {
            const newSelectedRate = null;
            setSelectedRate(newSelectedRate);
            updateFormSection('selectedRate', newSelectedRate);
            updateFormSection('selectedRateRef', null);
            // Save the deselection to Firestore (non-blocking)
            saveSelectedRateToFirestore(newSelectedRate).catch(error => {
                console.error('Error saving rate deselection:', error);
            });
        } else {
            setSelectedRate(rate);
            updateFormSection('selectedRate', rate);

            // Create rate reference for form context
            const rateRef = {
                rateId: rate.id,
                carrier: rate.carrier,
                service: rate.service,
                totalCharges: rate.totalCharges || rate.price,
                transitDays: rate.transitDays,
                estimatedDeliveryDate: rate.estimatedDeliveryDate,
                currency: rate.currency || 'USD',
                guaranteed: rate.guaranteed || false
            };
            updateFormSection('selectedRateRef', rateRef);

            console.log('Rate selected:', rate.carrier, rate.price);

            // Save to Firestore in background (non-blocking)
            saveSelectedRateToFirestore(rate).catch(error => {
                console.error('Error saving selected rate:', error);
                // Could show a toast notification here if needed
            });

            // Navigate immediately without waiting for Firestore save
            onNext(rate);
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

                            if (!data.success && data.message) { // Check for specific error message from function
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
                                setIsAnalysisExpanded(true); // Expand fully only when done and successful
                                break; // Break from inner loop
                            }
                        } catch (e) {
                            console.error('Error parsing stream data:', e);
                            setAnalysisError('Error processing AI analysis response: ' + e.message);
                            setIsAnalyzing(false);
                            setIsAnalysisExpanded(false); // Keep it closed on error
                            return; // Exit handleAnalyzeRates due to parsing error
                        }
                    }
                }
                if (lines.some(line => line.startsWith('data: ') && JSON.parse(line.slice(5)).done)) {
                    break; // Break from while loop if done
                }
            }
        } catch (error) {
            console.error('AI Analysis Error:', error);
            setAnalysisError(error.message);
            setIsAnalysisExpanded(false); // Keep it closed on error
        } finally {
            setIsAnalyzing(false);
            // If there was a result, ensure it's expanded. If error, it remains closed (or previous state).
            if (analysisResult && !analysisError) {
                setIsAnalysisExpanded(true);
            }
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

    // Function to save selected rate immediately to Firestore
    const saveSelectedRateToFirestore = async (rateData) => {
        if (!activeDraftId) {
            console.warn('No activeDraftId available to save selected rate');
            return;
        }

        try {
            if (rateData === null) {
                // Handle rate deselection
                console.log('Deselecting rate for shipment:', activeDraftId);

                const shipmentRef = doc(db, 'shipments', activeDraftId);
                await updateDoc(shipmentRef, {
                    selectedRateRef: null,
                    updatedAt: serverTimestamp()
                });

                console.log('Rate deselection saved to Firestore');
                return;
            }

            // Enhanced logging of rate data being saved
            console.log('Saving selected rate with detailed breakdown:', {
                carrier: rateData?.carrier,
                totalCharges: rateData?.totalCharges,
                shipmentId: activeDraftId
            });

            // Save full rate details to shipmentRates collection
            const shipmentRatesRef = collection(db, 'shipmentRates');
            const rateDocument = {
                shipmentId: activeDraftId,
                rateId: rateData.id,
                carrier: rateData.carrier,
                service: rateData.service,
                carrierCode: rateData.carrierCode || '',
                serviceCode: rateData.serviceCode || '',
                totalCharges: rateData.totalCharges || rateData.price,
                freightCharge: rateData.freightCharge || rateData.originalRate?.freightCharges || 0,
                fuelCharge: rateData.fuelCharge || rateData.originalRate?.fuelCharges || 0,
                serviceCharges: rateData.serviceCharges || rateData.originalRate?.serviceCharges || 0,
                accessorialCharges: rateData.accessorialCharges || rateData.originalRate?.accessorialCharges || 0,
                guaranteeCharge: rateData.guaranteeCharge || 0,
                currency: rateData.currency || 'USD',
                transitDays: rateData.transitDays,
                transitTime: rateData.transitTime,
                estimatedDeliveryDate: rateData.estimatedDeliveryDate,
                guaranteed: rateData.guaranteed || false,
                guaranteedOptionAvailable: rateData.guaranteedOptionAvailable || false,
                guaranteedPrice: rateData.guaranteedPrice || null,
                packageCounts: rateData.packageCounts || {},
                originalRate: rateData.originalRate,
                status: 'selected',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            // Add to shipmentRates collection
            const rateDocRef = await addDoc(shipmentRatesRef, rateDocument);
            console.log('Rate details saved to shipmentRates collection with ID:', rateDocRef.id);

            // Save only a reference to the shipment document
            const shipmentRef = doc(db, 'shipments', activeDraftId);
            const selectedRateRef = {
                rateDocumentId: rateDocRef.id,
                rateId: rateData.id,
                carrier: rateData.carrier,
                service: rateData.service,
                totalCharges: rateData.totalCharges || rateData.price,
                transitDays: rateData.transitDays,
                estimatedDeliveryDate: rateData.estimatedDeliveryDate,
                currency: rateData.currency || 'USD',
                guaranteed: rateData.guaranteed || false
            };

            await updateDoc(shipmentRef, {
                selectedRateRef: selectedRateRef,
                updatedAt: serverTimestamp()
            });

            // Update the form context with the rate reference including the document ID
            const formRateRef = {
                ...selectedRateRef,
                rateDocumentId: rateDocRef.id
            };
            updateFormSection('selectedRateRef', formRateRef);

            console.log('Rate reference saved to shipment document:', activeDraftId);

        } catch (error) {
            console.error('Error saving selected rate:', error);
            throw error;
        }
    };

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
                            Searching All Carrier Rates...
                        </Typography>
                        <Typography variant="body2" color="text.tertiary" sx={{ mt: 1 }} textAlign="center">
                            This may take a moment. Please wait.
                        </Typography>
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
                            <Grid item xs={12} md={6} lg={4} key={rate.id}>
                                <Card className="card mb-4" elevation={2}>
                                    <CardHeader title={<Typography variant="h6" component="div">{rate.carrier}</Typography>} sx={{ pb: 0 }} />
                                    <CardContent>
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
                                        <Button
                                            variant={selectedRate?.id === rate.id ? 'contained' : 'outlined'}
                                            onClick={() => handleRateSelect(rate)}
                                            type="button"
                                            fullWidth
                                            sx={{ mt: 2 }}
                                        >
                                            {selectedRate?.id === rate.id ? 'Selected' : 'Select'}
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