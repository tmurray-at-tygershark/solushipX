import React, { useState, useCallback, useMemo } from 'react';
import {
    Grid,
    Paper,
    Typography,
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    IconButton,
    Chip,
    CircularProgress,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    LinearProgress,
    Tooltip,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    Divider
} from '@mui/material';
import {
    Description as DescriptionIcon,
    PictureAsPdf as PictureAsPdfIcon,
    Assignment as AssignmentIcon,
    LocalShipping as LocalShippingIcon,
    Receipt as ReceiptIcon,
    AttachFile as AttachFileIcon,
    CloudUpload as CloudUploadIcon,
    Visibility as VisibilityIcon,
    Download as DownloadIcon,
    Delete as DeleteIcon,
    MoreVert as MoreVertIcon,
    Add as AddIcon,
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    Upload as UploadIcon,
    Business as BusinessIcon,
    Inventory as InventoryIcon,
    CameraAlt as CameraAltIcon,
    Image as ImageIcon,
    Close as CloseIcon
} from '@mui/icons-material';
import { useAuth } from '../../../contexts/AuthContext';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../../firebase';

// Helper function to safely format timestamps
const formatTimestamp = (timestamp) => {
    if (!timestamp) return '-';

    try {
        // Handle different timestamp formats
        if (timestamp.toDate && typeof timestamp.toDate === 'function') {
            // Standard Firestore Timestamp
            const date = timestamp.toDate();
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (timestamp.seconds) {
            // Timestamp object with seconds/nanoseconds
            const date = new Date(timestamp.seconds * 1000);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (timestamp instanceof Date) {
            // Regular Date object
            return timestamp.toLocaleDateString() + ' ' + timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } else if (typeof timestamp === 'string') {
            // String date
            const date = new Date(timestamp);
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            return '-';
        } else if (typeof timestamp === 'number') {
            // Unix timestamp
            const date = new Date(timestamp);
            if (!isNaN(date.getTime())) {
                return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            return '-';
        } else {
            console.warn('Unknown timestamp format:', timestamp);
            return '-';
        }
    } catch (error) {
        console.warn('Error formatting timestamp:', error, timestamp);
        return '-';
    }
};

// Document type definitions with icons and labels
const DOCUMENT_TYPES = {
    'bill_of_lading': {
        label: 'Bill of Lading',
        icon: DescriptionIcon,
        color: '#1976d2',
        adminOnly: false
    },
    'carrier_confirmation': {
        label: 'Carrier Confirmation',
        icon: AssignmentIcon,
        color: '#7c3aed',
        adminOnly: false
    },
    'labels': {
        label: 'Labels',
        icon: LocalShippingIcon,
        color: '#2e7d32',
        adminOnly: false
    },
    'commercial_invoice': {
        label: 'Commercial Invoice',
        icon: BusinessIcon,
        color: '#ed6c02',
        adminOnly: true
    },
    'proof_of_pickup': {
        label: 'Proof of Pickup',
        icon: CheckCircleIcon,
        color: '#9c27b0',
        adminOnly: false
    },
    'proof_of_delivery': {
        label: 'Proof of Delivery',
        icon: AssignmentIcon,
        color: '#d32f2f',
        adminOnly: false
    },
    'packing_list': {
        label: 'Packing List',
        icon: InventoryIcon,
        color: '#795548',
        adminOnly: false
    },
    'photos': {
        label: 'Photos',
        icon: CameraAltIcon,
        color: '#607d8b',
        adminOnly: false
    },
    'other': {
        label: 'Other',
        icon: AttachFileIcon,
        color: '#757575',
        adminOnly: false
    }
};

const DocumentsSection = ({
    shipment,
    shipmentDocuments = {},
    documentsLoading = false,
    documentsError = null,
    onRetryFetch = () => { },
    onViewPdf = () => { },
    onDocumentUploaded = () => { },
    showNotification = () => { }
}) => {
    const { currentUser: user, userRole } = useAuth();
    const isAdmin = userRole === 'admin' || userRole === 'superadmin';

    // Debug logging for authentication state
    console.log('🔍 DocumentsSection Auth State:', {
        user: user ? { uid: user.uid, email: user.email } : null,
        userRole,
        isAdmin,
        hasUser: !!user
    });

    // State for upload dialog
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [uploadProgress, setUploadProgress] = useState({});
    const [uploading, setUploading] = useState(false);
    const [documentType, setDocumentType] = useState('other');

    // State for document actions menu
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedDocument, setSelectedDocument] = useState(null);

    // Determine document type from filename and category
    const determineDocumentType = useCallback((doc, category) => {
        const filename = (doc.filename || '').toLowerCase();
        const docType = (doc.documentType || '').toLowerCase();

        // Check for specific patterns
        if (category === 'bol' || filename.includes('bol') || filename.includes('bill-of-lading') || docType.includes('bol')) {
            return 'bill_of_lading';
        }
        if (category === 'carrierConfirmations' ||
            doc.docType === 7 ||
            docType === 'carrier_confirmation' ||
            filename.includes('carrier_confirmation') ||
            filename.includes('carrier-confirmation') ||
            (filename.includes('carrier') && filename.includes('confirmation')) ||
            filename.includes('pickup_confirmation') ||
            filename.includes('pickup-confirmation')) {
            return 'carrier_confirmation';
        }
        if (category === 'labels' || filename.includes('label') || docType.includes('label')) {
            return 'labels';
        }
        if (filename.includes('commercial') && filename.includes('invoice')) {
            return 'commercial_invoice';
        }
        if (filename.includes('proof') && filename.includes('pickup')) {
            return 'proof_of_pickup';
        }
        if (filename.includes('proof') && filename.includes('delivery')) {
            return 'proof_of_delivery';
        }
        if (filename.includes('packing') && filename.includes('list')) {
            return 'packing_list';
        }
        if (filename.includes('photo') || filename.includes('image') ||
            filename.endsWith('.jpg') || filename.endsWith('.jpeg') ||
            filename.endsWith('.png') || filename.endsWith('.gif')) {
            return 'photos';
        }

        return 'other';
    }, []);

    // Handle file selection
    const handleFileSelect = useCallback((event) => {
        const files = Array.from(event.target.files);
        setSelectedFiles(files);

        // Initialize progress tracking
        const progress = {};
        files.forEach((file, index) => {
            progress[index] = { progress: 0, status: 'pending' };
        });
        setUploadProgress(progress);
    }, []);

    // Upload documents
    const handleUpload = useCallback(async () => {
        if (selectedFiles.length === 0) return;

        // Check if user is authenticated
        if (!user) {
            console.error('Upload failed: User not authenticated', { user });
            showNotification('Please log in to upload documents', 'error');
            return;
        }

        console.log('Starting upload with user:', {
            uid: user?.uid,
            email: user?.email,
            userRole,
            isAdmin,
            userObject: user
        });

        setUploading(true);
        const uploadFunction = httpsCallable(functions, 'uploadShipmentDocument');

        try {
            for (let i = 0; i < selectedFiles.length; i++) {
                const file = selectedFiles[i];

                // Update progress
                setUploadProgress(prev => ({
                    ...prev,
                    [i]: { progress: 0, status: 'uploading' }
                }));

                // Convert file to base64
                const base64Data = await new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onload = () => {
                        const base64 = reader.result.split(',')[1];
                        resolve(base64);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(file);
                });

                // Simulate progress updates
                const progressInterval = setInterval(() => {
                    setUploadProgress(prev => {
                        const currentProgress = prev[i]?.progress || 0;
                        if (currentProgress < 90) {
                            return {
                                ...prev,
                                [i]: { ...prev[i], progress: currentProgress + 10 }
                            };
                        }
                        return prev;
                    });
                }, 200);

                try {
                    // Upload file
                    const result = await uploadFunction({
                        shipmentId: shipment.id,
                        firebaseDocId: shipment.id,
                        fileName: file.name,
                        fileData: base64Data,
                        fileType: file.type,
                        fileSize: file.size,
                        documentType: documentType,
                        metadata: {
                            uploadedBy: user?.uid || 'unknown',
                            uploadedByEmail: user?.email || 'unknown@example.com',
                            originalName: file.name
                        }
                    });

                    clearInterval(progressInterval);

                    if (result.data.success) {
                        setUploadProgress(prev => ({
                            ...prev,
                            [i]: { progress: 100, status: 'completed' }
                        }));
                    } else {
                        throw new Error(result.data.error || 'Upload failed');
                    }
                } catch (error) {
                    clearInterval(progressInterval);
                    setUploadProgress(prev => ({
                        ...prev,
                        [i]: { progress: 0, status: 'error', error: error.message }
                    }));
                }
            }

            // Show success message
            showNotification('Documents uploaded successfully!', 'success');

            // Close dialog and refresh documents
            setTimeout(() => {
                setUploadDialogOpen(false);
                setSelectedFiles([]);
                setUploadProgress({});
                onDocumentUploaded();
            }, 1000);

        } catch (error) {
            console.error('Upload error:', error);
            showNotification('Failed to upload documents: ' + error.message, 'error');
        } finally {
            setUploading(false);
        }
    }, [selectedFiles, documentType, shipment.id, user, showNotification, onDocumentUploaded]);

    // Organize documents by type with deduplication
    const organizedDocuments = useMemo(() => {
        const organized = {};
        const processedDocIds = new Set(); // Track processed document IDs to prevent duplicates

        // Initialize all document types
        Object.keys(DOCUMENT_TYPES).forEach(type => {
            organized[type] = [];
        });

        // Process existing documents with deduplication
        Object.entries(shipmentDocuments).forEach(([category, docs]) => {
            if (Array.isArray(docs)) {
                docs.forEach(doc => {
                    // Create a unique identifier for deduplication
                    // Use multiple fallbacks to ensure we catch duplicates with different ID formats
                    const docId = doc.id ||
                        doc.filename ||
                        doc.name ||
                        `${doc.documentType}_${doc.fileSize}_${doc.createdAt}` ||
                        `unknown_${Math.random()}`;

                    // Also check for filename-based duplicates (same file with different IDs)
                    const filenameKey = doc.filename ? `filename_${doc.filename}` : null;

                    if (processedDocIds.has(docId) || (filenameKey && processedDocIds.has(filenameKey))) {
                        console.log('🔍 Skipping duplicate document:', {
                            docId,
                            filename: doc.filename,
                            originalCategory: category,
                            duplicateType: processedDocIds.has(docId) ? 'ID duplicate' : 'Filename duplicate'
                        });
                        return;
                    }

                    // Add both ID and filename to processed set
                    processedDocIds.add(docId);
                    if (filenameKey) {
                        processedDocIds.add(filenameKey);
                    }
                    const docType = determineDocumentType(doc, category);
                    if (organized[docType]) {
                        organized[docType].push({
                            ...doc,
                            originalCategory: category // Keep track of original category for debugging
                        });
                    }
                });
            }
        });

        // Debug logging
        const totalDocs = Object.values(organized).flat().length;
        const originalTotal = Object.values(shipmentDocuments).flat().length;
        console.log('🔍 Document organization complete:', {
            originalTotal,
            processedTotal: totalDocs,
            duplicatesRemoved: originalTotal - totalDocs,
            byType: Object.entries(organized).reduce((acc, [type, docs]) => {
                acc[type] = docs.length;
                return acc;
            }, {})
        });

        return organized;
    }, [shipmentDocuments, determineDocumentType]);

    // Don't show for draft shipments
    if (shipment?.status === 'draft') {
        return null;
    }

    // Handle document actions
    const handleDocumentAction = (action, document) => {
        setAnchorEl(null);
        setSelectedDocument(null);

        switch (action) {
            case 'view':
                onViewPdf(document.id, document.filename, document.name || 'Document');
                break;
            case 'download':
                if (document.downloadUrl) {
                    window.open(document.downloadUrl, '_blank');
                } else {
                    showNotification('Download URL not available', 'error');
                }
                break;
            case 'delete':
                // TODO: Implement delete functionality
                showNotification('Delete functionality coming soon', 'info');
                break;
            default:
                break;
        }
    };

    // Get available document types for upload (filter admin-only if not admin)
    const getAvailableDocumentTypes = () => {
        return Object.entries(DOCUMENT_TYPES).filter(([type, config]) => {
            return !config.adminOnly || isAdmin;
        });
    };

    // Render document table
    const renderDocumentTable = () => {
        const allDocuments = [];

        Object.entries(organizedDocuments).forEach(([type, docs]) => {
            docs.forEach(doc => {
                allDocuments.push({
                    ...doc,
                    type: type,
                    typeConfig: DOCUMENT_TYPES[type]
                });
            });
        });

        if (allDocuments.length === 0) {
            return (
                <Alert severity="info" sx={{ mt: 2 }}>
                    No documents available. Upload documents or wait for system-generated documents after booking.
                </Alert>
            );
        }

        return (
            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>
                                Type
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>
                                Name
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>
                                Size
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>
                                Created
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc' }}>
                                Uploaded By
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600, fontSize: '12px', bgcolor: '#f8fafc', textAlign: 'center' }}>
                                Actions
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {allDocuments.map((doc, index) => {
                            const TypeIcon = doc.typeConfig?.icon || AttachFileIcon;
                            return (
                                <TableRow key={doc.id || index} hover>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <TypeIcon
                                                sx={{
                                                    fontSize: 18,
                                                    color: doc.typeConfig?.color || '#757575'
                                                }}
                                            />
                                            <Typography sx={{ fontSize: '12px' }}>
                                                {doc.typeConfig?.label || 'Unknown'}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                            {doc.filename || doc.name || 'Untitled'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : '-'}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {(() => {
                                            // Debug logging for timestamp issue
                                            console.log('Document timestamp debug:', {
                                                docId: doc.id,
                                                filename: doc.filename,
                                                createdAt: doc.createdAt,
                                                createdAtType: typeof doc.createdAt,
                                                uploadedAt: doc.uploadedAt,
                                                timestamp: doc.timestamp,
                                                metadata: doc.metadata,
                                                allFields: Object.keys(doc)
                                            });

                                            // Try multiple timestamp fields
                                            const timestamp = doc.createdAt ||
                                                doc.uploadedAt ||
                                                doc.timestamp ||
                                                doc.metadata?.createdAt ||
                                                doc.metadata?.uploadedAt ||
                                                doc.metadata?.timestamp;

                                            return formatTimestamp(timestamp);
                                        })()}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px' }}>
                                        {doc.uploadedByEmail || doc.metadata?.uploadedByEmail || 'System'}
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '12px', textAlign: 'center' }}>
                                        <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                            <Tooltip title="View Document">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => handleDocumentAction('view', doc)}
                                                >
                                                    <VisibilityIcon sx={{ fontSize: 16 }} />
                                                </IconButton>
                                            </Tooltip>
                                            {doc.downloadUrl && (
                                                <Tooltip title="Download">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleDocumentAction('download', doc)}
                                                    >
                                                        <DownloadIcon sx={{ fontSize: 16 }} />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                            {isAdmin && (
                                                <Tooltip title="More Actions">
                                                    <IconButton
                                                        size="small"
                                                        onClick={(e) => {
                                                            setAnchorEl(e.currentTarget);
                                                            setSelectedDocument(doc);
                                                        }}
                                                    >
                                                        <MoreVertIcon sx={{ fontSize: 16 }} />
                                                    </IconButton>
                                                </Tooltip>
                                            )}
                                        </Box>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        );
    };

    return (
        <Grid item xs={12}>
            <Paper sx={{ mt: 2 }}>
                <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '16px', color: '#374151' }}>
                            Documents
                        </Typography>
                        <Button
                            variant="contained"
                            size="small"
                            startIcon={<CloudUploadIcon />}
                            onClick={() => setUploadDialogOpen(true)}
                            sx={{ fontSize: '12px' }}
                        >
                            Upload
                        </Button>
                    </Box>
                </Box>

                <Box sx={{ p: 2 }}>
                    {documentsLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                            <CircularProgress />
                        </Box>
                    ) : documentsError ? (
                        <Alert
                            severity="error"
                            action={
                                <Button color="inherit" size="small" onClick={onRetryFetch}>
                                    Retry
                                </Button>
                            }
                        >
                            Failed to load documents: {documentsError}
                        </Alert>
                    ) : (
                        renderDocumentTable()
                    )}
                </Box>
            </Paper>

            {/* Enterprise Upload Dialog */}
            <Dialog
                open={uploadDialogOpen}
                onClose={() => !uploading && setUploadDialogOpen(false)}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: 2,
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        minHeight: '600px'
                    }
                }}
            >
                {/* Header */}
                <Box sx={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    p: 3,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <CloudUploadIcon sx={{ fontSize: 32 }} />
                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: 600, fontSize: '20px' }}>
                                Document Upload Center
                            </Typography>
                            <Typography sx={{ fontSize: '14px', opacity: 0.9 }}>
                                Secure document management for {shipment?.shipmentID}
                            </Typography>
                        </Box>
                    </Box>
                    <IconButton
                        onClick={() => !uploading && setUploadDialogOpen(false)}
                        sx={{ color: 'white' }}
                        disabled={uploading}
                    >
                        <CloseIcon />
                    </IconButton>
                </Box>

                <DialogContent sx={{ p: 0 }}>
                    <Grid container sx={{ minHeight: '500px' }}>
                        {/* Left Panel - Document Type Selection */}
                        <Grid item xs={12} md={4} sx={{
                            backgroundColor: '#f8fafc',
                            borderRight: '1px solid #e5e7eb',
                            p: 3
                        }}>
                            <Typography sx={{ fontSize: '16px', fontWeight: 600, mb: 3, color: '#374151' }}>
                                📁 Document Categories
                            </Typography>

                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {getAvailableDocumentTypes().map(([type, config]) => {
                                    const TypeIcon = config.icon;
                                    const isSelected = documentType === type;
                                    return (
                                        <Box
                                            key={type}
                                            onClick={() => setDocumentType(type)}
                                            sx={{
                                                p: 2,
                                                borderRadius: 2,
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                backgroundColor: isSelected ? config.color : 'transparent',
                                                color: isSelected ? 'white' : '#374151',
                                                border: isSelected ? 'none' : '1px solid #e5e7eb',
                                                '&:hover': {
                                                    backgroundColor: isSelected ? config.color : '#f1f5f9',
                                                    transform: 'translateY(-1px)',
                                                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                                                }
                                            }}
                                        >
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                <TypeIcon sx={{ fontSize: 20 }} />
                                                <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                                    {config.label}
                                                </Typography>
                                                {isSelected && (
                                                    <CheckCircleIcon sx={{ fontSize: 16, ml: 'auto' }} />
                                                )}
                                            </Box>
                                        </Box>
                                    );
                                })}
                            </Box>

                            {/* Upload Guidelines */}
                            <Box sx={{ mt: 4, p: 3, backgroundColor: '#eff6ff', borderRadius: 2, border: '1px solid #bfdbfe' }}>
                                <Typography sx={{ fontSize: '14px', fontWeight: 600, mb: 2, color: '#1e40af' }}>
                                    📋 Upload Guidelines
                                </Typography>
                                <Box sx={{ fontSize: '12px', color: '#374151', lineHeight: 1.6 }}>
                                    <Box sx={{ mb: 1 }}>• Max file size: 10MB</Box>
                                    <Box sx={{ mb: 1 }}>• Supported: PDF, JPG, PNG, GIF</Box>
                                    <Box sx={{ mb: 1 }}>• Multiple files allowed</Box>
                                    <Box>• Files are encrypted in transit</Box>
                                </Box>
                            </Box>
                        </Grid>

                        {/* Right Panel - File Upload Area */}
                        <Grid item xs={12} md={8} sx={{ p: 3 }}>
                            {/* Drag & Drop Zone */}
                            <Box sx={{ mb: 4 }}>
                                <input
                                    type="file"
                                    multiple
                                    accept=".pdf,.jpg,.jpeg,.png,.gif"
                                    onChange={handleFileSelect}
                                    style={{ display: 'none' }}
                                    id="file-upload"
                                />
                                <label htmlFor="file-upload">
                                    <Box sx={{
                                        border: '3px dashed #cbd5e1',
                                        borderRadius: 3,
                                        p: 6,
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s ease',
                                        backgroundColor: '#fafafa',
                                        '&:hover': {
                                            borderColor: '#667eea',
                                            backgroundColor: '#f8faff',
                                            transform: 'scale(1.02)'
                                        }
                                    }}>
                                        <CloudUploadIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 2 }} />
                                        <Typography sx={{ fontSize: '18px', fontWeight: 600, mb: 1, color: '#374151' }}>
                                            Drop files here or click to browse
                                        </Typography>
                                        <Typography sx={{ fontSize: '14px', color: '#6b7280' }}>
                                            Select multiple files to upload at once
                                        </Typography>
                                        <Box sx={{ mt: 3 }}>
                                            <Button
                                                variant="outlined"
                                                component="span"
                                                startIcon={<AttachFileIcon />}
                                                sx={{
                                                    fontSize: '14px',
                                                    borderColor: '#667eea',
                                                    color: '#667eea',
                                                    '&:hover': {
                                                        backgroundColor: '#667eea',
                                                        color: 'white'
                                                    }
                                                }}
                                            >
                                                Choose Files
                                            </Button>
                                        </Box>
                                    </Box>
                                </label>
                            </Box>

                            {/* Selected Files List */}
                            {selectedFiles.length > 0 && (
                                <Box>
                                    <Typography sx={{ fontSize: '16px', fontWeight: 600, mb: 3, color: '#374151' }}>
                                        📄 Selected Files ({selectedFiles.length})
                                    </Typography>
                                    <Box sx={{ maxHeight: '300px', overflowY: 'auto' }}>
                                        {selectedFiles.map((file, index) => {
                                            const progress = uploadProgress[index];
                                            const getFileIcon = (fileName) => {
                                                const ext = fileName.split('.').pop()?.toLowerCase();
                                                if (ext === 'pdf') return <PictureAsPdfIcon sx={{ color: '#dc2626' }} />;
                                                if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return <ImageIcon sx={{ color: '#059669' }} />;
                                                return <AttachFileIcon sx={{ color: '#6b7280' }} />;
                                            };

                                            return (
                                                <Box key={index} sx={{
                                                    p: 3,
                                                    mb: 2,
                                                    border: '1px solid #e5e7eb',
                                                    borderRadius: 2,
                                                    backgroundColor: progress?.status === 'completed' ? '#f0fdf4' :
                                                        progress?.status === 'error' ? '#fef2f2' : '#ffffff'
                                                }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                                                        {getFileIcon(file.name)}
                                                        <Box sx={{ flex: 1 }}>
                                                            <Typography sx={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>
                                                                {file.name}
                                                            </Typography>
                                                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                                {(file.size / 1024 / 1024).toFixed(2)} MB
                                                            </Typography>
                                                        </Box>
                                                        {progress?.status === 'completed' && (
                                                            <CheckCircleIcon sx={{ fontSize: 24, color: '#059669' }} />
                                                        )}
                                                        {progress?.status === 'error' && (
                                                            <ErrorIcon sx={{ fontSize: 24, color: '#dc2626' }} />
                                                        )}
                                                        {progress?.status === 'uploading' && (
                                                            <CircularProgress size={24} />
                                                        )}
                                                    </Box>

                                                    {progress && progress.status !== 'pending' && (
                                                        <Box>
                                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                                    {progress.status === 'completed' ? 'Upload Complete' :
                                                                        progress.status === 'error' ? 'Upload Failed' :
                                                                            `Uploading... ${progress.progress}%`}
                                                                </Typography>
                                                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                                    {progress.progress}%
                                                                </Typography>
                                                            </Box>
                                                            <LinearProgress
                                                                variant="determinate"
                                                                value={progress.progress}
                                                                sx={{
                                                                    height: 6,
                                                                    borderRadius: 3,
                                                                    backgroundColor: '#f1f5f9',
                                                                    '& .MuiLinearProgress-bar': {
                                                                        backgroundColor: progress.status === 'error' ? '#dc2626' :
                                                                            progress.status === 'completed' ? '#059669' : '#667eea'
                                                                    }
                                                                }}
                                                            />
                                                            {progress?.status === 'error' && (
                                                                <Typography sx={{ fontSize: '12px', color: '#dc2626', mt: 1 }}>
                                                                    {progress.error}
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    )}
                                                </Box>
                                            );
                                        })}
                                    </Box>
                                </Box>
                            )}
                        </Grid>
                    </Grid>
                </DialogContent>

                {/* Footer Actions */}
                <Box sx={{
                    p: 3,
                    backgroundColor: '#f8fafc',
                    borderTop: '1px solid #e5e7eb',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                        {selectedFiles.length > 0 ? `${selectedFiles.length} file(s) selected` : 'No files selected'}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            onClick={() => setUploadDialogOpen(false)}
                            disabled={uploading}
                            sx={{ fontSize: '14px', color: '#6b7280' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUpload}
                            variant="contained"
                            disabled={selectedFiles.length === 0 || uploading}
                            startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <UploadIcon />}
                            sx={{
                                fontSize: '14px',
                                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                '&:hover': {
                                    background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)'
                                },
                                '&:disabled': {
                                    background: '#e5e7eb',
                                    color: '#9ca3af'
                                }
                            }}
                        >
                            {uploading ? 'Uploading...' : `Upload ${selectedFiles.length > 0 ? `(${selectedFiles.length})` : ''}`}
                        </Button>
                    </Box>
                </Box>
            </Dialog>

            {/* Document Actions Menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
            >
                <MenuItem onClick={() => handleDocumentAction('view', selectedDocument)}>
                    <ListItemIcon>
                        <VisibilityIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="View" />
                </MenuItem>
                {selectedDocument?.downloadUrl && (
                    <MenuItem onClick={() => handleDocumentAction('download', selectedDocument)}>
                        <ListItemIcon>
                            <DownloadIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary="Download" />
                    </MenuItem>
                )}
                <Divider />
                <MenuItem
                    onClick={() => handleDocumentAction('delete', selectedDocument)}
                    sx={{ color: 'error.main' }}
                >
                    <ListItemIcon>
                        <DeleteIcon fontSize="small" color="error" />
                    </ListItemIcon>
                    <ListItemText primary="Delete" />
                </MenuItem>
            </Menu>
        </Grid>
    );
};

export default DocumentsSection; 