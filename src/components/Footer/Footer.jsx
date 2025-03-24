import React from 'react';
import { Box, Container, Grid, Typography, Link, IconButton } from '@mui/material';
import {
    Facebook as FacebookIcon,
    Twitter as TwitterIcon,
    LinkedIn as LinkedInIcon,
    Instagram as InstagramIcon,
    Phone as PhoneIcon,
    Email as EmailIcon,
    LocationOn as LocationIcon
} from '@mui/icons-material';

const Footer = () => {
    return (
        <Box
            component="footer"
            sx={{
                bgcolor: '#000000',
                color: '#ffffff',
                py: 6,
                mt: 'auto'
            }}
        >
            <Container maxWidth="lg">
                <Grid container spacing={4}>
                    {/* Company Info & Logo */}
                    <Grid item xs={12} md={4}>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                            SolushipX
                        </Typography>
                        <Typography variant="body2" sx={{ mb: 2, opacity: 0.8 }}>
                            Revolutionizing global shipping with cutting-edge technology and exceptional service.
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <IconButton sx={{ color: '#ffffff', '&:hover': { color: '#2C6ECB' } }}>
                                <FacebookIcon />
                            </IconButton>
                            <IconButton sx={{ color: '#ffffff', '&:hover': { color: '#2C6ECB' } }}>
                                <TwitterIcon />
                            </IconButton>
                            <IconButton sx={{ color: '#ffffff', '&:hover': { color: '#2C6ECB' } }}>
                                <LinkedInIcon />
                            </IconButton>
                            <IconButton sx={{ color: '#ffffff', '&:hover': { color: '#2C6ECB' } }}>
                                <InstagramIcon />
                            </IconButton>
                        </Box>
                    </Grid>

                    {/* Quick Links */}
                    <Grid item xs={12} sm={6} md={2}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                            Quick Links
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Link href="/" sx={{ color: '#ffffff', textDecoration: 'none', '&:hover': { color: '#2C6ECB' } }}>
                                Home
                            </Link>
                            <Link href="/shipments" sx={{ color: '#ffffff', textDecoration: 'none', '&:hover': { color: '#2C6ECB' } }}>
                                Shipments
                            </Link>
                            <Link href="/create-shipment" sx={{ color: '#ffffff', textDecoration: 'none', '&:hover': { color: '#2C6ECB' } }}>
                                Create Shipment
                            </Link>
                            <Link href="/tracking" sx={{ color: '#ffffff', textDecoration: 'none', '&:hover': { color: '#2C6ECB' } }}>
                                Track Shipment
                            </Link>
                        </Box>
                    </Grid>

                    {/* Customer Service */}
                    <Grid item xs={12} sm={6} md={2}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                            Customer Service
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                            <Link href="/support" sx={{ color: '#ffffff', textDecoration: 'none', '&:hover': { color: '#2C6ECB' } }}>
                                Support Center
                            </Link>
                            <Link href="/faq" sx={{ color: '#ffffff', textDecoration: 'none', '&:hover': { color: '#2C6ECB' } }}>
                                FAQ
                            </Link>
                            <Link href="/shipping-guide" sx={{ color: '#ffffff', textDecoration: 'none', '&:hover': { color: '#2C6ECB' } }}>
                                Shipping Guide
                            </Link>
                            <Link href="/terms" sx={{ color: '#ffffff', textDecoration: 'none', '&:hover': { color: '#2C6ECB' } }}>
                                Terms & Conditions
                            </Link>
                        </Box>
                    </Grid>

                    {/* Contact Information */}
                    <Grid item xs={12} md={4}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                            Contact Us
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <PhoneIcon sx={{ color: '#2C6ECB' }} />
                                <Typography variant="body2">
                                    +1 (555) 123-4567
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <EmailIcon sx={{ color: '#2C6ECB' }} />
                                <Typography variant="body2">
                                    support@solushipx.com
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                                <LocationIcon sx={{ color: '#2C6ECB', mt: 0.5 }} />
                                <Typography variant="body2">
                                    123 Shipping Lane<br />
                                    New York, NY 10001<br />
                                    United States
                                </Typography>
                            </Box>
                        </Box>
                    </Grid>
                </Grid>

                {/* Bottom Bar */}
                <Box sx={{
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    mt: 4,
                    pt: 3,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 2
                }}>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                        © 2024 SolushipX. All rights reserved.
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 3 }}>
                        <Link href="/privacy" sx={{ color: '#ffffff', textDecoration: 'none', opacity: 0.8, '&:hover': { color: '#2C6ECB' } }}>
                            Privacy Policy
                        </Link>
                        <Link href="/cookies" sx={{ color: '#ffffff', textDecoration: 'none', opacity: 0.8, '&:hover': { color: '#2C6ECB' } }}>
                            Cookie Policy
                        </Link>
                    </Box>
                </Box>
            </Container>
        </Box>
    );
};

export default Footer; 