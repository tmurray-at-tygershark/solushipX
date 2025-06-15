import React, { useState } from 'react';
import {
    Box,
    Typography,
    Grid,
    Popover,
    IconButton,
    Chip,
    Tooltip
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import AssessmentIcon from '@mui/icons-material/Assessment';

const CarrierStatsPopover = ({ rawRateApiResponseData }) => {
    const [anchorEl, setAnchorEl] = useState(null);

    const handleClick = (event) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const open = Boolean(anchorEl);

    if (!rawRateApiResponseData?.summary) {
        return null;
    }

    return (
        <>
            <Tooltip title="View carrier performance statistics">
                <IconButton
                    onClick={handleClick}
                    size="small"
                    sx={{
                        color: 'text.secondary',
                        '&:hover': {
                            color: 'primary.main',
                            backgroundColor: 'action.hover'
                        }
                    }}
                >
                    <AssessmentIcon fontSize="small" />
                </IconButton>
            </Tooltip>

            <Popover
                open={open}
                anchorEl={anchorEl}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'bottom',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                PaperProps={{
                    sx: {
                        p: 2,
                        maxWidth: 400,
                        boxShadow: 3
                    }
                }}
            >
                <Box sx={{ mb: 2 }}>
                    <Typography variant="h6" sx={{ fontSize: '14px', fontWeight: 600, mb: 1 }}>
                        Carrier Performance
                    </Typography>
                </Box>

                <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '11px' }}>
                            Carriers Queried
                        </Typography>
                        <Typography variant="h6" sx={{ fontSize: '16px' }}>
                            {rawRateApiResponseData.summary.totalCarriers}
                        </Typography>
                    </Grid>
                    <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '11px' }}>
                            Successful
                        </Typography>
                        <Typography variant="h6" color="success.main" sx={{ fontSize: '16px' }}>
                            {rawRateApiResponseData.summary.successfulCarriers}
                        </Typography>
                    </Grid>
                    <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '11px' }}>
                            Total Rates
                        </Typography>
                        <Typography variant="h6" sx={{ fontSize: '16px' }}>
                            {rawRateApiResponseData.summary.totalRates}
                        </Typography>
                    </Grid>
                    <Grid item xs={6}>
                        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '11px' }}>
                            Fetch Time
                        </Typography>
                        <Typography variant="h6" sx={{ fontSize: '16px' }}>
                            {(rawRateApiResponseData.summary.executionTime / 1000).toFixed(1)}s
                        </Typography>
                    </Grid>
                </Grid>

                {rawRateApiResponseData.results && rawRateApiResponseData.results.length > 0 && (
                    <Box>
                        <Typography variant="subtitle2" sx={{ mb: 1, fontSize: '12px' }}>
                            Carrier Results:
                        </Typography>
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {rawRateApiResponseData.results.map((result, index) => (
                                <Chip
                                    key={index}
                                    label={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <span>{result.success ? '✅' : '❌'}</span>
                                            <span>{result.carrier}</span>
                                            {result.success && <span>({result.rates.length})</span>}
                                        </Box>
                                    }
                                    size="small"
                                    variant="outlined"
                                    sx={{
                                        fontSize: '10px',
                                        height: 'auto',
                                        '& .MuiChip-label': {
                                            px: 1,
                                            py: 0.5
                                        },
                                        borderColor: result.success ? 'success.main' : 'error.main',
                                        color: result.success ? 'success.main' : 'error.main'
                                    }}
                                    title={result.success ? `${result.rates.length} rates in ${result.responseTime}ms` : result.error}
                                />
                            ))}
                        </Box>
                    </Box>
                )}
            </Popover>
        </>
    );
};

export default CarrierStatsPopover; 