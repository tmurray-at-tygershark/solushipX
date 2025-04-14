import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { Box, Container, Paper, Stepper, Step, StepLabel, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';
import { useSnackbar } from '../../contexts/SnackbarContext';
import { useShipment } from '../../contexts/ShipmentContext';
import { useRate } from '../../contexts/RateContext';
import { useTracking } from '../../contexts/TrackingContext';
import { useBilling } from '../../contexts/BillingContext';
import { useNotification } from '../../contexts/NotificationContext';
import { useError } from '../../contexts/ErrorContext';
import { useLoading } from '../../contexts/LoadingContext';
import { useValidation } from '../../contexts/ValidationContext';
import { useGeocoding } from '../../contexts/GeocodingContext';
import { useDistance } from '../../contexts/DistanceContext';
import { useWeight } from '../../contexts/WeightContext';
import { useVolume } from '../../contexts/VolumeContext';
import { useDimension } from '../../contexts/DimensionContext';
import { usePackage } from '../../contexts/PackageContext';
import { useService } from '../../contexts/ServiceContext';
import { useLocation } from '../../contexts/LocationContext';
import { useAddress } from '../../contexts/AddressContext';
import { useContact } from '../../contexts/ContactContext';
import { useCompany } from '../../contexts/CompanyContext';
import { useDocument } from '../../contexts/DocumentContext';
import { useLabel } from '../../contexts/LabelContext';
import { useInvoice } from '../../contexts/InvoiceContext';
import { usePayment } from '../../contexts/PaymentContext';
import { useRefund } from '../../contexts/RefundContext';
import { useDispute } from '../../contexts/DisputeContext';
import { useClaim } from '../../contexts/ClaimContext';
import { useInsurance } from '../../contexts/InsuranceContext';
import { useCustoms } from '../../contexts/CustomsContext';
import { useCompliance } from '../../contexts/ComplianceContext';
import { useSecurity } from '../../contexts/SecurityContext';
import { useAudit } from '../../contexts/AuditContext';
import { useReport } from '../../contexts/ReportContext';
import { useDashboard } from '../../contexts/DashboardContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useProfile } from '../../contexts/ProfileContext';
import { usePreferences } from '../../contexts/PreferencesContext';
import { useNotifications } from '../../contexts/NotificationsContext';
import { useMessages } from '../../contexts/MessagesContext';
import { useChat } from '../../contexts/ChatContext';
import { useSupport } from '../../contexts/SupportContext';
import { useHelp } from '../../contexts/HelpContext';
import { useFAQ } from '../../contexts/FAQContext';
import { useTutorial } from '../../contexts/TutorialContext';
import { useGuide } from '../../contexts/GuideContext';
import { useDocumentation } from '../../contexts/DocumentationContext';
import { useAPI } from '../../contexts/APIContext';
import { useIntegration } from '../../contexts/IntegrationContext';
import { useWebhook } from '../../contexts/WebhookContext';
import { useAutomation } from '../../contexts/AutomationContext';
import { useWorkflow } from '../../contexts/WorkflowContext';
import { useProcess } from '../../contexts/ProcessContext';
import { useTask } from '../../contexts/TaskContext';
import { useProject } from '../../contexts/ProjectContext';
import { useTeam } from '../../contexts/TeamContext';
import { useRole } from '../../contexts/RoleContext';
import { usePermission } from '../../contexts/PermissionContext';
import { useAccess } from '../../contexts/AccessContext';

const STEP_ROUTES = {
    details: 'details',
    origin: 'origin',
    destination: 'destination',
    package: 'package',
    service: 'service',
    review: 'review',
    payment: 'payment',
    confirmation: 'confirmation'
};

const STEP_NAMES = {
    [STEP_ROUTES.details]: 'Shipment Details',
    [STEP_ROUTES.origin]: 'Origin Address',
    [STEP_ROUTES.destination]: 'Destination Address',
    [STEP_ROUTES.package]: 'Package Information',
    [STEP_ROUTES.service]: 'Service Selection',
    [STEP_ROUTES.review]: 'Review',
    [STEP_ROUTES.payment]: 'Payment',
    [STEP_ROUTES.confirmation]: 'Confirmation'
};

const CreateShipment = () => {
    const navigate = useNavigate();
    const { step } = useParams();
    const { currentUser } = useAuth();
    const { showSnackbar } = useSnackbar();
    const { createShipment } = useShipment();
    const { calculateRates } = useRate();
    const { createTracking } = useTracking();
    const { createBilling } = useBilling();
    const { createNotification } = useNotification();
    const { handleError } = useError();
    const { setLoading } = useLoading();
    const { validateForm } = useValidation();
    const { geocodeAddress } = useGeocoding();
    const { calculateDistance } = useDistance();
    const { calculateWeight } = useWeight();
    const { calculateVolume } = useVolume();
    const { calculateDimensions } = useDimension();
    const { getPackageTypes } = usePackage();
    const { getServiceTypes } = useService();
    const { getLocationTypes } = useLocation();
    const { getAddressTypes } = useAddress();
    const { getContactTypes } = useContact();
    const { getCompanyTypes } = useCompany();
    const { getDocumentTypes } = useDocument();
    const { getLabelTypes } = useLabel();
    const { getInvoiceTypes } = useInvoice();
    const { getPaymentTypes } = usePayment();
    const { getRefundTypes } = useRefund();
    const { getDisputeTypes } = useDispute();
    const { getClaimTypes } = useClaim();
    const { getInsuranceTypes } = useInsurance();
    const { getCustomsTypes } = useCustoms();
    const { getComplianceTypes } = useCompliance();
    const { getSecurityTypes } = useSecurity();
    const { getAuditTypes } = useAudit();
    const { getReportTypes } = useReport();
    const { getDashboardTypes } = useDashboard();
    const { getSettingsTypes } = useSettings();
    const { getProfileTypes } = useProfile();
    const { getPreferencesTypes } = usePreferences();
    const { getNotificationsTypes } = useNotifications();
    const { getMessagesTypes } = useMessages();
    const { getChatTypes } = useChat();
    const { getSupportTypes } = useSupport();
    const { getHelpTypes } = useHelp();
    const { getFAQTypes } = useFAQ();
    const { getTutorialTypes } = useTutorial();
    const { getGuideTypes } = useGuide();
    const { getDocumentationTypes } = useDocumentation();
    const { getAPITypes } = useAPI();
    const { getIntegrationTypes } = useIntegration();
    const { getWebhookTypes } = useWebhook();
    const { getAutomationTypes } = useAutomation();
    const { getWorkflowTypes } = useWorkflow();
    const { getProcessTypes } = useProcess();
    const { getTaskTypes } = useTask();
    const { getProjectTypes } = useProject();
    const { getTeamTypes } = useTeam();
    const { getRoleTypes } = useRole();
    const { getPermissionTypes } = usePermission();
    const { getAccessTypes } = useAccess();

    const [formData, setFormData] = useState(() => {
        const savedData = localStorage.getItem('shipmentFormData');
        return savedData ? JSON.parse(savedData) : {
            shipmentType: '',
            serviceType: '',
            packageType: '',
            weight: '',
            dimensions: {
                length: '',
                width: '',
                height: ''
            },
            specialInstructions: '',
            origin: {
                address: '',
                city: '',
                state: '',
                zipCode: '',
                country: ''
            },
            destination: {
                address: '',
                city: '',
                state: '',
                zipCode: '',
                country: ''
            }
        };
    });

    const [selectedRate, setSelectedRate] = useState(() => {
        const savedRate = localStorage.getItem('selectedRate');
        return savedRate ? JSON.parse(savedRate) : null;
    });

    useEffect(() => {
        localStorage.setItem('shipmentFormData', JSON.stringify(formData));
    }, [formData]);

    useEffect(() => {
        if (selectedRate) {
            localStorage.setItem('selectedRate', JSON.stringify(selectedRate));
        } else {
            localStorage.removeItem('selectedRate');
        }
    }, [selectedRate]);

    useEffect(() => {
        if (!step) {
            navigate(`/create-shipment/${STEP_ROUTES.details}`);
        }
    }, [step, navigate]);

    const handleNext = async () => {
        try {
            setLoading(true);

            // Validate current step
            const validationResult = await validateForm(formData, step);
            if (!validationResult.isValid) {
                showSnackbar(validationResult.errors[0], 'error');
                return;
            }

            // Save form data
            setFormData(prevData => ({
                ...prevData,
                ...formData
            }));

            // Move to next step
            const currentStepIndex = Object.values(STEP_ROUTES).indexOf(step);
            const nextStep = Object.values(STEP_ROUTES)[currentStepIndex + 1];
            navigate(`/create-shipment/${nextStep}`);

        } catch (error) {
            handleError(error);
        } finally {
            setLoading(false);
        }
    };

    const handleBack = () => {
        const currentStepIndex = Object.values(STEP_ROUTES).indexOf(step);
        const prevStep = Object.values(STEP_ROUTES)[currentStepIndex - 1];
        navigate(`/create-shipment/${prevStep}`);
    };

    const handleSubmit = async () => {
        try {
            setLoading(true);

            // Validate final form
            const validationResult = await validateForm(formData, 'final');
            if (!validationResult.isValid) {
                showSnackbar(validationResult.errors[0], 'error');
                return;
            }

            // Create shipment
            const shipment = await createShipment({
                ...formData,
                userId: currentUser.uid,
                status: 'pending',
                createdAt: serverTimestamp()
            });

            // Create tracking
            await createTracking(shipment.id);

            // Create billing
            await createBilling(shipment.id);

            // Create notification
            await createNotification({
                userId: currentUser.uid,
                type: 'shipment_created',
                data: {
                    shipmentId: shipment.id
                }
            });

            // Clear form data
            localStorage.removeItem('shipmentFormData');
            localStorage.removeItem('selectedRate');

            // Navigate to confirmation
            navigate(`/create-shipment/${STEP_ROUTES.confirmation}`, {
                state: { shipmentId: shipment.id }
            });

        } catch (error) {
            handleError(error);
        } finally {
            setLoading(false);
        }
    };

    const renderStep = () => {
        switch (step) {
            case STEP_ROUTES.details:
                return <Details formData={formData} setFormData={setFormData} onNext={handleNext} />;
            case STEP_ROUTES.origin:
                return <Origin formData={formData} setFormData={setFormData} onNext={handleNext} onBack={handleBack} />;
            case STEP_ROUTES.destination:
                return <Destination formData={formData} setFormData={setFormData} onNext={handleNext} onBack={handleBack} />;
            case STEP_ROUTES.package:
                return <Package formData={formData} setFormData={setFormData} onNext={handleNext} onBack={handleBack} />;
            case STEP_ROUTES.service:
                return <Service formData={formData} setFormData={setFormData} selectedRate={selectedRate} setSelectedRate={setSelectedRate} onNext={handleNext} onBack={handleBack} />;
            case STEP_ROUTES.review:
                return <Review formData={formData} selectedRate={selectedRate} onSubmit={handleSubmit} onBack={handleBack} />;
            case STEP_ROUTES.payment:
                return <Payment formData={formData} selectedRate={selectedRate} onSubmit={handleSubmit} onBack={handleBack} />;
            case STEP_ROUTES.confirmation:
                return <Confirmation />;
            default:
                return <Navigate to={`/create-shipment/${STEP_ROUTES.details}`} replace />;
        }
    };

    return (
        <Container maxWidth="lg">
            <Box sx={{ py: 4 }}>
                <Paper elevation={3} sx={{ p: 4 }}>
                    <Typography variant="h4" component="h1" gutterBottom>
                        Create Shipment
                    </Typography>

                    <Stepper activeStep={Object.values(STEP_ROUTES).indexOf(step)} sx={{ mb: 4 }}>
                        {Object.values(STEP_ROUTES).map((stepRoute) => (
                            <Step key={stepRoute}>
                                <StepLabel>{STEP_NAMES[stepRoute]}</StepLabel>
                            </Step>
                        ))}
                    </Stepper>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.3 }}
                    >
                        {renderStep()}
                    </motion.div>
                </Paper>
            </Box>
        </Container>
    );
};

export default CreateShipment; 