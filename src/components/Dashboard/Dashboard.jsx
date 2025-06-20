import React, { useState, useMemo, useCallback, useEffect, lazy, Suspense, useRef, forwardRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
    Button,
    DialogTitle,
    DialogContent,
    DialogActions,
    Chip,
    Stack,
    Card,
    CardContent,
    CardActions,
    Grid,
    Tooltip,
    Avatar,
    Menu,
    MenuItem,
    Divider,
    Collapse,
    Paper
} from '@mui/material';
import {
    Menu as MenuIcon,
    Search as SearchIcon,
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
    QrCodeScanner as BarcodeIcon,
    Add as AddIcon,
    ContactMail as ContactMailIcon,
    FlightTakeoff as TrackingIcon,
    ArrowBack as ArrowBackIcon,
    RocketLaunch as RocketLaunchIcon,
    Calculate as CalculateIcon,
    ExpandLess,
    ExpandMore,
    AccountBalanceWallet as AccountBalanceWalletIcon,
    AdminPanelSettings as AdminPanelSettingsIcon
} from '@mui/icons-material';
import { Timestamp } from 'firebase/firestore';
import { collection, query, orderBy, limit, onSnapshot, where, doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { ShipmentFormProvider } from '../../contexts/ShipmentFormContext';
import { motion as framerMotion } from 'framer-motion';

// Import responsive CSS
import './Dashboard.css';

// Lazy load the Globe component to prevent it from loading on other pages
const ShipmentGlobe = lazy(() => import('../Globe/Globe'));

// Lazy load the Tracking component for the drawer
const TrackingDrawerContent = lazy(() => import('../Tracking/Tracking'));

// Lazy load the Shipments component for the modal
const ShipmentsComponent = lazy(() => import('../Shipments/ShipmentsX'));

// Lazy load the CreateShipment component for the modal (step-by-step process)
const CreateShipmentComponent = lazy(() => import('../CreateShipment'));

// Lazy load the CreateShipmentX component for the modal (advanced single-page)
const CreateShipmentXComponent = lazy(() => import('../CreateShipment/CreateShipmentX'));

// Lazy load the QuickShip component for the modal
const QuickShipComponent = lazy(() => import('../CreateShipment/QuickShip'));

// Lazy load the Customers component for the modal
const CustomersComponent = lazy(() => import('../Customers/Customers'));

// Lazy load the Carriers component for the modal
const CarriersComponent = lazy(() => import('../Carriers/Carriers'));

// Lazy load the Reports component for the modal
const ReportsComponent = lazy(() => import('../Reports/Reports'));

// Lazy load the NotificationPreferences component for the modal
const NotificationPreferencesComponent = lazy(() => import('../NotificationPreferences/NotificationPreferences'));

// Lazy load the Profile component for the modal
const ProfileComponent = lazy(() => import('../Profile/Profile'));

// Lazy load the Company component for the modal
const CompanyComponent = lazy(() => import('../Company/Company'));

// Lazy load the AddressBook component for the modal
const AddressBookComponent = lazy(() => import('../AddressBook/AddressBook'));

// Lazy load the Billing component for the modal
const BillingComponent = lazy(() => import('../Billing/Billing'));

// Import ShipmentAgent for the main dashboard overlay
const ShipmentAgent = lazy(() => import('../ShipmentAgent/ShipmentAgent'));

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
                const newProgress = prevProgress + Math.random() * 20 + 5; // Faster progress

                // Update phase based on progress
                const newPhase = Math.floor((newProgress / 100) * loadingPhases.length);
                setCurrentPhase(Math.min(newPhase, loadingPhases.length - 1));

                return newProgress >= 100 ? 100 : newProgress;
            });
        }, 200); // Faster interval

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

// Add error boundary wrapper for lazy components to handle chunk loading errors
const LazyComponentWrapper = ({ children, fallback = <CircularProgress /> }) => {
    const [hasError, setHasError] = useState(false);

    useEffect(() => {
        const handleChunkError = (event) => {
            if (event.target.tagName === 'SCRIPT' && event.target.src.includes('chunk')) {
                console.warn('Chunk loading failed, reloading page...');
                window.location.reload();
            }
        };

        window.addEventListener('error', handleChunkError);
        return () => window.removeEventListener('error', handleChunkError);
    }, []);

    if (hasError) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', flexDirection: 'column', gap: 2 }}>
                <CircularProgress />
                <Typography>Loading component...</Typography>
            </Box>
        );
    }

    return (
        <Suspense fallback={fallback}>
            {children}
        </Suspense>
    );
};

const Dashboard = () => {
    const [shipments, setShipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [customers, setCustomers] = useState({});
    const { companyIdForAddress, companyData, loading: companyLoading, isAdmin } = useCompany();
    const navigate = useNavigate();
    const location = useLocation();
    const { logout, userRole, currentUser } = useAuth();

    // State for new UI elements
    const [isTrackingDrawerOpen, setIsTrackingDrawerOpen] = useState(false);
    const [trackingNumber, setTrackingNumber] = useState('');
    const [isShipmentsModalOpen, setIsShipmentsModalOpen] = useState(false);
    const [isCreateShipmentModalOpen, setIsCreateShipmentModalOpen] = useState(false);
    // const [isCustomersModalOpen, setIsCustomersModalOpen] = useState(false); // Replaced with Billing link
    const [isCarriersModalOpen, setIsCarriersModalOpen] = useState(false);
    const [isReportsModalOpen, setIsReportsModalOpen] = useState(false);
    const [isNotificationsModalOpen, setIsNotificationsModalOpen] = useState(false);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isCompanyModalOpen, setIsCompanyModalOpen] = useState(false);
    const [isAddressBookModalOpen, setIsAddressBookModalOpen] = useState(false);
    const [isQuickShipModalOpen, setIsQuickShipModalOpen] = useState(false);
    const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [createShipmentPrePopulatedData, setCreateShipmentPrePopulatedData] = useState(null);

    // Profile menu state
    const [profileMenuAnchor, setProfileMenuAnchor] = useState(null);
    const isProfileMenuOpen = Boolean(profileMenuAnchor);

    // Settings menu state
    const [settingsMenuAnchor, setSettingsMenuAnchor] = useState(null);
    const isSettingsMenuOpen = Boolean(settingsMenuAnchor);

    // User profile data state
    const [userProfileData, setUserProfileData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        photoURL: ''
    });

    // Modal navigation stack for chaining modals (e.g., Customers -> Shipments)
    const [modalStack, setModalStack] = useState([]);
    const [shipmentsDeepLinkParams, setShipmentsDeepLinkParams] = useState(null);
    const [customersDeepLinkParams, setCustomersDeepLinkParams] = useState(null);

    const [isMinLoadingTimePassed, setIsMinLoadingTimePassed] = useState(false);

    const globeRef = useRef(null); // Ref to access Globe's methods

    const [hasError, setHasError] = useState(false);
    const [isLoadingProfile, setIsLoadingProfile] = useState(false);
    const [newShipmentExpanded, setNewShipmentExpanded] = useState(false);

    useEffect(() => {
        // Ensure the loading screen is visible for at least 3 seconds
        // to allow the animation to complete while feeling fast and zippy.
        const timer = setTimeout(() => {
            setIsMinLoadingTimePassed(true);
        }, 3000);
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

    // Load user profile data
    useEffect(() => {
        const loadUserProfileData = async () => {
            if (!currentUser) return;

            try {
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    setUserProfileData({
                        photoURL: userData.photoURL || currentUser.photoURL || null,
                        firstName: userData.firstName || '',
                        lastName: userData.lastName || '',
                        email: userData.email || ''
                    });
                } else {
                    // Fallback to Firebase Auth data
                    setUserProfileData({
                        photoURL: currentUser.photoURL || null,
                        firstName: currentUser.displayName?.split(' ')[0] || '',
                        lastName: currentUser.displayName?.split(' ')[1] || '',
                        email: currentUser.email || ''
                    });
                }
            } catch (error) {
                console.error('Error loading user profile data:', error);
                // Fallback to Firebase Auth data
                setUserProfileData({
                    photoURL: currentUser.photoURL || null,
                    firstName: currentUser.displayName?.split(' ')[0] || '',
                    lastName: currentUser.displayName?.split(' ')[1] || '',
                    email: currentUser.email || ''
                });
            }
        };

        loadUserProfileData();
    }, [currentUser]);

    // Handle deep link navigation from email notifications
    useEffect(() => {
        const urlParams = new URLSearchParams(location.search);
        const modal = urlParams.get('modal');
        const customerId = urlParams.get('customerId');
        const noteId = urlParams.get('note');

        // Only process deep links if we have the required data and aren't loading
        if (modal && !loading && !companyLoading) {
            console.log('Processing deep link:', { modal, customerId, noteId });

            if (modal === 'customers' && customerId) {
                // Set deep link parameters for the customers component
                setCustomersDeepLinkParams({
                    customerId: customerId,
                    noteId: noteId
                });

                // Open customers modal with specific customer and note
                // setIsCustomersModalOpen(true); // Commented out - Customers replaced with Billing

                // Clear URL parameters after processing to avoid re-triggering
                const newUrl = window.location.pathname;
                window.history.replaceState({}, '', newUrl);

                console.log('Opened customers modal via deep link for customer:', customerId, 'note:', noteId);
            }
            // Add more modal types as needed (shipments, carriers, etc.)
        }
    }, [location.search, loading, companyLoading]);

    // Listen for custom events to open shipments modal (from Review component)
    useEffect(() => {
        const handleOpenShipmentsModal = () => {
            console.log('Received openShipmentsModal event, opening shipments modal');
            setIsShipmentsModalOpen(true);
        };

        window.addEventListener('openShipmentsModal', handleOpenShipmentsModal);

        return () => {
            window.removeEventListener('openShipmentsModal', handleOpenShipmentsModal);
        };
    }, []);

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

    // Profile menu handlers
    const handleProfileMenuOpen = (event) => {
        setProfileMenuAnchor(event.currentTarget);
    };

    const handleProfileMenuClose = () => {
        setProfileMenuAnchor(null);
    };

    const handleProfileMenuAction = (action) => {
        handleProfileMenuClose();
        if (action === 'profile') {
            setIsProfileModalOpen(true);
        } else if (action === 'company') {
            setIsCompanyModalOpen(true);
        } else if (action === 'logout') {
            handleLogout();
        }
    };

    // Settings menu handlers
    const handleSettingsMenuOpen = (event) => {
        setSettingsMenuAnchor(event.currentTarget);
    };

    const handleSettingsMenuClose = () => {
        setSettingsMenuAnchor(null);
    };

    const handleSettingsMenuAction = (action) => {
        handleSettingsMenuClose();
        if (action === 'notifications') {
            setIsNotificationsModalOpen(true);
        } else if (action === 'carriers') {
            setIsCarriersModalOpen(true);
        }
    };

    // Function to refresh user profile data (called when profile modal closes)
    const refreshUserProfileData = async () => {
        if (!currentUser) return;

        try {
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                setUserProfileData({
                    photoURL: userData.photoURL || currentUser.photoURL || null,
                    firstName: userData.firstName || '',
                    lastName: userData.lastName || '',
                    email: userData.email || ''
                });
            }
        } catch (error) {
            console.error('Error refreshing user profile data:', error);
        }
    };

    const handleOpenCreateShipmentModal = (prePopulatedData = null, draftId = null, quickshipDraftId = null, mode = 'advanced') => {
        console.log('🚀 Opening modal with:', { prePopulatedData, draftId, quickshipDraftId, mode });

        if (mode === 'quickship') {
            console.log('🚀 Opening QuickShip modal');

            // Close other modals first if open
            if (isShipmentsModalOpen) {
                setIsShipmentsModalOpen(false);
                setTimeout(() => {
                    setIsQuickShipModalOpen(true);
                }, 300);
            } else {
                setIsQuickShipModalOpen(true);
            }

            // Store the draft ID for QuickShip if provided
            if (quickshipDraftId) {
                console.log('🚀 Opening QuickShip modal for draft:', quickshipDraftId);
                setCreateShipmentPrePopulatedData({ quickshipDraftId: quickshipDraftId });
            } else {
                // Clear any previous data when opening QuickShip for new shipment
                setCreateShipmentPrePopulatedData(null);
            }

        } else {
            console.log('🔧 Opening CreateShipmentX modal (advanced single-page mode)');

            // Set pre-populated data if provided
            setCreateShipmentPrePopulatedData(prePopulatedData);

            // Set draft ID for editing existing drafts
            if (draftId) {
                console.log('📝 Opening CreateShipmentX modal to edit draft:', draftId);
                // We can use the prePopulatedData state to also pass the draft ID
                // The CreateShipmentX component will handle this appropriately
                setCreateShipmentPrePopulatedData(prev => ({
                    ...prev,
                    editDraftId: draftId
                }));
            }

            // Close other modals first if open
            if (isShipmentsModalOpen) {
                setIsShipmentsModalOpen(false);
                // Add a small delay to allow the first modal to close before opening the new one
                setTimeout(() => {
                    setIsCreateShipmentModalOpen(true);
                }, 300);
            } else {
                setIsCreateShipmentModalOpen(true);
            }
        }
    };

    // Handler for opening tracking drawer from Globe
    const handleOpenTrackingDrawerFromGlobe = (trackingId) => {
        setTrackingNumber(trackingId);
        setIsTrackingDrawerOpen(true);
    };

    // Handler for opening QuickShip modal (from CreateShipmentX)
    const handleOpenQuickShipModal = () => {
        console.log('Opening QuickShip modal, closing CreateShipmentX modal');
        // Close CreateShipmentX modal first
        setIsCreateShipmentModalOpen(false);
        // Small delay to allow modal to close before opening new one
        setTimeout(() => {
            setIsQuickShipModalOpen(true);
        }, 300);
    };

    // Handler for returning to shipments from CreateShipmentX
    const handleReturnToShipmentsFromCreateShipment = () => {
        setIsCreateShipmentModalOpen(false);
        setTimeout(() => {
            setIsShipmentsModalOpen(true);
        }, 300);
    };

    // Handler for viewing shipment from CreateShipmentX
    const handleViewShipment = (shipmentId) => {
        console.log('Viewing shipment from CreateShipmentX:', shipmentId);

        // Close CreateShipmentX modal
        setIsCreateShipmentModalOpen(false);

        // Open Shipments modal directly to shipment detail (bypassing the table)
        setShipmentsDeepLinkParams({
            directToDetail: true,
            selectedShipmentId: shipmentId
        });

        // Open Shipments modal after a brief delay
        setTimeout(() => {
            setIsShipmentsModalOpen(true);
        }, 300);
    };

    // Handler for clearing deep link parameters when navigating back from shipment detail
    const handleClearDeepLinkParams = useCallback(() => {
        console.log('Clearing deep link parameters to prevent auto-navigation loop');
        setShipmentsDeepLinkParams(null);
    }, []);

    // Handler for navigating from Customers to Shipments with deep linking
    const handleNavigateToShipments = useCallback((deepLinkParams = {}) => {
        console.log('Navigating to Shipments with params:', deepLinkParams);

        // Add current modal to stack
        setModalStack(prev => [...prev, 'customers']);

        // Set deep link parameters
        setShipmentsDeepLinkParams(deepLinkParams);

        // Close customers modal and open shipments modal
        // setIsCustomersModalOpen(false); // Commented out - Customers replaced with Billing
        setTimeout(() => {
            setIsShipmentsModalOpen(true);
        }, 300); // Delay to allow slide transition
    }, []);

    // Handler for modal back navigation
    const handleModalBack = useCallback(() => {
        console.log('Modal back navigation, current stack:', modalStack);

        if (modalStack.length > 0) {
            const previousModal = modalStack[modalStack.length - 1];

            // Remove from stack
            setModalStack(prev => prev.slice(0, -1));

            // Clear deep link parameters
            setShipmentsDeepLinkParams(null);

            // Close current modal and open previous
            setIsShipmentsModalOpen(false);
            setTimeout(() => {
                if (previousModal === 'customers') {
                    // setIsCustomersModalOpen(true); // Commented out - Customers replaced with Billing
                } else if (previousModal === 'shipments') {
                    // If previous modal was shipments, just close the current modal
                    setIsShipmentsModalOpen(false);
                }
                // Add more modal types as needed
            }, 300); // Delay to allow slide transition
        }
    }, [modalStack]);

    const menuItems = [
        {
            text: 'New Shipment',
            icon: <AddIcon />,
            action: () => setNewShipmentExpanded(!newShipmentExpanded),
            expandable: true,
            expanded: newShipmentExpanded,
            subItems: [
                {
                    text: 'Quick Ship',
                    icon: <RocketLaunchIcon />,
                    description: 'Fast manual entry',
                    action: () => {
                        handleOpenQuickShipModal();
                        setNewShipmentExpanded(false);
                    }
                },
                {
                    text: 'Real-Time Rates',
                    icon: <CalculateIcon />,
                    description: 'Advanced single-page rate comparison',
                    action: () => {
                        handleOpenCreateShipmentModal();
                        setNewShipmentExpanded(false);
                    }
                }
            ]
        },
        { text: 'Shipments', icon: <LocalShippingIcon />, action: () => setIsShipmentsModalOpen(true) },
        { text: 'Address Book', icon: <ContactMailIcon />, action: () => setIsAddressBookModalOpen(true) },
        { text: 'Billing', icon: <AccountBalanceWalletIcon />, action: () => setIsBillingModalOpen(true) },
        { text: 'Reports', icon: <AssessmentIcon />, action: () => setIsReportsModalOpen(true) },
    ];

    const profileMenuItems = [
        // Empty array since My Company moved to profile dropdown
    ];

    return (
        <Box className="dashboard-container" sx={{
            height: '100vh',
            width: '100vw',
            overflow: 'hidden',
            position: 'relative',
            bgcolor: '#000'
        }}>
            {/* Enhanced Responsive Header */}
            <Box sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                p: { xs: 1, sm: 1.5, md: 2 },
                zIndex: 10,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                // Completely transparent header with no background
                transition: 'all 0.3s ease'
            }}>
                {/* Right Section - Profile and Settings */}
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    justifyContent: 'flex-end',
                    width: '100%'
                }}>
                    {/* Profile Avatar */}
                    <IconButton
                        onClick={handleProfileMenuOpen}
                        sx={{
                            p: 0.5,
                            ml: 1,
                            '&:hover': {
                                transform: 'scale(1.05)'
                            },
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <Avatar
                            src={userProfileData.photoURL}
                            sx={{
                                width: { xs: 32, sm: 36, md: 40 },
                                height: { xs: 32, sm: 36, md: 40 },
                                bgcolor: 'rgba(255, 255, 255, 0.1)',
                                border: '2px solid rgba(255, 255, 255, 0.2)',
                                color: 'white',
                                fontSize: { xs: '1rem', sm: '1.1rem', md: '1.2rem' },
                                fontWeight: 600,
                                cursor: 'pointer',
                                '&:hover': {
                                    bgcolor: 'rgba(255, 255, 255, 0.15)',
                                    borderColor: 'rgba(255, 255, 255, 0.4)'
                                }
                            }}
                        >
                            {!userProfileData.photoURL && (
                                userProfileData.firstName && userProfileData.lastName
                                    ? `${userProfileData.firstName[0]}${userProfileData.lastName[0]}`
                                    : currentUser?.displayName?.[0] || currentUser?.email?.[0] || '?'
                            )}
                        </Avatar>
                    </IconButton>

                    {/* Settings Gear Icon */}
                    <IconButton
                        onClick={handleSettingsMenuOpen}
                        sx={{
                            color: '#666666',
                            p: 0.5,
                            ml: 0.5,
                            '&:hover': {
                                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                transform: 'scale(1.05)'
                            },
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <SettingsIcon sx={{
                            fontSize: { xs: '1.5rem', sm: '1.6rem', md: '1.8rem' }
                        }} />
                    </IconButton>
                </Box>
            </Box>

            {/* Profile Menu Dropdown */}
            <Menu
                anchorEl={profileMenuAnchor}
                open={isProfileMenuOpen}
                onClose={handleProfileMenuClose}
                onClick={handleProfileMenuClose}
                PaperProps={{
                    elevation: 3,
                    sx: {
                        overflow: 'visible',
                        filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                        mt: 1.5,
                        minWidth: 180,
                        '&:before': {
                            content: '""',
                            display: 'block',
                            position: 'absolute',
                            top: 0,
                            right: 14,
                            width: 10,
                            height: 10,
                            bgcolor: 'background.paper',
                            transform: 'translateY(-50%) rotate(45deg)',
                            zIndex: 0,
                        },
                    },
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                <MenuItem
                    onClick={() => handleProfileMenuAction('profile')}
                    sx={{
                        py: 1.5,
                        px: 2,
                        '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.04)'
                        }
                    }}
                >
                    <ListItemIcon sx={{ mr: 1, minWidth: 'auto' }}>
                        <AccountCircleIcon fontSize="small" />
                    </ListItemIcon>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Profile
                    </Typography>
                </MenuItem>

                <MenuItem
                    onClick={() => handleProfileMenuAction('company')}
                    sx={{
                        py: 1.5,
                        px: 2,
                        '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.04)'
                        }
                    }}
                >
                    <ListItemIcon sx={{ mr: 1, minWidth: 'auto' }}>
                        <BusinessIcon fontSize="small" />
                    </ListItemIcon>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Company
                    </Typography>
                </MenuItem>

                <Divider />

                <MenuItem
                    onClick={() => handleProfileMenuAction('logout')}
                    sx={{
                        py: 1.5,
                        px: 2,
                        '&:hover': {
                            bgcolor: 'rgba(244, 67, 54, 0.04)'
                        }
                    }}
                >
                    <ListItemIcon sx={{ mr: 1, minWidth: 'auto' }}>
                        <LogoutIcon fontSize="small" sx={{ color: '#f44336' }} />
                    </ListItemIcon>
                    <Typography variant="body2" sx={{ fontWeight: 500, color: '#f44336' }}>
                        Sign Out
                    </Typography>
                </MenuItem>
            </Menu>

            {/* Settings Menu Dropdown */}
            <Menu
                anchorEl={settingsMenuAnchor}
                open={isSettingsMenuOpen}
                onClose={handleSettingsMenuClose}
                onClick={handleSettingsMenuClose}
                PaperProps={{
                    elevation: 3,
                    sx: {
                        overflow: 'visible',
                        filter: 'drop-shadow(0px 2px 8px rgba(0,0,0,0.32))',
                        mt: 1.5,
                        minWidth: 180,
                        '&:before': {
                            content: '""',
                            display: 'block',
                            position: 'absolute',
                            top: 0,
                            right: 14,
                            width: 10,
                            height: 10,
                            bgcolor: 'background.paper',
                            transform: 'translateY(-50%) rotate(45deg)',
                            zIndex: 0,
                        },
                    },
                }}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
                <MenuItem
                    onClick={() => handleSettingsMenuAction('notifications')}
                    sx={{
                        py: 1.5,
                        px: 2,
                        '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.04)'
                        }
                    }}
                >
                    <ListItemIcon sx={{ mr: 1, minWidth: 'auto' }}>
                        <NotificationsIcon fontSize="small" />
                    </ListItemIcon>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Notifications
                    </Typography>
                </MenuItem>

                <MenuItem
                    onClick={() => handleSettingsMenuAction('carriers')}
                    sx={{
                        py: 1.5,
                        px: 2,
                        '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.04)'
                        }
                    }}
                >
                    <ListItemIcon sx={{ mr: 1, minWidth: 'auto' }}>
                        <BusinessIcon fontSize="small" />
                    </ListItemIcon>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Carriers
                    </Typography>
                </MenuItem>
            </Menu>

            {/* Left Side Navigation Panel */}
            <Box sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: { xs: '220px', sm: '240px', md: '260px' },
                height: '100vh',
                color: 'white',
                display: 'flex',
                flexDirection: 'column',
                background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
                zIndex: 5,
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

                {/* Header with Logo */}
                <Box sx={{
                    p: { xs: 1.5, sm: 2 },
                    display: 'flex',
                    justifyContent: 'flex-start',
                    position: 'relative',
                    zIndex: 1,
                    borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
                }}>
                    <img
                        src="/images/integratedcarrriers_logo_white.png"
                        alt="SoluShipX"
                        style={{ height: 60 }}
                    />
                </Box>

                {/* Tracking Search Box */}
                <Box sx={{
                    px: { xs: 1.5, sm: 2 },
                    py: 2,
                    position: 'relative',
                    zIndex: 1
                }}>
                    <TextField
                        fullWidth
                        variant="outlined"
                        size="small"
                        value={trackingNumber}
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleTrackShipment()}
                        placeholder="Track Shipment"
                        className="tracking-search-box"
                        InputProps={{
                            startAdornment: (
                                <InputAdornment position="start">
                                    <BarcodeIcon sx={{
                                        color: 'rgba(0, 0, 0, 0.6)',
                                        fontSize: '20px'
                                    }} />
                                </InputAdornment>
                            ),
                            sx: {
                                '& .MuiInputBase-input': {
                                    fontSize: '12px',
                                    color: '#000',
                                    '&::placeholder': {
                                        color: 'rgba(0, 0, 0, 0.5)',
                                        opacity: 1
                                    }
                                }
                            }
                        }}
                        sx={{
                            '& .MuiOutlinedInput-root': {
                                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                                borderRadius: '8px',
                                '& fieldset': {
                                    borderColor: 'rgba(255, 255, 255, 0.3)',
                                },
                                '&:hover fieldset': {
                                    borderColor: 'rgba(255, 255, 255, 0.5)',
                                },
                                '&.Mui-focused fieldset': {
                                    borderColor: 'rgba(255, 255, 255, 0.7)',
                                },
                            },
                            '& .MuiInputBase-input': {
                                fontSize: '12px',
                                py: 1
                            }
                        }}
                    />
                </Box>

                {/* Enhanced Menu Items */}
                <List sx={{
                    flexGrow: 1,
                    position: 'relative',
                    zIndex: 1,
                    px: { xs: 0.5, sm: 1 },
                    py: 0
                }}>
                    {menuItems.map((item, index) => (
                        <React.Fragment key={item.text}>
                            <ListItem disablePadding sx={{ mb: 0.5 }}>
                                <ListItemButton
                                    onClick={item.action}
                                    sx={{
                                        borderRadius: '12px',
                                        py: { xs: 1.25, sm: 1.5 },
                                        px: { xs: 1.5, sm: 2 },
                                        backgroundColor: item.expanded ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                                        '&:hover': {
                                            backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                            transform: 'translateX(4px)',
                                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)'
                                        },
                                        transition: 'all 0.3s ease'
                                    }}
                                >
                                    <ListItemIcon sx={{
                                        color: 'rgba(255,255,255,0.8) !important',
                                        minWidth: { xs: 36, sm: 40 },
                                        '& .MuiSvgIcon-root': {
                                            fontSize: { xs: '1.2rem', sm: '1.3rem', md: '1.3rem' }
                                        }
                                    }}>
                                        {item.icon}
                                    </ListItemIcon>
                                    <ListItemText
                                        primary={item.text}
                                        primaryTypographyProps={{
                                            fontSize: { xs: '0.85rem', sm: '0.9rem', md: '0.9rem' },
                                            fontWeight: 500,
                                            color: 'white'
                                        }}
                                    />
                                    {item.expandable && (
                                        item.expanded ? (
                                            <ExpandLess sx={{ color: 'rgba(255,255,255,0.6)' }} />
                                        ) : (
                                            <ExpandMore sx={{ color: 'rgba(255,255,255,0.6)' }} />
                                        )
                                    )}
                                </ListItemButton>
                            </ListItem>

                            {/* Submenu items */}
                            {item.expandable && (
                                <Collapse in={item.expanded} timeout="auto" unmountOnExit>
                                    <List component="div" disablePadding>
                                        {item.subItems?.map((subItem) => (
                                            <ListItem key={subItem.text} disablePadding sx={{ mb: 0.5 }}>
                                                <ListItemButton
                                                    onClick={subItem.action}
                                                    sx={{
                                                        borderRadius: '12px',
                                                        py: { xs: 1.25, sm: 1.5 },
                                                        px: { xs: 1.5, sm: 2 },
                                                        backgroundColor: 'rgba(255, 255, 255, 0.03)',
                                                        border: '1px solid rgba(255, 255, 255, 0.08)',
                                                        '&:hover': {
                                                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                                                            borderColor: 'rgba(255, 255, 255, 0.15)',
                                                            transform: 'translateX(4px)',
                                                            '& .subitem-icon': {
                                                                transform: 'scale(1.1)',
                                                            }
                                                        },
                                                        transition: 'all 0.2s ease'
                                                    }}
                                                >
                                                    <ListItemIcon sx={{
                                                        color: 'rgba(255,255,255,0.7) !important',
                                                        minWidth: { xs: 36, sm: 40 },
                                                        '& .MuiSvgIcon-root': {
                                                            fontSize: { xs: '1.2rem', sm: '1.3rem', md: '1.3rem' },
                                                            className: 'subitem-icon',
                                                            transition: 'transform 0.2s ease'
                                                        }
                                                    }}>
                                                        {subItem.icon}
                                                    </ListItemIcon>
                                                    <ListItemText
                                                        primary={subItem.text}
                                                        secondary={subItem.description}
                                                        primaryTypographyProps={{
                                                            fontSize: { xs: '0.85rem', sm: '0.9rem', md: '0.9rem' },
                                                            fontWeight: 500,
                                                            color: 'rgba(255,255,255,0.9)'
                                                        }}
                                                        secondaryTypographyProps={{
                                                            fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                                            color: 'rgba(255,255,255,0.5)'
                                                        }}
                                                    />
                                                </ListItemButton>
                                            </ListItem>
                                        ))}
                                    </List>
                                </Collapse>
                            )}
                        </React.Fragment>
                    ))}
                </List>

                {/* Footer Section */}
                <Box sx={{
                    px: { xs: 1.5, sm: 2 },
                    pb: { xs: 1.5, sm: 2 },
                    position: 'relative',
                    zIndex: 1,
                    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
                    pt: 2
                }}>
                    {/* Admin Return Button - Only visible for admin users */}
                    {(userRole === 'admin' || userRole === 'super_admin') && (
                        <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<AdminPanelSettingsIcon />}
                            onClick={() => navigate('/admin')}
                            sx={{
                                borderRadius: '12px',
                                py: 1.5,
                                borderColor: 'rgba(255, 255, 255, 0.2)',
                                color: 'rgba(255, 255, 255, 0.9)',
                                fontSize: { xs: '0.85rem', sm: '0.9rem' },
                                fontWeight: 500,
                                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                                backdropFilter: 'blur(10px)',
                                '&:hover': {
                                    borderColor: 'rgba(255, 255, 255, 0.4)',
                                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                                    transform: 'translateY(-2px)',
                                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)'
                                },
                                transition: 'all 0.3s ease',
                                textTransform: 'none',
                                '& .MuiButton-startIcon': {
                                    color: 'rgba(255, 255, 255, 0.7)'
                                }
                            }}
                        >
                            Return to Admin
                        </Button>
                    )}
                </Box>
            </Box>

            {/* Enhanced Tracking Drawer (Right) */}
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
                        width: {
                            xs: '100vw',
                            sm: '420px',
                            md: '480px',
                            lg: '520px'
                        },
                        maxWidth: '100vw',
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
                <Box sx={{
                    width: '100%',
                    height: '100%',
                    bgcolor: '#0a0a0a'
                }} role="presentation">
                    <LazyComponentWrapper fallback={<CircularProgress sx={{ m: 4 }} />}>
                        {/* Pass trackingNumber to the component so it can auto-fetch */}
                        <TrackingDrawerContent
                            trackingIdentifier={trackingNumber}
                            isDrawer={true}
                            onClose={() => {
                                setIsTrackingDrawerOpen(false);
                                setTrackingNumber(''); // Clear the tracking number when closing
                            }}
                        />
                    </LazyComponentWrapper>
                </Box>
            </Drawer>

            {/* Shipments Fullscreen Modal */}
            <Dialog
                open={isShipmentsModalOpen}
                onClose={() => {
                    setIsShipmentsModalOpen(false);
                    // Clear deep link parameters when modal closes to prevent sticky navigation
                    setShipmentsDeepLinkParams(null);
                }}
                TransitionComponent={Transition}
                fullScreen
                sx={{
                    '& .MuiDialog-container': {
                        alignItems: 'flex-end',
                    },
                }}
                PaperProps={{
                    sx: {
                        height: '100vh',
                        width: '100vw',
                        margin: 0,
                        bgcolor: 'white',
                        borderRadius: 0,
                        boxShadow: 'none',
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
                    <LazyComponentWrapper fallback={
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    }>
                        <ShipmentsComponent
                            isModal={true}
                            onClose={() => {
                                setIsShipmentsModalOpen(false);
                                // Clear deep link parameters when modal closes to prevent sticky navigation
                                setShipmentsDeepLinkParams(null);
                            }}
                            showCloseButton={true}
                            onModalBack={modalStack.length > 0 ? handleModalBack : null}
                            deepLinkParams={shipmentsDeepLinkParams}
                            onOpenCreateShipment={handleOpenCreateShipmentModal}
                            onClearDeepLinkParams={handleClearDeepLinkParams}
                        />
                    </LazyComponentWrapper>
                </Box>
            </Dialog>

            {/* Create Shipment Fullscreen Modal */}
            <Dialog
                open={isCreateShipmentModalOpen}
                onClose={() => setIsCreateShipmentModalOpen(false)}
                TransitionComponent={Transition}
                fullScreen
                sx={{
                    '& .MuiDialog-container': {
                        alignItems: 'flex-end',
                    },
                }}
                PaperProps={{
                    sx: {
                        height: '100vh',
                        width: '100vw',
                        margin: 0,
                        bgcolor: 'white',
                        borderRadius: 0,
                        boxShadow: 'none',
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
                    <LazyComponentWrapper fallback={
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    }>
                        <CreateShipmentXComponent
                            isModal={true}
                            onClose={() => {
                                setIsCreateShipmentModalOpen(false);
                                // Clear pre-populated data when modal closes
                                setCreateShipmentPrePopulatedData(null);
                            }}
                            onReturnToShipments={handleReturnToShipmentsFromCreateShipment}
                            onViewShipment={handleViewShipment}
                            showCloseButton={true}
                            draftId={createShipmentPrePopulatedData?.editDraftId || null}
                            prePopulatedData={createShipmentPrePopulatedData}
                        />
                    </LazyComponentWrapper>
                </Box>
            </Dialog>

            {/* Customers Fullscreen Modal - Commented out, replaced with Billing link */}
            {/* <Dialog
                open={isCustomersModalOpen}
                onClose={() => setIsCustomersModalOpen(false)}
                TransitionComponent={Transition}
                fullScreen
                sx={{
                    '& .MuiDialog-container': {
                        alignItems: 'flex-end',
                    },
                }}
                PaperProps={{
                    sx: {
                        height: '100vh',
                        width: '100vw',
                        margin: 0,
                        bgcolor: 'white',
                        borderRadius: 0,
                        boxShadow: 'none',
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
                    <LazyComponentWrapper fallback={
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    }>
                        <CustomersComponent
                            isModal={true}
                            onClose={() => {
                                setIsCustomersModalOpen(false);
                                setCustomersDeepLinkParams(null); // Clear deep link params when modal closes
                            }}
                            showCloseButton={true}
                            onNavigateToShipments={handleNavigateToShipments}
                            deepLinkParams={customersDeepLinkParams}
                        />
                    </LazyComponentWrapper>
                </Box>
            </Dialog> */}

            {/* Carriers Fullscreen Modal */}
            <Dialog
                open={isCarriersModalOpen}
                onClose={() => setIsCarriersModalOpen(false)}
                TransitionComponent={Transition}
                fullScreen
                sx={{
                    '& .MuiDialog-container': {
                        alignItems: 'flex-end',
                    },
                }}
                PaperProps={{
                    sx: {
                        height: '100vh',
                        width: '100vw',
                        margin: 0,
                        bgcolor: 'white',
                        borderRadius: 0,
                        boxShadow: 'none',
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
                    <LazyComponentWrapper fallback={
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    }>
                        <CarriersComponent
                            isModal={true}
                            onClose={() => setIsCarriersModalOpen(false)}
                            showCloseButton={true}
                        />
                    </LazyComponentWrapper>
                </Box>
            </Dialog>

            {/* Reports Fullscreen Modal */}
            <Dialog
                open={isReportsModalOpen}
                onClose={() => setIsReportsModalOpen(false)}
                TransitionComponent={Transition}
                fullScreen
                sx={{
                    '& .MuiDialog-container': {
                        alignItems: 'flex-end',
                    },
                }}
                PaperProps={{
                    sx: {
                        height: '100vh',
                        width: '100vw',
                        margin: 0,
                        bgcolor: 'white',
                        borderRadius: 0,
                        boxShadow: 'none',
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
                    <LazyComponentWrapper fallback={
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    }>
                        <ReportsComponent
                            isModal={true}
                            onClose={() => setIsReportsModalOpen(false)}
                            showCloseButton={true}
                        />
                    </LazyComponentWrapper>
                </Box>
            </Dialog>

            {/* Notifications Fullscreen Modal */}
            <Dialog
                open={isNotificationsModalOpen}
                onClose={() => setIsNotificationsModalOpen(false)}
                TransitionComponent={Transition}
                fullScreen
                sx={{
                    '& .MuiDialog-container': {
                        alignItems: 'flex-end',
                    },
                }}
                PaperProps={{
                    sx: {
                        height: '100vh',
                        width: '100vw',
                        margin: 0,
                        bgcolor: 'white',
                        borderRadius: 0,
                        boxShadow: 'none',
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
                    <LazyComponentWrapper fallback={
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    }>
                        <NotificationPreferencesComponent
                            isModal={true}
                            onClose={() => setIsNotificationsModalOpen(false)}
                            showCloseButton={true}
                        />
                    </LazyComponentWrapper>
                </Box>
            </Dialog>

            {/* Profile Fullscreen Modal */}
            <Dialog
                open={isProfileModalOpen}
                onClose={() => {
                    setIsProfileModalOpen(false);
                    refreshUserProfileData(); // Refresh profile data when modal closes
                }}
                TransitionComponent={Transition}
                fullScreen
                sx={{
                    '& .MuiDialog-container': {
                        alignItems: 'flex-end',
                    },
                }}
                PaperProps={{
                    sx: {
                        height: '100vh',
                        width: '100vw',
                        margin: 0,
                        bgcolor: 'white',
                        borderRadius: 0,
                        boxShadow: 'none',
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
                    <LazyComponentWrapper fallback={
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    }>
                        <ProfileComponent
                            isModal={true}
                            onClose={() => {
                                setIsProfileModalOpen(false);
                                refreshUserProfileData(); // Refresh profile data when modal closes
                            }}
                            showCloseButton={true}
                        />
                    </LazyComponentWrapper>
                </Box>
            </Dialog>

            {/* Company Fullscreen Modal */}
            <Dialog
                open={isCompanyModalOpen}
                onClose={() => setIsCompanyModalOpen(false)}
                TransitionComponent={Transition}
                fullScreen
                sx={{
                    '& .MuiDialog-container': {
                        alignItems: 'flex-end',
                    },
                }}
                PaperProps={{
                    sx: {
                        height: '100vh',
                        width: '100vw',
                        margin: 0,
                        bgcolor: 'white',
                        borderRadius: 0,
                        boxShadow: 'none',
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
                    <LazyComponentWrapper fallback={
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    }>
                        <CompanyComponent
                            isModal={true}
                            onClose={() => setIsCompanyModalOpen(false)}
                            showCloseButton={true}
                        />
                    </LazyComponentWrapper>
                </Box>
            </Dialog>

            {/* Address Book Fullscreen Modal */}
            <Dialog
                open={isAddressBookModalOpen}
                onClose={() => setIsAddressBookModalOpen(false)}
                TransitionComponent={Transition}
                fullScreen
                sx={{
                    '& .MuiDialog-container': {
                        alignItems: 'flex-end',
                    },
                }}
                PaperProps={{
                    sx: {
                        height: '100vh',
                        width: '100vw',
                        margin: 0,
                        bgcolor: 'white',
                        borderRadius: 0,
                        boxShadow: 'none',
                        overflow: 'hidden',
                    }
                }}
                BackdropProps={{
                    sx: {
                        backgroundColor: 'rgba(0, 0, 0, 0.4)'
                    }
                }}
            >
                <Box sx={{ height: '100%', width: '100%', overflow: 'hidden' }}>
                    <LazyComponentWrapper fallback={
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    }>
                        <AddressBookComponent
                            isModal={true}
                            onClose={() => setIsAddressBookModalOpen(false)}
                            showCloseButton={true}
                        />
                    </LazyComponentWrapper>
                </Box>
            </Dialog>

            {/* Billing Fullscreen Modal */}
            <Dialog
                open={isBillingModalOpen}
                onClose={() => setIsBillingModalOpen(false)}
                TransitionComponent={Transition}
                fullScreen
                sx={{
                    '& .MuiDialog-container': {
                        alignItems: 'flex-end',
                    },
                }}
                PaperProps={{
                    sx: {
                        height: '100vh',
                        width: '100vw',
                        margin: 0,
                        bgcolor: 'white',
                        borderRadius: 0,
                        boxShadow: 'none',
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
                    <LazyComponentWrapper fallback={
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    }>
                        <BillingComponent
                            isModal={true}
                            onClose={() => setIsBillingModalOpen(false)}
                            showCloseButton={true}
                        />
                    </LazyComponentWrapper>
                </Box>
            </Dialog>

            {/* QuickShip Fullscreen Modal */}
            <Dialog
                open={isQuickShipModalOpen}
                onClose={() => setIsQuickShipModalOpen(false)}
                TransitionComponent={Transition}
                fullScreen
                sx={{
                    '& .MuiDialog-container': {
                        alignItems: 'flex-end',
                    },
                }}
                PaperProps={{
                    sx: {
                        height: '100vh',
                        width: '100vw',
                        margin: 0,
                        bgcolor: 'white',
                        borderRadius: 0,
                        boxShadow: 'none',
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
                    <LazyComponentWrapper fallback={
                        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <CircularProgress />
                        </Box>
                    }>
                        <ShipmentFormProvider>
                            <QuickShipComponent
                                isModal={true}
                                onClose={() => {
                                    setIsQuickShipModalOpen(false);
                                    // Clear pre-populated data when modal closes
                                    setCreateShipmentPrePopulatedData(null);
                                }}
                                onReturnToShipments={handleReturnToShipmentsFromCreateShipment}
                                onViewShipment={handleViewShipment}
                                draftId={createShipmentPrePopulatedData?.quickshipDraftId || null}
                                showCloseButton={true}
                            />
                        </ShipmentFormProvider>
                    </LazyComponentWrapper>
                </Box>
            </Dialog>

            {/* AI Shipping Agent Overlay */}
            {companyData?.id && (
                <LazyComponentWrapper fallback={null}>
                    <ShipmentAgent
                        companyId={companyData.id}
                        inModal={false}
                        isPanelOpen={isChatOpen}
                        setIsPanelOpen={setIsChatOpen}
                        currentShipmentId={null}
                        sx={{ zIndex: 1000 }}
                    />
                </LazyComponentWrapper>
            )}

            {/* Globe - always rendered but opacity is controlled */}
            <Box sx={{
                position: 'absolute',
                top: 0,
                left: { xs: '220px', sm: '240px', md: '260px' },
                width: 'calc(100% - 220px)',
                '@media (min-width: 600px)': {
                    width: 'calc(100% - 240px)'
                },
                '@media (min-width: 960px)': {
                    width: 'calc(100% - 260px)'
                },
                height: '100%',
                opacity: showLoadingScreen ? 0 : 1,
                transition: 'opacity 1s ease-in-out',
                zIndex: 1,
            }}>
                <LazyComponentWrapper fallback={null}>
                    <ShipmentGlobe
                        ref={globeRef}
                        shipments={shipments.slice(0, 50)}
                        width="100%"
                        showOverlays={true}
                        statusCounts={statusCounts}
                        onOpenTrackingDrawer={handleOpenTrackingDrawerFromGlobe}
                    />
                </LazyComponentWrapper>
            </Box>

            {/* Loading Screen Overlay - Now as background with lower z-index */}
            <Fade in={showLoadingScreen} timeout={{ enter: 0, exit: 1000 }}>
                <Box sx={{
                    position: 'absolute',
                    top: 0,
                    left: { xs: '220px', sm: '240px', md: '260px' },
                    width: 'calc(100% - 220px)',
                    '@media (min-width: 600px)': {
                        width: 'calc(100% - 240px)'
                    },
                    '@media (min-width: 960px)': {
                        width: 'calc(100% - 260px)'
                    },
                    height: '100%',
                    zIndex: 2,
                    pointerEvents: 'none'
                }}>
                    <GlobeLoadingScreen />
                </Box>
            </Fade>
        </Box>
    );
};

export default Dashboard;