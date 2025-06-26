import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Tabs,
    Tab,
    Button,
    CircularProgress,
    Alert,
    Grid
} from '@mui/material';
import {
    People as PeopleIcon,
    Groups as GroupsIcon,
    Assessment as ReportsIcon,
    Schedule as ScheduleIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { getFunctions, httpsCallable } from 'firebase/functions';

// Import commission components
import SalesPersonsManagement from './SalesPersonsManagement';
import SalesTeamsManagement from './SalesTeamsManagement';
import CommissionReports from './CommissionReports';
import CommissionCalculator from './CommissionCalculator';

const SalesCommissionsTab = () => {
    const { enqueueSnackbar } = useSnackbar();
    const functions = getFunctions();

    // State
    const [activeTab, setActiveTab] = useState('persons');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [data, setData] = useState({
        salesPersons: [],
        salesTeams: [],
        commissionReports: []
    });

    // Handle tab change
    const handleTabChange = (event, newValue) => {
        setActiveTab(newValue);
        setError(null);
    };

    // Fetch initial data
    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Load both sales persons and sales teams data
            const getSalesPersons = httpsCallable(functions, 'getSalesPersons');
            const getSalesTeams = httpsCallable(functions, 'getSalesTeams');

            const [salesPersonsResponse, salesTeamsResponse] = await Promise.all([
                getSalesPersons({ filters: {}, limit: 100 }),
                getSalesTeams({ limit: 100 })
            ]);

            // Update state with both datasets
            setData(prev => ({
                ...prev,
                salesPersons: salesPersonsResponse.data?.data?.salesPersons || [],
                salesTeams: salesTeamsResponse.data?.data?.salesTeams || []
            }));

        } catch (error) {
            console.error('Error fetching commission data:', error);
            setError('Failed to load commission data. Please try again.');
            enqueueSnackbar('Error loading commission data: ' + error.message, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    }, [functions, enqueueSnackbar]);

    // Load data on component mount
    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Handle data refresh
    const handleDataRefresh = useCallback(() => {
        fetchData();
    }, [fetchData]);

    return (
        <Box sx={{ width: '100%' }}>
            {/* Header Section */}
            <Box sx={{
                p: 3,
                borderBottom: '1px solid #e5e7eb',
                backgroundColor: '#f8fafc'
            }}>
                <Grid container spacing={3} alignItems="center">
                    <Grid item xs={12}>
                        <Typography
                            variant="h5"
                            sx={{
                                fontWeight: 600,
                                color: '#111827',
                                fontSize: '20px',
                                mb: 1
                            }}
                        >
                            Sales Commission Management
                        </Typography>
                        <Typography
                            variant="body2"
                            sx={{
                                color: '#6b7280',
                                fontSize: '12px'
                            }}
                        >
                            Manage sales teams, representatives, and commission reporting
                        </Typography>
                    </Grid>
                </Grid>
            </Box>

            {/* Error Display */}
            {error && (
                <Alert
                    severity="error"
                    sx={{ mx: 3, mt: 2 }}
                    onClose={() => setError(null)}
                >
                    {error}
                </Alert>
            )}

            {/* Loading State */}
            {loading && (
                <Box sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    py: 4
                }}>
                    <CircularProgress size={32} />
                    <Typography sx={{ ml: 2, fontSize: '12px' }}>
                        Loading commission data...
                    </Typography>
                </Box>
            )}

            {/* Content Tabs */}
            {!loading && (
                <>
                    <Box sx={{ borderBottom: 1, borderColor: 'divider', backgroundColor: '#fff' }}>
                        <Tabs
                            value={activeTab}
                            onChange={handleTabChange}
                            variant="scrollable"
                            scrollButtons="auto"
                            sx={{
                                px: 3,
                                '& .MuiTab-root': {
                                    textTransform: 'none',
                                    minHeight: 48,
                                    fontWeight: 500,
                                    fontSize: '12px'
                                }
                            }}
                        >
                            <Tab
                                label="Sales Persons"
                                value="persons"
                                icon={<PeopleIcon />}
                                iconPosition="start"
                            />
                            <Tab
                                label="Sales Teams"
                                value="teams"
                                icon={<GroupsIcon />}
                                iconPosition="start"
                            />
                            <Tab
                                label="Commission Calculator"
                                value="calculator"
                                icon={<ReportsIcon />}
                                iconPosition="start"
                            />
                            <Tab
                                label="Reports & Scheduling"
                                value="reports"
                                icon={<ScheduleIcon />}
                                iconPosition="start"
                            />
                        </Tabs>
                    </Box>

                    {/* Tab Content */}
                    <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                        {activeTab === 'persons' && (
                            <SalesPersonsManagement
                                salesPersons={data.salesPersons}
                                salesTeams={data.salesTeams}
                                onDataRefresh={handleDataRefresh}
                            />
                        )}

                        {activeTab === 'teams' && (
                            <SalesTeamsManagement
                                salesTeams={data.salesTeams}
                                salesPersons={data.salesPersons}
                                onDataRefresh={handleDataRefresh}
                            />
                        )}

                        {activeTab === 'calculator' && (
                            <CommissionCalculator
                                salesPersons={data.salesPersons}
                            />
                        )}

                        {activeTab === 'reports' && (
                            <CommissionReports
                                salesPersons={data.salesPersons}
                                salesTeams={data.salesTeams}
                            />
                        )}
                    </Box>
                </>
            )}
        </Box>
    );
};

export default SalesCommissionsTab; 