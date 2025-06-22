import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Button,
    Alert,
    CircularProgress,
    InputAdornment,
    IconButton,
    Container,
    LinearProgress,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Chip
} from '@mui/material';
import {
    Visibility,
    VisibilityOff,
    Lock as LockIcon,
    CheckCircle as CheckCircleIcon,
    Check as CheckIcon,
    Close as CloseIcon,
    Security as SecurityIcon,
    Timer as TimerIcon
} from '@mui/icons-material';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';

const SetPassword = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        password: '',
        confirmPassword: ''
    });
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [validating, setValidating] = useState(true);
    const [tokenValid, setTokenValid] = useState(false);
    const [userEmail, setUserEmail] = useState('');
    const [passwordStrength, setPasswordStrength] = useState(0);
    const [passwordRequirements, setPasswordRequirements] = useState({
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        special: false
    });
    const [showConfirmField, setShowConfirmField] = useState(false);

    const token = searchParams.get('token');
    const email = searchParams.get('email');

    useEffect(() => {
        if (!token || !email) {
            setError('Invalid invitation link. Please contact your administrator for a new invitation.');
            setValidating(false);
            return;
        }

        setUserEmail(email);
        setTokenValid(true);
        setValidating(false);
    }, [token, email]);

    const checkPasswordStrength = (password) => {
        const requirements = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /\d/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        };

        const score = Object.values(requirements).filter(Boolean).length;
        setPasswordRequirements(requirements);
        setPasswordStrength(score);

        // Show confirm field when password meets minimum requirements
        const meetsMinimum = requirements.length && score >= 3;
        setShowConfirmField(meetsMinimum);

        return { requirements, score, meetsMinimum };
    };

    const getPasswordStrengthColor = (score) => {
        if (score <= 2) return '#f44336'; // Red
        if (score <= 3) return '#ff9800'; // Orange
        if (score <= 4) return '#2196f3'; // Blue
        return '#4caf50'; // Green
    };

    const getPasswordStrengthText = (score) => {
        if (score <= 2) return 'Weak';
        if (score <= 3) return 'Fair';
        if (score <= 4) return 'Good';
        return 'Strong';
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));

        // Check password strength for password field
        if (name === 'password') {
            checkPasswordStrength(value);
        }

        // Clear error when user starts typing
        if (error) {
            setError('');
        }
    };

    const validateForm = () => {
        if (!formData.password) {
            setError('Password is required.');
            return false;
        }

        if (passwordStrength < 3) {
            setError('Password must meet at least 3 security requirements.');
            return false;
        }

        if (!passwordRequirements.length) {
            setError('Password must be at least 8 characters long.');
            return false;
        }

        if (formData.password !== formData.confirmPassword) {
            setError('Passwords do not match.');
            return false;
        }

        return true;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        setLoading(true);
        setError('');

        try {
            const verifyInviteAndSetPassword = httpsCallable(functions, 'verifyInviteAndSetPassword');
            const result = await verifyInviteAndSetPassword({
                token: token,
                newPassword: formData.password
            });

            if (result.data.status === 'success') {
                setSuccess(true);
                setTimeout(() => {
                    navigate('/login', {
                        state: {
                            message: 'Password set successfully! You can now sign in with your new password.',
                            email: userEmail
                        }
                    });
                }, 2000);
            }
        } catch (error) {
            console.error('Error setting password:', error);

            if (error.code === 'functions/failed-precondition') {
                setError('This invitation has already been used or has expired. Please contact your administrator for a new invitation.');
            } else if (error.code === 'functions/invalid-argument') {
                setError(error.message || 'Invalid invitation. Please check your invitation link.');
            } else {
                setError('Failed to set password. Please try again or contact your administrator.');
            }
        } finally {
            setLoading(false);
        }
    };

    if (validating) {
        return (
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#000000'
                }}
            >
                <CircularProgress sx={{ color: 'white' }} />
            </Box>
        );
    }

    if (!tokenValid) {
        return (
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: '#000000'
                }}
            >
                {/* Header with Logo */}
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        py: 2
                    }}
                >
                    <img
                        src="/images/integratedcarrriers_logo_white.png"
                        alt="Integrated Carriers"
                        style={{
                            height: '40px'
                        }}
                    />
                </Box>

                {/* Main Content */}
                <Container maxWidth="xs" sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                    <Paper
                        elevation={8}
                        sx={{
                            p: 3,
                            width: '100%',
                            textAlign: 'center',
                            borderRadius: 2,
                            backgroundColor: '#ffffff'
                        }}
                    >
                        <LockIcon sx={{ fontSize: 48, color: '#f44336', mb: 2 }} />
                        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: '#1e293b', fontSize: '20px' }}>
                            Invalid Invitation
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 2, color: '#64748b', fontSize: '14px' }}>
                            This invitation link is invalid or has expired.
                        </Typography>
                        <Alert severity="error" sx={{ mt: 1, mb: 2, fontSize: '12px' }}>
                            {error}
                        </Alert>
                        <Button
                            variant="contained"
                            onClick={() => navigate('/login')}
                            size="small"
                            sx={{
                                mt: 1,
                                px: 3,
                                py: 1,
                                backgroundColor: '#1c277d',
                                fontSize: '14px',
                                '&:hover': {
                                    backgroundColor: '#2563eb',
                                },
                            }}
                        >
                            Go to Login
                        </Button>
                    </Paper>
                </Container>
            </Box>
        );
    }

    if (success) {
        return (
            <Box
                sx={{
                    minHeight: '100vh',
                    display: 'flex',
                    flexDirection: 'column',
                    backgroundColor: '#000000'
                }}
            >
                {/* Header with Logo */}
                <Box
                    sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        py: 2
                    }}
                >
                    <img
                        src="/images/integratedcarrriers_logo_white.png"
                        alt="Integrated Carriers"
                        style={{
                            height: '40px'
                        }}
                    />
                </Box>

                {/* Main Content */}
                <Container maxWidth="xs" sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                    <Paper
                        elevation={8}
                        sx={{
                            p: 3,
                            width: '100%',
                            textAlign: 'center',
                            borderRadius: 2,
                            backgroundColor: '#ffffff'
                        }}
                    >
                        <CheckCircleIcon sx={{ fontSize: 48, color: '#10b981', mb: 2 }} />
                        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: '#1e293b', fontSize: '20px' }}>
                            Welcome to Integrated Carriers!
                        </Typography>
                        <Typography variant="subtitle1" sx={{ mb: 1, color: '#059669', fontWeight: 500, fontSize: '16px' }}>
                            Password Set Successfully
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 3, color: '#64748b', lineHeight: 1.5, fontSize: '14px' }}>
                            Your account is ready! Redirecting to login...
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                            <CircularProgress size={16} sx={{ color: '#1c277d' }} />
                            <Typography variant="body2" sx={{ color: '#64748b', fontSize: '12px' }}>
                                Redirecting...
                            </Typography>
                        </Box>
                    </Paper>
                </Container>
            </Box>
        );
    }

    return (
        <Box
            sx={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: '#000000'
            }}
        >
            {/* Header with Logo */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    py: 2
                }}
            >
                <img
                    src="/images/integratedcarrriers_logo_white.png"
                    alt="Integrated Carriers"
                    style={{
                        height: '40px'
                    }}
                />
            </Box>

            {/* Main Content */}
            <Container maxWidth="xs" sx={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <Paper
                    elevation={8}
                    sx={{
                        p: 3,
                        width: '100%',
                        borderRadius: 2,
                        backgroundColor: '#ffffff'
                    }}
                >
                    <Box sx={{ textAlign: 'center', mb: 2 }}>
                        <SecurityIcon sx={{ fontSize: 32, color: '#1c277d', mb: 1 }} />
                        <Typography variant="h5" gutterBottom sx={{ fontWeight: 600, color: '#1e293b', fontSize: '18px' }}>
                            Welcome!
                        </Typography>
                        <Typography variant="subtitle1" sx={{ mb: 1, color: '#1c277d', fontWeight: 500, fontSize: '14px' }}>
                            Set Your Secure Password
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#64748b', mb: 1, lineHeight: 1.4, fontSize: '12px' }}>
                            Create a strong password to protect your account.
                        </Typography>

                        {/* Security & Expiration Info */}
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mb: 1 }}>
                            <Chip
                                icon={<SecurityIcon />}
                                label="Secure Setup"
                                size="small"
                                sx={{ fontSize: '10px', height: '20px' }}
                                color="primary"
                                variant="outlined"
                            />
                            <Chip
                                icon={<TimerIcon />}
                                label="24h Link"
                                size="small"
                                sx={{ fontSize: '10px', height: '20px' }}
                                color="warning"
                                variant="outlined"
                            />
                        </Box>

                        {userEmail && (
                            <Box sx={{
                                backgroundColor: '#f0f9ff',
                                p: 1,
                                borderRadius: 1,
                                border: '1px solid #bae6fd',
                                mt: 1
                            }}>
                                <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 500, fontSize: '11px' }}>
                                    {userEmail}
                                </Typography>
                            </Box>
                        )}
                    </Box>

                    <form onSubmit={handleSubmit}>
                        <TextField
                            fullWidth
                            name="password"
                            label="Create Password"
                            type={showPassword ? 'text' : 'password'}
                            value={formData.password}
                            onChange={handleInputChange}
                            margin="dense"
                            required
                            size="small"
                            helperText="Must meet security requirements below"
                            InputProps={{
                                style: { fontSize: '14px' },
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton
                                            onClick={() => setShowPassword(!showPassword)}
                                            edge="end"
                                            size="small"
                                        >
                                            {showPassword ? <VisibilityOff /> : <Visibility />}
                                        </IconButton>
                                    </InputAdornment>
                                ),
                            }}
                            InputLabelProps={{
                                style: { fontSize: '14px' }
                            }}
                            FormHelperTextProps={{
                                style: { fontSize: '11px' }
                            }}
                        />

                        {/* Password Strength Indicator */}
                        {formData.password && (
                            <Box sx={{ mt: 1, mb: 1 }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                    <Typography variant="caption" sx={{ fontSize: '11px', color: '#64748b' }}>
                                        Strength:
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        sx={{
                                            fontSize: '11px',
                                            fontWeight: 600,
                                            color: getPasswordStrengthColor(passwordStrength)
                                        }}
                                    >
                                        {getPasswordStrengthText(passwordStrength)}
                                    </Typography>
                                </Box>
                                <LinearProgress
                                    variant="determinate"
                                    value={(passwordStrength / 5) * 100}
                                    sx={{
                                        height: 4,
                                        borderRadius: 2,
                                        backgroundColor: '#e5e7eb',
                                        '& .MuiLinearProgress-bar': {
                                            backgroundColor: getPasswordStrengthColor(passwordStrength),
                                            borderRadius: 2,
                                        },
                                    }}
                                />
                            </Box>
                        )}

                        {/* Password Requirements Checklist */}
                        {formData.password && (
                            <Box sx={{ mt: 1, mb: 2 }}>
                                <Typography variant="caption" sx={{ fontSize: '11px', color: '#64748b', mb: 0.5, display: 'block' }}>
                                    Requirements:
                                </Typography>
                                <List dense sx={{ py: 0 }}>
                                    {[
                                        { key: 'length', text: 'At least 8 characters' },
                                        { key: 'uppercase', text: 'One uppercase letter' },
                                        { key: 'lowercase', text: 'One lowercase letter' },
                                        { key: 'number', text: 'One number' },
                                        { key: 'special', text: 'One special character' }
                                    ].map((req) => (
                                        <ListItem key={req.key} sx={{ py: 0, px: 0, minHeight: 'auto' }}>
                                            <ListItemIcon sx={{ minWidth: 20 }}>
                                                {passwordRequirements[req.key] ? (
                                                    <CheckIcon sx={{ fontSize: 14, color: '#4caf50' }} />
                                                ) : (
                                                    <CloseIcon sx={{ fontSize: 14, color: '#f44336' }} />
                                                )}
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={req.text}
                                                primaryTypographyProps={{
                                                    fontSize: '11px',
                                                    color: passwordRequirements[req.key] ? '#4caf50' : '#64748b'
                                                }}
                                            />
                                        </ListItem>
                                    ))}
                                </List>
                            </Box>
                        )}

                        {/* Progressive Confirm Password Field */}
                        {showConfirmField && (
                            <TextField
                                fullWidth
                                name="confirmPassword"
                                label="Confirm Password"
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={formData.confirmPassword}
                                onChange={handleInputChange}
                                margin="dense"
                                required
                                size="small"
                                helperText="Re-enter your password"
                                InputProps={{
                                    style: { fontSize: '14px' },
                                    endAdornment: (
                                        <InputAdornment position="end">
                                            <IconButton
                                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                                edge="end"
                                                size="small"
                                            >
                                                {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
                                            </IconButton>
                                        </InputAdornment>
                                    ),
                                }}
                                InputLabelProps={{
                                    style: { fontSize: '14px' }
                                }}
                                FormHelperTextProps={{
                                    style: { fontSize: '11px' }
                                }}
                            />
                        )}

                        {error && (
                            <Alert severity="error" sx={{ mt: 1, fontSize: '12px', py: 0.5 }}>
                                {error}
                            </Alert>
                        )}

                        <Button
                            type="submit"
                            fullWidth
                            variant="contained"
                            disabled={loading || passwordStrength < 3 || !showConfirmField}
                            size="small"
                            sx={{
                                mt: 2,
                                mb: 1,
                                py: 1,
                                backgroundColor: passwordStrength >= 3 ? '#1c277d' : '#9ca3af',
                                fontSize: '14px',
                                fontWeight: 500,
                                '&:hover': {
                                    backgroundColor: passwordStrength >= 3 ? '#2563eb' : '#9ca3af',
                                },
                                '&:disabled': {
                                    backgroundColor: '#9ca3af',
                                    color: '#ffffff'
                                }
                            }}
                        >
                            {loading ? (
                                <>
                                    <CircularProgress size={16} sx={{ mr: 1, color: 'white' }} />
                                    Setting Password...
                                </>
                            ) : (
                                passwordStrength >= 3 ? 'SET SECURE PASSWORD' : 'MEET REQUIREMENTS FIRST'
                            )}
                        </Button>

                        <Box sx={{ textAlign: 'center', mt: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>
                                Need help?{' '}
                                <Button
                                    variant="text"
                                    size="small"
                                    onClick={() => navigate('/login')}
                                    sx={{ fontSize: '11px', p: 0, minWidth: 'auto' }}
                                >
                                    Contact Admin
                                </Button>
                            </Typography>
                        </Box>
                    </form>
                </Paper>
            </Container>
        </Box>
    );
};

export default SetPassword; 