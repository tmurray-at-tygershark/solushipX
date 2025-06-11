import React, { useState, useRef, useEffect } from 'react';
import {
    Grid,
    Paper,
    Typography,
    Box,
    Button,
    CircularProgress
} from '@mui/material';
import {
    LocationOn as LocationOnIcon
} from '@mui/icons-material';
import { GoogleMap, Marker } from '@react-google-maps/api';

// Optimize SimpleMap component - copied exactly from original
const SimpleMap = React.memo(({ address, title }) => {
    const [position, setPosition] = useState(null);
    const [error, setError] = useState(null);
    const mapRef = useRef(null);

    useEffect(() => {
        if (!window.google || !window.google.maps) {
            setError('Google Maps not loaded');
            return;
        }

        if (!address) {
            setError('Address information is missing');
            return;
        }

        const geocoder = new window.google.maps.Geocoder();
        const addressString = `${address.street || ''}${address.street2 ? ', ' + address.street2 : ''}, ${address.city || ''}, ${address.state || ''} ${address.postalCode || ''}, ${address.country || ''}`;

        geocoder.geocode({ address: addressString }, (results, status) => {
            if (status === 'OK') {
                const location = results[0].geometry.location;
                setPosition({
                    lat: location.lat(),
                    lng: location.lng()
                });

                // Fit bounds with padding
                if (mapRef.current) {
                    const bounds = new window.google.maps.LatLngBounds();
                    bounds.extend(location);
                    mapRef.current.fitBounds(bounds, {
                        padding: { top: 50, right: 50, bottom: 50, left: 50 }
                    });
                }
            } else {
                console.error('Geocoding failed:', status);
                setError('Failed to geocode address');
            }
        });
    }, [address]);

    const handleMapLoad = React.useCallback((map) => {
        mapRef.current = map;
    }, []);

    if (error) {
        return (
            <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
                    {title}
                </Typography>
                <Box sx={{
                    height: '200px',
                    borderRadius: '12px',
                    bgcolor: '#f5f5f5',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1
                }}>
                    <Typography color="error">{error}</Typography>
                    <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        onClick={() => window.location.reload()}
                    >
                        Retry
                    </Button>
                </Box>
            </Box>
        );
    }

    return (
        <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 500 }}>
                {title}
            </Typography>
            <Box sx={{
                height: '200px',
                borderRadius: '12px',
                overflow: 'hidden',
                position: 'relative'
            }}>
                {position ? (
                    <GoogleMap
                        mapContainerStyle={{
                            width: '100%',
                            height: '100%'
                        }}
                        center={position}
                        zoom={15}
                        onLoad={handleMapLoad}
                        options={{
                            disableDefaultUI: false,
                            zoomControl: true,
                            streetViewControl: false,
                            mapTypeControl: false,
                            fullscreenControl: false,
                            styles: [
                                {
                                    featureType: 'poi',
                                    elementType: 'labels',
                                    stylers: [{ visibility: 'off' }]
                                },
                                {
                                    featureType: 'transit',
                                    elementType: 'labels',
                                    stylers: [{ visibility: 'off' }]
                                }
                            ]
                        }}
                    >
                        <Marker
                            position={position}
                            icon={{
                                path: window.google.maps.SymbolPath.CIRCLE,
                                scale: 12,
                                fillColor: title.includes('From') ? '#2196f3' : '#f44336',
                                fillOpacity: 1,
                                strokeColor: '#ffffff',
                                strokeWeight: 2
                            }}
                            label={{
                                text: title.includes('From') ? 'A' : 'B',
                                color: '#ffffff',
                                fontSize: '14px',
                                fontWeight: 'bold'
                            }}
                        />
                    </GoogleMap>
                ) : (
                    <Box sx={{
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: '#f5f5f5'
                    }}>
                        <CircularProgress size={24} />
                    </Box>
                )}
            </Box>
        </Box>
    );
});

const LocationMaps = ({
    shipment,
    isGoogleMapsLoaded = false,
    formatAddress = (address) => {
        if (!address) return 'N/A';
        return `${address.street}${address.street2 ? ', ' + address.street2 : ''}\n${address.city}, ${address.state} ${address.postalCode}\n${address.country}`;
    },
    getAddress = (shipment, type) => {
        return shipment?.[type] || shipment?.[type.toLowerCase()] || null;
    }
}) => {
    return (
        <Grid item xs={12} sx={{ mb: 3 }}>
            <Grid container spacing={3}>
                {/* Ship From Map */}
                <Grid item xs={12} md={6}>
                    <Paper>
                        <Box
                            sx={{
                                p: 2,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: '1px solid #e0e0e0'
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <LocationOnIcon sx={{ color: '#000' }} />
                                <Typography variant="h6" sx={{ fontWeight: 600, color: '#000' }}>
                                    Ship From Location
                                </Typography>
                            </Box>
                        </Box>
                        <Box sx={{ p: 2 }}>
                            <Typography variant="body1" sx={{ mb: 1 }}>
                                {getAddress(shipment, 'shipFrom')?.company || 'N/A'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line', mb: 2 }}>
                                {formatAddress(getAddress(shipment, 'shipFrom'))}
                            </Typography>
                            {isGoogleMapsLoaded && getAddress(shipment, 'shipFrom') && (
                                <SimpleMap
                                    address={getAddress(shipment, 'shipFrom')}
                                    title="Ship From Location"
                                />
                            )}
                        </Box>
                    </Paper>
                </Grid>

                {/* Ship To Map */}
                <Grid item xs={12} md={6}>
                    <Paper>
                        <Box
                            sx={{
                                p: 2,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: '1px solid #e0e0e0'
                            }}
                        >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <LocationOnIcon sx={{ color: '#000' }} />
                                <Typography variant="h6" sx={{ fontWeight: 600, color: '#000' }}>
                                    Ship To Location
                                </Typography>
                            </Box>
                        </Box>
                        <Box sx={{ p: 2 }}>
                            <Typography variant="body1" sx={{ mb: 1 }}>
                                {getAddress(shipment, 'shipTo')?.company || 'N/A'}
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line', mb: 2 }}>
                                {formatAddress(getAddress(shipment, 'shipTo'))}
                            </Typography>
                            {isGoogleMapsLoaded && getAddress(shipment, 'shipTo') && (
                                <SimpleMap
                                    address={getAddress(shipment, 'shipTo')}
                                    title="Ship To Location"
                                />
                            )}
                        </Box>
                    </Paper>
                </Grid>
            </Grid>
        </Grid>
    );
};

export default LocationMaps; 