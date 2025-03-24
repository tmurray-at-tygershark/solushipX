import React from 'react';

const StepperComponent = ({ currentStep, onStepClick }) => {
    const steps = [
        { number: 1, label: 'Shipment Info' },
        { number: 2, label: 'From Address' },
        { number: 3, label: 'To Address' },
        { number: 4, label: 'Packages' },
        { number: 5, label: 'Rates' },
        { number: 6, label: 'Review' }
    ];

    const handleStepClick = (stepNumber) => {
        if (stepNumber <= currentStep && onStepClick) {
            onStepClick(stepNumber);
        }
    };

    return (
        <div className="stepper-wrapper">
            <div className="stepper">
                {steps.map((step) => (
                    <div
                        key={step.number}
                        className={`step-item ${currentStep >= step.number ? 'active' : ''} ${currentStep > step.number ? 'completed' : ''}`}
                        data-step={step.number}
                    >
                        <div
                            className="step-circle"
                            onClick={() => handleStepClick(step.number)}
                            style={{ cursor: step.number <= currentStep ? 'pointer' : 'default' }}
                        >
                            <span>{step.number}</span>
                        </div>
                        <div className="step-label">{step.label}</div>
                    </div>
                ))}
            </div>
            <div className="progress-bar">
                <div
                    className="progress"
                    style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
                ></div>
            </div>
        </div>
    );
};

export default StepperComponent; 