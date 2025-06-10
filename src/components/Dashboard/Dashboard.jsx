import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    IconButton,
    Button,
    Menu,
    MenuItem,
    Grid,
    ListItemIcon,
    CircularProgress
} from '@mui/material';
import {
    MoreVert as MoreVertIcon,
    Add as AddIcon,
    LocalShipping as ShippingIcon,
    CheckCircle as CheckCircleIcon,
    Schedule as ScheduleIcon,
    Refresh as RefreshIcon,
    CalendarToday as CalendarIcon,
    LocalShipping as LocalShipping,
    ArrowForward as ArrowForwardIcon,
    Visibility as VisibilityIcon,
    Print as PrintIcon,
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { Link, useNavigate } from 'react-router-dom';
import { LineChart } from '@mui/x-charts/LineChart';
import './Dashboard.css';
import dayjs from 'dayjs';
import { collection, query, orderBy, limit, onSnapshot, getDocs, where, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCompany } from '../../contexts/CompanyContext';
import ShipmentGlobe from '../Globe/Globe';

// Helper function to format Firestore timestamp
const formatDate = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp.seconds * 1000).toISOString().split('T')[0];
};

// Helper function to format address
const formatAddress = (addressObj) => {
    if (!addressObj) return '';
    const parts = [
        addressObj.street,
        addressObj.street2,
        addressObj.city,
        addressObj.state,
        addressObj.postalCode,
        addressObj.country
    ].filter(Boolean);
    return parts.join(', ');
};

// Extract StatusBox component for reusability
const StatusBox = React.memo(({ title, count, icon: Icon, color, bgColor }) => (
    <Paper sx={{
        p: 3,
        bgcolor: '#ffffff',
        boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
        borderRadius: 2,
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 4px 8px rgba(0,0,0,0.08)'
        }
    }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box>
                <Typography variant="subtitle1" sx={{ color: '#64748b', mb: 1, fontWeight: 500 }}>
                    {title}
                </Typography>
                <Typography variant="h4" sx={{ color, fontWeight: 600 }}>
                    {count}
                </Typography>
            </Box>
            <Box sx={{
                width: 48,
                height: 48,
                borderRadius: '12px',
                bgcolor: bgColor,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <Icon sx={{ color, fontSize: 24 }} />
            </Box>
        </Box>
    </Paper>
));

// Extract StatusChip component for reusability
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

            // Early Processing - Amber
            case 'pending':
            case 'created':
                return {
                    color: '#d97706',
                    bgcolor: '#fef3c7',
                    label: 'Pending'
                };

            // Scheduled - Purple
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

            // Success - Green
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
                fontSize: '12px',
                height: '24px',
                '& .MuiChip-label': {
                    px: 2
                }
            }}
            size="small"
        />
    );
});

// Helper function to get country flag emoji
const getCountryFlag = (address) => {
    if (!address || !address.country) return '';

    const country = address.country.toLowerCase();
    if (country.includes('canada') || country.includes('ca')) {
        return '🇨🇦';
    } else if (country.includes('united states') || country.includes('usa') || country.includes('us')) {
        return '🇺🇸';
    }
    return '';
};

// Helper function to format route (origin → destination)
const formatRoute = (shipFrom, shipTo, searchTermOrigin = '', searchTermDestination = '') => {
    const formatLocation = (address) => {
        if (!address || typeof address !== 'object') {
            return { text: 'N/A', flag: '' };
        }
        // Format as "City, State/Province" for compact display
        const parts = [];
        if (address.city) parts.push(address.city);
        if (address.state || address.province) parts.push(address.state || address.province);

        return {
            text: parts.length > 0 ? parts.join(', ') : 'N/A',
            flag: getCountryFlag(address)
        };
    };

    const origin = formatLocation(shipFrom);
    const destination = formatLocation(shipTo);

    return (
        <div style={{ lineHeight: 1.3 }}>
            {/* Origin */}
            <div style={{
                fontSize: '12px',
                fontWeight: 400,
                color: '#374151',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
            }}>
                {origin.flag && (
                    <span style={{
                        fontSize: '12px',
                        lineHeight: 1,
                        marginTop: '-1px'
                    }}>
                        {origin.flag}
                    </span>
                )}
                <span>{origin.text}</span>
            </div>

            {/* Arrow */}
            <div style={{
                fontSize: '12px',
                color: '#000000',
                margin: '2px 0',
                textAlign: 'center'
            }}>
                ↓
            </div>

            {/* Destination */}
            <div style={{
                fontSize: '12px',
                fontWeight: 500,
                color: '#111827',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
            }}>
                {destination.flag && (
                    <span style={{
                        fontSize: '12px',
                        lineHeight: 1,
                        marginTop: '-1px'
                    }}>
                        {destination.flag}
                    </span>
                )}
                <span>{destination.text}</span>
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
                fontSize: '12px',
                fontWeight: 500,
                color: '#111827'
            }}>
                {formattedDate}
            </div>

            {/* Time */}
            <div style={{
                fontSize: '12px',
                color: '#6b7280',
                marginTop: '2px'
            }}>
                {formattedTime}
            </div>
        </div>
    );
};

// Extract ShipmentRow component for reusability with enhanced UI
const ShipmentRow = React.memo(({ shipment, onPrint }) => {
    const [anchorEl, setAnchorEl] = useState(null);
    const navigate = useNavigate();

    const handleMenuClick = (e) => {
        e.stopPropagation();
        setAnchorEl(e.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handlePrint = () => {
        onPrint(shipment.id);
        handleMenuClose();
    };

    const handleRowClick = () => {
        // Use shipmentId (the display ID) for navigation, not the Firestore document ID
        const shipmentIdForRoute = shipment.shipmentId;
        console.log('Navigating to shipment detail:', shipmentIdForRoute);
        navigate(`/shipment/${shipmentIdForRoute}`);
    };

    return (
        <TableRow
            hover
            sx={{
                cursor: 'pointer',
                '&:hover': {
                    backgroundColor: 'rgba(0, 0, 0, 0.04)'
                }
            }}
        >
            <TableCell
                sx={{ verticalAlign: 'top', textAlign: 'left', fontSize: '12px' }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Link
                        to={`/shipment/${shipment.shipmentId}`}
                        style={{
                            textDecoration: 'none',
                            color: '#3b82f6',
                            fontSize: '12px'
                        }}
                        className="shipment-link"
                    >
                        {shipment.shipmentId}
                    </Link>
                </Box>
            </TableCell>
            <TableCell sx={{ verticalAlign: 'top', textAlign: 'left', fontSize: '12px' }}>
                {formatDateTime(shipment.createdAt)}
            </TableCell>
            <TableCell sx={{ verticalAlign: 'top', textAlign: 'left', fontSize: '12px' }}>
                {shipment.customer}
            </TableCell>
            <TableCell sx={{ verticalAlign: 'top', textAlign: 'left', fontSize: '12px' }}>
                {formatRoute(shipment.shipFrom, shipment.shipTo)}
            </TableCell>
            <TableCell sx={{ verticalAlign: 'top', textAlign: 'left', fontSize: '12px' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {/* Carrier Name */}
                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                        {shipment.carrier || 'N/A'}
                    </Typography>
                </Box>
            </TableCell>
            <TableCell sx={{ verticalAlign: 'top', textAlign: 'left', fontSize: '12px' }}>
                {shipment.shipmentType}
            </TableCell>
            <TableCell sx={{ verticalAlign: 'top', textAlign: 'left', fontSize: '12px' }}>
                <StatusChip status={shipment.status} />
            </TableCell>
            <TableCell sx={{ verticalAlign: 'top', textAlign: 'left', fontSize: '12px' }} align="right">
                <IconButton
                    onClick={handleMenuClick}
                    size="small"
                >
                    <MoreVertIcon />
                </IconButton>
                <Menu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={handleMenuClose}
                    PaperProps={{
                        sx: {
                            '& .MuiMenuItem-root': { fontSize: '12px' }
                        }
                    }}
                >
                    <MenuItem onClick={() => {
                        handleMenuClose();
                        navigate(`/shipment/${shipment.shipmentId}`);
                    }}>
                        <ListItemIcon>
                            <VisibilityIcon sx={{ fontSize: '12px' }} />
                        </ListItemIcon>
                        View Details
                    </MenuItem>
                    <MenuItem onClick={handlePrint}>
                        <ListItemIcon>
                            <PrintIcon sx={{ fontSize: '12px' }} />
                        </ListItemIcon>
                        Print Label
                    </MenuItem>
                </Menu>
            </TableCell>
        </TableRow>
    );
});

const Dashboard = () => {
    const [selectedTab, setSelectedTab] = useState('all');
    const [startDate, setStartDate] = useState(dayjs());
    const [endDate, setEndDate] = useState(dayjs());
    const [shipments, setShipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [customers, setCustomers] = useState({});
    const navigate = useNavigate();
    const { companyData, companyIdForAddress, loading: companyLoading } = useCompany();

    // Calculate date range for last 30 days (matches UI header and provides comprehensive data)
    const thirtyDaysAgo = useMemo(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return Timestamp.fromDate(date);
    }, []);

    // Fetch customers data
    useEffect(() => {
        if (!companyIdForAddress) return;

        const customersQuery = query(
            collection(db, 'customers'),
            where('companyID', '==', companyIdForAddress)
        );

        const unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
            const customersData = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                customersData[data.customerID] = data;
            });
            setCustomers(customersData);
        }, (error) => {
            console.error('Error fetching customers:', error);
        });

        return () => unsubscribeCustomers();
    }, [companyIdForAddress]);

    // Fetch shipments from Firestore for the last 30 days and current company
    useEffect(() => {
        if (!companyIdForAddress || companyLoading) {
            return;
        }

        console.log('Dashboard: Fetching shipments for company:', companyIdForAddress);
        console.log('Dashboard: Date filter from:', thirtyDaysAgo.toDate());

        const shipmentsQuery = query(
            collection(db, 'shipments'),
            where('companyID', '==', companyIdForAddress),
            where('createdAt', '>=', thirtyDaysAgo),
            orderBy('createdAt', 'desc'),
            limit(200) // Increased limit for 30 days of comprehensive data
        );

        const unsubscribe = onSnapshot(shipmentsQuery, (snapshot) => {
            console.log('Dashboard: Received shipments snapshot with', snapshot.docs.length, 'documents');
            console.log('Dashboard: Date range - From:', thirtyDaysAgo.toDate(), 'To:', new Date());

            const shipmentsData = snapshot.docs.map(doc => {
                const data = doc.data();

                // Get customer data - check multiple possible customer ID fields
                const customerId = data.shipTo?.customerID || data.customerId || data.customerID;
                const customerData = customers[customerId] || {};

                // Helper function to safely get rate info
                const getRateInfo = () => {
                    // Check for selectedRateRef first (new structure)
                    if (data.selectedRateRef) {
                        return {
                            carrier: data.selectedRateRef.carrier || data.selectedRateRef.carrierName || '',
                            totalCharges: data.selectedRateRef.totalCharges || 0
                        };
                    }

                    // Check for selectedRate (legacy structure)
                    if (data.selectedRate) {
                        return {
                            carrier: data.selectedRate.carrier || data.selectedRate.carrierName || '',
                            totalCharges: data.selectedRate.totalCharges || data.selectedRate.price || 0
                        };
                    }

                    // Fallback to direct carrier field
                    return {
                        carrier: data.carrier || '',
                        totalCharges: 0
                    };
                };

                const rateInfo = getRateInfo();

                return {
                    id: doc.id,
                    shipmentId: data.shipmentID || data.shipmentId || doc.id, // Use shipmentID (capital ID) first
                    date: formatDate(data.createdAt),
                    createdAt: data.createdAt, // Keep original timestamp for calculations
                    customer: customerData.name || data.shipTo?.company || 'Unknown Customer',
                    origin: formatAddress(data.shipFrom),
                    destination: formatAddress(data.shipTo),
                    // Store original objects for enhanced route formatting
                    shipFrom: data.shipFrom,
                    shipTo: data.shipTo,
                    carrier: rateInfo.carrier,
                    shipmentType: data.shipmentInfo?.shipmentType || 'Standard',
                    status: data.status || 'pending',
                    value: rateInfo.totalCharges || data.packages?.[0]?.declaredValue || 0
                };
            }).filter(shipment => {
                // Exclude draft shipments from dashboard counts and displays
                return shipment.status?.toLowerCase() !== 'draft';
            });

            console.log('Dashboard: Processed shipments data:', shipmentsData.length, 'shipments (excluding drafts)');
            console.log('Dashboard: Sample shipment data:', shipmentsData.slice(0, 2));
            setShipments(shipmentsData);
            setLoading(false);
        }, (error) => {
            console.error('Error fetching shipments:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [companyIdForAddress, companyLoading, customers, thirtyDaysAgo]); // Add customers and thirtyDaysAgo as dependencies

    // Helper function to get shipment status group (copied from Shipments.jsx)
    const getShipmentStatusGroup = useCallback((shipment) => {
        // Get the status and normalize it
        const status = shipment.status?.toLowerCase()?.trim();

        // Check for draft status first (highest priority)
        if (status === 'draft') {
            return 'DRAFTS';
        }

        // Enhanced status mapping based on shipments.jsx logic
        if (status === 'pending' || status === 'scheduled' || status === 'awaiting_shipment' || status === 'awaiting shipment' || status === 'booked' || status === 'label_created') {
            return 'PRE_SHIPMENT';
        }
        if (status === 'in_transit' || status === 'in transit' || status === 'picked_up' || status === 'on_route') {
            return 'TRANSIT';
        }
        if (status === 'delivered') {
            return 'COMPLETED';
        }
        if (status === 'cancelled' || status === 'canceled' || status === 'void' || status === 'voided') {
            return 'CANCELLED';
        }
        if (status === 'exception' || status === 'delayed' || status === 'on_hold' || status === 'on hold') {
            return 'EXCEPTIONS';
        }

        return 'PRE_SHIPMENT'; // Default for unknown statuses
    }, []);

    // Calculate all shipment stats using enhanced status groups for last 24 hours
    const shipmentStats = useMemo(() => {
        // Count shipments by status groups
        const groupCounts = {
            PRE_SHIPMENT: 0,
            BOOKING: 0,
            TRANSIT: 0,
            DELIVERY: 0,
            COMPLETED: 0,
            EXCEPTIONS: 0,
            CANCELLED: 0,
            DRAFTS: 0
        };

        let totalValue = 0;

        shipments.forEach(shipment => {
            const group = getShipmentStatusGroup(shipment);
            groupCounts[group] = (groupCounts[group] || 0) + 1;

            if (shipment.value) totalValue += shipment.value;
        });

        return {
            total: shipments.length - groupCounts.DRAFTS, // Exclude drafts from total
            awaitingShipment: groupCounts.PRE_SHIPMENT + groupCounts.BOOKING, // Combine pre-shipment phases
            inTransit: groupCounts.TRANSIT + groupCounts.DELIVERY, // Combine transit and delivery phases
            delivered: groupCounts.COMPLETED,
            delayed: groupCounts.EXCEPTIONS, // Exceptions include delayed shipments
            cancelled: groupCounts.CANCELLED,
            drafts: groupCounts.DRAFTS,
            onHold: groupCounts.EXCEPTIONS, // Keep for backward compatibility
            pending: groupCounts.PRE_SHIPMENT, // Keep for backward compatibility
            totalValue
        };
    }, [shipments, getShipmentStatusGroup]);

    // Calculate metrics based on the stats
    const metrics = useMemo(() => {
        const { total, delivered, totalValue } = shipmentStats;
        const averageValue = total > 0 ? totalValue / total : 0;
        const onTimeDelivery = total > 0 ? (delivered / total) * 100 : 0;

        return {
            totalShipments: total,
            totalValue,
            averageValue,
            onTimeDelivery
        };
    }, [shipmentStats]);

    // Calculate top customers
    const topCustomers = useMemo(() => {
        const customerTotals = shipments.reduce((acc, shipment) => {
            if (shipment.value) {
                acc[shipment.customer] = (acc[shipment.customer] || 0) + shipment.value;
            }
            return acc;
        }, {});

        return Object.entries(customerTotals)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 3);
    }, [shipments]);

    // Calculate daily shipment value
    const dailyShipmentValue = useMemo(() => {
        const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
        return shipments
            .filter(shipment => shipment.date && shipment.date.startsWith(today))
            .reduce((sum, shipment) => sum + (shipment.value || 0), 0);
    }, [shipments]);

    // Calculate daily shipment counts for the last 30 days (matches shipment data range)
    const dailyShipmentCounts = useMemo(() => {
        const today = new Date();
        const dailyCounts = {};

        console.log('📊 Chart: Calculating daily shipment counts for 30 days');
        console.log('📊 Chart: Processing', shipments.length, 'total shipments');

        // Initialize all days in the last 30 days with 0
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            dailyCounts[dateKey] = 0;
        }

        // Count shipments by date - enhanced with better date handling
        let processedCount = 0;
        let skippedCount = 0;

        shipments.forEach(shipment => {
            // Handle both formatted date string and direct timestamp
            let shipmentDate;
            
            if (shipment.date) {
                // Use pre-formatted date string
                shipmentDate = shipment.date;
            } else if (shipment.createdAt) {
                // Calculate date from timestamp directly
                const timestamp = shipment.createdAt.toDate ? shipment.createdAt.toDate() : new Date(shipment.createdAt);
                shipmentDate = timestamp.toISOString().split('T')[0];
            }

            if (shipmentDate && dailyCounts.hasOwnProperty(shipmentDate)) {
                dailyCounts[shipmentDate]++;
                processedCount++;
            } else {
                skippedCount++;
            }
        });

        console.log('📊 Chart: Processed', processedCount, 'shipments for chart, skipped', skippedCount);
        console.log('📊 Chart: Date range coverage:', Object.keys(dailyCounts).sort());
        console.log('📊 Chart: Daily counts sample:', Object.entries(dailyCounts).slice(0, 5));

        return dailyCounts;
    }, [shipments]);

    // Calculate carrier distribution
    const carrierDistribution = useMemo(() => {
        const distribution = shipments.reduce((acc, shipment) => {
            const carrier = shipment.carrier || 'Unknown';
            acc[carrier] = (acc[carrier] || 0) + 1;
            return acc;
        }, {});

        const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);
        return Object.entries(distribution).map(([carrier, count]) => ({
            carrier,
            percentage: total > 0 ? (count / total) * 100 : 0
        }));
    }, [shipments]);

    // Calculate delivery performance
    const deliveryPerformance = useMemo(() => {
        const { total, delivered, inTransit, onHold } = shipmentStats;

        return {
            delivered: total > 0 ? (delivered / total) * 100 : 0,
            inTransit: total > 0 ? (inTransit / total) * 100 : 0,
            onHold: total > 0 ? (onHold / total) * 100 : 0
        };
    }, [shipmentStats]);

    // Filter shipments based on selected tab
    const filteredShipments = useMemo(() => {
        return shipments.filter(shipment => {
            switch (selectedTab) {
                case 'in-transit':
                    return shipment.status?.toLowerCase() === 'in transit' ||
                        shipment.status?.toLowerCase() === 'in_transit';
                case 'delivered':
                    return shipment.status?.toLowerCase() === 'delivered';
                case 'awaiting':
                    return shipment.status?.toLowerCase() === 'awaiting shipment' ||
                        shipment.status?.toLowerCase() === 'label_created' ||
                        shipment.status?.toLowerCase() === 'booked' ||
                        shipment.status?.toLowerCase() === 'awaiting pickup';
                case 'pending':
                    return shipment.status?.toLowerCase() === 'pending' ||
                        shipment.status?.toLowerCase() === 'created';
                case 'on-hold':
                    return shipment.status?.toLowerCase() === 'on hold' ||
                        shipment.status?.toLowerCase() === 'on_hold';
                case 'cancelled':
                    return shipment.status?.toLowerCase() === 'cancelled' ||
                        shipment.status?.toLowerCase() === 'canceled';
                default:
                    return true;
            }
        });
    }, [shipments, selectedTab]);

    // Handle tab change
    const handleTabChange = useCallback((event, newValue) => {
        setSelectedTab(newValue);
    }, []);

    // Handle print label
    const handlePrintLabel = useCallback((shipmentId) => {
        console.log('Print label for shipment:', shipmentId);
    }, []);

    // Generate chart data for the last 30 days (synchronized with shipment data range)
    const chartData = useMemo(() => {
        const today = new Date();
        const chartPoints = [];

        console.log('📈 Chart Data: Generating 30-day chart points');

        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            const count = dailyShipmentCounts[dateKey] || 0;

            chartPoints.push({
                value: count,
                day: date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                }),
                fullDate: dateKey // Add full date for debugging
            });
        }

        const totalChartShipments = chartPoints.reduce((sum, point) => sum + point.value, 0);
        const maxDailyCount = Math.max(...chartPoints.map(point => point.value));
        
        console.log('📈 Chart Data: Generated', chartPoints.length, 'chart points');
        console.log('📈 Chart Data: Total shipments in chart:', totalChartShipments);
        console.log('📈 Chart Data: Max daily count:', maxDailyCount);
        console.log('📈 Chart Data: Date range:', chartPoints[0]?.fullDate, 'to', chartPoints[chartPoints.length - 1]?.fullDate);

        return chartPoints;
    }, [dailyShipmentCounts]);

    // Calculate max value for chart Y-axis (optimized for 30-day range)
    const maxChartValue = useMemo(() => {
        const values = chartData.map(point => point.value);
        const maxValue = Math.max(...values);
        const totalShipments = values.reduce((sum, val) => sum + val, 0);
        
        // More intelligent Y-axis scaling based on data distribution
        let calculatedMax;
        if (maxValue === 0) {
            calculatedMax = 10; // No data case
        } else if (maxValue <= 5) {
            calculatedMax = Math.max(maxValue + 2, 10); // Small numbers
        } else {
            calculatedMax = Math.ceil(maxValue * 1.2); // 20% padding for larger numbers
        }

        console.log('📊 Chart Y-Axis: Max daily value:', maxValue, 'Total shipments:', totalShipments, 'Y-axis max:', calculatedMax);
        
        return calculatedMax;
    }, [chartData]);

    // Show loading state while company data is loading
    if (companyLoading || loading) {
        return (
            <Box sx={{ width: '100%', bgcolor: '#f8fafc', minHeight: '100vh', p: 3 }}>
                <Box sx={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                    <CircularProgress />
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%', bgcolor: '#f8fafc', minHeight: '100vh', p: 3 }}>
            <Box sx={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Breadcrumb Navigation */}
                <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconButton
                        component={Link}
                        to="/"
                        sx={{ p: 0.5 }}
                    >
                        <HomeIcon />
                    </IconButton>
                    <NavigateNextIcon />
                    <Typography variant="body2" sx={{ color: '#1e293b' }}>
                        Dashboard
                    </Typography>
                </Box>

                {/* Header Section */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Box>
                        <Typography variant="h5" component="h1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                            Dashboard
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
                            Last 30 days • {companyData?.name || 'Loading...'}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="outlined"
                            startIcon={<RefreshIcon />}
                            onClick={() => window.location.reload()}
                            sx={{ color: '#64748b', borderColor: '#e2e8f0' }}
                        >
                            Refresh
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
                <Paper sx={{ bgcolor: '#ffffff', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)', p: 3, mb: 3 }}>
                    {/* Full Width Globe Section - Maximum Size */}
                    <Box sx={{ mb: 4 }}>
                        <Box sx={{
                            backgroundColor: '#000000',
                            borderRadius: 2,
                            overflow: 'hidden',
                            height: 600,
                            position: 'relative'
                        }}>
                            <ShipmentGlobe
                                shipments={shipments.slice(0, 20)} // Show recent 20 shipments
                                width="100%"
                                height={600}
                                showOverlays={true}
                                statusCounts={{
                                    pending: shipmentStats.awaitingShipment,
                                    awaitingShipment: shipmentStats.awaitingShipment,
                                    transit: shipmentStats.inTransit,
                                    inTransit: shipmentStats.inTransit,
                                    delivered: shipmentStats.delivered,
                                    delayed: shipmentStats.delayed
                                }}
                            />
                        </Box>
                    </Box>

                    {/* Chart Section */}
                    <Grid container spacing={3}>
                        {/* Daily Shipment Volume Chart */}
                        <Grid item xs={12}>
                            <Paper sx={{
                                p: 3,
                                bgcolor: '#ffffff',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.04)',
                                borderRadius: 2,
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                <Box sx={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    mb: 3
                                }}>
                                    <Box>
                                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
                                            Daily Shipments (Last 30 Days)
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
                                            Synchronized with shipment data range • Real-time updates
                                        </Typography>
                                    </Box>
                                    <Box sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        bgcolor: 'rgba(59, 130, 246, 0.1)',
                                        px: 2,
                                        py: 1,
                                        borderRadius: 2
                                    }}>
                                        <Typography variant="body2" sx={{ color: '#3b82f6', fontWeight: 500 }}>
                                            {shipmentStats.total} Total Shipments
                                        </Typography>
                                    </Box>
                                </Box>
                                <Box sx={{ height: 300 }}>
                                    <LineChart
                                        dataset={chartData}
                                        series={[
                                            {
                                                dataKey: 'value',
                                                valueFormatter: (value) => `${value} shipments`,
                                                color: '#3b82f6',
                                                area: true,
                                                showMark: false,
                                                curve: "monotoneX"
                                            }
                                        ]}
                                        xAxis={[{
                                            dataKey: 'day',
                                            scaleType: 'point',
                                            tickLabelStyle: {
                                                angle: 0,
                                                textAnchor: 'middle',
                                                fontSize: 12,
                                                fill: '#64748b'
                                            },
                                            position: 'bottom',
                                            tickSize: 0,
                                            axisLine: { stroke: '#e2e8f0' }
                                        }]}
                                        yAxis={[{
                                            min: 0,
                                            max: maxChartValue,
                                            tickMinStep: 1,
                                            tickLabelStyle: {
                                                fontSize: 12,
                                                fill: '#64748b'
                                            },
                                            position: 'left',
                                            tickSize: 0,
                                            axisLine: { stroke: '#e2e8f0' }
                                        }]}
                                        sx={{
                                            '.MuiLineElement-root': {
                                                strokeWidth: 2,
                                                transition: 'all 0.2s ease-in-out',
                                            },
                                            '.MuiAreaElement-root': {
                                                fillOpacity: 0.15,
                                            },
                                            '.MuiChartsAxis-line': {
                                                stroke: '#e2e8f0'
                                            },
                                            '.MuiChartsAxis-tick': {
                                                stroke: '#e2e8f0'
                                            },
                                            '.MuiChartsAxis-grid': {
                                                stroke: '#f1f5f9'
                                            }
                                        }}
                                        height={300}
                                        margin={{ left: 60, right: 20, top: 20, bottom: 40 }}
                                        tooltip={{
                                            trigger: 'axis'
                                        }}
                                    />
                                </Box>
                            </Paper>
                        </Grid>
                    </Grid>

                    {/* Recent Shipments Table */}
                    <Paper sx={{ p: 2, mb: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="h6">Recent Shipments</Typography>
                        </Box>
                        <TableContainer>
                            {loading ? (
                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                                    <CircularProgress />
                                </Box>
                            ) : (
                                <Table sx={{
                                    '& .MuiTableCell-root': { fontSize: '12px' },
                                    '& .MuiTypography-root': { fontSize: '12px' },
                                    '& .shipment-link': { fontSize: '12px' },
                                }}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontSize: '12px' }}>ID</TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>DATE</TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>CUSTOMER</TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>ROUTE</TableCell>
                                            <TableCell sx={{ minWidth: 120, fontSize: '12px' }}>CARRIER</TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>TYPE</TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>STATUS</TableCell>
                                            <TableCell align="right" sx={{ fontSize: '12px' }}></TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {shipments.slice(0, 20).map((shipment) => (
                                            <ShipmentRow
                                                key={shipment.id}
                                                shipment={shipment}
                                                onPrint={handlePrintLabel}
                                            />
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </TableContainer>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                            <Button
                                variant="text"
                                endIcon={<ArrowForwardIcon />}
                                onClick={() => navigate('/shipments')}
                            >
                                View All
                            </Button>
                        </Box>
                    </Paper>
                </Paper>
            </Box>
        </Box>
    );
};

export default Dashboard;