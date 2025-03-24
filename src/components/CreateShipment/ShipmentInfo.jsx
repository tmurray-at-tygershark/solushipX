import React, { useState, useEffect, useRef } from 'react';

const ShipmentInfo = ({ data, onDataChange, onNext, onPrevious }) => {
    const [formData, setFormData] = useState({
        shipmentType: data?.shipmentType || 'domestic',
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
                shipmentType: data.shipmentType || 'domestic',
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
        <div className="form-section active" data-step="0">
            <div className="section-header">
                <h4 className="mb-0">Shipment Information</h4>
            </div>
            <div className="row g-3">
                <div className="col-md-4">
                    <label className="form-label">Shipment Type</label>
                    <select
                        className="form-select"
                        id="shipmentType"
                        value={formData.shipmentType}
                        onChange={handleInputChange}
                    >
                        <option value="courier">Courier</option>
                        <option value="FTL">FTL (Full-Truckload)</option>
                        <option value="LTL">LTL (Less-Than-Truckload)</option>
                        <option value="freight">Freight</option>
                        <option value="rail">Rail</option>
                        <option value="air">Air</option>
                        <option value="ocean">Ocean</option>
                    </select>
                </div>
                <div className="col-md-4">
                    <label className="form-label">Shipper Reference Number</label>
                    <input
                        type="text"
                        className="form-control"
                        id="shipperReferenceNumber"
                        placeholder="e.g., TFM0228"
                        required
                        value={formData.shipperReferenceNumber}
                        onChange={handleInputChange}
                    />
                </div>
                <div className="col-md-4">
                    <label className="form-label">Booking Reference Number</label>
                    <input
                        type="text"
                        className="form-control"
                        id="bookingReferenceNumber"
                        placeholder="e.g., TFM-0228"
                        required
                        value={formData.bookingReferenceNumber}
                        onChange={handleInputChange}
                    />
                </div>
                <div className="col-md-4">
                    <label className="form-label">Shipment Date</label>
                    <input
                        type="date"
                        className="form-control"
                        id="shipmentDate"
                        required
                        value={formData.shipmentDate}
                        onChange={handleInputChange}
                    />
                </div>
                <div className="col-md-3">
                    <label className="form-label">Earliest Pickup Time</label>
                    <input
                        type="time"
                        className="form-control"
                        id="earliestPickupTime"
                        required
                        step="3600"
                        value={formData.earliestPickupTime}
                        onChange={handleInputChange}
                    />
                </div>
                <div className="col-md-3">
                    <label className="form-label">Latest Pickup Time</label>
                    <input
                        type="time"
                        className="form-control"
                        id="latestPickupTime"
                        required
                        step="3600"
                        value={formData.latestPickupTime}
                        onChange={handleInputChange}
                    />
                </div>
                <div className="col-md-3">
                    <label className="form-label">Earliest Delivery Time</label>
                    <input
                        type="time"
                        className="form-control"
                        id="earliestDeliveryTime"
                        required
                        step="3600"
                        value={formData.earliestDeliveryTime}
                        onChange={handleInputChange}
                    />
                </div>
                <div className="col-md-3">
                    <label className="form-label">Latest Delivery Time</label>
                    <input
                        type="time"
                        className="form-control"
                        id="latestDeliveryTime"
                        required
                        step="3600"
                        value={formData.latestDeliveryTime}
                        onChange={handleInputChange}
                    />
                </div>
                <div className="col-md-3">
                    <div className="form-check">
                        <input
                            type="checkbox"
                            className="form-check-input"
                            id="internationalShipment"
                            checked={formData.internationalShipment}
                            onChange={handleInputChange}
                        />
                        <label className="form-check-label">International Shipment</label>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="form-check">
                        <input
                            type="checkbox"
                            className="form-check-input"
                            id="holdForPickup"
                            checked={formData.holdForPickup}
                            onChange={handleInputChange}
                        />
                        <label className="form-check-label">Hold for Pickup</label>
                    </div>
                </div>
                <div className="col-md-3">
                    <div className="form-check">
                        <input
                            type="checkbox"
                            className="form-check-input"
                            id="saturdayDelivery"
                            checked={formData.saturdayDelivery}
                            onChange={handleInputChange}
                        />
                        <label className="form-check-label">Saturday Delivery</label>
                    </div>
                </div>
            </div>
            <div className="navigation-buttons">
                <div></div>
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

export default ShipmentInfo; 