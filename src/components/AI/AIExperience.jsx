import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Box,
    Typography,
    IconButton,
    TextField,
    Paper,
    Fade,
    Chip,
    Avatar
} from '@mui/material';
import { styled } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import CloseIcon from '@mui/icons-material/Close';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import { useTheme } from '@mui/material/styles';
import ShipmentVisualizer from './ShipmentVisualizer';

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

const SuggestionChip = styled(Chip)(({ theme }) => ({
    margin: theme.spacing(0.5),
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
    '&:hover': {
        backgroundColor: theme.palette.primary.main,
        color: '#fff',
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
    const [suggestions] = useState([
        'Create a new shipment',
        'Track my package',
        'Get shipping rates',
        'Schedule a pickup'
    ]);
    const theme = useTheme();
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = () => {
        if (message.trim()) {
            onSend(message);
            setMessage('');
        }
    };

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
                        gap: 3
                    }}>
                        {/* Chat and Input Area */}
                        <Box sx={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            height: '100%'
                        }}>
                            {/* Messages Area */}
                            <Box sx={{
                                flexGrow: 1,
                                mb: 2,
                                overflowY: 'auto',
                                px: 2,
                                display: 'flex',
                                flexDirection: 'column'
                            }}>
                                {messages.length === 0 ? (
                                    <Box sx={{ textAlign: 'center', mt: 4 }}>
                                        <Typography variant="h6" color="text.secondary" gutterBottom>
                                            Welcome to SolushipX!
                                        </Typography>
                                        <Typography variant="body1" color="text.secondary">
                                            I'm here to help you with your shipping needs. What would you like to do?
                                        </Typography>
                                    </Box>
                                ) : (
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

                            {/* Suggestions */}
                            <Box sx={{ mb: 2 }}>
                                <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
                                    Suggested Actions
                                </Typography>
                                <Box sx={{ display: 'flex', flexWrap: 'wrap' }}>
                                    {suggestions.map((suggestion, index) => (
                                        <SuggestionChip
                                            key={index}
                                            label={suggestion}
                                            onClick={() => onSend(suggestion)}
                                            clickable
                                        />
                                    ))}
                                </Box>
                            </Box>

                            {/* Input Area */}
                            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <MessageInput
                                    fullWidth
                                    placeholder="Ask anything about shipping..."
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

                        {/* Shipment Visualization Area */}
                        <Box sx={{
                            width: '40%',
                            display: { xs: 'none', md: 'block' }
                        }}>
                            <ShipmentVisualizer />
                        </Box>
                    </Box>
                </StyledPaper>
            )}
        </AnimatePresence>
    );
};

export default AIExperience; 