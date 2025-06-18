import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    CircularProgress,
    Alert
} from '@mui/material';
import {
    GetApp as ExportIcon,
    Refresh as RefreshIcon
} from '@mui/icons-material';
import { useAuth } from '../../../contexts/AuthContext';
import { useCompany } from '../../../contexts/CompanyContext';

// Import the reusable ShipmentsX component
import ShipmentsX from '../../Shipments/ShipmentsX';

const GlobalShipmentList = () => {
    const { user, loading: authLoading } = useAuth();
    const { companyIdForAddress, loading: companyLoading } = useCompany();

    // Loading state for the component
    if (authLoading || companyLoading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
        }}>
            {/* Header Section */}
            <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                {/* Title and Actions Row */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827', mb: 0.5 }}>
                            Global Shipments
                        </Typography>
                        <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                            View and manage all shipments across all companies in the system
                        </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<RefreshIcon />}
                            onClick={() => window.location.reload()}
                            sx={{
                                fontSize: '12px',
                                textTransform: 'none',
                                borderColor: '#e5e7eb',
                                color: '#6b7280',
                                '&:hover': {
                                    borderColor: '#d1d5db',
                                    bgcolor: '#f9fafb'
                                }
                            }}
                        >
                            Refresh
                        </Button>

                        <Button
                            variant="outlined"
                            size="small"
                            startIcon={<ExportIcon />}
                            sx={{
                                fontSize: '12px',
                                textTransform: 'none',
                                borderColor: '#e5e7eb',
                                color: '#6b7280',
                                '&:hover': {
                                    borderColor: '#d1d5db',
                                    bgcolor: '#f9fafb'
                                }
                            }}
                        >
                            Export
                        </Button>
                    </Box>
                </Box>
            </Box>

            {/* Main Content Area */}
            <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                <Paper sx={{
                    height: '100%',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: 'none'
                }}>
                    <ShipmentsX
                        isModal={false}
                        onClose={null}
                        showCloseButton={false}
                        onModalBack={null}
                        deepLinkParams={null}
                        onOpenCreateShipment={null}
                    />
                </Paper>
            </Box>
        </Box>
    );
};

export default GlobalShipmentList; 