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
    LinearProgress
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
    Assignment as StatusIcon
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

// AUTO INVOICE GENERATOR - Enterprise-Grade Filtering
const BulkInvoiceGenerator = () => {
    const { enqueueSnackbar } = useSnackbar();
    const { currentUser: user, userRole, loading: authLoading } = useAuth();
    const { connectedCompanies } = useCompany();
    const [loading, setLoading] = useState(false);

    // 0. TOP-LEVEL FILTERS (Above Company Selection)
    const [dateRange, setDateRange] = useState({
        from: null,
        to: null
    });
    const [statusFilter, setStatusFilter] = useState('all');

    // 1. COMPANY SELECTION
    const [companies, setCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [loadingCompanies, setLoadingCompanies] = useState(false);

    // 2. CUSTOMER FILTERING
    const [customers, setCustomers] = useState([]);
    const [selectedCustomers, setSelectedCustomers] = useState([]);
    const [loadingCustomers, setLoadingCustomers] = useState(false);

    // 3. SHIPMENT ID TARGETING
    const [shipmentIds, setShipmentIds] = useState('');
    const [shipmentIdMode, setShipmentIdMode] = useState('all'); // 'all', 'specific'

    // 4. UI STATE
    const [filtersExpanded, setFiltersExpanded] = useState(true);
    const [generationProgress, setGenerationProgress] = useState(0);

    // 5. INVOICE GENERATION MODE
    const [invoiceMode, setInvoiceMode] = useState('separate'); // 'separate', 'combined'

    // Status options for filtering
    const statusOptions = [
        { value: 'all', label: 'All Statuses' },
        { value: 'pending', label: 'Pending' },
        { value: 'booked', label: 'Booked' },
        { value: 'in_transit', label: 'In Transit' },
        { value: 'delivered', label: 'Delivered' },
        { value: 'completed', label: 'Completed' },
        { value: 'cancelled', label: 'Cancelled' },
        { value: 'on_hold', label: 'On Hold' },
        { value: 'delayed', label: 'Delayed' },
        { value: 'exception', label: 'Exception' }
    ];

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
            setSelectedCustomers([]);
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
            setSelectedCustomers([]); // Reset customer selection when company changes

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
            setSelectedCustomers([]);
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
                filters: {
                    // Date filters
                    dateFrom: dateRange.from ? dateRange.from.format('YYYY-MM-DD') : null,
                    dateTo: dateRange.to ? dateRange.to.format('YYYY-MM-DD') : null,
                    // Status filter
                    status: statusFilter !== 'all' ? statusFilter : null,
                    // Customer filters
                    customers: selectedCustomers.length > 0 ? selectedCustomers.map(c => c.customerID) : null,
                    // Shipment ID filters
                    shipmentIds: shipmentIdMode === 'specific' ? parseShipmentIds(shipmentIds) : null
                }
            };

            const filterSummary = [];
            if (dateRange.from || dateRange.to) {
                filterSummary.push(`date range`);
            }
            if (statusFilter !== 'all') {
                filterSummary.push(`status: ${statusFilter}`);
            }
            if (selectedCustomers.length > 0) {
                filterSummary.push(`${selectedCustomers.length} customers`);
            }
            if (shipmentIdMode === 'specific') {
                filterSummary.push(`${parseShipmentIds(shipmentIds).length} shipment IDs`);
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

            if (dateRange.from || dateRange.to) {
                filenameParts.push('DateFiltered');
            }
            if (statusFilter !== 'all') {
                filenameParts.push(statusFilter);
            }
            if (selectedCustomers.length > 0) {
                filenameParts.push(`${selectedCustomers.length}customers`);
            }
            if (shipmentIdMode === 'specific') {
                filenameParts.push(`${parseShipmentIds(shipmentIds).length}shipments`);
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

    // Handle date changes
    const handleDateChange = (field, newValue) => {
        setDateRange(prev => ({
            ...prev,
            [field]: newValue
        }));
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box sx={{ p: 3 }}>
                <Paper sx={{ p: 3, border: '1px solid #e5e7eb' }}>
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151', mb: 1 }}>
                            Auto Invoice Generator
                        </Typography>
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                            Generate ZIP files with individual invoices organized by customer folders, with comprehensive filtering
                        </Typography>
                    </Box>

                    {/* TOP-LEVEL FILTERS */}
                    <Paper sx={{ p: 3, mb: 3, backgroundColor: '#fefbff', border: '1px solid #e1bee7' }}>
                        <Grid container spacing={3}>
                            {/* DATE RANGE FILTER */}
                            <Grid item xs={12} md={6}>
                                <Grid container spacing={2}>
                                    <Grid item xs={6}>
                                        <DatePicker
                                            label="From Date"
                                            value={dateRange.from}
                                            onChange={(newValue) => handleDateChange('from', newValue)}
                                            slotProps={{
                                                textField: {
                                                    size: 'small',
                                                    sx: {
                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                    }
                                                }
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={6}>
                                        <DatePicker
                                            label="To Date"
                                            value={dateRange.to}
                                            onChange={(newValue) => handleDateChange('to', newValue)}
                                            slotProps={{
                                                textField: {
                                                    size: 'small',
                                                    sx: {
                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                    }
                                                }
                                            }}
                                        />
                                    </Grid>
                                </Grid>
                                {(dateRange.from || dateRange.to) && (
                                    <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Chip
                                            label={`${dateRange.from ? dateRange.from.format('MMM DD') : 'Any'} → ${dateRange.to ? dateRange.to.format('MMM DD') : 'Any'}`}
                                            size="small"
                                            color="primary"
                                            variant="outlined"
                                            onDelete={() => setDateRange({ from: null, to: null })}
                                            sx={{ fontSize: '11px' }}
                                        />
                                    </Box>
                                )}
                            </Grid>

                            {/* STATUS FILTER */}
                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth size="small">
                                    <InputLabel sx={{ fontSize: '12px' }}>Status Filter</InputLabel>
                                    <Select
                                        value={statusFilter}
                                        onChange={(e) => setStatusFilter(e.target.value)}
                                        label="Status Filter"
                                        sx={{ fontSize: '12px' }}
                                    >
                                        {statusOptions.map(option => (
                                            <MenuItem key={option.value} value={option.value} sx={{ fontSize: '12px' }}>
                                                {option.label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                {statusFilter !== 'all' && (
                                    <Box sx={{ mt: 1 }}>
                                        <Chip
                                            label={statusOptions.find(s => s.value === statusFilter)?.label}
                                            size="small"
                                            color="secondary"
                                            variant="outlined"
                                            onDelete={() => setStatusFilter('all')}
                                            sx={{ fontSize: '11px' }}
                                        />
                                    </Box>
                                )}
                            </Grid>
                        </Grid>
                    </Paper>

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
                            <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 1,
                                mb: 2,
                                cursor: 'pointer',
                                p: 1,
                                borderRadius: 1,
                                '&:hover': { backgroundColor: '#f8fafc' }
                            }} onClick={() => setFiltersExpanded(!filtersExpanded)}>
                                <FilterIcon sx={{ fontSize: 16, color: '#7c3aed' }} />
                                <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                    Advanced Filters
                                </Typography>
                                {filtersExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </Box>

                            <Collapse in={filtersExpanded}>
                                <Paper sx={{ p: 3, mb: 3, backgroundColor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                                    <Grid container spacing={3}>
                                        {/* CUSTOMER FILTER */}
                                        <Grid item xs={12} md={6}>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                                Customer Filter
                                            </Typography>
                                            <Autocomplete
                                                multiple
                                                value={selectedCustomers}
                                                onChange={(event, newValue) => setSelectedCustomers(newValue)}
                                                options={customers}
                                                getOptionLabel={(option) => option.name || option.customerID}
                                                isOptionEqualToValue={(option, value) => option.customerID === value?.customerID}
                                                loading={loadingCustomers}
                                                renderInput={(params) => (
                                                    <TextField
                                                        {...params}
                                                        label="Select Customers (optional)"
                                                        placeholder={selectedCompany ? "Leave empty for all customers" : "Select company first"}
                                                        size="small"
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
                                                renderTags={(value, getTagProps) =>
                                                    value.map((option, index) => (
                                                        <Chip
                                                            key={option.customerID}
                                                            label={option.name}
                                                            size="small"
                                                            {...getTagProps({ index })}
                                                            sx={{ fontSize: '11px' }}
                                                        />
                                                    ))
                                                }
                                                disabled={!selectedCompany || loading}
                                                noOptionsText={loadingCustomers ? "Loading customers..." : "No customers found"}
                                            />
                                        </Grid>

                                        {/* SHIPMENT ID FILTER */}
                                        <Grid item xs={12} md={6}>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                                Shipment ID Filter
                                            </Typography>

                                            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                                                <InputLabel sx={{ fontSize: '12px' }}>Filter Mode</InputLabel>
                                                <Select
                                                    value={shipmentIdMode}
                                                    onChange={(e) => setShipmentIdMode(e.target.value)}
                                                    label="Filter Mode"
                                                    sx={{ fontSize: '12px' }}
                                                >
                                                    <MenuItem value="all" sx={{ fontSize: '12px' }}>
                                                        All Shipments
                                                    </MenuItem>
                                                    <MenuItem value="specific" sx={{ fontSize: '12px' }}>
                                                        Specific Shipment IDs
                                                    </MenuItem>
                                                </Select>
                                            </FormControl>

                                            {shipmentIdMode === 'specific' && (
                                                <TextField
                                                    fullWidth
                                                    multiline
                                                    rows={4}
                                                    value={shipmentIds}
                                                    onChange={(e) => setShipmentIds(e.target.value)}
                                                    label="Shipment IDs"
                                                    placeholder="Enter shipment IDs separated by commas or new lines:
IC-CUSTOMER-123
IC-CUSTOMER-456
IC-CUSTOMER-789"
                                                    size="small"
                                                    sx={{
                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                    }}
                                                    InputProps={{
                                                        endAdornment: shipmentIds && (
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => setShipmentIds('')}
                                                                sx={{ position: 'absolute', top: 8, right: 8 }}
                                                            >
                                                                <ClearIcon sx={{ fontSize: 16 }} />
                                                            </IconButton>
                                                        )
                                                    }}
                                                    helperText={shipmentIds ? `${parseShipmentIds(shipmentIds).length} shipment IDs entered` : "One ID per line or comma-separated"}
                                                />
                                            )}
                                        </Grid>
                                    </Grid>
                                </Paper>
                            </Collapse>
                        </>
                    )}

                    {/* INVOICE GENERATION MODE SELECTION */}
                    <Paper sx={{ p: 3, mb: 3, border: '1px solid #e5e7eb', borderRadius: 2 }}>
                        <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 2 }}>
                            Invoice Generation Method
                        </Typography>
                        <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                            Choose how invoices should be generated for your selected shipments
                        </Typography>

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

                        {/* Visual indicator of current selection */}
                        <Box sx={{ mt: 2, p: 2, backgroundColor: invoiceMode === 'combined' ? '#f0f9ff' : '#f8fafc', borderRadius: 1, border: '1px solid ' + (invoiceMode === 'combined' ? '#bae6fd' : '#e5e7eb') }}>
                            <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>
                                {invoiceMode === 'combined' ? '🔗 Combined Mode:' : '📄 Separate Mode:'}
                            </Typography>
                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                {invoiceMode === 'combined'
                                    ? 'Customer "Temspec" with 3 shipments → 1 invoice (INV-ICAL-TEMSPEC-20250124) with 3 line items'
                                    : 'Customer "Temspec" with 3 shipments → 3 separate invoices (INV-ICAL-21DNH6, INV-ICAL-22ABC7, INV-ICAL-23XYZ8)'
                                }
                            </Typography>
                        </Box>
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
                    <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
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
                            {loading ? 'Generating ZIP...' : 'Generate Customer ZIP'}
                        </Button>

                        <Button
                            variant="outlined"
                            startIcon={<DownloadIcon />}
                            disabled={loading}
                            sx={{ fontSize: '12px' }}
                            onClick={() => {
                                enqueueSnackbar('Configure filters above and click "Generate Customer ZIP" to create your download', {
                                    variant: 'info',
                                    autoHideDuration: 4000
                                });
                            }}
                        >
                            Download will start automatically
                        </Button>
                    </Box>

                    <Divider sx={{ mb: 3 }} />

                    {/* ENHANCED SUMMARY INFO */}
                    <Box sx={{ mt: 3 }}>
                        <Alert severity="info" sx={{ mb: 2, fontSize: '12px' }}>
                            <strong>Smart Filtering:</strong> Set date range and status at the top level, select a company,
                            optionally filter by specific customers and target specific shipment IDs. Creates organized ZIP
                            with customer folders containing individual PDF invoices.
                        </Alert>

                        {selectedCompany && (
                            <Box sx={{ p: 2, backgroundColor: '#f0f9ff', borderRadius: 1, border: '1px solid #bae6fd' }}>
                                <Typography sx={{ fontSize: '11px', color: '#374151', fontWeight: 600, mb: 1 }}>
                                    Current Selection:
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                    {(dateRange.from || dateRange.to) && (
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                            Date Range: {dateRange.from ? dateRange.from.format('MMM DD, YYYY') : 'Any'} → {dateRange.to ? dateRange.to.format('MMM DD, YYYY') : 'Any'}
                                        </Typography>
                                    )}
                                    {statusFilter !== 'all' && (
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                            Status: {statusOptions.find(s => s.value === statusFilter)?.label}
                                        </Typography>
                                    )}
                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                        Company: {selectedCompany.name} ({selectedCompany.companyID})
                                    </Typography>
                                    {selectedCustomers.length > 0 && (
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                            Customers: {selectedCustomers.map(c => c.name).join(', ')}
                                        </Typography>
                                    )}
                                    {shipmentIdMode === 'specific' && shipmentIds && (
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                            Specific Shipments: {parseShipmentIds(shipmentIds).length} IDs specified
                                        </Typography>
                                    )}
                                    {!dateRange.from && !dateRange.to && statusFilter === 'all' && selectedCustomers.length === 0 && shipmentIdMode === 'all' && (
                                        <Typography sx={{ fontSize: '11px', color: '#059669' }}>
                                            All shipments for {selectedCompany.name}
                                        </Typography>
                                    )}
                                </Box>
                            </Box>
                        )}
                    </Box>
                </Paper>
            </Box>
        </LocalizationProvider>
    );
};

export default BulkInvoiceGenerator; 