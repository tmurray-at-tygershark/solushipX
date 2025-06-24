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
                            p: 0.5
                        }}
                    />
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: '0.95rem', mb: 0.5 }}>
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
                                <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '1.6rem', color: 'primary.main' }}>
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
                                <Typography variant="h4" sx={{ fontWeight: 700, fontSize: '1.5rem', color: 'success.main' }}>
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

                    <Collapse in={expanded} timeout={300}>
                        {expanded && (
                            <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e5e7eb' }}>
                                <Divider sx={{ mb: 2 }} />

                                {/* Enhanced debug logging to see actual rate structure */}
                                {console.log('🔍 EnhancedRateCard Rate Structure:', {
                                    hasBillingDetails: !!(rate.billingDetails || rate.pricing?.billingDetails),
                                    billingDetailsLength: (rate.billingDetails || rate.pricing?.billingDetails)?.length,
                                    billingDetailsContent: rate.billingDetails || rate.pricing?.billingDetails,
                                    hasMarkupMetadata: !!rate.markupMetadata,
                                    markupMetadata: rate.markupMetadata,
                                    pricingKeys: Object.keys(rate.pricing || {}),
                                    ratePricingTotal: rate.pricing?.total,
                                    carrierName: rate.sourceCarrier?.name || rate.carrier?.name,
                                    topLevelBillingDetails: rate.billingDetails,
                                    pricingBillingDetails: rate.pricing?.billingDetails
                                })}

                                <Grid container spacing={2}>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" sx={{ fontSize: '10px', textTransform: 'uppercase', color: 'text.secondary', fontWeight: 500 }}>
                                            Source System
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 500 }}>
                                            {(() => {
                                                // Smart source system detection
                                                if (rate.sourceSystem) {
                                                    return rate.sourceSystem;
                                                }

                                                // Check if this is a direct carrier (not through eShip Plus)
                                                const carrierName = rate.displayCarrier?.name || rate.carrier?.name || rate.carrierName;
                                                const sourceCarrierKey = rate.sourceCarrier?.key || rate.sourceCarrier?.name;
                                                const sourceCarrierSystem = rate.sourceCarrier?.system;

                                                // If it's explicitly from eShip Plus
                                                if (sourceCarrierKey === 'ESHIPPLUS' ||
                                                    sourceCarrierSystem === 'eshipplus' ||
                                                    rate.sourceCarrierName === 'eShip Plus') {
                                                    return 'EShip Plus';
                                                }

                                                // For direct carriers, show the carrier name
                                                if (carrierName && carrierName !== 'Unknown Carrier') {
                                                    return carrierName;
                                                }

                                                // Fallback
                                                return 'Direct Carrier';
                                            })()}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                        <Typography variant="caption" sx={{ fontSize: '10px', textTransform: 'uppercase', color: 'text.secondary', fontWeight: 500 }}>
                                            Service Mode
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 500 }}>
                                            {rate.service?.name || rate.displayCarrier?.name || 'Standard'}
                                        </Typography>
                                    </Grid>
                                </Grid>

                                <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontSize: '12px', fontWeight: 600 }}>
                                    Cost Breakdown
                                </Typography>

                                {(() => {
                                    // Check for billingDetails in both locations (top-level and pricing)
                                    const billingDetails = rate.billingDetails || rate.pricing?.billingDetails;

                                    if (billingDetails && billingDetails.length > 0) {
                                        // Detailed billing breakdown (includes markup if applied)
                                        return billingDetails.map((detail, index) => (
                                            <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                                <Typography variant="body2" sx={{ fontSize: '11px', color: 'text.secondary' }}>
                                                    {detail.name || 'Charge'}
                                                </Typography>
                                                <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                    {formatPrice(detail.amount)}
                                                </Typography>
                                            </Box>
                                        ));
                                    } else {
                                        // Standard breakdown - use marked-up amounts if available
                                        // Helper function to get charge amount (marked-up if available)
                                        const getChargeAmount = (chargeName, fallbackAmount) => {
                                            // Check if we have billing details with markup applied
                                            const billingDetailsToCheck = rate.billingDetails || rate.pricing?.billingDetails;
                                            if (billingDetailsToCheck && Array.isArray(billingDetailsToCheck)) {
                                                const detail = billingDetailsToCheck.find(detail => {
                                                    const detailName = (detail.name || '').toLowerCase();
                                                    return detailName.includes(chargeName.toLowerCase());
                                                });
                                                if (detail && detail.amount !== undefined) {
                                                    return {
                                                        amount: detail.amount,
                                                        hasMarkup: detail.hasMarkup,
                                                        markupPercentage: detail.markupPercentage
                                                    };
                                                }
                                            }
                                            // Fallback to raw pricing
                                            return {
                                                amount: fallbackAmount,
                                                hasMarkup: false,
                                                markupPercentage: null
                                            };
                                        };

                                        // Enhanced fallback logic for different carriers and rate structures
                                        const getStandardCharges = () => {
                                            const pricing = rate.pricing || {};

                                            // Enhanced freight charge detection
                                            const freightAmount = pricing.baseRate || pricing.freight || pricing.freightCharges ||
                                                rate.freightCharges || pricing.base || pricing.linehaul || 0;

                                            // Enhanced fuel charge detection
                                            const fuelAmount = pricing.fuelSurcharge || pricing.fuel || pricing.fuelCharges ||
                                                rate.fuelCharges || pricing.surcharge || 0;

                                            // Enhanced service charge detection
                                            const serviceAmount = pricing.serviceCharges || pricing.service || pricing.accessorial ||
                                                rate.serviceCharges || pricing.handling || 0;

                                            // Enhanced tax detection
                                            const taxAmount = pricing.taxes?.total || pricing.tax || pricing.taxCharges ||
                                                rate.taxCharges || pricing.gst || pricing.hst || 0;

                                            return { freightAmount, fuelAmount, serviceAmount, taxAmount };
                                        };

                                        const { freightAmount, fuelAmount, serviceAmount, taxAmount } = getStandardCharges();

                                        const freightCharge = getChargeAmount('freight', freightAmount);
                                        const fuelCharge = getChargeAmount('fuel', fuelAmount);
                                        const serviceCharge = getChargeAmount('service', serviceAmount);
                                        const taxCharge = getChargeAmount('tax', taxAmount);

                                        return (
                                            <>
                                                {freightCharge.amount > 0 && (
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                                        <Typography variant="body2" sx={{ fontSize: '11px', color: 'text.secondary' }}>
                                                            Freight Charges
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                            {formatPrice(freightCharge.amount)}
                                                        </Typography>
                                                    </Box>
                                                )}
                                                {fuelCharge.amount > 0 && (
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                                        <Typography variant="body2" sx={{ fontSize: '11px', color: 'text.secondary' }}>
                                                            Fuel Surcharge
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                            {formatPrice(fuelCharge.amount)}
                                                        </Typography>
                                                    </Box>
                                                )}
                                                {serviceCharge.amount > 0 && (
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                                        <Typography variant="body2" sx={{ fontSize: '11px', color: 'text.secondary' }}>
                                                            Service Charges
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                            {formatPrice(serviceCharge.amount)}
                                                        </Typography>
                                                    </Box>
                                                )}
                                                {taxCharge.amount > 0 && (
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                                        <Typography variant="body2" sx={{ fontSize: '11px', color: 'text.secondary' }}>
                                                            Taxes
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                            {formatPrice(taxCharge.amount)}
                                                        </Typography>
                                                    </Box>
                                                )}
                                                {/* Fallback: If no individual charges found, show at least the total */}
                                                {freightCharge.amount === 0 && fuelCharge.amount === 0 && serviceCharge.amount === 0 && taxCharge.amount === 0 && (
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                                        <Typography variant="body2" sx={{ fontSize: '11px', color: 'text.secondary' }}>
                                                            Total Rate
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                            {formatPrice(totalPrice)}
                                                        </Typography>
                                                    </Box>
                                                )}
                                            </>
                                        );
                                    }
                                })()}

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
                        )}
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