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
                <Grid container spacing={1} alignItems="center">
                    {/* Shipment ID Search */}
                    <Grid item xs={12} sm={6} md={3}>
                        <TextField
                            fullWidth
                            label="Shipment ID"
                            placeholder="Search by Shipment ID (e.g. SH-12345)"
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
                    <Grid item xs={12} sm={6} md={3}>
                        <TextField
                            fullWidth
                            label="Reference Number"
                            placeholder="Search by reference number"
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
                    <Grid item xs={12} sm={6} md={3}>
                        <TextField
                            fullWidth
                            label="Tracking / PRO Number"
                            placeholder="Search by tracking number"
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
                    <Grid item xs={12} sm={6} md={3}>
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
                                                    <CalendarIcon sx={{ color: '#64748b' }} />
                                                </InputAdornment>
                                            )
                                        }
                                    },
                                    actionBar: {
                                        actions: ['clear', 'today', 'accept']
                                    },
                                    separator: {
                                        children: ''
                                    }
                                }}
                                calendars={2}
                                sx={{ width: '100%' }}
                            />
                        </LocalizationProvider>
                    </Grid>
                </Grid>

                {/* Second Row */}
                <Grid container spacing={1} alignItems="center" sx={{ mt: 1 }}>
                    {/* Origin Search */}
                    <Grid item xs={12} sm={6} md={3}>
                        <TextField
                            fullWidth
                            label="Origin"
                            placeholder="Search by origin city, state, etc."
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
                    <Grid item xs={12} sm={6} md={3}>
                        <TextField
                            fullWidth
                            label="Destination"
                            placeholder="Search by destination city, state, etc."
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

                    {/* Customer Search with Autocomplete */}
                    <Grid item xs={12} sm={6} md={3}>
                        <Autocomplete
                            fullWidth
                            options={Object.entries(customers).map(([id, name]) => ({ id, name }))}
                            getOptionLabel={(option) => option.name}
                            value={selectedCustomer ? { id: selectedCustomer, name: customers[selectedCustomer] } : null}
                            onChange={(event, newValue) => setSelectedCustomer(newValue?.id || '')}
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Search Customers"
                                    placeholder="Search customers"
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                        '& .MuiInputBase-input': { fontSize: '12px', minHeight: '1.5em', py: '8.5px' },
                                        '& .MuiInputLabel-root': {
                                            fontSize: '12px',
                                            '&.MuiInputLabel-shrink': {
                                                fontSize: '12px'
                                            }
                                        },
                                        '& .MuiOutlinedInput-root': { minHeight: '40px' }
                                    }}
                                />
                            )}
                            sx={{
                                '& .MuiAutocomplete-input': { fontSize: '12px', minHeight: '1.5em', py: '8.5px' },
                                '& .MuiInputLabel-root': {
                                    fontSize: '12px',
                                    '&.MuiInputLabel-shrink': {
                                        fontSize: '12px'
                                    }
                                },
                                '& .MuiOutlinedInput-root': { minHeight: '40px' },
                                fontSize: '12px',
                                minHeight: '40px',
                                display: 'flex',
                                alignItems: 'center'
                            }}
                            ListboxProps={{
                                sx: { fontSize: '12px' }
                            }}
                        />
                    </Grid>

                </Grid>

                {/* Third Row */}
                <Grid container spacing={1} alignItems="center" sx={{ mt: 1 }}>
                    {/* Carrier Selection with Sub-carriers */}
                    <Grid item xs={12} sm={6} md={3}>
                        <FormControl fullWidth>
                            <InputLabel sx={{ fontSize: '12px' }}>Carrier</InputLabel>
                            <Select
                                value={filters.carrier}
                                onChange={(e) => setFilters(prev => ({
                                    ...prev,
                                    carrier: e.target.value
                                }))}
                                label="Carrier"
                                sx={{ fontSize: '12px' }}
                                MenuProps={{
                                    PaperProps: {
                                        sx: { '& .MuiMenuItem-root': { fontSize: '12px' } }
                                    }
                                }}
                            >
                                <MenuItem value="all" sx={{ fontSize: '12px' }}>All Carriers</MenuItem>
                                {carrierOptions.map((group) => [
                                    <ListSubheader key={group.group} sx={{ fontSize: '12px' }}>{group.group}</ListSubheader>,
                                    ...group.carriers.map((carrier) => (
                                        <MenuItem key={carrier.id} value={carrier.id} sx={{ fontSize: '12px' }}>
                                            {carrier.name}
                                        </MenuItem>
                                    ))
                                ])}
                            </Select>
                        </FormControl>
                    </Grid>

                    {/* Shipment Type */}
                    <Grid item xs={12} sm={6} md={2}>
                        <FormControl fullWidth>
                            <InputLabel sx={{ fontSize: '12px' }}>Type</InputLabel>
                            <Select
                                value={filters.shipmentType}
                                onChange={(e) => setFilters(prev => ({
                                    ...prev,
                                    shipmentType: e.target.value
                                }))}
                                label="Type"
                                sx={{ fontSize: '12px' }}
                                MenuProps={{
                                    PaperProps: {
                                        sx: { '& .MuiMenuItem-root': { fontSize: '12px' } }
                                    }
                                }}
                            >
                                <MenuItem value="all" sx={{ fontSize: '12px' }}>All Types</MenuItem>
                                <MenuItem value="courier" sx={{ fontSize: '12px' }}>Courier</MenuItem>
                                <MenuItem value="freight" sx={{ fontSize: '12px' }}>Freight</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>

                    {/* Enhanced Status Filter */}
                    <Grid item xs={12} sm={6} md={3}>
                        <EnhancedStatusFilter
                            value={filters.enhancedStatus || ''}
                            onChange={(value) => setFilters(prev => ({
                                ...prev,
                                enhancedStatus: value,
                                // Keep legacy status for backward compatibility
                                status: value ? enhancedToLegacy(value) : 'all'
                            }))}
                            label="Shipment Status"
                            showGroups={true}
                            showSearch={true}
                            fullWidth={true}
                            sx={{
                                '& .MuiInputLabel-root': { fontSize: '12px' },
                                '& .MuiInputBase-input': { fontSize: '12px' },
                                '& .MuiSelect-select': { fontSize: '12px' },
                                '& .MuiMenuItem-root': { fontSize: '12px' }
                            }}
                        />
                    </Grid>

                    {/* Clear Filters Button */}
                    {(Object.values(searchFields).some(val => val !== '') ||
                        filters.carrier !== 'all' ||
                        filters.shipmentType !== 'all' ||
                        filters.status !== 'all' ||
                        dateRange[0] || dateRange[1]) && (
                            <Grid item xs={12} sm={6} md={1}>
                                <Button
                                    fullWidth
                                    variant="outlined"
                                    onClick={handleClearFilters}
                                    startIcon={<ClearIcon />}
                                    sx={{
                                        borderColor: '#e2e8f0',
                                        color: '#64748b',
                                        '&:hover': {
                                            borderColor: '#cbd5e1',
                                            bgcolor: '#f8fafc'
                                        }
                                    }}
                                >
                                    Clear
                                </Button>
                            </Grid>
                        )}
                </Grid>

                {/* Active Filters Display */}
                {(Object.values(searchFields).some(val => val !== '') ||
                    filters.carrier !== 'all' ||
                    filters.shipmentType !== 'all' ||
                    filters.status !== 'all' ||
                    dateRange[0] || dateRange[1]) && (
                        <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            <Typography variant="body2" sx={{ color: '#64748b', mr: 1, display: 'flex', alignItems: 'center' }}>
                                <FilterAltIcon sx={{ fontSize: 16, mr: 0.5 }} />
                                Active Filters:
                            </Typography>
                            {Object.entries(searchFields).map(([key, value]) => value && (
                                <Chip
                                    key={key}
                                    label={`${key.replace(/([A-Z])/g, ' $1').toLowerCase()}: ${value}`}
                                    onDelete={() => setSearchFields(prev => ({ ...prev, [key]: '' }))}
                                    size="small"
                                    sx={{ bgcolor: '#f1f5f9' }}
                                />
                            ))}
                            {filters.carrier !== 'all' && (
                                <Chip
                                    label={`Carrier: ${carrierOptions.flatMap(g => g.carriers).find(c => c.id === filters.carrier)?.name || filters.carrier}`}
                                    onDelete={() => setFilters(prev => ({ ...prev, carrier: 'all' }))}
                                    size="small"
                                    sx={{ bgcolor: '#f1f5f9' }}
                                />
                            )}
                            {filters.shipmentType !== 'all' && (
                                <Chip
                                    label={`Type: ${filters.shipmentType}`}
                                    onDelete={() => setFilters(prev => ({ ...prev, shipmentType: 'all' }))}
                                    size="small"
                                    sx={{ bgcolor: '#f1f5f9' }}
                                />
                            )}
                            {filters.status !== 'all' && (
                                <Chip
                                    label={`Status: ${filters.status}`}
                                    onDelete={() => setFilters(prev => ({ ...prev, status: 'all' }))}
                                    size="small"
                                    sx={{ bgcolor: '#f1f5f9' }}
                                />
                            )}
                            {(dateRange[0] || dateRange[1]) && (
                                <Chip
                                    label={`Date: ${dateRange[0]?.format('MMM D, YYYY')} - ${dateRange[1]?.format('MMM D, YYYY')}`}
                                    onDelete={() => setDateRange([null, null])}
                                    size="small"
                                    sx={{ bgcolor: '#f1f5f9' }}
                                />
                            )}
                        </Box>
                    )}
            </Box>
        </Collapse>
    );
};

export default ShipmentFilters; 