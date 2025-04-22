import { getFunctions, httpsCallable } from 'firebase/functions';
import { getAuth } from 'firebase/auth';

class GeminiAgent {
    constructor() {
        const functions = getFunctions();
        this.chatWithGemini = httpsCallable(functions, 'chatWithGemini');
        this.auth = getAuth();
        this.context = {
            // Initialize the shipment data structure
            shipmentData: {
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
            },
            currentStep: 'intro'
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
            
            // Process the message locally without complex logic
            this.updateShipmentData(message);
            
            // Call the Firebase Cloud Function (simplified logic)
            const response = await this.chatWithGemini({
                message: formattedMessage,
                userContext: this.context,
                previousMessages: formattedPreviousMessages
            });

            // Make sure we're using the response structure correctly
            return {
                message: response.data.message || { content: "I didn't understand that. Could you please try again?" },
                collectedInfo: this.context.shipmentData,
                currentStep: this.context.currentStep
            };
        } catch (error) {
            console.error('Error processing message:', error);
            throw new Error('Failed to process message. Please try again.');
        }
    }

    // Simple function to update shipment data based on the current step
    updateShipmentData(userMessage) {
        const msg = typeof userMessage === 'string' ? userMessage : userMessage.content;
        const { currentStep, shipmentData } = this.context;
        
        switch(currentStep) {
            case 'intro':
                this.context.currentStep = 'fromCompany';
                break;
                
            case 'fromCompany':
                this.context.shipmentData.fromAddress.company = msg;
                this.context.currentStep = 'fromStreet';
                break;
                
            case 'fromStreet':
                this.context.shipmentData.fromAddress.street = msg;
                this.context.currentStep = 'fromCity';
                break;
                
            case 'fromCity':
                this.context.shipmentData.fromAddress.city = msg;
                this.context.currentStep = 'fromState';
                break;
                
            case 'fromState':
                this.context.shipmentData.fromAddress.state = msg;
                this.context.currentStep = 'fromPostalCode';
                break;
                
            case 'fromPostalCode':
                this.context.shipmentData.fromAddress.postalCode = msg;
                this.context.currentStep = 'fromContactName';
                break;
                
            case 'fromContactName':
                this.context.shipmentData.fromAddress.contactName = msg;
                this.context.currentStep = 'fromContactPhone';
                break;
                
            case 'fromContactPhone':
                this.context.shipmentData.fromAddress.contactPhone = msg;
                this.context.currentStep = 'fromContactEmail';
                break;
                
            case 'fromContactEmail':
                this.context.shipmentData.fromAddress.contactEmail = msg;
                this.context.currentStep = 'toCompany';
                break;
                
            case 'toCompany':
                this.context.shipmentData.toAddress.company = msg;
                this.context.currentStep = 'toStreet';
                break;
                
            case 'toStreet':
                this.context.shipmentData.toAddress.street = msg;
                this.context.currentStep = 'toCity';
                break;
                
            case 'toCity':
                this.context.shipmentData.toAddress.city = msg;
                this.context.currentStep = 'toState';
                break;
                
            case 'toState':
                this.context.shipmentData.toAddress.state = msg;
                this.context.currentStep = 'toPostalCode';
                break;
                
            case 'toPostalCode':
                this.context.shipmentData.toAddress.postalCode = msg;
                this.context.currentStep = 'toContactName';
                break;
                
            case 'toContactName':
                this.context.shipmentData.toAddress.contactName = msg;
                this.context.currentStep = 'toContactPhone';
                break;
                
            case 'toContactPhone':
                this.context.shipmentData.toAddress.contactPhone = msg;
                this.context.currentStep = 'toContactEmail';
                break;
                
            case 'toContactEmail':
                this.context.shipmentData.toAddress.contactEmail = msg;
                this.context.currentStep = 'packageWeight';
                break;
                
            case 'packageWeight':
                const weight = parseFloat(msg.replace(/[^0-9.]/g, ''));
                if (!isNaN(weight)) {
                    this.context.shipmentData.items[0].weight = weight;
                }
                this.context.currentStep = 'packageDimensions';
                break;
                
            case 'packageDimensions':
                const dimensions = msg.match(/(\d+)[^\d]+(\d+)[^\d]+(\d+)/);
                if (dimensions && dimensions.length >= 4) {
                    this.context.shipmentData.items[0].length = parseInt(dimensions[1]);
                    this.context.shipmentData.items[0].width = parseInt(dimensions[2]);
                    this.context.shipmentData.items[0].height = parseInt(dimensions[3]);
                }
                this.context.currentStep = 'packageQuantity';
                break;
                
            case 'packageQuantity':
                const quantity = parseInt(msg.replace(/[^0-9]/g, ''));
                if (!isNaN(quantity)) {
                    this.context.shipmentData.items[0].quantity = quantity;
                }
                this.context.currentStep = 'packageValue';
                break;
                
            case 'packageValue':
                const value = parseFloat(msg.replace(/[^0-9.]/g, ''));
                if (!isNaN(value)) {
                    this.context.shipmentData.items[0].value = value;
                }
                this.context.currentStep = 'complete';
                break;
                
            case 'complete':
                // Data collection is complete
                break;
                
            default:
                this.context.currentStep = 'intro';
        }
    }

    getFormattedShipmentData() {
        return this.context.shipmentData;
    }

    resetContext() {
        this.context = {
            shipmentData: {
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
            },
            currentStep: 'intro'
        };
    }
}

export default GeminiAgent; 