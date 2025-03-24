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
        <div className="form-section">
            <h3 className="form-section-title">Package Information</h3>

            <div className="package-list">
                {packages.map((pkg, index) => (
                    <div key={index} className="card">
                        <div className="card-header">
                            <h4 className="card-title">Package {index + 1}</h4>
                            {packages.length > 1 && (
                                <button
                                    type="button"
                                    className="package-remove-btn"
                                    onClick={() => removePackage(index)}
                                >
                                    <i className="bi bi-x-lg"></i>
                                </button>
                            )}
                        </div>
                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label" htmlFor={`itemDescription-${index}`}>Description</label>
                                <input
                                    type="text"
                                    id={`itemDescription-${index}`}
                                    className="form-control"
                                    value={pkg.itemDescription}
                                    onChange={(e) => updatePackage(index, 'itemDescription', e.target.value)}
                                    placeholder="Enter item description"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor={`packagingType-${index}`}>Package Type</label>
                                <select
                                    id={`packagingType-${index}`}
                                    className="form-control"
                                    value={pkg.packagingType}
                                    onChange={(e) => updatePackage(index, 'packagingType', e.target.value)}
                                    required
                                >
                                    <option value="258">Standard Wooden Pallet</option>
                                    <option value="259">Oversized Pallet</option>
                                    <option value="260">Box</option>
                                    <option value="261">Crate</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor={`packagingQuantity-${index}`}>Quantity</label>
                                <input
                                    type="number"
                                    id={`packagingQuantity-${index}`}
                                    className="form-control"
                                    value={pkg.packagingQuantity}
                                    onChange={(e) => updatePackage(index, 'packagingQuantity', parseInt(e.target.value))}
                                    min="1"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor={`weight-${index}`}>Weight (lbs)</label>
                                <input
                                    type="number"
                                    id={`weight-${index}`}
                                    className="form-control"
                                    value={pkg.weight}
                                    onChange={(e) => updatePackage(index, 'weight', parseFloat(e.target.value))}
                                    min="0"
                                    step="0.1"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor={`length-${index}`}>Length (in)</label>
                                <input
                                    type="number"
                                    id={`length-${index}`}
                                    className="form-control"
                                    value={pkg.length}
                                    onChange={(e) => updatePackage(index, 'length', parseInt(e.target.value))}
                                    min="1"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor={`width-${index}`}>Width (in)</label>
                                <input
                                    type="number"
                                    id={`width-${index}`}
                                    className="form-control"
                                    value={pkg.width}
                                    onChange={(e) => updatePackage(index, 'width', parseInt(e.target.value))}
                                    min="1"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor={`height-${index}`}>Height (in)</label>
                                <input
                                    type="number"
                                    id={`height-${index}`}
                                    className="form-control"
                                    value={pkg.height}
                                    onChange={(e) => updatePackage(index, 'height', parseInt(e.target.value))}
                                    min="1"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor={`freightClass-${index}`}>Freight Class</label>
                                <select
                                    id={`freightClass-${index}`}
                                    className="form-control"
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
                            </div>

                            <div className="form-group">
                                <label className="form-label" htmlFor={`declaredValue-${index}`}>Declared Value ($)</label>
                                <input
                                    type="number"
                                    id={`declaredValue-${index}`}
                                    className="form-control"
                                    value={pkg.declaredValue}
                                    onChange={(e) => updatePackage(index, 'declaredValue', parseFloat(e.target.value))}
                                    min="0"
                                    step="0.01"
                                />
                            </div>

                            <div className="form-group">
                                <div className="form-check mt-4">
                                    <input
                                        type="checkbox"
                                        id={`stackable-${index}`}
                                        className="form-check-input"
                                        checked={pkg.stackable}
                                        onChange={(e) => updatePackage(index, 'stackable', e.target.checked)}
                                    />
                                    <label className="form-check-label" htmlFor={`stackable-${index}`}>
                                        Stackable
                                    </label>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <button
                type="button"
                className="btn btn-outline-primary w-100 mb-4"
                onClick={addPackage}
            >
                <i className="bi bi-plus-circle"></i> Add Another Package
            </button>

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

export default Packages; 