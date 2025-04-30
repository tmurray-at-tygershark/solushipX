import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../../contexts/AuthContext';
import { ShipmentFormProvider, useShipmentForm } from '../../contexts/ShipmentFormContext';
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

// Component that uses the context
const CreateShipmentContent = () => {
    const { step: urlStep } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    // Use context state
    const { formData, updateFormSection, clearFormData } = useShipmentForm();
    const [currentStep, setCurrentStep] = useState(urlStep ? STEPS[urlStep] || 1 : 1);
    const [companyData, setCompanyData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const hasLogged = useRef(false);
    const isNavigating = useRef(false);

    // Fetch company data and initial Ship From addresses when component loads
    useEffect(() => {
        const fetchCompanyDataAndOrigins = async () => {
            if (!currentUser) {
                console.log('User not logged in');
                setIsLoading(false); // Stop loading if no user
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                // --- 1. Get Company ID ---
                const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                if (!userDoc.exists()) throw new Error('User data not found');
                const userData = userDoc.data();
                const companyId = userData.connectedCompanies?.companies?.[0] || userData.companies?.[0];
                if (!companyId) throw new Error('No company associated with this account');
                console.log('Using company ID:', companyId);

                // --- 2. Fetch Basic Company Info (Optional - could get name from origins call too) ---
                const functions = getFunctions();
                const getCompanyFunction = httpsCallable(functions, 'getCompany');
                const getCompanyShipmentOriginsFunction = httpsCallable(functions, 'getCompanyShipmentOrigins');

                // Fetch basic company data (e.g., for header display)
                try {
                    const companyResult = await getCompanyFunction({ companyId });
                    if (companyResult.data.success) {
                        setCompanyData(companyResult.data.data);
                        console.log('Basic company data retrieved successfully:', companyResult.data.data);
                    } else {
                        console.warn('Could not fetch basic company details:', companyResult.data.error);
                    }
                } catch (companyErr) {
                    console.warn('Error fetching basic company details:', companyErr);
                }

                // --- 3. Fetch Ship From Addresses ---
                console.log('Calling getCompanyShipmentOrigins function with companyId:', companyId);
                const originsResult = await getCompanyShipmentOriginsFunction({ companyId });
                if (!originsResult?.data) throw new Error('Invalid response structure from getCompanyShipmentOrigins');
                if (!originsResult.data.success) throw new Error(originsResult.data.error?.message || 'Failed to fetch shipment origins');

                const fetchedShipFromAddresses = originsResult.data.data?.shipFromAddresses || [];
                console.log('Ship From Addresses fetched successfully:', fetchedShipFromAddresses);

                // --- 4. Determine Default Address & Prepare Context Update ---
                let finalShipFromData = {
                    company: companyData?.name || originsResult.data.data?.companyName || '', // Use fetched name
                    shipFromAddresses: fetchedShipFromAddresses,
                    id: null, // Default to no selection
                    // Reset other fields unless pre-filled
                    name: '', attention: '', street: '', street2: '', city: '',
                    state: '', postalCode: '', country: 'US', contactName: '',
                    contactPhone: '', contactEmail: '', specialInstructions: ''
                };

                if (fetchedShipFromAddresses.length > 0) {
                    const defaultAddress = fetchedShipFromAddresses.find(addr => addr.isDefault);
                    if (defaultAddress) {
                        console.log("Default Ship From address found:", defaultAddress);
                        // Overwrite fields with default address details
                        finalShipFromData = {
                            ...finalShipFromData,
                            ...defaultAddress, // Spread default address fields
                            id: defaultAddress.id // Set selected ID
                        };
                    } else {
                        console.log("No default Ship From address found.");
                        // Optionally select the *first* address if no default?
                        // finalShipFromData = { ...finalShipFromData, ...fetchedShipFromAddresses[0], id: fetchedShipFromAddresses[0].id }; 
                    }
                }

                // --- 5. Update Context ONCE ---
                console.log("Updating context with final shipFrom data:", finalShipFromData);
                updateFormSection('shipFrom', finalShipFromData);

            } catch (err) {
                console.error('Error during initial data fetch:', err);
                setError(err.message || 'Failed to load initial data');
            } finally {
                setIsLoading(false);
            }
        };

        fetchCompanyDataAndOrigins();
        // Dependency array includes currentUser and the update function from context
    }, [currentUser, updateFormSection]);

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

    // handleRateSelect is simplified as the rate is set via context in Rates component
    const handleRateSelect = (rate) => {
        // Rate is already set in context by the Rates component via updateFormSection
        // We just need to navigate
        handleNext();
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Handle final submission - potentially call context.completeShipment()
        console.log('Final form data from context:', formData);
        // Call the clear form function from context after successful submission
        // clearFormData();
    };

    const renderStep = () => {
        console.log('Rendering step:', currentStep, 'with form data from context:', formData);
        // Ensure API key is available, use hardcoded fallback if needed
        const safeApiKey = API_KEY || 'e61c3e150511db70aa0f2d2476ab8511';
        console.log(`Using API key: ${safeApiKey.substring(0, 3)}...${safeApiKey.substring(safeApiKey.length - 3)}`);

        // Pass navigation handlers and API key, but not data/onDataChange
        switch (currentStep) {
            case 1:
                return (
                    <ShipmentInfo
                        key="shipment-info"
                        // data={formData.shipmentInfo} // Removed - reads from context
                        // onDataChange={(data) => handleFormDataChange('shipmentInfo', data)} // Removed - updates context directly
                        onNext={handleNext}
                        apiKey={safeApiKey}
                    />
                );
            case 2:
                return (
                    <ShipFrom
                        key="ship-from"
                        // data={formData.shipFrom} // Removed
                        // onDataChange={(data) => handleFormDataChange('shipFrom', data)} // Removed
                        onNext={handleNext}
                        onPrevious={handlePrevious}
                        apiKey={safeApiKey}
                    />
                );
            case 3:
                return (
                    <ShipTo
                        key="ship-to"
                        // data={formData.shipTo} // Removed
                        // onDataChange={(data) => handleFormDataChange('shipTo', data)} // Removed
                        onNext={handleNext}
                        onPrevious={handlePrevious}
                        apiKey={safeApiKey}
                    />
                );
            case 4:
                return (
                    <Packages
                        key="packages"
                        // data={formData.packages} // Removed
                        // onDataChange={(data) => handleFormDataChange('packages', data)} // Removed
                        onNext={handleNext}
                        onPrevious={handlePrevious}
                        apiKey={safeApiKey}
                    />
                );
            case 5:
                // Rates component needs the full formData to fetch rates
                // but will use context to set the selectedRate
                return (
                    <Rates
                        key="rates"
                        formData={formData} // Pass full form data for rate fetching
                        // onRateSelect={handleRateSelect} // Removed - uses context to set rate
                        onNext={handleNext} // Pass navigation handler
                        onPrevious={handlePrevious}
                        apiKey={safeApiKey}
                    />
                );
            case 6:
                // Review reads formData and selectedRate from context
                return (
                    <Review
                        key="review"
                        // formData={formData} // Removed
                        // selectedRate={selectedRate} // Removed
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

// Wrap the main content with the provider
const CreateShipment = () => {
    return (
        <ShipmentFormProvider>
            <CreateShipmentContent />
        </ShipmentFormProvider>
    );
};

export default CreateShipment; 