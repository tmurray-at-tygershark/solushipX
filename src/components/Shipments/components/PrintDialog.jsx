import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Typography,
    Box,
    Button,
    CircularProgress
} from '@mui/material';
import {
    Print as PrintIcon,
    LocalShipping as LocalShippingIcon,
    Assignment as AssignmentIcon
} from '@mui/icons-material';

const PrintDialog = ({
    open,
    onClose,
    printType,
    selectedShipment,
    isGeneratingLabel,
    onPrint,
    getBestRateInfo,
    carrierData
}) => {
    const getCarrierInfo = () => {
        const carrierName = carrierData?.name?.toLowerCase() || '';
        const isCanparShipment = getBestRateInfo?.carrier?.toLowerCase().includes('canpar') ||
            carrierName.includes('canpar') ||
            carrierData?.carrierID === 'CANPAR';

        const serviceType = selectedShipment?.selectedRateRef?.service ||
            selectedShipment?.selectedRate?.service ||
            carrierData?.service;

        return {
            name: getBestRateInfo?.carrier || 'Unknown',
            isEShipPlus: getBestRateInfo?.displayCarrierId === 'ESHIPPLUS' ||
                getBestRateInfo?.sourceCarrierName === 'eShipPlus' ||
                getBestRateInfo?.sourceCarrier?.key === 'ESHIPPLUS',
            serviceType
        };
    };

    const carrier = getCarrierInfo();

    return (
        <Dialog
            open={open}
            onClose={() => {
                onClose();
            }}
            maxWidth="sm"
            fullWidth
        >
            <DialogTitle>
                {printType === 'bol' ? 'Print Bill of Lading' : 'Print Shipping Label'}
            </DialogTitle>
            <DialogContent>
                <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                    {printType === 'bol'
                        ? 'Generate and download the Bill of Lading for this freight shipment.'
                        : 'Generate and download the shipping label for this shipment.'
                    }
                </Typography>

                {selectedShipment ? (
                    <Box sx={{ mt: 2, p: 2, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                        {/* Shipment ID */}
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" sx={{ color: '#64748b', fontSize: '0.75rem', mb: 0.5 }}>
                                SHIPMENT NUMBER
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
                                {selectedShipment.shipmentID || selectedShipment.id}
                            </Typography>
                        </Box>

                        {/* Carrier and Service */}
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="subtitle2" sx={{ color: '#64748b', fontSize: '0.75rem', mb: 0.5 }}>
                                CARRIER
                            </Typography>
                            <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                {carrier.name}
                                {carrier.isEShipPlus && (
                                    <Typography component="span" sx={{ ml: 1, fontSize: '0.75rem', color: '#7c3aed', bgcolor: '#ede9fe', px: 1, py: 0.25, borderRadius: 1 }}>
                                        eShipPlus
                                    </Typography>
                                )}
                            </Typography>
                        </Box>

                        {carrier.serviceType && (
                            <Box>
                                <Typography variant="subtitle2" sx={{ color: '#64748b', fontSize: '0.75rem', mb: 0.5 }}>
                                    SERVICE TYPE
                                </Typography>
                                <Typography variant="body1" sx={{ fontWeight: 500 }}>
                                    {carrier.serviceType}
                                </Typography>
                            </Box>
                        )}
                    </Box>
                ) : (
                    <Box sx={{ mt: 2, p: 2, bgcolor: '#fef3c7', borderRadius: 1, border: '1px solid #f59e0b' }}>
                        <Typography variant="body2" color="#92400e">
                            ⚠️ No shipment selected. Please close and try again.
                        </Typography>
                    </Box>
                )}
            </DialogContent>
            <DialogActions>
                <Button
                    onClick={onClose}
                    disabled={isGeneratingLabel}
                >
                    Cancel
                </Button>
                <Button
                    onClick={onPrint}
                    variant="contained"
                    disabled={isGeneratingLabel}
                    startIcon={isGeneratingLabel ? <CircularProgress size={16} /> : <PrintIcon />}
                >
                    {isGeneratingLabel ? 'Generating...' : `Print ${printType === 'bol' ? 'BOL' : 'Label'}`}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default PrintDialog;
