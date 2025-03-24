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
import Login from './components/Auth/Login';
import Signup from './components/Auth/Signup';
import Tracking from './components/Tracking/Tracking';
import Reports from './components/Reports/Reports';
import Billing from './components/Billing/Billing';
import AssessmentIcon from '@mui/icons-material/Assessment';

function App() {
    return (
        <Router>
            <CssBaseline />
            <Box sx={{
                display: 'flex',
                flexDirection: 'column',
                minHeight: '100vh',
                width: '100%'
            }}>
                <NotificationBar />
                <Navigation />
                <Box
                    component="main"
                    className="main-content"
                    sx={{
                        flexGrow: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        width: '100%'
                    }}
                >
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/" element={<Homepage />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/signup" element={<Signup />} />
                        <Route path="/pricing" element={<Pricing />} />

                        {/* Protected Routes */}
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/shipments" element={<Shipments />} />
                        <Route path="/create-shipment" element={<CreateShipment />} />
                        <Route path="/tracking" element={<Tracking />} />
                        <Route path="/tracking/:trackingNumber" element={<TrackingResults />} />
                        <Route path="/customers" element={<Customers />} />
                        <Route path="/reports" element={<Reports />} />
                        <Route path="/billing" element={<Billing />} />
                        <Route path="/shipment/:id" element={<ShipmentDetail />} />

                        {/* Fallback Route */}
                        <Route path="*" element={<Homepage />} />
                    </Routes>
                </Box>
                <Footer />
            </Box>
        </Router>
    );
}

export default App; 