import React, { useState } from 'react';

const RateForm = ({ onSubmit }) => {
    const [formData, setFormData] = useState({
        origin: '',
        destination: '',
        weight: '',
        dimensions: {
            length: '',
            width: '',
            height: ''
        }
    });

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (name.includes('.')) {
            const [parent, child] = name.split('.');
            setFormData(prev => ({
                ...prev,
                [parent]: {
                    ...prev[parent],
                    [child]: value
                }
            }));
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <form onSubmit={handleSubmit} className="rate-form">
            <div className="row g-3">
                <div className="col-md-6">
                    <label htmlFor="origin" className="form-label">Origin</label>
                    <input
                        type="text"
                        className="form-control"
                        id="origin"
                        name="origin"
                        value={formData.origin}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="col-md-6">
                    <label htmlFor="destination" className="form-label">Destination</label>
                    <input
                        type="text"
                        className="form-control"
                        id="destination"
                        name="destination"
                        value={formData.destination}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="col-md-4">
                    <label htmlFor="weight" className="form-label">Weight (kg)</label>
                    <input
                        type="number"
                        className="form-control"
                        id="weight"
                        name="weight"
                        value={formData.weight}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="col-md-4">
                    <label htmlFor="length" className="form-label">Length (cm)</label>
                    <input
                        type="number"
                        className="form-control"
                        id="length"
                        name="dimensions.length"
                        value={formData.dimensions.length}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="col-md-4">
                    <label htmlFor="width" className="form-label">Width (cm)</label>
                    <input
                        type="number"
                        className="form-control"
                        id="width"
                        name="dimensions.width"
                        value={formData.dimensions.width}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="col-md-4">
                    <label htmlFor="height" className="form-label">Height (cm)</label>
                    <input
                        type="number"
                        className="form-control"
                        id="height"
                        name="dimensions.height"
                        value={formData.dimensions.height}
                        onChange={handleChange}
                        required
                    />
                </div>
            </div>
        </form>
    );
};

export default RateForm; 