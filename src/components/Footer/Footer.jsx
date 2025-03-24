import React from 'react';
import { Box, Container, Grid, Typography, Link as MuiLink, IconButton } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import FacebookIcon from '@mui/icons-material/Facebook';
import TwitterIcon from '@mui/icons-material/Twitter';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import InstagramIcon from '@mui/icons-material/Instagram';

const Footer = () => {
    return (
        <Box
            component="footer"
            sx={{
                bgcolor: '#000',
                color: '#fff',
                py: 6,
                mt: 'auto',
                width: '100%'
            }}
        >
            <Container maxWidth="lg">
                <Grid container spacing={4}>
                    {/* Features Section */}
                    <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="h6" gutterBottom>
                            Features
                        </Typography>
                        <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                            <Box component="li" sx={{ mb: 1 }}>
                                <MuiLink
                                    component={RouterLink}
                                    to="/features/shipping"
                                    sx={{ color: '#fff', textDecoration: 'none', '&:hover': { color: '#ccc' } }}
                                >
                                    Shipping Management
                                </MuiLink>
                            </Box>
                            <Box component="li" sx={{ mb: 1 }}>
                                <MuiLink
                                    component={RouterLink}
                                    to="/features/ai"
                                    sx={{ color: '#fff', textDecoration: 'none', '&:hover': { color: '#ccc' } }}
                                >
                                    AI Intelligence
                                </MuiLink>
                            </Box>
                            <Box component="li" sx={{ mb: 1 }}>
                                <MuiLink
                                    component={RouterLink}
                                    to="/features/engagement"
                                    sx={{ color: '#fff', textDecoration: 'none', '&:hover': { color: '#ccc' } }}
                                >
                                    Customer Engagement
                                </MuiLink>
                            </Box>
                        </Box>
                    </Grid>

                    {/* Integrations Section */}
                    <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="h6" gutterBottom>
                            Integrations
                        </Typography>
                        <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                            <Box component="li" sx={{ mb: 1 }}>
                                <MuiLink
                                    component={RouterLink}
                                    to="/integrations/carriers"
                                    sx={{ color: '#fff', textDecoration: 'none', '&:hover': { color: '#ccc' } }}
                                >
                                    Carriers
                                </MuiLink>
                            </Box>
                            <Box component="li" sx={{ mb: 1 }}>
                                <MuiLink
                                    component={RouterLink}
                                    to="/integrations/ecommerce"
                                    sx={{ color: '#fff', textDecoration: 'none', '&:hover': { color: '#ccc' } }}
                                >
                                    Ecommerce Platforms
                                </MuiLink>
                            </Box>
                            <Box component="li" sx={{ mb: 1 }}>
                                <MuiLink
                                    component={RouterLink}
                                    to="/integrations/marketplaces"
                                    sx={{ color: '#fff', textDecoration: 'none', '&:hover': { color: '#ccc' } }}
                                >
                                    Marketplaces
                                </MuiLink>
                            </Box>
                        </Box>
                    </Grid>

                    {/* Resources Section */}
                    <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="h6" gutterBottom>
                            Resources
                        </Typography>
                        <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                            <Box component="li" sx={{ mb: 1 }}>
                                <MuiLink
                                    component={RouterLink}
                                    to="/pricing"
                                    sx={{ color: '#fff', textDecoration: 'none', '&:hover': { color: '#ccc' } }}
                                >
                                    Pricing
                                </MuiLink>
                            </Box>
                            <Box component="li" sx={{ mb: 1 }}>
                                <MuiLink
                                    component={RouterLink}
                                    to="/learning"
                                    sx={{ color: '#fff', textDecoration: 'none', '&:hover': { color: '#ccc' } }}
                                >
                                    Learning Center
                                </MuiLink>
                            </Box>
                            <Box component="li" sx={{ mb: 1 }}>
                                <MuiLink
                                    component={RouterLink}
                                    to="/support"
                                    sx={{ color: '#fff', textDecoration: 'none', '&:hover': { color: '#ccc' } }}
                                >
                                    Support
                                </MuiLink>
                            </Box>
                        </Box>
                    </Grid>

                    {/* Contact Section */}
                    <Grid item xs={12} sm={6} md={3}>
                        <Typography variant="h6" gutterBottom>
                            Contact Us
                        </Typography>
                        <Box sx={{ mb: 2 }}>
                            <Typography variant="body2">
                                123 Shipping Street
                            </Typography>
                            <Typography variant="body2">
                                New York, NY 10001
                            </Typography>
                            <Typography variant="body2">
                                United States
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton sx={{ color: '#fff', '&:hover': { color: '#ccc' } }}>
                                <FacebookIcon />
                            </IconButton>
                            <IconButton sx={{ color: '#fff', '&:hover': { color: '#ccc' } }}>
                                <TwitterIcon />
                            </IconButton>
                            <IconButton sx={{ color: '#fff', '&:hover': { color: '#ccc' } }}>
                                <LinkedInIcon />
                            </IconButton>
                            <IconButton sx={{ color: '#fff', '&:hover': { color: '#ccc' } }}>
                                <InstagramIcon />
                            </IconButton>
                        </Box>
                    </Grid>
                </Grid>

                {/* Bottom Bar */}
                <Box sx={{ mt: 4, pt: 2, borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} sm={6}>
                            <Typography variant="body2" sx={{ color: '#fff' }}>
                                © 2024 SolushipX. All rights reserved.
                            </Typography>
                        </Grid>
                        <Grid item xs={12} sm={6} sx={{ textAlign: { sm: 'right' } }}>
                            <MuiLink
                                component={RouterLink}
                                to="/privacy"
                                sx={{ color: '#fff', textDecoration: 'none', mr: 2, '&:hover': { color: '#ccc' } }}
                            >
                                Privacy Policy
                            </MuiLink>
                            <MuiLink
                                component={RouterLink}
                                to="/cookies"
                                sx={{ color: '#fff', textDecoration: 'none', '&:hover': { color: '#ccc' } }}
                            >
                                Cookie Policy
                            </MuiLink>
                        </Grid>
                    </Grid>
                </Box>
            </Container>
        </Box>
    );
};

export default Footer; 