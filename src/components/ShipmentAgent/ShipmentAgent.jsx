// Updated ShipmentAgent Component using Gemini Function Calling
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';
import { getDoc, doc, collection, getDocs } from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import './ShipmentAgent.css';
import { tools } from './functionDeclarations';

const ShipmentAgent = ({
    companyId: companyIdProp,
    inModal = false,
    isPanelOpen: externalPanelState,
    setIsPanelOpen: setExternalPanelState
}) => {
    const { currentUser } = useAuth();
    const [initialized, setInitialized] = useState(false);
    const [messages, setMessages] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [failedMessage, setFailedMessage] = useState(null);
    const [internalPanelOpen, setInternalPanelOpen] = useState(false);
    const chatRef = useRef(null);
    const chatContainerRef = useRef(null);
    const inputRef = useRef(null);
    const endOfMessagesRef = useRef(null);

    // Use either external or internal panel state
    const isPanelOpen = externalPanelState !== undefined ? externalPanelState : internalPanelOpen;
    const setIsPanelOpen = setExternalPanelState || setInternalPanelOpen;

    // Force panel to always be open when in modal mode
    useEffect(() => {
        if (inModal) {
            setIsPanelOpen(true);
        }
    }, [inModal, setIsPanelOpen]);

    const availableFunctions = useMemo(() => ({
        getCompany: async ({ companyId }) => {
            if (!companyId) return { error: 'Missing companyId' };
            try {
                const docRef = doc(db, 'companies', companyId);
                const snap = await getDoc(docRef);
                return snap.exists() ? { result: snap.data() } : { error: 'Company not found' };
            } catch (e) {
                return { error: e.message };
            }
        },
        listShippingOrigins: async ({ companyId }) => {
            if (!companyId) return { error: 'Missing companyId' };
            try {
                const colRef = collection(db, 'companies', companyId, 'shippingOrigins');
                const snapshot = await getDocs(colRef);
                return {
                    result: snapshot.docs.map(d => ({ id: d.id, ...d.data() }))
                };
            } catch (e) {
                return { error: e.message };
            }
        },
        createShipment: async (data) => {
            try {
                const fn = httpsCallable(getFunctions(), 'createShipment');
                const res = await fn(data);
                return { result: res.data };
            } catch (e) {
                return { error: e.message };
            }
        },
    }), []);

    const handleFunctionCall = useCallback(async ({ name, args }) => {
        const fn = availableFunctions[name];
        if (!fn) return { error: `Unknown function: ${name}` };
        const parsedArgs = typeof args === 'string' ? JSON.parse(args) : args;
        return await fn(parsedArgs);
    }, [availableFunctions]);

    const initChat = useCallback(async () => {
        if (!companyIdProp || !currentUser?.uid) return;

        const genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({
            model: 'gemini-1.5-flash',
            tools,
            safetySettings: [
                { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
                { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE },
            ]
        });

        const chat = await model.startChat({
            systemInstruction: {
                role: 'system',
                parts: [{
                    text: `You are a shipping assistant for a company with ID "${companyIdProp}". 
                    Always use the following functions when appropriate:
                    - Use 'getCompany' when asked about company information, addresses, zip codes, contact info, or any company details
                    - Use 'listShippingOrigins' when asked about shipping origins, shipping addresses, or where the company ships from
                    - Use 'createShipment' when a user explicitly wants to create a new shipment
                    
                    Always include the companyId "${companyIdProp}" in function calls. Don't hallucinate responses
                    for information that should be retrieved from functions.
                    
                    When you receive function results, interpret and summarize the data appropriately to answer 
                    the user's original question clearly and conversationally. Format complex information like addresses
                    and contact details in a readable way. Respond to questions about zip codes, phones, addresses, etc.
                    by finding and extracting the relevant information from the function responses.`
                }]
            },
            tools
        });

        chatRef.current = chat;
        setInitialized(true);
        setMessages([{
            role: 'agent', content: "Hi! I'm your shipping assistant. How can I help today?"
        }]);
    }, [companyIdProp, currentUser]);

    const sendMessage = useCallback(async (msg) => {
        if (!msg.trim() || !chatRef.current) return;

        setMessages(prev => [...prev, { role: 'user', content: msg }]);
        setInputValue('');
        setIsLoading(true);

        try {
            const res = await chatRef.current.sendMessage(msg);
            let response = res.response;

            // Log full response for debugging
            console.log("FULL GEMINI RESPONSE:", response);
            try {
                // Log structured version for deeper inspection
                console.log("RESPONSE STRUCTURE:", JSON.stringify({
                    hasText: typeof response.text === 'function',
                    hasFunctionCalls: typeof response.functionCalls === 'function',
                    candidates: response.candidates ? response.candidates.length : 0,
                    rawData: response.candidates || response
                }, null, 2));
            } catch (logError) {
                console.log("Could not stringify response:", logError);
            }

            // Extract and process function calls
            let calls = [];
            if (typeof response.functionCalls === 'function') {
                try {
                    calls = response.functionCalls() || [];
                    console.log("Function calls extracted via method:", calls);
                } catch (fcError) {
                    console.error("Error calling functionCalls() method:", fcError);
                }
            } else if (response.functionCalls) {
                calls = Array.isArray(response.functionCalls) ? response.functionCalls : [];
                console.log("Function calls extracted via property:", calls);
            }

            // Now process calls if we have any
            if (calls && calls.length > 0) {
                const call = calls[0];
                console.log("Processing function call:", call);

                // Safety check on the call object
                if (!call || !call.name) {
                    console.error("Invalid function call format", call);
                    throw new Error("Invalid function call format");
                }

                const args = call.args || {};
                if (!args.companyId) args.companyId = companyIdProp;
                console.log(`Calling function ${call.name} with args:`, args);

                const result = await handleFunctionCall({ name: call.name, args });
                console.log(`Function ${call.name} returned:`, result);

                // Send the raw function result back to Gemini to let it parse and interpret the data
                try {
                    const functionResponseText = JSON.stringify({
                        name: call.name,
                        response: result.error || result.result
                    });
                    console.log("Sending function response:", functionResponseText);

                    // Try a simpler format for function response
                    const followUp = await chatRef.current.sendMessage(functionResponseText);
                    response = followUp.response;
                } catch (functionResponseError) {
                    console.error("Error sending function response:", functionResponseError);
                    throw new Error(`Error processing function response: ${functionResponseError.message}`);
                }
            } else {
                console.log("No function calls detected in response");
            }

            // Get text response - simply extract the text without trying to interpret the structure
            let textResponse = '';
            try {
                if (typeof response.text === 'function') {
                    textResponse = response.text();
                } else if (response.text) {
                    textResponse = response.text;
                } else if (response.candidates && response.candidates[0]?.content?.parts) {
                    // Extract text from candidates if available
                    const parts = response.candidates[0].content.parts;
                    textResponse = parts.map(part => part.text).filter(Boolean).join(' ');
                } else {
                    console.log("Unable to extract text from response:", response);
                    textResponse = "I'm having trouble understanding the data. Please try asking in a different way.";
                }
            } catch (textError) {
                console.error("Error extracting text from response:", textError);
                console.log("Response structure:", response);
                textResponse = "I encountered an issue processing the data. Please try again.";
            }

            setMessages(prev => [...prev, { role: 'agent', content: textResponse }]);
        } catch (e) {
            console.error("Top-level error in sendMessage:", e);
            setError(e.message || "An unknown error occurred");
            setMessages(prev => [...prev, {
                role: 'agent',
                content: "I'm sorry, I encountered a technical issue. Please try again."
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [companyIdProp, handleFunctionCall]);

    useEffect(() => {
        if (!initialized && currentUser?.uid && companyIdProp) {
            initChat();
            // Ensure panel is closed initially on mobile
            const isMobile = window.innerWidth < 768;
            if (isMobile) {
                setIsPanelOpen(false);
            }
        }
    }, [initialized, currentUser, companyIdProp, initChat]);

    // Function to format message content with simple markdown-like syntax
    const formatMessageContent = (content) => {
        if (!content) return '';

        // Bold text
        const withBold = content.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

        // Bullet lists
        const withLists = withBold.replace(/- (.*?)(?:\n|$)/g, '<li>$1</li>').replace(/<li>/g, '<ul><li>').replace(/<\/li>(?!\n*<li>)/g, '</li></ul>');

        // Code formatting
        const withCode = withLists.replace(/`(.*?)`/g, '<code>$1</code>');

        return withCode;
    };

    // Improved auto-scroll to bottom when messages change
    useEffect(() => {
        if (endOfMessagesRef.current) {
            // Add a small delay to ensure all content is rendered before scrolling
            setTimeout(() => {
                endOfMessagesRef.current.scrollIntoView({
                    behavior: 'smooth',
                    block: 'end'
                });
            }, 100);
        }
    }, [messages, isLoading]);

    // Add a manual scroll check whenever the panel is opened
    useEffect(() => {
        if (isPanelOpen && endOfMessagesRef.current) {
            setTimeout(() => {
                endOfMessagesRef.current.scrollIntoView({
                    behavior: 'auto',
                    block: 'end'
                });
            }, 300);
        }
    }, [isPanelOpen]);

    // Handle keyboard shortcuts
    const handleKeyDown = (e) => {
        // Submit on Enter (but not with Shift pressed for multiline)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (inputValue.trim() && !isLoading) {
                sendMessage(inputValue);
            }
        }

        // Auto-resize the textarea
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
        }
    };

    // Function to retry a failed message
    const handleRetry = () => {
        if (failedMessage) {
            setError(null);
            setFailedMessage(null);
            sendMessage(failedMessage);
        }
    };

    // Modified sendMessage to track failed messages
    const sendMessageWithErrorHandling = useCallback(async (msg) => {
        if (!msg.trim() || !chatRef.current) return;

        setMessages(prev => [...prev, {
            role: 'user',
            content: msg,
            timestamp: new Date().toISOString()
        }]);
        setInputValue('');
        setIsLoading(true);
        setError(null);
        setFailedMessage(null);

        try {
            const res = await chatRef.current.sendMessage(msg);
            let response = res.response;

            // Log full response for debugging
            console.log("FULL GEMINI RESPONSE:", response);
            try {
                // Log structured version for deeper inspection
                console.log("RESPONSE STRUCTURE:", JSON.stringify({
                    hasText: typeof response.text === 'function',
                    hasFunctionCalls: typeof response.functionCalls === 'function',
                    candidates: response.candidates ? response.candidates.length : 0,
                    rawData: response.candidates || response
                }, null, 2));
            } catch (logError) {
                console.log("Could not stringify response:", logError);
            }

            // Extract and process function calls
            let calls = [];
            if (typeof response.functionCalls === 'function') {
                try {
                    calls = response.functionCalls() || [];
                    console.log("Function calls extracted via method:", calls);
                } catch (fcError) {
                    console.error("Error calling functionCalls() method:", fcError);
                }
            } else if (response.functionCalls) {
                calls = Array.isArray(response.functionCalls) ? response.functionCalls : [];
                console.log("Function calls extracted via property:", calls);
            }

            // Now process calls if we have any
            if (calls && calls.length > 0) {
                const call = calls[0];
                console.log("Processing function call:", call);

                // Safety check on the call object
                if (!call || !call.name) {
                    console.error("Invalid function call format", call);
                    throw new Error("Invalid function call format");
                }

                const args = call.args || {};
                if (!args.companyId) args.companyId = companyIdProp;
                console.log(`Calling function ${call.name} with args:`, args);

                const result = await handleFunctionCall({ name: call.name, args });
                console.log(`Function ${call.name} returned:`, result);

                // Send the raw function result back to Gemini to let it parse and interpret the data
                try {
                    const functionResponseText = JSON.stringify({
                        name: call.name,
                        response: result.error || result.result
                    });
                    console.log("Sending function response:", functionResponseText);

                    // Try a simpler format for function response
                    const followUp = await chatRef.current.sendMessage(functionResponseText);
                    response = followUp.response;
                } catch (functionResponseError) {
                    console.error("Error sending function response:", functionResponseError);
                    throw new Error(`Error processing function response: ${functionResponseError.message}`);
                }
            } else {
                console.log("No function calls detected in response");
            }

            // Get text response - simply extract the text without trying to interpret the structure
            let textResponse = '';
            try {
                if (typeof response.text === 'function') {
                    textResponse = response.text();
                } else if (response.text) {
                    textResponse = response.text;
                } else if (response.candidates && response.candidates[0]?.content?.parts) {
                    // Extract text from candidates if available
                    const parts = response.candidates[0].content.parts;
                    textResponse = parts.map(part => part.text).filter(Boolean).join(' ');
                } else {
                    console.log("Unable to extract text from response:", response);
                    textResponse = "I'm having trouble understanding the data. Please try asking in a different way.";
                }
            } catch (textError) {
                console.error("Error extracting text from response:", textError);
                console.log("Response structure:", response);
                textResponse = "I encountered an issue processing the data. Please try again.";
            }

            setMessages(prev => [...prev, {
                role: 'agent',
                content: textResponse,
                timestamp: new Date().toISOString()
            }]);
        } catch (e) {
            console.error("Top-level error in sendMessage:", e);
            setError(e.message || "An unknown error occurred");
            setMessages(prev => [...prev, {
                role: 'agent',
                content: "I'm sorry, I encountered a technical issue. Please try again.",
                timestamp: new Date().toISOString(),
                error: true
            }]);
            setFailedMessage(msg);
        } finally {
            setIsLoading(false);
        }
    }, [companyIdProp, handleFunctionCall]);

    // Auto-resize input on mount and when value changes
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.style.height = 'auto';
            inputRef.current.style.height = `${Math.min(inputRef.current.scrollHeight, 120)}px`;
        }
    }, [inputValue]);

    // Toggle panel open/closed
    const togglePanel = () => {
        setIsPanelOpen(!isPanelOpen);
        // Auto focus the input when opening
        setTimeout(() => {
            if (!isPanelOpen && inputRef.current) {
                inputRef.current.focus();
            }
        }, 300);
    };

    // Close panel (separate function for clarity)
    const closePanel = () => {
        setIsPanelOpen(false);
    };

    return (
        <>
            {/* Toggle button - only show when not in modal */}
            {!inModal && (
                <button
                    className="shipment-agent-toggle"
                    onClick={togglePanel}
                    aria-label="Toggle shipping assistant"
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16Z" fill="currentColor" />
                        <path d="M7 9H17V11H7V9ZM7 12H14V14H7V12ZM7 6H17V8H7V6Z" fill="currentColor" />
                    </svg>
                </button>
            )}

            {/* Background overlay (for mobile) - only show when not in modal */}
            {!inModal && (
                <div
                    className={`shipment-agent-overlay ${isPanelOpen ? 'open' : ''}`}
                    onClick={closePanel}
                ></div>
            )}

            {/* Chat panel - always use full width/height when in modal */}
            <div className={`shipment-agent-container ${isPanelOpen || inModal ? 'open' : ''} ${inModal ? 'in-modal' : ''}`}>
                <div className="shipment-agent-header">
                    <div className="agent-avatar">
                        <span>AI</span>
                    </div>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '16px' }}>Shipping Assistant</h3>
                        <span style={{ fontSize: '12px', opacity: 0.8 }}>Online</span>
                    </div>
                    <div className="header-controls">
                        <div className="agent-status">
                            {isLoading ? 'Thinking...' : 'Ready to help'}
                        </div>
                        <button className="close-button" onClick={inModal ? closePanel : togglePanel} aria-label="Close assistant">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M19 6.41L17.59 5L12 10.59L6.41 5L5 6.41L10.59 12L5 17.59L6.41 19L12 13.41L17.59 19L19 17.59L13.41 12L19 6.41Z" fill="currentColor" />
                            </svg>
                        </button>
                    </div>
                </div>

                <div className="shipment-agent-chat" ref={chatContainerRef}>
                    {messages.map((m, i) => (
                        <div key={i} className={`message ${m.role}`}>
                            {m.role === 'agent' && (
                                <div className="avatar">AI</div>
                            )}
                            <div className="message-wrapper">
                                <div
                                    className={`message-content ${m.error ? 'error' : ''} formatted`}
                                    dangerouslySetInnerHTML={{ __html: formatMessageContent(m.content) }}
                                />
                                {m.timestamp && (
                                    <div className="message-timestamp">
                                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                )}
                                {m.error && (
                                    <button className="retry-button" onClick={handleRetry}>
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                            <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4C7.58 4 4.01 7.58 4.01 12C4.01 16.42 7.58 20 12 20C15.73 20 18.84 17.45 19.73 14H17.65C16.83 16.33 14.61 18 12 18C8.69 18 6 15.31 6 12C6 8.69 8.69 6 12 6C13.66 6 15.14 6.69 16.22 7.78L13 11H20V4L17.65 6.35Z" fill="currentColor" />
                                        </svg>
                                        Retry
                                    </button>
                                )}
                            </div>
                            {m.role === 'user' && (
                                <div className="avatar">You</div>
                            )}
                        </div>
                    ))}

                    {isLoading && (
                        <div className="message agent">
                            <div className="avatar">AI</div>
                            <div className="typing-indicator">
                                <div className="typing-dot"></div>
                                <div className="typing-dot"></div>
                                <div className="typing-dot"></div>
                            </div>
                        </div>
                    )}

                    <div style={{ height: '20px' }}></div> {/* Spacer to ensure messages don't get cut off */}
                    <div ref={endOfMessagesRef} />
                </div>

                {/* Always show input form at bottom */}
                <form
                    className="shipment-agent-input"
                    onSubmit={e => {
                        e.preventDefault();
                        if (inputValue.trim() && !isLoading) {
                            sendMessageWithErrorHandling(inputValue);
                        }
                    }}
                >
                    {error && (
                        <div className="error-message">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 20C7.59 20 4 16.41 4 12C4 7.59 7.59 4 12 4C16.41 4 20 7.59 20 12C20 16.41 16.41 20 12 20ZM11 15H13V17H11V15ZM11 7H13V13H11V7Z" fill="currentColor" />
                            </svg>
                            {error}
                        </div>
                    )}

                    <div style={{ display: 'flex', width: '100%', alignItems: 'flex-end' }}>
                        <div className="input-container">
                            <textarea
                                ref={inputRef}
                                className="chat-input"
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                disabled={isLoading}
                                placeholder="Type a message..."
                                rows="1"
                            />
                            {inputValue.length > 0 && (
                                <div className="shortcuts-hint">
                                    Enter to send, Shift+Enter for new line
                                </div>
                            )}
                        </div>

                        <button
                            type="submit"
                            className="send-button"
                            disabled={isLoading || !inputValue.trim()}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M2.01 21L23 12 2.01 3 2 10L17 12 2 14L2.01 21Z" fill="currentColor" />
                            </svg>
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};

export default ShipmentAgent;
