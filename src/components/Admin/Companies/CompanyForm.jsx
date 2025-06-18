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
    FormControlLabel
} from '@mui/material';
import {
    Close as CloseIcon,
    Add as AddIcon,
    Save as SaveIcon,
    Edit as EditIcon,
    DeleteOutline as DeleteOutlineIcon
} from '@mui/icons-material';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, serverTimestamp, writeBatch, arrayUnion, arrayRemove, FieldValue } from 'firebase/firestore';
import { db } from '../../../firebase/firebase';
import { useSnackbar } from 'notistack';

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
        status: 'active',
        ownerID: '',
        adminUserIdsForForm: [],
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

    const [sameAsMainContact, setSameAsMainContact] = useState(false);

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

                setFormData(prev => ({
                    ...prev, // Keep any other existing form data if necessary, though most should come from DB
                    name: companyDataFromDb.name || '',
                    companyID: companyDataFromDb.companyID || '',
                    website: companyDataFromDb.website || '',
                    status: companyDataFromDb.status || 'active',
                    ownerID: companyDataFromDb.ownerID || '',
                    adminUserIdsForForm: currentCompanyAdminIds, // Set directly
                    mainContact: fetchedMainContact, // Set directly
                    billingAddress: fetchedBillingAddress,
                }));
                setOriginalAdminUserIds(currentCompanyAdminIds); // Keep this separate as it's for comparison on save

            } else {
                // For new companies, initialize formData with defaults
                setFormData({
                    name: '',
                    companyID: '',
                    website: '',
                    status: 'active',
                    ownerID: '',
                    adminUserIdsForForm: [],
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

    const validateForm = () => {
        if (!formData.name.trim() || !formData.companyID.trim() || !formData.ownerID) {
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

        const humanReadableCompanyID = formData.companyID.trim();

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

            const now = serverTimestamp();
            const companyDocRef = isEditMode && companyFirestoreId ? doc(db, 'companies', companyFirestoreId) : doc(collection(db, 'companies'));

            // Prepare company data, excluding mainContact and originAddresses from the direct company doc save
            const companyCoreData = {
                name: formData.name.trim(),
                companyID: humanReadableCompanyID,
                website: formData.website.trim(),
                status: formData.status,
                ownerID: formData.ownerID,
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
            if (formData.mainContact.address1.trim()) { // Check if there's actual address data
                const mainContactRef = formData.mainContact.id ? doc(db, 'addressBook', formData.mainContact.id) : doc(collection(db, 'addressBook'));
                const mainContactDataToSave = {
                    ...formData.mainContact,
                    addressClass: 'company',
                    addressClassID: humanReadableCompanyID,
                    addressType: 'contact',
                    companyName: formData.name.trim(),
                    updatedAt: now,
                    ...(formData.mainContact.id ? {} : { createdAt: now })
                };
                batch.set(mainContactRef, mainContactDataToSave, { merge: Boolean(formData.mainContact.id) });
            }

            // Save billing address to addressBook
            if (formData.billingAddress.address1.trim()) {
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
                    companyName: formData.name.trim(),
                    updatedAt: now,
                    ...(billingId ? {} : { createdAt: now })
                };
                delete billingDataToSave.id;
                batch.set(billingRef, billingDataToSave, { merge: Boolean(billingId) });
            }

            await batch.commit();
            setOriginalAdminUserIds(newAdminSelections);

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
            if (!formData.companyID.trim() || isEditMode) return;

            setIsCheckingCompanyId(true);
            try {
                const q = query(collection(db, 'companies'), where('companyID', '==', formData.companyID.trim()));
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
                        <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827', mb: 1 }}>
                            {isEditMode ? `Edit Company: ${formData.name || 'Loading...'}` : 'Add New Company'}
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                            {isEditMode ? 'Update company information and settings' : 'Create a new company profile'}
                        </Typography>
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