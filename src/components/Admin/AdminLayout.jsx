import React, { Suspense, useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Box } from '@mui/material';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import AdminHeader from './AdminHeader';
import './AdminLayout.css';

const AdminLayout = () => {
    const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
    const [mapsApiKey, setMapsApiKey] = useState(null);

    // Initialize Google Maps for admin routes with direct loading
    useEffect(() => {
        const initializeMapsForAdmin = async () => {
            try {
                console.log('🗺️ [AdminLayout] Initializing Google Maps for admin routes...');

                // First, fetch API key from Firestore
                let apiKey = null;
                try {
                    const keysRef = collection(db, 'keys');
                    const keysSnapshot = await getDocs(keysRef);

                    if (!keysSnapshot.empty) {
                        const firstDoc = keysSnapshot.docs[0];
                        apiKey = firstDoc.data().googleAPI;
                        if (apiKey) {
                            setMapsApiKey(apiKey);
                            console.log('✅ [AdminLayout] Google Maps API key loaded');
                        }
                    }
                } catch (error) {
                    console.error('❌ [AdminLayout] Error fetching API key:', error);
                }

                if (window.google && window.google.maps) {
                    console.log('✅ [AdminLayout] Google Maps already loaded');
                    setIsGoogleMapsLoaded(true);
                    return;
                }

                // Load Google Maps script directly if not already loaded
                if (apiKey && !window.google) {
                    console.log('🔄 [AdminLayout] Loading Google Maps script...');

                    const script = document.createElement('script');
                    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=geometry,places`;
                    script.async = true;
                    script.defer = true;

                    script.onload = () => {
                        console.log('✅ [AdminLayout] Google Maps script loaded successfully');
                        setIsGoogleMapsLoaded(true);
                    };

                    script.onerror = (error) => {
                        console.error('❌ [AdminLayout] Failed to load Google Maps script:', error);
                    };

                    // Check if script is already added
                    const existingScript = document.querySelector(`script[src*="maps.googleapis.com"]`);
                    if (!existingScript) {
                        document.head.appendChild(script);
                    } else {
                        console.log('🔄 [AdminLayout] Google Maps script already exists, waiting for load...');

                        // Wait for existing script to load
                        const checkMaps = setInterval(() => {
                            if (window.google && window.google.maps) {
                                console.log('✅ [AdminLayout] Google Maps loaded from existing script');
                                setIsGoogleMapsLoaded(true);
                                clearInterval(checkMaps);
                            }
                        }, 500);

                        // Clean up after 15 seconds if not loaded
                        setTimeout(() => {
                            clearInterval(checkMaps);
                            if (!window.google || !window.google.maps) {
                                console.log('⚠️ [AdminLayout] Google Maps failed to load within 15 seconds');
                            }
                        }, 15000);
                    }
                } else {
                    console.log('🔄 [AdminLayout] Waiting for API key or existing Google Maps load...');

                    // Check periodically if Google Maps is loaded (from other components)
                    const checkMaps = setInterval(() => {
                        if (window.google && window.google.maps) {
                            console.log('✅ [AdminLayout] Google Maps loaded from other source');
                            setIsGoogleMapsLoaded(true);
                            clearInterval(checkMaps);
                        }
                    }, 1000);

                    // Clean up after 15 seconds if not loaded
                    setTimeout(() => {
                        clearInterval(checkMaps);
                        if (!window.google || !window.google.maps) {
                            console.log('⚠️ [AdminLayout] Google Maps failed to load within 15 seconds');
                        }
                    }, 15000);
                }
            } catch (error) {
                console.error('❌ [AdminLayout] Error initializing Maps:', error);
            }
        };

        initializeMapsForAdmin();
    }, []);

    // Store the maps status in window object for child components to access
    useEffect(() => {
        window.adminGoogleMapsStatus = {
            isLoaded: isGoogleMapsLoaded,
            apiKey: mapsApiKey
        };
    }, [isGoogleMapsLoaded, mapsApiKey]);

    return (
        <Box className="admin-layout">
            <AdminHeader />
            <Box className="admin-content">
                <Box className="admin-main-content">
                    <Suspense fallback={<div>Loading...</div>}>
                        <Outlet />
                    </Suspense>
                </Box>
            </Box>
        </Box>
    );
};

export default AdminLayout; 