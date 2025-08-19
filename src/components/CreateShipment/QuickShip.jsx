import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
import rateDataManager from '../../utils/rateDataManager';
import {
    Box,
    Typography,
    Paper,
    Grid,
    Card,
    CardContent,
    TextField,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Chip,
    Alert,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControlLabel,
    Checkbox,
    InputAdornment,
    Tooltip,
    Autocomplete,
    Switch,
    FormHelperText,
    AlertTitle,
    Snackbar,
    Avatar,
    Collapse
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    LocalShipping as LocalShippingIcon,
    FlashOn as FlashOnIcon,
    CheckCircle as CheckCircleIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    SwapHoriz as SwapHorizIcon,
    Edit as EditIcon,
    Clear as ClearIcon,
    Person as PersonIcon,
    Phone as PhoneIcon,
    Email as EmailIcon,
    LocationOn as LocationOnIcon,
    Flag as FlagIcon,
    Map as MapIcon,
    Save as SaveIcon,
    TrendingUp as TrendingUpIcon,
    RateReview as ReviewIcon
} from '@mui/icons-material';
import { useShipmentForm } from '../../contexts/ShipmentFormContext';
import { useCompany } from '../../contexts/CompanyContext';
import { getAvailableServiceLevels, getAvailableAdditionalServices, getCompanyAdditionalServices } from '../../utils/serviceLevelUtils';
import { useAuth } from '../../contexts/AuthContext';
import { hasPermission, PERMISSIONS } from '../../utils/rolePermissions';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, setDoc, increment, limit, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { getStateOptions, getStateLabel } from '../../utils/stateUtils';
import { generateShipmentId } from '../../utils/shipmentIdGenerator';
import { getLightBackgroundLogo } from '../../utils/logoUtils';
import ModalHeader from '../common/ModalHeader';
import AddressForm from '../AddressBook/AddressForm';
import CompanySelector from '../common/CompanySelector';
import EmailSelectorDropdown from '../common/EmailSelectorDropdown';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { shipmentConverter } from '../../utils/shipmentConversion';
import { convertDraftInDatabase } from '../../utils/draftConversion';
import shipmentChargeTypeService from '../../services/shipmentChargeTypeService';
import { validateManualRates, getAutoPopulatedChargeName } from '../../utils/shipmentValidation';
import { migrateShipmentChargeCodes } from '../../utils/chargeTypeCompatibility';
import { recalculateShipmentTaxes, updateRateAndRecalculateTaxes, addRateAndRecalculateTaxes, removeRateAndRecalculateTaxes } from '../../utils/taxCalculator';
import { isCanadianDomesticShipment, isTaxCharge } from '../../services/canadianTaxService';


// Lazy load other components
const QuickShipCarrierDialog = lazy(() => import('./QuickShipCarrierDialog'));
const QuickShipBrokerDialog = lazy(() => import('./QuickShipBrokerDialog'));
const AddressFormDialog = lazy(() => import('../AddressBook/AddressFormDialog'));
const AddressBook = lazy(() => import('../AddressBook/AddressBook'));

// Packaging types for freight shipments (from regular Packages component)
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

// Rate code options for manual entry
const RATE_CODE_OPTIONS = [
    { value: 'FRT', label: 'FRT', description: 'Freight' },
    { value: 'ACC', label: 'ACC', description: 'Accessorial' },
    { value: 'FUE', label: 'FUE', description: 'Fuel Surcharge' },
    { value: 'MSC', label: 'MSC', description: 'Miscellaneous' },
    { value: 'LOG', label: 'LOG', description: 'Logistics Service' },
    { value: 'IC LOG', label: 'IC LOG', description: 'Logistics Service' },
    { value: 'SUR', label: 'SUR', description: 'Surcharge' },
    { value: 'IC SUR', label: 'IC SUR', description: 'Surcharge' },
    { value: 'HST', label: 'HST', description: 'Harmonized Sales Tax' },
    { value: 'HST ON', label: 'HST ON', description: 'Harmonized Sales Tax - ON' },
    { value: 'HST BC', label: 'HST BC', description: 'Harmonized Sales Tax - BC' },
    { value: 'HST NB', label: 'HST NB', description: 'Harmonized Sales Tax - NB' },
    { value: 'HST NF', label: 'HST NF', description: 'Harmonized Sales Tax - NF' },
    { value: 'HST NS', label: 'HST NS', description: 'Harmonized Sales Tax - NS' },
    { value: 'GST', label: 'GST', description: 'Goods and Sales Tax' },
    { value: 'QST', label: 'QST', description: 'Quebec Sales Tax' },
    { value: 'HST PE', label: 'HST PE', description: 'Harmonized Sales Tax - PEI' },
    { value: 'GOVT', label: 'GOVT', description: 'Customs Taxes' },
    { value: 'GOVD', label: 'GOVD', description: 'Customs Duty' },
    { value: 'GSTIMP', label: 'GSTIMP', description: 'Customs Taxes' },
    { value: 'CLAIMS', label: 'CLAIMS', description: 'Claims Refund' }
];

// Freight class options (same as Packages.jsx)
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
    },
    {
        class: "175",
        description: "Clothing, couches, stuffed furniture",
        examples: ["Clothing", "Couches", "Stuffed Furniture"],
        weight_range_per_cubic_foot: "5-6 lbs",
        min_weight: 5,
        max_weight: 6
    },
    {
        class: "200",
        description: "Auto sheet metal parts, aircraft parts, aluminum table, packaged mattresses",
        examples: ["Auto Sheet Metal Parts", "Aircraft Parts", "Aluminum Table", "Packaged Mattresses"],
        weight_range_per_cubic_foot: "4-5 lbs",
        min_weight: 4,
        max_weight: 5
    },
    {
        class: "250",
        description: "Bamboo furniture, mattress and box spring, plasma TV",
        examples: ["Bamboo Furniture", "Mattress and Box Spring", "Plasma TV"],
        weight_range_per_cubic_foot: "3-4 lbs",
        min_weight: 3,
        max_weight: 4
    },
    {
        class: "300",
        description: "Wood cabinets, tables, chairs setup, model boats",
        examples: ["Wood Cabinets", "Tables", "Chairs Setup", "Model Boats"],
        weight_range_per_cubic_foot: "2-3 lbs",
        min_weight: 2,
        max_weight: 3
    },
    {
        class: "400",
        description: "Deer antlers",
        examples: ["Deer Antlers"],
        weight_range_per_cubic_foot: "1-2 lbs",
        min_weight: 1,
        max_weight: 2
    },
    {
        class: "500",
        description: "Low Density or High Value",
        examples: ["Bags of Gold Dust", "Ping Pong Balls"],
        weight_range_per_cubic_foot: "Less than 1 lb",
        min_weight: 0,
        max_weight: 1
    }
];

// Comprehensive validation schema for QuickShip
const QUICKSHIP_VALIDATION = {
    shipFrom: {
        required: ['companyName', 'street', 'city', 'state', 'postalCode', 'country'],
        optional: ['contact', 'phone', 'email', 'street2']
    },
    shipTo: {
        required: ['companyName', 'street', 'city', 'state', 'postalCode', 'country'],
        optional: ['contact', 'phone', 'email', 'street2']
    },
    packages: {
        minCount: 1,
        maxCount: 99,
        required: ['itemDescription', 'packagingType', 'packagingQuantity', 'weight', 'length', 'width', 'height'],
        weightLimits: { min: 0.1, max: 30000 }, // lbs
        dimensionLimits: { min: 1, max: 999 } // inches
    },
    rates: {
        minCount: 0, // Allow no rates
        required: [], // No fields are required anymore
        validCodes: ['FRT', 'ACC', 'FUE', 'MSC', 'LOG', 'IC LOG', 'SUR', 'IC SUR', 'HST', 'HST ON', 'HST BC', 'HST NB', 'HST NF', 'HST NS', 'GST', 'QST', 'HST PE', 'GOVT', 'GOVD', 'GSTIMP', 'CLAIMS'] // Match RATE_CODE_OPTIONS
    }
};

// Professional error messages
const ERROR_MESSAGES = {
    MISSING_ADDRESSES: 'Please select both ship from and ship to addresses before booking.',
    MISSING_CARRIER: 'Please select a carrier for your shipment.',
    INVALID_PACKAGES: 'Please ensure all package information is complete and valid.',
    INVALID_RATES: 'Please add at least one rate line item with complete information.',
    WEIGHT_LIMIT: 'Package weight must be between 0.1 and 30,000 lbs.',
    DIMENSION_LIMIT: 'Package dimensions must be between 1 and 999 inches.',
    NETWORK_ERROR: 'Network error occurred. Please check your connection and try again.',
    BOOKING_FAILED: 'Failed to book shipment. Please try again or contact support.',
    DOCUMENT_GENERATION_FAILED: 'Shipment booked successfully but document generation failed. Documents will be sent via email.',
    EMAIL_FAILED: 'Shipment booked successfully but email notification failed. You can download documents from the shipment details.'
};

// Helper functions for safe number parsing to avoid NaN values
const safeParseFloat = (value, fallback = 0) => {
    if (value === null || value === undefined || value === '' || value === 'NaN') return fallback;
    const parsed = parseFloat(value);
    return isNaN(parsed) ? fallback : parsed;
};

const safeParseInt = (value, fallback = 1) => {
    if (value === null || value === undefined || value === '' || value === 'NaN') return fallback;
    const parsed = parseInt(value);
    return isNaN(parsed) ? fallback : parsed;
};

const QuickShip = ({
    onClose,
    onReturnToShipments,
    onViewShipment,
    draftId = null,
    isModal = false,
    editMode = false,
    editShipment = null,
    onShipmentUpdated = null,
    showNotification = null,
    onDraftSaved = null, // New callback for when draft is saved
    onConvertToAdvanced = null, // New callback for conversion
    prePopulatedData = null // New prop for converted data from CreateShipmentX
}) => {
    const { currentUser, userRole } = useAuth();
    const { companyData, companyIdForAddress, setCompanyContext } = useCompany();

    // DEBUG: Log initial values
    console.log('🚀 QuickShip Component Initial Values:', {
        userRole,
        companyIdForAddress,
        currentUser: currentUser?.uid,
        isModal,
        draftId
    });
    const { formData, updateFormSection, clearFormData, setDraftShipmentIdentifiers } = useShipmentForm();

    // Form sections state
    const [shipmentInfo, setShipmentInfo] = useState({
        shipmentType: 'freight',
        shipmentDate: new Date().toISOString().split('T')[0],
        shipperReferenceNumber: '',
        carrierTrackingNumber: '',
        bookingReferenceNumber: '',
        bookingReferenceType: 'PO',
        billType: 'third_party',
        serviceLevel: 'any',
        dangerousGoodsType: 'none',
        signatureServiceType: 'none',
        notes: '',
        // New field for multiple references
        referenceNumbers: [],
        // ETA fields
        eta1: null,
        eta2: null
    });

    // Address state - simplified to use AddressBook
    const [shipFromAddress, setShipFromAddress] = useState(null);
    const [shipToAddress, setShipToAddress] = useState(null);
    const [availableAddresses, setAvailableAddresses] = useState([]);
    const [loadingAddresses, setLoadingAddresses] = useState(false);

    // Address edit dialog state
    const [showAddressDialog, setShowAddressDialog] = useState(false);
    const [editingAddressType, setEditingAddressType] = useState('from'); // 'from' or 'to'
    const [editingAddressData, setEditingAddressData] = useState(null);

    // Quick Ship Carriers state - Enhanced version
    const [quickShipCarriers, setQuickShipCarriers] = useState([]);
    const [selectedCarrier, setSelectedCarrier] = useState('');
    const [selectedCarrierContactId, setSelectedCarrierContactId] = useState('');
    const [showCarrierDialog, setShowCarrierDialog] = useState(false);
    const [editingCarrier, setEditingCarrier] = useState(null);
    const [loadingCarriers, setLoadingCarriers] = useState(false);
    const [carrierSuccessMessage, setCarrierSuccessMessage] = useState('');

    // Company Brokers state
    const [companyBrokers, setCompanyBrokers] = useState([]);
    const [selectedBroker, setSelectedBroker] = useState('');
    const [brokerPort, setBrokerPort] = useState('');
    const [brokerReference, setBrokerReference] = useState('');
    const [showBrokerDialog, setShowBrokerDialog] = useState(false);
    const [editingBroker, setEditingBroker] = useState(null);
    const [loadingBrokers, setLoadingBrokers] = useState(false);
    const [brokerSuccessMessage, setBrokerSuccessMessage] = useState('');
    const [brokerExpanded, setBrokerExpanded] = useState(false);

    // Package state
    const [packages, setPackages] = useState([{
        id: 1,
        packagingType: 262, // Default to SKID(S)
        packagingQuantity: 1,
        itemDescription: '',
        weight: '',
        length: '48', // Standard skid length
        width: '40', // Standard skid width  
        height: '',
        freightClass: '', // Add freight class field
        unitSystem: 'imperial', // Individual package unit system
        declaredValue: '', // Declared value amount
        declaredValueCurrency: 'CAD' // Declared value currency
    }]);

    // Unit system state
    const [unitSystem, setUnitSystem] = useState('imperial');

    // Additional Services state (for freight shipments only)
    const [additionalServices, setAdditionalServices] = useState([]);
    const [availableServices, setAvailableServices] = useState([]);
    const [loadingServices, setLoadingServices] = useState(false);
    const [servicesExpanded, setServicesExpanded] = useState(false);
    const [servicesCategoryFilter, setServicesCategoryFilter] = useState('all');

    // Service Levels state
    const [availableServiceLevels, setAvailableServiceLevels] = useState([]);
    const [loadingServiceLevels, setLoadingServiceLevels] = useState(false);

    // Shipment Type Options (filtered based on available service levels)
    const [availableShipmentTypes, setAvailableShipmentTypes] = useState(['courier', 'freight']);

    // Manual rates state - with default FRT and FUE charges
    const [manualRates, setManualRates] = useState([
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
    ]);

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showBookingDialog, setShowBookingDialog] = useState(false);
    const [bookingStep, setBookingStep] = useState('booking');
    const [showConfirmDialog, setShowConfirmDialog] = useState(false);
    const [isBooking, setIsBooking] = useState(false);
    const [finalShipmentId, setFinalShipmentId] = useState('');
    const [labelGenerationStatus, setLabelGenerationStatus] = useState('');

    // Draft state management
    const [isEditingDraft, setIsEditingDraft] = useState(false);
    const [isDraftLoading, setIsDraftLoading] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [draftSaved, setDraftSaved] = useState(false);

    // Shipment ID state - generate early and reuse
    const [shipmentID, setShipmentID] = useState(null);
    const [activeDraftId, setActiveDraftId] = useState(null); // Track the actual Firestore document ID

    // Sliding navigation state
    const [currentView, setCurrentView] = useState('quickship'); // 'quickship' | 'addaddress'
    const [isSliding, setIsSliding] = useState(false);
    const [addressEditMode, setAddressEditMode] = useState('from'); // 'from' | 'to'

    // Additional state for draft save success
    const [showDraftSuccess, setShowDraftSuccess] = useState(false);

    // Review submission state
    const [isSubmittingForReview, setIsSubmittingForReview] = useState(false);
    const [showReviewDialog, setShowReviewDialog] = useState(false);

    // Error handling improvements
    const errorAlertRef = useRef(null);
    const [showErrorSnackbar, setShowErrorSnackbar] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [showSuccessSnackbar, setShowSuccessSnackbar] = useState(false);
    const mainContentRef = useRef(null);

    // Email notification toggle state
    const [sendEmailNotifications, setSendEmailNotifications] = useState(true);

    // Company selection state for super admins
    const [selectedCompanyId, setSelectedCompanyId] = useState(null);
    const [selectedCompanyData, setSelectedCompanyData] = useState(null);

    // Conversion state
    const [showConversionDialog, setShowConversionDialog] = useState(false);
    const [isConverting, setIsConverting] = useState(false);

    // New comprehensive conversion state


    // Customer selection state for super admins  
    const [availableCustomers, setAvailableCustomers] = useState([]);
    const [selectedCustomerId, setSelectedCustomerId] = useState(null);
    const [loadingCustomers, setLoadingCustomers] = useState(false);

    // Dynamic charge types state
    const [availableChargeTypes, setAvailableChargeTypes] = useState([]);
    const [loadingChargeTypes, setLoadingChargeTypes] = useState(false);
    const [chargeTypesError, setChargeTypesError] = useState(null);
    const [customerManuallyCleared, setCustomerManuallyCleared] = useState(false);

    // Determine if admin needs to select a company (always show for company admins/admins/super admins to allow switching)
    const needsCompanySelection = userRole === 'superadmin' || userRole === 'admin' || userRole === 'user';

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

    // Edit mode detection and handling
    const isEditingExistingShipment = editMode && editShipment && editShipment.status !== 'draft';
    const isEditingShipmentDraft = !editMode && draftId; // Regular draft editing

    console.log('🚀 QuickShip Edit Mode Detection:', {
        editMode,
        hasEditShipment: !!editShipment,
        shipmentStatus: editShipment?.status,
        isEditingExistingShipment,
        isEditingShipmentDraft,
        draftId
    });

    // Function to handle updating an existing shipment - MOVED TO AFTER VALIDATION FUNCTIONS
    // Function to handle cancelling edit changes - MOVED TO AFTER VALIDATION FUNCTIONS

    // Load customers for selected company (super admin)
    const loadCustomersForCompany = useCallback(async (companyId) => {
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

            console.log('🎯 CRITICAL: Loaded customers for company:', companyId, {
                customerCount: customers.length,
                customers: customers.slice(0, 5).map(c => ({
                    docId: c.id,
                    customerID: c.customerID,
                    name: c.name,
                    companyID: c.companyID
                }))
            });

            // Debug: Check customer loading results
            console.log('✅ Customers loaded successfully for company:', companyId, {
                customerCount: customers.length,
                firstCustomer: customers[0]?.companyName || 'N/A'
            });

            setAvailableCustomers(customers);
            // Don't reset customer selection - keep current selection if valid
        } catch (error) {
            console.error('Error loading customers:', error);
            setAvailableCustomers([]);
            // Don't reset customer selection on error
        } finally {
            setLoadingCustomers(false);
        }
    }, []);

    // Track if we've already processed prePopulatedData to prevent re-runs
    const processedPrePopulatedDataRef = useRef(false);

    // Process pre-populated data from CreateShipmentX conversion (MAIN CONVERSION LOGIC)
    useEffect(() => {
        console.log('🔍 CONVERSION EFFECT: useEffect triggered with:', {
            hasPrePopulatedData: !!prePopulatedData,
            draftId,
            isEditingDraft,
            editMode,
            shouldProcess: !!(prePopulatedData && !draftId && !editMode),
            alreadyProcessed: processedPrePopulatedDataRef.current
        });

        if (prePopulatedData && !draftId && !editMode && !processedPrePopulatedDataRef.current) {
            // Mark as processed to prevent re-runs
            processedPrePopulatedDataRef.current = true;
            console.log('🔄 MAIN CONVERSION: Processing converted data from CreateShipmentX:', prePopulatedData);

            try {
                // CRITICAL: Set shipment ID FIRST to prevent new ID generation
                if (prePopulatedData.shipmentID) {
                    console.log('🔄 Setting shipment ID from conversion:', prePopulatedData.shipmentID);
                    setShipmentID(prePopulatedData.shipmentID);
                }

                // Populate shipment info
                if (prePopulatedData.shipmentInfo) {
                    console.log('🔄 Setting shipment info from conversion:', prePopulatedData.shipmentInfo);
                    setShipmentInfo(prev => ({
                        ...prev,
                        ...prePopulatedData.shipmentInfo
                    }));
                }

                // Populate addresses
                if (prePopulatedData.shipFromAddress) {
                    console.log('🔄 Setting ship from address from conversion:', prePopulatedData.shipFromAddress);
                    setShipFromAddress(prePopulatedData.shipFromAddress);
                }

                if (prePopulatedData.shipToAddress) {
                    console.log('🔄 Setting ship to address from conversion:', prePopulatedData.shipToAddress);
                    setShipToAddress(prePopulatedData.shipToAddress);
                }

                // Populate packages
                if (prePopulatedData.packages && prePopulatedData.packages.length > 0) {
                    console.log('🔄 Setting packages from conversion:', prePopulatedData.packages.length, 'packages');
                    setPackages(prePopulatedData.packages);
                }

                // Populate manual rates
                if (prePopulatedData.manualRates && prePopulatedData.manualRates.length > 0) {
                    console.log('🔄 Setting manual rates from conversion:', prePopulatedData.manualRates.length, 'rates');
                    // Format rates to 2 decimal places
                    const formattedRates = prePopulatedData.manualRates.map(rate => ({
                        ...rate,
                        cost: rate.cost ? safeParseFloat(rate.cost, 0).toFixed(2) : '',
                        charge: rate.charge ? safeParseFloat(rate.charge, 0).toFixed(2) : ''
                    }));
                    setManualRates(formattedRates);

                    // Set carrier from first rate
                    const firstRate = prePopulatedData.manualRates[0];
                    if (firstRate && firstRate.carrier) {
                        console.log('🔄 Setting carrier from conversion:', firstRate.carrier);
                        setSelectedCarrier(firstRate.carrier);
                    }
                }

                // Set unit system
                if (prePopulatedData.unitSystem) {
                    console.log('🔄 Setting unit system from conversion:', prePopulatedData.unitSystem);
                    setUnitSystem(prePopulatedData.unitSystem);
                }

                // Set as editing if there's an activeDraftId
                if (prePopulatedData.activeDraftId) {
                    console.log('🔄 Setting active draft ID from conversion:', prePopulatedData.activeDraftId);
                    setIsEditingDraft(true);
                    setActiveDraftId(prePopulatedData.activeDraftId);
                }

                // Store selected customer for later application (after customers are loaded)
                if (prePopulatedData.selectedCustomerId && prePopulatedData.isEditMode) {
                    console.log('🔄 Edit mode: Storing selected customer for later application:', prePopulatedData.selectedCustomerId);
                    // Don't set immediately - wait for customers to load
                }
                // Set selected customer immediately for conversion mode (not edit mode)
                else if (prePopulatedData.selectedCustomerId && !prePopulatedData.isEditMode) {
                    console.log('🔄 Conversion mode: Setting selected customer immediately:', prePopulatedData.selectedCustomerId);
                    setSelectedCustomerId(prePopulatedData.selectedCustomerId);
                }

                console.log('✅ Successfully populated QuickShip with converted data - MAIN CONVERSION COMPLETE');
                showSuccess('Converted to QuickShip format successfully!');

            } catch (error) {
                console.error('❌ Error processing conversion data:', error);
                showError('Error converting to QuickShip format');
            }
        }
    }, [prePopulatedData, draftId, editMode, userRole]);

    // Handle customer selection from prePopulatedData after customers are loaded (Edit Mode)
    useEffect(() => {
        // Only handle edit mode with customer selection requirement
        if (prePopulatedData?.isEditMode && prePopulatedData?.requiresCustomerSelection &&
            prePopulatedData.selectedCustomerId && availableCustomers.length > 0 &&
            !loadingCustomers && selectedCustomerId !== prePopulatedData.selectedCustomerId) {

            console.log('🎯 CRITICAL: Attempting to select customer in QuickShip:', {
                targetCustomerId: prePopulatedData.selectedCustomerId,
                currentSelectedCustomerId: selectedCustomerId,
                availableCustomersCount: availableCustomers.length,
                availableCustomers: availableCustomers.map(c => ({
                    docId: c.id,
                    customerID: c.customerID,
                    name: c.name
                }))
            });

            // Check if the customer exists in the available customers - check both ID fields
            let matchedCustomer = null;
            const customerExists = availableCustomers.some(customer => {
                // Check if the extracted ID matches either the document ID or customerID field
                const matchByDocId = customer.id === prePopulatedData.selectedCustomerId;
                const matchByCustomerId = customer.customerID === prePopulatedData.selectedCustomerId;
                const matches = matchByDocId || matchByCustomerId;

                if (matches) {
                    matchedCustomer = customer;
                    console.log('✅ PrePopulated: Customer found in available customers:', {
                        customerName: customer.name,
                        customerId: customer.id,
                        customerID: customer.customerID,
                        searchingFor: prePopulatedData.selectedCustomerId,
                        matchedBy: matchByDocId ? 'document ID' : 'customerID field'
                    });
                }
                return matches;
            });

            if (customerExists && matchedCustomer) {
                // CRITICAL: Use the document ID for selection, not the customerID field
                const idToSelect = matchedCustomer.id;
                console.log('✅ CRITICAL: Customer found, applying selection:', {
                    extractedCustomerId: prePopulatedData.selectedCustomerId,
                    willSelectId: idToSelect,
                    customerName: matchedCustomer.name,
                    customerID: matchedCustomer.customerID
                });
                const previousValue = selectedCustomerId;
                setSelectedCustomerId(idToSelect);
                console.log('✅ CRITICAL: Called setSelectedCustomerId:', {
                    previousValue,
                    newValue: idToSelect,
                    willTriggerRerender: previousValue !== idToSelect
                });
            } else {
                console.warn('⚠️ CRITICAL: Customer NOT FOUND in available customers:', {
                    targetCustomerId: prePopulatedData.selectedCustomerId,
                    availableCustomers: availableCustomers.map(c => ({
                        docId: c.id,
                        customerID: c.customerID,
                        name: c.name
                    }))
                });
                // Keep 'all' selection if customer not found
            }
        }
    }, [prePopulatedData, availableCustomers, loadingCustomers]);

    // Handle edit shipment data loading with customer extraction
    useEffect(() => {
        if (editMode && editShipment && availableCustomers.length > 0 && !loadingCustomers) {
            console.log('🔧 Edit mode: Checking for customer ID in edit shipment data');

            // Extract customer ID from shipment data
            let extractedCustomerId = editShipment.customerId || editShipment.customerID;

            // Fallback to shipTo address customer data
            if (!extractedCustomerId && editShipment.shipTo) {
                if (editShipment.shipTo.customerID) {
                    extractedCustomerId = editShipment.shipTo.customerID;
                    console.log('🔍 Extracted customer ID from shipTo.customerID:', extractedCustomerId);
                } else if (editShipment.shipTo.addressClass === 'customer' && editShipment.shipTo.addressClassID) {
                    extractedCustomerId = editShipment.shipTo.addressClassID;
                    console.log('🔍 Extracted customer ID from shipTo.addressClassID:', extractedCustomerId);
                }
            }

            if (extractedCustomerId && extractedCustomerId !== selectedCustomerId) {
                // Check if customer exists
                const customerExists = availableCustomers.some(customer =>
                    customer.id === extractedCustomerId ||
                    customer.customerID === extractedCustomerId
                );

                if (customerExists) {
                    console.log('✅ Edit shipment: Setting customer ID:', extractedCustomerId);
                    setSelectedCustomerId(extractedCustomerId);
                } else {
                    console.warn('⚠️ Edit shipment: Customer not found:', extractedCustomerId);

                    // CRITICAL: For admin users, try to load the customer directly
                    if ((userRole === 'admin' || userRole === 'superadmin') && extractedCustomerId) {
                        console.log('🔍 Admin mode: Attempting direct customer lookup for:', extractedCustomerId);

                        // Try to find the customer by document ID first
                        getDoc(doc(db, 'customers', extractedCustomerId))
                            .then(customerDoc => {
                                if (customerDoc.exists()) {
                                    const customerData = { id: customerDoc.id, ...customerDoc.data() };
                                    console.log('✅ Found customer by document ID:', customerData);

                                    // Add to available customers and select
                                    setAvailableCustomers(prev => [...prev, customerData]);
                                    setSelectedCustomerId(extractedCustomerId);
                                } else {
                                    // Try to find by customerID field
                                    const customerQuery = query(
                                        collection(db, 'customers'),
                                        where('customerID', '==', extractedCustomerId),
                                        limit(1)
                                    );

                                    getDocs(customerQuery).then(snapshot => {
                                        if (!snapshot.empty) {
                                            const customerDoc = snapshot.docs[0];
                                            const customerData = { id: customerDoc.id, ...customerDoc.data() };
                                            console.log('✅ Found customer by customerID field:', customerData);

                                            // Add to available customers and select
                                            setAvailableCustomers(prev => [...prev, customerData]);
                                            setSelectedCustomerId(customerDoc.id);
                                        } else {
                                            console.error('❌ Customer not found in database:', extractedCustomerId);
                                        }
                                    });
                                }
                            })
                            .catch(error => {
                                console.error('❌ Error loading customer:', error);
                            });
                    }
                }
            }
        }
    }, [editMode, editShipment, availableCustomers, loadingCustomers, userRole]);

    // Success message handler
    const showSuccess = (message) => {
        setSuccessMessage(message);
        setShowSuccessSnackbar(true);
    };

    // Helper function to clear all dependent state
    const clearDependentState = useCallback(() => {
        // Clear addresses
        setShipFromAddress(null);
        setShipToAddress(null);
        setAvailableAddresses([]);

        // Clear carriers
        setQuickShipCarriers([]);
        setSelectedCarrier('');
        setSelectedCarrierContactId('');

        // Clear form sections
        updateFormSection('shipFrom', {});
        updateFormSection('shipTo', {});

        console.log('🧹 Cleared all dependent state for company switch');
    }, [updateFormSection]);

    // Atomic company context switching for super admins
    const handleCompanySelection = useCallback(async (companyId) => {
        try {
            console.log('🔄 Starting atomic company switch to:', companyId);

            if (!companyId) {
                // Clear everything when no company selected
                setSelectedCompanyId(null);
                setSelectedCompanyData(null);
                clearDependentState();
                return;
            }

            // 1. Fetch company data first
            const companiesQuery = query(
                collection(db, 'companies'),
                where('companyID', '==', companyId),
                limit(1)
            );

            const companiesSnapshot = await getDocs(companiesQuery);

            if (companiesSnapshot.empty) {
                console.warn('⚠️ Company not found:', companyId);
                setError(`⚠️ Warning: Company ${companyId} not found`);
                setTimeout(() => setError(null), 3000);
                return;
            }

            const companyDoc = companiesSnapshot.docs[0];
            const companyDocData = companyDoc.data();
            const targetCompanyData = {
                ...companyDocData,
                id: companyDoc.id
            };

            // 2. Update local state
            setSelectedCompanyId(companyId);
            setSelectedCompanyData(targetCompanyData);

            // 3. Clear dependent state immediately
            clearDependentState();

            // 4. Switch company context atomically
            await setCompanyContext(targetCompanyData);

            // 5. Load new company data
            await loadCustomersForCompany(companyId);

            console.log('✅ Atomic company switch completed:', targetCompanyData.name);
            showSuccess(`Switched to ${targetCompanyData.name || companyId}`);

        } catch (error) {
            console.error('❌ Error in atomic company switch:', error);
            setError('Error switching company context');
            setTimeout(() => setError(null), 3000);
        }
    }, [setCompanyContext, loadCustomersForCompany, showSuccess, clearDependentState]);

    // Scroll to error function
    const scrollToError = () => {
        if (errorAlertRef.current) {
            errorAlertRef.current.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });
        } else if (mainContentRef.current) {
            // Fallback to scrolling to top if error ref not available
            mainContentRef.current.scrollTop = 0;
        }
    };

    // Enhanced error handling with scroll and snackbar
    const showError = (message) => {
        setError(message);
        setShowErrorSnackbar(true);
        // Small delay to ensure DOM is updated before scrolling
        setTimeout(() => {
            scrollToError();
        }, 100);
    };

    // Enhanced conversion functions with better precision
    const lbsToKg = (lbs) => {
        const num = parseFloat(lbs) || 0;
        return (num * 0.453592).toFixed(2);
    };

    const kgToLbs = (kg) => {
        const num = parseFloat(kg) || 0;
        return (num * 2.20462).toFixed(2);
    };

    const inchesToCm = (inches) => {
        const num = parseFloat(inches) || 0;
        return (num * 2.54).toFixed(1);
    };

    const cmToInches = (cm) => {
        const num = parseFloat(cm) || 0;
        return (num / 2.54).toFixed(1);
    };

    // Load Quick Ship Carriers
    const loadQuickShipCarriers = useCallback(async () => {
        if (!companyIdForAddress) return;

        setLoadingCarriers(true);
        try {
            const carriersQuery = query(
                collection(db, 'quickshipCarriers'),
                where('companyID', '==', companyIdForAddress)
            );
            const carriersSnapshot = await getDocs(carriersQuery);
            const carriers = carriersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setQuickShipCarriers(carriers);
        } catch (error) {
            console.error('Error loading quick ship carriers:', error);
        } finally {
            setLoadingCarriers(false);
        }
    }, [companyIdForAddress]);

    // Load Company Brokers
    const loadCompanyBrokers = useCallback(async () => {
        if (!companyIdForAddress) return;

        setLoadingBrokers(true);
        try {
            const brokersQuery = query(
                collection(db, 'companyBrokers'),
                where('companyID', '==', companyIdForAddress),
                where('enabled', '==', true)
            );
            const brokersSnapshot = await getDocs(brokersQuery);
            const brokers = brokersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log('📋 Loaded company brokers:', brokers.length, 'brokers for company:', companyIdForAddress);
            setCompanyBrokers(brokers);
        } catch (error) {
            console.error('Error loading company brokers:', error);
        } finally {
            setLoadingBrokers(false);
        }
    }, [companyIdForAddress]);

    // Generate shipment ID early when component initializes
    useEffect(() => {
        if (editMode && editShipment) return; // <-- PATCH: skip in edit mode

        // CRITICAL: Don't generate new shipment ID if we have prePopulated data (conversion)
        if (prePopulatedData && prePopulatedData.shipmentID) {
            console.log('🔄 Using shipment ID from conversion data:', prePopulatedData.shipmentID);
            setShipmentID(prePopulatedData.shipmentID);
            return;
        }

        const generateInitialShipmentID = async () => {
            // Don't generate if we already have a shipmentID or if we're loading a draft
            if (!companyIdForAddress || shipmentID || draftId) return;

            try {
                const newShipmentID = await generateShipmentId(companyIdForAddress);
                setShipmentID(newShipmentID);
                console.log('Generated initial QuickShip shipmentID:', newShipmentID);
            } catch (error) {
                console.warn('Failed to generate initial shipmentID:', error);
                // Fallback ID generation
                const timestamp = Date.now().toString().slice(-8);
                const randomSuffix = Math.random().toString(36).substr(2, 6).toUpperCase();
                const fallbackID = `${companyIdForAddress}-${randomSuffix}`;
                setShipmentID(fallbackID);
            }
        };

        generateInitialShipmentID();
    }, [companyIdForAddress, draftId, editMode, editShipment, prePopulatedData]); // Add prePopulatedData dependency

    // Create draft in database immediately after shipment ID is generated
    useEffect(() => {
        // Skip entirely if in edit mode - this prevents new drafts from being created when editing existing shipments
        if (editMode && editShipment) {
            console.log('🔄 Edit mode detected - skipping draft creation for existing shipment:', editShipment.id);
            return;
        }

        // CRITICAL: Skip draft creation if we have prePopulated data (conversion) - we want to convert, not create new
        if (prePopulatedData) {
            console.log('🔄 Conversion detected - skipping new draft creation, using conversion data');
            // If we have an activeDraftId from conversion, use it
            if (prePopulatedData.activeDraftId) {
                setActiveDraftId(prePopulatedData.activeDraftId);
                setIsEditingDraft(true);
            }
            return;
        }

        const createInitialDraft = async () => {
            // Only create if we have a shipment ID, we're not editing an existing draft, and we're not loading a draft
            if (!shipmentID || isEditingDraft || draftId || !companyIdForAddress || !currentUser) return;

            try {
                // Check if this shipment already exists in the database by shipmentID field
                const existingShipmentQuery = await getDocs(
                    query(
                        collection(db, 'shipments'),
                        where('shipmentID', '==', shipmentID),
                        limit(1)
                    )
                );

                if (!existingShipmentQuery.empty) {
                    console.log('Shipment already exists in database:', shipmentID);
                    // Set the draft ID to the existing document ID
                    const existingDoc = existingShipmentQuery.docs[0];
                    setActiveDraftId(existingDoc.id);
                    return;
                }

                // Create minimal draft data with creationMethod set
                const initialDraftData = {
                    shipmentID: shipmentID,
                    status: 'draft',
                    creationMethod: 'quickship', // This is the key field
                    companyID: companyIdForAddress,
                    createdBy: currentUser.uid,
                    createdAt: new Date(),
                    updatedAt: new Date(),

                    // Initialize with empty/default values
                    shipmentInfo: {
                        shipmentType: 'freight',
                        shipmentDate: new Date().toISOString().split('T')[0],
                        shipperReferenceNumber: shipmentID, // Use shipment ID as default reference
                        unitSystem: unitSystem,
                        // ADD TIMING FIELDS for BOL generation
                        earliestPickup: '09:00',
                        latestPickup: '17:00',
                        earliestDelivery: '09:00',
                        latestDelivery: '17:00',
                        // Default service options
                        billType: 'third_party',
                        serviceLevel: 'any',
                        dangerousGoodsType: 'none',
                        signatureServiceType: 'none',
                        notes: '',
                        carrierTrackingNumber: '',
                        bookingReferenceNumber: '',
                        bookingReferenceType: 'PO',
                        // Initialize empty reference numbers array
                        referenceNumbers: []
                    },
                    packages: [{
                        id: 1,
                        itemDescription: '',
                        packagingType: 262, // Default to SKID(S)
                        packagingQuantity: 1,
                        weight: '',
                        length: '48',
                        width: '40',
                        height: '',
                        freightClass: '',
                        unitSystem: 'imperial',
                        declaredValue: '',
                        declaredValueCurrency: 'CAD'
                    }],
                    manualRates: [
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
                    ],
                    unitSystem: unitSystem,

                    // QuickShip specific flags
                    isDraft: true,
                    draftVersion: 1
                };

                // Create the draft document with auto-generated ID
                const docRef = await addDoc(collection(db, 'shipments'), initialDraftData);
                console.log('Created initial QuickShip draft in database with ID:', docRef.id, 'shipmentID:', shipmentID);

                // Store the draft document ID
                setActiveDraftId(docRef.id);

                // Mark that we're now editing this draft
                setIsEditingDraft(true);

            } catch (error) {
                console.error('Error creating initial draft:', error);
                // Don't show error to user - this is a background operation
            }
        };

        createInitialDraft();
    }, [shipmentID, isEditingDraft, companyIdForAddress, currentUser, unitSystem, editMode, editShipment, prePopulatedData]); // Add prePopulatedData dependency

    // REMOVED: Duplicate prePopulatedData processing - using main conversion logic above

    // Remove duplicate carrier loading effect - carriers are now loaded with company switching

    // Enhanced carrier management functions
    const handleAddCarrier = () => {
        setEditingCarrier(null);
        setShowCarrierDialog(true);
    };

    const handleEditCarrier = (carrier) => {
        console.log('✏️ EDIT CARRIER BUTTON CLICKED!');
        console.log('✏️ handleEditCarrier called with:', carrier);
        console.log('✏️ Current showCarrierDialog state:', showCarrierDialog);
        console.log('✏️ Current editingCarrier state:', editingCarrier);
        console.log('📝 Setting editingCarrier to:', carrier);
        console.log('📝 Setting showCarrierDialog to: true');

        // Set the states
        setEditingCarrier(carrier);
        setShowCarrierDialog(true);

        // Verify the states were set
        setTimeout(() => {
            console.log('📝 AFTER setState - showCarrierDialog should be true');
            console.log('📝 AFTER setState - editingCarrier should be set');
        }, 100);
    };

    const handleDeleteCarrier = async (carrier) => {
        if (!window.confirm(`Are you sure you want to delete "${carrier.name}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'quickshipCarriers', carrier.id));

            // Remove from local state
            setQuickShipCarriers(prev => prev.filter(c => c.id !== carrier.id));

            // Clear selection if deleted carrier was selected
            if (selectedCarrier === carrier.name) {
                setSelectedCarrier('');
                // Clear carrier from manual rates
                setManualRates(prev => prev.map(rate => ({
                    ...rate,
                    carrier: ''
                })));
            }

            setCarrierSuccessMessage(`Carrier "${carrier.name}" has been deleted successfully.`);
        } catch (error) {
            console.error('Error deleting carrier:', error);
            showError('Failed to delete carrier. Please try again.');
        }
    };

    const handleCarrierSuccess = (savedCarrier, isEdit = false) => {
        if (isEdit) {
            // Update existing carrier in local state
            setQuickShipCarriers(prev => prev.map(c =>
                c.id === savedCarrier.id ? savedCarrier : c
            ));
            setCarrierSuccessMessage(`Carrier "${savedCarrier.name}" has been updated successfully.`);

            // If the updated carrier is currently selected, refresh the terminal selection
            if (selectedCarrier === savedCarrier.name) {
                // Reset and re-establish terminal selection to trigger EmailSelectorDropdown refresh
                setSelectedCarrierContactId('');

                // Set default terminal after a brief delay to ensure state updates
                setTimeout(() => {
                    if (savedCarrier.emailContacts && Array.isArray(savedCarrier.emailContacts) && savedCarrier.emailContacts.length > 0) {
                        const defaultTerminal = savedCarrier.emailContacts.find(t => t.isDefault) || savedCarrier.emailContacts[0];
                        setSelectedCarrierContactId(defaultTerminal.id);
                    }
                }, 100);
            }
        } else {
            // Add new carrier to local state
            setQuickShipCarriers(prev => [...prev, savedCarrier]);
            setCarrierSuccessMessage(`Carrier "${savedCarrier.name}" has been added successfully.`);

            // Select the new carrier
            setSelectedCarrier(savedCarrier.name);

            // Update manual rates with new carrier
            setManualRates(prev => prev.map(rate => ({
                ...rate,
                carrier: savedCarrier.name
            })));
        }

        setShowCarrierDialog(false);
        setEditingCarrier(null);
    };

    // Enhanced broker management functions
    const handleAddBroker = () => {
        setEditingBroker(null);
        setShowBrokerDialog(true);
    };

    const handleEditBroker = (broker) => {
        console.log('✏️ EDIT BROKER BUTTON CLICKED!');
        console.log('✏️ handleEditBroker called with:', broker);
        setEditingBroker(broker);
        setShowBrokerDialog(true);
    };

    const handleDeleteBroker = async (broker) => {
        if (!window.confirm(`Are you sure you want to delete "${broker.name}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'companyBrokers', broker.id));

            // Remove from local state
            setCompanyBrokers(prev => prev.filter(b => b.id !== broker.id));

            // Clear selection if deleted broker was selected
            if (selectedBroker === broker.name) {
                setSelectedBroker('');
            }

            setBrokerSuccessMessage(`Broker "${broker.name}" has been deleted successfully.`);
        } catch (error) {
            console.error('Error deleting broker:', error);
            showError('Failed to delete broker. Please try again.');
        }
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

            // Select the new broker
            setSelectedBroker(savedBroker.name);
        }

        setShowBrokerDialog(false);
        setEditingBroker(null);

        // Clear success message after 3 seconds
        setTimeout(() => {
            setBrokerSuccessMessage('');
        }, 3000);
    };

    // Email validation helper
    const isValidEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    // Handle carrier selection change
    const handleCarrierChange = (newCarrier) => {
        setSelectedCarrier(newCarrier);

        // Find the selected carrier object
        const carrierObj = quickShipCarriers.find(c => c.name === newCarrier);
        let defaultTerminalId = '';
        if (carrierObj && Array.isArray(carrierObj.emailContacts) && carrierObj.emailContacts.length > 0) {
            // Prefer isDefault terminal, else first
            const defaultTerminal = carrierObj.emailContacts.find(t => t.isDefault) || carrierObj.emailContacts[0];
            defaultTerminalId = defaultTerminal.id;
        }
        setSelectedCarrierContactId(defaultTerminalId);

        // Update all manual rates with the new carrier
        setManualRates(prev => prev.map(rate => ({
            ...rate,
            carrier: newCarrier
        })));
    };

    // Convert package measurements from one unit system to another
    const convertPackageMeasurements = (pkg, fromSystem, toSystem) => {
        if (fromSystem === toSystem) return pkg;

        const updatedPkg = { ...pkg, unitSystem: toSystem };

        // Convert weight
        if (pkg.weight && pkg.weight !== '') {
            if (fromSystem === 'imperial' && toSystem === 'metric') {
                updatedPkg.weight = lbsToKg(pkg.weight);
            } else if (fromSystem === 'metric' && toSystem === 'imperial') {
                updatedPkg.weight = kgToLbs(pkg.weight);
            }
        }

        // Convert dimensions
        if (pkg.length && pkg.length !== '') {
            if (fromSystem === 'imperial' && toSystem === 'metric') {
                updatedPkg.length = inchesToCm(pkg.length);
            } else if (fromSystem === 'metric' && toSystem === 'imperial') {
                updatedPkg.length = cmToInches(pkg.length);
            }
        }

        if (pkg.width && pkg.width !== '') {
            if (fromSystem === 'imperial' && toSystem === 'metric') {
                updatedPkg.width = inchesToCm(pkg.width);
            } else if (fromSystem === 'metric' && toSystem === 'imperial') {
                updatedPkg.width = cmToInches(pkg.width);
            }
        }

        if (pkg.height && pkg.height !== '') {
            if (fromSystem === 'imperial' && toSystem === 'metric') {
                updatedPkg.height = inchesToCm(pkg.height);
            } else if (fromSystem === 'metric' && toSystem === 'imperial') {
                updatedPkg.height = cmToInches(pkg.height);
            }
        }

        return updatedPkg;
    };

    // Handle global unit system change - converts ALL packages
    const handleGlobalUnitSystemChange = (newUnitSystem) => {
        if (newUnitSystem === unitSystem) return;

        const oldUnitSystem = unitSystem;
        setUnitSystem(newUnitSystem);

        // Convert all packages to the new unit system
        setPackages(prev => prev.map(pkg => {
            const currentPkgUnitSystem = pkg.unitSystem || 'imperial';
            return convertPackageMeasurements(pkg, currentPkgUnitSystem, newUnitSystem);
        }));

        console.log(`🔄 Converted all packages from ${oldUnitSystem} to ${newUnitSystem}`);
    };

    // Handle unit system change for individual packages
    const handlePackageUnitChange = (packageId, newUnitSystem) => {
        setPackages(prev => prev.map(pkg => {
            if (pkg.id === packageId) {
                const oldUnitSystem = pkg.unitSystem || 'imperial';
                return convertPackageMeasurements(pkg, oldUnitSystem, newUnitSystem);
            }
            return pkg;
        }));
    };

    // Package management functions
    const addPackage = () => {
        const newId = Math.max(...packages.map(p => p.id), 0) + 1;
        setPackages(prev => [...prev, {
            id: newId,
            itemDescription: '',
            packagingType: 262, // Default to SKID(S)
            packagingQuantity: 1,
            weight: '',
            length: '48', // Standard skid length
            width: '40', // Standard skid width
            height: '',
            freightClass: '', // Optional freight class field
            unitSystem: 'imperial', // Individual unit system per package
            declaredValue: '', // Declared value amount
            declaredValueCurrency: 'CAD' // Declared value currency
        }]);
    };

    const removePackage = (id) => {
        if (packages.length > 1) {
            setPackages(prev => prev.filter(pkg => pkg.id !== id));
        }
    };

    const updatePackage = (id, field, value) => {
        setPackages(prev => prev.map(pkg =>
            pkg.id === id ? { ...pkg, [field]: value } : pkg
        ));
    };

    // Rate management functions
    const addRateLineItem = () => {
        // 🔧 SAFE ID GENERATION - prevent NaN by filtering out invalid IDs and using safe fallback
        const validIds = manualRates.map(r => r.id).filter(id => typeof id === 'number' && !isNaN(id));
        const newId = validIds.length > 0 ? Math.max(...validIds) + 1 : 1;
        console.log('🔢 [DEBUG] Generating new rate ID:', { validIds, newId, manualRatesCount: manualRates.length });

        const newRate = {
            id: newId,
            carrier: selectedCarrier,
            code: '', // Start with empty code so user can select
            chargeName: '', // Start with empty name so user can enter
            cost: '',
            costCurrency: 'CAD',
            charge: '',
            chargeCurrency: 'CAD'
        };

        setManualRates(prev => {
            // 🔧 FIXED: Don't recalculate taxes when adding new rate (let user set code first)
            // The tax recalculation will happen when they set the code via updateRateLineItem
            console.log('🍁 HST: Adding new rate line item', {
                newRateId: newId,
                previousRatesCount: prev.length,
                willRecalculateTaxes: false // Changed to false - let user set code first
            });
            return [...prev, newRate];
        });
    };

    const removeRateLineItem = (id) => {
        setManualRates(prev => {
            const rateToRemove = prev.find(rate => rate.id === id);
            const isRemovingTaxCharge = rateToRemove && (rateToRemove.isTax || isTaxCharge(rateToRemove.code));

            console.log('🍁 HST: removeRateLineItem called', {
                rateId: id,
                rateCode: rateToRemove?.code,
                isRemovingTaxCharge: isRemovingTaxCharge,
                isCanadianDomestic: shipFromAddress && shipToAddress ? isCanadianDomesticShipment(shipFromAddress, shipToAddress) : false
            });

            // Remove the rate and recalculate taxes if this is a Canadian domestic shipment
            // AND we're not removing a tax charge (manual tax charges should be removable without recalculation)
            if (availableChargeTypes && availableChargeTypes.length > 0 &&
                shipFromAddress && shipToAddress &&
                isCanadianDomesticShipment(shipFromAddress, shipToAddress) &&
                !isRemovingTaxCharge) { // 🔧 NEW: Don't recalculate when removing tax charges
                const province = shipToAddress?.state;
                if (province) {
                    console.log('🍁 HST: Recalculating taxes after non-tax rate removal', {
                        removedRateCode: rateToRemove?.code,
                        province: province
                    });
                    return removeRateAndRecalculateTaxes(prev, id, province, availableChargeTypes);
                }
            } else if (isRemovingTaxCharge) {
                console.log('🍁 HST: Removing manual tax charge without recalculation', {
                    rateCode: rateToRemove?.code
                });
            }

            // Otherwise just remove the rate normally
            return prev.filter(rate => rate.id !== id);
        });
    };

    const updateRateLineItem = (id, field, value) => {
        setManualRates(prev => {
            const updatedRates = prev.map(rate => {
                if (rate.id === id) {
                    const updatedRate = { ...rate, [field]: value };

                    // Auto-populate charge name when code is selected using dynamic charge types
                    if (field === 'code' && value) {
                        // Use async auto-population with dynamic charge types
                        getAutoPopulatedChargeName(value, rate.chargeName || '').then(newChargeName => {
                            if (newChargeName !== (rate.chargeName || '')) {
                                setManualRates(currentRates => {
                                    const ratesWithNewName = currentRates.map(currentRate =>
                                        currentRate.id === id
                                            ? { ...currentRate, chargeName: newChargeName }
                                            : currentRate
                                    );

                                    // Only recalculate taxes if this is NOT a tax charge being updated
                                    if (availableChargeTypes && availableChargeTypes.length > 0 &&
                                        shipFromAddress && shipToAddress &&
                                        isCanadianDomesticShipment(shipFromAddress, shipToAddress) &&
                                        !isTaxCharge(value)) { // 🔧 NEW: Don't recalculate if updating tax charge
                                        const province = shipToAddress?.state;
                                        if (province) {
                                            console.log('🍁 HST: Recalculating taxes after charge name auto-population', {
                                                chargeCode: value,
                                                chargeName: newChargeName,
                                                province: province
                                            });
                                            return updateRateAndRecalculateTaxes(ratesWithNewName, { id, chargeName: newChargeName }, province, availableChargeTypes);
                                        }
                                    }

                                    return ratesWithNewName;
                                });
                            }
                        }).catch(error => {
                            console.error('Error auto-populating charge name:', error);
                            // Continue without auto-population on error
                        });
                    }

                    return updatedRate;
                }
                return rate;
            });

            // Always recalc for non-tax changes; skip if the edited row itself is a tax line
            const updatedRate = updatedRates.find(rate => rate.id === id);
            const isUpdatingTaxCharge = updatedRate && (updatedRate.isTax || isTaxCharge(updatedRate.code));

            console.log('🍁 HST: updateRateLineItem called', {
                rateId: id,
                field: field,
                value: value,
                rateCode: updatedRate?.code,
                isUpdatingTaxCharge: isUpdatingTaxCharge,
                isCanadianDomestic: shipFromAddress && shipToAddress ? isCanadianDomesticShipment(shipFromAddress, shipToAddress) : false,
                province: shipToAddress?.state,
                chargeTypesAvailable: availableChargeTypes && availableChargeTypes.length > 0
            });

            // Recalculate taxes when non-tax lines change for CA domestic shipments
            if (availableChargeTypes && availableChargeTypes.length > 0 &&
                shipFromAddress && shipToAddress &&
                isCanadianDomesticShipment(shipFromAddress, shipToAddress) &&
                !isUpdatingTaxCharge) { // 🔧 NEW: Don't recalculate when updating tax charges
                const province = shipToAddress?.state;
                if (province) {
                    console.log('🍁 HST: Recalculating taxes for rate update', {
                        updatingField: field,
                        rateCode: updatedRate?.code,
                        province: province,
                        totalRates: updatedRates.length
                    });
                    return updateRateAndRecalculateTaxes(updatedRates, { id, [field]: value }, province, availableChargeTypes);
                }
            } else if (isUpdatingTaxCharge) {
                console.log('🍁 HST: Preserving manual tax charge update', {
                    rateId: id,
                    field: field,
                    value: value,
                    rateCode: updatedRate?.code
                });
            }

            return updatedRates;
        });
    };

    // Enhanced deduplication helper for rate line items
    const createRateKey = (rate) => {
        return `${rate.code}-${rate.chargeName}`.toLowerCase().trim();
    };

    const deduplicateRates = (rates) => {
        const seen = new Set();
        return rates.filter(rate => {
            // Skip deduplication if code or chargeName is empty (user is still editing)
            if (!rate.code || !rate.chargeName) {
                return true;
            }

            const key = createRateKey(rate);
            if (seen.has(key)) {
                console.log('🚫 Preventing duplicate rate:', key);
                return false;
            }
            seen.add(key);
            return true;
        });
    };

    // Service toggle debouncing to prevent race conditions
    const [serviceToggleTimeout, setServiceToggleTimeout] = useState(null);
    const [isProcessingServiceToggle, setIsProcessingServiceToggle] = useState(false);

    // Update available shipment types based on service level availability
    const updateAvailableShipmentTypes = async () => {
        if (!companyData || !companyIdForAddress) return;

        try {
            // Check available service levels for both freight and courier
            const freightLevels = await getAvailableServiceLevels(companyIdForAddress, 'freight', companyData);
            const courierLevels = await getAvailableServiceLevels(companyIdForAddress, 'courier', companyData);

            const availableTypes = [];

            // Add freight if it has service levels
            if (freightLevels && freightLevels.length > 0) {
                availableTypes.push('freight');
            }

            // Add courier if it has service levels  
            if (courierLevels && courierLevels.length > 0) {
                availableTypes.push('courier');
            }

            setAvailableShipmentTypes(availableTypes);

            // Auto-select shipment type if only one option is available
            if (availableTypes.length === 1 && availableTypes[0] !== shipmentInfo.shipmentType) {
                console.log('🔧 QuickShip: Auto-selecting shipment type:', availableTypes[0]);
                setShipmentInfo(prev => ({ ...prev, shipmentType: availableTypes[0] }));
            }

        } catch (error) {
            console.error('Error updating available shipment types:', error);
            // Fallback to both options
            setAvailableShipmentTypes(['courier', 'freight']);
        }
    };

    // Load Service Levels function - now respects company restrictions
    const loadServiceLevels = async () => {
        console.log('🔧 QuickShip: loadServiceLevels called, shipmentType:', shipmentInfo.shipmentType);
        console.log('🔧 QuickShip: companyIdForAddress:', companyIdForAddress);
        console.log('🔧 QuickShip: loadServiceLevels function started');

        try {
            setLoadingServiceLevels(true);

            // Use the new utility function to get company-specific service levels
            const levels = await getAvailableServiceLevels(
                companyIdForAddress,
                shipmentInfo.shipmentType,
                companyData
            );

            console.log('🔧 Loaded company-specific service levels:', levels);
            console.log('🔧 Company restrictions applied by utility function');
            setAvailableServiceLevels(levels);

            // Auto-select service level if only one option is available (excluding 'any')
            if (levels && levels.length === 1) {
                const singleLevel = levels[0];
                if (singleLevel.code !== 'any' && shipmentInfo.serviceLevel === 'any') {
                    console.log('🔧 QuickShip: Auto-selecting service level:', singleLevel.code);
                    setShipmentInfo(prev => ({ ...prev, serviceLevel: singleLevel.code }));
                }
            }

        } catch (error) {
            console.error('🔧 Error loading service levels:', error);
            // Fallback to default 'any' option if loading fails
            setAvailableServiceLevels([{ code: 'any', label: 'Any' }]);
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

            // Get selected carrier data for filtering
            const selectedCarrierObject = quickShipCarriers.find(c => c.name === selectedCarrier);
            console.log('🔧 Selected carrier for additional services filtering:', selectedCarrierObject);

            // Use company-based filtering utility (includes carrier filtering if provided)
            const services = await getCompanyAdditionalServices(
                companyIdForAddress,
                shipmentInfo.shipmentType,
                companyData,
                selectedCarrierObject
            );

            console.log('🔧 Loaded company-filtered additional services:', services);
            setAvailableServices(services);

            // Auto-check services with defaultEnabled flag
            const defaultEnabledServices = services.filter(service => service.defaultEnabled);
            if (defaultEnabledServices.length > 0) {
                console.log('🔧 Auto-checking default enabled services:', defaultEnabledServices.map(s => s.code));

                // Add default enabled services to additionalServices if not already present
                setAdditionalServices(prev => {
                    const newServices = [];
                    defaultEnabledServices.forEach(service => {
                        const exists = prev.find(s => s.id === service.id);
                        if (!exists) {
                            newServices.push(service);
                        }
                    });

                    if (newServices.length > 0) {
                        console.log('🔧 Adding default services:', newServices.map(s => s.code));
                        return [...prev, ...newServices];
                    }

                    return prev;
                });
            }
        } catch (error) {
            console.error('🔧 Error loading additional services:', error);
        } finally {
            setLoadingServices(false);
        }
    };

    const handleServiceToggle = (service) => {
        // Prevent multiple rapid toggles causing race conditions
        if (isProcessingServiceToggle) {
            console.log('🚫 Service toggle already in progress, ignoring');
            return;
        }

        console.log('🔧 handleServiceToggle called with service:', service);
        console.log('🔧 Current additionalServices:', additionalServices);
        console.log('🔧 Current manualRates:', manualRates);

        setIsProcessingServiceToggle(true);

        // Clear any existing timeout
        if (serviceToggleTimeout) {
            clearTimeout(serviceToggleTimeout);
        }

        // Debounce the service toggle to prevent rapid fire clicks
        const timeout = setTimeout(() => {
            setAdditionalServices(prev => {
                console.log('🔧 Previous additionalServices:', prev);
                const exists = prev.find(s => s.id === service.id);
                console.log('🔧 Service exists?', exists);

                if (exists) {
                    // Remove service and corresponding rate line item
                    const updatedServices = prev.filter(s => s.id !== service.id);
                    console.log('🔧 Removing service, updated services:', updatedServices);

                    // Remove the corresponding rate line item with enhanced matching
                    setManualRates(prevRates => {
                        const filteredRates = prevRates.filter(rate => {
                            const isServiceRate = rate.code === 'SUR' && rate.chargeName === service.label;
                            if (isServiceRate) {
                                console.log('🔧 Removing service rate:', rate);
                            }
                            return !isServiceRate;
                        });
                        console.log('🔧 Filtered rates after service removal:', filteredRates);
                        return filteredRates; // No deduplication - user manages their own rates
                    });

                    return updatedServices;
                } else {
                    // Add service and create corresponding rate line item
                    const updatedServices = [...prev, service];
                    console.log('🔧 Adding service, updated services:', updatedServices);

                    // Check if rate already exists to prevent duplicates
                    setManualRates(prevRates => {
                        const existingServiceRate = prevRates.find(rate =>
                            rate.code === 'SUR' && rate.chargeName === service.label
                        );

                        if (existingServiceRate) {
                            console.log('🔧 Service rate already exists, not adding duplicate:', existingServiceRate);
                            return prevRates;
                        }

                        // Add a new rate line item for this service - SAFE ID GENERATION
                        const validIds = prevRates.map(r => r.id).filter(id => typeof id === 'number' && !isNaN(id));
                        const newRateId = validIds.length > 0 ? Math.max(...validIds) + 1 : 1;
                        console.log('🔢 [DEBUG] Generating new service rate ID:', { validIds, newRateId, prevRatesCount: prevRates.length });

                        const newRate = {
                            id: newRateId,
                            carrier: '',
                            code: 'SUR',
                            chargeName: service.label,
                            cost: '',
                            costCurrency: 'CAD',
                            charge: '',
                            chargeCurrency: 'CAD'
                        };
                        console.log('🔧 Adding new service rate:', newRate);

                        const updatedRates = [...prevRates, newRate];
                        console.log('🔧 Updated manual rates:', updatedRates);
                        return updatedRates; // No deduplication - allow multiple service rates
                    });

                    return updatedServices;
                }
            });

            // Reset processing flag after a short delay
            setTimeout(() => {
                setIsProcessingServiceToggle(false);
            }, 100);
        }, 150); // 150ms debounce

        setServiceToggleTimeout(timeout);
    };

    const isServiceSelected = (serviceId) => {
        return additionalServices.some(s => s.id === serviceId);
    };

    // Category filtering functions for Additional Services
    const getFilteredServicesByCategory = () => {
        if (servicesCategoryFilter === 'all') {
            return availableServices;
        }

        return availableServices.filter(service => {
            const serviceType = service.serviceType || 'general';
            return serviceType === servicesCategoryFilter;
        });
    };

    const getServiceCategoryCounts = () => {
        const counts = {
            all: availableServices.length,
            general: 0,
            pickup: 0,
            delivery: 0
        };

        availableServices.forEach(service => {
            const serviceType = service.serviceType || 'general';
            if (counts[serviceType] !== undefined) {
                counts[serviceType]++;
            }
        });

        return counts;
    };

    // Calculate total rate cost with formatting
    const totalCost = useMemo(() => {
        return manualRates.reduce((total, rate) => {
            const charge = parseFloat(rate.charge) || 0;
            return total + charge;
        }, 0);
    }, [manualRates]);

    // Format number with thousands separators
    const formatCurrency = (amount, currency = 'CAD') => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2
        }).format(amount);
    };

    // Handle opening address edit dialog
    const handleOpenEditAddress = (type) => {
        const addressToEdit = type === 'from' ? shipFromAddress : shipToAddress;
        setEditingAddressType(type);
        setEditingAddressData(addressToEdit);
        setShowAddressDialog(true);
    };

    // Handle address update from dialog
    const handleAddressUpdated = async (addressId) => {
        try {
            console.log('🔄 QuickShip handleAddressUpdated called for addressId:', addressId);

            // Add a small delay to ensure database write has completed
            await new Promise(resolve => setTimeout(resolve, 500));

            // Fetch the updated address data from the database
            const addressDoc = await getDoc(doc(db, 'addressBook', addressId));
            if (addressDoc.exists()) {
                const rawAddress = { id: addressDoc.id, ...addressDoc.data() };

                // CRITICAL FIX: Map database fields to QuickShip expected format
                const mappedAddress = {
                    id: rawAddress.id,
                    // Basic identification
                    addressId: rawAddress.id,
                    name: rawAddress.nickname || '',
                    // Company and contact info
                    company: rawAddress.companyName || '',
                    companyName: rawAddress.companyName || '',
                    firstName: rawAddress.firstName || '',
                    lastName: rawAddress.lastName || '',
                    contactName: (rawAddress.firstName && rawAddress.lastName)
                        ? `${rawAddress.firstName} ${rawAddress.lastName}`.trim()
                        : rawAddress.nickname || '',
                    // Address fields - Map database format to QuickShip format
                    street: rawAddress.address1 || rawAddress.street || '',
                    street2: rawAddress.address2 || rawAddress.street2 || '',
                    city: rawAddress.city || '',
                    state: rawAddress.stateProv || rawAddress.state || '',
                    postalCode: rawAddress.zipPostal || rawAddress.postalCode || '',
                    country: rawAddress.country || 'US',
                    // Contact details
                    contactPhone: rawAddress.phone || '',
                    contactEmail: rawAddress.email || '',
                    phone: rawAddress.phone || '',
                    email: rawAddress.email || '',
                    phoneExt: rawAddress.phoneExt || '',
                    // CRITICAL: Preserve special instructions from database
                    specialInstructions: rawAddress.specialInstructions || '',
                    // Business hours
                    openTime: rawAddress.openHours || rawAddress.businessHours?.defaultHours?.open || '',
                    closeTime: rawAddress.closeHours || rawAddress.businessHours?.defaultHours?.close || '',
                    openHours: rawAddress.openHours || rawAddress.businessHours?.defaultHours?.open || '',
                    closeHours: rawAddress.closeHours || rawAddress.businessHours?.defaultHours?.close || '',
                    // Additional fields
                    isResidential: rawAddress.isResidential || false,
                    status: rawAddress.status || 'active',
                    // Preserve database metadata
                    addressClass: rawAddress.addressClass,
                    addressClassID: rawAddress.addressClassID,
                    addressType: rawAddress.addressType,
                    // Keep raw data for reference
                    _rawData: rawAddress
                };

                console.log('🔄 QuickShip Address Updated - Before/After:', {
                    rawAddress: rawAddress,
                    mappedAddress: mappedAddress,
                    specialInstructionsMapped: mappedAddress.specialInstructions,
                    editingType: editingAddressType,
                    // Enhanced debugging for special instructions
                    rawSpecialInstructions: rawAddress.specialInstructions,
                    mappedSpecialInstructions: mappedAddress.specialInstructions,
                    hasSpecialInstructions: !!mappedAddress.specialInstructions,
                    specialInstructionsLength: mappedAddress.specialInstructions ? mappedAddress.specialInstructions.length : 0
                });

                if (editingAddressType === 'from') {
                    setShipFromAddress(mappedAddress);
                    updateFormSection('shipFrom', {
                        ...mappedAddress,
                        type: 'origin'
                    });
                } else {
                    setShipToAddress(mappedAddress);
                    updateFormSection('shipTo', {
                        ...mappedAddress,
                        customerID: mappedAddress.id,
                        type: 'destination'
                    });
                }

                // Reload addresses to get latest data and force cache refresh
                console.log('🔄 Reloading addresses to refresh cache...');
                await loadAddresses();

                // Also update the availableAddresses cache immediately
                setAvailableAddresses(prev => {
                    const updatedAddresses = prev.map(addr =>
                        addr.id === addressId ? mappedAddress : addr
                    );
                    console.log('📋 Updated availableAddresses cache with new address data');
                    return updatedAddresses;
                });

                console.log('✅ QuickShip Address Update Complete:', {
                    editingType: editingAddressType,
                    specialInstructions: mappedAddress.specialInstructions,
                    currentShipFromSpecialInstructions: editingAddressType === 'from' ? mappedAddress.specialInstructions : shipFromAddress?.specialInstructions,
                    currentShipToSpecialInstructions: editingAddressType === 'to' ? mappedAddress.specialInstructions : shipToAddress?.specialInstructions
                });
            } else {
                console.error('Updated address not found');
                showError('Failed to load updated address data');
            }
        } catch (error) {
            console.error('Error fetching updated address:', error);
            showError('Failed to load updated address data');
        }

        // Close dialog
        setShowAddressDialog(false);
        setEditingAddressData(null);
    };

    // Handle opening address in Google Maps popup
    const handleOpenInMaps = (address) => {
        if (!address) return;

        const fullAddress = `${address.street}${address.street2 ? `, ${address.street2}` : ''}, ${address.city}, ${address.state} ${address.postalCode}, ${address.country}`;
        const encodedAddress = encodeURIComponent(fullAddress);
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`;

        // Open in a popup window with optimal size
        const popupWidth = 800;
        const popupHeight = 600;
        const left = (window.screen.width - popupWidth) / 2;
        const top = (window.screen.height - popupHeight) / 2;

        window.open(
            mapsUrl,
            'GoogleMapsPopup',
            `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes,toolbar=no,menubar=no,location=no,status=no`
        );
    };

    // Sliding navigation handlers
    const handleOpenAddAddress = (mode) => {
        setAddressEditMode(mode);
        setIsSliding(true);
        setTimeout(() => {
            setCurrentView('addaddress');
            setIsSliding(false);
        }, 150);
    };

    const handleBackToQuickShip = () => {
        setIsSliding(true);
        setTimeout(() => {
            setCurrentView('quickship');
            setIsSliding(false);
        }, 150);
    };

    // Handle address creation callback
    const handleAddressCreated = async (newAddressId) => {
        console.log('🏠 QuickShip: Address created with ID:', newAddressId);
        console.log('🏠 QuickShip: Current context:', {
            companyIdForAddress,
            selectedCustomerId,
            addressEditMode
        });

        // Reload addresses to include the new one
        console.log('🏠 QuickShip: Reloading addresses...');
        await loadAddresses();

        // Small delay to ensure state is updated, then find and select the new address
        setTimeout(() => {
            // Re-fetch the updated addresses to ensure we have the latest data
            const fetchAndSelectAddress = async () => {
                try {
                    console.log('🏠 QuickShip: Re-fetching addresses to find new one...');
                    const addressQuery = query(
                        collection(db, 'addressBook'),
                        where('companyID', '==', companyIdForAddress),
                        where('status', '==', 'active')
                    );
                    const addressSnapshot = await getDocs(addressQuery);
                    const updatedAddresses = addressSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));

                    console.log('🏠 QuickShip: Found addresses after creation:', {
                        totalCount: updatedAddresses.length,
                        newAddressFound: updatedAddresses.some(addr => addr.id === newAddressId),
                        addresses: updatedAddresses.map(addr => ({
                            id: addr.id,
                            name: addr.name || addr.nickname,
                            companyID: addr.companyID,
                            customerID: addr.customerID,
                            addressClassID: addr.addressClassID
                        }))
                    });

                    setAvailableAddresses(updatedAddresses);

                    // Find and select the new address
                    const newAddress = updatedAddresses.find(addr => addr.id === newAddressId);
                    if (newAddress) {
                        console.log('🏠 QuickShip: Found and selecting new address:', newAddress);
                        handleAddressSelect(newAddress, addressEditMode);
                    } else {
                        console.error('🏠 QuickShip: New address not found in updated list!', {
                            newAddressId,
                            availableIds: updatedAddresses.map(addr => addr.id)
                        });
                    }
                } catch (error) {
                    console.error('🏠 QuickShip: Error fetching updated addresses:', error);
                }
            };

            fetchAndSelectAddress();
        }, 100);

        // Slide back to QuickShip
        handleBackToQuickShip();
    };

    // Generate QuickShip documents (BOL and Carrier Confirmation)
    const generateQuickShipDocuments = async (shipmentId, firebaseDocId, carrierDetails) => {
        console.log('generateQuickShipDocuments called with:', { shipmentId, firebaseDocId, carrierDetails });
        setBookingStep('generating_label');
        setLabelGenerationStatus('Generating shipping documents...');

        try {
            // Generate Generic BOL first
            console.log('Generating Generic BOL...');
            setLabelGenerationStatus('Generating Bill of Lading...');

            const functions = getFunctions();
            const generateBOLFunction = httpsCallable(functions, 'generateGenericBOL');

            const bolPayload = {
                shipmentId: shipmentId,
                firebaseDocId: firebaseDocId
            };

            console.log('BOL generation payload:', bolPayload);
            const bolResult = await generateBOLFunction(bolPayload);
            console.log('BOL generation result:', bolResult);

            if (bolResult.data && bolResult.data.success) {
                console.log('BOL generated successfully');
                setLabelGenerationStatus('Bill of Lading generated successfully! Generating carrier confirmation...');
            } else {
                console.warn('BOL generation failed:', bolResult.data?.error);
                setLabelGenerationStatus('BOL generation failed, continuing with carrier confirmation...');
            }

            // Generate Carrier Confirmation
            console.log('Generating Carrier Confirmation...');
            setLabelGenerationStatus('Generating carrier confirmation...');

            const generateConfirmationFunction = httpsCallable(functions, 'generateCarrierConfirmation');

            const confirmationPayload = {
                shipmentId: shipmentId,
                firebaseDocId: firebaseDocId,
                carrierDetails: carrierDetails
            };

            console.log('Carrier confirmation payload:', confirmationPayload);
            const confirmationResult = await generateConfirmationFunction(confirmationPayload);
            console.log('Carrier confirmation result:', confirmationResult);

            if (confirmationResult.data && confirmationResult.data.success) {
                console.log('Carrier confirmation generated successfully');
                setLabelGenerationStatus('All documents generated successfully!');
            } else {
                console.warn('Carrier confirmation generation failed:', confirmationResult.data?.error);
                setLabelGenerationStatus('Some documents failed to generate, but shipment is booked.');
            }

            // Complete the booking process
            setBookingStep('completed');

            // Clear form after successful booking and document generation
            setTimeout(() => {
                clearFormData();
                setShipmentInfo({
                    shipmentType: 'freight',
                    shipmentDate: new Date().toISOString().split('T')[0],
                    shipperReferenceNumber: '',
                    carrierTrackingNumber: '',
                    bookingReferenceNumber: '',
                    bookingReferenceType: 'PO',
                    billType: 'third_party',
                    serviceLevel: 'any',
                    dangerousGoodsType: 'none',
                    signatureServiceType: 'none',
                    notes: '',
                    referenceNumbers: [] // Reset reference numbers
                });
                setPackages([{
                    id: 1,
                    itemDescription: '',
                    packagingType: 262, // Default to SKID(S)
                    packagingQuantity: 1,
                    weight: '',
                    length: '48', // Standard skid length
                    width: '40', // Standard skid width
                    height: ''
                }]);
                setManualRates([
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
                ]);
                setSelectedCarrier('');
            }, 2000);

        } catch (error) {
            console.error('Error generating QuickShip documents:', error);
            setLabelGenerationStatus(`Error generating documents: ${error.message}`);
            // Still complete the booking even if document generation fails
            setBookingStep('completed');
        }
    };

    // Handle Book Shipment button click
    const handleBookShipment = () => {
        // Run comprehensive validation
        if (!validateQuickShipForm()) {
            return;
        }

        // Show confirmation dialog with shipment summary
        setShowConfirmDialog(true);
    };

    // Handle booking confirmation
    const handleConfirmBooking = () => {
        setShowConfirmDialog(false);
        setShowBookingDialog(true);
        setBookingStep('booking');
        bookQuickShipment();
    };

    // Main QuickShip booking function
    // This function prepares and sends comprehensive shipment data including:
    // - Package details with quantities, weights, dimensions, and calculated totals
    // - Special services (service level, dangerous goods, signature requirements)
    // - Complete address information with validation
    // - Manual rate entries with cost/charge breakdown
    // - Carrier details and tracking information
    // - All data flows to: database record, email notifications, BOL generation, carrier confirmations
    const bookQuickShipment = async () => {
        setIsBooking(true);
        setError(null);

        try {
            // Final validation before booking
            if (!validateQuickShipForm()) {
                throw new Error('Validation failed. Please check your form data.');
            }

            // Use the pre-generated shipment ID or generate a new one if needed
            let finalShipmentID = shipmentID;

            if (!finalShipmentID) {
                // Generate shipmentID if we don't have one yet
                try {
                    finalShipmentID = await generateShipmentId(companyIdForAddress);
                    console.log('Generated QuickShip shipmentID for booking:', finalShipmentID);
                } catch (idError) {
                    console.warn('Failed to generate shipmentID, using fallback:', idError);
                    const timestamp = Date.now().toString().slice(-8);
                    const randomSuffix = Math.random().toString(36).substr(2, 6).toUpperCase();
                    finalShipmentID = `QS-${companyIdForAddress}-${timestamp}-${randomSuffix}`;
                }
            }

            // Get selected carrier details - include full carrier object for new email structure
            const selectedCarrierObject = quickShipCarriers.find(c => c.name === selectedCarrier);
            const carrierDetails = selectedCarrierObject || {
                name: selectedCarrier,
                contactName: '',
                contactEmail: '',
                contactPhone: ''
            };

            console.log('🏢 Carrier details for booking:', {
                carrierName: carrierDetails.name,
                hasEmailContacts: !!carrierDetails.emailContacts,
                selectedTerminal: selectedCarrierContactId,
                isNewStructure: !!selectedCarrierObject?.emailContacts
            });

            // Calculate total weight, pieces, and package count for validation
            const totalWeight = packages.reduce((sum, pkg) => sum + (safeParseFloat(pkg.weight, 0) * safeParseInt(pkg.packagingQuantity, 1)), 0);
            const totalPieces = packages.reduce((sum, pkg) => sum + safeParseInt(pkg.packagingQuantity, 1), 0);
            const totalPackageCount = packages.length; // Number of distinct package types

            // Prepare shipment data with enhanced validation
            const shipmentData = {
                // Basic shipment info
                shipmentID: finalShipmentID,
                status: 'booked',
                creationMethod: 'quickship',
                companyID: companyIdForAddress,
                createdBy: currentUser.uid,
                createdAt: new Date(),
                updatedAt: new Date(),

                // Shipment details with complete information
                shipmentInfo: {
                    ...shipmentInfo,
                    shipmentBillType: shipmentInfo.billType,
                    actualShipDate: shipmentInfo.shipmentDate || new Date().toISOString().split('T')[0],
                    totalWeight: totalWeight,
                    totalPieces: totalPieces,
                    totalPackageCount: totalPackageCount,
                    unitSystem: unitSystem,
                    // Ensure special services are included
                    serviceLevel: shipmentInfo.serviceLevel || 'any',
                    dangerousGoodsType: shipmentInfo.dangerousGoodsType || 'none',
                    signatureServiceType: shipmentInfo.signatureServiceType || 'none',
                    notes: shipmentInfo.notes || '',
                    shipperReferenceNumber: shipmentInfo.shipperReferenceNumber || '',
                    bookingReferenceNumber: shipmentInfo.bookingReferenceNumber || '',
                    bookingReferenceType: shipmentInfo.bookingReferenceType || 'PO',
                    // Add multiple reference numbers
                    referenceNumbers: shipmentInfo.referenceNumbers || []
                },

                // Customer selection for proper recall
                customerId: selectedCustomerId || null,
                customerID: selectedCustomerId || null,

                // Addresses - properly structured from address book with validation
                shipFrom: {
                    ...shipFromAddress,
                    addressId: shipFromAddress.id,
                    type: 'origin',
                    // Ensure all required fields are present
                    companyName: shipFromAddress.companyName || shipFromAddress.company || 'Unknown Company',
                    street: shipFromAddress.street || '',
                    city: shipFromAddress.city || '',
                    state: shipFromAddress.state || '',
                    postalCode: shipFromAddress.postalCode || '',
                    country: shipFromAddress.country || 'CA'
                },
                shipTo: {
                    ...shipToAddress,
                    addressId: shipToAddress.id,
                    customerID: (() => {
                        // Find the selected customer and use their customerID field, not document ID
                        if (selectedCustomerId) {
                            const selectedCustomer = availableCustomers.find(c =>
                                c.id === selectedCustomerId || c.customerID === selectedCustomerId
                            );
                            if (selectedCustomer) {
                                console.log('🎯 Saving customerID field to shipTo:', selectedCustomer.customerID);
                                return selectedCustomer.customerID; // Use the customerID field, not document ID
                            }
                        }
                        return shipToAddress.id; // Fallback to address ID
                    })(),
                    type: 'destination',
                    // Ensure all required fields are present
                    companyName: shipToAddress.companyName || shipToAddress.company || 'Unknown Company',
                    street: shipToAddress.street || '',
                    city: shipToAddress.city || '',
                    state: shipToAddress.state || '',
                    postalCode: shipToAddress.postalCode || '',
                    country: shipToAddress.country || 'CA'
                },

                // Packages with complete validation and standardized structure
                packages: packages.map((pkg, index) => ({
                    ...pkg,
                    // Ensure stable package ID for tracking
                    id: pkg.id || (index + 1),
                    packageNumber: index + 1,
                    // Required fields with validation
                    itemDescription: pkg.itemDescription || '',
                    weight: safeParseFloat(pkg.weight, 0),
                    packagingQuantity: safeParseInt(pkg.packagingQuantity, 1),
                    length: safeParseFloat(pkg.length, 0),
                    width: safeParseFloat(pkg.width, 0),
                    height: safeParseFloat(pkg.height, 0),
                    // Calculate individual package total weight (weight * quantity)
                    totalWeight: safeParseFloat(pkg.weight, 0) * safeParseInt(pkg.packagingQuantity, 1),
                    // Packaging type information
                    packagingType: pkg.packagingType,
                    packagingTypeCode: pkg.packagingType,
                    packagingTypeName: PACKAGING_TYPES.find(pt => pt.value === pkg.packagingType)?.label || 'PACKAGE',
                    // Unit and measurement information
                    unitSystem: pkg.unitSystem || 'imperial',
                    // Special freight information
                    freightClass: pkg.freightClass || '',
                    // Declared value information  
                    declaredValue: safeParseFloat(pkg.declaredValue, 0),
                    declaredValueCurrency: pkg.declaredValueCurrency || 'CAD',
                    // Calculated dimensions for volume
                    volume: safeParseFloat(pkg.length, 0) * safeParseFloat(pkg.width, 0) * safeParseFloat(pkg.height, 0),
                    // Dimensions string for display
                    dimensionsDisplay: `${pkg.length || 0} x ${pkg.width || 0} x ${pkg.height || 0} ${pkg.unitSystem === 'metric' ? 'cm' : 'in'}`
                })),

                // Carrier and rates
                carrier: selectedCarrier,
                carrierType: 'manual',
                carrierDetails: carrierDetails,
                selectedCarrierContactId: selectedCarrierContactId, // Include selected terminal for new email system

                // Broker information - Enhanced to preserve broker name even without full details
                selectedBroker: selectedBroker,
                brokerDetails: selectedBroker ? (() => {
                    const foundBroker = companyBrokers.find(b => b.name === selectedBroker);
                    if (foundBroker) {
                        return foundBroker;
                    } else {
                        // If broker not found in companyBrokers, create minimal broker object to preserve name
                        console.log('🏢 QUICKSHIP: Broker not found in companyBrokers, creating minimal broker object:', selectedBroker);
                        return {
                            name: selectedBroker,
                            phone: '',
                            email: '',
                            brokerName: selectedBroker // Additional fallback field
                        };
                    }
                })() : null,
                brokerPort: brokerPort || '', // Add shipment-level broker port
                brokerReference: brokerReference || '', // Add shipment-level broker reference
                manualRates: manualRates.map(rate => ({
                    ...rate,
                    cost: safeParseFloat(rate.cost, 0).toFixed(2),
                    charge: safeParseFloat(rate.charge, 0).toFixed(2)
                })),
                // Carrier confirmation rates (exclude IC SUR and IC LOG)
                carrierConfirmationRates: manualRates
                    .filter(rate => rate.code !== 'IC SUR' && rate.code !== 'IC LOG')
                    .map(rate => ({
                        ...rate,
                        cost: safeParseFloat(rate.cost, 0),
                        charge: safeParseFloat(rate.charge, 0)
                    })),
                totalCharges: totalCost,
                currency: manualRates[0]?.chargeCurrency || 'CAD',
                unitSystem: unitSystem,

                // Additional Services (freight and courier)
                additionalServices: (shipmentInfo.shipmentType === 'freight' || shipmentInfo.shipmentType === 'courier') ? additionalServices : [],

                // Tracking
                trackingNumber: shipmentInfo.carrierTrackingNumber || finalShipmentID,

                // QuickShip specific flags
                isQuickShip: true,
                rateSource: 'manual',
                bookingTimestamp: new Date().toISOString()
            };

            // 🔍 COMPREHENSIVE DEBUGGING FOR NaN DETECTION
            console.log('🚀 QuickShip booking data prepared:', {
                shipmentID: finalShipmentID,
                carrier: selectedCarrier,
                totalWeight,
                totalPieces,
                totalPackageCount,
                totalCharges: totalCost,
                packageDetails: packages.map(pkg => ({
                    id: pkg.id,
                    description: pkg.itemDescription,
                    weight: pkg.weight,
                    quantity: pkg.packagingQuantity,
                    totalWeight: safeParseFloat(pkg.weight, 0) * safeParseInt(pkg.packagingQuantity, 1),
                    dimensions: `${pkg.length}x${pkg.width}x${pkg.height}`,
                    packagingType: pkg.packagingType
                })),
                specialServices: {
                    serviceLevel: shipmentInfo.serviceLevel,
                    dangerousGoodsType: shipmentInfo.dangerousGoodsType,
                    signatureServiceType: shipmentInfo.signatureServiceType,
                    notes: shipmentInfo.notes
                },
                rateBreakdown: manualRates.map(rate => ({
                    code: rate.code,
                    name: rate.chargeName,
                    cost: rate.cost,
                    charge: rate.charge
                }))
            });

            // 🔍 DETAILED NaN DETECTION IN SHIPMENT DATA
            console.log('🔍 [DEBUG] Complete shipmentData object being sent to Firebase:', JSON.stringify(shipmentData, (key, value) => {
                if (typeof value === 'number' && isNaN(value)) {
                    console.error(`❌ [NaN DETECTED] Field "${key}" contains NaN value!`);
                    return `NaN_DETECTED_${key}`;
                }
                return value;
            }, 2));

            // 🔍 SPECIFIC NaN CHECKS FOR CRITICAL FIELDS
            const nanChecks = {
                packages: shipmentData.packages.map((pkg, idx) => ({
                    packageIndex: idx,
                    weight: { value: pkg.weight, isNaN: isNaN(pkg.weight) },
                    length: { value: pkg.length, isNaN: isNaN(pkg.length) },
                    width: { value: pkg.width, isNaN: isNaN(pkg.width) },
                    height: { value: pkg.height, isNaN: isNaN(pkg.height) },
                    totalWeight: { value: pkg.totalWeight, isNaN: isNaN(pkg.totalWeight) },
                    volume: { value: pkg.volume, isNaN: isNaN(pkg.volume) },
                    declaredValue: { value: pkg.declaredValue, isNaN: isNaN(pkg.declaredValue) },
                    packagingQuantity: { value: pkg.packagingQuantity, isNaN: isNaN(pkg.packagingQuantity) }
                })),
                manualRates: shipmentData.manualRates.map((rate, idx) => ({
                    rateIndex: idx,
                    code: rate.code,
                    cost: { value: rate.cost, isNaN: isNaN(parseFloat(rate.cost)) },
                    charge: { value: rate.charge, isNaN: isNaN(parseFloat(rate.charge)) }
                })),
                carrierConfirmationRates: shipmentData.carrierConfirmationRates.map((rate, idx) => ({
                    rateIndex: idx,
                    code: rate.code,
                    cost: { value: rate.cost, isNaN: isNaN(rate.cost) },
                    charge: { value: rate.charge, isNaN: isNaN(rate.charge) }
                })),
                totals: {
                    totalWeight: { value: totalWeight, isNaN: isNaN(totalWeight) },
                    totalPieces: { value: totalPieces, isNaN: isNaN(totalPieces) },
                    totalCost: { value: totalCost, isNaN: isNaN(totalCost) }
                }
            };

            console.log('🔍 [DEBUG] NaN Detection Results:', nanChecks);

            // 🔍 CHECK FOR ANY NaN VALUES IN THE ENTIRE OBJECT
            const findNaNValues = (obj, path = '') => {
                const nanPaths = [];
                for (const [key, value] of Object.entries(obj)) {
                    const currentPath = path ? `${path}.${key}` : key;
                    if (typeof value === 'number' && isNaN(value)) {
                        nanPaths.push(currentPath);
                    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                        nanPaths.push(...findNaNValues(value, currentPath));
                    } else if (Array.isArray(value)) {
                        value.forEach((item, index) => {
                            if (typeof item === 'number' && isNaN(item)) {
                                nanPaths.push(`${currentPath}[${index}]`);
                            } else if (typeof item === 'object' && item !== null) {
                                nanPaths.push(...findNaNValues(item, `${currentPath}[${index}]`));
                            }
                        });
                    }
                }
                return nanPaths;
            };

            const nanPaths = findNaNValues(shipmentData);
            if (nanPaths.length > 0) {
                console.error('❌ [CRITICAL] NaN values found at paths:', nanPaths);
                nanPaths.forEach(path => {
                    console.error(`❌ NaN at: ${path}`);
                });
            } else {
                console.log('✅ [DEBUG] No NaN values detected in shipmentData');
            }

            // 🔍 DEBUG CARRIER DETAILS
            console.log('🔍 [DEBUG] Carrier details being sent:', JSON.stringify(carrierDetails, (key, value) => {
                if (typeof value === 'number' && isNaN(value)) {
                    console.error(`❌ [NaN DETECTED in carrierDetails] Field "${key}" contains NaN value!`);
                    return `NaN_DETECTED_${key}`;
                }
                return value;
            }, 2));

            // 🔍 DEBUG FINAL PAYLOAD
            const finalPayload = {
                shipmentData: {
                    ...shipmentData,
                    skipEmailNotifications: !sendEmailNotifications // Add email toggle flag
                },
                carrierDetails: carrierDetails
            };

            console.log('🔍 [DEBUG] Final payload size check:', {
                shipmentDataKeys: Object.keys(finalPayload.shipmentData).length,
                carrierDetailsKeys: Object.keys(finalPayload.carrierDetails || {}).length,
                packagesCount: finalPayload.shipmentData.packages?.length,
                manualRatesCount: finalPayload.shipmentData.manualRates?.length
            });

            // 🔍 FINAL NaN CHECK ON COMPLETE PAYLOAD
            const payloadNaNPaths = findNaNValues(finalPayload);
            if (payloadNaNPaths.length > 0) {
                console.error('❌ [CRITICAL] NaN values found in final payload at paths:', payloadNaNPaths);
                payloadNaNPaths.forEach(path => {
                    console.error(`❌ Final payload NaN at: ${path}`);
                });
                // Still proceed with booking but log the issue
            }

            // Call the QuickShip booking function with enhanced error handling
            const functions = getFunctions();
            const bookQuickShipFunction = httpsCallable(functions, 'bookQuickShipment');

            console.log('🚀 [DEBUG] About to call bookQuickShipFunction with payload...');
            const result = await bookQuickShipFunction(finalPayload);

            console.log('QuickShip booking result:', result);

            if (result.data && result.data.success) {
                const bookingDetails = result.data.data;
                setFinalShipmentId(finalShipmentID);

                // Backend already handles document generation, just update the UI
                console.log('QuickShip booking successful!');
                setBookingStep('completed');
                setLabelGenerationStatus('Booking completed successfully!');

                // Check if documents were generated by the backend
                if (bookingDetails.documents && bookingDetails.documents.length > 0) {
                    const successfulDocs = bookingDetails.documents.filter(doc => doc.success);
                    if (successfulDocs.length > 0) {
                        setLabelGenerationStatus(`Booking completed! ${successfulDocs.length} document(s) generated successfully.`);
                    } else {
                        setLabelGenerationStatus('Booking completed! Documents will be generated shortly.');
                    }
                } else {
                    setLabelGenerationStatus('Booking completed successfully!');
                }

            } else {
                const errorMessage = result.data?.error || ERROR_MESSAGES.BOOKING_FAILED;
                console.error('QuickShip booking error:', errorMessage);
                setError(errorMessage);
                setBookingStep('error');
            }

        } catch (error) {
            console.error('Error booking QuickShip:', error);

            // Enhanced error handling with specific messages
            let errorMessage = ERROR_MESSAGES.BOOKING_FAILED;

            if (error.code === 'functions/unavailable' || error.message?.includes('network')) {
                errorMessage = ERROR_MESSAGES.NETWORK_ERROR;
            } else if (error.message?.includes('validation')) {
                errorMessage = error.message;
            }

            setError(errorMessage);
            setBookingStep('error');
        } finally {
            setIsBooking(false);
        }
    };

    // Handle booking completion
    const handleBookingComplete = () => {
        // Close the booking dialog first
        setShowBookingDialog(false);

        // Close the QuickShip modal
        if (onClose) {
            onClose();
        }

        // Navigate back to shipments after a brief delay
        setTimeout(() => {
            if (onReturnToShipments) {
                onReturnToShipments();
            }
        }, 300); // Small delay to ensure smooth transition
    };

    // Handle view shipment - open shipment detail modal directly
    const handleViewShipment = () => {
        if (finalShipmentId && onViewShipment) {
            // Call the onViewShipment prop immediately to open the shipment detail modal directly
            console.log('🎯 QuickShip: Calling onViewShipment with shipmentId:', finalShipmentId);

            // Don't close dialogs here - let the parent handle the modal transitions
            // This prevents the QuickShip modal from closing too early
            onViewShipment(finalShipmentId);

            // The parent Dashboard component will handle closing modals in the right order
        } else if (finalShipmentId) {
            // Fallback: If no onViewShipment prop but we have a shipment ID, try direct navigation
            console.log('🎯 QuickShip: No onViewShipment prop, attempting direct admin navigation');

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

    // Load draft data when draftId is provided
    const loadDraftData = useCallback(async (draftShipmentId) => {
        if (!draftShipmentId) return;

        setIsDraftLoading(true);
        try {
            const draftDoc = await getDoc(doc(db, 'shipments', draftShipmentId));
            if (draftDoc.exists()) {
                const draftData = draftDoc.data();

                // Only load if it's a quickship draft
                if (draftData.creationMethod === 'quickship') {
                    console.log('Loading QuickShip draft:', draftData);
                    console.log('Draft shipFrom data:', draftData.shipFrom);
                    console.log('Draft packages data:', draftData.packages);

                    // Set draft state first to ensure components know they're in edit mode
                    setIsEditingDraft(true);

                    // Set the shipment ID from the draft
                    if (draftData.shipmentID) {
                        setShipmentID(draftData.shipmentID);
                    }

                    // Load address data immediately
                    if (draftData.shipFrom) {
                        console.log('Loading shipFrom data:', draftData.shipFrom);
                        setShipFromAddress(draftData.shipFrom);
                        updateFormSection('shipFrom', draftData.shipFrom);
                    }
                    if (draftData.shipTo) {
                        console.log('Loading shipTo data:', draftData.shipTo);
                        setShipToAddress(draftData.shipTo);
                        updateFormSection('shipTo', draftData.shipTo);
                    }

                    // Load other state data with a small delay to ensure form context is ready
                    setTimeout(() => {
                        // Load shipment info
                        if (draftData.shipmentInfo) {
                            setShipmentInfo(prev => ({
                                ...prev,
                                ...draftData.shipmentInfo
                            }));
                        }

                        // Load carrier
                        if (draftData.selectedCarrier) {
                            setSelectedCarrier(draftData.selectedCarrier);
                        }

                        // Load selected carrier contact ID
                        if (draftData.selectedCarrierContactId) {
                            setSelectedCarrierContactId(draftData.selectedCarrierContactId);
                        }

                        // Load broker
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

                        // Load packages with proper structure check and validation
                        if (draftData.packages && Array.isArray(draftData.packages) && draftData.packages.length > 0) {
                            console.log('Loading packages data:', draftData.packages);
                            // Ensure each package has all required fields with fallbacks
                            const validatedPackages = draftData.packages.map(pkg => ({
                                ...pkg,
                                itemDescription: pkg.itemDescription || '',
                                packagingType: pkg.packagingType || 262, // Default to SKID(S)
                                packagingQuantity: pkg.packagingQuantity || 1,
                                weight: pkg.weight || '',
                                length: pkg.length || '48', // Standard skid length
                                width: pkg.width || '40', // Standard skid width
                                height: pkg.height || '',
                                freightClass: pkg.freightClass || '', // Include freight class field
                                unitSystem: pkg.unitSystem || 'imperial', // Include individual unit system
                                declaredValue: pkg.declaredValue || '', // Include declared value
                                declaredValueCurrency: pkg.declaredValueCurrency || 'CAD' // Include declared value currency
                            }));
                            setPackages(validatedPackages);
                        }

                        // Load manual rates
                        if (draftData.manualRates && draftData.manualRates.length > 0) {
                            // Format rates to 2 decimal places
                            const formattedRates = draftData.manualRates.map(rate => ({
                                ...rate,
                                cost: rate.cost ? safeParseFloat(rate.cost, 0).toFixed(2) : '',
                                charge: rate.charge ? safeParseFloat(rate.charge, 0).toFixed(2) : ''
                            }));
                            setManualRates(formattedRates);
                        }

                        // Load unit system
                        if (draftData.unitSystem) {
                            setUnitSystem(draftData.unitSystem);
                        }

                        // Load email notification preference
                        if (typeof draftData.sendEmailNotifications === 'boolean') {
                            setSendEmailNotifications(draftData.sendEmailNotifications);
                        }
                    }, 50);
                } else {
                    // If not a quickship draft, close and show error
                    setError('This draft was created using the advanced shipment form and cannot be edited in QuickShip.');
                    setTimeout(() => {
                        if (onReturnToShipments) {
                            onReturnToShipments();
                        }
                    }, 2000);
                }
            } else {
                setError('Draft shipment not found.');
            }
        } catch (error) {
            console.error('Error loading draft:', error);
            setError('Failed to load draft shipment.');
        } finally {
            setIsDraftLoading(false);
        }
    }, [updateFormSection, onReturnToShipments]);

    // Load draft on component mount if draftId is provided
    useEffect(() => {
        const loadDraft = async () => {
            if (!draftId) return;

            // Set editing state first
            setIsEditingDraft(true);
            setIsDraftLoading(true);

            try {
                const draftDoc = await getDoc(doc(db, 'shipments', draftId));
                if (draftDoc.exists()) {
                    const draftData = draftDoc.data();

                    // Only load if it's a quickship draft
                    if (draftData.creationMethod === 'quickship') {
                        console.log('Loading QuickShip draft:', draftData);
                        console.log('Draft company ID:', draftData.companyID);
                        console.log('Current company context:', companyIdForAddress);

                        // CRITICAL: Set the active draft ID so conversion knows which draft to convert
                        setActiveDraftId(draftId);

                        // CRITICAL: Validate and switch company context if needed
                        if (draftData.companyID && draftData.companyID !== companyIdForAddress) {
                            console.log('🔄 Draft belongs to different company, switching context');

                            try {
                                // Fetch company data for the draft
                                const companiesQuery = query(
                                    collection(db, 'companies'),
                                    where('companyID', '==', draftData.companyID),
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

                                    // Switch company context
                                    await setCompanyContext(targetCompanyData);

                                    // Update local state for company admins, admins and super admins
                                    if (userRole === 'superadmin' || userRole === 'admin' || userRole === 'user') {
                                        setSelectedCompanyId(draftData.companyID);
                                        setSelectedCompanyData(targetCompanyData);
                                    }

                                    console.log('✅ Switched to draft company context:', targetCompanyData.name);
                                } else {
                                    console.warn('⚠️ Draft company not found:', draftData.companyID);
                                }
                            } catch (contextError) {
                                console.error('❌ Error switching to draft company context:', contextError);
                            }
                        }

                        // Set the shipment ID from the draft
                        if (draftData.shipmentID) {
                            setShipmentID(draftData.shipmentID);
                        } else {
                            // Use the draftId as the shipmentID if shipmentID field is missing
                            setShipmentID(draftId);
                        }

                        // Load address data after company context is established
                        if (draftData.shipFrom) {
                            console.log('Loading shipFrom data:', draftData.shipFrom);
                            setShipFromAddress(draftData.shipFrom);
                            updateFormSection('shipFrom', draftData.shipFrom);
                        }
                        if (draftData.shipTo) {
                            console.log('Loading shipTo data:', draftData.shipTo);
                            setShipToAddress(draftData.shipTo);
                            updateFormSection('shipTo', draftData.shipTo);
                        }

                        // Load other state data with a small delay to ensure form context is ready
                        setTimeout(() => {
                            // Load shipment info
                            if (draftData.shipmentInfo) {
                                setShipmentInfo(prev => ({
                                    ...prev,
                                    ...draftData.shipmentInfo,
                                    // Ensure referenceNumbers is included
                                    referenceNumbers: draftData.shipmentInfo.referenceNumbers || []
                                }));
                            }

                            // Load carrier
                            if (draftData.selectedCarrier) {
                                setSelectedCarrier(draftData.selectedCarrier);
                            }

                            // Load selected customer ID (for all admin users)
                            if (draftData.selectedCustomerId) {
                                console.log('🎯 Loading selected customer from draft:', draftData.selectedCustomerId);
                                setSelectedCustomerId(draftData.selectedCustomerId);
                            }

                            // Load selected carrier contact ID
                            if (draftData.selectedCarrierContactId) {
                                setSelectedCarrierContactId(draftData.selectedCarrierContactId);
                            }

                            // Load packages with proper structure check and validation
                            if (draftData.packages && Array.isArray(draftData.packages) && draftData.packages.length > 0) {
                                console.log('Loading packages data:', draftData.packages);
                                // Ensure each package has all required fields with fallbacks
                                const validatedPackages = draftData.packages.map(pkg => ({
                                    ...pkg,
                                    itemDescription: pkg.itemDescription || '',
                                    packagingType: pkg.packagingType || 262, // Default to SKID(S)
                                    packagingQuantity: pkg.packagingQuantity || 1,
                                    weight: pkg.weight || '',
                                    length: pkg.length || '48', // Standard skid length
                                    width: pkg.width || '40', // Standard skid width
                                    height: pkg.height || '',
                                    freightClass: pkg.freightClass || '', // Include freight class field
                                    unitSystem: pkg.unitSystem || 'imperial', // Include individual unit system
                                    declaredValue: pkg.declaredValue || '', // Include declared value
                                    declaredValueCurrency: pkg.declaredValueCurrency || 'CAD' // Include declared value currency
                                }));
                                setPackages(validatedPackages);
                            }

                            // Load manual rates with migration support
                            if (draftData.manualRates && draftData.manualRates.length > 0) {
                                console.log('🔧 Loading manual rates from draft:', draftData.manualRates.length);

                                // Format rates to 2 decimal places with safe parsing
                                const formattedRates = draftData.manualRates.map(rate => ({
                                    ...rate,
                                    cost: rate.cost ? safeParseFloat(rate.cost, 0).toFixed(2) : '',
                                    charge: rate.charge ? safeParseFloat(rate.charge, 0).toFixed(2) : ''
                                }));

                                // Check if rates need migration to dynamic charge types
                                migrateShipmentChargeCodes(formattedRates).then(migrationResult => {
                                    if (migrationResult.changes.length > 0) {
                                        console.log('🔄 Migrated charge codes in draft:', migrationResult.changes);
                                        setManualRates(migrationResult.migratedRates);
                                    } else {
                                        setManualRates(formattedRates);
                                    }
                                }).catch(error => {
                                    console.error('⚠️  Error migrating charge codes, using original rates:', error);
                                    setManualRates(formattedRates); // Use original rates if migration fails
                                });
                            }

                            // Load additional services and create corresponding rate line items
                            if (draftData.additionalServices && Array.isArray(draftData.additionalServices)) {
                                setAdditionalServices(draftData.additionalServices);

                                // Enhanced duplicate prevention for service rates
                                setTimeout(() => {
                                    setManualRates(prevRates => {
                                        // Create rate line items for additional services if they don't exist
                                        const existingServiceRates = prevRates.filter(rate =>
                                            rate.code === 'SUR' && draftData.additionalServices.some(service => service.label === rate.chargeName)
                                        );

                                        const missingServiceRates = draftData.additionalServices.filter(service =>
                                            !prevRates.some(rate => rate.code === 'SUR' && rate.chargeName === service.label)
                                        );

                                        if (missingServiceRates.length > 0) {
                                            console.log('🔧 Adding missing service rates for draft:', missingServiceRates.map(s => s.label));

                                            const currentMaxId = Math.max(...(prevRates.map(r => r.id) || [0]), 0);
                                            const newServiceRates = missingServiceRates.map((service, index) => ({
                                                id: currentMaxId + index + 1,
                                                carrier: '',
                                                code: 'SUR',
                                                chargeName: service.label,
                                                cost: '',
                                                costCurrency: 'CAD',
                                                charge: '',
                                                chargeCurrency: 'CAD'
                                            }));

                                            const combinedRates = [...prevRates, ...newServiceRates];
                                            return combinedRates; // No deduplication when loading drafts
                                        }

                                        return prevRates; // No deduplication when loading drafts
                                    });
                                }, 100); // Small delay to ensure other state is loaded first
                            }

                            // Load unit system
                            if (draftData.unitSystem) {
                                setUnitSystem(draftData.unitSystem);
                            }

                            // Load email notification preference
                            if (typeof draftData.sendEmailNotifications === 'boolean') {
                                setSendEmailNotifications(draftData.sendEmailNotifications);
                            }
                        }, 50);
                    } else {
                        // If not a quickship draft, close and show error
                        setError('This draft was created using the advanced shipment form and cannot be edited in QuickShip.');
                        setTimeout(() => {
                            if (onReturnToShipments) {
                                onReturnToShipments();
                            }
                        }, 2000);
                    }
                } else {
                    setError('Draft shipment not found.');
                }
            } catch (error) {
                console.error('Error loading draft:', error);
                setError('Failed to load draft shipment.');
            } finally {
                setIsDraftLoading(false);
            }
        };

        loadDraft();
    }, [draftId, updateFormSection, onReturnToShipments]);

    // Load existing shipment data when in edit mode
    useEffect(() => {
        const loadEditShipmentData = async () => {
            if (!isEditingExistingShipment || !editShipment) return;

            console.log('🔄 Loading existing shipment for editing:', editShipment);

            try {
                // Load shipment info
                if (editShipment.shipmentInfo) {
                    setShipmentInfo(prev => ({
                        ...prev,
                        ...editShipment.shipmentInfo,
                        // Ensure referenceNumbers is included
                        referenceNumbers: editShipment.shipmentInfo.referenceNumbers || []
                    }));
                }

                // Load addresses
                if (editShipment.shipFrom || editShipment.shipFromAddress) {
                    const fromAddress = editShipment.shipFrom || editShipment.shipFromAddress;
                    setShipFromAddress(fromAddress);
                    updateFormSection('shipFrom', fromAddress);
                }
                if (editShipment.shipTo || editShipment.shipToAddress) {
                    const toAddress = editShipment.shipTo || editShipment.shipToAddress;
                    setShipToAddress(toAddress);
                    updateFormSection('shipTo', toAddress);
                }

                // Load packages
                if (editShipment.packages && Array.isArray(editShipment.packages) && editShipment.packages.length > 0) {
                    console.log('Loading packages from shipment:', editShipment.packages);
                    const validatedPackages = editShipment.packages.map(pkg => ({
                        ...pkg,
                        itemDescription: pkg.itemDescription || '',
                        packagingType: pkg.packagingType || 262,
                        packagingQuantity: pkg.packagingQuantity || 1,
                        weight: pkg.weight || '',
                        length: pkg.length || '48',
                        width: pkg.width || '40',
                        height: pkg.height || '',
                        freightClass: pkg.freightClass || '',
                        unitSystem: pkg.unitSystem || 'imperial',
                        declaredValue: pkg.declaredValue || '',
                        declaredValueCurrency: pkg.declaredValueCurrency || 'CAD'
                    }));
                    setPackages(validatedPackages);
                }

                // 🔧 UNIFIED SYSTEM: Use rateDataManager for consistent data loading
                let ratesToLoad = null;
                let rateSource = '';

                try {
                    // Use unified rate data manager to get the latest rate data
                    const rateData = rateDataManager.convertToUniversalFormat(editShipment);

                    console.log('🔧 QuickShip edit: Loading from unified rate manager:', {
                        chargeCount: rateData.charges.length,
                        totalCost: rateData.totals.cost,
                        totalCharge: rateData.totals.charge,
                        carrier: rateData.carrier.name
                    });

                    rateSource = 'unified_manager';
                    ratesToLoad = rateData.charges.map((charge, index) => ({
                        id: charge.id || index + 1,
                        carrier: rateData.carrier.name || editShipment.selectedCarrier || '',
                        code: charge.code,
                        chargeName: charge.name,
                        cost: charge.cost ? parseFloat(charge.cost).toFixed(2) : '',
                        costCurrency: charge.currency,
                        charge: charge.charge ? parseFloat(charge.charge).toFixed(2) : '',
                        chargeCurrency: charge.currency,
                        // Include all inline edit fields
                        actualCost: charge.cost || '',
                        actualCharge: charge.charge || '',
                        invoiceNumber: charge.invoiceNumber || '',
                        ediNumber: charge.ediNumber || '',
                        commissionable: charge.commissionable || false
                    }));
                } catch (error) {
                    console.error('❌ Error loading from unified rate manager, falling back to legacy:', error);

                    // Legacy fallback: manualRates
                    if (editShipment.manualRates && editShipment.manualRates.length > 0) {
                        console.log('🔧 QuickShip edit: Legacy fallback to manualRates:', editShipment.manualRates.length);
                        rateSource = 'manualRates_fallback';
                        ratesToLoad = editShipment.manualRates.map(rate => ({
                            ...rate,
                            cost: rate.cost ? safeParseFloat(rate.cost, 0).toFixed(2) : '',
                            charge: rate.charge ? safeParseFloat(rate.charge, 0).toFixed(2) : '',
                            actualCost: rate.actualCost || '',
                            actualCharge: rate.actualCharge || '',
                            invoiceNumber: rate.invoiceNumber || '',
                            ediNumber: rate.ediNumber || '',
                            commissionable: rate.commissionable || false
                        }));
                    }
                }

                // Legacy fallback: Check for old updatedCharges format (for backward compatibility)
                if (!ratesToLoad && editShipment.updatedCharges && Array.isArray(editShipment.updatedCharges) && editShipment.updatedCharges.length > 0) {
                    console.log('🔧 QuickShip edit: Legacy fallback - loading from updatedCharges:', editShipment.updatedCharges.length);
                    rateSource = 'updatedCharges';
                    ratesToLoad = editShipment.updatedCharges.map(charge => ({
                        id: charge.id || Math.random(),
                        carrier: charge.carrier || '',
                        code: charge.code || 'FRT',
                        chargeName: charge.description || 'Freight',
                        cost: charge.quotedCost || charge.cost || '',
                        charge: charge.quotedCharge || charge.amount || '',
                        actualCost: charge.actualCost || '',
                        actualCharge: charge.actualCharge || '',
                        currency: charge.currency || 'CAD',
                        invoiceNumber: charge.invoiceNumber || '',
                        ediNumber: charge.ediNumber || '',
                        commissionable: charge.commissionable || false,
                        isTax: charge.isTax || false,
                        isMarkup: charge.isMarkup || false
                    }));
                }
                // Priority 3: Legacy rates format
                if (!ratesToLoad && editShipment.rates && editShipment.rates.length > 0) {
                    console.log('🔧 QuickShip edit: Loading from legacy rates format:', editShipment.rates.length);
                    rateSource = 'legacy rates';
                    ratesToLoad = editShipment.rates.map((rate, index) => ({
                        id: rate.id || index + 1,
                        carrier: rate.carrier || '',
                        code: rate.code || 'FRT',
                        chargeName: rate.chargeName || rate.description || 'Freight',
                        cost: (rate.cost || rate.amount) ? parseFloat(rate.cost || rate.amount).toFixed(2) : '',
                        costCurrency: rate.costCurrency || rate.currency || 'CAD',
                        charge: (rate.charge || rate.amount) ? parseFloat(rate.charge || rate.amount).toFixed(2) : '',
                        chargeCurrency: rate.chargeCurrency || rate.currency || 'CAD'
                    }));
                }

                // Apply rates if any were found
                if (ratesToLoad && ratesToLoad.length > 0) {
                    console.log(`🔧 QuickShip edit: Applying rates from ${rateSource}:`, ratesToLoad);

                    // Check if rates need migration to dynamic charge types (unless already from updatedCharges)
                    if (rateSource !== 'updatedCharges') {
                        migrateShipmentChargeCodes(ratesToLoad).then(migrationResult => {
                            if (migrationResult.changes.length > 0) {
                                console.log('🔄 Migrated charge codes in edit shipment:', migrationResult.changes);
                                setManualRates(migrationResult.migratedRates);
                            } else {
                                setManualRates(ratesToLoad);
                            }
                        }).catch(error => {
                            console.error('⚠️  Error migrating charge codes, using original rates:', error);
                            setManualRates(ratesToLoad); // Use original rates if migration fails
                        });
                    } else {
                        // updatedCharges already have the correct format, no migration needed
                        setManualRates(ratesToLoad);
                    }
                }

                // Load carrier
                if (editShipment.selectedCarrier) {
                    setSelectedCarrier(editShipment.selectedCarrier);
                } else if (editShipment.carrier) {
                    setSelectedCarrier(editShipment.carrier);
                }

                // Load customer selection
                if (editShipment.customerId || editShipment.customerID) {
                    const customerId = editShipment.customerId || editShipment.customerID;
                    console.log('🎯 Loading customer from edit shipment:', customerId);
                    setSelectedCustomerId(customerId);
                }

                // Load additional services and create corresponding rate line items
                if (editShipment.additionalServices && Array.isArray(editShipment.additionalServices)) {
                    setAdditionalServices(editShipment.additionalServices);

                    // Enhanced duplicate prevention for service rates in edit mode
                    setTimeout(() => {
                        setManualRates(prevRates => {
                            // Create rate line items for additional services if they don't exist
                            const existingServiceRates = prevRates.filter(rate =>
                                rate.code === 'SUR' && editShipment.additionalServices.some(service => service.label === rate.chargeName)
                            );

                            const missingServiceRates = editShipment.additionalServices.filter(service =>
                                !prevRates.some(rate => rate.code === 'SUR' && rate.chargeName === service.label)
                            );

                            if (missingServiceRates.length > 0) {
                                console.log('🔧 Adding missing service rates for edit shipment:', missingServiceRates.map(s => s.label));

                                const currentMaxId = Math.max(...(prevRates.map(r => r.id) || [0]), 0);
                                const newServiceRates = missingServiceRates.map((service, index) => ({
                                    id: currentMaxId + index + 1,
                                    carrier: '',
                                    code: 'SUR',
                                    chargeName: service.label,
                                    cost: '',
                                    costCurrency: 'CAD',
                                    charge: '',
                                    chargeCurrency: 'CAD'
                                }));

                                const combinedRates = [...prevRates, ...newServiceRates];
                                return combinedRates; // No deduplication when loading edit shipment
                            }

                            return prevRates; // No deduplication when loading edit shipment
                        });
                    }, 100); // Small delay to ensure other state is loaded first
                }

                // Load unit system
                if (editShipment.unitSystem) {
                    setUnitSystem(editShipment.unitSystem);
                }

                // Load email notification preference (default to true if not specified)
                setSendEmailNotifications(editShipment.sendEmailNotifications !== false);

                // Load broker information - only load if data is valid and not null/empty
                if (editShipment.selectedBroker && editShipment.selectedBroker !== null && editShipment.selectedBroker !== '') {
                    setSelectedBroker(editShipment.selectedBroker);
                }
                if (editShipment.brokerPort && editShipment.brokerPort !== null && editShipment.brokerPort !== '') {
                    setBrokerPort(editShipment.brokerPort);
                }
                if (editShipment.brokerReference && editShipment.brokerReference !== null && editShipment.brokerReference !== '') {
                    setBrokerReference(editShipment.brokerReference);
                }

                // Auto-expand broker section if broker data exists and is valid
                const hasValidBrokerData = (editShipment.selectedBroker && editShipment.selectedBroker !== null && editShipment.selectedBroker !== '') ||
                    (editShipment.brokerPort && editShipment.brokerPort !== null && editShipment.brokerPort !== '') ||
                    (editShipment.brokerReference && editShipment.brokerReference !== null && editShipment.brokerReference !== '');
                if (hasValidBrokerData) {
                    setBrokerExpanded(true);
                }

                console.log('✅ Loaded existing shipment data for editing');

            } catch (error) {
                console.error('❌ Error loading existing shipment data:', error);
                if (showNotification) {
                    showNotification('Error loading shipment data for editing', 'error');
                } else {
                    setError('Error loading shipment data for editing');
                }
            }
        };

        loadEditShipmentData();
    }, [isEditingExistingShipment, editShipment, updateFormSection, showNotification]);

    // Handle customer selection from editShipment after customers are loaded (similar to prePopulatedData handling)
    useEffect(() => {
        if (!isEditingExistingShipment || !editShipment) return;

        // Extract customer ID from shipment data
        let extractedCustomerId = editShipment.customerId || editShipment.customerID;

        // Fallback to shipTo address customer data
        if (!extractedCustomerId && editShipment.shipTo) {
            if (editShipment.shipTo.customerID) {
                extractedCustomerId = editShipment.shipTo.customerID;
                console.log('🔍 Extracted customer ID from shipTo.customerID:', extractedCustomerId);
            } else if (editShipment.shipTo.addressClass === 'customer' && editShipment.shipTo.addressClassID) {
                extractedCustomerId = editShipment.shipTo.addressClassID;
                console.log('🔍 Extracted customer ID from shipTo.addressClassID:', extractedCustomerId);
            }
        }

        // Only apply if we have customers loaded and a customer ID to set, and user hasn't manually cleared
        if (extractedCustomerId && availableCustomers.length > 0 && !loadingCustomers && !customerManuallyCleared) {
            console.log('🎯 Applying customer selection from editShipment:', {
                extractedCustomerId,
                availableCustomersCount: availableCustomers.length,
                currentSelectedCustomerId: selectedCustomerId
            });

            // Check if customer exists in available customers - check both ID fields
            let matchedCustomer = null;
            const customerExists = availableCustomers.some(customer => {
                // Check if the extracted ID matches either the document ID or customerID field
                const matchByDocId = customer.id === extractedCustomerId;
                const matchByCustomerId = customer.customerID === extractedCustomerId;
                const matches = matchByDocId || matchByCustomerId;

                if (matches) {
                    matchedCustomer = customer;
                    console.log('✅ Customer found in available customers:', {
                        customerName: customer.name,
                        customerId: customer.id,
                        customerID: customer.customerID,
                        searchingFor: extractedCustomerId,
                        matchedBy: matchByDocId ? 'document ID' : 'customerID field'
                    });
                }
                return matches;
            });

            if (customerExists && matchedCustomer) {
                // CRITICAL: Use the document ID for selection, not the customerID field
                const idToSelect = matchedCustomer.id;
                if (selectedCustomerId !== idToSelect) {
                    console.log('✅ Setting customer from edit shipment:', {
                        extractedCustomerId,
                        willSelectId: idToSelect,
                        customerName: matchedCustomer.name
                    });
                    setSelectedCustomerId(idToSelect);
                }
            } else {
                console.warn('⚠️ Customer not found in available customers:', extractedCustomerId);
            }
        }
    }, [editShipment, isEditingExistingShipment, availableCustomers, loadingCustomers]);

    // Reset manual clearing flag when starting to edit a different shipment
    useEffect(() => {
        if (editMode && editShipment) {
            setCustomerManuallyCleared(false);
        }
    }, [editMode, editShipment?.id]); // Reset when editing different shipment

    // Additional effect to ensure components are properly updated when draft editing begins
    // Removed - no longer needed since we're using final shipment IDs from the start
    // useEffect(() => {
    //     if (isEditingDraft && activeDraftId) {
    //         // Force a small delay to ensure all components have properly re-rendered with the new key
    //         const timer = setTimeout(() => {
    //             console.log('Draft editing mode active, ensuring components are updated');
    //             // No need to call updateFormSection here as the data is already loaded in loadDraftData
    //         }, 100);

    //         return () => clearTimeout(timer);
    //     }
    // }, [isEditingDraft, activeDraftId]);

    // Ship Later - Save as QuickShip draft
    const handleShipLater = async () => {
        console.log('🚀 SHIP LATER: Starting handleShipLater function');
        setIsSavingDraft(true);
        setError(null);

        try {
            // Use lenient draft validation - allows saving without carrier
            console.log('🚀 SHIP LATER: Running validation...');
            if (!validateQuickShipDraft()) {
                console.log('❌ SHIP LATER: Validation failed, stopping save process');
                setIsSavingDraft(false);
                return;
            }
            console.log('✅ SHIP LATER: Validation passed, proceeding with save');

            console.log('Saving QuickShip draft:', {
                shipmentID,
                isEditingDraft,
                draftId,
                activeDraftId,
                editMode,
                editShipment: editShipment?.id
            });

            // Get the ship from and ship to addresses with full details
            const shipFromAddressFull = availableAddresses.find(addr => addr.id === shipFromAddress?.id) || shipFromAddress;
            const shipToAddressFull = availableAddresses.find(addr => addr.id === shipToAddress?.id) || shipToAddress;

            // Calculate totals for draft saving
            const draftTotalWeight = packages.reduce((sum, pkg) => sum + (safeParseFloat(pkg.weight, 0) * safeParseInt(pkg.packagingQuantity, 1)), 0);
            const draftTotalPieces = packages.reduce((sum, pkg) => sum + safeParseInt(pkg.packagingQuantity, 1), 0);
            const draftTotalPackageCount = packages.length;

            const draftData = {
                // Basic shipment fields
                shipmentID: shipmentID, // Always use the shipmentID field
                status: 'draft',
                creationMethod: 'quickship',
                companyID: companyIdForAddress,
                createdBy: currentUser?.uid || 'unknown',
                updatedAt: new Date(),

                // Comprehensive shipment information - save whatever is entered
                shipmentInfo: {
                    ...shipmentInfo,
                    shipmentType: shipmentInfo.shipmentType || 'freight',
                    unitSystem: unitSystem,
                    carrierTrackingNumber: shipmentInfo.carrierTrackingNumber || '',
                    totalWeight: draftTotalWeight,
                    totalPieces: draftTotalPieces,
                    totalPackageCount: draftTotalPackageCount,
                    // Special services
                    serviceLevel: shipmentInfo.serviceLevel || 'any',
                    dangerousGoodsType: shipmentInfo.dangerousGoodsType || 'none',
                    signatureServiceType: shipmentInfo.signatureServiceType || 'none',
                    notes: shipmentInfo.notes || '',
                    shipperReferenceNumber: shipmentInfo.shipperReferenceNumber || '',
                    bookingReferenceNumber: shipmentInfo.bookingReferenceNumber || '',
                    bookingReferenceType: shipmentInfo.bookingReferenceType || 'PO',
                    // Add multiple reference numbers
                    referenceNumbers: shipmentInfo.referenceNumbers || []
                },
                shipFrom: shipFromAddressFull || null, // Save null if not selected
                shipTo: shipToAddressFull || null, // Save null if not selected

                // Enhanced package data with calculations
                packages: packages.map((pkg, index) => ({
                    ...pkg,
                    id: pkg.id || (index + 1),
                    packageNumber: index + 1,
                    itemDescription: pkg.itemDescription || '',
                    weight: safeParseFloat(pkg.weight, 0),
                    packagingQuantity: safeParseInt(pkg.packagingQuantity, 1),
                    totalWeight: safeParseFloat(pkg.weight, 0) * safeParseInt(pkg.packagingQuantity, 1),
                    packagingTypeName: PACKAGING_TYPES.find(pt => pt.value === pkg.packagingType)?.label || 'PACKAGE',
                    volume: safeParseFloat(pkg.length, 0) * safeParseFloat(pkg.width, 0) * safeParseFloat(pkg.height, 0),
                    dimensionsDisplay: `${pkg.length || 0} x ${pkg.width || 0} x ${pkg.height || 0} ${pkg.unitSystem === 'metric' ? 'cm' : 'in'}`
                })),

                selectedCarrier: selectedCarrier || '', // Save empty string if not selected
                selectedCarrierContactId: selectedCarrierContactId || '', // Save selected email contact
                selectedBroker: selectedBroker || '', // Save selected broker
                brokerDetails: selectedBroker ? (() => {
                    const foundBroker = companyBrokers.find(b => b.name === selectedBroker);
                    if (foundBroker) {
                        return foundBroker;
                    } else {
                        // If broker not found in companyBrokers, create minimal broker object to preserve name
                        console.log('🏢 QUICKSHIP DRAFT: Broker not found in companyBrokers, creating minimal broker object:', selectedBroker);
                        return {
                            name: selectedBroker,
                            phone: '',
                            email: '',
                            brokerName: selectedBroker // Additional fallback field
                        };
                    }
                })() : null,
                brokerPort: brokerPort || '', // Save shipment-level broker port
                brokerReference: brokerReference || '', // Save shipment-level broker reference
                manualRates: manualRates,
                additionalServices: (shipmentInfo.shipmentType === 'freight' || shipmentInfo.shipmentType === 'courier') ? additionalServices : [],
                unitSystem: unitSystem,
                totalCost: totalCost,
                carrier: selectedCarrier || '', // Direct carrier field for table display
                carrierTrackingNumber: shipmentInfo.carrierTrackingNumber || '', // Save at top level too

                // Email notification preference
                sendEmailNotifications: sendEmailNotifications,

                // Customer selection (for admin users)
                selectedCustomerId: selectedCustomerId || null,

                // Draft specific fields
                isDraft: true,
                draftSavedAt: new Date(),
                draftVersion: increment(1) // Increment version on each save
            };

            // Determine which document to update
            let docRef;
            let docId;

            // Handle edit mode - update existing shipment instead of creating new draft
            if (editMode && editShipment) {
                console.log('🔄 Edit mode detected - updating existing shipment:', editShipment.id);
                docRef = doc(db, 'shipments', editShipment.id);
                docId = editShipment.id;
                await updateDoc(docRef, draftData);
                console.log('QuickShip shipment updated successfully in edit mode:', docId);
            } else if (activeDraftId) {
                // We already have a draft document, update it
                docRef = doc(db, 'shipments', activeDraftId);
                docId = activeDraftId;
                // CRITICAL: Update the existing draft, don't change creation method
                const updateData = { ...draftData };
                delete updateData.creationMethod; // Don't change the original creation method
                await updateDoc(docRef, updateData);
                console.log('QuickShip draft updated successfully (conversion):', docId);
            } else if (draftId) {
                // We're editing an existing draft that was passed as prop
                docRef = doc(db, 'shipments', draftId);
                docId = draftId;
                await updateDoc(docRef, draftData);
                console.log('QuickShip draft updated successfully:', docId);
            } else {
                // Create a new draft document with auto-generated ID
                draftData.createdAt = new Date();
                docRef = await addDoc(collection(db, 'shipments'), draftData);
                docId = docRef.id;
                setActiveDraftId(docId); // Store the new document ID
                console.log('QuickShip draft created successfully:', docId);
            }

            console.log('✅ SHIP LATER: Draft saved successfully to Firebase, docId:', docId);

            // Show success notification
            setShowDraftSuccess(true);

            // Call the parent callback to refresh shipments table
            if (onDraftSaved) {
                console.log('🔄 SHIP LATER: Calling parent callback to refresh shipments table after draft save');
                onDraftSaved(docId, 'Draft saved successfully');
            } else {
                console.log('⚠️ SHIP LATER: No onDraftSaved callback provided');
            }

            // After a short delay, navigate to shipments modal
            setTimeout(() => {
                console.log('🚀 SHIP LATER: Starting modal close sequence...');
                setShowDraftSuccess(false);

                // Close QuickShip modal first
                if (onClose) {
                    console.log('✅ SHIP LATER: Closing QuickShip modal via onClose()');
                    onClose();
                } else {
                    console.log('⚠️ SHIP LATER: No onClose callback provided');
                }

                // Then open shipments modal
                if (onReturnToShipments) {
                    console.log('✅ SHIP LATER: Calling onReturnToShipments()');
                    onReturnToShipments();
                } else {
                    console.log('⚠️ SHIP LATER: No onReturnToShipments callback provided');
                }

                console.log('🎉 SHIP LATER: Modal close sequence completed');
            }, 1500); // Show success message for 1.5 seconds before navigating

        } catch (error) {
            console.error('❌ SHIP LATER: Error saving QuickShip draft:', error);
            console.error('❌ SHIP LATER: Error details:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });
            setError(`Failed to save draft: ${error.message}`);
        } finally {
            console.log('🏁 SHIP LATER: Setting isSavingDraft to false');
            setIsSavingDraft(false);
        }
    };

    // Submit for Review - Save as draft with pending_review flag
    const handleSubmitForReview = () => {
        console.log('🔍 SUBMIT FOR REVIEW: Starting submit for review process');

        // Use lenient draft validation (same as Ship Later) - allows saving without all fields
        if (!validateQuickShipDraft()) {
            console.log('❌ SUBMIT FOR REVIEW: Draft validation failed');
            return;
        }

        // Show confirmation dialog
        setShowReviewDialog(true);
    };

    const handleConfirmSubmitForReview = async () => {
        console.log('🔍 SUBMIT FOR REVIEW: Confirming submission for review');
        setIsSubmittingForReview(true);
        setError(null);

        try {
            // Calculate totals
            const draftTotalWeight = packages.reduce((total, pkg) => total + (parseFloat(pkg.weight) || 0), 0);
            const draftTotalPieces = packages.reduce((total, pkg) => total + (parseInt(pkg.quantity) || 1), 0);
            const draftTotalPackageCount = packages.length;

            const draftData = {
                // Basic shipment fields
                shipmentID: shipmentID,
                status: 'draft',
                creationMethod: 'quickship',
                companyID: companyIdForAddress,
                createdBy: currentUser?.uid || 'unknown',
                updatedAt: new Date(),

                // CRITICAL: Add pending_review flag
                pending_review: true,
                submitted_for_review_at: new Date(),
                submitted_for_review_by: currentUser?.uid || 'unknown',

                // Comprehensive shipment information
                shipmentInfo: {
                    ...shipmentInfo,
                    shipmentType: shipmentInfo.shipmentType || 'freight',
                    unitSystem: unitSystem,
                    carrierTrackingNumber: shipmentInfo.carrierTrackingNumber || '',
                    totalWeight: draftTotalWeight,
                    totalPieces: draftTotalPieces,
                    totalPackageCount: draftTotalPackageCount,
                    serviceLevel: shipmentInfo.serviceLevel || 'any',
                    dangerousGoodsType: shipmentInfo.dangerousGoodsType || 'none',
                    signatureServiceType: shipmentInfo.signatureServiceType || 'none',
                    notes: shipmentInfo.notes || '',
                    shipperReferenceNumber: shipmentInfo.shipperReferenceNumber || '',
                    bookingReferenceNumber: shipmentInfo.bookingReferenceNumber || '',
                    bookingReferenceType: shipmentInfo.bookingReferenceType || 'PO',
                    referenceNumbers: shipmentInfo.referenceNumbers || []
                },
                shipFrom: availableAddresses.find(addr => addr.id === shipFromAddress?.id) || shipFromAddress || null,
                shipTo: availableAddresses.find(addr => addr.id === shipToAddress?.id) || shipToAddress || null,

                // Enhanced package data with calculations
                packages: packages.map((pkg, index) => ({
                    ...pkg,
                    totalWeight: parseFloat(pkg.weight) * parseInt(pkg.quantity),
                    packageNumber: index + 1,
                    formattedDescription: pkg.itemDescription || `Package ${index + 1}`,
                    formattedDimensions: `${pkg.length || 0}" x ${pkg.width || 0}" x ${pkg.height || 0}"`,
                    formattedWeight: `${pkg.weight || 0} ${unitSystem === 'metric' ? 'kg' : 'lbs'}`,
                    volume: (parseFloat(pkg.length) || 0) * (parseFloat(pkg.width) || 0) * (parseFloat(pkg.height) || 0)
                })),

                // Carrier information (if selected)
                selectedCarrier: selectedCarrier || null,
                carrier: selectedCarrier ? {
                    name: selectedCarrier,
                    key: selectedCarrier.toLowerCase().replace(/\s+/g, '_')
                } : null,

                // Rate information (manual rates)
                manualRates: manualRates.map(rate => ({
                    ...rate,
                    cost: parseFloat(rate.cost || 0),
                    charge: parseFloat(rate.charge || 0),
                    costCurrency: rate.costCurrency || 'CAD',
                    chargeCurrency: rate.chargeCurrency || 'CAD'
                })),

                // Additional services
                additionalServices: additionalServices || [],

                // Total calculation
                totalCost: manualRates.reduce((sum, rate) => sum + (parseFloat(rate.charge) || 0), 0),
                currency: 'CAD',

                // System metadata
                formCompleteness: {
                    hasShipFrom: !!shipFromAddress,
                    hasShipTo: !!shipToAddress,
                    hasPackages: packages.length > 0,
                    hasRates: manualRates.length > 0,
                    hasCarrier: !!selectedCarrier
                }
            };

            console.log('🔍 SUBMIT FOR REVIEW: Draft data prepared:', draftData);

            // Save the draft
            let docRef;
            let docId;

            if (activeDraftId) {
                // Update existing draft
                docRef = doc(db, 'shipments', activeDraftId);
                docId = activeDraftId;
                await updateDoc(docRef, draftData);
                console.log('Draft updated for review:', docId);
            } else if (draftId) {
                // Update existing draft passed as prop
                docRef = doc(db, 'shipments', draftId);
                docId = draftId;
                await updateDoc(docRef, draftData);
                console.log('Draft updated for review:', docId);
            } else {
                // Create new draft
                draftData.createdAt = new Date();
                docRef = await addDoc(collection(db, 'shipments'), draftData);
                docId = docRef.id;
                setActiveDraftId(docId);
                console.log('New draft created for review:', docId);
            }

            console.log('✅ SUBMIT FOR REVIEW: Draft submitted successfully');

            // Close dialog
            setShowReviewDialog(false);

            // Show success message
            showSuccess('Shipment submitted for review successfully! The operations team will process your request.');

            // Call callback to refresh shipments
            if (onDraftSaved) {
                onDraftSaved(docId, 'Shipment submitted for review');
            }

            // Close QuickShip modal after brief delay
            setTimeout(() => {
                if (onClose) {
                    onClose();
                }
                if (onReturnToShipments) {
                    onReturnToShipments();
                }
            }, 1500);

        } catch (error) {
            console.error('❌ SUBMIT FOR REVIEW: Error submitting for review:', error);
            setError(`Failed to submit for review: ${error.message}`);
        } finally {
            setIsSubmittingForReview(false);
        }
    };

    // Coordinated data loading functions
    const loadAddressesForCompany = useCallback(async (companyId, customerId = null) => {
        console.log('🟡 loadAddressesForCompany called with:', { companyId, customerId });
        if (!companyId) {
            console.log('📍 No company ID provided for address loading');
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

            console.log('🔍 DEBUG: All addresses for company:', {
                companyId,
                totalCount: allAddresses.length,
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

            // Add customer filter for admins if specific customer is selected
            const effectiveCustomerId = customerId || selectedCustomerId;
            if ((userRole === 'superadmin' || userRole === 'admin' || userRole === 'user') && effectiveCustomerId && effectiveCustomerId !== 'all') {
                // Try multiple filter approaches to handle different data structures
                addresses = allAddresses.filter(addr => {
                    const matches = addr.addressClassID === effectiveCustomerId ||
                        addr.customerID === effectiveCustomerId ||
                        (addr.addressClass === 'customer' && addr.addressClassID === effectiveCustomerId);

                    if (!matches && addr.addressClassID) {
                        console.log('🔍 Address not matching:', {
                            addressId: addr.id,
                            addressClassID: addr.addressClassID,
                            customerID: addr.customerID,
                            lookingFor: effectiveCustomerId,
                            addressClass: addr.addressClass
                        });
                    }

                    return matches;
                });

                console.log('🔍 DEBUG: Filtered addresses:', {
                    effectiveCustomerId,
                    filteredCount: addresses.length,
                    filterCriteria: 'addressClassID or customerID equals customerId'
                });
            }

            console.log('📍 Address loading completed:', {
                companyId,
                effectiveCustomerId,
                userRole,
                addressCount: addresses.length,
                isFiltered: (userRole === 'superadmin' || userRole === 'admin' || userRole === 'user') && effectiveCustomerId && effectiveCustomerId !== 'all',
                addresses: addresses.slice(0, 3) // Show first 3 for debugging
            });

            setAvailableAddresses(addresses);
        } catch (error) {
            console.error('Error loading addresses:', error);
            setError('Failed to load addresses from address book.');
        } finally {
            setLoadingAddresses(false);
        }
    }, [userRole]); // Remove selectedCustomerId since it's passed as parameter

    const loadCarriersForCompany = useCallback(async (companyId) => {
        if (!companyId) {
            console.log('📍 No company ID provided for carrier loading');
            return;
        }

        console.log('📍 Loading carriers for company:', companyId);
        setLoadingCarriers(true);

        try {
            const carriersQuery = query(
                collection(db, 'quickshipCarriers'),
                where('companyID', '==', companyId)
            );
            const carriersSnapshot = await getDocs(carriersQuery);
            const carriers = carriersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log('📍 Carrier loading completed:', {
                companyId,
                carrierCount: carriers.length
            });

            setQuickShipCarriers(carriers);
        } catch (error) {
            console.error('Error loading carriers:', error);
        } finally {
            setLoadingCarriers(false);
        }
    }, []);

    // Legacy loadAddresses function for backward compatibility
    const loadAddresses = useCallback(async () => {
        const currentCompanyId = selectedCompanyId || companyIdForAddress;
        if (!currentCompanyId) {
            console.log('📍 No company ID available for address loading:', { selectedCompanyId, companyIdForAddress });
            return;
        }
        await loadAddressesForCompany(currentCompanyId);
    }, [selectedCompanyId, companyIdForAddress, loadAddressesForCompany]);

    // Simplified address loading effect - only trigger on customer filter changes
    // REMOVED: Duplicate useEffect for customer filter - handled below

    // Debug address state changes (simplified)
    // useEffect(() => {
    //     console.log('shipFromAddress state changed:', shipFromAddress);
    // }, [shipFromAddress]);

    // useEffect(() => {
    //     console.log('shipToAddress state changed:', shipToAddress);
    // }, [shipToAddress]);

    // Format address for display
    const formatAddressForDisplay = (address) => {
        if (!address) return '';
        const parts = [
            address.companyName,
            address.street,
            address.city,
            address.state,
            address.postalCode,
            address.country
        ].filter(Boolean);
        return parts.join(', ');
    };

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
        if (/^\\d{1,2}:\\d{2}\\s*(AM|PM)$/i.test(str)) {
            const match = str.match(/^(\\d{1,2}):(\\d{2})\\s*(AM|PM)$/i);
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
        if (/^\\d{4}$/.test(str)) {
            const hours = parseInt(str.substring(0, 2), 10);
            const minutes = parseInt(str.substring(2, 4), 10);
            if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
                return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            }
        }

        return null;
    };

    const handleAddressSelect = (address, type) => {
        if (type === 'from') {
            setShipFromAddress(address);

            // Extract timing from pickup address
            const openTime = extractOpenTime(address);
            const closeTime = extractCloseTime(address);

            // Update form context for compatibility with proper address structure
            updateFormSection('shipFrom', {
                ...address,
                addressId: address.id,
                type: 'origin'
            });

            // Update shipment info with extracted pickup times
            updateFormSection('shipmentInfo', {
                earliestPickup: openTime,
                latestPickup: closeTime
            });

        } else {
            setShipToAddress(address);

            // Extract timing from delivery address
            const openTime = extractOpenTime(address);
            const closeTime = extractCloseTime(address);

            // Update form context for compatibility with proper address structure
            updateFormSection('shipTo', {
                ...address,
                addressId: address.id,
                customerID: address.id, // Use address ID as customer reference
                type: 'destination'
            });

            // Update shipment info with extracted delivery times
            updateFormSection('shipmentInfo', {
                earliestDelivery: openTime,
                latestDelivery: closeTime
            });

            // FIXED: Don't automatically set customer from address selection in edit mode to prevent infinite loops
            // If address has customer relationship, set the selected customer (only in create mode)
            if (!isEditingDraft && !isEditingExistingShipment && address.addressClass === 'customer' && address.addressClassID) {
                console.log('🔍 Setting customer from selected address:', address.addressClassID);
                if (availableCustomers.some(c => c.id === address.addressClassID || c.customerID === address.addressClassID)) {
                    setSelectedCustomerId(address.addressClassID);
                }
            }
        }
    };

    // Comprehensive validation functions
    const validateAddress = (address, type) => {
        if (!address) return { valid: false, message: `Please select a ${type} address.` };

        const requiredFields = QUICKSHIP_VALIDATION[type].required;
        const missingFields = requiredFields.filter(field => !address[field]);

        if (missingFields.length > 0) {
            return {
                valid: false,
                message: `${type === 'shipFrom' ? 'Ship From' : 'Ship To'} address is missing: ${missingFields.join(', ')}`
            };
        }

        // Validate postal code format
        const postalCodeRegex = /^[A-Za-z]\d[A-Za-z] ?\d[A-Za-z]\d$/; // Canadian postal code
        const zipCodeRegex = /^\d{5}(-\d{4})?$/; // US zip code

        if (address.country === 'CA' && !postalCodeRegex.test(address.postalCode)) {
            return { valid: false, message: 'Invalid Canadian postal code format.' };
        }

        if (address.country === 'US' && !zipCodeRegex.test(address.postalCode)) {
            return { valid: false, message: 'Invalid US zip code format.' };
        }

        return { valid: true };
    };

    const validatePackages = () => {
        if (packages.length === 0) {
            return { valid: false, message: ERROR_MESSAGES.INVALID_PACKAGES };
        }

        if (packages.length > QUICKSHIP_VALIDATION.packages.maxCount) {
            return { valid: false, message: `Maximum ${QUICKSHIP_VALIDATION.packages.maxCount} packages allowed.` };
        }

        for (let i = 0; i < packages.length; i++) {
            const pkg = packages[i];

            // Check required fields
            if (!pkg.itemDescription || !pkg.itemDescription.trim()) {
                return { valid: false, message: `Package ${i + 1}: Description is required.` };
            }

            // Validate weight
            const weight = parseFloat(pkg.weight);
            if (isNaN(weight) || weight < QUICKSHIP_VALIDATION.packages.weightLimits.min ||
                weight > QUICKSHIP_VALIDATION.packages.weightLimits.max) {
                return { valid: false, message: `Package ${i + 1}: ${ERROR_MESSAGES.WEIGHT_LIMIT}` };
            }

            // Validate dimensions
            const dimensions = ['length', 'width', 'height'];
            for (const dim of dimensions) {
                const value = parseFloat(pkg[dim]);
                if (isNaN(value) || value < QUICKSHIP_VALIDATION.packages.dimensionLimits.min ||
                    value > QUICKSHIP_VALIDATION.packages.dimensionLimits.max) {
                    return { valid: false, message: `Package ${i + 1}: ${ERROR_MESSAGES.DIMENSION_LIMIT}` };
                }
            }

            // Validate packaging quantity
            const quantity = parseInt(pkg.packagingQuantity);
            if (isNaN(quantity) || quantity < 1 || quantity > 999) {
                return { valid: false, message: `Package ${i + 1}: Quantity must be between 1 and 999.` };
            }

            // Validate declared value (optional field)
            if (pkg.declaredValue && pkg.declaredValue !== '') {
                const declaredValue = parseFloat(pkg.declaredValue);
                if (isNaN(declaredValue) || declaredValue < 0) {
                    return { valid: false, message: `Package ${i + 1}: Declared value must be a valid positive number.` };
                }
            }
        }

        return { valid: true };
    };

    const validateRates = () => {
        // Allow booking with no rates or $0.00 rates, including tax lines with 0 amounts
        // Only validate that if a rate code is provided, it's valid
        const validChargeTypeCodes = availableChargeTypes.map(ct => ct.value);

        for (let i = 0; i < manualRates.length; i++) {
            const rate = manualRates[i];

            // Only validate the rate code if it's not empty
            if (rate.code) {
                // Check against dynamic charge types first, then fallback to validation service
                if (validChargeTypeCodes.length > 0 && !validChargeTypeCodes.includes(rate.code)) {
                    return { valid: false, message: `Rate ${i + 1}: Invalid rate code '${rate.code}'. Please select a valid code.` };
                }
            }

            // If cost or charge is provided, ensure it's a valid number (can be 0)
            // Treat empty string, null, undefined as "not provided" and accept for tax lines too
            const parseOrNull = (v) => (v === '' || v === null || v === undefined ? null : parseFloat(v));

            const parsedCost = parseOrNull(rate.cost);
            if (parsedCost !== null && (isNaN(parsedCost) || parsedCost < 0)) {
                return { valid: false, message: `Rate ${i + 1}: Cost must be a valid number (0 or greater).` };
            }

            const parsedCharge = parseOrNull(rate.charge);
            if (parsedCharge !== null && (isNaN(parsedCharge) || parsedCharge < 0)) {
                return { valid: false, message: `Rate ${i + 1}: Charge must be a valid number (0 or greater).` };
            }
        }

        // No longer require at least one rate - allow empty rates
        return { valid: true };
    };

    // Validation for booking - requires all fields
    const validateQuickShipForm = () => {
        // Clear any existing errors
        setError(null);

        // Validate carrier (required for booking)
        if (!selectedCarrier) {
            setError(ERROR_MESSAGES.MISSING_CARRIER);
            return false;
        }

        // Validate addresses
        const fromValidation = validateAddress(shipFromAddress, 'shipFrom');
        if (!fromValidation.valid) {
            setError(fromValidation.message);
            return false;
        }

        const toValidation = validateAddress(shipToAddress, 'shipTo');
        if (!toValidation.valid) {
            setError(toValidation.message);
            return false;
        }

        // Validate packages
        const packageValidation = validatePackages();
        if (!packageValidation.valid) {
            setError(packageValidation.message);
            return false;
        }

        // Validate rates
        const rateValidation = validateRates();
        if (!rateValidation.valid) {
            setError(rateValidation.message);
            return false;
        }

        // All validations passed
        return true;
    };

    // Validation for drafts - very lenient, allows saving incomplete data
    const validateQuickShipDraft = () => {
        // Clear any existing errors
        setError(null);

        console.log('📝 Draft validation started:', {
            selectedCarrier,
            hasShipFrom: !!shipFromAddress,
            hasShipTo: !!shipToAddress,
            packageCount: packages.length,
            userUid: currentUser?.uid,
            companyId: companyIdForAddress
        });

        // Check basic requirements that are absolutely necessary for saving
        if (!currentUser?.uid) {
            console.log('❌ User authentication required for draft save');
            setError('User authentication required to save draft');
            return false;
        }

        if (!companyIdForAddress) {
            console.log('❌ Company information required for draft save');
            setError('Company information required to save draft');
            return false;
        }

        // For drafts, we allow saving with minimal validation
        // Only validate addresses if they have content to validate
        if (shipFromAddress && shipFromAddress.street) {
            const fromValidation = validateAddress(shipFromAddress, 'shipFrom');
            if (!fromValidation.valid) {
                console.log('⚠️ Ship From validation warning (still allowing save):', fromValidation.message);
                // Don't fail validation for drafts - just log the warning
            }
        }

        if (shipToAddress && shipToAddress.street) {
            const toValidation = validateAddress(shipToAddress, 'shipTo');
            if (!toValidation.valid) {
                console.log('⚠️ Ship To validation warning (still allowing save):', toValidation.message);
                // Don't fail validation for drafts - just log the warning
            }
        }

        // For packages, only validate if they have weight/dimensions data
        if (packages.length > 0) {
            const packagesWithData = packages.filter(pkg => pkg.weight || pkg.length || pkg.width || pkg.height);
            if (packagesWithData.length > 0) {
                const packageValidation = validatePackages();
                if (!packageValidation.valid) {
                    console.log('⚠️ Package validation warning (still allowing save):', packageValidation.message);
                    // Don't fail validation for drafts - just log the warning
                }
            }
        }

        // For drafts, we don't require carriers, rates, or complete data
        // The goal is to save whatever progress the user has made

        console.log('✅ Draft validation passed - allowing save with minimal data');
        return true;
    };

    // Load company data when company context changes (not customer filter)
    useEffect(() => {
        // For company admins/admins/super admins, prioritize selectedCompanyId over companyIdForAddress to prevent auto switchback
        const currentCompanyId = (userRole === 'superadmin' || userRole === 'admin' || userRole === 'user' || userRole === 'company_staff') && selectedCompanyId
            ? selectedCompanyId
            : companyIdForAddress;

        console.log('🟢 useEffect: company context changed, currentCompanyId:', currentCompanyId, 'userRole:', userRole, 'selectedCompanyId:', selectedCompanyId);

        if (currentCompanyId) {
            // Load all company data (don't include selectedCustomerId in this effect to avoid loops)
            loadCustomersForCompany(currentCompanyId);
            loadCarriersForCompany(currentCompanyId);
            loadCompanyBrokers();
            // Load addresses without customer filter first
            loadAddressesForCompany(currentCompanyId, null);
        }
    }, [companyIdForAddress, selectedCompanyId, userRole]); // Don't include functions or selectedCustomerId

    // Customer filter effect - reload addresses when customer selection changes
    useEffect(() => {
        const currentCompanyId = (userRole === 'superadmin' || userRole === 'admin' || userRole === 'user' || userRole === 'company_staff') && selectedCompanyId
            ? selectedCompanyId
            : companyIdForAddress;

        if (currentCompanyId && selectedCustomerId !== undefined && selectedCustomerId !== null) {
            console.log('🎯 Customer filter changed, reloading addresses:', {
                currentCompanyId,
                selectedCustomerId,
                userRole
            });
            loadAddressesForCompany(currentCompanyId, selectedCustomerId);
        }
    }, [selectedCustomerId, loadAddressesForCompany]); // Reload when customer changes

    // Auto-select default addresses when addresses are loaded for a customer
    // This works for BOTH user interaction AND programmatic selection
    useEffect(() => {
        console.log('🔍 QuickShip: Auto-selection useEffect triggered with conditions:', {
            selectedCustomerId,
            selectedCustomerIdValid: selectedCustomerId && selectedCustomerId !== 'all' && selectedCustomerId !== null,
            availableAddressesCount: availableAddresses.length,
            hasAddresses: availableAddresses.length > 0,
            draftId,
            editMode,
            notDraft: !draftId,
            notEditMode: !editMode,
            loadingAddresses,
            allConditionsMet: selectedCustomerId && selectedCustomerId !== 'all' && selectedCustomerId !== null &&
                availableAddresses.length > 0 && !draftId && !editMode && !loadingAddresses
        });

        // Only auto-select for NEW shipments when a customer is selected and addresses are loaded
        // Works for both user interaction and programmatic customer selection
        if (selectedCustomerId && selectedCustomerId !== 'all' && selectedCustomerId !== null &&
            availableAddresses.length > 0 && !draftId && !editMode && !loadingAddresses) {

            console.log('🎯 QuickShip: Checking for default addresses...', {
                selectedCustomerId,
                availableAddressCount: availableAddresses.length,
                hasShipFrom: !!shipFromAddress,
                hasShipTo: !!shipToAddress,
                sampleAddresses: availableAddresses.slice(0, 2).map(addr => ({
                    id: addr.id,
                    isDefaultShipFrom: addr.isDefaultShipFrom,
                    isDefaultShipTo: addr.isDefaultShipTo,
                    addressClassID: addr.addressClassID
                }))
            });
            // Find default ship from address - only use explicitly marked defaults
            const defaultShipFrom = availableAddresses.find(addr => addr.isDefaultShipFrom) ||
                availableAddresses.find(addr => addr.isDefault && addr.addressType === 'pickup');

            // Find default ship to address - only use explicitly marked defaults
            const defaultShipTo = availableAddresses.find(addr => addr.isDefaultShipTo) ||
                availableAddresses.find(addr => addr.isDefault && addr.addressType === 'destination');

            console.log('🔍 QuickShip: Default address search results:', {
                defaultShipFrom: defaultShipFrom ? {
                    id: defaultShipFrom.id,
                    companyName: defaultShipFrom.companyName,
                    isDefaultShipFrom: defaultShipFrom.isDefaultShipFrom,
                    isDefault: defaultShipFrom.isDefault,
                    addressType: defaultShipFrom.addressType,
                    // Show why this address was selected
                    selectedBecause: defaultShipFrom.isDefaultShipFrom ? 'isDefaultShipFrom=true' :
                        (defaultShipFrom.isDefault && defaultShipFrom.addressType === 'pickup') ? 'isDefault=true + addressType=pickup' : 'unknown'
                } : null,
                defaultShipTo: defaultShipTo ? {
                    id: defaultShipTo.id,
                    companyName: defaultShipTo.companyName,
                    isDefaultShipTo: defaultShipTo.isDefaultShipTo,
                    isDefault: defaultShipTo.isDefault,
                    addressType: defaultShipTo.addressType,
                    // Show why this address was selected
                    selectedBecause: defaultShipTo.isDefaultShipTo ? 'isDefaultShipTo=true' :
                        (defaultShipTo.isDefault && defaultShipTo.addressType === 'destination') ? 'isDefault=true + addressType=destination' : 'unknown'
                } : null,
                // Show all addresses to see their flags
                allAddressFlags: availableAddresses.map(addr => ({
                    id: addr.id,
                    companyName: addr.companyName,
                    isDefaultShipFrom: addr.isDefaultShipFrom,
                    isDefaultShipTo: addr.isDefaultShipTo,
                    isDefault: addr.isDefault,
                    addressType: addr.addressType
                }))
            });

            // Auto-select default ship from if available and not already set
            if (defaultShipFrom && !shipFromAddress) {
                console.log('🎯 QuickShip: Auto-selecting default ship from address:', defaultShipFrom);
                handleAddressSelect(defaultShipFrom, 'from');
            }

            // Auto-select default ship to if available and not already set
            if (defaultShipTo && !shipToAddress) {
                console.log('🎯 QuickShip: Auto-selecting default ship to address:', defaultShipTo);
                handleAddressSelect(defaultShipTo, 'to');
            }
        }
    }, [selectedCustomerId, availableAddresses, shipFromAddress, shipToAddress, draftId, editMode, loadingAddresses, handleAddressSelect]);

    // Auto-select customer if there's only one available (matches CreateShipmentX logic)
    useEffect(() => {
        if (availableCustomers.length === 1 && !selectedCustomerId && !loadingCustomers) {
            const singleCustomer = availableCustomers[0];
            const customerId = singleCustomer.customerID || singleCustomer.id;
            console.log('🎯 QuickShip: Auto-selecting single customer:', {
                customer: singleCustomer.name,
                customerId,
                programmaticSelection: true
            });
            setSelectedCustomerId(customerId);

            // Update form data immediately
            updateFormSection('shipmentInfo', {
                selectedCustomerId: customerId,
                selectedCustomer: singleCustomer
            });
        }
    }, [availableCustomers, selectedCustomerId, loadingCustomers, updateFormSection]);

    // REMOVED: Customer filter effect that was causing infinite loops
    // The customer filter now works without needing to reload addresses from the server
    // since filtering happens on the client-side in the components

    // REMOVED DUPLICATE: The useEffect above already handles reloading addresses when selectedCustomerId changes
    // No need for a separate effect that does the same thing

    // Add debug log before rendering Ship From/Ship To dropdowns (commented out for performance)
    // console.log('🚚 Rendering Ship From/To dropdowns with availableAddresses:', availableAddresses);

    // Edit mode handling functions (moved here to ensure validateQuickShipForm is defined)

    // Function to handle cancelling edit changes
    const handleCancelEdit = useCallback(() => {
        if (onClose) {
            onClose();
        }
    }, [onClose]);

    // At the top of the QuickShip component, after state declarations:
    useEffect(() => {
        if (editMode && editShipment) {
            // Set shipmentID and activeDraftId to the existing shipment's Firestore doc ID
            setShipmentID(editShipment.shipmentID || editShipment.id);
            setActiveDraftId(editShipment.id);
            // Set all form state from editShipment
            if (editShipment.shipmentInfo) setShipmentInfo(editShipment.shipmentInfo);
            if (editShipment.packages) setPackages(editShipment.packages);
            if (editShipment.manualRates) setManualRates(editShipment.manualRates);
            if (editShipment.selectedCarrier) setSelectedCarrier(editShipment.selectedCarrier);
            if (editShipment.selectedCarrierContactId) setSelectedCarrierContactId(editShipment.selectedCarrierContactId);
            if (editShipment.unitSystem) setUnitSystem(editShipment.unitSystem);
            if (editShipment.shipFrom) setShipFromAddress(editShipment.shipFrom);
            if (editShipment.shipTo) setShipToAddress(editShipment.shipTo);
        }
    }, [editMode, editShipment]);

    // Patch any useEffects or logic that would create a new shipment or draft:
    useEffect(() => {
        if (editMode && editShipment) return; // Skip draft creation in edit mode
        // ... existing draft creation logic ...
    }, [/* dependencies */]);

    // Add a new handleUpdateShipment function for edit mode:
    const handleUpdateShipment = async () => {
        if (!editMode || !editShipment) return;
        setIsSavingDraft(true);
        setError(null);
        try {
            // Use appropriate validation based on shipment status
            const isBookedShipment = editShipment?.status !== 'draft';

            console.log('🔄 Edit validation debug:', {
                editShipmentStatus: editShipment?.status,
                isBookedShipment,
                selectedCarrier,
                hasCarrier: !!selectedCarrier,
                shipmentId: editShipment?.id
            });

            if (isBookedShipment) {
                // For booked shipments, require all fields
                console.log('📋 Using strict validation for booked shipment');
                if (!validateQuickShipForm()) {
                    setIsSavingDraft(false);
                    return;
                }
            } else {
                // For draft shipments, use lenient validation
                console.log('📝 Using lenient validation for draft shipment');
                if (!validateQuickShipDraft()) {
                    setIsSavingDraft(false);
                    return;
                }
            }

            // Calculate totals for proper display
            const draftTotalWeight = packages.reduce((total, pkg) => {
                const weight = parseFloat(pkg.weight || 0);
                const quantity = parseInt(pkg.packagingQuantity || 1);
                return total + (weight * quantity);
            }, 0);

            const draftTotalPieces = packages.reduce((total, pkg) => {
                return total + parseInt(pkg.packagingQuantity || 1);
            }, 0);

            const draftTotalPackageCount = packages.length;

            // Prepare updated shipment data (comprehensive to ensure all fields are saved)
            const updatedData = {
                shipmentID,
                status: editShipment.status || 'booked',
                creationMethod: 'quickship',
                companyID: companyIdForAddress,
                updatedAt: new Date(),

                // COMPREHENSIVE SHIPMENT INFO with all special services
                shipmentInfo: {
                    ...shipmentInfo,
                    unitSystem,
                    totalWeight: draftTotalWeight,
                    totalPieces: draftTotalPieces,
                    totalPackageCount: draftTotalPackageCount,
                    // Special services that might not be saved
                    serviceLevel: shipmentInfo.serviceLevel || 'any',
                    dangerousGoodsType: shipmentInfo.dangerousGoodsType || 'none',
                    signatureServiceType: shipmentInfo.signatureServiceType || 'none',
                    notes: shipmentInfo.notes || '',
                    shipperReferenceNumber: shipmentInfo.shipperReferenceNumber || '',
                    bookingReferenceNumber: shipmentInfo.bookingReferenceNumber || '',
                    bookingReferenceType: shipmentInfo.bookingReferenceType || 'PO',
                    billType: shipmentInfo.billType || 'third_party',
                    carrierTrackingNumber: shipmentInfo.carrierTrackingNumber || '',
                    // Include reference numbers array
                    referenceNumbers: shipmentInfo.referenceNumbers || []
                },

                // ADDRESSES with full data preservation
                shipFrom: shipFromAddress,
                shipTo: shipToAddress,

                // ENHANCED PACKAGES with all details
                packages: packages.map((pkg, index) => ({
                    ...pkg,
                    id: pkg.id || (index + 1),
                    packageNumber: index + 1,
                    itemDescription: pkg.itemDescription || '',
                    weight: safeParseFloat(pkg.weight, 0),
                    packagingQuantity: safeParseInt(pkg.packagingQuantity, 1),
                    totalWeight: safeParseFloat(pkg.weight, 0) * safeParseInt(pkg.packagingQuantity, 1),
                    packagingType: pkg.packagingType || 262,
                    packagingTypeName: PACKAGING_TYPES.find(pt => pt.value === pkg.packagingType)?.label || 'PACKAGE',
                    length: safeParseFloat(pkg.length, 48),
                    width: safeParseFloat(pkg.width, 40),
                    height: safeParseFloat(pkg.height, 48),
                    freightClass: pkg.freightClass || '',
                    unitSystem: pkg.unitSystem || unitSystem,
                    declaredValue: pkg.declaredValue || '',
                    declaredValueCurrency: pkg.declaredValueCurrency || 'CAD',
                    volume: safeParseFloat(pkg.length, 48) * safeParseFloat(pkg.width, 40) * safeParseFloat(pkg.height, 48),
                    dimensionsDisplay: `${pkg.length || 48} x ${pkg.width || 40} x ${pkg.height || 48} ${pkg.unitSystem === 'metric' ? 'cm' : 'in'}`
                })),

                // CARRIER INFORMATION
                selectedCarrier,
                selectedCarrierContactId,
                carrier: selectedCarrier, // Both fields for compatibility

                // COMPREHENSIVE BROKER INFORMATION - Enhanced to handle broker removal properly
                selectedBroker: selectedBroker || null,
                brokerDetails: (() => {
                    if (!selectedBroker) {
                        // EXPLICIT BROKER REMOVAL - clear all broker data
                        console.log('🏢 QUICKSHIP UPDATE: Broker removed, clearing all broker data');
                        return null;
                    }

                    const foundBroker = companyBrokers.find(b => b.name === selectedBroker);
                    if (foundBroker) {
                        return foundBroker;
                    } else {
                        // If broker not found in companyBrokers, create minimal broker object to preserve name
                        console.log('🏢 QUICKSHIP UPDATE: Broker not found in companyBrokers, creating minimal broker object:', selectedBroker);
                        return {
                            name: selectedBroker,
                            phone: '',
                            email: '',
                            brokerName: selectedBroker, // Additional fallback field
                            companyName: selectedBroker,
                            contactPerson: '',
                            address: '',
                            city: '',
                            state: '',
                            postalCode: '',
                            country: 'CA',
                            fax: ''
                        };
                    }
                })(),
                brokerPort: selectedBroker ? (brokerPort || '') : null,
                brokerReference: selectedBroker ? (brokerReference || '') : null,

                // MANUAL RATES with proper formatting
                manualRates: manualRates.map(rate => ({
                    ...rate,
                    cost: safeParseFloat(rate.cost, 0).toFixed(2),
                    charge: safeParseFloat(rate.charge, 0).toFixed(2)
                })),

                // ADDITIONAL SERVICES (this was missing in the original!)
                additionalServices: (shipmentInfo.shipmentType === 'freight' || shipmentInfo.shipmentType === 'courier') ? additionalServices : [],

                // UNIT SYSTEM AND TOTALS
                unitSystem,
                totalCost: totalCost || 0,

                // EMAIL NOTIFICATIONS
                sendEmailNotifications,

                // CUSTOMER SELECTION for recall
                customerId: selectedCustomerId || null,
                customerID: selectedCustomerId || null,

                // PRESERVE EXISTING SHIPMENT DATA
                isDraft: false,

                // TRACKING INFO
                trackingNumber: shipmentInfo.carrierTrackingNumber || editShipment?.trackingNumber || shipmentID,

                // PRESERVE OTHER FIELDS THAT MIGHT EXIST
                bookedAt: editShipment.bookedAt || new Date(),
                ...(editShipment.shipmentDocuments && { shipmentDocuments: editShipment.shipmentDocuments }),
                ...(editShipment.statusHistory && { statusHistory: editShipment.statusHistory }),
                ...(editShipment.carrierBookingConfirmation && { carrierBookingConfirmation: editShipment.carrierBookingConfirmation })
            };

            console.log('🔄 Updating shipment with comprehensive data:', {
                shipmentID,
                packagesCount: packages.length,
                manualRatesCount: manualRates.length,
                additionalServicesCount: additionalServices.length,
                brokerSelected: !!selectedBroker,
                carrierSelected: !!selectedCarrier,
                hasServiceLevel: !!shipmentInfo.serviceLevel,
                hasDangerousGoodsType: !!shipmentInfo.dangerousGoodsType,
                hasSignatureServiceType: !!shipmentInfo.signatureServiceType,
                totalWeight: draftTotalWeight,
                totalPieces: draftTotalPieces
            });

            // Update the existing shipment document
            const docRef = doc(db, 'shipments', editShipment.id);
            await updateDoc(docRef, updatedData);

            console.log('✅ Shipment updated successfully with all data');

            // Call both callbacks for shipment updates
            if (onShipmentUpdated) {
                console.log('🔄 Calling parent callback to refresh shipments table after shipment update');
                onShipmentUpdated(editShipment.id, 'Shipment updated successfully');
            }
            if (showNotification) showNotification('Shipment updated successfully!', 'success');

            setShowDraftSuccess(true);
            setTimeout(() => {
                setShowDraftSuccess(false);
                if (onClose) onClose();
                if (onReturnToShipments) onReturnToShipments();
            }, 1500);
        } catch (error) {
            console.error('❌ Error updating shipment:', error);
            setError(`Failed to update shipment: ${error.message}`);
        } finally {
            setIsSavingDraft(false);
        }
    };

    // Update shipment type options when company data changes
    useEffect(() => {
        if (companyData && companyIdForAddress) {
            updateAvailableShipmentTypes();
        }
    }, [companyData, companyIdForAddress]);

    // Load service levels on component mount and when shipment type or carrier changes
    useEffect(() => {
        console.log('🔧 QuickShip: useEffect triggered for service loading. shipmentType:', shipmentInfo.shipmentType, 'selectedCarrier:', selectedCarrier);
        console.log('🔧 QuickShip: Current shipmentInfo object:', shipmentInfo);
        if (shipmentInfo.shipmentType === 'freight' || shipmentInfo.shipmentType === 'courier') {
            console.log('🔧 QuickShip: Loading services for shipment type:', shipmentInfo.shipmentType, 'and carrier:', selectedCarrier);
            loadAdditionalServices();
            loadServiceLevels();
        } else {
            console.log('🔧 QuickShip: Clearing services for shipment type:', shipmentInfo.shipmentType);
            setAdditionalServices([]);
            setAvailableServices([]);
            setAvailableServiceLevels([]);
        }
    }, [shipmentInfo.shipmentType, companyData, companyIdForAddress, selectedCarrier]);

    // Load dynamic charge types on component mount
    useEffect(() => {
        const loadChargeTypes = async () => {
            setLoadingChargeTypes(true);
            setChargeTypesError(null);

            try {
                console.log('📦 QuickShip: Loading dynamic charge types...');
                const chargeTypes = await shipmentChargeTypeService.getChargeTypes();
                console.log(`📦 QuickShip: Loaded ${chargeTypes.length} charge types`);
                setAvailableChargeTypes(chargeTypes);
            } catch (error) {
                console.error('❌ QuickShip: Failed to load charge types:', error);
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
        console.log('🔧 QuickShip: shipmentInfo changed:', shipmentInfo);
    }, [shipmentInfo]);

    // When loading a draft, if selectedCarrier is set but selectedCarrierContactId is not, default to first terminal
    useEffect(() => {
        if (selectedCarrier && !selectedCarrierContactId) {
            const carrierObj = quickShipCarriers.find(c => c.name === selectedCarrier);
            if (carrierObj && Array.isArray(carrierObj.emailContacts) && carrierObj.emailContacts.length > 0) {
                const defaultTerminal = carrierObj.emailContacts.find(t => t.isDefault) || carrierObj.emailContacts[0];
                setSelectedCarrierContactId(defaultTerminal.id);
            }
        }
        // Only run when selectedCarrier, selectedCarrierContactId, or quickShipCarriers change
    }, [selectedCarrier, selectedCarrierContactId, quickShipCarriers]);

    // 🔧 ENHANCED: Canadian Tax Calculation - Better debugging and logic
    useEffect(() => {
        if (!availableChargeTypes || availableChargeTypes.length === 0) {
            console.log('🍁 HST: Tax calculation skipped - no charge types available', {
                chargeTypesCount: availableChargeTypes?.length || 0
            });
            return;
        }
        if (!shipFromAddress || !shipToAddress) {
            console.log('🍁 HST: Tax calculation skipped - missing addresses', {
                hasShipFrom: !!shipFromAddress,
                hasShipTo: !!shipToAddress
            });
            return;
        }

        const isCanadian = isCanadianDomesticShipment(shipFromAddress, shipToAddress);
        const province = shipToAddress?.state;

        console.log('🍁 HST: Tax calculation trigger check', {
            shipFromCountry: shipFromAddress?.country,
            shipToCountry: shipToAddress?.country,
            province: province,
            isCanadianDomestic: isCanadian,
            chargeTypesLoaded: availableChargeTypes.length,
            manualRatesCount: manualRates.length,
            isDraftLoading: isDraftLoading,
            isEditingDraft: isEditingDraft,
            // Enhanced debugging for charge types
            chargeTypesCodes: availableChargeTypes.map(ct => ct.code || ct.value).slice(0, 5), // First 5 codes
            hasTaxChargeTypes: availableChargeTypes.some(ct => {
                const code = ct.code || ct.value;
                return code && isTaxCharge(code);
            })
        });

        // Skip if not Canadian domestic
        if (!isCanadian) {
            console.log('🍁 HST: Not a Canadian domestic shipment');
            return;
        }

        // Skip if no province
        if (!province) {
            console.log('🍁 HST: No destination province for tax calculation');
            return;
        }

        // Skip if currently loading draft to avoid conflicts
        if (isDraftLoading) {
            console.log('🍁 HST: Skipping tax calculation during draft loading');
            return;
        }

        // Create shipment data structure for tax calculation
        const shipmentData = {
            shipFrom: shipFromAddress,
            shipTo: shipToAddress,
            manualRates: manualRates
        };

        // Detailed debugging before tax calculation
        console.log('🍁 HST: About to calculate taxes', {
            province: province,
            nonTaxRatesCount: manualRates.filter(r => !isTaxCharge(r.code)).length,
            existingTaxRatesCount: manualRates.filter(r => isTaxCharge(r.code)).length,
            existingTaxCodes: manualRates.filter(r => isTaxCharge(r.code)).map(r => r.code),
            taxableRates: manualRates.filter(r => !isTaxCharge(r.code)).map(r => ({
                code: r.code,
                charge: r.charge,
                cost: r.cost
            }))
        });

        // Recalculate taxes (this handles empty manual rates gracefully)
        // Ensure shipmentType is available for province-specific rules (e.g., QC freight → GST only)
        shipmentData.shipmentInfo = shipmentData.shipmentInfo || {};
        shipmentData.shipmentInfo.shipmentType = shipmentInfo?.shipmentType || shipmentData.shipmentType || 'freight';
        const updatedShipmentData = recalculateShipmentTaxes(shipmentData, availableChargeTypes);

        // Update manual rates if taxes changed
        if (JSON.stringify(updatedShipmentData.manualRates) !== JSON.stringify(manualRates)) {
            console.log('🍁 HST: Updating manual rates with calculated taxes', {
                originalCount: manualRates.length,
                updatedCount: updatedShipmentData.manualRates.length,
                newTaxRates: updatedShipmentData.manualRates.filter(r => isTaxCharge(r.code)).map(r => ({
                    code: r.code,
                    charge: r.charge,
                    chargeName: r.chargeName
                })),
                context: isEditingDraft ? 'editing-draft' : 'new-shipment'
            });
            setManualRates(updatedShipmentData.manualRates);
        } else {
            console.log('🍁 HST: No tax changes needed', {
                manualRatesCount: manualRates.length,
                existingTaxCount: manualRates.filter(r => isTaxCharge(r.code)).length
            });
        }
    }, [shipFromAddress, shipToAddress, availableChargeTypes, isDraftLoading, isEditingDraft]);

    // Additional tax calculation trigger specifically for when draft loading is complete
    useEffect(() => {
        // Only trigger when draft loading just completed
        if (isDraftLoading) return;
        if (!isEditingDraft && !editShipment) return; // Only for editing scenarios
        if (!availableChargeTypes || availableChargeTypes.length === 0) return;
        if (!shipFromAddress || !shipToAddress) return;

        // Check if this is a Canadian domestic shipment that needs taxes
        if (!isCanadianDomesticShipment(shipFromAddress, shipToAddress)) return;

        console.log('🍁 Canadian Tax: Post-draft-loading tax calculation trigger', {
            province: shipToAddress?.state,
            manualRatesCount: manualRates.length,
            isEditingDraft: isEditingDraft,
            hasEditShipment: !!editShipment
        });

        // Small delay to ensure all state is settled after draft loading
        const timeoutId = setTimeout(() => {
            const shipmentData = {
                shipFrom: shipFromAddress,
                shipTo: shipToAddress,
                manualRates: manualRates
            };

            shipmentData.shipmentInfo = shipmentData.shipmentInfo || {};
            shipmentData.shipmentInfo.shipmentType = shipmentInfo?.shipmentType || shipmentData.shipmentType || 'freight';
            const updatedShipmentData = recalculateShipmentTaxes(shipmentData, availableChargeTypes);

            if (JSON.stringify(updatedShipmentData.manualRates) !== JSON.stringify(manualRates)) {
                console.log('🍁 Canadian Tax: Applying taxes to loaded draft/shipment', {
                    originalCount: manualRates.length,
                    updatedCount: updatedShipmentData.manualRates.length
                });
                setManualRates(updatedShipmentData.manualRates);
            }
        }, 100); // Small delay to ensure state consistency

        return () => clearTimeout(timeoutId);
    }, [isDraftLoading, isEditingDraft, editShipment, availableChargeTypes, shipFromAddress, shipToAddress]);

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
                handleShipLater();
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

    // 🔧 DEBUG: HST Diagnosis Function (can be called from browser console)
    window.debugQuickShipHST = () => {
        console.log('🔧 DEBUG: QuickShip HST Diagnosis');
        console.log('===================================');

        console.log('📍 Addresses:');
        console.log('  Ship From:', {
            country: shipFromAddress?.country,
            state: shipFromAddress?.state,
            city: shipFromAddress?.city
        });
        console.log('  Ship To:', {
            country: shipToAddress?.country,
            state: shipToAddress?.state,
            city: shipToAddress?.city
        });

        console.log('🍁 Canadian Tax Check:');
        const isCanadian = shipFromAddress && shipToAddress ? isCanadianDomesticShipment(shipFromAddress, shipToAddress) : false;
        console.log('  Is Canadian Domestic:', isCanadian);
        console.log('  Destination Province:', shipToAddress?.state);

        console.log('📦 Charge Types:');
        console.log('  Available Count:', availableChargeTypes?.length || 0);
        console.log('  Has Tax Charge Types:', availableChargeTypes?.some(ct => {
            const code = ct.code || ct.value;
            return code && isTaxCharge(code);
        }));
        console.log('  Tax Charge Types:', availableChargeTypes?.filter(ct => {
            const code = ct.code || ct.value;
            return code && isTaxCharge(code);
        }).map(ct => ({
            code: ct.code || ct.value,
            name: ct.label || ct.description,
            taxable: ct.taxable
        })));

        console.log('💰 Manual Rates:');
        console.log('  Total Count:', manualRates.length);
        console.log('  Non-Tax Rates:', manualRates.filter(r => !isTaxCharge(r.code)).map(r => ({
            id: r.id,
            code: r.code,
            name: r.chargeName,
            charge: r.charge,
            cost: r.cost
        })));
        console.log('  Tax Rates:', manualRates.filter(r => isTaxCharge(r.code)).map(r => ({
            id: r.id,
            code: r.code,
            name: r.chargeName,
            charge: r.charge,
            cost: r.cost
        })));

        console.log('🔧 State Flags:');
        console.log('  isDraftLoading:', isDraftLoading);
        console.log('  isEditingDraft:', isEditingDraft);
        console.log('  loadingChargeTypes:', loadingChargeTypes);

        // Test tax calculation manually
        if (isCanadian && shipToAddress?.state && availableChargeTypes?.length > 0) {
            console.log('🧪 Manual Tax Calculation Test:');
            try {
                const testShipmentData = {
                    shipFrom: shipFromAddress,
                    shipTo: shipToAddress,
                    manualRates: manualRates
                };
                const result = recalculateShipmentTaxes(testShipmentData, availableChargeTypes);
                console.log('  Test Result:', {
                    originalRatesCount: manualRates.length,
                    resultRatesCount: result.manualRates.length,
                    newTaxRates: result.manualRates.filter(r => isTaxCharge(r.code))
                });
            } catch (error) {
                console.error('  Test Failed:', error);
            }
        }

        console.log('===================================');
        console.log('💡 To manually trigger HST calculation, add a freight charge with amount > 0');
    };

    // Calculate base tab index for each package (100 per package)
    const getPackageBaseTabIndex = (packageIndex) => 100 + (packageIndex * 100);

    // Conversion function to transform QuickShip data to CreateShipmentX format
    const convertToAdvanced = useCallback(() => {
        console.log('🔄 Converting QuickShip to CreateShipmentX format');

        const convertedData = {
            // Basic shipment information - map QuickShip format to CreateShipmentX format
            shipmentInfo: {
                shipmentType: shipmentInfo.shipmentType || 'freight',
                shipmentDate: shipmentInfo.shipmentDate || new Date().toISOString().split('T')[0],
                shipperReferenceNumber: shipmentInfo.shipperReferenceNumber || '',
                billType: shipmentInfo.billType || 'third_party',
                serviceLevel: shipmentInfo.serviceLevel || 'any',
                dangerousGoodsType: shipmentInfo.dangerousGoodsType || 'none',
                signatureServiceType: shipmentInfo.signatureServiceType || 'none',
                notes: shipmentInfo.notes || '',
                referenceNumbers: shipmentInfo.referenceNumbers || []
            },

            // Address data - direct copy since formats are compatible
            shipFromAddress: shipFromAddress,
            shipToAddress: shipToAddress,

            // Package data - transform from QuickShip to CreateShipmentX format
            packages: packages.map(pkg => ({
                id: pkg.id,
                itemDescription: pkg.itemDescription || '',
                packagingType: pkg.packagingType || 262,
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

            // Rate conversion - convert manual rates to selected rate format for CreateShipmentX
            selectedRate: (() => {
                if (manualRates && manualRates.length > 0) {
                    // Calculate totals from manual rates
                    const freightRate = manualRates.find(rate => rate.code === 'FRT') || {};
                    const fuelRate = manualRates.find(rate => rate.code === 'FUE') || {};
                    const serviceRates = manualRates.filter(rate => rate.code === 'SUR' || rate.code === 'ACC');
                    const accessorialRates = manualRates.filter(rate => rate.code === 'ACC');

                    const freightCharges = safeParseFloat(freightRate.charge, 0);
                    const fuelCharges = safeParseFloat(fuelRate.charge, 0);
                    const serviceCharges = serviceRates.reduce((sum, rate) => sum + safeParseFloat(rate.charge, 0), 0);
                    const accessorialCharges = accessorialRates.reduce((sum, rate) => sum + safeParseFloat(rate.charge, 0), 0);
                    const totalCharges = manualRates.reduce((sum, rate) => sum + safeParseFloat(rate.charge, 0), 0);

                    return {
                        carrier: {
                            name: selectedCarrier || 'Manual Entry',
                            logo: getLightBackgroundLogo(companyData) || '/images/integratedcarrriers_logo_blk.png'
                        },
                        sourceCarrierName: selectedCarrier || 'Manual Entry',
                        pricing: {
                            freight: freightCharges,
                            fuel: fuelCharges,
                            service: serviceCharges,
                            accessorial: accessorialCharges,
                            total: totalCharges,
                            currency: manualRates[0]?.chargeCurrency || 'CAD'
                        },
                        freightCharges: freightCharges,
                        fuelCharges: fuelCharges,
                        serviceCharges: serviceCharges,
                        accessorialCharges: accessorialCharges,
                        totalCharges: totalCharges,
                        serviceType: 'Manual Entry',
                        transitTime: 'N/A',
                        source: 'manual',
                        // Include billing details for better conversion
                        billingDetails: manualRates.filter(rate => rate.charge && parseFloat(rate.charge) > 0).map(rate => ({
                            name: rate.chargeName,
                            amount: parseFloat(rate.charge || 0),
                            actualAmount: parseFloat(rate.cost || rate.charge || 0),
                            category: (() => {
                                if (rate.code === 'FRT') return 'freight';
                                if (rate.code === 'FUE') return 'fuel';
                                if (rate.code === 'SUR') return 'service';
                                if (rate.code === 'ACC') return 'accessorial';
                                return 'miscellaneous';
                            })()
                        }))
                    };
                }
                return null;
            })(),

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

            // Rate source information
            rateSource: 'converted_from_manual',
            originalManualRates: manualRates // Keep original rates for reference
        };

        console.log('🔄 Converted data for CreateShipmentX:', convertedData);
        return convertedData;
    }, [shipmentInfo, shipFromAddress, shipToAddress, packages, manualRates, selectedCarrier, additionalServices, selectedBroker, brokerPort, brokerReference, shipmentID, isEditingDraft, activeDraftId]);

    // New comprehensive conversion system
    const handleConvertToAdvanced = () => {
        // Always use the simple conversion dialog
        setShowConversionDialog(true);
    };



    // Simple conversion handler
    const confirmConvertToAdvanced = async () => {
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
                    manualRates: manualRates.map(rate => ({
                        ...rate,
                        cost: parseFloat(rate.cost || 0).toFixed(2),
                        charge: parseFloat(rate.charge || 0).toFixed(2)
                    })),
                    selectedCarrier,
                    additionalServices,
                    selectedBroker,
                    brokerPort,
                    brokerReference,
                    shipmentID,
                    creationMethod: 'quickship',
                    status: 'draft',
                    lastUpdated: new Date().toISOString(),
                    selectedCustomerId: selectedCustomerId || null
                };

                // Update the draft with latest data
                const draftRef = doc(db, 'shipments', activeDraftId);

                try {
                    // Use updateDoc to update the existing draft
                    await updateDoc(draftRef, draftData);
                    console.log('✅ Draft saved/updated with latest form data before conversion');
                } catch (updateError) {
                    console.error('Error saving draft before conversion:', updateError);
                    // Show error but allow conversion to continue with existing draft data
                    showError('Warning: Could not save latest changes before conversion. Converting existing draft data.');
                }

                console.log('🔄 Converting draft in database:', activeDraftId);

                // Convert the draft in the database
                const success = await convertDraftInDatabase(activeDraftId, 'advanced');

                if (success) {
                    showSuccess('Successfully converted to Live Rates format!');

                    // Call the parent conversion handler to reload with the converted draft
                    if (onConvertToAdvanced) {
                        // Pass the draft ID so CreateShipmentX can load it
                        onConvertToAdvanced({ activeDraftId, isConversion: true });
                    }
                } else {
                    showError('Failed to convert to Live Rates format');
                }
            } else {
                // For non-draft shipments, use the old method
                const convertedData = convertToAdvanced();

                if (onConvertToAdvanced) {
                    onConvertToAdvanced(convertedData);
                }

                showSuccess('Successfully converted to Live Rates format!');
            }

        } catch (error) {
            console.error('Error converting to CreateShipmentX:', error);
            showError('Failed to convert to Live Rates format');
        } finally {
            setIsConverting(false);
        }
    };

    // Calculate customer autocomplete value to prevent re-renders
    const customerAutocompleteValue = useMemo(() => {
        // Show loading state if customers are still loading
        if (loadingCustomers && availableCustomers.length === 0) {
            return null; // This will show the loading state
        }



        // Try to find customer by customerID first, then by id
        let foundCustomer = availableCustomers.find(customer => customer.customerID === selectedCustomerId);

        if (!foundCustomer) {
            foundCustomer = availableCustomers.find(customer => customer.id === selectedCustomerId);
        }

        if (foundCustomer) {
            return foundCustomer;
        }

        // Fallback to "All Customers" if not found
        return { id: 'all', name: 'All Customers', customerID: 'all' };
    }, [selectedCustomerId, availableCustomers, loadingCustomers]);

    return (
        <Box sx={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Modal Header */}
            {isModal && (
                <ModalHeader
                    title={
                        currentView === 'addaddress'
                            ? `Add ${addressEditMode === 'from' ? 'Ship From' : 'Ship To'} Address`
                            : isEditingDraft
                                ? `Edit Quick Ship Draft${shipmentID ? ` - ${shipmentID}` : ''}`
                                : `Quick Ship${shipmentID ? ` - ${shipmentID}` : ''}`
                    }
                    onBack={currentView === 'addaddress' ? handleBackToQuickShip : undefined}
                    showBackButton={currentView === 'addaddress'}
                    onClose={onClose}
                    showCloseButton={!!onClose}
                />
            )}



            {/* Sliding Container */}
            <Box sx={{
                flex: 1,
                overflow: 'hidden',
                position: 'relative',
                width: '200%',
                display: 'flex',
                transform: currentView === 'addaddress' ? 'translateX(-50%)' : 'translateX(0%)',
                transition: 'transform 0.3s ease-in-out',
                opacity: isSliding ? 0.8 : 1,
                zIndex: currentView === 'addaddress' ? 1000 : 1200
            }}>
                {/* QuickShip Main View */}
                <Box
                    ref={mainContentRef}
                    sx={{
                        width: '50%',
                        overflow: 'auto',
                        p: 3,
                        position: 'relative',
                        zIndex: currentView === 'addaddress' ? 900 : 1100,
                        pointerEvents: currentView === 'addaddress' ? 'none' : 'auto'
                    }}
                >
                    {/* Error Display */}
                    {error && (
                        <Box ref={errorAlertRef}>
                            <Alert
                                severity="error"
                                onClose={() => {
                                    setError(null);
                                    setShowErrorSnackbar(false);
                                }}
                                sx={{
                                    mb: 3,
                                    borderRadius: 2,
                                    '& .MuiAlert-message': {
                                        fontSize: '14px'
                                    },
                                    boxShadow: 2,
                                    border: '1px solid #f87171'
                                }}
                            >
                                <AlertTitle sx={{ fontSize: '16px', fontWeight: 600 }}>
                                    Error
                                </AlertTitle>
                                {error}
                            </Alert>
                        </Box>
                    )}

                    {/* Success Message for Draft Save */}
                    {showDraftSuccess && (
                        <Alert
                            severity="success"
                            onClose={() => setShowDraftSuccess(false)}
                            sx={{
                                mb: 3,
                                borderRadius: 2,
                                '& .MuiAlert-message': {
                                    fontSize: '14px'
                                }
                            }}
                        >
                            <AlertTitle sx={{ fontSize: '16px', fontWeight: 600 }}>
                                Draft Saved Successfully
                            </AlertTitle>
                            Your shipment has been saved as a draft. You can complete it later from the Shipments page.
                        </Alert>
                    )}

                    {isDraftLoading && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                            <CircularProgress sx={{ mr: 2 }} />
                            <Typography sx={{ fontSize: '14px', color: '#6b7280' }}>
                                Loading draft shipment...
                            </Typography>
                        </Box>
                    )}

                    {draftSaved && (
                        <Alert severity="success" sx={{ mb: 3 }}>
                            {isEditingDraft ? 'Draft updated successfully!' : 'Draft saved successfully!'} Returning to shipments...
                        </Alert>
                    )}

                    {/* Company Selector for Super Admins and Admins */}
                    {(() => {
                        const shouldShowSelector = userRole === 'superadmin' || userRole === 'admin' || userRole === 'user';
                        console.log('🔍 QuickShip Company Selector Debug:', {
                            userRole,
                            companyIdForAddress,
                            selectedCompanyId,
                            needsCompanySelection,
                            shouldShowSelector
                        });
                        return shouldShowSelector;
                    })() && (
                            <CompanySelector
                                selectedCompanyId={selectedCompanyId || companyIdForAddress}
                                onCompanyChange={handleCompanySelection}
                                userRole={userRole}
                                userEmail={currentUser?.email}
                                companyData={companyData} // Pass company data for logo display
                                size="small"
                                required={true}
                                label={userRole === 'user' ? "Company Context" : "Select Company to Create QuickShip"}
                                placeholder="Choose a company to create QuickShip on their behalf..."
                                locked={userRole === 'user'} // Lock for company admins
                            />
                        )}

                    {/* Customer Selection for Super Admins, Admins, Company Admins, Company Staff, and Manufacturers - Show when company is selected and customers are loaded */}
                    {(userRole === 'superadmin' || userRole === 'admin' || userRole === 'user' || userRole === 'company_staff' || userRole === 'manufacturer') && (selectedCompanyId || companyIdForAddress) && (selectedCompanyId !== 'all' && companyIdForAddress !== 'all') && (
                        <Box sx={{ mb: 3 }}>
                            <Autocomplete
                                loading={loadingCustomers}
                                options={availableCustomers}
                                required
                                getOptionLabel={(option) => {
                                    return option.name || 'Unknown Customer';
                                }}
                                value={customerAutocompleteValue}
                                onChange={(event, newValue) => {
                                    // CRITICAL FIX: Use business customer ID for address filtering, not Firestore document ID
                                    const newCustomerId = newValue ? (newValue.customerID || newValue.id) : null;
                                    setSelectedCustomerId(newCustomerId);

                                    console.log('🎯 Customer selected:', {
                                        customer: newValue,
                                        documentId: newValue?.id,
                                        businessCustomerId: newValue?.customerID,
                                        usingForFiltering: newCustomerId
                                    });

                                    // Reset the manual clear flag when a customer is selected
                                    if (newCustomerId) {
                                        setCustomerManuallyCleared(false);
                                    }

                                    // CRITICAL: Save customer selection to form data immediately
                                    updateFormSection('shipmentInfo', {
                                        ...shipmentInfo,
                                        selectedCustomerId: newCustomerId,
                                        selectedCustomer: newValue
                                    });
                                }}
                                loadingText="Loading customers..."
                                isOptionEqualToValue={(option, value) => {
                                    // Check both possible ID fields for matching
                                    const optionCustomerId = option.customerID;
                                    const optionId = option.id;
                                    const valueCustomerId = value.customerID;
                                    const valueId = value.id;

                                    // Match if either customerID matches or id matches
                                    const isEqual = (optionCustomerId && optionCustomerId === valueCustomerId) ||
                                        (optionId && optionId === valueId) ||
                                        (optionCustomerId && optionCustomerId === valueId) ||
                                        (optionId && optionId === valueCustomerId);

                                    console.log('🔍 QuickShip isOptionEqualToValue:', {
                                        option: { id: optionId, customerID: optionCustomerId, name: option.name },
                                        value: { id: valueId, customerID: valueCustomerId, name: value.name },
                                        isEqual
                                    });
                                    return isEqual;
                                }}
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
                                            placeholder={loadingCustomers ? "Loading customers..." : "Choose a customer..."}
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
                                                endAdornment: (
                                                    <>
                                                        {loadingCustomers ? <CircularProgress color="inherit" size={20} sx={{ mr: 1 }} /> : null}
                                                        {params.InputProps.endAdornment}
                                                    </>
                                                ),
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

                    {/* Show form only when user has QuickShip permission and company context is available */}
                    {(() => {
                        const hasQuickShipPermission = hasPermission(userRole, PERMISSIONS.USE_QUICKSHIP);
                        const hasCompanyContext = (companyIdForAddress && companyIdForAddress !== 'all') || selectedCompanyId;
                        const shouldShowForm = hasQuickShipPermission && hasCompanyContext;

                        console.log('🔍 QuickShip Form Visibility Debug:', {
                            userRole,
                            companyIdForAddress,
                            selectedCompanyId,
                            hasQuickShipPermission,
                            hasCompanyContext,
                            shouldShowForm
                        });
                        return shouldShowForm;
                    })() && (
                            <form autoComplete="off" noValidate>
                                {/* Shipment Information Section */}
                                <Card sx={{ mb: 3, border: '1px solid #e5e7eb', borderRadius: 2 }}>
                                    <CardContent sx={{ p: 3 }}>
                                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px', mb: 3, color: '#374151' }}>
                                            Shipment Information
                                        </Typography>
                                        <Grid container spacing={3}>
                                            {/* Shipment Date - Full Width Top Row */}
                                            <Grid item xs={12}>
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    label="Shipment Date"
                                                    type="date"
                                                    value={shipmentInfo.shipmentDate}
                                                    onChange={(e) => setShipmentInfo(prev => ({ ...prev, shipmentDate: e.target.value }))}
                                                    required
                                                    autoComplete="off"
                                                    tabIndex={9}
                                                    onKeyDown={(e) => handleKeyDown(e, 'navigate')}
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
                                                    }}
                                                />
                                            </Grid>
                                            {/* Shipment Type and Service Level - Second Row */}
                                            <Grid item xs={12} md={6}>
                                                <FormControl fullWidth size="small">
                                                    <InputLabel sx={{ fontSize: '12px' }}>Shipment Type</InputLabel>
                                                    <Select
                                                        value={shipmentInfo.shipmentType}
                                                        onChange={(e) => setShipmentInfo(prev => ({ ...prev, shipmentType: e.target.value }))}
                                                        label="Shipment Type"
                                                        disabled={availableShipmentTypes.length === 0}
                                                        sx={{
                                                            fontSize: '12px',
                                                            '& .MuiSelect-select': { fontSize: '12px' }
                                                        }}
                                                    >
                                                        {availableShipmentTypes.includes('courier') && (
                                                            <MenuItem value="courier" sx={{ fontSize: '12px' }}>Courier</MenuItem>
                                                        )}
                                                        {availableShipmentTypes.includes('freight') && (
                                                            <MenuItem value="freight" sx={{ fontSize: '12px' }}>Freight</MenuItem>
                                                        )}
                                                    </Select>
                                                    {availableShipmentTypes.length === 0 && (
                                                        <Typography sx={{ fontSize: '11px', color: 'error.main', mt: 0.5 }}>
                                                            No shipment types available for this company
                                                        </Typography>
                                                    )}
                                                </FormControl>
                                            </Grid>
                                            <Grid item xs={12} md={6}>
                                                <Autocomplete
                                                    size="small"
                                                    options={(() => {
                                                        // If there's only one service level, don't show 'Any' option
                                                        if (availableServiceLevels.length === 1) {
                                                            return availableServiceLevels;
                                                        }
                                                        // Otherwise, include 'Any' option
                                                        return [
                                                            { code: 'any', label: 'Any', type: 'any', description: 'Any available service level' },
                                                            ...availableServiceLevels
                                                        ];
                                                    })()}
                                                    getOptionLabel={(option) => option.label || option.code}
                                                    value={(() => {
                                                        const allOptions = availableServiceLevels.length === 1
                                                            ? availableServiceLevels
                                                            : [
                                                                { code: 'any', label: 'Any', type: 'any', description: 'Any available service level' },
                                                                ...availableServiceLevels
                                                            ];
                                                        return allOptions.find(level => level.code === shipmentInfo.serviceLevel) || allOptions[0];
                                                    })()}
                                                    onChange={(event, newValue) => {
                                                        setShipmentInfo(prev => ({ ...prev, serviceLevel: newValue ? newValue.code : 'any' }));
                                                    }}
                                                    isOptionEqualToValue={(option, value) => option.code === value.code}
                                                    loading={loadingServiceLevels}
                                                    disabled={availableServiceLevels.length === 0}
                                                    renderInput={(params) => (
                                                        <TextField
                                                            {...params}
                                                            label="Service Level"
                                                            tabIndex={10}
                                                            sx={{
                                                                '& .MuiInputBase-root': { fontSize: '12px' },
                                                                '& .MuiInputLabel-root': { fontSize: '12px' }
                                                            }}
                                                            helperText={availableServiceLevels.length === 0 ? 'No service levels available for this shipment type' : ''}
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
                                            {/* Multiple Reference Numbers - Only show if user has permission */}
                                            {hasPermission(userRole, PERMISSIONS.EDIT_SHIPMENT_REFERENCES) && (
                                                <Grid item xs={12}>
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                Reference Numbers
                                                            </Typography>
                                                            <Button
                                                                size="small"
                                                                startIcon={<AddIcon />}
                                                                onClick={() => {
                                                                    setShipmentInfo(prev => ({
                                                                        ...prev,
                                                                        referenceNumbers: [...(prev.referenceNumbers || []), '']
                                                                    }));
                                                                }}
                                                                sx={{
                                                                    fontSize: '11px',
                                                                    padding: '2px 8px',
                                                                    minWidth: 'auto',
                                                                    textTransform: 'none'
                                                                }}
                                                                tabIndex={-1}
                                                            >
                                                                Add Reference
                                                            </Button>
                                                        </Box>

                                                        {/* Legacy single reference for backward compatibility */}
                                                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                                            <TextField
                                                                fullWidth
                                                                size="small"
                                                                label="Primary Reference"
                                                                value={shipmentInfo.shipperReferenceNumber}
                                                                onChange={(e) => setShipmentInfo(prev => ({ ...prev, shipperReferenceNumber: e.target.value }))}
                                                                autoComplete="off"
                                                                tabIndex={11}
                                                                onKeyDown={(e) => handleKeyDown(e, 'navigate')}
                                                                sx={{
                                                                    '& .MuiInputBase-input': {
                                                                        fontSize: '12px',
                                                                        '&::placeholder': { fontSize: '12px' }
                                                                    },
                                                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                                                }}
                                                            />
                                                        </Box>

                                                        {/* Additional reference numbers */}
                                                        {(shipmentInfo.referenceNumbers || []).map((ref, index) => (
                                                            <Box key={index} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                                                <TextField
                                                                    fullWidth
                                                                    size="small"
                                                                    label={`Reference ${index + 2}`}
                                                                    value={ref}
                                                                    onChange={(e) => {
                                                                        const newRefs = [...shipmentInfo.referenceNumbers];
                                                                        newRefs[index] = e.target.value;
                                                                        setShipmentInfo(prev => ({ ...prev, referenceNumbers: newRefs }));
                                                                    }}
                                                                    autoComplete="off"
                                                                    tabIndex={12 + index}
                                                                    onKeyDown={(e) => handleKeyDown(e, 'navigate')}
                                                                    sx={{
                                                                        '& .MuiInputBase-input': {
                                                                            fontSize: '12px',
                                                                            '&::placeholder': { fontSize: '12px' }
                                                                        },
                                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                                    }}
                                                                />
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => {
                                                                        const newRefs = shipmentInfo.referenceNumbers.filter((_, i) => i !== index);
                                                                        setShipmentInfo(prev => ({ ...prev, referenceNumbers: newRefs }));
                                                                    }}
                                                                    sx={{ padding: '4px' }}
                                                                    tabIndex={-1}
                                                                >
                                                                    <DeleteIcon sx={{ fontSize: '16px' }} />
                                                                </IconButton>
                                                            </Box>
                                                        ))}
                                                    </Box>
                                                </Grid>
                                            )}
                                            {/* Carrier Tracking Number - Only show if user has permission */}
                                            {hasPermission(userRole, PERMISSIONS.EDIT_CARRIER_TRACKING) && (
                                                <Grid item xs={12} md={6}>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        label="Carrier Tracking Number"
                                                        value={shipmentInfo.carrierTrackingNumber}
                                                        onChange={(e) => setShipmentInfo(prev => ({ ...prev, carrierTrackingNumber: e.target.value }))}
                                                        autoComplete="off"
                                                        tabIndex={20}
                                                        onKeyDown={(e) => handleKeyDown(e, 'navigate')}
                                                        sx={{
                                                            '& .MuiInputBase-input': {
                                                                fontSize: '12px',
                                                                '&::placeholder': { fontSize: '12px' }
                                                            },
                                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                                        }}
                                                    />
                                                </Grid>
                                            )}
                                            {/* Bill Type - Only show if user has permission */}
                                            {hasPermission(userRole, PERMISSIONS.VIEW_BILL_TYPE) && (
                                                <Grid item xs={12} md={6}>
                                                    <Autocomplete
                                                        size="small"
                                                        options={[
                                                            { value: 'prepaid', label: 'Prepaid (Sender Pays)' },
                                                            { value: 'collect', label: 'Collect (Receiver Pays)' },
                                                            { value: 'third_party', label: 'Third Party' }
                                                        ]}
                                                        getOptionLabel={(option) => option.label}
                                                        value={[
                                                            { value: 'prepaid', label: 'Prepaid (Sender Pays)' },
                                                            { value: 'collect', label: 'Collect (Receiver Pays)' },
                                                            { value: 'third_party', label: 'Third Party' }
                                                        ].find(option => option.value === shipmentInfo.billType)}
                                                        onChange={(event, newValue) => {
                                                            setShipmentInfo(prev => ({ ...prev, billType: newValue ? newValue.value : 'third_party' }));
                                                        }}
                                                        isOptionEqualToValue={(option, value) => option.value === value.value}
                                                        renderInput={(params) => (
                                                            <TextField
                                                                {...params}
                                                                label="Bill Type"
                                                                tabIndex={21}
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
                                            )}

                                            {/* ETA Fields - Only show if user has permission */}
                                            {hasPermission(userRole, PERMISSIONS.EDIT_ETAS) && (
                                                <>
                                                    <Grid item xs={12} md={6}>
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
                                                    <Grid item xs={12} md={6}>
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

                                {/* Enhanced Carrier Selection Section - Only show if user has permission */}
                                {hasPermission(userRole, PERMISSIONS.SELECT_QUICKSHIP_CARRIER) && (
                                    <Card sx={{ mb: 2, border: '1px solid #e0e0e0' }}>
                                        <CardContent sx={{ p: 2 }}>
                                            <Box display="flex" alignItems="center" mb={2}>
                                                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                                    Carrier Information
                                                </Typography>
                                                {selectedCarrier && selectedCarrierContactId && (
                                                    <Chip
                                                        label="Complete"
                                                        size="small"
                                                        color="success"
                                                        sx={{ ml: 2, height: '20px', fontSize: '10px' }}
                                                    />
                                                )}
                                                {!selectedCarrier && (
                                                    <Chip
                                                        label="Optional for drafts"
                                                        size="small"
                                                        color="default"
                                                        variant="outlined"
                                                        sx={{ ml: 2, height: '20px', fontSize: '10px' }}
                                                    />
                                                )}
                                            </Box>

                                            {/* Step 1: Carrier Selection */}
                                            <Box sx={{
                                                border: selectedCarrier ? '2px solid #4caf50' : '2px solid #e0e0e0',
                                                borderRadius: '8px',
                                                p: 2,
                                                mb: 2,
                                                backgroundColor: selectedCarrier ? '#f8fff8' : '#ffffff',
                                                transition: 'all 0.3s ease'
                                            }}>
                                                <Box display="flex" alignItems="center" mb={1}>
                                                    <Box sx={{
                                                        width: '24px',
                                                        height: '24px',
                                                        borderRadius: '50%',
                                                        backgroundColor: selectedCarrier ? '#4caf50' : '#e0e0e0',
                                                        color: 'white',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        fontSize: '12px',
                                                        fontWeight: 600,
                                                        mr: 1,
                                                        transition: 'all 0.3s ease'
                                                    }}>
                                                        {selectedCarrier ? '✓' : '1'}
                                                    </Box>
                                                    <Typography variant="body2" sx={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                                                        Select Carrier <span style={{ fontSize: '11px', fontWeight: 400, color: '#6b7280' }}>(Optional for drafts)</span>
                                                    </Typography>
                                                    {selectedCarrier && (
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => {
                                                                setSelectedCarrier('');
                                                                setSelectedCarrierContactId('');
                                                            }}
                                                            sx={{ ml: 'auto' }}
                                                        >
                                                            <ClearIcon sx={{ fontSize: '16px' }} />
                                                        </IconButton>
                                                    )}
                                                </Box>

                                                {/* Carrier Dropdown */}
                                                <Autocomplete
                                                    options={quickShipCarriers}
                                                    getOptionLabel={(option) => option.name || ''}
                                                    value={quickShipCarriers.find(carrier => carrier.name === selectedCarrier) || null}
                                                    onChange={(event, newValue) => {
                                                        setSelectedCarrier(newValue ? newValue.name : '');
                                                        setSelectedCarrierContactId(''); // Reset terminal selection
                                                    }}
                                                    renderInput={(params) => (
                                                        <TextField
                                                            {...params}
                                                            placeholder={selectedCarrier ? "Change carrier..." : "Choose a carrier (optional for drafts)..."}
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
                                                                {option.logo ? (
                                                                    <Avatar
                                                                        src={option.logo}
                                                                        sx={{ width: 24, height: 24, mr: 1 }}
                                                                    />
                                                                ) : (
                                                                    <Avatar sx={{ width: 24, height: 24, mr: 1, fontSize: '10px' }}>
                                                                        {option.name?.charAt(0)}
                                                                    </Avatar>
                                                                )}
                                                                <Box flex={1}>
                                                                    <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                                        {option.name}
                                                                    </Typography>
                                                                    {option.contactEmail && (
                                                                        <Typography variant="caption" sx={{ fontSize: '10px', color: '#666' }}>
                                                                            {option.contactEmail}
                                                                        </Typography>
                                                                    )}
                                                                </Box>

                                                            </Box>
                                                        </Box>
                                                    )}
                                                    sx={{ width: '100%' }}
                                                />

                                                {/* Carrier Action Buttons */}
                                                <Box sx={{ mt: 1, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                                    {/* Edit Selected Carrier Button - Only show when carrier is selected */}
                                                    {selectedCarrier && (
                                                        <Button
                                                            variant="outlined"
                                                            size="small"
                                                            startIcon={<EditIcon />}
                                                            onClick={() => {
                                                                console.log('✏️ EDIT BUTTON CLICKED! Selected carrier:', selectedCarrier);
                                                                const carrierToEdit = quickShipCarriers.find(c => c.name === selectedCarrier);
                                                                console.log('✏️ Found carrier data:', carrierToEdit);
                                                                if (carrierToEdit) {
                                                                    handleEditCarrier(carrierToEdit);
                                                                }
                                                            }}
                                                            sx={{
                                                                fontSize: '11px',
                                                                borderColor: '#2196f3',
                                                                color: '#2196f3',
                                                                '&:hover': {
                                                                    borderColor: '#1976d2',
                                                                    backgroundColor: '#f3f8ff'
                                                                }
                                                            }}
                                                        >
                                                            Edit Carrier
                                                        </Button>
                                                    )}

                                                    {/* Add New Carrier Button */}
                                                    <Button
                                                        variant="outlined"
                                                        size="small"
                                                        startIcon={<AddIcon />}
                                                        onClick={handleAddCarrier}
                                                        tabIndex={-1}
                                                        sx={{
                                                            fontSize: '11px',
                                                            borderColor: '#e0e0e0',
                                                            color: '#666'
                                                        }}
                                                    >
                                                        Add New Carrier
                                                    </Button>
                                                </Box>
                                            </Box>

                                            {/* Step 2: Terminal Selection - Only show when carrier is selected */}
                                            {selectedCarrier && (
                                                <Collapse in={Boolean(selectedCarrier)} timeout={300}>
                                                    <Box sx={{
                                                        border: selectedCarrierContactId ? '2px solid #4caf50' : '2px solid #2196f3',
                                                        borderRadius: '8px',
                                                        p: 2,
                                                        backgroundColor: selectedCarrierContactId ? '#f8fff8' : '#f3f8ff',
                                                        transition: 'all 0.3s ease'
                                                    }}>
                                                        <Box display="flex" alignItems="center" mb={1}>
                                                            <Box sx={{
                                                                width: '24px',
                                                                height: '24px',
                                                                borderRadius: '50%',
                                                                backgroundColor: selectedCarrierContactId ? '#4caf50' : '#2196f3',
                                                                color: 'white',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontSize: '12px',
                                                                fontWeight: 600,
                                                                mr: 1,
                                                                transition: 'all 0.3s ease'
                                                            }}>
                                                                {selectedCarrierContactId ? '✓' : '2'}
                                                            </Box>
                                                            <Typography variant="body2" sx={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                                                                Select Terminal & Contact
                                                            </Typography>
                                                            {selectedCarrierContactId && (
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => setSelectedCarrierContactId('')}
                                                                    sx={{ ml: 'auto' }}
                                                                >
                                                                    <ClearIcon sx={{ fontSize: '16px' }} />
                                                                </IconButton>
                                                            )}
                                                        </Box>

                                                        {/* Enhanced Email Contact Selector */}
                                                        {(() => {
                                                            const selectedCarrierData = quickShipCarriers.find(c => c.name === selectedCarrier);
                                                            console.log('🔍 Selected carrier for email dropdown:', {
                                                                selectedCarrier,
                                                                carrierData: selectedCarrierData,
                                                                emailContacts: selectedCarrierData?.emailContacts,
                                                                hasEmailContacts: Boolean(selectedCarrierData?.emailContacts)
                                                            });

                                                            if (!selectedCarrierData?.emailContacts || !Array.isArray(selectedCarrierData.emailContacts)) {
                                                                return (
                                                                    <Box sx={{
                                                                        p: 2,
                                                                        border: '1px dashed #e0e0e0',
                                                                        borderRadius: 1,
                                                                        textAlign: 'center',
                                                                        backgroundColor: '#fafafa'
                                                                    }}>
                                                                        <Typography sx={{ fontSize: '12px', color: '#666', mb: 1 }}>
                                                                            📧 No email contacts configured for this carrier
                                                                        </Typography>
                                                                        <Button
                                                                            size="small"
                                                                            variant="outlined"
                                                                            startIcon={<EditIcon />}
                                                                            onClick={() => handleEditCarrier(selectedCarrierData)}
                                                                            sx={{ fontSize: '11px' }}
                                                                        >
                                                                            Configure Email Contacts
                                                                        </Button>
                                                                    </Box>
                                                                );
                                                            }

                                                            return (
                                                                <EmailSelectorDropdown
                                                                    key={`${selectedCarrierData.id}-${selectedCarrierData.emailContacts?.length || 0}-${selectedCarrierData.updatedAt || Date.now()}`}
                                                                    carrier={selectedCarrierData}
                                                                    value={selectedCarrierContactId}
                                                                    onChange={(terminalId, terminalData) => {
                                                                        console.log('📧 Terminal selected:', { terminalId, terminalData });
                                                                        setSelectedCarrierContactId(terminalId);
                                                                    }}
                                                                    label="Select Terminal"
                                                                    size="small"
                                                                    fullWidth={true}
                                                                />
                                                            );
                                                        })()}


                                                    </Box>
                                                </Collapse>
                                            )}

                                            {/* Progress Indicator */}
                                            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                                                <Box display="flex" alignItems="center" justifyContent="space-between">
                                                    <Typography variant="caption" sx={{ fontSize: '10px', color: '#666' }}>
                                                        {!selectedCarrier ? 'Step 1 of 2: Select your carrier' :
                                                            !selectedCarrierContactId ? 'Step 2 of 2: Choose terminal and contact' :
                                                                'Carrier configuration complete ✓'}
                                                    </Typography>
                                                    <Box display="flex" gap={0.5}>
                                                        <Box sx={{
                                                            width: '8px',
                                                            height: '8px',
                                                            borderRadius: '50%',
                                                            backgroundColor: selectedCarrier ? '#4caf50' : '#e0e0e0',
                                                            transition: 'all 0.3s ease'
                                                        }} />
                                                        <Box sx={{
                                                            width: '8px',
                                                            height: '8px',
                                                            borderRadius: '50%',
                                                            backgroundColor: selectedCarrierContactId ? '#4caf50' : (selectedCarrier ? '#2196f3' : '#e0e0e0'),
                                                            transition: 'all 0.3s ease'
                                                        }} />
                                                    </Box>
                                                </Box>
                                            </Box>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Ship From Section - Only show if user has permission */}
                                {hasPermission(userRole, PERMISSIONS.SELECT_SHIP_FROM) && (
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

                                            {!shipFromAddress ? (
                                                <Autocomplete
                                                    fullWidth
                                                    options={hasPermission(userRole, PERMISSIONS.VIEW_SHIPFROM_ADDRESSES) ? availableAddresses : []}
                                                    getOptionLabel={(option) => `${option.companyName} - ${formatAddressForDisplay(option)}`}
                                                    value={shipFromAddress}
                                                    onChange={(event, newValue) => handleAddressSelect(newValue, 'from')}
                                                    loading={loadingAddresses}
                                                    disabled={currentView === 'addaddress'}
                                                    renderInput={(params) => (
                                                        <TextField
                                                            {...params}
                                                            label="Select Ship From Address"
                                                            placeholder={hasPermission(userRole, PERMISSIONS.VIEW_SHIPFROM_ADDRESSES) ? "Search addresses..." : "Create new address only"}
                                                            size="small"
                                                            required
                                                            disabled={currentView === 'addaddress'}
                                                            autoComplete="off"
                                                            sx={{
                                                                '& .MuiInputBase-input': { fontSize: '12px' },
                                                                '& .MuiInputLabel-root': { fontSize: '12px' }
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
                                                        },
                                                        '& .MuiAutocomplete-listbox': {
                                                            '& .MuiAutocomplete-option': {
                                                                textAlign: 'left !important',
                                                                justifyContent: 'flex-start !important',
                                                                alignItems: 'flex-start !important'
                                                            }
                                                        },
                                                        '& .MuiAutocomplete-popper': {
                                                            zIndex: currentView === 'addaddress' ? 800 : 1200,
                                                            display: currentView === 'addaddress' ? 'none' : 'block'
                                                        }
                                                    }}
                                                    ListboxProps={{
                                                        sx: {
                                                            '& .MuiAutocomplete-option': {
                                                                textAlign: 'left !important',
                                                                justifyContent: 'flex-start !important',
                                                                alignItems: 'flex-start !important'
                                                            }
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                <Box sx={{
                                                    p: 2,
                                                    bgcolor: '#f0f9ff',
                                                    borderRadius: 2,
                                                    border: '1px solid #bae6fd',
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: 2,
                                                    position: 'relative'
                                                }}>
                                                    {/* Action Buttons - Top Right */}
                                                    <Box sx={{
                                                        position: 'absolute',
                                                        top: 8,
                                                        right: 8,
                                                        display: 'flex',
                                                        gap: 1,
                                                        zIndex: 10
                                                    }}>
                                                        {/* Edit Button - FIRST */}
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleOpenEditAddress('from')}
                                                            sx={{
                                                                bgcolor: 'rgba(255,255,255,0.95)',
                                                                border: '1px solid #bae6fd',
                                                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                                                '&:hover': {
                                                                    bgcolor: 'white',
                                                                    borderColor: '#6366f1',
                                                                    boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
                                                                },
                                                                width: 28,
                                                                height: 28
                                                            }}
                                                        >
                                                            <EditIcon sx={{ fontSize: 14, color: '#6366f1' }} />
                                                        </IconButton>

                                                        {/* Change Address Button */}
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => {
                                                                console.log('Change Ship From address clicked');

                                                                // 🔧 SMART CUSTOMER EXTRACTION: Get BUSINESS customer ID from address data (ignore selectedCustomerId if it's a Firestore ID)
                                                                let customerContext = selectedCustomerId;

                                                                // CRITICAL: If selectedCustomerId looks like a Firestore document ID, extract business ID from address
                                                                const isFirestoreId = customerContext && customerContext.length > 15 && !customerContext.includes('-');

                                                                if (!customerContext || customerContext === 'all' || isFirestoreId) {
                                                                    // Priority 1: Use addressClassID if it's a customer address (business customer ID)
                                                                    if (shipFromAddress?.addressClassID && shipFromAddress?.addressClass === 'customer') {
                                                                        customerContext = shipFromAddress.addressClassID;
                                                                    }
                                                                    // Priority 2: Use customerID field (business customer ID)
                                                                    else if (shipFromAddress?.customerID) {
                                                                        customerContext = shipFromAddress.customerID;
                                                                    }
                                                                    // Priority 3: Extract business customer ID from shipment data
                                                                    else if (editShipment?.shipTo?.customer?.customerID) {
                                                                        customerContext = editShipment.shipTo.customer.customerID;
                                                                    }
                                                                    // Priority 4: Try other shipment customer fields (business IDs)
                                                                    else if (editShipment?.customerID && editShipment.customerID !== editShipment.customerId) {
                                                                        customerContext = editShipment.customerID; // Business customer ID
                                                                    }
                                                                    // Default: Show all company addresses
                                                                    else {
                                                                        customerContext = 'all';
                                                                    }
                                                                }

                                                                console.log('🔍 Customer extraction process for ShipFrom:', {
                                                                    originalSelectedCustomerId: selectedCustomerId,
                                                                    shipFromAddress: {
                                                                        addressClassID: shipFromAddress?.addressClassID,
                                                                        addressClass: shipFromAddress?.addressClass,
                                                                        customerID: shipFromAddress?.customerID
                                                                    },
                                                                    editShipment: {
                                                                        customerID: editShipment?.customerID,
                                                                        customerId: editShipment?.customerId,
                                                                        shipToCustomerID: editShipment?.shipTo?.customer?.customerID
                                                                    },
                                                                    finalCustomerContext: customerContext
                                                                });

                                                                setShipFromAddress(null);

                                                                // Refresh addresses with the determined customer context
                                                                const currentCompanyId = (userRole === 'superadmin' || userRole === 'admin' || userRole === 'user' || userRole === 'company_staff') && selectedCompanyId
                                                                    ? selectedCompanyId
                                                                    : companyIdForAddress;
                                                                if (currentCompanyId) {
                                                                    console.log('🔄 Refreshing addresses after clearing ShipFrom:', {
                                                                        currentCompanyId,
                                                                        customerContext,
                                                                        shouldFindAddressesFor: customerContext === 'all' ? 'ALL company addresses' : `Customer: ${customerContext}`
                                                                    });
                                                                    loadAddressesForCompany(currentCompanyId, customerContext);
                                                                }
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

                                                        {/* View in Maps Button */}
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleOpenInMaps(shipFromAddress)}
                                                            sx={{
                                                                bgcolor: 'rgba(255, 255, 255, 0.95)',
                                                                border: '1px solid #bae6fd',
                                                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                                                '&:hover': {
                                                                    bgcolor: 'white',
                                                                    borderColor: '#10b981',
                                                                    boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
                                                                },
                                                                width: 28,
                                                                height: 28
                                                            }}
                                                        >
                                                            <MapIcon sx={{ fontSize: 14, color: '#10b981' }} />
                                                        </IconButton>
                                                    </Box>

                                                    {/* Address Icon */}
                                                    <Box sx={{
                                                        width: 50,
                                                        height: 50,
                                                        borderRadius: 2,
                                                        overflow: 'hidden',
                                                        border: '2px solid #10b981',
                                                        bgcolor: 'white',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0
                                                    }}>
                                                        <LocationOnIcon sx={{ fontSize: 28, color: '#10b981' }} />
                                                    </Box>

                                                    {/* Address Details */}
                                                    <Box sx={{ flex: 1, pr: 4 }}>
                                                        {/* Company Name & Nickname */}
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                                            <Typography variant="body2" sx={{ fontSize: '14px', color: '#374151', fontWeight: 600 }}>
                                                                {shipFromAddress.companyName}
                                                            </Typography>
                                                            {shipFromAddress.nickname && (
                                                                <Chip
                                                                    label={shipFromAddress.nickname}
                                                                    size="small"
                                                                    sx={{
                                                                        fontSize: '10px',
                                                                        height: 18,
                                                                        bgcolor: '#0ea5e9',
                                                                        color: 'white'
                                                                    }}
                                                                />
                                                            )}
                                                        </Box>

                                                        {/* Address Information - Organized Layout */}
                                                        <Grid container spacing={1} sx={{ mb: 1 }}>
                                                            {/* Full Address */}
                                                            <Grid item xs={12}>
                                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#374151', fontWeight: 500 }}>
                                                                    {shipFromAddress.street}
                                                                    {shipFromAddress.street2 && `, ${shipFromAddress.street2}`}
                                                                </Typography>
                                                            </Grid>

                                                            {/* City, State/Province, Postal Code, Country */}
                                                            <Grid item xs={12}>
                                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#374151' }}>
                                                                    {shipFromAddress.city}, {shipFromAddress.state} {shipFromAddress.postalCode}
                                                                    {shipFromAddress.country && (
                                                                        <Chip
                                                                            label={shipFromAddress.country === 'CA' ? 'Canada' : shipFromAddress.country === 'US' ? 'United States' : shipFromAddress.country}
                                                                            size="small"
                                                                            variant="outlined"
                                                                            sx={{
                                                                                fontSize: '10px',
                                                                                height: 16,
                                                                                ml: 1,
                                                                                color: '#6b7280',
                                                                                borderColor: '#d1d5db'
                                                                            }}
                                                                        />
                                                                    )}
                                                                </Typography>
                                                            </Grid>
                                                        </Grid>

                                                        {/* Contact Information */}
                                                        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 1 }}>
                                                            {(shipFromAddress.firstName || shipFromAddress.lastName) && (
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                    <PersonIcon sx={{ fontSize: 12, color: '#6b7280' }} />
                                                                    <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                        {`${shipFromAddress.firstName || ''} ${shipFromAddress.lastName || ''}`.trim()}
                                                                    </Typography>
                                                                </Box>
                                                            )}
                                                            {shipFromAddress.phone && (
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                    <PhoneIcon sx={{ fontSize: 12, color: '#6b7280' }} />
                                                                    <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                        {shipFromAddress.phone}
                                                                    </Typography>
                                                                </Box>
                                                            )}
                                                            {shipFromAddress.email && (
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                    <EmailIcon sx={{ fontSize: 12, color: '#6b7280' }} />
                                                                    <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                        {shipFromAddress.email}
                                                                    </Typography>
                                                                </Box>
                                                            )}
                                                        </Box>

                                                        {/* Special Instructions */}
                                                        {shipFromAddress.specialInstructions && (
                                                            <Box sx={{ mt: 1, p: 1, bgcolor: '#f9fafb', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                                                                <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                                                                    {shipFromAddress.specialInstructions}
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                    </Box>
                                                </Box>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Ship To Section - Only show if user has permission */}
                                {hasPermission(userRole, PERMISSIONS.SELECT_SHIP_TO) && (
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

                                            {!shipToAddress ? (
                                                <Autocomplete
                                                    fullWidth
                                                    options={hasPermission(userRole, PERMISSIONS.VIEW_SHIPTO_ADDRESSES) ? availableAddresses : []}
                                                    getOptionLabel={(option) => `${option.companyName} - ${formatAddressForDisplay(option)}`}
                                                    value={shipToAddress}
                                                    onChange={(event, newValue) => handleAddressSelect(newValue, 'to')}
                                                    loading={loadingAddresses}
                                                    disabled={currentView === 'addaddress'}
                                                    renderInput={(params) => (
                                                        <TextField
                                                            {...params}
                                                            label="Select Ship To Address"
                                                            placeholder={hasPermission(userRole, PERMISSIONS.VIEW_SHIPTO_ADDRESSES) ? "Search addresses..." : "Create new address only"}
                                                            size="small"
                                                            required
                                                            disabled={currentView === 'addaddress'}
                                                            autoComplete="off"
                                                            sx={{
                                                                '& .MuiInputBase-input': { fontSize: '12px' },
                                                                '& .MuiInputLabel-root': { fontSize: '12px' }
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
                                                        },
                                                        '& .MuiAutocomplete-listbox': {
                                                            '& .MuiAutocomplete-option': {
                                                                textAlign: 'left !important',
                                                                justifyContent: 'flex-start !important',
                                                                alignItems: 'flex-start !important'
                                                            }
                                                        },
                                                        '& .MuiAutocomplete-popper': {
                                                            zIndex: currentView === 'addaddress' ? 800 : 1200,
                                                            display: currentView === 'addaddress' ? 'none' : 'block'
                                                        }
                                                    }}
                                                    ListboxProps={{
                                                        sx: {
                                                            '& .MuiAutocomplete-option': {
                                                                textAlign: 'left !important',
                                                                justifyContent: 'flex-start !important',
                                                                alignItems: 'flex-start !important'
                                                            }
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                <Box sx={{
                                                    p: 2,
                                                    bgcolor: '#f0f9ff',
                                                    borderRadius: 2,
                                                    border: '1px solid #bae6fd',
                                                    display: 'flex',
                                                    alignItems: 'flex-start',
                                                    gap: 2,
                                                    position: 'relative'
                                                }}>
                                                    {/* Action Buttons - Top Right */}
                                                    <Box sx={{
                                                        position: 'absolute',
                                                        top: 8,
                                                        right: 8,
                                                        display: 'flex',
                                                        gap: 1,
                                                        zIndex: 10
                                                    }}>
                                                        {/* Edit Button - FIRST */}
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleOpenEditAddress('to')}
                                                            sx={{
                                                                bgcolor: 'rgba(255,255,255,0.95)',
                                                                border: '1px solid #bae6fd',
                                                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                                                '&:hover': {
                                                                    bgcolor: 'white',
                                                                    borderColor: '#6366f1',
                                                                    boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
                                                                },
                                                                width: 28,
                                                                height: 28
                                                            }}
                                                        >
                                                            <EditIcon sx={{ fontSize: 14, color: '#6366f1' }} />
                                                        </IconButton>

                                                        {/* Change Address Button */}
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => {
                                                                console.log('Change Ship To address clicked');

                                                                // 🔧 SMART CUSTOMER EXTRACTION: Get BUSINESS customer ID from address data (ignore selectedCustomerId if it's a Firestore ID)
                                                                let customerContext = selectedCustomerId;

                                                                // CRITICAL: If selectedCustomerId looks like a Firestore document ID, extract business ID from address
                                                                const isFirestoreId = customerContext && customerContext.length > 15 && !customerContext.includes('-');

                                                                if (!customerContext || customerContext === 'all' || isFirestoreId) {
                                                                    // Priority 1: Use addressClassID if it's a customer address (business customer ID)
                                                                    if (shipToAddress?.addressClassID && shipToAddress?.addressClass === 'customer') {
                                                                        customerContext = shipToAddress.addressClassID;
                                                                    }
                                                                    // Priority 2: Use customerID field (business customer ID)
                                                                    else if (shipToAddress?.customerID) {
                                                                        customerContext = shipToAddress.customerID;
                                                                    }
                                                                    // Priority 3: Extract business customer ID from shipment data
                                                                    else if (editShipment?.shipTo?.customer?.customerID) {
                                                                        customerContext = editShipment.shipTo.customer.customerID;
                                                                    }
                                                                    // Priority 4: Try other shipment customer fields (business IDs)
                                                                    else if (editShipment?.customerID && editShipment.customerID !== editShipment.customerId) {
                                                                        customerContext = editShipment.customerID; // Business customer ID
                                                                    }
                                                                    // Default: Show all company addresses
                                                                    else {
                                                                        customerContext = 'all';
                                                                    }
                                                                }

                                                                setShipToAddress(null);

                                                                // Refresh addresses with the determined customer context
                                                                const currentCompanyId = (userRole === 'superadmin' || userRole === 'admin' || userRole === 'user' || userRole === 'company_staff') && selectedCompanyId
                                                                    ? selectedCompanyId
                                                                    : companyIdForAddress;
                                                                if (currentCompanyId) {
                                                                    console.log('🔄 Refreshing addresses after clearing ShipTo:', {
                                                                        currentCompanyId,
                                                                        customerContext,
                                                                        originalSelectedCustomerId: selectedCustomerId,
                                                                        shipToCustomer: shipToAddress?.customerID || shipToAddress?.addressClassID,
                                                                        editShipmentCustomer: editShipment?.customerId || editShipment?.customerID
                                                                    });
                                                                    loadAddressesForCompany(currentCompanyId, customerContext);
                                                                }
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

                                                        {/* View in Maps Button */}
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleOpenInMaps(shipToAddress)}
                                                            sx={{
                                                                bgcolor: 'rgba(255, 255, 255, 0.95)',
                                                                border: '1px solid #bae6fd',
                                                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                                                '&:hover': {
                                                                    bgcolor: 'white',
                                                                    borderColor: '#ef4444',
                                                                    boxShadow: '0 4px 8px rgba(0,0,0,0.15)'
                                                                },
                                                                width: 28,
                                                                height: 28
                                                            }}
                                                        >
                                                            <MapIcon sx={{ fontSize: 14, color: '#ef4444' }} />
                                                        </IconButton>
                                                    </Box>

                                                    {/* Address Icon */}
                                                    <Box sx={{
                                                        width: 50,
                                                        height: 50,
                                                        borderRadius: 2,
                                                        overflow: 'hidden',
                                                        border: '2px solid #ef4444',
                                                        bgcolor: 'white',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0
                                                    }}>
                                                        <FlagIcon sx={{ fontSize: 28, color: '#ef4444' }} />
                                                    </Box>

                                                    {/* Address Details */}
                                                    <Box sx={{ flex: 1, pr: 4 }}>
                                                        {/* Company Name & Nickname */}
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                                                            <Typography variant="body2" sx={{ fontSize: '14px', color: '#374151', fontWeight: 600 }}>
                                                                {shipToAddress.companyName}
                                                            </Typography>
                                                            {shipToAddress.nickname && (
                                                                <Chip
                                                                    label={shipToAddress.nickname}
                                                                    size="small"
                                                                    sx={{
                                                                        fontSize: '10px',
                                                                        height: 18,
                                                                        bgcolor: '#0ea5e9',
                                                                        color: 'white'
                                                                    }}
                                                                />
                                                            )}
                                                        </Box>

                                                        {/* Address Information - Organized Layout */}
                                                        <Grid container spacing={1} sx={{ mb: 1 }}>
                                                            {/* Full Address */}
                                                            <Grid item xs={12}>
                                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#374151', fontWeight: 500 }}>
                                                                    {shipToAddress.street}
                                                                    {shipToAddress.street2 && `, ${shipToAddress.street2}`}
                                                                </Typography>
                                                            </Grid>

                                                            {/* City, State/Province, Postal Code, Country */}
                                                            <Grid item xs={12}>
                                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#374151' }}>
                                                                    {shipToAddress.city}, {shipToAddress.state} {shipToAddress.postalCode}
                                                                    {shipToAddress.country && (
                                                                        <Chip
                                                                            label={shipToAddress.country === 'CA' ? 'Canada' : shipToAddress.country === 'US' ? 'United States' : shipToAddress.country}
                                                                            size="small"
                                                                            variant="outlined"
                                                                            sx={{
                                                                                fontSize: '10px',
                                                                                height: 16,
                                                                                ml: 1,
                                                                                color: '#6b7280',
                                                                                borderColor: '#d1d5db'
                                                                            }}
                                                                        />
                                                                    )}
                                                                </Typography>
                                                            </Grid>
                                                        </Grid>

                                                        {/* Contact Information */}
                                                        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap', mb: 1 }}>
                                                            {(shipToAddress.firstName || shipToAddress.lastName) && (
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                    <PersonIcon sx={{ fontSize: 12, color: '#6b7280' }} />
                                                                    <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                        {`${shipToAddress.firstName || ''} ${shipToAddress.lastName || ''}`.trim()}
                                                                    </Typography>
                                                                </Box>
                                                            )}
                                                            {shipToAddress.phone && (
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                    <PhoneIcon sx={{ fontSize: 12, color: '#6b7280' }} />
                                                                    <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                        {shipToAddress.phone}
                                                                    </Typography>
                                                                </Box>
                                                            )}
                                                            {shipToAddress.email && (
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                    <EmailIcon sx={{ fontSize: 12, color: '#6b7280' }} />
                                                                    <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                        {shipToAddress.email}
                                                                    </Typography>
                                                                </Box>
                                                            )}
                                                        </Box>

                                                        {/* Special Instructions */}
                                                        {shipToAddress.specialInstructions && (
                                                            <Box sx={{ mt: 1, p: 1, bgcolor: '#f9fafb', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                                                                <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                                                                    {shipToAddress.specialInstructions}
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                    </Box>
                                                </Box>
                                            )}
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Packages Section */}
                                <Card sx={{ mb: 3, border: '1px solid #e5e7eb', borderRadius: 2 }}>
                                    <CardContent sx={{ p: 3 }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                                    Package Information
                                                </Typography>

                                                {/* Global Unit System Toggle */}
                                                <Box sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1,
                                                    px: 2,
                                                    py: 1,
                                                    bgcolor: '#f8fafc',
                                                    borderRadius: 2,
                                                    border: '1px solid #e5e7eb'
                                                }}>
                                                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', fontWeight: 500 }}>
                                                        Units:
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ fontSize: '12px', color: unitSystem === 'imperial' ? '#374151' : '#9ca3af' }}>
                                                        Imperial
                                                    </Typography>
                                                    <Switch
                                                        checked={unitSystem === 'metric'}
                                                        onChange={(e) => handleGlobalUnitSystemChange(e.target.checked ? 'metric' : 'imperial')}
                                                        size="small"
                                                        sx={{
                                                            '& .MuiSwitch-switchBase.Mui-checked': {
                                                                color: '#7c3aed',
                                                                '&:hover': { backgroundColor: 'rgba(124, 58, 237, 0.04)' }
                                                            },
                                                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                                                backgroundColor: '#7c3aed'
                                                            }
                                                        }}
                                                    />
                                                    <Typography variant="body2" sx={{ fontSize: '12px', color: unitSystem === 'metric' ? '#374151' : '#9ca3af' }}>
                                                        Metric
                                                    </Typography>
                                                </Box>
                                            </Box>

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

                                        {packages.map((pkg, index) => {
                                            console.log(`Rendering package ${index + 1}:`, pkg);
                                            return (
                                                <Box
                                                    key={`${pkg.id}-${isEditingDraft ? shipmentID : 'new'}`}
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
                                                                autoComplete="off"
                                                                tabIndex={getPackageBaseTabIndex(index) + 1}
                                                                onKeyDown={(e) => handleKeyDown(e, 'navigate')}
                                                                placeholder="e.g., Electronic equipment, Medical supplies"
                                                                sx={{
                                                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                                                }}
                                                            />
                                                        </Grid>

                                                        {/* Packaging Type */}
                                                        <Grid item xs={12} md={4}>
                                                            <Autocomplete
                                                                size="small"
                                                                options={PACKAGING_TYPES}
                                                                getOptionLabel={(option) => option.label}
                                                                value={PACKAGING_TYPES.find(type => type.value === pkg.packagingType) || PACKAGING_TYPES.find(type => type.value === 258)}
                                                                onChange={(event, newValue) => {
                                                                    updatePackage(pkg.id, 'packagingType', newValue ? newValue.value : 258);
                                                                }}
                                                                isOptionEqualToValue={(option, value) => option.value === value.value}
                                                                renderInput={(params) => (
                                                                    <TextField
                                                                        {...params}
                                                                        label="Packaging Type"
                                                                        required
                                                                        tabIndex={getPackageBaseTabIndex(index) + 2}
                                                                        onKeyDown={(e) => handleKeyDown(e, 'navigate')}
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
                                                                    '& .MuiAutocomplete-input': { fontSize: '12px' }
                                                                }}
                                                            />
                                                        </Grid>

                                                        <Grid item xs={12} md={3}>
                                                            <TextField
                                                                fullWidth
                                                                size="small"
                                                                label="Qty"
                                                                type="number"
                                                                value={pkg.packagingQuantity || ''}
                                                                onChange={(e) => {
                                                                    const inputValue = e.target.value;
                                                                    // Allow empty string while typing
                                                                    if (inputValue === '') {
                                                                        updatePackage(pkg.id, 'packagingQuantity', '');
                                                                    } else {
                                                                        const value = Math.max(1, parseInt(inputValue) || 1);
                                                                        updatePackage(pkg.id, 'packagingQuantity', value);
                                                                    }
                                                                }}
                                                                onBlur={(e) => {
                                                                    // On blur, ensure we have at least 1
                                                                    const value = parseInt(e.target.value) || 1;
                                                                    updatePackage(pkg.id, 'packagingQuantity', Math.max(1, value));
                                                                }}
                                                                required
                                                                autoComplete="off"
                                                                tabIndex={getPackageBaseTabIndex(index) + 3}
                                                                onKeyDown={(e) => handleKeyDown(e, 'navigate')}
                                                                inputProps={{ min: 1, max: 999, step: 1 }}
                                                                placeholder="1"
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
                                                                autoComplete="off"
                                                                tabIndex={getPackageBaseTabIndex(index) + 4}
                                                                onKeyDown={(e) => handleKeyDown(e, 'navigate')}
                                                                inputProps={{ min: 0.1, step: 0.1 }}
                                                                sx={{
                                                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                                                    '& .MuiInputLabel-root': { fontSize: '12px' }
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
                                                                                {unitSystem === 'metric' ? 'kg' : 'lbs'}
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
                                                                autoComplete="off"
                                                                tabIndex={getPackageBaseTabIndex(index) + 5}
                                                                onKeyDown={(e) => handleKeyDown(e, 'navigate')}
                                                                inputProps={{ min: 1, step: 0.1 }}
                                                                sx={{
                                                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                                                    '& .MuiInputLabel-root': { fontSize: '12px' }
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
                                                                                {unitSystem === 'metric' ? 'cm' : 'in'}
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
                                                                autoComplete="off"
                                                                tabIndex={getPackageBaseTabIndex(index) + 6}
                                                                onKeyDown={(e) => handleKeyDown(e, 'navigate')}
                                                                inputProps={{ min: 1, step: 0.1 }}
                                                                sx={{
                                                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                                                    '& .MuiInputLabel-root': { fontSize: '12px' }
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
                                                                autoComplete="off"
                                                                tabIndex={getPackageBaseTabIndex(index) + 7}
                                                                onKeyDown={(e) => handleKeyDown(e, 'navigate')}
                                                                inputProps={{ min: 1, step: 0.1 }}
                                                                sx={{
                                                                    '& .MuiInputBase-root': { fontSize: '12px' },
                                                                    '& .MuiInputLabel-root': { fontSize: '12px' }
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

                                                        {/* Declared Value - Only show if user has permission */}
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
                                                                            '& .MuiAutocomplete-input': { fontSize: '12px' }
                                                                        }}
                                                                    />
                                                                </Box>
                                                            </Grid>
                                                        )}

                                                        {/* Freight Class - Only show if user has permission */}
                                                        {hasPermission(userRole, PERMISSIONS.VIEW_FREIGHT_CLASS) && (
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
                                            );
                                        })}
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
                                                    justifyContent: 'space-between',
                                                    cursor: 'pointer',
                                                    mb: servicesExpanded ? 3 : 0
                                                }}
                                                onClick={() => setServicesExpanded(!servicesExpanded)}
                                            >
                                                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                                    Additional Services
                                                    {additionalServices.length > 0 && (
                                                        <Chip
                                                            label={`${additionalServices.length} selected`}
                                                            size="small"
                                                            sx={{
                                                                ml: 2,
                                                                fontSize: '10px',
                                                                bgcolor: '#7c3aed',
                                                                color: 'white'
                                                            }}
                                                        />
                                                    )}
                                                </Typography>
                                                <ExpandMoreIcon
                                                    sx={{
                                                        transform: servicesExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                                        transition: 'transform 0.2s ease',
                                                        color: '#6b7280'
                                                    }}
                                                />
                                            </Box>

                                            <Collapse in={servicesExpanded}>

                                                {(() => {
                                                    console.log('🔧 Rendering services UI - loadingServices:', loadingServices, 'availableServices:', availableServices);
                                                    return null;
                                                })()}

                                                {/* Category Filter Buttons */}
                                                {!loadingServices && availableServices.length > 0 && (
                                                    <Box sx={{ mb: 2 }}>
                                                        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                                            {(() => {
                                                                const counts = getServiceCategoryCounts();
                                                                const filterOptions = [
                                                                    { key: 'all', label: 'All', count: counts.all },
                                                                    { key: 'general', label: 'General', count: counts.general },
                                                                    { key: 'pickup', label: 'Pickup', count: counts.pickup },
                                                                    { key: 'delivery', label: 'Delivery', count: counts.delivery }
                                                                ];

                                                                return filterOptions
                                                                    .filter(option => option.count > 0)
                                                                    .map((option) => (
                                                                        <Button
                                                                            key={option.key}
                                                                            size="small"
                                                                            variant={servicesCategoryFilter === option.key ? 'contained' : 'outlined'}
                                                                            onClick={() => setServicesCategoryFilter(option.key)}
                                                                            sx={{
                                                                                fontSize: '11px',
                                                                                textTransform: 'none',
                                                                                height: '26px',
                                                                                minWidth: '60px',
                                                                                backgroundColor: servicesCategoryFilter === option.key ? '#7c3aed' : 'transparent',
                                                                                borderColor: servicesCategoryFilter === option.key ? '#7c3aed' : '#d1d5db',
                                                                                color: servicesCategoryFilter === option.key ? 'white' : '#6b7280',
                                                                                '&:hover': {
                                                                                    backgroundColor: servicesCategoryFilter === option.key ? '#6d28d9' : '#f9fafb',
                                                                                    borderColor: '#7c3aed'
                                                                                }
                                                                            }}
                                                                        >
                                                                            {option.label} ({option.count})
                                                                        </Button>
                                                                    ));
                                                            })()}
                                                        </Box>
                                                    </Box>
                                                )}

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
                                                        {getFilteredServicesByCategory().map((service) => (
                                                            <Grid item xs={12} sm={6} md={4} key={service.id}>
                                                                <Box
                                                                    onClick={() => handleServiceToggle(service)}
                                                                    sx={{
                                                                        p: 2,
                                                                        border: isServiceSelected(service.id) ? '2px solid #7c3aed' : '1px solid #e5e7eb',
                                                                        borderRadius: 2,
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s ease',
                                                                        bgcolor: isServiceSelected(service.id) ? '#f3f4f6' : 'white',
                                                                        '&:hover': {
                                                                            borderColor: '#7c3aed',
                                                                            transform: 'translateY(-1px)',
                                                                            boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)'
                                                                        }
                                                                    }}
                                                                >
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                                                                                color: '#7c3aed',
                                                                                '&.Mui-checked': {
                                                                                    color: '#7c3aed'
                                                                                }
                                                                            }}
                                                                        />
                                                                        <Typography
                                                                            sx={{
                                                                                fontSize: '12px',
                                                                                fontWeight: 600,
                                                                                color: isServiceSelected(service.id) ? '#7c3aed' : '#374151',
                                                                                lineHeight: 1.3
                                                                            }}
                                                                        >
                                                                            {service.label}
                                                                        </Typography>
                                                                    </Box>

                                                                </Box>
                                                            </Grid>
                                                        ))}
                                                    </Grid>
                                                )}

                                                {/* Selected Services Summary */}
                                                {additionalServices.length > 0 && (
                                                    <Box sx={{ mt: 3, p: 2, bgcolor: '#f0f9ff', borderRadius: 2, border: '1px solid #bae6fd' }}>
                                                        <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#0369a1', mb: 1 }}>
                                                            Selected Additional Services ({additionalServices.length})
                                                        </Typography>
                                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                                            {additionalServices.map((service) => (
                                                                <Chip
                                                                    key={service.id}
                                                                    label={service.label}
                                                                    size="small"
                                                                    onDelete={() => handleServiceToggle(service)}
                                                                    sx={{
                                                                        fontSize: '11px',
                                                                        height: 24,
                                                                        bgcolor: '#7c3aed',
                                                                        color: 'white',
                                                                        '& .MuiChip-deleteIcon': {
                                                                            color: 'white',
                                                                            fontSize: '14px'
                                                                        }
                                                                    }}
                                                                />
                                                            ))}
                                                        </Box>
                                                    </Box>
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
                                                                        {(option.phone || option.email) && (
                                                                            <Typography variant="caption" sx={{ fontSize: '11px', color: '#666' }}>
                                                                                {[option.phone && `📞 ${option.phone}`, option.email && `✉️ ${option.email}`].filter(Boolean).join(' • ')}
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

                                                {/* Selected Broker Details and Shipment-Level Fields */}
                                                {selectedBroker && (() => {
                                                    const brokerDetails = companyBrokers.find(b => b.name === selectedBroker);
                                                    return brokerDetails ? (
                                                        <Box sx={{
                                                            mt: 2,
                                                            p: 2,
                                                            bgcolor: '#f0f9ff',
                                                            borderRadius: 1,
                                                            border: '1px solid #bae6fd'
                                                        }}>
                                                            {/* Company Broker Info */}
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap', mb: 2 }}>
                                                                <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#0c4a6e' }}>
                                                                    <strong>{brokerDetails.name}</strong>
                                                                </Typography>
                                                                {brokerDetails.phone && (
                                                                    <Typography variant="caption" sx={{ fontSize: '11px', color: '#075985' }}>
                                                                        <strong>Phone:</strong> {brokerDetails.phone}
                                                                    </Typography>
                                                                )}
                                                                {brokerDetails.email && (
                                                                    <Typography variant="caption" sx={{ fontSize: '11px', color: '#075985' }}>
                                                                        <strong>Email:</strong> {brokerDetails.email}
                                                                    </Typography>
                                                                )}
                                                            </Box>

                                                            {/* Shipment-Level Broker Fields */}
                                                            <Grid container spacing={2}>
                                                                <Grid item xs={12} sm={6}>
                                                                    <TextField
                                                                        label="Port"
                                                                        value={brokerPort}
                                                                        onChange={(e) => setBrokerPort(e.target.value)}
                                                                        size="small"
                                                                        fullWidth
                                                                        placeholder="Enter port information"
                                                                        sx={{
                                                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                                                            '& .MuiInputBase-input': { fontSize: '12px' }
                                                                        }}
                                                                    />
                                                                </Grid>
                                                                <Grid item xs={12} sm={6}>
                                                                    <TextField
                                                                        label="Reference"
                                                                        value={brokerReference}
                                                                        onChange={(e) => setBrokerReference(e.target.value)}
                                                                        size="small"
                                                                        fullWidth
                                                                        placeholder="Enter reference number"
                                                                        sx={{
                                                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                                                            '& .MuiInputBase-input': { fontSize: '12px' }
                                                                        }}
                                                                    />
                                                                </Grid>
                                                            </Grid>
                                                        </Box>
                                                    ) : null;
                                                })()}
                                            </Collapse>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Manual Rate Entry Section - Only show if user has permission */}
                                {hasPermission(userRole, PERMISSIONS.VIEW_SHIPMENT_COSTS) && (
                                    <Card sx={{ mb: 3, border: '1px solid #e5e7eb', borderRadius: 2 }}>
                                        <CardContent sx={{ p: 3 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                                    Rates
                                                </Typography>
                                                <Button
                                                    variant="outlined"
                                                    size="small"
                                                    startIcon={<AddIcon />}
                                                    onClick={addRateLineItem}
                                                    tabIndex={-1}
                                                    sx={{ fontSize: '12px' }}
                                                >
                                                    Add Line Item
                                                </Button>
                                            </Box>

                                            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                                                <Table size="small">
                                                    <TableHead>
                                                        <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', width: '80px' }}>Code</TableCell>
                                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', width: 'auto' }}>Charge Name</TableCell>
                                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', width: '180px', textAlign: 'center' }}>Our Cost</TableCell>
                                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', width: '180px', textAlign: 'center' }}>Customer Charge</TableCell>
                                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', width: '60px' }}>Actions</TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {manualRates.map((rate) => (
                                                            <TableRow key={rate.id}>
                                                                {/* Hidden carrier field - save but don't show */}
                                                                <input type="hidden" value={rate.carrier} />
                                                                <TableCell sx={{ width: '80px' }}>
                                                                    <FormControl fullWidth size="small">
                                                                        <Select
                                                                            value={rate.code}
                                                                            onChange={(e) => updateRateLineItem(rate.id, 'code', e.target.value)}
                                                                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                                                            displayEmpty
                                                                            disabled={loadingChargeTypes}
                                                                        >
                                                                            <MenuItem value="" sx={{ fontSize: '12px' }}>
                                                                                <em>{loadingChargeTypes ? 'Loading...' : 'Select Code'}</em>
                                                                            </MenuItem>
                                                                            {availableChargeTypes.map(chargeType => (
                                                                                <MenuItem key={chargeType.value} value={chargeType.value} sx={{ fontSize: '12px' }}>
                                                                                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                                                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                                            {chargeType.value}
                                                                                        </Typography>
                                                                                        {chargeType.description && (
                                                                                            <Typography sx={{ fontSize: '10px', color: '#6b7280', fontStyle: 'italic' }}>
                                                                                                {chargeType.description}
                                                                                            </Typography>
                                                                                        )}
                                                                                    </Box>
                                                                                </MenuItem>
                                                                            ))}
                                                                            {chargeTypesError && (
                                                                                <MenuItem disabled sx={{ fontSize: '11px', color: '#dc2626', fontStyle: 'italic' }}>
                                                                                    Error loading charge types
                                                                                </MenuItem>
                                                                            )}
                                                                        </Select>
                                                                    </FormControl>
                                                                </TableCell>
                                                                <TableCell sx={{ width: 'auto' }}>
                                                                    <TextField
                                                                        fullWidth
                                                                        size="small"
                                                                        value={rate.chargeName}
                                                                        onChange={(e) => updateRateLineItem(rate.id, 'chargeName', e.target.value)}
                                                                        autoComplete="off"
                                                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                                        placeholder="Enter charge description"
                                                                    />
                                                                </TableCell>
                                                                <TableCell sx={{ width: '180px', padding: '8px 4px' }}>
                                                                    <Box sx={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: 1, overflow: 'hidden' }}>
                                                                        <TextField
                                                                            size="small"
                                                                            type="number"
                                                                            value={rate.cost}
                                                                            onChange={(e) => updateRateLineItem(rate.id, 'cost', e.target.value)}
                                                                            autoComplete="off"
                                                                            inputProps={{
                                                                                step: 0.01,
                                                                                min: 0,
                                                                                onBlur: (e) => {
                                                                                    // Format to 2 decimal places on blur
                                                                                    const value = parseFloat(e.target.value);
                                                                                    if (!isNaN(value)) {
                                                                                        updateRateLineItem(rate.id, 'cost', value.toFixed(2));
                                                                                    }
                                                                                }
                                                                            }}
                                                                            sx={{
                                                                                flex: 1,
                                                                                '& .MuiInputBase-input': { fontSize: '12px', textAlign: 'right', padding: '6px 8px' },
                                                                                '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                                                                                '& .MuiInputBase-root:hover .MuiOutlinedInput-notchedOutline': { border: 'none' },
                                                                                '& .MuiInputBase-root.Mui-focused .MuiOutlinedInput-notchedOutline': { border: 'none' },
                                                                                '& input[type=number]': {
                                                                                    '-moz-appearance': 'textfield'
                                                                                },
                                                                                '& input[type=number]::-webkit-outer-spin-button': {
                                                                                    '-webkit-appearance': 'none',
                                                                                    margin: 0
                                                                                },
                                                                                '& input[type=number]::-webkit-inner-spin-button': {
                                                                                    '-webkit-appearance': 'none',
                                                                                    margin: 0
                                                                                }
                                                                            }}
                                                                            placeholder="0.00"
                                                                        />
                                                                        <FormControl size="small" sx={{ minWidth: '60px', backgroundColor: '#f9fafb' }}>
                                                                            <Select
                                                                                value={rate.costCurrency}
                                                                                onChange={(e) => updateRateLineItem(rate.id, 'costCurrency', e.target.value)}
                                                                                tabIndex={-1}
                                                                                sx={{
                                                                                    '& .MuiSelect-select': { fontSize: '11px', padding: '6px 8px' },
                                                                                    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                                                                                    '& .MuiSelect-icon': { fontSize: '16px' }
                                                                                }}
                                                                            >
                                                                                <MenuItem value="CAD" sx={{ fontSize: '11px' }}>CAD</MenuItem>
                                                                                <MenuItem value="USD" sx={{ fontSize: '11px' }}>USD</MenuItem>
                                                                            </Select>
                                                                        </FormControl>
                                                                    </Box>
                                                                </TableCell>
                                                                <TableCell sx={{ width: '180px', padding: '8px 4px' }}>
                                                                    <Box sx={{ display: 'flex', border: '1px solid #d1d5db', borderRadius: 1, overflow: 'hidden' }}>
                                                                        <TextField
                                                                            size="small"
                                                                            type="number"
                                                                            value={rate.charge}
                                                                            onChange={(e) => updateRateLineItem(rate.id, 'charge', e.target.value)}
                                                                            autoComplete="off"
                                                                            inputProps={{
                                                                                step: 0.01,
                                                                                min: 0,
                                                                                onBlur: (e) => {
                                                                                    // Format to 2 decimal places on blur
                                                                                    const value = parseFloat(e.target.value);
                                                                                    if (!isNaN(value)) {
                                                                                        updateRateLineItem(rate.id, 'charge', value.toFixed(2));
                                                                                    }
                                                                                }
                                                                            }}
                                                                            sx={{
                                                                                flex: 1,
                                                                                '& .MuiInputBase-input': { fontSize: '12px', textAlign: 'right', padding: '6px 8px' },
                                                                                '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                                                                                '& .MuiInputBase-root:hover .MuiOutlinedInput-notchedOutline': { border: 'none' },
                                                                                '& .MuiInputBase-root.Mui-focused .MuiOutlinedInput-notchedOutline': { border: 'none' },
                                                                                '& input[type=number]': {
                                                                                    '-moz-appearance': 'textfield'
                                                                                },
                                                                                '& input[type=number]::-webkit-outer-spin-button': {
                                                                                    '-webkit-appearance': 'none',
                                                                                    margin: 0
                                                                                },
                                                                                '& input[type=number]::-webkit-inner-spin-button': {
                                                                                    '-webkit-appearance': 'none',
                                                                                    margin: 0
                                                                                }
                                                                            }}
                                                                            placeholder="0.00"
                                                                        />
                                                                        <FormControl size="small" sx={{ minWidth: '60px', backgroundColor: '#f9fafb' }}>
                                                                            <Select
                                                                                value={rate.chargeCurrency}
                                                                                onChange={(e) => updateRateLineItem(rate.id, 'chargeCurrency', e.target.value)}
                                                                                tabIndex={-1}
                                                                                sx={{
                                                                                    '& .MuiSelect-select': { fontSize: '11px', padding: '6px 8px' },
                                                                                    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
                                                                                    '& .MuiSelect-icon': { fontSize: '16px' }
                                                                                }}
                                                                            >
                                                                                <MenuItem value="CAD" sx={{ fontSize: '11px' }}>CAD</MenuItem>
                                                                                <MenuItem value="USD" sx={{ fontSize: '11px' }}>USD</MenuItem>
                                                                            </Select>
                                                                        </FormControl>
                                                                    </Box>
                                                                </TableCell>
                                                                <TableCell sx={{ width: '60px' }}>
                                                                    <IconButton
                                                                        size="small"
                                                                        onClick={() => removeRateLineItem(rate.id)}
                                                                        tabIndex={-1}
                                                                        sx={{ color: '#ef4444' }}
                                                                    >
                                                                        <DeleteIcon fontSize="small" />
                                                                    </IconButton>
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </TableContainer>
                                        </CardContent>
                                    </Card>
                                )}

                                {/* Combined Total and Action Section - Always visible */}
                                <Box sx={{ mt: 3, p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                                    <Box sx={{ display: 'flex', justifyContent: hasPermission(userRole, PERMISSIONS.VIEW_SHIPMENT_COSTS) ? 'space-between' : 'flex-end', alignItems: 'center', gap: 3 }}>
                                        {/* Left side - Total cost - Only show if user can view rates */}
                                        {hasPermission(userRole, PERMISSIONS.VIEW_SHIPMENT_COSTS) && (
                                            <Box sx={{ textAlign: 'left' }}>
                                                <Typography variant="h4" sx={{
                                                    fontSize: '24px',
                                                    fontWeight: 700,
                                                    color: '#1f2937',
                                                    mb: 0.5
                                                }}>
                                                    Total: {formatCurrency(totalCost, 'CAD')}
                                                </Typography>
                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                    Total
                                                </Typography>
                                            </Box>
                                        )}

                                        {/* Right side - Action buttons (different for edit vs create mode) */}
                                        <Box sx={{ textAlign: 'right' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'flex-end' }}>
                                                {!isEditingExistingShipment && hasPermission(userRole, PERMISSIONS.USE_SWITCH_TO_LIVE_RATES) && (
                                                    <Button
                                                        variant="outlined"
                                                        onClick={handleConvertToAdvanced}
                                                        disabled={isConverting || isBooking || isSavingDraft}
                                                        startIcon={<TrendingUpIcon />}
                                                        sx={{
                                                            fontSize: '12px',
                                                            textTransform: 'none',
                                                            minWidth: '140px'
                                                        }}
                                                    >
                                                        {isConverting ? 'Converting...' : 'Switch to Live Rates'}
                                                    </Button>
                                                )}
                                                {isEditingExistingShipment && (
                                                    <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                                        Update Shipment?
                                                    </Typography>
                                                )}
                                                <Box sx={{ display: 'flex', gap: 2 }}>
                                                    {isEditingExistingShipment ? (
                                                        // Edit mode buttons
                                                        <>
                                                            <Button
                                                                variant="outlined"
                                                                onClick={handleCancelEdit}
                                                                disabled={isLoading}
                                                                sx={{
                                                                    fontSize: '12px',
                                                                    textTransform: 'none',
                                                                    minWidth: '120px'
                                                                }}
                                                            >
                                                                Cancel Changes
                                                            </Button>
                                                            <Button
                                                                variant="contained"
                                                                color="primary"
                                                                onClick={handleUpdateShipment}
                                                                disabled={(() => {
                                                                    // Check if we're editing a draft or booked shipment
                                                                    const isEditingDraftShipment = editShipment?.status === 'draft';

                                                                    if (isEditingDraftShipment) {
                                                                        // For drafts, only require basic fields (carrier is optional)
                                                                        return isLoading;
                                                                    } else {
                                                                        // For booked shipments, require all fields including carrier
                                                                        return isLoading || !selectedCarrier || !shipFromAddress || !shipToAddress || packages.length === 0;
                                                                    }
                                                                })()}
                                                                sx={{
                                                                    fontSize: '12px',
                                                                    textTransform: 'none',
                                                                    minWidth: '120px'
                                                                }}
                                                                startIcon={isLoading ? <CircularProgress size={16} /> : null}
                                                            >
                                                                {isLoading ? 'Updating...' : 'Update Shipment'}
                                                            </Button>
                                                        </>
                                                    ) : (
                                                        // Create mode buttons
                                                        <>
                                                            {hasPermission(userRole, PERMISSIONS.USE_SHIP_LATER) && (
                                                                <Button
                                                                    variant="outlined"
                                                                    onClick={handleShipLater}
                                                                    disabled={isSavingDraft || isDraftLoading}
                                                                    sx={{
                                                                        fontSize: '12px',
                                                                        textTransform: 'none',
                                                                        minWidth: '120px'
                                                                    }}
                                                                    startIcon={isSavingDraft ? <CircularProgress size={16} /> : null}
                                                                >
                                                                    {isSavingDraft ? 'Saving...' : 'Ship Later'}
                                                                </Button>
                                                            )}

                                                            {/* Submit for Review Button - Show when user has review permission (can show alongside Ship Later) */}
                                                            {hasPermission(userRole, PERMISSIONS.REVIEW_SHIPMENTS) && (
                                                                <Button
                                                                    variant="outlined"
                                                                    onClick={handleSubmitForReview}
                                                                    disabled={isSubmittingForReview || isBooking || isSavingDraft}
                                                                    startIcon={<ReviewIcon />}
                                                                    sx={{
                                                                        fontSize: '12px',
                                                                        textTransform: 'none',
                                                                        minWidth: '140px',
                                                                        borderColor: '#f59e0b',
                                                                        color: '#f59e0b',
                                                                        '&:hover': {
                                                                            borderColor: '#e08d00',
                                                                            color: '#e08d00',
                                                                            backgroundColor: 'rgba(245, 158, 11, 0.04)'
                                                                        }
                                                                    }}
                                                                >
                                                                    {isSubmittingForReview ? 'Submitting...' : 'Submit for Review'}
                                                                </Button>
                                                            )}

                                                            {hasPermission(userRole, PERMISSIONS.USE_BOOK_SHIPMENT) && (
                                                                <Button
                                                                    variant="contained"
                                                                    color="primary"
                                                                    onClick={handleBookShipment}
                                                                    disabled={isSavingDraft || isDraftLoading || isBooking || !selectedCarrier || !shipFromAddress || !shipToAddress || packages.length === 0}
                                                                    sx={{
                                                                        fontSize: '12px',
                                                                        textTransform: 'none',
                                                                        minWidth: '120px'
                                                                    }}
                                                                >
                                                                    {isBooking ? 'Booking...' : 'Book Shipment'}
                                                                </Button>
                                                            )}
                                                        </>
                                                    )}
                                                </Box>
                                            </Box>

                                            {/* Helper text below the buttons on the right */}
                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mt: 1.5 }}>
                                                {isEditingExistingShipment
                                                    ? 'Cancel to discard changes, or update to save your modifications.'
                                                    : 'Save as draft to complete later, or book now to proceed with shipping.'
                                                }
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>

                                {/* Success Message for Carrier Operations */}
                                {carrierSuccessMessage && (
                                    <Alert
                                        severity="success"
                                        onClose={() => setCarrierSuccessMessage('')}
                                        sx={{
                                            mb: 3,
                                            borderRadius: 2,
                                            '& .MuiAlert-message': {
                                                fontSize: '14px'
                                            }
                                        }}
                                    >
                                        <AlertTitle sx={{ fontSize: '16px', fontWeight: 600 }}>
                                            Success
                                        </AlertTitle>
                                        {carrierSuccessMessage}
                                    </Alert>
                                )}

                                {/* Success Message for Broker Operations */}
                                {brokerSuccessMessage && (
                                    <Alert
                                        severity="success"
                                        onClose={() => setBrokerSuccessMessage('')}
                                        sx={{
                                            mb: 3,
                                            borderRadius: 2,
                                            '& .MuiAlert-message': {
                                                fontSize: '14px'
                                            }
                                        }}
                                    >
                                        <AlertTitle sx={{ fontSize: '16px', fontWeight: 600 }}>
                                            Success
                                        </AlertTitle>
                                        {brokerSuccessMessage}
                                    </Alert>
                                )}

                                {/* Enhanced QuickShip Carrier Dialog */}
                                <Suspense fallback={<CircularProgress />}>
                                    {(() => {
                                        console.log('🔍 Rendering QuickShipCarrierDialog:', {
                                            showCarrierDialog,
                                            editingCarrier,
                                            isEditMode: !!editingCarrier,
                                            companyId: companyIdForAddress,
                                            dialogShouldOpen: Boolean(showCarrierDialog)
                                        });
                                        if (showCarrierDialog) {
                                            console.log('🎯 DIALOG SHOULD BE VISIBLE NOW! Props passed to dialog:', {
                                                open: showCarrierDialog,
                                                editingCarrier: editingCarrier,
                                                companyId: companyIdForAddress
                                            });
                                        }
                                        return (
                                            <QuickShipCarrierDialog
                                                open={showCarrierDialog}
                                                onClose={() => {
                                                    console.log('📝 Closing carrier dialog');
                                                    setShowCarrierDialog(false);
                                                    setEditingCarrier(null);
                                                }}
                                                onSuccess={handleCarrierSuccess}
                                                editingCarrier={editingCarrier}
                                                isEditMode={!!editingCarrier}
                                                existingCarriers={quickShipCarriers}
                                                companyId={companyIdForAddress}
                                            />
                                        );
                                    })()}
                                </Suspense>

                                {/* QuickShip Broker Dialog */}
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
                                        companyId={companyIdForAddress}
                                    />
                                </Suspense>

                                {/* Address Edit Dialog */}
                                <Suspense fallback={<CircularProgress />}>
                                    <AddressFormDialog
                                        open={showAddressDialog}
                                        onClose={() => {
                                            setShowAddressDialog(false);
                                            setEditingAddressData(null);
                                        }}
                                        onSuccess={handleAddressUpdated}
                                        editingAddress={editingAddressData}
                                        addressType={editingAddressType}
                                        companyId={companyIdForAddress}
                                    // Note: QuickShip doesn't use customer selection, so no customerId needed
                                    />
                                </Suspense>

                                {/* Duplicate carrier selection removed - using the main one above */}
                            </form>
                        )}
                </Box>

                {/* AddAddress View */}
                <Box sx={{
                    width: '50%',
                    overflow: 'auto',
                    position: 'relative',
                    zIndex: currentView === 'addaddress' ? 1500 : 800
                }}>
                    {currentView === 'addaddress' && (
                        <AddressForm
                            isModal={true}
                            onCancel={handleBackToQuickShip}
                            onSuccess={handleAddressCreated}
                            companyId={companyIdForAddress}
                            customerId={selectedCustomerId}
                        />
                    )}
                </Box>
            </Box>

            {/* Confirmation Dialog */}
            <Dialog
                open={showConfirmDialog}
                onClose={() => setShowConfirmDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ textAlign: 'center', fontWeight: 600, fontSize: '18px' }}>
                    CONFIRM QUICKSHIP BOOKING
                </DialogTitle>
                <DialogContent sx={{ textAlign: 'center', py: 3 }}>
                    <Typography variant="body1" sx={{ mb: 2, fontSize: '14px' }}>
                        Are you sure you want to book this QuickShip with <strong>{selectedCarrier}</strong>?
                    </Typography>

                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px', mt: 1 }}>
                        This will generate shipping documents and send notifications.
                    </Typography>

                    {/* Email Notification Toggle */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mt: 3, mb: 2 }}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={sendEmailNotifications}
                                    onChange={(e) => setSendEmailNotifications(e.target.checked)}
                                    size="small"
                                    sx={{
                                        '& .MuiSwitch-switchBase.Mui-checked': {
                                            color: '#10b981',
                                        },
                                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                            backgroundColor: '#10b981',
                                        },
                                    }}
                                />
                            }
                            label="Send email notifications"
                            sx={{
                                fontSize: '14px',
                                '& .MuiFormControlLabel-label': {
                                    fontSize: '14px',
                                    color: '#374151'
                                }
                            }}
                        />
                    </Box>

                    {!sendEmailNotifications && (
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#f59e0b', fontStyle: 'italic' }}>
                            ⚠️ Email notifications will be disabled. Documents will still be generated.
                        </Typography>
                    )}
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
                                Booking QuickShip with {selectedCarrier}...
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
                                Please wait while we process your shipment booking.
                            </Typography>
                        </>
                    ) : bookingStep === 'generating_label' ? (
                        <>
                            <CircularProgress size={60} sx={{ mb: 3, color: '#1a237e' }} />
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, fontSize: '16px' }}>
                                Generating Shipping Documents...
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontSize: '12px' }}>
                                {labelGenerationStatus}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
                                Generating BOL and carrier confirmation documents.
                            </Typography>
                        </>
                    ) : bookingStep === 'completed' ? (
                        <>
                            <CheckCircleIcon sx={{ fontSize: 80, color: '#4caf50', mb: 2 }} />
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, fontSize: '16px' }}>
                                QuickShip Booked Successfully!
                            </Typography>
                            <Typography variant="body1" sx={{ mb: 1, fontSize: '14px' }}>
                                Shipment ID:
                            </Typography>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#1a237e', mb: 2, fontSize: '16px' }}>
                                {finalShipmentId}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '12px' }}>
                                BOL and carrier confirmation documents have been generated.
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
                    ) : (
                        <>
                            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600, fontSize: '16px', color: 'error.main' }}>
                                Booking Failed
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '12px' }}>
                                {error}
                            </Typography>
                            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
                                <Button
                                    onClick={() => setShowBookingDialog(false)}
                                    variant="outlined"
                                    size="large"
                                    sx={{ fontSize: '14px' }}
                                >
                                    Close
                                </Button>
                                <Button
                                    onClick={() => {
                                        setBookingStep('booking');
                                        bookQuickShipment();
                                    }}
                                    variant="contained"
                                    size="large"
                                    sx={{ bgcolor: '#1a237e', fontSize: '14px' }}
                                >
                                    Try Again
                                </Button>
                            </Box>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* Submit for Review Confirmation Dialog */}
            <Dialog
                open={showReviewDialog}
                onClose={() => setShowReviewDialog(false)}
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
                    gap: 1,
                    color: '#f59e0b'
                }}>
                    <ReviewIcon sx={{ fontSize: 24 }} />
                    Submit for Review
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body1" sx={{
                        textAlign: 'center',
                        fontSize: '14px',
                        mb: 2,
                        color: '#374151'
                    }}>
                        Are you sure you want to submit this shipment for review?
                    </Typography>
                    <Typography variant="body2" sx={{
                        textAlign: 'center',
                        fontSize: '12px',
                        color: '#6b7280',
                        mb: 2
                    }}>
                        The operations team will review and complete the booking process. You won't be able to edit the shipment once submitted.
                    </Typography>
                    <Typography variant="body2" sx={{
                        textAlign: 'center',
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#f59e0b'
                    }}>
                        Shipment ID: {shipmentID}
                    </Typography>
                </DialogContent>
                <DialogActions sx={{ justifyContent: 'center', gap: 2, pb: 3 }}>
                    <Button
                        onClick={() => setShowReviewDialog(false)}
                        variant="outlined"
                        disabled={isSubmittingForReview}
                        sx={{
                            fontSize: '12px',
                            textTransform: 'none',
                            minWidth: '120px'
                        }}
                    >
                        Continue Editing
                    </Button>
                    <Button
                        onClick={handleConfirmSubmitForReview}
                        variant="contained"
                        disabled={isSubmittingForReview}
                        sx={{
                            fontSize: '12px',
                            textTransform: 'none',
                            minWidth: '120px',
                            bgcolor: '#f59e0b',
                            '&:hover': {
                                bgcolor: '#d97706'
                            }
                        }}
                        startIcon={isSubmittingForReview ? <CircularProgress size={16} /> : null}
                    >
                        {isSubmittingForReview ? 'Submitting...' : 'Confirm'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Conversion Confirmation Dialog */}
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
                    <TrendingUpIcon sx={{ color: '#059669' }} />
                    Switch to Live Rates
                </DialogTitle>
                <DialogContent sx={{ textAlign: 'center', py: 3 }}>
                    <Typography variant="body1" sx={{ mb: 3, fontSize: '14px' }}>
                        Would you like to switch to live rates mode? This will fetch real-time pricing from carriers.
                    </Typography>

                    <Typography variant="body2" sx={{ fontSize: '13px', color: '#6b7280', mb: 3 }}>
                        Some data may be adjusted during the switch, but your core shipment information will be preserved.
                    </Typography>

                    {manualRates && manualRates.length > 0 && totalCost > 0 && (
                        <Box sx={{ mt: 2, p: 2, bgcolor: '#f0f9ff', borderRadius: 1, border: '1px solid #0ea5e9' }}>
                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#0c4a6e' }}>
                                Your manual rate of {formatCurrency(totalCost, 'CAD')} will be replaced with live carrier rates.
                            </Typography>
                        </Box>
                    )}
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
                        onClick={confirmConvertToAdvanced}
                        variant="contained"
                        size="large"
                        sx={{
                            minWidth: 120,
                            bgcolor: '#059669',
                            fontSize: '14px',
                            '&:hover': {
                                bgcolor: '#047857'
                            }
                        }}
                        startIcon={<TrendingUpIcon />}
                    >
                        Switch Now
                    </Button>
                </DialogActions>
            </Dialog>



            {/* Error Snackbar */}
            <Snackbar
                open={showErrorSnackbar}
                autoHideDuration={6000}
                onClose={() => setShowErrorSnackbar(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setShowErrorSnackbar(false)}
                    severity="error"
                    sx={{
                        width: '100%',
                        fontSize: '14px',
                        boxShadow: 3
                    }}
                >
                    {error}
                </Alert>
            </Snackbar>

            {/* Success Snackbar */}
            <Snackbar
                open={showSuccessSnackbar}
                autoHideDuration={4000}
                onClose={() => setShowSuccessSnackbar(false)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert
                    onClose={() => setShowSuccessSnackbar(false)}
                    severity="success"
                    sx={{
                        width: '100%',
                        fontSize: '14px',
                        boxShadow: 3
                    }}
                >
                    {successMessage}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default QuickShip; 