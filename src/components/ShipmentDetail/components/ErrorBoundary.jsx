import React from 'react';
import { Box, Typography, Button } from '@mui/material';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ShipmentDetail ErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <Box sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: '#fff3f3',
                    border: '1px solid #ffcdd2'
                }}>
                    <Typography color="error" variant="subtitle2" gutterBottom>
                        Something went wrong loading this component
                    </Typography>
                    <Button
                        size="small"
                        variant="outlined"
                        color="error"
                        onClick={() => window.location.reload()}
                    >
                        Reload Page
                    </Button>
                </Box>
            );
        }
        return this.props.children;
    }
} 