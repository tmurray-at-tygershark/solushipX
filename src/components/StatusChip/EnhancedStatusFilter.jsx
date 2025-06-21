import React, { useState, useMemo } from 'react';
import {
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    ListSubheader,
    TextField,
    InputAdornment,
    Chip,
    Box,
    Typography,
    Divider
} from '@mui/material';
import {
    Search as SearchIcon,
    Clear as ClearIcon
} from '@mui/icons-material';
import {
    ENHANCED_STATUSES,
    STATUS_GROUPS,
    getEnhancedStatus,
    getEnhancedStatusColor
} from '../../utils/enhancedStatusModel';

/**
 * Enhanced Status Filter Component
 * Provides comprehensive filtering by granular status with search, groups, and categories
 */
const EnhancedStatusFilter = ({
    value,           // Current selected status ID(s)
    onChange,        // Callback for status change
    multiple = false, // Allow multiple selection
    label = "Status Filter",
    fullWidth = true,
    showGroups = true,   // Show status groups
    showSearch = true,   // Show search functionality
    variant = "outlined"
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [open, setOpen] = useState(false);

    // Filter statuses based on search term
    const filteredStatuses = useMemo(() => {
        if (!searchTerm.trim()) {
            return ENHANCED_STATUSES;
        }

        const filtered = {};
        const searchLower = searchTerm.toLowerCase();

        Object.entries(ENHANCED_STATUSES).forEach(([id, status]) => {
            const matchesSearch =
                status.name.toLowerCase().includes(searchLower) ||
                status.description.toLowerCase().includes(searchLower) ||
                status.category.toLowerCase().includes(searchLower) ||
                status.group.toLowerCase().includes(searchLower) ||
                id.includes(searchTerm);

            if (matchesSearch) {
                filtered[id] = status;
            }
        });

        return filtered;
    }, [searchTerm]);

    // Group filtered statuses by STATUS_GROUPS
    const groupedStatuses = useMemo(() => {
        const grouped = {};

        Object.entries(STATUS_GROUPS).forEach(([groupKey, groupInfo]) => {
            grouped[groupKey] = {
                ...groupInfo,
                statuses: []
            };
        });

        // Add statuses to their respective groups
        Object.entries(filteredStatuses).forEach(([id, status]) => {
            const statusId = parseInt(id);
            const groupKey = status.group;

            if (grouped[groupKey]) {
                grouped[groupKey].statuses.push({
                    id: statusId,
                    ...status
                });
            }
        });

        // Remove empty groups
        Object.keys(grouped).forEach(key => {
            if (grouped[key].statuses.length === 0) {
                delete grouped[key];
            }
        });

        return grouped;
    }, [filteredStatuses]);

    const handleStatusChange = (event) => {
        const selectedValue = event.target.value;
        onChange(selectedValue);
    };

    const handleClear = () => {
        onChange(multiple ? [] : '');
    };

    const renderStatusChip = (statusId) => {
        const status = getEnhancedStatus(statusId);
        if (!status) return null;

        const colorConfig = getEnhancedStatusColor(statusId);

        return (
            <Chip
                key={statusId}
                label={`${status.name} (${statusId})`}
                size="small"
                sx={{
                    color: colorConfig.color,
                    bgcolor: colorConfig.bgcolor,
                    borderRadius: '16px',
                    fontWeight: 500,
                    fontSize: '0.75rem',
                    height: '24px',
                    margin: '2px',
                    '& .MuiChip-label': {
                        px: 2
                    }
                }}
                onDelete={() => {
                    if (multiple) {
                        const newValue = Array.isArray(value)
                            ? value.filter(id => id !== statusId)
                            : [];
                        onChange(newValue);
                    }
                }}
            />
        );
    };

    const renderValue = (selected) => {
        if (!selected || (Array.isArray(selected) && selected.length === 0)) {
            return <em>Select Status</em>;
        }

        if (multiple) {
            if (Array.isArray(selected) && selected.length > 0) {
                return (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selected.map(statusId => renderStatusChip(statusId))}
                    </Box>
                );
            }
        } else {
            const status = getEnhancedStatus(selected);
            return status ? `${status.name} (${selected})` : `Status ${selected}`;
        }

        return <em>Select Status</em>;
    };

    return (
        <FormControl fullWidth={fullWidth} variant={variant} sx={{ '& .MuiInputLabel-root': { fontSize: '12px' }, '& .MuiInputBase-input': { fontSize: '12px' }, '& .MuiSelect-select': { fontSize: '12px' } }}>
            <InputLabel id="enhanced-status-filter-label" sx={{ fontSize: '12px' }}>{label}</InputLabel>
            <Select
                labelId="enhanced-status-filter-label"
                id="enhanced-status-filter"
                value={value || (multiple ? [] : '')}
                label={label}
                onChange={handleStatusChange}
                multiple={multiple}
                open={open}
                onOpen={() => setOpen(true)}
                onClose={() => setOpen(false)}
                renderValue={renderValue}
                MenuProps={{
                    PaperProps: {
                        sx: {
                            maxHeight: 400,
                            width: 300,
                            '& .MuiMenuItem-root': { fontSize: '12px' },
                            '& .MuiListSubheader-root': { fontSize: '12px' }
                        }
                    }
                }}
                endAdornment={
                    (value && ((multiple && Array.isArray(value) && value.length > 0) || (!multiple && value))) && (
                        <InputAdornment position="end">
                            <ClearIcon
                                sx={{
                                    cursor: 'pointer',
                                    mr: 1,
                                    fontSize: '1rem',
                                    '&:hover': { color: 'primary.main' }
                                }}
                                onClick={handleClear}
                            />
                        </InputAdornment>
                    )
                }
            >
                {/* Search Input */}
                {showSearch && (
                    <ListSubheader sx={{ bgcolor: 'background.paper', zIndex: 1, fontSize: '12px' }}>
                        <TextField
                            size="small"
                            autoFocus
                            placeholder="Search statuses..."
                            fullWidth
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon sx={{ fontSize: '16px' }} />
                                    </InputAdornment>
                                ),
                                sx: { fontSize: '12px' }
                            }}
                            InputLabelProps={{ sx: { fontSize: '12px' } }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key !== 'Escape') {
                                    e.stopPropagation();
                                }
                            }}
                            sx={{ fontSize: '12px' }}
                        />
                    </ListSubheader>
                )}

                {/* Quick Options */}
                <MenuItem value="" sx={{ fontSize: '12px' }}>
                    <em>All Statuses</em>
                </MenuItem>
                <MenuItem value={230} sx={{ fontSize: '12px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip
                            label="Any"
                            size="small"
                            sx={{
                                bgcolor: '#64748b20',
                                color: '#64748b',
                                fontWeight: 500,
                                fontSize: '0.75rem'
                            }}
                        />
                        <Typography variant="body2" sx={{ fontSize: '12px' }}>System Filter</Typography>
                    </Box>
                </MenuItem>

                <Divider />

                {/* Grouped Status Options */}
                {showGroups ? (
                    Object.entries(groupedStatuses).flatMap(([groupKey, group]) => [
                        <ListSubheader key={`header-${groupKey}`} sx={{ bgcolor: 'background.default', fontSize: '12px' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box
                                    sx={{
                                        width: 12,
                                        height: 12,
                                        borderRadius: '50%',
                                        bgcolor: group.color
                                    }}
                                />
                                <Typography variant="subtitle2" fontWeight="bold" sx={{ fontSize: '12px' }}>
                                    {group.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '11px' }}>
                                    ({group.statuses.length})
                                </Typography>
                            </Box>
                        </ListSubheader>,
                        ...group.statuses.map(status => (
                            <MenuItem key={status.id} value={status.id} sx={{ fontSize: '12px' }}>
                                <Chip
                                    label={status.name}
                                    size="small"
                                    sx={{
                                        bgcolor: `${status.color}20`,
                                        color: status.color,
                                        fontWeight: 500,
                                        fontSize: '0.75rem'
                                    }}
                                />
                            </MenuItem>
                        ))
                    ])
                ) : (
                    // Flat list without groups
                    Object.entries(filteredStatuses).map(([id, status]) => (
                        <MenuItem key={id} value={parseInt(id)} sx={{ fontSize: '12px' }}>
                            <Chip
                                label={status.name}
                                size="small"
                                sx={{
                                    bgcolor: `${status.color}20`,
                                    color: status.color,
                                    fontWeight: 500,
                                    fontSize: '0.75rem'
                                }}
                            />
                        </MenuItem>
                    ))
                )}
            </Select>
        </FormControl>
    );
};

export default EnhancedStatusFilter; 