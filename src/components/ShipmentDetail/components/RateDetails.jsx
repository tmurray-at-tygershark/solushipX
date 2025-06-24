import React from 'react';
import {
    Grid,
    Paper,
    Typography,
    Box
} from '@mui/material';
import { useAuth } from '../../../contexts/AuthContext';
import { canSeeActualRates, getMarkupSummary } from '../../../utils/markupEngine';

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
    const { currentUser } = useAuth();
    const isAdmin = canSeeActualRates(currentUser);

    // Check if this is a QuickShip shipment
    const isQuickShip = shipment?.creationMethod === 'quickship';

    // Get markup information for admin users
    const markupSummary = isAdmin && getBestRateInfo ? getMarkupSummary(getBestRateInfo) : null;

    const safeNumber = (value) => {
        return isNaN(parseFloat(value)) ? 0 : parseFloat(value);
    };

    // For QuickShip, use manual rates data
    const getQuickShipRateData = () => {
        if (!isQuickShip || !shipment?.manualRates) return null;

        const rates = shipment.manualRates;
        const rateData = {
            carrier: shipment?.selectedCarrier || shipment?.carrier || 'N/A',
            charges: [],
            total: 0,
            currency: 'CAD'
        };

        // Process manual rate line items
        rates.forEach(rate => {
            if (rate.chargeName && rate.charge) {
                const amount = safeNumber(rate.charge);
                rateData.charges.push({
                    name: rate.chargeName,
                    amount: amount
                });
                rateData.total += amount;
            }
        });

        return rateData;
    };

    const quickShipData = isQuickShip ? getQuickShipRateData() : null;

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
                    {/* Admin Markup Summary */}
                    {isAdmin && markupSummary?.hasMarkup && (
                        <Box sx={{
                            mb: 3,
                            p: 2,
                            backgroundColor: '#eff6ff',
                            border: '1px solid #3b82f6',
                            borderRadius: 1
                        }}>
                            <Typography sx={{ fontWeight: 600, fontSize: '14px', mb: 1, color: '#1e40af' }}>
                                Markup Applied: ${markupSummary.markupAmount.toFixed(2)} ({markupSummary.markupPercentage.toFixed(1)}%)
                            </Typography>
                            <Typography sx={{ fontSize: '13px', color: '#374151' }}>
                                Original Cost: ${markupSummary.originalAmount.toFixed(2)} →
                                Customer Charge: ${markupSummary.finalAmount.toFixed(2)}
                            </Typography>
                        </Box>
                    )}

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
                                            carrierName={quickShipData?.carrier || getBestRateInfo?.carrier?.name || getBestRateInfo?.carrier}
                                            carrierData={carrierData}
                                            size="small"
                                            isIntegrationCarrier={!isQuickShip && (getBestRateInfo?.displayCarrierId === 'ESHIPPLUS' || getBestRateInfo?.sourceCarrierName === 'eShipPlus')}
                                        />
                                        {!isQuickShip && getBestRateInfo?.service && (
                                            <>
                                                <Typography variant="body2" color="text.secondary">-</Typography>
                                                <Typography variant="body1" sx={{ fontWeight: 500, fontSize: '12px' }}>
                                                    {getBestRateInfo.service}
                                                </Typography>
                                            </>
                                        )}
                                    </Box>
                                </Box>
                                {!isQuickShip && (
                                    <Box>
                                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                            Transit Time
                                        </Typography>
                                        <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                            {getBestRateInfo?.transitDays || 0} {getBestRateInfo?.transitDays === 1 ? 'day' : 'days'}
                                        </Typography>
                                    </Box>
                                )}
                                {!isQuickShip && (
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
                                )}
                            </Box>
                        </Grid>

                        {/* Middle Column - Charges */}
                        <Grid item xs={12} md={4}>
                            {(() => {
                                // QuickShip manual rates
                                if (quickShipData && quickShipData.charges.length > 0) {
                                    return (
                                        <Box sx={{ display: 'grid', gap: 2 }}>
                                            {quickShipData.charges.map((charge, index) => (
                                                <Box key={index}>
                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                        {charge.name}
                                                    </Typography>
                                                    {isAdmin ? (
                                                        <Box>
                                                            <Typography variant="body1" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                                Cost: ${charge.amount.toFixed(2)}
                                                            </Typography>
                                                            <Typography variant="body1" sx={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>
                                                                Charge: ${charge.amount.toFixed(2)}
                                                            </Typography>
                                                        </Box>
                                                    ) : (
                                                        <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                                            ${charge.amount.toFixed(2)}
                                                        </Typography>
                                                    )}
                                                </Box>
                                            ))}
                                        </Box>
                                    );
                                }

                                // Regular shipment rates
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
                                                        {isAdmin ? (
                                                            <Box>
                                                                <Typography variant="body1" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                                    Cost: ${safeNumber(detail.amount).toFixed(2)}
                                                                </Typography>
                                                                <Typography variant="body1" sx={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>
                                                                    Charge: ${safeNumber(detail.amount).toFixed(2)}
                                                                </Typography>
                                                            </Box>
                                                        ) : (
                                                            <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                                                ${safeNumber(detail.amount).toFixed(2)}
                                                            </Typography>
                                                        )}
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

                                if (markupSummary?.hasMarkup) {
                                    breakdownItems.push({
                                        name: 'Platform Markup',
                                        amount: markupSummary.markupAmount,
                                        isMarkup: true
                                    });
                                }

                                if (breakdownItems.length > 0) {
                                    return (
                                        <Box sx={{ display: 'grid', gap: 2 }}>
                                            {breakdownItems.map((item, index) => (
                                                <Box key={index}>
                                                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                        {item.name}
                                                    </Typography>
                                                    {isAdmin && !item.isMarkup ? (
                                                        <Box>
                                                            <Typography variant="body1" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                                Cost: ${item.amount.toFixed(2)}
                                                            </Typography>
                                                            <Typography variant="body1" sx={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>
                                                                Charge: ${item.amount.toFixed(2)}
                                                            </Typography>
                                                        </Box>
                                                    ) : (
                                                        <Typography variant="body1" sx={{ fontSize: '12px', color: item.isMarkup ? '#059669' : 'inherit' }}>
                                                            ${item.amount.toFixed(2)}
                                                        </Typography>
                                                    )}
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
                                            {isAdmin ? (
                                                <Box>
                                                    <Typography variant="body1" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                        Cost: ${(getBestRateInfo?.pricing?.freight ||
                                                            getBestRateInfo?.freightCharge ||
                                                            getBestRateInfo?.freightCharges || 0).toFixed(2)}
                                                    </Typography>
                                                    <Typography variant="body1" sx={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>
                                                        Charge: ${(getBestRateInfo?.pricing?.freight ||
                                                            getBestRateInfo?.freightCharge ||
                                                            getBestRateInfo?.freightCharges || 0).toFixed(2)}
                                                    </Typography>
                                                </Box>
                                            ) : (
                                                <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                                    ${(getBestRateInfo?.pricing?.freight ||
                                                        getBestRateInfo?.freightCharge ||
                                                        getBestRateInfo?.freightCharges || 0).toFixed(2)}
                                                </Typography>
                                            )}
                                        </Box>
                                        <Box>
                                            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                Fuel Charges
                                            </Typography>
                                            {isAdmin ? (
                                                <Box>
                                                    <Typography variant="body1" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                        Cost: ${(getBestRateInfo?.pricing?.fuel ||
                                                            getBestRateInfo?.fuelCharge ||
                                                            getBestRateInfo?.fuelCharges || 0).toFixed(2)}
                                                    </Typography>
                                                    <Typography variant="body1" sx={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>
                                                        Charge: ${(getBestRateInfo?.pricing?.fuel ||
                                                            getBestRateInfo?.fuelCharge ||
                                                            getBestRateInfo?.fuelCharges || 0).toFixed(2)}
                                                    </Typography>
                                                </Box>
                                            ) : (
                                                <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                                    ${(getBestRateInfo?.pricing?.fuel ||
                                                        getBestRateInfo?.fuelCharge ||
                                                        getBestRateInfo?.fuelCharges || 0).toFixed(2)}
                                                </Typography>
                                            )}
                                        </Box>
                                        <Box>
                                            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                Service Charges
                                            </Typography>
                                            {isAdmin ? (
                                                <Box>
                                                    <Typography variant="body1" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                        Cost: ${(getBestRateInfo?.pricing?.service ||
                                                            getBestRateInfo?.serviceCharges || 0).toFixed(2)}
                                                    </Typography>
                                                    <Typography variant="body1" sx={{ fontSize: '12px', color: '#059669', fontWeight: 600 }}>
                                                        Charge: ${(getBestRateInfo?.pricing?.service ||
                                                            getBestRateInfo?.serviceCharges || 0).toFixed(2)}
                                                    </Typography>
                                                </Box>
                                            ) : (
                                                <Typography variant="body1" sx={{ fontSize: '12px' }}>
                                                    ${(getBestRateInfo?.pricing?.service ||
                                                        getBestRateInfo?.serviceCharges || 0).toFixed(2)}
                                                </Typography>
                                            )}
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
                                {isAdmin ? (
                                    // Admin view: Show both cost and charge
                                    <>
                                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, textAlign: 'center' }}>
                                            Total Amount Summary
                                        </Typography>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            <Box sx={{ textAlign: 'center', p: 1, backgroundColor: '#f3f4f6', borderRadius: 1 }}>
                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 0.5 }}>
                                                    Cost (Actual)
                                                </Typography>
                                                <Typography variant="h5" sx={{ fontWeight: 700, color: '#374151' }}>
                                                    ${(() => {
                                                        if (quickShipData) {
                                                            return quickShipData.total.toFixed(2);
                                                        }
                                                        // Use dual rate storage system if available
                                                        if (shipment?.actualRates?.totalCharges) {
                                                            return shipment.actualRates.totalCharges.toFixed(2);
                                                        }
                                                        // Fallback to markup summary or rate info
                                                        return (markupSummary?.originalAmount || getBestRateInfo?.pricing?.total || getBestRateInfo?.totalCharges || 0).toFixed(2);
                                                    })()}
                                                </Typography>
                                            </Box>
                                            <Box sx={{ textAlign: 'center', p: 1, backgroundColor: '#dcfce7', borderRadius: 1 }}>
                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#059669', mb: 0.5 }}>
                                                    Charge (Customer)
                                                </Typography>
                                                <Typography variant="h5" sx={{ fontWeight: 700, color: '#059669' }}>
                                                    ${(() => {
                                                        if (quickShipData) {
                                                            return quickShipData.total.toFixed(2);
                                                        }
                                                        // Use dual rate storage system if available
                                                        if (shipment?.markupRates?.totalCharges) {
                                                            return shipment.markupRates.totalCharges.toFixed(2);
                                                        }
                                                        // Fallback to markup summary or rate info
                                                        return (markupSummary?.finalAmount || getBestRateInfo?.pricing?.total || getBestRateInfo?.totalCharges || 0).toFixed(2);
                                                    })()}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </>
                                ) : (
                                    // Customer view: Show only charge
                                    <>
                                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600, textAlign: 'center' }}>
                                            Total Charges
                                        </Typography>
                                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#000', textAlign: 'center' }}>
                                            ${(() => {
                                                // For QuickShip, use the calculated total from manual rates
                                                if (isQuickShip && quickShipData) {
                                                    return quickShipData.total.toFixed(2);
                                                }

                                                // Regular shipment logic
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
                                            {quickShipData?.currency || getBestRateInfo?.currency || 'USD'}
                                        </Typography>
                                    </>
                                )}
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