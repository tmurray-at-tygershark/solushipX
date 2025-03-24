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

const steps = ['Account Details', 'Business Information', 'Shipping Profile'];

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
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Account Details
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [phone, setPhone] = useState('');

    // Business Information
    const [companyName, setCompanyName] = useState('');
    const [website, setWebsite] = useState('');
    const [monthlyShipments, setMonthlyShipments] = useState('');
    const [street, setStreet] = useState('');
    const [street2, setStreet2] = useState('');
    const [city, setCity] = useState('');
    const [state, setState] = useState('');
    const [postalCode, setPostalCode] = useState('');
    const [country, setCountry] = useState('US');

    // Shipping Profile
    const [preferredCarriers, setPreferredCarriers] = useState([]);
    const [integrationsNeeded, setIntegrationsNeeded] = useState([]);
    const [marketplaces, setMarketplaces] = useState([]);

    // Terms and Marketing
    const [acceptTerms, setAcceptTerms] = useState(false);
    const [acceptMarketing, setAcceptMarketing] = useState(false);

    const handleNext = () => {
        if (activeStep === steps.length - 1) {
            handleSignup();
        } else {
            setActiveStep((prevStep) => prevStep + 1);
        }
    };

    const handleBack = () => {
        setActiveStep((prevStep) => prevStep - 1);
    };

    const handleSignup = async () => {
        setIsLoading(true);
        setError('');

        try {
            // TODO: Implement actual signup logic here
            await new Promise(resolve => setTimeout(resolve, 1000)); // Simulated delay
            navigate('/dashboard');
        } catch (err) {
            setError('Failed to create account. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const renderStepContent = (step) => {
        switch (step) {
            case 0:
                return (
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="First Name"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                required
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Last Name"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                required
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Email Address"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Phone Number"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                required
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Password"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                helperText="Must be at least 8 characters long"
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Confirm Password"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </Grid>
                    </Grid>
                );

            case 1:
                return (
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Company Name"
                                value={companyName}
                                onChange={(e) => setCompanyName(e.target.value)}
                                required
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Website"
                                value={website}
                                onChange={(e) => setWebsite(e.target.value)}
                                placeholder="https://"
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <FormControl fullWidth required>
                                <InputLabel>Monthly Shipments</InputLabel>
                                <Select
                                    value={monthlyShipments}
                                    label="Monthly Shipments"
                                    onChange={(e) => setMonthlyShipments(e.target.value)}
                                >
                                    {monthlyShipmentOptions.map((option) => (
                                        <MenuItem key={option.value} value={option.value}>
                                            {option.label}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Street Address"
                                value={street}
                                onChange={(e) => setStreet(e.target.value)}
                                required
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Suite, Floor, etc. (optional)"
                                value={street2}
                                onChange={(e) => setStreet2(e.target.value)}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="City"
                                value={city}
                                onChange={(e) => setCity(e.target.value)}
                                required
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="State/Province"
                                value={state}
                                onChange={(e) => setState(e.target.value)}
                                required
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Postal Code"
                                value={postalCode}
                                onChange={(e) => setPostalCode(e.target.value)}
                                required
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth required>
                                <InputLabel>Country</InputLabel>
                                <Select
                                    value={country}
                                    label="Country"
                                    onChange={(e) => setCountry(e.target.value)}
                                >
                                    <MenuItem value="US">United States</MenuItem>
                                    <MenuItem value="CA">Canada</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                );

            case 2:
                return (
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel>Preferred Carriers</InputLabel>
                                <Select
                                    multiple
                                    value={preferredCarriers}
                                    onChange={(e) => setPreferredCarriers(e.target.value)}
                                    label="Preferred Carriers"
                                >
                                    <MenuItem value="ups">UPS</MenuItem>
                                    <MenuItem value="fedex">FedEx</MenuItem>
                                    <MenuItem value="usps">USPS</MenuItem>
                                    <MenuItem value="dhl">DHL</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <FormControl fullWidth>
                                <InputLabel>Marketplaces</InputLabel>
                                <Select
                                    multiple
                                    value={marketplaces}
                                    onChange={(e) => setMarketplaces(e.target.value)}
                                    label="Marketplaces"
                                >
                                    <MenuItem value="amazon">Amazon</MenuItem>
                                    <MenuItem value="ebay">eBay</MenuItem>
                                    <MenuItem value="shopify">Shopify</MenuItem>
                                    <MenuItem value="walmart">Walmart</MenuItem>
                                    <MenuItem value="etsy">Etsy</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={acceptTerms}
                                        onChange={(e) => setAcceptTerms(e.target.checked)}
                                        required
                                    />
                                }
                                label={
                                    <Typography variant="body2">
                                        I agree to the{' '}
                                        <MuiLink href="#" target="_blank">
                                            Terms of Service
                                        </MuiLink>
                                        {' '}and{' '}
                                        <MuiLink href="#" target="_blank">
                                            Privacy Policy
                                        </MuiLink>
                                    </Typography>
                                }
                            />
                        </Grid>
                        <Grid item xs={12}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={acceptMarketing}
                                        onChange={(e) => setAcceptMarketing(e.target.checked)}
                                    />
                                }
                                label="I'd like to receive shipping tips, product updates and industry news"
                            />
                        </Grid>
                    </Grid>
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
                        {error && (
                            <Alert severity="error" sx={{ mb: 3 }}>
                                {error}
                            </Alert>
                        )}

                        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
                            {steps.map((label) => (
                                <Step key={label}>
                                    <StepLabel>{label}</StepLabel>
                                </Step>
                            ))}
                        </Stepper>

                        <Box sx={{ mb: 4 }}>
                            {renderStepContent(activeStep)}
                        </Box>

                        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                            <Button
                                onClick={handleBack}
                                disabled={activeStep === 0}
                                sx={{ visibility: activeStep === 0 ? 'hidden' : 'visible' }}
                            >
                                Back
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleNext}
                                disabled={isLoading}
                                sx={{
                                    bgcolor: '#000',
                                    '&:hover': { bgcolor: '#333' }
                                }}
                            >
                                {isLoading
                                    ? 'Creating Account...'
                                    : activeStep === steps.length - 1
                                        ? 'Create Account'
                                        : 'Next'}
                            </Button>
                        </Box>

                        {activeStep === 0 && (
                            <>
                                <Divider sx={{ my: 3 }}>or</Divider>
                                <Button
                                    fullWidth
                                    variant="outlined"
                                    startIcon={<GoogleIcon />}
                                    sx={{ py: 1.5 }}
                                >
                                    Continue with Google
                                </Button>
                            </>
                        )}
                    </Paper>

                    <Box sx={{ textAlign: 'center', mt: 3 }}>
                        <Typography variant="body2" color="text.secondary">
                            Already have an account?{' '}
                            <MuiLink
                                component={Link}
                                to="/login"
                                sx={{ textDecoration: 'none', fontWeight: 500 }}
                            >
                                Sign in
                            </MuiLink>
                        </Typography>
                    </Box>
                </motion.div>
            </Container>
        </Box>
    );
};

export default Signup; 