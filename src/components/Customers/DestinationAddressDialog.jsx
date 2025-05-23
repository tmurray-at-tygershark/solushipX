import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Grid,
    FormControlLabel,
    Checkbox,
    FormControl,
    InputLabel,
    Select,
    MenuItem
} from '@mui/material';

const DestinationAddressDialog = ({ open, onClose, addressData, onSave, customerID }) => {
    const initialFormState = {
        nickname: '',
        companyName: '',
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address1: '',
        address2: '',
        city: '',
        stateProv: '',
        zipPostal: '',
        country: 'US',
        isDefault: false,
        specialInstructions: '',
    };

    const [formState, setFormState] = useState(initialFormState);

    useEffect(() => {
        console.log("DestinationAddressDialog: useEffect triggered. addressData prop is:", addressData ? JSON.parse(JSON.stringify(addressData)) : addressData, "Open prop is:", open);

        if (open && addressData && addressData.id) { // Ensure dialog is open AND we have an address with an ID for editing
            console.log("DestinationAddressDialog: Populating form for EDIT with addressData.id:", addressData.id);
            setFormState({
                nickname: addressData.nickname || '',
                companyName: addressData.companyName || '',
                firstName: addressData.firstName || '',
                lastName: addressData.lastName || '',
                email: addressData.email || '',
                phone: addressData.phone || '',
                address1: addressData.address1 || '',
                address2: addressData.address2 || '',
                city: addressData.city || '',
                stateProv: addressData.stateProv || '',
                zipPostal: addressData.zipPostal || '',
                country: addressData.country || 'US',
                isDefault: addressData.isDefault || false,
                specialInstructions: addressData.specialInstructions || '',
                id: addressData.id
            });
        } else if (open) { // Dialog is open, but not for edit (either new or prefill without id yet)
            console.log("DestinationAddressDialog: Open, but no ID on addressData. Resetting/prefilling.");
            const initialStateToUse = addressData ? // addressData might be a prefill object without an ID
                { ...initialFormState, ...addressData, id: null } :
                initialFormState;
            setFormState(initialStateToUse);
        } else {
            // If dialog is not open, we could optionally reset, but often not necessary 
            // as it resets on close anyway via handleClose.
            // setFormState(initialFormState); 
        }
    }, [addressData, open]); // RESTORED `open` to dependency array, also check `open` in conditions

    const handleChange = (event) => {
        const { name, value, type, checked } = event.target;
        setFormState(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSave = () => {
        if (!customerID) {
            alert("Customer ID is missing. Cannot save address."); // Or use a proper snackbar
            return;
        }
        onSave({
            ...formState,
            addressClass: 'customer',
            addressClassID: customerID,
            addressType: 'destination',
        });
        handleClose();
    };

    const handleClose = () => {
        setFormState(initialFormState); // Reset form on close
        onClose();
    };

    const dialogTitle = formState.id ? 'Edit Destination Address' : 'Add New Destination Address';

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogContent>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            label="Nickname (e.g., Main Warehouse, East Office)"
                            name="nickname"
                            value={formState.nickname}
                            onChange={handleChange}
                            fullWidth
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            label="Company Name (at destination)"
                            name="companyName"
                            value={formState.companyName}
                            onChange={handleChange}
                            fullWidth
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            label="Contact First Name"
                            name="firstName"
                            value={formState.firstName}
                            onChange={handleChange}
                            fullWidth
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            label="Contact Last Name"
                            name="lastName"
                            value={formState.lastName}
                            onChange={handleChange}
                            fullWidth
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            label="Contact Email"
                            name="email"
                            type="email"
                            value={formState.email}
                            onChange={handleChange}
                            fullWidth
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            label="Contact Phone"
                            name="phone"
                            value={formState.phone}
                            onChange={handleChange}
                            fullWidth
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField
                            label="Address Line 1"
                            name="address1"
                            value={formState.address1}
                            onChange={handleChange}
                            fullWidth
                            required
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <TextField
                            label="Address Line 2"
                            name="address2"
                            value={formState.address2}
                            onChange={handleChange}
                            fullWidth
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                        <TextField
                            label="City"
                            name="city"
                            value={formState.city}
                            onChange={handleChange}
                            fullWidth
                            required
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                        <TextField
                            label="State/Province"
                            name="stateProv"
                            value={formState.stateProv}
                            onChange={handleChange}
                            fullWidth
                            required
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <TextField
                            label="Zip/Postal Code"
                            name="zipPostal"
                            value={formState.zipPostal}
                            onChange={handleChange}
                            fullWidth
                            required
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <FormControl fullWidth required>
                            <InputLabel id="destination-country-label">Country</InputLabel>
                            <Select
                                labelId="destination-country-label"
                                name="country"
                                value={formState.country}
                                label="Country"
                                onChange={handleChange}
                            >
                                <MenuItem value="US">United States</MenuItem>
                                <MenuItem value="CA">Canada</MenuItem>
                                {/* Add more countries as needed */}
                            </Select>
                        </FormControl>
                    </Grid>
                    <Grid item xs={12}>
                        <TextField
                            label="Special Instructions"
                            name="specialInstructions"
                            value={formState.specialInstructions}
                            onChange={handleChange}
                            fullWidth
                            multiline
                            rows={2}
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <FormControlLabel
                            control={<Checkbox checked={formState.isDefault} onChange={handleChange} name="isDefault" />}
                            label="Set as default destination address"
                        />
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>Cancel</Button>
                <Button onClick={handleSave} variant="contained" color="primary">
                    Save Destination
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default DestinationAddressDialog; 