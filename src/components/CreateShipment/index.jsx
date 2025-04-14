import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import StepperComponent from './Stepper';
import ShipmentInfo from './ShipmentInfo';
import ShipFrom from './ShipFrom';
import ShipTo from './ShipTo';
import Packages from './Packages';
import Rates from './Rates';
import Review from './Review';
import ChatBot from './ChatBot';
import './CreateShipment.css';

// Step mapping constants
const STEPS = {
    'shipment-info': 1,
    'ship-from': 2,
    'ship-to': 3,
    'packages': 4,
    'rates': 5,
    'review': 6
};

const STEP_SLUGS = {
    1: 'shipment-info',
    2: 'ship-from',
    3: 'ship-to',
    4: 'packages',
    5: 'rates',
    6: 'review'
};

const CreateShipment = () => {
    const { step: urlStep } = useParams();
    const navigate = useNavigate();
    const [currentStep, setCurrentStep] = useState(urlStep ? STEPS[urlStep] || 1 : 1);
    const [formData, setFormData] = useState({
        shipmentInfo: {},
        shipFrom: {},
        shipTo: {},
        packages: [],
    });
    const [selectedRate, setSelectedRate] = useState(null);
    const hasLogged = useRef(false);
    const isNavigating = useRef(false);

    // Only sync URL when it changes externally
    useEffect(() => {
        if (urlStep && STEPS[urlStep] && !isNavigating.current) {
            setCurrentStep(STEPS[urlStep]);
        } else if (!urlStep) {
            navigate('/create-shipment/shipment-info', { replace: true });
        }
    }, [urlStep, navigate]);

    // Log version info once
    useEffect(() => {
        if (!hasLogged.current) {
            console.log('🚀 SolushipX React App v0.3.0 - Shipment Creation Form');
            hasLogged.current = true;
        }
    }, []);

    const handleNext = () => {
        if (currentStep < 6) {
            const nextStep = currentStep + 1;
            const nextStepSlug = STEP_SLUGS[nextStep];
            window.scrollTo({ top: 0, behavior: 'smooth' });
            isNavigating.current = true;
            setCurrentStep(nextStep);
            navigate(`/create-shipment/${nextStepSlug}`, { replace: true });
            setTimeout(() => {
                isNavigating.current = false;
            }, 100);
        }
    };

    const handlePrevious = () => {
        if (currentStep > 1) {
            const prevStep = currentStep - 1;
            const prevStepSlug = STEP_SLUGS[prevStep];
            window.scrollTo({ top: 0, behavior: 'smooth' });
            isNavigating.current = true;
            setCurrentStep(prevStep);
            navigate(`/create-shipment/${prevStepSlug}`, { replace: true });
            setTimeout(() => {
                isNavigating.current = false;
            }, 100);
        }
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
        handleNext();
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Handle final submission
        console.log('Final form data:', { ...formData, selectedRate });
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
                        </div>

                        <StepperComponent
                            currentStep={currentStep}
                            onStepClick={(step) => {
                                const stepSlug = STEP_SLUGS[step];
                                navigate(`/create-shipment/${stepSlug}`);
                                document.querySelector('.container').scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                        />

                        <form id="shipmentForm" className="needs-validation" noValidate onSubmit={handleSubmit}>
                            {renderStep()}
                        </form>
                    </div>
                </div>
            </div>
            <ChatBot onShipmentComplete={handleSubmit} />
        </div>
    );
};

export default CreateShipment; 