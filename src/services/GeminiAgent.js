import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';

class GeminiAgent {
    constructor() {
        const functions = getFunctions();
        this.chatWithGemini = httpsCallable(functions, 'chatWithGemini');
        this.auth = getAuth();
        this.context = {
            fromAddress: {},
            toAddress: {},
            items: [{}],
            rates: [],
            selectedRate: null,
            currentStep: 'initial',
            preferences: {
                priority: 'balanced', // 'speed', 'price', or 'balanced'
                insurance: false,
                specialHandling: false
            }
        };
    }

    async processMessage(message, previousMessages = []) {
        try {
            // Get the current user's ID token
            const currentUser = this.auth.currentUser;
            if (!currentUser) {
                throw new Error('User not authenticated. Please sign in to use the chat.');
            }
            
            // Format the message object properly
            const formattedMessage = typeof message === 'string' 
                ? { content: message } 
                : message;
            
            // Format previous messages
            const formattedPreviousMessages = previousMessages.map(msg => {
                if (typeof msg === 'string') {
                    return { role: 'user', content: msg };
                }
                return msg;
            });
            
            // Call the Firebase Cloud Function
            const response = await this.chatWithGemini({
                message: formattedMessage,
                userContext: this.context,
                previousMessages: formattedPreviousMessages
            });

            // Update context with any collected information and current step
            this.updateContext(
                response.data.collectedInfo || {},
                response.data.currentStep
            );

            return {
                message: response.data.message,
                collectedInfo: response.data.collectedInfo || {},
                suggestedActions: response.data.suggestedActions || [],
                currentStep: response.data.currentStep
            };
        } catch (error) {
            console.error('Error processing message:', error);
            throw new Error('Failed to process message. Please try again.');
        }
    }

    async fetchRates() {
        if (!this.hasRequiredShipmentInfo()) {
            throw new Error('Incomplete shipment information. Please provide origin, destination and package details.');
        }
        
        try {
            // Format the request data
            const requestData = {
                fromAddress: this.context.fromAddress,
                toAddress: this.context.toAddress,
                items: this.context.items,
                shipmentType: this.context.shipmentType || 'freight',
                shipmentDate: new Date().toISOString().split('T')[0],
                pickupWindow: {
                    earliest: '09:00', 
                    latest: '17:00'
                },
                deliveryWindow: {
                    earliest: '09:00',
                    latest: '17:00'
                },
                bookingReferenceNumber: `SX-${Date.now()}`,
                bookingReferenceNumberType: 'BOL',
                shipmentBillType: this.context.shipmentType === 'freight' ? 'Freight' : 'Parcel'
            };
            
            // Call your rates API
            const response = await fetch('/api/rates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });
            
            if (!response.ok) {
                throw new Error(`Rate request failed with status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.success && data.data && data.data.availableRates) {
                // Update context with rates
                this.context.rates = data.data.availableRates;
                this.context.currentStep = 'rate-selection';
                return data.data.availableRates;
            } else {
                throw new Error(data.error?.message || 'No rates available');
            }
        } catch (error) {
            console.error('Error fetching rates:', error);
            throw error;
        }
    }

    hasRequiredShipmentInfo() {
        const { fromAddress, toAddress, items } = this.context;
        
        // Check for required address fields
        const requiredAddressFields = ['company', 'street', 'city', 'state', 'postalCode', 'contactName', 'contactPhone'];
        const hasFromAddress = requiredAddressFields.every(field => fromAddress && fromAddress[field]);
        const hasToAddress = requiredAddressFields.every(field => toAddress && toAddress[field]);
        
        // Check for required item fields
        const hasItems = items && items.length > 0 && items.every(item => 
            item.weight && item.length && item.width && item.height
        );
        
        return hasFromAddress && hasToAddress && hasItems;
    }

    sortRatesByPreference(rates) {
        const { priority } = this.context.preferences;
        
        return [...rates].sort((a, b) => {
            switch (priority) {
                case 'speed':
                    return a.transitTime - b.transitTime;
                case 'price':
                    return a.totalCharges - b.totalCharges;
                case 'balanced':
                default:
                    // Combine price and speed into a single score
                    const scoreA = (a.totalCharges / 100) + (a.transitTime * 2);
                    const scoreB = (b.totalCharges / 100) + (b.transitTime * 2);
                    return scoreA - scoreB;
            }
        });
    }

    selectRate(rateIndex) {
        if (!this.context.rates || this.context.rates.length === 0) {
            throw new Error('No rates available to select');
        }
        
        if (rateIndex < 0 || rateIndex >= this.context.rates.length) {
            throw new Error(`Invalid rate index: ${rateIndex}. Available rates: ${this.context.rates.length}`);
        }
        
        this.context.selectedRate = this.context.rates[rateIndex];
        this.context.currentStep = 'review';
        return this.context.selectedRate;
    }

    updateContext(collectedInfo, currentStep) {
        // Update address information
        if (collectedInfo.fromAddress) {
            this.context.fromAddress = {
                ...this.context.fromAddress, 
                ...collectedInfo.fromAddress
            };
        }
        
        if (collectedInfo.toAddress) {
            this.context.toAddress = {
                ...this.context.toAddress, 
                ...collectedInfo.toAddress
            };
        }
        
        // Update package/item information
        if (collectedInfo.items && collectedInfo.items.length > 0) {
            this.context.items = collectedInfo.items.map((item, index) => {
                // If there's an existing item at this index, merge with it
                if (this.context.items[index]) {
                    return { ...this.context.items[index], ...item };
                }
                return item;
            });
        }
        
        // Update rates if provided
        if (collectedInfo.rates) {
            this.context.rates = collectedInfo.rates;
        }
        
        // Update selected rate if provided
        if (collectedInfo.selectedRate) {
            this.context.selectedRate = collectedInfo.selectedRate;
        }
        
        // Update shipment type if provided
        if (collectedInfo.shipmentType) {
            this.context.shipmentType = collectedInfo.shipmentType;
        }
        
        // Update current step if provided
        if (currentStep) {
            this.context.currentStep = currentStep;
        }
    }

    getFormattedShipmentData() {
        return {
            fromAddress: this.context.fromAddress,
            toAddress: this.context.toAddress,
            items: this.context.items,
            selectedRate: this.context.selectedRate,
            shipmentType: this.context.shipmentType || 'freight',
            preferences: this.context.preferences
        };
    }

    resetContext() {
        this.context = {
            fromAddress: {},
            toAddress: {},
            items: [{}],
            rates: [],
            selectedRate: null,
            currentStep: 'initial',
            preferences: {
                priority: 'balanced',
                insurance: false,
                specialHandling: false
            }
        };
    }
}

export default GeminiAgent; 