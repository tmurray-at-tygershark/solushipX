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

                // Initialize service if not already done
                await dynamicStatusService.initialize();

                // Get status display configuration
                const display = dynamicStatusService.getStatusDisplay(status);
                setStatusDisplay(display);

            } catch (err) {
                console.error('Error initializing status display:', err);
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };

        if (status) {
            initializeStatus();
        } else {
            setLoading(false);
        }
    }, [status]);

    // Determine final display mode
    const getFinalDisplayMode = () => {
        if (displayMode !== 'auto') return displayMode;

        if (!statusDisplay) return 'master';

        return dynamicStatusService.getDisplayMode(status);
    };

    // Get size configurations
    const getSizeConfig = () => {
        const configs = {
            small: {
                chipHeight: 24,
                fontSize: '11px',
                padding: '4px 8px',
                subFontSize: '10px',
                gap: 0.5
            },
            medium: {
                chipHeight: 32,
                fontSize: '13px',
                padding: '6px 12px',
                subFontSize: '11px',
                gap: 0.75
            },
            large: {
                chipHeight: 40,
                fontSize: '14px',
                padding: '8px 16px',
                subFontSize: '12px',
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
                sx={{
                    backgroundColor: variant === 'filled' ? styling.backgroundColor : 'transparent',
                    color: variant === 'filled' ? styling.color : styling.backgroundColor,
                    border: variant === 'outlined' ? `1px solid ${styling.borderColor}` : 'none',
                    fontSize: sizeConfig.fontSize,
                    fontWeight: 600,
                    height: sizeConfig.chipHeight,
                    cursor: onClick ? 'pointer' : 'default',
                    '&:hover': onClick ? {
                        backgroundColor: variant === 'filled' ? styling.backgroundColor : styling.lightBackground,
                        transform: 'scale(1.02)'
                    } : {},
                    '& .MuiChip-label': {
                        padding: sizeConfig.padding
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
                            color: '#6b7280',
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
                    sx={{
                        backgroundColor: variant === 'filled' ? styling.backgroundColor : 'transparent',
                        color: variant === 'filled' ? styling.color : styling.backgroundColor,
                        border: variant === 'outlined' ? `1px solid ${styling.borderColor}` : 'none',
                        fontSize: sizeConfig.fontSize,
                        fontWeight: 600,
                        height: sizeConfig.chipHeight,
                        cursor: onClick ? 'pointer' : 'default',
                        '&:hover': onClick ? {
                            backgroundColor: variant === 'filled' ? styling.backgroundColor : styling.lightBackground,
                            transform: 'scale(1.02)'
                        } : {}
                    }}
                />

                {/* Sub-Status */}
                {subStatus && (
                    <Typography sx={{
                        fontSize: sizeConfig.subFontSize,
                        color: styling.backgroundColor,
                        fontWeight: 500,
                        backgroundColor: styling.lightBackground,
                        padding: '2px 6px',
                        borderRadius: '8px',
                        border: `1px solid ${styling.lightBorder}`,
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
    } else {
        return renderBoth();
    }
};

export default EnhancedStatusChip; 