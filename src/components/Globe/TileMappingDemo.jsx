import React, { useState } from 'react';
import { Box, Typography, Paper, Button, Select, MenuItem, FormControl, InputLabel, Alert } from '@mui/material';
import ShipmentGlobe from './Globe';

const TileMappingDemo = () => {
    const [demoShipments] = useState([
        {
            id: 'demo-1',
            shipmentID: 'DEMO-001',
            trackingNumber: 'DEMO-001',
            status: 'in_transit',
            origin: {
                city: 'New York',
                state: 'NY',
                country: 'United States',
                lat: 40.7128,
                lng: -74.0060
            },
            destination: {
                city: 'London',
                state: 'England',
                country: 'United Kingdom',
                lat: 51.5074,
                lng: -0.1278
            },
            carrier: 'Demo Carrier'
        },
        {
            id: 'demo-2',
            shipmentID: 'DEMO-002',
            trackingNumber: 'DEMO-002',
            status: 'delivered',
            origin: {
                city: 'Los Angeles',
                state: 'CA',
                country: 'United States',
                lat: 34.0522,
                lng: -118.2437
            },
            destination: {
                city: 'Tokyo',
                state: 'Tokyo',
                country: 'Japan',
                lat: 35.6762,
                lng: 139.6503
            },
            carrier: 'Demo Carrier'
        }
    ]);

    return (
        <Box sx={{ p: 3, maxWidth: '1200px', margin: '0 auto' }}>
            <Typography variant="h4" component="h1" sx={{ mb: 3, fontWeight: 600 }}>
                Tile Mapping Demo
            </Typography>

            <Alert severity="info" sx={{ mb: 3 }}>
                <Typography variant="body2">
                    This demo shows the tile mapping system integrated with the Globe component.
                    Use the controls in the top-right corner of the globe to switch between static and tiled rendering modes.
                </Typography>
            </Alert>

            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>Features:</Typography>
                <Box component="ul" sx={{ pl: 2 }}>
                    <li><strong>Dynamic Zoom Levels:</strong> Tiles automatically load based on camera distance</li>
                    <li><strong>Multiple Providers:</strong> Switch between OpenStreetMap, CartoDB, and Stamen tiles</li>
                    <li><strong>Performance Optimized:</strong> Tile caching, LOD system, and memory management</li>
                    <li><strong>Seamless Integration:</strong> Works with existing shipment visualization</li>
                    <li><strong>Fallback Support:</strong> Gracefully falls back to static texture if tiles fail</li>
                </Box>
            </Paper>

            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>How to Use:</Typography>
                <Box component="ol" sx={{ pl: 2 }}>
                    <li>Click the "Static/Tiled" button in the top-right to toggle tile mapping</li>
                    <li>When tiled mode is active, use the dropdown to change tile providers</li>
                    <li>Zoom in/out to see different levels of detail automatically load</li>
                    <li>Navigate to different regions to see tiles load dynamically</li>
                </Box>
            </Paper>

            <Box sx={{
                height: 600,
                border: '1px solid #e0e0e0',
                borderRadius: 2,
                overflow: 'hidden',
                position: 'relative'
            }}>
                <ShipmentGlobe
                    width="100%"
                    height={600}
                    shipments={demoShipments}
                    showOverlays={true}
                    statusCounts={{
                        pending: 0,
                        transit: 1,
                        delivered: 1,
                        delayed: 0
                    }}
                />
            </Box>

            <Paper sx={{ p: 2, mt: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>Technical Details:</Typography>
                <Box component="ul" sx={{ pl: 2 }}>
                    <li><strong>Tile Coordinate System:</strong> Uses standard Web Mercator projection (EPSG:3857)</li>
                    <li><strong>LOD Levels:</strong> 4 levels based on camera distance (zoom 2-8)</li>
                    <li><strong>Caching:</strong> LRU cache with 100 tile limit</li>
                    <li><strong>Concurrency:</strong> Maximum 6 concurrent tile loads</li>
                    <li><strong>Memory Management:</strong> Automatic cleanup and resource tracking</li>
                </Box>
            </Paper>
        </Box>
    );
};

export default TileMappingDemo; 