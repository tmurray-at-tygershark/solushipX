import React, { useState, useEffect, useRef } from 'react';
import { Box, IconButton, Paper, Typography, CircularProgress, Button, Card, CardContent, useTheme, Badge, Tooltip, Fade, Chip, TextField } from '@mui/material';
import { Mic, MicOff, Send, Close, ExpandMore, ExpandLess, AttachFile, Undo, RestartAlt, CheckCircle, AccessTime, LocationOn, LocalShipping, Inventory, Payment, RateReview, TrendingUp, CompareArrows, Fullscreen, FullscreenExit } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useLocation, useNavigate } from 'react-router-dom';
import GeminiAgent from '../../services/GeminiAgent';
import { getFunctions, httpsCallable } from 'firebase/functions';

const STEPS = {
    'shipment-info': {
        number: 1,
        label: 'Shipment Info',
        icon: <LocalShipping />,
        description: 'Basic information about your shipment',
        questions: [
            'What type of shipment are you creating? (e.g., courier, freight, express)',
            'When do you need this shipment to be picked up?',
            'Do you need any special handling for this shipment?'
        ],
        requiredFields: ['shipmentType', 'shipmentDate']
    },
    'ship-from': {
        number: 2,
        label: 'From Address',
        icon: <LocationOn />,
        description: 'Origin address details',
        questions: [
            'What is the company name at the origin? (or "none" if not applicable)',
            'What is the street address you\'re shipping from?',
            'Is there an apartment, suite, or unit number? (or "none" if not applicable)',
            'What is the city you\'re shipping from?',
            'What is the state/province you\'re shipping from?',
            'What is the postal/zip code you\'re shipping from?',
            'What is the country you\'re shipping from?',
            'What is the contact name at the origin?',
            'What is the contact phone number at the origin?',
            'What is the contact email at the origin?',
            'Are there any special instructions for pickup? (or "none" if not applicable)'
        ],
        requiredFields: ['company', 'street', 'city', 'state', 'postalCode', 'country', 'contactName']
    },
    'ship-to': {
        number: 3,
        label: 'To Address',
        icon: <LocationOn />,
        description: 'Destination address details',
        questions: [
            'What is the company name at the destination? (or "none" if not applicable)',
            'What is the street address you\'re shipping to?',
            'Is there an apartment, suite, or unit number? (or "none" if not applicable)',
            'What is the city you\'re shipping to?',
            'What is the state/province you\'re shipping to?',
            'What is the postal/zip code you\'re shipping to?',
            'What is the country you\'re shipping to?',
            'What is the contact name at the destination?',
            'What is the contact phone number at the destination?',
            'What is the contact email at the destination?',
            'Are there any special instructions for delivery? (or "none" if not applicable)'
        ],
        requiredFields: ['company', 'street', 'city', 'state', 'postalCode', 'country', 'contactName']
    },
    'packages': {
        number: 4,
        label: 'Packages',
        icon: <Inventory />,
        description: 'Package details and dimensions',
        questions: [
            'How many packages are you shipping?',
            'What is the weight of your package(s) in pounds?',
            'What is the length of your package(s) in inches?',
            'What is the width of your package(s) in inches?',
            'What is the height of your package(s) in inches?',
            'What is the declared value of your package(s) in USD?',
            'What is the freight class for your shipment? (or "50" if unsure)',
            'Is your package stackable? (yes/no)',
            'Do you have a description for your package(s)? (or "Package" if not applicable)'
        ],
        requiredFields: ['weight', 'length', 'width', 'height', 'quantity']
    },
    'rates': {
        number: 5,
        label: 'Rates',
        icon: <Payment />,
        description: 'Select shipping rate and service',
        questions: [
            'Would you like to see available shipping rates now?',
            'Which rate would you like to select? (Enter the number)',
            'Would you like me to analyze the rates for you?'
        ],
        actions: ['fetchRates', 'analyzeRates', 'selectRate']
    },
    'review': {
        number: 6,
        label: 'Review',
        icon: <RateReview />,
        description: 'Review and confirm shipment details',
        questions: [
            'Would you like to review all the shipment details?',
            'Is all the information correct?',
            'Would you like to make any changes?'
        ]
    }
};

const guidedQuestions = {
    shipment_info: [
        {
            question: "What type of shipment are you creating? (e.g., courier, freight, express)",
            field: "shipmentType",
            validate: (value) => {
                const validTypes = ['courier', 'freight', 'express'];
                if (!validTypes.includes(value.toLowerCase())) {
                    return "Please specify a valid shipment type: courier, freight, or express";
                }
                return null;
            }
        }
    ],
    ship_from: [
        {
            question: "What is the company name at the origin?",
            field: "fromCompanyName",
            validate: (value) => value.trim() ? null : "Company name is required"
        },
        {
            question: "What is the street address for pickup?",
            field: "fromStreet",
            validate: (value) => value.trim() ? null : "Street address is required"
        },
        {
            question: "What is the city for pickup?",
            field: "fromCity",
            validate: (value) => value.trim() ? null : "City is required"
        },
        {
            question: "What is the state/province for pickup?",
            field: "fromState",
            validate: (value) => value.trim() ? null : "State/province is required"
        },
        {
            question: "What is the postal code for pickup?",
            field: "fromPostalCode",
            validate: (value) => {
                if (!value.trim()) return "Postal code is required";
                if (!/^\d{5}(-\d{4})?$/.test(value)) {
                    return "Please enter a valid postal code (e.g., 12345 or 12345-6789)";
                }
                return null;
            }
        },
        {
            question: "What is the contact name for pickup?",
            field: "fromContactName",
            validate: (value) => value.trim() ? null : "Contact name is required"
        },
        {
            question: "What is the contact phone for pickup?",
            field: "fromContactPhone",
            validate: (value) => {
                if (!value.trim()) return "Contact phone is required";
                if (!/^\+?[\d\s-()]{10,}$/.test(value)) {
                    return "Please enter a valid phone number";
                }
                return null;
            }
        },
        {
            question: "Are there any special instructions for pickup? (e.g., loading dock, appointment required)",
            field: "fromSpecialInstructions",
            validate: () => null // Optional field
        }
    ],
    ship_to: [
        {
            question: "What is the company name at the destination?",
            field: "toCompanyName",
            validate: (value) => value.trim() ? null : "Company name is required"
        },
        {
            question: "What is the street address for delivery?",
            field: "toStreet",
            validate: (value) => value.trim() ? null : "Street address is required"
        },
        {
            question: "What is the city for delivery?",
            field: "toCity",
            validate: (value) => value.trim() ? null : "City is required"
        },
        {
            question: "What is the state/province for delivery?",
            field: "toState",
            validate: (value) => value.trim() ? null : "State/province is required"
        },
        {
            question: "What is the postal code for delivery?",
            field: "toPostalCode",
            validate: (value) => {
                if (!value.trim()) return "Postal code is required";
                if (!/^\d{5}(-\d{4})?$/.test(value)) {
                    return "Please enter a valid postal code (e.g., 12345 or 12345-6789)";
                }
                return null;
            }
        },
        {
            question: "What is the contact name for delivery?",
            field: "toContactName",
            validate: (value) => value.trim() ? null : "Contact name is required"
        },
        {
            question: "What is the contact phone for delivery?",
            field: "toContactPhone",
            validate: (value) => {
                if (!value.trim()) return "Contact phone is required";
                if (!/^\+?[\d\s-()]{10,}$/.test(value)) {
                    return "Please enter a valid phone number";
                }
                return null;
            }
        },
        {
            question: "Are there any special instructions for delivery? (e.g., loading dock, appointment required)",
            field: "toSpecialInstructions",
            validate: () => null // Optional field
        }
    ],
    packages: [
        {
            question: "How many packages are you shipping?",
            field: "packageCount",
            validate: (value) => {
                const count = parseInt(value);
                if (isNaN(count) || count < 1) {
                    return "Please enter a valid number of packages (minimum 1)";
                }
                return null;
            }
        },
        {
            question: "What is the weight of the package(s) in pounds?",
            field: "weight",
            validate: (value) => {
                const weight = parseFloat(value);
                if (isNaN(weight) || weight <= 0) {
                    return "Please enter a valid weight in pounds";
                }
                return null;
            }
        },
        {
            question: "What are the dimensions of the package(s)? (Format: LxWxH in inches)",
            field: "dimensions",
            validate: (value) => {
                const dimensions = value.split('x').map(d => parseFloat(d.trim()));
                if (dimensions.length !== 3 || dimensions.some(d => isNaN(d) || d <= 0)) {
                    return "Please enter valid dimensions in the format: Length x Width x Height (in inches)";
                }
                return null;
            }
        },
        {
            question: "What type of package is it? (e.g., pallet, box, crate)",
            field: "packageType",
            validate: (value) => value.trim() ? null : "Package type is required"
        },
        {
            question: "Are there any special handling requirements? (e.g., fragile, temperature controlled)",
            field: "specialHandling",
            validate: () => null // Optional field
        }
    ]
};

const ChatBot = ({ onShipmentComplete, formData }) => {
    const theme = useTheme();
    const location = useLocation();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [conversationContext, setConversationContext] = useState({
        fromAddress: {},
        toAddress: {},
        items: [{}],
        rates: [],
        selectedRate: null,
        currentStep: 'initial'
    });
    const [apiKeyError, setApiKeyError] = useState(null);
    const [unreadCount, setUnreadCount] = useState(0);
    const [isMinimized, setIsMinimized] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [isLoadingRates, setIsLoadingRates] = useState(false);
    const [rateError, setRateError] = useState(null);
    const messagesEndRef = useRef(null);
    const recognition = useRef(null);
    const chatContainerRef = useRef(null);
    const [streamingMessage, setStreamingMessage] = useState('');
    const functions = getFunctions();
    const chatWithGemini = httpsCallable(functions, 'chatWithGemini');

    // Initialize chat with welcome message
    useEffect(() => {
        if (messages.length === 0) {
            const welcomeMessage = {
                role: 'assistant',
                content: `Hi! I'm your SolushipX AI assistant. I'll help you create a shipment step by step. What would you like to ship today?`,
                timestamp: new Date().toISOString()
            };
            setMessages([welcomeMessage]);

            // Set initial suggestions based on the first step
            setSuggestions([
                "I need to ship a package",
                "I have a freight shipment",
                "What information do you need?"
            ]);
        }
    }, []);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, streamingMessage]);

    // Update unread count when new messages arrive and chat is closed
    useEffect(() => {
        if (!isOpen && messages.length > 0) {
            setUnreadCount(prev => prev + 1);
        }
    }, [messages, isOpen]);

    // Update chat interface based on current step
    useEffect(() => {
        updateSuggestionsForStep(conversationContext.currentStep);
    }, [conversationContext.currentStep]);

    const handleClose = () => {
        setIsOpen(false);
    };

    const handleOpen = () => {
        setIsOpen(true);
        setUnreadCount(0);
    };

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = {
            role: 'user',
            content: input.trim(),
            timestamp: new Date().toISOString()
        };

        // Add message to UI immediately
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsProcessing(true);
        setStreamingMessage('');

        try {
            // Call the chatWithGemini function
            const response = await chatWithGemini({
                message: userMessage,
                userContext: {},
                previousMessages: messages.slice(-5)
            });

            // Add the bot's response to the messages
            const botResponse = {
                role: 'assistant',
                content: response.data.message.content,
                timestamp: new Date().toISOString()
            };

            setMessages(prev => [...prev, botResponse]);
        } catch (error) {
            console.error('Error in chat:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'I apologize, but I encountered an error. Please try again or contact support if the issue persists.',
                timestamp: new Date().toISOString()
            }]);
        } finally {
            setIsProcessing(false);
        }
    };

    // Update suggestions based on current step
    const updateSuggestionsForStep = (step) => {
        const stepSuggestions = {
            'initial': [
                "I need to ship a package",
                "I have a freight shipment",
                "What information do you need?"
            ],
            'ship-from': [
                "My pickup address is...",
                "I'm shipping from...",
                "The origin address is..."
            ],
            'ship-to': [
                "The delivery address is...",
                "I'm shipping to...",
                "The destination is..."
            ],
            'packages': [
                "The package weighs...",
                "The dimensions are...",
                "It's a pallet of..."
            ],
            'rates': [
                "Show me available rates",
                "What's the cheapest option?",
                "What's the fastest option?"
            ],
            'rate-selection': [
                "I'll go with the cheapest",
                "I need the fastest option",
                "Tell me more about option 1"
            ],
            'review': [
                "Everything looks good",
                "I need to change something",
                "Complete my shipment"
            ]
        };

        setSuggestions(stepSuggestions[step] || [
            "What's next?",
            "Help me finish my shipment",
            "What information is missing?"
        ]);
    };

    const handleSuggestionClick = (suggestion) => {
        setInput(suggestion);
    };

    const formatTimestamp = (timestamp) => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    // Render rate message differently
    const renderMessage = (message, index) => {
        if (message.type === 'rate') {
            return (
                <Box
                    key={index}
                    sx={{
                        display: 'flex',
                        justifyContent: 'flex-start',
                        gap: 1,
                        mb: 2
                    }}
                >
                    <Card
                        sx={{
                            maxWidth: '80%',
                            cursor: 'pointer',
                            '&:hover': {
                                boxShadow: 3,
                                border: '1px solid',
                                borderColor: 'primary.main'
                            }
                        }}
                        onClick={() => {
                            if (message.rateData) {
                                setConversationContext(prev => ({
                                    ...prev,
                                    selectedRate: message.rateData,
                                    currentStep: 'review'
                                }));

                                // Add selection message
                                setMessages(prev => [...prev, {
                                    role: 'user',
                                    content: `I'll select this option: ${message.rateData.carrierName} - ${message.rateData.serviceMode}`,
                                    timestamp: new Date().toISOString()
                                }]);
                            }
                        }}
                    >
                        <CardContent>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                                {message.content.split('\n')[0]}
                            </Typography>
                            {message.content.split('\n').slice(1).map((line, i) => (
                                <Typography key={i} variant="body2">{line}</Typography>
                            ))}
                            <Typography
                                variant="caption"
                                sx={{
                                    display: 'block',
                                    mt: 1,
                                    color: 'text.secondary'
                                }}
                            >
                                {formatTimestamp(message.timestamp)}
                            </Typography>
                        </CardContent>
                    </Card>
                </Box>
            );
        }

        return (
            <Box
                key={index}
                sx={{
                    display: 'flex',
                    justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                    gap: 1,
                    mb: 2
                }}
            >
                <Paper
                    sx={{
                        p: 2,
                        maxWidth: '70%',
                        bgcolor: message.role === 'user' ? 'primary.main' : 'background.paper',
                        color: message.role === 'user' ? 'white' : 'text.primary',
                        borderRadius: 2,
                        boxShadow: 1
                    }}
                >
                    <Typography
                        sx={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word'
                        }}
                    >
                        {message.content}
                    </Typography>
                    <Typography
                        variant="caption"
                        sx={{
                            display: 'block',
                            mt: 1,
                            color: message.role === 'user' ? 'rgba(255,255,255,0.7)' : 'text.secondary'
                        }}
                    >
                        {formatTimestamp(message.timestamp)}
                    </Typography>
                </Paper>
            </Box>
        );
    };

    // Render progress indicator for current step
    const renderStepIndicator = () => {
        const steps = [
            { id: 'initial', label: 'Start', icon: <CompareArrows /> },
            { id: 'ship-from', label: 'From', icon: <LocationOn /> },
            { id: 'ship-to', label: 'To', icon: <LocationOn /> },
            { id: 'packages', label: 'Package', icon: <Inventory /> },
            { id: 'rates', label: 'Rates', icon: <Payment /> },
            { id: 'rate-selection', label: 'Select', icon: <CheckCircle /> },
            { id: 'review', label: 'Review', icon: <RateReview /> }
        ];

        const currentIndex = steps.findIndex(step => step.id === conversationContext.currentStep);

        return (
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    p: 1,
                    bgcolor: 'background.default',
                    borderTop: '1px solid',
                    borderColor: 'divider'
                }}
            >
                {steps.map((step, index) => (
                    <Tooltip key={step.id} title={step.label} arrow>
                        <Box
                            sx={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                opacity: index <= currentIndex ? 1 : 0.5
                            }}
                        >
                            <Chip
                                icon={step.icon}
                                label={step.label}
                                size="small"
                                color={index === currentIndex ? 'primary' : 'default'}
                                variant={index <= currentIndex ? 'filled' : 'outlined'}
                            />
                        </Box>
                    </Tooltip>
                ))}
            </Box>
        );
    };

    // Main return statement with updated components
    return (
        <AnimatePresence>
            {!isOpen ? (
                <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    style={{
                        position: 'fixed',
                        bottom: '16px',
                        right: '16px',
                        zIndex: 1000
                    }}
                >
                    <Badge badgeContent={unreadCount} color="error">
                        <IconButton
                            onClick={handleOpen}
                            sx={{
                                bgcolor: 'primary.main',
                                color: 'white',
                                width: '56px',
                                height: '56px',
                                '&:hover': {
                                    bgcolor: 'primary.dark'
                                }
                            }}
                        >
                            <Send />
                        </IconButton>
                    </Badge>
                </motion.div>
            ) : (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    style={{
                        position: 'fixed',
                        bottom: isFullscreen ? '0' : '16px',
                        right: isFullscreen ? '0' : '16px',
                        width: isFullscreen ? '100%' : '400px',
                        height: isFullscreen ? '100%' : '600px',
                        zIndex: 1000
                    }}
                >
                    <Paper
                        sx={{
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'column',
                            bgcolor: 'background.paper',
                            borderRadius: isFullscreen ? 0 : 2,
                            overflow: 'hidden',
                            boxShadow: theme.shadows[10]
                        }}
                    >
                        {/* Header */}
                        <Box
                            sx={{
                                p: 2,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                borderBottom: '1px solid',
                                borderColor: 'divider',
                                bgcolor: 'primary.main',
                                color: 'white'
                            }}
                        >
                            <Box>
                                <Typography variant="h6">
                                    SolushipX AI Assistant
                                </Typography>
                                <Typography variant="body2" sx={{ opacity: 0.8 }}>
                                    Let's create your shipment together
                                </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <IconButton onClick={toggleFullscreen} sx={{ color: 'white' }}>
                                    {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
                                </IconButton>
                                <IconButton onClick={handleClose} sx={{ color: 'white' }}>
                                    <Close />
                                </IconButton>
                            </Box>
                        </Box>

                        {/* Step Indicator */}
                        {renderStepIndicator()}

                        {/* Messages Area */}
                        <Box
                            ref={chatContainerRef}
                            sx={{
                                flex: 1,
                                overflowY: 'auto',
                                p: 2,
                                display: 'flex',
                                flexDirection: 'column'
                            }}
                        >
                            {messages.map((message, index) => renderMessage(message, index))}

                            {/* Streaming message */}
                            {streamingMessage && (
                                <Box sx={{ display: 'flex', justifyContent: 'flex-start', gap: 1 }}>
                                    <Paper
                                        sx={{
                                            p: 2,
                                            maxWidth: '70%',
                                            bgcolor: 'background.paper',
                                            borderRadius: 2
                                        }}
                                    >
                                        <Typography
                                            sx={{
                                                whiteSpace: 'pre-wrap',
                                                wordBreak: 'break-word'
                                            }}
                                        >
                                            {streamingMessage}
                                        </Typography>
                                    </Paper>
                                </Box>
                            )}

                            {/* Processing indicator */}
                            {isProcessing && !streamingMessage && (
                                <Box sx={{ display: 'flex', justifyContent: 'flex-start', gap: 1 }}>
                                    <Paper
                                        sx={{
                                            p: 2,
                                            bgcolor: 'background.paper',
                                            borderRadius: 2,
                                            maxWidth: '70%'
                                        }}
                                    >
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <CircularProgress size={16} />
                                            <Typography>Thinking...</Typography>
                                        </Box>
                                    </Paper>
                                </Box>
                            )}

                            <div ref={messagesEndRef} />
                        </Box>

                        {/* Input Area */}
                        <Box sx={{ p: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                            {/* Suggestions */}
                            {suggestions.length > 0 && (
                                <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                    {suggestions.map((suggestion, index) => (
                                        <Button
                                            key={index}
                                            variant="outlined"
                                            size="small"
                                            onClick={() => handleSuggestionClick(suggestion)}
                                            sx={{
                                                borderRadius: 2,
                                                textTransform: 'none',
                                                bgcolor: 'background.paper'
                                            }}
                                        >
                                            {suggestion}
                                        </Button>
                                    ))}
                                </Box>
                            )}

                            {/* Input Field */}
                            <Box
                                sx={{
                                    display: 'flex',
                                    gap: 2,
                                    alignItems: 'center'
                                }}
                            >
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                    style={{
                                        flex: 1,
                                        padding: '12px',
                                        border: '1px solid',
                                        borderColor: theme.palette.divider,
                                        borderRadius: '8px',
                                        outline: 'none',
                                        fontSize: '16px',
                                        backgroundColor: theme.palette.background.paper
                                    }}
                                    placeholder="Type your message here..."
                                />
                                <IconButton
                                    onClick={handleSend}
                                    disabled={!input.trim() || isProcessing}
                                    sx={{
                                        bgcolor: 'primary.main',
                                        color: 'white',
                                        '&:hover': {
                                            bgcolor: 'primary.dark'
                                        },
                                        '&.Mui-disabled': {
                                            bgcolor: 'action.disabledBackground',
                                            color: 'action.disabled'
                                        }
                                    }}
                                >
                                    <Send />
                                </IconButton>
                            </Box>
                        </Box>
                    </Paper>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default ChatBot; 