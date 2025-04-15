import React from 'react';
import { Fab, Tooltip, Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { motion, AnimatePresence } from 'framer-motion';
import SmartToyIcon from '@mui/icons-material/SmartToy';

const StyledFab = styled(Fab)(({ theme }) => ({
    position: 'fixed',
    bottom: theme.spacing(4),
    right: theme.spacing(4),
    background: 'linear-gradient(45deg, #6B46C1, #805AD5)',
    color: 'white',
    '&:hover': {
        background: 'linear-gradient(45deg, #805AD5, #6B46C1)',
    },
    zIndex: 1000,
}));

const PulseRing = styled(Box)(({ theme }) => ({
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    animation: 'pulse 2s infinite',
    background: 'linear-gradient(45deg, #6B46C1, #805AD5)',
    '@keyframes pulse': {
        '0%': {
            transform: 'scale(1)',
            opacity: 0.8,
        },
        '70%': {
            transform: 'scale(1.3)',
            opacity: 0,
        },
        '100%': {
            transform: 'scale(1.3)',
            opacity: 0,
        },
    },
}));

const AIButton = ({ onClick }) => {
    return (
        <AnimatePresence>
            <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            >
                <Tooltip title="Ask AI Assistant" placement="left">
                    <Box sx={{ position: 'relative' }}>
                        <PulseRing />
                        <StyledFab
                            onClick={onClick}
                            size="large"
                            aria-label="AI Assistant"
                        >
                            <SmartToyIcon />
                        </StyledFab>
                    </Box>
                </Tooltip>
            </motion.div>
        </AnimatePresence>
    );
};

export default AIButton; 