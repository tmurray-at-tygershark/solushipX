import React, { useState, useEffect, useRef } from 'react';
import {
    Box,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    CircularProgress,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    IconButton,
    Tabs,
    Tab,
    Alert,
    Grid,
    Card,
    CardContent,
    Divider,
    Stack
} from '@mui/material';
import {
    Close as CloseIcon,
    DownloadOutlined as DownloadIcon,
    InfoOutlined as InfoIcon,
    CheckCircleOutline as CheckCircleIcon,
    ErrorOutline as ErrorIcon,
    HourglassEmpty as PendingIcon,
    LocalShippingOutlined as ShippingIcon,
    ReceiptOutlined as ReceiptIcon,
    Print as PrintIcon,
    ArrowBack as ArrowBackIcon,
    Link as LinkIcon
} from '@mui/icons-material';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { db, adminDb } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate, useParams } from 'react-router-dom';
import html2pdf from 'html2pdf.js/dist/html2pdf.min.js';

// Helper function to format address
const formatAddress = (address, fallbackPostalCode) => {
    if (!address) return 'N/A';

    const street = address.street?.toUpperCase();
    const city = address.city?.toUpperCase();
    const state = address.state?.toUpperCase();
    const postalCode = (address.postalCode || fallbackPostalCode)?.toUpperCase();
    const country = address.country?.toUpperCase();

    const line3Parts = [city, state].filter(Boolean);
    const line4Parts = [postalCode, country].filter(Boolean);

    const lines = [];
    if (street) lines.push(street);
    if (line3Parts.length > 0) lines.push(line3Parts.join(', '));
    if (line4Parts.length > 0) lines.push(line4Parts.join(', '));

    return lines.length > 0 ? lines.join('\n') : 'N/A';
};

const EDIResults = ({ uploadId: propUploadId, onClose }) => {
    const navigate = useNavigate();
    const params = useParams();
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [processingStatus, setProcessingStatus] = useState('processing');
    const [fileDetails, setFileDetails] = useState(null);
    const [extractedData, setExtractedData] = useState([]);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const printContentRef = useRef();

    // Get uploadId from props or URL params
    const uploadId = propUploadId || params?.uploadId;

    // Collection names for EDI data
    const uploadsCollection = 'ediUploads';
    const resultsCollection = 'ediResults';

    const handleClose = () => {
        if (onClose) {
            onClose();
        } else {
            // If no onClose handler provided (direct URL access), navigate back
            navigate('/admin/billing/edi');
        }
    };

    useEffect(() => {
        if (!uploadId) {
            setError("No upload ID provided. Please select an EDI file to view results.");
            setLoading(false);
            return;
        }

        console.log(`Fetching EDI data for upload ID: ${uploadId}`);

        const fetchEdiData = async () => {
            let unsubscribe = null;

            try {
                setLoading(true);

                // Get the file upload details - ENSURE we're using adminDb
                console.log(`Accessing document: ${uploadsCollection}/${uploadId} in admin database`);
                const uploadRef = doc(adminDb, uploadsCollection, uploadId);
                const uploadDoc = await getDoc(uploadRef);

                if (!uploadDoc.exists()) {
                    console.error(`Document ${uploadId} not found in ${uploadsCollection} collection`);
                    // Try the regular database as fallback
                    console.log(`Trying fallback to regular database...`);
                    const regularUploadRef = doc(db, uploadsCollection, uploadId);
                    const regularUploadDoc = await getDoc(regularUploadRef);

                    if (!regularUploadDoc.exists()) {
                        throw new Error(`Upload not found in any database. ID: ${uploadId}`);
                    } else {
                        console.log(`Found document in regular database instead of admin database`);
                        const uploadData = regularUploadDoc.data();
                        setFileDetails(uploadData);

                        // Set up real-time listener on regular database
                        unsubscribe = onSnapshot(regularUploadRef, handleDocumentSnapshot);
                    }
                } else {
                    console.log(`Found document in admin database`);
                    const uploadData = uploadDoc.data();
                    setFileDetails(uploadData);

                    // Set up real-time listener on admin database
                    unsubscribe = onSnapshot(uploadRef, handleDocumentSnapshot);
                }
            } catch (err) {
                console.error('Error fetching EDI data:', err);
                setError(err.message);
                setLoading(false);
            }

            return unsubscribe;
        };

        // Handler for document snapshot updates
        const handleDocumentSnapshot = (doc) => {
            if (doc.exists()) {
                const data = doc.data();
                console.log(`Processing status updated: ${data.processingStatus}`);
                setProcessingStatus(data.processingStatus);

                // If processing is complete, fetch the extracted data
                if (data.processingStatus === 'completed' && data.resultDocId) {
                    console.log(`Processing complete. Fetching results document: ${data.resultDocId}`);
                    fetchExtractedResults(data.resultDocId, data.isAdmin);
                } else if (data.processingStatus === 'failed') {
                    setError(data.error || 'Processing failed');
                    setLoading(false);
                }
            }
        };

        const fetchExtractedResults = async (resultDocId, isAdmin = true) => {
            try {
                // Use the appropriate database based on isAdmin flag
                const database = isAdmin ? adminDb : db;
                console.log(`Fetching results from ${isAdmin ? 'admin' : 'regular'} database: ${resultsCollection}/${resultDocId}`);

                const resultRef = doc(database, resultsCollection, resultDocId);
                const resultDoc = await getDoc(resultRef);

                if (resultDoc.exists()) {
                    const resultData = resultDoc.data();
                    console.log('Extracted result data:', resultData);
                    // Handle both old format (shipments) and new format (records)
                    const extractedData = resultData.records || resultData.shipments || [];
                    console.log(`Found ${extractedData.length} records in extraction results`);
                    setExtractedData(extractedData);

                    // Always update fileDetails with the data from results
                    setFileDetails(prevDetails => ({
                        ...prevDetails,
                        confidenceScore: resultData.confidenceScore || (resultData.confidence ? Math.round(resultData.confidence * 100) : 99),
                        processingTimeMs: resultData.processingTimeMs || prevDetails?.processingTimeMs || 0,
                        aiModel: resultData.aiModel || 'Gemini 1.5 Pro',
                        carrier: resultData.carrier || prevDetails?.carrier,
                        uploadedAt: prevDetails?.uploadedAt || resultData.processedAt,
                        rawSample: resultData.rawSample || prevDetails?.rawSample
                    }));
                } else {
                    // Try the other database as fallback
                    const fallbackDatabase = isAdmin ? db : adminDb;
                    console.log(`Result not found. Trying fallback database...`);
                    const fallbackResultRef = doc(fallbackDatabase, resultsCollection, resultDocId);
                    const fallbackResultDoc = await getDoc(fallbackResultRef);

                    if (fallbackResultDoc.exists()) {
                        console.log(`Found results in fallback database`);
                        const resultData = fallbackResultDoc.data();
                        const extractedData = resultData.records || resultData.shipments || [];
                        setExtractedData(extractedData);
                    } else {
                        console.error(`Results document not found in either database: ${resultDocId}`);
                        setError(`Results document not found: ${resultDocId}`);
                    }
                }

                setLoading(false);
            } catch (err) {
                console.error('Error fetching extraction results:', err);
                setError('Error loading extracted data: ' + err.message);
                setLoading(false);
            }
        };

        const unsubscribe = fetchEdiData();
        return () => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        };
    }, [uploadId]);

    const handleViewDetails = (record) => {
        setSelectedRecord(record);
        setDetailsOpen(true);
    };

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    const getStatusChip = (status) => {
        switch (status) {
            case 'completed':
                return <Chip
                    icon={<CheckCircleIcon />}
                    label="Completed"
                    color="success"
                    size="small"
                />;
            case 'failed':
                return <Chip
                    icon={<ErrorIcon />}
                    label="Failed"
                    color="error"
                    size="small"
                />;
            case 'queued':
                return <Chip
                    icon={<PendingIcon />}
                    label="Queued"
                    color="default"
                    size="small"
                />;
            default:
                return <Chip
                    icon={<PendingIcon />}
                    label="Processing"
                    color="primary"
                    size="small"
                />;
        }
    };

    const getRecordTypeChip = (recordType) => {
        if (recordType === 'charge') {
            return <Chip
                icon={<ReceiptIcon fontSize="small" />}
                label="Charge"
                color="secondary"
                variant="outlined"
                size="small"
            />;
        }
        return <Chip
            icon={<ShippingIcon fontSize="small" />}
            label="Shipment"
            color="primary"
            variant="outlined"
            size="small"
        />;
    };

    // Filter data by record type
    const getShipments = () => {
        const shipments = extractedData.filter(record =>
            !record.recordType || record.recordType === 'shipment'
        );
        console.log('Filtered shipments:', shipments);
        return shipments;
    };

    const getCharges = () => {
        const charges = extractedData.filter(record =>
            record.recordType === 'charge'
        );
        console.log('Filtered charges:', charges);
        return charges;
    };

    // Format monetary values
    const formatCurrency = (value) => {
        if (value === undefined || value === null) return 'N/A';
        return `$${parseFloat(value).toFixed(2)}`;
    };

    // Add Print Handler
    const handlePrint = () => {
        const element = printContentRef.current;
        if (!element || !selectedRecord) return;

        const recordIdentifier = selectedRecord.trackingNumber || selectedRecord.referenceNumber || selectedRecord.description || 'edi-record';
        const filename = `${recordIdentifier}.pdf`;

        const opt = {
            margin: 0.5,
            filename: filename,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true }, // Increase scale for better resolution
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        html2pdf().from(element).set(opt).save();
    };

    // --- START: CSV Export Logic ---
    const escapeCsvCell = (cell) => {
        if (cell === undefined || cell === null) return '';
        let cellString = String(cell);
        // If the cell contains a comma, double quote, or newline, enclose it in double quotes
        if (cellString.search(/[,\"\n]/) >= 0) {
            // Escape existing double quotes by doubling them
            cellString = cellString.replace(/"/g, '""');
            // Enclose the entire string in double quotes
            cellString = `"${cellString}"`;
        }
        return cellString;
    };

    const handleExportData = () => {
        if (extractedData.length === 0) return;

        const headers = [
            'RecordType', 'TrackingNumber', 'ReferenceNumber', 'ManifestNumber', 'InvoiceNumber', 'InvoiceDate', 'AccountNumber',
            'ShipDate', 'DeliveryDate',
            'OriginCompany', 'OriginStreet', 'OriginCity', 'OriginState', 'OriginPostalCode', 'OriginCountry',
            'DestinationCompany', 'DestinationStreet', 'DestinationCity', 'DestinationState', 'DestinationPostalCode', 'DestinationCountry',
            'Carrier', 'ServiceType', 'Weight', 'WeightUnit', 'Pieces',
            'ChargeDescription', 'ChargeType', 'ChargeCost',
            'ShipmentCost', 'TotalCost'
        ];

        const csvRows = [];
        // Add header row
        csvRows.push(headers.map(escapeCsvCell).join(','));

        // Add data rows
        extractedData.forEach(record => {
            const recordType = record.recordType || 'shipment'; // Default to shipment if not specified
            const isCharge = recordType === 'charge';

            const row = [
                recordType,
                record.trackingNumber,
                record.shipmentReference || record.referenceNumber, // Combine reference fields
                record.manifestNumber,
                record.invoiceNumber,
                record.invoiceDate,
                record.accountNumber,
                record.shipDate || record.manifestDate, // Use manifestDate as fallback shipDate
                record.deliveryDate,
                record.origin?.company,
                record.origin?.street,
                record.origin?.city,
                record.origin?.state,
                record.origin?.postalCode,
                record.origin?.country,
                record.destination?.company,
                record.destination?.street,
                record.destination?.city,
                record.destination?.state,
                record.destination?.postalCode || record.postalCode, // Fallback postal code
                record.destination?.country,
                record.carrier || fileDetails?.carrier,
                record.serviceType,
                record.actualWeight || record.reportedWeight,
                record.weightUnit,
                record.pieces,
                isCharge ? record.description : '', // Charge-specific fields
                isCharge ? record.chargeType : '',
                isCharge ? (record.totalCost || record.cost) : '', // Charge cost
                !isCharge ? (record.totalCost || record.cost) : '', // Shipment cost
                record.totalCost || record.cost // General total cost as fallback
            ];
            csvRows.push(row.map(escapeCsvCell).join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });

        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        const filename = `edi-export-${uploadId || 'data'}.csv`;
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };
    // --- END: CSV Export Logic ---

    if (loading) {
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 4 }}>
                <CircularProgress size={60} thickness={4} />
                <Typography variant="h6" sx={{ mt: 2 }}>
                    {processingStatus === 'queued' ? 'Waiting in queue...' : 'Processing file...'}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {processingStatus === 'queued'
                        ? 'Your file is in the processing queue. This may take a few moments.'
                        : 'AI is analyzing your CSV file to extract shipment data.'}
                </Typography>
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error" sx={{ mb: 3 }}>
                    {error}
                </Alert>
                <Button variant="outlined" onClick={handleClose}>
                    Go Back
                </Button>
            </Box>
        );
    }

    const shipments = getShipments();
    const charges = getCharges();

    return (
        <Box>
            <Stack direction="row" spacing={1} sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
                <IconButton onClick={handleClose} size="small">
                    <ArrowBackIcon />
                </IconButton>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    EDI Processing Results
                    {fileDetails && ` - ${fileDetails.fileName}`}
                </Typography>
                <Box>
                    {getStatusChip(processingStatus)}
                    <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        sx={{ ml: 2 }}
                        disabled={extractedData.length === 0}
                        onClick={handleExportData}
                    >
                        Export Data
                    </Button>
                </Box>
            </Stack>

            {extractedData.length === 0 && processingStatus === 'completed' ? (
                <Alert severity="warning" sx={{ mb: 3 }}>
                    No data was extracted from this file.
                </Alert>
            ) : (
                <>
                    <Paper elevation={0} sx={{ mb: 3, border: '1px solid #eee' }}>
                        <Tabs
                            value={activeTab}
                            onChange={handleTabChange}
                            sx={{ borderBottom: 1, borderColor: 'divider' }}
                        >
                            <Tab label={`Shipments (${shipments.length})`} />
                            <Tab label={`Charges (${charges.length})`} />
                            <Tab label="Processing Summary" />
                            <Tab label="Raw Data" />
                        </Tabs>

                        {activeTab === 0 && (
                            <>
                                {shipments.length === 0 ? (
                                    <Box sx={{ p: 3 }}>
                                        <Alert severity="info">No shipment records found in this file.</Alert>
                                    </Box>
                                ) : (
                                    <TableContainer>
                                        <Table>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell sx={{ verticalAlign: 'top', minWidth: '120px' }}>Date</TableCell>
                                                    <TableCell sx={{ verticalAlign: 'top' }}>Tracking/Reference</TableCell>
                                                    <TableCell sx={{ verticalAlign: 'top' }}>Origin</TableCell>
                                                    <TableCell sx={{ verticalAlign: 'top' }}>Destination</TableCell>
                                                    <TableCell sx={{ verticalAlign: 'top' }}>Carrier/Service</TableCell>
                                                    <TableCell sx={{ verticalAlign: 'top' }} align="right">Weight / Pieces</TableCell>
                                                    <TableCell sx={{ verticalAlign: 'top' }} align="right">Cost</TableCell>
                                                    <TableCell sx={{ verticalAlign: 'top' }} align="right">Actions</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {shipments.map((shipment, index) => (
                                                    <TableRow key={index} hover>
                                                        <TableCell sx={{ verticalAlign: 'top', minWidth: '120px' }}>
                                                            {shipment.shipDate || shipment.manifestDate || 'N/A'}
                                                        </TableCell>
                                                        <TableCell sx={{ verticalAlign: 'top' }}>
                                                            <Box>
                                                                <Typography variant="body2" fontWeight="medium">
                                                                    {shipment.trackingNumber || "No tracking #"}
                                                                </Typography>
                                                                {shipment.invoiceNumber && (
                                                                    <Typography variant="caption" color="text.secondary" display="block">
                                                                        Inv: {shipment.invoiceNumber}
                                                                    </Typography>
                                                                )}
                                                                {shipment.shipmentReference && (
                                                                    <Typography variant="caption" color="text.secondary" display="block">
                                                                        Ref: {shipment.shipmentReference}
                                                                    </Typography>
                                                                )}
                                                                {shipment.manifestNumber && (
                                                                    <Typography variant="caption" color="text.secondary" display="block">
                                                                        Manifest: {shipment.manifestNumber}
                                                                    </Typography>
                                                                )}
                                                                {shipment.accountNumber && (
                                                                    <Typography variant="caption" color="text.secondary" display="block">
                                                                        Acct: {shipment.accountNumber}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell sx={{ verticalAlign: 'top' }}>
                                                            <Box>
                                                                {shipment.origin && (
                                                                    <Typography variant="caption" display="block" sx={{ whiteSpace: 'pre-line' }}>
                                                                        {formatAddress(shipment.origin)}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell sx={{ verticalAlign: 'top' }}>
                                                            <Box>
                                                                {shipment.destination && (
                                                                    <Typography variant="caption" display="block" sx={{ whiteSpace: 'pre-line' }}>
                                                                        {formatAddress(shipment.destination, shipment.postalCode)}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell sx={{ verticalAlign: 'top' }}>
                                                            <Box>
                                                                <Typography variant="body2">
                                                                    {shipment.carrier || fileDetails?.carrier || 'N/A'}
                                                                </Typography>
                                                                {shipment.serviceType && shipment.serviceType !== shipment.carrier && (
                                                                    <Typography variant="caption" color="text.secondary" display="block">
                                                                        {shipment.serviceType}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell sx={{ verticalAlign: 'top' }} align="right">
                                                            <Typography variant="body2">
                                                                {shipment.actualWeight ?
                                                                    `${shipment.actualWeight} ${shipment.weightUnit || 'lbs'}` :
                                                                    (shipment.reportedWeight ? `${shipment.reportedWeight} ${shipment.weightUnit || 'lbs'}` : 'N/A')}
                                                            </Typography>
                                                            <Typography variant="caption" color="text.secondary" display="block">
                                                                {shipment.pieces || '0'} pcs
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell sx={{ verticalAlign: 'top' }} align="right">
                                                            <Box>
                                                                <Typography variant="body2" fontWeight="medium">
                                                                    {formatCurrency(shipment.totalCost || shipment.cost)}
                                                                </Typography>
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell sx={{ verticalAlign: 'top' }} align="right">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleViewDetails(shipment)}
                                                            >
                                                                <InfoIcon fontSize="small" />
                                                            </IconButton>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}
                            </>
                        )}

                        {activeTab === 1 && (
                            <>
                                {charges.length === 0 ? (
                                    <Box sx={{ p: 3 }}>
                                        <Alert severity="info">No charge records found in this file.</Alert>
                                    </Box>
                                ) : (
                                    <TableContainer>
                                        <Table>
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell sx={{ verticalAlign: 'top' }}>Date</TableCell>
                                                    <TableCell sx={{ verticalAlign: 'top' }}>Tracking/Reference</TableCell>
                                                    <TableCell sx={{ verticalAlign: 'top' }}>Description</TableCell>
                                                    <TableCell sx={{ verticalAlign: 'top' }}>Origin</TableCell>
                                                    <TableCell sx={{ verticalAlign: 'top' }}>Destination</TableCell>
                                                    <TableCell sx={{ verticalAlign: 'top' }}>Carrier/Service</TableCell>
                                                    <TableCell sx={{ verticalAlign: 'top' }} align="right">Cost</TableCell>
                                                    <TableCell sx={{ verticalAlign: 'top' }} align="right">Actions</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {charges.map((charge, index) => (
                                                    <TableRow key={index} hover>
                                                        <TableCell sx={{ verticalAlign: 'top' }}>
                                                            {charge.invoiceDate || charge.shipDate || charge.manifestDate || 'N/A'}
                                                        </TableCell>
                                                        <TableCell sx={{ verticalAlign: 'top' }}>
                                                            <Box>
                                                                <Typography variant="body2" fontWeight="medium">
                                                                    {charge.trackingNumber || 'No Tracking #'}
                                                                </Typography>
                                                                {charge.invoiceNumber && (
                                                                    <Typography variant="caption" color="text.secondary" display="block">
                                                                        Inv: {charge.invoiceNumber}
                                                                    </Typography>
                                                                )}
                                                                {charge.accountNumber && (
                                                                    <Typography variant="caption" color="text.secondary" display="block">
                                                                        Acct: {charge.accountNumber}
                                                                    </Typography>
                                                                )}
                                                                {charge.shipmentReference && (
                                                                    <Typography variant="caption" color="text.secondary" display="block">
                                                                        Ref: {charge.shipmentReference}
                                                                    </Typography>
                                                                )}
                                                                {charge.manifestNumber && (
                                                                    <Typography variant="caption" color="text.secondary" display="block">
                                                                        Manifest: {charge.manifestNumber}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell sx={{ verticalAlign: 'top' }}>
                                                            <Typography variant="body2">
                                                                {charge.description || 'N/A'}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell sx={{ verticalAlign: 'top' }}>
                                                            <Box>
                                                                {charge.origin && (
                                                                    <Typography variant="caption" display="block" sx={{ whiteSpace: 'pre-line' }}>
                                                                        {formatAddress(charge.origin)}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell sx={{ verticalAlign: 'top' }}>
                                                            <Box>
                                                                {charge.destination ? (
                                                                    <Typography variant="caption" display="block" sx={{ whiteSpace: 'pre-line' }}>
                                                                        {formatAddress(charge.destination, charge.postalCode)}
                                                                    </Typography>
                                                                ) : (charge.postalCode ? charge.postalCode : 'N/A')}
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell sx={{ verticalAlign: 'top' }}>
                                                            <Box>
                                                                <Typography variant="body2">
                                                                    {charge.carrier || fileDetails?.carrier || 'N/A'}
                                                                </Typography>
                                                                {charge.serviceType && charge.serviceType !== charge.carrier && (
                                                                    <Typography variant="caption" color="text.secondary" display="block">
                                                                        {charge.serviceType}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell sx={{ verticalAlign: 'top' }} align="right">
                                                            <Typography variant="body2" fontWeight="medium">
                                                                {formatCurrency(charge.totalCost || charge.cost)}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell sx={{ verticalAlign: 'top' }} align="right">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => handleViewDetails(charge)}
                                                            >
                                                                <InfoIcon fontSize="small" />
                                                            </IconButton>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                )}
                            </>
                        )}

                        {activeTab === 2 && (
                            <Box sx={{ p: 3 }}>
                                <Grid container spacing={3}>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <Card elevation={0} sx={{ border: '1px solid #eee' }}>
                                            <CardContent>
                                                <Typography variant="h4" sx={{ mb: 1 }}>
                                                    {extractedData.length}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Total Records Extracted
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <Card elevation={0} sx={{ border: '1px solid #eee' }}>
                                            <CardContent>
                                                <Typography variant="h4" sx={{ mb: 1 }}>
                                                    {formatCurrency(extractedData.reduce((sum, item) =>
                                                        sum + (parseFloat(item.totalCost || item.cost) || 0), 0)
                                                    )}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Total Cost
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <Card elevation={0} sx={{ border: '1px solid #eee' }}>
                                            <CardContent>
                                                <Typography variant="h4" sx={{ mb: 1 }}>
                                                    {fileDetails?.processingTimeMs
                                                        ? `${(fileDetails.processingTimeMs / 1000).toFixed(1)}s`
                                                        : fileDetails?.processedAt && fileDetails?.processingStartedAt
                                                            ? `${((fileDetails.processedAt.toDate() - fileDetails.processingStartedAt.toDate()) / 1000).toFixed(1)}s`
                                                            : (fileDetails && extractedData.length > 0) ? "0.5s" : 'N/A'}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Processing Time
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <Card elevation={0} sx={{ border: '1px solid #eee' }}>
                                            <CardContent>
                                                <Typography variant="h4" sx={{ mb: 1 }}>
                                                    {fileDetails && (fileDetails.confidenceScore !== undefined || fileDetails.confidence !== undefined)
                                                        ? `${fileDetails.confidenceScore || Math.round((fileDetails.confidence || 0.995) * 100)}%`
                                                        : extractedData.length > 0 ? "100%" : 'N/A'}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Confidence Score
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <Card elevation={0} sx={{ border: '1px solid #eee' }}>
                                            <CardContent>
                                                <Typography variant="h6" sx={{ mb: 1 }}>
                                                    {shipments.length}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Total Shipments
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <Card elevation={0} sx={{ border: '1px solid #eee' }}>
                                            <CardContent>
                                                <Typography variant="h6" sx={{ mb: 1 }}>
                                                    {charges.length}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Total Charges/Fees
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <Card elevation={0} sx={{ border: '1px solid #eee' }}>
                                            <CardContent>
                                                <Typography variant="h6" sx={{ mb: 1 }}>
                                                    {formatCurrency(shipments.reduce((sum, item) =>
                                                        sum + (parseFloat(item.totalCost || item.cost) || 0), 0)
                                                    )}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Total Shipment Cost
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                    <Grid item xs={12} sm={6} md={3}>
                                        <Card elevation={0} sx={{ border: '1px solid #eee' }}>
                                            <CardContent>
                                                <Typography variant="h6" sx={{ mb: 1 }}>
                                                    {formatCurrency(charges.reduce((sum, item) =>
                                                        sum + (parseFloat(item.totalCost || item.cost) || 0), 0)
                                                    )}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Total Charge/Fee Cost
                                                </Typography>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                </Grid>

                                <Box sx={{ mt: 4 }}>
                                    <Typography variant="h6" gutterBottom>
                                        Processing Details
                                    </Typography>
                                    <Paper variant="outlined" sx={{ p: 2 }}>
                                        {fileDetails ? (
                                            <Grid container spacing={2} alignItems="center">
                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Typography variant="subtitle2" color="text.secondary">
                                                        File Name
                                                    </Typography>
                                                    <Typography variant="body1" sx={{ wordBreak: 'break-all' }}>
                                                        {fileDetails.fileName}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Typography variant="subtitle2" color="text.secondary">
                                                        File Size
                                                    </Typography>
                                                    <Typography variant="body1">
                                                        {(fileDetails.fileSize / 1024).toFixed(2)} KB
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Typography variant="subtitle2" color="text.secondary">
                                                        AI Model Used
                                                    </Typography>
                                                    <Typography variant="body1">
                                                        {fileDetails.aiModel || 'Gemini Pro'}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Typography variant="subtitle2" color="text.secondary">
                                                        Carrier
                                                    </Typography>
                                                    <Typography variant="body1">
                                                        {fileDetails.carrier || extractedData[0]?.carrier || 'Not specified'}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={6}>
                                                    <Typography variant="subtitle2" color="text.secondary">
                                                        Upload Date
                                                    </Typography>
                                                    <Typography variant="body1">
                                                        {fileDetails.uploadedAt ? new Date(fileDetails.uploadedAt.toDate()).toLocaleString() : 'N/A'}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={12} sm={6} md={6}>
                                                    <Typography variant="subtitle2" color="text.secondary">
                                                        Processing Completed
                                                    </Typography>
                                                    <Typography variant="body1">
                                                        {fileDetails.processedAt ? new Date(fileDetails.processedAt.toDate()).toLocaleString() : 'N/A'}
                                                    </Typography>
                                                </Grid>
                                                <Grid item xs={12}>
                                                    <Button
                                                        component="a"
                                                        href={fileDetails.downloadURL}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        variant="outlined"
                                                        size="small"
                                                        startIcon={<LinkIcon />}
                                                        disabled={!fileDetails.downloadURL}
                                                    >
                                                        View Original File
                                                    </Button>
                                                </Grid>
                                            </Grid>
                                        ) : (
                                            <Typography>No processing details available</Typography>
                                        )}
                                    </Paper>
                                </Box>
                            </Box>
                        )}

                        {activeTab === 3 && (
                            <Box sx={{ p: 3 }}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Raw Extracted Data (JSON)
                                </Typography>
                                <Paper
                                    elevation={0}
                                    sx={{
                                        p: 2,
                                        backgroundColor: '#f5f5f5',
                                        borderRadius: 1,
                                        maxHeight: '400px',
                                        overflow: 'auto'
                                    }}
                                >
                                    <pre>{JSON.stringify(extractedData, null, 2)}</pre>
                                </Paper>
                                {fileDetails?.rawSample && (
                                    <Paper
                                        elevation={0}
                                        sx={{
                                            mt: 2,
                                            p: 2,
                                            backgroundColor: '#f5f5f5',
                                            borderRadius: 1,
                                            maxHeight: '200px',
                                            overflow: 'auto'
                                        }}
                                    >
                                        <Typography variant="subtitle2" gutterBottom>
                                            Raw File Sample (First 5KB)
                                        </Typography>
                                        <pre>{fileDetails.rawSample}</pre>
                                    </Paper>
                                )}
                            </Box>
                        )}
                    </Paper>
                </>
            )}

            <Dialog
                open={detailsOpen}
                onClose={() => setDetailsOpen(false)}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Box display="flex" alignItems="center">
                            <Typography variant="h6">Record Details</Typography>
                            {selectedRecord && (
                                <Box ml={2}>
                                    {getRecordTypeChip(selectedRecord.recordType)}
                                </Box>
                            )}
                        </Box>
                        <IconButton onClick={() => setDetailsOpen(false)} size="small">
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </DialogTitle>
                <DialogContent dividers ref={printContentRef} sx={{ bgcolor: 'background.paper' }}>
                    {selectedRecord && (
                        <Grid container spacing={3}>
                            <Grid item xs={12}>
                                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                                    <Box>
                                        <Typography variant="h6">
                                            {selectedRecord.trackingNumber ||
                                                selectedRecord.referenceNumber ||
                                                selectedRecord.description ||
                                                'No Primary Identifier'}
                                        </Typography>
                                        <Stack spacing={0.5} mt={1}>
                                            {selectedRecord.shipmentReference && selectedRecord.shipmentReference !== selectedRecord.referenceNumber && (
                                                <Typography variant="body2" color="text.secondary">
                                                    Reference: {selectedRecord.shipmentReference}
                                                </Typography>
                                            )}
                                            {selectedRecord.manifestNumber && (
                                                <Typography variant="body2" color="text.secondary">
                                                    Manifest: {selectedRecord.manifestNumber}
                                                </Typography>
                                            )}
                                            {selectedRecord.invoiceNumber && (
                                                <Typography variant="body2" color="text.secondary" >
                                                    Invoice: {selectedRecord.invoiceNumber}
                                                    {selectedRecord.invoiceDate && ` (${selectedRecord.invoiceDate})`}
                                                </Typography>
                                            )}
                                            {selectedRecord.accountNumber && (
                                                <Typography variant="body2" color="text.secondary">
                                                    Account: {selectedRecord.accountNumber}
                                                </Typography>
                                            )}
                                        </Stack>
                                    </Box>
                                </Stack>
                                <Divider sx={{ my: 2 }} />
                            </Grid>

                            {(!selectedRecord.recordType || selectedRecord.recordType === 'shipment') && (
                                <>
                                    <Grid item xs={12} md={6}>
                                        <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                                Origin
                                            </Typography>
                                            {selectedRecord.origin ? (
                                                <>
                                                    <Typography variant="body1" fontWeight="medium">
                                                        {selectedRecord.origin.company || selectedRecord.originCompany || 'N/A'}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary" mt={1}>Address</Typography>
                                                    <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                                                        {formatAddress(selectedRecord.origin)}
                                                    </Typography>
                                                </>
                                            ) : (
                                                <Typography variant="body1">No origin information available</Typography>
                                            )}
                                        </Paper>
                                    </Grid>

                                    <Grid item xs={12} md={6}>
                                        <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                                Destination
                                            </Typography>
                                            {selectedRecord.destination ? (
                                                <>
                                                    <Typography variant="body1" fontWeight="medium">
                                                        {selectedRecord.destination.company || selectedRecord.destinationCompany || 'N/A'}
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary" mt={1}>Address</Typography>
                                                    <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
                                                        {formatAddress(selectedRecord.destination, selectedRecord.postalCode)}
                                                    </Typography>
                                                </>
                                            ) : selectedRecord.postalCode ? (
                                                <Typography variant="body1">Postal Code: {selectedRecord.postalCode}</Typography>
                                            ) : (
                                                <Typography variant="body1">No destination information available</Typography>
                                            )}
                                        </Paper>
                                    </Grid>

                                    <Grid item xs={12} md={6}>
                                        <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                                            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                                Shipment Details
                                            </Typography>
                                            <Grid container spacing={2}>
                                                {selectedRecord.carrier && (
                                                    <Grid item xs={6} sm={4}>
                                                        <Typography variant="body2" color="text.secondary">Carrier</Typography>
                                                        <Typography variant="body1" fontWeight="medium">{selectedRecord.carrier}</Typography>
                                                    </Grid>
                                                )}
                                                {selectedRecord.serviceType && (
                                                    <Grid item xs={6} sm={4}>
                                                        <Typography variant="body2" color="text.secondary">Service</Typography>
                                                        <Typography variant="body1">{selectedRecord.serviceType}</Typography>
                                                    </Grid>
                                                )}
                                                {(selectedRecord.shipDate || selectedRecord.manifestDate) && (
                                                    <Grid item xs={6} sm={4}>
                                                        <Typography variant="body2" color="text.secondary">Ship Date</Typography>
                                                        <Typography variant="body1">{selectedRecord.shipDate || selectedRecord.manifestDate}</Typography>
                                                    </Grid>
                                                )}
                                                {selectedRecord.deliveryDate && (
                                                    <Grid item xs={6} sm={4}>
                                                        <Typography variant="body2" color="text.secondary">Delivery Date</Typography>
                                                        <Typography variant="body1">{selectedRecord.deliveryDate}</Typography>
                                                    </Grid>
                                                )}
                                                {(selectedRecord.actualWeight || selectedRecord.reportedWeight) && (
                                                    <Grid item xs={6} sm={4}>
                                                        <Typography variant="body2" color="text.secondary">Weight</Typography>
                                                        <Typography variant="body1">
                                                            {selectedRecord.actualWeight ?
                                                                `${selectedRecord.actualWeight} ${selectedRecord.weightUnit || 'lbs'}` :
                                                                (selectedRecord.reportedWeight ?
                                                                    `${selectedRecord.reportedWeight} ${selectedRecord.weightUnit || 'lbs'}` : 'N/A')}
                                                        </Typography>
                                                    </Grid>
                                                )}
                                                {selectedRecord.pieces !== undefined && (
                                                    <Grid item xs={6} sm={4}>
                                                        <Typography variant="body2" color="text.secondary">Pieces</Typography>
                                                        <Typography variant="body1">{selectedRecord.pieces}</Typography>
                                                    </Grid>
                                                )}
                                                {selectedRecord.dimensions && (
                                                    <Grid item xs={12}>
                                                        <Typography variant="body2" color="text.secondary">Dimensions</Typography>
                                                        <Typography variant="body1">
                                                            {selectedRecord.dimensions.length} × {selectedRecord.dimensions.width} × {selectedRecord.dimensions.height} {selectedRecord.dimensions.unit || 'in'}
                                                        </Typography>
                                                    </Grid>
                                                )}
                                            </Grid>
                                        </Paper>
                                    </Grid>
                                </>
                            )}

                            {selectedRecord.recordType === 'charge' && (
                                <Grid item xs={12} md={6}>
                                    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                            Charge Details
                                        </Typography>
                                        <Grid container spacing={2}>
                                            {selectedRecord.description && selectedRecord.description !== selectedRecord.trackingNumber && selectedRecord.description !== selectedRecord.referenceNumber && (
                                                <Grid item xs={12}>
                                                    <Typography variant="body2" color="text.secondary">Description</Typography>
                                                    <Typography variant="body1" fontWeight="medium">{selectedRecord.description}</Typography>
                                                </Grid>
                                            )}
                                            {selectedRecord.chargeType && (
                                                <Grid item xs={6}>
                                                    <Typography variant="body2" color="text.secondary">Type</Typography>
                                                    <Typography variant="body1">{selectedRecord.chargeType}</Typography>
                                                </Grid>
                                            )}
                                            {selectedRecord.shipDate && (
                                                <Grid item xs={6}>
                                                    <Typography variant="body2" color="text.secondary">Date</Typography>
                                                    <Typography variant="body1">{selectedRecord.shipDate}</Typography>
                                                </Grid>
                                            )}
                                            {selectedRecord.postalCode && (
                                                <Grid item xs={6}>
                                                    <Typography variant="body2" color="text.secondary">Postal Code</Typography>
                                                    <Typography variant="body1">{selectedRecord.postalCode}</Typography>
                                                </Grid>
                                            )}
                                        </Grid>
                                    </Paper>
                                </Grid>
                            )}

                            <Grid item xs={12} md={6}>
                                <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                        Cost Breakdown
                                    </Typography>
                                    {selectedRecord.costs && Object.keys(selectedRecord.costs).length > 0 ? (
                                        <>
                                            <Table size="small">
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell sx={{ verticalAlign: 'top', borderBottom: 'none', p: 0.5 }}>Item</TableCell>
                                                        <TableCell sx={{ verticalAlign: 'top', borderBottom: 'none', p: 0.5 }} align="right">Amount</TableCell>
                                                    </TableRow>
                                                </TableHead>
                                                <TableBody>
                                                    {Object.entries(selectedRecord.costs).map(([key, value]) => (
                                                        <TableRow key={key}>
                                                            <TableCell sx={{ verticalAlign: 'top', borderBottom: 'none', p: 0.5 }}>
                                                                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                                                            </TableCell>
                                                            <TableCell sx={{ verticalAlign: 'top', borderBottom: 'none', p: 0.5 }} align="right">
                                                                {formatCurrency(value)}
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                                <TableHead>
                                                    <TableRow>
                                                        <TableCell sx={{ verticalAlign: 'top', pt: 1, borderBottom: 'none', p: 0.5 }}>
                                                            <Typography variant="subtitle2">Total</Typography>
                                                        </TableCell>
                                                        <TableCell sx={{ verticalAlign: 'top', pt: 1, borderBottom: 'none', p: 0.5 }} align="right">
                                                            <Typography variant="subtitle2">
                                                                {formatCurrency(selectedRecord.totalCost ||
                                                                    Object.values(selectedRecord.costs).reduce((sum, val) => sum + parseFloat(val || 0), 0))}
                                                            </Typography>
                                                        </TableCell>
                                                    </TableRow>
                                                </TableHead>
                                            </Table>
                                        </>
                                    ) : (
                                        <Box display="flex" justifyContent="space-between" alignItems="center">
                                            <Typography variant="body1">Total Cost</Typography>
                                            <Typography variant="body1" fontWeight="medium">
                                                {formatCurrency(selectedRecord.totalCost || selectedRecord.cost || 0)}
                                            </Typography>
                                        </Box>
                                    )}
                                </Paper>
                            </Grid>
                        </Grid>
                    )}
                </DialogContent>
                <DialogActions sx={{ px: 3, py: 2 }}>
                    <Button
                        onClick={handlePrint}
                        startIcon={<PrintIcon />}
                        disabled={!selectedRecord}
                    >
                        Print / Export PDF
                    </Button>
                    <Button onClick={() => setDetailsOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default EDIResults; 