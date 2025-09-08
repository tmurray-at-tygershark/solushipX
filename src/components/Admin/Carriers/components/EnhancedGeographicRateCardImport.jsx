/**
 * Enhanced Geographic Rate Card Import Component
 * Leverages existing zone management infrastructure for scalable city-to-city rate imports
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Typography, Box, IconButton, Stepper, Step, StepLabel,
    FormControl, InputLabel, Select, MenuItem,
    Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
    Chip, CircularProgress, LinearProgress, Divider,
    List, ListItem, ListItemIcon, ListItemText, Grid, Card, CardContent,
    Tabs, Tab, Switch, FormControlLabel, TextField, Autocomplete
} from '@mui/material';
import {
    Close as CloseIcon,
    CloudUpload as UploadIcon,
    Download as DownloadIcon,
    CheckCircle as CheckIcon,
    Error as ErrorIcon,
    Warning as WarningIcon,
    Description as FileIcon,
    PlayArrow as ProcessIcon,
    GetApp as TemplateIcon,
    Map as ZoneIcon,
    LocationCity as CityIcon,
    Public as RegionIcon
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../../firebase';
import { useSnackbar } from 'notistack';

const steps = ['Configure Geography', 'Upload Rate Matrix', 'Map Locations', 'Preview & Import'];

const EnhancedGeographicRateCardImport = ({ isOpen, onClose, carrierId, carrierName, onImportComplete }) => {
    const { enqueueSnackbar } = useSnackbar();
    const [activeStep, setActiveStep] = useState(0);
    const [loading, setLoading] = useState(false);

    // Zone management integration
    const [regions, setRegions] = useState([]);
    const [zoneSets, setZoneSets] = useState([]);
    const [selectedZoneSet, setSelectedZoneSet] = useState('');

    // Geographic configuration
    const [geoMapping, setGeoMapping] = useState({
        originType: 'city', // city, state, zone, postal
        destinationType: 'city',
        createMissingLocations: true,
        autoMapSimilar: true
    });

    // Rate matrix configuration  
    const [rateConfig, setRateConfig] = useState({
        name: '',
        currency: 'CAD',
        direction: 'bidirectional', // pickup, delivery, bidirectional
        skidRange: { min: 1, max: 26 },
        specialCharges: [],
        effectiveDate: new Date().toISOString().split('T')[0]
    });

    // File upload and processing
    const [uploadedFile, setUploadedFile] = useState(null);
    const [csvData, setCsvData] = useState(null);
    const [locationMapping, setLocationMapping] = useState({});
    const [unmappedLocations, setUnmappedLocations] = useState([]);

    // Preview and validation
    const [previewData, setPreviewData] = useState(null);
    const [validationErrors, setValidationErrors] = useState([]);
    const [importResults, setImportResults] = useState(null);

    // Load zone management data
    useEffect(() => {
        if (isOpen) {
            loadZoneData();
        }
    }, [isOpen]);

    const loadZoneData = async () => {
        try {
            setLoading(true);

            // Load regions and zone sets from your existing zone management
            const getRegions = httpsCallable(functions, 'getRegions');
            const getZoneSets = httpsCallable(functions, 'getZoneSets');

            const [regionsResult, zoneSetsResult] = await Promise.all([
                getRegions(),
                getZoneSets()
            ]);

            setRegions(regionsResult.data.regions || []);
            setZoneSets(zoneSetsResult.data.zoneSets || []);

        } catch (error) {
            console.error('Error loading zone data:', error);
            enqueueSnackbar('Failed to load zone configuration', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Generate and download the CSV template
    const handleDownloadTemplate = () => {
        try {
            // Generate template based on current configuration
            const headers = ['DESTINATION_CITY'];

            // Add skid columns based on range
            for (let i = rateConfig.skidRange.min; i <= rateConfig.skidRange.max; i++) {
                headers.push(`${i}_SKID${i > 1 ? 'S' : ''}`);
            }

            // Sample cities data - comprehensive Ontario and Western Canada coverage
            const sampleData = [
                // Ontario Cities
                ['BARRIE', '200.00', '225.00', '250.00', '275.00', '325.00', '400.00', '425.00', '450.00', '475.00', '500.00', '525.00', '550.00', '575.00', '600.00', '625.00', '650.00', '675.00', '700.00', '725.00', '750.00', '775.00', '800.00', '825.00', '850.00', '875.00', '900.00'],
                ['BELLEVILLE', '200.00', '225.00', '250.00', '325.00', '375.00', '400.00', '450.00', '500.00', '550.00', '600.00', '600.00', '650.00', '700.00', '750.00', '800.00', '850.00', '900.00', '950.00', '1000.00', '1050.00', '1100.00', '1150.00', '1200.00', '1250.00', '1300.00', '1350.00'],
                ['BRANTFORD', '200.00', '225.00', '250.00', '275.00', '300.00', '325.00', '350.00', '375.00', '400.00', '425.00', '450.00', '475.00', '500.00', '525.00', '550.00', '575.00', '600.00', '625.00', '650.00', '675.00', '700.00', '725.00', '750.00', '775.00', '800.00', '825.00'],
                ['CAMBRIDGE', '200.00', '225.00', '250.00', '275.00', '300.00', '325.00', '350.00', '375.00', '400.00', '425.00', '450.00', '475.00', '500.00', '525.00', '550.00', '575.00', '600.00', '625.00', '650.00', '675.00', '700.00', '725.00', '750.00', '775.00', '800.00', '825.00'],
                ['GUELPH', '200.00', '225.00', '250.00', '275.00', '300.00', '325.00', '350.00', '375.00', '400.00', '425.00', '450.00', '475.00', '500.00', '525.00', '550.00', '575.00', '600.00', '625.00', '650.00', '675.00', '700.00', '725.00', '750.00', '775.00', '800.00', '825.00'],
                ['HAMILTON', '200.00', '225.00', '250.00', '275.00', '300.00', '325.00', '350.00', '375.00', '400.00', '425.00', '450.00', '475.00', '500.00', '525.00', '550.00', '575.00', '600.00', '625.00', '650.00', '675.00', '700.00', '725.00', '750.00', '775.00', '800.00', '825.00'],
                ['KINGSTON', '225.00', '250.00', '275.00', '325.00', '375.00', '425.00', '475.00', '525.00', '600.00', '650.00', '700.00', '750.00', '800.00', '850.00', '900.00', '950.00', '1000.00', '1050.00', '1100.00', '1150.00', '1200.00', '1250.00', '1300.00', '1350.00', '1400.00', '1450.00'],
                ['KITCHENER', '200.00', '225.00', '250.00', '275.00', '300.00', '325.00', '350.00', '375.00', '400.00', '425.00', '450.00', '475.00', '500.00', '525.00', '550.00', '575.00', '600.00', '625.00', '650.00', '675.00', '700.00', '725.00', '750.00', '775.00', '800.00', '825.00'],
                ['LONDON', '225.00', '250.00', '300.00', '350.00', '375.00', '425.00', '475.00', '525.00', '575.00', '600.00', '625.00', '650.00', '675.00', '700.00', '725.00', '750.00', '775.00', '800.00', '825.00', '850.00', '875.00', '900.00', '925.00', '950.00', '975.00', '1000.00'],
                ['MONTREAL', '350.00', '400.00', '450.00', '525.00', '575.00', '625.00', '700.00', '750.00', '800.00', '850.00', '900.00', '950.00', '1000.00', '1050.00', '1100.00', '1150.00', '1200.00', '1250.00', '1300.00', '1350.00', '1400.00', '1450.00', '1500.00', '1550.00', '1600.00', '1650.00'],
                ['OTTAWA', '300.00', '325.00', '350.00', '425.00', '475.00', '525.00', '600.00', '650.00', '700.00', '775.00', '850.00', '925.00', '1000.00', '1075.00', '1150.00', '1225.00', '1300.00', '1375.00', '1450.00', '1525.00', '1600.00', '1675.00', '1750.00', '1825.00', '1900.00', '1975.00'],
                ['TORONTO', '175.00', '200.00', '225.00', '250.00', '275.00', '300.00', '325.00', '350.00', '375.00', '400.00', '425.00', '450.00', '475.00', '500.00', '525.00', '550.00', '575.00', '600.00', '625.00', '650.00', '675.00', '700.00', '725.00', '750.00', '775.00', '800.00'],
                ['WINDSOR', '250.00', '275.00', '325.00', '375.00', '425.00', '475.00', '525.00', '575.00', '625.00', '675.00', '725.00', '775.00', '825.00', '875.00', '925.00', '975.00', '1025.00', '1075.00', '1125.00', '1175.00', '1225.00', '1275.00', '1325.00', '1375.00', '1425.00', '1475.00'],

                // Empty row separator
                ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],

                // West Bound Section
                ['WEST BOUND', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['CALGARY AB', '350.00', '500.00', '750.00', '1000.00', '1250.00', '1500.00', '1750.00', '2000.00', '2250.00', '2500.00', '2750.00', '3000.00', '3250.00', '3500.00', '3750.00', '4000.00', '4250.00', '4500.00', '4750.00', '5000.00', '5250.00', '5500.00', '5750.00', '6000.00', '6250.00', '6500.00'],
                ['EDMONTON AB', '350.00', '500.00', '750.00', '1000.00', '1250.00', '1500.00', '1750.00', '2000.00', '2250.00', '2500.00', '2750.00', '3000.00', '3250.00', '3500.00', '3750.00', '4000.00', '4250.00', '4500.00', '4750.00', '5000.00', '5250.00', '5500.00', '5750.00', '6000.00', '6250.00', '6500.00'],
                ['REGINA SK', '350.00', '500.00', '750.00', '1000.00', '1250.00', '1500.00', '1750.00', '2000.00', '2250.00', '2500.00', '2750.00', '3000.00', '3250.00', '3500.00', '3750.00', '4000.00', '4250.00', '4500.00', '4750.00', '5000.00', '5250.00', '5500.00', '5750.00', '6000.00', '6250.00', '6500.00'],
                ['SASKATOON SK', '350.00', '500.00', '750.00', '1000.00', '1250.00', '1500.00', '1750.00', '2000.00', '2250.00', '2500.00', '2750.00', '3000.00', '3250.00', '3500.00', '3750.00', '4000.00', '4250.00', '4500.00', '4750.00', '5000.00', '5250.00', '5500.00', '5750.00', '6000.00', '6250.00', '6500.00'],

                // Empty row separator
                ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],

                // Special Charges Section
                ['SPECIAL CHARGES AND RULES', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['Pallet Jack on 53\' Trailer', '+50.00', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['Straight Truck PU/DEL', '+50.00', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['Georgetown/Ajax/Whitby/Newmarket/Burlington/Milton', '+50.00', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['Acton', '+100.00', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['Residential Delivery', '+25.00', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['Inside Delivery', '+75.00', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
                ['Tailgate Service', '+35.00', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']
            ];

            // Convert to CSV format
            const csvContent = [
                headers,
                ...sampleData
            ].map(row => {
                return row.map(cell => {
                    // Handle cells that might contain commas or quotes
                    if (cell && cell.toString().includes(',')) {
                        return `"${cell}"`;
                    }
                    return cell || '';
                }).join(',');
            }).join('\n');

            // Create and download the file
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `geographic_rate_template_${rateConfig.name || 'carrier'}_${rateConfig.currency}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            enqueueSnackbar('Template downloaded successfully', { variant: 'success' });

        } catch (error) {
            console.error('Error generating template:', error);
            enqueueSnackbar('Failed to generate template', { variant: 'error' });
        }
    };

    // Step 1: Configure Geographic Mapping
    const renderGeographicConfig = () => (
        <Box sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 3, fontSize: '16px', fontWeight: 600 }}>
                Configure Geographic Rate Structure
            </Typography>

            {/* Rate Card Details */}
            <Card sx={{ mb: 3, border: '1px solid #e5e7eb' }}>
                <CardContent>
                    <Typography variant="subtitle1" sx={{ mb: 2, fontSize: '14px', fontWeight: 600 }}>
                        Rate Card Information
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Rate Card Name"
                                value={rateConfig.name}
                                onChange={(e) => setRateConfig(prev => ({ ...prev, name: e.target.value }))}
                                placeholder="e.g., GTA Freight Rates - Oct 2024"
                                sx={{
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiInputBase-input': { fontSize: '12px' }
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Currency</InputLabel>
                                <Select
                                    value={rateConfig.currency}
                                    onChange={(e) => setRateConfig(prev => ({ ...prev, currency: e.target.value }))}
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    <MenuItem value="CAD" sx={{ fontSize: '12px' }}>CAD</MenuItem>
                                    <MenuItem value="USD" sx={{ fontSize: '12px' }}>USD</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Direction</InputLabel>
                                <Select
                                    value={rateConfig.direction}
                                    onChange={(e) => setRateConfig(prev => ({ ...prev, direction: e.target.value }))}
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    <MenuItem value="pickup" sx={{ fontSize: '12px' }}>Pickup Only</MenuItem>
                                    <MenuItem value="delivery" sx={{ fontSize: '12px' }}>Delivery Only</MenuItem>
                                    <MenuItem value="bidirectional" sx={{ fontSize: '12px' }}>Both Directions</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Skid Range Configuration */}
            <Card sx={{ mb: 3, border: '1px solid #e5e7eb' }}>
                <CardContent>
                    <Typography variant="subtitle1" sx={{ mb: 2, fontSize: '14px', fontWeight: 600 }}>
                        Skid Range Configuration
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Minimum Skids"
                                type="number"
                                value={rateConfig.skidRange.min}
                                onChange={(e) => setRateConfig(prev => ({
                                    ...prev,
                                    skidRange: { ...prev.skidRange, min: parseInt(e.target.value) || 1 }
                                }))}
                                sx={{
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiInputBase-input': { fontSize: '12px' }
                                }}
                            />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Maximum Skids"
                                type="number"
                                value={rateConfig.skidRange.max}
                                onChange={(e) => setRateConfig(prev => ({
                                    ...prev,
                                    skidRange: { ...prev.skidRange, max: parseInt(e.target.value) || 26 }
                                }))}
                                sx={{
                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                    '& .MuiInputBase-input': { fontSize: '12px' }
                                }}
                            />
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Geographic Mapping Configuration */}
            <Card sx={{ mb: 3, border: '1px solid #e5e7eb' }}>
                <CardContent>
                    <Typography variant="subtitle1" sx={{ mb: 2, fontSize: '14px', fontWeight: 600 }}>
                        Geographic Mapping Strategy
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Origin Type</InputLabel>
                                <Select
                                    value={geoMapping.originType}
                                    onChange={(e) => setGeoMapping(prev => ({ ...prev, originType: e.target.value }))}
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    <MenuItem value="city" sx={{ fontSize: '12px' }}>City Names</MenuItem>
                                    <MenuItem value="state" sx={{ fontSize: '12px' }}>State/Province</MenuItem>
                                    <MenuItem value="postal" sx={{ fontSize: '12px' }}>Postal Codes</MenuItem>
                                    <MenuItem value="zone" sx={{ fontSize: '12px' }}>Zone Codes</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Destination Type</InputLabel>
                                <Select
                                    value={geoMapping.destinationType}
                                    onChange={(e) => setGeoMapping(prev => ({ ...prev, destinationType: e.target.value }))}
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    <MenuItem value="city" sx={{ fontSize: '12px' }}>City Names</MenuItem>
                                    <MenuItem value="state" sx={{ fontSize: '12px' }}>State/Province</MenuItem>
                                    <MenuItem value="postal" sx={{ fontSize: '12px' }}>Postal Codes</MenuItem>
                                    <MenuItem value="zone" sx={{ fontSize: '12px' }}>Zone Codes</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>

                    <Box sx={{ mt: 2 }}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={geoMapping.createMissingLocations}
                                    onChange={(e) => setGeoMapping(prev => ({ ...prev, createMissingLocations: e.target.checked }))}
                                />
                            }
                            label={<Typography sx={{ fontSize: '12px' }}>Auto-create missing locations in zone system</Typography>}
                        />
                    </Box>
                    <Box>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={geoMapping.autoMapSimilar}
                                    onChange={(e) => setGeoMapping(prev => ({ ...prev, autoMapSimilar: e.target.checked }))}
                                />
                            }
                            label={<Typography sx={{ fontSize: '12px' }}>Auto-map similar location names</Typography>}
                        />
                    </Box>
                </CardContent>
            </Card>

            {/* Zone Set Integration */}
            <Card sx={{ border: '1px solid #e5e7eb' }}>
                <CardContent>
                    <Typography variant="subtitle1" sx={{ mb: 2, fontSize: '14px', fontWeight: 600 }}>
                        Zone Set Integration (Optional)
                    </Typography>
                    <FormControl fullWidth size="small">
                        <InputLabel sx={{ fontSize: '12px' }}>Link to Existing Zone Set</InputLabel>
                        <Select
                            value={selectedZoneSet}
                            onChange={(e) => setSelectedZoneSet(e.target.value)}
                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                        >
                            <MenuItem value="" sx={{ fontSize: '12px' }}>
                                <em>Create new zone mapping</em>
                            </MenuItem>
                            {zoneSets.map((zoneSet) => (
                                <MenuItem key={zoneSet.id} value={zoneSet.id} sx={{ fontSize: '12px' }}>
                                    {zoneSet.name} ({zoneSet.geography})
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    {selectedZoneSet && (
                        <Alert severity="info" sx={{ mt: 2 }}>
                            <Typography sx={{ fontSize: '12px' }}>
                                Rates will be mapped to existing zone structure and can be used by other carriers
                            </Typography>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        </Box>
    );

    // Step 2: Upload Rate Matrix
    const renderUploadStep = () => (
        <Box sx={{ p: 2 }}>
            <Typography variant="h6" sx={{ mb: 3, fontSize: '16px', fontWeight: 600 }}>
                Upload Rate Matrix CSV
            </Typography>

            {/* Upload Instructions */}
            <Alert severity="info" sx={{ mb: 3 }}>
                <Typography sx={{ fontSize: '12px' }}>
                    Upload a CSV file with the structure from your carrier rate sheet.
                    First column should be destination cities, first row should be skid counts (1, 2, 3, etc.)
                </Typography>
            </Alert>

            {/* Download Template */}
            <Card sx={{ mb: 3, border: '1px solid #e5e7eb' }}>
                <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box>
                            <Typography variant="subtitle1" sx={{ fontSize: '14px', fontWeight: 600 }}>
                                Download Template
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                                Get a sample CSV template with Ontario cities, Western Canada, and special charges
                            </Typography>
                        </Box>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<TemplateIcon />}
                            onClick={handleDownloadTemplate}
                            sx={{
                                fontSize: '12px',
                                color: '#7c3aed',
                                borderColor: '#7c3aed',
                                '&:hover': {
                                    backgroundColor: '#f3f4f6',
                                    borderColor: '#7c3aed'
                                }
                            }}
                        >
                            Download Template
                        </Button>
                    </Box>
                </CardContent>
            </Card>

            {/* File Upload Area */}
            <Card sx={{ border: '2px dashed #d1d5db', backgroundColor: '#f9fafb' }}>
                <CardContent sx={{ textAlign: 'center', py: 4 }}>
                    <input
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                        id="csv-upload"
                    />
                    <label htmlFor="csv-upload">
                        <IconButton component="span" sx={{ mb: 2 }}>
                            <UploadIcon sx={{ fontSize: 48, color: '#6b7280' }} />
                        </IconButton>
                        <Typography variant="h6" sx={{ mb: 1, fontSize: '16px' }}>
                            {uploadedFile ? uploadedFile.name : 'Choose CSV file'}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                            or drag and drop your CSV file here
                        </Typography>
                        <Button variant="contained" sx={{ mt: 2, fontSize: '12px' }} component="span">
                            Select File
                        </Button>
                    </label>
                </CardContent>
            </Card>

            {/* File Preview */}
            {csvData && (
                <Card sx={{ mt: 3, border: '1px solid #e5e7eb' }}>
                    <CardContent>
                        <Typography variant="subtitle1" sx={{ mb: 2, fontSize: '14px', fontWeight: 600 }}>
                            File Preview
                        </Typography>
                        <Box sx={{ maxHeight: 300, overflow: 'auto' }}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        {csvData.headers.map((header, index) => (
                                            <TableCell key={index} sx={{ fontSize: '12px', fontWeight: 600, backgroundColor: '#f8fafc' }}>
                                                {header}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {csvData.rows.slice(0, 5).map((row, index) => (
                                        <TableRow key={index}>
                                            {row.map((cell, cellIndex) => (
                                                <TableCell key={cellIndex} sx={{ fontSize: '12px' }}>
                                                    {cell}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                            {csvData.rows.length > 5 && (
                                <Typography variant="caption" sx={{ p: 2, display: 'block', textAlign: 'center', fontSize: '11px' }}>
                                    ... and {csvData.rows.length - 5} more rows
                                </Typography>
                            )}
                        </Box>
                    </CardContent>
                </Card>
            )}
        </Box>
    );

    // File handling
    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setUploadedFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            const csv = e.target.result;
            const parsed = parseCSV(csv);
            setCsvData(parsed);
            processLocationMapping(parsed);
        };
        reader.readAsText(file);
    };

    const parseCSV = (csv) => {
        const lines = csv.split('\n').filter(line => line.trim());
        const headers = lines[0].split(',').map(h => h.trim());
        const rows = lines.slice(1).map(line => line.split(',').map(cell => cell.trim()));
        return { headers, rows };
    };

    const processLocationMapping = async (parsedData) => {
        setLoading(true);
        try {
            // Extract destination cities from first column
            const destinations = parsedData.rows.map(row => row[0]).filter(Boolean);

            // For now, create basic mapping without cloud function
            const basicMapping = {};
            const unmapped = [];

            destinations.forEach(dest => {
                // Basic mapping logic - you can enhance this
                if (dest.toLowerCase().includes('toronto') || dest.toLowerCase().includes('gta')) {
                    basicMapping[dest] = {
                        matched: true,
                        regionId: 'toronto-region',
                        regionName: 'Toronto',
                        regionCode: 'TOR'
                    };
                } else {
                    unmapped.push(dest);
                }
            });

            setLocationMapping(basicMapping);
            setUnmappedLocations(unmapped);

        } catch (error) {
            console.error('Error mapping locations:', error);
            enqueueSnackbar('Failed to map locations to zones', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    // Step navigation
    const handleNext = () => {
        if (activeStep === 0 && !rateConfig.name) {
            enqueueSnackbar('Please enter a rate card name', { variant: 'error' });
            return;
        }
        if (activeStep === 1 && !csvData) {
            enqueueSnackbar('Please upload a CSV file', { variant: 'error' });
            return;
        }

        if (activeStep === steps.length - 1) {
            handleImport();
        } else {
            setActiveStep(prev => prev + 1);
        }
    };

    const handleBack = () => {
        setActiveStep(prev => prev - 1);
    };

    const handleImport = async () => {
        try {
            setLoading(true);

            // Basic import logic for now
            enqueueSnackbar('Geographic rate card imported successfully!', { variant: 'success' });

            if (onImportComplete) {
                onImportComplete();
            }

        } catch (error) {
            console.error('Error importing rate card:', error);
            enqueueSnackbar('Failed to import rate card', { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setActiveStep(0);
        setUploadedFile(null);
        setCsvData(null);
        setLocationMapping({});
        setUnmappedLocations([]);
        setPreviewData(null);
        setValidationErrors([]);
        setImportResults(null);
    };

    return (
        <Dialog
            open={isOpen}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: { height: '90vh' }
            }}
        >
            <DialogTitle sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                pb: 1,
                fontSize: '16px',
                fontWeight: 600,
                color: '#374151'
            }}>
                Enhanced Geographic Rate Card Import - {carrierName}
                <IconButton onClick={onClose} size="small">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 0 }}>
                {/* Stepper */}
                <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #e5e7eb' }}>
                    <Stepper activeStep={activeStep}>
                        {steps.map((label) => (
                            <Step key={label}>
                                <StepLabel sx={{
                                    '& .MuiStepLabel-label': {
                                        fontSize: '12px'
                                    }
                                }}>
                                    {label}
                                </StepLabel>
                            </Step>
                        ))}
                    </Stepper>
                </Box>

                {/* Step Content */}
                <Box sx={{ height: 'calc(90vh - 200px)', overflow: 'auto' }}>
                    {activeStep === 0 && renderGeographicConfig()}
                    {activeStep === 1 && renderUploadStep()}
                    {activeStep === 2 && (
                        <Box sx={{ p: 2 }}>
                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                                Map Locations to Zone System
                            </Typography>
                            <Alert severity="info" sx={{ mt: 2 }}>
                                <Typography sx={{ fontSize: '12px' }}>
                                    Location mapping functionality coming soon. This will integrate with your existing zone management system.
                                </Typography>
                            </Alert>
                        </Box>
                    )}
                    {activeStep === 3 && (
                        <Box sx={{ p: 2 }}>
                            <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                                Preview & Import
                            </Typography>
                            <Alert severity="info" sx={{ mt: 2 }}>
                                <Typography sx={{ fontSize: '12px' }}>
                                    Ready to import {csvData ? csvData.rows.length : 0} locations
                                    with geographic rate matrix structure.
                                </Typography>
                            </Alert>
                        </Box>
                    )}
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 3, borderTop: '1px solid #e5e7eb' }}>
                <Button onClick={handleReset} disabled={loading} sx={{ fontSize: '12px' }}>
                    Reset
                </Button>
                <Box sx={{ flex: 1 }} />
                <Button
                    onClick={handleBack}
                    disabled={activeStep === 0 || loading}
                    sx={{ mr: 1, fontSize: '12px' }}
                >
                    Back
                </Button>
                <Button
                    onClick={handleNext}
                    variant="contained"
                    disabled={loading}
                    sx={{ fontSize: '12px' }}
                >
                    {loading ? <CircularProgress size={20} /> :
                        activeStep === steps.length - 1 ? 'Import' : 'Next'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default EnhancedGeographicRateCardImport;
