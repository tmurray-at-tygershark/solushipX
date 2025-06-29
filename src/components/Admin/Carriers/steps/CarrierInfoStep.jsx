import React, { useState, useCallback } from 'react';
import {
    Box,
    Typography,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Switch,
    Paper,
    Avatar,
    Button,
    IconButton,
    Alert,
    Grid
} from '@mui/material';
import {
    CloudUpload as CloudUploadIcon,
    Delete as DeleteIcon,
    LocalShipping as CarrierIcon
} from '@mui/icons-material';

const carrierTypes = [
    { value: 'courier', label: 'Courier' },
    { value: 'freight', label: 'Freight' },
    { value: 'hybrid', label: 'Hybrid' }
];

const CarrierInfoStep = ({ data, onUpdate, errors, setErrors }) => {
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState(data.logoURL || '');
    const [dragOver, setDragOver] = useState(false);

    // Handle form field changes
    const handleFieldChange = useCallback((field, value) => {
        onUpdate({ [field]: value });

        // Clear errors for this field
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    }, [onUpdate, errors, setErrors]);

    // Handle logo file selection
    const handleLogoChange = useCallback((file) => {
        if (!file) return;

        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/svg+xml'];
        if (!validTypes.includes(file.type)) {
            setErrors(prev => ({ ...prev, logo: 'Please select a valid image file (JPEG, PNG, GIF, SVG)' }));
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            setErrors(prev => ({ ...prev, logo: 'File size must be less than 5MB' }));
            return;
        }

        setLogoFile(file);
        const preview = URL.createObjectURL(file);
        setLogoPreview(preview);

        // Update form data
        handleFieldChange('logoFileName', file.name);

        // Pass logo file data to parent EditCarrier component
        if (onUpdate) {
            onUpdate({ logoFileName: file.name }, { file: file, preview: preview });
        }

        // Clear logo errors
        if (errors.logo) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.logo;
                return newErrors;
            });
        }
    }, [handleFieldChange, errors, setErrors]);

    // Handle file input change
    const handleFileInputChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            handleLogoChange(file);
        }
    };

    // Handle drag and drop
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);

        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleLogoChange(files[0]);
        }
    }, [handleLogoChange]);

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        setDragOver(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        setDragOver(false);
    }, []);

    // Remove logo
    const handleRemoveLogo = useCallback(() => {
        setLogoFile(null);
        setLogoPreview('');
        handleFieldChange('logoFileName', '');
        handleFieldChange('logoURL', '');

        // Clear logo file data in parent
        if (onUpdate) {
            onUpdate({ logoFileName: '', logoURL: '' }, { file: null, preview: '' });
        }
    }, [handleFieldChange, onUpdate]);

    return (
        <Box sx={{ width: '100%' }}>
            <Typography variant="h6" sx={{ mb: 3, fontSize: '16px', fontWeight: 600 }}>
                Basic Carrier Information
            </Typography>

            <Grid container spacing={4}>
                {/* Left Column - Logo Upload */}
                <Grid item xs={12} md={4}>
                    <Typography variant="subtitle2" sx={{ mb: 2, fontSize: '14px', fontWeight: 600 }}>
                        Carrier Logo
                    </Typography>

                    <Paper
                        sx={{
                            border: dragOver ? '2px dashed #1976d2' : '2px dashed #ccc',
                            borderRadius: 2,
                            p: 3,
                            textAlign: 'center',
                            backgroundColor: dragOver ? '#f3f8ff' : '#fafafa',
                            cursor: 'pointer',
                            transition: 'all 0.3s ease',
                            minHeight: '280px',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            '&:hover': {
                                borderColor: '#1976d2',
                                backgroundColor: '#f8fafc'
                            }
                        }}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => document.getElementById('logo-file-input').click()}
                    >
                        {logoPreview ? (
                            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                <Avatar
                                    src={logoPreview}
                                    sx={{ width: 120, height: 120 }}
                                >
                                    <CarrierIcon sx={{ fontSize: 60 }} />
                                </Avatar>
                                <Typography sx={{ fontSize: '12px', color: '#666', textAlign: 'center' }}>
                                    {data.logoFileName || 'Logo uploaded'}
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'center' }}>
                                    <Button
                                        size="small"
                                        variant="outlined"
                                        startIcon={<CloudUploadIcon />}
                                        sx={{ fontSize: '11px' }}
                                    >
                                        Change Logo
                                    </Button>
                                    <IconButton
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveLogo();
                                        }}
                                        sx={{ color: '#d32f2f' }}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            </Box>
                        ) : (
                            <Box>
                                <CloudUploadIcon sx={{ fontSize: 64, color: '#ccc', mb: 2 }} />
                                <Typography sx={{ fontSize: '14px', mb: 1 }}>
                                    Drag and drop a logo here, or click to select
                                </Typography>
                                <Typography sx={{ fontSize: '11px', color: '#666' }}>
                                    Supports: JPEG, PNG, GIF, SVG (max 5MB)
                                </Typography>
                            </Box>
                        )}
                    </Paper>

                    {errors.logo && (
                        <Alert severity="error" sx={{ mt: 1, fontSize: '12px' }}>
                            {errors.logo}
                        </Alert>
                    )}

                    <input
                        id="logo-file-input"
                        type="file"
                        accept="image/*"
                        onChange={handleFileInputChange}
                        style={{ display: 'none' }}
                    />
                </Grid>

                {/* Right Column - Form Fields */}
                <Grid item xs={12} md={8}>
                    <Grid container spacing={3}>
                        {/* Carrier Name */}
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Carrier Name"
                                value={data.name || ''}
                                onChange={(e) => handleFieldChange('name', e.target.value)}
                                error={!!errors.name}
                                helperText={errors.name}
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                                required
                            />
                        </Grid>

                        {/* Carrier ID */}
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Carrier ID"
                                value={data.carrierID || ''}
                                onChange={(e) => handleFieldChange('carrierID', e.target.value.toUpperCase())}
                                error={!!errors.carrierID}
                                helperText={errors.carrierID || 'Unique identifier (automatically converted to uppercase)'}
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px', textTransform: 'uppercase' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                                required
                            />
                        </Grid>

                        {/* Account Number */}
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Account Number"
                                value={data.accountNumber || ''}
                                onChange={(e) => handleFieldChange('accountNumber', e.target.value)}
                                error={!!errors.accountNumber}
                                helperText={errors.accountNumber}
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                            />
                        </Grid>

                        {/* Carrier Type */}
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth error={!!errors.type}>
                                <InputLabel sx={{ fontSize: '12px' }}>Carrier Type</InputLabel>
                                <Select
                                    value={data.type || 'courier'}
                                    onChange={(e) => handleFieldChange('type', e.target.value)}
                                    label="Carrier Type"
                                    sx={{ fontSize: '12px' }}
                                >
                                    {carrierTypes.map((type) => (
                                        <MenuItem key={type.value} value={type.value} sx={{ fontSize: '12px' }}>
                                            {type.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                                {errors.type && (
                                    <Typography sx={{ color: '#d32f2f', fontSize: '11px', mt: 0.5 }}>
                                        {errors.type}
                                    </Typography>
                                )}
                            </FormControl>
                        </Grid>

                        {/* Enabled Toggle */}
                        <Grid item xs={12} sm={6}>
                            <Box sx={{ display: 'flex', alignItems: 'center', height: '56px' }}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={data.enabled || false}
                                            onChange={(e) => handleFieldChange('enabled', e.target.checked)}
                                            color="primary"
                                        />
                                    }
                                    label={
                                        <Typography sx={{ fontSize: '12px' }}>
                                            {data.enabled ? 'Enabled' : 'Disabled'}
                                        </Typography>
                                    }
                                />
                            </Box>
                        </Grid>
                    </Grid>
                </Grid>
            </Grid>

            {/* Step Description */}
            <Box sx={{ mt: 4, p: 2, backgroundColor: '#f8fafc', borderRadius: 1 }}>
                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                    <strong>Carrier Information:</strong> Enter the basic information for your carrier.
                    The Carrier ID must be unique and will be used as the primary identifier.
                    Upload a logo to help identify the carrier in your system.
                </Typography>
            </Box>
        </Box>
    );
};

export default CarrierInfoStep; 