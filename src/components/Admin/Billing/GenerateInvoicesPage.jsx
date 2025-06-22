import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Stepper,
    Step,
    StepLabel,
    Button,
    Typography,
    CircularProgress,
    Alert,
    Grid,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Checkbox
} from '@mui/material';
import { CheckCircleOutline as CheckCircleIcon, NavigateNext, NavigateBefore } from '@mui/icons-material';

const steps = [
    'Review Shipments to be Invoiced',
    'Generating Invoices',
    'Process Complete'
];

// Production-ready: fetch actual uninvoiced shipments from database
// const mockShipments = []; // Removed for production

const GenerateInvoicesPage = () => {
    const [activeStep, setActiveStep] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedShipments, setSelectedShipments] = useState({});
    const [generatedInvoiceCount, setGeneratedInvoiceCount] = useState(0);
    const [uninvoicedShipments, setUninvoicedShipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchUninvoicedShipments();
    }, []);

    const fetchUninvoicedShipments = async () => {
        try {
            setLoading(true);
            // TODO: Implement actual database query for uninvoiced shipments
            // const shipmentsRef = collection(db, 'shipments');
            // const q = query(shipmentsRef, where('invoiced', '==', false));
            // const querySnapshot = await getDocs(q);
            // const shipments = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // For now, set empty array for production
            const shipments = [];
            setUninvoicedShipments(shipments);

            // Pre-select all shipments by default for review
            const initialSelection = {};
            shipments.forEach(shipment => {
                initialSelection[shipment.id] = true;
            });
            setSelectedShipments(initialSelection);
        } catch (err) {
            console.error('Error fetching uninvoiced shipments:', err);
            setError('Failed to load uninvoiced shipments');
        } finally {
            setLoading(false);
        }
    };

    const handleNext = () => {
        if (activeStep === 0) { // Moving from Review to Generating
            const count = Object.values(selectedShipments).filter(Boolean).length;
            if (count === 0) {
                alert("Please select at least one shipment to invoice."); // Replace with snackbar ideally
                return;
            }
            setGeneratedInvoiceCount(count);
            setIsProcessing(true);
            setActiveStep((prevActiveStep) => prevActiveStep + 1);
            // Simulate generation process
            setTimeout(() => {
                setIsProcessing(false);
                setActiveStep((prevActiveStep) => prevActiveStep + 1);
            }, 3000); // Simulate 3 seconds of generation time
        } else if (activeStep === steps.length - 1) {
            // Handle finish - maybe navigate away or reset
            setActiveStep(0);
            setSelectedShipments({});
            fetchUninvoicedShipments(); // Refresh the list
        }
    };

    const handleBack = () => {
        setActiveStep((prevActiveStep) => prevActiveStep - 1);
    };

    const handleSelectShipment = (shipmentId) => {
        setSelectedShipments(prev => ({
            ...prev,
            [shipmentId]: !prev[shipmentId]
        }));
    };

    const handleSelectAllClick = (event) => {
        if (event.target.checked) {
            const newSelecteds = {};
            uninvoicedShipments.forEach(s => newSelecteds[s.id] = true);
            setSelectedShipments(newSelecteds);
            return;
        }
        setSelectedShipments({});
    };

    const numSelected = Object.values(selectedShipments).filter(Boolean).length;
    const rowCount = uninvoicedShipments.length;

    function getStepContent(step) {
        switch (step) {
            case 0:
                return (
                    <Box>
                        <Typography variant="h6" gutterBottom>Select Shipments to Invoice</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            Review the list of uninvoiced shipments below. Uncheck any shipments you wish to exclude from this invoice run.
                        </Typography>
                        <TableContainer component={Paper} elevation={1} variant="outlined">
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                color="primary"
                                                indeterminate={numSelected > 0 && numSelected < rowCount}
                                                checked={rowCount > 0 && numSelected === rowCount}
                                                onChange={handleSelectAllClick}
                                                inputProps={{ 'aria-label': 'select all shipments' }}
                                            />
                                        </TableCell>
                                        <TableCell>Shipment ID</TableCell>
                                        <TableCell>Customer</TableCell>
                                        <TableCell>Date</TableCell>
                                        <TableCell>Carrier</TableCell>
                                        <TableCell>Service</TableCell>
                                        <TableCell align="right">Amount</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={7} align="center">
                                                <Box sx={{ py: 3 }}>
                                                    <CircularProgress size={24} />
                                                    <Typography sx={{ mt: 1, fontSize: '12px' }}>Loading uninvoiced shipments...</Typography>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ) : error ? (
                                        <TableRow>
                                            <TableCell colSpan={7} align="center">
                                                <Alert severity="error" sx={{ mt: 2 }}>
                                                    {error}
                                                </Alert>
                                            </TableCell>
                                        </TableRow>
                                    ) : uninvoicedShipments.length > 0 ? (
                                        uninvoicedShipments.map((shipment) => (
                                            <TableRow key={shipment.id} hover onClick={() => handleSelectShipment(shipment.id)} sx={{ cursor: 'pointer' }}>
                                                <TableCell padding="checkbox">
                                                    <Checkbox
                                                        color="primary"
                                                        checked={selectedShipments[shipment.id] || false}
                                                        inputProps={{ 'aria-labelledby': `shipment-checkbox-${shipment.id}` }}
                                                        size="small"
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>{shipment.id}</TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>{shipment.customerName}</TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>{shipment.date}</TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>{shipment.carrier}</TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>{shipment.service}</TableCell>
                                                <TableCell align="right" sx={{ fontSize: '12px' }}>${(shipment.amount || 0).toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={7} align="center">
                                                <Box sx={{ py: 4 }}>
                                                    <Typography variant="body1" color="text.secondary" sx={{ fontSize: '12px' }}>
                                                        No uninvoiced shipments found
                                                    </Typography>
                                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '11px', mt: 1 }}>
                                                        All shipments have been invoiced or there are no shipments to invoice
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <Typography sx={{ mt: 2 }}>Selected {numSelected} of {rowCount} shipments for invoicing.</Typography>
                    </Box>
                );
            case 1:
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 5 }}>
                        <CircularProgress size={60} sx={{ mb: 3 }} />
                        <Typography variant="h6">Generating {generatedInvoiceCount} Invoices...</Typography>
                        <Typography variant="body1" color="text.secondary">Please wait, this may take a few moments.</Typography>
                    </Box>
                );
            case 2:
                return (
                    <Box sx={{ textAlign: 'center', py: 5 }}>
                        <CheckCircleIcon color="success" sx={{ fontSize: 70, mb: 2 }} />
                        <Typography variant="h5" gutterBottom>Invoice Generation Complete!</Typography>
                        <Typography variant="body1" color="text.secondary">
                            Successfully generated {generatedInvoiceCount} invoices.
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            These invoices are now available in the Invoices tab for review and further processing.
                        </Typography>
                    </Box>
                );
            default:
                return 'Unknown step';
        }
    }

    return (
        <Box sx={{ p: 3 }} className="generate-invoices-page">
            <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
                Generate Customer Invoices
            </Typography>
            <Paper elevation={2} sx={{ p: 3 }}>
                <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>
                <Box sx={{ minHeight: 300, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    {getStepContent(activeStep)}
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2, mt: 3, borderTop: '1px solid lightgray' }}>
                    <Button
                        color="inherit"
                        disabled={activeStep === 0 || isProcessing}
                        onClick={handleBack}
                        sx={{ mr: 1 }}
                        startIcon={<NavigateBefore />}
                    >
                        Back
                    </Button>
                    <Box sx={{ flex: '1 1 auto' }} />
                    <Button onClick={handleNext} variant="contained" disabled={isProcessing || activeStep === 1} endIcon={activeStep !== steps.length - 1 && <NavigateNext />}>
                        {activeStep === steps.length - 1 ? 'Finish & Start Over' : (activeStep === 0 ? `Generate ${numSelected} Invoices` : 'Next')}
                    </Button>
                </Box>
            </Paper>
        </Box>
    );
};

export default GenerateInvoicesPage; 