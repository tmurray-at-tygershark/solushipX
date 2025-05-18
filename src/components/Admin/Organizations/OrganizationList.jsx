import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    TextField,
    Chip,
    Tooltip,
    Pagination,
    Stack,
    InputAdornment,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
    Breadcrumbs,
    Link as MuiLink,
    Alert
} from '@mui/material';
import {
    Add as AddIcon,
    Visibility as ViewIcon,
    MoreVert as MoreVertIcon,
    Search as SearchIcon,
    DeleteForever as DeleteForeverIcon,
    Apartment as ApartmentIcon // Icon for Organizations
} from '@mui/icons-material';
import { collection, getDocs, query, orderBy, doc, deleteDoc, where } from 'firebase/firestore';
import { db, functions } from '../../../firebase';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { format } from 'date-fns';
import { useSnackbar } from 'notistack';
import { httpsCallable } from 'firebase/functions';

const ITEMS_PER_PAGE = 10;

// Redefine formatDate or move to a shared utils file
const formatDate = (timestamp) => {
    if (!timestamp || !timestamp.toDate) return 'N/A';
    try {
        return format(timestamp.toDate(), 'MMM d, yyyy HH:mm');
    } catch (e) {
        console.warn("Error formatting date:", timestamp, e);
        // Fallback for potentially already stringified dates if data source is inconsistent
        if (typeof timestamp === 'string') {
            try {
                return format(new Date(timestamp), 'MMM d, yyyy HH:mm');
            } catch (e2) {
                return 'Invalid Date';
            }
        }
        return 'Invalid Date';
    }
};

const OrganizationList = () => {
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();

    const [organizations, setOrganizations] = useState([]);
    const [companyMap, setCompanyMap] = useState({}); // To map company IDs to names
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedOrg, setSelectedOrg] = useState(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Fetch all companies once to map IDs to names for display
    const fetchAllCompanies = useCallback(async () => {
        try {
            const companiesSnap = await getDocs(collection(db, 'companies'));
            const newCompanyMap = {};
            companiesSnap.forEach(doc => {
                const companyData = doc.data();
                if (companyData.companyID && companyData.name) {
                    newCompanyMap[companyData.companyID] = companyData.name;
                }
            });
            setCompanyMap(newCompanyMap);
        } catch (err) {
            console.error("Error fetching companies for map:", err);
            // Handle error if needed, but org list can still load
        }
    }, []);

    const fetchOrganizations = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const orgsRef = collection(db, 'organizations');
            const q = query(orgsRef, orderBy('name')); // Order by name
            const querySnapshot = await getDocs(q);
            const orgsData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            }));
            setOrganizations(orgsData);
            setTotalPages(Math.ceil(orgsData.length / ITEMS_PER_PAGE));
        } catch (err) {
            console.error("Error fetching organizations:", err);
            setError('Error fetching organizations: ' + err.message);
            enqueueSnackbar('Error fetching organizations: ' + err.message, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [enqueueSnackbar]);

    useEffect(() => {
        fetchAllCompanies();
        fetchOrganizations();
    }, [fetchAllCompanies, fetchOrganizations]); // page dependency removed, will re-fetch on delete/add

    const handleActionsClick = (event, org) => {
        setAnchorEl(event.currentTarget);
        setSelectedOrg(org);
    };

    const handleActionsClose = () => {
        setAnchorEl(null);
        setSelectedOrg(null);
    };

    const handleViewOrganization = () => {
        if (selectedOrg) {
            navigate(`/admin/organizations/${selectedOrg.id}`);
        }
        handleActionsClose();
    };

    const openDeleteDialog = (org) => {
        setSelectedOrg(org); // Set the org to be potentially deleted
        setDeleteDialogOpen(true);
        handleActionsClose();
    };

    const handleConfirmDelete = async () => {
        if (!selectedOrg) return;
        setIsDeleting(true);
        try {
            // TODO: Implement pre-delete checks (e.g., if org owns active companies or has users)
            // For now, direct delete:
            await deleteDoc(doc(db, 'organizations', selectedOrg.id));
            enqueueSnackbar(`Organization '${selectedOrg.name}' deleted successfully.`, { variant: 'success' });
            setDeleteDialogOpen(false);
            setSelectedOrg(null);
            fetchOrganizations(); // Refresh the list
        } catch (err) {
            console.error('Error deleting organization:', err);
            enqueueSnackbar(`Failed to delete organization: ${err.message}`, { variant: 'error' });
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredOrganizations = organizations.filter(org =>
        (org.name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (org.orgID?.toLowerCase() || '').includes(searchTerm.toLowerCase())
    );

    const paginatedOrganizations = filteredOrganizations.slice(
        (page - 1) * ITEMS_PER_PAGE,
        page * ITEMS_PER_PAGE
    );

    const getStatusChip = (status) => (
        <Chip
            label={status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
            color={status === 'active' ? 'success' : status === 'inactive' ? 'default' : 'warning'}
            size="small"
        />
    );

    if (loading && organizations.length === 0) { // Show loader only on initial load
        return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><CircularProgress /></Box>;
    }

    if (error) {
        return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert></Box>;
    }

    return (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ mb: 3 }}>
                <Typography variant="h4" component="h1" gutterBottom>
                    Organizations
                </Typography>
                <Breadcrumbs aria-label="breadcrumb">
                    <RouterLink component={MuiLink} to="/admin" sx={{ textDecoration: 'none', color: 'inherit', '&:hover': { textDecoration: 'underline' } }}>
                        Admin
                    </RouterLink>
                    <Typography color="text.primary">Organizations</Typography>
                </Breadcrumbs>
            </Box>

            <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField
                    fullWidth
                    placeholder="Search by Org Name or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    InputProps={{
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon />
                            </InputAdornment>
                        ),
                    }}
                    variant="outlined"
                    size="small"
                />
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => navigate('/admin/organizations/new')}
                    sx={{ whiteSpace: 'nowrap' }}
                >
                    Add Organization
                </Button>
            </Box>

            <Paper elevation={2}>
                <TableContainer>
                    <Table stickyHeader>
                        <TableHead>
                            <TableRow>
                                <TableCell>Org Name</TableCell>
                                <TableCell>Org ID</TableCell>
                                <TableCell>Connected Companies</TableCell>
                                <TableCell>Status</TableCell>
                                <TableCell>Last Updated</TableCell>
                                <TableCell align="right">Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loading && paginatedOrganizations.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                                        <CircularProgress />
                                    </TableCell>
                                </TableRow>
                            ) : paginatedOrganizations.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 3 }}>
                                        <Typography color="text.secondary">No organizations found.</Typography>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                paginatedOrganizations.map((org) => (
                                    <TableRow key={org.id} hover>
                                        <TableCell>
                                            <RouterLink
                                                to={`/admin/organizations/${org.id}`}
                                                component={MuiLink}
                                                sx={{
                                                    textDecoration: 'none',
                                                    color: 'inherit',
                                                    fontWeight: 500,
                                                    '&:hover': { textDecoration: 'underline' }
                                                }}
                                            >
                                                {org.name}
                                            </RouterLink>
                                        </TableCell>
                                        <TableCell>
                                            <Chip label={org.orgID || 'N/A'} size="small" variant="outlined" />
                                        </TableCell>
                                        <TableCell>
                                            {org.connectedCompanies && org.connectedCompanies.length > 0 ? (
                                                <Tooltip title={org.connectedCompanies.map(id => companyMap[id] || id).join(', ')}>
                                                    <Chip label={`${org.connectedCompanies.length} ${org.connectedCompanies.length === 1 ? 'Company' : 'Companies'}`} size="small" />
                                                </Tooltip>
                                            ) : (
                                                <Typography variant="body2" color="text.secondary">—</Typography>
                                            )}
                                        </TableCell>
                                        <TableCell>{getStatusChip(org.status)}</TableCell>
                                        <TableCell>{org.updatedAt ? formatDate(org.updatedAt) : 'N/A'}</TableCell>
                                        <TableCell align="right">
                                            <IconButton size="small" onClick={(e) => handleActionsClick(e, org)}>
                                                <MoreVertIcon />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </TableContainer>
                {totalPages > 1 && (
                    <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
                        <Pagination
                            count={totalPages}
                            page={page}
                            onChange={(e, value) => setPage(value)}
                            color="primary"
                        />
                    </Box>
                )}
            </Paper>

            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleActionsClose}
            >
                <MenuItem onClick={handleViewOrganization}>
                    <ListItemIcon><ViewIcon fontSize="small" /></ListItemIcon>
                    <ListItemText>View Details</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => selectedOrg && openDeleteDialog(selectedOrg)} sx={{ color: 'error.main' }}>
                    <ListItemIcon><DeleteForeverIcon fontSize="small" color="error" /></ListItemIcon>
                    <ListItemText>Delete Organization</ListItemText>
                </MenuItem>
            </Menu>

            <Dialog
                open={deleteDialogOpen}
                onClose={() => { setDeleteDialogOpen(false); setSelectedOrg(null); }}
            >
                <DialogTitle>Confirm Deletion</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete the organization "<strong>{selectedOrg?.name}</strong>"?
                        This action cannot be undone.
                        {/* TODO: Add warning about owned companies if applicable after check */}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => { setDeleteDialogOpen(false); setSelectedOrg(null); }} disabled={isDeleting}>Cancel</Button>
                    <Button onClick={handleConfirmDelete} color="error" variant="contained" disabled={isDeleting}>
                        {isDeleting ? <CircularProgress size={20} color="inherit" /> : 'Confirm Delete'}
                    </Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
};

export default OrganizationList; 