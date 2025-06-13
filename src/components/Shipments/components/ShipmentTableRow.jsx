import React from 'react';
import {
    TableRow,
    TableCell,
    Checkbox,
    Box,
    Typography,
    IconButton,
    CircularProgress
} from '@mui/material';
import {
    MoreVert as MoreVertIcon,
    ContentCopy as ContentCopyIcon,
    QrCode as QrCodeIcon,
    KeyboardArrowDown as ArrowDownIcon
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
    carrierData,
    searchFields,
    highlightSearchTerm,
    showSnackbar,
    onOpenTrackingDrawer,
    onViewShipmentDetail,
    visibleColumns = {},
    columnConfig = {}
}) => {
    const isSelected = selected.indexOf(shipment.id) !== -1;

    // Get tracking number
    const getTrackingNumber = () => {
        return shipment.trackingNumber ||
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
    };

    // Get carrier name with eShipPlus detection
    const getCarrierDisplay = () => {
        const carrierName = carrierData[shipment.id]?.carrier ||
            shipment.selectedRateRef?.carrier ||
            shipment.selectedRate?.carrier ||
            shipment.carrier || 'N/A';

        // Enhanced eShipPlus detection
        const isEShipPlus =
            shipment.selectedRate?.displayCarrierId === 'ESHIPPLUS' ||
            shipment.selectedRateRef?.displayCarrierId === 'ESHIPPLUS' ||
            shipment.selectedRate?.sourceCarrierName === 'eShipPlus' ||
            shipment.selectedRateRef?.sourceCarrierName === 'eShipPlus' ||
            carrierData[shipment.id]?.displayCarrierId === 'ESHIPPLUS' ||
            carrierData[shipment.id]?.sourceCarrierName === 'eShipPlus' ||
            (carrierName && (
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
            )) ||
            (shipment.shipmentInfo?.shipmentType?.toLowerCase().includes('freight') ||
                shipment.shipmentType?.toLowerCase().includes('freight'));

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

    return (
        <TableRow
            hover
            selected={isSelected}
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
                            <Link
                                to={`/create-shipment/shipment-info/${shipment.id}`}
                                className="shipment-link"
                                style={{ fontSize: '11px' }}
                            >
                                <span>{highlightSearchTerm(
                                    shipment.shipmentID || shipment.id,
                                    searchFields.shipmentId
                                )}</span>
                            </Link>
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

            {/* Date */}
            {visibleColumns.date !== false && (
                <TableCell sx={{
                    verticalAlign: 'top',
                    textAlign: 'left',
                    ...getColumnWidth('date'),
                    padding: '8px 12px'
                }}>
                    {(() => {
                        const dateTime = shipment.createdAt?.toDate
                            ? formatDateTime(shipment.createdAt)
                            : shipment.date
                                ? formatDateTime(shipment.date)
                                : null;

                        if (!dateTime) return 'N/A';

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
                    {shipment.shipTo?.customerID
                        ? customers[shipment.shipTo.customerID] || shipment.shipTo?.company || 'N/A'
                        : shipment.shipTo?.company || 'N/A'}
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
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <span>{route.origin.flag}</span>
                                    <Box sx={{ wordBreak: 'break-word', lineHeight: 1.2 }}>
                                        {highlightSearchTerm(route.origin.text, searchFields.origin)}
                                    </Box>
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
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <span>{route.destination.flag}</span>
                                    <Box sx={{ wordBreak: 'break-word', lineHeight: 1.2 }}>
                                        {highlightSearchTerm(route.destination.text, searchFields.destination)}
                                    </Box>
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

                        {/* Reference Number */}
                        {shipment.referenceNumber && (
                            <Typography variant="body2" sx={{
                                fontSize: '12px',
                                color: '#64748b',
                                wordBreak: 'break-word',
                                lineHeight: 1.2
                            }}>
                                Ref: {shipment.referenceNumber}
                            </Typography>
                        )}

                        {/* Service Level */}
                        {carrierData[shipment.id]?.service && (
                            <Typography variant="body2" sx={{
                                fontSize: '12px',
                                color: '#64748b',
                                wordBreak: 'break-word',
                                lineHeight: 1.2
                            }}>
                                {carrierData[shipment.id].service}
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

            {/* Status - Narrower column */}
            {visibleColumns.status !== false && (
                <TableCell sx={{
                    verticalAlign: 'top',
                    textAlign: 'left',
                    ...getColumnWidth('status'),
                    padding: '8px 12px'
                }}>
                    <StatusChip status={shipment.status} size="small" />
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