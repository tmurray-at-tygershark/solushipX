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
    MenuItem,
    Checkbox
} from '@mui/material';
import {
    Edit as EditIcon,
    Check as CheckIcon,
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

    // Enhanced admin check using the userRole from AuthContext
    const enhancedIsAdmin = userRole && (
        ['admin', 'superadmin', 'super_admin'].includes(userRole.toLowerCase())
    );

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
            quotedCost: item.quotedCost?.toString() || '0',
            quotedCharge: item.quotedCharge?.toString() || '0',
            actualCost: item.actualCost?.toString() || '0',
            actualCharge: item.actualCharge?.toString() || '0',
            code: item.code || 'FRT',
            invoiceNumber: item.invoiceNumber || '-',
            ediNumber: item.ediNumber || '-',
            commissionable: item.commissionable || false
        });
    }, []);

    const handleEditCancel = useCallback(() => {
        setEditingIndex(null);
        setEditingValues({});
    }, []);

    const handleEditSave = useCallback((index) => {
        console.log('💾 RateDetails: handleEditSave called', { index, editingValues });

        const updatedBreakdown = [...localRateBreakdown];
        updatedBreakdown[index] = {
            ...updatedBreakdown[index],
            description: editingValues.description,
            quotedCost: parseFloat(editingValues.quotedCost) || 0,
            quotedCharge: parseFloat(editingValues.quotedCharge) || 0,
            actualCost: parseFloat(editingValues.actualCost) || 0,
            actualCharge: parseFloat(editingValues.actualCharge) || 0,
            code: editingValues.code,
            invoiceNumber: editingValues.invoiceNumber || '-',
            ediNumber: editingValues.ediNumber || '-',
            commissionable: editingValues.commissionable || false
        };

        console.log('💾 RateDetails: Updated breakdown:', updatedBreakdown);
        console.log('💾 RateDetails: onChargesUpdate function:', typeof onChargesUpdate);

        setLocalRateBreakdown(updatedBreakdown);
        setEditingIndex(null);
        setEditingValues({});

        // Notify parent component of changes
        console.log('💾 RateDetails: Calling onChargesUpdate');
        onChargesUpdate(updatedBreakdown);
    }, [editingValues, localRateBreakdown, onChargesUpdate]);

    const handleAddCharge = useCallback(() => {
        const newCharge = {
            description: 'New Charge',
            quotedCost: 0,
            quotedCharge: 0,
            actualCost: 0,
            actualCharge: 0,
            code: 'FRT',
            isNew: true,
            invoiceNumber: '-',
            ediNumber: '-',
            commissionable: false
        };

        const updatedBreakdown = [...localRateBreakdown, newCharge];
        setLocalRateBreakdown(updatedBreakdown);
        setEditingIndex(updatedBreakdown.length - 1);
        setEditingValues({
            description: 'New Charge',
            quotedCost: '0',
            quotedCharge: '0',
            actualCost: '0',
            actualCharge: '0',
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
        const totalQuotedCost = localRateBreakdown.reduce((sum, item) => sum + (parseFloat(item.quotedCost) || 0), 0);
        const totalQuotedCharge = localRateBreakdown.reduce((sum, item) => sum + (parseFloat(item.quotedCharge) || 0), 0);
        const totalActualCost = localRateBreakdown.reduce((sum, item) => sum + (parseFloat(item.actualCost) || 0), 0);
        const totalActualCharge = localRateBreakdown.reduce((sum, item) => sum + (parseFloat(item.actualCharge) || 0), 0);

        // Legacy support - keep these for backward compatibility 
        const totalCost = totalQuotedCost; // For now, map quoted cost to legacy total cost
        const totalCharge = totalQuotedCharge; // For now, map quoted charge to legacy total charge

        return {
            totalCost,
            totalCharge,
            totalQuotedCost,
            totalQuotedCharge,
            totalActualCost,
            totalActualCharge
        };
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

    // Helper function to format currency amounts
    const formatCurrency = (amount, includeCents = true) => {
        const numAmount = parseFloat(amount) || 0;
        if (includeCents) {
            return `$${numAmount.toFixed(2)} ${currency}`;
        } else {
            return `$${Math.round(numAmount)} ${currency}`;
        }
    };

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

    // Extract actual charges from carrier invoices or updated charges
    const extractActualCharges = (breakdown) => {
        return breakdown.map(item => {
            let quotedCost = item.quotedCost || 0;
            let quotedCharge = item.quotedCharge || 0;
            let actualCost = item.actualCost || 0;
            let actualCharge = item.actualCharge || 0;

            try {
                // Priority 1: Check for saved charges from inline editing
                if (shipment?.updatedCharges && Array.isArray(shipment.updatedCharges)) {
                    const matchingUpdatedItem = shipment.updatedCharges.find(charge =>
                        charge.description?.toLowerCase().includes(item.description.toLowerCase()) ||
                        charge.code === item.code
                    );
                    if (matchingUpdatedItem) {
                        quotedCost = parseFloat(matchingUpdatedItem.quotedCost || matchingUpdatedItem.cost) || quotedCost;
                        quotedCharge = parseFloat(matchingUpdatedItem.quotedCharge || matchingUpdatedItem.amount) || quotedCharge;
                        actualCost = parseFloat(matchingUpdatedItem.actualCost) || actualCost;
                        actualCharge = parseFloat(matchingUpdatedItem.actualCharge || matchingUpdatedItem.actualAmount) || actualCharge;
                    }
                }
                // Priority 2: Check chargesBreakdown
                else if (shipment?.chargesBreakdown && Array.isArray(shipment.chargesBreakdown)) {
                    const matchingBreakdownItem = shipment.chargesBreakdown.find(charge =>
                        charge.description?.toLowerCase().includes(item.description.toLowerCase()) ||
                        charge.code === item.code
                    );
                    if (matchingBreakdownItem) {
                        quotedCost = parseFloat(matchingBreakdownItem.quotedCost || matchingBreakdownItem.cost) || quotedCost;
                        quotedCharge = parseFloat(matchingBreakdownItem.quotedCharge || matchingBreakdownItem.amount) || quotedCharge;
                        actualCost = parseFloat(matchingBreakdownItem.actualCost) || actualCost;
                        actualCharge = parseFloat(matchingBreakdownItem.actualCharge || matchingBreakdownItem.actualAmount) || actualCharge;
                    }
                }
                // Priority 3: Check for carrier invoice data (this becomes actualCost)
                else if (shipment?.carrierInvoice && Array.isArray(shipment.carrierInvoice)) {
                    const matchingInvoiceItem = shipment.carrierInvoice.find(invoice =>
                        invoice.chargeName?.toLowerCase().includes(item.description.toLowerCase()) ||
                        invoice.code === item.code
                    );
                    if (matchingInvoiceItem) {
                        actualCost = parseFloat(matchingInvoiceItem.amount) || actualCost;
                    }
                }
                // Priority 4: Check for carrier charges data (this becomes actualCharge)
                else if (shipment?.carrierCharges && Array.isArray(shipment.carrierCharges)) {
                    const matchingChargeItem = shipment.carrierCharges.find(charge =>
                        charge.chargeName?.toLowerCase().includes(item.description.toLowerCase()) ||
                        charge.code === item.code
                    );
                    if (matchingChargeItem) {
                        actualCharge = parseFloat(matchingChargeItem.amount) || actualCharge;
                    }
                }
                // Priority 5: Check legacy actual charges field
                else if (shipment?.actualCharges && Array.isArray(shipment.actualCharges)) {
                    const matchingActualItem = shipment.actualCharges.find(charge =>
                        charge.description?.toLowerCase().includes(item.description.toLowerCase()) ||
                        charge.code === item.code
                    );
                    if (matchingActualItem) {
                        actualCharge = parseFloat(matchingActualItem.amount) || actualCharge;
                    }
                }
            } catch (error) {
                console.warn('Error extracting actual charges for item:', item.description, error);
            }

            return {
                ...item,
                quotedCost: quotedCost,
                quotedCharge: quotedCharge,
                actualCost: actualCost,
                actualCharge: actualCharge,
                invoiceNumber: item.invoiceNumber || '-',
                ediNumber: item.ediNumber || '-',
                commissionable: item.commissionable || false
            };
        });
    };

    // Get rate breakdown data for table
    const getRateBreakdown = () => {
        const breakdown = [];

        // Priority 1: Check for saved charges from database (highest priority)
        if (shipment?.updatedCharges && Array.isArray(shipment.updatedCharges) && shipment.updatedCharges.length > 0) {
            return shipment.updatedCharges.map(charge => ({
                description: charge.description,
                quotedCost: parseFloat(charge.quotedCost || charge.cost) || 0, // Fallback to old 'cost' field
                quotedCharge: parseFloat(charge.quotedCharge || charge.amount) || 0, // Fallback to old 'amount' field
                actualCost: parseFloat(charge.actualCost) || 0,
                actualCharge: parseFloat(charge.actualCharge || charge.actualAmount) || 0, // Fallback to old 'actualAmount' field
                code: charge.code || 'FRT',
                invoiceNumber: charge.invoiceNumber || '-',
                ediNumber: charge.ediNumber || '-',
                commissionable: charge.commissionable || false
            }));
        }

        // Priority 2: Check chargesBreakdown
        if (shipment?.chargesBreakdown && Array.isArray(shipment.chargesBreakdown) && shipment.chargesBreakdown.length > 0) {
            return shipment.chargesBreakdown.map(charge => ({
                description: charge.description,
                quotedCost: parseFloat(charge.quotedCost || charge.cost) || 0, // Fallback to old 'cost' field
                quotedCharge: parseFloat(charge.quotedCharge || charge.amount) || 0, // Fallback to old 'amount' field
                actualCost: parseFloat(charge.actualCost) || 0,
                actualCharge: parseFloat(charge.actualCharge || charge.actualAmount) || 0, // Fallback to old 'actualAmount' field
                code: charge.code || 'FRT',
                invoiceNumber: charge.invoiceNumber || '-',
                ediNumber: charge.ediNumber || '-',
                commissionable: charge.commissionable || false
            }));
        }

        // Priority 3: QuickShip data
        if (quickShipData && quickShipData.charges.length > 0) {
            // QuickShip manual rates - get codes from original manualRates
            quickShipData.charges.forEach((charge, index) => {
                const originalRate = shipment?.manualRates?.[index];
                breakdown.push({
                    description: charge.name,
                    quotedCost: charge.cost || 0, // QuickShip cost becomes quoted cost
                    quotedCharge: charge.amount || 0, // QuickShip amount becomes quoted charge
                    actualCost: 0, // No actual cost initially
                    actualCharge: 0, // No actual charge initially
                    code: originalRate?.code || 'FRT',
                    invoiceNumber: '-',
                    ediNumber: '-',
                    commissionable: false
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
                    quotedCost: safeNumber(detail.cost || detail.amount), // Use cost field or fallback to amount
                    quotedCharge: safeNumber(detail.amount),
                    actualCost: 0, // No actual cost initially
                    actualCharge: 0, // No actual charge initially
                    code: detail.code || getChargeCode(detail.name),
                    invoiceNumber: '-',
                    ediNumber: '-',
                    commissionable: false
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
                quotedCost: freight.actual || 0, // Use actual as quoted cost initially
                quotedCharge: freight.markup || 0, // Use markup as quoted charge initially
                actualCost: 0, // No actual cost initially
                actualCharge: 0, // No actual charge initially
                code: 'FRT',
                invoiceNumber: '-',
                ediNumber: '-',
                commissionable: false
            });

            const fuel = getActualVsMarkupAmount('fuel');
            // Always show fuel charges, even if $0.00
            breakdown.push({
                description: 'Fuel Charges',
                quotedCost: fuel.actual || 0,
                quotedCharge: fuel.markup || 0,
                actualCost: 0,
                actualCharge: 0,
                code: 'FUE',
                invoiceNumber: '-',
                ediNumber: '-',
                commissionable: false
            });

            const service = getActualVsMarkupAmount('service');
            // Always show service charges, even if $0.00
            breakdown.push({
                description: 'Service Charges',
                quotedCost: service.actual || 0,
                quotedCharge: service.markup || 0,
                actualCost: 0,
                actualCharge: 0,
                code: 'MSC',
                invoiceNumber: '-',
                ediNumber: '-',
                commissionable: false
            });

            const accessorial = getActualVsMarkupAmount('accessorial');
            // Always show accessorial charges, even if $0.00
            breakdown.push({
                description: 'Accessorial Charges',
                quotedCost: accessorial.actual || 0,
                quotedCharge: accessorial.markup || 0,
                actualCost: 0,
                actualCharge: 0,
                code: 'ACC',
                invoiceNumber: '-',
                ediNumber: '-',
                commissionable: false
            });

            if (getBestRateInfo?.guaranteed) {
                const guarantee = getActualVsMarkupAmount('guarantee');
                // Always show guarantee charges, even if $0.00
                breakdown.push({
                    description: 'Guarantee Charge',
                    quotedCost: guarantee.actual || 0,
                    quotedCharge: guarantee.markup || 0,
                    actualCost: 0,
                    actualCharge: 0,
                    code: 'SUR',
                    invoiceNumber: '-',
                    ediNumber: '-',
                    commissionable: false
                });
            }
        }

        // Add markup as separate line item for admin users
        if (enhancedIsAdmin && markupSummary?.hasMarkup) {
            breakdown.push({
                description: 'Platform Markup',
                quotedCost: 0,
                quotedCharge: markupSummary.markupAmount || 0,
                actualCost: 0,
                actualCharge: 0,
                code: 'MSC',
                isMarkup: true,
                invoiceNumber: '-',
                ediNumber: '-',
                commissionable: false
            });
        }

        // Apply actual charges extraction to the breakdown
        return extractActualCharges(breakdown);
    };

    const {
        totalCost: localTotalCost,
        totalCharge: localTotalCharge,
        totalQuotedCost: localTotalQuotedCost,
        totalQuotedCharge: localTotalQuotedCharge,
        totalActualCost: localTotalActualCost,
        totalActualCharge: localTotalActualCharge
    } = calculateLocalTotals();

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
                                Markup Applied: {formatCurrency(markupSummary.markupAmount)} ({markupSummary.markupPercentage.toFixed(1)}%)
                            </Typography>
                            <Typography sx={{ fontSize: '13px', color: '#374151' }}>
                                Original Cost: {formatCurrency(markupSummary.originalAmount)} →
                                Customer Charge: {formatCurrency(markupSummary.finalAmount)}
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
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'left', width: '120px' }}>
                                                Quoted Cost
                                            </TableCell>
                                        )}
                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'left', width: '120px' }}>
                                            {enhancedIsAdmin ? 'Quoted Charge' : 'Amount'}
                                        </TableCell>
                                        {enhancedIsAdmin && (
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'left', width: '120px' }}>
                                                Actual Cost
                                            </TableCell>
                                        )}
                                        {enhancedIsAdmin && (
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'left', width: '120px' }}>
                                                Actual Charge
                                            </TableCell>
                                        )}
                                        {enhancedIsAdmin && (
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'left', width: '120px' }}>
                                                Profit
                                            </TableCell>
                                        )}
                                        {enhancedIsAdmin && (
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'left', width: '100px' }}>
                                                Invoice#
                                            </TableCell>
                                        )}
                                        {enhancedIsAdmin && (
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'left', width: '100px' }}>
                                                EDI#
                                            </TableCell>
                                        )}
                                        {enhancedIsAdmin && (
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'center', width: '120px' }}>
                                                Commissionable
                                            </TableCell>
                                        )}
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
                                                <TableCell sx={{ fontSize: '12px', textAlign: 'left', color: '#374151', fontWeight: 500, verticalAlign: 'middle' }}>
                                                    {editingIndex === index ? (
                                                        <TextField
                                                            value={editingValues.quotedCost}
                                                            onChange={(e) => handleInputChange('quotedCost', e.target.value)}
                                                            size="small"
                                                            type="number"
                                                            inputProps={{ step: "0.01", min: "0" }}
                                                            sx={{
                                                                width: '100px',
                                                                '& .MuiInputBase-input': { fontSize: '12px', textAlign: 'left' },
                                                                '& .MuiInputBase-root': { height: '32px' }
                                                            }}
                                                        />
                                                    ) : (
                                                        !item.isMarkup ? formatCurrency(item.quotedCost) : '-'
                                                    )}
                                                </TableCell>
                                            )}
                                            <TableCell sx={{ fontSize: '12px', textAlign: 'left', fontWeight: 400, verticalAlign: 'middle' }}>
                                                {editingIndex === index ? (
                                                    <TextField
                                                        value={editingValues.quotedCharge}
                                                        onChange={(e) => handleInputChange('quotedCharge', e.target.value)}
                                                        size="small"
                                                        type="number"
                                                        inputProps={{ step: "0.01", min: "0" }}
                                                        sx={{
                                                            width: '100px',
                                                            '& .MuiInputBase-input': { fontSize: '12px', textAlign: 'left' },
                                                            '& .MuiInputBase-root': { height: '32px' }
                                                        }}
                                                    />
                                                ) : (
                                                    formatCurrency(item.quotedCharge)
                                                )}
                                            </TableCell>
                                            {enhancedIsAdmin && (
                                                <TableCell sx={{ fontSize: '12px', textAlign: 'left', fontWeight: 400, verticalAlign: 'middle' }}>
                                                    {editingIndex === index ? (
                                                        <TextField
                                                            value={editingValues.actualCost || ''}
                                                            onChange={(e) => handleInputChange('actualCost', e.target.value)}
                                                            size="small"
                                                            type="number"
                                                            inputProps={{ step: "0.01", min: "0" }}
                                                            sx={{
                                                                width: '100px',
                                                                '& .MuiInputBase-input': { fontSize: '12px', textAlign: 'left' },
                                                                '& .MuiInputBase-root': { height: '32px' }
                                                            }}
                                                        />
                                                    ) : (
                                                        item.actualCost > 0 ? formatCurrency(item.actualCost) : (
                                                            <Typography sx={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                                                                TBD
                                                            </Typography>
                                                        )
                                                    )}
                                                </TableCell>
                                            )}
                                            {enhancedIsAdmin && (
                                                <TableCell sx={{ fontSize: '12px', textAlign: 'left', fontWeight: 400, verticalAlign: 'middle' }}>
                                                    {editingIndex === index ? (
                                                        <TextField
                                                            value={editingValues.actualCharge || ''}
                                                            onChange={(e) => handleInputChange('actualCharge', e.target.value)}
                                                            size="small"
                                                            type="number"
                                                            inputProps={{ step: "0.01", min: "0" }}
                                                            sx={{
                                                                width: '100px',
                                                                '& .MuiInputBase-input': { fontSize: '12px', textAlign: 'left' },
                                                                '& .MuiInputBase-root': { height: '32px' }
                                                            }}
                                                        />
                                                    ) : (
                                                        item.actualCharge > 0 ? formatCurrency(item.actualCharge) : (
                                                            <Typography sx={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                                                                TBD
                                                            </Typography>
                                                        )
                                                    )}
                                                </TableCell>
                                            )}
                                            {enhancedIsAdmin && (
                                                <TableCell sx={{ fontSize: '12px', textAlign: 'left', verticalAlign: 'middle' }}>
                                                    {editingIndex === index ? (
                                                        // Show calculated profit during editing
                                                        (() => {
                                                            // If actual values exist, use actual charge - actual cost
                                                            // If no actual values, use quoted charge - quoted cost
                                                            const hasActualCharge = editingValues.actualCharge && parseFloat(editingValues.actualCharge) > 0;
                                                            const hasActualCost = editingValues.actualCost && parseFloat(editingValues.actualCost) > 0;

                                                            let effectiveCharge, effectiveCost;

                                                            if (hasActualCharge && hasActualCost) {
                                                                // Both actual values exist
                                                                effectiveCharge = parseFloat(editingValues.actualCharge);
                                                                effectiveCost = parseFloat(editingValues.actualCost);
                                                            } else if (hasActualCharge && !hasActualCost) {
                                                                // Only actual charge exists, use with quoted cost
                                                                effectiveCharge = parseFloat(editingValues.actualCharge);
                                                                effectiveCost = parseFloat(editingValues.quotedCost || 0);
                                                            } else if (!hasActualCharge && hasActualCost) {
                                                                // Only actual cost exists, use with quoted charge
                                                                effectiveCharge = parseFloat(editingValues.quotedCharge || 0);
                                                                effectiveCost = parseFloat(editingValues.actualCost);
                                                            } else {
                                                                // No actual values, use quoted values
                                                                effectiveCharge = parseFloat(editingValues.quotedCharge || 0);
                                                                effectiveCost = parseFloat(editingValues.quotedCost || 0);
                                                            }

                                                            const profit = effectiveCharge - effectiveCost;
                                                            const isProfit = profit > 0;
                                                            const isLoss = profit < 0;
                                                            const prefix = isProfit ? '+' : (isLoss ? '-' : '');
                                                            const absProfit = Math.abs(profit);
                                                            const color = isProfit ? '#059669' : (isLoss ? '#dc2626' : 'inherit');
                                                            return (
                                                                <Typography sx={{
                                                                    fontSize: '12px',
                                                                    color: color,
                                                                    fontWeight: 400
                                                                }}>
                                                                    {`${prefix}${formatCurrency(absProfit)}`}
                                                                </Typography>
                                                            );
                                                        })()
                                                    ) : (
                                                        // Show calculated profit for each line item
                                                        !item.isMarkup ? (() => {
                                                            // Use the best available data for profit calculation
                                                            const hasActualCharge = item.actualCharge && item.actualCharge > 0;
                                                            const hasActualCost = item.actualCost && item.actualCost > 0;

                                                            let effectiveCharge, effectiveCost;

                                                            if (hasActualCharge && hasActualCost) {
                                                                // Both actual values exist
                                                                effectiveCharge = safeNumber(item.actualCharge);
                                                                effectiveCost = safeNumber(item.actualCost);
                                                            } else if (hasActualCharge && !hasActualCost) {
                                                                // Only actual charge exists, use with quoted cost
                                                                effectiveCharge = safeNumber(item.actualCharge);
                                                                effectiveCost = safeNumber(item.quotedCost);
                                                            } else if (!hasActualCharge && hasActualCost) {
                                                                // Only actual cost exists, use with quoted charge
                                                                effectiveCharge = safeNumber(item.quotedCharge);
                                                                effectiveCost = safeNumber(item.actualCost);
                                                            } else {
                                                                // No actual values, use quoted values
                                                                effectiveCharge = safeNumber(item.quotedCharge);
                                                                effectiveCost = safeNumber(item.quotedCost);
                                                            }

                                                            const profit = effectiveCharge - effectiveCost;
                                                            const isProfit = profit > 0;
                                                            const isLoss = profit < 0;
                                                            const prefix = isProfit ? '+' : (isLoss ? '-' : '');
                                                            const absProfit = Math.abs(profit);
                                                            const color = isProfit ? '#059669' : (isLoss ? '#dc2626' : 'inherit');
                                                            return (
                                                                <Typography sx={{
                                                                    fontSize: '12px',
                                                                    color: color,
                                                                    fontWeight: 400
                                                                }}>
                                                                    {`${prefix}${formatCurrency(absProfit)}`}
                                                                </Typography>
                                                            );
                                                        })() : (
                                                            // For markup items, show the markup amount as profit
                                                            <Typography sx={{
                                                                fontSize: '12px',
                                                                color: '#059669',
                                                                fontWeight: 400
                                                            }}>
                                                                {`+${formatCurrency(item.amount)}`}
                                                            </Typography>
                                                        )
                                                    )}
                                                </TableCell>
                                            )}
                                            {enhancedIsAdmin && (
                                                <TableCell sx={{ fontSize: '12px', textAlign: 'left', verticalAlign: 'middle' }}>
                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                        -
                                                    </Typography>
                                                </TableCell>
                                            )}
                                            {enhancedIsAdmin && (
                                                <TableCell sx={{ fontSize: '12px', textAlign: 'left', verticalAlign: 'middle' }}>
                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                        -
                                                    </Typography>
                                                </TableCell>
                                            )}
                                            {enhancedIsAdmin && (
                                                <TableCell sx={{ fontSize: '12px', textAlign: 'center', verticalAlign: 'middle' }}>
                                                    <Checkbox
                                                        checked={item.commissionable || false}
                                                        onChange={(e) => {
                                                            const updatedBreakdown = [...localRateBreakdown];
                                                            updatedBreakdown[index] = {
                                                                ...updatedBreakdown[index],
                                                                commissionable: e.target.checked
                                                            };
                                                            setLocalRateBreakdown(updatedBreakdown);
                                                            onChargesUpdate(updatedBreakdown);
                                                        }}
                                                        size="small"
                                                        sx={{
                                                            '& .MuiSvgIcon-root': {
                                                                fontSize: '16px'
                                                            }
                                                        }}
                                                    />
                                                </TableCell>
                                            )}
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
                                                                    <CheckIcon sx={{ fontSize: 16 }} />
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
                                            <TableCell sx={{ fontSize: '14px', textAlign: 'left', color: '#374151', fontWeight: 700 }}>
                                                {formatCurrency(localTotalQuotedCost)}
                                            </TableCell>
                                        )}
                                        <TableCell sx={{ fontSize: '14px', textAlign: 'left', fontWeight: 700 }}>
                                            {formatCurrency(localTotalQuotedCharge)}
                                        </TableCell>
                                        {enhancedIsAdmin && (
                                            <TableCell sx={{ fontSize: '14px', textAlign: 'left', fontWeight: 700 }}>
                                                {localTotalActualCost > 0 ? formatCurrency(localTotalActualCost) : (
                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic', fontWeight: 400 }}>
                                                        TBD
                                                    </Typography>
                                                )}
                                            </TableCell>
                                        )}
                                        {enhancedIsAdmin && (
                                            <TableCell sx={{ fontSize: '14px', textAlign: 'left', fontWeight: 700 }}>
                                                {localTotalActualCharge > 0 ? formatCurrency(localTotalActualCharge) : (
                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic', fontWeight: 400 }}>
                                                        TBD
                                                    </Typography>
                                                )}
                                            </TableCell>
                                        )}
                                        {enhancedIsAdmin && (
                                            <TableCell sx={{ fontSize: '14px', textAlign: 'left', fontWeight: 700 }}>
                                                {(() => {
                                                    // Calculate profit using best available data
                                                    let effectiveTotalCharge, effectiveTotalCost;

                                                    // Use actual totals if available, otherwise use quoted totals
                                                    if (localTotalActualCharge > 0 && localTotalActualCost > 0) {
                                                        // Both actual totals exist
                                                        effectiveTotalCharge = localTotalActualCharge;
                                                        effectiveTotalCost = localTotalActualCost;
                                                    } else if (localTotalActualCharge > 0 && localTotalActualCost === 0) {
                                                        // Only actual charge exists, use with quoted cost
                                                        effectiveTotalCharge = localTotalActualCharge;
                                                        effectiveTotalCost = localTotalQuotedCost;
                                                    } else if (localTotalActualCharge === 0 && localTotalActualCost > 0) {
                                                        // Only actual cost exists, use with quoted charge
                                                        effectiveTotalCharge = localTotalQuotedCharge;
                                                        effectiveTotalCost = localTotalActualCost;
                                                    } else {
                                                        // No actual totals, use quoted totals
                                                        effectiveTotalCharge = localTotalQuotedCharge;
                                                        effectiveTotalCost = localTotalQuotedCost;
                                                    }

                                                    const profit = effectiveTotalCharge - effectiveTotalCost;
                                                    const isProfit = profit > 0;
                                                    const isLoss = profit < 0;
                                                    const prefix = isProfit ? '+' : (isLoss ? '-' : '');
                                                    const absProfit = Math.abs(profit);
                                                    const color = isProfit ? '#059669' : (isLoss ? '#dc2626' : 'inherit');
                                                    return (
                                                        <Typography sx={{
                                                            fontSize: '14px',
                                                            fontWeight: 700,
                                                            color: color
                                                        }}>
                                                            {`${prefix}${formatCurrency(absProfit)}`}
                                                        </Typography>
                                                    );
                                                })()}
                                            </TableCell>
                                        )}
                                        {enhancedIsAdmin && (
                                            <TableCell sx={{ fontSize: '14px', textAlign: 'left', fontWeight: 700 }}>
                                                {/* Empty cell for Invoice# column */}
                                            </TableCell>
                                        )}
                                        {enhancedIsAdmin && (
                                            <TableCell sx={{ fontSize: '14px', textAlign: 'left', fontWeight: 700 }}>
                                                {/* Empty cell for EDI# column */}
                                            </TableCell>
                                        )}
                                        {enhancedIsAdmin && (
                                            <TableCell sx={{ fontSize: '14px', textAlign: 'center', fontWeight: 700 }}>
                                                {/* Empty cell for Commissionable column */}
                                            </TableCell>
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