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
    Fade,
    Autocomplete
} from '@mui/material';
import { styled } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PersonIcon from '@mui/icons-material/Person';
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
    const [conversationContext, setConversationContext] = useState({
        hasGreeted: false,
        lastQuestion: null,
        shipmentType: null,
        pendingQuestion: null
    });
    const [customers, setCustomers] = useState([]);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [customerAddresses, setCustomerAddresses] = useState([]);
    const [showCustomerSearch, setShowCustomerSearch] = useState(false);
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [filteredCustomers, setFilteredCustomers] = useState([]);
    const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);
    const [customerError, setCustomerError] = useState(null);

    // Sync local messages with prop messages only on initial mount
    useEffect(() => {
        if (localMessages.length === 0) {
            setLocalMessages(messages);
        }
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

    // Ensure intro stage is set on component mount
    useEffect(() => {
        setCurrentField('intro');
        console.log('STAGE: intro - Initial stage - What are you shipping today?');
        console.log('Current Stage:', getCurrentStateDescription());
        console.log('Current Field:', currentField);
    }, []);

    // Add effect to track when address suggestions appear
    useEffect(() => {
        if (showAddressSuggestions && currentField === 'shipfrom') {
            console.log('STAGE: shipfrom - Collecting pickup address information');
        }
    }, [showAddressSuggestions, currentField]);

    // Add effect to track when customer search appears
    useEffect(() => {
        if (showCustomerSearch && currentField === 'shipto') {
            console.log('STAGE: shipto - Collecting delivery address information');
        }
    }, [showCustomerSearch, currentField]);

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

    // Process user message
    const processUserMessage = async (message) => {
        const msg = message.toLowerCase();

        // Add to conversation history
        setConversationContext(prev => ({
            ...prev,
            lastQuestion: currentField
        }));

        // Show typing indicator
        setIsTyping(true);

        try {
            // Simulate AI thinking time
            await new Promise(resolve => setTimeout(resolve, 800));

            // Handle greetings with context awareness
            if (isGreeting(msg)) {
                const greetingResponse = generateGreetingResponse();
                addAssistantMessage(greetingResponse);
                setIsTyping(false);
                return;
            }

            // If this is the first response about what's being shipped
            if (currentField === 'intro' && !msg.includes('hello') && !msg.includes('hi')) {
                setShipmentData(prev => ({
                    ...prev,
                    items: [
                        {
                            ...prev.items[0],
                            name: message
                        }
                    ]
                }));

                // Store shipment type in context
                setConversationContext(prev => ({
                    ...prev,
                    shipmentType: message
                }));

                // Show address suggestions immediately when we know what's being shipped
                if (companyAddresses && companyAddresses.length > 0) {
                    setShowAddressSuggestions(true);
                    setShowCustomerSearch(false);
                    const response = "Great! I'll help you ship " + message + ". I see you have some saved addresses. Would you like to use one of these for the pickup location?";
                    addAssistantMessage(response);
                    setCurrentField('shipfrom');
                } else {
                    const response = "Great! I'll help you ship " + message + ". What company or person is sending this?";
                    addAssistantMessage(response);
                    setCurrentField('shipfrom');
                }
                setIsTyping(false);
                return;
            }

            // Handle destination input
            if (currentField === 'shipto') {
                // Hide address suggestions and show customer search
                setShowAddressSuggestions(false);
                setShowCustomerSearch(true);
                setCurrentField('shipto');

                // Update shipment data with destination company
                setShipmentData(prev => ({
                    ...prev,
                    toAddress: {
                        ...prev.toAddress,
                        company: message
                    }
                }));

                // Fetch and show customer list
                await fetchCustomers();
                addAssistantMessage("Please search and select a customer from the list.");
                setIsTyping(false);
                return;
            }

            // Handle manual destination address input if no customer is selected
            if (currentField === 'shipto') {
                setShipmentData(prev => ({
                    ...prev,
                    toAddress: {
                        ...prev.toAddress,
                        company: message
                    }
                }));
                setCurrentField('shipto');
                addAssistantMessage("What's the street address for delivery?");
                setIsTyping(false);
                return;
            }

            // Handle package weight input
            if (currentField === 'packages') {
                const weight = parseFloat(message.replace(/[^0-9.]/g, ''));
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

                    // Add confirmation message
                    const confirmationMessage = {
                        id: Date.now() + 1,
                        text: `Great! I've recorded the package weight as ${weight} pounds. What are the dimensions of your package? (Please provide length x width x height in inches)`,
                        sender: 'assistant'
                    };

                    setLocalMessages(prevMessages => [...prevMessages, confirmationMessage]);
                    setCurrentField('packageDimensions');
                } else {
                    addAssistantMessage("I couldn't understand the weight. Please provide a number in pounds.");
                }
                setIsTyping(false);
                return;
            }

            // Handle package dimensions input
            if (currentField === 'packageDimensions') {
                const dimensions = message.match(/(\d+)[^\d]+(\d+)[^\d]+(\d+)/);
                if (dimensions && dimensions.length >= 4) {
                    const [_, length, width, height] = dimensions;
                    setShipmentData(prev => ({
                        ...prev,
                        items: [
                            {
                                ...prev.items[0],
                                length: parseInt(length),
                                width: parseInt(width),
                                height: parseInt(height)
                            }
                        ]
                    }));

                    // Add confirmation message
                    const confirmationMessage = {
                        id: Date.now() + 1,
                        text: `Perfect! I've recorded the package dimensions as ${length}" × ${width}" × ${height}". Would you like to add any special handling instructions for your package?`,
                        sender: 'assistant'
                    };

                    setLocalMessages(prevMessages => [...prevMessages, confirmationMessage]);
                    setCurrentField('specialInstructions');
                } else {
                    addAssistantMessage("I couldn't understand the dimensions. Please provide them in the format: length x width x height (in inches). For example: 12 x 8 x 6");
                }
                setIsTyping(false);
                return;
            }

            // Handle special instructions input
            if (currentField === 'specialInstructions') {
                setShipmentData(prev => ({
                    ...prev,
                    items: [
                        {
                            ...prev.items[0],
                            specialInstructions: message
                        }
                    ]
                }));

                // Add confirmation message
                const confirmationMessage = {
                    id: Date.now() + 1,
                    text: `I've recorded your special handling instructions: "${message}". Would you like to add a reference number for this shipment?`,
                    sender: 'assistant'
                };

                setLocalMessages(prevMessages => [...prevMessages, confirmationMessage]);
                setCurrentField('referenceNumber');
                setIsTyping(false);
                return;
            }

            // Handle reference number input
            if (currentField === 'referenceNumber') {
                setShipmentData(prev => ({
                    ...prev,
                    referenceNumber: message
                }));

                // Add confirmation message
                const confirmationMessage = {
                    id: Date.now() + 1,
                    text: `I've recorded your reference number: "${message}". Now, let's calculate the shipping cost. Would you like to proceed?`,
                    sender: 'assistant'
                };

                setLocalMessages(prevMessages => [...prevMessages, confirmationMessage]);
                setCurrentField('complete');
                setIsTyping(false);
                return;
            }

            // Rest of the existing message processing logic...
        } catch (error) {
            console.error('Error processing message:', error);
            addAssistantMessage("I apologize, but I encountered an error processing your request. Please try again.");
        } finally {
            setIsTyping(false);
        }
    };

    // Handle shipping from address selection
    const handleShipFromAddress = (address) => {
        // Check if the address is complete
        const isAddressComplete = address.company &&
            address.street &&
            address.city &&
            address.state &&
            address.postalCode;

        // Ensure we have a complete address with all fields
        const completeAddress = {
            ...address,
            country: address.country || 'CA'
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
                text: `I see you've selected an address, but I need a complete address. What's the street address?`,
                sender: 'assistant'
            };

            // Update our local messages
            setLocalMessages([
                ...localMessages,
                userMessage,
                incompleteAddressMessage
            ]);

            // Set the current field to collect street address
            setCurrentField('shipfrom');
            setShowAddressSuggestions(false);
            setMessage('');
            return;
        }

        // Add the address type to the address object
        const addressWithType = {
            ...completeAddress,
            type: 'origin'
        };

        // Update the fromAddress in shipment data
        setShipmentData(prev => ({
            ...prev,
            fromAddress: {
                company: addressWithType.company,
                street: addressWithType.street,
                street2: addressWithType.street2 || '',
                city: addressWithType.city,
                state: addressWithType.state,
                postalCode: addressWithType.postalCode,
                country: addressWithType.country,
                contactName: addressWithType.contactName || '',
                contactPhone: addressWithType.contactPhone || '',
                contactEmail: addressWithType.contactEmail || '',
                specialInstructions: addressWithType.specialInstructions || 'none'
            }
        }));

        // Format the complete address with clear structure
        const formattedAddress = `
${addressWithType.company}
Street: ${addressWithType.street}${addressWithType.street2 ? `, ${addressWithType.street2}` : ''}
City: ${addressWithType.city}
State/Province: ${addressWithType.state}
Postal Code: ${addressWithType.postalCode}
Country: ${addressWithType.country}
${addressWithType.contactName ? `Contact: ${addressWithType.contactName}` : ''}
${addressWithType.contactPhone ? `Phone: ${addressWithType.contactPhone}` : ''}
        `.trim();

        // Send the user selection message to the parent with full address details
        const userText = `I'll use this pickup address:\n\n${formattedAddress}`;
        onSend(userText);

        // Create message objects for our local state
        const userMessage = {
            id: Date.now(),
            text: userText,
            sender: 'user'
        };

        const confirmationMessage = {
            id: Date.now() + 1,
            text: `Perfect! I've got the complete pickup address:\n\n${formattedAddress}`,
            sender: 'assistant'
        };

        // Move to destination selection
        const followUpMessage = {
            id: Date.now() + 2,
            text: "Now, let's find the destination. Please search for a customer to deliver to.",
            sender: 'assistant'
        };

        // Update our local messages with all three new messages
        setLocalMessages(prevMessages => [
            ...prevMessages,
            userMessage,
            confirmationMessage,
            followUpMessage
        ]);

        // Hide address suggestions and show customer search
        setShowAddressSuggestions(false);
        setShowCustomerSearch(true);
        setCurrentField('shipto');
        fetchCustomers();
        setMessage('');
    };

    // Handle shipping to address selection
    const handleShipToAddress = (address) => {
        console.log('Selected destination address:', address);

        // Check if the address is complete
        const isAddressComplete = address.street &&
            address.city &&
            address.state &&
            (address.zip || address.postalCode); // Check for either zip or postalCode

        console.log('Address completeness check:', {
            hasStreet: !!address.street,
            hasCity: !!address.city,
            hasState: !!address.state,
            hasZip: !!address.zip,
            hasPostalCode: !!address.postalCode,
            isComplete: isAddressComplete
        });

        // Ensure we have a complete address with all fields
        const completeAddress = {
            ...address,
            company: selectedCustomer?.name || address.company, // Use customer name as company
            country: address.country || 'US',
            postalCode: address.zip || address.postalCode, // Use either zip or postalCode
            street2: address.street2 || '', // Include street2 if present
            attention: address.attention || '' // Include attention if present
        };

        // Handle incomplete address differently
        if (!isAddressComplete) {
            // Format what we have of the address
            const addressSummary = `
Company: ${completeAddress.company || 'N/A'}
${completeAddress.street ? `Street: ${completeAddress.street}` : ''}
${completeAddress.street2 ? `Street 2: ${completeAddress.street2}` : ''}
${completeAddress.city ? `City: ${completeAddress.city}` : ''}
${completeAddress.state ? `State/Province: ${completeAddress.state}` : ''}
${completeAddress.postalCode ? `Postal Code: ${completeAddress.postalCode}` : ''}
Country: ${completeAddress.country}
${completeAddress.attention ? `Attention: ${completeAddress.attention}` : ''}
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
                text: `I see you've selected an address for ${completeAddress.company}, but I need a complete address. What's the street address?`,
                sender: 'assistant'
            };

            // Update our local messages
            setLocalMessages([
                ...localMessages,
                userMessage,
                incompleteAddressMessage
            ]);

            // Set the current field to collect street address
            setCurrentField('shipto');
            setShowAddressSuggestions(false);
            setMessage('');
            return;
        }

        // Add the address type to the address object
        const addressWithType = {
            ...completeAddress,
            type: 'destination'
        };

        // Update the toAddress in shipment data
        setShipmentData(prev => ({
            ...prev,
            toAddress: {
                company: addressWithType.company,
                street: addressWithType.street,
                street2: addressWithType.street2 || '',
                city: addressWithType.city,
                state: addressWithType.state,
                postalCode: addressWithType.postalCode,
                country: addressWithType.country,
                contactName: addressWithType.attention || '', // Use attention as contact name
                contactPhone: addressWithType.contactPhone || '',
                contactEmail: addressWithType.contactEmail || '',
                specialInstructions: addressWithType.specialInstructions || 'none'
            }
        }));

        // Format the complete address with clear structure
        const formattedAddress = `
${addressWithType.company}
Street: ${addressWithType.street}${addressWithType.street2 ? `, ${addressWithType.street2}` : ''}
City: ${addressWithType.city}
State/Province: ${addressWithType.state}
Postal Code: ${addressWithType.postalCode}
Country: ${addressWithType.country}
${addressWithType.attention ? `Attention: ${addressWithType.attention}` : ''}
${addressWithType.specialInstructions ? `Special Instructions: ${addressWithType.specialInstructions}` : ''}
        `.trim();

        // Send the user selection message to the parent with full address details
        const userText = `I'll use this delivery address:\n\n${formattedAddress}`;
        onSend(userText);

        // Create message objects for our local state
        const userMessage = {
            id: Date.now(),
            text: userText,
            sender: 'user'
        };

        const confirmationMessage = {
            id: Date.now() + 1,
            text: `Perfect! I've got the complete delivery address:\n\n${formattedAddress}`,
            sender: 'assistant'
        };

        // Move to package details
        const followUpMessage = {
            id: Date.now() + 2,
            text: "Great! Now let's get the package details. What's the weight of your package in pounds?",
            sender: 'assistant'
        };

        // Update our local messages with all three new messages
        setLocalMessages(prevMessages => [
            ...prevMessages,
            userMessage,
            confirmationMessage,
            followUpMessage
        ]);

        // Hide address suggestions and move to package details
        setShowAddressSuggestions(false);
        setCurrentField('packages');
        setMessage('');
    };

    // Handle address selection based on current field
    const handleAddressSelect = (address) => {
        if (currentField === 'shipfrom') {
            handleShipFromAddress(address);
        } else if (currentField === 'shipto') {
            handleShipToAddress(address);
        }
    };

    // Handle customer selection
    const handleCustomerSelect = (customer) => {
        setSelectedCustomer(customer);

        // Get all addresses for the customer
        const customerAddresses = customer.addresses || [];
        setCustomerAddresses(customerAddresses);

        // Update shipment data with destination company
        setShipmentData(prev => ({
            ...prev,
            toAddress: {
                ...prev.toAddress,
                company: customer.name,
                contactName: customer.contacts?.[0]?.name || '',
                contactPhone: customer.contacts?.[0]?.phone || '',
                contactEmail: customer.contacts?.[0]?.email || ''
            }
        }));

        // Update all states in a single batch to prevent race conditions
        const updates = () => {
            // First set the current field
            setCurrentField('shipto');

            // Then update UI states
            setShowCustomerSearch(false);
            setShowAddressSuggestions(true);
        };

        // Execute updates
        updates();

        // Add a message to confirm customer selection and prompt for address selection
        const userMessage = {
            id: Date.now(),
            text: `Selected customer: ${customer.name}`,
            sender: 'user'
        };

        const assistantMessage = {
            id: Date.now() + 1,
            text: `Great! I see ${customer.name} has ${customerAddresses.length} saved address${customerAddresses.length === 1 ? '' : 'es'}. Please select the specific delivery address from the options below.`,
            sender: 'assistant'
        };

        setLocalMessages(prevMessages => [...prevMessages, userMessage, assistantMessage]);
    };

    // Get current state description
    const getCurrentStateDescription = () => {
        switch (currentField) {
            case 'intro':
                return "We're just starting to create your shipment.";
            case 'shipfrom':
                return "We're collecting information about the pickup address.";
            case 'shipto':
                return "We're collecting information about the delivery address.";
            case 'packages':
                return "We're collecting information about your package.";
            case 'complete':
                return "We've collected all the necessary information for your shipment.";
            default:
                return "We're setting up your shipment.";
        }
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

    // Enhanced greeting response generation
    const generateGreetingResponse = () => {
        if (!conversationContext.hasGreeted) {
            setConversationContext(prev => ({ ...prev, hasGreeted: true }));
            return "Hi there! I'm here to help you create a shipment. To get started, could you tell me what you're shipping today?";
        } else {
            // If we've already greeted, acknowledge but continue the current context
            const continuationPrompt = conversationContext.pendingQuestion || getNextPrompt();
            return `Hello again! Let's continue - ${continuationPrompt}`;
        }
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

    // Helper function to add assistant message
    const addAssistantMessage = (text) => {
        // Get the current stage description
        const currentStage = getCurrentStateDescription();

        // Log the current stage to console
        console.log('Current Stage:', currentStage);
        console.log('Current Field:', currentField);

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
        const shipmentType = conversationContext.shipmentType;

        switch (currentField) {
            case 'intro':
                suggestions.push("A package");
                suggestions.push("Documents");
                suggestions.push("Fragile items");
                suggestions.push("Heavy equipment");
                break;
            case 'fromCompany':
                if (companyAddresses && companyAddresses.length > 0) {
                    suggestions.push("Use a saved address");
                }
                suggestions.push("My company");
                suggestions.push("Personal shipment");
                break;
            case 'fromStreet':
                if (companyAddresses && companyAddresses.length > 0) {
                    const recentAddresses = companyAddresses
                        .slice(0, 2)
                        .map(addr => addr.street);
                    suggestions.push(...recentAddresses);
                }
                break;
            case 'packageWeight':
                suggestions.push("1 lb");
                suggestions.push("5 lbs");
                suggestions.push("10 lbs");
                suggestions.push("25+ lbs");
                break;
            // ... add more cases as needed ...
        }

        setSuggestedResponses(suggestions);
    };

    // Process field based on current state
    const processFieldBasedOnCurrentState = (msg) => {
        // ... existing switch statement for currentField ...
    };

    // Get the next prompt based on the current state
    const getNextPrompt = () => {
        const shipmentType = conversationContext.shipmentType;

        switch (currentField) {
            case 'intro':
                return "What are you shipping today?";
            case 'fromCompany':
                return shipmentType ?
                    `Who will be sending the ${shipmentType}?` :
                    "What company or person is sending this?";
            case 'fromStreet':
                return "What's the pickup street address?";
            case 'fromCity':
                return "Which city will this be picked up from?";
            case 'fromState':
                return "And what state or province is that in?";
            case 'fromPostalCode':
                return "What's the postal code for pickup?";
            case 'fromContactName':
                return "Who should we contact at the pickup location?";
            case 'fromContactPhone':
                return "What's the best phone number to reach them?";
            case 'fromContactEmail':
                return "And their email address for shipping notifications?";
            case 'toCompany':
                return shipmentType ?
                    `Great! Now, who will be receiving the ${shipmentType}?` :
                    "Who will be receiving this shipment?";
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
        if (!showAddressSuggestions) return null;

        // Use customerAddresses if we're selecting a destination address, otherwise use companyAddresses
        const addressesToShow = currentField === 'shipto' ? customerAddresses : companyAddresses;

        if (addressesToShow.length === 0) return null;

        // Sort addresses to show default addresses first
        const sortedAddresses = [...addressesToShow].sort((a, b) => {
            if (a.isDefault && !b.isDefault) return -1;
            if (b.isDefault && !a.isDefault) return 1;
            return 0;
        });

        return (
            <Box sx={{
                mb: 2,
                width: '100%',
                backgroundColor: 'rgba(106, 70, 193, 0.05)',
                borderRadius: 2,
                p: 2,
                border: '1px solid rgba(106, 70, 193, 0.2)'
            }}>
                <Typography variant="subtitle1" sx={{
                    mb: 2,
                    color: 'primary.main',
                    fontWeight: 'bold',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1
                }}>
                    <LocationOnIcon sx={{ fontSize: 20 }} />
                    {currentField === 'shipto' ? 'Select a Delivery Address' : 'Select a Pickup Address'}
                </Typography>
                <List sx={{
                    maxHeight: '300px',
                    overflowY: 'auto',
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
                                    backgroundColor: 'rgba(106, 70, 193, 0.05)',
                                    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                    borderColor: 'primary.main',
                                    borderWidth: 1
                                },
                                padding: '12px 16px',
                                display: 'block',
                                position: 'relative',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                backgroundColor: address.isDefault ? 'rgba(106, 70, 193, 0.05)' : 'white'
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
                                    alignItems: 'center',
                                    gap: 1
                                }}>
                                    {address.company}
                                    {address.isDefault && (
                                        <Chip
                                            size="small"
                                            label="Default"
                                            sx={{
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
                                    {address.street}{address.street2 ? `, ${address.street2}` : ''}, {address.city}, {address.state} {address.zip}, {address.country || 'CA'}
                                </Typography>
                            </Box>

                            {/* Contact info */}
                            <Box sx={{
                                display: 'flex',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '0 10px',
                                fontSize: '0.8rem',
                                color: 'text.secondary'
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
                        </ListItem>
                    ))}
                </List>
            </Box>
        );
    };

    const fetchCustomers = async () => {
        try {
            setIsLoadingCustomers(true);
            setCustomerError(null);
            const currentUser = auth.currentUser;

            if (!currentUser) {
                setCustomerError('User not authenticated');
                return;
            }

            // Get user's data to determine company ID
            const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
            if (!userDoc.exists()) {
                setCustomerError('User data not found');
                return;
            }

            const userData = userDoc.data();
            const companyId = userData.connectedCompanies?.companies?.[0] || userData.companies?.[0];

            if (!companyId) {
                setCustomerError('No company associated with this user');
                return;
            }

            // Fetch customers for the company
            const customersQuery = query(
                collection(db, 'customers'),
                where('companyId', '==', companyId)
            );

            const querySnapshot = await getDocs(customersQuery);

            if (querySnapshot.empty) {
                setCustomerError('No customers found for this company.');
                return;
            }

            const customersData = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            setCustomers(customersData);
            setFilteredCustomers(customersData);
        } catch (err) {
            console.error('Error fetching customers:', err);
            setCustomerError('Failed to load customers. Please try again.');
        } finally {
            setIsLoadingCustomers(false);
        }
    };

    const renderCustomerSearch = () => (
        <Box sx={{ mb: 2 }}>
            <Autocomplete
                options={customers}
                getOptionLabel={(option) => option.name || ''}
                value={selectedCustomer}
                onChange={(event, newValue) => {
                    if (newValue) {
                        handleCustomerSelect(newValue);
                    }
                }}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        label="Search Customers"
                        variant="outlined"
                        fullWidth
                        placeholder="Start typing to search customers..."
                        error={!!customerError}
                        helperText={customerError}
                    />
                )}
                renderOption={(props, option) => (
                    <Box component="li" {...props}>
                        <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                            <PersonIcon sx={{ mr: 2, color: 'primary.main' }} />
                            <Box>
                                <Typography variant="subtitle1">{option.name}</Typography>
                                {option.contacts?.[0] && (
                                    <Typography variant="body2" color="textSecondary">
                                        {option.contacts[0].name}
                                    </Typography>
                                )}
                            </Box>
                        </Box>
                    </Box>
                )}
                filterOptions={(options, { inputValue }) => {
                    return options.filter(option =>
                        option.name?.toLowerCase().includes(inputValue.toLowerCase()) ||
                        option.contacts?.some(contact =>
                            contact.name?.toLowerCase().includes(inputValue.toLowerCase()) ||
                            contact.email?.toLowerCase().includes(inputValue.toLowerCase())
                        )
                    );
                }}
                loading={isLoadingCustomers}
                loadingText="Loading customers..."
            />
        </Box>
    );

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

                        {/* Customer Search */}
                        {showCustomerSearch && renderCustomerSearch()}

                        {/* Address Suggestions */}
                        {showAddressSuggestions && renderAddressSuggestions()}

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