import React, { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Button,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    IconButton,
    Chip,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Autocomplete,
    Alert,
    CircularProgress,
    Tooltip,
    Card,
    CardContent,
    Divider
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Group as GroupIcon,
    Business as BusinessIcon,
    Person as PersonIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../firebase/firebase';

const SalesTeamsManagement = ({ salesTeams: propSalesTeams, salesPersons: propSalesPersons, onDataRefresh }) => {
    // State management
    const [teams, setTeams] = useState([]);
    const [salesPersons, setSalesPersons] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(false);
    const [openDialog, setOpenDialog] = useState(false);
    const [editingTeam, setEditingTeam] = useState(null);
    const [formData, setFormData] = useState({
        teamName: '',
        assignedCompanies: [],
        teamMembers: []
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Cloud function references
    const getSalesTeams = httpsCallable(functions, 'getSalesTeams');
    const createSalesTeam = httpsCallable(functions, 'createSalesTeam');
    const updateSalesTeam = httpsCallable(functions, 'updateSalesTeam');
    const deleteSalesTeam = httpsCallable(functions, 'deleteSalesTeam');
    const getSalesPersons = httpsCallable(functions, 'getSalesPersons');

    // Load data on component mount
    useEffect(() => {
        // Only load companies data - use props for teams and sales persons
        loadCompanies();

        // Use props if provided, otherwise load data
        if (propSalesTeams) {
            setTeams(propSalesTeams);
        } else {
            loadTeamsData();
        }

        if (propSalesPersons) {
            setSalesPersons(propSalesPersons);
        } else {
            loadSalesPersonsData();
        }
    }, [propSalesTeams, propSalesPersons]);

    // Update local state when props change
    useEffect(() => {
        if (propSalesTeams) {
            setTeams(propSalesTeams);
        }
    }, [propSalesTeams]);

    useEffect(() => {
        if (propSalesPersons) {
            setSalesPersons(propSalesPersons);
        }
    }, [propSalesPersons]);

    const loadCompanies = async () => {
        // Mock companies data - replace with actual company fetching
        setCompanies([
            { id: 'company1', name: 'Nexaya Canada Inc.' },
            { id: 'company2', name: 'Johnson Electric Motion Technology' },
            { id: 'company3', name: 'Southmedic Inc.' }
        ]);
    };

    const loadTeamsData = async () => {
        try {
            setLoading(true);
            const teamsResult = await getSalesTeams({ limit: 100 });

            if (teamsResult.data && teamsResult.data.success) {
                setTeams(teamsResult.data.data.salesTeams || []);
            } else if (teamsResult.data && teamsResult.data.data) {
                setTeams(teamsResult.data.data.salesTeams || []);
            } else {
                setTeams([]);
            }
        } catch (error) {
            console.error('Error loading teams:', error);
            setTeams([]);
        } finally {
            setLoading(false);
        }
    };

    const loadSalesPersonsData = async () => {
        try {
            const salesPersonsResult = await getSalesPersons({ filters: {}, limit: 100 });

            if (salesPersonsResult.data && salesPersonsResult.data.success) {
                setSalesPersons(salesPersonsResult.data.data.salesPersons || []);
            } else if (salesPersonsResult.data && salesPersonsResult.data.data) {
                setSalesPersons(salesPersonsResult.data.data.salesPersons || []);
            } else {
                setSalesPersons([]);
            }
        } catch (error) {
            console.error('Error loading sales persons:', error);
            setSalesPersons([]);
        }
    };

    const loadData = async () => {
        // Refresh data when needed (after create/update/delete)
        if (onDataRefresh) {
            onDataRefresh();
        } else {
            // Fallback if no parent refresh function
            if (!propSalesTeams) loadTeamsData();
            if (!propSalesPersons) loadSalesPersonsData();
        }
    };

    const handleOpenDialog = (team = null) => {
        if (team) {
            setEditingTeam(team);
            setFormData({
                teamName: team.teamName,
                assignedCompanies: team.assignedCompanies || [],
                teamMembers: team.teamMembers || []
            });
        } else {
            setEditingTeam(null);
            setFormData({
                teamName: '',
                assignedCompanies: [],
                teamMembers: []
            });
        }
        setOpenDialog(true);
        setError('');
        setSuccess('');
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setEditingTeam(null);
        setFormData({
            teamName: '',
            assignedCompanies: [],
            teamMembers: []
        });
        setError('');
        setSuccess('');
    };

    const handleSubmit = async () => {
        try {
            setError('');

            if (!formData.teamName.trim()) {
                setError('Team name is required');
                return;
            }

            const teamData = {
                teamName: formData.teamName.trim(),
                assignedCompanies: formData.assignedCompanies,
                teamMembers: formData.teamMembers
            };

            if (editingTeam) {
                await updateSalesTeam({
                    salesTeamId: editingTeam.id,
                    updateData: teamData
                });
                setSuccess('Sales team updated successfully');
            } else {
                await createSalesTeam(teamData);
                setSuccess('Sales team created successfully');
            }

            handleCloseDialog();
            loadData();

        } catch (error) {
            console.error('Error saving team:', error);
            setError(error.message || 'Failed to save team');
        }
    };

    const handleDelete = async (teamId, teamName) => {
        if (!window.confirm(`Are you sure you want to delete the team "${teamName}"? This will remove all team memberships.`)) {
            return;
        }

        try {
            await deleteSalesTeam({ salesTeamId: teamId });
            setSuccess('Sales team deleted successfully');
            loadData();
        } catch (error) {
            console.error('Error deleting team:', error);
            setError(error.message || 'Failed to delete team');
        }
    };

    const getTeamMemberNames = (memberIds) => {
        return memberIds.map(id => {
            const person = salesPersons.find(p => p.id === id);
            return person ? `${person.firstName} ${person.lastName}` : 'Unknown';
        }).join(', ');
    };

    const getCompanyNames = (companyIds) => {
        return companyIds.map(id => {
            const company = companies.find(c => c.id === id);
            return company ? company.name : 'Unknown';
        }).join(', ');
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="300px">
                <CircularProgress size={40} />
                <Typography variant="body2" sx={{ ml: 2, fontSize: '12px' }}>
                    Loading sales teams...
                </Typography>
            </Box>
        );
    }

    return (
        <Box>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Box>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                        Sales Teams Management
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Organize sales representatives into teams and assign company territories
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                    sx={{ fontSize: '12px' }}
                >
                    Create Team
                </Button>
            </Box>

            {/* Success/Error Messages */}
            {success && (
                <Alert severity="success" sx={{ mb: 2, fontSize: '12px' }} onClose={() => setSuccess('')}>
                    {success}
                </Alert>
            )}
            {error && (
                <Alert severity="error" sx={{ mb: 2, fontSize: '12px' }} onClose={() => setError('')}>
                    {error}
                </Alert>
            )}

            {/* Teams Table */}
            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                Team Name
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                Members
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                Assigned Companies
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                Member Count
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>
                                Actions
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {teams.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                                    <Box display="flex" flexDirection="column" alignItems="center">
                                        <GroupIcon sx={{ fontSize: 48, color: '#d1d5db', mb: 1 }} />
                                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                            No sales teams found
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '11px', color: '#9ca3af' }}>
                                            Create your first sales team to get started
                                        </Typography>
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ) : (
                            teams.map((team) => (
                                <TableRow key={team.id} hover>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Box display="flex" alignItems="center">
                                            <GroupIcon sx={{ fontSize: 16, color: '#6b7280', mr: 1 }} />
                                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                {team.teamName}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {team.teamMembers && team.teamMembers.length > 0 ? (
                                            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                {getTeamMemberNames(team.teamMembers)}
                                            </Typography>
                                        ) : (
                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#9ca3af' }}>
                                                No members assigned
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {team.assignedCompanies && team.assignedCompanies.length > 0 ? (
                                            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                {getCompanyNames(team.assignedCompanies)}
                                            </Typography>
                                        ) : (
                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#9ca3af' }}>
                                                No companies assigned
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Chip
                                            label={team.memberCount || team.teamMembers?.length || 0}
                                            size="small"
                                            color={team.memberCount > 0 ? 'primary' : 'default'}
                                            sx={{ fontSize: '11px' }}
                                        />
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Box display="flex" gap={0.5}>
                                            <Tooltip title="Edit Team">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleOpenDialog(team)}
                                                >
                                                    <EditIcon sx={{ fontSize: 16 }} />
                                                </IconButton>
                                            </Tooltip>
                                            <Tooltip title="Delete Team">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleDelete(team.id, team.teamName)}
                                                    color="error"
                                                >
                                                    <DeleteIcon sx={{ fontSize: 16 }} />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Create/Edit Team Dialog */}
            <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
                <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                        {editingTeam ? 'Edit Sales Team' : 'Create Sales Team'}
                    </Typography>
                    <IconButton onClick={handleCloseDialog} size="small">
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent dividers>
                    <Grid container spacing={3}>
                        {/* Team Name */}
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Team Name"
                                value={formData.teamName}
                                onChange={(e) => setFormData({ ...formData, teamName: e.target.value })}
                                size="small"
                                required
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>

                        {/* Team Members */}
                        <Grid item xs={12}>
                            <Autocomplete
                                multiple
                                options={salesPersons}
                                getOptionLabel={(option) => `${option.firstName} ${option.lastName}`}
                                value={salesPersons.filter(person => formData.teamMembers.includes(person.id))}
                                onChange={(event, newValue) => {
                                    setFormData({
                                        ...formData,
                                        teamMembers: newValue.map(person => person.id)
                                    });
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Team Members"
                                        size="small"
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                        InputLabelProps={{ sx: { fontSize: '12px' } }}
                                    />
                                )}
                                renderTags={(value, getTagProps) =>
                                    value.map((option, index) => (
                                        <Chip
                                            variant="outlined"
                                            label={`${option.firstName} ${option.lastName}`}
                                            size="small"
                                            sx={{ fontSize: '11px' }}
                                            {...getTagProps({ index })}
                                        />
                                    ))
                                }
                                size="small"
                            />
                        </Grid>

                        {/* Assigned Companies */}
                        <Grid item xs={12}>
                            <Autocomplete
                                multiple
                                options={companies}
                                getOptionLabel={(option) => option.name}
                                value={companies.filter(company => formData.assignedCompanies.includes(company.id))}
                                onChange={(event, newValue) => {
                                    setFormData({
                                        ...formData,
                                        assignedCompanies: newValue.map(company => company.id)
                                    });
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Assigned Companies"
                                        size="small"
                                        sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                        InputLabelProps={{ sx: { fontSize: '12px' } }}
                                    />
                                )}
                                renderTags={(value, getTagProps) =>
                                    value.map((option, index) => (
                                        <Chip
                                            variant="outlined"
                                            label={option.name}
                                            size="small"
                                            sx={{ fontSize: '11px' }}
                                            {...getTagProps({ index })}
                                        />
                                    ))
                                }
                                size="small"
                            />
                        </Grid>
                    </Grid>

                    {error && (
                        <Alert severity="error" sx={{ mt: 2, fontSize: '12px' }}>
                            {error}
                        </Alert>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2 }}>
                    <Button onClick={handleCloseDialog} size="small" sx={{ fontSize: '12px' }}>
                        Cancel
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        {editingTeam ? 'Update Team' : 'Create Team'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default SalesTeamsManagement; 