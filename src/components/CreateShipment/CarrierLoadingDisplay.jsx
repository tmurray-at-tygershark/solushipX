import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, Fade, Chip, Grid } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

const CarrierLoadingDisplay = ({
    loadingCarriers = [],
    completedCarriers = [],
    failedCarriers = [],
    isLoading = false
}) => {
    const [animationText, setAnimationText] = useState('');
    const [currentCarrierIndex, setCurrentCarrierIndex] = useState(0);

    // Animated loading messages
    const loadingMessages = [
        "Fetching real-time shipping options from top carriers...",
        "Comparing rates across your network...",
        "Finding the best deals for your shipment...",
        "Analyzing carrier availability and pricing..."
    ];

    useEffect(() => {
        if (!isLoading) return;

        let messageIndex = 0;
        const messageInterval = setInterval(() => {
            setAnimationText(loadingMessages[messageIndex]);
            messageIndex = (messageIndex + 1) % loadingMessages.length;
        }, 3000);

        return () => clearInterval(messageInterval);
    }, [isLoading]);

    useEffect(() => {
        if (!isLoading || loadingCarriers.length === 0) return;

        const carrierInterval = setInterval(() => {
            setCurrentCarrierIndex(prev => (prev + 1) % loadingCarriers.length);
        }, 1500);

        return () => clearInterval(carrierInterval);
    }, [isLoading, loadingCarriers.length]);

    const getCarrierLogo = (carrierName) => {
        // Enhanced carrier logo detection for loading display
        // Check for eShip Plus patterns in carrier names
        const isEshipPlus =
            carrierName === 'eShip Plus' ||
            carrierName === 'ESHIPPLUS' ||
            carrierName.toLowerCase().includes('eship') ||
            carrierName.toLowerCase().includes('freight') ||
            carrierName.toLowerCase().includes('ltl');

        if (isEshipPlus) {
            return '/images/carrier-badges/eship.png';
        }

        const logoMap = {
            'eShip Plus': '/images/carrier-badges/eship.png',
            'Canpar': '/images/carrier-badges/canpar.png',
            'Polaris Transportation': '/images/carrier-badges/polaristransportation.png',
            'FedEx': '/images/carrier-badges/fedex.png',
            'UPS': '/images/carrier-badges/ups.png',
            'DHL': '/images/carrier-badges/dhl.png',
            'Canada Post': '/images/carrier-badges/canadapost.png',
            'Purolator': '/images/carrier-badges/purolator.png',
            'USPS': '/images/carrier-badges/usps.png'
        };
        return logoMap[carrierName] || '/images/carrier-badges/solushipx.png';
    };

    const getCarrierStatus = (carrierName) => {
        if (completedCarriers.some(c => c.name === carrierName)) return 'completed';
        if (failedCarriers.some(c => c.name === carrierName)) return 'failed';
        return 'loading';
    };

    const totalCarriers = loadingCarriers.length;
    const completedCount = completedCarriers.length;
    const failedCount = failedCarriers.length;
    const progressPercentage = totalCarriers > 0 ? ((completedCount + failedCount) / totalCarriers) * 100 : 0;

    if (!isLoading && totalCarriers === 0) return null;

    return (
        <Box sx={{ width: '100%', maxWidth: 600, mx: 'auto', pt: '100px' }}>
            {/* Main Loading Message */}
            <Box sx={{ textAlign: 'center', mb: 3 }}>
                <Fade in={isLoading} timeout={1000}>
                    <Typography
                        variant="subtitle1"
                        sx={{
                            fontWeight: 600,
                            color: 'text.primary',
                            mb: 1,
                            fontSize: '14px',
                            minHeight: '1.5rem'
                        }}
                    >
                        {animationText || loadingMessages[0]}
                    </Typography>
                </Fade>

                {totalCarriers > 0 && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontSize: '12px' }}>
                        Searching {totalCarriers} configured carrier{totalCarriers !== 1 ? 's' : ''} for your company
                    </Typography>
                )}

                {/* Loading Spinner */}
                {isLoading && totalCarriers > 0 && (
                    <Box sx={{ mb: 2, display: 'flex', justifyContent: 'center' }}>
                        <CircularProgress
                            size={32}
                            thickness={4}
                            sx={{
                                color: '#10B981',
                                '& .MuiCircularProgress-circle': {
                                    strokeLinecap: 'round'
                                }
                            }}
                        />
                    </Box>
                )}
            </Box>

            {/* Carrier Grid */}
            {totalCarriers > 0 && (
                <Grid container spacing={1.5} justifyContent="center">
                    {loadingCarriers.map((carrierName, index) => {
                        const status = getCarrierStatus(carrierName);
                        const isCurrentlyFetching = isLoading && status === 'loading' && index === currentCarrierIndex;

                        return (
                            <Grid item key={carrierName}>
                                <Fade in={true} timeout={500 + index * 200}>
                                    <Box
                                        sx={{
                                            position: 'relative',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            p: 1.5,
                                            borderRadius: 2,
                                            transition: 'all 0.3s ease',
                                            transform: isCurrentlyFetching ? 'scale(1.02)' : 'scale(1)',
                                            minWidth: 100,
                                            minHeight: 80
                                        }}
                                    >
                                        {/* Carrier Logo */}
                                        <Box
                                            component="img"
                                            src={getCarrierLogo(carrierName)}
                                            alt={carrierName}
                                            sx={{
                                                width: 50,
                                                height: 32,
                                                objectFit: 'contain',
                                                mb: 0.5,
                                                opacity: status === 'failed' ? 0.5 : 1,
                                                filter: isCurrentlyFetching ? 'brightness(1.1)' : 'none',
                                                transition: 'all 0.3s ease'
                                            }}
                                        />

                                        {/* Carrier Name */}
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                fontWeight: 500,
                                                fontSize: '10px',
                                                textAlign: 'center',
                                                color: status === 'failed' ? 'error.main' : 'text.secondary',
                                                lineHeight: 1.2
                                            }}
                                        >
                                            {carrierName}
                                        </Typography>

                                        {/* Status Indicator */}
                                        <Box sx={{ position: 'absolute', top: 6, right: 6 }}>
                                            {status === 'completed' && (
                                                <CheckCircleIcon sx={{ color: 'success.main', fontSize: '1rem' }} />
                                            )}
                                            {status === 'failed' && (
                                                <ErrorIcon sx={{ color: 'error.main', fontSize: '1rem' }} />
                                            )}
                                            {status === 'loading' && isCurrentlyFetching && (
                                                <AccessTimeIcon
                                                    sx={{
                                                        color: 'primary.main',
                                                        fontSize: '1rem',
                                                        animation: 'pulse 1.5s infinite'
                                                    }}
                                                />
                                            )}
                                        </Box>

                                        {/* Loading Animation Overlay */}
                                        {isCurrentlyFetching && (
                                            <Box
                                                sx={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    right: 0,
                                                    bottom: 0,
                                                    borderRadius: 2,
                                                    background: 'linear-gradient(45deg, transparent 30%, rgba(59, 130, 246, 0.08) 50%, transparent 70%)',
                                                    animation: 'shimmer 2s infinite'
                                                }}
                                            />
                                        )}
                                    </Box>
                                </Fade>
                            </Grid>
                        );
                    })}
                </Grid>
            )}

            {/* Results Summary */}
            {(completedCount > 0 || failedCount > 0) && (
                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                    {completedCount > 0 && (
                        <Chip
                            icon={<CheckCircleIcon sx={{ fontSize: '14px' }} />}
                            label={`${completedCount} successful`}
                            color="success"
                            variant="outlined"
                            size="small"
                            sx={{ fontSize: '11px', height: '24px' }}
                        />
                    )}
                    {failedCount > 0 && (
                        <Chip
                            icon={<ErrorIcon sx={{ fontSize: '14px' }} />}
                            label={`${failedCount} failed`}
                            color="error"
                            variant="outlined"
                            size="small"
                            sx={{ fontSize: '11px', height: '24px' }}
                        />
                    )}
                </Box>
            )}

            {/* CSS Animations */}
            <style jsx>{`
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                
                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}</style>
        </Box>
    );
};

export default CarrierLoadingDisplay; 