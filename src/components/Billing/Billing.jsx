import React, { useState } from 'react';
import {
    Box,
    Container,
    Paper,
    Typography,
    Tabs,
    Tab,
    useTheme
} from '@mui/material';
import { motion } from 'framer-motion';
import BillingProfiles from './BillingProfiles';
import Invoices from './Invoices';
import PaymentMethods from './PaymentMethods';

const Billing = () => {
    const theme = useTheme();
    const [activeTab, setActiveTab] = useState(0);

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    return (
        <Box
            sx={{
                minHeight: '100vh',
                bgcolor: '#f8f9fa',
                py: 8
            }}
        >
            <Container maxWidth="lg">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    <Box sx={{ mb: 4 }}>
                        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 1 }}>
                            Billing & Payments
                        </Typography>
                        <Typography variant="body1" color="text.secondary">
                            Manage your billing profiles, view invoices, and update payment methods
                        </Typography>
                    </Box>

                    <Paper
                        elevation={0}
                        sx={{
                            border: '1px solid #eee',
                            borderRadius: 2,
                            overflow: 'hidden'
                        }}
                    >
                        <Tabs
                            value={activeTab}
                            onChange={handleTabChange}
                            sx={{
                                borderBottom: '1px solid #eee',
                                '& .MuiTab-root': {
                                    textTransform: 'none',
                                    fontWeight: 500,
                                    minHeight: 48,
                                    px: 3
                                }
                            }}
                        >
                            <Tab label="Invoices" />
                            <Tab label="Billing Profiles" />
                            <Tab label="Payment Methods" />
                        </Tabs>

                        <Box sx={{ p: 3 }}>
                            {activeTab === 0 && <Invoices />}
                            {activeTab === 1 && <BillingProfiles />}
                            {activeTab === 2 && <PaymentMethods />}
                        </Box>
                    </Paper>
                </motion.div>
            </Container>
        </Box>
    );
};

export default Billing; 