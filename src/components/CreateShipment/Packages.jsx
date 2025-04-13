import React, { useState, useEffect } from 'react';
import { Switch, FormControlLabel, Paper, Typography, Box, Grid, TextField, Select, MenuItem, InputLabel, FormControl, Button, ToggleButton, ToggleButtonGroup, Divider, Tooltip, IconButton } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Info as InfoIcon } from '@mui/icons-material';

const Packages = ({ data, onDataChange, onNext, onPrevious }) => {
    const [packages, setPackages] = useState(data || []);
    const [unitSystem, setUnitSystem] = useState('imperial'); // 'imperial' or 'metric'
    const [currencies] = useState([
        { code: 'USD', symbol: '$', name: 'US Dollar' },
        { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' }
    ]);

    // Only handle initial data load and data prop changes
    useEffect(() => {
        if (data && data.length > 0) {
            setPackages(data);
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
            setUnitSystem(newUnitSystem);
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
                            <Grid item xs={12} md={7}>
                                <TextField
                                    fullWidth
                                    label="Item Description"
                                    value={pkg.itemDescription || ''}
                                    onChange={(e) => updatePackage(index, 'itemDescription', e.target.value)}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12} md={5}>
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
                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth required>
                                    <InputLabel>Qty</InputLabel>
                                    <Select
                                        value={pkg.packagingQuantity || ''}
                                        onChange={(e) => updatePackage(index, 'packagingQuantity', e.target.value)}
                                        label="Qty"
                                    >
                                        {[...Array(100)].map((_, i) => (
                                            <MenuItem key={i + 1} value={i + 1}>
                                                {i + 1}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label="Package Reference ID"
                                    placeholder="Enter package reference ID for tracking"
                                    value={pkg.packageReferenceID || ''}
                                    onChange={(e) => updatePackage(index, 'packageReferenceID', e.target.value)}
                                    helperText="Optional: Used to track individual packages within a shipment"
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label="Weight"
                                    type="number"
                                    value={pkg.weight || ''}
                                    onChange={(e) => updatePackage(index, 'weight', e.target.value)}
                                    required
                                    InputProps={{
                                        endAdornment: <InputAdornment position="end">{unitSystem === 'metric' ? 'kg' : 'lbs'}</InputAdornment>,
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label="Length"
                                    type="number"
                                    value={pkg.length || ''}
                                    onChange={(e) => updatePackage(index, 'length', e.target.value)}
                                    required
                                    InputProps={{
                                        endAdornment: <InputAdornment position="end">{unitSystem === 'metric' ? 'cm' : 'in'}</InputAdornment>,
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label="Width"
                                    type="number"
                                    value={pkg.width || ''}
                                    onChange={(e) => updatePackage(index, 'width', e.target.value)}
                                    required
                                    InputProps={{
                                        endAdornment: <InputAdornment position="end">{unitSystem === 'metric' ? 'cm' : 'in'}</InputAdornment>,
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label="Height"
                                    type="number"
                                    value={pkg.height || ''}
                                    onChange={(e) => updatePackage(index, 'height', e.target.value)}
                                    required
                                    InputProps={{
                                        endAdornment: <InputAdornment position="end">{unitSystem === 'metric' ? 'cm' : 'in'}</InputAdornment>,
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth required>
                                    <InputLabel>Freight Class</InputLabel>
                                    <Select
                                        value={pkg.freightClass || ''}
                                        onChange={(e) => updatePackage(index, 'freightClass', e.target.value)}
                                        label="Freight Class"
                                    >
                                        {[50, 55, 60, 65, 70, 77.5, 85, 92.5, 100, 110, 125, 150, 175, 200, 250, 300, 400, 500].map((value) => (
                                            <MenuItem key={value} value={value.toString()}>{value}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label="Declared Value"
                                    type="number"
                                    value={pkg.declaredValue || ''}
                                    onChange={(e) => updatePackage(index, 'declaredValue', e.target.value)}
                                    required
                                    InputProps={{
                                        startAdornment: <InputAdornment position="start">$</InputAdornment>,
                                    }}
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <FormControlLabel
                                    control={
                                        <Switch
                                            checked={pkg.stackable || false}
                                            onChange={(e) => updatePackage(index, 'stackable', e.target.checked)}
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