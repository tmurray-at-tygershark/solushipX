import React from 'react';
import {
    Box,
    Grid,
    TextField,
    InputAdornment,
    IconButton,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    Autocomplete,
    Typography,
    Chip,
    ListSubheader,
    Collapse
} from '@mui/material';
import {
    Search as SearchIcon,
    Clear as ClearIcon,
    CalendarToday as CalendarIcon,
    Description as DescriptionIcon,
    QrCode as QrCodeIcon,
    FilterAlt as FilterAltIcon
} from '@mui/icons-material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateRangePicker } from '@mui/x-date-pickers-pro/DateRangePicker';
import EnhancedStatusFilter from '../../StatusChip/EnhancedStatusFilter';
import { carrierOptions } from '../utils/carrierOptions';
import { enhancedToLegacy } from '../../../utils/enhancedStatusModel';

const ShipmentFilters = ({
    searchFields,
    setSearchFields,
    filters,
    setFilters,
    dateRange,
    setDateRange,
    selectedCustomer,
    setSelectedCustomer,
    customers,
    handleClearFilters,
    filtersOpen
}) => {
    return (
        <Collapse in={filtersOpen}>
            <Box sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <Grid container spacing={2} alignItems="center">
                    {/* Shipment ID Search */}
                    <Grid item xs={12} sm={6} md={4} lg={3}>
                        <TextField
                            fullWidth
                            label="Shipment ID"
                            placeholder="Search by Shipment ID"
                            value={searchFields.shipmentId}
                            onChange={(e) => setSearchFields(prev => ({ ...prev, shipmentId: e.target.value }))}
                            size="small"
                            sx={{
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' }
                            }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                    </InputAdornment>
                                ),
                                endAdornment: searchFields.shipmentId && (
                                    <InputAdornment position="end">
                                        <IconButton
                                            size="small"
                                            onClick={() => setSearchFields(prev => ({ ...prev, shipmentId: '' }))}
                                        >
                                            <ClearIcon />
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }}
                        />
                    </Grid>

                    {/* Reference Number */}
                    <Grid item xs={12} sm={6} md={4} lg={3}>
                        <TextField
                            fullWidth
                            label="Reference Number"
                            placeholder="Search by reference"
                            value={searchFields.referenceNumber}
                            onChange={(e) => setSearchFields(prev => ({ ...prev, referenceNumber: e.target.value }))}
                            size="small"
                            sx={{
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' }
                            }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <DescriptionIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                    </InputAdornment>
                                ),
                                endAdornment: searchFields.referenceNumber && (
                                    <InputAdornment position="end">
                                        <IconButton
                                            size="small"
                                            onClick={() => setSearchFields(prev => ({ ...prev, referenceNumber: '' }))}
                                        >
                                            <ClearIcon />
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }}
                        />
                    </Grid>

                    {/* Tracking Number */}
                    <Grid item xs={12} sm={6} md={4} lg={3}>
                        <TextField
                            fullWidth
                            label="Tracking / PRO Number"
                            placeholder="Search by tracking"
                            value={searchFields.trackingNumber}
                            onChange={(e) => setSearchFields(prev => ({ ...prev, trackingNumber: e.target.value }))}
                            size="small"
                            sx={{
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' }
                            }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <QrCodeIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                    </InputAdornment>
                                ),
                                endAdornment: searchFields.trackingNumber && (
                                    <InputAdornment position="end">
                                        <IconButton
                                            size="small"
                                            onClick={() => setSearchFields(prev => ({ ...prev, trackingNumber: '' }))}
                                        >
                                            <ClearIcon />
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }}
                        />
                    </Grid>

                    {/* Date Range Picker */}
                    <Grid item xs={12} sm={6} md={4} lg={3}>
                        <LocalizationProvider dateAdapter={AdapterDayjs}>
                            <DateRangePicker
                                value={dateRange}
                                onChange={(newValue) => setDateRange(newValue)}
                                label="Date Range"
                                slotProps={{
                                    textField: {
                                        size: "small",
                                        fullWidth: true,
                                        variant: "outlined",
                                        placeholder: "",
                                        sx: {
                                            '& .MuiInputBase-input': { fontSize: '12px' },
                                            '& .MuiInputLabel-root': { fontSize: '12px' }
                                        },
                                        InputProps: {
                                            startAdornment: (
                                                <InputAdornment position="start">
                                                    <CalendarIcon sx={{ color: '#64748b', fontSize: '14px' }} />
                                                </InputAdornment>
                                            )
                                        }
                                    },
                                    actionBar: {
                                        actions: ['clear', 'today', 'accept']
                                    }
                                }}
                                calendars={1}
                                sx={{ width: '100%' }}
                            />
                        </LocalizationProvider>
                    </Grid>
                </Grid>

                {/* Second Row - Origins, Destinations, Customer, and Filters */}
                <Grid container spacing={2} alignItems="center" sx={{ mt: 1 }}>
                    {/* Origin Search */}
                    <Grid item xs={12} sm={6} md={4} lg={3}>
                        <TextField
                            fullWidth
                            label="Origin"
                            placeholder="Search by origin"
                            value={searchFields.origin}
                            onChange={(e) => setSearchFields(prev => ({ ...prev, origin: e.target.value }))}
                            size="small"
                            sx={{
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' }
                            }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                    </InputAdornment>
                                ),
                                endAdornment: searchFields.origin && (
                                    <InputAdornment position="end">
                                        <IconButton
                                            size="small"
                                            onClick={() => setSearchFields(prev => ({ ...prev, origin: '' }))}
                                        >
                                            <ClearIcon />
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }}
                        />
                    </Grid>

                    {/* Destination Search */}
                    <Grid item xs={12} sm={6} md={4} lg={3}>
                        <TextField
                            fullWidth
                            label="Destination"
                            placeholder="Search by destination"
                            value={searchFields.destination}
                            onChange={(e) => setSearchFields(prev => ({ ...prev, destination: e.target.value }))}
                            size="small"
                            sx={{
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiInputLabel-root': { fontSize: '12px' }
                            }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                    </InputAdornment>
                                ),
                                endAdornment: searchFields.destination && (
                                    <InputAdornment position="end">
                                        <IconButton
                                            size="small"
                                            onClick={() => setSearchFields(prev => ({ ...prev, destination: '' }))}
                                        >
                                            <ClearIcon />
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }}
                        />
                    </Grid>

                    {/* Customer Search/Select */}
                    <Grid item xs={12} sm={6} md={4} lg={3}>
                        <Autocomplete
                            size="small"
                            options={Object.entries(customers)}
                            getOptionLabel={(option) => Array.isArray(option) ? option[1] : option}
                            value={selectedCustomer ? [selectedCustomer, customers[selectedCustomer] || selectedCustomer] : null}
                            onChange={(event, newValue) => {
                                if (newValue) {
                                    const customerId = Array.isArray(newValue) ? newValue[0] : newValue;
                                    const customerName = Array.isArray(newValue) ? newValue[1] : customers[newValue] || newValue;
                                    setSelectedCustomer(customerId);
                                    setSearchFields(prev => ({ ...prev, customerName: customerName }));
                                } else {
                                    setSelectedCustomer('');
                                    setSearchFields(prev => ({ ...prev, customerName: '' }));
                                }
                            }}
                            freeSolo
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Customer"
                                    placeholder="Select or type customer"
                                    value={searchFields.customerName}
                                    onChange={(e) => {
                                        setSearchFields(prev => ({ ...prev, customerName: e.target.value }));
                                        if (!e.target.value) {
                                            setSelectedCustomer('');
                                        }
                                    }}
                                    sx={{
                                        '& .MuiInputBase-input': { fontSize: '12px' },
                                        '& .MuiInputLabel-root': { fontSize: '12px' }
                                    }}
                                    InputProps={{
                                        ...params.InputProps,
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <SearchIcon sx={{ fontSize: '14px', color: '#64748b' }} />
                                            </InputAdornment>
                                        )
                                    }}
                                />
                            )}
                            renderOption={(props, option) => (
                                <li {...props}>
                                    <Box>
                                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                            {Array.isArray(option) ? option[1] : option}
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary">
                                            ID: {Array.isArray(option) ? option[0] : option}
                                        </Typography>
                                    </Box>
                                </li>
                            )}
                            sx={{ width: '100%' }}
                        />
                    </Grid>

                    {/* Clear Filters Button */}
                    <Grid item xs={12} sm={6} md={4} lg={3}>
                        <Button
                            variant="outlined"
                            onClick={handleClearFilters}
                            size="small"
                            sx={{
                                height: '40px',
                                width: '100%',
                                fontSize: '12px',
                                color: '#64748b',
                                borderColor: '#e2e8f0'
                            }}
                        >
                            Clear All Filters
                        </Button>
                    </Grid>
                </Grid>
            </Box>
        </Collapse>
    );
};

export default ShipmentFilters; 