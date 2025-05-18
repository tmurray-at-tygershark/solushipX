import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Autocomplete,
    TextField,
    Chip,
    Alert,
    CircularProgress,
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    ArrowBack as ArrowBackIcon,
} from '@mui/icons-material';
import { collection, doc, getDoc, getDocs, updateDoc, query, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useParams, useNavigate } from 'react-router-dom';

const UserCompanies = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [companies, setCompanies] = useState([]);
    const [availableCompanies, setAvailableCompanies] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetchUserAndCompanies();
    }, [userId]);

    const fetchUserAndCompanies = async () => {
        try {
            setLoading(true);
            // Fetch user data
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (!userDoc.exists()) {
                throw new Error('User not found');
            }
            const userData = userDoc.data();
            setUser(userData);

            // Fetch all companies
            const companiesRef = collection(db, 'companies');
            const companiesSnapshot = await getDocs(companiesRef);
            const allCompanies = companiesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setCompanies(allCompanies);

            // Filter out companies that are already connected
            const connectedCompanyIds = userData.connectedCompanies || [];
            const available = allCompanies.filter(company => !connectedCompanyIds.includes(company.companyID));
            setAvailableCompanies(available);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddCompany = async () => {
        if (!selectedCompany) return;

        try {
            setSaving(true);
            const userRef = doc(db, 'users', userId);
            const connectedCompanies = user.connectedCompanies || [];

            await updateDoc(userRef, {
                connectedCompanies: [...connectedCompanies, selectedCompany.companyID],
                updatedAt: new Date()
            });

            await fetchUserAndCompanies();
            setOpenDialog(false);
            setSelectedCompany(null);
        } catch (err) {
            setError('Error adding company: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleRemoveCompany = async (companyId) => {
        try {
            setSaving(true);
            const userRef = doc(db, 'users', userId);
            const connectedCompanies = user.connectedCompanies || [];

            await updateDoc(userRef, {
                connectedCompanies: connectedCompanies.filter(id => id !== companyId),
                updatedAt: new Date()
            });

            await fetchUserAndCompanies();
        } catch (err) {
            setError('Error removing company: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">{error}</Alert>
            </Box>
        );
    }

    return (
        <Box className="user-companies-container">
            <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton onClick={() => navigate(-1)}>
                    <ArrowBackIcon />
                </IconButton>
                <Box>
                    <Typography variant="h4" component="h1" gutterBottom>
                        Manage Companies for {user.firstName} {user.lastName}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Connect or disconnect companies for this user
                    </Typography>
                </Box>
            </Box>

            <Paper sx={{ p: 3, mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h6">Connected Companies</Typography>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => setOpenDialog(true)}
                        disabled={availableCompanies.length === 0}
                    >
                        Add Company
                    </Button>
                </Box>

                {user.connectedCompanies?.length > 0 ? (
                    <List>
                        {user.connectedCompanies.map(companyId => {
                            const company = companies.find(c => c.companyID === companyId);
                            return (
                                <ListItem
                                    key={companyId}
                                    sx={{
                                        border: '1px solid',
                                        borderColor: 'divider',
                                        borderRadius: 1,
                                        mb: 1
                                    }}
                                >
                                    <ListItemText
                                        primary={company?.name || companyId}
                                        secondary={`Company ID: ${companyId}`}
                                    />
                                    <ListItemSecondaryAction>
                                        <IconButton
                                            edge="end"
                                            color="error"
                                            onClick={() => handleRemoveCompany(companyId)}
                                            disabled={saving}
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </ListItemSecondaryAction>
                                </ListItem>
                            );
                        })}
                    </List>
                ) : (
                    <Typography color="text.secondary" sx={{ py: 2 }}>
                        No companies connected to this user
                    </Typography>
                )}
            </Paper>

            {/* Add Company Dialog */}
            <Dialog
                open={openDialog}
                onClose={() => setOpenDialog(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Add Company</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2 }}>
                        <Autocomplete
                            options={availableCompanies}
                            getOptionLabel={(option) => `${option.name} (${option.companyID})`}
                            value={selectedCompany}
                            onChange={(event, newValue) => setSelectedCompany(newValue)}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Select Company"
                                    placeholder="Search companies..."
                                />
                            )}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleAddCompany}
                        disabled={!selectedCompany || saving}
                    >
                        {saving ? 'Adding...' : 'Add Company'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default UserCompanies; 