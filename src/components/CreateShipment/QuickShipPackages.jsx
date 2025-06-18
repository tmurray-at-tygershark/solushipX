import React from 'react';
import {
    Box,
    Grid,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Typography,
    Button,
    Paper,
    IconButton
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useShipmentForm } from '../../contexts/ShipmentFormContext';

const QuickShipPackages = ({ onNext }) => {
    const { formData, updateFormSection } = useShipmentForm();

    const packages = formData.packages || [{
        type: 'Package',
        length: '',
        width: '',
        height: '',
        weight: '',
        quantity: 1,
        description: ''
    }];

    const handlePackageChange = (index, field, value) => {
        const updatedPackages = [...packages];
        updatedPackages[index] = { ...updatedPackages[index], [field]: value };
        updateFormSection('packages', updatedPackages);
    };

    const addPackage = () => {
        const newPackage = {
            type: 'Package',
            length: '',
            width: '',
            height: '',
            weight: '',
            quantity: 1,
            description: ''
        };
        updateFormSection('packages', [...packages, newPackage]);
    };

    const removePackage = (index) => {
        if (packages.length > 1) {
            const updatedPackages = packages.filter((_, i) => i !== index);
            updateFormSection('packages', updatedPackages);
        }
    };

    const handleSubmit = () => {
        if (onNext) {
            onNext(packages);
        }
    };

    // Auto-submit when at least one package has weight and dimensions
    React.useEffect(() => {
        const hasValidPackage = packages.some(pkg =>
            pkg.weight && pkg.length && pkg.width && pkg.height
        );
        if (hasValidPackage) {
            handleSubmit();
        }
    }, [packages]);

    return (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                    Package Information
                </Typography>
                <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={addPackage}
                    sx={{ fontSize: '12px' }}
                >
                    Add Package
                </Button>
            </Box>

            {packages.map((pkg, index) => (
                <Paper
                    key={index}
                    sx={{
                        p: 2,
                        mb: 2,
                        border: '1px solid #e5e7eb',
                        position: 'relative'
                    }}
                >
                    {packages.length > 1 && (
                        <IconButton
                            size="small"
                            onClick={() => removePackage(index)}
                            sx={{
                                position: 'absolute',
                                top: 8,
                                right: 8,
                                color: '#ef4444'
                            }}
                        >
                            <DeleteIcon fontSize="small" />
                        </IconButton>
                    )}

                    <Typography variant="subtitle2" sx={{ fontSize: '12px', mb: 2, color: '#6b7280' }}>
                        Package {index + 1}
                    </Typography>

                    <Grid container spacing={2}>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Type</InputLabel>
                                <Select
                                    value={pkg.type || 'Package'}
                                    onChange={(e) => handlePackageChange(index, 'type', e.target.value)}
                                    label="Type"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    <MenuItem value="Package" sx={{ fontSize: '12px' }}>Package</MenuItem>
                                    <MenuItem value="Box" sx={{ fontSize: '12px' }}>Box</MenuItem>
                                    <MenuItem value="Envelope" sx={{ fontSize: '12px' }}>Envelope</MenuItem>
                                    <MenuItem value="Tube" sx={{ fontSize: '12px' }}>Tube</MenuItem>
                                    <MenuItem value="Pallet" sx={{ fontSize: '12px' }}>Pallet</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={6} md={2}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Length"
                                type="number"
                                value={pkg.length || ''}
                                onChange={(e) => handlePackageChange(index, 'length', e.target.value)}
                                InputProps={{
                                    endAdornment: <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>cm</Typography>
                                }}
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>

                        <Grid item xs={6} md={2}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Width"
                                type="number"
                                value={pkg.width || ''}
                                onChange={(e) => handlePackageChange(index, 'width', e.target.value)}
                                InputProps={{
                                    endAdornment: <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>cm</Typography>
                                }}
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>

                        <Grid item xs={6} md={2}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Height"
                                type="number"
                                value={pkg.height || ''}
                                onChange={(e) => handlePackageChange(index, 'height', e.target.value)}
                                InputProps={{
                                    endAdornment: <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>cm</Typography>
                                }}
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>

                        <Grid item xs={6} md={2}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Weight"
                                type="number"
                                value={pkg.weight || ''}
                                onChange={(e) => handlePackageChange(index, 'weight', e.target.value)}
                                InputProps={{
                                    endAdornment: <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>kg</Typography>
                                }}
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>

                        <Grid item xs={6} md={1}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Qty"
                                type="number"
                                value={pkg.quantity || 1}
                                onChange={(e) => handlePackageChange(index, 'quantity', parseInt(e.target.value) || 1)}
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Description"
                                value={pkg.description || ''}
                                onChange={(e) => handlePackageChange(index, 'description', e.target.value)}
                                sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            />
                        </Grid>
                    </Grid>
                </Paper>
            ))}
        </Box>
    );
};

export default QuickShipPackages; 