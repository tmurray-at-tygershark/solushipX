import React, { useState, useMemo, useCallback, useEffect, lazy, Suspense, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Box,
    CircularProgress,
    Drawer,
    List,
    ListItem,
    ListItemButton,
    ListItemIcon,
    ListItemText,
    IconButton,
    TextField,
    InputAdornment,
} from '@mui/material';
import {
    Menu as MenuIcon,
    Search as SearchIcon,
    Dashboard as DashboardIcon,
    Assessment as AssessmentIcon,
    People as PeopleIcon,
    LocalShipping as LocalShippingIcon,
    Settings as SettingsIcon,
    Notifications as NotificationsIcon,
    AccountCircle as AccountCircleIcon,
    Business as BusinessIcon,
    Refresh as RefreshIcon,
    Fullscreen as FullscreenIcon,
} from '@mui/icons-material';
import { Timestamp } from 'firebase/firestore';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCompany } from '../../contexts/CompanyContext';

// Lazy load the Globe component to prevent it from loading on other pages
const ShipmentGlobe = lazy(() => import('../Globe/Globe'));

// Lazy load the Tracking component for the drawer
const TrackingDrawerContent = lazy(() => import('../Tracking/Tracking'));

// Helper function to format Firestore timestamp
const formatDate = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp.seconds * 1000).toISOString().split('T')[0];
};

// Helper function to format address
const formatAddress = (addressObj) => {
    if (!addressObj) return '';
    const parts = [
        addressObj.street,
        addressObj.street2,
        addressObj.city,
        addressObj.state,
        addressObj.postalCode,
        addressObj.country
    ].filter(Boolean);
    return parts.join(', ');
};

// Globe Wrapper Component for complete isolation
const GlobeWrapper = React.memo(({ shipments, statusCounts }) => {
    const [isGlobeReady, setIsGlobeReady] = useState(false);

    useEffect(() => {
        console.log('🌍 GlobeWrapper: Mounting Globe component');
        setIsGlobeReady(true);

        return () => {
            console.log('🧹 GlobeWrapper: Unmounting Globe component');
            setIsGlobeReady(false);

            // Force garbage collection if available (development only)
            if (typeof window !== 'undefined' && window.gc && process.env.NODE_ENV === 'development') {
                setTimeout(() => {
                    window.gc();
                    console.log('🗑️ Forced garbage collection after Globe cleanup');
                }, 1000);
            }
        };
    }, []);

    if (!isGlobeReady) {
        return (
            <Box sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                backgroundColor: '#000000',
                color: 'white'
            }}>
                <Box sx={{ textAlign: 'center' }}>
                    <CircularProgress sx={{ color: '#60a5fa', mb: 2 }} />
                    <Box sx={{ fontSize: '1.1rem', fontWeight: 500 }}>
                        Preparing Globe...
                    </Box>
                </Box>
            </Box>
        );
    }

    return (
        <Suspense fallback={
            <Box sx={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100vh',
                backgroundColor: '#000000',
                color: 'white'
            }}>
                <Box sx={{ textAlign: 'center' }}>
                    <CircularProgress sx={{ color: '#60a5fa', mb: 2 }} />
                    <Box sx={{ fontSize: '1.1rem', fontWeight: 500 }}>
                        Loading Globe...
                    </Box>
                    <Box sx={{ fontSize: '0.9rem', opacity: 0.7, mt: 1 }}>
                        Initializing 3D visualization
                    </Box>
                </Box>
            </Box>
        }>
            <ShipmentGlobe
                shipments={shipments.slice(0, 50)} // Show recent 50 shipments for better visualization
                width="100%"
                showOverlays={true}
                statusCounts={statusCounts}
            />
        </Suspense>
    );
});

GlobeWrapper.displayName = 'GlobeWrapper';

const Dashboard = () => {
    const [shipments, setShipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [customers, setCustomers] = useState({});
    const { companyIdForAddress, loading: companyLoading } = useCompany();
    const navigate = useNavigate();

    // State for new UI elements
    const [isNavDrawerOpen, setIsNavDrawerOpen] = useState(false);
    const [isTrackingDrawerOpen, setIsTrackingDrawerOpen] = useState(false);
    const [trackingNumber, setTrackingNumber] = useState('');

    const globeRef = useRef(null); // Ref to access Globe's methods

    // Calculate date range for last 30 days
    const thirtyDaysAgo = useMemo(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return Timestamp.fromDate(date);
    }, []);

    // Fetch customers data
    useEffect(() => {
        if (!companyIdForAddress) return;

        const customersQuery = query(
            collection(db, 'customers'),
            where('companyID', '==', companyIdForAddress)
        );

        const unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
            const customersData = {};
            snapshot.docs.forEach(doc => {
                const data = doc.data();
                customersData[data.customerID] = data;
            });
            setCustomers(customersData);
        }, (error) => {
            console.error('Error fetching customers:', error);
        });

        return () => unsubscribeCustomers();
    }, [companyIdForAddress]);

    // Fetch shipments from Firestore for the last 30 days
    useEffect(() => {
        if (!companyIdForAddress || companyLoading) {
            return;
        }

        console.log('Dashboard: Fetching shipments for company:', companyIdForAddress);

        const shipmentsQuery = query(
            collection(db, 'shipments'),
            where('companyID', '==', companyIdForAddress),
            where('createdAt', '>=', thirtyDaysAgo),
            orderBy('createdAt', 'desc'),
            limit(200)
        );

        const unsubscribe = onSnapshot(shipmentsQuery, (snapshot) => {
            console.log('Dashboard: Received shipments snapshot with', snapshot.docs.length, 'documents');

            const shipmentsData = snapshot.docs.map(doc => {
                const data = doc.data();

                // Get customer data
                const customerId = data.shipTo?.customerID || data.customerId || data.customerID;
                const customerData = customers[customerId] || {};

                // Helper function to safely get rate info
                const getRateInfo = () => {
                    if (data.selectedRateRef) {
                        return {
                            carrier: data.selectedRateRef.carrier || data.selectedRateRef.carrierName || '',
                            totalCharges: data.selectedRateRef.totalCharges || 0
                        };
                    }

                    if (data.selectedRate) {
                        return {
                            carrier: data.selectedRate.carrier || data.selectedRate.carrierName || '',
                            totalCharges: data.selectedRate.totalCharges || data.selectedRate.price || 0
                        };
                    }

                    return {
                        carrier: data.carrier || '',
                        totalCharges: 0
                    };
                };

                const rateInfo = getRateInfo();

                return {
                    id: doc.id,
                    shipmentId: data.shipmentID || data.shipmentId || doc.id,
                    date: formatDate(data.createdAt),
                    createdAt: data.createdAt,
                    customer: customerData.name || data.shipTo?.company || 'Unknown Customer',
                    origin: formatAddress(data.shipFrom),
                    destination: formatAddress(data.shipTo),
                    shipFrom: data.shipFrom,
                    shipTo: data.shipTo,
                    carrier: rateInfo.carrier,
                    shipmentType: data.shipmentInfo?.shipmentType || 'Standard',
                    status: data.status || 'pending',
                    value: rateInfo.totalCharges || data.packages?.[0]?.declaredValue || 0
                };
            }).filter(shipment => {
                // Exclude draft shipments
                return shipment.status?.toLowerCase() !== 'draft';
            });

            console.log('Dashboard: Processed shipments data:', shipmentsData.length, 'shipments (excluding drafts)');
            setShipments(shipmentsData);
            setLoading(false);
        }, (error) => {
            console.error('Error fetching shipments:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [companyIdForAddress, companyLoading, customers, thirtyDaysAgo]);

    // Calculate status counts for the Globe
    const statusCounts = useMemo(() => {
        return shipments.reduce((counts, shipment) => {
            const status = shipment.status?.toLowerCase();
            if (status === 'pending' || status === 'scheduled' || status === 'awaiting_shipment' || status === 'booked') {
                counts.pending = (counts.pending || 0) + 1;
            } else if (status === 'in_transit') {
                counts.transit = (counts.transit || 0) + 1;
            } else if (status === 'delivered') {
                counts.delivered = (counts.delivered || 0) + 1;
            } else if (status === 'delayed' || status === 'exception') {
                counts.delayed = (counts.delayed || 0) + 1;
            }
            return counts;
        }, { pending: 0, transit: 0, delivered: 0, delayed: 0 });
    }, [shipments]);

    const handleTrackShipment = () => {
        if (trackingNumber.trim()) {
            // The tracking component inside the drawer will use its own logic
            // We just need to open the drawer
            setIsTrackingDrawerOpen(true);
        }
    };

    const handleResetView = () => {
        if (globeRef.current) {
            globeRef.current.resetView();
        }
    };

    const handleToggleFullscreen = () => {
        if (globeRef.current) {
            globeRef.current.toggleFullScreen();
        }
    };

    const menuItems = [
        { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
        { text: 'Shipments', icon: <LocalShippingIcon />, path: '/shipments' },
        { text: 'Customers', icon: <PeopleIcon />, path: '/customers' },
        { text: 'Carriers', icon: <BusinessIcon />, path: '/carriers' },
        { text: 'Reports', icon: <AssessmentIcon />, path: '/reports' },
    ];

    const profileMenuItems = [
        { text: 'Profile', icon: <AccountCircleIcon />, path: '/profile' },
        { text: 'Notifications', icon: <NotificationsIcon />, path: '/notifications' },
        { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
    ];

    // Show loading state while company data is loading
    if (companyLoading || loading) {
        return (
            <Box sx={{
                width: '100%',
                height: '100vh',
                bgcolor: '#0a0a0a',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center'
            }}>
                <CircularProgress sx={{ color: '#60a5fa' }} />
            </Box>
        );
    }

    // Main container with corrected height calculation
    return (
        <Box sx={{ height: '100vh', width: '100vw', overflow: 'hidden', position: 'relative', bgcolor: '#000' }}>
            {/* New Embedded Header */}
            <Box sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                p: 2,
                zIndex: 10,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)',
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <IconButton onClick={() => setIsNavDrawerOpen(true)} sx={{ color: 'white' }}>
                        <MenuIcon />
                    </IconButton>
                    <img src="/images/solushipx_logo_white.png" alt="SoluShipX" style={{ height: 24, cursor: 'pointer' }} onClick={() => navigate('/dashboard')} />
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TextField
                        variant="standard"
                        placeholder="Track a shipment..."
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleTrackShipment()}
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                                </InputAdornment>
                            ),
                            disableUnderline: true,
                            style: { color: 'white' }
                        }}
                        sx={{
                            bgcolor: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '20px',
                            p: '4px 16px',
                            width: '300px'
                        }}
                    />
                    <IconButton onClick={handleResetView} sx={{ color: 'white' }}>
                        <RefreshIcon />
                    </IconButton>
                    <IconButton onClick={handleToggleFullscreen} sx={{ color: 'white' }}>
                        <FullscreenIcon />
                    </IconButton>
                </Box>
            </Box>

            {/* Navigation Drawer (Left) */}
            <Drawer anchor="left" open={isNavDrawerOpen} onClose={() => setIsNavDrawerOpen(false)}>
                <Box sx={{ width: 250, bgcolor: '#111827', height: '100%', color: 'white' }} role="presentation">
                    <List>
                        {menuItems.map((item) => (
                            <ListItem key={item.text} disablePadding>
                                <ListItemButton onClick={() => { navigate(item.path); setIsNavDrawerOpen(false); }}>
                                    <ListItemIcon sx={{ color: 'rgba(255,255,255,0.7)' }}>{item.icon}</ListItemIcon>
                                    <ListItemText primary={item.text} />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                    <Box sx={{ flexGrow: 1 }} />
                    <List>
                        {profileMenuItems.map((item) => (
                            <ListItem key={item.text} disablePadding>
                                <ListItemButton onClick={() => { navigate(item.path); setIsNavDrawerOpen(false); }}>
                                    <ListItemIcon sx={{ color: 'rgba(255,255,255,0.7)' }}>{item.icon}</ListItemIcon>
                                    <ListItemText primary={item.text} />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                </Box>
            </Drawer>

            {/* Tracking Drawer (Right) */}
            <Drawer anchor="right" open={isTrackingDrawerOpen} onClose={() => setIsTrackingDrawerOpen(false)}>
                <Box sx={{ width: { xs: '90vw', sm: 400, md: 450 }, height: '100%', bgcolor: '#0a0a0a' }} role="presentation">
                    <Suspense fallback={<CircularProgress sx={{ m: 4 }} />}>
                        {/* Pass trackingNumber to the component so it can auto-fetch */}
                        <TrackingDrawerContent trackingIdentifier={trackingNumber} isDrawer={true} />
                    </Suspense>
                </Box>
            </Drawer>

            <Suspense fallback={<CircularProgress />}>
                <ShipmentGlobe
                    ref={globeRef}
                    shipments={shipments.slice(0, 50)}
                    width="100%"
                    showOverlays={true}
                    statusCounts={statusCounts}
                />
            </Suspense>
        </Box>
    );
};

export default Dashboard;