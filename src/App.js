import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './App.css';
import Shipments from './components/Shipments/Shipments';
import TrackingResults from './components/Tracking/TrackingResults';
import Customers from './components/Customers/Customers';
import CustomerDetail from './components/Customers/CustomerDetail';
import Homepage from './components/Homepage/Homepage';
import Login from './components/Auth/Login';
import Signup from './components/Auth/Signup';
import CreateShipment from './components/CreateShipment';
import Dashboard from './components/Dashboard/Dashboard';
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
                        {/* Public Routes */}
                        <Route path="/" element={<Homepage />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/signup" element={<Signup />} />

                        {/* Protected Routes */}
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/shipments" element={<Shipments />} />
                        <Route path="/create-shipment" element={<CreateShipment />} />
                        <Route path="/tracking/:trackingNumber" element={<TrackingResults />} />
                        <Route path="/customers" element={<Customers />} />
                        <Route path="/customers/:accountNumber" element={<CustomerDetail />} />

                        {/* Fallback Route */}
                        <Route path="*" element={<Dashboard />} />
                    </Routes>
                </Box>
            </Box>
        </Router>
    );
}

export default App; 