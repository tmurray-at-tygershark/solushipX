import React, { useState, useEffect } from "react";
import {
    Snackbar,
    Box,
    Typography,
    IconButton,
    Button,
    Collapse,
    Paper,
    useTheme,
    alpha,
    Slide
} from '@mui/material';
import {
    Close as CloseIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon
} from '@mui/icons-material';
import { keyframes } from '@mui/system';

// Animation keyframes
const slideInRight = keyframes`
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

const slideOutRight = keyframes`
  from {
    transform: translateX(0);
    opacity: 1;
  }
  to {
    transform: translateX(100%);
    opacity: 0;
  }
`;

const emojiPop = keyframes`
  0% {
    transform: scale(0) rotate(-180deg);
    opacity: 0;
  }
  50% {
    transform: scale(1.2) rotate(10deg);
  }
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 1;
  }
`;

const NotificationSnackbar = ({ notification, onClose }) => {
    const theme = useTheme();
    const [expanded, setExpanded] = useState(false);
    const [isExiting, setIsExiting] = useState(false);
    const [mounted, setMounted] = useState(false);

    const {
        message,
        type,
        theme: notificationTheme,
        emoji,
        duration,
        action,
        position = { vertical: 'bottom', horizontal: 'right' },
        variant = 'filled',
        details,
        title
    } = notification;

    // Ensure component is mounted before showing
    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    // Handle auto-hide
    useEffect(() => {
        if (duration && duration > 0) {
            const timer = setTimeout(() => {
                handleClose();
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [duration]);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => {
            onClose();
        }, 300);
    };

    const handleExpand = (event) => {
        event.stopPropagation();
        setExpanded(!expanded);
    };

    // Custom styled alert component
    const StyledAlert = ({ children, ...props }) => (
        <Paper
            elevation={8}
            sx={{
                position: 'relative',
                overflow: 'hidden',
                borderRadius: 2,
                minWidth: 320,
                maxWidth: 500,
                animation: isExiting
                    ? `${slideOutRight} 0.3s ease-in-out forwards`
                    : `${slideInRight} 0.3s ease-in-out`,
                background: `linear-gradient(135deg, ${notificationTheme.bgcolor} 0%, ${alpha(notificationTheme.bgcolor, 0.9)} 100%)`,
                border: `1px solid ${alpha(notificationTheme.borderColor, 0.3)}`,
                backdropFilter: 'blur(10px)',
                '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: `linear-gradient(90deg, transparent, ${notificationTheme.iconBgcolor}, transparent)`,
                    animation: 'shimmer 2s infinite'
                },
                '@keyframes shimmer': {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(100%)' }
                }
            }}
            {...props}
        >
            <Box sx={{ p: 2 }}>
                {/* Header with emoji and close button */}
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                    {/* Animated Emoji */}
                    <Box
                        sx={{
                            fontSize: '1.5rem',
                            animation: `${emojiPop} 0.5s ease-out`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 40,
                            height: 40,
                            borderRadius: '50%',
                            bgcolor: alpha(notificationTheme.iconBgcolor, 0.2),
                            flexShrink: 0
                        }}
                    >
                        {emoji}
                    </Box>

                    {/* Content */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        {title && (
                            <Typography
                                variant="subtitle2"
                                sx={{
                                    color: notificationTheme.color,
                                    fontWeight: 600,
                                    mb: 0.5,
                                    opacity: 0.9
                                }}
                            >
                                {title}
                            </Typography>
                        )}
                        <Typography
                            variant="body2"
                            sx={{
                                color: notificationTheme.color,
                                fontWeight: 500,
                                wordBreak: 'break-word'
                            }}
                        >
                            {message}
                        </Typography>

                        {/* Details section */}
                        {details && (
                            <Collapse in={expanded} timeout="auto">
                                <Typography
                                    variant="caption"
                                    sx={{
                                        color: alpha(notificationTheme.color, 0.8),
                                        display: 'block',
                                        mt: 1,
                                        p: 1,
                                        bgcolor: alpha('#000', 0.1),
                                        borderRadius: 1
                                    }}
                                >
                                    {details}
                                </Typography>
                            </Collapse>
                        )}

                        {/* Action button */}
                        {action && (
                            <Box sx={{ mt: 1.5 }}>
                                <Button
                                    size="small"
                                    onClick={action.onClick}
                                    sx={{
                                        color: notificationTheme.color,
                                        borderColor: alpha(notificationTheme.color, 0.5),
                                        bgcolor: alpha(notificationTheme.color, 0.1),
                                        '&:hover': {
                                            bgcolor: alpha(notificationTheme.color, 0.2),
                                            borderColor: notificationTheme.color
                                        }
                                    }}
                                    variant="outlined"
                                >
                                    {action.label}
                                </Button>
                            </Box>
                        )}
                    </Box>

                    {/* Controls */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                        {details && (
                            <IconButton
                                size="small"
                                onClick={handleExpand}
                                sx={{
                                    color: alpha(notificationTheme.color, 0.8),
                                    '&:hover': {
                                        bgcolor: alpha(notificationTheme.color, 0.1)
                                    }
                                }}
                            >
                                {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                            </IconButton>
                        )}
                        <IconButton
                            size="small"
                            onClick={handleClose}
                            sx={{
                                color: alpha(notificationTheme.color, 0.8),
                                '&:hover': {
                                    bgcolor: alpha(notificationTheme.color, 0.1)
                                }
                            }}
                        >
                            <CloseIcon fontSize="small" />
                        </IconButton>
                    </Box>
                </Box>

                {/* Progress bar for auto-hide */}
                {duration && duration > 0 && (
                    <Box
                        sx={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            height: 3,
                            bgcolor: alpha('#000', 0.1),
                            overflow: 'hidden'
                        }}
                    >
                        <Box
                            sx={{
                                height: '100%',
                                bgcolor: notificationTheme.iconBgcolor,
                                animation: `progress ${duration}ms linear`,
                                '@keyframes progress': {
                                    from: { width: '100%' },
                                    to: { width: '0%' }
                                }
                            }}
                        />
                    </Box>
                )}
            </Box>
        </Paper>
    );

    return (
        <Snackbar
            open={mounted}
            anchorOrigin={position}
            TransitionComponent={Slide}
            TransitionProps={{
                direction: position.horizontal === 'left' ? 'right' : 'left'
            }}
            sx={{
                '& .MuiSnackbar-root': {
                    position: 'fixed',
                    zIndex: theme.zIndex.snackbar + 100
                }
            }}
        >
            <StyledAlert />
        </Snackbar>
    );
};

export default NotificationSnackbar;
