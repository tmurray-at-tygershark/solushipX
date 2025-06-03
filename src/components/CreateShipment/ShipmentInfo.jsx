import React, { useState, useEffect, useRef } from 'react';
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
    Paper
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import InventoryIcon from '@mui/icons-material/Inventory';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import './ShipmentInfo.css';
import { useShipmentForm } from '../../contexts/ShipmentFormContext'; // Import the context hook

// Helper to format date as YYYY-MM-DD
const formatDateForInput = (date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
};

// Removed data and onDataChange from props
const ShipmentInfo = ({ onNext, onPrevious }) => {
    // Get state and update function from context
    const { formData, updateFormSection } = useShipmentForm();
    // Use a local state for errors, still managed locally
    const [errors, setErrors] = useState({});
    const [showErrorSnackbar, setShowErrorSnackbar] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // This useEffect is now simplified - the initialization is handled by the mount useEffect below
        // Only handle updates to existing shipmentInfo if needed for other logic
    }, [formData.shipmentInfo, updateFormSection]); // Keep dependencies for consistency

    // Add loading effect
    useEffect(() => {
        const timer = setTimeout(() => {
            setLoading(false);
        }, 1000); // Simulate loading for 1 second
        return () => clearTimeout(timer);
    }, []);

    const handleInputChange = (e) => {
        const { id, value, type } = e.target;
        const newValue = type === 'checkbox' ? e.target.checked : value;
        // Update context directly
        updateFormSection('shipmentInfo', { [id]: newValue });
        // Clear error when field is modified
        if (errors[id]) {
            setErrors(prev => ({ ...prev, [id]: null }));
        }
    };

    const handleShipmentTypeChange = (type) => {
        // Mark that user has made a change
        setUserHasChanged(true);
        // Update both local state and context
        setLocalShipmentType(type);
        updateFormSection('shipmentInfo', { shipmentType: type });
        if (errors.shipmentType) {
            setErrors(prev => ({ ...prev, shipmentType: null }));
        }
    };

    const validateForm = () => {
        const newErrors = {};
        const currentData = formData.shipmentInfo || {};
        // ... (existing validation logic using currentData, which comes from formData.shipmentInfo)
        // This validation logic itself seems fine as it reads from the context state.
        // The critical part is ensuring context IS the latest before this validateForm is called IF we solely rely on context.
        // Or, validate a passed-in data object if handleSubmit passes its own collected data.
        // For now, assuming currentData from context is what we validate.
        const requiredFields = ['shipmentType', 'shipmentDate'];
        const hasEmptyRequiredFields = requiredFields.some(field => !currentData[field]);

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
        if (!isValid && !hasEmptyRequiredFields) {
            setErrorMessage('Please correct the errors highlighted below.');
            setShowErrorSnackbar(true);
        }
        return isValid;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        e.stopPropagation();

        // currentShipmentInfo IS formData.shipmentInfo from context, which should have been updated by handleInputChange
        const currentShipmentInfo = formData.shipmentInfo || {};

        // Validate form using the data currently in context (formData.shipmentInfo)
        const isValid = validateForm();

        if (!isValid) {
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

        // Since handleInputChange updates context directly, formData.shipmentInfo IS the source of truth.
        // No need to explicitly call updateFormSection here again with the same object unless there was local state being managed.
        onNext(currentShipmentInfo); // Pass the validated shipmentInfo data from context to the parent
    };

    const handleCloseSnackbar = () => {
        setShowErrorSnackbar(false);
    };

    // Local state to ensure immediate courier selection and track user changes
    const [localShipmentType, setLocalShipmentType] = useState('courier');
    const [userHasChanged, setUserHasChanged] = useState(false);

    // Read values directly from context for rendering
    const currentData = formData.shipmentInfo || {};

    // Smart default logic:
    // 1. If user has made changes this session → use their selection
    // 2. If there's existing draft data with shipmentType → respect it
    // 3. Only default to courier for completely new shipments
    let shipmentType;
    if (userHasChanged) {
        // User has made a change this session, use context or local state
        shipmentType = currentData.shipmentType || localShipmentType;
    } else if (currentData.shipmentType) {
        // Existing draft data, respect the saved shipment type
        shipmentType = currentData.shipmentType;
    } else {
        // New shipment, default to courier
        shipmentType = 'courier';
    }

    // Also ensure the data is set in the context immediately if it's not already set
    React.useEffect(() => {
        // Only set courier as default if there's NO existing shipmentType data
        if (!userHasChanged && !currentData.shipmentType) {
            updateFormSection('shipmentInfo', {
                ...currentData,
                shipmentType: 'courier',
                shipmentDate: currentData.shipmentDate || formatDateForInput(new Date())
            });
        }
    }, []); // Run only once on mount

    if (loading) {
        return (
            <div className="form-section">
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <Skeleton variant="text" width={200} height={40} />
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <Skeleton variant="rectangular" height={150} sx={{ borderRadius: 2 }} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Skeleton variant="rectangular" height={150} sx={{ borderRadius: 2 }} />
                        </Grid>
                    </Grid>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Skeleton variant="text" width={150} height={30} sx={{ mb: 2 }} />
                    <Skeleton variant="rectangular" height={56} sx={{ mb: 2 }} />
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Skeleton variant="text" width={150} height={30} sx={{ mb: 2 }} />
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <Skeleton variant="rectangular" height={56} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Skeleton variant="rectangular" height={56} />
                        </Grid>
                    </Grid>
                </Box>

                <Box sx={{ mb: 4 }}>
                    <Skeleton variant="text" width={150} height={30} sx={{ mb: 2 }} />
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <Skeleton variant="rectangular" height={56} />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <Skeleton variant="rectangular" height={56} />
                        </Grid>
                    </Grid>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
                    <Skeleton variant="rectangular" width={120} height={40} />
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

            <form onSubmit={handleSubmit} noValidate>
                {/* Shipment Type Selection */}
                <Box sx={{ mb: 4 }}>

                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <div
                                className={`shipment-type-card ${shipmentType === 'courier' ? 'selected' : ''} ${errors.shipmentType ? 'error' : ''}`}
                                onClick={() => handleShipmentTypeChange('courier')}
                                role="button"
                                tabIndex={0}
                            >
                                <InventoryIcon sx={{ fontSize: 40, mb: 1 }} />
                                <Typography variant="subtitle1">Courier</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    Fast delivery for smaller packages
                                </Typography>
                            </div>
                            {errors.shipmentType && (
                                <FormHelperText error sx={{ mt: 1, display: 'flex', alignItems: 'center' }}>
                                    <ErrorOutlineIcon sx={{ fontSize: 16, mr: 0.5 }} />
                                    {errors.shipmentType}
                                </FormHelperText>
                            )}
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <div
                                className={`shipment-type-card ${shipmentType === 'freight' ? 'selected' : ''} ${errors.shipmentType ? 'error' : ''}`}
                                onClick={() => handleShipmentTypeChange('freight')}
                                role="button"
                                tabIndex={0}
                            >
                                <LocalShippingIcon sx={{ fontSize: 40, mb: 1 }} />
                                <Typography variant="subtitle1">Freight</Typography>
                                <Typography variant="body2" color="text.secondary">
                                    For larger or bulk shipments
                                </Typography>
                            </div>
                        </Grid>
                    </Grid>
                </Box>

                <Divider sx={{ my: 3 }} />

                {/* Reference Information */}
                <Box sx={{ mb: 4 }}>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <div className="form-group">
                                <label className="form-label" htmlFor="shipperReferenceNumber">
                                    Reference Number
                                    <Tooltip title="Your internal reference for this shipment">
                                        <IconButton size="small" sx={{ ml: 0.5 }}>
                                            <InfoIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </label>
                                <input
                                    type="text"
                                    id="shipperReferenceNumber"
                                    className="form-control"
                                    value={currentData.shipperReferenceNumber || ''} // Read from context
                                    onChange={handleInputChange}
                                    placeholder="Enter reference number"
                                />
                            </div>
                        </Grid>
                    </Grid>
                </Box>

                {/* Schedule */}
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                        <AccessTimeIcon sx={{ mr: 1, fontSize: '1.2rem' }} />
                        Schedule
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                required
                                type="date"
                                id="shipmentDate"
                                label="Shipment Date"
                                value={currentData.shipmentDate || ''} // Read from context
                                onChange={handleInputChange}
                                error={!!errors.shipmentDate}
                                helperText={errors.shipmentDate}
                                InputLabelProps={{ shrink: true }}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth error={!!errors.pickupTime}>
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>Pickup Window</Typography>
                                <Grid container spacing={1}>
                                    <Grid item xs={6}>
                                        <TextField
                                            fullWidth
                                            type="time"
                                            id="earliestPickupTime"
                                            label="Earliest"
                                            value={currentData.earliestPickupTime || '05:00'} // Read from context
                                            onChange={handleInputChange}
                                            InputLabelProps={{ shrink: true }}
                                        />
                                    </Grid>
                                    <Grid item xs={6}>
                                        <TextField
                                            fullWidth
                                            type="time"
                                            id="latestPickupTime"
                                            label="Latest"
                                            value={currentData.latestPickupTime || '17:00'} // Read from context
                                            onChange={handleInputChange}
                                            InputLabelProps={{ shrink: true }}
                                        />
                                    </Grid>
                                </Grid>
                                {errors.pickupTime && (
                                    <FormHelperText error>
                                        <ErrorOutlineIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                                        {errors.pickupTime}
                                    </FormHelperText>
                                )}
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <FormControl fullWidth error={!!errors.deliveryTime}>
                                <Typography variant="subtitle2" sx={{ mb: 1 }}>Delivery Window</Typography>
                                <Grid container spacing={1}>
                                    <Grid item xs={6}>
                                        <TextField
                                            fullWidth
                                            type="time"
                                            id="earliestDeliveryTime"
                                            label="Earliest"
                                            value={currentData.earliestDeliveryTime || '09:00'} // Read from context
                                            onChange={handleInputChange}
                                            InputLabelProps={{ shrink: true }}
                                        />
                                    </Grid>
                                    <Grid item xs={6}>
                                        <TextField
                                            fullWidth
                                            type="time"
                                            id="latestDeliveryTime"
                                            label="Latest"
                                            value={currentData.latestDeliveryTime || '22:00'} // Read from context
                                            onChange={handleInputChange}
                                            InputLabelProps={{ shrink: true }}
                                        />
                                    </Grid>
                                </Grid>
                                {errors.deliveryTime && (
                                    <FormHelperText error>
                                        <ErrorOutlineIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'middle' }} />
                                        {errors.deliveryTime}
                                    </FormHelperText>
                                )}
                            </FormControl>
                        </Grid>
                    </Grid>
                </Box>

                <Divider sx={{ my: 3 }} />

                {/* Additional Services */}
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h6" sx={{ mb: 3, display: 'flex', alignItems: 'center' }}>
                        Additional Services
                    </Typography>

                    <Paper elevation={0} sx={{ p: 3, bgcolor: 'grey.50', borderRadius: 2 }}>
                        <Grid container spacing={3}>
                            {/* Dangerous Goods */}
                            <Grid item xs={12} md={6}>
                                <FormControl fullWidth>
                                    <InputLabel id="dangerous-goods-label">
                                        Dangerous Goods
                                    </InputLabel>
                                    <Select
                                        labelId="dangerous-goods-label"
                                        id="dangerousGoodsType"
                                        value={currentData.dangerousGoodsType || 'none'}
                                        label="Dangerous Goods"
                                        onChange={handleInputChange}
                                    >
                                        <MenuItem value="none">None</MenuItem>
                                        <MenuItem value="limited">Limited Quantity</MenuItem>
                                        <MenuItem value="fully-regulated">Fully Regulated</MenuItem>
                                    </Select>
                                </FormControl>
                            </Grid>

                            {/* Service Options */}
                            <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" sx={{ mb: 2, color: 'text.secondary' }}>
                                    Service Options
                                </Typography>
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                id="signatureRequired"
                                                checked={!!currentData.signatureRequired}
                                                onChange={handleInputChange}
                                                color="primary"
                                            />
                                        }
                                        label={
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                Signature Required
                                                <Tooltip title="Require signature upon delivery (recommended for security)">
                                                    <IconButton size="small" sx={{ ml: 0.5 }}>
                                                        <InfoIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        }
                                    />

                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                id="holdForPickup"
                                                checked={currentData.holdForPickup || false}
                                                onChange={handleInputChange}
                                                color="primary"
                                            />
                                        }
                                        label={
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                Hold for Pickup
                                                <Tooltip title="Package will be held at the carrier's facility for pickup">
                                                    <IconButton size="small" sx={{ ml: 0.5 }}>
                                                        <InfoIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        }
                                    />

                                    <FormControlLabel
                                        control={
                                            <Checkbox
                                                id="saturdayDelivery"
                                                checked={currentData.saturdayDelivery || false}
                                                onChange={handleInputChange}
                                                color="primary"
                                            />
                                        }
                                        label={
                                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                                Saturday Delivery
                                                <Tooltip title="Request delivery on Saturday (additional charges may apply)">
                                                    <IconButton size="small" sx={{ ml: 0.5 }}>
                                                        <InfoIcon fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </Box>
                                        }
                                    />
                                </Box>
                            </Grid>
                        </Grid>
                    </Paper>
                </Box>

                <Box sx={{
                    display: 'flex',
                    justifyContent: 'flex-end',
                    mt: 4,
                    gap: 2
                }}>
                    {/* Previous button logic might need to be added/passed if this isn't the first step */}
                    {/* <Button variant="outlined" onClick={onPrevious}>Previous</Button> */}
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleSubmit}
                        sx={{ minWidth: '120px' }}
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
                    {errorMessage}
                </Alert>
            </Snackbar>
        </div>
    );
};

export default ShipmentInfo; 