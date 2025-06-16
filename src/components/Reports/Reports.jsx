import React, { useState, useMemo, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Tabs,
    Tab,
    Alert,
    CircularProgress
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import './Reports.css';

// Import common components
import ModalHeader from '../common/ModalHeader';

// Import modular components
import ReportGenerator from './components/ReportGenerator';
import SavedReports from './components/SavedReports';
import ReportNotifications from './components/ReportNotifications';

// Import contexts
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';

const Reports = ({ isModal = false, onClose = null, showCloseButton = false }) => {
    const { companyIdForAddress, companyData } = useCompany();
    const { currentUser } = useAuth();

    // State
    const [selectedTab, setSelectedTab] = useState('generate');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    const handleTabChange = (event, newValue) => {
        setSelectedTab(newValue);
        setError(null);
        setSuccess(null);
    };

    const handleReportGenerated = useCallback((reportConfig) => {
        setSuccess(`Report "${reportConfig.type}" generated successfully!`);
        // Optionally switch to saved reports tab
        setTimeout(() => {
            setSelectedTab('saved');
        }, 2000);
    }, []);

    const handleSaveReport = useCallback((reportConfig) => {
        setSuccess(`Report configuration "${reportConfig.name}" saved successfully!`);
        // Optionally switch to saved reports tab
        setTimeout(() => {
            setSelectedTab('saved');
        }, 1500);
    }, []);

    const handleRunReport = useCallback(async (report) => {
        setLoading(true);
        try {
            // This would call the generateReport cloud function
            console.log('Running report:', report);

            // Simulate report execution
            await new Promise(resolve => setTimeout(resolve, 2000));

            setSuccess(`Report "${report.name}" executed successfully!`);
        } catch (error) {
            setError(`Failed to run report: ${error.message}`);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleEditReport = useCallback((report) => {
        // Switch to generate tab and populate with report configuration
        setSelectedTab('generate');
        // You would populate the ReportGenerator with the report's configuration
        console.log('Editing report:', report);
    }, []);

    const handleNotificationUpdate = useCallback((notificationConfig) => {
        setSuccess('Notification settings updated successfully!');
    }, []);

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <div style={{ backgroundColor: 'transparent', width: '100%', height: '100%' }}>
                <Box sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    position: 'relative'
                }}>
                    {/* Modal Header */}
                    {isModal && (
                        <ModalHeader
                            title="Reports & Analytics"
                            onClose={showCloseButton ? onClose : null}
                            showCloseButton={showCloseButton}
                        />
                    )}

                    {/* Scrollable Content Area */}
                    <Box sx={{
                        flex: 1,
                        overflow: 'auto',
                        minHeight: 0,
                        position: 'relative'
                    }}>
                        <Box sx={{
                            p: 3,
                            minHeight: '100%'
                        }}>
                            {/* Regular Header (when not in modal) */}
                            {!isModal && (
                                <Box sx={{ mb: 4 }}>
                                    <Typography variant="h4" component="h1" gutterBottom>
                                        Reports & Analytics
                                    </Typography>
                                    <Typography variant="body1" color="text.secondary">
                                        Generate comprehensive reports, schedule automated deliveries, and manage notifications
                                    </Typography>
                                </Box>
                            )}

                            {/* Status Messages */}
                            {error && (
                                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                                    {error}
                                </Alert>
                            )}

                            {success && (
                                <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
                                    {success}
                                </Alert>
                            )}

                            {/* Loading Overlay */}
                            {loading && (
                                <Box sx={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    right: 0,
                                    bottom: 0,
                                    backgroundColor: 'rgba(255, 255, 255, 0.8)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    zIndex: 1000
                                }}>
                                    <Box sx={{ textAlign: 'center' }}>
                                        <CircularProgress size={40} />
                                        <Typography sx={{ mt: 2, fontSize: '14px' }}>
                                            Processing report...
                                        </Typography>
                                    </Box>
                                </Box>
                            )}

                            {/* Tabs */}
                            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
                                <Tabs
                                    value={selectedTab}
                                    onChange={handleTabChange}
                                    sx={{
                                        '& .MuiTab-root': {
                                            fontSize: '12px',
                                            minHeight: '36px',
                                            textTransform: 'none',
                                            fontWeight: 500,
                                            padding: '6px 12px'
                                        }
                                    }}
                                >
                                    <Tab label="Generate Reports" value="generate" />
                                    <Tab label="Saved Reports" value="saved" />
                                    <Tab label="Notifications" value="notifications" />
                                </Tabs>
                            </Box>

                            {/* Tab Content */}
                            {selectedTab === 'generate' && (
                                <ReportGenerator
                                    onReportGenerated={handleReportGenerated}
                                    onSaveReport={handleSaveReport}
                                />
                            )}

                            {selectedTab === 'saved' && (
                                <SavedReports
                                    onEditReport={handleEditReport}
                                    onRunReport={handleRunReport}
                                />
                            )}

                            {selectedTab === 'notifications' && (
                                <ReportNotifications
                                    onUpdate={handleNotificationUpdate}
                                />
                            )}
                        </Box>
                    </Box>
                </Box>
            </div>
        </LocalizationProvider>
    );
};

export default Reports; 