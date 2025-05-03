import React, { useState, useRef } from 'react';
import {
    Box,
    Typography,
    Paper,
    Button,
    LinearProgress,
    Chip,
    Stack,
    IconButton,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormHelperText
} from '@mui/material';
import {
    CloudUpload as CloudUploadIcon,
    Close as CloseIcon,
    DeleteOutline as DeleteIcon,
    InfoOutlined as InfoIcon
} from '@mui/icons-material';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../../contexts/AuthContext';
import { db, adminDb } from '../../../firebase';
import { getApp } from 'firebase/app';
import { getStorage } from 'firebase/storage';

// Predefined list of carriers
const CARRIERS = [
    "UPS CANADA",
    "UPS USA",
    "CANPAR",
    "FEDEX",
    "LOOMIS",
    "DHL EXPRESS",
    "PUROLATOR"
];

const EDIUploader = ({ onUploadComplete }) => {
    const { currentUser } = useAuth();
    const fileInputRef = useRef(null);
    const [dragActive, setDragActive] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [files, setFiles] = useState([]);
    const [uploadProgress, setUploadProgress] = useState({});
    const [uploadStatus, setUploadStatus] = useState({});
    const [error, setError] = useState(null);
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [selectedCarrier, setSelectedCarrier] = useState('');
    const [carrierError, setCarrierError] = useState(false);

    // Use the admin database for uploads in the admin section
    const database = adminDb;
    const collectionName = 'ediUploads';

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        // Check carrier selection before processing dropped files
        if (!selectedCarrier) {
            setCarrierError(true);
            setError('You must select a carrier before uploading EDI files');
            // Focus the carrier dropdown by scrolling to it
            const carrierSelect = document.getElementById('carrier-select');
            if (carrierSelect) {
                carrierSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFiles(e.dataTransfer.files);
        }
    };

    const onButtonClick = (e) => {
        if (e) e.stopPropagation();

        // Check carrier selection here instead of after file selection
        if (!selectedCarrier) {
            setCarrierError(true);
            setError('You must select a carrier before uploading EDI files');
            // Focus the carrier dropdown by scrolling to it
            const carrierSelect = document.getElementById('carrier-select');
            if (carrierSelect) {
                carrierSelect.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            return;
        }

        // Only proceed with file selection if carrier is selected
        if (fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const handleFileInputChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFiles(e.target.files);
        }
    };

    const handleFiles = (fileList) => {
        // We now validate carrier selection before opening file dialog
        // First validate CSV file type
        const newFiles = Array.from(fileList).filter(file =>
            file.type === 'text/csv' ||
            file.name.endsWith('.csv')
        );

        if (newFiles.length === 0) {
            setError('Only CSV files are supported');
            return;
        }

        setFiles(prev => [...prev, ...newFiles]);
        setError(null);
    };

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
        setUploadProgress(prev => {
            const newProgress = { ...prev };
            delete newProgress[index];
            return newProgress;
        });
        setUploadStatus(prev => {
            const newStatus = { ...prev };
            delete newStatus[index];
            return newStatus;
        });
    };

    const handleCarrierChange = (event) => {
        setSelectedCarrier(event.target.value);
        setCarrierError(false);
    };

    const uploadFiles = async () => {
        if (files.length === 0) return;

        // Validate carrier selection
        if (!selectedCarrier) {
            setCarrierError(true);
            setError("Please select a carrier before uploading");
            return;
        }

        setUploading(true);
        setError(null);

        for (let i = 0; i < files.length; i++) {
            if (uploadStatus[i] === 'success') continue;

            const file = files[i];
            const fileId = Date.now().toString() + '_' + file.name.replace(/[^a-zA-Z0-9.-]/g, '_');

            // Create a custom storage reference that uses the correct bucket URL
            const firebaseApp = getApp();
            const customStorage = getStorage(firebaseApp, "gs://solushipx.firebasestorage.app");
            const storageRef = ref(customStorage, `edi-uploads/${currentUser.uid}/${fileId}`);

            try {
                const uploadTask = uploadBytesResumable(storageRef, file);

                uploadTask.on('state_changed',
                    (snapshot) => {
                        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                        setUploadProgress(prev => ({ ...prev, [i]: progress }));
                    },
                    (error) => {
                        console.error('Upload error:', error);
                        setUploadStatus(prev => ({ ...prev, [i]: 'error' }));
                        setError(`Error uploading ${file.name}: ${error.message}`);
                    },
                    async () => {
                        try {
                            // Get download URL
                            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

                            // Create record in Firestore - use admin database
                            const docRef = await addDoc(collection(database, collectionName), {
                                fileName: file.name,
                                fileSize: file.size,
                                fileType: file.type,
                                uploadedBy: currentUser.uid,
                                uploadedAt: serverTimestamp(),
                                downloadURL,
                                status: 'pending',
                                processingStatus: 'queued',
                                storagePath: `edi-uploads/${currentUser.uid}/${fileId}`,
                                isAdmin: true,
                                carrier: selectedCarrier // Add the selected carrier to the upload document
                            });

                            // Update local state
                            setUploadStatus(prev => ({ ...prev, [i]: 'success' }));
                            setFiles(prev => prev.map((f, idx) =>
                                idx === i ? { ...f, docId: docRef.id } : f
                            ));

                            if (onUploadComplete) {
                                onUploadComplete(docRef.id);
                            }
                        } catch (err) {
                            console.error('Firestore error:', err);
                            setUploadStatus(prev => ({ ...prev, [i]: 'error' }));
                            setError(`Error saving ${file.name} metadata: ${err.message}`);
                        }
                    }
                );
            } catch (err) {
                console.error('Upload setup error:', err);
                setUploadStatus(prev => ({ ...prev, [i]: 'error' }));
                setError(`Error preparing upload for ${file.name}: ${err.message}`);
            }
        }

        setUploading(false);
    };

    const handleViewDetails = (file, index) => {
        setSelectedFile({ ...file, index });
        setDetailsOpen(true);
    };

    const allUploaded = files.length > 0 &&
        files.every((_, i) => uploadStatus[i] === 'success');

    return (
        <Box sx={{ mt: 2 }}>
            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                    <IconButton
                        size="small"
                        sx={{ ml: 1 }}
                        onClick={() => setError(null)}
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Alert>
            )}

            {/* Carrier Selection Dropdown */}
            <Paper
                elevation={0}
                sx={{
                    border: carrierError ? '1px solid #d32f2f' : '1px solid #eee',
                    borderRadius: 1,
                    mb: 3,
                    p: 3,
                    backgroundColor: carrierError ? 'rgba(211, 47, 47, 0.04)' : 'background.paper'
                }}
            >
                <Typography variant="h6" gutterBottom>
                    Select Carrier <span style={{ color: '#d32f2f' }}>*</span>
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Choose the carrier associated with this EDI file (required)
                </Typography>

                <FormControl
                    fullWidth
                    error={carrierError}
                    sx={{ mb: carrierError ? 0 : 2 }}
                    required
                >
                    <InputLabel id="carrier-select-label">Carrier</InputLabel>
                    <Select
                        labelId="carrier-select-label"
                        id="carrier-select"
                        value={selectedCarrier}
                        label="Carrier"
                        onChange={handleCarrierChange}
                    >
                        <MenuItem value="" disabled>
                            <em>Select a carrier</em>
                        </MenuItem>
                        {CARRIERS.map((carrier) => (
                            <MenuItem key={carrier} value={carrier}>
                                {carrier}
                            </MenuItem>
                        ))}
                    </Select>
                    {carrierError && (
                        <FormHelperText error>Please select a carrier before uploading files</FormHelperText>
                    )}
                </FormControl>
            </Paper>

            <Paper
                elevation={0}
                sx={{
                    border: '1px solid #eee',
                    borderRadius: 1,
                    mb: 3,
                    p: 3,
                    backgroundColor: dragActive ? 'action.hover' : 'background.paper',
                    transition: 'background-color 0.3s ease'
                }}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
            >
                <Box
                    sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        p: 4,
                        border: '2px dashed',
                        borderColor: dragActive ? 'primary.main' : 'divider',
                        borderRadius: 1,
                        cursor: 'pointer',
                    }}
                    onClick={onButtonClick}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".csv"
                        onChange={handleFileInputChange}
                        style={{ display: 'none' }}
                    />
                    <CloudUploadIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                    <Typography variant="h6" gutterBottom>
                        {selectedCarrier
                            ? 'Drop EDI/Shipment CSV files here'
                            : 'Select a carrier first'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" align="center">
                        {selectedCarrier
                            ? 'or click to select files (CSV only)'
                            : 'You must select a carrier before uploading files'}
                    </Typography>
                </Box>
            </Paper>

            {files.length > 0 && (
                <Box sx={{ mb: 3 }}>
                    <Typography variant="h6" sx={{ mb: 2 }}>
                        Files to Upload ({files.length})
                    </Typography>

                    <Stack spacing={2}>
                        {files.map((file, index) => (
                            <Paper
                                key={index}
                                elevation={0}
                                sx={{
                                    p: 2,
                                    border: '1px solid #eee',
                                    borderRadius: 1,
                                }}
                            >
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                                    <Typography variant="subtitle1" noWrap sx={{ maxWidth: '70%' }}>
                                        {file.name}
                                    </Typography>
                                    <Box>
                                        <Chip
                                            size="small"
                                            label={uploadStatus[index] === 'success' ? 'Uploaded' :
                                                uploadStatus[index] === 'error' ? 'Failed' :
                                                    uploading && uploadProgress[index] ? 'Uploading' : 'Ready'}
                                            color={uploadStatus[index] === 'success' ? 'success' :
                                                uploadStatus[index] === 'error' ? 'error' : 'primary'}
                                            sx={{ mr: 1 }}
                                        />
                                        <IconButton
                                            size="small"
                                            onClick={() => handleViewDetails(file, index)}
                                        >
                                            <InfoIcon fontSize="small" />
                                        </IconButton>
                                        <IconButton
                                            size="small"
                                            onClick={() => removeFile(index)}
                                            disabled={uploading && !uploadStatus[index]}
                                        >
                                            <DeleteIcon fontSize="small" />
                                        </IconButton>
                                    </Box>
                                </Box>

                                {(uploading || uploadProgress[index]) && !uploadStatus[index] && (
                                    <Box sx={{ width: '100%' }}>
                                        <LinearProgress
                                            variant="determinate"
                                            value={uploadProgress[index] || 0}
                                            sx={{ height: 5, borderRadius: 5 }}
                                        />
                                        <Typography variant="caption" color="text.secondary">
                                            {Math.round(uploadProgress[index] || 0)}%
                                        </Typography>
                                    </Box>
                                )}

                                {uploadStatus[index] === 'success' && (
                                    <Typography variant="caption" color="success.main">
                                        File uploaded successfully and queued for processing
                                    </Typography>
                                )}

                                {uploadStatus[index] === 'error' && (
                                    <Typography variant="caption" color="error">
                                        Upload failed. Please try again.
                                    </Typography>
                                )}
                            </Paper>
                        ))}
                    </Stack>

                    <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button
                            variant="contained"
                            onClick={uploadFiles}
                            disabled={uploading || files.length === 0 || allUploaded}
                        >
                            {allUploaded ? 'All Files Uploaded' : uploading ? 'Uploading...' : 'Upload Files'}
                        </Button>
                    </Box>
                </Box>
            )}

            <Dialog
                open={detailsOpen}
                onClose={() => setDetailsOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    <Box display="flex" alignItems="center" justifyContent="space-between">
                        <Typography variant="h6">File Details</Typography>
                        <IconButton onClick={() => setDetailsOpen(false)} size="small">
                            <CloseIcon />
                        </IconButton>
                    </Box>
                </DialogTitle>
                <DialogContent dividers>
                    {selectedFile && (
                        <Stack spacing={2}>
                            <Box>
                                <Typography variant="subtitle2" color="text.secondary">File Name</Typography>
                                <Typography variant="body1">{selectedFile.name}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="subtitle2" color="text.secondary">File Size</Typography>
                                <Typography variant="body1">{(selectedFile.size / 1024).toFixed(2)} KB</Typography>
                            </Box>
                            <Box>
                                <Typography variant="subtitle2" color="text.secondary">File Type</Typography>
                                <Typography variant="body1">{selectedFile.type || 'text/csv'}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="subtitle2" color="text.secondary">Last Modified</Typography>
                                <Typography variant="body1">
                                    {new Date(selectedFile.lastModified).toLocaleString()}
                                </Typography>
                            </Box>
                            <Box>
                                <Typography variant="subtitle2" color="text.secondary">Selected Carrier</Typography>
                                <Typography variant="body1">{selectedCarrier || 'None selected'}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="subtitle2" color="text.secondary">Upload Status</Typography>
                                <Chip
                                    label={uploadStatus[selectedFile.index] === 'success' ? 'Uploaded' :
                                        uploadStatus[selectedFile.index] === 'error' ? 'Failed' :
                                            uploading && uploadProgress[selectedFile.index] ? 'Uploading' : 'Ready'}
                                    color={uploadStatus[selectedFile.index] === 'success' ? 'success' :
                                        uploadStatus[selectedFile.index] === 'error' ? 'error' : 'primary'}
                                    size="small"
                                />
                            </Box>
                            {uploadStatus[selectedFile.index] === 'success' && selectedFile.docId && (
                                <Box>
                                    <Typography variant="subtitle2" color="text.secondary">Processing ID</Typography>
                                    <Typography variant="body1">{selectedFile.docId}</Typography>
                                </Box>
                            )}
                        </Stack>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDetailsOpen(false)}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default EDIUploader; 