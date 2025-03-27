import React, { lazy } from 'react';
import { Route } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';

const Customers = lazy(() => import('./components/Customers/Customers'));
const CustomerDetail = lazy(() => import('./components/Customers/CustomerDetail'));
const Reports = lazy(() => import('./components/Reports/Reports'));

const App = () => {
    return (
        <div>
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
        </div>
    );
};

export default App; 