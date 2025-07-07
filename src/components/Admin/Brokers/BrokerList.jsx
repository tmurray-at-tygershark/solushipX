import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Typography, Paper, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, TablePagination, IconButton, Chip, Button,
    TextField, InputAdornment, CircularProgress, Menu, MenuItem,
    Skeleton, Alert, Tooltip, Avatar, FormControl, InputLabel, Select
} from '@mui/material';
import {
    Add as AddIcon, Search as SearchIcon, Edit as EditIcon,
    Delete as DeleteIcon, MoreVert as MoreVertIcon,
    Phone as PhoneIcon, Email as EmailIcon, Business as BusinessIcon
} from '@mui/icons-material';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import AdminBreadcrumb from '../AdminBreadcrumb';

const BrokerList = () => {
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    // State
    const [brokers, setBrokers] = useState([]);
    const [filteredBrokers, setFilteredBrokers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedBroker, setSelectedBroker] = useState(null);
    const [activeTab, setActiveTab] = useState('all');
    const [companies, setCompanies] = useState({});
    const [companyList, setCompanyList] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState('all');

    // Load brokers from database
    const loadBrokers = useCallback(async () => {
        setLoading(true);
        try {
            // Load all brokers from companyBrokers collection
            const brokersQuery = query(collection(db, 'companyBrokers'));
            const brokersSnapshot = await getDocs(brokersQuery);

            const brokersData = [];

            brokersSnapshot.forEach(doc => {
                const data = doc.data();
                brokersData.push({
                    id: doc.id,
                    ...data
                });
            });

            // Load ALL companies (not just ones with brokers)
            const companiesQuery = query(collection(db, 'companies'));
            const companiesSnapshot = await getDocs(companiesQuery);

            const companiesData = {};
            const companiesArray = [];

            companiesSnapshot.forEach(doc => {
                const companyData = doc.data();
                const companyId = companyData.companyID || doc.id;
                companiesData[companyId] = companyData.name || companyId;
                companiesArray.push({
                    id: companyId,
                    name: companyData.name || companyId
                });
            });

            // Sort companies by name
            companiesArray.sort((a, b) => a.name.localeCompare(b.name));

            setCompanies(companiesData);
            setCompanyList(companiesArray);
            setBrokers(brokersData);
            setFilteredBrokers(brokersData);
        } catch (error) {
            console.error('Error loading brokers:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadBrokers();
    }, [loadBrokers]);

    // Filter brokers based on search, tab, and company
    useEffect(() => {
        let filtered = [...brokers];

        // Apply search filter
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(broker =>
                broker.name?.toLowerCase().includes(term) ||
                broker.email?.toLowerCase().includes(term) ||
                broker.phone?.toLowerCase().includes(term) ||
                broker.reference?.toLowerCase().includes(term)
            );
        }

        // Apply tab filter
        switch (activeTab) {
            case 'active':
                filtered = filtered.filter(b => b.enabled !== false);
                break;
            case 'inactive':
                filtered = filtered.filter(b => b.enabled === false);
                break;
            default:
                // 'all' - no additional filter
                break;
        }

        // Apply company filter
        if (selectedCompany !== 'all') {
            filtered = filtered.filter(b => b.companyID === selectedCompany);
        }

        setFilteredBrokers(filtered);
        setPage(0); // Reset to first page when filters change
    }, [searchTerm, activeTab, brokers, selectedCompany]);

    // Handlers
    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    const handleMenuOpen = (event, broker) => {
        setAnchorEl(event.currentTarget);
        setSelectedBroker(broker);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setSelectedBroker(null);
    };

    const handleAddBroker = () => {
        navigate('/admin/brokers/new');
    };

    const handleEditBroker = () => {
        if (selectedBroker) {
            navigate(`/admin/brokers/${selectedBroker.id}`);
        }
        handleMenuClose();
    };

    const handleDeleteBroker = async () => {
        if (!selectedBroker || !window.confirm(`Are you sure you want to delete broker "${selectedBroker.name}"?`)) {
            handleMenuClose();
            return;
        }

        try {
            await deleteDoc(doc(db, 'companyBrokers', selectedBroker.id));
            await loadBrokers();
            handleMenuClose();
        } catch (error) {
            console.error('Error deleting broker:', error);
            alert('Failed to delete broker. Please try again.');
        }
    };

    // Get tab counts
    const tabCounts = {
        all: brokers.length,
        active: brokers.filter(b => b.enabled !== false).length,
        inactive: brokers.filter(b => b.enabled === false).length
    };

    return (
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827', mb: 1 }}>
                            Broker Management
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                            Manage broker information across all companies
                        </Typography>
                    </Box>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleAddBroker}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Add New Broker
                    </Button>
                </Box>
                <AdminBreadcrumb currentPage="Brokers" />
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                <Paper sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
                    {/* Search and Tabs */}
                    <Box sx={{ p: 2, borderBottom: '1px solid #e5e7eb' }}>
                        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                            <TextField
                                placeholder="Search brokers..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                size="small"
                                sx={{ flex: 1, maxWidth: 400 }}
                                InputProps={{
                                    startAdornment: (
                                        <InputAdornment position="start">
                                            <SearchIcon sx={{ fontSize: 20, color: '#6b7280' }} />
                                        </InputAdornment>
                                    ),
                                    sx: { fontSize: '12px' }
                                }}
                            />

                            {/* Company Filter */}
                            <FormControl size="small" sx={{ minWidth: 200 }}>
                                <InputLabel sx={{ fontSize: '12px' }}>Filter by Company</InputLabel>
                                <Select
                                    value={selectedCompany}
                                    onChange={(e) => setSelectedCompany(e.target.value)}
                                    label="Filter by Company"
                                    sx={{
                                        fontSize: '12px',
                                        '& .MuiSelect-select': { fontSize: '12px' }
                                    }}
                                >
                                    <MenuItem value="all" sx={{ fontSize: '12px' }}>All Companies</MenuItem>
                                    {companyList.map((company) => (
                                        <MenuItem key={company.id} value={company.id} sx={{ fontSize: '12px' }}>
                                            {company.name} ({company.id})
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>

                        {/* Tabs */}
                        <Box sx={{ display: 'flex', gap: 3 }}>
                            {['all', 'active', 'inactive'].map((tab) => (
                                <Box
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    sx={{
                                        pb: 1,
                                        borderBottom: activeTab === tab ? '2px solid #3b82f6' : '2px solid transparent',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            fontSize: '12px',
                                            fontWeight: activeTab === tab ? 600 : 400,
                                            color: activeTab === tab ? '#3b82f6' : '#6b7280',
                                            textTransform: 'capitalize'
                                        }}
                                    >
                                        {tab} ({tabCounts[tab]})
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                    </Box>

                    {/* Table */}
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                        Broker Name
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                        Company
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                        Contact Information
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                        Status
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151', width: 50 }}>
                                        Actions
                                    </TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {loading ? (
                                    [...Array(5)].map((_, index) => (
                                        <TableRow key={index}>
                                            <TableCell colSpan={5}>
                                                <Skeleton height={40} />
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : filteredBrokers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                {searchTerm || selectedCompany !== 'all' ? 'No brokers found matching your filters' : 'No brokers found'}
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredBrokers
                                        .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                                        .map((broker) => (
                                            <TableRow key={broker.id} hover>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Avatar sx={{ width: 32, height: 32, fontSize: '14px', bgcolor: '#3b82f6' }}>
                                                            {broker.name?.charAt(0)?.toUpperCase() || 'B'}
                                                        </Avatar>
                                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                            {broker.name || 'Unnamed Broker'}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <BusinessIcon sx={{ fontSize: 14, color: '#6b7280' }} />
                                                        <Typography sx={{ fontSize: '12px' }}>
                                                            {companies[broker.companyID] || broker.companyID || 'Unknown'}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>
                                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                        {broker.phone && (
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                <PhoneIcon sx={{ fontSize: 14, color: '#6b7280' }} />
                                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                    {broker.phone}
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                        {broker.email && (
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                                <EmailIcon sx={{ fontSize: 14, color: '#6b7280' }} />
                                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                    {broker.email}
                                                                </Typography>
                                                            </Box>
                                                        )}
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={broker.enabled === false ? 'Inactive' : 'Active'}
                                                        size="small"
                                                        sx={{
                                                            fontSize: '11px',
                                                            height: 20,
                                                            backgroundColor: broker.enabled === false ? '#fee2e2' : '#d1fae5',
                                                            color: broker.enabled === false ? '#dc2626' : '#059669'
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => handleMenuOpen(e, broker)}
                                                    >
                                                        <MoreVertIcon sx={{ fontSize: 18 }} />
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* Pagination */}
                    {filteredBrokers.length > 0 && (
                        <TablePagination
                            component="div"
                            count={filteredBrokers.length}
                            page={page}
                            onPageChange={handleChangePage}
                            rowsPerPage={rowsPerPage}
                            onRowsPerPageChange={handleChangeRowsPerPage}
                            rowsPerPageOptions={[5, 10, 25, 50]}
                            sx={{
                                borderTop: '1px solid #e5e7eb',
                                '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                                    fontSize: '12px'
                                }
                            }}
                        />
                    )}
                </Paper>
            </Box>

            {/* Action Menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                PaperProps={{
                    sx: { boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }
                }}
            >
                <MenuItem onClick={handleEditBroker} sx={{ fontSize: '12px' }}>
                    <EditIcon sx={{ fontSize: 16, mr: 1 }} />
                    Edit
                </MenuItem>
                <MenuItem onClick={handleDeleteBroker} sx={{ fontSize: '12px', color: '#dc2626' }}>
                    <DeleteIcon sx={{ fontSize: 16, mr: 1 }} />
                    Delete
                </MenuItem>
            </Menu>
        </Box>
    );
};

export default BrokerList; 