import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Button,
    Alert,
    CircularProgress,
    IconButton,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useParams, useNavigate } from 'react-router-dom';
import { getAuth, updatePassword } from 'firebase/auth';

const ResetPassword = () => {
    const { userId } = useParams();
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [formData, setFormData] = useState({
        newPassword: '',
        confirmPassword: '',
    });
    const [errors, setErrors] = useState({});

    useEffect(() => {
        fetchUser();
    }, [userId]);

    const fetchUser = async () => {
        try {
            setLoading(true);
            const userDoc = await getDoc(doc(db, 'users', userId));
            if (!userDoc.exists()) {
                throw new Error('User not found');
            }
            setUser(userDoc.data());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const validateForm = () => {
        const newErrors = {};
        if (!formData.newPassword) {
            newErrors.newPassword = 'New password is required';
        } else if (formData.newPassword.length < 8) {
            newErrors.newPassword = 'Password must be at least 8 characters long';
        }
        if (!formData.confirmPassword) {
            newErrors.confirmPassword = 'Please confirm your password';
        } else if (formData.newPassword !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!validateForm()) return;

        try {
            setSaving(true);
            setError(null);
            setSuccess(false);

            // Update password in Firebase Auth
            const auth = getAuth();
            await updatePassword(auth.currentUser, formData.newPassword);

            // Update last password change in Firestore
            await updateDoc(doc(db, 'users', userId), {
                lastPasswordChange: new Date(),
                updatedAt: new Date()
            });

            setSuccess(true);
            setFormData({
                newPassword: '',
                confirmPassword: '',
            });
        } catch (err) {
            setError('Error resetting password: ' + err.message);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box className="reset-password-container">
            <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton onClick={() => navigate(-1)}>
                    <ArrowBackIcon />
                </IconButton>
                <Box>
                    <Typography variant="h4" component="h1" gutterBottom>
                        Reset Password for {user.firstName} {user.lastName}
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Set a new password for this user
                    </Typography>
                </Box>
            </Box>

            <Paper sx={{ p: 3, maxWidth: 600 }}>
                {error && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                        {error}
                    </Alert>
                )}

                {success && (
                    <Alert severity="success" sx={{ mb: 3 }}>
                        Password has been successfully reset
                    </Alert>
                )}

                <form onSubmit={handleSubmit}>
                    <TextField
                        fullWidth
                        label="New Password"
                        name="newPassword"
                        type="password"
                        value={formData.newPassword}
                        onChange={handleChange}
                        error={!!errors.newPassword}
                        helperText={errors.newPassword}
                        sx={{ mb: 2 }}
                    />

                    <TextField
                        fullWidth
                        label="Confirm Password"
                        name="confirmPassword"
                        type="password"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        error={!!errors.confirmPassword}
                        helperText={errors.confirmPassword}
                        sx={{ mb: 3 }}
                    />

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button
                            variant="outlined"
                            onClick={() => navigate(-1)}
                            disabled={saving}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="contained"
                            disabled={saving}
                        >
                            {saving ? 'Resetting...' : 'Reset Password'}
                        </Button>
                    </Box>
                </form>
            </Paper>
        </Box>
    );
};

export default ResetPassword; 