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
    Checkbox,
    Card,
    CardContent,
    Divider,
    Chip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Switch,
    FormControlLabel,
    Tooltip
} from '@mui/material';
import {
    CheckCircleOutline as CheckCircleIcon,
    NavigateNext,
    NavigateBefore,
    Download as DownloadIcon,
    Email as EmailIcon,
    Receipt as ReceiptIcon,
    AccountBalance as AccountBalanceIcon
} from '@mui/icons-material';
import { collection, getDocs, query, where, orderBy, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useSnackbar } from 'notistack';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase';

const steps = [
    'Review Uninvoiced Shipments',
    'Configure Invoice Settings',
    'Generate & Send Invoices',
    'Process Complete'
];

const GenerateInvoicesPage = () => {
    const { enqueueSnackbar } = useSnackbar();
    const [activeStep, setActiveStep] = useState(0);
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedShipments, setSelectedShipments] = useState({});
    const [uninvoicedShipments, setUninvoicedShipments] = useState([]);
    const [groupedShipments, setGroupedShipments] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [invoiceSettings, setInvoiceSettings] = useState({
        includeShipmentDetails: true,
        includeChargeBreakdown: true,
        emailToCustomers: true,
        paymentTerms: 'Net 30',
        invoicePrefix: 'INV',
        groupByCompany: true
    });
    const [generationResults, setGenerationResults] = useState({
        successful: 0,
        failed: 0,
        totalInvoices: 0,
        invoiceNumbers: []
    });

    useEffect(() => {
        fetchUninvoicedShipments();
    }, []);

    const fetchUninvoicedShipments = async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch all shipments and filter locally (since we need to check multiple conditions)
            const shipmentsRef = collection(db, 'shipments');
            const shipmentsQuery = query(
                shipmentsRef,
                where('status', '!=', 'draft'),
                orderBy('status'),
                orderBy('createdAt', 'desc')
            );
            const shipmentsSnapshot = await getDocs(shipmentsQuery);

            const shipments = shipmentsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Filter for uninvoiced shipments using the same logic as BillingDashboard
            const uninvoicedShipments = shipments.filter(shipment => {
                // Use same uninvoiced logic as BillingDashboard
                const isUninvoiced = !shipment.invoiceStatus || shipment.invoiceStatus === 'uninvoiced';
                return isUninvoiced;
            });

            // Filter out shipments without charges, invalid data, or draft status
            const validShipments = uninvoicedShipments.filter(shipment => {
                const charges = getShipmentCharges(shipment);
                const isDraft = shipment.status?.toLowerCase() === 'draft';
                return charges > 0 && shipment.companyID && !isDraft;
            });

            // Group shipments by company
            const grouped = validShipments.reduce((acc, shipment) => {
                const companyId = shipment.companyID;
                if (!acc[companyId]) {
                    acc[companyId] = {
                        company: shipment.companyName || companyId,
                        shipments: [],
                        totalCharges: 0
                    };
                }
                const charges = getShipmentCharges(shipment);
                acc[companyId].shipments.push(shipment);
                acc[companyId].totalCharges += charges;
                return acc;
            }, {});

            setUninvoicedShipments(validShipments);
            setGroupedShipments(grouped);

            // Pre-select all shipments by default
            const initialSelection = {};
            validShipments.forEach(shipment => {
                initialSelection[shipment.id] = true;
            });
            setSelectedShipments(initialSelection);

        } catch (err) {
            console.error('Error fetching uninvoiced shipments:', err);
            setError('Failed to load uninvoiced shipments: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const getShipmentCharges = (shipment) => {
        // Use markup rates (what customer pays)
        if (shipment.markupRates?.totalCharges) {
            return shipment.markupRates.totalCharges;
        }

        return shipment.totalCharges ||
            shipment.selectedRate?.totalCharges ||
            shipment.selectedRate?.pricing?.total ||
            0;
    };

    const getSelectedShipmentsByCompany = () => {
        const selected = uninvoicedShipments.filter(shipment => selectedShipments[shipment.id]);
        return selected.reduce((acc, shipment) => {
            const companyId = shipment.companyID;
            if (!acc[companyId]) {
                acc[companyId] = {
                    company: shipment.companyName || companyId,
                    companyId: companyId,
                    shipments: [],
                    totalCharges: 0
                };
            }
            const charges = getShipmentCharges(shipment);
            acc[companyId].shipments.push(shipment);
            acc[companyId].totalCharges += charges;
            return acc;
        }, {});
    };

    const generateInvoices = async () => {
        try {
            setIsProcessing(true);
            const selectedByCompany = getSelectedShipmentsByCompany();
            const companies = Object.keys(selectedByCompany);

            let successful = 0;
            let failed = 0;
            const invoiceNumbers = [];

            // Generate invoice for each company
            for (const companyId of companies) {
                try {
                    const companyData = selectedByCompany[companyId];
                    const invoiceNumber = await generateInvoiceForCompany(companyData);
                    invoiceNumbers.push(invoiceNumber);
                    successful++;

                    // Mark shipments as invoiced
                    const updatePromises = companyData.shipments.map(shipment =>
                        updateDoc(doc(db, 'shipments', shipment.id), {
                            invoiceStatus: 'invoiced',
                            invoiceNumber: invoiceNumber,
                            invoicedAt: serverTimestamp()
                        })
                    );
                    await Promise.all(updatePromises);

                } catch (error) {
                    console.error(`Failed to generate invoice for company ${companyId}:`, error);
                    failed++;
                }
            }

            setGenerationResults({
                successful,
                failed,
                totalInvoices: companies.length,
                invoiceNumbers
            });

            enqueueSnackbar(`Successfully generated ${successful} invoices`, { variant: 'success' });

        } catch (error) {
            console.error('Error generating invoices:', error);
            enqueueSnackbar('Failed to generate invoices: ' + error.message, { variant: 'error' });
        } finally {
            setIsProcessing(false);
        }
    };

    const generateInvoiceForCompany = async (companyData) => {
        // Create invoice record in database
        const invoiceNumber = `${invoiceSettings.invoicePrefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

        // Calculate invoice totals
        const subtotal = companyData.totalCharges;
        const taxRate = 0.13; // 13% HST for Canada - should be configurable
        const tax = subtotal * taxRate;
        const total = subtotal + tax;

        // Prepare line items from shipments
        const lineItems = companyData.shipments.map(shipment => ({
            shipmentId: shipment.shipmentID || shipment.id,
            description: `Shipment from ${shipment.shipFrom?.city || 'N/A'} to ${shipment.shipTo?.city || 'N/A'}`,
            carrier: shipment.carrier,
            service: shipment.selectedRate?.service?.name || 'Standard',
            date: shipment.createdAt,
            charges: getShipmentCharges(shipment),
            chargeBreakdown: getChargeBreakdown(shipment)
        }));

        const invoiceData = {
            invoiceNumber,
            companyId: companyData.companyId,
            companyName: companyData.company,
            issueDate: new Date(),
            dueDate: calculateDueDate(invoiceSettings.paymentTerms),
            status: 'pending',
            lineItems,
            subtotal,
            tax,
            total,
            currency: 'CAD',
            paymentTerms: invoiceSettings.paymentTerms,
            settings: invoiceSettings,
            createdAt: serverTimestamp(),
            shipmentIds: companyData.shipments.map(s => s.id)
        };

        // Save invoice to database
        await addDoc(collection(db, 'invoices'), invoiceData);

        // Generate PDF and send email if enabled
        if (invoiceSettings.emailToCustomers) {
            try {
                const generatePDFAndEmail = httpsCallable(functions, 'generateInvoicePDFAndEmail');
                await generatePDFAndEmail({
                    invoiceData,
                    companyId: companyData.companyId
                });
            } catch (emailError) {
                console.error('Failed to send invoice email:', emailError);
                // Don't fail the whole process if email fails
            }
        }

        return invoiceNumber;
    };

    const getChargeBreakdown = (shipment) => {
        const breakdown = [];

        if (shipment.markupRates) {
            const rates = shipment.markupRates;
            if (rates.freightCharges > 0) breakdown.push({ name: 'Freight', amount: rates.freightCharges });
            if (rates.fuelCharges > 0) breakdown.push({ name: 'Fuel', amount: rates.fuelCharges });
            if (rates.serviceCharges > 0) breakdown.push({ name: 'Service', amount: rates.serviceCharges });
            if (rates.accessorialCharges > 0) breakdown.push({ name: 'Accessorial', amount: rates.accessorialCharges });
        }

        return breakdown;
    };

    const calculateDueDate = (paymentTerms) => {
        const days = parseInt(paymentTerms.replace(/\D/g, '')) || 30;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + days);
        return dueDate;
    };

    const handleNext = () => {
        if (activeStep === 0) {
            const count = Object.values(selectedShipments).filter(Boolean).length;
            if (count === 0) {
                enqueueSnackbar('Please select at least one shipment to invoice', { variant: 'warning' });
                return;
            }
            setActiveStep(1);
        } else if (activeStep === 1) {
            setActiveStep(2);
        } else if (activeStep === 2) {
            generateInvoices().then(() => {
                setActiveStep(3);
            });
        } else if (activeStep === 3) {
            // Reset and start over
            setActiveStep(0);
            setSelectedShipments({});
            setGenerationResults({ successful: 0, failed: 0, totalInvoices: 0, invoiceNumbers: [] });
            fetchUninvoicedShipments();
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
        } else {
            setSelectedShipments({});
        }
    };

    const numSelected = Object.values(selectedShipments).filter(Boolean).length;
    const rowCount = uninvoicedShipments.length;

    function getStepContent(step) {
        switch (step) {
            case 0:
                return (
                    <Box>
                        <Typography variant="h6" gutterBottom>Select Shipments to Invoice</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Review uninvoiced shipments below. Uncheck any shipments to exclude from this invoice run.
                        </Typography>

                        {/* Summary Cards */}
                        <Grid container spacing={2} sx={{ mb: 3 }}>
                            <Grid item xs={12} md={4}>
                                <Card elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '11px' }}>
                                            Total Shipments
                                        </Typography>
                                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                                            {uninvoicedShipments.length}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Card elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '11px' }}>
                                            Companies
                                        </Typography>
                                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                                            {Object.keys(groupedShipments).length}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <Card elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '11px' }}>
                                            Total Value
                                        </Typography>
                                        <Typography variant="h5" sx={{ fontWeight: 700 }}>
                                            ${Object.values(groupedShipments).reduce((sum, group) => sum + group.totalCharges, 0).toFixed(2)}
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>

                        <TableContainer component={Paper} elevation={1} variant="outlined">
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                        <TableCell padding="checkbox">
                                            <Checkbox
                                                color="primary"
                                                indeterminate={numSelected > 0 && numSelected < rowCount}
                                                checked={rowCount > 0 && numSelected === rowCount}
                                                onChange={handleSelectAllClick}
                                            />
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Shipment ID</TableCell>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Company</TableCell>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Date</TableCell>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Carrier</TableCell>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Route</TableCell>
                                        <TableCell align="right" sx={{ fontSize: '12px', fontWeight: 600 }}>Amount</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={7} align="center">
                                                <Box sx={{ py: 3 }}>
                                                    <CircularProgress size={24} />
                                                    <Typography sx={{ mt: 1, fontSize: '12px' }}>Loading shipments...</Typography>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ) : uninvoicedShipments.length > 0 ? (
                                        uninvoicedShipments.map((shipment) => {
                                            const charges = getShipmentCharges(shipment);
                                            const createdDate = shipment.createdAt?.toDate ?
                                                shipment.createdAt.toDate() :
                                                new Date(shipment.createdAt);

                                            return (
                                                <TableRow
                                                    key={shipment.id}
                                                    hover
                                                    onClick={() => handleSelectShipment(shipment.id)}
                                                    sx={{ cursor: 'pointer' }}
                                                >
                                                    <TableCell padding="checkbox">
                                                        <Checkbox
                                                            color="primary"
                                                            checked={selectedShipments[shipment.id] || false}
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        {shipment.shipmentID || shipment.id}
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        {shipment.companyName || shipment.companyID}
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        {createdDate.toLocaleDateString()}
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        {shipment.carrier || 'N/A'}
                                                    </TableCell>
                                                    <TableCell sx={{ fontSize: '12px' }}>
                                                        <Typography variant="body2" sx={{ fontSize: '11px' }}>
                                                            {shipment.shipFrom?.city}, {shipment.shipFrom?.state}
                                                        </Typography>
                                                        <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                            → {shipment.shipTo?.city}, {shipment.shipTo?.state}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell align="right" sx={{ fontSize: '12px' }}>
                                                        ${charges.toFixed(2)}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={7} align="center">
                                                <Box sx={{ py: 4 }}>
                                                    <ReceiptIcon sx={{ fontSize: 48, color: '#d1d5db', mb: 2 }} />
                                                    <Typography variant="body1" color="text.secondary">
                                                        No uninvoiced shipments found
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <Typography sx={{ mt: 2, fontSize: '14px' }}>
                            Selected {numSelected} of {rowCount} shipments for invoicing.
                        </Typography>
                    </Box>
                );

            case 1:
                return (
                    <Box>
                        <Typography variant="h6" gutterBottom>Configure Invoice Settings</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                            Customize how your invoices will be generated and delivered.
                        </Typography>

                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                                        Invoice Format
                                    </Typography>

                                    <Box sx={{ mb: 2 }}>
                                        <TextField
                                            fullWidth
                                            label="Invoice Prefix"
                                            value={invoiceSettings.invoicePrefix}
                                            onChange={(e) => setInvoiceSettings(prev => ({
                                                ...prev,
                                                invoicePrefix: e.target.value
                                            }))}
                                            size="small"
                                        />
                                    </Box>

                                    <Box sx={{ mb: 2 }}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel>Payment Terms</InputLabel>
                                            <Select
                                                value={invoiceSettings.paymentTerms}
                                                onChange={(e) => setInvoiceSettings(prev => ({
                                                    ...prev,
                                                    paymentTerms: e.target.value
                                                }))}
                                                label="Payment Terms"
                                            >
                                                <MenuItem value="Due on Receipt">Due on Receipt</MenuItem>
                                                <MenuItem value="Net 15">Net 15</MenuItem>
                                                <MenuItem value="Net 30">Net 30</MenuItem>
                                                <MenuItem value="Net 45">Net 45</MenuItem>
                                                <MenuItem value="Net 60">Net 60</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Box>

                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={invoiceSettings.includeShipmentDetails}
                                                onChange={(e) => setInvoiceSettings(prev => ({
                                                    ...prev,
                                                    includeShipmentDetails: e.target.checked
                                                }))}
                                            />
                                        }
                                        label="Include shipment details"
                                    />

                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={invoiceSettings.includeChargeBreakdown}
                                                onChange={(e) => setInvoiceSettings(prev => ({
                                                    ...prev,
                                                    includeChargeBreakdown: e.target.checked
                                                }))}
                                            />
                                        }
                                        label="Include charge breakdown"
                                    />
                                </Paper>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                                        Delivery Options
                                    </Typography>

                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={invoiceSettings.emailToCustomers}
                                                onChange={(e) => setInvoiceSettings(prev => ({
                                                    ...prev,
                                                    emailToCustomers: e.target.checked
                                                }))}
                                            />
                                        }
                                        label="Email invoices to customers"
                                        sx={{ mb: 2 }}
                                    />

                                    {invoiceSettings.emailToCustomers && (
                                        <Alert severity="info" sx={{ fontSize: '12px' }}>
                                            Invoices will be automatically emailed to the primary contact
                                            for each company with PDF attachments.
                                        </Alert>
                                    )}
                                </Paper>

                                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3, mt: 2 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                                        Invoice Preview
                                    </Typography>

                                    {Object.keys(getSelectedShipmentsByCompany()).length > 0 && (
                                        <Box>
                                            <Typography variant="body2" sx={{ mb: 1 }}>
                                                Will generate {Object.keys(getSelectedShipmentsByCompany()).length} invoice(s) for:
                                            </Typography>
                                            {Object.values(getSelectedShipmentsByCompany()).map((company, idx) => (
                                                <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.5 }}>
                                                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                        {company.company}
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                        ${company.totalCharges.toFixed(2)}
                                                    </Typography>
                                                </Box>
                                            ))}
                                        </Box>
                                    )}
                                </Paper>
                            </Grid>
                        </Grid>
                    </Box>
                );

            case 2:
                return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 5 }}>
                        <CircularProgress size={60} sx={{ mb: 3 }} />
                        <Typography variant="h6">Generating Invoices...</Typography>
                        <Typography variant="body1" color="text.secondary">
                            Creating PDF invoices and sending email notifications...
                        </Typography>
                    </Box>
                );

            case 3:
                return (
                    <Box sx={{ textAlign: 'center', py: 5 }}>
                        <CheckCircleIcon color="success" sx={{ fontSize: 70, mb: 2 }} />
                        <Typography variant="h5" gutterBottom>Invoice Generation Complete!</Typography>

                        <Grid container spacing={2} sx={{ mt: 2, mb: 3, maxWidth: 600, mx: 'auto' }}>
                            <Grid item xs={4}>
                                <Card elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#16a34a' }}>
                                            {generationResults.successful}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Successful
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={4}>
                                <Card elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#dc2626' }}>
                                            {generationResults.failed}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Failed
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                            <Grid item xs={4}>
                                <Card elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="h4" sx={{ fontWeight: 700 }}>
                                            {generationResults.totalInvoices}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            Total
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>

                        {generationResults.invoiceNumbers.length > 0 && (
                            <Box sx={{ mt: 3 }}>
                                <Typography variant="body1" sx={{ mb: 2 }}>Generated Invoice Numbers:</Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                                    {generationResults.invoiceNumbers.map((number, idx) => (
                                        <Chip
                                            key={idx}
                                            label={number}
                                            variant="outlined"
                                            size="small"
                                        />
                                    ))}
                                </Box>
                            </Box>
                        )}

                        <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>
                            Invoices are now available in the Invoices dashboard for review and management.
                        </Typography>
                    </Box>
                );

            default:
                return 'Unknown step';
        }
    }

    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
                <Button variant="contained" onClick={fetchUninvoicedShipments}>
                    Retry
                </Button>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 3 }}>
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

                <Box sx={{ minHeight: 400 }}>
                    {getStepContent(activeStep)}
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'row', pt: 2, mt: 3, borderTop: '1px solid #e5e7eb' }}>
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
                    <Button
                        onClick={handleNext}
                        variant="contained"
                        disabled={isProcessing || (activeStep === 2 && isProcessing)}
                        endIcon={activeStep !== steps.length - 1 && <NavigateNext />}
                    >
                        {activeStep === steps.length - 1 ? 'Generate More Invoices' :
                            activeStep === 0 ? `Continue with ${numSelected} Shipments` :
                                activeStep === 1 ? 'Generate Invoices' :
                                    'Next'}
                    </Button>
                </Box>
            </Paper>
        </Box>
    );
};

export default GenerateInvoicesPage; 