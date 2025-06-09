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
    Container
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import InventoryIcon from '@mui/icons-material/Inventory';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
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
        // No carriers configured at all
        return { courier: false, freight: false };
    }

    // Check if any carriers are enabled
    const enabledCarriers = connectedCarriers.filter(cc => cc.enabled === true);
    if (enabledCarriers.length === 0) {
        // No carriers are enabled
        return { courier: false, freight: false };
    }

    // Build a lookup map for carrier types from Firestore data
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

                // Get carrier IDs from connected carriers
                const carrierIds = companyData.connectedCarriers.map(cc => cc.carrierID);

                // Fetch carrier documents from Firestore
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
        if (!loading && !formData.shipmentInfo?.shipmentType) {
            const types = availableShipmentTypes;

            // Priority logic: Freight first, then courier
            if (types.freight) {
                handleShipmentTypeChange('freight');
            } else if (types.courier) {
                handleShipmentTypeChange('courier');
            }
            // If neither available, don't auto-select anything
        }
    }, [availableShipmentTypes, loading, formData.shipmentInfo?.shipmentType]);

    // Check if no carriers are enabled
    const noCarriersEnabled = !loading && !availableShipmentTypes.courier && !availableShipmentTypes.freight;

    // Local state to ensure immediate courier selection and track user changes
    const [localShipmentType, setLocalShipmentType] = useState('courier');
    const [userHasChanged, setUserHasChanged] = useState(false);

    useEffect(() => {
        // Only set courier as default if there's NO existing shipmentType data
        const currentData = formData.shipmentInfo || {};
        if (!userHasChanged && !currentData.shipmentType && !loading && availableShipmentTypes.courier) {
            updateFormSection('shipmentInfo', {
                ...currentData,
                shipmentType: 'courier',
                shipmentDate: currentData.shipmentDate || formatDateForInput(new Date())
            });
        }
    }, [loading, availableShipmentTypes, userHasChanged, formData.shipmentInfo, updateFormSection]);

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
        setLocalShipmentType(type);
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

        if (hasEmptyRequiredFields) {
            setErrorMessage('Please fill in all required fields');
            setShowErrorSnackbar(true);
            if (!currentData.shipmentType) newErrors.shipmentType = 'Please select a shipment type';
            if (!currentData.shipmentDate) newErrors.shipmentDate = 'Please select a shipment date';
        } else {
            if (!currentData.shipmentType) {
                newErrors.shipmentType = 'Please select a shipment type';
            }
            if (!currentData.shipmentDate) {
                newErrors.shipmentDate = 'Please select a shipment date';
            } else {
                const todayDate = new Date();
                const todayAtMidnightUTC = new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth(), todayDate.getUTCDate()));
                const parts = currentData.shipmentDate.split('-');
                const selectedDateAtMidnightUTC = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])));
                if (selectedDateAtMidnightUTC < todayAtMidnightUTC) {
                    newErrors.shipmentDate = 'Shipment date cannot be in the past';
                }
            }
        }
        const earliestPickup = new Date(`2000-01-01T${currentData.earliestPickupTime || '00:00'}`);
        const latestPickup = new Date(`2000-01-01T${currentData.latestPickupTime || '00:00'}`);
        if (earliestPickup >= latestPickup) {
            newErrors.pickupTime = 'Latest pickup time must be after earliest pickup time';
        }
        const earliestDelivery = new Date(`2000-01-01T${currentData.earliestDeliveryTime || '00:00'}`);
        const latestDelivery = new Date(`2000-01-01T${currentData.latestDeliveryTime || '00:00'}`);
        if (earliestDelivery >= latestDelivery) {
            newErrors.deliveryTime = 'Latest delivery time must be after earliest delivery time';
        }
        setErrors(newErrors);
        const isValid = Object.keys(newErrors).length === 0;
        console.log('🔍 validateForm - Final result:', {
            newErrors,
            isValid,
            errorCount: Object.keys(newErrors).length
        });

        if (!isValid && !hasEmptyRequiredFields) {
            setErrorMessage('Please correct the errors highlighted below.');
            setShowErrorSnackbar(true);
        }
        return isValid;
    };

    const handleSubmit = (e) => {
        try {
            console.log('🚀 handleSubmit called!');

            const currentShipmentInfo = formData.shipmentInfo || {};
            console.log('🔍 ShipmentInfo handleSubmit - Form Data:', {
                currentShipmentInfo,
                formDataShipmentInfo: formData.shipmentInfo,
                availableShipmentTypes,
                loading
            });

            const isValid = validateForm();
            console.log('🔍 ShipmentInfo handleSubmit - Validation Result:', isValid);

            if (!isValid) {
                console.log('❌ ShipmentInfo handleSubmit - Validation failed, errors:', errors);
                const firstErrorField = Object.keys(errors)[0];
                if (firstErrorField) {
                    const element = document.getElementById(firstErrorField);
                    if (element) {
                        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    } else {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                    }
                }
                return;
            }

            console.log('✅ ShipmentInfo handleSubmit - Calling onNext with:', currentShipmentInfo);
            onNext(currentShipmentInfo);
        } catch (error) {
            console.error('💥 ERROR in handleSubmit:', error);
        }
    };

    const handleCloseSnackbar = () => {
        setShowErrorSnackbar(false);
    };

    // Read values directly from context for rendering
    const currentData = formData.shipmentInfo || {};

    // Smart default logic
    let shipmentType;
    if (userHasChanged) {
        shipmentType = currentData.shipmentType || localShipmentType;
    } else if (currentData.shipmentType) {
        shipmentType = currentData.shipmentType;
    } else if (availableShipmentTypes.courier && !availableShipmentTypes.freight) {
        shipmentType = 'courier';
    } else if (availableShipmentTypes.freight && !availableShipmentTypes.courier) {
        shipmentType = 'freight';
    } else {
        shipmentType = 'courier';
    }

    // Ensure the calculated shipment type is saved to form context
    useEffect(() => {
        console.log('🔍 useEffect - Shipment type save check:', {
            shipmentType,
            currentDataShipmentType: currentData.shipmentType,
            loading,
            shouldSave: shipmentType && !currentData.shipmentType && !loading
        });

        if (shipmentType && !currentData.shipmentType && !loading) {
            console.log('💾 useEffect - Saving shipment type to form context:', shipmentType);
            updateFormSection('shipmentInfo', { shipmentType });
        }
    }, [shipmentType, currentData.shipmentType, loading, updateFormSection]);

    if (loading) {
        return (
            <div className="form-section">
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Skeleton variant="text" width={200} height={40} />
                </Box>
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                    <div>Loading carrier configuration...</div>
                </Box>
            </div>
        );
    }

    return (
        <div className="form-section">
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" component="h3" className="form-section-title">
                    Shipment Info
                </Typography>
            </Box>

            <form className="form">
                {/* Warning when no carriers are available */}
                {noCarriersEnabled && (
                    <Alert
                        severity="warning"
                        sx={{ mb: 3 }}
                        action={
                            <Button
                                color="inherit"
                                size="small"
                                onClick={() => navigate('/carriers')}
                            >
                                Configure Carriers
                            </Button>
                        }
                    >
                        <Typography variant="body2">
                            No carriers are currently enabled for your company.
                            You'll need to configure and enable carriers before you can create shipments.
                        </Typography>
                    </Alert>
                )}

                <Grid container spacing={3}>
                    {/* Shipment Type Selection */}
                    <Grid item xs={12}>
                        <Typography variant="h6" gutterBottom>
                            Shipment Type
                            <Tooltip title="Choose the type of shipment based on size and service requirements">
                                <IconButton size="small">
                                    <InfoIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                            <Tooltip
                                title={!availableShipmentTypes.courier ? "No courier carriers available" : "Small packages, fast delivery"}
                                placement="top"
                            >
                                <span style={{ flex: 1 }}>
                                    <Button
                                        variant={shipmentType === 'courier' ? 'contained' : 'outlined'}
                                        startIcon={<LocalShippingIcon />}
                                        onClick={() => handleShipmentTypeChange('courier')}
                                        disabled={!availableShipmentTypes.courier}
                                        fullWidth
                                        sx={{
                                            py: 2,
                                            '&.MuiButton-contained': {
                                                backgroundColor: '#1976d2',
                                                '&:hover': {
                                                    backgroundColor: '#1565c0'
                                                }
                                            },
                                            '&.Mui-disabled': {
                                                opacity: 0.6
                                            }
                                        }}
                                    >
                                        <Box sx={{ textAlign: 'left' }}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                                Courier
                                            </Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.8 }}>
                                                Small packages, fast delivery
                                            </Typography>
                                        </Box>
                                    </Button>
                                </span>
                            </Tooltip>
                            <Tooltip
                                title={!availableShipmentTypes.freight ? "No freight carriers available" : "Large shipments, LTL service"}
                                placement="top"
                            >
                                <span style={{ flex: 1 }}>
                                    <Button
                                        variant={shipmentType === 'freight' ? 'contained' : 'outlined'}
                                        startIcon={<InventoryIcon />}
                                        onClick={() => handleShipmentTypeChange('freight')}
                                        disabled={!availableShipmentTypes.freight}
                                        fullWidth
                                        sx={{
                                            py: 2,
                                            '&.MuiButton-contained': {
                                                backgroundColor: '#1976d2',
                                                '&:hover': {
                                                    backgroundColor: '#1565c0'
                                                }
                                            },
                                            '&.Mui-disabled': {
                                                opacity: 0.6
                                            }
                                        }}
                                    >
                                        <Box sx={{ textAlign: 'left' }}>
                                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                                Freight
                                            </Typography>
                                            <Typography variant="body2" sx={{ opacity: 0.8 }}>
                                                Large shipments, LTL service
                                            </Typography>
                                        </Box>
                                    </Button>
                                </span>
                            </Tooltip>
                        </Box>
                        {errors.shipmentType && (
                            <FormHelperText error>
                                {errors.shipmentType}
                            </FormHelperText>
                        )}
                    </Grid>

                    {/* Basic Shipment Details */}
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            id="shipmentDate"
                            label="Shipment Date"
                            type="date"
                            value={currentData.shipmentDate || formatDateForInput(new Date())}
                            onChange={handleInputChange}
                            error={!!errors.shipmentDate}
                            helperText={errors.shipmentDate}
                            InputLabelProps={{
                                shrink: true,
                            }}
                            required
                        />
                    </Grid>

                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            id="shipperReferenceNumber"
                            label="Reference Number"
                            value={currentData.shipperReferenceNumber || ''}
                            onChange={handleInputChange}
                            error={!!errors.shipperReferenceNumber}
                            helperText={errors.shipperReferenceNumber || "Your internal reference number"}
                            placeholder="Optional reference number"
                        />
                    </Grid>

                    {/* Pickup Time Windows */}
                    <Grid item xs={12}>
                        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                            Pickup Time Window
                            <Tooltip title="Specify the time window when the carrier can pick up the shipment">
                                <IconButton size="small">
                                    <InfoIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Typography>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            id="earliestPickupTime"
                            label="Earliest Pickup Time"
                            type="time"
                            value={currentData.earliestPickupTime || '09:00'}
                            onChange={handleInputChange}
                            error={!!errors.pickupTime}
                            InputLabelProps={{
                                shrink: true,
                            }}
                        />
                    </Grid>

                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            id="latestPickupTime"
                            label="Latest Pickup Time"
                            type="time"
                            value={currentData.latestPickupTime || '17:00'}
                            onChange={handleInputChange}
                            error={!!errors.pickupTime}
                            helperText={errors.pickupTime}
                            InputLabelProps={{
                                shrink: true,
                            }}
                        />
                    </Grid>

                    {/* Delivery Time Windows */}
                    <Grid item xs={12}>
                        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                            Delivery Time Window
                            <Tooltip title="Specify the preferred delivery time window">
                                <IconButton size="small">
                                    <InfoIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                        </Typography>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            id="earliestDeliveryTime"
                            label="Earliest Delivery Time"
                            type="time"
                            value={currentData.earliestDeliveryTime || '09:00'}
                            onChange={handleInputChange}
                            error={!!errors.deliveryTime}
                            InputLabelProps={{
                                shrink: true,
                            }}
                        />
                    </Grid>

                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            id="latestDeliveryTime"
                            label="Latest Delivery Time"
                            type="time"
                            value={currentData.latestDeliveryTime || '17:00'}
                            onChange={handleInputChange}
                            error={!!errors.deliveryTime}
                            helperText={errors.deliveryTime}
                            InputLabelProps={{
                                shrink: true,
                            }}
                        />
                    </Grid>

                    {/* Special Services */}
                    <Grid item xs={12}>
                        <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                            Special Services
                        </Typography>
                        <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            id="signatureRequired"
                                            checked={currentData.signatureRequired || false}
                                            onChange={handleInputChange}
                                        />
                                    }
                                    label="Signature Required"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            id="residentialDelivery"
                                            checked={currentData.residentialDelivery || false}
                                            onChange={handleInputChange}
                                        />
                                    }
                                    label="Residential Delivery"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            id="insideDelivery"
                                            checked={currentData.insideDelivery || false}
                                            onChange={handleInputChange}
                                        />
                                    }
                                    label="Inside Delivery"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6}>
                                <FormControlLabel
                                    control={
                                        <Checkbox
                                            id="liftgateRequired"
                                            checked={currentData.liftgateRequired || false}
                                            onChange={handleInputChange}
                                        />
                                    }
                                    label="Liftgate Required"
                                />
                            </Grid>
                        </Grid>
                    </Grid>

                    {/* Special Instructions */}
                    <Grid item xs={12}>
                        <TextField
                            fullWidth
                            id="specialInstructions"
                            label="Special Instructions"
                            multiline
                            rows={3}
                            value={currentData.specialInstructions || ''}
                            onChange={handleInputChange}
                            placeholder="Any special handling or delivery instructions..."
                        />
                    </Grid>
                </Grid>

                {/* Navigation Buttons */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Button
                        variant="outlined"
                        onClick={onPrevious}
                        type="button"
                    >
                        Previous
                    </Button>
                    <Button
                        variant="contained"
                        disabled={loading}
                        onClick={(e) => {
                            console.log('🔘 Next button clicked!');
                            handleSubmit(e);
                        }}
                    >
                        Next
                    </Button>
                </Box>
            </form>

            {/* Error Snackbar */}
            <Snackbar
                open={showErrorSnackbar}
                autoHideDuration={6000}
                onClose={handleCloseSnackbar}
                message={errorMessage}
            />
        </div>
    );
};

export default ShipmentInfo; 