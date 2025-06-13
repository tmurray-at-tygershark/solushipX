import React from 'react';
import { Box, Typography, IconButton, Select, MenuItem, FormControl, Divider } from '@mui/material';
import { KeyboardArrowLeft, KeyboardArrowRight, FirstPage, LastPage } from '@mui/icons-material';

const ShipmentsPagination = ({
    totalCount = 0,
    page = 0,
    rowsPerPage = 50,
    onPageChange,
    onRowsPerPageChange,
    rowsPerPageOptions = [10, 25, 50, 100, { label: 'All', value: -1 }]
}) => {
    const totalPages = rowsPerPage > 0 ? Math.ceil(totalCount / rowsPerPage) : 1;
    const startItem = totalCount > 0 ? page * rowsPerPage + 1 : 0;
    const endItem = rowsPerPage > 0 ? Math.min((page + 1) * rowsPerPage, totalCount) : totalCount;

    return (
        <Box sx={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            pt: 0.5,
            pb: 1,
            px: 1
        }}>
            {/* Left side */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="body2" sx={{ fontSize: '13px', color: 'text.secondary' }}>
                    {`Showing ${startItem} - ${endItem} of ${totalCount}`}
                </Typography>
                <Divider orientation="vertical" flexItem />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body2" sx={{ fontSize: '13px', color: 'text.secondary' }}>Rows:</Typography>
                    <Select
                        value={rowsPerPage}
                        onChange={onRowsPerPageChange}
                        size="small"
                        sx={{ fontSize: '13px', '.MuiSelect-select': { py: '4px' } }}
                    >
                        {rowsPerPageOptions.map(option => {
                            const value = typeof option === 'object' ? option.value : option;
                            const label = typeof option === 'object' ? option.label : option;
                            return <MenuItem key={value} value={value} sx={{ fontSize: '13px' }}>{label}</MenuItem>;
                        })}
                    </Select>
                </Box>
            </Box>

            {/* Right side */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ fontSize: '13px', color: 'text.secondary' }}>
                    Page {page + 1} of {totalPages}
                </Typography>
                <IconButton onClick={(e) => onPageChange(e, 0)} disabled={page === 0} size="small">
                    <FirstPage />
                </IconButton>
                <IconButton onClick={(e) => onPageChange(e, page - 1)} disabled={page === 0} size="small">
                    <KeyboardArrowLeft />
                </IconButton>
                <IconButton onClick={(e) => onPageChange(e, page + 1)} disabled={page >= totalPages - 1} size="small">
                    <KeyboardArrowRight />
                </IconButton>
                <IconButton onClick={(e) => onPageChange(e, totalPages - 1)} disabled={page >= totalPages - 1} size="small">
                    <LastPage />
                </IconButton>
            </Box>
        </Box>
    );
};

export default ShipmentsPagination;


