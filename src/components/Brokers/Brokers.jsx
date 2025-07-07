import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Dialog,
    TextField,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Avatar,
    IconButton,
    Menu,
    MenuItem,
    CircularProgress,
    Alert,
    Chip
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    MoreVert as MoreVertIcon,
    Phone as PhoneIcon,
    Email as EmailIcon,
    Business as BusinessIcon
} from '@mui/icons-material';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import QuickShipBrokerDialog from '../CreateShipment/QuickShipBrokerDialog';
import ModalHeader from '../common/ModalHeader';

const Brokers = ({ isModal = false, onClose = null, showCloseButton = false }) => {
    const { currentUser } = useAuth();
    const { companyData, companyIdForAddress } = useCompany();
    const companyId = companyIdForAddress || companyData?.companyID;

    const [loading, setLoading] = useState(true);
    const [brokers, setBrokers] = useState([]);
    const [showBrokerDialog, setShowBrokerDialog] = useState(false);
    const [editingBroker, setEditingBroker] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
    const [selectedBroker, setSelectedBroker] = useState(null);
    const [error, setError] = useState(null);

    // Load company brokers
    const loadBrokers = useCallback(async () => {
        if (!companyId) {
            console.log('⚠️ No companyId provided');
            setBrokers([]);
            setLoading(false);
            return;
        }

        try {
            console.log('🔍 Loading brokers for company:', companyId);
            const brokersQuery = query(
                collection(db, 'companyBrokers'),
                where('companyID', '==', companyId),
                where('enabled', '==', true)
            );

            const querySnapshot = await getDocs(brokersQuery);
            const brokersData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log('✅ Loaded brokers:', brokersData.length);
            setBrokers(brokersData);
        } catch (error) {
            console.error('❌ Error loading brokers:', error);
            setError('Failed to load brokers');
            setBrokers([]);
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    // Load brokers on mount
    useEffect(() => {
        loadBrokers();
    }, [loadBrokers]);

    // Handle broker actions
    const handleAddBroker = () => {
        setEditingBroker(null);
        setShowBrokerDialog(true);
    };

    const handleEditBroker = (broker) => {
        setEditingBroker(broker);
        setShowBrokerDialog(true);
        setActionMenuAnchor(null);
    };

    const handleDeleteBroker = async (broker) => {
        if (!window.confirm(`Are you sure you want to delete ${broker.name}?`)) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'companyBrokers', broker.id));
            await loadBrokers();
            setSuccessMessage(`${broker.name} has been deleted successfully.`);
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (error) {
            console.error('Error deleting broker:', error);
            alert('Failed to delete broker. Please try again.');
        }
        setActionMenuAnchor(null);
    };

    const handleBrokerSaved = async () => {
        setShowBrokerDialog(false);
        setEditingBroker(null);
        await loadBrokers();
        setSuccessMessage('Broker saved successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
    };

    const handleActionMenuOpen = (event, broker) => {
        setSelectedBroker(broker);
        setActionMenuAnchor(event.currentTarget);
    };

    const handleActionMenuClose = () => {
        setActionMenuAnchor(null);
        setSelectedBroker(null);
    };

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            bgcolor: 'white'
        }}>
            {/* Header */}
            {isModal ? (
                <ModalHeader
                    title="Brokers"
                    onClose={onClose}
                    showCloseButton={showCloseButton}
                />
            ) : (
                <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                    <Typography variant="h5" sx={{ fontWeight: 600 }}>
                        Brokers
                    </Typography>
                </Box>
            )}

            {/* Success Message */}
            {successMessage && (
                <Alert severity="success" sx={{ mx: 3, mt: 2 }}>
                    {successMessage}
                </Alert>
            )}

            {/* Content */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                        Company Brokers
                    </Typography>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={handleAddBroker}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Add Broker
                    </Button>
                </Box>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                        <CircularProgress size={24} />
                    </Box>
                ) : error ? (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        {error}
                    </Alert>
                ) : brokers.length === 0 ? (
                    <Alert severity="info" sx={{ mb: 2 }}>
                        <Typography sx={{ fontSize: '14px' }}>
                            No brokers found. Click "Add Broker" to create your first broker.
                        </Typography>
                    </Alert>
                ) : (
                    <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                        <Table size="small">
                            <TableHead>
                                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Broker Name</TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Contact Information</TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Status</TableCell>
                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', width: 50 }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {brokers.map((broker) => (
                                    <TableRow key={broker.id} hover>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Avatar sx={{ width: 32, height: 32, fontSize: '14px', bgcolor: '#3b82f6' }}>
                                                    {broker.name?.charAt(0)?.toUpperCase() || 'B'}
                                                </Avatar>
                                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                    {broker.name || 'Unnamed Broker'}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '12px' }}>
                                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                                {broker.phone && (
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <PhoneIcon sx={{ fontSize: 14, color: '#6b7280' }} />
                                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                            {broker.phone}
                                                        </Typography>
                                                    </Box>
                                                )}
                                                {broker.email && (
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                                        <EmailIcon sx={{ fontSize: 14, color: '#6b7280' }} />
                                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                            {broker.email}
                                                        </Typography>
                                                    </Box>
                                                )}
                                            </Box>
                                        </TableCell>
                                        <TableCell>
                                            <Chip
                                                label={broker.enabled === false ? 'Inactive' : 'Active'}
                                                size="small"
                                                sx={{
                                                    fontSize: '11px',
                                                    height: 20,
                                                    backgroundColor: broker.enabled === false ? '#fee2e2' : '#d1fae5',
                                                    color: broker.enabled === false ? '#dc2626' : '#059669'
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <IconButton
                                                size="small"
                                                onClick={(e) => handleActionMenuOpen(e, broker)}
                                            >
                                                <MoreVertIcon sx={{ fontSize: 18 }} />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}
            </Box>

            {/* Action Menu */}
            <Menu
                anchorEl={actionMenuAnchor}
                open={Boolean(actionMenuAnchor)}
                onClose={handleActionMenuClose}
                PaperProps={{
                    sx: { boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)' }
                }}
            >
                <MenuItem onClick={() => handleEditBroker(selectedBroker)} sx={{ fontSize: '12px' }}>
                    <EditIcon sx={{ fontSize: 16, mr: 1 }} />
                    Edit
                </MenuItem>
                <MenuItem onClick={() => handleDeleteBroker(selectedBroker)} sx={{ fontSize: '12px', color: '#dc2626' }}>
                    <DeleteIcon sx={{ fontSize: 16, mr: 1 }} />
                    Delete
                </MenuItem>
            </Menu>

            {/* Broker Dialog */}
            <QuickShipBrokerDialog
                open={showBrokerDialog}
                onClose={() => setShowBrokerDialog(false)}
                onSuccess={handleBrokerSaved}
                editingBroker={editingBroker}
                existingBrokers={brokers}
                companyId={companyId}
            />
        </Box>
    );
};

export default Brokers; 