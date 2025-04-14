import React, { useState, useEffect, useRef } from 'react';
import { Box, IconButton, Paper, Typography, CircularProgress, Button, Card, CardContent } from '@mui/material';
import { Mic, MicOff, Send, Close, ExpandMore, ExpandLess } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase';

const ChatBot = ({ onShipmentComplete }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [conversationContext, setConversationContext] = useState({
        origin: null,
        destination: null,
        packageDetails: null,
        selectedRate: null
    });
    const [apiKeyError, setApiKeyError] = useState(null);
    const messagesEndRef = useRef(null);
    const recognition = useRef(null);

    // Initialize speech recognition
    useEffect(() => {
        if (window.webkitSpeechRecognition) {
            recognition.current = new window.webkitSpeechRecognition();
            recognition.current.continuous = false;
            recognition.current.interimResults = false;

            recognition.current.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                setInput(transcript);
                setIsListening(false);
            };

            recognition.current.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                setIsListening(false);
            };
        }
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const startListening = () => {
        if (recognition.current) {
            recognition.current.start();
            setIsListening(true);
        }
    };

    const stopListening = () => {
        if (recognition.current) {
            recognition.current.stop();
            setIsListening(false);
        }
    };

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = { type: 'user', content: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsProcessing(true);

        try {
            // Prepare context for the chat
            const context = {
                ...conversationContext,
                currentStep: determineCurrentStep(conversationContext),
                previousMessages: messages
            };

            // Call the Firebase function for chat
            const response = await fetch('https://us-central1-solushipx.cloudfunctions.net/chatWithGemini', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: input,
                    context: context
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to get chat response: ${response.status}`);
            }

            // Create a reader for the streaming response
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let botResponse = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                // Process the stream data
                const chunk = decoder.decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(5));

                            if (!data.success) {
                                throw new Error(data.message || 'Chat failed');
                            }

                            if (data.chunk) {
                                // Append the new chunk to the existing response
                                botResponse += data.chunk;
                                // Update the message in real-time
                                setMessages(prev => {
                                    const newMessages = [...prev];
                                    const lastMessage = newMessages[newMessages.length - 1];
                                    if (lastMessage && lastMessage.type === 'bot') {
                                        lastMessage.content = botResponse;
                                    } else {
                                        newMessages.push({ type: 'bot', content: botResponse });
                                    }
                                    return newMessages;
                                });
                            }
                        } catch (e) {
                            console.error('Error parsing chunk:', e);
                        }
                    }
                }
            }

            // Update conversation context based on the response
            const updatedContext = updateContextFromResponse(botResponse, conversationContext);
            setConversationContext(updatedContext);

            // If shipment is complete, notify parent
            if (updatedContext.selectedRate) {
                onShipmentComplete(updatedContext);
            }
        } catch (error) {
            console.error('Error processing message:', error);
            setMessages(prev => [...prev, {
                type: 'error',
                content: 'Sorry, I encountered an error. Please try again.'
            }]);
        } finally {
            setIsProcessing(false);
        }
    };

    const determineCurrentStep = (context) => {
        if (!context.origin) return 'origin';
        if (!context.destination) return 'destination';
        if (!context.packageDetails) return 'package';
        if (!context.selectedRate) return 'rates';
        return 'complete';
    };

    const updateContextFromResponse = (response, currentContext) => {
        // Parse the response to extract relevant information
        // This is a simplified version - you'll need to implement proper parsing
        const updatedContext = { ...currentContext };

        // Example parsing logic (you'll need to implement proper parsing based on your needs)
        if (response.includes('origin:')) {
            updatedContext.origin = extractValue(response, 'origin:');
        }
        if (response.includes('destination:')) {
            updatedContext.destination = extractValue(response, 'destination:');
        }
        // Add more parsing logic for other fields

        return updatedContext;
    };

    const extractValue = (text, key) => {
        const match = text.match(new RegExp(`${key}\\s*([^\\n]+)`));
        return match ? match[1].trim() : null;
    };

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
                    <IconButton
                        onClick={() => setIsOpen(true)}
                        sx={{
                            bgcolor: 'primary.main',
                            color: 'white',
                            p: 2,
                            '&:hover': {
                                bgcolor: 'primary.dark'
                            }
                        }}
                    >
                        <Send />
                    </IconButton>
                </motion.div>
            ) : (
                <motion.div
                    initial={{ y: 100, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 100, opacity: 0 }}
                    style={{
                        position: 'fixed',
                        bottom: '16px',
                        right: '16px',
                        width: '384px',
                        height: '600px',
                        zIndex: 1000
                    }}
                >
                    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                        {/* Chat Header */}
                        <Box sx={{ p: 2, bgcolor: 'primary.main', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="h6">AirmaticBot</Typography>
                            <IconButton onClick={() => setIsOpen(false)} sx={{ color: 'white' }}>
                                <Close />
                            </IconButton>
                        </Box>

                        {/* Chat Messages */}
                        <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
                            {apiKeyError && (
                                <Box sx={{ mb: 2, p: 2, bgcolor: 'error.light', color: 'error.contrastText', borderRadius: 1 }}>
                                    <Typography variant="body2">{apiKeyError}</Typography>
                                </Box>
                            )}
                            {messages.map((message, index) => (
                                <Box
                                    key={index}
                                    sx={{
                                        mb: 2,
                                        display: 'flex',
                                        justifyContent: message.type === 'user' ? 'flex-end' : 'flex-start'
                                    }}
                                >
                                    <Paper
                                        sx={{
                                            p: 1.5,
                                            bgcolor: message.type === 'user' ? 'primary.main' : 'grey.100',
                                            color: message.type === 'user' ? 'white' : 'text.primary',
                                            maxWidth: '80%'
                                        }}
                                    >
                                        <Typography>{message.content}</Typography>
                                    </Paper>
                                </Box>
                            ))}
                            {isProcessing && (
                                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                                    <CircularProgress size={24} />
                                </Box>
                            )}
                            <div ref={messagesEndRef} />
                        </Box>

                        {/* Input Area */}
                        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                                <IconButton
                                    onClick={isListening ? stopListening : startListening}
                                    color={isListening ? 'error' : 'default'}
                                >
                                    {isListening ? <MicOff /> : <Mic />}
                                </IconButton>
                                <input
                                    type="text"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                                    style={{
                                        flex: 1,
                                        padding: '8px',
                                        border: '1px solid #ccc',
                                        borderRadius: '4px',
                                        outline: 'none'
                                    }}
                                    placeholder="Type your message..."
                                />
                                <IconButton
                                    onClick={handleSend}
                                    disabled={!input.trim() || isProcessing}
                                    color="primary"
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