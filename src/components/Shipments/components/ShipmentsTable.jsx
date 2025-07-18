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
import { useAuth } from '../../../contexts/AuthContext';
import { hasPermission, PERMISSIONS } from '../../../utils/rolePermissions';

const ShipmentsTable = ({
    loading,
    shipments = [],
    selected = [],
    onSelectAll,
    onSelect,
    onActionMenuOpen,
    customers,
    companyData,
    carrierData,
    searchFields,
    highlightSearchTerm,
    showSnackbar,
    onOpenTrackingDrawer,
    onViewShipmentDetail,
    onEditDraftShipment,
    adminViewMode
}) => {
    const safeShipments = shipments || [];
    const safeSelected = selected || [];

    // Get user role for permission checking
    const { userRole } = useAuth();

    const isAllSelected = safeShipments.length > 0 && safeSelected.length === safeShipments.length;
    const isIndeterminate = safeSelected.length > 0 && safeSelected.length < safeShipments.length;

    // Check if we're in admin view mode and if user can view costs
    const isAdminView = adminViewMode === 'all' || adminViewMode === 'single';
    const canViewCosts = hasPermission(userRole, PERMISSIONS.VIEW_SHIPMENT_COSTS);

    // Column configuration - different for admin vs regular view, and adjust for permissions
    const columnConfig = isAdminView ? {
        // Admin view: Company first, no Created column, plus expand column
        checkbox: { width: 48 },
        company: { width: 140 }, // First position for admin
        id: { width: 110 },
        date: { width: 100 },
        eta: { width: 100 },
        reference: { width: 120 },
        route: { width: 150 },
        carrier: canViewCosts ? { width: 180 } : { width: 230 }, // Wider carrier column if no charges column
        ...(canViewCosts && { charges: { width: 100 } }), // Only include charges column if user can view costs
        status: { width: 110 },
        expand: { width: 40 },
        actions: { width: 60 }
    } : {
        // Regular view: removed CREATED column, adjusted carrier/status widths for better readability
        checkbox: { width: 48 },
        id: { width: 120 },
        date: { width: 100 },
        eta: { width: 100 },
        reference: { width: 130 },
        customer: { width: 150 },
        route: { width: 160 },
        carrier: { width: 170 },
        status: { width: 130 },
        expand: { width: 40 },
        actions: { width: 60 }
    };

    // Calculate total width - adjust based on whether charges column is shown
    const totalWidth = isAdminView ? (canViewCosts ? 1298 : 1248) : 1218;

    return (
        <Box sx={{
            width: '100%',
            overflowX: 'auto',
            px: 2
        }}>
            <Table sx={{
                width: '100%',
                minWidth: totalWidth,
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

                        {/* Admin View Headers */}
                        {isAdminView ? (
                            <>
                                <TableCell sx={{
                                    width: 140,
                                    minWidth: 140,
                                    maxWidth: 140,
                                    backgroundColor: '#f8fafc !important'
                                }}>
                                    COMPANY
                                </TableCell>
                                <TableCell sx={{
                                    width: 110,
                                    minWidth: 110,
                                    maxWidth: 110,
                                    backgroundColor: '#f8fafc !important'
                                }}>
                                    SHIPMENT ID
                                </TableCell>
                                <TableCell sx={{
                                    width: 100,
                                    minWidth: 100,
                                    maxWidth: 100,
                                    backgroundColor: '#f8fafc !important'
                                }}>
                                    SHIP DATE
                                </TableCell>
                                <TableCell sx={{
                                    width: 100,
                                    minWidth: 100,
                                    maxWidth: 100,
                                    backgroundColor: '#f8fafc !important'
                                }}>
                                    ETA
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
                                    width: 150,
                                    minWidth: 150,
                                    maxWidth: 150,
                                    backgroundColor: '#f8fafc !important'
                                }}>
                                    ROUTE
                                </TableCell>
                                <TableCell sx={{
                                    width: canViewCosts ? 180 : 230,
                                    minWidth: canViewCosts ? 180 : 230,
                                    maxWidth: canViewCosts ? 180 : 230,
                                    backgroundColor: '#f8fafc !important'
                                }}>
                                    CARRIER
                                </TableCell>
                                {canViewCosts && (
                                    <TableCell sx={{
                                        width: 100,
                                        minWidth: 100,
                                        maxWidth: 100,
                                        backgroundColor: '#f8fafc !important'
                                    }}>
                                        CHARGES
                                    </TableCell>
                                )}
                                <TableCell sx={{
                                    width: 110,
                                    minWidth: 110,
                                    maxWidth: 110,
                                    backgroundColor: '#f8fafc !important'
                                }}>
                                    STATUS
                                </TableCell>
                                <TableCell
                                    align="center"
                                    sx={{
                                        width: 40,
                                        minWidth: 40,
                                        maxWidth: 40,
                                        backgroundColor: '#f8fafc !important'
                                    }}
                                >
                                    {/* Expand column header - empty */}
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
                            </>
                        ) : (
                            /* Regular View Headers */
                            <>
                                <TableCell sx={{
                                    width: 120,
                                    minWidth: 120,
                                    maxWidth: 120,
                                    backgroundColor: '#f8fafc !important'
                                }}>
                                    SHIPMENT ID
                                </TableCell>
                                <TableCell sx={{
                                    width: 100,
                                    minWidth: 100,
                                    maxWidth: 100,
                                    backgroundColor: '#f8fafc !important'
                                }}>
                                    SHIP DATE
                                </TableCell>
                                <TableCell sx={{
                                    width: 100,
                                    minWidth: 100,
                                    maxWidth: 100,
                                    backgroundColor: '#f8fafc !important'
                                }}>
                                    ETA
                                </TableCell>
                                <TableCell sx={{
                                    width: 130,
                                    minWidth: 130,
                                    maxWidth: 130,
                                    backgroundColor: '#f8fafc !important'
                                }}>
                                    REFERENCE
                                </TableCell>
                                <TableCell sx={{
                                    width: 150,
                                    minWidth: 150,
                                    maxWidth: 150,
                                    backgroundColor: '#f8fafc !important'
                                }}>
                                    CUSTOMER
                                </TableCell>
                                <TableCell sx={{
                                    width: 160,
                                    minWidth: 160,
                                    maxWidth: 160,
                                    backgroundColor: '#f8fafc !important'
                                }}>
                                    ROUTE
                                </TableCell>
                                <TableCell sx={{
                                    width: 170,
                                    minWidth: 170,
                                    maxWidth: 170,
                                    backgroundColor: '#f8fafc !important'
                                }}>
                                    CARRIER
                                </TableCell>
                                <TableCell sx={{
                                    width: 130,
                                    minWidth: 130,
                                    maxWidth: 130,
                                    backgroundColor: '#f8fafc !important'
                                }}>
                                    STATUS
                                </TableCell>
                                <TableCell
                                    align="center"
                                    sx={{
                                        width: 40,
                                        minWidth: 40,
                                        maxWidth: 40,
                                        backgroundColor: '#f8fafc !important'
                                    }}
                                >
                                    {/* Expand column header - empty */}
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
                            </>
                        )}
                    </TableRow>
                </TableHead>
                <TableBody>
                    {loading ? (
                        <TableRow>
                            <TableCell colSpan={isAdminView ? 12 : 10} align="center" sx={{ py: 4 }}>
                                <CircularProgress />
                            </TableCell>
                        </TableRow>
                    ) : safeShipments.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={isAdminView ? 12 : 10} align="center" sx={{ py: 4, color: '#6b7280' }}>
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
                                companyData={companyData}
                                carrierData={carrierData}
                                searchFields={searchFields}
                                highlightSearchTerm={highlightSearchTerm}
                                showSnackbar={showSnackbar}
                                onOpenTrackingDrawer={onOpenTrackingDrawer}
                                onViewShipmentDetail={onViewShipmentDetail}
                                onEditDraftShipment={onEditDraftShipment}
                                columnConfig={columnConfig}
                                adminViewMode={adminViewMode}
                            />
                        ))
                    )}
                </TableBody>
            </Table>
        </Box>
    );
};

export default ShipmentsTable;
