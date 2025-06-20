import React, { useState } from 'react';
import {
    Box,
    Container,
    Paper,
    Typography,
    Tabs,
    Tab
} from '@mui/material';
import { motion } from 'framer-motion';
import BillingProfiles from './BillingProfiles';
import Invoices from './Invoices';
import PaymentMethods from './PaymentMethods';
import ModalHeader from '../common/ModalHeader';
import './Billing.css';

const Billing = ({ isModal = false, onClose, showCloseButton = false }) => {
    const [activeTab, setActiveTab] = useState(0);

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    return (
        <Box className="billing-container" sx={{
            minHeight: '100vh',
            backgroundColor: '#f8fafc',
            pt: isModal ? 0 : 4,
            display: 'flex',
            flexDirection: 'column'
        }}>
            {/* Modal Header */}
            {isModal && (
                <ModalHeader
                    title="Billing & Payments"
                    onClose={onClose}
                    showCloseButton={showCloseButton}
                />
            )}

            <Container maxWidth={false} sx={{
                maxWidth: '1300px',
                mx: 'auto',
                flexGrow: 1,
                pt: isModal ? 3 : 0
            }}>
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                >
                    {/* Page Header - Only show when not in modal */}
                    {!isModal && (
                        <Box sx={{ mb: 4 }}>
                            <Typography
                                variant="h4"
                                component="h1"
                                sx={{
                                    fontWeight: 700,
                                    fontSize: '28px',
                                    color: '#111827',
                                    mb: 1
                                }}
                            >
                                Billing & Payments
                            </Typography>
                            <Typography
                                variant="body1"
                                sx={{
                                    fontSize: '14px',
                                    color: '#6b7280'
                                }}
                            >
                                Manage your billing profiles, view invoices, and update payment methods
                            </Typography>
                        </Box>
                    )}

                    {/* Main Content */}
                    <Paper
                        elevation={0}
                        sx={{
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            backgroundColor: 'white'
                        }}
                    >
                        <Tabs
                            value={activeTab}
                            onChange={handleTabChange}
                            sx={{
                                borderBottom: '1px solid #e5e7eb',
                                backgroundColor: '#f8fafc',
                                '& .MuiTab-root': {
                                    textTransform: 'none',
                                    fontWeight: 500,
                                    fontSize: '14px',
                                    minHeight: 48,
                                    px: 3,
                                    color: '#6b7280',
                                    '&.Mui-selected': {
                                        color: '#111827'
                                    }
                                },
                                '& .MuiTabs-indicator': {
                                    backgroundColor: '#6b46c1'
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