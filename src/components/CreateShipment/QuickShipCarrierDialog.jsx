import React, { useState, useEffect, useRef } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Box,
    Typography,
    Grid,
    IconButton,
    Alert,
    Paper,
    CircularProgress,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Avatar
} from '@mui/material';
import {
    Close as CloseIcon,
    Save as SaveIcon,
    CloudUpload as CloudUploadIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db, storage } from '../../firebase/firebase';
import { ref, uploadBytes, getDownloadURL, getStorage } from 'firebase/storage';
import { getApp } from 'firebase/app';

const carrierTypes = [
    { value: 'courier', label: 'Courier' },
    { value: 'freight', label: 'Freight' },
    { value: 'hybrid', label: 'Hybrid' },
];

const QuickShipCarrierDialog = ({
    open,
    onClose,
    onSuccess,
    onCarrierSaved, // Keep for backward compatibility
    companyId,
    editingCarrier = null,
    isEditMode = false,
    existingCarriers = []
}) => {
    const [formData, setFormData] = useState({
        name: '',
        contactName: '',
        contactEmail: '',
        contactPhone: '',
        accountNumber: '',
        carrierType: 'courier',
        billingEmail: '',
        logoURL: ''
    });
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState('');
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef();

    useEffect(() => {
        if (isEditMode && editingCarrier) {
            setFormData({
                name: editingCarrier.name || '',
                contactName: editingCarrier.contactName || '',
                contactEmail: editingCarrier.contactEmail || '',
                contactPhone: editingCarrier.contactPhone || '',
                accountNumber: editingCarrier.accountNumber || '',
                carrierType: editingCarrier.carrierType || 'courier',
                billingEmail: editingCarrier.billingEmail || '',
                logoURL: editingCarrier.logoURL || ''
            });
            setLogoPreview(editingCarrier.logoURL || '');
        } else {
            // Reset form for new carrier
            setFormData({
                name: '',
                contactName: '',
                contactEmail: '',
                contactPhone: '',
                accountNumber: '',
                carrierType: 'courier',
                billingEmail: '',
                logoURL: ''
            });
            setLogoPreview('');
        }
        setLogoFile(null);
        setError('');
    }, [isEditMode, editingCarrier, open]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleLogoUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setError('Please select a valid image file (PNG, JPG, GIF, etc.)');
            return;
        }

        // Validate file size (max 2MB)
        if (file.size > 2 * 1024 * 1024) {
            setError('Logo file size must be less than 2MB');
            return;
        }

        setError('');
        setUploadingLogo(true);

        try {
            // Upload image to Firebase Storage using the same pattern as CompanyForm
            const firebaseApp = getApp();
            const customStorage = getStorage(firebaseApp, "gs://solushipx.firebasestorage.app");
            const fileExtension = file.name.split('.').pop();
            const fileName = `quickship-${companyId}-${Date.now()}.${fileExtension}`;
            const logoRef = ref(customStorage, `quickship-carrier-logos/${fileName}`);

            // Upload file
            const snapshot = await uploadBytes(logoRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            // Update form data and preview with the actual Firebase Storage URL
            setFormData(prev => ({ ...prev, logoURL: downloadURL }));
            setLogoPreview(downloadURL);
            setLogoFile(null);

            console.log('Logo uploaded successfully to:', downloadURL);
        } catch (error) {
            console.error('Error uploading logo:', error);
            setError('Failed to upload logo. Please try again.');
        } finally {
            setUploadingLogo(false);
        }
    };

    const handleRemoveLogo = () => {
        setLogoFile(null);
        setLogoPreview('');
        setFormData(prev => ({ ...prev, logoURL: '' }));
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const validateForm = () => {
        if (!formData.name.trim()) {
            setError('Carrier name is required');
            return false;
        }
        if (!formData.contactName.trim()) {
            setError('Contact name is required');
            return false;
        }
        if (!formData.contactEmail.trim()) {
            setError('Contact email is required');
            return false;
        }
        if (formData.contactEmail && !/\S+@\S+\.\S+/.test(formData.contactEmail)) {
            setError('Please enter a valid email address');
            return false;
        }
        if (formData.billingEmail && !/\S+@\S+\.\S+/.test(formData.billingEmail)) {
            setError('Please enter a valid billing email address');
            return false;
        }
        return true;
    };

    const handleSave = async () => {
        if (!validateForm()) return;

        setSaving(true);
        setError('');

        try {
            const carrierData = {
                name: formData.name.trim(),
                contactName: formData.contactName.trim(),
                contactEmail: formData.contactEmail.trim(),
                contactPhone: formData.contactPhone.trim(),
                accountNumber: formData.accountNumber.trim(),
                carrierType: formData.carrierType,
                billingEmail: formData.billingEmail.trim(),
                logoURL: formData.logoURL,
                companyID: companyId,
                updatedAt: serverTimestamp()
            };

            let savedCarrier;
            if (isEditMode && editingCarrier) {
                await updateDoc(doc(db, 'quickshipCarriers', editingCarrier.id), carrierData);
                savedCarrier = { id: editingCarrier.id, ...carrierData };
            } else {
                carrierData.createdAt = serverTimestamp();
                const docRef = await addDoc(collection(db, 'quickshipCarriers'), carrierData);
                savedCarrier = { id: docRef.id, ...carrierData };
            }

            if (onSuccess) {
                onSuccess(savedCarrier, isEditMode);
            } else if (onCarrierSaved) {
                onCarrierSaved(savedCarrier);
            }

            onClose();
        } catch (error) {
            console.error('Error saving carrier:', error);
            setError('Failed to save carrier. Please try again.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 2,
                    maxHeight: '90vh'
                }
            }}
        >
            <DialogTitle sx={{
                pb: 2,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderBottom: '1px solid #e5e7eb'
            }}>
                <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    {isEditMode ? 'Edit QuickShip Carrier' : 'Add QuickShip Carrier'}
                </Typography>
                <IconButton
                    onClick={onClose}
                    size="small"
                    sx={{ color: '#6b7280' }}
                >
                    <CloseIcon />
                </IconButton>
            </DialogTitle>

            <DialogContent sx={{ pt: 4, p: 3 }}>
                {error && (
                    <Alert severity="error" sx={{ mb: 2, fontSize: '12px' }}>
                        {error}
                    </Alert>
                )}

                <Grid container spacing={3}>
                    {/* Logo Upload Section - Enhanced */}
                    <Grid item xs={12}>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            style={{ display: 'none' }}
                        />
                        <Box
                            sx={{
                                border: '2px dashed #d1d5db',
                                borderRadius: 2,
                                p: 4,
                                textAlign: 'center',
                                cursor: uploadingLogo ? 'default' : 'pointer',
                                bgcolor: uploadingLogo ? '#f3f4f6' : '#f8fafc',
                                transition: 'all 0.2s',
                                minHeight: '160px',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                position: 'relative',
                                '&:hover': !uploadingLogo ? {
                                    borderColor: '#9ca3af',
                                    bgcolor: '#f3f4f6'
                                } : {}
                            }}
                            onClick={!uploadingLogo ? () => fileInputRef.current?.click() : undefined}
                        >
                            {uploadingLogo ? (
                                <>
                                    <CircularProgress size={48} sx={{ mb: 2, color: '#6b7280' }} />
                                    <Typography sx={{ fontSize: '14px', color: '#6b7280', mb: 1 }}>
                                        Uploading logo...
                                    </Typography>
                                    <Typography sx={{ fontSize: '12px', color: '#9ca3af' }}>
                                        Please wait while we upload your carrier logo
                                    </Typography>
                                </>
                            ) : logoPreview ? (
                                <>
                                    <Box sx={{
                                        width: '120px',
                                        height: '80px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        mb: 2,
                                        border: '1px solid #e5e7eb',
                                        borderRadius: 1,
                                        bgcolor: 'white'
                                    }}>
                                        <img
                                            src={logoPreview}
                                            alt="Logo preview"
                                            style={{
                                                maxWidth: '100%',
                                                maxHeight: '100%',
                                                objectFit: 'contain'
                                            }}
                                        />
                                    </Box>
                                    <Typography sx={{ fontSize: '14px', color: '#374151', mb: 1, fontWeight: 500 }}>
                                        Logo uploaded successfully
                                    </Typography>
                                    <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                                        Click to change logo
                                    </Typography>
                                    <Button
                                        variant="outlined"
                                        size="small"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleRemoveLogo();
                                        }}
                                        sx={{ fontSize: '12px' }}
                                    >
                                        Remove Logo
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <CloudUploadIcon sx={{ fontSize: 48, color: '#9ca3af', mb: 2 }} />
                                    <Typography sx={{ fontSize: '16px', color: '#374151', mb: 1, fontWeight: 500 }}>
                                        Upload Carrier Logo
                                    </Typography>
                                    <Typography sx={{ fontSize: '14px', color: '#6b7280', mb: 1 }}>
                                        Click to browse or drag and drop
                                    </Typography>
                                    <Typography sx={{ fontSize: '12px', color: '#9ca3af' }}>
                                        PNG, JPG, GIF up to 2MB
                                    </Typography>
                                </>
                            )}
                        </Box>
                    </Grid>

                    {/* Carrier Name */}
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="Carrier Name"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            required
                            size="small"
                            InputLabelProps={{ shrink: true, sx: { fontSize: '12px' } }}
                            sx={{
                                '& .MuiInputBase-input': {
                                    fontSize: '12px',
                                    '&::placeholder': { fontSize: '12px' }
                                }
                            }}
                        />
                    </Grid>

                    {/* Account Number */}
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="Account Number"
                            value={formData.accountNumber}
                            onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
                            size="small"
                            InputLabelProps={{ shrink: true, sx: { fontSize: '12px' } }}
                            sx={{
                                '& .MuiInputBase-input': {
                                    fontSize: '12px',
                                    '&::placeholder': { fontSize: '12px' }
                                }
                            }}
                        />
                    </Grid>

                    {/* Carrier Type */}
                    <Grid item xs={12} sm={6}>
                        <FormControl fullWidth size="small">
                            <InputLabel shrink sx={{ fontSize: '12px' }}>Carrier Type</InputLabel>
                            <Select
                                value={formData.carrierType}
                                onChange={(e) => setFormData(prev => ({ ...prev, carrierType: e.target.value }))}
                                label="Carrier Type"
                                sx={{
                                    fontSize: '12px',
                                    '& .MuiSelect-select': { fontSize: '12px' }
                                }}
                            >
                                {carrierTypes.map(type => (
                                    <MenuItem key={type.value} value={type.value} sx={{ fontSize: '12px' }}>
                                        {type.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Grid>

                    {/* Billing Email */}
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="Billing Email"
                            type="email"
                            value={formData.billingEmail}
                            onChange={(e) => setFormData(prev => ({ ...prev, billingEmail: e.target.value }))}
                            size="small"
                            InputLabelProps={{ shrink: true, sx: { fontSize: '12px' } }}
                            sx={{
                                '& .MuiInputBase-input': {
                                    fontSize: '12px',
                                    '&::placeholder': { fontSize: '12px' }
                                }
                            }}
                        />
                    </Grid>

                    {/* Contact Name */}
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="Contact Name"
                            value={formData.contactName}
                            onChange={(e) => setFormData(prev => ({ ...prev, contactName: e.target.value }))}
                            required
                            size="small"
                            InputLabelProps={{ shrink: true, sx: { fontSize: '12px' } }}
                            sx={{
                                '& .MuiInputBase-input': {
                                    fontSize: '12px',
                                    '&::placeholder': { fontSize: '12px' }
                                }
                            }}
                        />
                    </Grid>

                    {/* Contact Email */}
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="Contact Email"
                            type="email"
                            value={formData.contactEmail}
                            onChange={(e) => setFormData(prev => ({ ...prev, contactEmail: e.target.value }))}
                            required
                            size="small"
                            InputLabelProps={{ shrink: true, sx: { fontSize: '12px' } }}
                            sx={{
                                '& .MuiInputBase-input': {
                                    fontSize: '12px',
                                    '&::placeholder': { fontSize: '12px' }
                                }
                            }}
                        />
                    </Grid>

                    {/* Contact Phone */}
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            label="Contact Phone"
                            type="tel"
                            value={formData.contactPhone}
                            onChange={(e) => setFormData(prev => ({ ...prev, contactPhone: e.target.value }))}
                            size="small"
                            InputLabelProps={{ shrink: true, sx: { fontSize: '12px' } }}
                            sx={{
                                '& .MuiInputBase-input': {
                                    fontSize: '12px',
                                    '&::placeholder': { fontSize: '12px' }
                                }
                            }}
                        />
                    </Grid>
                </Grid>
            </DialogContent>

            <DialogActions sx={{
                px: 3,
                pb: 2,
                borderTop: '1px solid #e5e7eb',
                justifyContent: 'flex-end',
                gap: 1
            }}>
                <Button
                    onClick={onClose}
                    size="small"
                    sx={{ fontSize: '12px' }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleSave}
                    variant="contained"
                    size="small"
                    disabled={saving}
                    startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />}
                    sx={{ fontSize: '12px', minWidth: '100px' }}
                >
                    {saving ? 'Saving...' : (isEditMode ? 'Update' : 'Add Carrier')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default QuickShipCarrierDialog; 