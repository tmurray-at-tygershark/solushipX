import React, { useState, useEffect, useRef } from 'react';

const ShipmentInfo = ({ data, onDataChange, onNext, onPrevious }) => {
    const [formData, setFormData] = useState({
        shipmentType: data?.shipmentType || 'courier',
        internationalShipment: data?.internationalShipment || false,
        shipperReferenceNumber: data?.shipperReferenceNumber || '',
        bookingReferenceNumber: data?.bookingReferenceNumber || '',
        bookingReferenceType: 'Shipment',
        shipmentBillType: 'DefaultLogisticsPlus',
        shipmentDate: data?.shipmentDate || '',
        earliestPickupTime: data?.earliestPickupTime || '05:00',
        latestPickupTime: data?.latestPickupTime || '17:00',
        earliestDeliveryTime: data?.earliestDeliveryTime || '09:00',
        latestDeliveryTime: data?.latestDeliveryTime || '22:00',
        dangerousGoodsType: data?.dangerousGoodsType || 'none',
        signatureServiceType: data?.signatureServiceType || 'none',
        holdForPickup: data?.holdForPickup || false,
        saturdayDelivery: data?.saturdayDelivery || false,
        dutibleAmount: 0.00,
        dutibleCurrency: 'CDN',
        numberOfPackages: 1
    });

    const prevFormDataRef = useRef(formData);

    // Update form data when data prop changes
    useEffect(() => {
        if (data) {
            setFormData({
                shipmentType: data.shipmentType || 'courier',
                internationalShipment: data.internationalShipment || false,
                shipperReferenceNumber: data.shipperReferenceNumber || '',
                bookingReferenceNumber: data.bookingReferenceNumber || '',
                shipmentDate: data.shipmentDate || '',
                earliestPickupTime: data.earliestPickupTime || '05:00',
                latestPickupTime: data.latestPickupTime || '17:00',
                earliestDeliveryTime: data.earliestDeliveryTime || '09:00',
                latestDeliveryTime: data.latestDeliveryTime || '22:00',
                holdForPickup: data.holdForPickup || false,
                saturdayDelivery: data.saturdayDelivery || false,
                dangerousGoodsType: data.dangerousGoodsType || 'none',
                signatureServiceType: data.signatureServiceType || 'none'
            });
        }
    }, [data]);

    // Only call onDataChange when formData actually changes
    useEffect(() => {
        if (JSON.stringify(formData) !== JSON.stringify(prevFormDataRef.current)) {
            onDataChange(formData);
            prevFormDataRef.current = formData;
        }
    }, [formData, onDataChange]);

    const handleInputChange = (e) => {
        const { id, value, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [id]: type === 'checkbox' ? e.target.checked : value
        }));
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
            <h3 className="form-section-title">Shipment Details</h3>

            <div className="card">
                <div className="card-header">
                    <h4 className="card-title">Basic Information</h4>
                </div>
                <div className="form-grid">
                    <div className="form-group">
                        <label className="form-label" htmlFor="shipmentType">Shipment Type</label>
                        <select
                            id="shipmentType"
                            className="form-control"
                            value={formData.shipmentType}
                            onChange={(e) => handleInputChange('shipmentType', e.target.value)}
                            required
                        >
                            <option value="courier">Courier</option>
                            <option value="freight">Freight</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="shipperReferenceNumber">Reference Number</label>
                        <input
                            type="text"
                            id="shipperReferenceNumber"
                            className="form-control"
                            value={formData.shipperReferenceNumber}
                            onChange={(e) => handleInputChange('shipperReferenceNumber', e.target.value)}
                            placeholder="Enter reference number"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="bookingReferenceNumber">Booking Reference</label>
                        <input
                            type="text"
                            id="bookingReferenceNumber"
                            className="form-control"
                            value={formData.bookingReferenceNumber}
                            onChange={(e) => handleInputChange('bookingReferenceNumber', e.target.value)}
                            placeholder="Enter booking reference"
                        />
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h4 className="card-title">Schedule</h4>
                </div>
                <div className="form-grid">
                    <div className="form-group">
                        <label className="form-label" htmlFor="shipmentDate">Shipment Date</label>
                        <input
                            type="date"
                            id="shipmentDate"
                            className="form-control"
                            value={formData.shipmentDate}
                            onChange={(e) => handleInputChange('shipmentDate', e.target.value)}
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">Pickup Window</label>
                        <div className="d-flex gap-2">
                            <input
                                type="time"
                                className="form-control"
                                value={formData.earliestPickupTime}
                                onChange={(e) => handleInputChange('earliestPickupTime', e.target.value)}
                                required
                            />
                            <input
                                type="time"
                                className="form-control"
                                value={formData.latestPickupTime}
                                onChange={(e) => handleInputChange('latestPickupTime', e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">Delivery Window</label>
                        <div className="d-flex gap-2">
                            <input
                                type="time"
                                className="form-control"
                                value={formData.earliestDeliveryTime}
                                onChange={(e) => handleInputChange('earliestDeliveryTime', e.target.value)}
                                required
                            />
                            <input
                                type="time"
                                className="form-control"
                                value={formData.latestDeliveryTime}
                                onChange={(e) => handleInputChange('latestDeliveryTime', e.target.value)}
                                required
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="card">
                <div className="card-header">
                    <h4 className="card-title">Additional Services</h4>
                </div>
                <div className="form-grid">
                    <div className="form-group">
                        <label className="form-label" htmlFor="dangerousGoodsType">Dangerous Goods</label>
                        <select
                            id="dangerousGoodsType"
                            className="form-control"
                            value={formData.dangerousGoodsType}
                            onChange={(e) => handleInputChange('dangerousGoodsType', e.target.value)}
                        >
                            <option value="none">None</option>
                            <option value="limited">Limited Quantity</option>
                            <option value="fully-regulated">Fully Regulated</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label className="form-label" htmlFor="signatureServiceType">Signature Service</label>
                        <select
                            id="signatureServiceType"
                            className="form-control"
                            value={formData.signatureServiceType}
                            onChange={(e) => handleInputChange('signatureServiceType', e.target.value)}
                        >
                            <option value="none">None</option>
                            <option value="direct">Direct Signature</option>
                            <option value="adult">Adult Signature</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <div className="form-check">
                            <input
                                type="checkbox"
                                id="holdForPickup"
                                className="form-check-input"
                                checked={formData.holdForPickup}
                                onChange={(e) => handleInputChange('holdForPickup', e.target.checked)}
                            />
                            <label className="form-check-label" htmlFor="holdForPickup">
                                Hold for Pickup
                            </label>
                        </div>
                        <div className="form-check">
                            <input
                                type="checkbox"
                                id="saturdayDelivery"
                                className="form-check-input"
                                checked={formData.saturdayDelivery}
                                onChange={(e) => handleInputChange('saturdayDelivery', e.target.checked)}
                            />
                            <label className="form-check-label" htmlFor="saturdayDelivery">
                                Saturday Delivery
                            </label>
                        </div>
                    </div>
                </div>
            </div>

            <div className="navigation-buttons">
                <div></div>
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

export default ShipmentInfo; 