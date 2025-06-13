import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    TextField,
    Button,
    Avatar,
    IconButton,
    Divider,
    Stack,
    Alert,
    Snackbar,
    CircularProgress,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    InputAdornment,
    Container,
    Link
} from '@mui/material';
import {
    PhotoCamera as PhotoCameraIcon,
    Save as SaveIcon,
    Lock as LockIcon,
    Person as PersonIcon,
    Phone as PhoneIcon,
    Email as EmailIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, getStorage } from 'firebase/storage';
import { updatePassword, updateEmail, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { getApp } from 'firebase/app';
import './Profile.css';

const Profile = () => {
    const navigate = useNavigate();
    const { currentUser: user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showError, setShowError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);
    const [showAvatarDialog, setShowAvatarDialog] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);

    // Form states
    const [personalInfo, setPersonalInfo] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        company: '',
        position: '',
        photoURL: ''
    });

    const [password, setPassword] = useState({
        current: '',
        new: '',
        confirm: ''
    });

    const [showPasswords, setShowPasswords] = useState({
        current: false,
        new: false,
        confirm: false
    });

    // Load user data on component mount
    useEffect(() => {
        if (user) {
            loadUserData();
        }
    }, [user]);

    const loadUserData = async () => {
        if (!user) return;

        try {
            setInitialLoading(true);
            const userDoc = await getDoc(doc(db, 'users', user.uid));

            if (userDoc.exists()) {
                const userData = userDoc.data();
                setPersonalInfo({
                    firstName: userData.firstName || '',
                    lastName: userData.lastName || '',
                    email: userData.email || user.email || '',
                    phone: userData.phone || '',
                    company: userData.company || '',
                    position: userData.position || '',
                    photoURL: userData.photoURL || user.photoURL || ''
                });
                setAvatarPreview(userData.photoURL || user.photoURL || null);
            } else {
                // If no user document exists, create one with basic info
                setPersonalInfo({
                    firstName: user.displayName?.split(' ')[0] || '',
                    lastName: user.displayName?.split(' ')[1] || '',
                    email: user.email || '',
                    phone: '',
                    company: '',
                    position: '',
                    photoURL: user.photoURL || ''
                });
                setAvatarPreview(user.photoURL || null);
            }
        } catch (error) {
            console.error('Error loading user data:', error);
            setErrorMessage('Failed to load user data');
            setShowError(true);
        } finally {
            setInitialLoading(false);
        }
    };

    // Handle file selection for avatar
    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
            // Validate file type and size
            if (!file.type.startsWith('image/')) {
                setErrorMessage('Please select an image file');
                setShowError(true);
                return;
            }

            if (file.size > 5 * 1024 * 1024) { // 5MB limit
                setErrorMessage('Image size must be less than 5MB');
                setShowError(true);
                return;
            }

            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setAvatarPreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    // Handle form submissions
    const handlePersonalInfoSubmit = async (e) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);
        try {
            // Validate required fields
            if (!personalInfo.firstName || !personalInfo.lastName || !personalInfo.email) {
                setErrorMessage('First name, last name, and email are required');
                setShowError(true);
                return;
            }

            // Update Firebase Auth email if changed
            if (personalInfo.email !== user.email) {
                await updateEmail(user, personalInfo.email);
            }

            // Update user document in Firestore
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                firstName: personalInfo.firstName,
                lastName: personalInfo.lastName,
                email: personalInfo.email,
                phone: personalInfo.phone,
                company: personalInfo.company,
                position: personalInfo.position,
                updatedAt: new Date()
            });

            setShowSuccess(true);
        } catch (error) {
            console.error('Error updating profile:', error);
            if (error.code === 'auth/requires-recent-login') {
                setErrorMessage('Please sign out and sign back in to update your email');
            } else {
                setErrorMessage('Failed to update personal information');
            }
            setShowError(true);
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        if (!user) return;

        setLoading(true);
        try {
            // Validate password fields
            if (!password.current || !password.new || !password.confirm) {
                setErrorMessage('All password fields are required');
                setShowError(true);
                return;
            }

            if (password.new !== password.confirm) {
                setErrorMessage('New passwords do not match');
                setShowError(true);
                return;
            }

            if (password.new.length < 6) {
                setErrorMessage('New password must be at least 6 characters');
                setShowError(true);
                return;
            }

            // Reauthenticate user before changing password
            const credential = EmailAuthProvider.credential(user.email, password.current);
            await reauthenticateWithCredential(user, credential);

            // Update password
            await updatePassword(user, password.new);

            setShowSuccess(true);
            setShowPasswordDialog(false);
            setPassword({ current: '', new: '', confirm: '' });
        } catch (error) {
            console.error('Error changing password:', error);
            if (error.code === 'auth/wrong-password') {
                setErrorMessage('Current password is incorrect');
            } else {
                setErrorMessage('Failed to change password');
            }
            setShowError(true);
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarUpload = async () => {
        if (!user || !selectedFile) return;

        setLoading(true);
        try {
            // Upload image to Firebase Storage using the same pattern as AdminCarriers
            const firebaseApp = getApp();
            const customStorage = getStorage(firebaseApp, "gs://solushipx.firebasestorage.app");
            const fileName = `${Date.now()}_${selectedFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
            const storageRef = ref(customStorage, `profile-images/${user.uid}/${fileName}`);
            const snapshot = await uploadBytes(storageRef, selectedFile);
            const downloadURL = await getDownloadURL(snapshot.ref);

            // Update user document with new photo URL
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, {
                photoURL: downloadURL,
                updatedAt: new Date()
            });

            // Update local state
            setPersonalInfo(prev => ({ ...prev, photoURL: downloadURL }));
            setAvatarPreview(downloadURL);

            setShowSuccess(true);
            setShowAvatarDialog(false);
            setSelectedFile(null);
        } catch (error) {
            console.error('Error uploading avatar:', error);
            setErrorMessage('Failed to upload avatar');
            setShowError(true);
        } finally {
            setLoading(false);
        }
    };

    // Show loading spinner while initial data loads
    if (initialLoading) {
        return (
            <Box className="profile-container">
                <Container maxWidth={false} sx={{ maxWidth: '1300px', mx: 'auto' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                        <CircularProgress />
                    </Box>
                </Container>
            </Box>
        );
    }

    // Redirect if no user is logged in
    if (!user) {
        navigate('/login');
        return null;
    }

    return (
        <Box className="profile-container">
            <Container maxWidth={false} sx={{ maxWidth: '1300px', mx: 'auto' }}>
                <Box className="breadcrumb-container">
                    <Link component={RouterLink} to="/dashboard" className="breadcrumb-link">
                        <HomeIcon sx={{ fontSize: 20 }} />
                        Dashboard
                    </Link>
                    <NavigateNextIcon className="breadcrumb-separator" />
                    <Typography className="breadcrumb-current">Profile</Typography>
                </Box>

                <Paper className="profile-paper">
                    <Box sx={{ width: '100%', bgcolor: '#f8fafc', minHeight: '100vh', p: 3 }}>
                        <Box sx={{ maxWidth: '1200px', margin: '0 auto' }}>
                            {/* Header Section */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                                <Typography variant="h5" component="h1" sx={{ fontWeight: 600, color: '#1e293b' }}>
                                    Profile Settings
                                </Typography>
                            </Box>

                            <Grid container spacing={3}>
                                {/* Left Column - Avatar and Quick Actions */}
                                <Grid item xs={12} md={4}>
                                    <Paper sx={{ p: 3, textAlign: 'center' }}>
                                        <Box sx={{ position: 'relative', display: 'inline-block' }}>
                                            <Avatar
                                                src={avatarPreview || personalInfo.photoURL}
                                                sx={{ width: 150, height: 150, mb: 2 }}
                                            >
                                                {!avatarPreview && !personalInfo.photoURL &&
                                                    (personalInfo.firstName?.[0] || user?.displayName?.[0] || user?.email?.[0] || '?')
                                                }
                                            </Avatar>
                                            <IconButton
                                                sx={{
                                                    position: 'absolute',
                                                    bottom: 0,
                                                    right: 0,
                                                    bgcolor: 'white',
                                                    '&:hover': { bgcolor: 'white' }
                                                }}
                                                onClick={() => setShowAvatarDialog(true)}
                                            >
                                                <PhotoCameraIcon />
                                            </IconButton>
                                        </Box>
                                        <Typography variant="h6" gutterBottom>
                                            {personalInfo.firstName && personalInfo.lastName
                                                ? `${personalInfo.firstName} ${personalInfo.lastName}`
                                                : user?.displayName || 'User'
                                            }
                                        </Typography>
                                        <Typography color="text.secondary" gutterBottom>
                                            {personalInfo.position || 'No position specified'}
                                        </Typography>
                                        <Typography color="text.secondary">
                                            {personalInfo.company || 'No company specified'}
                                        </Typography>
                                        <Button
                                            variant="outlined"
                                            startIcon={<LockIcon />}
                                            onClick={() => setShowPasswordDialog(true)}
                                            sx={{ mt: 2 }}
                                        >
                                            Change Password
                                        </Button>
                                    </Paper>
                                </Grid>

                                {/* Right Column - Profile Sections */}
                                <Grid item xs={12} md={8}>
                                    {/* Personal Information Section */}
                                    <Paper sx={{ p: 3, mb: 3 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                                            <PersonIcon sx={{ mr: 1, color: '#64748b' }} />
                                            <Typography variant="h6">Personal Information</Typography>
                                        </Box>
                                        <form onSubmit={handlePersonalInfoSubmit}>
                                            <Grid container spacing={2}>
                                                <Grid item xs={12} sm={6}>
                                                    <TextField
                                                        fullWidth
                                                        label="First Name"
                                                        value={personalInfo.firstName}
                                                        onChange={(e) => setPersonalInfo({ ...personalInfo, firstName: e.target.value })}
                                                        required
                                                        error={!personalInfo.firstName}
                                                        helperText={!personalInfo.firstName ? 'First name is required' : ''}
                                                    />
                                                </Grid>
                                                <Grid item xs={12} sm={6}>
                                                    <TextField
                                                        fullWidth
                                                        label="Last Name"
                                                        value={personalInfo.lastName}
                                                        onChange={(e) => setPersonalInfo({ ...personalInfo, lastName: e.target.value })}
                                                        required
                                                        error={!personalInfo.lastName}
                                                        helperText={!personalInfo.lastName ? 'Last name is required' : ''}
                                                    />
                                                </Grid>
                                                <Grid item xs={12} sm={6}>
                                                    <TextField
                                                        fullWidth
                                                        label="Email"
                                                        type="email"
                                                        value={personalInfo.email}
                                                        onChange={(e) => setPersonalInfo({ ...personalInfo, email: e.target.value })}
                                                        required
                                                        error={!personalInfo.email}
                                                        helperText={!personalInfo.email ? 'Email is required' : ''}
                                                    />
                                                </Grid>
                                                <Grid item xs={12} sm={6}>
                                                    <TextField
                                                        fullWidth
                                                        label="Phone"
                                                        value={personalInfo.phone}
                                                        onChange={(e) => setPersonalInfo({ ...personalInfo, phone: e.target.value })}
                                                    />
                                                </Grid>
                                                <Grid item xs={12} sm={6}>
                                                    <TextField
                                                        fullWidth
                                                        label="Company"
                                                        value={personalInfo.company}
                                                        onChange={(e) => setPersonalInfo({ ...personalInfo, company: e.target.value })}
                                                    />
                                                </Grid>
                                                <Grid item xs={12} sm={6}>
                                                    <TextField
                                                        fullWidth
                                                        label="Position"
                                                        value={personalInfo.position}
                                                        onChange={(e) => setPersonalInfo({ ...personalInfo, position: e.target.value })}
                                                    />
                                                </Grid>
                                                <Grid item xs={12}>
                                                    <Button
                                                        type="submit"
                                                        variant="contained"
                                                        startIcon={loading ? <CircularProgress size={20} /> : <SaveIcon />}
                                                        disabled={loading}
                                                    >
                                                        {loading ? 'Saving...' : 'Save Changes'}
                                                    </Button>
                                                </Grid>
                                            </Grid>
                                        </form>
                                    </Paper>
                                </Grid>
                            </Grid>
                        </Box>
                    </Box>

                    {/* Avatar Upload Dialog */}
                    <Dialog open={showAvatarDialog} onClose={() => setShowAvatarDialog(false)}>
                        <DialogTitle>Update Profile Picture</DialogTitle>
                        <DialogContent>
                            <Box sx={{ textAlign: 'center', py: 2 }}>
                                <Avatar
                                    src={avatarPreview || personalInfo.photoURL}
                                    sx={{ width: 150, height: 150, mx: 'auto', mb: 2 }}
                                >
                                    {!avatarPreview && !personalInfo.photoURL &&
                                        (personalInfo.firstName?.[0] || user?.displayName?.[0] || user?.email?.[0] || '?')
                                    }
                                </Avatar>
                                <Button
                                    variant="outlined"
                                    component="label"
                                    startIcon={<PhotoCameraIcon />}
                                >
                                    Choose Photo
                                    <input
                                        type="file"
                                        hidden
                                        accept="image/*"
                                        onChange={handleFileSelect}
                                    />
                                </Button>
                                {selectedFile && (
                                    <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                                        Selected: {selectedFile.name}
                                    </Typography>
                                )}
                            </Box>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setShowAvatarDialog(false)}>Cancel</Button>
                            <Button
                                onClick={handleAvatarUpload}
                                variant="contained"
                                disabled={!selectedFile || loading}
                                startIcon={loading ? <CircularProgress size={20} /> : null}
                            >
                                {loading ? 'Uploading...' : 'Upload'}
                            </Button>
                        </DialogActions>
                    </Dialog>

                    {/* Password Change Dialog */}
                    <Dialog open={showPasswordDialog} onClose={() => setShowPasswordDialog(false)}>
                        <DialogTitle>Change Password</DialogTitle>
                        <DialogContent>
                            <form onSubmit={handlePasswordChange}>
                                <Stack spacing={2} sx={{ mt: 2 }}>
                                    <TextField
                                        fullWidth
                                        label="Current Password"
                                        type={showPasswords.current ? 'text' : 'password'}
                                        value={password.current}
                                        onChange={(e) => setPassword({ ...password, current: e.target.value })}
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                                                    >
                                                        {showPasswords.current ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                        }}
                                    />
                                    <TextField
                                        fullWidth
                                        label="New Password"
                                        type={showPasswords.new ? 'text' : 'password'}
                                        value={password.new}
                                        onChange={(e) => setPassword({ ...password, new: e.target.value })}
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                                                    >
                                                        {showPasswords.new ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                        }}
                                    />
                                    <TextField
                                        fullWidth
                                        label="Confirm New Password"
                                        type={showPasswords.confirm ? 'text' : 'password'}
                                        value={password.confirm}
                                        onChange={(e) => setPassword({ ...password, confirm: e.target.value })}
                                        InputProps={{
                                            endAdornment: (
                                                <InputAdornment position="end">
                                                    <IconButton
                                                        onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                                                    >
                                                        {showPasswords.confirm ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                                    </IconButton>
                                                </InputAdornment>
                                            ),
                                        }}
                                    />
                                </Stack>
                            </form>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setShowPasswordDialog(false)}>Cancel</Button>
                            <Button
                                onClick={handlePasswordChange}
                                variant="contained"
                                disabled={loading}
                                startIcon={loading ? <CircularProgress size={20} /> : null}
                            >
                                {loading ? 'Changing...' : 'Change Password'}
                            </Button>
                        </DialogActions>
                    </Dialog>

                    {/* Success Snackbar */}
                    <Snackbar
                        open={showSuccess}
                        autoHideDuration={6000}
                        onClose={() => setShowSuccess(false)}
                    >
                        <Alert severity="success" sx={{ width: '100%' }}>
                            Profile updated successfully!
                        </Alert>
                    </Snackbar>

                    {/* Error Snackbar */}
                    <Snackbar
                        open={showError}
                        autoHideDuration={6000}
                        onClose={() => setShowError(false)}
                    >
                        <Alert severity="error" sx={{ width: '100%' }}>
                            {errorMessage}
                        </Alert>
                    </Snackbar>
                </Paper>
            </Container>
        </Box>
    );
};

export default Profile; 