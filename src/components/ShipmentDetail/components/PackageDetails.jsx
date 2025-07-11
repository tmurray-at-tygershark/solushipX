import React, { useState, useMemo, useCallback } from 'react';
import {
    Grid,
    Paper,
    Typography,
    Box,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Chip,
    Tooltip
} from '@mui/material';
import {
    Inventory as InventoryIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon
} from '@mui/icons-material';

const PackageDetails = ({ packages = [] }) => {
    const [showAllPackages, setShowAllPackages] = useState(false);

    // Memoized package processing for performance
    const processedPackages = useMemo(() => {
        if (!Array.isArray(packages)) return [];

        return packages.map((pkg, index) => ({
            id: pkg.id || index,
            index: index + 1,
            description: pkg.description || pkg.itemDescription || 'N/A',
            quantity: pkg.quantity || pkg.packagingQuantity || 1,
            weight: pkg.weight || 0,
            dimensions: pkg.dimensions ?
                `${pkg.dimensions.length || 0}" × ${pkg.dimensions.width || 0}" × ${pkg.dimensions.height || 0}"` :
                (pkg.length && pkg.width && pkg.height ?
                    `${pkg.length}" × ${pkg.width}" × ${pkg.height}"` : 'N/A'),
            freightClass: pkg.freightClass || null,
            value: pkg.value || pkg.declaredValue || 0,
            declaredValueCurrency: pkg.declaredValueCurrency || 'CAD',
            packagingType: pkg.packagingType || null
        }));
    }, [packages]);

    // Display logic
    const displayedPackages = showAllPackages ? processedPackages : processedPackages.slice(0, 10);
    const hasMorePackages = processedPackages.length > 10;

    // Toggle handler
    const handleToggleShowAll = useCallback(() => {
        setShowAllPackages(prev => !prev);
    }, []);

    // Format quantity display
    const formatQuantity = useCallback((quantity) => {
        const qty = parseInt(quantity) || 1;
        return `${qty} ${qty > 1 ? 'pcs' : 'pc'}`;
    }, []);

    // Format weight display
    const formatWeight = useCallback((weight) => {
        const weightNum = parseFloat(weight) || 0;
        return weightNum > 0 ? `${weightNum} lbs` : 'N/A';
    }, []);

    // Format value display with currency
    const formatValue = useCallback((value, currency = 'CAD') => {
        const valueNum = parseFloat(value) || 0;
        if (valueNum <= 0) return 'N/A';

        return `$${valueNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
    }, []);

    // Get freight class chip color
    const getFreightClassColor = useCallback((freightClass) => {
        if (!freightClass) return 'default';
        const classNum = parseInt(freightClass);
        if (classNum >= 500) return 'error';
        if (classNum >= 300) return 'warning';
        if (classNum >= 150) return 'info';
        return 'success';
    }, []);

    // Calculate totals - FIXED: Multiply weight by quantity for accurate total weight
    const totals = useMemo(() => {
        return processedPackages.reduce((acc, pkg) => ({
            totalQuantity: acc.totalQuantity + (parseInt(pkg.quantity) || 0),
            totalWeight: acc.totalWeight + ((parseFloat(pkg.weight) || 0) * (parseInt(pkg.quantity) || 1)), // FIXED: Weight × Quantity
            totalValue: acc.totalValue + (parseFloat(pkg.value) || 0)
        }), { totalQuantity: 0, totalWeight: 0, totalValue: 0 });
    }, [processedPackages]);

    if (processedPackages.length === 0) {
        return (
            <Grid item xs={12}>
                <Paper sx={{ mb: 1 }}>
                    <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <InventoryIcon sx={{ color: '#666', fontSize: '20px' }} />
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                Packages
                            </Typography>
                        </Box>
                    </Box>
                    <Box sx={{ p: 3, textAlign: 'center' }}>
                        <Typography sx={{ fontSize: '12px', color: 'text.secondary' }}>
                            No packages found
                        </Typography>
                    </Box>
                </Paper>
            </Grid>
        );
    }

    return (
        <Grid item xs={12}>
            <Paper sx={{ mb: 1 }}>
                {/* Header */}
                <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <InventoryIcon sx={{ color: '#666', fontSize: '20px' }} />
                            <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                                Packages ({processedPackages.length})
                            </Typography>
                        </Box>
                        {/* Summary chips */}
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                            <Chip
                                label={`${totals.totalQuantity} items`}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '11px', height: '24px' }}
                            />
                            <Chip
                                label={`${totals.totalWeight.toFixed(1)} lbs`}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '11px', height: '24px' }}
                            />
                            <Chip
                                label={totals.totalValue > 0 ? formatValue(totals.totalValue, 'CAD') : 'N/A'}
                                size="small"
                                variant="outlined"
                                sx={{ fontSize: '11px', height: '24px' }}
                            />
                        </Box>
                    </Box>
                </Box>

                {/* Table Content */}
                <Box sx={{ p: 0 }}>
                    <TableContainer>
                        <Table size="small" sx={{ minWidth: 650 }}>
                            <TableHead>
                                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', py: 1.5, color: '#374151' }}>#</TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', py: 1.5, color: '#374151' }}>Description</TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', py: 1.5, color: '#374151', textAlign: 'center' }}>Qty</TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', py: 1.5, color: '#374151', textAlign: 'right' }}>Weight</TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', py: 1.5, color: '#374151', textAlign: 'center' }}>Dimensions</TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', py: 1.5, color: '#374151', textAlign: 'center' }}>Class</TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', py: 1.5, color: '#374151', textAlign: 'right' }}>Declared Value</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {displayedPackages.map((pkg) => (
                                    <TableRow
                                        key={pkg.id}
                                        sx={{
                                            '&:nth-of-type(odd)': { bgcolor: '#fafafa' },
                                            '&:hover': { bgcolor: '#f5f5f5' },
                                            transition: 'background-color 0.2s'
                                        }}
                                    >
                                        <TableCell sx={{ fontSize: '12px', py: 1.5, fontWeight: 500 }}>
                                            {pkg.index}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px', py: 1.5, maxWidth: '200px' }}>
                                            <Tooltip title={pkg.description} placement="top">
                                                <Typography
                                                    sx={{
                                                        fontSize: '12px',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap'
                                                    }}
                                                >
                                                    {pkg.description}
                                                </Typography>
                                            </Tooltip>
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px', py: 1.5, textAlign: 'center', fontWeight: 500 }}>
                                            {formatQuantity(pkg.quantity)}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px', py: 1.5, textAlign: 'right', fontWeight: 500 }}>
                                            {formatWeight(pkg.weight)}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px', py: 1.5, textAlign: 'center' }}>
                                            <Typography sx={{ fontSize: '12px', fontFamily: 'monospace' }}>
                                                {pkg.dimensions}
                                            </Typography>
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px', py: 1.5, textAlign: 'center' }}>
                                            {pkg.freightClass ? (
                                                <Chip
                                                    label={pkg.freightClass}
                                                    size="small"
                                                    color={getFreightClassColor(pkg.freightClass)}
                                                    sx={{ fontSize: '10px', height: '20px', minWidth: '40px' }}
                                                />
                                            ) : (
                                                <Typography sx={{ fontSize: '12px', color: 'text.secondary' }}>
                                                    N/A
                                                </Typography>
                                            )}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px', py: 1.5, textAlign: 'right', fontWeight: 500 }}>
                                            {formatValue(pkg.value, pkg.declaredValueCurrency)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>

                    {/* Show More/Less Button */}
                    {hasMorePackages && (
                        <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', borderTop: '1px solid #e0e0e0' }}>
                            <Button
                                onClick={handleToggleShowAll}
                                startIcon={showAllPackages ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                sx={{
                                    color: '#666',
                                    fontSize: '12px',
                                    textTransform: 'none',
                                    '&:hover': {
                                        bgcolor: 'rgba(0, 0, 0, 0.04)',
                                        color: '#000'
                                    }
                                }}
                            >
                                {showAllPackages
                                    ? 'Show Less'
                                    : `Show ${processedPackages.length - 10} More Packages`
                                }
                            </Button>
                        </Box>
                    )}
                </Box>
            </Paper>
        </Grid>
    );
};

export default PackageDetails; 