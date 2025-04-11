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
    Button
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import './ShipmentInfo.css';

const ShipmentInfo = ({ data, onDataChange, onNext, onPrevious }) => {
    console.log('deploy test confirmed - ShipmentInfo component loaded');
    const [formData, setFormData] = useState({
        shipmentType: data?.shipmentType || 'courier',
        internationalShipment: data?.internationalShipment || false,
        shipperReferenceNumber: data?.shipperReferenceNumber || '',
        bookingReferenceNumber: data?.bookingReferenceNumber || '',
        bookingReferenceType: 'Shipment',
        shipmentBillType: 'DefaultLogisticsPlus',
        shipmentDate: data?.shipmentDate || '',
        earliestPickupTime: data?.earliestPickupTime || '05:00',
        latestPickupTime: data?.latestPickupTime || '17:00',
        earliestDeliveryTime: data?.earliestDeliveryTime || '09:00',
        latestDeliveryTime: data?.latestDeliveryTime || '22:00',
        dangerousGoodsType: data?.dangerousGoodsType || 'none',
        signatureServiceType: data?.signatureServiceType || 'none',
        holdForPickup: data?.holdForPickup || false,
        saturdayDelivery: data?.saturdayDelivery || false,
        dutibleAmount: 0.00,
        dutibleCurrency: 'CDN',
        numberOfPackages: 1
    });

    const [errors, setErrors] = useState({});
    const [showErrorSnackbar, setShowErrorSnackbar] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const prevFormDataRef = useRef(formData);

    // Update form data when data prop changes
    useEffect(() => {
        if (data && Object.keys(data).length > 0) {
            console.log('Updating form data from props:', data);
            setFormData(prevData => {
                // Only update if the data is different
                if (JSON.stringify(prevData) !== JSON.stringify(data)) {
                    return {
                        shipmentType: data.shipmentType || 'courier',
                        internationalShipment: data.internationalShipment || false,
                        shipperReferenceNumber: data.shipperReferenceNumber || '',
                        bookingReferenceNumber: data.bookingReferenceNumber || '',
                        shipmentDate: data.shipmentDate || '',
                        earliestPickupTime: data.earliestPickupTime || '05:00',
                        latestPickupTime: data.latestPickupTime || '17:00',
                        earliestDeliveryTime: data.earliestDeliveryTime || '09:00',
                        latestDeliveryTime: data.latestDeliveryTime || '22:00',
                        holdForPickup: data.holdForPickup || false,
                        saturdayDelivery: data.saturdayDelivery || false,
                        dangerousGoodsType: data.dangerousGoodsType || 'none',
                        signatureServiceType: data.signatureServiceType || 'none'
                    };
                }
                return prevData;
            });
        }
    }, [data]);

    // Only call onDataChange when formData actually changes
    useEffect(() => {
        const formDataString = JSON.stringify(formData);
        const prevFormDataString = JSON.stringify(prevFormDataRef.current);

        if (formDataString !== prevFormDataString) {
            console.log('Form data changed, updating parent:', formData);
            onDataChange(formData);
            prevFormDataRef.current = formData;
        }
    }, [formData, onDataChange]);

    const handleInputChange = (e) => {
        const { id, value, type } = e.target;
        const newValue = type === 'checkbox' ? e.target.checked : value;
        console.log('Input changed:', id, newValue);
        setFormData(prev => ({
            ...prev,
            [id]: newValue
        }));
        // Clear error when field is modified
        if (errors[id]) {
            setErrors(prev => ({ ...prev, [id]: null }));
        }
    };

    const handleShipmentTypeChange = (type) => {
        console.log('Shipment type changed:', type);
        setFormData(prev => ({
            ...prev,
            shipmentType: type
        }));
        if (errors.shipmentType) {
            setErrors(prev => ({ ...prev, shipmentType: null }));
        }
    };

    const validateForm = () => {
        console.log('Validating form with data:', formData);
        const newErrors = {};

        // Check if any required field is empty
        const requiredFields = ['shipmentType', 'shipmentDate'];
        const hasEmptyRequiredFields = requiredFields.some(field => !formData[field]);

        if (hasEmptyRequiredFields) {
            setErrorMessage('Please fill in all required fields');
            setShowErrorSnackbar(true);
            return false;
        }

        // Check required fields
        if (!formData.shipmentType) {
            newErrors.shipmentType = 'Please select a shipment type';
        }

        if (!formData.shipmentDate) {
            newErrors.shipmentDate = 'Please select a shipment date';
        } else {
            // Validate shipment date is not in the past
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const selectedDate = new Date(formData.shipmentDate);
            if (selectedDate < today) {
                newErrors.shipmentDate = 'Shipment date cannot be in the past';
            }
        }

        // Validate time windows
        const earliestPickup = new Date(`2000-01-01T${formData.earliestPickupTime}`);
        const latestPickup = new Date(`2000-01-01T${formData.latestPickupTime}`);
        if (earliestPickup >= latestPickup) {
            newErrors.pickupTime = 'Latest pickup time must be after earliest pickup time';
        }

        const earliestDelivery = new Date(`2000-01-01T${formData.earliestDeliveryTime}`);
        const latestDelivery = new Date(`2000-01-01T${formData.latestDeliveryTime}`);
        if (earliestDelivery >= latestDelivery) {
            newErrors.deliveryTime = 'Latest delivery time must be after earliest delivery time';
        }

        setErrors(newErrors);
        const isValid = Object.keys(newErrors).length === 0;
        console.log('Form validation result:', isValid, newErrors);
        return isValid;
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        e.stopPropagation();

        console.log('Form submitted with data:', formData);

        // Check if form data is empty
        const isEmpty = Object.values(formData).every(value =>
            value === '' || value === false || value === null || value === undefined
        );

        if (isEmpty) {
            setErrorMessage('Please fill in at least one field before proceeding');
            setShowErrorSnackbar(true);
            return;
        }

        const isValid = validateForm();

        if (!isValid) {
            // Scroll to the first error
            const firstErrorField = Object.keys(errors)[0];
            if (firstErrorField) {
                const element = document.getElementById(firstErrorField);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
            return;
        }

        // Only proceed if validation passes
        onDataChange(formData);
        onNext();
    };

    const handleCloseSnackbar = () => {
        setShowErrorSnackbar(false);
    };

    return (
        <div className="form-section">
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" component="h3" className="form-section-title">
                    Shipment Details
                </Typography>
            </Box>

            <form onSubmit={handleSubmit} noValidate>
                {/* Shipment Type Selection */}
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center' }}>
                        <LocalShippingIcon sx={{ mr: 1, fontSize: '1.2rem' }} />
                        Shipment Type
                        <Tooltip title="Select the type of shipment service you need">
                            <IconButton size="small" sx={{ ml: 1 }}>
                                <InfoIcon fontSize="small" />
                            </IconButton>
                        </Tooltip>
                    </Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
                            <div
                                className={`shipment-type-card ${formData.shipmentType === 'courier' ? 'selected' : ''} ${errors.shipmentType ? 'error' : ''}`}
                                onClick={() => handleShipmentTypeChange('courier')}
                                role="button"
                                tabIndex={0}
                            >
                                <LocalShippingIcon sx={{ fontSize: 40, mb: 1 }} />
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
                                className={`shipment-type-card ${formData.shipmentType === 'freight' ? 'selected' : ''} ${errors.shipmentType ? 'error' : ''}`}
                                onClick={() => handleShipmentTypeChange('freight')}
                                role="button"
                                tabIndex={0}
                            >
                                <AddCircleIcon sx={{ fontSize: 40, mb: 1 }} />
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
                    <Typography variant="h6" sx={{ mb: 2 }}>Reference Information</Typography>
                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6}>
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
                                    value={formData.shipperReferenceNumber}
                                    onChange={handleInputChange}
                                    placeholder="Enter reference number"
                                />
                            </div>
                        </Grid>
                        <Grid item xs={12} sm={6}>
                            <div className="form-group">
                                <label className="form-label" htmlFor="bookingReferenceNumber">
                                    Booking Reference
                                    <Tooltip title="Carrier booking reference if available">
                                        <IconButton size="small" sx={{ ml: 0.5 }}>
                                            <InfoIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </label>
                                <input
                                    type="text"
                                    id="bookingReferenceNumber"
                                    className="form-control"
                                    value={formData.bookingReferenceNumber}
                                    onChange={handleInputChange}
                                    placeholder="Enter booking reference"
                                />
                            </div>
                        </Grid>
                    </Grid>
                </Box>

                <Divider sx={{ my: 3 }} />

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
                                value={formData.shipmentDate}
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
                                            value={formData.earliestPickupTime}
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
                                            value={formData.latestPickupTime}
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
                                            value={formData.earliestDeliveryTime}
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
                                            value={formData.latestDeliveryTime}
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
                                    value={formData.dangerousGoodsType}
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
                                    value={formData.signatureServiceType}
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
                                            checked={formData.holdForPickup}
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
                                            checked={formData.saturdayDelivery}
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