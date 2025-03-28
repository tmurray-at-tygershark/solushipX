import React, { lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import Logout from './components/Auth/Logout';

const Customers = lazy(() => import('./components/Customers/Customers'));
const CustomerDetail = lazy(() => import('./components/Customers/CustomerDetail'));
const Reports = lazy(() => import('./components/Reports/Reports'));
const Carriers = lazy(() => import('./components/Carriers/Carriers'));

const AdminLayout = lazy(() => import('./components/Admin/AdminLayout'));
const AdminDashboard = lazy(() => import('./components/Admin/Dashboard'));
const CompanyList = lazy(() => import('./components/Admin/Companies/CompanyList'));
const UserList = lazy(() => import('./components/Admin/Users/UserList'));
const GlobalShipmentList = lazy(() => import('./components/Admin/Shipments/GlobalShipmentList'));
const AnalyticsDashboard = lazy(() => import('./components/Admin/Analytics/Dashboard'));
const BillingDashboard = lazy(() => import('./components/Admin/Billing/BillingDashboard'));
const InvoiceForm = lazy(() => import('./components/Admin/Billing/InvoiceForm'));
const RoleManagement = lazy(() => import('./components/Admin/Roles/RoleManagement'));
const SystemSettings = lazy(() => import('./components/Admin/Settings/SystemSettings'));
const CarrierKeys = lazy(() => import('./components/Admin/Carriers/CarrierKeys'));

const App = () => {
    return (
        <div>
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
                    <Route path="analytics" element={<AnalyticsDashboard />} />
                    <Route path="billing" element={<BillingDashboard />} />
                    <Route path="billing/invoice/new" element={<InvoiceForm />} />
                    <Route path="billing/invoice/:id" element={<InvoiceForm />} />
                    <Route path="roles" element={<RoleManagement />} />
                    <Route path="settings" element={<SystemSettings />} />
                    <Route path="carrier-keys" element={<CarrierKeys />} />
                </Route>
            </Routes>
        </div>
    );
};

export default App; 