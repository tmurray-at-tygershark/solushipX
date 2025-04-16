import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Box,
    Typography,
    IconButton,
    TextField,
    Paper,
    Avatar
} from '@mui/material';
import { styled } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';

// Styled components
const StyledPaper = styled(Paper)(({ theme }) => ({
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1300,
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(145deg, #f5f7ff 0%, #ffffff 100%)',
    borderRadius: 0,
}));

const MessageInput = styled(TextField)(({ theme }) => ({
    '& .MuiOutlinedInput-root': {
        borderRadius: 30,
        backgroundColor: '#ffffff',
        boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
        '&:hover': {
            boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
        },
    },
}));

const MessageBubble = styled(Box)(({ theme, isUser }) => ({
    maxWidth: '70%',
    padding: theme.spacing(1.5, 2),
    borderRadius: 20,
    marginBottom: theme.spacing(1),
    backgroundColor: isUser ? theme.palette.primary.main : '#f5f7ff',
    color: isUser ? '#fff' : theme.palette.text.primary,
    alignSelf: isUser ? 'flex-end' : 'flex-start',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
}));

const AIExperience = ({ open, onClose, onSend, messages = [] }) => {
    const [message, setMessage] = useState('');
    const messagesEndRef = useRef(null);

    // Initialize shipment data state
    const [shipmentData, setShipmentData] = useState({
        bookingReferenceNumber: `shipment ${Math.floor(Math.random() * 1000)}`,
        bookingReferenceNumberType: "Shipment",
        shipmentBillType: "DefaultLogisticsPlus",
        shipmentDate: new Date().toISOString().split('T')[0],
        pickupWindow: {
            earliest: "09:00",
            latest: "17:00"
        },
        deliveryWindow: {
            earliest: "09:00",
            latest: "17:00"
        },
        fromAddress: {
            company: "",
            street: "",
            street2: "",
            postalCode: "",
            city: "",
            state: "",
            country: "US",
            contactName: "",
            contactPhone: "",
            contactEmail: "",
            specialInstructions: "none"
        },
        toAddress: {
            company: "",
            street: "",
            street2: "",
            postalCode: "",
            city: "",
            state: "",
            country: "US",
            contactName: "",
            contactPhone: "",
            contactEmail: "",
            specialInstructions: "none"
        },
        items: [
            {
                name: "Package",
                weight: 1,
                length: 12,
                width: 12,
                height: 12,
                quantity: 1,
                freightClass: "50",
                value: 0,
                stackable: false
            }
        ]
    });

    // Track conversation state
    const [currentField, setCurrentField] = useState('intro');

    // Auto-scroll to the bottom of messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Handle sending messages
    const handleSend = () => {
        if (message.trim()) {
            // Send message to parent component
            onSend(message);

            // Process the message to update shipment data
            processUserMessage(message);

            // Clear input field
            setMessage('');
        }
    };

    // Process user message to extract and update shipment data
    const processUserMessage = (userMessage) => {
        const msg = userMessage.toLowerCase();

        // Extract information based on current field being collected
        switch (currentField) {
            case 'intro':
                // Move to origin address collection
                setCurrentField('fromCompany');
                break;

            case 'fromCompany':
                setShipmentData(prev => ({
                    ...prev,
                    fromAddress: {
                        ...prev.fromAddress,
                        company: userMessage
                    }
                }));
                setCurrentField('fromStreet');
                break;

            case 'fromStreet':
                setShipmentData(prev => ({
                    ...prev,
                    fromAddress: {
                        ...prev.fromAddress,
                        street: userMessage
                    }
                }));
                setCurrentField('fromCity');
                break;

            case 'fromCity':
                setShipmentData(prev => ({
                    ...prev,
                    fromAddress: {
                        ...prev.fromAddress,
                        city: userMessage
                    }
                }));
                setCurrentField('fromState');
                break;

            case 'fromState':
                setShipmentData(prev => ({
                    ...prev,
                    fromAddress: {
                        ...prev.fromAddress,
                        state: userMessage
                    }
                }));
                setCurrentField('fromPostalCode');
                break;

            case 'fromPostalCode':
                setShipmentData(prev => ({
                    ...prev,
                    fromAddress: {
                        ...prev.fromAddress,
                        postalCode: userMessage
                    }
                }));
                setCurrentField('fromContactName');
                break;

            case 'fromContactName':
                setShipmentData(prev => ({
                    ...prev,
                    fromAddress: {
                        ...prev.fromAddress,
                        contactName: userMessage
                    }
                }));
                setCurrentField('fromContactPhone');
                break;

            case 'fromContactPhone':
                setShipmentData(prev => ({
                    ...prev,
                    fromAddress: {
                        ...prev.fromAddress,
                        contactPhone: userMessage
                    }
                }));
                setCurrentField('fromContactEmail');
                break;

            case 'fromContactEmail':
                setShipmentData(prev => ({
                    ...prev,
                    fromAddress: {
                        ...prev.fromAddress,
                        contactEmail: userMessage
                    }
                }));
                setCurrentField('toCompany');
                break;

            case 'toCompany':
                setShipmentData(prev => ({
                    ...prev,
                    toAddress: {
                        ...prev.toAddress,
                        company: userMessage
                    }
                }));
                setCurrentField('toStreet');
                break;

            case 'toStreet':
                setShipmentData(prev => ({
                    ...prev,
                    toAddress: {
                        ...prev.toAddress,
                        street: userMessage
                    }
                }));
                setCurrentField('toCity');
                break;

            case 'toCity':
                setShipmentData(prev => ({
                    ...prev,
                    toAddress: {
                        ...prev.toAddress,
                        city: userMessage
                    }
                }));
                setCurrentField('toState');
                break;

            case 'toState':
                setShipmentData(prev => ({
                    ...prev,
                    toAddress: {
                        ...prev.toAddress,
                        state: userMessage
                    }
                }));
                setCurrentField('toPostalCode');
                break;

            case 'toPostalCode':
                setShipmentData(prev => ({
                    ...prev,
                    toAddress: {
                        ...prev.toAddress,
                        postalCode: userMessage
                    }
                }));
                setCurrentField('toContactName');
                break;

            case 'toContactName':
                setShipmentData(prev => ({
                    ...prev,
                    toAddress: {
                        ...prev.toAddress,
                        contactName: userMessage
                    }
                }));
                setCurrentField('toContactPhone');
                break;

            case 'toContactPhone':
                setShipmentData(prev => ({
                    ...prev,
                    toAddress: {
                        ...prev.toAddress,
                        contactPhone: userMessage
                    }
                }));
                setCurrentField('toContactEmail');
                break;

            case 'toContactEmail':
                setShipmentData(prev => ({
                    ...prev,
                    toAddress: {
                        ...prev.toAddress,
                        contactEmail: userMessage
                    }
                }));
                setCurrentField('packageWeight');
                break;

            case 'packageWeight':
                // Try to parse a number from the message
                const weight = parseFloat(msg.replace(/[^0-9.]/g, ''));
                if (!isNaN(weight)) {
                    setShipmentData(prev => ({
                        ...prev,
                        items: [
                            {
                                ...prev.items[0],
                                weight: weight
                            }
                        ]
                    }));
                }
                setCurrentField('packageDimensions');
                break;

            case 'packageDimensions':
                // Try to extract dimensions (length x width x height)
                const dimensions = msg.match(/(\d+)[^\d]+(\d+)[^\d]+(\d+)/);
                if (dimensions && dimensions.length >= 4) {
                    setShipmentData(prev => ({
                        ...prev,
                        items: [
                            {
                                ...prev.items[0],
                                length: parseInt(dimensions[1]),
                                width: parseInt(dimensions[2]),
                                height: parseInt(dimensions[3])
                            }
                        ]
                    }));
                }
                setCurrentField('packageQuantity');
                break;

            case 'packageQuantity':
                // Try to parse a number from the message
                const quantity = parseInt(msg.replace(/[^0-9]/g, ''));
                if (!isNaN(quantity)) {
                    setShipmentData(prev => ({
                        ...prev,
                        items: [
                            {
                                ...prev.items[0],
                                quantity: quantity
                            }
                        ]
                    }));
                }
                setCurrentField('packageValue');
                break;

            case 'packageValue':
                // Try to parse a number from the message
                const value = parseFloat(msg.replace(/[^0-9.]/g, ''));
                if (!isNaN(value)) {
                    setShipmentData(prev => ({
                        ...prev,
                        items: [
                            {
                                ...prev.items[0],
                                value: value
                            }
                        ]
                    }));
                }
                setCurrentField('complete');

                // Send final data to the cloud function or store for later use
                console.log('Shipment data collected:', shipmentData);

                // You can send the shipment data to a function to process it
                // processShipmentData(shipmentData);
                break;

            case 'complete':
                // Conversation is complete, data is collected
                break;

            default:
                // Start at the beginning if state is unknown
                setCurrentField('intro');
        }
    };

    // Get the next prompt based on the current state
    const getNextPrompt = () => {
        switch (currentField) {
            case 'intro':
                return "Hi! I'm your shipping assistant. I'll help you set up a shipment. Let's start - what are you shipping today?";
            case 'fromCompany':
                return "Great! Let's gather the shipping details. What's the name of the company or person sending the package?";
            case 'fromStreet':
                return "What's the street address for pickup?";
            case 'fromCity':
                return "What city is this address in?";
            case 'fromState':
                return "What state or province?";
            case 'fromPostalCode':
                return "What's the postal code?";
            case 'fromContactName':
                return "Who should we contact at the pickup location?";
            case 'fromContactPhone':
                return "What's their phone number?";
            case 'fromContactEmail':
                return "And their email address?";
            case 'toCompany':
                return "Great! Now for the delivery address. What company or person is receiving the package?";
            case 'toStreet':
                return "What's the delivery street address?";
            case 'toCity':
                return "What city is the delivery address in?";
            case 'toState':
                return "What state or province?";
            case 'toPostalCode':
                return "What's the postal code for delivery?";
            case 'toContactName':
                return "Who should we contact at the delivery location?";
            case 'toContactPhone':
                return "What's their phone number?";
            case 'toContactEmail':
                return "And their email address?";
            case 'packageWeight':
                return "Now let's get the package details. How much does your package weigh in pounds?";
            case 'packageDimensions':
                return "What are the dimensions of your package in inches? (length x width x height)";
            case 'packageQuantity':
                return "How many packages are you shipping?";
            case 'packageValue':
                return "What's the value of your shipment? (in dollars)";
            case 'complete':
                return `Thank you! I have all the information I need. Here's a summary of your shipment:\n\nFrom: ${shipmentData.fromAddress.company}, ${shipmentData.fromAddress.city}, ${shipmentData.fromAddress.state}\nTo: ${shipmentData.toAddress.company}, ${shipmentData.toAddress.city}, ${shipmentData.toAddress.state}\nPackage: ${shipmentData.items[0].weight} lbs, ${shipmentData.items[0].length}x${shipmentData.items[0].width}x${shipmentData.items[0].height} inches\n\nIs everything correct?`;
            default:
                return "Let's set up your shipment. What are you shipping today?";
        }
    };

    // Handle key press (Enter to send)
    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <AnimatePresence>
            {open && (
                <StyledPaper
                    component={motion.div}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                >
                    {/* Header */}
                    <Box sx={{
                        p: 2,
                        display: 'flex',
                        alignItems: 'center',
                        borderBottom: '1px solid rgba(0,0,0,0.05)',
                        background: 'white'
                    }}>
                        <Avatar
                            sx={{
                                background: 'linear-gradient(45deg, #6B46C1, #805AD5)',
                                mr: 2
                            }}
                        >
                            <LocalShippingIcon />
                        </Avatar>
                        <Typography variant="h6" sx={{ flexGrow: 1 }}>
                            SolushipX Assistant
                        </Typography>
                        <IconButton onClick={onClose} size="large">
                            <CloseIcon />
                        </IconButton>
                    </Box>

                    {/* Main Content Area */}
                    <Box sx={{
                        flexGrow: 1,
                        p: 3,
                        display: 'flex',
                        flexDirection: 'column',
                        height: 'calc(100vh - 64px)', // Subtract header height
                        overflow: 'hidden' // Prevent double scrollbars
                    }}>
                        {/* Messages Area */}
                        <Box sx={{
                            flexGrow: 1,
                            mb: 2,
                            overflowY: 'auto',
                            px: 2,
                            display: 'flex',
                            flexDirection: 'column',
                            '&::-webkit-scrollbar': {
                                width: '8px',
                            },
                            '&::-webkit-scrollbar-track': {
                                background: '#f1f1f1',
                                borderRadius: '4px',
                            },
                            '&::-webkit-scrollbar-thumb': {
                                background: '#888',
                                borderRadius: '4px',
                                '&:hover': {
                                    background: '#555',
                                },
                            },
                        }}>
                            {messages.length === 0 ? (
                                // Show initial message if no messages yet
                                <MessageBubble
                                    isUser={false}
                                    component={motion.div}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <Typography variant="body1">
                                        {getNextPrompt()}
                                    </Typography>
                                </MessageBubble>
                            ) : (
                                // Show conversation messages
                                messages.map((msg, index) => (
                                    <MessageBubble
                                        key={index}
                                        isUser={msg.sender === 'user'}
                                        component={motion.div}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                    >
                                        <Typography variant="body1">
                                            {msg.text}
                                        </Typography>
                                    </MessageBubble>
                                ))
                            )}
                            <div ref={messagesEndRef} />
                        </Box>

                        {/* Input Area */}
                        <Box sx={{
                            display: 'flex',
                            gap: 1,
                            alignItems: 'center',
                            background: 'white',
                            p: 2,
                            borderTop: '1px solid rgba(0,0,0,0.05)'
                        }}>
                            <MessageInput
                                fullWidth
                                placeholder="Type your response..."
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyPress={handleKeyPress}
                                multiline
                                maxRows={4}
                                variant="outlined"
                                InputProps={{
                                    endAdornment: (
                                        <IconButton
                                            onClick={handleSend}
                                            color="primary"
                                            sx={{
                                                background: message ? 'linear-gradient(45deg, #6B46C1, #805AD5)' : 'transparent',
                                                color: message ? 'white' : 'inherit',
                                                '&:hover': {
                                                    background: message ? 'linear-gradient(45deg, #805AD5, #6B46C1)' : 'rgba(0,0,0,0.04)'
                                                }
                                            }}
                                        >
                                            <SendIcon />
                                        </IconButton>
                                    ),
                                }}
                            />
                        </Box>
                    </Box>
                </StyledPaper>
            )}
        </AnimatePresence>
    );
};

export default AIExperience; 