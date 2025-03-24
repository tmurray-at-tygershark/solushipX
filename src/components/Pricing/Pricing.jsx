import React from 'react';
import {
    Box,
    Container,
    Typography,
    Button,
    Grid,
    Paper,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Divider,
    useTheme
} from '@mui/material';
import { Link } from 'react-router-dom';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { motion } from 'framer-motion';

const Pricing = () => {
    const theme = useTheme();

    const plans = [
        {
            name: 'Starter',
            price: '$9.99',
            period: 'month',
            shipments: '50 shipments/month',
            description: 'Perfect for small businesses just getting started',
            features: [
                '1 user',
                'Email support',
                'Best discounted shipping rates from USPS, UPS, DHL, FedEx',
                'Access to 300+ integrations',
                'Basic reporting',
                'Standard label generation'
            ],
            cta: 'Start Free Trial',
            popular: false
        },
        {
            name: 'Growth',
            price: '$29.99',
            period: 'month',
            shipments: '500 shipments/month',
            description: 'Ideal for growing businesses',
            features: [
                'All Starter features',
                'Live Chat support',
                '24/7 support',
                'Branded tracking',
                'Custom labels',
                'Advanced reporting',
                'API access',
                '3 users'
            ],
            cta: 'Start Free Trial',
            popular: true
        },
        {
            name: 'Scale',
            price: '$99.99',
            period: 'month',
            shipments: '2,000 shipments/month',
            description: 'For businesses with high shipping volume',
            features: [
                'All Growth features',
                'Unlimited users',
                'Priority support',
                'Custom integrations',
                'Advanced analytics',
                'Dedicated account manager',
                'Custom workflows',
                'White-label options'
            ],
            cta: 'Start Free Trial',
            popular: false
        },
        {
            name: 'Enterprise',
            price: 'Custom',
            period: '',
            shipments: 'Unlimited shipments',
            description: 'For large organizations with complex shipping needs',
            features: [
                'All Scale features',
                'Custom development',
                'Dedicated support team',
                'SLA guarantees',
                'Custom reporting',
                'Advanced security',
                'Multi-location support',
                'Custom training'
            ],
            cta: 'Contact Sales',
            popular: false
        }
    ];

    return (
        <Box sx={{ bgcolor: '#fff', py: 8 }}>
            <Container maxWidth="lg">
                <Box sx={{ textAlign: 'center', mb: 8 }}>
                    <Typography variant="h2" component="h1" gutterBottom sx={{ fontWeight: 700 }}>
                        Shipping plans that fit your business
                    </Typography>
                    <Typography variant="h5" color="text.secondary" sx={{ mb: 4 }}>
                        Spend less time on shipping, save on every label, and focus more on your business.
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Try SolushipX free for 30 Days. No Credit Card Required.
                    </Typography>
                </Box>

                <Grid container spacing={4} justifyContent="center">
                    {plans.map((plan, index) => (
                        <Grid item xs={12} md={3} key={index}>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                            >
                                <Paper
                                    elevation={plan.popular ? 8 : 0}
                                    sx={{
                                        p: 4,
                                        height: '100%',
                                        position: 'relative',
                                        border: plan.popular ? '2px solid #000' : '1px solid #eee',
                                        '&:hover': {
                                            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                                            transform: 'translateY(-4px)',
                                            transition: 'all 0.3s ease'
                                        }
                                    }}
                                >
                                    {plan.popular && (
                                        <Typography
                                            sx={{
                                                position: 'absolute',
                                                top: -12,
                                                left: '50%',
                                                transform: 'translateX(-50%)',
                                                bgcolor: '#000',
                                                color: '#fff',
                                                px: 2,
                                                py: 0.5,
                                                borderRadius: 1,
                                                fontSize: '0.875rem'
                                            }}
                                        >
                                            Recommended
                                        </Typography>
                                    )}
                                    <Typography variant="h4" component="h2" gutterBottom sx={{ fontWeight: 700 }}>
                                        {plan.name}
                                    </Typography>
                                    <Box sx={{ mb: 3 }}>
                                        <Typography variant="h3" component="div" sx={{ fontWeight: 700 }}>
                                            {plan.price}
                                        </Typography>
                                        {plan.period && (
                                            <Typography variant="subtitle1" color="text.secondary">
                                                /{plan.period}
                                            </Typography>
                                        )}
                                    </Box>
                                    <Typography variant="subtitle1" gutterBottom sx={{ mb: 3 }}>
                                        {plan.shipments}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                                        {plan.description}
                                    </Typography>
                                    <Button
                                        variant={plan.popular ? "contained" : "outlined"}
                                        fullWidth
                                        component={Link}
                                        to="/signup"
                                        sx={{
                                            mb: 4,
                                            bgcolor: plan.popular ? '#000' : 'transparent',
                                            color: plan.popular ? '#fff' : '#000',
                                            borderColor: '#000',
                                            '&:hover': {
                                                bgcolor: plan.popular ? '#333' : 'rgba(0,0,0,0.04)',
                                                borderColor: '#000'
                                            }
                                        }}
                                    >
                                        {plan.cta}
                                    </Button>
                                    <Divider sx={{ my: 3 }} />
                                    <List>
                                        {plan.features.map((feature, idx) => (
                                            <ListItem key={idx} sx={{ py: 1 }}>
                                                <ListItemIcon sx={{ minWidth: 36 }}>
                                                    <CheckCircleIcon sx={{ color: '#000', fontSize: 20 }} />
                                                </ListItemIcon>
                                                <ListItemText primary={feature} />
                                            </ListItem>
                                        ))}
                                    </List>
                                </Paper>
                            </motion.div>
                        </Grid>
                    ))}
                </Grid>

                <Box sx={{ textAlign: 'center', mt: 8 }}>
                    <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
                        Frequently Asked Questions
                    </Typography>
                    <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                        Have questions? We're here to help.
                    </Typography>
                    <Button
                        variant="outlined"
                        component={Link}
                        to="/contact"
                        sx={{
                            borderColor: '#000',
                            color: '#000',
                            '&:hover': {
                                borderColor: '#000',
                                bgcolor: 'rgba(0,0,0,0.04)'
                            }
                        }}
                    >
                        Contact Support
                    </Button>
                </Box>
            </Container>
        </Box>
    );
};

export default Pricing; 