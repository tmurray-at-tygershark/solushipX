import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Navigation from './components/Navigation';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@fortawesome/fontawesome-free/css/all.min.css';
import './App.css';
import Dashboard from './components/Dashboard/Dashboard';
import CreateShipment from './components/CreateShipment';
import ShipmentDetail from './components/ShipmentDetail/ShipmentDetail';

function App() {
    return (
        <Router>
            <div className="App">
                <Navigation />
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/create-shipment" element={<CreateShipment />} />
                    <Route path="/shipment/:id" element={<ShipmentDetail />} />
                </Routes>
            </div>
        </Router>
    );
}

export default App; 