import React from 'react';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Checkbox,
    CircularProgress,
    Box
} from '@mui/material';
import ShipmentTableRow from './ShipmentTableRow';

const ShipmentsTable = ({
    loading,
    shipments = [],
    selected = [],
    onSelectAll,
    onSelect,
    onActionMenuOpen,
    customers,
    carrierData,
    searchFields,
    highlightSearchTerm,
    showSnackbar,
    onOpenTrackingDrawer,
    onViewShipmentDetail,
    onEditDraftShipment
}) => {
    const safeShipments = shipments || [];
    const safeSelected = selected || [];

    const isAllSelected = safeShipments.length > 0 && safeSelected.length === safeShipments.length;
    const isIndeterminate = safeSelected.length > 0 && safeSelected.length < safeShipments.length;

    // Column configuration to match header widths
    const columnConfig = {
        checkbox: { width: 48 },
        id: { width: 160 },
        date: { width: 100 },
        reference: { width: 120 },
        customer: { width: 140 },
        route: { width: 150 },
        carrier: { width: 220 },
        type: { width: 70 },
        status: { width: 110 },
        actions: { width: 60 }
    };

    return (
        <Box sx={{
            width: '100%',
            px: 2
        }}>
            <Table sx={{
                width: '100%',
                minWidth: 1178,
                tableLayout: 'fixed',
                '& .MuiTableCell-root': {
                    fontSize: '12px',
                    padding: '8px 12px',
                    borderBottom: '1px solid #e2e8f0'
                },
                '& .MuiTypography-root': { fontSize: '12px' },
                '& .shipment-link': { fontSize: '11px' },
                '& .MuiChip-root': {
                    fontSize: '11px !important'
                },
                '& .MuiChip-label': {
                    fontSize: '11px !important'
                }
            }}>
                <TableHead sx={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 100,
                    // Ensure solid background to cover scrolled content
                    '& .MuiTableRow-root': {
                        backgroundColor: '#f8fafc !important'
                    },
                    '& .MuiTableCell-root': {
                        backgroundColor: '#f8fafc !important',
                        borderBottom: '2px solid #e2e8f0 !important'
                    }
                }}>
                    <TableRow sx={{
                        backgroundColor: '#f8fafc !important',
                        height: '32px',
                        '& .MuiTableCell-root': {
                            padding: '2px 12px',
                            height: '32px',
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#374151',
                            backgroundColor: '#f8fafc !important'
                        }
                    }}>
                        <TableCell
                            padding="checkbox"
                            sx={{
                                width: 48,
                                minWidth: 48,
                                maxWidth: 48,
                                p: '2px 4px',
                                textAlign: 'center',
                                height: '32px',
                                backgroundColor: '#f8fafc !important'
                            }}
                        >
                            <Checkbox
                                indeterminate={isIndeterminate}
                                checked={isAllSelected}
                                onChange={onSelectAll}
                                size="small"
                                sx={{ p: 0.25 }}
                            />
                        </TableCell>
                        <TableCell sx={{
                            width: 160,
                            minWidth: 160,
                            maxWidth: 160,
                            backgroundColor: '#f8fafc !important'
                        }}>
                            ID
                        </TableCell>
                        <TableCell sx={{
                            width: 100,
                            minWidth: 100,
                            maxWidth: 100,
                            backgroundColor: '#f8fafc !important'
                        }}>
                            DATE
                        </TableCell>
                        <TableCell sx={{
                            width: 120,
                            minWidth: 120,
                            maxWidth: 120,
                            backgroundColor: '#f8fafc !important'
                        }}>
                            REFERENCE
                        </TableCell>
                        <TableCell sx={{
                            width: 140,
                            minWidth: 140,
                            maxWidth: 140,
                            backgroundColor: '#f8fafc !important'
                        }}>
                            CUSTOMER
                        </TableCell>
                        <TableCell sx={{
                            width: 150,
                            minWidth: 150,
                            maxWidth: 150,
                            backgroundColor: '#f8fafc !important'
                        }}>
                            ROUTE
                        </TableCell>
                        <TableCell sx={{
                            width: 220,
                            minWidth: 220,
                            maxWidth: 220,
                            backgroundColor: '#f8fafc !important'
                        }}>
                            CARRIER
                        </TableCell>
                        <TableCell sx={{
                            width: 70,
                            minWidth: 70,
                            maxWidth: 70,
                            backgroundColor: '#f8fafc !important'
                        }}>
                            TYPE
                        </TableCell>
                        <TableCell sx={{
                            width: 110,
                            minWidth: 110,
                            maxWidth: 110,
                            backgroundColor: '#f8fafc !important'
                        }}>
                            STATUS
                        </TableCell>
                        <TableCell
                            align="right"
                            sx={{
                                width: 60,
                                minWidth: 60,
                                maxWidth: 60,
                                backgroundColor: '#f8fafc !important'
                            }}
                        >
                            {/* Actions column header - empty */}
                        </TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={10} align="center" sx={{ py: 4 }}>
                                <CircularProgress />
                            </TableCell>
                        </TableRow>
                    ) : safeShipments.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={10} align="center" sx={{ py: 4, color: '#6b7280' }}>
                                No shipments found
                            </TableCell>
                        </TableRow>
                    ) : (
                        safeShipments.map((shipment) => (
                            <ShipmentTableRow
                                key={shipment.id}
                                shipment={shipment}
                                selected={safeSelected}
                                onSelect={onSelect}
                                onActionMenuOpen={onActionMenuOpen}
                                customers={customers}
                                carrierData={carrierData}
                                searchFields={searchFields}
                                highlightSearchTerm={highlightSearchTerm}
                                showSnackbar={showSnackbar}
                                onOpenTrackingDrawer={onOpenTrackingDrawer}
                                onViewShipmentDetail={onViewShipmentDetail}
                                onEditDraftShipment={onEditDraftShipment}
                                columnConfig={columnConfig}
                            />
                        ))
                    )}
                </TableBody>
            </Table>
        </Box>
    );
};

export default ShipmentsTable;
