import React, { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';

const MapContainer = styled(Box)(({ theme }) => ({
    width: '100%',
    height: '300px',
    borderRadius: theme.shape.borderRadius,
    overflow: 'hidden',
    marginBottom: theme.spacing(2),
}));

const MapWidget = ({ origin, destination }) => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef([]);

    useEffect(() => {
        // Initialize map
        if (!mapRef.current || !window.google) return;

        const mapOptions = {
            zoom: 2,
            center: { lat: 0, lng: 0 },
            mapTypeControl: false,
            streetViewControl: false,
        };

        mapInstanceRef.current = new window.google.maps.Map(mapRef.current, mapOptions);
    }, []);

    useEffect(() => {
        if (!mapInstanceRef.current) return;

        // Clear existing markers
        markersRef.current.forEach(marker => marker.setMap(null));
        markersRef.current = [];

        const bounds = new window.google.maps.LatLngBounds();

        // Add origin marker if available
        if (origin?.geometry?.location) {
            const originMarker = new window.google.maps.Marker({
                position: origin.geometry.location,
                map: mapInstanceRef.current,
                title: 'Origin',
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: '#4CAF50',
                    fillOpacity: 1,
                    strokeColor: '#FFFFFF',
                    strokeWeight: 2,
                },
            });
            markersRef.current.push(originMarker);
            bounds.extend(origin.geometry.location);
        }

        // Add destination marker if available
        if (destination?.geometry?.location) {
            const destMarker = new window.google.maps.Marker({
                position: destination.geometry.location,
                map: mapInstanceRef.current,
                title: 'Destination',
                icon: {
                    path: window.google.maps.SymbolPath.CIRCLE,
                    scale: 8,
                    fillColor: '#F44336',
                    fillOpacity: 1,
                    strokeColor: '#FFFFFF',
                    strokeWeight: 2,
                },
            });
            markersRef.current.push(destMarker);
            bounds.extend(destination.geometry.location);
        }

        // Fit map to show all markers
        if (markersRef.current.length > 0) {
            mapInstanceRef.current.fitBounds(bounds);
        }
    }, [origin, destination]);

    return <MapContainer ref={mapRef} />;
};

export default MapWidget; 