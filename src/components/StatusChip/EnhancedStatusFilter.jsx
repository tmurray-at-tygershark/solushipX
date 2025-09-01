import React, { useState, useMemo, useEffect } from 'react';
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

import shipmentStatusService from '../../services/shipmentStatusService';

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

    // Dynamic status states
    const [dynamicStatuses, setDynamicStatuses] = useState({});
    const [dynamicGroups, setDynamicGroups] = useState({});
    const [loading, setLoading] = useState(true);

    // Load dynamic master statuses from Firebase
    useEffect(() => {
        const loadDynamicStatuses = async () => {
            try {
                setLoading(true);
                const masterStatuses = await shipmentStatusService.loadMasterStatuses();
                const formattedStatuses = shipmentStatusService.formatMasterStatusesForDropdown(masterStatuses);
                const masterGroups = shipmentStatusService.getMasterStatusGroups();

                setDynamicStatuses(formattedStatuses);
                setDynamicGroups(masterGroups);

                console.log('✅ Loaded dynamic shipment statuses:', Object.keys(formattedStatuses).length);
            } catch (error) {
                console.error('❌ Error loading dynamic statuses:', error);
                // Keep empty statuses on error - don't show hardcoded fallbacks
                setDynamicStatuses({});
                setDynamicGroups({});
            } finally {
                setLoading(false);
            }
        };

        loadDynamicStatuses();
    }, []);

    // Use only dynamic master statuses from Firebase
    const allStatuses = useMemo(() => {
        return dynamicStatuses;
    }, [dynamicStatuses]);

    // Use only dynamic groups from Firebase  
    const allGroups = useMemo(() => {
        return dynamicGroups;
    }, [dynamicGroups]);

    // Filter statuses based on search term
    const filteredStatuses = useMemo(() => {
        if (!searchTerm.trim()) {
            return allStatuses;
        }

        const filtered = {};
        const searchLower = searchTerm.toLowerCase();

        Object.entries(allStatuses).forEach(([id, status]) => {
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
    }, [searchTerm, allStatuses]);

    // Group filtered statuses by all groups (static + dynamic)
    const groupedStatuses = useMemo(() => {
        const grouped = {};

        Object.entries(allGroups).forEach(([groupKey, groupInfo]) => {
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
    }, [filteredStatuses, allGroups]);

    // Helpers to find status objects
    const findStatusByCode = (code) => {
        if (!code) return null;
        return Object.values(allStatuses).find(s => s.statusCode === code) || null;
    };
    const findStatusById = (id) => {
        return allStatuses[id] || null;
    };

    const handleStatusChange = (event) => {
        const selectedValue = event.target.value;
        // selectedValue will be the statusCode (e.g., 'delivered')
        onChange(selectedValue);
    };

    const handleClear = () => {
        onChange(multiple ? [] : '');
    };

    const renderStatusChip = (statusCodeOrId) => {
        // Support either statusCode (string) or internal numeric id
        const status = typeof statusCodeOrId === 'string'
            ? findStatusByCode(statusCodeOrId)
            : findStatusById(statusCodeOrId);
        if (!status) return null;

        const colorConfig = status.color ? {
            color: status.fontColor || '#ffffff',
            bgcolor: status.color
        } : {
            color: '#6b7280',
            bgcolor: '#f3f4f6'
        };

        return (
            <Chip
                key={status.statusCode || status.id}
                label={status.name}
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
                            ? value.filter(v => v !== statusCodeOrId)
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
            const status = findStatusByCode(selected) || findStatusById(selected);
            return status ? `${status.name}` : `Status ${selected}`;
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
                disabled={loading}
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

                {/* Loading state */}
                {loading && (
                    <MenuItem disabled sx={{ fontSize: '12px' }}>
                        <em>Loading statuses...</em>
                    </MenuItem>
                )}

                {/* Quick Options */}
                {!loading && (
                    <MenuItem value="" sx={{ fontSize: '12px' }}>
                        <em>All Statuses</em>
                    </MenuItem>
                )}



                {!loading && <Divider />}

                {/* Grouped Status Options */}
                {!loading && showGroups ? (
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
                            <MenuItem key={status.statusCode || status.id} value={status.statusCode} sx={{ fontSize: '12px' }}>
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
                ) : !loading ? (
                    // Flat list without groups
                    Object.entries(filteredStatuses).map(([id, status]) => (
                        <MenuItem key={status.statusCode || id} value={status.statusCode} sx={{ fontSize: '12px' }}>
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
                ) : null}
            </Select>
        </FormControl>
    );
};

export default EnhancedStatusFilter; 