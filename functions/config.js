const functions = require('firebase-functions');

// Get Firebase Functions configuration
const functionConfig = functions.config();

const config = {
    eshipplus: {
        access_code: functionConfig.eshipplus?.access_code,
        username: functionConfig.eshipplus?.username,
        password: functionConfig.eshipplus?.password,
        access_key: functionConfig.eshipplus?.access_key,
        url: functionConfig.eshipplus?.url || 'https://www.eshipplus.com/services/eShipPlusWSv4.asmx'
    },
    google: {
        placesApiKey: functionConfig.google?.places_api_key,
        genaiApiKey: functionConfig.google?.genai_api_key
    },
    openai: {
        apiKey: functionConfig.openai?.api_key,
        apiUrl: functionConfig.openai?.api_url || 'https://api.openai.com/v1/chat/completions'
    }
};

// Validate required configuration
function validateConfig() {
    const requiredFields = [
        ['eshipplus.access_code', config.eshipplus.access_code],
        ['eshipplus.username', config.eshipplus.username],
        ['eshipplus.password', config.eshipplus.password],
        ['eshipplus.access_key', config.eshipplus.access_key],
        ['google.places_api_key', config.google.placesApiKey],
        ['google.genai_api_key', config.google.genaiApiKey],
        ['openai.api_key', config.openai.apiKey]
    ];

    const missingFields = requiredFields
        .filter(([name, value]) => !value)
        .map(([name]) => name);

    if (missingFields.length > 0) {
        throw new Error(`Missing required configuration fields: ${missingFields.join(', ')}\n` +
            'Please set them using: firebase functions:config:set');
    }
}

// Validate configuration on startup
validateConfig();

// Freeze the configuration to prevent runtime modifications
Object.freeze(config);
Object.freeze(config.eshipplus);
Object.freeze(config.google);
Object.freeze(config.openai);

module.exports = config;
