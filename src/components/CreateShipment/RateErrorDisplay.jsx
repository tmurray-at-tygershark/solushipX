import React from 'react';
import { Box, Typography, Button, Card, CardContent, Alert, Chip } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import EditIcon from '@mui/icons-material/Edit';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';

const RateErrorDisplay = ({
    error,
    failedCarriers = [],
    onRetry,
    onEditShipment,
    onContactSupport,
    hasPartialResults = false
}) => {
    const getErrorType = (errorMessage) => {
        if (errorMessage.includes('No carriers are configured')) return 'no-carriers';
        if (errorMessage.includes('No rates available')) return 'no-rates';
        if (errorMessage.includes('network') || errorMessage.includes('timeout')) return 'network';
        return 'general';
    };

    const getErrorContent = (errorType) => {
        switch (errorType) {
            case 'no-carriers':
                return {
                    icon: '🏢',
                    title: 'No Carriers Configured',
                    message: 'Your company needs to set up carrier connections before we can fetch rates.',
                    suggestions: [
                        'Contact your administrator to configure carrier connections',
                        'Visit the Carriers page to set up integrations',
                        'Reach out to our support team for assistance'
                    ]
                };
            case 'no-rates':
                return {
                    icon: '🚫',
                    title: 'No Rates Found',
                    message: 'We couldn\'t find any shipping rates for this route, but we\'re working on expanding our network!',
                    suggestions: [
                        'Try adjusting the package dimensions or weight',
                        'Check if the addresses are correct',
                        'Consider different shipping dates',
                        'Contact support for alternative options'
                    ]
                };
            case 'network':
                return {
                    icon: '🌐',
                    title: 'Connection Issue',
                    message: 'We\'re having trouble reaching some carriers right now.',
                    suggestions: [
                        'Check your internet connection',
                        'Try again in a few moments',
                        'Contact support if the issue persists'
                    ]
                };
            default:
                return {
                    icon: '⚠️',
                    title: 'Something Went Wrong',
                    message: 'We encountered an unexpected issue while fetching rates.',
                    suggestions: [
                        'Try refreshing and calculating rates again',
                        'Check your shipment details',
                        'Contact our support team if the problem continues'
                    ]
                };
        }
    };

    const errorType = getErrorType(error);
    const errorContent = getErrorContent(errorType);

    return (
        <Box sx={{ maxWidth: 600, mx: 'auto', textAlign: 'center' }}>
            {/* Partial Results Banner */}
            {hasPartialResults && (
                <Alert
                    severity="warning"
                    sx={{ mb: 3, borderRadius: 2 }}
                    action={
                        <Button
                            color="inherit"
                            size="small"
                            onClick={onRetry}
                            startIcon={<RefreshIcon />}
                        >
                            Retry
                        </Button>
                    }
                >
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Some carriers didn't respond, but we found rates from others below.
                    </Typography>
                </Alert>
            )}

            {/* Main Error Card */}
            {!hasPartialResults && (
                <Card
                    elevation={3}
                    sx={{
                        borderRadius: 3,
                        background: 'linear-gradient(135deg, #fef2f2 0%, #ffffff 100%)',
                        border: '1px solid #fecaca'
                    }}
                >
                    <CardContent sx={{ p: 4 }}>
                        {/* Error Icon */}
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="h1" sx={{ fontSize: '4rem', mb: 1 }}>
                                {errorContent.icon}
                            </Typography>
                            <ErrorOutlineIcon sx={{ color: 'error.main', fontSize: '2rem' }} />
                        </Box>

                        {/* Error Title */}
                        <Typography
                            variant="h4"
                            sx={{
                                fontWeight: 700,
                                color: 'error.dark',
                                mb: 2
                            }}
                        >
                            {errorContent.title}
                        </Typography>

                        {/* Error Message */}
                        <Typography
                            variant="body1"
                            sx={{
                                color: 'text.secondary',
                                mb: 3,
                                fontSize: '1.1rem',
                                lineHeight: 1.6
                            }}
                        >
                            {errorContent.message}
                        </Typography>

                        {/* Failed Carriers */}
                        {failedCarriers.length > 0 && (
                            <Box sx={{ mb: 3 }}>
                                <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                                    Carriers that didn't respond:
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, justifyContent: 'center' }}>
                                    {failedCarriers.map((carrier, index) => (
                                        <Chip
                                            key={index}
                                            label={carrier.name || carrier}
                                            color="error"
                                            variant="outlined"
                                            size="small"
                                        />
                                    ))}
                                </Box>
                            </Box>
                        )}

                        {/* Suggestions */}
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2, color: 'text.primary' }}>
                                What you can do:
                            </Typography>
                            <Box sx={{ textAlign: 'left', maxWidth: 400, mx: 'auto' }}>
                                {errorContent.suggestions.map((suggestion, index) => (
                                    <Box key={index} sx={{ display: 'flex', alignItems: 'flex-start', mb: 1.5 }}>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                color: 'primary.main',
                                                fontWeight: 700,
                                                mr: 1,
                                                minWidth: '20px'
                                            }}
                                        >
                                            {index + 1}.
                                        </Typography>
                                        <Typography
                                            variant="body2"
                                            sx={{
                                                color: 'text.secondary',
                                                fontSize: '12px',
                                                lineHeight: 1.5
                                            }}
                                        >
                                            {suggestion}
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        </Box>

                        {/* Action Buttons */}
                        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                            {onRetry && (
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={onRetry}
                                    startIcon={<RefreshIcon />}
                                    sx={{
                                        px: 3,
                                        py: 1,
                                        borderRadius: 2,
                                        fontWeight: 600
                                    }}
                                >
                                    Try Again
                                </Button>
                            )}

                            {onEditShipment && (
                                <Button
                                    variant="outlined"
                                    color="primary"
                                    onClick={onEditShipment}
                                    startIcon={<EditIcon />}
                                    sx={{
                                        px: 3,
                                        py: 1,
                                        borderRadius: 2,
                                        fontWeight: 600
                                    }}
                                >
                                    Edit Shipment
                                </Button>
                            )}

                            {onContactSupport && (
                                <Button
                                    variant="outlined"
                                    color="secondary"
                                    onClick={onContactSupport}
                                    startIcon={<SupportAgentIcon />}
                                    sx={{
                                        px: 3,
                                        py: 1,
                                        borderRadius: 2,
                                        fontWeight: 600
                                    }}
                                >
                                    Contact Support
                                </Button>
                            )}
                        </Box>

                        {/* Technical Error Details (Collapsible) */}
                        {error && (
                            <Box sx={{ mt: 3, pt: 2, borderTop: '1px solid #e5e7eb' }}>
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: 'text.tertiary',
                                        fontSize: '10px',
                                        fontFamily: 'monospace',
                                        wordBreak: 'break-all'
                                    }}
                                >
                                    Technical details: {error}
                                </Typography>
                            </Box>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Empty State for No Carriers */}
            {errorType === 'no-carriers' && (
                <Box sx={{ mt: 4, p: 3, borderRadius: 2, bgcolor: 'grey.50' }}>
                    <LocalShippingIcon sx={{ fontSize: '3rem', color: 'grey.400', mb: 2 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600, color: 'text.secondary', mb: 1 }}>
                        Ready to Ship?
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'text.tertiary', fontSize: '12px' }}>
                        Once your carriers are configured, you'll see competitive rates from multiple providers right here.
                    </Typography>
                </Box>
            )}
        </Box>
    );
};

export default RateErrorDisplay; 