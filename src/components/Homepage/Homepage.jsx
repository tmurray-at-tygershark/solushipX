import React from 'react';
import { motion } from 'framer-motion';
import {
    Box,
    Container,
    Typography,
    Button,
    Grid,
    Paper,
    Chip,
    IconButton,
    useTheme
} from '@mui/material';
import { Link } from 'react-router-dom';
import {
    LocalShipping,
    Speed,
    MonetizationOn,
    TrendingUp,
    CheckCircle
} from '@mui/icons-material';

const Homepage = () => {
    const theme = useTheme();

    const features = [
        {
            icon: <LocalShipping />,
            title: "Ship From All Your Stores with One Login",
            description: "Our 180+ integrations save you hours a month managing and shipping orders from a single app."
        },
        {
            icon: <Speed />,
            title: "Automate Repetitive Tasks",
            description: "Reduce human error and create 15x more labels per hour."
        },
        {
            icon: <MonetizationOn />,
            title: "Cut Costs, Not Corners",
            description: "SolushipX saves businesses millions by surfacing the best shipping rates."
        },
        {
            icon: <TrendingUp />,
            title: "Grow Your Business",
            description: "Customers report scaling operations over 40x with SolushipX's help. We grow with you."
        }
    ];

    const carriers = [
        'UPS', 'USPS', 'FedEx', 'DHL', 'Canada Post', 'Purolator'
    ];

    const benefits = [
        "Up to 77% off UPS Ground®",
        "Up to 83% off UPS International Services",
        "Up to 88% off USPS Retail Prices",
        "Up to 90% off FedEx Standard List Rates",
        "Up to 78% off GlobalPost Economy",
        "Up to 81% off DHL Express international shipping"
    ];

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            bgcolor: '#fff'
        }}>
            {/* Hero Section */}
            <Box sx={{
                bgcolor: '#f8f9fa',
                py: 12,
                position: 'relative',
                overflow: 'hidden',
                width: '100%'
            }}>
                <Container maxWidth="xl" sx={{ px: { xs: 2, sm: 4, md: 6, lg: 8 } }}>
                    <Grid container spacing={6} alignItems="center">
                        <Grid item xs={12} md={5}>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.6 }}
                            >
                                <Typography variant="h2" component="h1" gutterBottom>
                                    Streamline Shipments with AI-Powered Logistics Intelligence
                                </Typography>
                                <Typography variant="h5" sx={{ mb: 4, color: 'text.secondary' }}>
                                    Scalable shipping software that consolidates all your shipments,
                                    automates your workflow, and finds the best carrier rates.
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    <Button
                                        variant="contained"
                                        size="large"
                                        component={Link}
                                        to="/signup"
                                        sx={{
                                            bgcolor: '#000',
                                            '&:hover': { bgcolor: '#333' },
                                            px: 4,
                                            py: 2
                                        }}
                                    >
                                        Start Shipping Now
                                    </Button>
                                    <Typography variant="body2" sx={{ mt: 1, color: 'text.secondary' }}>
                                        No credit card required
                                    </Typography>
                                </Box>
                            </motion.div>
                        </Grid>
                        <Grid item xs={12} md={7}>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.6, delay: 0.2 }}
                            >
                                <Box
                                    component="video"
                                    autoPlay
                                    muted
                                    loop
                                    playsInline
                                    sx={{
                                        width: '100%',
                                        borderRadius: 2,
                                        boxShadow: '0 20px 40px rgba(0,0,0,0.1)',
                                        maxHeight: '600px',
                                        objectFit: 'cover'
                                    }}
                                >
                                    <source src="/video/introvideo.mp4" type="video/mp4" />
                                    Your browser does not support the video tag.
                                </Box>
                            </motion.div>
                        </Grid>
                    </Grid>
                </Container>
            </Box>

            {/* Features Section */}
            <Container maxWidth="lg" sx={{ py: 8 }}>
                <Typography variant="h3" align="center" sx={{ mb: 6, fontWeight: 700 }}>
                    The fastest, most affordable way to ship products
                </Typography>
                <Grid container spacing={4}>
                    {features.map((feature, index) => (
                        <Grid item xs={12} md={3} key={index}>
                            <Paper
                                elevation={0}
                                sx={{
                                    p: 3,
                                    height: '100%',
                                    border: '1px solid #eee',
                                    '&:hover': {
                                        boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
                                        transform: 'translateY(-4px)',
                                        transition: 'all 0.3s ease'
                                    }
                                }}
                            >
                                <Box sx={{ color: '#000', mb: 2 }}>
                                    {feature.icon}
                                </Box>
                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                                    {feature.title}
                                </Typography>
                                <Typography variant="body2" color="text.secondary">
                                    {feature.description}
                                </Typography>
                            </Paper>
                        </Grid>
                    ))}
                </Grid>
            </Container>

            {/* Carriers Section */}
            <Box sx={{ bgcolor: '#f8f9fa', py: 8 }}>
                <Container maxWidth="lg">
                    <Typography variant="h3" align="center" sx={{ mb: 6, fontWeight: 700 }}>
                        Connect to more carriers and selling channels
                    </Typography>
                    <Grid container spacing={3} justifyContent="center">
                        {carriers.map((carrier, index) => (
                            <Grid item key={index}>
                                <Paper
                                    elevation={0}
                                    sx={{
                                        p: 2,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        minWidth: 120,
                                        border: '1px solid #eee'
                                    }}
                                >
                                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                        {carrier}
                                    </Typography>
                                </Paper>
                            </Grid>
                        ))}
                    </Grid>
                </Container>
            </Box>

            {/* Benefits Section */}
            <Container maxWidth="lg" sx={{ py: 8 }}>
                <Typography variant="h3" align="center" sx={{ mb: 6, fontWeight: 700 }}>
                    Find the lowest shipping rate
                </Typography>
                <Grid container spacing={3}>
                    {benefits.map((benefit, index) => (
                        <Grid item xs={12} md={6} key={index}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                <CheckCircle sx={{ color: '#000' }} />
                                <Typography variant="body1">{benefit}</Typography>
                            </Box>
                        </Grid>
                    ))}
                </Grid>
                <Box sx={{ textAlign: 'center', mt: 6 }}>
                    <Button
                        variant="contained"
                        size="large"
                        component={Link}
                        to="/signup"
                        sx={{
                            bgcolor: '#000',
                            '&:hover': { bgcolor: '#333' },
                            px: 4,
                            py: 2
                        }}
                    >
                        Start Saving on Shipping
                    </Button>
                </Box>
            </Container>
        </Box>
    );
};

export default Homepage; 