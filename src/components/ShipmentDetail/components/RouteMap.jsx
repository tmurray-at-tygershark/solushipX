import React from 'react';
import {
    Grid,
    Paper,
    Typography,
    Box,
    Button,
    CircularProgress
} from '@mui/material';
import LocationIcon from '@mui/icons-material/LocationOn';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import ErrorIcon from '@mui/icons-material/Error';
import { GoogleMap, DirectionsRenderer, Marker } from '@react-google-maps/api';

const mapOptions = {
    disableDefaultUI: true,
    zoomControl: true,
    streetViewControl: false,
    mapTypeControl: false,
    fullscreenControl: true,
    styles: [
        {
            featureType: 'water',
            elementType: 'geometry',
            stylers: [{ color: '#e9e9e9' }, { lightness: 17 }]
        },
        {
            featureType: 'landscape',
            elementType: 'geometry',
            stylers: [{ color: '#f5f5f5' }, { lightness: 20 }]
        }
    ]
};

const RouteMap = ({
    isGoogleMapsLoaded,
    directions,
    mapCenter,
    handleMapLoad,
    mapOptions,
    convertDistance,
    useMetric,
    setUseMetric,
    mapError
}) => {
    // Debug logging
    console.log('RouteMap render:', {
        isGoogleMapsLoaded,
        hasDirections: !!directions,
        directionsRoutes: directions?.routes?.length,
        mapError
    });

    const renderMapContent = () => {
        if (mapError) {
            return (
                <Box sx={{
                    height: '600px',
                    borderRadius: '12px',
                    bgcolor: '#f5f5f5',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2
                }}>
                    <ErrorIcon color="error" sx={{ fontSize: 48 }} />
                    <Typography color="error" variant="h6">Route Map Error</Typography>
                    <Typography color="text.secondary" align="center" sx={{ maxWidth: 400 }}>
                        {mapError}
                    </Typography>
                </Box>
            );
        }

        if (!isGoogleMapsLoaded) {
            return (
                <Box sx={{
                    height: '600px',
                    borderRadius: '12px',
                    bgcolor: '#f5f5f5',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2
                }}>
                    <CircularProgress />
                    <Typography color="text.secondary">Loading Google Maps...</Typography>
                </Box>
            );
        }

        return (
            <Box sx={{
                height: '600px',
                borderRadius: '12px',
                overflow: 'hidden',
                position: 'relative'
            }}>
                <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={directions?.routes?.[0]?.bounds?.getCenter() || mapCenter}
                    zoom={6}
                    onLoad={handleMapLoad}
                    options={mapOptions}
                >
                    {/* Render DirectionsRenderer if we have valid directions */}
                    {directions && directions.routes && directions.routes.length > 0 && (
                        <DirectionsRenderer
                            directions={directions}
                            options={{
                                suppressMarkers: true,
                                preserveViewport: false,
                                polylineOptions: {
                                    strokeColor: '#4CAF50',
                                    strokeWeight: 6,
                                    strokeOpacity: 0.8,
                                    geodesic: true,
                                    clickable: false
                                }
                            }}
                        />
                    )}

                    {/* Origin Marker (A) */}
                    {directions?.routes?.[0]?.legs?.[0]?.start_location && (
                        <Marker
                            position={directions.routes[0].legs[0].start_location}
                            icon={{
                                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                                    <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="#4CAF50" stroke="#ffffff" stroke-width="2"/>
                                        <text x="12" y="16" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="bold">A</text>
                                    </svg>
                                `),
                                scaledSize: new window.google.maps.Size(24, 36),
                                anchor: new window.google.maps.Point(12, 36)
                            }}
                        />
                    )}

                    {/* Destination Marker (B) */}
                    {directions?.routes?.[0]?.legs?.[0]?.end_location && (
                        <Marker
                            position={directions.routes[0].legs[0].end_location}
                            icon={{
                                url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                                    <svg width="24" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 24 12 24s12-15 12-24c0-6.627-5.373-12-12-12z" fill="#f44336" stroke="#ffffff" stroke-width="2"/>
                                        <text x="12" y="16" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="bold">B</text>
                                    </svg>
                                `),
                                scaledSize: new window.google.maps.Size(24, 36),
                                anchor: new window.google.maps.Point(12, 36)
                            }}
                        />
                    )}
                </GoogleMap>

                {/* Route Summary Overlay */}
                {directions?.routes?.[0]?.legs?.[0]?.distance && (
                    <Box sx={{
                        position: 'absolute',
                        top: 16,
                        left: 16,
                        background: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(10px)',
                        borderRadius: '16px',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                        p: 2,
                        zIndex: 1,
                        minWidth: '220px'
                    }}>
                        <Box sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            p: 1.5,
                            borderRadius: '12px',
                            background: 'rgba(76, 175, 80, 0.08)'
                        }}>
                            <LocationIcon sx={{
                                color: '#4CAF50',
                                fontSize: 28,
                                opacity: 0.9
                            }} />
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="subtitle2" sx={{
                                    color: 'text.secondary',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.5px'
                                }}>
                                    Total Distance
                                </Typography>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <Typography variant="h6" sx={{
                                        color: '#4CAF50',
                                        fontWeight: 700,
                                        fontSize: '1.25rem',
                                        lineHeight: 1.2
                                    }}>
                                        {convertDistance(directions.routes[0].legs[0].distance.value)}
                                    </Typography>
                                    <Button
                                        onClick={() => setUseMetric(!useMetric)}
                                        size="small"
                                        sx={{
                                            minWidth: 'auto',
                                            p: 0.5,
                                            borderRadius: '8px',
                                            background: 'rgba(76, 175, 80, 0.08)',
                                            color: '#4CAF50',
                                            '&:hover': {
                                                background: 'rgba(76, 175, 80, 0.12)'
                                            }
                                        }}
                                    >
                                        <SwapHorizIcon sx={{ fontSize: 18 }} />
                                    </Button>
                                </Box>
                                {directions.routes[0].legs[0].duration && (
                                    <Typography variant="caption" sx={{
                                        color: 'text.secondary',
                                        fontSize: '0.75rem'
                                    }}>
                                        Est. {directions.routes[0].legs[0].duration.text}
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    </Box>
                )}

                {/* No Route Message */}
                {isGoogleMapsLoaded && !directions && !mapError && (
                    <Box sx={{
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        background: 'rgba(255, 255, 255, 0.95)',
                        borderRadius: '12px',
                        p: 3,
                        textAlign: 'center',
                        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
                    }}>
                        <LocationIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                        <Typography variant="h6" color="text.secondary">
                            Calculating Route...
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            Please wait while we calculate the optimal route
                        </Typography>
                    </Box>
                )}
            </Box>
        );
    };

    return (
        <Grid item xs={12} md={6}>
            <Paper sx={{ height: '100%' }} elevation={1}>
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
                    <Typography variant="h6" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <LocationIcon />
                        Route Map
                    </Typography>
                </Box>
                <Box sx={{ p: 3 }}>
                    {renderMapContent()}
                </Box>
            </Paper>
        </Grid>
    );
};

export default RouteMap; 