import React, { useState, useEffect, useMemo, useCallback, useContext, useRef } from 'react';
import {
    Box,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    TextField,
    InputAdornment,
    IconButton,
    Button,
    Chip,
    Typography,
    Toolbar,
    Menu,
    MenuItem,
    FormControl,
    InputLabel,
    Select,
    Stack,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    InputBase,
    Tabs,
    Tab,
    Checkbox,
    CircularProgress,
    ListItemIcon,
    Grid,
    ListSubheader,
    Autocomplete,
    Tooltip,
    Container,
    Skeleton,
    Alert,
    Collapse,
    Link as MuiLink,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Divider
} from '@mui/material';
import {
    Search as SearchIcon,
    FilterList as FilterIcon,
    GetApp as ExportIcon,
    Clear as ClearIcon,
    Sort as SortIcon,
    Add as AddIcon,
    CalendarToday as CalendarIcon,
    MoreVert as MoreVertIcon,
    Visibility as VisibilityIcon,
    Print as PrintIcon,
    Delete as DeleteIcon,
    Edit as EditIcon,
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon,
    Refresh as RefreshIcon,
    FilterAlt as FilterAltIcon,
    PictureAsPdf as PictureAsPdfIcon,
    FileDownload as FileDownloadIcon,
    Close as CloseIcon,
    ContentCopy as ContentCopyIcon,
    LocalShipping as LocalShippingIcon,
    Description as DescriptionIcon,
    Warning as WarningIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
    Schedule as ScheduleIcon,
    Assignment as AssignmentIcon,
    ExpandMore as ExpandMoreIcon,
    QrCode as QrCodeIcon
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { DateRangePicker } from '@mui/x-date-pickers-pro/DateRangePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import dayjs from 'dayjs';
import './Shipments.css';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { collection, getDocs, query, where, orderBy, limit, startAfter, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import Snackbar from '@mui/material/Snackbar';
import StatusChip from '../StatusChip/StatusChip';
import EnhancedStatusFilter from '../StatusChip/EnhancedStatusFilter';
import { useCarrierAgnosticStatusUpdate } from '../../hooks/useCarrierAgnosticStatusUpdate';
import StatusUpdateProgress from '../StatusUpdateProgress/StatusUpdateProgress';
import {
    legacyToEnhanced,
    enhancedToLegacy,
    getEnhancedStatus,
    ENHANCED_STATUSES,
    STATUS_GROUPS
} from '../../utils/enhancedStatusModel';

// Helper function to check if company has any enabled carriers
const hasEnabledCarriers = (companyData) => {
    if (!companyData?.connectedCarriers) {
        return false;
    }

    return companyData.connectedCarriers.some(carrier =>
        carrier.enabled === true && carrier.carrierID
    );
};

// Add formatAddress function (copied from admin view)
const formatAddress = (address, label = '', searchTerm = '') => {
    if (!address || typeof address !== 'object') {
        if (label) {
            console.warn(`No valid address object for ${label}:`, address);
        }
        return <div>N/A</div>;
    }
    const formattedAddress = (
        <>
            {address.company && <div>{address.company}</div>}
            {address.attentionName && <div>{address.attentionName}</div>}
            {address.street && <div>{address.street}</div>}
            {address.street2 && address.street2 !== '' && <div>{address.street2}</div>}
            <div>
                {[address.city, address.state, address.postalCode].filter(Boolean).join(', ')}
            </div>
            {address.country && <div>{address.country}</div>}
        </>
    );
    return (
        <span>
            {formattedAddress}
        </span>
    );
};

// Helper function to capitalize shipment type
const capitalizeShipmentType = (type) => {
    if (!type) return 'N/A';
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
};

// Helper function to format route (origin → destination)
const formatRoute = (shipFrom, shipTo, searchTermOrigin = '', searchTermDestination = '') => {
    const formatLocation = (address) => {
        if (!address || typeof address !== 'object') {
            return 'N/A';
        }
        // Format as "City, State/Province" for compact display
        const parts = [];
        if (address.city) parts.push(address.city);
        if (address.state || address.province) parts.push(address.state || address.province);

        return parts.length > 0 ? parts.join(', ') : 'N/A';
    };

    const origin = formatLocation(shipFrom);
    const destination = formatLocation(shipTo);

    return (
        <div style={{ lineHeight: 1.3 }}>
            {/* Origin */}
            <div style={{
                fontSize: '0.875rem',
                fontWeight: 400,
                color: '#374151'
            }}>
                {searchTermOrigin ? (
                    <span>
                        {origin.split(new RegExp(`(${searchTermOrigin})`, 'gi')).map((part, i) =>
                            part.toLowerCase() === searchTermOrigin.toLowerCase() ? (
                                <span key={i} style={{ backgroundColor: '#fff8c5' }}>
                                    {part}
                                </span>
                            ) : (
                                part
                            )
                        )}
                    </span>
                ) : origin}
            </div>

            {/* Arrow */}
            <div style={{
                fontSize: '0.75rem',
                color: '#000000',
                margin: '2px 0',
                textAlign: 'center'
            }}>
                ↓
            </div>

            {/* Destination */}
            <div style={{
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#111827'
            }}>
                {searchTermDestination ? (
                    <span>
                        {destination.split(new RegExp(`(${searchTermDestination})`, 'gi')).map((part, i) =>
                            part.toLowerCase() === searchTermDestination.toLowerCase() ? (
                                <span key={i} style={{ backgroundColor: '#fff8c5' }}>
                                    {part}
                                </span>
                            ) : (
                                part
                            )
                        )}
                    </span>
                ) : destination}
            </div>
        </div>
    );
};

// Helper function to format date and time
const formatDateTime = (timestamp) => {
    if (!timestamp) return 'N/A';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);

    // Format date as MM/DD/YY
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    const formattedDate = `${month}/${day}/${year}`;

    // Format time
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
    });
    const formattedTime = timeFormatter.format(date);

    return (
        <div style={{ lineHeight: 1.3 }}>
            {/* Date */}
            <div style={{
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#111827'
            }}>
                {formattedDate}
            </div>

            {/* Time */}
            <div style={{
                fontSize: '0.75rem',
                color: '#6b7280',
                marginTop: '2px'
            }}>
                {formattedTime}
            </div>
        </div>
    );
};

const Shipments = () => {
    const { user, loading: authLoading } = useAuth();
    const { companyIdForAddress, loading: companyCtxLoading, companyData } = useCompany();
    const [shipments, setShipments] = useState([]);
    const [allShipments, setAllShipments] = useState([]); // Store all unfiltered shipments for stats
    const [customers, setCustomers] = useState({});
    const [carrierData, setCarrierData] = useState({});
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [shipmentNumber, setShipmentNumber] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [filterAnchorEl, setFilterAnchorEl] = useState(null);
    const [sortAnchorEl, setSortAnchorEl] = useState(null);
    const [selectedTab, setSelectedTab] = useState('all');
    const [filters, setFilters] = useState({
        status: 'all',
        carrier: 'all',
        dateRange: [null, null],
        shipmentType: 'all'
    });
    const [sortBy, setSortBy] = useState({
        field: 'date',
        direction: 'desc'
    });
    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [selectedExportFormat, setSelectedExportFormat] = useState('csv');
    const [dateRange, setDateRange] = useState([null, null]);
    const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
    const [selected, setSelected] = useState([]);
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [actionMenuAnchorEl, setActionMenuAnchorEl] = useState(null);
    const [refreshingStatus, setRefreshingStatus] = useState(new Set());

    // Add new state for delete confirmation dialog
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [shipmentToDelete, setShipmentToDelete] = useState(null);

    // Add state for print functionality
    const [printDialogOpen, setPrintDialogOpen] = useState(false);
    const [printType, setPrintType] = useState('label'); // 'label' or 'bol'
    const [isGeneratingLabel, setIsGeneratingLabel] = useState(false);

    // PDF Viewer Modal state (copied from ShipmentDetail.jsx)
    const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
    const [currentPdfUrl, setCurrentPdfUrl] = useState(null);
    const [currentPdfTitle, setCurrentPdfTitle] = useState('');

    const navigate = useNavigate();

    // Enhanced search state
    const [searchFields, setSearchFields] = useState({
        shipmentId: '',
        referenceNumber: '',
        trackingNumber: '',
        customerName: '',
        origin: '',
        destination: ''
    });

    // Enhanced snackbar for user feedback (copied from ShipmentDetail.jsx)
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'info'
    });

    // Add state to track if we should refresh on mount (when returning from other pages)
    const [shouldRefreshOnMount, setShouldRefreshOnMount] = useState(false);

    // Add state to track document availability for shipments
    const [documentAvailability, setDocumentAvailability] = useState({});
    const [checkingDocuments, setCheckingDocuments] = useState(false);

    // Carrier-agnostic status update system
    const {
        isUpdating,
        updateProgress: statusUpdateProgress,
        results: statusUpdateResults,
        updateSingleShipment,
        updateMultipleShipments,
        clearState: clearStatusUpdateState,
        getCarrierInfo,
        isEligibleForUpdate,
        getUpdateStats
    } = useCarrierAgnosticStatusUpdate();

    // Status update progress dialog state
    const [statusProgressDialogOpen, setStatusProgressDialogOpen] = useState(false);

    const [updateProgress, setUpdateProgress] = useState({
        show: false,
        completed: 0,
        total: 0,
        current: ''
    });

    // Helper function to normalize carrier names for comparison
    const normalizeCarrierName = useCallback((name) => {
        if (!name) return '';
        const normalized = name.toLowerCase()
            .replace(/[^a-z0-9]/g, '') // Remove special characters and spaces
            .replace(/express/g, '')    // Remove common suffixes
            .replace(/freight/g, '')
            .replace(/logistics/g, '');
        return normalized;
    }, []);

    // Helper function to get carrier name
    const getShipmentCarrier = useCallback((shipment) => {
        // Check for eShipPlus first
        const isEShipPlus =
            carrierData[shipment.id]?.displayCarrierId === 'ESHIPPLUS' ||
            carrierData[shipment.id]?.sourceCarrierName === 'eShipPlus' ||
            shipment.selectedRate?.displayCarrierId === 'ESHIPPLUS' ||
            shipment.selectedRateRef?.displayCarrierId === 'ESHIPPLUS';

        if (isEShipPlus) {
            // For eShipPlus, return the actual carrier name
            const subCarrier = shipment.selectedRate?.carrier ||
                shipment.selectedRateRef?.carrier ||
                shipment.carrier;
            return {
                name: subCarrier || 'eShipPlus',
                isEShipPlus: true,
                normalizedName: normalizeCarrierName(subCarrier || 'eShipPlus')
            };
        }

        // For regular carriers
        const carrierName = carrierData[shipment.id]?.carrier ||
            shipment.selectedRateRef?.carrier ||
            shipment.selectedRate?.carrier ||
            shipment.carrier ||
            'N/A';

        return {
            name: carrierName,
            isEShipPlus: false,
            normalizedName: normalizeCarrierName(carrierName)
        };
    }, [carrierData, normalizeCarrierName]);

    // Carrier list with eShipPlus sub-carriers
    const carrierOptions = [
        {
            group: 'Courier Services', carriers: [
                { id: 'canpar', name: 'Canpar Express', normalized: 'canpar' },
                { id: 'purolator', name: 'Purolator', normalized: 'purolator' },
                { id: 'fedex', name: 'FedEx', normalized: 'fedex' },
                { id: 'ups', name: 'UPS', normalized: 'ups' },
                { id: 'dhl', name: 'DHL', normalized: 'dhl' }
            ]
        },
        {
            group: 'Freight Services (eShipPlus)', carriers: [
                { id: 'eShipPlus_fedexfreight', name: 'FedEx Freight', normalized: 'fedexfreight' },
                { id: 'eShipPlus_roadrunner', name: 'Road Runner', normalized: 'roadrunner' },
                { id: 'eShipPlus_estes', name: 'ESTES', normalized: 'estes' },
                { id: 'eShipPlus_yrc', name: 'YRC Freight', normalized: 'yrc' },
                { id: 'eShipPlus_xpo', name: 'XPO Logistics', normalized: 'xpo' },
                { id: 'eShipPlus_odfl', name: 'Old Dominion', normalized: 'odfl' },
                { id: 'eShipPlus_saia', name: 'SAIA', normalized: 'saia' }
            ]
        }
    ];

    // Helper function to highlight search terms
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

    // Clear filters function
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
            shipmentType: 'all'
        });
        setDateRange([null, null]);
        setSelectedCustomer('');
    }, []);

    // Enhanced search function
    const handleSearch = useCallback(() => {
        setLoading(true);
        try {
            let filteredShipments = [...allShipments];

            // First apply tab filter
            if (selectedTab === 'all') {
                // "All" tab should exclude drafts
                filteredShipments = filteredShipments.filter(s => s.status?.toLowerCase() !== 'draft');
            } else if (selectedTab === 'draft') {
                // Handle draft tab - only show drafts (case-insensitive)
                filteredShipments = filteredShipments.filter(s => s.status?.toLowerCase() === 'draft');
            } else if (selectedTab === 'In Transit') {
                filteredShipments = filteredShipments.filter(s =>
                    s.status?.toLowerCase() === 'in_transit' ||
                    s.status?.toLowerCase() === 'in transit'
                );
            } else if (selectedTab === 'Delivered') {
                filteredShipments = filteredShipments.filter(s =>
                    s.status?.toLowerCase() === 'delivered'
                );
            } else if (selectedTab === 'Awaiting Shipment') {
                filteredShipments = filteredShipments.filter(s =>
                    s.status?.toLowerCase() === 'scheduled'
                );
            } else if (selectedTab === 'Cancelled') {
                // Handle \"Cancelled\" tab - filter by \"cancelled\" or \"void\" status (both spellings)
                filteredShipments = filteredShipments.filter(s =>
                    s.status?.toLowerCase() === 'cancelled' ||
                    s.status?.toLowerCase() === 'canceled' ||
                    s.status?.toLowerCase() === 'void' ||
                    s.status?.toLowerCase() === 'voided'
                );
            }

            // Shipment ID search (partial match)
            if (searchFields.shipmentId) {
                const searchTerm = searchFields.shipmentId.toLowerCase();
                filteredShipments = filteredShipments.filter(shipment => {
                    const shipmentId = (shipment.shipmentID || shipment.id || '').toLowerCase();
                    return shipmentId.includes(searchTerm);
                });
            }

            // Reference Number search
            if (searchFields.referenceNumber) {
                const searchTerm = searchFields.referenceNumber.toLowerCase();
                filteredShipments = filteredShipments.filter(shipment => {
                    const refNumber = (
                        shipment.shipmentInfo?.shipperReferenceNumber ||
                        shipment.referenceNumber ||
                        shipment.shipperReferenceNumber ||
                        shipment.selectedRate?.referenceNumber ||
                        shipment.selectedRateRef?.referenceNumber ||
                        shipment.carrierBookingConfirmation?.referenceNumber ||
                        shipment.carrierBookingConfirmation?.bookingReference ||
                        shipment.carrierBookingConfirmation?.proNumber ||
                        ''
                    ).toLowerCase();
                    return refNumber.includes(searchTerm);
                });
            }

            // Tracking Number search
            if (searchFields.trackingNumber) {
                const searchTerm = searchFields.trackingNumber.toLowerCase();
                filteredShipments = filteredShipments.filter(shipment => {
                    // Enhanced eShipPlus detection
                    const carrierName = shipment.selectedRate?.carrier ||
                        shipment.selectedRateRef?.carrier ||
                        shipment.carrier || '';

                    const isEShipPlus =
                        shipment.selectedRate?.displayCarrierId === 'ESHIPPLUS' ||
                        shipment.selectedRateRef?.displayCarrierId === 'ESHIPPLUS' ||
                        shipment.selectedRate?.sourceCarrierName === 'eShipPlus' ||
                        shipment.selectedRateRef?.sourceCarrierName === 'eShipPlus' ||
                        // Enhanced detection for freight carriers (which are typically eShipPlus)
                        carrierName.toLowerCase().includes('freight') ||
                        carrierName.toLowerCase().includes('fedex freight') ||
                        carrierName.toLowerCase().includes('road runner') ||
                        carrierName.toLowerCase().includes('estes') ||
                        carrierName.toLowerCase().includes('yrc') ||
                        carrierName.toLowerCase().includes('xpo') ||
                        carrierName.toLowerCase().includes('old dominion') ||
                        carrierName.toLowerCase().includes('saia') ||
                        carrierName.toLowerCase().includes('ltl');

                    // Standard tracking number fields
                    const trackingNumber = (
                        shipment.trackingNumber ||
                        shipment.selectedRate?.trackingNumber ||
                        shipment.selectedRate?.TrackingNumber ||
                        shipment.selectedRateRef?.trackingNumber ||
                        shipment.selectedRateRef?.TrackingNumber ||
                        shipment.carrierTrackingData?.trackingNumber ||
                        shipment.carrierBookingConfirmation?.trackingNumber ||
                        shipment.carrierBookingConfirmation?.proNumber ||
                        ''
                    ).toLowerCase();

                    // For eShipPlus shipments, also check booking reference numbers
                    const bookingReferenceNumber = isEShipPlus ? (
                        shipment.bookingReferenceNumber ||
                        shipment.selectedRate?.BookingReferenceNumber ||
                        shipment.selectedRate?.bookingReferenceNumber ||
                        shipment.selectedRateRef?.BookingReferenceNumber ||
                        shipment.selectedRateRef?.bookingReferenceNumber ||
                        shipment.carrierTrackingData?.bookingReferenceNumber ||
                        shipment.carrierBookingConfirmation?.bookingReference ||
                        shipment.carrierBookingConfirmation?.confirmationNumber ||
                        ''
                    ).toLowerCase() : '';

                    // Check both tracking number and booking reference (for eShipPlus)
                    const trackingMatches = trackingNumber.includes(searchTerm);
                    const bookingMatches = isEShipPlus && bookingReferenceNumber.includes(searchTerm);
                    return trackingMatches || bookingMatches;
                });
            }

            // Carrier filter with eShipPlus sub-carriers
            if (filters.carrier !== 'all') {
                const selectedCarrier = carrierOptions
                    .flatMap(g => g.carriers)
                    .find(c => c.id === filters.carrier);

                if (selectedCarrier) {
                    filteredShipments = filteredShipments.filter(shipment => {
                        // Get carrier name from various sources
                        const carrierName = shipment.selectedRateRef?.carrier ||
                            shipment.selectedRate?.carrier ||
                            shipment.carrier ||
                            shipment.selectedRate?.CarrierName;

                        // Check for eShipPlus first
                        const isEShipPlus =
                            shipment.selectedRate?.displayCarrierId === 'ESHIPPLUS' ||
                            shipment.selectedRateRef?.displayCarrierId === 'ESHIPPLUS' ||
                            carrierName?.toLowerCase().includes('eshipplus');

                        if (selectedCarrier.id.startsWith('eShipPlus_')) {
                            // For eShipPlus carriers, use more specific matching
                            let matches = false;
                            if (isEShipPlus && carrierName) {
                                const lowerCarrierName = carrierName.toLowerCase();

                                // Handle specific eShipPlus carriers
                                switch (selectedCarrier.id) {
                                    case 'eShipPlus_fedexfreight':
                                        matches = lowerCarrierName.includes('fedex') && lowerCarrierName.includes('freight');
                                        break;
                                    case 'eShipPlus_roadrunner':
                                        matches = lowerCarrierName.includes('road') || lowerCarrierName.includes('runner');
                                        break;
                                    case 'eShipPlus_estes':
                                        matches = lowerCarrierName.includes('estes');
                                        break;
                                    case 'eShipPlus_yrc':
                                        matches = lowerCarrierName.includes('yrc');
                                        break;
                                    case 'eShipPlus_xpo':
                                        matches = lowerCarrierName.includes('xpo');
                                        break;
                                    case 'eShipPlus_odfl':
                                        matches = lowerCarrierName.includes('old dominion') || lowerCarrierName.includes('odfl');
                                        break;
                                    case 'eShipPlus_saia':
                                        matches = lowerCarrierName.includes('saia');
                                        break;
                                    default:
                                        // Fallback to original logic
                                        matches = normalizeCarrierName(carrierName).includes(selectedCarrier.normalized);
                                }
                            }
                            return matches;
                        } else {
                            // For regular carriers, check if it's NOT eShipPlus and matches the carrier
                            const matches = !isEShipPlus &&
                                carrierName &&
                                normalizeCarrierName(carrierName).includes(selectedCarrier.normalized);
                            return matches;
                        }
                    });
                }
            }

            // Date range filter
            if (dateRange[0] && dateRange[1]) {
                // Set start date to beginning of day and end date to end of day
                const startDate = dateRange[0].startOf('day').toDate();
                const endDate = dateRange[1].endOf('day').toDate();

                filteredShipments = filteredShipments.filter(shipment => {
                    const shipmentDate = shipment.createdAt?.toDate
                        ? shipment.createdAt.toDate()
                        : new Date(shipment.createdAt);
                    return shipmentDate >= startDate && shipmentDate <= endDate;
                });
            }

            // Customer search
            if (searchFields.customerName) {
                const searchTerm = searchFields.customerName.toLowerCase();
                filteredShipments = filteredShipments.filter(shipment => {
                    const customerName = (
                        customers[shipment.shipTo?.customerID] ||
                        shipment.shipTo?.company ||
                        ''
                    ).toLowerCase();
                    return customerName.includes(searchTerm);
                });
            }

            // Origin/Destination search
            if (searchFields.origin || searchFields.destination) {
                filteredShipments = filteredShipments.filter(shipment => {
                    const originMatch = !searchFields.origin || (
                        Object.values(shipment.shipFrom || {})
                            .join(' ')
                            .toLowerCase()
                            .includes(searchFields.origin.toLowerCase())
                    );
                    const destinationMatch = !searchFields.destination || (
                        Object.values(shipment.shipTo || {})
                            .join(' ')
                            .toLowerCase()
                            .includes(searchFields.destination.toLowerCase())
                    );
                    return originMatch && destinationMatch;
                });
            }

            setShipments(filteredShipments);
            setTotalCount(filteredShipments.length);
        } catch (error) {
            console.error('Error in search:', error);
        } finally {
            setLoading(false);
        }
    }, [searchFields, filters, dateRange, allShipments, customers, getShipmentCarrier]);

    // Debounced search effect
    useEffect(() => {
        const debounceTimeout = setTimeout(() => {
            handleSearch();
        }, 300);

        return () => clearTimeout(debounceTimeout);
    }, [searchFields, filters, dateRange, handleSearch]);

    // Scroll to top when component mounts
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    // Enhanced stats calculation to include all statuses including drafts and cancelled
    const stats = useMemo(() => {
        return {
            total: allShipments.filter(s => s.status?.toLowerCase() !== 'draft').length, // Exclude drafts from total
            inTransit: allShipments.filter(s => s.status?.toLowerCase() === 'in_transit' || s.status?.toLowerCase() === 'in transit').length,
            delivered: allShipments.filter(s => s.status?.toLowerCase() === 'delivered').length,
            awaitingShipment: allShipments.filter(s => s.status?.toLowerCase() === 'scheduled').length,
            cancelled: allShipments.filter(s =>
                s.status?.toLowerCase() === 'cancelled' ||
                s.status?.toLowerCase() === 'canceled' ||
                s.status?.toLowerCase() === 'void' ||
                s.status?.toLowerCase() === 'voided'
            ).length,
            drafts: allShipments.filter(s => s.status?.toLowerCase() === 'draft').length
        };
    }, [allShipments]);

    // Fetch customers for name lookup (copied from admin view)
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

            // Fetch carrier data for shipments that have selectedRateDocumentId
            for (const shipmentId of shipmentIds) {
                const shipmentRatesRef = collection(db, 'shipmentRates');
                const q = query(shipmentRatesRef, where('shipmentId', '==', shipmentId));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    // Get the most recent rate (or selected rate)
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

    // Remove generateMockShipments and replace loadShipments with Firestore logic
    const loadShipments = async () => {
        if (!companyIdForAddress && !companyCtxLoading) {
            setLoading(false);
            setShipments([]); // Clear shipments if no companyId
            setAllShipments([]); // Clear all shipments for stats
            setTotalCount(0);
            return;
        }
        if (!companyIdForAddress && companyCtxLoading) {
            setLoading(true); // Keep loading true while company context loads
            return;
        }
        if (!companyIdForAddress) { // Should be caught by above, but as a safeguard
            console.warn("Shipments.jsx: companyIdForAddress is not available. Cannot load shipments.");
            setLoading(false);
            setShipments([]);
            setAllShipments([]);
            setTotalCount(0);
            return;
        }

        setLoading(true);
        try {
            let shipmentsRef = collection(db, 'shipments');
            // Build Firestore query
            let q = query(shipmentsRef, where('companyID', '==', companyIdForAddress), orderBy('createdAt', 'desc'));

            // Note: Status filter will be applied client-side to handle cancelled/void grouping

            // Fetch all shipments (for now, pagination can be improved with startAfter/limit)
            const querySnapshot = await getDocs(q);
            let shipmentsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Apply status filter (client-side to handle cancelled/void grouping)
            if (filters.status !== 'all') {
                if (filters.status === 'cancelled') {
                    // For cancelled filter, include both cancelled and void shipments
                    shipmentsData = shipmentsData.filter(shipment => {
                        const status = shipment.status?.toLowerCase();
                        return status === 'cancelled' ||
                            status === 'canceled' ||
                            status === 'void' ||
                            status === 'voided';
                    });
                } else {
                    // For other statuses, use exact match
                    shipmentsData = shipmentsData.filter(shipment =>
                        shipment.status?.toLowerCase() === filters.status.toLowerCase()
                    );
                }
            }

            // Apply carrier filter (client-side to check both carrier and selectedRate.carrier)
            if (filters.carrier !== 'all') {
                const selectedCarrier = carrierOptions
                    .flatMap(g => g.carriers)
                    .find(c => c.id === filters.carrier);

                if (selectedCarrier) {
                    shipmentsData = shipmentsData.filter(shipment => {
                        // Get carrier name from various sources
                        const carrierName = shipment.selectedRateRef?.carrier ||
                            shipment.selectedRate?.carrier ||
                            shipment.carrier ||
                            shipment.selectedRate?.CarrierName;

                        // Check for eShipPlus first
                        const isEShipPlus =
                            shipment.selectedRate?.displayCarrierId === 'ESHIPPLUS' ||
                            shipment.selectedRateRef?.displayCarrierId === 'ESHIPPLUS' ||
                            carrierName?.toLowerCase().includes('eshipplus');

                        if (selectedCarrier.id.startsWith('eShipPlus_')) {
                            // For eShipPlus carriers, use more specific matching
                            let matches = false;
                            if (isEShipPlus && carrierName) {
                                const lowerCarrierName = carrierName.toLowerCase();

                                // Handle specific eShipPlus carriers
                                switch (selectedCarrier.id) {
                                    case 'eShipPlus_fedexfreight':
                                        matches = lowerCarrierName.includes('fedex') && lowerCarrierName.includes('freight');
                                        break;
                                    case 'eShipPlus_roadrunner':
                                        matches = lowerCarrierName.includes('road') || lowerCarrierName.includes('runner');
                                        break;
                                    case 'eShipPlus_estes':
                                        matches = lowerCarrierName.includes('estes');
                                        break;
                                    case 'eShipPlus_yrc':
                                        matches = lowerCarrierName.includes('yrc');
                                        break;
                                    case 'eShipPlus_xpo':
                                        matches = lowerCarrierName.includes('xpo');
                                        break;
                                    case 'eShipPlus_odfl':
                                        matches = lowerCarrierName.includes('old dominion') || lowerCarrierName.includes('odfl');
                                        break;
                                    case 'eShipPlus_saia':
                                        matches = lowerCarrierName.includes('saia');
                                        break;
                                    default:
                                        // Fallback to original logic
                                        matches = normalizeCarrierName(carrierName).includes(selectedCarrier.normalized);
                                }
                            }
                            return matches;
                        } else {
                            // For regular carriers, check if it's NOT eShipPlus and matches the carrier
                            const matches = !isEShipPlus &&
                                carrierName &&
                                normalizeCarrierName(carrierName).includes(selectedCarrier.normalized);
                            return matches;
                        }
                    });
                }
            }

            // Apply shipment type filter (client-side to check correct field path)
            if (filters.shipmentType !== 'all') {
                shipmentsData = shipmentsData.filter(shipment => {
                    // Check both root level and nested shipmentInfo.shipmentType
                    const rootShipmentType = shipment.shipmentType;
                    const nestedShipmentType = shipment.shipmentInfo?.shipmentType;

                    // Normalize the search term and shipment type values
                    const searchType = filters.shipmentType.toLowerCase();

                    // Check root level shipmentType
                    if (rootShipmentType && rootShipmentType.toLowerCase() === searchType) {
                        return true;
                    }

                    // Check nested shipmentInfo.shipmentType
                    if (nestedShipmentType && nestedShipmentType.toLowerCase() === searchType) {
                        return true;
                    }

                    // Map common variations (courier = express/small package, freight = LTL/large)
                    if (searchType === 'courier') {
                        return rootShipmentType?.toLowerCase().includes('courier') ||
                            rootShipmentType?.toLowerCase().includes('express') ||
                            nestedShipmentType?.toLowerCase().includes('courier') ||
                            nestedShipmentType?.toLowerCase().includes('express');
                    }

                    if (searchType === 'freight') {
                        return rootShipmentType?.toLowerCase().includes('freight') ||
                            rootShipmentType?.toLowerCase().includes('ltl') ||
                            nestedShipmentType?.toLowerCase().includes('freight') ||
                            nestedShipmentType?.toLowerCase().includes('ltl');
                    }

                    return false;
                });
            }

            // Apply date range filter
            if (dateRange[0] && dateRange[1]) {
                // Set start date to beginning of day and end date to end of day
                const startDate = dateRange[0].startOf('day').toDate();
                const endDate = dateRange[1].endOf('day').toDate();

                shipmentsData = shipmentsData.filter(shipment => {
                    const shipmentDate = shipment.createdAt?.toDate ? shipment.createdAt.toDate() : new Date(shipment.createdAt);
                    return shipmentDate >= startDate && shipmentDate <= endDate;
                });
            }

            // Apply shipment number filter
            if (shipmentNumber) {
                shipmentsData = shipmentsData.filter(shipment =>
                    (shipment.shipmentId || shipment.id || '').toLowerCase().includes(shipmentNumber.toLowerCase())
                );
            }

            // Apply customer filter
            if (selectedCustomer) {
                shipmentsData = shipmentsData.filter(shipment =>
                    shipment.companyName === selectedCustomer || shipment.customerId === selectedCustomer
                );
            }

            // Store the full unfiltered dataset for stats calculation
            setAllShipments(shipmentsData);

            // Filter by tab - exclude drafts from "All" tab
            if (selectedTab === 'all') {
                // "All" tab should exclude drafts (case-insensitive)
                shipmentsData = shipmentsData.filter(s => s.status?.toLowerCase() !== 'draft');
            } else if (selectedTab === 'draft') {
                // Handle draft tab - only show drafts (case-insensitive)
                shipmentsData = shipmentsData.filter(s => s.status?.toLowerCase() === 'draft');
            } else if (selectedTab === 'Awaiting Shipment') {
                // Handle "Awaiting Shipment" tab - filter by "scheduled" status
                shipmentsData = shipmentsData.filter(s => s.status?.toLowerCase() === 'scheduled');
            } else if (selectedTab === 'Cancelled') {
                // Handle "Cancelled" tab - filter by "cancelled" status (both spellings)
                shipmentsData = shipmentsData.filter(s =>
                    s.status?.toLowerCase() === 'cancelled' ||
                    s.status?.toLowerCase() === 'canceled' ||
                    s.status?.toLowerCase() === 'void' ||
                    s.status?.toLowerCase() === 'voided'
                );
            } else {
                // Handle other specific status tabs (In Transit, Delivered, etc.)
                // Use case-insensitive comparison for other statuses too
                shipmentsData = shipmentsData.filter(s => s.status?.toLowerCase() === selectedTab.toLowerCase());
            }

            // Apply sorting
            shipmentsData.sort((a, b) => {
                const aValue = a[sortBy.field];
                const bValue = b[sortBy.field];
                const direction = sortBy.direction === 'asc' ? 1 : -1;
                if (sortBy.field === 'createdAt' || sortBy.field === 'date') {
                    return direction * ((aValue?.toDate ? aValue.toDate() : new Date(aValue)) - (bValue?.toDate ? bValue.toDate() : new Date(bValue)));
                }
                if (typeof aValue === 'string') {
                    return direction * aValue.localeCompare(bValue);
                }
                return direction * (aValue - bValue);
            });

            setTotalCount(shipmentsData.length);
            // Pagination
            const paginatedData = rowsPerPage === -1
                ? shipmentsData // Show all if rowsPerPage is -1 (All option selected)
                : shipmentsData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

            setShipments(paginatedData);

            // Fetch carrier data for the loaded shipments
            const shipmentIds = paginatedData.map(shipment => shipment.id);
            await fetchCarrierData(shipmentIds);
        } catch (error) {
            console.error('Error loading shipments:', error);
            setShipments([]);
            setAllShipments([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading && !companyCtxLoading) {
            fetchCustomers();
            loadShipments();
        }
    }, [user, authLoading, companyIdForAddress, companyCtxLoading]);

    useEffect(() => {
        if (!authLoading && !companyCtxLoading && companyIdForAddress) {
            loadShipments();
        }
    }, [page, rowsPerPage, filters, sortBy, selectedTab, dateRange, companyIdForAddress, companyCtxLoading, authLoading]);

    // Debug print dialog state changes
    useEffect(() => {
        // Print dialog state tracking removed for cleaner console
    }, [printDialogOpen, printType, selectedShipment]);

    // Handle status chip display
    const getStatusChip = (status) => {
        let color = '';
        switch (status) {
            case 'Delivered':
                color = '#0a875a';
                break;
            case 'In Transit':
                color = '#2c6ecb';
                break;
            case 'Pending':
            case 'Awaiting Shipment':
                color = '#637381';
                break;
            default:
                color = '#637381';
        }

        return (
            <Chip
                label={status}
                sx={{
                    backgroundColor: `${color}10`,
                    color: color,
                    fontWeight: 500,
                    '& .MuiChip-label': { px: 1.5 }
                }}
            />
        );
    };

    // Handle export functionality
    const handleExport = () => {
        const data = shipments.map(shipment => ({
            'Shipment ID': shipment.id,
            'Date': new Date(shipment.date).toLocaleDateString(),
            'Customer': shipment.customer,
            'Origin': shipment.origin,
            'Destination': shipment.destination,
            'Status': shipment.status,
            'Carrier': carrierData[shipment.id]?.carrier ||
                shipment.selectedRateRef?.carrier ||
                shipment.selectedRate?.carrier ||
                shipment.carrier || 'N/A',
            'Items': shipment.items,
            'Cost': `$${shipment.cost.toFixed(2)}`
        }));

        if (selectedExportFormat === 'csv') {
            const csvContent = [
                Object.keys(data[0]).join(','),
                ...data.map(row => Object.values(row).join(','))
            ].join('\n');

            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `shipments_export_${new Date().toISOString().split('T')[0]}.csv`;
            a.click();
            window.URL.revokeObjectURL(url);
        }

        setIsExportDialogOpen(false);
    };

    const handleTabChange = (event, newValue) => {
        setSelectedTab(newValue);
    };

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

    const getStatusColor = (status) => {
        switch (status) {
            case 'Delivered':
                return { color: '#0a875a', bgcolor: '#f1f8f5' };
            case 'In Transit':
                return { color: '#2c6ecb', bgcolor: '#f4f6f8' };
            case 'Pending':
            case 'Awaiting Shipment':
                return { color: '#637381', bgcolor: '#f9fafb' };
            default:
                return { color: '#637381', bgcolor: '#f9fafb' };
        }
    };

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

    const handleActionMenuClose = (keepSelectedShipment = false) => {
        if (!keepSelectedShipment) {
            setSelectedShipment(null);
        }
        setActionMenuAnchorEl(null);

        // Clear document availability cache for this shipment
        if (selectedShipment && !keepSelectedShipment) {
            setDocumentAvailability(prev => {
                const updated = { ...prev };
                delete updated[selectedShipment.id];
                return updated;
            });
        }
    };

    // Handle draft deletion
    const handleDeleteDraft = async (shipmentId) => {
        if (!window.confirm('Are you sure you want to delete this draft shipment? This action cannot be undone.')) {
            return;
        }

        try {
            const shipmentDocRef = doc(db, 'shipments', shipmentId);
            await deleteDoc(shipmentDocRef);

            // Refresh the shipments list
            loadShipments();

            // Show success message (you might want to add a toast/snackbar here)
            console.log('Draft shipment deleted successfully');
        } catch (error) {
            console.error('Error deleting draft shipment:', error);
            alert('Failed to delete draft shipment. Please try again.');
        }
    };

    // Enhanced delete function with proper dialog
    const handleDeleteDraftWithDialog = (shipment) => {
        setShipmentToDelete(shipment);
        setDeleteConfirmOpen(true);
        handleActionMenuClose();
    };

    const confirmDeleteDraft = async () => {
        if (!shipmentToDelete) return;

        try {
            const shipmentDocRef = doc(db, 'shipments', shipmentToDelete.id);
            await deleteDoc(shipmentDocRef);

            // Refresh the shipments list
            loadShipments();

            console.log('Draft shipment deleted successfully');
        } catch (error) {
            console.error('Error deleting draft shipment:', error);
            alert('Failed to delete draft shipment. Please try again.');
        } finally {
            setDeleteConfirmOpen(false);
            setShipmentToDelete(null);
        }
    };

    // Print functionality
    const handlePrintLabel = (shipment) => {
        setSelectedShipment(shipment);
        setPrintType('label');
        setPrintDialogOpen(true);
        // Keep the selected shipment when closing the action menu
        handleActionMenuClose(true);
    };

    const handlePrintBOL = (shipment) => {
        setSelectedShipment(shipment);
        setPrintType('bol');
        setPrintDialogOpen(true);
        // Keep the selected shipment when closing the action menu
        handleActionMenuClose(true);
    };

    const generateAndDownloadLabel = async (format = 'PDF') => {
        if (!selectedShipment) return;

        setIsGeneratingLabel(true);
        try {
            // Use the same approach as ShipmentDetail.jsx
            // First, get all documents for the shipment
            const getShipmentDocumentsFunction = httpsCallable(functions, 'getShipmentDocuments');
            const documentsResult = await getShipmentDocumentsFunction({
                shipmentId: selectedShipment.id,
                organized: true // Request organized structure
            });

            if (!documentsResult.data || !documentsResult.data.success) {
                throw new Error(documentsResult.data?.error || 'Failed to fetch shipment documents');
            }

            const documents = documentsResult.data.data;
            let targetDocument = null;

            // Find the appropriate document based on print type
            if (printType === 'bol') {
                // Look for BOL documents
                if (documents.bol && documents.bol.length > 0) {
                    targetDocument = documents.bol[0];
                } else {
                    throw new Error('No Bill of Lading document found for this shipment');
                }
            } else {
                // Look for label documents
                if (documents.labels && documents.labels.length > 0) {
                    targetDocument = documents.labels[0];
                } else {
                    // Fallback: look in other documents for potential labels
                    const allDocs = Object.values(documents).flat();
                    const potentialLabels = allDocs.filter(doc => {
                        const filename = (doc.filename || '').toLowerCase();
                        const documentType = (doc.documentType || '').toLowerCase();
                        const isGeneratedBOL = doc.isGeneratedBOL === true || doc.metadata?.eshipplus?.generated === true;

                        // Exclude any BOL documents, including generated ones
                        if (filename.includes('bol') ||
                            filename.includes('billoflading') ||
                            filename.includes('bill-of-lading') ||
                            documentType.includes('bol') ||
                            isGeneratedBOL) {
                            return false;
                        }

                        return filename.includes('label') ||
                            filename.includes('shipping') ||
                            filename.includes('ship') ||
                            filename.includes('print') ||
                            filename.includes('prolabel') ||
                            filename.includes('pro-label') ||
                            documentType.includes('label') ||
                            documentType.includes('shipping');
                    });

                    if (potentialLabels.length > 0) {
                        targetDocument = potentialLabels[0];
                    } else {
                        throw new Error('No shipping label document found for this shipment');
                    }
                }
            }

            // Now get the download URL for the document
            const getDocumentDownloadUrlFunction = httpsCallable(functions, 'getDocumentDownloadUrl');
            const urlResult = await getDocumentDownloadUrlFunction({
                documentId: targetDocument.id,
                shipmentId: selectedShipment.id
            });

            if (!urlResult.data || !urlResult.data.success) {
                throw new Error(urlResult.data?.error || 'Failed to get document download URL');
            }

            // Open the document in the PDF viewer modal
            const downloadUrl = urlResult.data.downloadUrl;

            setCurrentPdfUrl(downloadUrl);
            setCurrentPdfTitle(`${printType === 'bol' ? 'BOL' : 'Label'} - ${selectedShipment.shipmentID || selectedShipment.id}`);
            setPdfViewerOpen(true);

            setPrintDialogOpen(false);
            setSelectedShipment(null); // Clear selected shipment after successful completion
        } catch (error) {
            console.error(`Error generating ${printType}:`, error);

            // More specific error messages
            if (error.code === 'functions/deadline-exceeded') {
                alert(`Request timed out while loading ${printType}. Please try again.`);
            } else if (error.code === 'functions/unavailable') {
                alert(`Service temporarily unavailable. Please try again in a moment.`);
            } else if (error.message.includes('Failed to fetch')) {
                alert(`Network error while loading ${printType}. Please check your connection and try again.`);
            } else {
                alert(`Failed to load ${printType}: ${error.message}`);
            }
        } finally {
            setIsGeneratingLabel(false);
        }
    };

    // Helper function to determine if shipment is freight
    const isFreightShipment = (shipment) => {
        const shipmentType = shipment.shipmentInfo?.shipmentType || shipment.shipmentType || '';
        const carrierName = shipment.selectedRateRef?.carrier ||
            shipment.selectedRate?.carrier ||
            shipment.carrier || '';

        return shipmentType.toLowerCase().includes('freight') ||
            shipmentType.toLowerCase().includes('ltl') ||
            carrierName.toLowerCase().includes('freight') ||
            carrierName.toLowerCase().includes('ltl');
    };

    /**
     * Enhanced single shipment status refresh using carrier-agnostic system
     */
    const handleRefreshShipmentStatus = async (shipment) => {
        try {
            setRefreshingStatus(prev => new Set([...prev, shipment.id]));

            console.log(`🔄 Refreshing status for shipment ${shipment.shipmentID || shipment.id} using carrier-agnostic system`);

            // Check if shipment is eligible for update
            if (!isEligibleForUpdate(shipment)) {
                const carrierInfo = getCarrierInfo(shipment);
                const reason = !carrierInfo.trackingValue ?
                    'No tracking information available' :
                    'Shipment not eligible for status update';

                showSnackbar(reason, 'warning');
                return;
            }

            // Use single shipment update
            const result = await updateSingleShipment(shipment, {
                force: false,
                timeout: 30000
            });

            if (result.success) {
                if (result.statusChanged) {
                    // Status changed - update local state
                    const updateShipment = (s) => s.id === shipment.id ? {
                        ...s,
                        status: result.newStatus,
                        statusLastChecked: new Date().toISOString(),
                        lastSmartUpdate: new Date().toISOString()
                    } : s;

                    setShipments(prevShipments => prevShipments.map(updateShipment));
                    setAllShipments(prevShipments => prevShipments.map(updateShipment));

                    console.log(`✅ Status updated for ${shipment.shipmentID}: ${result.previousStatus} → ${result.newStatus}`);
                    showSnackbar(
                        `Status updated: ${result.previousStatus} → ${result.newStatus}`,
                        'success'
                    );

                    if (result.trackingUpdatesCount > 0) {
                        showSnackbar(
                            `${result.trackingUpdatesCount} new tracking events added`,
                            'info'
                        );
                    }
                } else if (result.updated) {
                    // Status confirmed but no change
                    const updateShipment = (s) => s.id === shipment.id ? {
                        ...s,
                        statusLastChecked: new Date().toISOString(),
                        lastSmartUpdate: new Date().toISOString()
                    } : s;

                    setShipments(prevShipments => prevShipments.map(updateShipment));
                    setAllShipments(prevShipments => prevShipments.map(updateShipment));

                    if (result.trackingUpdatesCount > 0) {
                        showSnackbar(
                            `Status confirmed. ${result.trackingUpdatesCount} new tracking events added.`,
                            'success'
                        );
                    } else {
                        showSnackbar('Status confirmed - no changes detected', 'success');
                    }
                }
            } else if (result.skipped) {
                console.log(`⏭️ Status update skipped for ${shipment.shipmentID}: ${result.reason}`);
                showSnackbar(result.reason || 'Status check skipped', 'info');
            } else {
                console.error(`❌ Error updating ${shipment.shipmentID}:`, result.error);
                showSnackbar(`Failed to check status: ${result.error}`, 'error');
            }

        } catch (error) {
            console.error('Error in status refresh:', error);
            showSnackbar(`Failed to refresh status: ${error.message}`, 'error');
        } finally {
            setRefreshingStatus(prev => {
                const newSet = new Set(prev);
                newSet.delete(shipment.id);
                return newSet;
            });
        }
    };

    /**
     * Refresh status for multiple selected shipments with enhanced progress tracking
     */
    const handleBatchRefreshStatus = async () => {
        if (selected.length === 0) {
            showSnackbar('No shipments selected for status refresh', 'warning');
            return;
        }

        // Filter to only eligible shipments
        const selectedShipments = shipments.filter(s => selected.includes(s.id));
        const eligibleShipments = selectedShipments.filter(s => isEligibleForUpdate(s));

        if (eligibleShipments.length === 0) {
            const ineligibleReasons = selectedShipments
                .filter(s => !isEligibleForUpdate(s))
                .map(s => {
                    const carrierInfo = getCarrierInfo(s);
                    return !carrierInfo.trackingValue ?
                        `${s.shipmentID || s.id}: No tracking info` :
                        `${s.shipmentID || s.id}: Terminal status (${s.status})`;
                });

            showSnackbar(
                `No eligible shipments for update. ${ineligibleReasons.join(', ')}`,
                'warning'
            );
            return;
        }

        try {
            // Clear previous state and show progress dialog
            clearStatusUpdateState();
            setStatusProgressDialogOpen(true);

            console.log(`🔄 Starting batch status update for ${eligibleShipments.length} eligible shipments out of ${selectedShipments.length} selected`);

            const result = await updateMultipleShipments(eligibleShipments, {
                maxConcurrent: 3,
                force: false,
                retryFailedAttempts: 1,
                onProgress: (progress) => {
                    console.log(`Batch progress: ${progress.completed}/${progress.total} completed`);
                }
            });

            // Process results and update local state
            const updateStats = getUpdateStats();
            let statusChangedCount = 0;

            for (const [shipmentId, shipmentResult] of Object.entries(statusUpdateResults)) {
                if (shipmentResult.success && (shipmentResult.statusChanged || shipmentResult.updated)) {
                    // Update local state
                    const updateShipment = (s) => s.id === shipmentId ? {
                        ...s,
                        status: shipmentResult.newStatus || s.status,
                        statusLastChecked: new Date().toISOString(),
                        lastSmartUpdate: new Date().toISOString()
                    } : s;

                    setShipments(prevShipments => prevShipments.map(updateShipment));
                    setAllShipments(prevShipments => prevShipments.map(updateShipment));

                    if (shipmentResult.statusChanged) {
                        statusChangedCount++;
                    }
                }
            }

            // Show summary results
            if (result.success) {
                console.log(`✅ Batch update completed:`, updateStats);

                if (statusChangedCount > 0) {
                    showSnackbar(`${statusChangedCount} shipment(s) had status changes`, 'success');
                }

                if (updateStats.failed > 0) {
                    showSnackbar(`${updateStats.failed} shipment(s) failed to update`, 'error');
                }

                if (statusChangedCount === 0 && updateStats.failed === 0) {
                    showSnackbar('All shipments checked - no status changes found', 'info');
                }
            } else {
                showSnackbar(`Batch update failed: ${result.message}`, 'error');
            }

        } catch (error) {
            console.error('Error in batch status refresh:', error);
            showSnackbar(`Batch refresh failed: ${error.message}`, 'error');
        } finally {
            // Keep the progress dialog open for user to review results
            // Don't clear selection here - let user decide
        }
    };

    /**
     * Handle retry of failed shipments from batch update
     */
    const handleRetryFailedUpdates = async () => {
        const failedShipments = shipments.filter(s => {
            const result = statusUpdateResults[s.id];
            return result && !result.success && !result.skipped;
        });

        if (failedShipments.length === 0) {
            showSnackbar('No failed shipments to retry', 'info');
            return;
        }

        try {
            console.log(`🔄 Retrying ${failedShipments.length} failed shipments`);

            const result = await updateMultipleShipments(failedShipments, {
                maxConcurrent: 2, // Lower concurrency for retries
                force: true, // Force retry
                retryFailedAttempts: 2,
                onProgress: (progress) => {
                    console.log(`Retry progress: ${progress.completed}/${progress.total} completed`);
                }
            });

            const updateStats = getUpdateStats();

            if (result.success) {
                showSnackbar(`Retry completed: ${updateStats.successful} successful, ${updateStats.failed} still failed`,
                    updateStats.failed > 0 ? 'warning' : 'success');
            }

        } catch (error) {
            console.error('Error in retry:', error);
            showSnackbar(`Retry failed: ${error.message}`, 'error');
        }
    };

    /**
     * Enhanced snackbar function with better message handling (copied from ShipmentDetail.jsx)
     */
    const showSnackbar = (message, severity = 'info') => {
        setSnackbar({ open: true, message, severity });
    };

    /**
     * Check document availability for a shipment (labels and BOLs)
     */
    const checkDocumentAvailability = async (shipment) => {
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
                // Check in other documents for potential labels
                const allDocs = Object.values(documents).flat();
                const potentialLabels = allDocs.filter(doc => {
                    const filename = (doc.filename || '').toLowerCase();
                    const documentType = (doc.documentType || '').toLowerCase();
                    const isGeneratedBOL = doc.isGeneratedBOL === true || doc.metadata?.eshipplus?.generated === true;

                    // Exclude any BOL documents
                    if (filename.includes('bol') ||
                        filename.includes('billoflading') ||
                        filename.includes('bill-of-lading') ||
                        documentType.includes('bol') ||
                        isGeneratedBOL) {
                        return false;
                    }

                    return filename.includes('label') ||
                        filename.includes('shipping') ||
                        filename.includes('ship') ||
                        filename.includes('print') ||
                        filename.includes('prolabel') ||
                        filename.includes('pro-label') ||
                        documentType.includes('label') ||
                        documentType.includes('shipping');
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
    };

    // Add refresh on page focus to catch status updates when returning from other pages
    useEffect(() => {
        const handleFocus = () => {
            if (!authLoading && !companyCtxLoading && companyIdForAddress) {
                loadShipments();
            }
        };

        const handleVisibilityChange = () => {
            if (!document.hidden) {
                if (!authLoading && !companyCtxLoading && companyIdForAddress) {
                    loadShipments();
                }
            }
        };

        // Also listen for back/forward navigation events
        const handlePopState = () => {
            if (!authLoading && !companyCtxLoading && companyIdForAddress) {
                loadShipments();
            }
        };

        window.addEventListener('focus', handleFocus);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('focus', handleFocus);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('popstate', handlePopState);
        };
    }, [authLoading, companyCtxLoading, companyIdForAddress]);

    // Additional effect to refresh when component mounts (when navigating from other routes)
    useEffect(() => {
        const refreshOnMount = () => {
            // Check if we're navigating from another route (has history state)
            if (window.history.state || performance.getEntriesByType('navigation')[0]?.type === 'back_forward') {
                if (!authLoading && !companyCtxLoading && companyIdForAddress) {
                    // Small delay to ensure the page has settled
                    setTimeout(() => {
                        loadShipments();
                    }, 100);
                }
            }
        };

        refreshOnMount();
    }, []); // Only run on mount

    // --- Automatic polling for shipment statuses ---
    useEffect(() => {
        const interval = setInterval(() => {
            // Only poll for shipments that are not in a terminal state
            const terminalStates = ['delivered', 'cancelled', 'void', 'canceled', 'voided'];
            shipments.forEach((shipment) => {
                if (!terminalStates.includes((shipment.status || '').toLowerCase())) {
                    handleRefreshShipmentStatus(shipment);
                }
            });
        }, 60000); // 60 seconds
        return () => clearInterval(interval);
    }, [shipments]);

    return (
        <div className="shipments-container">
            <div className="breadcrumb-container">
                <Link to="/dashboard" className="breadcrumb-link">
                    <HomeIcon />
                    <Typography variant="body2">Dashboard</Typography>
                </Link>
                <div className="breadcrumb-separator">
                    <NavigateNextIcon />
                </div>
                <Typography variant="body2" className="breadcrumb-current">
                    Shipments
                </Typography>
            </div>

            <Paper className="shipments-paper">
                <Box sx={{ width: '100%', bgcolor: '#f8fafc', minHeight: '100vh', p: 3 }}>
                    <Box sx={{ maxWidth: '1200px', margin: '0 auto' }}>
                        {/* Header Section */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <Typography variant="h5" component="h1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                                Shipments
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 2 }}>
                                {selected.length > 0 && (
                                    <Button
                                        variant="outlined"
                                        startIcon={isUpdating ? <CircularProgress size={16} /> : <RefreshIcon />}
                                        onClick={handleBatchRefreshStatus}
                                        disabled={isUpdating}
                                        sx={{
                                            color: '#059669',
                                            borderColor: '#10b981',
                                            '&:hover': { borderColor: '#059669', bgcolor: '#f0fdf4' }
                                        }}
                                    >
                                        Update Status ({selected.length})
                                    </Button>
                                )}
                                <Button
                                    variant="outlined"
                                    startIcon={<ExportIcon />}
                                    onClick={() => setIsExportDialogOpen(true)}
                                    sx={{ color: '#64748b', borderColor: '#e2e8f0' }}
                                >
                                    Export
                                </Button>
                                {hasEnabledCarriers(companyData) ? (
                                    <Button
                                        variant="contained"
                                        startIcon={<AddIcon />}
                                        component={Link}
                                        to="/create-shipment"
                                        sx={{ bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' } }}
                                    >
                                        Create shipment
                                    </Button>
                                ) : (
                                    <Button
                                        variant="outlined"
                                        startIcon={<AddIcon />}
                                        disabled
                                        sx={{
                                            color: '#9ca3af',
                                            borderColor: '#e5e7eb',
                                            '&.Mui-disabled': {
                                                color: '#9ca3af',
                                                borderColor: '#e5e7eb'
                                            }
                                        }}
                                        title="No carriers enabled for your company. Please configure carriers first."
                                    >
                                        Create shipment
                                    </Button>
                                )}
                            </Box>
                        </Box>

                        {/* Main Content */}
                        <Paper sx={{ bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)' }}>
                            <Toolbar sx={{ borderBottom: 1, borderColor: '#e2e8f0', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Tabs value={selectedTab} onChange={handleTabChange}>
                                    <Tab label={`All (${stats.total})`} value="all" />
                                    <Tab label={`In Transit (${stats.inTransit})`} value="In Transit" />
                                    <Tab label={`Delivered (${stats.delivered})`} value="Delivered" />
                                    <Tab label={`Awaiting Shipment (${stats.awaitingShipment})`} value="Awaiting Shipment" />
                                    <Tab label={`Cancelled (${stats.cancelled})`} value="Cancelled" />
                                    <Tab label={`Drafts (${stats.drafts})`} value="draft" />
                                </Tabs>
                            </Toolbar>

                            {/* Search and Filter Section */}
                            <Box sx={{ p: 3, bgcolor: '#ffffff', borderRadius: 2 }}>
                                <Grid container spacing={2} alignItems="center">
                                    {/* Shipment ID Search */}
                                    <Grid item xs={12} sm={6} md={3}>
                                        <TextField
                                            fullWidth
                                            label="Shipment ID"
                                            placeholder="Search by Shipment ID (e.g. SH-12345)"
                                            value={searchFields.shipmentId}
                                            onChange={(e) => setSearchFields(prev => ({ ...prev, shipmentId: e.target.value }))}
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
                                            onChange={(e) => setSearchFields(prev => ({ ...prev, referenceNumber: e.target.value }))}
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
                                            onChange={(e) => setSearchFields(prev => ({ ...prev, trackingNumber: e.target.value }))}
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
                                                onChange={(newValue) => setDateRange(newValue)}
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
                                            onChange={(event, newValue) => setSelectedCustomer(newValue?.id || '')}
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
                                                onChange={(e) => setFilters(prev => ({
                                                    ...prev,
                                                    carrier: e.target.value
                                                }))}
                                                label="Carrier"
                                                sx={{ fontSize: '12px' }}
                                                MenuProps={{
                                                    PaperProps: {
                                                        sx: { '& .MuiMenuItem-root': { fontSize: '12px' } }
                                                    }
                                                }}
                                            >
                                                <MenuItem value="all" sx={{ fontSize: '12px' }}>All Carriers</MenuItem>
                                                {carrierOptions.map((group) => [
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
                                                onChange={(e) => setFilters(prev => ({
                                                    ...prev,
                                                    shipmentType: e.target.value
                                                }))}
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
                                            onChange={(value) => setFilters(prev => ({
                                                ...prev,
                                                enhancedStatus: value,
                                                // Keep legacy status for backward compatibility
                                                status: value ? enhancedToLegacy(value) : 'all'
                                            }))}
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
                                                    label={`Carrier: ${carrierOptions.flatMap(g => g.carriers).find(c => c.id === filters.carrier)?.name || filters.carrier}`}
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

                            {/* Shipments Table */}
                            <TableContainer>
                                <Table sx={{
                                    '& .MuiTableCell-root': { fontSize: '12px' },
                                    '& .MuiTypography-root': { fontSize: '12px' },
                                    '& .shipment-link': { fontSize: '12px' },
                                }}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    indeterminate={selected.length > 0 && selected.length < shipments.length}
                                                    checked={shipments.length > 0 && selected.length === shipments.length}
                                                    onChange={handleSelectAll}
                                                />
                                            </TableCell>
                                            <TableCell>ID</TableCell>
                                            <TableCell>DATE</TableCell>
                                            <TableCell>CUSTOMER</TableCell>
                                            <TableCell>ROUTE</TableCell>
                                            <TableCell sx={{ minWidth: 120 }}>CARRIER</TableCell>
                                            <TableCell>TYPE</TableCell>
                                            <TableCell>STATUS</TableCell>
                                            <TableCell align="right"></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={9} align="center">
                                                    <CircularProgress />
                                                </TableCell>
                                            </TableRow>
                                        ) : shipments.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={9} align="center">
                                                    No shipments found
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            shipments.map((shipment) => (
                                                <TableRow
                                                    hover
                                                    key={shipment.id}
                                                    selected={selected.indexOf(shipment.id) !== -1}
                                                >
                                                    <TableCell
                                                        padding="checkbox"
                                                        sx={{ verticalAlign: 'top', textAlign: 'left' }}
                                                    >
                                                        <Checkbox
                                                            checked={selected.indexOf(shipment.id) !== -1}
                                                            onChange={() => handleSelect(shipment.id)}
                                                        />
                                                    </TableCell>
                                                    <TableCell
                                                        sx={{ verticalAlign: 'top', textAlign: 'left', fontSize: '14px' }}
                                                    >
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                            {shipment.status === 'draft' ? (
                                                                <Link
                                                                    to={`/create-shipment/shipment-info/${shipment.id}`}
                                                                    className="shipment-link"
                                                                >
                                                                    {highlightSearchTerm(
                                                                        shipment.shipmentID || shipment.id,
                                                                        searchFields.shipmentId
                                                                    )}
                                                                </Link>
                                                            ) : (
                                                                <Link
                                                                    to={`/shipment/${shipment.shipmentID || shipment.id}`}
                                                                    className="shipment-link"
                                                                >
                                                                    {highlightSearchTerm(
                                                                        shipment.shipmentID || shipment.id,
                                                                        searchFields.shipmentId
                                                                    )}
                                                                </Link>
                                                            )}
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(shipment.shipmentID || shipment.id);
                                                                    showSnackbar('Shipment ID copied!', 'success');
                                                                }}
                                                                sx={{ padding: '2px' }}
                                                                title="Copy shipment ID"
                                                            >
                                                                <ContentCopyIcon sx={{ fontSize: '0.875rem', color: '#64748b' }} />
                                                            </IconButton>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell sx={{ verticalAlign: 'top', textAlign: 'left' }}>
                                                        {shipment.createdAt?.toDate
                                                            ? formatDateTime(shipment.createdAt)
                                                            : shipment.date
                                                                ? formatDateTime(shipment.date)
                                                                : 'N/A'}
                                                    </TableCell>
                                                    <TableCell sx={{ verticalAlign: 'top', textAlign: 'left' }}>
                                                        {shipment.shipTo?.customerID
                                                            ? customers[shipment.shipTo.customerID] || shipment.shipTo?.company || 'N/A'
                                                            : shipment.shipTo?.company || 'N/A'}
                                                    </TableCell>
                                                    <TableCell sx={{ verticalAlign: 'top', textAlign: 'left' }}>
                                                        {formatRoute(shipment.shipFrom || shipment.shipfrom, shipment.shipTo || shipment.shipto)}
                                                    </TableCell>
                                                    <TableCell sx={{ verticalAlign: 'top', textAlign: 'left' }}>
                                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                            {/* Carrier Name */}
                                                            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                                {(() => {
                                                                    const carrierName = carrierData[shipment.id]?.carrier ||
                                                                        shipment.selectedRateRef?.carrier ||
                                                                        shipment.selectedRate?.carrier ||
                                                                        shipment.carrier || 'N/A';

                                                                    // Enhanced eShipPlus detection with multiple methods
                                                                    const isEShipPlus =
                                                                        // Direct displayCarrierId check
                                                                        shipment.selectedRate?.displayCarrierId === 'ESHIPPLUS' ||
                                                                        shipment.selectedRateRef?.displayCarrierId === 'ESHIPPLUS' ||
                                                                        // sourceCarrierName check
                                                                        shipment.selectedRate?.sourceCarrierName === 'eShipPlus' ||
                                                                        shipment.selectedRateRef?.sourceCarrierName === 'eShipPlus' ||
                                                                        // carrierData check
                                                                        carrierData[shipment.id]?.displayCarrierId === 'ESHIPPLUS' ||
                                                                        carrierData[shipment.id]?.sourceCarrierName === 'eShipPlus' ||
                                                                        // Check for freight carrier indicators (common eShipPlus sub-carriers)
                                                                        (carrierName && (
                                                                            carrierName.toLowerCase().includes('ward trucking') ||
                                                                            carrierName.toLowerCase().includes('fedex freight') ||
                                                                            carrierName.toLowerCase().includes('road runner') ||
                                                                            carrierName.toLowerCase().includes('estes') ||
                                                                            carrierName.toLowerCase().includes('yrc') ||
                                                                            carrierName.toLowerCase().includes('xpo') ||
                                                                            carrierName.toLowerCase().includes('old dominion') ||
                                                                            carrierName.toLowerCase().includes('saia') ||
                                                                            carrierName.toLowerCase().includes('averitt') ||
                                                                            carrierName.toLowerCase().includes('southeastern freight')
                                                                        )) ||
                                                                        // Check shipment type for freight (often indicates eShipPlus)
                                                                        (shipment.shipmentInfo?.shipmentType?.toLowerCase().includes('freight') ||
                                                                            shipment.shipmentType?.toLowerCase().includes('freight'));

                                                                    // For eShip Plus shipments, the carrierName is actually the sub-carrier (like "Ward Trucking")
                                                                    // We append "via Eship Plus" to show it's through the eShip Plus platform
                                                                    return isEShipPlus && carrierName !== 'N/A' ?
                                                                        `${carrierName} via Eship Plus` :
                                                                        carrierName;
                                                                })()}
                                                            </Typography>
                                                            {/* Tracking/Confirmation/PRO Number with Copy Icon */}
                                                            {(() => {
                                                                // Find the most relevant tracking/confirmation number
                                                                const trackingNumber = shipment.trackingNumber ||
                                                                    shipment.selectedRate?.trackingNumber ||
                                                                    shipment.selectedRate?.TrackingNumber ||
                                                                    shipment.selectedRateRef?.trackingNumber ||
                                                                    shipment.selectedRateRef?.TrackingNumber ||
                                                                    shipment.carrierTrackingData?.trackingNumber ||
                                                                    shipment.carrierBookingConfirmation?.trackingNumber ||
                                                                    shipment.carrierBookingConfirmation?.proNumber ||
                                                                    shipment.carrierBookingConfirmation?.confirmationNumber ||
                                                                    shipment.bookingReferenceNumber ||
                                                                    shipment.selectedRate?.BookingReferenceNumber ||
                                                                    shipment.selectedRate?.bookingReferenceNumber ||
                                                                    shipment.selectedRateRef?.BookingReferenceNumber ||
                                                                    shipment.selectedRateRef?.bookingReferenceNumber ||
                                                                    shipment.carrierTrackingData?.bookingReferenceNumber ||
                                                                    shipment.carrierBookingConfirmation?.bookingReference ||
                                                                    shipment.carrierBookingConfirmation?.confirmationNumber ||
                                                                    '';
                                                                if (trackingNumber) {
                                                                    return (
                                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                            <QrCodeIcon sx={{ fontSize: '12px', color: '#64748b' }} />
                                                                            <Link
                                                                                to={`/tracking/${trackingNumber}`}
                                                                                style={{
                                                                                    textDecoration: 'none',
                                                                                    color: '#2563eb',
                                                                                    fontSize: '12px'
                                                                                }}
                                                                                onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                                                                                onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                                                                                title="Click to track this shipment"
                                                                            >
                                                                                {trackingNumber}
                                                                            </Link>
                                                                            <IconButton
                                                                                size="small"
                                                                                onClick={() => {
                                                                                    navigator.clipboard.writeText(trackingNumber);
                                                                                    showSnackbar('Tracking/PRO/Confirmation number copied!', 'success');
                                                                                }}
                                                                                sx={{ padding: '2px' }}
                                                                                title="Copy tracking/confirmation number"
                                                                            >
                                                                                <ContentCopyIcon sx={{ fontSize: '0.875rem', color: '#64748b' }} />
                                                                            </IconButton>
                                                                        </Box>
                                                                    );
                                                                }
                                                                return null;
                                                            })()}
                                                            {/* Reference Number */}
                                                            {shipment.referenceNumber && (
                                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#64748b' }}>
                                                                    Ref: {shipment.referenceNumber}
                                                                </Typography>
                                                            )}
                                                            {/* Service Level */}
                                                            {carrierData[shipment.id]?.service && (
                                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#64748b' }}>
                                                                    {carrierData[shipment.id].service}
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell sx={{ verticalAlign: 'top', textAlign: 'left' }}>
                                                        {capitalizeShipmentType(shipment.shipmentInfo?.shipmentType)}
                                                    </TableCell>
                                                    <TableCell sx={{ verticalAlign: 'top', textAlign: 'left' }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <StatusChip status={shipment.status} />
                                                            {shipment.status !== 'draft' && (
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => handleRefreshShipmentStatus(shipment)}
                                                                    disabled={refreshingStatus.has(shipment.id)}
                                                                    sx={{
                                                                        opacity: refreshingStatus.has(shipment.id) ? 0.5 : 0.7,
                                                                        '&:hover': { opacity: 1 }
                                                                    }}
                                                                    title="Refresh status"
                                                                >
                                                                    {refreshingStatus.has(shipment.id) ? (
                                                                        <CircularProgress size={14} />
                                                                    ) : (
                                                                        <RefreshIcon sx={{ fontSize: 14 }} />
                                                                    )}
                                                                </IconButton>
                                                            )}
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell
                                                        sx={{ verticalAlign: 'top', textAlign: 'left' }}
                                                        align="right"
                                                    >
                                                        <IconButton
                                                            onClick={(e) => handleActionMenuOpen(e, shipment)}
                                                            size="small"
                                                        >
                                                            <MoreVertIcon />
                                                        </IconButton>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>

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
                        </Paper>

                        {/* Export Dialog */}
                        <Dialog open={isExportDialogOpen} onClose={() => setIsExportDialogOpen(false)}>
                            <DialogTitle>Export Shipments</DialogTitle>
                            <DialogContent>
                                <FormControl fullWidth sx={{ mt: 2 }}>
                                    <InputLabel>Format</InputLabel>
                                    <Select
                                        value={selectedExportFormat}
                                        onChange={(e) => setSelectedExportFormat(e.target.value)}
                                        label="Format"
                                    >
                                        <MenuItem value="csv">CSV</MenuItem>
                                        <MenuItem value="excel">Excel</MenuItem>
                                        <MenuItem value="pdf">PDF</MenuItem>
                                    </Select>
                                </FormControl>
                            </DialogContent>
                            <DialogActions>
                                <Button onClick={() => setIsExportDialogOpen(false)}>Cancel</Button>
                                <Button onClick={handleExport} variant="contained">
                                    Export
                                </Button>
                            </DialogActions>
                        </Dialog>

                        {/* Enhanced Action Menu with conditional options based on shipment status */}
                        <Menu
                            anchorEl={actionMenuAnchorEl}
                            open={Boolean(actionMenuAnchorEl)}
                            onClose={() => handleActionMenuClose()}
                            PaperProps={{
                                sx: {
                                    '& .MuiMenuItem-root': { fontSize: '12px' }
                                }
                            }}
                        >
                            {/* View Details - Only for non-draft shipments */}
                            {selectedShipment?.status !== 'draft' && (
                                <MenuItem onClick={() => {
                                    handleActionMenuClose();
                                    navigate(`/shipment/${selectedShipment?.shipmentID || selectedShipment?.id}`);
                                }}>
                                    <ListItemIcon>
                                        <VisibilityIcon sx={{ fontSize: '14px' }} />
                                    </ListItemIcon>
                                    View Details
                                </MenuItem>
                            )}

                            {/* Draft shipment options */}
                            {selectedShipment?.status === 'draft' && (
                                <>
                                    <MenuItem onClick={() => {
                                        handleActionMenuClose();
                                        navigate(`/create-shipment/shipment-info/${selectedShipment.id}`);
                                    }}>
                                        <ListItemIcon>
                                            <EditIcon sx={{ fontSize: '14px' }} />
                                        </ListItemIcon>
                                        Edit Draft
                                    </MenuItem>
                                    <MenuItem onClick={() => handleDeleteDraftWithDialog(selectedShipment)}>
                                        <ListItemIcon>
                                            <DeleteIcon sx={{ fontSize: '14px' }} />
                                        </ListItemIcon>
                                        Delete Draft
                                    </MenuItem>
                                </>
                            )}

                            {/* Show loading while checking documents */}
                            {selectedShipment?.status !== 'draft' && checkingDocuments && (
                                <MenuItem disabled>
                                    <ListItemIcon>
                                        <CircularProgress size={14} />
                                    </ListItemIcon>
                                    Checking documents...
                                </MenuItem>
                            )}

                            {/* Print Label - Only for non-draft shipments that have labels */}
                            {selectedShipment?.status !== 'draft' &&
                                !checkingDocuments &&
                                documentAvailability[selectedShipment?.id]?.hasLabels && (
                                    <MenuItem onClick={() => handlePrintLabel(selectedShipment)}>
                                        <ListItemIcon>
                                            <PrintIcon sx={{ fontSize: '14px' }} />
                                        </ListItemIcon>
                                        Print Label
                                    </MenuItem>
                                )}

                            {/* Print BOL - Only for non-draft shipments that have BOLs */}
                            {selectedShipment?.status !== 'draft' &&
                                !checkingDocuments &&
                                documentAvailability[selectedShipment?.id]?.hasBOLs && (
                                    <MenuItem onClick={() => handlePrintBOL(selectedShipment)}>
                                        <ListItemIcon>
                                            <DescriptionIcon sx={{ fontSize: '14px' }} />
                                        </ListItemIcon>
                                        Print BOL
                                    </MenuItem>
                                )}

                            {/* Show message if no documents available for non-draft shipments */}
                            {selectedShipment?.status !== 'draft' &&
                                !checkingDocuments &&
                                documentAvailability[selectedShipment?.id] &&
                                !documentAvailability[selectedShipment?.id]?.hasLabels &&
                                !documentAvailability[selectedShipment?.id]?.hasBOLs && (
                                    <MenuItem disabled>
                                        <ListItemIcon>
                                            <WarningIcon sx={{ fontSize: '14px', color: '#f59e0b' }} />
                                        </ListItemIcon>
                                        No documents available
                                    </MenuItem>
                                )}
                        </Menu>
                    </Box>
                </Box>
            </Paper>

            {/* Print Dialog */}
            <Dialog
                open={printDialogOpen}
                onClose={() => {
                    setPrintDialogOpen(false);
                    setSelectedShipment(null); // Clear selected shipment when dialog closes
                }}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    {printType === 'bol' ? 'Print Bill of Lading' : 'Print Shipping Label'}
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                        {printType === 'bol'
                            ? 'Generate and download the Bill of Lading for this freight shipment.'
                            : 'Generate and download the shipping label for this shipment.'
                        }
                    </Typography>

                    {selectedShipment ? (
                        <Box sx={{ mt: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                            {/* Shipment ID */}
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="subtitle2" sx={{ color: '#64748b', fontSize: '0.75rem', mb: 0.5 }}>
                                    SHIPMENT NUMBER
                                </Typography>
                                <Typography variant="body1" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
                                    {selectedShipment.shipmentID || selectedShipment.id}
                                </Typography>
                            </Box>

                            {/* Carrier and Service */}
                            {(() => {
                                const carrier = getShipmentCarrier(selectedShipment);
                                const serviceType = selectedShipment.selectedRateRef?.service ||
                                    selectedShipment.selectedRate?.service ||
                                    carrierData[selectedShipment.id]?.service;

                                return (
                                    <>
                                        <Box sx={{ mb: 2 }}>
                                            <Typography variant="subtitle2" sx={{ color: '#64748b', fontSize: '0.75rem', mb: 0.5 }}>
                                                CARRIER
                                            </Typography>
                                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                {carrier.name}
                                                {carrier.isEShipPlus && (
                                                    <Typography component="span" sx={{ ml: 1, fontSize: '0.75rem', color: '#7c3aed', bgcolor: '#ede9fe', px: 1, py: 0.25, borderRadius: 1 }}>
                                                        eShipPlus
                                                    </Typography>
                                                )}
                                            </Typography>
                                        </Box>

                                        {serviceType && (
                                            <Box>
                                                <Typography variant="subtitle2" sx={{ color: '#64748b', fontSize: '0.75rem', mb: 0.5 }}>
                                                    SERVICE TYPE
                                                </Typography>
                                                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                    {serviceType}
                                                </Typography>
                                            </Box>
                                        )}
                                    </>
                                );
                            })()}
                        </Box>
                    ) : (
                        <Box sx={{ mt: 2, p: 2, bgcolor: '#fef3c7', borderRadius: 1, border: '1px solid #f59e0b' }}>
                            <Typography variant="body2" color="#92400e">
                                ⚠️ No shipment selected. Please close and try again.
                            </Typography>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => {
                            setPrintDialogOpen(false);
                            setSelectedShipment(null); // Clear selected shipment when cancelled
                        }}
                        disabled={isGeneratingLabel}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => {
                            generateAndDownloadLabel('PDF');
                        }}
                        variant="contained"
                        disabled={isGeneratingLabel}
                        startIcon={isGeneratingLabel ? <CircularProgress size={16} /> : <PrintIcon />}
                    >
                        {isGeneratingLabel ? 'Generating...' : `Print ${printType === 'bol' ? 'BOL' : 'Label'}`}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Delete Draft Shipment
                </DialogTitle>
                <DialogContent>
                    <Typography variant="body1" sx={{ mb: 2 }}>
                        Are you sure you want to delete this draft shipment? This action cannot be undone.
                    </Typography>
                    {shipmentToDelete && (
                        <Box sx={{ mt: 2, p: 2, bgcolor: '#fff3e0', borderRadius: 1, border: '1px solid #ffcc02' }}>
                            <Typography variant="subtitle2">
                                Shipment: {shipmentToDelete.shipmentID || shipmentToDelete.id}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                {shipmentToDelete.shipTo?.company || 'N/A'}
                            </Typography>
                            <Typography variant="body2" color="textSecondary">
                                Status: {shipmentToDelete.status}
                            </Typography>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setDeleteConfirmOpen(false)}
                        variant="outlined"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={confirmDeleteDraft}
                        variant="contained"
                        color="error"
                        startIcon={<DeleteIcon />}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>

            {/* PDF Viewer Modal (copied from ShipmentDetail.jsx) */}
            <Dialog
                open={pdfViewerOpen}
                onClose={() => {
                    setPdfViewerOpen(false);
                    if (currentPdfUrl?.startsWith('blob:')) {
                        URL.revokeObjectURL(currentPdfUrl);
                    }
                    setCurrentPdfUrl(null);
                }}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: {
                        height: '90vh',
                        borderRadius: 2
                    }
                }}
            >
                <DialogTitle sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid',
                    borderColor: 'divider'
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PictureAsPdfIcon color="error" />
                        <Typography variant="h6">{currentPdfTitle}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            onClick={() => {
                                if (currentPdfUrl) {
                                    window.open(currentPdfUrl, '_blank');
                                }
                            }}
                            startIcon={<FileDownloadIcon />}
                            size="small"
                        >
                            Download
                        </Button>
                        <IconButton onClick={() => {
                            setPdfViewerOpen(false);
                            if (currentPdfUrl?.startsWith('blob:')) {
                                URL.revokeObjectURL(currentPdfUrl);
                            }
                            setCurrentPdfUrl(null);
                        }}>
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ p: 0, height: '100%' }}>
                    {currentPdfUrl && (
                        <Box sx={{ height: '100%', width: '100%' }}>
                            <iframe
                                src={currentPdfUrl}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    border: 'none'
                                }}
                                title={currentPdfTitle}
                            />
                        </Box>
                    )}
                </DialogContent>
            </Dialog>

            {/* Status Update Progress Dialog */}
            <StatusUpdateProgress
                open={statusProgressDialogOpen}
                onClose={() => setStatusProgressDialogOpen(false)}
                updateProgress={statusUpdateProgress}
                isUpdating={isUpdating}
                results={statusUpdateResults}
                updateStats={getUpdateStats()}
                onCancel={() => {
                    // Cancel ongoing updates if possible
                    setStatusProgressDialogOpen(false);
                }}
                onRetryErrors={handleRetryFailedUpdates}
            />

            {/* Enhanced Snackbar for User Feedback (copied from ShipmentDetail.jsx) */}
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
                    {/* Enhanced status update integration could be added here in the future */}
                </Alert>
            </Snackbar>
        </div >
    );
};

export default Shipments; 