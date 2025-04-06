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
    LocalShipping as ShippingIcon
} from '@mui/icons-material';
import './CustomerDetail.css';

const CustomerDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [customer, setCustomer] = useState(null);
    const [loading, setLoading] = useState(true);
    const [shipments, setShipments] = useState([]);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [searchQuery, setSearchQuery] = useState('');
    const [customerStatus, setCustomerStatus] = useState('active');

    const getStatusColor = (status) => {
        switch (status.toLowerCase()) {
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

    useEffect(() => {
        // Simulate API call to fetch customer data
        const fetchCustomerData = async () => {
            try {
                // Mock data - replace with actual API call
                const mockCustomer = {
                    id: id,
                    companyName: 'Acme Corporation',
                    accountNumber: 'ACC-123456',
                    contactName: 'John Doe',
                    email: 'john.doe@acme.com',
                    phone: '+1 (555) 123-4567',
                    address: '123 Business Ave, Suite 100, New York, NY 10001',
                    createdAt: '2024-01-15',
                    status: 'active'
                };

                const mockShipments = [
                    {
                        id: 'SHP287656',
                        origin: '555 Fifth Avenue, Chicago, IL 60601, USA',
                        destination: '888 Robson Street, Calgary, AB T2P 1B8, Canada',
                        carrier: 'FedEx',
                        type: 'Courier',
                        status: 'Delivered',
                        date: '2024-03-15'
                    },
                    {
                        id: 'SHP287657',
                        origin: '123 Main Street, New York, NY 10001, USA',
                        destination: '456 Queen Street, Toronto, ON M5V 2A9, Canada',
                        carrier: 'UPS',
                        type: 'Express',
                        status: 'In Transit',
                        date: '2024-03-14'
                    },
                    {
                        id: 'SHP287658',
                        origin: '789 Market Street, San Francisco, CA 94103, USA',
                        destination: '321 Yonge Street, Toronto, ON M5B 1T1, Canada',
                        carrier: 'DHL',
                        type: 'Standard',
                        status: 'Pending',
                        date: '2024-03-13'
                    }
                ];

                setCustomer(mockCustomer);
                setShipments(mockShipments);
            } catch (error) {
                console.error('Error fetching customer data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchCustomerData();
    }, [id]);

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

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
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
        shipment.origin.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shipment.destination.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shipment.carrier.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shipment.type.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shipment.status.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="customer-detail-container">
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
                    {customer?.companyName || 'Customer Details'}
                </Typography>
            </div>

            <Paper className="customer-detail-paper">
                <div className="customer-header">
                    <div>
                        <Typography variant="h4" gutterBottom>
                            {customer.companyName}
                        </Typography>
                        <Typography variant="subtitle1" color="text.secondary">
                            Account Number: {customer.accountNumber}
                        </Typography>
                    </div>
                    <div className="customer-actions">
                        <Chip
                            label={customerStatus === 'active' ? 'Active' : 'Inactive'}
                            color={customerStatus === 'active' ? 'success' : 'default'}
                            size="medium"
                            sx={{ mr: 2 }}
                        />
                        <Button
                            variant="outlined"
                            color="primary"
                            startIcon={<EditIcon />}
                            className="action-button"
                            onClick={() => navigate(`/customers/${id}/edit`)}
                        >
                            Edit Customer
                        </Button>
                    </div>
                </div>

                <div className="customer-info">
                    <Typography variant="h6" gutterBottom>Contact Information</Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <Typography><strong>Contact Name:</strong> {customer.contactName}</Typography>
                            <Typography><strong>Email:</strong> {customer.email}</Typography>
                            <Typography><strong>Phone:</strong> {customer.phone}</Typography>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Typography><strong>Address:</strong> {customer.address}</Typography>
                            <Typography><strong>Created:</strong> {new Date(customer.createdAt).toLocaleDateString()}</Typography>
                            <Typography><strong>Status:</strong> {customer.status}</Typography>
                        </Grid>
                    </Grid>
                </div>

                <div className="shipments-section">
                    <div className="shipments-header">
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
                        />
                    </div>

                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>ID</TableCell>
                                    <TableCell>ORIGIN</TableCell>
                                    <TableCell>DESTINATION</TableCell>
                                    <TableCell>CARRIER</TableCell>
                                    <TableCell>TYPE</TableCell>
                                    <TableCell>STATUS</TableCell>
                                    <TableCell>ACTIONS</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {filteredShipments.map((shipment) => (
                                    <TableRow
                                        key={shipment.id}
                                        className="shipment-row"
                                        onClick={() => navigate(`/shipment/${shipment.shipmentID}`)}
                                    >
                                        <TableCell>{shipment.id}</TableCell>
                                        <TableCell>{shipment.origin}</TableCell>
                                        <TableCell>{shipment.destination}</TableCell>
                                        <TableCell>{shipment.carrier}</TableCell>
                                        <TableCell>{shipment.type}</TableCell>
                                        <TableCell>
                                            <Chip
                                                label={shipment.status}
                                                color={getStatusColor(shipment.status)}
                                                size="small"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <Button
                                                variant="text"
                                                color="primary"
                                                size="small"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/shipment/${shipment.shipmentID}`);
                                                }}
                                            >
                                                View
                                            </Button>
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
                </div>
            </Paper>
        </div>
    );
};

export default CustomerDetail; 