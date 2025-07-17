import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Typography,
    Grid,
    IconButton,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Alert,
    Divider
} from '@mui/material';
import {
    Close as CloseIcon,
    CloudUpload as UploadIcon,
    Delete as DeleteIcon
} from '@mui/icons-material';
import { db, functions } from '../../firebase/firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import EmailContactsManager from '../common/EmailContactsManager';

const QuickShipCarrierDialog = ({
    open,
    onClose,
    onSave,
    onSuccess,
    editingCarrier = null,
    existingCarriers = [],
    companyId
}) => {
    // DEBUG: Log prop changes
    console.log('🚪 QuickShipCarrierDialog props:', {
        open,
        editingCarrier: !!editingCarrier,
        companyId,
        receivedOpen: open
    });

    if (open) {
        console.log('🎯 DIALOG RECEIVED OPEN=TRUE!');
    }
    const [loading, setLoading] = useState(false);
    const [errors, setErrors] = useState({});
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState('');
    const [uploading, setUploading] = useState(false);

    // Form data state
    const [formData, setFormData] = useState({
        name: '',
        carrierId: '',
        accountNumber: '',
        phone: '',
        type: 'freight', // Default to freight for QuickShip carriers
        emailContacts: [], // New terminal-based structure
        // Legacy fields for backward compatibility
        contactEmail: '',
        billingEmail: '',
        logo: '',
        enabled: true
    });

    // Initialize form data when editing
    useEffect(() => {
        if (editingCarrier) {
            // Handle both new format and legacy format
            let emailContacts = [];

            if (editingCarrier.emailContacts && Array.isArray(editingCarrier.emailContacts)) {
                // New terminal format
                emailContacts = editingCarrier.emailContacts;
            } else {
                // Legacy format - migrate to new structure
                const defaultTerminal = {
                    id: 'default',
                    name: 'Default Terminal',
                    isDefault: true,
                    contacts: [
                        { type: 'dispatch', emails: editingCarrier.contactEmail ? [editingCarrier.contactEmail] : [] },
                        { type: 'customer_service', emails: [] },
                        { type: 'quotes', emails: [] },
                        { type: 'billing_adjustments', emails: editingCarrier.billingEmail ? [editingCarrier.billingEmail] : [] },
                        { type: 'claims', emails: [] },
                        { type: 'sales_reps', emails: [] },
                        { type: 'customs', emails: [] },
                        { type: 'other', emails: [] }
                    ]
                };
                emailContacts = [defaultTerminal];
            }

            setFormData({
                name: editingCarrier.name || '',
                carrierId: editingCarrier.carrierId || '',
                accountNumber: editingCarrier.accountNumber || '',
                phone: editingCarrier.phone || '',
                type: editingCarrier.type || 'freight', // Default to freight if not set
                emailContacts: emailContacts,
                // Maintain legacy fields for backward compatibility
                contactEmail: editingCarrier.contactEmail || '',
                billingEmail: editingCarrier.billingEmail || '',
                logo: editingCarrier.logo || '',
                enabled: editingCarrier.enabled !== false
            });

            if (editingCarrier.logo) {
                setLogoPreview(editingCarrier.logo);
            }
        } else {
            // Initialize new carrier with default terminal
            const defaultTerminal = {
                id: 'default',
                name: 'Default Terminal',
                isDefault: true,
                contacts: [
                    { type: 'dispatch', emails: [] },
                    { type: 'customer_service', emails: [] },
                    { type: 'quotes', emails: [] },
                    { type: 'billing_adjustments', emails: [] },
                    { type: 'claims', emails: [] },
                    { type: 'sales_reps', emails: [] },
                    { type: 'customs', emails: [] },
                    { type: 'other', emails: [] }
                ]
            };

            setFormData({
                name: '',
                carrierId: '',
                accountNumber: '',
                phone: '',
                type: 'freight', // Default to freight for new carriers
                emailContacts: [defaultTerminal],
                contactEmail: '',
                billingEmail: '',
                logo: '',
                enabled: true
            });
        }
    }, [editingCarrier, editingCarrier?.updatedAt, editingCarrier?.emailContacts]);

    const handleInputChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));

        // Clear errors when user starts typing
        if (errors[field]) {
            setErrors(prev => ({ ...prev, [field]: null }));
        }

        // Auto-generate carrier ID from name
        if (field === 'name' && !editingCarrier) {
            const generatedId = value
                .toUpperCase()
                .replace(/[^A-Z0-9\s]/g, '')
                .replace(/\s+/g, '')
                .substring(0, 20);
            setFormData(prev => ({ ...prev, carrierId: generatedId }));
        }
    };

    const handleEmailContactsChange = (newEmailContacts) => {
        console.log('📧 EmailContactsManager onChange called with:', newEmailContacts);

        // Update legacy fields for backward compatibility
        const primaryDispatchEmail = getLegacyContactEmail(newEmailContacts, 'dispatch');
        const primaryBillingEmail = getLegacyContactEmail(newEmailContacts, 'billing_adjustments');

        // Update all fields in a single call to prevent race conditions
        setFormData(prev => ({
            ...prev,
            emailContacts: newEmailContacts,
            contactEmail: primaryDispatchEmail,
            billingEmail: primaryBillingEmail
        }));

        console.log('📧 Updated formData with emailContacts:', {
            emailContactsLength: newEmailContacts.length,
            primaryDispatchEmail,
            primaryBillingEmail
        });
    };

    // Helper to extract primary email for legacy compatibility
    const getLegacyContactEmail = (emailContacts, contactType) => {
        if (!emailContacts || !Array.isArray(emailContacts)) return '';

        // Find from default terminal first
        const defaultTerminal = emailContacts.find(terminal => terminal.isDefault);
        const terminal = defaultTerminal || emailContacts[0];

        if (!terminal || !terminal.contacts) return '';

        const contact = terminal.contacts.find(c => c.type === contactType);
        return contact && contact.emails && contact.emails.length > 0 ? contact.emails[0] : '';
    };

    const handleLogoUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            setErrors(prev => ({ ...prev, logo: 'Please select an image file' }));
            return;
        }

        // Validate file size (2MB limit)
        if (file.size > 2 * 1024 * 1024) {
            setErrors(prev => ({ ...prev, logo: 'Image must be less than 2MB' }));
            return;
        }

        setLogoFile(file);

        // Create preview
        const reader = new FileReader();
        reader.onload = (e) => setLogoPreview(e.target.result);
        reader.readAsDataURL(file);

        // Clear logo error
        setErrors(prev => ({ ...prev, logo: null }));
    };

    const handleLogoDelete = () => {
        setLogoFile(null);
        setLogoPreview('');
        setFormData(prev => ({ ...prev, logo: '' }));
    };

    const validateForm = () => {
        const newErrors = {};

        if (!formData.name.trim()) {
            newErrors.name = 'Carrier name is required';
        }

        if (!formData.carrierId.trim()) {
            newErrors.carrierId = 'Carrier ID is required';
        }

        // Check for duplicate carrier ID (excluding current carrier when editing)
        const isDuplicate = existingCarriers.some(carrier =>
            carrier.carrierId === formData.carrierId &&
            (!editingCarrier || carrier.id !== editingCarrier.id)
        );
        if (isDuplicate) {
            newErrors.carrierId = 'Carrier ID already exists';
        }

        // Email contacts are now optional - no validation required

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSave = async () => {
        if (!validateForm()) return;

        setLoading(true);
        try {
            let logoUrl = formData.logo;

            // Upload logo if a new file was selected
            if (logoFile) {
                setUploading(true);
                try {
                    // Convert file to base64 for cloud function upload
                    const fileReader = new FileReader();
                    const base64Promise = new Promise((resolve, reject) => {
                        fileReader.onload = () => {
                            const result = fileReader.result;
                            // Remove data:image/jpeg;base64, prefix
                            const base64Data = result.split(',')[1];
                            resolve(base64Data);
                        };
                        fileReader.onerror = reject;
                    });

                    fileReader.readAsDataURL(logoFile);
                    const base64Data = await base64Promise;

                    // Use cloud function for upload
                    const uploadFunction = httpsCallable(functions, 'uploadFileBase64');
                    const uploadResult = await uploadFunction({
                        fileName: `carrier-${formData.carrierId}-${Date.now()}.${logoFile.name.split('.').pop()}`,
                        fileData: base64Data,
                        fileType: logoFile.type,
                        fileSize: logoFile.size
                    });

                    if (uploadResult.data.success) {
                        logoUrl = uploadResult.data.downloadURL;
                        console.log('✅ Logo uploaded successfully:', logoUrl);
                    } else {
                        throw new Error(uploadResult.data.error || 'Upload failed');
                    }
                } catch (uploadError) {
                    console.error('❌ Logo upload failed:', uploadError);
                    setErrors(prev => ({ ...prev, logo: 'Failed to upload logo. Please try again.' }));
                    // Continue with save even if logo upload fails - use existing logo
                    logoUrl = formData.logo; // Keep existing logo
                }
            }

            const carrierData = {
                name: formData.name.trim(),
                carrierId: formData.carrierId.trim(),
                accountNumber: formData.accountNumber.trim(),
                phone: formData.phone.trim(),
                type: formData.type, // Include carrier type (courier/freight)
                emailContacts: formData.emailContacts,
                // Maintain legacy fields for backward compatibility
                contactEmail: formData.contactEmail,
                billingEmail: formData.billingEmail,
                logo: logoUrl,
                enabled: formData.enabled,
                companyID: companyId, // CRITICAL: Add companyID so carrier shows up in list
                updatedAt: new Date().toISOString()
            };

            console.log('💾 About to save carrier data:', {
                carrierName: carrierData.name,
                emailContactsLength: carrierData.emailContacts?.length,
                emailContacts: carrierData.emailContacts,
                firstTerminalContactCount: carrierData.emailContacts?.[0]?.contacts?.length
            });

            if (editingCarrier) {
                // Update existing carrier
                await updateDoc(doc(db, 'quickshipCarriers', editingCarrier.id), carrierData);
                console.log('✅ QuickShip Carrier updated successfully');
            } else {
                // Create new carrier
                carrierData.createdAt = new Date().toISOString();
                const docRef = await addDoc(collection(db, 'quickshipCarriers'), carrierData);
                carrierData.id = docRef.id;
                console.log('✅ QuickShip Carrier created successfully');
            }

            // Call success callbacks
            if (onSave) {
                onSave(carrierData);
            }
            if (onSuccess) {
                onSuccess(carrierData, !!editingCarrier);
            }

            handleClose();
        } catch (error) {
            console.error('❌ Error saving carrier:', error);
            setErrors({ submit: 'Failed to save carrier. Please try again.' });
        } finally {
            setLoading(false);
            setUploading(false);
        }
    };

    const handleClose = () => {
        setFormData({
            name: '',
            carrierId: '',
            accountNumber: '',
            phone: '',
            type: 'freight', // Default to freight for new carriers
            emailContacts: [{
                id: 'default',
                name: 'Default Terminal',
                isDefault: true,
                contacts: [
                    { type: 'dispatch', emails: [] },
                    { type: 'customer_service', emails: [] },
                    { type: 'quotes', emails: [] },
                    { type: 'billing_adjustments', emails: [] },
                    { type: 'claims', emails: [] },
                    { type: 'sales_reps', emails: [] },
                    { type: 'customs', emails: [] },
                    { type: 'other', emails: [] }
                ]
            }],
            contactEmail: '',
            billingEmail: '',
            logo: '',
            enabled: true
        });
        setLogoFile(null);
        setLogoPreview('');
        setErrors({});
        if (onClose) onClose();
    };

    const getTotalEmailCount = () => {
        return formData.emailContacts.reduce((total, terminal) => {
            return total + terminal.contacts.reduce((terminalTotal, contact) => {
                return terminalTotal + contact.emails.filter(email => email.trim()).length;
            }, 0);
        }, 0);
    };

    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{
                sx: { maxHeight: '90vh' }
            }}
        >
            <DialogTitle>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                        {editingCarrier ? 'Edit Carrier' : 'Add New Carrier'}
                    </Typography>
                    <IconButton onClick={handleClose} size="small">
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>

            <DialogContent>
                <Box sx={{ mt: 1 }}>
                    {/* Basic Information */}
                    <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 2 }}>
                        Basic Information
                    </Typography>
                    <Grid container spacing={2} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Carrier Name *"
                                value={formData.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                                error={!!errors.name}
                                helperText={errors.name}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Carrier ID *"
                                value={formData.carrierId}
                                onChange={(e) => handleInputChange('carrierId', e.target.value.toUpperCase())}
                                error={!!errors.carrierId}
                                helperText={errors.carrierId || 'Unique identifier for this carrier'}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Account Number"
                                value={formData.accountNumber}
                                onChange={(e) => handleInputChange('accountNumber', e.target.value)}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                size="small"
                                label="Phone Number"
                                value={formData.phone}
                                onChange={(e) => handleInputChange('phone', e.target.value)}
                                InputLabelProps={{ sx: { fontSize: '12px' } }}
                                InputProps={{ sx: { fontSize: '12px' } }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel sx={{ fontSize: '12px' }}>Carrier Type</InputLabel>
                                <Select
                                    value={formData.type}
                                    onChange={(e) => handleInputChange('type', e.target.value)}
                                    label="Carrier Type"
                                    sx={{ fontSize: '12px' }}
                                >
                                    <MenuItem value="courier" sx={{ fontSize: '12px' }}>
                                        Courier
                                    </MenuItem>
                                    <MenuItem value="freight" sx={{ fontSize: '12px' }}>
                                        Freight
                                    </MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>

                    {/* Logo Upload */}
                    <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 2 }}>
                        Carrier Logo
                    </Typography>
                    <Box sx={{ mb: 3 }}>
                        <input
                            accept="image/*"
                            style={{ display: 'none' }}
                            id="logo-upload"
                            type="file"
                            onChange={handleLogoUpload}
                        />
                        <label htmlFor="logo-upload">
                            <Button
                                variant="outlined"
                                component="span"
                                startIcon={<UploadIcon />}
                                size="small"
                                sx={{ fontSize: '12px' }}
                            >
                                {logoPreview ? 'Change Logo' : 'Upload Logo'}
                            </Button>
                        </label>

                        {logoPreview && (
                            <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                                <img
                                    src={logoPreview}
                                    alt="Logo preview"
                                    style={{
                                        width: 100,
                                        height: 60,
                                        objectFit: 'contain',
                                        border: '1px solid #e0e0e0',
                                        borderRadius: 4
                                    }}
                                />
                                <Button
                                    variant="outlined"
                                    color="error"
                                    size="small"
                                    startIcon={<DeleteIcon />}
                                    onClick={handleLogoDelete}
                                    sx={{ fontSize: '12px' }}
                                >
                                    Remove
                                </Button>
                            </Box>
                        )}

                        {errors.logo && (
                            <Typography variant="caption" color="error" sx={{ fontSize: '11px', mt: 1, display: 'block' }}>
                                {errors.logo}
                            </Typography>
                        )}
                    </Box>

                    <Divider sx={{ my: 3 }} />

                    {/* Email Contacts */}
                    <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 1 }}>
                        Email Contacts
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px', mb: 2 }}>
                        Organize carrier contacts by terminal and function. {getTotalEmailCount()} contact{getTotalEmailCount() !== 1 ? 's' : ''} configured.
                    </Typography>

                    <EmailContactsManager
                        value={formData.emailContacts}
                        onChange={handleEmailContactsChange}
                        mode="full"
                        maxTerminals={10}
                        maxEmailsPerType={5}
                    />

                    {errors.emailContacts && (
                        <Alert severity="error" sx={{ mt: 2, fontSize: '12px' }}>
                            {errors.emailContacts}
                        </Alert>
                    )}

                    {/* Submit Error */}
                    {errors.submit && (
                        <Alert severity="error" sx={{ mt: 2 }}>
                            {errors.submit}
                        </Alert>
                    )}
                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
                <Button onClick={handleClose} sx={{ fontSize: '12px' }}>
                    Cancel
                </Button>
                <Button
                    onClick={handleSave}
                    variant="contained"
                    disabled={loading || uploading}
                    sx={{ fontSize: '12px' }}
                >
                    {loading ? 'Saving...' : editingCarrier ? 'Update Carrier' : 'Add Carrier'}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default QuickShipCarrierDialog; 