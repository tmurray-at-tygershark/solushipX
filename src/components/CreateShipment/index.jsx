import React, { useState, useEffect, useRef } from 'react';
import StepperComponent from './Stepper';
import ShipmentInfo from './ShipmentInfo';
import ShipFrom from './ShipFrom';
import ShipTo from './ShipTo';
import Packages from './Packages';
import Rates from './Rates';
import Review from './Review';
import './CreateShipment.css';

const CreateShipment = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        shipmentInfo: {},
        shipFrom: {},
        shipTo: {},
        packages: [],
    });
    const [selectedRate, setSelectedRate] = useState(null);
    const hasLogged = useRef(false);

    // Sample draft data matching the original implementation
    const sampleDraft = {
        shipmentInfo: {
            shipmentType: 'courier',
            internationalShipment: false,
            shipperReferenceNumber: 'TFM0228',
            bookingReferenceNumber: 'TFM-0228',
            bookingReferenceType: 'Shipment',
            shipmentBillType: 'DefaultLogisticsPlus',
            shipmentDate: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0],
            earliestPickupTime: '05:00',
            latestPickupTime: '17:00',
            earliestDeliveryTime: '09:00',
            latestDeliveryTime: '22:00',
            dangerousGoodsType: 'none',
            signatureServiceType: 'none',
            holdForPickup: false,
            saturdayDelivery: false,
            dutibleAmount: 0.00,
            dutibleCurrency: 'CDN',
            numberOfPackages: 1
        },
        shipFrom: {
            company: "Tyger Shark Inc.",
            attentionName: "Tyler Murray",
            street: "123 Main Street",
            street2: "Unit A",
            postalCode: "53151",
            city: "New Berlin",
            state: "WI",
            country: "US",
            contactName: "Tyler Murray",
            contactPhone: "647-262-1493",
            contactEmail: "tyler@tygershark.com",
            contactFax: "647-262-1493",
            specialInstructions: "Pickup at Bay 1"
        },
        shipTo: {
            company: "Fantom Inc.",
            attentionName: "Tyler Murray",
            street: "321 King Street",
            street2: "Unit B",
            postalCode: "L4W 1N7",
            city: "Mississauga",
            state: "ON",
            country: "CA",
            contactName: "Tyler Murray",
            contactPhone: "647-262-1493",
            contactEmail: "tyler@tygershark.com",
            contactFax: "647-262-1493",
            specialInstructions: "Deliver to Bay 3"
        },
        packages: [{
            itemDescription: "metal shavings",
            packagingType: 258,
            packagingQuantity: 1,
            stackable: true,
            weight: 100.00,
            height: 10,
            width: 10,
            length: 10,
            freightClass: 50,
            declaredValue: 0.00
        }]
    };

    // Remove theme handling
    useEffect(() => {
        // Only log once, even in StrictMode
        if (!hasLogged.current) {
            console.log('🚀 SolushipX React App v0.3.0 - Shipment Creation Form');
            hasLogged.current = true;
        }
    }, []);

    const handleNext = () => {
        console.log('Moving to next step from:', currentStep);
        setCurrentStep(prev => {
            const nextStep = Math.min(prev + 1, 6);
            console.log('Next step will be:', nextStep);
            return nextStep;
        });
        // Scroll to the top of the form container
        document.querySelector('.container').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handlePrevious = () => {
        console.log('Moving to previous step from:', currentStep);
        setCurrentStep(prev => {
            const prevStep = Math.max(prev - 1, 1);
            console.log('Previous step will be:', prevStep);
            return prevStep;
        });
        // Scroll to the top of the form container
        document.querySelector('.container').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleFormDataChange = (section, data) => {
        console.log('Form data changed for section:', section, data);
        setFormData(prev => {
            const newData = {
                ...prev,
                [section]: data
            };
            console.log('Updated form data:', newData);
            return newData;
        });
    };

    const handleRateSelect = (rate) => {
        setSelectedRate(rate);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Handle final submission
        console.log('Final form data:', { ...formData, selectedRate });
    };

    const loadDraft = () => {
        setFormData(sampleDraft);
    };

    const renderStep = () => {
        console.log('Rendering step:', currentStep, 'with form data:', formData);
        switch (currentStep) {
            case 1:
                return (
                    <ShipmentInfo
                        key="shipment-info"
                        data={formData.shipmentInfo}
                        onDataChange={(data) => handleFormDataChange('shipmentInfo', data)}
                        onNext={handleNext}
                    />
                );
            case 2:
                return (
                    <ShipFrom
                        key="ship-from"
                        data={formData.shipFrom}
                        onDataChange={(data) => handleFormDataChange('shipFrom', data)}
                        onNext={handleNext}
                        onPrevious={handlePrevious}
                    />
                );
            case 3:
                return (
                    <ShipTo
                        key="ship-to"
                        data={formData.shipTo}
                        onDataChange={(data) => handleFormDataChange('shipTo', data)}
                        onNext={handleNext}
                        onPrevious={handlePrevious}
                    />
                );
            case 4:
                return (
                    <Packages
                        key="packages"
                        data={formData.packages}
                        onDataChange={(data) => handleFormDataChange('packages', data)}
                        onNext={handleNext}
                        onPrevious={handlePrevious}
                    />
                );
            case 5:
                return (
                    <Rates
                        key="rates"
                        formData={formData}
                        onRateSelect={handleRateSelect}
                        onNext={handleNext}
                        onPrevious={handlePrevious}
                    />
                );
            case 6:
                return (
                    <Review
                        key="review"
                        formData={formData}
                        selectedRate={selectedRate}
                        onSubmit={handleSubmit}
                        onPrevious={handlePrevious}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="container-fluid">
            <div className="row">
                <div className="col-12">
                    <div className="container">
                        <div className="section-header">
                            <h2>Create New Shipment</h2>
                            <div className="d-flex">
                                {currentStep === 1 && (
                                    <div>
                                        <button
                                            type="button"
                                            className="btn btn-outline-primary"
                                            onClick={loadDraft}
                                        >
                                            <i className="bi bi-file-earmark-text me-2"></i> LOAD DRAFT
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <StepperComponent
                            currentStep={currentStep}
                            onStepClick={(step) => {
                                setCurrentStep(step);
                                document.querySelector('.container').scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                        />

                        <form id="shipmentForm" className="needs-validation" noValidate onSubmit={handleSubmit}>
                            {renderStep()}
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateShipment; 