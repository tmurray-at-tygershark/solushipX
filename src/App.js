import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline, Box, CircularProgress } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { SnackbarProvider } from 'notistack';
import { AuthProvider } from './contexts/AuthContext';
import { CompanyProvider } from './contexts/CompanyContext';
import Navigation from './components/Navigation/Header';
import Footer from './components/Footer/Footer';
import NotificationBar from './components/NotificationBar/NotificationBar';
import ErrorBoundary from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AdminRoute } from './components/AdminRoute';
import UserDetail from './components/Admin/Users/UserDetail.jsx';

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
const AddCustomer = lazy(() => import('./components/Customers/AddCustomer'));
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
const EDIMapping = lazy(() => import('./components/Admin/Billing/EDIMapping'));
const AddCarrierMapping = lazy(() => import('./components/Admin/Billing/AddCarrierMapping'));
const CompanyForm = lazy(() => import('./components/Admin/Companies/CompanyForm'));
const CompanyDetail = lazy(() => import('./components/Admin/Companies/CompanyDetail'));
const UserForm = lazy(() => import('./components/Admin/Users/UserForm'));
const UserCompanies = lazy(() => import('./components/Admin/Users/UserCompanies'));
const ResetPassword = lazy(() => import('./components/Admin/Users/ResetPassword'));

// Organization Components (New)
const OrganizationList = lazy(() => import('./components/Admin/Organizations/OrganizationList'));
const OrganizationForm = lazy(() => import('./components/Admin/Organizations/OrganizationForm'));
const OrganizationDetail = lazy(() => import('./components/Admin/Organizations/OrganizationDetail'));

// New Admin Carriers component
const AdminCarriers = lazy(() => import('./components/Admin/Carriers/AdminCarriers'));

// Markups Page (New)
const MarkupsPage = lazy(() => import('./components/Admin/Markups/MarkupsPage'));

// New Generate Invoices Page
const GenerateInvoicesPage = lazy(() => import('./components/Admin/Billing/GenerateInvoicesPage'));

// New Edit Carrier Mapping component
const EditCarrierMapping = lazy(() => import('./components/Admin/Billing/EditCarrierMapping'));

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
                        <CreateShipment />
                    </ProtectedRoute>
                } />
                <Route path="/create-shipment/:step" element={
                    <ProtectedRoute>
                        <CreateShipment />
                    </ProtectedRoute>
                } />
                <Route path="/create-shipment/:step/:draftId" element={
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
                <Route path="/customers/new" element={
                    <ProtectedRoute>
                        <AddCustomer />
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
                    <Route path="companies/new" element={<CompanyForm />} />
                    <Route path="companies/:id" element={<CompanyDetail />} />
                    <Route path="companies/:id/edit" element={<CompanyForm />} />
                    <Route path="organizations" element={<OrganizationList />} />
                    <Route path="organizations/new" element={<OrganizationForm />} />
                    <Route path="organizations/:id" element={<OrganizationDetail />} />
                    <Route path="organizations/:id/edit" element={<OrganizationForm />} />
                    <Route path="users" element={<UserList />} />
                    <Route path="users/new" element={<UserForm />} />
                    <Route path="users/:id" element={<UserDetail />} />
                    <Route path="users/:id/edit" element={<UserForm />} />
                    <Route path="users/:id/companies" element={<UserCompanies />} />
                    <Route path="users/:id/reset-password" element={<ResetPassword />} />
                    <Route path="shipments" element={<GlobalShipmentList />} />
                    <Route path="shipment/:id" element={<ShipmentDetail />} />
                    <Route path="billing" element={<BillingDashboard initialTab="invoices" />} />
                    <Route path="billing/overview" element={<BillingDashboard initialTab="overview" />} />
                    <Route path="billing/invoice/new" element={<InvoiceForm />} />
                    <Route path="billing/invoice/:id" element={<InvoiceForm />} />
                    <Route path="billing/edi" element={<BillingDashboard initialTab="edi" />} />
                    <Route path="billing/edi/:uploadId" element={<BillingDashboard initialTab="edi" />} />
                    <Route path="billing/generate-old" element={<BillingDashboard initialTab="generate" />} />
                    <Route path="billing/generate" element={<GenerateInvoicesPage />} />
                    <Route path="billing/business" element={<BillingDashboard initialTab="business" />} />
                    <Route path="billing/payments" element={<BillingDashboard initialTab="payments" />} />
                    <Route path="billing/payment-terms" element={<BillingDashboard initialTab="payment-terms" />} />
                    <Route path="roles" element={<RoleManagement />} />
                    <Route path="settings" element={<SystemSettings />} />
                    <Route path="carrier-keys" element={<CarrierKeys />} />
                    <Route path="edi-mapping" element={<EDIMapping />} />
                    <Route path="billing/edi-mapping" element={<EDIMapping />} />
                    <Route path="billing/edi-mapping/new/*" element={<AddCarrierMapping />} />
                    <Route path="billing/edi-mapping/edit/:carrierId/:stepName" element={<EditCarrierMapping />} />
                    <Route path="billing/edi-mapping/edit/:carrierId" element={<Navigate to="details" replace />} />
                    <Route path="billing/edi-mapping/new" element={<Navigate to="details" replace />} />
                    <Route path="carriers" element={<AdminCarriers />} />
                    <Route path="markups" element={<MarkupsPage />} />
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
                <CompanyProvider>
                    <LocalizationProvider dateAdapter={AdapterDayjs}>
                        <SnackbarProvider maxSnack={3} autoHideDuration={4000}>
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
                        </SnackbarProvider>
                    </LocalizationProvider>
                </CompanyProvider>
            </AuthProvider>
        </ErrorBoundary>
    );
}

export default App; 