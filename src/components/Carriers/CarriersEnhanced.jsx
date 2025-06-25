import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
    Chip,
    CircularProgress,
    Alert,
    Snackbar,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    FormLabel,
    RadioGroup,
    FormControlLabel,
    Radio,
    Divider,
    IconButton,
    Tabs,
    Tab,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    Avatar,
    Tooltip,
    Menu,
    MenuItem,
    ListItemIcon,
    ListItemText
} from '@mui/material';
import {
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon,
    Edit as EditIcon,
    CheckCircle as CheckCircleIcon,
    Cancel as CancelIcon,
    Settings as SettingsIcon,
    CloudDone as CloudDoneIcon,
    VpnKey as VpnKeyIcon,
    Save as SaveIcon,
    ArrowBackIosNew as ArrowBackIosNewIcon,
    Close as CloseIcon,
    Add as AddIcon,
    Delete as DeleteIcon,
    MoreVert as MoreVertIcon,
    LocalShipping as LocalShippingIcon,
    Business as BusinessIcon
} from '@mui/icons-material';
import { collection, getDocs, doc, updateDoc, serverTimestamp, query, where, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCompany } from '../../contexts/CompanyContext';
import './Carriers.css';

// Import common components
import ModalHeader from '../common/ModalHeader';
import QuickShipCarrierDialog from '../CreateShipment/QuickShipCarrierDialog';

function TabPanel({ children, value, index, ...other }) {
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`carrier-tabpanel-${index}`}
            aria-labelledby={`carrier-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ py: 3 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

const CarriersEnhanced = ({ isModal = false, onClose = null, showCloseButton = false }) => {
    const [carrierList, setCarrierList] = useState([]);
    const [quickShipCarriers, setQuickShipCarriers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState('');
    const [configDialogOpen, setConfigDialogOpen] = useState(false);
    const [selectedCarrier, setSelectedCarrier] = useState(null);
    const [saving, setSaving] = useState(false);
    const [tabValue, setTabValue] = useState(0);

    // QuickShip carrier states
    const [showQuickShipDialog, setShowQuickShipDialog] = useState(false);
    const [editingQuickShipCarrier, setEditingQuickShipCarrier] = useState(null);
    const [quickShipPage, setQuickShipPage] = useState(0);
    const [quickShipRowsPerPage, setQuickShipRowsPerPage] = useState(10);
    const [anchorEl, setAnchorEl] = useState(null);
    const [selectedQuickShipCarrier, setSelectedQuickShipCarrier] = useState(null);

    const { companyData, refreshCompanyData, companyIdForAddress } = useCompany();
    const navigate = useNavigate();

    // Credential state for the configuration dialog
    const [credentials, setCredentials] = useState({
        type: 'soluship',
        username: '',
        password: '',
        accountNumber: '',
        hostURL: '',
        endpoints: {
            rate: '',
            booking: '',
            tracking: '',
            cancel: '',
            labels: '',
            status: ''
        }
    });

    // Load both API carriers and QuickShip carriers
    useEffect(() => {
        const loadCarriers = async () => {
            try {
                setLoading(true);

                // Load API carriers
                const companyConnectedCarriers = companyData?.connectedCarriers || [];

                let apiCarriers = [];
                if (companyConnectedCarriers.length > 0) {
                    const carrierIds = companyConnectedCarriers.map(cc => cc.carrierID);
                    const carriersRef = collection(db, 'carriers');
                    const carriersQuery = query(carriersRef, where('carrierID', 'in', carrierIds));
                    const snapshot = await getDocs(carriersQuery);

                    snapshot.forEach(doc => {
                        const data = doc.data();
                        apiCarriers.push({
                            ...data,
                            id: doc.id,
                            firestoreId: doc.id,
                            connected: !!data.apiCredentials,
                            enabled: data.enabled || false,
                            credentialType: data.apiCredentials?.type || 'none'
                        });
                    });
                }

                // Load QuickShip carriers
                let quickShipCarriersData = [];
                if (companyIdForAddress) {
                    const quickShipQuery = query(
                        collection(db, 'quickshipCarriers'),
                        where('companyID', '==', companyIdForAddress)
                    );
                    const quickShipSnapshot = await getDocs(quickShipQuery);
                    quickShipCarriersData = quickShipSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                }

                console.log('Loaded API carriers:', apiCarriers);
                console.log('Loaded QuickShip carriers:', quickShipCarriersData);

                setCarrierList(apiCarriers);
                setQuickShipCarriers(quickShipCarriersData);
            } catch (error) {
                console.error('Error loading carriers:', error);
                setError('Failed to load carriers. Please try again.');
                setCarrierList([]);
                setQuickShipCarriers([]);
            } finally {
                setLoading(false);
            }
        };

        if (companyData && companyIdForAddress) {
            loadCarriers();
        }
    }, [companyData, companyIdForAddress]);

    useEffect(() => {
        if (refreshCompanyData) {
            refreshCompanyData();
        }
    }, []);

    const handleTabChange = (event, newValue) => {
        setTabValue(newValue);
    };

    const handleToggleCarrier = async (carrierId) => {
        try {
            const carrier = carrierList.find(c => c.id === carrierId);
            if (!carrier || !carrier.firestoreId) {
                setError('Cannot update carrier: Carrier not found in database');
                return;
            }

            const newEnabledState = !carrier.enabled;

            const carrierRef = doc(db, 'carriers', carrier.firestoreId);
            await updateDoc(carrierRef, {
                enabled: newEnabledState,
                updatedAt: serverTimestamp()
            });

            if (companyData?.id) {
                const companyRef = doc(db, 'companies', companyData.id);
                const updatedConnectedCarriers = companyData.connectedCarriers.map(cc =>
                    cc.carrierID === carrier.carrierID
                        ? { ...cc, enabled: newEnabledState, updatedAt: new Date() }
                        : cc
                );

                await updateDoc(companyRef, {
                    connectedCarriers: updatedConnectedCarriers,
                    updatedAt: serverTimestamp()
                });
            }

            setCarrierList(prevList =>
                prevList.map(c =>
                    c.id === carrierId
                        ? { ...c, enabled: newEnabledState }
                        : c
                )
            );

            setSuccessMessage(`${carrier.name} ${newEnabledState ? 'enabled' : 'disabled'} successfully`);
        } catch (error) {
            console.error('Error toggling carrier:', error);
            setError('Failed to update carrier status. Please try again.');
        }
    };

    const handleConfigureCarrier = (carrier) => {
        setSelectedCarrier(carrier);
        setCredentials({
            type: 'soluship',
            username: '',
            password: '',
            accountNumber: '',
            hostURL: '',
            endpoints: {
                rate: '',
                booking: '',
                tracking: '',
                cancel: '',
                labels: '',
                status: ''
            }
        });
        setConfigDialogOpen(true);
    };

    const handleSaveCredentials = async () => {
        try {
            setSaving(true);
            setError(null);
            setSuccessMessage('Configuration saved locally. Database updates are temporarily disabled for security.');
            setConfigDialogOpen(false);
        } catch (error) {
            console.error('Error in save credentials (disabled):', error);
            setError('Configuration is temporarily disabled.');
        } finally {
            setSaving(false);
        }
    };

    // QuickShip carrier handlers
    const handleAddQuickShipCarrier = () => {
        setEditingQuickShipCarrier(null);
        setShowQuickShipDialog(true);
    };

    const handleEditQuickShipCarrier = (carrier) => {
        setEditingQuickShipCarrier(carrier);
        setShowQuickShipDialog(true);
        handleCloseMenu();
    };

    const handleDeleteQuickShipCarrier = async (carrier) => {
        if (!window.confirm(`Are you sure you want to delete "${carrier.name}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'quickshipCarriers', carrier.id));
            setQuickShipCarriers(prev => prev.filter(c => c.id !== carrier.id));
            setSuccessMessage(`Carrier "${carrier.name}" deleted successfully`);
            handleCloseMenu();
        } catch (error) {
            console.error('Error deleting QuickShip carrier:', error);
            setError('Failed to delete carrier. Please try again.');
        }
    };

    const handleQuickShipCarrierSuccess = (savedCarrier, isEdit = false) => {
        if (isEdit) {
            setQuickShipCarriers(prev => prev.map(c =>
                c.id === savedCarrier.id ? savedCarrier : c
            ));
            setSuccessMessage(`Carrier "${savedCarrier.name}" updated successfully`);
        } else {
            setQuickShipCarriers(prev => [...prev, savedCarrier]);
            setSuccessMessage(`Carrier "${savedCarrier.name}" added successfully`);
        }
        setShowQuickShipDialog(false);
        setEditingQuickShipCarrier(null);
    };

    const handleQuickShipChangePage = (event, newPage) => {
        setQuickShipPage(newPage);
    };

    const handleQuickShipChangeRowsPerPage = (event) => {
        setQuickShipRowsPerPage(parseInt(event.target.value, 10));
        setQuickShipPage(0);
    };

    const handleOpenMenu = (event, carrier) => {
        setAnchorEl(event.currentTarget);
        setSelectedQuickShipCarrier(carrier);
    };

    const handleCloseMenu = () => {
        setAnchorEl(null);
        setSelectedQuickShipCarrier(null);
    };

    const handleCloseSnackbar = () => {
        setError(null);
        setSuccessMessage('');
    };

    const handleCloseDialog = () => {
        setConfigDialogOpen(false);
        setSelectedCarrier(null);
    };

    // Get paginated QuickShip carriers
    const paginatedQuickShipCarriers = quickShipCarriers.slice(
        quickShipPage * quickShipRowsPerPage,
        quickShipPage * quickShipRowsPerPage + quickShipRowsPerPage
    );

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <div style={{ backgroundColor: 'transparent', width: '100%', height: '100%' }}>
            <Box sx={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
                {/* Modal Header */}
                {isModal && (
                    <ModalHeader
                        title="Carrier Management"
                        onClose={showCloseButton ? onClose : null}
                        showCloseButton={showCloseButton}
                    />
                )}

                <Box sx={{
                    width: '100%',
                    maxWidth: '100%',
                    overflow: 'hidden',
                    position: 'relative',
                    p: 3
                }}>
                    {/* Breadcrumb - only show when not in modal */}
                    {!isModal && (
                        <div className="breadcrumb-container">
                            <Link to="/" className="breadcrumb-link">
                                <HomeIcon />
                                <Typography variant="body2">Home</Typography>
                            </Link>
                            <NavigateNextIcon />
                            <Typography variant="body2">Carriers</Typography>
                        </div>
                    )}

                    {!isModal && (
                        <Box sx={{ mb: 4 }}>
                            <Typography variant="h5" component="h1" gutterBottom sx={{ fontWeight: 600 }}>
                                Carrier Management
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Manage your connected API carriers and QuickShip manual carriers
                            </Typography>
                        </Box>
                    )}

                    {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {error}
                        </Alert>
                    )}

                    {/* Tabs */}
                    <Paper sx={{ mb: 3 }}>
                        <Tabs
                            value={tabValue}
                            onChange={handleTabChange}
                            aria-label="carrier management tabs"
                            sx={{
                                borderBottom: 1,
                                borderColor: 'divider',
                                '& .MuiTab-root': {
                                    textTransform: 'none',
                                    fontWeight: 600,
                                    fontSize: '14px'
                                }
                            }}
                        >
                            <Tab
                                label={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <CloudDoneIcon fontSize="small" />
                                        <span>API Carriers</span>
                                        <Chip label={carrierList.length} size="small" />
                                    </Box>
                                }
                                id="carrier-tab-0"
                                aria-controls="carrier-tabpanel-0"
                            />
                            <Tab
                                label={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <LocalShippingIcon fontSize="small" />
                                        <span>QuickShip Carriers</span>
                                        <Chip label={quickShipCarriers.length} size="small" />
                                    </Box>
                                }
                                id="carrier-tab-1"
                                aria-controls="carrier-tabpanel-1"
                            />
                        </Tabs>

                        {/* API Carriers Tab */}
                        <TabPanel value={tabValue} index={0}>
                            {carrierList.length === 0 ? (
                                <Box sx={{ textAlign: 'center', py: 6 }}>
                                    <CloudDoneIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                                    <Typography variant="h6" color="text.secondary" gutterBottom>
                                        No API Carriers Connected
                                    </Typography>
                                    <Typography variant="body1" color="text.secondary">
                                        Please contact your administrator to connect API carriers to your account.
                                    </Typography>
                                </Box>
                            ) : (
                                <Grid container spacing={3}>
                                    {carrierList.map((carrier) => (
                                        <Grid item xs={12} sm={6} md={4} key={carrier.id}>
                                            <Card>
                                                <CardMedia
                                                    component="img"
                                                    image={carrier.logoURL || '/images/carrier-badges/default.png'}
                                                    alt={carrier.name}
                                                    sx={{
                                                        width: '100%',
                                                        height: 'auto',
                                                        aspectRatio: '16/9',
                                                        objectFit: 'contain',
                                                        p: 2,
                                                        bgcolor: 'grey.100'
                                                    }}
                                                />
                                                <CardContent>
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                                        <Typography variant="h6" component="div">
                                                            {carrier.name}
                                                        </Typography>
                                                        <Switch
                                                            checked={carrier.enabled}
                                                            onChange={() => handleToggleCarrier(carrier.id)}
                                                            color="primary"
                                                        />
                                                    </Box>

                                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                                        {carrier.description}
                                                    </Typography>

                                                    <Box sx={{ mt: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                                        <Chip
                                                            label={carrier.enabled ? 'Enabled' : 'Disabled'}
                                                            color={carrier.enabled ? 'success' : 'default'}
                                                            size="small"
                                                        />
                                                        <Chip
                                                            label={carrier.connected ? 'Connected' : 'Not Connected'}
                                                            color={carrier.connected ? 'primary' : 'default'}
                                                            size="small"
                                                        />
                                                        {carrier.credentialType !== 'none' && (
                                                            <Chip
                                                                label={carrier.credentialType === 'soluship' ? 'Soluship Connect' : 'Custom'}
                                                                color={carrier.credentialType === 'soluship' ? 'info' : 'secondary'}
                                                                size="small"
                                                            />
                                                        )}
                                                    </Box>

                                                    <Box sx={{ mt: 2, display: 'flex', gap: 1, flexDirection: 'column' }}>
                                                        {!carrier.connected ? (
                                                            <>
                                                                <Button
                                                                    variant="contained"
                                                                    size="small"
                                                                    startIcon={<CloudDoneIcon />}
                                                                    onClick={() => {
                                                                        setCredentials(prev => ({ ...prev, type: 'soluship' }));
                                                                        handleConfigureCarrier(carrier);
                                                                    }}
                                                                    sx={{ mb: 1 }}
                                                                >
                                                                    Use Soluship Connect
                                                                </Button>
                                                                <Button
                                                                    variant="outlined"
                                                                    size="small"
                                                                    startIcon={<VpnKeyIcon />}
                                                                    onClick={() => {
                                                                        setCredentials(prev => ({ ...prev, type: 'custom' }));
                                                                        handleConfigureCarrier(carrier);
                                                                    }}
                                                                >
                                                                    Use My Credentials
                                                                </Button>
                                                            </>
                                                        ) : (
                                                            <Button
                                                                variant="outlined"
                                                                size="small"
                                                                startIcon={<SettingsIcon />}
                                                                onClick={() => handleConfigureCarrier(carrier)}
                                                            >
                                                                Configure
                                                            </Button>
                                                        )}
                                                    </Box>
                                                </CardContent>
                                            </Card>
                                        </Grid>
                                    ))}
                                </Grid>
                            )}
                        </TabPanel>

                        {/* QuickShip Carriers Tab */}
                        <TabPanel value={tabValue} index={1}>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '18px' }}>
                                    QuickShip Carriers
                                </Typography>
                                <Button
                                    variant="contained"
                                    startIcon={<AddIcon />}
                                    onClick={handleAddQuickShipCarrier}
                                    sx={{
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        borderRadius: 2
                                    }}
                                >
                                    Add Carrier
                                </Button>
                            </Box>

                            {quickShipCarriers.length === 0 ? (
                                <Box sx={{ textAlign: 'center', py: 6 }}>
                                    <LocalShippingIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                                    <Typography variant="h6" color="text.secondary" gutterBottom>
                                        No QuickShip Carriers
                                    </Typography>
                                    <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                                        Add manual carriers for QuickShip bookings with custom rates.
                                    </Typography>
                                    <Button
                                        variant="contained"
                                        startIcon={<AddIcon />}
                                        onClick={handleAddQuickShipCarrier}
                                        sx={{
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            textTransform: 'none',
                                            fontWeight: 600,
                                            borderRadius: 2
                                        }}
                                    >
                                        Add Your First Carrier
                                    </Button>
                                </Box>
                            ) : (
                                <>
                                    <TableContainer component={Paper} sx={{ border: '1px solid #e5e7eb', borderRadius: 2 }}>
                                        <Table>
                                            <TableHead>
                                                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Carrier</TableCell>
                                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Type</TableCell>
                                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Contact</TableCell>
                                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Account</TableCell>
                                                    <TableCell sx={{ fontWeight: 600, fontSize: '12px', color: '#374151' }}>Actions</TableCell>
                                                </TableRow>
                                            </TableHead>
                                            <TableBody>
                                                {paginatedQuickShipCarriers.map((carrier) => (
                                                    <TableRow key={carrier.id} hover>
                                                        <TableCell>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                                                <Avatar
                                                                    src={carrier.logoURL}
                                                                    sx={{
                                                                        width: 40,
                                                                        height: 40,
                                                                        bgcolor: '#f3f4f6'
                                                                    }}
                                                                >
                                                                    <LocalShippingIcon sx={{ color: '#9ca3af' }} />
                                                                </Avatar>
                                                                <Box>
                                                                    <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '12px' }}>
                                                                        {carrier.name}
                                                                    </Typography>
                                                                    <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px' }}>
                                                                        Created: {carrier.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                                                                    </Typography>
                                                                </Box>
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Chip
                                                                label={carrier.carrierType?.charAt(0).toUpperCase() + carrier.carrierType?.slice(1) || 'Freight'}
                                                                size="small"
                                                                sx={{
                                                                    fontSize: '11px',
                                                                    height: 20,
                                                                    bgcolor: carrier.carrierType === 'courier' ? '#dbeafe' :
                                                                        carrier.carrierType === 'hybrid' ? '#fef3c7' : '#dcfce7',
                                                                    color: carrier.carrierType === 'courier' ? '#1e40af' :
                                                                        carrier.carrierType === 'hybrid' ? '#92400e' : '#166534'
                                                                }}
                                                            />
                                                        </TableCell>
                                                        <TableCell>
                                                            <Box>
                                                                <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                    {carrier.contactName}
                                                                </Typography>
                                                                <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px' }}>
                                                                    {carrier.contactEmail}
                                                                </Typography>
                                                                {carrier.contactPhone && (
                                                                    <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px', display: 'block' }}>
                                                                        {carrier.contactPhone}
                                                                    </Typography>
                                                                )}
                                                            </Box>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Typography variant="body2" sx={{ fontSize: '12px' }}>
                                                                {carrier.accountNumber || 'N/A'}
                                                            </Typography>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Tooltip title="More Actions">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={(e) => handleOpenMenu(e, carrier)}
                                                                >
                                                                    <MoreVertIcon fontSize="small" />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </TableContainer>

                                    <TablePagination
                                        rowsPerPageOptions={[5, 10, 25]}
                                        component="div"
                                        count={quickShipCarriers.length}
                                        rowsPerPage={quickShipRowsPerPage}
                                        page={quickShipPage}
                                        onPageChange={handleQuickShipChangePage}
                                        onRowsPerPageChange={handleQuickShipChangeRowsPerPage}
                                        sx={{
                                            borderTop: '1px solid #e5e7eb',
                                            bgcolor: '#fafafa',
                                            '& .MuiTablePagination-toolbar': {
                                                fontSize: '12px'
                                            },
                                            '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
                                                fontSize: '12px'
                                            }
                                        }}
                                    />
                                </>
                            )}
                        </TabPanel>
                    </Paper>

                    {/* Action Menu for QuickShip Carriers */}
                    <Menu
                        anchorEl={anchorEl}
                        open={Boolean(anchorEl)}
                        onClose={handleCloseMenu}
                        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                    >
                        <MenuItem onClick={() => handleEditQuickShipCarrier(selectedQuickShipCarrier)}>
                            <ListItemIcon>
                                <EditIcon fontSize="small" />
                            </ListItemIcon>
                            <ListItemText>Edit Carrier</ListItemText>
                        </MenuItem>
                        <MenuItem
                            onClick={() => handleDeleteQuickShipCarrier(selectedQuickShipCarrier)}
                            sx={{ color: 'error.main' }}
                        >
                            <ListItemIcon>
                                <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
                            </ListItemIcon>
                            <ListItemText>Delete Carrier</ListItemText>
                        </MenuItem>
                    </Menu>

                    {/* QuickShip Carrier Dialog */}
                    <QuickShipCarrierDialog
                        open={showQuickShipDialog}
                        onClose={() => setShowQuickShipDialog(false)}
                        onSuccess={handleQuickShipCarrierSuccess}
                        editingCarrier={editingQuickShipCarrier}
                        existingCarriers={quickShipCarriers}
                        companyId={companyIdForAddress}
                    />

                    {/* Configuration Dialog for API Carriers */}
                    <Dialog
                        open={configDialogOpen}
                        onClose={handleCloseDialog}
                        maxWidth="md"
                        fullWidth
                    >
                        <DialogTitle>
                            Configure {selectedCarrier?.name}
                        </DialogTitle>
                        <DialogContent dividers>
                            <FormControl component="fieldset" sx={{ mb: 3 }}>
                                <FormLabel component="legend">Connection Type</FormLabel>
                                <RadioGroup
                                    value={credentials.type}
                                    onChange={(e) => setCredentials(prev => ({ ...prev, type: e.target.value }))}
                                >
                                    <FormControlLabel
                                        value="soluship"
                                        control={<Radio />}
                                        label={
                                            <Box>
                                                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                                                    Soluship Connect (Recommended)
                                                </Typography>
                                                <Typography variant="caption" color="text.secondary">
                                                    Use SolushipX default credentials. Quick setup with no configuration required.
                                                </Typography>
                                            </Box>
                                        }
                                    />
                                    <FormControlLabel
                                        value="custom"
                                        control={<Radio />}
                                        disabled={true}
                                        label={
                                            <Box>
                                                <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.disabled' }}>
                                                    My Own Credentials (Coming Soon)
                                                </Typography>
                                                <Typography variant="caption" color="text.disabled">
                                                    Custom credential configuration will be available in a future update.
                                                </Typography>
                                            </Box>
                                        }
                                    />
                                </RadioGroup>
                            </FormControl>

                            {credentials.type === 'soluship' && (
                                <Alert severity="info" sx={{ mb: 2 }}>
                                    <Typography variant="body2">
                                        <strong>Soluship Connect</strong> uses SolushipX managed credentials.
                                        Shipments will be processed through your SolushipX account with competitive rates.
                                        No additional configuration required.
                                    </Typography>
                                </Alert>
                            )}

                            {credentials.type === 'custom' && (
                                <Alert severity="warning" sx={{ mb: 2 }}>
                                    <Typography variant="body2">
                                        Custom credential configuration is temporarily unavailable.
                                        Please use Soluship Connect for now.
                                    </Typography>
                                </Alert>
                            )}
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={handleCloseDialog}>
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleSaveCredentials}
                                disabled={saving || credentials.type === 'custom'}
                                startIcon={saving ? <CircularProgress size={20} /> : <SaveIcon />}
                            >
                                {saving ? 'Processing...' : 'Confirm Soluship Connect'}
                            </Button>
                        </DialogActions>
                    </Dialog>

                    <Snackbar
                        open={!!successMessage}
                        autoHideDuration={6000}
                        onClose={handleCloseSnackbar}
                        message={successMessage}
                    />
                </Box>
            </Box>
        </div>
    );
};

export default CarriersEnhanced; 