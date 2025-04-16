import React from 'react';
import { TextField, InputAdornment, IconButton } from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material';
import { styled } from '@mui/material/styles';

const StyledTextField = styled(TextField)(({ theme }) => ({
    '& .MuiOutlinedInput-root': {
        backgroundColor: theme.palette.background.paper,
        borderRadius: theme.shape.borderRadius,
        '&:hover': {
            backgroundColor: theme.palette.action.hover,
        },
    },
}));

const SearchBar = ({ value, onChange, onFocus, onBlur, placeholder = "Search..." }) => {
    return (
        <StyledTextField
            fullWidth
            value={value}
            onChange={onChange}
            onFocus={onFocus}
            onBlur={onBlur}
            placeholder={placeholder}
            InputProps={{
                startAdornment: (
                    <InputAdornment position="start">
                        <SearchIcon sx={{ color: 'text.secondary' }} />
                    </InputAdornment>
                ),
                endAdornment: value && (
                    <InputAdornment position="end">
                        <IconButton
                            size="small"
                            onClick={() => onChange({ target: { value: '' } })}
                            sx={{ color: 'text.secondary' }}
                        >
                            <ClearIcon />
                        </IconButton>
                    </InputAdornment>
                ),
            }}
        />
    );
};

export default SearchBar; 