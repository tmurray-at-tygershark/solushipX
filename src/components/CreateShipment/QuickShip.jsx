import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
    FormHelperText
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    LocalShipping as LocalShippingIcon,
    FlashOn as FlashOnIcon,
    CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { useShipmentForm } from '../../contexts/ShipmentFormContext';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { getStateOptions, getStateLabel } from '../../utils/stateUtils';
import { generateShipmentId } from '../../utils/shipmentIdGenerator';
import QuickShipFrom from './QuickShipFrom';
import QuickShipTo from './QuickShipTo';
import ModalHeader from '../common/ModalHeader';
import AddCustomer from '../Customers/AddCustomer';

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
    { value: 'FRT', label: 'FRT - Freight' },
    { value: 'FUE', label: 'FUE - Fuel' },
    { value: 'ADC', label: 'ADC - Additional Charge' },
    { value: 'SUR', label: 'SUR - Surcharge' },
    { value: 'TRF', label: 'TRF - Transaction Fee' }
];

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

    // Quick Ship Carriers state
    const [quickShipCarriers, setQuickShipCarriers] = useState([]);
    const [selectedCarrier, setSelectedCarrier] = useState('');
    const [showAddCarrierDialog, setShowAddCarrierDialog] = useState(false);
    const [newCarrierName, setNewCarrierName] = useState('');
    const [newCarrierContactName, setNewCarrierContactName] = useState('');
    const [newCarrierContactEmail, setNewCarrierContactEmail] = useState('');
    const [loadingCarriers, setLoadingCarriers] = useState(false);

    // Package state
    const [packages, setPackages] = useState([{
        id: 1,
        itemDescription: '',
        packagingType: 258, // Default to PALLET(S)
        packagingQuantity: 1,
        weight: '',
        length: '',
        width: '',
        height: ''
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
    const [activeDraftId, setActiveDraftId] = useState(null);
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

    // Sliding navigation state
    const [currentView, setCurrentView] = useState('quickship'); // 'quickship' | 'addcustomer'
    const [isSliding, setIsSliding] = useState(false);

    // Ref to access QuickShipTo component methods
    const quickShipToRef = useRef();

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

    // Add new Quick Ship Carrier
    const handleAddCarrier = async () => {
        if (!newCarrierName.trim() || !companyIdForAddress) {
            setError('Carrier name is required.');
            return;
        }

        // Validate required fields
        if (!newCarrierContactName.trim()) {
            setError('Contact name is required.');
            return;
        }

        if (!newCarrierContactEmail.trim()) {
            setError('Contact email is required.');
            return;
        }

        // Validate email format
        if (!isValidEmail(newCarrierContactEmail.trim())) {
            setError('Please enter a valid email address.');
            return;
        }

        // Check for duplicate carrier names
        const isDuplicate = quickShipCarriers.some(carrier =>
            carrier.name.toLowerCase().trim() === newCarrierName.toLowerCase().trim()
        );

        if (isDuplicate) {
            setError('A carrier with this name already exists. Please choose a different name.');
            return;
        }

        try {
            const carrierData = {
                name: newCarrierName.trim(),
                contactName: newCarrierContactName.trim(),
                contactEmail: newCarrierContactEmail.trim(),
                companyID: companyIdForAddress,
                createdAt: serverTimestamp()
            };

            const docRef = await addDoc(collection(db, 'quickshipCarriers'), carrierData);

            // Add to local state
            const newCarrier = {
                id: docRef.id,
                ...carrierData,
                createdAt: new Date()
            };
            setQuickShipCarriers(prev => [...prev, newCarrier]);

            // Select the new carrier
            setSelectedCarrier(newCarrierName.trim());

            // Update manual rates with new carrier
            setManualRates(prev => prev.map(rate => ({
                ...rate,
                carrier: newCarrierName.trim()
            })));

            // Clear form fields
            setNewCarrierName('');
            setNewCarrierContactName('');
            setNewCarrierContactEmail('');
            setShowAddCarrierDialog(false);
        } catch (error) {
            console.error('Error adding quick ship carrier:', error);
            setError('Failed to add carrier. Please try again.');
        }
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

    // Handle unit system change
    const handleUnitChange = (event) => {
        const newUnitSystem = event.target.checked ? 'metric' : 'imperial';
        if (newUnitSystem !== unitSystem) {
            const updatedPackages = packages.map(pkg => {
                const updatedPkg = { ...pkg };
                if (pkg.weight) {
                    if (unitSystem === 'imperial' && newUnitSystem === 'metric') {
                        updatedPkg.weight = lbsToKg(pkg.weight);
                    } else if (unitSystem === 'metric' && newUnitSystem === 'imperial') {
                        updatedPkg.weight = kgToLbs(pkg.weight);
                    }
                }
                if (pkg.length) {
                    if (unitSystem === 'imperial' && newUnitSystem === 'metric') {
                        updatedPkg.length = inchesToCm(pkg.length);
                    } else if (unitSystem === 'metric' && newUnitSystem === 'imperial') {
                        updatedPkg.length = cmToInches(pkg.length);
                    }
                }
                if (pkg.width) {
                    if (unitSystem === 'imperial' && newUnitSystem === 'metric') {
                        updatedPkg.width = inchesToCm(pkg.width);
                    } else if (unitSystem === 'metric' && newUnitSystem === 'imperial') {
                        updatedPkg.width = cmToInches(pkg.width);
                    }
                }
                if (pkg.height) {
                    if (unitSystem === 'imperial' && newUnitSystem === 'metric') {
                        updatedPkg.height = inchesToCm(pkg.height);
                    } else if (unitSystem === 'metric' && newUnitSystem === 'imperial') {
                        updatedPkg.height = cmToInches(pkg.height);
                    }
                }
                return updatedPkg;
            });

            setPackages(updatedPackages);
            setUnitSystem(newUnitSystem);
        }
    };

    // Package management functions
    const addPackage = () => {
        const newId = Math.max(...packages.map(p => p.id), 0) + 1;
        setPackages(prev => [...prev, {
            id: newId,
            itemDescription: '',
            packagingType: 258,
            packagingQuantity: 1,
            weight: '',
            length: '',
            width: '',
            height: ''
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
        setManualRates(prev => prev.map(rate =>
            rate.id === id ? { ...rate, [field]: value } : rate
        ));
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

    // Sliding navigation handlers
    const handleOpenAddCustomer = () => {
        setIsSliding(true);
        setTimeout(() => {
            setCurrentView('addcustomer');
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

    // Handle customer creation callback
    const handleCustomerCreated = async (newCustomerId) => {
        console.log('Customer created with ID:', newCustomerId);

        // Slide back to QuickShip
        handleBackToQuickShip();

        // Small delay to ensure view has changed, then refresh customer list
        setTimeout(() => {
            if (quickShipToRef.current && quickShipToRef.current.refreshCustomers) {
                quickShipToRef.current.refreshCustomers(newCustomerId);
            }
        }, 200);
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
                    packagingType: 258,
                    packagingQuantity: 1,
                    weight: '',
                    length: '',
                    width: '',
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
        // Validate required fields
        if (!selectedCarrier) {
            setError('Please select a carrier before booking.');
            return;
        }
        if (!formData.shipFrom || !formData.shipTo) {
            setError('Please complete both ship from and ship to addresses.');
            return;
        }
        if (!formData.shipTo?.customerID) {
            setError('Please select a customer for the destination.');
            return;
        }
        if (packages.length === 0) {
            setError('Please add at least one package.');
            return;
        }
        if (manualRates.length === 0) {
            setError('Please add at least one rate line item.');
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
        bookQuickShipment();
    };

    // Main QuickShip booking function
    const bookQuickShipment = async () => {
        setIsBooking(true);
        setError(null);

        try {
            // Get customer ID for shipment ID generation
            const customerId = formData.shipTo?.customerID;
            if (!customerId) {
                throw new Error('Customer ID is required for booking.');
            }

            // Generate proper shipment ID
            let shipmentID;
            try {
                shipmentID = await generateShipmentId(companyIdForAddress, customerId);
                console.log('Generated QuickShip shipmentID:', shipmentID);
            } catch (idError) {
                console.warn('Failed to generate shipmentID, using fallback:', idError);
                const timestamp = Date.now().toString().slice(-8);
                shipmentID = `${companyIdForAddress}-${customerId}-${timestamp}`;
            }

            // Get selected carrier details
            const carrierDetails = quickShipCarriers.find(c => c.name === selectedCarrier) || {
                name: selectedCarrier,
                contactName: '',
                contactEmail: ''
            };

            // Prepare shipment data
            const shipmentData = {
                // Basic shipment info
                shipmentID: shipmentID,
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
                    actualShipDate: new Date().toISOString().split('T')[0]
                },

                // Addresses
                shipFrom: formData.shipFrom,
                shipTo: formData.shipTo,

                // Packages
                packages: packages,

                // Carrier and rates
                carrier: selectedCarrier,
                carrierType: 'manual',
                carrierDetails: carrierDetails,
                manualRates: manualRates,
                totalCharges: totalCost,
                currency: 'CAD',
                unitSystem: unitSystem,

                // Tracking
                trackingNumber: shipmentInfo.carrierTrackingNumber || shipmentID, // Use carrier tracking number if provided, otherwise fall back to shipment ID

                // QuickShip specific flags
                isQuickShip: true,
                rateSource: 'manual'
            };

            console.log('QuickShip booking data:', shipmentData);

            // Call the QuickShip booking function
            const functions = getFunctions();
            const bookQuickShipFunction = httpsCallable(functions, 'bookQuickShipment');

            const result = await bookQuickShipFunction({
                shipmentData: shipmentData,
                carrierDetails: carrierDetails
            });

            console.log('QuickShip booking result:', result);

            if (result.data && result.data.success) {
                const bookingDetails = result.data.data;
                setFinalShipmentId(shipmentID);

                // Generate BOL and Carrier Confirmation for QuickShip bookings
                console.log('QuickShip booking successful, generating documents...');

                // Get selected carrier details
                const selectedCarrierDetails = quickShipCarriers.find(c => c.name === selectedCarrier) || {
                    name: selectedCarrier,
                    contactName: '',
                    contactEmail: ''
                };

                // Use the Firebase document ID from the booking response or fall back to shipmentID
                const firebaseDocId = bookingDetails?.firebaseDocId || bookingDetails?.documentId || shipmentID;

                generateQuickShipDocuments(shipmentID, firebaseDocId, selectedCarrierDetails);

            } else {
                const errorMessage = result.data?.error || 'Failed to book QuickShip shipment.';
                console.error('QuickShip booking error:', errorMessage);
                setError(errorMessage);
                setBookingStep('error');
            }

        } catch (error) {
            console.error('Error booking QuickShip:', error);
            setError(`Failed to book shipment: ${error.message}`);
            setBookingStep('error');
        } finally {
            setIsBooking(false);
        }
    };

    // Handle booking completion
    const handleBookingComplete = () => {
        setShowBookingDialog(false);

        // Navigate back to shipments
        if (onReturnToShipments) {
            onReturnToShipments();
        } else if (onClose) {
            onClose();
        }
    };

    // Handle view shipment - navigate to shipment detail
    const handleViewShipment = () => {
        setShowBookingDialog(false);

        if (onViewShipment && finalShipmentId) {
            // Close QuickShip modal and open shipment detail with deep link
            onViewShipment(finalShipmentId);
        } else if (onReturnToShipments) {
            onReturnToShipments();
        } else if (onClose) {
            onClose();
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
                    setActiveDraftId(draftShipmentId);

                    // Load form context data immediately (no delay)
                    if (draftData.shipFrom) {
                        console.log('Loading shipFrom data:', draftData.shipFrom);
                        updateFormSection('shipFrom', draftData.shipFrom);
                    }
                    if (draftData.shipTo) {
                        console.log('Loading shipTo data:', draftData.shipTo);
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
                                packagingType: pkg.packagingType || 258,
                                packagingQuantity: pkg.packagingQuantity || 1,
                                weight: pkg.weight || '',
                                length: pkg.length || '',
                                width: pkg.width || '',
                                height: pkg.height || ''
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

                        // Set draft state first to ensure components know they're in edit mode
                        setIsEditingDraft(true);
                        setActiveDraftId(draftId);

                        // Load form context data immediately (no delay)
                        if (draftData.shipFrom) {
                            console.log('Loading shipFrom data:', draftData.shipFrom);
                            updateFormSection('shipFrom', draftData.shipFrom);
                        }
                        if (draftData.shipTo) {
                            console.log('Loading shipTo data:', draftData.shipTo);
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
                                    packagingType: pkg.packagingType || 258,
                                    packagingQuantity: pkg.packagingQuantity || 1,
                                    weight: pkg.weight || '',
                                    length: pkg.length || '',
                                    width: pkg.width || '',
                                    height: pkg.height || ''
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
    }, [draftId, updateFormSection, onReturnToShipments]);

    // Additional effect to ensure components are properly updated when draft editing begins
    useEffect(() => {
        if (isEditingDraft && activeDraftId) {
            // Force a small delay to ensure all components have properly re-rendered with the new key
            const timer = setTimeout(() => {
                console.log('Draft editing mode active, ensuring components are updated');
                // No need to call updateFormSection here as the data is already loaded in loadDraftData
            }, 100);

            return () => clearTimeout(timer);
        }
    }, [isEditingDraft, activeDraftId]);

    // Ship Later - Save as QuickShip draft
    const handleShipLater = async () => {
        if (!companyIdForAddress || !currentUser) {
            setError('Missing required information to save draft.');
            return;
        }

        // Check if we have customer information for shipmentID generation
        const customerId = formData.shipTo?.customerID;
        if (!customerId) {
            setError('Please select a customer before saving draft.');
            return;
        }

        setIsSavingDraft(true);
        try {
            let shipmentID;

            // Generate proper shipmentID using the same logic as CreateShipment
            try {
                shipmentID = await generateShipmentId(companyIdForAddress, customerId);
                console.log('Generated QuickShip shipmentID:', shipmentID);
            } catch (idError) {
                console.warn('Failed to generate shipmentID, using fallback:', idError);
                // Fallback to timestamp-based ID if generation fails
                const timestamp = Date.now().toString().slice(-8);
                shipmentID = `${companyIdForAddress}-${customerId}-${timestamp}`;
            }

            // Prepare draft data with all current QuickShip state
            const draftData = {
                // Shipment metadata
                status: 'draft',
                creationMethod: 'quickship', // Key field to identify QuickShip drafts
                companyID: companyIdForAddress,
                createdBy: currentUser.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),

                // Set the proper shipmentID
                shipmentID: shipmentID,

                // QuickShip specific data
                shipmentInfo,
                selectedCarrier,
                packages,
                manualRates,
                unitSystem,

                // Address data from form context
                shipFrom: formData.shipFrom,
                shipTo: formData.shipTo,

                // Carrier information for proper display in table
                carrier: selectedCarrier, // Direct carrier field as fallback

                // Draft-specific fields
                isDraft: true,
                draftSource: 'quickship'
            };

            let docRef;
            let message;

            if (isEditingDraft && activeDraftId) {
                // Update existing draft
                docRef = doc(db, 'shipments', activeDraftId);
                await updateDoc(docRef, {
                    ...draftData,
                    updatedAt: serverTimestamp()
                });
                message = 'Draft updated successfully!';
            } else {
                // Create new draft
                docRef = await addDoc(collection(db, 'shipments'), draftData);
                message = 'Draft saved successfully!';
            }

            console.log('QuickShip draft saved:', docRef.id || activeDraftId);

            // Show success message
            setDraftSaved(true);

            // Return to shipments after showing success message
            setTimeout(() => {
                if (onReturnToShipments) {
                    onReturnToShipments();
                }
            }, 1500);

        } catch (error) {
            console.error('Error saving QuickShip draft:', error);
            setError('Failed to save draft. Please try again.');
        } finally {
            setIsSavingDraft(false);
        }
    };

    return (
        <Box sx={{ width: '100%', height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {/* Modal Header */}
            {isModal && (
                <ModalHeader
                    title={currentView === 'addcustomer'
                        ? 'Add Customer'
                        : isEditingDraft
                            ? 'Edit Quick Ship Draft'
                            : 'Quick Ship'
                    }
                    onBack={currentView === 'addcustomer' ? handleBackToQuickShip : onReturnToShipments}
                    showBackButton={currentView === 'addcustomer' || !!onReturnToShipments}
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
                transform: currentView === 'addcustomer' ? 'translateX(-50%)' : 'translateX(0%)',
                transition: 'transform 0.3s ease-in-out',
                opacity: isSliding ? 0.8 : 1
            }}>
                {/* QuickShip Main View */}
                <Box sx={{ width: '50%', overflow: 'auto', p: 3 }}>
                    {error && (
                        <Alert severity="error" sx={{ mb: 3 }}>
                            {error}
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
                                        <InputLabel>Shipment Type</InputLabel>
                                        <Select
                                            value={shipmentInfo.shipmentType}
                                            onChange={(e) => setShipmentInfo(prev => ({ ...prev, shipmentType: e.target.value }))}
                                            label="Shipment Type"
                                            sx={{ fontSize: '12px' }}
                                        >
                                            <MenuItem value="courier">Courier</MenuItem>
                                            <MenuItem value="freight">Freight</MenuItem>
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
                                        InputLabelProps={{ shrink: true }}
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'stretch' }}>
                                        <Autocomplete
                                            fullWidth
                                            size="small"
                                            options={quickShipCarriers.map(c => c.name)}
                                            value={selectedCarrier}
                                            onChange={(event, newValue) => handleCarrierChange(newValue || '')}
                                            freeSolo
                                            loading={loadingCarriers}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="Carrier Name"
                                                    required
                                                    sx={{
                                                        '& .MuiInputBase-input': { fontSize: '12px' },
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
                                            sx={{
                                                '& .MuiAutocomplete-option': {
                                                    fontSize: '12px'
                                                }
                                            }}
                                        />
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            onClick={() => setShowAddCarrierDialog(true)}
                                            sx={{
                                                minWidth: '40px',
                                                fontSize: '12px',
                                                height: '40px',  // Match the height of the Autocomplete field
                                                px: 1
                                            }}
                                        >
                                            <AddIcon fontSize="small" />
                                        </Button>
                                    </Box>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Carrier Tracking Number"
                                        value={shipmentInfo.carrierTrackingNumber}
                                        onChange={(e) => setShipmentInfo(prev => ({ ...prev, carrierTrackingNumber: e.target.value }))}
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Reference Number"
                                        value={shipmentInfo.shipperReferenceNumber}
                                        onChange={(e) => setShipmentInfo(prev => ({ ...prev, shipperReferenceNumber: e.target.value }))}
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Bill Type</InputLabel>
                                        <Select
                                            value={shipmentInfo.billType}
                                            onChange={(e) => setShipmentInfo(prev => ({ ...prev, billType: e.target.value }))}
                                            label="Bill Type"
                                            sx={{ fontSize: '12px' }}
                                        >
                                            <MenuItem value="prepaid">Prepaid (Sender Pays)</MenuItem>
                                            <MenuItem value="collect">Collect (Receiver Pays)</MenuItem>
                                            <MenuItem value="third_party">Third Party</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>

                    {/* Ship From Section */}
                    <Card sx={{ mb: 3, border: '1px solid #e5e7eb', borderRadius: 2 }}>
                        <CardContent sx={{ p: 0 }}>
                            <QuickShipFrom
                                key={`shipfrom-${activeDraftId || 'new'}-${isEditingDraft ? 'edit' : 'new'}-${formData.shipFrom?.id || 'no-id'}`}
                                onNext={() => { }}
                            />
                        </CardContent>
                    </Card>

                    {/* Ship To Section */}
                    <Card sx={{ mb: 3, border: '1px solid #e5e7eb', borderRadius: 2 }}>
                        <CardContent sx={{ p: 0 }}>
                            <QuickShipTo
                                key={`shipto-${activeDraftId || 'new'}-${isEditingDraft ? 'edit' : 'new'}-${formData.shipTo?.customerID || 'no-customer'}`}
                                ref={quickShipToRef}
                                onNext={() => { }}
                                onOpenAddCustomer={handleOpenAddCustomer}
                            />
                        </CardContent>
                    </Card>

                    {/* Packages Section */}
                    <Card sx={{ mb: 3, border: '1px solid #e5e7eb', borderRadius: 2 }}>
                        <CardContent sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                    Package Information
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>Imperial</Typography>
                                        <Switch
                                            checked={unitSystem === 'metric'}
                                            onChange={handleUnitChange}
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
                                    <Button
                                        size="small"
                                        startIcon={<AddIcon />}
                                        onClick={addPackage}
                                        sx={{ fontSize: '12px' }}
                                    >
                                        Add Package
                                    </Button>
                                </Box>
                            </Box>

                            {packages.map((pkg, index) => {
                                console.log(`Rendering package ${index + 1}:`, pkg);
                                return (
                                    <Box
                                        key={`${pkg.id}-${isEditingDraft ? activeDraftId : 'new'}`}
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
                                                                    {unitSystem === 'metric' ? 'cm' : 'in'}
                                                                </Box>
                                                            </InputAdornment>
                                                        )
                                                    }}
                                                />
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
                                    Manual Rate Entry
                                </Typography>
                                <Button
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
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Carrier</TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Code</TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Charge Name</TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Cost</TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Currency</TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Charge</TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Currency</TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {manualRates.map((rate) => (
                                            <TableRow key={rate.id}>
                                                <TableCell>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        value={rate.carrier}
                                                        onChange={(e) => updateRateLineItem(rate.id, 'carrier', e.target.value)}
                                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                    />
                                                </TableCell>
                                                <TableCell>
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
                                                <TableCell>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        value={rate.chargeName}
                                                        onChange={(e) => updateRateLineItem(rate.id, 'chargeName', e.target.value)}
                                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        type="number"
                                                        value={rate.cost}
                                                        onChange={(e) => updateRateLineItem(rate.id, 'cost', e.target.value)}
                                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <FormControl fullWidth size="small">
                                                        <Select
                                                            value={rate.costCurrency}
                                                            onChange={(e) => updateRateLineItem(rate.id, 'costCurrency', e.target.value)}
                                                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                                        >
                                                            <MenuItem value="CAD" sx={{ fontSize: '12px' }}>CAD</MenuItem>
                                                            <MenuItem value="USD" sx={{ fontSize: '12px' }}>USD</MenuItem>
                                                        </Select>
                                                    </FormControl>
                                                </TableCell>
                                                <TableCell>
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        type="number"
                                                        value={rate.charge}
                                                        onChange={(e) => updateRateLineItem(rate.id, 'charge', e.target.value)}
                                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <FormControl fullWidth size="small">
                                                        <Select
                                                            value={rate.chargeCurrency}
                                                            onChange={(e) => updateRateLineItem(rate.id, 'chargeCurrency', e.target.value)}
                                                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                                        >
                                                            <MenuItem value="CAD" sx={{ fontSize: '12px' }}>CAD</MenuItem>
                                                            <MenuItem value="USD" sx={{ fontSize: '12px' }}>USD</MenuItem>
                                                        </Select>
                                                    </FormControl>
                                                </TableCell>
                                                <TableCell>
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

                            {/* Enhanced Total Cost Display */}
                            <Box sx={{ mt: 3, textAlign: 'right', p: 2, bgcolor: '#f8fafc', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                                <Typography variant="h4" sx={{
                                    fontSize: '24px',
                                    fontWeight: 700,
                                    color: '#1f2937',
                                    mb: 0.5
                                }}>
                                    Total: {formatCurrency(totalCost, 'CAD')}
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                    Manual Rate Entry Total
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>

                    {/* Action Buttons */}
                    <Card sx={{ mb: 3, border: '1px solid #e5e7eb', borderRadius: 2 }}>
                        <CardContent sx={{ p: 3 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
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
                                        {isSavingDraft ? 'Saving...' : isEditingDraft ? 'Update Draft' : 'Ship Later'}
                                    </Button>
                                    <Button
                                        variant="contained"
                                        color="primary"
                                        onClick={handleBookShipment}
                                        disabled={isSavingDraft || isDraftLoading || isBooking || !selectedCarrier || packages.length === 0}
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
                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mt: 1 }}>
                                {isEditingDraft
                                    ? 'Update your draft to save changes, or book the shipment to proceed with shipping.'
                                    : 'Save as draft to complete later, or book now to proceed with shipping.'
                                }
                            </Typography>
                        </CardContent>
                    </Card>

                    {/* Add Carrier Dialog */}
                    <Dialog
                        open={showAddCarrierDialog}
                        onClose={() => setShowAddCarrierDialog(false)}
                        maxWidth="sm"
                        fullWidth
                    >
                        <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>Add Quick Ship Carrier</DialogTitle>
                        <DialogContent>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Carrier Name"
                                    value={newCarrierName}
                                    onChange={(e) => {
                                        setNewCarrierName(e.target.value);
                                        setError(null); // Clear errors when typing
                                    }}
                                    required
                                    sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                />
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Contact Name *"
                                    value={newCarrierContactName}
                                    onChange={(e) => {
                                        setNewCarrierContactName(e.target.value);
                                        setError(null); // Clear errors when typing
                                    }}
                                    required
                                    sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                />
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="Contact Email *"
                                    type="email"
                                    value={newCarrierContactEmail}
                                    onChange={(e) => {
                                        setNewCarrierContactEmail(e.target.value);
                                        setError(null); // Clear errors when typing
                                    }}
                                    required
                                    sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                    helperText="Email for carrier confirmations"
                                    FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                                />
                            </Box>
                        </DialogContent>
                        <DialogActions>
                            <Button
                                onClick={() => {
                                    setShowAddCarrierDialog(false);
                                    setNewCarrierName('');
                                    setNewCarrierContactName('');
                                    setNewCarrierContactEmail('');
                                    setError(null); // Clear any errors
                                }}
                                sx={{ fontSize: '12px' }}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleAddCarrier}
                                variant="contained"
                                disabled={!newCarrierName.trim() || !newCarrierContactName.trim() || !newCarrierContactEmail.trim()}
                                sx={{ fontSize: '12px' }}
                            >
                                Add Carrier
                            </Button>
                        </DialogActions>
                    </Dialog>
                </Box>

                {/* AddCustomer View */}
                <Box sx={{ width: '50%', overflow: 'auto' }}>
                    {currentView === 'addcustomer' && (
                        <AddCustomer
                            isModal={true}
                            hideModalHeader={true}
                            onBackToTable={handleBackToQuickShip}
                            onCustomerCreated={handleCustomerCreated}
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
        </Box>
    );
};

export default QuickShip; 