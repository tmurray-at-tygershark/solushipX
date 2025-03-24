import React, { useState, useEffect } from 'react';
import {
    Box,
    TextField,
    Typography,
    InputAdornment,
    IconButton,
    Paper,
    Fade,
    Alert
} from '@mui/material';
import {
    CreditCard as CreditCardIcon,
    Lock as LockIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    Error as ErrorIcon
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import './CreditCardInput.css';

const CreditCardInput = ({ onCardChange, error }) => {
    const [cardDetails, setCardDetails] = useState({
        cardNumber: '',
        expiry: '',
        cvv: '',
        cardHolder: ''
    });
    const [cardType, setCardType] = useState(null);
    const [localError, setLocalError] = useState('');
    const [showCvv, setShowCvv] = useState(false);

    const cardTypes = {
        visa: /^4/,
        mastercard: /^5[1-5]/,
        amex: /^3[47]/,
        discover: /^6/
    };

    useEffect(() => {
        if (error) {
            setLocalError(error);
        }
    }, [error]);

    const formatCardNumber = (value) => {
        const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        const matches = v.match(/\d{4,16}/g);
        const match = (matches && matches[0]) || '';
        const parts = [];

        for (let i = 0, len = match.length; i < len; i += 4) {
            parts.push(match.substring(i, i + 4));
        }

        if (parts.length) {
            return parts.join(' ');
        } else {
            return value;
        }
    };

    const formatExpiry = (value) => {
        const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
        if (v.length >= 2) {
            return v.substring(0, 2) + '/' + v.substring(2, 4);
        }
        return v;
    };

    const detectCardType = (number) => {
        const num = number.replace(/\s/g, '');
        if (num.startsWith('4')) return 'visa';
        if (num.startsWith('5')) return 'mastercard';
        if (num.startsWith('3')) return 'amex';
        if (num.startsWith('6')) return 'discover';
        return null;
    };

    const validateCardNumber = (number) => {
        const num = number.replace(/\s/g, '');
        if (num.length !== 16) return false;
        return true;
    };

    const validateExpiry = (expiry) => {
        if (!/^(0[1-9]|1[0-2])\/([0-9]{2})$/.test(expiry)) return false;
        const [month, year] = expiry.split('/');
        const now = new Date();
        const currentYear = now.getFullYear() % 100;
        const currentMonth = now.getMonth() + 1;
        const expYear = parseInt(year);
        const expMonth = parseInt(month);

        if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
            return false;
        }
        return true;
    };

    const validateCvv = (cvv) => {
        return cvv.length >= 3 && cvv.length <= 4;
    };

    const handleChange = (field, value) => {
        let formattedValue = value;
        let newError = '';

        switch (field) {
            case 'cardNumber':
                formattedValue = formatCardNumber(value);
                if (value && !validateCardNumber(formattedValue)) {
                    newError = 'Invalid card number';
                }
                break;
            case 'expiry':
                formattedValue = formatExpiry(value);
                if (value && !validateExpiry(formattedValue)) {
                    newError = 'Invalid expiry date';
                }
                break;
            case 'cvv':
                if (value && !validateCvv(value)) {
                    newError = 'Invalid CVV';
                }
                break;
            case 'cardHolder':
                if (value && value.length < 2) {
                    newError = 'Cardholder name is too short';
                }
                break;
        }

        setLocalError(newError);
        setCardDetails(prev => ({
            ...prev,
            [field]: formattedValue
        }));

        if (field === 'cardNumber') {
            setCardType(detectCardType(formattedValue));
        }

        onCardChange({
            ...cardDetails,
            [field]: formattedValue
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <Box className="credit-card-container">
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                    <CreditCardIcon sx={{ color: '#000', mr: 1 }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                        Payment Information
                    </Typography>
                </Box>

                {localError && (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        <ErrorIcon sx={{ fontSize: 16 }} />
                        <Typography variant="body2">{localError}</Typography>
                    </Alert>
                )}

                <Box sx={{ display: 'grid', gap: 2 }}>
                    <Box className="card-field-container">
                        <label className="card-field-label">Card Number</label>
                        <input
                            type="text"
                            className={`card-number-input ${localError ? 'error' : ''}`}
                            placeholder="1234 5678 9012 3456"
                            value={cardDetails.cardNumber}
                            onChange={(e) => handleChange('cardNumber', e.target.value)}
                            maxLength="19"
                        />
                    </Box>

                    <Box className="card-details">
                        <Box className="card-field-container">
                            <label className="card-field-label">Expiry Date</label>
                            <input
                                type="text"
                                className={`card-field ${localError ? 'error' : ''}`}
                                placeholder="MM/YY"
                                value={cardDetails.expiry}
                                onChange={(e) => handleChange('expiry', e.target.value)}
                                maxLength="5"
                            />
                        </Box>

                        <Box className="card-field-container">
                            <label className="card-field-label">CVV</label>
                            <input
                                type={showCvv ? 'text' : 'password'}
                                className={`card-field ${localError ? 'error' : ''}`}
                                placeholder="123"
                                value={cardDetails.cvv}
                                onChange={(e) => handleChange('cvv', e.target.value)}
                                maxLength="4"
                            />
                        </Box>
                    </Box>

                    <Box className="card-field-container" sx={{ mt: 2 }}>
                        <label className="card-field-label">Cardholder Name</label>
                        <input
                            type="text"
                            className={`card-field ${localError ? 'error' : ''}`}
                            placeholder="John Doe"
                            value={cardDetails.cardHolder}
                            onChange={(e) => handleChange('cardHolder', e.target.value)}
                        />
                    </Box>

                    {cardType && (
                        <img
                            src={`/images/card-types/${cardType}.svg`}
                            alt={cardType}
                            className="card-type-icon"
                        />
                    )}
                </Box>

                <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <LockIcon sx={{ color: '#666', fontSize: 16 }} />
                    <Typography variant="body2" color="text.secondary">
                        Your payment information is encrypted and secure
                    </Typography>
                </Box>
            </Box>
        </motion.div>
    );
};

export default CreditCardInput; 