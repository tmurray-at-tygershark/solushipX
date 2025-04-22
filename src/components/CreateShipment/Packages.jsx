import React, { useState, useEffect } from 'react';
import { Switch, Paper, Typography, Box, Grid, TextField, Select, MenuItem, InputLabel, FormControl, Button, Divider, Tooltip, IconButton, InputAdornment, FormControlLabel } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Info as InfoIcon } from '@mui/icons-material';

const Packages = ({ data, onDataChange, onNext, onPrevious }) => {
    const defaultPackage = {
        itemDescription: '',
        packagingType: 258,
        packagingQuantity: 1,
        packageReferenceID: '',
        stackable: true,
        weight: '',
        height: '',
        width: '',
        length: '',
        freightClass: "50",
        declaredValue: 0.00,
        currency: 'USD' // Default currency
    };

    const [packages, setPackages] = useState(data?.length ? data : [defaultPackage]);
    const [unitSystem, setUnitSystem] = useState('imperial'); // 'imperial' or 'metric'
    const [currencies] = useState([
        { code: 'USD', symbol: '$', name: 'US Dollar' },
        { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' }
    ]);

    // Only handle initial data load and data prop changes
    useEffect(() => {
        if (data && data.length > 0) {
            setPackages(data);
        } else if (packages.length === 0) {
            setPackages([defaultPackage]);
        }
    }, [data]);

    // Conversion functions
    const lbsToKg = (lbs) => (lbs * 0.453592).toFixed(2);
    const kgToLbs = (kg) => (kg * 2.20462).toFixed(2);
    const inchesToCm = (inches) => (inches * 2.54).toFixed(1);
    const cmToInches = (cm) => (cm / 2.54).toFixed(1);

    const handleUnitChange = (event, newUnitSystem) => {
        if (newUnitSystem !== null) {
            // Convert all package measurements
            const updatedPackages = packages.map(pkg => {
                const updatedPkg = { ...pkg };

                // Convert weight
                if (pkg.weight) {
                    if (unitSystem === 'imperial' && newUnitSystem === 'metric') {
                        updatedPkg.weight = lbsToKg(pkg.weight);
                    } else if (unitSystem === 'metric' && newUnitSystem === 'imperial') {
                        updatedPkg.weight = kgToLbs(pkg.weight);
                    }
                }

                // Convert dimensions
                if (pkg.length) {
                    if (unitSystem === 'imperial' && newUnitSystem === 'metric') {
                        updatedPkg.length = inchesToCm(pkg.length);
                    } else if (unitSystem === 'metric' && newUnitSystem === 'imperial') {
                        updatedPkg.length = cmToInches(pkg.length);
                    }
                }

                if (pkg.width) {
                    if (unitSystem === 'imperial' && newUnitSystem === 'metric') {
                        updatedPkg.width = inchesToCm(pkg.width);
                    } else if (unitSystem === 'metric' && newUnitSystem === 'imperial') {
                        updatedPkg.width = cmToInches(pkg.width);
                    }
                }

                if (pkg.height) {
                    if (unitSystem === 'imperial' && newUnitSystem === 'metric') {
                        updatedPkg.height = inchesToCm(pkg.height);
                    } else if (unitSystem === 'metric' && newUnitSystem === 'imperial') {
                        updatedPkg.height = cmToInches(pkg.height);
                    }
                }

                return updatedPkg;
            });

            setPackages(updatedPackages);
            onDataChange(updatedPackages);
            setUnitSystem(event.target.checked ? 'metric' : 'imperial');
        }
    };

    const addPackage = () => {
        const newPackages = [...packages, {
            itemDescription: '',
            packagingType: 258,
            packagingQuantity: 1,
            packageReferenceID: '',
            stackable: true,
            weight: '',
            height: '',
            width: '',
            length: '',
            freightClass: "50",
            declaredValue: 0.00,
            currency: 'USD' // Default currency
        }];
        setPackages(newPackages);
        onDataChange(newPackages);
    };

    const removePackage = (index) => {
        const newPackages = packages.filter((_, i) => i !== index);
        setPackages(newPackages);
        onDataChange(newPackages);
    };

    const updatePackage = (index, field, value) => {
        const updatedPackages = [...packages];
        updatedPackages[index] = {
            ...updatedPackages[index],
            [field]: value
        };
        setPackages(updatedPackages);
        onDataChange(updatedPackages);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const form = e.target.closest('form');
        if (form.checkValidity()) {
            onNext();
        }
        form.classList.add('was-validated');
    };

    return (
        <div className="form-section">
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 600, color: 'text.primary' }}>
                    Package Information
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Add details about your packages for shipping
                </Typography>
            </Box>

            <div className="package-list">
                {packages.map((pkg, index) => (
                    <Paper
                        key={index}
                        elevation={2}
                        sx={{
                            p: 3,
                            mb: 3,
                            borderRadius: 2,
                            border: '1px solid',
                            borderColor: 'divider',
                            '&:hover': {
                                boxShadow: 3
                            },
                            position: 'relative',
                            overflow: 'hidden'
                        }}
                    >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                Package {index + 1}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                {packages.length > 1 && (
                                    <Tooltip title="Remove Package">
                                        <IconButton
                                            onClick={() => removePackage(index)}
                                            size="small"
                                            sx={{ color: 'error.main' }}
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Box>
                        </Box>

                        <Grid container spacing={3}>
                            <Grid item xs={12} md={5}>
                                <TextField
                                    fullWidth
                                    label="Item Description"
                                    value={pkg.itemDescription || ''}
                                    onChange={(e) => updatePackage(index, 'itemDescription', e.target.value)}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12} md={4}>
                                <FormControl fullWidth required>
                                    <InputLabel>Packaging Type</InputLabel>
                                    <Select
                                        value={pkg.packagingType || ''}
                                        onChange={(e) => updatePackage(index, 'packagingType', e.target.value)}
                                        label="Packaging Type"
                                    >
                                        <MenuItem value={258}>Standard Wooden Pallet</MenuItem>
                                        <MenuItem value={259}>Oversized Pallet</MenuItem>
                                        <MenuItem value={260}>Box</MenuItem>
                                        <MenuItem value={261}>Crate</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={3}>
                                <FormControl fullWidth required>
                                    <InputLabel>Qty</InputLabel>
                                    <Select
                                        value={pkg.packagingQuantity || ''}
                                        onChange={(e) => updatePackage(index, 'packagingQuantity', e.target.value)}
                                        label="Qty"
                                    >
                                        {[...Array(20)].map((_, i) => (
                                            <MenuItem key={i + 1} value={i + 1}>
                                                {i + 1}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Package Reference ID"
                                    placeholder="Enter package reference ID for tracking"
                                    value={pkg.packageReferenceID || ''}
                                    onChange={(e) => updatePackage(index, 'packageReferenceID', e.target.value)}
                                    helperText="Optional: Used to track individual packages within a shipment"
                                />
                            </Grid>

                            {/* Unit Toggle and Dimensions Section */}
                            <Grid item xs={12} md={2.4}>
                                <TextField
                                    fullWidth
                                    label="Weight"
                                    type="number"
                                    value={pkg.weight || ''}
                                    onChange={(e) => updatePackage(index, 'weight', e.target.value)}
                                    required
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <Box
                                                    sx={{
                                                        bgcolor: 'grey.800',
                                                        color: 'white',
                                                        px: 1,
                                                        py: 0.5,
                                                        borderRadius: 1,
                                                        fontSize: '0.875rem'
                                                    }}
                                                >
                                                    {unitSystem === 'metric' ? 'kg' : 'lbs'}
                                                </Box>
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} md={2.4}>
                                <TextField
                                    fullWidth
                                    label="Length"
                                    type="number"
                                    value={pkg.length || ''}
                                    onChange={(e) => updatePackage(index, 'length', e.target.value)}
                                    required
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <Box
                                                    sx={{
                                                        bgcolor: 'grey.800',
                                                        color: 'white',
                                                        px: 1,
                                                        py: 0.5,
                                                        borderRadius: 1,
                                                        fontSize: '0.875rem'
                                                    }}
                                                >
                                                    {unitSystem === 'metric' ? 'cm' : 'in'}
                                                </Box>
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} md={2.4}>
                                <TextField
                                    fullWidth
                                    label="Width"
                                    type="number"
                                    value={pkg.width || ''}
                                    onChange={(e) => updatePackage(index, 'width', e.target.value)}
                                    required
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <Box
                                                    sx={{
                                                        bgcolor: 'grey.800',
                                                        color: 'white',
                                                        px: 1,
                                                        py: 0.5,
                                                        borderRadius: 1,
                                                        fontSize: '0.875rem'
                                                    }}
                                                >
                                                    {unitSystem === 'metric' ? 'cm' : 'in'}
                                                </Box>
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} md={2.4}>
                                <TextField
                                    fullWidth
                                    label="Height"
                                    type="number"
                                    value={pkg.height || ''}
                                    onChange={(e) => updatePackage(index, 'height', e.target.value)}
                                    required
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <Box
                                                    sx={{
                                                        bgcolor: 'grey.800',
                                                        color: 'white',
                                                        px: 1,
                                                        py: 0.5,
                                                        borderRadius: 1,
                                                        fontSize: '0.875rem'
                                                    }}
                                                >
                                                    {unitSystem === 'metric' ? 'cm' : 'in'}
                                                </Box>
                                            </InputAdornment>
                                        ),
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} md={2.4} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="body2" color="text.secondary">Imperial</Typography>
                                    <Switch
                                        checked={unitSystem === 'metric'}
                                        onChange={handleUnitChange}
                                        sx={{
                                            '& .MuiSwitch-switchBase.Mui-checked': {
                                                color: 'primary.main',
                                                '&:hover': {
                                                    backgroundColor: 'primary.light'
                                                }
                                            },
                                            '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                                backgroundColor: 'primary.main'
                                            }
                                        }}
                                    />
                                    <Typography variant="body2" color="text.secondary">Metric</Typography>
                                </Box>
                            </Grid>
                            <Grid item xs={12}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={pkg.stackable || false}
                                            onChange={(e) => updatePackage(index, 'stackable', e.target.checked)}
                                            sx={{
                                                '& .MuiSwitch-switchBase.Mui-checked': {
                                                    color: 'primary.main',
                                                    '&:hover': {
                                                        backgroundColor: 'primary.light'
                                                    }
                                                },
                                                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                                    backgroundColor: 'primary.main'
                                                }
                                            }}
                                        />
                                    }
                                    label="Stackable"
                                />
                            </Grid>
                        </Grid>
                    </Paper>
                ))}
            </div>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 4 }}>
                <Button
                    variant="outlined"
                    startIcon={<AddIcon />}
                    onClick={addPackage}
                    sx={{
                        py: 1.5,
                        borderStyle: 'dashed',
                        borderWidth: 2,
                        '&:hover': {
                            borderWidth: 2,
                            backgroundColor: 'action.hover'
                        }
                    }}
                >
                    Add Another Package
                </Button>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                    <Button
                        variant="outlined"
                        onClick={onPrevious}
                        sx={{ px: 4 }}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleSubmit}
                        sx={{ px: 4 }}
                    >
                        Next
                    </Button>
                </Box>
            </Box>
        </div>
    );
};

export default Packages; 