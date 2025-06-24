import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Card,
    CardContent,
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
    CircularProgress,
    Alert,
    Tooltip
} from '@mui/material';
import {
    Search as SearchIcon,
    Clear as ClearIcon,
    Receipt as ReceiptIcon,
    AccountBalance as AccountBalanceIcon,
    CreditCard as CreditCardIcon,
    Warning as WarningIcon,
    CheckCircle as CheckCircleIcon,
    LocalShipping as LocalShippingIcon,
    FilterList as FilterListIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';

const BillingDashboard = () => {
    const { currentUser } = useAuth();
    const { companyData, companyIdForAddress, forceRefreshCompanyData } = useCompany();
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(25);
    const [searchQuery, setSearchQuery] = useState('');
    const [shipments, setShipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [creditInfo, setCreditInfo] = useState({
        creditLimit: 0,
        paymentTerms: '',
        creditStatus: 'active',
        currentBalance: 0,
        availableCredit: 0
    });
    const [totalCharges, setTotalCharges] = useState({
        uninvoiced: 0,
        thisMonth: 0,
        lastMonth: 0
    });

    useEffect(() => {
        fetchBillingData();
    }, [companyData, companyIdForAddress]);

    const fetchBillingData = async () => {
        try {
            setLoading(true);
            console.log('🔍 Starting billing data fetch for company:', companyIdForAddress);

            if (!companyIdForAddress) {
                setError('No company found for your account. Please contact support.');
                return;
            }

            // Use fresh company data from context (no localStorage caching)
            const userCompany = companyData;
            console.log('🏢 Using fresh company data:', {
                companyID: companyIdForAddress,
                name: userCompany?.name,
                paymentTerms: userCompany?.paymentTerms
            });

            if (userCompany) {
                // Set credit information from fresh company data (no caching)
                const paymentTerms = userCompany.paymentTerms || {};
                console.log('💳 Fresh payment terms found:', paymentTerms);

                setCreditInfo({
                    creditLimit: paymentTerms.creditLimit || 5000,
                    paymentTerms: paymentTerms.netTerms ? `Net ${paymentTerms.netTerms}` : 'Net 30',
                    creditStatus: paymentTerms.onCreditHold ? 'on_hold' : 'active'
                });

                console.log('💳 Set fresh credit info (no caching):', {
                    creditLimit: paymentTerms.creditLimit || 5000,
                    paymentTerms: paymentTerms.netTerms ? `Net ${paymentTerms.netTerms}` : 'Net 30',
                    creditStatus: paymentTerms.onCreditHold ? 'on_hold' : 'active'
                });

                // Fetch shipments for this company using the context company ID
                const shipmentsRef = collection(db, 'shipments');
                const shipmentsQuery = query(
                    shipmentsRef,
                    where('companyID', '==', companyIdForAddress),
                    orderBy('createdAt', 'desc'),
                    limit(500)
                );

                console.log('📦 Querying shipments for companyID:', companyIdForAddress);
                const shipmentsSnapshot = await getDocs(shipmentsQuery);

                console.log('📦 Shipments query results:', {
                    empty: shipmentsSnapshot.empty,
                    size: shipmentsSnapshot.size
                });

                const shipmentData = shipmentsSnapshot.docs.map(doc => {
                    const data = { id: doc.id, ...doc.data() };
                    return data;
                }).filter(shipment => {
                    // Exclude draft shipments from billing charges
                    return shipment.status?.toLowerCase() !== 'draft';
                });

                console.log('📦 First few shipments (excluding drafts):', shipmentData.slice(0, 2).map(s => ({
                    id: s.id,
                    shipmentID: s.shipmentID,
                    companyID: s.companyID,
                    status: s.status,
                    totalCharges: s.totalCharges,
                    markupRates: s.markupRates,
                    actualRates: s.actualRates,
                    selectedRate: s.selectedRate,
                    invoiced: s.invoiced
                })));

                setShipments(shipmentData);

                // Calculate totals
                calculateCharges(shipmentData);
            } else {
                console.log('❌ No company data available from context');
                setError('No company found for your account. Please contact support.');
            }
        } catch (err) {
            console.error('❌ Error fetching billing data:', err);
            setError('Failed to load billing information: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const calculateCharges = (shipmentData) => {
        console.log('💰 Starting charge calculation for', shipmentData.length, 'shipments');

        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();
        const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
        const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

        let uninvoiced = 0;
        let thisMonth = 0;
        let lastMonthTotal = 0;

        shipmentData.forEach((shipment, index) => {
            const charges = getShipmentCharges(shipment);
            const shipmentDate = shipment.createdAt?.toDate ? shipment.createdAt.toDate() : new Date(shipment.createdAt);

            if (index < 3) { // Log first 3 shipments for debugging
                console.log(`💰 Shipment ${index + 1}:`, {
                    id: shipment.id,
                    shipmentID: shipment.shipmentID,
                    charges,
                    invoiced: shipment.invoiced,
                    markupRates: shipment.markupRates,
                    totalCharges: shipment.totalCharges,
                    selectedRate: shipment.selectedRate,
                    shipmentDate: shipmentDate
                });
            }

            // Add to uninvoiced if not invoiced
            if (!shipment.invoiced) {
                uninvoiced += charges;
            }

            // Check if from this month
            if (shipmentDate.getMonth() === currentMonth && shipmentDate.getFullYear() === currentYear) {
                thisMonth += charges;
            }

            // Check if from last month
            if (shipmentDate.getMonth() === lastMonth && shipmentDate.getFullYear() === lastMonthYear) {
                lastMonthTotal += charges;
            }
        });

        console.log('💰 Calculated totals:', {
            uninvoiced,
            thisMonth,
            lastMonth: lastMonthTotal,
            totalShipments: shipmentData.length
        });

        setTotalCharges({
            uninvoiced,
            thisMonth,
            lastMonth: lastMonthTotal
        });

        // Update available credit
        setCreditInfo(prev => {
            const newCreditInfo = {
                ...prev,
                currentBalance: uninvoiced,
                availableCredit: Math.max(0, prev.creditLimit - uninvoiced)
            };
            console.log('💳 Updated credit info:', newCreditInfo);
            return newCreditInfo;
        });
    };

    const getShipmentCharges = (shipment) => {
        let charges = 0;
        let source = 'none';

        // Use the new dual rate storage system if available (customer sees markup rates)
        if (shipment.markupRates?.totalCharges) {
            charges = shipment.markupRates.totalCharges;
            source = 'markupRates.totalCharges';
        }
        // Fallback to legacy methods
        else if (shipment.totalCharges) {
            charges = shipment.totalCharges;
            source = 'totalCharges';
        }
        else if (shipment.selectedRate?.totalCharges) {
            charges = shipment.selectedRate.totalCharges;
            source = 'selectedRate.totalCharges';
        }
        else if (shipment.selectedRate?.pricing?.total) {
            charges = shipment.selectedRate.pricing.total;
            source = 'selectedRate.pricing.total';
        }
        else if (shipment.cost) {
            charges = shipment.cost;
            source = 'cost';
        }

        console.log(`💰 Charges for ${shipment.shipmentID || shipment.id}:`, {
            charges,
            source,
            markupRates: shipment.markupRates,
            totalCharges: shipment.totalCharges,
            selectedRate: shipment.selectedRate
        });

        return charges;
    };

    const getChargeBreakdown = (shipment) => {
        const charges = [];

        // Try to get detailed breakdown from markupRates or actualRates
        if (shipment.markupRates) {
            const rates = shipment.markupRates;
            if (rates.freightCharges > 0) charges.push({ name: 'Freight', amount: rates.freightCharges });
            if (rates.fuelCharges > 0) charges.push({ name: 'Fuel', amount: rates.fuelCharges });
            if (rates.serviceCharges > 0) charges.push({ name: 'Service', amount: rates.serviceCharges });
            if (rates.accessorialCharges > 0) charges.push({ name: 'Accessorial', amount: rates.accessorialCharges });
        } else if (shipment.selectedRate?.pricing) {
            const pricing = shipment.selectedRate.pricing;
            if (pricing.freight > 0) charges.push({ name: 'Freight', amount: pricing.freight });
            if (pricing.fuel > 0) charges.push({ name: 'Fuel', amount: pricing.fuel });
            if (pricing.service > 0) charges.push({ name: 'Service', amount: pricing.service });
            if (pricing.accessorial > 0) charges.push({ name: 'Accessorial', amount: pricing.accessorial });
        }

        return charges;
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
        setPage(0);
    };

    const handleClearSearch = () => {
        setSearchQuery('');
        setPage(0);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'delivered':
                return { color: '#2e7d32', bgcolor: '#e8f5e9' };
            case 'in_transit':
                return { color: '#ed6c02', bgcolor: '#fff3e0' };
            case 'pending':
                return { color: '#1976d2', bgcolor: '#e3f2fd' };
            case 'booked':
                return { color: '#6b46c1', bgcolor: '#f3f4f6' };
            default:
                return { color: '#757575', bgcolor: '#f5f5f5' };
        }
    };

    const filteredShipments = shipments.filter(shipment =>
        shipment.shipmentID?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shipment.shipmentNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shipment.carrier?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        shipment.status?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px' }}>
                <CircularProgress />
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
        <Box>
            {/* Credit Overview Cards */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} md={3}>
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Card
                            elevation={0}
                            sx={{
                                border: '1px solid #e5e7eb',
                                borderRadius: '12px',
                                background: creditInfo.creditStatus === 'on_hold' ? '#fef2f2' : 'white'
                            }}
                        >
                            <CardContent sx={{ p: 3 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    {creditInfo.creditStatus === 'on_hold' ? (
                                        <WarningIcon sx={{ color: '#dc2626', mr: 1 }} />
                                    ) : (
                                        <CheckCircleIcon sx={{ color: '#16a34a', mr: 1 }} />
                                    )}
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#6b7280' }}>
                                        Credit Status
                                    </Typography>
                                </Box>
                                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                                    {creditInfo.creditStatus === 'on_hold' ? 'On Hold' : 'Active'}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                    {creditInfo.paymentTerms}
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
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <CreditCardIcon sx={{ color: '#6b46c1', mr: 1 }} />
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#6b7280' }}>
                                        Credit Limit
                                    </Typography>
                                </Box>
                                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                                    ${creditInfo.creditLimit.toLocaleString()}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                    Total authorized
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
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <AccountBalanceIcon sx={{ color: '#dc2626', mr: 1 }} />
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#6b7280' }}>
                                        Current Balance
                                    </Typography>
                                </Box>
                                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                                    ${creditInfo.currentBalance.toLocaleString()}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                    Uninvoiced charges
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
                                background: creditInfo.availableCredit <= 0 ? '#fef2f2' : '#f0fdf4'
                            }}
                        >
                            <CardContent sx={{ p: 3 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <ReceiptIcon sx={{ color: '#16a34a', mr: 1 }} />
                                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#6b7280' }}>
                                        Available Credit
                                    </Typography>
                                </Box>
                                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                                    ${creditInfo.availableCredit.toLocaleString()}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#6b7280' }}>
                                    Remaining credit
                                </Typography>
                            </CardContent>
                        </Card>
                    </motion.div>
                </Grid>
            </Grid>

            {/* Charges Summary */}
            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} md={4}>
                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#6b7280', mb: 1 }}>
                                Uninvoiced Charges
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700, color: '#dc2626' }}>
                                ${totalCharges.uninvoiced.toLocaleString()}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#6b7280', mb: 1 }}>
                                This Month
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700 }}>
                                ${totalCharges.thisMonth.toLocaleString()}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={4}>
                    <Card elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                        <CardContent sx={{ p: 3 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#6b7280', mb: 1 }}>
                                Last Month
                            </Typography>
                            <Typography variant="h5" sx={{ fontWeight: 700 }}>
                                ${totalCharges.lastMonth.toLocaleString()}
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Shipment Charges Table */}
            <Paper elevation={0} sx={{ border: '1px solid #e5e7eb', borderRadius: '12px' }}>
                <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '18px', color: '#111827' }}>
                            Shipment Charges
                        </Typography>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<FilterListIcon />}
                            sx={{ fontSize: '12px' }}
                        >
                            Filter
                        </Button>
                    </Box>

                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Search shipments..."
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
                </Box>

                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Shipment ID</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Date</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Carrier</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Service</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Route</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Charges</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Status</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Invoiced</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredShipments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} align="center" sx={{ py: 4, color: '#6b7280' }}>
                                        <LocalShippingIcon sx={{ fontSize: 48, color: '#d1d5db', mb: 2 }} />
                                        <Typography variant="body1">No shipments found</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredShipments
                                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                    .map((shipment) => {
                                        const charges = getShipmentCharges(shipment);
                                        const breakdown = getChargeBreakdown(shipment);
                                        const createdDate = shipment.createdAt?.toDate ?
                                            shipment.createdAt.toDate() :
                                            new Date(shipment.createdAt);

                                        return (
                                            <TableRow key={shipment.id} hover>
                                                <TableCell sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                    {shipment.shipmentID || shipment.shipmentNumber || shipment.id}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {createdDate.toLocaleDateString()}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {shipment.carrier || 'N/A'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    {shipment.selectedRate?.service?.name ||
                                                        shipment.selectedService ||
                                                        'Standard'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    <Typography variant="body2" sx={{ fontSize: '11px' }}>
                                                        {shipment.shipFrom?.city}, {shipment.shipFrom?.state}
                                                    </Typography>
                                                    <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                        → {shipment.shipTo?.city}, {shipment.shipTo?.state}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    <Tooltip
                                                        title={
                                                            breakdown.length > 0 ? (
                                                                <Box>
                                                                    {breakdown.map((charge, idx) => (
                                                                        <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                                            <Typography variant="body2" sx={{ fontSize: '11px' }}>
                                                                                {charge.name}:
                                                                            </Typography>
                                                                            <Typography variant="body2" sx={{ fontSize: '11px', ml: 2 }}>
                                                                                ${charge.amount.toFixed(2)}
                                                                            </Typography>
                                                                        </Box>
                                                                    ))}
                                                                </Box>
                                                            ) : 'No breakdown available'
                                                        }
                                                        placement="top"
                                                    >
                                                        <Typography sx={{ fontWeight: 600, cursor: 'pointer' }}>
                                                            ${charges.toFixed(2)}
                                                        </Typography>
                                                    </Tooltip>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={shipment.status || 'pending'}
                                                        size="small"
                                                        sx={{
                                                            fontSize: '11px',
                                                            height: '22px',
                                                            bgcolor: getStatusColor(shipment.status).bgcolor,
                                                            color: getStatusColor(shipment.status).color,
                                                            textTransform: 'capitalize'
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={shipment.invoiced ? 'Yes' : 'No'}
                                                        size="small"
                                                        sx={{
                                                            fontSize: '11px',
                                                            height: '22px',
                                                            bgcolor: shipment.invoiced ? '#e8f5e9' : '#fff3e0',
                                                            color: shipment.invoiced ? '#2e7d32' : '#ed6c02'
                                                        }}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>

                <TablePagination
                    component="div"
                    count={filteredShipments.length}
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
        </Box>
    );
};

export default BillingDashboard; 