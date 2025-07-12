import React from 'react';
import { Box, Typography, Button, Container, Alert } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import RefreshIcon from '@mui/icons-material/Refresh';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            isChunkError: false,
            retryCount: 0
        };
    }

    static getDerivedStateFromError(error) {
        // Check if this is a chunk loading error
        const isChunkError = error?.name === 'ChunkLoadError' ||
            error?.message?.includes('Loading chunk') ||
            error?.message?.includes('chunk');

        return {
            hasError: true,
            error,
            isChunkError
        };
    }

    componentDidCatch(error, errorInfo) {
        // Log error to error reporting service
        console.error('Error caught by boundary:', error, errorInfo);

        // Auto-retry for chunk loading errors (max 2 times)
        if (this.state.isChunkError && this.state.retryCount < 2) {
            console.log(`Auto-retrying chunk load (attempt ${this.state.retryCount + 1}/2)`);
            setTimeout(() => {
                this.setState(prevState => ({
                    hasError: false,
                    error: null,
                    retryCount: prevState.retryCount + 1
                }));
            }, 1000);
        }
    }

    handleRefresh = () => {
        // Clear cache and reload
        if ('caches' in window) {
            caches.keys().then(names => {
                names.forEach(name => caches.delete(name));
            }).then(() => {
                window.location.reload(true);
            });
        } else {
            window.location.reload(true);
        }
    }

    render() {
        if (this.state.hasError) {
            const { isChunkError, retryCount } = this.state;

            return (
                <Container maxWidth="sm">
                    <Box
                        sx={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minHeight: '100vh',
                            textAlign: 'center',
                            p: 3
                        }}
                    >
                        <ErrorOutlineIcon sx={{ fontSize: 60, color: 'error.main', mb: 2 }} />

                        {isChunkError ? (
                            <>
                                <Typography variant="h4" component="h1" gutterBottom>
                                    Loading Issue Detected
                                </Typography>
                                <Typography variant="body1" color="text.secondary" paragraph>
                                    We detected a loading issue, likely due to a recent update.
                                    {retryCount > 0 && ` We've tried ${retryCount} time(s) to recover automatically.`}
                                </Typography>

                                {retryCount >= 2 && (
                                    <Alert severity="info" sx={{ mb: 2, maxWidth: '400px' }}>
                                        This usually happens when the app was updated while you were using it.
                                        A refresh will load the latest version.
                                    </Alert>
                                )}

                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={this.handleRefresh}
                                    startIcon={<RefreshIcon />}
                                    sx={{ mt: 2 }}
                                >
                                    Clear Cache & Refresh
                                </Button>
                            </>
                        ) : (
                            <>
                                <Typography variant="h4" component="h1" gutterBottom>
                                    Oops! Something went wrong
                                </Typography>
                                <Typography variant="body1" color="text.secondary" paragraph>
                                    We're sorry, but there was an error loading this page. Please try refreshing or contact support if the problem persists.
                                </Typography>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={this.handleRefresh}
                                    startIcon={<RefreshIcon />}
                                    sx={{ mt: 2 }}
                                >
                                    Refresh Page
                                </Button>
                            </>
                        )}
                    </Box>
                </Container>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary; 