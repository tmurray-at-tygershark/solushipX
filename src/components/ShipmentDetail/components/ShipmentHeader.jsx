import React from 'react';
import {
    Box,
    Typography,
    Button,
    Chip,
    CircularProgress
} from '@mui/material';
import {
    Print as PrintIcon,
    Description as DescriptionIcon,
    LocalShipping as LocalShippingIcon,
    ArrowBackIosNew as ArrowBackIosNewIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const ShipmentHeader = ({
    shipment,
    actionStates,
    documentsLoading,
    documentsError,
    shipmentDocuments,
    isEShipPlusCarrier,
    onPrintLabel,
    onPrintBOL,
    onPrintShipment,
    fetchShipmentDocuments,
    onBackToTable
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

    return (
        <Box sx={{ mb: 3 }}>
            {/* Header Section - Matching ShipmentsX Layout */}
            <Box sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 2,
                flexWrap: 'wrap',
                gap: 1
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Button
                        onClick={handleBackClick}
                        sx={{
                            minWidth: 0,
                            p: 0.5,
                            mr: 1,
                            color: '#6e6e73',
                            background: 'none',
                            borderRadius: '50%',
                            '&:hover': {
                                background: '#f2f2f7',
                                color: '#111',
                            },
                            boxShadow: 'none',
                        }}
                        aria-label="Back to Shipments"
                    >
                        <ArrowBackIosNewIcon sx={{ fontSize: 20 }} />
                    </Button>
                    <Typography variant="h6" component="h1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                        Shipment Detail
                    </Typography>
                </Box>

                {/* Enhanced Action Buttons */}
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    {/* Print Label Button - Only show when labels exist */}
                    {!isFreightShipment &&
                        shipment?.status !== 'draft' &&
                        !documentsLoading &&
                        shipmentDocuments.labels?.length > 0 && (
                            <Button
                                onClick={onPrintLabel}
                                variant="outlined"
                                size="small"
                                startIcon={actionStates.printLabel.loading ?
                                    <CircularProgress size={16} /> : <PrintIcon sx={{ fontSize: 16 }} />}
                                disabled={actionStates.printLabel.loading}
                                sx={{
                                    color: '#64748b',
                                    borderColor: '#e2e8f0',
                                    fontSize: '0.875rem',
                                    py: 0.5,
                                    textTransform: 'none',
                                    fontWeight: 500,
                                    minWidth: 140
                                }}
                            >
                                {actionStates.printLabel.loading ? 'Loading...' : 'Print Labels'}
                            </Button>
                        )}

                    {/* BOL Button - For Freight shipments */}
                    {isFreightShipment &&
                        shipment?.status !== 'draft' &&
                        !documentsLoading && (
                            <Button
                                onClick={onPrintBOL}
                                variant="outlined"
                                size="small"
                                startIcon={actionStates.printBOL.loading ?
                                    <CircularProgress size={16} /> : <DescriptionIcon sx={{ fontSize: 16 }} />}
                                disabled={actionStates.printBOL.loading}
                                sx={{
                                    color: '#64748b',
                                    borderColor: '#e2e8f0',
                                    fontSize: '0.875rem',
                                    py: 0.5,
                                    textTransform: 'none',
                                    fontWeight: 500
                                }}
                            >
                                {actionStates.printBOL.loading ? 'Loading...' : 'Print BOL'}
                            </Button>
                        )}

                    {/* Print Shipment - Always available */}
                    <Button
                        onClick={onPrintShipment}
                        variant="contained"
                        size="small"
                        startIcon={actionStates.printShipment.loading ?
                            <CircularProgress size={16} /> : <LocalShippingIcon sx={{ fontSize: 16 }} />}
                        disabled={actionStates.printShipment.loading}
                        sx={{
                            bgcolor: '#0f172a',
                            '&:hover': { bgcolor: '#1e293b' },
                            fontSize: '0.875rem',
                            py: 0.5,
                            textTransform: 'none',
                            fontWeight: 500
                        }}
                    >
                        {actionStates.printShipment.loading ? 'Generating...' : 'Print Shipment'}
                    </Button>

                    {/* Document Status Indicator */}
                    {(documentsLoading || actionStates.generateBOL?.loading) && (
                        <Chip
                            size="small"
                            label={actionStates.generateBOL?.loading ? "Generating BOL..." : "Loading documents..."}
                            icon={<CircularProgress size={16} />}
                            variant="outlined"
                            sx={{ ml: 1 }}
                        />
                    )}

                    {documentsError && (
                        <Chip
                            size="small"
                            label="Document error"
                            color="error"
                            variant="outlined"
                            sx={{ ml: 1 }}
                            onClick={fetchShipmentDocuments}
                            clickable
                        />
                    )}

                    {!documentsLoading &&
                        !documentsError &&
                        !actionStates.generateBOL?.loading &&
                        shipment?.status !== 'draft' && (
                            <Chip
                                size="small"
                                label={`${(shipmentDocuments.labels?.length || 0) +
                                    (shipmentDocuments.bol?.length || 0) +
                                    (shipmentDocuments.other?.length || 0)} docs`}
                                color={(shipmentDocuments.labels?.length || 0) +
                                    (shipmentDocuments.bol?.length || 0) +
                                    (shipmentDocuments.other?.length || 0) > 0 ? "success" : "default"}
                                variant="outlined"
                                sx={{ ml: 1 }}
                            />
                        )}
                </Box>
            </Box>
        </Box>
    );
};

export default ShipmentHeader; 