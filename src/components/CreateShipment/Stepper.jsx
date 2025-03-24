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
        // Only allow backward navigation
        if (stepNumber < currentStep && onStepClick) {
            onStepClick(stepNumber);
        }
    };

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
                        <button
                            className={`step-circle ${step.number < currentStep ? 'clickable' : ''}`}
                            onClick={() => handleStepClick(step.number)}
                            disabled={step.number >= currentStep}
                        >
                            <span>{step.number}</span>
                        </button>
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