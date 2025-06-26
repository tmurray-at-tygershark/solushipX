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
    Button,
    IconButton,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Autocomplete,
    Switch,
    FormControlLabel,
    Divider,
    Alert,
    CircularProgress,
    Tooltip
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Business as BusinessIcon,
    Group as GroupIcon,
    Email as EmailIcon,
    Phone as PhoneIcon,
    Money as MoneyIcon,
    Search as SearchIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { httpsCallable } from 'firebase/functions';
import { collection, getDocs } from 'firebase/firestore';
import { db, functions } from '../../../../firebase/firebase';

const SalesPersonsManagement = ({ salesPersons: propSalesPersons, salesTeams: propSalesTeams, onDataRefresh }) => {
    const { enqueueSnackbar } = useSnackbar();

    // Cloud function references
    const getSalesPersons = httpsCallable(functions, 'getSalesPersons');
    const createSalesPerson = httpsCallable(functions, 'createSalesPerson');
    const updateSalesPerson = httpsCallable(functions, 'updateSalesPerson');
    const deleteSalesPerson = httpsCallable(functions, 'deleteSalesPerson');

    // State
    const [dialogOpen, setDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [editingPerson, setEditingPerson] = useState(null);
    const [deletingPerson, setDeletingPerson] = useState(null);
    const [loading, setLoading] = useState(false);
    const [companies, setCompanies] = useState([]);
    const [salesPersons, setSalesPersons] = useState([]);
    const [salesTeams, setSalesTeams] = useState([]);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        // Personal Information
        firstName: '',
        lastName: '',
        title: '',
        employeeId: '',
        hireDate: '',

        // Contact Information
        email: '',
        phone: '',
        mobile: '',
        workPhone: '',

        // Address Information
        address: {
            street: '',
            addressLine2: '',
            city: '',
            state: '',
            postalCode: '',
            country: 'US'
        },

        // Emergency Contact
        emergencyContact: {
            name: '',
            relationship: '',
            phone: '',
            email: ''
        },

        // Professional Information
        department: '',
        territory: '',
        manager: '',
        notes: '',

        // System Information
        assignedCompanies: [],
        active: true,
        commissionSettings: {
            ltlGrossPercent: 0,
            ltlNetPercent: 0,
            courierGrossPercent: 0,
            courierNetPercent: 0,
            servicesGrossPercent: 0,
            servicesNetPercent: 0
        }
    });

    // Additional state for search and filtering
    const [searchTerm, setSearchTerm] = useState('');
    const [filteredSalesPersons, setFilteredSalesPersons] = useState([]);
    const [filters, setFilters] = useState({
        status: 'all', // all, active, inactive
        salesTeam: 'all'
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    // Load data on component mount
    useEffect(() => {
        loadCompanies();

        // Only load sales persons if not provided by parent
        if (propSalesPersons) {
            setSalesPersons(propSalesPersons);
        } else {
            loadSalesPersons();
        }

        // Set sales teams from props
        if (propSalesTeams) {
            setSalesTeams(propSalesTeams);
        }
    }, [propSalesPersons, propSalesTeams]);

    // Update local state when props change
    useEffect(() => {
        if (propSalesPersons) {
            setSalesPersons(propSalesPersons);
        }
    }, [propSalesPersons]);

    useEffect(() => {
        if (propSalesTeams) {
            setSalesTeams(propSalesTeams);
        }
    }, [propSalesTeams]);

    // Load companies
    const loadCompanies = async () => {
        try {
            const companiesSnapshot = await getDocs(collection(db, 'companies'));
            const companiesData = companiesSnapshot.docs.map(doc => ({
                id: doc.id,
                name: doc.data().companyName || doc.data().name || 'Unknown Company',
                ...doc.data()
            }));
            setCompanies(companiesData);
        } catch (error) {
            console.error('Error loading companies:', error);
        }
    };

    // Load sales persons
    const loadSalesPersons = async () => {
        try {
            setLoading(true);
            setError('');

            const result = await getSalesPersons({ filters: {}, limit: 100 });

            // Handle response format
            if (result.data && result.data.success) {
                setSalesPersons(result.data.data.salesPersons || []);
            } else if (result.data && result.data.data) {
                setSalesPersons(result.data.data.salesPersons || []);
            } else {
                setSalesPersons([]);
            }

        } catch (error) {
            console.error('Error loading sales persons:', error);

            // Set empty array for graceful degradation
            setSalesPersons([]);

            // Only show error if it's not just empty collections
            if (!error.message.includes('empty') &&
                !error.message.includes('No') &&
                error.code !== 'not-found') {
                setError('Failed to load sales persons. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    // Handle form input changes
    const handleInputChange = (field, value) => {
        if (field.startsWith('commission.')) {
            const commissionField = field.replace('commission.', '');
            setFormData(prev => ({
                ...prev,
                commissionSettings: {
                    ...prev.commissionSettings,
                    [commissionField]: parseFloat(value) || 0
                }
            }));
        } else if (field.startsWith('address.')) {
            const addressField = field.replace('address.', '');
            setFormData(prev => ({
                ...prev,
                address: {
                    ...prev.address,
                    [addressField]: value
                }
            }));
        } else if (field.startsWith('emergencyContact.')) {
            const emergencyField = field.replace('emergencyContact.', '');
            setFormData(prev => ({
                ...prev,
                emergencyContact: {
                    ...prev.emergencyContact,
                    [emergencyField]: value
                }
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [field]: value
            }));
        }
    };

    // Open dialog for new person
    const handleAddPerson = () => {
        setEditingPerson(null);
        setFormData({
            // Personal Information
            firstName: '',
            lastName: '',
            title: '',
            employeeId: '',
            hireDate: '',

            // Contact Information
            email: '',
            phone: '',
            mobile: '',
            workPhone: '',

            // Address Information
            address: {
                street: '',
                addressLine2: '',
                city: '',
                state: '',
                postalCode: '',
                country: 'US'
            },

            // Emergency Contact
            emergencyContact: {
                name: '',
                relationship: '',
                phone: '',
                email: ''
            },

            // Professional Information
            department: '',
            territory: '',
            manager: '',
            notes: '',

            // System Information
            assignedCompanies: [],
            active: true,
            commissionSettings: {
                ltlGrossPercent: 0,
                ltlNetPercent: 0,
                courierGrossPercent: 0,
                courierNetPercent: 0,
                servicesGrossPercent: 0,
                servicesNetPercent: 0
            }
        });
        setDialogOpen(true);
    };

    // Open dialog for editing person
    const handleEditPerson = (person) => {
        setEditingPerson(person);
        setFormData({
            // Personal Information
            firstName: person.firstName || '',
            lastName: person.lastName || '',
            title: person.title || '',
            employeeId: person.employeeId || '',
            hireDate: person.hireDate || '',

            // Contact Information
            email: person.email || '',
            phone: person.phone || '',
            mobile: person.mobile || '',
            workPhone: person.workPhone || '',

            // Address Information
            address: {
                street: person.address?.street || '',
                addressLine2: person.address?.addressLine2 || '',
                city: person.address?.city || '',
                state: person.address?.state || '',
                postalCode: person.address?.postalCode || '',
                country: person.address?.country || 'US'
            },

            // Emergency Contact
            emergencyContact: {
                name: person.emergencyContact?.name || '',
                relationship: person.emergencyContact?.relationship || '',
                phone: person.emergencyContact?.phone || '',
                email: person.emergencyContact?.email || ''
            },

            // Professional Information
            department: person.department || '',
            territory: person.territory || '',
            manager: person.manager || '',
            notes: person.notes || '',

            // System Information
            assignedCompanies: person.assignedCompanies || [],
            active: person.active !== false,
            commissionSettings: {
                ltlGrossPercent: person.commissionSettings?.ltlGrossPercent || 0,
                ltlNetPercent: person.commissionSettings?.ltlNetPercent || 0,
                courierGrossPercent: person.commissionSettings?.courierGrossPercent || 0,
                courierNetPercent: person.commissionSettings?.courierNetPercent || 0,
                servicesGrossPercent: person.commissionSettings?.servicesGrossPercent || 0,
                servicesNetPercent: person.commissionSettings?.servicesNetPercent || 0
            }
        });
        setDialogOpen(true);
    };

    // Handle save (create or update)
    const handleSave = async () => {
        try {
            setLoading(true);

            if (!formData.firstName?.trim() || !formData.lastName?.trim() || !formData.email?.trim()) {
                enqueueSnackbar('Please fill in all required fields', { variant: 'error' });
                return;
            }

            if (editingPerson) {
                // Update existing person
                await updateSalesPerson({
                    salesPersonId: editingPerson.id,
                    updateData: formData
                });
                enqueueSnackbar('Sales person updated successfully', { variant: 'success' });
            } else {
                // Create new person
                await createSalesPerson(formData);
                enqueueSnackbar('Sales person created successfully', { variant: 'success' });
            }

            setDialogOpen(false);
            loadSalesPersons();
            if (onDataRefresh) onDataRefresh();

        } catch (error) {
            console.error('Error saving sales person:', error);
            enqueueSnackbar('Error saving sales person: ' + error.message, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Handle delete
    const handleDelete = async () => {
        try {
            setLoading(true);

            await deleteSalesPerson({ salesPersonId: deletingPerson.id });

            enqueueSnackbar('Sales person deleted successfully', { variant: 'success' });
            setDeleteDialogOpen(false);
            setDeletingPerson(null);
            loadSalesPersons();
            if (onDataRefresh) onDataRefresh();

        } catch (error) {
            console.error('Error deleting sales person:', error);
            enqueueSnackbar('Error deleting sales person: ' + error.message, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Get company names for display
    const getCompanyNames = (companyIds) => {
        if (!companyIds || companyIds.length === 0) return 'None';
        return companyIds.map(item => {
            // Handle both object format {id: companyId} and direct string IDs
            const companyId = typeof item === 'object' ? (item.id || item.companyId) : item;
            const company = companies.find(c => c.id === companyId);
            return company ? company.name : companyId;
        }).join(', ');
    };

    // Get sales team name for a person
    const getSalesTeamName = (personId) => {
        const team = salesTeams.find(team =>
            team.teamMembers && team.teamMembers.includes(personId)
        );
        return team ? team.teamName : null;
    };

    // Get unique sales teams for filter options
    const getAvailableSalesTeams = () => {
        return salesTeams.filter(team => team.teamName).sort((a, b) => a.teamName.localeCompare(b.teamName));
    };

    // Filter and search logic
    useEffect(() => {
        let filtered = [...salesPersons];

        // Apply search term
        if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            filtered = filtered.filter(person => {
                const salesTeamName = getSalesTeamName(person.id);
                return `${person.firstName} ${person.lastName}`.toLowerCase().includes(searchLower) ||
                    person.email.toLowerCase().includes(searchLower) ||
                    person.phone?.toLowerCase().includes(searchLower) ||
                    person.mobile?.toLowerCase().includes(searchLower) ||
                    person.employeeId?.toLowerCase().includes(searchLower) ||
                    person.title?.toLowerCase().includes(searchLower) ||
                    person.manager?.toLowerCase().includes(searchLower) ||
                    salesTeamName?.toLowerCase().includes(searchLower);
            });
        }

        // Apply status filter
        if (filters.status !== 'all') {
            filtered = filtered.filter(person =>
                filters.status === 'active' ? person.active !== false : person.active === false
            );
        }

        // Apply sales team filter
        if (filters.salesTeam !== 'all') {
            filtered = filtered.filter(person => {
                const team = salesTeams.find(team => team.id === filters.salesTeam);
                return team && team.teamMembers && team.teamMembers.includes(person.id);
            });
        }

        setFilteredSalesPersons(filtered);
        setCurrentPage(1); // Reset to first page when filters change
    }, [salesPersons, salesTeams, searchTerm, filters]);

    // Pagination logic
    const getPaginatedData = () => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        return filteredSalesPersons.slice(startIndex, endIndex);
    };

    const totalPages = Math.ceil(filteredSalesPersons.length / rowsPerPage);

    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
    };

    const handleRowsPerPageChange = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setCurrentPage(1);
    };

    const clearFilters = () => {
        setSearchTerm('');
        setFilters({
            status: 'all',
            salesTeam: 'all'
        });
    };

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                    Sales Representatives ({filteredSalesPersons.length} of {salesPersons.length})
                </Typography>
                <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddPerson}
                    sx={{ fontSize: '12px' }}
                >
                    Add Sales Person
                </Button>
            </Box>

            {/* Search and Filters */}
            <Paper sx={{ p: 2, mb: 2, border: '1px solid #e5e7eb' }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={4}>
                        <TextField
                            fullWidth
                            placeholder="Search by name, email, phone, title, sales team..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            size="small"
                            InputProps={{
                                startAdornment: (
                                    <Box sx={{ mr: 1, display: 'flex', alignItems: 'center' }}>
                                        <IconButton size="small" disabled>
                                            <SearchIcon sx={{ fontSize: 16, color: '#6b7280' }} />
                                        </IconButton>
                                    </Box>
                                ),
                                sx: { fontSize: '12px' }
                            }}
                            sx={{
                                '& .MuiOutlinedInput-root': {
                                    backgroundColor: '#f9fafb'
                                }
                            }}
                        />
                    </Grid>

                    <Grid item xs={12} md={2}>
                        <FormControl fullWidth size="small">
                            <InputLabel sx={{ fontSize: '12px' }}>Status</InputLabel>
                            <Select
                                value={filters.status}
                                label="Status"
                                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                sx={{ fontSize: '12px' }}
                            >
                                <MenuItem value="all" sx={{ fontSize: '12px' }}>All Status</MenuItem>
                                <MenuItem value="active" sx={{ fontSize: '12px' }}>Active</MenuItem>
                                <MenuItem value="inactive" sx={{ fontSize: '12px' }}>Inactive</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={2}>
                        <FormControl fullWidth size="small">
                            <InputLabel sx={{ fontSize: '12px' }}>Sales Team</InputLabel>
                            <Select
                                value={filters.salesTeam}
                                label="Sales Team"
                                onChange={(e) => setFilters({ ...filters, salesTeam: e.target.value })}
                                sx={{ fontSize: '12px' }}
                            >
                                <MenuItem value="all" sx={{ fontSize: '12px' }}>All Teams</MenuItem>
                                {getAvailableSalesTeams().map(team => (
                                    <MenuItem key={team.id} value={team.id} sx={{ fontSize: '12px' }}>
                                        {team.teamName}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={2}>
                        <Button
                            variant="outlined"
                            size="small"
                            onClick={clearFilters}
                            disabled={searchTerm === '' && filters.status === 'all' && filters.salesTeam === 'all'}
                            sx={{ fontSize: '12px', width: '100%' }}
                        >
                            Clear Filters
                        </Button>
                    </Grid>
                </Grid>

                {/* Filter Summary */}
                {(searchTerm || filters.status !== 'all' || filters.salesTeam !== 'all') && (
                    <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                        {searchTerm && (
                            <Chip
                                label={`Search: "${searchTerm}"`}
                                size="small"
                                onDelete={() => setSearchTerm('')}
                                sx={{ fontSize: '11px' }}
                            />
                        )}
                        {filters.status !== 'all' && (
                            <Chip
                                label={`Status: ${filters.status}`}
                                size="small"
                                onDelete={() => setFilters({ ...filters, status: 'all' })}
                                sx={{ fontSize: '11px' }}
                            />
                        )}
                        {filters.salesTeam !== 'all' && (
                            <Chip
                                label={`Sales Team: ${filters.salesTeam}`}
                                size="small"
                                onDelete={() => setFilters({ ...filters, salesTeam: 'all' })}
                                sx={{ fontSize: '11px' }}
                            />
                        )}
                    </Box>
                )}
            </Paper>

            {/* Sales Persons Table */}
            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                <Table>
                    <TableHead>
                        <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                Name & Title
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                Contact Information
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                Address
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                Sales Team
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                Assigned Companies
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                Commission Rates
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                Status
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                Actions
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {getPaginatedData().map((person) => (
                            <TableRow key={person.id} hover>
                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                    <Box>
                                        <Typography sx={{ fontWeight: 600, fontSize: '12px' }}>
                                            {person.firstName} {person.lastName}
                                        </Typography>
                                        {person.title && (
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                {person.title}
                                            </Typography>
                                        )}
                                        <Typography sx={{ fontSize: '10px', color: '#9ca3af' }}>
                                            ID: {person.employeeId || person.id}
                                        </Typography>
                                    </Box>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                    <Box>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                            <EmailIcon sx={{ fontSize: 14, mr: 0.5, color: '#6b7280' }} />
                                            <Typography sx={{ fontSize: '11px' }}>
                                                {person.email}
                                            </Typography>
                                        </Box>
                                        {person.phone && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                                <PhoneIcon sx={{ fontSize: 14, mr: 0.5, color: '#6b7280' }} />
                                                <Typography sx={{ fontSize: '11px' }}>
                                                    {person.phone}
                                                </Typography>
                                            </Box>
                                        )}
                                        {person.mobile && (
                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                                <PhoneIcon sx={{ fontSize: 14, mr: 0.5, color: '#10b981' }} />
                                                <Typography sx={{ fontSize: '11px' }}>
                                                    M: {person.mobile}
                                                </Typography>
                                            </Box>
                                        )}
                                        {person.workPhone && (
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                <PhoneIcon sx={{ fontSize: 14, mr: 0.5, color: '#3b82f6' }} />
                                                <Typography sx={{ fontSize: '11px' }}>
                                                    W: {person.workPhone}
                                                </Typography>
                                            </Box>
                                        )}
                                    </Box>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                    <Box>
                                        {person.address?.street && (
                                            <Typography sx={{ fontSize: '11px' }}>
                                                {person.address.street}
                                            </Typography>
                                        )}
                                        {(person.address?.city || person.address?.state) && (
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                {person.address.city}{person.address.city && person.address.state ? ', ' : ''}{person.address.state}
                                            </Typography>
                                        )}
                                        {person.address?.postalCode && (
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                {person.address.postalCode}
                                            </Typography>
                                        )}
                                    </Box>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                    <Box>
                                        {getSalesTeamName(person.id) ? (
                                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                                                <GroupIcon sx={{ fontSize: 14, mr: 0.5, color: '#1c277d' }} />
                                                <Typography sx={{ fontSize: '11px' }}>
                                                    {getSalesTeamName(person.id)}
                                                </Typography>
                                            </Box>
                                        ) : (
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280', fontStyle: 'italic' }}>
                                                No team assigned
                                            </Typography>
                                        )}
                                        {person.manager && (
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                Manager: {person.manager}
                                            </Typography>
                                        )}
                                    </Box>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                    <Tooltip title={getCompanyNames(person.assignedCompanies)}>
                                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                            <BusinessIcon sx={{ fontSize: 14, mr: 0.5, color: '#6b7280' }} />
                                            <Typography sx={{ fontSize: '11px', maxWidth: 150 }} noWrap>
                                                {getCompanyNames(person.assignedCompanies)}
                                            </Typography>
                                        </Box>
                                    </Tooltip>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                    <Box>
                                        <Typography sx={{ fontSize: '11px' }}>
                                            LTL: {person.commissionSettings?.ltlGrossPercent || 0}%
                                        </Typography>
                                        <Typography sx={{ fontSize: '11px' }}>
                                            Courier: {person.commissionSettings?.courierGrossPercent || 0}%
                                        </Typography>
                                        <Typography sx={{ fontSize: '11px' }}>
                                            Services: {person.commissionSettings?.servicesGrossPercent || 0}%
                                        </Typography>
                                    </Box>
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                    <Chip
                                        label={person.active !== false ? 'Active' : 'Inactive'}
                                        color={person.active !== false ? 'success' : 'default'}
                                        size="small"
                                        sx={{ fontSize: '11px' }}
                                    />
                                </TableCell>
                                <TableCell sx={{ fontSize: '12px', verticalAlign: 'top' }}>
                                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                                        <Tooltip title="Edit">
                                            <IconButton
                                                size="small"
                                                onClick={() => handleEditPerson(person)}
                                            >
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton
                                                size="small"
                                                color="error"
                                                onClick={() => {
                                                    setDeletingPerson(person);
                                                    setDeleteDialogOpen(true);
                                                }}
                                            >
                                                <DeleteIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ))}
                        {getPaginatedData().length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} sx={{ textAlign: 'center', py: 4 }}>
                                    <Typography sx={{ color: '#6b7280', fontSize: '12px' }}>
                                        {salesPersons.length === 0
                                            ? 'No sales persons found. Click "Add Sales Person" to get started.'
                                            : filteredSalesPersons.length === 0
                                                ? 'No sales persons match the current filters. Try adjusting your search criteria.'
                                                : 'No results on this page.'
                                        }
                                    </Typography>
                                    {filteredSalesPersons.length === 0 && salesPersons.length > 0 && (
                                        <Button
                                            variant="text"
                                            size="small"
                                            onClick={clearFilters}
                                            sx={{ fontSize: '12px', mt: 1 }}
                                        >
                                            Clear All Filters
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Pagination Controls */}
            {filteredSalesPersons.length > 0 && (
                <Paper sx={{ p: 2, mt: 2, border: '1px solid #e5e7eb' }}>
                    <Grid container spacing={2} alignItems="center" justifyContent="space-between">
                        <Grid item>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, filteredSalesPersons.length)} of {filteredSalesPersons.length} results
                            </Typography>
                        </Grid>

                        <Grid item>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <FormControl size="small">
                                    <InputLabel sx={{ fontSize: '12px' }}>Rows</InputLabel>
                                    <Select
                                        value={rowsPerPage}
                                        label="Rows"
                                        onChange={handleRowsPerPageChange}
                                        sx={{ fontSize: '12px', minWidth: 80 }}
                                    >
                                        <MenuItem value={10} sx={{ fontSize: '12px' }}>10</MenuItem>
                                        <MenuItem value={25} sx={{ fontSize: '12px' }}>25</MenuItem>
                                        <MenuItem value={50} sx={{ fontSize: '12px' }}>50</MenuItem>
                                        <MenuItem value={100} sx={{ fontSize: '12px' }}>100</MenuItem>
                                    </Select>
                                </FormControl>

                                <Box sx={{ display: 'flex', gap: 1 }}>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        disabled={currentPage === 1}
                                        onClick={() => handlePageChange(1)}
                                        sx={{ fontSize: '11px', minWidth: 'auto', px: 1 }}
                                    >
                                        First
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        disabled={currentPage === 1}
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        sx={{ fontSize: '11px', minWidth: 'auto', px: 1 }}
                                    >
                                        Prev
                                    </Button>

                                    <Typography sx={{
                                        fontSize: '12px',
                                        alignSelf: 'center',
                                        px: 2,
                                        py: 1,
                                        backgroundColor: '#f3f4f6',
                                        borderRadius: 1,
                                        minWidth: 60,
                                        textAlign: 'center'
                                    }}>
                                        {currentPage} of {totalPages}
                                    </Typography>

                                    <Button
                                        size="small"
                                        variant="outlined"
                                        disabled={currentPage === totalPages}
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        sx={{ fontSize: '11px', minWidth: 'auto', px: 1 }}
                                    >
                                        Next
                                    </Button>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        disabled={currentPage === totalPages}
                                        onClick={() => handlePageChange(totalPages)}
                                        sx={{ fontSize: '11px', minWidth: 'auto', px: 1 }}
                                    >
                                        Last
                                    </Button>
                                </Box>
                            </Box>
                        </Grid>
                    </Grid>
                </Paper>
            )}

            {/* Add/Edit Dialog */}
            <Dialog
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px'
                    }
                }}
            >
                <DialogTitle sx={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#374151',
                    pb: 1,
                    borderBottom: '1px solid #e5e7eb'
                }}>
                    {editingPerson ? 'Edit Sales Person' : 'Add New Sales Person'}
                </DialogTitle>
                <DialogContent sx={{ pt: 3 }}>
                    <Grid container spacing={2}>
                        {/* Personal Information */}
                        <Grid item xs={12}>
                            <Box sx={{ mb: 2, borderBottom: '1px solid #f3f4f6', pb: 1 }}>
                                <Typography sx={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: '#6b7280',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    Personal Information
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="First Name *"
                                value={formData.firstName}
                                onChange={(e) => handleInputChange('firstName', e.target.value)}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Last Name *"
                                value={formData.lastName}
                                onChange={(e) => handleInputChange('lastName', e.target.value)}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Title"
                                value={formData.title}
                                onChange={(e) => handleInputChange('title', e.target.value)}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Employee ID"
                                value={formData.employeeId}
                                onChange={(e) => handleInputChange('employeeId', e.target.value)}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                type="date"
                                label="Hire Date"
                                value={formData.hireDate}
                                onChange={(e) => handleInputChange('hireDate', e.target.value)}
                                InputLabelProps={{
                                    sx: { fontSize: '12px' },
                                    shrink: true
                                }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>

                        {/* Contact Information */}
                        <Grid item xs={12} sx={{ mt: 2 }}>
                            <Box sx={{ mb: 2, borderBottom: '1px solid #f3f4f6', pb: 1 }}>
                                <Typography sx={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: '#6b7280',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    Contact Information
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                type="email"
                                label="Email *"
                                value={formData.email}
                                onChange={(e) => handleInputChange('email', e.target.value)}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Phone"
                                value={formData.phone}
                                onChange={(e) => handleInputChange('phone', e.target.value)}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Mobile"
                                value={formData.mobile}
                                onChange={(e) => handleInputChange('mobile', e.target.value)}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Work Phone"
                                value={formData.workPhone}
                                onChange={(e) => handleInputChange('workPhone', e.target.value)}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>

                        {/* Address Information */}
                        <Grid item xs={12} sx={{ mt: 2 }}>
                            <Box sx={{ mb: 2, borderBottom: '1px solid #f3f4f6', pb: 1 }}>
                                <Typography sx={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: '#6b7280',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    Address Information
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Street Address"
                                value={formData.address.street}
                                onChange={(e) => handleInputChange('address.street', e.target.value)}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Address Line 2"
                                value={formData.address.addressLine2}
                                onChange={(e) => handleInputChange('address.addressLine2', e.target.value)}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="City"
                                value={formData.address.city}
                                onChange={(e) => handleInputChange('address.city', e.target.value)}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Country</InputLabel>
                                <Select
                                    value={formData.address.country}
                                    label="Country"
                                    onChange={(e) => {
                                        handleInputChange('address.country', e.target.value);
                                        // Reset state when country changes
                                        if (e.target.value !== formData.address.country) {
                                            handleInputChange('address.state', '');
                                        }
                                    }}
                                    sx={{ fontSize: '12px' }}
                                >
                                    <MenuItem value="US" sx={{ fontSize: '12px' }}>United States</MenuItem>
                                    <MenuItem value="CA" sx={{ fontSize: '12px' }}>Canada</MenuItem>
                                    <MenuItem value="MX" sx={{ fontSize: '12px' }}>Mexico</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>
                                    {formData.address.country === 'CA' ? 'Province' : 'State'}
                                </InputLabel>
                                <Select
                                    value={formData.address.state}
                                    label={formData.address.country === 'CA' ? 'Province' : 'State'}
                                    onChange={(e) => handleInputChange('address.state', e.target.value)}
                                    sx={{ fontSize: '12px' }}
                                >
                                    {formData.address.country === 'CA' ? (
                                        // Canadian Provinces
                                        <>
                                            <MenuItem value="AB" sx={{ fontSize: '12px' }}>Alberta</MenuItem>
                                            <MenuItem value="BC" sx={{ fontSize: '12px' }}>British Columbia</MenuItem>
                                            <MenuItem value="MB" sx={{ fontSize: '12px' }}>Manitoba</MenuItem>
                                            <MenuItem value="NB" sx={{ fontSize: '12px' }}>New Brunswick</MenuItem>
                                            <MenuItem value="NL" sx={{ fontSize: '12px' }}>Newfoundland and Labrador</MenuItem>
                                            <MenuItem value="NS" sx={{ fontSize: '12px' }}>Nova Scotia</MenuItem>
                                            <MenuItem value="ON" sx={{ fontSize: '12px' }}>Ontario</MenuItem>
                                            <MenuItem value="PE" sx={{ fontSize: '12px' }}>Prince Edward Island</MenuItem>
                                            <MenuItem value="QC" sx={{ fontSize: '12px' }}>Quebec</MenuItem>
                                            <MenuItem value="SK" sx={{ fontSize: '12px' }}>Saskatchewan</MenuItem>
                                            <MenuItem value="NT" sx={{ fontSize: '12px' }}>Northwest Territories</MenuItem>
                                            <MenuItem value="NU" sx={{ fontSize: '12px' }}>Nunavut</MenuItem>
                                            <MenuItem value="YT" sx={{ fontSize: '12px' }}>Yukon</MenuItem>
                                        </>
                                    ) : formData.address.country === 'MX' ? (
                                        // Mexican States (sample)
                                        <>
                                            <MenuItem value="AGU" sx={{ fontSize: '12px' }}>Aguascalientes</MenuItem>
                                            <MenuItem value="BCN" sx={{ fontSize: '12px' }}>Baja California</MenuItem>
                                            <MenuItem value="BCS" sx={{ fontSize: '12px' }}>Baja California Sur</MenuItem>
                                            <MenuItem value="CAM" sx={{ fontSize: '12px' }}>Campeche</MenuItem>
                                            <MenuItem value="CHP" sx={{ fontSize: '12px' }}>Chiapas</MenuItem>
                                            <MenuItem value="CHH" sx={{ fontSize: '12px' }}>Chihuahua</MenuItem>
                                            <MenuItem value="CMX" sx={{ fontSize: '12px' }}>Ciudad de México</MenuItem>
                                            <MenuItem value="COA" sx={{ fontSize: '12px' }}>Coahuila</MenuItem>
                                        </>
                                    ) : (
                                        // US States
                                        <>
                                            <MenuItem value="AL" sx={{ fontSize: '12px' }}>Alabama</MenuItem>
                                            <MenuItem value="AK" sx={{ fontSize: '12px' }}>Alaska</MenuItem>
                                            <MenuItem value="AZ" sx={{ fontSize: '12px' }}>Arizona</MenuItem>
                                            <MenuItem value="AR" sx={{ fontSize: '12px' }}>Arkansas</MenuItem>
                                            <MenuItem value="CA" sx={{ fontSize: '12px' }}>California</MenuItem>
                                            <MenuItem value="CO" sx={{ fontSize: '12px' }}>Colorado</MenuItem>
                                            <MenuItem value="CT" sx={{ fontSize: '12px' }}>Connecticut</MenuItem>
                                            <MenuItem value="DE" sx={{ fontSize: '12px' }}>Delaware</MenuItem>
                                            <MenuItem value="FL" sx={{ fontSize: '12px' }}>Florida</MenuItem>
                                            <MenuItem value="GA" sx={{ fontSize: '12px' }}>Georgia</MenuItem>
                                            <MenuItem value="HI" sx={{ fontSize: '12px' }}>Hawaii</MenuItem>
                                            <MenuItem value="ID" sx={{ fontSize: '12px' }}>Idaho</MenuItem>
                                            <MenuItem value="IL" sx={{ fontSize: '12px' }}>Illinois</MenuItem>
                                            <MenuItem value="IN" sx={{ fontSize: '12px' }}>Indiana</MenuItem>
                                            <MenuItem value="IA" sx={{ fontSize: '12px' }}>Iowa</MenuItem>
                                            <MenuItem value="KS" sx={{ fontSize: '12px' }}>Kansas</MenuItem>
                                            <MenuItem value="KY" sx={{ fontSize: '12px' }}>Kentucky</MenuItem>
                                            <MenuItem value="LA" sx={{ fontSize: '12px' }}>Louisiana</MenuItem>
                                            <MenuItem value="ME" sx={{ fontSize: '12px' }}>Maine</MenuItem>
                                            <MenuItem value="MD" sx={{ fontSize: '12px' }}>Maryland</MenuItem>
                                            <MenuItem value="MA" sx={{ fontSize: '12px' }}>Massachusetts</MenuItem>
                                            <MenuItem value="MI" sx={{ fontSize: '12px' }}>Michigan</MenuItem>
                                            <MenuItem value="MN" sx={{ fontSize: '12px' }}>Minnesota</MenuItem>
                                            <MenuItem value="MS" sx={{ fontSize: '12px' }}>Mississippi</MenuItem>
                                            <MenuItem value="MO" sx={{ fontSize: '12px' }}>Missouri</MenuItem>
                                            <MenuItem value="MT" sx={{ fontSize: '12px' }}>Montana</MenuItem>
                                            <MenuItem value="NE" sx={{ fontSize: '12px' }}>Nebraska</MenuItem>
                                            <MenuItem value="NV" sx={{ fontSize: '12px' }}>Nevada</MenuItem>
                                            <MenuItem value="NH" sx={{ fontSize: '12px' }}>New Hampshire</MenuItem>
                                            <MenuItem value="NJ" sx={{ fontSize: '12px' }}>New Jersey</MenuItem>
                                            <MenuItem value="NM" sx={{ fontSize: '12px' }}>New Mexico</MenuItem>
                                            <MenuItem value="NY" sx={{ fontSize: '12px' }}>New York</MenuItem>
                                            <MenuItem value="NC" sx={{ fontSize: '12px' }}>North Carolina</MenuItem>
                                            <MenuItem value="ND" sx={{ fontSize: '12px' }}>North Dakota</MenuItem>
                                            <MenuItem value="OH" sx={{ fontSize: '12px' }}>Ohio</MenuItem>
                                            <MenuItem value="OK" sx={{ fontSize: '12px' }}>Oklahoma</MenuItem>
                                            <MenuItem value="OR" sx={{ fontSize: '12px' }}>Oregon</MenuItem>
                                            <MenuItem value="PA" sx={{ fontSize: '12px' }}>Pennsylvania</MenuItem>
                                            <MenuItem value="RI" sx={{ fontSize: '12px' }}>Rhode Island</MenuItem>
                                            <MenuItem value="SC" sx={{ fontSize: '12px' }}>South Carolina</MenuItem>
                                            <MenuItem value="SD" sx={{ fontSize: '12px' }}>South Dakota</MenuItem>
                                            <MenuItem value="TN" sx={{ fontSize: '12px' }}>Tennessee</MenuItem>
                                            <MenuItem value="TX" sx={{ fontSize: '12px' }}>Texas</MenuItem>
                                            <MenuItem value="UT" sx={{ fontSize: '12px' }}>Utah</MenuItem>
                                            <MenuItem value="VT" sx={{ fontSize: '12px' }}>Vermont</MenuItem>
                                            <MenuItem value="VA" sx={{ fontSize: '12px' }}>Virginia</MenuItem>
                                            <MenuItem value="WA" sx={{ fontSize: '12px' }}>Washington</MenuItem>
                                            <MenuItem value="WV" sx={{ fontSize: '12px' }}>West Virginia</MenuItem>
                                            <MenuItem value="WI" sx={{ fontSize: '12px' }}>Wisconsin</MenuItem>
                                            <MenuItem value="WY" sx={{ fontSize: '12px' }}>Wyoming</MenuItem>
                                        </>
                                    )}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Postal Code"
                                value={formData.address.postalCode}
                                onChange={(e) => handleInputChange('address.postalCode', e.target.value)}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>

                        {/* Emergency Contact */}
                        <Grid item xs={12} sx={{ mt: 2 }}>
                            <Box sx={{ mb: 2, borderBottom: '1px solid #f3f4f6', pb: 1 }}>
                                <Typography sx={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: '#6b7280',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    Emergency Contact
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Contact Name"
                                value={formData.emergencyContact.name}
                                onChange={(e) => handleInputChange('emergencyContact.name', e.target.value)}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Relationship</InputLabel>
                                <Select
                                    value={formData.emergencyContact.relationship}
                                    label="Relationship"
                                    onChange={(e) => handleInputChange('emergencyContact.relationship', e.target.value)}
                                    sx={{ fontSize: '12px' }}
                                >
                                    <MenuItem value="" sx={{ fontSize: '12px' }}>
                                        <em>Select relationship</em>
                                    </MenuItem>
                                    <MenuItem value="Spouse" sx={{ fontSize: '12px' }}>Spouse</MenuItem>
                                    <MenuItem value="Parent" sx={{ fontSize: '12px' }}>Parent</MenuItem>
                                    <MenuItem value="Child" sx={{ fontSize: '12px' }}>Child</MenuItem>
                                    <MenuItem value="Sibling" sx={{ fontSize: '12px' }}>Sibling</MenuItem>
                                    <MenuItem value="Friend" sx={{ fontSize: '12px' }}>Friend</MenuItem>
                                    <MenuItem value="Other" sx={{ fontSize: '12px' }}>Other</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Phone"
                                value={formData.emergencyContact.phone}
                                onChange={(e) => handleInputChange('emergencyContact.phone', e.target.value)}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                type="email"
                                label="Email"
                                value={formData.emergencyContact.email}
                                onChange={(e) => handleInputChange('emergencyContact.email', e.target.value)}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>

                        {/* Professional Information */}
                        <Grid item xs={12} sx={{ mt: 2 }}>
                            <Box sx={{ mb: 2, borderBottom: '1px solid #f3f4f6', pb: 1 }}>
                                <Typography sx={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: '#6b7280',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    Professional Information
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Department</InputLabel>
                                <Select
                                    value={formData.department}
                                    label="Department"
                                    onChange={(e) => handleInputChange('department', e.target.value)}
                                    sx={{ fontSize: '12px' }}
                                >
                                    <MenuItem value="" sx={{ fontSize: '12px' }}>
                                        <em>Select department</em>
                                    </MenuItem>
                                    <MenuItem value="Sales" sx={{ fontSize: '12px' }}>Sales</MenuItem>
                                    <MenuItem value="Operations" sx={{ fontSize: '12px' }}>Operations</MenuItem>
                                    <MenuItem value="Customer Service" sx={{ fontSize: '12px' }}>Customer Service</MenuItem>
                                    <MenuItem value="Logistics" sx={{ fontSize: '12px' }}>Logistics</MenuItem>
                                    <MenuItem value="Administration" sx={{ fontSize: '12px' }}>Administration</MenuItem>
                                    <MenuItem value="Finance" sx={{ fontSize: '12px' }}>Finance</MenuItem>
                                    <MenuItem value="Management" sx={{ fontSize: '12px' }}>Management</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Territory"
                                value={formData.territory}
                                onChange={(e) => handleInputChange('territory', e.target.value)}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Manager"
                                value={formData.manager}
                                onChange={(e) => handleInputChange('manager', e.target.value)}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Notes"
                                multiline
                                rows={2}
                                value={formData.notes}
                                onChange={(e) => handleInputChange('notes', e.target.value)}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>

                        {/* Company Assignment */}
                        <Grid item xs={12} sx={{ mt: 2 }}>
                            <Box sx={{ mb: 2, borderBottom: '1px solid #f3f4f6', pb: 1 }}>
                                <Typography sx={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: '#6b7280',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    Company Assignment
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={12}>
                            <Autocomplete
                                multiple
                                size="small"
                                options={companies}
                                value={formData.assignedCompanies}
                                onChange={(event, newValue) => {
                                    handleInputChange('assignedCompanies', newValue);
                                }}
                                getOptionLabel={(option) => option.companyName || option.name || ''}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Assigned Companies"
                                        placeholder="Select companies"
                                        InputLabelProps={{ sx: { fontSize: '12px' } }}
                                        InputProps={{
                                            ...params.InputProps,
                                            sx: { fontSize: '12px' }
                                        }}
                                    />
                                )}
                                renderTags={(tagValue, getTagProps) =>
                                    tagValue.map((option, index) => (
                                        <Chip
                                            {...getTagProps({ index })}
                                            key={option.id || index}
                                            label={option.companyName || option.name || ''}
                                            size="small"
                                            sx={{ fontSize: '11px' }}
                                        />
                                    ))
                                }
                                sx={{
                                    '& .MuiAutocomplete-option': {
                                        fontSize: '12px'
                                    }
                                }}
                            />
                        </Grid>

                        {/* Commission Rates */}
                        <Grid item xs={12} sx={{ mt: 2 }}>
                            <Box sx={{ mb: 2, borderBottom: '1px solid #f3f4f6', pb: 1 }}>
                                <Typography sx={{
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    color: '#6b7280',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.05em'
                                }}>
                                    Commission Rates (%)
                                </Typography>
                            </Box>
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                fullWidth
                                size="small"
                                type="number"
                                label="LTL Gross %"
                                value={formData.commissionSettings.ltlGrossPercent}
                                onChange={(e) => handleInputChange('commission.ltlGrossPercent', e.target.value)}
                                inputProps={{ min: 0, max: 100, step: 0.1 }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                fullWidth
                                size="small"
                                type="number"
                                label="Courier Gross %"
                                value={formData.commissionSettings.courierGrossPercent}
                                onChange={(e) => handleInputChange('commission.courierGrossPercent', e.target.value)}
                                inputProps={{ min: 0, max: 100, step: 0.1 }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={4}>
                            <TextField
                                fullWidth
                                size="small"
                                type="number"
                                label="Services Gross %"
                                value={formData.commissionSettings.servicesGrossPercent}
                                onChange={(e) => handleInputChange('commission.servicesGrossPercent', e.target.value)}
                                inputProps={{ min: 0, max: 100, step: 0.1 }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>

                        {/* Status */}
                        <Grid item xs={12} sx={{ mt: 2 }}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={formData.active}
                                        onChange={(e) => handleInputChange('active', e.target.checked)}
                                        size="small"
                                    />
                                }
                                label={
                                    <Typography sx={{ fontSize: '12px' }}>
                                        Active
                                    </Typography>
                                }
                            />
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ p: 3, borderTop: '1px solid #e5e7eb' }}>
                    <Button
                        onClick={() => setDialogOpen(false)}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSave}
                        variant="contained"
                        size="small"
                        disabled={loading}
                        sx={{ fontSize: '12px' }}
                    >
                        {loading ? 'Saving...' : (editingPerson ? 'Update' : 'Create')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                maxWidth="sm"
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    Delete Sales Person
                </DialogTitle>
                <DialogContent>
                    <Typography sx={{ fontSize: '12px' }}>
                        Are you sure you want to delete {deletingPerson?.firstName} {deletingPerson?.lastName}?
                        This action cannot be undone and will remove all commission history for this person.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button
                        onClick={() => setDeleteDialogOpen(false)}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDelete}
                        variant="contained"
                        color="error"
                        size="small"
                        disabled={loading}
                        sx={{ fontSize: '12px' }}
                    >
                        {loading ? <CircularProgress size={16} /> : 'Delete'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default SalesPersonsManagement; 