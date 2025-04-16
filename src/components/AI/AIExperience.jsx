import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Box,
    Typography,
    IconButton,
    TextField,
    Paper,
    Avatar,
    List,
    ListItem,
    ListItemText,
    Chip,
    CircularProgress,
    Tooltip,
    Fade
} from '@mui/material';
import { styled } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';
import { getAuth } from 'firebase/auth';

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

const SuggestionChip = styled(Chip)(({ theme }) => ({
    margin: theme.spacing(0.5),
    backgroundColor: theme.palette.background.paper,
    border: '1px solid rgba(0,0,0,0.1)',
    '&:hover': {
        backgroundColor: theme.palette.primary.light,
        color: theme.palette.primary.contrastText,
    },
}));

const AIExperience = ({ open, onClose, onSend, messages = [] }) => {
    const [message, setMessage] = useState('');
    const messagesEndRef = useRef(null);
    const auth = getAuth();
    const [companyAddresses, setCompanyAddresses] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showAddressSuggestions, setShowAddressSuggestions] = useState(false);
    // Create a local copy of messages that we can update
    const [localMessages, setLocalMessages] = useState([]);
    const [conversationHistory, setConversationHistory] = useState([]);
    const [isTyping, setIsTyping] = useState(false);
    const [suggestedResponses, setSuggestedResponses] = useState([]);
    const [userPreferences, setUserPreferences] = useState({
        preferredAddressFormat: 'detailed',
        preferredTimeFormat: '24h',
        language: 'en'
    });

    // Sync local messages with prop messages when they change
    useEffect(() => {
        setLocalMessages(messages);
    }, [messages]);

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

    // Fetch company addresses when component mounts
    useEffect(() => {
        const fetchCompanyAddresses = async () => {
            if (!auth.currentUser) return;

            try {
                setLoading(true);
                console.log('Fetching company addresses...');

                // First, fetch the user's data from the users collection
                const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
                if (!userDoc.exists()) {
                    console.log('User document not found');
                    setError('User data not found. Please contact support.');
                    setLoading(false);
                    return;
                }

                const userData = userDoc.data();
                console.log('User data:', userData);

                if (!userData.connectedCompanies?.companies || userData.connectedCompanies.companies.length === 0) {
                    console.log('No connected companies found for user');
                    setError('No company associated with this account. Please contact support.');
                    setLoading(false);
                    return;
                }

                // Get the first company ID from the companies array
                const companyId = userData.connectedCompanies.companies[0];
                console.log('Using company ID:', companyId);

                // Try to find the company by companyID field
                const companiesRef = collection(db, 'companies');
                const q = query(companiesRef, where('companyID', '==', companyId));
                const querySnapshot = await getDocs(q);

                if (querySnapshot.empty) {
                    console.log('No company found with companyID:', companyId);
                    setError('Company data not found. Please contact support.');
                    setLoading(false);
                    return;
                }

                const companyDoc = querySnapshot.docs[0];
                const data = companyDoc.data();
                console.log('Company data:', data);

                // Set company addresses
                const shipFromAddresses = data.shipFromAddresses || [];
                setCompanyAddresses(shipFromAddresses);
                console.log('Company addresses loaded:', shipFromAddresses);
            } catch (err) {
                console.error('Error fetching company addresses:', err);
                setError('Failed to load company addresses. Please try again or contact support.');
            } finally {
                setLoading(false);
            }
        };

        fetchCompanyAddresses();
    }, [auth.currentUser]);

    // Auto-scroll to the bottom of messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Handle sending messages
    const handleSend = () => {
        if (message.trim()) {
            // Send message to parent component
            onSend(message);

            // Create user message object
            const userMessage = {
                id: Date.now(),
                text: message,
                sender: 'user'
            };

            // Always add the user message to the local state first
            setLocalMessages(prevMessages => [...prevMessages, userMessage]);

            // Check if this is a greeting and handle specially
            const lowerMsg = message.toLowerCase().trim();
            if (lowerMsg === 'hello' ||
                lowerMsg === 'hi' ||
                lowerMsg === 'hey' ||
                lowerMsg.includes('hello') ||
                lowerMsg.includes('hi there') ||
                lowerMsg.includes('hey there')) {

                // Create greeting response - match a friendly tone
                const greetingResponse = {
                    id: Date.now() + 1,
                    text: "Hi there! I'm here to help with your shipment. What can I do for you?",
                    sender: 'assistant'
                };

                // Add the greeting response to our local messages
                setLocalMessages(prevMessages => [...prevMessages, greetingResponse]);

                // Don't process further for greetings, but don't modify current state either
                setMessage('');
                return;
            }

            // Process the message to update shipment data
            processUserMessage(message);

            // Clear input field
            setMessage('');
        }
    };

    // Handle address selection
    const handleAddressSelect = (address) => {
        // Check if the address is complete - needs company, street, city, state, postal code
        const isAddressComplete =
            address.company &&
            address.street &&
            address.city &&
            address.state &&
            address.postalCode;

        // Ensure we have a complete address with all fields
        const completeAddress = {
            ...address,
            country: address.country || 'CA', // Default to Canada if not present
        };

        // Handle incomplete address differently
        if (!isAddressComplete) {
            // Format what we have of the address
            const addressSummary = `
Company: ${completeAddress.company || 'N/A'}
${completeAddress.street ? `Street: ${completeAddress.street}` : ''}
${completeAddress.city ? `City: ${completeAddress.city}` : ''}
${completeAddress.state ? `State/Province: ${completeAddress.state}` : ''}
${completeAddress.postalCode ? `Postal Code: ${completeAddress.postalCode}` : ''}
Country: ${completeAddress.country}
            `.trim();

            // First send the user selection message to the parent with full address details
            const userText = `I'll use this address:\n\n${addressSummary}`;
            onSend(userText);

            // Create message objects for our local state
            const userMessage = {
                id: Date.now(),
                text: userText,
                sender: 'user'
            };

            const incompleteAddressMessage = {
                id: Date.now() + 1,
                text: `I see you've selected ${completeAddress.company}. I need a complete address including street, city, state/province, and postal code. What's the street address?`,
                sender: 'assistant'
            };

            // Update our local messages
            setLocalMessages([
                ...localMessages,
                userMessage,
                incompleteAddressMessage
            ]);

            // Set the current field to collect street address
            setCurrentField('fromStreet');
            setShowAddressSuggestions(false);
            setMessage('');
            return;
        }

        // If the address is complete, proceed as before
        // Update shipment data with the selected address
        setShipmentData(prev => ({
            ...prev,
            fromCompany: completeAddress.company,
            fromStreet: completeAddress.street,
            fromCity: completeAddress.city,
            fromState: completeAddress.state,
            fromPostalCode: completeAddress.postalCode,
            fromCountry: completeAddress.country,
            currentField: 'toCompany', // Skip directly to destination company
        }));

        // Format the complete address with clear structure
        const formattedAddress = `
Company: ${completeAddress.company}
Street: ${completeAddress.street}${completeAddress.street2 ? `, ${completeAddress.street2}` : ''}
City: ${completeAddress.city}
State/Province: ${completeAddress.state}
Postal Code: ${completeAddress.postalCode}
Country: ${completeAddress.country}
${completeAddress.contactName ? `Contact: ${completeAddress.contactName}` : ''}
${completeAddress.contactPhone ? `Phone: ${completeAddress.contactPhone}` : ''}
        `.trim();

        // First send the user selection message to the parent with full address details
        const userText = `I'll use this address:\n\n${formattedAddress}`;
        onSend(userText);

        // Create message objects for our local state
        const userMessage = {
            id: Date.now(),
            text: userText,
            sender: 'user'
        };

        const confirmationMessage = {
            id: Date.now() + 1,
            text: `Perfect! I've recorded this address:\n\n${formattedAddress}`,
            sender: 'assistant'
        };

        const followUpMessage = {
            id: Date.now() + 2,
            text: "Now, let's move on to the destination. What company or person is receiving the package?",
            sender: 'assistant'
        };

        // Update our local messages with all three new messages
        setLocalMessages([
            ...localMessages,
            userMessage,
            confirmationMessage,
            followUpMessage
        ]);

        setShowAddressSuggestions(false); // Hide suggestions after selection
        setMessage(''); // Clear input field
    };

    // Enhanced message processing with better NLP
    const processUserMessage = (userMessage) => {
        const msg = userMessage.toLowerCase();

        // Add to conversation history
        setConversationHistory(prev => [...prev, { role: 'user', content: msg }]);

        // Show typing indicator
        setIsTyping(true);

        // Simulate AI thinking time
        setTimeout(() => {
            setIsTyping(false);

            // Skip processing for messages that were confirming address selection
            if (msg.includes("i'll use this address") || msg.includes("use this address")) {
                return;
            }

            // Enhanced greeting detection with more variations
            if (isGreeting(msg)) {
                const greetingResponse = generateGreetingResponse();
                addAssistantMessage(greetingResponse);
                return;
            }

            // Enhanced confusion detection
            if (isConfused(msg)) {
                const clarificationResponse = generateClarificationResponse();
                addAssistantMessage(clarificationResponse);
                return;
            }

            // Enhanced help detection
            if (isHelpRequest(msg)) {
                const helpResponse = generateHelpResponse();
                addAssistantMessage(helpResponse);
                return;
            }

            // Enhanced address change detection
            if (isAddressChangeRequest(msg)) {
                handleAddressChangeRequest();
                return;
            }

            // Enhanced shipping cost question detection
            if (isShippingCostQuestion(msg)) {
                const shippingCostResponse = generateShippingCostResponse();
                addAssistantMessage(shippingCostResponse);
                return;
            }

            // Process based on current field
            processFieldBasedOnCurrentState(msg);
        }, 1000); // Simulate thinking time
    };

    // Helper functions for enhanced NLP
    const isGreeting = (msg) => {
        const greetingPatterns = [
            /^hi\b/i, /^hello\b/i, /^hey\b/i, /^good\s*(morning|afternoon|evening)\b/i,
            /^greetings\b/i, /^howdy\b/i, /^yo\b/i, /^sup\b/i
        ];
        return greetingPatterns.some(pattern => pattern.test(msg));
    };

    const isConfused = (msg) => {
        const confusionPatterns = [
            /confus/i, /not clear/i, /unclear/i, /don'?t understand/i,
            /what do you mean/i, /huh\b/i, /what\?/i, /i don'?t get it/i,
            /can you explain/i, /i'm lost/i, /lost\b/i
        ];
        return confusionPatterns.some(pattern => pattern.test(msg));
    };

    const isHelpRequest = (msg) => {
        const helpPatterns = [
            /help\b/i, /assist/i, /support\b/i, /guide\b/i, /how do i/i,
            /can you help/i, /i need help/i, /instructions/i, /tutorial/i
        ];
        return helpPatterns.some(pattern => pattern.test(msg));
    };

    const isAddressChangeRequest = (msg) => {
        const addressChangePatterns = [
            /change.*(origin|from|my address)/i,
            /update.*(origin|from|my address)/i,
            /different.*(origin|from|my address)/i,
            /wrong.*(origin|from|my address)/i,
            /modify.*(origin|from|my address)/i
        ];
        return addressChangePatterns.some(pattern => pattern.test(msg));
    };

    const isShippingCostQuestion = (msg) => {
        const shippingCostPatterns = [
            /ship.*(cost|price|rate|how much|estimate)/i,
            /how much.*ship/i, /cost.*ship/i, /price.*ship/i,
            /rate.*ship/i, /estimate.*ship/i, /shipping.*cost/i
        ];
        return shippingCostPatterns.some(pattern => pattern.test(msg));
    };

    // Handle address change request
    const handleAddressChangeRequest = () => {
        setCurrentField('fromCompany'); // Reset to origin address collection
        // Show address suggestions again
        if (companyAddresses && companyAddresses.length > 0) {
            setShowAddressSuggestions(true);

            const changeAddressResponse = {
                id: Date.now() + 1,
                text: "Sure, please select a different origin address from your saved addresses.",
                sender: 'assistant'
            };

            setLocalMessages(prevMessages => [...prevMessages, changeAddressResponse]);
        } else {
            const noAddressesResponse = {
                id: Date.now() + 1,
                text: "I don't see any saved addresses in your account. Please contact support to add addresses to your profile.",
                sender: 'assistant'
            };

            setLocalMessages(prevMessages => [...prevMessages, noAddressesResponse]);
        }
    };

    // Response generation functions
    const generateGreetingResponse = () => {
        const greetings = [
            "Hi there! I'm here to help with your shipment. What can I do for you?",
            "Hello! How can I assist you with your shipping needs today?",
            "Hey! Ready to help you create a shipment. What would you like to do?",
            "Greetings! I'm your SolushipX assistant. How can I help you today?"
        ];
        return greetings[Math.floor(Math.random() * greetings.length)];
    };

    const generateClarificationResponse = () => {
        const currentState = getCurrentStateDescription();
        return `I apologize for the confusion. Let me clarify where we are in the process: ${currentState}. What would you like me to explain?`;
    };

    const generateHelpResponse = () => {
        return "I'm here to help you create a shipment. I can assist with:\n\n" +
            "• Collecting origin and destination addresses\n" +
            "• Package details (weight, dimensions, quantity)\n" +
            "• Shipping options and rates\n" +
            "• Tracking and delivery information\n\n" +
            "What information would you like to provide first?";
    };

    const generateShippingCostResponse = () => {
        return "To provide accurate shipping costs, I'll need some information about your shipment first. " +
            "Let's start with the origin and destination addresses, then package details. Would you like to begin?";
    };

    // Helper function to get current state description
    const getCurrentStateDescription = () => {
        switch (currentField) {
            case 'intro':
                return "We're just starting to create your shipment.";
            case 'fromCompany':
            case 'fromStreet':
            case 'fromCity':
            case 'fromState':
            case 'fromPostalCode':
            case 'fromContactName':
            case 'fromContactPhone':
            case 'fromContactEmail':
                return "We're collecting information about the pickup address.";
            case 'toCompany':
            case 'toStreet':
            case 'toCity':
            case 'toState':
            case 'toPostalCode':
            case 'toContactName':
            case 'toContactPhone':
            case 'toContactEmail':
                return "We're collecting information about the delivery address.";
            case 'packageWeight':
            case 'packageDimensions':
            case 'packageQuantity':
            case 'packageValue':
                return "We're collecting information about your package.";
            case 'complete':
                return "We've collected all the necessary information for your shipment.";
            default:
                return "We're setting up your shipment.";
        }
    };

    // Helper function to add assistant message
    const addAssistantMessage = (text) => {
        const assistantMessage = {
            id: Date.now() + 1,
            text: text,
            sender: 'assistant'
        };

        setLocalMessages(prevMessages => [...prevMessages, assistantMessage]);

        // Add to conversation history
        setConversationHistory(prev => [...prev, { role: 'assistant', content: text }]);

        // Generate suggested responses based on current state
        generateSuggestedResponses();
    };

    // Generate suggested responses based on current state
    const generateSuggestedResponses = () => {
        const suggestions = [];

        switch (currentField) {
            case 'intro':
                suggestions.push("I want to create a new shipment");
                suggestions.push("I need shipping rates");
                suggestions.push("I want to track a shipment");
                break;
            case 'fromCompany':
                suggestions.push("Acme Corporation");
                suggestions.push("John Smith");
                suggestions.push("Let me select from saved addresses");
                break;
            // Add more cases for other fields
            default:
                // No suggestions for other fields
                break;
        }

        setSuggestedResponses(suggestions);
    };

    // Process field based on current state
    const processFieldBasedOnCurrentState = (msg) => {
        // ... existing switch statement for currentField ...
    };

    // Get the next prompt based on the current state
    const getNextPrompt = () => {
        switch (currentField) {
            case 'intro':
                return "Welcome to SolushipX! I'm here to help you create a shipment.";
            case 'fromCompany':
                return "Thanks! What company or person is sending this?";
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

    // Render the address suggestion list
    const renderAddressSuggestions = () => {
        if (!showAddressSuggestions || companyAddresses.length === 0) return null;

        // Sort addresses to show default addresses first
        const sortedAddresses = [...companyAddresses].sort((a, b) => {
            // If a is default and b is not, a comes first
            if (a.isDefault && !b.isDefault) return -1;
            // If b is default and a is not, b comes first
            if (b.isDefault && !a.isDefault) return 1;
            // Otherwise maintain original order
            return 0;
        });

        return (
            <Box sx={{ mb: 2, width: '100%' }}>
                <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                    Please select an origin address from your saved addresses:
                </Typography>
                <List sx={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {sortedAddresses.map((address, index) => (
                        <ListItem
                            key={index}
                            button
                            onClick={() => handleAddressSelect(address)}
                            sx={{
                                border: `1px solid ${address.isDefault ? 'primary.main' : 'rgba(0,0,0,0.1)'}`,
                                borderRadius: 1,
                                mb: 1,
                                '&:hover': {
                                    backgroundColor: 'rgba(0,0,0,0.05)',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                    borderColor: 'primary.main',
                                    borderWidth: 1
                                },
                                padding: '10px 15px',
                                display: 'block',
                                position: 'relative',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                backgroundColor: address.isDefault ? 'rgba(106, 70, 193, 0.05)' : 'transparent'
                            }}
                        >
                            {/* Address summary */}
                            <Box sx={{ display: 'flex', flexDirection: 'column', mb: 0.5 }}>
                                <Typography variant="subtitle1" sx={{
                                    fontWeight: 'bold',
                                    color: 'primary.main',
                                    mb: 0.5,
                                    fontSize: '0.95rem',
                                    display: 'flex',
                                    alignItems: 'center'
                                }}>
                                    {address.company}
                                    {address.isDefault && (
                                        <Chip
                                            size="small"
                                            label="Default"
                                            sx={{
                                                ml: 1,
                                                height: '18px',
                                                fontSize: '0.7rem',
                                                backgroundColor: 'primary.light',
                                                color: 'white'
                                            }}
                                        />
                                    )}
                                </Typography>

                                {/* One-line summary of full address */}
                                <Typography variant="body2" sx={{
                                    color: 'text.secondary',
                                    fontSize: '0.85rem',
                                    mb: 0.5
                                }}>
                                    {address.street}{address.street2 ? `, ${address.street2}` : ''}, {address.city}, {address.state} {address.postalCode}, {address.country || 'CA'}
                                </Typography>
                            </Box>

                            {/* Compact details in 2 columns */}
                            <Box sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                fontSize: '0.8rem',
                                color: 'text.secondary'
                            }}>
                                {/* Contact info */}
                                <Box sx={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    flexWrap: 'wrap',
                                    gap: '0 10px'
                                }}>
                                    {address.contactName && (
                                        <Typography component="span" variant="body2" sx={{ fontSize: '0.8rem' }}>
                                            Contact: {address.contactName}
                                        </Typography>
                                    )}
                                    {address.contactPhone && (
                                        <Typography component="span" variant="body2" sx={{ fontSize: '0.8rem' }}>
                                            Phone: {address.contactPhone}
                                        </Typography>
                                    )}
                                </Box>
                            </Box>
                        </ListItem>
                    ))}
                </List>
            </Box>
        );
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
                                localMessages.map((msg, index) => (
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
                            {loading && (
                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                                    <Typography variant="body2">Loading...</Typography>
                                </Box>
                            )}
                            {error && (
                                <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                                    <Typography variant="body2" color="error">{error}</Typography>
                                </Box>
                            )}
                            {/* Typing Indicator */}
                            {isTyping && (
                                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, ml: 2 }}>
                                    <CircularProgress size={20} sx={{ mr: 1 }} />
                                    <Typography variant="body2" color="text.secondary">
                                        Assistant is typing...
                                    </Typography>
                                </Box>
                            )}
                            <div ref={messagesEndRef} />
                        </Box>

                        {/* Suggested Responses */}
                        {suggestedResponses.length > 0 && (
                            <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                                {suggestedResponses.map((suggestion, index) => (
                                    <Chip
                                        key={index}
                                        label={suggestion}
                                        onClick={() => {
                                            setMessage(suggestion);
                                            setSuggestedResponses([]);
                                        }}
                                        sx={{
                                            backgroundColor: 'rgba(106, 70, 193, 0.1)',
                                            '&:hover': {
                                                backgroundColor: 'rgba(106, 70, 193, 0.2)',
                                            }
                                        }}
                                    />
                                ))}
                            </Box>
                        )}

                        {/* Address Suggestions */}
                        {renderAddressSuggestions()}

                        {/* Input Area - hide when showing address suggestions and we're at the origin address step */}
                        {!(showAddressSuggestions && (currentField === 'intro' || currentField === 'fromCompany')) && (
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
                                            <Tooltip title="Send message">
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
                                            </Tooltip>
                                        ),
                                    }}
                                />
                            </Box>
                        )}
                    </Box>
                </StyledPaper>
            )}
        </AnimatePresence>
    );
};

export default AIExperience; 