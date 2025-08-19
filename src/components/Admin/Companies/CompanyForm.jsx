import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Button,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Stack,
    Avatar,
    IconButton,
    Tooltip,
    Alert,
    CircularProgress,
    Autocomplete,
    Breadcrumbs,
    Link as MuiLink,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    DialogContentText,
    Checkbox,
    FormControlLabel,
    Switch,
    Tabs,
    Tab,
    Chip,
    Collapse,
    Menu,
    ListItemIcon,
    ListItemText
} from '@mui/material';
import {
    Close as CloseIcon,
    Add as AddIcon,
    Save as SaveIcon,
    Edit as EditIcon,
    DeleteOutline as DeleteOutlineIcon,
    CloudUpload as CloudUploadIcon,
    Delete as DeleteIcon,
    Business as BusinessIcon,
    Person as PersonIcon,
    Receipt as ReceiptIcon,
    Palette as PaletteIcon,
    Settings as SettingsIcon,
    AdminPanelSettings as AdminIcon,
    MoreVert as MoreVertIcon
} from '@mui/icons-material';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch, arrayUnion, arrayRemove, FieldValue } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, getStorage } from 'firebase/storage';
import { getApp } from 'firebase/app';
import { db } from '../../../firebase/firebase';
import { useSnackbar } from 'notistack';
import AdminBreadcrumb from '../AdminBreadcrumb';
import { getAllAdditionalServices } from '../../../utils/serviceLevelUtils';
import { getStateOptions, getStateLabel } from '../../../utils/stateUtils';
import EmailChipsField from './EmailChipsField';

const CompanyForm = () => {
    const { id: companyFirestoreId } = useParams();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();
    const isEditMode = Boolean(companyFirestoreId);

    const [pageLoading, setPageLoading] = useState(isEditMode);
    const [saveLoading, setSaveLoading] = useState(false);
    const [error, setError] = useState(null);
    const [currentTab, setCurrentTab] = useState(0);

    // Delete confirmation dialog and action menu
    const [actionMenuAnchor, setActionMenuAnchor] = useState(null);
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        companyID: '',
        website: '',
        logoUrl: '', // Legacy field for backward compatibility
        logos: {
            dark: '', // Dark background logo URL
            light: '', // Light background logo URL
            circle: '', // Circle logo URL
            invoice: '', // Invoice/BOL/Confirmation logo URL
            document: '', // Document headers/footers logo URL
            email: '' // Email template logo URL
        },
        status: 'active',
        ownerID: '',
        adminUserIdsForForm: [],
        availableServiceLevels: {
            enabled: false, // If false, all service levels are available (default)
            freight: [], // Array of enabled freight service level codes
            courier: [] // Array of enabled courier service level codes
        },
        availableAdditionalServices: {
            enabled: false, // If false, all additional services are available (default)
            freight: [], // Array of enabled freight additional service objects with defaultEnabled flags
            courier: [] // Array of enabled courier additional service objects with defaultEnabled flags
        },
        mainContact: {
            firstName: '', lastName: '', email: '', phone: '',
            address1: '', address2: '', city: '', stateProv: '', zipPostal: '', country: 'CA',
            nickname: 'Head Office', isDefault: true,
        },
        billingAddress: {
            firstName: '', lastName: '', email: '', phone: '',
            address1: '', address2: '', city: '', stateProv: '', zipPostal: '', country: 'CA',
            nickname: 'Head Office', isDefault: true,
        },
        // NEW: Enhanced billing information for invoices
        billingInfo: {
            companyDisplayName: '', // For invoice header
            taxNumber: '', // Full tax string (e.g., "GST#: 84606 8013 RT0001")
            paymentInformation: '', // Custom payment info text for invoices (replaces hardcoded payment details)
            accountsReceivable: {
                firstName: '', lastName: '',
                email: [], // Array of emails
                phone: '',
                address1: '', address2: '', city: '', stateProv: '', zipPostal: '', country: 'CA',
                sameAsPayable: false
            },
            accountsPayable: {
                firstName: '', lastName: '',
                email: [], // Array of emails  
                phone: '',
                address1: '', address2: '', city: '', stateProv: '', zipPostal: '', country: 'CA'
            }
        },
        // Brand colors for theming
        brandColors: {
            primary: '#3b82f6',
            secondary: '#6b7280'
        },
        // Email template settings
        emailSettings: {
            headerText: '',
            footerText: ''
        }
    });
    const [originalAdminUserIds, setOriginalAdminUserIds] = useState([]);
    const [companyIdError, setCompanyIdError] = useState('');
    const [isCheckingCompanyId, setIsCheckingCompanyId] = useState(false);

    const [allUsers, setAllUsers] = useState([]);
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);

    // State for delete confirmation dialog - moved to top

    // State for Service Levels Management
    const [globalServiceLevels, setGlobalServiceLevels] = useState([]);
    const [serviceLevelsLoading, setServiceLevelsLoading] = useState(false);
    const [activeServiceLevelTab, setActiveServiceLevelTab] = useState('freight');

    // State for Additional Services Management
    const [globalAdditionalServices, setGlobalAdditionalServices] = useState({
        freight: [],
        courier: []
    });
    const [additionalServicesLoading, setAdditionalServicesLoading] = useState(false);
    const [activeAdditionalServiceTab, setActiveAdditionalServiceTab] = useState('freight');
    const [additionalServiceCategoryFilter, setAdditionalServiceCategoryFilter] = useState('all');



    // Load global service levels from configuration
    const loadGlobalServiceLevels = useCallback(async () => {
        try {
            setServiceLevelsLoading(true);
            const serviceLevelsRef = collection(db, 'serviceLevels');
            const q = query(serviceLevelsRef, where('enabled', '==', true));
            const snapshot = await getDocs(q);

            const serviceLevels = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setGlobalServiceLevels(serviceLevels);
            console.log('[loadGlobalServiceLevels] Loaded service levels:', serviceLevels);
        } catch (error) {
            console.error('[loadGlobalServiceLevels] Error loading service levels:', error);
            enqueueSnackbar('Failed to load service levels', { variant: 'error' });
        } finally {
            setServiceLevelsLoading(false);
        }
    }, [enqueueSnackbar]);

    // Load global additional services from configuration
    const loadGlobalAdditionalServices = useCallback(async () => {
        try {
            setAdditionalServicesLoading(true);
            console.log('[loadGlobalAdditionalServices] Loading additional services...');

            // Load freight additional services
            const freightServices = await getAllAdditionalServices('freight');
            // Load courier additional services  
            const courierServices = await getAllAdditionalServices('courier');

            setGlobalAdditionalServices({
                freight: freightServices,
                courier: courierServices
            });

            console.log('[loadGlobalAdditionalServices] Loaded additional services:', {
                freight: freightServices.length,
                courier: courierServices.length
            });
        } catch (error) {
            console.error('[loadGlobalAdditionalServices] Error loading additional services:', error);
            enqueueSnackbar('Failed to load additional services', { variant: 'error' });
        } finally {
            setAdditionalServicesLoading(false);
        }
    }, [enqueueSnackbar]);

    // Service Levels Management Handlers
    const handleServiceLevelsToggle = (enabled) => {
        setFormData(prev => ({
            ...prev,
            availableServiceLevels: {
                ...prev.availableServiceLevels,
                enabled
            }
        }));
    };

    const handleServiceLevelToggle = (serviceLevel, serviceType) => {
        setFormData(prev => {
            const currentServices = prev.availableServiceLevels[serviceType] || [];
            const isCurrentlySelected = currentServices.includes(serviceLevel.code);

            let updatedServices;
            if (isCurrentlySelected) {
                // Remove from selection
                updatedServices = currentServices.filter(code => code !== serviceLevel.code);
            } else {
                // Add to selection
                updatedServices = [...currentServices, serviceLevel.code];
            }

            return {
                ...prev,
                availableServiceLevels: {
                    ...prev.availableServiceLevels,
                    [serviceType]: updatedServices
                }
            };
        });
    };

    const getFilteredServiceLevels = (type) => {
        return globalServiceLevels.filter(level => level.type === type);
    };

    const isServiceLevelSelected = (serviceLevel, serviceType) => {
        return formData.availableServiceLevels[serviceType]?.includes(serviceLevel.code) || false;
    };

    // Additional Services Management Handlers
    const handleAdditionalServicesToggle = (enabled) => {
        setFormData(prev => ({
            ...prev,
            availableAdditionalServices: {
                ...prev.availableAdditionalServices,
                enabled
            }
        }));
    };

    const handleAdditionalServiceToggle = (additionalService, serviceType) => {
        setFormData(prev => {
            const currentServices = prev.availableAdditionalServices[serviceType] || [];
            const isCurrentlySelected = currentServices.some(service =>
                typeof service === 'string' ? service === additionalService.code : service.code === additionalService.code
            );

            let updatedServices;
            if (isCurrentlySelected) {
                // Remove from selection
                updatedServices = currentServices.filter(service =>
                    typeof service === 'string' ? service !== additionalService.code : service.code !== additionalService.code
                );
            } else {
                // Add to selection with defaultEnabled flag
                updatedServices = [...currentServices, {
                    code: additionalService.code,
                    defaultEnabled: false
                }];
            }

            return {
                ...prev,
                availableAdditionalServices: {
                    ...prev.availableAdditionalServices,
                    [serviceType]: updatedServices
                }
            };
        });
    };

    const handleDefaultEnabledToggle = (additionalService, serviceType) => {
        setFormData(prev => {
            const currentServices = prev.availableAdditionalServices[serviceType] || [];
            const updatedServices = currentServices.map(service => {
                if (typeof service === 'string') {
                    // Convert string to object if needed
                    return service === additionalService.code
                        ? { code: additionalService.code, defaultEnabled: true }
                        : service;
                } else {
                    // Toggle defaultEnabled for matching service
                    return service.code === additionalService.code
                        ? { ...service, defaultEnabled: !service.defaultEnabled }
                        : service;
                }
            });

            return {
                ...prev,
                availableAdditionalServices: {
                    ...prev.availableAdditionalServices,
                    [serviceType]: updatedServices
                }
            };
        });
    };

    const getFilteredAdditionalServices = (type, categoryFilter = null) => {
        const services = globalAdditionalServices[type] || [];
        const filterCategory = categoryFilter || additionalServiceCategoryFilter;

        if (filterCategory === 'all') {
            return services;
        }

        return services.filter(service => {
            const serviceType = service.serviceType || 'general';
            return serviceType === filterCategory;
        });
    };

    const getCategoryCounts = (type) => {
        const services = globalAdditionalServices[type] || [];
        const counts = {
            all: services.length,
            general: 0,
            pickup: 0,
            delivery: 0
        };

        services.forEach(service => {
            const serviceType = service.serviceType || 'general';
            if (counts.hasOwnProperty(serviceType)) {
                counts[serviceType]++;
            }
        });

        return counts;
    };

    const isAdditionalServiceSelected = (additionalService, serviceType) => {
        const currentServices = formData.availableAdditionalServices[serviceType] || [];
        return currentServices.some(service =>
            typeof service === 'string' ? service === additionalService.code : service.code === additionalService.code
        );
    };

    const isDefaultEnabledForService = (additionalService, serviceType) => {
        const currentServices = formData.availableAdditionalServices[serviceType] || [];
        const serviceConfig = currentServices.find(service =>
            typeof service === 'string' ? service === additionalService.code : service.code === additionalService.code
        );
        return typeof serviceConfig === 'object' ? (serviceConfig.defaultEnabled || false) : false;
    };

    // Multi-logo upload state
    const [selectedLogos, setSelectedLogos] = useState({
        dark: null,
        light: null,
        circle: null,
        invoice: null,
        document: null,
        email: null
    });
    const [logoPreviews, setLogoPreviews] = useState({
        dark: null,
        light: null,
        circle: null,
        invoice: null,
        document: null,
        email: null
    });
    const [logoErrors, setLogoErrors] = useState({
        dark: '',
        light: '',
        circle: '',
        invoice: '',
        document: '',
        email: ''
    });

    // Active logo tab state
    const [activeLogoTab, setActiveLogoTab] = useState(0);

    // Legacy logo state for backward compatibility
    const [selectedLogo, setSelectedLogo] = useState(null);
    const [logoPreview, setLogoPreview] = useState(null);
    const [logoError, setLogoError] = useState('');

    const fetchData = useCallback(async () => {
        setPageLoading(true);
        console.log(`CompanyForm fetchData START - Edit Mode: ${isEditMode}, companyFirestoreId: ${companyFirestoreId}`);
        try {
            const usersSnap = await getDocs(collection(db, 'users'));
            const usersData = usersSnap.docs.map(d => ({
                id: d.id,
                name: `${d.data().firstName || ''} ${d.data().lastName || ''}`.trim() || d.data().email,
                email: d.data().email
            }));
            setAllUsers(usersData);
            console.log("[fetchData] Fetched allUsers:", usersData.length);

            // Load global service levels and additional services for admin management
            await loadGlobalServiceLevels();
            await loadGlobalAdditionalServices();

            if (isEditMode && companyFirestoreId) {
                const companyDocRef = doc(db, 'companies', companyFirestoreId);
                const companyDoc = await getDoc(companyDocRef);

                if (!companyDoc.exists()) {
                    enqueueSnackbar('Company not found', { variant: 'error' });
                    navigate('/admin/companies');
                    setPageLoading(false);
                    return;
                }
                const companyDataFromDb = companyDoc.data();
                console.log("[fetchData] Fetched companyDataFromDb:", companyDataFromDb);
                console.log("[DEBUG] billingInfo from database:", companyDataFromDb.billingInfo);
                console.log("[DEBUG] AR email from database:", companyDataFromDb.billingInfo?.accountsReceivable?.email);
                console.log("[DEBUG] AP email from database:", companyDataFromDb.billingInfo?.accountsPayable?.email);

                let fetchedMainContact = { firstName: '', lastName: '', email: '', phone: '', address1: '', address2: '', city: '', stateProv: '', zipPostal: '', country: 'CA', nickname: 'Head Office', isDefault: true };
                let fetchedBillingAddress = { firstName: '', lastName: '', email: '', phone: '', address1: '', address2: '', city: '', stateProv: '', zipPostal: '', country: 'CA', nickname: 'Head Office', isDefault: true };
                let currentCompanyAdminIds = [];

                if (companyDataFromDb.companyID) {
                    // Fetch main contact
                    const addressBookRef = collection(db, 'addressBook');
                    const mainContactQuery = query(
                        addressBookRef,
                        where('addressClass', '==', 'company'),
                        where('addressClassID', '==', companyDataFromDb.companyID),
                        where('addressType', '==', 'contact')
                    );
                    const mainContactSnapshot = await getDocs(mainContactQuery);
                    if (!mainContactSnapshot.empty) {
                        fetchedMainContact = { id: mainContactSnapshot.docs[0].id, ...mainContactSnapshot.docs[0].data() };
                    }
                    console.log("[fetchData] Fetched mainContact:", fetchedMainContact);

                    // Fetch billing address
                    const billingQuery = query(addressBookRef, where('addressClass', '==', 'company'), where('addressClassID', '==', companyDataFromDb.companyID), where('addressType', '==', 'billing'));
                    const billingSnapshot = await getDocs(billingQuery);
                    if (!billingSnapshot.empty) {
                        fetchedBillingAddress = { id: billingSnapshot.docs[0].id, ...billingSnapshot.docs[0].data() };
                    }
                    console.log("[fetchData] Fetched billingAddress:", fetchedBillingAddress);

                    // Fetch users currently connected to this company via their connectedCompanies field
                    const usersAdminingCompanyQuery = query(
                        collection(db, 'users'),
                        where('connectedCompanies.companies', 'array-contains', companyDataFromDb.companyID)
                    );
                    const adminUsersSnap = await getDocs(usersAdminingCompanyQuery);
                    currentCompanyAdminIds = adminUsersSnap.docs.map(d => d.id);
                    console.log(`[fetchData] Fetched ${currentCompanyAdminIds.length} users as admins for companyID ${companyDataFromDb.companyID}`, currentCompanyAdminIds);
                }

                // Handle logo data - support both new multi-logo structure and legacy single logo
                const logos = companyDataFromDb.logos || {};
                const legacyLogo = companyDataFromDb.logoUrl || '';

                setFormData(prev => ({
                    ...prev, // Keep any other existing form data if necessary, though most should come from DB
                    name: companyDataFromDb.name || '',
                    companyID: companyDataFromDb.companyID || '',
                    website: companyDataFromDb.website || '',
                    logoUrl: legacyLogo, // Keep for backward compatibility
                    logos: {
                        dark: logos.dark || legacyLogo, // Use legacy logo as fallback for dark
                        light: logos.light || '',
                        circle: logos.circle || '',
                        invoice: logos.invoice || '',
                        document: logos.document || '',
                        email: logos.email || ''
                    },
                    status: companyDataFromDb.status || 'active',
                    ownerID: companyDataFromDb.ownerID || '',
                    adminUserIdsForForm: currentCompanyAdminIds, // Set directly
                    availableServiceLevels: companyDataFromDb.availableServiceLevels || {
                        enabled: false, // Default: all service levels available
                        freight: [],
                        courier: []
                    },
                    availableAdditionalServices: companyDataFromDb.availableAdditionalServices || {
                        enabled: false, // Default: all additional services available
                        freight: [],
                        courier: []
                    },
                    mainContact: fetchedMainContact, // Set directly
                    billingAddress: fetchedBillingAddress,
                    // NEW: Load billing info or set defaults
                    billingInfo: {
                        companyDisplayName: companyDataFromDb.billingInfo?.companyDisplayName || companyDataFromDb.name || '',
                        taxNumber: companyDataFromDb.billingInfo?.taxNumber || '',
                        paymentInformation: companyDataFromDb.billingInfo?.paymentInformation || '',
                        accountsReceivable: {
                            firstName: companyDataFromDb.billingInfo?.accountsReceivable?.firstName || '',
                            lastName: companyDataFromDb.billingInfo?.accountsReceivable?.lastName || '',
                            email: companyDataFromDb.billingInfo?.accountsReceivable?.email || [],
                            phone: companyDataFromDb.billingInfo?.accountsReceivable?.phone || '',
                            address1: companyDataFromDb.billingInfo?.accountsReceivable?.address1 || '',
                            address2: companyDataFromDb.billingInfo?.accountsReceivable?.address2 || '',
                            city: companyDataFromDb.billingInfo?.accountsReceivable?.city || '',
                            stateProv: companyDataFromDb.billingInfo?.accountsReceivable?.stateProv || '',
                            zipPostal: companyDataFromDb.billingInfo?.accountsReceivable?.zipPostal || '',
                            country: companyDataFromDb.billingInfo?.accountsReceivable?.country || 'CA',
                            sameAsPayable: companyDataFromDb.billingInfo?.accountsReceivable?.sameAsPayable || false
                        },
                        accountsPayable: {
                            firstName: companyDataFromDb.billingInfo?.accountsPayable?.firstName || '',
                            lastName: companyDataFromDb.billingInfo?.accountsPayable?.lastName || '',
                            email: companyDataFromDb.billingInfo?.accountsPayable?.email || [],
                            phone: companyDataFromDb.billingInfo?.accountsPayable?.phone || '',
                            address1: companyDataFromDb.billingInfo?.accountsPayable?.address1 || '',
                            address2: companyDataFromDb.billingInfo?.accountsPayable?.address2 || '',
                            city: companyDataFromDb.billingInfo?.accountsPayable?.city || '',
                            stateProv: companyDataFromDb.billingInfo?.accountsPayable?.stateProv || '',
                            zipPostal: companyDataFromDb.billingInfo?.accountsPayable?.zipPostal || '',
                            country: companyDataFromDb.billingInfo?.accountsPayable?.country || 'CA'
                        }
                    },
                    // Load brand colors or set defaults
                    brandColors: companyDataFromDb.brandColors || {
                        primary: '#3b82f6',
                        secondary: '#6b7280'
                    },
                    // Load email settings or set defaults
                    emailSettings: companyDataFromDb.emailSettings || {
                        headerText: '',
                        footerText: ''
                    }
                }));

                // Set multi-logo previews
                setLogoPreviews({
                    dark: logos.dark || legacyLogo || null,
                    light: logos.light || null,
                    circle: logos.circle || null,
                    invoice: logos.invoice || null,
                    document: logos.document || null,
                    email: logos.email || null
                });

                // Set legacy logo preview for backward compatibility
                if (legacyLogo) {
                    setLogoPreview(legacyLogo);
                }
                setOriginalAdminUserIds(currentCompanyAdminIds); // Keep this separate as it's for comparison on save

            } else {
                // For new companies, initialize formData with defaults
                setFormData({
                    name: '',
                    companyID: '',
                    website: '',
                    logoUrl: '',
                    logos: {
                        dark: '',
                        light: '',
                        circle: ''
                    },
                    status: 'active',
                    ownerID: '',
                    adminUserIdsForForm: [],
                    availableServiceLevels: {
                        enabled: false, // Default: all service levels available
                        freight: [],
                        courier: []
                    },
                    // Ensure additional services structure exists for new companies
                    availableAdditionalServices: {
                        enabled: false,
                        freight: [],
                        courier: []
                    },
                    mainContact: { firstName: '', lastName: '', email: '', phone: '', address1: '', address2: '', city: '', stateProv: '', zipPostal: '', country: 'CA', nickname: 'Head Office', isDefault: true },
                    billingAddress: { firstName: '', lastName: '', email: '', phone: '', address1: '', address2: '', city: '', stateProv: '', zipPostal: '', country: 'CA', nickname: 'Head Office', isDefault: true },
                });
                setOriginalAdminUserIds([]);
            }
        } catch (err) {
            console.error('Error loading initial data for CompanyForm:', err);
            setError(err.message);
            enqueueSnackbar('Error loading data: ' + err.message, { variant: 'error' });
        } finally {
            setPageLoading(false);
            setInitialLoadComplete(true);
            console.log("[fetchData] fetchInitialData finished");
        }
    }, [companyFirestoreId, isEditMode, navigate, enqueueSnackbar]);

    useEffect(() => {
        console.log("Current formData.adminUserIdsForForm before render:", formData.adminUserIdsForForm);
        console.log("Current allUsers before render:", allUsers);
    }); // Log on every render to see state before Autocomplete gets value

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // LOGGING ON RENDER
    console.log("[CompanyForm Render] Current formData.mainContact:", formData.mainContact);
    console.log("[CompanyForm Render] Current formData.billingAddress:", formData.billingAddress);
    console.log("[CompanyForm Render] Current formData general:", { name: formData.name, companyID: formData.companyID });

    const handleCompanyDataChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newState = { ...prev, [name]: value };
            if (name === 'name' && !isEditMode && (!prev.companyID || prev.companyID === prev.name.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, ''))) {
                newState.companyID = value.toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '');
            }
            return newState;
        });
    };

    const handleAutocompleteChange = (fieldName, newValue) => {
        if (fieldName === 'ownerID') {
            setFormData(prev => ({ ...prev, ownerID: newValue ? newValue.id : '' }));
        } else if (fieldName === 'adminUserIdsForForm') {
            setFormData(prev => ({ ...prev, adminUserIdsForForm: newValue.map(item => item.id) }));
        }
    };

    const handleMainContactChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const updatedContact = { ...prev.mainContact, [name]: value };
            // If country changes, reset state/province
            if (name === 'country') {
                updatedContact.stateProv = '';
            }
            return {
                ...prev,
                mainContact: updatedContact
            };
        });
    };

    const handleBillingAddressChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            billingAddress: { ...prev.billingAddress, [name]: value }
        }));
    };

    // NEW: Enhanced billing info handlers
    const handleBillingInfoChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            billingInfo: { ...prev.billingInfo, [name]: value }
        }));
    };

    const handleAccountsReceivableChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const updatedAccountsReceivable = { ...prev.billingInfo.accountsReceivable, [name]: value };
            // If country changes, reset state/province
            if (name === 'country') {
                updatedAccountsReceivable.stateProv = '';
            }
            return {
                ...prev,
                billingInfo: {
                    ...prev.billingInfo,
                    accountsReceivable: updatedAccountsReceivable
                }
            };
        });
    };

    const handleAccountsPayableChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const updatedAccountsPayable = { ...prev.billingInfo.accountsPayable, [name]: value };
            // If country changes, reset state/province
            if (name === 'country') {
                updatedAccountsPayable.stateProv = '';
            }
            return {
                ...prev,
                billingInfo: {
                    ...prev.billingInfo,
                    accountsPayable: updatedAccountsPayable
                }
            };
        });
    };

    const handleSameAsPayableChange = (checked) => {
        setFormData(prev => ({
            ...prev,
            billingInfo: {
                ...prev.billingInfo,
                accountsReceivable: {
                    ...prev.billingInfo.accountsReceivable,
                    sameAsPayable: checked,
                    ...(checked ? {
                        firstName: prev.billingInfo.accountsPayable.firstName,
                        lastName: prev.billingInfo.accountsPayable.lastName,
                        email: [...prev.billingInfo.accountsPayable.email],
                        phone: prev.billingInfo.accountsPayable.phone,
                        address1: prev.billingInfo.accountsPayable.address1,
                        address2: prev.billingInfo.accountsPayable.address2,
                        city: prev.billingInfo.accountsPayable.city,
                        stateProv: prev.billingInfo.accountsPayable.stateProv,
                        zipPostal: prev.billingInfo.accountsPayable.zipPostal,
                        country: prev.billingInfo.accountsPayable.country
                    } : {})
                }
            }
        }));
    };

    // Email array handlers for AR/AP
    const handleAddEmail = (contactType) => (email) => {
        if (!email || !email.includes('@')) return;

        setFormData(prev => ({
            ...prev,
            billingInfo: {
                ...prev.billingInfo,
                [contactType]: {
                    ...prev.billingInfo[contactType],
                    email: [...prev.billingInfo[contactType].email, email]
                }
            }
        }));
    };

    const handleRemoveEmail = (contactType) => (emailToRemove) => {
        setFormData(prev => ({
            ...prev,
            billingInfo: {
                ...prev.billingInfo,
                [contactType]: {
                    ...prev.billingInfo[contactType],
                    email: prev.billingInfo[contactType].email.filter(email => email !== emailToRemove)
                }
            }
        }));
    };

    // Multi-logo upload handlers
    const handleMultiLogoSelect = (logoType) => (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            setLogoErrors(prev => ({ ...prev, [logoType]: 'Please select a valid image file (JPEG, PNG, GIF, or WebP)' }));
            return;
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            setLogoErrors(prev => ({ ...prev, [logoType]: 'Logo file size must be less than 5MB' }));
            return;
        }

        setLogoErrors(prev => ({ ...prev, [logoType]: '' }));
        setSelectedLogos(prev => ({ ...prev, [logoType]: file }));

        // Create preview URL
        const reader = new FileReader();
        reader.onload = (e) => {
            setLogoPreviews(prev => ({ ...prev, [logoType]: e.target.result }));
        };
        reader.readAsDataURL(file);
    };

    // Legacy logo upload handler for backward compatibility
    const handleLogoSelect = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
            setLogoError('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
            return;
        }

        // Validate file size (max 5MB)
        const maxSize = 5 * 1024 * 1024; // 5MB
        if (file.size > maxSize) {
            setLogoError('Logo file size must be less than 5MB');
            return;
        }

        setLogoError('');
        setSelectedLogo(file);

        // Create preview URL
        const reader = new FileReader();
        reader.onload = (e) => {
            setLogoPreview(e.target.result);
        };
        reader.readAsDataURL(file);
    };



    // Multi-logo delete handler
    const handleMultiLogoDelete = async (logoType) => {
        try {
            const logoUrl = formData.logos[logoType];
            if (logoUrl) {
                // Delete from Firebase Storage if it's a Firebase URL
                if (logoUrl.includes('firebase')) {
                    const firebaseApp = getApp();
                    const customStorage = getStorage(firebaseApp, "gs://solushipx.firebasestorage.app");
                    const logoRef = ref(customStorage, logoUrl);
                    await deleteObject(logoRef);
                }
            }

            // Update form data
            setFormData(prev => ({
                ...prev,
                logos: { ...prev.logos, [logoType]: '' }
            }));
            setLogoPreviews(prev => ({ ...prev, [logoType]: null }));
            setSelectedLogos(prev => ({ ...prev, [logoType]: null }));

            const logoTypeNames = {
                dark: 'Dark Background Logo',
                light: 'Light Background Logo',
                circle: 'Circle Logo',
                invoice: 'Invoice Logo',
                document: 'Document Logo',
                email: 'Email Logo'
            };

            enqueueSnackbar(`${logoTypeNames[logoType]} removed successfully!`, { variant: 'success' });
        } catch (error) {
            console.error(`Error deleting ${logoType} logo:`, error);
            enqueueSnackbar(`Error removing logo: ${error.message}`, { variant: 'error' });
        }
    };

    // Legacy logo delete handler
    const handleLogoDelete = async () => {
        try {
            if (formData.logoUrl) {
                // Delete from Firebase Storage if it's a Firebase URL
                if (formData.logoUrl.includes('firebase')) {
                    const firebaseApp = getApp();
                    const customStorage = getStorage(firebaseApp, "gs://solushipx.firebasestorage.app");
                    const logoRef = ref(customStorage, formData.logoUrl);
                    await deleteObject(logoRef);
                }
            }

            // Update form data
            setFormData(prev => ({ ...prev, logoUrl: '' }));
            setLogoPreview(null);
            setSelectedLogo(null);

            enqueueSnackbar('Logo removed successfully!', { variant: 'success' });
        } catch (error) {
            console.error('Error deleting logo:', error);
            enqueueSnackbar('Error removing logo: ' + error.message, { variant: 'error' });
        }
    };

    // Render logo tab content
    const renderLogoTab = () => {
        const logoTypes = ['dark', 'light', 'circle', 'invoice', 'document', 'email'];
        const logoType = logoTypes[activeLogoTab];

        const logoTypeInfo = {
            dark: {
                title: 'Dark Background Logo',
                description: 'Used on dark backgrounds, navigation bars, and headers',
                backgroundDemo: '#1f2937',
                backgroundLabel: 'Dark Background Preview'
            },
            light: {
                title: 'Light Background Logo',
                description: 'Used on light backgrounds, white papers, and invoices',
                backgroundDemo: '#ffffff',
                backgroundLabel: 'Light Background Preview'
            },
            circle: {
                title: 'Circle Logo',
                description: 'Used for avatars, favicons, and social media profiles',
                backgroundDemo: '#f3f4f6',
                backgroundLabel: 'Avatar Preview'
            },
            invoice: {
                title: 'Invoice Logo',
                description: 'Used on generated documents (BOL, Carrier Confirmation, and invoices)',
                backgroundDemo: '#ffffff',
                backgroundLabel: 'Invoice Header Preview'
            },
            document: {
                title: 'Document Logo',
                description: 'Used in document headers, footers, and official paperwork',
                backgroundDemo: '#f9fafb',
                backgroundLabel: 'Document Header Preview'
            },
            email: {
                title: 'Email Logo',
                description: 'Used in email templates, signatures, and notifications',
                backgroundDemo: '#ffffff',
                backgroundLabel: 'Email Header Preview'
            }
        };

        const info = logoTypeInfo[logoType];

        return (
            <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: 'flex-start' }}>
                {/* Logo Preview Section */}
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 200 }}>
                    <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 2 }}>
                        {info.title}
                    </Typography>

                    {/* Logo Display */}
                    <Box sx={{
                        width: 120,
                        height: 120,
                        border: '1px solid #e5e7eb',
                        borderRadius: logoType === 'circle' ? '50%' : '8px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: info.backgroundDemo,
                        mb: 2,
                        overflow: 'hidden'
                    }}>
                        {logoPreviews[logoType] ? (
                            <img
                                src={logoPreviews[logoType]}
                                alt={info.title}
                                style={{
                                    maxWidth: '80%',
                                    maxHeight: '80%',
                                    objectFit: 'contain'
                                }}
                            />
                        ) : (
                            <BusinessIcon sx={{ fontSize: 48, color: logoType === 'dark' ? '#ffffff' : '#9ca3af' }} />
                        )}
                    </Box>

                    <Typography variant="body2" sx={{ fontSize: '10px', color: '#6b7280', mb: 2, textAlign: 'center' }}>
                        {info.backgroundLabel}
                    </Typography>

                    {/* Logo Actions */}
                    <Stack direction="row" spacing={1}>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleMultiLogoSelect(logoType)}
                            style={{ display: 'none' }}
                            id={`${logoType}-logo-file-input`}
                        />
                        <label htmlFor={`${logoType}-logo-file-input`}>
                            <Button
                                component="span"
                                variant="outlined"
                                size="small"
                                startIcon={<CloudUploadIcon />}
                                sx={{ fontSize: '12px' }}
                            >
                                {logoPreviews[logoType] ? 'Change' : 'Upload'}
                            </Button>
                        </label>

                        {logoPreviews[logoType] && (
                            <Button
                                variant="outlined"
                                color="error"
                                size="small"
                                onClick={() => handleMultiLogoDelete(logoType)}
                                startIcon={<DeleteIcon />}
                                sx={{ fontSize: '12px' }}
                            >
                                Remove
                            </Button>
                        )}
                    </Stack>
                </Box>

                {/* Logo Info and Status */}
                <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontSize: '12px', color: '#374151', mb: 1, fontWeight: 600 }}>
                        Usage Context
                    </Typography>
                    <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', mb: 3 }}>
                        {info.description}
                    </Typography>

                    {logoErrors[logoType] && (
                        <Alert severity="error" sx={{ mb: 2, fontSize: '11px' }}>
                            {logoErrors[logoType]}
                        </Alert>
                    )}

                    {selectedLogos[logoType] && (
                        <Alert severity="success" sx={{ mb: 2, fontSize: '11px' }}>
                            {info.title} selected! It will be uploaded when you save the company.
                        </Alert>
                    )}

                    {logoPreviews[logoType] && (
                        <Alert severity="info" sx={{ fontSize: '11px' }}>
                            {info.title} is ready for use across the platform.
                        </Alert>
                    )}
                </Box>
            </Box>
        );
    };

    const validateForm = () => {
        if (!formData.name || !formData.name.trim() || !formData.companyID || !formData.companyID.trim() || !formData.ownerID) {
            enqueueSnackbar('Company Name, Company ID, and Owner are required.', { variant: 'warning' });
            return false;
        }
        const mainContactHasSomeData = Object.values(formData.mainContact).some(val => typeof val === 'string' && val.trim() !== '');
        if (mainContactHasSomeData && (!formData.mainContact.firstName?.trim() || !formData.mainContact.lastName?.trim() || !formData.mainContact.email?.trim() || !formData.mainContact.address1?.trim() || !formData.mainContact.city?.trim() || !formData.mainContact.stateProv?.trim() || !formData.mainContact.zipPostal?.trim())) {
            enqueueSnackbar('If providing Main Contact details, First Name, Last Name, Email, Address 1, City, State/Prov, and Zip/Postal are required.', { variant: 'warning' });
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;
        setSaveLoading(true);
        setError(null);

        const humanReadableCompanyID = formData.companyID ? formData.companyID.trim() : '';

        try {
            // Check for duplicate companyID on create (frontend)
            if (!isEditMode) {
                const q = query(collection(db, 'companies'), where('companyID', '==', humanReadableCompanyID));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    enqueueSnackbar('A company with this Company ID already exists. Please choose a unique Company ID.', { variant: 'error' });
                    setSaveLoading(false);
                    return;
                }
            }

            // BACKEND: Double-check for duplicate companyID right before writing (race condition safe)
            if (!isEditMode) {
                const q2 = query(collection(db, 'companies'), where('companyID', '==', humanReadableCompanyID));
                const snap2 = await getDocs(q2);
                if (!snap2.empty) {
                    enqueueSnackbar('A company with this Company ID was just created. Please choose a unique Company ID.', { variant: 'error' });
                    setSaveLoading(false);
                    return;
                }
            }

            let logoUrl = formData.logoUrl;
            const logoUrls = { ...formData.logos };

            // Upload multiple logos if new files are selected
            const firebaseApp = getApp();
            const customStorage = getStorage(firebaseApp, "gs://solushipx.firebasestorage.app");

            for (const logoType of ['dark', 'light', 'circle', 'invoice', 'document', 'email']) {
                if (selectedLogos[logoType] && formData.companyID) {
                    try {
                        const fileExtension = selectedLogos[logoType].name.split('.').pop();
                        const fileName = `${formData.companyID}-${logoType}-${Date.now()}.${fileExtension}`;
                        const logoRef = ref(customStorage, `company-logos/${logoType}/${fileName}`);

                        // Upload file
                        const snapshot = await uploadBytes(logoRef, selectedLogos[logoType]);
                        const downloadUrl = await getDownloadURL(snapshot.ref);
                        logoUrls[logoType] = downloadUrl;

                        // Update legacy logoUrl if this is the dark logo (primary)
                        if (logoType === 'dark') {
                            logoUrl = downloadUrl;
                        }
                    } catch (logoError) {
                        console.error(`Error uploading ${logoType} logo:`, logoError);
                        enqueueSnackbar(`Warning: ${logoType} logo upload failed, but company will be saved without this logo`, { variant: 'warning' });
                    }
                }
            }

            // Legacy logo upload for backward compatibility
            if (selectedLogo && formData.companyID) {
                try {
                    const fileExtension = selectedLogo.name.split('.').pop();
                    const fileName = `${formData.companyID}-legacy-${Date.now()}.${fileExtension}`;
                    const logoRef = ref(customStorage, `company-logos/legacy/${fileName}`);

                    // Upload file
                    const snapshot = await uploadBytes(logoRef, selectedLogo);
                    logoUrl = await getDownloadURL(snapshot.ref);

                    // Also set as dark logo if no dark logo is set
                    if (!logoUrls.dark) {
                        logoUrls.dark = logoUrl;
                    }
                } catch (logoError) {
                    console.error('Error uploading legacy logo:', logoError);
                    enqueueSnackbar('Warning: Logo upload failed, but company will be saved without logo', { variant: 'warning' });
                }
            }

            const now = serverTimestamp();
            const companyDocRef = isEditMode && companyFirestoreId ? doc(db, 'companies', companyFirestoreId) : doc(collection(db, 'companies'));

            // Prepare company data, excluding mainContact and originAddresses from the direct company doc save
            const companyCoreData = {
                name: formData.name ? formData.name.trim() : '',
                companyID: humanReadableCompanyID,
                website: formData.website ? formData.website.trim() : '',
                logoUrl: logoUrl || '', // Keep for backward compatibility
                logos: logoUrls, // New multi-logo structure
                status: formData.status,
                ownerID: formData.ownerID,
                availableServiceLevels: formData.availableServiceLevels, // Include service level restrictions
                availableAdditionalServices: formData.availableAdditionalServices, // Include additional services restrictions
                // NEW: Enhanced billing information for invoices
                billingInfo: {
                    companyDisplayName: formData.billingInfo.companyDisplayName ? formData.billingInfo.companyDisplayName.trim() : formData.name.trim(),
                    taxNumber: formData.billingInfo.taxNumber ? formData.billingInfo.taxNumber.trim() : '',
                    paymentInformation: formData.billingInfo.paymentInformation ? formData.billingInfo.paymentInformation.trim() : '',
                    accountsReceivable: formData.billingInfo.accountsReceivable,
                    accountsPayable: formData.billingInfo.accountsPayable
                },
                // Brand colors for theming
                brandColors: formData.brandColors,
                // Email template settings
                emailSettings: formData.emailSettings,
                updatedAt: now,
            };
            if (!isEditMode) {
                companyCoreData.createdAt = now;
            }

            const batch = writeBatch(db);
            batch.set(companyDocRef, companyCoreData, { merge: isEditMode });

            // Update users' connectedCompanies arrays
            const newAdminSelections = formData.adminUserIdsForForm || [];
            const usersToAddLink = newAdminSelections.filter(uid => !originalAdminUserIds.includes(uid));
            const usersToRemoveLink = originalAdminUserIds.filter(uid => !newAdminSelections.includes(uid));

            console.log("Company Admins - To Add Link:", usersToAddLink, "For CompanyID:", humanReadableCompanyID);
            console.log("Company Admins - To Remove Link:", usersToRemoveLink, "For CompanyID:", humanReadableCompanyID);

            usersToAddLink.forEach(userId => {
                const userRef = doc(db, 'users', userId);
                batch.update(userRef, { 'connectedCompanies.companies': arrayUnion(humanReadableCompanyID) });
            });

            usersToRemoveLink.forEach(userId => {
                const userRef = doc(db, 'users', userId);
                batch.update(userRef, { 'connectedCompanies.companies': arrayRemove(humanReadableCompanyID) });
            });

            // Save main contact to addressBook
            if (formData.mainContact.address1 && formData.mainContact.address1.trim()) { // Check if there's actual address data
                const mainContactRef = formData.mainContact.id ? doc(db, 'addressBook', formData.mainContact.id) : doc(collection(db, 'addressBook'));
                const mainContactDataToSave = {
                    ...formData.mainContact,
                    addressClass: 'company',
                    addressClassID: humanReadableCompanyID,
                    addressType: 'contact',
                    companyName: formData.name ? formData.name.trim() : '',
                    updatedAt: now,
                    ...(formData.mainContact.id ? {} : { createdAt: now })
                };
                batch.set(mainContactRef, mainContactDataToSave, { merge: Boolean(formData.mainContact.id) });
            }

            // Save billing address to addressBook
            if (formData.billingAddress.address1 && formData.billingAddress.address1.trim()) {
                // If billingAddress.id is the same as mainContact.id, ignore it (force new record)
                let billingId = formData.billingAddress.id;
                if (billingId && formData.mainContact.id && billingId === formData.mainContact.id) {
                    billingId = undefined;
                }
                const billingRef = billingId ? doc(db, 'addressBook', billingId) : doc(collection(db, 'addressBook'));
                const billingDataToSave = {
                    ...formData.billingAddress,
                    addressClass: 'company',
                    addressClassID: humanReadableCompanyID,
                    addressType: 'billing',
                    companyName: formData.name ? formData.name.trim() : '',
                    updatedAt: now,
                    ...(billingId ? {} : { createdAt: now })
                };
                delete billingDataToSave.id;
                batch.set(billingRef, billingDataToSave, { merge: Boolean(billingId) });
            }

            await batch.commit();
            setOriginalAdminUserIds(newAdminSelections);

            // Setup notification subscriptions for new/removed company admins
            if (usersToAddLink.length > 0 || usersToRemoveLink.length > 0) {
                try {
                    console.log('Setting up admin notifications...', {
                        companyId: humanReadableCompanyID,
                        usersToAdd: usersToAddLink,
                        usersToRemove: usersToRemoveLink
                    });

                    // Default admin notification preferences (hawkeye mode enabled)
                    const defaultAdminPreferences = {
                        shipment_created: true,
                        shipment_delivered: true,
                        shipment_delayed: true,
                        status_changed: true,
                        customer_note_added: true,
                        hawkeye_mode: true
                    };

                    // Disabled preferences for removal
                    const disabledPreferences = {
                        shipment_created: false,
                        shipment_delivered: false,
                        shipment_delayed: false,
                        status_changed: false,
                        customer_note_added: false,
                        hawkeye_mode: false
                    };

                    const notificationPromises = [];

                    // Add notification subscriptions for new admins
                    for (const userId of usersToAddLink) {
                        // Get user email for the subscription
                        const userDoc = await getDoc(doc(db, 'users', userId));
                        const userEmail = userDoc.exists() ? userDoc.data().email : null;

                        Object.entries(defaultAdminPreferences).forEach(([notificationType, enabled]) => {
                            const subscriptionId = `${userId}_${humanReadableCompanyID}_${notificationType}`;
                            const subscriptionData = {
                                userId: userId,
                                userEmail: userEmail, // CRITICAL: Add userEmail field required by notification system
                                companyId: humanReadableCompanyID,
                                notificationType: notificationType,
                                subscribed: enabled, // CRITICAL: Use 'subscribed' field instead of 'enabled' to match query
                                createdAt: serverTimestamp(),
                                updatedAt: serverTimestamp()
                            };

                            // Add subscribedAt timestamp for enabled subscriptions
                            if (enabled) {
                                subscriptionData.subscribedAt = serverTimestamp();
                            }

                            notificationPromises.push(
                                setDoc(doc(db, 'notificationSubscriptions', subscriptionId), subscriptionData)
                            );
                        });
                    }

                    // Remove notification subscriptions for removed admins
                    for (const userId of usersToRemoveLink) {
                        // Get user email for the subscription
                        const userDoc = await getDoc(doc(db, 'users', userId));
                        const userEmail = userDoc.exists() ? userDoc.data().email : null;

                        Object.entries(disabledPreferences).forEach(([notificationType, enabled]) => {
                            const subscriptionId = `${userId}_${humanReadableCompanyID}_${notificationType}`;
                            const subscriptionData = {
                                userId: userId,
                                userEmail: userEmail, // CRITICAL: Add userEmail field required by notification system
                                companyId: humanReadableCompanyID,
                                notificationType: notificationType,
                                subscribed: enabled, // CRITICAL: Use 'subscribed' field instead of 'enabled' to match query
                                updatedAt: serverTimestamp()
                            };

                            notificationPromises.push(
                                setDoc(doc(db, 'notificationSubscriptions', subscriptionId), subscriptionData)
                            );
                        });
                    }

                    // Execute all notification updates
                    await Promise.all(notificationPromises);

                    console.log('Admin notifications setup completed successfully', {
                        usersAdded: usersToAddLink.length,
                        usersRemoved: usersToRemoveLink.length,
                        totalSubscriptions: notificationPromises.length
                    });

                } catch (notificationError) {
                    console.error('Error setting up admin notifications:', notificationError);
                    enqueueSnackbar(`Company saved successfully, but notification setup failed. Users may need to manually configure notifications.`, { variant: 'warning' });
                }
            }

            enqueueSnackbar(`Company ${isEditMode ? 'updated' : 'created'} successfully!`, { variant: 'success' });
            const redirectId = isEditMode ? companyFirestoreId : companyDocRef.id;
            navigate(`/admin/companies/${redirectId}`);
        } catch (err) {
            console.error('Error saving company:', err);
            setError(err.message);
            enqueueSnackbar(`Error: ${err.message}`, { variant: 'error' });
        } finally {
            setSaveLoading(false);
        }
    };

    const handleDeleteCompany = async () => {
        if (!companyFirestoreId || !formData.companyID) return;
        setSaveLoading(true);
        setActionMenuAnchor(null);
        setDeleteConfirmOpen(false);

        try {
            // 1. Delete company doc
            await deleteDoc(doc(db, 'companies', companyFirestoreId));
            // 2. Delete all addressBook records for this company (main contact, billing)
            const addressBookRef = collection(db, 'addressBook');
            const q = query(addressBookRef, where('addressClass', '==', 'company'), where('addressClassID', '==', formData.companyID));
            const snap = await getDocs(q);
            const batch = writeBatch(db);
            snap.forEach(docSnap => batch.delete(doc(db, 'addressBook', docSnap.id)));
            await batch.commit();
            enqueueSnackbar('Company and all related addresses deleted.', { variant: 'success' });
            navigate('/admin/companies');
        } catch (err) {
            enqueueSnackbar('Error deleting company: ' + err.message, { variant: 'error' });
            setSaveLoading(false);
        }
    };

    const handleActionMenuOpen = (event) => {
        setActionMenuAnchor(event.currentTarget);
    };

    const handleActionMenuClose = () => {
        setActionMenuAnchor(null);
    };

    const handleDeleteClick = () => {
        setActionMenuAnchor(null);
        setDeleteConfirmOpen(true);
    };



    // Add debounced company ID check
    useEffect(() => {
        const checkCompanyId = async () => {
            if (!formData.companyID || !formData.companyID.trim() || isEditMode) return;

            setIsCheckingCompanyId(true);
            try {
                const q = query(collection(db, 'companies'), where('companyID', '==', formData.companyID ? formData.companyID.trim() : ''));
                const snap = await getDocs(q);
                if (!snap.empty) {
                    setCompanyIdError('This Company ID is already taken');
                } else {
                    setCompanyIdError('');
                }
            } catch (err) {
                console.error('Error checking company ID:', err);
            } finally {
                setIsCheckingCompanyId(false);
            }
        };

        const timeoutId = setTimeout(checkCompanyId, 2000);
        return () => clearTimeout(timeoutId);
    }, [formData.companyID, isEditMode]);

    if (pageLoading && !initialLoadComplete && isEditMode) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><CircularProgress /></Box>;
    }

    // Tab change handler
    const handleTabChange = (event, newValue) => {
        setCurrentTab(newValue);
    };

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
        }}>
            {/* Header Section */}
            <Box sx={{ p: 3 }}>
                {/* Title and Actions Row */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        {/* Company Logo */}
                        {isEditMode && (
                            <Box sx={{
                                width: 60,
                                height: 60,
                                borderRadius: '8px',
                                overflow: 'hidden',
                                border: '1px solid #e5e7eb',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: '#f9fafb'
                            }}>
                                {(() => {
                                    // Priority: circle > light > placeholder
                                    if (formData.logos?.circle) {
                                        return (
                                            <img
                                                src={formData.logos.circle}
                                                alt={`${formData.name} logo`}
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover'
                                                }}
                                            />
                                        );
                                    } else if (formData.logos?.light) {
                                        return (
                                            <img
                                                src={formData.logos.light}
                                                alt={`${formData.name} logo`}
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover'
                                                }}
                                            />
                                        );
                                    } else {
                                        return (
                                            <BusinessIcon sx={{ fontSize: 32, color: '#9ca3af' }} />
                                        );
                                    }
                                })()}
                            </Box>
                        )}

                        <Box>
                            <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827', mb: 2 }}>
                                {isEditMode ? `Edit Company: ${formData.name || 'Loading...'}` : 'Add New Company'}
                            </Typography>
                            {/* Breadcrumb */}
                            <AdminBreadcrumb
                                entityName={isEditMode ? formData.name : null}
                                showEntityName={isEditMode}
                            />
                        </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                            onClick={() => navigate(isEditMode && companyFirestoreId ? `/admin/companies/${companyFirestoreId}` : '/admin/companies')}
                            variant="outlined"
                            size="small"
                            startIcon={<CloseIcon />}
                            disabled={saveLoading || pageLoading}
                            sx={{ fontSize: '12px' }}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            size="small"
                            startIcon={<SaveIcon />}
                            disabled={saveLoading || pageLoading}
                            form="company-form-id"
                            sx={{ fontSize: '12px' }}
                        >
                            {saveLoading ? <CircularProgress size={16} color="inherit" /> : (isEditMode ? 'Save' : 'Create Company')}
                        </Button>
                        {isEditMode && (
                            <IconButton
                                size="small"
                                onClick={handleActionMenuOpen}
                                disabled={saveLoading || pageLoading}
                                sx={{
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '6px'
                                }}
                            >
                                <MoreVertIcon sx={{ fontSize: '16px' }} />
                            </IconButton>
                        )}
                    </Box>
                </Box>
            </Box>

            {/* Tabs Navigation */}
            <Box sx={{ borderBottom: '1px solid #e5e7eb', bgcolor: '#ffffff' }}>
                <Tabs
                    value={currentTab}
                    onChange={handleTabChange}
                    sx={{
                        px: 3,
                        '& .MuiTab-root': {
                            fontSize: '12px',
                            fontWeight: 500,
                            textTransform: 'none',
                            minWidth: 'auto',
                            px: 2,
                            py: 1.5
                        }
                    }}
                >
                    <Tab
                        icon={<BusinessIcon sx={{ fontSize: '16px' }} />}
                        label="Company Info"
                        iconPosition="start"
                    />
                    <Tab
                        icon={<PersonIcon sx={{ fontSize: '16px' }} />}
                        label="Contact & Billing"
                        iconPosition="start"
                    />
                    <Tab
                        icon={<PaletteIcon sx={{ fontSize: '16px' }} />}
                        label="Theme & Branding"
                        iconPosition="start"
                    />
                    <Tab
                        icon={<SettingsIcon sx={{ fontSize: '16px' }} />}
                        label="Services & Restrictions"
                        iconPosition="start"
                    />
                    <Tab
                        icon={<AdminIcon sx={{ fontSize: '16px' }} />}
                        label="Company Admins"
                        iconPosition="start"
                    />
                </Tabs>
            </Box>

            {/* Tab Content */}
            <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                <Box sx={{ width: '100%', px: 3, py: 3 }}>
                    <Paper
                        component="form"
                        id="company-form-id"
                        onSubmit={handleSubmit}
                        elevation={0}
                        sx={{
                            p: 3,
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            bgcolor: '#ffffff'
                        }}
                    >
                        {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

                        {/* Tab 0: Company Information */}
                        {currentTab === 0 && (
                            <Grid container spacing={3}>
                                <Grid item xs={12}>
                                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 2 }}>
                                        Company Information
                                    </Typography>
                                </Grid>


                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Company Name"
                                        name="name"
                                        value={formData.name}
                                        onChange={handleCompanyDataChange}
                                        required
                                        sx={{
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiInputBase-input': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Company ID"
                                        name="companyID"
                                        value={formData.companyID}
                                        onChange={handleCompanyDataChange}
                                        required
                                        disabled={isEditMode && formData.companyID !== ''}
                                        error={Boolean(companyIdError)}
                                        helperText={companyIdError || (isCheckingCompanyId ? 'Checking availability...' : 'Human-readable ID (e.g., COMPANY-NAME)')}
                                        sx={{
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Website URL"
                                        name="website"
                                        type="url"
                                        value={formData.website}
                                        onChange={handleCompanyDataChange}
                                        placeholder="https://www.example.com"
                                        helperText="Company website (optional)"
                                        sx={{
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <FormControl fullWidth size="small" required>
                                        <InputLabel sx={{ fontSize: '12px' }}>Status</InputLabel>
                                        <Select
                                            name="status"
                                            value={formData.status}
                                            label="Status"
                                            onChange={handleCompanyDataChange}
                                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                        >
                                            <MenuItem value="active" sx={{ fontSize: '12px' }}>Active</MenuItem>
                                            <MenuItem value="inactive" sx={{ fontSize: '12px' }}>Inactive</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Autocomplete
                                        size="small"
                                        options={allUsers}
                                        getOptionLabel={(option) => `${option.name} (${option.email || 'N/A'})`}
                                        value={allUsers.find(u => u.id === formData.ownerID) || null}
                                        onChange={(event, newValue) => handleAutocompleteChange('ownerID', newValue)}
                                        isOptionEqualToValue={(option, value) => option.id === value.id}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                label="Company Owner"
                                                required
                                                sx={{
                                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                                    '& .MuiInputBase-input': { fontSize: '12px' }
                                                }}
                                            />
                                        )}
                                    />
                                </Grid>
                            </Grid>
                        )}

                        {/* Tab 1: Contact & Billing */}
                        {currentTab === 1 && (
                            <Grid container spacing={3}>
                                {/* Main Contact Section */}
                                <Grid item xs={12}>
                                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 2 }}>
                                        Main Contact
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Contact First Name"
                                        name="firstName"
                                        value={formData.mainContact.firstName || ''}
                                        onChange={handleMainContactChange}
                                        sx={{
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiInputBase-input': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Contact Last Name"
                                        name="lastName"
                                        value={formData.mainContact.lastName || ''}
                                        onChange={handleMainContactChange}
                                        sx={{
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiInputBase-input': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Contact Email"
                                        name="email"
                                        type="email"
                                        value={formData.mainContact.email || ''}
                                        onChange={handleMainContactChange}
                                        sx={{
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiInputBase-input': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Contact Phone"
                                        name="phone"
                                        value={formData.mainContact.phone || ''}
                                        onChange={handleMainContactChange}
                                        sx={{
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiInputBase-input': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Address Line 1"
                                        name="address1"
                                        value={formData.mainContact.address1 || ''}
                                        onChange={handleMainContactChange}
                                        sx={{
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiInputBase-input': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Address Line 2"
                                        name="address2"
                                        value={formData.mainContact.address2 || ''}
                                        onChange={handleMainContactChange}
                                        sx={{
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiInputBase-input': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="City"
                                        name="city"
                                        value={formData.mainContact.city || ''}
                                        onChange={handleMainContactChange}
                                        sx={{
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiInputBase-input': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={3}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>
                                            {getStateLabel(formData.mainContact.country || 'CA')}
                                        </InputLabel>
                                        <Select
                                            name="stateProv"
                                            value={formData.mainContact.stateProv || ''}
                                            label={getStateLabel(formData.mainContact.country || 'CA')}
                                            onChange={handleMainContactChange}
                                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                        >
                                            {getStateOptions(formData.mainContact.country || 'CA').map((option) => (
                                                <MenuItem key={option.value} value={option.value} sx={{ fontSize: '12px' }}>
                                                    {option.label}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={3}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Zip/Postal Code"
                                        name="zipPostal"
                                        value={formData.mainContact.zipPostal || ''}
                                        onChange={handleMainContactChange}
                                        sx={{
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiInputBase-input': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={2}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>Country</InputLabel>
                                        <Select
                                            name="country"
                                            value={formData.mainContact.country || 'CA'}
                                            label="Country"
                                            onChange={handleMainContactChange}
                                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                        >
                                            <MenuItem value="CA" sx={{ fontSize: '12px' }}>Canada</MenuItem>
                                            <MenuItem value="US" sx={{ fontSize: '12px' }}>United States</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                {/* Invoice & Billing Information Section */}
                                <Grid item xs={12}>
                                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 2, mt: 4 }}>
                                        Invoice & Billing Information
                                    </Typography>
                                    <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', mb: 3 }}>
                                        Configure company information that will appear on generated invoices and billing documents.
                                    </Typography>
                                </Grid>

                                {/* Company Display Name and Tax Number */}
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Company Display Name (for invoices)"
                                        name="companyDisplayName"
                                        value={formData.billingInfo?.companyDisplayName || ''}
                                        onChange={handleBillingInfoChange}
                                        placeholder={formData.name || 'Enter company name for invoices'}
                                        helperText="Company name as it appears on invoices (defaults to company name)"
                                        sx={{
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Tax Number"
                                        name="taxNumber"
                                        value={formData.billingInfo?.taxNumber || ''}
                                        onChange={handleBillingInfoChange}
                                        placeholder="GST#: 84606 8013 RT0001"
                                        helperText="Full tax number string as it should appear on invoices"
                                        sx={{
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                        }}
                                    />
                                </Grid>

                                {/* Payment Information for Invoices */}
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="Payment Information for Invoices"
                                        name="paymentInformation"
                                        value={formData.billingInfo?.paymentInformation || ''}
                                        onChange={handleBillingInfoChange}
                                        multiline
                                        rows={8}
                                        placeholder={`FOR E-TRANSFER PAYMENT,
Please send to: ar@yourcompany.com

FOR EFT PAYMENT,
Bank name: Your Bank Name
Bank address: Your Bank Address
Account Name: Your Company Name
Account address: Your Address
Bank #: 000 | Branch Transit #: 00000
Account #: 0000000 | US Account #: 0000000
Payment notice sent to: ar@yourcompany.com

We also accept credit card payment with a fee.`}
                                        helperText="Custom payment instructions that will appear at the bottom of invoices. If left blank, no payment section will appear on invoices."
                                        sx={{
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiFormHelperText-root': { fontSize: '11px' }
                                        }}
                                    />
                                </Grid>

                                {/* Accounts Payable Section */}
                                <Grid item xs={12}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#374151', fontSize: '14px', mb: 2, mt: 3 }}>
                                        Accounts Payable Contact
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="AP First Name"
                                        name="firstName"
                                        value={formData.billingInfo?.accountsPayable?.firstName || ''}
                                        onChange={handleAccountsPayableChange}
                                        sx={{
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiInputBase-input': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="AP Last Name"
                                        name="lastName"
                                        value={formData.billingInfo?.accountsPayable?.lastName || ''}
                                        onChange={handleAccountsPayableChange}
                                        sx={{
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiInputBase-input': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <EmailChipsField
                                        label="AP Email Addresses"
                                        emails={formData.billingInfo?.accountsPayable?.email || []}
                                        onAddEmail={handleAddEmail('accountsPayable')}
                                        onRemoveEmail={handleRemoveEmail('accountsPayable')}
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="AP Phone"
                                        name="phone"
                                        value={formData.billingInfo?.accountsPayable?.phone || ''}
                                        onChange={handleAccountsPayableChange}
                                        sx={{
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiInputBase-input': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="AP Address Line 1"
                                        name="address1"
                                        value={formData.billingInfo?.accountsPayable?.address1 || ''}
                                        onChange={handleAccountsPayableChange}
                                        sx={{
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiInputBase-input': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="AP Address Line 2"
                                        name="address2"
                                        value={formData.billingInfo?.accountsPayable?.address2 || ''}
                                        onChange={handleAccountsPayableChange}
                                        sx={{
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiInputBase-input': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="AP City"
                                        name="city"
                                        value={formData.billingInfo?.accountsPayable?.city || ''}
                                        onChange={handleAccountsPayableChange}
                                        sx={{
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiInputBase-input': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={4}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>
                                            AP {getStateLabel(formData.billingInfo?.accountsPayable?.country || 'CA')}
                                        </InputLabel>
                                        <Select
                                            name="stateProv"
                                            value={formData.billingInfo?.accountsPayable?.stateProv || ''}
                                            label={`AP ${getStateLabel(formData.billingInfo?.accountsPayable?.country || 'CA')}`}
                                            onChange={handleAccountsPayableChange}
                                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                        >
                                            {getStateOptions(formData.billingInfo?.accountsPayable?.country || 'CA').map((option) => (
                                                <MenuItem key={option.value} value={option.value} sx={{ fontSize: '12px' }}>
                                                    {option.label}
                                                </MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                </Grid>
                                <Grid item xs={12} md={2}>
                                    <TextField
                                        fullWidth
                                        size="small"
                                        label="AP Zip/Postal"
                                        name="zipPostal"
                                        value={formData.billingInfo?.accountsPayable?.zipPostal || ''}
                                        onChange={handleAccountsPayableChange}
                                        sx={{
                                            '& .MuiInputLabel-root': { fontSize: '12px' },
                                            '& .MuiInputBase-input': { fontSize: '12px' }
                                        }}
                                    />
                                </Grid>
                                <Grid item xs={12} md={2}>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>AP Country</InputLabel>
                                        <Select
                                            name="country"
                                            value={formData.billingInfo?.accountsPayable?.country || 'CA'}
                                            label="AP Country"
                                            onChange={handleAccountsPayableChange}
                                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                        >
                                            <MenuItem value="CA" sx={{ fontSize: '12px' }}>Canada</MenuItem>
                                            <MenuItem value="US" sx={{ fontSize: '12px' }}>United States</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                {/* Accounts Receivable Section */}
                                <Grid item xs={12}>
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#374151', fontSize: '14px', mb: 2, mt: 3 }}>
                                        Accounts Receivable Contact (appears on invoices)
                                    </Typography>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                size="small"
                                                checked={formData.billingInfo?.accountsReceivable?.sameAsPayable || false}
                                                onChange={e => handleSameAsPayableChange(e.target.checked)}
                                            />
                                        }
                                        label={<Typography sx={{ fontSize: '12px' }}>Same as Accounts Payable</Typography>}
                                        sx={{ mb: 2 }}
                                    />
                                </Grid>

                                {!formData.billingInfo?.accountsReceivable?.sameAsPayable && (
                                    <>
                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label="AR First Name"
                                                name="firstName"
                                                value={formData.billingInfo?.accountsReceivable?.firstName || ''}
                                                onChange={handleAccountsReceivableChange}
                                                sx={{
                                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                                    '& .MuiInputBase-input': { fontSize: '12px' }
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label="AR Last Name"
                                                name="lastName"
                                                value={formData.billingInfo?.accountsReceivable?.lastName || ''}
                                                onChange={handleAccountsReceivableChange}
                                                sx={{
                                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                                    '& .MuiInputBase-input': { fontSize: '12px' }
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} md={6}>
                                            <EmailChipsField
                                                label="AR Email Addresses"
                                                emails={formData.billingInfo?.accountsReceivable?.email || []}
                                                onAddEmail={handleAddEmail('accountsReceivable')}
                                                onRemoveEmail={handleRemoveEmail('accountsReceivable')}
                                            />
                                        </Grid>
                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label="AR Phone"
                                                name="phone"
                                                value={formData.billingInfo?.accountsReceivable?.phone || ''}
                                                onChange={handleAccountsReceivableChange}
                                                sx={{
                                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                                    '& .MuiInputBase-input': { fontSize: '12px' }
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={12}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label="AR Address Line 1"
                                                name="address1"
                                                value={formData.billingInfo?.accountsReceivable?.address1 || ''}
                                                onChange={handleAccountsReceivableChange}
                                                sx={{
                                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                                    '& .MuiInputBase-input': { fontSize: '12px' }
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={12}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label="AR Address Line 2"
                                                name="address2"
                                                value={formData.billingInfo?.accountsReceivable?.address2 || ''}
                                                onChange={handleAccountsReceivableChange}
                                                sx={{
                                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                                    '& .MuiInputBase-input': { fontSize: '12px' }
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} md={4}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label="AR City"
                                                name="city"
                                                value={formData.billingInfo?.accountsReceivable?.city || ''}
                                                onChange={handleAccountsReceivableChange}
                                                sx={{
                                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                                    '& .MuiInputBase-input': { fontSize: '12px' }
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} md={4}>
                                            <FormControl fullWidth size="small">
                                                <InputLabel sx={{ fontSize: '12px' }}>
                                                    AR {getStateLabel(formData.billingInfo?.accountsReceivable?.country || 'CA')}
                                                </InputLabel>
                                                <Select
                                                    name="stateProv"
                                                    value={formData.billingInfo?.accountsReceivable?.stateProv || ''}
                                                    label={`AR ${getStateLabel(formData.billingInfo?.accountsReceivable?.country || 'CA')}`}
                                                    onChange={handleAccountsReceivableChange}
                                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                                >
                                                    {getStateOptions(formData.billingInfo?.accountsReceivable?.country || 'CA').map((option) => (
                                                        <MenuItem key={option.value} value={option.value} sx={{ fontSize: '12px' }}>
                                                            {option.label}
                                                        </MenuItem>
                                                    ))}
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        <Grid item xs={12} md={2}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label="AR Zip/Postal"
                                                name="zipPostal"
                                                value={formData.billingInfo?.accountsReceivable?.zipPostal || ''}
                                                onChange={handleAccountsReceivableChange}
                                                sx={{
                                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                                    '& .MuiInputBase-input': { fontSize: '12px' }
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} md={2}>
                                            <FormControl fullWidth size="small">
                                                <InputLabel sx={{ fontSize: '12px' }}>AR Country</InputLabel>
                                                <Select
                                                    name="country"
                                                    value={formData.billingInfo?.accountsReceivable?.country || 'CA'}
                                                    label="AR Country"
                                                    onChange={handleAccountsReceivableChange}
                                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                                >
                                                    <MenuItem value="CA" sx={{ fontSize: '12px' }}>Canada</MenuItem>
                                                    <MenuItem value="US" sx={{ fontSize: '12px' }}>United States</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                    </>
                                )}
                            </Grid>
                        )}

                        {/* Placeholder for other tabs - will implement incrementally */}
                        {currentTab === 2 && (
                            <Grid container spacing={3}>
                                <Grid item xs={12}>
                                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 2 }}>
                                        Theme & Branding
                                    </Typography>
                                </Grid>

                                {/* Multi-Logo Section */}
                                <Grid item xs={12}>
                                    <Box sx={{
                                        border: '2px dashed #e5e7eb',
                                        borderRadius: '8px',
                                        backgroundColor: '#f9fafb',
                                        overflow: 'hidden'
                                    }}>
                                        {/* Header */}
                                        <Box sx={{ p: 3, pb: 0 }}>
                                            <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                                Company Logos
                                            </Typography>
                                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', mb: 3 }}>
                                                Upload different versions of your company logo for various usage contexts
                                            </Typography>
                                        </Box>

                                        {/* Logo Tabs */}
                                        <Box sx={{ px: 3 }}>
                                            <Tabs
                                                value={activeLogoTab}
                                                onChange={(e, newValue) => setActiveLogoTab(newValue)}
                                                sx={{
                                                    '& .MuiTabs-indicator': { backgroundColor: '#7c3aed' },
                                                    '& .MuiTab-root': {
                                                        fontSize: '12px',
                                                        textTransform: 'none',
                                                        minWidth: 120,
                                                        '&.Mui-selected': { color: '#7c3aed' }
                                                    }
                                                }}
                                            >
                                                <Tab
                                                    label={
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            Dark Backgrounds
                                                            {logoPreviews.dark && <Chip size="small" label="✓" sx={{ height: 16, fontSize: '10px' }} />}
                                                        </Box>
                                                    }
                                                />
                                                <Tab
                                                    label={
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            Light Backgrounds
                                                            {logoPreviews.light && <Chip size="small" label="✓" sx={{ height: 16, fontSize: '10px' }} />}
                                                        </Box>
                                                    }
                                                />
                                                <Tab
                                                    label={
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            Circle Logo
                                                            {logoPreviews.circle && <Chip size="small" label="✓" sx={{ height: 16, fontSize: '10px' }} />}
                                                        </Box>
                                                    }
                                                />
                                                <Tab
                                                    label={
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            Invoice Logo
                                                            {logoPreviews.invoice && <Chip size="small" label="✓" sx={{ height: 16, fontSize: '10px' }} />}
                                                        </Box>
                                                    }
                                                />
                                                <Tab
                                                    label={
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            Document Logo
                                                            {logoPreviews.document && <Chip size="small" label="✓" sx={{ height: 16, fontSize: '10px' }} />}
                                                        </Box>
                                                    }
                                                />
                                                <Tab
                                                    label={
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            Email Logo
                                                            {logoPreviews.email && <Chip size="small" label="✓" sx={{ height: 16, fontSize: '10px' }} />}
                                                        </Box>
                                                    }
                                                />
                                            </Tabs>
                                        </Box>

                                        {/* Tab Content */}
                                        <Box sx={{ p: 3 }}>
                                            {renderLogoTab()}
                                        </Box>

                                        {/* Global Logo Guidelines */}
                                        <Box sx={{ px: 3, pb: 3 }}>
                                            <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', mb: 1 }}>
                                                <strong>Guidelines:</strong> • Recommended size: 400x400 pixels or larger • Supported formats: JPEG, PNG, GIF, WebP • Maximum file size: 5MB per logo
                                            </Typography>
                                        </Box>
                                    </Box>
                                </Grid>

                                {/* Brand Colors Section */}
                                <Grid item xs={12}>
                                    <Typography variant="subtitle1" sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                        Brand Colors
                                    </Typography>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6} md={4}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label="Primary Brand Color"
                                                value={formData.brandColors?.primary || '#3b82f6'}
                                                onChange={(e) => setFormData(prev => ({
                                                    ...prev,
                                                    brandColors: {
                                                        ...prev.brandColors,
                                                        primary: e.target.value
                                                    }
                                                }))}
                                                type="color"
                                                InputProps={{
                                                    sx: { fontSize: '12px' }
                                                }}
                                                InputLabelProps={{
                                                    sx: { fontSize: '12px' }
                                                }}
                                                helperText="Primary color for company branding"
                                                FormHelperTextProps={{
                                                    sx: { fontSize: '11px' }
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6} md={4}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label="Secondary Brand Color"
                                                value={formData.brandColors?.secondary || '#6b7280'}
                                                onChange={(e) => setFormData(prev => ({
                                                    ...prev,
                                                    brandColors: {
                                                        ...prev.brandColors,
                                                        secondary: e.target.value
                                                    }
                                                }))}
                                                type="color"
                                                InputProps={{
                                                    sx: { fontSize: '12px' }
                                                }}
                                                InputLabelProps={{
                                                    sx: { fontSize: '12px' }
                                                }}
                                                helperText="Secondary color for accents"
                                                FormHelperTextProps={{
                                                    sx: { fontSize: '11px' }
                                                }}
                                            />
                                        </Grid>
                                    </Grid>
                                </Grid>

                                {/* Email Templates Section */}
                                <Grid item xs={12}>
                                    <Typography variant="subtitle1" sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 2 }}>
                                        Email Template Settings
                                    </Typography>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label="Email Header Text"
                                                value={formData.emailSettings?.headerText || ''}
                                                onChange={(e) => setFormData(prev => ({
                                                    ...prev,
                                                    emailSettings: {
                                                        ...prev.emailSettings,
                                                        headerText: e.target.value
                                                    }
                                                }))}
                                                multiline
                                                rows={2}
                                                InputProps={{
                                                    sx: { fontSize: '12px' }
                                                }}
                                                InputLabelProps={{
                                                    sx: { fontSize: '12px' }
                                                }}
                                                helperText="Custom header text for company emails"
                                                FormHelperTextProps={{
                                                    sx: { fontSize: '11px' }
                                                }}
                                            />
                                        </Grid>
                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                label="Email Footer Text"
                                                value={formData.emailSettings?.footerText || ''}
                                                onChange={(e) => setFormData(prev => ({
                                                    ...prev,
                                                    emailSettings: {
                                                        ...prev.emailSettings,
                                                        footerText: e.target.value
                                                    }
                                                }))}
                                                multiline
                                                rows={2}
                                                InputProps={{
                                                    sx: { fontSize: '12px' }
                                                }}
                                                InputLabelProps={{
                                                    sx: { fontSize: '12px' }
                                                }}
                                                helperText="Custom footer text for company emails"
                                                FormHelperTextProps={{
                                                    sx: { fontSize: '11px' }
                                                }}
                                            />
                                        </Grid>
                                    </Grid>
                                </Grid>
                            </Grid>
                        )}

                        {currentTab === 3 && (
                            <Grid container spacing={3}>
                                {/* Available Service Levels Section */}
                                <Grid item xs={12}>
                                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 2 }}>
                                        Available Service Levels
                                    </Typography>
                                    <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                                        Configure service level restrictions for this company. When enabled, only selected service levels will be available when creating shipments.
                                    </Typography>

                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={formData.availableServiceLevels?.enabled || false}
                                                onChange={(e) => handleServiceLevelsToggle(e.target.checked)}
                                                size="small"
                                            />
                                        }
                                        label={
                                            <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                Enable service level restrictions
                                            </Typography>
                                        }
                                        sx={{ mb: 2 }}
                                    />

                                    {(formData.availableServiceLevels?.enabled || false) && (
                                        <Box sx={{ mt: 2 }}>
                                            {serviceLevelsLoading ? (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <CircularProgress size={16} />
                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                        Loading service levels...
                                                    </Typography>
                                                </Box>
                                            ) : (
                                                <>
                                                    {/* Freight Service Levels */}
                                                    <Typography variant="subtitle1" sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                        Freight Service Levels
                                                    </Typography>
                                                    <Grid container spacing={1} sx={{ mb: 3 }}>
                                                        {getFilteredServiceLevels('freight').map((serviceLevel) => (
                                                            <Grid item xs={12} sm={6} md={4} key={serviceLevel.id}>
                                                                <FormControlLabel
                                                                    control={
                                                                        <Checkbox
                                                                            checked={isServiceLevelSelected(serviceLevel, 'freight')}
                                                                            onChange={() => handleServiceLevelToggle(serviceLevel, 'freight')}
                                                                            size="small"
                                                                        />
                                                                    }
                                                                    label={
                                                                        <Box>
                                                                            <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                                {serviceLevel.label}
                                                                            </Typography>
                                                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                                {serviceLevel.description}
                                                                            </Typography>
                                                                        </Box>
                                                                    }
                                                                />
                                                            </Grid>
                                                        ))}
                                                    </Grid>

                                                    {/* Courier Service Levels */}
                                                    <Typography variant="subtitle1" sx={{ fontSize: '14px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                        Courier Service Levels
                                                    </Typography>
                                                    <Grid container spacing={1}>
                                                        {getFilteredServiceLevels('courier').map((serviceLevel) => (
                                                            <Grid item xs={12} sm={6} md={4} key={serviceLevel.id}>
                                                                <FormControlLabel
                                                                    control={
                                                                        <Checkbox
                                                                            checked={isServiceLevelSelected(serviceLevel, 'courier')}
                                                                            onChange={() => handleServiceLevelToggle(serviceLevel, 'courier')}
                                                                            size="small"
                                                                        />
                                                                    }
                                                                    label={
                                                                        <Box>
                                                                            <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                                {serviceLevel.label}
                                                                            </Typography>
                                                                            <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                                {serviceLevel.description}
                                                                            </Typography>
                                                                        </Box>
                                                                    }
                                                                />
                                                            </Grid>
                                                        ))}
                                                    </Grid>
                                                </>
                                            )}
                                        </Box>
                                    )}
                                </Grid>

                                {/* Additional Services Section */}
                                <Grid item xs={12}>
                                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 2, mt: 3 }}>
                                        Additional Services
                                    </Typography>
                                    <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                                        Configure additional service restrictions for this company. When enabled, only selected additional services will be available when creating shipments.
                                    </Typography>

                                    <FormControlLabel
                                        control={
                                            <Switch
                                                checked={formData.availableAdditionalServices?.enabled || false}
                                                onChange={(e) => handleAdditionalServicesToggle(e.target.checked)}
                                                size="small"
                                            />
                                        }
                                        label={
                                            <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                Enable additional service restrictions
                                            </Typography>
                                        }
                                        sx={{ mb: 2 }}
                                    />

                                    {(formData.availableAdditionalServices?.enabled || false) && (
                                        <Box sx={{ mt: 2 }}>
                                            {additionalServicesLoading ? (
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <CircularProgress size={16} />
                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                        Loading additional services...
                                                    </Typography>
                                                </Box>
                                            ) : (
                                                <Box>
                                                    {/* Tabs for Freight/Courier */}
                                                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                                                        <Tabs
                                                            value={activeAdditionalServiceTab}
                                                            onChange={(e, newValue) => setActiveAdditionalServiceTab(newValue)}
                                                            sx={{
                                                                '& .MuiTab-root': {
                                                                    fontSize: '12px',
                                                                    textTransform: 'none',
                                                                    minHeight: 36
                                                                }
                                                            }}
                                                        >
                                                            <Tab label="Freight Services" value="freight" />
                                                            <Tab label="Courier Services" value="courier" />
                                                        </Tabs>
                                                    </Box>

                                                    {/* Service Selection */}
                                                    <Box>
                                                        {globalAdditionalServices[activeAdditionalServiceTab]?.map((service) => {
                                                            const isSelected = isAdditionalServiceSelected(service, activeAdditionalServiceTab);
                                                            const isAutoSelected = isDefaultEnabledForService(service, activeAdditionalServiceTab);

                                                            return (
                                                                <Box key={service.id} sx={{ mb: 2 }}>
                                                                    <FormControlLabel
                                                                        control={
                                                                            <Checkbox
                                                                                checked={isSelected}
                                                                                onChange={() => handleAdditionalServiceToggle(service, activeAdditionalServiceTab)}
                                                                                size="small"
                                                                            />
                                                                        }
                                                                        label={
                                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                                <Box>
                                                                                    <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                                        {service.label || service.name}
                                                                                    </Typography>
                                                                                    <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                                        {service.description}
                                                                                    </Typography>
                                                                                </Box>
                                                                                {isAutoSelected && (
                                                                                    <Chip
                                                                                        label="Auto Selected"
                                                                                        size="small"
                                                                                        color="primary"
                                                                                        variant="outlined"
                                                                                        sx={{
                                                                                            fontSize: '10px',
                                                                                            height: '20px',
                                                                                            '& .MuiChip-label': { px: 1 }
                                                                                        }}
                                                                                    />
                                                                                )}
                                                                            </Box>
                                                                        }
                                                                        sx={{
                                                                            width: '100%',
                                                                            alignItems: 'flex-start',
                                                                            ml: 0,
                                                                            mr: 0
                                                                        }}
                                                                    />

                                                                    {/* Expandable Auto-Selected Section */}
                                                                    <Collapse in={isSelected}>
                                                                        <Box sx={{
                                                                            ml: 4,
                                                                            mt: 1,
                                                                            p: 2,
                                                                            bgcolor: '#f8fafc',
                                                                            borderRadius: 1,
                                                                            border: '1px solid #e2e8f0'
                                                                        }}>
                                                                            <FormControlLabel
                                                                                control={
                                                                                    <Checkbox
                                                                                        checked={isAutoSelected}
                                                                                        onChange={() => handleDefaultEnabledToggle(service, activeAdditionalServiceTab)}
                                                                                        size="small"
                                                                                        color="primary"
                                                                                    />
                                                                                }
                                                                                label={
                                                                                    <Box>
                                                                                        <Typography sx={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>
                                                                                            Auto Selected
                                                                                        </Typography>
                                                                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                                                            Automatically select this service when creating shipments for this company
                                                                                        </Typography>
                                                                                    </Box>
                                                                                }
                                                                                sx={{ mt: 0.5 }}
                                                                            />
                                                                        </Box>
                                                                    </Collapse>
                                                                </Box>
                                                            );
                                                        })}
                                                    </Box>
                                                </Box>
                                            )}
                                        </Box>
                                    )}
                                </Grid>
                            </Grid>
                        )}

                        {currentTab === 4 && (
                            <Grid container spacing={3}>
                                <Grid item xs={12}>
                                    <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 2 }}>
                                        Company Admins
                                    </Typography>
                                    <Autocomplete
                                        multiple
                                        size="small"
                                        id="company-adminUserIds-autocomplete"
                                        options={allUsers}
                                        getOptionLabel={(option) => `${option.name} (${option.email || 'N/A'})`}
                                        value={allUsers.filter(u => formData.adminUserIdsForForm.includes(u.id))}
                                        onChange={(event, newValue) => handleAutocompleteChange('adminUserIdsForForm', newValue)}
                                        filterSelectedOptions
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                variant="outlined"
                                                label="Select Company Admins"
                                                placeholder="Users who can manage this company's settings/users"
                                                sx={{
                                                    '& .MuiInputLabel-root': { fontSize: '12px' },
                                                    '& .MuiInputBase-input': { fontSize: '12px' }
                                                }}
                                            />
                                        )}
                                        isOptionEqualToValue={(option, value) => option.id === value.id}
                                    />
                                </Grid>
                            </Grid>
                        )}
                    </Paper>
                </Box>
            </Box>

            {/* Action Menu */}
            <Menu
                anchorEl={actionMenuAnchor}
                open={Boolean(actionMenuAnchor)}
                onClose={handleActionMenuClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'right',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'right',
                }}
            >
                <MenuItem onClick={handleDeleteClick} sx={{ color: '#dc2626', fontSize: '12px' }}>
                    <ListItemIcon>
                        <DeleteIcon sx={{ fontSize: '16px', color: '#dc2626' }} />
                    </ListItemIcon>
                    <ListItemText
                        primary="Delete Company"
                        sx={{
                            '& .MuiListItemText-primary': {
                                fontSize: '12px'
                            }
                        }}
                    />
                </MenuItem>
            </Menu>

            {/* Delete Confirmation Dialog */}
            <Dialog
                open={deleteConfirmOpen}
                onClose={() => setDeleteConfirmOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                    Delete Company
                </DialogTitle>
                <DialogContent>
                    <DialogContentText sx={{ fontSize: '12px', color: '#6b7280', mb: 2 }}>
                        Are you sure you want to permanently delete <strong>{formData.name}</strong>?
                    </DialogContentText>
                    <DialogContentText sx={{ fontSize: '12px', color: '#dc2626' }}>
                        ⚠️ This action cannot be undone. All company data, contacts, and associated records will be permanently removed.
                    </DialogContentText>
                </DialogContent>
                <DialogActions sx={{ p: 3, gap: 1 }}>
                    <Button
                        onClick={() => setDeleteConfirmOpen(false)}
                        variant="outlined"
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleDeleteCompany}
                        variant="contained"
                        color="error"
                        size="small"
                        startIcon={<DeleteIcon />}
                        disabled={saveLoading}
                        sx={{ fontSize: '12px' }}
                    >
                        {saveLoading ? <CircularProgress size={16} color="inherit" /> : 'Delete Company'}
                    </Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
};

export default CompanyForm;
