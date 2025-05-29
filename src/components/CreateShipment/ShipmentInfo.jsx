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
    Skeleton
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
    console.log('deploy test confirmed - ShipmentInfo component loaded');
    // Get state and update function from context
    const { formData, updateFormSection } = useShipmentForm();
    // Use a local state for errors, still managed locally
    const [errors, setErrors] = useState({});
    const [showErrorSnackbar, setShowErrorSnackbar] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Set default shipment date to today if not already set
        // and if shipmentInfo itself exists to avoid errors on initial context load
        if (formData.shipmentInfo && !formData.shipmentInfo.shipmentDate) {
            updateFormSection('shipmentInfo', { ...formData.shipmentInfo, shipmentDate: formatDateForInput(new Date()) });
        }

        // Set default shipment type to 'courier' if not already set
        if (formData.shipmentInfo && !formData.shipmentInfo.shipmentType) {
            updateFormSection('shipmentInfo', { ...formData.shipmentInfo, shipmentType: 'courier' });
        }
    }, [formData.shipmentInfo, updateFormSection]); // Rerun if shipmentInfo object changes or updateFormSection changes

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
        console.log('Input changed:', id, newValue);
        // Update context directly
        updateFormSection('shipmentInfo', { [id]: newValue });
        // Clear error when field is modified
        if (errors[id]) {
            setErrors(prev => ({ ...prev, [id]: null }));
        }
    };

    const handleShipmentTypeChange = (type) => {
        console.log('Shipment type changed:', type);
        // Update context directly
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
        console.log('ShipmentInfo handleSubmit: Validating data from context:', currentShipmentInfo);

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
        console.log("ShipmentInfo handleSubmit: Validation passed. Calling onNext with data from context:", currentShipmentInfo);
        onNext(currentShipmentInfo); // Pass the validated shipmentInfo data from context to the parent
    };

    const handleCloseSnackbar = () => {
        setShowErrorSnackbar(false);
    };

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

    // Read values directly from context for rendering
    const currentData = formData.shipmentInfo || {};

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
                                className={`shipment-type-card ${currentData.shipmentType === 'courier' ? 'selected' : ''} ${errors.shipmentType ? 'error' : ''}`}
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
                                className={`shipment-type-card ${currentData.shipmentType === 'freight' ? 'selected' : ''} ${errors.shipmentType ? 'error' : ''}`}
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
                    <Typography variant="h6" sx={{ mb: 2 }}>Additional Services</Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <div className="form-group">
                                <label className="form-label" htmlFor="dangerousGoodsType">
                                    Dangerous Goods
                                    <Tooltip title="Select if your shipment contains hazardous materials">
                                        <IconButton size="small" sx={{ ml: 0.5 }}>
                                            <InfoIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </label>
                                <select
                                    id="dangerousGoodsType"
                                    className="form-control"
                                    value={currentData.dangerousGoodsType || 'none'} // Read from context
                                    onChange={handleInputChange}
                                >
                                    <option value="none">None</option>
                                    <option value="limited">Limited Quantity</option>
                                    <option value="fully-regulated">Fully Regulated</option>
                                </select>
                            </div>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <div className="form-group">
                                <label className="form-label" htmlFor="signatureServiceType">
                                    Signature Service
                                    <Tooltip title="Select signature requirement for delivery">
                                        <IconButton size="small" sx={{ ml: 0.5 }}>
                                            <InfoIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </label>
                                <select
                                    id="signatureServiceType"
                                    className="form-control"
                                    value={currentData.signatureServiceType || 'none'} // Read from context
                                    onChange={handleInputChange}
                                >
                                    <option value="none">None</option>
                                    <option value="direct">Direct Signature</option>
                                    <option value="adult">Adult Signature</option>
                                </select>
                            </div>
                        </Grid>
                        <Grid item xs={12}>
                            <div className="form-group">
                                <div className="checkbox-group">
                                    <div className="form-check">
                                        <input
                                            type="checkbox"
                                            id="holdForPickup"
                                            className="form-check-input"
                                            checked={currentData.holdForPickup || false} // Read from context
                                            onChange={handleInputChange}
                                        />
                                        <label className="form-check-label" htmlFor="holdForPickup">
                                            Hold for Pickup
                                            <Tooltip title="Package will be held at the carrier's facility for pickup">
                                                <IconButton size="small" sx={{ ml: 0.5 }}>
                                                    <InfoIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </label>
                                    </div>
                                    <div className="form-check">
                                        <input
                                            type="checkbox"
                                            id="saturdayDelivery"
                                            className="form-check-input"
                                            checked={currentData.saturdayDelivery || false} // Read from context
                                            onChange={handleInputChange}
                                        />
                                        <label className="form-check-label" htmlFor="saturdayDelivery">
                                            Saturday Delivery
                                            <Tooltip title="Request delivery on Saturday (additional charges may apply)">
                                                <IconButton size="small" sx={{ ml: 0.5 }}>
                                                    <InfoIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </Grid>
                    </Grid>
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