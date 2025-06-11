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
    Button
} from '@mui/material';

const ExportDialog = ({ open, onClose, selectedFormat, onFormatChange, onExport }) => {
    return (
        <Dialog open={open} onClose={onClose}>
            <DialogTitle>Export Shipments</DialogTitle>
            <DialogContent>
                <FormControl fullWidth sx={{ mt: 2 }}>
                    <InputLabel>Format</InputLabel>
                    <Select
                        value={selectedFormat}
                        onChange={(e) => onFormatChange(e.target.value)}
                        label="Format"
                    >
                        <MenuItem value="csv">CSV</MenuItem>
                        <MenuItem value="excel">Excel</MenuItem>
                        <MenuItem value="pdf">PDF</MenuItem>
                    </Select>
                </FormControl>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={onExport} variant="contained">
                    Export
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default ExportDialog;
