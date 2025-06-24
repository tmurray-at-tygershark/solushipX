import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    Grid,
    TextField,
    Autocomplete,
    CircularProgress,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Switch,
    FormControlLabel,
    Chip,
    Alert,
    Snackbar,
    LinearProgress,
    Tooltip,
    IconButton,
    InputAdornment,
    FormHelperText,
    Container,
    Divider,
    Paper,
    Collapse,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Refresh as RefreshIcon,
    Save as SaveIcon,
    LocalShipping as ShippingIcon,
    CheckCircle as CheckCircleIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    ContentCopy as ContentCopyIcon
} from '@mui/icons-material';
import { db } from '../../firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, getDoc, limit, increment } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { fetchMultiCarrierRates, getAllCarriers, getEligibleCarriers } from '../../utils/carrierEligibility';
import { validateUniversalRate } from '../../utils/universalDataModel';
import { generateShipmentId } from '../../utils/shipmentIdGenerator';
import ModalHeader from '../common/ModalHeader';
import AddressForm from '../AddressBook/AddressForm';

// Import sophisticated rate components from Rates.jsx
import EnhancedRateCard from './EnhancedRateCard';
import CarrierLoadingDisplay from './CarrierLoadingDisplay';
import RateErrorDisplay from './RateErrorDisplay';
import ShipmentRateRequestSummary from './ShipmentRateRequestSummary';
import CarrierStatsPopover from './CarrierStatsPopover';

// Packaging types for shipments
const PACKAGING_TYPES = [
    { value: 237, label: '10KG BOX' },
    { value: 238, label: '25KG BOX' },
    { value: 239, label: 'ENVELOPE' },
    { value: 240, label: 'TUBE (PACKAGE)' },
    { value: 241, label: 'PAK (PACKAGE)' },
    { value: 242, label: 'BAGS' },
    { value: 243, label: 'BALE(S)' },
    { value: 244, label: 'BOX(ES)' },
    { value: 245, label: 'BUNCH(ES)' },
    { value: 246, label: 'BUNDLE(S)' },
    { value: 248, label: 'CARBOY(S)' },
    { value: 249, label: 'CARPET(S)' },
    { value: 250, label: 'CARTONS' },
    { value: 251, label: 'CASE(S)' },
    { value: 252, label: 'COIL(S)' },
    { value: 253, label: 'CRATE(S)' },
    { value: 254, label: 'CYLINDER(S)' },
    { value: 255, label: 'DRUM(S)' },
    { value: 256, label: 'LOOSE' },
    { value: 257, label: 'PAIL(S)' },
    { value: 258, label: 'PALLET(S)' },
    { value: 260, label: 'REELS(S)' },
    { value: 261, label: 'ROLL(S)' },
    { value: 262, label: 'SKID(S)' },
    { value: 265, label: 'TOTE(S)' },
    { value: 266, label: 'TUBES/PIPES' },
    { value: 268, label: 'GALLONS' },
    { value: 269, label: 'LIQUID BULK' },
    { value: 270, label: 'CONTAINER' },
    { value: 271, label: 'PIECES' },
    { value: 272, label: 'LOAD' },
    { value: 273, label: 'BLADE(S)' },
    { value: 274, label: 'RACKS' },
    { value: 275, label: 'GAYLORDS' }
];

// Service level options for different shipment types
const COURIER_SERVICE_LEVELS = [
    { value: 'any', label: 'Any' },
    { value: 'economy', label: 'Economy' },
    { value: 'express', label: 'Express' },
    { value: 'priority', label: 'Priority' }
];

const FREIGHT_SERVICE_LEVELS = [
    { value: 'any', label: 'Any' },
    { value: 'ltl_standard', label: 'LTL Standard' },
    { value: 'ltl_expedited', label: 'LTL Expedited' },
    { value: 'ftl_standard', label: 'FTL Standard' },
    { value: 'ftl_expedited', label: 'FTL Expedited' },
    { value: 'same_day', label: 'Same Day' },
    { value: 'next_day', label: 'Next Day' }
];

// Freight class options (same as QuickShip)
const FREIGHT_CLASSES = [
    {
        class: "50",
        description: "Clean Freight",
        examples: ["Bricks", "Sand", "Nuts & Bolts"],
        weight_range_per_cubic_foot: "50 lbs and above",
        min_weight: 50,
        max_weight: Infinity
    },
    {
        class: "55",
        description: "Bricks, cement, mortar, hardwood flooring",
        examples: ["Bricks", "Cement", "Mortar", "Hardwood Flooring"],
        weight_range_per_cubic_foot: "35-50 lbs",
        min_weight: 35,
        max_weight: 50
    },
    {
        class: "60",
        description: "Car accessories & car parts",
        examples: ["Car Accessories", "Car Parts"],
        weight_range_per_cubic_foot: "30-35 lbs",
        min_weight: 30,
        max_weight: 35
    },
    {
        class: "65",
        description: "Car accessories & car parts, bottled beverages, books in boxes",
        examples: ["Car Accessories", "Car Parts", "Bottled Beverages", "Books in Boxes"],
        weight_range_per_cubic_foot: "22.5-30 lbs",
        min_weight: 22.5,
        max_weight: 30
    },
    {
        class: "70",
        description: "Car accessories & car parts, food items, automobile engines",
        examples: ["Car Accessories", "Car Parts", "Food Items", "Automobile Engines"],
        weight_range_per_cubic_foot: "15-22.5 lbs",
        min_weight: 15,
        max_weight: 22.5
    },
    {
        class: "77.5",
        description: "Tires, bathroom fixtures",
        examples: ["Tires", "Bathroom Fixtures"],
        weight_range_per_cubic_foot: "13.5-15 lbs",
        min_weight: 13.5,
        max_weight: 15
    },
    {
        class: "85",
        description: "Crated machinery, cast iron stoves",
        examples: ["Crated Machinery", "Cast Iron Stoves"],
        weight_range_per_cubic_foot: "12-13.5 lbs",
        min_weight: 12,
        max_weight: 13.5
    },
    {
        class: "92.5",
        description: "Computers, monitors, refrigerators",
        examples: ["Computers", "Monitors", "Refrigerators"],
        weight_range_per_cubic_foot: "10.5-12 lbs",
        min_weight: 10.5,
        max_weight: 12
    },
    {
        class: "100",
        description: "Boat covers, car covers, canvas, wine cases, caskets",
        examples: ["Boat Covers", "Car Covers", "Canvas", "Wine Cases", "Caskets"],
        weight_range_per_cubic_foot: "9-10.5 lbs",
        min_weight: 9,
        max_weight: 10.5
    },
    {
        class: "110",
        description: "Cabinets, framed artwork, table saw",
        examples: ["Cabinets", "Framed Artwork", "Table Saw"],
        weight_range_per_cubic_foot: "8-9 lbs",
        min_weight: 8,
        max_weight: 9
    },
    {
        class: "125",
        description: "Small household appliances",
        examples: ["Small Household Appliances"],
        weight_range_per_cubic_foot: "7-8 lbs",
        min_weight: 7,
        max_weight: 8
    },
    {
        class: "150",
        description: "Auto sheet metal parts, bookcases",
        examples: ["Auto Sheet Metal Parts", "Bookcases"],
        weight_range_per_cubic_foot: "6-7 lbs",
        min_weight: 6,
        max_weight: 7
    }
];

const CreateShipmentX = ({ onClose, onReturnToShipments, onViewShipment, draftId = null, isModal = false, showCloseButton = true, prePopulatedData }) => {
    const { companyData, companyIdForAddress, loading: companyLoading } = useCompany();
    const { currentUser: user, loading: authLoading } = useAuth();
    const debounceTimeoutRef = useRef(null);



    // State variables
    const [shipmentInfo, setShipmentInfo] = useState({
        shipmentType: 'freight',
        serviceLevel: 'Any',
        shipmentDate: new Date().toISOString().split('T')[0],
        shipperReferenceNumber: '',
        billType: 'third_party'
    });

    // Draft and shipment ID management
    const [shipmentID, setShipmentID] = useState('');
    const [isEditingDraft, setIsEditingDraft] = useState(false);
    const [activeDraftId, setActiveDraftId] = useState(null);
    const [isDraftLoading, setIsDraftLoading] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);

    // Address state
    const [shipFromAddress, setShipFromAddress] = useState(null);
    const [shipToAddress, setShipToAddress] = useState(null);
    const [availableAddresses, setAvailableAddresses] = useState([]);
    const [loadingAddresses, setLoadingAddresses] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);

    // Package state (QuickShip style)
    const [packages, setPackages] = useState([
        {
            id: 1,
            itemDescription: '',
            packagingType: 244, // BOX(ES) - default for courier
            packagingQuantity: 1,
            weight: '',
            length: '12', // Default box dimensions
            width: '12', // Default box dimensions
            height: '12', // Default box dimensions
            unitSystem: 'imperial',
            freightClass: ''
        },
    ]);

    // Rates state
    const [isLoadingRates, setIsLoadingRates] = useState(false);
    const [rates, setRates] = useState([]);
    const [filteredRates, setFilteredRates] = useState([]);
    const [selectedRate, setSelectedRate] = useState(null);
    const [ratesError, setRatesError] = useState(null);
    const [showRates, setShowRates] = useState(false);
    const [loadingCarriers, setLoadingCarriers] = useState([]);
    const [completedCarriers, setCompletedCarriers] = useState([]);
    const [failedCarriers, setFailedCarriers] = useState([]);
    const [rawRateApiResponseData, setRawRateApiResponseData] = useState(null);

    // Rate filtering and sorting state
    const [sortBy, setSortBy] = useState('price');
    const [serviceFilter, setServiceFilter] = useState('all');
    const [showRateDetails, setShowRateDetails] = useState(false);

    // Additional state for improved UX
    const [formErrors, setFormErrors] = useState({});
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // Address dialog state
    const [addressEditMode, setAddressEditMode] = useState(null);
    const [currentView, setCurrentView] = useState('createshipment');
    const [isSliding, setIsSliding] = useState(false);

    // Additional Options state (from ShipmentInfo)
    const [serviceOptionsExpanded, setServiceOptionsExpanded] = useState(false);
    const [additionalOptions, setAdditionalOptions] = useState({
        deliveryPickupOption: '',
        hazardousGoods: '',
        priorityDelivery: '',
        signatureOptions: ''
    });

    // Booking state management (similar to QuickShip)
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [showBookingDialog, setShowBookingDialog] = useState(false);
    const [isBooking, setIsBooking] = useState(false);
    const [bookingStep, setBookingStep] = useState('booking'); // 'booking', 'generating_documents', 'completed', 'error'
    const [bookingError, setBookingError] = useState(null);
    const [finalShipmentId, setFinalShipmentId] = useState('');
    const [documentGenerationStatus, setDocumentGenerationStatus] = useState('');

    // Extract draft ID from prePopulatedData or props
    const draftIdToLoad = prePopulatedData?.editDraftId || draftId;

    // Load addresses
    useEffect(() => {
        const loadAddresses = async () => {
            if (!companyIdForAddress) return;

            setLoadingAddresses(true);
            try {
                const addressQuery = query(
                    collection(db, 'addressBook'),
                    where('companyID', '==', companyIdForAddress),
                    where('status', '==', 'active')
                );
                const addressSnapshot = await getDocs(addressQuery);
                const addresses = addressSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setAvailableAddresses(addresses);
            } catch (error) {
                console.error('Error loading addresses:', error);
                setAvailableAddresses([]);
            } finally {
                setLoadingAddresses(false);
            }
        };
        loadAddresses();
    }, [companyIdForAddress]);

    // Load customers
    useEffect(() => {
        const loadCustomers = async () => {
            if (!companyIdForAddress) return;

            try {
                const customersQuery = query(
                    collection(db, 'customers'),
                    where('companyID', '==', companyIdForAddress)
                );
                const customersSnapshot = await getDocs(customersQuery);
                const customersData = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setCustomers(customersData);
            } catch (error) {
                console.error('Error loading customers:', error);
                setCustomers([]);
            }
        };
        loadCustomers();
    }, [companyIdForAddress]);

    // Get company eligible carriers using enhanced system
    const getCompanyEligibleCarriers = useCallback(async (shipmentData) => {
        const companyConnectedCarriers = companyData?.connectedCarriers || [];

        if (companyConnectedCarriers.length === 0) {
            console.warn('No connected carriers found for company');
            return [];
        }

        const enabledConnectedCarriers = companyConnectedCarriers.filter(cc =>
            cc.enabled === true && cc.carrierID
        );

        console.log('🏢 Company connected carriers:', enabledConnectedCarriers.map(cc => ({
            carrierID: cc.carrierID,
            enabled: cc.enabled
        })));

        // Get all eligible carriers from enhanced system (database + static)
        const systemEligibleCarriers = await getEligibleCarriers(shipmentData);

        console.log('🌐 System eligible carriers:', systemEligibleCarriers.map(c => ({
            name: c.name,
            key: c.key,
            isCustomCarrier: c.isCustomCarrier
        })));

        // Filter system eligible carriers to only include company's connected carriers
        const carrierIdToKeyMap = {
            'ESHIPPLUS': 'ESHIPPLUS',
            'CANPAR': 'CANPAR',
            'POLARISTRANSPORTATION': 'POLARISTRANSPORTATION'
        };

        const companyEligibleCarriers = systemEligibleCarriers.filter(systemCarrier => {
            console.log(`🔍 Checking carrier connection for ${systemCarrier.name}:`);
            console.log(`  - System carrier key: ${systemCarrier.key}`);
            console.log(`  - Is custom carrier: ${systemCarrier.isCustomCarrier}`);
            console.log(`  - Company connected carrier IDs:`, enabledConnectedCarriers.map(cc => cc.carrierID));

            // Check if company has this carrier connected
            const staticMatch = carrierIdToKeyMap[systemCarrier.key];  // Check reverse mapping
            const directMatch = enabledConnectedCarriers.some(cc => cc.carrierID === systemCarrier.key);
            const legacyStaticMatch = enabledConnectedCarriers.some(cc => carrierIdToKeyMap[cc.carrierID] === systemCarrier.key);

            console.log(`  - Static match: ${staticMatch}`);
            console.log(`  - Direct match: ${directMatch}`);
            console.log(`  - Legacy static match: ${legacyStaticMatch}`);

            const isConnectedByCompany = directMatch || legacyStaticMatch;

            if (isConnectedByCompany) {
                console.log(`✅ ${systemCarrier.name} is connected and eligible for company`);
                return true;
            } else {
                console.log(`❌ ${systemCarrier.name} not connected by company`);
                return false;
            }
        });

        console.log(`🎯 Final company eligible carriers: ${companyEligibleCarriers.length} carriers:`,
            companyEligibleCarriers.map(c => `${c.name} (${c.isCustomCarrier ? 'DB' : 'Static'})`));

        return companyEligibleCarriers;
    }, [companyData]);

    // Check if we have enough data to fetch rates
    const canFetchRates = useCallback(() => {
        const hasAddresses = shipFromAddress && shipToAddress;
        const hasValidPackages = packages.some(pkg =>
            pkg.weight && pkg.length && pkg.width && pkg.height && pkg.itemDescription
        );
        return hasAddresses && hasValidPackages;
    }, [shipFromAddress, shipToAddress, packages]);

    // Fetch rates from carriers
    const fetchRates = useCallback(async (forceRefresh = false) => {
        if (!canFetchRates()) return;

        setIsLoadingRates(true);
        setRatesError(null);
        setShowRates(true);
        setCompletedCarriers([]);
        setFailedCarriers([]);

        try {
            const shipmentData = {
                shipFrom: shipFromAddress,
                shipTo: shipToAddress,
                packages: packages.filter(p => p.weight && p.length && p.width && p.height),
                shipmentInfo
            };

            const companyEligibleCarriers = await getCompanyEligibleCarriers(shipmentData);

            if (companyEligibleCarriers.length === 0) {
                setRatesError('No carriers available for this route and shipment details');
                setRates([]);
                return;
            }

            setLoadingCarriers(companyEligibleCarriers.map(c => c.name));

            const multiCarrierResult = await fetchMultiCarrierRates(shipmentData, {
                customEligibleCarriers: companyEligibleCarriers,
                progressiveResults: true,
                includeFailures: true,
                timeout: 45000,
                retryAttempts: 1,
                retryDelay: 2000,
                onProgress: (progressData) => {
                    if (progressData.completed) {
                        setCompletedCarriers(prev => [...prev, {
                            name: progressData.carrier,
                            rates: progressData.rates?.length || 0
                        }]);
                    }
                    if (progressData.failed) {
                        setFailedCarriers(prev => [...prev, {
                            name: progressData.carrier,
                            error: progressData.error
                        }]);
                    }
                }
            });

            if (multiCarrierResult.success && multiCarrierResult.rates.length > 0) {
                const validRates = multiCarrierResult.rates.filter(rate => {
                    const validation = validateUniversalRate(rate);
                    return validation.valid;
                });

                if (validRates.length > 0) {
                    setRates(validRates);
                    setRawRateApiResponseData(multiCarrierResult);
                } else {
                    setRatesError('No rates available for this shipment configuration');
                    setRates([]);
                    setRawRateApiResponseData(null);
                }
            } else {
                setRatesError('No rates available for this shipment configuration');
                setRates([]);
                setRawRateApiResponseData(null);
            }

        } catch (error) {
            console.error('Error fetching rates:', error);
            setRatesError(`Failed to fetch rates: ${error.message}`);
            setRates([]);
            setRawRateApiResponseData(null);
        } finally {
            setIsLoadingRates(false);
        }
    }, [shipFromAddress, shipToAddress, packages, shipmentInfo, canFetchRates, getCompanyEligibleCarriers]);

    // Auto-fetch rates when data changes with improved debouncing
    useEffect(() => {
        // Don't fetch rates during booking process
        if (isBooking || showBookingDialog) {
            return;
        }

        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        if (canFetchRates()) {
            debounceTimeoutRef.current = setTimeout(() => fetchRates(), 1500);
        }

        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, [shipFromAddress, shipToAddress, packages, shipmentInfo, canFetchRates, isBooking, showBookingDialog]);

    // Load draft data if draftId is provided
    useEffect(() => {
        const loadDraft = async () => {
            if (!draftIdToLoad) return;

            setIsDraftLoading(true);
            setIsEditingDraft(true);

            try {
                const draftDoc = await getDoc(doc(db, 'shipments', draftIdToLoad));

                if (draftDoc.exists()) {
                    const draftData = draftDoc.data();

                    // Only load if it's an advanced draft or doesn't have a creationMethod (legacy)
                    if (draftData.creationMethod === 'advanced' || !draftData.creationMethod) {
                        console.log('Loading advanced shipment draft:', draftData);

                        // Set the shipment ID from the draft
                        if (draftData.shipmentID) {
                            setShipmentID(draftData.shipmentID);
                        }

                        // Load shipment info
                        if (draftData.shipmentInfo) {
                            setShipmentInfo({
                                shipmentType: draftData.shipmentInfo.shipmentType || 'freight',
                                serviceLevel: draftData.shipmentInfo.serviceLevel || 'Any',
                                shipmentDate: draftData.shipmentInfo.shipmentDate || new Date().toISOString().split('T')[0],
                                shipperReferenceNumber: draftData.shipmentInfo.shipperReferenceNumber || '',
                                billType: draftData.shipmentInfo.billType || 'third_party'
                            });
                        }

                        // Load addresses
                        if (draftData.shipFrom) {
                            setShipFromAddress(draftData.shipFrom);
                        }
                        if (draftData.shipTo) {
                            setShipToAddress(draftData.shipTo);
                        }

                        // Load packages
                        if (draftData.packages && Array.isArray(draftData.packages) && draftData.packages.length > 0) {
                            setPackages(draftData.packages);
                        }

                        // Load selected rate if available
                        if (draftData.selectedRate) {
                            setSelectedRate(draftData.selectedRate);
                        }

                        // Set the active draft ID
                        setActiveDraftId(draftIdToLoad);

                        showMessage('Draft loaded successfully');
                    } else {
                        // If it's a QuickShip draft, show error
                        showMessage('This draft was created using QuickShip and cannot be edited in the advanced form.', 'error');
                        setTimeout(() => {
                            if (onReturnToShipments) {
                                onReturnToShipments();
                            }
                        }, 2000);
                    }
                } else {
                    showMessage('Draft shipment not found.', 'error');
                }
            } catch (error) {
                console.error('Error loading draft:', error);
                showMessage('Failed to load draft shipment.', 'error');
            } finally {
                setIsDraftLoading(false);
            }
        };

        loadDraft();
    }, [draftIdToLoad, onReturnToShipments]);

    // Generate shipment ID and create initial draft (similar to QuickShip)
    useEffect(() => {
        const initializeShipment = async () => {
            // Wait for user and company data to be available
            if (!companyData?.companyID || !user?.uid || shipmentID || isEditingDraft || draftIdToLoad) return;

            try {
                // Generate a new shipment ID
                const newShipmentID = await generateShipmentId(companyData.companyID, {});
                setShipmentID(newShipmentID);

                // Create initial draft data
                const initialDraftData = {
                    shipmentID: newShipmentID,
                    status: 'draft',
                    creationMethod: 'advanced', // Mark as advanced shipment
                    companyID: companyData.companyID,
                    createdBy: user.uid, // Now guaranteed to be defined
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),

                    // Initialize with default values
                    shipmentInfo: {
                        shipmentType: 'courier', // Default to courier
                        serviceLevel: 'Any',
                        shipmentDate: new Date().toISOString().split('T')[0],
                        shipperReferenceNumber: newShipmentID,
                        billType: 'third_party'
                    },
                    packages: [{
                        id: 1,
                        itemDescription: '',
                        packagingType: 244, // BOX(ES) - default for courier
                        packagingQuantity: 1,
                        weight: '',
                        length: '12', // Default box dimensions
                        width: '12', // Default box dimensions
                        height: '12', // Default box dimensions
                        freightClass: '',
                        unitSystem: 'imperial'
                    }],

                    // Advanced shipment specific flags
                    isDraft: true,
                    draftVersion: 1
                };

                // Create the draft document
                const docRef = await addDoc(collection(db, 'shipments'), initialDraftData);
                setActiveDraftId(docRef.id);
                console.log('Initial draft created with ID:', docRef.id);

            } catch (error) {
                console.error('Error creating initial draft:', error);
                showMessage('Failed to initialize shipment', 'error');
            }
        };

        initializeShipment();
    }, [companyData?.companyID, user?.uid, shipmentID, isEditingDraft, draftIdToLoad]);

    // Update package defaults when shipment type changes
    useEffect(() => {
        if (shipmentInfo.shipmentType) {
            const isCourier = shipmentInfo.shipmentType === 'courier';

            setPackages(prev => prev.map(pkg => ({
                ...pkg,
                packagingType: isCourier ? 244 : 262, // BOX(ES) for courier, SKID(S) for freight
                length: isCourier ? '12' : '48',
                width: isCourier ? '12' : '40',
                height: isCourier ? '12' : ''
            })));

            // Clear rates and reset rate fetching state when shipment type changes
            // This ensures rate fetching will work again once form is properly filled
            setRates([]);
            setFilteredRates([]);
            setSelectedRate(null);
            setRatesError(null);
            setShowRates(false);
            setIsLoadingRates(false);
            setCompletedCarriers([]);
            setFailedCarriers([]);
            setLoadingCarriers([]);

            // Clear any pending timeouts
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        }
    }, [shipmentInfo.shipmentType]);

    // Rate filtering and sorting effect
    useEffect(() => {
        let filtered = [...rates];

        // Apply service filter
        if (serviceFilter !== 'all') {
            filtered = filtered.filter(rate => {
                switch (serviceFilter) {
                    case 'guaranteed':
                        return rate.guaranteed || rate.transit?.guaranteed;
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

        // Apply sorting
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

    // Handlers
    const handleAddressSelect = (address, type) => {
        if (type === 'from') setShipFromAddress(address);
        else setShipToAddress(address);
    };
    const handleCustomerSelect = (customer) => {
        setSelectedCustomer(customer);
        setShipToAddress(null); // Clear ship to address when customer changes
    };

    // Handle rate selection
    const handleRateSelect = useCallback((rate) => {
        const newRateId = rate.id || rate.quoteId || rate.rateId;

        if (selectedRate?.id === newRateId) {
            // Deselect if clicking the same rate
            setSelectedRate(null);
        } else {
            console.log('Rate selected:', rate);
            setSelectedRate(rate);
        }
    }, [selectedRate]);

    // Handle guarantee changes
    const handleGuaranteeChange = useCallback((rate, checked) => {
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

        if (selectedRate?.id === rate.id) {
            setSelectedRate(updatedRateData);
        }
    }, [rates, selectedRate]);

    // Format address for display
    const formatAddressForDisplay = (address) => {
        if (!address) return '';
        const parts = [address.companyName, address.street, address.city, address.state, address.postalCode, address.country].filter(Boolean);
        return parts.join(', ');
    };

    // Unit conversion functions
    const lbsToKg = (lbs) => (lbs * 0.453592).toFixed(2);
    const kgToLbs = (kg) => (kg * 2.20462).toFixed(2);
    const inchesToCm = (inches) => (inches * 2.54).toFixed(1);
    const cmToInches = (cm) => (cm / 2.54).toFixed(1);

    // Form validation for booking (full validation required)
    const validateBookingForm = () => {
        const errors = {};

        // Shipment info validation
        if (!shipmentInfo.shipmentType) {
            errors.shipmentType = 'Shipment type is required';
        }
        if (!shipmentInfo.shipmentDate) {
            errors.shipmentDate = 'Shipment date is required';
        }

        // Address validation
        if (!shipFromAddress) {
            errors.shipFrom = 'Ship from address is required';
        }
        if (!shipToAddress) {
            errors.shipTo = 'Ship to address is required';
        }

        // Package validation
        if (!packages || packages.length === 0) {
            errors.packages = 'At least one package is required';
        } else {
            packages.forEach((pkg, index) => {
                // Check itemDescription (not description)
                if (!pkg.itemDescription || pkg.itemDescription.trim() === '') {
                    errors[`package_${index}_itemDescription`] = 'Package description is required';
                }
                // Check weight
                if (!pkg.weight || parseFloat(pkg.weight) <= 0) {
                    errors[`package_${index}_weight`] = 'Package weight is required and must be greater than 0';
                }
                // Check dimensions
                if (!pkg.length || parseFloat(pkg.length) <= 0) {
                    errors[`package_${index}_length`] = 'Package length is required and must be greater than 0';
                }
                if (!pkg.width || parseFloat(pkg.width) <= 0) {
                    errors[`package_${index}_width`] = 'Package width is required and must be greater than 0';
                }
                if (!pkg.height || parseFloat(pkg.height) <= 0) {
                    errors[`package_${index}_height`] = 'Package height is required and must be greater than 0';
                }
            });
        }

        // Rate validation for booking
        if (!selectedRate) {
            errors.selectedRate = 'Please select a shipping rate';
        }

        setFormErrors(errors);

        // Log validation errors for debugging
        if (Object.keys(errors).length > 0) {
            console.log('Booking validation errors:', errors);
        }

        return Object.keys(errors).length === 0;
    };

    // Form validation (basic validation for draft saving - removed strict validation)
    const validateForm = () => {
        // For Ship Later, we don't validate anything - save whatever state exists
        // This matches QuickShip's handleShipLater behavior
        return true;
    };

    // Package management functions (QuickShip style)
    const addPackage = () => {
        const newId = Math.max(...packages.map(p => p.id), 0) + 1;

        // Set defaults based on shipment type
        const isCourier = shipmentInfo.shipmentType === 'courier';
        const defaultPackage = {
            id: newId,
            itemDescription: '',
            packagingType: isCourier ? 244 : 262, // BOX(ES) for courier, SKID(S) for freight
            packagingQuantity: 1,
            weight: '',
            length: isCourier ? '12' : '48', // 12" for courier box, 48" for freight skid
            width: isCourier ? '12' : '40',  // 12" for courier box, 40" for freight skid
            height: isCourier ? '12' : '',   // 12" for courier box, empty for freight skid
            unitSystem: 'imperial',
            freightClass: ''
        };

        setPackages(prev => [...prev, defaultPackage]);
    };

    const removePackage = (id) => {
        if (packages.length > 1) {
            setPackages(prev => prev.filter(p => p.id !== id));
        }
    };

    const updatePackage = (id, field, value) => {
        setPackages(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    };

    const handlePackageUnitChange = (packageId, newUnitSystem) => {
        setPackages(prev => prev.map(pkg => {
            if (pkg.id === packageId) {
                const updatedPkg = { ...pkg, unitSystem: newUnitSystem };

                // Convert existing values if they exist
                if (pkg.weight) {
                    updatedPkg.weight = newUnitSystem === 'metric' ? lbsToKg(pkg.weight) : kgToLbs(pkg.weight);
                }
                if (pkg.length) {
                    updatedPkg.length = newUnitSystem === 'metric' ? inchesToCm(pkg.length) : cmToInches(pkg.length);
                }
                if (pkg.width) {
                    updatedPkg.width = newUnitSystem === 'metric' ? inchesToCm(pkg.width) : cmToInches(pkg.width);
                }
                if (pkg.height) {
                    updatedPkg.height = newUnitSystem === 'metric' ? inchesToCm(pkg.height) : cmToInches(pkg.height);
                }

                return updatedPkg;
            }
            return pkg;
        }));
    };

    // Show snackbar message
    const showMessage = (message, severity = 'success') => {
        setSnackbar({ open: true, message, severity });
    };

    // Get country flag emoji
    const getCountryFlag = (country) => {
        const countryFlags = {
            'US': '🇺🇸',
            'CA': '🇨🇦',
            'Canada': '🇨🇦',
            'United States': '🇺🇸'
        };
        return countryFlags[country] || '';
    };

    // Handle additional options change
    const handleAdditionalOptionsChange = (field, value) => {
        setAdditionalOptions(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // Handle copy shipment ID to clipboard
    const handleCopyShipmentId = async () => {
        if (!shipmentID) return;

        try {
            await navigator.clipboard.writeText(shipmentID);
            showMessage('Shipment ID copied to clipboard!', 'success');
        } catch (error) {
            console.error('Failed to copy shipment ID:', error);
            showMessage('Failed to copy shipment ID', 'error');
        }
    };

    // Address dialog handlers
    const handleOpenAddAddress = (mode) => {
        setAddressEditMode(mode);
        setIsSliding(true);
        setTimeout(() => {
            setCurrentView('addaddress');
            setIsSliding(false);
        }, 150);
    };

    const handleBackToCreateShipment = () => {
        setIsSliding(true);
        setTimeout(() => {
            setCurrentView('createshipment');
            setIsSliding(false);
        }, 150);
    };

    // Handle address creation callback
    const handleAddressCreated = async (newAddressId) => {
        console.log('Address created with ID:', newAddressId);

        // Reload addresses to include the new one
        setLoadingAddresses(true);
        try {
            const addressQuery = query(
                collection(db, 'addressBook'),
                where('companyID', '==', companyIdForAddress),
                where('status', '==', 'active')
            );
            const addressSnapshot = await getDocs(addressQuery);
            const addresses = addressSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setAvailableAddresses(addresses);

            // Find and select the new address
            const newAddress = addresses.find(addr => addr.id === newAddressId);
            if (newAddress) {
                handleAddressSelect(newAddress, addressEditMode);
            }
        } catch (error) {
            console.error('Error loading addresses:', error);
        } finally {
            setLoadingAddresses(false);
        }

        // Return to main view
        handleBackToCreateShipment();
    };

    // Save draft handler (no validation - save whatever state exists)
    const handleSaveAsDraft = async () => {
        // Check if user is authenticated before proceeding
        if (!user?.uid) {
            showMessage('User authentication required to save draft', 'error');
            return;
        }

        if (!companyData?.companyID) {
            showMessage('Company information required to save draft', 'error');
            return;
        }

        setIsSavingDraft(true);

        try {
            // Remove validation completely - Ship Later should save whatever is currently entered
            // This allows users to save incomplete work and come back later
            // This matches QuickShip's handleShipLater behavior

            console.log('Saving CreateShipmentX draft:', {
                shipmentID,
                isEditingDraft,
                draftIdToLoad,
                activeDraftId,
                userUid: user?.uid,
                companyID: companyData?.companyID
            });

            // Ensure we have a shipment ID
            let currentShipmentID = shipmentID;
            if (!currentShipmentID) {
                currentShipmentID = await generateShipmentId(companyData.companyID, {});
                setShipmentID(currentShipmentID);
            }

            // Helper function to clean undefined values from objects
            const cleanObject = (obj) => {
                if (obj === null || obj === undefined) return null;
                if (typeof obj !== 'object') return obj;

                const cleaned = {};
                for (const [key, value] of Object.entries(obj)) {
                    if (value !== undefined) {
                        if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                            const cleanedValue = cleanObject(value);
                            if (cleanedValue !== null && Object.keys(cleanedValue).length > 0) {
                                cleaned[key] = cleanedValue;
                            }
                        } else {
                            cleaned[key] = value;
                        }
                    }
                }
                return Object.keys(cleaned).length > 0 ? cleaned : null;
            };

            const draftData = {
                // Basic shipment fields - ensure no undefined values
                shipmentID: currentShipmentID,
                status: 'draft',
                creationMethod: 'advanced',
                companyID: companyData.companyID,
                createdBy: user.uid, // This is now guaranteed to exist
                updatedAt: serverTimestamp(),

                // Shipment information - save whatever is entered
                shipmentInfo: {
                    shipmentType: shipmentInfo.shipmentType || 'freight',
                    serviceLevel: shipmentInfo.serviceLevel || 'Any',
                    shipmentDate: shipmentInfo.shipmentDate || new Date().toISOString().split('T')[0],
                    shipperReferenceNumber: shipmentInfo.shipperReferenceNumber || currentShipmentID,
                    billType: shipmentInfo.billType || 'third_party'
                },

                // Addresses - save null if not selected
                shipFrom: shipFromAddress || null,
                shipTo: shipToAddress || null,

                // Packages - save whatever exists
                packages: packages || [],

                // Rate information - clean undefined values if available
                ...(selectedRate ? { selectedRate: cleanObject(selectedRate) } : {}),

                // Draft specific fields
                isDraft: true,
                draftSavedAt: serverTimestamp(),
                draftVersion: increment(1)
            };

            if (isEditingDraft && (activeDraftId || draftIdToLoad)) {
                // Update existing draft
                const docId = activeDraftId || draftIdToLoad;
                await updateDoc(doc(db, 'shipments', docId), {
                    ...draftData,
                    updatedAt: serverTimestamp()
                });
                setFormErrors({}); // Clear form errors on successful save
                showMessage('Draft updated successfully');
            } else if (activeDraftId) {
                // Update the initial draft we created
                await updateDoc(doc(db, 'shipments', activeDraftId), {
                    ...draftData,
                    updatedAt: serverTimestamp()
                });
                setFormErrors({}); // Clear form errors on successful save
                showMessage('Draft saved successfully');
            } else {
                // Create new draft (fallback)
                const docRef = await addDoc(collection(db, 'shipments'), {
                    ...draftData,
                    createdAt: serverTimestamp()
                });
                setActiveDraftId(docRef.id);
                setFormErrors({}); // Clear form errors on successful save
                showMessage('Draft saved successfully');
            }

            // Return to shipments after successful save
            if (onReturnToShipments) {
                setTimeout(() => {
                    onReturnToShipments();
                }, 1000); // Small delay to show success message
            }
        } catch (error) {
            console.error('Error saving draft:', error);
            showMessage(`Failed to save draft: ${error.message}`, 'error');
        } finally {
            setIsSavingDraft(false);
        }
    };

    // Book shipment handler (full validation required)
    const handleBookShipment = async () => {
        const isValid = validateBookingForm();

        if (!isValid) {
            // Show specific error message based on what's missing
            const errorCount = Object.keys(formErrors).length;
            let errorMessage = `Please complete the following to book your shipment:`;

            // Add specific error details
            const errorDetails = [];
            if (formErrors.shipFrom) errorDetails.push('Ship from address');
            if (formErrors.shipTo) errorDetails.push('Ship to address');
            if (formErrors.selectedRate) errorDetails.push('Select a shipping rate');

            // Check package errors
            const packageErrors = Object.keys(formErrors).filter(key => key.startsWith('package_'));
            if (packageErrors.length > 0) {
                errorDetails.push('Complete package information');
            }

            if (errorDetails.length > 0) {
                errorMessage += ' ' + errorDetails.join(', ');
            }

            showMessage(errorMessage, 'error');
            return;
        }

        // Show confirmation dialog
        setShowConfirmDialog(true);
    };

    // Handle booking confirmation
    const handleConfirmBooking = () => {
        setShowConfirmDialog(false);
        setShowBookingDialog(true);
        setBookingStep('booking');
        setBookingError(null);
        bookAdvancedShipment();
    };

    // Main booking function for advanced shipments
    const bookAdvancedShipment = async () => {
        setIsBooking(true);
        setBookingError(null);

        try {
            // Use the current shipment ID or generate a new one if needed
            let finalShipmentID = shipmentID;
            if (!finalShipmentID) {
                finalShipmentID = await generateShipmentId(companyData.companyID, {});
                setShipmentID(finalShipmentID);
            }

            // Calculate total weight and pieces
            const totalWeight = packages.reduce((sum, pkg) => sum + (parseFloat(pkg.weight || 0) * parseInt(pkg.packagingQuantity || 1)), 0);
            const totalPieces = packages.reduce((sum, pkg) => sum + parseInt(pkg.packagingQuantity || 1), 0);

            // Debug: Log packages before transformation
            console.log('Packages before transformation:', packages);
            console.log('Packages count:', packages.length);

            // Prepare the rate request data for the universal booking system
            const rateRequestData = {
                // Shipment identification
                shipmentID: finalShipmentID,
                creationMethod: 'advanced',

                // Origin address (shipFrom)
                Origin: {
                    Description: shipFromAddress.companyName || '',
                    Street: shipFromAddress.street || '',
                    StreetExtra: shipFromAddress.street2 || '',
                    PostalCode: shipFromAddress.postalCode || '',
                    City: shipFromAddress.city || '',
                    State: shipFromAddress.state || '',
                    Country: {
                        Code: shipFromAddress.country || 'CA',
                        Name: shipFromAddress.country === 'CA' ? 'Canada' : 'United States',
                        UsesPostalCode: true
                    },
                    Contact: `${shipFromAddress.firstName || ''} ${shipFromAddress.lastName || ''}`.trim(),
                    Phone: shipFromAddress.phone || '',
                    Email: shipFromAddress.email || '',
                    Fax: '',
                    Mobile: '',
                    SpecialInstructions: shipFromAddress.specialInstructions || 'none'
                },

                // Destination address (shipTo)
                Destination: {
                    Description: shipToAddress.companyName || '',
                    Street: shipToAddress.street || '',
                    StreetExtra: shipToAddress.street2 || '',
                    PostalCode: shipToAddress.postalCode || '',
                    City: shipToAddress.city || '',
                    State: shipToAddress.state || '',
                    Country: {
                        Code: shipToAddress.country || 'CA',
                        Name: shipToAddress.country === 'CA' ? 'Canada' : 'United States',
                        UsesPostalCode: true
                    },
                    Contact: `${shipToAddress.firstName || ''} ${shipToAddress.lastName || ''}`.trim(),
                    Phone: shipToAddress.phone || '',
                    Email: shipToAddress.email || '',
                    Fax: '',
                    Mobile: '',
                    SpecialInstructions: shipToAddress.specialInstructions || 'none'
                },

                // Package information transformed to Items array
                Items: packages.map(pkg => ({
                    Weight: parseFloat(pkg.weight) || 0,
                    PackagingQuantity: parseInt(pkg.packagingQuantity) || 1,
                    SaidToContain: parseInt(pkg.packagingQuantity) || 1,
                    Height: parseFloat(pkg.height) || 0,
                    Width: parseFloat(pkg.width) || 0,
                    Length: parseFloat(pkg.length) || 0,
                    Stackable: true,
                    HazardousMaterial: false,
                    DeclaredValue: 0,
                    Description: pkg.itemDescription || "Package",
                    Comment: "",
                    NationalMotorFreightClassification: "",
                    HarmonizedTariffSchedule: "",
                    Packaging: {
                        Key: parseInt(pkg.packagingType) || 262,
                        PackageName: PACKAGING_TYPES.find(pt => pt.value === pkg.packagingType)?.label || "SKID(S)",
                        DefaultLength: 0,
                        DefaultHeight: 0,
                        DefaultWidth: 0
                    },
                    FreightClass: {
                        FreightClass: parseFloat(pkg.freightClass) || 50.0
                    }
                })),

                // Also include packages in the original format for compatibility
                packages: packages,

                // Shipment metadata
                shipmentInfo: {
                    ...shipmentInfo,
                    totalWeight: totalWeight,
                    totalPieces: totalPieces,
                    actualShipDate: shipmentInfo.shipmentDate
                },

                // Additional services and options
                additionalOptions: additionalOptions
            };

            // Debug: Log the final rate request data
            console.log('Final rateRequestData:', rateRequestData);
            console.log('Items array length:', rateRequestData.Items?.length || 0);
            console.log('Items array:', rateRequestData.Items);

            // Helper function to clean undefined values from objects (including nested objects)
            const cleanUndefinedValues = (obj) => {
                if (obj === null || obj === undefined) return null;
                if (typeof obj !== 'object') return obj;
                if (Array.isArray(obj)) return obj.map(cleanUndefinedValues);

                const cleaned = {};
                for (const [key, value] of Object.entries(obj)) {
                    if (value !== undefined) {
                        if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                            const cleanedValue = cleanUndefinedValues(value);
                            if (cleanedValue !== null) {
                                cleaned[key] = cleanedValue;
                            }
                        } else {
                            cleaned[key] = value;
                        }
                    }
                }
                return Object.keys(cleaned).length > 0 ? cleaned : null;
            };

            // Create the main shipment document first
            const shipmentData = {
                shipmentID: finalShipmentID,
                status: 'pending',
                creationMethod: 'advanced',
                companyID: companyData.companyID,
                createdBy: user.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),

                // Shipment information
                shipmentInfo: {
                    ...shipmentInfo,
                    totalWeight: totalWeight,
                    totalPieces: totalPieces,
                    actualShipDate: shipmentInfo.shipmentDate
                },

                // Addresses
                shipFrom: { ...shipFromAddress, type: 'origin' },
                shipTo: { ...shipToAddress, type: 'destination' },

                // Packages
                packages: packages.map(pkg => ({
                    ...pkg,
                    weight: parseFloat(pkg.weight || 0),
                    packagingQuantity: parseInt(pkg.packagingQuantity || 1),
                    length: parseFloat(pkg.length || 0),
                    width: parseFloat(pkg.width || 0),
                    height: parseFloat(pkg.height || 0)
                })),

                // Selected rate and carrier information (clean undefined values)
                selectedRate: cleanUndefinedValues(selectedRate),
                carrier: selectedRate?.carrier?.name || selectedRate?.sourceCarrierName || 'Unknown',
                totalCharges: selectedRate?.pricing?.total || selectedRate?.totalCharges || 0,
                currency: selectedRate?.pricing?.currency || 'USD',

                // Advanced shipment specific flags
                isAdvanced: true,
                rateSource: 'api',
                bookingTimestamp: new Date().toISOString()
            };

            console.log('Advanced shipment booking data prepared:', {
                shipmentID: finalShipmentID,
                carrier: shipmentData.carrier,
                totalWeight,
                totalPieces,
                totalCharges: shipmentData.totalCharges
            });

            // First save the shipment to Firestore
            let draftFirestoreDocId;
            if (isEditingDraft && (activeDraftId || draftIdToLoad)) {
                // Update existing draft
                draftFirestoreDocId = activeDraftId || draftIdToLoad;
                await updateDoc(doc(db, 'shipments', draftFirestoreDocId), shipmentData);
            } else {
                // Create new shipment document
                const docRef = await addDoc(collection(db, 'shipments'), shipmentData);
                draftFirestoreDocId = docRef.id;
            }

            // Save the selected rate to a separate collection for the booking process
            // Ensure the rate data has the required fields for booking
            const enhancedRateData = {
                ...selectedRate,

                // CRITICAL: Add required fields for eShipPlus booking
                carrierKey: selectedRate?.carrier?.key || selectedRate?.carrierKey,
                carrierName: selectedRate?.carrier?.name || selectedRate?.carrierName || selectedRate?.sourceCarrierName,
                carrierScac: selectedRate?.carrier?.scac || selectedRate?.carrierScac,

                // Ensure pricing fields are available in expected format
                totalCharges: selectedRate?.pricing?.total || selectedRate?.totalCharges || 0,
                freightCharges: selectedRate?.pricing?.freight || selectedRate?.freightCharges || 0,
                fuelCharges: selectedRate?.pricing?.fuel || selectedRate?.fuelCharges || 0,
                serviceCharges: selectedRate?.pricing?.service || selectedRate?.serviceCharges || 0,
                accessorialCharges: selectedRate?.pricing?.accessorial || selectedRate?.accessorialCharges || 0,

                // Transit information
                transitTime: selectedRate?.transit?.days || selectedRate?.transitDays || selectedRate?.transitTime || 0,
                transitDays: selectedRate?.transit?.days || selectedRate?.transitDays || selectedRate?.transitTime || 0,
                estimatedDeliveryDate: selectedRate?.transit?.estimatedDelivery || selectedRate?.estimatedDeliveryDate,

                // Weight information  
                billedWeight: selectedRate?.weight?.billed || selectedRate?.billedWeight || 0,
                ratedWeight: selectedRate?.weight?.rated || selectedRate?.ratedWeight || 0,
                ratedCubicFeet: selectedRate?.dimensions?.cubicFeet || selectedRate?.ratedCubicFeet || 0,

                // Service information
                serviceMode: selectedRate?.service?.mode || selectedRate?.serviceMode || 0,
                serviceType: selectedRate?.service?.type || selectedRate?.serviceType,

                // Rate identifiers
                rateId: selectedRate?.id || selectedRate?.rateId,
                quoteId: selectedRate?.quoteId,

                // Source carrier information for proper routing
                sourceCarrierSystem: selectedRate?.sourceCarrier?.system || selectedRate?.sourceCarrierSystem,
                sourceCarrierName: selectedRate?.sourceCarrier?.name || selectedRate?.sourceCarrierName,
                sourceCarrier: selectedRate?.sourceCarrier
            };

            console.log('Enhanced rate data for booking:', enhancedRateData);

            // Create a comprehensive rate document following the same structure as Rates.jsx
            const rateDocumentForCollection = {
                // Core identifiers
                shipmentId: finalShipmentID,
                rateId: selectedRate.id || selectedRate.quoteId,
                quoteId: selectedRate.quoteId,

                // CRITICAL: Source carrier information for booking routing
                sourceCarrier: selectedRate.sourceCarrier?.key || selectedRate.carrier?.id || 'UNKNOWN',
                sourceCarrierName: selectedRate.sourceCarrier?.name || selectedRate.carrier?.name || 'Unknown',
                sourceCarrierSystem: selectedRate.sourceCarrier?.system || 'unknown',

                // Display carrier information
                displayCarrier: selectedRate.displayCarrier?.name || selectedRate.carrier?.name,
                displayCarrierId: selectedRate.displayCarrier?.id || selectedRate.carrier?.id,
                displayCarrierScac: selectedRate.displayCarrier?.scac || selectedRate.carrier?.scac,

                // Legacy carrier fields (CRITICAL for eShipPlus booking)
                carrier: selectedRate.carrier?.name,
                carrierId: selectedRate.carrier?.id,
                carrierScac: selectedRate.carrier?.scac,
                carrierKey: selectedRate.carrier?.key, // This is the missing field!

                // Service information
                service: selectedRate.service?.name,
                serviceCode: selectedRate.service?.code,
                serviceType: selectedRate.service?.type,
                serviceMode: selectedRate.service?.mode,

                // Pricing information
                totalCharges: selectedRate.pricing?.total,
                freightCharges: selectedRate.pricing?.freight,
                fuelCharges: selectedRate.pricing?.fuel,
                serviceCharges: selectedRate.pricing?.service,
                accessorialCharges: selectedRate.pricing?.accessorial,
                currency: selectedRate.pricing?.currency,

                // Transit information
                transitTime: selectedRate.transit?.days,
                transitDays: selectedRate.transit?.days,
                estimatedDeliveryDate: selectedRate.transit?.estimatedDelivery,
                guaranteed: selectedRate.transit?.guaranteed,

                // Weight information
                billedWeight: selectedRate.weight?.billed,
                ratedWeight: selectedRate.weight?.rated,

                // CRITICAL: Store the complete rate object for booking
                universalRateData: selectedRate,
                rawRateDetails: selectedRate, // This is what the booking function looks for
                rateData: cleanUndefinedValues(enhancedRateData), // Keep the enhanced data too

                // Status and metadata
                status: 'selected_for_booking',
                createdAt: serverTimestamp(),
                selectedFor: 'booking'
            };

            const rateDoc = await addDoc(collection(db, 'shipmentRates'), cleanUndefinedValues(rateDocumentForCollection));

            setDocumentGenerationStatus('Processing booking with carrier...');
            setBookingStep('generating_documents');

            // Call the universal booking function
            const functions = getFunctions();
            const bookRateUniversal = httpsCallable(functions, 'bookRateUniversal');

            const bookingResult = await bookRateUniversal({
                rateRequestData: rateRequestData,
                draftFirestoreDocId: draftFirestoreDocId,
                selectedRateDocumentId: rateDoc.id
            });

            console.log('Advanced shipment booking result:', bookingResult);

            if (bookingResult.data && bookingResult.data.success) {
                const bookingDetails = bookingResult.data.data;
                setFinalShipmentId(finalShipmentID);

                // Set completion status based on shipment type
                if (shipmentInfo.shipmentType === 'freight') {
                    setDocumentGenerationStatus('BOL and carrier confirmation documents generated successfully!');
                } else {
                    setDocumentGenerationStatus('Labels and shipping documents generated successfully!');
                }

                console.log('Advanced shipment booking successful!');
                setBookingStep('completed');

            } else {
                const errorMessage = bookingResult.data?.error || 'Booking failed. Please try again.';
                console.error('Advanced shipment booking error:', errorMessage);
                setBookingError(errorMessage);
                setBookingStep('error');
            }

        } catch (error) {
            console.error('Error booking advanced shipment:', error);

            let errorMessage = 'Booking failed. Please try again.';
            if (error.code === 'functions/unavailable' || error.message?.includes('network')) {
                errorMessage = 'Network error. Please check your connection and try again.';
            } else if (error.message?.includes('validation')) {
                errorMessage = error.message;
            }

            setBookingError(errorMessage);
            setBookingStep('error');
        } finally {
            setIsBooking(false);
        }
    };

    // Handle booking completion
    const handleBookingComplete = () => {
        setShowBookingDialog(false);

        // Close the CreateShipmentX modal/form first
        if (onClose) {
            onClose();
        }

        // Navigate back to shipments
        if (onReturnToShipments) {
            onReturnToShipments();
        }
    };

    // Handle view shipment
    const handleViewShipment = () => {
        setShowBookingDialog(false);

        // Close the CreateShipmentX modal/form first
        if (onClose) {
            onClose();
        }

        if (finalShipmentId && onViewShipment) {
            // Call the onViewShipment prop to open shipment detail
            onViewShipment(finalShipmentId);
        } else if (onReturnToShipments) {
            onReturnToShipments();
        }
    };

    return (
        <Box sx={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Modal Header */}
            {isModal && (
                <ModalHeader
                    title={isEditingDraft ? `Edit Dynamic Shipment Draft${shipmentID ? ` - ${shipmentID}` : ''}` : `Dynamic Shipment${shipmentID ? ` - ${shipmentID}` : ''}`}
                    onClose={onClose}
                    showCloseButton={showCloseButton}
                />
            )}

            {/* Loading state while waiting for authentication and company data */}
            {(authLoading || companyLoading) && (
                <Box sx={{
                    flex: 1,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    flexDirection: 'column',
                    gap: 2
                }}>
                    <CircularProgress />
                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                        Loading user and company information...
                    </Typography>
                </Box>
            )}

            {/* Show error state if contexts are loaded but data is missing */}
            {!authLoading && !companyLoading && (!user?.uid || !companyData?.companyID) && (
                <Box sx={{
                    flex: 1,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    flexDirection: 'column',
                    gap: 2
                }}>
                    <Typography variant="h6" sx={{ color: '#ef4444', fontSize: '16px' }}>
                        Authentication Error
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                        {!user?.uid ? 'User authentication required' : 'Company information not available'}
                    </Typography>
                    <Button variant="contained" onClick={() => window.location.reload()}>
                        Refresh Page
                    </Button>
                </Box>
            )}

            {/* Main content - only show when both contexts are loaded and data is available */}
            {!authLoading && !companyLoading && user?.uid && companyData?.companyID && (
                <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                    {/* Shipment Information */}
                    <Card sx={{ mb: 3, border: '1px solid #e5e7eb', borderRadius: 2 }}>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px', mb: 3, color: '#374151' }}>
                                Shipment Information
                            </Typography>
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>Shipment Type</InputLabel>
                                        <Select
                                            value={shipmentInfo.shipmentType}
                                            onChange={(e) => setShipmentInfo(prev => ({ ...prev, shipmentType: e.target.value }))}
                                            label="Shipment Type"
                                            sx={{
                                                fontSize: '12px',
                                                '& .MuiSelect-select': { fontSize: '12px' }
                                            }}
                                        >
                                            <MenuItem value="courier" sx={{ fontSize: '12px' }}>Courier</MenuItem>
                                            <MenuItem value="freight" sx={{ fontSize: '12px' }}>Freight</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Shipment Date"
                                        type="date"
                                        value={shipmentInfo.shipmentDate}
                                        onChange={(e) => setShipmentInfo(prev => ({ ...prev, shipmentDate: e.target.value }))}
                                        InputLabelProps={{ shrink: true, sx: { fontSize: '12px' } }}
                                        sx={{
                                            '& .MuiInputBase-input': {
                                                fontSize: '12px',
                                                '&::placeholder': { fontSize: '12px' }
                                            }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>Service Level</InputLabel>
                                        <Select
                                            value={shipmentInfo.serviceLevel}
                                            label="Service Level"
                                            onChange={(e) => setShipmentInfo(prev => ({ ...prev, serviceLevel: e.target.value }))}
                                            sx={{
                                                fontSize: '12px',
                                                '& .MuiSelect-select': { fontSize: '12px' }
                                            }}
                                        >
                                            {(shipmentInfo.shipmentType === 'courier' ? COURIER_SERVICE_LEVELS : FREIGHT_SERVICE_LEVELS).map(level => (
                                                <MenuItem key={level.value} value={level.value} sx={{ fontSize: '12px' }}>
                                                    {level.label}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Reference Number"
                                        value={shipmentInfo.shipperReferenceNumber}
                                        onChange={(e) => setShipmentInfo(prev => ({ ...prev, shipperReferenceNumber: e.target.value }))}
                                        sx={{
                                            '& .MuiInputBase-input': {
                                                fontSize: '12px',
                                                '&::placeholder': { fontSize: '12px' }
                                            },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>Bill Type</InputLabel>
                                        <Select
                                            value={shipmentInfo.billType}
                                            onChange={(e) => setShipmentInfo(prev => ({ ...prev, billType: e.target.value }))}
                                            label="Bill Type"
                                            sx={{
                                                fontSize: '12px',
                                                '& .MuiSelect-select': { fontSize: '12px' }
                                            }}
                                        >
                                            <MenuItem value="prepaid" sx={{ fontSize: '12px' }}>Prepaid (Sender Pays)</MenuItem>
                                            <MenuItem value="collect" sx={{ fontSize: '12px' }}>Collect (Receiver Pays)</MenuItem>
                                            <MenuItem value="third_party" sx={{ fontSize: '12px' }}>Third Party</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                                {shipmentID && (
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label="Shipment ID"
                                            value={shipmentID}
                                            InputProps={{
                                                readOnly: true,
                                                endAdornment: (
                                                    <InputAdornment position="end">
                                                        <Tooltip title="Copy Shipment ID">
                                                            <IconButton
                                                                onClick={handleCopyShipmentId}
                                                                size="small"
                                                                sx={{
                                                                    color: '#6b7280',
                                                                    '&:hover': {
                                                                        color: '#1976d2',
                                                                        backgroundColor: 'rgba(25, 118, 210, 0.1)'
                                                                    }
                                                                }}
                                                            >
                                                                <ContentCopyIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </InputAdornment>
                                                )
                                            }}
                                            sx={{
                                                '& .MuiInputBase-input': { fontWeight: 600, color: '#1976d2', fontSize: '12px' },
                                                '& .MuiInputLabel-root': { fontSize: '12px' }
                                            }}
                                        />
                                    </Grid>
                                )}
                            </Grid>
                        </CardContent>
                    </Card>

                    {/* Ship From Section */}
                    <Card sx={{ mb: 3, border: '1px solid #e5e7eb', borderRadius: 2 }}>
                        <CardContent sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                    Ship From
                                </Typography>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => handleOpenAddAddress('from')}
                                    startIcon={<AddIcon />}
                                    sx={{ fontSize: '12px' }}
                                >
                                    New Address
                                </Button>
                            </Box>

                            <Autocomplete
                                fullWidth
                                options={availableAddresses}
                                getOptionLabel={(option) => `${option.companyName} - ${formatAddressForDisplay(option)}`}
                                value={shipFromAddress}
                                onChange={(event, newValue) => handleAddressSelect(newValue, 'from')}
                                loading={loadingAddresses}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Select Ship From Address"
                                        placeholder="Search addresses..."
                                        size="small"
                                        required
                                        error={!!formErrors.shipFrom}
                                        helperText={formErrors.shipFrom}
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                        }}
                                        InputProps={{
                                            ...params.InputProps,
                                            endAdornment: (
                                                <>
                                                    {loadingAddresses ? <CircularProgress color="inherit" size={20} /> : null}
                                                    {params.InputProps.endAdornment}
                                                </>
                                            ),
                                        }}
                                    />
                                )}
                                renderOption={(props, option) => (
                                    <Box component="li" {...props} sx={{
                                        fontSize: '12px',
                                        flexDirection: 'column',
                                        alignItems: 'flex-start !important',
                                        py: 1,
                                        textAlign: 'left !important',
                                        justifyContent: 'flex-start !important',
                                        display: 'flex !important'
                                    }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '12px', textAlign: 'left', width: '100%' }}>
                                            {option.companyName}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px', textAlign: 'left', width: '100%' }}>
                                            {formatAddressForDisplay(option)}
                                        </Typography>
                                    </Box>
                                )}
                                sx={{
                                    '& .MuiAutocomplete-option': {
                                        fontSize: '12px !important',
                                        textAlign: 'left !important',
                                        justifyContent: 'flex-start !important',
                                        alignItems: 'flex-start !important',
                                        display: 'flex !important'
                                    }
                                }}
                            />

                            {shipFromAddress && (
                                <Box sx={{ mt: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e5e7eb', position: 'relative' }}>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} md={3}>
                                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                Company & Contact
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '12px', mb: 0.5 }}>
                                                <strong>{shipFromAddress.companyName}</strong>
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                {shipFromAddress.firstName} {shipFromAddress.lastName}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={12} md={3}>
                                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                Street Address
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '12px', mb: 0.5 }}>
                                                {shipFromAddress.street}
                                            </Typography>
                                            {shipFromAddress.street2 && (
                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                    {shipFromAddress.street2}
                                                </Typography>
                                            )}
                                        </Grid>
                                        <Grid item xs={12} md={3}>
                                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                Location
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '12px', mb: 0.5 }}>
                                                {shipFromAddress.city}, {shipFromAddress.state}
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                {shipFromAddress.postalCode}, {shipFromAddress.country}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={12} md={3}>
                                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                Contact Information
                                            </Typography>
                                            {shipFromAddress.email && (
                                                <Typography variant="body2" sx={{ fontSize: '12px', mb: 0.5 }}>
                                                    📧 {shipFromAddress.email}
                                                </Typography>
                                            )}
                                            {shipFromAddress.phone && (
                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                    📞 {shipFromAddress.phone}
                                                </Typography>
                                            )}
                                            {!shipFromAddress.email && !shipFromAddress.phone && (
                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>
                                                    No contact info available
                                                </Typography>
                                            )}
                                        </Grid>
                                    </Grid>
                                    {/* Country Flag in bottom right corner */}
                                    {getCountryFlag(shipFromAddress.country) && (
                                        <Box sx={{
                                            position: 'absolute',
                                            bottom: 8,
                                            right: 8,
                                            fontSize: '20px',
                                            opacity: 0.7
                                        }}>
                                            {getCountryFlag(shipFromAddress.country)}
                                        </Box>
                                    )}
                                </Box>
                            )}
                        </CardContent>
                    </Card >

                    {/* Ship To Section */}
                    <Card sx={{ mb: 3, border: '1px solid #e5e7eb', borderRadius: 2 }}>
                        <CardContent sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                    Ship To
                                </Typography>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    onClick={() => handleOpenAddAddress('to')}
                                    startIcon={<AddIcon />}
                                    sx={{ fontSize: '12px' }}
                                >
                                    New Address
                                </Button>
                            </Box>

                            <Autocomplete
                                fullWidth
                                options={availableAddresses}
                                getOptionLabel={(option) => `${option.companyName} - ${formatAddressForDisplay(option)}`}
                                value={shipToAddress}
                                onChange={(event, newValue) => handleAddressSelect(newValue, 'to')}
                                loading={loadingAddresses}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Select Ship To Address"
                                        placeholder="Search addresses..."
                                        size="small"
                                        required
                                        error={!!formErrors.shipTo}
                                        helperText={formErrors.shipTo}
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                        }}
                                        InputProps={{
                                            ...params.InputProps,
                                            endAdornment: (
                                                <>
                                                    {loadingAddresses ? <CircularProgress color="inherit" size={20} /> : null}
                                                    {params.InputProps.endAdornment}
                                                </>
                                            ),
                                        }}
                                    />
                                )}
                                renderOption={(props, option) => (
                                    <Box component="li" {...props} sx={{
                                        fontSize: '12px',
                                        flexDirection: 'column',
                                        alignItems: 'flex-start !important',
                                        py: 1,
                                        textAlign: 'left !important',
                                        justifyContent: 'flex-start !important',
                                        display: 'flex !important'
                                    }}>
                                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '12px', textAlign: 'left', width: '100%' }}>
                                            {option.companyName}
                                        </Typography>
                                        <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px', textAlign: 'left', width: '100%' }}>
                                            {formatAddressForDisplay(option)}
                                        </Typography>
                                    </Box>
                                )}
                                sx={{
                                    '& .MuiAutocomplete-option': {
                                        fontSize: '12px !important',
                                        textAlign: 'left !important',
                                        justifyContent: 'flex-start !important',
                                        alignItems: 'flex-start !important',
                                        display: 'flex !important'
                                    }
                                }}
                            />

                            {shipToAddress && (
                                <Box sx={{ mt: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e5e7eb', position: 'relative' }}>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} md={3}>
                                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                Company & Contact
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '12px', mb: 0.5 }}>
                                                <strong>{shipToAddress.companyName}</strong>
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                {shipToAddress.firstName} {shipToAddress.lastName}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={12} md={3}>
                                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                Street Address
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '12px', mb: 0.5 }}>
                                                {shipToAddress.street}
                                            </Typography>
                                            {shipToAddress.street2 && (
                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                    {shipToAddress.street2}
                                                </Typography>
                                            )}
                                        </Grid>
                                        <Grid item xs={12} md={3}>
                                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                Location
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '12px', mb: 0.5 }}>
                                                {shipToAddress.city}, {shipToAddress.state}
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                {shipToAddress.postalCode}, {shipToAddress.country}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={12} md={3}>
                                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                Contact Information
                                            </Typography>
                                            {shipToAddress.email && (
                                                <Typography variant="body2" sx={{ fontSize: '12px', mb: 0.5 }}>
                                                    📧 {shipToAddress.email}
                                                </Typography>
                                            )}
                                            {shipToAddress.phone && (
                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                    📞 {shipToAddress.phone}
                                                </Typography>
                                            )}
                                            {!shipToAddress.email && !shipToAddress.phone && (
                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>
                                                    No contact info available
                                                </Typography>
                                            )}
                                        </Grid>
                                    </Grid>
                                    {/* Country Flag in bottom right corner */}
                                    {getCountryFlag(shipToAddress.country) && (
                                        <Box sx={{
                                            position: 'absolute',
                                            bottom: 8,
                                            right: 8,
                                            fontSize: '20px',
                                            opacity: 0.7
                                        }}>
                                            {getCountryFlag(shipToAddress.country)}
                                        </Box>
                                    )}
                                </Box>
                            )}
                        </CardContent>
                    </Card>

                    {/* Packages Section */}
                    <Card sx={{ mb: 3, border: '1px solid #e5e7eb', borderRadius: 2 }}>
                        <CardContent sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                    Package Information
                                </Typography>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={addPackage}
                                    sx={{ fontSize: '12px' }}
                                >
                                    Add Package
                                </Button>
                            </Box>

                            {packages.map((pkg, index) => (
                                <Box
                                    key={`${pkg.id}`}
                                    component="fieldset"
                                    sx={{
                                        border: '1px solid #e5e7eb',
                                        borderRadius: 2,
                                        p: 2,
                                        mb: 2,
                                        position: 'relative'
                                    }}
                                >
                                    <Box
                                        component="legend"
                                        sx={{
                                            px: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 2,
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            color: 'text.primary'
                                        }}
                                    >
                                        Package {index + 1}
                                        {packages.length > 1 && (
                                            <Button
                                                variant="outlined"
                                                color="error"
                                                size="small"
                                                onClick={() => removePackage(pkg.id)}
                                                sx={{
                                                    fontSize: '10px',
                                                    textTransform: 'none',
                                                    minWidth: 'auto',
                                                    px: 1.5,
                                                    py: 0.25,
                                                    minHeight: '24px'
                                                }}
                                            >
                                                Remove
                                            </Button>
                                        )}
                                    </Box>

                                    <Grid container spacing={2}>
                                        <Grid item xs={12} md={5}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label="Item Description"
                                                value={pkg.itemDescription || ''}
                                                onChange={(e) => updatePackage(pkg.id, 'itemDescription', e.target.value)}
                                                required
                                                error={!!formErrors[`package_${index}_itemDescription`]}
                                                helperText={formErrors[`package_${index}_itemDescription`]}
                                                sx={{
                                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                                }}
                                            />
                                        </Grid>

                                        {/* Packaging Type */}
                                        <Grid item xs={12} md={4}>
                                            <FormControl fullWidth required size="small">
                                                <InputLabel sx={{ fontSize: '12px' }}>Packaging Type</InputLabel>
                                                <Select
                                                    value={pkg.packagingType || 262}
                                                    onChange={(e) => updatePackage(pkg.id, 'packagingType', e.target.value)}
                                                    label="Packaging Type"
                                                    sx={{
                                                        '& .MuiSelect-select': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                    }}
                                                >
                                                    {PACKAGING_TYPES.map(type => (
                                                        <MenuItem key={type.value} value={type.value} sx={{ fontSize: '12px' }}>
                                                            {type.label}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>

                                        <Grid item xs={12} md={3}>
                                            <FormControl fullWidth required size="small">
                                                <InputLabel sx={{ fontSize: '12px' }}>Qty</InputLabel>
                                                <Select
                                                    value={pkg.packagingQuantity || 1}
                                                    onChange={(e) => updatePackage(pkg.id, 'packagingQuantity', e.target.value)}
                                                    label="Qty"
                                                    sx={{
                                                        '& .MuiSelect-select': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                    }}
                                                >
                                                    {[...Array(30)].map((_, i) => (
                                                        <MenuItem key={i + 1} value={i + 1} sx={{ fontSize: '12px' }}>
                                                            {i + 1}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>

                                        <Grid item xs={12} md={2.4}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label="Weight"
                                                type="number"
                                                value={pkg.weight || ''}
                                                onChange={(e) => updatePackage(pkg.id, 'weight', e.target.value)}
                                                required
                                                error={!!formErrors[`package_${index}_weight`]}
                                                helperText={formErrors[`package_${index}_weight`]}
                                                sx={{
                                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                                }}
                                                InputProps={{
                                                    endAdornment: (
                                                        <InputAdornment position="end">
                                                            <Box
                                                                sx={{
                                                                    bgcolor: 'grey.800',
                                                                    color: 'white',
                                                                    px: 1,
                                                                    py: 0.5,
                                                                    borderRadius: 1,
                                                                    fontSize: '0.875rem'
                                                                }}
                                                            >
                                                                {(pkg.unitSystem || 'imperial') === 'metric' ? 'kg' : 'lbs'}
                                                            </Box>
                                                        </InputAdornment>
                                                    )
                                                }}
                                            />
                                        </Grid>

                                        <Grid item xs={12} md={2.4}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label="Length"
                                                type="number"
                                                value={pkg.length || ''}
                                                onChange={(e) => updatePackage(pkg.id, 'length', e.target.value)}
                                                required
                                                error={!!formErrors[`package_${index}_length`]}
                                                helperText={formErrors[`package_${index}_length`]}
                                                sx={{
                                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                                }}
                                                InputProps={{
                                                    endAdornment: (
                                                        <InputAdornment position="end">
                                                            <Box
                                                                sx={{
                                                                    bgcolor: 'grey.800',
                                                                    color: 'white',
                                                                    px: 1,
                                                                    py: 0.5,
                                                                    borderRadius: 1,
                                                                    fontSize: '0.875rem'
                                                                }}
                                                            >
                                                                {(pkg.unitSystem || 'imperial') === 'metric' ? 'cm' : 'in'}
                                                            </Box>
                                                        </InputAdornment>
                                                    )
                                                }}
                                            />
                                        </Grid>

                                        <Grid item xs={12} md={2.4}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label="Width"
                                                type="number"
                                                value={pkg.width || ''}
                                                onChange={(e) => updatePackage(pkg.id, 'width', e.target.value)}
                                                required
                                                error={!!formErrors[`package_${index}_width`]}
                                                helperText={formErrors[`package_${index}_width`]}
                                                sx={{
                                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                                }}
                                                InputProps={{
                                                    endAdornment: (
                                                        <InputAdornment position="end">
                                                            <Box
                                                                sx={{
                                                                    bgcolor: 'grey.800',
                                                                    color: 'white',
                                                                    px: 1,
                                                                    py: 0.5,
                                                                    borderRadius: 1,
                                                                    fontSize: '0.875rem'
                                                                }}
                                                            >
                                                                {(pkg.unitSystem || 'imperial') === 'metric' ? 'cm' : 'in'}
                                                            </Box>
                                                        </InputAdornment>
                                                    )
                                                }}
                                            />
                                        </Grid>

                                        <Grid item xs={12} md={2.4}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label="Height"
                                                type="number"
                                                value={pkg.height || ''}
                                                onChange={(e) => updatePackage(pkg.id, 'height', e.target.value)}
                                                required
                                                error={!!formErrors[`package_${index}_height`]}
                                                helperText={formErrors[`package_${index}_height`]}
                                                sx={{
                                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                                }}
                                                InputProps={{
                                                    endAdornment: (
                                                        <InputAdornment position="end">
                                                            <Box
                                                                sx={{
                                                                    bgcolor: 'grey.800',
                                                                    color: 'white',
                                                                    px: 1,
                                                                    py: 0.5,
                                                                    borderRadius: 1,
                                                                    fontSize: '0.875rem'
                                                                }}
                                                            >
                                                                {(pkg.unitSystem || 'imperial') === 'metric' ? 'cm' : 'in'}
                                                            </Box>
                                                        </InputAdornment>
                                                    )
                                                }}
                                            />
                                        </Grid>

                                        {/* Unit System Toggle - show for each package */}
                                        <Grid item xs={12} md={2.4}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, height: '40px', justifyContent: 'center' }}>
                                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>Imperial</Typography>
                                                <Switch
                                                    checked={(pkg.unitSystem || 'imperial') === 'metric'}
                                                    onChange={(e) => handlePackageUnitChange(pkg.id, e.target.checked ? 'metric' : 'imperial')}
                                                    sx={{
                                                        '& .MuiSwitch-switchBase.Mui-checked': {
                                                            color: 'primary.main',
                                                            '&:hover': {
                                                                backgroundColor: 'primary.light'
                                                            }
                                                        },
                                                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                                            backgroundColor: 'primary.main'
                                                        }
                                                    }}
                                                />
                                                <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>Metric</Typography>
                                            </Box>
                                        </Grid>

                                        {/* Freight Class - Only show for freight shipments */}
                                        {shipmentInfo.shipmentType === 'freight' && (
                                            <Grid item xs={12}>
                                                <FormControl fullWidth size="small">
                                                    <InputLabel sx={{ fontSize: '12px' }}>Freight Class (Optional)</InputLabel>
                                                    <Select
                                                        value={pkg.freightClass || ''}
                                                        onChange={(e) => updatePackage(pkg.id, 'freightClass', e.target.value)}
                                                        label="Freight Class (Optional)"
                                                        sx={{
                                                            '& .MuiSelect-select': { fontSize: '12px' },
                                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                                        }}
                                                        renderValue={(value) => {
                                                            if (!value) return '';
                                                            const classData = FREIGHT_CLASSES.find(fc => fc.class === value);
                                                            return classData ? `Class ${value} - ${classData.description}` : `Class ${value}`;
                                                        }}
                                                    >
                                                        <MenuItem value="" sx={{ fontSize: '12px' }}>
                                                            <em>No freight class selected</em>
                                                        </MenuItem>
                                                        {FREIGHT_CLASSES.map((fc) => (
                                                            <MenuItem key={fc.class} value={fc.class} sx={{ fontSize: '12px' }}>
                                                                <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '12px' }}>
                                                                    Class {fc.class} - {fc.description}
                                                                </Typography>
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                    <FormHelperText sx={{ fontSize: '11px' }}>
                                                        Optional: Select freight class if applicable for your shipment
                                                    </FormHelperText>
                                                </FormControl>
                                            </Grid>
                                        )}
                                    </Grid>
                                </Box>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Additional Options Section */}
                    <Card sx={{ mb: 3, border: '1px solid #e5e7eb', borderRadius: 2 }}>
                        <CardContent sx={{ p: 3 }}>
                            <Box
                                sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    cursor: 'pointer',
                                    mb: serviceOptionsExpanded ? 3 : 0
                                }}
                                onClick={() => setServiceOptionsExpanded(!serviceOptionsExpanded)}
                            >
                                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', flex: 1 }}>
                                    Additional Options
                                </Typography>
                                {serviceOptionsExpanded ? (
                                    <ExpandLessIcon sx={{ color: '#666' }} />
                                ) : (
                                    <ExpandMoreIcon sx={{ color: '#666' }} />
                                )}
                            </Box>

                            <Collapse in={serviceOptionsExpanded}>
                                <Grid container spacing={3}>
                                    {/* Delivery & Pickup Options */}
                                    <Grid item xs={12} md={6}>
                                        <Box sx={{ mb: 1 }}>
                                            <Typography variant="subtitle2" sx={{ fontSize: '13px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                Delivery & Pickup Options
                                            </Typography>
                                            <FormControl fullWidth size="small">
                                                <InputLabel sx={{ fontSize: '12px' }}>Delivery Options</InputLabel>
                                                <Select
                                                    value={additionalOptions.deliveryPickupOption || ''}
                                                    onChange={(e) => handleAdditionalOptionsChange('deliveryPickupOption', e.target.value)}
                                                    label="Delivery Options"
                                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                                >
                                                    <MenuItem value="" sx={{ fontSize: '12px' }}>
                                                        Standard Delivery
                                                    </MenuItem>
                                                    <MenuItem value="residential" sx={{ fontSize: '12px' }}>
                                                        Residential Delivery
                                                    </MenuItem>
                                                    <MenuItem value="holdForPickup" sx={{ fontSize: '12px' }}>
                                                        Hold for Pickup
                                                    </MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Box>
                                    </Grid>

                                    {/* Hazardous Goods */}
                                    <Grid item xs={12} md={6}>
                                        <Box sx={{ mb: 1 }}>
                                            <Typography variant="subtitle2" sx={{ fontSize: '13px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                Hazardous Materials
                                            </Typography>
                                            <FormControl fullWidth size="small">
                                                <InputLabel sx={{ fontSize: '12px' }}>Hazardous Goods</InputLabel>
                                                <Select
                                                    value={additionalOptions.hazardousGoods || ''}
                                                    onChange={(e) => handleAdditionalOptionsChange('hazardousGoods', e.target.value)}
                                                    label="Hazardous Goods"
                                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                                >
                                                    <MenuItem value="" sx={{ fontSize: '12px' }}>None</MenuItem>
                                                    <MenuItem value="limited_quantity" sx={{ fontSize: '12px' }}>Limited Quantity</MenuItem>
                                                    <MenuItem value="500kg_exemption" sx={{ fontSize: '12px' }}>500kg Exemption</MenuItem>
                                                    <MenuItem value="fully_regulated" sx={{ fontSize: '12px' }}>Fully Regulated</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Box>
                                    </Grid>

                                    {/* Courier-specific options */}
                                    {shipmentInfo.shipmentType === 'courier' && (
                                        <>
                                            {/* Priority Delivery */}
                                            <Grid item xs={12} md={6}>
                                                <Box sx={{ mb: 1 }}>
                                                    <Typography variant="subtitle2" sx={{ fontSize: '13px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                        Priority Delivery
                                                    </Typography>
                                                    <FormControl fullWidth size="small">
                                                        <InputLabel sx={{ fontSize: '12px' }}>Priority Options</InputLabel>
                                                        <Select
                                                            value={additionalOptions.priorityDelivery || ''}
                                                            onChange={(e) => handleAdditionalOptionsChange('priorityDelivery', e.target.value)}
                                                            label="Priority Options"
                                                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                                        >
                                                            <MenuItem value="" sx={{ fontSize: '12px' }}>Standard Delivery</MenuItem>
                                                            <MenuItem value="10am" sx={{ fontSize: '12px' }}>10AM Delivery</MenuItem>
                                                            <MenuItem value="noon" sx={{ fontSize: '12px' }}>Noon Delivery</MenuItem>
                                                            <MenuItem value="saturday" sx={{ fontSize: '12px' }}>Saturday Delivery</MenuItem>
                                                        </Select>
                                                    </FormControl>
                                                </Box>
                                            </Grid>

                                            {/* Signature Options */}
                                            <Grid item xs={12} md={6}>
                                                <Box sx={{ mb: 1 }}>
                                                    <Typography variant="subtitle2" sx={{ fontSize: '13px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                        Signature Requirements
                                                    </Typography>
                                                    <FormControl fullWidth size="small">
                                                        <InputLabel sx={{ fontSize: '12px' }}>Signature Options</InputLabel>
                                                        <Select
                                                            value={additionalOptions.signatureOptions || ''}
                                                            onChange={(e) => handleAdditionalOptionsChange('signatureOptions', e.target.value)}
                                                            label="Signature Options"
                                                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                                        >
                                                            <MenuItem value="" sx={{ fontSize: '12px' }}>No Signature Required</MenuItem>
                                                            <MenuItem value="standard" sx={{ fontSize: '12px' }}>Signature Required</MenuItem>
                                                            <MenuItem value="adult" sx={{ fontSize: '12px' }}>Adult Signature Required</MenuItem>
                                                        </Select>
                                                    </FormControl>
                                                </Box>
                                            </Grid>
                                        </>
                                    )}

                                    {/* Freight-specific options */}
                                    {shipmentInfo.shipmentType === 'freight' && (
                                        <>
                                            {/* Liftgate Service */}
                                            <Grid item xs={12} md={6}>
                                                <Box sx={{ mb: 1 }}>
                                                    <Typography variant="subtitle2" sx={{ fontSize: '13px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                        Liftgate Service
                                                    </Typography>
                                                    <FormControl fullWidth size="small">
                                                        <InputLabel sx={{ fontSize: '12px' }}>Liftgate Options</InputLabel>
                                                        <Select
                                                            value={additionalOptions.liftgateService || ''}
                                                            onChange={(e) => handleAdditionalOptionsChange('liftgateService', e.target.value)}
                                                            label="Liftgate Options"
                                                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                                        >
                                                            <MenuItem value="" sx={{ fontSize: '12px' }}>No Liftgate Required</MenuItem>
                                                            <MenuItem value="pickup" sx={{ fontSize: '12px' }}>Liftgate at Pickup</MenuItem>
                                                            <MenuItem value="delivery" sx={{ fontSize: '12px' }}>Liftgate at Delivery</MenuItem>
                                                            <MenuItem value="both" sx={{ fontSize: '12px' }}>Liftgate at Both</MenuItem>
                                                        </Select>
                                                    </FormControl>
                                                </Box>
                                            </Grid>

                                            {/* Inside Delivery */}
                                            <Grid item xs={12} md={6}>
                                                <Box sx={{ mb: 1 }}>
                                                    <Typography variant="subtitle2" sx={{ fontSize: '13px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                        Inside Delivery
                                                    </Typography>
                                                    <FormControl fullWidth size="small">
                                                        <InputLabel sx={{ fontSize: '12px' }}>Inside Delivery</InputLabel>
                                                        <Select
                                                            value={additionalOptions.insideDelivery || ''}
                                                            onChange={(e) => handleAdditionalOptionsChange('insideDelivery', e.target.value)}
                                                            label="Inside Delivery"
                                                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                                        >
                                                            <MenuItem value="" sx={{ fontSize: '12px' }}>Standard Delivery</MenuItem>
                                                            <MenuItem value="inside" sx={{ fontSize: '12px' }}>Inside Delivery</MenuItem>
                                                            <MenuItem value="threshold" sx={{ fontSize: '12px' }}>Threshold Delivery</MenuItem>
                                                        </Select>
                                                    </FormControl>
                                                </Box>
                                            </Grid>
                                        </>
                                    )}
                                </Grid>
                            </Collapse>
                        </CardContent>
                    </Card>

                    {/* Rates Section */}
                    {
                        showRates && (
                            <Card sx={{ border: '1px solid #e5e7eb', borderRadius: '8px', mb: 3 }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                        <Box>
                                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px' }}>
                                                Shipping Rates
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                onClick={() => fetchRates(true)}
                                                disabled={isLoadingRates}
                                                startIcon={<RefreshIcon />}
                                                sx={{ fontSize: '12px' }}
                                            >
                                                Refresh Rates
                                            </Button>
                                        </Box>
                                    </Box>

                                    {/* Rate status message */}
                                    {!canFetchRates() && (
                                        <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1, mb: 2 }}>
                                            <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                                Complete shipment details to get rates
                                            </Typography>
                                        </Box>
                                    )}

                                    {/* Loading State */}
                                    {isLoadingRates && (
                                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                            <CarrierLoadingDisplay
                                                loadingCarriers={loadingCarriers}
                                                completedCarriers={completedCarriers}
                                                failedCarriers={failedCarriers}
                                                isLoading={isLoadingRates}
                                            />
                                        </Box>
                                    )}

                                    {/* Error State - Simple and Elegant */}
                                    {ratesError && (
                                        <Box sx={{
                                            textAlign: 'center',
                                            py: 6,
                                            px: 3,
                                            bgcolor: '#f8fafc',
                                            borderRadius: 2,
                                            border: '1px solid #e5e7eb'
                                        }}>
                                            <Box sx={{ mb: 3 }}>
                                                <Typography
                                                    variant="h6"
                                                    sx={{
                                                        fontSize: '16px',
                                                        fontWeight: 600,
                                                        color: '#374151',
                                                        mb: 1
                                                    }}
                                                >
                                                    No rates available
                                                </Typography>
                                                <Typography
                                                    variant="body2"
                                                    sx={{
                                                        fontSize: '14px',
                                                        color: '#6b7280',
                                                        mb: 3
                                                    }}
                                                >
                                                    We couldn't find any shipping rates for your current shipment details.
                                                </Typography>
                                            </Box>

                                            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    onClick={() => {
                                                        setRatesError(null);
                                                        fetchRates(true);
                                                    }}
                                                    sx={{
                                                        fontSize: '12px',
                                                        textTransform: 'none',
                                                        borderColor: '#d1d5db',
                                                        color: '#374151'
                                                    }}
                                                >
                                                    Try Again
                                                </Button>
                                                <Button
                                                    variant="text"
                                                    size="small"
                                                    onClick={() => {
                                                        setShowRates(false);
                                                        setRatesError(null);
                                                    }}
                                                    sx={{
                                                        fontSize: '12px',
                                                        textTransform: 'none',
                                                        color: '#6366f1'
                                                    }}
                                                >
                                                    Modify Shipment
                                                </Button>
                                            </Box>

                                            <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid #e5e7eb' }}>
                                                <Typography
                                                    variant="caption"
                                                    sx={{
                                                        fontSize: '12px',
                                                        color: '#9ca3af',
                                                        fontStyle: 'italic'
                                                    }}
                                                >
                                                    Try adjusting your addresses, package dimensions, or shipment type
                                                </Typography>
                                            </Box>
                                        </Box>
                                    )}

                                    {/* Rates Display */}
                                    {!isLoadingRates && !ratesError && rates.length > 0 && (
                                        <Box>
                                            {/* Rate Filtering and Sorting Controls */}
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
                                                                variant="text"
                                                                onClick={() => setShowRateDetails(!showRateDetails)}
                                                                sx={{
                                                                    fontSize: '12px',
                                                                    textTransform: 'none',
                                                                    px: 2,
                                                                    py: 1,
                                                                    color: '#6366f1',
                                                                    '&:hover': {
                                                                        backgroundColor: 'rgba(99, 102, 241, 0.1)'
                                                                    }
                                                                }}
                                                            >
                                                                {showRateDetails ? 'Hide Details' : 'Show Details'}
                                                            </Button>
                                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', ml: 2 }}>
                                                                {filteredRates.length} of {rates.length} rates
                                                            </Typography>
                                                        </Box>
                                                    </Grid>
                                                </Grid>
                                            </Box>

                                            {/* Enhanced Rate Cards */}
                                            <Grid container spacing={3}>
                                                {filteredRates.map((rate) => (
                                                    <Grid item xs={12} md={6} lg={4} key={rate.quoteId || rate.id}>
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
                                        </Box>
                                    )}

                                    {/* No rates message */}
                                    {!isLoadingRates && !ratesError && showRates && rates.length === 0 && canFetchRates() && (
                                        <Box sx={{ textAlign: 'center', py: 4 }}>
                                            <Typography variant="body1" sx={{ color: '#6b7280' }}>
                                                No rates available. Try refreshing or adjusting your shipment details.
                                            </Typography>
                                        </Box>
                                    )}
                                </CardContent>
                            </Card>
                        )
                    }

                    {/* Combined Total and Action Section */}
                    <Box sx={{ mt: 3, p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 3 }}>
                            {/* Left side - Total cost */}
                            <Box sx={{ textAlign: 'left' }}>
                                <Typography variant="h4" sx={{
                                    fontSize: '24px',
                                    fontWeight: 700,
                                    color: '#1f2937',
                                    mb: 0.5
                                }}>
                                    Total: {selectedRate ? `$${(selectedRate.pricing?.total || selectedRate.totalCharges || selectedRate.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00'}
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                    {selectedRate ? 'Selected Rate Total' : 'No Rate Selected'}
                                </Typography>
                            </Box>

                            {/* Right side - Ready to Ship text and buttons */}
                            <Box sx={{ textAlign: 'right' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
                                    <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                        Ready to Ship?
                                    </Typography>
                                    <Box sx={{ display: 'flex', gap: 2 }}>
                                        <Button
                                            variant="outlined"
                                            startIcon={<SaveIcon />}
                                            onClick={handleSaveAsDraft}
                                            disabled={isSavingDraft}
                                            sx={{
                                                fontSize: '12px',
                                                textTransform: 'none',
                                                minWidth: 120,
                                                borderColor: '#d1d5db',
                                                color: '#374151',
                                                '&:hover': {
                                                    borderColor: '#9ca3af',
                                                    backgroundColor: '#f9fafb'
                                                }
                                            }}
                                        >
                                            {isSavingDraft ? 'Saving...' : 'Ship Later'}
                                        </Button>
                                        <Button
                                            variant="contained"
                                            color="primary"
                                            startIcon={<ShippingIcon />}
                                            onClick={handleBookShipment}
                                            disabled={!selectedRate || isBooking || isSavingDraft}
                                            sx={{
                                                fontSize: '12px',
                                                textTransform: 'none',
                                                minWidth: 120,
                                                backgroundColor: '#1976d2',
                                                '&:hover': {
                                                    backgroundColor: '#1565c0'
                                                }
                                            }}
                                        >
                                            {isBooking ? 'Booking...' : 'Book Shipment'}
                                        </Button>
                                    </Box>
                                </Box>

                                {/* Helper text below the buttons on the right */}
                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mt: 1.5 }}>
                                    Save as draft to complete later, or book now to proceed with shipping.
                                </Typography>
                            </Box>
                        </Box>
                    </Box>
                </Box >
            )}

            {/* Snackbar for messages */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={6000}
                onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                    severity={snackbar.severity}
                    sx={{ width: '100%' }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>

            {/* Address Form Modal */}
            {currentView === 'addaddress' && (
                <Box sx={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    zIndex: 2000,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 2
                }}>
                    <Box sx={{
                        width: '100%',
                        maxWidth: '800px',
                        maxHeight: '90vh',
                        backgroundColor: 'white',
                        borderRadius: 2,
                        overflow: 'auto',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        <AddressForm
                            isModal={true}
                            onCancel={handleBackToCreateShipment}
                            onSuccess={handleAddressCreated}
                        />
                    </Box>
                </Box>
            )}

            {/* Booking Confirmation Dialog */}
            <Dialog
                open={showConfirmDialog}
                onClose={() => setShowConfirmDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ textAlign: 'center', fontWeight: 600, fontSize: '18px' }}>
                    CONFIRM SHIPMENT BOOKING
                </DialogTitle>
                <DialogContent sx={{ textAlign: 'center', py: 3 }}>
                    <Typography variant="body1" sx={{ mb: 2, fontSize: '14px' }}>
                        Are you sure you want to book this shipment with <strong>{selectedRate?.carrier?.name || selectedRate?.sourceCarrierName || 'selected carrier'}</strong>?
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
                        Total cost: <strong>${(selectedRate?.pricing?.total || selectedRate?.totalCharges || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px', mt: 1 }}>
                        This will generate shipping documents and send notifications.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'center', gap: 2, pb: 3 }}>
                    <Button
                        onClick={() => setShowConfirmDialog(false)}
                        variant="outlined"
                        size="large"
                        sx={{ minWidth: 100, fontSize: '14px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirmBooking}
                        variant="contained"
                        size="large"
                        sx={{ minWidth: 100, bgcolor: '#1a237e', fontSize: '14px' }}
                    >
                        Book Now
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Booking Progress Dialog */}
            <Dialog
                open={showBookingDialog}
                onClose={() => { /* Prevent closing during booking */ }}
                maxWidth="sm"
                fullWidth
                disableEscapeKeyDown
            >
                <DialogContent sx={{ textAlign: 'center', py: 4 }}>
                    {bookingStep === 'booking' ? (
                        <>
                            <CircularProgress size={60} sx={{ mb: 3, color: '#1a237e' }} />
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, fontSize: '16px' }}>
                                Booking shipment with {selectedRate?.carrier?.name || selectedRate?.sourceCarrierName || 'carrier'}...
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
                                Please wait while we process your shipment booking.
                            </Typography>
                        </>
                    ) : bookingStep === 'generating_documents' ? (
                        <>
                            <CircularProgress size={60} sx={{ mb: 3, color: '#1a237e' }} />
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, fontSize: '16px' }}>
                                Generating Shipping Documents...
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '12px' }}>
                                {documentGenerationStatus}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
                                {shipmentInfo.shipmentType === 'freight'
                                    ? 'Generating BOL and carrier confirmation documents.'
                                    : 'Generating labels and shipping documents.'
                                }
                            </Typography>
                        </>
                    ) : bookingStep === 'completed' ? (
                        <>
                            <CheckCircleIcon sx={{ fontSize: 80, color: '#4caf50', mb: 2 }} />
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, fontSize: '16px' }}>
                                Shipment Booked Successfully!
                            </Typography>
                            <Typography variant="body1" sx={{ mb: 1, fontSize: '14px' }}>
                                Shipment ID:
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1a237e', mb: 2, fontSize: '16px' }}>
                                {finalShipmentId}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '12px' }}>
                                {shipmentInfo.shipmentType === 'freight'
                                    ? 'BOL and carrier confirmation documents have been generated.'
                                    : 'Labels and shipping documents have been generated.'
                                }
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
                                <Button
                                    onClick={handleBookingComplete}
                                    variant="outlined"
                                    size="large"
                                    sx={{ minWidth: 150, fontSize: '14px' }}
                                >
                                    Return to Shipments
                                </Button>
                                <Button
                                    onClick={handleViewShipment}
                                    variant="contained"
                                    size="large"
                                    sx={{ minWidth: 150, bgcolor: '#1a237e', fontSize: '14px' }}
                                >
                                    View Shipment
                                </Button>
                            </Box>
                        </>
                    ) : bookingStep === 'error' ? (
                        <>
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="h6" sx={{ color: '#d32f2f', mb: 2, fontWeight: 600, fontSize: '16px' }}>
                                    Booking Failed
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#6b7280', mb: 2, fontSize: '12px' }}>
                                    {bookingError || 'An error occurred while booking your shipment.'}
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                                <Button
                                    onClick={() => setShowBookingDialog(false)}
                                    variant="outlined"
                                    size="large"
                                    sx={{ minWidth: 100, fontSize: '14px' }}
                                >
                                    Close
                                </Button>
                                <Button
                                    onClick={() => {
                                        setBookingStep('booking');
                                        setBookingError(null);
                                        bookAdvancedShipment();
                                    }}
                                    variant="contained"
                                    size="large"
                                    sx={{ minWidth: 100, bgcolor: '#1a237e', fontSize: '14px' }}
                                >
                                    Try Again
                                </Button>
                            </Box>
                        </>
                    ) : null}
                </DialogContent>
            </Dialog>
        </Box>
    );
};

export default CreateShipmentX;
