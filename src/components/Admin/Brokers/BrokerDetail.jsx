import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, Grid, TextField, Button, Switch,
    FormControlLabel, CircularProgress, Alert, Chip, IconButton,
    Autocomplete, Avatar
} from '@mui/material';
import {
    Save as SaveIcon, ArrowBack as ArrowBackIcon,
    Phone as PhoneIcon, Email as EmailIcon, Business as BusinessIcon,
    Edit as EditIcon, Cancel as CancelIcon
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, query, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import AdminBreadcrumb from '../AdminBreadcrumb';

const BrokerDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isNew = id === 'new';

    const [broker, setBroker] = useState({
        name: '',
        phone: '',
        email: '',
        companyID: '',
        enabled: true
    });
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [editMode, setEditMode] = useState(isNew);
    const [companies, setCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);

    // Load companies
    useEffect(() => {
        loadCompanies();
    }, []);

    const loadCompanies = async () => {
        try {
            const companiesQuery = query(collection(db, 'companies'));
            const companiesSnapshot = await getDocs(companiesQuery);

            const companiesData = companiesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setCompanies(companiesData);
        } catch (error) {
            console.error('Error loading companies:', error);
        }
    };

    // Load broker data
    useEffect(() => {
        if (!isNew) {
            loadBroker();
        }
    }, [id, isNew]);

    const loadBroker = async () => {
        try {
            const brokerDoc = await getDoc(doc(db, 'companyBrokers', id));
            if (brokerDoc.exists()) {
                const data = brokerDoc.data();
                setBroker(data);

                // Find and set the selected company
                if (data.companyID && companies.length > 0) {
                    const company = companies.find(c => c.companyID === data.companyID);
                    setSelectedCompany(company);
                }
            } else {
                setError('Broker not found');
            }
        } catch (error) {
            console.error('Error loading broker:', error);
            setError('Failed to load broker details');
        } finally {
            setLoading(false);
        }
    };

    // Update selected company when companies load
    useEffect(() => {
        if (broker.companyID && companies.length > 0 && !selectedCompany) {
            const company = companies.find(c => c.companyID === broker.companyID);
            setSelectedCompany(company);
        }
    }, [broker.companyID, companies, selectedCompany]);

    const handleSave = async () => {
        // Validate
        if (!broker.name?.trim()) {
            setError('Broker name is required');
            return;
        }

        if (!broker.email?.trim() && !broker.phone?.trim()) {
            setError('At least one contact method (email or phone) is required');
            return;
        }

        if (broker.email && !isValidEmail(broker.email)) {
            setError('Please enter a valid email address');
            return;
        }

        if (!selectedCompany) {
            setError('Please select a company');
            return;
        }

        setSaving(true);
        setError('');

        try {
            if (isNew) {
                // Create new broker - handled in BrokerForm
                navigate('/admin/brokers/new');
            } else {
                // Update existing broker
                await updateDoc(doc(db, 'companyBrokers', id), {
                    ...broker,
                    companyID: selectedCompany.companyID || selectedCompany.id,
                    updatedAt: new Date()
                });
                setSuccess('Broker updated successfully');
                setEditMode(false);

                // Update broker state with new company
                setBroker({
                    ...broker,
                    companyID: selectedCompany.companyID || selectedCompany.id
                });
            }
        } catch (error) {
            console.error('Error saving broker:', error);
            setError('Failed to save broker');
        } finally {
            setSaving(false);
        }
    };

    const isValidEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleCancel = () => {
        if (isNew) {
            navigate('/admin/brokers');
        } else {
            loadBroker();
            setEditMode(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <IconButton onClick={() => navigate('/admin/brokers')} size="small">
                            <ArrowBackIcon />
                        </IconButton>
                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827' }}>
                                {isNew ? 'New Broker' : broker.name || 'Broker Details'}
                            </Typography>
                            {!isNew && (
                                <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                                    ID: {id}
                                </Typography>
                            )}
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        {!isNew && !editMode && (
                            <Button
                                variant="outlined"
                                startIcon={<EditIcon />}
                                onClick={() => setEditMode(true)}
                                size="small"
                                sx={{ fontSize: '12px' }}
                            >
                                Edit
                            </Button>
                        )}
                        {editMode && (
                            <>
                                <Button
                                    variant="outlined"
                                    startIcon={<CancelIcon />}
                                    onClick={handleCancel}
                                    size="small"
                                    sx={{ fontSize: '12px' }}
                                    disabled={saving}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    variant="contained"
                                    startIcon={<SaveIcon />}
                                    onClick={handleSave}
                                    size="small"
                                    sx={{ fontSize: '12px' }}
                                    disabled={saving}
                                >
                                    {saving ? 'Saving...' : 'Save'}
                                </Button>
                            </>
                        )}
                    </Box>
                </Box>
                <AdminBreadcrumb currentPage={isNew ? 'New Broker' : 'Broker Details'} />
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                {error && (
                    <Alert severity="error" onClose={() => setError('')} sx={{ mb: 3 }}>
                        {error}
                    </Alert>
                )}
                {success && (
                    <Alert severity="success" onClose={() => setSuccess('')} sx={{ mb: 3 }}>
                        {success}
                    </Alert>
                )}

                <Grid container spacing={3}>
                    {/* Basic Information */}
                    <Grid item xs={12} md={8}>
                        <Paper sx={{ p: 3, border: '1px solid #e5e7eb' }}>
                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 3 }}>
                                Basic Information
                            </Typography>
                            <Grid container spacing={2}>
                                <Grid item xs={12}>
                                    <TextField
                                        label="Broker Name"
                                        value={broker.name}
                                        onChange={(e) => setBroker({ ...broker, name: e.target.value })}
                                        fullWidth
                                        size="small"
                                        required
                                        disabled={!editMode}
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        label="Phone Number"
                                        value={broker.phone}
                                        onChange={(e) => setBroker({ ...broker, phone: e.target.value })}
                                        fullWidth
                                        size="small"
                                        disabled={!editMode}
                                        InputProps={{
                                            startAdornment: <PhoneIcon sx={{ fontSize: 16, mr: 1, color: '#6b7280' }} />
                                        }}
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={6}>
                                    <TextField
                                        label="Email Address"
                                        type="email"
                                        value={broker.email}
                                        onChange={(e) => setBroker({ ...broker, email: e.target.value })}
                                        fullWidth
                                        size="small"
                                        disabled={!editMode}
                                        InputProps={{
                                            startAdornment: <EmailIcon sx={{ fontSize: 16, mr: 1, color: '#6b7280' }} />
                                        }}
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                            </Grid>
                        </Paper>
                    </Grid>

                    {/* Status and Company */}
                    <Grid item xs={12} md={4}>
                        <Paper sx={{ p: 3, border: '1px solid #e5e7eb', mb: 3 }}>
                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 3 }}>
                                Status
                            </Typography>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={broker.enabled}
                                        onChange={(e) => setBroker({ ...broker, enabled: e.target.checked })}
                                        disabled={!editMode}
                                    />
                                }
                                label={broker.enabled ? 'Active' : 'Inactive'}
                                sx={{ '& .MuiFormControlLabel-label': { fontSize: '12px' } }}
                            />
                        </Paper>

                        <Paper sx={{ p: 3, border: '1px solid #e5e7eb' }}>
                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 3 }}>
                                Company Assignment
                            </Typography>
                            {editMode ? (
                                <Autocomplete
                                    options={companies}
                                    getOptionLabel={(option) => option.name || option.companyID || ''}
                                    value={selectedCompany}
                                    onChange={(event, newValue) => setSelectedCompany(newValue)}
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
                                        />
                                    )}
                                    renderOption={(props, option) => (
                                        <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            {option.logo ? (
                                                <Avatar
                                                    src={option.logo}
                                                    sx={{ width: 24, height: 24 }}
                                                />
                                            ) : (
                                                <Avatar sx={{ width: 24, height: 24, fontSize: '12px', bgcolor: '#3b82f6' }}>
                                                    {option.name?.charAt(0) || 'C'}
                                                </Avatar>
                                            )}
                                            <Box>
                                                <Typography sx={{ fontSize: '12px' }}>
                                                    {option.name}
                                                </Typography>
                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                    ID: {option.companyID}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    )}
                                />
                            ) : (
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <BusinessIcon sx={{ fontSize: 20, color: '#6b7280' }} />
                                    <Box>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                            {selectedCompany?.name || broker.companyID}
                                        </Typography>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                            ID: {broker.companyID}
                                        </Typography>
                                    </Box>
                                </Box>
                            )}
                        </Paper>
                    </Grid>
                </Grid>
            </Box>
        </Box>
    );
};

export default BrokerDetail; 