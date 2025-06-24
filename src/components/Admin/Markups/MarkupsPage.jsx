import React, { useState } from 'react';
import {
    Box,
    Typography,
    Tabs,
    Tab,
    Paper
} from '@mui/material';
import AdminBreadcrumb from '../AdminBreadcrumb';
import CarrierMarkupsTab from './CarrierMarkupsTab';
import CompanyMarkupsTab from './CompanyMarkupsTab';
import FixedRatesTab from './FixedRatesTab';

function TabPanel(props) {
    const { children, value, index, ...other } = props;
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`markups-tabpanel-${index}`}
            aria-labelledby={`markups-tab-${index}`}
            {...other}
        >
            {value === index && (
                <Box sx={{ p: 3 }}>
                    {children}
                </Box>
            )}
        </div>
    );
}

const MarkupsPage = () => {
    const [activeTab, setActiveTab] = useState(0);

    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
    };

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
        }}>
            {/* Header Section */}
            <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                {/* Title and Actions Row */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                    <Box>
                        <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827', mb: 2 }}>
                            Markup & Rate Management
                        </Typography>
                        {/* Breadcrumb */}
                        <AdminBreadcrumb currentPage="Markups" />
                    </Box>
                </Box>
            </Box>

            {/* Content Section */}
            <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                <Box sx={{ width: '100%', px: 3, py: 3 }}>
                    <Paper
                        elevation={0}
                        sx={{
                            width: '100%',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px'
                        }}
                    >
                        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                            <Tabs
                                value={activeTab}
                                onChange={handleTabChange}
                                aria-label="markup and rates tabs"
                                variant="scrollable"
                                scrollButtons="auto"
                                sx={{
                                    '& .MuiTab-root': {
                                        fontSize: '12px',
                                        minHeight: '48px',
                                        textTransform: 'none',
                                        fontWeight: 500
                                    }
                                }}
                            >
                                <Tab label="Carrier Markups" id="markups-tab-0" aria-controls="markups-tabpanel-0" />
                                <Tab label="Company Markups" id="markups-tab-1" aria-controls="markups-tabpanel-1" />
                                <Tab label="Fixed Rates" id="markups-tab-2" aria-controls="markups-tabpanel-2" />
                            </Tabs>
                        </Box>
                        <TabPanel value={activeTab} index={0}>
                            <CarrierMarkupsTab />
                        </TabPanel>
                        <TabPanel value={activeTab} index={1}>
                            <CompanyMarkupsTab />
                        </TabPanel>
                        <TabPanel value={activeTab} index={2}>
                            <FixedRatesTab />
                        </TabPanel>
                    </Paper>
                </Box>
            </Box>
        </Box>
    );
};

export default MarkupsPage; 