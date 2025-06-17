import React, { useState, useCallback, useRef } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    Stepper,
    Step,
    StepLabel,
    CircularProgress,
    Alert,
    LinearProgress
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    ArrowForward as ArrowForwardIcon,
    Save as SaveIcon
} from '@mui/icons-material';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useSnackbar } from 'notistack';

// Import step components (to be created)
import CarrierInfoStep from './steps/CarrierInfoStep';
import ConnectionConfigStep from './steps/ConnectionConfigStep';
import ServicesEligibilityStep from './steps/ServicesEligibilityStep';
import RateConfigurationStep from './steps/RateConfigurationStep';

// Import common components
import ModalHeader from '../../common/ModalHeader';

const STEPS = [
    { id: 1, label: 'Carrier Info', component: CarrierInfoStep },
    { id: 2, label: 'Connection Config', component: ConnectionConfigStep },
    { id: 3, label: 'Services & Eligibility', component: ServicesEligibilityStep },
    { id: 4, label: 'Rate Configuration', component: RateConfigurationStep }
];

const initialFormData = {
    // Step 1: Carrier Info
    name: '',
    carrierID: '',
    accountNumber: '',
    type: 'courier',
    logoFileName: '',
    logoURL: '',
    enabled: true,

    // Step 2: Connection Configuration
    connectionType: 'manual',
    apiCredentials: {
        hostURL: '',
        username: '',
        password: '',
        secret: '',
        endpoints: {
            rate: '',
            booking: '',
            tracking: '',
            cancel: '',
            labels: '',
            status: ''
        }
    },
    emailConfiguration: {
        carrierConfirmationEmails: [''],
        carrierNotificationEmails: [''],
        preArrivalNotificationEmails: [''],
        rateRequestEmails: [''],
        billingEmails: ['']
    },

    // Step 3: Services & Eligibility
    supportedServices: {
        courier: [],
        freight: []
    },
    eligibilityRules: {
        domesticCountry: 'CA',
        weightRanges: [],
        dimensionRestrictions: [], // [{ maxLength: 100, maxWidth: 100, maxHeight: 100, unit: 'in' }]
        geographicRouting: {
            provinceToProvince: false,
            stateToState: false,
            provinceToState: false,
            cityToCity: false,
            provinceProvinceRouting: [], // [{ from: 'ON', to: 'BC' }, { from: 'AB', to: 'QC' }]
            stateStateRouting: [], // [{ from: 'NY', to: 'CA' }, { from: 'TX', to: 'FL' }]
            provinceStateRouting: [], // [{ from: 'ON', to: 'NY' }, { from: 'BC', to: 'CA' }]
            cityPairRouting: [] // [{ from: 'Toronto, ON', to: 'New York, NY' }]
        }
    },

    // Step 4: Rate Configuration
    rateConfiguration: {
        enabled: false,
        currency: 'CAD',
        rateType: 'pound', // 'pound' or 'skid'
        rateStructure: 'flat', // 'flat' or 'freight_lanes'

        // Flat Rates
        flatRates: {
            poundRate: {
                perPoundRate: 0,
                minimumCharge: 0
            },
            skidRate: {
                skidPricing: Array.from({ length: 26 }, (_, i) => ({
                    skidCount: i + 1,
                    rate: 0
                }))
            }
        },

        // Freight Lanes (Multiple Route Types)
        freightLanes: [], // Array of { routeType, origin, destination, country, rateType, poundRate, skidRate }

        // Legacy fields for backward compatibility
        rateMatrix: [],
        rmpBase: '',
        ltlThreshold: 15
    }
};

const AddCarrier = ({ isModal = false, onClose = null, onCarrierCreated = null }) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState(initialFormData);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const scrollContainerRef = useRef(null);

    const { currentUser } = useAuth();
    const { enqueueSnackbar } = useSnackbar();

    // Form data update handler
    const updateFormData = useCallback((stepData) => {
        setFormData(prev => {
            const newData = { ...prev, ...stepData };

            // If carrier type changed, set appropriate service defaults
            if (stepData.type && stepData.type !== prev.type) {
                const newSupportedServices = { ...newData.supportedServices };

                if (stepData.type === 'courier') {
                    newSupportedServices.courier = newSupportedServices.courier.length > 0 ? newSupportedServices.courier : [];
                    newSupportedServices.freight = [];
                } else if (stepData.type === 'freight') {
                    newSupportedServices.courier = [];
                    newSupportedServices.freight = newSupportedServices.freight.length > 0 ? newSupportedServices.freight : [];
                } else if (stepData.type === 'hybrid') {
                    newSupportedServices.courier = newSupportedServices.courier.length > 0 ? newSupportedServices.courier : [];
                    newSupportedServices.freight = newSupportedServices.freight.length > 0 ? newSupportedServices.freight : [];
                }

                newData.supportedServices = newSupportedServices;
            }

            return newData;
        });
    }, []);

    // Step validation
    const validateStep = useCallback((step) => {
        const stepErrors = {};

        switch (step) {
            case 1:
                if (!formData.name.trim()) stepErrors.name = 'Carrier name is required';
                if (!formData.carrierID.trim()) stepErrors.carrierID = 'Carrier ID is required';
                if (!formData.type) stepErrors.type = 'Carrier type is required';
                break;
            case 2:
                if (formData.connectionType === 'api') {
                    if (!formData.apiCredentials.hostURL.trim()) {
                        stepErrors.hostURL = 'Host URL is required for API connections';
                    }
                } else if (formData.connectionType === 'manual') {
                    const requiredEmails = formData.emailConfiguration.carrierConfirmationEmails.filter(email => email.trim());
                    if (requiredEmails.length === 0) {
                        stepErrors.carrierConfirmationEmails = 'At least one carrier confirmation email is required';
                    }
                }
                break;
            case 3:
                // Services validation based on carrier type
                const carrierType = formData.type;
                const courierServices = formData.supportedServices.courier.length > 0;
                const freightServices = formData.supportedServices.freight.length > 0;

                if (carrierType === 'courier' && !courierServices) {
                    stepErrors.services = 'At least one courier service must be selected for courier carriers';
                } else if (carrierType === 'freight' && !freightServices) {
                    stepErrors.services = 'At least one freight service must be selected for freight carriers';
                } else if (carrierType === 'hybrid' && !courierServices && !freightServices) {
                    stepErrors.services = 'At least one service type must be selected for hybrid carriers';
                }
                break;
            case 4:
                // Rate configuration validation (only for manual carriers)
                if (formData.connectionType === 'manual' && formData.rateConfiguration?.enabled) {
                    if (!formData.rateConfiguration.rateMatrix || formData.rateConfiguration.rateMatrix.length === 0) {
                        stepErrors.rateMatrix = 'Rate matrix is required when rate configuration is enabled';
                    }
                    // Validate Rate Per Mile
                    const rmpBase = parseFloat(formData.rateConfiguration.rmpBase);
                    if (!formData.rateConfiguration.rmpBase || isNaN(rmpBase) || rmpBase <= 0) {
                        stepErrors.rmpBase = 'Rate Per Mile must be greater than 0';
                    }
                }
                // No validation needed for API carriers - they get rates from API
                break;
        }

        setErrors(stepErrors);
        return Object.keys(stepErrors).length === 0;
    }, [formData]);

    // Navigation handlers
    const handleNext = useCallback(() => {
        if (validateStep(currentStep)) {
            setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
            // Scroll to top of the modal content
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    }, [currentStep, validateStep]);

    const handlePrevious = useCallback(() => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
        // Scroll to top of the modal content
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }, []);

    const handleStepClick = useCallback((step) => {
        // Allow navigation to completed steps or next step
        if (step <= currentStep || validateStep(currentStep)) {
            setCurrentStep(step);
            // Scroll to top of the modal content
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }
    }, [currentStep, validateStep]);

    // Save carrier
    const handleSave = useCallback(async () => {
        if (!validateStep(currentStep)) return;

        setSaving(true);
        try {
            const carrierData = {
                ...formData,
                carrierID: formData.carrierID.toUpperCase(),
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                createdBy: currentUser?.uid,
                status: 'active'
            };

            const docRef = await addDoc(collection(db, 'carriers'), carrierData);

            enqueueSnackbar('Carrier created successfully', { variant: 'success' });

            if (onCarrierCreated) {
                onCarrierCreated(docRef.id, carrierData);
            }

            if (onClose) {
                onClose();
            }
        } catch (error) {
            console.error('Error creating carrier:', error);
            enqueueSnackbar('Failed to create carrier', { variant: 'error' });
        } finally {
            setSaving(false);
        }
    }, [currentStep, validateStep, formData, currentUser, onCarrierCreated, onClose, enqueueSnackbar]);

    // Render current step
    const renderCurrentStep = () => {
        const StepComponent = STEPS[currentStep - 1].component;
        return (
            <StepComponent
                data={formData}
                onUpdate={updateFormData}
                errors={errors}
                setErrors={setErrors}
            />
        );
    };

    const progress = (currentStep / STEPS.length) * 100;

    return (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {isModal && (
                <ModalHeader
                    title="Add New Carrier"
                    onClose={onClose}
                    showCloseButton={true}
                />
            )}

            <Box ref={scrollContainerRef} sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                <Paper sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
                    {/* Progress bar */}
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="h6" sx={{ mb: 2, fontSize: '18px' }}>
                            Step {currentStep} of {STEPS.length}: {STEPS[currentStep - 1].label}
                        </Typography>
                        <LinearProgress
                            variant="determinate"
                            value={progress}
                            sx={{ height: 6, borderRadius: 3, mb: 2 }}
                        />
                    </Box>

                    {/* Stepper */}
                    <Stepper activeStep={currentStep - 1} sx={{ mb: 4 }}>
                        {STEPS.map((step, index) => (
                            <Step
                                key={step.id}
                                onClick={() => handleStepClick(step.id)}
                                sx={{ cursor: 'pointer' }}
                            >
                                <StepLabel>
                                    <Typography sx={{ fontSize: '12px' }}>
                                        {step.label}
                                    </Typography>
                                </StepLabel>
                            </Step>
                        ))}
                    </Stepper>

                    {/* Current step content */}
                    <Box sx={{ minHeight: 400 }}>
                        {loading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                                <CircularProgress />
                            </Box>
                        ) : (
                            renderCurrentStep()
                        )}
                    </Box>

                    {/* Navigation buttons */}
                    <Box sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        mt: 4,
                        pt: 2,
                        borderTop: '1px solid #e5e7eb'
                    }}>
                        <Button
                            startIcon={<ArrowBackIcon />}
                            onClick={handlePrevious}
                            disabled={currentStep === 1 || saving}
                            sx={{ fontSize: '12px' }}
                        >
                            Previous
                        </Button>

                        <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                            Step {currentStep} of {STEPS.length}
                        </Typography>

                        {currentStep < STEPS.length ? (
                            <Button
                                endIcon={<ArrowForwardIcon />}
                                variant="contained"
                                onClick={handleNext}
                                disabled={saving}
                                sx={{ fontSize: '12px' }}
                            >
                                Next
                            </Button>
                        ) : (
                            <Button
                                startIcon={<SaveIcon />}
                                variant="contained"
                                onClick={handleSave}
                                disabled={saving}
                                sx={{ fontSize: '12px' }}
                            >
                                {saving ? 'Creating...' : 'Create Carrier'}
                            </Button>
                        )}
                    </Box>
                </Paper>
            </Box>
        </Box>
    );
};

export default AddCarrier; 