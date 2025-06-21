import React from 'react';
import {
    Box,
    Typography,
    IconButton,
    Button
} from '@mui/material';
import {
    ArrowBackIosNew as ArrowBackIcon,
    Close as CloseIcon
} from '@mui/icons-material';

const ModalHeader = ({
    title = '',
    onBack = null,
    onClose = null,
    showBackButton = false,
    showCloseButton = false,
    backButtonText = 'Back',
    // New navigation stack props
    navigationStack = [],
    currentNavigationIndex = 0,
    onNavigationBack = null,
    // Alternative: single navigation object
    navigation = null
}) => {
    // Determine the effective title and back button state
    const getEffectiveTitle = () => {
        if (navigation) {
            return navigation.title || title;
        }
        if (navigationStack.length > 0 && navigationStack[currentNavigationIndex]) {
            return navigationStack[currentNavigationIndex].title;
        }
        return title;
    };

    const getEffectiveBackButton = () => {
        if (navigation) {
            return navigation.canGoBack;
        }
        if (navigationStack.length > 0) {
            return currentNavigationIndex > 0;
        }
        // Only show back button if explicitly requested
        return showBackButton;
    };

    const handleBackClick = () => {
        if (navigation && navigation.onBack) {
            navigation.onBack();
        } else if (onNavigationBack) {
            onNavigationBack();
        } else if (onBack) {
            onBack();
        }
    };

    const getBackButtonText = () => {
        if (navigation && navigation.backText) {
            return navigation.backText;
        }
        if (navigationStack.length > 0 && currentNavigationIndex > 0) {
            return navigationStack[currentNavigationIndex - 1]?.shortTitle || 'Back';
        }
        return backButtonText;
    };

    return (
        <Box
            sx={{
                position: 'sticky',
                top: 0,
                left: 0,
                right: 0,
                zIndex: 1000,
                backgroundColor: 'white',
                borderBottom: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
                px: 3,
                py: 2
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%'
                }}
            >
                {/* Left Side - Back Button + Logo + Title */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                    {/* Back Button - now appears to the left of logo when needed */}
                    {getEffectiveBackButton() && (
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<ArrowBackIcon sx={{ fontSize: 16 }} />}
                            onClick={handleBackClick}
                            sx={{
                                color: '#64748b',
                                borderColor: '#e2e8f0',
                                fontSize: '0.875rem',
                                py: 0.5,
                                px: 1.5,
                                minWidth: 'auto',
                                '&:hover': {
                                    borderColor: '#cbd5e1',
                                    backgroundColor: '#f8fafc'
                                }
                            }}
                        >
                            {getBackButtonText()}
                        </Button>
                    )}

                    {/* SolushipX Logo - clickable to close modal */}
                    <Box
                        component="img"
                        src="/images/integratedcarrriers_logo_blk.png"
                        alt="SolushipX"
                        onClick={onClose}
                        sx={{
                            height: 32,
                            width: 'auto',
                            objectFit: 'contain',
                            cursor: onClose ? 'pointer' : 'default',
                            transition: 'opacity 0.2s ease-in-out',
                            '&:hover': onClose ? {
                                opacity: 0.8
                            } : {}
                        }}
                    />

                    {/* Page Title - dynamically updates based on navigation */}
                    <Typography
                        variant="h6"
                        component="h1"
                        sx={{
                            fontWeight: 600,
                            color: '#1e293b',
                            fontSize: '1.125rem',
                            lineHeight: 1.2
                        }}
                    >
                        {getEffectiveTitle()}
                    </Typography>

                    {/* Navigation Breadcrumb - shows current path */}
                    {navigationStack.length > 1 && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 2 }}>
                            {navigationStack.slice(0, currentNavigationIndex + 1).map((nav, index) => (
                                <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    {index > 0 && (
                                        <Typography variant="body2" sx={{ color: '#9ca3af' }}>
                                            /
                                        </Typography>
                                    )}
                                    <Typography
                                        variant="body2"
                                        sx={{
                                            color: index === currentNavigationIndex ? '#1e293b' : '#6b7280',
                                            fontWeight: index === currentNavigationIndex ? 500 : 400
                                        }}
                                    >
                                        {nav.shortTitle || nav.title}
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                    )}
                </Box>

                {/* Right Side - Close Button */}
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {showCloseButton && onClose && (
                        <IconButton
                            onClick={onClose}
                            sx={{
                                color: 'white',
                                backgroundColor: '#1c277d', // Navy blue background
                                '&:hover': {
                                    backgroundColor: '#1a237e', // Darker navy on hover
                                },
                                p: 1
                            }}
                            aria-label="Close"
                        >
                            <CloseIcon sx={{ fontSize: 20 }} />
                        </IconButton>
                    )}
                </Box>
            </Box>
        </Box>
    );
};

export default ModalHeader; 