import React from 'react';
import {
    TableRow,
    TableCell,
    Checkbox,
    Box,
    Typography,
    IconButton,
    CircularProgress,
    Chip,
    Tooltip
} from '@mui/material';
import {
    MoreVert as MoreVertIcon,
    ContentCopy as ContentCopyIcon,
    QrCode as QrCodeIcon,
    KeyboardArrowDown as ArrowDownIcon,
    Edit as EditIcon
} from '@mui/icons-material';
import { Link } from 'react-router-dom';
import StatusChip from '../../StatusChip/StatusChip';
import { formatDateTime, formatRoute, capitalizeShipmentType } from '../utils/shipmentHelpers';

const ShipmentTableRow = ({
    shipment,
    selected,
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
    visibleColumns = {},
    columnConfig = {},
    adminViewMode
}) => {
    const isSelected = selected.indexOf(shipment.id) !== -1;

    // Check if we're in admin view mode
    const isAdminView = adminViewMode === 'all' || adminViewMode === 'single';

    // Calculate charges for admin view
    const getCharges = () => {
        // Use the new dual rate storage system if available
        if (shipment.actualRates && shipment.markupRates) {
            return {
                cost: parseFloat(shipment.actualRates.totalCharges) || 0,
                companyCharge: parseFloat(shipment.markupRates.totalCharges) || 0,
                currency: shipment.actualRates.currency || shipment.markupRates.currency || 'USD'
            };
        }

        // Fallback to legacy approach for older shipments
        let cost = 0;

        // Check various places where the cost might be stored
        if (shipment.totalCost) {
            cost = shipment.totalCost;
        } else if (shipment.cost) {
            cost = shipment.cost;
        } else if (shipment.selectedRate?.totalCharges) {
            cost = shipment.selectedRate.totalCharges;
        } else if (shipment.selectedRate?.price) {
            cost = shipment.selectedRate.price;
        } else if (shipment.selectedRateRef?.totalCharges) {
            cost = shipment.selectedRateRef.totalCharges;
        } else if (shipment.selectedRateRef?.price) {
            cost = shipment.selectedRateRef.price;
        } else if (shipment.totalCharges) {
            cost = shipment.totalCharges;
        }

        // For legacy shipments without markup data, show the same value for both
        const companyCharge = cost;

        return {
            cost: parseFloat(cost) || 0,
            companyCharge: parseFloat(companyCharge) || 0,
            currency: shipment.currency || shipment.selectedRate?.currency || 'USD'
        };
    };

    // Get tracking number
    const getTrackingNumber = () => {
        // For draft shipments, there won't be tracking numbers yet
        if (shipment.status === 'draft') {
            return '';
        }

        const trackingNumber = shipment.trackingNumber ||
            shipment.carrierTrackingNumber || // Check top-level carrierTrackingNumber for QuickShip
            shipment.shipmentInfo?.carrierTrackingNumber || // Check inside shipmentInfo for QuickShip
            shipment.selectedRate?.trackingNumber ||
            shipment.selectedRate?.TrackingNumber ||
            shipment.selectedRateRef?.trackingNumber ||
            shipment.selectedRateRef?.TrackingNumber ||
            shipment.carrierTrackingData?.trackingNumber ||
            shipment.carrierBookingConfirmation?.trackingNumber ||
            shipment.carrierBookingConfirmation?.proNumber ||
            shipment.carrierBookingConfirmation?.confirmationNumber ||
            shipment.bookingReferenceNumber ||
            shipment.selectedRate?.BookingReferenceNumber ||
            shipment.selectedRate?.bookingReferenceNumber ||
            shipment.selectedRateRef?.BookingReferenceNumber ||
            shipment.selectedRateRef?.bookingReferenceNumber ||
            shipment.carrierTrackingData?.bookingReferenceNumber ||
            shipment.carrierBookingConfirmation?.bookingReference ||
            '';

        return trackingNumber;
    };

    // Get carrier name with eShipPlus detection
    const getCarrierDisplay = () => {
        // For draft shipments, especially advanced drafts, carrier data may not exist yet
        if (shipment.status === 'draft') {
            // Check if there's a selected rate with carrier info
            const selectedRateCarrier = shipment.selectedRate?.carrier ||
                shipment.selectedRateRef?.carrier;

            if (selectedRateCarrier) {
                // Handle both string carrier names and carrier objects
                const carrierName = typeof selectedRateCarrier === 'object' && selectedRateCarrier?.name
                    ? selectedRateCarrier.name
                    : selectedRateCarrier;

                return {
                    name: carrierName,
                    isEShipPlus: shipment.selectedRate?.displayCarrierId === 'ESHIPPLUS' ||
                        shipment.selectedRateRef?.displayCarrierId === 'ESHIPPLUS'
                };
            }

            // For drafts without rate selection, return pending status
            return {
                name: 'Pending Rate Selection',
                isEShipPlus: false
            };
        }

        // Extract carrier name with proper object handling
        let carrierName = carrierData[shipment.id]?.carrier ||
            shipment.selectedRateRef?.carrier ||
            shipment.selectedRate?.carrier ||
            shipment.carrier || 'N/A';

        // Handle carrier objects (extract the name property)
        if (typeof carrierName === 'object' && carrierName?.name) {
            carrierName = carrierName.name;
        }

        // For QuickShip drafts, respect the manually selected carrier
        // and don't apply eShip Plus logic unless explicitly detected
        if (shipment.creationMethod === 'quickship') {
            // Only check for explicit eShip Plus indicators for QuickShip drafts
            const isExplicitEShipPlus =
                shipment.selectedRate?.displayCarrierId === 'ESHIPPLUS' ||
                shipment.selectedRateRef?.displayCarrierId === 'ESHIPPLUS' ||
                shipment.selectedRate?.sourceCarrierName === 'eShipPlus' ||
                shipment.selectedRateRef?.sourceCarrierName === 'eShipPlus' ||
                carrierData[shipment.id]?.displayCarrierId === 'ESHIPPLUS' ||
                carrierData[shipment.id]?.sourceCarrierName === 'eShipPlus';

            return {
                name: isExplicitEShipPlus && carrierName !== 'N/A' ?
                    `${carrierName} via Eship Plus` :
                    carrierName,
                isEShipPlus: isExplicitEShipPlus
            };
        }

        // For non-QuickShip shipments, use the enhanced eShipPlus detection
        const isEShipPlus =
            shipment.selectedRate?.displayCarrierId === 'ESHIPPLUS' ||
            shipment.selectedRateRef?.displayCarrierId === 'ESHIPPLUS' ||
            shipment.selectedRate?.sourceCarrierName === 'eShipPlus' ||
            shipment.selectedRateRef?.sourceCarrierName === 'eShipPlus' ||
            carrierData[shipment.id]?.displayCarrierId === 'ESHIPPLUS' ||
            carrierData[shipment.id]?.sourceCarrierName === 'eShipPlus' ||
            (carrierName && carrierName !== 'N/A' && typeof carrierName === 'string' && (
                carrierName.toLowerCase().includes('ward trucking') ||
                carrierName.toLowerCase().includes('fedex freight') ||
                carrierName.toLowerCase().includes('road runner') ||
                carrierName.toLowerCase().includes('estes') ||
                carrierName.toLowerCase().includes('yrc') ||
                carrierName.toLowerCase().includes('xpo') ||
                carrierName.toLowerCase().includes('old dominion') ||
                carrierName.toLowerCase().includes('saia') ||
                carrierName.toLowerCase().includes('averitt') ||
                carrierName.toLowerCase().includes('southeastern freight')
            ));

        return {
            name: isEShipPlus && carrierName !== 'N/A' ?
                `${carrierName} via Eship Plus` :
                carrierName,
            isEShipPlus
        };
    };

    const trackingNumber = getTrackingNumber();
    const carrierDisplay = getCarrierDisplay();

    // Helper function to get column width from config
    const getColumnWidth = (columnKey) => {
        const config = columnConfig[columnKey];
        return config ? {
            width: config.width,
            minWidth: config.width,
            maxWidth: config.width
        } : {};
    };

    const handleRowClick = (event) => {
        // Prevent clicking on checkboxes, buttons, or action areas
        if (
            event.target.closest('.MuiCheckbox-root') ||
            event.target.closest('.MuiIconButton-root') ||
            event.target.closest('.MuiButton-root') ||
            event.target.closest('[data-no-click]')
        ) {
            return;
        }

        // Check if it's a draft shipment
        if (shipment.status === 'draft') {
            // For drafts, call the edit handler instead of view detail
            onEditDraftShipment(shipment.id);
        } else {
            // For non-drafts, open the shipment detail view
            onViewShipmentDetail(shipment.id);
        }
    };

    return (
        <TableRow
            hover
            onClick={handleRowClick}
            role="checkbox"
            aria-checked={isSelected}
            tabIndex={-1}
            selected={isSelected}
            sx={{
                cursor: 'pointer',
                '&:hover': {
                    backgroundColor: '#f8fafc'
                }
            }}
        >
            {/* Checkbox */}
            {visibleColumns.checkbox !== false && (
                <TableCell padding="checkbox" sx={{
                    verticalAlign: 'top',
                    textAlign: 'left',
                    ...getColumnWidth('checkbox'),
                    p: '8px 4px'
                }}>
                    <Checkbox
                        checked={isSelected}
                        onChange={() => onSelect(shipment.id)}
                        size="small"
                        sx={{ p: 0.5 }}
                    />
                </TableCell>
            )}

            {/* Shipment ID */}
            {visibleColumns.id !== false && (
                <TableCell sx={{
                    verticalAlign: 'top',
                    textAlign: 'left',
                    fontSize: '11px',
                    ...getColumnWidth('id'),
                    padding: '8px 12px',
                    wordBreak: 'break-word',
                    lineHeight: 1.3
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {shipment.status === 'draft' ? (
                            onEditDraftShipment ? (
                                <span
                                    onClick={() => onEditDraftShipment(shipment.id)}
                                    className="shipment-link"
                                    style={{ cursor: 'pointer', fontSize: '11px' }}
                                >
                                    <span>{highlightSearchTerm(
                                        shipment.shipmentID || shipment.id,
                                        searchFields.shipmentId
                                    )}</span>
                                </span>
                            ) : (
                                <span className="shipment-link" style={{ fontSize: '11px', color: '#64748b' }}>
                                    <span>{highlightSearchTerm(
                                        shipment.shipmentID || shipment.id,
                                        searchFields.shipmentId
                                    )}</span>
                                </span>
                            )
                        ) : (
                            <span
                                onClick={() => onViewShipmentDetail && onViewShipmentDetail(shipment.shipmentID || shipment.id)}
                                className="shipment-link"
                                style={{ cursor: 'pointer', fontSize: '11px' }}
                            >
                                <span>{highlightSearchTerm(
                                    shipment.shipmentID || shipment.id,
                                    searchFields.shipmentId
                                )}</span>
                            </span>
                        )}
                        <IconButton
                            size="small"
                            onClick={() => {
                                navigator.clipboard.writeText(shipment.shipmentID || shipment.id);
                                showSnackbar('Shipment ID copied!', 'success');
                            }}
                            sx={{ padding: '2px' }}
                            title="Copy shipment ID"
                        >
                            <ContentCopyIcon sx={{ fontSize: '0.75rem', color: '#64748b' }} />
                        </IconButton>
                    </Box>
                </TableCell>
            )}

            {/* Created Date */}
            {visibleColumns.created !== false && (
                <TableCell sx={{
                    verticalAlign: 'top',
                    textAlign: 'left',
                    ...getColumnWidth('created'),
                    padding: '8px 12px'
                }}>
                    {(() => {
                        let dateTime = null;
                        let createdDate = null;

                        // Priority order for created date - different for QuickShip vs regular shipments
                        if (shipment.creationMethod === 'quickship') {
                            // For QuickShip: bookingTimestamp (primary) > bookedAt > createdAt (fallback)
                            if (shipment.bookingTimestamp) {
                                createdDate = shipment.bookingTimestamp;
                            } else if (shipment.bookedAt) {
                                createdDate = shipment.bookedAt;
                            } else if (shipment.createdAt) {
                                createdDate = shipment.createdAt;
                            }
                        } else {
                            // For regular shipments: createdAt (primary) > bookingTimestamp (fallback)
                            if (shipment.createdAt) {
                                createdDate = shipment.createdAt;
                            } else if (shipment.bookingTimestamp) {
                                createdDate = shipment.bookingTimestamp;
                            }
                        }

                        if (createdDate) {
                            dateTime = formatDateTime(createdDate);
                        }

                        // If formatDateTime returns null (invalid timestamp) or no dateTime, show N/A
                        if (!dateTime || !dateTime.date || !dateTime.time) {
                            return (
                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#64748b' }}>
                                    N/A
                                </Typography>
                            );
                        }

                        return (
                            <Box>
                                <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                    {dateTime.date}
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: '11px', color: '#64748b' }}>
                                    {dateTime.time}
                                </Typography>
                            </Box>
                        );
                    })()}
                </TableCell>
            )}

            {/* Ship Date */}
            {visibleColumns.date !== false && (
                <TableCell sx={{
                    verticalAlign: 'top',
                    textAlign: 'left',
                    ...getColumnWidth('date'),
                    padding: '8px 12px'
                }}>
                    {(() => {
                        let dateTime = null;
                        let dateToFormat = null;

                        // Priority order for date fields: shipment date (preferred) > bookedAt (QuickShip) > createdAt (fallback)
                        if (shipment.shipmentInfo?.shipmentDate) {
                            // Preferred ship date from shipment info
                            dateToFormat = shipment.shipmentInfo.shipmentDate;
                        } else if (shipment.shipmentDate) {
                            // Direct shipment date field
                            dateToFormat = shipment.shipmentDate;
                        } else if (shipment.scheduledDate) {
                            // Scheduled date field
                            dateToFormat = shipment.scheduledDate;
                        } else if (shipment.creationMethod === 'quickship' && shipment.bookedAt) {
                            // For QuickShip records, use bookedAt when shipmentDate is not available
                            dateToFormat = shipment.bookedAt;
                        } else if (shipment.createdAt) {
                            // Final fallback to creation date
                            dateToFormat = shipment.createdAt;
                        }

                        if (dateToFormat) {
                            dateTime = formatDateTime(dateToFormat);
                        }

                        // If formatDateTime returns null (invalid timestamp) or no dateTime, show N/A
                        if (!dateTime || !dateTime.date || !dateTime.time) {
                            return (
                                <Typography variant="body2" sx={{ fontSize: '12px', color: '#64748b' }}>
                                    N/A
                                </Typography>
                            );
                        }

                        return (
                            <Box>
                                <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                    {dateTime.date}
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: '11px', color: '#64748b' }}>
                                    {dateTime.time}
                                </Typography>
                            </Box>
                        );
                    })()}
                </TableCell>
            )}

            {/* Reference */}
            {visibleColumns.reference !== false && (
                <TableCell sx={{
                    verticalAlign: 'top',
                    textAlign: 'left',
                    ...getColumnWidth('reference'),
                    padding: '8px 12px',
                    wordBreak: 'break-word',
                    lineHeight: 1.3
                }}>
                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                        {highlightSearchTerm(
                            shipment.shipmentInfo?.shipperReferenceNumber ||
                            shipment.referenceNumber ||
                            shipment.shipperReferenceNumber ||
                            shipment.selectedRate?.referenceNumber ||
                            shipment.selectedRateRef?.referenceNumber ||
                            '',
                            searchFields.referenceNumber
                        ) || 'N/A'}
                    </Typography>
                </TableCell>
            )}

            {/* Customer */}
            {visibleColumns.customer !== false && (
                <TableCell sx={{
                    verticalAlign: 'top',
                    textAlign: 'left',
                    ...getColumnWidth('customer'),
                    padding: '8px 12px',
                    wordBreak: 'break-word',
                    lineHeight: 1.3
                }}>
                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                        {highlightSearchTerm(
                            shipment.shipTo?.companyName ||
                            shipment.shipTo?.company ||
                            customers[shipment.shipTo?.customerID] ||
                            'N/A',
                            searchFields.customerName
                        )}
                    </Typography>
                </TableCell>
            )}

            {/* Route - Vertical Layout */}
            {visibleColumns.route !== false && (
                <TableCell sx={{
                    verticalAlign: 'top',
                    textAlign: 'left',
                    ...getColumnWidth('route'),
                    padding: '8px 12px'
                }}>
                    {(() => {
                        const route = formatRoute(
                            shipment.shipFrom || shipment.shipfrom,
                            shipment.shipTo || shipment.shipto,
                            searchFields.origin,
                            searchFields.destination
                        );

                        return (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, fontSize: '12px' }}>
                                {/* Origin */}
                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <span>{route.origin.flag}</span>
                                        <Box sx={{ wordBreak: 'break-word', lineHeight: 1.2 }}>
                                            {highlightSearchTerm(route.origin.text, searchFields.origin)}
                                        </Box>
                                    </Box>
                                    {route.origin.postalCode && (
                                        <Box sx={{ pl: 3, fontSize: '11px', color: '#64748b' }}>
                                            {highlightSearchTerm(route.origin.postalCode, searchFields.origin)}
                                        </Box>
                                    )}
                                </Box>

                                {/* Down Arrow */}
                                <Box sx={{
                                    display: 'flex',
                                    justifyContent: 'center',
                                    color: '#64748b',
                                    fontSize: '14px'
                                }}>
                                    ↓
                                </Box>

                                {/* Destination */}
                                <Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        <span>{route.destination.flag}</span>
                                        <Box sx={{ wordBreak: 'break-word', lineHeight: 1.2 }}>
                                            {highlightSearchTerm(route.destination.text, searchFields.destination)}
                                        </Box>
                                    </Box>
                                    {route.destination.postalCode && (
                                        <Box sx={{ pl: 3, fontSize: '11px', color: '#64748b' }}>
                                            {highlightSearchTerm(route.destination.postalCode, searchFields.destination)}
                                        </Box>
                                    )}
                                </Box>
                            </Box>
                        );
                    })()}
                </TableCell>
            )}

            {/* Carrier */}
            {visibleColumns.carrier !== false && (
                <TableCell sx={{
                    verticalAlign: 'top',
                    textAlign: 'left',
                    ...getColumnWidth('carrier'),
                    padding: '8px 12px'
                }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {/* Carrier Name */}
                        <Typography variant="body2" sx={{
                            fontSize: '12px',
                            wordBreak: 'break-word',
                            lineHeight: 1.3
                        }}>
                            {carrierDisplay.name}
                        </Typography>

                        {/* Tracking Number */}
                        {trackingNumber && (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <QrCodeIcon sx={{ fontSize: '12px', color: '#64748b' }} />
                                <Typography
                                    onClick={() => onOpenTrackingDrawer(trackingNumber)}
                                    sx={{
                                        color: '#2563eb',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        wordBreak: 'break-all',
                                        lineHeight: 1.2,
                                        '&:hover': {
                                            textDecoration: 'underline'
                                        }
                                    }}
                                    title="Click to track this shipment"
                                >
                                    {trackingNumber}
                                </Typography>
                                <IconButton
                                    size="small"
                                    onClick={() => {
                                        navigator.clipboard.writeText(trackingNumber);
                                        showSnackbar('Tracking/PRO/Confirmation number copied!', 'success');
                                    }}
                                    sx={{ padding: '2px' }}
                                    title="Copy tracking/confirmation number"
                                >
                                    <ContentCopyIcon sx={{ fontSize: '0.875rem', color: '#64748b' }} />
                                </IconButton>
                            </Box>
                        )}

                        {/* Service Level */}
                        {carrierData[shipment.id]?.service && (
                            <Typography variant="body2" sx={{
                                fontSize: '12px',
                                color: '#64748b',
                                wordBreak: 'break-word',
                                lineHeight: 1.2
                            }}>
                                {carrierData[shipment.id]?.service}
                            </Typography>
                        )}
                    </Box>
                </TableCell>
            )}

            {/* Type - Narrower column */}
            {visibleColumns.type !== false && (
                <TableCell sx={{
                    verticalAlign: 'top',
                    textAlign: 'left',
                    ...getColumnWidth('type'),
                    padding: '8px 12px',
                    wordBreak: 'break-word',
                    lineHeight: 1.3,
                    fontSize: '11px'
                }}>
                    {capitalizeShipmentType(shipment.shipmentInfo?.shipmentType)}
                </TableCell>
            )}

            {/* Charges - Admin View Only */}
            {isAdminView && (
                <TableCell sx={{
                    verticalAlign: 'top',
                    textAlign: 'left',
                    ...getColumnWidth('charges'),
                    padding: '8px 12px'
                }}>
                    {(() => {
                        const charges = getCharges();
                        const formatCurrency = (amount, currency) => {
                            return new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: currency
                            }).format(amount);
                        };

                        return (
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                <Typography variant="body2" sx={{ fontSize: '11px', color: '#374151' }}>
                                    <span style={{ fontWeight: 500 }}>Cost:</span> {formatCurrency(charges.cost, charges.currency)}
                                </Typography>
                                <Typography variant="body2" sx={{ fontSize: '11px', color: '#059669' }}>
                                    <span style={{ fontWeight: 500 }}>Charge:</span> {formatCurrency(charges.companyCharge, charges.currency)}
                                </Typography>
                            </Box>
                        );
                    })()}
                </TableCell>
            )}

            {/* Status - Narrower column */}
            {visibleColumns.status !== false && (
                <TableCell sx={{
                    verticalAlign: 'top',
                    textAlign: 'left',
                    ...getColumnWidth('status'),
                    padding: '8px 12px'
                }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        <StatusChip status={shipment.status} size="small" />
                        {/* Manual Override Indicator */}
                        {shipment.statusOverride?.isManual && (
                            <Tooltip title="Status manually overridden">
                                <Chip
                                    icon={<EditIcon sx={{ fontSize: '10px !important' }} />}
                                    label="Manual"
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                        height: '16px',
                                        fontSize: '9px',
                                        color: 'orange',
                                        borderColor: 'orange',
                                        '& .MuiChip-icon': {
                                            fontSize: '10px',
                                            color: 'orange'
                                        },
                                        '& .MuiChip-label': {
                                            px: 0.5
                                        }
                                    }}
                                />
                            </Tooltip>
                        )}
                    </Box>
                </TableCell>
            )}

            {/* Actions */}
            {visibleColumns.actions !== false && (
                <TableCell sx={{
                    verticalAlign: 'top',
                    textAlign: 'right',
                    ...getColumnWidth('actions'),
                    padding: '8px 12px'
                }} align="right">
                    <IconButton
                        onClick={(e) => onActionMenuOpen(e, shipment)}
                        size="small"
                    >
                        <MoreVertIcon />
                    </IconButton>
                </TableCell>
            )}
        </TableRow>
    );
};

export default ShipmentTableRow; 