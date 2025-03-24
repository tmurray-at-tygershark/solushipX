import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './App.css';

// Lazy load components
const CreateShipment = lazy(() => import('./components/CreateShipment'));

// Loading component
const Loading = () => (
    <div className="container mt-5">
        <div className="row">
            <div className="col-12 text-center">
                <div className="spinner-border text-primary" role="status">
                    <span className="visually-hidden">Loading...</span>
                </div>
            </div>
        </div>
    </div>
);

const Home = () => (
    <div className="container mt-5">
        <div className="row">
            <div className="col-12 text-center">
                <h1 className="display-4 mb-4">Welcome to SolushipX</h1>
                <p className="lead">Your trusted partner in shipping solutions</p>
                <div className="mt-4">
                    <a href="/create-shipment" className="btn btn-primary btn-lg me-3">
                        <i className="fas fa-box me-2"></i>Create Shipment
                    </a>
                    <a href="/tracking" className="btn btn-outline-primary btn-lg">
                        <i className="fas fa-truck me-2"></i>Track Shipment
                    </a>
                </div>
            </div>
        </div>
    </div>
);

const Shipments = () => (
    <div className="container mt-5">
        <h2>My Shipments</h2>
        <p>Your shipment history will appear here.</p>
    </div>
);

const Tracking = () => (
    <div className="container mt-5">
        <h2>Track Shipment</h2>
        <p>Enter your tracking number to track your shipment.</p>
    </div>
);

const App = () => {
    return (
        <Router>
            <div className="app-container">
                <Navigation />
                <main className="main-content">
                    <Suspense fallback={<Loading />}>
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/create-shipment" element={<CreateShipment />} />
                            <Route path="/shipments" element={<Shipments />} />
                            <Route path="/tracking" element={<Tracking />} />
                        </Routes>
                    </Suspense>
                </main>
            </div>
        </Router>
    );
};

export default App; 