import React, { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import AIButton from './components/AI/AIButton';
import AIExperience from './components/AI/AIExperience';
// ... existing imports ...

const theme = createTheme({
    palette: {
        primary: {
            main: '#6B46C1',
            light: '#805AD5',
        },
        background: {
            default: '#F7FAFC',
        },
    },
    typography: {
        fontFamily: '"Inter", "Helvetica", "Arial", sans-serif',
    },
    components: {
        MuiButton: {
            styleOverrides: {
                root: {
                    borderRadius: 8,
                    textTransform: 'none',
                },
            },
        },
    },
});

function App() {
    const [isAIOpen, setIsAIOpen] = useState(false);
    // ... existing state ...

    const handleSendMessage = (message) => {
        // Handle sending message to AI
        console.log('Sending message:', message);
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            {/* Existing app content */}

            {/* AI Experience */}
            <AIButton onClick={() => setIsAIOpen(true)} />
            <AIExperience
                open={isAIOpen}
                onClose={() => setIsAIOpen(false)}
                onSend={handleSendMessage}
            />
        </ThemeProvider>
    );
}

export default App; 