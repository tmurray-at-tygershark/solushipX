import React from 'react';
import {
    Grid,
    Paper,
    Typography,
    Box,
    Button
} from '@mui/material';
import LocationIcon from '@mui/icons-material/LocationOn';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
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
    setUseMetric
}) => {
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
                    {isGoogleMapsLoaded ? (
                        <Box>
                            <Box sx={{
                                height: '600px',
                                borderRadius: '12px',
                                overflow: 'hidden',
                                position: 'relative'
                            }}>
                                <GoogleMap
                                    mapContainerStyle={{ width: '100%', height: '100%' }}
                                    center={directions?.request?.origin || mapCenter}
                                    zoom={8}
                                    onLoad={handleMapLoad}
                                    options={mapOptions}
                                >
                                    {directions && directions.routes && directions.routes.length > 0 && directions.routes[0].overview_polyline && directions.routes[0].legs && directions.routes[0].legs.length > 0 && (
                                        <DirectionsRenderer
                                            directions={directions}
                                            options={{
                                                suppressMarkers: true,
                                                preserveViewport: true,
                                                polylineOptions: {
                                                    strokeWeight: 10,
                                                    strokeOpacity: 1.0,
                                                    geodesic: true,
                                                    clickable: false
                                                },
                                                routeIndex: 0,
                                                draggable: false
                                            }}
                                        />
                                    )}
                                    {directions?.request?.origin && (
                                        <Marker
                                            position={directions.request.origin}
                                            icon={{
                                                path: window.google.maps.SymbolPath.CIRCLE,
                                                scale: 12,
                                                fillColor: '#2196f3',
                                                fillOpacity: 1,
                                                strokeColor: '#ffffff',
                                                strokeWeight: 2
                                            }}
                                            label={{
                                                text: 'A',
                                                color: '#ffffff',
                                                fontSize: '14px',
                                                fontWeight: 'bold'
                                            }}
                                        />
                                    )}
                                    {directions?.request?.destination && (
                                        <Marker
                                            position={directions.request.destination}
                                            icon={{
                                                path: window.google.maps.SymbolPath.CIRCLE,
                                                scale: 12,
                                                fillColor: '#f44336',
                                                fillOpacity: 1,
                                                strokeColor: '#ffffff',
                                                strokeWeight: 2
                                            }}
                                            label={{
                                                text: 'B',
                                                color: '#ffffff',
                                                fontSize: '14px',
                                                fontWeight: 'bold'
                                            }}
                                        />
                                    )}
                                </GoogleMap>
                                {/* Route Summary Overlay */}
                                <Box sx={{
                                    position: 'absolute',
                                    top: 16,
                                    left: 16,
                                    background: 'rgba(255, 255, 255, 0.95)',
                                    backdropFilter: 'blur(10px)',
                                    borderRadius: '16px',
                                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
                                    p: 2,
                                    zIndex: 1,
                                    minWidth: '200px'
                                }}>
                                    <Box sx={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 2,
                                        p: 1.5,
                                        borderRadius: '12px',
                                        background: 'rgba(25, 118, 210, 0.04)'
                                    }}>
                                        <LocationIcon sx={{
                                            color: 'primary.main',
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
                                                    color: 'primary.main',
                                                    fontWeight: 700,
                                                    fontSize: '1.25rem',
                                                    lineHeight: 1.2
                                                }}>
                                                    {directions?.routes[0]?.legs[0]?.distance?.value &&
                                                        convertDistance(directions.routes[0].legs[0].distance.value)}
                                                </Typography>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Typography component="span" sx={{
                                                        fontSize: '0.875rem',
                                                        fontWeight: 500,
                                                        color: 'text.secondary'
                                                    }}>
                                                        {useMetric ? 'km' : 'mi'}
                                                    </Typography>
                                                    <Button
                                                        onClick={() => setUseMetric(!useMetric)}
                                                        sx={{
                                                            minWidth: 'auto',
                                                            p: 1,
                                                            borderRadius: '8px',
                                                            background: 'rgba(25, 118, 210, 0.08)',
                                                            color: 'primary.main',
                                                            '&:hover': {
                                                                background: 'rgba(25, 118, 210, 0.12)'
                                                            }
                                                        }}
                                                    >
                                                        <SwapHorizIcon sx={{ fontSize: 20 }} />
                                                    </Button>
                                                </Box>
                                            </Box>
                                        </Box>
                                    </Box>
                                </Box>
                            </Box>
                        </Box>
                    ) : (
                        <Box sx={{
                            height: '600px',
                            borderRadius: '12px',
                            bgcolor: '#f5f5f5',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}>
                            <Typography color="text.secondary">Loading map...</Typography>
                        </Box>
                    )}
                </Box>
            </Paper>
        </Grid>
    );
};

export default RouteMap; 