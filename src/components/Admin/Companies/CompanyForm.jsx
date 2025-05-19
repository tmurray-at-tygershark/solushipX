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
    Divider,
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
import './CompanyForm.css';
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
        },
        originAddresses: [],
    });
    const [originalAdminUserIds, setOriginalAdminUserIds] = useState([]);

    const [allUsers, setAllUsers] = useState([]);
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);

    // State for the single origin add/edit dialog
    const [isOriginFormDialogOpen, setIsOriginFormDialogOpen] = useState(false);
    const [editingOriginData, setEditingOriginData] = useState(null); // Holds the origin object for the dialog form
    const [editingOriginIndex, setEditingOriginIndex] = useState(null); // null for new, index for edit

    // State for delete confirmation dialog (can be a separate small dialog)
    const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
    const [originToDeleteIndex, setOriginToDeleteIndex] = useState(null);

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
                let fetchedOriginAddresses = [];
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

                    // Fetch origins
                    const originsQuery = query(
                        addressBookRef,
                        where('addressClass', '==', 'company'),
                        where('addressClassID', '==', companyDataFromDb.companyID),
                        where('addressType', '==', 'origin')
                    );
                    const originsSnapshot = await getDocs(originsQuery);
                    fetchedOriginAddresses = originsSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                    console.log("[fetchData] Fetched originAddresses from addressBook:", fetchedOriginAddresses);

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
                    status: companyDataFromDb.status || 'active',
                    ownerID: companyDataFromDb.ownerID || '',
                    adminUserIdsForForm: currentCompanyAdminIds, // Set directly
                    mainContact: fetchedMainContact, // Set directly
                    billingAddress: fetchedBillingAddress,
                    originAddresses: fetchedOriginAddresses.length > 0 ? fetchedOriginAddresses : [], // Set directly
                }));
                setOriginalAdminUserIds(currentCompanyAdminIds); // Keep this separate as it's for comparison on save

            } else {
                // For new companies, initialize formData with defaults
                setFormData({
                    name: '',
                    companyID: '',
                    status: 'active',
                    ownerID: '',
                    adminUserIdsForForm: [],
                    mainContact: { firstName: '', lastName: '', email: '', phone: '', address1: '', address2: '', city: '', stateProv: '', zipPostal: '', country: 'CA', nickname: 'Head Office', isDefault: true },
                    billingAddress: { firstName: '', lastName: '', email: '', phone: '', address1: '', address2: '', city: '', stateProv: '', zipPostal: '', country: 'CA', nickname: 'Head Office', isDefault: true },
                    originAddresses: []
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
    console.log("[CompanyForm Render] Current formData.originAddresses:", formData.originAddresses);
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

    const handleOriginChange = (index, field, value) => {
        setFormData(prev => ({
            ...prev,
            originAddresses: prev.originAddresses.map((origin, i) =>
                i === index ? { ...origin, [field]: value } : origin
            )
        }));
    };

    const addOrigin = () => {
        setFormData(prev => ({
            ...prev,
            originAddresses: [...prev.originAddresses, {
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                address1: '',
                address2: '',
                city: '',
                stateProv: '',
                zipPostal: '',
                country: 'CA',
                nickname: '',
                isDefault: false,
            }]
        }));
    };

    const removeOrigin = (index) => {
        setFormData(prev => ({
            ...prev,
            originAddresses: prev.originAddresses.filter((_, i) => i !== index)
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
            const now = serverTimestamp();
            const companyDocRef = isEditMode && companyFirestoreId ? doc(db, 'companies', companyFirestoreId) : doc(collection(db, 'companies'));

            // Prepare company data, excluding mainContact and originAddresses from the direct company doc save
            const companyCoreData = {
                name: formData.name.trim(),
                companyID: humanReadableCompanyID,
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

            // Save origin addresses to addressBook (from formData.originAddresses)
            // First, get existing origin IDs for this company from addressBook to handle deletes
            let existingOriginIdsInDb = [];
            if (isEditMode && humanReadableCompanyID) {
                const originsQuery = query(collection(db, 'addressBook'), where('addressClass', '==', 'company'), where('addressClassID', '==', humanReadableCompanyID), where('addressType', '==', 'origin'));
                const originsSnapshot = await getDocs(originsQuery);
                existingOriginIdsInDb = originsSnapshot.docs.map(d => d.id);
            }

            const currentOriginIdsInForm = formData.originAddresses.map(o => o.id).filter(id => !!id);

            // Delete origins from DB that are no longer in the form
            existingOriginIdsInDb.forEach(dbOriginId => {
                if (!currentOriginIdsInForm.includes(dbOriginId)) {
                    batch.delete(doc(db, 'addressBook', dbOriginId));
                }
            });

            for (const origin of formData.originAddresses) {
                if (origin.nickname.trim() || origin.address1.trim()) { // Only save if it has some data
                    const originDataForSave = {
                        ...origin,
                        addressClass: 'company',
                        addressClassID: humanReadableCompanyID,
                        addressType: 'origin',
                        companyName: formData.name.trim(),
                        updatedAt: now
                    };
                    let originDocRef;
                    if (origin.id) { // Existing origin being updated
                        originDocRef = doc(db, 'addressBook', origin.id);
                        batch.set(originDocRef, originDataForSave, { merge: true });
                    } else { // New origin being added
                        originDataForSave.createdAt = now;
                        originDocRef = doc(collection(db, 'addressBook'));
                        batch.set(originDocRef, originDataForSave);
                    }
                }
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

    const handleOpenOriginFormDialog = (originData = null, index = null) => {
        if (originData) {
            setEditingOriginData({ ...originData }); // Edit existing: pass a copy
            setEditingOriginIndex(index);
        } else {
            // Add new: set default structure
            setEditingOriginData({
                id: `temp-${Date.now()}`, // Temporary ID for new, will be replaced on save if saved to DB separately or handled by main form submit
                nickname: '',
                contactName: '', // Or separate firstName/lastName if preferred for origin contact
                email: '',
                phone: '',
                address1: '',
                address2: '',
                city: '',
                stateProv: '',
                zipPostal: '',
                country: 'CA', // Default country
            });
            setEditingOriginIndex(null); // Indicate it's a new one
        }
        setIsOriginFormDialogOpen(true);
    };

    const handleCloseOriginFormDialog = () => {
        setIsOriginFormDialogOpen(false);
        setEditingOriginData(null);
        setEditingOriginIndex(null);
    };

    const handleSaveOrigin = () => {
        if (!editingOriginData) return;

        // Basic Validation for the origin form dialog
        if (!editingOriginData.address1?.trim() || !editingOriginData.city?.trim() || !editingOriginData.zipPostal?.trim()) {
            enqueueSnackbar('For an origin, Address Line 1, City, and Zip/Postal Code are required.', { variant: 'warning' });
            return;
        }

        let updatedOrigins = [...(formData.originAddresses || [])];
        if (editingOriginIndex !== null && editingOriginIndex >= 0) { // Editing existing
            updatedOrigins[editingOriginIndex] = editingOriginData;
        } else { // Adding new
            updatedOrigins.push(editingOriginData);
        }
        setFormData(prev => ({ ...prev, originAddresses: updatedOrigins }));
        handleCloseOriginFormDialog();
        enqueueSnackbar(`Origin ${editingOriginIndex !== null && editingOriginIndex >= 0 ? 'updated' : 'added'} to list. Save company to persist.`, { variant: 'success' });
    };

    const handleOriginFormFieldChange = (e) => {
        if (!editingOriginData) return;
        const { name, value } = e.target;
        setEditingOriginData(prev => ({ ...prev, [name]: value }));
    };

    const requestDeleteOrigin = (index) => {
        setOriginToDeleteIndex(index);
        setDeleteConfirmOpen(true);
    };

    const confirmDeleteOrigin = () => {
        if (originToDeleteIndex !== null) {
            const updatedOrigins = formData.originAddresses.filter((_, i) => i !== originToDeleteIndex);
            setFormData(prev => ({ ...prev, originAddresses: updatedOrigins }));
        }
        setDeleteConfirmOpen(false);
        setOriginToDeleteIndex(null);
        enqueueSnackbar('Origin removed from list. Save company to persist changes.', { variant: 'info' });
    };

    const handleDeleteCompany = async () => {
        if (!companyFirestoreId || !formData.companyID) return;
        setSaveLoading(true);
        try {
            // 1. Delete company doc
            await deleteDoc(doc(db, 'companies', companyFirestoreId));
            // 2. Delete all addressBook records for this company (main contact, billing, origins)
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

    if (pageLoading && !initialLoadComplete && isEditMode) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><CircularProgress /></Box>;
    }

    return (
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
            {/* Combined Title, Breadcrumbs, and Actions Row */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3 }}>
                {/* Left side: Title and Breadcrumbs */}
                <Box>
                    <Typography variant="h4" component="h1" gutterBottom>
                        {isEditMode ? `Edit: ${formData.name || 'Company'}` : 'Add New Company'}
                    </Typography>
                    <Breadcrumbs aria-label="breadcrumb">
                        <RouterLink component={MuiLink} to="/admin" sx={{ textDecoration: 'none', color: 'inherit', '&:hover': { textDecoration: 'underline' } }}>
                            Admin
                        </RouterLink>
                        <RouterLink component={MuiLink} to="/admin/companies" sx={{ textDecoration: 'none', color: 'inherit', '&:hover': { textDecoration: 'underline' } }}>
                            Companies
                        </RouterLink>
                        {isEditMode && formData.name ? (
                            <RouterLink component={MuiLink} to={`/admin/companies/${companyFirestoreId}`} sx={{ textDecoration: 'none', color: 'inherit', '&:hover': { textDecoration: 'underline' } }}>
                                {formData.name}
                            </RouterLink>
                        ) : null}
                        <Typography color="text.primary">
                            {isEditMode ? 'Edit' : 'New Company'}
                        </Typography>
                    </Breadcrumbs>
                </Box>

                {/* Right side: Form Actions (Save/Cancel Buttons) */}
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: { xs: 2, sm: 0 } /* Add some top margin on small screens if buttons wrap */ }}>
                    <Button
                        onClick={() => navigate(isEditMode && companyFirestoreId ? `/admin/companies/${companyFirestoreId}` : '/admin/companies')}
                        variant="outlined"
                        color="inherit"
                        startIcon={<CloseIcon />}
                        disabled={saveLoading || pageLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        startIcon={<SaveIcon />}
                        disabled={saveLoading || pageLoading}
                        form="company-form-id" // Associate with the form
                    >
                        {saveLoading ? <CircularProgress size={20} color="inherit" /> : (isEditMode ? 'Save Changes' : 'Create Company')}
                    </Button>
                </Box>
            </Box>

            <Paper component="form" id="company-form-id" onSubmit={handleSubmit} elevation={2} sx={{ p: { xs: 2, sm: 3 } }}>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <Typography variant="h6">Company Information</Typography>
                        <Divider sx={{ my: 1 }} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <TextField fullWidth label="Company Name" name="name" value={formData.name} onChange={handleCompanyDataChange} required />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <TextField fullWidth label="Company ID (Human-readable, e.g., COMPANY-NAME)" name="companyID" value={formData.companyID} onChange={handleCompanyDataChange} required disabled={isEditMode && formData.companyID !== ''} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <FormControl fullWidth required>
                            <InputLabel>Status</InputLabel>
                            <Select name="status" value={formData.status} label="Status" onChange={handleCompanyDataChange}>
                                <MenuItem value="active">Active</MenuItem>
                                <MenuItem value="inactive">Inactive</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <Autocomplete
                            options={allUsers}
                            getOptionLabel={(option) => `${option.name} (${option.email || 'N/A'})`}
                            value={allUsers.find(u => u.id === formData.ownerID) || null}
                            onChange={(event, newValue) => handleAutocompleteChange('ownerID', newValue)}
                            isOptionEqualToValue={(option, value) => option.id === value.id}
                            renderInput={(params) => <TextField {...params} label="Company Owner" required />}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <Typography variant="h6" sx={{ mt: 2 }}>Company Admins</Typography>
                        <Divider sx={{ my: 1 }} />
                        <Autocomplete
                            multiple
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
                                />
                            )}
                            isOptionEqualToValue={(option, value) => option.id === value.id}
                        />
                    </Grid>

                    {/* Main Contact Fields */}
                    <Grid item xs={12}><Typography variant="h6" sx={{ mt: 2 }}>Main Contact</Typography><Divider sx={{ my: 1 }} /></Grid>
                    <Grid item xs={12} md={6}><TextField fullWidth label="Contact First Name" name="firstName" value={formData.mainContact.firstName || ''} onChange={handleMainContactChange} /></Grid>
                    <Grid item xs={12} md={6}><TextField fullWidth label="Contact Last Name" name="lastName" value={formData.mainContact.lastName || ''} onChange={handleMainContactChange} /></Grid>
                    <Grid item xs={12} md={6}><TextField fullWidth label="Contact Email" name="email" type="email" value={formData.mainContact.email || ''} onChange={handleMainContactChange} /></Grid>
                    <Grid item xs={12} md={6}><TextField fullWidth label="Contact Phone" name="phone" value={formData.mainContact.phone || ''} onChange={handleMainContactChange} /></Grid>
                    <Grid item xs={12}><TextField fullWidth label="Address Line 1" name="address1" value={formData.mainContact.address1 || ''} onChange={handleMainContactChange} /></Grid>
                    <Grid item xs={12}><TextField fullWidth label="Address Line 2" name="address2" value={formData.mainContact.address2 || ''} onChange={handleMainContactChange} /></Grid>
                    <Grid item xs={12} md={4}><TextField fullWidth label="City" name="city" value={formData.mainContact.city || ''} onChange={handleMainContactChange} /></Grid>
                    <Grid item xs={12} md={3}><TextField fullWidth label="State/Province" name="stateProv" value={formData.mainContact.stateProv || ''} onChange={handleMainContactChange} /></Grid>
                    <Grid item xs={12} md={3}><TextField fullWidth label="Zip/Postal Code" name="zipPostal" value={formData.mainContact.zipPostal || ''} onChange={handleMainContactChange} /></Grid>
                    <Grid item xs={12} md={2}>
                        <FormControl fullWidth>
                            <InputLabel>Country</InputLabel>
                            <Select name="country" value={formData.mainContact.country || 'CA'} label="Country" onChange={handleMainContactChange}>
                                <MenuItem value="CA">Canada</MenuItem>
                                <MenuItem value="US">United States</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>

                    {/* Billing Address Section */}
                    <Grid item xs={12}>
                        <Typography variant="h6" sx={{ mt: 2 }}>Billing Address</Typography>
                        <Divider sx={{ my: 1 }} />
                        <FormControlLabel
                            control={
                                <Checkbox
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
                            label="Same as Main Contact"
                        />
                    </Grid>
                    {!sameAsMainContact && (
                        <>
                            <Grid item xs={12} md={6}><TextField fullWidth label="Billing First Name" name="firstName" value={formData.billingAddress.firstName || ''} onChange={handleBillingAddressChange} /></Grid>
                            <Grid item xs={12} md={6}><TextField fullWidth label="Billing Last Name" name="lastName" value={formData.billingAddress.lastName || ''} onChange={handleBillingAddressChange} /></Grid>
                            <Grid item xs={12} md={6}><TextField fullWidth label="Billing Email" name="email" type="email" value={formData.billingAddress.email || ''} onChange={handleBillingAddressChange} /></Grid>
                            <Grid item xs={12} md={6}><TextField fullWidth label="Billing Phone" name="phone" value={formData.billingAddress.phone || ''} onChange={handleBillingAddressChange} /></Grid>
                            <Grid item xs={12}><TextField fullWidth label="Billing Address Line 1" name="address1" value={formData.billingAddress.address1 || ''} onChange={handleBillingAddressChange} /></Grid>
                            <Grid item xs={12}><TextField fullWidth label="Billing Address Line 2" name="address2" value={formData.billingAddress.address2 || ''} onChange={handleBillingAddressChange} /></Grid>
                            <Grid item xs={12} md={4}><TextField fullWidth label="Billing City" name="city" value={formData.billingAddress.city || ''} onChange={handleBillingAddressChange} /></Grid>
                            <Grid item xs={12} md={3}><TextField fullWidth label="Billing State/Province" name="stateProv" value={formData.billingAddress.stateProv || ''} onChange={handleBillingAddressChange} /></Grid>
                            <Grid item xs={12} md={3}><TextField fullWidth label="Billing Zip/Postal Code" name="zipPostal" value={formData.billingAddress.zipPostal || ''} onChange={handleBillingAddressChange} /></Grid>
                            <Grid item xs={12} md={2}>
                                <FormControl fullWidth>
                                    <InputLabel>Billing Country</InputLabel>
                                    <Select name="country" value={formData.billingAddress.country || 'CA'} label="Billing Country" onChange={handleBillingAddressChange}>
                                        <MenuItem value="CA">Canada</MenuItem>
                                        <MenuItem value="US">United States</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>
                        </>
                    )}

                    {/* Origin Addresses Section - Table with Add button */}
                    <Grid item xs={12} sx={{ mt: 2 }}>
                        <Typography variant="h6" component="div" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            Origin Addresses
                            <Button
                                variant="outlined"
                                startIcon={<AddIcon />}
                                onClick={() => handleOpenOriginFormDialog()} // Opens dialog for new origin
                            >
                                Add New Origin
                            </Button>
                        </Typography>
                        <Divider sx={{ my: 1 }} />
                        <TableContainer component={Paper} elevation={0} variant="outlined">
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 'medium' }}>Nickname</TableCell>
                                        <TableCell sx={{ fontWeight: 'medium' }}>Contact</TableCell>
                                        <TableCell sx={{ fontWeight: 'medium' }}>Address</TableCell>
                                        <TableCell sx={{ fontWeight: 'medium' }}>City</TableCell>
                                        <TableCell sx={{ fontWeight: 'medium' }}>State/Prov</TableCell>
                                        <TableCell sx={{ fontWeight: 'medium' }}>Zip/Postal</TableCell>
                                        <TableCell sx={{ fontWeight: 'medium' }}>Country</TableCell>
                                        <TableCell align="right" sx={{ fontWeight: 'medium' }}>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {formData.originAddresses && formData.originAddresses.length > 0 ? (
                                        formData.originAddresses.map((origin, index) => (
                                            <TableRow key={origin.id || `origin-${index}`} hover>
                                                <TableCell>{origin.nickname || '-'}</TableCell>
                                                <TableCell>{origin.contactName || `${origin.firstName || ''} ${origin.lastName || ''}`.trim() || '-'}</TableCell>
                                                <TableCell>{origin.address1 || '-'}</TableCell>
                                                <TableCell>{origin.city || '-'}</TableCell>
                                                <TableCell>{origin.stateProv || '-'}</TableCell>
                                                <TableCell>{origin.zipPostal || '-'}</TableCell>
                                                <TableCell>{origin.country || '-'}</TableCell>
                                                <TableCell align="right">
                                                    <IconButton size="small" onClick={() => handleOpenOriginFormDialog(origin, index)} aria-label="edit origin">
                                                        <EditIcon fontSize="inherit" />
                                                    </IconButton>
                                                    <IconButton size="small" onClick={() => requestDeleteOrigin(index)} aria-label="delete origin" sx={{ ml: 1 }}>
                                                        <DeleteOutlineIcon fontSize="inherit" />
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={8} align="center" sx={{ fontStyle: 'italic', color: 'text.secondary', py: 3 }}>
                                                No origin addresses defined. Click 'Add New Origin' to add one.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Grid>
                </Grid>
            </Paper>

            {/* Dialog for Adding/Editing a Single Origin Address */}
            {editingOriginData && (
                <Dialog open={isOriginFormDialogOpen} onClose={handleCloseOriginFormDialog} fullWidth maxWidth="md">
                    <DialogTitle>{editingOriginIndex !== null && editingOriginIndex >= 0 ? 'Edit Origin Address' : 'Add New Origin Address'}</DialogTitle>
                    <DialogContent dividers>
                        <Grid container spacing={2} sx={{ pt: 1 }}>
                            <Grid item xs={12} sm={6}><TextField fullWidth label="Nickname" name="nickname" value={editingOriginData.nickname || ''} onChange={handleOriginFormFieldChange} helperText="e.g., Main Warehouse, Downtown Branch" /></Grid>
                            <Grid item xs={12} sm={6}><TextField fullWidth label="Contact Name" name="contactName" value={editingOriginData.contactName || ''} onChange={handleOriginFormFieldChange} helperText="Full name of contact person" /></Grid>
                            <Grid item xs={12} sm={6}><TextField fullWidth label="Contact Email" name="email" type="email" value={editingOriginData.email || ''} onChange={handleOriginFormFieldChange} /></Grid>
                            <Grid item xs={12} sm={6}><TextField fullWidth label="Contact Phone" name="phone" value={editingOriginData.phone || ''} onChange={handleOriginFormFieldChange} /></Grid>
                            <Grid item xs={12}><TextField fullWidth label="Address Line 1" name="address1" value={editingOriginData.address1 || ''} onChange={handleOriginFormFieldChange} required error={!editingOriginData.address1?.trim()} /></Grid>
                            <Grid item xs={12}><TextField fullWidth label="Address Line 2" name="address2" value={editingOriginData.address2 || ''} onChange={handleOriginFormFieldChange} /></Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth label="City" name="city" value={editingOriginData.city || ''} onChange={handleOriginFormFieldChange} required error={!editingOriginData.city?.trim()} /></Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth label="State/Province" name="stateProv" value={editingOriginData.stateProv || ''} onChange={handleOriginFormFieldChange} /></Grid>
                            <Grid item xs={12} sm={4}><TextField fullWidth label="Zip/Postal Code" name="zipPostal" value={editingOriginData.zipPostal || ''} onChange={handleOriginFormFieldChange} required error={!editingOriginData.zipPostal?.trim()} /></Grid>
                            <Grid item xs={12}>
                                <FormControl fullWidth>
                                    <InputLabel>Country</InputLabel>
                                    <Select name="country" value={editingOriginData.country || 'CA'} label="Country" onChange={handleOriginFormFieldChange}>
                                        <MenuItem value="US">United States</MenuItem>
                                        <MenuItem value="CA">Canada</MenuItem>
                                        {/* Add more common countries or use an Autocomplete with a larger list */}
                                    </Select>
                                </FormControl>
                            </Grid>
                        </Grid>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={handleCloseOriginFormDialog}>Cancel</Button>
                        <Button onClick={handleSaveOrigin} variant="contained" startIcon={<SaveIcon />}>Save Origin</Button>
                    </DialogActions>
                </Dialog>
            )}

            {/* Confirmation Dialog for Deleting Origin */}
            <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs">
                <DialogTitle>Confirm Delete</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to remove this origin address from the list? Changes will apply when you save the company.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
                    <Button onClick={confirmDeleteOrigin} color="error">Delete from List</Button>
                </DialogActions>
            </Dialog>

            {/* Confirmation Dialog for Deleting the Company */}
            {isEditMode && (
                <Box sx={{ mt: 6, display: 'flex', justifyContent: 'flex-end' }}>
                    <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteOutlineIcon />}
                        onClick={() => setDeleteConfirmOpen(true)}
                        disabled={saveLoading || pageLoading}
                    >
                        Delete Company
                    </Button>
                </Box>
            )}

            <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)} maxWidth="xs">
                <DialogTitle>Delete Company</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to mark this company as deleted? This will set its status to 'deleted' but will not remove any records. This action can be undone by changing the status later.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteConfirmOpen(false)} disabled={saveLoading}>Cancel</Button>
                    <Button onClick={async () => {
                        setSaveLoading(true);
                        try {
                            await updateDoc(doc(db, 'companies', companyFirestoreId), { status: 'deleted' });
                            enqueueSnackbar('Company marked as deleted.', { variant: 'success' });
                            navigate(`/admin/companies/${companyFirestoreId}`);
                        } catch (err) {
                            enqueueSnackbar('Error marking company as deleted: ' + err.message, { variant: 'error' });
                        } finally {
                            setSaveLoading(false);
                            setDeleteConfirmOpen(false);
                        }
                    }} color="error" disabled={saveLoading}>Mark as Deleted</Button>
                </DialogActions>
            </Dialog>

        </Box>
    );
};

export default CompanyForm; 