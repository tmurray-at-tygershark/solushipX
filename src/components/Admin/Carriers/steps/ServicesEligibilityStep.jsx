import React, { useCallback, useState, useEffect } from 'react';
import {
    Box,
    Typography,
    FormControl,
    FormGroup,
    FormControlLabel,
    Checkbox,
    Paper,
    Grid,
    TextField,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Button,
    IconButton,
    Chip,
    Alert,
    Divider,
    InputLabel,
    Select,
    MenuItem,
    CircularProgress
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    LocalShipping as CourierIcon,
    LocalShipping as FreightIcon,
    CheckCircle as CheckCircleIcon,
    Info as InfoIcon
} from '@mui/icons-material';
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '../../../../firebase/firebase';

// Package types available for restrictions (from CreateShipmentX.jsx)
const PACKAGING_TYPES = [
    { value: 237, label: '10KG BOX' },
    { value: 238, label: '25KG BOX' },
    { value: 239, label: 'ENVELOPE' },
    { value: 240, label: 'TUBE (PACKAGE)' },
    { value: 241, label: 'PAK (PACKAGE)' },
    { value: 242, label: 'BAGS' },
    { value: 243, label: 'BALE(S)' },
    { value: 244, label: 'BOX(ES)' },
    { value: 245, label: 'BUNCH(ES)' },
    { value: 246, label: 'BUNDLE(S)' },
    { value: 248, label: 'CARBOY(S)' },
    { value: 249, label: 'CARPET(S)' },
    { value: 250, label: 'CARTONS' },
    { value: 251, label: 'CASE(S)' },
    { value: 252, label: 'COIL(S)' },
    { value: 253, label: 'CRATE(S)' },
    { value: 254, label: 'CYLINDER(S)' },
    { value: 255, label: 'DRUM(S)' },
    { value: 256, label: 'LOOSE' },
    { value: 257, label: 'PAIL(S)' },
    { value: 258, label: 'PALLET(S)' },
    { value: 260, label: 'REELS(S)' },
    { value: 261, label: 'ROLL(S)' },
    { value: 262, label: 'SKID(S)' },
    { value: 265, label: 'TOTE(S)' },
    { value: 266, label: 'TUBES/PIPES' },
    { value: 268, label: 'GALLONS' },
    { value: 269, label: 'LIQUID BULK' },
    { value: 270, label: 'CONTAINER' },
    { value: 271, label: 'PIECES' },
    { value: 272, label: 'LOAD' },
    { value: 273, label: 'BLADE(S)' },
    { value: 274, label: 'RACKS' },
    { value: 275, label: 'GAYLORDS' }
];

// Geographic data for province-state mapping
const canadianProvinces = [
    { code: 'AB', name: 'Alberta' },
    { code: 'BC', name: 'British Columbia' },
    { code: 'MB', name: 'Manitoba' },
    { code: 'NB', name: 'New Brunswick' },
    { code: 'NL', name: 'Newfoundland and Labrador' },
    { code: 'NS', name: 'Nova Scotia' },
    { code: 'NT', name: 'Northwest Territories' },
    { code: 'NU', name: 'Nunavut' },
    { code: 'ON', name: 'Ontario' },
    { code: 'PE', name: 'Prince Edward Island' },
    { code: 'QC', name: 'Quebec' },
    { code: 'SK', name: 'Saskatchewan' },
    { code: 'YT', name: 'Yukon' }
];

const usStates = [
    { code: 'AL', name: 'Alabama' }, { code: 'AK', name: 'Alaska' }, { code: 'AZ', name: 'Arizona' },
    { code: 'AR', name: 'Arkansas' }, { code: 'CA', name: 'California' }, { code: 'CO', name: 'Colorado' },
    { code: 'CT', name: 'Connecticut' }, { code: 'DE', name: 'Delaware' }, { code: 'FL', name: 'Florida' },
    { code: 'GA', name: 'Georgia' }, { code: 'HI', name: 'Hawaii' }, { code: 'ID', name: 'Idaho' },
    { code: 'IL', name: 'Illinois' }, { code: 'IN', name: 'Indiana' }, { code: 'IA', name: 'Iowa' },
    { code: 'KS', name: 'Kansas' }, { code: 'KY', name: 'Kentucky' }, { code: 'LA', name: 'Louisiana' },
    { code: 'ME', name: 'Maine' }, { code: 'MD', name: 'Maryland' }, { code: 'MA', name: 'Massachusetts' },
    { code: 'MI', name: 'Michigan' }, { code: 'MN', name: 'Minnesota' }, { code: 'MS', name: 'Mississippi' },
    { code: 'MO', name: 'Missouri' }, { code: 'MT', name: 'Montana' }, { code: 'NE', name: 'Nebraska' },
    { code: 'NV', name: 'Nevada' }, { code: 'NH', name: 'New Hampshire' }, { code: 'NJ', name: 'New Jersey' },
    { code: 'NM', name: 'New Mexico' }, { code: 'NY', name: 'New York' }, { code: 'NC', name: 'North Carolina' },
    { code: 'ND', name: 'North Dakota' }, { code: 'OH', name: 'Ohio' }, { code: 'OK', name: 'Oklahoma' },
    { code: 'OR', name: 'Oregon' }, { code: 'PA', name: 'Pennsylvania' }, { code: 'RI', name: 'Rhode Island' },
    { code: 'SC', name: 'South Carolina' }, { code: 'SD', name: 'South Dakota' }, { code: 'TN', name: 'Tennessee' },
    { code: 'TX', name: 'Texas' }, { code: 'UT', name: 'Utah' }, { code: 'VT', name: 'Vermont' },
    { code: 'VA', name: 'Virginia' }, { code: 'WA', name: 'Washington' }, { code: 'WV', name: 'West Virginia' },
    { code: 'WI', name: 'Wisconsin' }, { code: 'WY', name: 'Wyoming' }
];

const WeightRangeComponent = ({ weightRanges, onUpdate, errors }) => {
    // Handle legacy weight ranges - convert to new structure if needed
    const weightRestrictions = weightRanges?.weightRestrictions || {
        totalWeight: weightRanges || [],
        cubicWeight: [],
        weightPerSkid: []
    };

    const handleUpdateWeightRestrictions = (newRestrictions) => {
        onUpdate({ weightRestrictions: newRestrictions });
    };

    // Total Weight Range handlers
    const handleAddTotalWeightRange = () => {
        const newRestrictions = {
            ...weightRestrictions,
            totalWeight: [...weightRestrictions.totalWeight, { minWeight: 0, maxWeight: 100, unit: 'kg' }]
        };
        handleUpdateWeightRestrictions(newRestrictions);
    };

    const handleRemoveTotalWeightRange = (index) => {
        const newRestrictions = {
            ...weightRestrictions,
            totalWeight: weightRestrictions.totalWeight.filter((_, i) => i !== index)
        };
        handleUpdateWeightRestrictions(newRestrictions);
    };

    const handleTotalWeightRangeChange = (index, field, value) => {
        const newRestrictions = {
            ...weightRestrictions,
            totalWeight: weightRestrictions.totalWeight.map((range, i) =>
                i === index ? { ...range, [field]: value } : range
            )
        };
        handleUpdateWeightRestrictions(newRestrictions);
    };

    // Cubic Weight handlers
    const handleAddCubicWeightRange = () => {
        const newRestrictions = {
            ...weightRestrictions,
            cubicWeight: [...weightRestrictions.cubicWeight, {
                minCubicWeight: 0,
                maxCubicWeight: 1000,
                unit: 'kg',
                densityThreshold: 6.0,
                description: ''
            }]
        };
        handleUpdateWeightRestrictions(newRestrictions);
    };

    const handleRemoveCubicWeightRange = (index) => {
        const newRestrictions = {
            ...weightRestrictions,
            cubicWeight: weightRestrictions.cubicWeight.filter((_, i) => i !== index)
        };
        handleUpdateWeightRestrictions(newRestrictions);
    };

    const handleCubicWeightRangeChange = (index, field, value) => {
        const newRestrictions = {
            ...weightRestrictions,
            cubicWeight: weightRestrictions.cubicWeight.map((range, i) =>
                i === index ? { ...range, [field]: value } : range
            )
        };
        handleUpdateWeightRestrictions(newRestrictions);
    };

    // Weight Per Skid handlers
    const handleAddWeightPerSkidRange = () => {
        const newRestrictions = {
            ...weightRestrictions,
            weightPerSkid: [...weightRestrictions.weightPerSkid, {
                minWeightPerSkid: 0,
                maxWeightPerSkid: 2000,
                unit: 'kg',
                description: ''
            }]
        };
        handleUpdateWeightRestrictions(newRestrictions);
    };

    const handleRemoveWeightPerSkidRange = (index) => {
        const newRestrictions = {
            ...weightRestrictions,
            weightPerSkid: weightRestrictions.weightPerSkid.filter((_, i) => i !== index)
        };
        handleUpdateWeightRestrictions(newRestrictions);
    };

    const handleWeightPerSkidRangeChange = (index, field, value) => {
        const newRestrictions = {
            ...weightRestrictions,
            weightPerSkid: weightRestrictions.weightPerSkid.map((range, i) =>
                i === index ? { ...range, [field]: value } : range
            )
        };
        handleUpdateWeightRestrictions(newRestrictions);
    };

    return (
        <Box>
            <Typography sx={{ fontSize: '13px', fontWeight: 500, mb: 2 }}>
                Weight Restrictions
            </Typography>
            <Typography sx={{ fontSize: '11px', color: '#6b7280', mb: 3 }}>
                Define various weight-related restrictions this carrier can handle. Configure any or all types as needed.
            </Typography>

            {/* Total Weight Restrictions */}
            <Accordion sx={{ mb: 2, border: '1px solid #e5e7eb', borderRadius: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#f8fafc' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                        <Typography sx={{ fontSize: '18px' }}>⚖️</Typography>
                        <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>
                                Total Weight Restrictions
                            </Typography>
                            <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                Basic total weight ranges for shipments
                            </Typography>
                        </Box>
                        <Chip
                            label={weightRestrictions.totalWeight?.length || 0}
                            size="small"
                            sx={{ fontSize: '10px', height: '18px' }}
                            color="default"
                        />
                    </Box>
                </AccordionSummary>
                <AccordionDetails>
                    {weightRestrictions.totalWeight?.map((range, index) => (
                        <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                                <TextField
                                    size="small"
                                    label="Min Weight"
                                    type="number"
                                    value={range.minWeight}
                                    onChange={(e) => handleTotalWeightRangeChange(index, 'minWeight', parseFloat(e.target.value) || 0)}
                                    sx={{
                                        width: 120,
                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                    }}
                                />
                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>to</Typography>
                                <TextField
                                    size="small"
                                    label="Max Weight"
                                    type="number"
                                    value={range.maxWeight}
                                    onChange={(e) => handleTotalWeightRangeChange(index, 'maxWeight', parseFloat(e.target.value) || 0)}
                                    sx={{
                                        width: 120,
                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                    }}
                                />
                                <FormControl size="small" sx={{ minWidth: 80 }}>
                                    <TextField
                                        select
                                        size="small"
                                        value={range.unit}
                                        onChange={(e) => handleTotalWeightRangeChange(index, 'unit', e.target.value)}
                                        SelectProps={{ native: true }}
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' }
                                        }}
                                    >
                                        <option value="kg">kg</option>
                                        <option value="lb">lb</option>
                                    </TextField>
                                </FormControl>
                                <IconButton
                                    size="small"
                                    onClick={() => handleRemoveTotalWeightRange(index)}
                                    sx={{ color: '#d32f2f' }}
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Box>
                            <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                Range {index + 1}: {range.minWeight} {range.unit} - {range.maxWeight} {range.unit}
                            </Typography>
                        </Paper>
                    ))}

                    <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={handleAddTotalWeightRange}
                        variant="outlined"
                        sx={{ fontSize: '11px' }}
                    >
                        Add Total Weight Range
                    </Button>
                </AccordionDetails>
            </Accordion>

            {/* Cubic Weight Restrictions */}
            <Accordion sx={{ mb: 2, border: '1px solid #e5e7eb', borderRadius: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#fef3ff' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                        <Typography sx={{ fontSize: '18px' }}>📦</Typography>
                        <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#7c3aed' }}>
                                Cubic Weight Restrictions
                            </Typography>
                            <Typography sx={{ fontSize: '10px', color: '#7c3aed' }}>
                                Volume-based weight restrictions for LTL shipments (dimensional weight)
                            </Typography>
                        </Box>
                        <Chip
                            label={weightRestrictions.cubicWeight?.length || 0}
                            size="small"
                            sx={{ fontSize: '10px', height: '18px' }}
                            color="secondary"
                        />
                    </Box>
                </AccordionSummary>
                <AccordionDetails>
                    <Alert severity="info" sx={{ fontSize: '11px', mb: 2 }}>
                        <Typography sx={{ fontSize: '11px', fontWeight: 500, mb: 1 }}>
                            Cubic Weight (Dimensional Weight) Rules
                        </Typography>
                        <Typography sx={{ fontSize: '10px' }}>
                            Used when shipments take up significant space but are light. Carriers apply minimum charges
                            based on calculated cubic weight rather than actual weight for low-density freight.
                        </Typography>
                    </Alert>

                    {weightRestrictions.cubicWeight?.map((range, index) => (
                        <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: '#fef3ff', border: '1px solid #d8b4fe' }}>
                            <Grid container spacing={2} alignItems="center">
                                <Grid item xs={12} sm={3}>
                                    <TextField
                                        size="small"
                                        label="Min Cubic Weight"
                                        type="number"
                                        value={range.minCubicWeight}
                                        onChange={(e) => handleCubicWeightRangeChange(index, 'minCubicWeight', parseFloat(e.target.value) || 0)}
                                        fullWidth
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={3}>
                                    <TextField
                                        size="small"
                                        label="Max Cubic Weight"
                                        type="number"
                                        value={range.maxCubicWeight}
                                        onChange={(e) => handleCubicWeightRangeChange(index, 'maxCubicWeight', parseFloat(e.target.value) || 0)}
                                        fullWidth
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={2}>
                                    <TextField
                                        select
                                        size="small"
                                        label="Unit"
                                        value={range.unit}
                                        onChange={(e) => handleCubicWeightRangeChange(index, 'unit', e.target.value)}
                                        fullWidth
                                        SelectProps={{ native: true }}
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                    >
                                        <option value="kg">kg</option>
                                        <option value="lb">lb</option>
                                    </TextField>
                                </Grid>
                                <Grid item xs={12} sm={3}>
                                    <TextField
                                        size="small"
                                        label="Density Threshold"
                                        type="number"
                                        value={range.densityThreshold}
                                        onChange={(e) => handleCubicWeightRangeChange(index, 'densityThreshold', parseFloat(e.target.value) || 0)}
                                        fullWidth
                                        placeholder="e.g., 6.0"
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={1}>
                                    <IconButton
                                        size="small"
                                        onClick={() => handleRemoveCubicWeightRange(index)}
                                        sx={{ color: '#d32f2f' }}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        size="small"
                                        label="Description (Optional)"
                                        value={range.description || ''}
                                        onChange={(e) => handleCubicWeightRangeChange(index, 'description', e.target.value)}
                                        fullWidth
                                        placeholder="e.g., Applied to shipments with density < 6 lbs per cubic foot"
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                            </Grid>
                            <Typography sx={{ fontSize: '10px', color: '#7c3aed', mt: 1 }}>
                                Cubic Weight Range {index + 1}: {range.minCubicWeight} - {range.maxCubicWeight} {range.unit}
                                {range.densityThreshold && ` (Density threshold: ${range.densityThreshold})`}
                            </Typography>
                        </Paper>
                    ))}

                    <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={handleAddCubicWeightRange}
                        variant="outlined"
                        sx={{ fontSize: '11px' }}
                    >
                        Add Cubic Weight Rule
                    </Button>
                </AccordionDetails>
            </Accordion>

            {/* Weight Per Skid Restrictions */}
            <Accordion sx={{ mb: 2, border: '1px solid #e5e7eb', borderRadius: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: '#fff7ed' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                        <Typography sx={{ fontSize: '18px' }}>🏗️</Typography>
                        <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#c2410c' }}>
                                Weight Per Skid Restrictions
                            </Typography>
                            <Typography sx={{ fontSize: '10px', color: '#c2410c' }}>
                                Maximum weight limits per individual skid/pallet for freight shipments
                            </Typography>
                        </Box>
                        <Chip
                            label={weightRestrictions.weightPerSkid?.length || 0}
                            size="small"
                            sx={{ fontSize: '10px', height: '18px' }}
                            color="warning"
                        />
                    </Box>
                </AccordionSummary>
                <AccordionDetails>
                    <Alert severity="warning" sx={{ fontSize: '11px', mb: 2 }}>
                        <Typography sx={{ fontSize: '11px', fontWeight: 500, mb: 1 }}>
                            Weight Per Skid/Pallet Limits
                        </Typography>
                        <Typography sx={{ fontSize: '10px' }}>
                            Defines the maximum weight allowed per individual skid or pallet. This is important for
                            freight handling equipment limitations and dock safety requirements.
                        </Typography>
                    </Alert>

                    {weightRestrictions.weightPerSkid?.map((range, index) => (
                        <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: '#fff7ed', border: '1px solid #fed7aa' }}>
                            <Grid container spacing={2} alignItems="center">
                                <Grid item xs={12} sm={4}>
                                    <TextField
                                        size="small"
                                        label="Min Weight Per Skid"
                                        type="number"
                                        value={range.minWeightPerSkid}
                                        onChange={(e) => handleWeightPerSkidRangeChange(index, 'minWeightPerSkid', parseFloat(e.target.value) || 0)}
                                        fullWidth
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <TextField
                                        size="small"
                                        label="Max Weight Per Skid"
                                        type="number"
                                        value={range.maxWeightPerSkid}
                                        onChange={(e) => handleWeightPerSkidRangeChange(index, 'maxWeightPerSkid', parseFloat(e.target.value) || 0)}
                                        fullWidth
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={3}>
                                    <TextField
                                        select
                                        size="small"
                                        label="Unit"
                                        value={range.unit}
                                        onChange={(e) => handleWeightPerSkidRangeChange(index, 'unit', e.target.value)}
                                        fullWidth
                                        SelectProps={{ native: true }}
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                    >
                                        <option value="kg">kg</option>
                                        <option value="lb">lb</option>
                                    </TextField>
                                </Grid>
                                <Grid item xs={12} sm={1}>
                                    <IconButton
                                        size="small"
                                        onClick={() => handleRemoveWeightPerSkidRange(index)}
                                        sx={{ color: '#d32f2f' }}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        size="small"
                                        label="Description (Optional)"
                                        value={range.description || ''}
                                        onChange={(e) => handleWeightPerSkidRangeChange(index, 'description', e.target.value)}
                                        fullWidth
                                        placeholder="e.g., Standard dock equipment limitation"
                                        sx={{
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                            </Grid>
                            <Typography sx={{ fontSize: '10px', color: '#c2410c', mt: 1 }}>
                                Weight Per Skid {index + 1}: {range.minWeightPerSkid} - {range.maxWeightPerSkid} {range.unit} per skid/pallet
                            </Typography>
                        </Paper>
                    ))}

                    <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={handleAddWeightPerSkidRange}
                        variant="outlined"
                        sx={{ fontSize: '11px' }}
                    >
                        Add Weight Per Skid Rule
                    </Button>
                </AccordionDetails>
            </Accordion>

            {errors?.weightRanges && (
                <Alert severity="error" sx={{ fontSize: '12px', mt: 1 }}>
                    {errors.weightRanges}
                </Alert>
            )}
        </Box>
    );
};

const DimensionRestrictionsComponent = ({ dimensionRestrictions, onUpdate, errors }) => {
    const handleAddDimensionRestriction = () => {
        const newRestrictions = [...dimensionRestrictions, { maxLength: 100, maxWidth: 100, maxHeight: 100, unit: 'in' }];
        onUpdate(newRestrictions);
    };

    const handleRemoveDimensionRestriction = (index) => {
        const newRestrictions = dimensionRestrictions.filter((_, i) => i !== index);
        onUpdate(newRestrictions);
    };

    const handleDimensionRestrictionChange = (index, field, value) => {
        const newRestrictions = [...dimensionRestrictions];
        newRestrictions[index] = { ...newRestrictions[index], [field]: value };
        onUpdate(newRestrictions);
    };

    return (
        <Box>
            <Typography sx={{ fontSize: '13px', fontWeight: 500, mb: 2 }}>
                Maximum Dimension Restrictions
            </Typography>
            <Typography sx={{ fontSize: '11px', color: '#6b7280', mb: 3 }}>
                Define package size limits due to vehicle constraints (truck space limitations)
            </Typography>

            {dimensionRestrictions.map((restriction, index) => (
                <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: '#fef3ff', border: '1px solid #d8b4fe' }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={2}>
                            <TextField
                                size="small"
                                label="Max Length"
                                type="number"
                                value={restriction.maxLength}
                                onChange={(e) => handleDimensionRestrictionChange(index, 'maxLength', parseFloat(e.target.value) || 0)}
                                fullWidth
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={2}>
                            <TextField
                                size="small"
                                label="Max Width"
                                type="number"
                                value={restriction.maxWidth}
                                onChange={(e) => handleDimensionRestrictionChange(index, 'maxWidth', parseFloat(e.target.value) || 0)}
                                fullWidth
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={2}>
                            <TextField
                                size="small"
                                label="Max Height"
                                type="number"
                                value={restriction.maxHeight}
                                onChange={(e) => handleDimensionRestrictionChange(index, 'maxHeight', parseFloat(e.target.value) || 0)}
                                fullWidth
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={2}>
                            <FormControl size="small" fullWidth>
                                <InputLabel sx={{ fontSize: '12px' }}>Unit</InputLabel>
                                <Select
                                    value={restriction.unit}
                                    onChange={(e) => handleDimensionRestrictionChange(index, 'unit', e.target.value)}
                                    label="Unit"
                                    sx={{
                                        '& .MuiSelect-select': { fontSize: '12px' }
                                    }}
                                >
                                    <MenuItem value="inches" sx={{ fontSize: '12px' }}>
                                        Inches
                                    </MenuItem>
                                    <MenuItem value="cm" sx={{ fontSize: '12px' }}>
                                        Centimeters
                                    </MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={3}>
                            <TextField
                                size="small"
                                label="Description (Optional)"
                                value={restriction.description || ''}
                                onChange={(e) => handleDimensionRestrictionChange(index, 'description', e.target.value)}
                                fullWidth
                                placeholder="e.g., Standard truck bed"
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={1}>
                            <IconButton
                                size="small"
                                onClick={() => handleRemoveDimensionRestriction(index)}
                                sx={{ color: '#d32f2f' }}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Grid>
                    </Grid>
                    <Typography sx={{ fontSize: '10px', color: '#7c3aed', mt: 1 }}>
                        Max Dimensions {index + 1}: {restriction.maxLength} × {restriction.maxWidth} × {restriction.maxHeight} {restriction.unit}
                        {restriction.description && ` (${restriction.description})`}
                    </Typography>
                </Paper>
            ))}

            <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddDimensionRestriction}
                variant="outlined"
                sx={{ fontSize: '11px' }}
            >
                Add Dimension Restriction
            </Button>
        </Box>
    );
};

const PackageTypeRestrictionsComponent = ({ packageTypeRestrictions, onUpdate, errors }) => {
    const handleAddPackageTypeRestriction = () => {
        const newRestrictions = [...(packageTypeRestrictions || []), {
            packageTypeCode: 262, // Default to SKID(S)
            packageTypeName: 'SKID(S)',
            minQuantity: 1,
            maxQuantity: 26,
            required: false
        }];
        onUpdate(newRestrictions);
    };

    const handleRemovePackageTypeRestriction = (index) => {
        const newRestrictions = packageTypeRestrictions.filter((_, i) => i !== index);
        onUpdate(newRestrictions);
    };

    const handlePackageTypeRestrictionChange = (index, field, value) => {
        const newRestrictions = [...packageTypeRestrictions];

        if (field === 'packageTypeCode') {
            // Update both code and name when package type changes
            const selectedPackageType = PACKAGING_TYPES.find(pt => pt.value === parseInt(value));
            newRestrictions[index] = {
                ...newRestrictions[index],
                packageTypeCode: parseInt(value),
                packageTypeName: selectedPackageType?.label || 'Unknown'
            };
        } else {
            newRestrictions[index] = {
                ...newRestrictions[index],
                [field]: value
            };
        }

        onUpdate(newRestrictions);
    };

    return (
        <Box>
            <Typography sx={{ fontSize: '13px', fontWeight: 500, mb: 2 }}>
                Package Type Restrictions
            </Typography>
            <Typography sx={{ fontSize: '11px', color: '#6b7280', mb: 3 }}>
                Define which package types this carrier supports and their quantity limits. This helps filter carriers based on the specific packaging types used in shipments.
            </Typography>

            <Alert severity="info" sx={{ fontSize: '11px', mb: 2 }}>
                <Typography sx={{ fontSize: '11px', fontWeight: 500, mb: 1 }}>
                    Package Type Eligibility Rules
                </Typography>
                <Typography sx={{ fontSize: '10px' }}>
                    • <strong>Supported Types:</strong> ALL package types in a shipment must be supported by the carrier<br />
                    • <strong>Required:</strong> Carrier ONLY accepts this package type (must be present in shipment)<br />
                    • <strong>Optional:</strong> Carrier supports this package type but doesn't require it<br />
                    • <strong>Min/Max Quantity:</strong> Acceptable quantity range for this package type<br />
                    • <strong>Example:</strong> If carrier only accepts SKIDS and PALLETS, add both types. Shipments with BOXES will be rejected.
                </Typography>
            </Alert>

            {(packageTypeRestrictions || []).map((restriction, index) => (
                <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: '#fff7ed', border: '1px solid #fed7aa' }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={4}>
                            <FormControl size="small" fullWidth>
                                <InputLabel sx={{ fontSize: '12px' }}>Package Type</InputLabel>
                                <Select
                                    value={restriction.packageTypeCode || ''}
                                    onChange={(e) => handlePackageTypeRestrictionChange(index, 'packageTypeCode', e.target.value)}
                                    label="Package Type"
                                    sx={{
                                        '& .MuiSelect-select': { fontSize: '12px' }
                                    }}
                                >
                                    {PACKAGING_TYPES.map((packageType) => (
                                        <MenuItem key={packageType.value} value={packageType.value} sx={{ fontSize: '12px' }}>
                                            {packageType.value} - {packageType.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={2}>
                            <TextField
                                size="small"
                                label="Min Quantity"
                                type="number"
                                value={restriction.minQuantity || 1}
                                onChange={(e) => handlePackageTypeRestrictionChange(index, 'minQuantity', parseInt(e.target.value) || 1)}
                                fullWidth
                                inputProps={{ min: 1 }}
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={2}>
                            <TextField
                                size="small"
                                label="Max Quantity"
                                type="number"
                                value={restriction.maxQuantity || 26}
                                onChange={(e) => handlePackageTypeRestrictionChange(index, 'maxQuantity', parseInt(e.target.value) || 26)}
                                fullWidth
                                inputProps={{ min: 1 }}
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={2}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={restriction.required || false}
                                        onChange={(e) => handlePackageTypeRestrictionChange(index, 'required', e.target.checked)}
                                        size="small"
                                    />
                                }
                                label={
                                    <Typography sx={{ fontSize: '12px' }}>
                                        Required
                                    </Typography>
                                }
                            />
                        </Grid>
                        <Grid item xs={12} sm={1}>
                            <IconButton
                                size="small"
                                onClick={() => handleRemovePackageTypeRestriction(index)}
                                sx={{ color: '#d32f2f' }}
                            >
                                <DeleteIcon fontSize="small" />
                            </IconButton>
                        </Grid>
                        <Grid item xs={12}>
                            <Typography sx={{ fontSize: '10px', color: '#c2410c' }}>
                                {restriction.packageTypeName || 'Unknown'} ({restriction.packageTypeCode}):
                                {restriction.minQuantity}-{restriction.maxQuantity} units
                                {restriction.required ? ' (REQUIRED)' : ' (Optional)'}
                            </Typography>
                        </Grid>
                    </Grid>
                </Paper>
            ))}

            <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddPackageTypeRestriction}
                variant="outlined"
                sx={{ fontSize: '11px' }}
            >
                Add Package Type Restriction
            </Button>
        </Box>
    );
};

const ServicesEligibilityStep = ({ data, onUpdate, errors, setErrors, isEdit = false }) => {
    // State for dynamic service levels
    const [courierServices, setCourierServices] = useState([]);
    const [freightServices, setFreightServices] = useState([]);
    const [loadingServices, setLoadingServices] = useState(true);
    const [servicesError, setServicesError] = useState(null);

    // Load service levels from database
    useEffect(() => {
        const loadServiceLevels = async () => {
            try {
                setLoadingServices(true);
                console.log('🔄 [ServicesEligibilityStep] Starting service levels load...');
                console.log('🔄 [ServicesEligibilityStep] Database object:', db);

                // Load courier services
                const courierQuery = query(
                    collection(db, 'serviceLevels'),
                    where('type', '==', 'courier'),
                    where('enabled', '==', true),
                    orderBy('sortOrder', 'asc')
                );

                // Load freight services
                const freightQuery = query(
                    collection(db, 'serviceLevels'),
                    where('type', '==', 'freight'),
                    where('enabled', '==', true),
                    orderBy('sortOrder', 'asc')
                );

                const [courierSnapshot, freightSnapshot] = await Promise.all([
                    getDocs(courierQuery),
                    getDocs(freightQuery)
                ]);

                const courierData = courierSnapshot.docs.map(doc => ({
                    value: doc.data().code,
                    label: doc.data().label,
                    description: doc.data().description || `${doc.data().label} service`,
                    ...doc.data()
                }));

                const freightData = freightSnapshot.docs.map(doc => ({
                    value: doc.data().code,
                    label: doc.data().label,
                    description: doc.data().description || `${doc.data().label} service`,
                    ...doc.data()
                }));

                console.log('✅ Service levels loaded:', {
                    courier: courierData.length,
                    freight: freightData.length,
                    courierData,
                    freightData
                });

                setCourierServices(courierData);
                setFreightServices(freightData);
                setServicesError(null);
            } catch (error) {
                console.error('❌ Error loading service levels:', error);
                console.error('❌ Error details:', error.message, error.code);
                setServicesError('Failed to load service levels from database. Contact support.');

                // NO FALLBACK - Force database usage only
                setCourierServices([]);
                setFreightServices([]);
            } finally {
                setLoadingServices(false);
            }
        };

        loadServiceLevels();
    }, []);

    // Handle service selection
    const handleServiceToggle = useCallback((serviceType, serviceValue) => {
        const currentServices = data.supportedServices[serviceType] || [];
        let newServices;

        if (currentServices.includes(serviceValue)) {
            newServices = currentServices.filter(s => s !== serviceValue);
        } else {
            newServices = [...currentServices, serviceValue];
        }

        onUpdate({
            supportedServices: {
                ...data.supportedServices,
                [serviceType]: newServices
            }
        });

        // Clear services error
        if (errors.services) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.services;
                return newErrors;
            });
        }
    }, [data.supportedServices, onUpdate, errors, setErrors]);

    // Handle select/deselect all for service type
    const handleSelectAllServices = useCallback((serviceType) => {
        const allServices = serviceType === 'courier' ? courierServices : freightServices;
        const allServiceValues = allServices.map(s => s.value);

        onUpdate({
            supportedServices: {
                ...data.supportedServices,
                [serviceType]: allServiceValues
            }
        });
    }, [data.supportedServices, onUpdate]);

    const handleDeselectAllServices = useCallback((serviceType) => {
        onUpdate({
            supportedServices: {
                ...data.supportedServices,
                [serviceType]: []
            }
        });
    }, [data.supportedServices, onUpdate]);

    // Handle eligibility rule changes
    const handleEligibilityChange = useCallback((section, field, value) => {
        if (section === 'root') {
            onUpdate({
                eligibilityRules: {
                    ...data.eligibilityRules,
                    [field]: value
                }
            });
        } else {
            onUpdate({
                eligibilityRules: {
                    ...data.eligibilityRules,
                    [section]: {
                        ...data.eligibilityRules[section],
                        [field]: value
                    }
                }
            });
        }
    }, [data.eligibilityRules, onUpdate]);

    // Handle weight ranges update
    const handleWeightRangesUpdate = useCallback((newWeightRanges) => {
        onUpdate({
            eligibilityRules: {
                ...data.eligibilityRules,
                weightRanges: newWeightRanges
            }
        });
    }, [data.eligibilityRules, onUpdate]);

    // Handle dimension restrictions update
    const handleDimensionRestrictionsUpdate = (newDimensionRestrictions) => {
        const updatedRules = {
            ...data.eligibilityRules,
            dimensionRestrictions: newDimensionRestrictions
        };
        onUpdate({ eligibilityRules: updatedRules });
    };

    // Determine which service types to show based on carrier type
    const showCourierServices = data.type === 'courier' || data.type === 'hybrid';
    const showFreightServices = data.type === 'freight' || data.type === 'hybrid';

    // Calculate service statistics
    const courierCount = showCourierServices ? (data.supportedServices?.courier?.length || 0) : 0;
    const freightCount = showFreightServices ? (data.supportedServices?.freight?.length || 0) : 0;
    const totalServices = courierCount + freightCount;

    // Handle package type restrictions update
    const handlePackageTypeRestrictionsUpdate = (newPackageTypeRestrictions) => {
        const updatedRules = {
            ...data.eligibilityRules,
            packageTypeRestrictions: newPackageTypeRestrictions
        };
        onUpdate({ eligibilityRules: updatedRules });
    };

    return (
        <Box sx={{ width: '100%' }}>
            <Typography variant="h6" sx={{ mb: 3, fontSize: '16px', fontWeight: 600 }}>
                Services & Eligibility Configuration
            </Typography>

            {/* Carrier Type Info */}
            <Paper sx={{ p: 2, mb: 3, bgcolor: '#f0f9ff', border: '1px solid #bfdbfe' }}>
                <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#1e40af', mb: 1 }}>
                    Carrier Type: {data.type === 'courier' ? 'Courier' : data.type === 'freight' ? 'Freight' : 'Hybrid'}
                </Typography>
                <Typography sx={{ fontSize: '11px', color: '#1e40af' }}>
                    {data.type === 'courier' && 'This carrier supports courier services only (small packages, documents)'}
                    {data.type === 'freight' && 'This carrier supports freight services only (LTL, FTL, heavy cargo)'}
                    {data.type === 'hybrid' && 'This carrier supports both courier and freight services'}
                </Typography>
            </Paper>

            {/* Supported Services Section */}
            <Accordion
                defaultExpanded={true}
                sx={{
                    mb: 3,
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px !important',
                    '&:before': {
                        display: 'none',
                    },
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                }}
            >
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{
                        bgcolor: '#f0f9ff',
                        borderRadius: '8px 8px 0 0',
                        '&.Mui-expanded': {
                            borderRadius: '8px 8px 0 0',
                        },
                        minHeight: 56,
                        '& .MuiAccordionSummary-content': {
                            alignItems: 'center',
                            gap: 2
                        }
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                        <Typography sx={{ fontSize: '18px' }}>
                            ⚡
                        </Typography>
                        <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#1e40af' }}>
                                Supported Services
                            </Typography>
                            <Typography sx={{ fontSize: '11px', color: '#1e40af' }}>
                                Select service types this carrier can handle
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <CheckCircleIcon sx={{ fontSize: '16px', color: totalServices > 0 ? '#10b981' : '#d1d5db' }} />
                            <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                {totalServices} Service{totalServices !== 1 ? 's' : ''} Selected
                            </Typography>
                        </Box>
                    </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 3, bgcolor: 'white' }}>
                    {/* Error Alert */}
                    {errors.services && (
                        <Alert severity="error" sx={{ fontSize: '12px', mb: 3 }}>
                            {errors.services}
                        </Alert>
                    )}

                    {/* Services Loading Error */}
                    {servicesError && (
                        <Alert severity="error" sx={{ fontSize: '12px', mb: 3 }}>
                            {servicesError}
                        </Alert>
                    )}

                    <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                        Select all service types this carrier can handle. You can choose from both courier and freight categories.
                    </Typography>

                    {/* Loading State */}
                    {loadingServices ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 4 }}>
                            <CircularProgress size={24} sx={{ mr: 2 }} />
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                Loading service levels...
                            </Typography>
                        </Box>
                    ) : (

                        <Grid container spacing={3}>
                            {/* Courier Services - Only show for courier or hybrid carriers */}
                            {showCourierServices && (
                                <Grid item xs={12} md={showFreightServices ? 6 : 12}>
                                    <Paper sx={{ border: '1px solid #e5e7eb', borderRadius: 1, overflow: 'hidden' }}>
                                        <Box sx={{ p: 2, bgcolor: '#eff6ff', borderBottom: '1px solid #e5e7eb' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <CourierIcon sx={{ fontSize: '18px', color: '#2563eb' }} />
                                                    <Typography sx={{ fontSize: '13px', fontWeight: 600 }}>
                                                        Courier Services
                                                    </Typography>
                                                    <Chip
                                                        label={courierCount}
                                                        size="small"
                                                        sx={{ fontSize: '10px', height: '18px' }}
                                                        color={courierCount > 0 ? 'primary' : 'default'}
                                                    />
                                                </Box>
                                                <Box sx={{ display: 'flex', gap: 1 }}>
                                                    <Button
                                                        size="small"
                                                        onClick={() => handleSelectAllServices('courier')}
                                                        sx={{ fontSize: '10px', minWidth: 'auto', px: 1 }}
                                                    >
                                                        All
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        onClick={() => handleDeselectAllServices('courier')}
                                                        sx={{ fontSize: '10px', minWidth: 'auto', px: 1 }}
                                                    >
                                                        None
                                                    </Button>
                                                </Box>
                                            </Box>
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                Small package and document delivery services
                                            </Typography>
                                        </Box>

                                        <Box sx={{ p: 2, maxHeight: 300, overflow: 'auto' }}>
                                            <FormGroup>
                                                {courierServices.map((service) => (
                                                    <FormControlLabel
                                                        key={service.value}
                                                        control={
                                                            <Checkbox
                                                                size="small"
                                                                checked={(data.supportedServices.courier || []).includes(service.value)}
                                                                onChange={() => handleServiceToggle('courier', service.value)}
                                                            />
                                                        }
                                                        label={
                                                            <Box>
                                                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                    {service.label}
                                                                </Typography>
                                                                <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                                    {service.description}
                                                                </Typography>
                                                            </Box>
                                                        }
                                                        sx={{ mb: 1, alignItems: 'flex-start' }}
                                                    />
                                                ))}
                                            </FormGroup>
                                        </Box>
                                    </Paper>
                                </Grid>
                            )}

                            {/* Freight Services - Only show for freight or hybrid carriers */}
                            {showFreightServices && (
                                <Grid item xs={12} md={showCourierServices ? 6 : 12}>
                                    <Paper sx={{ border: '1px solid #e5e7eb', borderRadius: 1, overflow: 'hidden' }}>
                                        <Box sx={{ p: 2, bgcolor: '#fef3ff', borderBottom: '1px solid #e5e7eb' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <FreightIcon sx={{ fontSize: '18px', color: '#7c3aed' }} />
                                                    <Typography sx={{ fontSize: '13px', fontWeight: 600 }}>
                                                        Freight Services
                                                    </Typography>
                                                    <Chip
                                                        label={freightCount}
                                                        size="small"
                                                        sx={{ fontSize: '10px', height: '18px' }}
                                                        color={freightCount > 0 ? 'secondary' : 'default'}
                                                    />
                                                </Box>
                                                <Box sx={{ display: 'flex', gap: 1 }}>
                                                    <Button
                                                        size="small"
                                                        onClick={() => handleSelectAllServices('freight')}
                                                        sx={{ fontSize: '10px', minWidth: 'auto', px: 1 }}
                                                    >
                                                        All
                                                    </Button>
                                                    <Button
                                                        size="small"
                                                        onClick={() => handleDeselectAllServices('freight')}
                                                        sx={{ fontSize: '10px', minWidth: 'auto', px: 1 }}
                                                    >
                                                        None
                                                    </Button>
                                                </Box>
                                            </Box>
                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                LTL, FTL, and specialized freight services
                                            </Typography>
                                        </Box>

                                        <Box sx={{ p: 2, maxHeight: 300, overflow: 'auto' }}>
                                            <FormGroup>
                                                {freightServices.map((service) => (
                                                    <FormControlLabel
                                                        key={service.value}
                                                        control={
                                                            <Checkbox
                                                                size="small"
                                                                checked={(data.supportedServices.freight || []).includes(service.value)}
                                                                onChange={() => handleServiceToggle('freight', service.value)}
                                                            />
                                                        }
                                                        label={
                                                            <Box>
                                                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                    {service.label}
                                                                </Typography>
                                                                <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                                    {service.description}
                                                                </Typography>
                                                            </Box>
                                                        }
                                                        sx={{ mb: 1, alignItems: 'flex-start' }}
                                                    />
                                                ))}
                                            </FormGroup>
                                        </Box>
                                    </Paper>
                                </Grid>
                            )}
                        </Grid>
                    )}

                    {/* Selected Services Summary */}
                    {totalServices > 0 && (
                        <Box sx={{ mt: 3, p: 2, bgcolor: '#f0fdf4', borderRadius: 1, border: '1px solid #bbf7d0' }}>
                            <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 2, color: '#065f46' }}>
                                Selected Services Summary ({totalServices} total)
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {showCourierServices && (data.supportedServices.courier || []).map((service) => (
                                    <Chip
                                        key={`courier-${service}`}
                                        label={courierServices.find(s => s.value === service)?.label}
                                        size="small"
                                        color="primary"
                                        variant="outlined"
                                        sx={{ fontSize: '10px' }}
                                    />
                                ))}
                                {showFreightServices && (data.supportedServices.freight || []).map((service) => (
                                    <Chip
                                        key={`freight-${service}`}
                                        label={freightServices.find(s => s.value === service)?.label}
                                        size="small"
                                        color="secondary"
                                        variant="outlined"
                                        sx={{ fontSize: '10px' }}
                                    />
                                ))}
                            </Box>
                        </Box>
                    )}
                </AccordionDetails>
            </Accordion>

            {/* Eligibility Rules Section */}
            <Accordion
                defaultExpanded={false}
                sx={{
                    mb: 3,
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px !important',
                    '&:before': {
                        display: 'none',
                    },
                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                }}
            >
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{
                        bgcolor: '#f8fafc',
                        borderRadius: '8px 8px 0 0',
                        '&.Mui-expanded': {
                            borderRadius: '8px 8px 0 0',
                        },
                        minHeight: 56,
                        '& .MuiAccordionSummary-content': {
                            alignItems: 'center',
                            gap: 2
                        }
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                        <Typography sx={{ fontSize: '18px' }}>
                            🎯
                        </Typography>
                        <Box sx={{ flex: 1 }}>
                            <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                Eligibility Rules
                            </Typography>
                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                Configure when this carrier should be offered
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                {Object.values(data.eligibilityRules?.geographicRouting || {}).filter(Boolean).length +
                                    (data.eligibilityRules?.weightRanges?.length || 0) +
                                    (data.eligibilityRules?.dimensionRestrictions?.length || 0)} Rules
                            </Typography>
                        </Box>
                    </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ p: 3, bgcolor: 'white' }}>
                    <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                        Configure when this carrier should be offered to customers based on shipment characteristics.
                    </Typography>

                    <Grid container spacing={3}>
                        {/* Geographic Routing */}
                        <Grid item xs={12}>
                            <Accordion>
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    sx={{ bgcolor: '#f8fafc' }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography sx={{ fontSize: '13px', fontWeight: 500 }}>
                                            Geographic Routing Options
                                        </Typography>
                                        <Chip
                                            label={Object.values(data.eligibilityRules?.geographicRouting || {}).filter(Boolean).length}
                                            size="small"
                                            sx={{ fontSize: '10px', height: '18px' }}
                                            color="default"
                                        />
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <Typography sx={{ fontSize: '11px', color: '#6b7280', mb: 2 }}>
                                        Select the geographic routing types this carrier supports.
                                    </Typography>
                                    <Grid container spacing={2}>
                                        {/* Domestic Country Options */}
                                        <Grid item xs={12} sm={6}>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={data.eligibilityRules?.geographicRouting?.domesticCanada || false}
                                                        onChange={(e) => handleEligibilityChange('geographicRouting', 'domesticCanada', e.target.checked)}
                                                    />
                                                }
                                                label={
                                                    <Box>
                                                        <Typography sx={{ fontSize: '12px' }}>
                                                            Domestic Canada (All CA)
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                            Entire Canada domestic shipping
                                                        </Typography>
                                                    </Box>
                                                }
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={data.eligibilityRules?.geographicRouting?.domesticUS || false}
                                                        onChange={(e) => handleEligibilityChange('geographicRouting', 'domesticUS', e.target.checked)}
                                                    />
                                                }
                                                label={
                                                    <Box>
                                                        <Typography sx={{ fontSize: '12px' }}>
                                                            Domestic US (All US)
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                            Entire United States domestic shipping
                                                        </Typography>
                                                    </Box>
                                                }
                                            />
                                        </Grid>

                                        {/* Regional Options */}
                                        <Grid item xs={12} sm={6}>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={data.eligibilityRules?.geographicRouting?.provinceToProvince || false}
                                                        onChange={(e) => handleEligibilityChange('geographicRouting', 'provinceToProvince', e.target.checked)}
                                                    />
                                                }
                                                label={
                                                    <Box>
                                                        <Typography sx={{ fontSize: '12px' }}>
                                                            Province-to-Province (CA)
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                            Canadian interprovincial (specific routes)
                                                        </Typography>
                                                    </Box>
                                                }
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={data.eligibilityRules?.geographicRouting?.stateToState || false}
                                                        onChange={(e) => handleEligibilityChange('geographicRouting', 'stateToState', e.target.checked)}
                                                    />
                                                }
                                                label={
                                                    <Box>
                                                        <Typography sx={{ fontSize: '12px' }}>
                                                            State-to-State (US)
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                            US interstate (specific routes)
                                                        </Typography>
                                                    </Box>
                                                }
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={data.eligibilityRules?.geographicRouting?.provinceToState || false}
                                                        onChange={(e) => handleEligibilityChange('geographicRouting', 'provinceToState', e.target.checked)}
                                                    />
                                                }
                                                label={
                                                    <Box>
                                                        <Typography sx={{ fontSize: '12px' }}>
                                                            Province-to-State (CA ↔ US)
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                            Canada ↔ US cross-border (both directions)
                                                        </Typography>
                                                    </Box>
                                                }
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={data.eligibilityRules?.geographicRouting?.countryToCountry || false}
                                                        onChange={(e) => handleEligibilityChange('geographicRouting', 'countryToCountry', e.target.checked)}
                                                    />
                                                }
                                                label={
                                                    <Box>
                                                        <Typography sx={{ fontSize: '12px' }}>
                                                            Country-to-Country (International)
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                            Full international shipping between countries
                                                        </Typography>
                                                    </Box>
                                                }
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={data.eligibilityRules?.geographicRouting?.provinceStateToCity || false}
                                                        onChange={(e) => handleEligibilityChange('geographicRouting', 'provinceStateToCity', e.target.checked)}
                                                    />
                                                }
                                                label={
                                                    <Box>
                                                        <Typography sx={{ fontSize: '12px' }}>
                                                            Province/State-to-City
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                            From province/state to specific cities
                                                        </Typography>
                                                    </Box>
                                                }
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <FormControlLabel
                                                control={
                                                    <Checkbox
                                                        checked={data.eligibilityRules?.geographicRouting?.cityToCity || false}
                                                        onChange={(e) => handleEligibilityChange('geographicRouting', 'cityToCity', e.target.checked)}
                                                    />
                                                }
                                                label={
                                                    <Box>
                                                        <Typography sx={{ fontSize: '12px' }}>
                                                            City-to-City (Local)
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                            Local metropolitan shipping
                                                        </Typography>
                                                    </Box>
                                                }
                                            />
                                        </Grid>
                                    </Grid>

                                    {/* Province-to-Province Pair Routing */}
                                    {data.eligibilityRules?.geographicRouting?.provinceToProvince && (
                                        <Box sx={{ mt: 3, p: 2, bgcolor: '#f0f9ff', borderRadius: 1, border: '1px solid #bfdbfe' }}>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 2, color: '#1e40af' }}>
                                                Province-to-Province Pair Routing
                                            </Typography>
                                            <Typography sx={{ fontSize: '11px', color: '#1e40af', mb: 3 }}>
                                                Define specific province-to-province routes this carrier supports within Canada
                                            </Typography>

                                            {(data.eligibilityRules?.geographicRouting?.provinceProvinceRouting || []).map((routePair, index) => (
                                                <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                                                        <FormControl size="small" sx={{ width: 150 }}>
                                                            <InputLabel sx={{ fontSize: '12px' }}>From Province</InputLabel>
                                                            <Select
                                                                value={routePair.from || ''}
                                                                onChange={(e) => {
                                                                    const current = data.eligibilityRules?.geographicRouting?.provinceProvinceRouting || [];
                                                                    const updated = [...current];
                                                                    updated[index] = { ...updated[index], from: e.target.value };
                                                                    handleEligibilityChange('geographicRouting', 'provinceProvinceRouting', updated);
                                                                }}
                                                                label="From Province"
                                                                sx={{
                                                                    '& .MuiSelect-select': { fontSize: '12px' }
                                                                }}
                                                            >
                                                                {canadianProvinces.map((province) => (
                                                                    <MenuItem key={province.code} value={province.code} sx={{ fontSize: '12px' }}>
                                                                        {province.code} - {province.name}
                                                                    </MenuItem>
                                                                ))}
                                                            </Select>
                                                        </FormControl>
                                                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>→</Typography>
                                                        <FormControl size="small" sx={{ width: 150 }}>
                                                            <InputLabel sx={{ fontSize: '12px' }}>To Province</InputLabel>
                                                            <Select
                                                                value={routePair.to || ''}
                                                                onChange={(e) => {
                                                                    const current = data.eligibilityRules?.geographicRouting?.provinceProvinceRouting || [];
                                                                    const updated = [...current];
                                                                    updated[index] = { ...updated[index], to: e.target.value };
                                                                    handleEligibilityChange('geographicRouting', 'provinceProvinceRouting', updated);
                                                                }}
                                                                label="To Province"
                                                                sx={{
                                                                    '& .MuiSelect-select': { fontSize: '12px' }
                                                                }}
                                                            >
                                                                {canadianProvinces.map((province) => (
                                                                    <MenuItem key={province.code} value={province.code} sx={{ fontSize: '12px' }}>
                                                                        {province.code} - {province.name}
                                                                    </MenuItem>
                                                                ))}
                                                            </Select>
                                                        </FormControl>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => {
                                                                const current = data.eligibilityRules?.geographicRouting?.provinceProvinceRouting || [];
                                                                const updated = current.filter((_, i) => i !== index);
                                                                handleEligibilityChange('geographicRouting', 'provinceProvinceRouting', updated);
                                                            }}
                                                            sx={{ color: '#d32f2f' }}
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Box>
                                                    <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                        Route {index + 1}: {routePair.from || 'From province'} → {routePair.to || 'To province'}
                                                    </Typography>
                                                </Paper>
                                            ))}

                                            <Button
                                                size="small"
                                                startIcon={<AddIcon />}
                                                onClick={() => {
                                                    const current = data.eligibilityRules?.geographicRouting?.provinceProvinceRouting || [];
                                                    const updated = [...current, { from: '', to: '' }];
                                                    handleEligibilityChange('geographicRouting', 'provinceProvinceRouting', updated);
                                                }}
                                                variant="outlined"
                                                sx={{ fontSize: '11px' }}
                                            >
                                                Add Province Route
                                            </Button>
                                        </Box>
                                    )}

                                    {/* State-to-State Pair Routing */}
                                    {data.eligibilityRules?.geographicRouting?.stateToState && (
                                        <Box sx={{ mt: 3, p: 2, bgcolor: '#fef3ff', borderRadius: 1, border: '1px solid #e9d5ff' }}>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 2, color: '#7c3aed' }}>
                                                State-to-State Pair Routing
                                            </Typography>
                                            <Typography sx={{ fontSize: '11px', color: '#7c3aed', mb: 3 }}>
                                                Define specific state-to-state routes this carrier supports within US
                                            </Typography>

                                            {(data.eligibilityRules?.geographicRouting?.stateStateRouting || []).map((routePair, index) => (
                                                <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                                                        <FormControl size="small" sx={{ width: 150 }}>
                                                            <InputLabel sx={{ fontSize: '12px' }}>From State</InputLabel>
                                                            <Select
                                                                value={routePair.from || ''}
                                                                onChange={(e) => {
                                                                    const current = data.eligibilityRules?.geographicRouting?.stateStateRouting || [];
                                                                    const updated = [...current];
                                                                    updated[index] = { ...updated[index], from: e.target.value };
                                                                    handleEligibilityChange('geographicRouting', 'stateStateRouting', updated);
                                                                }}
                                                                label="From State"
                                                                sx={{
                                                                    '& .MuiSelect-select': { fontSize: '12px' }
                                                                }}
                                                            >
                                                                {usStates.map((state) => (
                                                                    <MenuItem key={state.code} value={state.code} sx={{ fontSize: '12px' }}>
                                                                        {state.code} - {state.name}
                                                                    </MenuItem>
                                                                ))}
                                                            </Select>
                                                        </FormControl>
                                                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>→</Typography>
                                                        <FormControl size="small" sx={{ width: 150 }}>
                                                            <InputLabel sx={{ fontSize: '12px' }}>To State</InputLabel>
                                                            <Select
                                                                value={routePair.to || ''}
                                                                onChange={(e) => {
                                                                    const current = data.eligibilityRules?.geographicRouting?.stateStateRouting || [];
                                                                    const updated = [...current];
                                                                    updated[index] = { ...updated[index], to: e.target.value };
                                                                    handleEligibilityChange('geographicRouting', 'stateStateRouting', updated);
                                                                }}
                                                                label="To State"
                                                                sx={{
                                                                    '& .MuiSelect-select': { fontSize: '12px' }
                                                                }}
                                                            >
                                                                {usStates.map((state) => (
                                                                    <MenuItem key={state.code} value={state.code} sx={{ fontSize: '12px' }}>
                                                                        {state.code} - {state.name}
                                                                    </MenuItem>
                                                                ))}
                                                            </Select>
                                                        </FormControl>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => {
                                                                const current = data.eligibilityRules?.geographicRouting?.stateStateRouting || [];
                                                                const updated = current.filter((_, i) => i !== index);
                                                                handleEligibilityChange('geographicRouting', 'stateStateRouting', updated);
                                                            }}
                                                            sx={{ color: '#d32f2f' }}
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Box>
                                                    <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                        Route {index + 1}: {routePair.from || 'From state'} → {routePair.to || 'To state'}
                                                    </Typography>
                                                </Paper>
                                            ))}

                                            <Button
                                                size="small"
                                                startIcon={<AddIcon />}
                                                onClick={() => {
                                                    const current = data.eligibilityRules?.geographicRouting?.stateStateRouting || [];
                                                    const updated = [...current, { from: '', to: '' }];
                                                    handleEligibilityChange('geographicRouting', 'stateStateRouting', updated);
                                                }}
                                                variant="outlined"
                                                sx={{ fontSize: '11px' }}
                                            >
                                                Add State Route
                                            </Button>
                                        </Box>
                                    )}

                                    {/* Province-to-State Pair Routing */}
                                    {data.eligibilityRules?.geographicRouting?.provinceToState && (
                                        <Box sx={{ mt: 3, p: 2, bgcolor: '#f0fdf4', borderRadius: 1, border: '1px solid #bbf7d0' }}>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 2, color: '#065f46' }}>
                                                Province-to-State Pair Routing
                                            </Typography>
                                            <Typography sx={{ fontSize: '11px', color: '#065f46', mb: 3 }}>
                                                Define specific province ↔ state routes this carrier supports (both directions)
                                            </Typography>

                                            {(data.eligibilityRules?.geographicRouting?.provinceStateRouting || []).map((routePair, index) => (
                                                <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                                                        <FormControl size="small" sx={{ width: 150 }}>
                                                            <InputLabel sx={{ fontSize: '12px' }}>From Location</InputLabel>
                                                            <Select
                                                                value={routePair.from || ''}
                                                                onChange={(e) => {
                                                                    const current = data.eligibilityRules?.geographicRouting?.provinceStateRouting || [];
                                                                    const updated = [...current];
                                                                    updated[index] = { ...updated[index], from: e.target.value };
                                                                    handleEligibilityChange('geographicRouting', 'provinceStateRouting', updated);
                                                                }}
                                                                label="From Location"
                                                                sx={{
                                                                    '& .MuiSelect-select': { fontSize: '12px' }
                                                                }}
                                                            >
                                                                <MenuItem disabled sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                                    Canadian Provinces
                                                                </MenuItem>
                                                                {canadianProvinces.map((province) => (
                                                                    <MenuItem key={province.code} value={province.code} sx={{ fontSize: '12px' }}>
                                                                        {province.code} - {province.name}
                                                                    </MenuItem>
                                                                ))}
                                                                <MenuItem disabled sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                                    US States
                                                                </MenuItem>
                                                                {usStates.map((state) => (
                                                                    <MenuItem key={state.code} value={state.code} sx={{ fontSize: '12px' }}>
                                                                        {state.code} - {state.name}
                                                                    </MenuItem>
                                                                ))}
                                                            </Select>
                                                        </FormControl>
                                                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>↔</Typography>
                                                        <FormControl size="small" sx={{ width: 150 }}>
                                                            <InputLabel sx={{ fontSize: '12px' }}>To Location</InputLabel>
                                                            <Select
                                                                value={routePair.to || ''}
                                                                onChange={(e) => {
                                                                    const current = data.eligibilityRules?.geographicRouting?.provinceStateRouting || [];
                                                                    const updated = [...current];
                                                                    updated[index] = { ...updated[index], to: e.target.value };
                                                                    handleEligibilityChange('geographicRouting', 'provinceStateRouting', updated);
                                                                }}
                                                                label="To Location"
                                                                sx={{
                                                                    '& .MuiSelect-select': { fontSize: '12px' }
                                                                }}
                                                            >
                                                                <MenuItem disabled sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                                    Canadian Provinces
                                                                </MenuItem>
                                                                {canadianProvinces.map((province) => (
                                                                    <MenuItem key={province.code} value={province.code} sx={{ fontSize: '12px' }}>
                                                                        {province.code} - {province.name}
                                                                    </MenuItem>
                                                                ))}
                                                                <MenuItem disabled sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                                    US States
                                                                </MenuItem>
                                                                {usStates.map((state) => (
                                                                    <MenuItem key={state.code} value={state.code} sx={{ fontSize: '12px' }}>
                                                                        {state.code} - {state.name}
                                                                    </MenuItem>
                                                                ))}
                                                            </Select>
                                                        </FormControl>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => {
                                                                const current = data.eligibilityRules?.geographicRouting?.provinceStateRouting || [];
                                                                const updated = current.filter((_, i) => i !== index);
                                                                handleEligibilityChange('geographicRouting', 'provinceStateRouting', updated);
                                                            }}
                                                            sx={{ color: '#d32f2f' }}
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Box>
                                                    <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                        Route {index + 1}: {routePair.from || 'From location'} ↔ {routePair.to || 'To location'}
                                                    </Typography>
                                                </Paper>
                                            ))}

                                            <Button
                                                size="small"
                                                startIcon={<AddIcon />}
                                                onClick={() => {
                                                    const current = data.eligibilityRules?.geographicRouting?.provinceStateRouting || [];
                                                    const updated = [...current, { from: '', to: '' }];
                                                    handleEligibilityChange('geographicRouting', 'provinceStateRouting', updated);
                                                }}
                                                variant="outlined"
                                                sx={{ fontSize: '11px' }}
                                            >
                                                Add Cross-Border Route
                                            </Button>
                                        </Box>
                                    )}

                                    {/* Country-to-Country Pair Routing */}
                                    {data.eligibilityRules?.geographicRouting?.countryToCountry && (
                                        <Box sx={{ mt: 3, p: 2, bgcolor: '#fdf4ff', borderRadius: 1, border: '1px solid #d8b4fe' }}>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 2, color: '#7c3aed' }}>
                                                Country-to-Country Pair Routing
                                            </Typography>
                                            <Typography sx={{ fontSize: '11px', color: '#7c3aed', mb: 3 }}>
                                                Define specific country-to-country routes this carrier supports for international shipping
                                            </Typography>

                                            {(data.eligibilityRules?.geographicRouting?.countryCountryRouting || []).map((routePair, index) => (
                                                <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: 'white', border: '1px solid #e5e7eb' }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                                                        <FormControl size="small" sx={{ width: 150 }}>
                                                            <InputLabel sx={{ fontSize: '12px' }}>From Country</InputLabel>
                                                            <Select
                                                                value={routePair.from || ''}
                                                                onChange={(e) => {
                                                                    const current = data.eligibilityRules?.geographicRouting?.countryCountryRouting || [];
                                                                    const updated = [...current];
                                                                    updated[index] = { ...updated[index], from: e.target.value };
                                                                    handleEligibilityChange('geographicRouting', 'countryCountryRouting', updated);
                                                                }}
                                                                label="From Country"
                                                                sx={{
                                                                    '& .MuiSelect-select': { fontSize: '12px' }
                                                                }}
                                                            >
                                                                <MenuItem value="CA" sx={{ fontSize: '12px' }}>
                                                                    CA - Canada
                                                                </MenuItem>
                                                                <MenuItem value="US" sx={{ fontSize: '12px' }}>
                                                                    US - United States
                                                                </MenuItem>
                                                                <MenuItem value="MX" sx={{ fontSize: '12px' }}>
                                                                    MX - Mexico
                                                                </MenuItem>
                                                                <MenuItem value="GB" sx={{ fontSize: '12px' }}>
                                                                    GB - United Kingdom
                                                                </MenuItem>
                                                                <MenuItem value="DE" sx={{ fontSize: '12px' }}>
                                                                    DE - Germany
                                                                </MenuItem>
                                                                <MenuItem value="FR" sx={{ fontSize: '12px' }}>
                                                                    FR - France
                                                                </MenuItem>
                                                                <MenuItem value="AU" sx={{ fontSize: '12px' }}>
                                                                    AU - Australia
                                                                </MenuItem>
                                                                <MenuItem value="CN" sx={{ fontSize: '12px' }}>
                                                                    CN - China
                                                                </MenuItem>
                                                            </Select>
                                                        </FormControl>
                                                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>→</Typography>
                                                        <FormControl size="small" sx={{ width: 150 }}>
                                                            <InputLabel sx={{ fontSize: '12px' }}>To Country</InputLabel>
                                                            <Select
                                                                value={routePair.to || ''}
                                                                onChange={(e) => {
                                                                    const current = data.eligibilityRules?.geographicRouting?.countryCountryRouting || [];
                                                                    const updated = [...current];
                                                                    updated[index] = { ...updated[index], to: e.target.value };
                                                                    handleEligibilityChange('geographicRouting', 'countryCountryRouting', updated);
                                                                }}
                                                                label="To Country"
                                                                sx={{
                                                                    '& .MuiSelect-select': { fontSize: '12px' }
                                                                }}
                                                            >
                                                                <MenuItem value="CA" sx={{ fontSize: '12px' }}>
                                                                    CA - Canada
                                                                </MenuItem>
                                                                <MenuItem value="US" sx={{ fontSize: '12px' }}>
                                                                    US - United States
                                                                </MenuItem>
                                                                <MenuItem value="MX" sx={{ fontSize: '12px' }}>
                                                                    MX - Mexico
                                                                </MenuItem>
                                                                <MenuItem value="GB" sx={{ fontSize: '12px' }}>
                                                                    GB - United Kingdom
                                                                </MenuItem>
                                                                <MenuItem value="DE" sx={{ fontSize: '12px' }}>
                                                                    DE - Germany
                                                                </MenuItem>
                                                                <MenuItem value="FR" sx={{ fontSize: '12px' }}>
                                                                    FR - France
                                                                </MenuItem>
                                                                <MenuItem value="AU" sx={{ fontSize: '12px' }}>
                                                                    AU - Australia
                                                                </MenuItem>
                                                                <MenuItem value="CN" sx={{ fontSize: '12px' }}>
                                                                    CN - China
                                                                </MenuItem>
                                                            </Select>
                                                        </FormControl>
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => {
                                                                const current = data.eligibilityRules?.geographicRouting?.countryCountryRouting || [];
                                                                const updated = current.filter((_, i) => i !== index);
                                                                handleEligibilityChange('geographicRouting', 'countryCountryRouting', updated);
                                                            }}
                                                            sx={{ color: '#d32f2f' }}
                                                        >
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Box>
                                                    <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                        Route {index + 1}: {routePair.from || 'From country'} → {routePair.to || 'To country'}
                                                    </Typography>
                                                </Paper>
                                            ))}

                                            <Button
                                                size="small"
                                                startIcon={<AddIcon />}
                                                onClick={() => {
                                                    const current = data.eligibilityRules?.geographicRouting?.countryCountryRouting || [];
                                                    const updated = [...current, { from: '', to: '' }];
                                                    handleEligibilityChange('geographicRouting', 'countryCountryRouting', updated);
                                                }}
                                                variant="outlined"
                                                sx={{ fontSize: '11px' }}
                                            >
                                                Add Country Route
                                            </Button>
                                        </Box>
                                    )}

                                    {/* Province/State-to-City Pair Routing */}
                                    {data.eligibilityRules?.geographicRouting?.provinceStateToCity && (
                                        <Box sx={{ mt: 3, p: 2, bgcolor: '#f0f9ff', borderRadius: 1, border: '1px solid #bfdbfe' }}>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 2, color: '#1e40af' }}>
                                                Province/State-to-City Pair Routing
                                            </Typography>
                                            <Typography sx={{ fontSize: '11px', color: '#1e40af', mb: 3 }}>
                                                Define specific province/state to city routes this carrier supports
                                            </Typography>

                                            {(data.eligibilityRules?.geographicRouting?.provinceStateCityRouting || []).map((routePair, index) => (
                                                <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                                                    <Grid container spacing={2} alignItems="center">
                                                        <Grid item xs={12} sm={5}>
                                                            <FormControl size="small" fullWidth>
                                                                <InputLabel sx={{ fontSize: '12px' }}>From Province/State</InputLabel>
                                                                <Select
                                                                    value={routePair.from || ''}
                                                                    onChange={(e) => {
                                                                        const current = data.eligibilityRules?.geographicRouting?.provinceStateCityRouting || [];
                                                                        const updated = [...current];
                                                                        updated[index] = { ...updated[index], from: e.target.value };
                                                                        handleEligibilityChange('geographicRouting', 'provinceStateCityRouting', updated);
                                                                    }}
                                                                    label="From Province/State"
                                                                    sx={{
                                                                        '& .MuiSelect-select': { fontSize: '12px' }
                                                                    }}
                                                                >
                                                                    <MenuItem disabled sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                                        Canadian Provinces
                                                                    </MenuItem>
                                                                    {canadianProvinces.map((province) => (
                                                                        <MenuItem key={province.code} value={province.code} sx={{ fontSize: '12px' }}>
                                                                            {province.code} - {province.name}
                                                                        </MenuItem>
                                                                    ))}
                                                                    <MenuItem disabled sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                                        US States
                                                                    </MenuItem>
                                                                    {usStates.map((state) => (
                                                                        <MenuItem key={state.code} value={state.code} sx={{ fontSize: '12px' }}>
                                                                            {state.code} - {state.name}
                                                                        </MenuItem>
                                                                    ))}
                                                                </Select>
                                                            </FormControl>
                                                        </Grid>
                                                        <Grid item xs={12} sm={1} sx={{ textAlign: 'center' }}>
                                                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>→</Typography>
                                                        </Grid>
                                                        <Grid item xs={12} sm={5}>
                                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                                <TextField
                                                                    size="small"
                                                                    label="To City"
                                                                    value={routePair.toCity || ''}
                                                                    onChange={(e) => {
                                                                        const current = data.eligibilityRules?.geographicRouting?.provinceStateCityRouting || [];
                                                                        const updated = [...current];
                                                                        updated[index] = { ...updated[index], toCity: e.target.value };
                                                                        handleEligibilityChange('geographicRouting', 'provinceStateCityRouting', updated);
                                                                    }}
                                                                    placeholder="e.g., Toronto"
                                                                    sx={{
                                                                        flex: 1,
                                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                                    }}
                                                                />
                                                                <FormControl size="small" sx={{ minWidth: 80 }}>
                                                                    <InputLabel sx={{ fontSize: '12px' }}>Prov/State</InputLabel>
                                                                    <Select
                                                                        value={routePair.toProvState || ''}
                                                                        onChange={(e) => {
                                                                            const current = data.eligibilityRules?.geographicRouting?.provinceStateCityRouting || [];
                                                                            const updated = [...current];
                                                                            updated[index] = { ...updated[index], toProvState: e.target.value };
                                                                            handleEligibilityChange('geographicRouting', 'provinceStateCityRouting', updated);
                                                                        }}
                                                                        label="Prov/State"
                                                                        sx={{
                                                                            '& .MuiSelect-select': { fontSize: '12px' }
                                                                        }}
                                                                    >
                                                                        <MenuItem disabled sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                                            CA Prov
                                                                        </MenuItem>
                                                                        {canadianProvinces.map((province) => (
                                                                            <MenuItem key={province.code} value={province.code} sx={{ fontSize: '12px' }}>
                                                                                {province.code}
                                                                            </MenuItem>
                                                                        ))}
                                                                        <MenuItem disabled sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                                            US States
                                                                        </MenuItem>
                                                                        {usStates.map((state) => (
                                                                            <MenuItem key={state.code} value={state.code} sx={{ fontSize: '12px' }}>
                                                                                {state.code}
                                                                            </MenuItem>
                                                                        ))}
                                                                    </Select>
                                                                </FormControl>
                                                                <FormControl size="small" sx={{ minWidth: 60 }}>
                                                                    <InputLabel sx={{ fontSize: '12px' }}>Country</InputLabel>
                                                                    <Select
                                                                        value={routePair.toCountry || ''}
                                                                        onChange={(e) => {
                                                                            const current = data.eligibilityRules?.geographicRouting?.provinceStateCityRouting || [];
                                                                            const updated = [...current];
                                                                            updated[index] = { ...updated[index], toCountry: e.target.value };
                                                                            handleEligibilityChange('geographicRouting', 'provinceStateCityRouting', updated);
                                                                        }}
                                                                        label="Country"
                                                                        sx={{
                                                                            '& .MuiSelect-select': { fontSize: '12px' }
                                                                        }}
                                                                    >
                                                                        <MenuItem value="CA" sx={{ fontSize: '12px' }}>
                                                                            CA
                                                                        </MenuItem>
                                                                        <MenuItem value="US" sx={{ fontSize: '12px' }}>
                                                                            US
                                                                        </MenuItem>
                                                                    </Select>
                                                                </FormControl>
                                                            </Box>
                                                        </Grid>
                                                        <Grid item xs={12} sm={1} sx={{ textAlign: 'center' }}>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => {
                                                                    const current = data.eligibilityRules?.geographicRouting?.provinceStateCityRouting || [];
                                                                    const updated = current.filter((_, i) => i !== index);
                                                                    handleEligibilityChange('geographicRouting', 'provinceStateCityRouting', updated);
                                                                }}
                                                                sx={{ color: '#d32f2f' }}
                                                            >
                                                                <DeleteIcon fontSize="small" />
                                                            </IconButton>
                                                        </Grid>
                                                    </Grid>
                                                    <Typography sx={{ fontSize: '10px', color: '#6b7280', mt: 1 }}>
                                                        Route {index + 1}: {routePair.from || 'From province/state'} → {routePair.toCity || 'To city'}, {routePair.toProvState || 'Province/State'}, {routePair.toCountry || 'Country'}
                                                    </Typography>
                                                </Paper>
                                            ))}

                                            <Button
                                                size="small"
                                                startIcon={<AddIcon />}
                                                onClick={() => {
                                                    const current = data.eligibilityRules?.geographicRouting?.provinceStateCityRouting || [];
                                                    const updated = [...current, { from: '', toCity: '', toProvState: '', toCountry: '' }];
                                                    handleEligibilityChange('geographicRouting', 'provinceStateCityRouting', updated);
                                                }}
                                                variant="outlined"
                                                sx={{ fontSize: '11px' }}
                                            >
                                                Add Province/State to City Route
                                            </Button>
                                        </Box>
                                    )}

                                    {/* City-to-City Routing */}
                                    {data.eligibilityRules?.geographicRouting?.cityToCity && (
                                        <Box sx={{ mt: 3, p: 2, bgcolor: '#fff7ed', borderRadius: 1, border: '1px solid #fed7aa' }}>
                                            <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 2, color: '#c2410c' }}>
                                                City Pair Routing
                                            </Typography>
                                            <Typography sx={{ fontSize: '11px', color: '#c2410c', mb: 3 }}>
                                                Define specific city-to-city routes this carrier supports with complete address information
                                            </Typography>

                                            {(data.eligibilityRules?.geographicRouting?.cityPairRouting || []).map((cityPair, index) => (
                                                <Paper key={index} sx={{ p: 2, mb: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                                                    <Grid container spacing={2} alignItems="center">
                                                        {/* From City Section */}
                                                        <Grid item xs={12} sm={5}>
                                                            <Typography sx={{ fontSize: '11px', fontWeight: 500, mb: 1, color: '#6b7280' }}>
                                                                Origin
                                                            </Typography>
                                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                                <TextField
                                                                    size="small"
                                                                    label="From City"
                                                                    value={cityPair.fromCity || ''}
                                                                    onChange={(e) => {
                                                                        const current = data.eligibilityRules?.geographicRouting?.cityPairRouting || [];
                                                                        const updated = [...current];
                                                                        updated[index] = { ...updated[index], fromCity: e.target.value };
                                                                        handleEligibilityChange('geographicRouting', 'cityPairRouting', updated);
                                                                    }}
                                                                    placeholder="e.g., Toronto"
                                                                    sx={{
                                                                        flex: 1,
                                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                                    }}
                                                                />
                                                                <FormControl size="small" sx={{ minWidth: 80 }}>
                                                                    <InputLabel sx={{ fontSize: '12px' }}>Prov/State</InputLabel>
                                                                    <Select
                                                                        value={cityPair.fromProvState || ''}
                                                                        onChange={(e) => {
                                                                            const current = data.eligibilityRules?.geographicRouting?.cityPairRouting || [];
                                                                            const updated = [...current];
                                                                            updated[index] = { ...updated[index], fromProvState: e.target.value };
                                                                            handleEligibilityChange('geographicRouting', 'cityPairRouting', updated);
                                                                        }}
                                                                        label="Prov/State"
                                                                        sx={{
                                                                            '& .MuiSelect-select': { fontSize: '12px' }
                                                                        }}
                                                                    >
                                                                        <MenuItem disabled sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                                            CA Prov
                                                                        </MenuItem>
                                                                        {canadianProvinces.map((province) => (
                                                                            <MenuItem key={province.code} value={province.code} sx={{ fontSize: '12px' }}>
                                                                                {province.code}
                                                                            </MenuItem>
                                                                        ))}
                                                                        <MenuItem disabled sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                                            US States
                                                                        </MenuItem>
                                                                        {usStates.map((state) => (
                                                                            <MenuItem key={state.code} value={state.code} sx={{ fontSize: '12px' }}>
                                                                                {state.code}
                                                                            </MenuItem>
                                                                        ))}
                                                                    </Select>
                                                                </FormControl>
                                                                <FormControl size="small" sx={{ minWidth: 60 }}>
                                                                    <InputLabel sx={{ fontSize: '12px' }}>Country</InputLabel>
                                                                    <Select
                                                                        value={cityPair.fromCountry || ''}
                                                                        onChange={(e) => {
                                                                            const current = data.eligibilityRules?.geographicRouting?.cityPairRouting || [];
                                                                            const updated = [...current];
                                                                            updated[index] = { ...updated[index], fromCountry: e.target.value };
                                                                            handleEligibilityChange('geographicRouting', 'cityPairRouting', updated);
                                                                        }}
                                                                        label="Country"
                                                                        sx={{
                                                                            '& .MuiSelect-select': { fontSize: '12px' }
                                                                        }}
                                                                    >
                                                                        <MenuItem value="CA" sx={{ fontSize: '12px' }}>
                                                                            CA
                                                                        </MenuItem>
                                                                        <MenuItem value="US" sx={{ fontSize: '12px' }}>
                                                                            US
                                                                        </MenuItem>
                                                                        <MenuItem value="MX" sx={{ fontSize: '12px' }}>
                                                                            MX
                                                                        </MenuItem>
                                                                    </Select>
                                                                </FormControl>
                                                            </Box>
                                                        </Grid>

                                                        {/* Arrow */}
                                                        <Grid item xs={12} sm={1} sx={{ textAlign: 'center' }}>
                                                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>→</Typography>
                                                        </Grid>

                                                        {/* To City Section */}
                                                        <Grid item xs={12} sm={5}>
                                                            <Typography sx={{ fontSize: '11px', fontWeight: 500, mb: 1, color: '#6b7280' }}>
                                                                Destination
                                                            </Typography>
                                                            <Box sx={{ display: 'flex', gap: 1 }}>
                                                                <TextField
                                                                    size="small"
                                                                    label="To City"
                                                                    value={cityPair.toCity || ''}
                                                                    onChange={(e) => {
                                                                        const current = data.eligibilityRules?.geographicRouting?.cityPairRouting || [];
                                                                        const updated = [...current];
                                                                        updated[index] = { ...updated[index], toCity: e.target.value };
                                                                        handleEligibilityChange('geographicRouting', 'cityPairRouting', updated);
                                                                    }}
                                                                    placeholder="e.g., New York"
                                                                    sx={{
                                                                        flex: 1,
                                                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                                                    }}
                                                                />
                                                                <FormControl size="small" sx={{ minWidth: 80 }}>
                                                                    <InputLabel sx={{ fontSize: '12px' }}>Prov/State</InputLabel>
                                                                    <Select
                                                                        value={cityPair.toProvState || ''}
                                                                        onChange={(e) => {
                                                                            const current = data.eligibilityRules?.geographicRouting?.cityPairRouting || [];
                                                                            const updated = [...current];
                                                                            updated[index] = { ...updated[index], toProvState: e.target.value };
                                                                            handleEligibilityChange('geographicRouting', 'cityPairRouting', updated);
                                                                        }}
                                                                        label="Prov/State"
                                                                        sx={{
                                                                            '& .MuiSelect-select': { fontSize: '12px' }
                                                                        }}
                                                                    >
                                                                        <MenuItem disabled sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                                            CA Prov
                                                                        </MenuItem>
                                                                        {canadianProvinces.map((province) => (
                                                                            <MenuItem key={province.code} value={province.code} sx={{ fontSize: '12px' }}>
                                                                                {province.code}
                                                                            </MenuItem>
                                                                        ))}
                                                                        <MenuItem disabled sx={{ fontSize: '11px', fontWeight: 600 }}>
                                                                            US States
                                                                        </MenuItem>
                                                                        {usStates.map((state) => (
                                                                            <MenuItem key={state.code} value={state.code} sx={{ fontSize: '12px' }}>
                                                                                {state.code}
                                                                            </MenuItem>
                                                                        ))}
                                                                    </Select>
                                                                </FormControl>
                                                                <FormControl size="small" sx={{ minWidth: 60 }}>
                                                                    <InputLabel sx={{ fontSize: '12px' }}>Country</InputLabel>
                                                                    <Select
                                                                        value={cityPair.toCountry || ''}
                                                                        onChange={(e) => {
                                                                            const current = data.eligibilityRules?.geographicRouting?.cityPairRouting || [];
                                                                            const updated = [...current];
                                                                            updated[index] = { ...updated[index], toCountry: e.target.value };
                                                                            handleEligibilityChange('geographicRouting', 'cityPairRouting', updated);
                                                                        }}
                                                                        label="Country"
                                                                        sx={{
                                                                            '& .MuiSelect-select': { fontSize: '12px' }
                                                                        }}
                                                                    >
                                                                        <MenuItem value="CA" sx={{ fontSize: '12px' }}>
                                                                            CA
                                                                        </MenuItem>
                                                                        <MenuItem value="US" sx={{ fontSize: '12px' }}>
                                                                            US
                                                                        </MenuItem>
                                                                        <MenuItem value="MX" sx={{ fontSize: '12px' }}>
                                                                            MX
                                                                        </MenuItem>
                                                                    </Select>
                                                                </FormControl>
                                                            </Box>
                                                        </Grid>

                                                        {/* Delete Button */}
                                                        <Grid item xs={12} sm={1} sx={{ textAlign: 'center' }}>
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => {
                                                                    const current = data.eligibilityRules?.geographicRouting?.cityPairRouting || [];
                                                                    const updated = current.filter((_, i) => i !== index);
                                                                    handleEligibilityChange('geographicRouting', 'cityPairRouting', updated);
                                                                }}
                                                                sx={{ color: '#d32f2f' }}
                                                            >
                                                                <DeleteIcon fontSize="small" />
                                                            </IconButton>
                                                        </Grid>
                                                    </Grid>
                                                    <Typography sx={{ fontSize: '10px', color: '#6b7280', mt: 1 }}>
                                                        Route {index + 1}: {cityPair.fromCity || 'From city'}, {cityPair.fromProvState || 'Province/State'}, {cityPair.fromCountry || 'Country'} → {cityPair.toCity || 'To city'}, {cityPair.toProvState || 'Province/State'}, {cityPair.toCountry || 'Country'}
                                                    </Typography>
                                                </Paper>
                                            ))}

                                            <Button
                                                size="small"
                                                startIcon={<AddIcon />}
                                                onClick={() => {
                                                    const current = data.eligibilityRules?.geographicRouting?.cityPairRouting || [];
                                                    const updated = [...current, { fromCity: '', fromProvState: '', fromCountry: '', toCity: '', toProvState: '', toCountry: '' }];
                                                    handleEligibilityChange('geographicRouting', 'cityPairRouting', updated);
                                                }}
                                                variant="outlined"
                                                sx={{ fontSize: '11px' }}
                                            >
                                                Add City to City Route
                                            </Button>
                                        </Box>
                                    )}
                                </AccordionDetails>
                            </Accordion>
                        </Grid>

                        {/* Weight Ranges */}
                        <Grid item xs={12}>
                            <Accordion>
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    sx={{ bgcolor: '#f8fafc' }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography sx={{ fontSize: '13px', fontWeight: 500 }}>
                                            Weight Range Restrictions
                                        </Typography>
                                        <Chip
                                            label={data.eligibilityRules?.weightRanges?.length || 0}
                                            size="small"
                                            sx={{ fontSize: '10px', height: '18px' }}
                                            color="default"
                                        />
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <WeightRangeComponent
                                        weightRanges={data.eligibilityRules?.weightRanges || []}
                                        onUpdate={handleWeightRangesUpdate}
                                        errors={errors}
                                    />
                                </AccordionDetails>
                            </Accordion>
                        </Grid>

                        {/* Dimension Restrictions */}
                        <Grid item xs={12}>
                            <Accordion>
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    sx={{ bgcolor: '#f8fafc' }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography sx={{ fontSize: '13px', fontWeight: 500 }}>
                                            Maximum Dimension Restrictions
                                        </Typography>
                                        <Chip
                                            label={data.eligibilityRules?.dimensionRestrictions?.length || 0}
                                            size="small"
                                            sx={{ fontSize: '10px', height: '18px' }}
                                            color="default"
                                        />
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <DimensionRestrictionsComponent
                                        dimensionRestrictions={data.eligibilityRules?.dimensionRestrictions || []}
                                        onUpdate={handleDimensionRestrictionsUpdate}
                                        errors={errors}
                                    />
                                </AccordionDetails>
                            </Accordion>
                        </Grid>

                        {/* Package Type Restrictions */}
                        <Grid item xs={12}>
                            <Accordion>
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    sx={{ bgcolor: '#f8fafc' }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Typography sx={{ fontSize: '13px', fontWeight: 500 }}>
                                            Package Type Restrictions
                                        </Typography>
                                        <Chip
                                            label={data.eligibilityRules?.packageTypeRestrictions?.length || 0}
                                            size="small"
                                            sx={{ fontSize: '10px', height: '18px' }}
                                            color="default"
                                        />
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails>
                                    <PackageTypeRestrictionsComponent
                                        packageTypeRestrictions={data.eligibilityRules?.packageTypeRestrictions || []}
                                        onUpdate={handlePackageTypeRestrictionsUpdate}
                                        errors={errors}
                                    />
                                </AccordionDetails>
                            </Accordion>
                        </Grid>
                    </Grid>
                </AccordionDetails>
            </Accordion>

            {/* Step Description */}
            <Box sx={{ mt: 4, p: 2, backgroundColor: '#f8fafc', borderRadius: 1, border: '1px solid #e5e7eb' }}>
                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                    <strong>Services & Eligibility:</strong> Define which services this carrier supports and configure
                    eligibility rules. Select all service types the carrier can handle from both courier
                    and freight categories. Eligibility rules help determine when this carrier should
                    be offered as an option for specific shipments based on weight, package dimensions, geography, and cross-border requirements.
                </Typography>
            </Box>
        </Box>
    );
};

export default ServicesEligibilityStep; 