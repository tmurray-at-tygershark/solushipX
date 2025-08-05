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
    Chip
} from '@mui/material';
import {
    Close as CloseIcon,
    Add as AddIcon,
    Save as SaveIcon,
    Edit as EditIcon,
    DeleteOutline as DeleteOutlineIcon,
    CloudUpload as CloudUploadIcon,
    Delete as DeleteIcon,
    Business as BusinessIcon
} from '@mui/icons-material';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch, arrayUnion, arrayRemove, FieldValue } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject, getStorage } from 'firebase/storage';
import { getApp } from 'firebase/app';
import { db } from '../../../firebase/firebase';
import { useSnackbar } from 'notistack';
import AdminBreadcrumb from '../AdminBreadcrumb';

const CompanyForm = () => {
    const { id: companyFirestoreId } = useParams();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();
    const isEditMode = Boolean(companyFirestoreId);

    const [pageLoading, setPageLoading] = useState(isEditMode);
    const [saveLoading, setSaveLoading] = useState(false);
    const [error, setError] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        companyID: '',
        website: '',
        logoUrl: '', // Legacy field for backward compatibility
        logos: {
            dark: '', // Dark background logo URL
            light: '', // Light background logo URL
            circle: '' // Circle logo URL
        },
        status: 'active',
        ownerID: '',
        adminUserIdsForForm: [],
        availableServiceLevels: {
            enabled: false, // If false, all service levels are available (default)
            freight: [], // Array of enabled freight service level codes
            courier: [] // Array of enabled courier service level codes
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
        }
    });
    const [originalAdminUserIds, setOriginalAdminUserIds] = useState([]);
    const [companyIdError, setCompanyIdError] = useState('');
    const [isCheckingCompanyId, setIsCheckingCompanyId] = useState(false);

    const [allUsers, setAllUsers] = useState([]);
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);

    // State for delete confirmation dialog
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

    // State for Service Levels Management
    const [globalServiceLevels, setGlobalServiceLevels] = useState([]);
    const [serviceLevelsLoading, setServiceLevelsLoading] = useState(false);
    const [activeServiceLevelTab, setActiveServiceLevelTab] = useState('freight');

    const [sameAsMainContact, setSameAsMainContact] = useState(false);

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

    // Multi-logo upload state
    const [selectedLogos, setSelectedLogos] = useState({
        dark: null,
        light: null,
        circle: null
    });
    const [logoPreviews, setLogoPreviews] = useState({
        dark: null,
        light: null,
        circle: null
    });
    const [logoErrors, setLogoErrors] = useState({
        dark: '',
        light: '',
        circle: ''
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

            // Load global service levels for admin management
            await loadGlobalServiceLevels();

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
                        circle: logos.circle || ''
                    },
                    status: companyDataFromDb.status || 'active',
                    ownerID: companyDataFromDb.ownerID || '',
                    adminUserIdsForForm: currentCompanyAdminIds, // Set directly
                    availableServiceLevels: companyDataFromDb.availableServiceLevels || {
                        enabled: false, // Default: all service levels available
                        freight: [],
                        courier: []
                    },
                    mainContact: fetchedMainContact, // Set directly
                    billingAddress: fetchedBillingAddress,
                }));

                // Set multi-logo previews
                setLogoPreviews({
                    dark: logos.dark || legacyLogo || null,
                    light: logos.light || null,
                    circle: logos.circle || null
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
            const updated = {
                ...prev,
                mainContact: { ...prev.mainContact, [name]: value }
            };
            if (!isEditMode && sameAsMainContact) {
                updated.billingAddress = { ...updated.mainContact };
            }
            return updated;
        });
    };

    const handleBillingAddressChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            billingAddress: { ...prev.billingAddress, [name]: value }
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
                circle: 'Circle Logo'
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
        const logoTypes = ['dark', 'light', 'circle'];
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

            for (const logoType of ['dark', 'light', 'circle']) {
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

    // Helper to compare main contact and billing address fields
    const isBillingSameAsMainContact = (main, billing) => {
        const keys = [
            'firstName', 'lastName', 'email', 'phone',
            'address1', 'address2', 'city', 'stateProv', 'zipPostal', 'country', 'nickname', 'isDefault'
        ];
        return keys.every(key => (main?.[key] || '') === (billing?.[key] || ''));
    };

    // Set sameAsMainContact to true by default on create, or on edit if billing matches main contact
    useEffect(() => {
        if (!isEditMode) {
            setSameAsMainContact(true);
        } else if (isEditMode && initialLoadComplete) {
            setSameAsMainContact(isBillingSameAsMainContact(formData.mainContact, formData.billingAddress));
        }
        // eslint-disable-next-line
    }, [isEditMode, initialLoadComplete]);

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
                            {saveLoading ? <CircularProgress size={16} color="inherit" /> : (isEditMode ? 'Save Changes' : 'Create Company')}
                        </Button>
                    </Box>
                </Box>
            </Box>

            {/* Form Section */}
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

                        <Grid container spacing={3}>
                            <Grid item xs={12}>
                                <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 2 }}>
                                    Company Information
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
                            <Grid item xs={12}>
                                <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 2, mt: 2 }}>
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

                            {/* Available Service Levels Section */}
                            <Grid item xs={12}>
                                <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 2, mt: 2 }}>
                                    Available Service Levels
                                </Typography>
                                <Box sx={{
                                    border: '2px dashed #e5e7eb',
                                    borderRadius: '8px',
                                    backgroundColor: '#f9fafb',
                                    overflow: 'hidden'
                                }}>
                                    {/* Header */}
                                    <Box sx={{ p: 3, pb: 0 }}>
                                        <Typography variant="body2" sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                            Service Level Restrictions
                                        </Typography>
                                        <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', mb: 3 }}>
                                            By default, this company has access to all service levels. Enable restrictions to limit available service levels.
                                        </Typography>

                                        <FormControlLabel
                                            control={
                                                <Switch
                                                    size="small"
                                                    checked={formData.availableServiceLevels.enabled}
                                                    onChange={(e) => handleServiceLevelsToggle(e.target.checked)}
                                                    sx={{
                                                        '& .MuiSwitch-switchBase.Mui-checked': {
                                                            color: '#7c3aed',
                                                        },
                                                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                                            backgroundColor: '#7c3aed',
                                                        },
                                                    }}
                                                />
                                            }
                                            label={
                                                <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                    Restrict available service levels for this company
                                                </Typography>
                                            }
                                        />
                                    </Box>

                                    {/* Service Level Selection - Only show when restrictions are enabled */}
                                    {formData.availableServiceLevels.enabled && (
                                        <Box sx={{ px: 3, pb: 3 }}>
                                            {serviceLevelsLoading ? (
                                                <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                                                    <CircularProgress size={24} sx={{ color: '#7c3aed' }} />
                                                </Box>
                                            ) : (
                                                <>
                                                    <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280', mb: 2 }}>
                                                        Select which service levels this company can use when creating shipments:
                                                    </Typography>

                                                    {/* Service Level Tabs */}
                                                    <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                                                        <Tabs
                                                            value={activeServiceLevelTab}
                                                            onChange={(e, newValue) => setActiveServiceLevelTab(newValue)}
                                                            sx={{
                                                                '& .MuiTabs-indicator': { backgroundColor: '#7c3aed' },
                                                                '& .MuiTab-root': {
                                                                    fontSize: '12px',
                                                                    textTransform: 'none',
                                                                    minWidth: 100,
                                                                    '&.Mui-selected': { color: '#7c3aed' }
                                                                }
                                                            }}
                                                        >
                                                            <Tab
                                                                label={`Freight (${getFilteredServiceLevels('freight').length})`}
                                                                value="freight"
                                                            />
                                                            <Tab
                                                                label={`Courier (${getFilteredServiceLevels('courier').length})`}
                                                                value="courier"
                                                            />
                                                        </Tabs>
                                                    </Box>

                                                    {/* Service Level Checkboxes */}
                                                    <Box sx={{ mt: 2 }}>
                                                        {getFilteredServiceLevels(activeServiceLevelTab).length > 0 ? (
                                                            <Grid container spacing={1}>
                                                                {getFilteredServiceLevels(activeServiceLevelTab).map((serviceLevel) => (
                                                                    <Grid item xs={12} sm={6} md={4} key={serviceLevel.id}>
                                                                        <FormControlLabel
                                                                            control={
                                                                                <Checkbox
                                                                                    size="small"
                                                                                    checked={isServiceLevelSelected(serviceLevel, activeServiceLevelTab)}
                                                                                    onChange={() => handleServiceLevelToggle(serviceLevel, activeServiceLevelTab)}
                                                                                    sx={{
                                                                                        '&.Mui-checked': {
                                                                                            color: '#7c3aed',
                                                                                        },
                                                                                    }}
                                                                                />
                                                                            }
                                                                            label={
                                                                                <Box>
                                                                                    <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                                                                        {serviceLevel.label}
                                                                                    </Typography>
                                                                                    <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                                                        {serviceLevel.code}
                                                                                    </Typography>
                                                                                    {serviceLevel.description && (
                                                                                        <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                                                            {serviceLevel.description}
                                                                                        </Typography>
                                                                                    )}
                                                                                </Box>
                                                                            }
                                                                        />
                                                                    </Grid>
                                                                ))}
                                                            </Grid>
                                                        ) : (
                                                            <Alert severity="info" sx={{ fontSize: '12px' }}>
                                                                No {activeServiceLevelTab} service levels configured.
                                                                Configure service levels in Admin → Configuration → Service Levels.
                                                            </Alert>
                                                        )}
                                                    </Box>

                                                    {/* Selection Summary */}
                                                    {(formData.availableServiceLevels.freight.length > 0 || formData.availableServiceLevels.courier.length > 0) && (
                                                        <Box sx={{ mt: 2, p: 2, bgcolor: '#f3f4f6', borderRadius: 1 }}>
                                                            <Typography sx={{ fontSize: '11px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                                Selected Service Levels:
                                                            </Typography>
                                                            {formData.availableServiceLevels.freight.length > 0 && (
                                                                <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                                    Freight: {formData.availableServiceLevels.freight.join(', ')}
                                                                </Typography>
                                                            )}
                                                            {formData.availableServiceLevels.courier.length > 0 && (
                                                                <Typography sx={{ fontSize: '10px', color: '#6b7280' }}>
                                                                    Courier: {formData.availableServiceLevels.courier.join(', ')}
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    )}
                                                </>
                                            )}
                                        </Box>
                                    )}
                                </Box>
                            </Grid>

                            {/* Main Contact Fields */}
                            <Grid item xs={12}>
                                <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 2, mt: 2 }}>
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
                                <TextField
                                    fullWidth
                                    size="small"
                                    label="State/Province"
                                    name="stateProv"
                                    value={formData.mainContact.stateProv || ''}
                                    onChange={handleMainContactChange}
                                    sx={{
                                        '& .MuiInputLabel-root': { fontSize: '12px' },
                                        '& .MuiInputBase-input': { fontSize: '12px' }
                                    }}
                                />
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

                            {/* Billing Address Section */}
                            <Grid item xs={12}>
                                <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 2, mt: 2 }}>
                                    Billing Address
                                </Typography>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            size="small"
                                            checked={sameAsMainContact}
                                            onChange={e => {
                                                setSameAsMainContact(e.target.checked);
                                                if (e.target.checked) {
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        billingAddress: Object.fromEntries(Object.entries(prev.mainContact).filter(([key]) => key !== 'id'))
                                                    }));
                                                }
                                            }}
                                        />
                                    }
                                    label={<Typography sx={{ fontSize: '12px' }}>Same as Main Contact</Typography>}
                                />
                            </Grid>
                            {!sameAsMainContact && (
                                <>
                                    <Grid item xs={12} md={6}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label="Billing First Name"
                                            name="firstName"
                                            value={formData.billingAddress.firstName || ''}
                                            onChange={handleBillingAddressChange}
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
                                            label="Billing Last Name"
                                            name="lastName"
                                            value={formData.billingAddress.lastName || ''}
                                            onChange={handleBillingAddressChange}
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
                                            label="Billing Email"
                                            name="email"
                                            type="email"
                                            value={formData.billingAddress.email || ''}
                                            onChange={handleBillingAddressChange}
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
                                            label="Billing Phone"
                                            name="phone"
                                            value={formData.billingAddress.phone || ''}
                                            onChange={handleBillingAddressChange}
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
                                            label="Billing Address Line 1"
                                            name="address1"
                                            value={formData.billingAddress.address1 || ''}
                                            onChange={handleBillingAddressChange}
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
                                            label="Billing Address Line 2"
                                            name="address2"
                                            value={formData.billingAddress.address2 || ''}
                                            onChange={handleBillingAddressChange}
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
                                            label="Billing City"
                                            name="city"
                                            value={formData.billingAddress.city || ''}
                                            onChange={handleBillingAddressChange}
                                            sx={{
                                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                                '& .MuiInputBase-input': { fontSize: '12px' }
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label="Billing State/Province"
                                            name="stateProv"
                                            value={formData.billingAddress.stateProv || ''}
                                            onChange={handleBillingAddressChange}
                                            sx={{
                                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                                '& .MuiInputBase-input': { fontSize: '12px' }
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={3}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label="Billing Zip/Postal Code"
                                            name="zipPostal"
                                            value={formData.billingAddress.zipPostal || ''}
                                            onChange={handleBillingAddressChange}
                                            sx={{
                                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                                '& .MuiInputBase-input': { fontSize: '12px' }
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={2}>
                                        <FormControl fullWidth size="small">
                                            <InputLabel sx={{ fontSize: '12px' }}>Billing Country</InputLabel>
                                            <Select
                                                name="country"
                                                value={formData.billingAddress.country || 'CA'}
                                                label="Billing Country"
                                                onChange={handleBillingAddressChange}
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
                    </Paper>
                </Box>
            </Box>

            {/* Delete Company Section for Edit Mode */}
            {isEditMode && (
                <Box sx={{ p: 3, borderTop: '1px solid #e5e7eb', mt: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 1 }}>
                                Delete Company
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                                Permanently delete this company and all associated data
                            </Typography>
                        </Box>
                        <Button
                            variant="outlined"
                            color="error"
                            size="small"
                            startIcon={<DeleteOutlineIcon />}
                            onClick={handleDeleteCompany}
                            disabled={saveLoading || pageLoading}
                            sx={{ fontSize: '12px' }}
                        >
                            Delete Company
                        </Button>
                    </Box>
                </Box>
            )}

        </Box>
    );
};

export default CompanyForm; 