import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Alert,
    Tooltip,
    Chip,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    InputAdornment,
    CircularProgress,
    Avatar
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    ContentCopy as ContentCopyIcon,
    Refresh as RefreshIcon,
    LocalShipping as LocalShippingIcon,
} from '@mui/icons-material';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import './CarrierKeys.css';

const CarrierKeys = () => {
    const [keys, setKeys] = useState([]);
    const [carriers, setCarriers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [selectedKey, setSelectedKey] = useState(null);
    const [showSecret, setShowSecret] = useState(false);
    const [formData, setFormData] = useState({
        carrierId: '',
        name: '',
        description: '',
        permissions: [],
        status: 'active',
        expiresAt: '',
    });

    // Add local implementation of generateApiKey
    const generateApiKey = (length = 32) => {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    };

    useEffect(() => {
        fetchCarriers();
        fetchKeys();
    }, []);

    const fetchCarriers = async () => {
        try {
            const carriersRef = collection(db, 'carriers');
            const querySnapshot = await getDocs(carriersRef);
            const carriersData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setCarriers(carriersData);
        } catch (err) {
            setError('Error fetching carriers: ' + err.message);
        }
    };

    const fetchKeys = async () => {
        try {
            setLoading(true);
            const keysRef = collection(db, 'carrierKeys');
            const querySnapshot = await getDocs(keysRef);
            const keysData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setKeys(keysData);
        } catch (err) {
            setError('Error fetching API keys: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleOpenDialog = (key = null) => {
        if (key) {
            setSelectedKey(key);
            setFormData({
                carrierId: key.carrierId,
                name: key.name,
                description: key.description,
                permissions: key.permissions || [],
                status: key.status,
                expiresAt: key.expiresAt ? new Date(key.expiresAt).toISOString().split('T')[0] : '',
            });
        } else {
            setSelectedKey(null);
            setFormData({
                carrierId: '',
                name: '',
                description: '',
                permissions: [],
                status: 'active',
                expiresAt: '',
            });
        }
        setOpenDialog(true);
    };

    const handleCloseDialog = () => {
        setSelectedKey(null);
        setFormData({
            carrierId: '',
            name: '',
            description: '',
            permissions: [],
            status: 'active',
            expiresAt: '',
        });
        setOpenDialog(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            const keyData = {
                ...formData,
                updatedAt: new Date(),
            };

            if (selectedKey) {
                // Update existing key
                await updateDoc(doc(db, 'carrierKeys', selectedKey.id), keyData);
            } else {
                // Create new key
                const apiKey = generateApiKey();
                const secretKey = generateApiKey();
                keyData.apiKey = apiKey;
                keyData.secretKey = secretKey;
                keyData.createdAt = new Date();
                await addDoc(collection(db, 'carrierKeys'), keyData);
            }

            fetchKeys();
            handleCloseDialog();
            setSuccess(selectedKey ? 'API key updated successfully' : 'API key created successfully');
        } catch (err) {
            setError('Error saving API key: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (keyId) => {
        if (window.confirm('Are you sure you want to delete this API key?')) {
            try {
                setLoading(true);
                await deleteDoc(doc(db, 'carrierKeys', keyId));
                fetchKeys();
                setSuccess('API key deleted successfully');
            } catch (err) {
                setError('Error deleting API key: ' + err.message);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleRegenerateSecret = async (keyId) => {
        if (window.confirm('Are you sure you want to regenerate the secret key? This will invalidate the current secret key.')) {
            try {
                setLoading(true);
                const newSecretKey = generateApiKey();
                await updateDoc(doc(db, 'carrierKeys', keyId), {
                    secretKey: newSecretKey,
                    updatedAt: new Date(),
                });
                fetchKeys();
                setSuccess('Secret key regenerated successfully');
            } catch (err) {
                setError('Error regenerating secret key: ' + err.message);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleCopyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        setSuccess('Copied to clipboard');
    };

    const getCarrierName = (carrierId) => {
        const carrier = carriers.find(c => c.id === carrierId);
        return carrier ? carrier.name : 'Unknown Carrier';
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'active':
                return 'success';
            case 'inactive':
                return 'error';
            case 'expired':
                return 'warning';
            default:
                return 'default';
        }
    };

    if (loading) {
        return (
            <Box className="carrier-keys-loading">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box className="carrier-keys-container">
            <Box className="carrier-keys-header">
                <Typography variant="h4" className="carrier-keys-title">
                    Carrier API Keys
                </Typography>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => handleOpenDialog()}
                >
                    Create API Key
                </Button>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {error}
                </Alert>
            )}

            {success && (
                <Alert severity="success" sx={{ mb: 2 }}>
                    {success}
                </Alert>
            )}

            <TableContainer component={Paper} className="carrier-keys-table">
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Carrier</TableCell>
                            <TableCell>API Key</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>Created At</TableCell>
                            <TableCell>Expires At</TableCell>
                            <TableCell>Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {keys.map((key) => (
                            <TableRow key={key.id}>
                                <TableCell>{key.name}</TableCell>
                                <TableCell>{getCarrierName(key.carrierId)}</TableCell>
                                <TableCell>
                                    <Box className="api-key-cell">
                                        <Typography variant="body2" className="api-key-text">
                                            {key.apiKey}
                                        </Typography>
                                        <Tooltip title="Copy API Key">
                                            <IconButton
                                                size="small"
                                                onClick={() => handleCopyToClipboard(key.apiKey)}
                                            >
                                                <ContentCopyIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                    </Box>
                                </TableCell>
                                <TableCell>
                                    <Chip
                                        label={key.status}
                                        color={getStatusColor(key.status)}
                                        size="small"
                                    />
                                </TableCell>
                                <TableCell>
                                    {new Date(key.createdAt).toLocaleDateString()}
                                </TableCell>
                                <TableCell>
                                    {key.expiresAt ? new Date(key.expiresAt).toLocaleDateString() : 'Never'}
                                </TableCell>
                                <TableCell>
                                    <Tooltip title="View Secret Key">
                                        <IconButton
                                            size="small"
                                            onClick={() => setShowSecret(!showSecret)}
                                        >
                                            {showSecret ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Regenerate Secret">
                                        <IconButton
                                            size="small"
                                            onClick={() => handleRegenerateSecret(key.id)}
                                        >
                                            <RefreshIcon />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Edit">
                                        <IconButton
                                            size="small"
                                            onClick={() => handleOpenDialog(key)}
                                        >
                                            <EditIcon />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete">
                                        <IconButton
                                            size="small"
                                            color="error"
                                            onClick={() => handleDelete(key.id)}
                                        >
                                            <DeleteIcon />
                                        </IconButton>
                                    </Tooltip>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* API Key Form Dialog */}
            <Dialog
                open={openDialog}
                onClose={handleCloseDialog}
                maxWidth="md"
                fullWidth
            >
                <DialogTitle>
                    {selectedKey ? 'Edit API Key' : 'Create New API Key'}
                </DialogTitle>
                <form onSubmit={handleSubmit}>
                    <DialogContent>
                        <Grid container spacing={3}>
                            <Grid item xs={12}>
                                <FormControl fullWidth required>
                                    <InputLabel>Carrier</InputLabel>
                                    <Select
                                        value={formData.carrierId}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            carrierId: e.target.value
                                        }))}
                                        label="Carrier"
                                        sx={{
                                            '& .MuiSelect-select': {
                                                display: 'flex',
                                                alignItems: 'center'
                                            }
                                        }}
                                        MenuProps={{
                                            PaperProps: {
                                                sx: {
                                                    maxHeight: 400,
                                                    '& .MuiMenuItem-root': {
                                                        fontSize: '12px'
                                                    }
                                                }
                                            }
                                        }}
                                    >
                                        {carriers.map((carrier) => (
                                            <MenuItem key={carrier.id} value={carrier.id} sx={{ py: 1.5 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                                                    {/* Carrier Logo */}
                                                    <Avatar
                                                        src={carrier.logoURL}
                                                        sx={{
                                                            width: 28,
                                                            height: 28,
                                                            border: '1px solid #e5e7eb',
                                                            bgcolor: '#f8fafc'
                                                        }}
                                                    >
                                                        <LocalShippingIcon sx={{ fontSize: 16, color: '#6b7280' }} />
                                                    </Avatar>

                                                    {/* Carrier Details */}
                                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                                        <Typography
                                                            sx={{
                                                                fontWeight: 600,
                                                                fontSize: '14px',
                                                                color: '#374151',
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis'
                                                            }}
                                                        >
                                                            {carrier.name}
                                                        </Typography>
                                                        <Typography
                                                            sx={{
                                                                fontSize: '11px',
                                                                color: '#6b7280',
                                                                whiteSpace: 'nowrap',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis'
                                                            }}
                                                        >
                                                            ID: {carrier.carrierID}
                                                        </Typography>
                                                    </Box>

                                                    {/* Status Chip */}
                                                    <Chip
                                                        label={carrier.enabled ? 'Active' : 'Inactive'}
                                                        size="small"
                                                        color={carrier.enabled ? 'success' : 'default'}
                                                        sx={{
                                                            height: 20,
                                                            fontSize: '10px',
                                                            fontWeight: 500
                                                        }}
                                                    />
                                                </Box>
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    label="Key Name"
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        name: e.target.value
                                    }))}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    multiline
                                    rows={2}
                                    label="Description"
                                    value={formData.description}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        description: e.target.value
                                    }))}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12}>
                                <FormControl fullWidth required>
                                    <InputLabel>Status</InputLabel>
                                    <Select
                                        value={formData.status}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            status: e.target.value
                                        }))}
                                        label="Status"
                                    >
                                        <MenuItem value="active">Active</MenuItem>
                                        <MenuItem value="inactive">Inactive</MenuItem>
                                        <MenuItem value="expired">Expired</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                            <Grid item xs={12}>
                                <TextField
                                    fullWidth
                                    type="date"
                                    label="Expires At"
                                    value={formData.expiresAt}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        expiresAt: e.target.value
                                    }))}
                                    InputLabelProps={{
                                        shrink: true,
                                    }}
                                />
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions>
                        <Button
                            variant="outlined"
                            onClick={handleCloseDialog}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={loading}
                        >
                            {loading ? 'Saving...' : 'Save'}
                        </Button>
                    </DialogActions>
                </form>
            </Dialog>
        </Box>
    );
};

export default CarrierKeys; 