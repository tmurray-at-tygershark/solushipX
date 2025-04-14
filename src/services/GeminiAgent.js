import { GoogleGenerativeAI } from '@google/generative-ai';
import { getShippingRates } from '../api/shippingRates';
import { createShipment } from '../api/shipments';

class GeminiAgent {
    constructor() {
        this.genAI = new GoogleGenerativeAI(process.env.REACT_APP_GEMINI_API_KEY);
        this.model = this.genAI.getGenerativeModel({ model: "gemini-pro" });
        this.context = {
            origin: null,
            destination: null,
            packageDetails: null,
            selectedRate: null,
            preferences: {
                priority: 'balanced', // 'speed', 'price', or 'balanced'
                insurance: false,
                specialHandling: false
            }
        };
    }

    async processMessage(userMessage, previousMessages = []) {
        try {
            // Prepare the prompt with context and conversation history
            const prompt = this.buildPrompt(userMessage, previousMessages);
            
            // Get response from Gemini
            const result = await this.model.generateContent([
                {
                    role: "user",
                    parts: [{ text: prompt }]
                }
            ]);

            const response = await result.response;
            const responseText = response.text();

            // Update context based on the response
            this.updateContext(responseText);

            // If we have all necessary information, fetch rates
            if (this.shouldFetchRates()) {
                const rates = await this.fetchRates();
                return this.formatRatesResponse(rates);
            }

            return responseText;
        } catch (error) {
            console.error('Error in GeminiAgent:', error);
            throw error;
        }
    }

    buildPrompt(userMessage, previousMessages) {
        return `
You are AirmaticBot, a friendly and professional logistics assistant. Help the user create a shipment by collecting necessary information step by step.

Current Context:
${JSON.stringify(this.context, null, 2)}

Previous Messages:
${previousMessages.map(msg => `${msg.type}: ${msg.content}`).join('\n')}

User Message: ${userMessage}

Instructions:
1. If information is missing, ask for it one piece at a time
2. Confirm information before proceeding to next step
3. If all information is collected, suggest fetching rates
4. Keep responses concise and friendly
5. Format any collected information as JSON in your response

Response Format:
{
    "message": "Your response to the user",
    "collectedInfo": {
        "field": "value" // Only include fields that were collected in this response
    },
    "nextStep": "origin|destination|package|rates|complete"
}
`;
    }

    updateContext(responseText) {
        try {
            const parsedResponse = JSON.parse(responseText);
            if (parsedResponse.collectedInfo) {
                this.context = {
                    ...this.context,
                    ...parsedResponse.collectedInfo
                };
            }
        } catch (error) {
            console.error('Error parsing Gemini response:', error);
        }
    }

    shouldFetchRates() {
        return (
            this.context.origin &&
            this.context.destination &&
            this.context.packageDetails &&
            !this.context.selectedRate
        );
    }

    async fetchRates() {
        try {
            const rates = await getShippingRates({
                origin: this.context.origin,
                destination: this.context.destination,
                package: this.context.packageDetails
            });
            return rates;
        } catch (error) {
            console.error('Error fetching rates:', error);
            throw error;
        }
    }

    formatRatesResponse(rates) {
        // Sort rates based on user preferences
        const sortedRates = this.sortRatesByPreference(rates);

        return {
            message: "Here are the best shipping options for you:",
            rates: sortedRates.slice(0, 3), // Return top 3 options
            context: this.context
        };
    }

    sortRatesByPreference(rates) {
        const { priority } = this.context.preferences;
        
        return [...rates].sort((a, b) => {
            switch (priority) {
                case 'speed':
                    return a.eta - b.eta;
                case 'price':
                    return a.price - b.price;
                case 'balanced':
                default:
                    // Combine price and speed into a single score
                    const scoreA = (a.price / 100) + (a.eta / 24);
                    const scoreB = (b.price / 100) + (b.eta / 24);
                    return scoreA - scoreB;
            }
        });
    }

    async createShipment(selectedRate) {
        try {
            const shipment = await createShipment({
                ...this.context,
                selectedRate
            });
            return shipment;
        } catch (error) {
            console.error('Error creating shipment:', error);
            throw error;
        }
    }
}

export default new GeminiAgent(); 