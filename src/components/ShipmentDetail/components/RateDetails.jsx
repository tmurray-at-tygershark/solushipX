import React from 'react';
import {
    Grid,
    Paper,
    Typography,
    Box,
    IconButton,
    Collapse
} from '@mui/material';
import {
    AttachMoney as MoneyIcon,
    ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';

// Inline CarrierDisplay component to avoid import issues
const CarrierDisplay = ({ carrierName, carrierData, size = "medium", isIntegrationCarrier = false }) => {
    if (!carrierName) return <Typography variant="body1">N/A</Typography>;

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {carrierData?.logoUrl && (
                <img
                    src={carrierData.logoUrl}
                    alt={carrierName}
                    style={{
                        height: size === 'small' ? 20 : 24,
                        width: 'auto',
                        objectFit: 'contain'
                    }}
                />
            )}
            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {carrierName}
            </Typography>
        </Box>
    );
};

const RateDetails = ({
    expanded = true,
    onToggle = () => { },
    getBestRateInfo,
    carrierData,
    shipment
}) => {
    const safeNumber = (value) => {
        const num = parseFloat(value);
        return isNaN(num) ? 0 : num;
    };

    return (
        <Grid item xs={12} sx={{ mb: 3 }}>
            <Paper>
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
                        <MoneyIcon sx={{ color: '#000' }} />
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#000' }}>
                            Rate Details
                        </Typography>
                    </Box>
                    <IconButton onClick={onToggle}>
                        <ExpandMoreIcon
                            sx={{
                                transform: expanded ? 'rotate(180deg)' : 'none',
                                transition: 'transform 0.3s',
                                color: '#666'
                            }}
                        />
                    </IconButton>
                </Box>
                <Collapse in={expanded}>
                    <Box sx={{ p: 3 }}>
                        {console.log('ShipmentDetail Rate Details bestRateInfo:', JSON.stringify(getBestRateInfo))}
                        <Grid container spacing={3}>
                            {/* Left Column - Service Details */}
                            <Grid item xs={12} md={4}>
                                <Box sx={{ display: 'grid', gap: 2 }}>
                                    <Box>
                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                            Carrier & Service
                                        </Typography>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                                            <CarrierDisplay
                                                carrierName={getBestRateInfo?.carrier}
                                                carrierData={carrierData}
                                                size="small"
                                                isIntegrationCarrier={getBestRateInfo?.displayCarrierId === 'ESHIPPLUS' || getBestRateInfo?.sourceCarrierName === 'eShipPlus'}
                                            />
                                            {getBestRateInfo?.service && (
                                                <>
                                                    <Typography variant="body2" color="text.secondary">-</Typography>
                                                    <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                                        {getBestRateInfo.service}
                                                    </Typography>
                                                </>
                                            )}
                                        </Box>
                                    </Box>
                                    <Box>
                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                            Transit Time
                                        </Typography>
                                        <Typography variant="body1">
                                            {getBestRateInfo?.transitDays || 0} {getBestRateInfo?.transitDays === 1 ? 'day' : 'days'}
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                            Delivery Date
                                        </Typography>
                                        <Typography variant="body1">
                                            {(() => {
                                                const deliveryDate =
                                                    shipment?.carrierBookingConfirmation?.estimatedDeliveryDate ||
                                                    getBestRateInfo?.transit?.estimatedDelivery ||
                                                    getBestRateInfo?.estimatedDeliveryDate;

                                                if (deliveryDate) {
                                                    try {
                                                        const date = deliveryDate.toDate ? deliveryDate.toDate() : new Date(deliveryDate);
                                                        return date.toLocaleDateString('en-US', {
                                                            weekday: 'short',
                                                            year: 'numeric',
                                                            month: 'short',
                                                            day: 'numeric'
                                                        });
                                                    } catch (error) {
                                                        console.error('Error formatting delivery date:', error);
                                                        return 'Invalid Date';
                                                    }
                                                }
                                                return 'N/A';
                                            })()}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Grid>

                            {/* Middle Column - Charges */}
                            <Grid item xs={12} md={4}>
                                {(() => {
                                    if (getBestRateInfo?.billingDetails && Array.isArray(getBestRateInfo.billingDetails) && getBestRateInfo.billingDetails.length > 0) {
                                        const validDetails = getBestRateInfo.billingDetails.filter(detail =>
                                            detail &&
                                            detail.name &&
                                            (detail.amount !== undefined && detail.amount !== null)
                                        );

                                        if (validDetails.length > 0) {
                                            return (
                                                <Box sx={{ display: 'grid', gap: 2 }}>
                                                    {validDetails.map((detail, index) => (
                                                        <Box key={index}>
                                                            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                                {detail.name}
                                                            </Typography>
                                                            <Typography variant="body1">
                                                                ${safeNumber(detail.amount).toFixed(2)}
                                                            </Typography>
                                                        </Box>
                                                    ))}
                                                </Box>
                                            );
                                        }
                                    }

                                    const breakdownItems = [];
                                    const freight = safeNumber(getBestRateInfo?.pricing?.freight || getBestRateInfo?.freightCharge || getBestRateInfo?.freightCharges);
                                    if (freight > 0) {
                                        breakdownItems.push({ name: 'Freight Charges', amount: freight });
                                    }

                                    const fuel = safeNumber(getBestRateInfo?.pricing?.fuel || getBestRateInfo?.fuelCharge || getBestRateInfo?.fuelCharges);
                                    if (fuel > 0) {
                                        breakdownItems.push({ name: 'Fuel Charges', amount: fuel });
                                    }

                                    const service = safeNumber(getBestRateInfo?.pricing?.service || getBestRateInfo?.serviceCharges);
                                    if (service > 0) {
                                        breakdownItems.push({ name: 'Service Charges', amount: service });
                                    }

                                    const accessorial = safeNumber(getBestRateInfo?.pricing?.accessorial || getBestRateInfo?.accessorialCharges);
                                    if (accessorial > 0) {
                                        breakdownItems.push({ name: 'Accessorial Charges', amount: accessorial });
                                    }

                                    if (getBestRateInfo?.guaranteed) {
                                        const guarantee = safeNumber(getBestRateInfo?.pricing?.guarantee || getBestRateInfo?.guaranteeCharge);
                                        if (guarantee > 0) {
                                            breakdownItems.push({ name: 'Guarantee Charge', amount: guarantee });
                                        }
                                    }

                                    if (breakdownItems.length > 0) {
                                        return (
                                            <Box sx={{ display: 'grid', gap: 2 }}>
                                                {breakdownItems.map((item, index) => (
                                                    <Box key={index}>
                                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                            {item.name}
                                                        </Typography>
                                                        <Typography variant="body1">
                                                            ${item.amount.toFixed(2)}
                                                        </Typography>
                                                    </Box>
                                                ))}
                                            </Box>
                                        );
                                    }

                                    return (
                                        <Box sx={{ display: 'grid', gap: 2 }}>
                                            <Box>
                                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                    Freight Charges
                                                </Typography>
                                                <Typography variant="body1">
                                                    ${(getBestRateInfo?.pricing?.freight ||
                                                        getBestRateInfo?.freightCharge ||
                                                        getBestRateInfo?.freightCharges || 0).toFixed(2)}
                                                </Typography>
                                            </Box>
                                            <Box>
                                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                    Fuel Charges
                                                </Typography>
                                                <Typography variant="body1">
                                                    ${(getBestRateInfo?.pricing?.fuel ||
                                                        getBestRateInfo?.fuelCharge ||
                                                        getBestRateInfo?.fuelCharges || 0).toFixed(2)}
                                                </Typography>
                                            </Box>
                                            <Box>
                                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                    Service Charges
                                                </Typography>
                                                <Typography variant="body1">
                                                    ${(getBestRateInfo?.pricing?.service ||
                                                        getBestRateInfo?.serviceCharges || 0).toFixed(2)}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    );
                                })()}
                            </Grid>

                            {/* Right Column - Total */}
                            <Grid item xs={12} md={4}>
                                <Paper
                                    elevation={0}
                                    sx={{
                                        p: 2,
                                        borderRadius: 2,
                                        border: '1px solid #e0e0e0',
                                        bgcolor: 'background.default',
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        justifyContent: 'center'
                                    }}
                                >
                                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, textAlign: 'center' }}>
                                        Total Charges
                                    </Typography>
                                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#000', textAlign: 'center' }}>
                                        ${(getBestRateInfo?.pricing?.total ||
                                            getBestRateInfo?.totalCharges || 0).toFixed(2)}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                                        {getBestRateInfo?.pricing?.currency ||
                                            getBestRateInfo?.currency || 'USD'}
                                    </Typography>
                                </Paper>
                            </Grid>
                        </Grid>
                    </Box>
                </Collapse>
            </Paper>
        </Grid>
    );
};

export default RateDetails; 