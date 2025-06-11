import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    CircularProgress,
    Snackbar,
    Alert,
    Tabs,
    Tab,
    Toolbar,
    TablePagination,
    Drawer,
    IconButton,
    Dialog,
    Slide
} from '@mui/material';
import {
    Add as AddIcon,
    FilterList as FilterIcon,
    GetApp as ExportIcon,
    Refresh as RefreshIcon,
    ArrowBackIosNew as ArrowBackIosNewIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { collection, getDocs, query, where, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import './Shipments.css';

// Import modular components
import ShipmentFilters from './components/ShipmentFilters';
import ShipmentsTable from './components/ShipmentsTable';
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

// Import ShipmentDetailX for the sliding view
const ShipmentDetailX = React.lazy(() => import('../ShipmentDetail/ShipmentDetailX'));

// Import CreateShipment for the modal
const CreateShipmentComponent = React.lazy(() => import('../CreateShipment'));

// Transition component for modal
const Transition = React.forwardRef(function Transition(props, ref) {
    return <Slide direction="up" ref={ref} {...props} />;
});

const ShipmentsX = ({ isModal = false, onClose = null }) => {

    // Auth and company context
    const { user, loading: authLoading } = useAuth();
    const { companyIdForAddress, loading: companyCtxLoading, companyData } = useCompany();

    // Main data states
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
        shipmentType: 'all'
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

    // Add new state for document availability
    const [documentAvailability, setDocumentAvailability] = useState({});
    const [checkingDocuments, setCheckingDocuments] = useState(false);

    // Add tracking drawer state
    const [isTrackingDrawerOpen, setIsTrackingDrawerOpen] = useState(false);
    const [currentTrackingNumber, setCurrentTrackingNumber] = useState('');

    // Add sliding view state for shipment detail
    const [currentView, setCurrentView] = useState('table'); // 'table' or 'detail'
    const [selectedShipmentId, setSelectedShipmentId] = useState(null);
    const [isSliding, setIsSliding] = useState(false);

    // Add CreateShipment modal state
    const [isCreateShipmentModalOpen, setIsCreateShipmentModalOpen] = useState(false);

    // Helper function to show snackbar
    const showSnackbar = useCallback((message, severity = 'info') => {
        setSnackbar({ open: true, message, severity });
    }, []);

    // Calculate stats
    const stats = useMemo(() => {
        const groupCounts = {
            PRE_SHIPMENT: 0,
            BOOKING: 0,
            TRANSIT: 0,
            DELIVERY: 0,
            COMPLETED: 0,
            CANCELLED: 0,
            DRAFTS: 0
        };

        allShipments.forEach(shipment => {
            const group = getShipmentStatusGroup(shipment);
            if (group === 'DRAFTS') {
                groupCounts.DRAFTS++;
            } else {
                groupCounts[group] = (groupCounts[group] || 0) + 1;
            }
        });

        return {
            total: allShipments.length - groupCounts.DRAFTS,
            awaitingShipment: groupCounts.PRE_SHIPMENT + groupCounts.BOOKING,
            inTransit: groupCounts.TRANSIT + groupCounts.DELIVERY,
            delivered: groupCounts.COMPLETED,
            cancelled: groupCounts.CANCELLED,
            drafts: groupCounts.DRAFTS
        };
    }, [allShipments]);

    // Tab change handler
    const handleTabChange = (event, newValue) => {
        setSelectedTab(newValue);
        setPage(0); // Reset to first page when tab changes
    };

    // Selection handlers
    const handleSelectAll = (event) => {
        if (event.target.checked) {
            const newSelected = shipments.map(shipment => shipment.id);
            setSelected(newSelected);
            return;
        }
        setSelected([]);
    };

    const handleSelect = (id) => {
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
    };

    // Highlight search term helper
    const highlightSearchTerm = useCallback((text, searchTerm) => {
        if (!searchTerm || !text) return text;

        const parts = text.split(new RegExp(`(${searchTerm})`, 'gi'));
        return (
            <span>
                {parts.map((part, i) =>
                    part.toLowerCase() === searchTerm.toLowerCase() ? (
                        <span key={i} style={{ backgroundColor: '#fff8c5' }}>
                            {part}
                        </span>
                    ) : (
                        part
                    )
                )}
            </span>
        );
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

    // Fetch customers for name lookup
    const fetchCustomers = async () => {
        try {
            const customersRef = collection(db, 'customers');
            const querySnapshot = await getDocs(customersRef);
            const customersMap = {};
            querySnapshot.forEach(doc => {
                const customer = doc.data();
                customersMap[customer.customerID] = customer.name;
            });
            setCustomers(customersMap);
        } catch (error) {
            console.error('Error fetching customers:', error);
        }
    };

    // Fetch carrier information from shipmentRates collection
    const fetchCarrierData = async (shipmentIds) => {
        if (!shipmentIds || shipmentIds.length === 0) return;

        try {
            const carrierMap = {};

            for (const shipmentId of shipmentIds) {
                const shipmentRatesRef = collection(db, 'shipmentRates');
                const q = query(shipmentRatesRef, where('shipmentId', '==', shipmentId));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const rates = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    const selectedRate = rates.find(rate => rate.status === 'selected_in_ui' || rate.status === 'booked') || rates[0];

                    if (selectedRate) {
                        carrierMap[shipmentId] = {
                            carrier: selectedRate.carrier,
                            service: selectedRate.service,
                            totalCharges: selectedRate.totalCharges,
                            transitDays: selectedRate.transitDays
                        };
                    }
                }
            }

            setCarrierData(carrierMap);
        } catch (error) {
            console.error('Error fetching carrier data:', error);
        }
    };

    // Load shipments
    const loadShipments = async () => {
        if (!companyIdForAddress) {
            setLoading(false);
            setShipments([]);
            setAllShipments([]);
            setTotalCount(0);
            return;
        }

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

            // Store all shipments for stats
            setAllShipments(shipmentsData);

            // Apply tab filter
            if (selectedTab === 'all') {
                // "All" tab should exclude drafts
                shipmentsData = shipmentsData.filter(s => {
                    const group = getShipmentStatusGroup(s);
                    return group !== 'DRAFTS';
                });
            } else if (selectedTab === 'draft') {
                // Handle draft tab - only show drafts
                shipmentsData = shipmentsData.filter(s => {
                    const group = getShipmentStatusGroup(s);
                    return group === 'DRAFTS';
                });
            } else if (selectedTab === 'Awaiting Shipment') {
                // Include all pre-shipment and booking phases, exclude drafts
                shipmentsData = shipmentsData.filter(s => {
                    const group = getShipmentStatusGroup(s);
                    return (group === 'PRE_SHIPMENT' || group === 'BOOKING') && group !== 'DRAFTS';
                });
            } else if (selectedTab === 'In Transit') {
                // Include transit and delivery phases, exclude drafts
                shipmentsData = shipmentsData.filter(s => {
                    const group = getShipmentStatusGroup(s);
                    return (group === 'TRANSIT' || group === 'DELIVERY') && group !== 'DRAFTS';
                });
            } else if (selectedTab === 'Delivered') {
                // Include completed phase, exclude drafts
                shipmentsData = shipmentsData.filter(s => {
                    const group = getShipmentStatusGroup(s);
                    return group === 'COMPLETED' && group !== 'DRAFTS';
                });
            } else if (selectedTab === 'Cancelled') {
                // Include cancelled and void phases, exclude drafts
                shipmentsData = shipmentsData.filter(s => {
                    const group = getShipmentStatusGroup(s);
                    return (group === 'CANCELLED' || s.status === 'void') && group !== 'DRAFTS';
                });
            }

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
                filteredData = filteredData.filter(shipment => {
                    const customerName = (
                        customers[shipment.shipTo?.customerID] ||
                        shipment.shipTo?.company ||
                        ''
                    ).toLowerCase();
                    return customerName.includes(searchTerm);
                });
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
                    const shipmentDate = shipment.createdAt?.toDate
                        ? shipment.createdAt.toDate()
                        : shipment.date
                            ? new Date(shipment.date)
                            : new Date(shipment.createdAt);
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
    };

    // Initialize
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // Load data when auth and company are ready
    useEffect(() => {
        if (!authLoading && !companyCtxLoading && companyIdForAddress) {
            fetchCustomers();
            loadShipments();
        }
    }, [authLoading, companyCtxLoading, companyIdForAddress]);

    // Reload when filters change
    useEffect(() => {
        // Don't reload shipments when in detail view to prevent race conditions
        if (currentView === 'detail') {
            return;
        }

        if (!authLoading && !companyCtxLoading && companyIdForAddress) {
            const timeoutId = setTimeout(() => {
                loadShipments();
            }, 300); // Debounce for 300ms
            return () => clearTimeout(timeoutId);
        }
    }, [page, rowsPerPage, selectedTab, filters, dateRange, searchFields, selectedCustomer, authLoading, companyCtxLoading, companyIdForAddress, currentView]);

    // Add tracking drawer handler
    const handleOpenTrackingDrawer = (trackingNumber) => {
        setCurrentTrackingNumber(trackingNumber);
        setIsTrackingDrawerOpen(true);
    };

    // Add handlers for sliding between views
    const handleViewShipmentDetail = (shipmentId) => {
        setSelectedShipmentId(shipmentId);
        setIsSliding(true);

        // Small delay to allow state to update before animation
        setTimeout(() => {
            setCurrentView('detail');
            setTimeout(() => {
                setIsSliding(false);
            }, 300); // Match CSS transition duration
        }, 50);
    };

    const handleBackToTable = () => {
        setIsSliding(true);

        setTimeout(() => {
            setCurrentView('table');
            setTimeout(() => {
                setIsSliding(false);
                setSelectedShipmentId(null);
            }, 300); // Match CSS transition duration
        }, 50);
    };

    // Handler for opening CreateShipment modal
    const handleOpenCreateShipmentModal = () => {
        setIsCreateShipmentModalOpen(true);
    };

    // Handler for return to shipments from CreateShipment modal (just close the modal since we're already in shipments)
    const handleReturnToShipmentsFromCreateShipment = () => {
        console.log('handleReturnToShipmentsFromCreateShipment called in ShipmentsX');
        setIsCreateShipmentModalOpen(false);
    };



    const navigate = useNavigate();

    // Handle back button click
    const handleBackClick = () => {
        if (isModal && onClose) {
            onClose();
        } else {
            navigate('/dashboard');
        }
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
        <div className="shipments-container" style={{ backgroundColor: 'transparent' }}>
            <Box sx={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
                {/* Sliding Container */}
                <Box
                    sx={{
                        display: 'flex',
                        width: '200%',
                        height: '100%',
                        transform: currentView === 'table' ? 'translateX(0%)' : 'translateX(-50%)',
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        willChange: 'transform'
                    }}
                >
                    {/* Shipments Table View */}
                    <Box sx={{ width: '50%', minHeight: '100%', pr: 2 }}>
                        {/* Header Section */}
                        <Box sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            mb: 2,
                            flexWrap: 'wrap',
                            gap: 1
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Button
                                    onClick={handleBackClick}
                                    sx={{
                                        minWidth: 0,
                                        p: 0.5,
                                        mr: 1,
                                        color: '#6e6e73',
                                        background: 'none',
                                        borderRadius: '50%',
                                        '&:hover': {
                                            background: '#f2f2f7',
                                            color: '#111',
                                        },
                                        boxShadow: 'none',
                                    }}
                                    aria-label="Back to Dashboard"
                                >
                                    <ArrowBackIosNewIcon sx={{ fontSize: 20 }} />
                                </Button>
                                <Typography variant="h6" component="h1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                                    Shipments
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<FilterIcon sx={{ fontSize: 16 }} />}
                                    onClick={() => setFiltersOpen(!filtersOpen)}
                                    sx={{
                                        color: '#64748b',
                                        borderColor: '#e2e8f0',
                                        bgcolor: filtersOpen ? '#f8fafc' : 'transparent',
                                        fontSize: '0.875rem',
                                        py: 0.5
                                    }}
                                >
                                    {filtersOpen ? 'Hide Filters' : 'Show Filters'}
                                </Button>
                                {selected.length > 0 && (
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<RefreshIcon sx={{ fontSize: 16 }} />}
                                        onClick={() => showSnackbar('Batch status update coming soon', 'info')}
                                        sx={{
                                            color: '#059669',
                                            borderColor: '#10b981',
                                            '&:hover': { borderColor: '#059669', bgcolor: '#f0fdf4' },
                                            fontSize: '0.875rem',
                                            py: 0.5
                                        }}
                                    >
                                        Update Status ({selected.length})
                                    </Button>
                                )}
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<ExportIcon sx={{ fontSize: 16 }} />}
                                    onClick={() => setIsExportDialogOpen(true)}
                                    sx={{
                                        color: '#64748b',
                                        borderColor: '#e2e8f0',
                                        fontSize: '0.875rem',
                                        py: 0.5
                                    }}
                                >
                                    Export
                                </Button>
                                {hasEnabledCarriers(companyData) ? (
                                    <Button
                                        variant="contained"
                                        size="small"
                                        startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                                        onClick={handleOpenCreateShipmentModal}
                                        sx={{
                                            bgcolor: '#0f172a',
                                            '&:hover': { bgcolor: '#1e293b' },
                                            fontSize: '0.875rem',
                                            py: 0.5
                                        }}
                                    >
                                        Create shipment
                                    </Button>
                                ) : (
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        startIcon={<AddIcon sx={{ fontSize: 16 }} />}
                                        disabled
                                        sx={{
                                            color: '#9ca3af',
                                            borderColor: '#e5e7eb',
                                            '&.Mui-disabled': {
                                                color: '#9ca3af',
                                                borderColor: '#e5e7eb'
                                            },
                                            fontSize: '0.875rem',
                                            py: 0.5
                                        }}
                                        title="No carriers enabled for your company. Please configure carriers first."
                                    >
                                        Create shipment
                                    </Button>
                                )}
                            </Box>
                        </Box>

                        {/* Main Content */}
                        <Box sx={{ bgcolor: 'transparent' }}>
                            <Toolbar sx={{
                                borderBottom: 1,
                                borderColor: '#e2e8f0',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                minHeight: 48,
                                px: 1
                            }}>
                                <Tabs
                                    value={selectedTab}
                                    onChange={handleTabChange}
                                    sx={{
                                        '& .MuiTab-root': {
                                            minHeight: 40,
                                            fontSize: '0.875rem',
                                            px: 2,
                                            py: 1
                                        }
                                    }}
                                >
                                    <Tab label={`All (${stats.total})`} value="all" />
                                    <Tab label={`Awaiting Shipment (${stats.awaitingShipment})`} value="Awaiting Shipment" />
                                    <Tab label={`In Transit (${stats.inTransit})`} value="In Transit" />
                                    <Tab label={`Delivered (${stats.delivered})`} value="Delivered" />
                                    <Tab label={`Cancelled (${stats.cancelled})`} value="Cancelled" />
                                    <Tab label={`Drafts (${stats.drafts})`} value="draft" />
                                </Tabs>
                            </Toolbar>

                            {/* Filters Section */}
                            <ShipmentFilters
                                searchFields={searchFields}
                                setSearchFields={setSearchFields}
                                filters={filters}
                                setFilters={setFilters}
                                dateRange={dateRange}
                                setDateRange={setDateRange}
                                selectedCustomer={selectedCustomer}
                                setSelectedCustomer={setSelectedCustomer}
                                customers={customers}
                                handleClearFilters={() => {
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
                                        shipmentType: 'all'
                                    });
                                    setDateRange([null, null]);
                                    setSelectedCustomer('');
                                }}
                                filtersOpen={filtersOpen}
                            />

                            {/* Shipments Table */}
                            <ShipmentsTable
                                loading={loading}
                                shipments={shipments}
                                selected={selected}
                                onSelectAll={handleSelectAll}
                                onSelect={handleSelect}
                                onActionMenuOpen={handleActionMenuOpen}
                                onRefreshStatus={handleRefreshShipmentStatus}
                                refreshingStatus={refreshingStatus}
                                customers={customers}
                                carrierData={carrierData}
                                searchFields={searchFields}
                                highlightSearchTerm={highlightSearchTerm}
                                showSnackbar={showSnackbar}
                                onOpenTrackingDrawer={handleOpenTrackingDrawer}
                                onViewShipmentDetail={handleViewShipmentDetail}
                            />

                            {/* Pagination */}
                            <TablePagination
                                component="div"
                                count={totalCount}
                                page={page}
                                onPageChange={(event, newPage) => setPage(newPage)}
                                rowsPerPage={rowsPerPage}
                                onRowsPerPageChange={(event) => {
                                    setRowsPerPage(parseInt(event.target.value, 10));
                                    setPage(0);
                                }}
                                rowsPerPageOptions={[10, 25, 50, 100, { label: 'All', value: -1 }]}
                            />
                        </Box>
                    </Box>

                    {/* Shipment Detail View */}
                    <Box sx={{ width: '50%', minHeight: '100%', pl: 2, position: 'relative' }}>
                        {currentView === 'detail' && selectedShipmentId && (
                            <Box sx={{ position: 'relative', height: '100%' }}>

                                {/* Shipment Detail Content */}
                                <Suspense fallback={
                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        height: '100%',
                                        pt: 8
                                    }}>
                                        <CircularProgress />
                                    </Box>
                                }>
                                    <ShipmentDetailX
                                        key={selectedShipmentId}
                                        shipmentId={selectedShipmentId}
                                        onBackToTable={handleBackToTable}
                                    />
                                </Suspense>
                            </Box>
                        )}
                    </Box>
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

            {/* Create Shipment Fullscreen Modal */}
            <Dialog
                open={isCreateShipmentModalOpen}
                onClose={() => setIsCreateShipmentModalOpen(false)}
                TransitionComponent={Transition}
                fullWidth
                maxWidth="xl"
                sx={{
                    '& .MuiDialog-container': {
                        alignItems: 'flex-end',
                    },
                }}
                PaperProps={{
                    sx: {
                        height: { xs: '100%', md: '95vh' },
                        margin: 0,
                        bgcolor: 'white',
                        borderRadius: { xs: 0, md: '20px 20px 0 0' },
                        boxShadow: '0 -8px 24px rgba(0,0,0,0.12)',
                        overflow: 'hidden',
                    }
                }}
                BackdropProps={{
                    sx: {
                        backgroundColor: 'rgba(0, 0, 0, 0.4)'
                    }
                }}
            >
                <Box sx={{ height: '100%', width: '100%', overflowY: 'auto' }}>
                    <Suspense fallback={
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    }>
                        <CreateShipmentComponent
                            isModal={true}
                            onClose={() => setIsCreateShipmentModalOpen(false)}
                            onReturnToShipments={handleReturnToShipmentsFromCreateShipment}
                        />
                    </Suspense>
                </Box>
            </Dialog>
        </div >
    );
};

export default ShipmentsX; 