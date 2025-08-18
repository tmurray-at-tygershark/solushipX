import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Box,
    Paper,
    Typography,
    Grid,
    Chip,
    Button,
    List,
    ListItem,
    ListItemText,
    CircularProgress,
    Alert,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Switch,
    Avatar,
    IconButton,
    Tooltip,
    TextField,
    Tabs,
    Tab,
    Card,
    CardContent
} from '@mui/material';
import {
    Edit as EditIcon,
    LocalShipping as LocalShippingIcon,
    Business as BusinessIcon,
    People as PeopleIcon,
    Close as CloseIcon,
    Dashboard as DashboardIcon,
    Person as PersonIcon,
    Receipt as ReceiptIcon,
    Palette as PaletteIcon,
    AdminPanelSettings as AdminIcon,
    Settings as SettingsIcon
} from '@mui/icons-material';
import { useParams, useNavigate, Link as RouterLink } from 'react-router-dom';
import { doc, getDoc, collection, query, where, getDocs, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase/firebase';
import { formatDateString } from '../../../utils/dateUtils';
import { useSnackbar } from 'notistack';
import { useCompany } from '../../../contexts/CompanyContext';
import { getLightBackgroundLogo } from '../../../utils/logoUtils';

const CompanyDetail = () => {
    const { id: companyFirestoreId } = useParams();
    const navigate = useNavigate();
    const { enqueueSnackbar } = useSnackbar();
    const { refreshCompanyData } = useCompany();
    const [company, setCompany] = useState(null);
    const [ownerDetails, setOwnerDetails] = useState(null);
    const [adminUsers, setAdminUsers] = useState([]);
    const [mainContact, setMainContact] = useState(null);
    const [billingAddress, setBillingAddress] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Carrier management dialog states
    const [carrierDialogOpen, setCarrierDialogOpen] = useState(false);
    const [allCarriers, setAllCarriers] = useState([]);
    const [carrierLoading, setCarrierLoading] = useState(false);

    // Local state for carrier display names (for immediate UI updates without database hits)
    const [localDisplayNames, setLocalDisplayNames] = useState({});
    const [savingDisplayNames, setSavingDisplayNames] = useState(new Set());

    // Tab state management
    const [currentTab, setCurrentTab] = useState(0);

    // Load all available carriers
    const loadCarriers = useCallback(async () => {
        setCarrierLoading(true);
        try {
            const carriersSnapshot = await getDocs(collection(db, 'carriers'));
            const carriers = carriersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setAllCarriers(carriers);
        } catch (err) {
            console.error('Error loading carriers:', err);
            enqueueSnackbar('Failed to load carriers', { variant: 'error' });
        }
        setCarrierLoading(false);
    }, [enqueueSnackbar]);

    // Handle carrier toggle for this company
    const handleCarrierToggle = useCallback(async (carrier, enabled) => {
        try {
            const companyRef = doc(db, 'companies', companyFirestoreId);
            const currentConnectedCarriers = company?.connectedCarriers || [];

            let updatedConnectedCarriers;

            if (enabled) {
                // Add carrier if not already connected
                const existingIndex = currentConnectedCarriers.findIndex(cc =>
                    cc.carrierID === carrier.carrierID
                );

                if (existingIndex === -1) {
                    updatedConnectedCarriers = [...currentConnectedCarriers, {
                        carrierID: carrier.carrierID,
                        carrierName: carrier.name,
                        enabled: true,
                        displayName: '', // Initialize empty display name
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }];
                } else {
                    updatedConnectedCarriers = currentConnectedCarriers.map((cc, index) =>
                        index === existingIndex ? { ...cc, enabled: true, updatedAt: new Date() } : cc
                    );
                }
            } else {
                // Disable carrier (keep in array but set enabled: false)
                updatedConnectedCarriers = currentConnectedCarriers.map(cc =>
                    cc.carrierID === carrier.carrierID
                        ? { ...cc, enabled: false, updatedAt: new Date() }
                        : cc
                );
            }

            await updateDoc(companyRef, {
                connectedCarriers: updatedConnectedCarriers,
                updatedAt: serverTimestamp()
            });

            // Update local state
            setCompany(prev => ({
                ...prev,
                connectedCarriers: updatedConnectedCarriers
            }));

            enqueueSnackbar(
                `${carrier.name} ${enabled ? 'enabled' : 'disabled'} for this company`,
                { variant: 'success' }
            );

        } catch (err) {
            console.error('Error updating carrier connection:', err);
            enqueueSnackbar('Failed to update carrier connection', { variant: 'error' });
        }
    }, [company, companyFirestoreId, enqueueSnackbar]);

    // Check if carrier is enabled for this company
    const isCarrierEnabled = useCallback((carrierID) => {
        const connectedCarrier = company?.connectedCarriers?.find(cc => cc.carrierID === carrierID);
        return connectedCarrier?.enabled === true;
    }, [company]);

    // Get display name for a carrier (prioritize local state for immediate updates)
    const getCarrierDisplayName = useCallback((carrierID) => {
        // First check local state for immediate updates
        if (localDisplayNames.hasOwnProperty(carrierID)) {
            return localDisplayNames[carrierID];
        }

        // Fall back to database state
        const connectedCarrier = company?.connectedCarriers?.find(cc => cc.carrierID === carrierID);
        return connectedCarrier?.displayName || '';
    }, [company, localDisplayNames]);

    // Debounced save to database
    const saveDisplayNameToDatabase = useCallback(async (carrierID, displayName) => {
        setSavingDisplayNames(prev => new Set([...prev, carrierID]));

        try {
            const companyRef = doc(db, 'companies', companyFirestoreId);
            const currentConnectedCarriers = company?.connectedCarriers || [];

            // Update the display name for the specific carrier
            const updatedConnectedCarriers = currentConnectedCarriers.map(cc =>
                cc.carrierID === carrierID
                    ? { ...cc, displayName: displayName.trim(), updatedAt: new Date() }
                    : cc
            );

            await updateDoc(companyRef, {
                connectedCarriers: updatedConnectedCarriers,
                updatedAt: serverTimestamp()
            });

            // Update local state
            setCompany(prev => ({
                ...prev,
                connectedCarriers: updatedConnectedCarriers
            }));

        } catch (err) {
            console.error('Error updating carrier display name:', err);
            enqueueSnackbar('Failed to update display name', { variant: 'error' });
        } finally {
            setSavingDisplayNames(prev => {
                const newSet = new Set(prev);
                newSet.delete(carrierID);
                return newSet;
            });
        }
    }, [company, companyFirestoreId, enqueueSnackbar]);

    // Debounce timer ref
    const debounceTimersRef = useRef({});

    // Handle immediate display name change (for UI only)
    const handleDisplayNameChange = useCallback((carrierID, displayName) => {
        // Update local state immediately for smooth UI
        setLocalDisplayNames(prev => ({
            ...prev,
            [carrierID]: displayName
        }));

        // Clear existing timer for this carrier
        if (debounceTimersRef.current[carrierID]) {
            clearTimeout(debounceTimersRef.current[carrierID]);
        }

        // Set new timer to save to database after 1 second of no typing
        debounceTimersRef.current[carrierID] = setTimeout(() => {
            saveDisplayNameToDatabase(carrierID, displayName);
            delete debounceTimersRef.current[carrierID];
        }, 1000);
    }, [saveDisplayNameToDatabase]);

    // Initialize local display names when dialog opens
    useEffect(() => {
        if (carrierDialogOpen && company?.connectedCarriers) {
            const initialDisplayNames = {};
            company.connectedCarriers.forEach(cc => {
                if (cc.displayName) {
                    initialDisplayNames[cc.carrierID] = cc.displayName;
                }
            });
            setLocalDisplayNames(initialDisplayNames);
        }
    }, [carrierDialogOpen, company?.connectedCarriers]);

    // Clean up timers when component unmounts or dialog closes
    useEffect(() => {
        if (!carrierDialogOpen) {
            // Clear all pending timers
            Object.values(debounceTimersRef.current).forEach(timer => clearTimeout(timer));
            debounceTimersRef.current = {};

            // Clear local state
            setLocalDisplayNames({});
            setSavingDisplayNames(new Set());
        }
    }, [carrierDialogOpen]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            console.log('[CompanyDetail] Starting data fetch for companyFirestoreId:', companyFirestoreId);

            const companyDocRef = doc(db, 'companies', companyFirestoreId);
            const companyDoc = await getDoc(companyDocRef);

            if (!companyDoc.exists()) {
                setError('Company not found');
                setLoading(false);
                return;
            }
            const companyData = { id: companyDoc.id, ...companyDoc.data() };
            setCompany(companyData);
            console.log('[CompanyDetail] Company data loaded:', companyData);

            // Fetch owner details
            if (companyData.ownerID) {
                try {
                    const ownerDoc = await getDoc(doc(db, 'users', companyData.ownerID));
                    if (ownerDoc.exists()) {
                        setOwnerDetails({ id: ownerDoc.id, ...ownerDoc.data() });
                        console.log('[CompanyDetail] Owner details loaded:', ownerDoc.data());
                    }
                } catch (ownerErr) {
                    console.error('[CompanyDetail] Error fetching owner details:', ownerErr);
                }
            }

            // Fetch admin users
            if (companyData.companyID) {
                try {
                    const usersRef = collection(db, 'users');
                    const q = query(usersRef, where('connectedCompanies.companies', 'array-contains', companyData.companyID));
                    const adminUsersSnap = await getDocs(q);
                    const admins = adminUsersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
                    setAdminUsers(admins);
                    console.log('[CompanyDetail] Admin users loaded:', admins.length, 'users');
                } catch (adminErr) {
                    console.error('[CompanyDetail] Error fetching admin users:', adminErr);
                    setAdminUsers([]);
                }
            }

            // Fetch address book records (main contact and billing)
            const addressBookRef = collection(db, 'addressBook');
            if (companyData.companyID) {
                console.log('[CompanyDetail] Fetching address records for companyID:', companyData.companyID);

                try {
                    // Fetch main contact with enhanced query
                    console.log('[CompanyDetail] Querying main contact...');
                    const mainContactQuery = query(
                        addressBookRef,
                        where('addressClass', '==', 'company'),
                        where('addressClassID', '==', companyData.companyID),
                        where('addressType', '==', 'contact')
                    );
                    const mainContactSnapshot = await getDocs(mainContactQuery);
                    console.log('[CompanyDetail] Main contact query results:', mainContactSnapshot.size, 'documents');

                    if (!mainContactSnapshot.empty) {
                        const contactData = { id: mainContactSnapshot.docs[0].id, ...mainContactSnapshot.docs[0].data() };
                        setMainContact(contactData);
                        console.log('[CompanyDetail] Main contact loaded:', contactData);
                    } else {
                        console.log('[CompanyDetail] No main contact found');
                        setMainContact(null);
                    }
                } catch (contactErr) {
                    console.error('[CompanyDetail] Error fetching main contact:', contactErr);
                    setMainContact(null);
                }

                try {
                    // Fetch billing address with enhanced query
                    console.log('[CompanyDetail] Querying billing address...');
                    const billingQuery = query(
                        addressBookRef,
                        where('addressClass', '==', 'company'),
                        where('addressClassID', '==', companyData.companyID),
                        where('addressType', '==', 'billing')
                    );
                    const billingSnapshot = await getDocs(billingQuery);
                    console.log('[CompanyDetail] Billing address query results:', billingSnapshot.size, 'documents');

                    if (!billingSnapshot.empty) {
                        const billingData = { id: billingSnapshot.docs[0].id, ...billingSnapshot.docs[0].data() };
                        setBillingAddress(billingData);
                        console.log('[CompanyDetail] Billing address loaded:', billingData);
                    } else {
                        console.log('[CompanyDetail] No billing address found');
                        setBillingAddress(null);
                    }
                } catch (billingErr) {
                    console.error('[CompanyDetail] Error fetching billing address:', billingErr);
                    setBillingAddress(null);
                }

                // Alternative query to debug - fetch all address records for this company
                try {
                    console.log('[CompanyDetail] Running debug query for all company addresses...');
                    const debugQuery = query(
                        addressBookRef,
                        where('addressClass', '==', 'company'),
                        where('addressClassID', '==', companyData.companyID)
                    );
                    const debugSnapshot = await getDocs(debugQuery);
                    console.log('[CompanyDetail] Total company address records found:', debugSnapshot.size);
                    debugSnapshot.docs.forEach(doc => {
                        const data = doc.data();
                        console.log('[CompanyDetail] Found address record:', {
                            id: doc.id,
                            addressType: data.addressType,
                            firstName: data.firstName,
                            lastName: data.lastName,
                            email: data.email
                        });
                    });
                } catch (debugErr) {
                    console.error('[CompanyDetail] Debug query error:', debugErr);
                }
            }

        } catch (err) {
            console.error('[CompanyDetail] Error loading company data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [companyFirestoreId]);



    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Tab change handler
    const handleTabChange = (event, newValue) => {
        setCurrentTab(newValue);
    };

    // Tab panels
    const OverviewTab = () => (
        <Grid container spacing={3}>
            {/* Company Overview - Basic Information */}
            <Grid item xs={12}>
                <Card sx={{ border: '1px solid #e5e7eb' }}>
                    <CardContent sx={{ p: 3 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 3 }}>
                            Company Overview
                        </Typography>
                        <Grid container spacing={3}>
                            {/* Basic Company Information */}
                            <Grid item xs={12} md={6}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#374151', fontSize: '14px', mb: 2 }}>
                                    Company Details
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={12} sm={6}>
                                        <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>Company Name</Typography>
                                        <Typography variant="body1" sx={{ fontSize: '12px', color: '#111827' }}>{company.name}</Typography>
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>Company ID</Typography>
                                        <Typography variant="body1" sx={{ fontSize: '12px', color: '#111827', fontFamily: 'monospace' }}>{company.companyID}</Typography>
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>Status</Typography>
                                        <Chip
                                            label={company.status === 'active' ? 'Active' : 'Inactive'}
                                            size="small"
                                            sx={{
                                                backgroundColor: company.status === 'active' ? '#f1f8f5' : '#fef2f2',
                                                color: company.status === 'active' ? '#0a875a' : '#dc2626',
                                                fontWeight: 500,
                                                fontSize: '11px',
                                                '& .MuiChip-label': { px: 1.5 }
                                            }}
                                        />
                                    </Grid>
                                    <Grid item xs={12} sm={6}>
                                        <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>Created</Typography>
                                        <Typography variant="body1" sx={{ fontSize: '12px', color: '#111827' }}>{formatDateString(company.createdAt)}</Typography>
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>Website</Typography>
                                        {company.website ? (
                                            <Typography
                                                variant="body1"
                                                component="a"
                                                href={company.website.startsWith('http') ? company.website : `https://${company.website}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                sx={{
                                                    fontSize: '12px',
                                                    color: '#3b82f6',
                                                    textDecoration: 'none',
                                                    '&:hover': { textDecoration: 'underline' }
                                                }}
                                            >
                                                {company.website}
                                            </Typography>
                                        ) : (
                                            <Typography variant="body1" sx={{ fontSize: '12px', color: '#6b7280' }}>No website provided</Typography>
                                        )}
                                    </Grid>
                                </Grid>
                            </Grid>

                            {/* Owner Information */}
                            <Grid item xs={12} md={6}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#374151', fontSize: '14px', mb: 2 }}>
                                    Company Owner
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={12}>
                                        {ownerDetails ? (
                                            <Box>
                                                <Typography variant="body1" sx={{ fontSize: '12px', color: '#111827' }}>
                                                    {`${ownerDetails.firstName} ${ownerDetails.lastName}`}
                                                </Typography>
                                                {ownerDetails.email ? (
                                                    <Typography
                                                        variant="body2"
                                                        component="a"
                                                        href={`mailto:${ownerDetails.email}`}
                                                        sx={{
                                                            fontSize: '11px',
                                                            color: '#3b82f6',
                                                            textDecoration: 'none',
                                                            '&:hover': { textDecoration: 'underline' }
                                                        }}
                                                    >
                                                        {ownerDetails.email}
                                                    </Typography>
                                                ) : (
                                                    <Typography variant="body2" sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                        No email provided
                                                    </Typography>
                                                )}
                                            </Box>
                                        ) : (
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>No owner assigned</Typography>
                                        )}
                                    </Grid>
                                </Grid>
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>
            </Grid>

            {/* Main Contact Information */}
            <Grid item xs={12}>
                <Card sx={{ border: '1px solid #e5e7eb' }}>
                    <CardContent sx={{ p: 3 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 3 }}>
                            Main Contact Information
                        </Typography>
                        {mainContact ? (
                            <Grid container spacing={3}>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>Contact Name</Typography>
                                    <Typography sx={{ fontSize: '12px', color: '#111827' }}>
                                        {(mainContact.firstName || mainContact.lastName)
                                            ? `${mainContact.firstName || ''} ${mainContact.lastName || ''}`.trim()
                                            : 'No name provided'
                                        }
                                    </Typography>
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>Email Address</Typography>
                                    {mainContact.email ? (
                                        <Typography
                                            component="a"
                                            href={`mailto:${mainContact.email}`}
                                            sx={{
                                                fontSize: '12px',
                                                color: '#3b82f6',
                                                textDecoration: 'none',
                                                '&:hover': { textDecoration: 'underline' }
                                            }}
                                        >
                                            {mainContact.email}
                                        </Typography>
                                    ) : (
                                        <Typography sx={{ fontSize: '12px', color: '#111827' }}>
                                            No email provided
                                        </Typography>
                                    )}
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>Phone Number</Typography>
                                    <Typography sx={{ fontSize: '12px', color: '#111827' }}>
                                        {mainContact.phone || 'No phone provided'}
                                    </Typography>
                                </Grid>
                                <Grid item xs={12}>
                                    <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>Address</Typography>
                                    <Typography sx={{ fontSize: '12px', color: '#111827' }}>
                                        {[
                                            mainContact.address1,
                                            mainContact.address2,
                                            mainContact.city,
                                            mainContact.stateProv,
                                            mainContact.zipPostal,
                                            mainContact.country
                                        ].filter(Boolean).join(', ') || 'No address provided'}
                                    </Typography>
                                </Grid>
                            </Grid>
                        ) : (
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>No main contact information available</Typography>
                        )}
                    </CardContent>
                </Card>
            </Grid>

            {/* Billing & Invoice Information */}
            <Grid item xs={12}>
                <Card sx={{ border: '1px solid #e5e7eb' }}>
                    <CardContent sx={{ p: 3 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 3 }}>
                            Billing & Invoice Information
                        </Typography>

                        <Grid container spacing={3}>
                            {/* Invoice Settings */}
                            {company.billingInfo && (
                                <>
                                    <Grid item xs={12} md={6}>
                                        <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>Company Display Name</Typography>
                                        <Typography sx={{ fontSize: '12px', color: '#111827' }}>
                                            {company.billingInfo.companyDisplayName || 'Not configured'}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>Tax Number</Typography>
                                        <Typography sx={{ fontSize: '12px', color: '#111827' }}>
                                            {company.billingInfo.taxNumber || 'Not configured'}
                                        </Typography>
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>Payment Information for Invoices</Typography>
                                        <Typography sx={{ fontSize: '12px', color: '#111827', whiteSpace: 'pre-wrap' }}>
                                            {company.billingInfo.paymentInformation || 'Not configured - no payment section will appear on invoices'}
                                        </Typography>
                                    </Grid>
                                </>
                            )}

                            {/* Accounts Receivable */}
                            {company.billingInfo?.accountsReceivable && (
                                Object.values(company.billingInfo.accountsReceivable).some(value =>
                                    value && (Array.isArray(value) ? value.length > 0 : value.toString().trim())
                                ) && (
                                    <>
                                        <Grid item xs={12} md={6}>
                                            <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>AR Contact</Typography>
                                            <Typography sx={{ fontSize: '12px', color: '#111827' }}>
                                                {`${company.billingInfo.accountsReceivable.firstName || ''} ${company.billingInfo.accountsReceivable.lastName || ''}`.trim()}
                                            </Typography>
                                        </Grid>
                                        {company.billingInfo.accountsReceivable.email?.length > 0 && (
                                            <Grid item xs={12} md={6}>
                                                <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>AR Emails</Typography>
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                                    {company.billingInfo.accountsReceivable.email.map((email, index) => (
                                                        <Chip
                                                            key={index}
                                                            label={email}
                                                            size="small"
                                                            variant="outlined"
                                                            component="a"
                                                            href={`mailto:${email}`}
                                                            clickable
                                                            sx={{
                                                                fontSize: '11px',
                                                                color: '#3b82f6',
                                                                borderColor: '#3b82f6',
                                                                textDecoration: 'none',
                                                                '&:hover': {
                                                                    backgroundColor: '#eff6ff',
                                                                    borderColor: '#2563eb'
                                                                }
                                                            }}
                                                        />
                                                    ))}
                                                </Box>
                                            </Grid>
                                        )}
                                    </>
                                )
                            )}

                            {/* Accounts Payable */}
                            {company.billingInfo?.accountsPayable && (
                                Object.values(company.billingInfo.accountsPayable).some(value =>
                                    value && (Array.isArray(value) ? value.length > 0 : value.toString().trim())
                                ) && (
                                    <>
                                        <Grid item xs={12} md={6}>
                                            <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>AP Contact</Typography>
                                            <Typography sx={{ fontSize: '12px', color: '#111827' }}>
                                                {`${company.billingInfo.accountsPayable.firstName || ''} ${company.billingInfo.accountsPayable.lastName || ''}`.trim()}
                                            </Typography>
                                        </Grid>
                                        {company.billingInfo.accountsPayable.email?.length > 0 && (
                                            <Grid item xs={12} md={6}>
                                                <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500 }}>AP Emails</Typography>
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                                    {company.billingInfo.accountsPayable.email.map((email, index) => (
                                                        <Chip
                                                            key={index}
                                                            label={email}
                                                            size="small"
                                                            variant="outlined"
                                                            component="a"
                                                            href={`mailto:${email}`}
                                                            clickable
                                                            sx={{
                                                                fontSize: '11px',
                                                                color: '#3b82f6',
                                                                borderColor: '#3b82f6',
                                                                textDecoration: 'none',
                                                                '&:hover': {
                                                                    backgroundColor: '#eff6ff',
                                                                    borderColor: '#2563eb'
                                                                }
                                                            }}
                                                        />
                                                    ))}
                                                </Box>
                                            </Grid>
                                        )}
                                    </>
                                )
                            )}

                            {/* Show message only if no billing info is configured */}
                            {(!company.billingInfo ||
                                (!company.billingInfo.companyDisplayName &&
                                    !company.billingInfo.taxNumber &&
                                    !company.billingInfo.paymentInformation &&
                                    (!company.billingInfo.accountsReceivable || !Object.values(company.billingInfo.accountsReceivable).some(value => value && (Array.isArray(value) ? value.length > 0 : value.toString().trim()))) &&
                                    (!company.billingInfo.accountsPayable || !Object.values(company.billingInfo.accountsPayable).some(value => value && (Array.isArray(value) ? value.length > 0 : value.toString().trim()))))) && (
                                    <Grid item xs={12}>
                                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>No billing information configured</Typography>
                                    </Grid>
                                )}
                        </Grid>
                    </CardContent>
                </Card>
            </Grid>
        </Grid>
    );



    const ThemeTab = () => (
        <Grid container spacing={3}>
            <Grid item xs={12}>
                <Card sx={{ border: '1px solid #e5e7eb' }}>
                    <CardContent sx={{ p: 3 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 3 }}>
                            Company Branding & Logos
                        </Typography>
                        <Grid container spacing={3}>
                            {/* Logo Display */}
                            {(() => {
                                // Define all possible logo types
                                const allLogoTypes = ['dark', 'light', 'circle', 'invoice', 'document', 'email'];

                                return allLogoTypes.map((logoType) => {
                                    const logoUrl = company.logos?.[logoType];
                                    const hasLogo = logoUrl && logoUrl.trim() !== '';

                                    return (
                                        <Grid item xs={12} sm={6} md={4} key={logoType}>
                                            <Box sx={{ textAlign: 'center' }}>
                                                <Typography variant="subtitle2" sx={{ color: '#6b7280', fontSize: '11px', fontWeight: 500, mb: 1 }}>
                                                    {logoType.charAt(0).toUpperCase() + logoType.slice(1)} Logo
                                                </Typography>
                                                <Box
                                                    sx={{
                                                        width: 120,
                                                        height: 80,
                                                        border: '1px solid #e5e7eb',
                                                        borderRadius: '6px',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        bgcolor: logoType === 'dark' ? '#111827' : '#f8fafc',
                                                        mx: 'auto',
                                                        overflow: 'hidden'
                                                    }}
                                                >
                                                    {hasLogo ? (
                                                        <Box
                                                            component="img"
                                                            src={logoUrl}
                                                            alt={`${logoType} logo`}
                                                            sx={{
                                                                maxWidth: '100%',
                                                                maxHeight: '100%',
                                                                objectFit: 'contain'
                                                            }}
                                                        />
                                                    ) : (
                                                        <Typography
                                                            sx={{
                                                                fontSize: '10px',
                                                                color: logoType === 'dark' ? '#9ca3af' : '#9ca3af',
                                                                textAlign: 'center',
                                                                px: 1
                                                            }}
                                                        >
                                                            No {logoType} logo
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </Box>
                                        </Grid>
                                    );
                                });
                            })()}
                        </Grid>
                    </CardContent>
                </Card>
            </Grid>
        </Grid>
    );

    const AdminsTab = () => (
        <Grid container spacing={3}>
            <Grid item xs={12}>
                <Card sx={{ border: '1px solid #e5e7eb' }}>
                    <CardContent sx={{ p: 3 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 3 }}>
                            Company Administrators
                        </Typography>
                        {adminUsers.length > 0 ? (
                            <List sx={{ p: 0 }}>
                                {adminUsers.map((admin) => (
                                    <ListItem key={admin.id} sx={{ px: 0, py: 2, borderBottom: '1px solid #f3f4f6' }}>
                                        <Avatar sx={{ mr: 2, bgcolor: '#6366f1' }}>
                                            {admin.firstName?.charAt(0)}{admin.lastName?.charAt(0)}
                                        </Avatar>
                                        <ListItemText
                                            primary={
                                                <Typography sx={{ fontSize: '12px', color: '#111827', fontWeight: 500 }}>
                                                    {`${admin.firstName} ${admin.lastName}`}
                                                </Typography>
                                            }
                                            secondary={
                                                <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                                    {admin.email}
                                                </Typography>
                                            }
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        ) : (
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>No administrators assigned to this company</Typography>
                        )}
                    </CardContent>
                </Card>
            </Grid>
        </Grid>
    );

    const CarriersTab = () => (
        <Grid container spacing={3}>
            <Grid item xs={12}>
                <Card sx={{ border: '1px solid #e5e7eb' }}>
                    <CardContent sx={{ p: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px' }}>
                                Connected Carriers
                            </Typography>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<LocalShippingIcon />}
                                onClick={() => {
                                    setCarrierDialogOpen(true);
                                    loadCarriers();
                                }}
                                sx={{ fontSize: '12px' }}
                            >
                                Manage Carriers
                            </Button>
                        </Box>
                        {company.connectedCarriers && company.connectedCarriers.length > 0 ? (
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Carrier Name</TableCell>
                                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Status</TableCell>
                                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Connected Since</TableCell>
                                            <TableCell sx={{ backgroundColor: '#f8fafc', fontWeight: 600, color: '#374151', fontSize: '12px' }}>Last Updated</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {company.connectedCarriers.map((carrier) => (
                                            <TableRow key={carrier.carrierID}>
                                                <TableCell sx={{ fontSize: '12px' }}>{carrier.carrierName}</TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={carrier.enabled ? 'Enabled' : 'Disabled'}
                                                        size="small"
                                                        sx={{
                                                            backgroundColor: carrier.enabled ? '#f1f8f5' : '#fef2f2',
                                                            color: carrier.enabled ? '#0a875a' : '#dc2626',
                                                            fontWeight: 500,
                                                            fontSize: '11px',
                                                            '& .MuiChip-label': { px: 1.5 }
                                                        }}
                                                    />
                                                </TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>{formatDateString(carrier.createdAt)}</TableCell>
                                                <TableCell sx={{ fontSize: '12px' }}>{formatDateString(carrier.updatedAt)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>No carriers connected to this company.</Typography>
                        )}
                    </CardContent>
                </Card>
            </Grid>
        </Grid>
    );

    const ServicesTab = () => (
        <Grid container spacing={3}>
            <Grid item xs={12}>
                <Card sx={{ border: '1px solid #e5e7eb' }}>
                    <CardContent sx={{ p: 3 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px', mb: 3 }}>
                            Service Level Configuration
                        </Typography>

                        {/* Available Service Levels */}
                        <Grid container spacing={3} sx={{ mb: 4 }}>
                            <Grid item xs={12}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#374151', fontSize: '14px', mb: 2 }}>
                                    Available Service Levels
                                </Typography>
                            </Grid>
                            {(() => {
                                // Check if service level restrictions are configured and enabled
                                const serviceRestrictions = company.availableServiceLevels;

                                if (!serviceRestrictions || !serviceRestrictions.enabled) {
                                    return (
                                        <Grid item xs={12}>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                No service level restrictions configured - all service levels are available
                                            </Typography>
                                        </Grid>
                                    );
                                }

                                // Get enabled service levels from freight and courier arrays
                                const enabledServices = [];

                                // Add freight services
                                if (serviceRestrictions.freight && serviceRestrictions.freight.length > 0) {
                                    serviceRestrictions.freight.forEach(serviceCode => {
                                        enabledServices.push({
                                            type: 'FREIGHT',
                                            code: serviceCode,
                                            label: `FREIGHT: ${serviceCode}`
                                        });
                                    });
                                }

                                // Add courier services
                                if (serviceRestrictions.courier && serviceRestrictions.courier.length > 0) {
                                    serviceRestrictions.courier.forEach(serviceCode => {
                                        enabledServices.push({
                                            type: 'COURIER',
                                            code: serviceCode,
                                            label: `COURIER: ${serviceCode}`
                                        });
                                    });
                                }

                                if (enabledServices.length === 0) {
                                    return (
                                        <Grid item xs={12}>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                Service level restrictions are enabled but no specific services are configured
                                            </Typography>
                                        </Grid>
                                    );
                                }

                                return (
                                    <Grid item xs={12}>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                            {enabledServices.map((service, index) => (
                                                <Chip
                                                    key={index}
                                                    label={service.label}
                                                    size="small"
                                                    sx={{
                                                        backgroundColor: service.type === 'FREIGHT' ? '#f0f9ff' : '#fef3c7',
                                                        color: service.type === 'FREIGHT' ? '#0369a1' : '#92400e',
                                                        fontSize: '11px'
                                                    }}
                                                />
                                            ))}
                                        </Box>
                                    </Grid>
                                );
                            })()}
                        </Grid>

                        {/* Additional Services */}
                        <Grid container spacing={3}>
                            <Grid item xs={12}>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600, color: '#374151', fontSize: '14px', mb: 2 }}>
                                    Additional Services
                                </Typography>
                            </Grid>
                            {(() => {
                                // Check if additional service restrictions are configured and enabled
                                const additionalServiceRestrictions = company.availableAdditionalServices;

                                if (!additionalServiceRestrictions || !additionalServiceRestrictions.enabled) {
                                    return (
                                        <Grid item xs={12}>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                No additional service restrictions configured - all additional services are available
                                            </Typography>
                                        </Grid>
                                    );
                                }

                                // Get enabled additional services from freight and courier arrays
                                const enabledServices = [];

                                // Add freight additional services
                                if (additionalServiceRestrictions.freight && additionalServiceRestrictions.freight.length > 0) {
                                    additionalServiceRestrictions.freight.forEach(service => {
                                        if (service.defaultEnabled) {
                                            enabledServices.push({
                                                type: 'FREIGHT',
                                                label: `FREIGHT: ${service.displayName || service.code}`,
                                                service: service
                                            });
                                        }
                                    });
                                }

                                // Add courier additional services
                                if (additionalServiceRestrictions.courier && additionalServiceRestrictions.courier.length > 0) {
                                    additionalServiceRestrictions.courier.forEach(service => {
                                        if (service.defaultEnabled) {
                                            enabledServices.push({
                                                type: 'COURIER',
                                                label: `COURIER: ${service.displayName || service.code}`,
                                                service: service
                                            });
                                        }
                                    });
                                }

                                if (enabledServices.length === 0) {
                                    return (
                                        <Grid item xs={12}>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                Additional service restrictions are enabled but no specific services are configured
                                            </Typography>
                                        </Grid>
                                    );
                                }

                                return (
                                    <Grid item xs={12}>
                                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                            {enabledServices.map((service, index) => (
                                                <Chip
                                                    key={index}
                                                    label={service.label}
                                                    size="small"
                                                    sx={{
                                                        backgroundColor: service.type === 'FREIGHT' ? '#f3e8ff' : '#fef3c7',
                                                        color: service.type === 'FREIGHT' ? '#7c3aed' : '#92400e',
                                                        fontSize: '11px'
                                                    }}
                                                />
                                            ))}
                                        </Box>
                                    </Grid>
                                );
                            })()}
                        </Grid>
                    </CardContent>
                </Card>
            </Grid>
        </Grid>
    );

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}><CircularProgress /></Box>;
    }
    if (error) {
        return <Box sx={{ p: 3 }}><Alert severity="error">Error: {error}</Alert></Box>;
    }
    if (!company) {
        return <Box sx={{ p: 3 }}><Alert severity="warning">Company not found</Alert></Box>;
    }

    return (
        <>
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                height: '100%'
            }}>
                {/* Header Section */}
                <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                    {/* Title and Actions Row */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            {/* Company Logo */}
                            <Box
                                sx={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: '50%',
                                    border: '2px solid #e5e7eb',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    bgcolor: '#f8fafc',
                                    overflow: 'hidden'
                                }}
                            >
                                {(() => {
                                    // Priority: circle > light > placeholder
                                    if (company.logos?.circle) {
                                        return (
                                            <Box
                                                component="img"
                                                src={company.logos.circle}
                                                alt={`${company.name} logo`}
                                                sx={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover'
                                                }}
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'flex';
                                                }}
                                            />
                                        );
                                    } else if (company.logos?.light) {
                                        return (
                                            <Box
                                                component="img"
                                                src={company.logos.light}
                                                alt={`${company.name} logo`}
                                                sx={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover'
                                                }}
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'flex';
                                                }}
                                            />
                                        );
                                    } else {
                                        return null;
                                    }
                                })()}
                                <Box
                                    sx={{
                                        display: (() => {
                                            // Show placeholder if no circle or light logo
                                            return (company.logos?.circle || company.logos?.light) ? 'none' : 'flex';
                                        })(),
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '100%',
                                        height: '100%',
                                        color: '#6b7280'
                                    }}
                                >
                                    <BusinessIcon sx={{ fontSize: '28px' }} />
                                </Box>
                            </Box>

                            {/* Company Name and Description */}
                            <Box>
                                <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827', mb: 1 }}>
                                    {company.name}
                                </Typography>
                                <Typography variant="body2" sx={{ color: '#6b7280', fontSize: '12px' }}>
                                    Company details and configuration
                                </Typography>
                            </Box>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                variant="outlined"
                                size="small"
                                startIcon={<PeopleIcon />}
                                component={RouterLink}
                                to={`/admin/customers?company=${company?.companyID}`}
                                sx={{ fontSize: '12px' }}
                            >
                                Customers
                            </Button>
                            <Button
                                variant="contained"
                                size="small"
                                startIcon={<EditIcon />}
                                component={RouterLink}
                                to={`/admin/companies/${companyFirestoreId}/edit`}
                                sx={{ fontSize: '12px' }}
                            >
                                Edit
                            </Button>
                        </Box>
                    </Box>
                </Box>

                {/* Tabs Navigation */}
                <Box sx={{ borderBottom: '1px solid #e5e7eb', bgcolor: '#ffffff' }}>
                    <Tabs
                        value={currentTab}
                        onChange={handleTabChange}
                        sx={{
                            px: 3,
                            '& .MuiTab-root': {
                                fontSize: '12px',
                                fontWeight: 500,
                                textTransform: 'none',
                                minWidth: 'auto',
                                px: 2,
                                py: 1.5
                            }
                        }}
                    >
                        <Tab
                            icon={<DashboardIcon sx={{ fontSize: '16px' }} />}
                            label="Overview"
                            iconPosition="start"
                        />
                        <Tab
                            icon={<PaletteIcon sx={{ fontSize: '16px' }} />}
                            label="Theme & Branding"
                            iconPosition="start"
                        />
                        <Tab
                            icon={<AdminIcon sx={{ fontSize: '16px' }} />}
                            label="Admins"
                            iconPosition="start"
                        />
                        <Tab
                            icon={<LocalShippingIcon sx={{ fontSize: '16px' }} />}
                            label="Connected Carriers"
                            iconPosition="start"
                        />
                        <Tab
                            icon={<SettingsIcon sx={{ fontSize: '16px' }} />}
                            label="Service Levels"
                            iconPosition="start"
                        />
                    </Tabs>
                </Box>

                {/* Tab Content Area */}
                <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                    <Box sx={{ p: 3 }}>
                        {currentTab === 0 && <OverviewTab />}
                        {currentTab === 1 && <ThemeTab />}
                        {currentTab === 2 && <AdminsTab />}
                        {currentTab === 3 && <CarriersTab />}
                        {currentTab === 4 && <ServicesTab />}
                    </Box>
                </Box>
            </Box>

            {/* Carrier Management Dialog */}
            <Dialog
                open={carrierDialogOpen}
                onClose={() => setCarrierDialogOpen(false)}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        borderRadius: '8px',
                        minHeight: '500px'
                    }
                }}
            >
                <DialogTitle sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    pb: 2,
                    borderBottom: '1px solid #e5e7eb'
                }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LocalShippingIcon sx={{ color: '#6366f1' }} />
                        <Typography variant="h6" sx={{ fontWeight: 600, color: '#374151', fontSize: '16px' }}>
                            Manage Carriers for {company?.companyName}
                        </Typography>
                    </Box>
                    <IconButton
                        onClick={() => setCarrierDialogOpen(false)}
                        size="small"
                        sx={{ color: '#6b7280' }}
                    >
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>

                <DialogContent sx={{ p: 3 }}>
                    {carrierLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
                            <CircularProgress />
                        </Box>
                    ) : (
                        <>
                            <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                                Enable or disable carriers for this company. Enabled carriers will be available when creating shipments.
                            </Typography>

                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                {allCarriers.map((carrier) => (
                                    <Paper
                                        key={carrier.id}
                                        sx={{
                                            p: 2,
                                            border: '1px solid #e5e7eb',
                                            borderRadius: '6px',
                                            backgroundColor: isCarrierEnabled(carrier.carrierID) ? '#f0f9ff' : '#ffffff'
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, flex: 1 }}>
                                                <Avatar
                                                    src={carrier.logo}
                                                    sx={{
                                                        width: 40,
                                                        height: 40,
                                                        backgroundColor: '#f3f4f6',
                                                        color: '#6b7280',
                                                        fontSize: '14px',
                                                        fontWeight: 600,
                                                        mt: 0.5
                                                    }}
                                                >
                                                    {carrier.name?.charAt(0)?.toUpperCase()}
                                                </Avatar>
                                                <Box sx={{ flex: 1 }}>
                                                    <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                                        {carrier.name}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                        ID: {carrier.carrierID} • Type: {carrier.carrierType || 'Not specified'}
                                                    </Typography>
                                                    {carrier.connectionType && (
                                                        <Chip
                                                            label={carrier.connectionType.toUpperCase()}
                                                            size="small"
                                                            sx={{
                                                                fontSize: '10px',
                                                                height: '20px',
                                                                mt: 0.5,
                                                                backgroundColor: carrier.connectionType === 'api' ? '#dcfce7' : '#fef3c7',
                                                                color: carrier.connectionType === 'api' ? '#166534' : '#92400e'
                                                            }}
                                                        />
                                                    )}

                                                    {/* Display Name Override Section */}
                                                    {isCarrierEnabled(carrier.carrierID) && (
                                                        <Box sx={{ mt: 2 }}>
                                                            <Typography sx={{ fontSize: '12px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                                                Customer Display Name (White Label)
                                                            </Typography>
                                                            <TextField
                                                                size="small"
                                                                placeholder={`Default: ${carrier.name}`}
                                                                value={getCarrierDisplayName(carrier.carrierID)}
                                                                onChange={(e) => handleDisplayNameChange(carrier.carrierID, e.target.value)}
                                                                fullWidth
                                                                disabled={savingDisplayNames.has(carrier.carrierID)}
                                                                sx={{
                                                                    '& .MuiInputBase-root': {
                                                                        fontSize: '12px',
                                                                        backgroundColor: savingDisplayNames.has(carrier.carrierID) ? '#f9f9f9' : '#ffffff'
                                                                    },
                                                                    '& .MuiInputBase-input': {
                                                                        fontSize: '12px'
                                                                    }
                                                                }}
                                                                helperText={savingDisplayNames.has(carrier.carrierID) ? "Saving..." : "Leave empty to show real carrier name to customers"}
                                                                FormHelperTextProps={{
                                                                    sx: {
                                                                        fontSize: '10px',
                                                                        color: savingDisplayNames.has(carrier.carrierID) ? '#6366f1' : '#6b7280',
                                                                        fontWeight: savingDisplayNames.has(carrier.carrierID) ? 500 : 400
                                                                    }
                                                                }}
                                                            />
                                                        </Box>
                                                    )}
                                                </Box>
                                            </Box>

                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Chip
                                                    label={isCarrierEnabled(carrier.carrierID) ? 'Enabled' : 'Disabled'}
                                                    size="small"
                                                    sx={{
                                                        backgroundColor: isCarrierEnabled(carrier.carrierID) ? '#f1f8f5' : '#fef2f2',
                                                        color: isCarrierEnabled(carrier.carrierID) ? '#0a875a' : '#dc2626',
                                                        fontWeight: 500,
                                                        fontSize: '11px'
                                                    }}
                                                />
                                                <Switch
                                                    checked={isCarrierEnabled(carrier.carrierID)}
                                                    onChange={(e) => handleCarrierToggle(carrier, e.target.checked)}
                                                    size="small"
                                                    sx={{
                                                        '& .MuiSwitch-switchBase.Mui-checked': {
                                                            color: '#10b981'
                                                        },
                                                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                                                            backgroundColor: '#10b981'
                                                        }
                                                    }}
                                                />
                                            </Box>
                                        </Box>
                                    </Paper>
                                ))}
                            </Box>
                        </>
                    )}
                </DialogContent>

                <DialogActions sx={{ p: 3, borderTop: '1px solid #e5e7eb' }}>
                    <Button
                        variant="outlined"
                        onClick={() => setCarrierDialogOpen(false)}
                        size="small"
                        sx={{ fontSize: '12px' }}
                    >
                        Close
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
};

export default CompanyDetail; 