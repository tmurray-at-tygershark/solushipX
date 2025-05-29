import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Button,
    Chip,
    Divider,
    Breadcrumbs,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    TextField,
    InputAdornment,
    Stack,
    Tooltip,
    IconButton,
    Menu,
    MenuItem,
    ListItemIcon,
    Checkbox
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    LocationOn as LocationIcon,
    Phone as PhoneIcon,
    Email as EmailIcon,
    Business as BusinessIcon,
    CalendarToday as CalendarIcon,
    NavigateNext as NavigateNextIcon,
    Home as HomeIcon,
    Search as SearchIcon,
    LocalShipping as ShippingIcon,
    Visibility as VisibilityIcon,
    Person as PersonIcon,
    Print as PrintIcon,
    MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { doc, getDoc, collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCompany } from '../../contexts/CompanyContext';
import './CustomerDetail.css';

// Add formatAddress function (copied from Shipments.jsx)
const formatAddress = (address, label = '') => {
    if (!address || typeof address !== 'object') {
        if (label) {
            console.warn(`No valid address object for ${label}:`, address);
        }
        return <div>N/A</div>;
    }
    return (
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
};

// Extract StatusChip component for reusability (from Shipments.jsx)
const StatusChip = React.memo(({ status }) => {
    const getStatusConfig = (status) => {
        switch (status?.toLowerCase()) {
            case 'pending':
            case 'created':
                return {
                    color: '#F59E0B',
                    bgcolor: '#FEF3C7',
                    label: 'Pending'
                };
            case 'booked':
                return {
                    color: '#10B981',
                    bgcolor: '#ECFDF5',
                    label: 'Booked'
                };
            case 'awaiting pickup':
                return {
                    color: '#F59E0B',
                    bgcolor: '#FEF3C7',
                    label: 'Awaiting Pickup'
                };
            case 'awaiting shipment':
                return {
                    color: '#3B82F6',
                    bgcolor: '#EFF6FF',
                    label: 'Awaiting Shipment'
                };
            case 'in transit':
                return {
                    color: '#6366F1',
                    bgcolor: '#EEF2FF',
                    label: 'In Transit'
                };
            case 'on hold':
                return {
                    color: '#7C3AED',
                    bgcolor: '#F5F3FF',
                    label: 'On Hold'
                };
            case 'delivered':
                return {
                    color: '#10B981',
                    bgcolor: '#ECFDF5',
                    label: 'Delivered'
                };
            case 'cancelled':
                return {
                    color: '#EF4444',
                    bgcolor: '#FEE2E2',
                    label: 'Cancelled'
                };
            default:
                return {
                    color: '#6B7280',
                    bgcolor: '#F3F4F6',
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

// Helper function to capitalize shipment type (from Shipments.jsx)
const capitalizeShipmentType = (type) => {
    if (!type) return 'N/A';
    return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
};

const CustomerDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { companyIdForAddress } = useCompany();
    const [customer, setCustomer] = useState(null);
    const [mainContactDetails, setMainContactDetails] = useState(null);
    const [destinationAddresses, setDestinationAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [shipments, setShipments] = useState([]);
    const [carrierData, setCarrierData] = useState({});
    const [error, setError] = useState(null);
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [actionMenuAnchorEl, setActionMenuAnchorEl] = useState(null);

    useEffect(() => {
        fetchCustomerData();
    }, [id]);

    // Fetch carrier information from shipmentRates collection (copied from Shipments.jsx)
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

    const fetchCustomerData = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch customer data
            const customerDocRef = doc(db, 'customers', id);
            const customerDoc = await getDoc(customerDocRef);
            if (!customerDoc.exists()) {
                throw new Error('Customer not found');
            }
            const customerData = { id: customerDoc.id, ...customerDoc.data() };
            setCustomer(customerData);
            console.log('Fetched customer data:', customerData);

            // Fetch main contact and destination addresses from addressBook if customerID exists
            if (customerData.customerID) {
                console.log('Fetching addresses for customerID:', customerData.customerID);
                const addressBookQuery = query(
                    collection(db, 'addressBook'),
                    where('addressClass', '==', 'customer'),
                    where('addressClassID', '==', customerData.customerID)
                );
                const addressBookSnapshot = await getDocs(addressBookQuery);

                const addresses = addressBookSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                console.log('Fetched addresses from addressBook:', addresses);

                const mainContact = addresses.find(addr => addr.addressType === 'contact');
                const destinations = addresses.filter(addr => addr.addressType === 'destination');

                if (mainContact) {
                    console.log('Main contact found:', mainContact);
                    setMainContactDetails(mainContact);
                } else {
                    console.log('No main contact found for customerID:', customerData.customerID);
                    setMainContactDetails(null); // Explicitly set to null if not found
                }

                console.log('Destination addresses found:', destinations);
                setDestinationAddresses(destinations);
            } else {
                console.warn('Customer document is missing customerID field. Cannot fetch addresses.');
                setMainContactDetails(null);
                setDestinationAddresses([]);
            }

            // Fetch customer's recent shipments (last 10)
            if (companyIdForAddress && customerData.customerID) {
                console.log('Fetching shipments for customerID:', customerData.customerID);
                const shipmentsRef = collection(db, 'shipments');

                // Query shipments for this customer, ordered by creation date, limited to 10
                const q = query(
                    shipmentsRef,
                    where('companyID', '==', companyIdForAddress),
                    where('shipTo.customerID', '==', customerData.customerID),
                    orderBy('createdAt', 'desc'),
                    limit(10)
                );

                const shipmentsSnapshot = await getDocs(q);
                const shipmentsData = shipmentsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                console.log('Fetched shipments:', shipmentsData);
                setShipments(shipmentsData);

                // Fetch carrier data for the loaded shipments
                const shipmentIds = shipmentsData.map(shipment => shipment.id);
                await fetchCarrierData(shipmentIds);
            } else {
                console.log('No companyIdForAddress or customerID available, skipping shipments fetch');
                setShipments([]);
            }
        } catch (error) {
            console.error('Error fetching customer data:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleShipmentClick = (shipment) => {
        if (shipment.status === 'draft') {
            navigate(`/create-shipment/shipment-info/${shipment.id}`);
        } else {
            const shipmentId = shipment.shipmentID || shipment.id;
            navigate(`/shipment/${shipmentId}`, { state: { from: '/customers' } });
        }
    };

    const handleActionMenuOpen = (event, shipment) => {
        setSelectedShipment(shipment);
        setActionMenuAnchorEl(event.currentTarget);
    };

    const handleActionMenuClose = () => {
        setSelectedShipment(null);
        setActionMenuAnchorEl(null);
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <Typography variant="h6" color="error">{error}</Typography>
            </Box>
        );
    }

    if (!customer) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <Typography variant="h6" color="error">Customer not found</Typography>
            </Box>
        );
    }

    return (
        <Box className="customer-detail-container">
            <div className="breadcrumb-container">
                <Link to="/" className="breadcrumb-link">
                    <HomeIcon />
                    <Typography variant="body2">Home</Typography>
                </Link>
                <div className="breadcrumb-separator">
                    <NavigateNextIcon />
                </div>
                <Link to="/customers" className="breadcrumb-link">
                    <Typography variant="body2">Customers</Typography>
                </Link>
                <div className="breadcrumb-separator">
                    <NavigateNextIcon />
                </div>
                <Typography variant="body2" className="breadcrumb-current">
                    {customer.name || 'Customer Details'}
                </Typography>
            </div>

            <Paper className="customer-detail-paper">
                <Box className="customer-header">
                    <Box>
                        <Typography variant="h4" gutterBottom>
                            {customer.name}
                        </Typography>
                        <Typography variant="subtitle1" color="text.secondary">
                            Customer ID: {customer.customerID}
                        </Typography>
                    </Box>
                    <Box className="customer-actions">
                        <Chip
                            label={customer.status || 'Unknown'}
                            color={customer.status === 'active' ? 'success' : 'default'}
                            size="medium"
                            sx={{ mr: 2 }}
                        />
                        <Button
                            variant="outlined"
                            color="primary"
                            startIcon={<EditIcon />}
                            onClick={() => navigate(`/customers/${id}/edit`)}
                        >
                            Edit Customer
                        </Button>
                    </Box>
                </Box>

                <Box className="customer-info">
                    <Typography variant="h6" gutterBottom>Contact Information</Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <Stack spacing={1}>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <BusinessIcon color="action" />
                                    <Typography><strong>Company Name:</strong> {customer.name || 'N/A'}</Typography>
                                </Box>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <PersonIcon color="action" />
                                    <Typography><strong>Contact Name:</strong> {mainContactDetails ? `${mainContactDetails.firstName || ''} ${mainContactDetails.lastName || ''}`.trim() : 'N/A'}</Typography>
                                </Box>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <EmailIcon color="action" />
                                    <Typography><strong>Email:</strong> {mainContactDetails ? mainContactDetails.email : (customer.email || 'N/A')}</Typography>
                                </Box>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <PhoneIcon color="action" />
                                    <Typography><strong>Phone:</strong> {mainContactDetails ? mainContactDetails.phone : (customer.phone || 'N/A')}</Typography>
                                </Box>
                            </Stack>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Stack spacing={1}>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <LocationIcon color="action" />
                                    <Typography><strong>Main Address:</strong>
                                        {mainContactDetails ?
                                            `${mainContactDetails.address1}${mainContactDetails.address2 ? ', ' + mainContactDetails.address2 : ''}, ${mainContactDetails.city}, ${mainContactDetails.stateProv} ${mainContactDetails.zipPostal}, ${mainContactDetails.country}`
                                            : 'N/A'}
                                    </Typography>
                                </Box>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <Chip label={customer.status || 'Unknown'} color={customer.status === 'active' ? 'success' : 'default'} size="small" />
                                    <Typography><strong>Status:</strong> {customer.status || 'N/A'}</Typography>
                                </Box>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <BusinessIcon color="action" />
                                    <Typography><strong>Type:</strong> {customer.type || 'N/A'}</Typography>
                                </Box>
                                <Box display="flex" alignItems="center" gap={1}>
                                    <CalendarIcon color="action" />
                                    <Typography><strong>Created At:</strong> {customer.createdAt?.toDate ? customer.createdAt.toDate().toLocaleDateString() : 'N/A'}</Typography>
                                </Box>
                            </Stack>
                        </Grid>
                    </Grid>
                </Box>

                <Divider sx={{ my: 3 }} />

                <Box className="customer-shipment-destinations" sx={{ mb: 3 }}>
                    <Typography variant="h6" gutterBottom>Shipment Destinations</Typography>
                    {destinationAddresses.length > 0 ? (
                        <TableContainer component={Paper} elevation={2}>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Nickname</TableCell>
                                        <TableCell>Company Name</TableCell>
                                        <TableCell>Contact</TableCell>
                                        <TableCell>Address</TableCell>
                                        <TableCell>Email</TableCell>
                                        <TableCell>Phone</TableCell>
                                        <TableCell>Default</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {destinationAddresses.map((addr) => (
                                        <TableRow key={addr.id} hover>
                                            <TableCell>{addr.nickname || 'N/A'}</TableCell>
                                            <TableCell>{addr.companyName || 'N/A'}</TableCell>
                                            <TableCell>{`${addr.firstName || ''} ${addr.lastName || ''}`.trim() || 'N/A'}</TableCell>
                                            <TableCell>
                                                {addr.address1}
                                                {addr.address2 && <br />}{addr.address2}
                                                <br />
                                                {`${addr.city}, ${addr.stateProv} ${addr.zipPostal}`}
                                                <br />
                                                {addr.country}
                                            </TableCell>
                                            <TableCell>{addr.email || 'N/A'}</TableCell>
                                            <TableCell>{addr.phone || 'N/A'}</TableCell>
                                            <TableCell>
                                                {addr.isDefault ? <Chip label="Yes" color="primary" size="small" /> : <Chip label="No" size="small" />}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    ) : (
                        <Typography>No shipment destinations found for this customer.</Typography>
                    )}
                </Box>

                <Divider sx={{ my: 3 }} />

                <Box className="shipments-section">
                    <Box className="shipments-header">
                        <Typography variant="h6">Recent Shipments (Last 10)</Typography>
                    </Box>

                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>ID</TableCell>
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
                                        <TableCell colSpan={7} align="center">
                                            <CircularProgress />
                                        </TableCell>
                                    </TableRow>
                                ) : shipments.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center">
                                            No shipments found for this customer
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    shipments
                                        .map((shipment) => (
                                            <TableRow
                                                hover
                                                key={shipment.id}
                                                onClick={() => handleShipmentClick(shipment)}
                                                sx={{
                                                    cursor: 'pointer',
                                                    '&:hover': {
                                                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                                    },
                                                }}
                                            >
                                                <TableCell sx={{ verticalAlign: 'top', textAlign: 'left' }}>
                                                    <Link
                                                        to={`/shipment/${shipment.shipmentID || shipment.id}`}
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={{
                                                            color: '#1976d2',
                                                            textDecoration: 'none',
                                                            '&:hover': { textDecoration: 'underline' }
                                                        }}
                                                    >
                                                        {shipment.shipmentID || shipment.id}
                                                    </Link>
                                                </TableCell>
                                                <TableCell sx={{ verticalAlign: 'top', textAlign: 'left' }}>
                                                    {formatAddress(shipment.shipFrom || shipment.shipfrom, 'Origin')}
                                                </TableCell>
                                                <TableCell sx={{ verticalAlign: 'top', textAlign: 'left' }}>
                                                    {formatAddress(shipment.shipTo || shipment.shipto, 'Destination')}
                                                </TableCell>
                                                <TableCell sx={{ verticalAlign: 'top', textAlign: 'left' }}>
                                                    {carrierData[shipment.id]?.carrier ||
                                                        shipment.selectedRateRef?.carrier ||
                                                        shipment.selectedRate?.carrier ||
                                                        shipment.carrier || 'N/A'}
                                                </TableCell>
                                                <TableCell sx={{ verticalAlign: 'top', textAlign: 'left' }}>
                                                    {capitalizeShipmentType(shipment.shipmentInfo?.shipmentType)}
                                                </TableCell>
                                                <TableCell sx={{ verticalAlign: 'top', textAlign: 'left' }}>
                                                    <StatusChip status={shipment.status} />
                                                </TableCell>
                                                <TableCell sx={{ verticalAlign: 'top', textAlign: 'left' }} align="right">
                                                    <IconButton
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleActionMenuOpen(e, shipment);
                                                        }}
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
                </Box>
            </Paper>

            {selectedShipment && (
                <Menu
                    anchorEl={actionMenuAnchorEl}
                    open={Boolean(actionMenuAnchorEl)}
                    onClose={handleActionMenuClose}
                >
                    <MenuItem onClick={() => {
                        handleActionMenuClose();
                        if (selectedShipment) {
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
                        handleActionMenuClose();
                        // Handle print label
                        console.log('Print label for:', selectedShipment?.id);
                    }}>
                        <ListItemIcon>
                            <PrintIcon fontSize="small" />
                        </ListItemIcon>
                        Print Label
                    </MenuItem>
                </Menu>
            )}
        </Box>
    );
};

export default CustomerDetail; 