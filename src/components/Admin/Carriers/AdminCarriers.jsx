import React, { useState, useEffect } from 'react';
import {
    Box, Paper, Typography, Grid, Card, CardContent, CardMedia, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Switch, IconButton, Tooltip, Chip, CircularProgress, InputLabel, MenuItem, Select, FormControl, Breadcrumbs, Link, InputAdornment
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon, CloudUpload as CloudUploadIcon, NavigateNext as NavigateNextIcon, Search as SearchIcon } from '@mui/icons-material';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

const carrierTypes = [
    { value: 'courier', label: 'Courier' },
    { value: 'freight', label: 'Freight' },
    { value: 'hybrid', label: 'Hybrid' },
];

const AdminCarriers = () => {
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { enqueueSnackbar } = useSnackbar();
    const [carriers, setCarriers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedCarrier, setSelectedCarrier] = useState(null);
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [enabledFilter, setEnabledFilter] = useState('all');
    const [formData, setFormData] = useState({
        name: '',
        carrierID: '',
        type: 'courier',
        enabled: true,
        hostURL: '',
        apiCredentials: {},
        username: '',
        password: '',
        secret: '',
        logoFileName: '',
    });
    const [saving, setSaving] = useState(false);
    const [carrierIdError, setCarrierIdError] = useState('');
    const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);

    const getStatusChip = (status) => {
        if (!status) return null;
        const color = status === 'active' ? 'success' :
            status === 'inactive' ? 'default' :
                status === 'deleted' ? 'error' : 'warning';
        return (
            <Chip
                label={status.charAt(0).toUpperCase() + status.slice(1)}
                color={color}
                size="small"
            />
        );
    };

    useEffect(() => {
        fetchCarriers();
    }, []);

    const fetchCarriers = async () => {
        setLoading(true);
        try {
            const carriersRef = collection(db, 'carriers');
            const querySnapshot = await getDocs(carriersRef);
            const carriersData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setCarriers(carriersData);
        } catch (err) {
            setError('Error fetching carriers: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (carrier = null) => {
        if (carrier) {
            setSelectedCarrier(carrier);
            setFormData({
                name: carrier.name || '',
                carrierID: carrier.carrierID || '',
                type: carrier.type || 'courier',
                enabled: carrier.enabled ?? true,
                status: carrier.status || 'enabled',
                hostURL: carrier.hostURL || '',
                apiCredentials: carrier.apiCredentials || {},
                username: carrier.username || '',
                password: carrier.password || '',
                secret: carrier.secret || '',
                logoFileName: carrier.logoFileName || '',
            });
            setLogoPreview(carrier.logoFileName ? `/images/carrier-badges/${carrier.logoFileName}` : '');
        } else {
            setSelectedCarrier(null);
            setFormData({
                name: '',
                carrierID: '',
                type: 'courier',
                enabled: true,
                hostURL: '',
                apiCredentials: {},
                username: '',
                password: '',
                secret: '',
                logoFileName: '',
            });
            setLogoPreview('');
        }
        setLogoFile(null);
        setCarrierIdError('');
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setSelectedCarrier(null);
        setLogoFile(null);
        setLogoPreview('');
        setFormData({
            name: '',
            carrierID: '',
            type: 'courier',
            enabled: true,
            hostURL: '',
            apiCredentials: {},
            username: '',
            password: '',
            secret: '',
            logoFileName: '',
        });
        setCarrierIdError('');
    };

    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleDropLogo = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleFormChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));

        // Check for carrier ID uniqueness when the field changes
        if (name === 'carrierID') {
            checkCarrierIdUniqueness(value);
        }
    };

    const checkCarrierIdUniqueness = async (carrierId) => {
        if (!carrierId) {
            setCarrierIdError('');
            return;
        }

        try {
            const carriersRef = collection(db, 'carriers');
            const q = query(carriersRef, where('carrierID', '==', carrierId));
            const querySnapshot = await getDocs(q);

            const isDuplicate = querySnapshot.docs.some(doc =>
                !selectedCarrier || doc.id !== selectedCarrier.id
            );

            setCarrierIdError(isDuplicate ? 'This Carrier ID is already in use' : '');
        } catch (err) {
            console.error('Error checking carrier ID uniqueness:', err);
        }
    };

    const handleToggleEnabled = async (carrier) => {
        try {
            await updateDoc(doc(db, 'carriers', carrier.id), {
                enabled: !carrier.enabled,
                updatedAt: serverTimestamp()
            });
            // Optimistically update local state
            setCarriers(prevCarriers => prevCarriers.map(c =>
                c.id === carrier.id ? { ...c, enabled: !carrier.enabled } : c
            ));
            enqueueSnackbar(`Carrier ${carrier.name} has been ${carrier.enabled ? 'disabled' : 'enabled'}.`, { variant: 'success' });
        } catch (err) {
            setError('Error updating carrier status: ' + err.message);
            enqueueSnackbar('Error updating carrier status: ' + err.message, { variant: 'error' });
        }
    };

    const handleSaveCarrier = async (e) => {
        e.preventDefault();
        if (carrierIdError) {
            return;
        }

        setSaving(true);
        setError(null);
        try {
            let logoFileName = formData.logoFileName;
            if (logoFile) {
                // Simulate upload and use file name
                logoFileName = logoFile.name;
                // In production, upload to Firebase Storage and get the URL or file name
            }
            const carrierData = {
                ...formData,
                logoFileName,
                updatedAt: serverTimestamp(),
            };
            if (!selectedCarrier) {
                carrierData.createdAt = serverTimestamp();
                carrierData.status = 'active';
            }
            if (selectedCarrier) {
                await updateDoc(doc(db, 'carriers', selectedCarrier.id), carrierData);
                enqueueSnackbar('Carrier updated successfully.', { variant: 'success' });
            } else {
                await addDoc(collection(db, 'carriers'), carrierData);
                enqueueSnackbar('Carrier created successfully.', { variant: 'success' });
            }
            fetchCarriers();
            handleCloseDialog();
        } catch (err) {
            setError('Error saving carrier: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteCarrier = async () => {
        if (!selectedCarrier) return;

        try {
            await updateDoc(doc(db, 'carriers', selectedCarrier.id), {
                status: 'deleted',
                updatedAt: serverTimestamp()
            });
            enqueueSnackbar('Carrier deleted successfully.', { variant: 'success' });
            fetchCarriers();
            handleCloseDialog();
        } catch (err) {
            setError('Error deleting carrier: ' + err.message);
            enqueueSnackbar('Error deleting carrier: ' + err.message, { variant: 'error' });
        }
    };

    const filteredCarriers = carriers
        .filter(carrier => carrier.status !== 'deleted')
        .filter(carrier => {
            const matchesSearch = searchQuery === '' ||
                carrier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                carrier.carrierID.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesEnabled = enabledFilter === 'all' ||
                (enabledFilter === 'enabled' && carrier.enabled) ||
                (enabledFilter === 'disabled' && !carrier.enabled);
            return matchesSearch && matchesEnabled;
        });

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}><CircularProgress /></Box>;
    }

    return (
        <Box className="carrier-keys-container">
            <Box className="carrier-keys-header" sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                    <Typography variant="h4" className="carrier-keys-title" sx={{ flexGrow: 1 }}>
                        Carriers
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => handleOpenDialog()}
                        sx={{ ml: 'auto' }}
                    >
                        Create Carrier
                    </Button>
                </Box>
                <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="breadcrumb" sx={{ mb: 2 }}>
                    <Link color="inherit" href="/admin" underline="hover">
                        Admin
                    </Link>
                    <Typography color="text.primary">Carriers</Typography>
                </Breadcrumbs>
            </Box>
            {error && <Box sx={{ mb: 2 }}><Typography color="error">{error}</Typography></Box>}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} md={6}>
                        <TextField
                            fullWidth
                            label="Search by Name or ID"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                            }}
                        />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                            <InputLabel>Status Filter</InputLabel>
                            <Select
                                value={enabledFilter}
                                label="Status Filter"
                                onChange={(e) => setEnabledFilter(e.target.value)}
                            >
                                <MenuItem value="all">All Statuses</MenuItem>
                                <MenuItem value="enabled">Enabled</MenuItem>
                                <MenuItem value="disabled">Disabled</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                </Grid>
            </Paper>
            <Grid container spacing={3}>
                {filteredCarriers.map((carrier) => (
                    <Grid item xs={12} sm={6} md={4} key={carrier.id}>
                        <Card className="carrier-card">
                            <Box sx={{ position: 'relative', width: '100%', mb: 2 }}>
                                <img
                                    src={carrier.logoFileName ? `/images/carrier-badges/${carrier.logoFileName}` : '/images/carrier-badges/default.png'}
                                    alt={carrier.name}
                                    style={{
                                        width: '100%',
                                        height: '219px',
                                        objectFit: 'cover',
                                        backgroundColor: '#f5f5f5',
                                        borderRadius: '8px',
                                        display: 'block'
                                    }}
                                />
                                <IconButton
                                    size="small"
                                    onClick={() => handleOpenDialog(carrier)}
                                    sx={{
                                        position: 'absolute',
                                        top: 8,
                                        right: 8,
                                        backgroundColor: 'white',
                                        boxShadow: 1,
                                        '&:hover': {
                                            backgroundColor: 'white',
                                            opacity: 0.9
                                        }
                                    }}
                                >
                                    <EditIcon fontSize="small" />
                                </IconButton>
                            </Box>
                            <CardContent>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                    <Typography variant="h6" component="h2">{carrier.name}</Typography>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
                                            Enabled
                                        </Typography>
                                        <Switch
                                            checked={carrier.enabled}
                                            onChange={(e) => handleToggleEnabled(carrier)}
                                            size="small"
                                        />
                                    </Box>
                                </Box>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                    Type: {carrier.type || 'N/A'}
                                </Typography>
                                <Typography variant="body2" color="text.secondary" gutterBottom>
                                    Carrier ID: {carrier.carrierID || 'N/A'}
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>
            {/* Carrier Form Dialog */}
            <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="md" fullWidth>
                <DialogTitle>{selectedCarrier ? 'Edit Carrier' : 'Create New Carrier'}</DialogTitle>
                <form onSubmit={handleSaveCarrier}>
                    <DialogContent>
                        <Grid container spacing={3}>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Carrier Name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleFormChange}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Carrier ID"
                                    name="carrierID"
                                    value={formData.carrierID}
                                    onChange={handleFormChange}
                                    required
                                    error={!!carrierIdError}
                                    helperText={carrierIdError}
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth>
                                    <InputLabel>Type</InputLabel>
                                    <Select name="type" value={formData.type} label="Type" onChange={handleFormChange}>
                                        {carrierTypes.map(opt => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField fullWidth label="Host URL" name="hostURL" value={formData.hostURL} onChange={handleFormChange} required />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField fullWidth label="Username" name="username" value={formData.username} onChange={handleFormChange} />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField fullWidth label="Password" name="password" value={formData.password} onChange={handleFormChange} type="password" />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField fullWidth label="Secret" name="secret" value={formData.secret} onChange={handleFormChange} />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <Box
                                    sx={{ border: '2px dashed #1976d2', borderRadius: 2, p: 2, textAlign: 'center', cursor: 'pointer', bgcolor: '#f8fafc' }}
                                    onDrop={handleDropLogo}
                                    onDragOver={handleDragOver}
                                    onClick={() => document.getElementById('carrier-logo-upload').click()}
                                >
                                    <input
                                        id="carrier-logo-upload"
                                        type="file"
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={handleLogoChange}
                                    />
                                    {logoPreview ? (
                                        <img src={logoPreview} alt="Logo Preview" style={{ maxHeight: 80, marginBottom: 8 }} />
                                    ) : (
                                        <CloudUploadIcon sx={{ fontSize: 40, color: '#1976d2', mb: 1 }} />
                                    )}
                                    <Typography variant="body2" color="text.secondary">
                                        {logoFile ? logoFile.name : 'Drag & drop or click to upload logo'}
                                    </Typography>
                                </Box>
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions>
                        {selectedCarrier && (
                            <Button
                                variant="contained"
                                color="error"
                                onClick={() => setOpenDeleteConfirm(true)}
                                sx={{ mr: 'auto' }}
                            >
                                Delete
                            </Button>
                        )}
                        <Button variant="outlined" onClick={handleCloseDialog}>Cancel</Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={saving || !!carrierIdError}
                        >
                            {saving ? 'Saving...' : 'Save Carrier'}
                        </Button>
                    </DialogActions>
                </form>
                {/* Delete Confirmation Dialog */}
                <Dialog open={openDeleteConfirm} onClose={() => setOpenDeleteConfirm(false)}>
                    <DialogTitle>Confirm Delete</DialogTitle>
                    <DialogContent>
                        Are you sure you want to delete this carrier? This action cannot be undone.
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setOpenDeleteConfirm(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={async () => {
                                setOpenDeleteConfirm(false);
                                await handleDeleteCarrier();
                            }}
                            color="error"
                            variant="contained"
                        >
                            Delete
                        </Button>
                    </DialogActions>
                </Dialog>
            </Dialog>
        </Box>
    );
};

export default AdminCarriers; 