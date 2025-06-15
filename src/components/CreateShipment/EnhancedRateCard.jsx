import React, { useState } from 'react';
import {
    Card,
    CardContent,
    Typography,
    Button,
    Box,
    Chip,
    Collapse,
    IconButton,
    Divider,
    Grid
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SecurityIcon from '@mui/icons-material/Security';

const EnhancedRateCard = ({
    rate,
    isSelected,
    onSelect,
    showDetails = false,
    onGuaranteeChange
}) => {
    const [expanded, setExpanded] = useState(showDetails);

    const getCarrierLogo = (rate) => {
        // Enhanced carrier logo detection that checks master carrier identification
        // This prioritizes sourceCarrier (master carrier like "eshipplus") over displayCarrier (sub-carrier like "Ward Trucking")

        const carrierName = rate.displayCarrier?.name || rate.carrier?.name || rate.carrierName || 'Unknown Carrier';

        // Check for eShip Plus master carrier identification
        const sourceCarrier = rate.sourceCarrier?.key || rate.sourceCarrier?.name;
        const sourceCarrierName = rate.sourceCarrier?.name;
        const sourceCarrierSystem = rate.sourceCarrier?.system;

        // Enhanced eShip Plus detection - check multiple fields for master carrier identification
        const isEshipPlus =
            sourceCarrier === 'ESHIPPLUS' ||
            sourceCarrierName === 'eShip Plus' ||
            sourceCarrierSystem === 'eshipplus' ||
            rate.displayCarrierId === 'ESHIPPLUS' ||
            rate.sourceCarrierName === 'eShipPlus' ||
            // Check for freight carrier patterns that indicate eShip Plus sub-carriers
            carrierName.toLowerCase().includes('freight') ||
            carrierName.toLowerCase().includes('ltl') ||
            carrierName.toLowerCase().includes('fedex freight') ||
            carrierName.toLowerCase().includes('road runner') ||
            carrierName.toLowerCase().includes('roadrunner') ||
            carrierName.toLowerCase().includes('estes') ||
            carrierName.toLowerCase().includes('yrc') ||
            carrierName.toLowerCase().includes('xpo') ||
            carrierName.toLowerCase().includes('old dominion') ||
            carrierName.toLowerCase().includes('odfl') ||
            carrierName.toLowerCase().includes('saia') ||
            carrierName.toLowerCase().includes('ward');

        if (isEshipPlus) {
            return '/images/carrier-badges/eship.png';
        }

        // Standard logo mapping for direct carriers
        const logoMap = {
            'eShip Plus': '/images/carrier-badges/eship.png',
            'Canpar': '/images/carrier-badges/canpar.png',
            'Canpar Express': '/images/carrier-badges/canpar.png',
            'Polaris Transportation': '/images/carrier-badges/polaristransportation.png',
            'FedEx': '/images/carrier-badges/fedex.png',
            'UPS': '/images/carrier-badges/ups.png',
            'DHL': '/images/carrier-badges/dhl.png',
            'Canada Post': '/images/carrier-badges/canadapost.png',
            'Purolator': '/images/carrier-badges/purolator.png',
            'USPS': '/images/carrier-badges/usps.png'
        };

        return logoMap[carrierName] || '/images/carrier-badges/solushipx.png';
    };

    const formatPrice = (price) => {
        const currency = rate.pricing?.currency || 'USD';
        const formattedPrice = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2
        }).format(price || 0);

        // Add currency prefix for better clarity
        const currencyPrefixes = {
            'USD': 'US$',
            'CAD': 'CA$',
            'EUR': 'EUR€',
            'GBP': '£',
            'AUD': 'AU$',
            'NZD': 'NZ$',
            'JPY': '¥',
            'CHF': 'CHF',
            'SEK': 'SEK',
            'NOK': 'NOK',
            'DKK': 'DKK'
        };

        const prefix = currencyPrefixes[currency];
        if (prefix) {
            // Remove the default currency symbol and replace with our prefix
            const numericPart = formattedPrice.replace(/[^\d.,]/g, '');
            return `${prefix}${numericPart}`;
        }

        return formattedPrice;
    };

    const getServiceTypeColor = (serviceName) => {
        const service = serviceName?.toLowerCase() || '';
        if (service.includes('express') || service.includes('priority')) return 'error';
        if (service.includes('economy') || service.includes('standard')) return 'info';
        if (service.includes('overnight') || service.includes('next day')) return 'warning';
        return 'default';
    };

    const carrierName = rate.displayCarrier?.name || rate.carrier?.name || rate.carrierName || 'Unknown Carrier';
    const serviceName = rate.service?.name || (typeof rate.service === 'string' ? rate.service : 'Standard');
    const totalPrice = rate.pricing?.total || rate.totalCharges || rate.price || 0;
    const transitDays = rate.transit?.days !== undefined ? rate.transit.days : 'N/A';
    const estimatedDelivery = rate.transit?.estimatedDelivery || 'N/A';
    const isGuaranteed = rate.transit?.guaranteed || rate.guaranteed;
    const guaranteeCharge = rate.pricing?.guarantee || rate.guaranteeCharge || 0;

    return (
        <Card
            elevation={isSelected ? 8 : 2}
            sx={{
                borderRadius: 3,
                border: isSelected ? '3px solid #10B981' : '1px solid #e2e8f0',
                transition: 'all 0.3s ease',
                transform: isSelected ? 'scale(1.02)' : 'scale(1)',
                background: isSelected
                    ? 'linear-gradient(135deg, #ecfdf5 0%, #ffffff 100%)'
                    : 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                position: 'relative',
                overflow: 'visible'
            }}
        >
            {/* Selected Badge */}
            {isSelected && (
                <Box
                    sx={{
                        position: 'absolute',
                        top: -8,
                        right: 16,
                        bgcolor: '#10B981',
                        color: 'white',
                        px: 2,
                        py: 0.5,
                        borderRadius: 2,
                        fontSize: '11px',
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.5,
                        zIndex: 1
                    }}
                >
                    <CheckCircleIcon sx={{ fontSize: '14px' }} />
                    SELECTED
                </Box>
            )}

            <CardContent sx={{ p: 3 }}>
                {/* Header Section */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Box
                        component="img"
                        src={getCarrierLogo(rate)}
                        alt={carrierName}
                        sx={{
                            width: 80,
                            height: 40,
                            objectFit: 'contain',
                            mr: 2,
                            borderRadius: 1,
                            bgcolor: 'white',
                            p: 0.5,
                            border: '1px solid #e2e8f0'
                        }}
                    />
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.1rem', mb: 0.5 }}>
                            {carrierName}
                        </Typography>
                        <Chip
                            label={serviceName}
                            color={getServiceTypeColor(serviceName)}
                            size="small"
                            sx={{ fontSize: '10px', fontWeight: 600 }}
                        />
                    </Box>
                </Box>

                {/* Main Info Grid */}
                <Grid container spacing={2} sx={{ mb: 2 }}>
                    {/* Transit Time */}
                    <Grid item xs={6}>
                        <Box sx={{ textAlign: 'center', p: 2, borderRadius: 2, bgcolor: 'rgba(59, 130, 246, 0.1)' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                                <AccessTimeIcon sx={{ color: 'primary.main', mr: 0.5, fontSize: '1.2rem' }} />
                                <Typography variant="h3" sx={{ fontWeight: 700, fontSize: '2rem', color: 'primary.main' }}>
                                    {transitDays}
                                </Typography>
                            </Box>
                            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '10px', color: 'primary.dark' }}>
                                BUSINESS DAYS
                            </Typography>
                        </Box>
                    </Grid>

                    {/* Price */}
                    <Grid item xs={6}>
                        <Box sx={{ textAlign: 'center', p: 2, borderRadius: 2, bgcolor: 'rgba(16, 185, 129, 0.1)' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 1 }}>
                                <Typography variant="h3" sx={{ fontWeight: 700, fontSize: '1.8rem', color: 'success.main' }}>
                                    {formatPrice(totalPrice)}
                                </Typography>
                            </Box>
                            <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '10px', color: 'success.dark' }}>
                                TOTAL COST
                            </Typography>
                        </Box>
                    </Grid>
                </Grid>

                {/* Delivery Date */}
                <Box sx={{ textAlign: 'center', mb: 2 }}>
                    <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '12px' }}>
                        <LocalShippingIcon sx={{ fontSize: '14px', mr: 0.5, verticalAlign: 'middle' }} />
                        Estimated delivery: <strong>{estimatedDelivery}</strong>
                    </Typography>
                </Box>

                {/* Guarantee Option */}
                {isGuaranteed && guaranteeCharge > 0 && (
                    <Box sx={{ mb: 2, p: 2, borderRadius: 2, bgcolor: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <SecurityIcon sx={{ color: 'warning.main', mr: 1, fontSize: '1.1rem' }} />
                                <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '12px' }}>
                                    Delivery Guarantee
                                </Typography>
                            </Box>
                            <Typography variant="body2" sx={{ fontWeight: 700, color: 'warning.dark', fontSize: '12px' }}>
                                +{formatPrice(guaranteeCharge)}
                            </Typography>
                        </Box>
                        {onGuaranteeChange && (
                            <Box sx={{ mt: 1 }}>
                                <Button
                                    size="small"
                                    variant={isSelected && rate.guaranteed ? 'contained' : 'outlined'}
                                    color="warning"
                                    onClick={() => onGuaranteeChange(rate, !rate.guaranteed)}
                                    sx={{ fontSize: '10px', py: 0.5 }}
                                >
                                    {rate.guaranteed ? 'Remove Guarantee' : 'Add Guarantee'}
                                </Button>
                            </Box>
                        )}
                    </Box>
                )}

                {/* Rate Details Collapse */}
                <Box>
                    <Button
                        onClick={() => setExpanded(!expanded)}
                        endIcon={
                            <ExpandMoreIcon
                                sx={{
                                    transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                    transition: 'transform 0.3s'
                                }}
                            />
                        }
                        variant="text"
                        size="small"
                        sx={{ mb: 1, fontSize: '11px', fontWeight: 600 }}
                    >
                        {expanded ? 'Hide Details' : 'Show Details'}
                    </Button>

                    <Collapse in={expanded}>
                        <Box sx={{ pt: 1 }}>
                            <Divider sx={{ mb: 2 }} />

                            {/* Service Details */}
                            <Grid container spacing={2} sx={{ mb: 2 }}>
                                <Grid item xs={6}>
                                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '10px' }}>
                                        SOURCE SYSTEM
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '12px' }}>
                                        {rate.sourceCarrier?.name || 'Unknown'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={6}>
                                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '10px' }}>
                                        SERVICE MODE
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '12px' }}>
                                        {rate.serviceMode || serviceName}
                                    </Typography>
                                </Grid>
                            </Grid>

                            {/* Billing Breakdown */}
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1, fontSize: '12px' }}>
                                Cost Breakdown
                            </Typography>

                            {rate.pricing?.billingDetails && rate.pricing.billingDetails.length > 0 ? (
                                // Detailed billing breakdown (Canpar style)
                                rate.pricing.billingDetails.map((detail, index) => (
                                    <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                        <Typography variant="body2" sx={{ fontSize: '11px', color: 'text.secondary' }}>
                                            {detail.name}
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600 }}>
                                            {formatPrice(detail.amount)}
                                        </Typography>
                                    </Box>
                                ))
                            ) : (
                                // Standard breakdown
                                <>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                        <Typography variant="body2" sx={{ fontSize: '11px', color: 'text.secondary' }}>
                                            Freight Charges
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600 }}>
                                            {formatPrice(rate.pricing?.baseRate || rate.pricing?.freight || rate.freightCharges || 0)}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                        <Typography variant="body2" sx={{ fontSize: '11px', color: 'text.secondary' }}>
                                            Fuel Surcharge
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600 }}>
                                            {formatPrice(rate.pricing?.fuelSurcharge || rate.pricing?.fuel || rate.fuelCharges || 0)}
                                        </Typography>
                                    </Box>
                                    {(rate.pricing?.serviceCharges || rate.pricing?.service || rate.serviceCharges || 0) > 0 && (
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                            <Typography variant="body2" sx={{ fontSize: '11px', color: 'text.secondary' }}>
                                                Service Charges
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                {formatPrice(rate.pricing?.serviceCharges || rate.pricing?.service || rate.serviceCharges || 0)}
                                            </Typography>
                                        </Box>
                                    )}
                                    {(rate.pricing?.taxes?.total || rate.pricing?.tax || rate.taxCharges || 0) > 0 && (
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                            <Typography variant="body2" sx={{ fontSize: '11px', color: 'text.secondary' }}>
                                                Taxes
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                {formatPrice(rate.pricing?.taxes?.total || rate.pricing?.tax || rate.taxCharges || 0)}
                                            </Typography>
                                        </Box>
                                    )}
                                </>
                            )}

                            <Divider sx={{ my: 1 }} />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 700 }}>
                                    Total
                                </Typography>
                                <Typography variant="subtitle2" sx={{ fontSize: '12px', fontWeight: 700, color: 'success.main' }}>
                                    {formatPrice(totalPrice)}
                                </Typography>
                            </Box>
                        </Box>
                    </Collapse>
                </Box>

                {/* Select Button */}
                <Button
                    variant={isSelected ? 'contained' : 'outlined'}
                    color={isSelected ? 'success' : 'primary'}
                    onClick={() => onSelect(rate)}
                    fullWidth
                    sx={{
                        mt: 2,
                        py: 1.5,
                        borderRadius: 2,
                        fontWeight: 700,
                        fontSize: '12px',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                    }}
                    startIcon={isSelected ? <CheckCircleIcon /> : null}
                >
                    {isSelected ? 'Selected' : 'Select This Rate'}
                </Button>
            </CardContent>
        </Card>
    );
};

export default EnhancedRateCard; 