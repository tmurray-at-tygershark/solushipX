import React, { useState, useEffect, useMemo, useCallback, useContext, useRef, Suspense, lazy } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Alert,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Tabs,
    Tab,
    Toolbar,
    TablePagination,
    IconButton,
    Slide,
    Grid,
    TextField,
    InputAdornment,
    Collapse,
    Chip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Snackbar,
    Drawer,
    ListSubheader,
    Autocomplete,
    Divider
} from '@mui/material';
import {
    Add as AddIcon,
    FilterList as FilterIcon,
    GetApp as ExportIcon,
    Refresh as RefreshIcon,
    ArrowBackIosNew as ArrowBackIosNewIcon,
    Close as CloseIcon,
    Search as SearchIcon,
    Clear as ClearIcon,
    Description as DescriptionIcon,
    QrCode as QrCodeIcon,
    FilterAlt as FilterAltIcon,
    CalendarToday as CalendarIcon,
    FirstPage,
    KeyboardArrowLeft,
    KeyboardArrowRight,
    LastPage,
    FlashOn as FlashOnIcon
} from '@mui/icons-material';
import { DateRangePicker } from '@mui/x-date-pickers-pro/DateRangePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { collection, getDocs, query, where, orderBy, doc, deleteDoc, getDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import './Shipments.css';

// Import common components
import ModalHeader from '../common/ModalHeader';
import EnhancedStatusFilter from '../StatusChip/EnhancedStatusFilter';

// Import modular components
import ShipmentFilters from './components/ShipmentFilters';
import ShipmentsTable from './components/ShipmentsTable';
import ShipmentsTableSkeleton from './components/ShipmentsTableSkeleton';
import ShipmentsPagination from './components/ShipmentsPagination';
import ExportDialog from './components/ExportDialog';
import PrintDialog from './components/PrintDialog';
import PdfViewerDialog from './components/PdfViewerDialog';
import DeleteConfirmDialog from './components/DeleteConfirmDialog';
import ShipmentActionMenu from './components/ShipmentActionMenu';
import StatusUpdateDialog from './components/StatusUpdateDialog';
import TrackingDrawerContent from '../Tracking/Tracking';

// Import utilities
import {
    hasEnabledCarriers,
    getShipmentStatusGroup,
    checkDocumentAvailability
} from './utils/shipmentHelpers';
import { carrierOptions } from './utils/carrierOptions';

// Import hooks
import { useCarrierAgnosticStatusUpdate } from '../../hooks/useCarrierAgnosticStatusUpdate';
import useModalNavigation from '../../hooks/useModalNavigation';

// Import ShipmentDetailX for the sliding view
const ShipmentDetailX = React.lazy(() => import('../ShipmentDetail/ShipmentDetailX'));

const ShipmentsX = ({ isModal = false, onClose = null, showCloseButton = false, onModalBack = null, deepLinkParams = null, onOpenCreateShipment = null, onClearDeepLinkParams = null }) => {
    console.log('🚢 ShipmentsX component loaded with props:', { isModal, showCloseButton, deepLinkParams, onOpenCreateShipment });

    // Auth and company context
    const { user, loading: authLoading } = useAuth();
    const { companyIdForAddress, loading: companyCtxLoading, companyData } = useCompany();

    const navigate = useNavigate();

    // Modal navigation system
    const modalNavigation = useModalNavigation({
        title: 'Shipments',
        shortTitle: 'Shipments',
        component: 'shipments'
    });

    // Main data states (moved before useEffects that reference them)
    const [shipments, setShipments] = useState([]);
    const [allShipments, setAllShipments] = useState([]);
    const [customers, setCustomers] = useState({});
    const [carrierData, setCarrierData] = useState({});
    const [loading, setLoading] = useState(false);
    const [totalCount, setTotalCount] = useState(0);

    // Tab and filter states
    const [selectedTab, setSelectedTab] = useState('all');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [selected, setSelected] = useState([]);

    // Filter states
    const [filters, setFilters] = useState({
        status: 'all',
        carrier: 'all',
        dateRange: [null, null],
        shipmentType: 'all',
        enhancedStatus: ''
    });
    const [searchFields, setSearchFields] = useState({
        shipmentId: '',
        referenceNumber: '',
        trackingNumber: '',
        customerName: '',
        origin: '',
        destination: ''
    });
    const [dateRange, setDateRange] = useState([null, null]);
    const [selectedCustomer, setSelectedCustomer] = useState('');

    // UI states
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'info'
    });

    // Dialog states
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [selectedExportFormat, setSelectedExportFormat] = useState('csv');
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [actionMenuAnchorEl, setActionMenuAnchorEl] = useState(null);
    const [refreshingStatus, setRefreshingStatus] = useState(new Set());
    const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
    const [pdfUrl, setPdfUrl] = useState('');
    const [pdfTitle, setPdfTitle] = useState('');

    // Draft deletion states
    const [isDeleteDraftsDialogOpen, setIsDeleteDraftsDialogOpen] = useState(false);
    const [isDeletingDrafts, setIsDeletingDrafts] = useState(false);

    // Add new state for document availability
    const [documentAvailability, setDocumentAvailability] = useState({});
    const [checkingDocuments, setCheckingDocuments] = useState(false);

    // Add tracking drawer state
    const [isTrackingDrawerOpen, setIsTrackingDrawerOpen] = useState(false);
    const [currentTrackingNumber, setCurrentTrackingNumber] = useState('');

    // Add status update states
    const [isUpdating, setIsUpdating] = useState(false);
    const [statusUpdateProgress, setStatusUpdateProgress] = useState({});
    const [statusUpdateResults, setStatusUpdateResults] = useState([]);

    // Add new states for modular sliding navigation
    const [navigationStack, setNavigationStack] = useState([
        { key: 'table', component: 'table', props: {} }
    ]);
    const [sliding, setSliding] = useState(false);
    const [slideDirection, setSlideDirection] = useState('forward'); // 'forward' or 'backward'
    const [mountedViews, setMountedViews] = useState(['table']);

    // Initialize state from deep link parameters only
    useEffect(() => {
        // Handle deep link parameters from modal navigation
        if (deepLinkParams) {
            console.log('Applying deep link parameters:', deepLinkParams);
            if (deepLinkParams.customerId) {
                setSelectedCustomer(deepLinkParams.customerId);
                setFiltersOpen(true); // Open filters when deep linking
            }
            if (deepLinkParams.shipmentId) {
                setSearchFields(prev => ({ ...prev, shipmentId: deepLinkParams.shipmentId }));
                setFiltersOpen(true);
            }
            if (deepLinkParams.trackingNumber) {
                setSearchFields(prev => ({ ...prev, trackingNumber: deepLinkParams.trackingNumber }));
                setFiltersOpen(true);
            }
            if (deepLinkParams.status && deepLinkParams.status !== 'all') {
                setFilters(prev => ({ ...prev, status: deepLinkParams.status }));
                setFiltersOpen(true);
            }
            if (deepLinkParams.carrier && deepLinkParams.carrier !== 'all') {
                setFilters(prev => ({ ...prev, carrier: deepLinkParams.carrier }));
                setFiltersOpen(true);
            }
            if (deepLinkParams.tab) {
                setSelectedTab(deepLinkParams.tab);
            }
        }

        // CRITICAL SESSION CLEANUP: Clear auto-open state when deep link params change
        return () => {
            console.log('🧹 Deep link params changed - clearing auto-open state');
            setHasAutoOpenedShipment(false);
        };
    }, [deepLinkParams]);

    // Helper function to show snackbar
    const showSnackbar = useCallback((message, severity = 'info') => {
        setSnackbar({
            open: true,
            message,
            severity
        });
    }, []);

    // Generic navigation push
    const pushView = useCallback((view) => {
        console.log('➡️ pushView called with:', view.key);

        setSlideDirection('forward');
        setSliding(true);

        // Add the new view to mounted views immediately
        setMountedViews((prev) => {
            const newMounted = Array.from(new Set([...prev, view.key]));
            console.log('🏠 Updated mounted views:', newMounted);
            return newMounted;
        });

        console.log('🎬 Starting forward slide animation');

        // Update navigation stack after a brief delay to allow state to settle
        setTimeout(() => {
            setNavigationStack((prev) => {
                const newStack = [...prev, view];
                console.log('📚 Updated navigation stack:', newStack.map(v => v.key));
                return newStack;
            });

            // End sliding animation
            setTimeout(() => {
                setSliding(false);
                console.log('✅ pushView complete');
            }, 300); // Match CSS transition duration
        }, 10);
    }, []);

    // Generic navigation pop
    const popView = useCallback(() => {
        console.log('🔙 popView called, current stack:', navigationStack.length);

        if (navigationStack.length <= 1) {
            console.log('⚠️ Cannot pop - only one view in stack');
            return;
        }

        // CRITICAL FIX: Clear auto-open state when popping back to table
        console.log('🧹 Clearing auto-open state during popView');
        setHasAutoOpenedShipment(false);

        // CRITICAL FIX: Clear deep link parameters to prevent auto-navigation loop
        if (onClearDeepLinkParams) {
            console.log('🧹 Calling onClearDeepLinkParams to prevent auto-navigation loop');
            onClearDeepLinkParams();
        }

        // Set sliding state and direction
        setSlideDirection('backward');
        setSliding(true);

        console.log('🎬 Starting backward slide animation');

        // After animation completes, update the navigation stack and mounted views
        setTimeout(() => {
            console.log('🔄 Animation complete, updating navigation stack');

            setNavigationStack((prevStack) => {
                const newStack = prevStack.slice(0, -1);
                console.log('📚 New navigation stack:', newStack.map(v => v.key));
                return newStack;
            });

            setMountedViews((prevMounted) => {
                const newMounted = prevMounted.slice(0, -1);
                console.log('🏠 New mounted views:', newMounted);
                return newMounted;
            });

            setSliding(false);
            console.log('✅ popView complete');
        }, 300); // Match CSS transition duration
    }, [navigationStack.length, onClearDeepLinkParams]);

    // Add handler for viewing shipment detail - moved before useEffect that uses it
    const handleViewShipmentDetail = useCallback((shipmentId) => {
        // Find the shipment to get its details for the title
        const shipment = shipments.find(s => s.id === shipmentId) || { shipmentID: shipmentId };

        // Create the shipment detail view and push it to navigation stack
        pushView({
            key: `shipment-detail-${shipmentId}`,
            component: 'shipment-detail',
            props: { shipmentId }
        });

        // Update modal navigation for proper back button handling
        modalNavigation.navigateTo({
            title: `${shipment.shipmentID || shipmentId}`,
            shortTitle: shipment.shipmentID || shipmentId,
            component: 'shipment-detail',
            data: { shipmentId }
        });
    }, [shipments, pushView, modalNavigation]);

    // Auto-open shipment detail if specified in deep link params
    const [hasAutoOpenedShipment, setHasAutoOpenedShipment] = useState(false);

    useEffect(() => {
        // SAFETY CHECK: Only run if we're in table view (not already in detail view)
        if (navigationStack.length > 1) {
            console.log('🚫 Skipping auto-open - already in detail view');
            return;
        }

        // Handle direct-to-detail navigation from QuickShip "View Shipment"
        if (deepLinkParams && deepLinkParams.directToDetail && deepLinkParams.selectedShipmentId && shipments.length > 0 && !hasAutoOpenedShipment) {
            console.log('Direct-to-detail navigation triggered for shipment:', deepLinkParams.selectedShipmentId);

            const shipment = shipments.find(s =>
                s.shipmentID === deepLinkParams.selectedShipmentId ||
                s.id === deepLinkParams.selectedShipmentId
            );

            if (shipment) {
                // Use the document ID to open the detail view directly
                handleViewShipmentDetail(shipment.id);
                setHasAutoOpenedShipment(true); // Prevent running again
                console.log('✅ Auto-opened shipment detail and set flag to prevent re-opening');

                // CRITICAL: Clear deep link parameters to prevent navigation loop
                if (onClearDeepLinkParams) {
                    onClearDeepLinkParams();
                    console.log('🧹 Cleared deep link parameters after auto-opening shipment detail');
                }
            } else {
                console.warn('Shipment not found for direct-to-detail navigation:', deepLinkParams.selectedShipmentId);
            }
        }
        // Handle legacy auto-open shipment detail if specified in deep link params (for backwards compatibility)
        else if (deepLinkParams && deepLinkParams.shipmentId && shipments.length > 0 && !hasAutoOpenedShipment) {
            const shipment = shipments.find(s =>
                s.shipmentID === deepLinkParams.shipmentId ||
                s.id === deepLinkParams.shipmentId
            );

            if (shipment) {
                // Use the document ID to open the detail view
                handleViewShipmentDetail(shipment.id);
                setHasAutoOpenedShipment(true); // Prevent running again
                console.log('✅ Auto-opened shipment detail (legacy) and set flag to prevent re-opening');

                // CRITICAL: Clear deep link parameters to prevent navigation loop
                if (onClearDeepLinkParams) {
                    onClearDeepLinkParams();
                    console.log('🧹 Cleared deep link parameters after auto-opening shipment detail (legacy)');
                }
            } else {
                console.warn('Shipment not found for auto-detail open:', deepLinkParams.shipmentId);
            }
        }
    }, [deepLinkParams, shipments, handleViewShipmentDetail, hasAutoOpenedShipment, navigationStack]); // Include navigationStack to check current view

    // Resolve customer name from customer ID after customers are loaded
    useEffect(() => {
        // Handle deep link parameters
        if (deepLinkParams && deepLinkParams.customerId && Object.keys(customers).length > 0) {
            const customerName = customers[deepLinkParams.customerId];
            if (customerName) {
                setSearchFields(prev => ({ ...prev, customerName: customerName }));
                console.log('Resolved deep link customer ID to name:', { customerId: deepLinkParams.customerId, customerName });
            } else {
                console.log('Could not resolve deep link customer ID:', { customerId: deepLinkParams.customerId, availableCustomers: Object.keys(customers) });
            }
        }
    }, [customers, deepLinkParams]);

    // Calculate stats using consistent direct status matching
    const stats = useMemo(() => {
        if (!allShipments.length) {
            return {
                total: 0,
                awaitingShipment: 0,
                inTransit: 0,
                delivered: 0,
                delayed: 0,
                cancelled: 0,
                drafts: 0
            };
        }

        let awaitingShipment = 0;
        let inTransit = 0;
        let delivered = 0;
        let delayed = 0;
        let cancelled = 0;
        let drafts = 0;

        // Single pass through the array with direct status matching (same as filtering logic)
        allShipments.forEach(s => {
            const status = s.status?.toLowerCase()?.trim();

            if (status === 'draft') {
                drafts++;
            } else if (status === 'pending' || status === 'scheduled' || status === 'booked' ||
                status === 'awaiting_shipment' || status === 'ready_to_ship' || status === 'label_created') {
                awaitingShipment++;
            } else if (status === 'in_transit' || status === 'in transit' || status === 'picked_up' ||
                status === 'on_route' || status === 'out_for_delivery') {
                inTransit++;
            } else if (status === 'delivered' || status === 'completed') {
                delivered++;
            } else if (status === 'delayed' || status === 'on_hold' || status === 'exception' ||
                status === 'returned' || status === 'damaged') {
                delayed++;
            } else if (status === 'cancelled' || status === 'canceled' || status === 'void' || status === 'voided') {
                cancelled++;
            } else {
                // Default: treat unknown statuses as awaiting shipment (non-terminal states)
                console.warn(`Unknown shipment status: ${status}, treating as awaiting shipment`, s);
                awaitingShipment++;
            }
        });

        const nonDraftTotal = allShipments.length - drafts;

        console.log(`📊 Stats calculated:`, {
            total: allShipments.length,
            nonDraftTotal,
            awaitingShipment,
            inTransit,
            delivered,
            delayed,
            cancelled,
            drafts
        });

        return {
            total: nonDraftTotal, // Total excludes drafts for the "All" tab
            awaitingShipment,
            inTransit,
            delivered,
            delayed,
            cancelled,
            drafts
        };
    }, [allShipments]);

    // Selection handlers - memoized for performance
    const handleSelectAll = useCallback((event) => {
        if (event.target.checked) {
            const newSelected = shipments.map(shipment => shipment.id);
            setSelected(newSelected);
            return;
        }
        setSelected([]);
    }, [shipments]);

    const handleSelect = useCallback((id) => {
        const selectedIndex = selected.indexOf(id);
        let newSelected = [];

        if (selectedIndex === -1) {
            newSelected = newSelected.concat(selected, id);
        } else if (selectedIndex === 0) {
            newSelected = newSelected.concat(selected.slice(1));
        } else if (selectedIndex === selected.length - 1) {
            newSelected = newSelected.concat(selected.slice(0, -1));
        } else if (selectedIndex > 0) {
            newSelected = newSelected.concat(
                selected.slice(0, selectedIndex),
                selected.slice(selectedIndex + 1),
            );
        }

        setSelected(newSelected);
    }, [selected]);

    // Highlight search term helper
    const highlightSearchTerm = useCallback((text, searchTerm) => {
        if (!searchTerm || !text) return text;

        const regex = new RegExp(`(${searchTerm})`, 'gi');
        const parts = text.split(regex);

        return parts.map((part, index) => {
            if (part.toLowerCase() === searchTerm.toLowerCase()) {
                return <mark key={index} style={{ backgroundColor: '#fef08a', padding: '0 2px' }}>{part}</mark>;
            }
            return part;
        });
    }, []);

    // Add function to check document availability
    const checkDocumentAvailability = useCallback(async (shipment) => {
        if (shipment.status === 'draft') {
            return { hasLabels: false, hasBOLs: false };
        }

        try {
            const getShipmentDocumentsFunction = httpsCallable(functions, 'getShipmentDocuments');
            const documentsResult = await getShipmentDocumentsFunction({
                shipmentId: shipment.id,
                organized: true
            });

            if (!documentsResult.data || !documentsResult.data.success) {
                return { hasLabels: false, hasBOLs: false };
            }

            const documents = documentsResult.data.data;

            // Check for labels
            let hasLabels = false;
            if (documents.labels && documents.labels.length > 0) {
                hasLabels = true;
            } else {
                // Check in other documents for potential labels (excluding BOL array)
                const nonBolDocs = Object.entries(documents)
                    .filter(([key]) => key !== 'bol') // Explicitly exclude BOL array
                    .map(([, docs]) => docs)
                    .flat();

                const potentialLabels = nonBolDocs.filter(doc => {
                    const filename = (doc.filename || '').toLowerCase();
                    const documentType = (doc.documentType || '').toLowerCase();
                    const isGeneratedBOL = doc.isGeneratedBOL === true || doc.metadata?.eshipplus?.generated === true;

                    // Exclude any BOL documents more strictly
                    if (filename.includes('bol') ||
                        filename.includes('billoflading') ||
                        filename.includes('bill-of-lading') ||
                        filename.includes('bill_of_lading') ||
                        documentType.includes('bol') ||
                        isGeneratedBOL) {
                        return false;
                    }

                    // More specific label detection
                    return filename.includes('label') ||
                        filename.includes('prolabel') ||
                        filename.includes('pro-label') ||
                        filename.includes('shipping_label') ||
                        filename.includes('shippinglabel') ||
                        documentType.includes('label');
                });
                hasLabels = potentialLabels.length > 0;
            }

            // Check for BOLs
            const hasBOLs = documents.bol && documents.bol.length > 0;

            return { hasLabels, hasBOLs };
        } catch (error) {
            console.error('Error checking document availability:', error);
            return { hasLabels: false, hasBOLs: false };
        }
    }, []);

    // Action menu handlers
    const handleActionMenuOpen = async (event, shipment) => {
        setSelectedShipment(shipment);
        setActionMenuAnchorEl(event.currentTarget);

        // Check document availability for non-draft shipments
        if (shipment.status !== 'draft') {
            setCheckingDocuments(true);
            try {
                const availability = await checkDocumentAvailability(shipment);
                setDocumentAvailability(prev => ({
                    ...prev,
                    [shipment.id]: availability
                }));
            } catch (error) {
                console.error('Error checking documents:', error);
                setDocumentAvailability(prev => ({
                    ...prev,
                    [shipment.id]: { hasLabels: false, hasBOLs: false }
                }));
            } finally {
                setCheckingDocuments(false);
            }
        }
    };

    const handleActionMenuClose = () => {
        setSelectedShipment(null);
        setActionMenuAnchorEl(null);
    };

    // Placeholder refresh status handler (will implement later with status update hook)
    const handleRefreshShipmentStatus = async (shipment) => {
        setRefreshingStatus(prev => new Set([...prev, shipment.id]));
        showSnackbar('Status refresh functionality will be implemented with status update hook', 'info');
        setTimeout(() => {
            setRefreshingStatus(prev => {
                const newSet = new Set(prev);
                newSet.delete(shipment.id);
                return newSet;
            });
        }, 1000);
    };

    // Fetch customers for name lookup - optimized
    const fetchCustomers = useCallback(async () => {
        if (!companyIdForAddress) return;

        try {
            const customersRef = collection(db, 'customers');
            const q = query(customersRef, where('companyID', '==', companyIdForAddress));
            const querySnapshot = await getDocs(q);
            const customersMap = {};
            querySnapshot.forEach(doc => {
                const customer = doc.data();
                if (customer.customerID && customer.name) {
                    customersMap[customer.customerID] = customer.name;
                }
            });
            setCustomers(customersMap);
        } catch (error) {
            console.error('Error fetching customers:', error);
        }
    }, [companyIdForAddress]); // Stable function

    // Fetch carrier information from shipmentRates collection - optimized
    const fetchCarrierData = useCallback(async (shipmentIds) => {
        if (!shipmentIds || shipmentIds.length === 0) return;

        try {
            const carrierMap = {};

            // Batch process carrier data instead of individual queries
            const shipmentRatesRef = collection(db, 'shipmentRates');
            const promises = shipmentIds.map(async (shipmentId) => {
                const q = query(shipmentRatesRef, where('shipmentId', '==', shipmentId));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const rates = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    const selectedRate = rates.find(rate => rate.status === 'selected_in_ui' || rate.status === 'pending') || rates[0];

                    if (selectedRate) {
                        return {
                            shipmentId,
                            data: {
                                // Only essential fields for table display
                                carrier: selectedRate.carrier,
                                service: selectedRate.service,
                                displayCarrierId: selectedRate.displayCarrierId,
                                sourceCarrierName: selectedRate.sourceCarrierName,
                                totalCharges: selectedRate.totalCharges,
                                transitDays: selectedRate.transitDays
                            }
                        };
                    }
                }
                return null;
            });

            const results = await Promise.all(promises);
            results.forEach(result => {
                if (result) {
                    carrierMap[result.shipmentId] = result.data;
                }
            });

            setCarrierData(prev => ({ ...prev, ...carrierMap }));
        } catch (error) {
            console.error('Error fetching carrier data:', error);
        }
    }, []);

    // Load shipments - optimized for performance
    const loadShipments = useCallback(async (currentTab = null) => {
        if (!companyIdForAddress) {
            setShipments([]);
            setAllShipments([]);
            setTotalCount(0);
            return;
        }

        // Use provided tab or current selectedTab
        const activeTab = currentTab || selectedTab;
        console.log(`🏷️ Loading shipments for tab: ${activeTab}`);

        setLoading(true);
        try {
            const shipmentsRef = collection(db, 'shipments');
            const q = query(
                shipmentsRef,
                where('companyID', '==', companyIdForAddress),
                orderBy('createdAt', 'desc')
            );

            const querySnapshot = await getDocs(q);
            let shipmentsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log(`📊 Loaded ${shipmentsData.length} total shipments from database (sorted by createdAt)`);

            // Store all shipments for stats
            setAllShipments(shipmentsData);

            // Apply tab filter with simple, direct status matching
            console.log(`🏷️ Filtering for tab: ${activeTab}`);

            if (activeTab === 'all') {
                // "All" tab excludes drafts only
                shipmentsData = shipmentsData.filter(s => {
                    const status = s.status?.toLowerCase()?.trim();
                    return status !== 'draft';
                });
            } else if (activeTab === 'draft') {
                // Draft tab includes only drafts
                shipmentsData = shipmentsData.filter(s => {
                    const status = s.status?.toLowerCase()?.trim();
                    return status === 'draft';
                });
            } else if (activeTab === 'Awaiting Shipment') {
                // Pre-shipment statuses: pending, scheduled, booked, awaiting_shipment
                shipmentsData = shipmentsData.filter(s => {
                    const status = s.status?.toLowerCase()?.trim();
                    return status === 'pending' ||
                        status === 'scheduled' ||
                        status === 'booked' ||
                        status === 'awaiting_shipment' ||
                        status === 'ready_to_ship' ||
                        status === 'label_created';
                });
            } else if (activeTab === 'In Transit') {
                // Transit statuses: in_transit, picked_up, on_route
                shipmentsData = shipmentsData.filter(s => {
                    const status = s.status?.toLowerCase()?.trim();
                    return status === 'in_transit' ||
                        status === 'in transit' ||
                        status === 'picked_up' ||
                        status === 'on_route' ||
                        status === 'out_for_delivery';
                });
            } else if (activeTab === 'Delivered') {
                // Delivered statuses
                shipmentsData = shipmentsData.filter(s => {
                    const status = s.status?.toLowerCase()?.trim();
                    return status === 'delivered' ||
                        status === 'completed';
                });
            } else if (activeTab === 'Cancelled') {
                // Cancelled statuses
                shipmentsData = shipmentsData.filter(s => {
                    const status = s.status?.toLowerCase()?.trim();
                    return status === 'cancelled' ||
                        status === 'canceled' ||
                        status === 'void' ||
                        status === 'voided';
                });
            } else if (activeTab === 'Delayed') {
                // Delayed/exception statuses
                shipmentsData = shipmentsData.filter(s => {
                    const status = s.status?.toLowerCase()?.trim();
                    return status === 'delayed' ||
                        status === 'on_hold' ||
                        status === 'exception' ||
                        status === 'returned' ||
                        status === 'damaged';
                });
            }

            console.log(`🔍 After tab filter: ${shipmentsData.length} shipments remaining`)

            // Apply search filters
            let filteredData = [...shipmentsData];

            // Shipment ID search
            if (searchFields.shipmentId) {
                const searchTerm = searchFields.shipmentId.toLowerCase();
                filteredData = filteredData.filter(shipment => {
                    const shipmentId = (shipment.shipmentID || shipment.id || '').toLowerCase();
                    return shipmentId.includes(searchTerm);
                });
            }

            // Reference Number search
            if (searchFields.referenceNumber) {
                const searchTerm = searchFields.referenceNumber.toLowerCase();
                filteredData = filteredData.filter(shipment => {
                    const refNumber = (
                        shipment.shipmentInfo?.shipperReferenceNumber ||
                        shipment.referenceNumber ||
                        shipment.shipperReferenceNumber ||
                        shipment.selectedRate?.referenceNumber ||
                        shipment.selectedRateRef?.referenceNumber ||
                        ''
                    ).toLowerCase();
                    return refNumber.includes(searchTerm);
                });
            }

            // Tracking Number search
            if (searchFields.trackingNumber) {
                const searchTerm = searchFields.trackingNumber.toLowerCase();
                filteredData = filteredData.filter(shipment => {
                    const trackingNumber = (
                        shipment.trackingNumber ||
                        shipment.selectedRate?.trackingNumber ||
                        shipment.selectedRate?.TrackingNumber ||
                        shipment.selectedRateRef?.trackingNumber ||
                        shipment.selectedRateRef?.TrackingNumber ||
                        shipment.carrierTrackingData?.trackingNumber ||
                        shipment.carrierBookingConfirmation?.trackingNumber ||
                        shipment.carrierBookingConfirmation?.proNumber ||
                        shipment.bookingReferenceNumber ||
                        ''
                    ).toLowerCase();
                    return trackingNumber.includes(searchTerm);
                });
            }

            // Customer search
            if (selectedCustomer || searchFields.customerName) {
                const searchTerm = (selectedCustomer || searchFields.customerName).toLowerCase();
                console.log('Filtering by customer:', { selectedCustomer, searchTerm, availableCustomers: Object.keys(customers) });

                filteredData = filteredData.filter(shipment => {
                    // Check multiple possible customer identification methods
                    const shipToCustomerId = shipment.shipTo?.customerID;
                    const shipToCompany = shipment.shipTo?.company;
                    const customerNameFromMap = customers[shipToCustomerId];

                    // Debug logging for first few shipments
                    if (filteredData.indexOf(shipment) < 3) {
                        console.log('Checking shipment:', {
                            shipmentId: shipment.id,
                            shipToCustomerId,
                            shipToCompany,
                            customerNameFromMap,
                            searchTerm
                        });
                    }

                    // Try multiple matching strategies
                    const matches = [
                        // Direct customer ID match
                        shipToCustomerId && shipToCustomerId.toLowerCase().includes(searchTerm),
                        // Customer name from customers map
                        customerNameFromMap && customerNameFromMap.toLowerCase().includes(searchTerm),
                        // Direct company name match
                        shipToCompany && shipToCompany.toLowerCase().includes(searchTerm)
                    ].some(Boolean);

                    return matches;
                });

                console.log('Filtered data after customer filter:', filteredData.length, 'shipments');
            }

            // Origin/Destination search
            if (searchFields.origin) {
                filteredData = filteredData.filter(shipment => {
                    const shipFrom = shipment.shipFrom || shipment.shipfrom || {};
                    return Object.values(shipFrom)
                        .join(' ')
                        .toLowerCase()
                        .includes(searchFields.origin.toLowerCase());
                });
            }

            if (searchFields.destination) {
                filteredData = filteredData.filter(shipment => {
                    const shipTo = shipment.shipTo || shipment.shipto || {};
                    return Object.values(shipTo)
                        .join(' ')
                        .toLowerCase()
                        .includes(searchFields.destination.toLowerCase());
                });
            }

            // Carrier filter
            if (filters.carrier !== 'all') {
                // Carrier filter logic will be applied here later
            }

            // Shipment type filter
            if (filters.shipmentType !== 'all') {
                filteredData = filteredData.filter(shipment => {
                    const shipmentType = (shipment.shipmentInfo?.shipmentType ||
                        shipment.shipmentType || '').toLowerCase();
                    return shipmentType.includes(filters.shipmentType.toLowerCase());
                });
            }

            // Date range filter
            if (dateRange[0] && dateRange[1]) {
                const startDate = dateRange[0].startOf('day').toDate();
                const endDate = dateRange[1].endOf('day').toDate();

                filteredData = filteredData.filter(shipment => {
                    let shipmentDate;

                    if (shipment.createdAt?.toDate) {
                        // Standard Firestore timestamp
                        shipmentDate = shipment.createdAt.toDate();
                    } else if (shipment.createdAt) {
                        // Fallback for createdAt as plain value
                        shipmentDate = new Date(shipment.createdAt);
                    } else if (shipment.date) {
                        // Final fallback to date field
                        shipmentDate = new Date(shipment.date);
                    } else {
                        // No date available, exclude from filter
                        return false;
                    }

                    return shipmentDate >= startDate && shipmentDate <= endDate;
                });
            }

            setTotalCount(filteredData.length);

            // Apply pagination to filtered data
            const paginatedData = rowsPerPage === -1
                ? filteredData // Show all if rowsPerPage is -1
                : filteredData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

            setShipments(paginatedData);

            // Fetch carrier data for visible shipments
            const visibleShipmentIds = paginatedData.map(s => s.id);
            await fetchCarrierData(visibleShipmentIds);

        } catch (error) {
            console.error('Error loading shipments:', error);
            setShipments([]);
            setAllShipments([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [companyIdForAddress, selectedTab, fetchCarrierData]); // Minimal dependencies with tab parameter approach

    // Create a stable reload function that can be called when needed
    const reloadShipments = useCallback(() => {
        // Don't reload shipments when in detail view to prevent race conditions
        if (navigationStack.length > 1 && navigationStack[navigationStack.length - 1].component === 'shipment-detail') {
            console.log('🚫 Skipping reload - in detail view');
            return;
        }

        // Skip if not ready
        if (authLoading || companyCtxLoading || !companyIdForAddress) {
            console.log('🚫 Skipping reload - not ready', { authLoading, companyCtxLoading, companyIdForAddress });
            return;
        }

        console.log('🔄 Manual reload triggered');
        loadShipments();
    }, [loadShipments, authLoading, companyCtxLoading, companyIdForAddress]); // Removed navigationStack to prevent loops

    // Debounced version for search inputs
    const debounceTimeoutRef = useRef(null);
    const debouncedReload = useCallback(() => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
        debounceTimeoutRef.current = setTimeout(() => {
            // Check if we're still in the table view
            if (navigationStack.length === 1) {
                reloadShipments();
            }
        }, 500);
    }, [reloadShipments, navigationStack]);

    // Tab change handler - memoized for performance
    const handleTabChange = useCallback((event, newValue) => {
        console.log(`🏷️ Tab changed to: ${newValue}`);
        setSelectedTab(newValue);
        setPage(0); // Reset to first page when tab changes

        // Trigger reload for new tab with explicit tab value
        setTimeout(() => loadShipments(newValue), 50);
    }, [loadShipments]);

    // Initialize
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // CRITICAL CLEANUP: Clear all session state when component unmounts
    useEffect(() => {
        return () => {
            console.log('🧹 ShipmentsX unmounting - clearing all session state');
            setHasAutoOpenedShipment(false);
            // Clear any stored window references
            if (window.shipmentsXReset) {
                delete window.shipmentsXReset;
            }
        };
    }, []);

    // Add a direct reset function for external calls
    const resetToDefaults = useCallback(() => {
        console.log('🔄 Resetting ShipmentsX to default state');
        setSelectedTab('all');
        setPage(0);
        setSelected([]);
        setFilters({
            status: 'all',
            carrier: 'all',
            dateRange: [null, null],
            shipmentType: 'all',
            enhancedStatus: ''
        });
        setSearchFields({
            shipmentId: '',
            referenceNumber: '',
            trackingNumber: '',
            customerName: '',
            origin: '',
            destination: ''
        });
        setDateRange([null, null]);
        setSelectedCustomer('');
        setFiltersOpen(false);
        setNavigationStack([{ key: 'table', component: 'table', props: {} }]);
        setMountedViews(['table']);
        // ENHANCED FIX: Reset auto-open state to prevent sticky navigation
        setHasAutoOpenedShipment(false);
        console.log('🧹 Reset complete - all session state cleared');
    }, []);

    // Expose reset function via useEffect for external calls
    useEffect(() => {
        if (isModal) {
            // Store reset function for external access
            if (window.shipmentsXReset) {
                window.shipmentsXReset = resetToDefaults;
            }
        }
    }, [isModal, resetToDefaults]);



    // Load data when auth and company are ready
    useEffect(() => {
        if (!authLoading && !companyCtxLoading && companyIdForAddress) {
            console.log('🔄 Initial data load triggered');
            // Load customers and shipments in parallel for faster initial load
            Promise.all([
                fetchCustomers(),
                loadShipments()
            ]).catch(error => {
                console.error('Error loading initial data:', error);
                setLoading(false);
            });
        }
    }, [authLoading, companyCtxLoading, companyIdForAddress, fetchCustomers, loadShipments]);

    // Add tracking drawer handler
    const handleOpenTrackingDrawer = (trackingNumber) => {
        setCurrentTrackingNumber(trackingNumber);
        setIsTrackingDrawerOpen(true);
    };

    // Helper to get the current and previous views
    const getCurrentAndPrevViews = () => {
        const len = navigationStack.length;
        return {
            current: navigationStack[len - 1],
            prev: navigationStack[len - 2] || null
        };
    };

    // Render view based on component type
    const renderView = (view) => {
        console.log('🎨 renderView called with:', view);

        // Safety check for undefined view
        if (!view || !view.component) {
            console.error('❌ renderView called with invalid view:', view);
            return <div>Error: Invalid view</div>;
        }

        switch (view.component) {
            case 'table':
                console.log('📊 Rendering table view - v3.0 - All React Error #31 fixes applied');
                return (
                    <Box sx={{
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                    }}>
                        {/* Scrollable Content Area */}
                        <Box sx={{
                            flex: 1,
                            overflow: 'auto',
                            minHeight: 0,
                            maxHeight: '80vh', // Ensure the table area is scrollable and not the whole modal
                            position: 'relative'
                        }}>
                            {/* Main Content */}
                            <Paper sx={{ bgcolor: 'transparent', boxShadow: 'none', mx: 2 }}>
                                <Toolbar sx={{ borderBottom: 1, borderColor: '#e2e8f0', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Tabs
                                        value={selectedTab}
                                        onChange={handleTabChange}
                                        sx={{
                                            '& .MuiTab-root': {
                                                fontSize: '11px',
                                                minHeight: '36px',
                                                textTransform: 'none',
                                                fontWeight: 500,
                                                padding: '6px 12px'
                                            }
                                        }}
                                    >
                                        <Tab label={`All (${stats.total})`} value="all" />
                                        <Tab label={`Ready To Ship (${stats.awaitingShipment})`} value="Awaiting Shipment" />
                                        <Tab label={`In Transit (${stats.inTransit})`} value="In Transit" />
                                        <Tab label={`Delivered (${stats.delivered})`} value="Delivered" />
                                        <Tab label={`Delayed (${stats.delayed})`} value="Delayed" />
                                        <Tab label={`Cancelled (${stats.cancelled})`} value="Cancelled" />
                                        <Tab label={`Ship Later (${stats.drafts})`} value="draft" />
                                    </Tabs>

                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                        <Button variant="outlined" startIcon={<FilterIcon />} onClick={() => setFiltersOpen(!filtersOpen)} size="small" sx={{ fontSize: '11px', textTransform: 'none' }}>
                                            {filtersOpen ? 'Hide' : 'Show'}
                                        </Button>
                                        <IconButton variant="outlined" onClick={() => setIsExportDialogOpen(true)} size="small" sx={{ border: '1px solid rgba(0, 0, 0, 0.23)', borderRadius: '4px' }}>
                                            <ExportIcon sx={{ fontSize: '16px' }} />
                                        </IconButton>

                                        {/* Draft-specific actions */}
                                        {selectedTab === 'draft' && stats.drafts > 0 && (
                                            <>
                                                {selected.length > 0 && selected.some(id => shipments.find(s => s.id === id)?.status === 'draft') && (
                                                    <Button
                                                        variant="outlined"
                                                        color="error"
                                                        size="small"
                                                        onClick={() => {
                                                            setIsDeleteDraftsDialogOpen(true);
                                                        }}
                                                        disabled={isDeletingDrafts}
                                                        sx={{ fontSize: '11px', textTransform: 'none' }}
                                                    >
                                                        Delete Selected ({selected.filter(id => shipments.find(s => s.id === id)?.status === 'draft').length})
                                                    </Button>
                                                )}
                                            </>
                                        )}

                                        {hasEnabledCarriers(companyData) && (
                                            <>
                                                <Button
                                                    onClick={() => {
                                                        if (onOpenCreateShipment) {
                                                            // Open QuickShip modal with mode parameter
                                                            onOpenCreateShipment(null, null, null, 'quickship');
                                                        } else {
                                                            showSnackbar('Quick Ship functionality requires parent modal integration', 'warning');
                                                        }
                                                    }}
                                                    variant="contained"
                                                    startIcon={<FlashOnIcon />}
                                                    size="small"
                                                    sx={{ fontSize: '11px', textTransform: 'none' }}
                                                >
                                                    Quick Ship
                                                </Button>
                                                <Button
                                                    onClick={() => {
                                                        if (onOpenCreateShipment) {
                                                            onOpenCreateShipment();
                                                        } else {
                                                            showSnackbar('Create Shipment functionality requires parent modal integration', 'warning');
                                                        }
                                                    }}
                                                    variant="contained"
                                                    startIcon={<AddIcon />}
                                                    size="small"
                                                    sx={{ fontSize: '11px', textTransform: 'none' }}
                                                >
                                                    New
                                                </Button>
                                            </>
                                        )}
                                    </Box>
                                </Toolbar>

                                {/* Search and Filter Section */}
                                <Collapse in={filtersOpen}>
                                    <Box sx={{ p: 3, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                        <Grid container spacing={2} alignItems="center">
                                            {/* Shipment ID Search */}
                                            <Grid item xs={12} sm={6} md={3}>
                                                <TextField
                                                    fullWidth
                                                    label="Shipment ID"
                                                    placeholder="Search by Shipment ID (e.g. SH-12345)"
                                                    value={searchFields.shipmentId}
                                                    onChange={(e) => {
                                                        setSearchFields(prev => ({ ...prev, shipmentId: e.target.value }));
                                                        debouncedReload();
                                                    }}
                                                    size="small"
                                                    sx={{
                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                    }}
                                                    InputProps={{
                                                        startAdornment: (
                                                            <InputAdornment position="start">
                                                                <SearchIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                                            </InputAdornment>
                                                        ),
                                                        endAdornment: searchFields.shipmentId && (
                                                            <InputAdornment position="end">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => setSearchFields(prev => ({ ...prev, shipmentId: '' }))}
                                                                >
                                                                    <ClearIcon />
                                                                </IconButton>
                                                            </InputAdornment>
                                                        )
                                                    }}
                                                />
                                            </Grid>

                                            {/* Reference Number */}
                                            <Grid item xs={12} sm={6} md={3}>
                                                <TextField
                                                    fullWidth
                                                    label="Reference Number"
                                                    placeholder="Search by reference number"
                                                    value={searchFields.referenceNumber}
                                                    onChange={(e) => {
                                                        setSearchFields(prev => ({ ...prev, referenceNumber: e.target.value }));
                                                        debouncedReload();
                                                    }}
                                                    size="small"
                                                    sx={{
                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                    }}
                                                    InputProps={{
                                                        startAdornment: (
                                                            <InputAdornment position="start">
                                                                <DescriptionIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                                            </InputAdornment>
                                                        ),
                                                        endAdornment: searchFields.referenceNumber && (
                                                            <InputAdornment position="end">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => setSearchFields(prev => ({ ...prev, referenceNumber: '' }))}
                                                                >
                                                                    <ClearIcon />
                                                                </IconButton>
                                                            </InputAdornment>
                                                        )
                                                    }}
                                                />
                                            </Grid>

                                            {/* Tracking Number */}
                                            <Grid item xs={12} sm={6} md={3}>
                                                <TextField
                                                    fullWidth
                                                    label="Tracking / PRO Number"
                                                    placeholder="Search by tracking number"
                                                    value={searchFields.trackingNumber}
                                                    onChange={(e) => {
                                                        setSearchFields(prev => ({ ...prev, trackingNumber: e.target.value }));
                                                        debouncedReload();
                                                    }}
                                                    size="small"
                                                    sx={{
                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                    }}
                                                    InputProps={{
                                                        startAdornment: (
                                                            <InputAdornment position="start">
                                                                <QrCodeIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                                            </InputAdornment>
                                                        ),
                                                        endAdornment: searchFields.trackingNumber && (
                                                            <InputAdornment position="end">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => setSearchFields(prev => ({ ...prev, trackingNumber: '' }))}
                                                                >
                                                                    <ClearIcon />
                                                                </IconButton>
                                                            </InputAdornment>
                                                        )
                                                    }}
                                                />
                                            </Grid>

                                            {/* Date Range Picker */}
                                            <Grid item xs={12} sm={6} md={3}>
                                                <LocalizationProvider dateAdapter={AdapterDayjs}>
                                                    <DateRangePicker
                                                        value={dateRange}
                                                        onChange={(newValue) => {
                                                            setDateRange(newValue);
                                                            setTimeout(() => reloadShipments(), 100);
                                                        }}
                                                        label="Date Range"
                                                        slotProps={{
                                                            textField: {
                                                                size: "small",
                                                                fullWidth: true,
                                                                variant: "outlined",
                                                                placeholder: "",
                                                                sx: {
                                                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                                                },
                                                                InputProps: {
                                                                    startAdornment: (
                                                                        <InputAdornment position="start">
                                                                            <CalendarIcon sx={{ color: '#64748b' }} />
                                                                        </InputAdornment>
                                                                    )
                                                                }
                                                            },
                                                            actionBar: {
                                                                actions: ['clear', 'today', 'accept']
                                                            },
                                                            separator: {
                                                                children: ''
                                                            }
                                                        }}
                                                        calendars={2}
                                                        sx={{ width: '100%' }}
                                                    />
                                                </LocalizationProvider>
                                            </Grid>
                                        </Grid>

                                        {/* Second Row */}
                                        <Grid container spacing={2} alignItems="center" sx={{ mt: 2 }}>
                                            {/* Customer Search with Autocomplete */}
                                            <Grid item xs={12} sm={6} md={3}>
                                                <Autocomplete
                                                    fullWidth
                                                    options={Object.entries(customers).map(([id, name]) => ({ id, name }))}
                                                    getOptionLabel={(option) => option.name}
                                                    value={selectedCustomer ? { id: selectedCustomer, name: customers[selectedCustomer] } : null}
                                                    onChange={(event, newValue) => {
                                                        setSelectedCustomer(newValue?.id || '');
                                                        setTimeout(() => reloadShipments(), 100);
                                                    }}
                                                    renderInput={(params) => (
                                                        <TextField
                                                            {...params}
                                                            label="Search Customers"
                                                            placeholder="Search customers"
                                                            size="small"
                                                            variant="outlined"
                                                            sx={{
                                                                '& .MuiInputBase-input': { fontSize: '12px', minHeight: '1.5em', py: '8.5px' },
                                                                '& .MuiInputLabel-root': {
                                                                    fontSize: '12px',
                                                                    '&.MuiInputLabel-shrink': {
                                                                        fontSize: '12px'
                                                                    }
                                                                },
                                                                '& .MuiOutlinedInput-root': { minHeight: '40px' }
                                                            }}
                                                        />
                                                    )}
                                                    sx={{
                                                        '& .MuiAutocomplete-input': { fontSize: '12px', minHeight: '1.5em', py: '8.5px' },
                                                        '& .MuiInputLabel-root': {
                                                            fontSize: '12px',
                                                            '&.MuiInputLabel-shrink': {
                                                                fontSize: '12px'
                                                            }
                                                        },
                                                        '& .MuiOutlinedInput-root': { minHeight: '40px' },
                                                        fontSize: '12px',
                                                        minHeight: '40px',
                                                        display: 'flex',
                                                        alignItems: 'center'
                                                    }}
                                                    ListboxProps={{
                                                        sx: { fontSize: '12px' }
                                                    }}
                                                />
                                            </Grid>

                                            {/* Carrier Selection with Sub-carriers */}
                                            <Grid item xs={12} sm={6} md={3}>
                                                <FormControl fullWidth>
                                                    <InputLabel sx={{ fontSize: '12px' }}>Carrier</InputLabel>
                                                    <Select
                                                        value={filters.carrier}
                                                        onChange={(e) => {
                                                            setFilters(prev => ({
                                                                ...prev,
                                                                carrier: e.target.value
                                                            }));
                                                            setTimeout(() => reloadShipments(), 100);
                                                        }}
                                                        label="Carrier"
                                                        sx={{ fontSize: '12px' }}
                                                        MenuProps={{
                                                            PaperProps: {
                                                                sx: { '& .MuiMenuItem-root': { fontSize: '12px' } }
                                                            }
                                                        }}
                                                    >
                                                        <MenuItem value="all" sx={{ fontSize: '12px' }}>All Carriers</MenuItem>
                                                        {carrierOptions.flatMap((group) => [
                                                            <ListSubheader key={group.group} sx={{ fontSize: '12px' }}>{group.group}</ListSubheader>,
                                                            ...group.carriers.map((carrier) => (
                                                                <MenuItem key={carrier.id} value={carrier.id} sx={{ fontSize: '12px' }}>
                                                                    {carrier.name}
                                                                </MenuItem>
                                                            ))
                                                        ])}
                                                    </Select>
                                                </FormControl>
                                            </Grid>

                                            {/* Shipment Type */}
                                            <Grid item xs={12} sm={6} md={2}>
                                                <FormControl fullWidth>
                                                    <InputLabel sx={{ fontSize: '12px' }}>Type</InputLabel>
                                                    <Select
                                                        value={filters.shipmentType}
                                                        onChange={(e) => {
                                                            setFilters(prev => ({
                                                                ...prev,
                                                                shipmentType: e.target.value
                                                            }));
                                                            setTimeout(() => reloadShipments(), 100);
                                                        }}
                                                        label="Type"
                                                        sx={{ fontSize: '12px' }}
                                                        MenuProps={{
                                                            PaperProps: {
                                                                sx: { '& .MuiMenuItem-root': { fontSize: '12px' } }
                                                            }
                                                        }}
                                                    >
                                                        <MenuItem value="all" sx={{ fontSize: '12px' }}>All Types</MenuItem>
                                                        <MenuItem value="courier" sx={{ fontSize: '12px' }}>Courier</MenuItem>
                                                        <MenuItem value="freight" sx={{ fontSize: '12px' }}>Freight</MenuItem>
                                                    </Select>
                                                </FormControl>
                                            </Grid>

                                            {/* Enhanced Status Filter */}
                                            <Grid item xs={12} sm={6} md={3}>
                                                <EnhancedStatusFilter
                                                    value={filters.enhancedStatus || ''}
                                                    onChange={(value) => {
                                                        setFilters(prev => ({
                                                            ...prev,
                                                            enhancedStatus: value,
                                                            // Keep legacy status for backward compatibility
                                                            status: value ? enhancedToLegacy(value) : 'all'
                                                        }));
                                                        setTimeout(() => reloadShipments(), 100);
                                                    }}
                                                    label="Shipment Status"
                                                    showGroups={true}
                                                    showSearch={true}
                                                    fullWidth={true}
                                                    sx={{
                                                        '& .MuiInputLabel-root': { fontSize: '12px' },
                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                        '& .MuiSelect-select': { fontSize: '12px' },
                                                        '& .MuiMenuItem-root': { fontSize: '12px' }
                                                    }}
                                                />
                                            </Grid>

                                            {/* Clear Filters Button */}
                                            {(Object.values(searchFields).some(val => val !== '') ||
                                                filters.carrier !== 'all' ||
                                                filters.shipmentType !== 'all' ||
                                                filters.status !== 'all' ||
                                                dateRange[0] || dateRange[1]) && (
                                                    <Grid item xs={12} sm={6} md={1}>
                                                        <Button
                                                            fullWidth
                                                            variant="outlined"
                                                            onClick={handleClearFilters}
                                                            startIcon={<ClearIcon />}
                                                            sx={{
                                                                borderColor: '#e2e8f0',
                                                                color: '#64748b',
                                                                '&:hover': {
                                                                    borderColor: '#cbd5e1',
                                                                    bgcolor: '#f8fafc'
                                                                }
                                                            }}
                                                        >
                                                            Clear
                                                        </Button>
                                                    </Grid>
                                                )}
                                        </Grid>

                                        {/* Active Filters Display */}
                                        {(Object.values(searchFields).some(val => val !== '') ||
                                            filters.carrier !== 'all' ||
                                            filters.shipmentType !== 'all' ||
                                            filters.status !== 'all' ||
                                            dateRange[0] || dateRange[1]) && (
                                                <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                                    <Typography variant="body2" sx={{ color: '#64748b', mr: 1, display: 'flex', alignItems: 'center' }}>
                                                        <FilterAltIcon sx={{ fontSize: 16, mr: 0.5 }} />
                                                        Active Filters:
                                                    </Typography>
                                                    {Object.entries(searchFields).map(([key, value]) => value && (
                                                        <Chip
                                                            key={key}
                                                            label={`${key.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${value}`}
                                                            onDelete={() => setSearchFields(prev => ({ ...prev, [key]: '' }))}
                                                            size="small"
                                                            sx={{ bgcolor: '#f1f5f9' }}
                                                        />
                                                    ))}
                                                    {filters.carrier !== 'all' && (
                                                        <Chip
                                                            label={`Carrier: ${carrierOptions.flatMap(g => g.carriers).find(c => c.id === filters.carrier)?.name || String(filters.carrier)}`}
                                                            onDelete={() => setFilters(prev => ({ ...prev, carrier: 'all' }))}
                                                            size="small"
                                                            sx={{ bgcolor: '#f1f5f9' }}
                                                        />
                                                    )}
                                                    {filters.shipmentType !== 'all' && (
                                                        <Chip
                                                            label={`Type: ${filters.shipmentType}`}
                                                            onDelete={() => setFilters(prev => ({ ...prev, shipmentType: 'all' }))}
                                                            size="small"
                                                            sx={{ bgcolor: '#f1f5f9' }}
                                                        />
                                                    )}
                                                    {filters.status !== 'all' && (
                                                        <Chip
                                                            label={`Status: ${filters.status}`}
                                                            onDelete={() => setFilters(prev => ({ ...prev, status: 'all' }))}
                                                            size="small"
                                                            sx={{ bgcolor: '#f1f5f9' }}
                                                        />
                                                    )}
                                                    {(dateRange[0] || dateRange[1]) && (
                                                        <Chip
                                                            label={`Date: ${dateRange[0]?.format('MMM D, YYYY')} - ${dateRange[1]?.format('MMM D, YYYY')}`}
                                                            onDelete={() => setDateRange([null, null])}
                                                            size="small"
                                                            sx={{ bgcolor: '#f1f5f9' }}
                                                        />
                                                    )}
                                                </Box>
                                            )}
                                    </Box>
                                </Collapse>
                            </Paper>

                            {/* Shipments Table */}
                            {loading ? (
                                <ShipmentsTableSkeleton rows={rowsPerPage === -1 ? 10 : Math.min(rowsPerPage, 10)} />
                            ) : (
                                <ShipmentsTable
                                    shipments={shipments}
                                    loading={false}
                                    selected={selected}
                                    onSelectAll={handleSelectAll}
                                    onSelect={handleSelect}
                                    onViewShipmentDetail={handleViewShipmentDetail}
                                    onActionMenuOpen={handleActionMenuOpen}
                                    onEditDraftShipment={handleEditDraftShipment}
                                    customers={customers}
                                    companyData={companyData}
                                    carrierData={carrierData}
                                    searchFields={searchFields}
                                    highlightSearchTerm={highlightSearchTerm}
                                    showSnackbar={showSnackbar}
                                    onOpenTrackingDrawer={handleOpenTrackingDrawer}
                                />
                            )}
                        </Box>
                    </Box>
                );
            case 'shipment-detail':
                console.log('📋 Rendering shipment detail view with shipmentId:', view.props?.shipmentId);
                return (
                    <Suspense fallback={<CircularProgress />}>
                        <ShipmentDetailX {...view.props} onBackToTable={popView} />
                    </Suspense>
                );
            default:
                console.log('❌ Unknown view component:', view.component);
                return <div>Unknown view: {view.component}</div>;
        }
    };

    // Handle back button click from modal header
    const handleBackClick = () => {
        console.log('🔙 handleBackClick called');
        console.log('📚 Current navigation stack:', navigationStack.map(v => v.key));
        console.log('🎯 Navigation stack length:', navigationStack.length);

        // CRITICAL FIX: Always clear auto-open state when using back button
        console.log('🧹 Clearing auto-open state during back navigation');
        setHasAutoOpenedShipment(false);

        if (navigationStack.length > 1) {
            console.log('✅ Calling popView()');
            popView();
        } else if (onModalBack) {
            console.log('✅ Calling onModalBack()');
            onModalBack();
        } else if (onClose) {
            console.log('✅ Calling onClose()');
            onClose();
        } else {
            console.log('✅ Navigating to dashboard');
            navigate('/dashboard');
        }
    };

    // Handle close button click specifically
    const handleCloseClick = () => {
        console.log('❌ Close button clicked - resetting state');

        // CRITICAL FIX: Clear auto-open state when closing modal
        console.log('🧹 Clearing auto-open state during modal close');
        setHasAutoOpenedShipment(false);

        // Reset to defaults
        resetToDefaults();

        // Then call the onClose handler
        if (onClose) {
            onClose();
        }
    };

    // Add missing handler functions
    const handleClearFilters = useCallback(() => {
        setSearchFields({
            shipmentId: '',
            referenceNumber: '',
            trackingNumber: '',
            customerName: '',
            origin: '',
            destination: ''
        });
        setFilters({
            status: 'all',
            carrier: 'all',
            dateRange: [null, null],
            shipmentType: 'all',
            enhancedStatus: ''
        });
        setDateRange([null, null]);
        setSelectedCustomer('');

        // Reload with cleared filters
        setTimeout(() => reloadShipments(), 100);
    }, [reloadShipments]);

    const handleBatchRefreshStatus = useCallback(async () => {
        if (selected.length === 0) return;

        setIsUpdating(true);
        try {
            // Implement batch status update logic here
            console.log('Batch updating status for shipments:', selected);
            // This would call the actual status update function
        } catch (error) {
            console.error('Error updating batch status:', error);
        } finally {
            setIsUpdating(false);
        }
    }, [selected]);

    // Handle deleting selected drafts
    const handleDeleteSelectedDrafts = useCallback(async () => {
        if (selected.length === 0) return;

        setIsDeletingDrafts(true);
        try {
            const draftShipments = shipments.filter(s =>
                selected.includes(s.id) && s.status === 'draft'
            );

            if (draftShipments.length === 0) {
                showSnackbar('No draft shipments selected', 'warning');
                return;
            }

            // Delete each selected draft
            const deletePromises = draftShipments.map(shipment =>
                deleteDoc(doc(db, 'shipments', shipment.id))
            );

            await Promise.all(deletePromises);

            showSnackbar(`Successfully deleted ${draftShipments.length} draft shipment${draftShipments.length > 1 ? 's' : ''}`, 'success');
            setSelected([]); // Clear selection
            loadShipments(); // Reload the shipments list
        } catch (error) {
            console.error('Error deleting selected drafts:', error);
            showSnackbar('Error deleting draft shipments', 'error');
        } finally {
            setIsDeletingDrafts(false);
            setIsDeleteDraftsDialogOpen(false);
        }
    }, [selected, shipments, showSnackbar, loadShipments]);

    // Handle editing a draft shipment
    const handleEditDraftShipment = useCallback(async (draftId) => {
        console.log('📝 handleEditDraftShipment called with draftId:', draftId);

        try {
            // First, check what type of draft this is by examining the creationMethod
            const draftDoc = await getDoc(doc(db, 'shipments', draftId));
            if (!draftDoc.exists()) {
                showSnackbar('Draft shipment not found', 'error');
                return;
            }

            const draftData = draftDoc.data();
            const creationMethod = draftData.creationMethod;

            console.log('🔍 Draft creation method:', creationMethod);

            if (creationMethod === 'quickship') {
                console.log('🚀 Opening QuickShip for quickship draft');
                // For QuickShip drafts, open in QuickShip mode
                if (isModal && onOpenCreateShipment) {
                    // Use special callback for QuickShip drafts
                    onOpenCreateShipment(null, null, draftId, 'quickship');
                } else {
                    // Fallback to navigation (you might want to create a QuickShip route)
                    navigate(`/quickship/${draftId}`);
                }
            } else {
                console.log('🔧 Opening advanced CreateShipment for advanced/legacy draft');
                // For advanced drafts or legacy drafts without creationMethod, use the advanced flow
                if (isModal && onOpenCreateShipment) {
                    onOpenCreateShipment(null, draftId); // null for prePopulatedData, draftId for editing existing draft
                } else {
                    navigate(`/create-shipment/shipment-info/${draftId}`);
                }
            }
        } catch (error) {
            console.error('Error checking draft type:', error);
            showSnackbar('Error loading draft shipment', 'error');
        }
    }, [isModal, onOpenCreateShipment, navigate, showSnackbar]);

    // Handle repeating a shipment (creating a new draft with pre-populated data)
    const handleRepeatShipment = useCallback(async (shipment) => {
        try {
            // Prepare the pre-populated data from the existing shipment
            const prePopulatedData = {
                shipmentInfo: {
                    shipmentType: shipment.shipmentInfo?.shipmentType || shipment.shipmentType || '',
                    shipmentDate: new Date().toISOString().split('T')[0], // Set to today's date
                    serviceType: shipment.shipmentInfo?.serviceType || shipment.serviceType || '',
                    specialInstructions: shipment.shipmentInfo?.specialInstructions || '',
                    referenceNumber: '', // Clear reference number for new shipment
                    customerReference: shipment.shipmentInfo?.customerReference || ''
                },
                shipFrom: {
                    company: shipment.shipFrom?.company || '',
                    street: shipment.shipFrom?.street || '',
                    street2: shipment.shipFrom?.street2 || '',
                    city: shipment.shipFrom?.city || '',
                    state: shipment.shipFrom?.state || '',
                    postalCode: shipment.shipFrom?.postalCode || '',
                    country: shipment.shipFrom?.country || 'US',
                    contactName: shipment.shipFrom?.contactName || '',
                    contactPhone: shipment.shipFrom?.contactPhone || '',
                    contactEmail: shipment.shipFrom?.contactEmail || ''
                },
                shipTo: {
                    customerID: shipment.shipTo?.customerID || '',
                    company: shipment.shipTo?.company || '',
                    street: shipment.shipTo?.street || '',
                    street2: shipment.shipTo?.street2 || '',
                    city: shipment.shipTo?.city || '',
                    state: shipment.shipTo?.state || '',
                    postalCode: shipment.shipTo?.postalCode || '',
                    country: shipment.shipTo?.country || 'US',
                    contactName: shipment.shipTo?.contactName || '',
                    contactPhone: shipment.shipTo?.contactPhone || '',
                    contactEmail: shipment.shipTo?.contactEmail || ''
                },
                packages: shipment.packages ? shipment.packages.map(pkg => ({
                    itemDescription: pkg.itemDescription || '',
                    packagingType: pkg.packagingType || '',
                    packagingQuantity: pkg.packagingQuantity || 1,
                    weight: pkg.weight || '',
                    height: pkg.height || '',
                    width: pkg.width || '',
                    length: pkg.length || '',
                    declaredValue: pkg.declaredValue || '',
                    hazmat: pkg.hazmat || false
                })) : []
            };

            console.log('🔄 Repeating shipment with pre-populated data:', prePopulatedData);

            // Call the onOpenCreateShipment callback with pre-populated data
            if (onOpenCreateShipment) {
                onOpenCreateShipment(prePopulatedData);
            } else {
                showSnackbar('Cannot open create shipment - feature not available in this context', 'error');
            }
        } catch (error) {
            console.error('Error repeating shipment:', error);
            showSnackbar('Error creating repeat shipment', 'error');
        }
    }, [onOpenCreateShipment, showSnackbar]);

    // Create dynamic navigation object based on current state
    const getNavigationObject = () => {
        const currentView = navigationStack[navigationStack.length - 1];
        const currentModalPage = modalNavigation.getCurrentPage();

        return {
            title: currentView?.component === 'shipment-detail'
                ? currentModalPage?.title || 'Shipment Detail' // Use shipment ID from modal navigation
                : 'Shipments',
            canGoBack: navigationStack.length > 1,
            onBack: navigationStack.length > 1 ? popView : (onModalBack || onClose),
            backText: navigationStack.length > 1 ? 'Shipments' : 'Back'
        };
    };

    // Helper function to map enhanced status to legacy status for backward compatibility
    const enhancedToLegacy = (enhancedStatus) => {
        // This would map enhanced status IDs to legacy status names
        // For now, return 'all' to maintain compatibility
        return 'all';
    };

    // Show loading state
    if (authLoading || companyCtxLoading) {
        return (
            <Box sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '100vh'
            }}>
                <CircularProgress />
            </Box>
        );
    }

    // No company ID
    if (!companyIdForAddress) {
        return (
            <Box sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: '100vh',
                p: 3
            }}>
                <Alert severity="warning">
                    Please select a company to view shipments.
                </Alert>
            </Box>
        );
    }

    return (
        <div style={{ backgroundColor: 'transparent', width: '100%', height: '100%' }}>
            <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
                {/* Modal Header */}
                {isModal && (
                    <ModalHeader
                        navigation={getNavigationObject()}
                        onBack={handleBackClick}
                        showBackButton={true}
                        onClose={showCloseButton ? handleCloseClick : null}
                        showCloseButton={showCloseButton}
                    />
                )}

                {/* Sliding Container */}
                <Box
                    sx={{
                        display: 'flex',
                        width: '200%',
                        height: '100%',
                        position: 'relative',
                        transform:
                            sliding && slideDirection === 'forward'
                                ? 'translateX(-50%)'
                                : sliding && slideDirection === 'backward'
                                    ? 'translateX(0%)'
                                    : navigationStack.length > 1
                                        ? 'translateX(-50%)'
                                        : 'translateX(0%)',
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        willChange: 'transform',
                    }}
                >
                    {/* Render previous and current views if sliding, else just current */}
                    {mountedViews.map((key, idx) => {
                        const view = navigationStack.find((v) => v.key === key);
                        if (!view) {
                            console.warn('⚠️ View not found in navigation stack:', key);
                            return null;
                        }
                        return (
                            <div key={key} style={{ width: '50%', flexShrink: 0, overflow: 'hidden', height: '100%', display: 'flex', flexDirection: 'column' }}>
                                {/* Main Content Area (scrollable) */}
                                <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                                    {renderView(view)}
                                </Box>
                                {/* Pagination Footer */}
                                <Box sx={{ flexShrink: 0, borderTop: '1px solid #e2e8f0', bgcolor: '#fafafa', p: 1 }}>
                                    <ShipmentsPagination
                                        totalCount={totalCount}
                                        page={page}
                                        rowsPerPage={rowsPerPage}
                                        onPageChange={(event, newPage) => {
                                            setPage(newPage);
                                            setTimeout(() => reloadShipments(), 50);
                                        }}
                                        onRowsPerPageChange={(event) => {
                                            setRowsPerPage(parseInt(event.target.value, 10));
                                            setPage(0);
                                            setTimeout(() => reloadShipments(), 50);
                                        }}
                                    />
                                </Box>
                            </div>
                        );
                    })}
                </Box>
            </Box>

            {/* Export Dialog */}
            <ExportDialog
                open={isExportDialogOpen}
                onClose={() => setIsExportDialogOpen(false)}
                selectedExportFormat={selectedExportFormat}
                setSelectedExportFormat={setSelectedExportFormat}
                shipments={shipments}
                carrierData={carrierData}
                customers={customers}
            />

            {/* Action Menu */}
            <ShipmentActionMenu
                anchorEl={actionMenuAnchorEl}
                open={Boolean(actionMenuAnchorEl)}
                onClose={handleActionMenuClose}
                selectedShipment={selectedShipment}
                onViewShipmentDetail={handleViewShipmentDetail}
                onRepeatShipment={handleRepeatShipment}
                onPrintLabel={async (shipment) => {
                    try {
                        // Get document availability using the same logic as the menu
                        const availability = await checkDocumentAvailability(shipment);

                        if (!availability.hasLabels) {
                            showSnackbar('No label available for this shipment', 'warning');
                            return;
                        }

                        // Get the documents
                        const getShipmentDocumentsFunction = httpsCallable(functions, 'getShipmentDocuments');
                        const documentsResult = await getShipmentDocumentsFunction({
                            shipmentId: shipment.id,
                            organized: true
                        });

                        if (!documentsResult.data || !documentsResult.data.success) {
                            showSnackbar('Error loading label', 'error');
                            return;
                        }

                        const documents = documentsResult.data.data;
                        let labelUrl = null;

                        // First check dedicated labels array
                        if (documents.labels && documents.labels.length > 0) {
                            labelUrl = documents.labels[0].downloadUrl;
                        } else {
                            // Check in other documents for potential labels (excluding BOL array)
                            const nonBolDocs = Object.entries(documents)
                                .filter(([key]) => key !== 'bol') // Explicitly exclude BOL array
                                .map(([, docs]) => docs)
                                .flat();

                            const potentialLabel = nonBolDocs.find(doc => {
                                const filename = (doc.filename || '').toLowerCase();
                                const documentType = (doc.documentType || '').toLowerCase();
                                const isGeneratedBOL = doc.isGeneratedBOL === true || doc.metadata?.eshipplus?.generated === true;

                                // Exclude any BOL documents more strictly
                                if (filename.includes('bol') ||
                                    filename.includes('billoflading') ||
                                    filename.includes('bill-of-lading') ||
                                    filename.includes('bill_of_lading') ||
                                    documentType.includes('bol') ||
                                    isGeneratedBOL) {
                                    return false;
                                }

                                // More specific label detection
                                return filename.includes('label') ||
                                    filename.includes('prolabel') ||
                                    filename.includes('pro-label') ||
                                    filename.includes('shipping_label') ||
                                    filename.includes('shippinglabel') ||
                                    documentType.includes('label');
                            });

                            if (potentialLabel) {
                                labelUrl = potentialLabel.downloadUrl;
                            }
                        }

                        if (!labelUrl) {
                            showSnackbar('No label available for this shipment', 'warning');
                            return;
                        }

                        // Open PDF viewer dialog with label
                        setPdfViewerOpen(true);
                        setPdfUrl(labelUrl);
                        setPdfTitle(`Label - ${shipment.shipmentID || shipment.id}`);
                    } catch (error) {
                        console.error('Error handling print label:', error);
                        showSnackbar('Error loading label', 'error');
                    }
                }}
                onPrintBOL={async (shipment) => {
                    try {
                        // Check if it's a freight shipment
                        const isFreight = shipment.shipmentInfo?.shipmentType?.toLowerCase().includes('freight') ||
                            shipment.shipmentType?.toLowerCase().includes('freight');

                        if (!isFreight) {
                            showSnackbar('BOL is only available for freight shipments', 'warning');
                            return;
                        }

                        // Get document availability using the same logic as the menu
                        const availability = await checkDocumentAvailability(shipment);

                        if (!availability.hasBOLs) {
                            showSnackbar('No BOL available for this shipment', 'warning');
                            return;
                        }

                        // Get the documents
                        const getShipmentDocumentsFunction = httpsCallable(functions, 'getShipmentDocuments');
                        const documentsResult = await getShipmentDocumentsFunction({
                            shipmentId: shipment.id,
                            organized: true
                        });

                        if (!documentsResult.data || !documentsResult.data.success) {
                            showSnackbar('Error loading BOL', 'error');
                            return;
                        }

                        const documents = documentsResult.data.data;
                        let bolUrl = null;

                        // Check dedicated BOL array
                        if (documents.bol && documents.bol.length > 0) {
                            bolUrl = documents.bol[0].downloadUrl;
                        }

                        if (!bolUrl) {
                            showSnackbar('No BOL available for this shipment', 'warning');
                            return;
                        }

                        // Open PDF viewer dialog with BOL
                        setPdfViewerOpen(true);
                        setPdfUrl(bolUrl);
                        setPdfTitle(`BOL - ${shipment.shipmentID || shipment.id}`);
                    } catch (error) {
                        console.error('Error handling print BOL:', error);
                        showSnackbar('Error loading BOL', 'error');
                    }
                }}
                onDeleteDraft={async (shipment) => {
                    try {
                        if (shipment.status !== 'draft') {
                            showSnackbar('Only draft shipments can be deleted', 'warning');
                            return;
                        }

                        // Delete the shipment
                        await deleteDoc(doc(db, 'shipments', shipment.id));
                        showSnackbar('Draft shipment deleted successfully', 'success');
                        loadShipments(); // Reload the shipments list
                    } catch (error) {
                        console.error('Error deleting draft:', error);
                        showSnackbar('Error deleting draft shipment', 'error');
                    }
                }}
                checkingDocuments={checkingDocuments}
                documentAvailability={documentAvailability}
            />

            {/* PDF Viewer Dialog */}
            <PdfViewerDialog
                open={pdfViewerOpen}
                onClose={() => setPdfViewerOpen(false)}
                pdfUrl={pdfUrl}
                title={pdfTitle}
            />

            {/* Delete Drafts Confirmation Dialog */}
            <Dialog
                open={isDeleteDraftsDialogOpen}
                onClose={() => setIsDeleteDraftsDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Delete Selected Drafts
                </DialogTitle>
                <DialogContent>
                    <Typography>
                        Are you sure you want to delete {selected.filter(id => shipments.find(s => s.id === id)?.status === 'draft').length} selected draft shipment{selected.filter(id => shipments.find(s => s.id === id)?.status === 'draft').length > 1 ? 's' : ''}?
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 1, color: '#64748b' }}>
                        This action cannot be undone. Draft shipments will be permanently removed.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setIsDeleteDraftsDialogOpen(false)}
                        disabled={isDeletingDrafts}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDeleteSelectedDrafts}
                        color="error"
                        variant="contained"
                        disabled={isDeletingDrafts}
                        startIcon={isDeletingDrafts ? <CircularProgress size={16} /> : null}
                    >
                        {isDeletingDrafts ? 'Deleting...' : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Snackbar for User Feedback */}
            <Snackbar
                open={snackbar.open}
                autoHideDuration={snackbar.severity === 'error' ? 8000 : 4000}
                onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            >
                <Alert
                    onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
                    severity={snackbar.severity}
                    variant="filled"
                    sx={{
                        width: '100%',
                        borderRadius: 2,
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)'
                    }}
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>

            {/* Tracking Drawer */}
            {isTrackingDrawerOpen && (
                <Box
                    onClick={() => setIsTrackingDrawerOpen(false)}
                    sx={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        bgcolor: 'rgba(0,0,0,0.7)',
                        zIndex: 1499,
                        transition: 'opacity 0.3s',
                    }}
                />
            )}
            <Drawer
                anchor="right"
                open={isTrackingDrawerOpen}
                onClose={() => {
                    setIsTrackingDrawerOpen(false);
                    setCurrentTrackingNumber('');
                }}
                PaperProps={{
                    sx: {
                        width: { xs: '90vw', sm: 400, md: 450 },
                        height: '100%',
                        bgcolor: '#0a0a0a',
                        zIndex: 1500,
                        position: 'fixed',
                        right: 0,
                        top: 0,
                    }
                }}
                ModalProps={{
                    keepMounted: true,
                    sx: { zIndex: 1500 }
                }}
            >
                <Box sx={{ width: { xs: '90vw', sm: 400, md: 450 }, height: '100%', bgcolor: '#0a0a0a' }} role="presentation">
                    <Suspense fallback={<CircularProgress sx={{ m: 4 }} />}>
                        <TrackingDrawerContent
                            trackingIdentifier={currentTrackingNumber}
                            isDrawer={true}
                            onClose={() => {
                                setIsTrackingDrawerOpen(false);
                                setCurrentTrackingNumber('');
                            }}
                        />
                    </Suspense>
                </Box>
            </Drawer>
        </div>
    );
};

export default ShipmentsX;