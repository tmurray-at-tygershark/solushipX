import React, { useState, useEffect, useRef } from 'react';
import { Box, IconButton, Paper, Typography, CircularProgress, Button, Card, CardContent, useTheme, Badge, Tooltip, Fade, Chip, TextField, Autocomplete } from '@mui/material';
import { Mic, MicOff, Send, Close, ExpandMore, ExpandLess, AttachFile, Undo, RestartAlt, CheckCircle, AccessTime, LocationOn, LocalShipping, Inventory, Payment, RateReview, TrendingUp, CompareArrows, Fullscreen, FullscreenExit } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useLocation, useNavigate } from 'react-router-dom';
import GeminiAgent from '../../services/GeminiAgent';
import { getFunctions, httpsCallable } from 'firebase/functions';
import GooglePlacesService from '../../services/GooglePlacesService';
import SimpleMap from '../../components/SimpleMap';

const STEPS = {
    'initial': {
        number: 1,
        label: 'Initial Questions',
        icon: <LocalShipping />,
        description: 'Basic information about your shipment',
        questions: [
            'Are you looking to ship large freight or courier package?',
            'Do you have a reference number you would like to use for this shipment?',
            'When would you like to schedule this shipment? (immediately, or on a specific date)',
            'Can we come pick it up during normal business hours? (9am-5pm)',
            'Can we deliver it during normal business hours?',
            'Do you require a signature upon delivery of this shipment?'
        ],
        requiredFields: ['shipmentType', 'referenceNumber', 'shipmentDate', 'pickupWindow', 'deliveryWindow', 'signatureRequired']
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

const stepSuggestions = {
    'initial': [
        "Courier Package",
        "Large Freight",
        "I need help deciding"
    ],
    'reference': [
        "Yes, I have a reference number",
        "No reference number needed",
        "Skip this step"
    ],
    'schedule': [
        "Schedule immediately",
        "Schedule for a specific date",
        "I need help deciding"
    ],
    'pickup': [
        "Yes, during business hours",
        "No, need different hours",
        "I need help deciding"
    ],
    'delivery': [
        "Yes, during business hours",
        "No, need different hours",
        "I need help deciding"
    ],
    'signature': [
        "Yes, signature required",
        "No signature needed",
        "I need help deciding"
    ],
    'ship-from': [
        "Enter my pickup address",
        "I need help with the address",
        "Skip this step for now"
    ],
    'ship-to': [
        "Enter my delivery address",
        "I need help with the address",
        "Skip this step for now"
    ],
    'packages': [
        "Add package details",
        "I have multiple packages",
        "Need help with dimensions",
        "Skip this step for now"
    ],
    'rates': [
        "Show me available rates",
        "What's the cheapest option?",
        "What's the fastest option?",
        "Compare rates for me"
    ],
    'rate-selection': [
        "Select this rate",
        "Show me more options",
        "What's the delivery time?",
        "Need more information"
    ],
    'review': [
        "Everything looks good",
        "I need to make changes",
        "Complete my shipment",
        "Save as draft"
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
        currentStep: 'initial',
        shipmentType: null,
        referenceNumber: null,
        shipmentDate: null,
        pickupWindow: null,
        deliveryWindow: null,
        signatureRequired: null,
        currentQuestionIndex: 0
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
    const [addressPredictions, setAddressPredictions] = useState([]);
    const [isAddressInput, setIsAddressInput] = useState(false);
    const [currentAddressType, setCurrentAddressType] = useState(null);
    const [selectedPlace, setSelectedPlace] = useState(null);
    const [addressError, setAddressError] = useState(null);
    const [isValidatingAddress, setIsValidatingAddress] = useState(false);
    const [showAddressConfirm, setShowAddressConfirm] = useState(false);
    const [confirmAddress, setConfirmAddress] = useState(null);
    const [isEditingAddress, setIsEditingAddress] = useState(false);
    const [editingAddress, setEditingAddress] = useState(null);
    const [isVerifyingAddress, setIsVerifyingAddress] = useState(false);
    const [verificationIssues, setVerificationIssues] = useState([]);
    const inputRef = useRef(null);

    const formatAddressMessage = (placeDetails, type) => {
        if (!placeDetails || !placeDetails.address_components) {
            return `${type} address is incomplete. Please provide all required information.`;
        }

        const getComponent = (type) => {
            const component = placeDetails.address_components.find(c => c.types.includes(type));
            return component ? component.long_name : '';
        };

        const streetNumber = getComponent('street_number');
        const route = getComponent('route');
        const city = getComponent('locality') || getComponent('sublocality') || getComponent('administrative_area_level_2');
        const state = getComponent('administrative_area_level_1');
        const postalCode = getComponent('postal_code');
        const country = getComponent('country');

        // Check if country is supported
        if (country && !['United States', 'Canada', 'US', 'CA'].includes(country)) {
            return `Sorry, we currently only support shipping within the United States and Canada. Please provide an address from these countries.`;
        }

        // Check if we have all required components
        if (!streetNumber || !route || !city || !state || !postalCode || !country) {
            const missing = [];
            if (!streetNumber || !route) missing.push('street address');
            if (!city) missing.push('city');
            if (!state) missing.push(country === 'Canada' ? 'province' : 'state');
            if (!postalCode) missing.push(country === 'Canada' ? 'postal code' : 'ZIP code');
            if (!country) missing.push('country');

            const missingStr = missing.join(', ');
            return `The ${type} address needs more information. Please provide the ${missingStr}. For ${country === 'Canada' ? 'Canadian' : 'US'} addresses, all these details are required.`;
        }

        // Format the address based on the country
        const formattedAddress = country === 'Canada'
            ? `The ${type} address is: ${streetNumber} ${route}, ${city}, ${state} ${postalCode}, ${country}`
            : `The ${type} address is: ${streetNumber} ${route}, ${city}, ${state} ${postalCode}, ${country}`;

        return formattedAddress.replace(/\s+/g, ' ').trim();
    };

    // Initialize chat with welcome message
    useEffect(() => {
        if (messages.length === 0) {
            const welcomeMessage = {
                role: 'assistant',
                content: `Hello! I'll help you create a shipment. First, let me ask you a few questions about your shipment. Are you looking to ship large freight or courier package?`,
                timestamp: new Date().toISOString()
            };
            setMessages([welcomeMessage]);

            // Set initial suggestions based on the first question
            setSuggestions([
                "Courier Package",
                "Large Freight",
                "I need help deciding"
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

    const handleInitialQuestionResponse = async (response) => {
        const currentQuestion = STEPS.initial.questions[conversationContext.currentQuestionIndex];
        let updatedContext = { ...conversationContext };
        let nextQuestion = null;
        let nextSuggestions = [];

        switch (conversationContext.currentQuestionIndex) {
            case 0: // Shipment type question
                if (response.toLowerCase().includes('courier')) {
                    updatedContext.shipmentType = 'courier';
                } else if (response.toLowerCase().includes('freight')) {
                    updatedContext.shipmentType = 'freight';
                }
                nextQuestion = STEPS.initial.questions[1];
                nextSuggestions = stepSuggestions.reference;
                break;

            case 1: // Reference number question
                if (response.toLowerCase().includes('yes') || response.toLowerCase().includes('have')) {
                    updatedContext.referenceNumber = 'pending';
                    // Add a follow-up message asking for the reference number
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: 'Please enter your reference number:',
                        timestamp: new Date().toISOString()
                    }]);
                    return;
                }
                nextQuestion = STEPS.initial.questions[2];
                nextSuggestions = stepSuggestions.schedule;
                break;

            case 2: // Scheduling question
                if (response.toLowerCase().includes('immediately')) {
                    updatedContext.shipmentDate = new Date().toISOString();
                } else if (response.toLowerCase().includes('specific')) {
                    // Add a follow-up message asking for the specific date
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: 'Please enter your preferred shipment date (YYYY-MM-DD):',
                        timestamp: new Date().toISOString()
                    }]);
                    return;
                }
                nextQuestion = STEPS.initial.questions[3];
                nextSuggestions = stepSuggestions.pickup;
                break;

            case 3: // Pickup window question
                if (response.toLowerCase().includes('yes')) {
                    updatedContext.pickupWindow = {
                        earliest: '09:00',
                        latest: '17:00'
                    };
                } else if (response.toLowerCase().includes('no')) {
                    // Add a follow-up message asking for preferred pickup hours
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: 'Please enter your preferred pickup hours (HH:MM-HH:MM):',
                        timestamp: new Date().toISOString()
                    }]);
                    return;
                }
                nextQuestion = STEPS.initial.questions[4];
                nextSuggestions = stepSuggestions.delivery;
                break;

            case 4: // Delivery window question
                if (response.toLowerCase().includes('yes')) {
                    updatedContext.deliveryWindow = {
                        earliest: '09:00',
                        latest: '17:00'
                    };
                } else if (response.toLowerCase().includes('no')) {
                    // Add a follow-up message asking for preferred delivery hours
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: 'Please enter your preferred delivery hours (HH:MM-HH:MM):',
                        timestamp: new Date().toISOString()
                    }]);
                    return;
                }
                nextQuestion = STEPS.initial.questions[5];
                nextSuggestions = stepSuggestions.signature;
                break;

            case 5: // Signature requirement question
                if (response.toLowerCase().includes('yes')) {
                    updatedContext.signatureRequired = true;
                    // Add a follow-up message asking about adult signature
                    setMessages(prev => [...prev, {
                        role: 'assistant',
                        content: 'Does it need to be an adult signature?',
                        timestamp: new Date().toISOString()
                    }]);
                    setSuggestions(['Yes, adult signature required', 'No, any signature is fine']);
                    return;
                } else {
                    updatedContext.signatureRequired = false;
                }
                // Move to address collection
                updatedContext.currentStep = 'ship-from';
                nextQuestion = STEPS['ship-from'].questions[0];
                nextSuggestions = stepSuggestions['ship-from'];
                break;
        }

        // Update the conversation context
        updatedContext.currentQuestionIndex = conversationContext.currentQuestionIndex + 1;
        setConversationContext(updatedContext);

        // Add the next question to the chat
        if (nextQuestion) {
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: nextQuestion,
                timestamp: new Date().toISOString()
            }]);
            setSuggestions(nextSuggestions);
        }
    };

    const handleSend = async (message = input) => {
        const messageToSend = typeof message === 'string' ? message : input;
        if (!messageToSend?.trim()) return;

        // Add user message to chat
        const userMessage = {
            role: 'user',
            content: messageToSend,
            timestamp: new Date().toISOString()
        };
        setMessages(prev => [...prev, userMessage]);
        setInput('');

        // Handle the message based on current step
        if (conversationContext.currentStep === 'initial') {
            await handleInitialQuestionResponse(messageToSend);
        } else {
            // ... existing message handling code ...
        }
    };

    const handleAddressConfirm = async () => {
        if (!confirmAddress) return;

        try {
            const { placeDetails, type } = confirmAddress;

            // Format the address details for the chat with more structure
            const addressMessage = formatAddressMessage(placeDetails, type);
            setInput(addressMessage);
            setAddressPredictions([]);
            setIsAddressInput(false);

            // Automatically send the message
            await handleSend();
        } catch (error) {
            console.error('Error confirming address:', error);
            setAddressError('Failed to process address. Please try again.');
        } finally {
            setShowAddressConfirm(false);
            setConfirmAddress(null);
        }
    };

    const handleAddressSelect = async (selectedPrediction) => {
        try {
            setIsValidatingAddress(true);
            const placeDetails = await GooglePlacesService.getPlaceDetails(selectedPrediction.place_id);

            // Add debug logging
            console.log('Place Details:', placeDetails);
            console.log('Address Components:', placeDetails.address_components);

            // Get the country first to determine validation rules
            const country = getAddressComponent(placeDetails, 'country');
            const countryCode = getAddressComponent(placeDetails, 'country', 'short_name');
            if (!['US', 'CA'].includes(countryCode)) {
                setAddressError('Sorry, we currently only support shipping within the United States and Canada.');
                return;
            }

            // Format the address components
            const formattedAddress = {
                street: `${getAddressComponent(placeDetails, 'street_number')} ${getAddressComponent(placeDetails, 'route')}`.trim(),
                city: getAddressComponent(placeDetails, 'locality') || getAddressComponent(placeDetails, 'sublocality') || getAddressComponent(placeDetails, 'administrative_area_level_2'),
                state: getAddressComponent(placeDetails, 'administrative_area_level_1'),
                postalCode: getAddressComponent(placeDetails, 'postal_code'),
                country: country
            };

            // Check if postal code is missing
            if (!formattedAddress.postalCode) {
                const addressMessage = `I found the address at ${formattedAddress.street}, ${formattedAddress.city}, ${formattedAddress.state}, ${formattedAddress.country}. What is the postal code for this address?`;
                setMessages(prev => [...prev, {
                    role: 'user',
                    content: addressMessage,
                    timestamp: new Date().toISOString()
                }]);
                setIsAddressInput(false);
                setCurrentAddressType(null);
                setInput('');
                return;
            }

            // Add the formatted address as a user message
            const addressMessage = formatAddressMessage(placeDetails, currentAddressType);
            setMessages(prev => [...prev, {
                role: 'user',
                content: addressMessage,
                timestamp: new Date().toISOString()
            }]);

            // Update the context with the new address
            updateAddressInContext(formattedAddress);

            // Reset address input mode
            setIsAddressInput(false);
            setCurrentAddressType(null);
            setInput('');

            // Call chatWithGemini to continue the conversation
            const response = await chatWithGemini({
                message: {
                    role: 'user',
                    content: addressMessage,
                    timestamp: new Date().toISOString()
                },
                userContext: conversationContext,
                previousMessages: messages.slice(-5)
            });

            // Update the conversation context with the new context from the response
            setConversationContext(response.data.userContext);

            // Add the bot's response to the messages
            const botResponse = {
                role: 'assistant',
                content: response.data.message.content,
                timestamp: new Date().toISOString()
            };

            setMessages(prev => [...prev, botResponse]);

        } catch (error) {
            console.error('Error selecting address:', error);
            setAddressError('Failed to process the selected address. Please try again.');
        } finally {
            setIsValidatingAddress(false);
        }
    };

    const getAddressComponent = (placeDetails, type, nameType = 'long_name') => {
        const component = placeDetails.address_components?.find(c => c.types.includes(type));
        return component ? component[nameType] : '';
    };

    const validateAddress = (address) => {
        const issues = [];
        if (!address.street) issues.push('Street address is missing or invalid');
        if (!address.city) issues.push('City is missing or invalid');
        if (!address.state) issues.push('State/Province is missing or invalid');
        if (!address.country) {
            issues.push('Country is missing or invalid');
        } else if (!['United States', 'Canada'].includes(address.country)) {
            issues.push('Currently, we only support shipping within the United States and Canada');
        }
        if (!address.postalCode) {
            const postalTerm = address.country === 'Canada' ? 'postal code' : 'ZIP code';
            issues.push(`${postalTerm} is missing or invalid`);
        } else {
            const usZipRegex = /^\d{5}(-\d{4})?$/;
            const canadianPostalRegex = /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/;
            const isUS = address.country === 'United States';
            const isCanada = address.country === 'Canada';

            if (isUS && !usZipRegex.test(address.postalCode)) {
                issues.push('Please enter a valid ZIP code (e.g., 12345 or 12345-6789)');
            } else if (isCanada && !canadianPostalRegex.test(address.postalCode)) {
                issues.push('Please enter a valid postal code (e.g., A1A 1A1)');
            }
        }
        return issues;
    };

    const updateAddressInContext = (formattedAddress) => {
        setConversationContext(prev => ({
            ...prev,
            [currentAddressType === 'origin' ? 'fromAddress' : 'toAddress']: {
                ...formattedAddress,
                formatted_address: Object.values(formattedAddress).filter(Boolean).join(', ')
            }
        }));
    };

    // Update suggestions based on current step
    const updateSuggestionsForStep = (step) => {
        setSuggestions(stepSuggestions[step] || [
            "What's next?",
            "I need help",
            "Go back",
            "Start over"
        ]);
    };

    const handleSuggestionClick = async (suggestion) => {
        setInput(suggestion);
        // Automatically send the message
        await handleSend(suggestion);
    };

    const formatTimestamp = (timestamp) => {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
        // This function is no longer needed
        return null;
    };

    // Render the chat interface
    return (
        <Box
            sx={{
                position: 'fixed',
                bottom: 20,
                right: 20,
                zIndex: 1000,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end'
            }}
        >
            {/* Chat button when closed */}
            {!isOpen && (
                <Badge badgeContent={unreadCount} color="error">
                    <IconButton
                        onClick={handleOpen}
                        sx={{
                            bgcolor: 'primary.main',
                            color: 'white',
                            '&:hover': {
                                bgcolor: 'primary.dark'
                            },
                            width: 56,
                            height: 56
                        }}
                    >
                        <LocalShipping />
                    </IconButton>
                </Badge>
            )}

            {/* Chat interface when open */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{ duration: 0.3 }}
                    >
                        <Paper
                            ref={chatContainerRef}
                            sx={{
                                width: isFullscreen ? '100vw' : 400,
                                height: isFullscreen ? '100vh' : 500,
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                position: 'relative',
                                boxShadow: 3
                            }}
                        >
                            {/* Chat header */}
                            <Box
                                sx={{
                                    p: 2,
                                    bgcolor: 'primary.main',
                                    color: 'white',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <Typography variant="h6">SolushipX Assistant</Typography>
                                <Box>
                                    <IconButton
                                        size="small"
                                        onClick={toggleFullscreen}
                                        sx={{ color: 'white' }}
                                    >
                                        {isFullscreen ? <FullscreenExit /> : <Fullscreen />}
                                    </IconButton>
                                    <IconButton
                                        size="small"
                                        onClick={handleClose}
                                        sx={{ color: 'white' }}
                                    >
                                        <Close />
                                    </IconButton>
                                </Box>
                            </Box>

                            {/* Chat messages */}
                            <Box
                                sx={{
                                    flex: 1,
                                    overflowY: 'auto',
                                    p: 2,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 1
                                }}
                            >
                                {messages.map((message, index) => renderMessage(message, index))}
                                {streamingMessage && (
                                    <Box
                                        sx={{
                                            display: 'flex',
                                            justifyContent: 'flex-start',
                                            gap: 1,
                                            mb: 2
                                        }}
                                    >
                                        <Paper
                                            sx={{
                                                p: 2,
                                                maxWidth: '70%',
                                                bgcolor: 'background.paper',
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
                                                {streamingMessage}
                                                <CircularProgress
                                                    size={12}
                                                    sx={{ ml: 1, verticalAlign: 'middle' }}
                                                />
                                            </Typography>
                                        </Paper>
                                    </Box>
                                )}
                                <div ref={messagesEndRef} />
                            </Box>

                            {/* Quick suggestions */}
                            {suggestions.length > 0 && (
                                <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                    {suggestions.map((suggestion, index) => (
                                        <Chip
                                            key={index}
                                            label={suggestion}
                                            onClick={() => handleSuggestionClick(suggestion)}
                                            sx={{
                                                cursor: 'pointer',
                                                '&:hover': {
                                                    bgcolor: 'primary.main',
                                                    color: 'white'
                                                }
                                            }}
                                        />
                                    ))}
                                </Box>
                            )}

                            {/* Input area */}
                            <Box
                                sx={{
                                    p: 2,
                                    borderTop: '1px solid',
                                    borderColor: 'divider',
                                    display: 'flex',
                                    gap: 1
                                }}
                            >
                                {isAddressInput ? (
                                    <Autocomplete
                                        freeSolo
                                        fullWidth
                                        options={addressPredictions}
                                        getOptionLabel={(option) => typeof option === 'string' ? option : option.description}
                                        inputValue={input}
                                        onInputChange={(event, newValue) => {
                                            setInput(newValue);
                                            if (newValue && newValue.length >= 3) {
                                                GooglePlacesService.getPlacePredictions(newValue)
                                                    .then(predictions => setAddressPredictions(predictions))
                                                    .catch(error => {
                                                        console.error('Error fetching predictions:', error);
                                                        setAddressError('Failed to fetch address suggestions. Please try again.');
                                                    });
                                            }
                                        }}
                                        onChange={(event, newValue) => {
                                            if (newValue && typeof newValue !== 'string' && newValue.place_id) {
                                                handleAddressSelect(newValue);
                                            }
                                        }}
                                        renderInput={(params) => (
                                            <TextField
                                                {...params}
                                                fullWidth
                                                placeholder={`Enter address or postal code (US/Canada)`}
                                                error={!!addressError}
                                                helperText={addressError}
                                                InputProps={{
                                                    ...params.InputProps,
                                                    endAdornment: (
                                                        <>
                                                            {isValidatingAddress && (
                                                                <CircularProgress color="inherit" size={20} />
                                                            )}
                                                            {params.InputProps.endAdornment}
                                                        </>
                                                    )
                                                }}
                                            />
                                        )}
                                        renderOption={(props, option) => (
                                            <li {...props}>
                                                <LocationOn sx={{ mr: 1, color: option.types?.includes('postal_code') ? 'success.main' : 'text.secondary' }} />
                                                <Box>
                                                    <Typography variant="body2">{option.description}</Typography>
                                                    {option.types?.includes('postal_code') && (
                                                        <Typography variant="caption" color="success.main">
                                                            Postal Code
                                                        </Typography>
                                                    )}
                                                </Box>
                                            </li>
                                        )}
                                    />
                                ) : (
                                    <TextField
                                        fullWidth
                                        variant="outlined"
                                        placeholder="Type your message..."
                                        value={input}
                                        onChange={(e) => setInput(e.target.value)}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                handleSend();
                                            }
                                        }}
                                        disabled={isProcessing}
                                        size="small"
                                        inputRef={inputRef}
                                    />
                                )}
                                <IconButton
                                    color="primary"
                                    onClick={() => handleSend()}
                                    disabled={isProcessing || !input.trim()}
                                >
                                    {isProcessing ? (
                                        <CircularProgress size={24} />
                                    ) : (
                                        <Send />
                                    )}
                                </IconButton>
                            </Box>
                        </Paper>
                    </motion.div>
                )}
            </AnimatePresence>
        </Box>
    );
};

export default ChatBot; 