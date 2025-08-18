import React, { useState } from 'react';
import {
    TextField,
    Chip,
    Box,
    Typography,
    InputAdornment,
    IconButton
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

const EmailChipsField = ({ label, emails = [], onAddEmail, onRemoveEmail }) => {
    const [newEmail, setNewEmail] = useState('');
    const [error, setError] = useState('');

    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const handleAddClick = () => {
        if (!newEmail.trim()) {
            setError('Email address is required');
            return;
        }

        if (!validateEmail(newEmail.trim())) {
            setError('Please enter a valid email address');
            return;
        }

        if (emails.includes(newEmail.trim())) {
            setError('This email address is already added');
            return;
        }

        onAddEmail(newEmail.trim());
        setNewEmail('');
        setError('');
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddClick();
        }
    };

    const handleInputChange = (e) => {
        setNewEmail(e.target.value);
        if (error) {
            setError('');
        }
    };

    return (
        <Box>
            <TextField
                fullWidth
                size="small"
                label={label}
                value={newEmail}
                onChange={handleInputChange}
                onKeyPress={handleKeyPress}
                error={!!error}
                helperText={error || 'Press Enter or click + to add email'}
                InputProps={{
                    endAdornment: (
                        <InputAdornment position="end">
                            <IconButton
                                size="small"
                                onClick={handleAddClick}
                                disabled={!newEmail.trim()}
                                sx={{
                                    color: '#7c3aed',
                                    '&:hover': { backgroundColor: '#7c3aed10' }
                                }}
                            >
                                <AddIcon fontSize="small" />
                            </IconButton>
                        </InputAdornment>
                    )
                }}
                sx={{
                    '& .MuiInputLabel-root': { fontSize: '12px' },
                    '& .MuiInputBase-input': { fontSize: '12px' },
                    '& .MuiFormHelperText-root': { fontSize: '11px' }
                }}
            />

            {emails.length > 0 && (
                <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {emails.map((email, index) => (
                        <Chip
                            key={index}
                            label={email}
                            onDelete={() => onRemoveEmail(email)}
                            size="small"
                            sx={{
                                fontSize: '11px',
                                height: '24px',
                                '& .MuiChip-label': { fontSize: '11px' },
                                '& .MuiChip-deleteIcon': { fontSize: '14px' }
                            }}
                        />
                    ))}
                </Box>
            )}

            {emails.length === 0 && (
                <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280', mt: 0.5, display: 'block' }}>
                    No email addresses added yet
                </Typography>
            )}
        </Box>
    );
};

export default EmailChipsField;
