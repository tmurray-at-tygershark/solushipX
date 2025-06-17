import React, { useState } from 'react';
import {
    Box,
    Button,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Grid,
    InputAdornment,
    IconButton,
    Popper,
    Paper,
    ClickAwayListener,
    MenuList,
    ListItemText,
    Divider
} from '@mui/material';
import {
    CalendarToday as CalendarIcon,
    KeyboardArrowDown as ArrowDownIcon,
    Clear as ClearIcon
} from '@mui/icons-material';
import { DateRangePicker } from '@mui/x-date-pickers-pro/DateRangePicker';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import dayjs from 'dayjs';

const DateRangePickerWithQuickOptions = ({
    value,
    onChange,
    label = "Date Range",
    size = "small",
    fullWidth = true,
    sx = {},
    ...props
}) => {
    const [quickMenuOpen, setQuickMenuOpen] = useState(false);
    const [anchorEl, setAnchorEl] = useState(null);

    // Quick date range options
    const quickOptions = [
        {
            label: 'Today',
            getValue: () => [dayjs().startOf('day'), dayjs().endOf('day')]
        },
        {
            label: 'Yesterday',
            getValue: () => [dayjs().subtract(1, 'day').startOf('day'), dayjs().subtract(1, 'day').endOf('day')]
        },
        {
            label: 'This Week',
            getValue: () => [dayjs().startOf('week'), dayjs().endOf('week')]
        },
        {
            label: 'Last Week',
            getValue: () => [dayjs().subtract(1, 'week').startOf('week'), dayjs().subtract(1, 'week').endOf('week')]
        },
        {
            label: 'This Month',
            getValue: () => [dayjs().startOf('month'), dayjs().endOf('month')]
        },
        {
            label: 'Last Month',
            getValue: () => [dayjs().subtract(1, 'month').startOf('month'), dayjs().subtract(1, 'month').endOf('month')]
        },
        {
            label: 'Last 7 Days',
            getValue: () => [dayjs().subtract(7, 'day').startOf('day'), dayjs().endOf('day')]
        },
        {
            label: 'Last 30 Days',
            getValue: () => [dayjs().subtract(30, 'day').startOf('day'), dayjs().endOf('day')]
        },
        {
            label: 'Last 90 Days',
            getValue: () => [dayjs().subtract(90, 'day').startOf('day'), dayjs().endOf('day')]
        },
        {
            label: 'This Quarter',
            getValue: () => [dayjs().startOf('quarter'), dayjs().endOf('quarter')]
        },
        {
            label: 'Last Quarter',
            getValue: () => [dayjs().subtract(1, 'quarter').startOf('quarter'), dayjs().subtract(1, 'quarter').endOf('quarter')]
        },
        {
            label: 'This Year',
            getValue: () => [dayjs().startOf('year'), dayjs().endOf('year')]
        },
        {
            label: 'Last Year',
            getValue: () => [dayjs().subtract(1, 'year').startOf('year'), dayjs().subtract(1, 'year').endOf('year')]
        }
    ];

    const handleQuickOptionClick = (event) => {
        setAnchorEl(event.currentTarget);
        setQuickMenuOpen(true);
    };

    const handleQuickOptionClose = () => {
        setQuickMenuOpen(false);
        setAnchorEl(null);
    };

    const handleQuickOptionSelect = (option) => {
        const dateRange = option.getValue();
        onChange(dateRange);
        handleQuickOptionClose();
    };

    const handleClear = () => {
        onChange([null, null]);
    };

    const formatDateRangeText = () => {
        if (!value || !value[0] || !value[1]) {
            return label;
        }

        const startDate = value[0];
        const endDate = value[1];

        // Check if it matches any quick option
        const matchingOption = quickOptions.find(option => {
            const [optionStart, optionEnd] = option.getValue();
            return startDate.isSame(optionStart, 'day') && endDate.isSame(optionEnd, 'day');
        });

        if (matchingOption) {
            return matchingOption.label;
        }

        // Format custom date range
        if (startDate.isSame(endDate, 'day')) {
            return startDate.format('MMM D, YYYY');
        }

        return `${startDate.format('MMM D')} - ${endDate.format('MMM D, YYYY')}`;
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <Box sx={{ position: 'relative', ...sx }}>
                <Grid container spacing={0} alignItems="stretch">
                    {/* Quick Options Button */}
                    <Grid item xs={4}>
                        <Button
                            fullWidth
                            variant="outlined"
                            onClick={handleQuickOptionClick}
                            endIcon={<ArrowDownIcon />}
                            sx={{
                                height: '40px',
                                borderTopRightRadius: 0,
                                borderBottomRightRadius: 0,
                                borderRight: 'none',
                                fontSize: '12px',
                                textTransform: 'none',
                                color: '#64748b',
                                borderColor: '#d1d5db',
                                backgroundColor: '#f8fafc',
                                '&:hover': {
                                    backgroundColor: '#f1f5f9',
                                    borderColor: '#d1d5db'
                                },
                                '& .MuiButton-endIcon': {
                                    marginLeft: 'auto'
                                }
                            }}
                        >
                            Quick
                        </Button>
                    </Grid>

                    {/* Date Range Picker */}
                    <Grid item xs={8}>
                        <DateRangePicker
                            value={value}
                            onChange={onChange}
                            label={null}
                            slotProps={{
                                textField: {
                                    size: size,
                                    fullWidth: true,
                                    variant: "outlined",
                                    placeholder: formatDateRangeText(),
                                    sx: {
                                        '& .MuiInputBase-input': {
                                            fontSize: '12px',
                                            cursor: 'pointer'
                                        },
                                        '& .MuiInputLabel-root': { fontSize: '12px' },
                                        '& .MuiOutlinedInput-root': {
                                            borderTopLeftRadius: 0,
                                            borderBottomLeftRadius: 0,
                                            height: '40px'
                                        },
                                        '& .MuiOutlinedInput-input': {
                                            textAlign: 'center',
                                            color: value && value[0] && value[1] ? '#374151' : '#64748b'
                                        }
                                    },
                                    InputProps: {
                                        startAdornment: (
                                            <InputAdornment position="start">
                                                <CalendarIcon sx={{ color: '#64748b', fontSize: 18 }} />
                                            </InputAdornment>
                                        ),
                                        endAdornment: value && value[0] && value[1] && (
                                            <InputAdornment position="end">
                                                <IconButton
                                                    size="small"
                                                    onClick={handleClear}
                                                    sx={{ padding: '2px' }}
                                                >
                                                    <ClearIcon sx={{ fontSize: 16 }} />
                                                </IconButton>
                                            </InputAdornment>
                                        ),
                                        readOnly: true
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
                            {...props}
                        />
                    </Grid>
                </Grid>

                {/* Quick Options Menu */}
                <Popper
                    open={quickMenuOpen}
                    anchorEl={anchorEl}
                    placement="bottom-start"
                    sx={{ zIndex: 1300 }}
                >
                    <ClickAwayListener onClickAway={handleQuickOptionClose}>
                        <Paper
                            elevation={8}
                            sx={{
                                maxHeight: 400,
                                overflowY: 'auto',
                                minWidth: 200,
                                border: '1px solid #e2e8f0'
                            }}
                        >
                            <MenuList dense>
                                {quickOptions.map((option, index) => (
                                    <div key={option.label}>
                                        <MenuItem
                                            onClick={() => handleQuickOptionSelect(option)}
                                            sx={{
                                                fontSize: '12px',
                                                py: 1,
                                                '&:hover': {
                                                    backgroundColor: '#f8fafc'
                                                }
                                            }}
                                        >
                                            <ListItemText
                                                primary={option.label}
                                                primaryTypographyProps={{
                                                    fontSize: '12px',
                                                    color: '#374151'
                                                }}
                                            />
                                        </MenuItem>
                                        {/* Add dividers for logical groupings */}
                                        {(index === 1 || index === 3 || index === 5 || index === 8 || index === 10) && (
                                            <Divider />
                                        )}
                                    </div>
                                ))}
                            </MenuList>
                        </Paper>
                    </ClickAwayListener>
                </Popper>
            </Box>
        </LocalizationProvider>
    );
};

export default DateRangePickerWithQuickOptions; 