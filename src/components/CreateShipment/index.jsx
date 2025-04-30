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

                // Log available function names and verify the function exists
                console.log('DEBUGGING FUNCTIONS:', {
                    functions: functions,
                    regionUrl: functions.region ? functions.region.url : 'not available'
                });

                // Try multiple possible function names for origins
                let getCompanyShipmentOriginsFunction;

                try {
                    // First check if the function exists with standard name
                    getCompanyShipmentOriginsFunction = httpsCallable(functions, 'getCompanyShipmentOrigins');
                    console.log('Standard function name appears to be valid');
                } catch (fnErr) {
                    console.error('Error getting standard function reference:', fnErr);
                    try {
                        // Try alternate name (lowercase)
                        getCompanyShipmentOriginsFunction = httpsCallable(functions, 'getcompanyshipmentorigins');
                        console.log('Lowercase function name appears to be valid');
                    } catch (fnErr2) {
                        console.error('Error getting lowercase function reference:', fnErr2);
                        // Fall back to the original function name even if it failed
                        getCompanyShipmentOriginsFunction = httpsCallable(functions, 'getCompanyShipmentOrigins');
                    }
                }

                // Fetch basic company data (e.g., for header display)
                try {
                    const companyResult = await getCompanyFunction({ companyId });
                    console.log('Raw companyResult:', JSON.stringify(companyResult));

                    let companyData = null;
                    let shipFromAddresses = [];

                    if (companyResult.data && companyResult.data.success && companyResult.data.data) {
                        // New structure: { data: { success: true, data: {...} } }
                        console.log("Using new response structure for company data");
                        companyData = companyResult.data.data;

                        // Extract shipFromAddresses directly from the company data
                        shipFromAddresses = companyData.shipFromAddresses || [];
                        console.log(`Found ${shipFromAddresses.length} ship from addresses directly in company data`);

                    } else if (companyResult.data && companyResult.data.name) {
                        // Alternative structure: { data: {...} }
                        console.log("Using alternative response structure for company data");
                        companyData = companyResult.data;
                        shipFromAddresses = companyData.shipFromAddresses || [];
                    } else if (companyResult.success && companyResult.data) {
                        // Old structure: { success: true, data: {...} }
                        console.log("Using old response structure for company data");
                        companyData = companyResult.data;
                        shipFromAddresses = companyData.shipFromAddresses || [];
                    } else {
                        console.warn('Could not parse company details:', companyResult);
                    }

                    if (companyData) {
                        setCompanyData(companyData);
                        console.log('Basic company data retrieved successfully:', companyData);

                        // Process the shipFromAddresses directly
                        console.log('Ship From Addresses count:', shipFromAddresses.length);

                        // --- 4. Determine Default Address & Prepare Context Update ---
                        let finalShipFromData = {
                            company: companyData.name || '',
                            shipFromAddresses: shipFromAddresses,
                            id: null,
                            name: '', attention: '', street: '', street2: '', city: '',
                            state: '', postalCode: '', country: 'US', contactName: '',
                            contactPhone: '', contactEmail: '', specialInstructions: ''
                        };

                        if (shipFromAddresses.length > 0) {
                            const defaultAddress = shipFromAddresses.find(addr => addr.isDefault);
                            if (defaultAddress) {
                                console.log("Default Ship From address found:", defaultAddress);
                                finalShipFromData = {
                                    ...finalShipFromData,
                                    ...defaultAddress,
                                    id: defaultAddress.id
                                };
                            } else {
                                console.log("No default Ship From address found.");
                                // Select first address if no default is marked
                                finalShipFromData = {
                                    ...finalShipFromData,
                                    ...shipFromAddresses[0],
                                    id: shipFromAddresses[0].id
                                };
                                console.log("Selected first address as default:", shipFromAddresses[0]);
                            }
                        } else {
                            console.warn("NO ADDRESSES FOUND IN RESPONSE");
                        }

                        // --- 5. Update Context ONCE ---
                        console.log("Updating context with final shipFrom data:", finalShipFromData);
                        updateFormSection('shipFrom', finalShipFromData);
                    }
                } catch (companyErr) {
                    console.warn('Error fetching basic company details:', companyErr);
                    setError(`Failed to load company data: ${companyErr.message}`);
                }

                // SKIP separate origins fetch - we already have the data from getCompany!
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