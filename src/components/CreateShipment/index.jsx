import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useAuth } from '../../contexts/AuthContext';
import { useCompany } from '../../contexts/CompanyContext';
import { ShipmentFormProvider, useShipmentForm } from '../../contexts/ShipmentFormContext';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../../firebase';
import StepperComponent from './Stepper';
import ShipmentInfo from './ShipmentInfo';
import ShipFrom from './ShipFrom';
import ShipTo from './ShipTo';
import Packages from './Packages';
import Rates from './Rates';
import Review from './Review';
import './CreateShipment.css';
import { Paper, Box, Typography, Button } from '@mui/material';
import ShipmentAgent from '../ShipmentAgent/ShipmentAgent';

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
    const { companyData, companyIdForAddress, loading: companyLoading, error: companyError } = useCompany();

    // Use context state
    const { formData, updateFormSection } = useShipmentForm();
    const [currentStep, setCurrentStep] = useState(urlStep ? STEPS[urlStep] || 1 : 1);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isChatOpen, setIsChatOpen] = useState(false);
    const hasLogged = useRef(false);
    const isNavigating = useRef(false);

    // Fetch shipping origin addresses from addressBook when companyData is available
    useEffect(() => {
        const fetchShipFromAddresses = async () => {
            if (companyLoading || !companyData || !companyIdForAddress) {
                return;
            }

            // Check if we already have shipFrom addresses in form context
            if (formData.shipFrom?.shipFromAddresses?.length > 0) {
                console.log("CreateShipment: ShipFrom addresses already loaded in context");
                return;
            }

            setIsLoading(true);
            setError(null);

            try {
                console.log(`CreateShipment: Fetching addresses from addressBook for company ID: ${companyIdForAddress}`);

                // Query the addressBook collection for origin addresses
                const addressesQuery = query(
                    collection(db, 'addressBook'),
                    where('addressClass', '==', 'company'),
                    where('addressType', '==', 'origin'),
                    where('addressClassID', '==', companyIdForAddress)
                );

                const addressesSnapshot = await getDocs(addressesQuery);

                let shipFromAddresses = [];
                if (!addressesSnapshot.empty) {
                    shipFromAddresses = addressesSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                    console.log(`CreateShipment: Found ${shipFromAddresses.length} shipping origin addresses:`, shipFromAddresses);
                } else {
                    console.log("CreateShipment: No shipping origin addresses found in addressBook");
                }

                // Format addresses for form context with both new and old field formats
                const formattedAddresses = shipFromAddresses.map(addr => ({
                    id: addr.id,
                    // New address format fields
                    nickname: addr.nickname,
                    companyName: addr.companyName,
                    address1: addr.address1,
                    address2: addr.address2 || '',
                    city: addr.city,
                    stateProv: addr.stateProv,
                    zipPostal: addr.zipPostal,
                    country: addr.country,
                    firstName: addr.firstName,
                    lastName: addr.lastName,
                    phone: addr.phone,
                    email: addr.email,
                    isDefault: addr.isDefault,

                    // Legacy format fields for backward compatibility
                    name: addr.nickname,
                    company: addr.companyName,
                    attention: `${addr.firstName} ${addr.lastName}`.trim(),
                    street: addr.address1,
                    street2: addr.address2 || '',
                    state: addr.stateProv,
                    postalCode: addr.zipPostal,
                    contactName: `${addr.firstName} ${addr.lastName}`.trim(),
                    contactPhone: addr.phone,
                    contactEmail: addr.email
                }));

                // Prepare data for form context update
                let finalShipFromData = {
                    company: companyData.name || '',
                    shipFromAddresses: formattedAddresses,
                    id: null,
                    // Initialize with empty values
                    name: '', attention: '', street: '', street2: '', city: '',
                    state: '', postalCode: '', country: 'US', contactName: '',
                    contactPhone: '', contactEmail: '', specialInstructions: '',
                    // New format fields
                    nickname: '', companyName: '', address1: '', address2: '',
                    stateProv: '', zipPostal: '', firstName: '', lastName: '',
                    phone: '', email: ''
                };

                if (formattedAddresses.length > 0) {
                    // Find default address or use first one
                    const defaultAddress = formattedAddresses.find(addr => addr.isDefault) || formattedAddresses[0];
                    console.log("CreateShipment: Selected address for shipFrom:", defaultAddress);

                    finalShipFromData = {
                        ...finalShipFromData,
                        ...defaultAddress,
                        id: defaultAddress.id
                    };
                }

                // Update context
                console.log("CreateShipment: Updating context with shipFrom data:", finalShipFromData);
                updateFormSection('shipFrom', finalShipFromData);

            } catch (err) {
                console.error('Error fetching addresses:', err);
                setError(err.message || 'Failed to load shipping addresses.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchShipFromAddresses();
    }, [companyData, companyIdForAddress, companyLoading, formData.shipFrom?.shipFromAddresses, updateFormSection]);

    // Set error from company context
    useEffect(() => {
        if (companyError) {
            setError(companyError);
        }
    }, [companyError]);

    // For debugging, log when addresses are added to the form context
    useEffect(() => {
        if (formData.shipFrom?.shipFromAddresses) {
            console.log(`Form context updated with ${formData.shipFrom.shipFromAddresses.length} shipping addresses`);
        }
    }, [formData.shipFrom?.shipFromAddresses]);

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

    const handleSubmit = (e) => {
        if (e) e.preventDefault();
        // Handle final submission - potentially call context.completeShipment()
        console.log('Final form data from context:', formData);
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
                        onNext={handleNext}
                        apiKey={safeApiKey}
                    />
                );
            case 2:
                return (
                    <ShipFrom
                        key="ship-from"
                        onNext={handleNext}
                        onPrevious={handlePrevious}
                        apiKey={safeApiKey}
                    />
                );
            case 3:
                return (
                    <ShipTo
                        key="ship-to"
                        onNext={handleNext}
                        onPrevious={handlePrevious}
                        apiKey={safeApiKey}
                    />
                );
            case 4:
                return (
                    <Packages
                        key="packages"
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
        <div className="container-fluid" style={{ position: 'relative' }}>
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

                        {isLoading || companyLoading ? (
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

            {/* Render ShipmentAgent directly in page instead of in a modal */}
            {companyData?.id && <ShipmentAgent
                companyId={companyData?.id}
                inModal={false}
                isPanelOpen={isChatOpen}
                setIsPanelOpen={setIsChatOpen}
            />}
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