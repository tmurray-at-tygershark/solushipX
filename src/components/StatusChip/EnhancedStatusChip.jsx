import React, { useState, useEffect } from 'react';
import { Box, Chip, Typography, Tooltip, Skeleton } from '@mui/material';
import dynamicStatusService from '../../services/DynamicStatusService';

/**
 * Enhanced StatusChip Component
 * Uses database-stored master statuses with colors and styling
 * Supports master-only and master+sub-status display modes
 */
const EnhancedStatusChip = ({
    status,                    // Current shipment status identifier
    size = 'small',           // 'small', 'medium', 'large'
    displayMode = 'auto',     // 'master', 'both', 'auto'
    showTooltip = true,       // Show tooltip with description
    variant = 'filled',       // 'filled', 'outlined'
    compact = false,          // Compact mode for tables
    className = '',
    onClick = null,
    disabled = false
}) => {
    const [statusDisplay, setStatusDisplay] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Initialize and fetch status data
    useEffect(() => {
        const initializeStatus = async () => {
            try {
                setLoading(true);
                setError(null);

<<<<<<< HEAD
                console.log(`[EnhancedStatusChip] Initializing for status: "${status}"`);

                // Check if status is already an enhanced status object
                if (typeof status === 'object' && status.masterStatus) {
                    console.log('[EnhancedStatusChip] Status is already an enhanced status object:', status);

                    // Use the provided enhanced status directly
                    const display = {
                        masterStatus: status.masterStatus,
                        subStatus: status.subStatus || null
                    };

                    setStatusDisplay(display);
                    setLoading(false);
                    return;
                }

                // Initialize service if not already done
                await dynamicStatusService.initialize();
                console.log('[EnhancedStatusChip] Service initialized successfully');

                // Get status display configuration
                const display = dynamicStatusService.getStatusDisplay(status);
                console.log(`[EnhancedStatusChip] Status display result:`, display);

                if (display && display.masterStatus) {
                    console.log(`[EnhancedStatusChip] Master status found:`, {
                        label: display.masterStatus.label,
                        displayLabel: display.masterStatus.displayLabel,
                        color: display.masterStatus.color,
                        fontColor: display.masterStatus.fontColor
                    });
                } else {
                    console.warn(`[EnhancedStatusChip] No valid status display found for: "${status}"`);
                }

                setStatusDisplay(display);

            } catch (err) {
                console.error('[EnhancedStatusChip] Error initializing status display:', err);
=======
                // Initialize service if not already done
                await dynamicStatusService.initialize();

                // Get status display configuration
                const display = dynamicStatusService.getStatusDisplay(status);
                setStatusDisplay(display);

            } catch (err) {
                console.error('Error initializing status display:', err);
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (status) {
            initializeStatus();
        } else {
<<<<<<< HEAD
            console.warn('[EnhancedStatusChip] No status provided');
=======
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
            setLoading(false);
        }
    }, [status]);

    // Determine final display mode
    const getFinalDisplayMode = () => {
        if (displayMode !== 'auto') return displayMode;

        if (!statusDisplay) return 'master';

<<<<<<< HEAD
        // If status is an enhanced object with subStatus, show both
        if (typeof status === 'object' && status.subStatus) {
            return 'both';
        }

=======
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
        return dynamicStatusService.getDisplayMode(status);
    };

    // Get size configurations
    const getSizeConfig = () => {
        const configs = {
            small: {
                chipHeight: 24,
                fontSize: '11px',
                padding: '4px 8px',
<<<<<<< HEAD
                subFontSize: '9px', // Even smaller for better hierarchy
=======
                subFontSize: '10px',
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
                gap: 0.5
            },
            medium: {
                chipHeight: 32,
                fontSize: '13px',
                padding: '6px 12px',
<<<<<<< HEAD
                subFontSize: '10px', // Smaller for hierarchy
=======
                subFontSize: '11px',
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
                gap: 0.75
            },
            large: {
                chipHeight: 40,
                fontSize: '14px',
                padding: '8px 16px',
<<<<<<< HEAD
                subFontSize: '11px', // Smaller for hierarchy
=======
                subFontSize: '12px',
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
                gap: 1
            }
        };
        return configs[size] || configs.small;
    };

    // Loading state
    if (loading) {
        const sizeConfig = getSizeConfig();
        return (
            <Skeleton
                variant="rectangular"
                width={80}
                height={sizeConfig.chipHeight}
                sx={{ borderRadius: '12px' }}
            />
        );
    }

    // Error state
    if (error || !statusDisplay) {
        return (
            <Chip
                label="Unknown"
                size={size}
                sx={{
                    backgroundColor: '#6b7280',
                    color: '#ffffff',
                    fontSize: getSizeConfig().fontSize
                }}
            />
        );
    }

    const { masterStatus, subStatus } = statusDisplay;
    const finalDisplayMode = getFinalDisplayMode();
    const sizeConfig = getSizeConfig();

    // Get styling from database
    const styling = {
        backgroundColor: masterStatus.color,
        color: masterStatus.fontColor,
        borderColor: masterStatus.color,
        lightBackground: masterStatus.color + '20',
        lightBorder: masterStatus.color + '40'
    };

<<<<<<< HEAD
    // DEBUG: Log the actual styling values
    console.log(`[EnhancedStatusChip] Styling for "${status}":`, {
        masterStatusLabel: masterStatus.label,
        masterStatusDisplayLabel: masterStatus.displayLabel,
        backgroundColor: styling.backgroundColor,
        fontColor: styling.color,
        variant: variant,
        finalDisplayMode: finalDisplayMode
    });

=======
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
    // Render master status only
    const renderMasterOnly = () => {
        const chipElement = (
            <Chip
                label={masterStatus.displayLabel}
                size={size}
                variant={variant}
                disabled={disabled}
                onClick={onClick}
                className={className}
<<<<<<< HEAD
                color="default" // Force default to prevent theme color overrides
                style={{
                    // Use inline styles for maximum specificity
                    backgroundColor: variant === 'filled' ? styling.backgroundColor : 'transparent',
                    color: variant === 'filled' ? styling.color : styling.backgroundColor,
                    border: variant === 'outlined' ? `1px solid ${styling.borderColor}` : 'none'
                }}
                sx={{
=======
                sx={{
                    backgroundColor: variant === 'filled' ? styling.backgroundColor : 'transparent',
                    color: variant === 'filled' ? styling.color : styling.backgroundColor,
                    border: variant === 'outlined' ? `1px solid ${styling.borderColor}` : 'none',
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
                    fontSize: sizeConfig.fontSize,
                    fontWeight: 600,
                    height: sizeConfig.chipHeight,
                    cursor: onClick ? 'pointer' : 'default',
                    '&:hover': onClick ? {
<<<<<<< HEAD
                        backgroundColor: variant === 'filled' ? `${styling.backgroundColor} !important` : `${styling.lightBackground} !important`,
                        transform: 'scale(1.02)'
                    } : {},
                    '& .MuiChip-label': {
                        padding: sizeConfig.padding,
                        color: `${variant === 'filled' ? styling.color : styling.backgroundColor} !important`,
                        fontSize: sizeConfig.fontSize
                    },
                    // AGGRESSIVE OVERRIDES - Maximum specificity
                    '&.MuiChip-root': {
                        backgroundColor: `${variant === 'filled' ? styling.backgroundColor : 'transparent'} !important`,
                        color: `${variant === 'filled' ? styling.color : styling.backgroundColor} !important`
                    },
                    '&.MuiChip-filled': {
                        backgroundColor: `${styling.backgroundColor} !important`,
                        color: `${styling.color} !important`
                    },
                    '&.MuiChip-outlined': {
                        backgroundColor: 'transparent !important',
                        color: `${styling.backgroundColor} !important`,
                        border: `1px solid ${styling.borderColor} !important`
                    },
                    '&.MuiChip-colorDefault': {
                        backgroundColor: `${variant === 'filled' ? styling.backgroundColor : 'transparent'} !important`,
                        color: `${variant === 'filled' ? styling.color : styling.backgroundColor} !important`
                    },
                    // Target the label specifically
                    '& .MuiChip-label.MuiChip-labelSmall': {
                        color: `${variant === 'filled' ? styling.color : styling.backgroundColor} !important`
                    },
                    '& .MuiChip-label.MuiChip-labelMedium': {
                        color: `${variant === 'filled' ? styling.color : styling.backgroundColor} !important`
=======
                        backgroundColor: variant === 'filled' ? styling.backgroundColor : styling.lightBackground,
                        transform: 'scale(1.02)'
                    } : {},
                    '& .MuiChip-label': {
                        padding: sizeConfig.padding
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
                    }
                }}
            />
        );

        if (showTooltip && masterStatus.description) {
            return (
                <Tooltip title={masterStatus.description} placement="top" arrow>
                    {chipElement}
                </Tooltip>
            );
        }

        return chipElement;
    };

    // Render master + sub-status
    const renderBoth = () => {
        if (compact) {
            // Compact mode for tables
            const element = (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {/* Color indicator dot */}
                    <Box sx={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        backgroundColor: styling.backgroundColor,
                        flexShrink: 0
                    }} />

                    {/* Status text */}
                    <Typography sx={{
                        fontSize: sizeConfig.fontSize,
                        fontWeight: 600,
                        color: styling.backgroundColor
                    }}>
                        {masterStatus.displayLabel}
                    </Typography>

                    {/* Sub-status if exists */}
                    {subStatus && (
                        <Typography sx={{
                            fontSize: sizeConfig.subFontSize,
<<<<<<< HEAD
                            color: masterStatus.fontColor, // Use master status text color - same as master
=======
                            color: '#6b7280',
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
                            fontStyle: 'italic'
                        }}>
                            • {subStatus.statusLabel}
                        </Typography>
                    )}
                </Box>
            );

            if (showTooltip) {
                const tooltipContent = (
                    <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {masterStatus.displayLabel}
                        </Typography>
                        {subStatus && (
                            <Typography variant="body2" sx={{ fontSize: '12px', mt: 0.5 }}>
                                {subStatus.statusMeaning}
                            </Typography>
                        )}
                    </Box>
                );

                return (
                    <Tooltip title={tooltipContent} placement="top" arrow>
                        {element}
                    </Tooltip>
                );
            }

            return element;
        }

        // Full mode - stacked display
        const element = (
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: sizeConfig.gap,
                alignItems: 'flex-start'
            }}>
                {/* Master Status Chip */}
                <Chip
                    label={masterStatus.displayLabel}
                    size={size}
                    variant={variant}
                    disabled={disabled}
                    onClick={onClick}
<<<<<<< HEAD
                    color="default" // Force default to prevent theme color overrides
                    sx={{
                        backgroundColor: variant === 'filled' ? `${styling.backgroundColor} !important` : 'transparent',
                        color: variant === 'filled' ? `${styling.color} !important` : `${styling.backgroundColor} !important`,
                        border: variant === 'outlined' ? `1px solid ${styling.borderColor} !important` : 'none',
=======
                    sx={{
                        backgroundColor: variant === 'filled' ? styling.backgroundColor : 'transparent',
                        color: variant === 'filled' ? styling.color : styling.backgroundColor,
                        border: variant === 'outlined' ? `1px solid ${styling.borderColor}` : 'none',
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
                        fontSize: sizeConfig.fontSize,
                        fontWeight: 600,
                        height: sizeConfig.chipHeight,
                        cursor: onClick ? 'pointer' : 'default',
                        '&:hover': onClick ? {
<<<<<<< HEAD
                            backgroundColor: variant === 'filled' ? `${styling.backgroundColor} !important` : `${styling.lightBackground} !important`,
                            transform: 'scale(1.02)'
                        } : {},
                        '& .MuiChip-label': {
                            color: variant === 'filled' ? `${styling.color} !important` : `${styling.backgroundColor} !important`
                        },
                        // Override Material-UI default classes
                        '&.MuiChip-filled': {
                            backgroundColor: `${styling.backgroundColor} !important`,
                            color: `${styling.color} !important`
                        },
                        '&.MuiChip-outlined': {
                            backgroundColor: 'transparent !important',
                            color: `${styling.backgroundColor} !important`,
                            border: `1px solid ${styling.borderColor} !important`
                        },
                        '&.MuiChip-colorDefault': {
                            backgroundColor: variant === 'filled' ? `${styling.backgroundColor} !important` : 'transparent !important',
                            color: variant === 'filled' ? `${styling.color} !important` : `${styling.backgroundColor} !important`
                        }
=======
                            backgroundColor: variant === 'filled' ? styling.backgroundColor : styling.lightBackground,
                            transform: 'scale(1.02)'
                        } : {}
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
                    }}
                />

                {/* Sub-Status */}
                {subStatus && (
                    <Typography sx={{
                        fontSize: sizeConfig.subFontSize,
<<<<<<< HEAD
                        color: masterStatus.fontColor, // Use master status text color
                        fontWeight: 500,
                        backgroundColor: masterStatus.color, // Use master status background color
                        padding: '2px 6px',
                        borderRadius: '8px',
                        border: `1px solid ${masterStatus.color}`, // Same color border
=======
                        color: styling.backgroundColor,
                        fontWeight: 500,
                        backgroundColor: styling.lightBackground,
                        padding: '2px 6px',
                        borderRadius: '8px',
                        border: `1px solid ${styling.lightBorder}`,
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
                        whiteSpace: 'nowrap'
                    }}>
                        {subStatus.statusLabel}
                    </Typography>
                )}
            </Box>
        );

        if (showTooltip) {
            const tooltipContent = (
                <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {masterStatus.displayLabel}
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '11px', opacity: 0.8 }}>
                        {masterStatus.description}
                    </Typography>
                    {subStatus && (
                        <>
                            <Typography variant="body2" sx={{ fontWeight: 600, mt: 1 }}>
                                {subStatus.statusLabel}
                            </Typography>
                            <Typography variant="body2" sx={{ fontSize: '11px', opacity: 0.8 }}>
                                {subStatus.statusMeaning}
                            </Typography>
                        </>
                    )}
                </Box>
            );

            return (
                <Tooltip title={tooltipContent} placement="top" arrow>
                    {element}
                </Tooltip>
            );
        }

        return element;
    };

    // Render based on display mode
    if (finalDisplayMode === 'master' || !subStatus) {
        return renderMasterOnly();
<<<<<<< HEAD
    } else if (finalDisplayMode === 'sub' || finalDisplayMode === 'sub-only') {
        // Render only sub-status as a chip with master status colors
        const chipElement = (
            <Chip
                label={subStatus.statusLabel}
                size={size}
                variant={variant}
                disabled={disabled}
                onClick={onClick}
                className={className}
                color="default" // Force default to prevent theme color overrides
                style={{
                    // Use master status colors for sub-status chip
                    backgroundColor: variant === 'filled' ? styling.backgroundColor : 'transparent',
                    color: variant === 'filled' ? styling.color : styling.backgroundColor,
                    border: variant === 'outlined' ? `1px solid ${styling.borderColor}` : 'none'
                }}
                sx={{
                    fontSize: sizeConfig.subFontSize,
                    fontWeight: 400, // Lighter weight for visual hierarchy
                    height: sizeConfig.chipHeight * 0.8, // Slightly smaller than master
                    cursor: onClick ? 'pointer' : 'default',
                    '&:hover': onClick ? {
                        backgroundColor: variant === 'filled' ? `${styling.backgroundColor} !important` : `${styling.lightBackground} !important`,
                        transform: 'scale(1.02)'
                    } : {},
                    '& .MuiChip-label': {
                        padding: sizeConfig.padding,
                        color: `${variant === 'filled' ? styling.color : styling.backgroundColor} !important`,
                        fontSize: sizeConfig.subFontSize
                    },
                    // AGGRESSIVE OVERRIDES - Maximum specificity
                    '&.MuiChip-root': {
                        backgroundColor: `${variant === 'filled' ? styling.backgroundColor : 'transparent'} !important`,
                        color: `${variant === 'filled' ? styling.color : styling.backgroundColor} !important`
                    },
                    '&.MuiChip-filled': {
                        backgroundColor: `${styling.backgroundColor} !important`,
                        color: `${styling.color} !important`
                    },
                    '&.MuiChip-outlined': {
                        backgroundColor: 'transparent !important',
                        color: `${styling.backgroundColor} !important`,
                        border: `1px solid ${styling.borderColor} !important`
                    },
                    '&.MuiChip-colorDefault': {
                        backgroundColor: `${variant === 'filled' ? styling.backgroundColor : 'transparent'} !important`,
                        color: `${variant === 'filled' ? styling.color : styling.backgroundColor} !important`
                    },
                    // Target the label specifically
                    '& .MuiChip-label.MuiChip-labelSmall': {
                        color: `${variant === 'filled' ? styling.color : styling.backgroundColor} !important`
                    },
                    '& .MuiChip-label.MuiChip-labelMedium': {
                        color: `${variant === 'filled' ? styling.color : styling.backgroundColor} !important`
                    }
                }}
            />
        );

        if (showTooltip && subStatus.statusMeaning) {
            return (
                <Tooltip title={subStatus.statusMeaning} placement="top" arrow>
                    {chipElement}
                </Tooltip>
            );
        }

        return chipElement;
=======
>>>>>>> c0e02a1c3ec0a73a452d45f7a8a3116c12d1d4df
    } else {
        return renderBoth();
    }
};

export default EnhancedStatusChip; 