import React, { useState, useEffect } from 'react';
import {
    Box,
    Paper,
    Typography,
    TextField,
    Button,
    Grid,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Stack,
    IconButton,
    Tooltip,
} from '@mui/material';
import {
    Close as CloseIcon,
    Add as AddIcon,
    Remove as RemoveIcon,
} from '@mui/icons-material';
import AdminBreadcrumb from '../AdminBreadcrumb';
import './CompanyForm.css';

const CompanyForm = ({ company = null, onSubmit, onCancel }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        address: '',
        type: '',
        status: 'active',
        contacts: [{ name: '', email: '', phone: '', role: '' }],
    });

    useEffect(() => {
        if (company) {
            setFormData({
                ...company,
                contacts: company.contacts || [{ name: '', email: '', phone: '', role: '' }],
            });
        }
    }, [company]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleContactChange = (index, field, value) => {
        setFormData((prev) => ({
            ...prev,
            contacts: prev.contacts.map((contact, i) =>
                i === index ? { ...contact, [field]: value } : contact
            ),
        }));
    };

    const addContact = () => {
        setFormData((prev) => ({
            ...prev,
            contacts: [...prev.contacts, { name: '', email: '', phone: '', role: '' }],
        }));
    };

    const removeContact = (index) => {
        setFormData((prev) => ({
            ...prev,
            contacts: prev.contacts.filter((_, i) => i !== index),
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    return (
        <Box className="admin-company-form">
            <AdminBreadcrumb items={['Companies', company ? 'Edit Company' : 'Add Company']} />

            <Paper className="company-form-paper">
                <Box className="form-header">
                    <Typography variant="h4" className="form-title">
                        {company ? 'Edit Company' : 'Add New Company'}
                    </Typography>
                    <Tooltip title="Close">
                        <IconButton onClick={onCancel} size="small">
                            <CloseIcon />
                        </IconButton>
                    </Tooltip>
                </Box>

                <form onSubmit={handleSubmit}>
                    <Grid container spacing={3}>
                        {/* Company Information */}
                        <Grid item xs={12}>
                            <Typography variant="h6" className="section-title">
                                Company Information
                            </Typography>
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Company Name"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Email"
                                name="email"
                                type="email"
                                value={formData.email}
                                onChange={handleChange}
                                required
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Phone"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                required
                            />
                        </Grid>

                        <Grid item xs={12} md={6}>
                            <FormControl fullWidth required>
                                <InputLabel>Company Type</InputLabel>
                                <Select
                                    name="type"
                                    value={formData.type}
                                    onChange={handleChange}
                                    label="Company Type"
                                >
                                    <MenuItem value="Enterprise">Enterprise</MenuItem>
                                    <MenuItem value="SMB">SMB</MenuItem>
                                    <MenuItem value="Startup">Startup</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Address"
                                name="address"
                                value={formData.address}
                                onChange={handleChange}
                                multiline
                                rows={3}
                                required
                            />
                        </Grid>

                        {/* Contact Information */}
                        <Grid item xs={12}>
                            <Box className="contacts-section">
                                <Typography variant="h6" className="section-title">
                                    Contact Information
                                </Typography>
                                <Button
                                    startIcon={<AddIcon />}
                                    onClick={addContact}
                                    className="add-contact-btn"
                                >
                                    Add Contact
                                </Button>
                            </Box>
                        </Grid>

                        {formData.contacts.map((contact, index) => (
                            <Grid item xs={12} key={index}>
                                <Paper className="contact-card">
                                    <Box className="contact-header">
                                        <Typography variant="subtitle1">
                                            Contact {index + 1}
                                        </Typography>
                                        {index > 0 && (
                                            <Tooltip title="Remove Contact">
                                                <IconButton
                                                    size="small"
                                                    onClick={() => removeContact(index)}
                                                >
                                                    <RemoveIcon />
                                                </IconButton>
                                            </Tooltip>
                                        )}
                                    </Box>

                                    <Grid container spacing={2}>
                                        <Grid item xs={12} sm={6}>
                                            <TextField
                                                fullWidth
                                                label="Name"
                                                value={contact.name}
                                                onChange={(e) =>
                                                    handleContactChange(index, 'name', e.target.value)
                                                }
                                                required
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <TextField
                                                fullWidth
                                                label="Email"
                                                type="email"
                                                value={contact.email}
                                                onChange={(e) =>
                                                    handleContactChange(index, 'email', e.target.value)
                                                }
                                                required
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <TextField
                                                fullWidth
                                                label="Phone"
                                                value={contact.phone}
                                                onChange={(e) =>
                                                    handleContactChange(index, 'phone', e.target.value)
                                                }
                                                required
                                            />
                                        </Grid>
                                        <Grid item xs={12} sm={6}>
                                            <TextField
                                                fullWidth
                                                label="Role"
                                                value={contact.role}
                                                onChange={(e) =>
                                                    handleContactChange(index, 'role', e.target.value)
                                                }
                                                required
                                            />
                                        </Grid>
                                    </Grid>
                                </Paper>
                            </Grid>
                        ))}

                        {/* Form Actions */}
                        <Grid item xs={12}>
                            <Stack direction="row" spacing={2} justifyContent="flex-end">
                                <Button
                                    variant="outlined"
                                    onClick={onCancel}
                                    className="cancel-btn"
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    variant="contained"
                                    className="submit-btn"
                                >
                                    {company ? 'Update Company' : 'Create Company'}
                                </Button>
                            </Stack>
                        </Grid>
                    </Grid>
                </form>
            </Paper>
        </Box>
    );
};

export default CompanyForm; 