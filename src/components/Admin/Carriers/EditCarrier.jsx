import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Paper,
    Typography,
    Button,
    CircularProgress,
    Alert,
    IconButton,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Chip
} from '@mui/material';
import {
    ArrowBack as ArrowBackIcon,
    Save as SaveIcon,
    ExpandMore as ExpandMoreIcon,
    Check as CheckIcon,
    Warning as WarningIcon
} from '@mui/icons-material';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { useSnackbar } from 'notistack';
import { useParams, useNavigate } from 'react-router-dom';

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

const EditCarrier = ({
    carrierId: propCarrierId = null,
    isModal = false,
    onClose = null,
    onCarrierUpdated = null
}) => {
    // Get carrierId from URL params if not provided as prop
    const { carrierId: urlCarrierId } = useParams();
    const navigate = useNavigate();
    const carrierId = propCarrierId || urlCarrierId;

    const [formData, setFormData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    const [loadError, setLoadError] = useState(null);
    const [expandedSections, setExpandedSections] = useState({
        carrierInfo: true, // Start with first section expanded
        connectionConfig: false,
        servicesEligibility: false,
        rateConfiguration: false
    });

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
                            domesticCanada: carrierData.eligibilityRules?.geographicRouting?.domesticCanada || false,
                            domesticUS: carrierData.eligibilityRules?.geographicRouting?.domesticUS || false,
                            provinceToProvince: carrierData.eligibilityRules?.geographicRouting?.provinceToProvince || false,
                            stateToState: carrierData.eligibilityRules?.geographicRouting?.stateToState || false,
                            provinceToState: carrierData.eligibilityRules?.geographicRouting?.provinceToState || false,
                            countryToCountry: carrierData.eligibilityRules?.geographicRouting?.countryToCountry || false,
                            cityToCity: carrierData.eligibilityRules?.geographicRouting?.cityToCity || false,
                            provinceProvinceRouting: (() => {
                                const existingRouting = carrierData.eligibilityRules?.geographicRouting?.provinceProvinceRouting;
                                if (existingRouting && existingRouting.length > 0) {
                                    return existingRouting;
                                }
                                const oldProvinces = carrierData.eligibilityRules?.geographicRouting?.supportedProvinces;
                                if (oldProvinces && oldProvinces.length > 0) {
                                    return [];
                                }
                                return [];
                            })(),
                            stateStateRouting: (() => {
                                const existingRouting = carrierData.eligibilityRules?.geographicRouting?.stateStateRouting;
                                if (existingRouting && existingRouting.length > 0) {
                                    return existingRouting;
                                }
                                const oldStates = carrierData.eligibilityRules?.geographicRouting?.supportedStates;
                                if (oldStates && oldStates.length > 0) {
                                    return [];
                                }
                                return [];
                            })(),
                            provinceStateRouting: (() => {
                                const existingRouting = carrierData.eligibilityRules?.geographicRouting?.provinceStateRouting;
                                if (existingRouting && existingRouting.length > 0) {
                                    return existingRouting;
                                }
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
                            countryCountryRouting: carrierData.eligibilityRules?.geographicRouting?.countryCountryRouting || [],
                            cityPairRouting: carrierData.eligibilityRules?.geographicRouting?.cityPairRouting || []
                        }
                    },

                    rateConfiguration: {
                        enabled: carrierData.rateConfiguration?.enabled || false,
                        currency: carrierData.rateConfiguration?.currency || 'CAD',
                        rateType: carrierData.rateConfiguration?.rateType || 'pound',
                        rateStructure: carrierData.rateConfiguration?.rateStructure || 'flat',

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

                        freightLanes: carrierData.rateConfiguration?.freightLanes || [],
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

    // Section validation
    const validateSection = useCallback((sectionId) => {
        if (!formData) return { isValid: false, errors: {} };

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
        if (!formData) return;

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
            } else {
                navigate(`/admin/carriers/${carrierId}`);
            }
        } catch (error) {
            console.error('Error updating carrier:', error);
            enqueueSnackbar('Failed to update carrier', { variant: 'error' });
        } finally {
            setSaving(false);
        }
    }, [formData, validateSection, carrierId, currentUser, onCarrierUpdated, onClose, enqueueSnackbar, navigate]);

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

    return (
        <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
            {isModal ? (
                <ModalHeader
                    title={`Edit Carrier - ${formData?.name}`}
                    onClose={onClose}
                    showCloseButton={true}
                />
            ) : (
                // Admin page header for standalone mode
                <Box sx={{ p: 3, borderBottom: '1px solid #e5e7eb' }}>
                    <AdminBreadcrumb currentPage="Edit Carrier" entityName={formData?.name} />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, mt: 3 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <IconButton
                                onClick={() => navigate(`/admin/carriers/${carrierId}`)}
                                sx={{ mr: 1 }}
                            >
                                <ArrowBackIcon />
                            </IconButton>
                            <Typography variant="h5" sx={{ fontWeight: 600, color: '#111827' }}>
                                Edit Carrier - {formData?.name}
                            </Typography>
                        </Box>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                variant="outlined"
                                onClick={() => navigate(`/admin/carriers/${carrierId}`)}
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
                                {saving ? 'Saving...' : 'Save Changes'}
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
                                    {formData && (
                                        <SectionComponent
                                            data={formData}
                                            onUpdate={updateFormData}
                                            errors={errors}
                                            setErrors={setErrors}
                                            isEdit={true}
                                        />
                                    )}
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
                                {saving ? 'Saving...' : 'Save Changes'}
                            </Button>
                        </Box>
                    )}
                </Box>
            </Box>
        </Box>
    );
};

export default EditCarrier; 