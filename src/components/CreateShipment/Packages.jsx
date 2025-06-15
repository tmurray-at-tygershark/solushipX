import React, { useState, useEffect } from 'react';
import { Switch, Paper, Typography, Box, Grid, TextField, Select, MenuItem, InputLabel, FormControl, Button, Divider, Tooltip, IconButton, InputAdornment, FormControlLabel, FormHelperText, Container } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon, Info as InfoIcon, ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { useShipmentForm } from '../../contexts/ShipmentFormContext';

// Comprehensive Freight Class Data
const FREIGHT_CLASSES = [
    {
        class: "50",
        description: "Clean Freight",
        examples: ["Bricks", "Sand", "Nuts & Bolts"],
        weight_range_per_cubic_foot: "50 lbs and above",
        min_weight: 50,
        max_weight: Infinity
    },
    {
        class: "55",
        description: "Bricks, cement, mortar, hardwood flooring",
        examples: ["Bricks", "Cement", "Mortar", "Hardwood Flooring"],
        weight_range_per_cubic_foot: "35-50 lbs",
        min_weight: 35,
        max_weight: 50
    },
    {
        class: "60",
        description: "Car accessories & car parts",
        examples: ["Car Accessories", "Car Parts"],
        weight_range_per_cubic_foot: "30-35 lbs",
        min_weight: 30,
        max_weight: 35
    },
    {
        class: "65",
        description: "Car accessories & car parts, bottled beverages, books in boxes",
        examples: ["Car Accessories", "Car Parts", "Bottled Beverages", "Books in Boxes"],
        weight_range_per_cubic_foot: "22.5-30 lbs",
        min_weight: 22.5,
        max_weight: 30
    },
    {
        class: "70",
        description: "Car accessories & car parts, food items, automobile engines",
        examples: ["Car Accessories", "Car Parts", "Food Items", "Automobile Engines"],
        weight_range_per_cubic_foot: "15-22.5 lbs",
        min_weight: 15,
        max_weight: 22.5
    },
    {
        class: "77.5",
        description: "Tires, bathroom fixtures",
        examples: ["Tires", "Bathroom Fixtures"],
        weight_range_per_cubic_foot: "13.5-15 lbs",
        min_weight: 13.5,
        max_weight: 15
    },
    {
        class: "85",
        description: "Crated machinery, cast iron stoves",
        examples: ["Crated Machinery", "Cast Iron Stoves"],
        weight_range_per_cubic_foot: "12-13.5 lbs",
        min_weight: 12,
        max_weight: 13.5
    },
    {
        class: "92.5",
        description: "Computers, monitors, refrigerators",
        examples: ["Computers", "Monitors", "Refrigerators"],
        weight_range_per_cubic_foot: "10.5-12 lbs",
        min_weight: 10.5,
        max_weight: 12
    },
    {
        class: "100",
        description: "Boat covers, car covers, canvas, wine cases, caskets",
        examples: ["Boat Covers", "Car Covers", "Canvas", "Wine Cases", "Caskets"],
        weight_range_per_cubic_foot: "9-10.5 lbs",
        min_weight: 9,
        max_weight: 10.5
    },
    {
        class: "110",
        description: "Cabinets, framed artwork, table saw",
        examples: ["Cabinets", "Framed Artwork", "Table Saw"],
        weight_range_per_cubic_foot: "8-9 lbs",
        min_weight: 8,
        max_weight: 9
    },
    {
        class: "125",
        description: "Small household appliances",
        examples: ["Small Household Appliances"],
        weight_range_per_cubic_foot: "7-8 lbs",
        min_weight: 7,
        max_weight: 8
    },
    {
        class: "150",
        description: "Auto sheet metal parts, bookcases",
        examples: ["Auto Sheet Metal Parts", "Bookcases"],
        weight_range_per_cubic_foot: "6-7 lbs",
        min_weight: 6,
        max_weight: 7
    },
    {
        class: "175",
        description: "Clothing, couches, stuffed furniture",
        examples: ["Clothing", "Couches", "Stuffed Furniture"],
        weight_range_per_cubic_foot: "5-6 lbs",
        min_weight: 5,
        max_weight: 6
    },
    {
        class: "200",
        description: "Auto sheet metal parts, aircraft parts, aluminum table, packaged mattresses",
        examples: ["Auto Sheet Metal Parts", "Aircraft Parts", "Aluminum Table", "Packaged Mattresses"],
        weight_range_per_cubic_foot: "4-5 lbs",
        min_weight: 4,
        max_weight: 5
    },
    {
        class: "250",
        description: "Bamboo furniture, mattress and box spring, plasma TV",
        examples: ["Bamboo Furniture", "Mattress and Box Spring", "Plasma TV"],
        weight_range_per_cubic_foot: "3-4 lbs",
        min_weight: 3,
        max_weight: 4
    },
    {
        class: "300",
        description: "Wood cabinets, tables, chairs setup, model boats",
        examples: ["Wood Cabinets", "Tables", "Chairs Setup", "Model Boats"],
        weight_range_per_cubic_foot: "2-3 lbs",
        min_weight: 2,
        max_weight: 3
    },
    {
        class: "400",
        description: "Deer antlers",
        examples: ["Deer Antlers"],
        weight_range_per_cubic_foot: "1-2 lbs",
        min_weight: 1,
        max_weight: 2
    },
    {
        class: "500",
        description: "Low Density or High Value",
        examples: ["Bags of Gold Dust", "Ping Pong Balls"],
        weight_range_per_cubic_foot: "Less than 1 lb",
        min_weight: 0,
        max_weight: 1
    }
];

// Removed freight class validation helper functions - users can now select any freight class without restrictions

const Packages = ({ onNext, onPrevious }) => {
    const { formData, updateFormSection } = useShipmentForm();

    const defaultPackage = {
        id: Date.now().toString(),
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
        currency: 'USD'
    };

    const [packages, setPackages] = useState(formData.packages?.length ? formData.packages : [defaultPackage]);
    const [unitSystem, setUnitSystem] = useState('imperial');
    const [currencies] = useState([
        { code: 'USD', symbol: '$', name: 'US Dollar' },
        { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' }
    ]);
    // Removed freightClassErrors state - freight class selection is now purely user choice without validation

    useEffect(() => {
        // Enhanced package initialization logic for draft data
        const contextPackages = formData.packages;
        const shipmentType = formData.shipmentInfo?.shipmentType;

        console.log("Packages: Context packages changed:", contextPackages);

        if (Array.isArray(contextPackages) && contextPackages.length > 0) {
            // Process existing packages to ensure they have all required fields
            const processedPackages = contextPackages.map((pkg, index) => ({
                id: pkg.id || `${Date.now()}-${index}`,
                itemDescription: pkg.itemDescription || '',
                packagingType: pkg.packagingType || (shipmentType === 'freight' ? 258 : 260),
                packagingQuantity: pkg.packagingQuantity || 1,
                packageReferenceID: pkg.packageReferenceID || '',
                stackable: pkg.stackable !== undefined ? pkg.stackable : (shipmentType === 'freight' ? true : false),
                weight: pkg.weight || '',
                height: pkg.height || '',
                width: pkg.width || '',
                length: pkg.length || '',
                freightClass: pkg.freightClass || (shipmentType === 'freight' ? "50" : "50"),
                declaredValue: pkg.declaredValue || 0.00,
                currency: pkg.currency || 'USD'
            }));

            console.log("Packages: Setting processed packages:", processedPackages);
            setPackages(processedPackages);
        } else {
            // No packages in context or empty array - use default with appropriate values for shipment type
            const defaultWithShipmentType = {
                ...defaultPackage,
                packagingType: shipmentType === 'freight' ? 258 : 260,
                stackable: shipmentType === 'freight' ? true : false,
                freightClass: "50" // Use 50 as default for all shipment types
            };
            console.log("Packages: No packages in context, using default package with shipment type defaults");
            setPackages([defaultWithShipmentType]);
        }
    }, [formData.packages, formData.shipmentInfo?.shipmentType]);

    const updateContext = (newPackages) => {
        updateFormSection('packages', newPackages);
    };

    const lbsToKg = (lbs) => (lbs * 0.453592).toFixed(2);
    const kgToLbs = (kg) => (kg * 2.20462).toFixed(2);
    const inchesToCm = (inches) => (inches * 2.54).toFixed(1);
    const cmToInches = (cm) => (cm / 2.54).toFixed(1);

    const handleUnitChange = (event) => {
        const newUnitSystem = event.target.checked ? 'metric' : 'imperial';
        if (newUnitSystem !== unitSystem) {
            const updatedPackages = packages.map(pkg => {
                const updatedPkg = { ...pkg };
                if (pkg.weight) {
                    if (unitSystem === 'imperial' && newUnitSystem === 'metric') {
                        updatedPkg.weight = lbsToKg(pkg.weight);
                    } else if (unitSystem === 'metric' && newUnitSystem === 'imperial') {
                        updatedPkg.weight = kgToLbs(pkg.weight);
                    }
                }
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
            updateContext(updatedPackages);
            setUnitSystem(newUnitSystem);
        }
    };

    const addPackage = () => {
        const shipmentType = formData.shipmentInfo?.shipmentType;
        const newPackage = {
            ...defaultPackage,
            id: Date.now().toString(),
            // Set appropriate defaults based on shipment type
            packagingType: shipmentType === 'freight' ? 258 : 260, // Default to Box for courier, Pallet for freight
            stackable: shipmentType === 'freight' ? true : false,   // Default to false for courier
            freightClass: "50" // Use 50 as default for all shipment types
        };
        const newPackages = [...packages, newPackage];
        setPackages(newPackages);
        updateContext(newPackages);
    };

    const removePackage = (index) => {
        const newPackages = packages.filter((_, i) => i !== index);
        if (newPackages.length === 0) {
            const firstPackage = { ...defaultPackage, id: Date.now().toString() };
            setPackages([firstPackage]);
            updateContext([firstPackage]);
        } else {
            setPackages(newPackages);
            updateContext(newPackages);
        }
    };

    const updatePackage = (index, field, value) => {
        const updatedPackages = packages.map((pkg, i) => {
            if (i === index) {
                return { ...pkg, [field]: value };
            }
            return pkg;
        });
        setPackages(updatedPackages);
        updateContext(updatedPackages);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const currentPackages = formData.packages || [];
        const shipmentType = formData.shipmentInfo?.shipmentType;

        const hasEmptyFields = currentPackages.some(pkg => {
            // Basic required fields for all shipment types
            const basicFieldsInvalid =
                !pkg.itemDescription || String(pkg.itemDescription).trim() === '' ||
                !pkg.packagingQuantity || String(pkg.packagingQuantity).trim() === '' || isNaN(parseInt(pkg.packagingQuantity)) || parseInt(pkg.packagingQuantity) < 1 ||
                !pkg.weight || String(pkg.weight).trim() === '' || isNaN(parseFloat(pkg.weight)) || parseFloat(pkg.weight) <= 0 ||
                !pkg.height || String(pkg.height).trim() === '' || isNaN(parseFloat(pkg.height)) || parseFloat(pkg.height) <= 0 ||
                !pkg.width || String(pkg.width).trim() === '' || isNaN(parseFloat(pkg.width)) || parseFloat(pkg.width) <= 0 ||
                !pkg.length || String(pkg.length).trim() === '' || isNaN(parseFloat(pkg.length)) || parseFloat(pkg.length) <= 0;

            // Packaging type is only required for freight shipments
            const packagingTypeInvalid = shipmentType === 'freight' && !pkg.packagingType;

            // Freight class is only required for freight shipments
            const freightClassInvalid = shipmentType === 'freight' && !pkg.freightClass;

            return basicFieldsInvalid || packagingTypeInvalid || freightClassInvalid;
        });

        if (hasEmptyFields) {
            const requiredFieldsMessage = shipmentType === 'freight'
                ? 'Please fill in all required fields for each package (Description, Type, Qty > 0, Weight > 0, Dimensions > 0, Freight Class).'
                : 'Please fill in all required fields for each package (Description, Qty > 0, Weight > 0, Dimensions > 0).';
            alert(requiredFieldsMessage);
            console.warn("Packages handleSubmit: Validation failed due to empty/invalid required fields.", currentPackages);
            return;
        }

        console.log("Packages handleSubmit: Validation passed. Calling onNext with data from context:", currentPackages);
        onNext(currentPackages);
    };

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
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
                        key={pkg.id || index}
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

                            {/* Packaging Type - Only show for freight shipments */}
                            {formData.shipmentInfo?.shipmentType === 'freight' && (
                                <Grid item xs={12} md={4}>
                                    <FormControl fullWidth required>
                                        <InputLabel>Packaging Type</InputLabel>
                                        <Select
                                            value={pkg.packagingType || ''}
                                            onChange={(e) => updatePackage(index, 'packagingType', e.target.value)}
                                            label="Packaging Type"
                                        >
                                            <MenuItem value={237}>10KG BOX</MenuItem>
                                            <MenuItem value={238}>25KG BOX</MenuItem>
                                            <MenuItem value={239}>ENVELOPE</MenuItem>
                                            <MenuItem value={240}>TUBE (PACKAGE)</MenuItem>
                                            <MenuItem value={241}>PAK (PACKAGE)</MenuItem>
                                            <MenuItem value={242}>BAGS</MenuItem>
                                            <MenuItem value={243}>BALE(S)</MenuItem>
                                            <MenuItem value={244}>BOX(ES)</MenuItem>
                                            <MenuItem value={245}>BUNCH(ES)</MenuItem>
                                            <MenuItem value={246}>BUNDLE(S)</MenuItem>
                                            <MenuItem value={248}>CARBOY(S)</MenuItem>
                                            <MenuItem value={249}>CARPET(S)</MenuItem>
                                            <MenuItem value={250}>CARTONS</MenuItem>
                                            <MenuItem value={251}>CASE(S)</MenuItem>
                                            <MenuItem value={252}>COIL(S)</MenuItem>
                                            <MenuItem value={253}>CRATE(S)</MenuItem>
                                            <MenuItem value={254}>CYLINDER(S)</MenuItem>
                                            <MenuItem value={255}>DRUM(S)</MenuItem>
                                            <MenuItem value={256}>LOOSE</MenuItem>
                                            <MenuItem value={257}>PAIL(S)</MenuItem>
                                            <MenuItem value={258}>PALLET(S)</MenuItem>
                                            <MenuItem value={260}>REELS(S)</MenuItem>
                                            <MenuItem value={261}>ROLL(S)</MenuItem>
                                            <MenuItem value={262}>SKID(S)</MenuItem>
                                            <MenuItem value={265}>TOTE(S)</MenuItem>
                                            <MenuItem value={266}>TUBES/PIPES</MenuItem>
                                            <MenuItem value={268}>GALLONS</MenuItem>
                                            <MenuItem value={269}>LIQUID BULK</MenuItem>
                                            <MenuItem value={270}>CONTAINER</MenuItem>
                                            <MenuItem value={271}>PIECES</MenuItem>
                                            <MenuItem value={272}>LOAD</MenuItem>
                                            <MenuItem value={273}>BLADE(S)</MenuItem>
                                            <MenuItem value={274}>RACKS</MenuItem>
                                            <MenuItem value={275}>GAYLORDS</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                            )}

                            <Grid item xs={12} md={formData.shipmentInfo?.shipmentType === 'freight' ? 3 : 7}>
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

                            {/* Freight Class - Only show for freight shipments */}
                            {formData.shipmentInfo?.shipmentType === 'freight' && (
                                <Grid item xs={12}>
                                    <FormControl fullWidth required>
                                        <InputLabel>Freight Class</InputLabel>
                                        <Select
                                            value={pkg.freightClass || ''}
                                            onChange={(e) => updatePackage(index, 'freightClass', e.target.value)}
                                            label="Freight Class"
                                            renderValue={(value) => {
                                                const classData = FREIGHT_CLASSES.find(fc => fc.class === value);
                                                return classData ? `Class ${value} - ${classData.description}` : `Class ${value}`;
                                            }}
                                        >
                                            {FREIGHT_CLASSES.map((fc) => (
                                                <MenuItem key={fc.class} value={fc.class}>
                                                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                                                        Class {fc.class} - {fc.description}
                                                    </Typography>
                                                </MenuItem>
                                            ))}
                                        </Select>
                                        <FormHelperText sx={{ mt: 1 }}>
                                            Select the appropriate freight class for your shipment
                                        </FormHelperText>
                                    </FormControl>
                                </Grid>
                            )}

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

                            {/* Stackable - Only show for freight shipments */}
                            {formData.shipmentInfo?.shipmentType === 'freight' && (
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
                            )}
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
                        sx={{
                            px: 6,
                            py: 1.5,
                            backgroundColor: '#10B981',
                            minWidth: '160px',
                            '&:hover': {
                                backgroundColor: '#059669'
                            }
                        }}
                        endIcon={<ArrowForwardIcon />}
                    >
                        Next
                    </Button>
                </Box>
            </Box>
        </Container>
    );
};

export default Packages;