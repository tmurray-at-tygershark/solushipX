import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './App.css';
import Dashboard from './components/Dashboard/Dashboard';
import CreateShipment from './components/CreateShipment';
import ShipmentDetail from './components/ShipmentDetail/ShipmentDetail';
import Shipments from './components/Shipments/Shipments';
import TrackingResults from './components/Tracking/TrackingResults';
import Footer from './components/Footer/Footer';
import NotificationBar from './components/NotificationBar/NotificationBar';
import { Box } from '@mui/material';

function App() {
    return (
        <Router>
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh'
            }}>
                <NotificationBar />
                <Navigation />
                <Box component="main" sx={{ flexGrow: 1 }}>
                    <Routes>
                        <Route path="/" element={<Dashboard />} />
                        <Route path="/shipments" element={<Shipments />} />
                        <Route path="/create-shipment" element={<CreateShipment />} />
                        <Route path="/shipment/:id" element={<ShipmentDetail />} />
                        <Route path="/tracking/:trackingNumber" element={<TrackingResults />} />
                    </Routes>
                </Box>
                <Footer />
            </Box>
        </Router>
    );
}

export default App; 