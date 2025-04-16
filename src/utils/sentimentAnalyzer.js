// Greeting patterns
const GREETING_PATTERNS = {
    formal: [
        /^good\s*(morning|afternoon|evening)\b/i,
        /^greetings\b/i,
        /^welcome\b/i,
        /^hello\b/i
    ],
    informal: [
        /^hi\b/i,
        /^hey\b/i,
        /^howdy\b/i,
        /^yo\b/i,
        /^sup\b/i,
        /^hiya\b/i
    ],
    timeBased: [
        /^good\s*morning\b/i,
        /^good\s*afternoon\b/i,
        /^good\s*evening\b/i
    ]
};

// Sentiment patterns
const SENTIMENT_PATTERNS = {
    positive: [
        /great\b/i, /excellent\b/i, /awesome\b/i, /perfect\b/i,
        /good\b/i, /nice\b/i, /thanks\b/i, /thank\s*you/i,
        /appreciate/i, /helpful\b/i, /wonderful\b/i
    ],
    negative: [
        /bad\b/i, /terrible\b/i, /awful\b/i, /horrible\b/i,
        /wrong\b/i, /not\s*working/i, /doesn'?t\s*work/i,
        /confused\b/i, /confusing\b/i, /unclear\b/i
    ],
    neutral: [
        /okay\b/i, /ok\b/i, /alright\b/i, /sure\b/i,
        /maybe\b/i, /perhaps\b/i, /possibly\b/i
    ],
    urgent: [
        /urgent\b/i, /asap\b/i, /emergency\b/i, /quickly\b/i,
        /rush\b/i, /immediate\b/i, /right\s*now/i
    ],
    confused: [
        /confused\b/i, /don'?t\s*understand/i, /what\?\b/i,
        /unclear\b/i, /not\s*sure/i, /help\b/i, /explain\b/i
    ]
};

// Intensity modifiers
const INTENSITY_MODIFIERS = {
    high: [
        /very\b/i, /really\b/i, /extremely\b/i, /absolutely\b/i,
        /completely\b/i, /totally\b/i, /definitely\b/i
    ],
    low: [
        /kind\s*of\b/i, /sort\s*of\b/i, /somewhat\b/i,
        /slightly\b/i, /a\s*bit\b/i, /maybe\b/i
    ]
};

/**
 * Detects if the text contains a greeting and what type
 * @param {string} text - The text to analyze
 * @returns {Object} Object containing whether a greeting was detected and its type
 */
export const detectGreeting = (text) => {
    const result = {
        isGreeting: false,
        type: null,
        pattern: null
    };

    // Check each type of greeting
    for (const [type, patterns] of Object.entries(GREETING_PATTERNS)) {
        for (const pattern of patterns) {
            if (pattern.test(text)) {
                result.isGreeting = true;
                result.type = type;
                result.pattern = pattern;
                return result;
            }
        }
    }

    return result;
};

/**
 * Analyzes the sentiment of the text
 * @param {string} text - The text to analyze
 * @returns {Object} Object containing sentiment analysis results
 */
export const analyzeSentiment = (text) => {
    const result = {
        sentiment: 'neutral',
        intensity: 'normal',
        emotions: [],
        score: 0
    };

    // Check for intensity modifiers
    for (const [intensity, patterns] of Object.entries(INTENSITY_MODIFIERS)) {
        if (patterns.some(pattern => pattern.test(text))) {
            result.intensity = intensity;
            break;
        }
    }

    // Check each sentiment type
    for (const [sentiment, patterns] of Object.entries(SENTIMENT_PATTERNS)) {
        if (patterns.some(pattern => pattern.test(text))) {
            result.emotions.push(sentiment);
            // Adjust score based on sentiment type
            switch (sentiment) {
                case 'positive':
                    result.score += 1;
                    break;
                case 'negative':
                    result.score -= 1;
                    break;
                case 'urgent':
                    result.score += 0.5;
                    break;
                case 'confused':
                    result.score -= 0.5;
                    break;
            }
        }
    }

    // Determine overall sentiment based on score
    if (result.score > 0) {
        result.sentiment = 'positive';
    } else if (result.score < 0) {
        result.sentiment = 'negative';
    }

    // Adjust intensity impact
    if (result.intensity === 'high') {
        result.score *= 1.5;
    } else if (result.intensity === 'low') {
        result.score *= 0.5;
    }

    return result;
};

/**
 * Analyzes text for both greeting and sentiment
 * @param {string} text - The text to analyze
 * @returns {Object} Combined analysis results
 */
export const analyzeText = (text) => {
    const greetingAnalysis = detectGreeting(text);
    const sentimentAnalysis = analyzeSentiment(text);

    return {
        ...greetingAnalysis,
        ...sentimentAnalysis,
        timestamp: new Date().toISOString()
    };
};

/**
 * Generates appropriate response based on analysis
 * @param {Object} analysis - The analysis results
 * @returns {string} Appropriate response
 */
export const getResponseForAnalysis = (analysis) => {
    let response = '';

    // Handle greeting
    if (analysis.isGreeting) {
        switch (analysis.type) {
            case 'formal':
                response = 'Hello! ';
                break;
            case 'informal':
                response = 'Hi! ';
                break;
            case 'timeBased':
                // Use the pattern from the analysis instead of trying to match again
                response = analysis.pattern.test('good morning') ? 'Good morning! ' :
                          analysis.pattern.test('good afternoon') ? 'Good afternoon! ' :
                          'Good evening! ';
                break;
            default:
                response = 'Hello! ';
        }
    }

    // Add sentiment-based response
    if (analysis.emotions.includes('confused')) {
        response += "I'll try to explain things more clearly. ";
    } else if (analysis.emotions.includes('urgent')) {
        response += "I'll help you as quickly as possible. ";
    } else if (analysis.sentiment === 'positive') {
        response += "I'm glad I can help. ";
    } else if (analysis.sentiment === 'negative') {
        response += "I'll do my best to help resolve any issues. ";
    }

    return response.trim();
}; 