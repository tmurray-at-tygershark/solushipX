import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
    Box,
    Container,
    Paper,
    Typography,
    TextField,
    Button,
    Link as MuiLink,
    Stepper,
    Step,
    StepLabel,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    FormControlLabel,
    Checkbox,
    Alert,
    Divider
} from '@mui/material';
import { Google as GoogleIcon } from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import CreditCardInput from './CreditCardInput';

const steps = ['Account Details', 'Business Information', 'Shipping Profile', 'Payment Information'];

const monthlyShipmentOptions = [
    { value: '1-50', label: '1-50 shipments per month' },
    { value: '51-200', label: '51-200 shipments per month' },
    { value: '201-500', label: '201-500 shipments per month' },
    { value: '501-2000', label: '501-2,000 shipments per month' },
    { value: '2000+', label: '2,000+ shipments per month' }
];

const Signup = () => {
    const navigate = useNavigate();
    const [activeStep, setActiveStep] = useState(0);
    const [formData, setFormData] = useState({
        email: '',
        password: '',
        confirmPassword: '',
        companyName: '',
        monthlyShipments: '',
        integrationsNeeded: [],
        shippingProfile: {
            address: '',
            city: '',
            state: '',
            postalCode: '',
            country: ''
        },
        cardDetails: null
    });
    const [error, setError] = useState('');
    const [cardError, setCardError] = useState('');

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

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleShippingProfileChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            shippingProfile: {
                ...prev.shippingProfile,
                [field]: value
            }
        }));
    };

    const handleCardChange = (cardDetails) => {
        setFormData(prev => ({
            ...prev,
            cardDetails
        }));
    };

    const validateStep = () => {
        switch (activeStep) {
            case 0:
                if (!formData.email || !formData.password || !formData.confirmPassword) {
                    setError('Please fill in all fields');
                    return false;
                }
                if (formData.password !== formData.confirmPassword) {
                    setError('Passwords do not match');
                    return false;
                }
                break;
            case 1:
                if (!formData.companyName || !formData.monthlyShipments) {
                    setError('Please fill in all fields');
                    return false;
                }
                break;
            case 2:
                const { shippingProfile } = formData;
                if (!shippingProfile.address || !shippingProfile.city ||
                    !shippingProfile.state || !shippingProfile.postalCode ||
                    !shippingProfile.country) {
                    setError('Please fill in all shipping profile fields');
                    return false;
                }
                break;
            case 3:
                if (!formData.cardDetails) {
                    setCardError('Please enter your payment information');
                    return false;
                }
                const { cardNumber, expiry, cvv, cardHolder } = formData.cardDetails;
                if (!cardNumber || !expiry || !cvv || !cardHolder) {
                    setCardError('Please fill in all card details');
                    return false;
                }
                if (cardNumber.replace(/\s/g, '').length !== 16) {
                    setCardError('Invalid card number');
                    return false;
                }
                if (!/^(0[1-9]|1[0-2])\/([0-9]{2})$/.test(expiry)) {
                    setCardError('Invalid expiry date');
                    return false;
                }
                if (cvv.length < 3) {
                    setCardError('Invalid CVV');
                    return false;
                }
                break;
        }
        setError('');
        setCardError('');
        return true;
    };

    const handleSubmit = async () => {
        if (!validateStep()) return;

        try {
            // TODO: Implement actual signup logic here
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulated delay
            navigate('/dashboard');
        } catch (err) {
            setError('Failed to create account. Please try again.');
        }
    };

    const renderStepContent = (step) => {
        switch (step) {
            case 0:
                return (
                    <Box sx={{ display: 'grid', gap: 2 }}>
                        <TextField
                            fullWidth
                            label="Email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => handleInputChange('email', e.target.value)}
                            required
                        />
                        <TextField
                            fullWidth
                            label="Password"
                            type="password"
                            value={formData.password}
                            onChange={(e) => handleInputChange('password', e.target.value)}
                            required
                        />
                        <TextField
                            fullWidth
                            label="Confirm Password"
                            type="password"
                            value={formData.confirmPassword}
                            onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                            required
                        />
                    </Box>
                );
            case 1:
                return (
                    <Box sx={{ display: 'grid', gap: 2 }}>
                        <TextField
                            fullWidth
                            label="Company Name"
                            value={formData.companyName}
                            onChange={(e) => handleInputChange('companyName', e.target.value)}
                            required
                        />
                        <FormControl fullWidth required>
                            <InputLabel>Monthly Shipments</InputLabel>
                            <Select
                                value={formData.monthlyShipments}
                                onChange={(e) => handleInputChange('monthlyShipments', e.target.value)}
                                label="Monthly Shipments"
                            >
                                {monthlyShipmentOptions.map((option) => (
                                    <MenuItem key={option.value} value={option.value}>
                                        {option.label}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                );
            case 2:
                return (
                    <Box sx={{ display: 'grid', gap: 2 }}>
                        <TextField
                            fullWidth
                            label="Address"
                            value={formData.shippingProfile.address}
                            onChange={(e) => handleShippingProfileChange('address', e.target.value)}
                            required
                        />
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="City"
                                    value={formData.shippingProfile.city}
                                    onChange={(e) => handleShippingProfileChange('city', e.target.value)}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="State/Province"
                                    value={formData.shippingProfile.state}
                                    onChange={(e) => handleShippingProfileChange('state', e.target.value)}
                                    required
                                />
                            </Grid>
                        </Grid>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Postal Code"
                                    value={formData.shippingProfile.postalCode}
                                    onChange={(e) => handleShippingProfileChange('postalCode', e.target.value)}
                                    required
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <TextField
                                    fullWidth
                                    label="Country"
                                    value={formData.shippingProfile.country}
                                    onChange={(e) => handleShippingProfileChange('country', e.target.value)}
                                    required
                                />
                            </Grid>
                        </Grid>
                    </Box>
                );
            case 3:
                return (
                    <CreditCardInput
                        onCardChange={handleCardChange}
                        error={cardError}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                bgcolor: '#f8f9fa',
                py: 8
            }}
        >
            <Container maxWidth="md">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <Box sx={{ textAlign: 'center', mb: 4 }}>
                        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
                            Start shipping with SolushipX
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Create your account to start saving time and money on shipping
                        </Typography>
                    </Box>

                    <Paper
                        elevation={0}
                        sx={{
                            p: 4,
                            border: '1px solid #eee',
                            borderRadius: 2
                        }}
                    >
                        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                            {steps.map((label) => (
                                <Step key={label}>
                                    <StepLabel>{label}</StepLabel>
                                </Step>
                            ))}
                        </Stepper>

                        {error && (
                            <Alert severity="error" sx={{ mb: 2 }}>
                                {error}
                            </Alert>
                        )}

                        {renderStepContent(activeStep)}

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                            <Button
                                onClick={handleBack}
                                disabled={activeStep === 0}
                                sx={{ color: 'text.primary' }}
                            >
                                Back
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleNext}
                                disabled={activeStep === steps.length - 1}
                                sx={{
                                    bgcolor: '#000',
                                    '&:hover': { bgcolor: '#333' }
                                }}
                            >
                                {activeStep === steps.length - 1 ? 'Create Account' : 'Next'}
                            </Button>
                        </Box>

                        <Divider sx={{ my: 4 }} />

                        <Box sx={{ textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary" gutterBottom>
                                Already have an account?
                            </Typography>
                            <MuiLink
                                component={Link}
                                to="/login"
                                sx={{
                                    color: '#000',
                                    textDecoration: 'none',
                                    fontWeight: 500,
                                    '&:hover': { textDecoration: 'underline' }
                                }}
                            >
                                Sign in
                            </MuiLink>
                        </Box>
                    </Paper>
                </motion.div>
            </Container>
        </Box>
    );
};

export default Signup; 