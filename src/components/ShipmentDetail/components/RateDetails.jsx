import React from 'react';
import {
    Grid,
    Paper,
    Typography,
    Box
} from '@mui/material';

const CarrierDisplay = ({ carrierName, carrierData, size = "medium", isIntegrationCarrier = false }) => {
    const sizeConfig = {
        small: { logoSize: 24, fontSize: '12px' },
        medium: { logoSize: 32, fontSize: '1rem' },
        large: { logoSize: 40, fontSize: '1.125rem' }
    };

    const { fontSize } = sizeConfig[size];

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography
                variant="body1"
                sx={{
                    fontSize: fontSize,
                    fontWeight: 500
                }}
            >
                {carrierName || 'N/A'}
                {isIntegrationCarrier && (
                    <Typography component="span" sx={{ fontSize: '10px', color: 'text.secondary', ml: 0.5 }}>
                        (via eShip Plus)
                    </Typography>
                )}
            </Typography>
        </Box>
    );
};

const RateDetails = ({
    getBestRateInfo,
    carrierData,
    shipment
}) => {
    const safeNumber = (value) => {
        return isNaN(parseFloat(value)) ? 0 : parseFloat(value);
    };

    return (
        <Grid item xs={12} sx={{ mb: 1 }}>
            <Paper>
                <Box
                    sx={{
                        p: 2,
                        borderBottom: '1px solid #e0e0e0'
                    }}
                >
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#000', fontSize: '16px' }}>
                        Rate Details
                    </Typography>
                </Box>
                <Box sx={{ p: 2 }}>
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
                                                <Typography variant="body1" sx={{ fontWeight: 500, fontSize: '12px' }}>
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
                                    <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                        {getBestRateInfo?.transitDays || 0} {getBestRateInfo?.transitDays === 1 ? 'day' : 'days'}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                        Estimated Delivery Date
                                    </Typography>
                                    <Typography variant="body1" sx={{ fontSize: '12px' }}>
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
                                                        <Typography variant="body1" sx={{ fontSize: '12px' }}>
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
                                                    <Typography variant="body1" sx={{ fontSize: '12px' }}>
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
                                            <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                                ${(getBestRateInfo?.pricing?.freight ||
                                                    getBestRateInfo?.freightCharge ||
                                                    getBestRateInfo?.freightCharges || 0).toFixed(2)}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                Fuel Charges
                                            </Typography>
                                            <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                                ${(getBestRateInfo?.pricing?.fuel ||
                                                    getBestRateInfo?.fuelCharge ||
                                                    getBestRateInfo?.fuelCharges || 0).toFixed(2)}
                                            </Typography>
                                        </Box>
                                        <Box>
                                            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                Service Charges
                                            </Typography>
                                            <Typography variant="body1" sx={{ fontSize: '12px' }}>
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
                                    ${(() => {
                                        if (getBestRateInfo?.pricing?.total !== undefined) {
                                            return safeNumber(getBestRateInfo.pricing.total).toFixed(2);
                                        }
                                        if (getBestRateInfo?.totalCharges !== undefined) {
                                            return safeNumber(getBestRateInfo.totalCharges).toFixed(2);
                                        }
                                        if (getBestRateInfo?.total !== undefined) {
                                            return safeNumber(getBestRateInfo.total).toFixed(2);
                                        }
                                        const freight = safeNumber(getBestRateInfo?.pricing?.freight || getBestRateInfo?.freightCharge || getBestRateInfo?.freightCharges);
                                        const fuel = safeNumber(getBestRateInfo?.pricing?.fuel || getBestRateInfo?.fuelCharge || getBestRateInfo?.fuelCharges);
                                        const service = safeNumber(getBestRateInfo?.pricing?.service || getBestRateInfo?.serviceCharges);
                                        const accessorial = safeNumber(getBestRateInfo?.pricing?.accessorial || getBestRateInfo?.accessorialCharges);
                                        const guarantee = getBestRateInfo?.guaranteed ? safeNumber(getBestRateInfo?.pricing?.guarantee || getBestRateInfo?.guaranteeCharge) : 0;
                                        return (freight + fuel + service + accessorial + guarantee).toFixed(2);
                                    })()}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', fontSize: '12px' }}>
                                    {getBestRateInfo?.currency || 'USD'}
                                </Typography>
                            </Paper>
                        </Grid>
                    </Grid>

                    {/* Additional Services Section */}
                    {(() => {
                        const additionalServices = [];

                        // Check for signature service
                        if (shipment?.shipmentInfo?.signatureServiceType && shipment.shipmentInfo.signatureServiceType !== 'none') {
                            additionalServices.push(`Signature Service (${shipment.shipmentInfo.signatureServiceType})`);
                        } else if (shipment?.shipmentInfo?.signatureRequired) {
                            additionalServices.push('Signature Required');
                        }

                        // Check for international shipment
                        if (shipment?.shipmentInfo?.internationalShipment) {
                            additionalServices.push('International Shipment');
                        } else if (shipment?.shipFrom?.country && shipment?.shipTo?.country) {
                            // Also check by comparing countries directly
                            const originCountry = shipment.shipFrom.country;
                            const destinationCountry = shipment.shipTo.country;
                            if (originCountry !== destinationCountry) {
                                additionalServices.push('International Shipment');
                            }
                        }

                        // Check for dangerous goods
                        if (shipment?.shipmentInfo?.dangerousGoodsType && shipment.shipmentInfo.dangerousGoodsType !== 'none') {
                            additionalServices.push(`Dangerous Goods (${shipment.shipmentInfo.dangerousGoodsType})`);
                        }

                        // Check for Saturday delivery
                        if (shipment?.shipmentInfo?.saturdayDelivery) {
                            additionalServices.push('Saturday Delivery');
                        }

                        // Check for hold for pickup
                        if (shipment?.shipmentInfo?.holdForPickup) {
                            additionalServices.push('Hold for Pickup');
                        }

                        // Check for guaranteed service
                        if (getBestRateInfo?.guaranteed) {
                            additionalServices.push('Guaranteed Service');
                        }

                        // Check for insurance/declared value
                        if (shipment?.packages && shipment.packages.length > 0) {
                            const totalDeclaredValue = shipment.packages.reduce((total, pkg) => {
                                return total + (parseFloat(pkg.declaredValue) || 0);
                            }, 0);
                            if (totalDeclaredValue > 0) {
                                additionalServices.push(`Insurance Coverage ($${totalDeclaredValue.toFixed(2)})`);
                            }
                        }

                        // Check for special delivery times
                        if (shipment?.shipmentInfo?.earliestDeliveryTime && shipment?.shipmentInfo?.latestDeliveryTime) {
                            const earliestTime = shipment.shipmentInfo.earliestDeliveryTime;
                            const latestTime = shipment.shipmentInfo.latestDeliveryTime;
                            if (earliestTime !== '09:00' || latestTime !== '17:00') {
                                additionalServices.push(`Delivery Window (${earliestTime} - ${latestTime})`);
                            }
                        }

                        return additionalServices.length > 0 ? (
                            <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid #e0e0e0' }}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, fontSize: '16px' }}>
                                    Additional Services
                                </Typography>
                                <Box component="ul" sx={{
                                    margin: 0,
                                    paddingLeft: 2,
                                    '& li': {
                                        fontSize: '12px',
                                        marginBottom: 0.5,
                                        color: 'text.primary'
                                    }
                                }}>
                                    {additionalServices.map((service, index) => (
                                        <li key={index}>{service}</li>
                                    ))}
                                </Box>
                            </Box>
                        ) : null;
                    })()}

                    {/* Service Options Section */}
                    {getBestRateInfo?.serviceOptions && getBestRateInfo.serviceOptions.length > 0 && (
                        <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid #e0e0e0' }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, fontSize: '16px' }}>
                                Service Options
                            </Typography>
                            <Grid container spacing={2}>
                                {getBestRateInfo.serviceOptions.map((option, index) => (
                                    <Grid item xs={12} sm={6} md={4} key={index}>
                                        <Box sx={{ p: 2, border: '1px solid #e0e0e0', borderRadius: 1, bgcolor: 'background.default' }}>
                                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                                                {option.name || option.serviceName || 'Service Option'}
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
                                                {option.description || 'No description available'}
                                            </Typography>
                                            {option.price && (
                                                <Typography variant="body1" sx={{ mt: 1, fontWeight: 500, fontSize: '12px' }}>
                                                    ${safeNumber(option.price).toFixed(2)}
                                                </Typography>
                                            )}
                                        </Box>
                                    </Grid>
                                ))}
                            </Grid>
                        </Box>
                    )}
                </Box>
            </Paper>
        </Grid>
    );
};

export default RateDetails; 