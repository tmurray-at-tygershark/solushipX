import React, { useCallback, useState } from 'react';
import {
    Box,
    Typography,
    TextField,
    FormControl,
    FormControlLabel,
    Radio,
    RadioGroup,
    Grid,
    Paper,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Button,
    IconButton,
    Divider
} from '@mui/material';
import {
    ExpandMore as ExpandMoreIcon,
    Add as AddIcon,
    Remove as RemoveIcon,
    Api as ApiIcon,
    Email as EmailIcon
} from '@mui/icons-material';

const defaultEndpoints = [
    { key: 'rate', label: 'Rate Quotes', placeholder: '/api/v1/rates' },
    { key: 'booking', label: 'Booking/Shipment Creation', placeholder: '/api/v1/shipments' },
    { key: 'tracking', label: 'Tracking Updates', placeholder: '/api/v1/tracking' },
    { key: 'cancel', label: 'Cancel Shipment', placeholder: '/api/v1/cancel' },
    { key: 'labels', label: 'Generate Labels', placeholder: '/api/v1/labels' },
    { key: 'status', label: 'Status Updates', placeholder: '/api/v1/status' }
];

const requiredEmailSection = {
    key: 'carrierConfirmationEmails',
    label: 'Carrier Confirmation Emails',
    required: true,
    description: 'Emails that receive booking confirmations'
};

const optionalEmailSections = [
    {
        key: 'carrierNotificationEmails',
        label: 'Carrier Notification Emails',
        required: false,
        description: 'Emails for general notifications and updates'
    },
    {
        key: 'preArrivalNotificationEmails',
        label: 'Pre-Arrival Notification Emails',
        required: false,
        description: 'Emails for delivery notification alerts'
    },
    {
        key: 'rateRequestEmails',
        label: 'Rate Request Emails',
        required: false,
        description: 'Emails for rate quote requests'
    },
    {
        key: 'billingEmails',
        label: 'Billing Emails',
        required: false,
        description: 'Emails for invoicing and billing information'
    }
];

// Email Array Field Component
const EmailArrayField = ({ section, data, onUpdate, errors, required = false }) => {
    const emails = data.emailConfiguration[section.key] || [''];

    const handleEmailChange = (index, value) => {
        const newEmails = [...emails];
        newEmails[index] = value;
        onUpdate({
            emailConfiguration: {
                ...data.emailConfiguration,
                [section.key]: newEmails
            }
        });
    };

    const handleAddEmail = () => {
        const newEmails = [...emails, ''];
        onUpdate({
            emailConfiguration: {
                ...data.emailConfiguration,
                [section.key]: newEmails
            }
        });
    };

    const handleRemoveEmail = (index) => {
        if (emails.length > 1) {
            const newEmails = emails.filter((_, i) => i !== index);
            onUpdate({
                emailConfiguration: {
                    ...data.emailConfiguration,
                    [section.key]: newEmails
                }
            });
        }
    };

    return (
        <Box sx={{ mb: 3 }}>
            <Typography sx={{ fontSize: '12px', fontWeight: 500, mb: 1, color: '#374151' }}>
                {section.label} {required && <span style={{ color: '#dc2626' }}>*</span>}
            </Typography>
            <Typography sx={{ fontSize: '11px', color: '#6b7280', mb: 2 }}>
                {section.description}
            </Typography>

            {emails.map((email, index) => (
                <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <TextField
                        fullWidth
                        size="small"
                        type="email"
                        value={email}
                        onChange={(e) => handleEmailChange(index, e.target.value)}
                        placeholder="email@example.com"
                        error={!!errors[section.key]}
                        sx={{
                            '& .MuiInputBase-input': { fontSize: '12px' }
                        }}
                    />
                    {emails.length > 1 && (
                        <IconButton
                            size="small"
                            onClick={() => handleRemoveEmail(index)}
                            sx={{ color: '#dc2626' }}
                        >
                            <RemoveIcon sx={{ fontSize: '16px' }} />
                        </IconButton>
                    )}
                </Box>
            ))}

            <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddEmail}
                sx={{ fontSize: '11px', mt: 1 }}
                variant="outlined"
            >
                Add Email
            </Button>

            {errors[section.key] && (
                <Typography sx={{ fontSize: '11px', color: '#dc2626', mt: 1 }}>
                    {errors[section.key]}
                </Typography>
            )}
        </Box>
    );
};

const ConnectionConfigStep = ({ data, onUpdate, errors, setErrors }) => {
    const [optionalEmailsExpanded, setOptionalEmailsExpanded] = useState(false);
    // Handle connection type change
    const handleConnectionTypeChange = useCallback((event) => {
        const newConnectionType = event.target.value;
        onUpdate({ connectionType: newConnectionType });

        // Clear connection-specific errors
        setErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors.hostURL;
            delete newErrors.carrierConfirmationEmails;
            return newErrors;
        });
    }, [onUpdate, setErrors]);

    // Handle API credentials change
    const handleApiCredentialChange = useCallback((field, value) => {
        onUpdate({
            apiCredentials: {
                ...data.apiCredentials,
                [field]: value
            }
        });

        // Clear field error
        if (errors[field]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    }, [data.apiCredentials, onUpdate, errors, setErrors]);

    // Handle endpoint change
    const handleEndpointChange = useCallback((endpointKey, value) => {
        onUpdate({
            apiCredentials: {
                ...data.apiCredentials,
                endpoints: {
                    ...data.apiCredentials.endpoints,
                    [endpointKey]: value
                }
            }
        });
    }, [data.apiCredentials, onUpdate]);

    return (
        <Box sx={{ width: '100%' }}>
            <Typography variant="h6" sx={{ mb: 3, fontSize: '16px', fontWeight: 600 }}>
                Connection Configuration
            </Typography>

            {/* Connection Type Selection */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography sx={{ fontSize: '14px', fontWeight: 500, mb: 2 }}>
                    Connection Type
                </Typography>

                <FormControl component="fieldset">
                    <RadioGroup
                        value={data.connectionType || 'api'}
                        onChange={handleConnectionTypeChange}
                        row
                    >
                        <FormControlLabel
                            value="api"
                            control={<Radio />}
                            label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <ApiIcon sx={{ fontSize: '18px' }} />
                                    <Box>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                            API Integration
                                        </Typography>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                            Automatic rate fetching via carrier API
                                        </Typography>
                                    </Box>
                                </Box>
                            }
                        />
                        <FormControlLabel
                            value="manual"
                            control={<Radio />}
                            label={
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <EmailIcon sx={{ fontSize: '18px' }} />
                                    <Box>
                                        <Typography sx={{ fontSize: '12px', fontWeight: 500 }}>
                                            Manual Connection
                                        </Typography>
                                        <Typography sx={{ fontSize: '11px', color: '#6b7280' }}>
                                            Manual rate setting via phone/email contact
                                        </Typography>
                                    </Box>
                                </Box>
                            }
                        />
                    </RadioGroup>
                </FormControl>
            </Paper>

            {/* API Configuration */}
            {data.connectionType === 'api' && (
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Typography sx={{ fontSize: '14px', fontWeight: 500, mb: 3, color: '#1976d2' }}>
                        API Configuration
                    </Typography>

                    <Grid container spacing={3}>
                        {/* Host URL */}
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="Host URL"
                                value={data.apiCredentials?.hostURL || ''}
                                onChange={(e) => handleApiCredentialChange('hostURL', e.target.value)}
                                error={!!errors.hostURL}
                                helperText={errors.hostURL || 'Base URL for the carrier API (e.g., https://api.carrier.com)'}
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                                required
                            />
                        </Grid>

                        {/* Username */}
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Username"
                                value={data.apiCredentials?.username || ''}
                                onChange={(e) => handleApiCredentialChange('username', e.target.value)}
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                            />
                        </Grid>

                        {/* Password */}
                        <Grid item xs={12} sm={6}>
                            <TextField
                                fullWidth
                                label="Password"
                                type="password"
                                value={data.apiCredentials?.password || ''}
                                onChange={(e) => handleApiCredentialChange('password', e.target.value)}
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                            />
                        </Grid>

                        {/* API Secret */}
                        <Grid item xs={12}>
                            <TextField
                                fullWidth
                                label="API Secret/Key"
                                value={data.apiCredentials?.secret || ''}
                                onChange={(e) => handleApiCredentialChange('secret', e.target.value)}
                                sx={{
                                    '& .MuiInputBase-input': { fontSize: '12px' },
                                    '& .MuiInputLabel-root': { fontSize: '12px' }
                                }}
                                helperText="API key or secret token for authentication"
                            />
                        </Grid>
                    </Grid>

                    {/* API Endpoints */}
                    <Accordion sx={{ mt: 3 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                            <Typography sx={{ fontSize: '13px', fontWeight: 500 }}>
                                API Endpoints (Optional)
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails>
                            <Grid container spacing={2}>
                                {defaultEndpoints.map((endpoint) => (
                                    <Grid item xs={12} sm={6} key={endpoint.key}>
                                        <TextField
                                            fullWidth
                                            size="small"
                                            label={endpoint.label}
                                            value={data.apiCredentials?.endpoints?.[endpoint.key] || ''}
                                            onChange={(e) => handleEndpointChange(endpoint.key, e.target.value)}
                                            placeholder={endpoint.placeholder}
                                            sx={{
                                                '& .MuiInputBase-input': { fontSize: '12px' },
                                                '& .MuiInputLabel-root': { fontSize: '12px' }
                                            }}
                                        />
                                    </Grid>
                                ))}
                            </Grid>
                            <Typography sx={{ fontSize: '11px', color: '#6b7280', mt: 2 }}>
                                Leave endpoints empty to use default API discovery.
                                These will be appended to the Host URL.
                            </Typography>
                        </AccordionDetails>
                    </Accordion>
                </Paper>
            )}

            {/* Carrier Confirmation Emails - Show for ALL connection types */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Typography sx={{ fontSize: '14px', fontWeight: 500, mb: 3, color: '#2e7d32' }}>
                    Dispatch & Confirmation Emails
                </Typography>
                <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                    These emails will receive booking confirmations and dispatch notifications for shipments.
                </Typography>

                {/* Required Email Field - Always shown */}
                <EmailArrayField
                    section={requiredEmailSection}
                    data={data}
                    onUpdate={onUpdate}
                    errors={errors}
                    required={true}
                />
            </Paper>

            {/* Additional Email Configuration - Manual carriers only */}
            {data.connectionType === 'manual' && (
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Typography sx={{ fontSize: '14px', fontWeight: 500, mb: 3, color: '#9c27b0' }}>
                        Additional Email Configuration
                    </Typography>
                    <Typography sx={{ fontSize: '12px', color: '#6b7280', mb: 3 }}>
                        Configure additional email triggers for manual carrier communications.
                    </Typography>

                    {/* Optional Email Fields - Collapsed by default */}
                    <Accordion
                        expanded={optionalEmailsExpanded}
                        onChange={() => setOptionalEmailsExpanded(!optionalEmailsExpanded)}
                        sx={{ boxShadow: 'none', '&:before': { display: 'none' } }}
                    >
                        <AccordionSummary
                            expandIcon={<ExpandMoreIcon />}
                            sx={{
                                px: 0,
                                '& .MuiAccordionSummary-content': { margin: '8px 0' }
                            }}
                        >
                            <Typography sx={{ fontSize: '13px', fontWeight: 500, color: '#6b7280' }}>
                                Additional Email Triggers (Optional)
                            </Typography>
                        </AccordionSummary>
                        <AccordionDetails sx={{ px: 0, pt: 0 }}>
                            {optionalEmailSections.map((section) => (
                                <EmailArrayField
                                    key={section.key}
                                    section={section}
                                    data={data}
                                    onUpdate={onUpdate}
                                    errors={errors}
                                    required={false}
                                />
                            ))}
                        </AccordionDetails>
                    </Accordion>
                </Paper>
            )}

            {/* Step Description */}
            <Box sx={{ mt: 4, p: 2, backgroundColor: '#f8fafc', borderRadius: 1 }}>
                <Typography sx={{ fontSize: '12px', color: '#6b7280' }}>
                    <strong>Step 2:</strong> Configure how your system will connect to this carrier.
                    Choose API integration for automated rate fetching or manual connection for
                    phone/email-based communication. {data.connectionType === 'api' ?
                        'API credentials will be used to automatically fetch rates and create shipments.' :
                        'Email addresses will be used to send rate requests and receive confirmations.'}
                </Typography>
            </Box>
        </Box>
    );
};

export default ConnectionConfigStep; 