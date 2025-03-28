import React, { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import Navigation from './components/Navigation';
import Logout from './components/Auth/Logout';
import { Box, CircularProgress } from '@mui/material';

const Customers = lazy(() => import('./components/Customers/Customers'));
const CustomerDetail = lazy(() => import('./components/Customers/CustomerDetail'));
const Reports = lazy(() => import('./components/Reports/Reports'));
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

// Loading component for Suspense
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

const App = () => {
    return (
        <div className="app">
            <Navigation />
            <main className="main-content">
                <Suspense fallback={<LoadingFallback />}>
                    <Routes>
                        <Route path="/logout" element={<Logout />} />
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
                        <Route path="/reports" element={
                            <ProtectedRoute>
                                <Reports />
                            </ProtectedRoute>
                        } />
                        <Route path="/carriers" element={
                            <ProtectedRoute>
                                <Carriers />
                            </ProtectedRoute>
                        } />

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
                    </Routes>
                </Suspense>
            </main>
        </div>
    );
};

export default App; 