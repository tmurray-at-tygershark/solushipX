import React, { useState } from 'react';
import {
    Box,
    Container,
    Paper,
    Typography,
    TextField,
    Button,
    InputAdornment
} from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const Tracking = () => {
    const [trackingNumber, setTrackingNumber] = useState('');
    const navigate = useNavigate();

    const handleSubmit = (e) => {
        e.preventDefault();
        if (trackingNumber.trim()) {
            navigate(`/tracking/${trackingNumber.trim()}`);
        }
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
                    <Typography variant="body1" color="text.secondary">
                        Enter your tracking number to get real-time updates on your shipment
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
                    <form onSubmit={handleSubmit}>
                        <TextField
                            fullWidth
                            placeholder="Enter tracking number"
                            value={trackingNumber}
                            onChange={(e) => setTrackingNumber(e.target.value)}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon />
                                    </InputAdornment>
                                ),
                            }}
                            sx={{ mb: 3 }}
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
                </Paper>
            </Container>
        </Box>
    );
};

export default Tracking; 