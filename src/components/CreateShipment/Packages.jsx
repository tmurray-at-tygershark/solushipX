import React, { useState, useEffect } from 'react';

const Packages = ({ data, onDataChange, onNext, onPrevious }) => {
    const [packages, setPackages] = useState(data || []);

    // Only handle initial data load and data prop changes
    useEffect(() => {
        if (data && data.length > 0) {
            setPackages(data);
        }
    }, [data]);

    const addPackage = () => {
        const newPackages = [...packages, {
            itemDescription: '',
            packagingType: 258,
            packagingQuantity: 1,
            stackable: true,
            weight: '',
            height: '',
            width: '',
            length: '',
            freightClass: "50",
            declaredValue: 0.00
        }];
        setPackages(newPackages);
        onDataChange(newPackages);
    };

    const removePackage = (index) => {
        const newPackages = packages.filter((_, i) => i !== index);
        setPackages(newPackages);
        onDataChange(newPackages);
    };

    const updatePackage = (index, field, value) => {
        const updatedPackages = [...packages];
        updatedPackages[index] = {
            ...updatedPackages[index],
            [field]: value
        };
        setPackages(updatedPackages);
        onDataChange(updatedPackages);
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
        <div className="form-section active" data-step="4">
            <div className="section-header">
                <h3>Packages</h3>
            </div>

            <div className="section-content">
                {packages.length === 0 && (
                    <div className="text-center mb-4">
                        <p className="text-muted">No packages added yet. Click the button below to add a package.</p>
                    </div>
                )}

                <div className="packages-list">
                    {packages.map((pkg, index) => (
                        <div key={index} className="subsection mb-4">
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h4 className="subsection-title mb-0">Package {index + 1}</h4>
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={() => removePackage(index)}
                                >
                                    <i className="bi bi-trash"></i> Remove
                                </button>
                            </div>
                            <div className="row g-3">
                                <div className="col-md-6">
                                    <div className="form-group">
                                        <label className="form-label">Description</label>
                                        <input
                                            type="text"
                                            className="form-control"
                                            value={pkg.itemDescription}
                                            onChange={(e) => updatePackage(index, 'itemDescription', e.target.value)}
                                            required
                                        />
                                        <div className="invalid-feedback">Please enter a description.</div>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <div className="form-group">
                                        <label className="form-label">Quantity</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            value={pkg.packagingQuantity}
                                            onChange={(e) => updatePackage(index, 'packagingQuantity', parseInt(e.target.value))}
                                            min="1"
                                            required
                                        />
                                        <div className="invalid-feedback">Please enter a quantity.</div>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <div className="form-group">
                                        <label className="form-label">Type</label>
                                        <select
                                            className="form-select"
                                            value={pkg.packagingType}
                                            onChange={(e) => updatePackage(index, 'packagingType', parseInt(e.target.value))}
                                            required
                                        >
                                            <option value="258">Pallet</option>
                                            <option value="259">Box</option>
                                            <option value="260">Skid</option>
                                            <option value="261">Crate</option>
                                        </select>
                                        <div className="invalid-feedback">Please select a type.</div>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <div className="form-group">
                                        <label className="form-label">Weight (lbs)</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            value={pkg.weight}
                                            onChange={(e) => updatePackage(index, 'weight', parseFloat(e.target.value))}
                                            step="0.01"
                                            required
                                        />
                                        <div className="invalid-feedback">Please enter the weight.</div>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <div className="form-group">
                                        <label className="form-label">Length (in)</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            value={pkg.length}
                                            onChange={(e) => updatePackage(index, 'length', parseInt(e.target.value))}
                                            required
                                        />
                                        <div className="invalid-feedback">Please enter the length.</div>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <div className="form-group">
                                        <label className="form-label">Width (in)</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            value={pkg.width}
                                            onChange={(e) => updatePackage(index, 'width', parseInt(e.target.value))}
                                            required
                                        />
                                        <div className="invalid-feedback">Please enter the width.</div>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <div className="form-group">
                                        <label className="form-label">Height (in)</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            value={pkg.height}
                                            onChange={(e) => updatePackage(index, 'height', parseInt(e.target.value))}
                                            required
                                        />
                                        <div className="invalid-feedback">Please enter the height.</div>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <div className="form-group">
                                        <label className="form-label">Freight Class</label>
                                        <select
                                            className="form-select"
                                            value={pkg.freightClass}
                                            onChange={(e) => updatePackage(index, 'freightClass', e.target.value)}
                                            required
                                        >
                                            <option value="50">50</option>
                                            <option value="55">55</option>
                                            <option value="60">60</option>
                                            <option value="65">65</option>
                                            <option value="70">70</option>
                                            <option value="77.5">77.5</option>
                                            <option value="85">85</option>
                                            <option value="92.5">92.5</option>
                                            <option value="100">100</option>
                                            <option value="110">110</option>
                                            <option value="125">125</option>
                                            <option value="150">150</option>
                                            <option value="175">175</option>
                                            <option value="200">200</option>
                                            <option value="250">250</option>
                                            <option value="300">300</option>
                                            <option value="400">400</option>
                                            <option value="500">500</option>
                                        </select>
                                        <div className="invalid-feedback">Please select a freight class.</div>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <div className="form-group">
                                        <label className="form-label">Declared Value</label>
                                        <input
                                            type="number"
                                            className="form-control"
                                            value={pkg.declaredValue}
                                            onChange={(e) => updatePackage(index, 'declaredValue', parseFloat(e.target.value))}
                                            step="0.01"
                                            required
                                        />
                                        <div className="invalid-feedback">Please enter the declared value.</div>
                                    </div>
                                </div>
                                <div className="col-md-3">
                                    <div className="form-group">
                                        <label className="form-label">Stackable</label>
                                        <select
                                            className="form-select"
                                            value={pkg.stackable}
                                            onChange={(e) => updatePackage(index, 'stackable', e.target.value === 'true')}
                                            required
                                        >
                                            <option value="true">Yes</option>
                                            <option value="false">No</option>
                                        </select>
                                        <div className="invalid-feedback">Please select if stackable.</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Add Package Button */}
                <div className="mt-4">
                    <button
                        type="button"
                        className="btn btn-outline-primary w-100"
                        onClick={addPackage}
                    >
                        <i className="bi bi-plus-circle"></i> Add Package
                    </button>
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
                    type="button"
                    className="btn btn-primary btn-navigation"
                    onClick={handleSubmit}
                >
                    Next <i className="bi bi-arrow-right"></i>
                </button>
            </div>
        </div>
    );
};

export default Packages; 