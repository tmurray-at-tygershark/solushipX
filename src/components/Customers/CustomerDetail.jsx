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
    IconButton
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
    Person as PersonIcon
} from '@mui/icons-material';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import './CustomerDetail.css';

const CustomerDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [customer, setCustomer] = useState(null);
    const [mainContactDetails, setMainContactDetails] = useState(null);
    const [destinationAddresses, setDestinationAddresses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [shipments, setShipments] = useState([]);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchCustomerData();
    }, [id]);

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

            // Fetch customer's shipments
            const shipmentsRef = collection(db, 'shipments');
            const q = query(shipmentsRef, where('customerId', '==', id));
            const shipmentsSnapshot = await getDocs(q);
            const shipmentsData = shipmentsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setShipments(shipmentsData);
        } catch (error) {
            console.error('Error fetching customer data:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleSearchChange = (event) => {
        setSearchQuery(event.target.value);
        setPage(0);
    };

    const handleShipmentClick = (shipmentId) => {
        navigate(`/shipment/${shipmentId}`);
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'delivered':
                return 'success';
            case 'in transit':
                return 'primary';
            case 'pending':
                return 'warning';
            case 'cancelled':
                return 'error';
            default:
                return 'default';
        }
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

    const filteredShipments = shipments.filter(shipment =>
        shipment.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shipment.origin?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shipment.destination?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shipment.carrier?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shipment.type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shipment.status?.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
                        <Typography variant="h6">Recent Shipments</Typography>
                        <TextField
                            placeholder="Search shipments..."
                            value={searchQuery}
                            onChange={handleSearchChange}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                            }}
                            size="small"
                            sx={{ width: 300 }}
                        />
                    </Box>

                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>ID</TableCell>
                                    <TableCell>Origin</TableCell>
                                    <TableCell>Destination</TableCell>
                                    <TableCell>Carrier</TableCell>
                                    <TableCell>Type</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Date</TableCell>
                                    <TableCell align="right">Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredShipments
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .map((shipment) => (
                                        <TableRow
                                            key={shipment.id}
                                            hover
                                            onClick={() => handleShipmentClick(shipment.id)}
                                            sx={{
                                                cursor: 'pointer',
                                                '&:hover': {
                                                    backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                                },
                                            }}
                                        >
                                            <TableCell>{shipment.id}</TableCell>
                                            <TableCell>{shipment.origin}</TableCell>
                                            <TableCell>{shipment.destination}</TableCell>
                                            <TableCell>{shipment.carrier}</TableCell>
                                            <TableCell>{shipment.type}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={shipment.status || 'Unknown'}
                                                    color={getStatusColor(shipment.status)}
                                                    size="small"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {shipment.createdAt?.toDate ?
                                                    shipment.createdAt.toDate().toLocaleDateString() :
                                                    new Date(shipment.createdAt).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell align="right">
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleShipmentClick(shipment.id);
                                                    }}
                                                >
                                                    <VisibilityIcon />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    <TablePagination
                        component="div"
                        count={filteredShipments.length}
                        page={page}
                        onPageChange={handleChangePage}
                        rowsPerPage={rowsPerPage}
                        onRowsPerPageChange={handleChangeRowsPerPage}
                        rowsPerPageOptions={[5, 10, 25]}
                    />
                </Box>
            </Paper>
        </Box>
    );
};

export default CustomerDetail; 