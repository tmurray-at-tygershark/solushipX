import React, { useState } from 'react';
import {
    Box,
    Typography,
    Paper,
    IconButton,
    Collapse,
    Divider,
    Button,
    Chip
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import './ShipmentDetail.css';

const ShipmentDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [expandedSections, setExpandedSections] = useState({
        shipment: true,
        locations: true,
        packages: true,
        rate: true
    });

    // Mock data generation for a single shipment
    const generateMockShipment = () => {
        const mockData = {
            id: id,
            status: 'Awaiting Shipment',
            date: new Date().toLocaleString(),
            shipmentInfo: {
                shipmentType: 'Courier',
                shipmentDate: new Date().toISOString().split('T')[0],
                earliestPickup: '09:00',
                latestPickup: '17:00',
                earliestDelivery: '09:00',
                latestDelivery: '17:00',
                referenceNumber: 'REF-' + Math.random().toString(36).substring(7).toUpperCase()
            },
            shipFrom: {
                company: 'Tech Solutions Inc.',
                contactName: 'John Smith',
                contactPhone: '(555) 123-4567',
                contactEmail: 'john@techsolutions.com',
                address1: '123 Business Ave',
                address2: 'Suite 200',
                city: 'Toronto',
                state: 'ON',
                postalCode: 'M5V 2T6',
                country: 'CA'
            },
            shipTo: {
                company: 'Global Enterprises',
                contactName: 'Emma Wilson',
                contactPhone: '(555) 987-6543',
                contactEmail: 'emma@globalent.com',
                address1: '456 Corporate Blvd',
                address2: 'Floor 15',
                city: 'Vancouver',
                state: 'BC',
                postalCode: 'V6B 4N7',
                country: 'CA'
            },
            packages: [
                {
                    description: 'Electronics Equipment',
                    quantity: 2,
                    weight: '15.5',
                    dimensions: {
                        length: '24',
                        width: '18',
                        height: '12'
                    },
                    freightClass: '60',
                    value: 1200.00
                },
                {
                    description: 'Office Supplies',
                    quantity: 1,
                    weight: '8.2',
                    dimensions: {
                        length: '15',
                        width: '12',
                        height: '10'
                    },
                    freightClass: '50',
                    value: 450.00
                }
            ],
            rate: {
                carrier: 'FedEx',
                service: 'Express',
                transitDays: 2,
                deliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                freightCharges: 175.50,
                fuelCharges: 25.30,
                serviceCharges: 15.00,
                totalCharges: 215.80,
                currency: 'CAD',
                guaranteed: true,
                guaranteeCharge: 25.00
            }
        };

        return mockData;
    };

    const shipment = generateMockShipment();

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const formatAddress = (address) => {
        return `${address.address1}${address.address2 ? ', ' + address.address2 : ''}\n${address.city}, ${address.state} ${address.postalCode}\n${address.country}`;
    };

    const formatPhone = (phone) => {
        return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3');
    };

    return (
        <Box sx={{ width: '100%', bgcolor: '#f6f6f7', minHeight: '100vh', p: 3 }}>
            <Box sx={{ maxWidth: '1200px', margin: '0 auto' }}>
                {/* Header */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Button
                        startIcon={<ArrowBackIcon />}
                        onClick={() => navigate('/')}
                        sx={{ color: 'text.primary' }}
                    >
                        Back to Dashboard
                    </Button>
                    <Typography variant="h5" component="h1" sx={{ fontWeight: 600 }}>
                        Shipment Details: {shipment.id}
                    </Typography>
                    <Chip
                        label={shipment.status}
                        color={
                            shipment.status === 'Delivered' ? 'success' :
                                shipment.status === 'In Transit' ? 'primary' :
                                    'default'
                        }
                        sx={{ ml: 'auto' }}
                    />
                </Box>

                {/* Shipment Information Section */}
                <Paper sx={{ mb: 3 }}>
                    <Box
                        sx={{
                            p: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid #e0e0e0'
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <i className="fas fa-box" style={{ fontSize: '1.2rem', color: '#666' }}></i>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#000' }}>
                                Shipment Information
                            </Typography>
                        </Box>
                        <IconButton
                            onClick={() => toggleSection('shipment')}
                        >
                            <ExpandMoreIcon
                                sx={{
                                    transform: expandedSections.shipment ? 'rotate(180deg)' : 'none',
                                    transition: 'transform 0.3s',
                                    color: '#666'
                                }}
                            />
                        </IconButton>
                    </Box>
                    <Collapse in={expandedSections.shipment}>
                        <Box sx={{ p: 3 }}>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                                <Box>
                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                        Shipment Type
                                    </Typography>
                                    <Typography variant="body1">
                                        {shipment.shipmentInfo.shipmentType}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                        Reference Number
                                    </Typography>
                                    <Typography variant="body1">
                                        {shipment.shipmentInfo.referenceNumber}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                        Shipment Date
                                    </Typography>
                                    <Typography variant="body1">
                                        {shipment.shipmentInfo.shipmentDate}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                        Pickup Window
                                    </Typography>
                                    <Typography variant="body1">
                                        {shipment.shipmentInfo.earliestPickup} - {shipment.shipmentInfo.latestPickup}
                                    </Typography>
                                </Box>
                            </Box>
                        </Box>
                    </Collapse>
                </Paper>

                {/* Shipping Locations Section */}
                <Paper sx={{ mb: 3 }}>
                    <Box
                        sx={{
                            p: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid #e0e0e0'
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <i className="fas fa-map-marker-alt" style={{ fontSize: '1.2rem', color: '#666' }}></i>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#000' }}>
                                Shipping Locations
                            </Typography>
                        </Box>
                        <IconButton
                            onClick={() => toggleSection('locations')}
                        >
                            <ExpandMoreIcon
                                sx={{
                                    transform: expandedSections.locations ? 'rotate(180deg)' : 'none',
                                    transition: 'transform 0.3s',
                                    color: '#666'
                                }}
                            />
                        </IconButton>
                    </Box>
                    <Collapse in={expandedSections.locations}>
                        <Box sx={{ p: 3 }}>
                            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                                {/* Ship From */}
                                <Box>
                                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                                        Ship From
                                    </Typography>
                                    <Box sx={{ display: 'grid', gap: 2 }}>
                                        <Box>
                                            <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
                                                Company Details
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                <i className="fas fa-building" style={{ color: '#000' }}></i>
                                                <Typography variant="body1">{shipment.shipFrom.company}</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                <i className="fas fa-user" style={{ color: '#000' }}></i>
                                                <Typography variant="body1">{shipment.shipFrom.contactName}</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                <i className="fas fa-phone" style={{ color: '#000' }}></i>
                                                <Typography variant="body1">{formatPhone(shipment.shipFrom.contactPhone)}</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <i className="fas fa-envelope" style={{ color: '#000' }}></i>
                                                <Typography variant="body1">{shipment.shipFrom.contactEmail}</Typography>
                                            </Box>
                                        </Box>
                                        <Box>
                                            <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
                                                Address
                                            </Typography>
                                            <Typography variant="body1" style={{ whiteSpace: 'pre-line' }}>
                                                {formatAddress(shipment.shipFrom)}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>

                                {/* Ship To */}
                                <Box>
                                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                                        Ship To
                                    </Typography>
                                    <Box sx={{ display: 'grid', gap: 2 }}>
                                        <Box>
                                            <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
                                                Company Details
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                <i className="fas fa-building" style={{ color: '#000' }}></i>
                                                <Typography variant="body1">{shipment.shipTo.company}</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                <i className="fas fa-user" style={{ color: '#000' }}></i>
                                                <Typography variant="body1">{shipment.shipTo.contactName}</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                                <i className="fas fa-phone" style={{ color: '#000' }}></i>
                                                <Typography variant="body1">{formatPhone(shipment.shipTo.contactPhone)}</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <i className="fas fa-envelope" style={{ color: '#000' }}></i>
                                                <Typography variant="body1">{shipment.shipTo.contactEmail}</Typography>
                                            </Box>
                                        </Box>
                                        <Box>
                                            <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
                                                Address
                                            </Typography>
                                            <Typography variant="body1" style={{ whiteSpace: 'pre-line' }}>
                                                {formatAddress(shipment.shipTo)}
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Box>
                            </Box>
                        </Box>
                    </Collapse>
                </Paper>

                {/* Packages Section */}
                <Paper sx={{ mb: 3 }}>
                    <Box
                        sx={{
                            p: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid #e0e0e0'
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <i className="fas fa-boxes" style={{ fontSize: '1.2rem', color: '#666' }}></i>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#000' }}>
                                Packages
                            </Typography>
                        </Box>
                        <IconButton
                            onClick={() => toggleSection('packages')}
                        >
                            <ExpandMoreIcon
                                sx={{
                                    transform: expandedSections.packages ? 'rotate(180deg)' : 'none',
                                    transition: 'transform 0.3s',
                                    color: '#666'
                                }}
                            />
                        </IconButton>
                    </Box>
                    <Collapse in={expandedSections.packages}>
                        <Box sx={{ p: 3 }}>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
                                {shipment.packages.map((pkg, index) => (
                                    <Paper
                                        key={index}
                                        elevation={0}
                                        sx={{
                                            p: 2,
                                            borderRadius: 2,
                                            border: '1px solid #e0e0e0',
                                            bgcolor: 'background.default'
                                        }}
                                    >
                                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                                            Package {index + 1}
                                        </Typography>
                                        <Box sx={{ display: 'grid', gap: 1 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                    Description
                                                </Typography>
                                                <Typography variant="body1">{pkg.description}</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                    Quantity
                                                </Typography>
                                                <Typography variant="body1">
                                                    {pkg.quantity} {parseInt(pkg.quantity) > 1 ? 'pieces' : 'piece'}
                                                </Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                    Weight
                                                </Typography>
                                                <Typography variant="body1">{pkg.weight} lbs</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                    Dimensions
                                                </Typography>
                                                <Typography variant="body1">
                                                    {pkg.dimensions.length}" × {pkg.dimensions.width}" × {pkg.dimensions.height}"
                                                </Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                    Freight Class
                                                </Typography>
                                                <Typography variant="body1">{pkg.freightClass}</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                    Declared Value
                                                </Typography>
                                                <Typography variant="body1">${pkg.value.toFixed(2)}</Typography>
                                            </Box>
                                        </Box>
                                    </Paper>
                                ))}
                            </Box>
                        </Box>
                    </Collapse>
                </Paper>

                {/* Rate Section */}
                <Paper sx={{ mb: 3 }}>
                    <Box
                        sx={{
                            p: 2,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            borderBottom: '1px solid #e0e0e0'
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <i className="fas fa-dollar-sign" style={{ fontSize: '1.2rem', color: '#666' }}></i>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#000' }}>
                                Rate Details
                            </Typography>
                        </Box>
                        <IconButton
                            onClick={() => toggleSection('rate')}
                        >
                            <ExpandMoreIcon
                                sx={{
                                    transform: expandedSections.rate ? 'rotate(180deg)' : 'none',
                                    transition: 'transform 0.3s',
                                    color: '#666'
                                }}
                            />
                        </IconButton>
                    </Box>
                    <Collapse in={expandedSections.rate}>
                        <Box sx={{ p: 3 }}>
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                                <Box>
                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                        Carrier & Service
                                    </Typography>
                                    <Typography variant="body1">
                                        {shipment.rate.carrier} - {shipment.rate.service}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                        Transit Time
                                    </Typography>
                                    <Typography variant="body1">
                                        {shipment.rate.transitDays} {shipment.rate.transitDays === 1 ? 'day' : 'days'}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                        Delivery Date
                                    </Typography>
                                    <Typography variant="body1">
                                        {shipment.rate.deliveryDate}
                                    </Typography>
                                </Box>
                            </Box>
                            <Divider sx={{ my: 2 }} />
                            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 2 }}>
                                <Box>
                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                        Freight Charges
                                    </Typography>
                                    <Typography variant="body1">
                                        ${shipment.rate.freightCharges.toFixed(2)}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                        Fuel Charges
                                    </Typography>
                                    <Typography variant="body1">
                                        ${shipment.rate.fuelCharges.toFixed(2)}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                        Service Charges
                                    </Typography>
                                    <Typography variant="body1">
                                        ${shipment.rate.serviceCharges.toFixed(2)}
                                    </Typography>
                                </Box>
                                {shipment.rate.guaranteed && (
                                    <Box>
                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                            Guarantee Charge
                                        </Typography>
                                        <Typography variant="body1">
                                            ${shipment.rate.guaranteeCharge.toFixed(2)}
                                        </Typography>
                                    </Box>
                                )}
                            </Box>
                            <Divider sx={{ my: 2 }} />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                    Total Charges
                                </Typography>
                                <Typography variant="h5" sx={{ fontWeight: 700, color: '#000' }}>
                                    ${shipment.rate.totalCharges.toFixed(2)} {shipment.rate.currency}
                                </Typography>
                            </Box>
                        </Box>
                    </Collapse>
                </Paper>
            </Box>
        </Box>
    );
};

export default ShipmentDetail; 