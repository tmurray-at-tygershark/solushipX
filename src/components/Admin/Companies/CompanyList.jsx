import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    IconButton,
    Button,
    Chip,
    TextField,
    InputAdornment,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Stack,
    Tooltip,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    FormControl,
    InputLabel,
    Select,
    Grid
} from '@mui/material';
import {
    Search as SearchIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Visibility as ViewIcon,
    Business as BusinessIcon,
    Email as EmailIcon,
    Phone as PhoneIcon,
    LocationOn as LocationIcon,
    MoreVert as MoreVertIcon,
    FilterList as FilterIcon,
    Sort as SortIcon
} from '@mui/icons-material';
import './CompanyList.css';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../firebase/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';

const CompanyList = () => {
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [filterAnchorEl, setFilterAnchorEl] = useState(null);
    const [sortAnchorEl, setSortAnchorEl] = useState(null);
    const [sortBy, setSortBy] = useState('name');
    const [filterStatus, setFilterStatus] = useState('all');
    const [filterType, setFilterType] = useState('all');
    const { currentUser } = useAuth();
    const navigate = useNavigate();

    // Generate random companies
    const generateRandomCompanies = () => {
        const companyTypes = ['Customer', 'Vendor', 'Partner', 'Carrier'];
        const statuses = ['Active', 'Inactive', 'Pending'];
        const industries = ['Technology', 'Manufacturing', 'Retail', 'Healthcare', 'Finance'];
        const countries = ['US', 'UK', 'Canada', 'Germany', 'France', 'Japan', 'Australia'];

        return Array.from({ length: 40 }, (_, index) => ({
            id: `company-${index + 1}`,
            name: `Company ${index + 1}`,
            type: companyTypes[Math.floor(Math.random() * companyTypes.length)],
            status: statuses[Math.floor(Math.random() * statuses.length)],
            industry: industries[Math.floor(Math.random() * industries.length)],
            country: countries[Math.floor(Math.random() * countries.length)],
            createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000),
            updatedAt: new Date()
        }));
    };

    useEffect(() => {
        const loadCompanies = async () => {
            try {
                // Simulate loading with random data
                const randomCompanies = generateRandomCompanies();
                setCompanies(randomCompanies);
                setLoading(false);
            } catch (err) {
                console.error('Error loading companies:', err);
                setError('Failed to load companies');
                setLoading(false);
            }
        };

        loadCompanies();
    }, []);

    const handleActionsClick = (event, company) => {
        setAnchorEl(event.currentTarget);
        setSelectedCompany(company);
    };

    const handleActionsClose = () => {
        setAnchorEl(null);
        setSelectedCompany(null);
    };

    const handleFilterClick = (event) => {
        setFilterAnchorEl(event.currentTarget);
    };

    const handleSortClick = (event) => {
        setSortAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setFilterAnchorEl(null);
        setSortAnchorEl(null);
    };

    const handleViewCompany = () => {
        if (selectedCompany) {
            navigate(`/admin/companies/${selectedCompany.id}`);
            handleActionsClose();
        }
    };

    const handleEditCompany = () => {
        if (selectedCompany) {
            navigate(`/admin/companies/${selectedCompany.id}/edit`);
            handleActionsClose();
        }
    };

    const handleDeleteCompany = () => {
        if (selectedCompany) {
            // Implement delete functionality
            console.log('Delete company:', selectedCompany.id);
            handleActionsClose();
        }
    };

    const filteredCompanies = companies.filter(company => {
        const matchesSearch = company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            company.type.toLowerCase().includes(searchTerm.toLowerCase()) ||
            company.industry.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = filterStatus === 'all' || company.status === filterStatus;
        const matchesType = filterType === 'all' || company.type === filterType;

        return matchesSearch && matchesStatus && matchesType;
    });

    const sortedCompanies = [...filteredCompanies].sort((a, b) => {
        switch (sortBy) {
            case 'name':
                return a.name.localeCompare(b.name);
            case 'type':
                return a.type.localeCompare(b.type);
            case 'status':
                return a.status.localeCompare(b.status);
            case 'industry':
                return a.industry.localeCompare(b.industry);
            case 'country':
                return a.country.localeCompare(b.country);
            case 'createdAt':
                return b.createdAt - a.createdAt;
            default:
                return 0;
        }
    });

    const getStatusColor = (status) => {
        switch (status) {
            case 'Active':
                return { color: '#0a875a', bgcolor: '#f1f8f5' };
            case 'Inactive':
                return { color: '#637381', bgcolor: '#f9fafb' };
            case 'Pending':
                return { color: '#f59e0b', bgcolor: '#fff7ed' };
            default:
                return { color: '#637381', bgcolor: '#f9fafb' };
        }
    };

    return (
        <Box className="admin-companies">
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Companies
                </Typography>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                    Manage your company profiles and relationships
                </Typography>
            </Box>

            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                    <TextField
                        fullWidth
                        placeholder="Search companies..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon />
                                </InputAdornment>
                            ),
                        }}
                    />
                </Grid>
                <Grid item xs={12} md={8}>
                    <Stack direction="row" spacing={2} justifyContent="flex-end">
                        <Button
                            variant="outlined"
                            startIcon={<FilterIcon />}
                            onClick={handleFilterClick}
                        >
                            Filters
                        </Button>
                        <Button
                            variant="outlined"
                            startIcon={<SortIcon />}
                            onClick={handleSortClick}
                        >
                            Sort
                        </Button>
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={() => navigate('/admin/companies/new')}
                        >
                            Add Company
                        </Button>
                    </Stack>
                </Grid>
            </Grid>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Company Name</TableCell>
                            <TableCell>Type</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Industry</TableCell>
                            <TableCell>Country</TableCell>
                            <TableCell>Created At</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {sortedCompanies.map((company) => (
                            <TableRow key={company.id}>
                                <TableCell>{company.name}</TableCell>
                                <TableCell>{company.type}</TableCell>
                                <TableCell>
                                    <Chip
                                        label={company.status}
                                        sx={{
                                            backgroundColor: getStatusColor(company.status).bgcolor,
                                            color: getStatusColor(company.status).color,
                                            fontWeight: 500,
                                            '& .MuiChip-label': { px: 1.5 }
                                        }}
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell>{company.industry}</TableCell>
                                <TableCell>{company.country}</TableCell>
                                <TableCell>
                                    {format(company.createdAt, 'MMM d, yyyy')}
                                </TableCell>
                                <TableCell>
                                    <IconButton
                                        size="small"
                                        onClick={(e) => handleActionsClick(e, company)}
                                    >
                                        <MoreVertIcon />
                                    </IconButton>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Actions Menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleActionsClose}
            >
                <MenuItem onClick={handleViewCompany}>
                    <ListItemIcon>
                        <ViewIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>View Details</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleEditCompany}>
                    <ListItemIcon>
                        <EditIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Edit Company</ListItemText>
                </MenuItem>
                <MenuItem onClick={handleDeleteCompany}>
                    <ListItemIcon>
                        <DeleteIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Delete Company</ListItemText>
                </MenuItem>
            </Menu>

            {/* Filter Menu */}
            <Menu
                anchorEl={filterAnchorEl}
                open={Boolean(filterAnchorEl)}
                onClose={handleMenuClose}
            >
                <MenuItem>
                    <FormControl fullWidth>
                        <InputLabel>Status</InputLabel>
                        <Select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            label="Status"
                        >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="Active">Active</MenuItem>
                            <MenuItem value="Inactive">Inactive</MenuItem>
                            <MenuItem value="Pending">Pending</MenuItem>
                        </Select>
                    </FormControl>
                </MenuItem>
                <MenuItem>
                    <FormControl fullWidth>
                        <InputLabel>Type</InputLabel>
                        <Select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            label="Type"
                        >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="Customer">Customer</MenuItem>
                            <MenuItem value="Vendor">Vendor</MenuItem>
                            <MenuItem value="Partner">Partner</MenuItem>
                            <MenuItem value="Carrier">Carrier</MenuItem>
                        </Select>
                    </FormControl>
                </MenuItem>
            </Menu>

            {/* Sort Menu */}
            <Menu
                anchorEl={sortAnchorEl}
                open={Boolean(sortAnchorEl)}
                onClose={handleMenuClose}
            >
                <MenuItem onClick={() => { setSortBy('name'); handleMenuClose(); }}>
                    Name
                </MenuItem>
                <MenuItem onClick={() => { setSortBy('type'); handleMenuClose(); }}>
                    Type
                </MenuItem>
                <MenuItem onClick={() => { setSortBy('status'); handleMenuClose(); }}>
                    Status
                </MenuItem>
                <MenuItem onClick={() => { setSortBy('industry'); handleMenuClose(); }}>
                    Industry
                </MenuItem>
                <MenuItem onClick={() => { setSortBy('country'); handleMenuClose(); }}>
                    Country
                </MenuItem>
                <MenuItem onClick={() => { setSortBy('createdAt'); handleMenuClose(); }}>
                    Created Date
                </MenuItem>
            </Menu>
        </Box>
    );
};

export default CompanyList; 