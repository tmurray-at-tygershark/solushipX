import React, { useState, useEffect, useCallback } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Grid,
    Typography,
    Switch,
    FormControlLabel,
    CircularProgress,
    Alert,
    Autocomplete,
    Box,
    Avatar
} from '@mui/material';
import {
    Save as SaveIcon,
    Close as CloseIcon,
    Business as CompanyIcon,
    Person as CustomerIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { httpsCallable } from 'firebase/functions';
import { functions, db } from '../../../firebase';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { useAuth } from '../../../contexts/AuthContext';

// Simple country/state data - you can expand this as needed
const COUNTRIES = [
    { code: 'CA', name: 'Canada' },
    { code: 'US', name: 'United States' },
    { code: 'MX', name: 'Mexico' }
];

const STATES_PROVINCES = {
    CA: [
        { code: 'ANY', name: 'ANY' },
        { code: 'AB', name: 'Alberta' },
        { code: 'BC', name: 'British Columbia' },
        { code: 'MB', name: 'Manitoba' },
        { code: 'NB', name: 'New Brunswick' },
        { code: 'NL', name: 'Newfoundland and Labrador' },
        { code: 'NS', name: 'Nova Scotia' },
        { code: 'NT', name: 'Northwest Territories' },
        { code: 'NU', name: 'Nunavut' },
        { code: 'ON', name: 'Ontario' },
        { code: 'PE', name: 'Prince Edward Island' },
        { code: 'QC', name: 'Quebec' },
        { code: 'SK', name: 'Saskatchewan' },
        { code: 'YT', name: 'Yukon' }
    ],
    US: [
        { code: 'ANY', name: 'ANY' },
        { code: 'AL', name: 'Alabama' },
        { code: 'AK', name: 'Alaska' },
        { code: 'AZ', name: 'Arizona' },
        { code: 'AR', name: 'Arkansas' },
        { code: 'CA', name: 'California' },
        { code: 'CO', name: 'Colorado' },
        { code: 'CT', name: 'Connecticut' },
        { code: 'DE', name: 'Delaware' },
        { code: 'FL', name: 'Florida' },
        { code: 'GA', name: 'Georgia' },
        { code: 'HI', name: 'Hawaii' },
        { code: 'ID', name: 'Idaho' },
        { code: 'IL', name: 'Illinois' },
        { code: 'IN', name: 'Indiana' },
        { code: 'IA', name: 'Iowa' },
        { code: 'KS', name: 'Kansas' },
        { code: 'KY', name: 'Kentucky' },
        { code: 'LA', name: 'Louisiana' },
        { code: 'ME', name: 'Maine' },
        { code: 'MD', name: 'Maryland' },
        { code: 'MA', name: 'Massachusetts' },
        { code: 'MI', name: 'Michigan' },
        { code: 'MN', name: 'Minnesota' },
        { code: 'MS', name: 'Mississippi' },
        { code: 'MO', name: 'Missouri' },
        { code: 'MT', name: 'Montana' },
        { code: 'NE', name: 'Nebraska' },
        { code: 'NV', name: 'Nevada' },
        { code: 'NH', name: 'New Hampshire' },
        { code: 'NJ', name: 'New Jersey' },
        { code: 'NM', name: 'New Mexico' },
        { code: 'NY', name: 'New York' },
        { code: 'NC', name: 'North Carolina' },
        { code: 'ND', name: 'North Dakota' },
        { code: 'OH', name: 'Ohio' },
        { code: 'OK', name: 'Oklahoma' },
        { code: 'OR', name: 'Oregon' },
        { code: 'PA', name: 'Pennsylvania' },
        { code: 'RI', name: 'Rhode Island' },
        { code: 'SC', name: 'South Carolina' },
        { code: 'SD', name: 'South Dakota' },
        { code: 'TN', name: 'Tennessee' },
        { code: 'TX', name: 'Texas' },
        { code: 'UT', name: 'Utah' },
        { code: 'VT', name: 'Vermont' },
        { code: 'VA', name: 'Virginia' },
        { code: 'WA', name: 'Washington' },
        { code: 'WV', name: 'West Virginia' },
        { code: 'WI', name: 'Wisconsin' },
        { code: 'WY', name: 'Wyoming' }
    ],
    MX: [
        { code: 'ANY', name: 'ANY' }
    ]
};

const getStatesForCountry = (countryCode) => {
    return STATES_PROVINCES[countryCode] || [{ code: 'ANY', name: 'ANY' }];
};

const initialFormData = {
    companyId: '',
    customerId: 'ALL',
    serviceCode: 'ANY',
    fromCountry: 'CA',
    fromState: 'ANY',
    fromCity: '',
    fromZipPostal: '',
    toCountry: 'CA',
    toState: 'ANY',
    toCity: '',
    toZipPostal: '',
    exclude: false,
};

const CarrierEligibilityForm = ({ open, onClose, rule, carrier }) => {
    const { enqueueSnackbar } = useSnackbar();
    const { user, userRole } = useAuth();

    // Form state
    const [formData, setFormData] = useState(initialFormData);
    const [loading, setLoading] = useState(false);
    const [formError, setFormError] = useState('');

    // Data loading states
    const [companies, setCompanies] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [services, setServices] = useState([]);
    const [loadingCompanies, setLoadingCompanies] = useState(false);
    const [loadingCustomers, setLoadingCustomers] = useState(false);
    const [loadingServices, setLoadingServices] = useState(false);

    // Load companies based on user role (following established patterns)
    const loadCompanies = useCallback(async () => {
        setLoadingCompanies(true);
        try {
            let companiesQuery;

            if (userRole === 'superadmin') {
                // Super admins can see all companies
                companiesQuery = query(
                    collection(db, 'companies'),
                    orderBy('name', 'asc')
                );
            } else if (userRole === 'admin') {
                // Admins can see companies they're connected to
                const userQuery = query(
                    collection(db, 'users'),
                    where('email', '==', user.email)
                );
                const userSnapshot = await getDocs(userQuery);

                if (!userSnapshot.empty) {
                    const userData = userSnapshot.docs[0].data();
                    const connectedCompanies = userData.connectedCompanies?.companies || [];

                    if (connectedCompanies.length > 0) {
                        companiesQuery = query(
                            collection(db, 'companies'),
                            where('companyID', 'in', connectedCompanies),
                            orderBy('name', 'asc')
                        );
                    } else {
                        setCompanies([]);
                        return;
                    }
                } else {
                    setCompanies([]);
                    return;
                }
            } else {
                setCompanies([]);
                return;
            }

            const companiesSnapshot = await getDocs(companiesQuery);
            const companiesData = companiesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setCompanies(companiesData);
        } catch (error) {
            console.error('Error loading companies:', error);
            setCompanies([]);
        } finally {
            setLoadingCompanies(false);
        }
    }, [user, userRole]);

    // Load customers for selected company (following established patterns)
    const loadCustomersForCompany = useCallback(async (companyId) => {
        if (!companyId || companyId === 'ALL') {
            setCustomers([{ id: 'ALL', name: 'ALL' }]);
            return;
        }

        setLoadingCustomers(true);
        try {
            const customersQuery = query(
                collection(db, 'customers'),
                where('companyID', '==', companyId),
                orderBy('name', 'asc')
            );

            const customersSnapshot = await getDocs(customersQuery);
            const customersData = customersSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Add "ALL" option at the beginning
            setCustomers([{ id: 'ALL', name: 'ALL' }, ...customersData]);
        } catch (error) {
            console.error('Error loading customers:', error);
            setCustomers([{ id: 'ALL', name: 'ALL' }]);
        } finally {
            setLoadingCustomers(false);
        }
    }, []);

    // Load service levels for the carrier
    const loadServices = useCallback(async () => {
        setLoadingServices(true);
        try {
            if (!carrier?.supportedServiceLevels || !Array.isArray(carrier.supportedServiceLevels) || carrier.supportedServiceLevels.length === 0) {
                // If carrier has no specific service levels, load all available service levels
                const servicesQuery = query(
                    collection(db, 'serviceLevels'),
                    where('enabled', '==', true),
                    orderBy('type'),
                    orderBy('sortOrder')
                );

                const servicesSnapshot = await getDocs(servicesQuery);
                const servicesData = servicesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    code: doc.data().code || doc.id,
                    name: doc.data().name || doc.data().label,
                    ...doc.data()
                }));

                // Add "ANY" option at the beginning
                setServices([{ id: 'ANY', code: 'ANY', name: 'ANY' }, ...servicesData]);
            } else {
                // Load only the service levels that this carrier supports
                const servicesQuery = query(
                    collection(db, 'serviceLevels'),
                    where('enabled', '==', true),
                    orderBy('type'),
                    orderBy('sortOrder')
                );

                const servicesSnapshot = await getDocs(servicesQuery);
                const allServicesData = servicesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    code: doc.data().code || doc.id,
                    name: doc.data().name || doc.data().label,
                    ...doc.data()
                }));

                // Filter to only include services that this carrier supports
                const carrierServicesData = allServicesData.filter(service =>
                    carrier.supportedServiceLevels.includes(service.code)
                );

                // Add "ANY" option at the beginning
                setServices([{ id: 'ANY', code: 'ANY', name: 'ANY' }, ...carrierServicesData]);
            }
        } catch (error) {
            console.error('Error loading services:', error);
            setServices([{ id: 'ANY', code: 'ANY', name: 'ANY' }]);
        } finally {
            setLoadingServices(false);
        }
    }, [carrier]);

    // Load data when dialog opens
    useEffect(() => {
        if (open) {
            loadCompanies();
            loadServices();
        }
    }, [open, loadCompanies, loadServices]);

    // Load customers when company changes
    useEffect(() => {
        if (formData.companyId) {
            loadCustomersForCompany(formData.companyId);
        }
    }, [formData.companyId, loadCustomersForCompany]);

    // Initialize form data
    useEffect(() => {
        if (rule) {
            setFormData({
                companyId: rule.companyId || '',
                customerId: rule.customerId || 'ALL',
                serviceCode: rule.serviceCode || 'ANY',
                fromCountry: rule.fromCountry || 'CA',
                fromState: rule.fromState || 'ANY',
                fromCity: rule.fromCity || '',
                fromZipPostal: rule.fromZipPostal || '',
                toCountry: rule.toCountry || 'CA',
                toState: rule.toState || 'ANY',
                toCity: rule.toCity || '',
                toZipPostal: rule.toZipPostal || '',
                exclude: rule.exclude || false,
            });
        } else {
            setFormData(initialFormData);
        }
        setFormError('');
    }, [rule, open]);

    const handleChange = (e) => {
        const { name, value, checked, type } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleCompanyChange = (event, value) => {
        const companyId = value ? value.id : '';
        setFormData(prev => ({
            ...prev,
            companyId,
            customerId: 'ALL' // Reset customer when company changes
        }));
    };

    const handleCustomerChange = (event, value) => {
        const customerId = value ? value.id : 'ALL';
        setFormData(prev => ({
            ...prev,
            customerId
        }));
    };

    const handleServiceChange = (event, value) => {
        const serviceCode = value ? value.code : 'ANY';
        setFormData(prev => ({
            ...prev,
            serviceCode
        }));
    };

    const handleCountryChange = (field) => (event, value) => {
        const countryCode = value ? value.code : '';
        setFormData(prev => ({
            ...prev,
            [field]: countryCode,
            [`${field.replace('Country', 'State')}`]: 'ANY' // Reset state when country changes
        }));
    };

    const handleStateChange = (field) => (event, value) => {
        const stateCode = value ? value.code : 'ANY';
        setFormData(prev => ({
            ...prev,
            [field]: stateCode
        }));
    };

    const validateForm = () => {
        console.log('🔍 Starting form validation...');
        console.log('🏢 Carrier ID:', carrier?.id);
        console.log('🏭 Company ID:', formData.companyId);
        console.log('🌍 From Country:', formData.fromCountry);
        console.log('🌍 To Country:', formData.toCountry);

        if (!carrier?.id) {
            console.log('❌ Validation failed: Carrier information is missing');
            setFormError('Carrier information is missing.');
            return false;
        }
        if (!formData.companyId) {
            console.log('❌ Validation failed: Company selection is required');
            setFormError('Company selection is required.');
            return false;
        }
        if (!formData.fromCountry) {
            console.log('❌ Validation failed: Origin Country is required');
            setFormError('Origin Country is required.');
            return false;
        }
        if (!formData.toCountry) {
            console.log('❌ Validation failed: Destination Country is required');
            setFormError('Destination Country is required.');
            return false;
        }

        console.log('✅ Form validation passed');
        setFormError('');
        return true;
    };

    const handleSubmit = async () => {
        console.log('🚀 Submit button clicked, starting validation...');
        console.log('📋 Current form data:', formData);
        console.log('🏢 Current carrier:', carrier);
        console.log('🏭 Available companies:', companies);
        console.log('👥 Available customers:', customers);
        console.log('⚙️ Available services:', services);

        if (!validateForm()) {
            console.log('❌ Validation failed');
            return;
        }

        console.log('✅ Validation passed, preparing payload...');
        setLoading(true);
        try {
            const callable = rule
                ? httpsCallable(functions, 'updateCarrierEligibilityRule')
                : httpsCallable(functions, 'createCarrierEligibilityRule');

            const payload = {
                ...formData,
                carrierId: carrier.id,
                carrierName: carrier.name,
                companyName: companies.find(c => c.id === formData.companyId)?.name || '',
                customerName: customers.find(c => c.id === formData.customerId)?.name || 'ALL',
                serviceName: services.find(s => s.code === formData.serviceCode)?.name || 'ANY',
            };

            if (rule) {
                payload.ruleId = rule.id;
            }

            console.log('📤 Sending payload to Cloud Function:', payload);
            const result = await callable(payload);
            console.log('✅ Cloud Function response:', result);

            enqueueSnackbar(`Route rule ${rule ? 'updated' : 'created'} successfully`, { variant: 'success' });
            onClose(true); // Close and trigger refresh
        } catch (err) {
            console.error("❌ Error saving route rule:", err);
            console.error("Error details:", {
                message: err.message,
                code: err.code,
                details: err.details
            });
            setFormError(err.message || `Failed to ${rule ? 'update' : 'create'} route rule.`);
            enqueueSnackbar(`Failed to ${rule ? 'update' : 'create'} route rule`, { variant: 'error' });
        } finally {
            setLoading(false);
        }
    };

    const fromStates = getStatesForCountry(formData.fromCountry);
    const toStates = getStatesForCountry(formData.toCountry);

    return (
        <Dialog
            open={open}
            onClose={() => onClose(false)}
            maxWidth="md"
            fullWidth
            PaperProps={{
                sx: {
                    maxHeight: '90vh',
                    display: 'flex',
                    flexDirection: 'column'
                }
            }}
        >
            <DialogTitle sx={{
                fontSize: '16px',
                fontWeight: 600,
                color: '#374151',
                borderBottom: '1px solid #e5e7eb',
                pb: 2
            }}>
                {rule ? 'Edit Route Rule' : 'Add Route Rule'}
                <Typography sx={{ fontSize: '12px', color: '#6b7280', mt: 0.5 }}>
                    {carrier?.name} • Define eligibility for specific routes
                </Typography>
            </DialogTitle>
            <DialogContent dividers sx={{ flex: 1, overflow: 'auto', pt: 2 }}>
                {formError && <Alert severity="error" sx={{ mb: 2, fontSize: '12px' }}>{formError}</Alert>}
                <Grid container spacing={2}>
                    {/* Company and Customer Selection */}
                    <Grid item xs={12} sm={6}>
                        <Autocomplete
                            options={companies}
                            loading={loadingCompanies}
                            getOptionLabel={(option) => option.name || ''}
                            value={companies.find(c => c.id === formData.companyId) || null}
                            onChange={handleCompanyChange}
                            renderOption={(props, option) => (
                                <li {...props}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Avatar
                                            sx={{ width: 20, height: 20, fontSize: '11px', border: '1px solid #e5e7eb' }}
                                            src={option.logo || option.logoUrl || ''}
                                        >
                                            <CompanyIcon sx={{ fontSize: 12 }} />
                                        </Avatar>
                                        <Typography sx={{ fontSize: '12px' }}>{option.name}</Typography>
                                    </Box>
                                </li>
                            )}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    fullWidth
                                    size="small"
                                    label="Company"
                                    required
                                    error={!formData.companyId && !!formError}
                                    helperText={!formData.companyId && !!formError ? 'Company is required' : ''}
                                    sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                    InputProps={{
                                        ...params.InputProps,
                                        startAdornment: (
                                            <CompanyIcon sx={{ fontSize: 16, color: '#6b7280', mr: 1 }} />
                                        ),
                                    }}
                                />
                            )}
                            isOptionEqualToValue={(option, value) => option.id === value.id}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Autocomplete
                            options={customers}
                            loading={loadingCustomers}
                            disabled={!formData.companyId}
                            getOptionLabel={(option) => option.name || ''}
                            value={customers.find(c => c.id === formData.customerId) || null}
                            onChange={handleCustomerChange}
                            renderOption={(props, option) => (
                                <li {...props}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Avatar
                                            sx={{ width: 20, height: 20, fontSize: '11px', border: '1px solid #e5e7eb' }}
                                            src={option.logo || option.logoUrl || ''}
                                        >
                                            <CustomerIcon sx={{ fontSize: 12 }} />
                                        </Avatar>
                                        <Typography sx={{ fontSize: '12px' }}>{option.name}</Typography>
                                    </Box>
                                </li>
                            )}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    fullWidth
                                    size="small"
                                    label="Customer"
                                    sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                    InputProps={{
                                        ...params.InputProps,
                                        startAdornment: (
                                            <CustomerIcon sx={{ fontSize: 16, color: '#6b7280', mr: 1 }} />
                                        ),
                                    }}
                                />
                            )}
                            isOptionEqualToValue={(option, value) => option.id === value.id}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Autocomplete
                            options={services}
                            loading={loadingServices}
                            getOptionLabel={(option) => option.name || ''}
                            value={services.find(s => s.code === formData.serviceCode) || null}
                            onChange={handleServiceChange}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    fullWidth
                                    size="small"
                                    label="Service Level"
                                    sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                />
                            )}
                            isOptionEqualToValue={(option, value) => option.code === value.code}
                        />
                    </Grid>

                    <Grid item xs={12}>
                        <Typography variant="subtitle2" sx={{ mt: 2, mb: 1, fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                            Geographic Route
                        </Typography>
                    </Grid>
                    {/* Origin Geographic Details */}
                    <Grid item xs={12} sm={6}>
                        <Autocomplete
                            options={COUNTRIES}
                            getOptionLabel={(option) => option.name}
                            value={COUNTRIES.find(c => c.code === formData.fromCountry) || null}
                            onChange={handleCountryChange('fromCountry')}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    fullWidth
                                    size="small"
                                    label="From Country"
                                    required
                                    error={!formData.fromCountry && !!formError}
                                    helperText={!formData.fromCountry && !!formError ? 'Origin Country is required' : ''}
                                    sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                />
                            )}
                            isOptionEqualToValue={(option, value) => option.code === value.code}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Autocomplete
                            options={fromStates}
                            getOptionLabel={(option) => option.name}
                            value={fromStates.find(s => s.code === formData.fromState) || null}
                            onChange={handleStateChange('fromState')}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    fullWidth
                                    size="small"
                                    label="From State/Province (ANY for all)"
                                    sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                />
                            )}
                            isOptionEqualToValue={(option, value) => option.code === value.code}
                            disabled={!formData.fromCountry}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            size="small"
                            label="From City (Optional)"
                            name="fromCity"
                            value={formData.fromCity}
                            onChange={handleChange}
                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            placeholder="Enter city name or leave blank for all cities"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            size="small"
                            label="From Zip/Postal (Optional)"
                            name="fromZipPostal"
                            value={formData.fromZipPostal}
                            onChange={handleChange}
                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            placeholder="Enter zip/postal code or leave blank for all"
                        />
                    </Grid>

                    {/* Destination Geographic Details */}
                    <Grid item xs={12} sm={6}>
                        <Autocomplete
                            options={COUNTRIES}
                            getOptionLabel={(option) => option.name}
                            value={COUNTRIES.find(c => c.code === formData.toCountry) || null}
                            onChange={handleCountryChange('toCountry')}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    fullWidth
                                    size="small"
                                    label="To Country"
                                    required
                                    error={!formData.toCountry && !!formError}
                                    helperText={!formData.toCountry && !!formError ? 'Destination Country is required' : ''}
                                    sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                />
                            )}
                            isOptionEqualToValue={(option, value) => option.code === value.code}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <Autocomplete
                            options={toStates}
                            getOptionLabel={(option) => option.name}
                            value={toStates.find(s => s.code === formData.toState) || null}
                            onChange={handleStateChange('toState')}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    fullWidth
                                    size="small"
                                    label="To State/Province (ANY for all)"
                                    sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                                />
                            )}
                            isOptionEqualToValue={(option, value) => option.code === value.code}
                            disabled={!formData.toCountry}
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            size="small"
                            label="To City (Optional)"
                            name="toCity"
                            value={formData.toCity}
                            onChange={handleChange}
                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            placeholder="Enter city name or leave blank for all cities"
                        />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                        <TextField
                            fullWidth
                            size="small"
                            label="To Zip/Postal (Optional)"
                            name="toZipPostal"
                            value={formData.toZipPostal}
                            onChange={handleChange}
                            sx={{ '& .MuiInputBase-input': { fontSize: '12px' } }}
                            placeholder="Enter zip/postal code or leave blank for all"
                        />
                    </Grid>
                    <Grid item xs={12}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={formData.exclude}
                                    onChange={handleChange}
                                    name="exclude"
                                    color="error"
                                />
                            }
                            label={<Typography sx={{ fontSize: '12px', color: formData.exclude ? '#ef4444' : '#374151' }}>Exclude this route (Block carrier for this route)</Typography>}
                            sx={{ '& .MuiFormControlLabel-label': { fontSize: '12px' } }}
                        />
                        <Typography variant="caption" display="block" sx={{ ml: 4, color: '#6b7280', fontSize: '10px' }}>
                            If checked, this carrier will be excluded for the specified route.
                        </Typography>
                    </Grid>
                </Grid>
            </DialogContent>
            <DialogActions sx={{ borderTop: '1px solid #e5e7eb', pt: 2 }}>
                <Button
                    onClick={() => onClose(false)}
                    startIcon={<CloseIcon />}
                    sx={{ fontSize: '12px' }}
                >
                    Cancel
                </Button>
                <Button
                    onClick={handleSubmit}
                    startIcon={<SaveIcon />}
                    variant="contained"
                    disabled={loading}
                    sx={{ fontSize: '12px' }}
                >
                    {loading ? <CircularProgress size={20} /> : (rule ? 'Update Rule' : 'Add Rule')}
                </Button>
            </DialogActions>
        </Dialog>
    );
};

export default CarrierEligibilityForm;
