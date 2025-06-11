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
    QrCode as QrCodeIcon
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
    showSnackbar
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

    return (
        <TableRow
            hover
            selected={isSelected}
        >
            <TableCell padding="checkbox" sx={{ verticalAlign: 'top', textAlign: 'left', width: 36, p: 0.25 }}>
                <Checkbox
                    checked={isSelected}
                    onChange={() => onSelect(shipment.id)}
                    size="small"
                    sx={{ p: 0.5 }}
                />
            </TableCell>

            {/* Shipment ID */}
            <TableCell sx={{ verticalAlign: 'top', textAlign: 'left', fontSize: '14px' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {shipment.status === 'draft' ? (
                        <Link
                            to={`/create-shipment/shipment-info/${shipment.id}`}
                            className="shipment-link"
                        >
                            <span>{highlightSearchTerm(
                                shipment.shipmentID || shipment.id,
                                searchFields.shipmentId
                            )}</span>
                        </Link>
                    ) : (
                        <Link
                            to={`/shipment/${shipment.shipmentID || shipment.id}`}
                            className="shipment-link"
                        >
                            <span>{highlightSearchTerm(
                                shipment.shipmentID || shipment.id,
                                searchFields.shipmentId
                            )}</span>
                        </Link>
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
                        <ContentCopyIcon sx={{ fontSize: '0.875rem', color: '#64748b' }} />
                    </IconButton>
                </Box>
            </TableCell>

            {/* Date */}
            <TableCell sx={{ verticalAlign: 'top', textAlign: 'left' }}>
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

            {/* Customer */}
            <TableCell sx={{ verticalAlign: 'top', textAlign: 'left' }}>
                {shipment.shipTo?.customerID
                    ? customers[shipment.shipTo.customerID] || shipment.shipTo?.company || 'N/A'
                    : shipment.shipTo?.company || 'N/A'}
            </TableCell>

            {/* Route */}
            <TableCell sx={{ verticalAlign: 'top', textAlign: 'left' }}>
                {(() => {
                    const route = formatRoute(
                        shipment.shipFrom || shipment.shipfrom,
                        shipment.shipTo || shipment.shipto,
                        searchFields.origin,
                        searchFields.destination
                    );

                    return (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '12px' }}>
                            <span>{route.origin.flag}</span>
                            {highlightSearchTerm(route.origin.text, searchFields.origin)}
                            <span>→</span>
                            <span>{route.destination.flag}</span>
                            {highlightSearchTerm(route.destination.text, searchFields.destination)}
                        </Box>
                    );
                })()}
            </TableCell>

            {/* Carrier */}
            <TableCell sx={{ verticalAlign: 'top', textAlign: 'left' }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {/* Carrier Name */}
                    <Typography variant="body2" sx={{ fontSize: '12px' }}>
                        {carrierDisplay.name}
                    </Typography>

                    {/* Tracking Number */}
                    {trackingNumber && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <QrCodeIcon sx={{ fontSize: '12px', color: '#64748b' }} />
                            <Link
                                to={`/tracking/${trackingNumber}`}
                                style={{
                                    textDecoration: 'none',
                                    color: '#2563eb',
                                    fontSize: '12px'
                                }}
                                onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                                onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                                title="Click to track this shipment"
                            >
                                {trackingNumber}
                            </Link>
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
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#64748b' }}>
                            Ref: {shipment.referenceNumber}
                        </Typography>
                    )}

                    {/* Service Level */}
                    {carrierData[shipment.id]?.service && (
                        <Typography variant="body2" sx={{ fontSize: '12px', color: '#64748b' }}>
                            {carrierData[shipment.id].service}
                        </Typography>
                    )}
                </Box>
            </TableCell>

            {/* Type */}
            <TableCell sx={{ verticalAlign: 'top', textAlign: 'left' }}>
                {capitalizeShipmentType(shipment.shipmentInfo?.shipmentType)}
            </TableCell>

            {/* Status */}
            <TableCell sx={{ verticalAlign: 'top', textAlign: 'left' }}>
                <StatusChip status={shipment.status} />
            </TableCell>

            {/* Actions */}
            <TableCell sx={{ verticalAlign: 'top', textAlign: 'left' }} align="right">
                <IconButton
                    onClick={(e) => onActionMenuOpen(e, shipment)}
                    size="small"
                >
                    <MoreVertIcon />
                </IconButton>
            </TableCell>
        </TableRow>
    );
};

export default ShipmentTableRow; 