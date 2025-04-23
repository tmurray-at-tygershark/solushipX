import React, { useState } from 'react';
import { Box, Container, Accordion, AccordionSummary, AccordionDetails, Typography, Button } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useShipmentForm } from '../../contexts/ShipmentFormContext';
import ShipFrom from './ShipFrom';
import ShipTo from './ShipTo';
import Packages from './Packages'; // Import the Packages component
import ShipmentInfo from './ShipmentInfo'; // Import the ShipmentInfo component
import Rates from './Rates'; // Import the Rates component
// Import other form sections here later (ShipTo, Packages, etc.)

const CreateShipmentPage = ({ apiKey }) => {
    const { shipmentData, updateShipmentData, validateSection, clearErrorState } = useShipmentForm();
    const [expanded, setExpanded] = useState('panel1'); // Start with the first panel open

    const handleChange = (panel) => (event, isExpanded) => {
        setExpanded(isExpanded ? panel : false);
    };

    // TODO: Implement overall submission logic
    const handleCreateShipment = () => {
        console.log("Creating shipment with data:", shipmentData);
        // Perform final validation across all sections
        // Call API to create shipment
    };

    return (
        <Container maxWidth="md" sx={{ py: 4 }}>
            <Typography variant="h4" gutterBottom align="center" sx={{ mb: 4 }}>
                Create New Shipment
            </Typography>

            <Box sx={{ mb: 4 }}>
                {/* Ship From Section */}
                <Accordion expanded={expanded === 'panel1'} onChange={handleChange('panel1')}>
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        aria-controls="panel1bh-content"
                        id="panel1bh-header"
                    >
                        <Typography sx={{ width: '33%', flexShrink: 0 }}>
                            1. Ship From
                        </Typography>
                        <Typography sx={{ color: 'text.secondary' }}>Origin Address</Typography>
                        {/* TODO: Add summary details when collapsed */}
                    </AccordionSummary>
                    <AccordionDetails>
                        {/* Pass apiKey if ShipFrom needs it directly */}
                        <ShipFrom apiKey={apiKey} />
                    </AccordionDetails>
                </Accordion>

                {/* Ship To Section - Updated to use the ShipTo component */}
                <Accordion expanded={expanded === 'panel2'} onChange={handleChange('panel2')}>
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        aria-controls="panel2bh-content"
                        id="panel2bh-header"
                    >
                        <Typography sx={{ width: '33%', flexShrink: 0 }}>
                            2. Ship To
                        </Typography>
                        <Typography sx={{ color: 'text.secondary' }}>Destination Address</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <ShipTo />
                    </AccordionDetails>
                </Accordion>

                {/* Packages Section - Updated to use the Packages component */}
                <Accordion expanded={expanded === 'panel3'} onChange={handleChange('panel3')}>
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        aria-controls="panel3bh-content"
                        id="panel3bh-header"
                    >
                        <Typography sx={{ width: '33%', flexShrink: 0 }}>
                            3. Packages
                        </Typography>
                        <Typography sx={{ color: 'text.secondary' }}>Items & Dimensions</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Packages />
                    </AccordionDetails>
                </Accordion>

                {/* Shipment Info Section - Updated to use the ShipmentInfo component */}
                <Accordion expanded={expanded === 'panel4'} onChange={handleChange('panel4')}>
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        aria-controls="panel4bh-content"
                        id="panel4bh-header"
                    >
                        <Typography sx={{ width: '33%', flexShrink: 0 }}>
                            4. Details
                        </Typography>
                        <Typography sx={{ color: 'text.secondary' }}>Service & Options</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <ShipmentInfo />
                    </AccordionDetails>
                </Accordion>

                {/* Rates Section - Updated to use the Rates component */}
                <Accordion expanded={expanded === 'panel5'} onChange={handleChange('panel5')}>
                    <AccordionSummary
                        expandIcon={<ExpandMoreIcon />}
                        aria-controls="panel5bh-content"
                        id="panel5bh-header"
                    >
                        <Typography sx={{ width: '33%', flexShrink: 0 }}>
                            5. Rates
                        </Typography>
                        <Typography sx={{ color: 'text.secondary' }}>Select Shipping Service</Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                        <Rates apiKey={apiKey} />
                    </AccordionDetails>
                </Accordion>
            </Box>

            {/* Final Action Button */}
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    onClick={handleCreateShipment}
                    disabled={!shipmentData.rates?.selectedRate} // Disable if no rate is selected
                >
                    Create Shipment
                </Button>
            </Box>
        </Container>
    );
};

export default CreateShipmentPage; 