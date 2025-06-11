import React, { useState, useMemo, useCallback, useEffect, lazy, Suspense, useRef, forwardRef } from 'react';
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
    Dialog,
    Slide,
    AppBar,
    Toolbar,
    Typography,
    LinearProgress,
    Fade,
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
    Logout as LogoutIcon,
    Fullscreen as FullscreenIcon,
    Close as CloseIcon,
    QrCode2 as BarcodeIcon,
} from '@mui/icons-material';
import { Timestamp } from 'firebase/firestore';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCompany } from '../../contexts/CompanyContext';
import { useAuth } from '../../contexts/AuthContext';

// Lazy load the Globe component to prevent it from loading on other pages
const ShipmentGlobe = lazy(() => import('../Globe/Globe'));

// Lazy load the Tracking component for the drawer
const TrackingDrawerContent = lazy(() => import('../Tracking/Tracking'));

// Lazy load the Shipments component for the modal
const ShipmentsComponent = lazy(() => import('../Shipments/ShipmentsX'));

// Transition for the modal
const Transition = forwardRef(function Transition(props, ref) {
    return <Slide direction="up" ref={ref} {...props} timeout={{ enter: 500, exit: 300 }} easing={{ enter: 'cubic-bezier(0.4, 0, 0.2, 1)', exit: 'cubic-bezier(0.4, 0, 1, 1)' }} />;
});

// Enhanced Globe Loading Screen Component
const GlobeLoadingScreen = ({ phase = 'initializing' }) => {
    const [progress, setProgress] = useState(0);
    const [currentPhase, setCurrentPhase] = useState(0);

    const loadingPhases = [
        { text: 'Initializing SoluShipX Globe', description: 'Preparing 3D visualization engine' },
        { text: 'Loading Earth Textures', description: 'Downloading satellite imagery' },
        { text: 'Fetching Shipment Data', description: 'Retrieving your logistics network' },
        { text: 'Plotting Routes', description: 'Calculating optimal pathways' },
        { text: 'Finalizing Experience', description: 'Almost ready to explore' }
    ];

    useEffect(() => {
        const timer = setInterval(() => {
            setProgress((prevProgress) => {
                const newProgress = prevProgress + Math.random() * 15;

                // Update phase based on progress
                const newPhase = Math.floor((newProgress / 100) * loadingPhases.length);
                setCurrentPhase(Math.min(newPhase, loadingPhases.length - 1));

                return newProgress >= 100 ? 100 : newProgress;
            });
        }, 400);

        return () => clearInterval(timer);
    }, [loadingPhases.length]);

    const currentLoadingPhase = loadingPhases[currentPhase];

    return (
        <Box sx={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Animated background particles */}
            <Box sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: `
                    radial-gradient(circle at 20% 50%, rgba(96, 165, 250, 0.1) 0%, transparent 50%),
                    radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.1) 0%, transparent 50%),
                    radial-gradient(circle at 40% 80%, rgba(34, 197, 94, 0.1) 0%, transparent 50%)
                `,
                animation: 'float 6s ease-in-out infinite'
            }} />

            {/* Main loading content */}
            <Box sx={{ textAlign: 'center', zIndex: 1, maxWidth: '400px', px: 3 }}>
                {/* Logo with glow effect */}
                <Fade in timeout={1000}>
                    <Box sx={{ mb: 4, position: 'relative' }}>
                        <Box sx={{
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: '120px',
                            height: '120px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(96, 165, 250, 0.3) 0%, transparent 70%)',
                            animation: 'pulse 2s ease-in-out infinite'
                        }} />
                        <img
                            src="/images/solushipx_logo_white.png"
                            alt="SoluShipX"
                            style={{
                                height: 80,
                                position: 'relative',
                                zIndex: 2,
                                filter: 'drop-shadow(0 0 20px rgba(96, 165, 250, 0.5))'
                            }}
                        />
                    </Box>
                </Fade>

                {/* Progress circle with percentage */}
                <Box sx={{ position: 'relative', display: 'inline-flex', mb: 3 }}>
                    <CircularProgress
                        variant="determinate"
                        value={progress}
                        size={100}
                        thickness={2}
                        sx={{
                            color: '#60a5fa',
                            filter: 'drop-shadow(0 0 10px rgba(96, 165, 250, 0.6))',
                            '& .MuiCircularProgress-circle': {
                                strokeLinecap: 'round',
                            }
                        }}
                    />
                    <Box sx={{
                        top: 0,
                        left: 0,
                        bottom: 0,
                        right: 0,
                        position: 'absolute',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Typography variant="h6" component="div" sx={{
                            color: 'white',
                            fontWeight: 600,
                            fontSize: '1.2rem'
                        }}>
                            {Math.round(progress)}%
                        </Typography>
                    </Box>
                </Box>

                {/* Current phase text */}
                <Fade in key={currentPhase} timeout={500}>
                    <Box>
                        <Typography variant="h6" sx={{
                            fontSize: '1.3rem',
                            fontWeight: 600,
                            mb: 1,
                            background: 'linear-gradient(45deg, #60a5fa, #8b5cf6)',
                            backgroundClip: 'text',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent'
                        }}>
                            {currentLoadingPhase.text}
                        </Typography>
                        <Typography sx={{
                            fontSize: '0.95rem',
                            opacity: 0.8,
                            color: 'rgba(255, 255, 255, 0.7)'
                        }}>
                            {currentLoadingPhase.description}
                        </Typography>
                    </Box>
                </Fade>

                {/* Phase indicators */}
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, mt: 3 }}>
                    {loadingPhases.map((_, index) => (
                        <Box
                            key={index}
                            sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: index <= currentPhase ? '#60a5fa' : 'rgba(255, 255, 255, 0.2)',
                                transition: 'all 0.3s ease',
                                boxShadow: index <= currentPhase ? '0 0 10px rgba(96, 165, 250, 0.8)' : 'none'
                            }}
                        />
                    ))}
                </Box>
            </Box>

            {/* CSS animations */}
            <style jsx>{`
                @keyframes float {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    33% { transform: translateY(-10px) rotate(1deg); }
                    66% { transform: translateY(5px) rotate(-1deg); }
                }
                
                @keyframes pulse {
                    0%, 100% { transform: translate(-50%, -50%) scale(1); opacity: 0.7; }
                    50% { transform: translate(-50%, -50%) scale(1.1); opacity: 0.9; }
                }
            `}</style>
        </Box>
    );
};

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

const Dashboard = () => {
    const [shipments, setShipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [customers, setCustomers] = useState({});
    const { companyIdForAddress, loading: companyLoading } = useCompany();
    const navigate = useNavigate();
    const { logout } = useAuth();

    // State for new UI elements
    const [isNavDrawerOpen, setIsNavDrawerOpen] = useState(false);
    const [isTrackingDrawerOpen, setIsTrackingDrawerOpen] = useState(false);
    const [trackingNumber, setTrackingNumber] = useState('');
    const [isShipmentsModalOpen, setIsShipmentsModalOpen] = useState(false);

    const [isMinLoadingTimePassed, setIsMinLoadingTimePassed] = useState(false);

    const globeRef = useRef(null); // Ref to access Globe's methods

    useEffect(() => {
        // Ensure the loading screen is visible for at least 5.5 seconds
        // to allow the animation to complete.
        const timer = setTimeout(() => {
            setIsMinLoadingTimePassed(true);
        }, 5500);
        return () => clearTimeout(timer);
    }, []);

    const showLoadingScreen = useMemo(() => {
        return companyLoading || loading || !isMinLoadingTimePassed;
    }, [companyLoading, loading, isMinLoadingTimePassed]);

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

    const handleToggleFullscreen = () => {
        if (globeRef.current) {
            globeRef.current.toggleFullScreen();
        }
    };

    const handleLogout = async () => {
        try {
            await logout();
            navigate('/');
        } catch (error) {
            console.error("Failed to log out", error);
        }
    };

    const menuItems = [
        { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard', action: () => navigate('/dashboard') },
        { text: 'Shipments', icon: <LocalShippingIcon />, action: () => setIsShipmentsModalOpen(true) },
        { text: 'Customers', icon: <PeopleIcon />, path: '/customers', action: () => navigate('/customers') },
        { text: 'Carriers', icon: <BusinessIcon />, path: '/carriers', action: () => navigate('/carriers') },
        { text: 'Reports', icon: <AssessmentIcon />, path: '/reports', action: () => navigate('/reports') },
    ];

    const profileMenuItems = [
        { text: 'Profile', icon: <AccountCircleIcon />, path: '/profile' },
        { text: 'Notifications', icon: <NotificationsIcon />, path: '/notifications' },
        { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
    ];

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
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleTrackShipment()}
                        placeholder="Enter tracking number"
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <BarcodeIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                                </InputAdornment>
                            ),
                            disableUnderline: true,
                            style: { color: 'white' },
                            sx: {
                                '& .MuiInputBase-input': {
                                    color: 'white',
                                    fontSize: '0.8rem',
                                    '&::placeholder': {
                                        color: 'rgba(255, 255, 255, 0.7)',
                                        opacity: 1
                                    }
                                }
                            }
                        }}
                        sx={{
                            bgcolor: 'rgba(255, 255, 255, 0.1)',
                            borderRadius: '20px',
                            p: '4px 16px',
                            width: '250px',
                            '& .MuiInputBase-input': {
                                color: 'white',
                                fontSize: '0.8rem'
                            },
                            '& .MuiInputBase-root': {
                                color: 'white'
                            }
                        }}
                    />
                </Box>
            </Box>

            {/* Navigation Drawer (Left) */}
            <Drawer anchor="left" open={isNavDrawerOpen} onClose={() => setIsNavDrawerOpen(false)}>
                <Box sx={{
                    width: 250,
                    height: '100%',
                    color: 'white',
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
                    position: 'relative',
                    overflow: 'hidden'
                }} role="presentation">
                    {/* Animated background particles */}
                    <Box sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: `
                            radial-gradient(circle at 20% 50%, rgba(96, 165, 250, 0.1) 0%, transparent 50%),
                            radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.1) 0%, transparent 50%),
                            radial-gradient(circle at 40% 80%, rgba(34, 197, 94, 0.1) 0%, transparent 50%)
                        `,
                        animation: 'float 6s ease-in-out infinite'
                    }} />
                    <Box sx={{ p: 2, pl: 2.5, display: 'flex', justifyContent: 'flex-start', position: 'relative', zIndex: 1 }}>
                        <img src="/images/solushipx_logo_white.png" alt="SoluShipX" style={{ height: 28 }} />
                    </Box>
                    <List sx={{ flexGrow: 1, position: 'relative', zIndex: 1 }}>
                        {menuItems.map((item) => (
                            <ListItem key={item.text} disablePadding>
                                <ListItemButton
                                    onClick={() => { item.action(); setIsNavDrawerOpen(false); }}
                                    sx={{
                                        '&:hover': {
                                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                        }
                                    }}
                                >
                                    <ListItemIcon sx={{ color: 'rgba(255,255,255,0.7)', minWidth: 40 }}>{item.icon}</ListItemIcon>
                                    <ListItemText
                                        primary={item.text}
                                        primaryTypographyProps={{
                                            fontSize: '0.9rem',
                                            color: 'white'
                                        }}
                                    />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>

                    <Box sx={{ px: 2, pb: 2, position: 'relative', zIndex: 1 }}>
                        <List>
                            {profileMenuItems.map((item) => (
                                <ListItem key={item.text} disablePadding>
                                    <ListItemButton
                                        onClick={() => { navigate(item.path); setIsNavDrawerOpen(false); }}
                                        sx={{
                                            '&:hover': {
                                                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                            }
                                        }}
                                    >
                                        <ListItemIcon sx={{ color: 'rgba(255,255,255,0.7)', minWidth: 40 }}>{item.icon}</ListItemIcon>
                                        <ListItemText
                                            primary={item.text}
                                            primaryTypographyProps={{
                                                fontSize: '0.9rem',
                                                color: 'white'
                                            }}
                                        />
                                    </ListItemButton>
                                </ListItem>
                            ))}
                        </List>

                        <ListItemButton
                            onClick={handleLogout}
                            sx={{
                                mt: 1,
                                borderRadius: '8px',
                                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                '&:hover': {
                                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                                },
                                justifyContent: 'center'
                            }}
                        >
                            <ListItemIcon sx={{ color: 'rgba(255,255,255,0.7)', minWidth: 'auto', mr: 1 }}>
                                <LogoutIcon />
                            </ListItemIcon>
                            <ListItemText
                                primary="Logout"
                                primaryTypographyProps={{
                                    fontSize: '0.9rem',
                                    fontWeight: 500,
                                    color: 'white'
                                }}
                            />
                        </ListItemButton>
                    </Box>
                </Box>
            </Drawer>

            {/* Tracking Drawer (Right) */}
            {isTrackingDrawerOpen && (
                <Box
                    onClick={() => setIsTrackingDrawerOpen(false)}
                    sx={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        bgcolor: 'rgba(0,0,0,0.7)',
                        zIndex: 1499,
                        transition: 'opacity 0.3s',
                    }}
                />
            )}
            <Drawer
                anchor="right"
                open={isTrackingDrawerOpen}
                onClose={() => setIsTrackingDrawerOpen(false)}
                PaperProps={{
                    sx: {
                        width: { xs: '90vw', sm: 400, md: 450 },
                        height: '100%',
                        bgcolor: '#0a0a0a',
                        zIndex: 1500,
                        position: 'fixed',
                        right: 0,
                        top: 0,
                    }
                }}
                ModalProps={{
                    keepMounted: true,
                    sx: { zIndex: 1500 }
                }}
            >
                <Box sx={{ width: { xs: '90vw', sm: 400, md: 450 }, height: '100%', bgcolor: '#0a0a0a' }} role="presentation">
                    <Suspense fallback={<CircularProgress sx={{ m: 4 }} />}>
                        {/* Pass trackingNumber to the component so it can auto-fetch */}
                        <TrackingDrawerContent
                            trackingIdentifier={trackingNumber}
                            isDrawer={true}
                            onClose={() => {
                                setIsTrackingDrawerOpen(false);
                                setTrackingNumber(''); // Clear the tracking number when closing
                            }}
                        />
                    </Suspense>
                </Box>
            </Drawer>

            {/* Shipments Fullscreen Modal */}
            <Dialog
                open={isShipmentsModalOpen}
                onClose={() => setIsShipmentsModalOpen(false)}
                TransitionComponent={Transition}
                fullWidth
                maxWidth="xl"
                sx={{
                    '& .MuiDialog-container': {
                        alignItems: 'flex-end',
                    },
                }}
                PaperProps={{
                    sx: {
                        height: { xs: '100%', md: '95vh' },
                        margin: 0,
                        bgcolor: 'white',
                        borderRadius: { xs: 0, md: '20px 20px 0 0' },
                        boxShadow: '0 -8px 24px rgba(0,0,0,0.12)',
                        overflow: 'hidden',
                    }
                }}
                BackdropProps={{
                    sx: {
                        backgroundColor: 'rgba(0, 0, 0, 0.4)'
                    }
                }}
            >
                <Box sx={{ height: '100%', width: '100%', overflowY: 'auto' }}>
                    <Suspense fallback={
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    }>
                        <ShipmentsComponent
                            isModal={true}
                            onClose={() => setIsShipmentsModalOpen(false)}
                        />
                    </Suspense>
                </Box>
            </Dialog>



            {/* Globe - always rendered but opacity is controlled */}
            <Box sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: showLoadingScreen ? 0 : 1,
                transition: 'opacity 1s ease-in-out',
                zIndex: 1,
            }}>
                <Suspense fallback={null}>
                    <ShipmentGlobe
                        ref={globeRef}
                        shipments={shipments.slice(0, 50)}
                        width="100%"
                        showOverlays={true}
                        statusCounts={statusCounts}
                    />
                </Suspense>
            </Box>

            {/* Loading Screen Overlay */}
            <Fade in={showLoadingScreen} timeout={{ enter: 0, exit: 1000 }}>
                <Box sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 20 }}>
                    <GlobeLoadingScreen />
                </Box>
            </Fade>
        </Box>
    );
};

export default Dashboard;