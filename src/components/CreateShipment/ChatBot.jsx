import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box, IconButton, Paper, Typography, CircularProgress, Button, Card, CardContent, useTheme, Badge, Tooltip, Fade, Chip, TextField, Autocomplete, Grid } from '@mui/material';
import { Mic, MicOff, Send, Close, ExpandMore, ExpandLess, AttachFile, Undo, RestartAlt, CheckCircle, AccessTime, LocationOn, LocalShipping, Inventory, Payment, RateReview, TrendingUp, CompareArrows, Fullscreen, FullscreenExit } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { useLocation, useNavigate } from 'react-router-dom';
import GeminiAgent from '../../services/GeminiAgent';
import { getFunctions, httpsCallable } from 'firebase/functions';
import GooglePlacesService from '../../services/GooglePlacesService';
import { GoogleMap, LoadScript, Marker } from '@react-google-maps/api';
import AIExperience from '../AI/AIExperience';
import styled from 'styled-components';
import AddressInputWidget from './AddressInputWidget';
import MapWidget from './MapWidget';

const STEPS = {
    INIT: { number: 1, label: 'Start' },
    ORIGIN: { number: 2, label: 'Origin' },
    DESTINATION: { number: 3, label: 'Destination' },
    PACKAGE: { number: 4, label: 'Package' },
    RATES: { number: 5, label: 'Rates' },
    REVIEW: { number: 6, label: 'Review' }
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

const ProgressBar = styled.div`
  width: 100%;
  height: 4px;
  background: #E5E7EB;
  border-radius: 2px;
  margin: 16px 0;
  overflow: hidden;
`;

const Progress = styled.div`
  height: 100%;
  background: #3B82F6;
  border-radius: 2px;
  transition: width 0.3s ease;
  width: ${props => props.progress}%;
`;

const GOOGLE_MAPS_LIBRARIES = ["places", "geometry"];

const SimpleMap = React.memo(({ address, title }) => {
    const [position, setPosition] = useState(null);
    const [error, setError] = useState(null);
    const mapRef = useRef(null);

    useEffect(() => {
        if (!window.google || !window.google.maps) {
            setError('Google Maps not loaded');
            return;
        }

        if (!address) {
            setError('Address information is missing');
            return;
        }

        const geocoder = new window.google.maps.Geocoder();
        const addressString = `${address.street || ''}${address.street2 ? ', ' + address.street2 : ''}, ${address.city || ''}, ${address.state || ''} ${address.postalCode || ''}, ${address.country || ''}`;

        geocoder.geocode({ address: addressString }, (results, status) => {
            if (status === 'OK') {
                const location = results[0].geometry.location;
                setPosition({
                    lat: location.lat(),
                    lng: location.lng()
                });

                if (mapRef.current) {
                    const bounds = new window.google.maps.LatLngBounds();
                    bounds.extend(location);
                    mapRef.current.fitBounds(bounds, {
                        padding: { top: 50, right: 50, bottom: 50, left: 50 }
                    });
                }
            } else {
                console.error('Geocoding failed:', status);
                setError('Failed to geocode address');
            }
        });
    }, [address]);

    const handleMapLoad = React.useCallback((map) => {
        mapRef.current = map;
    }, []);

    if (error) {
        return (
            <Box sx={{
                height: '300px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#f5f5f5',
                borderRadius: '8px',
                p: 2
            }}>
                <Typography variant="body2" color="text.secondary" align="center">
                    {error}
                </Typography>
            </Box>
        );
    }

    if (!position) {
        return (
            <Box sx={{
                height: '300px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bgcolor: '#f5f5f5',
                borderRadius: '8px'
            }}>
                <CircularProgress size={24} />
            </Box>
        );
    }

    return (
        <GoogleMap
            mapContainerStyle={{
                width: '100%',
                height: '300px',
                borderRadius: '8px'
            }}
            center={position}
            zoom={17}
            onLoad={handleMapLoad}
            options={{
                disableDefaultUI: false,
                zoomControl: true,
                mapTypeControl: false,
                streetViewControl: true,
                fullscreenControl: true
            }}
        >
            <Marker
                position={position}
                icon={{
                    url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png',
                    scaledSize: new window.google.maps.Size(30, 30)
                }}
            />
        </GoogleMap>
    );
});

const ChatBot = ({ onShipmentComplete, formData }) => {
    const theme = useTheme();
    const location = useLocation();
    const navigate = useNavigate();
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [currentStep, setCurrentStep] = useState(STEPS.INIT);
    const [shipmentData, setShipmentData] = useState({});
    const [unreadCount, setUnreadCount] = useState(0);
    const [isFullscreen, setIsFullscreen] = useState(false);
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
    const geminiAgent = useRef(new GeminiAgent());
    const [progress, setProgress] = useState(0);
    const [originAddress, setOriginAddress] = useState(null);
    const [destinationAddress, setDestinationAddress] = useState(null);
    const [showAddressInput, setShowAddressInput] = useState(false);
    const [mapsApiKey, setMapsApiKey] = useState(null);
    const [isGoogleMapsLoaded, setIsGoogleMapsLoaded] = useState(false);
    const placesService = useRef(null);

    // Initialize chat with welcome message
    useEffect(() => {
        if (messages.length === 0) {
            const welcomeMessages = [
                {
                    text: "Welcome to SolushipX! I'm here to help you create a shipment.",
                    sender: 'ai'
                },
                {
                    text: "What are we shipping today?",
                    sender: 'ai'
                }
            ];
            setMessages(welcomeMessages);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            setUnreadCount(0);
        }
    }, [isOpen]);

    // Fetch Maps API key when component mounts
    useEffect(() => {
        const fetchMapsApiKey = async () => {
            try {
                const keysRef = collection(db, 'keys');
                const keysSnapshot = await getDocs(keysRef);

                if (!keysSnapshot.empty) {
                    const keyDoc = keysSnapshot.docs[0];
                    const key = keyDoc.data().googleAPI;
                    if (!key) {
                        throw new Error('No API key found in Firestore');
                    }
                    setMapsApiKey(key);
                } else {
                    throw new Error('No keys document found in Firestore');
                }
            } catch (error) {
                console.error('Error fetching Maps API key:', error);
            }
        };

        fetchMapsApiKey();
    }, []);

    // Wait for Maps API to load
    const handleGoogleMapsLoaded = useCallback(() => {
        setIsGoogleMapsLoaded(true);
    }, []);

    useEffect(() => {
        // Initialize Google Places service
        if (window.google && window.google.maps) {
            placesService.current = new window.google.maps.places.AutocompleteService();
        }
    }, []);

    const handleClose = () => {
        setIsOpen(false);
    };

    const handleOpen = () => {
        setIsOpen(true);
    };

    const toggleFullscreen = () => {
        setIsFullscreen(!isFullscreen);
    };

    // Update progress when step changes
    useEffect(() => {
        const totalSteps = Object.keys(STEPS).length;
        const newProgress = ((currentStep.number - 1) / (totalSteps - 1)) * 100;
        setProgress(newProgress);
    }, [currentStep]);

    const updateStep = (message) => {
        const lowerMessage = message.toLowerCase();

        // Determine the current context from the message
        if (lowerMessage.includes('origin') || lowerMessage.includes('coming from') || lowerMessage.includes('pickup')) {
            setCurrentStep(STEPS.ORIGIN);
        } else if (lowerMessage.includes('destination') || lowerMessage.includes('going to') || lowerMessage.includes('deliver')) {
            setCurrentStep(STEPS.DESTINATION);
        } else if (lowerMessage.includes('package') || lowerMessage.includes('weight') || lowerMessage.includes('dimensions')) {
            setCurrentStep(STEPS.PACKAGE);
        } else if (lowerMessage.includes('rate') || lowerMessage.includes('cost') || lowerMessage.includes('price')) {
            setCurrentStep(STEPS.RATES);
        } else if (lowerMessage.includes('review') || lowerMessage.includes('confirm')) {
            setCurrentStep(STEPS.REVIEW);
        }
    };

    const handleSend = async (message) => {
        try {
            setMessages(prev => [...prev, { text: message, sender: 'user' }]);

            // Update step based on message content
            updateStep(message);

            const response = await geminiAgent.current.processMessage(message, messages);
            const aiMessage = { text: response.message.content, sender: 'ai' };

            setMessages(prev => [...prev, aiMessage]);

            // Update step based on AI response
            updateStep(response.message.content);

            // Update shipment data with collected info
            if (response.collectedInfo) {
                setShipmentData(prev => ({
                    ...prev,
                    ...response.collectedInfo
                }));
            }

            if (!isOpen) {
                setUnreadCount(prev => prev + 1);
            }
        } catch (error) {
            console.error('Error processing message:', error);
            setMessages(prev => [...prev, {
                text: 'I apologize, but I encountered an error. Please try again.',
                sender: 'ai'
            }]);
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
            await handleSend(addressMessage);
        } catch (error) {
            console.error('Error confirming address:', error);
            setAddressError('Failed to process address. Please try again.');
        } finally {
            setShowAddressConfirm(false);
            setConfirmAddress(null);
        }
    };

    const handleAddressSelect = async (prediction) => {
        try {
            const placeDetails = await GooglePlacesService.getPlaceDetails(prediction.place_id);
            const formattedAddress = formatAddressMessage(placeDetails, currentAddressType);

            // Send the formatted address as a user message
            handleSend(formattedAddress);

            // Clear the address input state
            setIsAddressInput(false);
            setAddressPredictions([]);
        } catch (error) {
            console.error('Error getting place details:', error);
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
                                    text: `I'll select this option: ${message.rateData.carrierName} - ${message.rateData.serviceMode}`,
                                    sender: 'user'
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
                    justifyContent: message.sender === 'user' ? 'flex-end' : 'flex-start',
                    gap: 1,
                    mb: 2
                }}
            >
                <Paper
                    sx={{
                        p: 2,
                        maxWidth: '70%',
                        bgcolor: message.sender === 'user' ? 'primary.main' : 'background.paper',
                        color: message.sender === 'user' ? 'white' : 'text.primary',
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
                        {message.text}
                    </Typography>
                    <Typography
                        variant="caption"
                        sx={{
                            display: 'block',
                            mt: 1,
                            color: message.sender === 'user' ? 'rgba(255,255,255,0.7)' : 'text.secondary'
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
        const subpremise = getComponent('subpremise'); // For suite/unit numbers

        // Remove country restriction
        if (!streetNumber || !route || !city || !state || !postalCode || !country) {
            const missing = [];
            if (!streetNumber || !route) missing.push('street address');
            if (!city) missing.push('city');
            if (!state) missing.push('state/province');
            if (!postalCode) missing.push('postal code');
            if (!country) missing.push('country');

            const missingStr = missing.join(',');
            return `The ${type} address needs more information. Please provide the ${missingStr}.`;
        }

        // Format address with suite/unit number if available
        const formattedAddress = subpremise
            ? `${streetNumber} ${route}, ${subpremise}, ${city}, ${state} ${postalCode}, ${country}`
            : `${streetNumber} ${route}, ${city}, ${state} ${postalCode}, ${country}`;

        return `The ${type} address is: ${formattedAddress.replace(/\s+/g, ' ').trim()}`;
    };

    const renderAddressInput = () => {
        if (!showAddressInput) return null;

        return (
            <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                <Typography variant="subtitle1" gutterBottom>
                    Enter {currentAddressType === 'origin' ? 'origin' : 'destination'} address
                </Typography>
                <AddressInputWidget
                    onAddressSelect={(place) => handleAddressSelect(place)}
                    placeholder={`Enter ${currentAddressType === 'origin' ? 'origin' : 'destination'} address...`}
                />
            </Box>
        );
    };

    const renderMap = () => {
        if (!originAddress && !destinationAddress) return null;

        return (
            <Box sx={{ p: 2, bgcolor: 'background.paper', borderRadius: 1 }}>
                <Typography variant="subtitle1" gutterBottom>
                    Shipment Route
                </Typography>
                {mapsApiKey && (
                    <LoadScript
                        googleMapsApiKey={mapsApiKey}
                        libraries={GOOGLE_MAPS_LIBRARIES}
                        onLoad={handleGoogleMapsLoaded}
                    >
                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Origin
                                </Typography>
                                <SimpleMap
                                    address={{
                                        street: originAddress?.street,
                                        street2: originAddress?.street2,
                                        city: originAddress?.city,
                                        state: originAddress?.state,
                                        postalCode: originAddress?.postalCode,
                                        country: originAddress?.country
                                    }}
                                    title="Origin"
                                />
                            </Grid>
                            <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Destination
                                </Typography>
                                <SimpleMap
                                    address={{
                                        street: destinationAddress?.street,
                                        street2: destinationAddress?.street2,
                                        city: destinationAddress?.city,
                                        state: destinationAddress?.state,
                                        postalCode: destinationAddress?.postalCode,
                                        country: destinationAddress?.country
                                    }}
                                    title="Destination"
                                />
                            </Grid>
                        </Grid>
                    </LoadScript>
                )}
            </Box>
        );
    };

    const handleAddressSearch = async (input) => {
        if (!input || !placesService.current) return;

        try {
            const predictions = await new Promise((resolve, reject) => {
                placesService.current.getPlacePredictions(
                    {
                        input,
                        types: ['address'],
                        componentRestrictions: { country: ['us', 'ca'] }
                    },
                    (results, status) => {
                        if (status === 'OK') resolve(results);
                        else reject(status);
                    }
                );
            });
            setAddressPredictions(predictions);
        } catch (error) {
            console.error('Error fetching address predictions:', error);
            setAddressPredictions([]);
        }
    };

    // Update the message rendering to include address input when needed
    const renderMessageContent = (message) => {
        if (message.sender === 'ai' &&
            (message.text.toLowerCase().includes('what is the street address') ||
                message.text.toLowerCase().includes('where is this package'))) {
            setIsAddressInput(true);
            setCurrentAddressType(message.text.toLowerCase().includes('shipping from') ? 'origin' : 'destination');

            return (
                <Box>
                    <Typography variant="body1" sx={{ mb: 2 }}>{message.text}</Typography>
                    <Autocomplete
                        freeSolo
                        options={addressPredictions}
                        getOptionLabel={(option) =>
                            typeof option === 'string' ? option : option.description
                        }
                        renderOption={(props, option) => (
                            <Box component="li" {...props}>
                                <LocationOn sx={{ mr: 1 }} />
                                {option.description}
                            </Box>
                        )}
                        renderInput={(params) => (
                            <TextField
                                {...params}
                                fullWidth
                                placeholder="Type an address..."
                                variant="outlined"
                                onChange={(e) => handleAddressSearch(e.target.value)}
                            />
                        )}
                        onChange={(event, value) => {
                            if (value && typeof value !== 'string') {
                                handleAddressSelect(value);
                            }
                        }}
                    />
                </Box>
            );
        }

        return <Typography variant="body1">{message.text}</Typography>;
    };

    // Render the chat interface
    return (
        <>
            {!isOpen && (
                <Box
                    sx={{
                        position: 'fixed',
                        bottom: 20,
                        right: 20,
                        zIndex: 1000,
                    }}
                >
                    <Badge badgeContent={unreadCount} color="primary">
                        <IconButton
                            onClick={handleOpen}
                            sx={{
                                width: 60,
                                height: 60,
                                backgroundColor: theme.palette.primary.main,
                                color: 'white',
                                '&:hover': {
                                    backgroundColor: theme.palette.primary.dark,
                                },
                            }}
                        >
                            <LocalShipping />
                        </IconButton>
                    </Badge>
                </Box>
            )}
            <AIExperience
                open={isOpen}
                onClose={handleClose}
                onSend={handleSend}
                messages={messages}
            />
            {renderAddressInput()}
            {renderMap()}
        </>
    );
};

export default ChatBot; 