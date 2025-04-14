import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline, Box, CircularProgress } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { AuthProvider } from './contexts/AuthContext';
import Navigation from './components/Navigation/Header';
import Footer from './components/Footer/Footer';
import NotificationBar from './components/NotificationBar/NotificationBar';
import ErrorBoundary from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';

// Lazy-loaded Pages
const Dashboard = lazy(() => import('./components/Dashboard/Dashboard'));
const CreateShipment = lazy(() => import('./components/CreateShipment'));
const ShipmentDetail = lazy(() => import('./components/ShipmentDetail/ShipmentDetail'));
const Shipments = lazy(() => import('./components/Shipments/Shipments'));
const Tracking = lazy(() => import('./components/Tracking/Tracking'));
const TrackingResults = lazy(() => import('./components/Tracking/TrackingResults'));
const Customers = lazy(() => import('./components/Customers/Customers'));
const CustomerDetail = lazy(() => import('./components/Customers/CustomerDetail'));
const Reports = lazy(() => import('./components/Reports/Reports'));
const Billing = lazy(() => import('./components/Billing/Billing'));
const Pricing = lazy(() => import('./components/Pricing/Pricing'));
const Homepage = lazy(() => import('./components/Homepage/Homepage'));
const Login = lazy(() => import('./components/Auth/Login'));
const Signup = lazy(() => import('./components/Auth/Signup'));
const EditCustomer = lazy(() => import('./components/Customers/EditCustomer'));
const Profile = lazy(() => import('./components/Profile/Profile'));
const Carriers = lazy(() => import('./components/Carriers/Carriers'));
const AdminLayout = lazy(() => import('./components/Admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./components/Admin/Dashboard'));
const CompanyList = lazy(() => import('./components/Admin/Companies/CompanyList'));
const UserList = lazy(() => import('./components/Admin/Users/UserList'));
const GlobalShipmentList = lazy(() => import('./components/Admin/Shipments/GlobalShipmentList'));
const BillingDashboard = lazy(() => import('./components/Admin/Billing/BillingDashboard'));
const InvoiceForm = lazy(() => import('./components/Admin/Billing/InvoiceForm'));
const RoleManagement = lazy(() => import('./components/Admin/Roles/RoleManagement'));
const SystemSettings = lazy(() => import('./components/Admin/Settings/SystemSettings'));
const CarrierKeys = lazy(() => import('./components/Admin/Carriers/CarrierKeys'));

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
                        <Navigate to="/create-shipment/shipment-info" replace />
                    </ProtectedRoute>
                } />
                <Route path="/create-shipment/:step" element={
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
                <Route path="/customers/:id" element={
                    <ProtectedRoute>
                        <CustomerDetail />
                    </ProtectedRoute>
                } />
                <Route path="/customers/:id/edit" element={
                    <ProtectedRoute>
                        <EditCustomer />
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
                <Route path="/profile" element={
                    <ProtectedRoute>
                        <Profile />
                    </ProtectedRoute>
                } />
                <Route path="/shipment/:id" element={
                    <ProtectedRoute>
                        <ShipmentDetail />
                    </ProtectedRoute>
                } />
                <Route path="/carriers" element={
                    <ProtectedRoute>
                        <Carriers />
                    </ProtectedRoute>
                } />

                {/* Admin Routes */}
                <Route path="/admin/*" element={
                    <AdminRoute>
                        <AdminLayout />
                    </AdminRoute>
                }>
                    <Route index element={<AdminDashboard />} />
                    <Route path="companies" element={<CompanyList />} />
                    <Route path="users" element={<UserList />} />
                    <Route path="shipments" element={<GlobalShipmentList />} />
                    <Route path="billing" element={<BillingDashboard />} />
                    <Route path="billing/invoice/new" element={<InvoiceForm />} />
                    <Route path="billing/invoice/:id" element={<InvoiceForm />} />
                    <Route path="roles" element={<RoleManagement />} />
                    <Route path="settings" element={<SystemSettings />} />
                    <Route path="carrier-keys" element={<CarrierKeys />} />
                </Route>

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