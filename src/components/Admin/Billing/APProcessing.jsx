import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box,
    Grid,
    Paper,
    Typography,
    CircularProgress,
    Button,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Tooltip,
    Tabs,
    Tab,
    TextField,
    Stack,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Alert,
    Autocomplete,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Card,
    CardContent,
    Divider,
    LinearProgress,
    Badge,
    Menu,
    ListItemIcon,
    ListItemText,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Switch,
    FormControlLabel,
    Checkbox,
    FormHelperText,
    AlertTitle,
    Avatar
} from '@mui/material';
import {
    Upload as UploadIcon,
    FileUpload as FileIcon,
    Check as CheckIcon,
    Error as ErrorIcon,
    Autorenew as AutorenewIcon,
    Assignment as AssignmentIcon,
    GetApp as ExportIcon,
    Settings as SettingsIcon,
    Close as CloseIcon,
    ExpandMore as ExpandMoreIcon,
    Speed as SpeedIcon,
    Security as SecurityIcon,
    SmartToy as AiIcon,
    PictureAsPdf as PdfIcon,
    TableChart as TableIcon,
    Pending as PendingIcon,
    CloudDownload as GetAppIcon,
    CheckCircle as CheckCompleteIcon,
    Refresh as RefreshIcon,
    Visibility as ViewIcon,
    Download as DownloadIcon,
    LocalShipping as LocalShippingIcon
} from '@mui/icons-material';
import { useDropzone } from 'react-dropzone';
import { useSnackbar } from 'notistack';
import {
    collection,
    query,
    where,
    orderBy,
    limit,
    getDocs,
    doc,
    getDoc,
    updateDoc,
    deleteDoc,
    addDoc,
    serverTimestamp
} from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { httpsCallable, getFunctions } from 'firebase/functions';
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import AdminBreadcrumb from '../AdminBreadcrumb';
import EDIUploader from './EDIUploader';
import EDIResults from './EDIResults';

// PDF Results Table Component - Standardized across all carriers
const PdfResultsTable = ({ pdfResults, onClose, onViewShipmentDetail }) => {
    const [selectedRows, setSelectedRows] = useState([]);
    const [isExporting, setIsExporting] = useState(false);

    const normalizeDataForTable = (results) => {
        console.log('Normalizing data for table:', results);

        // Handle different data structures
        let shipments = [];
        let matchingResults = null;

        if (results.extractedData?.shipments) {
            shipments = results.extractedData.shipments;
        } else if (results.structuredData?.shipments) {
            shipments = results.structuredData.shipments;
        } else if (results.shipments) {
            shipments = results.shipments;
        } else if (Array.isArray(results.extractedData)) {
            shipments = results.extractedData;
        }

        // Extract matching results if available
        if (results.matchingResults) {
            matchingResults = results.matchingResults;
            console.log('Found matching results:', matchingResults.stats);
        }

        console.log('Found shipments:', shipments);

        if (!Array.isArray(shipments) || shipments.length === 0) {
            console.log('No shipment data found');
            return [];
        }

        return shipments.map((shipment, index) => {
            // Handle charges data
            let charges = [];
            let totalAmount = 0;

            if (shipment.charges && Array.isArray(shipment.charges)) {
                charges = shipment.charges;
                totalAmount = shipment.totalAmount || charges.reduce((sum, charge) => sum + (parseFloat(charge.amount) || 0), 0);
            } else if (shipment.totalAmount) {
                totalAmount = parseFloat(shipment.totalAmount) || 0;
                charges = [{
                    description: 'Total Amount',
                    amount: totalAmount,
                    currency: shipment.currency || 'CAD'
                }];
            }

            // Find corresponding match result
            let matchResult = null;
            if (matchingResults && matchingResults.matches) {
                matchResult = matchingResults.matches.find(match => {
                    return match.invoiceShipment === shipment ||
                        match.invoiceShipment?.trackingNumber === shipment.trackingNumber ||
                        match.invoiceShipment?.references?.customerRef === (shipment.references?.customerRef || shipment.shipmentId);
                });
            }

            return {
                id: shipment.id || `shipment-${index + 1}`,
                shipmentId: shipment.shipmentId || shipment.trackingNumber || `SHIP-${String(index + 1).padStart(3, '0')}`,
                trackingNumber: shipment.trackingNumber || 'N/A',
                carrier: shipment.carrier || pdfResults.carrier || 'Unknown',
                service: shipment.serviceType || shipment.service || 'Standard',
                shipDate: shipment.shipmentDate || shipment.shipDate || 'N/A',
                origin: formatAddress(shipment.from),
                destination: formatAddress(shipment.to),
                weight: typeof shipment.weight === 'object' && shipment.weight ?
                    `${shipment.weight.value || ''} ${shipment.weight.unit || ''}`.trim() :
                    shipment.weight || '',
                dimensions: formatDimensions(shipment.dimensions),
                charges: normalizeCharges(charges),
                totalAmount: totalAmount,
                currency: shipment.currency || 'CAD',
                references: shipment.references || {},
                specialServices: shipment.specialServices || [],
                // Store the original shipment data for detailed view
                originalData: shipment,
                // Include matching information
                matchResult: matchResult
            };
        });
    };

    const formatAddress = (address) => {
        if (!address) return 'N/A';

        const parts = [];
        if (address.company) parts.push(address.company);
        if (address.city) parts.push(address.city);
        if (address.province || address.state) parts.push(address.province || address.state);
        if (address.country) parts.push(address.country);

        return parts.length > 0 ? parts.join(', ') : 'N/A';
    };

    const formatDimensions = (dimensions) => {
        if (!dimensions) return '';

        const { length, width, height, unit } = dimensions;
        if (length && width && height) {
            return `${length}×${width}×${height} ${unit || 'in'}`;
        }
        return '';
    };

    const normalizeCharges = (charges) => {
        if (!Array.isArray(charges)) return [];

        return charges.map(charge => ({
            name: charge.description || charge.name || 'Unknown Charge',
            amount: parseFloat(charge.amount) || 0,
            currency: charge.currency || 'CAD'
        }));
    };

    const calculateTotal = (charges) => {
        return charges.reduce((sum, charge) => sum + charge.amount, 0);
    };

    // Render match status with appropriate styling
    const renderMatchStatus = (row) => {
        if (!row.matchResult) {
            return (
                <Chip
                    label="No Match"
                    size="small"
                    color="default"
                    sx={{ fontSize: '10px', backgroundColor: '#f3f4f6', color: '#6b7280' }}
                />
            );
        }

        const { confidence, status, matches, reviewRequired } = row.matchResult;

        // Determine chip color and icon based on status
        let chipColor = 'default';
        let backgroundColor = '#f3f4f6';
        let textColor = '#6b7280';
        let icon = null;

        if (status === 'EXCELLENT_MATCH') {
            chipColor = 'success';
            backgroundColor = '#dcfce7';
            textColor = '#166534';
            icon = <CheckCompleteIcon sx={{ fontSize: '12px' }} />;
        } else if (status === 'GOOD_MATCH') {
            chipColor = 'info';
            backgroundColor = '#dbeafe';
            textColor = '#1e40af';
            icon = <CheckIcon sx={{ fontSize: '12px' }} />;
        } else if (status === 'FAIR_MATCH') {
            chipColor = 'warning';
            backgroundColor = '#fef3c7';
            textColor = '#d97706';
            icon = <PendingIcon sx={{ fontSize: '12px' }} />;
        } else {
            chipColor = 'error';
            backgroundColor = '#fee2e2';
            textColor = '#dc2626';
            icon = <ErrorIcon sx={{ fontSize: '12px' }} />;
        }

        const confidencePercent = Math.round(confidence * 100);
        const matchCount = matches?.length || 0;

        return (
            <Box>
                <Chip
                    label={`${confidencePercent}%`}
                    size="small"
                    icon={icon}
                    sx={{
                        fontSize: '10px',
                        backgroundColor: backgroundColor,
                        color: textColor,
                        '& .MuiChip-icon': { color: textColor }
                    }}
                />
                {matchCount > 1 && (
                    <Typography variant="caption" sx={{ fontSize: '9px', color: '#6b7280', display: 'block', mt: 0.5 }}>
                        +{matchCount - 1} more
                    </Typography>
                )}
                {reviewRequired && (
                    <Typography variant="caption" sx={{ fontSize: '9px', color: '#dc2626', display: 'block' }}>
                        Review Required
                    </Typography>
                )}
            </Box>
        );
    };

    const formatCurrency = (amount, currency = 'CAD') => {
        const numAmount = parseFloat(amount) || 0;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency === 'USD' ? 'USD' : 'CAD'
        }).format(numAmount);
    };

    const handleSelectAll = (event) => {
        if (event.target.checked) {
            setSelectedRows(tableData.map(row => row.id));
        } else {
            setSelectedRows([]);
        }
    };

    const handleSelectRow = (id) => {
        setSelectedRows(prev => {
            if (prev.includes(id)) {
                return prev.filter(rowId => rowId !== id);
            } else {
                return [...prev, id];
            }
        });
    };

    // Enhanced CSV export with full shipment and charge details
    const exportToCSV = () => {
        setIsExporting(true);

        try {
            const dataToExport = selectedRows.length > 0
                ? tableData.filter(row => selectedRows.includes(row.id))
                : tableData;

            // Create comprehensive CSV with all data
            const headers = [
                'Shipment ID',
                'Tracking Number',
                'Carrier',
                'Service Type',
                'Ship Date',
                'Weight',
                'Dimensions',
                'Origin Company',
                'Origin City',
                'Origin Province/State',
                'Origin Country',
                'Destination Company',
                'Destination City',
                'Destination Province/State',
                'Destination Country',
                'Charge Descriptions',
                'Charge Amounts',
                'Individual Charges Detail',
                'Total Amount',
                'Currency',
                'Customer Reference',
                'Invoice Reference',
                'Special Services',
                'References (Other)'
            ];

            const rows = dataToExport.map(row => {
                // Format charges for CSV
                const chargeDescriptions = row.charges.map(c => c.name).join('; ');
                const chargeAmounts = row.charges.map(c => formatCurrency(c.amount, c.currency)).join('; ');
                const chargesDetail = row.charges.map(c => `${c.name}: ${formatCurrency(c.amount, c.currency)}`).join(' | ');

                // Parse address information
                const origin = row.originalData?.from || {};
                const destination = row.originalData?.to || {};

                return [
                    row.shipmentId,
                    row.trackingNumber,
                    row.carrier,
                    row.service,
                    row.shipDate,
                    row.weight,
                    row.dimensions,
                    origin.company || '',
                    origin.city || '',
                    origin.province || origin.state || '',
                    origin.country || '',
                    destination.company || '',
                    destination.city || '',
                    destination.province || destination.state || '',
                    destination.country || '',
                    chargeDescriptions,
                    chargeAmounts,
                    chargesDetail,
                    formatCurrency(row.totalAmount, row.currency),
                    row.currency,
                    row.references.customerRef || '',
                    row.references.invoiceRef || '',
                    (row.specialServices || []).join('; '),
                    (row.references.other || []).join('; ')
                ];
            });

            // Create CSV content
            const csvContent = [headers, ...rows]
                .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
                .join('\n');

            // Download CSV
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `pdf-extraction-results-${pdfResults.fileName || 'export'}-${new Date().toISOString().split('T')[0]}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        } catch (error) {
            console.error('CSV export failed:', error);
        } finally {
            setIsExporting(false);
        }
    };

    const tableData = normalizeDataForTable(pdfResults);

    if (tableData.length === 0) {
        return (
            <Box sx={{ textAlign: 'center', py: 4 }}>
                <AssignmentIcon sx={{ fontSize: 48, color: '#9ca3af', mb: 2 }} />
                <Typography variant="h6" sx={{ mb: 2, fontSize: '16px', fontWeight: 600 }}>
                    No shipment data found
                </Typography>
                <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                    The PDF processing completed but no structured shipment data was extracted.
                </Typography>
                <Button
                    variant="outlined"
                    onClick={onClose}
                    sx={{ fontSize: '12px' }}
                >
                    Back to Overview
                </Button>
            </Box>
        );
    }

    return (
        <Box>
            {/* Header with PDF Link and Export Options */}
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                        Extracted Results ({tableData.length} shipments)
                    </Typography>

                    {/* PDF Link */}
                    {pdfResults.downloadURL && (
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<PdfIcon />}
                            onClick={() => window.open(pdfResults.downloadURL, '_blank')}
                            sx={{ fontSize: '11px' }}
                        >
                            View Original PDF
                        </Button>
                    )}
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                    {/* CSV Export Button */}
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={isExporting ? <CircularProgress size={14} /> : <GetAppIcon />}
                        onClick={exportToCSV}
                        disabled={isExporting}
                        sx={{ fontSize: '11px' }}
                    >
                        {isExporting ? 'Exporting...' : `Export CSV${selectedRows.length > 0 ? ` (${selectedRows.length})` : ''}`}
                    </Button>

                    <Button
                        variant="outlined"
                        size="small"
                        onClick={onClose}
                        sx={{ fontSize: '11px' }}
                    >
                        Back to Overview
                    </Button>
                </Box>
            </Box>

            {/* Selection Info */}
            {selectedRows.length > 0 && (
                <Alert severity="info" sx={{ mb: 2, fontSize: '12px' }}>
                    {selectedRows.length} of {tableData.length} shipments selected for export
                </Alert>
            )}

            {/* Results Table */}
            <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                            <TableCell padding="checkbox">
                                <Checkbox
                                    indeterminate={selectedRows.length > 0 && selectedRows.length < tableData.length}
                                    checked={tableData.length > 0 && selectedRows.length === tableData.length}
                                    onChange={handleSelectAll}
                                    size="small"
                                />
                            </TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Shipment ID</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Tracking</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Carrier</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Service</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Ship Date</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Weight & Dimensions</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Origin</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Destination</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Charges</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Total</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Match Status</TableCell>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {tableData.map((row) => (
                            <TableRow key={row.id} hover sx={{ '&:hover': { backgroundColor: '#f9fafb' } }}>
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        checked={selectedRows.includes(row.id)}
                                        onChange={() => handleSelectRow(row.id)}
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>{row.shipmentId}</TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>{row.trackingNumber}</TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>{row.carrier}</TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>{row.service}</TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>{row.shipDate}</TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Box>
                                        {row.weight && (
                                            <Typography variant="body2" sx={{ fontSize: '11px' }}>
                                                {typeof row.weight === 'string' ? row.weight : JSON.stringify(row.weight)}
                                            </Typography>
                                        )}
                                        {row.dimensions && (
                                            <Typography variant="caption" sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                {row.dimensions}
                                            </Typography>
                                        )}
                                    </Box>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px', maxWidth: 150 }}>
                                    <Typography variant="body2" sx={{ fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {row.origin}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px', maxWidth: 150 }}>
                                    <Typography variant="body2" sx={{ fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {row.destination}
                                    </Typography>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    {row.charges.length > 0 ? (
                                        <Box>
                                            {row.charges.slice(0, 2).map((charge, index) => (
                                                <Typography key={index} variant="caption" sx={{ fontSize: '10px', display: 'block' }}>
                                                    {charge.name}: {formatCurrency(charge.amount, charge.currency)}
                                                </Typography>
                                            ))}
                                            {row.charges.length > 2 && (
                                                <Typography variant="caption" sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                    +{row.charges.length - 2} more...
                                                </Typography>
                                            )}
                                        </Box>
                                    ) : (
                                        <Typography variant="caption" sx={{ fontSize: '10px', color: '#6b7280' }}>
                                            No charges
                                        </Typography>
                                    )}
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#059669' }}>
                                    {formatCurrency(row.totalAmount, row.currency)}
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    {renderMatchStatus(row)}
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px' }}>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        onClick={() => onViewShipmentDetail && onViewShipmentDetail(row)}
                                        sx={{ fontSize: '11px' }}
                                    >
                                        View Details
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Summary */}
            <Box sx={{ mt: 2, p: 2, backgroundColor: '#f9fafb', borderRadius: 1 }}>
                <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                    Summary
                </Typography>
                <Grid container spacing={2}>
                    <Grid item xs={12} md={3}>
                        <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280' }}>
                            Total Shipments: <strong>{tableData.length}</strong>
                        </Typography>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280' }}>
                            Total Amount: <strong>{formatCurrency(tableData.reduce((sum, row) => sum + row.totalAmount, 0))}</strong>
                        </Typography>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280' }}>
                            Carriers: <strong>{[...new Set(tableData.map(row => row.carrier))].join(', ')}</strong>
                        </Typography>
                    </Grid>
                    <Grid item xs={12} md={3}>
                        {pdfResults.matchingResults ? (
                            <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                Matches: <strong style={{ color: '#059669' }}>{pdfResults.matchingResults.stats?.autoApplicable || 0}</strong> auto,
                                <strong style={{ color: '#d97706' }}> {pdfResults.matchingResults.stats?.requireReview || 0}</strong> review
                            </Typography>
                        ) : (
                            <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                Matching: <strong>Not performed</strong>
                            </Typography>
                        )}
                    </Grid>
                </Grid>

                {/* Matching Statistics */}
                {pdfResults.matchingResults && (
                    <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid #e5e7eb' }}>
                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                            Matching Results
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={6} md={2}>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 700, color: '#059669' }}>
                                        {pdfResults.matchingResults.stats?.excellentMatches || 0}
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontSize: '10px', color: '#6b7280' }}>
                                        Excellent
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={6} md={2}>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 700, color: '#2563eb' }}>
                                        {pdfResults.matchingResults.stats?.goodMatches || 0}
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontSize: '10px', color: '#6b7280' }}>
                                        Good
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={6} md={2}>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 700, color: '#d97706' }}>
                                        {pdfResults.matchingResults.stats?.fairMatches || 0}
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontSize: '10px', color: '#6b7280' }}>
                                        Fair
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={6} md={2}>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 700, color: '#dc2626' }}>
                                        {pdfResults.matchingResults.stats?.poorMatches || 0}
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontSize: '10px', color: '#6b7280' }}>
                                        Poor
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={6} md={2}>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 700, color: '#6b7280' }}>
                                        {pdfResults.matchingResults.stats?.noMatches || 0}
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontSize: '10px', color: '#6b7280' }}>
                                        No Match
                                    </Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={6} md={2}>
                                <Box sx={{ textAlign: 'center' }}>
                                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 700, color: '#7c3aed' }}>
                                        {Math.round((pdfResults.matchingResults.metadata?.matchingStats?.averageConfidence || 0) * 100)}%
                                    </Typography>
                                    <Typography variant="caption" sx={{ fontSize: '10px', color: '#6b7280' }}>
                                        Avg Score
                                    </Typography>
                                </Box>
                            </Grid>
                        </Grid>
                    </Box>
                )}
            </Box>
        </Box>
    );
};

const APProcessing = () => {
    const { currentUser } = useAuth();
    const { enqueueSnackbar } = useSnackbar();
    const functions = getFunctions();
    const storage = getStorage();
    const fileInputRef = useRef(null);

    // State Management
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [uploads, setUploads] = useState([]);
    const [filteredUploads, setFilteredUploads] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [carrierFilter, setCarrierFilter] = useState('all');
    const [uploadDialog, setUploadDialog] = useState(false);
    const [processingDialog, setProcessingDialog] = useState(false);
    const [selectedUpload, setSelectedUpload] = useState(null);
    const [processingJob, setProcessingJob] = useState(null);
    const [pdfParsingSettings, setPdfParsingSettings] = useState({
        autoExtract: true,
        ocrEnabled: true,
        tableDetection: true,
        structuredOutput: true,
        carrierTemplates: true,
        useMultiModalAnalysis: true,  // Phase 2A: Enable multi-modal analysis
        aiVisionEnabled: true,        // Visual layout analysis
        logoDetectionEnabled: true,   // Carrier logo detection
        tableIntelligenceEnabled: true // Advanced table parsing
    });
    const [anchorEl, setAnchorEl] = useState(null);
    const [settingsDialog, setSettingsDialog] = useState(false);
    const [showEdiResults, setShowEdiResults] = useState(false);
    const [showPdfResults, setShowPdfResults] = useState(false);
    const [processingFiles, setProcessingFiles] = useState([]);
    const [selectedCarrier, setSelectedCarrier] = useState('auto-detect'); // Default to AI auto-detection
    const [shipmentDetailDialog, setShipmentDetailDialog] = useState(false);
    const [selectedShipmentDetail, setSelectedShipmentDetail] = useState(null);

    // Debug: Log carrier state changes
    useEffect(() => {
        console.log('selectedCarrier state changed to:', selectedCarrier);
    }, [selectedCarrier]);

    // Upload Statistics
    const [stats, setStats] = useState({
        totalUploads: 0,
        completedUploads: 0,
        failedUploads: 0,
        pendingUploads: 0,
        totalRecords: 0,
        processingTime: 0
    });

    // Carrier templates for PDF parsing - Enhanced with additional carriers and auto-detection
    const carrierTemplates = [
        {
            id: 'auto-detect',
            name: '🧠 Multi-Modal AI Detection',
            supported: true,
            confidence: 0.98,
            formats: ['invoice', 'bol', 'confirmation', 'multi-document'],
            features: ['ai-vision', 'logo-detection', 'table-intelligence', 'layout-analysis', 'multi-modal'],
            description: 'Phase 2A: Enhanced AI with visual + text analysis, logo detection, and intelligent table parsing',
            icon: '🎯',
            intelligent: true,
            multiModal: true
        },
        {
            id: 'purolator',
            name: 'Purolator',
            supported: true,
            confidence: 0.95,
            formats: ['invoice', 'bol'],
            features: ['tracking', 'addresses', 'charges', 'references']
        },
        {
            id: 'canadapost',
            name: 'Canada Post',
            supported: true,
            confidence: 0.92,
            formats: ['bol', 'receipt'],
            features: ['tracking', 'addresses', 'charges']
        },
        {
            id: 'fedex',
            name: 'FedEx',
            supported: true,
            confidence: 0.90,
            formats: ['invoice', 'bol'],
            features: ['tracking', 'addresses', 'charges', 'zones']
        },
        {
            id: 'ups',
            name: 'UPS',
            supported: true,
            confidence: 0.88,
            formats: ['invoice', 'bol'],
            features: ['tracking', 'addresses', 'charges', 'zones']
        },
        {
            id: 'canpar',
            name: 'Canpar',
            supported: true,
            confidence: 0.85,
            formats: ['invoice'],
            features: ['tracking', 'addresses', 'charges']
        },
        {
            id: 'dhl',
            name: 'DHL',
            supported: true,
            confidence: 0.87,
            formats: ['invoice', 'bol'],
            features: ['tracking', 'addresses', 'charges', 'international']
        },
        {
            id: 'tnt',
            name: 'TNT',
            supported: true,
            confidence: 0.84,
            formats: ['invoice'],
            features: ['tracking', 'addresses', 'charges']
        },
        {
            id: 'landliner',
            name: 'Landliner Inc',
            supported: true,
            confidence: 0.92,
            formats: ['invoice', 'bol', 'confirmation'],
            features: ['tracking', 'addresses', 'charges', 'adaptive-documents', 'system-integration'],
            description: 'Freight carrier with flexible document support (1-3 pages) and ProTransport integration',
            logoURL: '/images/carriers/landliner-logo.png',
            patterns: ['ICAL-', 'ProTransport Trucking Software', 'Landliner Inc'],
            referenceFormat: 'ICAL-XXXXXX'
        },
        {
            id: 'dayross',
            name: 'Day & Ross',
            supported: false,
            confidence: 0.0,
            formats: ['invoice'],
            features: ['tracking', 'addresses']
        },
        {
            id: 'vitran',
            name: 'Vitran Express',
            supported: false,
            confidence: 0.0,
            formats: ['bol'],
            features: ['tracking', 'addresses']
        }
    ];

    useEffect(() => {
        loadUploads();
        loadSettings();
    }, []);

    useEffect(() => {
        filterUploads();
    }, [uploads, searchTerm, statusFilter, typeFilter, carrierFilter]);

    const loadUploads = async () => {
        try {
            setLoading(true);

            // Load EDI uploads with error handling
            let ediSnapshot = { docs: [] };
            try {
                const ediQuery = query(
                    collection(db, 'ediUploads'),
                    orderBy('uploadDate', 'desc'),
                    limit(100)
                );
                ediSnapshot = await getDocs(ediQuery);
            } catch (error) {
                console.warn('EDI uploads collection not found or error accessing:', error.message);
            }

            // Load PDF uploads (when collection exists)
            let pdfSnapshot = { docs: [] };
            try {
                const pdfQuery = query(
                    collection(db, 'pdfUploads'),
                    orderBy('uploadDate', 'desc'),
                    limit(100)
                );
                pdfSnapshot = await getDocs(pdfQuery);
            } catch (error) {
                // PDF uploads collection might not exist yet
                console.warn('PDF uploads collection not found:', error.message);
            }

            const allUploads = [
                ...ediSnapshot.docs.map(doc => ({
                    id: doc.id,
                    type: 'edi',
                    ...doc.data()
                })),
                ...pdfSnapshot.docs.map(doc => ({
                    id: doc.id,
                    type: 'pdf',
                    ...doc.data()
                }))
            ].sort((a, b) => {
                const aDate = a.uploadDate?.toDate() || new Date(0);
                const bDate = b.uploadDate?.toDate() || new Date(0);
                return bDate - aDate;
            });

            setUploads(allUploads);
            calculateStats(allUploads);
        } catch (error) {
            console.error('Error loading uploads:', error);
            enqueueSnackbar('Failed to load AP uploads', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const loadSettings = async () => {
        try {
            const settingsDoc = await getDoc(doc(db, 'systemSettings', 'apProcessing'));
            if (settingsDoc.exists()) {
                setPdfParsingSettings(prev => ({
                    ...prev,
                    ...settingsDoc.data()
                }));
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    };

    const calculateStats = (uploads) => {
        const stats = uploads.reduce((acc, upload) => {
            acc.totalUploads++;
            acc.totalRecords += upload.recordCount || 0;

            switch (upload.processingStatus) {
                case 'completed':
                    acc.completedUploads++;
                    break;
                case 'failed':
                case 'error':
                    acc.failedUploads++;
                    break;
                case 'processing':
                case 'queued':
                case 'pending':
                    acc.pendingUploads++;
                    break;
            }

            if (upload.processingTime) {
                acc.processingTime += upload.processingTime;
            }

            return acc;
        }, {
            totalUploads: 0,
            completedUploads: 0,
            failedUploads: 0,
            pendingUploads: 0,
            totalRecords: 0,
            processingTime: 0
        });

        setStats(stats);
    };

    const filterUploads = () => {
        let filtered = uploads;

        if (searchTerm) {
            filtered = filtered.filter(upload =>
                upload.fileName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                upload.carrier?.toLowerCase().includes(searchTerm.toLowerCase())
            );
        }

        if (statusFilter !== 'all') {
            filtered = filtered.filter(upload => upload.processingStatus === statusFilter);
        }

        if (typeFilter !== 'all') {
            filtered = filtered.filter(upload => upload.type === typeFilter);
        }

        if (carrierFilter !== 'all') {
            filtered = filtered.filter(upload => upload.carrier === carrierFilter);
        }

        setFilteredUploads(filtered);
    };

    // Single file upload handler using cloud function to bypass CORS
    const handleSingleFileUpload = async (file) => {
        // Check if it's a PDF and no carrier is selected (auto-detect is always valid)
        if (file.type === 'application/pdf' && (!selectedCarrier || selectedCarrier === '') && selectedCarrier !== 'auto-detect') {
            console.log('PDF upload blocked - selectedCarrier:', selectedCarrier, 'file type:', file.type);
            enqueueSnackbar('Please select a carrier or use Auto-Detect before uploading PDF files', { variant: 'warning' });
            return;
        }

        const fileId = `${Date.now()}_${file.name}`;

        try {
            // Add file to processing list
            setProcessingFiles(prev => [...prev, {
                id: fileId,
                name: file.name,
                status: 'uploading',
                progress: 0,
                type: file.type === 'application/pdf' ? 'pdf' : 'edi'
            }]);

            enqueueSnackbar('Uploading file...', { variant: 'info' });

            // Upload file using uploadFile cloud function
            const uploadFileFunc = httpsCallable(functions, 'uploadFile');
            const uploadResult = await uploadFileFunc({
                fileName: file.name,
                fileType: file.type,
                fileSize: file.size
            });

            if (!uploadResult.data.success) {
                throw new Error(uploadResult.data.error || 'Upload failed');
            }

            // Get the signed URL and upload the file
            const { uploadUrl, downloadURL } = uploadResult.data;

            // Upload file to Cloud Storage using signed URL
            const uploadResponse = await fetch(uploadUrl, {
                method: 'PUT',
                body: file,
                headers: {
                    'Content-Type': file.type,
                },
            });

            if (!uploadResponse.ok) {
                throw new Error('Failed to upload file to storage');
            }

            console.log('File uploaded successfully:', downloadURL);

            // Update status to uploaded
            setProcessingFiles(prev => prev.map(f =>
                f.id === fileId
                    ? { ...f, status: 'uploaded', progress: 100 }
                    : f
            ));

            // For PDF files, start background processing and return immediately
            if (file.type === 'application/pdf') {
                // Update status to processing
                setProcessingFiles(prev => prev.map(f =>
                    f.id === fileId
                        ? { ...f, status: 'processing' }
                        : f
                ));

                // Start background PDF processing (no await - fire and forget)
                startBackgroundPdfProcessing(file.name, downloadURL, selectedCarrier, fileId);

                enqueueSnackbar(
                    `PDF uploaded successfully. Processing started in background for ${file.name}`,
                    { variant: 'success' }
                );
            } else {
                // Process EDI files immediately
                await processEdiFile(file.name, downloadURL);

                // Update status to completed
                setProcessingFiles(prev => prev.map(f =>
                    f.id === fileId
                        ? { ...f, status: 'completed' }
                        : f
                ));
            }

            enqueueSnackbar('File processed successfully', { variant: 'success' });
            loadUploads();

            // Remove from processing list after 3 seconds
            setTimeout(() => {
                setProcessingFiles(prev => prev.filter(f => f.id !== fileId));
            }, 3000);

            // Clear carrier selection after successful processing
            if (file.type === 'application/pdf') {
                setSelectedCarrier('');
            }

        } catch (error) {
            console.error('Upload error:', error);
            enqueueSnackbar(`Upload failed: ${error.message}`, { variant: 'error' });

            // Update status to failed
            setProcessingFiles(prev => prev.map(f =>
                f.id === fileId
                    ? { ...f, status: 'failed' }
                    : f
            ));

            // Remove failed file from list after 5 seconds
            setTimeout(() => {
                setProcessingFiles(prev => prev.filter(f => f.id !== fileId));
            }, 5000);
        }
    };

    // Background PDF processing function (fire and forget)
    const startBackgroundPdfProcessing = async (fileName, uploadUrl, carrier, fileId) => {
        try {
            // Call the cloud function but don't wait for it
            const processPdfFileFunc = httpsCallable(functions, 'processPdfFile', {
                timeout: 540000  // 9 minutes to match cloud function timeout
            });

            // This runs in the background - we don't await it
            processPdfFileFunc({
                fileName,
                uploadUrl,
                carrier,
                settings: {
                    ...pdfParsingSettings,
                    includeRawText: false
                }
            }).then((result) => {
                // Success callback
                if (result.data.success) {
                    console.log(`Background processing completed for ${fileName}: ${result.data.recordCount} records extracted`);

                    // Update processing status to completed
                    setProcessingFiles(prev => prev.map(f =>
                        f.id === fileId
                            ? { ...f, status: 'completed', recordCount: result.data.recordCount }
                            : f
                    ));

                    // Show success notification
                    enqueueSnackbar(
                        `Background processing completed: ${result.data.recordCount} records extracted from ${fileName}`,
                        { variant: 'success' }
                    );

                    // Refresh the uploads list
                    loadUploads();
                }
            }).catch((error) => {
                // Error callback
                console.error(`Background processing failed for ${fileName}:`, error);

                // Update processing status to failed
                setProcessingFiles(prev => prev.map(f =>
                    f.id === fileId
                        ? { ...f, status: 'failed', error: error.message }
                        : f
                ));

                // Show error notification
                enqueueSnackbar(
                    `Background processing failed for ${fileName}: ${error.message}`,
                    { variant: 'error' }
                );
            });

        } catch (error) {
            console.error('Failed to start background processing:', error);

            // Update status to failed
            setProcessingFiles(prev => prev.map(f =>
                f.id === fileId
                    ? { ...f, status: 'failed', error: error.message }
                    : f
            ));
        }
    };

    // Enhanced batch file upload handler using cloud function
    const handleBatchFileUpload = async (files) => {
        const batchId = `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        enqueueSnackbar(`Starting batch processing for ${files.length} files...`, { variant: 'info' });

        try {
            // Upload all files using cloud function
            const fileUploads = await Promise.all(
                files.map(async (file) => {
                    try {
                        // Check file size (50MB limit)
                        const maxSize = 50 * 1024 * 1024; // 50MB
                        if (file.size > maxSize) {
                            throw new Error(`File ${file.name} exceeds 50MB limit`);
                        }

                        // Convert file to base64 using FileReader to avoid stack overflow
                        const base64Data = await new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onload = () => {
                                // Remove the data URL prefix (data:application/pdf;base64,)
                                const base64 = reader.result.split(',')[1];
                                resolve(base64);
                            };
                            reader.onerror = () => reject(new Error(`Failed to read file ${file.name}`));
                            reader.readAsDataURL(file);
                        });

                        // Use cloud function to upload
                        const uploadFileBase64 = httpsCallable(functions, 'uploadFileBase64');
                        const uploadResult = await uploadFileBase64({
                            fileName: file.name,
                            fileData: base64Data,
                            fileType: file.type,
                            fileSize: file.size
                        });

                        if (uploadResult.data.success) {
                            return {
                                fileName: file.name,
                                uploadUrl: uploadResult.data.downloadURL,
                                fileType: file.type
                            };
                        } else {
                            throw new Error('Upload failed for ' + file.name);
                        }
                    } catch (error) {
                        console.error(`Failed to upload ${file.name}:`, error);
                        throw error;
                    }
                })
            );

            // Process PDF files in batch
            const pdfFiles = fileUploads.filter(f => f.fileType === 'application/pdf');
            const ediFiles = fileUploads.filter(f => f.fileType !== 'application/pdf');

            if (pdfFiles.length > 0) {
                // For batch PDF processing, we'll process each with "unknown" carrier
                // In a real implementation, you might want to show a dialog for each file
                // or have a bulk carrier selection UI
                const processPdfBatch = httpsCallable(functions, 'processPdfBatch', {
                    timeout: 540000  // 9 minutes to match cloud function timeout
                });
                const batchResult = await processPdfBatch({
                    files: pdfFiles,
                    carrier: 'unknown', // Default to unknown for batch processing
                    settings: pdfParsingSettings
                });

                if (batchResult.data.success) {
                    enqueueSnackbar(
                        `Batch processing completed: ${batchResult.data.successful}/${batchResult.data.totalFiles} files processed successfully`,
                        { variant: 'success' }
                    );
                }
            }

            // Process EDI files individually
            for (const ediFile of ediFiles) {
                await processEdiFile(ediFile.fileName, ediFile.uploadUrl);
            }

            loadUploads();

        } catch (error) {
            console.error('Batch processing error:', error);
            enqueueSnackbar(`Batch processing failed: ${error.message}`, { variant: 'error' });
        }
    };

    // Enhanced PDF processing function
    const processPdfFile = async (fileName, uploadUrl, carrier = null) => {
        console.log('processPdfFile called with carrier:', carrier, 'selectedCarrier state:', selectedCarrier);
        try {
            const processPdfFileFunc = httpsCallable(functions, 'processPdfFile', {
                timeout: 540000  // 9 minutes to match cloud function timeout
            });
            const result = await processPdfFileFunc({
                fileName,
                uploadUrl,
                carrier: carrier || selectedCarrier, // Use provided carrier or current selection
                settings: {
                    ...pdfParsingSettings,
                    includeRawText: false // Don't include raw text by default to reduce response size
                }
            });

            if (result.data.success) {
                enqueueSnackbar(
                    `PDF processed successfully: ${result.data.recordCount} records extracted from ${result.data.carrier}`,
                    { variant: 'success' }
                );
            }

            return result.data;
        } catch (error) {
            console.error('PDF processing error:', error);
            throw error;
        }
    };



    // Enhanced export functionality
    const handleExportResults = async (upload, format = 'json') => {
        try {
            setLoading(true);

            const exportPdfResults = httpsCallable(functions, 'exportPdfResults');
            const result = await exportPdfResults({
                uploadId: upload.id,
                format
            });

            if (result.data.success) {
                // Create a temporary download link
                const link = document.createElement('a');
                link.href = result.data.downloadUrl;
                link.download = result.data.filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                enqueueSnackbar(`Export completed: ${result.data.filename}`, { variant: 'success' });
            }

        } catch (error) {
            console.error('Export error:', error);
            enqueueSnackbar(`Export failed: ${error.message}`, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Enhanced retry functionality
    const handleRetryProcessing = async (upload, newSettings = {}) => {
        try {
            setLoading(true);

            const retryPdfProcessing = httpsCallable(functions, 'retryPdfProcessing', {
                timeout: 540000  // 9 minutes to match cloud function timeout
            });
            const result = await retryPdfProcessing({
                uploadId: upload.id,
                newSettings: {
                    ...pdfParsingSettings,
                    ...newSettings,
                    ocrEnabled: true, // Force OCR on retry
                    tableDetection: true // Force table detection on retry
                }
            });

            if (result.data.success) {
                enqueueSnackbar('Processing restarted successfully', { variant: 'success' });
                loadUploads();
            }

        } catch (error) {
            console.error('Retry error:', error);
            enqueueSnackbar(`Retry failed: ${error.message}`, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Process EDI files function
    const processEdiFile = async (fileName, uploadUrl) => {
        // Redirect to EDI tab for EDI files processing
        setActiveTab('edi');
        enqueueSnackbar('EDI file uploaded. Switch to EDI Processing tab to continue.', { variant: 'info' });
    };

    // Enhanced upload handling with batch processing
    const onDrop = useCallback(async (acceptedFiles) => {
        console.log('Files dropped:', acceptedFiles);
        console.log('Current selectedCarrier in onDrop:', selectedCarrier);

        if (acceptedFiles.length === 0) {
            enqueueSnackbar('No valid files selected', { variant: 'warning' });
            return;
        }

        try {
            setLoading(true);

            if (acceptedFiles.length === 1) {
                // Single file processing
                console.log('About to call handleSingleFileUpload with selectedCarrier:', selectedCarrier);
                await handleSingleFileUpload(acceptedFiles[0]);
            } else {
                // Batch processing for multiple files
                await handleBatchFileUpload(acceptedFiles);
            }

        } catch (error) {
            console.error('File processing error:', error);
            enqueueSnackbar(`Upload failed: ${error.message}`, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [enqueueSnackbar, selectedCarrier]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: {
            'text/csv': ['.csv'],
            'text/plain': ['.txt'],
            'application/pdf': ['.pdf']
        },
        multiple: true,
        maxSize: 50 * 1024 * 1024, // 50MB max file size
        onDropRejected: (fileRejections) => {
            fileRejections.forEach((rejection) => {
                const { file, errors } = rejection;
                const errorMessages = errors.map(e => e.message).join(', ');
                enqueueSnackbar(`File "${file.name}" rejected: ${errorMessages}`, { variant: 'error' });
            });
        }
    });

    const saveSettings = async () => {
        try {
            await updateDoc(doc(db, 'systemSettings', 'apProcessing'), pdfParsingSettings);
            enqueueSnackbar('Settings saved successfully', { variant: 'success' });
            setSettingsDialog(false);
        } catch (error) {
            enqueueSnackbar('Failed to save settings', { variant: 'error' });
        }
    };

    const getStatusChip = (status) => {
        const config = {
            completed: { color: 'success', icon: <CheckIcon />, label: 'Completed' },
            processing: { color: 'primary', icon: <AutorenewIcon />, label: 'Processing' },
            queued: { color: 'default', icon: <PendingIcon />, label: 'Queued' },
            failed: { color: 'error', icon: <ErrorIcon />, label: 'Failed' },
            error: { color: 'error', icon: <ErrorIcon />, label: 'Error' },
            pending: { color: 'warning', icon: <PendingIcon />, label: 'Pending' }
        };

        const statusConfig = config[status] || config.pending;

        return (
            <Chip
                icon={statusConfig.icon}
                label={statusConfig.label}
                color={statusConfig.color}
                size="small"
                sx={{ fontSize: '11px' }}
            />
        );
    };

    const getTypeChip = (type) => {
        const config = {
            edi: { color: 'primary', icon: <TableIcon />, label: 'EDI' },
            pdf: { color: 'secondary', icon: <PdfIcon />, label: 'PDF' }
        };

        const typeConfig = config[type] || config.edi;

        return (
            <Chip
                icon={typeConfig.icon}
                label={typeConfig.label}
                color={typeConfig.color}
                variant="outlined"
                size="small"
                sx={{ fontSize: '11px' }}
            />
        );
    };

    const handleEdiUploadComplete = (uploadId) => {
        setShowEdiResults(true);
        setSelectedUpload({ id: uploadId, type: 'edi' });
        loadUploads();
    };

    const handleCloseEdiResults = () => {
        setShowEdiResults(false);
        setSelectedUpload(null);
        loadUploads();
    };

    // Enhanced view results handler that differentiates between PDF and EDI
    const handleViewResults = async (upload) => {
        if (upload.type === 'pdf') {
            try {
                // For PDF files, fetch the detailed results from pdfResults collection
                const pdfResultDoc = await getDoc(doc(db, 'pdfResults', upload.id));

                if (pdfResultDoc.exists()) {
                    const pdfResultData = pdfResultDoc.data();
                    setSelectedUpload({
                        ...upload,
                        extractedData: pdfResultData.structuredData || pdfResultData
                    });
                } else {
                    // Fallback to original upload data
                    setSelectedUpload(upload);
                }

                setActiveTab('pdf');
                setShowPdfResults(true);
            } catch (error) {
                console.error('Error fetching PDF results:', error);
                enqueueSnackbar('Failed to load PDF results', { variant: 'error' });
                setSelectedUpload(upload);
                setActiveTab('pdf');
                setShowPdfResults(true);
            }
        } else {
            // For EDI files, show EDI results in the EDI tab
            setSelectedUpload(upload);
            setActiveTab('edi');
            setShowEdiResults(true);
        }
    };

    const handleClosePdfResults = () => {
        setShowPdfResults(false);
        setSelectedUpload(null);
    };

    const handleViewShipmentDetail = (shipment) => {
        console.log('Opening shipment detail for:', shipment);
        setSelectedShipmentDetail(shipment);
        setShipmentDetailDialog(true);
    };

    const handleCloseShipmentDetail = () => {
        setShipmentDetailDialog(false);
        setSelectedShipmentDetail(null);
    };

    // Helper function for currency formatting in dialogs
    const formatCurrency = (amount) => {
        const numAmount = parseFloat(amount) || 0;
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(numAmount);
    };

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" sx={{ mb: 2, fontWeight: 600, fontSize: '22px' }}>
                    AP Processing
                </Typography>
                <AdminBreadcrumb currentPage="AP Processing" />
                <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                    Unified accounts payable processing with EDI automation and PDF parsing
                </Typography>
            </Box>

            {/* Statistics Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} md={3}>
                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                        <CardContent sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Box>
                                    <Typography variant="h4" sx={{ fontWeight: 600, fontSize: '24px' }}>
                                        {stats.totalUploads}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                                        Total Uploads
                                    </Typography>
                                </Box>
                                <FileIcon sx={{ color: '#3b82f6', fontSize: 32 }} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                        <CardContent sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Box>
                                    <Typography variant="h4" sx={{ fontWeight: 600, fontSize: '24px', color: '#10b981' }}>
                                        {stats.completedUploads}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                                        Processed Successfully
                                    </Typography>
                                </Box>
                                <CheckIcon sx={{ color: '#10b981', fontSize: 32 }} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                        <CardContent sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Box>
                                    <Typography variant="h4" sx={{ fontWeight: 600, fontSize: '24px', color: '#f59e0b' }}>
                                        {stats.pendingUploads}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                                        In Progress
                                    </Typography>
                                </Box>
                                <AutorenewIcon sx={{ color: '#f59e0b', fontSize: 32 }} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={3}>
                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                        <CardContent sx={{ p: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <Box>
                                    <Typography variant="h4" sx={{ fontWeight: 600, fontSize: '24px' }}>
                                        {stats.totalRecords.toLocaleString()}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                                        Records Extracted
                                    </Typography>
                                </Box>
                                <AssignmentIcon sx={{ color: '#8b5cf6', fontSize: 32 }} />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Tabs Navigation */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                <Tabs
                    value={activeTab}
                    onChange={(e, newValue) => setActiveTab(newValue)}
                    variant="scrollable"
                    scrollButtons="auto"
                    sx={{
                        '& .MuiTab-root': {
                            textTransform: 'none',
                            fontSize: '12px',
                            fontWeight: 500
                        }
                    }}
                >
                    <Tab label="Overview" value="overview" />
                    <Tab
                        label={
                            <Badge badgeContent={stats.pendingUploads} color="warning">
                                Upload Queue
                            </Badge>
                        }
                        value="queue"
                    />
                    <Tab label="EDI Processing" value="edi" />
                    <Tab label="PDF Parsing" value="pdf" />
                    <Tab label="Data Mapping" value="mapping" />
                    <Tab label="Analytics" value="analytics" />
                </Tabs>
            </Box>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        {/* Upload Area */}
                        <Paper
                            elevation={0}
                            sx={{
                                border: '2px dashed #d1d5db',
                                borderRadius: 2,
                                mb: 3,
                            }}
                        >
                            {/* Carrier Selection for PDF */}
                            <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb', backgroundColor: '#f8fafc' }}>
                                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 2 }}>
                                    🤖 Smart PDF Processing (AI-Powered)
                                </Typography>
                                <FormControl fullWidth size="small">
                                    <InputLabel sx={{ fontSize: '12px' }}>Choose Processing Method</InputLabel>
                                    <Select
                                        value={selectedCarrier}
                                        onChange={(e) => {
                                            console.log('Carrier selected:', e.target.value);
                                            setSelectedCarrier(e.target.value);
                                        }}
                                        label="Choose Processing Method"
                                        sx={{
                                            fontSize: '12px',
                                            backgroundColor: 'white',
                                            '& .MuiSelect-select': {
                                                display: 'flex',
                                                alignItems: 'center'
                                            }
                                        }}
                                        MenuProps={{
                                            PaperProps: {
                                                sx: {
                                                    maxHeight: 400,
                                                    '& .MuiMenuItem-root': {
                                                        fontSize: '12px'
                                                    }
                                                }
                                            }
                                        }}
                                    >
                                        <MenuItem value="" sx={{ fontSize: '12px' }}>
                                            <em>None (for EDI files)</em>
                                        </MenuItem>
                                        {carrierTemplates
                                            .filter(carrier => carrier.supported)
                                            .map(carrier => (
                                                <MenuItem
                                                    key={carrier.id}
                                                    value={carrier.id}
                                                    sx={{
                                                        fontSize: '12px',
                                                        py: 1.5,
                                                        backgroundColor: carrier.intelligent ? '#f0f9ff' : 'transparent',
                                                        borderLeft: carrier.intelligent ? '3px solid #0ea5e9' : 'none',
                                                        '&:hover': {
                                                            backgroundColor: carrier.intelligent ? '#e0f2fe' : '#f9fafb'
                                                        }
                                                    }}
                                                >
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                                                        {/* Carrier Logo/Icon */}
                                                        <Avatar
                                                            src={carrier.logoURL}
                                                            sx={{
                                                                width: 24,
                                                                height: 24,
                                                                border: '1px solid #e5e7eb',
                                                                bgcolor: carrier.intelligent ? '#0ea5e9' : '#f8fafc',
                                                                color: carrier.intelligent ? 'white' : '#6b7280'
                                                            }}
                                                        >
                                                            {carrier.intelligent ? (
                                                                <AiIcon sx={{ fontSize: 14, color: 'white' }} />
                                                            ) : (
                                                                <LocalShippingIcon sx={{ fontSize: 14, color: '#6b7280' }} />
                                                            )}
                                                        </Avatar>

                                                        {/* Carrier Details */}
                                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                                            <Typography
                                                                sx={{
                                                                    fontWeight: 600,
                                                                    fontSize: '12px',
                                                                    color: carrier.intelligent ? '#0ea5e9' : '#374151',
                                                                    whiteSpace: 'nowrap',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis'
                                                                }}
                                                            >
                                                                {carrier.name}
                                                            </Typography>
                                                            <Typography
                                                                sx={{
                                                                    fontSize: '10px',
                                                                    color: '#6b7280',
                                                                    whiteSpace: 'nowrap',
                                                                    overflow: 'hidden',
                                                                    textOverflow: 'ellipsis'
                                                                }}
                                                            >
                                                                {carrier.intelligent ? carrier.description : `ID: ${carrier.id}`}
                                                            </Typography>
                                                        </Box>

                                                        {/* Status Chip */}
                                                        <Chip
                                                            label={carrier.intelligent ? 'RECOMMENDED' : (carrier.supported ? 'Supported' : 'Not Supported')}
                                                            size="small"
                                                            color={carrier.intelligent ? 'primary' : (carrier.supported ? 'success' : 'default')}
                                                            sx={{
                                                                height: 18,
                                                                fontSize: '9px',
                                                                fontWeight: 500
                                                            }}
                                                        />
                                                    </Box>
                                                </MenuItem>
                                            ))}
                                    </Select>
                                    <FormHelperText sx={{ fontSize: '11px' }}>
                                        🧠 <strong>Phase 2A Enhanced:</strong> Multi-Modal AI uses advanced visual + text analysis with logo detection, table intelligence, and layout analysis for superior accuracy on complex multi-document PDFs.
                                    </FormHelperText>
                                </FormControl>
                            </Box>

                            {/* Drop Zone */}
                            <Box
                                sx={{
                                    p: 4,
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                    '&:hover': {
                                        backgroundColor: '#f8fafc'
                                    },
                                    ...(isDragActive && {
                                        backgroundColor: '#eff6ff'
                                    })
                                }}
                                {...getRootProps()}
                            >
                                <input {...getInputProps()} />
                                <UploadIcon sx={{ fontSize: 48, color: '#6b7280', mb: 2 }} />
                                <Typography variant="h6" sx={{ mb: 1, fontSize: '16px', fontWeight: 600 }}>
                                    {isDragActive ? 'Drop files here' : 'Upload EDI or PDF Files'}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px', mb: 2 }}>
                                    Drag and drop your files here, or click to browse
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#9ca3af', fontSize: '11px' }}>
                                    Supports: CSV, TXT (EDI) • PDF (Invoices, BOLs) with AI processing
                                </Typography>
                            </Box>
                        </Paper>

                        {/* Processing Status Display */}
                        {processingFiles.length > 0 && (
                            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', mb: 3 }}>
                                <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                                        Processing Files
                                    </Typography>
                                </Box>
                                <Box sx={{ p: 2 }}>
                                    {processingFiles.map((file) => (
                                        <Box key={file.id} sx={{ mb: 2, p: 2, border: '1px solid #f3f4f6', borderRadius: 1 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    {file.type === 'pdf' ? <PdfIcon sx={{ color: '#ef4444' }} /> : <TableIcon sx={{ color: '#3b82f6' }} />}
                                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                        {file.name}
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    {file.status === 'uploading' && (
                                                        <>
                                                            <CircularProgress size={16} />
                                                            <Chip
                                                                label="Uploading"
                                                                color="primary"
                                                                size="small"
                                                                sx={{ fontSize: '10px' }}
                                                            />
                                                        </>
                                                    )}
                                                    {file.status === 'processing' && (
                                                        <>
                                                            <CircularProgress size={16} />
                                                            <Chip
                                                                label="Processing with AI"
                                                                color="warning"
                                                                size="small"
                                                                sx={{ fontSize: '10px' }}
                                                            />
                                                        </>
                                                    )}
                                                    {file.status === 'completed' && (
                                                        <>
                                                            <CheckCompleteIcon sx={{ color: '#10b981', fontSize: 16 }} />
                                                            <Chip
                                                                label="Completed"
                                                                color="success"
                                                                size="small"
                                                                sx={{ fontSize: '10px' }}
                                                            />
                                                        </>
                                                    )}
                                                    {file.status === 'failed' && (
                                                        <>
                                                            <ErrorIcon sx={{ color: '#ef4444', fontSize: 16 }} />
                                                            <Chip
                                                                label="Failed"
                                                                color="error"
                                                                size="small"
                                                                sx={{ fontSize: '10px' }}
                                                            />
                                                        </>
                                                    )}
                                                </Box>
                                            </Box>
                                            {file.status === 'uploading' && (
                                                <LinearProgress
                                                    variant="indeterminate"
                                                    sx={{
                                                        height: 4,
                                                        borderRadius: 2,
                                                        backgroundColor: '#e5e7eb',
                                                        '& .MuiLinearProgress-bar': { backgroundColor: '#3b82f6' }
                                                    }}
                                                />
                                            )}
                                            {file.status === 'processing' && (
                                                <LinearProgress
                                                    variant="indeterminate"
                                                    sx={{
                                                        height: 4,
                                                        borderRadius: 2,
                                                        backgroundColor: '#e5e7eb',
                                                        '& .MuiLinearProgress-bar': { backgroundColor: '#f59e0b' }
                                                    }}
                                                />
                                            )}
                                            {file.status === 'failed' && file.error && (
                                                <Typography sx={{ fontSize: '11px', color: '#ef4444', mt: 1 }}>
                                                    Error: {file.error}
                                                </Typography>
                                            )}
                                        </Box>
                                    ))}
                                </Box>
                            </Paper>
                        )}

                        {/* Recent Uploads */}
                        <Paper elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                            <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                                        Recent Uploads
                                    </Typography>
                                    <Button
                                        size="small"
                                        startIcon={<RefreshIcon />}
                                        onClick={loadUploads}
                                        sx={{ fontSize: '12px' }}
                                    >
                                        Refresh
                                    </Button>
                                </Box>
                            </Box>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>File</TableCell>
                                            <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Type</TableCell>
                                            <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Status</TableCell>
                                            <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Records</TableCell>
                                            <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Uploaded</TableCell>
                                            <TableCell align="right" sx={{ fontSize: '12px', fontWeight: 600 }}>Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                                                    <CircularProgress size={24} />
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredUploads.slice(0, 10).map((upload) => (
                                            <TableRow key={upload.id} hover>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        {upload.type === 'pdf' ? <PdfIcon /> : <TableIcon />}
                                                        {upload.fileName}
                                                    </Box>
                                                </TableCell>
                                                <TableCell>{getTypeChip(upload.type)}</TableCell>
                                                <TableCell>{getStatusChip(upload.processingStatus)}</TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {upload.recordCount || 0}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {upload.uploadDate?.toDate().toLocaleDateString()}
                                                </TableCell>
                                                <TableCell align="right">
                                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleViewResults(upload)}
                                                            title="View Results"
                                                        >
                                                            <ViewIcon fontSize="small" />
                                                        </IconButton>

                                                        {upload.processingStatus === 'completed' && upload.type === 'pdf' && (
                                                            <>
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => handleExportResults(upload, 'json')}
                                                                    title="Export as JSON"
                                                                >
                                                                    <DownloadIcon fontSize="small" />
                                                                </IconButton>

                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => handleExportResults(upload, 'csv')}
                                                                    title="Export as CSV"
                                                                >
                                                                    <TableIcon fontSize="small" />
                                                                </IconButton>
                                                            </>
                                                        )}

                                                        {upload.processingStatus === 'failed' && (
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleRetryProcessing(upload)}
                                                                title="Retry Processing"
                                                                color="warning"
                                                            >
                                                                <RefreshIcon fontSize="small" />
                                                            </IconButton>
                                                        )}
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </Paper>
                    </Grid>

                </Grid>
            )}

            {/* EDI Processing Tab */}
            {activeTab === 'edi' && (
                <>
                    {showEdiResults && selectedUpload ? (
                        <Box sx={{ mb: 3 }}>
                            <EDIResults
                                uploadId={selectedUpload.id}
                                onClose={handleCloseEdiResults}
                            />
                        </Box>
                    ) : (
                        <EDIUploader
                            onUploadComplete={handleEdiUploadComplete}
                            showHistory={true}
                        />
                    )}
                </>
            )}

            {/* Upload Queue Tab */}
            {activeTab === 'queue' && (
                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3 }}>
                    <Typography variant="h6" sx={{ fontSize: '18px', fontWeight: 600, mb: 3 }}>
                        Upload Queue Management
                    </Typography>

                    {/* Processing Files Display */}
                    {processingFiles.length > 0 ? (
                        <Box>
                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                                Currently Processing ({processingFiles.length} files)
                            </Typography>
                            {processingFiles.map((file) => (
                                <Box key={file.id} sx={{ mb: 2, p: 2, border: '1px solid #e5e7eb', borderRadius: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {file.type === 'pdf' ? <PdfIcon sx={{ color: '#ef4444' }} /> : <TableIcon sx={{ color: '#3b82f6' }} />}
                                            <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                {file.name}
                                            </Typography>
                                        </Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {file.status === 'uploading' && (
                                                <>
                                                    <CircularProgress size={16} />
                                                    <Chip label="Uploading" color="primary" size="small" sx={{ fontSize: '10px' }} />
                                                </>
                                            )}
                                            {file.status === 'processing' && (
                                                <>
                                                    <CircularProgress size={16} />
                                                    <Chip label="Processing with AI" color="warning" size="small" sx={{ fontSize: '10px' }} />
                                                </>
                                            )}
                                            {file.status === 'completed' && (
                                                <>
                                                    <CheckCompleteIcon sx={{ color: '#10b981', fontSize: 16 }} />
                                                    <Chip label="Completed" color="success" size="small" sx={{ fontSize: '10px' }} />
                                                </>
                                            )}
                                            {file.status === 'failed' && (
                                                <>
                                                    <ErrorIcon sx={{ color: '#ef4444', fontSize: 16 }} />
                                                    <Chip label="Failed" color="error" size="small" sx={{ fontSize: '10px' }} />
                                                </>
                                            )}
                                        </Box>
                                    </Box>
                                    {(file.status === 'uploading' || file.status === 'processing') && (
                                        <LinearProgress
                                            variant="indeterminate"
                                            sx={{
                                                height: 4,
                                                borderRadius: 2,
                                                backgroundColor: '#e5e7eb',
                                                '& .MuiLinearProgress-bar': {
                                                    backgroundColor: file.status === 'uploading' ? '#3b82f6' : '#f59e0b'
                                                }
                                            }}
                                        />
                                    )}
                                    {file.status === 'failed' && file.error && (
                                        <Typography sx={{ fontSize: '11px', color: '#ef4444', mt: 1 }}>
                                            Error: {file.error}
                                        </Typography>
                                    )}
                                </Box>
                            ))}
                        </Box>
                    ) : (
                        <Box sx={{ textAlign: 'center', py: 6 }}>
                            <UploadIcon sx={{ fontSize: 64, color: '#d1d5db', mb: 2 }} />
                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#6b7280', mb: 1 }}>
                                No files in queue
                            </Typography>
                            <Typography sx={{ fontSize: '12px', color: '#9ca3af' }}>
                                Upload files to see processing status here
                            </Typography>
                        </Box>
                    )}
                </Paper>
            )}

            {/* Data Mapping Tab */}
            {activeTab === 'mapping' && (
                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3 }}>
                    <Typography variant="h6" sx={{ fontSize: '18px', fontWeight: 600, mb: 3 }}>
                        Data Mapping & Field Configuration
                    </Typography>

                    <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                            <Card elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3 }}>
                                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                                    Carrier Field Mapping
                                </Typography>
                                <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                                    Configure how fields from carrier invoices map to your system
                                </Typography>
                                <Stack spacing={2}>
                                    {carrierTemplates.filter(c => c.supported).map((carrier) => (
                                        <Box
                                            key={carrier.id}
                                            sx={{
                                                p: 2,
                                                border: '1px solid #e5e7eb',
                                                borderRadius: 1,
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center'
                                            }}
                                        >
                                            <Box>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{carrier.name}</Typography>
                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                    {carrier.formats.join(', ')} formats supported
                                                </Typography>
                                            </Box>
                                            <Button size="small" variant="outlined" sx={{ fontSize: '11px' }}>
                                                Configure
                                            </Button>
                                        </Box>
                                    ))}
                                </Stack>
                            </Card>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Card elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3 }}>
                                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                                    Standard Field Mapping
                                </Typography>
                                <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                                    Default mappings for common invoice fields
                                </Typography>
                                <Stack spacing={2}>
                                    {[
                                        { field: 'Tracking Number', status: 'Configured', color: 'success' },
                                        { field: 'Ship Date', status: 'Configured', color: 'success' },
                                        { field: 'Service Type', status: 'Configured', color: 'success' },
                                        { field: 'Total Amount', status: 'Configured', color: 'success' },
                                        { field: 'Weight', status: 'Needs Review', color: 'warning' },
                                        { field: 'Dimensions', status: 'Not Configured', color: 'error' }
                                    ].map((mapping) => (
                                        <Box
                                            key={mapping.field}
                                            sx={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                p: 1.5,
                                                border: '1px solid #f3f4f6',
                                                borderRadius: 1
                                            }}
                                        >
                                            <Typography sx={{ fontSize: '12px' }}>{mapping.field}</Typography>
                                            <Chip
                                                label={mapping.status}
                                                color={mapping.color}
                                                size="small"
                                                sx={{ fontSize: '10px' }}
                                            />
                                        </Box>
                                    ))}
                                </Stack>
                            </Card>
                        </Grid>
                    </Grid>
                </Paper>
            )}

            {/* Analytics Tab */}
            {activeTab === 'analytics' && (
                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3 }}>
                    <Typography variant="h6" sx={{ fontSize: '18px', fontWeight: 600, mb: 3 }}>
                        Processing Analytics & Insights
                    </Typography>

                    <Grid container spacing={3}>
                        <Grid item xs={12} md={4}>
                            <Card elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3 }}>
                                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                                    Processing Performance
                                </Typography>
                                <Stack spacing={2}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography sx={{ fontSize: '12px' }}>Success Rate</Typography>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#10b981' }}>
                                            {stats.totalUploads > 0 ?
                                                `${Math.round((stats.completedUploads / stats.totalUploads) * 100)}%` :
                                                '0%'
                                            }
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography sx={{ fontSize: '12px' }}>Avg Processing Time</Typography>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                            {stats.totalUploads > 0 ?
                                                `${Math.round(stats.processingTime / stats.totalUploads / 1000)}s` :
                                                '0s'
                                            }
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <Typography sx={{ fontSize: '12px' }}>Records per File</Typography>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                            {stats.totalUploads > 0 ?
                                                `${Math.round(stats.totalRecords / stats.totalUploads)}` :
                                                '0'
                                            }
                                        </Typography>
                                    </Box>
                                </Stack>
                            </Card>
                        </Grid>

                        <Grid item xs={12} md={4}>
                            <Card elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3 }}>
                                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                                    Carrier Breakdown
                                </Typography>
                                <Stack spacing={1}>
                                    {carrierTemplates.filter(c => c.supported).map((carrier) => (
                                        <Box
                                            key={carrier.id}
                                            sx={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                p: 1,
                                                backgroundColor: '#f8fafc',
                                                borderRadius: 1
                                            }}
                                        >
                                            <Typography sx={{ fontSize: '11px' }}>{carrier.name}</Typography>
                                            <Typography sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                {Math.floor(Math.random() * 20)} files
                                            </Typography>
                                        </Box>
                                    ))}
                                </Stack>
                            </Card>
                        </Grid>

                        <Grid item xs={12} md={4}>
                            <Card elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3 }}>
                                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                                    Recent Trends
                                </Typography>
                                <Stack spacing={2}>
                                    <Box>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Today</Typography>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                            {stats.pendingUploads} files processed
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>This Week</Typography>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                            {stats.totalUploads} total uploads
                                        </Typography>
                                    </Box>
                                    <Box>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Error Rate</Typography>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600, color: stats.failedUploads > 0 ? '#ef4444' : '#10b981' }}>
                                            {stats.totalUploads > 0 ?
                                                `${Math.round((stats.failedUploads / stats.totalUploads) * 100)}%` :
                                                '0%'
                                            }
                                        </Typography>
                                    </Box>
                                </Stack>
                            </Card>
                        </Grid>
                    </Grid>
                </Paper>
            )}

            {/* PDF Parsing Tab */}
            {activeTab === 'pdf' && (
                <>
                    {showPdfResults && selectedUpload ? (
                        <Box sx={{ mb: 3 }}>
                            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                    <Typography variant="h6" sx={{ fontSize: '18px', fontWeight: 600 }}>
                                        PDF Processing Results: {selectedUpload.fileName}
                                    </Typography>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={handleClosePdfResults}
                                        sx={{ fontSize: '12px' }}
                                    >
                                        Back to PDF Overview
                                    </Button>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center' }}>
                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                        Processing Status: {getStatusChip(selectedUpload.processingStatus)}
                                    </Typography>
                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                        Records: {selectedUpload.recordCount || 0}
                                    </Typography>
                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                        Carrier: {selectedUpload.carrier || 'Unknown'}
                                    </Typography>
                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                        Confidence: {selectedUpload.confidence ? `${Math.round(selectedUpload.confidence * 100)}%` : 'N/A'}
                                    </Typography>
                                </Box>

                                {selectedUpload.processingStatus === 'completed' ? (
                                    <PdfResultsTable
                                        pdfResults={selectedUpload}
                                        onClose={handleClosePdfResults}
                                        onViewShipmentDetail={handleViewShipmentDetail}
                                    />
                                ) : selectedUpload.processingStatus === 'failed' ? (
                                    <Box sx={{ textAlign: 'center', py: 4 }}>
                                        <ErrorIcon sx={{ fontSize: 48, color: '#ef4444', mb: 2 }} />
                                        <Typography variant="h6" sx={{ mb: 2, fontSize: '16px', fontWeight: 600 }}>
                                            Processing Failed
                                        </Typography>
                                        <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                                            {selectedUpload.error || 'An error occurred during PDF processing'}
                                        </Typography>
                                        <Button
                                            variant="contained"
                                            color="warning"
                                            size="small"
                                            onClick={() => handleRetryProcessing(selectedUpload)}
                                            sx={{ fontSize: '12px' }}
                                        >
                                            Retry Processing
                                        </Button>
                                    </Box>
                                ) : (
                                    <Box sx={{ textAlign: 'center', py: 4 }}>
                                        <CircularProgress sx={{ mb: 2 }} />
                                        <Typography variant="h6" sx={{ mb: 2, fontSize: '16px', fontWeight: 600 }}>
                                            Processing PDF...
                                        </Typography>
                                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                            Please wait while we extract data from your PDF
                                        </Typography>
                                    </Box>
                                )}
                            </Paper>
                        </Box>
                    ) : (
                        <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', p: 4 }}>
                            <Typography variant="h6" sx={{ mb: 3, fontSize: '18px', fontWeight: 600 }}>
                                PDF Parsing & Automation
                            </Typography>

                            <Grid container spacing={3}>
                                {/* Processing Statistics */}
                                <Grid item xs={12} md={4}>
                                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3 }}>
                                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                                            Processing Statistics
                                        </Typography>
                                        <Stack spacing={2}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography sx={{ fontSize: '12px' }}>Success Rate</Typography>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#10b981' }}>
                                                    {stats.totalUploads > 0 ?
                                                        `${Math.round((stats.completedUploads / stats.totalUploads) * 100)}%` :
                                                        '0%'
                                                    }
                                                </Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography sx={{ fontSize: '12px' }}>Avg Processing Time</Typography>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                    {stats.totalUploads > 0 ?
                                                        `${Math.round(stats.processingTime / stats.totalUploads / 1000)}s` :
                                                        '0s'
                                                    }
                                                </Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography sx={{ fontSize: '12px' }}>Records per File</Typography>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                    {stats.totalUploads > 0 ?
                                                        `${Math.round(stats.totalRecords / stats.totalUploads)}` :
                                                        '0'
                                                    }
                                                </Typography>
                                            </Box>
                                        </Stack>
                                    </Card>
                                </Grid>

                                {/* Processing Features */}
                                <Grid item xs={12} md={4}>
                                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3 }}>
                                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                                            AI Processing Features
                                        </Typography>
                                        <Stack spacing={2}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <CheckIcon sx={{ color: '#10b981', fontSize: 16 }} />
                                                <Typography sx={{ fontSize: '12px' }}>Cloud Vision OCR</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <CheckIcon sx={{ color: '#10b981', fontSize: 16 }} />
                                                <Typography sx={{ fontSize: '12px' }}>Table Detection & Extraction</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <CheckIcon sx={{ color: '#10b981', fontSize: 16 }} />
                                                <Typography sx={{ fontSize: '12px' }}>Gemini AI Structured Parsing</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <CheckIcon sx={{ color: '#10b981', fontSize: 16 }} />
                                                <Typography sx={{ fontSize: '12px' }}>Multi-Format Export</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <CheckIcon sx={{ color: '#10b981', fontSize: 16 }} />
                                                <Typography sx={{ fontSize: '12px' }}>Batch Processing</Typography>
                                            </Box>
                                        </Stack>
                                    </Card>
                                </Grid>

                                {/* Carrier Support */}
                                <Grid item xs={12} md={4}>
                                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3 }}>
                                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 2 }}>
                                            Carrier Support
                                        </Typography>
                                        <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                                            {carrierTemplates.filter(c => c.supported).length} of {carrierTemplates.length} carriers supported
                                        </Typography>
                                        <LinearProgress
                                            variant="determinate"
                                            value={(carrierTemplates.filter(c => c.supported).length / carrierTemplates.length) * 100}
                                            sx={{
                                                mb: 2,
                                                height: 8,
                                                backgroundColor: '#e5e7eb',
                                                '& .MuiLinearProgress-bar': { backgroundColor: '#3b82f6' }
                                            }}
                                        />
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            onClick={() => setActiveTab('overview')}
                                            sx={{ fontSize: '11px' }}
                                        >
                                            View All Carriers
                                        </Button>
                                    </Card>
                                </Grid>
                            </Grid>

                            {/* Upload Area for PDF Files */}
                            <Box sx={{ mt: 4 }}>
                                <Paper
                                    elevation={0}
                                    sx={{
                                        border: '2px dashed #d1d5db',
                                        borderRadius: 2,
                                    }}
                                >
                                    {/* Carrier Selection for PDF */}
                                    <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb', backgroundColor: '#f8fafc' }}>
                                        <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 2 }}>
                                            PDF Carrier Selection (Required for PDF uploads)
                                        </Typography>
                                        <FormControl fullWidth size="small">
                                            <InputLabel sx={{ fontSize: '12px' }}>Select Carrier for PDF Processing</InputLabel>
                                            <Select
                                                value={selectedCarrier}
                                                onChange={(e) => {
                                                    console.log('Carrier selected:', e.target.value);
                                                    setSelectedCarrier(e.target.value);
                                                }}
                                                label="Select Carrier for PDF Processing"
                                                sx={{ fontSize: '12px', backgroundColor: 'white' }}
                                            >
                                                <MenuItem value="" sx={{ fontSize: '12px' }}>
                                                    <em>None (for EDI files)</em>
                                                </MenuItem>
                                                {carrierTemplates
                                                    .filter(carrier => carrier.supported)
                                                    .map(carrier => (
                                                        <MenuItem key={carrier.id} value={carrier.id} sx={{ fontSize: '12px' }}>
                                                            {carrier.name}
                                                        </MenuItem>
                                                    ))}
                                            </Select>
                                            <FormHelperText sx={{ fontSize: '11px' }}>
                                                Select the carrier before uploading PDF invoices.
                                            </FormHelperText>
                                        </FormControl>
                                    </Box>

                                    {/* Drop Zone */}
                                    <Box
                                        sx={{
                                            p: 4,
                                            textAlign: 'center',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            '&:hover': {
                                                backgroundColor: '#f8fafc'
                                            }
                                        }}
                                        {...getRootProps()}
                                    >
                                        <input {...getInputProps()} />
                                        <PdfIcon sx={{ fontSize: 48, color: '#6b7280', mb: 2 }} />
                                        <Typography variant="h6" sx={{ mb: 1, fontSize: '16px', fontWeight: 600 }}>
                                            Upload PDF Files for Processing
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px', mb: 2 }}>
                                            Support for invoices, BOLs, and shipping documents
                                        </Typography>
                                        <Typography variant="body2" sx={{ color: '#9ca3af', fontSize: '11px' }}>
                                            Supports: PDF files from {carrierTemplates.filter(c => c.supported).length} major carriers
                                        </Typography>
                                    </Box>
                                </Paper>
                            </Box>
                        </Paper>
                    )}
                </>
            )}

            {/* Settings Dialog */}
            <Dialog open={settingsDialog} maxWidth="md" fullWidth>
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>
                    Advanced Processing Settings
                </DialogTitle>
                <DialogContent>
                    <Stack spacing={3} sx={{ mt: 2 }}>
                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <AiIcon />
                                    <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                                        AI Processing Options
                                    </Typography>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Stack spacing={2}>
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={pdfParsingSettings.structuredOutput}
                                                onChange={(e) => setPdfParsingSettings(prev => ({
                                                    ...prev,
                                                    structuredOutput: e.target.checked
                                                }))}
                                            />
                                        }
                                        label={<Typography sx={{ fontSize: '12px' }}>Structured data output</Typography>}
                                    />
                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={pdfParsingSettings.carrierTemplates}
                                                onChange={(e) => setPdfParsingSettings(prev => ({
                                                    ...prev,
                                                    carrierTemplates: e.target.checked
                                                }))}
                                            />
                                        }
                                        label={<Typography sx={{ fontSize: '12px' }}>Use carrier-specific templates</Typography>}
                                    />
                                </Stack>
                            </AccordionDetails>
                        </Accordion>

                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <SpeedIcon />
                                    <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                                        Performance Settings
                                    </Typography>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Alert severity="info" sx={{ fontSize: '12px' }}>
                                    Performance settings help optimize processing speed for large documents.
                                </Alert>
                            </AccordionDetails>
                        </Accordion>

                        <Accordion>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <SecurityIcon />
                                    <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                                        Security & Compliance
                                    </Typography>
                                </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                                <Alert severity="success" sx={{ fontSize: '12px' }}>
                                    All processing is performed in secure, encrypted environments with full audit trails.
                                </Alert>
                            </AccordionDetails>
                        </Accordion>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setSettingsDialog(false)}
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={saveSettings}
                        sx={{ fontSize: '12px' }}
                    >
                        Save Settings
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Shipment Detail Dialog */}
            <Dialog open={shipmentDetailDialog} maxWidth="lg" fullWidth>
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                        Shipment Details
                    </Typography>
                    <IconButton onClick={handleCloseShipmentDetail} size="small">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent>
                    {selectedShipmentDetail && (
                        <Grid container spacing={3} sx={{ mt: 1 }}>
                            {/* Basic Information */}
                            <Grid item xs={12} md={6}>
                                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3 }}>
                                    <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 2 }}>
                                        Shipment Information
                                    </Typography>
                                    <Stack spacing={2}>
                                        <Box>
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Shipment ID</Typography>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{selectedShipmentDetail.shipmentId}</Typography>
                                        </Box>
                                        <Box>
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Tracking Number</Typography>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{selectedShipmentDetail.trackingNumber || 'N/A'}</Typography>
                                        </Box>
                                        <Box>
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Carrier</Typography>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{selectedShipmentDetail.carrier}</Typography>
                                        </Box>
                                        <Box>
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Service</Typography>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{selectedShipmentDetail.service}</Typography>
                                        </Box>
                                        <Box>
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Ship Date</Typography>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{selectedShipmentDetail.shipDate || 'N/A'}</Typography>
                                        </Box>
                                    </Stack>
                                </Paper>
                            </Grid>

                            {/* Addresses */}
                            <Grid item xs={12} md={6}>
                                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3 }}>
                                    <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 2 }}>
                                        Addresses
                                    </Typography>
                                    <Stack spacing={2}>
                                        <Box>
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Origin</Typography>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{selectedShipmentDetail.origin}</Typography>
                                        </Box>
                                        <Box>
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>Destination</Typography>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>{selectedShipmentDetail.destination}</Typography>
                                        </Box>
                                    </Stack>
                                </Paper>
                            </Grid>

                            {/* Charges Breakdown */}
                            <Grid item xs={12}>
                                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3 }}>
                                    <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 2 }}>
                                        Charges Breakdown
                                    </Typography>
                                    {selectedShipmentDetail.charges && selectedShipmentDetail.charges.length > 0 ? (
                                        <TableContainer>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell sx={{ fontSize: '11px', fontWeight: 600 }}>Charge Name</TableCell>
                                                        <TableCell sx={{ fontSize: '11px', fontWeight: 600 }} align="right">Amount</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {selectedShipmentDetail.charges.map((charge, index) => (
                                                        <TableRow key={index}>
                                                            <TableCell sx={{ fontSize: '11px' }}>{charge.name}</TableCell>
                                                            <TableCell sx={{ fontSize: '11px' }} align="right">{formatCurrency(charge.amount)}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                    <TableRow>
                                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600, borderTop: '2px solid #e5e7eb' }}>Total</TableCell>
                                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600, borderTop: '2px solid #e5e7eb', color: '#059669' }} align="right">
                                                            {formatCurrency(selectedShipmentDetail.totalAmount)}
                                                        </TableCell>
                                                    </TableRow>
                                                </TableBody>
                                            </Table>
                                        </TableContainer>
                                    ) : (
                                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>No charge details available</Typography>
                                    )}
                                </Paper>
                            </Grid>
                        </Grid>
                    )}
                </DialogContent>
            </Dialog>


        </Box >
    );
};

export default APProcessing; 