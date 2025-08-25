import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Button,
    Paper,
    CircularProgress,
    TextField,
    Alert,
    Autocomplete,
    Chip,
    Avatar,
    Grid,
    Divider,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Collapse,
    IconButton,
    Tooltip,
    LinearProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow
} from '@mui/material';
import {
    Download as DownloadIcon,
    Archive as ArchiveIcon,
    Business as BusinessIcon,
    Person as PersonIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    FilterList as FilterIcon,
    Clear as ClearIcon,
    Inventory as ShipmentIcon,
    CalendarToday as CalendarIcon,
    Assignment as StatusIcon,
    Preview as PreviewIcon,
    Email as EmailIcon,
    Send as SendIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../../contexts/AuthContext';
import { useCompany } from '../../../contexts/CompanyContext';
import { collection, query, where, getDocs, orderBy, getDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebase';

// ✅ NEW: EmailChipInput Component for dynamic email input
const EmailChipInput = ({ label, placeholder, emails, onChange, helperText, required = false, loading = false }) => {
    const [inputValue, setInputValue] = useState('');

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && inputValue.trim()) {
            e.preventDefault();
            const email = inputValue.trim();

            // Basic email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (emailRegex.test(email) && !emails.includes(email)) {
                onChange([...emails, email]);
                setInputValue('');
            }
        }
    };

    const handleRemoveEmail = (emailToRemove) => {
        onChange(emails.filter(email => email !== emailToRemove));
    };

    return (
        <Box sx={{ mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                    {label}
                </Typography>
                {loading && (
                    <CircularProgress size={14} sx={{ color: '#6b7280' }} />
                )}
            </Box>

            {/* Email Chips Display */}
            {emails.length > 0 && (
                <Box sx={{ mb: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {emails.map((email, index) => (
                        <Chip
                            key={index}
                            label={email}
                            onDelete={() => handleRemoveEmail(email)}
                            size="small"
                            sx={{
                                fontSize: '11px',
                                backgroundColor: '#e0f2fe',
                                color: '#0277bd',
                                '& .MuiChip-deleteIcon': {
                                    fontSize: '14px',
                                    color: '#0277bd'
                                }
                            }}
                        />
                    ))}
                </Box>
            )}

            {/* Input Field */}
            <TextField
                fullWidth
                size="small"
                placeholder={placeholder}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                helperText={helperText}
                disabled={loading}
                sx={{
                    '& .MuiInputBase-input': { fontSize: '12px' },
                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                }}
            />
        </Box>
    );
};

// AUTO INVOICE GENERATOR - Enterprise-Grade Filtering with Preview & Email Features
const BulkInvoiceGenerator = () => {
    const { enqueueSnackbar } = useSnackbar();
    const { currentUser: user, userRole, loading: authLoading } = useAuth();
    const { connectedCompanies } = useCompany();
    const [loading, setLoading] = useState(false);

    // 0. TOP-LEVEL FILTERS (Above Company Selection)
    // Removed date range and status filters per request
    const [dateRange, setDateRange] = useState({ from: null, to: null });
    const [statusFilter, setStatusFilter] = useState('all');

    // 1. COMPANY SELECTION
    const [companies, setCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [loadingCompanies, setLoadingCompanies] = useState(false);

    // 2. CUSTOMER FILTERING (single required)
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [loadingCustomers, setLoadingCustomers] = useState(false);

    // 3. SHIPMENT ID TARGETING
    // Switch to chip-based entry for shipment IDs and remove 'all' mode
    const [shipmentIds, setShipmentIds] = useState([]); // array of IDs
    const [shipmentInput, setShipmentInput] = useState(''); // controlled input for entry

    // 4. UI STATE
    const [filtersExpanded, setFiltersExpanded] = useState(true);
    const [generationProgress, setGenerationProgress] = useState(0);

    // 5. INVOICE GENERATION MODE
    const [invoiceMode, setInvoiceMode] = useState('separate'); // 'separate', 'combined'

    // ✅ NEW: INVOICE DATE SELECTION
    const [invoiceIssueDate, setInvoiceIssueDate] = useState(null); // Custom invoice issue date
    // ✅ NEW: OPTIONAL INVOICE NUMBER OVERRIDE
    const [invoiceNumberOverride, setInvoiceNumberOverride] = useState('');

    // ✅ NEW: PREVIEW & EMAIL FUNCTIONALITY
    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewData, setPreviewData] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [emailLoading, setEmailLoading] = useState(false);
    const [testEmailLoading, setTestEmailLoading] = useState(false);
    // Removed summary tab; always show PDF previews

    // ✅ NEW: TEST EMAIL DIALOG
    const [testEmailDialogOpen, setTestEmailDialogOpen] = useState(false);
    const [testEmailTo, setTestEmailTo] = useState([]); // No default email
    const [testEmailCc, setTestEmailCc] = useState([]); // CC emails
    const [testEmailBcc, setTestEmailBcc] = useState([]); // BCC emails
    // Official send dialog state
    const [officialEmailDialogOpen, setOfficialEmailDialogOpen] = useState(false);
    const [officialEmailTo, setOfficialEmailTo] = useState([]);
    const [officialEmailCc, setOfficialEmailCc] = useState([]);
    const [officialEmailBcc, setOfficialEmailBcc] = useState([]);
    const [officialEmailLoading, setOfficialEmailLoading] = useState(false);
    const [officialRecipientsLoading, setOfficialRecipientsLoading] = useState(false);

    // ✅ NEW: PREFLIGHT STATES
    const [preflightStatuses, setPreflightStatuses] = useState({}); // { [id]: { status: 'pending'|'ok'|'error', reasons: string[] } }
    const [preflightLoading, setPreflightLoading] = useState(false);
    const [issuesDialogOpen, setIssuesDialogOpen] = useState(false);

    const hasErrors = shipmentIds.some(id => preflightStatuses[id]?.status === 'error');
    const hasPending = shipmentIds.some(id => !preflightStatuses[id] || preflightStatuses[id]?.status === 'pending');
    const canProceed = shipmentIds.length > 0 && !hasErrors && !hasPending;

    // Status options for filtering
    const statusOptions = [];

    // ✅ NEW: PREVIEW INVOICES FUNCTIONALITY
    const handlePreviewInvoices = async () => {
        if (!selectedCompany) {
            enqueueSnackbar('Please select a company', { variant: 'warning' });
            return;
        }

        try {
            setPreviewLoading(true);

            if (!selectedCustomer) {
                enqueueSnackbar('Please select a customer', { variant: 'warning' });
                return;
            }

            const filterParams = {
                companyId: selectedCompany.companyID,
                companyName: selectedCompany.name,
                invoiceMode: invoiceMode,
                previewMode: true, // ✅ NEW: Enable preview mode
                invoiceIssueDate: invoiceIssueDate ? invoiceIssueDate.format('YYYY-MM-DD') : null, // ✅ NEW: Custom invoice date
                invoiceNumberOverride: invoiceNumberOverride?.trim() ? invoiceNumberOverride.trim() : null, // ✅ NEW: Override invoice #
                filters: {
                    dateFrom: null,
                    dateTo: null,
                    status: null,
                    customers: [selectedCustomer.customerID],
                    shipmentIds: shipmentIds
                }
            };

            enqueueSnackbar('Generating invoice preview...', { variant: 'info' });

            const response = await fetch('https://us-central1-solushipx.cloudfunctions.net/previewBulkInvoices', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(filterParams)
            });

            if (!response.ok) {
                let errorMessage = 'Failed to generate invoice preview';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (parseError) {
                    console.warn('Could not parse error response:', parseError);
                }
                throw new Error(errorMessage);
            }

            const previewResult = await response.json();
            setPreviewData(previewResult);
            setPreviewOpen(true);

            enqueueSnackbar(`Preview generated: ${previewResult.totalInvoices} invoices for ${previewResult.totalShipments} shipments`, {
                variant: 'success'
            });

        } catch (error) {
            console.error('Preview generation error:', error);
            enqueueSnackbar(`Failed to generate preview: ${error.message}`, {
                variant: 'error'
            });
        } finally {
            setPreviewLoading(false);
        }
    };

    // ✅ NEW: EMAIL INVOICES FUNCTIONALITY
    const handleEmailInvoices = async () => {
        // Replaced by official send dialog. Left for backward compatibility if needed.
        setOfficialEmailDialogOpen(true);
    };

    // ✅ NEW: OPEN TEST EMAIL DIALOG
    const handleOpenTestEmailDialog = () => {
        if (!selectedCompany) {
            enqueueSnackbar('Please select a company', { variant: 'warning' });
            return;
        }
        setTestEmailDialogOpen(true);
    };

    // ✅ NEW: SEND TEST EMAIL FUNCTIONALITY
    const handleSendTestEmail = async () => {
        if (!selectedCompany) {
            enqueueSnackbar('Please select a company', { variant: 'warning' });
            return;
        }

        if (testEmailTo.length === 0) {
            enqueueSnackbar('Please enter at least one email address in the "To" field', { variant: 'warning' });
            return;
        }

        try {
            setTestEmailLoading(true);

            if (!selectedCustomer) {
                enqueueSnackbar('Please select a customer', { variant: 'warning' });
                return;
            }

            const filterParams = {
                companyId: selectedCompany.companyID,
                companyName: selectedCompany.name,
                invoiceMode: invoiceMode,
                testMode: true, // ✅ NEW: Enable test mode
                testEmails: {
                    to: testEmailTo,
                    cc: testEmailCc,
                    bcc: testEmailBcc
                }, // ✅ NEW: Multiple email recipients
                invoiceIssueDate: invoiceIssueDate ? invoiceIssueDate.format('YYYY-MM-DD') : null, // ✅ NEW: Custom invoice date
                invoiceNumberOverride: invoiceNumberOverride?.trim() ? invoiceNumberOverride.trim() : null, // ✅ NEW: Override invoice #
                filters: {
                    dateFrom: null,
                    dateTo: null,
                    status: null,
                    customers: [selectedCustomer.customerID],
                    shipmentIds
                },
                testOptions: {
                    useOfficialInvoiceNumbers: true
                }
            };

            const totalEmails = testEmailTo.length + testEmailCc.length + testEmailBcc.length;
            enqueueSnackbar(`Sending test email to ${totalEmails} recipient${totalEmails > 1 ? 's' : ''}...`, { variant: 'info' });

            const response = await fetch('https://us-central1-solushipx.cloudfunctions.net/sendTestInvoiceEmail', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(filterParams)
            });

            if (!response.ok) {
                let errorMessage = 'Failed to send test email';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (parseError) {
                    console.warn('Could not parse error response:', parseError);
                }
                throw new Error(errorMessage);
            }

            const testResult = await response.json();

            enqueueSnackbar(`Test email sent successfully to ${totalEmails} recipient${totalEmails > 1 ? 's' : ''}! ${testResult.invoicesGenerated} sample invoice${testResult.invoicesGenerated > 1 ? 's' : ''} included.`, {
                variant: 'success',
                autoHideDuration: 6000
            });

            // Close dialog after successful send
            setTestEmailDialogOpen(false);

        } catch (error) {
            console.error('Test email error:', error);
            enqueueSnackbar(`Failed to send test email: ${error.message}`, {
                variant: 'error',
                autoHideDuration: 8000
            });
        } finally {
            setTestEmailLoading(false);
        }
    };

    // Official send handler (uses same structure as test but without testMode and with real numbers)
    const handleSendOfficialEmail = async () => {
        if (!selectedCompany) {
            enqueueSnackbar('Please select a company', { variant: 'warning' });
            return;
        }
        if (!selectedCustomer) {
            enqueueSnackbar('Please select a customer', { variant: 'warning' });
            return;
        }
        if (officialEmailTo.length === 0) {
            enqueueSnackbar('Please enter at least one recipient in the "To" field', { variant: 'warning' });
            return;
        }

        try {
            setOfficialEmailLoading(true);

            const filterParams = {
                companyId: selectedCompany.companyID,
                companyName: selectedCompany.name,
                invoiceMode: invoiceMode,
                emailRecipients: {
                    to: officialEmailTo,
                    cc: officialEmailCc,
                    bcc: officialEmailBcc
                },
                invoiceIssueDate: invoiceIssueDate ? invoiceIssueDate.format('YYYY-MM-DD') : null,
                invoiceNumberOverride: invoiceNumberOverride?.trim() ? invoiceNumberOverride.trim() : null,
                filters: {
                    dateFrom: null,
                    dateTo: null,
                    status: null,
                    customers: [selectedCustomer.customerID],
                    shipmentIds
                }
            };

            enqueueSnackbar(`Sending invoices using official numbers for ${selectedCompany.name}...`, { variant: 'info' });

            const response = await fetch('https://us-central1-solushipx.cloudfunctions.net/emailBulkInvoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(filterParams)
            });

            if (!response.ok) {
                let message = 'Failed to send invoices';
                try { const err = await response.json(); message = err.error || message; } catch { }
                throw new Error(message);
            }

            const result = await response.json();
            const emailedCount = (typeof result.successCount === 'number')
                ? result.successCount
                : (typeof result.invoicesGenerated === 'number' ? result.invoicesGenerated : 0);
            enqueueSnackbar(`Successfully emailed ${emailedCount} invoice${emailedCount === 1 ? '' : 's'}.`, { variant: 'success' });
            setOfficialEmailDialogOpen(false);
        } catch (err) {
            console.error('Official email error:', err);
            enqueueSnackbar(err.message, { variant: 'error' });
        } finally {
            setOfficialEmailLoading(false);
        }
    };

    // ✅ Run preflight for specific IDs
    const runPreflightForIds = useCallback(async (idsToCheck) => {
        if (!selectedCompany || idsToCheck.length === 0) return;
        try {
            setPreflightLoading(true);
            const resp = await fetch('https://us-central1-solushipx.cloudfunctions.net/preflightInvoiceReview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyId: selectedCompany.companyID, shipmentIds: idsToCheck })
            });
            if (!resp.ok) throw new Error('Preflight failed');
            const data = await resp.json();
            const next = { ...preflightStatuses };
            const passing = [];
            (data?.results || []).forEach(r => {
                next[r.shipmentIdInput] = {
                    status: r.pass ? 'ok' : 'error',
                    reasons: r.reasons || []
                };
                if (r.pass) passing.push(r.shipmentIdInput);
            });
            setPreflightStatuses(next);
            // Auto-mark passing shipments as Ready To Invoice
            if (passing.length > 0) {
                try {
                    await fetch('https://us-central1-solushipx.cloudfunctions.net/markShipmentsReadyToInvoice', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ companyId: selectedCompany.companyID, shipmentIds: passing })
                    });
                } catch (e) {
                    // non-blocking
                    console.warn('markShipmentsReadyToInvoice failed', e);
                }
            }
        } catch (e) {
            console.warn('Preflight error', e);
        } finally {
            setPreflightLoading(false);
        }
    }, [selectedCompany, preflightStatuses]);

    // Retry single shipment
    const handleRetryPreflight = useCallback(async (id) => {
        // set pending for this id
        setPreflightStatuses(prev => ({ ...prev, [id]: { status: 'pending', reasons: [] } }));
        await runPreflightForIds([id]);
    }, [runPreflightForIds]);

    // ✅ When shipmentIds change, initialize new ones to pending and preflight them
    useEffect(() => {
        if (shipmentIds.length === 0) return;
        const unknown = shipmentIds.filter(id => !preflightStatuses[id]);
        if (unknown.length > 0) {
            const init = { ...preflightStatuses };
            unknown.forEach(id => { init[id] = { status: 'pending', reasons: [] }; });
            setPreflightStatuses(init);
            runPreflightForIds(unknown);
        }
    }, [shipmentIds]);

    // COMPANY LOADING - Fixed Implementation based on GlobalShipmentList.jsx
    const loadCompanies = useCallback(async () => {
        if (authLoading || !user) return;
        if (loadingCompanies) return; // Prevent multiple simultaneous calls

        setLoadingCompanies(true);
        try {
            let companiesQuery;
            let connectedCompanyIds = [];

            if (userRole === 'superadmin') {
                // Super admins can see all companies
                companiesQuery = query(collection(db, 'companies'));
            } else if (userRole === 'admin') {
                // Admins can see companies they're connected to
                const userDoc = await getDocs(
                    query(collection(db, 'users'), where('uid', '==', user.uid))
                );

                if (!userDoc.empty) {
                    const userData = userDoc.docs[0].data();
                    connectedCompanyIds = userData.connectedCompanies?.companies || [];

                    if (connectedCompanyIds.length > 0) {
                        companiesQuery = query(
                            collection(db, 'companies'),
                            where('companyID', 'in', connectedCompanyIds)
                        );
                    } else {
                        setCompanies([]);
                        return;
                    }
                } else {
                    setCompanies([]);
                    return;
                }
            } else {
                // Regular users shouldn't access this page
                setCompanies([]);
                return;
            }

            const companiesSnapshot = await getDocs(companiesQuery);
            const companiesData = companiesSnapshot.docs.map(doc => ({
                id: doc.id,
                companyID: doc.data().companyID,
                name: doc.data().name || doc.data().companyName || doc.data().companyID || 'Unknown Company',
                logoUrl: doc.data().logoUrl || doc.data().logo,
                status: doc.data().status || 'active',
                ...doc.data()
            }));

            // Sort companies by name after fetching
            companiesData.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

            setCompanies(companiesData);

        } catch (error) {
            console.error('Error loading companies:', error);
            enqueueSnackbar('Failed to load companies: ' + error.message, { variant: 'error' });
            setCompanies([]);
        } finally {
            setLoadingCompanies(false);
        }
    }, [user, userRole, authLoading]);

    // LOAD CUSTOMERS FOR SELECTED COMPANY
    const loadCustomersForCompany = useCallback(async (companyId) => {
        if (!companyId) {
            setCustomers([]);
            setSelectedCustomer(null);
            return;
        }

        setLoadingCustomers(true);
        try {
            const customersQuery = query(
                collection(db, 'customers'),
                where('companyID', '==', companyId),
                orderBy('name')
            );

            const customersSnapshot = await getDocs(customersQuery);
            const customersData = customersSnapshot.docs.map(doc => ({
                id: doc.id,
                customerID: doc.data().customerID,
                name: doc.data().name,
                companyName: doc.data().companyName,
                logoUrl: doc.data().logoUrl || doc.data().logo,
                ...doc.data()
            }));

            console.log(`Loaded ${customersData.length} customers for company ${companyId}`);
            setCustomers(customersData);
            setSelectedCustomer(null); // Reset customer selection when company changes

        } catch (error) {
            console.error('Error loading customers:', error);
            enqueueSnackbar('Failed to load customers', { variant: 'error' });
        } finally {
            setLoadingCustomers(false);
        }
    }, []);

    // HANDLE COMPANY CHANGE
    const handleCompanyChange = (event, newValue) => {
        setSelectedCompany(newValue);
        if (newValue) {
            loadCustomersForCompany(newValue.companyID);
        } else {
            setCustomers([]);
            setSelectedCustomer(null);
        }
    };

    // PARSE SHIPMENT IDs FROM TEXT INPUT
    const parseShipmentIds = (text) => {
        if (!text.trim()) return [];

        // Split by commas, semicolons, or newlines and clean up
        return text.split(/[,;\n]/)
            .map(id => id.trim())
            .filter(id => id.length > 0);
    };

    // ENHANCED BULK GENERATION WITH ALL FILTERS
    const handleGenerateBulkInvoices = async () => {
        if (!selectedCompany) {
            enqueueSnackbar('Please select a company', { variant: 'warning' });
            return;
        }

        try {
            setLoading(true);
            setGenerationProgress(10);

            console.log(`Starting Auto Invoice generation...`);

            // Prepare comprehensive filter parameters
            const filterParams = {
                companyId: selectedCompany.companyID,
                companyName: selectedCompany.name,
                invoiceMode: invoiceMode, // ✅ NEW: Pass invoice generation mode to backend
                invoiceIssueDate: invoiceIssueDate ? invoiceIssueDate.format('YYYY-MM-DD') : null, // ✅ NEW: Custom invoice date
                filters: {
                    // Filters simplified per request
                    dateFrom: null,
                    dateTo: null,
                    status: null,
                    customers: selectedCustomer ? [selectedCustomer.customerID] : null,
                    shipmentIds
                }
            };

            const filterSummary = [];
            // Date and status summaries removed per request
            if (selectedCustomer) {
                filterSummary.push(`1 customer`);
            }
            if (shipmentIds.length > 0) {
                filterSummary.push(`${shipmentIds.length} shipment IDs`);
            }

            const filterText = filterSummary.length > 0 ? ` with ${filterSummary.join(', ')}` : '';
            const modeText = invoiceMode === 'combined' ? ' (Combined Invoices)' : ' (Separate Invoices)';

            enqueueSnackbar(`Generating ${invoiceMode} invoices ZIP for ${selectedCompany.name}${filterText}${modeText}...`, {
                variant: 'info',
                autoHideDuration: 3000
            });

            setGenerationProgress(25);

            // Call the enhanced bulk invoice generator cloud function
            const response = await fetch('https://us-central1-solushipx.cloudfunctions.net/generateBulkInvoices', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(filterParams)
            });

            setGenerationProgress(75);

            if (!response.ok) {
                let errorMessage = 'Failed to generate bulk invoices';
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error || errorMessage;
                } catch (parseError) {
                    console.warn('Could not parse error response:', parseError);
                }
                throw new Error(errorMessage);
            }

            // Check if we got a ZIP file
            const contentType = response.headers.get('Content-Type');
            if (!contentType || !contentType.includes('application/zip')) {
                throw new Error('Expected ZIP file but received different content type');
            }

            setGenerationProgress(90);

            // Download the ZIP file
            const blob = await response.blob();

            if (blob.size === 0) {
                throw new Error('Received empty ZIP file');
            }

            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;

            // Enhanced filename with all filter details
            const timestamp = Date.now();
            const filenameParts = [selectedCompany.companyID, 'Invoices'];

            // Date and status removed from filename per request
            if (selectedCustomer) {
                filenameParts.push(`1customer`);
            }
            if (shipmentIds.length > 0) {
                filenameParts.push(`${shipmentIds.length}shipments`);
            }

            filenameParts.push(timestamp.toString());
            link.download = filenameParts.join('-') + '.zip';

            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);

            setGenerationProgress(100);

            enqueueSnackbar(`ZIP file generated and downloaded successfully!${filterText}`, {
                variant: 'success',
                autoHideDuration: 5000
            });

        } catch (error) {
            console.error('Auto Invoice generation error:', error);
            enqueueSnackbar(`Failed to generate invoices: ${error.message}`, {
                variant: 'error',
                autoHideDuration: 8000
            });
        } finally {
            setLoading(false);
            setGenerationProgress(0);
        }
    };

    // LOAD COMPANIES ON MOUNT - Enhanced with better dependency management
    useEffect(() => {
        if (user && userRole && (userRole === 'superadmin' || userRole === 'admin')) {
            loadCompanies();
        }
    }, [user, userRole, authLoading, loadCompanies]);

    // Date change handler removed with date filters
    const handleDateChange = () => { };

    // ✅ Human-readable reason mapper
    const formatPreflightReason = useCallback((code) => {
        const map = {
            NOT_FOUND: 'Shipment could not be found in the system.',
            STATUS_EXCEPTION: 'Shipment is in exception status and cannot be invoiced.',
            STATUS_CANCELLED_OR_VOIDED: 'Shipment is cancelled or voided.',
            STATUS_DRAFT_OR_PENDING_REVIEW: 'Shipment is a draft or pending review.',
            ALREADY_INVOICED: 'Shipment has already been invoiced.',
            CHARGES_PARSE_ERROR: 'Charges could not be read. Please review shipment charges.',
            NO_POSITIVE_CHARGE: 'No positive charge detected. Ensure at least one line item has an actual charge > $0.',
            MISSING_ACTUAL_CHARGE_FIELD: 'One or more charges are missing the "actual charge" field.',
            NO_ACTUAL_CHARGES_SET: 'Actual charges have not been set. Please set actual charges before invoicing (actual charges should not be "TBD").',
            BILLTO_INCOMPLETE: 'Customer BILL TO details are incomplete (address or email missing).',
            BILLTO_LOOKUP_FAILED: 'Could not fetch customer BILL TO details.'
        };
        return map[code] || code;
    }, []);

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box sx={{ p: 3 }}>
                <Paper sx={{ p: 3, border: '1px solid #e5e7eb' }}>
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 1 }}>
                            Manual Invoice Generation
                        </Typography>
                    </Box>

                    {/* TOP-LEVEL FILTERS REMOVED */}

                    {/* COMPANY SELECTION - ALWAYS VISIBLE */}
                    <Box sx={{ mb: 3 }}>
                        <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 2 }}>
                            Company Selection (Required)
                        </Typography>
                        <Autocomplete
                            value={selectedCompany}
                            onChange={handleCompanyChange}
                            options={companies}
                            getOptionLabel={(option) => option.name || option.companyID}
                            isOptionEqualToValue={(option, value) => option.companyID === value?.companyID}
                            loading={loadingCompanies}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Select Company"
                                    size="small"
                                    required
                                    sx={{
                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                    }}
                                    InputProps={{
                                        ...params.InputProps,
                                        startAdornment: (
                                            <BusinessIcon sx={{ fontSize: 16, color: '#6b7280', mr: 1 }} />
                                        )
                                    }}
                                />
                            )}
                            renderOption={(props, option) => (
                                <Box component="li" {...props} sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 2,
                                    p: 1.5,
                                    '&:hover': {
                                        backgroundColor: '#f3f4f6'
                                    }
                                }}>
                                    <Avatar
                                        src={option.logoUrl}
                                        sx={{
                                            width: 32,
                                            height: 32,
                                            border: '1px solid #d1d5db'
                                        }}
                                    >
                                        <BusinessIcon sx={{ fontSize: 16 }} />
                                    </Avatar>
                                    <Box>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                            {option.name}
                                        </Typography>
                                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                            {option.companyID} • {option.status || 'Active'}
                                        </Typography>
                                    </Box>
                                </Box>
                            )}
                            noOptionsText={loadingCompanies ? "Loading companies..." : "No companies available"}
                            disabled={loading}
                        />
                        {companies.length === 0 && !loadingCompanies && (
                            <Alert severity="warning" sx={{ mt: 2, fontSize: '12px' }}>
                                No companies found. Please check your permissions or contact an administrator.
                            </Alert>
                        )}
                    </Box>

                    {/* ADVANCED FILTERS SECTION */}
                    {selectedCompany && (
                        <>
                            {/* Title bar removed as redundant */}
                            <Paper sx={{ p: 3, mb: 3, backgroundColor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                                <Grid container spacing={3}>
                                    {/* CUSTOMER FILTER (single required) */}
                                    <Grid item xs={12}>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                            Choose Customer
                                        </Typography>
                                        <Autocomplete
                                            value={selectedCustomer}
                                            onChange={(event, newValue) => setSelectedCustomer(newValue)}
                                            options={customers}
                                            getOptionLabel={(option) => option.name || option.customerID}
                                            isOptionEqualToValue={(option, value) => option.customerID === value?.customerID}
                                            loading={loadingCustomers}
                                            renderInput={(params) => (
                                                <TextField
                                                    {...params}
                                                    label="Select Customer"
                                                    placeholder={selectedCompany ? "Search customer by name or ID" : "Select company first"}
                                                    size="small"
                                                    required
                                                    sx={{
                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                    }}
                                                />
                                            )}
                                            renderOption={(props, option) => (
                                                <Box component="li" {...props} sx={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 1.5,
                                                    p: 1,
                                                    '&:hover': { backgroundColor: '#f3f4f6' }
                                                }}>
                                                    <Avatar
                                                        src={option.logoUrl}
                                                        sx={{
                                                            width: 28,
                                                            height: 28,
                                                            border: '1px solid #d1d5db',
                                                            bgcolor: '#059669'
                                                        }}
                                                    >
                                                        <PersonIcon sx={{ fontSize: 14, color: 'white' }} />
                                                    </Avatar>
                                                    <Box>
                                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                            {option.name}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                            {option.customerID}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            )}
                                            disabled={!selectedCompany || loading}
                                            noOptionsText={loadingCustomers ? "Loading customers..." : "No customers found"}
                                        />
                                    </Grid>

                                    {/* SHIPMENT ID FILTER - chips only (visible after customer selected) */}
                                    {selectedCustomer && (
                                        <Grid item xs={12}>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                                Enter Shipment IDs
                                            </Typography>
                                            <TextField
                                                fullWidth
                                                label="Enter a shipment ID and press Enter"
                                                placeholder="IC-CUSTOMER-123"
                                                size="small"
                                                value={shipmentInput}
                                                onChange={(e) => setShipmentInput(e.target.value)}
                                                onPaste={(e) => {
                                                    const text = e.clipboardData.getData('text');
                                                    if (!text) return;
                                                    e.preventDefault();
                                                    const ids = parseShipmentIds(text);
                                                    if (ids.length > 0) {
                                                        const existing = new Set(shipmentIds);
                                                        const merged = [...shipmentIds];
                                                        ids.forEach(id => { if (id && !existing.has(id)) { existing.add(id); merged.push(id); } });
                                                        setShipmentIds(merged);
                                                    }
                                                    setShipmentInput('');
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        const raw = shipmentInput;
                                                        if (!raw) return;
                                                        e.preventDefault();
                                                        const ids = parseShipmentIds(raw);
                                                        if (ids.length > 0) {
                                                            const existing = new Set(shipmentIds);
                                                            const merged = [...shipmentIds];
                                                            ids.forEach(id => { if (id && !existing.has(id)) { existing.add(id); merged.push(id); } });
                                                            setShipmentIds(merged);
                                                        }
                                                        setShipmentInput('');
                                                    }
                                                }}
                                                sx={{
                                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                                }}
                                                helperText={shipmentIds.length > 0 ? `${shipmentIds.length} shipments added` : 'Press Enter to add each shipment or paste multiple IDs'}
                                            />
                                            {shipmentIds.length > 0 && (
                                                <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                                                    {shipmentIds.map(id => {
                                                        const st = preflightStatuses[id]?.status || 'pending';
                                                        const isError = st === 'error';
                                                        const isOk = st === 'ok';
                                                        const bg = isError ? '#ef4444' : isOk ? '#10b981' : '#e5e7eb';
                                                        const color = isError || isOk ? '#ffffff' : '#374151';
                                                        return (
                                                            <Chip
                                                                key={id}
                                                                label={id}
                                                                onDelete={() => {
                                                                    setShipmentIds(shipmentIds.filter(s => s !== id));
                                                                    const next = { ...preflightStatuses };
                                                                    delete next[id];
                                                                    setPreflightStatuses(next);
                                                                }}
                                                                size="small"
                                                                sx={{ fontSize: '11px', backgroundColor: bg, color }}
                                                            />
                                                        );
                                                    })}
                                                    {hasErrors && (
                                                        <Button size="small" variant="outlined" onClick={() => setIssuesDialogOpen(true)} sx={{ ml: 1, fontSize: '11px' }}>
                                                            View Issues
                                                        </Button>
                                                    )}
                                                    {preflightLoading && (
                                                        <Typography sx={{ fontSize: '11px', color: '#6b7280', ml: 1 }}>Validating…</Typography>
                                                    )}
                                                </Box>
                                            )}
                                        </Grid>
                                    )}
                                </Grid>
                            </Paper>
                        </>
                    )}

                    {/* INVOICE GENERATION MODE SELECTION */}
                    <Paper sx={{ p: 3, mb: 3, border: '1px solid #e5e7eb', borderRadius: 2 }}>
                        <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 2 }}>
                            Invoice Generation Method
                        </Typography>
                        {/* Helper copy removed per request */}

                        <FormControl fullWidth size="small">
                            <InputLabel sx={{ fontSize: '12px' }}>Invoice Method</InputLabel>
                            <Select
                                value={invoiceMode}
                                onChange={(e) => setInvoiceMode(e.target.value)}
                                label="Invoice Method"
                                sx={{ fontSize: '12px' }}
                            >
                                <MenuItem value="separate" sx={{ fontSize: '12px' }}>
                                    <Box>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                            Create separate invoice for each shipment
                                        </Typography>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                            Each shipment gets its own invoice number
                                        </Typography>
                                    </Box>
                                </MenuItem>
                                <MenuItem value="combined" sx={{ fontSize: '12px' }}>
                                    <Box>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                            Combine all shipments into one invoice per customer
                                        </Typography>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                            Multiple shipments on single invoice with shared invoice number
                                        </Typography>
                                    </Box>
                                </MenuItem>
                            </Select>
                        </FormControl>

                        {/* Visual indicator removed per request */}
                    </Paper>

                    {/* INVOICE CUSTOMIZATION */}
                    <Paper sx={{ p: 3, mb: 3, border: '1px solid #e5e7eb', borderRadius: 2 }}>
                        <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 2 }}>
                            Invoice Customization
                        </Typography>
                        {/* Helper copy removed per request */}

                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <DatePicker
                                        label="Invoice Issue Date (Optional)"
                                        value={invoiceIssueDate}
                                        onChange={(newValue) => setInvoiceIssueDate(newValue)}
                                        slotProps={{
                                            textField: {
                                                size: 'small',
                                                fullWidth: true,
                                                helperText: 'Leave empty to use today\'s date',
                                                sx: {
                                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                                                }
                                            }
                                        }}
                                    />
                                    <TextField
                                        label="Set Invoice # (Optional)"
                                        value={invoiceNumberOverride}
                                        onChange={(e) => setInvoiceNumberOverride(e.target.value)}
                                        placeholder="Enter an invoice number to override auto-generation (e.g., INV-ICAL-20250124)"
                                        fullWidth
                                        size="small"
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                        helperText="If provided, this exact invoice number will be used. Leave empty to auto-generate."
                                    />
                                </Box>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Box sx={{ p: 2, backgroundColor: '#f0f9ff', borderRadius: 1, border: '1px solid #bae6fd' }}>
                                    <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                        {(invoiceNumberOverride || invoiceIssueDate) ? 'Custom Settings:' : 'Date Information:'}
                                    </Typography>
                                    {invoiceNumberOverride && (
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                            Invoice #: {invoiceNumberOverride}
                                        </Typography>
                                    )}
                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                        Issue Date: {invoiceIssueDate ? dayjs(invoiceIssueDate).format('MMM DD, YYYY') : 'Today'}
                                    </Typography>
                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                        Due Date: {invoiceIssueDate ? dayjs(invoiceIssueDate).add(30, 'day').format('MMM DD, YYYY') : dayjs().add(30, 'day').format('MMM DD, YYYY')}
                                    </Typography>
                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                        Payment Terms: NET 30
                                    </Typography>
                                </Box>
                            </Grid>
                        </Grid>

                        {invoiceIssueDate && (
                            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip
                                    label={`Custom Issue Date: ${dayjs(invoiceIssueDate).format('MMM DD, YYYY')}`}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                    onDelete={() => setInvoiceIssueDate(null)}
                                    sx={{ fontSize: '11px' }}
                                />
                            </Box>
                        )}
                    </Paper>

                    {/* GENERATION PROGRESS */}
                    {loading && (
                        <Box sx={{ mb: 3 }}>
                            <LinearProgress
                                variant="determinate"
                                value={generationProgress}
                                sx={{ mb: 1, borderRadius: 1 }}
                            />
                            <Typography sx={{ fontSize: '11px', color: '#6b7280', textAlign: 'center' }}>
                                {generationProgress < 25 ? 'Preparing filters...' :
                                    generationProgress < 75 ? 'Generating invoices...' :
                                        generationProgress < 95 ? 'Creating ZIP file...' : 'Finalizing download...'}
                            </Typography>
                        </Box>
                    )}

                    {/* ACTION BUTTONS */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 3 }}>
                        {/* ✅ NEW: Preview Button */}
                        <Button
                            variant="outlined"
                            startIcon={previewLoading ? <CircularProgress size={16} color="inherit" /> : <PreviewIcon />}
                            onClick={handlePreviewInvoices}
                            disabled={previewLoading || !selectedCompany || !canProceed}
                            sx={{
                                fontSize: '12px',
                                borderColor: '#7c3aed',
                                color: '#7c3aed',
                                '&:hover': { borderColor: '#6d28d9', backgroundColor: '#f3f4f6' }
                            }}
                        >
                            {previewLoading ? 'Generating Preview...' : 'Preview Invoices'}
                        </Button>

                        {/* Send As Test (opens dialog) */}
                        <Button
                            variant="outlined"
                            startIcon={<SendIcon />}
                            onClick={handleOpenTestEmailDialog}
                            disabled={!selectedCompany || !canProceed}
                            sx={{
                                fontSize: '12px',
                                borderColor: '#f59e0b',
                                color: '#f59e0b',
                                '&:hover': { borderColor: '#d97706', backgroundColor: '#fffbeb' }
                            }}
                        >
                            Send As Test
                        </Button>

                        {/* Official Send Invoices */}
                        <Button
                            variant="contained"
                            startIcon={emailLoading ? <CircularProgress size={16} color="inherit" /> : <EmailIcon />}
                            onClick={async () => {
                                setOfficialEmailDialogOpen(true);
                                try {
                                    if (!selectedCompany || !selectedCustomer) return;
                                    setOfficialRecipientsLoading(true);
                                    const filterParams = {
                                        companyId: selectedCompany.companyID,
                                        invoiceMode,
                                        invoiceIssueDate: invoiceIssueDate ? invoiceIssueDate.format('YYYY-MM-DD') : null,
                                        invoiceNumberOverride: invoiceNumberOverride?.trim() ? invoiceNumberOverride.trim() : null,
                                        filters: {
                                            customers: [selectedCustomer.customerID],
                                            shipmentIds
                                        }
                                    };
                                    const resp = await fetch('https://us-central1-solushipx.cloudfunctions.net/getInvoiceRecipients', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify(filterParams)
                                    });
                                    if (resp.ok) {
                                        const data = await resp.json();
                                        if (Array.isArray(data?.recipients?.to) && data.recipients.to.length > 0) {
                                            setOfficialEmailTo(data.recipients.to);
                                        }
                                    } else {
                                        // Fallback: derive from selectedCustomer fields
                                        const candidates = [
                                            selectedCustomer?.billingEmail,
                                            selectedCustomer?.mainContactEmail,
                                            ...(Array.isArray(selectedCustomer?.billingEmails) ? selectedCustomer.billingEmails : [])
                                        ].filter(Boolean);
                                        const split = candidates
                                            .flatMap(val => String(val).split(/[;,]/))
                                            .map(s => s.trim())
                                            .filter(Boolean);
                                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                        const dedup = Array.from(new Set(split.filter(e => emailRegex.test(e))));
                                        if (dedup.length > 0) setOfficialEmailTo(dedup);
                                    }
                                } catch (e) {
                                    console.warn('Prefill recipients failed:', e);
                                    // Fallback on error as well
                                    try {
                                        const candidates = [
                                            selectedCustomer?.billingEmail,
                                            selectedCustomer?.mainContactEmail,
                                            ...(Array.isArray(selectedCustomer?.billingEmails) ? selectedCustomer.billingEmails : [])
                                        ].filter(Boolean);
                                        const split = candidates
                                            .flatMap(val => String(val).split(/[;,]/))
                                            .map(s => s.trim())
                                            .filter(Boolean);
                                        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                        const dedup = Array.from(new Set(split.filter(e => emailRegex.test(e))));
                                        if (dedup.length > 0) setOfficialEmailTo(dedup);
                                    } catch (_) { }
                                } finally {
                                    setOfficialRecipientsLoading(false);
                                }
                            }}
                            disabled={emailLoading || !selectedCompany || !canProceed}
                            sx={{
                                fontSize: '12px',
                                backgroundColor: '#059669',
                                '&:hover': { backgroundColor: '#047857' }
                            }}
                        >
                            {emailLoading ? 'Sending Invoices...' : 'Send Invoices'}
                        </Button>

                        {/* Original ZIP Download Button */}
                        <Button
                            variant="contained"
                            startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <ArchiveIcon />}
                            onClick={handleGenerateBulkInvoices}
                            disabled={loading || !selectedCompany}
                            sx={{
                                fontSize: '12px',
                                backgroundColor: '#7c3aed',
                                '&:hover': { backgroundColor: '#6d28d9' }
                            }}
                        >
                            {loading ? 'Generating ZIP...' : 'Generate ZIP'}
                        </Button>
                    </Box>

                    <Divider sx={{ mb: 3 }} />
                </Paper>
            </Box>

            {/* PREVIEW DIALOG */}
            <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">Invoice Preview</Typography>
                    <IconButton onClick={() => setPreviewOpen(false)}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    {previewLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : !previewData ? (
                        <Alert severity="info">No preview data available.</Alert>
                    ) : (
                        <Box sx={{ mt: 3 }}>
                            {previewData.combinedPdfBase64 ? (
                                <>
                                    <Paper sx={{ p: 2, mb: 2, border: '1px solid #e5e7eb' }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                            <Box>
                                                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                                    {previewData.combinedFileName || 'Invoices-Preview.pdf'}
                                                </Typography>
                                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                    {`${previewData.totalInvoices || 0} invoices • ${previewData.totalShipments || 0} shipments`}
                                                </Typography>
                                            </Box>
                                            <Button
                                                variant="outlined"
                                                size="small"
                                                startIcon={<PreviewIcon />}
                                                onClick={() => {
                                                    const pdfWindow = window.open('', '_blank');
                                                    pdfWindow.document.write(`
                                                        <html>
                                                            <head><title>${previewData.combinedFileName || 'Invoices-Preview.pdf'}</title></head>
                                                            <body style="margin:0;">
                                                                <iframe src="data:application/pdf;base64,${previewData.combinedPdfBase64}"
                                                                        style="width:100%; height:100vh; border:none;"></iframe>
                                                            </body>
                                                        </html>
                                                    `);
                                                    pdfWindow.document.close();
                                                }}
                                                sx={{ fontSize: '11px' }}
                                            >
                                                View in Tab
                                            </Button>
                                        </Box>
                                        <Box sx={{
                                            border: '1px solid #d1d5db',
                                            borderRadius: 1,
                                            overflow: 'hidden',
                                            height: '500px'
                                        }}>
                                            <iframe
                                                src={`data:application/pdf;base64,${previewData.combinedPdfBase64}`}
                                                width="100%"
                                                height="100%"
                                                style={{ border: 'none' }}
                                                title={`Combined Invoice Preview`}
                                            />
                                        </Box>
                                    </Paper>
                                </>
                            ) : (
                                <>
                                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                        PDF Invoice Previews
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                                        These are actual generated PDF invoices that preview what will be sent to customers. Click to open in a new tab.
                                    </Typography>
                                    {previewData.sampleInvoices.map((invoice, index) => (
                                        <Paper key={index} sx={{ p: 2, mb: 2, border: '1px solid #e5e7eb' }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                                <Box>
                                                    <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                                        {invoice.invoiceId}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                        {invoice.customerName} • {invoice.shipmentId} • ${invoice.totalAmount.toLocaleString()}
                                                    </Typography>
                                                </Box>
                                                {invoice.pdfBase64 ? (
                                                    <Button
                                                        variant="outlined"
                                                        size="small"
                                                        startIcon={<PreviewIcon />}
                                                        onClick={() => {
                                                            const pdfWindow = window.open('', '_blank');
                                                            pdfWindow.document.write(`
                                                                <html>
                                                                    <head><title>${invoice.fileName}</title></head>
                                                                    <body style="margin:0;">
                                                                        <iframe src="data:application/pdf;base64,${invoice.pdfBase64}" style="width:100%; height:100vh; border:none;"></iframe>
                                                                    </body>
                                                                </html>
                                                            `);
                                                            pdfWindow.document.close();
                                                        }}
                                                        sx={{ fontSize: '11px' }}
                                                    >
                                                        View PDF
                                                    </Button>
                                                ) : (
                                                    <Chip label={invoice.error || 'PDF Generation Failed'} color="error" size="small" sx={{ fontSize: '10px' }} />
                                                )}
                                            </Box>
                                            {invoice.pdfBase64 && (
                                                <Box sx={{ border: '1px solid #d1d5db', borderRadius: 1, overflow: 'hidden', height: '400px' }}>
                                                    <iframe src={`data:application/pdf;base64,${invoice.pdfBase64}`} width="100%" height="100%" style={{ border: 'none' }} title={`Invoice Preview - ${invoice.invoiceId}`} />
                                                </Box>
                                            )}
                                        </Paper>
                                    ))}
                                </>
                            )}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPreviewOpen(false)} color="primary">
                        Close
                    </Button>
                    {/* Remove Email Invoices button from preview dialog */}
                </DialogActions>
            </Dialog>

            {/* ✅ NEW: TEST EMAIL DIALOG */}
            <Dialog
                open={testEmailDialogOpen}
                onClose={() => setTestEmailDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    Send As Test
                </DialogTitle>
                <DialogContent>
                    <Typography sx={{ fontSize: '14px', color: '#6b7280', mb: 3 }}>
                        Enter one or more email addresses to receive test invoices. Press Enter after typing each email address to add it.
                    </Typography>

                    <EmailChipInput
                        label="To: *"
                        placeholder="Enter email address and press Enter"
                        emails={testEmailTo}
                        onChange={setTestEmailTo}
                        helperText="Press Enter after typing each email address"
                        required
                    />

                    {/* CC/BCC hidden for test mode; official numbers always reserved */}

                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setTestEmailDialogOpen(false)}
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={testEmailLoading ? <CircularProgress size={16} color="inherit" /> : <SendIcon />}
                        onClick={handleSendTestEmail}
                        disabled={testEmailLoading || testEmailTo.length === 0}
                        sx={{
                            fontSize: '12px',
                            backgroundColor: '#10b981',
                            '&:hover': { backgroundColor: '#059669' }
                        }}
                    >
                        {testEmailLoading ? 'Sending...' : 'Send As Test'}
                    </Button>
                </DialogActions>
            </Dialog>
            {/* ✅ NEW: OFFICIAL EMAIL DIALOG */}
            <Dialog
                open={officialEmailDialogOpen}
                onClose={() => {
                    setOfficialEmailDialogOpen(false);
                    // Clear emails on close
                    setOfficialEmailTo([]);
                    setOfficialEmailCc([]);
                    setOfficialEmailBcc([]);
                }}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    Send Invoices
                </DialogTitle>
                <DialogContent>
                    <Typography sx={{ fontSize: '14px', color: '#6b7280', mb: 3 }}>
                        Enter recipients for the official invoice emails. Press Enter after typing each email address to add it.
                    </Typography>

                    <EmailChipInput
                        label="To: *"
                        placeholder="Enter email address and press Enter"
                        emails={officialEmailTo}
                        onChange={setOfficialEmailTo}
                        helperText="Press Enter after typing each email address"
                        loading={officialRecipientsLoading}
                        required
                    />

                    <EmailChipInput
                        label="CC:"
                        placeholder="Enter CC email address and press Enter"
                        emails={officialEmailCc}
                        onChange={setOfficialEmailCc}
                        helperText="Press Enter after typing each email address (optional)"
                    />

                    <EmailChipInput
                        label="BCC:"
                        placeholder="Enter BCC email address and press Enter"
                        emails={officialEmailBcc}
                        onChange={setOfficialEmailBcc}
                        helperText="Press Enter after typing each email address (optional)"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => {
                        setOfficialEmailDialogOpen(false);
                        // Clear emails on close
                        setOfficialEmailTo([]);
                        setOfficialEmailCc([]);
                        setOfficialEmailBcc([]);
                    }} sx={{ fontSize: '12px' }}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={officialEmailLoading ? <CircularProgress size={16} color="inherit" /> : <EmailIcon />}
                        onClick={handleSendOfficialEmail}
                        disabled={officialEmailLoading || officialEmailTo.length === 0}
                        sx={{ fontSize: '12px' }}
                    >
                        {officialEmailLoading ? 'Sending...' : 'Send Invoices'}
                    </Button>
                </DialogActions>
            </Dialog>
            {/* Issues Dialog */}
            <Dialog open={issuesDialogOpen} onClose={() => setIssuesDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>Preflight Issues</DialogTitle>
                <DialogContent>
                    {shipmentIds.filter(id => preflightStatuses[id]?.status === 'error').length === 0 ? (
                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>No issues found.</Typography>
                    ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            {shipmentIds.filter(id => preflightStatuses[id]?.status === 'error').map(id => (
                                <Paper key={id} sx={{ p: 1.5, border: '1px solid #fee2e2', backgroundColor: '#fef2f2' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#991b1b' }}>{id}</Typography>
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                            <Button
                                                size="small"
                                                variant="outlined"
                                                color="error"
                                                onClick={() => {
                                                    setShipmentIds(shipmentIds.filter(s => s !== id));
                                                    const next = { ...preflightStatuses };
                                                    delete next[id];
                                                    setPreflightStatuses(next);
                                                }}
                                                sx={{ fontSize: '11px' }}
                                            >
                                                Remove
                                            </Button>
                                            <Button
                                                size="small"
                                                variant="contained"
                                                onClick={() => handleRetryPreflight(id)}
                                                disabled={preflightLoading}
                                                sx={{ fontSize: '11px' }}
                                            >
                                                {preflightLoading ? 'Retrying…' : 'Retry'}
                                            </Button>
                                        </Box>
                                    </Box>
                                    <Box sx={{ mt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                        {(preflightStatuses[id]?.reasons || []).map((r, idx) => (
                                            <Typography key={idx} sx={{ fontSize: '11px', color: '#991b1b' }}>• {formatPreflightReason(r)}</Typography>
                                        ))}
                                    </Box>
                                </Paper>
                            ))}
                        </Box>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setIssuesDialogOpen(false)} sx={{ fontSize: '12px' }}>Close</Button>
                </DialogActions>
            </Dialog>
        </LocalizationProvider>
    );
};

export default BulkInvoiceGenerator; 