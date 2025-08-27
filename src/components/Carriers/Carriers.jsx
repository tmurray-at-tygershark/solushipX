import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Card,
    CardContent,
    CardMedia,
    Button,
    Switch,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControlLabel,
    Radio,
    RadioGroup,
    FormControl,
    FormLabel,
    IconButton,
    Tooltip,
    Chip,
    Tabs,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Avatar,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText,
    CircularProgress,
    Alert,
    InputLabel,
    Select,
    Input
} from '@mui/material';
import {
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
    Add as AddIcon,
    MoreVert as MoreVertIcon,
    LocalShipping as LocalShippingIcon,
    Business as BusinessIcon,
    Speed as SpeedIcon,
    Settings as SettingsIcon,
    VpnKey as CredentialsIcon,
    CloudUpload as CloudUploadIcon,
    Remove as RemoveIcon
} from '@mui/icons-material';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, query, where, orderBy, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';

// Import components with error boundary protection
let QuickShipCarrierDialog;
let ModalHeader;

try {
    QuickShipCarrierDialog = require('../CreateShipment/QuickShipCarrierDialog').default;
} catch (error) {
    console.error('Error importing QuickShipCarrierDialog:', error);
    QuickShipCarrierDialog = () => <div>QuickShip Carrier Dialog failed to load</div>;
}

try {
    ModalHeader = require('../common/ModalHeader').default;
} catch (error) {
    console.error('Error importing ModalHeader:', error);
    ModalHeader = ({ title, onClose, showCloseButton }) => (
        <Box sx={{ p: 2, borderBottom: '1px solid #e5e7eb' }}>
            <Typography variant="h6">{title}</Typography>
            {showCloseButton && <Button onClick={onClose}>Close</Button>}
        </Box>
    );
}

const Carriers = ({ isModal = false, onClose = null, showCloseButton = false }) => {
    console.log('🚢 Carriers component initializing...', { isModal, showCloseButton });

    // Context and Auth - always call hooks at top level
    const { currentUser } = useAuth();
    const { companyData, companyIdForAddress } = useCompany();

    // Use the correct company ID - either from companyIdForAddress or from companyData.companyID
    const companyId = companyIdForAddress || companyData?.companyID;
    console.log('🆔 Using company ID:', companyId);

    // States - always call at top level
    const [selectedTab, setSelectedTab] = useState(0);
    const [loading, setLoading] = useState(true);
    const [solushipCarriers, setSolushipCarriers] = useState([]);
    const [quickShipCarriers, setQuickShipCarriers] = useState([]);
    const [showCarrierDialog, setShowCarrierDialog] = useState(false);
    const [editingCarrier, setEditingCarrier] = useState(null);
    const [carrierSuccessMessage, setCarrierSuccessMessage] = useState('');
    const [solushipActionMenuAnchor, setSolushipActionMenuAnchor] = useState(null);
    const [quickshipActionMenuAnchor, setQuickshipActionMenuAnchor] = useState(null);
    const [selectedCarrier, setSelectedCarrier] = useState(null);
    const [selectedSolushipCarrier, setSelectedSolushipCarrier] = useState(null);
    const [error, setError] = useState(null);
    const [contextError, setContextError] = useState(null);

    // Equipment types for display
    const [equipmentTypes, setEquipmentTypes] = useState([]);

    // Credentials dialog states
    const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
    const [credentials, setCredentials] = useState({
        type: 'soluship',
        accountNumber: '',
        apiKey: '',
        apiSecret: ''
    });

    // Load connected Soluship carriers - ALL HOOKS MUST BE AT TOP LEVEL
    const loadConnectedCarriers = useCallback(async () => {
        console.log('📡 Loading connected carriers, companyData:', companyData);

        try {
            // Load all carriers from the carriers collection
            const carriersSnapshot = await getDocs(collection(db, 'carriers'));
            const allCarriers = carriersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log('📦 All carriers from database:', allCarriers.length);
            console.log('🔗 Company connected carriers:', companyData?.connectedCarriers);

            if (!companyData?.connectedCarriers || companyData.connectedCarriers.length === 0) {
                console.log('ℹ️ No connected carriers in company data');
                setSolushipCarriers([]);
                return;
            }

            // Filter to only show carriers that are connected to this company
            const connectedCarriers = allCarriers.filter(carrier => {
                const connection = companyData.connectedCarriers.find(cc =>
                    cc.carrierID === carrier.carrierID || cc.carrierId === carrier.carrierID
                );
                console.log(`🔍 Checking carrier ${carrier.name} (${carrier.carrierID}):`, !!connection);
                return connection; // Show all connected carriers, regardless of enabled status
            });

            console.log('✅ Filtered connected carriers:', connectedCarriers.length);

            // Add connection info to each carrier
            const carriersWithConnectionInfo = connectedCarriers.map(carrier => {
                const connection = companyData.connectedCarriers.find(cc =>
                    cc.carrierID === carrier.carrierID || cc.carrierId === carrier.carrierID
                );
                return {
                    ...carrier,
                    connectionEnabled: connection?.enabled || false,
                    connectionType: carrier.connectionType || 'api',
                    connectionData: connection // Store full connection data for later use
                };
            });

            setSolushipCarriers(carriersWithConnectionInfo);
        } catch (error) {
            console.error('❌ Error loading connected carriers:', error);
            setSolushipCarriers([]);
            throw error; // Re-throw to be caught by the main error handler
        }
    }, [companyData]);

    // Load QuickShip carriers
    const loadQuickShipCarriers = useCallback(async () => {
        console.log('🚀 Loading QuickShip carriers for company:', companyId);
        console.log('🏢 Company data:', companyData);
        console.log('📝 Available company fields:', Object.keys(companyData || {}));

        if (!companyId) {
            console.log('⚠️ No companyId provided');
            setQuickShipCarriers([]);
            return;
        }

        try {
            console.log('🔍 Attempting to query quickshipCarriers collection with companyID =', companyId);

            const quickShipQuery = query(
                collection(db, 'quickshipCarriers'),
                where('companyID', '==', companyId),
                orderBy('name', 'asc')
            );

            const querySnapshot = await getDocs(quickShipQuery);
            console.log('📊 Query returned', querySnapshot.docs.length, 'documents');

            const carriers = querySnapshot.docs.map(doc => {
                const data = doc.data();
                console.log('🚛 QuickShip carrier found:', {
                    id: doc.id,
                    name: data.name,
                    companyID: data.companyID,
                    contactName: data.contactName
                });
                return {
                    id: doc.id,
                    ...data
                };
            });

            console.log('✅ Loaded QuickShip carriers:', carriers.length, carriers);
            setQuickShipCarriers(carriers);
        } catch (error) {
            console.error('❌ Error loading QuickShip carriers:', error);
            // If there's an ordering error, try without orderBy
            try {
                console.log('🔄 Retrying without orderBy...');
                const simpleQuery = query(
                    collection(db, 'quickshipCarriers'),
                    where('companyID', '==', companyId)
                );

                const querySnapshot = await getDocs(simpleQuery);
                console.log('📊 Simple query returned', querySnapshot.docs.length, 'documents');

                const carriers = querySnapshot.docs.map(doc => {
                    const data = doc.data();
                    console.log('🚛 QuickShip carrier found (simple query):', {
                        id: doc.id,
                        name: data.name,
                        companyID: data.companyID,
                        contactName: data.contactName
                    });
                    return {
                        id: doc.id,
                        ...data
                    };
                });

                console.log('✅ Loaded QuickShip carriers (simple query):', carriers.length);
                setQuickShipCarriers(carriers);
            } catch (retryError) {
                console.error('❌ Error on retry:', retryError);

                // Let's try to query all quickship carriers to see what's available
                try {
                    console.log('🔍 Attempting to fetch ALL quickship carriers for debugging...');
                    const allCarriersQuery = collection(db, 'quickshipCarriers');
                    const allSnapshot = await getDocs(allCarriersQuery);

                    console.log('📦 Found', allSnapshot.docs.length, 'total quickship carriers in database:');
                    allSnapshot.docs.forEach(doc => {
                        const data = doc.data();
                        console.log('- Carrier:', data.name, 'CompanyID:', data.companyID, 'ID:', doc.id);
                    });

                    // Filter manually for our company
                    const ourCarriers = allSnapshot.docs
                        .map(doc => ({ id: doc.id, ...doc.data() }))
                        .filter(carrier => carrier.companyID === companyId);

                    console.log('✅ Filtered carriers for company', companyId + ':', ourCarriers.length);
                    setQuickShipCarriers(ourCarriers);
                } catch (debugError) {
                    console.error('❌ Debug query also failed:', debugError);
                    setQuickShipCarriers([]);
                    throw debugError; // Re-throw to be caught by the main error handler
                }
            }
        }
    }, [companyId, companyData]);

    // Load equipment types for display
    const loadEquipmentTypes = useCallback(async () => {
        try {
            console.log('🚛 Loading equipment types for carriers display...');
            const equipmentQuery = query(
                collection(db, 'equipmentTypes'),
                orderBy('category'),
                orderBy('name')
            );

            const snapshot = await getDocs(equipmentQuery);
            const equipment = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log(`✅ Loaded ${equipment.length} equipment types for carriers:`, equipment);
            setEquipmentTypes(equipment);
        } catch (error) {
            console.error('❌ Error loading equipment types:', error);
            setEquipmentTypes([]);
        }
    }, []);

    // Helper function to get equipment name by ID
    const getEquipmentName = useCallback((equipmentId) => {
        const equipment = equipmentTypes.find(e => e.id === equipmentId);
        return equipment ? equipment.name : equipmentId;
    }, [equipmentTypes]);

    // Check for context errors after hooks are called
    useEffect(() => {
        try {
            if (!currentUser) {
                setContextError('User authentication required');
                return;
            }
            console.log('🏢 Company context loaded:', {
                hasCompanyData: !!companyData,
                companyIdForAddress,
                companyDataFields: companyData ? Object.keys(companyData) : []
            });
            setContextError(null);
        } catch (error) {
            console.error('❌ Error with contexts:', error);
            setContextError('Error loading user context. Please refresh the page.');
        }
    }, [currentUser, companyData, companyIdForAddress]);

    // Load all data
    useEffect(() => {
        const loadData = async () => {
            console.log('📥 Carriers - Loading data, companyId:', companyId, 'companyData:', companyData);
            setLoading(true);
            setError(null); // Clear any previous errors

            try {
                await Promise.all([
                    loadConnectedCarriers(),
                    loadQuickShipCarriers(),
                    loadEquipmentTypes()
                ]);
                console.log('✅ All carrier data loaded successfully');
            } catch (error) {
                console.error('❌ Error loading carriers data:', error);
                setError(error.message || 'Failed to load carrier data');
            } finally {
                setLoading(false);
            }
        };

        // Always try to load data, even if companyId is null (for debugging)
        loadData();
    }, [companyId, companyData, loadConnectedCarriers, loadQuickShipCarriers]);

    // Early return for context errors - AFTER all hooks are called
    if (contextError) {
        return (
            <Box sx={{ p: 3, textAlign: 'center' }}>
                <Alert severity="error">
                    <Typography>{contextError}</Typography>
                    <Button
                        variant="outlined"
                        onClick={() => window.location.reload()}
                        sx={{ mt: 2 }}
                    >
                        Refresh Page
                    </Button>
                </Alert>
            </Box>
        );
    }

    // Handle tab change
    const handleTabChange = (event, newValue) => {
        setSelectedTab(newValue);
    };

    // Handle carrier actions
    const handleAddCarrier = () => {
        setEditingCarrier(null);
        setShowCarrierDialog(true);
    };

    const handleEditCarrier = (carrier) => {
        setEditingCarrier(carrier);
        setShowCarrierDialog(true);
        setSolushipActionMenuAnchor(null);
        setQuickshipActionMenuAnchor(null);
    };

    const handleDeleteCarrier = async (carrier) => {
        if (!window.confirm(`Are you sure you want to delete ${carrier.name}?`)) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'quickshipCarriers', carrier.id));
            await loadQuickShipCarriers(); // Refresh the list
            setCarrierSuccessMessage(`${carrier.name} has been deleted successfully.`);
            setTimeout(() => setCarrierSuccessMessage(''), 3000);
        } catch (error) {
            console.error('Error deleting carrier:', error);
            alert('Failed to delete carrier. Please try again.');
        }
        setSolushipActionMenuAnchor(null);
        setQuickshipActionMenuAnchor(null);
    };

    const handleCarrierSaved = async () => {
        setShowCarrierDialog(false);
        setEditingCarrier(null);
        await loadQuickShipCarriers(); // Refresh the list
        setCarrierSuccessMessage('Carrier saved successfully!');
        setTimeout(() => setCarrierSuccessMessage(''), 3000);
    };

    // Action menu handlers
    const handleActionMenuOpen = (event, carrier) => {
        setSelectedCarrier(carrier);
        setQuickshipActionMenuAnchor(event.currentTarget);
        setSolushipActionMenuAnchor(null);
    };

    const handleActionMenuClose = () => {
        setSolushipActionMenuAnchor(null);
        setQuickshipActionMenuAnchor(null);
        setSelectedCarrier(null);
        setSelectedSolushipCarrier(null);
    };

    // Soluship carrier action handlers
    const handleSolushipActionMenuOpen = (event, carrier) => {
        setSelectedSolushipCarrier(carrier);
        setSolushipActionMenuAnchor(event.currentTarget);
    };

    const handleConfigureCredentials = (carrier) => {
        setSelectedSolushipCarrier(carrier);
        setCredentials({
            type: carrier.connectionData?.credentialType || 'soluship',
            accountNumber: carrier.connectionData?.accountNumber || '',
            apiKey: carrier.connectionData?.apiKey || '',
            apiSecret: carrier.connectionData?.apiSecret || ''
        });
        setShowCredentialsDialog(true);
        setSolushipActionMenuAnchor(null);
    };

    const handleSaveCredentials = () => {
        // For now, just close the dialog - in a real implementation this would save to the company's connectedCarriers
        console.log('Saving credentials for carrier:', selectedSolushipCarrier?.name, credentials);
        setShowCredentialsDialog(false);
        setSelectedSolushipCarrier(null);
        // Show success message
        setCarrierSuccessMessage(`Credentials configured for ${selectedSolushipCarrier?.name}`);
        setTimeout(() => setCarrierSuccessMessage(''), 3000);
    };

    // Handle activation toggle for Soluship carriers
    const handleToggleActivation = async (carrier) => {
        // For now, just update local state - in a real implementation this would update the company document
        setSolushipCarriers(prev => prev.map(c =>
            c.id === carrier.id ? { ...c, connectionEnabled: !c.connectionEnabled } : c
        ));
        console.log(`Toggled activation for ${carrier.name}: ${!carrier.connectionEnabled}`);
    };

    // Get carrier type color
    const getCarrierTypeColor = (type) => {
        switch (type) {
            case 'courier':
                return { color: '#3b82f6', bgcolor: '#eff6ff' };
            case 'freight':
                return { color: '#f59e0b', bgcolor: '#fffbeb' };
            case 'hybrid':
                return { color: '#8b5cf6', bgcolor: '#f5f3ff' };
            default:
                return { color: '#6b7280', bgcolor: '#f3f4f6' };
        }
    };

    // Render Soluship Carriers table
    const renderSolushipCarriers = () => (
        <Box sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ mb: 3, fontSize: '16px', fontWeight: 600 }}>
                Connected Soluship Carriers
            </Typography>

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={24} />
                </Box>
            ) : solushipCarriers.length === 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography sx={{ fontSize: '14px' }}>
                        No Soluship carriers are currently connected to your account.
                        Contact your administrator to enable carrier connections.
                    </Typography>
                </Alert>
            ) : (
                <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Carrier</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Type</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Status</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Activated</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Available</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {solushipCarriers.map((carrier) => (
                                <TableRow key={carrier.id} hover>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Avatar
                                                src={carrier.logoURL}
                                                sx={{ width: 32, height: 32 }}
                                            >
                                                <LocalShippingIcon sx={{ fontSize: '16px' }} />
                                            </Avatar>
                                            <Box>
                                                <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                                    {carrier.name}
                                                </Typography>
                                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                    {carrier.carrierID}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={carrier.type || 'courier'}
                                            size="small"
                                            sx={{
                                                ...getCarrierTypeColor(carrier.type),
                                                fontSize: '11px',
                                                fontWeight: 500
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            icon={carrier.enabled ? <CheckCircleIcon /> : <CancelIcon />}
                                            label={carrier.enabled ? 'Connected' : 'Not Connected'}
                                            size="small"
                                            sx={{
                                                bgcolor: carrier.enabled ? '#f0fdf4' : '#fef2f2',
                                                color: carrier.enabled ? '#166534' : '#dc2626',
                                                fontSize: '11px',
                                                fontWeight: 500
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    checked={carrier.connectionEnabled}
                                                    onChange={() => handleToggleActivation(carrier)}
                                                    size="small"
                                                    color="primary"
                                                />
                                            }
                                            label={
                                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                    {carrier.connectionEnabled ? 'Enabled' : 'Disabled'}
                                                </Typography>
                                            }
                                            sx={{ margin: 0 }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Typography sx={{
                                            fontSize: '12px',
                                            color: carrier.connectionEnabled ? '#059669' : '#dc2626',
                                            fontWeight: 500
                                        }}>
                                            {carrier.connectionEnabled ? 'Yes' : 'No'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => handleSolushipActionMenuOpen(e, carrier)}
                                        >
                                            <MoreVertIcon sx={{ fontSize: '16px' }} />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );

    // Render QuickShip Carriers table
    const renderQuickShipCarriers = () => (
        <Box sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                    QuickShip Carriers
                </Typography>
                <Button
                    variant="contained"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={handleAddCarrier}
                    sx={{ fontSize: '12px' }}
                >
                    Add Carrier
                </Button>
            </Box>

            {carrierSuccessMessage && (
                <Alert severity="success" sx={{ mb: 2 }}>
                    <Typography sx={{ fontSize: '14px' }}>{carrierSuccessMessage}</Typography>
                </Alert>
            )}

            {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <CircularProgress size={24} />
                </Box>
            ) : quickShipCarriers.length === 0 ? (
                <Alert severity="info" sx={{ mb: 2 }}>
                    <Typography sx={{ fontSize: '14px' }}>
                        No QuickShip carriers found. Click "Add Carrier" to create your first manual carrier.
                    </Typography>
                </Alert>
            ) : (
                <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb' }}>
                    <Table size="small">
                        <TableHead>
                            <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Carrier</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Type</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Service Levels</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Equipment Types</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Additional Services</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Contact</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Account Number</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Created</TableCell>
                                <TableCell sx={{ fontWeight: 600, fontSize: '12px' }}>Actions</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {quickShipCarriers.map((carrier) => (
                                <TableRow key={carrier.id} hover>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                            <Avatar
                                                src={carrier.logo && !carrier.logo.startsWith('blob:') ? carrier.logo : null}
                                                sx={{ width: 32, height: 32, bgcolor: '#f3f4f6' }}
                                            >
                                                <LocalShippingIcon sx={{ fontSize: '16px', color: '#6b7280' }} />
                                            </Avatar>
                                            <Box>
                                                <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                                                    {carrier.name}
                                                </Typography>
                                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                    {carrier.contactName || 'No contact name'}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Chip
                                            label={carrier.type || 'freight'}
                                            size="small"
                                            sx={{
                                                ...getCarrierTypeColor(carrier.type),
                                                fontSize: '11px',
                                                fontWeight: 500
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 150 }}>
                                            {carrier.supportedServiceLevels && carrier.supportedServiceLevels.length > 0 ? (
                                                carrier.supportedServiceLevels.slice(0, 3).map((serviceCode) => (
                                                    <Chip
                                                        key={serviceCode}
                                                        label={serviceCode}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{
                                                            fontSize: '10px',
                                                            height: 18,
                                                            bgcolor: '#f8fafc',
                                                            color: '#6366f1'
                                                        }}
                                                    />
                                                ))
                                            ) : (
                                                <Typography sx={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>
                                                    None
                                                </Typography>
                                            )}
                                            {carrier.supportedServiceLevels && carrier.supportedServiceLevels.length > 3 && (
                                                <Chip
                                                    label={`+${carrier.supportedServiceLevels.length - 3}`}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{
                                                        fontSize: '10px',
                                                        height: 18,
                                                        bgcolor: '#f3f4f6',
                                                        color: '#6b7280'
                                                    }}
                                                />
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 150 }}>
                                            {carrier.supportedEquipmentTypes && carrier.supportedEquipmentTypes.length > 0 ? (
                                                carrier.supportedEquipmentTypes.slice(0, 3).map((equipmentId) => (
                                                    <Chip
                                                        key={equipmentId}
                                                        label={getEquipmentName(equipmentId)}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{
                                                            fontSize: '10px',
                                                            height: 18,
                                                            bgcolor: '#f0fdf4',
                                                            color: '#16a34a'
                                                        }}
                                                    />
                                                ))
                                            ) : (
                                                <Typography sx={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>
                                                    None
                                                </Typography>
                                            )}
                                            {carrier.supportedEquipmentTypes && carrier.supportedEquipmentTypes.length > 3 && (
                                                <Chip
                                                    label={`+${carrier.supportedEquipmentTypes.length - 3}`}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{
                                                        fontSize: '10px',
                                                        height: 18,
                                                        bgcolor: '#f3f4f6',
                                                        color: '#6b7280'
                                                    }}
                                                />
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, maxWidth: 150 }}>
                                            {carrier.supportedAdditionalServices && carrier.supportedAdditionalServices.length > 0 ? (
                                                carrier.supportedAdditionalServices.slice(0, 3).map((serviceCode) => (
                                                    <Chip
                                                        key={serviceCode}
                                                        label={serviceCode}
                                                        size="small"
                                                        variant="outlined"
                                                        sx={{
                                                            fontSize: '10px',
                                                            height: 18,
                                                            bgcolor: '#fef2f2',
                                                            color: '#dc2626'
                                                        }}
                                                    />
                                                ))
                                            ) : (
                                                <Typography sx={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>
                                                    None
                                                </Typography>
                                            )}
                                            {carrier.supportedAdditionalServices && carrier.supportedAdditionalServices.length > 3 && (
                                                <Chip
                                                    label={`+${carrier.supportedAdditionalServices.length - 3}`}
                                                    size="small"
                                                    variant="outlined"
                                                    sx={{
                                                        fontSize: '10px',
                                                        height: 18,
                                                        bgcolor: '#f3f4f6',
                                                        color: '#6b7280'
                                                    }}
                                                />
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Box>
                                            {carrier.contactEmail && (
                                                <Typography sx={{ fontSize: '12px' }}>
                                                    {carrier.contactEmail}
                                                </Typography>
                                            )}
                                            {carrier.contactPhone && (
                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                    {carrier.contactPhone}
                                                </Typography>
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell>
                                        <Typography sx={{ fontSize: '12px' }}>
                                            {carrier.accountNumber || 'N/A'}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <Typography sx={{ fontSize: '12px' }}>
                                            {(() => {
                                                try {
                                                    if (!carrier.createdAt) return 'N/A';

                                                    // Handle Firestore Timestamp
                                                    if (carrier.createdAt && typeof carrier.createdAt.toDate === 'function') {
                                                        return new Date(carrier.createdAt.toDate()).toLocaleDateString();
                                                    }

                                                    // Handle regular Date object
                                                    if (carrier.createdAt instanceof Date) {
                                                        return carrier.createdAt.toLocaleDateString();
                                                    }

                                                    // Handle timestamp objects with seconds
                                                    if (carrier.createdAt && carrier.createdAt.seconds) {
                                                        return new Date(carrier.createdAt.seconds * 1000).toLocaleDateString();
                                                    }

                                                    // Handle string dates
                                                    if (typeof carrier.createdAt === 'string') {
                                                        const date = new Date(carrier.createdAt);
                                                        return isNaN(date.getTime()) ? 'N/A' : date.toLocaleDateString();
                                                    }

                                                    return 'N/A';
                                                } catch (error) {
                                                    console.warn('Error formatting date for carrier:', carrier.id, error);
                                                    return 'N/A';
                                                }
                                            })()}
                                        </Typography>
                                    </TableCell>
                                    <TableCell>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => handleActionMenuOpen(e, carrier)}
                                        >
                                            <MoreVertIcon sx={{ fontSize: '16px' }} />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            )}
        </Box>
    );

    // Email Array Field Component for Manual Carriers
    const EmailArrayField = ({
        label,
        required = false,
        emails,
        section,
        error,
        onEmailChange,
        onAddEmail,
        onRemoveEmail
    }) => {
        return (
            <Box sx={{ mb: 2 }}>
                <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 1, color: '#374151' }}>
                    {label} {required && <span style={{ color: '#dc2626' }}>*</span>}
                </Typography>
                {emails.map((email, index) => (
                    <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <TextField
                            fullWidth
                            size="small"
                            type="email"
                            value={email}
                            onChange={(e) => onEmailChange(section, index, e.target.value)}
                            placeholder="email@example.com"
                            error={!!error}
                            label={`${label} ${index + 1}`}
                            InputProps={{ sx: { fontSize: '12px' } }}
                            InputLabelProps={{
                                sx: { fontSize: '12px' },
                                shrink: true
                            }}
                        />
                        {emails.length > 1 && (
                            <IconButton
                                size="small"
                                onClick={() => onRemoveEmail(section, index)}
                                sx={{ color: '#dc2626' }}
                            >
                                <RemoveIcon sx={{ fontSize: '16px' }} />
                            </IconButton>
                        )}
                    </Box>
                ))}
                <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => onAddEmail(section)}
                    sx={{ fontSize: '11px', mt: 1 }}
                    variant="outlined"
                >
                    Add Email
                </Button>
                {error && (
                    <Typography sx={{ fontSize: '11px', color: '#dc2626', mt: 1 }}>
                        {error}
                    </Typography>
                )}
            </Box>
        );
    };

    return (
        <Box sx={{ height: '100%', overflow: 'auto', bgcolor: 'white' }}>
            {/* Modal Header */}
            {isModal && (
                <ModalHeader
                    title="Carriers"
                    onClose={onClose}
                    showCloseButton={showCloseButton}
                />
            )}

            {/* Error Display */}
            {error && (
                <Box sx={{ p: 3 }}>
                    <Alert severity="error" sx={{ mb: 2 }}>
                        <Typography sx={{ fontSize: '14px', fontWeight: 600, mb: 1 }}>
                            Error Loading Carriers
                        </Typography>
                        <Typography sx={{ fontSize: '12px' }}>
                            {error}
                        </Typography>
                        <Box sx={{ mt: 2 }}>
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={() => window.location.reload()}
                                sx={{ fontSize: '11px', mr: 1 }}
                            >
                                Refresh Page
                            </Button>
                            <Button
                                size="small"
                                variant="outlined"
                                onClick={() => setError(null)}
                                sx={{ fontSize: '11px' }}
                            >
                                Dismiss Error
                            </Button>
                        </Box>
                    </Alert>
                </Box>
            )}

            {/* Loading Display */}
            {loading && !error && (
                <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
                    <Box sx={{ textAlign: 'center' }}>
                        <CircularProgress size={40} />
                        <Typography sx={{ mt: 2, fontSize: '14px', color: '#6b7280' }}>
                            Loading carriers...
                        </Typography>
                    </Box>
                </Box>
            )}

            {/* Main Content - only show if no error and not loading */}
            {!error && !loading && (
                <Box sx={{ height: isModal ? 'calc(100% - 64px)' : '100%' }}>
                    {/* Tabs */}
                    <Box sx={{ borderBottom: '1px solid #e5e7eb', px: 3, pt: 2 }}>
                        <Tabs value={selectedTab} onChange={handleTabChange}>
                            <Tab
                                label={`Soluship Carriers (${solushipCarriers.length})`}
                                sx={{ fontSize: '14px', textTransform: 'none' }}
                            />
                            <Tab
                                label={`QuickShip Carriers (${quickShipCarriers.length})`}
                                sx={{ fontSize: '14px', textTransform: 'none' }}
                            />
                        </Tabs>
                    </Box>

                    {/* Tab Content */}
                    <Box sx={{ height: 'calc(100% - 48px)', overflow: 'auto' }}>
                        {selectedTab === 0 && renderSolushipCarriers()}
                        {selectedTab === 1 && renderQuickShipCarriers()}
                    </Box>
                </Box>
            )}

            {/* QuickShip Carrier Dialog */}
            <QuickShipCarrierDialog
                open={showCarrierDialog}
                onClose={() => {
                    setShowCarrierDialog(false);
                    setEditingCarrier(null);
                }}
                onSuccess={handleCarrierSaved}
                companyId={companyId}
                editingCarrier={editingCarrier}
                existingCarriers={quickShipCarriers}
            />

            {/* Soluship Credentials Dialog */}
            <Dialog
                open={showCredentialsDialog}
                onClose={() => setShowCredentialsDialog(false)}
                maxWidth="sm"
                fullWidth
                PaperProps={{
                    sx: { borderRadius: 2 }
                }}
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#111827' }}>
                    {selectedSolushipCarrier?.name} Credentials
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ mt: 2 }}>
                        <FormControl component="fieldset" sx={{ mb: 3 }}>
                            <FormLabel sx={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>
                                Credentials Type
                            </FormLabel>
                            <RadioGroup
                                value={credentials.type}
                                onChange={(e) => setCredentials(prev => ({ ...prev, type: e.target.value }))}
                                sx={{ mt: 1 }}
                            >
                                <FormControlLabel
                                    value="soluship"
                                    control={<Radio size="small" />}
                                    label={<Typography sx={{ fontSize: '12px' }}>Use Soluship Credentials</Typography>}
                                />
                                <FormControlLabel
                                    value="custom"
                                    control={<Radio size="small" />}
                                    label={<Typography sx={{ fontSize: '12px' }}>Use Custom Credentials</Typography>}
                                />
                            </RadioGroup>
                        </FormControl>

                        {credentials.type === 'custom' && (
                            <>
                                <TextField
                                    fullWidth
                                    label="Account Number"
                                    value={credentials.accountNumber}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, accountNumber: e.target.value }))}
                                    margin="normal"
                                    size="small"
                                    InputProps={{ sx: { fontSize: '12px' } }}
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                />
                                <TextField
                                    fullWidth
                                    label="API Key"
                                    value={credentials.apiKey}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, apiKey: e.target.value }))}
                                    margin="normal"
                                    size="small"
                                    InputProps={{ sx: { fontSize: '12px' } }}
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                />
                                <TextField
                                    fullWidth
                                    label="API Secret"
                                    type="password"
                                    value={credentials.apiSecret}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, apiSecret: e.target.value }))}
                                    margin="normal"
                                    size="small"
                                    InputProps={{ sx: { fontSize: '12px' } }}
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                />
                            </>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setShowCredentialsDialog(false)} size="small" sx={{ fontSize: '12px' }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleSaveCredentials}
                        variant="contained"
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Save
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Action Menu for Soluship Carriers */}
            <Menu
                anchorEl={solushipActionMenuAnchor}
                open={Boolean(solushipActionMenuAnchor) && selectedSolushipCarrier}
                onClose={handleActionMenuClose}
            >
                <MenuItem onClick={() => handleConfigureCredentials(selectedSolushipCarrier)}>
                    <ListItemIcon>
                        <CredentialsIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Configure Credentials</ListItemText>
                </MenuItem>
            </Menu>

            {/* Action Menu for QuickShip Carriers */}
            <Menu
                anchorEl={quickshipActionMenuAnchor}
                open={Boolean(quickshipActionMenuAnchor) && selectedCarrier && !selectedSolushipCarrier}
                onClose={handleActionMenuClose}
            >
                <MenuItem onClick={() => handleEditCarrier(selectedCarrier)}>
                    <ListItemIcon>
                        <EditIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Edit</ListItemText>
                </MenuItem>
                <MenuItem onClick={() => handleDeleteCarrier(selectedCarrier)}>
                    <ListItemIcon>
                        <DeleteIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>Delete</ListItemText>
                </MenuItem>
            </Menu>
        </Box>
    );
};

export default Carriers; 