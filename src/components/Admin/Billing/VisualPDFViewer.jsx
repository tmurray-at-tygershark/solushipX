import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    IconButton,
    Toolbar,
    Tooltip,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Slider,
    Alert
} from '@mui/material';
import {
    ZoomIn as ZoomInIcon,
    ZoomOut as ZoomOutIcon,
    CenterFocusStrong as CenterIcon,
    Edit as EditIcon,
    Save as SaveIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Set up PDF.js worker - use local file to avoid CORS issues
if (typeof window !== 'undefined') {
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

const FIELD_TYPES = [
    { value: 'carrier_logo', label: 'Carrier Logo', color: '#2196F3' },
    { value: 'invoice_number', label: 'Invoice Number', color: '#FFEB3B' },
    { value: 'invoice_date', label: 'Invoice Date', color: '#FF9800' },
    { value: 'total_amount', label: 'Total Amount', color: '#9C27B0' },
    { value: 'shipment_id', label: 'Shipment ID', color: '#4CAF50' },
    { value: 'tracking_number', label: 'Tracking Number', color: '#00BCD4' },
    { value: 'due_date', label: 'Due Date', color: '#FF5722' },
    { value: 'customer_info', label: 'Customer Info', color: '#795548' },
    { value: 'billing_address', label: 'Billing Address', color: '#607D8B' },
    { value: 'service_type', label: 'Service Type', color: '#E91E63' }
];

export default function VisualPDFViewer({
    pdfUrl,
    boundingBoxes = [],
    onBoundingBoxUpdate,
    editable = false
}) {
    const [numPages, setNumPages] = useState(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [scale, setScale] = useState(1.0);
    const [pdfError, setPdfError] = useState(null);

    // Annotation state
    const [selectedBox, setSelectedBox] = useState(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [startPoint, setStartPoint] = useState(null);
    const [currentBox, setCurrentBox] = useState(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);

    // Canvas references
    const canvasRef = useRef(null);
    const overlayRef = useRef(null);
    const containerRef = useRef(null);

    const onDocumentLoadSuccess = ({ numPages }) => {
        setNumPages(numPages);
        setPdfError(null);
    };

    const onDocumentLoadError = (error) => {
        console.error('PDF load error:', error);
        setPdfError('Failed to load PDF. Please try again.');
    };

    // Handle mouse events for drawing bounding boxes
    const handleMouseDown = useCallback((e) => {
        if (!editable) return;

        const rect = overlayRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if clicking on existing box
        const clickedBox = findBoxAtPoint(x, y);
        if (clickedBox) {
            setSelectedBox(clickedBox);
            return;
        }

        // Start drawing new box
        setIsDrawing(true);
        setStartPoint({ x, y });
        setCurrentBox({
            id: `new_${Date.now()}`,
            type: 'unknown',
            x,
            y,
            width: 0,
            height: 0,
            confidence: 1.0
        });
    }, [editable, boundingBoxes]);

    const handleMouseMove = useCallback((e) => {
        if (!isDrawing || !startPoint) return;

        const rect = overlayRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setCurrentBox(prev => ({
            ...prev,
            width: x - startPoint.x,
            height: y - startPoint.y
        }));
    }, [isDrawing, startPoint]);

    const handleMouseUp = useCallback(() => {
        if (!isDrawing || !currentBox) return;

        setIsDrawing(false);

        // Only create box if it has meaningful size
        if (Math.abs(currentBox.width) > 10 && Math.abs(currentBox.height) > 10) {
            // Normalize negative dimensions
            const normalizedBox = {
                ...currentBox,
                x: currentBox.width < 0 ? currentBox.x + currentBox.width : currentBox.x,
                y: currentBox.height < 0 ? currentBox.y + currentBox.height : currentBox.y,
                width: Math.abs(currentBox.width),
                height: Math.abs(currentBox.height)
            };

            setSelectedBox(normalizedBox);
            setEditDialogOpen(true);
        }

        setCurrentBox(null);
        setStartPoint(null);
    }, [isDrawing, currentBox]);

    // Find bounding box at given point
    const findBoxAtPoint = (x, y) => {
        return boundingBoxes.find(box => {
            const boxCoords = convertToScreenCoordinates(box.boundingBox);
            return x >= boxCoords.x &&
                x <= boxCoords.x + boxCoords.width &&
                y >= boxCoords.y &&
                y <= boxCoords.y + boxCoords.height;
        });
    };

    // Convert Google Vision bounding box to screen coordinates
    const convertToScreenCoordinates = (boundingBox) => {
        if (!overlayRef.current) return { x: 0, y: 0, width: 0, height: 0 };

        const rect = overlayRef.current.getBoundingClientRect();

        // Assuming boundingBox has vertices array from Google Vision API
        if (boundingBox.vertices && boundingBox.vertices.length >= 4) {
            const minX = Math.min(...boundingBox.vertices.map(v => v.x || 0));
            const maxX = Math.max(...boundingBox.vertices.map(v => v.x || 0));
            const minY = Math.min(...boundingBox.vertices.map(v => v.y || 0));
            const maxY = Math.max(...boundingBox.vertices.map(v => v.y || 0));

            return {
                x: minX * scale,
                y: minY * scale,
                width: (maxX - minX) * scale,
                height: (maxY - minY) * scale
            };
        }

        return { x: 0, y: 0, width: 0, height: 0 };
    };

    // Render bounding box overlay
    const renderBoundingBoxes = () => {
        return boundingBoxes.map((box) => {
            const coords = convertToScreenCoordinates(box.boundingBox);
            const fieldType = FIELD_TYPES.find(ft => ft.value === box.type);
            const color = fieldType?.color || '#757575';
            const isSelected = selectedBox?.id === box.id;

            return (
                <Box
                    key={box.id}
                    sx={{
                        position: 'absolute',
                        left: coords.x,
                        top: coords.y,
                        width: coords.width,
                        height: coords.height,
                        border: `2px solid ${color}`,
                        backgroundColor: `${color}20`,
                        borderRadius: '4px',
                        cursor: editable ? 'pointer' : 'default',
                        boxShadow: isSelected ? `0 0 0 3px ${color}40` : 'none',
                        transition: 'all 0.2s ease-in-out',
                        '&:hover': editable ? {
                            borderWidth: '3px',
                            backgroundColor: `${color}30`
                        } : {}
                    }}
                    onClick={() => editable && setSelectedBox(box)}
                >
                    {/* Label */}
                    <Chip
                        label={`${box.label || box.type} (${Math.round(box.confidence * 100)}%)`}
                        size="small"
                        sx={{
                            position: 'absolute',
                            top: -12,
                            left: 0,
                            fontSize: '10px',
                            height: '20px',
                            backgroundColor: color,
                            color: 'white',
                            fontWeight: 600
                        }}
                    />

                    {/* Edit icon for selected box */}
                    {isSelected && editable && (
                        <IconButton
                            size="small"
                            sx={{
                                position: 'absolute',
                                top: -16,
                                right: -16,
                                backgroundColor: 'white',
                                boxShadow: 2,
                                '&:hover': { backgroundColor: '#f5f5f5' }
                            }}
                            onClick={(e) => {
                                e.stopPropagation();
                                setEditDialogOpen(true);
                            }}
                        >
                            <EditIcon fontSize="small" />
                        </IconButton>
                    )}
                </Box>
            );
        });
    };

    // Render current drawing box
    const renderCurrentBox = () => {
        if (!currentBox || !isDrawing) return null;

        return (
            <Box
                sx={{
                    position: 'absolute',
                    left: Math.min(currentBox.x, currentBox.x + currentBox.width),
                    top: Math.min(currentBox.y, currentBox.y + currentBox.height),
                    width: Math.abs(currentBox.width),
                    height: Math.abs(currentBox.height),
                    border: '2px dashed #2196F3',
                    backgroundColor: '#2196F320',
                    borderRadius: '4px',
                    pointerEvents: 'none'
                }}
            />
        );
    };

    const handleSaveEdit = (updatedBox) => {
        if (onBoundingBoxUpdate && selectedBox) {
            onBoundingBoxUpdate({
                boundingBoxId: selectedBox.id,
                action: 'update_field',
                updates: updatedBox
            });
        }

        setEditDialogOpen(false);
        setSelectedBox(null);
    };

    const handleDeleteBox = () => {
        if (onBoundingBoxUpdate && selectedBox) {
            onBoundingBoxUpdate({
                boundingBoxId: selectedBox.id,
                action: 'remove_field'
            });
        }

        setEditDialogOpen(false);
        setSelectedBox(null);
    };

    return (
        <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Toolbar */}
            <Toolbar
                variant="dense"
                sx={{
                    borderBottom: '1px solid #e5e7eb',
                    backgroundColor: '#f9fafb',
                    minHeight: '48px'
                }}
            >
                <Typography variant="h6" sx={{ flexGrow: 1, fontSize: '14px', fontWeight: 600 }}>
                    PDF Viewer {numPages && `(Page ${pageNumber} of ${numPages})`}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {/* Zoom Controls */}
                    <Tooltip title="Zoom Out">
                        <IconButton
                            size="small"
                            onClick={() => setScale(prev => Math.max(0.5, prev - 0.1))}
                        >
                            <ZoomOutIcon />
                        </IconButton>
                    </Tooltip>

                    <Typography sx={{ fontSize: '12px', minWidth: '50px', textAlign: 'center' }}>
                        {Math.round(scale * 100)}%
                    </Typography>

                    <Tooltip title="Zoom In">
                        <IconButton
                            size="small"
                            onClick={() => setScale(prev => Math.min(3.0, prev + 0.1))}
                        >
                            <ZoomInIcon />
                        </IconButton>
                    </Tooltip>

                    <Tooltip title="Fit to Width">
                        <IconButton
                            size="small"
                            onClick={() => setScale(1.0)}
                        >
                            <CenterIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Toolbar>

            {/* PDF Content */}
            <Box
                ref={containerRef}
                sx={{
                    flex: 1,
                    overflow: 'auto',
                    position: 'relative',
                    backgroundColor: '#f5f5f5'
                }}
            >
                {pdfError ? (
                    <Alert severity="error" sx={{ m: 2 }}>
                        {pdfError}
                    </Alert>
                ) : (
                    <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
                        <Box sx={{ position: 'relative' }}>
                            <Document
                                file={pdfUrl}
                                onLoadSuccess={onDocumentLoadSuccess}
                                onLoadError={onDocumentLoadError}
                                loading={
                                    <Box sx={{ p: 4, textAlign: 'center' }}>
                                        <Typography>Loading PDF...</Typography>
                                    </Box>
                                }
                            >
                                <Page
                                    pageNumber={pageNumber}
                                    scale={scale}
                                    loading={
                                        <Box sx={{ p: 4, textAlign: 'center' }}>
                                            <Typography>Loading page...</Typography>
                                        </Box>
                                    }
                                />
                            </Document>

                            {/* Overlay for annotations */}
                            <Box
                                ref={overlayRef}
                                sx={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    cursor: editable ? 'crosshair' : 'default',
                                    pointerEvents: editable ? 'auto' : 'none'
                                }}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                            >
                                {renderBoundingBoxes()}
                                {renderCurrentBox()}
                            </Box>
                        </Box>
                    </Box>
                )}
            </Box>

            {/* Legend */}
            <Box sx={{ p: 2, borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                <Typography sx={{ fontSize: '12px', fontWeight: 600, mb: 1 }}>
                    Field Types:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                    {FIELD_TYPES.map((fieldType) => (
                        <Chip
                            key={fieldType.value}
                            label={fieldType.label}
                            size="small"
                            sx={{
                                backgroundColor: fieldType.color,
                                color: 'white',
                                fontSize: '10px',
                                height: '20px'
                            }}
                        />
                    ))}
                </Box>
            </Box>

            {/* Edit Dialog */}
            <EditBoundingBoxDialog
                open={editDialogOpen}
                boundingBox={selectedBox}
                onClose={() => setEditDialogOpen(false)}
                onSave={handleSaveEdit}
                onDelete={handleDeleteBox}
            />
        </Box>
    );
}

// Edit Dialog Component
function EditBoundingBoxDialog({ open, boundingBox, onClose, onSave, onDelete }) {
    const [formData, setFormData] = useState({
        type: '',
        value: '',
        confidence: 1.0
    });

    useEffect(() => {
        if (boundingBox) {
            setFormData({
                type: boundingBox.type || '',
                value: boundingBox.value || '',
                confidence: boundingBox.confidence || 1.0
            });
        }
    }, [boundingBox]);

    const handleSave = () => {
        onSave(formData);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>
                Edit Annotation
            </DialogTitle>
            <DialogContent>
                <Box sx={{ pt: 1 }}>
                    <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Field Type</InputLabel>
                        <Select
                            value={formData.type}
                            onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
                            label="Field Type"
                        >
                            {FIELD_TYPES.map((fieldType) => (
                                <MenuItem key={fieldType.value} value={fieldType.value}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Box
                                            sx={{
                                                width: 16,
                                                height: 16,
                                                backgroundColor: fieldType.color,
                                                borderRadius: '2px'
                                            }}
                                        />
                                        {fieldType.label}
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>

                    <TextField
                        fullWidth
                        label="Value"
                        value={formData.value}
                        onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                        sx={{ mb: 2 }}
                    />

                    <Typography gutterBottom>
                        Confidence: {Math.round(formData.confidence * 100)}%
                    </Typography>
                    <Slider
                        value={formData.confidence}
                        onChange={(_, value) => setFormData(prev => ({ ...prev, confidence: value }))}
                        min={0}
                        max={1}
                        step={0.01}
                        sx={{ mb: 2 }}
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onDelete} color="error">
                    Delete
                </Button>
                <Button onClick={onClose}>
                    Cancel
                </Button>
                <Button onClick={handleSave} variant="contained">
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
}
