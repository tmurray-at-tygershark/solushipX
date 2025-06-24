import React from 'react';
import {
    Grid,
    Paper,
    Typography,
    Box,
    Divider,
    Alert
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
    shipment,
    isModal = false,
    showCloseButton = true
}) => {
    const { currentUser } = useAuth();
    const isAdmin = canSeeActualRates(currentUser);

    // Add debugging
    console.log('RateDetails Debug:', {
        isAdmin,
        isQuickShip: shipment?.creationMethod === 'quickship',
        shipment,
        manualRates: shipment?.manualRates
    });

    const safeNumber = (value) => {
        return isNaN(parseFloat(value)) ? 0 : parseFloat(value);
    };

    // Add thousands separator formatting for currency
    const formatCurrency = (amount, showCurrency = false, currency = 'USD') => {
        const num = safeNumber(amount);
        if (showCurrency) {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency
            }).format(num);
        }
        return num.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    // Check if this is a QuickShip shipment
    const isQuickShip = shipment?.creationMethod === 'quickship';

    // For QuickShip, use manual rates data
    const getQuickShipRateData = () => {
        if (!isQuickShip || !shipment?.manualRates) return null;

        const rates = shipment.manualRates;
        const rateData = {
            carrier: shipment?.selectedCarrier || shipment?.carrier || 'N/A',
            service: null, // Hidden for QuickShip
            transitDays: null, // Hidden for QuickShip
            estimatedDeliveryDate: null, // Hidden for QuickShip
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

    // Get markup information for admin users
    const markupSummary = isAdmin && getBestRateInfo ? getMarkupSummary(getBestRateInfo) : null;

    // Check if we have valid rate information
    if (!getBestRateInfo && !quickShipData) {
        return (
            <Paper sx={{ p: 3, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                <Typography variant="body2" color="text.secondary" align="center" sx={{ fontSize: '12px' }}>
                    No rate information available
                </Typography>
            </Paper>
        );
    }

    return (
        <Paper sx={{ p: 3, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, fontSize: '14px' }}>
                Rate Details
            </Typography>

            {/* Admin Markup Summary */}
            {isAdmin && markupSummary?.hasMarkup && (
                <Alert severity="info" sx={{ mb: 2, fontSize: '11px' }}>
                    <Typography sx={{ fontWeight: 600, fontSize: '11px', mb: 1 }}>
                        Markup Applied: ${formatCurrency(markupSummary.markupAmount)} ({markupSummary.markupPercentage.toFixed(1)}%)
                    </Typography>
                    <Typography sx={{ fontSize: '10px' }}>
                        Cost: ${formatCurrency(markupSummary.originalAmount)} →
                        Charge: ${formatCurrency(markupSummary.finalAmount)}
                    </Typography>
                </Alert>
            )}

            {/* Rate Information */}
            <Box sx={{ display: 'grid', gap: 2 }}>
                {/* Carrier Information */}
                <Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500, fontSize: '12px' }}>
                        Carrier
                    </Typography>
                    <Typography variant="body1" sx={{ fontSize: '12px' }}>
                        {quickShipData?.carrier || getBestRateInfo?.carrier?.name || getBestRateInfo?.carrier || 'N/A'}
                    </Typography>
                </Box>

                {/* Service Level (Hidden for QuickShip) */}
                {!isQuickShip && (
                    <Box>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500, fontSize: '12px' }}>
                            Service Level
                        </Typography>
                        <Typography variant="body1" sx={{ fontSize: '12px' }}>
                            {getBestRateInfo?.service?.name || getBestRateInfo?.service || 'Standard'}
                        </Typography>
                    </Box>
                )}

                {/* Transit Time (Hidden for QuickShip) */}
                {!isQuickShip && (
                    <Box>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500, fontSize: '12px' }}>
                            Estimated Transit Time
                        </Typography>
                        <Typography variant="body1" sx={{ fontSize: '12px' }}>
                            {getBestRateInfo?.transitDays || getBestRateInfo?.transit?.days || 'N/A'} business days
                        </Typography>
                    </Box>
                )}

                {/* Estimated Delivery Date (Hidden for QuickShip) */}
                {!isQuickShip && (
                    <Box>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500, fontSize: '12px' }}>
                            Estimated Delivery
                        </Typography>
                        <Typography variant="body1" sx={{ fontSize: '12px' }}>
                            {getBestRateInfo?.estimatedDeliveryDate || getBestRateInfo?.transit?.estimatedDelivery
                                ? new Date(getBestRateInfo.estimatedDeliveryDate || getBestRateInfo.transit.estimatedDelivery).toLocaleDateString()
                                : 'N/A'}
                        </Typography>
                    </Box>
                )}

                <Divider />

                {/* Rate Breakdown */}
                <Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500, mb: 1, fontSize: '12px' }}>
                        Rate Breakdown
                    </Typography>

                    {quickShipData ? (
                        // QuickShip manual rates
                        <Box sx={{ display: 'grid', gap: 1 }}>
                            {quickShipData.charges.map((charge, index) => (
                                <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                    <Typography variant="body2" sx={{ fontSize: '11px', color: 'text.secondary' }}>
                                        {charge.name}
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600 }}>
                                        {isAdmin ? (
                                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                <Typography sx={{ fontSize: '10px', color: '#374151' }}>
                                                    Cost: ${formatCurrency(charge.amount)}
                                                </Typography>
                                                <Typography sx={{ fontSize: '10px', color: '#059669' }}>
                                                    Charge: ${formatCurrency(charge.amount)} {/* No markup for manual rates */}
                                                </Typography>
                                            </Box>
                                        ) : (
                                            `$${formatCurrency(charge.amount)}`
                                        )}
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                    ) : (
                        // Regular shipment rate breakdown
                        (() => {
                            // Try to get individual charges for breakdown
                            if (getBestRateInfo?.pricing?.breakdown && Array.isArray(getBestRateInfo.pricing.breakdown)) {
                                // Use existing breakdown if available
                                return (
                                    <Box sx={{ display: 'grid', gap: 1 }}>
                                        {getBestRateInfo.pricing.breakdown.map((item, index) => (
                                            <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                                <Typography variant="body2" sx={{ fontSize: '11px', color: 'text.secondary' }}>
                                                    {item.name}
                                                </Typography>
                                                <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                    {isAdmin ? (
                                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                            <Typography sx={{ fontSize: '10px', color: '#374151' }}>
                                                                Cost: ${formatCurrency(item.actualAmount || item.amount)}
                                                            </Typography>
                                                            <Typography sx={{ fontSize: '10px', color: '#059669' }}>
                                                                Charge: ${formatCurrency(item.amount)}
                                                            </Typography>
                                                        </Box>
                                                    ) : (
                                                        `$${formatCurrency(item.amount)}`
                                                    )}
                                                </Typography>
                                            </Box>
                                        ))}
                                    </Box>
                                );
                            }

                            // Build breakdown from individual charges
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

                            if (breakdownItems.length === 0) {
                                return (
                                    <Typography variant="body2" sx={{ fontSize: '11px', color: 'text.secondary', fontStyle: 'italic' }}>
                                        Detailed breakdown not available
                                    </Typography>
                                );
                            }

                            return (
                                <Box sx={{ display: 'grid', gap: 1 }}>
                                    {breakdownItems.map((item, index) => (
                                        <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                            <Typography variant="body2" sx={{ fontSize: '11px', color: item.isMarkup ? '#059669' : 'text.secondary' }}>
                                                {item.name}
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                {isAdmin && !item.isMarkup ? (
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                                        <Typography sx={{ fontSize: '10px', color: '#374151' }}>
                                                            Cost: ${formatCurrency(item.amount)}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '10px', color: '#059669' }}>
                                                            Charge: ${formatCurrency(item.amount)} {/* No individual markup yet */}
                                                        </Typography>
                                                    </Box>
                                                ) : (
                                                    <Typography sx={{ fontSize: '11px', color: item.isMarkup ? '#059669' : 'inherit' }}>
                                                        ${formatCurrency(item.amount)}
                                                    </Typography>
                                                )}
                                            </Typography>
                                        </Box>
                                    ))}
                                </Box>
                            );
                        })()
                    )}
                </Box>

                <Divider />

                {/* Total Amount */}
                <Box>
                    <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500, mb: 1, fontSize: '12px' }}>
                        Total Amount
                    </Typography>

                    {isAdmin ? (
                        // Admin view: Show both cost and charge
                        <>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                <Typography variant="body1" sx={{ fontSize: '12px', color: '#374151' }}>
                                    <span style={{ fontWeight: 500 }}>Cost (Actual):</span>
                                </Typography>
                                <Typography variant="body1" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                    ${(() => {
                                        if (quickShipData) {
                                            return formatCurrency(quickShipData.total);
                                        }
                                        return formatCurrency(markupSummary?.originalAmount || getBestRateInfo?.pricing?.total || getBestRateInfo?.totalCharges || 0);
                                    })()}
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="body1" sx={{ fontSize: '12px', color: '#059669' }}>
                                    <span style={{ fontWeight: 500 }}>Charge (Customer):</span>
                                </Typography>
                                <Typography variant="h4" sx={{ fontWeight: 700, color: '#059669', fontSize: '16px' }}>
                                    ${(() => {
                                        if (quickShipData) {
                                            return formatCurrency(quickShipData.total);
                                        }
                                        return formatCurrency(markupSummary?.finalAmount || getBestRateInfo?.pricing?.total || getBestRateInfo?.totalCharges || 0);
                                    })()}
                                </Typography>
                            </Box>
                        </>
                    ) : (
                        // Customer view: Show only charge
                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#000', textAlign: 'center', fontSize: '18px' }}>
                            ${(() => {
                                // For QuickShip, use the calculated total from manual rates
                                if (isQuickShip && quickShipData) {
                                    return formatCurrency(quickShipData.total);
                                }

                                // Regular shipment logic - show markup rates if available
                                if (getBestRateInfo?.pricing?.total !== undefined) {
                                    return formatCurrency(safeNumber(getBestRateInfo.pricing.total));
                                }
                                if (getBestRateInfo?.totalCharges !== undefined) {
                                    return formatCurrency(safeNumber(getBestRateInfo.totalCharges));
                                }
                                if (getBestRateInfo?.total !== undefined) {
                                    return formatCurrency(safeNumber(getBestRateInfo.total));
                                }
                                const freight = safeNumber(getBestRateInfo?.pricing?.freight || getBestRateInfo?.freightCharge || getBestRateInfo?.freightCharges);
                                const fuel = safeNumber(getBestRateInfo?.pricing?.fuel || getBestRateInfo?.fuelCharge || getBestRateInfo?.fuelCharges);
                                const service = safeNumber(getBestRateInfo?.pricing?.service || getBestRateInfo?.serviceCharges);
                                const accessorial = safeNumber(getBestRateInfo?.pricing?.accessorial || getBestRateInfo?.accessorialCharges);
                                const guarantee = getBestRateInfo?.guaranteed ? safeNumber(getBestRateInfo?.pricing?.guarantee || getBestRateInfo?.guaranteeCharge) : 0;
                                return formatCurrency(freight + fuel + service + accessorial + guarantee);
                            })()}
                        </Typography>
                    )}
                </Box>
            </Box>
        </Paper>
    );
};

export default RateDetails; 