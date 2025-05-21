import React, { useState } from 'react';
import {
    Box,
    Typography,
    Tabs,
    Tab,
    Paper
} from '@mui/material';
import CarrierMarkupsTab from './CarrierMarkupsTab';
import BusinessMarkupsTab from './BusinessMarkupsTab';
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
        <Box sx={{ p: 3 }} className="admin-markups-page">
            <Typography variant="h4" gutterBottom sx={{ mb: 3 }}>
                Markup & Rate Management
            </Typography>
            <Paper elevation={2} sx={{ width: '100%' }}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tabs value={activeTab} onChange={handleTabChange} aria-label="markup and rates tabs" variant="scrollable" scrollButtons="auto">
                        <Tab label="Carrier Markups" id="markups-tab-0" aria-controls="markups-tabpanel-0" />
                        <Tab label="Business Markups" id="markups-tab-1" aria-controls="markups-tabpanel-1" />
                        <Tab label="Fixed Rates" id="markups-tab-2" aria-controls="markups-tabpanel-2" />
                    </Tabs>
                </Box>
                <TabPanel value={activeTab} index={0}>
                    <CarrierMarkupsTab />
                </TabPanel>
                <TabPanel value={activeTab} index={1}>
                    <BusinessMarkupsTab />
                </TabPanel>
                <TabPanel value={activeTab} index={2}>
                    <FixedRatesTab />
                </TabPanel>
            </Paper>
        </Box>
    );
};

export default MarkupsPage; 