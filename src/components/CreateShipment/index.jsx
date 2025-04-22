import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import StepperComponent from './Stepper';
import ShipmentInfo from './ShipmentInfo';
import ShipFrom from './ShipFrom';
import ShipTo from './ShipTo';
import Packages from './Packages';
import Rates from './Rates';
import Review from './Review';
import './CreateShipment.css';

// API key should be loaded from environment variables with a fallback
// Ensure the API key is properly formatted and has no whitespace
const RAW_API_KEY = process.env.REACT_APP_SOLUSHIPX_API_KEY || 'e61c3e150511db70aa0f2d2476ab8511';
const API_KEY = RAW_API_KEY ? RAW_API_KEY.trim() : 'e61c3e150511db70aa0f2d2476ab8511';

// Validate API key - ensure it's not empty or just whitespace
if (!API_KEY || API_KEY.trim() === '') {
    console.error('CRITICAL ERROR: API key is missing or invalid in CreateShipment component');
}

// Force it to the hardcoded value if there's any doubt
console.log(`API Key set to hardcoded value: ${API_KEY === 'e61c3e150511db70aa0f2d2476ab8511'}`);

// Log the API key status (but not the actual key value) for debugging
console.log('API Key Status in CreateShipment:', {
    fromEnv: !!process.env.REACT_APP_SOLUSHIPX_API_KEY,
    keyLength: API_KEY?.length || 0,
    keyStart: API_KEY ? API_KEY.substring(0, 5) : 'undefined',
    keyEnd: API_KEY ? API_KEY.substring(API_KEY.length - 5) : 'undefined',
    isValid: !!(API_KEY && API_KEY.trim() !== '')
});

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
    const { currentUser } = useAuth();
    const [currentStep, setCurrentStep] = useState(urlStep ? STEPS[urlStep] || 1 : 1);
    const [formData, setFormData] = useState({
        shipmentInfo: {},
        shipFrom: {},
        shipTo: {},
        packages: [],
    });
    const [selectedRate, setSelectedRate] = useState(null);
    const [companyData, setCompanyData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const hasLogged = useRef(false);
    const isNavigating = useRef(false);

    // Fetch company data when component loads
    useEffect(() => {
        const fetchCompanyData = async () => {
            if (!currentUser) {
                console.log('User not logged in');
                return;
            }

            try {
                setIsLoading(true);
                setError(null);

                // Get user's company ID
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (!userDoc.exists()) {
                    throw new Error('User data not found');
                }

                const userData = userDoc.data();
                if (!userData.connectedCompanies?.companies || userData.connectedCompanies.companies.length === 0) {
                    throw new Error('No company associated with this account');
                }

                const companyId = userData.connectedCompanies.companies[0];
                console.log('Using company ID:', companyId);

                // Call the getCompany function
                const functions = getFunctions();
                const getCompanyFunction = httpsCallable(functions, 'getCompany');

                console.log('Calling getCompany function with companyId:', companyId);
                const result = await getCompanyFunction({ companyId });

                if (!result.data.success) {
                    throw new Error(result.data.error || 'Failed to fetch company data');
                }

                const company = result.data.data;
                console.log('Company data retrieved successfully:', company);
                setCompanyData(company);

            } catch (err) {
                console.error('Error fetching company data:', err);
                setError(err.message || 'Failed to load company data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchCompanyData();
    }, [currentUser]);

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
        // Ensure API key is available, use hardcoded fallback if needed
        const safeApiKey = API_KEY || 'e61c3e150511db70aa0f2d2476ab8511';
        console.log(`Using API key: ${safeApiKey.substring(0, 3)}...${safeApiKey.substring(safeApiKey.length - 3)}`);

        switch (currentStep) {
            case 1:
                return (
                    <ShipmentInfo
                        key="shipment-info"
                        data={formData.shipmentInfo}
                        onDataChange={(data) => handleFormDataChange('shipmentInfo', data)}
                        onNext={handleNext}
                        apiKey={safeApiKey}
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
                        apiKey={safeApiKey}
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
                        apiKey={safeApiKey}
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
                        apiKey={safeApiKey}
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
                        apiKey={safeApiKey}
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
                        apiKey={safeApiKey}
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
                            {companyData && (
                                <p className="text-muted">
                                    Creating shipment for {companyData.name || companyData.companyName || 'Your Company'}
                                </p>
                            )}
                        </div>

                        {error && (
                            <div className="alert alert-danger alert-dismissible fade show" role="alert">
                                {error}
                                <button type="button" className="btn-close" onClick={() => setError(null)}></button>
                            </div>
                        )}

                        {isLoading ? (
                            <div className="d-flex justify-content-center my-5">
                                <div className="spinner-border text-primary" role="status">
                                    <span className="visually-hidden">Loading...</span>
                                </div>
                            </div>
                        ) : (
                            <>
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
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CreateShipment; 