import React, { useState, useEffect, Suspense } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Chip,
    InputBase,
    Button,
    TablePagination,
    Menu,
    MenuItem,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    Toolbar,
    Tabs,
    Tab,
    Stack,
    CircularProgress,
    InputAdornment,
    Collapse,
    Grid,
    Checkbox
} from '@mui/material';
import {
    Search as SearchIcon,
    MoreVert as MoreVertIcon,
    Visibility as VisibilityIcon,
    GetApp,
    GetApp as ExportIcon,
    FilterList as FilterIcon,
    Sort as SortIcon,
    Clear as ClearIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    SearchOff as SearchOffIcon,
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon,
    Add as AddIcon,
    ArrowBackIosNew as ArrowBackIosNewIcon,
    Close as CloseIcon,
    ContentCopy as ContentCopyIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { useNavigate, Link } from 'react-router-dom';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import './Customers.css';
import { useCompany } from '../../contexts/CompanyContext';
import html2pdf from 'html2pdf.js';

// Import common components
import ModalHeader from '../common/ModalHeader';
import PdfViewerDialog from '../Shipments/components/PdfViewerDialog';
import ShipmentsPagination from '../Shipments/components/ShipmentsPagination';

// Import hooks
import useModalNavigation from '../../hooks/useModalNavigation';

// Lazy load the CustomerDetail component for the slide-over view
const CustomerDetail = React.lazy(() => import('./CustomerDetail'));
const AddCustomer = React.lazy(() => import('./AddCustomer'));

const Customers = ({ isModal = false, onClose = null, showCloseButton = false, onNavigateToShipments = null, deepLinkParams = null }) => {
    const navigate = useNavigate();
    const { companyIdForAddress } = useCompany();

    // Modal navigation system
    const modalNavigation = useModalNavigation({
        title: 'Customers',
        shortTitle: 'Customers',
        component: 'customers'
    });

    const [customers, setCustomers] = useState([]);
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(50);
    const [totalCount, setTotalCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [selectedTab, setSelectedTab] = useState('all');
    const [searchFields, setSearchFields] = useState({
        customerId: '',
        name: '',
        email: '',
        contactName: ''
    });

    const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
    const [selectedExportFormat, setSelectedExportFormat] = useState('csv');
    const [isExporting, setIsExporting] = useState(false);

    // PDF viewer state
    const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
    const [currentPdfUrl, setCurrentPdfUrl] = useState(null);
    const [currentPdfTitle, setCurrentPdfTitle] = useState('');

    // Selection state for export
    const [selectedCustomers, setSelectedCustomers] = useState(new Set());

    // Add sliding view state for customer detail
    const [currentView, setCurrentView] = useState('table'); // 'table', 'detail', or 'add'
    const [selectedCustomerId, setSelectedCustomerId] = useState(null);
    const [isSliding, setIsSliding] = useState(false);

    useEffect(() => {
        fetchCustomers();
    }, [page, rowsPerPage, selectedTab]);

    // Handle deep link navigation from email notifications
    useEffect(() => {
        if (deepLinkParams && deepLinkParams.customerId && customers.length > 0) {
            console.log('Processing deep link in Customers component:', deepLinkParams);

            // Find the customer in the loaded customers
            const customer = customers.find(c => c.id === deepLinkParams.customerId);
            if (customer) {
                console.log('Found customer for deep link:', customer.name);
                // Navigate to customer detail view
                handleViewCustomerDetail(deepLinkParams.customerId);
            } else {
                console.log('Customer not found in current list, customer may be on different page or filtered out');
            }
        }
    }, [deepLinkParams, customers]);

    useEffect(() => {
        if (companyIdForAddress) {
            console.log('Selected companyId for logged-in customer:', companyIdForAddress);
        }
    }, [companyIdForAddress]);

    const fetchCustomers = async () => {
        try {
            setLoading(true);
            console.log('Fetching customers with companyIdForAddress:', companyIdForAddress);

            const customersRef = collection(db, 'customers');
            let clauses = [];

            if (companyIdForAddress) {
                console.log('Adding companyID filter:', companyIdForAddress);
                clauses.push(where('companyID', '==', companyIdForAddress));
            } else {
                console.log('No companyIdForAddress available, fetching all customers');
            }

            if (selectedTab !== 'all') {
                console.log('Adding status filter:', selectedTab);
                clauses.push(where('status', '==', selectedTab));
            }

            console.log('Adding sort clause: name, asc');
            clauses.push(orderBy('name', 'asc'));
            clauses.push(limit(rowsPerPage));

            const q = clauses.length > 0 ? query(customersRef, ...clauses) : customersRef;
            console.log('Executing query with clauses:', clauses);

            const querySnapshot = await getDocs(q);
            console.log(`Found ${querySnapshot.size} customers`);

            const customersDataPromises = querySnapshot.docs.map(async (doc) => {
                const data = doc.data();
                let contactData = null;

                // Fetch main contact from addressBook
                if (data.customerID) {
                    const contactQuery = query(
                        collection(db, 'addressBook'),
                        where('addressClass', '==', 'customer'),
                        where('addressClassID', '==', data.customerID),
                        where('addressType', '==', 'contact'),
                        limit(1)
                    );
                    const contactSnapshot = await getDocs(contactQuery);
                    if (!contactSnapshot.empty) {
                        contactData = contactSnapshot.docs[0].data();
                        console.log('Found contact for customer', data.customerID, contactData);
                    } else {
                        console.log('No contact found for customer', data.customerID);
                    }
                }

                const customerObj = {
                    id: doc.id,
                    ...data,
                    contact: contactData // Add contact data to customer object
                };
                console.log('Customer data with contact:', customerObj);
                return customerObj;
            });

            const customersData = await Promise.all(customersDataPromises);

            console.log('All customers fetched from Firestore with contacts:', customersData);

            setCustomers(customersData);
            setTotalCount(customersData.length);
        } catch (error) {
            console.error('Error fetching customers:', error);
            console.error('Error details:', {
                message: error.message,
                code: error.code,
                stack: error.stack
            });
        } finally {
            setLoading(false);
        }
    };

    // Removed old filter menu handlers - now using collapsible panel

    const handleExport = () => {
        setIsExportDialogOpen(true);
    };

    const handleExportClose = () => {
        setIsExportDialogOpen(false);
        setIsExporting(false);
    };

    const handleExportConfirm = async () => {
        setIsExporting(true);

        try {
            switch (selectedExportFormat) {
                case 'csv':
                    await exportToCSV();
                    break;
                case 'excel':
                    await exportToExcel();
                    break;
                case 'pdf':
                    await exportToPDF();
                    break;
                default:
                    console.error('Unknown export format:', selectedExportFormat);
            }
        } catch (error) {
            console.error('Export failed:', error);
            alert('Export failed. Please try again.');
        } finally {
            setIsExporting(false);
            setIsExportDialogOpen(false);
        }
    };

    const exportToCSV = async () => {
        const customersToExport = selectedCustomers.size > 0
            ? filteredCustomers.filter(customer => selectedCustomers.has(customer.id))
            : filteredCustomers;

        const headers = [
            'Customer ID', 'Company Name', 'Contact Person', 'Contact First Name', 'Contact Last Name',
            'Contact Email', 'Contact Phone', 'Contact Street', 'Contact Street 2', 'Contact City',
            'Contact State', 'Contact Postal Code', 'Contact Country', 'Status', 'Created At',
            'Updated At', 'Company ID', 'Notes', 'Customer Type', 'Payment Terms', 'Credit Limit'
        ];
        const csvContent = [
            headers.join(','),
            ...customersToExport.map(customer => [
                `"${customer.customerID || ''}"`,
                `"${customer.name || ''}"`,
                `"${customer.contactName || (customer.contact ? `${customer.contact.firstName || ''} ${customer.contact.lastName || ''}`.trim() : '')}"`,
                `"${customer.contact?.firstName || ''}"`,
                `"${customer.contact?.lastName || ''}"`,
                `"${customer.contact?.email || ''}"`,
                `"${customer.contact?.phone || ''}"`,
                `"${customer.contact?.street || ''}"`,
                `"${customer.contact?.street2 || ''}"`,
                `"${customer.contact?.city || ''}"`,
                `"${customer.contact?.state || ''}"`,
                `"${customer.contact?.postalCode || ''}"`,
                `"${customer.contact?.country || ''}"`,
                `"${customer.status || ''}"`,
                `"${customer.createdAt?.toDate ? customer.createdAt.toDate().toLocaleDateString() : (customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : '')}"`,
                `"${customer.updatedAt?.toDate ? customer.updatedAt.toDate().toLocaleDateString() : (customer.updatedAt ? new Date(customer.updatedAt).toLocaleDateString() : '')}"`,
                `"${customer.companyID || ''}"`,
                `"${customer.notes || ''}"`,
                `"${customer.customerType || ''}"`,
                `"${customer.paymentTerms || ''}"`,
                `"${customer.creditLimit || ''}"`
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `customers_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const exportToExcel = async () => {
        // For now, export as CSV with .xlsx extension
        // In a real implementation, you'd use a library like xlsx
        const customersToExport = selectedCustomers.size > 0
            ? filteredCustomers.filter(customer => selectedCustomers.has(customer.id))
            : filteredCustomers;

        const headers = [
            'Customer ID', 'Company Name', 'Contact Person', 'Contact First Name', 'Contact Last Name',
            'Contact Email', 'Contact Phone', 'Contact Street', 'Contact Street 2', 'Contact City',
            'Contact State', 'Contact Postal Code', 'Contact Country', 'Status', 'Created At',
            'Updated At', 'Company ID', 'Notes', 'Customer Type', 'Payment Terms', 'Credit Limit'
        ];
        const csvContent = [
            headers.join('\t'), // Use tabs for better Excel compatibility
            ...customersToExport.map(customer => [
                customer.customerID || '',
                customer.name || '',
                customer.contactName || (customer.contact ? `${customer.contact.firstName || ''} ${customer.contact.lastName || ''}`.trim() : ''),
                customer.contact?.firstName || '',
                customer.contact?.lastName || '',
                customer.contact?.email || '',
                customer.contact?.phone || '',
                customer.contact?.street || '',
                customer.contact?.street2 || '',
                customer.contact?.city || '',
                customer.contact?.state || '',
                customer.contact?.postalCode || '',
                customer.contact?.country || '',
                customer.status || '',
                customer.createdAt?.toDate ? customer.createdAt.toDate().toLocaleDateString() : (customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : ''),
                customer.updatedAt?.toDate ? customer.updatedAt.toDate().toLocaleDateString() : (customer.updatedAt ? new Date(customer.updatedAt).toLocaleDateString() : ''),
                customer.companyID || '',
                customer.notes || '',
                customer.customerType || '',
                customer.paymentTerms || '',
                customer.creditLimit || ''
            ].join('\t'))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'application/vnd.ms-excel;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `customers_export_${new Date().toISOString().split('T')[0]}.xlsx`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const exportToPDF = async () => {
        const customersToExport = selectedCustomers.size > 0
            ? filteredCustomers.filter(customer => selectedCustomers.has(customer.id))
            : filteredCustomers;

        // Create a temporary container for PDF generation
        const tempContainer = document.createElement('div');
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '-9999px';
        tempContainer.style.width = '210mm'; // A4 width
        tempContainer.style.padding = '20mm';
        tempContainer.style.fontFamily = 'Arial, sans-serif';
        tempContainer.style.fontSize = '12px';
        tempContainer.style.backgroundColor = 'white';

        // Generate HTML content for PDF
        const currentDate = new Date().toLocaleDateString();
        const htmlContent = `
            <div style="margin-bottom: 30px;">
                <h1 style="color: #1976d2; margin-bottom: 10px; font-size: 24px;">Customer Export Report</h1>
                <p style="color: #666; margin: 0; font-size: 14px;">Generated on ${currentDate}</p>
                <p style="color: #666; margin: 0; font-size: 14px;">Total Customers: ${customersToExport.length}</p>
                ${selectedCustomers.size > 0 ? `<p style="color: #666; margin: 0; font-size: 14px;">Selected: ${selectedCustomers.size} of ${filteredCustomers.length} customers</p>` : ''}
            </div>
            
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 10px;">
                <thead>
                    <tr style="background-color: #f5f5f5;">
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Customer ID</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Company</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Contact</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Email</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Phone</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Address</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Status</th>
                        <th style="border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: bold;">Created</th>
                    </tr>
                </thead>
                <tbody>
                    ${customersToExport.map(customer => `
                        <tr>
                            <td style="border: 1px solid #ddd; padding: 6px;">${customer.customerID || 'N/A'}</td>
                            <td style="border: 1px solid #ddd; padding: 6px;">${customer.name || 'N/A'}</td>
                            <td style="border: 1px solid #ddd; padding: 6px;">${customer.contactName || (customer.contact ? `${customer.contact.firstName || ''} ${customer.contact.lastName || ''}`.trim() : 'N/A')}</td>
                            <td style="border: 1px solid #ddd; padding: 6px;">${customer.contact?.email || 'N/A'}</td>
                            <td style="border: 1px solid #ddd; padding: 6px;">${customer.contact?.phone || 'N/A'}</td>
                            <td style="border: 1px solid #ddd; padding: 6px;">${customer.contact ? [customer.contact.street, customer.contact.city, customer.contact.state, customer.contact.postalCode].filter(Boolean).join(', ') : 'N/A'}</td>
                            <td style="border: 1px solid #ddd; padding: 6px;">${customer.status || 'Unknown'}</td>
                            <td style="border: 1px solid #ddd; padding: 6px;">${customer.createdAt?.toDate ? customer.createdAt.toDate().toLocaleDateString() : (customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : 'N/A')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        tempContainer.innerHTML = htmlContent;
        document.body.appendChild(tempContainer);

        try {
            const opt = {
                margin: [10, 10, 10, 10],
                filename: `customers_export_${new Date().toISOString().split('T')[0]}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' }
            };

            // Generate PDF as blob for viewer
            const pdfBlob = await html2pdf().set(opt).from(tempContainer).outputPdf('blob');
            const pdfUrl = URL.createObjectURL(pdfBlob);

            // Open in PDF viewer dialog
            setCurrentPdfUrl(pdfUrl);
            setCurrentPdfTitle(`Customer Export - ${currentDate}`);
            setPdfViewerOpen(true);

        } finally {
            document.body.removeChild(tempContainer);
        }
    };

    const handleTabChange = (event, newValue) => {
        setSelectedTab(newValue);
    };

    const getStatusColor = (status) => {
        switch (status?.toLowerCase()) {
            case 'active':
                return 'success';
            case 'inactive':
                return 'default';
            case 'suspended':
                return 'error';
            case 'pending':
                return 'warning';
            default:
                return 'default';
        }
    };

    const handleCopyEmail = (email, event) => {
        event.stopPropagation();
        if (email && email !== 'N/A') {
            navigator.clipboard.writeText(email).then(() => {
                // You could add a snackbar notification here if desired
                console.log('Email copied to clipboard:', email);
            }).catch(err => {
                console.error('Failed to copy email:', err);
            });
        }
    };

    const handleCompanyNameClick = (customerId, event) => {
        event.stopPropagation();
        handleViewCustomerDetail(customerId);
    };

    // Selection handlers for export
    const handleSelectAll = (event) => {
        if (event.target.checked) {
            const newSelected = new Set(filteredCustomers.map(customer => customer.id));
            setSelectedCustomers(newSelected);
        } else {
            setSelectedCustomers(new Set());
        }
    };

    const handleSelectCustomer = (customerId, event) => {
        event.stopPropagation();
        const newSelected = new Set(selectedCustomers);
        if (newSelected.has(customerId)) {
            newSelected.delete(customerId);
        } else {
            newSelected.add(customerId);
        }
        setSelectedCustomers(newSelected);
    };

    // Define filteredCustomers first before using it in selection logic
    const filteredCustomers = customers.filter(customer => {
        // Quick search (toolbar search)
        const searchLower = searchQuery.toLowerCase();
        let matchesQuickSearch = true;
        if (searchQuery.trim() !== '') {
            matchesQuickSearch = (
                customer.name?.toLowerCase().includes(searchLower) ||
                customer.customerID?.toLowerCase().includes(searchLower) ||
                (customer.contactName && typeof customer.contactName === 'string' && customer.contactName.toLowerCase().includes(searchLower)) ||
                (customer.contact?.firstName && `${customer.contact.firstName} ${customer.contact.lastName || ''}`.toLowerCase().includes(searchLower)) ||
                (customer.contact?.lastName && `${customer.contact.firstName || ''} ${customer.contact.lastName}`.toLowerCase().includes(searchLower)) ||
                (customer.contact?.email && typeof customer.contact.email === 'string' && customer.contact.email.toLowerCase().includes(searchLower))
            );
        }

        // Advanced search fields
        let matchesAdvancedSearch = true;
        if (searchFields.customerId.trim() !== '') {
            matchesAdvancedSearch = matchesAdvancedSearch && customer.customerID?.toLowerCase().includes(searchFields.customerId.toLowerCase());
        }
        if (searchFields.name.trim() !== '') {
            matchesAdvancedSearch = matchesAdvancedSearch && customer.name?.toLowerCase().includes(searchFields.name.toLowerCase());
        }
        if (searchFields.contactName.trim() !== '') {
            const fullContactName = customer.contact ? `${customer.contact.firstName || ''} ${customer.contact.lastName || ''}`.trim() : (customer.contactName || '');
            matchesAdvancedSearch = matchesAdvancedSearch && fullContactName.toLowerCase().includes(searchFields.contactName.toLowerCase());
        }
        if (searchFields.email.trim() !== '') {
            matchesAdvancedSearch = matchesAdvancedSearch && customer.contact?.email?.toLowerCase().includes(searchFields.email.toLowerCase());
        }

        return matchesQuickSearch && matchesAdvancedSearch;
    });

    const isSelected = (customerId) => selectedCustomers.has(customerId);
    const isIndeterminate = selectedCustomers.size > 0 && selectedCustomers.size < filteredCustomers.length;
    const isAllSelected = filteredCustomers.length > 0 && selectedCustomers.size === filteredCustomers.length;

    // Clear selections when filters change
    useEffect(() => {
        setSelectedCustomers(new Set());
    }, [searchQuery, searchFields, selectedTab]);

    // Add handlers for sliding between views (similar to ShipmentsX)
    const handleViewCustomerDetail = (customerId) => {
        // Find the customer to get its details for the title
        const customer = customers.find(c => c.id === customerId) || { name: 'Customer' };

        // Add customer detail page to navigation stack
        modalNavigation.navigateTo({
            title: customer.name || 'Customer Details',
            shortTitle: customer.name || 'Customer',
            component: 'customer-detail',
            data: { customerId }
        });

        setSelectedCustomerId(customerId);
        setIsSliding(true);

        // Small delay to allow state to update before animation
        setTimeout(() => {
            setCurrentView('detail');
            setTimeout(() => {
                setIsSliding(false);
            }, 300); // Match CSS transition duration
        }, 50);
    };

    const handleViewAddCustomer = () => {
        // Add new customer page to navigation stack
        modalNavigation.navigateTo({
            title: 'Create New Customer',
            shortTitle: 'New Customer',
            component: 'add-customer',
            data: {}
        });

        setIsSliding(true);

        // Small delay to allow state to update before animation
        setTimeout(() => {
            setCurrentView('add');
            setTimeout(() => {
                setIsSliding(false);
            }, 300); // Match CSS transition duration
        }, 50);
    };

    const handleBackToTable = () => {
        // Go back in navigation stack
        modalNavigation.goBack();

        setIsSliding(true);

        setTimeout(() => {
            setCurrentView('table');
            setTimeout(() => {
                setIsSliding(false);
                setSelectedCustomerId(null);
            }, 300); // Match CSS transition duration
        }, 50);
    };

    const handleCustomerCreated = (newCustomerId) => {
        // Refresh the customers list
        fetchCustomers();

        // Navigate to the newly created customer detail
        if (newCustomerId) {
            handleViewCustomerDetail(newCustomerId);
        } else {
            // If no ID provided, just go back to table
            handleBackToTable();
        }
    };

    // Add navigation object function for ModalHeader (similar to ShipmentsX)
    const getNavigationObject = () => {
        const currentPage = modalNavigation.getCurrentPage();
        const canGoBackNow = (currentPage?.component === 'customer-detail' || currentPage?.component === 'add-customer') || modalNavigation.canGoBack;

        return {
            title: currentPage?.title || 'Customers',
            canGoBack: canGoBackNow,
            onBack: canGoBackNow ? handleBackToTable : null,
            backText: canGoBackNow && modalNavigation.navigationStack[modalNavigation.currentIndex - 1]
                ? modalNavigation.navigationStack[modalNavigation.currentIndex - 1].shortTitle || 'Back'
                : 'Back'
        };
    };

    return (
        <div style={{ backgroundColor: 'transparent', width: '100%', height: '100%' }}>
            <Box sx={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
                {/* Modal Header */}
                {isModal && (
                    <ModalHeader
                        navigation={getNavigationObject()}
                        onClose={showCloseButton ? onClose : null}
                        showCloseButton={showCloseButton}
                    />
                )}

                {/* Sliding Container */}
                <Box
                    sx={{
                        display: 'flex',
                        width: '300%',
                        height: '100%',
                        transform: currentView === 'table' ? 'translateX(0%)' : currentView === 'detail' ? 'translateX(-33.33%)' : 'translateX(-66.66%)',
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        willChange: 'transform'
                    }}
                >
                    {/* Main Table View */}
                    <Box sx={{
                        width: '33.33%',
                        minHeight: '100%',
                        '& .customers-container': {
                            maxWidth: 'none !important',
                            width: '100% !important',
                            padding: '0 !important'
                        }
                    }}>
                        <Box sx={{
                            width: '100%',
                            maxWidth: '100%',
                            overflow: 'hidden',
                            position: 'relative'
                        }}>
                            {/* Breadcrumb - only show when not in modal */}
                            {!isModal && (
                                <Box sx={{ px: 2, pt: 2 }}>
                                    <div className="breadcrumb-container">
                                        <Link to="/dashboard" className="breadcrumb-link">
                                            <HomeIcon />
                                            <Typography variant="body2">Dashboard</Typography>
                                        </Link>
                                        <div className="breadcrumb-separator">
                                            <NavigateNextIcon />
                                        </div>
                                        <Typography variant="body2" className="breadcrumb-current">
                                            Customers
                                        </Typography>
                                    </div>
                                </Box>
                            )}

                            {/* Page Title - only show when not in modal */}
                            {!isModal && (
                                <Box sx={{ px: 2, pt: 2, pb: 1 }}>
                                    <Typography variant="h4" component="h1">
                                        Customers
                                    </Typography>
                                </Box>
                            )}

                            {/* Main Content */}
                            <Paper sx={{ bgcolor: 'transparent', boxShadow: 'none', mx: 2 }}>
                                <Toolbar sx={{ borderBottom: 1, borderColor: '#e2e8f0', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Tabs
                                        value={selectedTab}
                                        onChange={handleTabChange}
                                        sx={{
                                            '& .MuiTab-root': {
                                                fontSize: '11px',
                                                minHeight: '36px',
                                                textTransform: 'none',
                                                fontWeight: 500,
                                                padding: '6px 12px'
                                            }
                                        }}
                                    >
                                        <Tab label="All" value="all" />
                                        <Tab label="Active" value="active" />
                                        <Tab label="Inactive" value="inactive" />
                                    </Tabs>

                                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                        {selectedCustomers.size > 0 && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mr: 2 }}>
                                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#1976d2' }}>
                                                    {selectedCustomers.size} selected
                                                </Typography>
                                                <Button
                                                    variant="text"
                                                    size="small"
                                                    onClick={() => setSelectedCustomers(new Set())}
                                                    sx={{ fontSize: '11px', textTransform: 'none', minWidth: 'auto', padding: '2px 8px' }}
                                                >
                                                    Clear
                                                </Button>
                                            </Box>
                                        )}
                                        <TextField
                                            placeholder="Search customers..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            InputProps={{
                                                startAdornment: (
                                                    <InputAdornment position="start">
                                                        <SearchIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                                    </InputAdornment>
                                                ),
                                                endAdornment: searchQuery && (
                                                    <InputAdornment position="end">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => setSearchQuery('')}
                                                        >
                                                            <ClearIcon />
                                                        </IconButton>
                                                    </InputAdornment>
                                                )
                                            }}
                                            size="small"
                                            sx={{
                                                width: 250,
                                                '& .MuiInputBase-input': { fontSize: '12px' },
                                                '& .MuiInputLabel-root': { fontSize: '12px' }
                                            }}
                                        />
                                        <Button
                                            variant="outlined"
                                            startIcon={<FilterIcon />}
                                            onClick={() => setFiltersOpen(!filtersOpen)}
                                            size="small"
                                            sx={{ fontSize: '11px', textTransform: 'none' }}
                                        >
                                            {filtersOpen ? 'Hide' : 'Show'}
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            startIcon={<ExportIcon />}
                                            onClick={handleExport}
                                            size="small"
                                            sx={{ fontSize: '11px', textTransform: 'none' }}
                                        >
                                            Export
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            startIcon={<GetApp />}
                                            disabled
                                            size="small"
                                            sx={{
                                                fontSize: '11px',
                                                textTransform: 'none',
                                                opacity: 0.5,
                                                cursor: 'not-allowed'
                                            }}
                                        >
                                            Import
                                        </Button>
                                        <Button
                                            variant="contained"
                                            startIcon={<AddIcon />}
                                            onClick={handleViewAddCustomer}
                                            size="small"
                                            sx={{ fontSize: '11px', textTransform: 'none' }}
                                        >
                                            New
                                        </Button>
                                    </Box>
                                </Toolbar>

                                {/* Search and Filter Section */}
                                <Collapse in={filtersOpen}>
                                    <Box sx={{ p: 3, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                                        <Grid container spacing={2} alignItems="center">
                                            {/* Customer ID Search */}
                                            <Grid item xs={12} sm={6} md={3}>
                                                <TextField
                                                    fullWidth
                                                    label="Customer ID"
                                                    placeholder="Search by Customer ID"
                                                    value={searchFields.customerId}
                                                    onChange={(e) => setSearchFields(prev => ({ ...prev, customerId: e.target.value }))}
                                                    size="small"
                                                    sx={{
                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                    }}
                                                    InputProps={{
                                                        startAdornment: (
                                                            <InputAdornment position="start">
                                                                <SearchIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                                            </InputAdornment>
                                                        ),
                                                        endAdornment: searchFields.customerId && (
                                                            <InputAdornment position="end">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => setSearchFields(prev => ({ ...prev, customerId: '' }))}
                                                                >
                                                                    <ClearIcon />
                                                                </IconButton>
                                                            </InputAdornment>
                                                        )
                                                    }}
                                                />
                                            </Grid>

                                            {/* Company Name */}
                                            <Grid item xs={12} sm={6} md={3}>
                                                <TextField
                                                    fullWidth
                                                    label="Company Name"
                                                    placeholder="Search by company name"
                                                    value={searchFields.name}
                                                    onChange={(e) => setSearchFields(prev => ({ ...prev, name: e.target.value }))}
                                                    size="small"
                                                    sx={{
                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                    }}
                                                    InputProps={{
                                                        startAdornment: (
                                                            <InputAdornment position="start">
                                                                <SearchIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                                            </InputAdornment>
                                                        ),
                                                        endAdornment: searchFields.name && (
                                                            <InputAdornment position="end">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => setSearchFields(prev => ({ ...prev, name: '' }))}
                                                                >
                                                                    <ClearIcon />
                                                                </IconButton>
                                                            </InputAdornment>
                                                        )
                                                    }}
                                                />
                                            </Grid>

                                            {/* Contact Name */}
                                            <Grid item xs={12} sm={6} md={3}>
                                                <TextField
                                                    fullWidth
                                                    label="Contact Name"
                                                    placeholder="Search by contact name"
                                                    value={searchFields.contactName}
                                                    onChange={(e) => setSearchFields(prev => ({ ...prev, contactName: e.target.value }))}
                                                    size="small"
                                                    sx={{
                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                    }}
                                                    InputProps={{
                                                        startAdornment: (
                                                            <InputAdornment position="start">
                                                                <SearchIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                                            </InputAdornment>
                                                        ),
                                                        endAdornment: searchFields.contactName && (
                                                            <InputAdornment position="end">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => setSearchFields(prev => ({ ...prev, contactName: '' }))}
                                                                >
                                                                    <ClearIcon />
                                                                </IconButton>
                                                            </InputAdornment>
                                                        )
                                                    }}
                                                />
                                            </Grid>

                                            {/* Email */}
                                            <Grid item xs={12} sm={6} md={3}>
                                                <TextField
                                                    fullWidth
                                                    label="Email"
                                                    placeholder="Search by email"
                                                    value={searchFields.email}
                                                    onChange={(e) => setSearchFields(prev => ({ ...prev, email: e.target.value }))}
                                                    size="small"
                                                    sx={{
                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                    }}
                                                    InputProps={{
                                                        startAdornment: (
                                                            <InputAdornment position="start">
                                                                <SearchIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                                            </InputAdornment>
                                                        ),
                                                        endAdornment: searchFields.email && (
                                                            <InputAdornment position="end">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={() => setSearchFields(prev => ({ ...prev, email: '' }))}
                                                                >
                                                                    <ClearIcon />
                                                                </IconButton>
                                                            </InputAdornment>
                                                        )
                                                    }}
                                                />
                                            </Grid>
                                        </Grid>
                                    </Box>
                                </Collapse>

                                {loading ? (
                                    <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                                        <CircularProgress />
                                    </Box>
                                ) : filteredCustomers.length === 0 ? (
                                    <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                                        <Stack spacing={2} alignItems="center">
                                            <SearchOffIcon sx={{ fontSize: 48, color: 'text.secondary' }} />
                                            <Typography variant="h6" color="text.secondary">
                                                No customers found
                                            </Typography>
                                            <Typography variant="body2" color="text.secondary">
                                                Try adjusting your search or filters
                                            </Typography>
                                        </Stack>
                                    </Box>
                                ) : (
                                    <Box sx={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        height: '100%'
                                    }}>
                                        {/* Scrollable table area */}
                                        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                                            <Box sx={{ width: '100%', px: 2 }}>
                                                <Table sx={{
                                                    width: '100%',
                                                    tableLayout: 'fixed',
                                                    '& .MuiTableCell-root': {
                                                        fontSize: '12px',
                                                        padding: '8px 12px',
                                                        borderBottom: '1px solid #e2e8f0'
                                                    }
                                                }}>
                                                    <TableHead sx={{
                                                        position: 'sticky',
                                                        top: 0,
                                                        zIndex: 100,
                                                        '& .MuiTableRow-root': {
                                                            backgroundColor: '#f8fafc !important'
                                                        },
                                                        '& .MuiTableCell-root': {
                                                            backgroundColor: '#f8fafc !important',
                                                            borderBottom: '2px solid #e2e8f0 !important'
                                                        }
                                                    }}>
                                                        <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                                            <TableCell sx={{ fontWeight: 600, color: '#374151', backgroundColor: '#f8fafc !important', width: '50px', padding: '8px 12px' }}>
                                                                <Checkbox
                                                                    indeterminate={isIndeterminate}
                                                                    checked={isAllSelected}
                                                                    onChange={handleSelectAll}
                                                                    size="small"
                                                                    sx={{ padding: '4px' }}
                                                                />
                                                            </TableCell>
                                                            <TableCell sx={{ fontWeight: 600, color: '#374151', backgroundColor: '#f8fafc !important' }}>Company Name</TableCell>
                                                            <TableCell sx={{ fontWeight: 600, color: '#374151', backgroundColor: '#f8fafc !important' }}>Contact</TableCell>
                                                            <TableCell sx={{ fontWeight: 600, color: '#374151', backgroundColor: '#f8fafc !important', width: '180px' }}>Email</TableCell>
                                                            <TableCell sx={{ fontWeight: 600, color: '#374151', backgroundColor: '#f8fafc !important', width: '200px' }}>Address</TableCell>
                                                            <TableCell sx={{ fontWeight: 600, color: '#374151', backgroundColor: '#f8fafc !important' }}>Phone</TableCell>
                                                            <TableCell sx={{ fontWeight: 600, color: '#374151', backgroundColor: '#f8fafc !important', width: '90px' }}>Created</TableCell>
                                                            <TableCell sx={{ fontWeight: 600, color: '#374151', backgroundColor: '#f8fafc !important', width: '100px' }}>Status</TableCell>
                                                        </TableRow>
                                                    </TableHead>
                                                    <TableBody>
                                                        {filteredCustomers.map((customer) => (
                                                            <TableRow
                                                                key={customer.id}
                                                                hover
                                                                sx={{
                                                                    '&:hover': {
                                                                        backgroundColor: 'rgba(0, 0, 0, 0.04)',
                                                                    },
                                                                    '& .MuiTableCell-root': {
                                                                        verticalAlign: 'top'
                                                                    }
                                                                }}
                                                            >
                                                                <TableCell sx={{ padding: '8px 12px' }}>
                                                                    <Checkbox
                                                                        checked={isSelected(customer.id)}
                                                                        onChange={(event) => handleSelectCustomer(customer.id, event)}
                                                                        size="small"
                                                                        sx={{ padding: '4px' }}
                                                                    />
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Button
                                                                        variant="text"
                                                                        onClick={(event) => handleCompanyNameClick(customer.id, event)}
                                                                        sx={{
                                                                            fontSize: '12px',
                                                                            textTransform: 'none',
                                                                            padding: 0,
                                                                            minWidth: 'auto',
                                                                            color: '#1976d2',
                                                                            textDecoration: 'none !important',
                                                                            '&:hover': {
                                                                                backgroundColor: 'transparent',
                                                                                textDecoration: 'none !important'
                                                                            },
                                                                            '&:focus': {
                                                                                textDecoration: 'none !important'
                                                                            },
                                                                            '&:active': {
                                                                                textDecoration: 'none !important'
                                                                            }
                                                                        }}
                                                                    >
                                                                        {customer.name || 'N/A'}
                                                                    </Button>
                                                                </TableCell>
                                                                <TableCell>{customer.contactName || (customer.contact ? `${customer.contact.firstName || ''} ${customer.contact.lastName || ''}`.trim() : 'N/A')}</TableCell>
                                                                <TableCell>
                                                                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                                                        <span>{customer.contact?.email || 'N/A'}</span>
                                                                        {customer.contact?.email && customer.contact.email !== 'N/A' && (
                                                                            <IconButton
                                                                                size="small"
                                                                                onClick={(event) => handleCopyEmail(customer.contact.email, event)}
                                                                                sx={{
                                                                                    padding: '2px',
                                                                                    '&:hover': {
                                                                                        backgroundColor: 'rgba(0, 0, 0, 0.04)'
                                                                                    }
                                                                                }}
                                                                                title="Copy email to clipboard"
                                                                            >
                                                                                <ContentCopyIcon sx={{ fontSize: '14px' }} />
                                                                            </IconButton>
                                                                        )}
                                                                    </Box>
                                                                </TableCell>
                                                                <TableCell>
                                                                    {customer.contact ? (
                                                                        <div style={{ fontSize: '12px', lineHeight: '1.3' }}>
                                                                            {customer.contact.street && <div>{customer.contact.street}</div>}
                                                                            {customer.contact.street2 && <div>{customer.contact.street2}</div>}
                                                                            {(customer.contact.city || customer.contact.state || customer.contact.postalCode) && (
                                                                                <div>
                                                                                    {[customer.contact.city, customer.contact.state, customer.contact.postalCode].filter(Boolean).join(', ')}
                                                                                </div>
                                                                            )}
                                                                            {customer.contact.country && customer.contact.country !== 'US' && <div>{customer.contact.country}</div>}
                                                                        </div>
                                                                    ) : 'N/A'}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {customer.contact?.phone || 'N/A'}
                                                                </TableCell>
                                                                <TableCell>
                                                                    {customer.createdAt?.toDate ?
                                                                        customer.createdAt.toDate().toLocaleDateString() :
                                                                        (customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : 'N/A')}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Chip
                                                                        label={customer.status || 'Unknown'}
                                                                        color={getStatusColor(customer.status)}
                                                                        size="small"
                                                                    />
                                                                </TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </Box>
                                        </Box>

                                        {/* Pagination Footer */}
                                        <Box sx={{ flexShrink: 0, borderTop: '1px solid #e2e8f0', bgcolor: '#fafafa', p: 1 }}>
                                            <ShipmentsPagination
                                                totalCount={filteredCustomers.length}
                                                page={page}
                                                rowsPerPage={rowsPerPage}
                                                onPageChange={(event, newPage) => setPage(newPage)}
                                                onRowsPerPageChange={(event) => {
                                                    setRowsPerPage(parseInt(event.target.value, 10));
                                                    setPage(0);
                                                }}
                                            />
                                        </Box>
                                    </Box>
                                )}
                            </Paper>
                        </Box>
                    </Box>

                    {/* Customer Detail View */}
                    <Box sx={{ width: '33.33%', height: '100%', position: 'relative', overflow: 'hidden' }}>
                        {currentView === 'detail' && selectedCustomerId && (
                            <Box sx={{
                                position: 'relative',
                                height: '100%',
                                overflow: 'auto',
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                {/* Customer Detail Content */}
                                <Suspense fallback={
                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        height: '100%',
                                        pt: 8
                                    }}>
                                        <CircularProgress />
                                    </Box>
                                }>
                                    <CustomerDetail
                                        key={selectedCustomerId}
                                        customerId={selectedCustomerId}
                                        onBackToTable={handleBackToTable}
                                        onNavigateToShipments={onNavigateToShipments}
                                        isModal={true}
                                        highlightNoteId={deepLinkParams?.noteId}
                                    />
                                </Suspense>
                            </Box>
                        )}
                    </Box>

                    {/* Add Customer View */}
                    <Box sx={{ width: '33.33%', minHeight: '100%', position: 'relative' }}>
                        {currentView === 'add' && (
                            <Box sx={{ position: 'relative', height: '100%' }}>
                                {/* Add Customer Content */}
                                <Suspense fallback={
                                    <Box sx={{
                                        display: 'flex',
                                        justifyContent: 'center',
                                        alignItems: 'center',
                                        height: '100%',
                                        pt: 8
                                    }}>
                                        <CircularProgress />
                                    </Box>
                                }>
                                    <AddCustomer
                                        onBackToTable={handleBackToTable}
                                        onCustomerCreated={handleCustomerCreated}
                                        isModal={true}
                                    />
                                </Suspense>
                            </Box>
                        )}
                    </Box>
                </Box>
            </Box>

            {/* Export Dialog */}
            <Dialog open={isExportDialogOpen} onClose={handleExportClose}>
                <DialogTitle>Export Customers</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {selectedCustomers.size > 0
                            ? `Exporting ${selectedCustomers.size} selected customer${selectedCustomers.size !== 1 ? 's' : ''} of ${filteredCustomers.length} total`
                            : `Exporting all ${filteredCustomers.length} customer${filteredCustomers.length !== 1 ? 's' : ''}`
                        }
                    </Typography>
                    <FormControl fullWidth sx={{ mt: 2 }}>
                        <InputLabel>Format</InputLabel>
                        <Select
                            value={selectedExportFormat}
                            onChange={(e) => setSelectedExportFormat(e.target.value)}
                            label="Format"
                            disabled={isExporting}
                        >
                            <MenuItem value="csv">CSV (Comma Separated Values)</MenuItem>
                            <MenuItem value="excel">Excel (Tab Separated)</MenuItem>
                            <MenuItem value="pdf">PDF (Portable Document Format)</MenuItem>
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleExportClose} disabled={isExporting}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleExportConfirm}
                        variant="contained"
                        disabled={isExporting || filteredCustomers.length === 0}
                    >
                        {isExporting ? (
                            <>
                                <CircularProgress size={16} sx={{ mr: 1 }} />
                                Exporting...
                            </>
                        ) : (
                            'Export'
                        )}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* PDF Viewer Dialog */}
            <PdfViewerDialog
                open={pdfViewerOpen}
                onClose={() => {
                    setPdfViewerOpen(false);
                    if (currentPdfUrl?.startsWith('blob:')) {
                        URL.revokeObjectURL(currentPdfUrl);
                    }
                    setCurrentPdfUrl(null);
                    setCurrentPdfTitle('');
                }}
                pdfUrl={currentPdfUrl}
                title={currentPdfTitle}
            />
        </div>
    );
};

export default Customers;