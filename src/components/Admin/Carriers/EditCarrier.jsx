import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
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

const EditCarrier = ({
    carrierId,
    isModal = false,
    onClose = null,
    onCarrierUpdated = null
}) => {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [loadError, setLoadError] = useState(null);
    const scrollContainerRef = useRef(null);

    const { currentUser } = useAuth();
    const { enqueueSnackbar } = useSnackbar();

    // Load carrier data
    useEffect(() => {
        const loadCarrier = async () => {
            if (!carrierId) {
                setLoadError('No carrier ID provided');
                setLoading(false);
                return;
            }

            try {
                const carrierDoc = await getDoc(doc(db, 'carriers', carrierId));

                if (!carrierDoc.exists()) {
                    setLoadError('Carrier not found');
                    setLoading(false);
                    return;
                }

                const carrierData = carrierDoc.data();

                // Ensure all required nested objects exist with proper fallbacks
                const processedData = {
                    name: carrierData.name || '',
                    carrierID: carrierData.carrierID || '',
                    accountNumber: carrierData.accountNumber || '',
                    type: carrierData.type || 'courier',
                    logoFileName: carrierData.logoFileName || '',
                    logoURL: carrierData.logoURL || '',
                    enabled: carrierData.enabled !== undefined ? carrierData.enabled : true,

                    connectionType: carrierData.connectionType || 'manual',

                    apiCredentials: {
                        hostURL: carrierData.apiCredentials?.hostURL || '',
                        username: carrierData.apiCredentials?.username || '',
                        password: carrierData.apiCredentials?.password || '',
                        secret: carrierData.apiCredentials?.secret || '',
                        endpoints: {
                            rate: carrierData.apiCredentials?.endpoints?.rate || '',
                            booking: carrierData.apiCredentials?.endpoints?.booking || '',
                            tracking: carrierData.apiCredentials?.endpoints?.tracking || '',
                            cancel: carrierData.apiCredentials?.endpoints?.cancel || '',
                            labels: carrierData.apiCredentials?.endpoints?.labels || '',
                            status: carrierData.apiCredentials?.endpoints?.status || ''
                        }
                    },

                    emailConfiguration: {
                        carrierConfirmationEmails: carrierData.emailConfiguration?.carrierConfirmationEmails || [''],
                        carrierNotificationEmails: carrierData.emailConfiguration?.carrierNotificationEmails || [''],
                        preArrivalNotificationEmails: carrierData.emailConfiguration?.preArrivalNotificationEmails || [''],
                        rateRequestEmails: carrierData.emailConfiguration?.rateRequestEmails || [''],
                        billingEmails: carrierData.emailConfiguration?.billingEmails || ['']
                    },

                    supportedServices: {
                        courier: carrierData.supportedServices?.courier || [],
                        freight: carrierData.supportedServices?.freight || []
                    },

                    eligibilityRules: {
                        domesticCountry: carrierData.eligibilityRules?.domesticCountry || 'CA',
                        weightRanges: carrierData.eligibilityRules?.weightRanges || [],
                        dimensionRestrictions: carrierData.eligibilityRules?.dimensionRestrictions || [],
                        geographicRouting: {
                            provinceToProvince: carrierData.eligibilityRules?.geographicRouting?.provinceToProvince || false,
                            stateToState: carrierData.eligibilityRules?.geographicRouting?.stateToState || false,
                            provinceToState: carrierData.eligibilityRules?.geographicRouting?.provinceToState || false,
                            cityToCity: carrierData.eligibilityRules?.geographicRouting?.cityToCity || false,
                            provinceProvinceRouting: (() => {
                                // Use existing routing or convert from old supportedProvinces array
                                const existingRouting = carrierData.eligibilityRules?.geographicRouting?.provinceProvinceRouting;
                                if (existingRouting && existingRouting.length > 0) {
                                    return existingRouting;
                                }

                                // Backward compatibility: convert old supportedProvinces to pair routing (empty pairs)
                                const oldProvinces = carrierData.eligibilityRules?.geographicRouting?.supportedProvinces;
                                if (oldProvinces && oldProvinces.length > 0) {
                                    // Can't automatically create pairs, so return empty array for user to configure
                                    return [];
                                }

                                return [];
                            })(),
                            stateStateRouting: (() => {
                                // Use existing routing or convert from old supportedStates array
                                const existingRouting = carrierData.eligibilityRules?.geographicRouting?.stateStateRouting;
                                if (existingRouting && existingRouting.length > 0) {
                                    return existingRouting;
                                }

                                // Backward compatibility: convert old supportedStates to pair routing (empty pairs)
                                const oldStates = carrierData.eligibilityRules?.geographicRouting?.supportedStates;
                                if (oldStates && oldStates.length > 0) {
                                    // Can't automatically create pairs, so return empty array for user to configure
                                    return [];
                                }

                                return [];
                            })(),
                            provinceStateRouting: (() => {
                                // Handle backward compatibility: convert old provinceStateMapping to new provinceStateRouting
                                const existingRouting = carrierData.eligibilityRules?.geographicRouting?.provinceStateRouting;
                                if (existingRouting && existingRouting.length > 0) {
                                    return existingRouting;
                                }

                                // Convert old mapping format to new routing format
                                const oldMapping = carrierData.eligibilityRules?.geographicRouting?.provinceStateMapping;
                                if (oldMapping && Object.keys(oldMapping).length > 0) {
                                    const routes = [];
                                    Object.entries(oldMapping).forEach(([province, states]) => {
                                        if (Array.isArray(states)) {
                                            states.forEach(state => {
                                                routes.push({ from: province, to: state });
                                            });
                                        }
                                    });
                                    return routes;
                                }

                                return [];
                            })(),
                            cityPairRouting: carrierData.eligibilityRules?.geographicRouting?.cityPairRouting || []
                        }
                    },

                    rateConfiguration: {
                        enabled: carrierData.rateConfiguration?.enabled || false,
                        currency: carrierData.rateConfiguration?.currency || 'CAD',
                        rateType: carrierData.rateConfiguration?.rateType || 'pound',
                        rateStructure: carrierData.rateConfiguration?.rateStructure || 'flat',

                        // Flat Rates
                        flatRates: {
                            poundRate: {
                                perPoundRate: carrierData.rateConfiguration?.flatRates?.poundRate?.perPoundRate || 0,
                                minimumCharge: carrierData.rateConfiguration?.flatRates?.poundRate?.minimumCharge || 0
                            },
                            skidRate: {
                                skidPricing: carrierData.rateConfiguration?.flatRates?.skidRate?.skidPricing ||
                                    Array.from({ length: 26 }, (_, i) => ({
                                        skidCount: i + 1,
                                        rate: 0
                                    }))
                            }
                        },

                        // Freight Lanes (Multiple Route Types)
                        freightLanes: carrierData.rateConfiguration?.freightLanes || [], // Array of { routeType, origin, destination, country, rateType, poundRate, skidRate }

                        // Legacy fields for backward compatibility
                        rateMatrix: carrierData.rateConfiguration?.rateMatrix || [],
                        rmpBase: carrierData.rateConfiguration?.rmpBase === 0 ? '' : (carrierData.rateConfiguration?.rmpBase || ''),
                        ltlThreshold: carrierData.rateConfiguration?.ltlThreshold || 15
                    }
                };

                setFormData(processedData);
            } catch (error) {
                console.error('Error loading carrier:', error);
                setLoadError('Failed to load carrier data');
            } finally {
                setLoading(false);
            }
        };

        loadCarrier();
    }, [carrierId]);

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
        if (!formData) return false;

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
        if (!validateStep(currentStep) || !formData) return;

        setSaving(true);
        try {
            const updateData = {
                ...formData,
                carrierID: formData.carrierID.toUpperCase(),
                updatedAt: serverTimestamp(),
                updatedBy: currentUser?.uid
            };

            await updateDoc(doc(db, 'carriers', carrierId), updateData);

            enqueueSnackbar('Carrier updated successfully', { variant: 'success' });

            if (onCarrierUpdated) {
                onCarrierUpdated(carrierId, updateData);
            }

            if (onClose) {
                onClose();
            }
        } catch (error) {
            console.error('Error updating carrier:', error);
            enqueueSnackbar('Failed to update carrier', { variant: 'error' });
        } finally {
            setSaving(false);
        }
    }, [currentStep, validateStep, formData, carrierId, currentUser, onCarrierUpdated, onClose, enqueueSnackbar]);

    // Render current step
    const renderCurrentStep = () => {
        if (!formData) return null;

        const StepComponent = STEPS[currentStep - 1].component;
        return (
            <StepComponent
                data={formData}
                onUpdate={updateFormData}
                errors={errors}
                setErrors={setErrors}
                isEdit={true}
            />
        );
    };

    if (loading) {
        return (
            <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                {isModal && (
                    <ModalHeader
                        title="Edit Carrier"
                        onClose={onClose}
                        showCloseButton={true}
                    />
                )}
                <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <CircularProgress />
                </Box>
            </Box>
        );
    }

    if (loadError) {
        return (
            <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                {isModal && (
                    <ModalHeader
                        title="Edit Carrier"
                        onClose={onClose}
                        showCloseButton={true}
                    />
                )}
                <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
                    <Alert severity="error">{loadError}</Alert>
                </Box>
            </Box>
        );
    }

    const progress = (currentStep / STEPS.length) * 100;

    return (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {isModal && (
                <ModalHeader
                    title={`Edit Carrier - ${formData?.name}`}
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
                        {renderCurrentStep()}
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
                                {saving ? 'Updating...' : 'Update Carrier'}
                            </Button>
                        )}
                    </Box>
                </Paper>
            </Box>
        </Box>
    );
};

export default EditCarrier; 