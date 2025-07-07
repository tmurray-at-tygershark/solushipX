import React, { useState, useEffect } from 'react';
import {
    Box, Typography, Paper, Grid, TextField, Button, Switch,
    FormControlLabel, CircularProgress, Alert, Autocomplete, Avatar
} from '@mui/material';
import {
    Save as SaveIcon, Cancel as CancelIcon,
    Business as BusinessIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { collection, addDoc, query, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';
import AdminBreadcrumb from '../AdminBreadcrumb';

const BrokerForm = () => {
    const navigate = useNavigate();

    const [broker, setBroker] = useState({
        name: '',
        phone: '',
        email: '',
        companyID: '',
        enabled: true
    });
    const [companies, setCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

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
            setError('Failed to load companies');
        } finally {
            setLoading(false);
        }
    };

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
            // Create new broker
            await addDoc(collection(db, 'companyBrokers'), {
                ...broker,
                companyID: selectedCompany.companyID || selectedCompany.id,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            navigate('/admin/brokers');
        } catch (error) {
            console.error('Error creating broker:', error);
            setError('Failed to create broker');
        } finally {
            setSaving(false);
        }
    };

    const isValidEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleCancel = () => {
        navigate('/admin/brokers');
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
                    <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827' }}>
                        New Broker
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
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
                            {saving ? 'Creating...' : 'Create Broker'}
                        </Button>
                    </Box>
                </Box>
                <AdminBreadcrumb currentPage="New Broker" />
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                {error && (
                    <Alert severity="error" onClose={() => setError('')} sx={{ mb: 3 }}>
                        {error}
                    </Alert>
                )}

                <Grid container spacing={3}>
                    {/* Basic Information */}
                    <Grid item xs={12} md={8}>
                        <Paper sx={{ p: 3, border: '1px solid #e5e7eb' }}>
                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 3 }}>
                                Broker Information
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
                                        autoFocus
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
                                        placeholder="(123) 456-7890"
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
                                        placeholder="broker@example.com"
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                            </Grid>
                        </Paper>
                    </Grid>

                    {/* Company and Status */}
                    <Grid item xs={12} md={4}>
                        <Paper sx={{ p: 3, border: '1px solid #e5e7eb', mb: 3 }}>
                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 3 }}>
                                Company Assignment
                            </Typography>
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
                        </Paper>

                        <Paper sx={{ p: 3, border: '1px solid #e5e7eb' }}>
                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 3 }}>
                                Status
                            </Typography>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={broker.enabled}
                                        onChange={(e) => setBroker({ ...broker, enabled: e.target.checked })}
                                    />
                                }
                                label={broker.enabled ? 'Active' : 'Inactive'}
                                sx={{ '& .MuiFormControlLabel-label': { fontSize: '12px' } }}
                            />
                        </Paper>
                    </Grid>
                </Grid>
            </Box>
        </Box>
    );
};

export default BrokerForm; 