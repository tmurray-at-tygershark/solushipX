import React, { useState, useEffect } from 'react';
import {
    TextField,
    Autocomplete,
    Box,
    Typography,
    Chip,
    Paper
} from '@mui/material';
import {
    LocationOn as LocationIcon
} from '@mui/icons-material';

const EmailSelectorDropdown = ({
    carrier,
    value, // This will be the terminal ID, not individual contact ID
    onChange,
    label = "Select Terminal",
    size = "small",
    fullWidth = true,
    ...otherProps
}) => {
    const [terminalOptions, setTerminalOptions] = useState([]);

    useEffect(() => {
        if (!carrier?.emailContacts) {
            setTerminalOptions([]);
            return;
        }

        // Create terminal options with summary info
        const options = carrier.emailContacts.map(terminal => {
            // Count total contacts across all types
            const totalContacts = terminal.contacts?.reduce((count, contactType) =>
                count + (contactType.emails?.filter(email => email.trim()).length || 0), 0) || 0;

            // Get breakdown by contact type
            const contactBreakdown = {};
            if (terminal.contacts) {
                terminal.contacts.forEach(contactType => {
                    const emailCount = contactType.emails?.filter(email => email.trim()).length || 0;
                    if (emailCount > 0) {
                        contactBreakdown[contactType.type] = emailCount;
                    }
                });
            }

            return {
                id: terminal.id,
                name: terminal.name,
                isDefault: terminal.isDefault,
                totalContacts,
                contactBreakdown,
                terminal // Keep full terminal data for reference
            };
        });

        // Sort: default terminal first, then by name
        options.sort((a, b) => {
            if (a.isDefault && !b.isDefault) return -1;
            if (!a.isDefault && b.isDefault) return 1;
            return a.name.localeCompare(b.name);
        });

        setTerminalOptions(options);
    }, [carrier]);

    const getSelectedTerminal = () => {
        if (!value || !terminalOptions) return null;
        return terminalOptions.find(option => option.id === value) || null;
    };

    const handleTerminalChange = (event, newValue) => {
        if (newValue) {
            // Pass back the terminal ID and full terminal data
            onChange(newValue.id, newValue.terminal);
        } else {
            onChange('', null);
        }
    };

    const selectedTerminal = getSelectedTerminal();

    const getContactTypeLabel = (type) => {
        const labels = {
            dispatch: 'Dispatch',
            customer_service: 'Customer Service',
            quotes: 'Quotes',
            billing_adjustments: 'Billing',
            claims: 'Claims',
            sales_reps: 'Sales',
            customs: 'Customs',
            other: 'Other'
        };
        return labels[type] || type;
    };

    const getContactTypeIcon = (type) => {
        const icons = {
            dispatch: '🚛',
            customer_service: '📞',
            quotes: '💰',
            billing_adjustments: '📊',
            claims: '📋',
            sales_reps: '🤝',
            customs: '🛃',
            other: '📧'
        };
        return icons[type] || '📧';
    };

    return (
        <Box>
            <Autocomplete
                {...otherProps}
                options={terminalOptions}
                value={selectedTerminal}
                onChange={handleTerminalChange}
                getOptionLabel={(option) => option?.name || ''}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label={label}
                        size={size}
                        fullWidth={fullWidth}
                        sx={{
                            '& .MuiInputBase-input': { fontSize: '12px' },
                            '& .MuiInputLabel-root': { fontSize: '12px' }
                        }}
                    />
                )}
                renderOption={(props, option) => (
                    <Box
                        component="li"
                        {...props}
                        sx={{
                            flexDirection: 'column !important',
                            alignItems: 'stretch !important',
                            p: 2,
                            borderBottom: '1px solid #f1f5f9'
                        }}
                    >
                        {/* Terminal Header */}
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                <LocationIcon sx={{ fontSize: 16, color: '#64748b', mr: 1 }} />
                                <Typography variant="body2" sx={{
                                    fontSize: '13px',
                                    fontWeight: 600,
                                    color: '#334155'
                                }}>
                                    {option.name}
                                </Typography>
                            </Box>

                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {option.totalContacts > 0 && (
                                    <Typography variant="caption" sx={{
                                        fontSize: '11px',
                                        color: '#6b7280'
                                    }}>
                                        {option.totalContacts} contact{option.totalContacts !== 1 ? 's' : ''}
                                    </Typography>
                                )}

                                {option.isDefault && (
                                    <Chip
                                        label="Default"
                                        size="small"
                                        sx={{
                                            fontSize: '10px',
                                            height: 18,
                                            bgcolor: '#dbeafe',
                                            color: '#1d4ed8'
                                        }}
                                    />
                                )}
                            </Box>
                        </Box>

                        {option.totalContacts === 0 && (
                            <Typography variant="caption" sx={{
                                fontSize: '11px',
                                color: '#ef4444',
                                mt: 0.5,
                                fontStyle: 'italic'
                            }}>
                                No contacts configured
                            </Typography>
                        )}
                    </Box>
                )}
                PaperComponent={(props) => (
                    <Paper
                        {...props}
                        sx={{
                            ...props.sx,
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
                            mt: 0.5
                        }}
                    />
                )}
                noOptionsText="No terminals configured"
                size={size}
                fullWidth={fullWidth}
            />

            {/* Selected Terminal Summary */}
            {selectedTerminal && selectedTerminal.totalContacts > 0 && (
                <Box sx={{
                    mt: 1,
                    p: 1.5,
                    backgroundColor: '#f0f9ff',
                    borderRadius: '6px',
                    border: '1px solid #bae6fd'
                }}>
                    <Typography variant="body2" sx={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: '#0369a1',
                        mb: 0.5
                    }}>
                        📍 {selectedTerminal.name} Selected
                    </Typography>

                    <Typography variant="caption" sx={{
                        fontSize: '11px',
                        color: '#0369a1',
                        display: 'block'
                    }}>
                        {selectedTerminal.totalContacts} contact{selectedTerminal.totalContacts !== 1 ? 's' : ''} will receive appropriate notifications
                    </Typography>
                </Box>
            )}
        </Box>
    );
};

export default EmailSelectorDropdown; 