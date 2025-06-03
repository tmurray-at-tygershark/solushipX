import React, { useState, useEffect, useMemo, useCallback } from 'react';
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
    Tooltip
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
    Close as CloseIcon
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

// Extract StatusChip component for reusability (from Dashboard)
const StatusChip = React.memo(({ status }) => {
    const getStatusConfig = (status) => {
        switch (status?.toLowerCase()) {
            // Draft/Initial States - Grey
            case 'draft':
                return {
                    color: '#64748b',
                    bgcolor: '#f1f5f9',
                    label: 'Draft'
                };
            case 'unknown':
                return {
                    color: '#6b7280',
                    bgcolor: '#f9fafb',
                    label: 'Unknown'
                };

            // Early Processing - Light Grey
            case 'pending':
            case 'created':
                return {
                    color: '#d97706',
                    bgcolor: '#fef3c7',
                    label: 'Pending'
                };

            // Scheduled - Light Blue
            case 'scheduled':
                return {
                    color: '#7c3aed',
                    bgcolor: '#ede9fe',
                    label: 'Scheduled'
                };

            // Confirmed - Blue
            case 'booked':
                return {
                    color: '#2563eb',
                    bgcolor: '#dbeafe',
                    label: 'Booked'
                };

            // Ready to Ship - Orange
            case 'awaiting pickup':
            case 'awaiting shipment':
            case 'awaiting_shipment':
            case 'label_created':
                return {
                    color: '#ea580c',
                    bgcolor: '#fed7aa',
                    label: 'Awaiting Shipment'
                };

            // In Motion - Purple
            case 'in transit':
            case 'in_transit':
                return {
                    color: '#7c2d92',
                    bgcolor: '#f3e8ff',
                    label: 'In Transit'
                };

            // Success - Green (Reserved for completion)
            case 'delivered':
                return {
                    color: '#16a34a',
                    bgcolor: '#dcfce7',
                    label: 'Delivered'
                };

            // Problem States - Red variants
            case 'on hold':
            case 'on_hold':
                return {
                    color: '#dc2626',
                    bgcolor: '#fee2e2',
                    label: 'On Hold'
                };
            case 'cancelled':
            case 'canceled':
                return {
                    color: '#b91c1c',
                    bgcolor: '#fecaca',
                    label: 'Cancelled'
                };
            case 'void':
                return {
                    color: '#7f1d1d',
                    bgcolor: '#f3f4f6',
                    label: 'Void'
                };

            default:
                return {
                    color: '#6b7280',
                    bgcolor: '#f9fafb',
                    label: status || 'Unknown'
                };
        }
    };

    const { color, bgcolor, label } = getStatusConfig(status);

    return (
        <Chip
            label={label}
            sx={{
                color: color,
                bgcolor: bgcolor,
                borderRadius: '16px',
                fontWeight: 500,
                fontSize: '0.75rem',
                height: '24px',
                '& .MuiChip-label': {
                    px: 2
                }
            }}
            size="small"
        />
    );
});

// Helper function to capitalize shipment type
const capitalizeShipmentType = (type) => {
    if (!type) return 'N/A';
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
};

const Shipments = () => {
    const { user, loading: authLoading } = useAuth();
    const { companyIdForAddress, loading: companyCtxLoading } = useCompany();
    const [shipments, setShipments] = useState([]);
    const [allShipments, setAllShipments] = useState([]); // Store all unfiltered shipments for stats
    const [customers, setCustomers] = useState({});
    const [carrierData, setCarrierData] = useState({});
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
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
        console.log('🔍 Starting search with:', {
            searchFields,
            filters,
            dateRange,
            selectedTab,
            allShipmentsCount: allShipments.length
        });

        setLoading(true);
        try {
            let filteredShipments = [...allShipments];
            console.log('📦 Initial shipments count:', filteredShipments.length);

            // Log a sample shipment to understand the data structure
            if (filteredShipments.length > 0) {
                console.log('📋 Sample shipment structure:', {
                    id: filteredShipments[0].id,
                    shipmentID: filteredShipments[0].shipmentID,
                    status: filteredShipments[0].status,
                    carrier: filteredShipments[0].carrier,
                    selectedRate: filteredShipments[0].selectedRate,
                    selectedRateRef: filteredShipments[0].selectedRateRef,
                    shipTo: filteredShipments[0].shipTo,
                    shipFrom: filteredShipments[0].shipFrom,
                    shipmentInfo: filteredShipments[0].shipmentInfo,
                    trackingNumber: filteredShipments[0].trackingNumber,
                    referenceNumber: filteredShipments[0].referenceNumber
                });
            }

            // First apply tab filter
            if (selectedTab === 'all') {
                // "All" tab should exclude drafts
                filteredShipments = filteredShipments.filter(s => s.status?.toLowerCase() !== 'draft');
                console.log('🏷️ After "all" tab filter (exclude drafts):', filteredShipments.length);
            } else if (selectedTab === 'draft') {
                // Handle draft tab - only show drafts (case-insensitive)
                filteredShipments = filteredShipments.filter(s => s.status?.toLowerCase() === 'draft');
                console.log('🏷️ After "draft" tab filter:', filteredShipments.length);
            } else if (selectedTab === 'In Transit') {
                filteredShipments = filteredShipments.filter(s =>
                    s.status?.toLowerCase() === 'in_transit' ||
                    s.status?.toLowerCase() === 'in transit'
                );
                console.log('🏷️ After "In Transit" tab filter:', filteredShipments.length);
            } else if (selectedTab === 'Delivered') {
                filteredShipments = filteredShipments.filter(s =>
                    s.status?.toLowerCase() === 'delivered'
                );
                console.log('🏷️ After "Delivered" tab filter:', filteredShipments.length);
            } else if (selectedTab === 'Awaiting Shipment') {
                filteredShipments = filteredShipments.filter(s =>
                    s.status?.toLowerCase() === 'scheduled'
                );
                console.log('🏷️ After "Awaiting Shipment" tab filter:', filteredShipments.length);
            }

            // Shipment ID search (partial match)
            if (searchFields.shipmentId) {
                const searchTerm = searchFields.shipmentId.toLowerCase();
                console.log('🔍 Searching for shipment ID:', searchTerm);
                const beforeCount = filteredShipments.length;
                filteredShipments = filteredShipments.filter(shipment => {
                    const shipmentId = (shipment.shipmentID || shipment.id || '').toLowerCase();
                    const matches = shipmentId.includes(searchTerm);
                    if (matches) {
                        console.log('✅ Shipment ID match:', shipmentId, 'contains', searchTerm);
                    }
                    return matches;
                });
                console.log('🔍 After shipment ID filter:', beforeCount, '->', filteredShipments.length);
            }

            // Reference Number search
            if (searchFields.referenceNumber) {
                const searchTerm = searchFields.referenceNumber.toLowerCase();
                console.log('🔍 Searching for reference number:', searchTerm);
                const beforeCount = filteredShipments.length;
                filteredShipments = filteredShipments.filter(shipment => {
                    const refNumber = (
                        shipment.shipmentInfo?.shipperReferenceNumber ||
                        shipment.referenceNumber ||
                        ''
                    ).toLowerCase();
                    const matches = refNumber.includes(searchTerm);
                    if (matches) {
                        console.log('✅ Reference number match:', refNumber, 'contains', searchTerm);
                    }
                    return matches;
                });
                console.log('🔍 After reference number filter:', beforeCount, '->', filteredShipments.length);
            }

            // Tracking Number search
            if (searchFields.trackingNumber) {
                const searchTerm = searchFields.trackingNumber.toLowerCase();
                console.log('🔍 Searching for tracking number:', searchTerm);
                const beforeCount = filteredShipments.length;
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

                    console.log(`🔍 Checking shipment ${shipment.id} for tracking "${searchTerm}":`, {
                        isEShipPlus,
                        displayCarrierId: shipment.selectedRate?.displayCarrierId || shipment.selectedRateRef?.displayCarrierId,
                        sourceCarrierName: shipment.selectedRate?.sourceCarrierName || shipment.selectedRateRef?.sourceCarrierName,
                        carrier: carrierName,
                        enhancedDetection: carrierName.toLowerCase().includes('freight') ? 'Detected as freight carrier' : 'Not a freight carrier'
                    });

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

                    console.log(`🔍 Tracking data for shipment ${shipment.id}:`, {
                        trackingNumber: trackingNumber || 'N/A',
                        bookingReferenceNumber: bookingReferenceNumber || 'N/A',
                        isEShipPlus,
                        searchTerm,

                        // Log all the fields we're checking
                        rawTrackingFields: {
                            'shipment.trackingNumber': shipment.trackingNumber,
                            'selectedRate.trackingNumber': shipment.selectedRate?.trackingNumber,
                            'selectedRate.TrackingNumber': shipment.selectedRate?.TrackingNumber,
                            'selectedRateRef.trackingNumber': shipment.selectedRateRef?.trackingNumber,
                            'selectedRateRef.TrackingNumber': shipment.selectedRateRef?.TrackingNumber,
                            'carrierTrackingData.trackingNumber': shipment.carrierTrackingData?.trackingNumber,
                            'carrierBookingConfirmation.trackingNumber': shipment.carrierBookingConfirmation?.trackingNumber,
                            'carrierBookingConfirmation.proNumber': shipment.carrierBookingConfirmation?.proNumber
                        },

                        rawBookingFields: isEShipPlus ? {
                            'shipment.bookingReferenceNumber': shipment.bookingReferenceNumber,
                            'selectedRate.BookingReferenceNumber': shipment.selectedRate?.BookingReferenceNumber,
                            'selectedRate.bookingReferenceNumber': shipment.selectedRate?.bookingReferenceNumber,
                            'selectedRateRef.BookingReferenceNumber': shipment.selectedRateRef?.BookingReferenceNumber,
                            'selectedRateRef.bookingReferenceNumber': shipment.selectedRateRef?.bookingReferenceNumber,
                            'carrierTrackingData.bookingReferenceNumber': shipment.carrierTrackingData?.bookingReferenceNumber,
                            'carrierBookingConfirmation.bookingReference': shipment.carrierBookingConfirmation?.bookingReference,
                            'carrierBookingConfirmation.confirmationNumber': shipment.carrierBookingConfirmation?.confirmationNumber
                        } : 'Not eShipPlus'
                    });

                    // Check both tracking number and booking reference (for eShipPlus)
                    const trackingMatches = trackingNumber.includes(searchTerm);
                    const bookingMatches = isEShipPlus && bookingReferenceNumber.includes(searchTerm);
                    const matches = trackingMatches || bookingMatches;

                    if (matches) {
                        console.log('✅ Tracking/Booking number match:', {
                            shipmentId: shipment.id,
                            isEShipPlus,
                            trackingNumber: trackingNumber || 'N/A',
                            bookingReferenceNumber: bookingReferenceNumber || 'N/A',
                            searchTerm,
                            trackingMatches,
                            bookingMatches
                        });
                    } else {
                        console.log('❌ No tracking/booking match:', {
                            shipmentId: shipment.id,
                            isEShipPlus,
                            trackingNumber: trackingNumber || 'N/A',
                            bookingReferenceNumber: bookingReferenceNumber || 'N/A',
                            searchTerm
                        });
                    }

                    return matches;
                });
                console.log('🔍 After tracking number filter:', beforeCount, '->', filteredShipments.length);
            }

            // Carrier filter with eShipPlus sub-carriers
            if (filters.carrier !== 'all') {
                console.log('🔍 Filtering by carrier:', filters.carrier);
                const beforeCount = filteredShipments.length;
                const selectedCarrier = carrierOptions
                    .flatMap(g => g.carriers)
                    .find(c => c.id === filters.carrier);

                if (selectedCarrier) {
                    console.log(`📊 Selected carrier config:`, selectedCarrier);
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

                        console.log(`📊 Checking shipment ${shipment.id}: carrier="${carrierName}", isEShipPlus=${isEShipPlus}`);

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

                            if (matches) {
                                console.log(`✅ eShipPlus carrier match: ${carrierName} matches ${selectedCarrier.name}`);
                            }
                            return matches;
                        } else {
                            // For regular carriers, check if it's NOT eShipPlus and matches the carrier
                            const matches = !isEShipPlus &&
                                carrierName &&
                                normalizeCarrierName(carrierName).includes(selectedCarrier.normalized);
                            if (matches) {
                                console.log(`✅ Regular carrier match: ${carrierName} contains ${selectedCarrier.normalized}`);
                            }
                            return matches;
                        }
                    });
                }
                console.log(`📊 After carrier filter (${filters.carrier}): ${beforeCount} -> ${filteredShipments.length}`);
            }

            // Date range filter
            if (dateRange[0] && dateRange[1]) {
                console.log('🔍 Filtering by date range:', dateRange[0].format('YYYY-MM-DD'), 'to', dateRange[1].format('YYYY-MM-DD'));
                const beforeCount = filteredShipments.length;

                // Set start date to beginning of day and end date to end of day
                const startDate = dateRange[0].startOf('day').toDate();
                const endDate = dateRange[1].endOf('day').toDate();

                console.log('🔍 Date range in UTC:', {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                });

                filteredShipments = filteredShipments.filter(shipment => {
                    const shipmentDate = shipment.createdAt?.toDate
                        ? shipment.createdAt.toDate()
                        : new Date(shipment.createdAt);

                    console.log('🔍 Checking shipment date:', {
                        shipmentId: shipment.id,
                        shipmentDate: shipmentDate.toISOString(),
                        startDate: startDate.toISOString(),
                        endDate: endDate.toISOString(),
                        isAfterStart: shipmentDate >= startDate,
                        isBeforeEnd: shipmentDate <= endDate
                    });

                    const matches = shipmentDate >= startDate && shipmentDate <= endDate;
                    if (matches) {
                        console.log('✅ Date range match:', shipmentDate.toISOString());
                    } else {
                        console.log('❌ Date range NO match:', shipmentDate.toISOString());
                    }
                    return matches;
                });
                console.log('🔍 After date range filter:', beforeCount, '->', filteredShipments.length);
            }

            // Customer search
            if (searchFields.customerName) {
                const searchTerm = searchFields.customerName.toLowerCase();
                console.log('🔍 Searching for customer:', searchTerm);
                const beforeCount = filteredShipments.length;
                filteredShipments = filteredShipments.filter(shipment => {
                    const customerName = (
                        customers[shipment.shipTo?.customerID] ||
                        shipment.shipTo?.company ||
                        ''
                    ).toLowerCase();
                    const matches = customerName.includes(searchTerm);
                    if (matches) {
                        console.log('✅ Customer match:', customerName, 'contains', searchTerm);
                    }
                    return matches;
                });
                console.log('🔍 After customer filter:', beforeCount, '->', filteredShipments.length);
            }

            // Origin/Destination search
            if (searchFields.origin || searchFields.destination) {
                console.log('🔍 Searching for origin/destination:', searchFields.origin, '/', searchFields.destination);
                const beforeCount = filteredShipments.length;
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
                    const matches = originMatch && destinationMatch;
                    if (matches) {
                        console.log('✅ Origin/Destination match for shipment:', shipment.id);
                    }
                    return matches;
                });
                console.log('🔍 After origin/destination filter:', beforeCount, '->', filteredShipments.length);
            }

            console.log('✅ Final filtered shipments count:', filteredShipments.length);
            setShipments(filteredShipments);
            setTotalCount(filteredShipments.length);
        } catch (error) {
            console.error('❌ Error in search:', error);
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

    // Enhanced stats calculation to include all statuses including drafts
    const stats = useMemo(() => {
        return {
            total: allShipments.filter(s => s.status?.toLowerCase() !== 'draft').length, // Exclude drafts from total
            inTransit: allShipments.filter(s => s.status?.toLowerCase() === 'in_transit' || s.status?.toLowerCase() === 'in transit').length,
            delivered: allShipments.filter(s => s.status?.toLowerCase() === 'delivered').length,
            awaitingShipment: allShipments.filter(s => s.status?.toLowerCase() === 'scheduled').length,
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
            console.log("Shipments.jsx: Waiting for companyIdForAddress or company context to finish loading.");
            setLoading(false);
            setShipments([]); // Clear shipments if no companyId
            setAllShipments([]); // Clear all shipments for stats
            setTotalCount(0);
            return;
        }
        if (!companyIdForAddress && companyCtxLoading) {
            console.log("Shipments.jsx: Company context is loading, waiting for companyIdForAddress.");
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

        console.log(`📊 loadShipments called with companyIdForAddress: ${companyIdForAddress}`);
        console.log(`📊 Current filters:`, filters);
        console.log(`📊 Current dateRange:`, dateRange);
        console.log(`📊 Current selectedTab:`, selectedTab);

        setLoading(true);
        try {
            let shipmentsRef = collection(db, 'shipments');
            // Always filter by companyID
            let q = query(shipmentsRef, where('companyID', '==', companyIdForAddress), orderBy('createdAt', 'desc'));

            console.log(`📊 Firestore query: companyID == ${companyIdForAddress}`);

            // Apply status filter
            if (filters.status !== 'all') {
                q = query(q, where('status', '==', filters.status));
                console.log(`📊 Adding status filter: ${filters.status}`);
            }

            // Fetch all shipments (for now, pagination can be improved with startAfter/limit)
            const querySnapshot = await getDocs(q);
            let shipmentsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log(`📊 Firestore returned ${shipmentsData.length} shipments`);

            // Log first few shipments for debugging
            if (shipmentsData.length > 0) {
                console.log(`📊 First shipment structure:`, {
                    id: shipmentsData[0].id,
                    shipmentID: shipmentsData[0].shipmentID,
                    status: shipmentsData[0].status,
                    companyID: shipmentsData[0].companyID,
                    createdAt: shipmentsData[0].createdAt,
                    carrier: shipmentsData[0].carrier,
                    selectedRate: shipmentsData[0].selectedRate,
                    selectedRateRef: shipmentsData[0].selectedRateRef,
                    shipTo: shipmentsData[0].shipTo,
                    shipFrom: shipmentsData[0].shipFrom,
                    shipmentType: shipmentsData[0].shipmentType, // Check root level
                    shipmentInfo: shipmentsData[0].shipmentInfo // Check nested level
                });

                // Log shipment types found to understand the data structure
                const shipmentTypes = shipmentsData.map(s => ({
                    id: s.id,
                    rootShipmentType: s.shipmentType,
                    nestedShipmentType: s.shipmentInfo?.shipmentType
                })).slice(0, 5);
                console.log(`📊 Sample shipment types found:`, shipmentTypes);
            }

            // Apply carrier filter (client-side to check both carrier and selectedRate.carrier)
            if (filters.carrier !== 'all') {
                const beforeCount = shipmentsData.length;
                const selectedCarrier = carrierOptions
                    .flatMap(g => g.carriers)
                    .find(c => c.id === filters.carrier);

                if (selectedCarrier) {
                    console.log(`📊 Selected carrier config:`, selectedCarrier);
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

                        console.log(`📊 Checking shipment ${shipment.id}: carrier="${carrierName}", isEShipPlus=${isEShipPlus}`);

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

                            if (matches) {
                                console.log(`✅ eShipPlus carrier match: ${carrierName} matches ${selectedCarrier.name}`);
                            }
                            return matches;
                        } else {
                            // For regular carriers, check if it's NOT eShipPlus and matches the carrier
                            const matches = !isEShipPlus &&
                                carrierName &&
                                normalizeCarrierName(carrierName).includes(selectedCarrier.normalized);
                            if (matches) {
                                console.log(`✅ Regular carrier match: ${carrierName} contains ${selectedCarrier.normalized}`);
                            }
                            return matches;
                        }
                    });
                }
                console.log(`📊 After carrier filter (${filters.carrier}): ${beforeCount} -> ${shipmentsData.length}`);
            }

            // Apply shipment type filter (client-side to check correct field path)
            if (filters.shipmentType !== 'all') {
                const beforeCount = shipmentsData.length;
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
                console.log(`📊 After shipment type filter (${filters.shipmentType}): ${beforeCount} -> ${shipmentsData.length}`);
            }

            // Apply date range filter
            if (dateRange[0] && dateRange[1]) {
                const beforeCount = shipmentsData.length;

                // Set start date to beginning of day and end date to end of day
                const startDate = dateRange[0].startOf('day').toDate();
                const endDate = dateRange[1].endOf('day').toDate();

                console.log(`📊 Date range filter: ${dateRange[0].format('YYYY-MM-DD')} to ${dateRange[1].format('YYYY-MM-DD')}`);
                console.log('📊 Date range in UTC:', {
                    startDate: startDate.toISOString(),
                    endDate: endDate.toISOString()
                });

                shipmentsData = shipmentsData.filter(shipment => {
                    const shipmentDate = shipment.createdAt?.toDate ? shipment.createdAt.toDate() : new Date(shipment.createdAt);

                    console.log('📊 Checking shipment date:', {
                        shipmentId: shipment.id,
                        shipmentDate: shipmentDate.toISOString(),
                        matches: shipmentDate >= startDate && shipmentDate <= endDate
                    });

                    return shipmentDate >= startDate && shipmentDate <= endDate;
                });
                console.log(`📊 After date range filter: ${beforeCount} -> ${shipmentsData.length}`);
            }

            // Apply shipment number filter
            if (shipmentNumber) {
                const beforeCount = shipmentsData.length;
                shipmentsData = shipmentsData.filter(shipment =>
                    (shipment.shipmentId || shipment.id || '').toLowerCase().includes(shipmentNumber.toLowerCase())
                );
                console.log(`📊 After shipment number filter: ${beforeCount} -> ${shipmentsData.length}`);
            }

            // Apply customer filter
            if (selectedCustomer) {
                const beforeCount = shipmentsData.length;
                shipmentsData = shipmentsData.filter(shipment =>
                    shipment.companyName === selectedCustomer || shipment.customerId === selectedCustomer
                );
                console.log(`📊 After customer filter: ${beforeCount} -> ${shipmentsData.length}`);
            }

            // Apply general search filter
            if (searchTerm) {
                const beforeCount = shipmentsData.length;
                const searchableFields = ['shipmentId', 'id', 'companyName', 'shippingAddress', 'deliveryAddress', 'carrier', 'shipmentType', 'status'];
                shipmentsData = shipmentsData.filter(shipment =>
                    searchableFields.some(field => {
                        const value = shipment[field];
                        if (!value) return false;
                        if (typeof value === 'string' || typeof value === 'number') {
                            return String(value).toLowerCase().includes(searchTerm.toLowerCase());
                        }
                        // For address objects
                        if ((field === 'shippingAddress' || field === 'deliveryAddress') && typeof value === 'object') {
                            return Object.values(value).join(' ').toLowerCase().includes(searchTerm.toLowerCase());
                        }
                        return false;
                    }) ||
                    // Also search in selectedRate.carrier
                    (shipment.selectedRateRef?.carrier &&
                        String(shipment.selectedRateRef.carrier).toLowerCase().includes(searchTerm.toLowerCase())) ||
                    // Also search in fetched carrier data
                    (carrierData[shipment.id]?.carrier &&
                        String(carrierData[shipment.id].carrier).toLowerCase().includes(searchTerm.toLowerCase()))
                );
                console.log(`📊 After search term filter: ${beforeCount} -> ${shipmentsData.length}`);
            }

            // Store the full unfiltered dataset for stats calculation
            console.log(`📊 Setting allShipments to ${shipmentsData.length} shipments`);
            setAllShipments(shipmentsData);

            // Filter by tab - exclude drafts from "All" tab
            if (selectedTab === 'all') {
                // "All" tab should exclude drafts (case-insensitive)
                shipmentsData = shipmentsData.filter(s => s.status?.toLowerCase() !== 'draft');
                console.log(`📊 After "all" tab filter: ${shipmentsData.length} shipments`);
            } else if (selectedTab === 'draft') {
                // Handle draft tab - only show drafts (case-insensitive)
                shipmentsData = shipmentsData.filter(s => s.status?.toLowerCase() === 'draft');
                console.log(`📊 After "draft" tab filter: ${shipmentsData.length} shipments`);
            } else if (selectedTab === 'Awaiting Shipment') {
                // Handle "Awaiting Shipment" tab - filter by "scheduled" status
                shipmentsData = shipmentsData.filter(s => s.status?.toLowerCase() === 'scheduled');
                console.log(`📊 After "Awaiting Shipment" tab filter: ${shipmentsData.length} shipments`);
            } else {
                // Handle other specific status tabs (In Transit, Delivered, etc.)
                // Use case-insensitive comparison for other statuses too
                shipmentsData = shipmentsData.filter(s => s.status?.toLowerCase() === selectedTab.toLowerCase());
                console.log(`📊 After "${selectedTab}" tab filter: ${shipmentsData.length} shipments`);
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
            const startIndex = page * rowsPerPage;
            const endIndex = startIndex + rowsPerPage;
            const paginatedData = rowsPerPage === -1
                ? shipmentsData // Show all if rowsPerPage is -1 (All option selected)
                : shipmentsData.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

            console.log(`📊 Final paginated data: ${paginatedData.length} shipments (page ${page}, rowsPerPage ${rowsPerPage})`);
            setShipments(paginatedData);

            // Fetch carrier data for the loaded shipments
            const shipmentIds = paginatedData.map(shipment => shipment.id);
            console.log(`📊 Fetching carrier data for ${shipmentIds.length} shipments`);
            await fetchCarrierData(shipmentIds);
        } catch (error) {
            console.error('❌ Error loading shipments:', error);
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
    }, [page, rowsPerPage, searchTerm, filters, sortBy, selectedTab, dateRange, companyIdForAddress, companyCtxLoading, authLoading]);

    // Debug print dialog state changes
    useEffect(() => {
        console.log('🖨️ Print dialog state changed:', {
            printDialogOpen,
            printType,
            selectedShipment: selectedShipment ? selectedShipment.id : null
        });
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

    const handleActionMenuOpen = (event, shipment) => {
        setSelectedShipment(shipment);
        setActionMenuAnchorEl(event.currentTarget);
    };

    const handleActionMenuClose = (keepSelectedShipment = false) => {
        if (!keepSelectedShipment) {
            setSelectedShipment(null);
        }
        setActionMenuAnchorEl(null);
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
        console.log('🖨️ handlePrintLabel called with shipment:', shipment);
        console.log('🖨️ Setting selectedShipment to:', shipment);
        setSelectedShipment(shipment);
        setPrintType('label');
        console.log('🖨️ Opening print dialog for label');
        setPrintDialogOpen(true);
        // Keep the selected shipment when closing the action menu
        handleActionMenuClose(true);
        console.log('🖨️ Print dialog should be opening for label');
    };

    const handlePrintBOL = (shipment) => {
        console.log('🖨️ handlePrintBOL called with shipment:', shipment);
        console.log('🖨️ Setting selectedShipment to:', shipment);
        setSelectedShipment(shipment);
        setPrintType('bol');
        console.log('🖨️ Opening print dialog for BOL');
        setPrintDialogOpen(true);
        // Keep the selected shipment when closing the action menu
        handleActionMenuClose(true);
        console.log('🖨️ Print dialog should be opening for BOL');
    };

    const generateAndDownloadLabel = async (format = 'PDF') => {
        if (!selectedShipment) return;

        setIsGeneratingLabel(true);
        try {
            console.log(`🖨️ Generating ${printType} for shipment:`, selectedShipment.id);
            console.log(`🖨️ Selected shipment data:`, selectedShipment);

            // Use the same approach as ShipmentDetail.jsx
            // First, get all documents for the shipment
            const getShipmentDocumentsFunction = httpsCallable(functions, 'getShipmentDocuments');
            const documentsResult = await getShipmentDocumentsFunction({
                shipmentId: selectedShipment.id,
                organized: true // Request organized structure
            });

            console.log(`🖨️ Documents result:`, documentsResult);

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

            console.log(`🖨️ Found target document:`, targetDocument);

            // Now get the download URL for the document
            const getDocumentDownloadUrlFunction = httpsCallable(functions, 'getDocumentDownloadUrl');
            const urlResult = await getDocumentDownloadUrlFunction({
                documentId: targetDocument.id,
                shipmentId: selectedShipment.id
            });

            console.log(`🖨️ Download URL result:`, urlResult);

            if (!urlResult.data || !urlResult.data.success) {
                throw new Error(urlResult.data?.error || 'Failed to get document download URL');
            }

            // Open the document in the PDF viewer modal
            const downloadUrl = urlResult.data.downloadUrl;
            console.log(`🖨️ Opening document URL in modal:`, downloadUrl);

            setCurrentPdfUrl(downloadUrl);
            setCurrentPdfTitle(`${printType === 'bol' ? 'BOL' : 'Label'} - ${selectedShipment.shipmentID || selectedShipment.id}`);
            setPdfViewerOpen(true);

            console.log(`🖨️ ${printType} opened successfully in modal`);
            setPrintDialogOpen(false);
            setSelectedShipment(null); // Clear selected shipment after successful completion
        } catch (error) {
            console.error(`🖨️ Error generating ${printType}:`, error);

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
     * Refresh status for a specific shipment
     */
    const handleRefreshShipmentStatus = async (shipment) => {
        try {
            setRefreshingStatus(prev => new Set([...prev, shipment.id]));

            // Log the full shipment object for debugging
            console.log('Attempting to refresh status for shipment:', {
                id: shipment.id,
                status: shipment.status,
                carrier: shipment.carrier,
                selectedRate: shipment.selectedRate,
                selectedRateRef: shipment.selectedRateRef,
                trackingNumber: shipment.trackingNumber,
                bookingReferenceNumber: shipment.bookingReferenceNumber,
                carrierBookingConfirmation: shipment.carrierBookingConfirmation
            });

            // Determine the carrier from various possible sources
            let carrier = carrierData[shipment.id]?.carrier ||
                shipment.selectedRateRef?.carrier ||
                shipment.selectedRate?.carrier ||
                shipment.selectedRate?.CarrierName ||
                shipment.carrier ||
                shipment.shipmentInfo?.carrier;

            // Get tracking information early so we can use it for carrier detection
            // For general tracking numbers
            const trackingNumber = shipment.trackingNumber ||
                shipment.selectedRate?.trackingNumber ||
                shipment.selectedRate?.TrackingNumber ||
                shipment.selectedRateRef?.trackingNumber ||
                shipment.selectedRateRef?.TrackingNumber ||
                shipment.carrierTrackingData?.trackingNumber ||
                shipment.carrierBookingConfirmation?.trackingNumber ||
                shipment.carrierBookingConfirmation?.proNumber;

            // For booking references (eShipPlus)
            const bookingReferenceNumber = shipment.bookingReferenceNumber ||
                shipment.selectedRate?.BookingReferenceNumber ||
                shipment.selectedRate?.bookingReferenceNumber ||
                shipment.selectedRateRef?.BookingReferenceNumber ||
                shipment.selectedRateRef?.bookingReferenceNumber ||
                shipment.carrierTrackingData?.bookingReferenceNumber ||
                shipment.carrierBookingConfirmation?.bookingReference ||
                shipment.carrierBookingConfirmation?.confirmationNumber;

            // Check if this is an eShipPlus shipment
            const isEShipPlusShipment =
                carrierData[shipment.id]?.displayCarrierId === 'ESHIPPLUS' ||
                carrierData[shipment.id]?.sourceCarrierName === 'eShipPlus' ||
                shipment.selectedRate?.displayCarrierId === 'ESHIPPLUS' ||
                shipment.selectedRate?.sourceCarrierName === 'eShipPlus' ||
                shipment.selectedRateRef?.displayCarrierId === 'ESHIPPLUS' ||
                shipment.selectedRateRef?.sourceCarrierName === 'eShipPlus' ||
                carrier?.toLowerCase().includes('eshipplus');

            // Extract carrier from different sources with eShipPlus override
            if (isEShipPlusShipment) {
                carrier = 'eShipPlus';
                console.log('Detected eShipPlus shipment, overriding carrier to eShipPlus');
            } else if (!carrier) {
                // Try to get carrier from other sources
                carrier = carrierData[shipment.id]?.carrier ||
                    shipment.selectedRateRef?.carrier ||
                    shipment.selectedRate?.carrier ||
                    shipment.carrier ||
                    shipment.selectedRate?.CarrierName ||
                    shipment.carrierBookingConfirmation?.carrier;
            }

            if (!carrier) {
                console.error('Cannot refresh status: No carrier information found for shipment', shipment.id);
                alert('Cannot refresh status: No carrier information available for this shipment.');
                return;
            }

            const normalizeCarrier = (carrierName) => {
                const normalized = carrierName.toLowerCase();
                if (normalized.includes('canpar')) return 'Canpar';
                if (normalized.includes('eship') || normalized.includes('e-ship')) return 'eShipPlus';
                // For eShipPlus sub-carriers
                if (normalized.includes('fedex freight')) return 'eShipPlus';
                if (normalized.includes('freight')) return 'eShipPlus'; // Generic freight often means eShipPlus
                // Standard carriers
                if (normalized.includes('fedex')) return 'FedEx';
                if (normalized.includes('ups')) return 'UPS';
                if (normalized.includes('dhl')) return 'DHL';
                if (normalized.includes('purolator')) return 'Purolator';
                if (normalized.includes('canada post')) return 'Canada Post';
                if (normalized.includes('usps')) return 'USPS';
                return carrierName; // Return original if no match
            };

            const normalizedCarrier = normalizeCarrier(carrier);

            // For Canpar specific barcode
            const canparBarcode = shipment.selectedRate?.Barcode ||
                shipment.selectedRateRef?.Barcode ||
                shipment.carrierBookingConfirmation?.trackingNumber;

            console.log('Found tracking information:', {
                trackingNumber,
                bookingReferenceNumber,
                canparBarcode,
                carrier: normalizedCarrier
            });

            // Determine which identifier to use based on carrier
            let identifierToUse = trackingNumber;
            const carrierLower = normalizedCarrier.toLowerCase();

            if (carrierLower.includes('eshipplus') || carrierLower.includes('eship')) {
                identifierToUse = bookingReferenceNumber || trackingNumber;
                if (!identifierToUse) {
                    console.error(`Cannot refresh status for eShipPlus shipment ${shipment.id}: No booking reference found`);
                    alert('Cannot refresh status: No booking reference available for this eShipPlus shipment.');
                    return;
                }
            } else if (carrierLower.includes('canpar')) {
                identifierToUse = canparBarcode || trackingNumber;
                if (!identifierToUse) {
                    console.error(`Cannot refresh status for Canpar shipment ${shipment.id}: No barcode/tracking number found`);
                    alert('Cannot refresh status: No barcode available for this Canpar shipment.');
                    return;
                }
            } else if (!trackingNumber && !bookingReferenceNumber) {
                console.error(`Cannot refresh status for shipment ${shipment.id}: No tracking information found`, {
                    shipmentData: shipment,
                    carrierData: carrierData[shipment.id]
                });
                alert('Cannot refresh status: No tracking number or booking reference available for this shipment.');
                return;
            }

            console.log(`Refreshing status for shipment ${shipment.id}`, {
                carrier: normalizedCarrier,
                trackingNumber: identifierToUse,
                bookingReferenceNumber: carrierLower.includes('eship') ? identifierToUse : bookingReferenceNumber
            });

            const response = await fetch('https://checkshipmentstatus-xedyh5vw7a-uc.a.run.app', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    shipmentId: shipment.id,
                    carrier: normalizedCarrier,
                    trackingNumber: trackingNumber || identifierToUse || '',
                    bookingReferenceNumber: bookingReferenceNumber || (carrierLower.includes('eship') ? identifierToUse : '') || ''
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || `HTTP error! status: ${response.status}`);
            }

            if (result.success) {
                // Update the shipment in the local state
                setShipments(prevShipments =>
                    prevShipments.map(s =>
                        s.id === shipment.id
                            ? {
                                ...s,
                                status: result.status,
                                statusLastChecked: new Date().toISOString(),
                                carrierTrackingData: result,
                                trackingNumber: trackingNumber || s.trackingNumber,
                                bookingReferenceNumber: bookingReferenceNumber || s.bookingReferenceNumber
                            }
                            : s
                    )
                );

                // Also update allShipments for stats
                setAllShipments(prevShipments =>
                    prevShipments.map(s =>
                        s.id === shipment.id
                            ? {
                                ...s,
                                status: result.status,
                                statusLastChecked: new Date().toISOString(),
                                carrierTrackingData: result,
                                trackingNumber: trackingNumber || s.trackingNumber,
                                bookingReferenceNumber: bookingReferenceNumber || s.bookingReferenceNumber
                            }
                            : s
                    )
                );

                console.log(`Status updated for shipment ${shipment.id}: ${result.statusDisplay || result.status}`);
            } else {
                throw new Error(result.error || 'Failed to check status');
            }

        } catch (error) {
            console.error('Error refreshing shipment status:', error);
            alert(`Failed to refresh status: ${error.message}`);
        } finally {
            setRefreshingStatus(prev => {
                const newSet = new Set(prev);
                newSet.delete(shipment.id);
                return newSet;
            });
        }
    };

    return (
        <div className="shipments-container">
            <div className="breadcrumb-container">
                <Link to="/" className="breadcrumb-link">
                    <HomeIcon />
                    <Typography variant="body2">Home</Typography>
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
                                <Button
                                    variant="outlined"
                                    startIcon={<ExportIcon />}
                                    onClick={() => setIsExportDialogOpen(true)}
                                    sx={{ color: '#64748b', borderColor: '#e2e8f0' }}
                                >
                                    Export
                                </Button>
                                <Button
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    component={Link}
                                    to="/create-shipment"
                                    sx={{ bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' } }}
                                >
                                    Create shipment
                                </Button>
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
                                    <Tab label={`Drafts (${stats.drafts})`} value="draft" />
                                </Tabs>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <TextField
                                        size="small"
                                        placeholder="Search shipments..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon sx={{ color: '#64748b' }} />
                                                </InputAdornment>
                                            ),
                                            endAdornment: searchTerm && (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => setSearchTerm('')}
                                                        sx={{ color: '#64748b' }}
                                                    >
                                                        <ClearIcon />
                                                    </IconButton>
                                                </InputAdornment>
                                            )
                                        }}
                                        sx={{ width: 300 }}
                                    />
                                </Box>
                            </Toolbar>

                            {/* Search and Filter Section */}
                            <Box sx={{ p: 3, bgcolor: '#ffffff', borderRadius: 2 }}>
                                <Grid container spacing={2} alignItems="center">
                                    {/* Shipment ID Search */}
                                    <Grid item xs={12} sm={6} md={3}>
                                        <TextField
                                            fullWidth
                                            label="Shipment ID"
                                            value={searchFields.shipmentId}
                                            onChange={(e) => setSearchFields(prev => ({
                                                ...prev,
                                                shipmentId: e.target.value
                                            }))}
                                            placeholder="Full or partial ID"
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <SearchIcon sx={{ color: '#64748b' }} />
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
                                            value={searchFields.referenceNumber}
                                            onChange={(e) => setSearchFields(prev => ({
                                                ...prev,
                                                referenceNumber: e.target.value
                                            }))}
                                            placeholder="Reference or PO number"
                                            InputProps={{
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
                                            value={searchFields.trackingNumber}
                                            onChange={(e) => setSearchFields(prev => ({
                                                ...prev,
                                                trackingNumber: e.target.value
                                            }))}
                                            placeholder="Tracking or PRO number"
                                            InputProps={{
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
                                                localeText={{ start: 'From', end: 'To' }}
                                                slotProps={{
                                                    textField: {
                                                        size: "small",
                                                        fullWidth: true,
                                                        variant: "outlined",
                                                        sx: {
                                                            '& .MuiInputBase-root': {
                                                                height: '56px', // Match other TextField heights
                                                            }
                                                        }
                                                    },
                                                    actionBar: {
                                                        actions: ['clear', 'today', 'accept']
                                                    }
                                                }}
                                                calendars={2}
                                                sx={{
                                                    width: '100%'
                                                }}
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
                                                <TextField {...params} label="Customer" placeholder="Search customers" />
                                            )}
                                        />
                                    </Grid>

                                    {/* Carrier Selection with Sub-carriers */}
                                    <Grid item xs={12} sm={6} md={3}>
                                        <FormControl fullWidth>
                                            <InputLabel>Carrier</InputLabel>
                                            <Select
                                                value={filters.carrier}
                                                onChange={(e) => setFilters(prev => ({
                                                    ...prev,
                                                    carrier: e.target.value
                                                }))}
                                                label="Carrier"
                                            >
                                                <MenuItem value="all">All Carriers</MenuItem>
                                                {carrierOptions.map((group) => [
                                                    <ListSubheader key={group.group}>{group.group}</ListSubheader>,
                                                    ...group.carriers.map((carrier) => (
                                                        <MenuItem key={carrier.id} value={carrier.id}>
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
                                            <InputLabel>Type</InputLabel>
                                            <Select
                                                value={filters.shipmentType}
                                                onChange={(e) => setFilters(prev => ({
                                                    ...prev,
                                                    shipmentType: e.target.value
                                                }))}
                                                label="Type"
                                            >
                                                <MenuItem value="all">All Types</MenuItem>
                                                <MenuItem value="courier">Courier</MenuItem>
                                                <MenuItem value="freight">Freight</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>

                                    {/* Status Filter */}
                                    <Grid item xs={12} sm={6} md={2}>
                                        <FormControl fullWidth>
                                            <InputLabel>Status</InputLabel>
                                            <Select
                                                value={filters.status}
                                                onChange={(e) => setFilters(prev => ({
                                                    ...prev,
                                                    status: e.target.value
                                                }))}
                                                label="Status"
                                            >
                                                <MenuItem value="all">All Statuses</MenuItem>
                                                <MenuItem value="scheduled">Scheduled</MenuItem>
                                                <MenuItem value="booked">Booked</MenuItem>
                                                <MenuItem value="in_transit">In Transit</MenuItem>
                                                <MenuItem value="delivered">Delivered</MenuItem>
                                                <MenuItem value="cancelled">Cancelled</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>

                                    {/* Clear Filters Button */}
                                    <Grid item xs={12} sm={6} md={2}>
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
                                            Clear Filters
                                        </Button>
                                    </Grid>
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
                                <Table>
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
                                            <TableCell>CUSTOMER</TableCell>
                                            <TableCell>ORIGIN</TableCell>
                                            <TableCell>DESTINATION</TableCell>
                                            <TableCell sx={{ minWidth: 120 }}>CARRIER</TableCell>
                                            <TableCell>TYPE</TableCell>
                                            <TableCell>STATUS</TableCell>
                                            <TableCell align="right">ACTIONS</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={10} align="center">
                                                    <CircularProgress />
                                                </TableCell>
                                            </TableRow>
                                        ) : shipments.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={10} align="center">
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
                                                        sx={{ verticalAlign: 'top', textAlign: 'left' }}
                                                    >
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
                                                    </TableCell>
                                                    <TableCell
                                                        sx={{ verticalAlign: 'top', textAlign: 'left' }}
                                                    >
                                                        {highlightSearchTerm(
                                                            shipment.shipTo?.customerID ?
                                                                customers[shipment.shipTo.customerID] ||
                                                                shipment.shipTo?.company || 'N/A'
                                                                : shipment.shipTo?.company || 'N/A',
                                                            searchFields.customerName
                                                        )}
                                                    </TableCell>
                                                    <TableCell
                                                        sx={{ verticalAlign: 'top', textAlign: 'left' }}
                                                    >
                                                        {formatAddress(
                                                            shipment.shipFrom || shipment.shipfrom,
                                                            'Origin',
                                                            searchFields.origin
                                                        )}
                                                    </TableCell>
                                                    <TableCell
                                                        sx={{ verticalAlign: 'top', textAlign: 'left' }}
                                                    >
                                                        {formatAddress(
                                                            shipment.shipTo || shipment.shipto,
                                                            'Destination',
                                                            searchFields.destination
                                                        )}
                                                    </TableCell>
                                                    <TableCell
                                                        sx={{ verticalAlign: 'top', textAlign: 'left' }}
                                                    >
                                                        {(() => {
                                                            const carrier = getShipmentCarrier(shipment);

                                                            // Get service type
                                                            const serviceType = shipment.selectedRateRef?.service ||
                                                                shipment.selectedRate?.service ||
                                                                carrierData[shipment.id]?.service;

                                                            // Get tracking number for non-draft shipments
                                                            let trackingNumber = null;
                                                            if (shipment.status?.toLowerCase() !== 'draft') {
                                                                // Enhanced eShipPlus detection for tracking
                                                                const carrierName = shipment.selectedRate?.carrier ||
                                                                    shipment.selectedRateRef?.carrier ||
                                                                    shipment.carrier || '';

                                                                const isEShipPlus =
                                                                    shipment.selectedRate?.displayCarrierId === 'ESHIPPLUS' ||
                                                                    shipment.selectedRateRef?.displayCarrierId === 'ESHIPPLUS' ||
                                                                    shipment.selectedRate?.sourceCarrierName === 'eShipPlus' ||
                                                                    shipment.selectedRateRef?.sourceCarrierName === 'eShipPlus' ||
                                                                    carrierName.toLowerCase().includes('freight') ||
                                                                    carrierName.toLowerCase().includes('fedex freight') ||
                                                                    carrierName.toLowerCase().includes('road runner') ||
                                                                    carrierName.toLowerCase().includes('estes') ||
                                                                    carrierName.toLowerCase().includes('yrc') ||
                                                                    carrierName.toLowerCase().includes('xpo') ||
                                                                    carrierName.toLowerCase().includes('old dominion') ||
                                                                    carrierName.toLowerCase().includes('saia') ||
                                                                    carrierName.toLowerCase().includes('ltl');

                                                                // Standard tracking number
                                                                const standardTracking = shipment.trackingNumber ||
                                                                    shipment.selectedRate?.trackingNumber ||
                                                                    shipment.selectedRate?.TrackingNumber ||
                                                                    shipment.selectedRateRef?.trackingNumber ||
                                                                    shipment.selectedRateRef?.TrackingNumber ||
                                                                    shipment.carrierTrackingData?.trackingNumber ||
                                                                    shipment.carrierBookingConfirmation?.trackingNumber ||
                                                                    shipment.carrierBookingConfirmation?.proNumber;

                                                                // For eShipPlus, also check booking reference
                                                                const bookingReference = isEShipPlus ? (
                                                                    shipment.bookingReferenceNumber ||
                                                                    shipment.selectedRate?.BookingReferenceNumber ||
                                                                    shipment.selectedRate?.bookingReferenceNumber ||
                                                                    shipment.selectedRateRef?.BookingReferenceNumber ||
                                                                    shipment.selectedRateRef?.bookingReferenceNumber ||
                                                                    shipment.carrierTrackingData?.bookingReferenceNumber ||
                                                                    shipment.carrierBookingConfirmation?.bookingReference ||
                                                                    shipment.carrierBookingConfirmation?.confirmationNumber
                                                                ) : null;

                                                                trackingNumber = standardTracking || bookingReference;
                                                            }

                                                            return (
                                                                <div>
                                                                    {/* Carrier Name */}
                                                                    <div style={{ fontWeight: 500, fontSize: '0.875rem' }}>
                                                                        {highlightSearchTerm(
                                                                            carrier.name,
                                                                            filters.carrier !== 'all' ?
                                                                                filters.carrier.replace('eShipPlus_', '') : ''
                                                                        )}
                                                                    </div>

                                                                    {/* Service Type */}
                                                                    {serviceType && (
                                                                        <div style={{
                                                                            fontSize: '0.75rem',
                                                                            color: '#64748b',
                                                                            marginTop: '2px'
                                                                        }}>
                                                                            {serviceType}
                                                                        </div>
                                                                    )}

                                                                    {/* Tracking Number (only for non-draft shipments) */}
                                                                    {trackingNumber && (
                                                                        <div style={{
                                                                            fontSize: '0.75rem',
                                                                            color: '#059669',
                                                                            marginTop: '4px',
                                                                            fontFamily: 'monospace'
                                                                        }}>
                                                                            {highlightSearchTerm(
                                                                                trackingNumber,
                                                                                searchFields.trackingNumber
                                                                            )}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })()}
                                                    </TableCell>
                                                    <TableCell
                                                        sx={{ verticalAlign: 'top', textAlign: 'left' }}
                                                    >
                                                        {capitalizeShipmentType(shipment.shipmentInfo?.shipmentType)}
                                                    </TableCell>
                                                    <TableCell
                                                        sx={{ verticalAlign: 'top', textAlign: 'left' }}
                                                    >
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
                            onClose={handleActionMenuClose}
                        >
                            {/* Conditional menu items based on shipment status */}
                            {selectedShipment?.status === 'draft' ? (
                                // Draft shipments: Show only Edit and Delete options
                                <>
                                    <MenuItem onClick={() => {
                                        handleActionMenuClose();
                                        if (selectedShipment) {
                                            // Navigate to draft editing
                                            navigate(`/create-shipment/shipment-info/${selectedShipment.id}`);
                                        }
                                    }}>
                                        <ListItemIcon>
                                            <EditIcon fontSize="small" />
                                        </ListItemIcon>
                                        Edit
                                    </MenuItem>
                                    <MenuItem onClick={() => {
                                        if (selectedShipment) {
                                            handleDeleteDraftWithDialog(selectedShipment);
                                        }
                                    }}>
                                        <ListItemIcon>
                                            <DeleteIcon fontSize="small" />
                                        </ListItemIcon>
                                        Delete
                                    </MenuItem>
                                </>
                            ) : (
                                // Non-draft shipments: Show View Details and print options
                                <>
                                    <MenuItem onClick={() => {
                                        handleActionMenuClose();
                                        if (selectedShipment) {
                                            // Navigate to shipment details
                                            const shipmentId = selectedShipment.shipmentID || selectedShipment.id;
                                            navigate(`/shipment/${shipmentId}`);
                                        }
                                    }}>
                                        <ListItemIcon>
                                            <VisibilityIcon fontSize="small" />
                                        </ListItemIcon>
                                        View Details
                                    </MenuItem>

                                    <MenuItem onClick={() => {
                                        if (selectedShipment) {
                                            handlePrintLabel(selectedShipment);
                                        }
                                    }}>
                                        <ListItemIcon>
                                            <PrintIcon fontSize="small" />
                                        </ListItemIcon>
                                        Print Label
                                    </MenuItem>

                                    {/* Show Print BOL option only for freight shipments */}
                                    {selectedShipment && isFreightShipment(selectedShipment) && (
                                        <MenuItem onClick={() => {
                                            if (selectedShipment) {
                                                handlePrintBOL(selectedShipment);
                                            }
                                        }}>
                                            <ListItemIcon>
                                                <PrintIcon fontSize="small" />
                                            </ListItemIcon>
                                            Print BOL
                                        </MenuItem>
                                    )}
                                </>
                            )}
                        </Menu>
                    </Box>
                </Box>
            </Paper>

            {/* Print Dialog */}
            <Dialog
                open={printDialogOpen}
                onClose={() => {
                    console.log('🖨️ Print dialog closing');
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
                    {/* Debug logging */}
                    {console.log('🖨️ Print dialog rendering - selectedShipment:', selectedShipment)}
                    {console.log('🖨️ Print dialog rendering - printDialogOpen:', printDialogOpen)}
                    {console.log('🖨️ Print dialog rendering - printType:', printType)}

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
                            console.log('🖨️ Cancel button clicked');
                            setPrintDialogOpen(false);
                            setSelectedShipment(null); // Clear selected shipment when cancelled
                        }}
                        disabled={isGeneratingLabel}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => {
                            console.log('🖨️ Print button clicked, calling generateAndDownloadLabel');
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
        </div>
    );
};

export default Shipments; 