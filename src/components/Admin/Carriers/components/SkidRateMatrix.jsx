/**
 * Skid-Based Rate Matrix Component
 * 
 * Provides a spreadsheet-style interface for configuring rates:
 * - Pickup cities as rows (vertical)
 * - Skid quantities as columns (horizontal) 
 * - Pricing at intersection cells
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Paper, Typography, Button, TextField, Table, TableBody,
    TableCell, TableContainer, TableHead, TableRow, Grid,
    FormControl, InputLabel, Select, MenuItem, Chip, Alert
} from '@mui/material';
import {
    CloudUpload as ImportIcon,
    CloudDownload as ExportIcon,
    Save as SaveIcon,
    Clear as ClearIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';

const SkidRateMatrix = ({
    carrierId,
    carrierName,
    pickupCities = [],
    selectedService = 'LTL',
    selectedServiceType = 'Standard',
    onSave
}) => {
    const { enqueueSnackbar } = useSnackbar();

    // Matrix state - stores rates for each pickup city + skid combination
    const [rateMatrix, setRateMatrix] = useState({});
    const [editingCell, setEditingCell] = useState(null);
    const [tempValue, setTempValue] = useState('');
    const [currency, setCurrency] = useState('CAD');
    const [hasChanges, setHasChanges] = useState(false);

    // Define skid columns (1-12 skids like in your example)
    const skidColumns = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

    // Service options
    const services = ['LTL', 'FTL', 'Courier', 'Express', 'Freight'];
    const serviceTypes = {
        'LTL': ['Standard', 'Rush', 'Direct'],
        'FTL': ['Standard', 'Rush', 'Direct'],
        'Courier': ['Sameday', 'Nextday', 'Standard'],
        'Express': ['Sameday', 'Rush', 'Standard'],
        'Freight': ['Standard', 'Rush', 'Direct']
    };

    // Get rate for a specific cell
    const getRate = useCallback((pickupCity, skidCount) => {
        const key = `${pickupCity}_${selectedService}_${selectedServiceType}`;
        return rateMatrix[key]?.[skidCount] || 0;
    }, [rateMatrix, selectedService, selectedServiceType]);

    // Handle cell edit
    const handleCellEdit = useCallback((pickupCity, skidCount, value) => {
        const numericValue = parseFloat(value) || 0;
        const key = `${pickupCity}_${selectedService}_${selectedServiceType}`;

        setRateMatrix(prev => ({
            ...prev,
            [key]: {
                ...prev[key],
                [skidCount]: numericValue
            }
        }));

        setHasChanges(true);
    }, [selectedService, selectedServiceType]);

    // Handle CSV export - matches your exact format
    const handleExportCSV = useCallback(() => {
        if (pickupCities.length === 0) {
            enqueueSnackbar('No pickup cities available for export', { variant: 'warning' });
            return;
        }

        // Create CSV header exactly like your example
        let csvContent = 'PICKUP CITY,1 SKID,2 SKIDS,3 SKIDS,4 SKIDS,5 SKIDS,6 SKIDS,7 SKIDS,8 SKIDS,9 SKIDS,10 SKIDS,11 SKIDS,12 SKIDS\n';

        // Add data rows
        pickupCities.forEach(city => {
            const row = [city.toUpperCase()];
            skidColumns.forEach(skidCount => {
                const rate = getRate(city, skidCount);
                row.push(rate > 0 ? `$${rate.toFixed(2)}` : '$0.00');
            });
            csvContent += row.join(',') + '\n';
        });

        // Download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${carrierName}_${selectedService}_${selectedServiceType}_Rate_Matrix.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        enqueueSnackbar('Rate matrix exported successfully!', { variant: 'success' });
    }, [pickupCities, skidColumns, getRate, carrierName, selectedService, selectedServiceType, enqueueSnackbar]);

    // Handle CSV import
    const handleImportCSV = useCallback((event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const csv = e.target.result;
                const lines = csv.split('\n');
                const header = lines[0].split(',');

                // Validate header format
                if (!header[0].includes('PICKUP CITY')) {
                    throw new Error('Invalid CSV format. First column must be "PICKUP CITY"');
                }

                const newMatrix = { ...rateMatrix };
                const key = `${selectedService}_${selectedServiceType}`;

                // Process data rows
                lines.slice(1).forEach(line => {
                    if (line.trim()) {
                        const cells = line.split(',');
                        const city = cells[0]?.trim().toUpperCase();

                        if (city && pickupCities.some(pc => pc.toUpperCase() === city)) {
                            const cityKey = `${city}_${selectedService}_${selectedServiceType}`;
                            newMatrix[cityKey] = {};

                            // Parse rate values for each skid count
                            skidColumns.forEach((skidCount, index) => {
                                const rateStr = cells[index + 1]?.trim() || '$0.00';
                                const rate = parseFloat(rateStr.replace(/[$,]/g, '')) || 0;
                                newMatrix[cityKey][skidCount] = rate;
                            });
                        }
                    }
                });

                setRateMatrix(newMatrix);
                setHasChanges(true);
                enqueueSnackbar('Rate matrix imported successfully!', { variant: 'success' });

            } catch (error) {
                enqueueSnackbar(`Import failed: ${error.message}`, { variant: 'error' });
            }
        };

        reader.readAsText(file);
        event.target.value = ''; // Reset file input
    }, [rateMatrix, selectedService, selectedServiceType, pickupCities, skidColumns, enqueueSnackbar]);

    // Save matrix to backend
    const handleSave = useCallback(async () => {
        try {
            // Here you would call your backend API to save the rate matrix
            // For now, just simulate success

            if (onSave) {
                await onSave(rateMatrix, selectedService, selectedServiceType);
            }

            setHasChanges(false);
            enqueueSnackbar('Rate matrix saved successfully!', { variant: 'success' });
        } catch (error) {
            enqueueSnackbar(`Save failed: ${error.message}`, { variant: 'error' });
        }
    }, [rateMatrix, selectedService, selectedServiceType, onSave, enqueueSnackbar]);

    // Clear all rates
    const handleClearAll = useCallback(() => {
        setRateMatrix({});
        setHasChanges(true);
        enqueueSnackbar('All rates cleared', { variant: 'info' });
    }, [enqueueSnackbar]);

    if (!pickupCities || pickupCities.length === 0) {
        return (
            <Alert severity="warning" sx={{ m: 2 }}>
                No pickup cities available. Please configure pickup locations first in the previous steps.
            </Alert>
        );
    }

    return (
        <Box>
            {/* Header */}
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <Box>
                    <Typography sx={{ fontSize: '18px', fontWeight: 600, color: '#374151', mb: 1 }}>
                        Skid-Based Rate Matrix
                    </Typography>
                    <Typography sx={{ fontSize: '13px', color: '#6b7280' }}>
                        Configure pricing for each pickup city across different skid quantities
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        variant="outlined"
                        component="label"
                        size="small"
                        startIcon={<ImportIcon />}
                        sx={{ fontSize: '12px' }}
                    >
                        Import CSV
                        <input
                            type="file"
                            accept=".csv"
                            hidden
                            onChange={handleImportCSV}
                        />
                    </Button>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ExportIcon />}
                        onClick={handleExportCSV}
                        sx={{ fontSize: '12px' }}
                    >
                        Export CSV
                    </Button>
                </Box>
            </Box>

            {/* Controls */}
            <Paper sx={{ p: 2, mb: 3, border: '1px solid #e5e7eb' }}>
                <Grid container spacing={2} alignItems="center">
                    <Grid item xs={12} sm={3}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Service</InputLabel>
                            <Select
                                value={selectedService}
                                label="Service"
                                disabled // Controlled by parent component
                            >
                                {services.map(service => (
                                    <MenuItem key={service} value={service}>{service}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={3}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Service Type</InputLabel>
                            <Select
                                value={selectedServiceType}
                                label="Service Type"
                                disabled // Controlled by parent component
                            >
                                {serviceTypes[selectedService]?.map(type => (
                                    <MenuItem key={type} value={type}>{type}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={2}>
                        <FormControl fullWidth size="small">
                            <InputLabel>Currency</InputLabel>
                            <Select
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                label="Currency"
                            >
                                <MenuItem value="CAD">CAD</MenuItem>
                                <MenuItem value="USD">USD</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} sm={2}>
                        <Chip
                            label={`${pickupCities.length} Cities`}
                            color="primary"
                            size="small"
                            sx={{ fontSize: '11px' }}
                        />
                    </Grid>
                    <Grid item xs={12} sm={2}>
                        {hasChanges && (
                            <Chip
                                label="Unsaved Changes"
                                color="warning"
                                size="small"
                                sx={{ fontSize: '11px' }}
                            />
                        )}
                    </Grid>
                </Grid>
            </Paper>

            {/* Rate Matrix Table - Exactly matching your spreadsheet format */}
            <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb', borderRadius: 1, maxHeight: 600 }}>
                <Table size="small" stickyHeader>
                    <TableHead>
                        <TableRow>
                            {/* Header exactly like your example */}
                            <TableCell
                                sx={{
                                    fontWeight: 600,
                                    fontSize: '11px',
                                    color: 'white',
                                    backgroundColor: '#f59e0b', // Orange header like your example
                                    minWidth: 140,
                                    position: 'sticky',
                                    left: 0,
                                    zIndex: 10,
                                    textAlign: 'center'
                                }}
                            >
                                PICKUP CITY
                            </TableCell>
                            {skidColumns.map(skidCount => (
                                <TableCell
                                    key={skidCount}
                                    sx={{
                                        fontWeight: 600,
                                        fontSize: '11px',
                                        color: 'white',
                                        backgroundColor: '#f59e0b',
                                        textAlign: 'center',
                                        minWidth: 90
                                    }}
                                >
                                    {skidCount} SKID{skidCount > 1 ? 'S' : ''}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {pickupCities.map((city, cityIndex) => (
                            <TableRow
                                key={city}
                                hover
                                sx={{
                                    backgroundColor: cityIndex % 2 === 0 ? '#f9fafb' : 'white',
                                    '&:hover': { backgroundColor: '#f0f9ff' }
                                }}
                            >
                                {/* City name cell - Green background like your example */}
                                <TableCell
                                    sx={{
                                        fontWeight: 600,
                                        fontSize: '12px',
                                        color: 'white',
                                        backgroundColor: cityIndex % 2 === 0 ? '#22c55e' : '#16a34a', // Green background
                                        position: 'sticky',
                                        left: 0,
                                        zIndex: 9,
                                        textAlign: 'center'
                                    }}
                                >
                                    {city.toUpperCase()}
                                </TableCell>

                                {/* Rate cells for each skid quantity */}
                                {skidColumns.map(skidCount => {
                                    const rate = getRate(city, skidCount);
                                    const isEditing = editingCell === `${city}_${skidCount}`;

                                    return (
                                        <TableCell
                                            key={skidCount}
                                            sx={{
                                                textAlign: 'center',
                                                p: 0.5,
                                                cursor: 'pointer',
                                                '&:hover': { backgroundColor: '#e0f2fe' }
                                            }}
                                            onClick={() => {
                                                setEditingCell(`${city}_${skidCount}`);
                                                setTempValue(rate > 0 ? rate.toString() : '');
                                            }}
                                        >
                                            {isEditing ? (
                                                <TextField
                                                    size="small"
                                                    value={tempValue}
                                                    onChange={(e) => setTempValue(e.target.value)}
                                                    onBlur={() => {
                                                        handleCellEdit(city, skidCount, tempValue);
                                                        setEditingCell(null);
                                                    }}
                                                    onKeyPress={(e) => {
                                                        if (e.key === 'Enter') {
                                                            handleCellEdit(city, skidCount, tempValue);
                                                            setEditingCell(null);
                                                        }
                                                        if (e.key === 'Escape') {
                                                            setEditingCell(null);
                                                        }
                                                    }}
                                                    autoFocus
                                                    placeholder="0.00"
                                                    inputProps={{
                                                        style: {
                                                            textAlign: 'center',
                                                            fontSize: '11px',
                                                            padding: '4px 8px'
                                                        }
                                                    }}
                                                    sx={{ width: '80px' }}
                                                />
                                            ) : (
                                                <Typography
                                                    sx={{
                                                        fontSize: '11px',
                                                        color: rate > 0 ? '#374151' : '#9ca3af',
                                                        fontWeight: rate > 0 ? 600 : 400
                                                    }}
                                                >
                                                    ${rate > 0 ? rate.toFixed(2) : '0.00'}
                                                </Typography>
                                            )}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Summary and Actions */}
            <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                    Matrix: {pickupCities.length} pickup cities × {skidColumns.length} skid quantities = {pickupCities.length * skidColumns.length} rate cells
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        variant="outlined"
                        size="small"
                        startIcon={<ClearIcon />}
                        onClick={handleClearAll}
                        sx={{ fontSize: '11px' }}
                        disabled={Object.keys(rateMatrix).length === 0}
                    >
                        Clear All
                    </Button>
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<SaveIcon />}
                        onClick={handleSave}
                        sx={{ fontSize: '11px' }}
                        disabled={!hasChanges}
                    >
                        Save Matrix
                    </Button>
                </Box>
            </Box>

            {/* Instructions */}
            <Box sx={{ mt: 2, p: 2, backgroundColor: '#eff6ff', borderRadius: 1, border: '1px solid #3b82f6' }}>
                <Typography sx={{ fontSize: '12px', color: '#1e40af', mb: 1, fontWeight: 600 }}>
                    💡 How to use the Rate Matrix:
                </Typography>
                <Box component="ul" sx={{ fontSize: '11px', color: '#1e40af', pl: 2, m: 0 }}>
                    <li><strong>Click any cell</strong> to edit the rate for that pickup city + skid quantity</li>
                    <li><strong>Press Enter</strong> to save, <strong>Escape</strong> to cancel editing</li>
                    <li><strong>Export to CSV</strong> to get the exact format you showed</li>
                    <li><strong>Import from CSV</strong> to bulk update rates</li>
                </Box>
            </Box>
        </Box>
    );
};

export default SkidRateMatrix;
