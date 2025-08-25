import React, { useState, useCallback } from 'react';
import {
    Box,
    Typography,
    IconButton,
    Tooltip,
    Chip,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Divider
} from '@mui/material';
import {
    Edit as EditIcon,
    Delete as DeleteIcon,
    Check as CheckIcon,
    Close as CloseIcon,
    Add as AddIcon,
    Psychology as AIIcon
} from '@mui/icons-material';

const ANNOTATION_COLORS = {
    'carrier_logo': '#2196F3',      // Blue
    'invoice_number': '#FFEB3B',    // Yellow  
    'invoice_date': '#FF9800',      // Orange
    'total_amount': '#9C27B0',      // Purple
    'shipment_id': '#4CAF50',       // Green
    'tracking_number': '#00BCD4',   // Cyan
    'due_date': '#FF5722',          // Red-Orange
    'customer_info': '#795548',     // Brown
    'billing_address': '#607D8B',   // Blue Grey
    'service_type': '#E91E63'       // Pink
};

export default function BoundingBoxAnnotator({
    boundingBox,
    onUpdate,
    onDelete,
    editable = false,
    selected = false,
    onSelect
}) {
    const [contextMenu, setContextMenu] = useState(null);

    const handleContextMenu = (event) => {
        if (!editable) return;
        event.preventDefault();
        setContextMenu({
            mouseX: event.clientX - 2,
            mouseY: event.clientY - 4,
        });
    };

    const handleCloseContextMenu = () => {
        setContextMenu(null);
    };

    const handleEdit = () => {
        if (onUpdate) {
            onUpdate(boundingBox.id, { action: 'edit' });
        }
        handleCloseContextMenu();
    };

    const handleDelete = () => {
        if (onDelete) {
            onDelete(boundingBox.id);
        }
        handleCloseContextMenu();
    };

    const handleApprove = () => {
        if (onUpdate) {
            onUpdate(boundingBox.id, {
                action: 'approve',
                confidence: 1.0
            });
        }
        handleCloseContextMenu();
    };

    const handleReject = () => {
        if (onUpdate) {
            onUpdate(boundingBox.id, {
                action: 'reject',
                confidence: 0.0
            });
        }
        handleCloseContextMenu();
    };

    const getConfidenceColor = (confidence) => {
        if (confidence >= 0.8) return '#10b981'; // Green
        if (confidence >= 0.6) return '#f59e0b'; // Orange
        return '#ef4444'; // Red
    };

    const getFieldTypeColor = (type) => {
        return ANNOTATION_COLORS[type] || '#757575';
    };

    const confidencePercentage = Math.round(boundingBox.confidence * 100);
    const fieldColor = getFieldTypeColor(boundingBox.type);
    const confidenceColor = getConfidenceColor(boundingBox.confidence);

    return (
        <>
            <Box
                sx={{
                    position: 'relative',
                    border: `2px solid ${fieldColor}`,
                    backgroundColor: `${fieldColor}15`,
                    borderRadius: '4px',
                    cursor: editable ? 'pointer' : 'default',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': editable ? {
                        borderWidth: '3px',
                        backgroundColor: `${fieldColor}25`,
                        boxShadow: `0 0 0 2px ${fieldColor}40`
                    } : {},
                    ...(selected && {
                        boxShadow: `0 0 0 3px ${fieldColor}60`,
                        borderWidth: '3px'
                    })
                }}
                onClick={() => onSelect && onSelect(boundingBox.id)}
                onContextMenu={handleContextMenu}
            >
                {/* Field Type Label */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: -24,
                        left: 0,
                        zIndex: 10
                    }}
                >
                    <Chip
                        label={boundingBox.label || boundingBox.type}
                        size="small"
                        sx={{
                            backgroundColor: fieldColor,
                            color: 'white',
                            fontSize: '10px',
                            height: '20px',
                            fontWeight: 600,
                            '& .MuiChip-label': {
                                px: 1
                            }
                        }}
                    />
                </Box>

                {/* Confidence Badge */}
                <Box
                    sx={{
                        position: 'absolute',
                        top: -12,
                        right: -8,
                        zIndex: 10
                    }}
                >
                    <Chip
                        label={`${confidencePercentage}%`}
                        size="small"
                        sx={{
                            backgroundColor: confidenceColor,
                            color: 'white',
                            fontSize: '9px',
                            height: '16px',
                            minWidth: '32px',
                            fontWeight: 700,
                            '& .MuiChip-label': {
                                px: 0.5
                            }
                        }}
                    />
                </Box>

                {/* Value Display */}
                {boundingBox.value && (
                    <Box
                        sx={{
                            position: 'absolute',
                            bottom: -20,
                            left: 0,
                            right: 0,
                            zIndex: 10
                        }}
                    >
                        <Typography
                            sx={{
                                fontSize: '10px',
                                fontWeight: 600,
                                color: '#374151',
                                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                backdropFilter: 'blur(4px)',
                                px: 1,
                                py: 0.25,
                                borderRadius: '4px',
                                border: '1px solid #e5e7eb',
                                maxWidth: '200px',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap'
                            }}
                        >
                            {boundingBox.value}
                        </Typography>
                    </Box>
                )}

                {/* AI Detection Indicator */}
                {!boundingBox.corrected && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 4,
                            right: 4,
                            zIndex: 10
                        }}
                    >
                        <Tooltip title="AI Detected">
                            <AIIcon
                                sx={{
                                    fontSize: '16px',
                                    color: '#6366f1',
                                    backgroundColor: 'white',
                                    borderRadius: '50%',
                                    p: 0.25
                                }}
                            />
                        </Tooltip>
                    </Box>
                )}

                {/* Edit Controls for Selected Box */}
                {selected && editable && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: -36,
                            right: -8,
                            display: 'flex',
                            gap: 0.5,
                            zIndex: 15
                        }}
                    >
                        <Tooltip title="Edit Annotation">
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleEdit();
                                }}
                                sx={{
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    width: 24,
                                    height: 24,
                                    '&:hover': {
                                        backgroundColor: '#f3f4f6'
                                    }
                                }}
                            >
                                <EditIcon sx={{ fontSize: '12px' }} />
                            </IconButton>
                        </Tooltip>

                        <Tooltip title="Delete Annotation">
                            <IconButton
                                size="small"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete();
                                }}
                                sx={{
                                    backgroundColor: 'white',
                                    border: '1px solid #e5e7eb',
                                    width: 24,
                                    height: 24,
                                    '&:hover': {
                                        backgroundColor: '#fef2f2'
                                    }
                                }}
                            >
                                <DeleteIcon sx={{ fontSize: '12px', color: '#ef4444' }} />
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}

                {/* Correction Indicator */}
                {boundingBox.corrected && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 4,
                            left: 4,
                            zIndex: 10
                        }}
                    >
                        <Tooltip title="User Corrected">
                            <CheckIcon
                                sx={{
                                    fontSize: '16px',
                                    color: '#10b981',
                                    backgroundColor: 'white',
                                    borderRadius: '50%',
                                    p: 0.25
                                }}
                            />
                        </Tooltip>
                    </Box>
                )}
            </Box>

            {/* Context Menu */}
            <Menu
                open={contextMenu !== null}
                onClose={handleCloseContextMenu}
                anchorReference="anchorPosition"
                anchorPosition={
                    contextMenu !== null
                        ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                        : undefined
                }
            >
                <MenuItem onClick={handleEdit}>
                    <ListItemIcon>
                        <EditIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Edit Annotation</ListItemText>
                </MenuItem>

                <Divider />

                <MenuItem onClick={handleApprove}>
                    <ListItemIcon>
                        <CheckIcon fontSize="small" sx={{ color: '#10b981' }} />
                    </ListItemIcon>
                    <ListItemText>Approve (100%)</ListItemText>
                </MenuItem>

                <MenuItem onClick={handleReject}>
                    <ListItemIcon>
                        <CloseIcon fontSize="small" sx={{ color: '#ef4444' }} />
                    </ListItemIcon>
                    <ListItemText>Reject (0%)</ListItemText>
                </MenuItem>

                <Divider />

                <MenuItem onClick={handleDelete}>
                    <ListItemIcon>
                        <DeleteIcon fontSize="small" sx={{ color: '#ef4444' }} />
                    </ListItemIcon>
                    <ListItemText>Delete</ListItemText>
                </MenuItem>
            </Menu>
        </>
    );
}
