import React from 'react';
import { Box, Paper, Typography, Avatar } from '@mui/material';
import { styled } from '@mui/material/styles';
import { motion } from 'framer-motion';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';

const MessagePaper = styled(Paper)(({ theme, isUser }) => ({
    padding: theme.spacing(2),
    borderRadius: 20,
    maxWidth: '80%',
    background: isUser ? 'linear-gradient(45deg, #6B46C1, #805AD5)' : 'white',
    color: isUser ? 'white' : 'inherit',
    boxShadow: isUser
        ? '0 4px 20px rgba(107, 70, 193, 0.2)'
        : '0 2px 12px rgba(0,0,0,0.05)',
    marginLeft: isUser ? 'auto' : 0,
    marginRight: isUser ? 0 : 'auto',
    position: 'relative',
    '&::before': {
        content: '""',
        position: 'absolute',
        width: 0,
        height: 0,
        borderStyle: 'solid',
        borderWidth: '8px 10px',
        borderColor: 'transparent',
        [isUser ? 'right' : 'left']: -8,
        bottom: 12,
        borderRightColor: isUser ? 'transparent' : 'white',
        borderLeftColor: isUser ? '#6B46C1' : 'transparent',
        transform: isUser ? 'scaleX(-1)' : 'none',
    },
}));

const MessageContainer = styled(Box)(({ theme }) => ({
    display: 'flex',
    gap: theme.spacing(2),
    marginBottom: theme.spacing(3),
    alignItems: 'flex-end',
}));

const Message = ({ message, isUser }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
        >
            <MessageContainer>
                {!isUser && (
                    <Avatar
                        sx={{
                            background: 'linear-gradient(45deg, #6B46C1, #805AD5)',
                            width: 36,
                            height: 36,
                        }}
                    >
                        <SmartToyIcon sx={{ fontSize: 20 }} />
                    </Avatar>
                )}
                <MessagePaper isUser={isUser}>
                    <Typography variant="body1">
                        {message}
                    </Typography>
                </MessagePaper>
                {isUser && (
                    <Avatar
                        sx={{
                            bgcolor: 'primary.light',
                            width: 36,
                            height: 36,
                        }}
                    >
                        <PersonIcon sx={{ fontSize: 20 }} />
                    </Avatar>
                )}
            </MessageContainer>
        </motion.div>
    );
};

export default Message; 