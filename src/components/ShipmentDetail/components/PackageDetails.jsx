import React, { useState, useMemo } from 'react';
import {
    Grid,
    Paper,
    Typography,
    Box,
    IconButton,
    Collapse,
    Button
} from '@mui/material';
import {
    Inventory as BoxIcon,
    ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';

const PackageDetails = ({
    expanded = true,
    onToggle = () => { },
    packages = []
}) => {
    const [showAllPackages, setShowAllPackages] = useState(false);

    // Combine packages from main record and subcollection (if both exist)
    const allPackages = useMemo(() => {
        let pkgs = [];
        if (Array.isArray(packages)) pkgs = pkgs.concat(packages);
        // If subcollection packages are stored elsewhere, merge here as needed
        // (Assume shipment.packages already includes both if loaded)
        return pkgs;
    }, [packages]);

    const displayedPackages = showAllPackages ? allPackages : allPackages.slice(0, 3);

    return (
        <Grid item xs={12}>
            <Paper sx={{ mb: 3 }}>
                <Box
                    sx={{
                        p: 2,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid #e0e0e0'
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BoxIcon sx={{ color: '#000' }} />
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#000' }}>
                            Packages
                        </Typography>
                    </Box>
                    <IconButton onClick={onToggle}>
                        <ExpandMoreIcon
                            sx={{
                                transform: expanded ? 'rotate(180deg)' : 'none',
                                transition: 'transform 0.3s',
                                color: '#666'
                            }}
                        />
                    </IconButton>
                </Box>
                <Collapse in={expanded}>
                    <Box sx={{ p: 3 }}>
                        <Grid container spacing={2}>
                            {allPackages.length === 0 && (
                                <Grid item xs={12}>
                                    <Typography>No packages found</Typography>
                                </Grid>
                            )}
                            {displayedPackages.map((pkg, index) => (
                                <Grid item xs={12} sm={6} md={4} key={index}>
                                    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e0e0e0', bgcolor: 'background.default' }}>
                                        <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                                            Package {index + 1}
                                        </Typography>
                                        <Box sx={{ display: 'grid', gap: 1 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                    Description
                                                </Typography>
                                                <Typography variant="body1">{pkg.description || pkg.itemDescription || 'N/A'}</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                    Quantity
                                                </Typography>
                                                <Typography variant="body1">{pkg.quantity || pkg.packagingQuantity || 1} {parseInt(pkg.quantity || pkg.packagingQuantity || 1) > 1 ? 'pieces' : 'piece'}</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                    Weight
                                                </Typography>
                                                <Typography variant="body1">{pkg.weight || 'N/A'} lbs</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                    Dimensions
                                                </Typography>
                                                <Typography variant="body1">
                                                    {pkg.dimensions ?
                                                        `${pkg.dimensions.length || 0}" × ${pkg.dimensions.width || 0}" × ${pkg.dimensions.height || 0}"` :
                                                        (pkg.length && pkg.width && pkg.height ? `${pkg.length}" × ${pkg.width}" × ${pkg.height}"` : 'N/A')
                                                    }
                                                </Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                    Freight Class
                                                </Typography>
                                                <Typography variant="body1">{pkg.freightClass || 'N/A'}</Typography>
                                            </Box>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 500 }}>
                                                    Declared Value
                                                </Typography>
                                                <Typography variant="body1">${(pkg.value || pkg.declaredValue || 0).toFixed(2)}</Typography>
                                            </Box>
                                        </Box>
                                    </Paper>
                                </Grid>
                            ))}
                        </Grid>
                        {allPackages.length > 3 && (
                            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                                <Button
                                    onClick={() => setShowAllPackages(!showAllPackages)}
                                    sx={{ color: '#000', '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' } }}
                                >
                                    {showAllPackages ? 'Show Less' : `Show ${allPackages.length - 3} More Packages`}
                                </Button>
                            </Box>
                        )}
                    </Box>
                </Collapse>
            </Paper>
        </Grid>
    );
};

export default PackageDetails; 