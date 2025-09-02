import React, { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    Typography,
    Box,
    IconButton
} from '@mui/material';
import {
    PictureAsPdf as PictureAsPdfIcon,
    FileDownload as FileDownloadIcon,
    Close as CloseIcon
} from '@mui/icons-material';

const ExportDialog = ({
    open,
    onClose,
    selectedExportFormat,
    setSelectedExportFormat,
    shipments = [],
    carrierData = {},
    customers = {}
}) => {
    // PDF viewer state
    const [pdfViewerOpen, setPdfViewerOpen] = useState(false);
    const [currentPdfUrl, setCurrentPdfUrl] = useState(null);
    const [currentPdfTitle, setCurrentPdfTitle] = useState('');

    const handleExport = () => {
        if (!shipments || shipments.length === 0) {
            alert('No shipments to export');
            return;
        }

        try {
            if (selectedExportFormat === 'csv') {
                exportToCSV();
                onClose();
            } else if (selectedExportFormat === 'excel') {
                exportToCSV(); // For now, use CSV for Excel too
                onClose();
            } else if (selectedExportFormat === 'pdf') {
                exportToPDF();
                // Don't close the dialog yet - PDF viewer will open
            }
        } catch (error) {
            console.error('Export error:', error);
            alert('Error exporting shipments. Please try again.');
        }
    };

    const exportToCSV = () => {
        // Create CSV headers - Enhanced with missing critical columns
        const headers = [
            'Shipment ID',
            'Status',
            'Customer',
            'Origin',
            'Destination',
            'Carrier',
            'Service',
            'Total Charges',
            'Invoice Status',
            'Created Date',
            'Shipment Date',
            'Delivery Date',
            'Reference Number',
            'Tracking Number'
        ];

        // Create CSV rows
        const rows = shipments.map(shipment => {
            const carrier = carrierData[shipment.id];

            // Enhanced customer name extraction - handle object vs string
            const getCustomerName = () => {
                // Try multiple customer data sources
                const customerData = customers[shipment.shipTo?.customerID] ||
                    customers[shipment.selectedCustomerId] ||
                    customers[shipment.customerId];

                if (customerData) {
                    // If customerData is an object, extract name property
                    if (typeof customerData === 'object') {
                        return customerData.name || customerData.companyName || customerData.customerName || '';
                    }
                    // If customerData is already a string, return it
                    return String(customerData);
                }

                // Fallback to shipment data
                return shipment.shipTo?.company ||
                    shipment.shipTo?.companyName ||
                    shipment.customerName ||
                    shipment.selectedCustomerName ||
                    '';
            };

            const customerName = getCustomerName();
            const origin = `${shipment.shipFrom?.city || ''}, ${shipment.shipFrom?.state || ''}`;
            const destination = `${shipment.shipTo?.city || ''}, ${shipment.shipTo?.state || ''}`;

            // Enhanced date handling
            const formatDate = (dateField) => {
                if (!dateField) return '';
                try {
                    if (dateField.toDate) {
                        return dateField.toDate().toLocaleDateString();
                    }
                    return new Date(dateField).toLocaleDateString();
                } catch (error) {
                    return '';
                }
            };

            const createdDate = formatDate(shipment.createdAt);

            // Get shipment date - multiple possible sources
            const shipmentDate = formatDate(
                shipment.shipmentDate ||
                shipment.shipmentInfo?.shipmentDate ||
                shipment.bookedAt ||
                shipment.scheduledDate
            );

            // Get delivery date - multiple possible sources
            const deliveryDate = formatDate(
                shipment.deliveryDate ||
                shipment.estimatedDelivery ||
                shipment.eta1 ||
                shipment.eta2 ||
                shipment.carrierBookingConfirmation?.estimatedDeliveryDate ||
                shipment.selectedRate?.transit?.estimatedDelivery ||
                shipment.selectedRate?.estimatedDeliveryDate ||
                shipment.shipmentInfo?.deliveredAt
            );

            // Get total charges - multiple possible sources
            const getTotalCharges = () => {
                // Priority order for total charges
                if (carrier?.totalCharges) return `$${carrier.totalCharges.toFixed(2)}`;
                if (shipment.selectedRate?.totalCharges) return `$${shipment.selectedRate.totalCharges.toFixed(2)}`;
                if (shipment.totalCharges) return `$${shipment.totalCharges.toFixed(2)}`;
                if (shipment.billingDetails?.totalCharges) return `$${shipment.billingDetails.totalCharges.toFixed(2)}`;
                if (shipment.markupRates?.totalCharges) return `$${shipment.markupRates.totalCharges.toFixed(2)}`;
                return '';
            };

            // Get invoice status
            const invoiceStatus = shipment.invoiceStatus || 'uninvoiced';

            return [
                shipment.shipmentID || shipment.id || '',
                shipment.status || '',
                customerName,
                origin,
                destination,
                carrier?.carrier || '',
                carrier?.service || '',
                getTotalCharges(),
                invoiceStatus,
                createdDate,
                shipmentDate,
                deliveryDate,
                shipment.shipmentInfo?.shipperReferenceNumber || shipment.referenceNumber || '',
                shipment.trackingNumber || shipment.carrierTrackingData?.trackingNumber || ''
            ];
        });

        // Combine headers and rows
        const csvContent = [headers, ...rows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');

        // Create and download file
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `shipments_export_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const exportToPDF = () => {
        // Create HTML content for PDF
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Shipments Export</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 12px; }
                    th { background-color: #f2f2f2; font-weight: bold; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    h1 { color: #333; margin-bottom: 10px; }
                    .header-info { margin-bottom: 20px; color: #666; }
                    @media print {
                        body { margin: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                <h1>Shipments Export</h1>
                <div class="header-info">
                    <p>Generated on: ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
                    <p>Total Shipments: ${shipments.length}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th>Shipment ID</th>
                            <th>Status</th>
                            <th>Customer</th>
                            <th>Origin</th>
                            <th>Destination</th>
                            <th>Carrier</th>
                            <th>Total Charges</th>
                            <th>Invoice Status</th>
                            <th>Created Date</th>
                            <th>Shipment Date</th>
                            <th>Delivery Date</th>
                            <th>Reference</th>
                            <th>Tracking</th>
                        </tr>
                    </thead>
                                        <tbody>
                        ${shipments.map(shipment => {
            const carrier = carrierData[shipment.id];

            // Enhanced customer name extraction for PDF - handle object vs string
            const getCustomerName = () => {
                // Try multiple customer data sources
                const customerData = customers[shipment.shipTo?.customerID] ||
                    customers[shipment.selectedCustomerId] ||
                    customers[shipment.customerId];

                if (customerData) {
                    // If customerData is an object, extract name property
                    if (typeof customerData === 'object') {
                        return customerData.name || customerData.companyName || customerData.customerName || '';
                    }
                    // If customerData is already a string, return it
                    return String(customerData);
                }

                // Fallback to shipment data
                return shipment.shipTo?.company ||
                    shipment.shipTo?.companyName ||
                    shipment.customerName ||
                    shipment.selectedCustomerName ||
                    '';
            };

            const customerName = getCustomerName();
            const origin = `${shipment.shipFrom?.city || ''}, ${shipment.shipFrom?.state || ''}`;
            const destination = `${shipment.shipTo?.city || ''}, ${shipment.shipTo?.state || ''}`;

            // Enhanced date handling for PDF
            const formatDate = (dateField) => {
                if (!dateField) return '';
                try {
                    if (dateField.toDate) {
                        return dateField.toDate().toLocaleDateString();
                    }
                    return new Date(dateField).toLocaleDateString();
                } catch (error) {
                    return '';
                }
            };

            const createdDate = formatDate(shipment.createdAt);

            // Get shipment date - multiple possible sources
            const shipmentDate = formatDate(
                shipment.shipmentDate ||
                shipment.shipmentInfo?.shipmentDate ||
                shipment.bookedAt ||
                shipment.scheduledDate
            );

            // Get delivery date - multiple possible sources
            const deliveryDate = formatDate(
                shipment.deliveryDate ||
                shipment.estimatedDelivery ||
                shipment.eta1 ||
                shipment.eta2 ||
                shipment.carrierBookingConfirmation?.estimatedDeliveryDate ||
                shipment.selectedRate?.transit?.estimatedDelivery ||
                shipment.selectedRate?.estimatedDeliveryDate ||
                shipment.shipmentInfo?.deliveredAt
            );

            // Get total charges - multiple possible sources
            const getTotalCharges = () => {
                if (carrier?.totalCharges) return `$${carrier.totalCharges.toFixed(2)}`;
                if (shipment.selectedRate?.totalCharges) return `$${shipment.selectedRate.totalCharges.toFixed(2)}`;
                if (shipment.totalCharges) return `$${shipment.totalCharges.toFixed(2)}`;
                if (shipment.billingDetails?.totalCharges) return `$${shipment.billingDetails.totalCharges.toFixed(2)}`;
                if (shipment.markupRates?.totalCharges) return `$${shipment.markupRates.totalCharges.toFixed(2)}`;
                return '';
            };

            // Get invoice status
            const invoiceStatus = shipment.invoiceStatus || 'uninvoiced';

            // Get reference and tracking
            const reference = shipment.shipmentInfo?.shipperReferenceNumber || shipment.referenceNumber || '';
            const tracking = shipment.trackingNumber || shipment.carrierTrackingData?.trackingNumber || '';

            return `
                                <tr>
                                    <td>${shipment.shipmentID || shipment.id || ''}</td>
                                    <td>${shipment.status || ''}</td>
                                    <td>${customerName}</td>
                                    <td>${origin}</td>
                                    <td>${destination}</td>
                                    <td>${carrier?.carrier || ''}</td>
                                    <td>${getTotalCharges()}</td>
                                    <td>${invoiceStatus}</td>
                                    <td>${createdDate}</td>
                                    <td>${shipmentDate}</td>
                                    <td>${deliveryDate}</td>
                                    <td>${reference}</td>
                                    <td>${tracking}</td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        // Create a blob URL for the HTML content
        const blob = new Blob([htmlContent], { type: 'text/html' });
        const url = URL.createObjectURL(blob);

        // Set PDF viewer state
        setCurrentPdfUrl(url);
        setCurrentPdfTitle(`Shipments Export - ${new Date().toLocaleDateString()}`);
        setPdfViewerOpen(true);
    };

    const handleClosePdfViewer = () => {
        setPdfViewerOpen(false);
        if (currentPdfUrl?.startsWith('blob:')) {
            URL.revokeObjectURL(currentPdfUrl);
        }
        setCurrentPdfUrl(null);
        setCurrentPdfTitle('');
        onClose(); // Close the export dialog when PDF viewer closes
    };

    return (
        <>
            <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
                <DialogTitle>Export Shipments</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Export {shipments.length} shipment{shipments.length !== 1 ? 's' : ''} to your selected format.
                    </Typography>
                    <FormControl fullWidth sx={{ mt: 2 }}>
                        <InputLabel>Format</InputLabel>
                        <Select
                            value={selectedExportFormat}
                            onChange={(e) => setSelectedExportFormat(e.target.value)}
                            label="Format"
                        >
                            <MenuItem value="csv">CSV (Comma Separated Values)</MenuItem>
                            <MenuItem value="excel">Excel (CSV format)</MenuItem>
                            <MenuItem value="pdf">PDF (Preview & Print)</MenuItem>
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={handleExport}
                        variant="contained"
                        disabled={!selectedExportFormat || shipments.length === 0}
                    >
                        Export
                    </Button>
                </DialogActions>
            </Dialog>

            {/* PDF Viewer Dialog - Same as ShipmentDetailX */}
            <Dialog
                open={pdfViewerOpen}
                onClose={handleClosePdfViewer}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: {
                        height: '90vh',
                        borderRadius: 2
                    }
                }}
            >
                <DialogTitle sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid',
                    borderColor: 'divider'
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <PictureAsPdfIcon color="error" />
                        <Typography variant="h6">{currentPdfTitle}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            onClick={() => {
                                if (currentPdfUrl) {
                                    window.open(currentPdfUrl, '_blank');
                                }
                            }}
                            startIcon={<FileDownloadIcon />}
                            size="small"
                        >
                            Print/Download
                        </Button>
                        <IconButton onClick={handleClosePdfViewer}>
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </DialogTitle>
                <DialogContent sx={{ p: 0, height: '100%' }}>
                    {currentPdfUrl && (
                        <Box sx={{ height: '100%', width: '100%' }}>
                            <iframe
                                src={currentPdfUrl}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    border: 'none'
                                }}
                                title={currentPdfTitle}
                            />
                        </Box>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
};

export default ExportDialog; 