import React, { useState, useEffect, useCallback, useMemo, useRef, lazy, Suspense } from 'react';
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
    Snackbar
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    LocalShipping as LocalShippingIcon,
    FlashOn as FlashOnIcon,
    CheckCircle as CheckCircleIcon,
    Edit as EditIcon
} from '@mui/icons-material';
import { useShipmentForm } from '../../contexts/ShipmentFormContext';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, setDoc, serverTimestamp, increment, limit, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { getStateOptions, getStateLabel } from '../../utils/stateUtils';
import { generateShipmentId } from '../../utils/shipmentIdGenerator';
import ModalHeader from '../common/ModalHeader';
import AddressForm from '../AddressBook/AddressForm';

// Lazy load other components
const QuickShipCarrierDialog = lazy(() => import('./QuickShipCarrierDialog'));
const QuickShipAddressDialog = lazy(() => import('./QuickShipAddressDialog'));
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
        minCount: 1,
        required: ['code', 'chargeName', 'cost', 'charge'],
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

const QuickShip = ({ onClose, onReturnToShipments, onViewShipment, draftId = null, isModal = false }) => {
    const { currentUser } = useAuth();
    const { companyData, companyIdForAddress } = useCompany();
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
        notes: ''
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
    const [showCarrierDialog, setShowCarrierDialog] = useState(false);
    const [editingCarrier, setEditingCarrier] = useState(null);
    const [loadingCarriers, setLoadingCarriers] = useState(false);
    const [carrierSuccessMessage, setCarrierSuccessMessage] = useState('');

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

    // Manual rates state
    const [manualRates, setManualRates] = useState([{
        id: 1,
        carrier: '',
        code: '',
        chargeName: '',
        cost: '',
        costCurrency: 'CAD',
        charge: '',
        chargeCurrency: 'CAD'
    }]);

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

    // Error handling improvements
    const errorAlertRef = useRef(null);
    const [showErrorSnackbar, setShowErrorSnackbar] = useState(false);
    const mainContentRef = useRef(null);

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

    // Conversion functions
    const lbsToKg = (lbs) => (lbs * 0.453592).toFixed(2);
    const kgToLbs = (kg) => (kg * 2.20462).toFixed(2);
    const inchesToCm = (inches) => (inches * 2.54).toFixed(1);
    const cmToInches = (cm) => (cm / 2.54).toFixed(1);

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

    // Generate shipment ID early when component initializes
    useEffect(() => {
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
    }, [companyIdForAddress, draftId]); // Removed shipmentID from dependencies to prevent loops

    // Create draft in database immediately after shipment ID is generated
    useEffect(() => {
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
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),

                    // Initialize with empty/default values
                    shipmentInfo: {
                        shipmentType: 'freight',
                        shipmentDate: new Date().toISOString().split('T')[0],
                        shipperReferenceNumber: shipmentID, // Use shipment ID as default reference
                        unitSystem: unitSystem
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
                    manualRates: [{
                        id: 1,
                        carrier: '',
                        code: '',
                        chargeName: '',
                        cost: '',
                        costCurrency: 'CAD',
                        charge: '',
                        chargeCurrency: 'CAD'
                    }],
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
    }, [shipmentID, isEditingDraft, companyIdForAddress, currentUser, unitSystem]);

    useEffect(() => {
        const loadCarriers = async () => {
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
        };

        loadCarriers();
    }, [companyIdForAddress]);

    // Enhanced carrier management functions
    const handleAddCarrier = () => {
        setEditingCarrier(null);
        setShowCarrierDialog(true);
    };

    const handleEditCarrier = (carrier) => {
        setEditingCarrier(carrier);
        setShowCarrierDialog(true);
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

    // Email validation helper
    const isValidEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    // Handle carrier selection change
    const handleCarrierChange = (newCarrier) => {
        setSelectedCarrier(newCarrier);
        // Update all manual rates with the new carrier
        setManualRates(prev => prev.map(rate => ({
            ...rate,
            carrier: newCarrier
        })));
    };

    // Handle unit system change for individual packages
    const handlePackageUnitChange = (packageId, newUnitSystem) => {
        setPackages(prev => prev.map(pkg => {
            if (pkg.id === packageId) {
                const oldUnitSystem = pkg.unitSystem || 'imperial';
                if (newUnitSystem !== oldUnitSystem) {
                    const updatedPkg = { ...pkg, unitSystem: newUnitSystem };

                    // Convert weight
                    if (pkg.weight) {
                        if (oldUnitSystem === 'imperial' && newUnitSystem === 'metric') {
                            updatedPkg.weight = lbsToKg(pkg.weight);
                        } else if (oldUnitSystem === 'metric' && newUnitSystem === 'imperial') {
                            updatedPkg.weight = kgToLbs(pkg.weight);
                        }
                    }

                    // Convert dimensions
                    if (pkg.length) {
                        if (oldUnitSystem === 'imperial' && newUnitSystem === 'metric') {
                            updatedPkg.length = inchesToCm(pkg.length);
                        } else if (oldUnitSystem === 'metric' && newUnitSystem === 'imperial') {
                            updatedPkg.length = cmToInches(pkg.length);
                        }
                    }

                    if (pkg.width) {
                        if (oldUnitSystem === 'imperial' && newUnitSystem === 'metric') {
                            updatedPkg.width = inchesToCm(pkg.width);
                        } else if (oldUnitSystem === 'metric' && newUnitSystem === 'imperial') {
                            updatedPkg.width = cmToInches(pkg.width);
                        }
                    }

                    if (pkg.height) {
                        if (oldUnitSystem === 'imperial' && newUnitSystem === 'metric') {
                            updatedPkg.height = inchesToCm(pkg.height);
                        } else if (oldUnitSystem === 'metric' && newUnitSystem === 'imperial') {
                            updatedPkg.height = cmToInches(pkg.height);
                        }
                    }

                    return updatedPkg;
                }
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
        const newId = Math.max(...manualRates.map(r => r.id), 0) + 1;
        setManualRates(prev => [...prev, {
            id: newId,
            carrier: selectedCarrier,
            code: 'FRT', // Default to first option (FRT - Freight)
            chargeName: '',
            cost: '',
            costCurrency: 'CAD',
            charge: '',
            chargeCurrency: 'CAD'
        }]);
    };

    const removeRateLineItem = (id) => {
        setManualRates(prev => prev.filter(rate => rate.id !== id));
    };

    const updateRateLineItem = (id, field, value) => {
        setManualRates(prev => prev.map(rate => {
            if (rate.id === id) {
                const updatedRate = { ...rate, [field]: value };

                // Auto-populate charge name when code is selected, but only if charge name is empty or was auto-populated
                if (field === 'code' && value) {
                    const selectedOption = RATE_CODE_OPTIONS.find(option => option.value === value);
                    if (selectedOption) {
                        // Check if the current charge name is empty, or matches a previous auto-populated value
                        const currentChargeName = rate.chargeName || '';
                        const isCurrentValueAutopopulated = RATE_CODE_OPTIONS.some(option => option.description === currentChargeName);

                        // Only update if field is empty or contains an auto-populated value
                        if (!currentChargeName.trim() || isCurrentValueAutopopulated) {
                            updatedRate.chargeName = selectedOption.description;
                        }
                    }
                }

                return updatedRate;
            }
            return rate;
        }));
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
    const handleAddressUpdated = (updatedAddress) => {
        if (editingAddressType === 'from') {
            setShipFromAddress(updatedAddress);
            updateFormSection('shipFrom', {
                ...updatedAddress,
                addressId: updatedAddress.id,
                type: 'origin'
            });
        } else {
            setShipToAddress(updatedAddress);
            updateFormSection('shipTo', {
                ...updatedAddress,
                addressId: updatedAddress.id,
                customerID: updatedAddress.id,
                type: 'destination'
            });
        }

        // Reload addresses to get latest data
        loadAddresses();

        // Close dialog
        setShowAddressDialog(false);
        setEditingAddressData(null);
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
        console.log('Address created with ID:', newAddressId);

        // Reload addresses to include the new one
        await loadAddresses();

        // Small delay to ensure state is updated, then find and select the new address
        setTimeout(() => {
            // Re-fetch the updated addresses to ensure we have the latest data
            const fetchAndSelectAddress = async () => {
                try {
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
                    setAvailableAddresses(updatedAddresses);

                    // Find and select the new address
                    const newAddress = updatedAddresses.find(addr => addr.id === newAddressId);
                    if (newAddress) {
                        handleAddressSelect(newAddress, addressEditMode);
                    }
                } catch (error) {
                    console.error('Error fetching updated addresses:', error);
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
                    notes: ''
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
                setManualRates([{
                    id: 1,
                    carrier: '',
                    code: '',
                    chargeName: '',
                    cost: '',
                    costCurrency: 'CAD',
                    charge: '',
                    chargeCurrency: 'CAD'
                }]);
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

            // Get selected carrier details
            const carrierDetails = quickShipCarriers.find(c => c.name === selectedCarrier) || {
                name: selectedCarrier,
                contactName: '',
                contactEmail: '',
                contactPhone: ''
            };

            // Calculate total weight and pieces for validation
            const totalWeight = packages.reduce((sum, pkg) => sum + (parseFloat(pkg.weight || 0) * parseInt(pkg.packagingQuantity || 1)), 0);
            const totalPieces = packages.reduce((sum, pkg) => sum + parseInt(pkg.packagingQuantity || 1), 0);

            // Prepare shipment data with enhanced validation
            const shipmentData = {
                // Basic shipment info
                shipmentID: finalShipmentID,
                status: 'booked',
                creationMethod: 'quickship',
                companyID: companyIdForAddress,
                createdBy: currentUser.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),

                // Shipment details
                shipmentInfo: {
                    ...shipmentInfo,
                    shipmentBillType: shipmentInfo.billType,
                    actualShipDate: shipmentInfo.shipmentDate || new Date().toISOString().split('T')[0],
                    totalWeight: totalWeight,
                    totalPieces: totalPieces,
                    unitSystem: unitSystem
                },

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
                    customerID: shipToAddress.id, // Use address ID as customer reference
                    type: 'destination',
                    // Ensure all required fields are present
                    companyName: shipToAddress.companyName || shipToAddress.company || 'Unknown Company',
                    street: shipToAddress.street || '',
                    city: shipToAddress.city || '',
                    state: shipToAddress.state || '',
                    postalCode: shipToAddress.postalCode || '',
                    country: shipToAddress.country || 'CA'
                },

                // Packages with validation
                packages: packages.map(pkg => ({
                    ...pkg,
                    weight: parseFloat(pkg.weight || 0),
                    packagingQuantity: parseInt(pkg.packagingQuantity || 1),
                    length: parseFloat(pkg.length || 0),
                    width: parseFloat(pkg.width || 0),
                    height: parseFloat(pkg.height || 0),
                    packagingTypeCode: pkg.packagingType,
                    packagingTypeName: PACKAGING_TYPES.find(pt => pt.value === pkg.packagingType)?.label || 'PACKAGE',
                    unitSystem: pkg.unitSystem || 'imperial', // Include individual unit system
                    freightClass: pkg.freightClass || '', // Include freight class
                    declaredValue: parseFloat(pkg.declaredValue || 0), // Include parsed declared value
                    declaredValueCurrency: pkg.declaredValueCurrency || 'CAD' // Include declared value currency
                })),

                // Carrier and rates
                carrier: selectedCarrier,
                carrierType: 'manual',
                carrierDetails: carrierDetails,
                manualRates: manualRates.map(rate => ({
                    ...rate,
                    cost: parseFloat(rate.cost || 0),
                    charge: parseFloat(rate.charge || 0)
                })),
                // Carrier confirmation rates (exclude IC SUR and IC LOG)
                carrierConfirmationRates: manualRates
                    .filter(rate => rate.code !== 'IC SUR' && rate.code !== 'IC LOG')
                    .map(rate => ({
                        ...rate,
                        cost: parseFloat(rate.cost || 0),
                        charge: parseFloat(rate.charge || 0)
                    })),
                totalCharges: totalCost,
                currency: manualRates[0]?.chargeCurrency || 'CAD',
                unitSystem: unitSystem,

                // Tracking
                trackingNumber: shipmentInfo.carrierTrackingNumber || finalShipmentID,

                // QuickShip specific flags
                isQuickShip: true,
                rateSource: 'manual',
                bookingTimestamp: new Date().toISOString()
            };

            console.log('QuickShip booking data prepared:', {
                shipmentID: finalShipmentID,
                carrier: selectedCarrier,
                totalWeight,
                totalPieces,
                totalCharges: totalCost
            });

            // Call the QuickShip booking function with enhanced error handling
            const functions = getFunctions();
            const bookQuickShipFunction = httpsCallable(functions, 'bookQuickShipment');

            const result = await bookQuickShipFunction({
                shipmentData: shipmentData,
                carrierDetails: carrierDetails
            });

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
        // Close the booking dialog first
        setShowBookingDialog(false);

        // Close the QuickShip modal entirely
        if (onClose) {
            onClose();
        }

        // Then navigate to view the shipment after a brief delay to allow modal to close
        setTimeout(() => {
            if (finalShipmentId && onViewShipment) {
                // Call the onViewShipment prop to open the shipment detail modal directly
                console.log('🎯 QuickShip: Calling onViewShipment with shipmentId:', finalShipmentId);
                onViewShipment(finalShipmentId);
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
        }, 300); // Small delay to ensure smooth transition
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
                            setManualRates(draftData.manualRates);
                        }

                        // Load unit system
                        if (draftData.unitSystem) {
                            setUnitSystem(draftData.unitSystem);
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
                        console.log('Draft shipFrom data:', draftData.shipFrom);
                        console.log('Draft packages data:', draftData.packages);

                        // Set the shipment ID from the draft
                        if (draftData.shipmentID) {
                            setShipmentID(draftData.shipmentID);
                        } else {
                            // Use the draftId as the shipmentID if shipmentID field is missing
                            setShipmentID(draftId);
                        }

                        // Load address data immediately - check flags at execution time
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
                                setManualRates(draftData.manualRates);
                            }

                            // Load unit system
                            if (draftData.unitSystem) {
                                setUnitSystem(draftData.unitSystem);
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
    }, [draftId, updateFormSection, onReturnToShipments]); // Removed editing flags from dependencies

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
        setIsSavingDraft(true);
        setError(null);

        try {
            // Remove validation - Ship Later should save whatever is currently entered
            // This allows users to save incomplete work and come back later

            console.log('Saving QuickShip draft:', {
                shipmentID,
                isEditingDraft,
                draftId,
                activeDraftId
            });

            // Get the ship from and ship to addresses with full details
            const shipFromAddressFull = availableAddresses.find(addr => addr.id === shipFromAddress?.id) || shipFromAddress;
            const shipToAddressFull = availableAddresses.find(addr => addr.id === shipToAddress?.id) || shipToAddress;

            const draftData = {
                // Basic shipment fields
                shipmentID: shipmentID, // Always use the shipmentID field
                status: 'draft',
                creationMethod: 'quickship',
                companyID: companyIdForAddress,
                createdBy: currentUser?.uid || 'unknown',
                updatedAt: serverTimestamp(),

                // Shipment information - save whatever is entered
                shipmentInfo: {
                    ...shipmentInfo,
                    shipmentType: shipmentInfo.shipmentType || 'freight',
                    unitSystem: unitSystem,
                    carrierTrackingNumber: shipmentInfo.carrierTrackingNumber || '' // Ensure this is saved
                },
                shipFrom: shipFromAddressFull || null, // Save null if not selected
                shipTo: shipToAddressFull || null, // Save null if not selected
                packages: packages,
                selectedCarrier: selectedCarrier || '', // Save empty string if not selected
                manualRates: manualRates,
                unitSystem: unitSystem,
                totalCost: totalCost,
                carrier: selectedCarrier || '', // Direct carrier field for table display
                carrierTrackingNumber: shipmentInfo.carrierTrackingNumber || '', // Save at top level too

                // Draft specific fields
                isDraft: true,
                draftSavedAt: serverTimestamp(),
                draftVersion: increment(1) // Increment version on each save
            };

            // Determine which document to update
            let docRef;
            let docId;

            if (activeDraftId) {
                // We already have a draft document, update it
                docRef = doc(db, 'shipments', activeDraftId);
                docId = activeDraftId;
                await updateDoc(docRef, draftData);
                console.log('QuickShip draft updated successfully:', docId);
            } else if (draftId) {
                // We're editing an existing draft that was passed as prop
                docRef = doc(db, 'shipments', draftId);
                docId = draftId;
                await updateDoc(docRef, draftData);
                console.log('QuickShip draft updated successfully:', docId);
            } else {
                // Create a new draft document with auto-generated ID
                draftData.createdAt = serverTimestamp();
                docRef = await addDoc(collection(db, 'shipments'), draftData);
                docId = docRef.id;
                setActiveDraftId(docId); // Store the new document ID
                console.log('QuickShip draft created successfully:', docId);
            }

            // Show success notification
            setShowDraftSuccess(true);

            // After a short delay, navigate to shipments modal
            setTimeout(() => {
                setShowDraftSuccess(false);
                // Close QuickShip modal first
                if (onClose) {
                    onClose();
                }
                // Then open shipments modal
                if (onReturnToShipments) {
                    onReturnToShipments();
                }
            }, 1500); // Show success message for 1.5 seconds before navigating

        } catch (error) {
            console.error('Error saving QuickShip draft:', error);
            setError(`Failed to save draft: ${error.message}`);
        } finally {
            setIsSavingDraft(false);
        }
    };

    // Load addresses from AddressBook
    const loadAddresses = useCallback(async () => {
        if (!companyIdForAddress) return;

        setLoadingAddresses(true);
        try {
            const addressQuery = query(
                collection(db, 'addressBook'),
                where('companyID', '==', companyIdForAddress),
                where('status', '==', 'active')
            );
            const addressSnapshot = await getDocs(addressQuery);
            const addresses = addressSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAvailableAddresses(addresses);
        } catch (error) {
            console.error('Error loading addresses:', error);
            setError('Failed to load addresses from address book.');
        } finally {
            setLoadingAddresses(false);
        }
    }, [companyIdForAddress]);

    // Load addresses on component mount
    useEffect(() => {
        loadAddresses();
    }, [loadAddresses]);

    // Debug address state changes
    useEffect(() => {
        console.log('shipFromAddress state changed:', shipFromAddress);
    }, [shipFromAddress]);

    useEffect(() => {
        console.log('shipToAddress state changed:', shipToAddress);
    }, [shipToAddress]);

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

    // Handle address selection
    const handleAddressSelect = (address, type) => {
        if (type === 'from') {
            setShipFromAddress(address);
            // Update form context for compatibility with proper address structure
            updateFormSection('shipFrom', {
                ...address,
                addressId: address.id,
                type: 'origin'
            });
        } else {
            setShipToAddress(address);
            // Update form context for compatibility with proper address structure
            updateFormSection('shipTo', {
                ...address,
                addressId: address.id,
                customerID: address.id, // Use address ID as customer reference
                type: 'destination'
            });
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
        if (manualRates.length === 0) {
            return { valid: false, message: ERROR_MESSAGES.INVALID_RATES };
        }

        let hasValidRate = false;

        for (let i = 0; i < manualRates.length; i++) {
            const rate = manualRates[i];

            // Check if this rate line has all required fields
            if (rate.code && rate.chargeName && rate.cost && rate.charge) {
                const cost = parseFloat(rate.cost);
                const charge = parseFloat(rate.charge);

                if (isNaN(cost) || cost < 0) {
                    return { valid: false, message: `Rate ${i + 1}: Cost must be a valid positive number.` };
                }

                if (isNaN(charge) || charge < 0) {
                    return { valid: false, message: `Rate ${i + 1}: Charge must be a valid positive number.` };
                }

                // Only validate the rate code if it's not empty
                if (rate.code && !QUICKSHIP_VALIDATION.rates.validCodes.includes(rate.code)) {
                    return { valid: false, message: `Rate ${i + 1}: Invalid rate code selected.` };
                }

                hasValidRate = true;
            } else if (rate.code || rate.chargeName || rate.cost || rate.charge) {
                // If any field is partially filled, check for specific issues
                if (rate.code && !QUICKSHIP_VALIDATION.rates.validCodes.includes(rate.code)) {
                    return { valid: false, message: `Rate ${i + 1}: Invalid rate code '${rate.code}'. Please select a valid code.` };
                }
            }
        }

        if (!hasValidRate) {
            return { valid: false, message: 'At least one complete rate entry is required.' };
        }

        return { valid: true };
    };

    const validateQuickShipForm = () => {
        // Clear any existing errors
        setError(null);

        // Validate carrier
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

                    {/* Shipment Information Section */}
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
                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'stretch' }}>
                                        <Autocomplete
                                            fullWidth
                                            size="small"
                                            options={quickShipCarriers}
                                            getOptionLabel={(option) => typeof option === 'string' ? option : option.name}
                                            value={quickShipCarriers.find(c => c.name === selectedCarrier) || null}
                                            onChange={(event, newValue) => {
                                                const carrierName = newValue ? (typeof newValue === 'string' ? newValue : newValue.name) : '';
                                                handleCarrierChange(carrierName);
                                            }}
                                            loading={loadingCarriers}
                                            disabled={currentView === 'addaddress'}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="Select Carrier"
                                                    required
                                                    disabled={currentView === 'addaddress'}
                                                    sx={{
                                                        '& .MuiInputBase-input': {
                                                            fontSize: '12px',
                                                            '&::placeholder': { fontSize: '12px' }
                                                        },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                    }}
                                                    InputProps={{
                                                        ...params.InputProps,
                                                        endAdornment: (
                                                            <>
                                                                {loadingCarriers ? <CircularProgress color="inherit" size={20} /> : null}
                                                                {params.InputProps.endAdornment}
                                                            </>
                                                        ),
                                                    }}
                                                />
                                            )}
                                            renderOption={(props, option) => (
                                                <Box component="li" {...props} sx={{
                                                    fontSize: '12px',
                                                    display: 'flex !important',
                                                    alignItems: 'center !important',
                                                    py: 1.5,
                                                    px: 2,
                                                    gap: 2
                                                }}>
                                                    {/* Carrier Logo - Circular */}
                                                    <Box sx={{
                                                        width: 40,
                                                        height: 40,
                                                        borderRadius: '50%',
                                                        overflow: 'hidden',
                                                        border: '2px solid #e5e7eb',
                                                        bgcolor: '#f8fafc',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        flexShrink: 0
                                                    }}>
                                                        {option.logoURL ? (
                                                            <img
                                                                src={option.logoURL}
                                                                alt={option.name}
                                                                style={{
                                                                    width: '100%',
                                                                    height: '100%',
                                                                    objectFit: 'cover'
                                                                }}
                                                            />
                                                        ) : (
                                                            <LocalShippingIcon sx={{ fontSize: 20, color: '#9ca3af' }} />
                                                        )}
                                                    </Box>

                                                    {/* Carrier Name Only */}
                                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                                        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '13px' }}>
                                                            {option.name}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            )}
                                            sx={{
                                                '& .MuiAutocomplete-option': {
                                                    fontSize: '12px'
                                                },
                                                '& .MuiAutocomplete-popper': {
                                                    zIndex: currentView === 'addaddress' ? 800 : 1200,
                                                    display: currentView === 'addaddress' ? 'none' : 'block'
                                                }
                                            }}
                                        />
                                        <Tooltip title="Add New Carrier">
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                onClick={handleAddCarrier}
                                                sx={{
                                                    minWidth: '40px',
                                                    fontSize: '12px',
                                                    height: '40px',
                                                    px: 1
                                                }}
                                            >
                                                <AddIcon fontSize="small" />
                                            </Button>
                                        </Tooltip>
                                    </Box>

                                    {/* Enhanced Carrier info display when selected */}
                                    {selectedCarrier && quickShipCarriers.find(c => c.name === selectedCarrier) && (
                                        <Box sx={{
                                            mt: 1,
                                            p: 2,
                                            bgcolor: '#f0f9ff',
                                            borderRadius: 2,
                                            border: '1px solid #bae6fd',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 2,
                                            position: 'relative'
                                        }}>
                                            {(() => {
                                                const carrier = quickShipCarriers.find(c => c.name === selectedCarrier);
                                                return (
                                                    <>
                                                        {/* Edit Button - Top Right */}
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleEditCarrier(carrier)}
                                                            sx={{
                                                                position: 'absolute',
                                                                top: 8,
                                                                right: 8,
                                                                bgcolor: 'rgba(255, 255, 255, 0.9)',
                                                                border: '1px solid #bae6fd',
                                                                '&:hover': {
                                                                    bgcolor: 'white',
                                                                    borderColor: '#0ea5e9'
                                                                },
                                                                width: 28,
                                                                height: 28
                                                            }}
                                                        >
                                                            <EditIcon sx={{ fontSize: 14, color: '#0ea5e9' }} />
                                                        </IconButton>

                                                        {/* Carrier Logo */}
                                                        <Box sx={{
                                                            width: 50,
                                                            height: 50,
                                                            borderRadius: 2,
                                                            overflow: 'hidden',
                                                            border: '2px solid #bae6fd',
                                                            bgcolor: 'white',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                            flexShrink: 0
                                                        }}>
                                                            {carrier.logoURL ? (
                                                                <img
                                                                    src={carrier.logoURL}
                                                                    alt={carrier.name}
                                                                    style={{
                                                                        width: '100%',
                                                                        height: '100%',
                                                                        objectFit: 'contain'
                                                                    }}
                                                                />
                                                            ) : (
                                                                <LocalShippingIcon sx={{ fontSize: 28, color: '#0ea5e9' }} />
                                                            )}
                                                        </Box>

                                                        {/* Carrier Details */}
                                                        <Box sx={{ flex: 1, pr: 4 }}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                                <Typography variant="body2" sx={{ fontSize: '13px', color: '#0ea5e9', fontWeight: 600 }}>
                                                                    {carrier.name}
                                                                </Typography>
                                                                <Chip
                                                                    label={carrier.carrierType?.charAt(0).toUpperCase() + carrier.carrierType?.slice(1) || 'Freight'}
                                                                    size="small"
                                                                    sx={{
                                                                        fontSize: '10px',
                                                                        height: 18,
                                                                        bgcolor: '#0ea5e9',
                                                                        color: 'white'
                                                                    }}
                                                                />
                                                            </Box>
                                                            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                                                <Typography variant="caption" sx={{ fontSize: '11px' }}>
                                                                    <strong>Contact:</strong> {carrier.contactName}
                                                                </Typography>
                                                                <Typography variant="caption" sx={{ fontSize: '11px' }}>
                                                                    <strong>Email:</strong> {carrier.contactEmail}
                                                                </Typography>
                                                                {carrier.contactPhone && (
                                                                    <Typography variant="caption" sx={{ fontSize: '11px' }}>
                                                                        <strong>Phone:</strong> {carrier.contactPhone}
                                                                    </Typography>
                                                                )}
                                                                {carrier.accountNumber && (
                                                                    <Typography variant="caption" sx={{ fontSize: '11px' }}>
                                                                        <strong>Account:</strong> {carrier.accountNumber}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        </Box>
                                                    </>
                                                );
                                            })()}
                                        </Box>
                                    )}
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Carrier Tracking Number"
                                        value={shipmentInfo.carrierTrackingNumber}
                                        onChange={(e) => setShipmentInfo(prev => ({ ...prev, carrierTrackingNumber: e.target.value }))}
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

                            {!shipFromAddress ? (
                                <Autocomplete
                                    fullWidth
                                    options={availableAddresses}
                                    getOptionLabel={(option) => `${option.companyName} - ${formatAddressForDisplay(option)}`}
                                    value={shipFromAddress}
                                    onChange={(event, newValue) => handleAddressSelect(newValue, 'from')}
                                    loading={loadingAddresses}
                                    disabled={currentView === 'addaddress'}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Select Ship From Address"
                                            placeholder="Search addresses..."
                                            size="small"
                                            required
                                            disabled={currentView === 'addaddress'}
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
                                    alignItems: 'center',
                                    gap: 2,
                                    position: 'relative'
                                }}>
                                    {/* Edit Button - Top Right */}
                                    <IconButton
                                        size="small"
                                        onClick={() => {
                                            console.log('Edit Ship From button clicked');
                                            handleOpenEditAddress('from');
                                        }}
                                        sx={{
                                            position: 'absolute',
                                            top: 8,
                                            right: 8,
                                            bgcolor: 'rgba(255, 255, 255, 0.95)',
                                            border: '1px solid #bae6fd',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                            zIndex: 10,
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

                                    {/* Address Icon */}
                                    <Box sx={{
                                        width: 50,
                                        height: 50,
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        border: '2px solid #bae6fd',
                                        bgcolor: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <LocalShippingIcon sx={{ fontSize: 28, color: '#0ea5e9' }} />
                                    </Box>

                                    {/* Address Details */}
                                    <Box sx={{ flex: 1, pr: 4 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                            <Typography variant="body2" sx={{ fontSize: '13px', color: '#0ea5e9', fontWeight: 600 }}>
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
                                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                            <Typography variant="caption" sx={{ fontSize: '11px' }}>
                                                <strong>Contact:</strong> {shipFromAddress.firstName} {shipFromAddress.lastName}
                                            </Typography>
                                            <Typography variant="caption" sx={{ fontSize: '11px' }}>
                                                <strong>Address:</strong> {shipFromAddress.street}, {shipFromAddress.city}
                                            </Typography>
                                            <Typography variant="caption" sx={{ fontSize: '11px' }}>
                                                <strong>Location:</strong> {shipFromAddress.state}, {shipFromAddress.postalCode}
                                            </Typography>
                                            {shipFromAddress.phone && (
                                                <Typography variant="caption" sx={{ fontSize: '11px' }}>
                                                    <strong>Phone:</strong> {shipFromAddress.phone}
                                                </Typography>
                                            )}
                                            {shipFromAddress.specialInstructions && (
                                                <Typography variant="caption" sx={{ fontSize: '11px', display: 'block', mt: 1 }}>
                                                    <strong>Instructions:</strong> {shipFromAddress.specialInstructions}
                                                </Typography>
                                            )}
                                        </Box>
                                    </Box>
                                </Box>
                            )}
                        </CardContent>
                    </Card>

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

                            {!shipToAddress ? (
                                <Autocomplete
                                    fullWidth
                                    options={availableAddresses}
                                    getOptionLabel={(option) => `${option.companyName} - ${formatAddressForDisplay(option)}`}
                                    value={shipToAddress}
                                    onChange={(event, newValue) => handleAddressSelect(newValue, 'to')}
                                    loading={loadingAddresses}
                                    disabled={currentView === 'addaddress'}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Select Ship To Address"
                                            placeholder="Search addresses..."
                                            size="small"
                                            required
                                            disabled={currentView === 'addaddress'}
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
                                    alignItems: 'center',
                                    gap: 2,
                                    position: 'relative'
                                }}>
                                    {/* Edit Button - Top Right */}
                                    <IconButton
                                        size="small"
                                        onClick={() => {
                                            console.log('Edit Ship To button clicked');
                                            handleOpenEditAddress('to');
                                        }}
                                        sx={{
                                            position: 'absolute',
                                            top: 8,
                                            right: 8,
                                            bgcolor: 'rgba(255, 255, 255, 0.95)',
                                            border: '1px solid #bae6fd',
                                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                                            zIndex: 10,
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

                                    {/* Address Icon */}
                                    <Box sx={{
                                        width: 50,
                                        height: 50,
                                        borderRadius: 2,
                                        overflow: 'hidden',
                                        border: '2px solid #bae6fd',
                                        bgcolor: 'white',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <LocalShippingIcon sx={{ fontSize: 28, color: '#0ea5e9' }} />
                                    </Box>

                                    {/* Address Details */}
                                    <Box sx={{ flex: 1, pr: 4 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                            <Typography variant="body2" sx={{ fontSize: '13px', color: '#0ea5e9', fontWeight: 600 }}>
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
                                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                                            <Typography variant="caption" sx={{ fontSize: '11px' }}>
                                                <strong>Contact:</strong> {shipToAddress.firstName} {shipToAddress.lastName}
                                            </Typography>
                                            <Typography variant="caption" sx={{ fontSize: '11px' }}>
                                                <strong>Address:</strong> {shipToAddress.street}, {shipToAddress.city}
                                            </Typography>
                                            <Typography variant="caption" sx={{ fontSize: '11px' }}>
                                                <strong>Location:</strong> {shipToAddress.state}, {shipToAddress.postalCode}
                                            </Typography>
                                            {shipToAddress.phone && (
                                                <Typography variant="caption" sx={{ fontSize: '11px' }}>
                                                    <strong>Phone:</strong> {shipToAddress.phone}
                                                </Typography>
                                            )}
                                            {shipToAddress.specialInstructions && (
                                                <Typography variant="caption" sx={{ fontSize: '11px', display: 'block', mt: 1 }}>
                                                    <strong>Instructions:</strong> {shipToAddress.specialInstructions}
                                                </Typography>
                                            )}
                                        </Box>
                                    </Box>
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
                                                    sx={{
                                                        '& .MuiInputBase-root': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                    }}
                                                />
                                            </Grid>

                                            {/* Packaging Type */}
                                            <Grid item xs={12} md={4}>
                                                <FormControl fullWidth required size="small">
                                                    <InputLabel sx={{ fontSize: '12px' }}>Packaging Type</InputLabel>
                                                    <Select
                                                        value={pkg.packagingType || 258}
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
                                                    label="Width"
                                                    type="number"
                                                    value={pkg.width || ''}
                                                    onChange={(e) => updatePackage(pkg.id, 'width', e.target.value)}
                                                    required
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

                                            {/* Declared Value */}
                                            <Grid item xs={12} md={3}>
                                                <Box sx={{ display: 'flex', gap: 1 }}>
                                                    <TextField
                                                        size="small"
                                                        label="Declared Value"
                                                        type="number"
                                                        value={pkg.declaredValue || ''}
                                                        onChange={(e) => updatePackage(pkg.id, 'declaredValue', e.target.value)}
                                                        sx={{
                                                            flex: 1,
                                                            '& .MuiInputBase-root': { fontSize: '12px' },
                                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                                        }}
                                                        placeholder="0.00"
                                                    />
                                                    <FormControl size="small" sx={{ minWidth: '70px' }}>
                                                        <Select
                                                            value={pkg.declaredValueCurrency || 'CAD'}
                                                            onChange={(e) => updatePackage(pkg.id, 'declaredValueCurrency', e.target.value)}
                                                            sx={{
                                                                '& .MuiSelect-select': { fontSize: '12px', padding: '6px 8px' }
                                                            }}
                                                        >
                                                            <MenuItem value="CAD" sx={{ fontSize: '12px' }}>CAD</MenuItem>
                                                            <MenuItem value="USD" sx={{ fontSize: '12px' }}>USD</MenuItem>
                                                        </Select>
                                                    </FormControl>
                                                </Box>
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

                                            {/* Freight Class - Optional field */}
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

                                        </Grid>
                                    </Box>
                                );
                            })}
                        </CardContent>
                    </Card>

                    {/* Manual Rate Entry Section */}
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
                                                        >
                                                            <MenuItem value="" sx={{ fontSize: '12px' }}>
                                                                <em>Select Code</em>
                                                            </MenuItem>
                                                            {RATE_CODE_OPTIONS.map(option => (
                                                                <MenuItem key={option.value} value={option.value} sx={{ fontSize: '12px' }}>
                                                                    {option.label}
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                    </FormControl>
                                                </TableCell>
                                                <TableCell sx={{ width: 'auto' }}>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        value={rate.chargeName}
                                                        onChange={(e) => updateRateLineItem(rate.id, 'chargeName', e.target.value)}
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
                                            Total: {formatCurrency(totalCost, 'CAD')}
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                            Total
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
                                            </Box>
                                        </Box>

                                        {/* Helper text below the buttons on the right */}
                                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mt: 1.5 }}>
                                            Save as draft to complete later, or book now to proceed with shipping.
                                        </Typography>
                                    </Box>
                                </Box>
                            </Box>
                        </CardContent>
                    </Card>

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

                    {/* Enhanced QuickShip Carrier Dialog */}
                    <Suspense fallback={<CircularProgress />}>
                        <QuickShipCarrierDialog
                            open={showCarrierDialog}
                            onClose={() => setShowCarrierDialog(false)}
                            onSuccess={handleCarrierSuccess}
                            editingCarrier={editingCarrier}
                            isEditMode={!!editingCarrier}
                            existingCarriers={quickShipCarriers}
                            companyId={companyIdForAddress}
                        />
                    </Suspense>

                    {/* QuickShip Address Edit Dialog */}
                    <Suspense fallback={<CircularProgress />}>
                        <QuickShipAddressDialog
                            open={showAddressDialog}
                            onClose={() => {
                                setShowAddressDialog(false);
                                setEditingAddressData(null);
                            }}
                            onSuccess={handleAddressUpdated}
                            editingAddress={editingAddressData}
                            addressType={editingAddressType}
                            companyId={companyIdForAddress}
                        />
                    </Suspense>
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
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
                        Total cost: <strong>{formatCurrency(totalCost, 'CAD')}</strong>
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
        </Box>
    );
};

export default QuickShip; 