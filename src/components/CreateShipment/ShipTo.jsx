import React, { useState, useEffect } from 'react';

const ShipTo = ({ data, onDataChange, onNext, onPrevious }) => {
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

    const handleInputChange = (e) => {
        const { id, value } = e.target;
        const newFormData = {
            ...formData,
            [id]: value
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
        <div className="form-section active" data-step="3">
            <form className="needs-validation" noValidate>
                <div className="section-header">
                    <h3>Ship To</h3>
                </div>

                <div className="section-content">
                    <div className="subsection">
                        <h4 className="subsection-title">Contact Info</h4>
                        <div className="row g-3">
                            <div className="col-md-6">
                                <div className="form-group">
                                    <label htmlFor="company">Company Name</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="company"
                                        value={formData.company}
                                        onChange={handleInputChange}
                                        required
                                    />
                                    <div className="invalid-feedback">Please enter a company name.</div>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <div className="form-group">
                                    <label htmlFor="contactName">Contact Name</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="contactName"
                                        value={formData.contactName}
                                        onChange={handleInputChange}
                                        required
                                    />
                                    <div className="invalid-feedback">Please enter a contact name.</div>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <div className="form-group">
                                    <label htmlFor="contactPhone">Phone</label>
                                    <input
                                        type="tel"
                                        className="form-control"
                                        id="contactPhone"
                                        value={formData.contactPhone}
                                        onChange={handleInputChange}
                                        required
                                    />
                                    <div className="invalid-feedback">Please enter a phone number.</div>
                                </div>
                            </div>
                            <div className="col-md-6">
                                <div className="form-group">
                                    <label htmlFor="contactEmail">Email</label>
                                    <input
                                        type="email"
                                        className="form-control"
                                        id="contactEmail"
                                        value={formData.contactEmail}
                                        onChange={handleInputChange}
                                        required
                                    />
                                    <div className="invalid-feedback">Please enter a valid email address.</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="subsection">
                        <h4 className="subsection-title">Address</h4>
                        <div className="row g-3">
                            <div className="col-12">
                                <div className="form-group">
                                    <label htmlFor="street">Street Address</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="street"
                                        value={formData.street}
                                        onChange={handleInputChange}
                                        required
                                    />
                                    <div className="invalid-feedback">Please enter a street address.</div>
                                </div>
                            </div>
                            <div className="col-12">
                                <div className="form-group">
                                    <label htmlFor="street2">Address Line 2</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="street2"
                                        value={formData.street2}
                                        onChange={handleInputChange}
                                    />
                                </div>
                            </div>
                            <div className="col-md-6">
                                <div className="form-group">
                                    <label htmlFor="city">City</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="city"
                                        value={formData.city}
                                        onChange={handleInputChange}
                                        required
                                    />
                                    <div className="invalid-feedback">Please enter a city.</div>
                                </div>
                            </div>
                            <div className="col-md-4">
                                <div className="form-group">
                                    <label htmlFor="state">State/Province</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="state"
                                        value={formData.state}
                                        onChange={handleInputChange}
                                        required
                                    />
                                    <div className="invalid-feedback">Please enter a state.</div>
                                </div>
                            </div>
                            <div className="col-md-2">
                                <div className="form-group">
                                    <label htmlFor="postalCode">Postal Code</label>
                                    <input
                                        type="text"
                                        className="form-control"
                                        id="postalCode"
                                        value={formData.postalCode}
                                        onChange={handleInputChange}
                                        required
                                    />
                                    <div className="invalid-feedback">Please enter a postal code.</div>
                                </div>
                            </div>
                            <div className="col-md-4">
                                <div className="form-group">
                                    <label htmlFor="country">Country</label>
                                    <select
                                        className="form-select"
                                        id="country"
                                        value={formData.country}
                                        onChange={handleInputChange}
                                        required
                                    >
                                        <option value="US">United States</option>
                                        <option value="CA">Canada</option>
                                    </select>
                                    <div className="invalid-feedback">Please select a country.</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="subsection">
                        <button
                            type="button"
                            className="btn btn-link p-0 text-decoration-none d-flex align-items-center"
                            onClick={() => setShowSpecialInstructions(!showSpecialInstructions)}
                        >
                            <i className={`bi bi-chevron-${showSpecialInstructions ? 'down' : 'right'} me-2`}></i>
                            <h4 className="subsection-title mb-0">Special Instructions</h4>
                        </button>
                        {showSpecialInstructions && (
                            <div className="mt-3">
                                <textarea
                                    className="form-control"
                                    id="specialInstructions"
                                    value={formData.specialInstructions}
                                    onChange={handleInputChange}
                                    rows="3"
                                    placeholder="Enter any special delivery instructions..."
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="navigation-buttons">
                    <button
                        type="button"
                        className="btn btn-outline-primary btn-navigation"
                        onClick={onPrevious}
                    >
                        <i className="bi bi-arrow-left"></i> Previous
                    </button>
                    <button
                        type="submit"
                        className="btn btn-primary btn-navigation"
                        onClick={handleSubmit}
                    >
                        Next <i className="bi bi-arrow-right"></i>
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ShipTo; 