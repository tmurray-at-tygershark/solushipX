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
    IconButton,
    InputAdornment,
    Divider,
    Alert
} from '@mui/material';
import {
    Visibility,
    VisibilityOff,
    Google as GoogleIcon,
    Microsoft as MicrosoftIcon
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const Login = () => {
    const navigate = useNavigate();
    const { login, resetPassword, signInWithGoogle, error: authError, userRole } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetEmail, setResetEmail] = useState('');
    const [resetSent, setResetSent] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            await login(email, password);
            // Check user role and redirect accordingly
            const redirectPath = ['admin', 'super_admin', 'business_admin'].includes(userRole)
                ? '/admin'
                : '/dashboard';
            console.log('Login successful, redirecting to:', redirectPath);
            setTimeout(() => {
                navigate(redirectPath);
            }, 100);
        } catch (err) {
            console.error('Login error:', err);
            setError(err.message || 'Invalid email or password');
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setIsLoading(true);
        setError('');

        try {
            await signInWithGoogle();
            // Check user role and redirect accordingly
            const redirectPath = ['admin', 'super_admin', 'business_admin'].includes(userRole)
                ? '/admin'
                : '/dashboard';
            console.log('Google login successful, redirecting to:', redirectPath);
            navigate(redirectPath);
        } catch (err) {
            console.error('Google login error:', err);
            setError(err.message || 'Failed to sign in with Google');
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            await resetPassword(resetEmail);
            setResetSent(true);
        } catch (err) {
            console.error('Password reset error:', err);
            setError(err.message || 'Failed to send reset email');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                bgcolor: '#f8f9fa',
                py: 8,
                display: 'flex',
                alignItems: 'center'
            }}
        >
            <Container maxWidth="sm">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <Box sx={{ textAlign: 'center', mb: 4 }}>
                        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
                            Welcome back
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Sign in to continue to SolushipX
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
                        {!showForgotPassword ? (
                            // Login Form
                            <form onSubmit={handleLogin}>
                                {error && (
                                    <Alert severity="error" sx={{ mb: 3 }}>
                                        {error}
                                    </Alert>
                                )}

                                <TextField
                                    fullWidth
                                    label="Email Address"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    margin="normal"
                                    required
                                    autoFocus
                                />

                                <TextField
                                    fullWidth
                                    label="Password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    margin="normal"
                                    required
                                    InputProps={{
                                        endAdornment: (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    edge="end"
                                                >
                                                    {showPassword ? <VisibilityOff /> : <Visibility />}
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                    }}
                                />

                                <Box sx={{ mt: 1, mb: 3, textAlign: 'right' }}>
                                    <MuiLink
                                        component="button"
                                        variant="body2"
                                        onClick={() => setShowForgotPassword(true)}
                                        sx={{ textDecoration: 'none' }}
                                    >
                                        Forgot password?
                                    </MuiLink>
                                </Box>

                                <Button
                                    fullWidth
                                    variant="contained"
                                    type="submit"
                                    disabled={isLoading}
                                    sx={{
                                        bgcolor: '#000',
                                        '&:hover': { bgcolor: '#333' },
                                        py: 1.5
                                    }}
                                >
                                    {isLoading ? 'Signing in...' : 'Sign in'}
                                </Button>

                                <Divider sx={{ my: 3 }}>or</Divider>

                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <Button
                                        fullWidth
                                        variant="outlined"
                                        startIcon={<GoogleIcon />}
                                        sx={{ py: 1.5 }}
                                        onClick={handleGoogleLogin}
                                    >
                                        Continue with Google
                                    </Button>
                                    <Button
                                        fullWidth
                                        variant="outlined"
                                        startIcon={<MicrosoftIcon />}
                                        sx={{ py: 1.5 }}
                                    >
                                        Continue with Microsoft
                                    </Button>
                                </Box>
                            </form>
                        ) : (
                            // Forgot Password Form
                            <form onSubmit={handleForgotPassword}>
                                {error && (
                                    <Alert severity="error" sx={{ mb: 3 }}>
                                        {error}
                                    </Alert>
                                )}

                                {resetSent ? (
                                    <Alert severity="success" sx={{ mb: 3 }}>
                                        Password reset instructions have been sent to your email.
                                    </Alert>
                                ) : (
                                    <>
                                        <Typography variant="body1" sx={{ mb: 3 }}>
                                            Enter your email address and we'll send you instructions to reset your password.
                                        </Typography>

                                        <TextField
                                            fullWidth
                                            label="Email Address"
                                            type="email"
                                            value={resetEmail}
                                            onChange={(e) => setResetEmail(e.target.value)}
                                            margin="normal"
                                            required
                                            autoFocus
                                        />

                                        <Button
                                            fullWidth
                                            variant="contained"
                                            type="submit"
                                            disabled={isLoading}
                                            sx={{
                                                bgcolor: '#000',
                                                '&:hover': { bgcolor: '#333' },
                                                py: 1.5,
                                                mt: 3
                                            }}
                                        >
                                            {isLoading ? 'Sending...' : 'Send Reset Instructions'}
                                        </Button>
                                    </>
                                )}

                                <Box sx={{ mt: 3, textAlign: 'center' }}>
                                    <MuiLink
                                        component="button"
                                        variant="body2"
                                        onClick={() => {
                                            setShowForgotPassword(false);
                                            setResetSent(false);
                                            setResetEmail('');
                                        }}
                                        sx={{ textDecoration: 'none' }}
                                    >
                                        Back to Sign in
                                    </MuiLink>
                                </Box>
                            </form>
                        )}
                    </Paper>

                    <Box sx={{ textAlign: 'center', mt: 3 }}>
                        <Typography variant="body2" color="text.secondary">
                            Don't have an account?{' '}
                            <MuiLink
                                component={Link}
                                to="/signup"
                                sx={{ textDecoration: 'none', fontWeight: 500 }}
                            >
                                Sign up
                            </MuiLink>
                        </Typography>
                    </Box>
                </motion.div>
            </Container>
        </Box>
    );
};

export default Login; 