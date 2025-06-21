import React from 'react';
import { Box, Container, Grid, Typography, Link as MuiLink, IconButton, useTheme } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import FacebookIcon from '@mui/icons-material/Facebook';
import TwitterIcon from '@mui/icons-material/Twitter';
import LinkedInIcon from '@mui/icons-material/LinkedIn';
import InstagramIcon from '@mui/icons-material/Instagram';
import { motion } from 'framer-motion';

const Footer = () => {
    const theme = useTheme();

    const socialLinks = [
        { icon: <FacebookIcon />, href: 'https://facebook.com' },
        { icon: <TwitterIcon />, href: 'https://twitter.com' },
        { icon: <LinkedInIcon />, href: 'https://linkedin.com' },
        { icon: <InstagramIcon />, href: 'https://instagram.com' }
    ];

    const footerSections = [
        {
            title: 'Features',
            links: [
                { text: 'Shipping Management', to: '/features/shipping' },
                { text: 'AI Intelligence', to: '/features/ai' },
                { text: 'Customer Engagement', to: '/features/engagement' }
            ]
        },
        {
            title: 'Integrations',
            links: [
                { text: 'Carriers', to: '/integrations/carriers' },
                { text: 'Ecommerce Platforms', to: '/integrations/ecommerce' },
                { text: 'Marketplaces', to: '/integrations/marketplaces' }
            ]
        },
        {
            title: 'Resources',
            links: [
                { text: 'Pricing', to: '/pricing' },
                { text: 'Learning Center', to: '/learning' },
                { text: 'Support', to: '/support' }
            ]
        }
    ];

    return (
        <Box
            component="footer"
            sx={{
                bgcolor: '#000',
                color: '#fff',
                py: 8,
                mt: 'auto',
                width: '100%',
                position: 'relative',
                overflow: 'hidden'
            }}
        >
            {/* Background gradient overlay */}
            <Box
                sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'linear-gradient(180deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.95) 100%)',
                    opacity: 0.95,
                    zIndex: 1
                }}
            />

            <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 2 }}>
                <Grid container spacing={4}>
                    {/* Logo and Social Section */}
                    <Grid item xs={12} md={4}>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5 }}
                        >
                            <Box sx={{ mb: 4 }}>
                                <Box
                                    component="img"
                                    src="/images/integratedcarrriers_logo_white.png"
                                    alt="SolushipX Logo"
                                    sx={{
                                        height: '30px',
                                        mb: 2
                                    }}
                                />
                                <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 3 }}>
                                    Empowering businesses with intelligent shipping solutions for a connected world.
                                </Typography>
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                    {socialLinks.map((social, index) => (
                                        <motion.div
                                            key={index}
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.95 }}
                                            transition={{ type: "spring", stiffness: 400, damping: 17 }}
                                        >
                                            <IconButton
                                                component="a"
                                                href={social.href}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                sx={{
                                                    color: '#fff',
                                                    bgcolor: 'rgba(255,255,255,0.1)',
                                                    '&:hover': {
                                                        bgcolor: 'rgba(255,255,255,0.2)',
                                                        transform: 'translateY(-2px)'
                                                    }
                                                }}
                                            >
                                                {social.icon}
                                            </IconButton>
                                        </motion.div>
                                    ))}
                                </Box>
                            </Box>
                        </motion.div>
                    </Grid>

                    {/* Footer Sections */}
                    {footerSections.map((section, index) => (
                        <Grid item xs={12} sm={6} md={2} key={section.title}>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.5, delay: index * 0.1 }}
                            >
                                <Typography
                                    variant="h6"
                                    sx={{
                                        fontWeight: 600,
                                        mb: 3,
                                        color: '#fff',
                                        position: 'relative',
                                        '&::after': {
                                            content: '""',
                                            position: 'absolute',
                                            bottom: -8,
                                            left: 0,
                                            width: '40px',
                                            height: '2px',
                                            bgcolor: 'rgba(255,255,255,0.3)'
                                        }
                                    }}
                                >
                                    {section.title}
                                </Typography>
                                <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0 }}>
                                    {section.links.map((link) => (
                                        <Box
                                            component="li"
                                            key={link.text}
                                            sx={{
                                                mb: 2,
                                                '&:last-child': { mb: 0 }
                                            }}
                                        >
                                            <MuiLink
                                                component={RouterLink}
                                                to={link.to}
                                                sx={{
                                                    color: 'rgba(255,255,255,0.7)',
                                                    textDecoration: 'none',
                                                    transition: 'all 0.3s ease',
                                                    display: 'inline-block',
                                                    '&:hover': {
                                                        color: '#fff',
                                                        transform: 'translateX(5px)'
                                                    }
                                                }}
                                            >
                                                {link.text}
                                            </MuiLink>
                                        </Box>
                                    ))}
                                </Box>
                            </motion.div>
                        </Grid>
                    ))}

                    {/* Contact Section */}
                    <Grid item xs={12} sm={6} md={2}>
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.5, delay: 0.3 }}
                        >
                            <Typography
                                variant="h6"
                                sx={{
                                    fontWeight: 600,
                                    mb: 3,
                                    color: '#fff',
                                    position: 'relative',
                                    '&::after': {
                                        content: '""',
                                        position: 'absolute',
                                        bottom: -8,
                                        left: 0,
                                        width: '40px',
                                        height: '2px',
                                        bgcolor: 'rgba(255,255,255,0.3)'
                                    }
                                }}
                            >
                                Contact Us
                            </Typography>
                            <Box sx={{ color: 'rgba(255,255,255,0.7)' }}>
                                <Typography variant="body2" sx={{ mb: 1 }}>
                                    123 Shipping Street
                                </Typography>
                                <Typography variant="body2" sx={{ mb: 1 }}>
                                    New York, NY 10001
                                </Typography>
                                <Typography variant="body2">
                                    United States
                                </Typography>
                            </Box>
                        </motion.div>
                    </Grid>
                </Grid>

                {/* Bottom Bar */}
                <Box
                    sx={{
                        mt: 6,
                        pt: 3,
                        borderTop: '1px solid rgba(255,255,255,0.1)',
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 2
                    }}
                >
                    <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                        © 2024 SolushipX. All rights reserved.
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 3 }}>
                        <MuiLink
                            component={RouterLink}
                            to="/privacy"
                            sx={{
                                color: 'rgba(255,255,255,0.7)',
                                textDecoration: 'none',
                                transition: 'color 0.3s ease',
                                '&:hover': { color: '#fff' }
                            }}
                        >
                            Privacy Policy
                        </MuiLink>
                        <MuiLink
                            component={RouterLink}
                            to="/cookies"
                            sx={{
                                color: 'rgba(255,255,255,0.7)',
                                textDecoration: 'none',
                                transition: 'color 0.3s ease',
                                '&:hover': { color: '#fff' }
                            }}
                        >
                            Cookie Policy
                        </MuiLink>
                    </Box>
                </Box>
            </Container>
        </Box>
    );
};

export default Footer; 