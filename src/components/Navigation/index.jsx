import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navigation.css';

const Navigation = () => {
    const [isOpen, setIsOpen] = useState(false);
    const location = useLocation();

    const menuItems = [
        { path: '/', label: 'Home', icon: 'fas fa-home' },
        { path: '/create-shipment', label: 'Create Shipment', icon: 'fas fa-box' },
        { path: '/shipments', label: 'My Shipments', icon: 'fas fa-list' },
        { path: '/tracking', label: 'Track Shipment', icon: 'fas fa-truck' },
    ];

    return (
        <nav className="navbar navbar-expand-lg">
            <div className="container">
                <Link className="navbar-brand" to="/">
                    <i className="fas fa-shipping-fast me-2"></i>
                    SolushipX
                </Link>

                <button
                    className="navbar-toggler"
                    type="button"
                    onClick={() => setIsOpen(!isOpen)}
                    aria-label="Toggle navigation"
                >
                    <span className="navbar-toggler-icon"></span>
                </button>

                <div className={`navbar-collapse ${isOpen ? 'show' : ''}`}>
                    <ul className="navbar-nav ms-auto">
                        {menuItems.map((item) => (
                            <li className="nav-item" key={item.path}>
                                <Link
                                    className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
                                    to={item.path}
                                    onClick={() => setIsOpen(false)}
                                >
                                    <i className={item.icon}></i>
                                    <span className="ms-1">{item.label}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </nav>
    );
};

export default Navigation; 