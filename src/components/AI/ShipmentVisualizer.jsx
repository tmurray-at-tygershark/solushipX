import React from 'react';
import { Box, Paper, Typography, LinearProgress } from '@mui/material';
import { styled } from '@mui/material/styles';
import { motion } from 'framer-motion';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import InventoryIcon from '@mui/icons-material/Inventory';
import EventIcon from '@mui/icons-material/Event';

const VisualizerPaper = styled(Paper)(({ theme }) => ({
    padding: theme.spacing(3),
    borderRadius: 20,
    background: 'white',
    height: '100%',
    boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(3),
}));

const StepCard = styled(Paper)(({ theme, completed }) => ({
    padding: theme.spacing(2),
    borderRadius: 16,
    background: completed ? 'linear-gradient(45deg, #6B46C1, #805AD5)' : 'white',
    color: completed ? 'white' : 'inherit',
    boxShadow: completed ? '0 4px 20px rgba(107, 70, 193, 0.2)' : '0 2px 12px rgba(0,0,0,0.05)',
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(2),
    transition: 'all 0.3s ease',
    '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: completed ? '0 6px 24px rgba(107, 70, 193, 0.3)' : '0 4px 20px rgba(0,0,0,0.1)',
    },
}));

const IconWrapper = styled(Box)(({ theme, completed }) => ({
    width: 40,
    height: 40,
    borderRadius: 12,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: completed ? 'rgba(255,255,255,0.2)' : theme.palette.primary.light,
    color: completed ? 'white' : theme.palette.primary.main,
}));

const ShipmentVisualizer = ({ currentStep = 0, shipmentData = {} }) => {
    const steps = [
        {
            icon: <LocationOnIcon />,
            title: 'Origin Address',
            description: shipmentData.origin || 'Waiting for origin address...',
        },
        {
            icon: <LocationOnIcon />,
            title: 'Destination Address',
            description: shipmentData.destination || 'Waiting for destination...',
        },
        {
            icon: <InventoryIcon />,
            title: 'Package Details',
            description: shipmentData.package ? `${shipmentData.package.weight}lbs, ${shipmentData.package.dimensions}` : 'Waiting for package details...',
        },
        {
            icon: <EventIcon />,
            title: 'Schedule Pickup',
            description: shipmentData.pickup || 'Waiting for pickup schedule...',
        },
    ];

    const progress = (currentStep / (steps.length - 1)) * 100;

    return (
        <VisualizerPaper>
            <Box sx={{ mb: 2 }}>
                <Typography variant="h6" gutterBottom>
                    Shipment Progress
                </Typography>
                <LinearProgress
                    variant="determinate"
                    value={progress}
                    sx={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: 'rgba(107, 70, 193, 0.1)',
                        '& .MuiLinearProgress-bar': {
                            background: 'linear-gradient(45deg, #6B46C1, #805AD5)',
                            borderRadius: 4,
                        }
                    }}
                />
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {steps.map((step, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                    >
                        <StepCard completed={index <= currentStep}>
                            <IconWrapper completed={index <= currentStep}>
                                {step.icon}
                            </IconWrapper>
                            <Box>
                                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                    {step.title}
                                </Typography>
                                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                                    {step.description}
                                </Typography>
                            </Box>
                        </StepCard>
                    </motion.div>
                ))}
            </Box>

            {currentStep === steps.length - 1 && (
                <Box sx={{ mt: 'auto', textAlign: 'center' }}>
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                    >
                        <LocalShippingIcon
                            sx={{
                                fontSize: 48,
                                color: 'primary.main',
                                filter: 'drop-shadow(0 4px 12px rgba(107, 70, 193, 0.3))'
                            }}
                        />
                    </motion.div>
                    <Typography variant="h6" sx={{ mt: 2, color: 'primary.main' }}>
                        Ready to Ship!
                    </Typography>
                </Box>
            )}
        </VisualizerPaper>
    );
};

export default ShipmentVisualizer; 