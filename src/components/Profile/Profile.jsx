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
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Container,
    Link
} from '@mui/material';
import {
    Edit as EditIcon,
    PhotoCamera as PhotoCameraIcon,
    Save as SaveIcon,
    Lock as LockIcon,
    Person as PersonIcon,
    LocationOn as LocationIcon,
    Phone as PhoneIcon,
    Email as EmailIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    Home as HomeIcon,
    NavigateNext as NavigateNextIcon
} from '@mui/icons-material';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import './Profile.css';

const Profile = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [showError, setShowError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [showPasswordDialog, setShowPasswordDialog] = useState(false);
    const [showAvatarDialog, setShowAvatarDialog] = useState(false);
    const [avatarPreview, setAvatarPreview] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);

    // Form states
    const [personalInfo, setPersonalInfo] = useState({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1 (555) 123-4567',
        company: 'Acme Corporation',
        position: 'Shipping Manager'
    });

    const [address, setAddress] = useState({
        street: '123 Business Ave',
        city: 'New York',
        state: 'NY',
        zipCode: '10001',
        country: 'United States'
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

    // Handle file selection for avatar
    const handleFileSelect = (event) => {
        const file = event.target.files[0];
        if (file) {
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
        setLoading(true);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            setShowSuccess(true);
        } catch (error) {
            setErrorMessage('Failed to update personal information');
            setShowError(true);
        } finally {
            setLoading(false);
        }
    };

    const handleAddressSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            setShowSuccess(true);
        } catch (error) {
            setErrorMessage('Failed to update address');
            setShowError(true);
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordChange = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            setShowSuccess(true);
            setShowPasswordDialog(false);
            setPassword({ current: '', new: '', confirm: '' });
        } catch (error) {
            setErrorMessage('Failed to change password');
            setShowError(true);
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarUpload = async () => {
        setLoading(true);
        try {
            // Simulate API call
            await new Promise(resolve => setTimeout(resolve, 1000));
            setShowSuccess(true);
            setShowAvatarDialog(false);
        } catch (error) {
            setErrorMessage('Failed to upload avatar');
            setShowError(true);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box className="profile-container">
            <Container maxWidth={false} sx={{ maxWidth: '1300px', mx: 'auto' }}>
                <Box className="breadcrumb-container">
                    <Link component={RouterLink} to="/" className="breadcrumb-link">
                        <HomeIcon sx={{ fontSize: 20 }} />
                        Home
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
                                                src={avatarPreview}
                                                sx={{ width: 150, height: 150, mb: 2 }}
                                            />
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
                                            {personalInfo.firstName} {personalInfo.lastName}
                                        </Typography>
                                        <Typography color="text.secondary" gutterBottom>
                                            {personalInfo.position}
                                        </Typography>
                                        <Typography color="text.secondary">
                                            {personalInfo.company}
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
                                                    />
                                                </Grid>
                                                <Grid item xs={12} sm={6}>
                                                    <TextField
                                                        fullWidth
                                                        label="Last Name"
                                                        value={personalInfo.lastName}
                                                        onChange={(e) => setPersonalInfo({ ...personalInfo, lastName: e.target.value })}
                                                    />
                                                </Grid>
                                                <Grid item xs={12} sm={6}>
                                                    <TextField
                                                        fullWidth
                                                        label="Email"
                                                        type="email"
                                                        value={personalInfo.email}
                                                        onChange={(e) => setPersonalInfo({ ...personalInfo, email: e.target.value })}
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
                                                        startIcon={<SaveIcon />}
                                                        disabled={loading}
                                                    >
                                                        Save Changes
                                                    </Button>
                                                </Grid>
                                            </Grid>
                                        </form>
                                    </Paper>

                                    {/* Address Section */}
                                    <Paper sx={{ p: 3 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                                            <LocationIcon sx={{ mr: 1, color: '#64748b' }} />
                                            <Typography variant="h6">Address Information</Typography>
                                        </Box>
                                        <form onSubmit={handleAddressSubmit}>
                                            <Grid container spacing={2}>
                                                <Grid item xs={12}>
                                                    <TextField
                                                        fullWidth
                                                        label="Street Address"
                                                        value={address.street}
                                                        onChange={(e) => setAddress({ ...address, street: e.target.value })}
                                                    />
                                                </Grid>
                                                <Grid item xs={12} sm={6}>
                                                    <TextField
                                                        fullWidth
                                                        label="City"
                                                        value={address.city}
                                                        onChange={(e) => setAddress({ ...address, city: e.target.value })}
                                                    />
                                                </Grid>
                                                <Grid item xs={12} sm={3}>
                                                    <TextField
                                                        fullWidth
                                                        label="State"
                                                        value={address.state}
                                                        onChange={(e) => setAddress({ ...address, state: e.target.value })}
                                                    />
                                                </Grid>
                                                <Grid item xs={12} sm={3}>
                                                    <TextField
                                                        fullWidth
                                                        label="ZIP Code"
                                                        value={address.zipCode}
                                                        onChange={(e) => setAddress({ ...address, zipCode: e.target.value })}
                                                    />
                                                </Grid>
                                                <Grid item xs={12}>
                                                    <FormControl fullWidth>
                                                        <InputLabel>Country</InputLabel>
                                                        <Select
                                                            value={address.country}
                                                            label="Country"
                                                            onChange={(e) => setAddress({ ...address, country: e.target.value })}
                                                        >
                                                            <MenuItem value="United States">United States</MenuItem>
                                                            <MenuItem value="Canada">Canada</MenuItem>
                                                            <MenuItem value="United Kingdom">United Kingdom</MenuItem>
                                                            <MenuItem value="Australia">Australia</MenuItem>
                                                        </Select>
                                                    </FormControl>
                                                </Grid>
                                                <Grid item xs={12}>
                                                    <Button
                                                        type="submit"
                                                        variant="contained"
                                                        startIcon={<SaveIcon />}
                                                        disabled={loading}
                                                    >
                                                        Save Address
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
                                    src={avatarPreview}
                                    sx={{ width: 150, height: 150, mx: 'auto', mb: 2 }}
                                />
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
                            </Box>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={() => setShowAvatarDialog(false)}>Cancel</Button>
                            <Button
                                onClick={handleAvatarUpload}
                                variant="contained"
                                disabled={!selectedFile || loading}
                            >
                                Upload
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
                            >
                                Change Password
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
                            Changes saved successfully!
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