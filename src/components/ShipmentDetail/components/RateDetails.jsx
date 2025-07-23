import React, { useState, useCallback, useEffect } from 'react';
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
    Checkbox,
    Menu,
    MenuList,
    ListItemIcon,
    ListItemText
} from '@mui/material';
import {
    Edit as EditIcon,
    Check as CheckIcon,
    Cancel as CancelIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { useAuth } from '../../../contexts/AuthContext';
import { canSeeActualRates, getMarkupSummary } from '../../../utils/markupEngine';
import shipmentChargeTypeService from '../../../services/shipmentChargeTypeService';
import { getAutoPopulatedChargeName } from '../../../utils/shipmentValidation';
import { updateRateAndRecalculateTaxes, addRateAndRecalculateTaxes, removeRateAndRecalculateTaxes, recalculateShipmentTaxes } from '../../../utils/taxCalculator';
import { isCanadianDomesticShipment, isTaxCharge } from '../../../services/canadianTaxService';

// Rate code options - DEPRECATED: Now using dynamic charge types from database
// Kept as fallback for when dynamic loading fails
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

    // Dynamic charge types state
    const [availableChargeTypes, setAvailableChargeTypes] = useState([]);
    const [loadingChargeTypes, setLoadingChargeTypes] = useState(false);
    const [chargeTypesError, setChargeTypesError] = useState(null);

    // State for inline editing
    const [editingIndex, setEditingIndex] = useState(null);
    const [editingValues, setEditingValues] = useState({});
    const [localRateBreakdown, setLocalRateBreakdown] = useState([]);

    // State for action menu
    const [anchorEl, setAnchorEl] = useState(null);
    const [menuRowIndex, setMenuRowIndex] = useState(null);

    // State for tax calculation
    const [isCalculatingTaxes, setIsCalculatingTaxes] = useState(false);

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

    const handleEditSave = useCallback(async (index) => {
        console.log('💾 RateDetails: handleEditSave called', { index, editingValues });

        // Validate charge code against dynamic charge types
        if (editingValues.code && availableChargeTypes.length > 0) {
            const isValidCode = availableChargeTypes.some(ct => ct.value === editingValues.code);
            if (!isValidCode) {
                console.warn('⚠️ Invalid charge code:', editingValues.code);
                alert(`Invalid charge code: ${editingValues.code}. Please select a valid code from the dropdown.`);
                return;
            }
        }

        // Validate required fields
        if (!editingValues.description || editingValues.description.trim() === '') {
            alert('Please enter a description for the charge.');
            return;
        }

        // Save original state for potential revert
        const originalBreakdown = [...localRateBreakdown];

        let updatedBreakdown = [...localRateBreakdown];
        const updatedItem = {
            ...updatedBreakdown[index],
            description: editingValues.description.trim(),
            quotedCost: parseFloat(editingValues.quotedCost) || 0,
            quotedCharge: parseFloat(editingValues.quotedCharge) || 0,
            actualCost: parseFloat(editingValues.actualCost) || 0,
            actualCharge: parseFloat(editingValues.actualCharge) || 0,
            code: editingValues.code || 'FRT',
            invoiceNumber: editingValues.invoiceNumber || '-',
            ediNumber: editingValues.ediNumber || '-',
            commissionable: editingValues.commissionable || false
        };

        updatedBreakdown[index] = updatedItem;

        // 🔧 CRITICAL FIX: Only recalculate taxes if NO taxes exist yet
        // If taxes already exist, preserve them exactly as they are
        const existingTaxCharges = updatedBreakdown.filter(charge => charge.isTax || isTaxCharge(charge.code));

        if (availableChargeTypes && availableChargeTypes.length > 0 &&
            shipment?.shipFrom && shipment?.shipTo &&
            isCanadianDomesticShipment(shipment.shipFrom, shipment.shipTo)) {
            const province = shipment.shipTo?.state;

            if (province && existingTaxCharges.length === 0) {
                // Only add taxes if none exist
                console.log('🍁 Canadian Tax: Adding missing taxes after editing charge');
                updatedBreakdown = updateRateAndRecalculateTaxes(updatedBreakdown, updatedItem, province, availableChargeTypes);
            } else if (existingTaxCharges.length > 0) {
                // Taxes already exist - preserve them exactly
                console.log('🍁 Canadian Tax: Preserving existing taxes, not recalculating', {
                    existingTaxes: existingTaxCharges.map(tax => `${tax.code}: $${tax.quotedCharge}`)
                });
            }
        }

        // OPTIMISTIC UPDATE: Update UI immediately for smooth UX
        setLocalRateBreakdown(updatedBreakdown);
        setEditingIndex(null);
        setEditingValues({});

        console.log('🚀 Optimistic update: UI updated, saving to database...');
        console.log('💾 Saving charge data:', updatedBreakdown[index]);

        // Save to database with proper error handling
        if (onChargesUpdate) {
            try {
                const result = await onChargesUpdate(updatedBreakdown);
                if (result && result.success) {
                    console.log('✅ Charge saved successfully');
                } else {
                    throw new Error(result?.error || 'Save failed');
                }
            } catch (error) {
                console.error('❌ Error saving charges:', error);
                // Revert to original state
                setLocalRateBreakdown(originalBreakdown);
                setEditingIndex(index); // Go back to editing mode
                setEditingValues({
                    description: originalBreakdown[index]?.description || '',
                    quotedCost: originalBreakdown[index]?.quotedCost || 0,
                    quotedCharge: originalBreakdown[index]?.quotedCharge || 0,
                    actualCost: originalBreakdown[index]?.actualCost || 0,
                    actualCharge: originalBreakdown[index]?.actualCharge || 0,
                    code: originalBreakdown[index]?.code || 'FRT',
                    invoiceNumber: originalBreakdown[index]?.invoiceNumber || '-',
                    ediNumber: originalBreakdown[index]?.ediNumber || '-',
                    commissionable: originalBreakdown[index]?.commissionable || false
                });
                alert(`Failed to save charge: ${error.message}. Please try again.`);
            }
        }
    }, [editingValues, localRateBreakdown, onChargesUpdate, availableChargeTypes, shipment]);

    const handleAddCharge = useCallback(async () => {
        // Use first available dynamic charge type or fallback to 'FRT'
        const defaultCode = availableChargeTypes.length > 0 ? availableChargeTypes[0].value : 'FRT';

        // Get commissionable flag from charge type
        const defaultChargeType = availableChargeTypes.find(ct => ct.value === defaultCode);
        const defaultCommissionable = defaultChargeType?.commissionable || false;

        // Get appropriate description/label for the default code
        let defaultDescription = 'New Charge';
        try {
            defaultDescription = await getAutoPopulatedChargeName(defaultCode, '');
        } catch (error) {
            console.error('Error getting default charge name:', error);
            // Fallback to static description if available
            if (availableChargeTypes.length > 0) {
                const firstChargeType = availableChargeTypes[0];
                defaultDescription = firstChargeType.label || firstChargeType.description || 'New Charge';
            }
        }

        console.log('➕ Adding new charge with auto-populated properties:', {
            code: defaultCode,
            description: defaultDescription,
            commissionable: defaultCommissionable,
            chargeType: defaultChargeType
        });

        const newCharge = {
            id: `new_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`, // Unique ID for new charges
            description: defaultDescription,
            quotedCost: 0,
            quotedCharge: 0,
            actualCost: 0,
            actualCharge: 0,
            code: defaultCode,
            isNew: true,
            invoiceNumber: '-',
            ediNumber: '-',
            commissionable: defaultCommissionable // Auto-populate based on charge type
        };

        let updatedBreakdown = [...localRateBreakdown, newCharge];

        // 🔧 CRITICAL FIX: Only add taxes if none exist, preserve existing taxes
        const existingTaxCharges = localRateBreakdown.filter(charge => charge.isTax || isTaxCharge(charge.code));

        if (availableChargeTypes && availableChargeTypes.length > 0 &&
            shipment?.shipFrom && shipment?.shipTo &&
            isCanadianDomesticShipment(shipment.shipFrom, shipment.shipTo)) {
            const province = shipment.shipTo?.state;

            if (province && existingTaxCharges.length === 0) {
                // Only add taxes if none exist
                console.log('🍁 Canadian Tax: Adding taxes after adding first charge');
                updatedBreakdown = addRateAndRecalculateTaxes(localRateBreakdown, newCharge, province, availableChargeTypes);
            } else if (existingTaxCharges.length > 0) {
                // Taxes already exist - just add the new charge without recalculating taxes
                console.log('🍁 Canadian Tax: Preserving existing taxes when adding new charge');
                updatedBreakdown = [...localRateBreakdown, newCharge];
            }
        }

        // Update local state immediately for UI feedback
        setLocalRateBreakdown(updatedBreakdown);
        setEditingIndex(updatedBreakdown.length - 1);
        setEditingValues({
            description: defaultDescription,
            quotedCost: '0',
            quotedCharge: '0',
            actualCost: '0',
            actualCharge: '0',
            code: defaultCode,
            invoiceNumber: '-',
            ediNumber: '-',
            commissionable: defaultCommissionable // Auto-populate based on charge type
        });

        // NO AUTO-SAVE: Let user edit the new charge first
        // The charge will be saved when they click the checkmark (handleEditSave)
        console.log('➕ New charge added to UI, ready for editing');
    }, [localRateBreakdown, availableChargeTypes, shipment]);

    const handleDeleteCharge = useCallback(async (index) => {
        const chargeToDelete = localRateBreakdown[index];
        let updatedBreakdown = localRateBreakdown.filter((_, i) => i !== index);

        // 🔧 CRITICAL FIX: Only recalculate taxes if we're deleting a tax charge
        // Preserve existing taxes when deleting non-tax charges
        const isDeletedChargeTax = chargeToDelete && (chargeToDelete.isTax || isTaxCharge(chargeToDelete.code));

        if (availableChargeTypes && availableChargeTypes.length > 0 &&
            shipment?.shipFrom && shipment?.shipTo &&
            isCanadianDomesticShipment(shipment.shipFrom, shipment.shipTo)) {
            const province = shipment.shipTo?.state;

            if (province && chargeToDelete && isDeletedChargeTax) {
                // Only recalculate taxes if we're deleting a tax charge
                console.log('🍁 Canadian Tax: Recalculating taxes after deleting tax charge');
                updatedBreakdown = removeRateAndRecalculateTaxes(localRateBreakdown, chargeToDelete.id, province, availableChargeTypes);
            } else if (chargeToDelete && !isDeletedChargeTax) {
                // Deleting a non-tax charge - preserve existing taxes
                console.log('🍁 Canadian Tax: Preserving existing taxes when deleting non-tax charge');
                updatedBreakdown = localRateBreakdown.filter((_, i) => i !== index);
            }
        }

        // Update local state first for immediate UI feedback
        setLocalRateBreakdown(updatedBreakdown);

        // Notify parent component of changes - this will trigger the save to database
        if (onChargesUpdate) {
            // Don't await - fire and forget for true optimistic updates
            onChargesUpdate(updatedBreakdown).catch(error => {
                console.error('❌ Error saving charges:', error);
            });
        }
    }, [localRateBreakdown, onChargesUpdate, availableChargeTypes, shipment]);

    // Menu handlers for action menu
    const handleMenuOpen = useCallback((event, index) => {
        setAnchorEl(event.currentTarget);
        setMenuRowIndex(index);
    }, []);

    const handleMenuClose = useCallback(() => {
        setAnchorEl(null);
        setMenuRowIndex(null);
    }, []);

    const handleMenuEdit = useCallback(() => {
        if (menuRowIndex !== null) {
            const item = localRateBreakdown[menuRowIndex];
            handleEditStart(menuRowIndex, item);
        }
        handleMenuClose();
    }, [menuRowIndex, localRateBreakdown, handleEditStart]);

    const handleMenuDelete = useCallback(() => {
        if (menuRowIndex !== null) {
            handleDeleteCharge(menuRowIndex);
        }
        handleMenuClose();
    }, [menuRowIndex, handleDeleteCharge]);

    const handleInputChange = useCallback(async (field, value) => {
        setEditingValues(prev => ({
            ...prev,
            [field]: value
        }));

        // Auto-populate description and commissionable flag when code is selected
        if (field === 'code' && value) {
            try {
                // Auto-populate description
                const newDescription = await getAutoPopulatedChargeName(value, editingValues.description || '');

                // Auto-populate commissionable flag based on charge type
                const selectedChargeType = availableChargeTypes.find(ct => ct.value === value);
                const isCommissionable = selectedChargeType?.commissionable || false;

                console.log('🏷️ Auto-populating charge properties:', {
                    code: value,
                    description: newDescription,
                    commissionable: isCommissionable,
                    chargeType: selectedChargeType
                });

                const updates = {};

                if (newDescription !== (editingValues.description || '')) {
                    updates.description = newDescription;
                }

                // Always update commissionable flag to match charge type
                updates.commissionable = isCommissionable;

                if (Object.keys(updates).length > 0) {
                    setEditingValues(prev => ({
                        ...prev,
                        ...updates
                    }));
                }
            } catch (error) {
                console.error('Error auto-populating charge properties:', error);
                // Continue without auto-population on error
            }
        }
    }, [editingValues.description, availableChargeTypes]);

    // Comprehensive profit calculation logic for individual line items
    const calculateLineItemProfit = useCallback((item) => {
        // Tax charges should not have profit calculations - they are pass-through charges
        if (item.isTax || isTaxCharge(item.code)) {
            return null; // Special value to indicate N/A for taxes
        }

        const actualCost = parseFloat(item.actualCost) || 0;
        const quotedCost = parseFloat(item.quotedCost) || 0;
        const actualCharge = parseFloat(item.actualCharge) || 0;
        const quotedCharge = parseFloat(item.quotedCharge) || 0;

        // Profit Calculation Priority Logic:
        // 1. If both actual cost and actual charge exist: actualCharge - actualCost
        // 2. If only actual cost exists: quotedCharge - actualCost  
        // 3. If only actual charge exists: actualCharge - quotedCost
        // 4. If neither actual exists: quotedCharge - quotedCost

        if (actualCost > 0 && actualCharge > 0) {
            // Both actual values available - most accurate scenario
            return actualCharge - actualCost;
        } else if (actualCost > 0) {
            // Only actual cost available - use with quoted charge
            return quotedCharge - actualCost;
        } else if (actualCharge > 0) {
            // Only actual charge available - use with quoted cost
            return actualCharge - quotedCost;
        } else {
            // No actual values - use quoted values
            return quotedCharge - quotedCost;
        }
    }, []);

    // Calculate totals from local breakdown with comprehensive profit logic
    const calculateLocalTotals = useCallback(() => {
        const totalQuotedCost = localRateBreakdown.reduce((sum, item) => sum + (parseFloat(item.quotedCost) || 0), 0);
        const totalQuotedCharge = localRateBreakdown.reduce((sum, item) => sum + (parseFloat(item.quotedCharge) || 0), 0);
        const totalActualCost = localRateBreakdown.reduce((sum, item) => sum + (parseFloat(item.actualCost) || 0), 0);
        const totalActualCharge = localRateBreakdown.reduce((sum, item) => sum + (parseFloat(item.actualCharge) || 0), 0);

        // Calculate effective totals (use actual when available, fallback to quoted)
        const effectiveTotalCost = localRateBreakdown.reduce((sum, item) => {
            const actualCost = parseFloat(item.actualCost) || 0;
            const quotedCost = parseFloat(item.quotedCost) || 0;
            return sum + (actualCost > 0 ? actualCost : quotedCost);
        }, 0);

        const effectiveTotalCharge = localRateBreakdown.reduce((sum, item) => {
            const actualCharge = parseFloat(item.actualCharge) || 0;
            const quotedCharge = parseFloat(item.quotedCharge) || 0;
            return sum + (actualCharge > 0 ? actualCharge : quotedCharge);
        }, 0);

        // Calculate total profit using smart line-item logic (excluding tax charges)
        const totalProfit = localRateBreakdown.reduce((sum, item) => {
            const profit = calculateLineItemProfit(item);
            // Skip tax charges (null profit) in total calculation
            return profit !== null ? sum + profit : sum;
        }, 0);

        // Legacy support - keep these for backward compatibility 
        const totalCost = effectiveTotalCost; // Use effective cost (actual preferred)
        const totalCharge = effectiveTotalCharge; // Use effective charge (actual preferred)

        return {
            totalCost,
            totalCharge,
            totalQuotedCost,
            totalQuotedCharge,
            totalActualCost,
            totalActualCharge,
            effectiveTotalCost,
            effectiveTotalCharge,
            totalProfit
        };
    }, [localRateBreakdown, calculateLineItemProfit]);

    // Load dynamic charge types on component mount
    useEffect(() => {
        const loadChargeTypes = async () => {
            setLoadingChargeTypes(true);
            setChargeTypesError(null);

            try {
                console.log('📦 RateDetails: Loading dynamic charge types...');
                const chargeTypes = await shipmentChargeTypeService.getChargeTypes();
                console.log(`📦 RateDetails: Loaded ${chargeTypes.length} charge types`);
                setAvailableChargeTypes(chargeTypes);
            } catch (error) {
                console.error('❌ RateDetails: Failed to load charge types:', error);
                setChargeTypesError(error.message);
                // Don't clear charge types on error - they may be cached
            } finally {
                setLoadingChargeTypes(false);
            }
        };

        loadChargeTypes();
    }, []); // Only load once on component mount

    // Smart data refresh - only when safe to do so
    React.useEffect(() => {
        // Only refresh data if:
        // 1. No one is actively editing (editingIndex is null)
        // 2. shipment ID changed (new shipment loaded)
        // 3. shipment was modified externally

        const shouldRefresh = editingIndex === null && shipment?.id;

        if (shouldRefresh) {
            const rateBreakdown = getRateBreakdown();
            console.log('🔄 Smart refresh: Updating rate breakdown (safe to refresh)', {
                shipmentId: shipment?.id,
                isQuickShip: shipment?.creationMethod === 'quickship',
                rateBreakdownCount: rateBreakdown?.length || 0,
                breakdown: rateBreakdown?.map(rate => ({
                    code: rate.code,
                    description: rate.description,
                    quotedCharge: rate.quotedCharge,
                    isTax: rate.isTax || false
                })) || []
            });
            setLocalRateBreakdown(rateBreakdown);
        } else {
            console.log('⚠️ Skipping rate breakdown reload - user is editing');
        }
    }, [shipment?.id, shipment?.lastModified, editingIndex]);

    // 🍁 CANADIAN TAX AUTO-CALCULATION - Only add taxes when missing
    React.useEffect(() => {
        // Don't interfere if user is actively editing or if we're already calculating taxes
        if (editingIndex !== null || isCalculatingTaxes) return;

        // Ensure we have all required data
        if (!availableChargeTypes || availableChargeTypes.length === 0) return;
        if (!shipment?.shipFrom || !shipment?.shipTo) return;
        if (!localRateBreakdown || localRateBreakdown.length === 0) return;

        // Only proceed for Canadian domestic shipments
        if (!isCanadianDomesticShipment(shipment.shipFrom, shipment.shipTo)) {
            console.log('🍁 Canadian Tax: Not a Canadian domestic shipment, skipping tax calculation');
            return;
        }

        const province = shipment.shipTo?.state;
        if (!province) {
            console.log('🍁 Canadian Tax: No destination province found, skipping tax calculation');
            return;
        }

        // 🔧 CRITICAL FIX: Check if taxes already exist - DON'T recalculate existing taxes
        const existingTaxCharges = localRateBreakdown.filter(charge => charge.isTax || isTaxCharge(charge.code));
        if (existingTaxCharges.length > 0) {
            console.log('🍁 Canadian Tax: Taxes already exist in breakdown, skipping auto-calculation', {
                existingTaxes: existingTaxCharges.map(tax => `${tax.code}: ${tax.description}`)
            });
            return;
        }

        console.log('🍁 Canadian Tax: No taxes found - checking if they need to be added', {
            shipFrom: shipment.shipFrom?.country,
            shipTo: shipment.shipTo?.country,
            province: province,
            chargesCount: localRateBreakdown.length,
            chargeTypesLoaded: availableChargeTypes.length > 0
        });

        // Create a shipment-like data structure for tax calculation
        const shipmentData = {
            shipFrom: shipment.shipFrom,
            shipTo: shipment.shipTo,
            manualRates: localRateBreakdown // Use current local breakdown
        };

        // Calculate what the rates should be with proper taxes
        const updatedShipmentData = recalculateShipmentTaxes(shipmentData, availableChargeTypes);

        // Check if taxes were actually added
        const newTaxCharges = updatedShipmentData.manualRates.filter(charge => charge.isTax || isTaxCharge(charge.code));

        if (newTaxCharges.length > 0) {
            console.log('🍁 Canadian Tax: Adding missing taxes to inline editor', {
                originalCharges: localRateBreakdown.length,
                updatedCharges: updatedShipmentData.manualRates.length,
                taxesAdded: newTaxCharges.map(tax => `${tax.code}: ${tax.description}`)
            });

            // Set flag to prevent overlapping calculations
            setIsCalculatingTaxes(true);

            // Update the local state with proper taxes
            setLocalRateBreakdown(updatedShipmentData.manualRates);

            // Automatically save the updated charges to the database
            if (onChargesUpdate) {
                console.log('🍁 Canadian Tax: Auto-saving newly added taxes to database');
                onChargesUpdate(updatedShipmentData.manualRates, false)
                    .then(() => {
                        console.log('🍁 Canadian Tax: Auto-save completed successfully');
                    })
                    .catch(error => {
                        console.error('🍁 Canadian Tax: Failed to auto-save updated charges:', error);
                    })
                    .finally(() => {
                        // Always clear the calculating flag
                        setIsCalculatingTaxes(false);
                    });
            } else {
                // Clear the flag even if no save function
                setIsCalculatingTaxes(false);
            }
        } else {
            console.log('🍁 Canadian Tax: No taxes to add for this shipment');
        }
    }, [shipment?.shipFrom, shipment?.shipTo, availableChargeTypes, editingIndex, isCalculatingTaxes]);

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

    // Helper function to format currency amounts with thousands separators
    const formatCurrency = (amount, includeCents = true) => {
        const numAmount = parseFloat(amount) || 0;
        if (includeCents) {
            return `$${numAmount.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })} ${currency}`;
        } else {
            return `$${Math.round(numAmount).toLocaleString('en-US')} ${currency}`;
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

        // FIXED PRIORITY: For QuickShip shipments, manualRates is the single source of truth
        const isQuickShipShipment = shipment?.creationMethod === 'quickship' || shipment?.isQuickShip;

        if (isQuickShipShipment) {
            // 🔧 CRITICAL FIX: For QuickShip, check updatedCharges FIRST (saved edits), then manualRates

            // Priority 1: Check for saved inline edits in updatedCharges
            if (shipment?.updatedCharges && Array.isArray(shipment.updatedCharges) && shipment.updatedCharges.length > 0) {
                console.log('🔧 DEBUG: QuickShip getRateBreakdown - loading from updatedCharges (inline edits):', {
                    shipmentId: shipment.id,
                    updatedChargesCount: shipment.updatedCharges.length,
                    rates: shipment.updatedCharges.map(charge => ({
                        code: charge.code,
                        description: charge.description,
                        quotedCharge: charge.quotedCharge || charge.amount,
                        isTax: charge.isTax || false
                    }))
                });

                return shipment.updatedCharges.map((charge, index) => ({
                    id: charge.id || `quickship_updated_${index}`,
                    description: charge.description || '',
                    quotedCost: parseFloat(charge.quotedCost || charge.cost) || 0,
                    quotedCharge: parseFloat(charge.quotedCharge || charge.amount) || 0,
                    actualCost: parseFloat(charge.actualCost) || 0,
                    actualCharge: parseFloat(charge.actualCharge || charge.actualAmount) || 0,
                    code: charge.code || 'FRT',
                    invoiceNumber: charge.invoiceNumber || '-',
                    ediNumber: charge.ediNumber || '-',
                    commissionable: charge.commissionable || false,
                    // Preserve tax flags
                    isTax: charge.isTax || false,
                    isMarkup: charge.isMarkup || false
                }));
            }

            // Priority 2: Fallback to original manualRates if no edits exist
            if (shipment?.manualRates && Array.isArray(shipment.manualRates) && shipment.manualRates.length > 0) {
                console.log('🔧 DEBUG: QuickShip getRateBreakdown - loading from manualRates (original data):', {
                    shipmentId: shipment.id,
                    manualRatesCount: shipment.manualRates.length,
                    rates: shipment.manualRates.map(rate => ({
                        code: rate.code,
                        description: rate.chargeName || rate.description,
                        charge: rate.charge,
                        isTax: rate.isTax || false
                    }))
                });

                return shipment.manualRates.map((rate, index) => ({
                    id: rate.id || `quickship_${index}`, // 🔧 Add unique ID
                    description: rate.chargeName || rate.description || '',
                    quotedCost: parseFloat(rate.cost) || 0,
                    quotedCharge: parseFloat(rate.charge) || 0,
                    actualCost: parseFloat(rate.actualCost) || 0,
                    actualCharge: parseFloat(rate.actualCharge) || 0,
                    code: rate.code || 'FRT',
                    invoiceNumber: rate.invoiceNumber || '-',
                    ediNumber: rate.ediNumber || '-',
                    commissionable: rate.commissionable || false,
                    // Preserve tax flags
                    isTax: rate.isTax || false,
                    isMarkup: rate.isMarkup || false
                }));
            }
        } else {
            // For regular shipments: Use the original priority order

            // Priority 1: Check for saved charges from database (highest priority)
            if (shipment?.updatedCharges && Array.isArray(shipment.updatedCharges) && shipment.updatedCharges.length > 0) {
                console.log('🔧 DEBUG: Regular shipment getRateBreakdown - loading from updatedCharges:', {
                    shipmentId: shipment.id,
                    updatedChargesCount: shipment.updatedCharges.length,
                    charges: shipment.updatedCharges.map(charge => ({
                        code: charge.code,
                        description: charge.description,
                        quotedCharge: charge.quotedCharge || charge.amount,
                        isTax: charge.isTax || false
                    }))
                });

                return shipment.updatedCharges.map((charge, index) => ({
                    id: charge.id || `updated_${index}`, // 🔧 Add unique ID
                    description: charge.description,
                    quotedCost: parseFloat(charge.quotedCost || charge.cost) || 0, // Fallback to old 'cost' field
                    quotedCharge: parseFloat(charge.quotedCharge || charge.amount) || 0, // Fallback to old 'amount' field
                    actualCost: parseFloat(charge.actualCost) || 0,
                    actualCharge: parseFloat(charge.actualCharge || charge.actualAmount) || 0, // Fallback to old 'actualAmount' field
                    code: charge.code || 'FRT',
                    invoiceNumber: charge.invoiceNumber || '-',
                    ediNumber: charge.ediNumber || '-',
                    commissionable: charge.commissionable || false,
                    // Preserve tax flags
                    isTax: charge.isTax || false,
                    isMarkup: charge.isMarkup || false
                }));
            }

            // Priority 2: Check chargesBreakdown
            if (shipment?.chargesBreakdown && Array.isArray(shipment.chargesBreakdown) && shipment.chargesBreakdown.length > 0) {
                console.log('🔧 DEBUG: Regular shipment getRateBreakdown - loading from chargesBreakdown:', {
                    shipmentId: shipment.id,
                    chargesBreakdownCount: shipment.chargesBreakdown.length,
                    charges: shipment.chargesBreakdown.map(charge => ({
                        code: charge.code,
                        description: charge.description,
                        quotedCharge: charge.quotedCharge || charge.amount,
                        isTax: charge.isTax || false
                    }))
                });

                return shipment.chargesBreakdown.map((charge, index) => ({
                    id: charge.id || `breakdown_${index}`, // 🔧 Add unique ID
                    description: charge.description,
                    quotedCost: parseFloat(charge.quotedCost || charge.cost) || 0, // Fallback to old 'cost' field
                    quotedCharge: parseFloat(charge.quotedCharge || charge.amount) || 0, // Fallback to old 'amount' field
                    actualCost: parseFloat(charge.actualCost) || 0,
                    actualCharge: parseFloat(charge.actualCharge || charge.actualAmount) || 0, // Fallback to old 'actualAmount' field
                    code: charge.code || 'FRT',
                    invoiceNumber: charge.invoiceNumber || '-',
                    ediNumber: charge.ediNumber || '-',
                    commissionable: charge.commissionable || false,
                    // Preserve tax flags
                    isTax: charge.isTax || false,
                    isMarkup: charge.isMarkup || false
                }));
            }
        }

        // Priority 3: QuickShip data
        if (quickShipData && quickShipData.charges.length > 0) {
            // QuickShip manual rates - get codes from original manualRates
            quickShipData.charges.forEach((charge, index) => {
                const originalRate = shipment?.manualRates?.[index];
                breakdown.push({
                    id: charge.id || `quickship_data_${index}`, // 🔧 Add unique ID
                    description: charge.name,
                    quotedCost: charge.cost || 0, // QuickShip cost becomes quoted cost
                    quotedCharge: charge.amount || 0, // QuickShip amount becomes quoted charge
                    actualCost: 0, // No actual cost initially
                    actualCharge: 0, // No actual charge initially
                    code: originalRate?.code || 'FRT',
                    invoiceNumber: '-',
                    ediNumber: '-',
                    commissionable: false,
                    // Preserve tax flags
                    isTax: charge.isTax || false,
                    isMarkup: charge.isMarkup || false
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
        totalActualCharge: localTotalActualCharge,
        effectiveTotalCost: localEffectiveTotalCost,
        effectiveTotalCharge: localEffectiveTotalCharge,
        totalProfit: localTotalProfit
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
                                    onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        handleAddCharge();
                                    }}
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
                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', width: '200px' }}>
                                            Description
                                        </TableCell>
                                        {enhancedIsAdmin && (
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'left', width: '90px' }}>
                                                Quoted Cost
                                            </TableCell>
                                        )}
                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'left', width: '90px' }}>
                                            {enhancedIsAdmin ? 'Quoted Charge' : 'Amount'}
                                        </TableCell>
                                        {enhancedIsAdmin && (
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'left', width: '90px' }}>
                                                Actual Cost
                                            </TableCell>
                                        )}
                                        {enhancedIsAdmin && (
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'left', width: '90px' }}>
                                                Actual Charge
                                            </TableCell>
                                        )}
                                        {enhancedIsAdmin && (
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'left', width: '90px' }}>
                                                Profit
                                            </TableCell>
                                        )}
                                        {enhancedIsAdmin && (
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'left', width: '120px' }}>
                                                Invoice#
                                            </TableCell>
                                        )}
                                        {enhancedIsAdmin && (
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'left', width: '120px' }}>
                                                EDI#
                                            </TableCell>
                                        )}
                                        {enhancedIsAdmin && (
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'center', width: '60px' }}>
                                                CMN
                                            </TableCell>
                                        )}
                                        {enhancedIsAdmin && (
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'center', width: '60px' }}>
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
                                                            disabled={loadingChargeTypes}
                                                            sx={{
                                                                '& .MuiSelect-select': { fontSize: '12px', padding: '6px 8px' },
                                                                '& .MuiInputBase-root': { height: '32px' }
                                                            }}
                                                        >
                                                            {loadingChargeTypes ? (
                                                                <MenuItem disabled sx={{ fontSize: '12px' }}>Loading...</MenuItem>
                                                            ) : availableChargeTypes.length > 0 ? (
                                                                availableChargeTypes.map(chargeType => (
                                                                    <MenuItem key={chargeType.value} value={chargeType.value} sx={{ fontSize: '12px' }}>
                                                                        <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                                                                            <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                                {chargeType.value}
                                                                            </Typography>
                                                                            {(chargeType.label || chargeType.description) && (
                                                                                <Typography sx={{ fontSize: '10px', color: '#6b7280', fontStyle: 'italic' }}>
                                                                                    {chargeType.label || chargeType.description}
                                                                                </Typography>
                                                                            )}
                                                                        </Box>
                                                                    </MenuItem>
                                                                ))
                                                            ) : (
                                                                // Fallback to static options if dynamic loading fails
                                                                RATE_CODE_OPTIONS.map(option => (
                                                                    <MenuItem key={option.value} value={option.value} sx={{ fontSize: '12px' }}>
                                                                        {option.label}
                                                                    </MenuItem>
                                                                ))
                                                            )}
                                                            {chargeTypesError && (
                                                                <MenuItem disabled sx={{ fontSize: '11px', color: '#dc2626', fontStyle: 'italic' }}>
                                                                    Error loading charge types
                                                                </MenuItem>
                                                            )}
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
                                                                '& .MuiInputBase-root': { height: '32px' },
                                                                // Hide number input spinners
                                                                '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                                                                    WebkitAppearance: 'none',
                                                                    margin: 0
                                                                },
                                                                '& input[type=number]': {
                                                                    MozAppearance: 'textfield'
                                                                }
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
                                                            '& .MuiInputBase-root': { height: '32px' },
                                                            // Hide number input spinners
                                                            '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                                                                WebkitAppearance: 'none',
                                                                margin: 0
                                                            },
                                                            '& input[type=number]': {
                                                                MozAppearance: 'textfield'
                                                            }
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
                                                                '& .MuiInputBase-root': { height: '32px' },
                                                                // Hide number input spinners
                                                                '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                                                                    WebkitAppearance: 'none',
                                                                    margin: 0
                                                                },
                                                                '& input[type=number]': {
                                                                    MozAppearance: 'textfield'
                                                                }
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
                                                                '& .MuiInputBase-root': { height: '32px' },
                                                                // Hide number input spinners
                                                                '& input[type=number]::-webkit-outer-spin-button, & input[type=number]::-webkit-inner-spin-button': {
                                                                    WebkitAppearance: 'none',
                                                                    margin: 0
                                                                },
                                                                '& input[type=number]': {
                                                                    MozAppearance: 'textfield'
                                                                }
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
                                                        // Show calculated profit during editing using smart logic
                                                        (() => {
                                                            const profit = calculateLineItemProfit({
                                                                ...editingValues,
                                                                code: item.code, // Include code for tax detection
                                                                isTax: item.isTax // Include tax flag
                                                            });

                                                            // Tax charges show N/A instead of profit
                                                            if (profit === null) {
                                                                return (
                                                                    <Typography sx={{
                                                                        fontSize: '12px',
                                                                        color: '#6b7280',
                                                                        fontWeight: 400,
                                                                        fontStyle: 'italic'
                                                                    }}>
                                                                        N/A
                                                                    </Typography>
                                                                );
                                                            }

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
                                                        // Show calculated profit for each line item using smart logic
                                                        !item.isMarkup ? (() => {
                                                            const profit = calculateLineItemProfit(item);

                                                            // Tax charges show N/A instead of profit
                                                            if (profit === null) {
                                                                return (
                                                                    <Typography sx={{
                                                                        fontSize: '12px',
                                                                        color: '#6b7280',
                                                                        fontWeight: 400,
                                                                        fontStyle: 'italic'
                                                                    }}>
                                                                        N/A
                                                                    </Typography>
                                                                );
                                                            }

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
                                                    {editingIndex === index ? (
                                                        <TextField
                                                            value={editingValues.invoiceNumber || ''}
                                                            onChange={(e) => handleInputChange('invoiceNumber', e.target.value)}
                                                            size="small"
                                                            fullWidth
                                                            placeholder="Invoice #"
                                                            sx={{
                                                                '& .MuiInputBase-input': { fontSize: '12px' },
                                                                '& .MuiInputBase-root': { height: '32px' }
                                                            }}
                                                        />
                                                    ) : (
                                                        <Typography sx={{ fontSize: '12px', color: item.invoiceNumber && item.invoiceNumber !== '-' ? '#374151' : '#6b7280' }}>
                                                            {item.invoiceNumber || '-'}
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                            )}
                                            {enhancedIsAdmin && (
                                                <TableCell sx={{ fontSize: '12px', textAlign: 'left', verticalAlign: 'middle' }}>
                                                    {editingIndex === index ? (
                                                        <TextField
                                                            value={editingValues.ediNumber || ''}
                                                            onChange={(e) => handleInputChange('ediNumber', e.target.value)}
                                                            size="small"
                                                            fullWidth
                                                            placeholder="EDI #"
                                                            sx={{
                                                                '& .MuiInputBase-input': { fontSize: '12px' },
                                                                '& .MuiInputBase-root': { height: '32px' }
                                                            }}
                                                        />
                                                    ) : (
                                                        <Typography sx={{ fontSize: '12px', color: item.ediNumber && item.ediNumber !== '-' ? '#374151' : '#6b7280' }}>
                                                            {item.ediNumber || '-'}
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                            )}
                                            {enhancedIsAdmin && (
                                                <TableCell sx={{ fontSize: '12px', textAlign: 'center', verticalAlign: 'middle' }}>
                                                    <Checkbox
                                                        checked={editingIndex === index ? (editingValues.commissionable || false) : (item.commissionable || false)}
                                                        onChange={(e) => {
                                                            if (editingIndex === index) {
                                                                // Update editing values when in edit mode
                                                                handleInputChange('commissionable', e.target.checked);
                                                            } else {
                                                                // Direct update when not in edit mode
                                                                const updatedBreakdown = [...localRateBreakdown];
                                                                updatedBreakdown[index] = {
                                                                    ...updatedBreakdown[index],
                                                                    commissionable: e.target.checked
                                                                };
                                                                setLocalRateBreakdown(updatedBreakdown);
                                                                // Fire and forget for optimistic updates
                                                                onChargesUpdate(updatedBreakdown).catch(error => {
                                                                    console.error('❌ Error saving commissionable flag:', error);
                                                                });
                                                            }
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
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        handleEditSave(index);
                                                                    }}
                                                                    sx={{ color: '#059669' }}
                                                                >
                                                                    <CheckIcon sx={{ fontSize: 16 }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                            <Tooltip title="Cancel">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        handleEditCancel();
                                                                    }}
                                                                    sx={{ color: '#dc2626' }}
                                                                >
                                                                    <CancelIcon sx={{ fontSize: 16 }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </Box>
                                                    ) : (
                                                        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                                            <Tooltip title="Actions">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        e.stopPropagation();
                                                                        handleMenuOpen(e, index);
                                                                    }}
                                                                    sx={{ color: '#6b7280' }}
                                                                >
                                                                    <MoreVertIcon sx={{ fontSize: 16 }} />
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
                                                {formatCurrency(localEffectiveTotalCost)}
                                                {localTotalActualCost > 0 && (
                                                    <Typography variant="caption" sx={{
                                                        fontSize: '10px',
                                                        color: '#059669',
                                                        display: 'block',
                                                        fontWeight: 400
                                                    }}>
                                                        (with actuals)
                                                    </Typography>
                                                )}
                                            </TableCell>
                                        )}
                                        <TableCell sx={{ fontSize: '14px', textAlign: 'left', fontWeight: 700 }}>
                                            {formatCurrency(localEffectiveTotalCharge)}
                                            {localTotalActualCharge > 0 && (
                                                <Typography variant="caption" sx={{
                                                    fontSize: '10px',
                                                    color: '#059669',
                                                    display: 'block',
                                                    fontWeight: 400
                                                }}>
                                                    (with actuals)
                                                </Typography>
                                            )}
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
                                                    // Use the comprehensive profit calculation from calculateLocalTotals
                                                    const profit = localTotalProfit;
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

            {/* Action Menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                PaperProps={{
                    sx: {
                        minWidth: 100,
                        '& .MuiMenuItem-root': {
                            fontSize: '11px',
                            px: 1.5,
                            py: 0.5,
                            minHeight: 'auto'
                        }
                    }
                }}
            >
                <MenuItem onClick={handleMenuEdit}>
                    <ListItemIcon sx={{ minWidth: 24 }}>
                        <EditIcon sx={{ fontSize: 14 }} />
                    </ListItemIcon>
                    <ListItemText
                        primary="Edit"
                        primaryTypographyProps={{ fontSize: '11px' }}
                    />
                </MenuItem>
                <MenuItem onClick={handleMenuDelete} sx={{ color: '#dc2626' }}>
                    <ListItemIcon sx={{ minWidth: 24 }}>
                        <DeleteIcon sx={{ fontSize: 14, color: '#dc2626' }} />
                    </ListItemIcon>
                    <ListItemText
                        primary="Delete"
                        primaryTypographyProps={{ fontSize: '11px' }}
                    />
                </MenuItem>
            </Menu>
        </Grid>
    );
};

export default RateDetails; 