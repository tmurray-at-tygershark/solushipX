import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
    Tooltip,
    IconButton,
    Grid,
    Typography,
    Box,
    Divider,
    TextField,
    FormControl,
    FormHelperText,
    Alert,
    Snackbar,
    Button,
    Skeleton,
    FormControlLabel,
    Checkbox,
    Select,
    MenuItem,
    InputLabel,
    Paper,
    Container,
    Card,
    CardContent,
    Chip,
    Collapse
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import InventoryIcon from '@mui/icons-material/Inventory';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import WarningIcon from '@mui/icons-material/Warning';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EmailIcon from '@mui/icons-material/Email';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import './ShipmentInfo.css';
import { useShipmentForm } from '../../contexts/ShipmentFormContext';
import { useCompany } from '../../contexts/CompanyContext';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useNavigate } from 'react-router-dom';

// Helper to format date as YYYY-MM-DD
const formatDateForInput = (date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Helper to determine available shipment types based on connected carriers and their Firestore data
const getAvailableShipmentTypes = (connectedCarriers, carrierData) => {
    if (!connectedCarriers || connectedCarriers.length === 0) {
        return { courier: false, freight: false };
    }

    const enabledCarriers = connectedCarriers.filter(cc => cc.enabled === true);
    if (enabledCarriers.length === 0) {
        return { courier: false, freight: false };
    }

    const carrierTypeMap = {};
    if (carrierData && Array.isArray(carrierData)) {
        carrierData.forEach(carrier => {
            carrierTypeMap[carrier.carrierID] = carrier.type;
        });
    }

    const availableTypes = { courier: false, freight: false };

    enabledCarriers.forEach(cc => {
        const carrierType = carrierTypeMap[cc.carrierID];
        if (carrierType === 'courier') {
            availableTypes.courier = true;
        } else if (carrierType === 'freight') {
            availableTypes.freight = true;
        } else if (carrierType === 'hybrid') {
            availableTypes.courier = true;
            availableTypes.freight = true;
        }
    });

    return availableTypes;
};

const ShipmentInfo = ({ onNext, onPrevious }) => {
    const { formData, updateFormSection } = useShipmentForm();
    const { companyData } = useCompany();
    const [errors, setErrors] = useState({});
    const [showErrorSnackbar, setShowErrorSnackbar] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [carrierData, setCarrierData] = useState([]);
    const [userHasChanged, setUserHasChanged] = useState(false);
    const [serviceOptionsExpanded, setServiceOptionsExpanded] = useState(false);
    const navigate = useNavigate();

    // Fetch carrier data from Firestore based on connected carriers
    useEffect(() => {
        const fetchCarrierData = async () => {
            if (!companyData?.connectedCarriers || companyData.connectedCarriers.length === 0) {
                console.log('No connected carriers found for company');
                setCarrierData([]);
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                console.log('Fetching carrier data for:', companyData.connectedCarriers);

                const carrierIds = companyData.connectedCarriers.map(cc => cc.carrierID);
                const carriersRef = collection(db, 'carriers');
                const carriersQuery = query(carriersRef, where('carrierID', 'in', carrierIds));
                const snapshot = await getDocs(carriersQuery);

                const carriers = [];
                snapshot.forEach(doc => {
                    carriers.push({ id: doc.id, ...doc.data() });
                });

                console.log('Fetched carrier data:', carriers);
                setCarrierData(carriers);
            } catch (error) {
                console.error('Error fetching carrier data:', error);
                setCarrierData([]);
            } finally {
                setLoading(false);
            }
        };

        fetchCarrierData();
    }, [companyData]);

    // Check available shipment types after carrier data is loaded
    const availableShipmentTypes = useMemo(() => {
        if (loading) return { courier: false, freight: false };
        return getAvailableShipmentTypes(companyData?.connectedCarriers, carrierData);
    }, [companyData?.connectedCarriers, carrierData, loading]);

    // Auto-select shipment type based on available carriers
    useEffect(() => {
        if (!loading && !formData.shipmentInfo?.shipmentType && !userHasChanged) {
            const types = availableShipmentTypes;

            if (types.freight) {
                handleShipmentTypeChange('freight');
            } else if (types.courier) {
                handleShipmentTypeChange('courier');
            }
        }
    }, [availableShipmentTypes, loading, formData.shipmentInfo?.shipmentType, userHasChanged]);

    // Check if no carriers are enabled
    const noCarriersEnabled = !loading && !availableShipmentTypes.courier && !availableShipmentTypes.freight;

    // Initialize form with default values
    useEffect(() => {
        const currentData = formData.shipmentInfo || {};
        if (!currentData.shipmentDate) {
            updateFormSection('shipmentInfo', {
                ...currentData,
                shipmentDate: formatDateForInput(new Date()),
                earliestPickup: currentData.earliestPickup || '09:00',
                latestPickup: currentData.latestPickup || '17:00',
                earliestDelivery: currentData.earliestDelivery || '09:00',
                latestDelivery: currentData.latestDelivery || '17:00',
                billType: currentData.billType || 'prepaid'
            });
        }
    }, [formData.shipmentInfo, updateFormSection]);

    const handleInputChange = (e) => {
        const { id, value, type } = e.target;
        const newValue = type === 'checkbox' ? e.target.checked : value;
        updateFormSection('shipmentInfo', { [id]: newValue });
        if (errors[id]) {
            setErrors(prev => ({ ...prev, [id]: null }));
        }
    };

    const handleShipmentTypeChange = (type) => {
        setUserHasChanged(true);
        updateFormSection('shipmentInfo', { shipmentType: type });
        if (errors.shipmentType) {
            setErrors(prev => ({ ...prev, shipmentType: null }));
        }
    };

    const validateForm = () => {
        const newErrors = {};
        const currentData = formData.shipmentInfo || {};
        console.log('🔍 validateForm - Starting validation with data:', currentData);

        const requiredFields = ['shipmentType', 'shipmentDate'];
        const hasEmptyRequiredFields = requiredFields.some(field => !currentData[field]);
        console.log('🔍 validateForm - Required fields check:', {
            shipmentType: currentData.shipmentType,
            shipmentDate: currentData.shipmentDate,
            hasEmptyRequiredFields
        });

        if (!currentData.shipmentType) {
            newErrors.shipmentType = 'Please select a shipment type';
        }

        if (!currentData.shipmentDate) {
            newErrors.shipmentDate = 'Please select a shipment date';
        } else {
            const selectedDate = new Date(currentData.shipmentDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            if (selectedDate < today) {
                newErrors.shipmentDate = 'Shipment date cannot be in the past';
            }
        }

        console.log('🔍 validateForm - Validation errors:', newErrors);
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        console.log('🚀 handleSubmit - Form submission started');

        if (noCarriersEnabled) {
            setErrorMessage('No carriers are configured for your company. Please contact your administrator to set up carrier connections.');
            setShowErrorSnackbar(true);
            return;
        }

        if (validateForm()) {
            console.log('✅ handleSubmit - Validation passed, proceeding to next step');
            onNext(formData.shipmentInfo);
        } else {
            console.log('❌ handleSubmit - Validation failed');
            setErrorMessage('Please fix the errors above before continuing.');
            setShowErrorSnackbar(true);
        }
    };

    const handleCloseSnackbar = () => {
        setShowErrorSnackbar(false);
        setErrorMessage('');
    };

    if (loading) {
        return (
            <Container maxWidth="lg" sx={{ py: 4 }}>
                <Box sx={{ mb: 4 }}>
                    <Skeleton variant="text" width={300} height={40} />
                    <Skeleton variant="text" width={500} height={24} sx={{ mt: 1 }} />
                </Box>
                <Grid container spacing={3}>
                    {[1, 2, 3].map((item) => (
                        <Grid item xs={12} md={4} key={item}>
                            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: 2 }} />
                        </Grid>
                    ))}
                </Grid>
            </Container>
        );
    }

    return (
        <Container maxWidth="lg" sx={{ py: 4 }}>
            {noCarriersEnabled && (
                <Alert
                    severity="error"
                    sx={{ mb: 3 }}
                    action={
                        <Button
                            color="inherit"
                            size="small"
                            onClick={() => navigate('/carriers')}
                            sx={{ fontSize: '12px' }}
                        >
                            Configure Carriers
                        </Button>
                    }
                >
                    <Typography sx={{ fontSize: '12px' }}>
                        No carriers are configured for your company. Please set up carrier connections to create shipments.
                    </Typography>
                </Alert>
            )}

            <form onSubmit={handleSubmit}>
                {/* Shipment Type Selection */}
                <Paper sx={{ p: 3, mb: 3, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                            Shipment Type
                        </Typography>
                    </Box>

                    <Grid container spacing={2}>
                        <Grid item xs={12} md={6}>
                            <Card
                                sx={{
                                    cursor: availableShipmentTypes.courier ? 'pointer' : 'not-allowed',
                                    border: formData.shipmentInfo?.shipmentType === 'courier' ? '2px solid #1976d2' : '1px solid #e0e0e0',
                                    opacity: availableShipmentTypes.courier ? 1 : 0.5,
                                    '&:hover': availableShipmentTypes.courier ? { boxShadow: 3 } : {}
                                }}
                                onClick={() => availableShipmentTypes.courier && handleShipmentTypeChange('courier')}
                            >
                                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                                    <EmailIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                                    <Typography variant="h6" gutterBottom>
                                        Courier Service
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
                                        Fast delivery for packages and documents
                                    </Typography>
                                    {!availableShipmentTypes.courier && (
                                        <Chip
                                            label="Not Available"
                                            color="error"
                                            size="small"
                                            sx={{ mt: 1, fontSize: '10px' }}
                                        />
                                    )}
                                </CardContent>
                            </Card>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <Card
                                sx={{
                                    cursor: availableShipmentTypes.freight ? 'pointer' : 'not-allowed',
                                    border: formData.shipmentInfo?.shipmentType === 'freight' ? '2px solid #1976d2' : '1px solid #e0e0e0',
                                    opacity: availableShipmentTypes.freight ? 1 : 0.5,
                                    '&:hover': availableShipmentTypes.freight ? { boxShadow: 3 } : {}
                                }}
                                onClick={() => availableShipmentTypes.freight && handleShipmentTypeChange('freight')}
                            >
                                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                                    <LocalShippingIcon sx={{ fontSize: 48, color: 'primary.main', mb: 2 }} />
                                    <Typography variant="h6" gutterBottom>
                                        Freight Service
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary" sx={{ fontSize: '12px' }}>
                                        Heavy cargo and large shipments
                                    </Typography>
                                    {!availableShipmentTypes.freight && (
                                        <Chip
                                            label="Not Available"
                                            color="error"
                                            size="small"
                                            sx={{ mt: 1, fontSize: '10px' }}
                                        />
                                    )}
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    {errors.shipmentType && (
                        <Typography color="error" sx={{ mt: 1, fontSize: '12px' }}>
                            {errors.shipmentType}
                        </Typography>
                    )}
                </Paper>

                {/* Shipment Info */}
                <Paper sx={{ p: 3, mb: 3, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                    <Box sx={{ mb: 3 }}>
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600 }}>
                            Shipment Info
                        </Typography>
                    </Box>

                    <Grid container spacing={3}>
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                id="shipmentDate"
                                label="Shipment Date"
                                type="date"
                                value={formData.shipmentInfo?.shipmentDate || ''}
                                onChange={handleInputChange}
                                error={!!errors.shipmentDate}
                                helperText={errors.shipmentDate}
                                InputLabelProps={{ shrink: true }}
                                inputProps={{
                                    min: formatDateForInput(new Date()),
                                    style: { fontSize: '12px' }
                                }}
                                required
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                id="shipperReferenceNumber"
                                label="Reference Number"
                                value={formData.shipmentInfo?.shipperReferenceNumber || ''}
                                onChange={handleInputChange}
                                placeholder="PO Number, Invoice, etc."
                                InputLabelProps={{
                                    shrink: true,
                                    sx: { fontSize: '14px' }
                                }}
                                inputProps={{
                                    style: { fontSize: '12px' }
                                }}
                                InputProps={{
                                    sx: {
                                        fontSize: '12px',
                                        '& input': {
                                            fontSize: '12px !important'
                                        },
                                        '& input::placeholder': {
                                            fontSize: '12px !important',
                                            opacity: 0.6
                                        }
                                    }
                                }}
                                helperText="Optional reference for tracking"
                                FormHelperTextProps={{ sx: { fontSize: '10px' } }}
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth>
                                <InputLabel>Bill Type</InputLabel>
                                <Select
                                    id="billType"
                                    value={formData.shipmentInfo?.billType || 'prepaid'}
                                    onChange={handleInputChange}
                                    label="Bill Type"
                                    sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                >
                                    <MenuItem value="prepaid" sx={{ fontSize: '12px' }}>Prepaid (Sender Pays)</MenuItem>
                                    <MenuItem value="collect" sx={{ fontSize: '12px' }}>Collect (Receiver Pays)</MenuItem>
                                    <MenuItem value="third_party" sx={{ fontSize: '12px' }}>Third Party</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </Paper>

                {/* Pickup & Delivery Times */}
                <Paper sx={{ p: 3, mb: 3, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                    <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, mb: 3 }}>
                        Pickup & Delivery Windows
                    </Typography>

                    <Grid container spacing={3}>
                        <Grid item xs={12} md={3}>
                            <TextField
                                fullWidth
                                id="earliestPickup"
                                label="Earliest Pickup"
                                type="time"
                                value={formData.shipmentInfo?.earliestPickup || '09:00'}
                                onChange={handleInputChange}
                                InputLabelProps={{ shrink: true }}
                                inputProps={{ style: { fontSize: '12px' } }}
                            />
                        </Grid>

                        <Grid item xs={12} md={3}>
                            <TextField
                                fullWidth
                                id="latestPickup"
                                label="Latest Pickup"
                                type="time"
                                value={formData.shipmentInfo?.latestPickup || '17:00'}
                                onChange={handleInputChange}
                                InputLabelProps={{ shrink: true }}
                                inputProps={{ style: { fontSize: '12px' } }}
                            />
                        </Grid>

                        <Grid item xs={12} md={3}>
                            <TextField
                                fullWidth
                                id="earliestDelivery"
                                label="Earliest Delivery"
                                type="time"
                                value={formData.shipmentInfo?.earliestDelivery || '09:00'}
                                onChange={handleInputChange}
                                InputLabelProps={{ shrink: true }}
                                inputProps={{ style: { fontSize: '12px' } }}
                            />
                        </Grid>

                        <Grid item xs={12} md={3}>
                            <TextField
                                fullWidth
                                id="latestDelivery"
                                label="Latest Delivery"
                                type="time"
                                value={formData.shipmentInfo?.latestDelivery || '17:00'}
                                onChange={handleInputChange}
                                InputLabelProps={{ shrink: true }}
                                inputProps={{ style: { fontSize: '12px' } }}
                            />
                        </Grid>
                    </Grid>
                </Paper>

                {/* Service Options */}
                <Paper sx={{ p: 3, mb: 4, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                    <Box
                        sx={{
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            mb: serviceOptionsExpanded ? 3 : 0
                        }}
                        onClick={() => setServiceOptionsExpanded(!serviceOptionsExpanded)}
                    >
                        <Typography variant="h6" sx={{ fontSize: '16px', fontWeight: 600, flex: 1 }}>
                            Additional Options
                        </Typography>
                        {serviceOptionsExpanded ? (
                            <ExpandLessIcon sx={{ color: '#666' }} />
                        ) : (
                            <ExpandMoreIcon sx={{ color: '#666' }} />
                        )}
                    </Box>

                    <Collapse in={serviceOptionsExpanded}>
                        <Grid container spacing={3}>
                            {/* Delivery & Pickup Options */}
                            <Grid item xs={12} md={6}>
                                <Box sx={{ mb: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontSize: '13px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                        Delivery & Pickup Options
                                    </Typography>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>Delivery Options</InputLabel>
                                        <Select
                                            id="deliveryPickupOption"
                                            value={formData.shipmentInfo?.deliveryPickupOption || ''}
                                            onChange={handleInputChange}
                                            label="Delivery Options"
                                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                        >
                                            <MenuItem value="" sx={{ fontSize: '12px' }}>
                                                Standard Delivery
                                            </MenuItem>
                                            <MenuItem value="residential" sx={{ fontSize: '12px' }}>
                                                Residential Delivery
                                            </MenuItem>
                                            <MenuItem value="holdForPickup" sx={{ fontSize: '12px' }}>
                                                Hold for Pickup
                                            </MenuItem>
                                        </Select>
                                    </FormControl>
                                </Box>
                            </Grid>

                            {/* Hazardous Goods */}
                            <Grid item xs={12} md={6}>
                                <Box sx={{ mb: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontSize: '13px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                        Hazardous Materials
                                    </Typography>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>Hazardous Goods</InputLabel>
                                        <Select
                                            id="hazardousGoods"
                                            value={formData.shipmentInfo?.hazardousGoods || ''}
                                            onChange={handleInputChange}
                                            label="Hazardous Goods"
                                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                        >
                                            <MenuItem value="" sx={{ fontSize: '12px' }}>None</MenuItem>
                                            <MenuItem value="limited_quantity" sx={{ fontSize: '12px' }}>Limited Quantity</MenuItem>
                                            <MenuItem value="500kg_exemption" sx={{ fontSize: '12px' }}>500kg Exemption</MenuItem>
                                            <MenuItem value="fully_regulated" sx={{ fontSize: '12px' }}>Fully Regulated</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Box>
                            </Grid>

                            {/* Priority Delivery */}
                            <Grid item xs={12} md={6}>
                                <Box sx={{ mb: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontSize: '13px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                        Priority Delivery
                                    </Typography>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>Priority Options</InputLabel>
                                        <Select
                                            id="priorityDelivery"
                                            value={formData.shipmentInfo?.priorityDelivery || ''}
                                            onChange={handleInputChange}
                                            label="Priority Options"
                                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                        >
                                            <MenuItem value="" sx={{ fontSize: '12px' }}>Standard Delivery</MenuItem>
                                            <MenuItem value="10am" sx={{ fontSize: '12px' }}>10AM Delivery</MenuItem>
                                            <MenuItem value="noon" sx={{ fontSize: '12px' }}>Noon Delivery</MenuItem>
                                            <MenuItem value="saturday" sx={{ fontSize: '12px' }}>Saturday Delivery</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Box>
                            </Grid>

                            {/* Signature Options */}
                            <Grid item xs={12} md={6}>
                                <Box sx={{ mb: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontSize: '13px', fontWeight: 600, color: '#374151', mb: 1 }}>
                                        Signature Requirements
                                    </Typography>
                                    <FormControl fullWidth size="small">
                                        <InputLabel sx={{ fontSize: '12px' }}>Signature Options</InputLabel>
                                        <Select
                                            id="signatureOptions"
                                            value={formData.shipmentInfo?.signatureOptions || ''}
                                            onChange={handleInputChange}
                                            label="Signature Options"
                                            sx={{ '& .MuiSelect-select': { fontSize: '12px' } }}
                                        >
                                            <MenuItem value="" sx={{ fontSize: '12px' }}>No Signature Required</MenuItem>
                                            <MenuItem value="standard" sx={{ fontSize: '12px' }}>Signature Required</MenuItem>
                                            <MenuItem value="adult" sx={{ fontSize: '12px' }}>Adult Signature Required</MenuItem>
                                        </Select>
                                    </FormControl>
                                </Box>
                            </Grid>
                        </Grid>
                    </Collapse>
                </Paper>

                {/* Navigation Buttons */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
                    <Button
                        variant="outlined"
                        onClick={onPrevious}
                        disabled={!onPrevious}
                        sx={{ px: 4, fontSize: '12px' }}
                    >
                        Previous
                    </Button>
                    <Button
                        type="submit"
                        variant="contained"
                        disabled={noCarriersEnabled}
                        sx={{
                            px: 6,
                            py: 1.5,
                            fontSize: '12px',
                            backgroundColor: '#10B981',
                            minWidth: '160px',
                            '&:hover': {
                                backgroundColor: '#059669'
                            },
                            '&:disabled': {
                                backgroundColor: '#cccccc'
                            }
                        }}
                        endIcon={<ArrowForwardIcon />}
                    >
                        Next
                    </Button>
                </Box>
            </form>

            <Snackbar
                open={showErrorSnackbar}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
            >
                <Alert onClose={handleCloseSnackbar} severity="error" sx={{ width: '100%' }}>
                    <Typography sx={{ fontSize: '12px' }}>{errorMessage}</Typography>
                </Alert>
            </Snackbar>
        </Container>
    );
};

export default ShipmentInfo; 