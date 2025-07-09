import React, { useState, useCallback } from 'react';
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
    Divider,
    TextField,
    IconButton,
    Tooltip,
    Button,
    FormControl,
    Select,
    MenuItem
} from '@mui/material';
import {
    Edit as EditIcon,
    Save as SaveIcon,
    Cancel as CancelIcon,
    Add as AddIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';
import { useAuth } from '../../../contexts/AuthContext';
import { canSeeActualRates, getMarkupSummary } from '../../../utils/markupEngine';

// Rate code options (same as QuickShip.jsx)
const RATE_CODE_OPTIONS = [
    { value: 'FRT', label: 'FRT', description: 'Freight' },
    { value: 'ACC', label: 'ACC', description: 'Accessorial' },
    { value: 'FUE', label: 'FUE', description: 'Fuel Surcharge' },
    { value: 'MSC', label: 'MSC', description: 'Miscellaneous' },
    { value: 'LOG', label: 'LOG', description: 'Logistics Service' },
    { value: 'IC LOG', label: 'IC LOG', description: 'Logistics Service' },
    { value: 'SUR', label: 'SUR', description: 'Surcharge' },
    { value: 'IC SUR', label: 'IC SUR', description: 'Surcharge' },
    { value: 'HST', label: 'HST', description: 'Harmonized Sales Tax' },
    { value: 'HST ON', label: 'HST ON', description: 'Harmonized Sales Tax - ON' },
    { value: 'HST BC', label: 'HST BC', description: 'Harmonized Sales Tax - BC' },
    { value: 'HST NB', label: 'HST NB', description: 'Harmonized Sales Tax - NB' },
    { value: 'HST NF', label: 'HST NF', description: 'Harmonized Sales Tax - NF' },
    { value: 'HST NS', label: 'HST NS', description: 'Harmonized Sales Tax - NS' },
    { value: 'GST', label: 'GST', description: 'Goods and Sales Tax' },
    { value: 'QST', label: 'QST', description: 'Quebec Sales Tax' },
    { value: 'HST PE', label: 'HST PE', description: 'Harmonized Sales Tax - PEI' },
    { value: 'GOVT', label: 'GOVT', description: 'Customs Taxes' },
    { value: 'GOVD', label: 'GOVD', description: 'Customs Duty' },
    { value: 'GSTIMP', label: 'GSTIMP', description: 'Customs Taxes' },
    { value: 'CLAIMS', label: 'CLAIMS', description: 'Claims Refund' }
];

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
    onChargesUpdate = () => { }
}) => {
    const { currentUser, userRole } = useAuth();
    const isAdmin = canSeeActualRates(currentUser);

    // State for inline editing
    const [editingIndex, setEditingIndex] = useState(null);
    const [editingValues, setEditingValues] = useState({});
    const [localRateBreakdown, setLocalRateBreakdown] = useState([]);

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

        // Get currency from shipment data with proper priority
        const getCurrencyFromShipment = () => {
            // 1. Check shipment.currency first
            if (shipment?.currency) return shipment.currency;

            // 2. Check first manual rate's currency
            if (rates?.[0]?.chargeCurrency) return rates[0].chargeCurrency;

            // 3. Check any manual rate's currency
            for (const rate of rates) {
                if (rate?.chargeCurrency) return rate.chargeCurrency;
            }

            // 4. Fallback to CAD
            return 'CAD';
        };

        const rateData = {
            carrier: shipment?.selectedCarrier || shipment?.carrier || 'N/A',
            charges: [],
            total: 0,
            totalCost: 0,
            currency: getCurrencyFromShipment()
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

    // Inline editing functions - moved above early return to satisfy React hooks rules
    const handleEditStart = useCallback((index, item) => {
        setEditingIndex(index);
        setEditingValues({
            description: item.description,
            cost: item.cost?.toString() || '0',
            amount: item.amount?.toString() || '0',
            code: item.code || 'FRT'
        });
    }, []);

    const handleEditCancel = useCallback(() => {
        setEditingIndex(null);
        setEditingValues({});
    }, []);

    const handleEditSave = useCallback((index) => {
        const updatedBreakdown = [...localRateBreakdown];
        updatedBreakdown[index] = {
            ...updatedBreakdown[index],
            description: editingValues.description,
            cost: parseFloat(editingValues.cost) || 0,
            amount: parseFloat(editingValues.amount) || 0,
            code: editingValues.code
        };

        setLocalRateBreakdown(updatedBreakdown);
        setEditingIndex(null);
        setEditingValues({});

        // Notify parent component of changes
        onChargesUpdate(updatedBreakdown);
    }, [editingValues, localRateBreakdown, onChargesUpdate]);

    const handleAddCharge = useCallback(() => {
        const newCharge = {
            description: 'New Charge',
            cost: 0,
            amount: 0,
            code: 'FRT',
            isNew: true
        };

        const updatedBreakdown = [...localRateBreakdown, newCharge];
        setLocalRateBreakdown(updatedBreakdown);
        setEditingIndex(updatedBreakdown.length - 1);
        setEditingValues({
            description: 'New Charge',
            cost: '0',
            amount: '0',
            code: 'FRT'
        });
    }, [localRateBreakdown]);

    const handleDeleteCharge = useCallback((index) => {
        const updatedBreakdown = localRateBreakdown.filter((_, i) => i !== index);
        setLocalRateBreakdown(updatedBreakdown);
        onChargesUpdate(updatedBreakdown);
    }, [localRateBreakdown, onChargesUpdate]);

    const handleInputChange = useCallback((field, value) => {
        setEditingValues(prev => ({
            ...prev,
            [field]: value
        }));
    }, []);

    // Calculate totals from local breakdown
    const calculateLocalTotals = useCallback(() => {
        const totalCost = localRateBreakdown.reduce((sum, item) => sum + (parseFloat(item.cost) || 0), 0);
        const totalCharge = localRateBreakdown.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        return { totalCost, totalCharge };
    }, [localRateBreakdown]);

    // Initialize local rate breakdown when component loads or data changes - moved above early return
    React.useEffect(() => {
        const rateBreakdown = getRateBreakdown();
        setLocalRateBreakdown(rateBreakdown);
    }, [JSON.stringify(getBestRateInfo), JSON.stringify(quickShipData), enhancedIsAdmin, markupSummary]);

    if (!getBestRateInfo && !quickShipData) {
        return null;
    }

    // Get currency from multiple sources with CAD as default
    const getCurrency = () => {
        // Priority order for currency detection
        return quickShipData?.currency ||
            getBestRateInfo?.currency ||
            shipment?.currency ||
            shipment?.billingCurrency ||
            'CAD'; // Default to CAD
    };

    const currency = getCurrency();
    const currencySymbol = currency === 'USD' ? 'USD$' : 'CAD$';

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
            // QuickShip manual rates - get codes from original manualRates
            quickShipData.charges.forEach((charge, index) => {
                const originalRate = shipment?.manualRates?.[index];
                breakdown.push({
                    description: charge.name,
                    amount: charge.amount,
                    cost: charge.cost,
                    code: originalRate?.code || 'FRT'
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
                // Map description to likely charge code
                const getChargeCode = (name) => {
                    const lowerName = name.toLowerCase();
                    if (lowerName.includes('freight')) return 'FRT';
                    if (lowerName.includes('fuel')) return 'FUE';
                    if (lowerName.includes('accessorial')) return 'ACC';
                    if (lowerName.includes('hst') || lowerName.includes('tax')) return 'HST';
                    if (lowerName.includes('gst')) return 'GST';
                    if (lowerName.includes('surcharge')) return 'SUR';
                    return 'MSC'; // Default to miscellaneous
                };

                breakdown.push({
                    description: detail.name,
                    amount: safeNumber(detail.amount),
                    cost: safeNumber(detail.actualAmount || detail.amount),
                    code: detail.code || getChargeCode(detail.name)
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
            // Always show freight charges, even if $0.00
            breakdown.push({
                description: 'Freight Charges',
                amount: freight.markup,
                cost: freight.actual,
                code: 'FRT'
            });

            const fuel = getActualVsMarkupAmount('fuel');
            // Always show fuel charges, even if $0.00
            breakdown.push({
                description: 'Fuel Charges',
                amount: fuel.markup,
                cost: fuel.actual,
                code: 'FUE'
            });

            const service = getActualVsMarkupAmount('service');
            // Always show service charges, even if $0.00
            breakdown.push({
                description: 'Service Charges',
                amount: service.markup,
                cost: service.actual,
                code: 'MSC'
            });

            const accessorial = getActualVsMarkupAmount('accessorial');
            // Always show accessorial charges, even if $0.00
            breakdown.push({
                description: 'Accessorial Charges',
                amount: accessorial.markup,
                cost: accessorial.actual,
                code: 'ACC'
            });

            if (getBestRateInfo?.guaranteed) {
                const guarantee = getActualVsMarkupAmount('guarantee');
                // Always show guarantee charges, even if $0.00
                breakdown.push({
                    description: 'Guarantee Charge',
                    amount: guarantee.markup,
                    cost: guarantee.actual,
                    code: 'SUR'
                });
            }
        }

        // Add markup as separate line item for admin users
        if (enhancedIsAdmin && markupSummary?.hasMarkup) {
            breakdown.push({
                description: 'Platform Markup',
                amount: markupSummary.markupAmount,
                cost: 0,
                code: 'MSC',
                isMarkup: true
            });
        }

        return breakdown;
    };

    const { totalCost: localTotalCost, totalCharge: localTotalCharge } = calculateLocalTotals();

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
                        day: 'numeric',
                        timeZone: 'America/Toronto' // Force Eastern Time
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
                                Markup Applied: {currencySymbol}{markupSummary.markupAmount.toFixed(2)} ({markupSummary.markupPercentage.toFixed(1)}%)
                            </Typography>
                            <Typography sx={{ fontSize: '13px', color: '#374151' }}>
                                Original Cost: {currencySymbol}{markupSummary.originalAmount.toFixed(2)} →
                                Customer Charge: {currencySymbol}{markupSummary.finalAmount.toFixed(2)}
                            </Typography>
                        </Box>
                    )}

                    {/* Rate Breakdown Table */}
                    <Box sx={{ mb: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                Rate Breakdown
                            </Typography>
                            {enhancedIsAdmin && (
                                <Button
                                    size="small"
                                    startIcon={<AddIcon />}
                                    onClick={handleAddCharge}
                                    sx={{ fontSize: '12px' }}
                                >
                                    Add Charge
                                </Button>
                            )}
                        </Box>
                        <TableContainer>
                            <Table size="small" sx={{ border: '1px solid #e0e0e0' }}>
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', width: '80px' }}>
                                            Code
                                        </TableCell>
                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>
                                            Description
                                        </TableCell>
                                        {enhancedIsAdmin && (
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'right', width: '120px' }}>
                                                Cost
                                            </TableCell>
                                        )}
                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'right', width: '120px' }}>
                                            {enhancedIsAdmin ? 'Charge' : 'Amount'}
                                        </TableCell>
                                        {enhancedIsAdmin && (
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'center', width: '100px' }}>
                                                Actions
                                            </TableCell>
                                        )}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {localRateBreakdown.map((item, index) => (
                                        <TableRow key={index} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                                            <TableCell sx={{ fontSize: '12px', verticalAlign: 'middle', width: '80px' }}>
                                                {editingIndex === index ? (
                                                    <FormControl size="small" fullWidth>
                                                        <Select
                                                            value={editingValues.code || 'FRT'}
                                                            onChange={(e) => handleInputChange('code', e.target.value)}
                                                            sx={{
                                                                '& .MuiSelect-select': { fontSize: '12px', padding: '6px 8px' },
                                                                '& .MuiInputBase-root': { height: '32px' }
                                                            }}
                                                        >
                                                            {RATE_CODE_OPTIONS.map(option => (
                                                                <MenuItem key={option.value} value={option.value} sx={{ fontSize: '12px' }}>
                                                                    {option.label}
                                                                </MenuItem>
                                                            ))}
                                                        </Select>
                                                    </FormControl>
                                                ) : (
                                                    <Chip
                                                        label={item.code || 'FRT'}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{
                                                            fontSize: '10px',
                                                            height: '20px',
                                                            fontWeight: 600,
                                                            borderColor: '#d1d5db',
                                                            color: '#374151'
                                                        }}
                                                    />
                                                )}
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', verticalAlign: 'middle' }}>
                                                {editingIndex === index ? (
                                                    <TextField
                                                        value={editingValues.description}
                                                        onChange={(e) => handleInputChange('description', e.target.value)}
                                                        size="small"
                                                        fullWidth
                                                        sx={{
                                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                                            '& .MuiInputBase-root': { height: '32px' }
                                                        }}
                                                    />
                                                ) : (
                                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
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
                                                    </Box>
                                                )}
                                            </TableCell>
                                            {enhancedIsAdmin && (
                                                <TableCell sx={{ fontSize: '12px', textAlign: 'right', color: '#059669', fontWeight: 500, verticalAlign: 'middle' }}>
                                                    {editingIndex === index ? (
                                                        <TextField
                                                            value={editingValues.cost}
                                                            onChange={(e) => handleInputChange('cost', e.target.value)}
                                                            size="small"
                                                            type="number"
                                                            inputProps={{ step: "0.01", min: "0" }}
                                                            sx={{
                                                                width: '100px',
                                                                '& .MuiInputBase-input': { fontSize: '12px', textAlign: 'right' },
                                                                '& .MuiInputBase-root': { height: '32px' }
                                                            }}
                                                        />
                                                    ) : (
                                                        !item.isMarkup ? `${currencySymbol}${safeNumber(item.cost).toFixed(2)}` : '-'
                                                    )}
                                                </TableCell>
                                            )}
                                            <TableCell sx={{ fontSize: '12px', textAlign: 'right', fontWeight: 600, verticalAlign: 'middle' }}>
                                                {editingIndex === index ? (
                                                    <TextField
                                                        value={editingValues.amount}
                                                        onChange={(e) => handleInputChange('amount', e.target.value)}
                                                        size="small"
                                                        type="number"
                                                        inputProps={{ step: "0.01", min: "0" }}
                                                        sx={{
                                                            width: '100px',
                                                            '& .MuiInputBase-input': { fontSize: '12px', textAlign: 'right' },
                                                            '& .MuiInputBase-root': { height: '32px' }
                                                        }}
                                                    />
                                                ) : (
                                                    `${currencySymbol}${safeNumber(item.amount).toFixed(2)}`
                                                )}
                                            </TableCell>
                                            {enhancedIsAdmin && (
                                                <TableCell sx={{ fontSize: '12px', textAlign: 'center', verticalAlign: 'middle' }}>
                                                    {editingIndex === index ? (
                                                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                                            <Tooltip title="Save">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => handleEditSave(index)}
                                                                    sx={{ color: '#059669' }}
                                                                >
                                                                    <SaveIcon sx={{ fontSize: 16 }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Cancel">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={handleEditCancel}
                                                                    sx={{ color: '#dc2626' }}
                                                                >
                                                                    <CancelIcon sx={{ fontSize: 16 }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </Box>
                                                    ) : (
                                                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                                            <Tooltip title="Edit">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => handleEditStart(index, item)}
                                                                    sx={{ color: '#6b7280' }}
                                                                >
                                                                    <EditIcon sx={{ fontSize: 16 }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Delete">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => handleDeleteCharge(index)}
                                                                    sx={{ color: '#dc2626' }}
                                                                >
                                                                    <DeleteIcon sx={{ fontSize: 16 }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </Box>
                                                    )}
                                                </TableCell>
                                            )}
                                        </TableRow>
                                    ))}

                                    {/* Total Row */}
                                    <TableRow sx={{ borderTop: '2px solid #e0e0e0', bgcolor: '#f8fafc' }}>
                                        <TableCell sx={{ fontSize: '14px', fontWeight: 700 }}>
                                            {/* Empty cell for code column */}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '14px', fontWeight: 700 }}>
                                            TOTAL
                                        </TableCell>
                                        {enhancedIsAdmin && (
                                            <TableCell sx={{ fontSize: '14px', textAlign: 'right', color: '#059669', fontWeight: 700 }}>
                                                {currencySymbol}{localTotalCost.toFixed(2)}
                                            </TableCell>
                                        )}
                                        <TableCell sx={{ fontSize: '14px', textAlign: 'right', fontWeight: 700 }}>
                                            {currencySymbol}{localTotalCharge.toFixed(2)}
                                        </TableCell>
                                        {enhancedIsAdmin && (
                                            <TableCell />
                                        )}
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Box>

                    {/* Additional Services Section - Dynamic Services from Database */}
                    {shipment?.additionalServices && shipment.additionalServices.length > 0 && (
                        <Box>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, fontSize: '14px' }}>
                                Additional Services
                            </Typography>
                            <TableContainer>
                                <Table size="small" sx={{ border: '1px solid #e0e0e0' }}>
                                    <TableBody>
                                        {shipment.additionalServices.map((service, index) => (
                                            <TableRow key={index}>
                                                <TableCell sx={{ fontSize: '12px', py: 1 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                            {service.label || service.code}
                                                        </Typography>
                                                        {service.description && (
                                                            <Typography sx={{ fontSize: '11px', color: 'text.secondary' }}>
                                                                - {service.description}
                                                            </Typography>
                                                        )}
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    )}

                </Box>
            </Paper>
        </Grid>
    );
};

export default RateDetails; 