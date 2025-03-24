import React, { useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Grid,
    Chip,
    Stack
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    CreditCard as CreditCardIcon,
    Lock as LockIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import CreditCardInput from '../Auth/CreditCardInput';

const PaymentMethods = () => {
    const [openDialog, setOpenDialog] = useState(false);
    const [paymentMethods] = useState([
        {
            id: 1,
            type: 'visa',
            last4: '4242',
            expiry: '12/25',
            isDefault: true
        },
        {
            id: 2,
            type: 'mastercard',
            last4: '8888',
            expiry: '06/24',
            isDefault: false
        }
    ]);

    const handleOpenDialog = () => {
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
    };

    const handleCardChange = (cardDetails) => {
        console.log('Card details updated:', cardDetails);
    };

    const getCardTypeIcon = (type) => {
        return `/images/card-types/${type}.svg`;
    };

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Payment Methods
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleOpenDialog}
                    sx={{
                        bgcolor: '#000',
                        '&:hover': { bgcolor: '#333' }
                    }}
                >
                    Add Payment Method
                </Button>
            </Box>

            <Grid container spacing={3}>
                {paymentMethods.map((method) => (
                    <Grid item xs={12} md={6} key={method.id}>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <Paper
                                elevation={0}
                                sx={{
                                    p: 3,
                                    border: '1px solid #eee',
                                    borderRadius: 2,
                                    position: 'relative'
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <CreditCardIcon sx={{ color: '#666', mr: 1 }} />
                                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                                        {method.type.charAt(0).toUpperCase() + method.type.slice(1)}
                                    </Typography>
                                    {method.isDefault && (
                                        <Chip
                                            label="Default"
                                            size="small"
                                            sx={{ ml: 1, bgcolor: '#f0f0f0' }}
                                        />
                                    )}
                                </Box>

                                <Stack spacing={1}>
                                    <Typography variant="body2" color="text.secondary">
                                        •••• {method.last4}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Expires {method.expiry}
                                    </Typography>
                                </Stack>

                                <Box sx={{ position: 'absolute', top: 16, right: 16 }}>
                                    <IconButton
                                        size="small"
                                        sx={{ color: '#ff4d4f' }}
                                    >
                                        <DeleteIcon fontSize="small" />
                                    </IconButton>
                                </Box>
                            </Paper>
                        </motion.div>
                    </Grid>
                ))}
            </Grid>

            <Dialog
                open={openDialog}
                onClose={handleCloseDialog}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Add Payment Method</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2 }}>
                        <CreditCardInput
                            onCardChange={handleCardChange}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseDialog}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={handleCloseDialog}
                        sx={{
                            bgcolor: '#000',
                            '&:hover': { bgcolor: '#333' }
                        }}
                    >
                        Add Card
                    </Button>
                </DialogActions>
            </Dialog>

            <Box sx={{ mt: 4, display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
                <LockIcon fontSize="small" />
                <Typography variant="body2">
                    Your payment information is encrypted and secure
                </Typography>
            </Box>
        </Box>
    );
};

export default PaymentMethods; 