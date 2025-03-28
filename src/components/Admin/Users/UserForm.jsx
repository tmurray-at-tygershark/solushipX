import React, { useState, useEffect } from 'react';
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
} from '@mui/material';
import { collection, addDoc, updateDoc, doc, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';

const UserForm = ({ user, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'user',
        companyId: '',
        companyName: '',
        status: 'active',
        phone: '',
        department: '',
        position: '',
    });
    const [companies, setCompanies] = useState([]);
    const [errors, setErrors] = useState({});
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchCompanies();
        if (user) {
            setFormData({
                name: user.name || '',
                email: user.email || '',
                password: '',
                role: user.role || 'user',
                companyId: user.companyId || '',
                companyName: user.companyName || '',
                status: user.status || 'active',
                phone: user.phone || '',
                department: user.department || '',
                position: user.position || '',
            });
        }
    }, [user]);

    const fetchCompanies = async () => {
        try {
            const companiesRef = collection(db, 'companies');
            const q = query(companiesRef, where('status', '==', 'active'));
            const querySnapshot = await getDocs(q);
            const companiesData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setCompanies(companiesData);
        } catch (err) {
            console.error('Error fetching companies:', err);
        }
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.name.trim()) {
            newErrors.name = 'Name is required';
        }
        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Invalid email format';
        }
        if (!user && !formData.password) {
            newErrors.password = 'Password is required for new users';
        }
        if (!formData.role) {
            newErrors.role = 'Role is required';
        }
        if (!formData.companyId) {
            newErrors.companyId = 'Company is required';
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const handleCompanyChange = (event, newValue) => {
        setFormData(prev => ({
            ...prev,
            companyId: newValue?.id || '',
            companyName: newValue?.name || ''
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        try {
            setLoading(true);
            let userData = {
                ...formData,
                updatedAt: new Date(),
            };

            if (user) {
                // Update existing user
                await updateDoc(doc(db, 'users', user.id), userData);
            } else {
                // Create new user
                const authResult = await createUserWithEmailAndPassword(
                    formData.email,
                    formData.password
                );
                userData.createdAt = new Date();
                userData.id = authResult.user.uid;
                await addDoc(collection(db, 'users'), userData);
            }

            onSubmit();
        } catch (error) {
            console.error('Error saving user:', error);
            setErrors(prev => ({
                ...prev,
                submit: 'Error saving user. Please try again.'
            }));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box component="form" onSubmit={handleSubmit} className="user-form">
            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    <TextField
                        fullWidth
                        label="Full Name"
                        name="name"
                        value={formData.name}
                        onChange={handleChange}
                        error={!!errors.name}
                        helperText={errors.name}
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
                        disabled={!!user}
                    />
                </Grid>
                {!user && (
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
                    <Autocomplete
                        options={companies}
                        getOptionLabel={(option) => option.name}
                        value={companies.find(c => c.id === formData.companyId) || null}
                        onChange={handleCompanyChange}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                label="Company"
                                error={!!errors.companyId}
                                helperText={errors.companyId}
                                required
                            />
                        )}
                    />
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
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <TextField
                        fullWidth
                        label="Department"
                        name="department"
                        value={formData.department}
                        onChange={handleChange}
                    />
                </Grid>
                <Grid item xs={12} md={6}>
                    <TextField
                        fullWidth
                        label="Position"
                        name="position"
                        value={formData.position}
                        onChange={handleChange}
                    />
                </Grid>
            </Grid>
        </Box>
    );
};

export default UserForm; 