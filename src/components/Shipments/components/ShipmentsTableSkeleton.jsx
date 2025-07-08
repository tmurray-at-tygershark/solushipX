import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Skeleton,
    Paper,
    Box
} from '@mui/material';

const ShipmentsTableSkeleton = ({ rows = 10 }) => {
    return (
        <Paper sx={{ bgcolor: 'transparent', boxShadow: 'none' }}>
            <TableContainer>
                <Table sx={{ minWidth: 1218 }}>
                    <TableHead>
                        <TableRow>
                            {/* Checkbox */}
                            <TableCell padding="checkbox" sx={{ width: 48, minWidth: 48, maxWidth: 48 }}>
                                <Skeleton variant="rectangular" width={20} height={20} />
                            </TableCell>
                            {/* Shipment ID */}
                            <TableCell sx={{ width: 120, minWidth: 120, maxWidth: 120 }}>
                                <Skeleton variant="text" width={100} height={20} />
                            </TableCell>
                            {/* Ship Date */}
                            <TableCell sx={{ width: 100, minWidth: 100, maxWidth: 100 }}>
                                <Skeleton variant="text" width={60} height={20} />
                            </TableCell>
                            {/* ETA */}
                            <TableCell sx={{ width: 100, minWidth: 100, maxWidth: 100 }}>
                                <Skeleton variant="text" width={60} height={20} />
                            </TableCell>
                            {/* Reference */}
                            <TableCell sx={{ width: 130, minWidth: 130, maxWidth: 130 }}>
                                <Skeleton variant="text" width={80} height={20} />
                            </TableCell>
                            {/* Customer */}
                            <TableCell sx={{ width: 150, minWidth: 150, maxWidth: 150 }}>
                                <Skeleton variant="text" width={100} height={20} />
                            </TableCell>
                            {/* Route */}
                            <TableCell sx={{ width: 160, minWidth: 160, maxWidth: 160 }}>
                                <Skeleton variant="text" width={120} height={20} />
                            </TableCell>
                            {/* Carrier */}
                            <TableCell sx={{ width: 170, minWidth: 170, maxWidth: 170 }}>
                                <Skeleton variant="text" width={140} height={20} />
                            </TableCell>
                            {/* Status */}
                            <TableCell sx={{ width: 130, minWidth: 130, maxWidth: 130 }}>
                                <Skeleton variant="rectangular" width={70} height={24} sx={{ borderRadius: 1 }} />
                            </TableCell>
                            {/* Expand */}
                            <TableCell sx={{ width: 40, minWidth: 40, maxWidth: 40 }}>
                                <Skeleton variant="circular" width={16} height={16} />
                            </TableCell>
                            {/* Actions */}
                            <TableCell sx={{ width: 60, minWidth: 60, maxWidth: 60 }}>
                                <Skeleton variant="circular" width={24} height={24} />
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {[...Array(rows)].map((_, index) => (
                            <TableRow key={index} hover>
                                {/* Checkbox */}
                                <TableCell padding="checkbox" sx={{ width: 48, minWidth: 48, maxWidth: 48 }}>
                                    <Skeleton variant="rectangular" width={20} height={20} />
                                </TableCell>
                                {/* Shipment ID */}
                                <TableCell sx={{ width: 120, minWidth: 120, maxWidth: 120 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Skeleton variant="text" width={80} height={16} />
                                        <Skeleton variant="circular" width={16} height={16} />
                                    </Box>
                                </TableCell>
                                {/* Ship Date */}
                                <TableCell sx={{ width: 100, minWidth: 100, maxWidth: 100 }}>
                                    <Skeleton variant="text" width={50} height={14} />
                                </TableCell>
                                {/* ETA */}
                                <TableCell sx={{ width: 100, minWidth: 100, maxWidth: 100 }}>
                                    <Skeleton variant="text" width={50} height={14} />
                                </TableCell>
                                {/* Reference */}
                                <TableCell sx={{ width: 130, minWidth: 130, maxWidth: 130 }}>
                                    <Skeleton variant="text" width={Math.random() * 60 + 40} height={16} />
                                </TableCell>
                                {/* Customer */}
                                <TableCell sx={{ width: 150, minWidth: 150, maxWidth: 150 }}>
                                    <Skeleton variant="text" width={Math.random() * 80 + 60} height={16} />
                                </TableCell>
                                {/* Route */}
                                <TableCell sx={{ width: 160, minWidth: 160, maxWidth: 160 }}>
                                    <Box>
                                        <Skeleton variant="text" width={100} height={14} />
                                        <Skeleton variant="text" width={80} height={12} />
                                    </Box>
                                </TableCell>
                                {/* Carrier */}
                                <TableCell sx={{ width: 170, minWidth: 170, maxWidth: 170 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Skeleton variant="rectangular" width={24} height={24} sx={{ borderRadius: 0.5 }} />
                                        <Box sx={{ flex: 1 }}>
                                            <Skeleton variant="text" width={120} height={14} />
                                            <Skeleton variant="text" width={80} height={12} />
                                        </Box>
                                    </Box>
                                </TableCell>
                                {/* Status */}
                                <TableCell sx={{ width: 130, minWidth: 130, maxWidth: 130 }}>
                                    <Skeleton variant="rectangular" width={70} height={24} sx={{ borderRadius: 1 }} />
                                </TableCell>
                                {/* Expand */}
                                <TableCell sx={{ width: 40, minWidth: 40, maxWidth: 40 }}>
                                    <Skeleton variant="circular" width={16} height={16} />
                                </TableCell>
                                {/* Actions */}
                                <TableCell sx={{ width: 60, minWidth: 60, maxWidth: 60 }}>
                                    <Skeleton variant="circular" width={24} height={24} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Paper>
    );
};

export default ShipmentsTableSkeleton;

