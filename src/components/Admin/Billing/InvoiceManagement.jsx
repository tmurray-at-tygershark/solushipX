import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Card,
    CardContent,
    CircularProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    TextField,
    InputAdornment,
    IconButton,
    Chip,
    Button,
    Stack,
    Divider,
    Skeleton,
    Alert,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Tooltip,
    Autocomplete,
    Avatar,
    Menu,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Collapse
} from '@mui/material';
import {
    Search as SearchIcon,
    Clear as ClearIcon,
    Download as DownloadIcon,
    Email as EmailIcon,
    Visibility as VisibilityIcon,
    FilterList as FilterListIcon,
    GetApp as GetAppIcon,
    Add as AddIcon,
    Refresh as RefreshIcon,
    Send as SendIcon,
    PictureAsPdf as PdfIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
    AttachMoney as AttachMoneyIcon,
    ArrowUpward as ArrowUpwardIcon,
    ArrowDownward as ArrowDownwardIcon,
    MoreVert as MoreVertIcon,
    DateRange as DateRangeIcon,
    ExpandMore as ExpandMoreIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import { motion } from 'framer-motion';
import { collection, getDocs, query, orderBy, where, doc, updateDoc, addDoc, onSnapshot, deleteDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useSnackbar } from 'notistack';
import { updateShipmentWithTaxes } from '../../../services/canadianTaxService';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useCompany } from '../../../contexts/CompanyContext';
import InvoiceForm from './InvoiceForm';
import MarkAsPaidDialog from './MarkAsPaidDialog';
import { getCircleLogo } from '../../../utils/logoUtils';
import invoiceStatusService from '../../../services/invoiceStatusService';

const InvoiceManagement = () => {
    const { enqueueSnackbar } = useSnackbar();
    const { currentUser, userRole } = useAuth();
    const { connectedCompanies } = useCompany();
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [invoices, setInvoices] = useState([]);
    const [filteredInvoices, setFilteredInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Removed legacy details dialog states; using InvoiceForm overlay for details/edit
    const [menuAnchorEl, setMenuAnchorEl] = useState(null);
    const [menuInvoice, setMenuInvoice] = useState(null);
    const [selectedCompanyFilter, setSelectedCompanyFilter] = useState(null);
    const [selectedCustomerFilter, setSelectedCustomerFilter] = useState(null);
    const [selectedPaymentStatusFilter, setSelectedPaymentStatusFilter] = useState(null);

    // Date filtering state
    const [invoiceSentDateFrom, setInvoiceSentDateFrom] = useState(null);
    const [invoiceSentDateTo, setInvoiceSentDateTo] = useState(null);
    const [invoiceDueDateFrom, setInvoiceDueDateFrom] = useState(null);
    const [invoiceDueDateTo, setInvoiceDueDateTo] = useState(null);
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

    // Date change handlers with proper logging
    const handleSentDateFromChange = (newValue) => {
        console.log('📅 Sent Date FROM changed:', newValue);
        setInvoiceSentDateFrom(newValue);
    };

    const handleSentDateToChange = (newValue) => {
        console.log('📅 Sent Date TO changed:', newValue);
        setInvoiceSentDateTo(newValue);
    };

    const handleDueDateFromChange = (newValue) => {
        console.log('📅 Due Date FROM changed:', newValue);
        setInvoiceDueDateFrom(newValue);
    };

    const handleDueDateToChange = (newValue) => {
        console.log('📅 Due Date TO changed:', newValue);
        setInvoiceDueDateTo(newValue);
    };

    // CSV Export state
    const [exportLoading, setExportLoading] = useState(false);
    const [exportMenuAnchor, setExportMenuAnchor] = useState(null);

    // Sorting state
    const [sortBy, setSortBy] = useState('invoiceNumber');
    const [sortDirection, setSortDirection] = useState('desc'); // desc = highest first

    // ✅ NEW: Mark As Paid dialog state
    const [markAsPaidDialogOpen, setMarkAsPaidDialogOpen] = useState(false);
    const [markAsPaidInvoice, setMarkAsPaidInvoice] = useState(null);
    const [metrics, setMetrics] = useState({
        totalInvoices: 0,
        totalShipments: 0,
        totalOutstanding: 0,
        totalPaid: 0,
        overdue: 0
    });
    const [metricsLoading, setMetricsLoading] = useState(true);

    // Manual invoice creation states
    const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false);
    const [editingInvoiceId, setEditingInvoiceId] = useState(null);
    const [companiesMap, setCompaniesMap] = useState({});
    const [customersByCompany, setCustomersByCompany] = useState({});
    const [customersMap, setCustomersMap] = useState({}); // key: customerId → customer doc
    const [loadingCompanies, setLoadingCompanies] = useState(false);
    const [loadingCustomers, setLoadingCustomers] = useState(false);

    // Dynamic invoice statuses
    const [invoiceStatuses, setInvoiceStatuses] = useState([]);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [selectedUploadFiles, setSelectedUploadFiles] = useState([]);

    // Load invoice statuses from Firebase
    const loadInvoiceStatuses = async () => {
        try {
            const statuses = await invoiceStatusService.loadInvoiceStatuses();
            setInvoiceStatuses(statuses);
        } catch (error) {
            console.error('Error loading invoice statuses:', error);
            setInvoiceStatuses([]);
        }
    };

    useEffect(() => {
        // Only fetch if we have a userRole and auth is loaded
        if (userRole && currentUser) {
            fetchInvoices();
            loadCompaniesDirectory();
            loadInvoiceStatuses();
        }
    }, [userRole, connectedCompanies, currentUser]);

    const loadCompaniesDirectory = async () => {
        try {
            if (loadingCompanies) return;
            setLoadingCompanies(true);
            const snap = await getDocs(collection(db, 'companies'));
            const map = {};
            snap.forEach(d => {
                const data = { id: d.id, ...d.data() };
                const key = data.companyID || data.id;
                if (key) map[key] = data;
            });
            setCompaniesMap(map);
        } catch (e) {
            console.warn('Failed to load companies directory', e);
        } finally {
            setLoadingCompanies(false);
        }
    };

    useEffect(() => {
        const loadCustomers = async (companyId) => {
            try {
                if (!companyId || customersByCompany[companyId] || loadingCustomers) return;
                setLoadingCustomers(true);
                const q = query(collection(db, 'customers'), where('companyID', '==', companyId));
                const snap = await getDocs(q);
                const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setCustomersByCompany(prev => ({ ...prev, [companyId]: list }));
            } catch (e) {
                console.warn('Failed to load customers for company', companyId, e);
            } finally {
                setLoadingCustomers(false);
            }
        };

        if (selectedCompanyFilter?.id) {
            loadCustomers(selectedCompanyFilter.id);
        }
    }, [selectedCompanyFilter, customersByCompany, loadingCustomers]);

    // Helper functions for shipment data processing
    const getShipmentCurrency = (shipment) => {
        return shipment.currency ||
            shipment.selectedRate?.currency ||
            shipment.markupRates?.currency ||
            shipment.actualRates?.currency ||
            (shipment.shipFrom?.country === 'CA' || shipment.shipTo?.country === 'CA' ? 'CAD' : 'USD') ||
            'USD';
    };

    const getShipmentCharge = (shipment) => {
        if (shipment.creationMethod === 'quickship' && shipment.manualRates && Array.isArray(shipment.manualRates)) {
            return shipment.manualRates.reduce((sum, rate) => {
                return sum + (parseFloat(rate.charge) || 0);
            }, 0);
        } else {
            return shipment.markupRates?.totalCharges ||
                shipment.totalCharges ||
                shipment.selectedRate?.totalCharges || 0;
        }
    };

    const mapInvoiceRecord = (inv) => {
        const issueDate = inv.issueDate?.toDate ? inv.issueDate.toDate() : (inv.issueDate ? new Date(inv.issueDate) : null);
        const dueDate = inv.dueDate?.toDate ? inv.dueDate.toDate() : (inv.dueDate ? new Date(inv.dueDate) : null);
        const createdAt = inv.createdAt?.toDate ? inv.createdAt.toDate() : (inv.createdAt ? new Date(inv.createdAt) : issueDate || new Date());
        return {
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            companyName: inv.companyName,
            companyId: inv.companyId || inv.companyID || inv.company?.id || inv.company?.companyID,
            companyCode: inv.companyCode || inv.company?.code || '',
            companyLogo: inv.companyLogo || inv.companyLogoUrl || inv.company?.logo || inv.company?.logoUrl || '',
            customerName: inv.customerName || inv.customer?.name || '',
            customerId: inv.customerId || inv.customer?.id || inv.customerID,
            customerLogo: inv.customerLogo || inv.customer?.logo || inv.customer?.logoUrl || '',
            fileUrl: inv.fileUrl || inv.pdfUrl || '',
            status: inv.paymentStatus || inv.status || 'outstanding',
            total: Number(inv.total || 0),
            subtotal: Number(inv.subtotal || 0),
            tax: Number(inv.tax || 0),
            currency: inv.currency || 'CAD',
            issueDate,
            dueDate,
            createdAt,
            paymentTerms: inv.paymentTerms || 'NET 30',
            shipmentCount: Array.isArray(inv.shipmentIds) ? inv.shipmentIds.length : (inv.shipments?.length || 0),
            shipmentIds: inv.shipmentIds || [],
            lineItems: inv.items || [],
            carrierInvoiceUrls: inv.carrierInvoiceUrls || []
        };
    };

    const fetchInvoices = async () => {
        try {
            setLoading(true);
            setError(null);

            // 1) Try to load actual invoices from 'invoices' collection first
            const invoicesSnap = await getDocs(query(collection(db, 'invoices'), orderBy('createdAt', 'desc')));
            const invoicesFromCollection = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

            let invoiceData = [];
            if (invoicesFromCollection.length > 0) {
                // Show ALL invoices in the main invoice management section
                invoiceData = invoicesFromCollection.map(inv => mapInvoiceRecord(inv));
            } else {
                // No fallback: show a blank table until invoices exist or are manually added
                invoiceData = [];
            }

            // Apply default sort (highest invoice number first)
            const sortedData = sortInvoices(invoiceData);

            setInvoices(invoiceData);
            setFilteredInvoices(sortedData);
            calculateMetrics(invoiceData);

            // Hydrate customers directory for avatars
            const uniqueCustomerIds = Array.from(new Set(
                invoiceData.map(inv => inv.customerId).filter(Boolean)
            ));
            if (uniqueCustomerIds.length > 0) {
                await loadCustomersDirectoryByIds(uniqueCustomerIds);
            }

        } catch (err) {
            console.error('Error fetching invoice data from shipments:', err);
            setError('Failed to load invoice data: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    // Live updates for invoices (processing → populated)
    useEffect(() => {
        const qRef = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(qRef, (snap) => {
            // Show ALL invoices in the main invoice management section
            const allInvoices = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const data = allInvoices.map(d => mapInvoiceRecord(d));
            setInvoices(data);

            // Apply current sorting to the data
            const sortedData = sortInvoices(data);
            setFilteredInvoices(sortedData);
        });
        return () => unsub();
    }, []);

    // Load customer docs by IDs in batches of 10 to respect Firestore 'in' limit
    const loadCustomersDirectoryByIds = async (ids) => {
        try {
            const batchSize = 10;
            const loaded = {};
            for (let i = 0; i < ids.length; i += batchSize) {
                const batchIds = ids.slice(i, i + batchSize);
                const q = query(collection(db, 'customers'), where('customerID', 'in', batchIds));
                const snapByBusinessId = await getDocs(q).catch(() => ({ empty: true, docs: [] }));
                if (!snapByBusinessId.empty) {
                    snapByBusinessId.docs.forEach(d => {
                        loaded[d.data().customerID] = { id: d.id, ...d.data() };
                    });
                }

                // Also try doc IDs for any remaining ones
                const remaining = batchIds.filter(id => !loaded[id]);
                for (const rid of remaining) {
                    try {
                        const docRef = doc(db, 'customers', rid);
                        const docSnap = await getDocs(query(collection(db, 'customers'), where('id', '==', rid))).catch(() => ({ empty: true }));
                        // Fallback to direct getDoc when available
                        // Skipping direct getDoc to keep imports minimal in this module
                        if (!docSnap.empty) {
                            const d = docSnap.docs[0];
                            loaded[rid] = { id: d.id, ...d.data() };
                        }
                    } catch (e) { /* ignore */ }
                }
            }
            setCustomersMap(prev => ({ ...prev, ...loaded }));
        } catch (e) {
            console.warn('Failed to hydrate customers directory', e);
        }
    };

    const calculateMetrics = (invoiceData) => {
        setMetricsLoading(true);

        const now = new Date();
        let totalShipments = 0;

        const metrics = {
            totalInvoices: invoiceData.length,
            totalShipments: 0,
            totalOutstanding: 0,
            totalPaid: 0,
            overdue: 0
        };

        invoiceData.forEach(invoice => {
            // Count shipments in this invoice
            const shipmentCount = invoice.shipmentCount || 0;
            totalShipments += shipmentCount;

            if (invoice.status === 'paid') {
                metrics.totalPaid += invoice.total || 0;
            } else {
                metrics.totalOutstanding += invoice.total || 0;

                // Check if overdue
                if (invoice.dueDate && invoice.dueDate < now) {
                    metrics.overdue += invoice.total || 0;
                }
            }
        });

        metrics.totalShipments = totalShipments;
        setMetrics(metrics);
        setMetricsLoading(false);
    };

    // 🔄 ENHANCED: Update invoice document status (not shipments)
    const handleStatusUpdate = async (invoiceId, newStatus, paymentDetails = null, notes = '') => {
        try {
            enqueueSnackbar(`Updating invoice status to ${newStatus}...`, { variant: 'info' });

            // Update invoice document in collection
            const invRef = doc(db, 'invoices', invoiceId);
            await updateDoc(invRef, {
                status: newStatus,
                paymentStatus: newStatus === 'paid' ? 'paid' : (newStatus === 'cancelled' || newStatus === 'void') ? 'cancelled' : 'outstanding',
                updatedAt: new Date(),
                ...(paymentDetails && { paymentDetails }),
                ...(notes && { statusNotes: notes })
            });

            enqueueSnackbar(`Invoice ${invoiceId} updated to ${newStatus}`, { variant: 'success' });

        } catch (error) {
            console.error('Error updating invoice status:', error);
            enqueueSnackbar('Failed to update invoice status: ' + error.message, { variant: 'error' });
        }
    };

    // 🔄 NEW: Mark invoice as paid with payment details
    const handleMarkAsPaid = async (invoice) => {
        try {
            const paymentDetails = {
                amount: invoice.total,
                currency: invoice.currency || 'USD',
                method: 'Manual Entry',
                reference: `Payment for ${invoice.invoiceNumber}`,
                recordedBy: 'admin'
            };

            await handleStatusUpdate(invoice.id, 'paid', paymentDetails, 'Payment recorded by admin');
        } catch (error) {
            console.error('Error marking invoice as paid:', error);
            enqueueSnackbar('Failed to mark invoice as paid: ' + error.message, { variant: 'error' });
        }
    };

    // ✅ NEW: Open Mark As Paid dialog
    const handleOpenMarkAsPaid = (invoice) => {
        setMarkAsPaidInvoice(invoice);
        setMarkAsPaidDialogOpen(true);
        setMenuAnchorEl(null);
        setMenuInvoice(null);
    };

    // ✅ NEW: Handle successful payment marking
    const handleMarkAsPaidSuccess = () => {
        // Refresh invoice data and metrics (calculateMetrics is called automatically in fetchInvoices)
        fetchInvoices();
        setMarkAsPaidDialogOpen(false);
        setMarkAsPaidInvoice(null);
    };

    // 🔄 NEW: Mark invoice as cancelled
    const handleCancelInvoice = async (invoice) => {
        try {
            await handleStatusUpdate(invoice.id, 'cancelled', null, 'Invoice cancelled by admin');
        } catch (error) {
            console.error('Error cancelling invoice:', error);
            enqueueSnackbar('Failed to cancel invoice: ' + error.message, { variant: 'error' });
        }
    };

    // 🗑️ NEW: Permanently delete a voided invoice
    const handleDeleteInvoice = async (invoice) => {
        try {
            await deleteDoc(doc(db, 'invoices', invoice.id));
            enqueueSnackbar('Invoice deleted', { variant: 'success' });
            setMenuAnchorEl(null);
            setMenuInvoice(null);
        } catch (error) {
            console.error('Error deleting invoice:', error);
            enqueueSnackbar('Failed to delete invoice: ' + error.message, { variant: 'error' });
        }
    };

    const handleResendInvoice = async (invoice) => {
        try {
            // Call the cloud function to resend the invoice
            const response = await fetch('/api/resend-invoice', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    invoiceId: invoice.id,
                    companyId: invoice.companyId
                })
            });

            if (response.ok) {
                enqueueSnackbar('Invoice resent successfully', { variant: 'success' });
            } else {
                throw new Error('Failed to resend invoice');
            }
        } catch (error) {
            console.error('Error resending invoice:', error);
            enqueueSnackbar('Failed to resend invoice', { variant: 'error' });
        }
    };

    // 🔄 NEW: Enhanced regenerate PDF functionality
    const handleRegenerateInvoice = async (invoice) => {
        try {
            const regenerateInvoiceFunction = httpsCallable(functions, 'regenerateInvoice');

            enqueueSnackbar('Regenerating invoice PDF...', { variant: 'info' });

            const result = await regenerateInvoiceFunction({
                invoiceId: invoice.id,
                action: 'regenerate'
            });

            if (result.data.success) {
                enqueueSnackbar(
                    `Invoice ${result.data.invoiceNumber} PDF regenerated successfully`,
                    { variant: 'success' }
                );

                // Refresh invoice list to show updated data
                fetchInvoices();
            } else {
                throw new Error('Failed to regenerate invoice');
            }
        } catch (error) {
            console.error('Error regenerating invoice:', error);
            enqueueSnackbar('Failed to regenerate invoice: ' + error.message, { variant: 'error' });
        }
    };

    // 🔄 NEW: Enhanced resend email functionality
    const handleResendInvoiceEmail = async (invoice) => {
        try {
            const regenerateInvoiceFunction = httpsCallable(functions, 'regenerateInvoice');

            enqueueSnackbar('Resending invoice email...', { variant: 'info' });

            const result = await regenerateInvoiceFunction({
                invoiceId: invoice.id,
                action: 'resend'
            });

            if (result.data.success) {
                enqueueSnackbar(
                    `Invoice ${result.data.invoiceNumber} email resent successfully to ${result.data.emailSentTo}`,
                    { variant: 'success' }
                );

                // Refresh invoice list to show updated data
                fetchInvoices();
            } else {
                throw new Error('Failed to resend invoice email');
            }
        } catch (error) {
            console.error('Error resending invoice email:', error);
            enqueueSnackbar('Failed to resend invoice email: ' + error.message, { variant: 'error' });
        }
    };

    // 🔄 NEW: Combined regenerate and resend
    const handleRegenerateAndResend = async (invoice) => {
        try {
            const regenerateInvoiceFunction = httpsCallable(functions, 'regenerateInvoice');

            enqueueSnackbar('Regenerating PDF and resending email...', { variant: 'info' });

            const result = await regenerateInvoiceFunction({
                invoiceId: invoice.id,
                action: 'both'
            });

            if (result.data.success) {
                enqueueSnackbar(
                    `Invoice ${result.data.invoiceNumber} regenerated and resent successfully`,
                    { variant: 'success' }
                );

                // Refresh invoice list to show updated data
                fetchInvoices();
            } else {
                throw new Error('Failed to regenerate and resend invoice');
            }
        } catch (error) {
            console.error('Error regenerating and resending invoice:', error);
            enqueueSnackbar('Failed to regenerate and resend invoice: ' + error.message, { variant: 'error' });
        }
    };

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleSearchChange = (event) => {
        setSearchQuery(event.target.value);
    };

    const handleStatusFilterChange = (event) => {
        setStatusFilter(event.target.value);
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        setStatusFilter('');
    };

    // CSV Export Functions
    const fetchShipmentData = async (shipmentId) => {
        try {
            console.log('🔍 Fetching shipment data for:', shipmentId);

            // First try to find by document ID
            const shipmentDocRef = doc(db, 'shipments', shipmentId);
            const shipmentDoc = await getDocs(query(collection(db, 'shipments'), where('shipmentID', '==', shipmentId)));

            if (!shipmentDoc.empty) {
                const shipmentData = shipmentDoc.docs[0].data();
                console.log('📦 Found shipment:', shipmentData);
                return { id: shipmentDoc.docs[0].id, ...shipmentData };
            }

            // Fallback: try to find by shipmentID field
            const shipmentQuery = query(collection(db, 'shipments'), where('shipmentID', '==', shipmentId));
            const shipmentSnapshot = await getDocs(shipmentQuery);

            if (!shipmentSnapshot.empty) {
                const shipmentData = shipmentSnapshot.docs[0].data();
                console.log('📦 Found shipment by ID field:', shipmentData);
                return { id: shipmentSnapshot.docs[0].id, ...shipmentData };
            }

            console.warn('⚠️ Shipment not found:', shipmentId);
            return null;
        } catch (error) {
            console.error('❌ Error fetching shipment:', shipmentId, error);
            return null;
        }
    };

    const extractShipmentFinancialData = (shipment) => {
        console.log('💰 Extracting financial data for shipment:', shipment?.shipmentID);

        if (!shipment) return {
            quotedCost: 0,
            quotedCharge: 0,
            actualCost: 0,
            actualCharge: 0,
            currency: 'CAD',
            profit: 0
        };

        // Helper function to check if a charge is a tax
        const isChargeTypeTax = (charge) => {
            const taxKeywords = ['HST', 'GST', 'PST', 'QST', 'QGST', 'TAX', 'TAXES'];
            const chargeName = (charge.chargeName || charge.name || charge.code || '').toUpperCase();
            return charge.isTax || taxKeywords.some(keyword => chargeName.includes(keyword));
        };

        // Helper function to calculate subtotal and taxes from charges array (only from actual customer charges)
        const calculateSubtotalAndTax = (charges, totalAmount) => {
            let subtotal = 0;
            let taxes = 0;

            console.log('🔍 Tax calculation input:', {
                chargesArray: Array.isArray(charges),
                chargesLength: charges?.length,
                totalAmount,
                charges: charges
            });

            if (Array.isArray(charges) && charges.length > 0) {
                charges.forEach(charge => {
                    // For tax calculations, prioritize customer charge amounts over cost amounts
                    const amount = parseFloat(charge.amount || charge.charge || charge.actualCharge || charge.cost || 0);
                    const chargeName = (charge.name || charge.description || charge.code || '').toLowerCase();

                    // Enhanced tax detection
                    const isTaxCharge = charge.isTax ||
                        (charge.code && ['GST', 'HST', 'PST', 'QST', 'QGST', 'TAX', 'TAXES'].includes(charge.code.toUpperCase())) ||
                        chargeName.includes('tax') ||
                        chargeName.includes('gst') ||
                        chargeName.includes('hst') ||
                        chargeName.includes('pst') ||
                        chargeName.includes('qst');

                    console.log('🔍 Charge analysis:', {
                        charge: charge.name || charge.code,
                        amount,
                        isTaxCharge
                    });

                    if (isTaxCharge) {
                        taxes += amount;
                    } else {
                        subtotal += amount;
                    }
                });

                // If we found charges but no taxes, and total is provided, estimate
                if (taxes === 0 && totalAmount > 0) {
                    console.log('🔍 No taxes found in charges, estimating from total');
                    const estimatedTax = totalAmount * 0.13; // 13% average Canadian tax rate
                    return {
                        subtotal: totalAmount - estimatedTax,
                        taxes: estimatedTax
                    };
                }
            } else if (totalAmount > 0) {
                // No charges array provided, estimate tax based on total amount
                console.log('🔍 No charges array, estimating tax from total amount');
                const estimatedTax = totalAmount * 0.13; // 13% average Canadian tax rate
                return {
                    subtotal: totalAmount - estimatedTax,
                    taxes: estimatedTax
                };
            }

            console.log('🔍 Tax calculation result:', { subtotal, taxes });
            return { subtotal, taxes };
        };

        // Extract rate information using multiple sources
        const getRateData = () => {
            console.log('🔍 Analyzing shipment financial data for:', shipment.shipmentID);
            console.log('🔍 Available data structures:', {
                hasActualRates: !!shipment.actualRates,
                hasMarkupRates: !!shipment.markupRates,
                hasManualRates: !!shipment.manualRates,
                hasSelectedRate: !!shipment.selectedRate,
                hasBillingDetails: !!shipment.billingDetails,
                hasUpdatedCharges: !!shipment.updatedCharges,
                hasTaxBreakdown: !!shipment.taxBreakdown,
                hasChargesBreakdown: !!shipment.chargesBreakdown,
                creationMethod: shipment.creationMethod
            });

            // Check for tax breakdown in different locations
            console.log('🔍 Tax data sources:', {
                billingDetails: shipment.billingDetails,
                taxBreakdown: shipment.taxBreakdown,
                chargesBreakdown: shipment.chargesBreakdown,
                selectedRateTaxes: shipment.selectedRate?.taxes,
                markupRatesTaxes: shipment.markupRates?.taxes,
                actualRatesTaxes: shipment.actualRates?.taxes
            });

            // Check for QuickShip manual rates (has separate cost and charge fields)
            if (shipment.creationMethod === 'quickship' && shipment.manualRates && Array.isArray(shipment.manualRates)) {
                console.log('🚚 Found QuickShip manual rates with separate cost/charge');

                // Calculate total actual charge (includes taxes)
                const totalActualCharge = shipment.manualRates.reduce((sum, rate) => sum + (parseFloat(rate.actualCharge) || parseFloat(rate.charge) || 0), 0);

                // Extract tax breakdown from actual charges only
                const actualBreakdown = calculateSubtotalAndTax(shipment.manualRates, totalActualCharge);

                // Extract NON-TAX amounts only from manual rates for quoted costs/charges
                const quotedCostTotal = shipment.manualRates
                    .filter(rate => !isChargeTypeTax(rate))
                    .reduce((sum, rate) => sum + (parseFloat(rate.quotedCost) || parseFloat(rate.cost) || 0), 0);

                const quotedChargeTotal = shipment.manualRates
                    .filter(rate => !isChargeTypeTax(rate))
                    .reduce((sum, rate) => sum + (parseFloat(rate.quotedCharge) || parseFloat(rate.charge) || 0), 0);

                const actualCostTotal = shipment.manualRates
                    .filter(rate => !isChargeTypeTax(rate))
                    .reduce((sum, rate) => sum + (parseFloat(rate.actualCost) || parseFloat(rate.cost) || 0), 0);

                // Use the totals directly (already tax-free since we filtered out tax items)
                const quotedCost = quotedCostTotal;
                const quotedCharge = quotedChargeTotal;
                const actualCost = actualCostTotal;

                // For actual charge, also use the tax-free amount (same as actualCost for QuickShip)
                const taxFreeActualCharge = shipment.manualRates
                    .filter(rate => !isChargeTypeTax(rate))
                    .reduce((sum, rate) => sum + (parseFloat(rate.actualCharge) || parseFloat(rate.charge) || 0), 0);

                console.log('🚚 QuickShip extracted amounts:', {
                    quotedCostTotal,
                    quotedChargeTotal,
                    actualCostTotal,
                    totalActualCharge,
                    subtotal: actualBreakdown.subtotal,
                    taxes: actualBreakdown.taxes
                });

                console.log('🚚 QuickShip final tax-free amounts:', {
                    quotedCost,
                    quotedCharge,
                    actualCost,
                    taxFreeActualCharge,
                    totalActualChargeWithTaxes: totalActualCharge,
                    profit: taxFreeActualCharge - actualCost
                });

                return {
                    quotedCost: quotedCost,
                    quotedCharge: quotedCharge,
                    actualCost: actualCost,
                    actualCharge: taxFreeActualCharge,      // Now also tax-free
                    actualSubtotal: actualBreakdown.subtotal,
                    actualTax: actualBreakdown.taxes,
                    currency: shipment.manualRates[0]?.currency || 'CAD'
                };
            }

            // Check for dual rate system (actualRates = carrier cost, markupRates = customer charge)
            if (shipment.actualRates && shipment.markupRates) {
                console.log('📊 Found dual rate system - actualRates (cost) + markupRates (charge)');

                // Extract actual values from dual rate system (these should be tax-free for costs)
                const actualCost = shipment.actualRates.totalCharges || 0;  // Carrier cost (no taxes)
                const totalActualCharge = shipment.markupRates.totalCharges || 0;  // Customer charge (includes taxes)

                // Extract quoted values from selectedRate (original quote) - should be tax-free
                const quotedTotal = shipment.selectedRate?.totalCharges || shipment.selectedRate?.total || 0;

                // For quoted amounts, we need to differentiate cost vs charge (both tax-free)
                let quotedCost = shipment.selectedRate?.quotedCost || 0;
                let quotedCharge = shipment.selectedRate?.quotedCharge || 0;

                // If no separate quoted cost/charge, estimate based on the quoted total
                if (quotedCost === 0 && quotedCharge === 0 && quotedTotal > 0) {
                    // Use the same ratio as actual rates if available
                    if (actualCost > 0 && totalActualCharge > 0) {
                        const ratio = actualCost / totalActualCharge;
                        quotedCost = quotedTotal * ratio;
                        quotedCharge = quotedTotal;
                    } else {
                        // Default estimation: 85% cost, 100% charge (15% markup)
                        quotedCost = quotedTotal * 0.85;
                        quotedCharge = quotedTotal;
                    }
                }

                // Calculate subtotal and tax breakdown ONLY from customer charges (markupRates)
                const actualBreakdown = calculateSubtotalAndTax(shipment.markupRates.charges || [], totalActualCharge);

                // Ensure quoted amounts are tax-free using the breakdown
                const taxFreeQuotedCost = quotedCost > 0 ? (quotedCost * (actualBreakdown.subtotal / totalActualCharge)) : actualBreakdown.subtotal * 0.85;
                const taxFreeQuotedCharge = quotedCharge > 0 ? (quotedCharge * (actualBreakdown.subtotal / totalActualCharge)) : actualBreakdown.subtotal;

                return {
                    quotedCost: parseFloat(taxFreeQuotedCost) || 0,      // Tax-free
                    quotedCharge: parseFloat(taxFreeQuotedCharge) || 0,  // Tax-free
                    actualCost: parseFloat(actualCost) || 0,             // Tax-free (carrier cost)
                    actualCharge: parseFloat(totalActualCharge) || 0,    // Includes taxes
                    actualSubtotal: actualBreakdown.subtotal,            // Tax-free portion of actual charge
                    actualTax: actualBreakdown.taxes,                   // Tax portion of actual charge
                    currency: shipment.actualRates.currency || shipment.markupRates.currency || 'CAD'
                };
            }


            // Check for updatedCharges (inline edit system with quoted vs actual)
            if (shipment.updatedCharges && Array.isArray(shipment.updatedCharges)) {
                console.log('📝 Found updatedCharges with quoted/actual separation');

                // These should be tax-free amounts
                const quotedCost = shipment.updatedCharges.reduce((sum, charge) => sum + (parseFloat(charge.quotedCost) || 0), 0);
                const quotedCharge = shipment.updatedCharges.reduce((sum, charge) => sum + (parseFloat(charge.quotedCharge) || 0), 0);
                const actualCost = shipment.updatedCharges.reduce((sum, charge) => sum + (parseFloat(charge.actualCost) || 0), 0);
                const totalActualCharge = shipment.updatedCharges.reduce((sum, charge) => sum + (parseFloat(charge.actualCharge) || 0), 0);

                // Calculate subtotal and tax breakdown ONLY from actual charges
                const actualBreakdown = calculateSubtotalAndTax(shipment.updatedCharges, totalActualCharge);

                // Ensure quoted amounts are tax-free by using the breakdown ratio
                const taxFreeQuotedCost = quotedCost > 0 ? (quotedCost * (actualBreakdown.subtotal / totalActualCharge)) : actualBreakdown.subtotal * 0.85;
                const taxFreeQuotedCharge = quotedCharge > 0 ? (quotedCharge * (actualBreakdown.subtotal / totalActualCharge)) : actualBreakdown.subtotal;
                const taxFreeActualCost = actualCost > 0 ? (actualCost * (actualBreakdown.subtotal / totalActualCharge)) : actualBreakdown.subtotal * 0.85;

                return {
                    quotedCost: parseFloat(taxFreeQuotedCost) || 0,       // Tax-free
                    quotedCharge: parseFloat(taxFreeQuotedCharge) || 0,   // Tax-free
                    actualCost: parseFloat(taxFreeActualCost) || 0,       // Tax-free
                    actualCharge: totalActualCharge,                      // Includes taxes
                    actualSubtotal: actualBreakdown.subtotal,            // Tax-free portion
                    actualTax: actualBreakdown.taxes,                    // Tax portion
                    currency: shipment.updatedCharges[0]?.currency || 'CAD'
                };
            }

            // Check for selected rate (original quote) and billing details (actual)
            if (shipment.selectedRate || shipment.billingDetails) {
                console.log('📋 Found selectedRate/billingDetails system');

                // Quoted amounts (from selectedRate) - should be tax-free
                const quotedAmount = shipment.selectedRate?.totalCharges ||
                    shipment.selectedRate?.total ||
                    shipment.selectedRate?.amount || 0;

                // Actual amounts (from billingDetails) - may include taxes
                const actualAmount = shipment.billingDetails?.totalAmount ||
                    shipment.billingDetails?.total ||
                    quotedAmount;

                // For systems without explicit cost/charge separation:
                // Quoted amounts are typically tax-free estimates
                const quotedCost = quotedAmount * 0.85;  // Tax-free estimate
                const quotedCharge = quotedAmount;       // Tax-free estimate
                const actualCost = actualAmount * 0.75;  // Tax-free estimate (lower due to markup + taxes)

                // Calculate tax breakdown from actual charge (includes taxes)
                const actualBreakdown = calculateSubtotalAndTax([], actualAmount);

                return {
                    quotedCost: parseFloat(quotedCost) || 0,     // Tax-free
                    quotedCharge: parseFloat(quotedCharge) || 0, // Tax-free
                    actualCost: parseFloat(actualCost) || 0,     // Tax-free
                    actualCharge: parseFloat(actualAmount) || 0,  // Includes taxes
                    actualSubtotal: actualBreakdown.subtotal,    // Tax-free portion
                    actualTax: actualBreakdown.taxes,           // Tax portion
                    currency: shipment.billingDetails?.currency || shipment.selectedRate?.currency || 'CAD'
                };
            }

            console.log('⚠️ No financial data found in shipment');
            return {
                quotedCost: 0,
                quotedCharge: 0,
                actualCost: 0,
                actualCharge: 0,
                actualSubtotal: 0,
                actualTax: 0,
                currency: 'CAD'
            };
        };

        const rateData = getRateData();
        const profit = parseFloat(rateData.actualCharge) - parseFloat(rateData.actualCost);

        console.log('💰 Final extracted financial data:', {
            quotedCost: rateData.quotedCost,
            quotedCharge: rateData.quotedCharge,
            actualCost: rateData.actualCost,
            actualCharge: rateData.actualCharge,
            actualSubtotal: rateData.actualSubtotal,
            actualTax: rateData.actualTax,
            profit: profit,
            currency: rateData.currency
        });

        return {
            ...rateData,
            profit
        };
    };

    // Invoice Overview Export - High level invoice totals only
    const generateInvoiceOverviewCSV = async () => {
        setExportLoading(true);
        setExportMenuAnchor(null);
        try {
            console.log('📊 Starting Invoice Overview CSV export for', filteredInvoices.length, 'invoices');

            const csvData = [];

            // Process each invoice for overview data
            for (const invoice of filteredInvoices) {
                console.log('📄 Processing invoice overview:', invoice.invoiceNumber);
                console.log('📄 Invoice object structure:', {
                    hasTotal: !!invoice.total,
                    hasTax: !!invoice.tax,
                    hasSubtotal: !!invoice.subtotal,
                    hasItems: !!invoice.items,
                    hasTaxBreakdown: !!invoice.taxBreakdown,
                    hasLineItems: !!invoice.lineItems,
                    total: invoice.total,
                    tax: invoice.tax,
                    subtotal: invoice.subtotal,
                    currency: invoice.currency
                });

                // Calculate totals from all shipments in the invoice
                let totalActualCost = 0;
                let totalActualCharge = 0;
                let totalTax = 0;
                let currency = invoice.currency || 'CAD';

                // Extract shipment IDs from invoice
                const shipmentIds = [];
                if (invoice.shipments && Array.isArray(invoice.shipments)) {
                    shipmentIds.push(...invoice.shipments);
                } else if (invoice.shipmentIds && Array.isArray(invoice.shipmentIds)) {
                    shipmentIds.push(...invoice.shipmentIds);
                } else if (invoice.shipmentId) {
                    shipmentIds.push(invoice.shipmentId);
                } else if (invoice.items && Array.isArray(invoice.items)) {
                    invoice.items.forEach(item => {
                        if (item.shipmentId) shipmentIds.push(item.shipmentId);
                        if (item.shipmentID) shipmentIds.push(item.shipmentID);
                    });
                }

                // Fetch financial data for all shipments and recalculate taxes properly
                for (const shipmentId of shipmentIds) {
                    const shipmentData = await fetchShipmentData(shipmentId);
                    if (shipmentData) {
                        // Use the same tax calculation logic as invoice generation
                        let shipmentWithCorrectTaxes = shipmentData;

                        // If this is a Canadian domestic shipment, recalculate taxes using current rates
                        if (shipmentData.shipFrom?.country === 'CA' && shipmentData.shipTo?.country === 'CA') {
                            console.log(`🍁 [Tax Recalc] Recalculating taxes for Canadian shipment ${shipmentId}`);
                            try {
                                // Get available charge types (we'll need this for tax calculation)
                                // For now, use basic charge types - in production this should come from database
                                const basicChargeTypes = [
                                    { code: 'FRT', name: 'Freight', isTax: false },
                                    { code: 'HST ON', name: 'HST Ontario', isTax: true },
                                    { code: 'HST', name: 'HST', isTax: true },
                                    { code: 'GST', name: 'GST', isTax: true },
                                    { code: 'QST', name: 'QST Quebec', isTax: true }
                                    // PST BC removed - freight/transportation services are PST exempt in BC
                                ];

                                shipmentWithCorrectTaxes = updateShipmentWithTaxes(shipmentData, basicChargeTypes);
                                console.log(`🍁 [Tax Recalc] Updated shipment with correct taxes`);
                            } catch (error) {
                                console.warn(`⚠️ [Tax Recalc] Failed to recalculate taxes for ${shipmentId}:`, error);
                            }
                        }

                        const financialData = extractShipmentFinancialData(shipmentWithCorrectTaxes);
                        console.log(`💰 [Overview] Financial data for ${shipmentId} (with recalculated taxes):`, {
                            actualCost: financialData.actualCost,
                            actualCharge: financialData.actualCharge,
                            actualTax: financialData.actualTax,
                            actualSubtotal: financialData.actualSubtotal
                        });

                        totalActualCost += financialData.actualCost || 0;
                        totalActualCharge += financialData.actualCharge || 0;
                        totalTax += financialData.actualTax || 0;
                        if (financialData.currency) currency = financialData.currency;
                    }
                }

                console.log(`💰 [Overview] Invoice ${invoice.invoiceNumber} totals from shipments:`, {
                    totalActualCost,
                    totalActualCharge,
                    totalTax,
                    currency
                });

                // Use the exact invoice totals from the PDF/database
                if (invoice.total) {
                    console.log(`💰 [Invoice PDF] Using exact invoice totals from PDF/database`);
                    const invoiceGrandTotal = invoice.total; // $1,321.35

                    // The invoice PDF shows: Subtotal $1,215.00 + Taxes $106.35 = Total $1,321.35
                    // Calculate tax as the difference between total and subtotal
                    totalTax = invoiceGrandTotal - totalActualCharge; // $1,321.35 - $1,215.00 = $106.35

                    console.log(`💰 [Invoice PDF] Exact calculation: Total ${invoiceGrandTotal} - Charge ${totalActualCharge} = Tax ${totalTax}`);

                    // Keep the cost calculation from shipments if available
                    if (totalActualCost === 0) {
                        totalActualCost = totalActualCharge * 0.8; // Estimate if no cost data
                    }
                } else if (shipmentIds.length === 0) {
                    // No shipment data and no invoice totals
                    console.log(`💰 [Fallback] No data available, using defaults`);
                    const invoiceGrandTotal = invoice.amount || 0;
                    totalTax = invoiceGrandTotal * 0.13 / 1.13;
                    totalActualCharge = invoiceGrandTotal - totalTax;
                    totalActualCost = totalActualCharge * 0.8;
                }

                console.log(`💰 [Final] Invoice ${invoice.invoiceNumber} final totals:`, {
                    finalCost: totalActualCost,
                    finalCharge: totalActualCharge,
                    finalTax: totalTax,
                    currency
                });

                // Calculate profit (charge - cost, both without tax)
                const profit = totalActualCharge - totalActualCost;
                // Invoice total is the sum of charge + tax
                const invoiceTotal = totalActualCharge + totalTax;

                csvData.push({
                    invoiceNumber: invoice.invoiceNumber || invoice.id,
                    company: invoice.companyName || invoice.company || 'Unknown',
                    customer: invoice.customerName || invoice.customer || 'Unknown',
                    invoiceDate: invoice.issueDate ? dayjs(invoice.issueDate).format('MM/DD/YYYY') : 'N/A',
                    dueDate: invoice.dueDate ? dayjs(invoice.dueDate).format('MM/DD/YYYY') : 'N/A',
                    actualCost: `$${totalActualCost.toFixed(2)} ${currency}`,
                    actualCharge: `$${totalActualCharge.toFixed(2)} ${currency}`,
                    totalTax: `$${totalTax.toFixed(2)} ${currency}`,
                    profit: `$${profit.toFixed(2)} ${currency}`,
                    invoiceTotal: `$${invoiceTotal.toFixed(2)} ${currency}`
                });
            }

            console.log('📊 Generated Invoice Overview CSV data with', csvData.length, 'rows');

            // Generate CSV content
            const headers = [
                'INVOICE #',
                'COMPANY',
                'CUSTOMER',
                'INVOICE DATE',
                'DUE DATE',
                'ACTUAL COST',
                'ACTUAL CHARGE',
                'TOTAL TAX',
                'PROFIT',
                'INVOICE TOTAL'
            ];

            const csvContent = [
                headers.join(','),
                ...csvData.map(row => [
                    row.invoiceNumber,
                    `"${row.company}"`,
                    `"${row.customer}"`,
                    row.invoiceDate,
                    row.dueDate,
                    `"${row.actualCost}"`,
                    `"${row.actualCharge}"`,
                    `"${row.totalTax}"`,
                    `"${row.profit}"`,
                    `"${row.invoiceTotal}"`
                ].join(','))
            ].join('\n');

            // Download CSV
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);

            // Generate filename
            let dateRange = '';
            if (invoiceSentDateFrom || invoiceDueDateFrom) {
                const fromDate = dayjs(invoiceSentDateFrom || invoiceDueDateFrom).format('YYYY-MM-DD');
                const toDate = (invoiceSentDateTo || invoiceDueDateTo) ?
                    dayjs(invoiceSentDateTo || invoiceDueDateTo).format('YYYY-MM-DD') :
                    dayjs().format('YYYY-MM-DD');
                dateRange = `_${fromDate}_to_${toDate}`;
            } else {
                dateRange = `_${dayjs().format('YYYY-MM-DD')}`;
            }

            link.setAttribute('download', `invoice_overview_report${dateRange}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            enqueueSnackbar(`✅ Exported ${csvData.length} invoice overview records`, { variant: 'success' });

        } catch (error) {
            console.error('❌ CSV Export Error:', error);
            enqueueSnackbar('Failed to export invoice overview data', { variant: 'error' });
        } finally {
            setExportLoading(false);
        }
    };

    // Detailed Invoice Export - Existing functionality (renamed for clarity)
    const generateDetailedInvoiceCSV = async () => {
        setExportLoading(true);
        setExportMenuAnchor(null);
        try {
            console.log('📊 Starting Detailed Invoice CSV export for', filteredInvoices.length, 'invoices from main table');

            // Simply use the already-filtered invoices from the main table
            const exportInvoices = filteredInvoices;
            console.log('🔍 Exporting', exportInvoices.length, 'invoices (same as displayed in table)');

            const csvData = [];

            // Process each invoice
            for (const invoice of exportInvoices) {
                console.log('📄 Processing invoice:', invoice.invoiceNumber);

                // Extract shipment IDs from invoice
                const shipmentIds = [];

                if (invoice.shipments && Array.isArray(invoice.shipments)) {
                    shipmentIds.push(...invoice.shipments);
                } else if (invoice.shipmentIds && Array.isArray(invoice.shipmentIds)) {
                    shipmentIds.push(...invoice.shipmentIds);
                } else if (invoice.shipmentId) {
                    shipmentIds.push(invoice.shipmentId);
                } else if (invoice.items && Array.isArray(invoice.items)) {
                    // Extract from invoice items
                    invoice.items.forEach(item => {
                        if (item.shipmentId) shipmentIds.push(item.shipmentId);
                        if (item.shipmentID) shipmentIds.push(item.shipmentID);
                    });
                }

                console.log('🚢 Found shipment IDs:', shipmentIds);

                if (shipmentIds.length === 0) {
                    console.warn('⚠️ No shipment IDs found for invoice:', invoice.invoiceNumber);
                    // Add a row with invoice data but no shipment details
                    const fallbackSubtotal = 0; // Subtotal = Actual Charge (0 in this case)
                    const fallbackTax = 0; // Tax amount (0 in this case)
                    const fallbackTotal = fallbackSubtotal + fallbackTax; // Invoice Total = Subtotal + Tax

                    csvData.push({
                        shipmentId: 'N/A',
                        carrier: 'Unknown',
                        customer: invoice.customerName || 'Unknown',
                        quotedCost: 0,
                        quotedCharge: 0,
                        actualCost: 0,
                        actualCharge: 0,
                        invoiceSubtotal: fallbackSubtotal.toFixed(2),
                        invoiceTax: fallbackTax.toFixed(2),
                        invoiceTotal: fallbackTotal.toFixed(2),
                        currency: 'CAD',
                        profit: 0,
                        invoiceNumber: invoice.invoiceNumber,
                        carrierEDI: 'N/A',
                        invoiceSent: invoice.issueDate ? dayjs(invoice.issueDate).format('MM/DD/YYYY') : 'N/A',
                        invoiceDue: invoice.dueDate ? dayjs(invoice.dueDate).format('MM/DD/YYYY') : 'N/A'
                    });
                    continue;
                }

                // Fetch each shipment's details
                for (const shipmentId of shipmentIds) {
                    const shipmentData = await fetchShipmentData(shipmentId);

                    if (shipmentData) {
                        const financialData = extractShipmentFinancialData(shipmentData);

                        // Extract carrier information
                        const getCarrierInfo = () => {
                            if (shipmentData.selectedCarrier) return shipmentData.selectedCarrier;
                            if (shipmentData.selectedRate?.carrier) return shipmentData.selectedRate.carrier;
                            if (shipmentData.carrier) return shipmentData.carrier;
                            return 'Unknown';
                        };

                        const carrier = getCarrierInfo();
                        const carrierName = typeof carrier === 'object' ? carrier.name || carrier.carrierName || 'Unknown' : carrier;

                        // Extract customer information
                        const customerName = shipmentData.shipTo?.companyName ||
                            shipmentData.shipTo?.company ||
                            shipmentData.customerName ||
                            invoice.customerName ||
                            'Unknown';

                        // Extract EDI information
                        const carrierEDI = shipmentData.carrierBookingConfirmation?.ediReference ||
                            shipmentData.ediData?.reference ||
                            shipmentData.proNumber ||
                            shipmentData.trackingNumber ||
                            'N/A';

                        // Calculate correct totals for detailed export
                        const subtotal = financialData.actualCharge || 0; // Subtotal = Actual Charge
                        const tax = financialData.actualTax || 0; // Tax amount
                        const invoiceTotal = subtotal + tax; // Invoice Total = Subtotal + Tax

                        csvData.push({
                            shipmentId: shipmentData.shipmentID || shipmentId,
                            carrier: carrierName,
                            customer: customerName,
                            quotedCost: financialData.quotedCost.toFixed(2),
                            quotedCharge: financialData.quotedCharge.toFixed(2),
                            actualCost: financialData.actualCost.toFixed(2),
                            actualCharge: financialData.actualCharge.toFixed(2),
                            invoiceSubtotal: subtotal.toFixed(2),
                            invoiceTax: tax.toFixed(2),
                            invoiceTotal: invoiceTotal.toFixed(2),
                            currency: financialData.currency,
                            profit: financialData.profit.toFixed(2),
                            invoiceNumber: invoice.invoiceNumber,
                            carrierEDI: carrierEDI,
                            invoiceSent: invoice.issueDate ? dayjs(invoice.issueDate).format('MM/DD/YYYY') : 'N/A',
                            invoiceDue: invoice.dueDate ? dayjs(invoice.dueDate).format('MM/DD/YYYY') : 'N/A'
                        });
                    } else {
                        // Add row with partial data if shipment not found
                        const fallbackSubtotal = 0; // Subtotal = Actual Charge (0 in this case)
                        const fallbackTax = 0; // Tax amount (0 in this case)
                        const fallbackTotal = fallbackSubtotal + fallbackTax; // Invoice Total = Subtotal + Tax

                        csvData.push({
                            shipmentId: shipmentId,
                            carrier: 'Unknown',
                            customer: invoice.customerName || 'Unknown',
                            quotedCost: 0,
                            quotedCharge: 0,
                            actualCost: 0,
                            actualCharge: 0,
                            invoiceSubtotal: fallbackSubtotal.toFixed(2),
                            invoiceTax: fallbackTax.toFixed(2),
                            invoiceTotal: fallbackTotal.toFixed(2),
                            currency: 'CAD',
                            profit: 0,
                            invoiceNumber: invoice.invoiceNumber,
                            carrierEDI: 'N/A',
                            invoiceSent: invoice.issueDate ? dayjs(invoice.issueDate).format('MM/DD/YYYY') : 'N/A',
                            invoiceDue: invoice.dueDate ? dayjs(invoice.dueDate).format('MM/DD/YYYY') : 'N/A'
                        });
                    }
                }
            }

            console.log('📊 Generated CSV data with', csvData.length, 'rows');

            // Generate CSV content
            const headers = [
                'SHIPMENT#',
                'CARRIER',
                'Customer',
                'Quoted Cost',
                'Quoted Charge',
                'Actual Cost',
                'Actual Charge',
                'Subtotal',
                'Tax',
                'Invoice Total',
                'Currency',
                'Profit',
                'Invoice #',
                'Carrier EDI',
                'Invoice Sent',
                'Invoice Due'
            ];

            const csvContent = [
                headers.join(','),
                ...csvData.map(row => [
                    row.shipmentId,
                    `"${row.carrier}"`,
                    `"${row.customer}"`,
                    row.quotedCost,
                    row.quotedCharge,
                    row.actualCost,
                    row.actualCharge,
                    row.invoiceSubtotal,
                    row.invoiceTax,
                    row.invoiceTotal,
                    row.currency,
                    row.profit,
                    row.invoiceNumber,
                    `"${row.carrierEDI}"`,
                    row.invoiceSent,
                    row.invoiceDue
                ].join(','))
            ].join('\n');

            // Download CSV
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);

            // Generate filename with proper date range handling
            let dateRange = '';
            if (invoiceSentDateFrom || invoiceDueDateFrom) {
                const fromDate = dayjs(invoiceSentDateFrom || invoiceDueDateFrom).format('YYYY-MM-DD');
                const toDate = (invoiceSentDateTo || invoiceDueDateTo) ?
                    dayjs(invoiceSentDateTo || invoiceDueDateTo).format('YYYY-MM-DD') :
                    dayjs().format('YYYY-MM-DD');
                dateRange = `_${fromDate}_to_${toDate}`;
            } else {
                dateRange = `_${dayjs().format('YYYY-MM-DD')}`;
            }

            link.setAttribute('download', `invoice_detailed_report${dateRange}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            enqueueSnackbar(`✅ CSV export completed! ${csvData.length} shipment records exported.`, { variant: 'success' });

        } catch (error) {
            console.error('❌ CSV export error:', error);
            enqueueSnackbar('Failed to export CSV report', { variant: 'error' });
        }
        setExportLoading(false);
    };

    // Sort handling
    const handleSort = (column) => {
        if (sortBy === column) {
            // Toggle direction if same column
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            // New column, default to ascending (except invoiceNumber which defaults to desc)
            setSortBy(column);
            setSortDirection(column === 'invoiceNumber' ? 'desc' : 'asc');
        }
    };

    // Sort function
    const sortInvoices = (invoices) => {
        if (!sortBy) return invoices;

        return [...invoices].sort((a, b) => {
            let aValue, bValue;

            switch (sortBy) {
                case 'invoiceNumber':
                    // Sort numerically by extracting numbers from invoice number
                    aValue = parseInt(a.invoiceNumber?.replace(/\D/g, '') || '0');
                    bValue = parseInt(b.invoiceNumber?.replace(/\D/g, '') || '0');
                    break;
                case 'companyName':
                    aValue = a.companyName?.toLowerCase() || '';
                    bValue = b.companyName?.toLowerCase() || '';
                    break;
                case 'customerName':
                    aValue = a.customerName?.toLowerCase() || '';
                    bValue = b.customerName?.toLowerCase() || '';
                    break;
                case 'issueDate':
                    aValue = a.issueDate ? new Date(a.issueDate).getTime() : 0;
                    bValue = b.issueDate ? new Date(b.issueDate).getTime() : 0;
                    break;
                case 'dueDate':
                    aValue = a.dueDate ? new Date(a.dueDate).getTime() : 0;
                    bValue = b.dueDate ? new Date(b.dueDate).getTime() : 0;
                    break;
                case 'total':
                    aValue = Number(a.total || 0);
                    bValue = Number(b.total || 0);
                    break;
                case 'status':
                    aValue = a.status?.toLowerCase() || '';
                    bValue = b.status?.toLowerCase() || '';
                    break;
                default:
                    aValue = a[sortBy] || '';
                    bValue = b[sortBy] || '';
            }

            if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
            if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const handleInvoiceClick = (invoice) => {
        handleEditInvoice(invoice);
    };

    // Sortable header component
    const SortableHeader = ({ column, children, sx = {} }) => {
        const isActive = sortBy === column;
        const direction = isActive ? sortDirection : 'asc';

        return (
            <TableCell
                sx={{
                    fontWeight: 600,
                    fontSize: '12px',
                    color: '#374151',
                    cursor: 'pointer',
                    userSelect: 'none',
                    '&:hover': {
                        backgroundColor: '#f3f4f6'
                    },
                    ...sx
                }}
                onClick={() => handleSort(column)}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {children}
                    {isActive ? (
                        direction === 'asc' ?
                            <ArrowUpwardIcon sx={{ fontSize: '14px', color: '#6b7280' }} /> :
                            <ArrowDownwardIcon sx={{ fontSize: '14px', color: '#6b7280' }} />
                    ) : (
                        <Box sx={{ width: '14px' }} /> // Placeholder to maintain spacing
                    )}
                </Box>
            </TableCell>
        );
    };

    // 🔄 ENHANCED: Support for additional invoice statuses
    const getStatusColor = (status) => {
        switch (status) {
            case 'paid':
                return { color: '#2e7d32', bgcolor: '#e8f5e9' };
            case 'generated':
                return { color: '#1565c0', bgcolor: '#e3f2fd' };
            case 'sent':
                return { color: '#7b1fa2', bgcolor: '#f3e5f5' };
            case 'viewed':
                return { color: '#00796b', bgcolor: '#e0f2f1' };
            case 'pending':
                return { color: '#ed6c02', bgcolor: '#fff3e0' };
            case 'overdue':
                return { color: '#d32f2f', bgcolor: '#ffebee' };
            case 'cancelled':
                return { color: '#757575', bgcolor: '#f5f5f5' };
            case 'refunded':
                return { color: '#f57c00', bgcolor: '#fff8e1' };
            case 'disputed':
                return { color: '#c62828', bgcolor: '#ffebee' };
            case 'draft':
                return { color: '#616161', bgcolor: '#fafafa' };
            case 'processing':
                return { color: '#1976d2', bgcolor: '#e3f2fd' };
            case 'error':
                return { color: '#d32f2f', bgcolor: '#ffebee' };
            default:
                return { color: '#1976d2', bgcolor: '#e3f2fd' };
        }
    };

    const isOverdue = (invoice) => {
        if (!invoice.dueDate) return false;
        const dueDate = invoice.dueDate?.toDate ? invoice.dueDate.toDate() : new Date(invoice.dueDate);
        return dueDate < new Date() && invoice.status !== 'paid';
    };

    const formatDate = (dateValue) => {
        if (!dateValue) return 'N/A';

        let date;
        if (dateValue?.toDate) {
            // Firestore Timestamp
            date = dateValue.toDate();
        } else if (dateValue instanceof Date) {
            // JavaScript Date
            date = dateValue;
        } else if (typeof dateValue === 'string' || typeof dateValue === 'number') {
            // String or number timestamp
            date = new Date(dateValue);
        } else {
            return 'N/A';
        }

        // Check if date is valid
        if (isNaN(date.getTime())) {
            return 'N/A';
        }

        // Use UTC date to avoid timezone offset issues
        // Since dates are stored as dates without time, treat them as UTC to avoid day shifts
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        return `${month}/${day}/${year}`;
    };

    const handleCreateManualInvoice = () => {
        setEditingInvoiceId(null);
        setCreateInvoiceOpen(true);
    };

    const handleEditInvoice = (invoice) => {
        setEditingInvoiceId(invoice.id);
        setCreateInvoiceOpen(true);
    };

    const handleCloseInvoiceForm = () => {
        setCreateInvoiceOpen(false);
        setEditingInvoiceId(null);
    };

    const handleInvoiceSuccess = () => {
        enqueueSnackbar('Invoice saved successfully', { variant: 'success' });
        setCreateInvoiceOpen(false);
        setEditingInvoiceId(null);
        fetchInvoices(); // Refresh the invoice list
    };

    const handleInvoiceFilesSelected = (e) => {
        const files = Array.from(e.target.files || []);
        setSelectedUploadFiles(files);
    };

    const handleProcessUploadedInvoices = async () => {
        try {
            if (!selectedUploadFiles || selectedUploadFiles.length === 0) return;
            enqueueSnackbar('Uploading and processing invoices...', { variant: 'info' });

            // Upload each file to Storage using existing bucket logic (use same CORS-safe approach as InvoiceForm)
            const { app, storage, functions } = await import('../../../firebase');
            const { getStorage, ref, uploadBytesResumable, getDownloadURL } = await import('firebase/storage');
            const customStorage = getStorage(app, 'gs://solushipx.firebasestorage.app');

            const uploads = await Promise.all(selectedUploadFiles.map(file => new Promise(async (resolve, reject) => {
                try {
                    const safeName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
                    const storageRef = ref(customStorage, `backfill-invoices/${safeName}`);
                    const task = uploadBytesResumable(storageRef, file, { contentType: file.type || 'application/octet-stream' });
                    task.on('state_changed', () => { }, (err) => reject(err), async () => {
                        const url = await getDownloadURL(task.snapshot.ref);
                        resolve({ fileName: safeName, url, sourcePath: `backfill-invoices/${safeName}` });
                    });
                } catch (e) { reject(e); }
            })));

            // Insert placeholder invoices with deterministic IDs (uploadId = fileName)
            const inferInvoiceNumber = (name) => {
                const m = String(name || '').match(/(?:Invoice[_-]?|Combined_Invoice[_-]?)(\d{5,})/i) || String(name || '').match(/_(\d{5,})\.pdf$/i);
                return m ? m[1] : '';
            };
            for (const u of uploads) {
                try {
                    // If a processing placeholder already exists for this exact file URL, skip creating another
                    const existingSnap = await getDocs(query(collection(db, 'invoices'), where('fileUrl', '==', u.url)));
                    if (!existingSnap.empty) continue;

                    const placeholderId = u.fileName; // deterministic per upload
                    const placeholderRef = doc(collection(db, 'invoices'), placeholderId);
                    await updateDoc(placeholderRef, { __existsCheck: true }).catch(async () => {
                        const { setDoc, serverTimestamp } = await import('firebase/firestore');
                        await setDoc(placeholderRef, {
                            uploadId: placeholderId,
                            sourcePath: u.sourcePath,
                            fileUrl: u.url,
                            invoiceNumber: inferInvoiceNumber(u.fileName),
                            issueDate: serverTimestamp(),
                            dueDate: null,
                            status: 'processing',            // 🎯 KEY: Processing status
                            paymentStatus: 'processing',     // 🎯 KEY: Processing payment status
                            currency: 'CAD',
                            total: 0,                        // 🎯 KEY: Zero total indicates processing
                            companyId: null,
                            companyName: '',                 // 🎯 KEY: Empty company name indicates processing
                            customerId: null,
                            customerName: '',                // 🎯 KEY: Empty customer name indicates processing
                            shipmentIds: [],
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp(),
                            backfillSource: 'upload_dialog'
                        });
                    });
                } catch (e) { /* ignore placeholder creation failure */ }
            }

            // Call backend parser for each uploaded file in AP mode (reuses processPdfFile pipeline)
            const { httpsCallable } = await import('firebase/functions');
            const callPdf = httpsCallable(functions, 'processPdfFile', { timeout: 540000 });
            const callBatch = httpsCallable(functions, 'processPdfBatch', { timeout: 540000 }).catch?.(() => { });
            // Fire off calls, don't block UI on waiting
            uploads.forEach(u => {
                const isZip = /\.zip$/i.test(u.fileName);
                const payload = { fileName: u.fileName, uploadUrl: u.url, settings: { apMode: true, extractForBackfill: true, includeRawText: true, useProductionOCR: true, tableDetection: true, isBackfillUpload: true }, placeholderInvoiceId: u.fileName };
                (isZip ? callBatch : callPdf)(payload).catch(() => { });
            });

            enqueueSnackbar('Parsing started. You can close this dialog; results will appear shortly.', { variant: 'success' });
            setUploadDialogOpen(false);
            setSelectedUploadFiles([]);
        } catch (e) {
            console.error('Backfill upload failed', e);
            enqueueSnackbar('Failed to process invoices. Please try again.', { variant: 'error' });
        }
    };

    useEffect(() => {
        let filtered = invoices;

        // Search filter - Enhanced to search across all relevant fields
        if (searchQuery) {
            const query = searchQuery.toLowerCase().trim();
            filtered = filtered.filter(invoice =>
                // Invoice identifiers
                invoice.invoiceNumber?.toLowerCase().includes(query) ||
                invoice.id?.toLowerCase().includes(query) ||

                // Company information
                invoice.companyName?.toLowerCase().includes(query) ||
                invoice.companyCode?.toLowerCase().includes(query) ||
                (invoice.companyId || invoice.companyID)?.toLowerCase().includes(query) ||

                // Customer information
                invoice.customerName?.toLowerCase().includes(query) ||
                invoice.customerId?.toLowerCase().includes(query) ||

                // Financial fields
                invoice.total?.toString().includes(query) ||
                invoice.status?.toLowerCase().includes(query) ||

                // Additional search fields
                invoice.paymentTerms?.toLowerCase().includes(query)
            );
        }

        // Company filter - Enhanced to handle multiple company identifier formats
        if (selectedCompanyFilter && selectedCompanyFilter.id) {
            filtered = filtered.filter(invoice => {
                const companyId = invoice.companyId || invoice.companyID;
                const companyCode = invoice.companyCode;
                const companyName = invoice.companyName;

                // Match by ID, code, or name
                return companyId === selectedCompanyFilter.id ||
                    companyCode === selectedCompanyFilter.id ||
                    companyName === selectedCompanyFilter.id ||
                    companyName === selectedCompanyFilter.name;
            });
        }

        // Customer filter - Enhanced to handle customer identification properly
        if (selectedCustomerFilter && selectedCustomerFilter.id) {
            filtered = filtered.filter(invoice => {
                const customerId = invoice.customerId || invoice.customer?.id;
                const customerName = invoice.customerName || invoice.customer?.name;

                // Match by customer ID or name
                return customerId === selectedCustomerFilter.id ||
                    customerName === selectedCustomerFilter.name ||
                    customerName === selectedCustomerFilter.id;
            });
        }

        // Payment Status filter - Enhanced with proper status matching
        if (selectedPaymentStatusFilter && selectedPaymentStatusFilter.id && selectedPaymentStatusFilter.id !== 'all') {
            filtered = filtered.filter(invoice => {
                const isOverdueStatus = isOverdue(invoice);
                const isProcessing = invoice.status === 'processing' ||
                    invoice.paymentStatus === 'processing' ||
                    (invoice.total === 0 && !invoice.companyName && !invoice.customerName);

                // Determine the actual status
                let actualStatus = invoice.status || invoice.paymentStatus || 'outstanding';
                if (isOverdueStatus) {
                    actualStatus = 'overdue';
                } else if (isProcessing) {
                    actualStatus = 'processing';
                }

                // Handle special status cases
                if (selectedPaymentStatusFilter.id === 'overdue') {
                    return isOverdueStatus;
                } else if (selectedPaymentStatusFilter.id === 'outstanding') {
                    return actualStatus === 'outstanding' && !isOverdueStatus;
                } else if (selectedPaymentStatusFilter.id === 'paid') {
                    return actualStatus === 'paid';
                } else if (selectedPaymentStatusFilter.id === 'processing') {
                    return isProcessing;
                } else {
                    // Match by exact status code or label
                    return actualStatus === selectedPaymentStatusFilter.id ||
                        invoice.status === selectedPaymentStatusFilter.id ||
                        invoice.paymentStatus === selectedPaymentStatusFilter.id;
                }
            });
        }

        // Status filter (legacy)
        if (statusFilter && statusFilter !== 'all') {
            if (statusFilter === 'overdue') {
                filtered = filtered.filter(invoice => isOverdue(invoice));
            } else {
                filtered = filtered.filter(invoice => invoice.status === statusFilter);
            }
        }

        // Apply date filters
        console.log('🔍 Date filter values:', {
            invoiceSentDateFrom,
            invoiceSentDateTo,
            invoiceDueDateFrom,
            invoiceDueDateTo
        });

        if (invoiceSentDateFrom || invoiceSentDateTo) {
            filtered = filtered.filter(invoice => {
                // Try multiple possible date fields
                let sentDate = null;

                // Helper function to safely convert dates
                const parseDate = (dateValue) => {
                    if (!dateValue) return null;
                    try {
                        // Handle Firestore Timestamp
                        if (dateValue && typeof dateValue.toDate === 'function') {
                            return dayjs(dateValue.toDate());
                        }
                        // Handle regular Date objects
                        if (dateValue instanceof Date) {
                            return dayjs(dateValue);
                        }
                        // Handle timestamp objects with seconds
                        if (dateValue && typeof dateValue === 'object' && dateValue.seconds) {
                            return dayjs(new Date(dateValue.seconds * 1000));
                        }
                        // Handle string dates
                        if (typeof dateValue === 'string') {
                            return dayjs(dateValue);
                        }
                        return null;
                    } catch (error) {
                        console.warn('Error parsing date:', dateValue, error);
                        return null;
                    }
                };

                // Try different date field names
                sentDate = parseDate(invoice.dateSent) ||
                    parseDate(invoice.sentDate) ||
                    parseDate(invoice.issueDate) ||
                    parseDate(invoice.dateCreated) ||
                    parseDate(invoice.createdAt);

                if (!sentDate) return false;

                // Apply date range filters with inclusive logic
                if (invoiceSentDateFrom) {
                    const fromDate = dayjs(invoiceSentDateFrom).startOf('day');
                    if (sentDate.isBefore(fromDate)) return false;
                }

                if (invoiceSentDateTo) {
                    const toDate = dayjs(invoiceSentDateTo).endOf('day');
                    if (sentDate.isAfter(toDate)) return false;
                }

                return true;
            });
        }

        if (invoiceDueDateFrom || invoiceDueDateTo) {
            filtered = filtered.filter(invoice => {
                // Helper function to safely convert dates
                const parseDate = (dateValue) => {
                    if (!dateValue) return null;
                    try {
                        // Handle Firestore Timestamp
                        if (dateValue && typeof dateValue.toDate === 'function') {
                            return dayjs(dateValue.toDate());
                        }
                        // Handle regular Date objects
                        if (dateValue instanceof Date) {
                            return dayjs(dateValue);
                        }
                        // Handle timestamp objects with seconds
                        if (dateValue && typeof dateValue === 'object' && dateValue.seconds) {
                            return dayjs(new Date(dateValue.seconds * 1000));
                        }
                        // Handle string dates
                        if (typeof dateValue === 'string') {
                            return dayjs(dateValue);
                        }
                        return null;
                    } catch (error) {
                        console.warn('Error parsing due date:', dateValue, error);
                        return null;
                    }
                };

                const dueDate = parseDate(invoice.dueDate) || parseDate(invoice.paymentDue) || parseDate(invoice.dueDt);
                if (!dueDate) return false;

                // Apply date range filters with inclusive logic
                if (invoiceDueDateFrom) {
                    const fromDate = dayjs(invoiceDueDateFrom).startOf('day');
                    if (dueDate.isBefore(fromDate)) return false;
                }

                if (invoiceDueDateTo) {
                    const toDate = dayjs(invoiceDueDateTo).endOf('day');
                    if (dueDate.isAfter(toDate)) return false;
                }

                return true;
            });
        }

        // Apply sorting to filtered results
        const sortedFiltered = sortInvoices(filtered);
        setFilteredInvoices(sortedFiltered);

        // Recalculate metrics based on filtered invoices
        calculateMetrics(filtered);

        setPage(0); // Reset to first page when filters change
    }, [invoices, searchQuery, statusFilter, selectedCompanyFilter, selectedCustomerFilter, selectedPaymentStatusFilter, invoiceSentDateFrom, invoiceSentDateTo, invoiceDueDateFrom, invoiceDueDateTo, sortBy, sortDirection]);

    if (loading) {
        return (
            <Box sx={{ width: '100%' }}>
                <Grid container spacing={3} sx={{ mb: 4, px: 2 }}>
                    {Array.from({ length: 4 }).map((_, idx) => (
                        <Grid item xs={12} md={3} key={idx}>
                            <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                                <CardContent sx={{ p: 3 }}>
                                    <Skeleton variant="text" width={120} height={16} />
                                    <Skeleton variant="rectangular" width="60%" height={28} style={{ margin: '8px 0' }} />
                                    <Skeleton variant="text" width={100} height={14} />
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>

                <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', mx: 2 }}>
                    <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Skeleton variant="text" width={140} height={24} />
                            <Stack direction="row" spacing={2}>
                                <Skeleton variant="rectangular" width={90} height={28} />
                                <Skeleton variant="rectangular" width={120} height={28} />
                            </Stack>
                        </Box>
                        <Grid container spacing={2} alignItems="center">
                            {[0, 1, 2].map((k) => (
                                <Grid item xs={12} md={4} key={k}>
                                    <Skeleton variant="rectangular" height={40} />
                                </Grid>
                            ))}
                        </Grid>
                    </Box>

                    <TableContainer>
                        <Table>
                            <TableHead>
                                <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                    {['Invoice #', 'File', 'Company', 'Customer', 'Date Sent', 'Due Date', 'Total', 'Payment Status', 'Actions'].map((h, idx) => (
                                        <TableCell key={idx} sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                            <Skeleton variant="text" height={14} />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {Array.from({ length: 8 }).map((_, rIdx) => (
                                    <TableRow key={rIdx}>
                                        {Array.from({ length: 9 }).map((_, cIdx) => (
                                            <TableCell key={cIdx}>
                                                <Skeleton variant="text" height={14} />
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                    <Box sx={{ p: 2, display: 'flex', justifyContent: 'flex-end' }}>
                        <Skeleton variant="rectangular" width={200} height={28} />
                    </Box>
                </Paper>
            </Box>
        );
    }

    if (error) {
        return (
            <Alert severity="error" sx={{ mt: 2 }}>
                {error}
            </Alert>
        );
    }

    return (
        <Box sx={{ width: '100%' }}>
            {/* Info Alert removed per requirements */}

            {/* Metrics Cards */}
            <Grid container spacing={3} sx={{ mb: 4, px: 2 }}>
                <Grid item xs={12} md={3}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#6b7280', mb: 2 }}>
                                    Total Invoices
                                </Typography>
                                {metricsLoading ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <CircularProgress size={20} />
                                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#9ca3af' }}>
                                            Loading...
                                        </Typography>
                                    </Box>
                                ) : (
                                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                                        {metrics.totalInvoices}
                                        {metrics.totalShipments > 0 && (
                                            <Typography component="span" variant="body2" sx={{ color: '#6b7280', fontWeight: 400, ml: 1 }}>
                                                ({metrics.totalShipments} shipments)
                                            </Typography>
                                        )}
                                    </Typography>
                                )}
                                <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                    {metricsLoading ? 'Calculating...' : 'All time'}
                                </Typography>
                            </CardContent>
                        </Card>
                    </motion.div>
                </Grid>

                <Grid item xs={12} md={3}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.1 }}
                    >
                        <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#6b7280', mb: 2 }}>
                                    Outstanding
                                </Typography>
                                {metricsLoading ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <CircularProgress size={20} />
                                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#9ca3af' }}>
                                            Loading...
                                        </Typography>
                                    </Box>
                                ) : (
                                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                                        ${metrics.totalOutstanding.toLocaleString()}
                                    </Typography>
                                )}
                                <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                    {metricsLoading ? 'Calculating...' : 'Unpaid invoices'}
                                </Typography>
                            </CardContent>
                        </Card>
                    </motion.div>
                </Grid>

                <Grid item xs={12} md={3}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.2 }}
                    >
                        <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#6b7280', mb: 2 }}>
                                    Total Paid
                                </Typography>
                                {metricsLoading ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <CircularProgress size={20} />
                                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#9ca3af' }}>
                                            Loading...
                                        </Typography>
                                    </Box>
                                ) : (
                                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                                        ${metrics.totalPaid.toLocaleString()}
                                    </Typography>
                                )}
                                <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                    {metricsLoading ? 'Calculating...' : 'Collected revenue'}
                                </Typography>
                            </CardContent>
                        </Card>
                    </motion.div>
                </Grid>

                <Grid item xs={12} md={3}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: 0.3 }}
                    >
                        <Card
                            elevation={0}
                            sx={{
                                border: '1px solid #e5e7eb',
                                borderRadius: '12px',
                                background: !metricsLoading && metrics.overdue > 0 ? '#fef2f2' : 'white'
                            }}
                        >
                            <CardContent sx={{ p: 3 }}>
                                <Typography variant="body2" sx={{ fontWeight: 600, color: '#6b7280', mb: 2 }}>
                                    Overdue
                                </Typography>
                                {metricsLoading ? (
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                        <CircularProgress size={20} />
                                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#9ca3af' }}>
                                            Loading...
                                        </Typography>
                                    </Box>
                                ) : (
                                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                                        ${metrics.overdue.toLocaleString()}
                                    </Typography>
                                )}
                                <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                    {metricsLoading ? 'Calculating...' : 'Past due date'}
                                </Typography>
                            </CardContent>
                        </Card>
                    </motion.div>
                </Grid>
            </Grid>

            {/* Invoices Table */}
            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px', mx: 2 }}>
                <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '18px', color: '#111827' }}>
                            Invoices
                        </Typography>
                        <Stack direction="row" spacing={2}>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={exportLoading ? <CircularProgress size={14} /> : <GetAppIcon />}
                                endIcon={<ExpandMoreIcon />}
                                onClick={(e) => setExportMenuAnchor(e.currentTarget)}
                                disabled={exportLoading}
                                sx={{ fontSize: '12px' }}
                            >
                                {exportLoading ? 'Exporting...' : 'Export'}
                            </Button>

                            {/* Export Menu */}
                            <Menu
                                anchorEl={exportMenuAnchor}
                                open={Boolean(exportMenuAnchor)}
                                onClose={() => setExportMenuAnchor(null)}
                                anchorOrigin={{
                                    vertical: 'bottom',
                                    horizontal: 'left',
                                }}
                                transformOrigin={{
                                    vertical: 'top',
                                    horizontal: 'left',
                                }}
                            >
                                <MenuItem onClick={generateInvoiceOverviewCSV} sx={{ fontSize: '12px', minWidth: 200 }}>
                                    <GetAppIcon sx={{ mr: 1, fontSize: '16px' }} />
                                    Invoice Overview
                                    <Typography sx={{ fontSize: '11px', color: '#6b7280', ml: 1 }}>
                                        (High-level totals)
                                    </Typography>
                                </MenuItem>
                                <MenuItem onClick={generateDetailedInvoiceCSV} sx={{ fontSize: '12px', minWidth: 200 }}>
                                    <GetAppIcon sx={{ mr: 1, fontSize: '16px' }} />
                                    Detailed Invoice View
                                    <Typography sx={{ fontSize: '11px', color: '#6b7280', ml: 1 }}>
                                        (Individual shipments)
                                    </Typography>
                                </MenuItem>
                            </Menu>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<GetAppIcon />}
                                sx={{ fontSize: '12px' }}
                                onClick={() => setUploadDialogOpen(true)}
                            >
                                Upload Invoices
                            </Button>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<AddIcon />}
                                sx={{ fontSize: '12px' }}
                                onClick={handleCreateManualInvoice}
                            >
                                Add Invoice
                            </Button>
                        </Stack>
                    </Box>

                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={2}>
                            <Button
                                variant="outlined"
                                size="small"
                                fullWidth
                                startIcon={<DateRangeIcon />}
                                endIcon={<ExpandMoreIcon sx={{ transform: showAdvancedFilters ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />}
                                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                                sx={{
                                    fontSize: '12px',
                                    color: '#6b7280',
                                    borderColor: '#e5e7eb',
                                    '&:hover': {
                                        borderColor: '#d1d5db',
                                        backgroundColor: '#f9fafb'
                                    }
                                }}
                            >
                                Date Filters
                            </Button>
                        </Grid>
                        <Grid item xs={12} md={2.5}>
                            <TextField
                                fullWidth
                                size="small"
                                placeholder="Search invoices..."
                                value={searchQuery}
                                onChange={handleSearchChange}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon sx={{ fontSize: '20px', color: '#6b7280' }} />
                                        </InputAdornment>
                                    ),
                                    endAdornment: searchQuery && (
                                        <InputAdornment position="end">
                                            <IconButton size="small" onClick={handleClearSearch}>
                                                <ClearIcon sx={{ fontSize: '18px' }} />
                                            </IconButton>
                                        </InputAdornment>
                                    )
                                }}
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '14px' }
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={2.5}>
                            <Autocomplete
                                options={Object.values(companiesMap).map(company => ({
                                    id: company.companyID || company.id,
                                    name: company.name || company.companyName,
                                    code: company.companyID || company.code,
                                    logo: getCircleLogo(company)
                                })).sort((a, b) => (a.name || '').localeCompare(b.name || ''))}
                                getOptionLabel={(opt) => opt?.name || ''}
                                value={selectedCompanyFilter}
                                onChange={(e, val) => setSelectedCompanyFilter(val)}
                                renderOption={(props, option) => (
                                    <li {...props}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Avatar sx={{ width: 20, height: 20, fontSize: '11px', border: '1px solid #e5e7eb' }} src={option.logo || ''} />
                                            <Box>
                                                <Typography sx={{ fontSize: '12px' }}>{option?.name}</Typography>
                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>{option?.code}</Typography>
                                            </Box>
                                        </Box>
                                    </li>
                                )}
                                renderInput={(params) => (
                                    <TextField {...params} size="small" placeholder="Filter by company" sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }} />
                                )}
                            />
                        </Grid>
                        <Grid item xs={12} md={2.5}>
                            <Autocomplete
                                options={(selectedCompanyFilter?.id && customersByCompany[selectedCompanyFilter.id])
                                    ? customersByCompany[selectedCompanyFilter.id].map(c => ({
                                        id: c.id,
                                        name: c.name || c.companyName,
                                        logo: c.logo || c.logoUrl || c.logoURL || c.customerLogo || ''
                                    }))
                                    : Array.from(new Map(invoices.map(i => {
                                        const customerId = i.customerId || i.customer?.id;
                                        const customerName = i.customerName || i.customer?.name;
                                        const customerDoc = customersMap[customerId];
                                        const logo = customerDoc?.logo ||
                                            customerDoc?.logoUrl ||
                                            customerDoc?.logoURL ||
                                            i.customerLogo ||
                                            '';
                                        return [customerId, {
                                            id: customerId,
                                            name: customerName,
                                            logo
                                        }];
                                    })).values()).filter(c => c?.name)}
                                getOptionLabel={(opt) => opt?.name || ''}
                                value={selectedCustomerFilter}
                                onChange={(e, val) => setSelectedCustomerFilter(val)}
                                renderOption={(props, option) => (
                                    <li {...props}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Avatar sx={{ width: 20, height: 20, fontSize: '11px', border: '1px solid #e5e7eb' }} src={option.logo || ''} />
                                            <Typography sx={{ fontSize: '12px' }}>{option?.name}</Typography>
                                        </Box>
                                    </li>
                                )}
                                renderInput={(params) => (
                                    <TextField {...params} size="small" placeholder="Filter by customer" sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }} />
                                )}
                            />
                        </Grid>
                        <Grid item xs={12} md={2.5}>
                            <Autocomplete
                                options={[
                                    { id: 'all', label: 'All Statuses' },
                                    ...invoiceStatuses.map(status => ({
                                        id: status.statusCode,
                                        label: status.statusLabel,
                                        color: status.color,
                                        fontColor: status.fontColor
                                    }))
                                ]}
                                getOptionLabel={(option) => option.label}
                                value={selectedPaymentStatusFilter}
                                onChange={(e, val) => setSelectedPaymentStatusFilter(val)}
                                renderInput={(params) => (
                                    <TextField {...params} size="small" placeholder="Payment status" sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }} />
                                )}
                                renderOption={(props, option) => (
                                    <li {...props}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {option.color && (
                                                <Box
                                                    sx={{
                                                        width: 12,
                                                        height: 12,
                                                        borderRadius: '50%',
                                                        bgcolor: option.color
                                                    }}
                                                />
                                            )}
                                            <Typography sx={{ fontSize: '12px' }}>{option.label}</Typography>
                                        </Box>
                                    </li>
                                )}
                            />
                        </Grid>
                    </Grid>

                    <Collapse in={showAdvancedFilters}>
                        <Box sx={{ mt: 2, p: 3, backgroundColor: '#f9fafb', borderRadius: 2, border: '1px solid #e5e7eb' }}>
                            <Typography variant="subtitle2" sx={{ fontSize: '14px', fontWeight: 600, mb: 2, color: '#374151' }}>
                                Advanced Date Filters
                            </Typography>
                            <LocalizationProvider dateAdapter={AdapterDayjs}>
                                <Grid container spacing={2} alignItems="center">
                                    <Grid item xs={12} md={3}>
                                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500, mb: 1, color: '#374151' }}>
                                            Invoice Sent Date
                                        </Typography>
                                        <DatePicker
                                            label="From Date"
                                            value={invoiceSentDateFrom}
                                            onChange={handleSentDateFromChange}
                                            slotProps={{
                                                textField: {
                                                    size: 'small',
                                                    fullWidth: true,
                                                    sx: { '& .MuiInputBase-input': { fontSize: '12px' } }
                                                }
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500, mb: 1, color: 'transparent' }}>
                                            .
                                        </Typography>
                                        <DatePicker
                                            label="To Date"
                                            value={invoiceSentDateTo}
                                            onChange={handleSentDateToChange}
                                            slotProps={{
                                                textField: {
                                                    size: 'small',
                                                    fullWidth: true,
                                                    sx: { '& .MuiInputBase-input': { fontSize: '12px' } }
                                                }
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500, mb: 1, color: '#374151' }}>
                                            Invoice Due Date
                                        </Typography>
                                        <DatePicker
                                            label="From Date"
                                            value={invoiceDueDateFrom}
                                            onChange={handleDueDateFromChange}
                                            slotProps={{
                                                textField: {
                                                    size: 'small',
                                                    fullWidth: true,
                                                    sx: { '& .MuiInputBase-input': { fontSize: '12px' } }
                                                }
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500, mb: 1, color: 'transparent' }}>
                                            .
                                        </Typography>
                                        <DatePicker
                                            label="To Date"
                                            value={invoiceDueDateTo}
                                            onChange={handleDueDateToChange}
                                            slotProps={{
                                                textField: {
                                                    size: 'small',
                                                    fullWidth: true,
                                                    sx: { '& .MuiInputBase-input': { fontSize: '12px' } }
                                                }
                                            }}
                                        />
                                    </Grid>
                                </Grid>
                                <Box sx={{ mt: 2, display: 'flex', gap: 1, justifyContent: 'flex-end' }}>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={() => {
                                            setInvoiceSentDateFrom(null);
                                            setInvoiceSentDateTo(null);
                                            setInvoiceDueDateFrom(null);
                                            setInvoiceDueDateTo(null);
                                        }}
                                        sx={{ fontSize: '11px' }}
                                    >
                                        Clear Dates
                                    </Button>
                                </Box>
                            </LocalizationProvider>
                        </Box>
                    </Collapse>
                </Box>

                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                <SortableHeader column="invoiceNumber">Invoice #</SortableHeader>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>File</TableCell>
                                <SortableHeader column="companyName">Company</SortableHeader>
                                <SortableHeader column="customerName">Customer</SortableHeader>
                                <SortableHeader column="issueDate">Date Sent</SortableHeader>
                                <SortableHeader column="dueDate">Due Date</SortableHeader>
                                <SortableHeader column="total">Total</SortableHeader>
                                <SortableHeader column="status">Payment Status</SortableHeader>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredInvoices.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} align="center" sx={{ py: 4, color: '#6b7280' }}>
                                        <Typography variant="body1">No invoices found</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredInvoices
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .map((invoice) => {
                                        const overdue = isOverdue(invoice);
                                        // Determine if invoice is still processing
                                        const isProcessing = invoice.status === 'processing' ||
                                            invoice.paymentStatus === 'processing' ||
                                            (invoice.total === 0 && !invoice.companyName && !invoice.customerName);
                                        const displayStatus = overdue ? 'overdue' : (isProcessing ? 'processing' : invoice.status);

                                        return (
                                            <TableRow
                                                key={invoice.id}
                                                hover
                                                sx={{
                                                    backgroundColor: overdue ? '#fef2f2' : 'inherit'
                                                }}
                                            >
                                                <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                    <Button size="small" sx={{ fontSize: '12px', textTransform: 'none', p: 0 }} onClick={(e) => { e.stopPropagation(); handleEditInvoice(invoice); }}>
                                                        {invoice.invoiceNumber}
                                                    </Button>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {isProcessing ? (
                                                        <Typography sx={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                                                            Processing...
                                                        </Typography>
                                                    ) : invoice.fileUrl ? (
                                                        <Button size="small" href={invoice.fileUrl} target="_blank" rel="noopener" startIcon={<DownloadIcon />} sx={{ fontSize: '11px' }}>
                                                            PDF
                                                        </Button>
                                                    ) : 'N/A'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {isProcessing ? (
                                                        <Typography sx={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                                                            Processing...
                                                        </Typography>
                                                    ) : (
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <Avatar
                                                                sx={{ width: 20, height: 20, fontSize: '11px', border: '1px solid #e5e7eb' }}
                                                                src={(() => {
                                                                    const companyKey = invoice.companyId || invoice.companyID || invoice.companyCode;
                                                                    if (companyKey && companiesMap[companyKey]) {
                                                                        return getCircleLogo(companiesMap[companyKey]);
                                                                    }
                                                                    const foundByName = Object.values(companiesMap).find(c => (c.name || c.companyName) === invoice.companyName);
                                                                    if (foundByName) return getCircleLogo(foundByName);
                                                                    return invoice.companyLogo || '';
                                                                })()}
                                                            />
                                                            <Typography sx={{ fontSize: '12px' }}>
                                                                {invoice.companyName || 'N/A'} {invoice.companyCode ? `(${invoice.companyCode})` : ''}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {isProcessing ? (
                                                        <Typography sx={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                                                            Processing...
                                                        </Typography>
                                                    ) : (
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <Avatar
                                                                sx={{ width: 20, height: 20, fontSize: '11px', border: '1px solid #e5e7eb' }}
                                                                src={(() => {
                                                                    const cid = invoice.customerId || invoice.customer?.id;
                                                                    // Prefer hydrated directory
                                                                    if (cid && customersMap[cid]) {
                                                                        return customersMap[cid].logo || customersMap[cid].logoUrl || '';
                                                                    }
                                                                    // Then prefer scoped list when company filter is selected
                                                                    if (selectedCompanyFilter?.id && customersByCompany[selectedCompanyFilter.id]) {
                                                                        const found = customersByCompany[selectedCompanyFilter.id].find(c => c.id === cid);
                                                                        if (found) return found.logo || found.logoUrl || '';
                                                                    }
                                                                    return invoice.customerLogo || '';
                                                                })()}
                                                            />
                                                            <Typography sx={{ fontSize: '12px' }}>
                                                                {invoice.customerName || 'N/A'}
                                                            </Typography>
                                                        </Box>
                                                    )}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {isProcessing ? (
                                                        <Typography sx={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                                                            Processing...
                                                        </Typography>
                                                    ) : formatDate(invoice.issueDate)}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {isProcessing ? (
                                                        <Typography sx={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                                                            Processing...
                                                        </Typography>
                                                    ) : formatDate(invoice.dueDate)}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>
                                                    {isProcessing ? (
                                                        <Typography sx={{ fontSize: '12px', color: '#6b7280', fontStyle: 'italic' }}>
                                                            Processing...
                                                        </Typography>
                                                    ) : (
                                                        `$${Number((invoice.total != null ? invoice.total : (invoice.subtotal || 0) + (invoice.tax || 0)) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${invoice.currency || 'CAD'}`
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={displayStatus}
                                                        size="small"
                                                        icon={displayStatus === 'processing' ? <CircularProgress size={12} /> : undefined}
                                                        sx={{
                                                            fontSize: '11px',
                                                            height: '22px',
                                                            bgcolor: getStatusColor(displayStatus).bgcolor,
                                                            color: getStatusColor(displayStatus).color,
                                                            textTransform: 'capitalize',
                                                            '& .MuiChip-icon': { color: getStatusColor(displayStatus).color }
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); setMenuAnchorEl(e.currentTarget); setMenuInvoice(invoice); }}>
                                                        <MoreVertIcon sx={{ fontSize: '16px' }} />
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                {/* Row actions menu */}
                <Menu
                    anchorEl={menuAnchorEl}
                    open={Boolean(menuAnchorEl)}
                    onClose={() => { setMenuAnchorEl(null); setMenuInvoice(null); }}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                >
                    <MenuItem onClick={() => { setMenuAnchorEl(null); if (menuInvoice) handleEditInvoice(menuInvoice); }} sx={{ fontSize: '12px' }}>View / Edit</MenuItem>

                    {/* ✅ NEW: Mark As Paid option - only show for unpaid invoices */}
                    {menuInvoice && (
                        menuInvoice.paymentStatus !== 'paid' &&
                        menuInvoice.status !== 'paid' &&
                        menuInvoice.status !== 'cancelled' &&
                        menuInvoice.status !== 'void'
                    ) && (
                            <MenuItem
                                onClick={() => { if (menuInvoice) handleOpenMarkAsPaid(menuInvoice); }}
                                sx={{
                                    fontSize: '12px'
                                }}
                            >
                                Mark As Paid
                            </MenuItem>
                        )}

                    {menuInvoice && (menuInvoice.status === 'cancelled' || menuInvoice.status === 'void' || menuInvoice.paymentStatus === 'cancelled') ? (
                        <MenuItem onClick={() => { if (menuInvoice) handleDeleteInvoice(menuInvoice); }} sx={{ fontSize: '12px', color: '#dc2626' }}>Delete</MenuItem>
                    ) : (
                        <MenuItem onClick={() => { setMenuAnchorEl(null); if (menuInvoice) handleCancelInvoice(menuInvoice); }} sx={{ fontSize: '12px', color: '#dc2626' }}>Void</MenuItem>
                    )}
                </Menu>

                <TablePagination
                    component="div"
                    count={filteredInvoices.length}
                    page={page}
                    onPageChange={handleChangePage}
                    rowsPerPage={rowsPerPage}
                    onRowsPerPageChange={handleChangeRowsPerPage}
                    rowsPerPageOptions={[10, 25, 50, 100]}
                    sx={{
                        borderTop: '1px solid #e5e7eb',
                        '& .MuiTablePagination-toolbar': {
                            fontSize: '12px'
                        }
                    }}
                />
            </Paper>

            {/* Upload Invoices Dialog */}
            {uploadDialogOpen && (
                <Dialog open={uploadDialogOpen} onClose={() => setUploadDialogOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>Upload Invoices</DialogTitle>
                    <DialogContent dividers>
                        <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 1 }}>Upload PDF files or a ZIP. We will parse shipments and prefill invoice forms.</Typography>
                        <Button variant="outlined" component="label" size="small" sx={{ fontSize: '12px' }}>
                            Select Files
                            <input hidden multiple type="file" accept="application/pdf,application/zip" onChange={handleInvoiceFilesSelected} />
                        </Button>
                        <Stack sx={{ mt: 2 }}>
                            {(selectedUploadFiles || []).map((f, idx) => (
                                <Typography key={idx} sx={{ fontSize: '12px' }}>{f.name}</Typography>
                            ))}
                        </Stack>
                    </DialogContent>
                    <DialogActions sx={{ p: 2 }}>
                        <Button size="small" sx={{ fontSize: '12px' }} onClick={() => setUploadDialogOpen(false)}>Close</Button>
                        <Button size="small" variant="contained" sx={{ fontSize: '12px' }} onClick={handleProcessUploadedInvoices} disabled={!selectedUploadFiles || selectedUploadFiles.length === 0}>Process</Button>
                    </DialogActions>
                </Dialog>
            )}

            {/* Manual Invoice Form Dialog */}
            {createInvoiceOpen && (
                <Box sx={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    zIndex: 1300,
                    bgcolor: 'white'
                }}>
                    <InvoiceForm
                        invoiceId={editingInvoiceId}
                        onClose={handleCloseInvoiceForm}
                        onSuccess={handleInvoiceSuccess}
                    />
                </Box>
            )}

            {/* ✅ NEW: Mark As Paid Dialog */}
            <MarkAsPaidDialog
                open={markAsPaidDialogOpen}
                onClose={() => {
                    setMarkAsPaidDialogOpen(false);
                    setMarkAsPaidInvoice(null);
                }}
                invoice={markAsPaidInvoice}
                onSuccess={handleMarkAsPaidSuccess}
            />

        </Box>
    );
};

export default InvoiceManagement; 