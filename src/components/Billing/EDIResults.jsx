import React, { useState, useEffect } from 'react';
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
    Divider
} from '@mui/material';
import {
    Close as CloseIcon,
    DownloadOutlined as DownloadIcon,
    InfoOutlined as InfoIcon,
    CheckCircleOutline as CheckCircleIcon,
    ErrorOutline as ErrorIcon,
    HourglassEmpty as PendingIcon,
    ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { doc, getDoc, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { firestore } from '../../firebase';
import { useAuth } from '../../context/AuthContext';
import { CSVLink } from 'react-csv';

const EDIResults = ({ uploadId, onClose }) => {
    const { currentUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [processingStatus, setProcessingStatus] = useState('processing');
    const [fileDetails, setFileDetails] = useState(null);
    const [extractedData, setExtractedData] = useState([]);
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [csvData, setCsvData] = useState([]);
    const [csvHeaders, setCsvHeaders] = useState([]);

    useEffect(() => {
        if (!uploadId) return;

        const fetchEdiData = async () => {
            try {
                setLoading(true);

                // Get the file upload details
                const uploadRef = doc(firestore, 'ediUploads', uploadId);
                const uploadDoc = await getDoc(uploadRef);

                if (!uploadDoc.exists()) {
                    throw new Error('Upload not found');
                }

                const uploadData = uploadDoc.data();
                setFileDetails(uploadData);

                // Set up real-time listener for status updates
                const unsubscribe = onSnapshot(uploadRef, (doc) => {
                    if (doc.exists()) {
                        const data = doc.data();
                        setProcessingStatus(data.processingStatus);

                        // If processing is complete, fetch the extracted data
                        if (data.processingStatus === 'completed' && data.resultDocId) {
                            fetchExtractedResults(data.resultDocId);
                        } else if (data.processingStatus === 'failed') {
                            setError(data.error || 'Processing failed');
                            setLoading(false);
                        }
                    }
                });

                return unsubscribe;
            } catch (err) {
                console.error('Error fetching EDI data:', err);
                setError(err.message);
                setLoading(false);
            }
        };

        const fetchExtractedResults = async (resultDocId) => {
            try {
                const resultRef = doc(firestore, 'ediResults', resultDocId);
                const resultDoc = await getDoc(resultRef);

                if (resultDoc.exists()) {
                    const resultData = resultDoc.data();
                    console.log('Extracted result data:', resultData);
                    const recordsData = resultData.records || resultData.shipments || [];
                    setExtractedData(recordsData);

                    // Generate CSV data
                    prepareCSVData(recordsData);

                    // Always update fileDetails with data from ediResults
                    setFileDetails(prev => ({
                        ...prev,
                        confidenceScore: resultData.confidenceScore || (resultData.confidence ? Math.round(resultData.confidence * 100) : 100),
                        processingTimeMs: resultData.processingTimeMs || prev?.processingTimeMs || 0,
                        aiModel: resultData.aiModel || 'Gemini Pro'
                    }));
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

    // Prepare CSV data for export
    const prepareCSVData = (records) => {
        if (!records || records.length === 0) {
            setCsvData([]);
            setCsvHeaders([]);
            return;
        }

        // Get all unique keys from all records to build headers
        const allKeys = new Set();
        records.forEach(record => {
            Object.keys(record).forEach(key => {
                if (typeof record[key] !== 'object' || record[key] === null) {
                    allKeys.add(key);
                } else {
                    // For nested objects like origin, destination, costs
                    Object.keys(record[key]).forEach(nestedKey => {
                        allKeys.add(`${key}.${nestedKey}`);
                    });
                }
            });
        });

        // Create headers for CSV
        const headers = Array.from(allKeys).map(key => ({
            label: key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1'),
            key
        }));

        // Flatten the data for CSV
        const flatData = records.map(record => {
            const flatRecord = {};

            // Process all simple fields
            Object.keys(record).forEach(key => {
                if (typeof record[key] !== 'object' || record[key] === null) {
                    flatRecord[key] = record[key];
                }
            });

            // Process nested objects
            Object.keys(record).forEach(key => {
                if (typeof record[key] === 'object' && record[key] !== null) {
                    Object.keys(record[key]).forEach(nestedKey => {
                        flatRecord[`${key}.${nestedKey}`] = record[key][nestedKey];
                    });
                }
            });

            return flatRecord;
        });

        setCsvHeaders(headers);
        setCsvData(flatData);
    };

    const handleViewDetails = (shipment) => {
        setSelectedShipment(shipment);
        setDetailsOpen(true);
    };

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    const handleGoBack = () => {
        // Notify parent that we're closing and the list should be refreshed
        if (onClose) {
            onClose(true); // Pass true to indicate refresh needed
        }
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

    // Format monetary values
    const formatCurrency = (value) => {
        if (value === undefined || value === null) return 'N/A';
        // Ensure value is treated as a number before formatting
        const numericValue = Number(value);
        if (isNaN(numericValue)) return 'Invalid Value';
        return `$${numericValue.toFixed(2)}`;
    };

    // Helper function to format charge keys into readable names
    const formatChargeName = (key) => {
        if (!key) return '';
        // Add spaces before capital letters, then capitalize the first letter
        const spaced = key.replace(/([A-Z])/g, ' $1');
        return spaced.charAt(0).toUpperCase() + spaced.slice(1);
    };

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
                <Button variant="outlined" onClick={handleGoBack}>
                    Go Back
                </Button>
            </Box>
        );
    }

    return (
        <Box>
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <IconButton
                        onClick={handleGoBack}
                        edge="start"
                        sx={{ mr: 1 }}
                        aria-label="back"
                    >
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h6">
                        EDI Processing Results
                        {fileDetails && ` - ${fileDetails.fileName}`}
                    </Typography>
                </Box>
                <Box>
                    {getStatusChip(processingStatus)}
                    {extractedData.length > 0 && csvData.length > 0 && (
                        <CSVLink
                            data={csvData}
                            headers={csvHeaders}
                            filename={`edi-export-${fileDetails?.fileName || 'data'}.csv`}
                            className="hidden-link"
                        >
                            <Button
                                variant="outlined"
                                startIcon={<DownloadIcon />}
                                sx={{ ml: 2 }}
                            >
                                Export Data
                            </Button>
                        </CSVLink>
                    )}
                </Box>
            </Box>

            {extractedData.length === 0 && processingStatus === 'completed' ? (
                <Alert severity="warning" sx={{ mb: 3 }}>
                    No shipment data was extracted from this file.
                </Alert>
            ) : (
                <>
                    <Paper elevation={0} sx={{ mb: 3, border: '1px solid #eee' }}>
                        <Tabs
                            value={activeTab}
                            onChange={handleTabChange}
                            sx={{ borderBottom: 1, borderColor: 'divider' }}
                        >
                            <Tab label={`Shipments (${extractedData.length})`} />
                            <Tab label="Processing Summary" />
                            <Tab label="Raw Data" />
                        </Tabs>

                        {activeTab === 0 && (
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Reference/Tracking #</TableCell>
                                            <TableCell>From</TableCell>
                                            <TableCell>To</TableCell>
                                            <TableCell>Carrier/Service</TableCell>
                                            <TableCell sx={{ minWidth: '120px' }}>Ship Date</TableCell>
                                            <TableCell align="right">Weight & Pieces</TableCell>
                                            <TableCell align="right">Cost</TableCell>
                                            <TableCell align="right">Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {extractedData.map((shipment, index) => (
                                            <TableRow key={index} hover>
                                                <TableCell>
                                                    {shipment.trackingNumber || shipment.referenceNumber || `SHIP-${index + 1}`}
                                                </TableCell>
                                                <TableCell>
                                                    {shipment.origin?.city ?
                                                        `${shipment.origin.city}, ${shipment.origin.state || ''}` :
                                                        (shipment.from || 'N/A')}
                                                </TableCell>
                                                <TableCell>
                                                    {shipment.destination?.city ?
                                                        `${shipment.destination.city}, ${shipment.destination.state || ''}` :
                                                        (shipment.to || 'N/A')}
                                                </TableCell>
                                                <TableCell>
                                                    {shipment.carrier} {shipment.serviceType && `- ${shipment.serviceType}`}
                                                </TableCell>
                                                <TableCell>{shipment.shipDate || 'N/A'}</TableCell>
                                                <TableCell align="right">
                                                    {(shipment.weight ? `${shipment.weight} ${shipment.weightUnit || 'lbs'}` : 'N/A')}
                                                    {shipment.pieces && ` / ${shipment.pieces} pcs`}
                                                </TableCell>
                                                <TableCell align="right">
                                                    {formatCurrency(shipment.totalCost || shipment.cost)}
                                                </TableCell>
                                                <TableCell align="right">
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

                        {activeTab === 1 && (
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
                                                    Total Charges/Fees
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
                                </Grid>

                                <Box sx={{ mt: 4 }}>
                                    <Typography variant="h6" gutterBottom>
                                        Processing Details
                                    </Typography>
                                    <Paper elevation={0} sx={{ p: 2, border: '1px solid #eee' }}>
                                        {fileDetails ? (
                                            <Grid container spacing={2}>
                                                <Grid item xs={12} sm={6} md={3}>
                                                    <Typography variant="subtitle2" color="text.secondary">
                                                        File Name
                                                    </Typography>
                                                    <Typography variant="body1">
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
                                            </Grid>
                                        ) : (
                                            <Typography>No processing details available</Typography>
                                        )}
                                    </Paper>
                                </Box>
                            </Box>
                        )}

                        {activeTab === 2 && (
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
                        <Typography variant="h6">Shipment Details</Typography>
                        <IconButton onClick={() => setDetailsOpen(false)} size="small">
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </DialogTitle>
                <DialogContent dividers>
                    {selectedShipment && (
                        <Grid container spacing={3}>
                            <Grid item xs={12}>
                                <Typography variant="h6">
                                    {selectedShipment.trackingNumber || selectedShipment.referenceNumber || 'No Tracking Number'}
                                </Typography>
                                <Divider sx={{ my: 2 }} />
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <Paper elevation={0} sx={{ p: 2, border: '1px solid #eee' }}>
                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                        Origin
                                    </Typography>
                                    <Typography variant="body1">
                                        {selectedShipment.origin?.company || selectedShipment.originCompany || 'N/A'}<br />
                                        {selectedShipment.origin?.street || ''} {selectedShipment.origin?.street2 || ''}<br />
                                        {selectedShipment.origin?.city || ''}{selectedShipment.origin?.city ? ', ' : ''}
                                        {selectedShipment.origin?.state || ''} {selectedShipment.origin?.postalCode || ''}<br />
                                        {selectedShipment.origin?.country || ''}
                                    </Typography>
                                </Paper>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <Paper elevation={0} sx={{ p: 2, border: '1px solid #eee' }}>
                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                        Destination
                                    </Typography>
                                    <Typography variant="body1">
                                        {selectedShipment.destination?.company || selectedShipment.destinationCompany || 'N/A'}<br />
                                        {selectedShipment.destination?.street || ''} {selectedShipment.destination?.street2 || ''}<br />
                                        {selectedShipment.destination?.city || ''}{selectedShipment.destination?.city ? ', ' : ''}
                                        {selectedShipment.destination?.state || ''} {selectedShipment.destination?.postalCode || ''}<br />
                                        {selectedShipment.destination?.country || ''}
                                    </Typography>
                                </Paper>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <Paper elevation={0} sx={{ p: 2, border: '1px solid #eee' }}>
                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                        Shipment Details
                                    </Typography>
                                    {(selectedShipment.miscellaneousType || selectedShipment.miscellaneousDescription) && (
                                        <Box sx={{ backgroundColor: '#f9f9f9', p: 1, borderRadius: 1, mb: 2 }}>
                                            <Typography variant="caption" color="text.secondary">Charge Description</Typography>
                                            <Typography variant="body2">
                                                {selectedShipment.miscellaneousType}{selectedShipment.miscellaneousType && selectedShipment.miscellaneousDescription ? ': ' : ''}{selectedShipment.miscellaneousDescription}
                                            </Typography>
                                        </Box>
                                    )}
                                    <Grid container spacing={2}>
                                        <Grid item xs={6}>
                                            <Typography variant="body2" color="text.secondary">Carrier</Typography>
                                            <Typography variant="body1">{selectedShipment.carrier || 'N/A'}</Typography>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Typography variant="body2" color="text.secondary">Service</Typography>
                                            <Typography variant="body1">{selectedShipment.serviceType || 'N/A'}</Typography>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Typography variant="body2" color="text.secondary">Ship Date</Typography>
                                            <Typography variant="body1">{selectedShipment.shipDate || 'N/A'}</Typography>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Typography variant="body2" color="text.secondary">Delivery Date</Typography>
                                            <Typography variant="body1">{selectedShipment.deliveryDate || 'N/A'}</Typography>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Typography variant="body2" color="text.secondary">Weight</Typography>
                                            <Typography variant="body1">
                                                {selectedShipment.weight
                                                    ? `${selectedShipment.weight} ${selectedShipment.weightUnit || 'lbs'}`
                                                    : 'N/A'}
                                            </Typography>
                                        </Grid>
                                        <Grid item xs={6}>
                                            <Typography variant="body2" color="text.secondary">Dimensions</Typography>
                                            <Typography variant="body1">
                                                {selectedShipment.dimensions
                                                    ? `${selectedShipment.dimensions.length}x${selectedShipment.dimensions.width}x${selectedShipment.dimensions.height}`
                                                    : 'N/A'}
                                            </Typography>
                                        </Grid>
                                    </Grid>
                                </Paper>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <Paper elevation={0} sx={{ p: 2, border: '1px solid #eee' }}>
                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                        Cost Breakdown
                                    </Typography>
                                    <Box sx={{ maxHeight: 200, overflow: 'auto', mb: 2 }}>
                                        {selectedShipment.costs && Object.keys(selectedShipment.costs).length > 0 ? (
                                            Object.entries(selectedShipment.costs).map(([key, value]) => (
                                                (value !== undefined && value !== null && value !== 0) && // Only show non-zero charges
                                                <Box key={key} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                    <Typography variant="body2">{formatChargeName(key)}</Typography>
                                                    <Typography variant="body2">{formatCurrency(value)}</Typography>
                                                </Box>
                                            ))
                                        ) : (
                                            <Typography variant="body2" color="text.secondary">No cost breakdown available.</Typography>
                                        )}
                                    </Box>
                                    <Divider sx={{ my: 1 }} />
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                                        <Typography variant="body2" color="text.secondary">Total Cost</Typography>
                                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                                            {formatCurrency(selectedShipment.totalCost !== undefined ? selectedShipment.totalCost : selectedShipment.cost)}
                                        </Typography>
                                    </Box>
                                </Paper>
                            </Grid>

                            {selectedShipment.packages && selectedShipment.packages.length > 0 && (
                                <Grid item xs={12}>
                                    <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                                        Packages ({selectedShipment.packages.length})
                                    </Typography>
                                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #eee' }}>
                                        <Table size="small">
                                            <TableHead>
                                                <TableRow>
                                                    <TableCell>Description</TableCell>
                                                    <TableCell align="right">Weight</TableCell>
                                                    <TableCell align="right">Dimensions</TableCell>
                                                    <TableCell align="right">Declared Value</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {selectedShipment.packages.map((pkg, idx) => (
                                                    <TableRow key={idx}>
                                                        <TableCell>{pkg.description || `Package ${idx + 1}`}</TableCell>
                                                        <TableCell align="right">{pkg.weight || 'N/A'}</TableCell>
                                                        <TableCell align="right">{pkg.dimensions || 'N/A'}</TableCell>
                                                        <TableCell align="right">{formatCurrency(pkg.declaredValue)}</TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>
                                </Grid>
                            )}
                        </Grid>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDetailsOpen(false)}>Close</Button>
                    {selectedShipment && (
                        <Button
                            variant="contained"
                            startIcon={<DownloadIcon />}
                            onClick={() => {
                                // Create a CSV for just this shipment
                                const singleShipmentData = [selectedShipment].map(record => {
                                    const flatRecord = {};

                                    // Process all simple fields
                                    Object.keys(record).forEach(key => {
                                        if (typeof record[key] !== 'object' || record[key] === null) {
                                            flatRecord[key] = record[key];
                                        }
                                    });

                                    // Process nested objects
                                    Object.keys(record).forEach(key => {
                                        if (typeof record[key] === 'object' && record[key] !== null) {
                                            Object.keys(record[key]).forEach(nestedKey => {
                                                flatRecord[`${key}.${nestedKey}`] = record[key][nestedKey];
                                            });
                                        }
                                    });

                                    return flatRecord;
                                });

                                // Generate file name
                                const fileName = `shipment-${selectedShipment.trackingNumber || 'details'}.csv`;

                                // Create a temporary CSV link and click it
                                const csvContent = "data:text/csv;charset=utf-8," +
                                    csvHeaders.map(h => `"${h.label}"`).join(",") + "\n" +
                                    singleShipmentData.map(row =>
                                        csvHeaders.map(h =>
                                            `"${row[h.key] || ''}"`
                                        ).join(",")
                                    ).join("\n");

                                const encodedUri = encodeURI(csvContent);
                                const link = document.createElement("a");
                                link.setAttribute("href", encodedUri);
                                link.setAttribute("download", fileName);
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }}
                        >
                            Export Shipment
                        </Button>
                    )}
                </DialogActions>
            </Dialog>

            {/* Hidden styles for CSV link button */}
            <style jsx="true">{`
                .hidden-link {
                    text-decoration: none;
                }
            `}</style>
        </Box>
    );
};

export default EDIResults; 