import React, { useState, useCallback, useEffect } from 'react';
import rateDataManager from '../../../utils/rateDataManager';
import currencyConversionService from '../../../services/currencyConversionService';
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
import { getDisplayCarrierName } from '../../../utils/carrierDisplayService';
import { hasPermission, PERMISSIONS } from '../../../utils/rolePermissions';
import { db } from '../../../firebase';
import { doc, getDoc } from 'firebase/firestore';

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
    { value: 'CUS', label: 'CUS', description: 'Customs Brokerage' },
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
    const [profitCalculations, setProfitCalculations] = useState({}); // Store profit results
    const [exchangeRates, setExchangeRates] = useState(null); // Cache exchange rates
    const [totalsData, setTotalsData] = useState(null); // Store calculated totals

    // State for action menu
    const [anchorEl, setAnchorEl] = useState(null);
    const [menuRowIndex, setMenuRowIndex] = useState(null);

    // State for tax calculation
    const [isCalculatingTaxes, setIsCalculatingTaxes] = useState(false);

    // State to prevent refresh cycle after saving
    const [isSavingCharges, setIsSavingCharges] = useState(false);

    // Manual refresh trigger (increment to force refresh)
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Company data state for carrier overrides
    const [companyData, setCompanyData] = useState(null);

    // Enhanced admin check using the userRole from AuthContext
    const enhancedIsAdmin = userRole && (
        ['admin', 'superadmin', 'super_admin'].includes(userRole.toLowerCase())
    );

    // Allow inline editing when the role has EDIT_SHIPMENTS permission (company admins included)
    const canEditCharges = React.useMemo(() => {
        try {
            return hasPermission(userRole, PERMISSIONS.EDIT_SHIPMENTS) === true;
        } catch (e) {
            return enhancedIsAdmin; // safe fallback
        }
    }, [userRole, enhancedIsAdmin]);

    // Financial visibility flag (quoted/actual/profit columns)
    const canViewFinancials = React.useMemo(() => {
        try {
            return hasPermission(userRole, PERMISSIONS.VIEW_SHIPMENT_FINANCIALS) === true;
        } catch (e) {
            return enhancedIsAdmin; // safe fallback
        }
    }, [userRole, enhancedIsAdmin]);

    // Check if this is an admin view (admins should see real carrier names)
    const isAdminView = enhancedIsAdmin || userRole === 'admin' || userRole === 'superadmin';

    // Check if this is a QuickShip shipment
    const isQuickShip = shipment?.creationMethod === 'quickship';

    // Load company data for carrier overrides
    useEffect(() => {
        const loadCompanyData = async () => {
            const shipmentCompanyId = shipment?.companyID || shipment?.companyId;

            if (!shipmentCompanyId || isAdminView) {
                setCompanyData(null);
                return;
            }

            try {
                const companyRef = doc(db, 'companies', shipmentCompanyId);
                const companyDoc = await getDoc(companyRef);

                if (companyDoc.exists()) {
                    setCompanyData(companyDoc.data());
                } else {
                    setCompanyData(null);
                }
            } catch (error) {
                console.error('Error loading company data for carrier overrides:', error);
                setCompanyData(null);
            }
        };

        loadCompanyData();
    }, [shipment?.companyID, shipment?.companyId, isAdminView]);

    // Get markup information for admin users
    const markupSummary = enhancedIsAdmin && getBestRateInfo ? getMarkupSummary(getBestRateInfo) : null;

    const safeNumber = (value) => {
        return isNaN(parseFloat(value)) ? 0 : parseFloat(value);
    };

    // Resolve a human-friendly description for a charge item using multiple fallbacks
    const resolveChargeDescription = useCallback((charge) => {
        // 1) Explicit description on the item
        if (charge?.description && String(charge.description).trim() !== '') {
            return String(charge.description).trim();
        }
        // 2) Name field from universal rate structure
        if (charge?.name && String(charge.name).trim() !== '') {
            return String(charge.name).trim();
        }
        // 3) Fallback via known static code mappings
        const byCode = RATE_CODE_OPTIONS.find(opt => opt.value === charge?.code);
        if (byCode) {
            // Prefer short, user-facing label/description over raw code
            return byCode.label || byCode.description || byCode.value;
        }
        // 4) Last resort: show the code if present
        if (charge?.code) return String(charge.code);
        return 'Unknown Charge';
    }, []);

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
        console.log('💱 RateDetails Debug: handleEditStart called', {
            index,
            item: item,
            itemKeys: Object.keys(item),
            currencyFields: {
                quotedCostCurrency: item.quotedCostCurrency,
                quotedChargeCurrency: item.quotedChargeCurrency,
                actualCostCurrency: item.actualCostCurrency,
                actualChargeCurrency: item.actualChargeCurrency,
                currency: item.currency
            }
        });

        setEditingIndex(index);
        setEditingValues({
            description: item.description,
            quotedCost: item.quotedCost?.toString() || '0',
            quotedCharge: item.quotedCharge?.toString() || '0',
            actualCost: item.actualCost?.toString() || '0',
            actualCharge: item.actualCharge?.toString() || '0',
            code: item.code || 'FRT',
            quotedCostCurrency: item.quotedCostCurrency || 'CAD',
            quotedChargeCurrency: item.quotedChargeCurrency || 'CAD',
            actualCostCurrency: item.actualCostCurrency || 'CAD',
            actualChargeCurrency: item.actualChargeCurrency || 'CAD',
            invoiceNumber: item.invoiceNumber || '-',
            ediNumber: item.ediNumber || '-',
            commissionable: item.commissionable || false
        });

        console.log('💱 RateDetails Debug: editingValues set to', {
            quotedCostCurrency: item.quotedCostCurrency || 'CAD',
            quotedChargeCurrency: item.quotedChargeCurrency || 'CAD',
            actualCostCurrency: item.actualCostCurrency || 'CAD',
            actualChargeCurrency: item.actualChargeCurrency || 'CAD'
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
            // CRITICAL FIX: Preserve existing ID to prevent duplication
            id: updatedBreakdown[index].id,
            description: editingValues.description.trim(),
            quotedCost: parseFloat(editingValues.quotedCost) || 0,
            quotedCharge: parseFloat(editingValues.quotedCharge) || 0,
            actualCost: parseFloat(editingValues.actualCost) || 0,
            actualCharge: parseFloat(editingValues.actualCharge) || 0,
            code: editingValues.code || 'FRT',
            quotedCostCurrency: editingValues.quotedCostCurrency || 'CAD',
            quotedChargeCurrency: editingValues.quotedChargeCurrency || 'CAD',
            actualCostCurrency: editingValues.actualCostCurrency || 'CAD',
            actualChargeCurrency: editingValues.actualChargeCurrency || 'CAD',
            invoiceNumber: editingValues.invoiceNumber || '-',
            ediNumber: editingValues.ediNumber || '-',
            commissionable: editingValues.commissionable || false
        };

        updatedBreakdown[index] = updatedItem;

        // Always recalc Canadian taxes after any non-tax line change (freight, fuel, etc.)
        // If a tax line itself is edited, skip recalculation to respect manual tax edits
        const isEditingTaxCharge = updatedItem.isTax || isTaxCharge(updatedItem.code);

        console.log('💱 RateDetails Debug: Before tax recalculation', {
            isEditingTaxCharge,
            beforeTaxRecalc: updatedBreakdown[index],
            currencies: {
                quotedCostCurrency: updatedBreakdown[index].quotedCostCurrency,
                quotedChargeCurrency: updatedBreakdown[index].quotedChargeCurrency,
                actualCostCurrency: updatedBreakdown[index].actualCostCurrency,
                actualChargeCurrency: updatedBreakdown[index].actualChargeCurrency
            },
            editingValues: {
                quotedCostCurrency: editingValues.quotedCostCurrency,
                quotedChargeCurrency: editingValues.quotedChargeCurrency,
                actualCostCurrency: editingValues.actualCostCurrency,
                actualChargeCurrency: editingValues.actualChargeCurrency
            }
        });

        if (
            shipment?.shipFrom && shipment?.shipTo &&
            isCanadianDomesticShipment(shipment.shipFrom, shipment.shipTo) &&
            !isEditingTaxCharge) {
            const province = shipment.shipTo?.state;
            if (province) {
                updatedBreakdown = updateRateAndRecalculateTaxes(updatedBreakdown, updatedItem, province, availableChargeTypes || [], shipment?.id);

                console.log('💱 RateDetails Debug: After tax recalculation', {
                    afterTaxRecalc: updatedBreakdown[index],
                    currencies: {
                        quotedCostCurrency: updatedBreakdown[index].quotedCostCurrency,
                        quotedChargeCurrency: updatedBreakdown[index].quotedChargeCurrency,
                        actualCostCurrency: updatedBreakdown[index].actualCostCurrency,
                        actualChargeCurrency: updatedBreakdown[index].actualChargeCurrency
                    }
                });
            }
        }

        console.log('💾 Saving charge data:', updatedBreakdown[index]);

        // 🧹 CRITICAL: NO OPTIMISTIC UPDATE - Save first, then let refresh handle UI update
        // This prevents temporary duplicates by avoiding dual state updates
        if (onChargesUpdate) {
            try {
                setIsSavingCharges(true); // Prevent refresh during save
                const result = await onChargesUpdate(updatedBreakdown);
                if (result && result.success) {
                    console.log('✅ Charge saved successfully - exiting edit mode');
                    // Only exit edit mode after successful save
                    setEditingIndex(null);
                    setEditingValues({});
                    // Clear saving flag immediately - the backend state is now updated
                    setIsSavingCharges(false);
                    // 🔄 Trigger manual refresh to get updated data from backend
                    setRefreshTrigger(prev => prev + 1);
                } else {
                    throw new Error(result?.error || 'Save failed');
                }
            } catch (error) {
                console.error('❌ Error saving charges:', error);
                setIsSavingCharges(false); // Clear flag on error
                // Stay in edit mode with current values on error
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
            quotedCostCurrency: 'CAD',
            quotedChargeCurrency: 'CAD',
            actualCostCurrency: 'CAD',
            actualChargeCurrency: 'CAD',
            isNew: true,
            invoiceNumber: '-',
            ediNumber: '-',
            commissionable: defaultCommissionable // Auto-populate based on charge type
        };

        let updatedBreakdown = [...localRateBreakdown, newCharge];

        // 🔧 CRITICAL FIX: Only add taxes if none exist, preserve existing taxes
        const existingTaxCharges = localRateBreakdown.filter(charge => charge.isTax || isTaxCharge(charge.code));

        if (shipment?.shipFrom && shipment?.shipTo &&
            isCanadianDomesticShipment(shipment.shipFrom, shipment.shipTo)) {
            const province = shipment.shipTo?.state;

            if (province && existingTaxCharges.length === 0) {
                // Only add taxes if none exist
                console.log('🍁 Canadian Tax: Adding taxes after adding first charge');
                updatedBreakdown = addRateAndRecalculateTaxes(localRateBreakdown, newCharge, province, availableChargeTypes || [], shipment?.id);
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
            quotedCostCurrency: 'CAD',
            quotedChargeCurrency: 'CAD',
            actualCostCurrency: 'CAD',
            actualChargeCurrency: 'CAD',
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

        if (shipment?.shipFrom && shipment?.shipTo &&
            isCanadianDomesticShipment(shipment.shipFrom, shipment.shipTo)) {
            const province = shipment.shipTo?.state;

            if (province && chargeToDelete && isDeletedChargeTax) {
                // Only recalculate taxes if we're deleting a tax charge
                console.log('🍁 Canadian Tax: Recalculating taxes after deleting tax charge');
                updatedBreakdown = removeRateAndRecalculateTaxes(localRateBreakdown, chargeToDelete.id, province, availableChargeTypes || [], shipment?.id);
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
            setIsSavingCharges(true);
            // Don't await - fire and forget for true optimistic updates
            onChargesUpdate(updatedBreakdown)
                .then(() => {
                    setTimeout(() => {
                        setIsSavingCharges(false);
                        // 🔄 Trigger manual refresh to get updated data from backend
                        setRefreshTrigger(prev => prev + 1);
                    }, 500);
                })
                .catch(error => {
                    console.error('❌ Error saving charges:', error);
                    setIsSavingCharges(false);
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

    // Enhanced profit calculation logic with currency conversion for individual line items
    const calculateLineItemProfit = useCallback(async (item, exchangeRates = null) => {
        console.log(`🎯 calculateLineItemProfit called for item ${item.id}:`, {
            code: item.code,
            description: item.description,
            isTax: item.isTax,
            isTaxChargeResult: isTaxCharge(item.code),
            actualCost: item.actualCost,
            actualCharge: item.actualCharge,
            quotedCost: item.quotedCost,
            quotedCharge: item.quotedCharge
        });

        // Tax charges should not have profit calculations - they are pass-through charges
        if (item.isTax || isTaxCharge(item.code)) {
            console.log(`🚫 Returning null for tax charge: ${item.code}`);
            return null; // Special value to indicate $0.00 for taxes
        }

        const actualCost = parseFloat(item.actualCost) || 0;
        const quotedCost = parseFloat(item.quotedCost) || 0;
        const actualCharge = parseFloat(item.actualCharge) || 0;
        const quotedCharge = parseFloat(item.quotedCharge) || 0;

        // Get currency information
        const actualCostCurrency = item.actualCostCurrency || item.currency || 'CAD';
        const quotedCostCurrency = item.quotedCostCurrency || item.currency || 'CAD';
        const actualChargeCurrency = item.actualChargeCurrency || item.currency || 'CAD';
        const quotedChargeCurrency = item.quotedChargeCurrency || item.currency || 'CAD';

        // Profit Calculation Priority Logic:
        // 1. If both actual cost and actual charge exist: actualCharge - actualCost
        // 2. If only actual cost exists: quotedCharge - actualCost  
        // 3. If only actual charge exists: actualCharge - quotedCost
        // 4. If neither actual exists: quotedCharge - quotedCost

        let costAmount, chargeAmount, costCurrency, chargeCurrency;

        if (actualCost > 0 && actualCharge > 0) {
            // Both actual values available - most accurate scenario
            costAmount = actualCost;
            chargeAmount = actualCharge;
            costCurrency = actualCostCurrency;
            chargeCurrency = actualChargeCurrency;
        } else if (actualCost > 0) {
            // Only actual cost available - use with quoted charge
            costAmount = actualCost;
            chargeAmount = quotedCharge;
            costCurrency = actualCostCurrency;
            chargeCurrency = quotedChargeCurrency;
        } else if (actualCharge > 0) {
            // Only actual charge available - use with quoted cost
            costAmount = quotedCost;
            chargeAmount = actualCharge;
            costCurrency = quotedCostCurrency;
            chargeCurrency = actualChargeCurrency;
        } else {
            // No actual values - use quoted values
            costAmount = quotedCost;
            chargeAmount = quotedCharge;
            costCurrency = quotedCostCurrency;
            chargeCurrency = quotedChargeCurrency;
        }

        // If currencies are the same, do simple calculation
        if (costCurrency === chargeCurrency) {
            const profit = chargeAmount - costAmount;
            console.log(`💰 Simple profit calculation for ${item.id}: ${chargeAmount} - ${costAmount} = ${profit}`);
            return {
                profit: profit,
                currency: chargeCurrency,
                conversionApplied: false
            };
        }

        // Apply currency conversion for different currencies
        try {
            // Get exchange rates (use provided rates or fetch latest)
            const rates = exchangeRates || await currencyConversionService.getLatestRates();

            // Get shipment date for historical rates
            const shipmentDate = shipment?.bookedAt || shipment?.createdAt || shipment?.shipmentDate;

            const profitResult = await currencyConversionService.calculateProfitWithConversion(
                costAmount,
                costCurrency,
                chargeAmount,
                chargeCurrency,
                shipmentDate
            );

            return {
                profit: profitResult.profit,
                currency: profitResult.currency,
                conversionApplied: profitResult.conversionApplied,
                costConverted: profitResult.costConverted,
                chargeConverted: profitResult.chargeConverted,
                exchangeRateUsed: profitResult.exchangeRateUsed,
                exchangeRatesUsed: profitResult.exchangeRatesUsed // Include detailed exchange rate info
            };

        } catch (error) {
            console.error('Currency conversion failed, using simple calculation:', error);
            return {
                profit: chargeAmount - costAmount,
                currency: chargeCurrency,
                conversionApplied: false,
                error: error.message
            };
        }
    }, [shipment]);

    // Load exchange rates and calculate profits for all line items
    useEffect(() => {
        const loadExchangeRatesAndCalculateProfits = async () => {
            if (!localRateBreakdown.length) {
                console.log('⚠️ No localRateBreakdown items to calculate profits for');
                return;
            }

            console.log('💰 Starting profit calculations for', localRateBreakdown.length, 'items:', localRateBreakdown);

            try {
                // Load exchange rates once for all calculations
                const shipmentDate = shipment?.bookedAt || shipment?.createdAt || shipment?.shipmentDate;
                console.log('📅 [RateDetails] Shipment date for exchange rates:', {
                    shipmentDate,
                    bookedAt: shipment?.bookedAt,
                    createdAt: shipment?.createdAt,
                    shipmentInfoDate: shipment?.shipmentDate
                });

                const rates = shipmentDate
                    ? await currencyConversionService.getRatesForDate(new Date(shipmentDate))
                    : await currencyConversionService.getLatestRates();

                console.log('💱 Exchange rates loaded:', rates);
                setExchangeRates(rates);

                // Calculate profits for all line items
                const profitResults = {};

                for (const item of localRateBreakdown) {
                    console.log(`💰 Processing item ${item.id} (${item.description}):`, {
                        isTax: item.isTax,
                        code: item.code,
                        quotedCost: item.quotedCost,
                        quotedCharge: item.quotedCharge,
                        actualCost: item.actualCost,
                        actualCharge: item.actualCharge
                    });

                    if (item.isTax || isTaxCharge(item.code)) {
                        console.log(`💰 Tax item ${item.id}: Setting profit to null`);
                        profitResults[item.id] = null; // $0.00 for tax charges
                        continue;
                    }

                    // CRITICAL DEBUG: Check if FRT is being incorrectly identified as tax
                    console.log(`🔍 PROFIT DEBUG: Processing non-tax item ${item.id}:`, {
                        code: item.code,
                        description: item.description,
                        isTax: item.isTax,
                        isTaxChargeResult: isTaxCharge(item.code),
                        actualCost: item.actualCost,
                        actualCharge: item.actualCharge,
                        quotedCost: item.quotedCost,
                        quotedCharge: item.quotedCharge
                    });

                    try {
                        // Convert async function to return promise
                        const profitResult = await calculateLineItemProfit(item, rates);
                        console.log(`💰 Calculated profit for item ${item.id}:`, profitResult);
                        profitResults[item.id] = profitResult;
                    } catch (error) {
                        console.error(`❌ Error calculating profit for item ${item.id}:`, error);
                        // Fallback to simple calculation
                        const actualCost = parseFloat(item.actualCost) || 0;
                        const quotedCost = parseFloat(item.quotedCost) || 0;
                        const actualCharge = parseFloat(item.actualCharge) || 0;
                        const quotedCharge = parseFloat(item.quotedCharge) || 0;

                        let profit = 0;
                        if (actualCost > 0 && actualCharge > 0) {
                            profit = actualCharge - actualCost;
                        } else if (actualCost > 0) {
                            profit = quotedCharge - actualCost;
                        } else if (actualCharge > 0) {
                            profit = actualCharge - quotedCost;
                        } else {
                            profit = quotedCharge - quotedCost;
                        }

                        profitResults[item.id] = {
                            profit,
                            currency: item.currency || 'CAD',
                            conversionApplied: false,
                            error: error.message
                        };
                    }
                }

                console.log('💰 Final profit results being set:', profitResults);
                setProfitCalculations(profitResults);

            } catch (error) {
                console.error('❌ Error loading exchange rates or calculating profits:', error);
            }
        };

        loadExchangeRatesAndCalculateProfits();
    }, [localRateBreakdown, calculateLineItemProfit, shipment]);

    // Calculate totals from local breakdown with proper currency conversion to CAD
    const calculateLocalTotals = useCallback(async () => {
        const baseCurrency = 'CAD'; // Always use CAD as base currency

        // Get exchange rates for conversion
        const shipmentDate = shipment?.bookedAt || shipment?.createdAt || shipment?.shipmentDate;
        console.log('💱 [Totals] Loading exchange rates for totals calculation:', { shipmentDate });

        let rates = exchangeRates;
        if (!rates) {
            try {
                rates = shipmentDate
                    ? await currencyConversionService.getRatesForDate(new Date(shipmentDate))
                    : await currencyConversionService.getLatestRates();
                console.log('💱 [Totals] Exchange rates loaded for totals:', {
                    USD: rates.USD,
                    provider: rates.provider,
                    isFallback: rates.isFallback,
                    timestamp: rates.timestamp
                });
            } catch (error) {
                console.error('❌ [Totals] Failed to load rates for totals calculation:', error);
                rates = currencyConversionService.getFallbackRates();
            }
        }

        // Calculate converted totals in CAD
        let totalQuotedCostCAD = 0;
        let totalQuotedChargeCAD = 0;
        let totalActualCostCAD = 0;
        let totalActualChargeCAD = 0;
        let effectiveTotalCostCAD = 0;
        let effectiveTotalChargeCAD = 0;

        for (const item of localRateBreakdown) {
            // Skip tax items for cost/charge calculations (but include in effective totals)
            const isTax = item.isTax || isTaxCharge(item.code);

            // Get currencies for this item
            const quotedCostCurrency = item.quotedCostCurrency || item.currency || baseCurrency;
            const quotedChargeCurrency = item.quotedChargeCurrency || item.currency || baseCurrency;
            const actualCostCurrency = item.actualCostCurrency || item.currency || baseCurrency;
            const actualChargeCurrency = item.actualChargeCurrency || item.currency || baseCurrency;

            // Convert quoted amounts to CAD
            const quotedCostCAD = currencyConversionService.convertCurrency(
                parseFloat(item.quotedCost) || 0,
                quotedCostCurrency,
                baseCurrency,
                rates
            );
            const quotedChargeCAD = currencyConversionService.convertCurrency(
                parseFloat(item.quotedCharge) || 0,
                quotedChargeCurrency,
                baseCurrency,
                rates
            );

            // Convert actual amounts to CAD
            const actualCostCAD = currencyConversionService.convertCurrency(
                parseFloat(item.actualCost) || 0,
                actualCostCurrency,
                baseCurrency,
                rates
            );
            const actualChargeCAD = currencyConversionService.convertCurrency(
                parseFloat(item.actualCharge) || 0,
                actualChargeCurrency,
                baseCurrency,
                rates
            );

            // Add to totals
            totalQuotedCostCAD += quotedCostCAD;
            totalQuotedChargeCAD += quotedChargeCAD;
            totalActualCostCAD += actualCostCAD;
            totalActualChargeCAD += actualChargeCAD;

            // Calculate effective amounts (actual preferred, fallback to quoted)
            const effectiveCostCAD = actualCostCAD > 0 ? actualCostCAD : quotedCostCAD;
            const effectiveChargeCAD = actualChargeCAD > 0 ? actualChargeCAD : quotedChargeCAD;

            effectiveTotalCostCAD += effectiveCostCAD;
            effectiveTotalChargeCAD += effectiveChargeCAD;
        }

        // Calculate total profit using cached profit calculations (all should be in CAD now)
        const totalProfit = localRateBreakdown.reduce((sum, item) => {
            const profitResult = profitCalculations[item.id];
            if (profitResult === null || profitResult === undefined) {
                return sum; // Skip tax charges or uncalculated profits
            }

            // Use the profit amount from the cached calculation (should be in CAD)
            const profit = typeof profitResult === 'object' ? profitResult.profit : profitResult;
            return sum + (profit || 0);
        }, 0);

        // Legacy support - keep these for backward compatibility 
        const totalCost = effectiveTotalCostCAD;
        const totalCharge = effectiveTotalChargeCAD;

        return {
            totalCost,
            totalCharge,
            totalQuotedCost: totalQuotedCostCAD,
            totalQuotedCharge: totalQuotedChargeCAD,
            totalActualCost: totalActualCostCAD,
            totalActualCharge: totalActualChargeCAD,
            totalProfit, // All profits now in CAD
            baseCurrency, // Always CAD
            exchangeRatesUsed: rates
        };
    }, [localRateBreakdown, profitCalculations, exchangeRates, shipment]);

    // Calculate totals whenever profit calculations or exchange rates change
    useEffect(() => {
        const calculateAndStoreTotals = async () => {
            if (!localRateBreakdown.length) {
                setTotalsData(null);
                return;
            }

            try {
                const totals = await calculateLocalTotals();
                setTotalsData(totals);
            } catch (error) {
                console.error('Error calculating totals:', error);
                setTotalsData(null);
            }
        };

        calculateAndStoreTotals();
    }, [localRateBreakdown, profitCalculations, exchangeRates, calculateLocalTotals]);

    // Load dynamic charge types on component mount
    useEffect(() => {
        const loadChargeTypes = async () => {
            setLoadingChargeTypes(true);
            setChargeTypesError(null);

            try {
                console.log('📦 RateDetails: Loading dynamic charge types...');

                // Force fresh load by clearing cache
                shipmentChargeTypeService.lastFetch = null;
                if (shipmentChargeTypeService.cache) {
                    shipmentChargeTypeService.cache.clear();
                }

                const chargeTypes = await shipmentChargeTypeService.getChargeTypes();
                console.log(`📦 RateDetails: Loaded ${chargeTypes.length} charge types:`, chargeTypes.map(ct => `${ct.value} (${ct.label})`));

                // 🔍 DEBUG: Check if CUS charge type is loaded
                const cusChargeType = chargeTypes.find(ct => ct.value === 'CUS');
                if (cusChargeType) {
                    console.log('✅ Found CUS charge type:', cusChargeType);
                } else {
                    console.warn('⚠️ CUS charge type not found in loaded charge types');
                    console.log('Available charge codes:', chargeTypes.map(ct => ct.value));

                    // Add CUS as a temporary fallback if it's missing
                    chargeTypes.push({
                        value: 'CUS',
                        label: 'CUS',
                        description: 'Customs Brokerage',
                        category: 'government',
                        taxable: false,
                        commissionable: true,
                        isDynamic: false,
                        displayOrder: 999
                    });
                    console.log('🔧 Added CUS charge type as fallback');
                }

                setAvailableChargeTypes(chargeTypes);
            } catch (error) {
                console.error('❌ RateDetails: Failed to load charge types:', error);
                setChargeTypesError(error.message);

                // 🔧 FALLBACK: Use basic charge types including CUS
                const fallbackChargeTypes = [
                    { value: 'FRT', label: 'FRT', description: 'Freight', category: 'freight' },
                    { value: 'CUS', label: 'CUS', description: 'Customs Brokerage', category: 'government' },
                    { value: 'ACC', label: 'ACC', description: 'Accessorial', category: 'accessorial' },
                    { value: 'FUE', label: 'FUE', description: 'Fuel Surcharge', category: 'fuel' },
                    { value: 'MSC', label: 'MSC', description: 'Miscellaneous', category: 'miscellaneous' }
                ];
                console.log('🔧 Using fallback charge types including CUS');
                setAvailableChargeTypes(fallbackChargeTypes);
            } finally {
                setLoadingChargeTypes(false);
            }
        };

        loadChargeTypes();
    }, []); // Only load once on component mount

    // Get rate breakdown data for table - UNIFIED VERSION (moved up to fix hoisting issue)
    const getRateBreakdown = React.useCallback(() => {
        console.log('🔧 DEBUG: Getting unified rate breakdown for shipment:', {
            shipmentId: shipment?.id,
            shipmentCreationMethod: shipment?.creationMethod,
            lastModified: shipment?.lastModified
        });

        if (!shipment?.id) {
            console.log('🔧 DEBUG: No shipment ID, returning empty breakdown');
            return [];
        }

        try {
            // Use the unified rate data manager
            const rateData = rateDataManager.convertToUniversalFormat(shipment);

            console.log('🔧 DEBUG: Universal rate data loaded:', {
                shipmentId: shipment.id,
                chargeCount: rateData.charges.length,
                totalCost: rateData.totals.cost,
                totalCharge: rateData.totals.charge,
                carrier: rateData.carrier.name
            });

            // Convert to legacy format for current UI compatibility
            let breakdown = rateData.charges.map((charge, index) => ({
                // CRITICAL FIX: Ensure every item has a consistent ID
                id: charge.id || `${shipment.id}_charge_${index}`,
                code: charge.code || 'UNK',
                // Prefer description, then name, then code-based defaults
                description: resolveChargeDescription(charge),
                quotedCost: charge.quotedCost != null ? charge.quotedCost : 0,
                quotedCharge: charge.quotedCharge != null ? charge.quotedCharge : 0,
                actualCost: charge.actualCost != null ? charge.actualCost : 0,
                actualCharge: charge.actualCharge != null ? charge.actualCharge : 0,
                currency: charge.currency || 'CAD',
                // CRITICAL FIX: Support individual currency fields for each monetary amount
                quotedCostCurrency: charge.quotedCostCurrency || charge.currency || 'CAD',
                quotedChargeCurrency: charge.quotedChargeCurrency || charge.currency || 'CAD',
                actualCostCurrency: charge.actualCostCurrency || charge.currency || 'CAD',
                actualChargeCurrency: charge.actualChargeCurrency || charge.currency || 'CAD',
                isTax: charge.isTax || false,
                taxDetails: charge.taxDetails || null,
                // Preserve financial identifiers if present in source
                invoiceNumber: charge.invoiceNumber != null ? charge.invoiceNumber : '-',
                ediNumber: charge.ediNumber != null ? charge.ediNumber : '-',
                // Preserve commissionable flag
                commissionable: charge.commissionable === true
            }));

            // 🧹 CRITICAL: Remove duplicates based on ID and description to prevent duplication bug
            const seenCharges = new Set();
            breakdown = breakdown.filter(charge => {
                const chargeKey = `${charge.id}_${charge.code}_${charge.description}_${charge.quotedCharge}`;
                if (seenCharges.has(chargeKey)) {
                    console.warn('🚨 Duplicate charge detected and removed:', {
                        id: charge.id,
                        code: charge.code,
                        description: charge.description,
                        quotedCharge: charge.quotedCharge
                    });
                    return false; // Remove duplicate
                }
                seenCharges.add(chargeKey);
                return true; // Keep unique charge
            });

            console.log('✅ Unified rate breakdown complete:', {
                shipmentId: shipment.id,
                itemCount: breakdown.length,
                totalQuotedCost: rateData.totals.cost,
                totalQuotedCharge: rateData.totals.charge
            });

            return breakdown;

        } catch (error) {
            console.error('❌ Error generating rate breakdown:', error);
            return [];
        }
    }, [shipment, resolveChargeDescription]);

    // Smart data refresh - only when safe to do so
    React.useEffect(() => {
        // Only refresh data if:
        // 1. No one is actively editing (editingIndex is null)
        // 2. Not currently saving charges (isSavingCharges is false)
        // 3. Not currently calculating taxes (isCalculatingTaxes is false)
        // 4. shipment ID exists

        const shouldRefresh = editingIndex === null && !isSavingCharges && !isCalculatingTaxes && shipment?.id;

        if (shouldRefresh) {
            // 🧹 CRITICAL: Add delay to ensure backend state is consistent before refresh
            const refreshTimeout = setTimeout(() => {
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
            }, 300); // 300ms delay to ensure backend/frontend sync

            return () => clearTimeout(refreshTimeout);
        } else {
            const reason = editingIndex !== null ? 'user is editing' :
                isSavingCharges ? 'saving charges in progress' :
                    isCalculatingTaxes ? 'calculating taxes in progress' : 'no shipment ID';
            console.log(`⚠️ Skipping rate breakdown reload - ${reason}`);
        }
    }, [shipment?.id, editingIndex, isSavingCharges, isCalculatingTaxes, refreshTrigger, getRateBreakdown]);

    // 🍁 CANADIAN TAX AUTO-CALCULATION - Only add taxes when missing
    React.useEffect(() => {
        // 🧹 CRITICAL: Don't interfere if user is actively editing, calculating taxes, OR saving charges
        if (editingIndex !== null || isCalculatingTaxes || isSavingCharges) return;

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

        // If taxes exist, rebuild them to reflect the latest edited amounts (keeps them in sync)
        const existingTaxCharges = localRateBreakdown.filter(charge => charge.isTax || isTaxCharge(charge.code));

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

        // Calculate what the rates should be with proper taxes (always rebuild to keep in sync)
        // Ensure shipmentType is provided so Quebec freight correctly excludes QST
        shipmentData.shipmentInfo = shipmentData.shipmentInfo || {};
        shipmentData.shipmentInfo.shipmentType = shipment?.shipmentInfo?.shipmentType || shipment?.shipmentType || 'freight';
        const updatedShipmentData = recalculateShipmentTaxes(shipmentData, availableChargeTypes || []);

        // Compare existing vs new tax rows; only save if something actually changed
        const extractTaxRows = (arr) => (arr || [])
            .filter(ch => ch.isTax || isTaxCharge(ch.code))
            .map(ch => ({
                code: String(ch.code || '').toUpperCase(),
                qc: Number(ch.quotedCharge ?? ch.amount ?? 0).toFixed(2),
                ac: Number(ch.actualCharge ?? ch.actualAmount ?? 0).toFixed(2),
                qcost: Number(ch.quotedCost ?? ch.cost ?? 0).toFixed(2),
                acost: Number(ch.actualCost ?? 0).toFixed(2)
            }));

        const taxRowsEqual = (a, b) => {
            if ((a?.length || 0) !== (b?.length || 0)) return false;
            return (a || []).every(row => {
                const match = (b || []).find(r => r.code === row.code);
                if (!match) return false;
                return row.qc === match.qc && row.ac === match.ac && row.qcost === match.qcost && row.acost === match.acost;
            });
        };

        const beforeTax = extractTaxRows(localRateBreakdown);
        const afterTax = extractTaxRows(updatedShipmentData.manualRates);

        if (taxRowsEqual(beforeTax, afterTax)) {
            console.log('🍁 Canadian Tax: No tax changes detected; skipping auto-save');
            return;
        }

        // Check if taxes were actually added/changed
        const newTaxCharges = updatedShipmentData.manualRates.filter(charge => charge.isTax || isTaxCharge(charge.code));

        if (newTaxCharges.length > 0 || existingTaxCharges.length > 0) {
            console.log('🍁 Canadian Tax: Applying (or refreshing) taxes in inline editor', {
                originalCharges: localRateBreakdown.length,
                updatedCharges: updatedShipmentData.manualRates.length,
                taxesNow: updatedShipmentData.manualRates
                    .filter(t => t.isTax || isTaxCharge(t.code))
                    .map(tax => `${tax.code}: ${tax.description}`)
            });

            // Set flag to prevent overlapping calculations
            setIsCalculatingTaxes(true);

            // Update the local state with proper taxes
            setLocalRateBreakdown(updatedShipmentData.manualRates);

            // Automatically save the updated charges to the database
            if (onChargesUpdate) {
                console.log('🍁 Canadian Tax: Auto-saving newly added taxes to database');
                setIsSavingCharges(true);
                onChargesUpdate(updatedShipmentData.manualRates, false)
                    .then(() => {
                        console.log('🍁 Canadian Tax: Auto-save completed successfully');
                        setTimeout(() => setIsSavingCharges(false), 500);
                    })
                    .catch(error => {
                        console.error('🍁 Canadian Tax: Failed to auto-save updated charges:', error);
                        setIsSavingCharges(false);
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
    }, [shipment?.shipFrom, shipment?.shipTo, availableChargeTypes, editingIndex, isCalculatingTaxes, isSavingCharges, localRateBreakdown]);

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
    const formatCurrency = (amount, includeCents = true, itemCurrency = null) => {
        const numAmount = parseFloat(amount) || 0;
        const displayCurrency = itemCurrency || currency;
        if (includeCents) {
            return `$${numAmount.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            })} ${displayCurrency}`;
        } else {
            return `$${Math.round(numAmount).toLocaleString('en-US')} ${displayCurrency}`;
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



    // Extract totals and profit for display from cached calculations
    const {
        totalCost: localTotalCost = 0,
        totalCharge: localTotalCharge = 0,
        totalQuotedCost: localTotalQuotedCost = 0,
        totalQuotedCharge: localTotalQuotedCharge = 0,
        totalActualCost: localTotalActualCost = 0,
        totalActualCharge: localTotalActualCharge = 0,
        totalProfit: localTotalProfit = 0,
        baseCurrency = 'CAD',
        exchangeRatesUsed = null
    } = totalsData || {};

    // Get service information
    const getServiceInfo = () => {
        const info = {};

        let rawCarrierName = quickShipData?.carrier || getBestRateInfo?.carrier?.name || getBestRateInfo?.carrier || 'N/A';

        // Apply carrier name override for customer-facing views
        if (!isAdminView && rawCarrierName && rawCarrierName !== 'N/A' && companyData) {
            const shipmentCompanyId = shipment?.companyID || shipment?.companyId;

            if (shipmentCompanyId) {
                const displayName = getDisplayCarrierName(
                    { name: rawCarrierName, carrierID: rawCarrierName },
                    shipmentCompanyId,
                    companyData,
                    isAdminView
                );

                if (displayName !== rawCarrierName) {
                    rawCarrierName = displayName;
                }
            }
        }

        info.carrier = rawCarrierName;
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
                            {canEditCharges && (
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
                                        {canViewFinancials && (
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'left', width: '120px' }}>
                                                Quoted Cost
                                            </TableCell>
                                        )}
                                        <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'left', width: '90px' }}>
                                            {canViewFinancials ? 'Quoted Charge' : 'Amount'}
                                        </TableCell>
                                        {canViewFinancials && (
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'left', width: '90px' }}>
                                                Actual Cost
                                            </TableCell>
                                        )}
                                        {canViewFinancials && (
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'left', width: '90px' }}>
                                                Actual Charge
                                            </TableCell>
                                        )}
                                        {canViewFinancials && (
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'left', width: '90px' }}>
                                                Profit
                                            </TableCell>
                                        )}
                                        {(canViewFinancials || canEditCharges) && (
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'left', width: '120px' }}>
                                                Invoice#
                                            </TableCell>
                                        )}
                                        {(canViewFinancials || canEditCharges) && (
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'left', width: '120px' }}>
                                                EDI#
                                            </TableCell>
                                        )}
                                        {canEditCharges && (
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'center', width: '60px' }}>
                                                CMN
                                            </TableCell>
                                        )}
                                        {canEditCharges && (
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'center', width: '60px' }}>
                                                Actions
                                            </TableCell>
                                        )}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {localRateBreakdown.map((item, index) => (
                                        <TableRow key={index} sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                                            <TableCell sx={{ fontSize: '12px', verticalAlign: 'top', width: '80px' }}>
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
                                            <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
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
                                            {canViewFinancials && (
                                                <TableCell sx={{ fontSize: '12px', textAlign: 'left', color: '#374151', fontWeight: 500, verticalAlign: 'top' }}>
                                                    {editingIndex === index ? (
                                                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                                            <TextField
                                                                value={editingValues.quotedCost}
                                                                onChange={(e) => handleInputChange('quotedCost', e.target.value)}
                                                                size="small"
                                                                type="number"
                                                                inputProps={{ step: "0.01", min: "0" }}
                                                                sx={{
                                                                    width: '70px',
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
                                                            <FormControl size="small" sx={{ width: '50px' }}>
                                                                <Select
                                                                    value={editingValues.quotedCostCurrency || 'CAD'}
                                                                    onChange={(e) => handleInputChange('quotedCostCurrency', e.target.value)}
                                                                    sx={{
                                                                        '& .MuiSelect-select': { fontSize: '10px', padding: '4px 6px' },
                                                                        '& .MuiInputBase-root': { height: '32px' }
                                                                    }}
                                                                >
                                                                    <MenuItem value="CAD" sx={{ fontSize: '10px' }}>CAD</MenuItem>
                                                                    <MenuItem value="USD" sx={{ fontSize: '10px' }}>USD</MenuItem>
                                                                    <MenuItem value="EUR" sx={{ fontSize: '10px' }}>EUR</MenuItem>
                                                                    <MenuItem value="GBP" sx={{ fontSize: '10px' }}>GBP</MenuItem>
                                                                </Select>
                                                            </FormControl>
                                                        </Box>
                                                    ) : (
                                                        !item.isMarkup ? formatCurrency(item.quotedCost, true, item.quotedCostCurrency) : '-'
                                                    )}
                                                </TableCell>
                                            )}
                                            <TableCell sx={{ fontSize: '12px', textAlign: 'left', fontWeight: 400, verticalAlign: 'top' }}>
                                                {editingIndex === index ? (
                                                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                                        <TextField
                                                            value={editingValues.quotedCharge}
                                                            onChange={(e) => handleInputChange('quotedCharge', e.target.value)}
                                                            size="small"
                                                            type="number"
                                                            inputProps={{ step: "0.01", min: "0" }}
                                                            sx={{
                                                                width: '70px',
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
                                                        <FormControl size="small" sx={{ width: '50px' }}>
                                                            <Select
                                                                value={editingValues.quotedChargeCurrency || 'CAD'}
                                                                onChange={(e) => handleInputChange('quotedChargeCurrency', e.target.value)}
                                                                sx={{
                                                                    '& .MuiSelect-select': { fontSize: '10px', padding: '4px 6px' },
                                                                    '& .MuiInputBase-root': { height: '32px' }
                                                                }}
                                                            >
                                                                <MenuItem value="CAD" sx={{ fontSize: '10px' }}>CAD</MenuItem>
                                                                <MenuItem value="USD" sx={{ fontSize: '10px' }}>USD</MenuItem>
                                                                <MenuItem value="EUR" sx={{ fontSize: '10px' }}>EUR</MenuItem>
                                                                <MenuItem value="GBP" sx={{ fontSize: '10px' }}>GBP</MenuItem>
                                                            </Select>
                                                        </FormControl>
                                                    </Box>
                                                ) : (
                                                    formatCurrency(item.quotedCharge, true, item.quotedChargeCurrency)
                                                )}
                                            </TableCell>
                                            {canViewFinancials && (
                                                <TableCell sx={{ fontSize: '12px', textAlign: 'left', fontWeight: 400, verticalAlign: 'top' }}>
                                                    {editingIndex === index ? (
                                                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                                            <TextField
                                                                value={editingValues.actualCost || ''}
                                                                onChange={(e) => handleInputChange('actualCost', e.target.value)}
                                                                size="small"
                                                                type="number"
                                                                inputProps={{ step: "0.01", min: "0" }}
                                                                sx={{
                                                                    width: '70px',
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
                                                            <FormControl size="small" sx={{ width: '50px' }}>
                                                                <Select
                                                                    value={editingValues.actualCostCurrency || 'CAD'}
                                                                    onChange={(e) => handleInputChange('actualCostCurrency', e.target.value)}
                                                                    sx={{
                                                                        '& .MuiSelect-select': { fontSize: '10px', padding: '4px 6px' },
                                                                        '& .MuiInputBase-root': { height: '32px' }
                                                                    }}
                                                                >
                                                                    <MenuItem value="CAD" sx={{ fontSize: '10px' }}>CAD</MenuItem>
                                                                    <MenuItem value="USD" sx={{ fontSize: '10px' }}>USD</MenuItem>
                                                                    <MenuItem value="EUR" sx={{ fontSize: '10px' }}>EUR</MenuItem>
                                                                    <MenuItem value="GBP" sx={{ fontSize: '10px' }}>GBP</MenuItem>
                                                                </Select>
                                                            </FormControl>
                                                        </Box>
                                                    ) : (
                                                        formatCurrency(item.actualCost || 0, true, item.actualCostCurrency)
                                                    )}
                                                </TableCell>
                                            )}
                                            {canViewFinancials && (
                                                <TableCell sx={{ fontSize: '12px', textAlign: 'left', fontWeight: 400, verticalAlign: 'top' }}>
                                                    {editingIndex === index ? (
                                                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                                            <TextField
                                                                value={editingValues.actualCharge || ''}
                                                                onChange={(e) => handleInputChange('actualCharge', e.target.value)}
                                                                size="small"
                                                                type="number"
                                                                inputProps={{ step: "0.01", min: "0" }}
                                                                sx={{
                                                                    width: '70px',
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
                                                            <FormControl size="small" sx={{ width: '50px' }}>
                                                                <Select
                                                                    value={editingValues.actualChargeCurrency || 'CAD'}
                                                                    onChange={(e) => handleInputChange('actualChargeCurrency', e.target.value)}
                                                                    sx={{
                                                                        '& .MuiSelect-select': { fontSize: '10px', padding: '4px 6px' },
                                                                        '& .MuiInputBase-root': { height: '32px' }
                                                                    }}
                                                                >
                                                                    <MenuItem value="CAD" sx={{ fontSize: '10px' }}>CAD</MenuItem>
                                                                    <MenuItem value="USD" sx={{ fontSize: '10px' }}>USD</MenuItem>
                                                                    <MenuItem value="EUR" sx={{ fontSize: '10px' }}>EUR</MenuItem>
                                                                    <MenuItem value="GBP" sx={{ fontSize: '10px' }}>GBP</MenuItem>
                                                                </Select>
                                                            </FormControl>
                                                        </Box>
                                                    ) : (
                                                        formatCurrency(item.actualCharge || 0, true, item.actualChargeCurrency)
                                                    )}
                                                </TableCell>
                                            )}
                                            {canViewFinancials && (
                                                <TableCell sx={{ fontSize: '12px', textAlign: 'left', verticalAlign: 'top' }}>
                                                    {editingIndex === index ? (
                                                        // Show calculated profit during editing using simple logic (no async conversion)
                                                        (() => {
                                                            // Simple profit calculation for real-time editing feedback
                                                            if (item.isTax || isTaxCharge(item.code)) {
                                                                return (
                                                                    <Typography sx={{
                                                                        fontSize: '12px',
                                                                        color: '#6b7280',
                                                                        fontWeight: 400
                                                                    }}>
                                                                        $0.00 CAD
                                                                    </Typography>
                                                                );
                                                            }

                                                            const actualCost = parseFloat(editingValues.actualCost) || 0;
                                                            const quotedCost = parseFloat(editingValues.quotedCost) || 0;
                                                            const actualCharge = parseFloat(editingValues.actualCharge) || 0;
                                                            const quotedCharge = parseFloat(editingValues.quotedCharge) || 0;

                                                            let profit = 0;
                                                            if (actualCost > 0 && actualCharge > 0) {
                                                                profit = actualCharge - actualCost;
                                                            } else if (actualCost > 0) {
                                                                profit = quotedCharge - actualCost;
                                                            } else if (actualCharge > 0) {
                                                                profit = actualCharge - quotedCost;
                                                            } else {
                                                                profit = quotedCharge - quotedCost;
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
                                                                    {`${prefix}${formatCurrency(absProfit, true, item.currency)}`}
                                                                </Typography>
                                                            );
                                                        })()
                                                    ) : (
                                                        // REVERTED: Keep individual line item profits in USD (original behavior)
                                                        !item.isMarkup ? (() => {
                                                            // Tax charges show $0.00
                                                            if (item.isTax || isTaxCharge(item.code)) {
                                                                return (
                                                                    <Typography sx={{
                                                                        fontSize: '12px',
                                                                        color: '#6b7280',
                                                                        fontWeight: 400
                                                                    }}>
                                                                        $0.00 CAD
                                                                    </Typography>
                                                                );
                                                            }

                                                            // Simple calculation: Actual Charge - Actual Cost (in original currency)
                                                            const actualCost = parseFloat(item.actualCost) || 0;
                                                            const actualCharge = parseFloat(item.actualCharge) || 0;
                                                            const profit = actualCharge - actualCost;
                                                            const currency = item.currency || 'CAD';

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
                                                                    {`${prefix}${formatCurrency(absProfit, true, currency)}`}
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
                                            {(canViewFinancials || canEditCharges) && (
                                                <TableCell sx={{ fontSize: '12px', textAlign: 'left', verticalAlign: 'top' }}>
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
                                            {(canViewFinancials || canEditCharges) && (
                                                <TableCell sx={{ fontSize: '12px', textAlign: 'left', verticalAlign: 'top' }}>
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
                                            {canEditCharges && (
                                                <TableCell sx={{ fontSize: '12px', textAlign: 'center', verticalAlign: 'top' }}>
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
                                                                setIsSavingCharges(true);
                                                                onChargesUpdate(updatedBreakdown)
                                                                    .then(() => {
                                                                        setTimeout(() => setIsSavingCharges(false), 500);
                                                                    })
                                                                    .catch(error => {
                                                                        console.error('❌ Error saving commissionable flag:', error);
                                                                        setIsSavingCharges(false);
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
                                            {canEditCharges && (
                                                <TableCell sx={{ fontSize: '12px', textAlign: 'center', verticalAlign: 'top' }}>
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
                                        <TableCell sx={{ fontSize: '14px', fontWeight: 700, verticalAlign: 'top' }}>
                                            {/* Empty cell for code column */}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '14px', fontWeight: 700, verticalAlign: 'top' }}>
                                            TOTAL
                                        </TableCell>
                                        {canViewFinancials && (
                                            <TableCell sx={{ fontSize: '14px', textAlign: 'left', color: '#374151', fontWeight: 700, verticalAlign: 'top' }}>
                                                {formatCurrency(localTotalQuotedCost, true, baseCurrency)}
                                            </TableCell>
                                        )}
                                        <TableCell sx={{ fontSize: '14px', textAlign: 'left', fontWeight: 700, verticalAlign: 'top' }}>
                                            {formatCurrency(localTotalQuotedCharge, true, baseCurrency)}
                                        </TableCell>
                                        {canViewFinancials && (
                                            <TableCell sx={{ fontSize: '14px', textAlign: 'left', fontWeight: 700, verticalAlign: 'top' }}>
                                                {formatCurrency(localTotalActualCost || 0, true, baseCurrency)}
                                            </TableCell>
                                        )}
                                        {canViewFinancials && (
                                            <TableCell sx={{ fontSize: '14px', textAlign: 'left', fontWeight: 700, verticalAlign: 'top' }}>
                                                {formatCurrency(localTotalActualCharge || 0, true, baseCurrency)}
                                            </TableCell>
                                        )}
                                        {canViewFinancials && (
                                            <TableCell sx={{ fontSize: '14px', textAlign: 'left', fontWeight: 700, verticalAlign: 'top' }}>
                                                {(() => {
                                                    // FIXED: Direct total profit calculation with USD to CAD conversion
                                                    let totalNonTaxActualCostUSD = 0;
                                                    let totalNonTaxActualChargeUSD = 0;

                                                    // Calculate totals excluding tax items (in original USD)
                                                    localRateBreakdown.forEach(item => {
                                                        // Skip tax charges
                                                        if (item.isTax || isTaxCharge(item.code)) {
                                                            return;
                                                        }

                                                        totalNonTaxActualCostUSD += parseFloat(item.actualCost) || 0;
                                                        totalNonTaxActualChargeUSD += parseFloat(item.actualCharge) || 0;
                                                    });

                                                    // Calculate profit in USD first
                                                    const profitUSD = totalNonTaxActualChargeUSD - totalNonTaxActualCostUSD;

                                                    // Convert USD profit to CAD using actual exchange rates
                                                    const usdToCadRate = exchangeRates?.USD ? (1 / exchangeRates.USD) : 1.38; // 1 USD = X CAD
                                                    const profit = profitUSD * usdToCadRate;

                                                    console.log(`💱 [TOTAL] Profit conversion: $${profitUSD} USD × ${usdToCadRate.toFixed(3)} = $${profit.toFixed(2)} CAD`);
                                                    const isProfit = profit > 0;
                                                    const isLoss = profit < 0;
                                                    const prefix = isProfit ? '+' : (isLoss ? '-' : '');
                                                    const absProfit = Math.abs(profit);
                                                    const color = isProfit ? '#059669' : (isLoss ? '#dc2626' : 'inherit');
                                                    return (
                                                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start' }}>
                                                            <Typography sx={{
                                                                fontSize: '14px',
                                                                fontWeight: 700,
                                                                color: color
                                                            }}>
                                                                {`${prefix}${formatCurrency(absProfit, true, baseCurrency)}`}
                                                            </Typography>
                                                            {exchangeRatesUsed && (
                                                                <Typography sx={{
                                                                    fontSize: '10px',
                                                                    color: '#6b7280',
                                                                    fontStyle: 'italic'
                                                                }}>
                                                                    {(() => {
                                                                        // ✅ FIXED: Only show conversion info if currencies were actually converted
                                                                        // Check if any line items had different currencies requiring conversion
                                                                        const hasConversions = localRateBreakdown.some(item => {
                                                                            const profitResult = profitCalculations[item.id];
                                                                            if (profitResult && typeof profitResult === 'object') {
                                                                                const originalCostCurrency = profitResult.originalCostCurrency || item.quotedCostCurrency || item.currency || 'CAD';
                                                                                const originalChargeCurrency = profitResult.originalChargeCurrency || item.quotedChargeCurrency || item.currency || 'CAD';
                                                                                return originalCostCurrency !== 'CAD' || originalChargeCurrency !== 'CAD';
                                                                            }
                                                                            return false;
                                                                        });

                                                                        if (hasConversions && exchangeRatesUsed) {
                                                                            // Show exchange rate if available and not 1:1
                                                                            // Check for USD to CAD conversion rate
                                                                            const usdRate = exchangeRatesUsed.USD;
                                                                            console.log('🔍 Exchange rate debug:', {
                                                                                exchangeRatesUsed,
                                                                                usdRate,
                                                                                hasConversions,
                                                                                isFallback: exchangeRatesUsed.isFallback
                                                                            });

                                                                            if (usdRate && usdRate !== 1 && !isNaN(usdRate)) {
                                                                                // If this is fallback data, warn about using hardcoded rate
                                                                                if (exchangeRatesUsed.isFallback) {
                                                                                    console.warn('⚠️ Using fallback exchange rate instead of actual rate from shipment date');
                                                                                }
                                                                                return `Converted @ ${usdRate.toFixed(3)}`;
                                                                            }
                                                                            return `Converted to ${baseCurrency}`;
                                                                        }
                                                                        return `Total in ${baseCurrency}`; // No conversion needed
                                                                    })()}
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    );
                                                })()}
                                            </TableCell>
                                        )}
                                        {(canViewFinancials || canEditCharges) && (
                                            <TableCell sx={{ fontSize: '14px', textAlign: 'left', fontWeight: 700, verticalAlign: 'top' }}>
                                                {/* Empty cell for Invoice# column */}
                                            </TableCell>
                                        )}
                                        {(canViewFinancials || canEditCharges) && (
                                            <TableCell sx={{ fontSize: '14px', textAlign: 'left', fontWeight: 700, verticalAlign: 'top' }}>
                                                {/* Empty cell for EDI# column */}
                                            </TableCell>
                                        )}
                                        {canEditCharges && (
                                            <TableCell sx={{ fontSize: '14px', textAlign: 'center', fontWeight: 700, verticalAlign: 'top' }}>
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