import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Box, CssBaseline, CircularProgress } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';

// Styles
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './App.css';

// Core Components (always loaded)
import Navigation from './components/Navigation';
import Footer from './components/Footer/Footer';
import NotificationBar from './components/NotificationBar/NotificationBar';
import ErrorBoundary from './components/ErrorBoundary';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Lazy-loaded Pages
const Dashboard = lazy(() => import('./components/Dashboard/Dashboard'));
const CreateShipment = lazy(() => import('./components/CreateShipment'));
const ShipmentDetail = lazy(() => import('./components/ShipmentDetail/ShipmentDetail'));
const Shipments = lazy(() => import('./components/Shipments/Shipments'));
const Tracking = lazy(() => import('./components/Tracking/Tracking'));
const TrackingResults = lazy(() => import('./components/Tracking/TrackingResults'));
const Customers = lazy(() => import('./components/Customers/Customers'));
const Reports = lazy(() => import('./components/Reports/Reports'));
const Billing = lazy(() => import('./components/Billing/Billing'));
const Pricing = lazy(() => import('./components/Pricing/Pricing'));
const Homepage = lazy(() => import('./components/Homepage/Homepage'));
const Login = lazy(() => import('./components/Auth/Login'));
const Signup = lazy(() => import('./components/Auth/Signup'));

// Loading Component
const LoadingFallback = () => (
    <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '100vh' 
    }}>
        <CircularProgress />
    </Box>
);

// Protected Route Component
const ProtectedRoute = ({ children }) => {
    const { isAuthenticated, loading } = useAuth();

    if (loading) {
        return <LoadingFallback />;
    }

    return isAuthenticated ? children : <Navigate to="/login" />;
};

function AppRoutes() {
    return (
        <Suspense fallback={<LoadingFallback />}>
            <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Homepage />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
                <Route path="/pricing" element={<Pricing />} />

                {/* Protected Routes */}
                <Route path="/dashboard" element={
                    <ProtectedRoute>
                        <Dashboard />
                    </ProtectedRoute>
                } />
                <Route path="/shipments" element={
                    <ProtectedRoute>
                        <Shipments />
                    </ProtectedRoute>
                } />
                <Route path="/create-shipment" element={
                    <ProtectedRoute>
                        <CreateShipment />
                    </ProtectedRoute>
                } />
                <Route path="/tracking" element={
                    <ProtectedRoute>
                        <Tracking />
                    </ProtectedRoute>
                } />
                <Route path="/tracking/:trackingNumber" element={
                    <ProtectedRoute>
                        <TrackingResults />
                    </ProtectedRoute>
                } />
                <Route path="/customers" element={
                    <ProtectedRoute>
                        <Customers />
                    </ProtectedRoute>
                } />
                <Route path="/reports" element={
                    <ProtectedRoute>
                        <Reports />
                    </ProtectedRoute>
                } />
                <Route path="/billing" element={
                    <ProtectedRoute>
                        <Billing />
                    </ProtectedRoute>
                } />
                <Route path="/shipment/:id" element={
                    <ProtectedRoute>
                        <ShipmentDetail />
                    </ProtectedRoute>
                } />

                {/* Fallback Route */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Suspense>
    );
}

function App() {
    return (
        <ErrorBoundary>
            <AuthProvider>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
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
                                <AppRoutes />
                            </Box>
                            <Footer />
                        </Box>
                    </Router>
                </LocalizationProvider>
            </AuthProvider>
        </ErrorBoundary>
    );
}

export default App; 