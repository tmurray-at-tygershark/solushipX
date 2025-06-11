import React, { useState, useMemo, useCallback, useEffect, lazy, Suspense } from 'react';
import {
    Box,
    CircularProgress
} from '@mui/material';
import { Timestamp } from 'firebase/firestore';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useCompany } from '../../contexts/CompanyContext';

// Lazy load the Globe component to prevent it from loading on other pages
const ShipmentGlobe = lazy(() => import('../Globe/Globe'));

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
        <Box sx={{
            height: 'calc(100vh - 64px)', // Full viewport height minus header
            overflow: 'hidden', // Prevent any potential scrollbars from appearing
            display: 'flex',
            flexDirection: 'column'
        }}>
            <GlobeWrapper shipments={shipments} statusCounts={statusCounts} />
        </Box>
    );
};

export default Dashboard;