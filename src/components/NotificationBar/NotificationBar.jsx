import React, { useState, useEffect } from 'react';
import { Box, Typography, IconButton, Collapse } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

const NotificationBar = () => {
    const [open, setOpen] = useState(true);

    // Example notification content - in a real app, this could come from props or an API
    const notification = {
        text: "Free shipping on orders over $500! Use code FREESHIP at checkout.",
        link: "/promotions",
        linkText: "Learn More"
    };

    const handleClose = () => {
        setOpen(false);
    };

    return (
        <Collapse in={open}>
            <Box
                sx={{
                    bgcolor: '#000000',
                    color: '#ffffff',
                    py: 1,
                    px: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    width: '100%'
                }}
            >
                <Typography
                    variant="body2"
                    sx={{
                        textAlign: 'center',
                        flex: 1,
                        mr: 4,
                        fontWeight: 500
                    }}
                >
                    {notification.text}
                    {notification.link && (
                        <a
                            href={notification.link}
                            style={{
                                color: '#2C6ECB',
                                textDecoration: 'none',
                                marginLeft: '8px',
                                fontWeight: 600
                            }}
                            onMouseEnter={(e) => e.target.style.textDecoration = 'underline'}
                            onMouseLeave={(e) => e.target.style.textDecoration = 'none'}
                        >
                            {notification.linkText}
                        </a>
                    )}
                </Typography>
                <IconButton
                    size="small"
                    onClick={handleClose}
                    sx={{
                        color: '#ffffff',
                        position: 'absolute',
                        right: 8,
                        '&:hover': {
                            color: '#2C6ECB'
                        }
                    }}
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Box>
        </Collapse>
    );
};

export default NotificationBar; 