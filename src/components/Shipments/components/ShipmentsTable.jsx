import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Checkbox,
    CircularProgress,
    Box
} from '@mui/material';
import ShipmentTableRow from './ShipmentTableRow';

const ShipmentsTable = ({
    loading,
    shipments,
    selected,
    onSelectAll,
    onSelect,
    onActionMenuOpen,
    customers,
    carrierData,
    searchFields,
    highlightSearchTerm,
    showSnackbar,
    onOpenTrackingDrawer,
    onViewShipmentDetail
}) => {
    const isAllSelected = shipments.length > 0 && selected.length === shipments.length;
    const isIndeterminate = selected.length > 0 && selected.length < shipments.length;

    return (
        <TableContainer>
            <Table sx={{
                '& .MuiTableCell-root': { fontSize: '12px' },
                '& .MuiTypography-root': { fontSize: '12px' },
                '& .shipment-link': { fontSize: '12px' },
            }}>
                <TableHead>
                    <TableRow>
                        <TableCell padding="checkbox" sx={{ width: 36, p: 0.25 }}>
                            <Checkbox
                                indeterminate={isIndeterminate}
                                checked={isAllSelected}
                                onChange={onSelectAll}
                                size="small"
                                sx={{ p: 0.5 }}
                            />
                        </TableCell>
                        <TableCell>ID</TableCell>
                        <TableCell>DATE</TableCell>
                        <TableCell>CUSTOMER</TableCell>
                        <TableCell>ROUTE</TableCell>
                        <TableCell sx={{ minWidth: 120 }}>CARRIER</TableCell>
                        <TableCell>TYPE</TableCell>
                        <TableCell>STATUS</TableCell>
                        <TableCell align="right"></TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={9} align="center">
                                <CircularProgress />
                            </TableCell>
                        </TableRow>
                    ) : shipments.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={9} align="center">
                                No shipments found
                            </TableCell>
                        </TableRow>
                    ) : (
                        shipments.map((shipment) => (
                            <ShipmentTableRow
                                key={shipment.id}
                                shipment={shipment}
                                selected={selected}
                                onSelect={onSelect}
                                onActionMenuOpen={onActionMenuOpen}
                                customers={customers}
                                carrierData={carrierData}
                                searchFields={searchFields}
                                highlightSearchTerm={highlightSearchTerm}
                                showSnackbar={showSnackbar}
                                onOpenTrackingDrawer={onOpenTrackingDrawer}
                                onViewShipmentDetail={onViewShipmentDetail}
                            />
                        ))
                    )}
                </TableBody>
            </Table>
        </TableContainer>
    );
};

export default ShipmentsTable;
