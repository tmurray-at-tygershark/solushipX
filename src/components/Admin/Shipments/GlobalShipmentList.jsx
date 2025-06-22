import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    CircularProgress,
    Alert,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Chip,
    Dialog,
    DialogContent
} from '@mui/material';
import {
    Business as BusinessIcon,
    ViewList as ViewListIcon
} from '@mui/icons-material';
import { useAuth } from '../../../contexts/AuthContext';
import { useCompany } from '../../../contexts/CompanyContext';
import { ShipmentFormProvider } from '../../../contexts/ShipmentFormContext';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { db } from '../../../firebase';
import AdminBreadcrumb from '../AdminBreadcrumb';

// Import the reusable components
import ShipmentsX from '../../Shipments/ShipmentsX';
import CreateShipmentX from '../../CreateShipment/CreateShipmentX';
import QuickShip from '../../CreateShipment/QuickShip';

const GlobalShipmentList = () => {
    const { currentUser: user, userRole, loading: authLoading } = useAuth();
    const { companyIdForAddress, setCompanyContext, loading: companyLoading } = useCompany();

    // Debug logging
    console.log('[GlobalShipmentList] Debug info:', {
        user: user?.uid,
        userRole,
        authLoading,
        companyLoading
    });

    // State for company selection
    const [availableCompanies, setAvailableCompanies] = useState([]);
    const [selectedCompanyId, setSelectedCompanyId] = useState('all'); // Default to 'all' for super admins and admins
    const [loadingCompanies, setLoadingCompanies] = useState(false);
    const [selectedCompanyData, setSelectedCompanyData] = useState(null);
    const [viewMode, setViewMode] = useState('all'); // 'all' or 'single'

    // State for create shipment modals
    const [createShipmentOpen, setCreateShipmentOpen] = useState(false);
    const [quickShipOpen, setQuickShipOpen] = useState(false);
    const [draftIdToEdit, setDraftIdToEdit] = useState(null);
    const [quickShipDraftId, setQuickShipDraftId] = useState(null);
    const [prePopulatedData, setPrePopulatedData] = useState(null);

    // State for deep link params to pass to ShipmentsX
    const [shipmentsDeepLinkParams, setShipmentsDeepLinkParams] = useState(null);

    // State for refresh trigger
    const [refreshKey, setRefreshKey] = useState(0);

    // Load available companies based on user role
    useEffect(() => {
        const loadCompanies = async () => {
            if (authLoading || !user) return;

            setLoadingCompanies(true);
            try {
                let companiesQuery;
                let connectedCompanyIds = [];

                if (userRole === 'superadmin') {
                    // Super admins can see all companies
                    companiesQuery = query(
                        collection(db, 'companies')
                    );
                } else if (userRole === 'admin') {
                    // Admins can see companies they're connected to
                    const userDoc = await getDocs(
                        query(collection(db, 'users'), where('uid', '==', user.uid))
                    );

                    if (!userDoc.empty) {
                        const userData = userDoc.docs[0].data();
                        connectedCompanyIds = userData.connectedCompanies?.companies || [];

                        if (connectedCompanyIds.length > 0) {
                            companiesQuery = query(
                                collection(db, 'companies'),
                                where('companyID', 'in', connectedCompanyIds)
                            );
                        } else {
                            setAvailableCompanies([]);
                            return;
                        }
                    }
                } else {
                    // Regular users shouldn't access this page
                    setAvailableCompanies([]);
                    return;
                }

                const companiesSnapshot = await getDocs(companiesQuery);
                const companies = companiesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));

                // Sort companies by name after fetching
                companies.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

                console.log('Loaded companies:', companies.length, companies);

                setAvailableCompanies(companies);

                // For super admins and admins, default to "All Companies" view
                if (userRole === 'superadmin' || userRole === 'admin') {
                    setSelectedCompanyId('all');
                    setViewMode('all');

                    // Create a special "all companies" context
                    const allCompaniesContext = {
                        companyID: 'all',
                        name: 'All Companies',
                        isAdminView: true,
                        companyIds: userRole === 'superadmin' ? 'all' : connectedCompanyIds
                    };
                    setSelectedCompanyData(allCompaniesContext);
                    // Don't call setCompanyContext here to prevent reload loops
                    // setCompanyContext(allCompaniesContext);
                }
            } catch (error) {
                console.error('Error loading companies - Full error:', error);
                console.error('Error code:', error.code);
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
                setAvailableCompanies([]);
            } finally {
                setLoadingCompanies(false);
            }
        };

        loadCompanies();
    }, [user, userRole, authLoading]);

    // Handle company selection change
    const handleCompanyChange = useCallback((event) => {
        const companyId = event.target.value;
        console.log('[GlobalShipmentList] Company changed to:', companyId);
        setSelectedCompanyId(companyId);

        if (companyId === 'all') {
            // Set to "All Companies" mode
            setViewMode('all');

            // Get connected company IDs for admins
            const connectedIds = userRole === 'admin'
                ? availableCompanies.map(c => c.companyID)
                : 'all';

            const allCompaniesContext = {
                companyID: 'all',
                name: 'All Companies',
                isAdminView: true,
                companyIds: connectedIds
            };
            setSelectedCompanyData(allCompaniesContext);
            setCompanyContext(allCompaniesContext);
        } else {
            // Set to single company mode
            setViewMode('single');

            // Find the selected company data
            const company = availableCompanies.find(c => c.companyID === companyId);
            console.log('[GlobalShipmentList] Found company data:', company);
            setSelectedCompanyData(company);

            // Update the company context for ShipmentsX
            if (company) {
                console.log('[GlobalShipmentList] Setting company context:', company.companyID);
                setCompanyContext(company);
            }
        }

        // Trigger refresh of ShipmentsX
        setRefreshKey(prev => prev + 1);
    }, [availableCompanies, setCompanyContext, userRole]);

    // Handle opening create shipment modal
    const handleOpenCreateShipment = useCallback((prePopData = null, draftId = null, quickshipDraftId = null, mode = 'advanced') => {
        if (mode === 'quickship' || quickshipDraftId) {
            setQuickShipDraftId(quickshipDraftId);
            setQuickShipOpen(true);
            setCreateShipmentOpen(false);
        } else {
            setPrePopulatedData(prePopData);
            setDraftIdToEdit(draftId);
            setCreateShipmentOpen(true);
            setQuickShipOpen(false);
        }
    }, []);

    // Handle viewing shipment from create shipment flow
    const handleViewShipment = useCallback((shipmentId) => {
        // Close any open modals
        setCreateShipmentOpen(false);
        setQuickShipOpen(false);

        // Set deep link params to open the shipment detail
        setShipmentsDeepLinkParams({
            directToDetail: true,
            selectedShipmentId: shipmentId
        });

        // Clear the params after a short delay
        setTimeout(() => {
            setShipmentsDeepLinkParams(null);
        }, 100);
    }, []);

    // Handle return to shipments from create shipment
    const handleReturnToShipments = useCallback(() => {
        setCreateShipmentOpen(false);
        setQuickShipOpen(false);
        setPrePopulatedData(null);
        setDraftIdToEdit(null);
        setQuickShipDraftId(null);

        // Trigger refresh
        setRefreshKey(prev => prev + 1);
    }, []);

    // Loading state
    if (authLoading || companyLoading || loadingCompanies) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
                <CircularProgress />
            </Box>
        );
    }

    // No companies available
    if (availableCompanies.length === 0 && userRole === 'admin') {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="warning" sx={{ fontSize: '12px' }}>
                    No companies available. You need to be connected to at least one company.
                </Alert>
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
                {/* Title Row */}
                <Box sx={{ mb: 2 }}>
                    <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827', mb: 0.5 }}>
                        Shipments Management
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                        {viewMode === 'all'
                            ? `Viewing shipments from ${userRole === 'superadmin' ? 'all companies' : 'all connected companies'}`
                            : 'View and manage shipments across companies'}
                    </Typography>
                </Box>

                {/* Breadcrumb and Filter Row */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    {/* Breadcrumb */}
                    <AdminBreadcrumb currentPage="Shipments" />

                    {/* Company Selector */}
                    <FormControl
                        size="small"
                        sx={{
                            minWidth: 300,
                            '& .MuiInputLabel-root': { fontSize: '12px' },
                            '& .MuiSelect-select': { fontSize: '12px' }
                        }}
                    >
                        <InputLabel id="company-select-label">
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <BusinessIcon sx={{ fontSize: 16 }} />
                                Filter by Company
                            </Box>
                        </InputLabel>
                        <Select
                            labelId="company-select-label"
                            value={selectedCompanyId}
                            onChange={handleCompanyChange}
                            label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                    <BusinessIcon sx={{ fontSize: 16 }} />
                                    Filter by Company
                                </Box>
                            }
                        >
                            {/* All Companies Option */}
                            <MenuItem value="all" sx={{ fontSize: '12px' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                    <ViewListIcon sx={{ fontSize: 18, color: '#1976d2' }} />
                                    <Typography sx={{ fontSize: '12px', fontWeight: 600 }}>
                                        All Companies
                                    </Typography>
                                    <Chip
                                        label={userRole === 'superadmin' ? 'All' : `${availableCompanies.length} Connected`}
                                        size="small"
                                        color="primary"
                                        sx={{
                                            height: 20,
                                            fontSize: '10px',
                                            ml: 'auto'
                                        }}
                                    />
                                </Box>
                            </MenuItem>

                            {/* Individual Companies */}
                            {availableCompanies.map(company => (
                                <MenuItem
                                    key={company.companyID}
                                    value={company.companyID}
                                    sx={{ fontSize: '12px' }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                        <Typography sx={{ fontSize: '12px' }}>
                                            {company.name}
                                        </Typography>
                                        {company.status === 'active' ? (
                                            <Chip
                                                label="Active"
                                                size="small"
                                                color="success"
                                                sx={{
                                                    height: 20,
                                                    fontSize: '10px',
                                                    ml: 'auto'
                                                }}
                                            />
                                        ) : (
                                            <Chip
                                                label="Inactive"
                                                size="small"
                                                sx={{
                                                    height: 20,
                                                    fontSize: '10px',
                                                    ml: 'auto'
                                                }}
                                            />
                                        )}
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>

                {/* Company Details */}
                {selectedCompanyData && viewMode === 'single' && (
                    <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '11px' }}>
                            Company ID: {selectedCompanyData.companyID} |
                            Owner: {selectedCompanyData.ownerName || 'N/A'} |
                            Created: {selectedCompanyData.createdAt?.toDate?.()?.toLocaleDateString() || 'N/A'}
                        </Typography>
                    </Box>
                )}
            </Box>

            {/* Main Content Area */}
            <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                {console.log('[GlobalShipmentList] Rendering main content - selectedCompanyId:', selectedCompanyId, 'viewMode:', viewMode)}
                <Paper sx={{
                    height: '100%',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    boxShadow: 'none'
                }}>
                    <ShipmentsX
                        key={`shipments-${selectedCompanyId}-${refreshKey}`}
                        isModal={false}
                        onClose={null}
                        showCloseButton={false}
                        onModalBack={null}
                        deepLinkParams={shipmentsDeepLinkParams}
                        onOpenCreateShipment={handleOpenCreateShipment}
                        onClearDeepLinkParams={() => setShipmentsDeepLinkParams(null)}
                        adminViewMode={viewMode}
                        adminCompanyIds={viewMode === 'all' ? (userRole === 'superadmin' ? 'all' : availableCompanies.map(c => c.companyID)) : null}
                    />
                </Paper>
            </Box>

            {/* Create Shipment Modal (Advanced) */}
            <Dialog
                open={createShipmentOpen}
                onClose={() => setCreateShipmentOpen(false)}
                fullScreen
                TransitionProps={{
                    onExited: () => {
                        setPrePopulatedData(null);
                        setDraftIdToEdit(null);
                    }
                }}
            >
                <DialogContent sx={{ p: 0 }}>
                    <CreateShipmentX
                        isModal={true}
                        showCloseButton={true}
                        onClose={() => setCreateShipmentOpen(false)}
                        onReturnToShipments={handleReturnToShipments}
                        onViewShipment={handleViewShipment}
                        draftId={draftIdToEdit}
                        prePopulatedData={prePopulatedData}
                    />
                </DialogContent>
            </Dialog>

            {/* Quick Ship Modal */}
            <Dialog
                open={quickShipOpen}
                onClose={() => setQuickShipOpen(false)}
                fullScreen
                TransitionProps={{
                    onExited: () => {
                        setQuickShipDraftId(null);
                    }
                }}
            >
                <DialogContent sx={{ p: 0 }}>
                    <ShipmentFormProvider>
                        <QuickShip
                            isModal={true}
                            showCloseButton={true}
                            onClose={() => setQuickShipOpen(false)}
                            onReturnToShipments={handleReturnToShipments}
                            onViewShipment={handleViewShipment}
                            draftId={quickShipDraftId}
                        />
                    </ShipmentFormProvider>
                </DialogContent>
            </Dialog>
        </Box>
    );
};

export default GlobalShipmentList;
