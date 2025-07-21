import React, { useState, useEffect } from 'react';
import {
    Box,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Typography,
    Avatar,
    CircularProgress,
    Chip
} from '@mui/material';
import {
    Business as BusinessIcon
} from '@mui/icons-material';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../../firebase';

const CompanySelector = ({
    selectedCompanyId,
    onCompanyChange,
    userRole,
    userEmail, // Add userEmail prop
    companyData, // Company data for locked mode display
    size = 'medium',
    disabled = false,
    label = 'Select Company',
    placeholder = 'Choose a company to create shipment...',
    required = false,
    showDescription = true,
    locked = false // New prop for locked mode
}) => {
    const [availableCompanies, setAvailableCompanies] = useState([]);
    const [loading, setLoading] = useState(false);

    // Load companies based on user role
    useEffect(() => {
        const loadCompanies = async () => {
            if (userRole !== 'superadmin' && userRole !== 'admin' && userRole !== 'user') return;

            setLoading(true);
            try {
                let companies = [];

                if (userRole === 'superadmin') {
                    // For super admins, load all companies
                    const companiesQuery = query(collection(db, 'companies'));
                    const companiesSnapshot = await getDocs(companiesQuery);
                    companies = companiesSnapshot.docs.map(doc => ({
                        id: doc.id,
                        ...doc.data()
                    }));
                } else if (userRole === 'admin' || userRole === 'user') {
                    // For regular admins, load only connected companies
                    if (userEmail) {
                        // Get the user's connected companies
                        const userQuery = query(
                            collection(db, 'users'),
                            where('email', '==', userEmail),
                            limit(1)
                        );
                        const userSnapshot = await getDocs(userQuery);

                        if (!userSnapshot.empty) {
                            const userData = userSnapshot.docs[0].data();
                            const connectedCompanies = userData.connectedCompanies || [];

                            if (connectedCompanies.length > 0) {
                                // Load only connected companies
                                const companiesQuery = query(
                                    collection(db, 'companies'),
                                    where('companyID', 'in', connectedCompanies)
                                );
                                const companiesSnapshot = await getDocs(companiesQuery);
                                companies = companiesSnapshot.docs.map(doc => ({
                                    id: doc.id,
                                    ...doc.data()
                                }));
                            }
                        }
                    }
                }

                // Sort companies by name
                companies.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
                setAvailableCompanies(companies);
            } catch (error) {
                console.error('Error loading companies:', error);
                setAvailableCompanies([]);
            } finally {
                setLoading(false);
            }
        };

        loadCompanies();
    }, [userRole, userEmail]);

    // Don't render anything if not super admin, admin, or company admin
    if (userRole !== 'superadmin' && userRole !== 'admin' && userRole !== 'user') {
        return null;
    }

    return (
        <Box sx={{ mb: 3 }}>
            {showDescription && (
                <Typography
                    variant="body2"
                    sx={{
                        mb: 2,
                        color: '#6b7280',
                        fontSize: '12px',
                        fontStyle: 'italic'
                    }}
                >
                    🔑 {userRole === 'superadmin' ? 'Super Admin' : userRole === 'admin' ? 'System Admin' : 'Company Admin'} Mode: {locked ? 'Locked to your company context' : `Select a company to create shipment${userRole === 'superadmin' ? ' on their behalf' : ''}`}
                </Typography>
            )}

            {locked && companyData ? (
                // Locked mode - show company info as read-only
                <Box
                    sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        p: 2,
                        border: '1px solid #e5e7eb',
                        borderRadius: 1,
                        backgroundColor: '#f9fafb',
                        minHeight: size === 'small' ? 40 : 56
                    }}
                >
                    {/* Company Logo */}
                    <Avatar
                        src={companyData.logoUrl || companyData.logo}
                        sx={{
                            width: size === 'small' ? 24 : 32,
                            height: size === 'small' ? 24 : 32,
                            border: '1px solid #e5e7eb',
                            bgcolor: '#f8fafc'
                        }}
                    >
                        <BusinessIcon sx={{ fontSize: size === 'small' ? 14 : 18, color: '#6b7280' }} />
                    </Avatar>

                    {/* Company Details */}
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography
                            sx={{
                                fontWeight: 600,
                                fontSize: size === 'small' ? '12px' : '14px',
                                color: '#374151',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}
                        >
                            {companyData.name || companyData.companyName}
                        </Typography>
                        <Typography
                            sx={{
                                fontSize: size === 'small' ? '10px' : '11px',
                                color: '#6b7280',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                            }}
                        >
                            ID: {companyData.companyID} • Company Admin Context
                        </Typography>
                    </Box>
                </Box>
            ) : (
                <FormControl
                    fullWidth
                    size={size}
                    required={required}
                    disabled={disabled || loading}
                >
                    <InputLabel sx={{ fontSize: size === 'small' ? '12px' : '14px' }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <BusinessIcon sx={{ fontSize: size === 'small' ? 16 : 18 }} />
                            {label}
                            {required && <span style={{ color: '#d32f2f' }}>*</span>}
                        </Box>
                    </InputLabel>

                    <Select
                        value={selectedCompanyId || ''}
                        onChange={(e) => onCompanyChange(e.target.value)}
                        label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <BusinessIcon sx={{ fontSize: size === 'small' ? 16 : 18 }} />
                                {label}
                                {required && <span style={{ color: '#d32f2f' }}>*</span>}
                            </Box>
                        }
                        displayEmpty
                        sx={{
                            fontSize: size === 'small' ? '12px' : '14px',
                            '& .MuiSelect-select': {
                                fontSize: size === 'small' ? '12px' : '14px',
                                display: 'flex',
                                alignItems: 'center'
                            }
                        }}
                        MenuProps={{
                            PaperProps: {
                                sx: {
                                    maxHeight: 400,
                                    '& .MuiMenuItem-root': {
                                        fontSize: size === 'small' ? '12px' : '14px'
                                    }
                                }
                            }
                        }}
                    >
                        {/* Placeholder when nothing selected */}
                        <MenuItem value="" disabled sx={{ fontSize: size === 'small' ? '12px' : '14px', color: '#9ca3af' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                <BusinessIcon sx={{ fontSize: 20, color: '#9ca3af' }} />
                                <Typography sx={{ fontSize: size === 'small' ? '12px' : '14px', color: '#9ca3af' }}>
                                    {placeholder}
                                </Typography>
                            </Box>
                        </MenuItem>

                        {/* Loading state */}
                        {loading && (
                            <MenuItem disabled sx={{ fontSize: size === 'small' ? '12px' : '14px' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                    <CircularProgress size={16} />
                                    <Typography sx={{ fontSize: size === 'small' ? '12px' : '14px', color: '#6b7280' }}>
                                        Loading companies...
                                    </Typography>
                                </Box>
                            </MenuItem>
                        )}

                        {/* Company options */}
                        {!loading && availableCompanies.map(company => (
                            <MenuItem
                                key={company.companyID}
                                value={company.companyID}
                                sx={{
                                    fontSize: size === 'small' ? '12px' : '14px',
                                    py: 1.5
                                }}
                            >
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                                    {/* Company Logo */}
                                    <Avatar
                                        src={company.logoUrl}
                                        sx={{
                                            width: size === 'small' ? 24 : 28,
                                            height: size === 'small' ? 24 : 28,
                                            border: '1px solid #e5e7eb',
                                            bgcolor: '#f8fafc'
                                        }}
                                    >
                                        <BusinessIcon sx={{ fontSize: size === 'small' ? 14 : 16, color: '#6b7280' }} />
                                    </Avatar>

                                    {/* Company Details */}
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography
                                            sx={{
                                                fontWeight: 600,
                                                fontSize: size === 'small' ? '12px' : '14px',
                                                color: '#374151',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}
                                        >
                                            {company.name || company.companyName}
                                        </Typography>
                                        <Typography
                                            sx={{
                                                fontSize: size === 'small' ? '10px' : '11px',
                                                color: '#6b7280',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis'
                                            }}
                                        >
                                            ID: {company.companyID}
                                        </Typography>
                                    </Box>

                                    {/* Status Chip */}
                                    <Chip
                                        label={company.status === 'active' ? 'Active' : 'Inactive'}
                                        size="small"
                                        color={company.status === 'active' ? 'success' : 'default'}
                                        sx={{
                                            height: size === 'small' ? 18 : 20,
                                            fontSize: size === 'small' ? '9px' : '10px',
                                            fontWeight: 500
                                        }}
                                    />
                                </Box>
                            </MenuItem>
                        ))}

                        {/* No companies available */}
                        {!loading && availableCompanies.length === 0 && (
                            <MenuItem disabled sx={{ fontSize: size === 'small' ? '12px' : '14px' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                                    <BusinessIcon sx={{ fontSize: 20, color: '#9ca3af' }} />
                                    <Typography sx={{ fontSize: size === 'small' ? '12px' : '14px', color: '#9ca3af' }}>
                                        No companies available
                                    </Typography>
                                </Box>
                            </MenuItem>
                        )}
                    </Select>
                </FormControl>
            )}
        </Box>
    );
};

export default CompanySelector; 