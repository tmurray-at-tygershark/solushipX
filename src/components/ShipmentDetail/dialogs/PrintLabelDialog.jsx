import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Box,
    Typography
} from '@mui/material';

const PrintLabelDialog = ({
    open = false,
    onClose = () => { },
    onPrint = () => { },
    labelConfig = { quantity: 1, labelType: '4x6' },
    setLabelConfig = () => { },
    shipment = null
}) => {
    const handleQuantityChange = (event) => {
        const value = event.target.value;
        // Allow empty string for user to clear and type new number
        if (value === '') {
            setLabelConfig(prev => ({
                ...prev,
                quantity: ''
            }));
        } else {
            const numValue = parseInt(value);
            if (!isNaN(numValue) && numValue >= 1 && numValue <= 10) {
                setLabelConfig(prev => ({
                    ...prev,
                    quantity: numValue
                }));
            }
        }
    };

    const handleLabelTypeChange = (event) => {
        setLabelConfig(prev => ({
            ...prev,
            labelType: event.target.value
        }));
    };

    const handlePrint = () => {
        // Ensure quantity is a valid number before printing
        const finalConfig = {
            ...labelConfig,
            quantity: labelConfig.quantity === '' ? 1 : labelConfig.quantity
        };
        onPrint(finalConfig);
        onClose();
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Print Shipping Labels</DialogTitle>
            <DialogContent>
                <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                        Configure your label printing options below.
                    </Typography>

                    <TextField
                        label="Quantity"
                        type="number"
                        value={labelConfig.quantity}
                        onChange={handleQuantityChange}
                        inputProps={{ min: 1, max: 10 }}
                        fullWidth
                    />

                    <FormControl fullWidth>
                        <InputLabel>Label Size</InputLabel>
                        <Select
                            value={labelConfig.labelType}
                            onChange={handleLabelTypeChange}
                            label="Label Size"
                        >
                            <MenuItem value="4x6">4" x 6" (Standard)</MenuItem>
                            <MenuItem value="4x8">4" x 8"</MenuItem>
                            <MenuItem value="8.5x11">8.5" x 11" (Letter)</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button onClick={handlePrint} variant="contained">
                    Print Labels
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default PrintLabelDialog; 