import React from 'react';
import { CheckCircle, RadioButtonUnchecked, Error } from '@mui/icons-material';

const StepperComponent = ({ currentStep, dataCompleteness = {}, onStepClick }) => {
    const steps = [
        { number: 1, label: 'Shipment Info', key: 'shipmentInfo' },
        { number: 2, label: 'From Address', key: 'shipFrom' },
        { number: 3, label: 'To Address', key: 'shipTo' },
        { number: 4, label: 'Packages', key: 'packages' },
        { number: 5, label: 'Rates', key: 'rates' },
        { number: 6, label: 'Review', key: 'review' }
    ];

    const handleStepClick = (stepNumber) => {
        // Allow navigation to any step for draft editing
        if (onStepClick) {
            onStepClick(stepNumber);
        }
    };

    const getStepStatus = (step) => {
        if (step.number === currentStep) {
            return 'current';
        } else if (step.number < currentStep) {
            // Check if this step's data is complete
            const stepData = dataCompleteness[step.key];
            return stepData?.complete ? 'complete' : 'incomplete';
        } else {
            return 'future';
        }
    };

    const getStepIcon = (step) => {
        const status = getStepStatus(step);
        const stepData = dataCompleteness[step.key];

        switch (status) {
            case 'complete':
                return <CheckCircle style={{ color: '#4caf50', fontSize: '16px' }} />;
            case 'incomplete':
                return <Error style={{ color: '#ff9800', fontSize: '16px' }} />;
            case 'current':
                return <span style={{ color: '#2196f3', fontWeight: 'bold', fontSize: '14px' }}>{step.number}</span>;
            default:
                return <RadioButtonUnchecked style={{ color: '#ccc', fontSize: '16px' }} />;
        }
    };

    const getStepTooltip = (step) => {
        const stepData = dataCompleteness[step.key];
        if (stepData && stepData.missing && stepData.missing.length > 0) {
            return `Missing: ${stepData.missing.join(', ')}`;
        }
        return '';
    };

    const progressPercentage = ((currentStep - 1) / (steps.length - 1)) * 100;

    return (
        <div className="stepper-wrapper">
            <div className="stepper">
                {steps.map((step) => {
                    const status = getStepStatus(step);
                    const tooltip = getStepTooltip(step);

                    return (
                        <div
                            key={step.number}
                            className={`step-item ${currentStep >= step.number ? 'active' : ''} ${status}`}
                            data-step={step.number}
                            title={tooltip}
                        >
                            <button
                                className={`step-circle clickable ${status}`}
                                onClick={() => handleStepClick(step.number)}
                                style={{
                                    backgroundColor: status === 'current' ? '#2196f3' :
                                        status === 'complete' ? '#e8f5e8' :
                                            status === 'incomplete' ? '#fff3e0' : '#f5f5f5',
                                    border: status === 'current' ? '2px solid #2196f3' :
                                        status === 'complete' ? '2px solid #4caf50' :
                                            status === 'incomplete' ? '2px solid #ff9800' : '2px solid #ccc',
                                    cursor: 'pointer'
                                }}
                            >
                                {getStepIcon(step)}
                            </button>
                            <div className={`step-label ${status}`}>{step.label}</div>
                            {status === 'incomplete' && (
                                <div className="step-status" style={{ fontSize: '10px', color: '#ff9800' }}>
                                    Incomplete
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
            <div className="progress-bar">
                <div className="progress" style={{ width: `${progressPercentage}%` }}></div>
            </div>
        </div>
    );
};

export default StepperComponent; 