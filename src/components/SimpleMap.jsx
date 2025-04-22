import React, { useEffect, useRef, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { getMapsApiKey } from '../utils/maps';

const SimpleMap = ({ address, title }) => {
    const mapRef = useRef(null);
    const [map, setMap] = useState(null);
    const [marker, setMarker] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        const initializeMap = async () => {
            try {
                // Get the API key
                const apiKey = await getMapsApiKey();

                // Load Google Maps script if not already loaded
                if (!window.google || !window.google.maps) {
                    await new Promise((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
                        script.async = true;
                        script.defer = true;
                        script.onload = resolve;
                        script.onerror = reject;
                        document.head.appendChild(script);
                    });
                }

                // Create map instance if not exists
                if (!mapRef.current) {
                    const mapInstance = new window.google.maps.Map(document.createElement('div'), {
                        zoom: 15,
                        mapTypeControl: false,
                        streetViewControl: false,
                        fullscreenControl: false
                    });
                    setMap(mapInstance);
                }

                // Geocode the address
                const geocoder = new window.google.maps.Geocoder();
                const addressString = `${address.street}, ${address.city}, ${address.state} ${address.postalCode}, ${address.country}`;

                geocoder.geocode({ address: addressString }, (results, status) => {
                    if (status === 'OK' && results[0]) {
                        const location = results[0].geometry.location;

                        // Update map center and zoom
                        map.setCenter(location);
                        map.setZoom(15);

                        // Create or update marker
                        if (marker) {
                            marker.setMap(null);
                        }
                        const newMarker = new window.google.maps.Marker({
                            map,
                            position: location,
                            title: title || 'Location'
                        });
                        setMarker(newMarker);
                    } else {
                        setError('Could not find the location on the map');
                    }
                });
            } catch (err) {
                console.error('Error initializing map:', err);
                setError('Failed to load the map');
            }
        };

        if (address) {
            initializeMap();
        }
    }, [address, title]);

    return (
        <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
            {error ? (
                <Box sx={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor: 'background.paper'
                }}>
                    <Typography color="error">{error}</Typography>
                </Box>
            ) : (
                <Box
                    ref={mapRef}
                    sx={{
                        width: '100%',
                        height: '100%',
                        '& > div': {
                            width: '100%',
                            height: '100%'
                        }
                    }}
                />
            )}
        </Box>
    );
};

export default SimpleMap; 