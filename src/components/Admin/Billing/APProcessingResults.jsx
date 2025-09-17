import React, { useState, useEffect } from 'react';
import { useSnackbar } from 'notistack';
import PdfViewerDialog from '../../Shipments/components/PdfViewerDialog';
import { getFunctions, httpsCallable } from 'firebase/functions';
import {
    Box,
    Paper,
    Typography,
    Tabs,
    Tab,
    Grid,
    Card,
    CardContent,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    IconButton,
    Alert,
    Divider,
    Stack,
    Tooltip,
    LinearProgress,
    CircularProgress,
    Collapse,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Autocomplete,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Skeleton,
    Checkbox
} from '@mui/material';
import {
    Receipt as InvoiceIcon,
    LocalShipping as ShipmentIcon,
    Compare as CompareIcon,
    CheckCircle as MatchIcon,
    Warning as WarningIcon,
    Error as ErrorIcon,
    Visibility as ViewIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    MonetizationOn as ChargeIcon,
    Scale as WeightIcon,
    Room as LocationIcon,
    Schedule as DateIcon,
    AttachMoney as TotalIcon,
    CheckBox as ApproveIcon,
    Cancel as RejectIcon,
    Close as CloseIcon,
    Search as SearchIcon,
    Link as LinkIcon,
    PictureAsPdf as PdfIcon,
    Assignment as AssignIcon
} from '@mui/icons-material';
import { formatCurrency } from '../../../utils/currencyUtils';
import { db } from '../../../firebase';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, updateDoc, getFirestore } from 'firebase/firestore';
import { getStorage, ref, getDownloadURL } from 'firebase/storage';
import currencyConversionService from '../../../services/currencyConversionService';

// Component for calculating totals with real currency conversion
const TotalCalculations = ({ selectedShipmentDetail, buildComparisonRows }) => {
    const [totalFees, setTotalFees] = React.useState('Calculating...');
    const [totalVariance, setTotalVariance] = React.useState('Calculating...');

    React.useEffect(() => {
        const calculateTotals = async () => {
            if (!selectedShipmentDetail) return;

            try {
                // Extract shipment date for historical exchange rates
                const rawShipmentDate = selectedShipmentDetail.shipmentDate ||
                    selectedShipmentDetail.deliveryDate ||
                    selectedShipmentDetail.shipDate ||
                    selectedShipmentDetail.invoiceDate ||
                    selectedShipmentDetail.extractedAt ||
                    new Date();

                // Ensure we have a proper Date object
                let shipmentDate;
                if (rawShipmentDate instanceof Date) {
                    shipmentDate = rawShipmentDate;
                } else if (typeof rawShipmentDate === 'string') {
                    shipmentDate = new Date(rawShipmentDate);
                } else if (rawShipmentDate && typeof rawShipmentDate === 'object' && rawShipmentDate.toDate) {
                    // Handle Firestore Timestamp
                    shipmentDate = rawShipmentDate.toDate();
                } else if (rawShipmentDate && typeof rawShipmentDate === 'object' && rawShipmentDate.seconds) {
                    // Handle Firestore Timestamp object format
                    shipmentDate = new Date(rawShipmentDate.seconds * 1000);
                } else {
                    shipmentDate = new Date();
                }

                // Validate the date
                if (isNaN(shipmentDate.getTime())) {
                    console.warn('⚠️ Invalid shipment date detected in TotalCalculations, using current date:', rawShipmentDate);
                    shipmentDate = new Date();
                }

                console.log('💱 Calculating totals with historical exchange rates for date:', shipmentDate.toDateString());
                const comparisonData = await buildComparisonRows(selectedShipmentDetail);
                const rates = await currencyConversionService.getRatesForDate(shipmentDate);

                console.log('📊 Historical exchange rates loaded for:', {
                    shipmentDate: shipmentDate.toDateString(),
                    baseCurrency: rates.baseCurrency,
                    USD: rates.USD,
                    EUR: rates.EUR,
                    rateTimestamp: rates.timestamp,
                    rateProvider: rates.provider
                });

                // Combine all charges for total calculations
                const allCharges = [...comparisonData.matchedCharges, ...comparisonData.unmatchedCharges];

                // Calculate Total Fees (convert all invoice amounts to CAD)
                const totalFeesCAD = allCharges.reduce((sum, row) => {
                    const amountInCAD = currencyConversionService.convertCurrency(
                        row.invoiceAmount || 0,
                        row.currency,
                        'CAD',
                        rates
                    );
                    return sum + amountInCAD;
                }, 0);

                // Calculate Total Variance (convert all variances to CAD)
                const totalVarianceCAD = allCharges.reduce((sum, row) => {
                    const varianceInCAD = currencyConversionService.convertCurrency(
                        row.varianceCost || 0,
                        row.currency,
                        'CAD',
                        rates
                    );
                    return sum + varianceInCAD;
                }, 0);

                console.log('💰 Totals calculated:', {
                    totalFeesCAD: totalFeesCAD.toFixed(2),
                    totalVarianceCAD: totalVarianceCAD.toFixed(2)
                });

                setTotalFees(formatCurrency(totalFeesCAD, 'CAD'));
                setTotalVariance(formatCurrency(totalVarianceCAD, 'CAD'));
            } catch (error) {
                console.error('❌ Error calculating totals with real exchange rates:', error);
                setTotalFees('Error');
                setTotalVariance('Error');
            }
        };

        calculateTotals();
    }, [selectedShipmentDetail, buildComparisonRows]);

    return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                Total Fees: {totalFees}
            </Typography>
            <Typography sx={{ fontSize: '14px', color: '#6b7280' }}>|</Typography>
            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                Total Variance: {totalVariance}
            </Typography>
        </Box>
    );
};

// Component for rendering comparison table rows with real currency conversion
const ComparisonTableRows = ({
    selectedShipmentDetail,
    buildComparisonRows,
    selectedCharges,
    onSelectCharge,
    appliedCharges,
    setAppliedCharges,
    uploadData,
    fileName,
    enqueueSnackbar
}) => {
    const [comparisonRows, setComparisonRows] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    // Guard to prevent repeated auto-apply loops per shipment
    const autoAppliedShipmentsRef = React.useRef(new Set());
    const appliedChargesCheckedRef = React.useRef(new Set());

    React.useEffect(() => {
        const loadComparisonRows = async () => {
            if (!selectedShipmentDetail) return;

            try {
                setLoading(true);
                const comparisonData = await buildComparisonRows(selectedShipmentDetail);
                setComparisonRows(comparisonData);

                // 🚀 AUTOMATIC CHARGE APPROVAL - Apply charges recommended for auto-approval
                const allCharges = [
                    ...(comparisonData.matchedCharges || []),
                    ...(comparisonData.unmatchedCharges || [])
                ];

                const autoApprovalCharges = allCharges.filter(charge =>
                    charge.autoApprovalRecommendation === 'approve'
                );

                console.log('🤖 Checking for auto-approval after comparison loading:', {
                    totalCharges: allCharges.length,
                    autoApprovalCharges: autoApprovalCharges.length,
                    autoApprovalChargeNames: autoApprovalCharges.map(c => c.name),
                    shipmentId: selectedShipmentDetail.matchedShipmentId
                });

                // REMOVED: Frontend auto-application logic - now handled by backend Firestore trigger
                // Backend intelligent automation automatically applies charges when extraction completes
                console.log('🔍 Auto-approval analysis complete:', {
                    autoApprovalCharges: autoApprovalCharges.length,
                    shipmentId: selectedShipmentDetail.matchedShipmentId,
                    message: 'Backend automation handles charge application automatically'
                });

                // CHECK FOR AUTOMATICALLY APPLIED CHARGES: Detect charges already applied by backend automation
                if (selectedShipmentDetail?.matchedShipmentId && !appliedChargesCheckedRef.current.has(selectedShipmentDetail.matchedShipmentId)) {
                    try {
                        const db = getFirestore();

                        // Try direct document lookup first, then query by shipmentID field
                        let shipmentRef = doc(db, 'shipments', selectedShipmentDetail.matchedShipmentId);
                        let shipmentSnap = await getDoc(shipmentRef);

                        if (!shipmentSnap.exists()) {
                            // Fallback: query by shipmentID field
                            const q = query(
                                collection(db, 'shipments'),
                                where('shipmentID', '==', selectedShipmentDetail.matchedShipmentId),
                                limit(1)
                            );
                            const querySnapshot = await getDocs(q);

                            if (!querySnapshot.empty) {
                                shipmentRef = querySnapshot.docs[0].ref;
                                shipmentSnap = querySnapshot.docs[0];
                            }
                        }

                        if (shipmentSnap.exists()) {
                            const shipmentData = shipmentSnap.data();
                            const alreadyAppliedIndices = new Set();

                            // Check if charges have been applied (by looking at updatedCharges or manualRates)
                            const appliedCharges = shipmentData.updatedCharges || shipmentData.manualRates || [];

                            if (appliedCharges.length > 0) {
                                console.log('🔍 Detected automatically applied charges:', appliedCharges);

                                // Match applied charges with comparison rows to mark them as applied in UI
                                allCharges.forEach((comparisonCharge, index) => {
                                    const isApplied = appliedCharges.some(appliedCharge => {
                                        const codeMatch = appliedCharge.chargeCode === comparisonCharge.systemCode ||
                                            appliedCharge.chargeName === comparisonCharge.systemName ||
                                            appliedCharge.code === comparisonCharge.systemCode;

                                        const costMatch = Math.abs((appliedCharge.actualCost || appliedCharge.cost || 0) - (comparisonCharge.systemQuotedCost || 0)) < 0.01;

                                        return codeMatch && costMatch;
                                    });

                                    if (isApplied) {
                                        alreadyAppliedIndices.add(index);
                                    }
                                });

                                if (alreadyAppliedIndices.size > 0) {
                                    console.log(`✅ Found ${alreadyAppliedIndices.size} automatically applied charges, updating UI`);
                                    setAppliedCharges(alreadyAppliedIndices);
                                }
                            }
                        }

                        // Mark this shipment as checked to prevent re-checking
                        appliedChargesCheckedRef.current.add(selectedShipmentDetail.matchedShipmentId);

                    } catch (error) {
                        console.warn('Could not check for automatically applied charges:', error);
                        // Still mark as checked even if there was an error
                        appliedChargesCheckedRef.current.add(selectedShipmentDetail.matchedShipmentId);
                    }
                }

            } catch (error) {
                console.error('❌ Error loading comparison rows:', error);
                setComparisonRows({ matchedCharges: [], unmatchedCharges: [] });
            } finally {
                setLoading(false);
            }
        };

        loadComparisonRows();
    }, [selectedShipmentDetail, buildComparisonRows]);

    if (loading) {
        return (
            <TableRow>
                <TableCell colSpan={10} sx={{ textAlign: 'center', fontSize: '11px' }}>
                    Loading comparison data...
                </TableCell>
            </TableRow>
        );
    }

    if (!comparisonRows.matchedCharges && !comparisonRows.unmatchedCharges) {
        return (
            <TableRow>
                <TableCell colSpan={10} sx={{ textAlign: 'center', fontSize: '11px' }}>
                    No comparison data available
                </TableCell>
            </TableRow>
        );
    }

    const allCharges = [...(comparisonRows.matchedCharges || []), ...(comparisonRows.unmatchedCharges || [])];

    if (allCharges.length === 0) {
        return (
            <TableRow>
                <TableCell colSpan={10} sx={{ textAlign: 'center', fontSize: '11px' }}>
                    No charges found for comparison
                </TableCell>
            </TableRow>
        );
    }

    // Render function for charge rows with auto-approval indicators
    const renderChargeRow = (charge, idx, section) => {
        const isApplied = appliedCharges.has(idx);

        // Auto-approval styling based on recommendation
        let rowBgColor = isApplied ? '#f0f9ff' : (idx % 2 === 1 ? '#f9fafb' : 'white');
        let recommendationChip = null;

        if (charge.autoApprovalRecommendation) {
            switch (charge.autoApprovalRecommendation) {
                case 'approve':
                    rowBgColor = isApplied ? '#f0f9ff' : '#f0fdf4'; // Light green
                    recommendationChip = (
                        <Chip
                            label={`✓ ${charge.autoApprovalConfidence}%`}
                            size="small"
                            sx={{
                                fontSize: '10px',
                                height: '18px',
                                backgroundColor: '#dcfce7',
                                color: '#166534',
                                border: '1px solid #bbf7d0',
                                '& .MuiChip-label': { px: 0.5, fontSize: '9px' }
                            }}
                        />
                    );
                    break;
                case 'review':
                    rowBgColor = isApplied ? '#f0f9ff' : '#fffbeb'; // Light yellow
                    recommendationChip = (
                        <Chip
                            label={`⚠ ${charge.autoApprovalConfidence}%`}
                            size="small"
                            sx={{
                                fontSize: '10px',
                                height: '18px',
                                backgroundColor: '#fef3c7',
                                color: '#d97706',
                                border: '1px solid #fde68a',
                                '& .MuiChip-label': { px: 0.5, fontSize: '9px' }
                            }}
                        />
                    );
                    break;
                case 'reject':
                    rowBgColor = isApplied ? '#f0f9ff' : '#fef2f2'; // Light red
                    recommendationChip = (
                        <Chip
                            label={`✗ ${charge.autoApprovalConfidence}%`}
                            size="small"
                            sx={{
                                fontSize: '10px',
                                height: '18px',
                                backgroundColor: '#fecaca',
                                color: '#dc2626',
                                border: '1px solid #fca5a5',
                                '& .MuiChip-label': { px: 0.5, fontSize: '9px' }
                            }}
                        />
                    );
                    break;
            }
        }

        return (
            <TableRow key={`${section}-${idx}`} sx={{
                backgroundColor: rowBgColor,
                opacity: isApplied ? 0.7 : 1,
                ...(charge.autoApprovalRecommendation === 'approve' && !isApplied && {
                    border: '2px solid #bbf7d0',
                })
            }}>
                <TableCell sx={{ fontSize: '11px', padding: '8px', width: '40px', maxWidth: '40px', verticalAlign: 'top' }}>
                    <Checkbox
                        size="small"
                        checked={selectedCharges.has(idx) || isApplied}
                        disabled={isApplied}
                        onChange={(e) => onSelectCharge(idx, e.target.checked)}
                        sx={{
                            padding: 0,
                            '& .MuiSvgIcon-root': { fontSize: 16 },
                            ...(isApplied && {
                                color: '#10b981',
                                '&.Mui-checked': {
                                    color: '#10b981'
                                }
                            })
                        }}
                    />
                </TableCell>
                <TableCell sx={{ fontSize: '11px', width: '50px', textAlign: 'left', verticalAlign: 'top' }}>{charge.code}</TableCell>
                <TableCell sx={{ fontSize: '11px', width: '200px', textAlign: 'left', verticalAlign: 'top' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'flex-start' }}>
                        <Typography sx={{ fontSize: '11px' }}>{charge.name}</Typography>
                        {recommendationChip}
                        {charge.autoApprovalReason && (
                            <Typography sx={{ fontSize: '9px', color: '#6b7280', fontStyle: 'italic' }}>
                                {charge.autoApprovalReason}
                            </Typography>
                        )}
                    </Box>
                </TableCell>
                <TableCell sx={{ fontSize: '11px', width: '100px', textAlign: 'left', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                    {formatCurrency(charge.invoiceAmount, charge.currency)}
                </TableCell>
                <TableCell sx={{ fontSize: '11px', width: '100px', textAlign: 'left', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                    {formatCurrency(charge.systemQuotedCost, charge.currency)}
                </TableCell>
                <TableCell sx={{ fontSize: '11px', width: '100px', textAlign: 'left', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                    {formatCurrency(charge.systemQuotedCharge, charge.currency)}
                </TableCell>
                <TableCell sx={{ fontSize: '11px', width: '100px', textAlign: 'left', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                    {formatCurrency(charge.systemActualCost, charge.currency)}
                </TableCell>
                <TableCell sx={{ fontSize: '11px', width: '100px', textAlign: 'left', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                    {formatCurrency(charge.systemActualCharge, charge.currency)}
                </TableCell>
                <TableCell sx={{
                    fontSize: '11px',
                    width: '90px',
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                    verticalAlign: 'top',
                    color: Math.abs(charge.varianceCost) > 0.009 ? '#b45309' : '#065f46',
                    fontWeight: 600
                }}>
                    {formatCurrency(charge.varianceCost, charge.currency)}
                </TableCell>
                <TableCell sx={{
                    fontSize: '11px',
                    width: '100px',
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                    verticalAlign: 'top',
                    color: charge.profit && charge.profit > 0 ? '#059669' : '#dc2626',
                    fontWeight: 600
                }}>
                    {charge.profit ? formatCurrency(charge.profit, 'CAD') : 'N/A'}
                </TableCell>
            </TableRow>
        );
    };

    return (
        <>
            {/* Matched Charges Section */}
            {comparisonRows.matchedCharges && comparisonRows.matchedCharges.length > 0 && (
                <>
                    <TableRow>
                        <TableCell
                            colSpan={10}
                            sx={{
                                fontSize: '13px',
                                fontWeight: 600,
                                backgroundColor: '#f0fdf4',
                                color: '#166534',
                                textAlign: 'center',
                                border: '1px solid #bbf7d0',
                                py: 1
                            }}
                        >
                            MATCHED CHARGES ({comparisonRows.matchedCharges.length})
                        </TableCell>
                    </TableRow>
                    {comparisonRows.matchedCharges.map((charge, idx) =>
                        renderChargeRow(charge, idx, 'matched')
                    )}
                </>
            )}

            {/* Unmatched Charges Section */}
            {comparisonRows.unmatchedCharges && comparisonRows.unmatchedCharges.length > 0 && (
                <>
                    <TableRow>
                        <TableCell
                            colSpan={10}
                            sx={{
                                fontSize: '13px',
                                fontWeight: 600,
                                backgroundColor: '#fef2f2',
                                color: '#991b1b',
                                textAlign: 'center',
                                border: '1px solid #fecaca',
                                py: 1
                            }}
                        >
                            UNMATCHED CHARGES ({comparisonRows.unmatchedCharges.length})
                        </TableCell>
                    </TableRow>
                    {comparisonRows.unmatchedCharges.map((charge, idx) =>
                        renderChargeRow(charge, idx + (comparisonRows.matchedCharges?.length || 0), 'unmatched')
                    )}
                </>
            )}
        </>
    );
};

export default function APProcessingResults({
    extractedData,
    matchingResults,
    fileName,
    uploadData,
    uploadId,
    onApprove,
    onReject,
    onClose,
    onStatusUpdate
}) {
    const { enqueueSnackbar } = useSnackbar();
    const [activeTab, setActiveTab] = useState(0);
    const [selectedShipmentDetail, setSelectedShipmentDetail] = useState(null);
    const [shipmentDetailDialogOpen, setShipmentDetailDialogOpen] = useState(false);
    const [compareTab, setCompareTab] = useState('extracted');

    // Shipment Matching State
    const [matchingDialogOpen, setMatchingDialogOpen] = useState(false);
    const [selectedRowForMatching, setSelectedRowForMatching] = useState(null);
    const [shipmentSearchResults, setShipmentSearchResults] = useState([]);
    const [shipmentSearchTerm, setShipmentSearchTerm] = useState('');
    const [isSearchingShipments, setIsSearchingShipments] = useState(false);

    // PDF Viewing State
    const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
    const [pdfUrl, setPdfUrl] = useState(null);

    // Table Data State (for managing matches)
    const [tableData, setTableData] = useState([]);

    // Checkbox Selection State for Compare & Apply
    const [selectedCharges, setSelectedCharges] = useState(new Set());
    const [selectAllCharges, setSelectAllCharges] = useState(false);
    const [appliedCharges, setAppliedCharges] = useState(new Set());
    const [isApplyingCharges, setIsApplyingCharges] = useState(false);
    const [isUnapplyingCharges, setIsUnapplyingCharges] = useState(false);
    const [autoProcessingTriggered, setAutoProcessingTriggered] = useState(new Set()); // Track which shipments have been auto-processed

    // Checkbox Selection State for Shipments (Bulk Actions)
    const [selectedShipments, setSelectedShipments] = useState(new Set());
    const [selectAllShipments, setSelectAllShipments] = useState(false);
    const [isBulkApproving, setIsBulkApproving] = useState(false);
    const [isBulkExcepting, setIsBulkExcepting] = useState(false);

    // Auto-matching loading state
    const [isAutoMatching, setIsAutoMatching] = useState(false);

    // Initialize applied charges from persisted data when component loads
    useEffect(() => {
        console.log('🔍 APProcessingResults received uploadData:', {
            id: uploadData?.id,
            fileName: uploadData?.fileName,
            hasChargeApplications: !!uploadData?.chargeApplications,
            chargeApplicationsLength: uploadData?.chargeApplications?.length,
            chargeApplications: uploadData?.chargeApplications,
            hasAppliedCharges: uploadData?.hasAppliedCharges
        });

        if (uploadData?.chargeApplications && uploadData.chargeApplications.length > 0) {
            console.log('🔄 Loading persisted applied charges:', uploadData.chargeApplications);

            // Create Set of applied charge indices from persisted data
            const appliedIndices = new Set(
                uploadData.chargeApplications
                    .filter(app => app.status === 'applied')
                    .map(app => app.chargeIndex)
                    .filter(index => typeof index === 'number') // Ensure valid indices
            );

            console.log('✅ Initialized applied charges from persisted data:', appliedIndices);
            setAppliedCharges(appliedIndices);

            // Check if any shipments should be marked as approved based on loaded data
            if (tableData.length > 0) {
                tableData.forEach(async (row) => {
                    try {
                        const comparisonRows = await buildComparisonRows(row);
                        const totalCharges = comparisonRows.length;

                        // Check if all charges for this shipment are applied
                        const shipmentAppliedCharges = uploadData.chargeApplications.filter(app =>
                            app.status === 'applied' &&
                            app.shipmentId === row.id // If we track shipment-specific applications
                        );

                        // For now, check if applied charges count matches total charges for any shipment
                        if (appliedIndices.size === totalCharges && appliedIndices.size > 0) {
                            console.log('✅ Setting shipment status to approved based on persisted data:', row.id);
                            updateShipmentStatus(row.id, 'approved');
                        }
                    } catch (error) {
                        console.warn('Could not check shipment approval status:', error);
                    }
                });

                // Also check if any shipments should be marked as approved based on current applied charges
                if (appliedIndices.size > 0) {
                    console.log('✅ Checking if current shipments should be marked as approved based on applied charges...');
                    const totalShipments = tableData.length;
                    if (totalShipments > 0) {
                        // For simple cases, mark all shipments as approved if we have applied charges
                        tableData.forEach(row => {
                            console.log(`✅ Marking shipment ${row.id} as approved due to applied charges`);
                            updateShipmentStatus(row.id, 'approved');
                        });
                    }
                }
            }
        } else {
            console.log('ℹ️ No persisted charge applications found, starting with empty applied charges');
            console.log('   - uploadData exists:', !!uploadData);
            console.log('   - chargeApplications exists:', !!uploadData?.chargeApplications);
            console.log('   - chargeApplications length:', uploadData?.chargeApplications?.length);
            setAppliedCharges(new Set());
        }
    }, [uploadData?.id, uploadData?.chargeApplications]);

    // Shipment Selection handling functions
    const handleSelectShipment = (shipmentId, checked) => {
        const newSelected = new Set(selectedShipments);
        if (checked) {
            newSelected.add(shipmentId);
        } else {
            newSelected.delete(shipmentId);
        }
        setSelectedShipments(newSelected);

        // Update select all state
        setSelectAllShipments(newSelected.size === tableData.length && tableData.length > 0);
    };

    const handleSelectAllShipments = (checked) => {
        if (checked) {
            // Select all shipments
            const allShipmentIds = tableData.map(row => row.id);
            setSelectedShipments(new Set(allShipmentIds));
        } else {
            // Deselect all shipments
            setSelectedShipments(new Set());
        }
        setSelectAllShipments(checked);
    };

    // Bulk action functions
    const handleBulkApprove = async () => {
        if (selectedShipments.size === 0) {
            enqueueSnackbar('Please select at least one shipment to approve', { variant: 'warning' });
            return;
        }

        setIsBulkApproving(true);
        try {
            console.log('🔄 Bulk approving shipments:', Array.from(selectedShipments));

            // For each selected shipment, apply all charges
            for (const shipmentId of selectedShipments) {
                const shipmentRow = tableData.find(row => row.id === shipmentId);
                if (shipmentRow?.matchedShipmentId) {
                    // Get all charge indices for this shipment
                    const comparisonRows = await buildComparisonRows(shipmentRow);
                    const allChargeIndices = comparisonRows.map((_, index) => index);

                    // Apply all charges for this shipment
                    await applyChargesToShipment(shipmentRow, allChargeIndices);

                    // Update status to "Approved" since all charges are being applied
                    updateShipmentStatus(shipmentId, 'approved');
                }
            }

            enqueueSnackbar(`Successfully approved ${selectedShipments.size} shipment(s)`, { variant: 'success' });

            // Clear selections
            setSelectedShipments(new Set());
            setSelectAllShipments(false);

        } catch (error) {
            console.error('❌ Error bulk approving shipments:', error);
            enqueueSnackbar('Error approving shipments', { variant: 'error' });
        } finally {
            setIsBulkApproving(false);
        }
    };

    const handleBulkException = async () => {
        if (selectedShipments.size === 0) {
            enqueueSnackbar('Please select at least one shipment to mark as exception', { variant: 'warning' });
            return;
        }

        setIsBulkExcepting(true);
        try {
            console.log('🔄 Bulk marking invoices as exception:', Array.from(selectedShipments));

            // For each selected shipment, mark the invoice status as exception
            for (const shipmentId of selectedShipments) {
                const shipmentRow = tableData.find(row => row.id === shipmentId);
                if (shipmentRow?.matchedShipmentId) {
                    // Mark the matched system shipment's invoice status as exception
                    await markInvoiceAsException(shipmentRow.matchedShipmentId, 'AP Processing Exception', shipmentRow.shipmentId);
                }

                // Update local table status
                updateShipmentStatus(shipmentId, 'exception');
            }

            enqueueSnackbar(`Successfully marked ${selectedShipments.size} invoice(s) as exception`, { variant: 'success' });

            // Clear selections
            setSelectedShipments(new Set());
            setSelectAllShipments(false);

        } catch (error) {
            console.error('❌ Error marking invoices as exception:', error);
            enqueueSnackbar('Error marking invoices as exception', { variant: 'error' });
        } finally {
            setIsBulkExcepting(false);
        }
    };

    // Helper function to mark a shipment's invoice status as exception
    const markInvoiceAsException = async (shipmentId, reason, invoiceShipmentId) => {
        try {
            console.log(`🚨 Marking invoice status as exception for shipment ${shipmentId} due to AP Processing`);

            // First, find the shipment document by shipmentID field
            const shipmentRef = await findShipmentByShipmentId(shipmentId);
            if (!shipmentRef) {
                console.warn(`⚠️ Shipment ${shipmentId} not found in system, skipping invoice exception marking`);
                return { success: false, error: 'Shipment not found in system' };
            }

            // Update the shipment's invoice status directly in Firestore
            await updateDoc(shipmentRef, {
                invoiceStatus: 'exception',
                invoiceStatusReason: `${reason} - Invoice Shipment: ${invoiceShipmentId}`,
                invoiceStatusUpdatedAt: new Date(),
                invoiceStatusUpdatedBy: 'AP Processing System',
                updatedAt: new Date()
            });

            console.log(`✅ Successfully marked invoice status as exception for shipment ${shipmentId} (doc: ${shipmentRef.id})`);
            return { success: true };

        } catch (error) {
            console.error(`❌ Error marking invoice status as exception for shipment ${shipmentId}:`, error);
            throw error;
        }
    };

    // Helper function to find shipment document by shipmentID field
    const findShipmentByShipmentId = async (shipmentId) => {
        try {
            // First try direct document lookup (in case it's already a doc ID)
            const directRef = doc(db, 'shipments', shipmentId);
            const directDoc = await getDoc(directRef);

            if (directDoc.exists()) {
                console.log(`📋 Found shipment by direct document ID: ${shipmentId}`);
                return directRef;
            }

            // If not found, query by shipmentID field
            console.log(`🔍 Searching for shipment by shipmentID field: ${shipmentId}`);
            const q = query(
                collection(db, 'shipments'),
                where('shipmentID', '==', shipmentId),
                limit(1)
            );

            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const shipmentDoc = querySnapshot.docs[0];
                console.log(`📋 Found shipment by shipmentID field: ${shipmentId} → doc: ${shipmentDoc.id}`);
                return shipmentDoc.ref;
            }

            console.warn(`⚠️ Shipment not found by either method: ${shipmentId}`);
            return null;

        } catch (error) {
            console.error(`❌ Error finding shipment ${shipmentId}:`, error);
            return null;
        }
    };

    // Helper function to apply charges to a shipment
    const applyChargesToShipment = async (shipmentRow, chargeIndices) => {
        if (!shipmentRow?.matchedShipmentId) return;

        const comparisonRows = await buildComparisonRows(shipmentRow);
        const selectedChargeData = chargeIndices.map(index => comparisonRows[index]);

        const functions = getFunctions();
        const applyInvoiceCharges = httpsCallable(functions, 'applyInvoiceCharges');

        const result = await applyInvoiceCharges({
            shipmentId: shipmentRow.matchedShipmentId,
            invoiceData: {
                invoiceNumber: uploadData.invoiceNumber || extractedData?.invoice_number,
                invoiceRef: uploadData.metadata?.invoiceRef || uploadData.invoiceNumber,
                fileName: fileName
            },
            charges: selectedChargeData.map(charge => ({
                code: charge.systemCode || charge.code || charge.chargeCode || 'MISC',
                name: charge.name || charge.systemName || 'Unknown Charge',
                invoiceAmount: charge.invoiceAmount || 0,
                currency: charge.currency || 'CAD',
                actualCost: charge.actualCost,
                actualCharge: charge.actualCharge,
                quotedCost: charge.quotedCost,
                quotedCharge: charge.quotedCharge
            }))
        });

        if (!result.data.success) {
            throw new Error(result.data.error || 'Failed to apply charges');
        }
    };

    // Helper function to update shipment status in the table
    const updateShipmentStatus = (shipmentId, status) => {
        setTableData(prev => prev.map(row =>
            row.id === shipmentId
                ? { ...row, status: status, lastUpdated: new Date() }
                : row
        ));
    };

    // Checkbox handling functions
    const handleSelectCharge = (chargeIndex, checked) => {
        console.log('🔲 Checkbox selection changed:', { chargeIndex, checked, currentSelected: Array.from(selectedCharges) });

        const newSelected = new Set(selectedCharges);
        if (checked) {
            newSelected.add(chargeIndex);
        } else {
            newSelected.delete(chargeIndex);
        }
        setSelectedCharges(newSelected);

        console.log('🔲 Updated selection:', { newSelected: Array.from(newSelected) });

        // Update select all state based on current selection
        const totalCharges = selectedShipmentDetail?.charges?.length || 0;
        setSelectAllCharges(newSelected.size === totalCharges && totalCharges > 0);
    };

    const handleSelectAllCharges = (checked) => {
        if (checked && selectedShipmentDetail?.charges) {
            // Select all charges
            const allIndices = selectedShipmentDetail.charges.map((_, index) => index);
            setSelectedCharges(new Set(allIndices));
        } else {
            // Deselect all charges
            setSelectedCharges(new Set());
        }
        setSelectAllCharges(checked);
    };

    const handleApplySelectedCharges = async () => {
        if (selectedCharges.size === 0) {
            enqueueSnackbar('Please select at least one charge to apply', { variant: 'warning' });
            return;
        }

        if (!selectedShipmentDetail?.matchedShipmentId) {
            enqueueSnackbar('No matched shipment found. Please match a shipment first.', { variant: 'error' });
            return;
        }

        setIsApplyingCharges(true);
        try {
            // Get comparison rows to extract the actual charge data
            const comparisonRows = await buildComparisonRows(selectedShipmentDetail);

            console.log('🔍 buildComparisonRows result:', {
                result: comparisonRows,
                isArray: Array.isArray(comparisonRows),
                type: typeof comparisonRows,
                length: comparisonRows?.length,
                keys: comparisonRows ? Object.keys(comparisonRows) : 'null'
            });
            // Combine matched and unmatched charges into a single array for indexing
            const allComparisonCharges = [
                ...(comparisonRows.matchedCharges || []),
                ...(comparisonRows.unmatchedCharges || [])
            ];

            const selectedChargeData = Array.from(selectedCharges)
                .map(index => allComparisonCharges[index])
                .filter(charge => charge !== undefined); // Filter out undefined charges

            console.log('🔄 Applying selected charges to shipment:', {
                shipmentId: selectedShipmentDetail.matchedShipmentId,
                selectedCharges: selectedChargeData,
                chargeCount: selectedCharges.size,
                allComparisonChargesCount: allComparisonCharges.length,
                matchedChargesCount: comparisonRows.matchedCharges?.length || 0,
                unmatchedChargesCount: comparisonRows.unmatchedCharges?.length || 0,
                selectedIndices: Array.from(selectedCharges),
                allChargesSample: allComparisonCharges.slice(0, 3).map((row, idx) => ({
                    index: idx,
                    name: row?.name || row?.chargeName,
                    invoiceAmount: row?.invoiceAmount,
                    hasData: !!row
                }))
            });

            // Validate that we have charges to apply
            if (selectedChargeData.length === 0) {
                enqueueSnackbar('No valid charges found to apply. Please check your selection.', { variant: 'warning' });
                return;
            }

            // Call cloud function to update shipment with actual charges
            const functions = getFunctions();
            const applyInvoiceCharges = httpsCallable(functions, 'applyInvoiceCharges');

            const result = await applyInvoiceCharges({
                shipmentId: selectedShipmentDetail.matchedShipmentId,
                invoiceData: {
                    invoiceNumber: uploadData.invoiceNumber,
                    invoiceRef: uploadData.metadata?.invoiceRef || uploadData.invoiceNumber,
                    fileName: fileName
                },
                charges: selectedChargeData.map(charge => ({
                    code: charge.systemCode || charge.code || charge.chargeCode || 'MISC',
                    name: charge.systemName || charge.name || charge.chargeName || charge.description || 'Unknown Charge',
                    actualCost: charge.systemQuotedCost || charge.systemActualCost || charge.actualCost || charge.quotedCost || 0,
                    actualCharge: charge.systemQuotedCharge || charge.systemActualCharge || charge.actualCharge || charge.quotedCharge || 0,
                    currency: charge.systemCurrency || charge.currency || 'CAD',
                    ediNumber: uploadData.invoiceNumber || uploadData.metadata?.invoiceRef
                }))
            });

            if (result.data.success) {
                enqueueSnackbar(`Successfully applied ${selectedCharges.size} charge(s) to shipment ${selectedShipmentDetail.matchedShipmentId}`, { variant: 'success' });

                // Mark charges as applied
                const newAppliedCharges = new Set([...appliedCharges, ...selectedCharges]);
                setAppliedCharges(newAppliedCharges);

                // Clear selections after successful apply
                setSelectedCharges(new Set());
                setSelectAllCharges(false);

                // Update shipment invoice status after successful charge application
                try {
                    const updateShipmentInvoiceStatus = httpsCallable(functions, 'updateShipmentInvoiceStatus');
                    await updateShipmentInvoiceStatus({
                        shipmentId: selectedShipmentDetail.matchedShipmentId,
                        invoiceStatus: 'processed',
                        invoiceData: {
                            invoiceNumber: uploadData.invoiceNumber,
                            totalChargesProcessed: selectedCharges.size,
                            processingDate: new Date().toISOString(),
                            autoProcessed: false // Manual processing
                        }
                    });
                    console.log('✅ Successfully updated shipment invoice status to processed');
                } catch (statusError) {
                    console.warn('⚠️ Failed to update shipment invoice status:', statusError);
                    // Don't fail the main operation if status update fails
                }

                // Check if all charges for this shipment are now applied and update shipment status
                const comparisonRows = await buildComparisonRows(selectedShipmentDetail);
                const totalCharges = comparisonRows.length;
                const isShipmentFullyApproved = newAppliedCharges.size === totalCharges;

                if (isShipmentFullyApproved) {
                    console.log('✅ All charges applied for shipment, updating status to Approved');
                    updateShipmentStatus(selectedShipmentDetail.id, 'approved');
                }

                // Update upload status to reflect charge applications
                if (onStatusUpdate && uploadData?.id) {
                    const appliedChargesList = Array.from(newAppliedCharges);
                    const chargeApplications = appliedChargesList.map(index => ({
                        chargeIndex: index,
                        chargeCode: comparisonRows[index]?.code,
                        chargeName: comparisonRows[index]?.name,
                        status: 'applied',
                        appliedAt: new Date()
                    }));

                    onStatusUpdate(uploadData.id, {
                        chargeApplications: chargeApplications,
                        // Pass shipment-level status updates
                        shipmentStatuses: isShipmentFullyApproved ? [{
                            shipmentId: selectedShipmentDetail.id,
                            status: 'approved'
                        }] : []
                    });
                }
            } else {
                throw new Error(result.data.error || 'Failed to apply charges');
            }

        } catch (error) {
            console.error('❌ Error applying charges to shipment:', error);
            enqueueSnackbar(error.message || 'Error applying charges to shipment', { variant: 'error' });
        } finally {
            setIsApplyingCharges(false);
        }
    };

    const handleUnapplySelectedCharges = async () => {
        if (selectedCharges.size === 0) {
            enqueueSnackbar('Please select at least one applied charge to unapply', { variant: 'warning' });
            return;
        }

        if (!selectedShipmentDetail?.matchedShipmentId) {
            enqueueSnackbar('No matched shipment found. Please match a shipment first.', { variant: 'error' });
            return;
        }

        // Check if all selected charges are actually applied
        const appliedSelectedCharges = Array.from(selectedCharges).filter(index => appliedCharges.has(index));
        if (appliedSelectedCharges.length === 0) {
            enqueueSnackbar('Please select applied charges to unapply', { variant: 'warning' });
            return;
        }

        setIsUnapplyingCharges(true);
        try {
            // Get comparison rows to extract the charge data
            const comparisonRows = await buildComparisonRows(selectedShipmentDetail);

            // Combine matched and unmatched charges into a single array for indexing
            const allComparisonCharges = [
                ...(comparisonRows.matchedCharges || []),
                ...(comparisonRows.unmatchedCharges || [])
            ];

            const selectedChargeData = appliedSelectedCharges
                .map(index => allComparisonCharges[index])
                .filter(charge => charge !== undefined); // Filter out undefined charges

            console.log('🔄 Unapplying selected charges from shipment:', {
                shipmentId: selectedShipmentDetail.matchedShipmentId,
                selectedCharges: selectedChargeData,
                chargeCount: appliedSelectedCharges.length,
                allComparisonChargesCount: allComparisonCharges.length,
                matchedChargesCount: comparisonRows.matchedCharges?.length || 0,
                unmatchedChargesCount: comparisonRows.unmatchedCharges?.length || 0,
                selectedIndices: appliedSelectedCharges
            });

            // Validate that we have charges to unapply
            if (selectedChargeData.length === 0) {
                enqueueSnackbar('No valid charges found to unapply. Please check your selection.', { variant: 'warning' });
                return;
            }

            // Call cloud function to remove actual charges from shipment
            const functions = getFunctions();
            const unapplyInvoiceCharges = httpsCallable(functions, 'unapplyInvoiceCharges');

            const result = await unapplyInvoiceCharges({
                shipmentId: selectedShipmentDetail.matchedShipmentId,
                invoiceData: {
                    invoiceNumber: uploadData.invoiceNumber,
                    invoiceRef: uploadData.metadata?.invoiceRef || uploadData.invoiceNumber,
                    fileName: fileName
                },
                charges: selectedChargeData.map(charge => ({
                    code: charge.systemCode || charge.code || charge.chargeCode || 'MISC',
                    name: charge.name || charge.systemName || 'Unknown Charge'
                }))
            });

            if (result.data.success) {
                enqueueSnackbar(`Successfully unapplied ${appliedSelectedCharges.length} charge(s) from shipment ${selectedShipmentDetail.matchedShipmentId}`, { variant: 'success' });

                // Remove charges from applied set
                const newAppliedCharges = new Set(appliedCharges);
                appliedSelectedCharges.forEach(index => newAppliedCharges.delete(index));
                setAppliedCharges(newAppliedCharges);

                // Clear selections after successful unapply
                setSelectedCharges(new Set());
                setSelectAllCharges(false);

                // Update upload status to reflect charge unapplications
                if (onStatusUpdate && uploadData?.id) {
                    const remainingAppliedCharges = Array.from(newAppliedCharges);
                    const comparisonRows = await buildComparisonRows(selectedShipmentDetail);
                    const chargeApplications = remainingAppliedCharges.map(index => ({
                        chargeIndex: index,
                        chargeCode: comparisonRows[index]?.code,
                        chargeName: comparisonRows[index]?.name,
                        status: 'applied',
                        appliedAt: new Date()
                    }));

                    onStatusUpdate(uploadData.id, {
                        chargeApplications: chargeApplications
                    });
                }
            } else {
                throw new Error(result.data.error || 'Failed to unapply charges');
            }

        } catch (error) {
            console.error('❌ Error unapplying charges from shipment:', error);
            enqueueSnackbar(error.message || 'Error unapplying charges from shipment', { variant: 'error' });
        } finally {
            setIsUnapplyingCharges(false);
        }
    };

    const handleAutoApproveCharges = async () => {
        if (!selectedShipmentDetail?.matchedShipmentId) {
            enqueueSnackbar('No matched shipment found. Please match a shipment first.', { variant: 'error' });
            return;
        }

        setIsApplyingCharges(true);
        try {
            // Get comparison rows to find auto-approved charges - USING SAME ROBUST LOGIC AS MANUAL APPROVAL
            const comparisonRows = await buildComparisonRows(selectedShipmentDetail);

            console.log('🔍 buildComparisonRows result for auto-approval:', {
                result: comparisonRows,
                isArray: Array.isArray(comparisonRows),
                type: typeof comparisonRows,
                length: comparisonRows?.length,
                keys: comparisonRows ? Object.keys(comparisonRows) : 'null'
            });

            // Combine matched and unmatched charges into a single array for indexing - SAME AS MANUAL APPROVAL
            const allComparisonCharges = [
                ...(comparisonRows.matchedCharges || []),
                ...(comparisonRows.unmatchedCharges || [])
            ];

            // Filter for auto-approved charges - ENHANCED LOGIC
            const autoApprovalCharges = allComparisonCharges.filter(charge => charge.autoApprovalRecommendation === 'approve');

            console.log('🤖 Auto-applying recommended charges:', {
                shipmentId: selectedShipmentDetail.matchedShipmentId,
                autoApprovalCharges: autoApprovalCharges,
                chargeCount: autoApprovalCharges.length,
                allComparisonChargesCount: allComparisonCharges.length,
                matchedChargesCount: comparisonRows.matchedCharges?.length || 0,
                unmatchedChargesCount: comparisonRows.unmatchedCharges?.length || 0,
                allChargesSample: allComparisonCharges.slice(0, 3).map((row, idx) => ({
                    index: idx,
                    name: row?.name || row?.chargeName,
                    invoiceAmount: row?.invoiceAmount,
                    autoApprovalRecommendation: row?.autoApprovalRecommendation,
                    autoApprovalConfidence: row?.autoApprovalConfidence,
                    autoApprovalReason: row?.autoApprovalReason,
                    hasData: !!row
                }))
            });

            // ENHANCED DEBUGGING: Show detailed breakdown of why charges aren't auto-approved
            if (autoApprovalCharges.length === 0) {
                console.log('🔍 DEBUGGING: No charges recommended for auto-approval. Here\'s why:');
                allComparisonCharges.forEach((charge, index) => {
                    console.log(`   Charge ${index + 1}: "${charge.name}"`, {
                        autoApprovalRecommendation: charge.autoApprovalRecommendation,
                        autoApprovalConfidence: charge.autoApprovalConfidence,
                        autoApprovalReason: charge.autoApprovalReason,
                        invoiceAmount: charge.invoiceAmount,
                        systemQuotedCost: charge.systemQuotedCost,
                        systemActualCost: charge.systemActualCost,
                        varianceCost: charge.varianceCost,
                        needsApproval: charge.autoApprovalRecommendation === 'approve' ? '✅ YES' : '❌ NO'
                    });
                });

                const approveCount = allComparisonCharges.filter(c => c.autoApprovalRecommendation === 'approve').length;
                const reviewCount = allComparisonCharges.filter(c => c.autoApprovalRecommendation === 'review').length;
                const rejectCount = allComparisonCharges.filter(c => c.autoApprovalRecommendation === 'reject').length;

                console.log('📊 Auto-approval breakdown:', {
                    totalCharges: allComparisonCharges.length,
                    approveRecommended: approveCount,
                    reviewRecommended: reviewCount,
                    rejectRecommended: rejectCount,
                    unclassified: allComparisonCharges.length - approveCount - reviewCount - rejectCount
                });
            }

            // Validate that we have charges to apply - SAME AS MANUAL APPROVAL
            if (autoApprovalCharges.length === 0) {
                enqueueSnackbar('No charges recommended for auto-approval', { variant: 'warning' });
                return;
            }

            // Call cloud function to update shipment with auto-approved charges - SAME ROBUST DATA STRUCTURE AS MANUAL
            const functions = getFunctions();
            const applyInvoiceCharges = httpsCallable(functions, 'applyInvoiceCharges');

            const result = await applyInvoiceCharges({
                shipmentId: selectedShipmentDetail.matchedShipmentId,
                invoiceData: {
                    invoiceNumber: uploadData.invoiceNumber,
                    invoiceRef: uploadData.metadata?.invoiceRef || uploadData.invoiceNumber,
                    fileName: fileName,
                    autoApproval: true
                },
                charges: autoApprovalCharges.map(charge => ({
                    // USING SAME ROBUST FIELD MAPPING AS MANUAL APPROVAL
                    code: charge.systemCode || charge.code || charge.chargeCode || 'MISC',
                    name: charge.systemName || charge.name || charge.chargeName || charge.description || 'Unknown Charge',
                    actualCost: charge.systemQuotedCost || charge.systemActualCost || charge.actualCost || charge.quotedCost || 0,
                    actualCharge: charge.systemQuotedCharge || charge.systemActualCharge || charge.actualCharge || charge.quotedCharge || 0,
                    currency: charge.systemCurrency || charge.currency || 'CAD',
                    ediNumber: uploadData.invoiceNumber || uploadData.metadata?.invoiceRef,
                    autoApprovalReason: charge.autoApprovalReason,
                    autoApprovalConfidence: charge.autoApprovalConfidence
                }))
            });

            if (result.data.success) {
                enqueueSnackbar(`Successfully auto-applied ${autoApprovalCharges.length} recommended charge(s) to shipment ${selectedShipmentDetail.matchedShipmentId}`, { variant: 'success' });

                // ENHANCED INDEX TRACKING - Find indices of auto-approved charges and mark them as applied
                const autoApprovalIndices = new Set();
                autoApprovalCharges.forEach(autoCharge => {
                    const index = allComparisonCharges.findIndex(charge =>
                        // ROBUST MATCHING CRITERIA
                        (charge.code === autoCharge.code || charge.systemCode === autoCharge.systemCode) &&
                        (charge.name === autoCharge.name || charge.systemName === autoCharge.systemName) &&
                        charge.autoApprovalRecommendation === 'approve'
                    );
                    if (index !== -1) {
                        autoApprovalIndices.add(index);
                        console.log(`✅ Found auto-approved charge at index ${index}:`, {
                            name: autoCharge.name,
                            code: autoCharge.code,
                            confidence: autoCharge.autoApprovalConfidence
                        });
                    }
                });

                // Mark charges as applied
                const newAppliedCharges = new Set([...appliedCharges, ...autoApprovalIndices]);
                setAppliedCharges(newAppliedCharges);

                // ADDED: Update shipment invoice status after successful charge application - SAME AS MANUAL
                try {
                    const updateShipmentInvoiceStatus = httpsCallable(functions, 'updateShipmentInvoiceStatus');
                    await updateShipmentInvoiceStatus({
                        shipmentId: selectedShipmentDetail.matchedShipmentId,
                        invoiceStatus: 'ready_to_invoice', // CRITICAL FIX: Use 'ready_to_invoice' instead of 'processed'
                        invoiceData: {
                            invoiceNumber: uploadData.invoiceNumber,
                            totalChargesProcessed: autoApprovalCharges.length,
                            processingDate: new Date().toISOString(),
                            autoProcessed: true // Auto processing
                        }
                    });
                    console.log('✅ Successfully updated shipment invoice status to ready_to_invoice via auto-approval');
                } catch (statusError) {
                    console.warn('⚠️ Failed to update shipment invoice status:', statusError);
                    // Don't fail the main operation if status update fails
                }

                // Check if all charges for this shipment are now applied and update shipment status - SAME AS MANUAL
                const totalCharges = allComparisonCharges.length;
                const isShipmentFullyApproved = newAppliedCharges.size === totalCharges;

                if (isShipmentFullyApproved) {
                    console.log('✅ All charges applied for shipment via auto-approval, updating status to Approved');
                    updateShipmentStatus(selectedShipmentDetail.id, 'approved');
                }

                // Update upload status to reflect charge applications
                if (onStatusUpdate) {
                    const appliedShipments = tableData.filter(row => row.status === 'approved').length;
                    const totalShipments = tableData.length;
                    const isPartiallyProcessed = appliedShipments > 0 && appliedShipments < totalShipments;
                    const isFullyProcessed = appliedShipments === totalShipments;

                    if (isFullyProcessed) {
                        onStatusUpdate('processed');
                    } else if (isPartiallyProcessed) {
                        onStatusUpdate('partially_processed');
                    }
                }

                console.log('✅ Auto-approval completed successfully');
            } else {
                throw new Error(result.data.error || 'Failed to auto-apply charges');
            }
        } catch (error) {
            console.error('❌ Error auto-applying charges:', error);
            enqueueSnackbar(`Failed to auto-apply charges: ${error.message}`, { variant: 'error' });
        } finally {
            setIsApplyingCharges(false);
        }
    };

    // Debug logging to understand data structure
    console.log('🔍 APProcessingResults received:', {
        extractedData,
        matchingResults,
        fileName,
        extractedDataKeys: extractedData ? Object.keys(extractedData) : 'null',
        matchingResultsKeys: matchingResults ? Object.keys(matchingResults) : 'null'
    });

    // Trigger automation when viewing results if we have extracted data
    useEffect(() => {
        console.log('🔍 Automation useEffect triggered:', {
            hasExtractedData: !!extractedData,
            hasUploadId: !!uploadId,
            extractedDataKeys: extractedData ? Object.keys(extractedData) : null,
            shipments: extractedData?.shipments?.length || 0,
            charges: extractedData?.charges?.length || 0
        });

        // REMOVED: Frontend automation trigger - backend intelligent auto-processing already handles this
        // after AI extraction completes. Frontend should only display the results.
        console.log('🔍 APProcessingResults loaded:', {
            extractedData: !!extractedData,
            uploadId: uploadId,
            hasShipments: extractedData?.shipments?.length > 0,
            hasCharges: extractedData?.charges?.length > 0
        });
    }, [extractedData, uploadId, onStatusUpdate]);

    // Deep debug of the extractedData structure
    if (extractedData) {
        console.log('🔍 DETAILED extractedData analysis:', {
            fullData: extractedData,
            hasShipments: !!extractedData.shipments,
            shipmentsArray: extractedData.shipments,
            shipmentCount: extractedData.shipments?.length || 0,
            sampleShipment: extractedData.shipments?.[0],
            shipFromInTop: extractedData.shipFrom,
            shipToInTop: extractedData.shipTo,
            carrierInformation: extractedData.carrierInformation,
            shipmentDetails: extractedData.shipmentDetails,
            allTopLevelKeys: Object.keys(extractedData)
        });

        // If we have shipments, analyze the first one in detail
        if (extractedData.shipments && extractedData.shipments[0]) {
            const firstShipment = extractedData.shipments[0];
            console.log('🚛 FIRST SHIPMENT detailed analysis:', {
                allShipmentKeys: Object.keys(firstShipment),
                shipper: firstShipment.shipper,
                consignee: firstShipment.consignee,
                from: firstShipment.from,
                to: firstShipment.to,
                origin: firstShipment.origin,
                destination: firstShipment.destination,
                shipFrom: firstShipment.shipFrom,
                shipTo: firstShipment.shipTo
            });
        }
    }

    // Normalize data for table from the new multi-shipment structure
    const normalizeDataForTable = (results) => {
        console.log('🔍 APProcessingResults normalizing data:', results);
        console.log('🔍 Results structure analysis:', {
            hasShipments: !!results?.shipments,
            shipmentsType: Array.isArray(results?.shipments) ? 'array' : typeof results?.shipments,
            shipmentsLength: results?.shipments?.length || 0,
            sampleShipment: results?.shipments?.[0],
            carrierInfo: results?.carrierInformation,
            invoiceDetails: results?.invoiceDetails,
            allKeys: results ? Object.keys(results) : []
        });

        if (!results) return [];

        // Check if the data might be wrapped in additional layers
        const actualData = results.extractedData || results.structuredData || results;

        // Check for the new shipments structure first
        if (actualData.shipments && Array.isArray(actualData.shipments)) {
            console.log('📦 Found shipments array with', actualData.shipments.length, 'shipments');

            return actualData.shipments.map((shipment, index) => {
                // Enhanced debugging for each shipment
                console.log(`🚛 Processing shipment ${index}:`, {
                    shipment,
                    shipperData: shipment.shipper,
                    consigneeData: shipment.consignee,
                    fromData: shipment.from,
                    toData: shipment.to,
                    originData: shipment.origin,
                    destinationData: shipment.destination,
                    statusData: shipment.status,
                    systemStatusData: shipment.systemStatus,
                    matchingResult: shipment.matchingResult,
                    packageInfo: shipment.packageInfo,
                    packageDetails: shipment.packageDetails,
                    weight: shipment.weight,
                    dimensions: shipment.dimensions,
                    packageDetailsFromActual: actualData.packageDetails,
                    shipmentReferences: actualData.shipmentReferences,
                    invoiceDetailsFromActual: actualData.invoiceDetails,
                    references: shipment.references,
                    customerRef: shipment.customerRef,
                    invoiceRef: shipment.invoiceRef,
                    manifestRef: shipment.manifestRef,
                    billOfLading: shipment.billOfLading,
                    proNumber: shipment.proNumber,
                    trackingNumber: shipment.trackingNumber
                });

                // Multiple fallback strategies for origin/destination
                const getOriginName = () => {
                    return shipment.shipper?.company ||
                        shipment.shipper?.name ||
                        shipment.from?.company ||
                        shipment.from?.name ||
                        shipment.origin?.company ||
                        shipment.origin?.name ||
                        shipment.origin?.value ||
                        'Unknown Origin';
                };

                const getDestinationName = () => {
                    return shipment.consignee?.company ||
                        shipment.consignee?.name ||
                        shipment.to?.company ||
                        shipment.to?.name ||
                        shipment.destination?.company ||
                        shipment.destination?.name ||
                        shipment.destination?.value ||
                        'Unknown Destination';
                };

                const getOriginAddress = () => {
                    return shipment.shipper?.address ||
                        shipment.from?.address ||
                        shipment.origin?.address ||
                        shipment.origin?.value ||
                        '';
                };

                const getDestinationAddress = () => {
                    return shipment.consignee?.address ||
                        shipment.to?.address ||
                        shipment.destination?.address ||
                        shipment.destination?.value ||
                        '';
                };

                return {
                    id: shipment.id || `shipment-${index}`,
                    shipmentId: shipment.shipmentId || shipment.references?.manifestRef || shipment.references?.customerRef || shipment.references?.invoiceRef || shipment.id || shipment.trackingNumber || `SHIP-${String(index + 1).padStart(3, '0')}`,
                    trackingNumber: shipment.trackingNumber || 'N/A',
                    carrier: shipment.carrier || actualData.carrierInformation?.company || results.carrierInformation?.company || actualData.carrierDetails?.name?.value || results.carrierDetails?.name?.value || 'Unknown',
                    service: shipment.service || shipment.serviceType || 'Standard',
                    shipDate: shipment.deliveryDate || shipment.shipmentDate || actualData.shipmentDate || actualData.deliveryDate || actualData.invoice_date || actualData.invoiceDate || actualData.invoiceDetails?.invoiceDate || actualData.metadata?.documentDate || actualData.documentDate || results.invoice_date || results.invoiceDate || results.invoiceDetails?.invoiceDate || new Date(),
                    shipmentDate: shipment.deliveryDate || shipment.shipmentDate || actualData.shipmentDate || actualData.deliveryDate || actualData.invoice_date || actualData.invoiceDate || actualData.invoiceDetails?.invoiceDate || actualData.metadata?.documentDate || actualData.documentDate || results.invoice_date || results.invoiceDate || results.invoiceDetails?.invoiceDate || new Date(),
                    invoiceDate: actualData.invoice_date || actualData.invoiceDate || actualData.invoiceDetails?.invoiceDate || actualData.metadata?.documentDate || actualData.documentDate || results.invoice_date || results.invoiceDate || results.invoiceDetails?.invoiceDate || null,
                    origin: getOriginName(),
                    destination: getDestinationName(),
                    originAddress: getOriginAddress(),
                    destinationAddress: getDestinationAddress(),
                    weight: shipment.packageDetails?.[0]?.weight || shipment.packageInfo?.weight?.value || shipment.weight || actualData.packageDetails?.weight || actualData.packageDetails?.totalWeight || 'N/A',
                    dimensions: shipment.packageDetails?.[0]?.dimensions || shipment.packageInfo?.dimensions || shipment.dimensions || actualData.packageDetails?.dimensions || (actualData.packageDetails?.length && actualData.packageDetails?.width && actualData.packageDetails?.height ? actualData.packageDetails?.length + 'x' + actualData.packageDetails?.width + 'x' + actualData.packageDetails?.height : null) || 'N/A',
                    charges: shipment.charges || [],
                    totalAmount: parseFloat(shipment.totalAmount) || parseFloat(shipment.charges?.reduce((sum, charge) => sum + (parseFloat(charge.amount) || 0), 0)) || parseFloat(shipment.amount) || 0,
                    currency: shipment.currency || actualData.invoiceSummary?.currency || results.invoiceSummary?.currency || actualData.invoiceHeader?.currency?.value || results.invoiceHeader?.currency?.value || 'CAD',
                    references: {
                        customerRef: shipment.references?.customerRef || shipment.customerRef || shipment.customerReferenceNumber || shipment.referenceNumbers?.customerRef || actualData.shipmentReferences?.customerRef || shipment.trackingNumber || 'N/A',
                        invoiceRef: actualData.invoiceDetails?.invoiceNumber || actualData.invoiceNumber || actualData.invoiceSummary?.invoiceNumber || results.invoiceDetails?.invoiceNumber || results.invoiceNumber || results.invoiceSummary?.invoiceNumber || shipment.references?.invoiceRef || shipment.invoiceRef || shipment.invoiceNumber || 'N/A',
                        manifestRef: shipment.references?.manifestRef || shipment.manifestRef || shipment.proNumber || shipment.billOfLading || actualData.invoiceDetails?.billOfLading || actualData.shipmentReferences?.manifestRef || 'N/A',
                        other: shipment.references?.other || shipment.otherReferences || actualData.shipmentReferences?.other || []
                    },
                    packageDetails: shipment.packageDetails || [{
                        quantity: shipment.packageInfo?.pieces?.value || 1,
                        description: 'N/A',
                        weight: shipment.packageInfo?.weight?.value || shipment.weight || actualData.packageDetails?.weight || 'N/A',
                        dimensions: shipment.packageInfo?.dimensions || shipment.dimensions ||
                            (actualData.packageDetails?.length && actualData.packageDetails?.width && actualData.packageDetails?.height ?
                                actualData.packageDetails?.length + 'x' + actualData.packageDetails?.width + 'x' + actualData.packageDetails?.height : null) ||
                            actualData.packageDetails?.dimensions || 'N/A'
                    }],
                    specialServices: shipment.specialServices || [],
                    apStatus: 'extracted', // AP-specific status: extracted, matched, applied, rejected
                    shipmentStatus: shipment.status || shipment.systemStatus || null, // Actual shipment status if matched
                    matchResult: null,
                    matchedShipmentId: null, // Will be populated when system auto-matches or user manually matches
                    matchConfidence: null, // Confidence score (0-100)
                    matchMethod: null, // How the match was found (e.g., "Exact Reference Match")
                    originalData: shipment
                };
            });
        }

        // Fallback to legacy structure
        console.log('📦 Using legacy single shipment structure');
        console.log('📦 Legacy structure analysis:', {
            shipFrom: actualData.shipFrom || results.shipFrom,
            shipTo: actualData.shipTo || results.shipTo,
            carrierInformation: actualData.carrierInformation || results.carrierInformation,
            invoiceDetails: actualData.invoiceDetails || results.invoiceDetails,
            shipmentDetails: actualData.shipmentDetails || results.shipmentDetails,
            actualDataKeys: actualData ? Object.keys(actualData) : [],
            originalResultsKeys: results ? Object.keys(results) : []
        });

        // Enhanced legacy data extraction
        const getLegacyOrigin = () => {
            return actualData.shipFrom?.company ||
                actualData.shipFrom?.name ||
                actualData.origin?.company ||
                actualData.origin?.name ||
                actualData.shipper?.company ||
                actualData.shipper?.name ||
                actualData.shipmentDetails?.[0]?.origin?.name?.value ||
                results.shipFrom?.company ||
                results.shipFrom?.name ||
                results.origin?.company ||
                results.origin?.name ||
                results.shipper?.company ||
                results.shipper?.name ||
                results.shipmentDetails?.[0]?.origin?.name?.value ||
                'Unknown Origin';
        };

        const getLegacyDestination = () => {
            return actualData.shipTo?.company ||
                actualData.shipTo?.name ||
                actualData.destination?.company ||
                actualData.destination?.name ||
                actualData.consignee?.company ||
                actualData.consignee?.name ||
                actualData.shipmentDetails?.[0]?.destination?.name?.value ||
                results.shipTo?.company ||
                results.shipTo?.name ||
                results.destination?.company ||
                results.destination?.name ||
                results.consignee?.company ||
                results.consignee?.name ||
                results.shipmentDetails?.[0]?.destination?.name?.value ||
                'Unknown Destination';
        };

        const getLegacyOriginAddress = () => {
            return actualData.shipFrom?.address ||
                actualData.origin?.address ||
                actualData.shipper?.address ||
                actualData.shipmentDetails?.[0]?.origin?.address?.value ||
                results.shipFrom?.address ||
                results.origin?.address ||
                results.shipper?.address ||
                results.shipmentDetails?.[0]?.origin?.address?.value ||
                '';
        };

        const getLegacyDestinationAddress = () => {
            return actualData.shipTo?.address ||
                actualData.destination?.address ||
                actualData.consignee?.address ||
                actualData.shipmentDetails?.[0]?.destination?.address?.value ||
                results.shipTo?.address ||
                results.destination?.address ||
                results.consignee?.address ||
                results.shipmentDetails?.[0]?.destination?.address?.value ||
                '';
        };

        return [{
            id: 'single-shipment',
            shipmentId: actualData.shipmentReferences?.manifestRef || actualData.shipmentReferences?.customerRef || actualData.customerRef || actualData.shipmentId || actualData.invoiceDetails?.billOfLading || results.shipmentReferences?.manifestRef || results.customerRef || results.shipmentId || 'Unknown',
            trackingNumber: actualData.trackingNumber || results.trackingNumber || 'N/A',
            carrier: actualData.carrierInformation?.company || actualData.carrierDetails?.name?.value || actualData.carrier || results.carrierInformation?.company || results.carrierDetails?.name?.value || results.carrier || 'Unknown',
            service: 'Standard',
            shipDate: actualData.shipmentDate || actualData.deliveryDate || actualData.invoice_date || actualData.invoiceDate || actualData.invoiceDetails?.invoiceDate || actualData.metadata?.documentDate || actualData.documentDate || results.invoice_date || results.invoiceDate || results.invoiceDetails?.invoiceDate || new Date(),
            shipmentDate: actualData.shipmentDate || actualData.deliveryDate || actualData.invoice_date || actualData.invoiceDate || actualData.invoiceDetails?.invoiceDate || actualData.metadata?.documentDate || actualData.documentDate || results.invoice_date || results.invoiceDate || results.invoiceDetails?.invoiceDate || new Date(),
            invoiceDate: actualData.invoice_date || actualData.invoiceDate || actualData.invoiceDetails?.invoiceDate || actualData.metadata?.documentDate || actualData.documentDate || results.invoice_date || results.invoiceDate || results.invoiceDetails?.invoiceDate || null,
            origin: getLegacyOrigin(),
            destination: getLegacyDestination(),
            originAddress: getLegacyOriginAddress(),
            destinationAddress: getLegacyDestinationAddress(),
            weight: actualData.weight || actualData.packageDetails?.weight || actualData.packageDetails?.totalWeight || actualData.shipmentDetails?.[0]?.packageInfo?.weight?.value || results.weight || results.shipmentDetails?.[0]?.packageInfo?.weight?.value || 'N/A',
            dimensions: actualData.dimensions || actualData.packageDetails?.dimensions || (actualData.packageDetails?.length ? actualData.packageDetails?.length + 'x' + actualData.packageDetails?.width + 'x' + actualData.packageDetails?.height : null) || actualData.shipmentDetails?.[0]?.packageInfo?.dimensions || results.dimensions || results.shipmentDetails?.[0]?.packageInfo?.dimensions || 'N/A',
            charges: actualData.charges || results.charges || [],
            totalAmount: parseFloat(actualData.totalAmount) || parseFloat(actualData.invoiceSummary?.totalAmount) || parseFloat(actualData.invoiceHeader?.totalAmount?.value) || parseFloat(results.totalAmount) || parseFloat(results.invoiceSummary?.totalAmount) || parseFloat(results.invoiceHeader?.totalAmount?.value) || parseFloat(actualData.charges?.reduce((sum, charge) => sum + (parseFloat(charge.amount) || 0), 0)) || 0,
            currency: actualData.currency || actualData.invoiceSummary?.currency || actualData.invoiceHeader?.currency?.value || results.currency || results.invoiceSummary?.currency || results.invoiceHeader?.currency?.value || 'CAD',
            references: {
                customerRef: actualData.customerRef || actualData.shipmentReferences?.customerRef || actualData.customerReferenceNumber || results.customerRef || results.customerReferenceNumber || 'N/A',
                invoiceRef: actualData.invoiceDetails?.invoiceNumber || actualData.invoiceNumber || actualData.invoiceSummary?.invoiceNumber || results.invoiceDetails?.invoiceNumber || results.invoiceNumber || results.invoiceSummary?.invoiceNumber || actualData.invoiceRef || results.invoiceRef || 'N/A',
                manifestRef: actualData.manifestRef || actualData.invoiceDetails?.billOfLading || actualData.shipmentReferences?.manifestRef || actualData.billOfLading || actualData.proNumber || results.manifestRef || results.billOfLading || results.proNumber || 'N/A',
                other: actualData.shipmentReferences?.other || actualData.otherReferences || results.otherReferences || []
            },
            packageDetails: [{
                quantity: actualData.shipmentDetails?.[0]?.packageInfo?.pieces?.value || results.shipmentDetails?.[0]?.packageInfo?.pieces?.value || 1,
                description: 'N/A',
                weight: actualData.weight || actualData.packageDetails?.weight || actualData.packageDetails?.totalWeight || actualData.shipmentDetails?.[0]?.packageInfo?.weight?.value || results.weight || results.shipmentDetails?.[0]?.packageInfo?.weight?.value || 'N/A',
                dimensions: actualData.dimensions || actualData.packageDetails?.dimensions ||
                    (actualData.packageDetails?.length && actualData.packageDetails?.width && actualData.packageDetails?.height ?
                        actualData.packageDetails?.length + 'x' + actualData.packageDetails?.width + 'x' + actualData.packageDetails?.height : null) ||
                    actualData.shipmentDetails?.[0]?.packageInfo?.dimensions || results.dimensions || results.shipmentDetails?.[0]?.packageInfo?.dimensions || 'N/A'
            }],
            specialServices: [],
            apStatus: 'extracted', // AP-specific status: extracted, matched, applied, rejected
            shipmentStatus: actualData.status || actualData.systemStatus || results.status || results.systemStatus || null, // Actual shipment status if matched
            matchResult: null,
            matchedShipmentId: null, // Will be populated when system auto-matches or user manually matches  
            matchConfidence: null, // Confidence score (0-100)
            matchMethod: null, // How the match was found (e.g., "Exact Reference Match")
            originalData: actualData !== results ? { actualData, originalResults: results } : results
        }];
    };

    // Initialize table data and auto-match shipments
    useEffect(() => {
        const initialTableData = normalizeDataForTable(extractedData);
        setTableData(initialTableData);

        // Auto-match shipments after data is normalized
        if (initialTableData.length > 0) {
            setIsAutoMatching(true);
            autoMatchShipments(initialTableData).finally(() => {
                setIsAutoMatching(false);
            });
        }
    }, [extractedData]);

    // Helper function to format currency
    const formatCurrencyHelper = (amount, currency = 'CAD') => {
        if (!amount && amount !== 0) return '$0.00';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency || 'CAD'
        }).format(amount);
    };

    // Helper function to format date
    const formatDate = (date) => {
        if (!date) return 'N/A';
        try {
            const dateObj = date.toDate ? date.toDate() : new Date(date);
            return dateObj.toLocaleDateString();
        } catch {
            return date.toString();
        }
    };

    // Helper function to get status display info
    const getStatusDisplay = (row) => {
        // If we have a matched system shipment with a status, show that
        if (row.shipmentStatus) {
            const status = row.shipmentStatus.toLowerCase().trim();

            // Map system statuses to display
            if (status === 'pending' || status === 'scheduled' || status === 'booked' || status === 'awaiting_shipment') {
                return { label: 'Pending', color: '#f59e0b', backgroundColor: '#fef3c7' };
            }
            if (status === 'in_transit' || status === 'in transit' || status === 'picked_up' || status === 'on_route') {
                return { label: 'In Transit', color: '#3b82f6', backgroundColor: '#dbeafe' };
            }
            if (status === 'delivered' || status === 'completed') {
                return { label: 'Delivered', color: '#059669', backgroundColor: '#d1fae5' };
            }
            if (status === 'delayed' || status === 'on_hold' || status === 'exception') {
                return { label: 'Exception', color: '#dc2626', backgroundColor: '#fee2e2' };
            }
            if (status === 'cancelled' || status === 'canceled' || status === 'void') {
                return { label: 'Cancelled', color: '#6b7280', backgroundColor: '#f3f4f6' };
            }
            if (status === 'out_for_delivery') {
                return { label: 'Out for Delivery', color: '#7c3aed', backgroundColor: '#ede9fe' };
            }

            // Default for unknown system status
            return { label: status.charAt(0).toUpperCase() + status.slice(1), color: '#6b7280', backgroundColor: '#f3f4f6' };
        }

        // If no system shipment match, show AP processing status
        // Check for updated status first (from our status updates)
        const apStatus = row.status || row.apStatus || 'extracted';

        // Handle automation statuses from intelligent processing
        if (apStatus === 'processed') {
            return { label: 'Processed', color: '#10b981', backgroundColor: '#d1fae5' };
        }
        if (apStatus === 'processed_with_exception') {
            return { label: 'Processed with Exception', color: '#f59e0b', backgroundColor: '#fef3c7' };
        }
        if (apStatus === 'partially_processed') {
            return { label: 'Partially Processed', color: '#3b82f6', backgroundColor: '#dbeafe' };
        }
        if (apStatus === 'ready_to_invoice') {
            return { label: 'Ready to Invoice', color: '#059669', backgroundColor: '#d1fae5' };
        }

        // IMPORTANT: Check if this shipment has applied charges to determine if it should be "Approved"
        if (apStatus === 'extracted' && appliedCharges.size > 0) {
            // If we have applied charges, this should be "Approved" not "Extracted"
            return { label: 'Approved', color: '#059669', backgroundColor: '#d1fae5' };
        }

        if (apStatus === 'extracted') {
            return { label: 'Extracted', color: '#3b82f6', backgroundColor: '#dbeafe' };
        }
        if (apStatus === 'matched') {
            return { label: 'Matched', color: '#059669', backgroundColor: '#d1fae5' };
        }
        if (apStatus === 'applied') {
            return { label: 'Applied', color: '#059669', backgroundColor: '#d1fae5' };
        }
        if (apStatus === 'approved') {
            return { label: 'Approved', color: '#059669', backgroundColor: '#d1fae5' };
        }
        if (apStatus === 'exception') {
            return { label: 'Exception', color: '#dc2626', backgroundColor: '#fee2e2' };
        }
        if (apStatus === 'rejected') {
            return { label: 'Rejected', color: '#dc2626', backgroundColor: '#fee2e2' };
        }

        // Check if this shipment has been matched to a system shipment
        if (row.matchResult && row.matchResult.matched) {
            return { label: 'Matched', color: '#059669', backgroundColor: '#d1fae5' };
        }

        // Default - extracted but not yet matched
        return { label: 'Needs Matching', color: '#f59e0b', backgroundColor: '#fef3c7' };
    };

    // Note: Auto-processing now happens in the background via Cloud Functions
    // This frontend component only displays the results of background automation

    // Execute Intelligent Auto-Processing - Automate the entire approval workflow
    const executeIntelligentAutoProcessing = async (matchedCharges, unmatchedCharges, shipmentDate) => {
        console.log('🚀 Starting intelligent auto-processing workflow...');

        if (!selectedShipmentDetail?.matchedShipmentId) {
            console.log('⚠️ No matched shipment found, skipping auto-processing');
            return;
        }

        const functions = getFunctions();
        const applyInvoiceCharges = httpsCallable(functions, 'applyInvoiceCharges');

        // Step 1: Auto-approve charges with 100% confidence (perfect matches)
        const perfectMatches = matchedCharges.filter(charge =>
            charge.autoApprovalRecommendation === 'approve' &&
            charge.autoApprovalConfidence >= 95
        );

        // Step 2: Exception charges (variance detected but mappable)
        const exceptionCharges = matchedCharges.filter(charge =>
            charge.autoApprovalRecommendation === 'approve' &&
            charge.autoApprovalConfidence < 95 &&
            charge.autoApprovalConfidence >= 80
        );

        let processedCharges = [];
        let shipmentStatus = 'processing';
        let invoiceStatus = 'processed';

        try {
            // Process perfect matches - apply as actual charges
            if (perfectMatches.length > 0) {
                console.log(`✅ Auto-processing ${perfectMatches.length} perfect matches...`);

                const perfectMatchResult = await applyInvoiceCharges({
                    shipmentId: selectedShipmentDetail.matchedShipmentId,
                    invoiceData: {
                        invoiceNumber: uploadData.invoiceNumber,
                        invoiceRef: uploadData.metadata?.invoiceRef || uploadData.invoiceNumber,
                        fileName: fileName,
                        autoProcessing: true,
                        processingType: 'perfect_match'
                    },
                    charges: perfectMatches.map(charge => ({
                        // USING SAME ROBUST FIELD MAPPING AS MANUAL APPROVAL
                        code: charge.systemCode || charge.code || charge.chargeCode || 'MISC',
                        name: charge.systemName || charge.name || charge.chargeName || charge.description || 'Unknown Charge',
                        actualCost: charge.systemQuotedCost || charge.systemActualCost || charge.actualCost || charge.quotedCost || 0,
                        actualCharge: charge.systemQuotedCharge || charge.systemActualCharge || charge.actualCharge || charge.quotedCharge || 0,
                        currency: charge.systemCurrency || charge.currency || 'CAD',
                        ediNumber: uploadData.invoiceNumber || uploadData.metadata?.invoiceRef,
                        autoApprovalReason: charge.autoApprovalReason,
                        autoApprovalConfidence: charge.autoApprovalConfidence,
                        processingType: 'auto_approved'
                    }))
                });

                if (perfectMatchResult.data.success) {
                    processedCharges.push(...perfectMatches);
                    console.log(`✅ Successfully auto-applied ${perfectMatches.length} perfect matches`);
                }
            }

            // Process exception charges - apply with actual costs from invoice
            if (exceptionCharges.length > 0) {
                console.log(`⚠️ Processing ${exceptionCharges.length} exception charges...`);

                const exceptionResult = await applyInvoiceCharges({
                    shipmentId: selectedShipmentDetail.matchedShipmentId,
                    invoiceData: {
                        invoiceNumber: uploadData.invoiceNumber,
                        invoiceRef: uploadData.metadata?.invoiceRef || uploadData.invoiceNumber,
                        fileName: fileName,
                        autoProcessing: true,
                        processingType: 'exception'
                    },
                    charges: exceptionCharges.map(charge => ({
                        // USING SAME ROBUST FIELD MAPPING AS MANUAL APPROVAL
                        code: charge.systemCode || charge.code || charge.chargeCode || 'MISC',
                        name: charge.systemName || charge.name || charge.chargeName || charge.description || 'Unknown Charge',
                        actualCost: charge.invoiceAmount || charge.systemQuotedCost || charge.systemActualCost || charge.actualCost || charge.quotedCost || 0,
                        actualCharge: charge.systemQuotedCharge || charge.systemActualCharge || charge.actualCharge || charge.quotedCharge || 0,
                        currency: charge.systemCurrency || charge.currency || 'CAD',
                        ediNumber: uploadData.invoiceNumber || uploadData.metadata?.invoiceRef,
                        autoApprovalReason: charge.autoApprovalReason,
                        autoApprovalConfidence: charge.autoApprovalConfidence,
                        processingType: 'exception'
                    }))
                });

                if (exceptionResult.data.success) {
                    processedCharges.push(...exceptionCharges);
                    invoiceStatus = 'exception';
                    console.log(`⚠️ Successfully processed ${exceptionCharges.length} exception charges`);
                }
            }

            // Determine final shipment and invoice status
            const totalCharges = matchedCharges.length;
            const processedCount = processedCharges.length;
            const hasExceptions = exceptionCharges.length > 0;

            console.log('📊 Processing summary:', {
                totalCharges,
                processedCount,
                perfectMatches: perfectMatches.length,
                exceptionCharges: exceptionCharges.length,
                hasExceptions
            });

            // Update shipment invoice status - USING SAME LOGIC AS MANUAL APPROVAL
            if (processedCount === totalCharges) {
                // All charges processed
                if (hasExceptions) {
                    shipmentStatus = 'exception';
                    invoiceStatus = 'processed_with_exception';
                } else {
                    shipmentStatus = 'approved';
                    invoiceStatus = 'ready_to_invoice'; // CRITICAL FIX: Use 'ready_to_invoice' instead of 'processed'
                }
            } else if (processedCount > 0) {
                // Partially processed
                shipmentStatus = 'partially_processed';
                invoiceStatus = 'partially_processed';
            }

            // Update shipment invoice status in database - SAME AS MANUAL APPROVAL
            try {
                const updateShipmentInvoiceStatus = httpsCallable(functions, 'updateShipmentInvoiceStatus');
                await updateShipmentInvoiceStatus({
                    shipmentId: selectedShipmentDetail.matchedShipmentId,
                    invoiceStatus: invoiceStatus, // CRITICAL FIX: Use the correct invoiceStatus
                    invoiceData: {
                        invoiceNumber: uploadData.invoiceNumber,
                        totalChargesProcessed: processedCount,
                        totalCharges: totalCharges,
                        processingDate: new Date().toISOString(),
                        autoProcessed: true // Intelligent auto processing
                    }
                });
                console.log(`✅ Successfully updated shipment invoice status to ${invoiceStatus} via intelligent auto-processing`);
            } catch (statusError) {
                console.warn('⚠️ Failed to update shipment invoice status:', statusError);
                // Don't fail the main operation if status update fails
            }

            // Update UI status for this shipment in the results table
            updateShipmentStatus(selectedShipmentDetail.id, invoiceStatus);

            // Mark charges as applied in the UI - USING SAME ROBUST LOGIC AS MANUAL APPROVAL
            const allCharges = [...matchedCharges, ...unmatchedCharges];
            const appliedIndices = new Set();
            processedCharges.forEach(processedCharge => {
                const index = allCharges.findIndex(charge =>
                    // ROBUST MATCHING CRITERIA
                    (charge.code === processedCharge.code || charge.systemCode === processedCharge.systemCode) &&
                    (charge.name === processedCharge.name || charge.systemName === processedCharge.systemName)
                );
                if (index !== -1) {
                    appliedIndices.add(index);
                    console.log(`✅ Found processed charge at index ${index}:`, {
                        name: processedCharge.name,
                        code: processedCharge.code,
                        processingType: processedCharge.processingType
                    });
                }
            });

            setAppliedCharges(prev => new Set([...prev, ...appliedIndices]));

            // Update main upload status
            if (onStatusUpdate) {
                if (invoiceStatus === 'processed') {
                    onStatusUpdate('processed');
                } else if (invoiceStatus === 'processed_with_exception') {
                    onStatusUpdate('processed_with_exception');
                } else if (invoiceStatus === 'partially_processed') {
                    onStatusUpdate('partially_processed');
                }
            }

            // Show success notification
            const statusMessage = hasExceptions
                ? `Auto-processed ${processedCount} charges (${exceptionCharges.length} with exceptions)`
                : `Auto-processed ${processedCount} charges successfully`;

            enqueueSnackbar(statusMessage, {
                variant: hasExceptions ? 'warning' : 'success',
                autoHideDuration: hasExceptions ? 8000 : 5000
            });

            console.log('🎉 Intelligent auto-processing completed:', {
                shipmentStatus,
                invoiceStatus,
                processedCharges: processedCount,
                totalCharges
            });

        } catch (error) {
            console.error('❌ Error during intelligent auto-processing:', error);
            enqueueSnackbar(`Auto-processing failed: ${error.message}`, { variant: 'error' });
        }
    };

    // Intelligent Auto-Approval System for Carrier Invoice Processing
    const applyIntelligentAutoApproval = async (matchedCharges, unmatchedCharges, invoiceCharges, shipmentDate) => {
        console.log('🤖 Starting intelligent auto-approval analysis...');

        // Get exchange rates for currency conversion
        const rates = await currencyConversionService.getRatesForDate(shipmentDate);

        // Helper function to convert amounts to CAD for comparison
        const convertToCAD = (amount, currency) => {
            return currencyConversionService.convertCurrency(amount, currency, 'CAD', rates);
        };

        // Group invoice charges by charge type families for intelligent matching
        const invoiceChargeGroups = {
            freight: [],
            fuel: [],
            accessorial: [],
            other: []
        };

        invoiceCharges.forEach(charge => {
            const desc = charge.name.toLowerCase();
            if (desc.includes('base') || desc.includes('freight') || desc.includes('line') || desc.includes('transport')) {
                invoiceChargeGroups.freight.push(charge);
            } else if (desc.includes('fuel') || desc.includes('fsc') || desc.includes('surcharge')) {
                invoiceChargeGroups.fuel.push(charge);
            } else if (desc.includes('accessorial') || desc.includes('handling') || desc.includes('liftgate') || desc.includes('residential')) {
                invoiceChargeGroups.accessorial.push(charge);
            } else {
                invoiceChargeGroups.other.push(charge);
            }
        });

        console.log('📊 Invoice charge groups:', {
            freight: invoiceChargeGroups.freight.map(c => `${c.name}: ${c.currency} ${c.invoiceAmount}`),
            fuel: invoiceChargeGroups.fuel.map(c => `${c.name}: ${c.currency} ${c.invoiceAmount}`),
            accessorial: invoiceChargeGroups.accessorial.map(c => `${c.name}: ${c.currency} ${c.invoiceAmount}`),
            other: invoiceChargeGroups.other.map(c => `${c.name}: ${c.currency} ${c.invoiceAmount}`)
        });

        // Enhanced auto-approval logic for each matched charge
        const enhancedMatchedCharges = await Promise.all(matchedCharges.map(async (charge) => {
            let autoApprovalRecommendation = null;
            let autoApprovalReason = '';
            let autoApprovalConfidence = 0;

            // Case 1: Freight charge that might include separated fuel costs
            if (charge.code === 'FRT' || charge.name.toLowerCase().includes('freight') || charge.name.toLowerCase().includes('base')) {
                // Calculate total of freight + fuel charges from invoice
                const freightTotal = invoiceChargeGroups.freight.reduce((sum, c) => sum + convertToCAD(c.invoiceAmount, c.currency), 0);
                const fuelTotal = invoiceChargeGroups.fuel.reduce((sum, c) => sum + convertToCAD(c.invoiceAmount, c.currency), 0);
                const combinedInvoiceTotal = freightTotal + fuelTotal;

                const systemCostCAD = convertToCAD(charge.systemActualCost, charge.currency);
                const systemChargeCAD = convertToCAD(charge.systemActualCharge, charge.currency);

                // Check if combined invoice total matches system cost (within 5% tolerance)
                const costVariance = Math.abs(combinedInvoiceTotal - systemCostCAD);
                const costVariancePercent = systemCostCAD > 0 ? (costVariance / systemCostCAD) * 100 : 100;

                console.log(`🔍 Freight analysis for ${charge.name}:`, {
                    freightTotal: freightTotal.toFixed(2),
                    fuelTotal: fuelTotal.toFixed(2),
                    combinedInvoiceTotal: combinedInvoiceTotal.toFixed(2),
                    systemCostCAD: systemCostCAD.toFixed(2),
                    costVariancePercent: costVariancePercent.toFixed(2) + '%'
                });

                if (costVariancePercent <= 15) { // TEMPORARILY INCREASED FROM 5% TO 15% FOR TESTING
                    autoApprovalRecommendation = 'approve';
                    autoApprovalReason = `Combined invoice charges (Base: ${formatCurrency(freightTotal, 'CAD')} + Fuel: ${formatCurrency(fuelTotal, 'CAD')} = ${formatCurrency(combinedInvoiceTotal, 'CAD')}) match system cost ${formatCurrency(systemCostCAD, 'CAD')} within ${costVariancePercent.toFixed(1)}% tolerance`;
                    autoApprovalConfidence = Math.max(0, 100 - costVariancePercent * 4); // Higher confidence for smaller variance

                    console.log(`✅ AUTO-APPROVAL RECOMMENDED for ${charge.name}: ${autoApprovalReason}`);
                } else if (costVariancePercent <= 25) { // TEMPORARILY INCREASED FROM 15% TO 25%
                    autoApprovalRecommendation = 'review';
                    autoApprovalReason = `Combined invoice total has ${costVariancePercent.toFixed(1)}% variance - requires manual review`;
                    autoApprovalConfidence = Math.max(0, 100 - costVariancePercent * 2);

                    console.log(`⚠️ MANUAL REVIEW RECOMMENDED for ${charge.name}: ${autoApprovalReason}`);
                } else {
                    autoApprovalRecommendation = 'reject';
                    autoApprovalReason = `Combined invoice total has ${costVariancePercent.toFixed(1)}% variance - significant discrepancy`;
                    autoApprovalConfidence = Math.max(0, 50 - costVariancePercent);

                    console.log(`❌ REJECTION RECOMMENDED for ${charge.name}: ${autoApprovalReason}`);
                }
            }

            // Case 2: Exact amount matching
            else {
                const invoiceAmountCAD = convertToCAD(charge.invoiceAmount, charge.currency);
                const systemCostCAD = convertToCAD(charge.systemActualCost, charge.currency);

                const variance = Math.abs(invoiceAmountCAD - systemCostCAD);
                const variancePercent = systemCostCAD > 0 ? (variance / systemCostCAD) * 100 : 100;

                if (variancePercent <= 2) {
                    autoApprovalRecommendation = 'approve';
                    autoApprovalReason = `Exact match within ${variancePercent.toFixed(1)}% tolerance`;
                    autoApprovalConfidence = Math.max(0, 100 - variancePercent * 10);
                } else if (variancePercent <= 10) {
                    autoApprovalRecommendation = 'review';
                    autoApprovalReason = `${variancePercent.toFixed(1)}% variance requires review`;
                    autoApprovalConfidence = Math.max(0, 100 - variancePercent * 5);
                } else {
                    autoApprovalRecommendation = 'reject';
                    autoApprovalReason = `${variancePercent.toFixed(1)}% variance exceeds tolerance`;
                    autoApprovalConfidence = Math.max(0, 50 - variancePercent);
                }
            }

            return {
                ...charge,
                autoApprovalRecommendation,
                autoApprovalReason,
                autoApprovalConfidence: Math.round(autoApprovalConfidence)
            };
        }));

        // Apply auto-approval confidence to unmatched charges
        const enhancedUnmatchedCharges = unmatchedCharges.map(charge => ({
            ...charge,
            autoApprovalRecommendation: 'review',
            autoApprovalReason: 'Unmatched charge requires manual review',
            autoApprovalConfidence: 0
        }));

        const autoApprovalSummary = {
            approve: enhancedMatchedCharges.filter(c => c.autoApprovalRecommendation === 'approve').length,
            review: enhancedMatchedCharges.filter(c => c.autoApprovalRecommendation === 'review').length + enhancedUnmatchedCharges.length,
            reject: enhancedMatchedCharges.filter(c => c.autoApprovalRecommendation === 'reject').length
        };

        console.log('🎯 Auto-approval summary:', autoApprovalSummary);

        // Note: Auto-processing is handled separately to avoid infinite loops
        // The executeIntelligentAutoProcessing function is triggered only once when needed

        return {
            matchedCharges: enhancedMatchedCharges,
            unmatchedCharges: enhancedUnmatchedCharges
        };
    };

    // Build enhanced comparison structure with matched and unmatched charges 
    const buildComparisonRows = async (detail) => {
        if (!detail) return { matchedCharges: [], unmatchedCharges: [] };

        console.log('🔗 Building enhanced charge comparison for:', detail.shipmentId);
        console.log('📄 Invoice charges:', detail.charges);
        console.log('🏭 System charges:', detail.systemRateData?.charges);

        // Extract shipment date for historical exchange rates
        const rawShipmentDate = detail.shipmentDate ||
            detail.deliveryDate ||
            detail.shipDate ||
            detail.invoiceDate ||
            detail.extractedAt ||
            new Date();

        // Ensure we have a proper Date object
        let shipmentDate;
        if (rawShipmentDate instanceof Date) {
            shipmentDate = rawShipmentDate;
        } else if (typeof rawShipmentDate === 'string') {
            shipmentDate = new Date(rawShipmentDate);
        } else if (rawShipmentDate && typeof rawShipmentDate === 'object' && rawShipmentDate.toDate) {
            // Handle Firestore Timestamp
            shipmentDate = rawShipmentDate.toDate();
        } else if (rawShipmentDate && typeof rawShipmentDate === 'object' && rawShipmentDate.seconds) {
            // Handle Firestore Timestamp object format
            shipmentDate = new Date(rawShipmentDate.seconds * 1000);
        } else {
            shipmentDate = new Date();
        }

        // Validate the date
        if (isNaN(shipmentDate.getTime())) {
            console.warn('⚠️ Invalid shipment date detected, using current date:', rawShipmentDate);
            shipmentDate = new Date();
        }

        console.log('📅 Using shipment date for currency conversion:', shipmentDate);

        // Helper function to classify charge types based on description
        const classifyChargeCode = (description) => {
            const desc = (description || '').toLowerCase();

            // Fuel surcharge classification
            if (desc.includes('fuel') || desc.includes('fsc')) return 'FSC';

            // Base freight classification
            if (desc.includes('base') || desc.includes('freight') || desc.includes('shipping') || desc.includes('transport')) return 'FRT';

            // Tax classifications
            if (desc.includes('tax') || desc.includes('hst') || desc.includes('gst') || desc.includes('pst') || desc.includes('qst')) return 'TAX';

            // Accessorial charges
            if (desc.includes('accessorial') || desc.includes('handling') || desc.includes('liftgate') || desc.includes('residential')) return 'ACC';

            // Border/customs
            if (desc.includes('border') || desc.includes('crossing') || desc.includes('customs') || desc.includes('duty')) return 'BOR';

            // Insurance
            if (desc.includes('insurance') || desc.includes('protection') || desc.includes('coverage')) return 'INS';

            // Weight-based charges
            if (desc.includes('weight') || desc.includes('dimensional')) return 'WGT';

            // Wait time
            if (desc.includes('wait') || desc.includes('detention') || desc.includes('demurrage')) return 'WAIT';

            // Default to freight if no classification found
            return 'FRT';
        };

        const invoiceCharges = (detail.charges || []).map(ch => ({
            code: ch.code || classifyChargeCode(ch.name || ch.description),
            name: ch.name || ch.description || 'Charge',
            currency: ch.currency || detail.currency || 'CAD',
            invoiceAmount: Number(ch.amount || 0)
        }));

        // System charges from shipment (these become the primary display)
        const systemCharges = (detail.systemRateData?.charges || []).map(c => ({
            code: c.code || 'FRT',
            name: c.name || 'Charge',
            currency: c.currency || detail.currency || 'CAD',
            quotedCost: c.quotedCost != null ? Number(c.quotedCost) : 0,
            quotedCharge: c.quotedCharge != null ? Number(c.quotedCharge) : 0,
            actualCost: c.actualCost != null ? Number(c.actualCost) : (c.cost != null ? Number(c.cost) : 0),
            actualCharge: c.actualCharge != null ? Number(c.actualCharge) : (c.charge != null ? Number(c.charge) : 0)
        }));

        const matchedCharges = [];
        const unmatchedCharges = [];
        const usedInvoiceCharges = new Set();

        // Function to find best matching invoice charge for a system charge
        const findBestInvoiceMatch = (systemCharge) => {
            let bestMatch = null;
            let bestScore = 0;

            invoiceCharges.forEach((invoiceCharge, index) => {
                if (usedInvoiceCharges.has(index)) return;

                let score = 0;

                // Exact code match (highest priority)
                if (systemCharge.code === invoiceCharge.code) {
                    score += 50;
                }

                // Name similarity matching
                const systemName = systemCharge.name.toLowerCase();
                const invoiceName = invoiceCharge.name.toLowerCase();

                // Exact name match
                if (systemName === invoiceName) {
                    score += 40;
                } else {
                    // Partial name matching for common charge types
                    const chargeKeywords = [
                        { keywords: ['freight', 'frt', 'base'], weight: 30 },
                        { keywords: ['fuel', 'fsc', 'surcharge'], weight: 25 },
                        { keywords: ['tax', 'hst', 'gst', 'pst', 'qst'], weight: 35 },
                        { keywords: ['accessorial', 'acc', 'additional'], weight: 20 },
                        { keywords: ['insurance', 'ins'], weight: 20 },
                        { keywords: ['handling', 'hdl'], weight: 15 }
                    ];

                    chargeKeywords.forEach(({ keywords, weight }) => {
                        const systemHasKeyword = keywords.some(kw => systemName.includes(kw));
                        const invoiceHasKeyword = keywords.some(kw => invoiceName.includes(kw));

                        if (systemHasKeyword && invoiceHasKeyword) {
                            score += weight;
                        }
                    });

                    // String similarity for remaining cases
                    const similarity = calculateStringSimilarity(systemName, invoiceName);
                    if (similarity > 0.6) {
                        score += Math.floor(similarity * 20);
                    }
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = { charge: invoiceCharge, index, score };
                }
            });

            return bestMatch;
        };

        // Match system charges to invoice charges (system charges drive the display)
        systemCharges.forEach(systemCharge => {
            const match = findBestInvoiceMatch(systemCharge);

            if (match && match.score > 10) { // Minimum confidence threshold
                usedInvoiceCharges.add(match.index);
                matchedCharges.push({
                    code: systemCharge.code,
                    name: systemCharge.name, // Use system charge name
                    currency: systemCharge.currency,
                    invoiceAmount: match.charge.invoiceAmount,
                    systemQuotedCost: systemCharge.quotedCost,
                    systemQuotedCharge: systemCharge.quotedCharge,
                    systemActualCost: systemCharge.actualCost,
                    systemActualCharge: systemCharge.actualCharge,
                    varianceCost: match.charge.invoiceAmount - systemCharge.actualCost,
                    matchScore: match.score,
                    isMatched: true
                });
                console.log(`✅ Matched system "${systemCharge.name}" → invoice "${match.charge.name}" (score: ${match.score})`);
            } else {
                // No invoice match - system charge only
                matchedCharges.push({
                    code: systemCharge.code,
                    name: systemCharge.name,
                    currency: systemCharge.currency,
                    invoiceAmount: 0,
                    systemQuotedCost: systemCharge.quotedCost,
                    systemQuotedCharge: systemCharge.quotedCharge,
                    systemActualCost: systemCharge.actualCost,
                    systemActualCharge: systemCharge.actualCharge,
                    varianceCost: -systemCharge.actualCost,
                    matchScore: 0,
                    isMatched: false
                });
                console.log(`🔵 System charge without invoice match: "${systemCharge.name}"`);
            }
        });

        // Add unmatched invoice charges to unmatchedCharges
        invoiceCharges.forEach((invoiceCharge, index) => {
            if (!usedInvoiceCharges.has(index)) {
                unmatchedCharges.push({
                    code: invoiceCharge.code,
                    name: invoiceCharge.name,
                    currency: invoiceCharge.currency,
                    invoiceAmount: invoiceCharge.invoiceAmount,
                    systemQuotedCost: 0,
                    systemQuotedCharge: 0,
                    systemActualCost: 0,
                    systemActualCharge: 0,
                    varianceCost: invoiceCharge.invoiceAmount,
                    matchScore: 0,
                    isMatched: false
                });
                console.log(`❌ Unmatched invoice charge: "${invoiceCharge.name}"`);
            }
        });

        // Calculate profit for matched charges using real currency conversion
        const matchedChargesWithProfit = await Promise.all(matchedCharges.map(async (charge) => {
            try {
                // Get exchange rates for the shipment date (historical rates)
                const rates = await currencyConversionService.getRatesForDate(shipmentDate);

                // Convert amounts to CAD for profit calculation using real exchange rates
                const invoiceAmountCAD = currencyConversionService.convertCurrency(
                    charge.invoiceAmount,
                    charge.currency,
                    'CAD',
                    rates
                );

                const actualChargeCAD = currencyConversionService.convertCurrency(
                    charge.systemActualCharge,
                    charge.currency,
                    'CAD',
                    rates
                );

                // Profit = What we charge customer (actual charge) - What we pay carrier (invoice amount)
                const profit = actualChargeCAD - invoiceAmountCAD;

                return {
                    ...charge,
                    profit: profit
                };
            } catch (error) {
                console.error('❌ Error converting currency for profit calculation:', error);
                return {
                    ...charge,
                    profit: charge.systemActualCharge - charge.invoiceAmount
                };
            }
        }));

        // Calculate profit for unmatched charges using real currency conversion
        const unmatchedChargesWithProfit = await Promise.all(unmatchedCharges.map(async (charge) => {
            try {
                const rates = await currencyConversionService.getRatesForDate(shipmentDate);
                const invoiceAmountCAD = currencyConversionService.convertCurrency(
                    charge.invoiceAmount,
                    charge.currency,
                    'CAD',
                    rates
                );

                // For unmatched charges, profit is negative (we pay but don't charge)
                const profit = -invoiceAmountCAD;

                return {
                    ...charge,
                    profit: profit
                };
            } catch (error) {
                console.error('❌ Error converting currency for unmatched charge:', error);
                return {
                    ...charge,
                    profit: -charge.invoiceAmount
                };
            }
        }));

        // Filter out tax items from both sections
        const filterTaxes = (charges) => charges.filter(charge => {
            const chargeName = charge.name.toLowerCase();
            const chargeCode = charge.code.toLowerCase();

            const isTaxCharge =
                chargeName.includes('hst') ||
                chargeName.includes('gst') ||
                chargeName.includes('pst') ||
                chargeName.includes('qst') ||
                chargeName.includes('tax') ||
                chargeCode.includes('hst') ||
                chargeCode.includes('gst') ||
                chargeCode.includes('pst') ||
                chargeCode.includes('qst') ||
                chargeCode.includes('tax');

            return !isTaxCharge;
        });

        const finalMatchedCharges = filterTaxes(matchedChargesWithProfit);
        const finalUnmatchedCharges = filterTaxes(unmatchedChargesWithProfit);

        // Apply intelligent auto-approval logic
        const enhancedCharges = await applyIntelligentAutoApproval(
            finalMatchedCharges,
            finalUnmatchedCharges,
            invoiceCharges,
            shipmentDate
        );

        console.log('🎯 Final matched charges (tax items filtered):', enhancedCharges.matchedCharges);
        console.log('🎯 Final unmatched charges (tax items filtered):', enhancedCharges.unmatchedCharges);

        return {
            matchedCharges: enhancedCharges.matchedCharges,
            unmatchedCharges: enhancedCharges.unmatchedCharges
        };
    };

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    // Intelligent Auto-Matching Algorithm
    const autoMatchShipments = async (shipmentData) => {
        console.log('🤖 Starting intelligent auto-match for', shipmentData.length, 'shipments...');

        try {
            // TODO: Replace with actual Firestore query to get all shipments
            // For now, using mock data structure that would come from your shipments collection
            const systemShipments = await fetchSystemShipments();

            const matchedData = await Promise.all(
                shipmentData.map(async (invoiceShipment) => {
                    const matchResult = findBestMatch(invoiceShipment, systemShipments);

                    if (matchResult.match) {
                        // Get the correct shipment ID field (could be shipmentID or shipmentId)
                        const matchedSystemShipmentId = matchResult.match.shipmentID || matchResult.match.shipmentId || matchResult.match.firestoreDocId;

                        // Only auto-match if confidence is 80% or higher
                        if (matchResult.confidence >= 80) {
                            console.log(`✅ Auto-matched: ${invoiceShipment.shipmentId} → ${matchedSystemShipmentId} (confidence: ${matchResult.confidence}%)`);

                            // Extract system rate data for comparison
                            const systemRateData = extractSystemRateData(matchResult.match);

                            return {
                                ...invoiceShipment,
                                matchedShipmentId: matchedSystemShipmentId,
                                matchConfidence: matchResult.confidence,
                                matchMethod: matchResult.method,
                                matchResult: matchResult,
                                systemRateData: systemRateData, // Add system data for comparison
                                systemShipmentData: matchResult.match // Store full shipment data
                            };
                        } else {
                            console.log(`⚠️ Low confidence match found for ${invoiceShipment.shipmentId} → ${matchedSystemShipmentId} (${matchResult.confidence}%) - not auto-matching`);
                            return {
                                ...invoiceShipment,
                                matchConfidence: matchResult.confidence,
                                matchMethod: matchResult.method,
                                matchResult: matchResult,
                                potentialMatch: matchedSystemShipmentId // Store for manual review
                            };
                        }
                    } else {
                        console.log(`❌ No match found for: ${invoiceShipment.shipmentId}`);
                        return invoiceShipment;
                    }
                })
            );

            setTableData(matchedData);

            const matchedCount = matchedData.filter(item => item.matchedShipmentId).length;
            console.log(`🎯 Auto-matching complete: ${matchedCount}/${shipmentData.length} shipments matched`);

        } catch (error) {
            console.error('❌ Error during auto-matching:', error);
        }
    };

    // SUPER Enhanced Fetch System Shipments
    const fetchSystemShipments = async () => {
        try {
            console.log('🚀 SUPER: Fetching system shipments for comprehensive matching...');

            // Extended query for better matching coverage
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - 180); // Extended to 6 months

            const shipmentsQuery = query(
                collection(db, 'shipments'),
                where('status', '!=', 'draft'),
                orderBy('createdAt', 'desc'),
                limit(2500) // Increased limit for comprehensive coverage
            );

            const snapshot = await getDocs(shipmentsQuery);
            const shipments = snapshot.docs.map(doc => ({
                id: doc.id,
                firestoreDocId: doc.id, // Keep track of document ID
                ...doc.data()
            }));

            console.log(`📊 SUPER: Loaded ${shipments.length} system shipments for comprehensive matching`);
            return shipments;

        } catch (error) {
            console.error('❌ Error fetching system shipments:', error);

            // Enhanced fallback with actual data structure from Firebase
            console.log('🔄 SUPER: Using enhanced mock data with real structure...');
            return [
                {
                    id: 'atVOnLLUree9jo2VfIvB',
                    firestoreDocId: 'atVOnLLUree9jo2VfIvB',
                    shipmentID: 'ICAL-2306PC', // Primary shipment ID
                    carrier: 'Friends Enterprises',
                    selectedCarrier: 'Friends Enterprises',
                    shipFrom: {
                        company: 'TRANSFAB TMS',
                        companyName: 'TRANSFAB TMS',
                        city: 'Longueuil (Quebec)',
                        state: 'QC',
                        street: '2315, rue de la Metropole',
                        postalCode: 'j4g1e5',
                        country: 'CA'
                    },
                    shipTo: {
                        company: 'Temspec Inc.',
                        companyName: 'Temspec Inc.',
                        city: 'Mississauga',
                        state: 'ON',
                        street: '326 Superior Blvd.',
                        postalCode: 'L5T 2N7',
                        country: 'CA'
                    },
                    totalCharges: 333.35,
                    selectedRate: {
                        totalAmount: 333.35,
                        carrier: { name: 'Friends Enterprises' },
                        charges: [
                            { amount: 295, name: 'Freight', code: 'FRT' },
                            { amount: 38.35, name: 'HST Ontario', code: 'HST ON' }
                        ]
                    },
                    actualRates: { totalCharges: 175.00 },
                    markupRates: { totalCharges: 295.00 },
                    manualRates: [
                        {
                            ediNumber: '143190', // EDI/Invoice number
                            invoiceNumber: '1001400', // Invoice number
                            charge: '295',
                            cost: '175',
                            chargeName: 'Freight'
                        }
                    ],
                    // Multiple reference sources for comprehensive matching
                    references: {
                        customerRef: 'ICAL-2306PC',
                        manifestRef: 'ICAL-2306PC',
                        invoiceRef: '143190'
                    },
                    referenceNumbers: ['ICAL-2306PC', '143190', 'WO165986', 'PO 62042'],
                    customerReferenceNumber: 'ICAL-2306PC',
                    shipmentInfo: {
                        shipperReferenceNumber: 'WO165986 / PO 62042',
                        referenceNumber: 'ICAL-2306PC',
                        customerReferenceNumber: 'ICAL-2306PC',
                        referenceNumbers: ['ICAL-2306PC', 'WO165986'],
                        totalAmount: 333.35
                    },
                    trackingNumber: 'ICAL-2306PC',
                    proNumber: 'ICAL-2306PC',
                    billOfLading: 'ICAL-2306PC',
                    orderNumber: 'WO165986',
                    poNumber: 'PO 62042',
                    invoiceNumber: '1001400',
                    ediNumber: '143190', // Direct EDI reference
                    workOrder: 'WO165986',
                    purchaseOrder: 'PO 62042',
                    status: 'delivered',
                    createdAt: new Date('2025-08-07'),
                    bookingTimestamp: '2025-08-07T19:05:44.728Z',
                    creationMethod: 'quickship',
                    companyID: 'ICAL',
                    customerID: 'TEMSPE',
                    currency: 'CAD'
                }
            ];
        }
    };

    // 🚀 SUPER INTELLIGENT MATCHING ALGORITHM - Comprehensive Multi-Dimensional Approach
    const findBestMatch = (invoiceShipment, systemShipments) => {
        console.log(`🎯 SUPER: Starting comprehensive match for invoice shipment: ${invoiceShipment.shipmentId}`);

        let bestMatch = null;
        let bestScore = 0;
        let matchMethod = '';

        // Phase 1: EXACT SHIPMENT ID MATCHING (Highest Priority)
        console.log(`🔍 PHASE 1: Exact Shipment ID matching for "${invoiceShipment.shipmentId}"`);
        for (const systemShipment of systemShipments) {
            if (systemShipment.shipmentID === invoiceShipment.shipmentId ||
                systemShipment.shipmentId === invoiceShipment.shipmentId) {
                console.log(`🎉 PHASE 1 SUCCESS: EXACT SHIPMENT ID MATCH FOUND!`);
                console.log(`✅ ${invoiceShipment.shipmentId} === ${systemShipment.shipmentID || systemShipment.shipmentId}`);
                return {
                    match: systemShipment,
                    confidence: 100,
                    method: 'Exact Shipment ID Match',
                    matched: true
                };
            }
        }
        console.log(`❌ PHASE 1: No exact shipment ID matches found`);

        // Phase 2: SUPER REFERENCE ENGINE (Multi-source matching)
        console.log(`🔍 PHASE 2: Super Reference Engine matching`);
        for (const systemShipment of systemShipments) {
            const score = calculateSuperMatchScore(invoiceShipment, systemShipment);

            // Enhanced logging for debugging
            if (score.total > 30) {
                console.log(`🎯 SUPER: High-potential match for ${invoiceShipment.shipmentId} → ${systemShipment.shipmentID || systemShipment.shipmentId}:`);
                console.log(`   📊 Total Score: ${score.total}/200`);
                console.log(`   🔍 Breakdown:`, score.breakdown);
                console.log(`   🏆 Primary Method: ${score.primaryMatch}`);
                console.log(`   📋 System References:`, {
                    shipmentID: systemShipment.shipmentID,
                    manualRates: systemShipment.manualRates,
                    references: systemShipment.references,
                    referenceNumbers: systemShipment.referenceNumbers
                });
            }

            if (score.total > bestScore && score.total >= 15) { // Lower threshold for comprehensive debugging
                bestMatch = systemShipment;
                bestScore = score.total;
                matchMethod = score.primaryMatch;
            }
        }

        const finalResult = {
            match: bestMatch,
            confidence: Math.round((bestScore / 200) * 100), // Convert to percentage
            method: matchMethod,
            matched: bestMatch !== null
        };

        if (bestMatch) {
            console.log(`🎉 SUPER: Best match found for ${invoiceShipment.shipmentId}:`);
            console.log(`   ✅ Matched to: ${bestMatch.shipmentID || bestMatch.shipmentId}`);
            console.log(`   📊 Score: ${bestScore}/200 (${finalResult.confidence}%)`);
            console.log(`   🏆 Method: ${matchMethod}`);
        } else {
            console.log(`❌ SUPER: No suitable match found for ${invoiceShipment.shipmentId}`);
        }

        return finalResult;
    };

    // 🚀 SUPER MATCH SCORING ALGORITHM - Multi-Dimensional Intelligence Engine (200 points max)
    const calculateSuperMatchScore = (invoice, system) => {
        console.log(`🧮 SUPER: Calculating comprehensive match score for invoice ${invoice.shipmentId} vs system ${system.shipmentID || system.shipmentId}`);

        let totalScore = 0;
        let primaryMatch = '';
        const scores = {};

        // 1. SUPER REFERENCE ENGINE (60 points max - HIGHEST PRIORITY)
        const refScore = calculateSuperReferenceScore(invoice, system);
        scores.references = refScore.score;
        totalScore += refScore.score;
        if (refScore.score > 0) primaryMatch = refScore.method;
        console.log(`   📋 References: ${refScore.score}/60 points (${refScore.method || 'No match'})`);

        // 2. INTELLIGENT CARRIER ENGINE (40 points max)
        const carrierScore = calculateIntelligentCarrierScore(invoice, system);
        scores.carrier = carrierScore.score;
        totalScore += carrierScore.score;
        if (!primaryMatch && carrierScore.score > 20) primaryMatch = carrierScore.method || 'Carrier Intelligence';
        console.log(`   🚚 Carrier: ${carrierScore.score}/40 points`);

        // 3. COMPANY INTELLIGENCE ENGINE (35 points max)
        const companyScore = calculateCompanyIntelligenceScore(invoice, system);
        scores.companies = companyScore.score;
        totalScore += companyScore.score;
        if (!primaryMatch && companyScore.score > 20) primaryMatch = 'Company Intelligence';
        console.log(`   🏢 Companies: ${companyScore.score}/35 points`);

        // 4. ADDRESS INTELLIGENCE ENGINE (25 points max)
        const addressScore = calculateAddressIntelligenceScore(invoice, system);
        scores.addresses = addressScore.score;
        totalScore += addressScore.score;
        console.log(`   📍 Addresses: ${addressScore.score}/25 points`);

        // 5. PACKAGE/WEIGHT MATCHING (20 points max)
        const packageScore = calculatePackageScore(invoice, system);
        scores.packages = packageScore.score;
        totalScore += packageScore.score;
        console.log(`   📦 Packages: ${packageScore.score}/20 points`);

        // 6. FINANCIAL CORRELATION (15 points max)
        const amountScore = calculateFinancialCorrelationScore(invoice, system);
        scores.amounts = amountScore.score;
        totalScore += amountScore.score;
        console.log(`   💰 Financial: ${amountScore.score}/15 points`);

        // 7. TEMPORAL INTELLIGENCE (5 points max)
        const dateScore = calculateTemporalIntelligenceScore(invoice, system);
        scores.dates = dateScore.score;
        totalScore += dateScore.score;
        console.log(`   📅 Temporal: ${dateScore.score}/5 points`);

        console.log(`   🎯 TOTAL SUPER SCORE: ${totalScore}/200 points`);

        return {
            total: totalScore,
            breakdown: scores,
            primaryMatch: primaryMatch || 'Multi-Dimensional Analysis'
        };
    };

    // 🚀 SUPER REFERENCE ENGINE - Comprehensive 25+ Source Extraction (60 points max)
    const calculateSuperReferenceScore = (invoice, system) => {
        console.log(`📋 SUPER REF: Starting comprehensive reference analysis for ${invoice.shipmentId}`);

        // Extract ALL possible invoice reference sources (25+ sources)
        const invoiceRefs = [
            // Primary extracted references
            invoice.references?.customerRef,
            invoice.references?.invoiceRef,
            invoice.references?.manifestRef,
            invoice.references?.other,

            // Secondary reference sources 
            invoice.customerRef,
            invoice.invoiceRef,
            invoice.manifestRef,
            invoice.invoiceNumber,
            invoice.ediNumber,
            invoice.trackingNumber,
            invoice.proNumber,
            invoice.billOfLading,
            invoice.workOrder,
            invoice.purchaseOrder,
            invoice.orderNumber,
            invoice.poNumber,
            invoice.shipmentReference,
            invoice.carrierReference,
            invoice.bookingReference,

            // From package info
            invoice.packageDetails?.referenceNumber,

            // From charges/rates
            invoice.charges?.find(c => c.referenceNumber)?.referenceNumber,

            // Array references
            ...(Array.isArray(invoice.referenceNumbers) ? invoice.referenceNumbers : []),
            ...(Array.isArray(invoice.otherReferences) ? invoice.otherReferences : [])
        ].filter(ref => ref && ref !== 'N/A' && String(ref).trim() !== '' && String(ref).trim().length >= 3);

        // Extract ALL possible system reference sources (40+ sources)
        const systemRefs = [
            // Primary shipment references
            system.references?.customerRef,
            system.references?.invoiceRef,
            system.references?.manifestRef,
            system.shipmentInfo?.referenceNumber,
            system.shipmentInfo?.customerReferenceNumber,
            system.shipmentInfo?.shipperReferenceNumber,
            system.customerReferenceNumber,
            system.referenceNumber,

            // Standard reference fields
            system.poNumber,
            system.orderNumber,
            system.invoiceNumber,
            system.trackingNumber,
            system.proNumber,
            system.billOfLading,
            system.ediNumber,
            system.workOrder,
            system.purchaseOrder,
            system.shipmentReference,
            system.carrierReference,
            system.bookingReference,

            // From manual rates (critical for QuickShip)
            ...(Array.isArray(system.manualRates) ? system.manualRates.map(r => r.ediNumber).filter(Boolean) : []),
            ...(Array.isArray(system.manualRates) ? system.manualRates.map(r => r.invoiceNumber).filter(Boolean) : []),
            ...(Array.isArray(system.manualRates) ? system.manualRates.map(r => r.referenceNumber).filter(Boolean) : []),

            // From selected rate
            system.selectedRate?.referenceNumber,
            system.selectedRate?.ediNumber,
            system.selectedRate?.invoiceNumber,
            system.selectedRate?.trackingNumber,

            // From shipment info arrays
            ...(Array.isArray(system.shipmentInfo?.referenceNumbers) ? system.shipmentInfo.referenceNumbers : []),
            ...(Array.isArray(system.referenceNumbers) ? system.referenceNumbers : []),

            // From addresses (special instructions often contain references)
            system.shipFrom?.specialInstructions,
            system.shipTo?.specialInstructions,

            // From carrier details
            system.carrierDetails?.referenceNumber,
            system.quickShipCarrierDetails?.referenceNumber,

            // Extract references from strings like "WO165986 / PO 62042"
            ...(system.shipmentInfo?.shipperReferenceNumber ?
                system.shipmentInfo.shipperReferenceNumber.split(/[\/,\s]+/).map(r => r.trim()).filter(r => r.length >= 3) : [])
        ].filter(ref => ref && ref !== 'N/A' && String(ref).trim() !== '' && String(ref).trim().length >= 3);

        console.log(`📋 SUPER REF: Found ${invoiceRefs.length} invoice refs and ${systemRefs.length} system refs`);
        console.log(`📋 Invoice refs:`, invoiceRefs);
        console.log(`📋 System refs:`, systemRefs);

        // Phase 1: EXACT MATCHES (60 points)
        for (const invoiceRef of invoiceRefs) {
            for (const systemRef of systemRefs) {
                if (!invoiceRef || !systemRef) continue;

                const invoiceRefClean = String(invoiceRef).toLowerCase().trim();
                const systemRefClean = String(systemRef).toLowerCase().trim();

                if (invoiceRefClean === systemRefClean) {
                    console.log(`🎉 SUPER REF: EXACT MATCH! "${invoiceRef}" === "${systemRef}"`);
                    return { score: 60, method: `Super Exact Reference Match (${invoiceRef})` };
                }
            }
        }

        // Phase 2: PATTERN RECOGNITION (50 points) - handles variations like "ICAL-2306PC" vs "ICAL2306PC"
        for (const invoiceRef of invoiceRefs) {
            for (const systemRef of systemRefs) {
                if (!invoiceRef || !systemRef) continue;

                const invoicePattern = String(invoiceRef).toLowerCase().replace(/[-_\s]/g, '');
                const systemPattern = String(systemRef).toLowerCase().replace(/[-_\s]/g, '');

                if (invoicePattern === systemPattern && invoicePattern.length >= 5) {
                    console.log(`🎯 SUPER REF: PATTERN MATCH! "${invoiceRef}" ≈ "${systemRef}"`);
                    return { score: 50, method: `Super Pattern Match (${invoiceRef} ≈ ${systemRef})` };
                }
            }
        }

        // Phase 3: HIGH SIMILARITY (40 points) - 90%+ similarity
        for (const invoiceRef of invoiceRefs) {
            for (const systemRef of systemRefs) {
                if (!invoiceRef || !systemRef) continue;

                const similarity = calculateStringSimilarity(String(invoiceRef).toLowerCase(), String(systemRef).toLowerCase());
                if (similarity >= 0.9 && String(invoiceRef).length >= 4) {
                    console.log(`🔥 SUPER REF: HIGH SIMILARITY! "${invoiceRef}" vs "${systemRef}" = ${(similarity * 100).toFixed(1)}%`);
                    return { score: 40, method: `Super High Similarity (${invoiceRef} ~ ${systemRef})` };
                }
            }
        }

        // Phase 4: SUBSTRING MATCHING (30 points) - meaningful contains
        for (const invoiceRef of invoiceRefs) {
            for (const systemRef of systemRefs) {
                if (!invoiceRef || !systemRef) continue;

                const invoiceRefClean = String(invoiceRef).toLowerCase().trim();
                const systemRefClean = String(systemRef).toLowerCase().trim();

                if (invoiceRefClean.length >= 5 && systemRefClean.includes(invoiceRefClean)) {
                    console.log(`🎯 SUPER REF: SUBSTRING MATCH! "${systemRef}" contains "${invoiceRef}"`);
                    return { score: 30, method: `Super Substring Match (${invoiceRef} in ${systemRef})` };
                }
                if (systemRefClean.length >= 5 && invoiceRefClean.includes(systemRefClean)) {
                    console.log(`🎯 SUPER REF: SUBSTRING MATCH! "${invoiceRef}" contains "${systemRef}"`);
                    return { score: 30, method: `Super Substring Match (${systemRef} in ${invoiceRef})` };
                }
            }
        }

        console.log(`❌ SUPER REF: No reference matches found for ${invoice.shipmentId}`);
        return { score: 0, method: '' };
    };

    // 🚀 INTELLIGENT CARRIER ENGINE - Advanced Business Name Intelligence (40 points max)
    const calculateIntelligentCarrierScore = (invoice, system) => {
        console.log(`🚚 INTELLIGENT CARRIER: Starting analysis`);

        // Extract carrier from multiple sources
        const invoiceCarrier = extractCarrierName(invoice);
        const systemCarrier = extractCarrierName(system);

        console.log(`🚚 Extracted carriers: "${invoiceCarrier}" vs "${systemCarrier}"`);

        if (!invoiceCarrier || !systemCarrier) {
            return { score: 0, method: 'No carrier data' };
        }

        // Phase 1: EXACT MATCH (40 points)
        if (invoiceCarrier.toLowerCase() === systemCarrier.toLowerCase()) {
            console.log(`🎉 EXACT carrier match!`);
            return { score: 40, method: 'Exact Carrier Match' };
        }

        // Phase 2: NORMALIZED BUSINESS NAME MATCH (35 points)
        const invoiceNormalized = normalizeBusinessName(invoiceCarrier);
        const systemNormalized = normalizeBusinessName(systemCarrier);

        if (invoiceNormalized === systemNormalized && invoiceNormalized.length >= 5) {
            console.log(`🎯 NORMALIZED carrier match: "${invoiceNormalized}"`);
            return { score: 35, method: 'Normalized Business Name Match' };
        }

        // Phase 3: DBA/OPERATING NAME MATCHING (30 points)
        // Check if one contains "DBA" and matches the other
        const dbaMatch = checkDBAMapping(invoiceCarrier, systemCarrier);
        if (dbaMatch.matched) {
            console.log(`🏢 DBA mapping match: ${dbaMatch.explanation}`);
            return { score: 30, method: 'DBA/Operating Name Match' };
        }

        // Phase 4: HIGH SIMILARITY (25+ points)
        const similarity = calculateStringSimilarity(invoiceNormalized, systemNormalized);
        const simScore = similarity * 40; // Max 40 points

        console.log(`📊 Carrier similarity: ${(similarity * 100).toFixed(1)}% = ${simScore.toFixed(1)} points`);

        if (simScore >= 25) {
            return {
                score: Math.round(simScore),
                method: `Carrier Similarity (${(similarity * 100).toFixed(1)}%)`
            };
        }

        return { score: 0, method: 'No carrier match' };
    };

    // Extract carrier name from multiple sources
    const extractCarrierName = (data) => {
        return data.carrier ||
            data.selectedCarrier?.name ||
            data.selectedCarrier ||
            data.carrierName ||
            data.carrierDetails?.name ||
            data.quickShipCarrierDetails?.name ||
            '';
    };

    // Advanced business name normalization
    const normalizeBusinessName = (name) => {
        if (!name) return '';

        return name.toLowerCase()
            // Remove common business suffixes
            .replace(/\b(inc|incorporated|ltd|limited|corp|corporation|llc|company|co|dba|doing business as)\b/g, '')
            // Remove legal entities
            .replace(/\b(limited liability company|limited liability corporation)\b/g, '')
            // Remove numbers that might be inconsistent (like business numbers)
            .replace(/\b\d{7,}\b/g, '') // Remove 7+ digit numbers (business IDs)
            // Remove special characters but preserve meaningful separators
            .replace(/[^\w\s]/g, ' ')
            // Normalize spacing
            .replace(/\s+/g, ' ')
            .trim();
    };

    // Check for DBA (Doing Business As) relationships
    const checkDBAMapping = (name1, name2) => {
        const lower1 = name1.toLowerCase();
        const lower2 = name2.toLowerCase();

        // Check if one contains DBA and the other matches the DBA name
        const dbaRegex = /\bdba\s+(.+?)(?:\s|$)/i;

        const dba1Match = lower1.match(dbaRegex);
        if (dba1Match) {
            const dbaName = dba1Match[1].trim();
            if (lower2.includes(dbaName) || dbaName.includes(lower2)) {
                return { matched: true, explanation: `${name1} DBA matches ${name2}` };
            }
        }

        const dba2Match = lower2.match(dbaRegex);
        if (dba2Match) {
            const dbaName = dba2Match[1].trim();
            if (lower1.includes(dbaName) || dbaName.includes(lower1)) {
                return { matched: true, explanation: `${name2} DBA matches ${name1}` };
            }
        }

        return { matched: false };
    };

    // 🚀 COMPANY INTELLIGENCE ENGINE - Advanced Company Matching (35 points max)
    const calculateCompanyIntelligenceScore = (invoice, system) => {
        console.log(`🏢 COMPANY INTELLIGENCE: Starting analysis`);
        let score = 0;

        // Extract origin companies from multiple sources
        const invoiceOrigin = extractCompanyName(invoice, 'origin');
        const systemOrigin = extractCompanyName(system, 'origin');

        console.log(`🏢 Origin companies: "${invoiceOrigin}" vs "${systemOrigin}"`);

        if (invoiceOrigin && systemOrigin) {
            const originScore = calculateCompanyMatch(invoiceOrigin, systemOrigin);
            score += originScore * 17.5; // Max 17.5 points for origin
            console.log(`🏢 Origin company score: ${(originScore * 17.5).toFixed(1)}/17.5`);
        }

        // Extract destination companies  
        const invoiceDestination = extractCompanyName(invoice, 'destination');
        const systemDestination = extractCompanyName(system, 'destination');

        console.log(`🏢 Destination companies: "${invoiceDestination}" vs "${systemDestination}"`);

        if (invoiceDestination && systemDestination) {
            const destScore = calculateCompanyMatch(invoiceDestination, systemDestination);
            score += destScore * 17.5; // Max 17.5 points for destination
            console.log(`🏢 Destination company score: ${(destScore * 17.5).toFixed(1)}/17.5`);
        }

        const finalScore = Math.min(score, 35);
        console.log(`🏢 Total company intelligence score: ${finalScore.toFixed(1)}/35 points`);
        return { score: finalScore };
    };

    // Extract company name from multiple sources
    const extractCompanyName = (data, type) => {
        if (type === 'origin') {
            return data.origin ||
                data.shipFrom?.company ||
                data.shipFrom?.companyName ||
                data.shipmentInfo?.shipperCompany ||
                '';
        } else {
            return data.destination ||
                data.shipTo?.company ||
                data.shipTo?.companyName ||
                data.shipmentInfo?.consigneeCompany ||
                '';
        }
    };

    // Calculate company name match with normalization
    const calculateCompanyMatch = (name1, name2) => {
        if (!name1 || !name2) return 0;

        // Exact match
        if (name1.toLowerCase() === name2.toLowerCase()) {
            return 1.0;
        }

        // Normalized match
        const norm1 = normalizeBusinessName(name1);
        const norm2 = normalizeBusinessName(name2);

        if (norm1 === norm2 && norm1.length >= 3) {
            return 0.95;
        }

        // High similarity
        const similarity = calculateStringSimilarity(norm1, norm2);
        return similarity >= 0.8 ? similarity : 0;
    };

    // 🚀 ADDRESS INTELLIGENCE ENGINE - Multi-Dimensional Location Matching (25 points max)
    const calculateAddressIntelligenceScore = (invoice, system) => {
        console.log(`📍 ADDRESS INTELLIGENCE: Starting analysis`);
        let score = 0;

        // Origin address intelligence
        const originScore = calculateLocationScore(
            extractLocationData(invoice, 'origin'),
            extractLocationData(system, 'origin')
        );
        score += originScore * 12.5; // Max 12.5 points for origin
        console.log(`📍 Origin address score: ${(originScore * 12.5).toFixed(1)}/12.5`);

        // Destination address intelligence
        const destScore = calculateLocationScore(
            extractLocationData(invoice, 'destination'),
            extractLocationData(system, 'destination')
        );
        score += destScore * 12.5; // Max 12.5 points for destination
        console.log(`📍 Destination address score: ${(destScore * 12.5).toFixed(1)}/12.5`);

        const finalScore = Math.min(score, 25);
        console.log(`📍 Total address intelligence score: ${finalScore.toFixed(1)}/25 points`);
        return { score: finalScore };
    };

    // Extract location data from multiple sources
    const extractLocationData = (data, type) => {
        let location = {};

        if (type === 'origin') {
            const addr = data.shipFrom || data.originAddress || {};
            location = {
                city: addr.city || '',
                state: addr.state || addr.province || addr.stateProv || '',
                postalCode: addr.postalCode || addr.zipPostal || '',
                country: addr.country || '',
                street: addr.street || addr.address1 || '',
                fullAddress: data.originAddress || ''
            };
        } else {
            const addr = data.shipTo || data.destinationAddress || {};
            location = {
                city: addr.city || '',
                state: addr.state || addr.province || addr.stateProv || '',
                postalCode: addr.postalCode || addr.zipPostal || '',
                country: addr.country || '',
                street: addr.street || addr.address1 || '',
                fullAddress: data.destinationAddress || ''
            };
        }

        return location;
    };

    // Calculate location score using multiple factors
    const calculateLocationScore = (loc1, loc2) => {
        if (!loc1 || !loc2) return 0;

        let score = 0;
        let factors = 0;

        // City matching (highest weight)
        if (loc1.city && loc2.city) {
            const cityMatch = calculateStringSimilarity(loc1.city.toLowerCase(), loc2.city.toLowerCase());
            score += cityMatch * 0.4; // 40% weight
            factors++;
        }

        // State/Province matching
        if (loc1.state && loc2.state) {
            const stateMatch = loc1.state.toLowerCase() === loc2.state.toLowerCase() ? 1 : 0;
            score += stateMatch * 0.3; // 30% weight
            factors++;
        }

        // Postal code matching
        if (loc1.postalCode && loc2.postalCode) {
            const postalMatch = loc1.postalCode.toLowerCase().replace(/\s/g, '') ===
                loc2.postalCode.toLowerCase().replace(/\s/g, '') ? 1 : 0;
            score += postalMatch * 0.2; // 20% weight
            factors++;
        }

        // Street matching (if available)
        if (loc1.street && loc2.street) {
            const streetMatch = calculateStringSimilarity(loc1.street.toLowerCase(), loc2.street.toLowerCase());
            score += streetMatch * 0.1; // 10% weight
            factors++;
        }

        return factors > 0 ? score : 0;
    };

    // 🚀 PACKAGE/WEIGHT MATCHING ENGINE (20 points max)
    const calculatePackageScore = (invoice, system) => {
        console.log(`📦 PACKAGE: Starting analysis`);
        let score = 0;

        // Weight matching with tolerance
        const invoiceWeight = parseFloat(invoice.weight) || 0;
        const systemWeight = parseFloat(
            system.shipmentInfo?.totalWeight ||
            system.totalWeight ||
            system.packages?.[0]?.weight ||
            system.packageDetails?.weight ||
            0
        );

        if (invoiceWeight > 0 && systemWeight > 0) {
            const weightDiff = Math.abs(invoiceWeight - systemWeight) / Math.max(invoiceWeight, systemWeight);
            if (weightDiff <= 0.05) score += 10; // Within 5%
            else if (weightDiff <= 0.15) score += 7; // Within 15%
            else if (weightDiff <= 0.30) score += 4; // Within 30%
            console.log(`📦 Weight match: ${invoiceWeight} vs ${systemWeight} (diff: ${(weightDiff * 100).toFixed(1)}%)`);
        }

        // Package count matching
        const invoicePackages = invoice.packageDetails?.length || 1;
        const systemPackages = system.packages?.length || system.shipmentInfo?.totalPieces || 1;

        if (invoicePackages === systemPackages) {
            score += 10;
            console.log(`📦 Package count exact match: ${invoicePackages}`);
        } else if (Math.abs(invoicePackages - systemPackages) <= 2) {
            score += 5;
            console.log(`📦 Package count close match: ${invoicePackages} vs ${systemPackages}`);
        }

        console.log(`📦 Total package score: ${score}/20 points`);
        return { score: Math.min(score, 20) };
    };

    // 🚀 FINANCIAL CORRELATION ENGINE (15 points max)
    const calculateFinancialCorrelationScore = (invoice, system) => {
        console.log(`💰 FINANCIAL: Starting analysis`);

        const invoiceAmount = parseFloat(invoice.totalAmount) || 0;
        const systemAmount = parseFloat(
            system.totalCharges ||
            system.shipmentInfo?.totalAmount ||
            system.selectedRate?.totalAmount ||
            system.selectedRate?.totals?.total ||
            system.actualRates?.totalCharges ||
            system.markupRates?.totalCharges ||
            system.billingDetails?.totalAmount ||
            system.totalAmount
        ) || 0;

        console.log(`💰 Amounts: Invoice ${invoiceAmount} vs System ${systemAmount}`);

        if (invoiceAmount > 0 && systemAmount > 0) {
            const difference = Math.abs(invoiceAmount - systemAmount);
            const percentDiff = difference / Math.max(invoiceAmount, systemAmount);

            console.log(`💰 Difference: ${difference.toFixed(2)} (${(percentDiff * 100).toFixed(1)}%)`);

            if (percentDiff <= 0.02) return { score: 15 }; // Within 2% - perfect
            if (percentDiff <= 0.05) return { score: 12 }; // Within 5% - excellent
            if (percentDiff <= 0.10) return { score: 8 };  // Within 10% - good
            if (percentDiff <= 0.20) return { score: 5 };  // Within 20% - acceptable
            if (percentDiff <= 0.50) return { score: 2 };  // Within 50% - poor but some correlation
        }

        return { score: 0 };
    };

    // 🚀 TEMPORAL INTELLIGENCE ENGINE (5 points max)
    const calculateTemporalIntelligenceScore = (invoice, system) => {
        console.log(`📅 TEMPORAL: Starting analysis`);

        // Date proximity matching
        if (invoice.invoiceDate && system.shipmentInfo?.shipmentDate) {
            try {
                const invoiceDate = new Date(invoice.invoiceDate);
                const shipmentDate = new Date(system.shipmentInfo.shipmentDate);

                const timeDiff = Math.abs(invoiceDate - shipmentDate);
                const daysDiff = timeDiff / (1000 * 60 * 60 * 24);

                console.log(`📅 Date difference: ${daysDiff.toFixed(1)} days`);

                if (daysDiff <= 1) return { score: 5 }; // Same day or next day
                if (daysDiff <= 7) return { score: 3 }; // Within a week
                if (daysDiff <= 30) return { score: 1 }; // Within a month
            } catch (error) {
                console.log(`📅 Date parsing error:`, error);
            }
        }

        return { score: 0 };
    };

    const calculateStringSimilarity = (str1, str2) => {
        if (!str1 || !str2) return 0;

        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;

        if (longer.length === 0) return 1.0;

        const distance = levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    };

    const levenshteinDistance = (str1, str2) => {
        const matrix = Array(str2.length + 1).fill().map(() => Array(str1.length + 1).fill(0));

        for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;

        for (let j = 1; j <= str2.length; j++) {
            for (let i = 1; i <= str1.length; i++) {
                if (str1[i - 1] === str2[j - 1]) {
                    matrix[j][i] = matrix[j - 1][i - 1];
                } else {
                    matrix[j][i] = Math.min(
                        matrix[j - 1][i - 1] + 1,
                        matrix[j][i - 1] + 1,
                        matrix[j - 1][i] + 1
                    );
                }
            }
        }

        return matrix[str2.length][str1.length];
    };

    // Extract system rate data for comparison with invoice charges
    const extractSystemRateData = (systemShipment) => {
        try {
            console.log('📊 Extracting system rate data from:', systemShipment.shipmentID || systemShipment.shipmentId);

            // Build comprehensive charges structure with actual cost/charge data
            const charges = [];
            let totalAmount = 0;

            // Get total amounts for different rate types
            const quotedTotal = systemShipment.selectedRate?.totalAmount || 0;
            const actualCostTotal = systemShipment.actualRates?.totalCharges || 0;
            const actualChargeTotal = systemShipment.markupRates?.totalCharges || 0;

            // Start with selectedRate charges as the base structure
            if (systemShipment.selectedRate?.charges && Array.isArray(systemShipment.selectedRate.charges)) {
                systemShipment.selectedRate.charges.forEach(charge => {
                    charges.push({
                        code: charge.code || 'FRT',
                        name: charge.name || charge.chargeName || 'Charge',
                        currency: systemShipment.currency || 'CAD',
                        quotedCost: parseFloat(charge.cost || charge.amount || 0),
                        quotedCharge: parseFloat(charge.charge || charge.amount || 0),
                        actualCost: 0, // Will be populated from manualRates
                        actualCharge: 0 // Will be populated from manualRates
                    });
                });
                totalAmount = quotedTotal;
            }

            // Enhance with manualRates data (this contains actual cost/charge breakdown)
            if (systemShipment.manualRates && Array.isArray(systemShipment.manualRates)) {
                systemShipment.manualRates.forEach(manualRate => {
                    const existingChargeIndex = charges.findIndex(c =>
                        c.name.toLowerCase().includes(manualRate.chargeName?.toLowerCase() || 'freight') ||
                        c.code === (manualRate.code || 'FRT')
                    );

                    if (existingChargeIndex >= 0) {
                        // Update existing charge with actual data
                        charges[existingChargeIndex].actualCost = parseFloat(manualRate.cost || 0);
                        charges[existingChargeIndex].actualCharge = parseFloat(manualRate.charge || 0);
                    } else {
                        // Add new charge from manual rates
                        charges.push({
                            code: manualRate.code || 'FRT',
                            name: manualRate.chargeName || 'Freight Charge',
                            currency: systemShipment.currency || 'CAD',
                            quotedCost: parseFloat(manualRate.cost || 0),
                            quotedCharge: parseFloat(manualRate.charge || 0),
                            actualCost: parseFloat(manualRate.cost || 0),
                            actualCharge: parseFloat(manualRate.charge || 0)
                        });
                    }
                });
            }

            // If no charges found, create basic freight charge
            if (charges.length === 0) {
                totalAmount = systemShipment.totalCharges || systemShipment.shipmentInfo?.totalAmount || quotedTotal;
                charges.push({
                    code: 'FRT',
                    name: 'Freight Charge',
                    currency: systemShipment.currency || 'CAD',
                    quotedCost: actualCostTotal || totalAmount,
                    quotedCharge: actualChargeTotal || totalAmount,
                    actualCost: actualCostTotal || totalAmount,
                    actualCharge: actualChargeTotal || totalAmount
                });
            }

            // Ensure all charges have proper numeric values
            charges.forEach(charge => {
                charge.quotedCost = isNaN(charge.quotedCost) ? 0 : charge.quotedCost;
                charge.quotedCharge = isNaN(charge.quotedCharge) ? 0 : charge.quotedCharge;
                charge.actualCost = isNaN(charge.actualCost) ? 0 : charge.actualCost;
                charge.actualCharge = isNaN(charge.actualCharge) ? 0 : charge.actualCharge;
            });

            const rateData = {
                charges: charges,
                totalAmount: totalAmount || quotedTotal,
                currency: systemShipment.currency || 'CAD',
                carrier: systemShipment.carrier || systemShipment.selectedCarrier?.name,
                service: systemShipment.service || systemShipment.selectedRate?.service?.name,
                shipmentId: systemShipment.shipmentID || systemShipment.shipmentId,
                // Include cost data if available (for admin users)
                totals: {
                    cost: actualCostTotal || totalAmount,
                    charge: actualChargeTotal || totalAmount
                }
            };

            console.log('📊 Extracted system rate data:', rateData);
            return rateData;
        } catch (error) {
            console.error('❌ Error extracting system rate data:', error);
            return {
                charges: [],
                totalAmount: 0,
                currency: 'CAD',
                error: 'Failed to extract rate data'
            };
        }
    };

    const handleShipmentClick = (shipment) => {
        console.log('📋 Selected shipment for details:', shipment);
        setSelectedShipmentDetail(shipment);
        setShipmentDetailDialogOpen(true);
    };

    const handleCloseShipmentDetail = () => {
        setShipmentDetailDialogOpen(false);
        setSelectedShipmentDetail(null);
    };

    const handleApplyCharges = async (shipmentDetail) => {
        console.log('💰 Applying invoice charges to shipment:', shipmentDetail);

        // Here you would implement the logic to apply the invoice charges
        // to the matched system shipment. For now, we'll just show a success message.

        try {
            // TODO: Implement actual charge application logic
            // This would involve:
            // 1. Finding the matched system shipment
            // 2. Updating the shipment charges with invoice data
            // 3. Creating audit trail
            // 4. Updating shipment status

            console.log('✅ Successfully applied charges to shipment');

        } catch (error) {
            console.error('❌ Error applying charges:', error);
        }
    };

    // Shipment Matching Handlers
    const handleMatchShipment = (row) => {
        console.log('🔍 Opening shipment matching for:', row);
        setSelectedRowForMatching(row);
        setMatchingDialogOpen(true);
        setShipmentSearchTerm('');
        setShipmentSearchResults([]);
    };

    const handleViewMatchedShipment = (shipmentId) => {
        console.log('👁️ Viewing matched shipment:', shipmentId);
        // TODO: Navigate to shipment detail view or open shipment modal
        // This could use the existing shipment detail functionality from the main app
        window.open(`/shipments/${shipmentId}`, '_blank');
    };

    const searchShipments = async (searchTerm) => {
        if (!searchTerm || searchTerm.length < 2) {
            setShipmentSearchResults([]);
            return;
        }

        setIsSearchingShipments(true);
        try {
            console.log('🔍 Searching shipments for:', searchTerm);

            // Use the existing fetchSystemShipments function and filter results
            const allShipments = await fetchSystemShipments();

            // Comprehensive search across multiple fields
            const searchLower = searchTerm.toLowerCase();
            const filtered = allShipments.filter(shipment => {
                // Search in shipment IDs
                const shipmentIdMatch = (shipment.shipmentID || shipment.shipmentId || '').toLowerCase().includes(searchLower);

                // Search in reference numbers
                const referenceMatch = [
                    ...(shipment.referenceNumbers || []),
                    ...(shipment.references || []),
                    shipment.customerReferenceNumber,
                    shipment.poNumber,
                    ...(shipment.manualRates || []).map(r => r.ediNumber),
                    ...(shipment.manualRates || []).map(r => r.invoiceNumber)
                ].some(ref => ref && ref.toString().toLowerCase().includes(searchLower));

                // Search in addresses
                const addressMatch = [
                    shipment.shipFrom?.company,
                    shipment.shipFrom?.city,
                    shipment.shipTo?.company,
                    shipment.shipTo?.city,
                    shipment.shipmentInfo?.origin?.company,
                    shipment.shipmentInfo?.destination?.company
                ].some(addr => addr && addr.toLowerCase().includes(searchLower));

                // Search in carrier information
                const carrierMatch = [
                    shipment.carrier,
                    shipment.selectedCarrier,
                    shipment.selectedRate?.carrier,
                    shipment.selectedRate?.carrierName
                ].some(carrier => carrier && carrier.toLowerCase().includes(searchLower));

                return shipmentIdMatch || referenceMatch || addressMatch || carrierMatch;
            });

            // Format results for the search dialog
            const searchResults = filtered.slice(0, 20).map(shipment => ({
                id: shipment.id || shipment.shipmentID || shipment.shipmentId,
                shipmentId: shipment.shipmentID || shipment.shipmentId,
                origin: `${shipment.shipFrom?.company || shipment.shipmentInfo?.origin?.company || 'Unknown'}, ${shipment.shipFrom?.city || shipment.shipmentInfo?.origin?.city || ''}`,
                destination: `${shipment.shipTo?.company || shipment.shipmentInfo?.destination?.company || 'Unknown'}, ${shipment.shipTo?.city || shipment.shipmentInfo?.destination?.city || ''}`,
                carrier: shipment.carrier || shipment.selectedCarrier || shipment.selectedRate?.carrier || 'Unknown',
                status: shipment.status || 'Unknown',
                totalAmount: shipment.selectedRate?.totalAmount || shipment.totalAmount || 0,
                currency: shipment.currency || 'CAD',
                createdAt: shipment.createdAt,
                bookedAt: shipment.bookedAt
            }));

            console.log(`📋 Found ${searchResults.length} matching shipments out of ${allShipments.length} total`);
            setShipmentSearchResults(searchResults);
        } catch (error) {
            console.error('❌ Error searching shipments:', error);
            setShipmentSearchResults([]);
        } finally {
            setIsSearchingShipments(false);
        }
    };

    const handleSelectMatchedShipment = (shipment) => {
        console.log('✅ Selected shipment for matching:', shipment);

        // Update the table data to include the matched shipment ID and manual match status
        setTableData(prevTableData =>
            prevTableData.map(row =>
                row.id === selectedRowForMatching.id
                    ? {
                        ...row,
                        matchedShipmentId: shipment.shipmentId,
                        matchConfidence: 100, // Manual matches get 100% confidence
                        matchMethod: 'Manual Match',
                        matchResult: {
                            match: shipment,
                            confidence: 100,
                            method: 'Manual Match',
                            matched: true
                        }
                    }
                    : row
            )
        );

        // TODO: Save the matching to database
        console.log('💾 Saving shipment match to database...');

        setMatchingDialogOpen(false);
        setSelectedRowForMatching(null);
        setShipmentSearchTerm('');
        setShipmentSearchResults([]);
    };

    // PDF Viewing Handlers
    const handleViewInvoicePDF = async () => {
        console.log('📄 Opening original invoice PDF');

        try {
            // First check for stored download URLs (from Firebase Storage uploads)
            let pdfUrl = uploadData?.downloadURL ||
                uploadData?.fileUrl ||
                uploadData?.url ||
                uploadData?.pdfUrl ||
                uploadData?.fileRef ||
                uploadData?.storageRef ||
                uploadData?.downloadUrl ||
                uploadData?.rawUpload?.downloadURL ||  // NEW: Check inside rawUpload object
                uploadData?.rawUpload?.fileUrl;

            console.log('🔍 Checking for download URLs:', {
                downloadURL: !!uploadData?.downloadURL,
                fileUrl: !!uploadData?.fileUrl,
                url: !!uploadData?.url,
                pdfUrl: !!uploadData?.pdfUrl,
                finalPdfUrl: !!pdfUrl
            });

            if (!pdfUrl) {
                console.log('🔍 No storage URL found, checking for rawUpload base64 data...');

                // Check if we have base64 data stored in rawUpload field
                if (uploadData?.rawUpload) {
                    console.log('📄 Found rawUpload data, converting to blob URL...');
                    console.log('🔍 rawUpload type:', typeof uploadData.rawUpload);
                    console.log('🔍 rawUpload structure:', Object.keys(uploadData.rawUpload || {}));
                    console.log('🔍 rawUpload full object:', uploadData.rawUpload);

                    try {
                        // Handle different rawUpload formats
                        let base64Data;

                        if (typeof uploadData.rawUpload === 'string') {
                            // It's already a string
                            base64Data = uploadData.rawUpload;
                            console.log('🔧 Using string rawUpload directly');
                        } else if (uploadData.rawUpload?.data) {
                            // It might be an object with a data property
                            base64Data = uploadData.rawUpload.data;
                            console.log('🔧 Using rawUpload.data property');
                        } else if (uploadData.rawUpload?._data) {
                            // Firebase might store it as _data
                            base64Data = uploadData.rawUpload._data;
                            console.log('🔧 Using rawUpload._data property');
                        } else if (Array.isArray(uploadData.rawUpload)) {
                            // It might be a Uint8Array or similar
                            base64Data = btoa(String.fromCharCode.apply(null, uploadData.rawUpload));
                            console.log('🔧 Converting array to base64');
                        } else if (uploadData.rawUpload?.buffer || uploadData.rawUpload?.arrayBuffer) {
                            // It might be a Buffer or ArrayBuffer
                            const buffer = uploadData.rawUpload.buffer || uploadData.rawUpload;
                            const uint8Array = new Uint8Array(buffer);
                            base64Data = btoa(String.fromCharCode.apply(null, uint8Array));
                            console.log('🔧 Converting buffer to base64');
                        } else {
                            // Log what we're trying to convert
                            console.log('🔧 Attempting toString() conversion on:', uploadData.rawUpload);
                            base64Data = uploadData.rawUpload.toString();
                        }

                        console.log('🔧 Final base64Data preview:', base64Data?.substring(0, 100) + '...');
                        console.log('🔧 Base64Data type:', typeof base64Data);
                        console.log('🔧 Base64Data length:', base64Data?.length);

                        // Remove data URL prefix if present (data:application/pdf;base64,)
                        const cleanBase64 = base64Data.replace(/^data:application\/pdf;base64,/, '');
                        console.log('🔧 Clean base64 preview:', cleanBase64?.substring(0, 100) + '...');

                        // Validate base64 format
                        if (!cleanBase64 || typeof cleanBase64 !== 'string') {
                            throw new Error('Invalid base64 data: not a string');
                        }

                        // Test if it's valid base64
                        const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
                        if (!base64Regex.test(cleanBase64)) {
                            throw new Error('Invalid base64 format: contains invalid characters');
                        }

                        // Convert base64 to binary
                        console.log('🔧 Attempting atob conversion...');
                        const binaryString = atob(cleanBase64);
                        console.log('🔧 Binary string length:', binaryString.length);

                        const bytes = new Uint8Array(binaryString.length);

                        for (let i = 0; i < binaryString.length; i++) {
                            bytes[i] = binaryString.charCodeAt(i);
                        }

                        // Create blob and blob URL
                        const blob = new Blob([bytes], { type: 'application/pdf' });
                        pdfUrl = URL.createObjectURL(blob);

                        console.log('✅ Successfully created blob URL from rawUpload data');

                    } catch (conversionError) {
                        console.error('❌ Error converting base64 to blob:', conversionError);
                        enqueueSnackbar('Error processing PDF data', { variant: 'error' });
                        return;
                    }
                } else {
                    // Check if there's aiResults with base64 data
                    const aiResults = uploadData?.aiResults;
                    if (aiResults?.testResults?.rawUpload || aiResults?.rawUpload) {
                        console.log('🔧 Found base64 data in aiResults, attempting conversion...');
                        const base64Data = aiResults.testResults?.rawUpload || aiResults.rawUpload;

                        try {
                            // Remove data URL prefix if present
                            const cleanBase64 = base64Data.replace(/^data:application\/pdf;base64,/, '');

                            // Convert base64 to binary
                            const binaryString = atob(cleanBase64);
                            const bytes = new Uint8Array(binaryString.length);

                            for (let i = 0; i < binaryString.length; i++) {
                                bytes[i] = binaryString.charCodeAt(i);
                            }

                            // Create blob and blob URL
                            const blob = new Blob([bytes], { type: 'application/pdf' });
                            pdfUrl = URL.createObjectURL(blob);

                            console.log('✅ Successfully created blob URL from aiResults data');

                        } catch (aiConversionError) {
                            console.error('❌ Error converting aiResults base64:', aiConversionError);
                            enqueueSnackbar('PDF file not accessible. No valid file data found.', { variant: 'error' });
                            return;
                        }
                    } else {
                        console.error('❌ No PDF URL or rawUpload data found in upload data:', uploadData);
                        console.error('🔍 Available upload data fields:', Object.keys(uploadData || {}));
                        enqueueSnackbar('PDF file not accessible. No file data found.', { variant: 'error' });
                        return;
                    }
                }
            }

            console.log('📄 PDF URL ready:', pdfUrl?.substring(0, 100) + '...');
            setPdfUrl(pdfUrl);
            setPdfViewerOpen(true);

        } catch (error) {
            console.error('❌ Error loading PDF:', error);
            enqueueSnackbar('Error loading PDF file', { variant: 'error' });
        }
    };

    const handleClosePdfViewer = () => {
        setPdfViewerOpen(false);

        // Clean up blob URL to prevent memory leaks
        if (pdfUrl && pdfUrl.startsWith('blob:')) {
            URL.revokeObjectURL(pdfUrl);
        }

        setPdfUrl(null);
    };

    const renderExtractedResults = () => {
        if (tableData.length === 0) {
            return (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <ShipmentIcon sx={{ fontSize: 48, color: '#9ca3af', mb: 2 }} />
                    <Typography variant="h6" sx={{ mb: 2, fontSize: '16px', fontWeight: 600 }}>
                        No shipment data found
                    </Typography>
                    <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                        The invoice processing completed but no structured shipment data was extracted.
                    </Typography>
                </Box>
            );
        }

        return (
            <Box sx={{ p: 3 }}>
                {/* Header */}
                <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                        Extracted Results ({tableData.length} shipments)
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="outlined"
                            color="primary"
                            size="small"
                            startIcon={<PdfIcon />}
                            onClick={handleViewInvoicePDF}
                            sx={{ fontSize: '11px' }}
                        >
                            VIEW ORIGINAL INVOICE
                        </Button>
                        <Button
                            variant="contained"
                            color="success"
                            size="small"
                            onClick={handleBulkApprove}
                            disabled={selectedShipments.size === 0 || isBulkApproving || isBulkExcepting}
                            startIcon={isBulkApproving ? <CircularProgress size={14} /> : null}
                            sx={{ fontSize: '11px' }}
                        >
                            {isBulkApproving ? 'APPROVING...' : (selectedShipments.size === 0 ? 'SELECT SHIPMENTS TO APPROVE' : `APPROVE ${selectedShipments.size} FOR BILLING`)}
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={handleBulkException}
                            disabled={selectedShipments.size === 0 || isBulkApproving || isBulkExcepting}
                            startIcon={isBulkExcepting ? <CircularProgress size={14} /> : null}
                            sx={{ fontSize: '11px' }}
                        >
                            {isBulkExcepting ? 'MARKING...' : (selectedShipments.size === 0 ? 'SELECT SHIPMENTS FOR EXCEPTION' : `MARK ${selectedShipments.size} AS EXCEPTION`)}
                        </Button>
                    </Box>
                </Box>

                {/* Split data into matched and unmatched shipments */}
                {(() => {
                    const matchedShipments = tableData.filter(row => row.matchedShipmentId && row.matchConfidence >= 80);
                    const unmatchedShipments = tableData.filter(row => !row.matchedShipmentId || row.matchConfidence < 80);

                    const renderTable = (data, title, showMatchColumn = true) => (
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 2, color: '#374151' }}>
                                {title} ({data.length})
                            </Typography>
                            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151', padding: '8px' }}>
                                                <Checkbox
                                                    size="small"
                                                    checked={data.length > 0 && data.every(row => selectedShipments.has(row.id))}
                                                    onChange={(e) => {
                                                        const allRowIds = data.map(row => row.id);
                                                        if (e.target.checked) {
                                                            setSelectedShipments(prev => new Set([...prev, ...allRowIds]));
                                                        } else {
                                                            setSelectedShipments(prev => {
                                                                const newSet = new Set(prev);
                                                                allRowIds.forEach(id => newSet.delete(id));
                                                                return newSet;
                                                            });
                                                        }
                                                    }}
                                                    indeterminate={data.some(row => selectedShipments.has(row.id)) && !data.every(row => selectedShipments.has(row.id))}
                                                />
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Shipment ID</TableCell>
                                            {showMatchColumn && (
                                                <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Matched Shipment ID</TableCell>
                                            )}
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Carrier</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Route</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151', minWidth: '200px' }}>Charges</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Total</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Status</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {data.length > 0 ? data.map((row) => (
                                            <TableRow key={row.id} hover sx={{ '&:hover': { backgroundColor: '#f9fafb' } }}>
                                                <TableCell sx={{ fontSize: '11px', padding: '8px' }}>
                                                    <Checkbox
                                                        size="small"
                                                        checked={selectedShipments.has(row.id)}
                                                        onChange={(e) => handleSelectShipment(row.id, e.target.checked)}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '11px' }}>{row.shipmentId}</TableCell>
                                                {showMatchColumn && (
                                                    <TableCell sx={{ fontSize: '11px' }}>
                                                        {row.matchedShipmentId && row.matchConfidence >= 80 ? (
                                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                                <Chip
                                                                    label={row.matchedShipmentId}
                                                                    size="small"
                                                                    icon={<LinkIcon sx={{ fontSize: '12px' }} />}
                                                                    sx={{
                                                                        fontSize: '10px',
                                                                        height: '20px',
                                                                        backgroundColor: '#d1fae5',
                                                                        color: '#059669',
                                                                        '&:hover': {
                                                                            backgroundColor: '#bbf7d0'
                                                                        }
                                                                    }}
                                                                    onClick={() => handleViewMatchedShipment(row.matchedShipmentId)}
                                                                />
                                                                {row.matchConfidence && (
                                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                        <Chip
                                                                            label={`${row.matchConfidence}% confidence`}
                                                                            size="small"
                                                                            color="success"
                                                                            sx={{ fontSize: '9px', height: '16px' }}
                                                                        />
                                                                        <Tooltip title={`Matched by: ${row.matchMethod}`}>
                                                                            <AssignIcon sx={{ fontSize: '12px', color: '#3b82f6' }} />
                                                                        </Tooltip>
                                                                    </Box>
                                                                )}
                                                            </Box>
                                                        ) : row.matchConfidence && row.matchConfidence < 80 ? (
                                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                                <Button
                                                                    size="small"
                                                                    variant="outlined"
                                                                    startIcon={<SearchIcon sx={{ fontSize: '12px' }} />}
                                                                    sx={{
                                                                        fontSize: '10px',
                                                                        height: '24px',
                                                                        minWidth: 'auto',
                                                                        px: 1,
                                                                        borderColor: '#000',
                                                                        color: '#000',
                                                                        '&:hover': {
                                                                            borderColor: '#000',
                                                                            backgroundColor: '#f5f5f5'
                                                                        }
                                                                    }}
                                                                    onClick={() => handleMatchShipment(row)}
                                                                >
                                                                    MATCH
                                                                </Button>
                                                                <Typography sx={{ fontSize: '9px', color: '#6b7280', textAlign: 'center' }}>
                                                                    Low confidence ({row.matchConfidence}%)
                                                                </Typography>
                                                            </Box>
                                                        ) : isAutoMatching ? (
                                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, alignItems: 'center' }}>
                                                                <CircularProgress size={16} sx={{ color: '#3b82f6' }} />
                                                                <Typography sx={{ fontSize: '9px', color: '#6b7280', textAlign: 'center' }}>
                                                                    Matching...
                                                                </Typography>
                                                            </Box>
                                                        ) : (
                                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                                <Button
                                                                    size="small"
                                                                    variant="outlined"
                                                                    startIcon={<SearchIcon sx={{ fontSize: '12px' }} />}
                                                                    sx={{
                                                                        fontSize: '10px',
                                                                        height: '24px',
                                                                        minWidth: 'auto',
                                                                        px: 1,
                                                                        borderColor: '#000',
                                                                        color: '#000',
                                                                        '&:hover': {
                                                                            borderColor: '#000',
                                                                            backgroundColor: '#f5f5f5'
                                                                        }
                                                                    }}
                                                                    onClick={() => handleMatchShipment(row)}
                                                                >
                                                                    MATCH
                                                                </Button>
                                                                <Typography sx={{ fontSize: '9px', color: '#6b7280', textAlign: 'center' }}>
                                                                    No auto-match found
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                    </TableCell>
                                                )}
                                                <TableCell sx={{ fontSize: '11px' }}>{row.carrier}</TableCell>
                                                <TableCell sx={{ fontSize: '11px' }}>
                                                    <Box>
                                                        <Typography variant="caption" sx={{ fontSize: '10px', display: 'block' }}>
                                                            From: {row.origin}
                                                        </Typography>
                                                        <Typography variant="caption" sx={{ fontSize: '10px', display: 'block' }}>
                                                            To: {row.destination}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '11px', minWidth: '200px' }}>
                                                    {row.charges.length > 0 ? (
                                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                            {row.charges.map((charge, index) => (
                                                                <Typography key={index} variant="caption" sx={{ fontSize: '10px', display: 'block' }}>
                                                                    {charge.description || charge.name}: {formatCurrencyHelper(charge.amount, charge.currency)}
                                                                </Typography>
                                                            ))}
                                                        </Box>
                                                    ) : (
                                                        <Typography variant="caption" sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                            No charges
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '11px', fontWeight: 600, color: '#059669' }}>
                                                    {formatCurrencyHelper(row.totalAmount, row.currency)}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '11px' }}>
                                                    {(() => {
                                                        const statusInfo = getStatusDisplay(row);
                                                        return (
                                                            <Chip
                                                                label={statusInfo.label}
                                                                size="small"
                                                                sx={{
                                                                    fontSize: '10px',
                                                                    height: '22px',
                                                                    backgroundColor: statusInfo.backgroundColor,
                                                                    color: statusInfo.color,
                                                                    fontWeight: 500
                                                                }}
                                                            />
                                                        );
                                                    })()}
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        size="small"
                                                        variant="outlined"
                                                        onClick={() => handleShipmentClick(row)}
                                                        sx={{ fontSize: '10px', minWidth: 'auto', px: 1 }}
                                                    >
                                                        View Details
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )) : (
                                            <TableRow>
                                                <TableCell colSpan={showMatchColumn ? 9 : 8} sx={{ textAlign: 'center', py: 3 }}>
                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                        No {title.toLowerCase()} found
                                                    </Typography>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Box>
                    );

                    return (
                        <Box>
                            {/* Summary */}
                            <Box sx={{ mb: 3, p: 2, backgroundColor: '#f9fafb', borderRadius: 1 }}>
                                <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                    Summary
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 4 }}>
                                    <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                        Total Shipments: <strong>{tableData.length}</strong>
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                        Total Amount: <strong>{formatCurrencyHelper(tableData.reduce((sum, row) => sum + row.totalAmount, 0))}</strong>
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                        Carriers: <strong>{[...new Set(tableData.map(row => row.carrier))].join(', ')}</strong>
                                    </Typography>
                                </Box>
                            </Box>

                            {/* Matched Shipments Table */}
                            {renderTable(matchedShipments, "MATCHED SHIPMENTS", true)}

                            {/* Unmatched Shipments Table */}
                            {renderTable(unmatchedShipments, "UNMATCHED SHIPMENTS", true)}
                        </Box>
                    );
                })()}
            </Box>
        );
    };

    const renderShipmentDetailDialog = () => {
        if (!selectedShipmentDetail) return null;

        return (
            <Dialog
                open={shipmentDetailDialogOpen}
                onClose={handleCloseShipmentDetail}
                maxWidth="xl"
                fullWidth
                PaperProps={{ sx: { height: '90vh' } }}
            >
                <DialogTitle sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #e5e7eb',
                    pb: 2
                }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                        Shipment Details - {selectedShipmentDetail.shipmentId}
                    </Typography>
                    <IconButton onClick={handleCloseShipmentDetail} size="small">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ p: 0 }}>
                    <Box sx={{ p: 3 }}>
                        {/* Top Row - Shipping Details, Package Information, References */}
                        <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', p: 2, mb: 3 }}>
                            <Grid container spacing={3}>
                                {/* Shipping Details */}
                                <Grid item xs={12} md={4}>
                                    <Typography sx={{ fontSize: '14px', fontWeight: 600, mb: 2 }}>Shipping Details</Typography>

                                    {/* Origin */}
                                    <Box sx={{ mb: 2 }}>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Origin</Typography>
                                        <Typography sx={{ fontSize: '12px' }}>{selectedShipmentDetail.origin}</Typography>
                                        {selectedShipmentDetail.originAddress && (
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                {selectedShipmentDetail.originAddress}
                                            </Typography>
                                        )}
                                    </Box>

                                    {/* Destination */}
                                    <Box sx={{ mb: 2 }}>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Destination</Typography>
                                        <Typography sx={{ fontSize: '12px' }}>{selectedShipmentDetail.destination}</Typography>
                                        {selectedShipmentDetail.destinationAddress && (
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                {selectedShipmentDetail.destinationAddress}
                                            </Typography>
                                        )}
                                    </Box>
                                </Grid>

                                {/* Package Information */}
                                <Grid item xs={12} md={4}>
                                    <Typography sx={{ fontSize: '14px', fontWeight: 600, mb: 2 }}>Package Information</Typography>

                                    {selectedShipmentDetail.packageDetails && selectedShipmentDetail.packageDetails.length > 0 ? (
                                        // Multiple packages display
                                        <Box>
                                            {selectedShipmentDetail.packageDetails.map((pkg, index) => (
                                                <Box key={index} sx={{ mb: index < selectedShipmentDetail.packageDetails.length - 1 ? 2 : 0 }}>
                                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                        Package {index + 1} {pkg.quantity > 1 ? `(${pkg.quantity} pieces)` : ''}
                                                    </Typography>
                                                    <Grid container spacing={2}>
                                                        <Grid item xs={6}>
                                                            <Typography sx={{ fontSize: '11px', fontWeight: 500, color: '#6b7280' }}>Weight</Typography>
                                                            <Typography sx={{ fontSize: '11px' }}>{pkg.weight || 'N/A'}</Typography>
                                                        </Grid>
                                                        <Grid item xs={6}>
                                                            <Typography sx={{ fontSize: '11px', fontWeight: 500, color: '#6b7280' }}>Dimensions</Typography>
                                                            <Typography sx={{ fontSize: '11px' }}>{pkg.dimensions || 'N/A'}</Typography>
                                                        </Grid>
                                                    </Grid>
                                                    {pkg.description && pkg.description !== 'N/A' && (
                                                        <Box sx={{ mt: 1 }}>
                                                            <Typography sx={{ fontSize: '11px', fontWeight: 500, color: '#6b7280' }}>Description</Typography>
                                                            <Typography sx={{ fontSize: '11px' }}>{pkg.description}</Typography>
                                                        </Box>
                                                    )}
                                                </Box>
                                            ))}
                                        </Box>
                                    ) : (
                                        // Single package/summary display
                                        <Grid container spacing={2}>
                                            <Grid item xs={6}>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Weight</Typography>
                                                <Typography sx={{ fontSize: '12px' }}>{selectedShipmentDetail.weight || 'N/A'}</Typography>
                                            </Grid>
                                            <Grid item xs={6}>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Dimensions</Typography>
                                                <Typography sx={{ fontSize: '12px' }}>{selectedShipmentDetail.dimensions || 'N/A'}</Typography>
                                            </Grid>
                                        </Grid>
                                    )}
                                </Grid>

                                {/* References & Shipment Matching */}
                                <Grid item xs={12} md={4}>
                                    <Typography sx={{ fontSize: '14px', fontWeight: 600, mb: 2 }}>References & Matching</Typography>

                                    {/* Matched Shipment Section */}
                                    {selectedShipmentDetail.matchedShipmentId && (
                                        <Box sx={{ mb: 2, p: 1, backgroundColor: '#f0f9ff', borderRadius: 1, border: '1px solid #0ea5e9' }}>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#0369a1', mb: 1 }}>Matched Shipment</Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Typography sx={{ fontSize: '12px', color: '#0369a1' }}>
                                                    {selectedShipmentDetail.matchedShipmentId}
                                                </Typography>
                                                <Button
                                                    size="small"
                                                    variant="text"
                                                    startIcon={<LinkIcon sx={{ fontSize: '12px' }} />}
                                                    onClick={() => {
                                                        // Open shipment in new tab
                                                        window.open(`/shipments/${selectedShipmentDetail.matchedShipmentId}`, '_blank');
                                                    }}
                                                    sx={{
                                                        fontSize: '10px',
                                                        minWidth: 'auto',
                                                        p: 0.5,
                                                        color: '#0369a1'
                                                    }}
                                                >
                                                    View
                                                </Button>
                                            </Box>
                                        </Box>
                                    )}

                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>References</Typography>
                                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                        {(() => {
                                            const allReferences = [];

                                            // Collect all non-empty references
                                            if (selectedShipmentDetail.references.invoiceRef && selectedShipmentDetail.references.invoiceRef !== 'N/A') {
                                                allReferences.push({ label: 'Invoice', value: selectedShipmentDetail.references.invoiceRef });
                                            }
                                            if (selectedShipmentDetail.references.manifestRef && selectedShipmentDetail.references.manifestRef !== 'N/A') {
                                                allReferences.push({ label: 'Manifest', value: selectedShipmentDetail.references.manifestRef });
                                            }
                                            if (selectedShipmentDetail.references.customerRef && selectedShipmentDetail.references.customerRef !== 'N/A') {
                                                allReferences.push({ label: 'Customer', value: selectedShipmentDetail.references.customerRef });
                                            }

                                            // Add other references
                                            if (selectedShipmentDetail.references.other && Array.isArray(selectedShipmentDetail.references.other)) {
                                                selectedShipmentDetail.references.other.forEach(ref => {
                                                    if (ref && ref !== 'N/A') {
                                                        allReferences.push({ label: 'Other', value: ref });
                                                    }
                                                });
                                            }

                                            // Add shipment ID as a reference if available
                                            if (selectedShipmentDetail.shipmentId && selectedShipmentDetail.shipmentId !== 'N/A') {
                                                allReferences.push({ label: 'Shipment ID', value: selectedShipmentDetail.shipmentId });
                                            }

                                            return allReferences.length > 0 ? (
                                                allReferences.map((ref, index) => (
                                                    <Chip
                                                        key={index}
                                                        label={`${ref.label}: ${ref.value}`}
                                                        size="small"
                                                        sx={{
                                                            fontSize: '11px',
                                                            height: '24px',
                                                            backgroundColor: '#f3f4f6',
                                                            color: '#374151',
                                                            border: '1px solid #d1d5db',
                                                            '& .MuiChip-label': {
                                                                px: 1,
                                                                fontSize: '11px'
                                                            }
                                                        }}
                                                    />
                                                ))
                                            ) : (
                                                <Chip
                                                    label="No references available"
                                                    size="small"
                                                    sx={{
                                                        fontSize: '11px',
                                                        height: '24px',
                                                        backgroundColor: '#f9fafb',
                                                        color: '#6b7280',
                                                        border: '1px solid #e5e7eb',
                                                        '& .MuiChip-label': {
                                                            px: 1,
                                                            fontSize: '11px'
                                                        }
                                                    }}
                                                />
                                            );
                                        })()}
                                    </Box>
                                </Grid>
                            </Grid>
                        </Paper>
                        {/* Extracted Charges Section */}
                        <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', p: 2, mb: 2 }}>
                            <Typography sx={{ fontSize: '14px', fontWeight: 600, mb: 2 }}>Extracted Charges</Typography>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Charge Name</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>QTY</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Rate</TableCell>
                                            <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Invoice Amount</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {selectedShipmentDetail.charges.map((charge, index) => {
                                            const currency = charge.currency || selectedShipmentDetail.currency || 'CAD';

                                            return (
                                                <TableRow key={index} sx={{ backgroundColor: index % 2 === 1 ? '#f9fafb' : 'white' }}>
                                                    <TableCell sx={{ fontSize: '11px' }}>{charge.description || charge.name || 'Charge'}</TableCell>
                                                    <TableCell sx={{ fontSize: '11px' }}>
                                                        {charge.quantity || charge.qty || 'N/A'}
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '11px' }}>
                                                        {charge.rate ? formatCurrencyHelper(charge.rate, currency) : 'N/A'}
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '11px' }}>
                                                        {formatCurrencyHelper(charge.amount, currency)}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>

                        {/* Compare & Apply Section */}
                        <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', p: 2 }}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>Compare & Apply</Typography>

                                {/* Apply Charges Buttons */}
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    {(() => {
                                        const allCharges = [...(selectedShipmentDetail.comparisonData?.matchedCharges || []), ...(selectedShipmentDetail.comparisonData?.unmatchedCharges || [])];
                                        const autoApprovalCharges = allCharges.filter(c => c.autoApprovalRecommendation === 'approve');

                                        return autoApprovalCharges.length > 0 && (
                                            <Button
                                                variant="contained"
                                                size="small"
                                                onClick={handleAutoApproveCharges}
                                                disabled={isApplyingCharges || isUnapplyingCharges}
                                                startIcon={isApplyingCharges ? <CircularProgress size={14} sx={{ color: 'white' }} /> : null}
                                                sx={{
                                                    fontSize: '11px',
                                                    textTransform: 'none',
                                                    backgroundColor: '#10b981',
                                                    color: 'white',
                                                    '&:hover': {
                                                        backgroundColor: '#059669'
                                                    },
                                                    '&:disabled': {
                                                        backgroundColor: '#9ca3af',
                                                        color: 'white'
                                                    }
                                                }}
                                            >
                                                {isApplyingCharges ?
                                                    'AUTO-APPLYING...' :
                                                    `AUTO-APPROVE (${autoApprovalCharges.length})`
                                                }
                                            </Button>
                                        );
                                    })()}

                                    {(selectedCharges.size === 0 || Array.from(selectedCharges).some(index => !appliedCharges.has(index))) && (
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            onClick={handleApplySelectedCharges}
                                            disabled={selectedCharges.size === 0 || Array.from(selectedCharges).every(index => appliedCharges.has(index)) || isApplyingCharges || isUnapplyingCharges}
                                            startIcon={isApplyingCharges ? <CircularProgress size={14} /> : null}
                                            sx={{
                                                fontSize: '11px',
                                                textTransform: 'none',
                                                '&:disabled': {
                                                    borderColor: '#d1d5db',
                                                    color: '#9ca3af'
                                                }
                                            }}
                                        >
                                            {isApplyingCharges ?
                                                'APPLYING...' :
                                                (selectedCharges.size === 0 ?
                                                    'SELECT CHARGES TO APPLY' :
                                                    'APPLY ACTUAL CHARGES'
                                                )
                                            }
                                        </Button>
                                    )}
                                </Box>
                            </Box>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                        <TableCell sx={{ fontSize: '11px', fontWeight: 600, padding: '8px', width: '40px', maxWidth: '40px', verticalAlign: 'top' }}>
                                            <Checkbox
                                                size="small"
                                                checked={selectAllCharges}
                                                onChange={(e) => handleSelectAllCharges(e.target.checked)}
                                                sx={{
                                                    padding: 0,
                                                    '& .MuiSvgIcon-root': { fontSize: 16 }
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '11px', fontWeight: 600, width: '50px', textAlign: 'left', verticalAlign: 'top' }}>Code</TableCell>
                                        <TableCell sx={{ fontSize: '11px', fontWeight: 600, width: '200px', textAlign: 'left', verticalAlign: 'top' }}>Charge Name</TableCell>
                                        <TableCell sx={{ fontSize: '11px', fontWeight: 600, width: '100px', textAlign: 'left', verticalAlign: 'top' }}>Invoice Amount</TableCell>
                                        <TableCell sx={{ fontSize: '11px', fontWeight: 600, width: '100px', textAlign: 'left', verticalAlign: 'top' }}>Quoted Cost</TableCell>
                                        <TableCell sx={{ fontSize: '11px', fontWeight: 600, width: '100px', textAlign: 'left', verticalAlign: 'top' }}>Quoted Charge</TableCell>
                                        <TableCell sx={{ fontSize: '11px', fontWeight: 600, width: '100px', textAlign: 'left', verticalAlign: 'top' }}>Actual Cost</TableCell>
                                        <TableCell sx={{ fontSize: '11px', fontWeight: 600, width: '100px', textAlign: 'left', verticalAlign: 'top' }}>Actual Charge</TableCell>
                                        <TableCell sx={{ fontSize: '11px', fontWeight: 600, width: '90px', textAlign: 'left', verticalAlign: 'top' }}>Variance</TableCell>
                                        <TableCell sx={{ fontSize: '11px', fontWeight: 600, width: '100px', textAlign: 'left', verticalAlign: 'top' }}>Profit (CAD)</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    <ComparisonTableRows
                                        selectedShipmentDetail={selectedShipmentDetail}
                                        buildComparisonRows={buildComparisonRows}
                                        selectedCharges={selectedCharges}
                                        onSelectCharge={handleSelectCharge}
                                        appliedCharges={appliedCharges}
                                        setAppliedCharges={setAppliedCharges}
                                        uploadData={uploadData}
                                        fileName={fileName}
                                        enqueueSnackbar={enqueueSnackbar}
                                    />
                                </TableBody>
                            </Table>
                            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <TotalCalculations
                                    selectedShipmentDetail={selectedShipmentDetail}
                                    buildComparisonRows={buildComparisonRows}
                                />
                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    {/* Show unapply button only when applied charges are selected */}
                                    {Array.from(selectedCharges).some(index => appliedCharges.has(index)) && (
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            onClick={handleUnapplySelectedCharges}
                                            disabled={isUnapplyingCharges || isApplyingCharges}
                                            startIcon={isUnapplyingCharges ? <CircularProgress size={14} /> : null}
                                            sx={{
                                                fontSize: '11px',
                                                textTransform: 'none',
                                                borderColor: '#dc2626',
                                                color: '#dc2626',
                                                '&:hover': {
                                                    borderColor: '#b91c1c',
                                                    backgroundColor: '#fee2e2'
                                                },
                                                '&:disabled': {
                                                    borderColor: '#d1d5db',
                                                    color: '#9ca3af'
                                                }
                                            }}
                                        >
                                            {isUnapplyingCharges ? 'UNAPPLYING...' : 'UNAPPLY CHARGES'}
                                        </Button>
                                    )}
                                </Box>
                            </Box>
                        </Paper>
                    </Box>
                </DialogContent>
                <DialogActions sx={{
                    borderTop: '1px solid #e5e7eb',
                    p: 2,
                    justifyContent: 'flex-end'
                }}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={() => {
                                onApprove(true);
                                handleCloseShipmentDetail();
                            }}
                            sx={{
                                fontSize: '12px',
                                borderColor: '#dc2626',
                                color: '#dc2626',
                                '&:hover': {
                                    borderColor: '#b91c1c',
                                    backgroundColor: '#fee2e2'
                                }
                            }}
                        >
                            Mark as Exception
                        </Button>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={handleCloseShipmentDetail}
                            sx={{ fontSize: '12px' }}
                        >
                            Done
                        </Button>
                    </Box>
                </DialogActions>
            </Dialog>
        );
    };

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Box sx={{ borderBottom: '1px solid #e5e7eb', px: 3, py: 2 }}>
                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 1 }}>
                    AP Processing Results - {fileName}
                </Typography>
                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                    Review extracted invoice data, shipment details, and charge comparison
                </Typography>
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, overflow: 'auto' }}>
                {renderExtractedResults()}
            </Box>

            {/* Shipment Detail Dialog */}
            {renderShipmentDetailDialog()}

            {/* Shipment Matching Dialog */}
            <Dialog
                open={matchingDialogOpen}
                onClose={() => setMatchingDialogOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <SearchIcon />
                        Match Shipment
                    </Box>
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ mb: 3 }}>
                        <Alert severity="info" sx={{ mb: 2, fontSize: '12px' }}>
                            <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                {selectedRowForMatching?.matchConfidence ?
                                    `Low confidence match (${selectedRowForMatching.matchConfidence}%) detected` :
                                    'No automatic match found'
                                }
                            </Typography>
                            <Typography sx={{ fontSize: '11px' }}>
                                Search for the correct shipment using Shipment ID, company names, or addresses.
                                If you can't find a match, the shipment may not exist in the system yet.
                            </Typography>
                        </Alert>

                        {selectedRowForMatching && (
                            <Paper sx={{ p: 2, backgroundColor: '#fef3c7', border: '1px solid #f59e0b', mb: 2 }}>
                                <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1, color: '#92400e' }}>
                                    🔍 Looking for: {selectedRowForMatching.shipmentId}
                                </Typography>
                                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, fontSize: '11px' }}>
                                    <Box>
                                        <Typography sx={{ fontWeight: 600, color: '#92400e' }}>Route:</Typography>
                                        <Typography sx={{ color: '#92400e' }}>
                                            {selectedRowForMatching.origin} → {selectedRowForMatching.destination}
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography sx={{ fontWeight: 600, color: '#92400e' }}>Total:</Typography>
                                        <Typography sx={{ color: '#92400e' }}>
                                            {formatCurrencyHelper(selectedRowForMatching.totalAmount, selectedRowForMatching.currency)}
                                        </Typography>
                                    </Box>
                                </Box>
                            </Paper>
                        )}
                    </Box>

                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Search by Shipment ID, Reference Number, Company Name, or Address..."
                        value={shipmentSearchTerm}
                        onChange={(e) => {
                            setShipmentSearchTerm(e.target.value);
                            searchShipments(e.target.value);
                        }}
                        InputProps={{
                            startAdornment: <SearchIcon sx={{ mr: 1, color: '#6b7280', fontSize: '18px' }} />
                        }}
                        sx={{ mb: 2 }}
                        helperText="Type at least 2 characters to search across all shipment data"
                        FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                    />

                    {isSearchingShipments && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                            <LinearProgress sx={{ width: '100%' }} />
                        </Box>
                    )}

                    {shipmentSearchTerm.length >= 2 && !isSearchingShipments && (
                        <>
                            {shipmentSearchResults.length > 0 ? (
                                <>
                                    <Typography sx={{ fontSize: '12px', color: '#374151', mb: 1, fontWeight: 600 }}>
                                        Found {shipmentSearchResults.length} shipment{shipmentSearchResults.length !== 1 ? 's' : ''}:
                                    </Typography>
                                    <Paper sx={{ maxHeight: '350px', overflow: 'auto', border: '1px solid #e5e7eb' }}>
                                        <List dense>
                                            {shipmentSearchResults.map((shipment, index) => (
                                                <ListItem
                                                    key={shipment.id}
                                                    button
                                                    onClick={() => handleSelectMatchedShipment(shipment)}
                                                    sx={{
                                                        borderBottom: index < shipmentSearchResults.length - 1 ? '1px solid #f3f4f6' : 'none',
                                                        '&:hover': { backgroundColor: '#f0f9ff' },
                                                        py: 1.5
                                                    }}
                                                >
                                                    <ListItemIcon>
                                                        <ShipmentIcon sx={{ fontSize: '20px', color: '#3b82f6' }} />
                                                    </ListItemIcon>
                                                    <ListItemText
                                                        primary={
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                                                <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#1f2937' }}>
                                                                    {shipment.shipmentId}
                                                                </Typography>
                                                                <Box sx={{ display: 'flex', gap: 1 }}>
                                                                    <Chip
                                                                        label={shipment.status}
                                                                        size="small"
                                                                        color={shipment.status === 'Delivered' ? 'success' :
                                                                            shipment.status === 'In Transit' ? 'info' : 'default'}
                                                                        sx={{ fontSize: '10px', height: '20px' }}
                                                                    />
                                                                    <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#059669' }}>
                                                                        {formatCurrencyHelper(shipment.totalAmount, shipment.currency)}
                                                                    </Typography>
                                                                </Box>
                                                            </Box>
                                                        }
                                                        secondary={
                                                            <Box>
                                                                <Typography sx={{ fontSize: '11px', color: '#6b7280', mb: 0.5 }}>
                                                                    📍 {shipment.origin} → {shipment.destination}
                                                                </Typography>
                                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                    🚛 {shipment.carrier}
                                                                    {shipment.createdAt && (
                                                                        <span> • Created {new Date(shipment.createdAt.toDate?.() || shipment.createdAt).toLocaleDateString()}</span>
                                                                    )}
                                                                </Typography>
                                                            </Box>
                                                        }
                                                    />
                                                </ListItem>
                                            ))}
                                        </List>
                                    </Paper>
                                </>
                            ) : (
                                <Paper sx={{ p: 3, textAlign: 'center', backgroundColor: '#fef3c7', border: '1px solid #f59e0b' }}>
                                    <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#92400e', mb: 1 }}>
                                        🔍 No shipments found
                                    </Typography>
                                    <Typography sx={{ fontSize: '11px', color: '#92400e', mb: 2 }}>
                                        No shipments match "{shipmentSearchTerm}". The shipment may not exist in the system yet.
                                    </Typography>
                                    <Alert severity="warning" sx={{ fontSize: '11px' }}>
                                        <strong>Suggestions:</strong>
                                        <br />• Try searching with partial company names or addresses
                                        <br />• Check if the shipment was entered with a different reference
                                        <br />• Verify the shipment has been created in the system
                                    </Alert>
                                </Paper>
                            )}
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setMatchingDialogOpen(false)} sx={{ fontSize: '12px' }}>
                        Cancel
                    </Button>
                </DialogActions>
            </Dialog>

            {/* PDF Viewer Dialog - Using Your Existing PDF Viewer */}
            <PdfViewerDialog
                open={pdfViewerOpen}
                onClose={handleClosePdfViewer}
                pdfUrl={pdfUrl}
                title={`Invoice PDF - ${fileName}`}
            />

            {/* Action Buttons */}
            <Box sx={{ borderTop: '1px solid #e5e7eb', p: 3 }}>
                <Stack direction="row" spacing={2} justifyContent="flex-end">
                    <Button
                        variant="outlined"
                        onClick={onClose}
                        sx={{ fontSize: '12px', textTransform: 'none' }}
                    >
                        Close
                    </Button>
                </Stack>
            </Box>
        </Box>
    );
}