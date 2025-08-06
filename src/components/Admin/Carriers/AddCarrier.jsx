import React, { useState, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    CircularProgress,
    Alert,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Chip
} from '@mui/material';
import {
    Save as SaveIcon,
    ExpandMore as ExpandMoreIcon,
    Check as CheckIcon,
    Warning as WarningIcon
} from '@mui/icons-material';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useSnackbar } from 'notistack';

// Import step components (now used as sections)
import CarrierInfoStep from './steps/CarrierInfoStep';
import ConnectionConfigStep from './steps/ConnectionConfigStep';
import ServicesEligibilityStep from './steps/ServicesEligibilityStep';
import RateConfigurationStep from './steps/RateConfigurationStep';

// Import common components
import ModalHeader from '../../common/ModalHeader';
import AdminBreadcrumb from '../AdminBreadcrumb';

const SECTIONS = [
    {
        id: 'carrierInfo',
        label: 'Carrier Information',
        component: CarrierInfoStep,
        icon: '📋',
        description: 'Basic carrier details and logo'
    },
    {
        id: 'connectionConfig',
        label: 'Connection Configuration',
        component: ConnectionConfigStep,
        icon: '🔌',
        description: 'API credentials and email settings'
    },
    {
        id: 'servicesEligibility',
        label: 'Services & Eligibility',
        component: ServicesEligibilityStep,
        icon: '⚙️',
        description: 'Geographic routing and service options'
    },
    {
        id: 'rateConfiguration',
        label: 'Rate Configuration',
        component: RateConfigurationStep,
        icon: '💰',
        description: 'Pricing structure and rate matrix'
    }
];

const initialFormData = {
    // Carrier Info
    name: '',
    carrierID: '',
    accountNumber: '',
    type: 'courier',
    logoFileName: '',
    logoURL: '',
    enabled: true,

    // Connection Configuration
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

    // Services & Eligibility
    supportedServices: {
        courier: [],
        freight: []
    },
    availableAdditionalServices: {
        enabled: false,
        courier: [],
        freight: []
    },
    eligibilityRules: {
        domesticCountry: 'CA',
        weightRanges: [],
        dimensionRestrictions: [],
        packageTypeRestrictions: [],
        geographicRouting: {
            domesticCanada: false,
            domesticUS: false,
            provinceToProvince: false,
            stateToState: false,
            provinceToState: false,
            countryToCountry: false,
            cityToCity: false,
            provinceProvinceRouting: [],
            stateStateRouting: [],
            provinceStateRouting: [],
            countryCountryRouting: [],
            cityPairRouting: []
        }
    },

    // Rate Configuration
    rateConfiguration: {
        enabled: false,
        currency: 'CAD',
        rateType: 'pound',
        rateStructure: 'flat',

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

        freightLanes: [],
        rateMatrix: [],
        rmpBase: '',
        ltlThreshold: 15
    }
};

const AddCarrier = ({ isModal = false, onClose = null, onCarrierCreated = null }) => {
    const [formData, setFormData] = useState(initialFormData);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [expandedSections, setExpandedSections] = useState({
        carrierInfo: true, // Start with first section expanded
        connectionConfig: false,
        servicesEligibility: false,
        rateConfiguration: false
    });

    const { currentUser } = useAuth();
    const { enqueueSnackbar } = useSnackbar();

    // Form data update handler
    const updateFormData = useCallback((stepData) => {
        setFormData(prev => {
            const newData = { ...prev, ...stepData };

            // If carrier type changed, set appropriate service defaults
            if (stepData.type && stepData.type !== prev.type) {
                const newSupportedServices = { ...newData.supportedServices };
                const newAvailableAdditionalServices = { ...newData.availableAdditionalServices };

                if (stepData.type === 'courier') {
                    newSupportedServices.courier = newSupportedServices.courier.length > 0 ? newSupportedServices.courier : [];
                    newSupportedServices.freight = [];
                    newAvailableAdditionalServices.courier = newAvailableAdditionalServices.courier.length > 0 ? newAvailableAdditionalServices.courier : [];
                    newAvailableAdditionalServices.freight = [];
                } else if (stepData.type === 'freight') {
                    newSupportedServices.courier = [];
                    newSupportedServices.freight = newSupportedServices.freight.length > 0 ? newSupportedServices.freight : [];
                    newAvailableAdditionalServices.courier = [];
                    newAvailableAdditionalServices.freight = newAvailableAdditionalServices.freight.length > 0 ? newAvailableAdditionalServices.freight : [];
                } else if (stepData.type === 'hybrid') {
                    newSupportedServices.courier = newSupportedServices.courier.length > 0 ? newSupportedServices.courier : [];
                    newSupportedServices.freight = newSupportedServices.freight.length > 0 ? newSupportedServices.freight : [];
                    newAvailableAdditionalServices.courier = newAvailableAdditionalServices.courier.length > 0 ? newAvailableAdditionalServices.courier : [];
                    newAvailableAdditionalServices.freight = newAvailableAdditionalServices.freight.length > 0 ? newAvailableAdditionalServices.freight : [];
                }

                newData.supportedServices = newSupportedServices;
                newData.availableAdditionalServices = newAvailableAdditionalServices;
            }

            return newData;
        });
    }, []);

    // Section validation
    const validateSection = useCallback((sectionId) => {
        const sectionErrors = {};

        switch (sectionId) {
            case 'carrierInfo':
                if (!formData.name.trim()) sectionErrors.name = 'Carrier name is required';
                if (!formData.carrierID.trim()) sectionErrors.carrierID = 'Carrier ID is required';
                if (!formData.type) sectionErrors.type = 'Carrier type is required';
                break;
            case 'connectionConfig':
                const requiredEmails = formData.emailConfiguration.carrierConfirmationEmails.filter(email => email.trim());
                if (requiredEmails.length === 0) {
                    sectionErrors.carrierConfirmationEmails = 'At least one carrier confirmation email is required';
                }
                if (formData.connectionType === 'api') {
                    if (!formData.apiCredentials.hostURL.trim()) {
                        sectionErrors.hostURL = 'Host URL is required for API connections';
                    }
                }
                break;
            case 'servicesEligibility':
                const carrierType = formData.type;
                const courierServices = formData.supportedServices.courier.length > 0;
                const freightServices = formData.supportedServices.freight.length > 0;

                if (carrierType === 'courier' && !courierServices) {
                    sectionErrors.services = 'At least one courier service must be selected for courier carriers';
                } else if (carrierType === 'freight' && !freightServices) {
                    sectionErrors.services = 'At least one freight service must be selected for freight carriers';
                } else if (carrierType === 'hybrid' && !courierServices && !freightServices) {
                    sectionErrors.services = 'At least one service type must be selected for hybrid carriers';
                }
                break;
            case 'rateConfiguration':
                if (formData.connectionType === 'manual' && formData.rateConfiguration?.enabled) {
                    if (!formData.rateConfiguration.rateMatrix || formData.rateConfiguration.rateMatrix.length === 0) {
                        sectionErrors.rateMatrix = 'Rate matrix is required when rate configuration is enabled';
                    }
                    const rmpBase = parseFloat(formData.rateConfiguration.rmpBase);
                    if (!formData.rateConfiguration.rmpBase || isNaN(rmpBase) || rmpBase <= 0) {
                        sectionErrors.rmpBase = 'Rate Per Mile must be greater than 0';
                    }
                }
                break;
        }

        return {
            isValid: Object.keys(sectionErrors).length === 0,
            errors: sectionErrors
        };
    }, [formData]);

    // Get section status for visual indicators
    const getSectionStatus = useCallback((sectionId) => {
        const validation = validateSection(sectionId);
        return validation.isValid ? 'valid' : 'invalid';
    }, [validateSection]);

    // Handle section toggle
    const handleSectionToggle = (sectionId) => {
        setExpandedSections(prev => ({
            ...prev,
            [sectionId]: !prev[sectionId]
        }));
    };

    // Save carrier
    const handleSave = useCallback(async () => {
        // Validate all sections
        const allSectionErrors = {};
        let hasErrors = false;

        SECTIONS.forEach(section => {
            const validation = validateSection(section.id);
            if (!validation.isValid) {
                Object.assign(allSectionErrors, validation.errors);
                hasErrors = true;
            }
        });

        if (hasErrors) {
            setErrors(allSectionErrors);
            enqueueSnackbar('Please fix the errors before saving', { variant: 'error' });
            return;
        }

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
    }, [formData, validateSection, currentUser, onCarrierCreated, onClose, enqueueSnackbar]);

    return (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {isModal ? (
                <ModalHeader
                    title="Add New Carrier"
                    onClose={onClose}
                    showCloseButton={true}
                />
            ) : (
                // Admin page header for standalone mode
                <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                    <AdminBreadcrumb currentPage="Add Carrier" />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, mt: 3 }}>
                        <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827' }}>
                            Add New Carrier
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                variant="outlined"
                                onClick={onClose}
                                disabled={saving}
                                size="small"
                                sx={{ fontSize: '12px' }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleSave}
                                disabled={saving}
                                startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                                size="small"
                                sx={{ fontSize: '12px' }}
                            >
                                {saving ? 'Creating...' : 'Create Carrier'}
                            </Button>
                        </Box>
                    </Box>
                </Box>
            )}

            {/* Content Area - Full Width Layout */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 4, bgcolor: '#fafafa' }}>
                <Box sx={{ width: '100%' }}>
                    {/* Section Accordions */}
                    {SECTIONS.map((section) => {
                        const SectionComponent = section.component;
                        const sectionStatus = getSectionStatus(section.id);

                        return (
                            <Accordion
                                key={section.id}
                                expanded={expandedSections[section.id]}
                                onChange={() => handleSectionToggle(section.id)}
                                sx={{
                                    mb: 2,
                                    border: '1px solid #e5e7eb',
                                    borderRadius: '8px !important',
                                    '&:before': {
                                        display: 'none',
                                    },
                                    boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)',
                                }}
                            >
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                    sx={{
                                        bgcolor: '#f8fafc',
                                        borderRadius: '8px 8px 0 0',
                                        '&.Mui-expanded': {
                                            borderRadius: expandedSections[section.id] ? '8px 8px 0 0' : '8px',
                                        },
                                        minHeight: 64,
                                        '& .MuiAccordionSummary-content': {
                                            alignItems: 'center',
                                            gap: 2
                                        }
                                    }}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                                        <Typography sx={{ fontSize: '20px' }}>
                                            {section.icon}
                                        </Typography>
                                        <Box sx={{ flex: 1 }}>
                                            <Typography sx={{ fontSize: '16px', fontWeight: 600, color: '#374151' }}>
                                                {section.label}
                                            </Typography>
                                            <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                                                {section.description}
                                            </Typography>
                                        </Box>
                                        <Chip
                                            icon={sectionStatus === 'valid' ? <CheckIcon /> : <WarningIcon />}
                                            label={sectionStatus === 'valid' ? 'Valid' : 'Needs Attention'}
                                            size="small"
                                            color={sectionStatus === 'valid' ? 'success' : 'warning'}
                                            sx={{ fontSize: '11px' }}
                                        />
                                    </Box>
                                </AccordionSummary>
                                <AccordionDetails sx={{ p: 3, bgcolor: 'white' }}>
                                    <SectionComponent
                                        data={formData}
                                        onUpdate={updateFormData}
                                        errors={errors}
                                        setErrors={setErrors}
                                        isEdit={false}
                                    />
                                </AccordionDetails>
                            </Accordion>
                        );
                    })}

                    {/* Action Buttons for Modal Mode */}
                    {isModal && (
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3, pt: 3, borderTop: '1px solid #e5e7eb' }}>
                            <Button
                                variant="outlined"
                                onClick={onClose}
                                disabled={saving}
                                sx={{ fontSize: '12px' }}
                            >
                                Cancel
                            </Button>
                            <Button
                                variant="contained"
                                onClick={handleSave}
                                disabled={saving}
                                startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
                                sx={{ fontSize: '12px' }}
                            >
                                {saving ? 'Creating...' : 'Create Carrier'}
                            </Button>
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
};

export default AddCarrier; 