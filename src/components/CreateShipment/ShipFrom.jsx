import React, { useState, useEffect } from 'react';
import { getStateOptions, getStateLabel } from '../../constants/address';

const ShipFrom = ({ data, onDataChange, onNext, onPrevious }) => {
    const [formData, setFormData] = useState({
        company: '',
        attentionName: '',
        street: '',
        street2: '',
        city: '',
        state: '',
        postalCode: '',
        country: 'US',
        contactName: '',
        contactPhone: '',
        contactEmail: '',
        contactFax: '',
        specialInstructions: ''
    });

    const [showSpecialInstructions, setShowSpecialInstructions] = useState(false);

    // Only handle initial data load and data prop changes
    useEffect(() => {
        if (data && Object.keys(data).length > 0) {
            setFormData(data);
        }
    }, [data]);

    const handleInputChange = (fieldOrEvent, directValue) => {
        let field, value;

        if (typeof fieldOrEvent === 'string') {
            // Handle direct calls with (field, value)
            field = fieldOrEvent;
            value = directValue;
        } else {
            // Handle event object
            field = fieldOrEvent.target.id;
            value = fieldOrEvent.target.value;
        }

        const newFormData = {
            ...formData,
            [field]: value
        };
        setFormData(newFormData);
        onDataChange(newFormData);
    };

    const handleCountryChange = (e) => {
        const newCountry = e.target.value;
        const newFormData = {
            ...formData,
            country: newCountry,
            state: '' // Reset state/province when country changes
        };
        setFormData(newFormData);
        onDataChange(newFormData);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        const form = e.target.closest('form');
        if (form.checkValidity()) {
            onNext();
        }
        form.classList.add('was-validated');
    };

    return (
        <div className="form-section">
            <h3 className="form-section-title">Shipper Information</h3>

            <div className="card">
                <div className="card-header">
                    <h4 className="card-title">Company Details</h4>
                </div>
                <div className="form-grid">
                    <div className="form-group">
                        <label className="form-label" htmlFor="company">Company Name</label>
                        <input
                            type="text"
                            id="company"
                            className="form-control"
                            value={formData.company}
                            onChange={handleInputChange}
                            placeholder="Enter company name"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="attentionName">Attention Name</label>
                        <input
                            type="text"
                            id="attentionName"
                            className="form-control"
                            value={formData.attentionName}
                            onChange={handleInputChange}
                            placeholder="Enter attention name"
                        />
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h4 className="card-title">Address</h4>
                </div>
                <div className="form-grid">
                    <div className="form-group">
                        <label className="form-label" htmlFor="street">Street Address</label>
                        <input
                            type="text"
                            id="street"
                            className="form-control"
                            value={formData.street}
                            onChange={handleInputChange}
                            placeholder="Enter street address"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="street2">Suite/Unit (Optional)</label>
                        <input
                            type="text"
                            id="street2"
                            className="form-control"
                            value={formData.street2}
                            onChange={handleInputChange}
                            placeholder="Enter suite or unit number"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="city">City</label>
                        <input
                            type="text"
                            id="city"
                            className="form-control"
                            value={formData.city}
                            onChange={handleInputChange}
                            placeholder="Enter city"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="state">{getStateLabel(formData.country)}</label>
                        <select
                            id="state"
                            className="form-control"
                            value={formData.state}
                            onChange={handleInputChange}
                            required
                        >
                            <option value="">Select {getStateLabel(formData.country)}</option>
                            {getStateOptions(formData.country).map(({ value, label }) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-row">
                        <div className="form-group col-md-6">
                            <label htmlFor="postalCode">Zip/Postal</label>
                            <input
                                type="text"
                                className="form-control"
                                id="postalCode"
                                name="postalCode"
                                value={formData.postalCode}
                                onChange={handleInputChange}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="country">Country</label>
                        <select
                            id="country"
                            className="form-control"
                            value={formData.country}
                            onChange={handleCountryChange}
                            required
                        >
                            <option value="US">United States</option>
                            <option value="CA">Canada</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h4 className="card-title">Contact Information</h4>
                </div>
                <div className="form-grid">
                    <div className="form-group">
                        <label className="form-label" htmlFor="contactName">Contact Name</label>
                        <input
                            type="text"
                            id="contactName"
                            className="form-control"
                            value={formData.contactName}
                            onChange={handleInputChange}
                            placeholder="Enter contact name"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="contactPhone">Phone</label>
                        <input
                            type="tel"
                            id="contactPhone"
                            className="form-control"
                            value={formData.contactPhone}
                            onChange={handleInputChange}
                            placeholder="Enter phone number"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="contactEmail">Email</label>
                        <input
                            type="email"
                            id="contactEmail"
                            className="form-control"
                            value={formData.contactEmail}
                            onChange={handleInputChange}
                            placeholder="Enter email address"
                            required
                        />
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h4 className="card-title">Additional Information</h4>
                </div>
                <div className="form-grid">
                    <div className="form-group">
                        <label className="form-label" htmlFor="specialInstructions">Special Instructions</label>
                        <textarea
                            id="specialInstructions"
                            className="form-control"
                            value={formData.specialInstructions}
                            onChange={handleInputChange}
                            placeholder="Enter any special instructions"
                            rows="3"
                        />
                    </div>
                </div>
            </div>

            <div className="navigation-buttons">
                <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={onPrevious}
                >
                    <i className="bi bi-arrow-left"></i> Previous
                </button>
                <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSubmit}
                >
                    Next <i className="bi bi-arrow-right"></i>
                </button>
            </div>
        </div>
    );
};

export default ShipFrom; 