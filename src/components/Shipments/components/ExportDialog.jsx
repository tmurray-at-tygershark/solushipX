import React from 'react';
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
    Typography
} from '@mui/material';

const ExportDialog = ({
    open,
    onClose,
    selectedExportFormat,
    setSelectedExportFormat,
    shipments = [],
    carrierData = {},
    customers = {}
}) => {

    const handleExport = () => {
        if (!shipments || shipments.length === 0) {
            alert('No shipments to export');
            return;
        }

        try {
            if (selectedExportFormat === 'csv') {
                exportToCSV();
            } else if (selectedExportFormat === 'excel') {
                exportToCSV(); // For now, use CSV for Excel too
            } else if (selectedExportFormat === 'pdf') {
                exportToPDF();
            }
            onClose();
        } catch (error) {
            console.error('Export error:', error);
            alert('Error exporting shipments. Please try again.');
        }
    };

    const exportToCSV = () => {
        // Create CSV headers
        const headers = [
            'Shipment ID',
            'Status',
            'Customer',
            'Origin',
            'Destination',
            'Carrier',
            'Service',
            'Total Charges',
            'Created Date',
            'Reference Number',
            'Tracking Number'
        ];

        // Create CSV rows
        const rows = shipments.map(shipment => {
            const carrier = carrierData[shipment.id];
            const customerName = customers[shipment.shipTo?.customerID] || shipment.shipTo?.company || '';
            const origin = `${shipment.shipFrom?.city || ''}, ${shipment.shipFrom?.state || ''}`;
            const destination = `${shipment.shipTo?.city || ''}, ${shipment.shipTo?.state || ''}`;
            const createdDate = shipment.createdAt?.toDate ?
                shipment.createdAt.toDate().toLocaleDateString() :
                new Date(shipment.createdAt).toLocaleDateString();

            return [
                shipment.shipmentID || shipment.id || '',
                shipment.status || '',
                customerName,
                origin,
                destination,
                carrier?.carrier || '',
                carrier?.service || '',
                carrier?.totalCharges ? `$${carrier.totalCharges.toFixed(2)}` : '',
                createdDate,
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
        // Simple PDF export using window.print
        const printWindow = window.open('', '_blank');
        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Shipments Export</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; font-weight: bold; }
                    tr:nth-child(even) { background-color: #f9f9f9; }
                    h1 { color: #333; }
                </style>
            </head>
            <body>
                <h1>Shipments Export</h1>
                <p>Generated on: ${new Date().toLocaleDateString()}</p>
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
                            <th>Created Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${shipments.map(shipment => {
            const carrier = carrierData[shipment.id];
            const customerName = customers[shipment.shipTo?.customerID] || shipment.shipTo?.company || '';
            const origin = `${shipment.shipFrom?.city || ''}, ${shipment.shipFrom?.state || ''}`;
            const destination = `${shipment.shipTo?.city || ''}, ${shipment.shipTo?.state || ''}`;
            const createdDate = shipment.createdAt?.toDate ?
                shipment.createdAt.toDate().toLocaleDateString() :
                new Date(shipment.createdAt).toLocaleDateString();

            return `
                                <tr>
                                    <td>${shipment.shipmentID || shipment.id || ''}</td>
                                    <td>${shipment.status || ''}</td>
                                    <td>${customerName}</td>
                                    <td>${origin}</td>
                                    <td>${destination}</td>
                                    <td>${carrier?.carrier || ''}</td>
                                    <td>${carrier?.totalCharges ? `$${carrier.totalCharges.toFixed(2)}` : ''}</td>
                                    <td>${createdDate}</td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
            </body>
            </html>
        `;

        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
    };

    return (
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
                        <MenuItem value="pdf">PDF (Print to PDF)</MenuItem>
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
    );
};

export default ExportDialog;
