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
    const { currentUser, userRole } = useAuth();
    const isAdmin = canSeeActualRates(currentUser);

    // Debug logging to see role and admin status
    console.log('🔍 RateDetails Debug:', {
        currentUser: currentUser,
        userRole: userRole,
        userRoleFromCurrentUser: currentUser?.role,
        userObject: JSON.stringify(currentUser, null, 2),
        isAdmin: isAdmin,
        canSeeActualRates: canSeeActualRates(currentUser)
    });

    // Enhanced admin check using the userRole from AuthContext
    const enhancedIsAdmin = userRole && (
        ['admin', 'superadmin', 'super_admin'].includes(userRole.toLowerCase())
    );

    console.log('🔍 Enhanced Admin Check:', {
        originalIsAdmin: isAdmin,
        enhancedIsAdmin: enhancedIsAdmin,
        userRole: userRole,
        roleCheck: ['admin', 'superadmin', 'super_admin'].includes(userRole?.toLowerCase())
    });

    // Check if this is a QuickShip shipment
    const isQuickShip = shipment?.creationMethod === 'quickship';

    // Get markup information for admin users
    const markupSummary = enhancedIsAdmin && getBestRateInfo ? getMarkupSummary(getBestRateInfo) : null;

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

    if (!getBestRateInfo && !quickShipData) {
        return null;
    }

    // Calculate total cost and charge for admin display
    const calculateTotals = () => {
        if (quickShipData) {
            return {
                totalCost: quickShipData.total,
                totalCharge: quickShipData.total
            };
        }

        // Use dual rate storage system if available
        if (shipment?.actualRates?.totalCharges && shipment?.markupRates?.totalCharges) {
            return {
                totalCost: shipment.actualRates.totalCharges,
                totalCharge: shipment.markupRates.totalCharges
            };
        }

        // Fallback calculation
        const baseTotal = getBestRateInfo?.pricing?.total ||
            getBestRateInfo?.totalCharges ||
            getBestRateInfo?.total || 0;

        return {
            totalCost: markupSummary?.originalAmount || baseTotal,
            totalCharge: markupSummary?.finalAmount || baseTotal
        };
    };

    const { totalCost, totalCharge } = calculateTotals();

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
                    {enhancedIsAdmin && markupSummary?.hasMarkup && (
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
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                        <Typography variant="body1" sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                            ${charge.amount.toFixed(2)}
                                                        </Typography>
                                                        {enhancedIsAdmin && (
                                                            <Typography variant="body1" sx={{ fontSize: '11px', color: '#059669', fontWeight: 500 }}>
                                                                (Cost: ${charge.amount.toFixed(2)})
                                                            </Typography>
                                                        )}
                                                    </Box>
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
                                                            {detail.hasMarkup && (
                                                                <Typography component="span" sx={{ fontSize: '11px', color: '#059669', fontWeight: 500, ml: 1 }}>
                                                                    (plus {detail.markupPercentage}%)
                                                                </Typography>
                                                            )}
                                                        </Typography>
                                                        <Typography variant="body1" sx={{ fontSize: '12px', fontWeight: 'bold' }}>
                                                            ${safeNumber(detail.amount).toFixed(2)}
                                                        </Typography>
                                                        {enhancedIsAdmin && (
                                                            <Typography variant="body1" sx={{ fontSize: '11px', color: '#059669', fontWeight: 500 }}>
                                                                (Cost: ${safeNumber(detail.actualAmount || detail.amount).toFixed(2)})
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                ))}
                                            </Box>
                                        );
                                    }
                                }

                                // Get actual vs markup rates for breakdown calculation
                                const getActualVsMarkupAmount = (field) => {
                                    if (shipment?.actualRates?.billingDetails && shipment?.markupRates?.billingDetails) {
                                        const actualDetail = shipment.actualRates.billingDetails.find(detail =>
                                            detail.name && (
                                                detail.name.toLowerCase().includes(field.toLowerCase()) ||
                                                detail.category === field
                                            )
                                        );
                                        const markupDetail = shipment.markupRates.billingDetails.find(detail =>
                                            detail.name && (
                                                detail.name.toLowerCase().includes(field.toLowerCase()) ||
                                                detail.category === field
                                            )
                                        );

                                        if (actualDetail && markupDetail) {
                                            return {
                                                actual: actualDetail.amount,
                                                markup: markupDetail.amount
                                            };
                                        }
                                    }

                                    // Fallback to same amount for both
                                    const fallbackAmount = safeNumber(getBestRateInfo?.pricing?.[field] || getBestRateInfo?.[field + 'Charge'] || getBestRateInfo?.[field + 'Charges']);
                                    return {
                                        actual: fallbackAmount,
                                        markup: fallbackAmount
                                    };
                                };

                                const breakdownItems = [];
                                const freight = getActualVsMarkupAmount('freight');
                                if (freight.markup > 0) {
                                    breakdownItems.push({ name: 'Freight Charges', amount: freight.markup, actualAmount: freight.actual });
                                }

                                const fuel = getActualVsMarkupAmount('fuel');
                                if (fuel.markup > 0) {
                                    breakdownItems.push({ name: 'Fuel Charges', amount: fuel.markup, actualAmount: fuel.actual });
                                }

                                const service = getActualVsMarkupAmount('service');
                                if (service.markup > 0) {
                                    breakdownItems.push({ name: 'Service Charges', amount: service.markup, actualAmount: service.actual });
                                }

                                const accessorial = getActualVsMarkupAmount('accessorial');
                                if (accessorial.markup > 0) {
                                    breakdownItems.push({ name: 'Accessorial Charges', amount: accessorial.markup, actualAmount: accessorial.actual });
                                }

                                if (getBestRateInfo?.guaranteed) {
                                    const guarantee = getActualVsMarkupAmount('guarantee');
                                    if (guarantee.markup > 0) {
                                        breakdownItems.push({ name: 'Guarantee Charge', amount: guarantee.markup, actualAmount: guarantee.actual });
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
                                                        {item.hasMarkup && (
                                                            <Typography component="span" sx={{ fontSize: '11px', color: '#059669', fontWeight: 500, ml: 1 }}>
                                                                (plus {item.markupPercentage || item.value}%)
                                                            </Typography>
                                                        )}
                                                    </Typography>
                                                    <Typography variant="body1" sx={{ fontSize: '12px', fontWeight: 'bold' }}>
                                                        ${safeNumber(item.amount).toFixed(2)}
                                                    </Typography>
                                                    {enhancedIsAdmin && !item.isMarkup && (
                                                        <Typography variant="body1" sx={{ fontSize: '11px', color: '#059669', fontWeight: 500 }}>
                                                            (Cost: ${(item.actualAmount || item.amount).toFixed(2)})
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
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                <Typography variant="body1" sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                    ${(getBestRateInfo?.pricing?.freight ||
                                                        getBestRateInfo?.freightCharge ||
                                                        getBestRateInfo?.freightCharges || 0).toFixed(2)}
                                                </Typography>
                                                {enhancedIsAdmin && (
                                                    <Typography variant="body1" sx={{ fontSize: '11px', color: '#059669', fontWeight: 500 }}>
                                                        (Cost: ${(getBestRateInfo?.pricing?.freight ||
                                                            getBestRateInfo?.freightCharge ||
                                                            getBestRateInfo?.freightCharges || 0).toFixed(2)})
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Box>
                                        <Box>
                                            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                Fuel Charges
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                <Typography variant="body1" sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                    ${(getBestRateInfo?.pricing?.fuel ||
                                                        getBestRateInfo?.fuelCharge ||
                                                        getBestRateInfo?.fuelCharges || 0).toFixed(2)}
                                                </Typography>
                                                {enhancedIsAdmin && (
                                                    <Typography variant="body1" sx={{ fontSize: '11px', color: '#059669', fontWeight: 500 }}>
                                                        (Cost: ${(getBestRateInfo?.pricing?.fuel ||
                                                            getBestRateInfo?.fuelCharge ||
                                                            getBestRateInfo?.fuelCharges || 0).toFixed(2)})
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Box>
                                        <Box>
                                            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                Service Charges
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                                <Typography variant="body1" sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                    ${(getBestRateInfo?.pricing?.service ||
                                                        getBestRateInfo?.serviceCharges || 0).toFixed(2)}
                                                </Typography>
                                                {enhancedIsAdmin && (
                                                    <Typography variant="body1" sx={{ fontSize: '11px', color: '#059669', fontWeight: 500 }}>
                                                        (Cost: ${(getBestRateInfo?.pricing?.service ||
                                                            getBestRateInfo?.serviceCharges || 0).toFixed(2)})
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Box>
                                    </Box>
                                );
                            })()}
                        </Grid>

                        {/* Right Column - Total */}
                        <Grid item xs={12} md={4}>
                            <Paper elevation={1} sx={{ p: 2, textAlign: 'center', border: '1px solid #e5e7eb' }}>
                                <Typography variant="subtitle1" color="text.secondary" sx={{ fontWeight: 500, mb: 1 }}>
                                    Total
                                </Typography>
                                {enhancedIsAdmin ? (
                                    <Box>
                                        <Typography variant="body1" sx={{ fontSize: '14px', color: '#059669', fontWeight: 500, mb: 1 }}>
                                            Cost: ${safeNumber(totalCost).toFixed(2)}
                                        </Typography>
                                        <Typography variant="h6" sx={{ fontSize: '20px', fontWeight: 'bold', mb: 0.5 }}>
                                            ${safeNumber(totalCharge).toFixed(2)}
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '14px', color: 'text.secondary' }}>
                                            Customer Charge
                                        </Typography>
                                    </Box>
                                ) : (
                                    <Typography variant="h6" sx={{ fontSize: '20px', fontWeight: 'bold' }}>
                                        ${safeNumber(totalCharge).toFixed(2)}
                                    </Typography>
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