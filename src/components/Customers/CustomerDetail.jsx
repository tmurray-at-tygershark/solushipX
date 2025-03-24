import React from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Chip,
    Divider,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    useTheme,
    Button
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    Edit as EditIcon,
    LocationOn as LocationIcon,
    Business as BusinessIcon,
    Person as PersonIcon,
    Phone as PhoneIcon,
    Email as EmailIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';

const CustomerDetail = () => {
    const theme = useTheme();

    // Mock data - replace with actual API call
    const customer = {
        accountNumber: 'ACC001',
        company: 'Acme Corporation',
        status: 'Active',
        contact: {
            name: 'John Doe',
            phone: '(555) 123-4567',
            email: 'john.doe@acme.com'
        },
        address: {
            address1: '123 Business Street',
            address2: 'Suite 100',
            city: 'New York',
            state: 'NY',
            country: 'United States',
            postalCode: '10001'
        },
        shipmentHistory: [
            {
                id: 'SH001',
                date: '2024-03-15',
                status: 'Delivered',
                origin: 'New York, NY',
                destination: 'Los Angeles, CA',
                trackingNumber: 'TRK123456789'
            },
            {
                id: 'SH002',
                date: '2024-03-10',
                status: 'In Transit',
                origin: 'Chicago, IL',
                destination: 'Miami, FL',
                trackingNumber: 'TRK987654321'
            }
        ]
    };

    const getStatusColor = (status) => {
        switch (status.toLowerCase()) {
            case 'active':
                return 'success';
            case 'inactive':
                return 'default';
            case 'suspended':
                return 'error';
            default:
                return 'default';
        }
    };

    return (
        <Box sx={{ p: 3 }}>
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                style={{ width: '100%' }}
            >
                <Box sx={{ maxWidth: '1200px', mx: 'auto' }}>
                    {/* Page Header */}
                    <Box sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mb: 4
                    }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <IconButton
                                onClick={() => window.history.back()}
                                sx={{ color: '#000' }}
                            >
                                <ArrowBackIcon />
                            </IconButton>
                            <Typography
                                variant="h3"
                                component="h2"
                                sx={{
                                    fontWeight: 800,
                                    color: '#000',
                                    letterSpacing: '-0.02em'
                                }}
                            >
                                Customer Details
                            </Typography>
                        </Box>
                        <Button
                            variant="contained"
                            startIcon={<i className="fas fa-edit"></i>}
                            sx={{
                                bgcolor: '#000',
                                '&:hover': {
                                    bgcolor: '#333'
                                }
                            }}
                        >
                            Edit Customer
                        </Button>
                    </Box>

                    <Grid container spacing={3}>
                        {/* Customer Information Card */}
                        <Grid item xs={12} md={4}>
                            <Paper
                                elevation={0}
                                sx={{
                                    p: 3,
                                    borderRadius: 2,
                                    border: '1px solid #e0e0e0',
                                    height: '100%'
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                                    <BusinessIcon sx={{ mr: 1, color: 'primary.main' }} />
                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                        {customer.company}
                                    </Typography>
                                </Box>

                                <Box sx={{ mb: 3 }}>
                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                        Account Number
                                    </Typography>
                                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                        {customer.accountNumber}
                                    </Typography>
                                </Box>

                                <Box sx={{ mb: 3 }}>
                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                        Status
                                    </Typography>
                                    <Chip
                                        label={customer.status}
                                        color={getStatusColor(customer.status)}
                                        size="small"
                                        sx={{ fontWeight: 500 }}
                                    />
                                </Box>

                                <Divider sx={{ my: 3 }} />

                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <PersonIcon sx={{ mr: 1, color: 'text.secondary' }} />
                                    <Typography variant="subtitle2" color="text.secondary">
                                        Contact Person
                                    </Typography>
                                </Box>
                                <Typography variant="body1" sx={{ mb: 1, fontWeight: 500 }}>
                                    {customer.contact.name}
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                                    <PhoneIcon sx={{ mr: 1, color: 'text.secondary', fontSize: '1.2rem' }} />
                                    <Typography variant="body2">{customer.contact.phone}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <EmailIcon sx={{ mr: 1, color: 'text.secondary', fontSize: '1.2rem' }} />
                                    <Typography variant="body2">{customer.contact.email}</Typography>
                                </Box>
                            </Paper>
                        </Grid>

                        {/* Address Card */}
                        <Grid item xs={12} md={4}>
                            <Paper
                                elevation={0}
                                sx={{
                                    p: 3,
                                    borderRadius: 2,
                                    border: '1px solid #e0e0e0',
                                    height: '100%'
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                                    <LocationIcon sx={{ mr: 1, color: 'primary.main' }} />
                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                        Address
                                    </Typography>
                                </Box>

                                <Typography variant="body1" sx={{ mb: 1 }}>
                                    {customer.address.address1}
                                </Typography>
                                {customer.address.address2 && (
                                    <Typography variant="body1" sx={{ mb: 1 }}>
                                        {customer.address.address2}
                                    </Typography>
                                )}
                                <Typography variant="body1" sx={{ mb: 1 }}>
                                    {customer.address.city}, {customer.address.state} {customer.address.postalCode}
                                </Typography>
                                <Typography variant="body1">
                                    {customer.address.country}
                                </Typography>
                            </Paper>
                        </Grid>

                        {/* Shipment History Card */}
                        <Grid item xs={12} md={4}>
                            <Paper
                                elevation={0}
                                sx={{
                                    p: 3,
                                    borderRadius: 2,
                                    border: '1px solid #e0e0e0',
                                    height: '100%'
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                            Recent Shipments
                                        </Typography>
                                    </Box>
                                    <IconButton size="small" sx={{ color: 'text.secondary' }}>
                                        <EditIcon />
                                    </IconButton>
                                </Box>

                                <TableContainer>
                                    <Table size="small">
                                        <TableBody>
                                            {customer.shipmentHistory.map((shipment) => (
                                                <TableRow key={shipment.id}>
                                                    <TableCell>
                                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                                            {shipment.id}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {shipment.date}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        <Chip
                                                            label={shipment.status}
                                                            size="small"
                                                            color={shipment.status === 'Delivered' ? 'success' : 'primary'}
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Paper>
                        </Grid>
                    </Grid>
                </Box>
            </motion.div>
        </Box>
    );
};

export default CustomerDetail; 