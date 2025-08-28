import React, { useState, useEffect, useMemo, useCallback } from 'react';
import RateCardManagement from './components/RateCardManagement';
import QuickShipConversionWizard from './components/QuickShipConversionWizard';
import {
    Box,
    Paper,
    Typography,
    Button,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Switch,
    IconButton,
    Tooltip,
    Chip,
    CircularProgress,
    InputLabel,
    MenuItem,
    Select,
    FormControl,
    InputAdornment,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    Menu,
    ListItemIcon,
    ListItemText,
    Tabs,
    Tab,
    Badge,
    Collapse,
    Grid,
    Avatar,
    Alert,
    FormControlLabel,
    Checkbox,
    Checkbox as MuiCheckbox,
    TableContainer,
    Divider
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Search as SearchIcon,
    MoreVert as MoreVertIcon,
    FilterList as FilterListIcon,
    Close as CloseIcon,
    LocalShipping as CarrierIcon,
    ContentCopy as ContentCopyIcon,
    Warning as WarningIcon,
    Block as BlockIcon,
    CloudUpload as CloudUploadIcon,
    Save as SaveIcon,
    Remove as RemoveIcon,
    Visibility as VisibilityIcon,
    Business as BusinessIcon,
    MonetizationOn as MonetizationOnIcon,
    Upgrade as UpgradeIcon,
    Route as RouteIcon,
    FitnessCenter as WeightIcon,
    AspectRatio as DimensionIcon,
    Calculate as CalculateIcon
} from '@mui/icons-material';
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useCompany } from '../../../contexts/CompanyContext';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';

// Import reusable components that match ShipmentsX patterns
import ModalHeader from '../../common/ModalHeader';
import AdminBreadcrumb from '../AdminBreadcrumb';
import DimFactorManagement from './components/DimFactorManagement';

// Import modular carrier components
import AddCarrier from './AddCarrier';
import EditCarrier from './EditCarrier';

// Import QuickShip Carrier Dialog (similar to regular Carriers.jsx)
let QuickShipCarrierDialog;
try {
    QuickShipCarrierDialog = require('../../CreateShipment/QuickShipCarrierDialog').default;
} catch (error) {
    console.error('Error importing QuickShipCarrierDialog:', error);
    QuickShipCarrierDialog = () => <div>QuickShip Carrier Dialog failed to load</div>;
}

// Import Carrier Routing Dialog
let CarrierRoutingDialog;
try {
    CarrierRoutingDialog = require('../../Carriers/components/CarrierRoutingDialog').default;
} catch (error) {
    console.error('Error importing CarrierRoutingDialog:', error);
    CarrierRoutingDialog = () => <div>Carrier Routing Dialog failed to load</div>;
}

// Import Carrier Weight Dialog
let CarrierWeightDialog;
try {
    CarrierWeightDialog = require('./components/CarrierWeightDialog').default;
} catch (error) {
    console.error('Error importing CarrierWeightDialog:', error);
    CarrierWeightDialog = () => <div>Carrier Weight Dialog failed to load</div>;
}

// Import Carrier Dimension Dialog
let CarrierDimensionDialog;
try {
    CarrierDimensionDialog = require('./components/CarrierDimensionDialog').default;
} catch (error) {
    console.error('Error importing CarrierDimensionDialog:', error);
    CarrierDimensionDialog = () => <div>Carrier Dimension Dialog failed to load</div>;
}

// Import Carrier Rate Upload Dialog
let CarrierRateUploadDialog;
try {
    CarrierRateUploadDialog = require('./components/CarrierRateUploadDialog').default;
} catch (error) {
    console.error('Error importing CarrierRateUploadDialog:', error);
    CarrierRateUploadDialog = () => <div>Carrier Rate Upload Dialog failed to load</div>;
}

const carrierTypes = [
    { value: 'courier', label: 'Courier' },
    { value: 'freight', label: 'Freight' },
    { value: 'hybrid', label: 'Hybrid' },
];

const connectionTypes = [
    { value: 'api', label: 'API Integration', description: 'Automatic rate fetching via carrier API' },
    { value: 'manual', label: 'Manual Connection', description: 'Manual rate setting via phone/email contact' },
];

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
                        InputProps={{ sx: { fontSize: '12px' } }}
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

// Skeleton component for loading state
const CarriersTableSkeleton = () => {
    return (
        <Table>
            <TableHead>
                <TableRow>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Carrier</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Carrier ID</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Type</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Connection</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Status</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Account Number</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Created</TableCell>
                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Actions</TableCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {[...Array(10)].map((_, index) => (
                    <TableRow key={index}>
                        <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Avatar sx={{ width: 28, height: 28, bgcolor: '#e5e7eb' }}>
                                    <CarrierIcon sx={{ fontSize: '14px' }} />
                                </Avatar>
                                <Box sx={{ height: '16px', width: '120px', bgcolor: '#e5e7eb', borderRadius: '4px' }} />
                            </Box>
                        </TableCell>
                        <TableCell><Box sx={{ height: '16px', width: '80px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
                        <TableCell><Chip label="Loading" size="small" sx={{ bgcolor: '#e5e7eb', color: 'transparent' }} /></TableCell>
                        <TableCell><Box sx={{ height: '16px', width: '120px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
                        <TableCell><Box sx={{ height: '16px', width: '80px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
                        <TableCell><Box sx={{ height: '16px', width: '90px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
                        <TableCell>
                            <IconButton size="small" disabled>
                                <MoreVertIcon />
                            </IconButton>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
};

// Custom pagination component matching ShipmentsX
const CarriersPagination = ({
    totalCount,
    currentPage,
    rowsPerPage,
    onPageChange,
    onRowsPerPageChange
}) => {
    const totalPages = Math.ceil(totalCount / rowsPerPage);
    const startItem = (currentPage - 1) * rowsPerPage + 1;
    const endItem = Math.min(currentPage * rowsPerPage, totalCount);

    return (
        <Box sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 2,
            borderTop: '1px solid #e5e7eb',
            bgcolor: '#fafafa'
        }}>
            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                Showing {startItem.toLocaleString()}-{endItem.toLocaleString()} of {totalCount.toLocaleString()} carriers
            </Typography>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                        Rows per page:
                    </Typography>
                    <Select
                        size="small"
                        value={rowsPerPage}
                        onChange={(e) => onRowsPerPageChange(Number(e.target.value))}
                        sx={{ fontSize: '12px', minWidth: '60px' }}
                    >
                        <MenuItem value={10}>10</MenuItem>
                        <MenuItem value={25}>25</MenuItem>
                        <MenuItem value={50}>50</MenuItem>
                        <MenuItem value={100}>100</MenuItem>
                    </Select>
                </Box>

                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                        size="small"
                        onClick={() => onPageChange(1)}
                        disabled={currentPage === 1}
                        sx={{ fontSize: '12px', minWidth: '32px' }}
                    >
                        First
                    </Button>
                    <Button
                        size="small"
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage === 1}
                        sx={{ fontSize: '12px', minWidth: '32px' }}
                    >
                        Prev
                    </Button>
                    <Typography variant="body2" sx={{ fontSize: '12px', px: 2, py: 1, bgcolor: '#f3f4f6', borderRadius: '4px' }}>
                        {currentPage} of {totalPages}
                    </Typography>
                    <Button
                        size="small"
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        sx={{ fontSize: '12px', minWidth: '32px' }}
                    >
                        Next
                    </Button>
                    <Button
                        size="small"
                        onClick={() => onPageChange(totalPages)}
                        disabled={currentPage === totalPages}
                        sx={{ fontSize: '12px', minWidth: '32px' }}
                    >
                        Last
                    </Button>
                </Box>
            </Box>
        </Box>
    );
};

const Carriers = ({ isModal = false, onClose = null, showCloseButton = false }) => {
    // Contexts
    const { companyIdForAddress } = useCompany();

    // Main tab state - NEW: Two-tab system
    const [mainTab, setMainTab] = useState(0); // 0 = Connected Carriers, 1 = Quickship Carriers

    // Connected Carriers data states (existing functionality)
    const [carriers, setCarriers] = useState([]);
    const [allCarriers, setAllCarriers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [totalCount, setTotalCount] = useState(0);

    // Connected Carriers tab and filter states
    const [selectedTab, setSelectedTab] = useState('all');
    const [page, setPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(25);

    // NEW: Quickship Carriers states
    const [quickshipCarriers, setQuickshipCarriers] = useState([]);
    const [allQuickshipCarriers, setAllQuickshipCarriers] = useState([]);
    const [quickshipLoading, setQuickshipLoading] = useState(false);
    const [quickshipTotalCount, setQuickshipTotalCount] = useState(0);
    const [quickshipPage, setQuickshipPage] = useState(1);
    const [quickshipRowsPerPage, setQuickshipRowsPerPage] = useState(25);

    // NEW: Company filter for quickship carriers
    const [companies, setCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState('all');

    // NEW: Quickship search and filters
    const [quickshipSearchFields, setQuickshipSearchFields] = useState({
        carrierName: '',
        contactName: '',
        accountNumber: '',
        companyName: ''
    });

    // NEW: Quickship dialog states
    const [showQuickshipDialog, setShowQuickshipDialog] = useState(false);
    const [editingQuickshipCarrier, setEditingQuickshipCarrier] = useState(null);
    const [selectedQuickshipCarrier, setSelectedQuickshipCarrier] = useState(null);
    const [quickshipActionMenuAnchor, setQuickshipActionMenuAnchor] = useState(null);

    // NEW: Carrier eligibility states
    const [showEligibilityDialog, setShowEligibilityDialog] = useState(false);

    // NEW: DIM Factor management states
    const [showDimFactorDialog, setShowDimFactorDialog] = useState(false);
    const [dimFactorCarrier, setDimFactorCarrier] = useState(null);
    const [editingEligibilityRule, setEditingEligibilityRule] = useState(null);
    const [eligibilityRules, setEligibilityRules] = useState([]);
    const [eligibilityLoading, setEligibilityLoading] = useState(false);


    // Filter states
    const [filters, setFilters] = useState({
        status: 'all',
        type: 'all',
        enabled: 'all'
    });
    const [searchFields, setSearchFields] = useState({
        carrierName: '',
        carrierId: '',
        accountNumber: ''
    });
    const [filtersOpen, setFiltersOpen] = useState(false);

    // UI states
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: '',
        severity: 'info'
    });

    // Dialog states
    const [selectedCarrier, setSelectedCarrier] = useState(null);
    const [actionMenuAnchorEl, setActionMenuAnchorEl] = useState(null);
    const [openDialog, setOpenDialog] = useState(false);
    const [openDeleteConfirm, setOpenDeleteConfirm] = useState(false);
    const [forceDelete, setForceDelete] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);

    // Modular dialog states
    const [showEditCarrier, setShowEditCarrier] = useState(false);
    const [editCarrierId, setEditCarrierId] = useState(null);

    // Rate management dialog states
    const [showRateCardManagement, setShowRateCardManagement] = useState(false);
    const [rateCardCarrier, setRateCardCarrier] = useState(null);

    // Carrier routing dialog states
    const [showRoutingDialog, setShowRoutingDialog] = useState(false);
    const [routingCarrier, setRoutingCarrier] = useState(null);

    // Carrier weight dialog states
    const [showWeightDialog, setShowWeightDialog] = useState(false);
    const [weightCarrier, setWeightCarrier] = useState(null);

    // Carrier dimension dialog states
    const [showDimensionDialog, setShowDimensionDialog] = useState(false);
    const [dimensionCarrier, setDimensionCarrier] = useState(null);
    const [showRateUploadDialog, setShowRateUploadDialog] = useState(false);
    const [rateUploadCarrier, setRateUploadCarrier] = useState(null);

    // Conversion wizard states
    const [showConversionWizard, setShowConversionWizard] = useState(false);
    const [conversionCarrier, setConversionCarrier] = useState(null);

    // Form states
    const [formData, setFormData] = useState({
        name: '',
        carrierID: '',
        accountNumber: '',
        type: 'courier',
        connectionType: 'api',
        enabled: true,
        hostURL: '',
        username: '',
        password: '',
        secret: '',
        logoFileName: '',
        logoURL: '',
        contactInfo: {
            phone: '',
            email: '',
            contactPerson: '',
            preferredContactMethod: 'email'
        },
        emailConfiguration: {
            carrierConfirmationEmails: [''],
            carrierNotificationEmails: [''],
            preArrivalNotificationEmails: [''],
            rateRequestEmails: [''],
            billingEmails: ['']
        },
        services: [],
        rateStructure: {
            pricingModel: 'weight',
            baseRates: {},
            surcharges: []
        }
    });
    const [endpoints, setEndpoints] = useState({
        rate: '',
        booking: '',
        tracking: '',
        cancel: '',
        labels: '',
        status: ''
    });
    const [logoFile, setLogoFile] = useState(null);
    const [logoPreview, setLogoPreview] = useState('');
    const [saving, setSaving] = useState(false);
    const [carrierIdError, setCarrierIdError] = useState('');
    const [formErrors, setFormErrors] = useState({});

    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const { enqueueSnackbar } = useSnackbar();

    // Determine user role for company filtering
    const [userRole, setUserRole] = useState(null);
    const [connectedCompanies, setConnectedCompanies] = useState([]);

    // Check user role and connected companies
    useEffect(() => {
        const checkUserRole = async () => {
            if (!currentUser?.email) return;

            try {
                const usersRef = collection(db, 'users');
                const q = query(usersRef, where('email', '==', currentUser.email));
                const querySnapshot = await getDocs(q);

                if (!querySnapshot.empty) {
                    const userData = querySnapshot.docs[0].data();
                    setUserRole(userData.role || 'user');
                    setConnectedCompanies(userData.connectedCompanies?.companies || []);
                    console.log('👤 User role detected:', userData.role, 'Connected companies:', userData.connectedCompanies?.companies?.length || 0);
                }
            } catch (error) {
                console.error('❌ Error checking user role:', error);
                setUserRole('user'); // Default to regular user
            }
        };

        checkUserRole();
    }, [currentUser]);

    // Helper function to show snackbar
    const showSnackbar = useCallback((message, severity = 'info') => {
        setSnackbar({
            open: true,
            message,
            severity
        });
    }, []);

    // NEW: Load companies for the filter dropdown
    const fetchCompanies = useCallback(async () => {
        if (!userRole) return; // Wait for user role to be determined

        try {
            console.log('🏢 Fetching companies for admin view...', { userRole, connectedCompaniesCount: connectedCompanies.length });

            let companiesData = [];

            if (userRole === 'superadmin') {
                // Super admins can see all companies
                const companiesRef = collection(db, 'companies');
                const companiesSnapshot = await getDocs(companiesRef);
                companiesData = companiesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                console.log('👑 Super admin: loaded all companies:', companiesData.length);
                console.log('🔍 Raw company data structure:', companiesData.slice(0, 3).map(c => ({
                    id: c.id,
                    companyName: c.companyName,
                    name: c.name,
                    companyname: c.companyname, // lowercase variant
                    company_name: c.company_name, // underscore variant
                    companyDisplayName: c.companyDisplayName, // camelCase variant
                    allFields: Object.keys(c)
                })));

                // Extra debug: Check if we can find companies with ANY name-like field
                const companiesWithAnyName = companiesData.filter(c =>
                    c.companyName || c.name || c.companyname || c.company_name || c.companyDisplayName || c.displayName
                );
                console.log('🔍 Companies with any name field:', companiesWithAnyName.length, 'out of', companiesData.length);
            } else if (userRole === 'admin') {
                // Regular admins can only see their connected companies
                if (connectedCompanies.length > 0) {
                    const companiesRef = collection(db, 'companies');
                    const companiesSnapshot = await getDocs(companiesRef);
                    const allCompanies = companiesSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));

                    // Filter to only connected companies
                    companiesData = allCompanies.filter(company =>
                        connectedCompanies.some(connected =>
                            connected.companyId === company.id ||
                            connected.companyId === company.companyID
                        )
                    );
                    console.log('👔 Regular admin: filtered to connected companies:', companiesData.length);
                } else {
                    console.log('📭 No connected companies for admin user');
                }
            } else {
                console.log('🚫 User role does not have access to company management');
                return;
            }

            // Filter and sort companies
            const filteredCompanies = companiesData
                .filter(company => {
                    const hasName = company.companyName || company.name || company.companyname ||
                        company.company_name || company.companyDisplayName || company.displayName;
                    if (!hasName) {
                        console.log('🚫 Filtering out company without name:', {
                            id: company.id,
                            companyName: company.companyName,
                            name: company.name,
                            companyname: company.companyname,
                            company_name: company.company_name,
                            companyDisplayName: company.companyDisplayName,
                            displayName: company.displayName,
                            allFields: Object.keys(company)
                        });
                    }
                    return hasName;
                }) // Include companies with any name field
                .sort((a, b) => {
                    const nameA = a.companyName || a.name || a.companyname || a.company_name || a.companyDisplayName || a.displayName || '';
                    const nameB = b.companyName || b.name || b.companyname || b.company_name || b.companyDisplayName || b.displayName || '';
                    return nameA.localeCompare(nameB);
                }); // Sort alphabetically

            console.log('✅ Loaded companies for admin:', filteredCompanies.length);
            console.log('📋 Company details:', filteredCompanies.map(c => ({
                id: c.id,
                name: c.companyName || c.name || c.companyname || c.company_name || c.companyDisplayName || c.displayName,
                companyID: c.companyID,
                hasLogo: !!c.logoUrl,
                logoFields: {
                    logoUrl: c.logoUrl,
                    logoURL: c.logoURL,
                    companyLogo: c.companyLogo,
                    logo: c.logo,
                    companyLogoURL: c.companyLogoURL
                }
            })));

            setCompanies(filteredCompanies);

            // Auto-select first company for regular admins (or keep 'all' for super admins)
            if (userRole === 'admin' && filteredCompanies.length === 1) {
                setSelectedCompany(filteredCompanies[0].companyID || filteredCompanies[0].id);
            } else if (userRole === 'admin' && filteredCompanies.length > 1) {
                // For regular admins with multiple companies, auto-select the first one
                setSelectedCompany(filteredCompanies[0].companyID || filteredCompanies[0].id);
            }
            // For super admins, selectedCompany defaults to 'all' which is correct
        } catch (error) {
            console.error('❌ Error loading companies:', error);
            showSnackbar('Failed to load companies', 'error');
        }
    }, [userRole, connectedCompanies, showSnackbar]);

    // NEW: Load quickship carriers across all companies (admin view)
    const fetchQuickshipCarriers = useCallback(async () => {
        console.log('🚚 Fetching quickship carriers...');
        setQuickshipLoading(true);
        try {
            let carriersQuery;

            if (selectedCompany === 'all') {
                // Load all quickship carriers
                carriersQuery = query(collection(db, 'quickshipCarriers'), orderBy('name', 'asc'));
            } else {
                // Load carriers for specific company
                carriersQuery = query(
                    collection(db, 'quickshipCarriers'),
                    where('companyID', '==', selectedCompany),
                    orderBy('name', 'asc')
                );
            }

            const querySnapshot = await getDocs(carriersQuery);
            const carriersData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log('✅ Loaded quickship carriers:', carriersData.length);
            setAllQuickshipCarriers(carriersData);
            setQuickshipTotalCount(carriersData.length);
        } catch (error) {
            console.error('❌ Error loading quickship carriers:', error);
            // Try without orderBy if there's an index issue
            try {
                let fallbackQuery;
                if (selectedCompany === 'all') {
                    fallbackQuery = collection(db, 'quickshipCarriers');
                } else {
                    fallbackQuery = query(
                        collection(db, 'quickshipCarriers'),
                        where('companyID', '==', selectedCompany)
                    );
                }

                const fallbackSnapshot = await getDocs(fallbackQuery);
                const fallbackData = fallbackSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                console.log('✅ Loaded quickship carriers (fallback):', fallbackData.length);
                setAllQuickshipCarriers(fallbackData);
                setQuickshipTotalCount(fallbackData.length);
            } catch (fallbackError) {
                console.error('❌ Fallback query also failed:', fallbackError);
                showSnackbar('Failed to load quickship carriers', 'error');
                setAllQuickshipCarriers([]);
                setQuickshipTotalCount(0);
            }
        } finally {
            setQuickshipLoading(false);
        }
    }, [selectedCompany, showSnackbar]);

    // Fetch carriers data - moved up to avoid hoisting issues
    const fetchCarriers = useCallback(async () => {
        console.log('fetchCarriers: Starting to fetch carriers from Firestore');
        setLoading(true);
        try {
            const carriersRef = collection(db, 'carriers');
            const q = query(carriersRef, orderBy('name', 'asc'));
            const querySnapshot = await getDocs(q);
            const carriersData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log('fetchCarriers: Raw carriers data from Firestore:', carriersData.length, 'documents');

            // Filter out deleted carriers
            const activeCarriers = carriersData.filter(carrier => carrier.status !== 'deleted');
            console.log('fetchCarriers: Active carriers after filtering:', activeCarriers.length, 'documents');

            setAllCarriers(activeCarriers);
            setTotalCount(activeCarriers.length);

            // Log logo URLs for debugging
            activeCarriers.forEach(carrier => {
                if (carrier.logoURL) {
                    console.log(`fetchCarriers: ${carrier.name} - logoURL: ${carrier.logoURL}`);
                }
            });
        } catch (error) {
            console.error('Error loading carriers:', error);
            showSnackbar('Failed to load carriers', 'error');
        } finally {
            setLoading(false);
        }
    }, [showSnackbar]);

    // Action menu handlers - moved up to avoid hoisting issues
    const handleActionMenuOpen = useCallback((event, carrier) => {
        setSelectedCarrier(carrier);
        setActionMenuAnchorEl(event.currentTarget);
    }, []);

    const handleActionMenuClose = useCallback(() => {
        setSelectedCarrier(null);
        setActionMenuAnchorEl(null);
    }, []);

    // Modular dialog handlers
    const handleOpenAddCarrier = useCallback(() => {
        navigate('/admin/carriers/new');
    }, [navigate]);



    const handleOpenEditCarrier = useCallback((carrierId) => {
        setEditCarrierId(carrierId);
        setShowEditCarrier(true);
        handleActionMenuClose();
    }, [handleActionMenuClose]);

    const handleCloseEditCarrier = useCallback(() => {
        setShowEditCarrier(false);
        setEditCarrierId(null);
    }, []);

    const handleCarrierCreated = useCallback((carrierId, carrierData) => {
        fetchCarriers(); // Refresh the carriers list
        showSnackbar('Carrier created successfully', 'success');
    }, [fetchCarriers, showSnackbar]);

    const handleCarrierUpdated = useCallback((carrierId, carrierData) => {
        fetchCarriers(); // Refresh the carriers list
        setShowEditCarrier(false);
        setEditCarrierId(null);
        showSnackbar('Carrier updated successfully', 'success');
    }, [fetchCarriers, showSnackbar]);

    const handleViewCarrier = useCallback((carrierId) => {
        navigate(`/admin/carriers/${carrierId}`);
        handleActionMenuClose();
    }, [navigate, handleActionMenuClose]);

    // Calculate stats
    const stats = useMemo(() => {
        const total = allCarriers.length;
        const enabled = allCarriers.filter(c => c.enabled === true).length;
        const disabled = allCarriers.filter(c => c.enabled === false).length;
        const courier = allCarriers.filter(c => c.type === 'courier').length;
        const freight = allCarriers.filter(c => c.type === 'freight').length;
        const hybrid = allCarriers.filter(c => c.type === 'hybrid').length;

        return {
            total,
            enabled,
            disabled,
            courier,
            freight,
            hybrid
        };
    }, [allCarriers]);

    // Main tab change handler - NEW
    const handleMainTabChange = (event, newValue) => {
        setMainTab(newValue);
        setPage(1);
        setQuickshipPage(1);
    };

    // Connected Carriers tab change handler (existing)
    const handleTabChange = (event, newValue) => {
        setSelectedTab(newValue);
        setPage(1); // Reset to first page when tab changes
    };

    // NEW: Quickship carrier handlers
    const handleAddQuickshipCarrier = () => {
        // For super admins with "all" selected, they need to pick a specific company first
        // For regular admins, they should have a specific company auto-selected
        if (selectedCompany === 'all') {
            showSnackbar('Please select a specific company from the dropdown before adding a QuickShip carrier', 'warning');
            return;
        }

        // Ensure we have a valid company selected
        if (!selectedCompany) {
            showSnackbar('Please select a company before adding a QuickShip carrier', 'warning');
            return;
        }

        setEditingQuickshipCarrier(null);
        setShowQuickshipDialog(true);
    };

    // NEW: Carrier eligibility handlers
    const handleAddEligibilityRule = () => {
        setEditingEligibilityRule(null);
        setShowEligibilityDialog(true);
    };

    const handleEditQuickshipCarrier = (carrier) => {
        setEditingQuickshipCarrier(carrier);
        setShowQuickshipDialog(true);
        setQuickshipActionMenuAnchor(null);
    };

    const handleDeleteQuickshipCarrier = async (carrier) => {
        if (!window.confirm(`Are you sure you want to delete ${carrier.name}?`)) {
            return;
        }

        try {
            await deleteDoc(doc(db, 'quickshipCarriers', carrier.id));
            await fetchQuickshipCarriers(); // Refresh the list
            showSnackbar(`${carrier.name} has been deleted successfully.`, 'success');
        } catch (error) {
            console.error('Error deleting quickship carrier:', error);
            showSnackbar('Failed to delete carrier. Please try again.', 'error');
        }
        setQuickshipActionMenuAnchor(null);
    };

    // NEW: Rate card management handlers
    const handleManageRateCards = (carrier) => {
        setRateCardCarrier(carrier);
        setShowRateCardManagement(true);
        setQuickshipActionMenuAnchor(null);
    };

    const handleCloseRateCardManagement = () => {
        setShowRateCardManagement(false);
        setRateCardCarrier(null);
    };

    // NEW: Carrier routing handlers
    const handleManageRoutes = (carrier) => {
        setRoutingCarrier(carrier);
        setShowRoutingDialog(true);
        setQuickshipActionMenuAnchor(null);
    };

    const handleCloseRoutingDialog = () => {
        setShowRoutingDialog(false);
        setRoutingCarrier(null);
    };

    // NEW: Carrier weight handlers
    const handleManageWeight = (carrier) => {
        setWeightCarrier(carrier);
        setShowWeightDialog(true);
        setQuickshipActionMenuAnchor(null);
    };

    const handleWeightDialogClose = () => {
        setShowWeightDialog(false);
        setWeightCarrier(null);
    };

    // NEW: Carrier dimension handlers
    const handleManageDimensions = (carrier) => {
        setDimensionCarrier(carrier);
        setShowDimensionDialog(true);
        setQuickshipActionMenuAnchor(null);
    };

    // NEW: DIM Factor management handler
    const handleManageDimFactors = (carrier) => {
        setDimFactorCarrier(carrier);
        setShowDimFactorDialog(true);
        setQuickshipActionMenuAnchor(null);
    };

    const handleDimensionDialogClose = () => {
        setShowDimensionDialog(false);
        setDimensionCarrier(null);
    };

    const handleUploadRateCard = (carrier) => {
        setRateUploadCarrier(carrier);
        setShowRateUploadDialog(true);
        setQuickshipActionMenuAnchor(null);
    };

    const handleRateUploadDialogClose = () => {
        setShowRateUploadDialog(false);
        setRateUploadCarrier(null);
    };

    // NEW: Conversion wizard handlers
    const handleConvertToConnected = (carrier) => {
        setConversionCarrier(carrier);
        setShowConversionWizard(true);
        setQuickshipActionMenuAnchor(null);
    };

    const handleCloseConversionWizard = () => {
        setShowConversionWizard(false);
        setConversionCarrier(null);
    };

    const handleConversionComplete = async (result) => {
        if (result.success) {
            // Refresh the QuickShip carriers list
            await fetchQuickshipCarriers();
            showSnackbar('Carrier converted successfully!', 'success');
        }
    };

    const handleQuickshipCarrierSaved = async () => {
        setShowQuickshipDialog(false);
        setEditingQuickshipCarrier(null);
        await fetchQuickshipCarriers(); // Refresh the list
        showSnackbar('Quickship carrier saved successfully!', 'success');
    };

    // NEW: Quickship action menu handlers
    const handleQuickshipActionMenuOpen = (event, carrier) => {
        setSelectedQuickshipCarrier(carrier);
        setQuickshipActionMenuAnchor(event.currentTarget);
    };

    const handleQuickshipActionMenuClose = () => {
        setQuickshipActionMenuAnchor(null);
        setSelectedQuickshipCarrier(null);
    };

    // NEW: Company filter change handler
    const handleCompanyChange = (event) => {
        setSelectedCompany(event.target.value);
        setQuickshipPage(1); // Reset to first page when company changes
    };





    // Copy to clipboard handler
    const handleCopyToClipboard = async (text, label) => {
        try {
            await navigator.clipboard.writeText(text);
            showSnackbar(`${label} copied to clipboard`, 'success');
        } catch (error) {
            showSnackbar(`Failed to copy ${label}`, 'error');
        }
    };



    // NEW: Load companies and quickship carriers when component mounts or dependencies change
    useEffect(() => {
        fetchCompanies();
        if (mainTab === 1) { // Only load quickship carriers when on quickship tab
            fetchQuickshipCarriers();
        }
    }, [fetchCompanies, fetchQuickshipCarriers, mainTab]);

    // NEW: Reload quickship carriers when company filter changes
    useEffect(() => {
        if (mainTab === 1) {
            fetchQuickshipCarriers();
        }
    }, [selectedCompany, fetchQuickshipCarriers, mainTab]);

    // NEW: Filter and paginate quickship carriers
    useEffect(() => {
        console.log('🔍 Filtering quickship carriers...', {
            total: allQuickshipCarriers.length,
            searchFields: quickshipSearchFields,
            page: quickshipPage,
            rowsPerPage: quickshipRowsPerPage
        });

        let filtered = [...allQuickshipCarriers];

        // Apply search filters
        if (quickshipSearchFields.carrierName) {
            filtered = filtered.filter(carrier =>
                carrier.name?.toLowerCase().includes(quickshipSearchFields.carrierName.toLowerCase())
            );
        }
        if (quickshipSearchFields.contactName) {
            filtered = filtered.filter(carrier =>
                carrier.contactName?.toLowerCase().includes(quickshipSearchFields.contactName.toLowerCase())
            );
        }
        if (quickshipSearchFields.accountNumber) {
            filtered = filtered.filter(carrier =>
                carrier.accountNumber?.toLowerCase().includes(quickshipSearchFields.accountNumber.toLowerCase())
            );
        }
        if (quickshipSearchFields.companyName) {
            // Find company name from companies array
            filtered = filtered.filter(carrier => {
                const company = companies.find(c => c.id === carrier.companyID || c.companyID === carrier.companyID);
                const companyName = company?.companyName || '';
                return companyName.toLowerCase().includes(quickshipSearchFields.companyName.toLowerCase());
            });
        }

        // Apply pagination
        const startIndex = (quickshipPage - 1) * quickshipRowsPerPage;
        const endIndex = startIndex + quickshipRowsPerPage;
        const paginated = filtered.slice(startIndex, endIndex);

        console.log('✅ Quickship carriers after filtering and pagination:', {
            filtered: filtered.length,
            paginated: paginated.length,
            startIndex,
            endIndex
        });

        setQuickshipCarriers(paginated);
        setQuickshipTotalCount(filtered.length);
    }, [allQuickshipCarriers, quickshipSearchFields, quickshipPage, quickshipRowsPerPage, companies]);

    // Filter and paginate carriers
    useEffect(() => {
        let filtered = [...allCarriers];

        // Apply tab filter
        if (selectedTab !== 'all') {
            switch (selectedTab) {
                case 'enabled':
                    filtered = filtered.filter(c => c.enabled === true);
                    break;
                case 'disabled':
                    filtered = filtered.filter(c => c.enabled === false);
                    break;
                case 'courier':
                    filtered = filtered.filter(c => c.type === 'courier');
                    break;
                case 'freight':
                    filtered = filtered.filter(c => c.type === 'freight');
                    break;
                case 'hybrid':
                    filtered = filtered.filter(c => c.type === 'hybrid');
                    break;
            }
        }

        // Apply search filters
        if (searchFields.carrierName) {
            filtered = filtered.filter(c =>
                c.name.toLowerCase().includes(searchFields.carrierName.toLowerCase())
            );
        }
        if (searchFields.carrierId) {
            filtered = filtered.filter(c =>
                c.carrierID.toLowerCase().includes(searchFields.carrierId.toLowerCase())
            );
        }
        if (searchFields.accountNumber) {
            filtered = filtered.filter(c => {
                const accountNumber = c.apiCredentials?.accountNumber || c.accountNumber || '';
                return accountNumber.toLowerCase().includes(searchFields.accountNumber.toLowerCase());
            });
        }

        // Apply advanced filters
        if (filters.status !== 'all') {
            filtered = filtered.filter(c => c.status === filters.status);
        }
        if (filters.type !== 'all') {
            filtered = filtered.filter(c => c.type === filters.type);
        }
        if (filters.enabled !== 'all') {
            const isEnabled = filters.enabled === 'enabled';
            filtered = filtered.filter(c => c.enabled === isEnabled);
        }

        // Paginate
        const startIndex = (page - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const paginatedCarriers = filtered.slice(startIndex, endIndex);

        setCarriers(paginatedCarriers);
        setTotalCount(filtered.length);
    }, [allCarriers, selectedTab, searchFields, filters, page, rowsPerPage]);

    // Load data on component mount
    useEffect(() => {
        fetchCarriers();
    }, []);

    // Form handlers
    const handleOpenDialog = (carrier = null) => {
        if (carrier) {
            setSelectedCarrier(carrier);
            setFormData({
                name: carrier.name || '',
                carrierID: (carrier.carrierID || '').toUpperCase(),
                accountNumber: carrier.apiCredentials?.accountNumber || carrier.accountNumber || '',
                type: carrier.type || 'courier',
                connectionType: carrier.connectionType || 'api',
                enabled: carrier.enabled ?? true,
                hostURL: carrier.apiCredentials?.hostURL || carrier.hostURL || '',
                username: carrier.apiCredentials?.username || carrier.username || '',
                password: carrier.apiCredentials?.password || carrier.password || '',
                secret: carrier.apiCredentials?.secret || carrier.secret || '',
                logoFileName: carrier.logoFileName || '',
                logoURL: carrier.logoURL || '',
                contactInfo: {
                    phone: carrier.contactInfo?.phone || '',
                    email: carrier.contactInfo?.email || '',
                    contactPerson: carrier.contactInfo?.contactPerson || '',
                    preferredContactMethod: carrier.contactInfo?.preferredContactMethod || 'email'
                },
                emailConfiguration: {
                    carrierConfirmationEmails: carrier.emailConfiguration?.carrierConfirmationEmails || [''],
                    carrierNotificationEmails: carrier.emailConfiguration?.carrierNotificationEmails || [''],
                    preArrivalNotificationEmails: carrier.emailConfiguration?.preArrivalNotificationEmails || [''],
                    rateRequestEmails: carrier.emailConfiguration?.rateRequestEmails || [''],
                    billingEmails: carrier.emailConfiguration?.billingEmails || ['']
                },
                services: carrier.services || [],
                rateStructure: {
                    pricingModel: carrier.rateStructure?.pricingModel || 'weight',
                    baseRates: carrier.rateStructure?.baseRates || {},
                    surcharges: carrier.rateStructure?.surcharges || []
                }
            });
            setEndpoints({
                rate: carrier.apiCredentials?.endpoints?.rate || '',
                booking: carrier.apiCredentials?.endpoints?.booking || '',
                tracking: carrier.apiCredentials?.endpoints?.tracking || '',
                cancel: carrier.apiCredentials?.endpoints?.cancel || '',
                labels: carrier.apiCredentials?.endpoints?.labels || '',
                status: carrier.apiCredentials?.endpoints?.status || ''
            });
            setLogoPreview(carrier.logoURL || '');
            setIsEditMode(true);
        } else {
            setSelectedCarrier(null);
            setFormData({
                name: '',
                carrierID: '',
                accountNumber: '',
                type: 'courier',
                connectionType: 'api',
                enabled: true,
                hostURL: '',
                username: '',
                password: '',
                secret: '',
                logoFileName: '',
                logoURL: '',
                contactInfo: {
                    phone: '',
                    email: '',
                    contactPerson: '',
                    preferredContactMethod: 'email'
                },
                emailConfiguration: {
                    carrierConfirmationEmails: [''],
                    carrierNotificationEmails: [''],
                    preArrivalNotificationEmails: [''],
                    rateRequestEmails: [''],
                    billingEmails: ['']
                },
                services: [],
                rateStructure: {
                    pricingModel: 'weight',
                    baseRates: {},
                    surcharges: []
                }
            });
            setEndpoints({
                rate: '',
                booking: '',
                tracking: '',
                cancel: '',
                labels: '',
                status: ''
            });
            setLogoPreview('');
            setIsEditMode(false);
        }
        setLogoFile(null);
        setCarrierIdError('');
        setFormErrors({});
        setOpenDialog(true);
        handleActionMenuClose();
    };

    const handleCloseDialog = () => {
        setOpenDialog(false);
        setSelectedCarrier(null);
        setLogoFile(null);
        setLogoPreview('');
        setCarrierIdError('');
        setFormErrors({});
        setSaving(false);
        setIsEditMode(false);
    };

    // Form change handlers
    const handleFormChange = (e) => {
        const { name, value, type, checked } = e.target;
        let newValue = type === 'checkbox' ? checked : value;

        // Always convert carrier ID to uppercase
        if (name === 'carrierID') {
            newValue = newValue.toUpperCase();
        }

        setFormData(prev => ({ ...prev, [name]: newValue }));

        // Clear error for this field
        if (formErrors[name]) {
            setFormErrors(prev => ({ ...prev, [name]: '' }));
        }

        // Check for carrier ID uniqueness when the field changes
        if (name === 'carrierID') {
            checkCarrierIdUniqueness(newValue);
        }
    };

    // Handle nested object changes (for contactInfo, rateStructure, etc.)
    const handleNestedFormChange = (section, field, value) => {
        setFormData(prev => ({
            ...prev,
            [section]: {
                ...prev[section],
                [field]: value
            }
        }));
    };

    // Handle email array changes for manual carriers
    const handleEmailArrayChange = (section, index, value) => {
        setFormData(prev => ({
            ...prev,
            emailConfiguration: {
                ...prev.emailConfiguration,
                [section]: prev.emailConfiguration[section].map((email, i) =>
                    i === index ? value : email
                )
            }
        }));
    };

    const addEmailToArray = (section) => {
        setFormData(prev => ({
            ...prev,
            emailConfiguration: {
                ...prev.emailConfiguration,
                [section]: [...prev.emailConfiguration[section], '']
            }
        }));
    };

    const removeEmailFromArray = (section, index) => {
        setFormData(prev => ({
            ...prev,
            emailConfiguration: {
                ...prev.emailConfiguration,
                [section]: prev.emailConfiguration[section].filter((_, i) => i !== index)
            }
        }));
    };

    const handleEndpointChange = (e) => {
        const { name, value } = e.target;
        setEndpoints(prev => ({ ...prev, [name]: value }));
    };

    // Logo handling
    const handleLogoChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            console.log('Logo file selected:', file.name, file.size);
            console.log('Setting logoFile state to:', file);
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
            setFormData(prev => ({ ...prev, logoFileName: file.name }));
            console.log('Logo file state updated. New logoFile should be:', file.name);
        }
    };

    const handleDropLogo = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) {
            setLogoFile(file);
            setLogoPreview(URL.createObjectURL(file));
            setFormData(prev => ({ ...prev, logoFileName: file.name }));
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    // Validation
    const checkCarrierIdUniqueness = async (carrierId) => {
        if (!carrierId) {
            setCarrierIdError('');
            return;
        }

        try {
            const carriersRef = collection(db, 'carriers');
            // Always check against uppercase since that's how we store it
            const q = query(carriersRef, where('carrierID', '==', carrierId.toUpperCase()));
            const querySnapshot = await getDocs(q);

            const isDuplicate = querySnapshot.docs.some(doc =>
                !selectedCarrier || doc.id !== selectedCarrier.id
            );

            setCarrierIdError(isDuplicate ? 'This Carrier ID is already in use' : '');
        } catch (err) {
            console.error('Error checking carrier ID uniqueness:', err);
        }
    };

    const validateForm = () => {
        const errors = {};

        // Common required fields for both connection types
        if (!formData.name.trim()) errors.name = 'Carrier name is required';
        if (!formData.carrierID.trim()) errors.carrierID = 'Carrier ID is required';
        if (!formData.accountNumber.trim()) errors.accountNumber = 'Account number is required';
        if (!formData.connectionType) errors.connectionType = 'Connection type is required';

        // Connection type specific validation
        if (formData.connectionType === 'api') {
            // API connection requires host URL
            if (!formData.hostURL.trim()) errors.hostURL = 'Host URL is required for API connections';
        } else if (formData.connectionType === 'manual') {
            // Manual connection should have at least one contact method
            if (!formData.contactInfo.phone.trim() && !formData.contactInfo.email.trim()) {
                errors.contactInfo = 'At least one contact method (phone or email) is required for manual connections';
            }
            // Validate email format if provided
            if (formData.contactInfo.email.trim()) {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(formData.contactInfo.email.trim())) {
                    errors.contactEmail = 'Please enter a valid email address';
                }
            }

            // Validate email configuration for manual carriers
            const emailConfig = formData.emailConfiguration;

            // Soluship Notification Emails is required and must have at least one valid email
            const validSolushipEmails = emailConfig.carrierConfirmationEmails.filter(email =>
                email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
            );
            if (validSolushipEmails.length === 0) {
                errors.carrierConfirmationEmails = 'At least one valid Carrier Confirmation Email is required for manual carriers';
            }

            // Validate other email arrays (if they have values, they must be valid)
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

            ['carrierNotificationEmails', 'preArrivalNotificationEmails', 'rateRequestEmails', 'billingEmails'].forEach(section => {
                const emails = emailConfig[section];
                const invalidEmails = emails.filter(email =>
                    email.trim() && !emailRegex.test(email.trim())
                );
                if (invalidEmails.length > 0) {
                    errors[section] = 'Please enter valid email addresses';
                }
            });
        }

        setFormErrors(errors);
        return Object.keys(errors).length === 0 && !carrierIdError;
    };

    // Save carrier
    const handleSaveCarrier = async (e) => {
        e.preventDefault();
        console.log('handleSaveCarrier called. Edit mode:', isEditMode, 'Logo file:', logoFile?.name);
        console.log('Current formData.logoURL:', formData.logoURL);

        if (!validateForm()) {
            showSnackbar('Please fix the errors in the form', 'error');
            return;
        }

        setSaving(true);
        try {
            let logoURL = formData.logoURL;
            console.log('Before upload check - logoFile state:', logoFile);
            console.log('Before upload check - logoFile exists:', !!logoFile);
            console.log('Before upload check - logoFile name:', logoFile?.name);

            // Upload logo to Firebase Storage if a new file is selected
            if (logoFile) {
                try {
                    console.log('Starting logo upload process. File:', logoFile.name, 'Size:', logoFile.size);
                    const { getStorage, ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
                    const { getApp } = await import('firebase/app');

                    const firebaseApp = getApp();
                    const customStorage = getStorage(firebaseApp, "gs://solushipx.firebasestorage.app");
                    const fileExtension = logoFile.name.split('.').pop();
                    const fileName = `carrier-${formData.carrierID.trim().toUpperCase()}-${Date.now()}.${fileExtension}`;
                    const logoRef = ref(customStorage, `carrier-logos/${fileName}`);

                    console.log('Uploading logo to Firebase Storage with filename:', fileName);
                    const snapshot = await uploadBytes(logoRef, logoFile);
                    logoURL = await getDownloadURL(snapshot.ref);
                    console.log('Logo uploaded successfully:', logoURL);
                } catch (uploadError) {
                    console.error('Error uploading logo:', uploadError);
                    showSnackbar('Failed to upload logo. Saving carrier without logo.', 'warning');
                    logoURL = formData.logoURL; // Keep existing URL if upload fails
                }
            } else {
                console.log('No logo file selected, keeping existing URL:', formData.logoURL);
            }

            const carrierData = {
                name: formData.name.trim(),
                carrierID: formData.carrierID.trim().toUpperCase(),
                type: formData.type,
                connectionType: formData.connectionType,
                enabled: formData.enabled,
                logoFileName: formData.logoFileName,
                logoURL: logoURL,
                updatedAt: serverTimestamp(),
            };

            console.log('Prepared carrier data for save:', {
                ...carrierData,
                logoURL: logoURL,
                logoFileName: formData.logoFileName,
                isEditMode: isEditMode,
                selectedCarrierId: selectedCarrier?.id
            });

            // Add connection-specific data
            if (formData.connectionType === 'api') {
                carrierData.apiCredentials = {
                    accountNumber: formData.accountNumber.trim(),
                    hostURL: formData.hostURL.trim(),
                    username: formData.username.trim(),
                    password: formData.password,
                    secret: formData.secret,
                    endpoints: endpoints
                };
            } else if (formData.connectionType === 'manual') {
                // For manual connections, store contact info and manual configuration
                carrierData.accountNumber = formData.accountNumber.trim(); // Store account number at root level for manual
                carrierData.contactInfo = {
                    phone: formData.contactInfo.phone.trim(),
                    email: formData.contactInfo.email.trim(),
                    contactPerson: formData.contactInfo.contactPerson.trim(),
                    preferredContactMethod: formData.contactInfo.preferredContactMethod
                };

                // Clean up email configuration - remove empty emails
                const cleanEmailConfig = {};
                Object.keys(formData.emailConfiguration).forEach(key => {
                    cleanEmailConfig[key] = formData.emailConfiguration[key]
                        .filter(email => email.trim() !== '')
                        .map(email => email.trim());
                });
                carrierData.emailConfiguration = cleanEmailConfig;

                carrierData.services = formData.services;
                carrierData.rateStructure = formData.rateStructure;
            }

            if (!isEditMode) {
                carrierData.createdAt = serverTimestamp();
                carrierData.status = 'active';
            }

            if (isEditMode && selectedCarrier) {
                console.log('Updating carrier document with ID:', selectedCarrier.id);
                console.log('Update data:', carrierData);
                await updateDoc(doc(db, 'carriers', selectedCarrier.id), carrierData);
                console.log('Carrier document updated successfully in Firestore');
                enqueueSnackbar('Carrier updated successfully.', { variant: 'success' });
            } else {
                console.log('Creating new carrier document');
                const docRef = await addDoc(collection(db, 'carriers'), carrierData);
                console.log('New carrier document created with ID:', docRef.id);
                enqueueSnackbar('Carrier created successfully.', { variant: 'success' });
            }

            console.log('Refreshing carriers list...');
            await fetchCarriers();
            console.log('Carriers list refreshed');
            handleCloseDialog();
        } catch (err) {
            console.error('Error saving carrier:', err);
            showSnackbar('Error saving carrier: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleEnabled = async (carrier) => {
        try {
            await updateDoc(doc(db, 'carriers', carrier.id), {
                enabled: !carrier.enabled,
                updatedAt: serverTimestamp()
            });
            // Update local state
            setAllCarriers(prevCarriers => prevCarriers.map(c =>
                c.id === carrier.id ? { ...c, enabled: !carrier.enabled } : c
            ));
            enqueueSnackbar(`Carrier ${carrier.name} has been ${carrier.enabled ? 'disabled' : 'enabled'}.`, { variant: 'success' });
        } catch (err) {
            showSnackbar('Error updating carrier status: ' + err.message, 'error');
        }
    };

    // Soft delete handler
    const handleDeleteCarrier = async (forceDeleteRequested = false) => {
        if (!selectedCarrier) return;

        try {
            if (forceDeleteRequested && forceDelete) {
                // Soft delete - mark as deleted instead of removing
                await updateDoc(doc(db, 'carriers', selectedCarrier.id), {
                    status: 'deleted',
                    deletedAt: serverTimestamp(),
                    enabled: false // Also disable when deleting
                });

                // Remove from local state
                setAllCarriers(prevCarriers => prevCarriers.filter(c => c.id !== selectedCarrier.id));
                enqueueSnackbar(`Carrier ${selectedCarrier.name} has been deleted.`, { variant: 'success' });
            } else {
                // Just disable the carrier
                await updateDoc(doc(db, 'carriers', selectedCarrier.id), {
                    enabled: false,
                    updatedAt: serverTimestamp()
                });

                // Update local state
                setAllCarriers(prevCarriers => prevCarriers.map(c =>
                    c.id === selectedCarrier.id ? { ...c, enabled: false } : c
                ));
                enqueueSnackbar(`Carrier ${selectedCarrier.name} has been disabled instead of deleted.`, { variant: 'success' });
            }
        } catch (error) {
            console.error('Error deleting carrier:', error);
            showSnackbar('Failed to delete carrier: ' + error.message, 'error');
        } finally {
            setOpenDeleteConfirm(false);
            setSelectedCarrier(null);
            setForceDelete(false);
        }
    };

    // Get connection type chip color
    const getConnectionTypeColor = (connectionType) => {
        switch (connectionType) {
            case 'api':
                return { color: '#059669', bgcolor: '#ecfdf5' }; // Green for API
            case 'manual':
                return { color: '#7c3aed', bgcolor: '#f3e8ff' }; // Purple for Manual
            default:
                return { color: '#637381', bgcolor: '#f9fafb' };
        }
    };

    // Get status chip color
    const getStatusColor = (status) => {
        switch (status) {
            case 'active':
                return { color: '#0a875a', bgcolor: '#f1f8f5' };
            case 'inactive':
                return { color: '#dc2626', bgcolor: '#fef2f2' };
            default:
                return { color: '#637381', bgcolor: '#f9fafb' };
        }
    };

    // Get type chip color
    const getTypeColor = (type) => {
        switch (type) {
            case 'courier':
                return { color: '#3b82f6', bgcolor: '#eff6ff' };
            case 'freight':
                return { color: '#f59e0b', bgcolor: '#fffbeb' };
            case 'hybrid':
                return { color: '#8b5cf6', bgcolor: '#f5f3ff' };
            default:
                return { color: '#637381', bgcolor: '#f9fafb' };
        }
    };

    // Render table view
    // NEW: Render quickship carriers table
    const renderQuickshipCarriersView = () => (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
        }}>
            {/* Table Section */}
            <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                <TableContainer sx={{ width: '100%', px: 2 }}>
                    {quickshipLoading ? (
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Carrier</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Company</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Type</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Contact</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Account Number</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Created</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {[...Array(10)].map((_, index) => (
                                    <TableRow key={index}>
                                        <TableCell><Box sx={{ height: '16px', width: '120px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
                                        <TableCell><Box sx={{ height: '16px', width: '100px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
                                        <TableCell><Chip label="Loading" size="small" sx={{ bgcolor: '#e5e7eb', color: 'transparent' }} /></TableCell>
                                        <TableCell><Box sx={{ height: '16px', width: '120px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
                                        <TableCell><Box sx={{ height: '16px', width: '80px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
                                        <TableCell><Box sx={{ height: '16px', width: '90px', bgcolor: '#e5e7eb', borderRadius: '4px' }} /></TableCell>
                                        <TableCell>
                                            <IconButton size="small" disabled>
                                                <MoreVertIcon />
                                            </IconButton>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <Table sx={{ position: 'sticky', top: 0, zIndex: 100 }}>
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Carrier</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Company</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Type</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Contact</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Account Number</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Created</TableCell>
                                    <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Actions</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {quickshipCarriers.map((carrier) => {
                                    // Fix company lookup to handle different ID field combinations
                                    const company = companies.find(c =>
                                        c.id === carrier.companyID ||
                                        c.companyID === carrier.companyID ||
                                        c.id === carrier.companyId ||
                                        c.companyID === carrier.companyId
                                    );

                                    // Debug logging for company lookup
                                    if (!company) {
                                        console.log('🔍 Company not found for carrier:', {
                                            carrierName: carrier.name,
                                            carrierCompanyID: carrier.companyID,
                                            carrierCompanyId: carrier.companyId,
                                            availableCompanies: companies.map(c => ({
                                                id: c.id,
                                                companyID: c.companyID,
                                                companyName: c.companyName
                                            }))
                                        });
                                    }

                                    return (
                                        <TableRow key={carrier.id} hover sx={{ verticalAlign: 'top' }}>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Avatar
                                                        src={carrier.logo && !carrier.logo.startsWith('blob:') ? carrier.logo : null}
                                                        sx={{
                                                            width: 32,
                                                            height: 32,
                                                            bgcolor: '#e5e7eb',
                                                            border: '1px solid #e5e7eb'
                                                        }}
                                                    >
                                                        <CarrierIcon sx={{ fontSize: '14px', color: '#6b7280' }} />
                                                    </Avatar>
                                                    <Box>
                                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                            {carrier.name}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                            {carrier.contactName || 'No contact name'}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Avatar
                                                        src={company?.logoUrl || company?.logoURL || company?.companyLogo || company?.logo || company?.companyLogoURL}
                                                        sx={{
                                                            width: 32,
                                                            height: 32,
                                                            fontSize: '12px',
                                                            border: '1px solid #e5e7eb'
                                                        }}
                                                    >
                                                        {(company?.companyName || company?.name || company?.companyname || company?.company_name || company?.companyDisplayName || company?.displayName)?.[0]?.toUpperCase() || 'C'}
                                                    </Avatar>
                                                    <Box>
                                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                            {company?.companyName || company?.name || company?.companyname || company?.company_name || company?.companyDisplayName || company?.displayName || 'Unknown Company'}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
                                                            {carrier.companyID || carrier.companyId || 'N/A'}
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={carrier.type || 'freight'}
                                                    size="small"
                                                    sx={{
                                                        backgroundColor: getTypeColor(carrier.type || 'freight').bgcolor,
                                                        color: getTypeColor(carrier.type || 'freight').color,
                                                        fontSize: '11px',
                                                        fontWeight: 500,
                                                        '& .MuiChip-label': { px: 1.5 }
                                                    }}
                                                />
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
                                                    {!carrier.contactEmail && !carrier.contactPhone && (
                                                        <Typography sx={{ fontSize: '11px', color: '#9ca3af' }}>
                                                            No contact info
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
                                                    onClick={(e) => handleQuickshipActionMenuOpen(e, carrier)}
                                                >
                                                    <MoreVertIcon sx={{ fontSize: '16px' }} />
                                                </IconButton>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {quickshipCarriers.length === 0 && !quickshipLoading && (
                                    <TableRow>
                                        <TableCell colSpan={7} align="center">
                                            <Box sx={{ py: 4 }}>
                                                <CarrierIcon sx={{ fontSize: '48px', color: '#d1d5db', mb: 2 }} />
                                                <Typography sx={{ fontSize: '14px', color: '#6b7280', mb: 1 }}>
                                                    No quickship carriers found
                                                </Typography>
                                                <Typography sx={{ fontSize: '12px', color: '#9ca3af' }}>
                                                    {selectedCompany === 'all'
                                                        ? 'Try adjusting your search criteria or create a new carrier'
                                                        : 'No carriers found for the selected company'
                                                    }
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </TableContainer>
            </Box>

            {/* Pagination Section */}
            <Box sx={{ flexShrink: 0 }}>
                <CarriersPagination
                    totalCount={quickshipTotalCount}
                    currentPage={quickshipPage}
                    rowsPerPage={quickshipRowsPerPage}
                    onPageChange={setQuickshipPage}
                    onRowsPerPageChange={setQuickshipRowsPerPage}
                />
            </Box>
        </Box>
    );

    const renderTableView = () => (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
        }}>
            {/* Header Section */}
            <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                {/* Title and Main Tabs Row */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827', mb: 2 }}>
                            Carriers
                        </Typography>
                        {/* Breadcrumb */}
                        {!isModal && (
                            <AdminBreadcrumb />
                        )}
                    </Box>
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={
                            mainTab === 0 ? handleOpenAddCarrier :
                                mainTab === 1 ? handleAddQuickshipCarrier :
                                    handleAddEligibilityRule
                        }
                        disabled={mainTab === 1 && (selectedCompany === 'all' || !selectedCompany)}
                        sx={{ fontSize: '12px' }}
                    >
                        {mainTab === 0 ? 'Add Connected Carrier' :
                            mainTab === 1 ? 'Add Quickship Carrier' :
                                'Add Eligibility Rule'}
                    </Button>
                </Box>

                {/* Main Tabs - NEW: Two-tab system */}
                <Box sx={{ borderBottom: '1px solid #e5e7eb', mb: 2 }}>
                    <Tabs
                        value={mainTab}
                        onChange={handleMainTabChange}
                        sx={{
                            '& .MuiTab-root': {
                                fontSize: '14px',
                                minHeight: '40px',
                                textTransform: 'none',
                                fontWeight: 600,
                                padding: '8px 16px'
                            }
                        }}
                    >
                        <Tab
                            label="Connected Carriers"
                            value={0}
                        />
                        <Tab
                            label="Quickship Carriers"
                            value={1}
                        />
                        <Tab
                            label="Carrier Eligibility"
                            value={2}
                        />
                    </Tabs>
                </Box>

                {/* Connected Carriers Sub-tabs and Filters Row - Only show when on Connected Carriers tab */}
                {mainTab === 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Tabs
                            value={selectedTab}
                            onChange={handleTabChange}
                            sx={{
                                '& .MuiTab-root': {
                                    fontSize: '11px',
                                    minHeight: '36px',
                                    textTransform: 'none',
                                    fontWeight: 500,
                                    padding: '6px 12px'
                                }
                            }}
                        >
                            <Tab label={`All (${stats.total})`} value="all" />
                            <Tab label={`Enabled (${stats.enabled})`} value="enabled" />
                            <Tab label={`Disabled (${stats.disabled})`} value="disabled" />
                            <Tab label={`Courier (${stats.courier})`} value="courier" />
                            <Tab label={`Freight (${stats.freight})`} value="freight" />
                            <Tab label={`Hybrid (${stats.hybrid})`} value="hybrid" />
                        </Tabs>

                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<FilterListIcon />}
                            onClick={() => setFiltersOpen(!filtersOpen)}
                            sx={{ fontSize: '12px' }}
                        >
                            Filters
                        </Button>
                    </Box>
                )}

                {/* Connected Carriers Filters Panel - Only show when on Connected Carriers tab */}
                {mainTab === 0 && (
                    <Collapse in={filtersOpen}>
                        <Paper sx={{ mt: 2, p: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                            <Grid container spacing={2}>
                                <Grid item xs={12} sm={4}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        placeholder="Search carrier name..."
                                        value={searchFields.carrierName}
                                        onChange={(e) => setSearchFields(prev => ({ ...prev, carrierName: e.target.value }))}
                                        InputProps={{
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <SearchIcon sx={{ fontSize: '16px' }} />
                                                </InputAdornment>
                                            ),
                                            sx: { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        placeholder="Search carrier ID..."
                                        value={searchFields.carrierId}
                                        onChange={(e) => setSearchFields(prev => ({ ...prev, carrierId: e.target.value }))}
                                        InputProps={{
                                            sx: { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} sm={4}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        placeholder="Search account number..."
                                        value={searchFields.accountNumber}
                                        onChange={(e) => setSearchFields(prev => ({ ...prev, accountNumber: e.target.value }))}
                                        InputProps={{
                                            sx: { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                            </Grid>
                            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<CloseIcon />}
                                    onClick={() => {
                                        setSearchFields({ carrierName: '', carrierId: '', accountNumber: '' });
                                        setFilters({ status: 'all', type: 'all', enabled: 'all' });
                                    }}
                                    sx={{ fontSize: '12px' }}
                                >
                                    Clear Filters
                                </Button>
                            </Box>
                        </Paper>
                    </Collapse>
                )}
            </Box>

            {/* Content Section - Show different content based on main tab */}
            <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                {mainTab === 0 ? (
                    // Connected Carriers Content
                    <>
                        <Box sx={{ width: '100%', px: 2 }}>
                            {loading ? (
                                <CarriersTableSkeleton />
                            ) : (
                                <Table sx={{ position: 'sticky', top: 0, zIndex: 100 }}>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Carrier</TableCell>
                                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Carrier ID</TableCell>
                                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Type</TableCell>
                                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Connection</TableCell>
                                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Status</TableCell>
                                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Account Number</TableCell>
                                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Created</TableCell>
                                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {carriers.map((carrier) => (
                                            <TableRow key={carrier.id} hover sx={{ verticalAlign: 'top' }}>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Avatar
                                                            src={carrier.logoURL}
                                                            sx={{ width: 28, height: 28, bgcolor: '#e5e7eb' }}
                                                        >
                                                            <CarrierIcon sx={{ fontSize: '14px', color: '#6b7280' }} />
                                                        </Avatar>
                                                        <Box>
                                                            <Typography
                                                                sx={{
                                                                    fontSize: '12px',
                                                                    fontWeight: 500,
                                                                    color: '#1976d2',
                                                                    cursor: 'pointer',
                                                                    textDecoration: 'none',
                                                                    '&:hover': {
                                                                        color: '#1565c0',
                                                                        textDecoration: 'none'
                                                                    }
                                                                }}
                                                                onClick={() => handleViewCarrier(carrier.id)}
                                                            >
                                                                {carrier.name}
                                                            </Typography>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                                                <Switch
                                                                    checked={carrier.enabled}
                                                                    onChange={() => handleToggleEnabled(carrier)}
                                                                    size="small"
                                                                />
                                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                    {carrier.enabled ? 'Enabled' : 'Disabled'}
                                                                </Typography>
                                                            </Box>
                                                        </Box>
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                        <Typography sx={{ fontSize: '12px', fontFamily: 'monospace' }}>
                                                            {carrier.carrierID}
                                                        </Typography>
                                                        <Tooltip title="Copy Carrier ID">
                                                            <IconButton
                                                                size="small"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleCopyToClipboard(carrier.carrierID, 'Carrier ID');
                                                                }}
                                                            >
                                                                <ContentCopyIcon sx={{ fontSize: '14px' }} />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={carrier.type}
                                                        size="small"
                                                        sx={{
                                                            backgroundColor: getTypeColor(carrier.type).bgcolor,
                                                            color: getTypeColor(carrier.type).color,
                                                            fontWeight: 500,
                                                            fontSize: '11px',
                                                            '& .MuiChip-label': { px: 1.5 }
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={carrier.connectionType}
                                                        size="small"
                                                        sx={{
                                                            backgroundColor: getConnectionTypeColor(carrier.connectionType).bgcolor,
                                                            color: getConnectionTypeColor(carrier.connectionType).color,
                                                            fontWeight: 500,
                                                            fontSize: '11px',
                                                            '& .MuiChip-label': { px: 1.5 }
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={carrier.status || 'active'}
                                                        size="small"
                                                        sx={{
                                                            backgroundColor: getStatusColor(carrier.status || 'active').bgcolor,
                                                            color: getStatusColor(carrier.status || 'active').color,
                                                            fontWeight: 500,
                                                            fontSize: '11px',
                                                            '& .MuiChip-label': { px: 1.5 }
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Typography sx={{ fontSize: '12px' }}>
                                                        {carrier.apiCredentials?.accountNumber || carrier.accountNumber || 'N/A'}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Typography sx={{ fontSize: '12px' }}>
                                                        {new Date(carrier.createdAt?.toDate?.() || carrier.createdAt).toLocaleDateString()}
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
                                        {carriers.length === 0 && !loading && (
                                            <TableRow>
                                                <TableCell colSpan={8} align="center">
                                                    <Box sx={{ py: 4 }}>
                                                        <CarrierIcon sx={{ fontSize: '48px', color: '#d1d5db', mb: 2 }} />
                                                        <Typography sx={{ fontSize: '14px', color: '#6b7280', mb: 1 }}>
                                                            No carriers found
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '12px', color: '#9ca3af' }}>
                                                            Try adjusting your search criteria or create a new carrier
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            )}
                        </Box>

                        {/* Connected Carriers Pagination */}
                        <Box sx={{ flexShrink: 0 }}>
                            <CarriersPagination
                                totalCount={totalCount}
                                currentPage={page}
                                rowsPerPage={rowsPerPage}
                                onPageChange={setPage}
                                onRowsPerPageChange={setRowsPerPage}
                            />
                        </Box>
                    </>
                ) : (
                    // Quickship Carriers Content
                    renderQuickshipCarriersView()
                )}
            </Box>

            {/* Pagination Section - Only for Connected Carriers */}
            {mainTab === 0 && (
                <Box sx={{ flexShrink: 0 }}>
                    <CarriersPagination
                        totalCount={totalCount}
                        currentPage={page}
                        rowsPerPage={rowsPerPage}
                        onPageChange={setPage}
                        onRowsPerPageChange={setRowsPerPage}
                    />
                </Box>
            )}
        </Box>
    );

    // Main render
    return (
        <Box sx={{
            backgroundColor: 'transparent',
            width: '100%',
            height: '100%'
        }}>
            {/* Modal Header */}
            {isModal && (
                <ModalHeader
                    title="Carriers"
                    onClose={onClose}
                    showBackButton={false}
                    showCloseButton={showCloseButton}
                />
            )}

            {/* Main Content */}
            <Box sx={{
                width: '100%',
                height: isModal ? 'calc(100% - 64px)' : '100%',
                overflow: 'hidden',
                position: 'relative'
            }}>
                {/* Always show the main structure with tabs header */}
                <Box sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%'
                }}>
                    {/* Header Section with Tabs - ALWAYS VISIBLE */}
                    <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                        {/* Title Row */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <Box>
                                <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827', mb: 2 }}>
                                    Carriers
                                </Typography>
                                {/* Breadcrumb */}
                                {!isModal && (
                                    <AdminBreadcrumb />
                                )}
                            </Box>
                            <Button
                                variant="contained"
                                size="small"
                                startIcon={<AddIcon />}
                                onClick={mainTab === 0 ? handleOpenAddCarrier : handleAddQuickshipCarrier}
                                disabled={mainTab === 1 && (selectedCompany === 'all' || !selectedCompany)}
                                sx={{ fontSize: '12px' }}
                            >
                                {mainTab === 0 ? 'Add Connected Carrier' : 'Add Quickship Carrier'}
                            </Button>
                        </Box>

                        {/* Main Tabs - ALWAYS VISIBLE */}
                        <Box sx={{ borderBottom: '1px solid #e5e7eb', mb: 2 }}>
                            <Tabs
                                value={mainTab}
                                onChange={handleMainTabChange}
                                sx={{
                                    '& .MuiTab-root': {
                                        fontSize: '14px',
                                        minHeight: '40px',
                                        textTransform: 'none',
                                        fontWeight: 600,
                                        padding: '8px 16px'
                                    }
                                }}
                            >
                                <Tab
                                    label="Connected Carriers"
                                    value={0}
                                />
                                <Tab
                                    label="Quickship Carriers"
                                    value={1}
                                />
                            </Tabs>
                        </Box>

                        {/* Connected Carriers Sub-tabs and Filters Row - Only show when on Connected Carriers tab */}
                        {mainTab === 0 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Tabs
                                    value={selectedTab}
                                    onChange={handleTabChange}
                                    sx={{
                                        '& .MuiTab-root': {
                                            fontSize: '11px',
                                            minHeight: '36px',
                                            textTransform: 'none',
                                            fontWeight: 500,
                                            padding: '6px 12px'
                                        }
                                    }}
                                >
                                    <Tab label={`All (${stats.total})`} value="all" />
                                    <Tab label={`Enabled (${stats.enabled})`} value="enabled" />
                                    <Tab label={`Disabled (${stats.disabled})`} value="disabled" />
                                    <Tab label={`Courier (${stats.courier})`} value="courier" />
                                    <Tab label={`Freight (${stats.freight})`} value="freight" />
                                    <Tab label={`Hybrid (${stats.hybrid})`} value="hybrid" />
                                </Tabs>

                                <Button
                                    variant="outlined"
                                    size="small"
                                    startIcon={<FilterListIcon />}
                                    onClick={() => setFiltersOpen(!filtersOpen)}
                                    sx={{ fontSize: '12px' }}
                                >
                                    Filters
                                </Button>
                            </Box>
                        )}

                        {/* Quickship Carriers Company Filter Row - Only show when on Quickship Carriers tab */}
                        {mainTab === 1 && (
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <FormControl size="small" sx={{ minWidth: 200 }}>
                                    <InputLabel sx={{ fontSize: '12px' }}>Filter by Company</InputLabel>
                                    <Select
                                        value={selectedCompany}
                                        onChange={handleCompanyChange}
                                        label="Filter by Company"
                                        sx={{ fontSize: '12px' }}
                                    >
                                        {/* Only show "All Companies" option for super admins */}
                                        {userRole === 'superadmin' && (
                                            <MenuItem value="all" sx={{ fontSize: '12px' }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                                                    <Avatar sx={{ width: 32, height: 32, bgcolor: '#8b5cf6' }}>
                                                        <BusinessIcon sx={{ fontSize: '16px', color: 'white' }} />
                                                    </Avatar>
                                                    <Box sx={{ flex: 1 }}>
                                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                            All Companies
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                            View carriers across all companies
                                                        </Typography>
                                                    </Box>
                                                    <Chip
                                                        label={allQuickshipCarriers.length}
                                                        size="small"
                                                        sx={{ bgcolor: '#8b5cf6', color: 'white', fontSize: '10px', minWidth: '24px' }}
                                                    />
                                                </Box>
                                            </MenuItem>
                                        )}
                                        {companies.map((company) => {
                                            const carrierCount = allQuickshipCarriers.filter(c => c.companyID === company.id || c.companyID === company.companyID).length;
                                            return (
                                                <MenuItem key={company.id} value={company.companyID || company.id} sx={{ fontSize: '12px', py: 1 }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                                                        <Avatar
                                                            src={company.logoUrl || company.logoURL || company.companyLogo || company.logo || company.companyLogoURL}
                                                            sx={{
                                                                width: 32,
                                                                height: 32,
                                                                fontSize: '12px',
                                                                border: '1px solid #e5e7eb'
                                                            }}
                                                        >
                                                            {(company.companyName || company.name || company.companyname || company.company_name || company.companyDisplayName || company.displayName)?.[0]?.toUpperCase() || 'C'}
                                                        </Avatar>
                                                        <Box sx={{ flex: 1 }}>
                                                            <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                {company.companyName || company.name || company.companyname || company.company_name || company.companyDisplayName || company.displayName}
                                                            </Typography>
                                                            <Typography sx={{ fontSize: '11px', color: '#6b7280', fontFamily: 'monospace' }}>
                                                                {company.companyID || company.id}
                                                            </Typography>
                                                        </Box>
                                                        <Chip
                                                            label={carrierCount}
                                                            size="small"
                                                            sx={{ bgcolor: '#f3f4f6', color: '#374151', fontSize: '10px', minWidth: '24px' }}
                                                        />
                                                    </Box>
                                                </MenuItem>
                                            );
                                        })}
                                    </Select>
                                </FormControl>

                                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                    {quickshipTotalCount} carriers found
                                </Typography>
                            </Box>
                        )}

                        {/* Connected Carriers Filters Panel */}
                        {mainTab === 0 && (
                            <Collapse in={filtersOpen}>
                                <Paper sx={{ mt: 2, p: 2, bgcolor: '#f8fafc', border: '1px solid #e5e7eb' }}>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={4}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                placeholder="Search carrier name..."
                                                value={searchFields.carrierName}
                                                onChange={(e) => setSearchFields(prev => ({ ...prev, carrierName: e.target.value }))}
                                                InputProps={{
                                                    startAdornment: (
                                                        <InputAdornment position="start">
                                                            <SearchIcon sx={{ fontSize: '16px' }} />
                                                        </InputAdornment>
                                                    ),
                                                    sx: { fontSize: '12px' }
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                placeholder="Search carrier ID..."
                                                value={searchFields.carrierId}
                                                onChange={(e) => setSearchFields(prev => ({ ...prev, carrierId: e.target.value }))}
                                                InputProps={{
                                                    sx: { fontSize: '12px' }
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={4}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                placeholder="Search account number..."
                                                value={searchFields.accountNumber}
                                                onChange={(e) => setSearchFields(prev => ({ ...prev, accountNumber: e.target.value }))}
                                                InputProps={{
                                                    sx: { fontSize: '12px' }
                                                }}
                                            />
                                        </Grid>
                                    </Grid>
                                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            startIcon={<CloseIcon />}
                                            onClick={() => {
                                                setSearchFields({ carrierName: '', carrierId: '', accountNumber: '' });
                                                setFilters({ status: 'all', type: 'all', enabled: 'all' });
                                            }}
                                            sx={{ fontSize: '12px' }}
                                        >
                                            Clear Filters
                                        </Button>
                                    </Box>
                                </Paper>
                            </Collapse>
                        )}
                    </Box>

                    {/* Content Section - Show different content based on main tab */}
                    <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                        {mainTab === 0 ? (
                            // Connected Carriers Content
                            <Box sx={{ width: '100%', px: 2 }}>
                                {loading ? (
                                    <CarriersTableSkeleton />
                                ) : (
                                    <Table sx={{ position: 'sticky', top: 0, zIndex: 100 }}>
                                        <TableHead>
                                            <TableRow>
                                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Carrier</TableCell>
                                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Carrier ID</TableCell>
                                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Type</TableCell>
                                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Connection</TableCell>
                                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Status</TableCell>
                                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Account Number</TableCell>
                                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Created</TableCell>
                                                <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Actions</TableCell>
                                            </TableRow>
                                        </TableHead>
                                        <TableBody>
                                            {carriers.map((carrier) => (
                                                <TableRow key={carrier.id} hover sx={{ verticalAlign: 'top' }}>
                                                    <TableCell>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <Avatar
                                                                src={carrier.logoURL}
                                                                sx={{ width: 28, height: 28, bgcolor: '#e5e7eb' }}
                                                            >
                                                                <CarrierIcon sx={{ fontSize: '14px', color: '#6b7280' }} />
                                                            </Avatar>
                                                            <Box>
                                                                <Typography
                                                                    sx={{
                                                                        fontSize: '12px',
                                                                        fontWeight: 500,
                                                                        color: '#1976d2',
                                                                        cursor: 'pointer',
                                                                        textDecoration: 'none',
                                                                        '&:hover': {
                                                                            color: '#1565c0',
                                                                            textDecoration: 'none'
                                                                        }
                                                                    }}
                                                                    onClick={() => handleViewCarrier(carrier.id)}
                                                                >
                                                                    {carrier.name}
                                                                </Typography>
                                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                                                                    <Switch
                                                                        checked={carrier.enabled}
                                                                        onChange={() => handleToggleEnabled(carrier)}
                                                                        size="small"
                                                                    />
                                                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                        {carrier.enabled ? 'Enabled' : 'Disabled'}
                                                                    </Typography>
                                                                </Box>
                                                            </Box>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <Typography sx={{ fontSize: '12px', fontFamily: 'monospace' }}>
                                                                {carrier.carrierID}
                                                            </Typography>
                                                            <Tooltip title="Copy Carrier ID">
                                                                <IconButton
                                                                    size="small"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleCopyToClipboard(carrier.carrierID, 'Carrier ID');
                                                                    }}
                                                                >
                                                                    <ContentCopyIcon sx={{ fontSize: '14px' }} />
                                                                </IconButton>
                                                            </Tooltip>
                                                        </Box>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={carrier.type}
                                                            size="small"
                                                            sx={{
                                                                backgroundColor: getTypeColor(carrier.type).bgcolor,
                                                                color: getTypeColor(carrier.type).color,
                                                                fontWeight: 500,
                                                                fontSize: '11px',
                                                                '& .MuiChip-label': { px: 1.5 }
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={carrier.connectionType}
                                                            size="small"
                                                            sx={{
                                                                backgroundColor: getConnectionTypeColor(carrier.connectionType).bgcolor,
                                                                color: getConnectionTypeColor(carrier.connectionType).color,
                                                                fontWeight: 500,
                                                                fontSize: '11px',
                                                                '& .MuiChip-label': { px: 1.5 }
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            label={carrier.status || 'active'}
                                                            size="small"
                                                            sx={{
                                                                backgroundColor: getStatusColor(carrier.status || 'active').bgcolor,
                                                                color: getStatusColor(carrier.status || 'active').color,
                                                                fontWeight: 500,
                                                                fontSize: '11px',
                                                                '& .MuiChip-label': { px: 1.5 }
                                                            }}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography sx={{ fontSize: '12px' }}>
                                                            {carrier.apiCredentials?.accountNumber || carrier.accountNumber || 'N/A'}
                                                        </Typography>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Typography sx={{ fontSize: '12px' }}>
                                                            {new Date(carrier.createdAt?.toDate?.() || carrier.createdAt).toLocaleDateString()}
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
                                            {carriers.length === 0 && !loading && (
                                                <TableRow>
                                                    <TableCell colSpan={8} align="center">
                                                        <Box sx={{ py: 4 }}>
                                                            <CarrierIcon sx={{ fontSize: '48px', color: '#d1d5db', mb: 2 }} />
                                                            <Typography sx={{ fontSize: '14px', color: '#6b7280', mb: 1 }}>
                                                                No carriers found
                                                            </Typography>
                                                            <Typography sx={{ fontSize: '12px', color: '#9ca3af' }}>
                                                                Try adjusting your search criteria or create a new carrier
                                                            </Typography>
                                                        </Box>
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                )}
                            </Box>
                        ) : (
                            // Quickship Carriers Content
                            renderQuickshipCarriersView()
                        )}
                    </Box>

                    {/* Pagination Section - Only for Connected Carriers */}
                    {mainTab === 0 && (
                        <Box sx={{ flexShrink: 0 }}>
                            <CarriersPagination
                                totalCount={totalCount}
                                currentPage={page}
                                rowsPerPage={rowsPerPage}
                                onPageChange={setPage}
                                onRowsPerPageChange={setRowsPerPage}
                            />
                        </Box>
                    )}
                </Box>
            </Box>

            {/* Comprehensive Carrier Form Dialog */}
            <Dialog
                open={openDialog}
                onClose={handleCloseDialog}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: {
                        maxHeight: '90vh',
                        height: 'auto',
                        m: 2
                    }
                }}
            >
                <DialogTitle sx={{
                    fontSize: '18px',
                    fontWeight: 600,
                    color: '#111827',
                    borderBottom: '1px solid #e5e7eb',
                    pb: 2,
                    position: 'sticky',
                    top: 0,
                    zIndex: 1000,
                    backgroundColor: '#ffffff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <Typography sx={{ fontSize: '18px', fontWeight: 600, color: '#111827' }}>
                        {isEditMode ? 'Edit Carrier' : 'Add New Carrier'}
                    </Typography>
                    <IconButton
                        onClick={handleCloseDialog}
                        size="small"
                        sx={{
                            color: '#6b7280',
                            '&:hover': {
                                color: '#374151',
                                backgroundColor: '#f3f4f6'
                            }
                        }}
                    >
                        <CloseIcon sx={{ fontSize: '20px' }} />
                    </IconButton>
                </DialogTitle>

                <form onSubmit={handleSaveCarrier}>
                    <DialogContent sx={{ p: 3 }}>
                        <Grid container spacing={3}>
                            {/* Basic Information Section */}
                            <Grid item xs={12}>
                                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 2, color: '#374151' }}>
                                    Basic Information
                                </Typography>
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Carrier Name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleFormChange}
                                    required
                                    error={!!formErrors.name}
                                    helperText={formErrors.name}
                                    size="small"
                                    InputProps={{ sx: { fontSize: '12px' } }}
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Carrier ID"
                                    name="carrierID"
                                    value={formData.carrierID}
                                    onChange={handleFormChange}
                                    required
                                    error={!!formErrors.carrierID || !!carrierIdError}
                                    helperText={formErrors.carrierID || carrierIdError}
                                    size="small"
                                    InputProps={{
                                        sx: {
                                            fontSize: '12px',
                                            '& input': {
                                                textTransform: 'uppercase'
                                            }
                                        }
                                    }}
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Account Number"
                                    name="accountNumber"
                                    value={formData.accountNumber}
                                    onChange={handleFormChange}
                                    required
                                    error={!!formErrors.accountNumber}
                                    helperText={formErrors.accountNumber}
                                    size="small"
                                    InputProps={{ sx: { fontSize: '12px' } }}
                                    InputLabelProps={{ sx: { fontSize: '12px' } }}
                                />
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth size="small" required>
                                    <InputLabel sx={{ fontSize: '12px' }}>Type</InputLabel>
                                    <Select
                                        name="type"
                                        value={formData.type}
                                        label="Type"
                                        onChange={handleFormChange}
                                        sx={{ fontSize: '12px' }}
                                    >
                                        {carrierTypes.map(opt => (
                                            <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '12px' }}>
                                                {opt.label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            <Grid item xs={12} sm={6}>
                                <FormControl fullWidth size="small" required>
                                    <InputLabel sx={{ fontSize: '12px' }}>Connection Type</InputLabel>
                                    <Select
                                        name="connectionType"
                                        value={formData.connectionType}
                                        label="Connection Type"
                                        onChange={handleFormChange}
                                        sx={{ fontSize: '12px' }}
                                    >
                                        {connectionTypes.map(opt => (
                                            <MenuItem key={opt.value} value={opt.value} sx={{ fontSize: '12px' }}>
                                                {opt.label}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>

                            {/* Logo Upload Section */}
                            <Grid item xs={12}>
                                <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 2, mt: 2, color: '#374151' }}>
                                    Carrier Logo
                                </Typography>
                                <Box
                                    sx={{
                                        border: '2px dashed #d1d5db',
                                        borderRadius: 2,
                                        p: 3,
                                        textAlign: 'center',
                                        cursor: 'pointer',
                                        bgcolor: '#f8fafc',
                                        transition: 'all 0.2s',
                                        '&:hover': {
                                            borderColor: '#3b82f6',
                                            bgcolor: '#eff6ff'
                                        }
                                    }}
                                    onDrop={handleDropLogo}
                                    onDragOver={handleDragOver}
                                    onClick={() => document.getElementById('carrier-logo-upload').click()}
                                >
                                    <input
                                        id="carrier-logo-upload"
                                        type="file"
                                        accept="image/*"
                                        style={{ display: 'none' }}
                                        onChange={handleLogoChange}
                                    />
                                    {logoPreview ? (
                                        <Box>
                                            <img
                                                src={logoPreview}
                                                alt="Logo Preview"
                                                style={{
                                                    maxHeight: 80,
                                                    maxWidth: 200,
                                                    marginBottom: 12,
                                                    borderRadius: 4
                                                }}
                                            />
                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                Click to change logo
                                            </Typography>
                                        </Box>
                                    ) : (
                                        <Box>
                                            <CloudUploadIcon sx={{ fontSize: 40, color: '#6b7280', mb: 1 }} />
                                            <Typography variant="body2" sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                Drag & drop or click to upload carrier logo
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#9ca3af', mt: 1 }}>
                                                PNG, JPG up to 2MB
                                            </Typography>
                                        </Box>
                                    )}
                                </Box>
                            </Grid>

                            {/* Conditional Configuration Section Based on Connection Type */}
                            {formData.connectionType === 'api' ? (
                                // API Configuration Section
                                <>
                                    <Grid item xs={12}>
                                        <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 2, mt: 2, color: '#374151' }}>
                                            API Configuration
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', mb: 2 }}>
                                            Configure API settings for automatic rate fetching and booking
                                        </Typography>
                                    </Grid>

                                    <Grid item xs={12}>
                                        <TextField
                                            fullWidth
                                            label="Host URL"
                                            name="hostURL"
                                            value={formData.hostURL}
                                            onChange={handleFormChange}
                                            required
                                            error={!!formErrors.hostURL}
                                            helperText={formErrors.hostURL}
                                            size="small"
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            placeholder="https://api.carrier.com"
                                        />
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            fullWidth
                                            label="Username"
                                            name="username"
                                            value={formData.username}
                                            onChange={handleFormChange}
                                            size="small"
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                        />
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            fullWidth
                                            label="Password"
                                            name="password"
                                            type="password"
                                            value={formData.password}
                                            onChange={handleFormChange}
                                            size="small"
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                        />
                                    </Grid>

                                    <Grid item xs={12}>
                                        <TextField
                                            fullWidth
                                            label="API Secret / Token"
                                            name="secret"
                                            value={formData.secret}
                                            onChange={handleFormChange}
                                            size="small"
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                        />
                                    </Grid>

                                    {/* API Endpoints Section */}
                                    <Grid item xs={12}>
                                        <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 2, mt: 2, color: '#374151' }}>
                                            API Endpoints
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', mb: 3 }}>
                                            Configure specific endpoint paths (will be appended to Host URL)
                                        </Typography>
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            fullWidth
                                            label="Rate Endpoint"
                                            name="rate"
                                            value={endpoints.rate}
                                            onChange={handleEndpointChange}
                                            size="small"
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            placeholder="/api/rates"
                                        />
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            fullWidth
                                            label="Booking Endpoint"
                                            name="booking"
                                            value={endpoints.booking}
                                            onChange={handleEndpointChange}
                                            size="small"
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            placeholder="/api/book"
                                        />
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            fullWidth
                                            label="Tracking Endpoint"
                                            name="tracking"
                                            value={endpoints.tracking}
                                            onChange={handleEndpointChange}
                                            size="small"
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            placeholder="/api/track"
                                        />
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            fullWidth
                                            label="Cancel Endpoint"
                                            name="cancel"
                                            value={endpoints.cancel}
                                            onChange={handleEndpointChange}
                                            size="small"
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            placeholder="/api/cancel"
                                        />
                                    </Grid>

                                    <Grid item xs={12} sm={6} sx={{ mb: 2 }}>
                                        <TextField
                                            fullWidth
                                            label="Labels Endpoint"
                                            name="labels"
                                            value={endpoints.labels}
                                            onChange={handleEndpointChange}
                                            size="small"
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            placeholder="/api/labels"
                                        />
                                    </Grid>

                                    <Grid item xs={12} sm={6} sx={{ mb: 2 }}>
                                        <TextField
                                            fullWidth
                                            label="Status Endpoint"
                                            name="status"
                                            value={endpoints.status}
                                            onChange={handleEndpointChange}
                                            size="small"
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            placeholder="/api/status"
                                        />
                                    </Grid>
                                </>
                            ) : (
                                // Manual Configuration Section
                                <>
                                    <Grid item xs={12}>
                                        <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 2, mt: 2, color: '#374151' }}>
                                            Manual Connection Configuration
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', mb: 2 }}>
                                            Configure contact information and manual rate settings
                                        </Typography>
                                    </Grid>

                                    {/* Contact Information Section */}
                                    <Grid item xs={12}>
                                        <Typography variant="h6" sx={{ fontSize: '13px', fontWeight: 500, mb: 2, color: '#4b5563' }}>
                                            Contact Information
                                        </Typography>
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            fullWidth
                                            label="Contact Person"
                                            value={formData.contactInfo.contactPerson}
                                            onChange={(e) => handleNestedFormChange('contactInfo', 'contactPerson', e.target.value)}
                                            size="small"
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                        />
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            fullWidth
                                            label="Contact Phone"
                                            value={formData.contactInfo.phone}
                                            onChange={(e) => handleNestedFormChange('contactInfo', 'phone', e.target.value)}
                                            size="small"
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            placeholder="+1 (555) 123-4567"
                                        />
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <TextField
                                            fullWidth
                                            label="Contact Email"
                                            type="email"
                                            value={formData.contactInfo.email}
                                            onChange={(e) => handleNestedFormChange('contactInfo', 'email', e.target.value)}
                                            size="small"
                                            InputProps={{ sx: { fontSize: '12px' } }}
                                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                                            placeholder="rates@carrier.com"
                                        />
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel sx={{ fontSize: '12px' }}>Preferred Contact Method</InputLabel>
                                            <Select
                                                value={formData.contactInfo.preferredContactMethod}
                                                label="Preferred Contact Method"
                                                onChange={(e) => handleNestedFormChange('contactInfo', 'preferredContactMethod', e.target.value)}
                                                sx={{ fontSize: '12px' }}
                                            >
                                                <MenuItem value="email" sx={{ fontSize: '12px' }}>Email</MenuItem>
                                                <MenuItem value="phone" sx={{ fontSize: '12px' }}>Phone</MenuItem>
                                                <MenuItem value="both" sx={{ fontSize: '12px' }}>Both</MenuItem>
                                            </Select>
                                        </FormControl>
                                    </Grid>

                                    {/* Services & Rates Section - Placeholder */}
                                    <Grid item xs={12}>
                                        <Typography variant="h6" sx={{ fontSize: '13px', fontWeight: 500, mb: 2, mt: 2, color: '#4b5563' }}>
                                            Email Configuration
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', mb: 2 }}>
                                            Configure email addresses for different types of notifications and communications
                                        </Typography>
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <EmailArrayField
                                            label="Carrier Confirmation Emails"
                                            required={true}
                                            emails={formData.emailConfiguration.carrierConfirmationEmails}
                                            section="carrierConfirmationEmails"
                                            error={formErrors.carrierConfirmationEmails}
                                            onEmailChange={handleEmailArrayChange}
                                            onAddEmail={addEmailToArray}
                                            onRemoveEmail={removeEmailFromArray}
                                        />
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <EmailArrayField
                                            label="Carrier Notification Emails"
                                            emails={formData.emailConfiguration.carrierNotificationEmails}
                                            section="carrierNotificationEmails"
                                            error={formErrors.carrierNotificationEmails}
                                            onEmailChange={handleEmailArrayChange}
                                            onAddEmail={addEmailToArray}
                                            onRemoveEmail={removeEmailFromArray}
                                        />
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <EmailArrayField
                                            label="Pre-Arrival Notification Emails"
                                            emails={formData.emailConfiguration.preArrivalNotificationEmails}
                                            section="preArrivalNotificationEmails"
                                            error={formErrors.preArrivalNotificationEmails}
                                            onEmailChange={handleEmailArrayChange}
                                            onAddEmail={addEmailToArray}
                                            onRemoveEmail={removeEmailFromArray}
                                        />
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <EmailArrayField
                                            label="Rate Request Emails"
                                            emails={formData.emailConfiguration.rateRequestEmails}
                                            section="rateRequestEmails"
                                            error={formErrors.rateRequestEmails}
                                            onEmailChange={handleEmailArrayChange}
                                            onAddEmail={addEmailToArray}
                                            onRemoveEmail={removeEmailFromArray}
                                        />
                                    </Grid>

                                    <Grid item xs={12} sm={6}>
                                        <EmailArrayField
                                            label="Billing Emails"
                                            emails={formData.emailConfiguration.billingEmails}
                                            section="billingEmails"
                                            error={formErrors.billingEmails}
                                            onEmailChange={handleEmailArrayChange}
                                            onAddEmail={addEmailToArray}
                                            onRemoveEmail={removeEmailFromArray}
                                        />
                                    </Grid>

                                    {/* Services & Rate Structure Section - Placeholder */}
                                    <Grid item xs={12}>
                                        <Typography variant="h6" sx={{ fontSize: '13px', fontWeight: 500, mb: 2, mt: 2, color: '#4b5563' }}>
                                            Services & Rate Configuration
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', mb: 2 }}>
                                            Configure available services and pricing structure for this carrier
                                        </Typography>
                                    </Grid>

                                    <Grid item xs={12}>
                                        <Box sx={{
                                            p: 3,
                                            border: '2px dashed #d1d5db',
                                            borderRadius: 2,
                                            textAlign: 'center',
                                            bgcolor: '#f8fafc'
                                        }}>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 1 }}>
                                                🚧 Services & Rate Management
                                            </Typography>
                                            <Typography sx={{ fontSize: '11px', color: '#9ca3af' }}>
                                                Coming soon: Configure services, pricing models, and rate structures
                                            </Typography>
                                        </Box>
                                    </Grid>

                                    {/* Eligibility Rules Section - Placeholder */}
                                    <Grid item xs={12}>
                                        <Typography variant="h6" sx={{ fontSize: '13px', fontWeight: 500, mb: 2, mt: 2, color: '#4b5563' }}>
                                            Eligibility Rules
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', mb: 2 }}>
                                            Define when this carrier should be offered to customers
                                        </Typography>
                                    </Grid>

                                    <Grid item xs={12} sx={{ mb: 2 }}>
                                        <Box sx={{
                                            p: 3,
                                            border: '2px dashed #d1d5db',
                                            borderRadius: 2,
                                            textAlign: 'center',
                                            bgcolor: '#f8fafc'
                                        }}>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 1 }}>
                                                📋 Eligibility Configuration
                                            </Typography>
                                            <Typography sx={{ fontSize: '11px', color: '#9ca3af' }}>
                                                Coming soon: Set weight limits, service areas, and availability rules
                                            </Typography>
                                        </Box>
                                    </Grid>
                                </>
                            )}
                        </Grid>
                    </DialogContent>

                    {/* Moved Action Buttons and Enable Toggle to Bottom */}
                    <DialogActions sx={{
                        px: 3,
                        pb: 3,
                        borderTop: '1px solid #e5e7eb',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}>
                        <FormControlLabel
                            control={
                                <Switch
                                    name="enabled"
                                    checked={formData.enabled}
                                    onChange={handleFormChange}
                                    size="small"
                                    color="primary"
                                />
                            }
                            label={
                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                    Enable this carrier for rate quotes and bookings
                                </Typography>
                            }
                        />
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                onClick={handleCloseDialog}
                                size="small"
                                sx={{ fontSize: '12px' }}
                                disabled={saving}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                variant="contained"
                                size="small"
                                startIcon={saving ? <CircularProgress size={14} /> : <SaveIcon />}
                                disabled={saving || !!carrierIdError}
                                sx={{ fontSize: '12px', minWidth: '100px' }}
                            >
                                {saving ? 'Saving...' : (isEditMode ? 'Save' : 'Create Carrier')}
                            </Button>
                        </Box>
                    </DialogActions>
                </form>
            </Dialog>

            {/* Enhanced Delete Confirmation Dialog with High Side Effects Warning */}
            <Dialog
                open={openDeleteConfirm}
                onClose={() => {
                    setOpenDeleteConfirm(false);
                    setForceDelete(false);
                }}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{
                    fontSize: '18px',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    color: '#dc2626'
                }}>
                    <WarningIcon color="error" />
                    Critical Action Required
                </DialogTitle>
                <DialogContent>
                    <Alert severity="error" sx={{ mb: 3 }}>
                        <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                            High Side Effects Warning
                        </Typography>
                        <Typography sx={{ fontSize: '12px', mt: 1 }}>
                            Deleting carrier <strong>{selectedCarrier?.name}</strong> will have significant consequences:
                        </Typography>
                        <ul style={{ fontSize: '12px', marginTop: '8px', marginBottom: '8px' }}>
                            <li>All existing shipments using this carrier will lose carrier association</li>
                            <li>Future rate quotes will no longer include this carrier</li>
                            <li>API integrations and credentials will be permanently lost</li>
                            <li>Historical billing and tracking data may become inaccessible</li>
                            <li>Company carrier configurations will be broken</li>
                        </ul>
                    </Alert>

                    <Alert severity="warning" sx={{ mb: 3 }}>
                        <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                            Recommended Alternative
                        </Typography>
                        <Typography sx={{ fontSize: '12px', mt: 1 }}>
                            Consider <strong>disabling</strong> the carrier instead of deleting it. This will:
                        </Typography>
                        <ul style={{ fontSize: '12px', marginTop: '8px' }}>
                            <li>Preserve all historical data and associations</li>
                            <li>Prevent new shipments from using this carrier</li>
                            <li>Allow you to re-enable the carrier later if needed</li>
                            <li>Maintain data integrity across the system</li>
                        </ul>
                    </Alert>

                    <Box sx={{ p: 2, bgcolor: '#fef2f2', borderRadius: 1, border: '1px solid #fecaca' }}>
                        <FormControlLabel
                            control={
                                <MuiCheckbox
                                    checked={forceDelete}
                                    onChange={(e) => setForceDelete(e.target.checked)}
                                    color="error"
                                />
                            }
                            label={
                                <Typography sx={{ fontSize: '12px', color: '#dc2626' }}>
                                    I understand the consequences and want to permanently delete this carrier
                                </Typography>
                            }
                        />
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 3 }}>
                    <Button
                        onClick={() => {
                            setOpenDeleteConfirm(false);
                            setForceDelete(false);
                        }}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={() => handleDeleteCarrier(false)}
                        startIcon={<BlockIcon />}
                        variant="outlined"
                        color="warning"
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Disable Instead
                    </Button>
                    <Button
                        onClick={() => handleDeleteCarrier(true)}
                        startIcon={<DeleteIcon />}
                        color="error"
                        variant="contained"
                        size="small"
                        disabled={!forceDelete}
                        sx={{ fontSize: '12px' }}
                    >
                        Force Delete
                    </Button>
                </DialogActions>
            </Dialog>



            {/* Modular Edit Carrier Dialog */}
            {
                showEditCarrier && editCarrierId && (
                    <Dialog
                        open={showEditCarrier}
                        onClose={handleCloseEditCarrier}
                        maxWidth={false}
                        fullScreen
                        PaperProps={{
                            sx: {
                                m: 0,
                                borderRadius: 0
                            }
                        }}
                    >
                        <EditCarrier
                            carrierId={editCarrierId}
                            isModal={true}
                            onClose={handleCloseEditCarrier}
                            onCarrierUpdated={handleCarrierUpdated}
                        />
                    </Dialog>
                )
            }

            {/* QuickShip Carrier Dialog */}
            <QuickShipCarrierDialog
                open={showQuickshipDialog}
                onClose={() => {
                    setShowQuickshipDialog(false);
                    setEditingQuickshipCarrier(null);
                }}
                onSuccess={handleQuickshipCarrierSaved}
                companyId={
                    editingQuickshipCarrier
                        ? companyIdForAddress || (selectedCompany && selectedCompany !== 'all' ? selectedCompany : null)
                        : (selectedCompany && selectedCompany !== 'all' ? selectedCompany : null)
                }
                editingCarrier={editingQuickshipCarrier}
                existingCarriers={allQuickshipCarriers}
            />

            {/* Action Menu for QuickShip Carriers */}
            <Menu
                anchorEl={quickshipActionMenuAnchor}
                open={Boolean(quickshipActionMenuAnchor) && selectedQuickshipCarrier}
                onClose={handleQuickshipActionMenuClose}
            >
                <MenuItem onClick={() => handleEditQuickshipCarrier(selectedQuickshipCarrier)}>
                    <ListItemIcon>
                        <EditIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography sx={{ fontSize: '12px' }}>Edit Carrier</Typography>
                    </ListItemText>
                </MenuItem>

                <MenuItem onClick={() => handleManageRateCards(selectedQuickshipCarrier)}>
                    <ListItemIcon>
                        <MonetizationOnIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography sx={{ fontSize: '12px' }}>Manage Rate Cards</Typography>
                    </ListItemText>
                </MenuItem>

                <MenuItem onClick={() => handleManageRoutes(selectedQuickshipCarrier)}>
                    <ListItemIcon>
                        <RouteIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography sx={{ fontSize: '12px' }}>Carrier Routes</Typography>
                    </ListItemText>
                </MenuItem>

                <MenuItem onClick={() => handleManageWeight(selectedQuickshipCarrier)}>
                    <ListItemIcon>
                        <WeightIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography sx={{ fontSize: '12px' }}>Weight Eligibility</Typography>
                    </ListItemText>
                </MenuItem>

                <MenuItem onClick={() => handleManageDimensions(selectedQuickshipCarrier)}>
                    <ListItemIcon>
                        <DimensionIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography sx={{ fontSize: '12px' }}>Dimension Eligibility</Typography>
                    </ListItemText>
                </MenuItem>

                <MenuItem onClick={() => handleManageDimFactors(selectedQuickshipCarrier)}>
                    <ListItemIcon>
                        <CalculateIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography sx={{ fontSize: '12px' }}>DIM Factor Management</Typography>
                    </ListItemText>
                </MenuItem>

                <Divider />

                <MenuItem onClick={() => handleUploadRateCard(selectedQuickshipCarrier)}>
                    <ListItemIcon>
                        <CloudUploadIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography sx={{ fontSize: '12px' }}>Upload Rate Card</Typography>
                    </ListItemText>
                </MenuItem>

                <MenuItem onClick={() => handleConvertToConnected(selectedQuickshipCarrier)}>
                    <ListItemIcon>
                        <UpgradeIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography sx={{ fontSize: '12px' }}>Convert to Connected</Typography>
                    </ListItemText>
                </MenuItem>

                <Divider />
                <MenuItem onClick={() => handleDeleteQuickshipCarrier(selectedQuickshipCarrier)}>
                    <ListItemIcon>
                        <DeleteIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>
                        <Typography sx={{ fontSize: '12px' }}>Delete Carrier</Typography>
                    </ListItemText>
                </MenuItem>
            </Menu>

            {/* Snackbar for notifications */}
            <Dialog open={false} />

            {/* Rate Card Management Dialog */}
            <RateCardManagement
                isOpen={showRateCardManagement}
                onClose={handleCloseRateCardManagement}
                carrierId={rateCardCarrier?.id}
                carrierName={rateCardCarrier?.name}
            />

            {/* Carrier Routing Dialog */}
            <CarrierRoutingDialog
                open={showRoutingDialog}
                onClose={handleCloseRoutingDialog}
                carrier={routingCarrier}
            />

            {/* Carrier Weight Dialog */}
            <CarrierWeightDialog
                open={showWeightDialog}
                onClose={handleWeightDialogClose}
                carrier={weightCarrier}
            />

            {/* Carrier Dimension Dialog */}
            <CarrierDimensionDialog
                open={showDimensionDialog}
                onClose={handleDimensionDialogClose}
                carrier={dimensionCarrier}
            />

            <CarrierRateUploadDialog
                open={showRateUploadDialog}
                onClose={handleRateUploadDialogClose}
                carrier={rateUploadCarrier}
            />

            {/* Conversion Wizard Dialog */}
            <QuickShipConversionWizard
                isOpen={showConversionWizard}
                onClose={handleCloseConversionWizard}
                quickShipCarrier={conversionCarrier}
                onConversionComplete={handleConversionComplete}
            />

            {/* DIM Factor Management Dialog */}
            <Dialog
                open={showDimFactorDialog}
                onClose={() => setShowDimFactorDialog(false)}
                maxWidth="lg"
                fullWidth
                PaperProps={{
                    sx: { borderRadius: 2 }
                }}
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    DIM Factor Management - {dimFactorCarrier?.name}
                </DialogTitle>
                <DialogContent sx={{ p: 0 }}>
                    {dimFactorCarrier && (
                        <DimFactorManagement carrier={dimFactorCarrier} />
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 3 }}>
                    <Button
                        onClick={() => setShowDimFactorDialog(false)}
                        variant="outlined"
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </Box >
    );
};

export default Carriers; 
