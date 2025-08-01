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
    DialogActions,
    Checkbox,
    Avatar,
    AlertTitle,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Stack
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
    ContentCopy as ContentCopyIcon,
    Edit as EditIcon,
    SwapHoriz as SwapHorizIcon,
    LocationOn as LocationOnIcon,
    Person as PersonIcon,
    Business as BusinessIcon,
    Description as DescriptionIcon,
    Cancel as CancelIcon,
    Map as MapIcon,
    Clear as ClearIcon,
    FlashOn as FlashOnIcon
} from '@mui/icons-material';
import { db } from '../../firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, getDoc, limit, increment, orderBy } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission, PERMISSIONS } from '../../utils/rolePermissions';
import { fetchMultiCarrierRates, getAllCarriers, getEligibleCarriers } from '../../utils/carrierEligibility';
import { smartWarmupCarriers } from '../../utils/warmupCarriers';
import { validateUniversalRate } from '../../utils/universalDataModel';
import { generateShipmentId } from '../../utils/shipmentIdGenerator';
import markupEngine from '../../utils/markupEngine';
import ModalHeader from '../common/ModalHeader';
import { shipmentConverter } from '../../utils/shipmentConversion';
import { convertDraftInDatabase } from '../../utils/draftConversion';
import shipmentChargeTypeService from '../../services/shipmentChargeTypeService';
import { mapAPIChargesToDynamicTypes, migrateShipmentChargeCodes } from '../../utils/chargeTypeCompatibility';

import AddressForm from '../AddressBook/AddressForm';
import CompanySelector from '../common/CompanySelector';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';

// Import sophisticated rate components from Rates.jsx
import EnhancedRateCard from './EnhancedRateCard';
import CarrierLoadingDisplay from './CarrierLoadingDisplay';
import RateErrorDisplay from './RateErrorDisplay';
import ShipmentRateRequestSummary from './ShipmentRateRequestSummary';
import CarrierStatsPopover from './CarrierStatsPopover';
import EnhancedStatusChip from '../StatusChip/EnhancedStatusChip';

// Import Suspense for lazy loading
import { Suspense } from 'react';

// Lazy load the address dialog component
const AddressFormDialog = React.lazy(() => import('../AddressBook/AddressFormDialog'));
const QuickShipBrokerDialog = React.lazy(() => import('./QuickShipBrokerDialog'));

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

// Service level options are now loaded dynamically from the database via the "Service Levels" module in System Configuration

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

const CreateShipmentX = (props) => {
    console.log('🚨🚨🚨 IMMEDIATE RENDER DEBUG - FORCE REFRESH:', {
        timestamp: Date.now(),
        hasProps: !!props,
        propsKeys: Object.keys(props || {}),
        propsValues: props,
        onConvertToQuickShip: props?.onConvertToQuickShip,
        onConvertToQuickShipType: typeof props?.onConvertToQuickShip,
        onConvertToQuickShipIsFunction: typeof props?.onConvertToQuickShip === 'function',
        allPropsDetailed: JSON.stringify(props, null, 2)
    });

    const {
        onClose,
        onReturnToShipments,
        onViewShipment,
        draftId = null,
        isModal = false,
        showCloseButton = true,
        prePopulatedData,
        onShipmentUpdated = null,
        onDraftSaved = null,
        editMode = false,
        editShipment = null,
        onConvertToQuickShip = null
    } = props;

    const { companyData, companyIdForAddress, loading: companyLoading, setCompanyContext } = useCompany();
    const { currentUser: user, userRole, loading: authLoading } = useAuth();
    const debounceTimeoutRef = useRef(null);

    // Debug props immediately on render (not in useEffect)
    console.log('🔍 CreateShipmentX: IMMEDIATE props debug on render:', {
        propsObject: props,
        propsKeys: Object.keys(props),
        onConvertToQuickShipFromProps: props.onConvertToQuickShip,
        onConvertToQuickShipFromPropsType: typeof props.onConvertToQuickShip,
        destructuredOnConvertToQuickShip: onConvertToQuickShip,
        destructuredType: typeof onConvertToQuickShip,
        hasCallback: !!props.onConvertToQuickShip
    });

    // Debug props on component load - check both props object and destructured values
    useEffect(() => {
        console.log('🔍 CreateShipmentX: useEffect props debug:', {
            onConvertToQuickShip: onConvertToQuickShip,
            onConvertToQuickShipType: typeof onConvertToQuickShip,
            onConvertToQuickShipExists: !!onConvertToQuickShip,
            onConvertToQuickShipFromProps: props.onConvertToQuickShip,
            onConvertToQuickShipFromPropsType: typeof props.onConvertToQuickShip,
            isModal,
            draftId,
            editMode,
            propsKeys: Object.keys(props),
            prePopulatedDataFromProps: props.prePopulatedData,
            prePopulatedDataDestructured: prePopulatedData,
            prePopulatedDataExists: !!prePopulatedData,
            prePopulatedDataType: typeof prePopulatedData
        });
    }, [props, onConvertToQuickShip, isModal, draftId, editMode, prePopulatedData]);



    // State variables
    const [shipmentInfo, setShipmentInfo] = useState({
        shipmentType: 'freight',
        serviceLevel: 'any',
        shipmentDate: new Date().toISOString().split('T')[0],
        shipperReferenceNumber: '',
        referenceNumbers: [], // Array for multiple reference numbers
        billType: 'third_party',
        eta1: null,
        eta2: null
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
            freightClass: '',
            declaredValue: '', // Declared value amount
            declaredValueCurrency: 'CAD' // Declared value currency
        },
    ]);

    // Rates state with progressive loading support
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

    // Progressive loading state
    const [activeRateRequest, setActiveRateRequest] = useState(null);
    const [progressiveRates, setProgressiveRates] = useState([]);
    const [lastFormSnapshot, setLastFormSnapshot] = useState(null);

    // Rate filtering and sorting state
    const [sortBy, setSortBy] = useState('price');
    const [serviceFilter, setServiceFilter] = useState('any');
    const [showRateDetails, setShowRateDetails] = useState(false);

    // Additional Services state (for freight and courier shipments)
    const [additionalServices, setAdditionalServices] = useState([]);
    const [availableServices, setAvailableServices] = useState([]);
    const [loadingServices, setLoadingServices] = useState(false);
    const [servicesExpanded, setServicesExpanded] = useState(false);

    // Service Levels state
    const [availableServiceLevels, setAvailableServiceLevels] = useState([]);
    const [loadingServiceLevels, setLoadingServiceLevels] = useState(false);

    // Additional state for improved UX
    const [formErrors, setFormErrors] = useState({});
    const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

    // Broker state
    const [companyBrokers, setCompanyBrokers] = useState([]);
    const [selectedBroker, setSelectedBroker] = useState('');
    const [brokerPort, setBrokerPort] = useState('');
    const [brokerReference, setBrokerReference] = useState('');
    const [loadingBrokers, setLoadingBrokers] = useState(false);
    const [showBrokerDialog, setShowBrokerDialog] = useState(false);
    const [editingBroker, setEditingBroker] = useState(null);
    const [brokerSuccessMessage, setBrokerSuccessMessage] = useState('');
    const [brokerExpanded, setBrokerExpanded] = useState(false);

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

    // Address edit dialog state (for inline editing like QuickShip)
    const [showAddressDialog, setShowAddressDialog] = useState(false);
    const [editingAddressType, setEditingAddressType] = useState('from'); // 'from' or 'to'
    const [editingAddressData, setEditingAddressData] = useState(null);

    // Extract draft ID from prePopulatedData or props
    const draftIdToLoad = prePopulatedData?.editDraftId || draftId;

    // Check if we're editing an existing shipment
    const isEditingExistingShipment = editMode && editShipment && editShipment.status !== 'draft';

    // Company selection state for super admins
    const [selectedCompanyId, setSelectedCompanyId] = useState(null);
    const [selectedCompanyData, setSelectedCompanyData] = useState(null);

    // Customer selection state for super admins  
    const [availableCustomers, setAvailableCustomers] = useState([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState(null);
    const [loadingCustomers, setLoadingCustomers] = useState(false);

    // Dynamic charge types state
    const [availableChargeTypes, setAvailableChargeTypes] = useState([]);
    const [loadingChargeTypes, setLoadingChargeTypes] = useState(false);
    const [chargeTypesError, setChargeTypesError] = useState(null);

    // Determine if super admin needs to select a company (always show for super admins to allow switching)
    const needsCompanySelection = userRole === 'superadmin';

    // Helper function to determine if broker section should be visible (US shipments only)
    const shouldShowBrokerSection = useMemo(() => {
        const fromCountry = shipFromAddress?.country;
        const toCountry = shipToAddress?.country;

        // Show if either origin or destination is US
        return fromCountry === 'US' || toCountry === 'US';
    }, [shipFromAddress?.country, shipToAddress?.country]);

    // Helper function to determine if broker section should be expanded
    const shouldExpandBrokerSection = useMemo(() => {
        // Auto-expand if a broker is selected
        return selectedBroker !== '';
    }, [selectedBroker]);

    // Update broker expansion state when conditions change
    useEffect(() => {
        if (shouldExpandBrokerSection && !brokerExpanded) {
            setBrokerExpanded(true);
        }
    }, [shouldExpandBrokerSection, brokerExpanded]);

    // Reset broker data when section becomes hidden
    useEffect(() => {
        if (!shouldShowBrokerSection) {
            setSelectedBroker('');
            setBrokerPort('');
            setBrokerReference('');
            setBrokerExpanded(false);
        }
    }, [shouldShowBrokerSection]);

    // Load customers for selected company (super admin)
    const loadCustomersForCompany = useCallback(async (companyId) => {
        console.log('🔍 loadCustomersForCompany called with:', companyId);

        if (!companyId || companyId === 'all') {
            setAvailableCustomers([]);
            setSelectedCustomerId(null);
            return;
        }

        setLoadingCustomers(true);
        try {
            const customersQuery = query(
                collection(db, 'customers'),
                where('companyID', '==', companyId)
            );

            const customersSnapshot = await getDocs(customersQuery);
            const customers = customersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Sort customers by name
            customers.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            setAvailableCustomers(customers);
            setSelectedCustomerId(null); // Reset to "All Customers"
        } catch (error) {
            console.error('Error loading customers:', error);
            setAvailableCustomers([]);
            setSelectedCustomerId(null);
        } finally {
            setLoadingCustomers(false);
        }
    }, []);

    // Handle company selection for super admins
    const handleCompanySelection = useCallback(async (companyId) => {
        try {
            setSelectedCompanyId(companyId);

            if (companyId) {
                // Query for the selected company data
                const companiesQuery = query(
                    collection(db, 'companies'),
                    where('companyID', '==', companyId),
                    limit(1)
                );

                const companiesSnapshot = await getDocs(companiesQuery);

                if (!companiesSnapshot.empty) {
                    const companyDoc = companiesSnapshot.docs[0];
                    const companyDocData = companyDoc.data();

                    const targetCompanyData = {
                        ...companyDocData,
                        id: companyDoc.id
                    };

                    setSelectedCompanyData(targetCompanyData);

                    // Switch company context
                    await setCompanyContext(targetCompanyData);

                    // Load customers for the selected company
                    await loadCustomersForCompany(companyId);

                    console.log('✅ Super admin switched to company context:', targetCompanyData.name);
                    showMessage(`Switched to ${targetCompanyData.name || companyId}`, 'success');
                } else {
                    console.warn('⚠️ Company not found:', companyId);
                    showMessage(`Warning: Company ${companyId} not found`, 'warning');
                }
            } else {
                setSelectedCompanyData(null);
                setAvailableCustomers([]);
                setSelectedCustomerId(null);
            }
        } catch (error) {
            console.error('❌ Error switching company context:', error);
            showMessage('Error switching company context', 'error');
        }
    }, [setCompanyContext, loadCustomersForCompany]);

    // Address loading function that matches QuickShip's pattern exactly
    const loadAddressesForCompany = useCallback(async (companyId, customerId = null) => {
        console.log('🟡 CreateShipmentX loadAddressesForCompany called with:', { companyId, customerId, selectedCustomerId, timestamp: new Date().toISOString() });
        if (!companyId) {
            console.log('📍 CreateShipmentX No company ID provided for address loading');
            return;
        }

        console.log('📍 Loading addresses for company:', companyId);
        setLoadingAddresses(true);

        try {
            // First, get ALL addresses for the company to debug
            const allAddressQuery = query(
                collection(db, 'addressBook'),
                where('companyID', '==', companyId),
                where('status', '==', 'active')
            );

            const allAddressSnapshot = await getDocs(allAddressQuery);
            const allAddresses = allAddressSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Calculate effective customer ID first
            const effectiveCustomerId = customerId || selectedCustomerId;

            console.log('🔍 CreateShipmentX DEBUG: All addresses for company:', {
                companyId,
                totalCount: allAddresses.length,
                effectiveCustomerId,
                selectedCustomerId,
                sampleAddresses: allAddresses.slice(0, 3).map(addr => ({
                    id: addr.id,
                    name: addr.name || addr.nickname || 'No name',
                    addressClass: addr.addressClass,
                    addressClassID: addr.addressClassID,
                    customerID: addr.customerID,
                    street: addr.street
                }))
            });

            let addresses = allAddresses;

            // Apply customer filter if specific customer is selected (for all user roles)
            if (effectiveCustomerId && effectiveCustomerId !== 'all' && effectiveCustomerId !== null) {
                // Try multiple filter approaches to handle different data structures
                addresses = allAddresses.filter(addr => {
                    const matches = addr.addressClassID === effectiveCustomerId ||
                        addr.customerID === effectiveCustomerId ||
                        (addr.addressClass === 'customer' && addr.addressClassID === effectiveCustomerId);

                    // Log non-matching addresses like QuickShip does
                    if (!matches && addr.addressClassID) {
                        console.log('🔍 CreateShipmentX Address not matching:', {
                            addressId: addr.id,
                            addressClassID: addr.addressClassID,
                            customerID: addr.customerID,
                            lookingFor: effectiveCustomerId,
                            addressClass: addr.addressClass,
                            name: addr.name || addr.nickname || addr.companyName,
                            allFields: Object.keys(addr)
                        });
                    }

                    return matches;
                });

                console.log('🔍 CreateShipmentX DEBUG: Filtered addresses:', {
                    effectiveCustomerId,
                    filteredCount: addresses.length,
                    originalCount: allAddresses.length,
                    filterCriteria: 'addressClassID or customerID equals customerId',
                    filteredAddresses: addresses.slice(0, 3).map(addr => ({
                        id: addr.id,
                        name: addr.name || addr.nickname,
                        addressClass: addr.addressClass,
                        addressClassID: addr.addressClassID,
                        customerID: addr.customerID
                    }))
                });
            }

            console.log('📍 CreateShipmentX Address loading completed:', {
                companyId,
                effectiveCustomerId,
                userRole,
                addressCount: addresses.length,
                isFiltered: effectiveCustomerId && effectiveCustomerId !== 'all' && effectiveCustomerId !== null,
                addresses: addresses.slice(0, 3) // Show first 3 for debugging
            });

            setAvailableAddresses(addresses);
        } catch (error) {
            console.error('Error loading addresses:', error);
            setAvailableAddresses([]);
        } finally {
            setLoadingAddresses(false);
        }
    }, [selectedCustomerId, userRole]);

    // Load addresses using the same pattern as QuickShip
    useEffect(() => {
        const currentCompanyId = selectedCompanyId || companyIdForAddress;

        console.log('🟢 CreateShipmentX useEffect: address loading triggered', {
            currentCompanyId,
            selectedCustomerId,
            userRole,
            companyIdForAddress,
            selectedCompanyId
        });

        if (currentCompanyId) {
            // Pass the current customer selection to preserve filtering - this is the key fix
            loadAddressesForCompany(currentCompanyId, selectedCustomerId);
        }
    }, [companyIdForAddress, selectedCompanyId, selectedCustomerId, userRole, loadAddressesForCompany]);

    // Load customers (populate both customers and availableCustomers for manufacturer role)
    useEffect(() => {
        const loadCustomers = async () => {
            // Use either selectedCompanyId (for manual selection) or companyIdForAddress (for context)
            const currentCompanyId = selectedCompanyId || companyIdForAddress;

            console.log('🔍 CreateShipmentX loadCustomers called:', {
                userRole,
                selectedCompanyId,
                companyIdForAddress,
                currentCompanyId,
                willLoad: !!currentCompanyId
            });

            if (!currentCompanyId) return;

            try {
                const customersQuery = query(
                    collection(db, 'customers'),
                    where('companyID', '==', currentCompanyId)
                );
                const customersSnapshot = await getDocs(customersQuery);
                const customersData = customersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                console.log('🔍 CreateShipmentX customers loaded:', {
                    companyId: currentCompanyId,
                    customersCount: customersData.length,
                    userRole,
                    customerNames: customersData.map(c => c.name)
                });

                // Sort customers by name
                customersData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

                setCustomers(customersData);

                // For manufacturer role, also populate availableCustomers for dropdown
                if (userRole === 'manufacturer') {
                    setAvailableCustomers(customersData);
                    console.log('🏭 Manufacturer: Loaded customers into availableCustomers:', customersData.length);
                } else {
                    // For other roles, also set availableCustomers to ensure consistency
                    setAvailableCustomers(customersData);
                }
            } catch (error) {
                console.error('Error loading customers:', error);
                setCustomers([]);
                setAvailableCustomers([]);
            }
        };
        loadCustomers();
    }, [companyIdForAddress, selectedCompanyId, userRole]);

    // Load Company Brokers
    const loadCompanyBrokers = useCallback(async () => {
        const currentCompanyId = selectedCompanyId || companyIdForAddress;
        if (!currentCompanyId) return;

        setLoadingBrokers(true);
        try {
            const brokersQuery = query(
                collection(db, 'companyBrokers'),
                where('companyID', '==', currentCompanyId),
                where('enabled', '==', true)
            );
            const brokersSnapshot = await getDocs(brokersQuery);
            const brokers = brokersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log('📋 Loaded company brokers:', brokers.length, 'brokers for company:', currentCompanyId);
            setCompanyBrokers(brokers);
        } catch (error) {
            console.error('Error loading company brokers:', error);
        } finally {
            setLoadingBrokers(false);
        }
    }, [selectedCompanyId, companyIdForAddress]);

    // Load brokers when company changes
    useEffect(() => {
        loadCompanyBrokers();
    }, [loadCompanyBrokers]);

    // Broker management functions
    const handleAddBroker = () => {
        setEditingBroker(null);
        setShowBrokerDialog(true);
    };

    const handleEditBroker = (broker) => {
        setEditingBroker(broker);
        setShowBrokerDialog(true);
    };

    const handleBrokerSuccess = async (savedBroker, isEdit = false) => {
        if (isEdit) {
            // Update existing broker in local state immediately
            setCompanyBrokers(prev => prev.map(b =>
                b.id === savedBroker.id ? savedBroker : b
            ));
            setBrokerSuccessMessage(`Broker "${savedBroker.name}" has been updated successfully.`);

            // If the edited broker is currently selected, update the selection with new name
            if (selectedBroker && companyBrokers.find(b => b.id === savedBroker.id)) {
                setSelectedBroker(savedBroker.name);
            }

            // Reload brokers from database to ensure we have the latest data
            try {
                await loadCompanyBrokers();
            } catch (error) {
                console.error('Error reloading brokers after edit:', error);
            }
        } else {
            // Add new broker to local state
            setCompanyBrokers(prev => [...prev, savedBroker]);
            setBrokerSuccessMessage(`Broker "${savedBroker.name}" has been added successfully.`);
            setSelectedBroker(savedBroker.name);
        }

        setShowBrokerDialog(false);
        setEditingBroker(null);

        // Clear success message after 3 seconds
        setTimeout(() => {
            setBrokerSuccessMessage('');
        }, 3000);
    };

    // Load customers for initial company (super admin and manufacturer)
    useEffect(() => {
        // Run for super admins and manufacturers on initial load
        if ((userRole === 'superadmin' || userRole === 'manufacturer') && companyIdForAddress && !selectedCompanyId) {
            console.log('🔍 Loading customers for initial company:', companyIdForAddress, 'userRole:', userRole);
            loadCustomersForCompany(companyIdForAddress);
        }
    }, [userRole, companyIdForAddress, selectedCompanyId, loadCustomersForCompany]);

    // Auto-select customer if there's only one available
    useEffect(() => {
        if (availableCustomers.length === 1 && !selectedCustomerId) {
            const singleCustomer = availableCustomers[0];
            const customerId = singleCustomer.customerID || singleCustomer.id;
            console.log('🎯 Auto-selecting single customer:', {
                customer: singleCustomer.name,
                customerId
            });
            setSelectedCustomerId(customerId);
        }
    }, [availableCustomers, selectedCustomerId]);

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

    // Create form snapshot for comparison
    const createFormSnapshot = useCallback(() => {
        return JSON.stringify({
            shipFrom: shipFromAddress?.id || null,
            shipTo: shipToAddress?.id || null,
            packages: packages.map(p => ({
                weight: p.weight,
                length: p.length,
                width: p.width,
                height: p.height,
                itemDescription: p.itemDescription,
                packagingType: p.packagingType,
                packagingQuantity: p.packagingQuantity
            })),
            shipmentType: shipmentInfo.shipmentType,
            serviceLevel: shipmentInfo.serviceLevel,
            shipmentDate: shipmentInfo.shipmentDate
        });
    }, [shipFromAddress, shipToAddress, packages, shipmentInfo]);

    // Check if form has significantly changed (requiring new rate fetch)
    const hasSignificantFormChange = useCallback(() => {
        const currentSnapshot = createFormSnapshot();
        return currentSnapshot !== lastFormSnapshot;
    }, [createFormSnapshot, lastFormSnapshot]);
    // Fetch rates from carriers with progressive loading - ENHANCED FOR ESHIP PLUS COLD START
    const fetchRates = useCallback(async (forceRefresh = false) => {
        if (!canFetchRates()) return;

        // Check if we need to fetch new rates (significant form change or force refresh)
        if (!forceRefresh && !hasSignificantFormChange()) {
            console.log('📋 Form unchanged, skipping rate fetch');
            return;
        }

        // CRITICAL FIX: Only cancel requests if they're not from eShip Plus or have been running for a reasonable time
        if (activeRateRequest && typeof activeRateRequest.cancel === 'function') {
            // Don't cancel if request might be eShip Plus cold starting
            const requestAge = Date.now() - (activeRateRequest.startTime || 0);
            const hasEshipPlus = loadingCarriers.includes('eShip Plus') || loadingCarriers.includes('ESHIPPLUS');

            if (!hasEshipPlus || requestAge > 30000) { // Only cancel if no eShip Plus or running > 30 seconds
                console.log('🚫 Cancelling previous rate request for new significant change');
                activeRateRequest.cancel();
            } else {
                console.log('⏳ Keeping active request running (eShip Plus may be cold starting)');
                return; // Don't start new request while eShip Plus is potentially cold starting
            }
        }

        console.log('🚀 Starting progressive rate fetch...');
        const fetchStartTime = Date.now();

        setIsLoadingRates(true);
        setRatesError(null);
        setShowRates(true);
        setCompletedCarriers([]);
        setFailedCarriers([]);
        setProgressiveRates([]); // Clear progressive rates for fresh start
        setRates([]); // Clear existing rates

        // Update form snapshot
        setLastFormSnapshot(createFormSnapshot());

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
                setIsLoadingRates(false);
                return;
            }

            setLoadingCarriers(companyEligibleCarriers.map(c => c.name));

            // Preemptive warmup for better cold start handling
            try {
                console.log('🔥 Starting smart carrier warmup...');
                const warmupResult = await smartWarmupCarriers({
                    shipmentInfo,
                    packages: packages.filter(p => p.weight && p.length && p.width && p.height),
                    shipFrom: shipFromAddress,
                    shipTo: shipToAddress
                });
                if (warmupResult.success) {
                    console.log('🔥 Carrier warmup completed:', warmupResult.results);
                } else {
                    console.log('⚠️ Carrier warmup had issues but continuing...');
                }
            } catch (warmupError) {
                console.warn('⚠️ Carrier warmup failed, continuing with rate fetch:', warmupError.message);
            }

            // ENHANCED: Detect if eShip Plus is in the carrier list for special handling
            const hasEshipPlus = companyEligibleCarriers.some(carrier =>
                carrier.name?.toLowerCase().includes('eship') ||
                carrier.key === 'ESHIPPLUS'
            );

            // CRITICAL FIX: Extended timeout specifically for eShip Plus cold starts
            const timeoutDuration = hasEshipPlus ? 90000 : 50000; // 90 seconds for eShip Plus, 50 for others
            console.log(`⏰ Using ${timeoutDuration / 1000}s timeout (eShip Plus detected: ${hasEshipPlus})`);

            // Enhanced progressive results with better eShip Plus handling
            const multiCarrierResult = await fetchMultiCarrierRates(shipmentData, {
                customEligibleCarriers: companyEligibleCarriers,
                progressiveResults: true,
                includeFailures: true,
                timeout: timeoutDuration, // Dynamic timeout based on carriers
                retryAttempts: hasEshipPlus ? 2 : 1, // Extra retry for eShip Plus
                retryDelay: hasEshipPlus ? 5000 : 2000, // Longer delay for eShip Plus
                companyId: companyData?.companyID,
                onProgress: async (progressData) => {
                    console.log('📈 Rate progress update:', progressData);

                    // Update completion tracking
                    if (progressData.completed) {
                        setCompletedCarriers(prev => {
                            const existing = prev.find(c => c.name === progressData.carrier);
                            if (existing) return prev; // Avoid duplicates
                            return [...prev, {
                                name: progressData.carrier,
                                rates: progressData.rates?.length || 0
                            }];
                        });

                        // PROGRESSIVE RATE DISPLAY: Add new rates immediately as they arrive
                        if (progressData.rates && progressData.rates.length > 0) {
                            console.log(`✅ Adding ${progressData.rates.length} rates from ${progressData.carrier}`);

                            // Validate and process new rates
                            const validNewRates = progressData.rates.filter(rate => {
                                const validation = validateUniversalRate(rate);
                                return validation.valid;
                            });

                            if (validNewRates.length > 0) {
                                try {
                                    // Apply markup to new rates
                                    const shipmentDataForMarkup = {
                                        shipmentInfo,
                                        packages: packages.filter(p => p.weight && p.length && p.width && p.height),
                                        shipFrom: shipFromAddress,
                                        shipTo: shipToAddress
                                    };

                                    const newRatesWithMarkup = await Promise.all(
                                        validNewRates.map(async (rate) => {
                                            try {
                                                const rateWithMarkup = await markupEngine.applyMarkupToRate(rate, companyData?.companyID, shipmentDataForMarkup);
                                                return rateWithMarkup;
                                            } catch (markupError) {
                                                console.warn('⚠️ Failed to apply markup to progressive rate:', markupError);
                                                return rate;
                                            }
                                        })
                                    );

                                    // Enhanced duplicate detection using multiple rate identifiers
                                    const createRateKey = (rate) => {
                                        return `${rate.id || rate.quoteId || rate.rateId || 'unknown'}-${rate.carrier?.name || rate.sourceCarrierName || 'unknown'}-${rate.pricing?.total || rate.totalCharges || rate.price || 0}`;
                                    };

                                    // CRITICAL FIX: Use functional updates to prevent race conditions
                                    setRates(prev => {
                                        const existingKeys = prev.map(r => createRateKey(r));
                                        const uniqueNewRates = newRatesWithMarkup.filter(r =>
                                            !existingKeys.includes(createRateKey(r))
                                        );

                                        if (uniqueNewRates.length > 0) {
                                            const updatedRates = [...prev, ...uniqueNewRates];
                                            console.log(`📋 Main rates updated: ${updatedRates.length} total rates (${uniqueNewRates.length} new from ${progressData.carrier})`);
                                            return updatedRates;
                                        }
                                        return prev;
                                    });

                                    // Also update progressive rates for UI consistency
                                    setProgressiveRates(prev => {
                                        const existingKeys = prev.map(r => createRateKey(r));
                                        const uniqueNewRates = newRatesWithMarkup.filter(r =>
                                            !existingKeys.includes(createRateKey(r))
                                        );

                                        if (uniqueNewRates.length > 0) {
                                            const updatedRates = [...prev, ...uniqueNewRates];
                                            console.log(`📊 Progressive rates updated: ${updatedRates.length} total rates (${uniqueNewRates.length} new, ${newRatesWithMarkup.length - uniqueNewRates.length} duplicates filtered)`);
                                            return updatedRates;
                                        }
                                        return prev;
                                    });
                                } catch (error) {
                                    console.error('❌ Error processing progressive rates:', error);
                                }
                            }
                        }
                    }

                    if (progressData.failed) {
                        setFailedCarriers(prev => {
                            const existing = prev.find(c => c.name === progressData.carrier);
                            if (existing) return prev; // Avoid duplicates
                            return [...prev, {
                                name: progressData.carrier,
                                error: progressData.error
                            }];
                        });
                    }
                }
            });

            // Store the request with start time for better cancellation logic
            const requestWithMetadata = {
                ...multiCarrierResult,
                startTime: fetchStartTime
            };
            setActiveRateRequest(requestWithMetadata);

            console.log('🏁 Multi-carrier request completed:', multiCarrierResult);

            // ENHANCED FINAL PROCESSING: Better handling of delayed results
            if (multiCarrierResult.success) {
                if (multiCarrierResult.rates && multiCarrierResult.rates.length > 0) {
                    const allValidRates = multiCarrierResult.rates.filter(rate => {
                        const validation = validateUniversalRate(rate);
                        return validation.valid;
                    });

                    if (allValidRates.length > 0) {
                        console.log(`🏁 Final processing: ${allValidRates.length} valid rates from final result`);

                        // Apply markup to final rates
                        const shipmentDataForMarkup = {
                            shipmentInfo,
                            packages: packages.filter(p => p.weight && p.length && p.width && p.height),
                            shipFrom: shipFromAddress,
                            shipTo: shipToAddress
                        };

                        const finalRatesWithMarkup = await Promise.all(
                            allValidRates.map(async (rate) => {
                                try {
                                    return await markupEngine.applyMarkupToRate(rate, companyData?.companyID, shipmentDataForMarkup);
                                } catch (markupError) {
                                    console.warn('⚠️ Failed to apply markup to final rate:', markupError);
                                    return rate;
                                }
                            })
                        );

                        // Enhanced duplicate detection for final rates
                        const createRateKey = (rate) => {
                            return `${rate.id || rate.quoteId || rate.rateId || 'unknown'}-${rate.carrier?.name || rate.sourceCarrierName || 'unknown'}-${rate.pricing?.total || rate.totalCharges || rate.price || 0}`;
                        };

                        // CRITICAL FIX: Merge final rates properly, don't overwrite progressive rates
                        setRates(prevRates => {
                            const existingKeys = prevRates.map(r => createRateKey(r));
                            const newRates = finalRatesWithMarkup.filter(r =>
                                !existingKeys.includes(createRateKey(r))
                            );

                            if (newRates.length > 0) {
                                console.log(`📋 Adding ${newRates.length} final rates that weren't processed progressively`);
                                return [...prevRates, ...newRates];
                            } else {
                                console.log(`✅ All ${finalRatesWithMarkup.length} final rates were already processed progressively`);
                            }
                            return prevRates;
                        });
                    }
                }

                setRawRateApiResponseData(multiCarrierResult);

                // ENHANCED: Don't set error if we have any rates from progressive updates
                // This prevents the "no rates" error when eShip Plus is slow but other carriers worked
            } else {
                // Only show error if we have no rates at all from any source
                setRates(prevRates => {
                    if (prevRates.length === 0) {
                        setRatesError('No rates available for this shipment configuration');
                        setRawRateApiResponseData(null);
                    }
                    return prevRates;
                });
            }

        } catch (error) {
            console.error('❌ Error fetching rates:', error);

            // CRITICAL FIX: Only show error if we don't have any rates from progressive updates
            setRates(prevRates => {
                if (prevRates.length === 0) {
                    setRatesError(`Failed to fetch rates: ${error.message}`);
                    setRawRateApiResponseData(null);
                } else {
                    console.log('📊 Showing partial results despite error - have progressive rates');
                }
                return prevRates;
            });
        } finally {
            // ENHANCED: Add delay before clearing loading state for eShip Plus
            // Re-check for eShip Plus in the final cleanup
            const hasEshipPlusFinal = loadingCarriers.some(c =>
                c.toLowerCase().includes('eship') || c === 'ESHIPPLUS'
            );

            if (hasEshipPlusFinal) {
                // Small delay to allow any final eShip Plus responses to come in
                setTimeout(() => {
                    setIsLoadingRates(false);
                    setActiveRateRequest(null);
                }, 2000);
            } else {
                setIsLoadingRates(false);
                setActiveRateRequest(null);
            }
        }
    }, [shipFromAddress, shipToAddress, packages, shipmentInfo, canFetchRates, getCompanyEligibleCarriers, companyData, hasSignificantFormChange, activeRateRequest, createFormSnapshot, loadingCarriers]);

    // Smart auto-fetch rates with improved debouncing and duplicate prevention - ENHANCED FOR ESHIP PLUS
    useEffect(() => {
        // Don't fetch rates during booking process
        if (isBooking || showBookingDialog) {
            return;
        }

        // ENHANCED: Don't interrupt ongoing eShip Plus requests
        if (isLoadingRates && activeRateRequest) {
            const requestAge = Date.now() - (activeRateRequest.startTime || 0);
            const hasEshipPlus = loadingCarriers.includes('eShip Plus') || loadingCarriers.includes('ESHIPPLUS');

            if (hasEshipPlus && requestAge < 60000) { // Don't interrupt eShip Plus for 60 seconds
                console.log('⏳ Waiting for eShip Plus to complete before triggering new fetch');
                return;
            }
        }

        // Clear debounce timeout when dependencies change
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }

        if (canFetchRates()) {
            // Check if form has significantly changed
            const currentSnapshot = createFormSnapshot();
            const isSignificantChange = currentSnapshot !== lastFormSnapshot;

            if (isSignificantChange) {
                console.log('📝 Form change detected, debouncing rate fetch...');

                // ENHANCED: Longer debounce if eShip Plus might be involved
                const debounceTime = 4000; // 4 seconds to allow for thoughtful form completion

                debounceTimeoutRef.current = setTimeout(() => {
                    // Double-check if this is still relevant and form hasn't changed again
                    const latestSnapshot = createFormSnapshot();
                    if (canFetchRates() && latestSnapshot === currentSnapshot) {
                        console.log('🚀 Debounce completed, triggering rate fetch');
                        fetchRates();
                    } else {
                        console.log('📋 Form changed during debounce, skipping fetch');
                    }
                }, debounceTime);
            }
        }

        return () => {
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }
        };
    }, [shipFromAddress, shipToAddress, packages, shipmentInfo, isBooking, showBookingDialog, canFetchRates, fetchRates, createFormSnapshot, lastFormSnapshot, isLoadingRates, activeRateRequest, loadingCarriers]);

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
                                serviceLevel: draftData.shipmentInfo.serviceLevel || 'any',
                                shipmentDate: draftData.shipmentInfo.shipmentDate || new Date().toISOString().split('T')[0],
                                shipperReferenceNumber: draftData.shipmentInfo.shipperReferenceNumber || '',
                                referenceNumbers: draftData.shipmentInfo.referenceNumbers || [],
                                billType: draftData.shipmentInfo.billType || 'third_party'
                            });
                        }

                        // Load addresses with transformation
                        if (draftData.shipFrom) {
                            const transformedShipFrom = {
                                ...draftData.shipFrom,
                                // Map database fields to standardized fields with eShip Plus fallbacks
                                companyName: draftData.shipFrom.companyName || draftData.shipFrom.company || 'N/A',
                                street: draftData.shipFrom.address1 || draftData.shipFrom.street || 'N/A',
                                street2: draftData.shipFrom.address2 || draftData.shipFrom.street2 || '',
                                city: draftData.shipFrom.city || 'N/A',
                                state: draftData.shipFrom.stateProv || draftData.shipFrom.state || 'N/A',
                                postalCode: draftData.shipFrom.zipPostal || draftData.shipFrom.postalCode || 'N/A',
                                country: draftData.shipFrom.country || 'CA',
                                // Contact information with proper field mapping and fallbacks
                                contactName: draftData.shipFrom.contactName || `${draftData.shipFrom.firstName || ''} ${draftData.shipFrom.lastName || ''}`.trim() || draftData.shipFrom.nickname || 'Shipping Department',
                                contactPhone: draftData.shipFrom.contactPhone || draftData.shipFrom.phone || '555-000-0000',
                                contactEmail: draftData.shipFrom.contactEmail || draftData.shipFrom.email || 'noreply@solushipx.com',
                                // Keep original fields as fallbacks
                                firstName: draftData.shipFrom.firstName || '',
                                lastName: draftData.shipFrom.lastName || '',
                                phone: draftData.shipFrom.phone || '555-000-0000',
                                email: draftData.shipFrom.email || 'noreply@solushipx.com'
                            };
                            setShipFromAddress(transformedShipFrom);
                        }
                        if (draftData.shipTo) {
                            const transformedShipTo = {
                                ...draftData.shipTo,
                                // Map database fields to standardized fields with eShip Plus fallbacks
                                companyName: draftData.shipTo.companyName || draftData.shipTo.company || 'N/A',
                                street: draftData.shipTo.address1 || draftData.shipTo.street || 'N/A',
                                street2: draftData.shipTo.address2 || draftData.shipTo.street2 || '',
                                city: draftData.shipTo.city || 'N/A',
                                state: draftData.shipTo.stateProv || draftData.shipTo.state || 'N/A',
                                postalCode: draftData.shipTo.zipPostal || draftData.shipTo.postalCode || 'N/A',
                                country: draftData.shipTo.country || 'CA',
                                // Contact information with proper field mapping and fallbacks
                                contactName: draftData.shipTo.contactName || `${draftData.shipTo.firstName || ''} ${draftData.shipTo.lastName || ''}`.trim() || draftData.shipTo.nickname || 'Receiving Department',
                                contactPhone: draftData.shipTo.contactPhone || draftData.shipTo.phone || '555-000-0000',
                                contactEmail: draftData.shipTo.contactEmail || draftData.shipTo.email || 'noreply@solushipx.com',
                                // Keep original fields as fallbacks
                                firstName: draftData.shipTo.firstName || '',
                                lastName: draftData.shipTo.lastName || '',
                                phone: draftData.shipTo.phone || '555-000-0000',
                                email: draftData.shipTo.email || 'noreply@solushipx.com'
                            };
                            setShipToAddress(transformedShipTo);
                        }

                        // Load packages
                        if (draftData.packages && Array.isArray(draftData.packages) && draftData.packages.length > 0) {
                            setPackages(draftData.packages);
                        }

                        // Load selected rate if available
                        if (draftData.selectedRate) {
                            setSelectedRate(draftData.selectedRate);
                        }

                        // Load additional services and create corresponding rate line items
                        if (draftData.additionalServices && Array.isArray(draftData.additionalServices)) {
                            setAdditionalServices(draftData.additionalServices);
                        }

                        // Load broker information
                        if (draftData.selectedBroker) {
                            setSelectedBroker(draftData.selectedBroker);
                        }
                        if (draftData.brokerPort) {
                            setBrokerPort(draftData.brokerPort);
                        }
                        if (draftData.brokerReference) {
                            setBrokerReference(draftData.brokerReference);
                        }

                        // Auto-expand broker section if broker data exists
                        if (draftData.selectedBroker || draftData.brokerPort || draftData.brokerReference) {
                            setBrokerExpanded(true);
                        }

                        // Load customer selection for all user roles
                        if (draftData.selectedCustomerId) {
                            setSelectedCustomerId(draftData.selectedCustomerId);
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

    // Load existing shipment data when editing
    useEffect(() => {
        const loadEditShipmentData = async () => {
            if (!isEditingExistingShipment || !editShipment) return;

            console.log('🔄 Loading existing shipment for editing:', editShipment);

            try {
                // Set the shipment ID
                setShipmentID(editShipment.shipmentID || editShipment.id);
                setActiveDraftId(editShipment.id);
                setIsEditingDraft(false); // Not a draft, it's an existing shipment

                // Load shipment info
                if (editShipment.shipmentInfo) {
                    setShipmentInfo({
                        ...shipmentInfo,
                        ...editShipment.shipmentInfo,
                        referenceNumbers: editShipment.shipmentInfo.referenceNumbers || []
                    });
                }

                // Load addresses
                if (editShipment.shipFrom || editShipment.shipFromAddress) {
                    const fromAddress = editShipment.shipFrom || editShipment.shipFromAddress;
                    setShipFromAddress(fromAddress);
                }
                if (editShipment.shipTo || editShipment.shipToAddress) {
                    const toAddress = editShipment.shipTo || editShipment.shipToAddress;
                    setShipToAddress(toAddress);
                    // Set selected customer based on ship to address
                    if (toAddress.customerID && customers.length > 0) {
                        const customer = customers.find(c => c.id === toAddress.customerID);
                        if (customer) {
                            setSelectedCustomer(customer);
                        }
                    }
                }

                // Load packages
                if (editShipment.packages && Array.isArray(editShipment.packages) && editShipment.packages.length > 0) {
                    console.log('Loading packages from shipment:', editShipment.packages);
                    const validatedPackages = editShipment.packages.map(pkg => ({
                        ...pkg,
                        id: pkg.id || Math.random(),
                        unitSystem: pkg.unitSystem || editShipment.unitSystem || 'imperial'
                    }));
                    setPackages(validatedPackages);
                }

                // Load broker information
                if (editShipment.selectedBroker) {
                    setSelectedBroker(editShipment.selectedBroker);
                }
                if (editShipment.brokerPort) {
                    setBrokerPort(editShipment.brokerPort);
                }
                if (editShipment.brokerReference) {
                    setBrokerReference(editShipment.brokerReference);
                }

                // Auto-expand broker section if broker data exists
                if (editShipment.selectedBroker || editShipment.brokerPort || editShipment.brokerReference) {
                    setBrokerExpanded(true);
                }

                // Load additional services
                if (editShipment.additionalServices && Array.isArray(editShipment.additionalServices)) {
                    setAdditionalServices(editShipment.additionalServices);
                }

                // Load selected rate if available
                if (editShipment.selectedRate) {
                    setSelectedRate(editShipment.selectedRate);
                    setShowRates(true);

                    // Also load all rates if available
                    if (editShipment.rates && Array.isArray(editShipment.rates)) {
                        setRates(editShipment.rates);
                        setFilteredRates(editShipment.rates);
                    }
                }

                console.log('✅ Loaded existing shipment data for editing');

            } catch (error) {
                console.error('❌ Error loading existing shipment data:', error);
                showMessage('Error loading shipment data for editing', 'error');
            }
        };

        loadEditShipmentData();
    }, [isEditingExistingShipment, editShipment, customers]);

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
                    createdAt: new Date(),
                    updatedAt: new Date(),

                    // Initialize with default values
                    shipmentInfo: {
                        shipmentType: 'courier', // Default to courier
                        serviceLevel: 'any',
                        shipmentDate: new Date().toISOString().split('T')[0],
                        shipperReferenceNumber: newShipmentID,
                        referenceNumbers: [],
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
                        unitSystem: 'imperial',
                        declaredValue: '',
                        declaredValueCurrency: 'CAD'
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

    // Load service levels on component mount and when shipment type changes
    useEffect(() => {
        console.log('🔧 CreateShipmentX: useEffect triggered for service loading. shipmentType:', shipmentInfo.shipmentType);
        console.log('🔧 CreateShipmentX: Current shipmentInfo object:', shipmentInfo);
        if (shipmentInfo.shipmentType === 'freight' || shipmentInfo.shipmentType === 'courier') {
            console.log('🔧 CreateShipmentX: Loading services for shipment type:', shipmentInfo.shipmentType);
            loadAdditionalServices();
            loadServiceLevels();
        } else {
            console.log('🔧 CreateShipmentX: Clearing services for shipment type:', shipmentInfo.shipmentType);
            // Clear services if not freight or courier
            setAvailableServices([]);
            setAdditionalServices([]);
            setAvailableServiceLevels([]);
        }
    }, [shipmentInfo.shipmentType]);

    // Load dynamic charge types on component mount
    useEffect(() => {
        const loadChargeTypes = async () => {
            setLoadingChargeTypes(true);
            setChargeTypesError(null);

            try {
                console.log('📦 CreateShipmentX: Loading dynamic charge types...');
                const chargeTypes = await shipmentChargeTypeService.getChargeTypes();
                console.log(`📦 CreateShipmentX: Loaded ${chargeTypes.length} charge types`);
                setAvailableChargeTypes(chargeTypes);
            } catch (error) {
                console.error('❌ CreateShipmentX: Failed to load charge types:', error);
                setChargeTypesError(error.message);
                // Don't clear charge types on error - they may be cached
            } finally {
                setLoadingChargeTypes(false);
            }
        };

        loadChargeTypes();
    }, []); // Only load once on component mount

    // Debug useEffect to see when shipmentInfo changes
    useEffect(() => {
        console.log('🔧 CreateShipmentX: shipmentInfo changed:', shipmentInfo);
    }, [shipmentInfo]);

    // Update package defaults when shipment type changes
    useEffect(() => {
        if (shipmentInfo.shipmentType) {
            const isCourier = shipmentInfo.shipmentType === 'courier';

            // Only update packaging type when shipment type changes, preserve user's dimension inputs
            setPackages(prev => prev.map(pkg => ({
                ...pkg,
                packagingType: isCourier ? 244 : 262, // BOX(ES) for courier, SKID(S) for freight
                // Don't override dimensions - let users keep their values
                // Only set defaults for completely new packages via addPackage()
            })));

            // Clear rates when shipment type changes to prevent showing stale rates
            setRates([]);
            setFilteredRates([]);
            setSelectedRate(null);
            setRatesError(null);

            // Clear any pending timeouts
            if (debounceTimeoutRef.current) {
                clearTimeout(debounceTimeoutRef.current);
            }

            // Note: The main auto-fetch effect will automatically trigger rate fetching
            // when the form is complete, so no need for manual triggering here
        }
    }, [shipmentInfo.shipmentType]);

    // Rate filtering and sorting effect
    useEffect(() => {
        let filtered = [...rates];

        // Apply service filter
        if (serviceFilter !== 'all' && serviceFilter !== 'any') {
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

    // Time extraction helper functions
    const extractOpenTime = (address) => {
        if (!address) return '09:00'; // Default fallback

        let openTime = null;

        // Check businessHours structure
        if (address?.businessHours) {
            if (address.businessHours.useCustomHours) {
                const mondayHours = address.businessHours.customHours?.monday;
                if (mondayHours && !mondayHours.closed && mondayHours.open) {
                    openTime = mondayHours.open;
                }
            } else if (address.businessHours.defaultHours?.open) {
                openTime = address.businessHours.defaultHours.open;
            }
        }

        // Check direct fields
        if (!openTime && (address?.openTime || address?.openHours)) {
            openTime = address.openTime || address.openHours;
        }

        // Check various field names
        const timeFields = ['Opening Time', 'openingTime', 'open_time', 'startTime', 'start_time', 'businessOpen'];
        for (const field of timeFields) {
            if (!openTime && address?.[field]) {
                openTime = address[field];
                break;
            }
        }

        // Convert to 24-hour format if needed
        return formatTimeTo24Hour(openTime) || '09:00';
    };

    const extractCloseTime = (address) => {
        if (!address) return '17:00'; // Default fallback

        let closeTime = null;

        // Check businessHours structure
        if (address?.businessHours) {
            if (address.businessHours.useCustomHours) {
                const mondayHours = address.businessHours.customHours?.monday;
                if (mondayHours && !mondayHours.closed && mondayHours.close) {
                    closeTime = mondayHours.close;
                }
            } else if (address.businessHours.defaultHours?.close) {
                closeTime = address.businessHours.defaultHours.close;
            }
        }

        // Check direct fields
        if (!closeTime && (address?.closeTime || address?.closeHours)) {
            closeTime = address.closeTime || address.closeHours;
        }

        // Check various field names
        const timeFields = ['Closing Time', 'closingTime', 'close_time', 'endTime', 'end_time', 'businessClose'];
        for (const field of timeFields) {
            if (!closeTime && address?.[field]) {
                closeTime = address[field];
                break;
            }
        }

        // Convert to 24-hour format if needed
        return formatTimeTo24Hour(closeTime) || '17:00';
    };

    const formatTimeTo24Hour = (timeString) => {
        if (!timeString || timeString.toString().trim() === '') {
            return null;
        }

        const str = timeString.toString().trim();

        // If already in 24-hour format (HH:MM), return as-is
        if (/^\d{1,2}:\d{2}$/.test(str)) {
            const [hours, minutes] = str.split(':');
            const h = parseInt(hours, 10);
            const m = parseInt(minutes, 10);
            if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
                return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            }
        }

        // Handle AM/PM format
        if (/^\d{1,2}:\d{2}\s*(AM|PM)$/i.test(str)) {
            const match = str.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
            if (match) {
                let hours = parseInt(match[1], 10);
                const minutes = parseInt(match[2], 10);
                const period = match[3].toUpperCase();

                if (period === 'PM' && hours !== 12) {
                    hours += 12;
                } else if (period === 'AM' && hours === 12) {
                    hours = 0;
                }

                return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            }
        }

        // Handle HHMM format
        if (/^\d{4}$/.test(str)) {
            const hours = parseInt(str.substring(0, 2), 10);
            const minutes = parseInt(str.substring(2, 4), 10);
            if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
                return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            }
        }

        return null;
    };

    // Handlers
    const handleAddressSelect = (address, type) => {
        if (!address) return;

        // Transform raw database address to standardized format with eShip Plus fallbacks
        const transformedAddress = {
            ...address,
            // Map database fields to standardized fields with fallbacks for eShip Plus
            companyName: address.companyName || address.company || 'N/A',
            street: address.address1 || address.street || 'N/A',
            street2: address.address2 || address.street2 || '',
            city: address.city || 'N/A',
            state: address.stateProv || address.state || 'N/A',
            postalCode: address.zipPostal || address.postalCode || 'N/A',
            country: address.country || 'CA',
            // Contact information with proper field mapping and fallbacks
            contactName: address.contactName || `${address.firstName || ''} ${address.lastName || ''}`.trim() || address.nickname || 'Contact Name',
            contactPhone: address.contactPhone || address.phone || '555-000-0000',
            contactEmail: address.contactEmail || address.email || 'noreply@solushipx.com',
            // Keep original fields as fallbacks
            firstName: address.firstName || '',
            lastName: address.lastName || '',
            phone: address.phone || '555-000-0000',
            email: address.email || 'noreply@solushipx.com',
            specialInstructions: address.specialInstructions || 'None'
        };

        if (type === 'from') {
            setShipFromAddress(transformedAddress);

            // Extract timing from pickup address
            const openTime = extractOpenTime(transformedAddress);
            const closeTime = extractCloseTime(transformedAddress);

            // Update shipment info with extracted pickup times
            setShipmentInfo(prev => ({
                ...prev,
                earliestPickup: openTime,
                latestPickup: closeTime
            }));

        } else {
            setShipToAddress(transformedAddress);

            // Extract timing from delivery address
            const openTime = extractOpenTime(transformedAddress);
            const closeTime = extractCloseTime(transformedAddress);

            // Update shipment info with extracted delivery times
            setShipmentInfo(prev => ({
                ...prev,
                earliestDelivery: openTime,
                latestDelivery: closeTime
            }));
        }
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
            height: isCourier ? '12' : '48', // 12" for courier box, 48" for freight skid (fixed)
            unitSystem: 'imperial',
            freightClass: '',
            declaredValue: '', // Declared value amount
            declaredValueCurrency: 'CAD' // Declared value currency
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

    // Load Service Levels function
    const loadServiceLevels = async () => {
        console.log('🔧 CreateShipmentX: loadServiceLevels called, shipmentType:', shipmentInfo.shipmentType);
        console.log('🔧 CreateShipmentX: loadServiceLevels function started');

        try {
            setLoadingServiceLevels(true);
            const serviceLevelsRef = collection(db, 'serviceLevels');
            const q = query(
                serviceLevelsRef,
                where('type', '==', shipmentInfo.shipmentType),
                where('enabled', '==', true),
                orderBy('sortOrder'),
                orderBy('label')
            );
            const querySnapshot = await getDocs(q);

            const levels = [];
            querySnapshot.forEach((doc) => {
                levels.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            console.log('🔧 Loaded service levels from database:', levels);
            setAvailableServiceLevels(levels);
        } catch (error) {
            console.error('🔧 Error loading service levels:', error);
            // Fallback to default 'any' option if loading fails
            setAvailableServiceLevels([{ code: 'any', label: 'Any', type: 'any', description: 'Default service level' }]);
        } finally {
            setLoadingServiceLevels(false);
        }
    };

    // Additional Services functions
    const loadAdditionalServices = async () => {
        console.log('🔧 loadAdditionalServices called, shipmentType:', shipmentInfo.shipmentType);
        if (shipmentInfo.shipmentType !== 'freight' && shipmentInfo.shipmentType !== 'courier') {
            console.log('🔧 Not freight or courier shipment, skipping service load');
            return;
        }

        try {
            console.log('🔧 Loading additional services from database for type:', shipmentInfo.shipmentType);
            setLoadingServices(true);
            const servicesRef = collection(db, 'shipmentServices');
            const q = query(servicesRef, where('type', '==', shipmentInfo.shipmentType));
            const querySnapshot = await getDocs(q);

            const services = [];
            querySnapshot.forEach((doc) => {
                services.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            console.log('🔧 Loaded services from database:', services);
            setAvailableServices(services);
        } catch (error) {
            console.error('🔧 Error loading additional services:', error);
        } finally {
            setLoadingServices(false);
        }
    };

    const handleServiceToggle = (service) => {
        console.log('🔧 handleServiceToggle called with service:', service);
        console.log('🔧 Current additionalServices:', additionalServices);

        setAdditionalServices(prev => {
            console.log('🔧 Previous additionalServices:', prev);
            const exists = prev.find(s => s.id === service.id);
            console.log('🔧 Service exists?', exists);

            if (exists) {
                // Remove service
                const updatedServices = prev.filter(s => s.id !== service.id);
                console.log('🔧 Removing service, updated services:', updatedServices);
                return updatedServices;
            } else {
                // Add service
                const updatedServices = [...prev, service];
                console.log('🔧 Adding service, updated services:', updatedServices);
                return updatedServices;
            }
        });
    };

    const isServiceSelected = (serviceId) => {
        return additionalServices.some(s => s.id === serviceId);
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

    // Handle opening address edit dialog (for inline editing like QuickShip)
    const handleOpenEditAddress = (type) => {
        const addressToEdit = type === 'from' ? shipFromAddress : shipToAddress;
        setEditingAddressType(type);
        setEditingAddressData(addressToEdit);
        setShowAddressDialog(true);
    };

    // Handle address update from dialog
    const handleAddressUpdated = async (addressId) => {
        try {
            // Fetch the updated address data from the database
            const addressDoc = await getDoc(doc(db, 'addressBook', addressId));
            if (addressDoc.exists()) {
                const rawAddress = { id: addressDoc.id, ...addressDoc.data() };

                // Transform the address data to standardized format with eShip Plus fallbacks
                const transformedAddress = {
                    ...rawAddress,
                    // Map database fields to standardized fields with eShip Plus fallbacks
                    companyName: rawAddress.companyName || rawAddress.company || 'N/A',
                    street: rawAddress.address1 || rawAddress.street || 'N/A',
                    street2: rawAddress.address2 || rawAddress.street2 || '',
                    city: rawAddress.city || 'N/A',
                    state: rawAddress.stateProv || rawAddress.state || 'N/A',
                    postalCode: rawAddress.zipPostal || rawAddress.postalCode || 'N/A',
                    country: rawAddress.country || 'CA',
                    // Contact information with proper field mapping and fallbacks
                    contactName: rawAddress.contactName || `${rawAddress.firstName || ''} ${rawAddress.lastName || ''}`.trim() || rawAddress.nickname || 'Contact Name',
                    contactPhone: rawAddress.contactPhone || rawAddress.phone || '555-000-0000',
                    contactEmail: rawAddress.contactEmail || rawAddress.email || 'noreply@solushipx.com',
                    // Keep original fields as fallbacks
                    firstName: rawAddress.firstName || '',
                    lastName: rawAddress.lastName || '',
                    phone: rawAddress.phone || '555-000-0000',
                    email: rawAddress.email || 'noreply@solushipx.com',
                    specialInstructions: rawAddress.specialInstructions || 'None'
                };

                if (editingAddressType === 'from') {
                    setShipFromAddress(transformedAddress);
                } else {
                    setShipToAddress(transformedAddress);
                }
                showMessage('Address updated successfully', 'success');
            } else {
                console.error('Updated address not found');
                showMessage('Failed to load updated address data', 'error');
            }
        } catch (error) {
            console.error('Error fetching updated address:', error);
            showMessage('Failed to load updated address data', 'error');
        }

        setShowAddressDialog(false);
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
                updatedAt: new Date(),

                // Shipment information - save whatever is entered
                shipmentInfo: {
                    shipmentType: shipmentInfo.shipmentType || 'freight',
                    serviceLevel: shipmentInfo.serviceLevel || 'any',
                    shipmentDate: shipmentInfo.shipmentDate || new Date().toISOString().split('T')[0],
                    shipperReferenceNumber: shipmentInfo.shipperReferenceNumber || currentShipmentID,
                    referenceNumbers: shipmentInfo.referenceNumbers || [],
                    billType: shipmentInfo.billType || 'third_party'
                },

                // Addresses - save null if not selected
                shipFrom: shipFromAddress || null,
                shipTo: shipToAddress || null,

                // Packages - save whatever exists
                packages: packages || [],

                // Rate information - clean undefined values if available
                ...(selectedRate ? { selectedRate: cleanObject(selectedRate) } : {}),

                // Additional Services (freight and courier)
                additionalServices: (shipmentInfo.shipmentType === 'freight' || shipmentInfo.shipmentType === 'courier') ? additionalServices : [],

                // Broker information
                selectedBroker: selectedBroker || '',
                brokerDetails: selectedBroker ? companyBrokers.find(b => b.name === selectedBroker) : null,
                brokerPort: brokerPort || '', // Add shipment-level broker port
                brokerReference: brokerReference || '', // Add shipment-level broker reference

                // Customer filter for super admins
                ...(userRole === 'superadmin' && selectedCustomerId ? { selectedCustomerId } : {}),

                // Draft specific fields
                isDraft: true,
                draftSavedAt: new Date(),
                draftVersion: increment(1)
            };

            if (isEditingDraft && (activeDraftId || draftIdToLoad)) {
                // Update existing draft
                const docId = activeDraftId || draftIdToLoad;
                await updateDoc(doc(db, 'shipments', docId), {
                    ...draftData,
                    updatedAt: new Date()
                });
                setFormErrors({}); // Clear form errors on successful save
                showMessage('Draft updated successfully');
            } else if (activeDraftId) {
                // Update the initial draft we created
                await updateDoc(doc(db, 'shipments', activeDraftId), {
                    ...draftData,
                    updatedAt: new Date()
                });
                setFormErrors({}); // Clear form errors on successful save
                showMessage('Draft saved successfully');
            } else {
                // Create new draft (fallback)
                const docRef = await addDoc(collection(db, 'shipments'), {
                    ...draftData,
                    createdAt: new Date()
                });
                setActiveDraftId(docRef.id);
                setFormErrors({}); // Clear form errors on successful save
                showMessage('Draft saved successfully');
            }

            // Call the parent callback to refresh shipments table
            if (onDraftSaved) {
                console.log('🔄 Calling parent callback to refresh shipments table after draft save');
                const docId = activeDraftId || draftIdToLoad;
                onDraftSaved(docId, 'Draft saved successfully');
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

                // Origin address (shipFrom) - CRITICAL: eShip Plus requires complete contact information
                Origin: {
                    Description: shipFromAddress.companyName || 'N/A',
                    Street: shipFromAddress.street || 'N/A',
                    StreetExtra: shipFromAddress.street2 || '',
                    PostalCode: shipFromAddress.postalCode || 'N/A',
                    City: shipFromAddress.city || 'N/A',
                    State: shipFromAddress.state || 'N/A',
                    Country: {
                        Code: shipFromAddress.country || 'CA',
                        Name: shipFromAddress.country === 'CA' ? 'Canada' : 'United States',
                        UsesPostalCode: true
                    },
                    Contact: shipFromAddress.contactName || `${shipFromAddress.firstName || ''} ${shipFromAddress.lastName || ''}`.trim() || 'Shipping Department',
                    Phone: shipFromAddress.contactPhone || shipFromAddress.phone || '555-000-0000',
                    Email: shipFromAddress.contactEmail || shipFromAddress.email || 'noreply@solushipx.com',
                    Fax: '',
                    Mobile: '',
                    SpecialInstructions: shipFromAddress.specialInstructions || 'None'
                },

                // Destination address (shipTo) - CRITICAL: eShip Plus requires complete contact information
                Destination: {
                    Description: shipToAddress.companyName || 'N/A',
                    Street: shipToAddress.street || 'N/A',
                    StreetExtra: shipToAddress.street2 || '',
                    PostalCode: shipToAddress.postalCode || 'N/A',
                    City: shipToAddress.city || 'N/A',
                    State: shipToAddress.state || 'N/A',
                    Country: {
                        Code: shipToAddress.country || 'CA',
                        Name: shipToAddress.country === 'CA' ? 'Canada' : 'United States',
                        UsesPostalCode: true
                    },
                    Contact: shipToAddress.contactName || `${shipToAddress.firstName || ''} ${shipToAddress.lastName || ''}`.trim() || 'Receiving Department',
                    Phone: shipToAddress.contactPhone || shipToAddress.phone || '555-000-0000',
                    Email: shipToAddress.contactEmail || shipToAddress.email || 'noreply@solushipx.com',
                    Fax: '',
                    Mobile: '',
                    SpecialInstructions: shipToAddress.specialInstructions || 'None'
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
                    DeclaredValue: parseFloat(pkg.declaredValue) || 0,
                    DeclaredValueCurrency: pkg.declaredValueCurrency || 'CAD',
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
                    actualShipDate: shipmentInfo.shipmentDate,
                    // Ensure reference numbers are included
                    referenceNumbers: shipmentInfo.referenceNumbers || []
                },

                // Additional services
                additionalServices: (shipmentInfo.shipmentType === 'freight' || shipmentInfo.shipmentType === 'courier') ? additionalServices : []
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
                createdAt: new Date(),
                updatedAt: new Date(),

                // Shipment information
                shipmentInfo: {
                    ...shipmentInfo,
                    totalWeight: totalWeight,
                    totalPieces: totalPieces,
                    actualShipDate: shipmentInfo.shipmentDate,
                    referenceNumbers: shipmentInfo.referenceNumbers || []
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
                    height: parseFloat(pkg.height || 0),
                    declaredValue: parseFloat(pkg.declaredValue || 0),
                    declaredValueCurrency: pkg.declaredValueCurrency || 'CAD'
                })),

                // Additional Services (freight and courier)
                additionalServices: (shipmentInfo.shipmentType === 'freight' || shipmentInfo.shipmentType === 'courier') ? additionalServices : [],

                // Broker information
                selectedBroker: selectedBroker || '',
                brokerDetails: selectedBroker ? companyBrokers.find(b => b.name === selectedBroker) : null,
                brokerPort: brokerPort || '', // Add shipment-level broker port
                brokerReference: brokerReference || '', // Add shipment-level broker reference

                // Selected rate and carrier information (clean undefined values)
                selectedRate: cleanUndefinedValues(selectedRate),
                carrier: selectedRate?.carrier?.name || selectedRate?.sourceCarrierName || 'Unknown',
                totalCharges: selectedRate?.pricing?.total || selectedRate?.totalCharges || 0,
                currency: selectedRate?.pricing?.currency || 'USD',

                // DUAL RATE STORAGE: Store both actual and markup rates
                actualRates: selectedRate?.markupMetadata ? {
                    totalCharges: selectedRate.markupMetadata.originalTotal,
                    freightCharges: selectedRate.pricing?.freight || 0,
                    fuelCharges: selectedRate.pricing?.fuel || 0,
                    serviceCharges: selectedRate.pricing?.service || 0,
                    accessorialCharges: selectedRate.pricing?.accessorial || 0,
                    currency: selectedRate.pricing?.currency || 'USD',
                    appliedMarkups: selectedRate.markupMetadata.appliedMarkups || [],
                    // Create detailed billing breakdown for cost display
                    billingDetails: (() => {
                        const billingDetails = [];

                        // Get actual amounts from billingDetails if markup was applied
                        if (selectedRate.billingDetails && Array.isArray(selectedRate.billingDetails)) {
                            selectedRate.billingDetails.forEach(detail => {
                                if (detail.amount > 0) {
                                    const actualAmount = detail.actualAmount || detail.amount;
                                    billingDetails.push({
                                        name: detail.name,
                                        amount: actualAmount, // Use actualAmount for original cost
                                        category: detail.category
                                    });
                                }
                            });
                        } else {
                            // Fallback: Since markup engine typically applies markup only to freight,
                            // calculate original freight amount and keep other charges unchanged
                            const totalMarkupAmount = selectedRate.markupMetadata.totalMarkupAmount || 0;
                            const originalFreight = Math.max(0, (selectedRate.pricing?.freight || 0) - totalMarkupAmount);

                            if (selectedRate.pricing?.freight > 0) {
                                billingDetails.push({
                                    name: 'Freight Charges',
                                    amount: originalFreight,
                                    category: 'freight'
                                });
                            }
                            // Fuel, service, and accessorial typically don't get markup
                            if (selectedRate.pricing?.fuel > 0) {
                                billingDetails.push({
                                    name: 'Fuel Charges',
                                    amount: selectedRate.pricing.fuel || 0,
                                    category: 'fuel'
                                });
                            }
                            if (selectedRate.pricing?.service > 0) {
                                billingDetails.push({
                                    name: 'Service Charges',
                                    amount: selectedRate.pricing.service || 0,
                                    category: 'service'
                                });
                            }
                            if (selectedRate.pricing?.accessorial > 0) {
                                billingDetails.push({
                                    name: 'Accessorial Charges',
                                    amount: selectedRate.pricing.accessorial || 0,
                                    category: 'accessorial'
                                });
                            }
                        }

                        return billingDetails;
                    })()
                } : {
                    // If no markup metadata, rates are actual rates
                    totalCharges: selectedRate?.pricing?.total || selectedRate?.totalCharges || 0,
                    freightCharges: selectedRate?.pricing?.freight || 0,
                    fuelCharges: selectedRate?.pricing?.fuel || 0,
                    serviceCharges: selectedRate?.pricing?.service || 0,
                    accessorialCharges: selectedRate?.pricing?.accessorial || 0,
                    currency: selectedRate?.pricing?.currency || 'USD',
                    appliedMarkups: [],
                    // Create billing details from current pricing (no markup applied)
                    billingDetails: [
                        ...(selectedRate.pricing?.freight > 0 ? [{
                            name: 'Freight Charges',
                            amount: selectedRate.pricing.freight || 0,
                            category: 'freight'
                        }] : []),
                        ...(selectedRate.pricing?.fuel > 0 ? [{
                            name: 'Fuel Charges',
                            amount: selectedRate.pricing.fuel || 0,
                            category: 'fuel'
                        }] : []),
                        ...(selectedRate.pricing?.service > 0 ? [{
                            name: 'Service Charges',
                            amount: selectedRate.pricing.service || 0,
                            category: 'service'
                        }] : []),
                        ...(selectedRate.pricing?.accessorial > 0 ? [{
                            name: 'Accessorial Charges',
                            amount: selectedRate.pricing.accessorial || 0,
                            category: 'accessorial'
                        }] : [])
                    ]
                },
                markupRates: {
                    totalCharges: selectedRate?.pricing?.total || selectedRate?.totalCharges || 0,
                    freightCharges: selectedRate?.pricing?.freight || 0,
                    fuelCharges: selectedRate?.pricing?.fuel || 0,
                    serviceCharges: selectedRate?.pricing?.service || 0,
                    accessorialCharges: selectedRate?.pricing?.accessorial || 0,
                    currency: selectedRate?.pricing?.currency || 'USD',
                    markupAmount: selectedRate?.markupMetadata?.totalMarkupAmount || 0,
                    markupPercentage: selectedRate?.markupMetadata ?
                        (selectedRate.markupMetadata.totalMarkupAmount / selectedRate.markupMetadata.originalTotal) * 100 : 0,
                    appliedMarkups: selectedRate?.markupMetadata?.appliedMarkups || [],
                    // Create detailed billing breakdown with markup amounts
                    billingDetails: (() => {
                        const markupBillingDetails = [];

                        // Use the markup amounts from selectedRate.billingDetails if available
                        if (selectedRate.billingDetails && Array.isArray(selectedRate.billingDetails)) {
                            selectedRate.billingDetails.forEach(detail => {
                                if (detail.amount > 0) {
                                    // For markup rates, use the final amount (which includes markup for freight)
                                    const markupAmount = detail.amount;
                                    markupBillingDetails.push({
                                        name: detail.name,
                                        amount: markupAmount, // Use the marked-up amount
                                        category: detail.category
                                    });
                                }
                            });
                        } else {
                            // Fallback to pricing breakdown
                            if (selectedRate.pricing?.freight > 0) {
                                markupBillingDetails.push({
                                    name: 'Freight Charges',
                                    amount: selectedRate.pricing.freight || 0,
                                    category: 'freight'
                                });
                            }
                            if (selectedRate.pricing?.fuel > 0) {
                                markupBillingDetails.push({
                                    name: 'Fuel Charges',
                                    amount: selectedRate.pricing.fuel || 0,
                                    category: 'fuel'
                                });
                            }
                            if (selectedRate.pricing?.service > 0) {
                                markupBillingDetails.push({
                                    name: 'Service Charges',
                                    amount: selectedRate.pricing.service || 0,
                                    category: 'service'
                                });
                            }
                            if (selectedRate.pricing?.accessorial > 0) {
                                markupBillingDetails.push({
                                    name: 'Accessorial Charges',
                                    amount: selectedRate.pricing.accessorial || 0,
                                    category: 'accessorial'
                                });
                            }
                        }

                        return markupBillingDetails;
                    })()
                },

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
            if (editMode && editShipment) {
                // Update existing shipment
                draftFirestoreDocId = editShipment.id;
                await updateDoc(doc(db, 'shipments', draftFirestoreDocId), {
                    ...shipmentData,
                    updatedAt: new Date(),
                    status: 'booked' // Keep the booked status
                });
            } else if (isEditingDraft && (activeDraftId || draftIdToLoad)) {
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
                createdAt: new Date(),
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

                // Call the parent callback to refresh shipments table
                if (onShipmentUpdated) {
                    console.log('🔄 Calling parent callback to refresh shipments table after shipment booking');
                    onShipmentUpdated(finalShipmentID, 'Shipment booked successfully');
                }

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
        if (finalShipmentId && onViewShipment) {
            // Call the onViewShipment prop immediately to open shipment detail
            console.log('🎯 CreateShipmentX: Calling onViewShipment with shipmentId:', finalShipmentId);

            // Don't close dialogs here - let the parent handle the modal transitions
            // This prevents the CreateShipmentX modal from closing too early
            onViewShipment(finalShipmentId);

            // The parent Dashboard component will handle closing modals in the right order
        } else if (finalShipmentId) {
            // Fallback: If no onViewShipment prop but we have a shipment ID, try direct navigation
            console.log('🎯 CreateShipmentX: No onViewShipment prop, attempting direct admin navigation');

            // Check if we're in an admin context (look for admin in the URL)
            const isAdminContext = window.location.pathname.includes('/admin');

            if (isAdminContext) {
                // Navigate directly to admin shipment detail
                window.location.href = `/admin/shipments?shipment=${finalShipmentId}`;
            } else {
                // Navigate to regular shipment detail
                window.location.href = `/shipments/${finalShipmentId}`;
            }
        } else if (onReturnToShipments) {
            onReturnToShipments();
        }
    };

    // Add keyboard navigation helpers
    const handleKeyDown = (e, action) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            // Ctrl+Enter to book shipment
            if (action === 'book') {
                handleBookShipment();
            }
        } else if (e.key === 'Enter' && e.shiftKey) {
            // Shift+Enter to save as draft
            if (action === 'draft') {
                handleSaveAsDraft();
            }
        } else if (e.key === 'Enter' && !e.ctrlKey && !e.shiftKey) {
            // Enter to move to next field in package section
            const currentField = e.target;
            const tabIndex = parseInt(currentField.getAttribute('tabindex') || currentField.tabIndex);
            if (tabIndex) {
                const nextField = document.querySelector(`[tabindex="${tabIndex + 1}"]`);
                if (nextField) {
                    nextField.focus();
                    e.preventDefault();
                }
            }
        }
    };

    // Calculate base tab index for each package (200 per package for CreateShipmentX)
    const getPackageBaseTabIndex = (packageIndex) => 200 + (packageIndex * 200);

    // Process prePopulatedData from conversion (QuickShip → CreateShipmentX)
    useEffect(() => {
        console.log('🔍 PREPOPULATED DATA USEEFFECT TRIGGERED:', {
            hasPrePopulatedData: !!prePopulatedData,
            prePopulatedData: prePopulatedData,
            activeDraftId: activeDraftId,
            isConversion: prePopulatedData?.isConversion,
            condition: !!(prePopulatedData && (!activeDraftId || prePopulatedData?.isConversion))
        });

        if (prePopulatedData && (!activeDraftId || prePopulatedData?.isConversion)) {
            console.log('🔄 CreateShipmentX processing converted data from QuickShip:', prePopulatedData);

            // Apply converted shipment information
            if (prePopulatedData.shipmentInfo) {
                console.log('🔄 Applying shipment info:', prePopulatedData.shipmentInfo);
                setShipmentInfo(prev => ({
                    ...prev,
                    ...prePopulatedData.shipmentInfo
                }));
            }

            // Apply address data
            if (prePopulatedData.shipFromAddress) {
                console.log('🔄 Applying ship from address:', prePopulatedData.shipFromAddress);
                setShipFromAddress(prePopulatedData.shipFromAddress);
            }

            if (prePopulatedData.shipToAddress) {
                console.log('🔄 Applying ship to address:', prePopulatedData.shipToAddress);
                setShipToAddress(prePopulatedData.shipToAddress);
            }

            // Apply package data
            if (prePopulatedData.packages && prePopulatedData.packages.length > 0) {
                console.log('🔄 Applying packages:', prePopulatedData.packages);
                setPackages(prePopulatedData.packages);
            }

            // Apply converted rate as selectedRate (from manual rates) with charge type migration
            if (prePopulatedData.selectedRate) {
                console.log('🔄 Applying selected rate:', prePopulatedData.selectedRate);

                // Check if the selectedRate contains billing details that need charge type migration
                if (prePopulatedData.selectedRate.billingDetails && Array.isArray(prePopulatedData.selectedRate.billingDetails)) {
                    const migratedBillingDetails = prePopulatedData.selectedRate.billingDetails.map(detail => {
                        if (detail.code) {
                            // Migrate the charge code if needed
                            const migrationResult = mapAPIChargesToDynamicTypes(detail.category || '', detail.name || '', availableChargeTypes);
                            return {
                                ...detail,
                                code: migrationResult.chargeCode || detail.code,
                                name: migrationResult.chargeName || detail.name
                            };
                        }
                        return detail;
                    });

                    setSelectedRate({
                        ...prePopulatedData.selectedRate,
                        billingDetails: migratedBillingDetails
                    });
                } else {
                    setSelectedRate(prePopulatedData.selectedRate);
                }
            }

            // Apply additional services
            if (prePopulatedData.additionalServices) {
                console.log('🔄 Applying additional services:', prePopulatedData.additionalServices);
                setAdditionalServices(prePopulatedData.additionalServices);
            }

            // Apply broker information
            if (prePopulatedData.selectedBroker) {
                console.log('🔄 Applying selected broker:', prePopulatedData.selectedBroker);
                setSelectedBroker(prePopulatedData.selectedBroker);
            }
            if (prePopulatedData.brokerPort) {
                console.log('🔄 Applying broker port:', prePopulatedData.brokerPort);
                setBrokerPort(prePopulatedData.brokerPort);
            }
            if (prePopulatedData.brokerReference) {
                console.log('🔄 Applying broker reference:', prePopulatedData.brokerReference);
                setBrokerReference(prePopulatedData.brokerReference);
            }

            // **CRITICAL**: Maintain the same shipmentID for continuity
            if (prePopulatedData.shipmentID) {
                console.log('🔄 Applying shipment ID:', prePopulatedData.shipmentID);
                setShipmentID(prePopulatedData.shipmentID);
            }

            // Maintain draft status for seamless conversion
            if (prePopulatedData.isEditingDraft && prePopulatedData.activeDraftId) {
                console.log('🔄 Applying draft status:', prePopulatedData.isEditingDraft, prePopulatedData.activeDraftId);
                setIsEditingDraft(prePopulatedData.isEditingDraft);
                setActiveDraftId(prePopulatedData.activeDraftId);
            }

            console.log('✅ CreateShipmentX conversion from QuickShip completed successfully');
        } else {
            console.log('❌ PREPOPULATED DATA USEEFFECT CONDITIONS NOT MET:', {
                hasPrePopulatedData: !!prePopulatedData,
                activeDraftId: activeDraftId,
                reason: !prePopulatedData ? 'No prePopulatedData' : activeDraftId ? 'activeDraftId exists' : 'Unknown'
            });
        }
    }, [prePopulatedData, activeDraftId]);

    // Conversion state
    const [showConversionDialog, setShowConversionDialog] = useState(false);
    const [isConverting, setIsConverting] = useState(false);



    // Conversion function to transform CreateShipmentX data to QuickShip format
    const convertToQuickShip = useCallback(() => {
        console.log('🔄 Converting CreateShipmentX to QuickShip format');

        const convertedData = {
            // Basic shipment information
            shipmentInfo: {
                shipmentType: shipmentInfo.shipmentType || 'freight',
                shipmentDate: shipmentInfo.shipmentDate || new Date().toISOString().split('T')[0],
                shipperReferenceNumber: shipmentInfo.shipperReferenceNumber || shipmentID || '',
                carrierTrackingNumber: '', // QuickShip allows manual tracking number entry
                bookingReferenceNumber: '',
                bookingReferenceType: 'PO',
                billType: shipmentInfo.billType || 'third_party',
                serviceLevel: shipmentInfo.serviceLevel || 'any',
                dangerousGoodsType: 'none',
                signatureServiceType: 'none',
                notes: '',
                referenceNumbers: shipmentInfo.referenceNumbers || []
            },

            // Address data - direct copy since formats are compatible
            shipFromAddress: shipFromAddress,
            shipToAddress: shipToAddress,

            // Package data - transform to QuickShip format
            packages: packages.map(pkg => ({
                id: pkg.id,
                itemDescription: pkg.itemDescription || '',
                packagingType: pkg.packagingType || 262, // Default to SKID(S)
                packagingQuantity: pkg.packagingQuantity || 1,
                weight: pkg.weight || '',
                length: pkg.length || (shipmentInfo.shipmentType === 'courier' ? '12' : '48'),
                width: pkg.width || (shipmentInfo.shipmentType === 'courier' ? '12' : '40'),
                height: pkg.height || (shipmentInfo.shipmentType === 'courier' ? '12' : '48'),
                freightClass: pkg.freightClass || '',
                unitSystem: pkg.unitSystem || 'imperial',
                declaredValue: pkg.declaredValue || '',
                declaredValueCurrency: pkg.declaredValueCurrency || 'CAD'
            })),

            // Manual rates - convert selected rate to manual rate entries
            manualRates: (() => {
                const rates = [];
                let rateId = 1;

                if (selectedRate) {
                    console.log('🔄 Converting selected rate to manual rates:', selectedRate);

                    // Extract carrier name
                    const carrierName = selectedRate.carrier?.name || selectedRate.sourceCarrierName || '';

                    // Main freight charge
                    // Check if we have markup metadata to determine cost vs charge
                    const hasMarkup = selectedRate.markupMetadata && selectedRate.markupMetadata.originalTotal;

                    if (selectedRate.pricing?.freight || selectedRate.freightCharges) {
                        const freightAmount = selectedRate.pricing?.freight || selectedRate.freightCharges || 0;
                        // If markup was applied, calculate the original cost
                        const freightCost = hasMarkup ?
                            Math.max(0, freightAmount - (selectedRate.markupMetadata.totalMarkupAmount || 0)) :
                            freightAmount;

                        rates.push({
                            id: rateId++,
                            carrier: carrierName,
                            code: 'FRT',
                            chargeName: 'Freight',
                            cost: freightCost.toString(),
                            costCurrency: selectedRate.pricing?.currency || 'CAD',
                            charge: freightAmount.toString(),
                            chargeCurrency: selectedRate.pricing?.currency || 'CAD'
                        });
                    }

                    // Fuel surcharge (typically no markup on fuel)
                    if (selectedRate.pricing?.fuel || selectedRate.fuelCharges) {
                        const fuelAmount = selectedRate.pricing?.fuel || selectedRate.fuelCharges || 0;
                        rates.push({
                            id: rateId++,
                            carrier: carrierName,
                            code: 'FUE',
                            chargeName: 'Fuel Surcharge',
                            cost: fuelAmount.toString(),
                            costCurrency: selectedRate.pricing?.currency || 'CAD',
                            charge: fuelAmount.toString(),
                            chargeCurrency: selectedRate.pricing?.currency || 'CAD'
                        });
                    }

                    // Service charges (typically no markup on service)
                    if (selectedRate.pricing?.service || selectedRate.serviceCharges) {
                        const serviceAmount = selectedRate.pricing?.service || selectedRate.serviceCharges || 0;
                        rates.push({
                            id: rateId++,
                            carrier: carrierName,
                            code: 'SUR',
                            chargeName: 'Service Charges',
                            cost: serviceAmount.toString(),
                            costCurrency: selectedRate.pricing?.currency || 'CAD',
                            charge: serviceAmount.toString(),
                            chargeCurrency: selectedRate.pricing?.currency || 'CAD'
                        });
                    }

                    // Accessorial charges (typically no markup on accessorial)
                    if (selectedRate.pricing?.accessorial || selectedRate.accessorialCharges) {
                        const accessorialAmount = selectedRate.pricing?.accessorial || selectedRate.accessorialCharges || 0;
                        rates.push({
                            id: rateId++,
                            carrier: carrierName,
                            code: 'ACC',
                            chargeName: 'Accessorial',
                            cost: accessorialAmount.toString(),
                            costCurrency: selectedRate.pricing?.currency || 'CAD',
                            charge: accessorialAmount.toString(),
                            chargeCurrency: selectedRate.pricing?.currency || 'CAD'
                        });
                    }

                    // If there are billing details, use those instead for more accurate breakdown
                    if (selectedRate.billingDetails && Array.isArray(selectedRate.billingDetails) && selectedRate.billingDetails.length > 0) {
                        rates.length = 0; // Clear the above rates
                        rateId = 1; // Reset ID

                        selectedRate.billingDetails.forEach(detail => {
                            if (detail.amount && detail.amount > 0) {
                                // Map charge categories to dynamic charge type codes
                                const detailName = detail.name || '';
                                const detailCategory = detail.category || '';

                                // Use dynamic charge type mapping with fallback to static codes
                                const mappingResult = mapAPIChargesToDynamicTypes(detailCategory, detailName, availableChargeTypes);
                                const code = mappingResult.chargeCode || 'MSC'; // Default to miscellaneous if mapping fails
                                const chargeName = mappingResult.chargeName || detailName || 'Unknown Charge';

                                rates.push({
                                    id: rateId++,
                                    carrier: carrierName,
                                    code: code,
                                    chargeName: chargeName,
                                    cost: detail.actualAmount ? detail.actualAmount.toString() : detail.amount.toString(),
                                    costCurrency: selectedRate.pricing?.currency || 'CAD',
                                    charge: detail.amount.toString(),
                                    chargeCurrency: selectedRate.pricing?.currency || 'CAD'
                                });
                            }
                        });
                    }
                }

                // If no selected rate, create default empty rates
                if (rates.length === 0) {
                    rates.push(
                        {
                            id: 1,
                            carrier: '',
                            code: 'FRT',
                            chargeName: 'Freight',
                            cost: '',
                            costCurrency: 'CAD',
                            charge: '',
                            chargeCurrency: 'CAD'
                        },
                        {
                            id: 2,
                            carrier: '',
                            code: 'FUE',
                            chargeName: 'Fuel Surcharge',
                            cost: '',
                            costCurrency: 'CAD',
                            charge: '',
                            chargeCurrency: 'CAD'
                        }
                    );
                }

                return rates;
            })(),

            // Carrier information
            selectedCarrier: selectedRate?.carrier?.name || selectedRate?.sourceCarrierName || '',

            // Additional services - direct copy since format is compatible
            additionalServices: additionalServices || [],

            // Broker information
            selectedBroker: selectedBroker || '',
            brokerPort: brokerPort || '',
            brokerReference: brokerReference || '',

            // Draft information for continuity
            shipmentID: shipmentID,
            isEditingDraft: isEditingDraft,
            activeDraftId: activeDraftId,

            // Customer information for super admins
            selectedCustomerId: selectedCustomerId,

            // Rate source information
            rateSource: 'converted_from_manual'
        };

        console.log('🔄 Converted data for QuickShip:', convertedData);
        return convertedData;
    }, [shipmentInfo, shipFromAddress, shipToAddress, packages, selectedRate, additionalServices, selectedBroker, brokerPort, brokerReference, shipmentID, isEditingDraft, activeDraftId, selectedCustomerId]);

    // Simple conversion system
    const handleConvertToQuickShip = () => {
        setShowConversionDialog(true);
    };



    // Handle conversion confirmation
    const confirmConvertToQuickShip = async () => {
        setIsConverting(true);
        setShowConversionDialog(false);

        try {
            // If we have an active draft, save the current form data first before converting
            if (isEditingDraft && activeDraftId) {
                console.log('🔄 Saving current form data before conversion...');

                // Prepare the draft data with latest form values
                const draftData = {
                    shipmentInfo: {
                        ...shipmentInfo,
                        shipmentDate: shipmentInfo.shipmentDate || new Date().toISOString().split('T')[0]
                    },
                    shipFromAddress: shipFromAddress ? {
                        ...shipFromAddress,
                        id: shipFromAddress.id || shipFromAddress.addressID || shipFromAddress.uid
                    } : null,
                    shipToAddress: shipToAddress ? {
                        ...shipToAddress,
                        id: shipToAddress.id || shipToAddress.addressID || shipToAddress.uid
                    } : null,
                    packages,
                    selectedRate,
                    additionalServices,
                    selectedBroker,
                    brokerPort,
                    brokerReference,
                    shipmentID,
                    creationMethod: 'advanced',
                    status: 'draft',
                    lastUpdated: new Date().toISOString(),
                    selectedCustomerId: selectedCustomerId || null
                };

                // Update the draft with latest data
                const draftRef = doc(db, 'shipments', activeDraftId);

                try {
                    await updateDoc(draftRef, draftData);
                    console.log('✅ Draft updated with latest form data before conversion');
                } catch (updateError) {
                    console.error('Error updating draft before conversion:', updateError);
                    // Show error but allow conversion to continue with existing draft data
                    showMessage('Warning: Could not save latest changes before conversion. Converting existing draft data.', 'warning');
                }

                console.log('🔄 Converting draft in database:', activeDraftId);

                // Convert the draft in the database
                const success = await convertDraftInDatabase(activeDraftId, 'quickship');

                if (success) {
                    showMessage('Successfully converted to QuickShip format!', 'success');

                    // Call the parent conversion handler to reload with the converted draft
                    if (typeof onConvertToQuickShip === 'function') {
                        console.log('🔄 CreateShipmentX: Calling onConvertToQuickShip with draft ID');
                        // Pass the draft ID so QuickShip can load it
                        onConvertToQuickShip({ activeDraftId, isConversion: true });
                    }
                } else {
                    showMessage('Failed to convert to QuickShip format', 'error');
                }
            } else {
                // For non-draft shipments, use the old method
                const convertedData = convertToQuickShip();

                console.log('🔄 CreateShipmentX: About to call onConvertToQuickShip callback');
                console.log('🔄 CreateShipmentX: onConvertToQuickShip exists?', !!onConvertToQuickShip);
                console.log('🔄 CreateShipmentX: onConvertToQuickShip type:', typeof onConvertToQuickShip);

                // Call the parent conversion handler
                if (typeof onConvertToQuickShip === 'function') {
                    console.log('🔄 CreateShipmentX: Calling onConvertToQuickShip with data:', convertedData);
                    onConvertToQuickShip(convertedData);
                    showMessage('Successfully converted to QuickShip format!', 'success');
                } else {
                    console.error('🚨 CreateShipmentX: onConvertToQuickShip callback is not a function!');
                    showMessage('Conversion callback not available', 'error');
                }
            }

        } catch (error) {
            console.error('Error converting to QuickShip:', error);
            showMessage('Failed to convert to QuickShip format', 'error');
        } finally {
            setIsConverting(false);
        }
    };

    return (
        <Box sx={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Modal Header */}
            {isModal && (
                <ModalHeader
                    title={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Typography variant="h6" component="span" sx={{ fontWeight: 600, fontSize: '16px' }}>
                                {isEditingDraft ? `Edit Dynamic Shipment Draft${shipmentID ? ` - ${shipmentID}` : ''}` : `Dynamic Shipment${shipmentID ? ` - ${shipmentID}` : ''}`}
                            </Typography>
                            {/* Show status chip when editing existing shipment */}
                            {editShipment && editShipment.status && (
                                <EnhancedStatusChip
                                    status={editShipment.status}
                                    size="small"
                                    displayMode="master"
                                    showTooltip={true}
                                    sx={{ ml: 1 }}
                                />
                            )}
                        </Box>
                    }
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
            {!authLoading && !companyLoading && (!user?.uid || (!companyData?.companyID && userRole !== 'superadmin')) && (
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
            {!authLoading && !companyLoading && user?.uid && (companyData?.companyID || userRole === 'superadmin' || userRole === 'manufacturer') && (
                <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                    {/* Company Selector for Super Admins */}
                    {(() => {
                        const shouldShowSelector = (userRole === 'superadmin' && !companyIdForAddress) ||
                            (userRole === 'manufacturer' && !companyIdForAddress);
                        console.log('🔍 CreateShipmentX Company Selector Debug:', {
                            userRole,
                            companyIdForAddress,
                            selectedCompanyId,
                            needsCompanySelection,
                            shouldShowSelector,
                            isManufacturer: userRole === 'manufacturer'
                        });
                        return shouldShowSelector;
                    })() && (
                            <CompanySelector
                                selectedCompanyId={selectedCompanyId || companyIdForAddress}
                                onCompanyChange={handleCompanySelection}
                                userRole={userRole}
                                size="small"
                                required={true}
                                label={userRole === 'manufacturer' ? "Company Context" : "Select Company to Create Shipment"}
                                placeholder={userRole === 'manufacturer' ? "Your assigned company..." : "Choose a company to create shipment on their behalf..."}
                                locked={userRole === 'manufacturer'} // Lock for manufacturers
                                showDescription={false}
                            />
                        )}

                    {/* Customer Selection for All User Roles - Show when company is selected */}
                    {(userRole === 'superadmin' || userRole === 'admin' || userRole === 'user' || userRole === 'company_staff' || userRole === 'manufacturer') && (selectedCompanyId || companyIdForAddress) && (
                        <Box sx={{ mb: 3 }}>
                            <Autocomplete
                                value={availableCustomers.find(c => (c.customerID || c.id) === selectedCustomerId) || null}
                                onChange={(event, newValue) => {
                                    const customerId = newValue?.customerID || newValue?.id || null;
                                    console.log('🎯 CreateShipmentX Customer selected:', {
                                        newValue,
                                        customerID: newValue?.customerID,
                                        id: newValue?.id,
                                        finalCustomerId: customerId,
                                        previousSelectedCustomerId: selectedCustomerId,
                                        userRole,
                                        availableCustomersCount: availableCustomers.length
                                    });
                                    setSelectedCustomerId(customerId);
                                }}
                                options={availableCustomers}
                                getOptionLabel={(option) => option.name || ''}
                                loading={loadingCustomers}
                                disabled={loadingCustomers}
                                renderInput={(params) => {
                                    const selectedCustomer = availableCustomers.find(c => (c.customerID || c.id) === selectedCustomerId);
                                    const isCustomerSelected = !!selectedCustomer;

                                    return (
                                        <TextField
                                            {...params}
                                            label={
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <PersonIcon sx={{ fontSize: '16px' }} />
                                                    Select Customer
                                                </Box>
                                            }
                                            placeholder={loadingCustomers ? "Loading customers..." : "Search customers..."}
                                            size="small"
                                            sx={{
                                                '& .MuiInputBase-input': {
                                                    fontSize: '12px',
                                                    // Hide the input field completely when a customer is selected
                                                    opacity: isCustomerSelected ? 0 : 1,
                                                    width: isCustomerSelected ? 0 : 'auto',
                                                    padding: isCustomerSelected ? 0 : undefined
                                                },
                                                '& .MuiInputLabel-root': { fontSize: '12px' }
                                            }}
                                            helperText={
                                                loadingCustomers ? 'Loading customers...' :
                                                    !loadingCustomers && availableCustomers.length === 0 && (selectedCompanyId || companyIdForAddress) ?
                                                        'No customers found for selected company' : ''
                                            }
                                            FormHelperTextProps={{
                                                sx: { fontSize: '11px', color: '#6b7280' }
                                            }}
                                            InputProps={{
                                                ...params.InputProps,
                                                startAdornment: isCustomerSelected ? (
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, ml: 0.5, width: '100%' }}>
                                                        <Avatar
                                                            src={selectedCustomer.logo || selectedCustomer.logoUrl}
                                                            sx={{
                                                                width: 24,
                                                                height: 24,
                                                                bgcolor: '#059669',
                                                                fontSize: '11px',
                                                                fontWeight: 600
                                                            }}
                                                        >
                                                            {!selectedCustomer.logo && !selectedCustomer.logoUrl && (selectedCustomer.name || 'C').charAt(0).toUpperCase()}
                                                        </Avatar>
                                                        <Box>
                                                            <Typography sx={{ fontSize: '12px', fontWeight: 500, lineHeight: 1.2 }}>
                                                                {selectedCustomer.name}
                                                            </Typography>
                                                            <Typography sx={{ fontSize: '11px', color: '#6b7280', lineHeight: 1 }}>
                                                                ID: {selectedCustomer.customerID || selectedCustomer.id}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                ) : params.InputProps.startAdornment,
                                            }}
                                        />
                                    );
                                }}
                                renderOption={(props, option) => (
                                    <Box component="li" {...props} sx={{ p: 1.5 }}>
                                        {option.customerID === 'all' || option.id === 'all' ? (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                <PersonIcon sx={{ fontSize: '20px', color: '#6b7280' }} />
                                                <Box>
                                                    <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                        All Customers
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                        Show addresses for all customers
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        ) : (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                <Avatar
                                                    src={option.logo || option.logoUrl}
                                                    sx={{
                                                        width: 28,
                                                        height: 28,
                                                        bgcolor: '#059669',
                                                        fontSize: '11px',
                                                        fontWeight: 600
                                                    }}
                                                >
                                                    {!option.logo && !option.logoUrl && (option.name || 'C').charAt(0).toUpperCase()}
                                                </Avatar>
                                                <Box sx={{ minWidth: 0, flex: 1 }}>
                                                    <Typography sx={{
                                                        fontSize: '12px',
                                                        fontWeight: 500,
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        {option.name || 'Unknown Customer'}
                                                    </Typography>
                                                    <Typography sx={{
                                                        fontSize: '11px',
                                                        color: '#6b7280',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}>
                                                        ID: {option.customerID || option.id}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        )}
                                    </Box>
                                )}
                                isOptionEqualToValue={(option, value) => {
                                    const optionId = option.customerID || option.id;
                                    const valueId = value.customerID || value.id;
                                    return optionId === valueId;
                                }}
                                filterOptions={(options, { inputValue }) => {
                                    const trimmedInput = inputValue?.trim(); // CRITICAL FIX: Strip leading/trailing spaces
                                    if (!trimmedInput) return options;

                                    const filtered = options.filter(option => {
                                        if (option.customerID === 'all' || option.id === 'all') {
                                            return 'all customers'.includes(trimmedInput.toLowerCase());
                                        }
                                        const name = (option.name || '').toLowerCase();
                                        const customerId = (option.customerID || option.id || '').toLowerCase();
                                        const searchTerm = trimmedInput.toLowerCase();

                                        return name.includes(searchTerm) || customerId.includes(searchTerm);
                                    });

                                    return filtered;
                                }}
                                sx={{ width: '100%' }}
                                size="small"
                            />
                        </Box>
                    )}

                    {/* Show rest of form only when company is selected or user is not super admin */}
                    {(() => {
                        const shouldShowForm =
                            // Super admin: needs company selected
                            (userRole === 'superadmin' && ((companyIdForAddress && companyIdForAddress !== 'all') || selectedCompanyId)) ||
                            // Manufacturer: needs company selected 
                            (userRole === 'manufacturer' && ((companyIdForAddress && companyIdForAddress !== 'all') || selectedCompanyId)) ||
                            // Regular users: needs company context
                            (userRole !== 'superadmin' && userRole !== 'manufacturer' && companyData?.companyID);
                        console.log('🔍 CreateShipmentX Form Visibility Debug:', {
                            userRole,
                            companyIdForAddress,
                            selectedCompanyId,
                            companyData: companyData?.companyID,
                            shouldShowForm,
                            'superAdminCondition': userRole === 'superadmin' && ((companyIdForAddress && companyIdForAddress !== 'all') || selectedCompanyId),
                            'manufacturerCondition': userRole === 'manufacturer' && ((companyIdForAddress && companyIdForAddress !== 'all') || selectedCompanyId),
                            'regularUserCondition': userRole !== 'superadmin' && userRole !== 'manufacturer' && companyData?.companyID
                        });
                        return shouldShowForm;
                    })() && (
                            <form autoComplete="off" noValidate onKeyDown={(e) => handleKeyDown(e, 'book')}>
                                {/* Shipment Information */}
                                <Card sx={{ mb: 3, border: '1px solid #e5e7eb', borderRadius: 2 }}>
                                    <CardContent sx={{ p: 3 }}>
                                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px', mb: 3, color: '#374151' }}>
                                            Shipment Information
                                        </Typography>
                                        <Grid container spacing={3}>
                                            {/* Row 1: Shipment Date - Full width */}
                                            <Grid item xs={12}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label="Shipment Date"
                                                    type="date"
                                                    value={shipmentInfo.shipmentDate}
                                                    onChange={(e) => setShipmentInfo(prev => ({ ...prev, shipmentDate: e.target.value }))}
                                                    InputLabelProps={{ shrink: true, sx: { fontSize: '12px' } }}
                                                    autoComplete="off"
                                                    sx={{
                                                        '& .MuiInputBase-input': {
                                                            fontSize: '12px',
                                                            cursor: 'pointer',
                                                            '&::placeholder': { fontSize: '12px' },
                                                            '&::-webkit-calendar-picker-indicator': {
                                                                position: 'absolute',
                                                                left: 0,
                                                                top: 0,
                                                                width: '100%',
                                                                height: '100%',
                                                                padding: 0,
                                                                margin: 0,
                                                                cursor: 'pointer',
                                                                opacity: 0
                                                            }
                                                        },
                                                        '& .MuiInputBase-root': {
                                                            cursor: 'pointer'
                                                        }
                                                    }}
                                                />
                                            </Grid>

                                            {/* Row 2: Shipment Type, Service Level, and Bill Type */}
                                            <Grid item xs={12} md={4}>
                                                <Autocomplete
                                                    size="small"
                                                    options={[
                                                        { value: 'courier', label: 'Courier' },
                                                        { value: 'freight', label: 'Freight' }
                                                    ]}
                                                    getOptionLabel={(option) => option.label}
                                                    value={{ value: shipmentInfo.shipmentType, label: shipmentInfo.shipmentType === 'courier' ? 'Courier' : 'Freight' }}
                                                    onChange={(event, newValue) => {
                                                        setShipmentInfo(prev => ({ ...prev, shipmentType: newValue ? newValue.value : 'freight' }));
                                                    }}
                                                    isOptionEqualToValue={(option, value) => option.value === value.value}
                                                    renderInput={(params) => (
                                                        <TextField
                                                            {...params}
                                                            label="Shipment Type"
                                                            tabIndex={10}
                                                            sx={{
                                                                '& .MuiInputBase-root': { fontSize: '12px' },
                                                                '& .MuiInputLabel-root': { fontSize: '12px' }
                                                            }}
                                                        />
                                                    )}
                                                    sx={{
                                                        '& .MuiAutocomplete-input': { fontSize: '12px' }
                                                    }}
                                                />
                                            </Grid>
                                            <Grid item xs={12} md={4}>
                                                <Autocomplete
                                                    size="small"
                                                    options={[
                                                        { code: 'any', label: 'Any', type: 'any', description: 'Any available service level' },
                                                        ...availableServiceLevels
                                                    ]}
                                                    getOptionLabel={(option) => option.label || option.code}
                                                    value={[
                                                        { code: 'any', label: 'Any', type: 'any', description: 'Any available service level' },
                                                        ...availableServiceLevels
                                                    ].find(level => level.code === shipmentInfo.serviceLevel) || { code: 'any', label: 'Any', type: 'any', description: 'Any available service level' }}
                                                    onChange={(event, newValue) => {
                                                        setShipmentInfo(prev => ({ ...prev, serviceLevel: newValue ? newValue.code : 'any' }));
                                                    }}
                                                    isOptionEqualToValue={(option, value) => option.code === value.code}
                                                    loading={loadingServiceLevels}
                                                    renderInput={(params) => (
                                                        <TextField
                                                            {...params}
                                                            label="Service Level"
                                                            tabIndex={11}
                                                            sx={{
                                                                '& .MuiInputBase-root': { fontSize: '12px' },
                                                                '& .MuiInputLabel-root': { fontSize: '12px' }
                                                            }}
                                                            InputProps={{
                                                                ...params.InputProps,
                                                                endAdornment: (
                                                                    <>
                                                                        {loadingServiceLevels ? <CircularProgress color="inherit" size={20} /> : null}
                                                                        {params.InputProps.endAdornment}
                                                                    </>
                                                                ),
                                                            }}
                                                        />
                                                    )}
                                                    renderOption={(props, option) => (
                                                        <Box component="li" {...props} sx={{ p: 1.5 }}>
                                                            <Box>
                                                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                    {option.label}
                                                                </Typography>
                                                                {option.description && (
                                                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                        {option.description}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        </Box>
                                                    )}
                                                    sx={{
                                                        '& .MuiAutocomplete-input': { fontSize: '12px' }
                                                    }}
                                                />
                                            </Grid>
                                            {/* Bill Type - only show if user has permission */}
                                            {hasPermission(userRole, PERMISSIONS.VIEW_BILL_TYPE) && (
                                                <Grid item xs={12} md={4}>
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
                                            )}





                                            {/* Row 4: Reference Number with inline + button, ETA1, and ETA2 in the same row */}
                                            <Grid item xs={12} md={4}>
                                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                    {/* Primary Reference Number with Add Button */}
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <TextField
                                                            fullWidth
                                                            size="small"
                                                            label="Primary Reference Number"
                                                            value={shipmentInfo.shipperReferenceNumber}
                                                            onChange={(e) => setShipmentInfo(prev => ({ ...prev, shipperReferenceNumber: e.target.value }))}
                                                            autoComplete="off"
                                                            sx={{
                                                                '& .MuiInputBase-input': {
                                                                    fontSize: '12px',
                                                                    '&::placeholder': { fontSize: '12px' }
                                                                },
                                                                '& .MuiInputLabel-root': { fontSize: '12px' }
                                                            }}
                                                            InputProps={{
                                                                endAdornment: shipmentInfo.shipperReferenceNumber && (
                                                                    <InputAdornment position="end">
                                                                        <Tooltip title="Copy Reference Number">
                                                                            <IconButton
                                                                                onClick={async () => {
                                                                                    try {
                                                                                        await navigator.clipboard.writeText(shipmentInfo.shipperReferenceNumber);
                                                                                        showMessage('Reference number copied to clipboard!', 'success');
                                                                                    } catch (error) {
                                                                                        console.error('Failed to copy reference number:', error);
                                                                                        showMessage('Failed to copy reference number', 'error');
                                                                                    }
                                                                                }}
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
                                                        />
                                                        <Tooltip title="Add Reference">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => {
                                                                    setShipmentInfo(prev => ({
                                                                        ...prev,
                                                                        referenceNumbers: [
                                                                            ...(prev.referenceNumbers || []),
                                                                            { id: Date.now(), value: '' }
                                                                        ]
                                                                    }));
                                                                }}
                                                                sx={{
                                                                    color: '#4caf50',
                                                                    '&:hover': {
                                                                        backgroundColor: '#e8f5e8',
                                                                        color: '#2e7d32',
                                                                    },
                                                                    minWidth: 'auto',
                                                                    width: 32,
                                                                    height: 32,
                                                                }}
                                                            >
                                                                <AddIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>

                                                    {/* Additional Reference Numbers - Stacked Vertically */}
                                                    {shipmentInfo.referenceNumbers?.map((ref, index) => (
                                                        <Box key={ref.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <TextField
                                                                fullWidth
                                                                size="small"
                                                                label={`Reference ${index + 2}`}
                                                                value={ref.value}
                                                                onChange={(e) => {
                                                                    const newRefs = [...shipmentInfo.referenceNumbers];
                                                                    newRefs[index] = { ...ref, value: e.target.value };
                                                                    setShipmentInfo(prev => ({ ...prev, referenceNumbers: newRefs }));
                                                                }}
                                                                autoComplete="off"
                                                                sx={{
                                                                    '& .MuiInputBase-input': {
                                                                        fontSize: '12px',
                                                                        '&::placeholder': { fontSize: '12px' }
                                                                    },
                                                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                                                }}
                                                                InputProps={{
                                                                    endAdornment: ref.value && (
                                                                        <InputAdornment position="end">
                                                                            <Tooltip title="Copy Reference Number">
                                                                                <IconButton
                                                                                    onClick={async () => {
                                                                                        try {
                                                                                            await navigator.clipboard.writeText(ref.value);
                                                                                            showMessage('Reference number copied to clipboard!', 'success');
                                                                                        } catch (error) {
                                                                                            console.error('Failed to copy reference number:', error);
                                                                                            showMessage('Failed to copy reference number', 'error');
                                                                                        }
                                                                                    }}
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
                                                            />
                                                            <Tooltip title="Remove Reference">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => {
                                                                        setShipmentInfo(prev => ({
                                                                            ...prev,
                                                                            referenceNumbers: prev.referenceNumbers.filter((_, i) => i !== index)
                                                                        }));
                                                                    }}
                                                                    sx={{
                                                                        color: '#ef4444',
                                                                        '&:hover': {
                                                                            backgroundColor: '#fee2e2',
                                                                            color: '#dc2626'
                                                                        },
                                                                        minWidth: 'auto',
                                                                        width: 32,
                                                                        height: 32,
                                                                    }}
                                                                >
                                                                    <DeleteIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </Box>
                                                    ))}
                                                </Box>
                                            </Grid>
                                            {/* ETA1 and ETA2 fields - only show if user has permission */}
                                            {hasPermission(userRole, PERMISSIONS.VIEW_ETA_FIELDS) && (
                                                <>
                                                    <Grid item xs={12} md={4}>
                                                        <TextField
                                                            fullWidth
                                                            size="small"
                                                            label="ETA 1"
                                                            type="date"
                                                            value={shipmentInfo.eta1 || ''}
                                                            onChange={(e) => setShipmentInfo(prev => ({ ...prev, eta1: e.target.value }))}
                                                            autoComplete="off"
                                                            sx={{
                                                                '& .MuiInputBase-input': {
                                                                    fontSize: '12px',
                                                                    cursor: 'pointer',
                                                                    '&::placeholder': { fontSize: '12px' },
                                                                    '&::-webkit-calendar-picker-indicator': {
                                                                        position: 'absolute',
                                                                        left: 0,
                                                                        top: 0,
                                                                        width: '100%',
                                                                        height: '100%',
                                                                        padding: 0,
                                                                        margin: 0,
                                                                        cursor: 'pointer',
                                                                        opacity: 0
                                                                    }
                                                                },
                                                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                                                '& .MuiInputBase-root': {
                                                                    cursor: 'pointer'
                                                                }
                                                            }}
                                                            InputLabelProps={{
                                                                shrink: true,
                                                                sx: { fontSize: '12px' }
                                                            }}
                                                        />
                                                    </Grid>
                                                    <Grid item xs={12} md={4}>
                                                        <TextField
                                                            fullWidth
                                                            size="small"
                                                            label="ETA 2"
                                                            type="date"
                                                            value={shipmentInfo.eta2 || ''}
                                                            onChange={(e) => setShipmentInfo(prev => ({ ...prev, eta2: e.target.value }))}
                                                            autoComplete="off"
                                                            sx={{
                                                                '& .MuiInputBase-input': {
                                                                    fontSize: '12px',
                                                                    cursor: 'pointer',
                                                                    '&::placeholder': { fontSize: '12px' },
                                                                    '&::-webkit-calendar-picker-indicator': {
                                                                        position: 'absolute',
                                                                        left: 0,
                                                                        top: 0,
                                                                        width: '100%',
                                                                        height: '100%',
                                                                        padding: 0,
                                                                        margin: 0,
                                                                        cursor: 'pointer',
                                                                        opacity: 0
                                                                    }
                                                                },
                                                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                                                '& .MuiInputBase-root': {
                                                                    cursor: 'pointer'
                                                                }
                                                            }}
                                                            InputLabelProps={{
                                                                shrink: true,
                                                                sx: { fontSize: '12px' }
                                                            }}
                                                        />
                                                    </Grid>
                                                </>
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
                                                tabIndex={-1}
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
                                                    autoComplete="off"
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
                                            <Box sx={{ mt: 2, p: 2, bgcolor: '#f0f9ff', borderRadius: 1, border: '1px solid #bae6fd', position: 'relative' }}>
                                                {/* Address display grid */}
                                                <Grid container spacing={2}>
                                                    <Grid item xs={12} md={3}>
                                                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#0c4a6e', mb: 1 }}>
                                                            Company & Contact
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '12px', mb: 0.5, color: '#0ea5e9', fontWeight: 600 }}>
                                                            {shipFromAddress.companyName}
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#075985' }}>
                                                            {shipFromAddress.firstName} {shipFromAddress.lastName}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={12} md={3}>
                                                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#0c4a6e', mb: 1 }}>
                                                            Street Address
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '12px', mb: 0.5, color: '#075985' }}>
                                                            {shipFromAddress.street}
                                                        </Typography>
                                                        {shipFromAddress.street2 && (
                                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#075985' }}>
                                                                {shipFromAddress.street2}
                                                            </Typography>
                                                        )}
                                                    </Grid>
                                                    <Grid item xs={12} md={3}>
                                                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#0c4a6e', mb: 1 }}>
                                                            Location
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '12px', mb: 0.5, color: '#075985' }}>
                                                            {shipFromAddress.city}, {shipFromAddress.state}
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#075985' }}>
                                                            {shipFromAddress.postalCode}, {shipFromAddress.country}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={12} md={3}>
                                                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#0c4a6e', mb: 1 }}>
                                                            Contact Information
                                                        </Typography>
                                                        {shipFromAddress.email && (
                                                            <Typography variant="body2" sx={{ fontSize: '12px', mb: 0.5, color: '#075985' }}>
                                                                📧 {shipFromAddress.email}
                                                            </Typography>
                                                        )}
                                                        {shipFromAddress.phone && (
                                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#075985' }}>
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

                                                {/* Instructions section */}
                                                {shipFromAddress.specialInstructions && (
                                                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #bae6fd' }}>
                                                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#0c4a6e', mb: 0.5 }}>
                                                            Special Instructions
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#075985' }}>
                                                            {shipFromAddress.specialInstructions}
                                                        </Typography>
                                                    </Box>
                                                )}

                                                {/* Action buttons */}
                                                <Box sx={{
                                                    position: 'absolute',
                                                    top: 8,
                                                    right: 8,
                                                    display: 'flex',
                                                    gap: 1
                                                }}>
                                                    {/* Edit button - FIRST */}
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleOpenEditAddress('from')}
                                                        sx={{
                                                            bgcolor: 'rgba(255, 255, 255, 0.95)',
                                                            border: '1px solid #bae6fd',
                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                                            '&:hover': {
                                                                bgcolor: 'white',
                                                                borderColor: '#0ea5e9',
                                                                boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
                                                            },
                                                            width: 28,
                                                            height: 28
                                                        }}
                                                    >
                                                        <EditIcon sx={{ fontSize: 14, color: '#0ea5e9' }} />
                                                    </IconButton>

                                                    {/* Change Address Button */}
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => {
                                                            console.log('Change Ship From address clicked');
                                                            setShipFromAddress(null);
                                                        }}
                                                        sx={{
                                                            bgcolor: 'rgba(255, 255, 255, 0.95)',
                                                            border: '1px solid #bae6fd',
                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                                            '&:hover': {
                                                                bgcolor: 'white',
                                                                borderColor: '#f59e0b',
                                                                boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
                                                            },
                                                            width: 28,
                                                            height: 28
                                                        }}
                                                    >
                                                        <SwapHorizIcon sx={{ fontSize: 14, color: '#f59e0b' }} />
                                                    </IconButton>
                                                </Box>

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
                                                tabIndex={-1}
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
                                                    autoComplete="off"
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
                                            <Box sx={{ mt: 2, p: 2, bgcolor: '#f0f9ff', borderRadius: 1, border: '1px solid #bae6fd', position: 'relative' }}>
                                                <Grid container spacing={2}>
                                                    <Grid item xs={12} md={3}>
                                                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#0c4a6e', mb: 1 }}>
                                                            Company & Contact
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '12px', mb: 0.5, color: '#0ea5e9', fontWeight: 600 }}>
                                                            {shipToAddress.companyName}
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#075985' }}>
                                                            {shipToAddress.firstName} {shipToAddress.lastName}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={12} md={3}>
                                                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#0c4a6e', mb: 1 }}>
                                                            Street Address
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '12px', mb: 0.5, color: '#075985' }}>
                                                            {shipToAddress.street}
                                                        </Typography>
                                                        {shipToAddress.street2 && (
                                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#075985' }}>
                                                                {shipToAddress.street2}
                                                            </Typography>
                                                        )}
                                                    </Grid>
                                                    <Grid item xs={12} md={3}>
                                                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#0c4a6e', mb: 1 }}>
                                                            Location
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '12px', mb: 0.5, color: '#075985' }}>
                                                            {shipToAddress.city}, {shipToAddress.state}
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#075985' }}>
                                                            {shipToAddress.postalCode}, {shipToAddress.country}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={12} md={3}>
                                                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#0c4a6e', mb: 1 }}>
                                                            Contact Information
                                                        </Typography>
                                                        {shipToAddress.email && (
                                                            <Typography variant="body2" sx={{ fontSize: '12px', mb: 0.5, color: '#075985' }}>
                                                                📧 {shipToAddress.email}
                                                            </Typography>
                                                        )}
                                                        {shipToAddress.phone && (
                                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#075985' }}>
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

                                                {/* Instructions section */}
                                                {shipToAddress.specialInstructions && (
                                                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #bae6fd' }}>
                                                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#0c4a6e', mb: 0.5 }}>
                                                            Special Instructions
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#075985' }}>
                                                            {shipToAddress.specialInstructions}
                                                        </Typography>
                                                    </Box>
                                                )}

                                                {/* Action buttons */}
                                                <Box sx={{
                                                    position: 'absolute',
                                                    top: 8,
                                                    right: 8,
                                                    display: 'flex',
                                                    gap: 1
                                                }}>
                                                    {/* Edit button - FIRST */}
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleOpenEditAddress('to')}
                                                        sx={{
                                                            bgcolor: 'rgba(255, 255, 255, 0.95)',
                                                            border: '1px solid #bae6fd',
                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                                            '&:hover': {
                                                                bgcolor: 'white',
                                                                borderColor: '#0ea5e9',
                                                                boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
                                                            },
                                                            width: 28,
                                                            height: 28
                                                        }}
                                                    >
                                                        <EditIcon sx={{ fontSize: 14, color: '#0ea5e9' }} />
                                                    </IconButton>

                                                    {/* Change Address Button */}
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => {
                                                            console.log('Change Ship To address clicked');
                                                            setShipToAddress(null);
                                                        }}
                                                        sx={{
                                                            bgcolor: 'rgba(255, 255, 255, 0.95)',
                                                            border: '1px solid #bae6fd',
                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                                            '&:hover': {
                                                                bgcolor: 'white',
                                                                borderColor: '#f59e0b',
                                                                boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
                                                            },
                                                            width: 28,
                                                            height: 28
                                                        }}
                                                    >
                                                        <SwapHorizIcon sx={{ fontSize: 14, color: '#f59e0b' }} />
                                                    </IconButton>
                                                </Box>

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
                                                tabIndex={-1}
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
                                                            autoComplete="off"
                                                            tabIndex={getPackageBaseTabIndex(index) + 1}
                                                            onKeyDown={(e) => handleKeyDown(e, 'navigate')}
                                                            placeholder="e.g., Electronic equipment, Medical supplies"
                                                            sx={{
                                                                '& .MuiInputBase-root': { fontSize: '12px' },
                                                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                                                '& .MuiFormHelperText-root': { fontSize: '11px' }
                                                            }}
                                                        />
                                                    </Grid>

                                                    {/* Packaging Type */}
                                                    <Grid item xs={12} md={4}>
                                                        <Autocomplete
                                                            size="small"
                                                            options={PACKAGING_TYPES}
                                                            getOptionLabel={(option) => option.label}
                                                            value={PACKAGING_TYPES.find(type => type.value === pkg.packagingType) || PACKAGING_TYPES.find(type => type.value === 262)}
                                                            onChange={(event, newValue) => {
                                                                updatePackage(pkg.id, 'packagingType', newValue ? newValue.value : 262);
                                                            }}
                                                            isOptionEqualToValue={(option, value) => option.value === value.value}
                                                            renderInput={(params) => (
                                                                <TextField
                                                                    {...params}
                                                                    label="Packaging Type"
                                                                    required
                                                                    sx={{
                                                                        '& .MuiInputBase-root': { fontSize: '12px' },
                                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                                    }}
                                                                />
                                                            )}
                                                            renderOption={(props, option) => (
                                                                <Box component="li" {...props} sx={{ fontSize: '12px' }}>
                                                                    {option.label}
                                                                </Box>
                                                            )}
                                                            sx={{
                                                                '& .MuiAutocomplete-input': { fontSize: '12px' },
                                                                '& .MuiAutocomplete-option': { fontSize: '12px' }
                                                            }}
                                                        />
                                                    </Grid>

                                                    <Grid item xs={12} md={3}>
                                                        <TextField
                                                            fullWidth
                                                            size="small"
                                                            label="Qty"
                                                            type="number"
                                                            value={pkg.packagingQuantity || 1}
                                                            onChange={(e) => {
                                                                const value = e.target.value;
                                                                // Allow empty value during typing
                                                                if (value === '') {
                                                                    updatePackage(pkg.id, 'packagingQuantity', '');
                                                                } else {
                                                                    const numValue = parseInt(value);
                                                                    if (!isNaN(numValue) && numValue > 0) {
                                                                        updatePackage(pkg.id, 'packagingQuantity', numValue);
                                                                    }
                                                                }
                                                            }}
                                                            onBlur={(e) => {
                                                                // On blur, ensure we have at least 1
                                                                const value = parseInt(e.target.value) || 1;
                                                                updatePackage(pkg.id, 'packagingQuantity', Math.max(1, value));
                                                            }}
                                                            required
                                                            autoComplete="off"
                                                            inputProps={{ min: 1, max: 999, step: 1 }}
                                                            sx={{
                                                                '& .MuiInputBase-root': { fontSize: '12px' },
                                                                '& .MuiInputLabel-root': { fontSize: '12px' }
                                                            }}
                                                        />
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
                                                            autoComplete="off"
                                                            tabIndex={getPackageBaseTabIndex(index) + 2}
                                                            onKeyDown={(e) => handleKeyDown(e, 'navigate')}
                                                            inputProps={{ min: 0.1, step: 0.1 }}
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
                                                            autoComplete="off"
                                                            tabIndex={getPackageBaseTabIndex(index) + 3}
                                                            onKeyDown={(e) => handleKeyDown(e, 'navigate')}
                                                            inputProps={{ min: 1, step: 0.1 }}
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
                                                            autoComplete="off"
                                                            tabIndex={getPackageBaseTabIndex(index) + 4}
                                                            onKeyDown={(e) => handleKeyDown(e, 'navigate')}
                                                            inputProps={{ min: 1, step: 0.1 }}
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
                                                            autoComplete="off"
                                                            tabIndex={getPackageBaseTabIndex(index) + 5}
                                                            onKeyDown={(e) => handleKeyDown(e, 'navigate')}
                                                            inputProps={{ min: 1, step: 0.1 }}
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

                                                    {/* Declared Value - only show if user has permission */}
                                                    {hasPermission(userRole, PERMISSIONS.VIEW_DECLARED_VALUE) && (
                                                        <Grid item xs={12} md={3}>
                                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                                <TextField
                                                                    size="small"
                                                                    label="Declared Value"
                                                                    type="number"
                                                                    value={pkg.declaredValue || ''}
                                                                    onChange={(e) => updatePackage(pkg.id, 'declaredValue', e.target.value)}
                                                                    autoComplete="off"
                                                                    tabIndex={getPackageBaseTabIndex(index) + 6}
                                                                    onKeyDown={(e) => handleKeyDown(e, 'navigate')}
                                                                    inputProps={{ min: 0, step: 0.01 }}
                                                                    sx={{
                                                                        flex: 1,
                                                                        '& .MuiInputBase-root': { fontSize: '12px' },
                                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                                    }}
                                                                    placeholder="0.00"
                                                                />
                                                                <Autocomplete
                                                                    size="small"
                                                                    options={[
                                                                        { value: 'CAD', label: 'CAD' },
                                                                        { value: 'USD', label: 'USD' }
                                                                    ]}
                                                                    getOptionLabel={(option) => option.label}
                                                                    value={{ value: pkg.declaredValueCurrency || 'CAD', label: pkg.declaredValueCurrency || 'CAD' }}
                                                                    onChange={(event, newValue) => {
                                                                        updatePackage(pkg.id, 'declaredValueCurrency', newValue ? newValue.value : 'CAD');
                                                                    }}
                                                                    isOptionEqualToValue={(option, value) => option.value === value.value}
                                                                    componentsProps={{
                                                                        popper: {
                                                                            container: document.body
                                                                        }
                                                                    }}
                                                                    slotProps={{
                                                                        paper: {
                                                                            tabIndex: -1
                                                                        }
                                                                    }}
                                                                    renderInput={(params) => (
                                                                        <TextField
                                                                            {...params}
                                                                            tabIndex={getPackageBaseTabIndex(index) + 7}
                                                                            sx={{
                                                                                minWidth: '70px',
                                                                                '& .MuiInputBase-root': { fontSize: '12px', padding: '6px 8px' },
                                                                                '& .MuiInputLabel-root': { fontSize: '12px' }
                                                                            }}
                                                                        />
                                                                    )}
                                                                    renderOption={(props, option) => (
                                                                        <Box component="li" {...props} sx={{ fontSize: '12px' }}>
                                                                            {option.label}
                                                                        </Box>
                                                                    )}
                                                                    sx={{
                                                                        minWidth: '70px',
                                                                        '& .MuiAutocomplete-input': { fontSize: '12px' },
                                                                        '& .MuiAutocomplete-option': { fontSize: '12px' }
                                                                    }}
                                                                />
                                                            </Box>
                                                        </Grid>
                                                    )}

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

                                                    {/* Freight Class - Only show for freight shipments and if user has permission */}
                                                    {shipmentInfo.shipmentType === 'freight' && hasPermission(userRole, PERMISSIONS.VIEW_FREIGHT_CLASS) && (
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
                                                                    MenuProps={{
                                                                        PaperProps: {
                                                                            sx: {
                                                                                '& .MuiMenuItem-root': {
                                                                                    fontSize: '12px'
                                                                                }
                                                                            }
                                                                        }
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

                                {/* Additional Services Section - Freight and Courier */}
                                {(shipmentInfo.shipmentType === 'freight' || shipmentInfo.shipmentType === 'courier') && (
                                    <Card sx={{ mb: 3, border: '1px solid #e5e7eb', borderRadius: 2 }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <Box
                                                sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    cursor: 'pointer',
                                                    mb: servicesExpanded ? 3 : 0
                                                }}
                                                onClick={() => setServicesExpanded(!servicesExpanded)}
                                            >
                                                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', flex: 1 }}>
                                                    Additional Services
                                                    {additionalServices.length > 0 && (
                                                        <Chip
                                                            label={`${additionalServices.length} selected`}
                                                            size="small"
                                                            sx={{
                                                                ml: 2,
                                                                bgcolor: '#7c3aed',
                                                                color: 'white',
                                                                fontSize: '11px',
                                                                height: '20px'
                                                            }}
                                                        />
                                                    )}
                                                </Typography>
                                                {servicesExpanded ? (
                                                    <ExpandLessIcon sx={{ color: '#666' }} />
                                                ) : (
                                                    <ExpandMoreIcon sx={{ color: '#666' }} />
                                                )}
                                            </Box>

                                            <Collapse in={servicesExpanded}>
                                                {(() => {
                                                    console.log('🔧 Rendering services UI - loadingServices:', loadingServices, 'availableServices:', availableServices);
                                                    return null;
                                                })()}
                                                {loadingServices ? (
                                                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                                                        <CircularProgress sx={{ mr: 2 }} />
                                                        <Typography sx={{ fontSize: '14px', color: '#6b7280' }}>
                                                            Loading additional services...
                                                        </Typography>
                                                    </Box>
                                                ) : availableServices.length === 0 ? (
                                                    <Box sx={{
                                                        p: 4,
                                                        textAlign: 'center',
                                                        bgcolor: '#f9fafb',
                                                        borderRadius: 2,
                                                        border: '1px solid #e5e7eb'
                                                    }}>
                                                        <Typography sx={{ fontSize: '14px', color: '#6b7280', mb: 1 }}>
                                                            No additional services available
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '12px', color: '#9ca3af' }}>
                                                            Additional services can be configured in System Configuration
                                                        </Typography>
                                                    </Box>
                                                ) : (
                                                    <Grid container spacing={2}>
                                                        {availableServices.map((service) => (
                                                            <Grid item xs={12} sm={6} md={4} key={service.id}>
                                                                <Box
                                                                    sx={{
                                                                        p: 2,
                                                                        border: '1px solid #e5e7eb',
                                                                        borderRadius: 2,
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s ease',
                                                                        bgcolor: isServiceSelected(service.id) ? '#f0f9ff' : '#fff',
                                                                        borderColor: isServiceSelected(service.id) ? '#0ea5e9' : '#e5e7eb',
                                                                        '&:hover': {
                                                                            borderColor: '#0ea5e9',
                                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                                                                        }
                                                                    }}
                                                                    onClick={() => handleServiceToggle(service)}
                                                                >
                                                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                                                                        <Checkbox
                                                                            checked={isServiceSelected(service.id)}
                                                                            onChange={(e) => {
                                                                                e.stopPropagation();
                                                                                handleServiceToggle(service);
                                                                            }}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                            }}
                                                                            size="small"
                                                                            sx={{
                                                                                color: '#6b7280',
                                                                                '&.Mui-checked': {
                                                                                    color: '#0ea5e9'
                                                                                },
                                                                                mt: -0.5
                                                                            }}
                                                                        />
                                                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                                                            <Typography sx={{
                                                                                fontSize: '12px',
                                                                                fontWeight: 500,
                                                                                color: '#374151',
                                                                                mb: 0.5,
                                                                                lineHeight: 1.3
                                                                            }}>
                                                                                {service.label}
                                                                            </Typography>
                                                                            {service.description && (
                                                                                <Typography sx={{
                                                                                    fontSize: '11px',
                                                                                    color: '#6b7280',
                                                                                    lineHeight: 1.3,
                                                                                    fontWeight: 400
                                                                                }}>
                                                                                    {service.description}
                                                                                </Typography>
                                                                            )}
                                                                        </Box>
                                                                    </Box>
                                                                </Box>
                                                            </Grid>
                                                        ))}
                                                    </Grid>
                                                )}
                                            </Collapse>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Broker Information Section - Only show for US shipments */}
                                {shouldShowBrokerSection && (
                                    <Card sx={{ mb: 3, border: '1px solid #e5e7eb', borderRadius: 2 }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                                        Broker Information
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    {selectedBroker && (
                                                        <Chip
                                                            label="Selected"
                                                            size="small"
                                                            color="success"
                                                            sx={{ fontSize: '12px' }}
                                                        />
                                                    )}
                                                    <IconButton
                                                        onClick={() => setBrokerExpanded(!brokerExpanded)}
                                                        size="small"
                                                        sx={{ color: '#6b7280' }}
                                                    >
                                                        {brokerExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                    </IconButton>
                                                </Box>
                                            </Box>

                                            <Collapse in={brokerExpanded}>

                                                {/* Broker Selection */}
                                                <Box sx={{
                                                    border: selectedBroker ? '2px solid #4caf50' : '2px solid #e0e0e0',
                                                    borderRadius: 2,
                                                    p: 2,
                                                    mb: 2,
                                                    backgroundColor: selectedBroker ? '#f8fff8' : '#ffffff',
                                                    transition: 'all 0.3s ease'
                                                }}>
                                                    <Box display="flex" alignItems="center" mb={2}>
                                                        <Box sx={{
                                                            width: '24px',
                                                            height: '24px',
                                                            borderRadius: '50%',
                                                            backgroundColor: selectedBroker ? '#4caf50' : '#e0e0e0',
                                                            color: 'white',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            fontSize: '12px',
                                                            fontWeight: 600,
                                                            mr: 1,
                                                            transition: 'all 0.3s ease'
                                                        }}>
                                                            {selectedBroker ? '✓' : 'B'}
                                                        </Box>
                                                        <Typography variant="body2" sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                                            Select Broker (Optional)
                                                        </Typography>
                                                        {selectedBroker && (
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => setSelectedBroker('')}
                                                                sx={{ ml: 'auto' }}
                                                            >
                                                                <ClearIcon sx={{ fontSize: '16px' }} />
                                                            </IconButton>
                                                        )}
                                                    </Box>

                                                    {/* Broker Dropdown */}
                                                    <Autocomplete
                                                        options={companyBrokers}
                                                        getOptionLabel={(option) => option.name || ''}
                                                        value={companyBrokers.find(broker => broker.name === selectedBroker) || null}
                                                        onChange={(event, newValue) => {
                                                            setSelectedBroker(newValue ? newValue.name : '');
                                                        }}
                                                        renderInput={(params) => (
                                                            <TextField
                                                                {...params}
                                                                placeholder={selectedBroker ? "Change broker..." : "Choose a broker..."}
                                                                size="small"
                                                                sx={{
                                                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                                                }}
                                                            />
                                                        )}
                                                        renderOption={(props, option) => (
                                                            <Box component="li" {...props} sx={{ p: 1 }}>
                                                                <Box display="flex" alignItems="center" width="100%">
                                                                    <Box flex={1}>
                                                                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                                            {option.name}
                                                                        </Typography>
                                                                        {(option.reference || option.phone || option.port) && (
                                                                            <Typography variant="caption" sx={{ fontSize: '11px', color: '#666' }}>
                                                                                {[option.reference && `Ref: ${option.reference}`, option.phone && `📞 ${option.phone}`, option.port && `Port: ${option.port}`].filter(Boolean).join(' • ')}
                                                                            </Typography>
                                                                        )}
                                                                    </Box>
                                                                </Box>
                                                            </Box>
                                                        )}
                                                        sx={{ width: '100%' }}
                                                        loading={loadingBrokers}
                                                    />

                                                    {/* Broker Action Buttons */}
                                                    <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                                        {/* Edit Selected Broker Button - Only show when broker is selected */}
                                                        {selectedBroker && (
                                                            <Button
                                                                variant="outlined"
                                                                size="small"
                                                                startIcon={<EditIcon />}
                                                                onClick={() => {
                                                                    const brokerToEdit = companyBrokers.find(b => b.name === selectedBroker);
                                                                    if (brokerToEdit) {
                                                                        handleEditBroker(brokerToEdit);
                                                                    }
                                                                }}
                                                                sx={{
                                                                    fontSize: '12px',
                                                                    borderColor: '#2196f3',
                                                                    color: '#2196f3',
                                                                    '&:hover': {
                                                                        borderColor: '#1976d2',
                                                                        backgroundColor: '#f3f8ff'
                                                                    }
                                                                }}
                                                            >
                                                                Edit Broker
                                                            </Button>
                                                        )}

                                                        {/* Add New Broker Button */}
                                                        <Button
                                                            variant="outlined"
                                                            size="small"
                                                            startIcon={<AddIcon />}
                                                            onClick={handleAddBroker}
                                                            tabIndex={-1}
                                                            sx={{
                                                                fontSize: '12px',
                                                                borderColor: '#e0e0e0',
                                                                color: '#666'
                                                            }}
                                                        >
                                                            Add New Broker
                                                        </Button>
                                                    </Box>
                                                </Box>

                                                {/* Selected Broker Details - Compact Single Row Layout */}
                                                {selectedBroker && (() => {
                                                    const brokerDetails = companyBrokers.find(b => b.name === selectedBroker);
                                                    return brokerDetails ? (
                                                        <Box sx={{
                                                            mt: 2,
                                                            p: 2,
                                                            bgcolor: '#f0f9ff',
                                                            borderRadius: 2,
                                                            border: '1px solid #bae6fd'
                                                        }}>
                                                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#0c4a6e', mb: 1 }}>
                                                                Selected Broker
                                                            </Typography>
                                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
                                                                <Typography variant="caption" sx={{ fontSize: '11px', color: '#075985' }}>
                                                                    <strong>Name:</strong> {brokerDetails.name}
                                                                </Typography>
                                                                {brokerDetails.reference && (
                                                                    <Typography variant="caption" sx={{ fontSize: '11px', color: '#075985' }}>
                                                                        <strong>Reference:</strong> {brokerDetails.reference}
                                                                    </Typography>
                                                                )}
                                                                {brokerDetails.phone && (
                                                                    <Typography variant="caption" sx={{ fontSize: '11px', color: '#075985' }}>
                                                                        <strong>Phone:</strong> {brokerDetails.phone}
                                                                    </Typography>
                                                                )}
                                                                {brokerDetails.port && (
                                                                    <Typography variant="caption" sx={{ fontSize: '11px', color: '#075985' }}>
                                                                        <strong>Port:</strong> {brokerDetails.port}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        </Box>
                                                    ) : null;
                                                })()}

                                                {/* Shipment-level Broker Fields */}
                                                <Box sx={{ mt: 2 }}>
                                                    <Grid container spacing={2}>
                                                        <Grid item xs={12} md={6}>
                                                            <TextField
                                                                fullWidth
                                                                label="Port"
                                                                value={brokerPort}
                                                                onChange={(e) => setBrokerPort(e.target.value)}
                                                                size="small"
                                                                placeholder="Enter port..."
                                                                sx={{
                                                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                                                }}
                                                            />
                                                        </Grid>
                                                        <Grid item xs={12} md={6}>
                                                            <TextField
                                                                fullWidth
                                                                label="Reference"
                                                                value={brokerReference}
                                                                onChange={(e) => setBrokerReference(e.target.value)}
                                                                size="small"
                                                                placeholder="Enter reference..."
                                                                sx={{
                                                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                                                }}
                                                            />
                                                        </Grid>
                                                    </Grid>
                                                </Box>
                                            </Collapse>
                                        </CardContent>
                                    </Card>
                                )}

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

                                                {/* Progressive Loading Indicator - Show when rates are loading but we already have some */}
                                                {isLoadingRates && rates.length > 0 && (
                                                    <Box sx={{
                                                        mb: 2,
                                                        p: 2,
                                                        bgcolor: '#f0f9ff',
                                                        borderRadius: 1,
                                                        border: '1px solid #bae6fd',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 2
                                                    }}>
                                                        <CircularProgress size={20} sx={{ color: '#0ea5e9' }} />
                                                        <Box sx={{ flex: 1 }}>
                                                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#0c4a6e' }}>
                                                                Loading additional rates...
                                                            </Typography>
                                                            <Typography variant="caption" sx={{ fontSize: '11px', color: '#075985' }}>
                                                                {rates.length} rates loaded • {loadingCarriers.length - completedCarriers.length} carriers remaining
                                                                {loadingCarriers.filter(c => c === 'eShip Plus').length > 0 && completedCarriers.filter(c => c.name === 'eShip Plus').length === 0 && (
                                                                    <span style={{ fontWeight: 600 }}> • eShip Plus starting up...</span>
                                                                )}
                                                            </Typography>
                                                        </Box>
                                                    </Box>
                                                )}

                                                {/* Rate status message */}
                                                {!canFetchRates() && (
                                                    <Box sx={{ p: 2, bgcolor: '#f8fafc', borderRadius: 1, mb: 2 }}>
                                                        <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                                            Complete shipment details to get rates
                                                        </Typography>
                                                    </Box>
                                                )}

                                                {/* Initial Loading State - Only show when no rates are available yet */}
                                                {isLoadingRates && rates.length === 0 && (
                                                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                                                        <CarrierLoadingDisplay
                                                            loadingCarriers={loadingCarriers}
                                                            completedCarriers={completedCarriers}
                                                            failedCarriers={failedCarriers}
                                                            isLoading={isLoadingRates}
                                                        />
                                                    </Box>
                                                )}

                                                {/* Error State - Only show if no rates available */}
                                                {ratesError && rates.length === 0 && (
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

                                                {/* Rates Display - Show whenever we have rates, even during loading */}
                                                {rates.length > 0 && (
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
                                                                        <option value="any">ANY</option>
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
                                                                            {isLoadingRates && (
                                                                                <span style={{ color: '#0ea5e9', fontWeight: 500 }}> (loading...)</span>
                                                                            )}
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
                                                                        userRole={userRole}
                                                                    />
                                                                </Grid>
                                                            ))}
                                                        </Grid>
                                                    </Box>
                                                )}

                                                {/* No rates message - Only show when completely done loading and no rates */}
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
                                                Total: {selectedRate ? (hasPermission(userRole, PERMISSIONS.VIEW_RATE_PRICING) ? `$${(selectedRate.pricing?.total || selectedRate.totalCharges || selectedRate.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Rate Available') : '$0.00'}
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                {selectedRate ? 'Selected Rate Total' : 'No Rate Selected'}
                                            </Typography>
                                        </Box>

                                        {/* Right side - Conversion button and action buttons */}
                                        <Box sx={{ textAlign: 'right' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
                                                {/* Convert to QuickShip button - only show if user has QuickShip permission */}
                                                {hasPermission(userRole, PERMISSIONS.USE_QUICKSHIP) && (
                                                    <Button
                                                        variant="outlined"
                                                        startIcon={<FlashOnIcon />}
                                                        onClick={handleConvertToQuickShip}
                                                        disabled={isConverting || isBooking || isSavingDraft}
                                                        sx={{
                                                            fontSize: '12px',
                                                            textTransform: 'none',
                                                            minWidth: 140,
                                                            borderColor: '#d1d5db',
                                                            color: '#374151',
                                                            '&:hover': {
                                                                borderColor: '#9ca3af',
                                                                backgroundColor: '#f9fafb'
                                                            }
                                                        }}
                                                    >
                                                        {isConverting ? 'Converting...' : 'Convert to QuickShip'}
                                                    </Button>
                                                )}
                                                <Box sx={{ display: 'flex', gap: 2 }}>
                                                    <Button
                                                        variant="outlined"
                                                        startIcon={<SaveIcon />}
                                                        onClick={handleSaveAsDraft}
                                                        disabled={isSavingDraft}
                                                        tabIndex={900}
                                                        onKeyDown={(e) => handleKeyDown(e, 'draft')}
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
                                                        tabIndex={901}
                                                        onKeyDown={(e) => handleKeyDown(e, 'book')}
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
                            </form>
                        )}
                </Box>
            )}

            {/* Simple Conversion Confirmation Dialog */}
            <Dialog
                open={showConversionDialog}
                onClose={() => setShowConversionDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{
                    textAlign: 'center',
                    fontWeight: 600,
                    fontSize: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1
                }}>
                    <FlashOnIcon sx={{ color: '#f59e0b' }} />
                    Convert to QuickShip
                </DialogTitle>
                <DialogContent sx={{ textAlign: 'center', py: 3 }}>
                    <Typography variant="body1" sx={{ mb: 3, fontSize: '14px' }}>
                        Switch to manual rate entry for faster processing.
                    </Typography>

                    <Box sx={{ mb: 3, p: 2, bgcolor: '#fff3cd', borderRadius: 1, border: '1px solid #ffeaa7' }}>
                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500, color: '#856404' }}>
                            ⚠️ Note: Some data may not transfer perfectly between formats.
                        </Typography>
                    </Box>

                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Your shipment details will be preserved and you can convert back anytime before booking.
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'center', gap: 2, pb: 3 }}>
                    <Button
                        onClick={() => setShowConversionDialog(false)}
                        variant="outlined"
                        size="large"
                        sx={{ minWidth: 120, fontSize: '14px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={confirmConvertToQuickShip}
                        variant="contained"
                        size="large"
                        sx={{
                            minWidth: 120,
                            bgcolor: '#f59e0b',
                            fontSize: '14px',
                            '&:hover': {
                                bgcolor: '#d97706'
                            }
                        }}
                        startIcon={<FlashOnIcon />}
                    >
                        Convert Now
                    </Button>
                </DialogActions>
            </Dialog>



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
            <Suspense fallback={<div>Loading...</div>}>
                <AddressFormDialog
                    open={currentView === 'addaddress'}
                    onClose={handleBackToCreateShipment}
                    onSuccess={handleAddressCreated}
                    addressType={addressEditMode}
                    companyId={companyIdForAddress}
                    customerId={selectedCustomer?.customerID || selectedCustomer?.id}
                />
            </Suspense>

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

            {/* Address Edit Dialog */}
            <Suspense fallback={<CircularProgress />}>
                <AddressFormDialog
                    open={showAddressDialog}
                    onClose={() => setShowAddressDialog(false)}
                    onSuccess={handleAddressUpdated}
                    editingAddress={editingAddressData}
                    addressType={editingAddressType}
                    companyId={user?.companyId}
                    customerId={selectedCustomer?.customerID || selectedCustomer?.id}
                />
            </Suspense>

            {/* Broker Dialog */}
            <Suspense fallback={<CircularProgress />}>
                <QuickShipBrokerDialog
                    open={showBrokerDialog}
                    onClose={() => {
                        setShowBrokerDialog(false);
                        setEditingBroker(null);
                        setBrokerSuccessMessage('');
                    }}
                    onSuccess={handleBrokerSuccess}
                    editingBroker={editingBroker}
                    existingBrokers={companyBrokers}
                    companyId={selectedCompanyId || companyIdForAddress}
                />
            </Suspense>

            {/* Broker Success Message */}
            {brokerSuccessMessage && (
                <Snackbar
                    open={!!brokerSuccessMessage}
                    autoHideDuration={4000}
                    onClose={() => setBrokerSuccessMessage('')}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
                >
                    <Alert
                        onClose={() => setBrokerSuccessMessage('')}
                        severity="success"
                        sx={{ width: '100%' }}
                    >
                        {brokerSuccessMessage}
                    </Alert>
                </Snackbar>
            )}
        </Box>
    );
};

export default CreateShipmentX;

