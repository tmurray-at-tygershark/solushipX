import React, { useState } from 'react';
import {
    Box,
    Container,
    Paper,
    Typography,
    TextField,
    Button,
    InputAdornment,
    Alert
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const Tracking = () => {
    const [trackingNumber, setTrackingNumber] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (!trackingNumber.trim()) {
            setError('Please enter a tracking number or shipment ID');
            return;
        }

        // Navigate to tracking detail page
        navigate(`/tracking/${encodeURIComponent(trackingNumber.trim())}`);
    };

    const handleInputChange = (e) => {
        setTrackingNumber(e.target.value);
        if (error) setError(''); // Clear error when user starts typing
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                bgcolor: '#f8f9fa',
                py: 8
            }}
        >
            <Container maxWidth="md">
                <Box sx={{ textAlign: 'center', mb: 6 }}>
                    <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 2 }}>
                        Track Your Shipment
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                        Enter your shipment ID or tracking number to get real-time updates
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        Supports shipment IDs (e.g., IC-DWSLOGISTICS-226KSP) and carrier tracking numbers
                    </Typography>
                </Box>

                <Paper
                    elevation={0}
                    sx={{
                        p: 4,
                        border: '1px solid #eee',
                        borderRadius: 2
                    }}
                >
                    {error && (
                        <Alert severity="error" sx={{ mb: 3 }}>
                            {error}
                        </Alert>
                    )}

                    <form onSubmit={handleSubmit}>
                        <TextField
                            fullWidth
                            placeholder="Enter shipment ID or tracking number"
                            value={trackingNumber}
                            onChange={handleInputChange}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{ mb: 3 }}
                            autoFocus
                        />
                        <Button
                            type="submit"
                            variant="contained"
                            fullWidth
                            size="large"
                            sx={{
                                bgcolor: '#000',
                                '&:hover': { bgcolor: '#333' }
                            }}
                        >
                            Track Shipment
                        </Button>
                    </form>

                    <Box sx={{ mt: 4, textAlign: 'center' }}>
                        <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                            What can you track?
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Typography variant="body2" color="text.secondary">
                                • Shipment IDs from SolushipX (e.g., IC-DWSLOGISTICS-226KSP)
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • eShip Plus tracking numbers and booking references
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • Canpar barcodes and tracking numbers
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                • Other carrier tracking numbers
                            </Typography>
                        </Box>
                    </Box>
                </Paper>
            </Container>
        </Box>
    );
};

export default Tracking; 