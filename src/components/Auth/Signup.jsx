import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Container,
    Box,
    Typography,
    TextField,
    Button,
    Alert,
    FormControlLabel,
    Checkbox,
    Grid,
    Paper,
    Stepper,
    Step,
    StepLabel,
    CircularProgress,
    Select,
    MenuItem,
    FormControl,
    InputLabel
} from '@mui/material';
import { useAuth } from '../../contexts/AuthContext';
import { saveCustomerData } from '../../firebase/db';

const steps = ['Account Details', 'Business Information', 'Review & Confirm'];

const COUNTRIES = [
    { code: 'USA', name: 'United States' },
    { code: 'CAN', name: 'Canada' }
];

const MONTHLY_SHIPMENT_OPTIONS = [
    { value: '0-100', label: '0-100 shipments/month' },
    { value: '100-500', label: '100-500 shipments/month' },
    { value: '1000+', label: '1,000 or more shipments/month' }
];

const SignUp = () => {
    const navigate = useNavigate();
    const { signup } = useAuth();
    const [activeStep, setActiveStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({
        // Account Details
        email: '',
        password: '',
        confirmPassword: '',

        // Business Information
        firstName: '',
        lastName: '',
        companyName: '',
        phoneNumber: '',
        businessType: '',
        address: '',
        city: '',
        state: '',
        zipCode: '',
        country: 'USA',
        monthlyShipments: '',

        // Terms
        agreeToTerms: false
    });

    const handleNext = () => {
        if (activeStep === steps.length - 1) {
            handleSubmit();
        } else {
            setActiveStep((prevStep) => prevStep + 1);
        }
    };

    const handleBack = () => {
        setActiveStep((prevStep) => prevStep - 1);
    };

    const isStepValid = () => {
        switch (activeStep) {
            case 0: // Account Details
                return (
                    formData.email.trim() !== '' &&
                    formData.password.length >= 6 &&
                    formData.password === formData.confirmPassword
                );
            case 1: // Business Information
                return (
                    formData.firstName.trim() !== '' &&
                    formData.lastName.trim() !== '' &&
                    formData.companyName.trim() !== '' &&
                    formData.phoneNumber.trim() !== '' &&
                    formData.address.trim() !== '' &&
                    formData.city.trim() !== '' &&
                    formData.state.trim() !== '' &&
                    formData.zipCode.trim() !== '' &&
                    formData.country !== ''
                );
            case 2: // Review & Confirm
                return formData.agreeToTerms;
            default:
                return false;
        }
    };

    const handleChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSubmit = async (e) => {
        if (e) {
            e.preventDefault();
        }
        setLoading(true);
        setError('');

        try {
            // Create the user account
            const { user } = await signup(formData.email, formData.password);

            if (!user) {
                throw new Error('Failed to create user account');
            }

            // Prepare customer data
            const customerData = {
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                country: formData.country,
                monthlyShipments: formData.monthlyShipments,
                company: formData.companyName || '',
                phone: formData.phoneNumber || '',
                address: formData.address || '',
                city: formData.city || '',
                state: formData.state || '',
                zipCode: formData.zipCode || ''
            };

            // Save customer data to Firestore
            const { success, error: dbError } = await saveCustomerData(user.uid, customerData);

            if (!success) {
                throw new Error(dbError || 'Failed to save customer data');
            }

            // Navigate to dashboard on success
            navigate('/dashboard');
        } catch (error) {
            console.error('Signup error:', error);
            setError(error.message || 'Failed to create account');
        } finally {
            setLoading(false);
        }
    };

    const renderStepContent = (step) => {
        switch (step) {
            case 0:
                return (
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <TextField
                                name="email"
                                label="Email"
                                type="email"
                                value={formData.email}
                                onChange={(e) => handleChange('email', e.target.value)}
                                autoComplete="email"
                                required
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                name="password"
                                label="Password"
                                type="password"
                                value={formData.password}
                                onChange={(e) => handleChange('password', e.target.value)}
                                autoComplete="new-password"
                                required
                                fullWidth
                                inputProps={{ minLength: 6 }}
                                helperText="Password must be at least 6 characters long"
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                name="confirmPassword"
                                label="Confirm Password"
                                type="password"
                                value={formData.confirmPassword}
                                onChange={(e) => handleChange('confirmPassword', e.target.value)}
                                autoComplete="new-password"
                                required
                                fullWidth
                                error={formData.password !== formData.confirmPassword && formData.confirmPassword !== ''}
                                helperText={formData.password !== formData.confirmPassword && formData.confirmPassword !== '' ? 'Passwords do not match' : ''}
                            />
                        </Grid>
                    </Grid>
                );
            case 1:
                return (
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                name="firstName"
                                label="First Name"
                                value={formData.firstName}
                                onChange={(e) => handleChange('firstName', e.target.value)}
                                autoComplete="given-name"
                                required
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                name="lastName"
                                label="Last Name"
                                value={formData.lastName}
                                onChange={(e) => handleChange('lastName', e.target.value)}
                                autoComplete="family-name"
                                required
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Company Name"
                                name="companyName"
                                value={formData.companyName || ''}
                                onChange={(e) => handleChange('companyName', e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel>Monthly Shipments</InputLabel>
                                <Select
                                    value={formData.monthlyShipments}
                                    onChange={(e) => handleChange('monthlyShipments', e.target.value)}
                                    label="Monthly Shipments"
                                    required
                                >
                                    {MONTHLY_SHIPMENT_OPTIONS.map((option) => (
                                        <MenuItem key={option.value} value={option.value}>
                                            {option.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                name="phoneNumber"
                                label="Phone Number"
                                value={formData.phoneNumber}
                                onChange={(e) => handleChange('phoneNumber', e.target.value)}
                                autoComplete="tel"
                                required
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                name="address"
                                label="Business Address"
                                value={formData.address}
                                onChange={(e) => handleChange('address', e.target.value)}
                                autoComplete="street-address"
                                required
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                name="city"
                                label="City"
                                value={formData.city}
                                onChange={(e) => handleChange('city', e.target.value)}
                                autoComplete="address-level2"
                                required
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12} sm={3}>
                            <TextField
                                name="state"
                                label="State"
                                value={formData.state}
                                onChange={(e) => handleChange('state', e.target.value)}
                                autoComplete="address-level1"
                                required
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12} sm={3}>
                            <TextField
                                name="zipCode"
                                label="ZIP Code"
                                value={formData.zipCode}
                                onChange={(e) => handleChange('zipCode', e.target.value)}
                                autoComplete="postal-code"
                                required
                                fullWidth
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <FormControl fullWidth required>
                                <InputLabel id="country-label">Country</InputLabel>
                                <Select
                                    labelId="country-label"
                                    name="country"
                                    value={formData.country}
                                    onChange={(e) => handleChange('country', e.target.value)}
                                    label="Country"
                                >
                                    {COUNTRIES.map((country) => (
                                        <MenuItem key={country.code} value={country.code}>
                                            {country.name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                );
            case 2:
                return (
                    <Grid container spacing={3}>
                        <Grid item xs={12}>
                            <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
                                Review Your Information
                            </Typography>
                        </Grid>

                        {/* Personal & Account Information Card */}
                        <Grid item xs={12}>
                            <Paper elevation={1} sx={{ p: 3, bgcolor: 'background.default' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="subtitle1" fontWeight="600" color="primary">
                                        Personal & Account Information
                                    </Typography>
                                </Box>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={6}>
                                        <Box>
                                            <Typography color="text.secondary" gutterBottom>Full Name</Typography>
                                            <Typography>{formData.firstName} {formData.lastName}</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Box>
                                            <Typography color="text.secondary" gutterBottom>Email</Typography>
                                            <Typography>{formData.email}</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Box>
                                            <Typography color="text.secondary" gutterBottom>Phone</Typography>
                                            <Typography>{formData.phoneNumber}</Typography>
                                        </Box>
                                    </Grid>
                                </Grid>
                            </Paper>
                        </Grid>

                        {/* Business Information Card */}
                        <Grid item xs={12}>
                            <Paper elevation={1} sx={{ p: 3, bgcolor: 'background.default' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="subtitle1" fontWeight="600" color="primary">
                                        Business Information
                                    </Typography>
                                </Box>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={6}>
                                        <Box>
                                            <Typography color="text.secondary" gutterBottom>Company</Typography>
                                            <Typography>{formData.companyName}</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Box>
                                            <Typography color="text.secondary" gutterBottom>Monthly Shipments</Typography>
                                            <Typography>{formData.monthlyShipments}</Typography>
                                        </Box>
                                    </Grid>
                                </Grid>
                            </Paper>
                        </Grid>

                        {/* Address Information Card */}
                        <Grid item xs={12}>
                            <Paper elevation={1} sx={{ p: 3, bgcolor: 'background.default' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                                    <Typography variant="subtitle1" fontWeight="600" color="primary">
                                        Address Information
                                    </Typography>
                                </Box>
                                <Grid container spacing={2}>
                                    <Grid item xs={12}>
                                        <Box>
                                            <Typography color="text.secondary" gutterBottom>Street Address</Typography>
                                            <Typography>{formData.address}</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                        <Box>
                                            <Typography color="text.secondary" gutterBottom>City</Typography>
                                            <Typography>{formData.city}</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                        <Box>
                                            <Typography color="text.secondary" gutterBottom>State</Typography>
                                            <Typography>{formData.state}</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12} sm={4}>
                                        <Box>
                                            <Typography color="text.secondary" gutterBottom>ZIP Code</Typography>
                                            <Typography>{formData.zipCode}</Typography>
                                        </Box>
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Box>
                                            <Typography color="text.secondary" gutterBottom>Country</Typography>
                                            <Typography>{COUNTRIES.find(c => c.code === formData.country)?.name}</Typography>
                                        </Box>
                                    </Grid>
                                </Grid>
                            </Paper>
                        </Grid>

                        {/* Terms and Conditions */}
                        <Grid item xs={12}>
                            <Paper elevation={1} sx={{ p: 3, bgcolor: 'background.default' }}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            name="agreeToTerms"
                                            checked={formData.agreeToTerms}
                                            onChange={(e) => handleChange('agreeToTerms', e.target.checked)}
                                            color="primary"
                                        />
                                    }
                                    label={
                                        <Typography variant="body2">
                                            I agree to the <Link href="#" color="primary">Terms of Service</Link> and <Link href="#" color="primary">Privacy Policy</Link>
                                        </Typography>
                                    }
                                />
                            </Paper>
                        </Grid>
                    </Grid>
                );
            default:
                return null;
        }
    };

    return (
        <Container component="main" maxWidth="sm">
            <Box sx={{ mt: 8, mb: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <Typography component="h1" variant="h4" gutterBottom>
                    Create your account
                </Typography>
                <Typography variant="body1" color="text.secondary" gutterBottom>
                    Get started with SolushipX
                </Typography>

                {error && (
                    <Alert severity="error" onClose={() => setError(null)} sx={{ width: '100%', mb: 2 }}>
                        {error}
                    </Alert>
                )}

                <Paper elevation={2} sx={{ p: 4, width: '100%' }}>
                    <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                        {steps.map((label) => (
                            <Step key={label}>
                                <StepLabel>{label}</StepLabel>
                            </Step>
                        ))}
                    </Stepper>

                    <form onSubmit={(e) => e.preventDefault()} noValidate>
                        {renderStepContent(activeStep)}

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                            <Button
                                onClick={handleBack}
                                disabled={activeStep === 0 || loading}
                            >
                                Back
                            </Button>
                            <Button
                                variant="contained"
                                color="primary"
                                onClick={handleNext}
                                disabled={!isStepValid() || loading}
                            >
                                {loading ? (
                                    <CircularProgress size={24} />
                                ) : activeStep === steps.length - 1 ? (
                                    'Create Account'
                                ) : (
                                    'Next'
                                )}
                            </Button>
                        </Box>
                    </form>
                </Paper>

                <Box sx={{ mt: 2, display: 'flex', gap: 1, alignItems: 'center' }}>
                    <Typography variant="body1">
                        Already have an account?
                    </Typography>
                    <Link to="/signin" style={{ textDecoration: 'none' }}>
                        <Typography color="primary">Sign in</Typography>
                    </Link>
                </Box>
            </Box>
        </Container>
    );
};

export default SignUp; 