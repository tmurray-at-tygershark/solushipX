import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import {
    Box,
    Grid,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormHelperText,
    Autocomplete,
    Button,
    Paper,
    Typography,
    Breadcrumbs,
    CircularProgress
} from '@mui/material';
import { collection, addDoc, updateDoc, doc, getDoc, getDocs, query, where, setDoc } from 'firebase/firestore';
import { db, auth, functions } from '../../../firebase';
import { updateProfile } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';

const UserForm = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEditMode = Boolean(id);

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        role: 'user',
        status: 'active',
        phone: '',
        companies: [],
    });
    const [allCompanies, setAllCompanies] = useState([]);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(isEditMode);
    const [formError, setFormError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        const fetchCompanies = async () => {
            try {
                const companiesRef = collection(db, 'companies');
                const q = query(companiesRef, where('status', '==', 'active'));
                const querySnapshot = await getDocs(q);
                const companiesData = querySnapshot.docs.map(doc => ({
                    id: doc.data().companyID,
                    name: doc.data().name,
                    firestoreId: doc.id
                }));
                setAllCompanies(companiesData);
            } catch (err) {
                console.error('Error fetching companies:', err);
                setFormError('Failed to load company list.');
            }
        };
        fetchCompanies();
    }, []);

    useEffect(() => {
        if (isEditMode) {
            setPageLoading(true);
            const fetchUser = async () => {
                try {
                    const userDocRef = doc(db, 'users', id);
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setFormData({
                            firstName: userData.firstName || '',
                            lastName: userData.lastName || '',
                            email: userData.email || '',
                            role: userData.role || 'user',
                            status: userData.status || 'active',
                            phone: userData.phone || '',
                            companies: userData.connectedCompanies?.companies || [],
                            password: '',
                        });
                    } else {
                        setFormError('User not found.');
                    }
                } catch (err) {
                    console.error('Error fetching user:', err);
                    setFormError('Failed to load user data.');
                } finally {
                    setPageLoading(false);
                }
            };
            fetchUser();
        }
    }, [id, isEditMode]);

    const validateForm = () => {
        const newErrors = {};
        if (!formData.firstName.trim()) newErrors.firstName = 'First Name is required';
        if (!formData.lastName.trim()) newErrors.lastName = 'Last Name is required';

        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Invalid email format';
        }

        if (!isEditMode) {
            if (!formData.password) {
                newErrors.password = 'Password is required';
            } else if (formData.password.length < 6) {
                newErrors.password = 'Password must be at least 6 characters';
            }
        }

        if (!formData.role) newErrors.role = 'Role is required';
        if (!formData.status) newErrors.status = 'Status is required';
        // Phone can be optional, remove if not required, or add specific validation
        // if (!formData.phone.trim()) newErrors.phone = 'Phone is required';

        // Ensure company selection is not explicitly required by validateForm
        // if (!formData.companies || formData.companies.length === 0) { 
        //     newErrors.companies = 'At least one company is required';
        // }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const handleCompaniesChange = (event, newValues) => {
        setFormData(prev => ({
            ...prev,
            companies: newValues.map(company => company.id)
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) {
            setFormError("Please correct the validation errors.");
            return;
        }

        setLoading(true);
        setFormError('');
        setSuccessMessage('');

        const { email, password, firstName, lastName, role, status, phone, companies } = formData;

        // --- BEGIN AUTH CHECK --- 
        const currentUser = auth.currentUser;
        if (!currentUser) {
            console.error("UserForm - handleSubmit: No currentUser found in auth.");
            setFormError("Not authenticated. Please sign in.");
            setLoading(false);
            return;
        }

        let idToken;
        try {
            // Force token refresh and get a fresh token
            idToken = await currentUser.getIdToken(true);
            console.log("UserForm - handleSubmit: Successfully refreshed auth token");
            console.log("UserForm - handleSubmit: Current User UID:", currentUser.uid);
        } catch (tokenError) {
            console.error("UserForm - handleSubmit: Error refreshing ID token:", tokenError);
            setFormError("Authentication error. Please try signing out and in again.");
            setLoading(false);
            return;
        }
        // --- END AUTH CHECK ---

        try {
            if (isEditMode) {
                const userDocRef = doc(db, 'users', id);
                const dataToUpdate = {
                    firstName,
                    lastName,
                    role,
                    status,
                    phone,
                    connectedCompanies: { companies },
                    updatedAt: new Date(),
                };
                await updateDoc(userDocRef, dataToUpdate);
                setSuccessMessage('User updated successfully!');
            } else {
                // Initialize the function with explicit auth token
                const adminCreateUserFn = httpsCallable(functions, 'adminCreateUser');

                // Call the function with the data
                const result = await adminCreateUserFn({
                    email,
                    password,
                    firstName,
                    lastName,
                    role,
                    status,
                    phone,
                    companies
                });

                if (result.data.status === "success") {
                    setSuccessMessage(result.data.message || 'User created successfully!');
                    setFormData({
                        firstName: '',
                        lastName: '',
                        email: '',
                        password: '',
                        role: 'user',
                        status: 'active',
                        phone: '',
                        companies: [],
                    });
                } else {
                    throw new Error(result.data.message || 'Failed to create user via cloud function.');
                }
            }

            setTimeout(() => {
                navigate('/admin/users');
            }, 1500);

        } catch (error) {
            console.error('Error saving user:', error);
            if (error.code && error.message) {
                setFormError(error.message);
                if (error.code === 'already-exists') {
                    setErrors(prev => ({ ...prev, email: error.message }));
                } else if (error.code === 'invalid-argument' && error.message.toLowerCase().includes('password')) {
                    setErrors(prev => ({ ...prev, password: error.message }));
                }
            } else {
                setFormError(error.message || 'Failed to save user. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    };

    if (pageLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
                <CircularProgress />
                <Typography sx={{ ml: 2 }}>Loading user data...</Typography>
            </Box>
        );
    }

    const selectedCompanyObjects = formData.companies
        .map(companyId => allCompanies.find(c => c.id === companyId))
        .filter(company => company !== undefined);

    return (
        <Box className="user-form-container" sx={{ p: 3 }}>
            <Paper sx={{ p: 3 }}>
                <Box sx={{ mb: 2 }}>
                    <Typography variant="h4" component="h1" gutterBottom>
                        {isEditMode ? `Edit User: ${formData.firstName} ${formData.lastName}` : 'Create New User'}
                    </Typography>
                </Box>

                <Breadcrumbs aria-label="breadcrumb" sx={{ mb: 1 }}>
                    <RouterLink component="button" variant="body2" onClick={() => navigate('/admin')} sx={{ textDecoration: 'none', color: 'inherit' }} >
                        Admin
                    </RouterLink>
                    <RouterLink component="button" variant="body2" onClick={() => navigate('/admin/users')} sx={{ textDecoration: 'none', color: 'inherit' }} >
                        Users
                    </RouterLink>
                    <Typography color="text.primary">{isEditMode ? 'Edit User' : 'Create New User'}</Typography>
                </Breadcrumbs>

                <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }} gutterBottom>
                    {isEditMode ? 'Modify the details below to update the user profile.' : 'Fill in the details to add a new user to the system.'}
                </Typography>

                {formError && <Typography color="error" sx={{ mb: 2 }}>{formError}</Typography>}
                {successMessage && <Typography color="success.main" sx={{ mb: 2 }}>{successMessage}</Typography>}

                <Box component="form" onSubmit={handleSubmit} noValidate>
                    <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="First Name"
                                name="firstName"
                                value={formData.firstName}
                                onChange={handleChange}
                                error={!!errors.firstName}
                                helperText={errors.firstName}
                                required
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Last Name"
                                name="lastName"
                                value={formData.lastName}
                                onChange={handleChange}
                                error={!!errors.lastName}
                                helperText={errors.lastName}
                                required
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                error={!!errors.email}
                                helperText={errors.email}
                                required
                                disabled={isEditMode}
                            />
                        </Grid>
                        {!isEditMode && (
                            <Grid item xs={12} md={6}>
                                <TextField
                                    fullWidth
                                    label="Password"
                                    name="password"
                                    type="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    error={!!errors.password}
                                    helperText={errors.password}
                                    required
                                />
                            </Grid>
                        )}
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth error={!!errors.role}>
                                <InputLabel>Role</InputLabel>
                                <Select
                                    name="role"
                                    value={formData.role}
                                    onChange={handleChange}
                                    label="Role"
                                >
                                    <MenuItem value="super_admin">Super Admin</MenuItem>
                                    <MenuItem value="admin">Admin</MenuItem>
                                    <MenuItem value="business_admin">Business Admin</MenuItem>
                                    <MenuItem value="user">User</MenuItem>
                                </Select>
                                {errors.role && (
                                    <FormHelperText>{errors.role}</FormHelperText>
                                )}
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth error={!!errors.status}>
                                <InputLabel>Status</InputLabel>
                                <Select
                                    name="status"
                                    value={formData.status}
                                    onChange={handleChange}
                                    label="Status"
                                >
                                    <MenuItem value="active">Active</MenuItem>
                                    <MenuItem value="inactive">Inactive</MenuItem>
                                    <MenuItem value="suspended">Suspended</MenuItem>
                                </Select>
                                {errors.status && (
                                    <FormHelperText>{errors.status}</FormHelperText>
                                )}
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Phone"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                error={!!errors.phone}
                                helperText={errors.phone}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <Autocomplete
                                multiple
                                id="user-companies-autocomplete"
                                options={allCompanies}
                                getOptionLabel={(option) => option.name}
                                value={selectedCompanyObjects}
                                onChange={handleCompaniesChange}
                                filterSelectedOptions
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        variant="outlined"
                                        label="Connected Companies"
                                        placeholder="Select companies"
                                        error={!!errors.companies}
                                        helperText={errors.companies}
                                    />
                                )}
                                isOptionEqualToValue={(option, value) => option.id === value.id}
                            />
                        </Grid>
                    </Grid>
                    <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                        <Button onClick={() => navigate('/admin/users')} sx={{ mr: 2 }}>
                            Cancel
                        </Button>
                        <Button type="submit" variant="contained" disabled={loading}>
                            {loading ? <CircularProgress size={24} /> : (isEditMode ? 'Save Changes' : 'Create User')}
                        </Button>
                    </Box>
                </Box>
            </Paper>
        </Box>
    );
};

export default UserForm; 