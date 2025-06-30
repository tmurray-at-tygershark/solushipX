import React from 'react';
import {
    Grid,
    Paper,
    Typography,
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Divider
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
            totalCost: 0,
            currency: 'CAD'
        };

        // Process manual rate line items with separate cost and charge
        rates.forEach(rate => {
            if (rate.chargeName && (rate.charge || rate.cost)) {
                const chargeAmount = safeNumber(rate.charge || 0);
                const costAmount = safeNumber(rate.cost || 0);

                rateData.charges.push({
                    name: rate.chargeName,
                    amount: chargeAmount,
                    cost: costAmount
                });
                rateData.total += chargeAmount;
                rateData.totalCost += costAmount;
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
                totalCost: quickShipData.totalCost,
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

    // Get rate breakdown data for table
    const getRateBreakdown = () => {
        const breakdown = [];

        if (quickShipData && quickShipData.charges.length > 0) {
            // QuickShip manual rates
            quickShipData.charges.forEach(charge => {
                breakdown.push({
                    description: charge.name,
                    amount: charge.amount,
                    cost: charge.cost
                });
            });
        } else if (getBestRateInfo?.billingDetails && Array.isArray(getBestRateInfo.billingDetails) && getBestRateInfo.billingDetails.length > 0) {
            // Regular shipment rates with billingDetails
            const validDetails = getBestRateInfo.billingDetails.filter(detail =>
                detail &&
                detail.name &&
                (detail.amount !== undefined && detail.amount !== null)
            );

            validDetails.forEach(detail => {
                breakdown.push({
                    description: detail.name,
                    amount: safeNumber(detail.amount),
                    cost: safeNumber(detail.actualAmount || detail.amount)
                });
            });
        } else {
            // Fallback to basic rate structure
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

            const freight = getActualVsMarkupAmount('freight');
            if (freight.markup > 0) {
                breakdown.push({
                    description: 'Freight Charges',
                    amount: freight.markup,
                    cost: freight.actual
                });
            }

            const fuel = getActualVsMarkupAmount('fuel');
            if (fuel.markup > 0) {
                breakdown.push({
                    description: 'Fuel Charges',
                    amount: fuel.markup,
                    cost: fuel.actual
                });
            }

            const service = getActualVsMarkupAmount('service');
            if (service.markup > 0) {
                breakdown.push({
                    description: 'Service Charges',
                    amount: service.markup,
                    cost: service.actual
                });
            }

            const accessorial = getActualVsMarkupAmount('accessorial');
            if (accessorial.markup > 0) {
                breakdown.push({
                    description: 'Accessorial Charges',
                    amount: accessorial.markup,
                    cost: accessorial.actual
                });
            }

            if (getBestRateInfo?.guaranteed) {
                const guarantee = getActualVsMarkupAmount('guarantee');
                if (guarantee.markup > 0) {
                    breakdown.push({
                        description: 'Guarantee Charge',
                        amount: guarantee.markup,
                        cost: guarantee.actual
                    });
                }
            }
        }

        // Add markup as separate line item for admin users
        if (enhancedIsAdmin && markupSummary?.hasMarkup) {
            breakdown.push({
                description: 'Platform Markup',
                amount: markupSummary.markupAmount,
                cost: 0,
                isMarkup: true
            });
        }

        return breakdown;
    };

    const rateBreakdown = getRateBreakdown();

    // Get service information
    const getServiceInfo = () => {
        const info = {};

        info.carrier = quickShipData?.carrier || getBestRateInfo?.carrier?.name || getBestRateInfo?.carrier || 'N/A';
        info.service = !isQuickShip && getBestRateInfo?.service ? getBestRateInfo.service : 'N/A';
        info.transitTime = !isQuickShip && getBestRateInfo?.transitDays ?
            `${getBestRateInfo.transitDays} ${getBestRateInfo.transitDays === 1 ? 'day' : 'days'}` : 'N/A';

        // Get delivery date
        if (!isQuickShip) {
            const deliveryDate =
                shipment?.carrierBookingConfirmation?.estimatedDeliveryDate ||
                getBestRateInfo?.transit?.estimatedDelivery ||
                getBestRateInfo?.estimatedDeliveryDate;

            if (deliveryDate) {
                try {
                    const date = deliveryDate.toDate ? deliveryDate.toDate() : new Date(deliveryDate);
                    info.estimatedDelivery = date.toLocaleDateString('en-US', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                    });
                } catch (error) {
                    info.estimatedDelivery = 'Invalid Date';
                }
            } else {
                info.estimatedDelivery = 'N/A';
            }
        } else {
            info.estimatedDelivery = 'N/A';
        }

        info.isIntegrationCarrier = !isQuickShip && (getBestRateInfo?.displayCarrierId === 'ESHIPPLUS' || getBestRateInfo?.sourceCarrierName === 'eShipPlus');

        return info;
    };

    const serviceInfo = getServiceInfo();

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

                    {/* Service Information Table */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, fontSize: '14px' }}>
                            Service Information
                        </Typography>
                        <TableContainer>
                            <Table size="small" sx={{ border: '1px solid #e0e0e0' }}>
                                <TableBody>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px', width: '30%', bgcolor: '#f8fafc' }}>
                                            Carrier
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <CarrierDisplay
                                                carrierName={serviceInfo.carrier}
                                                carrierData={carrierData}
                                                size="small"
                                                isIntegrationCarrier={serviceInfo.isIntegrationCarrier}
                                            />
                                        </TableCell>
                                    </TableRow>
                                    {serviceInfo.service !== 'N/A' && (
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>
                                                Service
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                {serviceInfo.service}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {serviceInfo.transitTime !== 'N/A' && (
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>
                                                Transit Time
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                {serviceInfo.transitTime}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                    {serviceInfo.estimatedDelivery !== 'N/A' && (
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>
                                                Estimated Delivery
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                {serviceInfo.estimatedDelivery}
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>

                    {/* Rate Breakdown Table */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, fontSize: '14px' }}>
                            Rate Breakdown
                        </Typography>
                        <TableContainer>
                            <Table size="small" sx={{ border: '1px solid #e0e0e0' }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>
                                            Description
                                        </TableCell>
                                        {enhancedIsAdmin && (
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'right' }}>
                                                Cost
                                            </TableCell>
                                        )}
                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'right' }}>
                                            {enhancedIsAdmin ? 'Charge' : 'Amount'}
                                        </TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {rateBreakdown.map((item, index) => (
                                        <TableRow key={index}>
                                            <TableCell sx={{ fontSize: '12px' }}>
                                                {item.description}
                                                {item.isMarkup && (
                                                    <Chip
                                                        label="Markup"
                                                        size="small"
                                                        sx={{
                                                            ml: 1,
                                                            fontSize: '10px',
                                                            height: '20px',
                                                            backgroundColor: '#3b82f6',
                                                            color: 'white'
                                                        }}
                                                    />
                                                )}
                                            </TableCell>
                                            {enhancedIsAdmin && (
                                                <TableCell sx={{ fontSize: '12px', textAlign: 'right', color: '#059669', fontWeight: 500 }}>
                                                    {!item.isMarkup ? `$${safeNumber(item.cost).toFixed(2)}` : '-'}
                                                </TableCell>
                                            )}
                                            <TableCell sx={{ fontSize: '12px', textAlign: 'right', fontWeight: 600 }}>
                                                ${safeNumber(item.amount).toFixed(2)}
                                            </TableCell>
                                        </TableRow>
                                    ))}

                                    {/* Total Row */}
                                    <TableRow sx={{ borderTop: '2px solid #e0e0e0' }}>
                                        <TableCell sx={{ fontSize: '14px', fontWeight: 700 }}>
                                            TOTAL
                                        </TableCell>
                                        {enhancedIsAdmin && (
                                            <TableCell sx={{ fontSize: '14px', textAlign: 'right', color: '#059669', fontWeight: 700 }}>
                                                ${safeNumber(totalCost).toFixed(2)}
                                            </TableCell>
                                        )}
                                        <TableCell sx={{ fontSize: '14px', textAlign: 'right', fontWeight: 700 }}>
                                            ${safeNumber(totalCharge).toFixed(2)}
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>

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
                            <Box>
                                <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, fontSize: '14px' }}>
                                    Additional Services
                                </Typography>
                                <TableContainer>
                                    <Table size="small" sx={{ border: '1px solid #e0e0e0' }}>
                                        <TableBody>
                                            {additionalServices.map((service, index) => (
                                                <TableRow key={index}>
                                                    <TableCell sx={{ fontSize: '12px', py: 1 }}>
                                                        {service}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </TableContainer>
                            </Box>
                        ) : null;
                    })()}
                </Box>
            </Paper>
        </Grid>
    );
};

export default RateDetails; 