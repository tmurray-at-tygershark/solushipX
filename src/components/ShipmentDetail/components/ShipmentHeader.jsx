import React from 'react';
import {
    Box,
    Typography,
    Button,
    Chip,
    CircularProgress,
    Breadcrumbs,
    Link
} from '@mui/material';
import {
    Print as PrintIcon,
    Description as DescriptionIcon,
    LocalShipping as LocalShippingIcon,
    ArrowBackIosNew as ArrowBackIosNewIcon,
    QrCode as QrCodeIcon,
    ContentCopy as ContentCopyIcon,
    NavigateNext as NavigateNextIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import StatusChip from '../../StatusChip/StatusChip';

const ShipmentHeader = ({
    shipment,
    actionStates,
    documentsLoading,
    documentsError,
    shipmentDocuments,
    isEShipPlusCarrier,
    onPrintLabel,
    onPrintBOL,
    onPrintConfirmation,
    onPrintShipment,
    fetchShipmentDocuments,
    onBackToTable,
    onCancelShipment,
    onShowSnackbar,
    onRefreshShipment,
    isAdmin = false
}) => {
    const navigate = useNavigate();
    const isFreightShipment = shipment?.shipmentInfo?.shipmentType?.toLowerCase() === 'freight';

    // Handle back button click
    const handleBackClick = () => {
        if (onBackToTable) {
            // Use sliding functionality when available (inside ShipmentsX)
            onBackToTable();
        } else {
            // Fall back to navigation when not in sliding view
            navigate('/shipments');
        }
    };

    // Check if shipment can be cancelled
    const canCancelShipment = () => {
        const currentStatus = shipment?.status?.toLowerCase();
        return currentStatus !== 'delivered' &&
            currentStatus !== 'in_transit' &&
            currentStatus !== 'in transit' &&
            currentStatus !== 'cancelled' &&
            currentStatus !== 'void' &&
            currentStatus !== 'draft';
    };

    // Common button style for consistent height
    const buttonStyle = {
        fontSize: '11px',
        textTransform: 'none',
        borderColor: '#e2e8f0',
        color: '#64748b',
        height: '32px',
        minHeight: '32px'
    };

    return (
        <Box sx={{ mb: 3 }}>


            {/* Header Section - Compact Layout */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
                flexWrap: 'wrap',
                gap: 1
            }}>
                {/* Left Side - Shipment ID + Documents Status Chip + Action Buttons */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {/* Shipment ID and Copy Button */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mr: 1 }}>
                        <Typography
                            variant="h6"
                            sx={{
                                fontWeight: 600,
                                color: 'text.primary',
                                fontSize: '1.1rem'
                            }}
                        >
                            {shipment?.shipmentID || 'N/A'}
                        </Typography>
                        <Button
                            size="small"
                            onClick={() => {
                                const shipmentId = shipment?.shipmentID || 'N/A';
                                if (shipmentId && shipmentId !== 'N/A') {
                                    navigator.clipboard.writeText(shipmentId);
                                    onShowSnackbar && onShowSnackbar('Shipment ID copied!', 'success');
                                } else {
                                    onShowSnackbar && onShowSnackbar('No shipment ID to copy.', 'warning');
                                }
                            }}
                            variant="text"
                            sx={{
                                minWidth: 'auto',
                                width: '32px',
                                height: '32px',
                                padding: 0,
                                color: '#64748b',
                                '&:hover': {
                                    backgroundColor: 'rgba(100, 116, 139, 0.1)'
                                }
                            }}
                            title="Copy shipment ID"
                        >
                            <ContentCopyIcon sx={{ fontSize: '14px' }} />
                        </Button>
                        <Button
                            size="small"
                            onClick={() => {
                                if (onRefreshShipment) {
                                    onRefreshShipment();
                                    onShowSnackbar && onShowSnackbar('Refreshing shipment data...', 'info');
                                }
                            }}
                            variant="text"
                            sx={{
                                minWidth: 'auto',
                                width: '32px',
                                height: '32px',
                                padding: 0,
                                color: '#64748b',
                                '&:hover': {
                                    backgroundColor: 'rgba(100, 116, 139, 0.1)'
                                }
                            }}
                            title="Refresh shipment data"
                        >
                            <RefreshIcon sx={{ fontSize: '14px' }} />
                        </Button>
                    </Box>

                    {/* Document Status Indicator */}
                    {(documentsLoading || actionStates.generateBOL?.loading) && (
                        <Chip
                            size="small"
                            label={actionStates.generateBOL?.loading ? "Generating BOL..." : "Fetching"}
                            icon={<CircularProgress size={16} />}
                            variant="outlined"
                            sx={{ height: '32px' }}
                        />
                    )}

                    {documentsError && (
                        <Chip
                            size="small"
                            label="Document error"
                            color="error"
                            variant="outlined"
                            onClick={fetchShipmentDocuments}
                            clickable
                            sx={{ height: '32px' }}
                        />
                    )}

                    {/* Labels Button - Show ONLY for courier shipments with actual shipping labels */}
                    {shipment?.status !== 'draft' &&
                        !documentsLoading &&
                        !isFreightShipment && // Don't show for freight shipments
                        (() => {
                            // Get all potential label documents
                            const allDocs = [
                                ...(shipmentDocuments.labels || []),
                                ...(shipmentDocuments.other || []),
                                ...(shipmentDocuments.documents || [])
                            ];

                            // Filter for actual shipping labels (exclude BOL and carrier confirmations)
                            const actualLabels = allDocs.filter(doc => {
                                const filename = (doc.filename || '').toLowerCase();
                                const documentType = (doc.documentType || '').toLowerCase();

                                // Exclude BOL and carrier confirmation documents
                                const isBOL = filename.includes('bol') ||
                                    filename.includes('billoflading') ||
                                    filename.includes('bill_of_lading') ||
                                    documentType.includes('bol') ||
                                    documentType === 'bill_of_lading';

                                const isConfirmation = filename.includes('confirmation') ||
                                    filename.includes('carrier') ||
                                    documentType === 'carrier_confirmation' ||
                                    doc.docType === 7;

                                if (isBOL || isConfirmation) return false;

                                // Look for actual shipping labels
                                return filename.includes('label') ||
                                    filename.includes('prolabel') ||
                                    filename.includes('shipping_label') ||
                                    documentType.includes('label') ||
                                    documentType === 'shipping_label' ||
                                    doc.docType === 1; // eShipPlus label type
                            });

                            return actualLabels.length > 0;
                        })() && (
                            <Button
                                onClick={onPrintLabel}
                                variant="outlined"
                                size="small"
                                startIcon={actionStates.printLabel.loading ?
                                    <CircularProgress size={14} /> : <QrCodeIcon sx={{ fontSize: 14 }} />}
                                disabled={actionStates.printLabel.loading}
                                sx={buttonStyle}
                            >
                                {actionStates.printLabel.loading ? 'Loading...' : 'Labels'}
                            </Button>
                        )}

                    {/* BOL Button - Next to Labels button */}
                    {isFreightShipment &&
                        shipment?.status !== 'draft' &&
                        !documentsLoading && (
                            <Button
                                onClick={onPrintBOL}
                                variant="outlined"
                                size="small"
                                startIcon={actionStates.printBOL.loading ?
                                    <CircularProgress size={14} /> : <DescriptionIcon sx={{ fontSize: 14 }} />}
                                disabled={actionStates.printBOL.loading}
                                sx={buttonStyle}
                            >
                                {actionStates.printBOL.loading ? 'Loading...' : 'BOL'}
                            </Button>
                        )}

                    {/* Carrier Confirmation Button - Show when carrier confirmation documents exist */}
                    {shipment?.status !== 'draft' &&
                        !documentsLoading &&
                        onPrintConfirmation &&
                        (() => {
                            // Check all document collections for carrier confirmations
                            const allDocs = [
                                ...(shipmentDocuments.carrierConfirmations || []),
                                ...(shipmentDocuments.documents || []),
                                ...(shipmentDocuments.other || []),
                                ...(shipmentDocuments.bol || []), // Sometimes confirmations are misclassified
                                ...(shipmentDocuments.labels || []) // Sometimes confirmations are misclassified
                            ];

                            // Look for carrier confirmation documents
                            const confirmationDocs = allDocs.filter(doc => {
                                const filename = (doc.filename || '').toLowerCase();
                                const documentType = (doc.documentType || '').toLowerCase();

                                return doc.docType === 7 || // Carrier confirmation type
                                    documentType === 'carrier_confirmation' ||
                                    filename.includes('carrier_confirmation') ||
                                    filename.includes('carrier-confirmation') ||
                                    (filename.includes('carrier') && filename.includes('confirmation')) ||
                                    filename.includes('pickup_confirmation') ||
                                    filename.includes('pickup-confirmation');
                            });

                            console.log('🔍 Confirmation button check:', {
                                allDocsCount: allDocs.length,
                                confirmationDocsFound: confirmationDocs.length,
                                confirmationDocs: confirmationDocs.map(doc => ({
                                    filename: doc.filename,
                                    documentType: doc.documentType,
                                    docType: doc.docType
                                }))
                            });

                            return confirmationDocs.length > 0;
                        })() && (
                            <Button
                                onClick={onPrintConfirmation}
                                variant="outlined"
                                size="small"
                                startIcon={actionStates.printConfirmation?.loading ?
                                    <CircularProgress size={14} /> : <LocalShippingIcon sx={{ fontSize: 14 }} />}
                                disabled={actionStates.printConfirmation?.loading}
                                sx={buttonStyle}
                            >
                                {actionStates.printConfirmation?.loading ? 'Loading...' : 'Confirmation'}
                            </Button>
                        )}
                </Box>

                {/* Right Side - Cancel Button + Status Chip */}
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    {/* Cancel Shipment Button */}
                    {canCancelShipment() && (
                        <Button
                            onClick={onCancelShipment}
                            variant="outlined"
                            size="small"
                            sx={{
                                ...buttonStyle,
                                '&:hover': {
                                    borderColor: '#ef4444',
                                    color: '#ef4444',
                                    bgcolor: 'transparent'
                                }
                            }}
                        >
                            Cancel Shipment
                        </Button>
                    )}

                    {/* Large Status Chip */}
                    <StatusChip
                        status={shipment?.status}
                        size="medium"
                        showTooltip={true}
                    />
                </Box>
            </Box>
        </Box>
    );
};

export default ShipmentHeader; 