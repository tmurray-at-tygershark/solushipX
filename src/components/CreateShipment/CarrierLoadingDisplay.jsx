import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, Fade, Chip, Grid, LinearProgress } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../firebase/firebase';

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
        "Fetching rates from carriers...",
        "Searching configured carriers..."
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

    // State to store carrier logos fetched from database
    const [carrierLogos, setCarrierLogos] = useState({});

    // Fetch carrier logos from database
    useEffect(() => {
        const fetchCarrierLogos = async () => {
            if (loadingCarriers.length === 0) return;

            const logoMap = {};

            for (const carrierName of loadingCarriers) {
                try {
                    // Map carrier names to their database carrierID
                    const carrierNameToIdMap = {
                        'eShipPlus': 'ESHIPPLUS',
                        'Polaris Transportation': 'POLARISTRANSPORTATION',
                        'Canpar': 'CANPAR'
                    };

                    const carrierID = carrierNameToIdMap[carrierName] || carrierName.toUpperCase().replace(/\s+/g, '');

                    // Query carriers collection by carrierID field
                    const carriersQuery = query(
                        collection(db, 'carriers'),
                        where('carrierID', '==', carrierID),
                        limit(1)
                    );

                    const carriersSnapshot = await getDocs(carriersQuery);

                    if (!carriersSnapshot.empty) {
                        const carrierDoc = carriersSnapshot.docs[0];
                        const carrierData = carrierDoc.data();
                        const logoURL = carrierData.logoURL;

                        if (logoURL) {
                            logoMap[carrierName] = logoURL;
                        } else {
                            // Fallback to default logo
                            logoMap[carrierName] = '/images/carrier-badges/solushipx.png';
                        }
                    } else {
                        // Fallback to default logo if carrier not found
                        logoMap[carrierName] = '/images/carrier-badges/solushipx.png';
                    }
                } catch (error) {
                    console.error(`Error fetching logo for ${carrierName}:`, error);
                    // Fallback to default logo on error
                    logoMap[carrierName] = '/images/carrier-badges/solushipx.png';
                }
            }

            setCarrierLogos(logoMap);
        };

        fetchCarrierLogos();
    }, [loadingCarriers]);

    const getCarrierLogo = (carrierName) => {
        return carrierLogos[carrierName] || '/images/carrier-badges/solushipx.png';
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
        <Box sx={{
            width: '100%',
            maxWidth: 400,
            mx: 'auto',
            py: 3,
            px: 2
        }}>
            {/* Main Loading Message */}
            <Box sx={{ textAlign: 'center', mb: 2 }}>
                <Fade in={isLoading} timeout={800}>
                    <Typography
                        variant="subtitle1"
                        sx={{
                            fontWeight: 600,
                            color: '#374151',
                            mb: 1,
                            fontSize: '12px',
                            minHeight: '18px',
                            lineHeight: '18px',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                            textOverflow: 'ellipsis'
                        }}
                    >
                        {animationText || loadingMessages[0]}
                    </Typography>
                </Fade>

                {/* Compact Progress Bar */}
                {isLoading && totalCarriers > 0 && (
                    <Box sx={{ mb: 2 }}>
                        <LinearProgress
                            variant="indeterminate"
                            sx={{
                                height: 2,
                                borderRadius: 1,
                                backgroundColor: '#e5e7eb',
                                '& .MuiLinearProgress-bar': {
                                    backgroundColor: '#3b82f6',
                                    borderRadius: 1
                                }
                            }}
                        />
                    </Box>
                )}
            </Box>

            {/* Compact Carrier Display */}
            {totalCarriers > 0 && (
                <Box sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 3,
                    flexWrap: 'wrap'
                }}>
                    {loadingCarriers.map((carrierName, index) => {
                        const status = getCarrierStatus(carrierName);
                        const isCurrentlyFetching = isLoading && status === 'loading' && index === currentCarrierIndex;

                        return (
                            <Fade key={carrierName} in={true} timeout={500 + index * 150}>
                                <Box
                                    sx={{
                                        position: 'relative',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        p: 1.5,
                                        borderRadius: '12px',
                                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                        transform: isCurrentlyFetching ? 'scale(1.05)' : 'scale(1)',
                                        minWidth: 80,
                                        minHeight: 64,
                                        backgroundColor: isCurrentlyFetching ? '#f8fafc' : '#ffffff',
                                        border: `1px solid ${status === 'completed' ? '#10b981' :
                                            status === 'failed' ? '#ef4444' :
                                                isCurrentlyFetching ? '#3b82f6' : '#e5e7eb'
                                            }`,
                                        boxShadow: isCurrentlyFetching ?
                                            '0 4px 12px rgba(59, 130, 246, 0.15)' :
                                            '0 1px 3px rgba(0, 0, 0, 0.1)',
                                        '&:hover': {
                                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
                                        }
                                    }}
                                >
                                    {/* Carrier Logo */}
                                    <Box
                                        component="img"
                                        src={getCarrierLogo(carrierName)}
                                        alt={carrierName}
                                        sx={{
                                            width: 40,
                                            height: 24,
                                            objectFit: 'contain',
                                            mb: 0.5,
                                            opacity: status === 'failed' ? 0.4 : 1,
                                            filter: isCurrentlyFetching ? 'brightness(1.1) saturate(1.1)' : 'none',
                                            transition: 'all 0.3s ease'
                                        }}
                                    />

                                    {/* Carrier Name */}
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            fontWeight: 500,
                                            fontSize: '9px',
                                            textAlign: 'center',
                                            color: status === 'failed' ? '#6b7280' : '#374151',
                                            lineHeight: 1.1,
                                            maxWidth: '100%',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap'
                                        }}
                                    >
                                        {carrierName}
                                    </Typography>

                                    {/* Status Indicator */}
                                    <Box sx={{
                                        position: 'absolute',
                                        top: 4,
                                        right: 4,
                                        zIndex: 1
                                    }}>
                                        {status === 'completed' && (
                                            <CheckCircleIcon sx={{
                                                color: '#10b981',
                                                fontSize: '14px',
                                                filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))'
                                            }} />
                                        )}
                                        {status === 'failed' && (
                                            <ErrorIcon sx={{
                                                color: '#ef4444',
                                                fontSize: '14px',
                                                filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))'
                                            }} />
                                        )}
                                        {status === 'loading' && isCurrentlyFetching && (
                                            <Box
                                                sx={{
                                                    width: 14,
                                                    height: 14,
                                                    borderRadius: '50%',
                                                    border: '2px solid #e5e7eb',
                                                    borderTop: '2px solid #3b82f6',
                                                    animation: 'spin 1s linear infinite'
                                                }}
                                            />
                                        )}
                                    </Box>

                                    {/* Subtle Active Glow */}
                                    {isCurrentlyFetching && (
                                        <Box
                                            sx={{
                                                position: 'absolute',
                                                top: -1,
                                                left: -1,
                                                right: -1,
                                                bottom: -1,
                                                borderRadius: '12px',
                                                background: 'linear-gradient(45deg, transparent, rgba(59, 130, 246, 0.1), transparent)',
                                                backgroundSize: '400% 400%',
                                                animation: 'shimmer 2s ease-in-out infinite',
                                                pointerEvents: 'none',
                                                zIndex: 0
                                            }}
                                        />
                                    )}
                                </Box>
                            </Fade>
                        );
                    })}
                </Box>
            )}

            {/* Compact Results Summary */}
            {(completedCount > 0 || failedCount > 0) && (
                <Box sx={{
                    mt: 2,
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 1,
                    flexWrap: 'wrap'
                }}>
                    {completedCount > 0 && (
                        <Chip
                            icon={<CheckCircleIcon sx={{ fontSize: '12px' }} />}
                            label={`${completedCount} successful`}
                            sx={{
                                fontSize: '10px',
                                height: '20px',
                                backgroundColor: '#dcfce7',
                                color: '#166534',
                                border: 'none',
                                '& .MuiChip-icon': {
                                    color: '#166534'
                                }
                            }}
                            size="small"
                        />
                    )}
                    {failedCount > 0 && (
                        <Chip
                            icon={<ErrorIcon sx={{ fontSize: '12px' }} />}
                            label={`${failedCount} failed`}
                            sx={{
                                fontSize: '10px',
                                height: '20px',
                                backgroundColor: '#fee2e2',
                                color: '#991b1b',
                                border: 'none',
                                '& .MuiChip-icon': {
                                    color: '#991b1b'
                                }
                            }}
                            size="small"
                        />
                    )}
                </Box>
            )}

            {/* CSS Animations */}
            <style jsx>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                @keyframes shimmer {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
            `}</style>
        </Box>
    );
};

export default CarrierLoadingDisplay; 