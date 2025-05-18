import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import {
    Close as CloseIcon,
    Add as AddIcon,
    Remove as RemoveIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../firebase/firebase';
import './CompanyForm.css';

const CompanyForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    const [companyData, setCompanyData] = useState({
        name: '',
        companyID: '',
        status: 'active',
    });

    const [mainContact, setMainContact] = useState({
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
        nickname: 'Head Office',
        isDefault: true,
    });

    const [origins, setOrigins] = useState([{
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
    }]);

    useEffect(() => {
        const loadCompanyData = async () => {
            if (id) {
                try {
                    setLoading(true);
                    // Load company details
                    const companyDoc = await getDoc(doc(db, 'companies', id));
                    if (!companyDoc.exists()) {
                        throw new Error('Company not found');
                    }
                    setCompanyData({ id: companyDoc.id, ...companyDoc.data() });

                    // Load main contact
                    const addressBookRef = collection(db, 'addressBook');
                    const mainContactQuery = query(
                        addressBookRef,
                        where('addressClass', '==', 'company'),
                        where('addressClassID', '==', companyDoc.data().companyID),
                        where('addressType', '==', 'contact')
                    );
                    const mainContactSnapshot = await getDocs(mainContactQuery);
                    if (!mainContactSnapshot.empty) {
                        setMainContact({ id: mainContactSnapshot.docs[0].id, ...mainContactSnapshot.docs[0].data() });
                    }

                    // Load origins
                    const originsQuery = query(
                        addressBookRef,
                        where('addressClass', '==', 'company'),
                        where('addressClassID', '==', companyDoc.data().companyID),
                        where('addressType', '==', 'origin')
                    );
                    const originsSnapshot = await getDocs(originsQuery);
                    const originsData = originsSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    setOrigins(originsData.length > 0 ? originsData : [{
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
                    }]);

                    setLoading(false);
                } catch (err) {
                    console.error('Error loading company data:', err);
                    setError(err.message);
                    setLoading(false);
                }
            }
        };

        loadCompanyData();
    }, [id]);

    const handleCompanyChange = (e) => {
        const { name, value } = e.target;
        setCompanyData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleMainContactChange = (e) => {
        const { name, value } = e.target;
        setMainContact(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleOriginChange = (index, field, value) => {
        setOrigins(prev => prev.map((origin, i) =>
            i === index ? { ...origin, [field]: value } : origin
        ));
    };

    const addOrigin = () => {
        setOrigins(prev => [...prev, {
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
        }]);
    };

    const removeOrigin = (index) => {
        setOrigins(prev => prev.filter((_, i) => i !== index));
    };

    const validateForm = () => {
        if (!companyData.name.trim()) {
            setError('Company name is required');
            return false;
        }
        if (!companyData.companyID.trim()) {
            setError('Company ID is required');
            return false;
        }
        if (!mainContact.firstName.trim() || !mainContact.lastName.trim()) {
            setError('Main contact name is required');
            return false;
        }
        if (!mainContact.email.trim()) {
            setError('Main contact email is required');
            return false;
        }
        if (!mainContact.address1.trim() || !mainContact.city.trim() || !mainContact.stateProv.trim() || !mainContact.zipPostal.trim()) {
            setError('Main contact address is required');
            return false;
        }
        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        try {
            setLoading(true);
            setError(null);
            setSuccess(false);

            const now = new Date();
            const companyRef = id ? doc(db, 'companies', id) : doc(collection(db, 'companies'));
            const companyDataToSave = {
                ...companyData,
                updatedAt: now,
            };

            if (!id) {
                companyDataToSave.createdAt = now;
            }

            await setDoc(companyRef, companyDataToSave);

            // Save main contact
            const mainContactRef = mainContact.id ? doc(db, 'addressBook', mainContact.id) : doc(collection(db, 'addressBook'));
            const mainContactData = {
                ...mainContact,
                addressClass: 'company',
                addressClassID: companyData.companyID,
                addressType: 'contact',
                companyName: companyData.name,
                updatedAt: now,
            };

            if (!mainContact.id) {
                mainContactData.createdAt = now;
            }

            await setDoc(mainContactRef, mainContactData);

            // Save origins
            for (const origin of origins) {
                if (origin.id) {
                    await updateDoc(doc(db, 'addressBook', origin.id), {
                        ...origin,
                        addressClass: 'company',
                        addressClassID: companyData.companyID,
                        addressType: 'origin',
                        companyName: companyData.name,
                        updatedAt: now,
                    });
                } else {
                    await addDoc(collection(db, 'addressBook'), {
                        ...origin,
                        addressClass: 'company',
                        addressClassID: companyData.companyID,
                        addressType: 'origin',
                        companyName: companyData.name,
                        createdAt: now,
                        updatedAt: now,
                    });
                }
            }

            setSuccess(true);
            setLoading(false);
            navigate('/admin/companies');
        } catch (err) {
            console.error('Error saving company:', err);
            setError(err.message);
            setLoading(false);
        }
    };

    if (loading) {
        return <Box className="admin-company-form">Loading...</Box>;
    }

    return (
        <Box className="admin-company-form">
            <Paper className="company-form-paper">
                <Box className="form-header">
                    <Typography variant="h4" className="form-title">
                        {id ? 'Edit Company' : 'Add New Company'}
                    </Typography>
                    <Tooltip title="Close">
                        <IconButton onClick={() => navigate('/admin/companies')} size="small">
                            <CloseIcon />
                        </IconButton>
                    </Tooltip>
                </Box>

                {error && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                        {error}
                    </Alert>
                )}

                {success && (
                    <Alert severity="success" sx={{ mb: 3 }}>
                        Company saved successfully!
                    </Alert>
                )}

                <form onSubmit={handleSubmit}>
                    <Grid container spacing={3}>
                        {/* Company Information */}
                        <Grid item xs={12}>
                            <Typography variant="h6" className="section-title">
                                Company Information
                            </Typography>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Company Name"
                                name="name"
                                value={companyData.name}
                                onChange={handleCompanyChange}
                                required
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Company ID"
                                name="companyID"
                                value={companyData.companyID}
                                onChange={handleCompanyChange}
                                required
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth required>
                                <InputLabel>Status</InputLabel>
                                <Select
                                    name="status"
                                    value={companyData.status}
                                    onChange={handleCompanyChange}
                                    label="Status"
                                >
                                    <MenuItem value="active">Active</MenuItem>
                                    <MenuItem value="inactive">Inactive</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        {/* Main Contact */}
                        <Grid item xs={12}>
                            <Divider sx={{ my: 3 }} />
                            <Typography variant="h6" className="section-title">
                                Main Contact
                            </Typography>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="First Name"
                                name="firstName"
                                value={mainContact.firstName}
                                onChange={handleMainContactChange}
                                required
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Last Name"
                                name="lastName"
                                value={mainContact.lastName}
                                onChange={handleMainContactChange}
                                required
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Email"
                                name="email"
                                type="email"
                                value={mainContact.email}
                                onChange={handleMainContactChange}
                                required
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Phone"
                                name="phone"
                                value={mainContact.phone}
                                onChange={handleMainContactChange}
                                required
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Address Line 1"
                                name="address1"
                                value={mainContact.address1}
                                onChange={handleMainContactChange}
                                required
                            />
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Address Line 2"
                                name="address2"
                                value={mainContact.address2}
                                onChange={handleMainContactChange}
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="City"
                                name="city"
                                value={mainContact.city}
                                onChange={handleMainContactChange}
                                required
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="State/Province"
                                name="stateProv"
                                value={mainContact.stateProv}
                                onChange={handleMainContactChange}
                                required
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Postal Code"
                                name="zipPostal"
                                value={mainContact.zipPostal}
                                onChange={handleMainContactChange}
                                required
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Country"
                                name="country"
                                value={mainContact.country}
                                onChange={handleMainContactChange}
                                required
                            />
                        </Grid>

                        {/* Origin Addresses */}
                        <Grid item xs={12}>
                            <Divider sx={{ my: 3 }} />
                            <Box className="origins-header">
                                <Typography variant="h6" className="section-title">
                                    Origin Addresses
                                </Typography>
                                <Button
                                    startIcon={<AddIcon />}
                                    onClick={addOrigin}
                                    className="add-origin-btn"
                                >
                                    Add Origin
                                </Button>
                            </Box>
                        </Grid>

                        {origins.map((origin, index) => (
                            <Grid item xs={12} key={index}>
                                <Paper className="origin-card">
                                    <Box className="origin-header">
                                        <Typography variant="subtitle1">
                                            Origin {index + 1}
                                        </Typography>
                                        {origins.length > 1 && (
                                            <IconButton
                                                size="small"
                                                onClick={() => removeOrigin(index)}
                                                className="remove-origin-btn"
                                            >
                                                <RemoveIcon />
                                            </IconButton>
                                        )}
                                    </Box>

                                    <Grid container spacing={2}>
                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                fullWidth
                                                label="Nickname"
                                                value={origin.nickname}
                                                onChange={(e) => handleOriginChange(index, 'nickname', e.target.value)}
                                                required
                                            />
                                        </Grid>

                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                fullWidth
                                                label="First Name"
                                                value={origin.firstName}
                                                onChange={(e) => handleOriginChange(index, 'firstName', e.target.value)}
                                                required
                                            />
                                        </Grid>

                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                fullWidth
                                                label="Last Name"
                                                value={origin.lastName}
                                                onChange={(e) => handleOriginChange(index, 'lastName', e.target.value)}
                                                required
                                            />
                                        </Grid>

                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                fullWidth
                                                label="Email"
                                                type="email"
                                                value={origin.email}
                                                onChange={(e) => handleOriginChange(index, 'email', e.target.value)}
                                                required
                                            />
                                        </Grid>

                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                fullWidth
                                                label="Phone"
                                                value={origin.phone}
                                                onChange={(e) => handleOriginChange(index, 'phone', e.target.value)}
                                                required
                                            />
                                        </Grid>

                                        <Grid item xs={12}>
                                            <TextField
                                                fullWidth
                                                label="Address Line 1"
                                                value={origin.address1}
                                                onChange={(e) => handleOriginChange(index, 'address1', e.target.value)}
                                                required
                                            />
                                        </Grid>

                                        <Grid item xs={12}>
                                            <TextField
                                                fullWidth
                                                label="Address Line 2"
                                                value={origin.address2}
                                                onChange={(e) => handleOriginChange(index, 'address2', e.target.value)}
                                            />
                                        </Grid>

                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                fullWidth
                                                label="City"
                                                value={origin.city}
                                                onChange={(e) => handleOriginChange(index, 'city', e.target.value)}
                                                required
                                            />
                                        </Grid>

                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                fullWidth
                                                label="State/Province"
                                                value={origin.stateProv}
                                                onChange={(e) => handleOriginChange(index, 'stateProv', e.target.value)}
                                                required
                                            />
                                        </Grid>

                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                fullWidth
                                                label="Postal Code"
                                                value={origin.zipPostal}
                                                onChange={(e) => handleOriginChange(index, 'zipPostal', e.target.value)}
                                                required
                                            />
                                        </Grid>

                                        <Grid item xs={12} md={6}>
                                            <TextField
                                                fullWidth
                                                label="Country"
                                                value={origin.country}
                                                onChange={(e) => handleOriginChange(index, 'country', e.target.value)}
                                                required
                                            />
                                        </Grid>
                                    </Grid>
                                </Paper>
                            </Grid>
                        ))}

                        {/* Form Actions */}
                        <Grid item xs={12}>
                            <Stack direction="row" spacing={2} justifyContent="flex-end">
                                <Button
                                    variant="outlined"
                                    onClick={() => navigate('/admin/companies')}
                                    className="cancel-btn"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    className="submit-btn"
                                    disabled={loading}
                                >
                                    {id ? 'Update Company' : 'Create Company'}
                                </Button>
                            </Stack>
                        </Grid>
                    </Grid>
                </form>
            </Paper>
        </Box>
    );
};

export default CompanyForm; 