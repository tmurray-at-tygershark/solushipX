import React from 'react';

const StepperComponent = ({ currentStep }) => {
    const steps = [
        { number: 1, label: 'Shipment Info' },
        { number: 2, label: 'From Address' },
        { number: 3, label: 'To Address' },
        { number: 4, label: 'Packages' },
        { number: 5, label: 'Review' },
    ];

    const progressPercentage = ((currentStep - 1) / (steps.length - 1)) * 100;

    return (
        <div className="stepper-wrapper">
            <div className="stepper">
                {steps.map((step) => (
                    <div
                        key={step.number}
                        className={`step-item ${currentStep >= step.number ? 'active' : ''}`}
                        data-step={step.number}
                    >
                        <div className="step-circle">
                            <span>{step.number}</span>
                        </div>
                        <div className="step-label">{step.label}</div>
                    </div>
                ))}
            </div>
            <div className="progress-bar">
                <div className="progress" style={{ width: `${progressPercentage}%` }}></div>
            </div>
        </div>
    );
};

export default StepperComponent; 