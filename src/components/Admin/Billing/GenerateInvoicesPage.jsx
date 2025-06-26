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
    Tooltip,
    Badge,
    Stack,
    Autocomplete
} from '@mui/material';
import {
    CheckCircleOutline as CheckCircleIcon,
    NavigateNext,
    NavigateBefore,
    Download as DownloadIcon,
    Email as EmailIcon,
    Receipt as ReceiptIcon,
    AccountBalance as AccountBalanceIcon,
    Send as SendIcon,
    Preview as PreviewIcon,
    Business as BusinessIcon,
    LocalShipping as LocalShippingIcon
} from '@mui/icons-material';
import { collection, getDocs, query, where, orderBy, doc, updateDoc, addDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useSnackbar } from 'notistack';
import { formatCurrencyWithPrefix, formatInvoiceCurrency, CURRENCIES, calculateTax } from '../../../utils/currencyUtils';

const steps = [
    'Review Uninvoiced Shipments',
    'Configure Invoice Settings',
    'Generate & Send Invoices',
    'Process Complete'
];

const TAX_RATES = {
    CAD: 0.13, // 13% HST for Canada
    USD: 0.00  // No tax for US invoices by default
};

const PAYMENT_TERMS_OPTIONS = [
    { value: 'Due on Receipt', label: 'Due on Receipt', days: 0 },
    { value: 'Net 15', label: 'Net 15 Days', days: 15 },
    { value: 'Net 30', label: 'Net 30 Days', days: 30 },
    { value: 'Net 45', label: 'Net 45 Days', days: 45 },
    { value: 'Net 60', label: 'Net 60 Days', days: 60 }
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
        groupByCompany: true,
        currency: 'USD',
        taxRate: 0.00,
        enableTax: false,
        testEmail: '',
        enableTestMode: false
    });
    const [generationResults, setGenerationResults] = useState({
        successful: 0,
        failed: 0,
        totalInvoices: 0,
        invoiceNumbers: []
    });
    const [isSendingTest, setIsSendingTest] = useState(false);
    const [testEmailSent, setTestEmailSent] = useState(false);
    const [companies, setCompanies] = useState([]);

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

        // Calculate invoice totals with proper tax handling
        const subtotal = companyData.totalCharges;
        const taxCalc = calculateTax(
            subtotal,
            invoiceSettings.enableTax ? invoiceSettings.taxRate : 0,
            invoiceSettings.currency
        );

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
            subtotal: taxCalc.subtotal,
            tax: taxCalc.tax,
            total: taxCalc.total,
            currency: invoiceSettings.currency,
            paymentTerms: invoiceSettings.paymentTerms,
            taxRate: invoiceSettings.enableTax ? invoiceSettings.taxRate : 0,
            settings: invoiceSettings,
            createdAt: serverTimestamp(),
            shipmentIds: companyData.shipments.map(s => s.id)
        };

        // Save invoice to database
        await addDoc(collection(db, 'invoices'), invoiceData);

        // Generate PDF and send email if enabled
        if (invoiceSettings.emailToCustomers) {
            try {
                await triggerInvoiceGeneration(
                    invoiceData,
                    companyData.companyId,
                    false,
                    null
                );
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
        const termOption = PAYMENT_TERMS_OPTIONS.find(opt => opt.value === paymentTerms);
        const days = termOption ? termOption.days : 30;
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + days);
        return dueDate;
    };

    // Helper function to trigger invoice generation via Firestore (no CORS issues)
    const triggerInvoiceGeneration = async (invoiceData, companyId, testMode = false, testEmail = null) => {
        return new Promise((resolve, reject) => {
            // Create a request document in Firestore
            addDoc(collection(db, 'invoiceRequests'), {
                invoiceData,
                companyId,
                testMode,
                testEmail,
                status: 'pending',
                createdAt: serverTimestamp()
            }).then((docRef) => {
                // Listen for status updates on the document
                const unsubscribe = onSnapshot(doc(db, 'invoiceRequests', docRef.id), (doc) => {
                    const data = doc.data();
                    if (data?.status === 'completed') {
                        unsubscribe();
                        resolve(data.result);
                    } else if (data?.status === 'failed') {
                        unsubscribe();
                        reject(new Error(data.error || 'Invoice generation failed'));
                    }
                });

                // Timeout after 60 seconds
                setTimeout(() => {
                    unsubscribe();
                    reject(new Error('Invoice generation timed out'));
                }, 60000);
            }).catch(reject);
        });
    };

    const sendTestInvoice = async () => {
        if (!invoiceSettings.testEmail) {
            enqueueSnackbar('Please enter a test email address', { variant: 'warning' });
            return;
        }

        try {
            setIsSendingTest(true);

            // Create a sample invoice with the first selected company
            const selectedByCompany = getSelectedShipmentsByCompany();
            const firstCompanyId = Object.keys(selectedByCompany)[0];

            if (!firstCompanyId) {
                enqueueSnackbar('Please select at least one shipment to generate a test invoice', { variant: 'warning' });
                return;
            }

            const companyData = selectedByCompany[firstCompanyId];

            // Use only first 3 shipments for test to keep it manageable
            const testCompanyData = {
                ...companyData,
                shipments: companyData.shipments.slice(0, 3),
                totalCharges: companyData.shipments.slice(0, 3).reduce((sum, shipment) => sum + getShipmentCharges(shipment), 0)
            };

            const testInvoiceNumber = `TEST-${Date.now()}`;
            const subtotal = testCompanyData.totalCharges;
            const taxCalc = calculateTax(subtotal, invoiceSettings.enableTax ? invoiceSettings.taxRate : 0, invoiceSettings.currency);

            const testInvoiceData = {
                invoiceNumber: testInvoiceNumber,
                companyId: testCompanyData.companyId,
                companyName: testCompanyData.company,
                issueDate: new Date(),
                dueDate: calculateDueDate(invoiceSettings.paymentTerms),
                status: 'test',
                lineItems: testCompanyData.shipments.map(shipment => ({
                    shipmentId: shipment.shipmentID || shipment.id,
                    description: `Shipment from ${shipment.shipFrom?.city || 'N/A'} to ${shipment.shipTo?.city || 'N/A'}`,
                    carrier: shipment.carrier,
                    service: shipment.selectedRate?.service?.name || 'Standard',
                    date: shipment.createdAt,
                    charges: getShipmentCharges(shipment),
                    chargeBreakdown: getChargeBreakdown(shipment)
                })),
                subtotal: taxCalc.subtotal,
                tax: taxCalc.tax,
                total: taxCalc.total,
                currency: invoiceSettings.currency,
                paymentTerms: invoiceSettings.paymentTerms,
                settings: { ...invoiceSettings, testEmail: invoiceSettings.testEmail },
                testMode: true
            };

            // Trigger invoice generation via Firestore (no CORS issues)
            await triggerInvoiceGeneration(
                testInvoiceData,
                testCompanyData.companyId,
                true,
                invoiceSettings.testEmail
            );

            setTestEmailSent(true);
            enqueueSnackbar(`Test invoice sent successfully to ${invoiceSettings.testEmail}`, { variant: 'success' });

        } catch (error) {
            console.error('Error sending test invoice:', error);
            enqueueSnackbar('Failed to send test invoice: ' + error.message, { variant: 'error' });
        } finally {
            setIsSendingTest(false);
        }
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
                        <Typography variant="h6" gutterBottom sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                            Select Shipments to Invoice
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: '12px' }}>
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
                                            {formatCurrencyWithPrefix(
                                                Object.values(groupedShipments).reduce((sum, group) => sum + group.totalCharges, 0),
                                                invoiceSettings.currency
                                            )}
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
                                                        {formatInvoiceCurrency(charges, invoiceSettings.currency)}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={7} align="center">
                                                <Box sx={{ py: 4 }}>
                                                    <ReceiptIcon sx={{ fontSize: 48, color: '#d1d5db', mb: 2 }} />
                                                    <Typography variant="body1" color="text.secondary" sx={{ fontSize: '12px' }}>
                                                        No uninvoiced shipments found
                                                    </Typography>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                        <Typography sx={{ mt: 2, fontSize: '12px', color: '#6b7280' }}>
                            Selected {numSelected} of {rowCount} shipments for invoicing.
                        </Typography>
                    </Box>
                );

            case 1:
                return (
                    <Box>
                        <Typography variant="h6" gutterBottom sx={{ fontSize: '16px', fontWeight: 600 }}>
                            Configure Invoice Settings
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, fontSize: '12px' }}>
                            Customize how your invoices will be generated and delivered.
                        </Typography>

                        <Grid container spacing={3}>
                            {/* Invoice Format Section */}
                            <Grid item xs={12} md={6}>
                                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, fontSize: '14px' }}>
                                        Invoice Format
                                    </Typography>

                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6}>
                                            <TextField
                                                fullWidth
                                                label="Invoice Prefix"
                                                value={invoiceSettings.invoicePrefix}
                                                onChange={(e) => setInvoiceSettings(prev => ({
                                                    ...prev,
                                                    invoicePrefix: e.target.value
                                                }))}
                                                size="small"
                                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                                InputProps={{ sx: { fontSize: '12px' } }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <FormControl fullWidth size="small">
                                                <InputLabel sx={{ fontSize: '12px' }}>Currency</InputLabel>
                                                <Select
                                                    value={invoiceSettings.currency}
                                                    onChange={(e) => {
                                                        const currency = e.target.value;
                                                        setInvoiceSettings(prev => ({
                                                            ...prev,
                                                            currency,
                                                            taxRate: TAX_RATES[currency] || 0,
                                                            enableTax: currency === 'CAD'
                                                        }));
                                                    }}
                                                    label="Currency"
                                                    sx={{ fontSize: '12px' }}
                                                >
                                                    {Object.values(CURRENCIES).map(curr => (
                                                        <MenuItem key={curr.code} value={curr.code} sx={{ fontSize: '12px' }}>
                                                            {curr.code} - {curr.name}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        <Grid item xs={12}>
                                            <FormControl fullWidth size="small">
                                                <InputLabel sx={{ fontSize: '12px' }}>Payment Terms</InputLabel>
                                                <Select
                                                    value={invoiceSettings.paymentTerms}
                                                    onChange={(e) => setInvoiceSettings(prev => ({
                                                        ...prev,
                                                        paymentTerms: e.target.value
                                                    }))}
                                                    label="Payment Terms"
                                                    sx={{ fontSize: '12px' }}
                                                >
                                                    {PAYMENT_TERMS_OPTIONS.map(option => (
                                                        <MenuItem key={option.value} value={option.value} sx={{ fontSize: '12px' }}>
                                                            {option.label}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                    </Grid>

                                    <Box sx={{ mt: 2 }}>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={invoiceSettings.includeShipmentDetails}
                                                    onChange={(e) => setInvoiceSettings(prev => ({
                                                        ...prev,
                                                        includeShipmentDetails: e.target.checked
                                                    }))}
                                                    size="small"
                                                />
                                            }
                                            label={<Typography sx={{ fontSize: '12px' }}>Include shipment details</Typography>}
                                        />

                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={invoiceSettings.includeChargeBreakdown}
                                                    onChange={(e) => setInvoiceSettings(prev => ({
                                                        ...prev,
                                                        includeChargeBreakdown: e.target.checked
                                                    }))}
                                                    size="small"
                                                />
                                            }
                                            label={<Typography sx={{ fontSize: '12px' }}>Include charge breakdown</Typography>}
                                        />

                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={invoiceSettings.emailToCustomers}
                                                    onChange={(e) => setInvoiceSettings(prev => ({
                                                        ...prev,
                                                        emailToCustomers: e.target.checked
                                                    }))}
                                                    size="small"
                                                />
                                            }
                                            label={<Typography sx={{ fontSize: '12px' }}>Email invoices to customers</Typography>}
                                        />
                                    </Box>
                                </Paper>
                            </Grid>

                            {/* Tax Configuration Section */}
                            <Grid item xs={12} md={6}>
                                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3, mb: 2 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, fontSize: '14px' }}>
                                        Tax Configuration
                                    </Typography>

                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={invoiceSettings.enableTax}
                                                onChange={(e) => setInvoiceSettings(prev => ({
                                                    ...prev,
                                                    enableTax: e.target.checked
                                                }))}
                                                size="small"
                                            />
                                        }
                                        label={<Typography sx={{ fontSize: '12px' }}>Enable tax calculation</Typography>}
                                        sx={{ mb: 2 }}
                                    />

                                    {invoiceSettings.enableTax && (
                                        <TextField
                                            fullWidth
                                            label="Tax Rate (%)"
                                            type="number"
                                            value={(invoiceSettings.taxRate * 100).toFixed(2)}
                                            onChange={(e) => setInvoiceSettings(prev => ({
                                                ...prev,
                                                taxRate: parseFloat(e.target.value) / 100 || 0
                                            }))}
                                            size="small"
                                            inputProps={{ min: 0, max: 50, step: 0.01 }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                            helperText={`Current rate: ${(invoiceSettings.taxRate * 100).toFixed(2)}%`}
                                            FormHelperTextProps={{ sx: { fontSize: '11px' } }}
                                        />
                                    )}
                                </Paper>

                                {/* Test Invoice Section */}
                                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, fontSize: '14px' }}>
                                        Test Invoice
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', mb: 2 }}>
                                        Send a test invoice to verify formatting and email delivery
                                    </Typography>

                                    <TextField
                                        fullWidth
                                        label="Test Email Address"
                                        type="email"
                                        value={invoiceSettings.testEmail}
                                        onChange={(e) => setInvoiceSettings(prev => ({
                                            ...prev,
                                            testEmail: e.target.value
                                        }))}
                                        size="small"
                                        InputLabelProps={{ sx: { fontSize: '12px' } }}
                                        InputProps={{ sx: { fontSize: '12px' } }}
                                        sx={{ mb: 2 }}
                                    />

                                    <Button
                                        variant="outlined"
                                        startIcon={isSendingTest ? <CircularProgress size={16} /> : <SendIcon />}
                                        onClick={sendTestInvoice}
                                        disabled={isSendingTest || !invoiceSettings.testEmail || numSelected === 0}
                                        size="small"
                                        sx={{ fontSize: '12px' }}
                                        fullWidth
                                    >
                                        {isSendingTest ? 'Sending Test...' : 'Send Test Invoice'}
                                    </Button>

                                    {testEmailSent && (
                                        <Alert severity="success" sx={{ mt: 2, fontSize: '11px' }}>
                                            Test invoice sent successfully! Check your email.
                                        </Alert>
                                    )}
                                </Paper>
                            </Grid>

                            {/* Enhanced Invoice Preview */}
                            <Grid item xs={12}>
                                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3 }}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, fontSize: '14px' }}>
                                        Invoice Preview
                                    </Typography>

                                    {Object.keys(getSelectedShipmentsByCompany()).length > 0 ? (
                                        <Box>
                                            <Typography variant="body2" sx={{ mb: 2, fontSize: '12px' }}>
                                                Will generate {Object.keys(getSelectedShipmentsByCompany()).length} invoice(s):
                                            </Typography>
                                            <Grid container spacing={2}>
                                                {Object.values(getSelectedShipmentsByCompany()).map((company, idx) => {
                                                    const taxCalc = calculateTax(
                                                        company.totalCharges,
                                                        invoiceSettings.enableTax ? invoiceSettings.taxRate : 0,
                                                        invoiceSettings.currency
                                                    );
                                                    return (
                                                        <Grid item xs={12} sm={6} md={4} key={idx}>
                                                            <Card elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                                                                <CardContent sx={{ p: 2 }}>
                                                                    <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                                                                        {company.company}
                                                                    </Typography>
                                                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                        {company.shipments.length} shipment(s)
                                                                    </Typography>
                                                                    <Divider sx={{ my: 1 }} />
                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                                                        <span>Subtotal:</span>
                                                                        <span>{formatInvoiceCurrency(taxCalc.subtotal, invoiceSettings.currency)}</span>
                                                                    </Box>
                                                                    {invoiceSettings.enableTax && (
                                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                                                                            <span>Tax ({(invoiceSettings.taxRate * 100).toFixed(1)}%):</span>
                                                                            <span>{formatInvoiceCurrency(taxCalc.tax, invoiceSettings.currency)}</span>
                                                                        </Box>
                                                                    )}
                                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, mt: 1 }}>
                                                                        <span>Total:</span>
                                                                        <span>{formatInvoiceCurrency(taxCalc.total, invoiceSettings.currency)}</span>
                                                                    </Box>
                                                                </CardContent>
                                                            </Card>
                                                        </Grid>
                                                    );
                                                })}
                                            </Grid>
                                        </Box>
                                    ) : (
                                        <Typography sx={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                                            No shipments selected for invoicing
                                        </Typography>
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
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                            Generating Invoices...
                        </Typography>
                        <Typography variant="body1" color="text.secondary" sx={{ fontSize: '12px' }}>
                            Creating PDF invoices and sending email notifications...
                        </Typography>
                    </Box>
                );

            case 3:
                return (
                    <Box sx={{ textAlign: 'center', py: 5 }}>
                        <CheckCircleIcon color="success" sx={{ fontSize: 70, mb: 2 }} />
                        <Typography variant="h5" gutterBottom sx={{ fontSize: '18px', fontWeight: 600, color: '#374151' }}>
                            Invoice Generation Complete!
                        </Typography>

                        <Grid container spacing={2} sx={{ mt: 2, mb: 3, maxWidth: 600, mx: 'auto' }}>
                            <Grid item xs={4}>
                                <Card elevation={0} sx={{ border: '1px solid #e5e7eb' }}>
                                    <CardContent sx={{ p: 2 }}>
                                        <Typography variant="h4" sx={{ fontWeight: 700, color: '#16a34a' }}>
                                            {generationResults.successful}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
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
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
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
                                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
                                            Total
                                        </Typography>
                                    </CardContent>
                                </Card>
                            </Grid>
                        </Grid>

                        {generationResults.invoiceNumbers.length > 0 && (
                            <Box sx={{ mt: 3 }}>
                                <Typography variant="body1" sx={{ mb: 2, fontSize: '12px', fontWeight: 600 }}>Generated Invoice Numbers:</Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                                    {generationResults.invoiceNumbers.map((number, idx) => (
                                        <Chip
                                            key={idx}
                                            label={number}
                                            variant="outlined"
                                            size="small"
                                            sx={{ fontSize: '11px' }}
                                        />
                                    ))}
                                </Box>
                            </Box>
                        )}

                        <Typography variant="body2" color="text.secondary" sx={{ mt: 3, fontSize: '12px' }}>
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
            <Box>
                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3 }}>
                    <Alert severity="error" sx={{ mb: 2, fontSize: '12px' }}>
                        {error}
                    </Alert>
                    <Button
                        variant="contained"
                        onClick={fetchUninvoicedShipments}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Retry
                    </Button>
                </Paper>
            </Box>
        );
    }

    return (
        <Box>
            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', p: 3 }}>
                <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel sx={{
                                '& .MuiStepLabel-label': { fontSize: '12px' }
                            }}>
                                {label}
                            </StepLabel>
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
                        sx={{ mr: 1, fontSize: '12px' }}
                        startIcon={<NavigateBefore />}
                        size="small"
                    >
                        Back
                    </Button>
                    <Box sx={{ flex: '1 1 auto' }} />
                    <Button
                        onClick={handleNext}
                        variant="contained"
                        disabled={isProcessing || (activeStep === 2 && isProcessing)}
                        endIcon={activeStep !== steps.length - 1 && <NavigateNext />}
                        size="small"
                        sx={{ fontSize: '12px' }}
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