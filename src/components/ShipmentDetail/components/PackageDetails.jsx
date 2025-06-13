import React, { useState, useMemo } from 'react';
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
    TableRow
} from '@mui/material';

const PackageDetails = ({
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

    const displayedPackages = showAllPackages ? allPackages : allPackages.slice(0, 10);

    return (
        <Grid item xs={12}>
            <Paper sx={{ mb: 1 }}>
                <Box
                    sx={{
                        p: 2,
                        borderBottom: '1px solid #e0e0e0'
                    }}
                >
                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#000', fontSize: '16px' }}>
                        Packages
                    </Typography>
                </Box>
                <Box sx={{ p: 2 }}>
                    {allPackages.length === 0 ? (
                        <Typography sx={{ fontSize: '12px', textAlign: 'center', py: 2 }}>No packages found</Typography>
                    ) : (
                        <>
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', py: 1 }}>#</TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', py: 1 }}>Description</TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', py: 1 }}>Qty</TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', py: 1 }}>Weight</TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', py: 1 }}>Dimensions</TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', py: 1 }}>Class</TableCell>
                                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', py: 1 }}>Value</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {displayedPackages.map((pkg, index) => (
                                            <TableRow key={index} sx={{ '&:nth-of-type(odd)': { backgroundColor: '#f9f9f9' } }}>
                                                <TableCell sx={{ fontSize: '12px', py: 1 }}>{index + 1}</TableCell>
                                                <TableCell sx={{ fontSize: '12px', py: 1 }}>
                                                    {pkg.description || pkg.itemDescription || 'N/A'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', py: 1 }}>
                                                    {pkg.quantity || pkg.packagingQuantity || 1} {parseInt(pkg.quantity || pkg.packagingQuantity || 1) > 1 ? 'pcs' : 'pc'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', py: 1 }}>
                                                    {pkg.weight || 'N/A'} lbs
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', py: 1 }}>
                                                    {pkg.dimensions ?
                                                        `${pkg.dimensions.length || 0}" × ${pkg.dimensions.width || 0}" × ${pkg.dimensions.height || 0}"` :
                                                        (pkg.length && pkg.width && pkg.height ? `${pkg.length}" × ${pkg.width}" × ${pkg.height}"` : 'N/A')
                                                    }
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', py: 1 }}>
                                                    {pkg.freightClass || 'N/A'}
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px', py: 1 }}>
                                                    ${(pkg.value || pkg.declaredValue || 0).toFixed(2)}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            {allPackages.length > 10 && (
                                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                                    <Button
                                        onClick={() => setShowAllPackages(!showAllPackages)}
                                        sx={{ color: '#000', '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.04)' } }}
                                    >
                                        {showAllPackages ? 'Show Less' : `Show ${allPackages.length - 10} More Packages`}
                                    </Button>
                                </Box>
                            )}
                        </>
                    )}
                </Box>
            </Paper>
        </Grid>
    );
};

export default PackageDetails; 