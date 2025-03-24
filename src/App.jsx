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
import { Box, CssBaseline } from '@mui/material';
import Customers from './components/Customers/Customers';
import CustomerDetail from './components/Customers/CustomerDetail';
import Pricing from './components/Pricing/Pricing';
import Homepage from './components/Homepage/Homepage';

function App() {
    return (
        <Router>
            <CssBaseline />
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh'
            }}>
                <NotificationBar />
                <Navigation />
                <Box
                    component="main"
                    sx={{
                        flexGrow: 1,
                        display: 'flex',
                        flexDirection: 'column'
                    }}
                >
                    <Routes>
                        <Route path="/" element={<Homepage />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/shipments" element={<Shipments />} />
                        <Route path="/create-shipment" element={<CreateShipment />} />
                        <Route path="/shipment/:id" element={<ShipmentDetail />} />
                        <Route path="/tracking/:trackingNumber" element={<TrackingResults />} />
                        <Route path="/customers" element={<Customers />} />
                        <Route path="/customers/:accountNumber" element={<CustomerDetail />} />
                        <Route path="/pricing" element={<Pricing />} />
                    </Routes>
                </Box>
                <Footer />
            </Box>
        </Router>
    );
}

export default App; 