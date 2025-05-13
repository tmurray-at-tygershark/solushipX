const { GoogleGenerativeAI } = require('@google/generative-ai');
const promptTemplates = require('../prompt-library');
const versioning = require('../versioning');

class MappingTest {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }

  async testMapping(carrierId, sampleData, version = null) {
    try {
      // Get the prompt template
      const promptTemplate = promptTemplates[carrierId.toLowerCase()];
      if (!promptTemplate) {
        throw new Error(`No prompt template found for carrier: ${carrierId}`);
      }

      // Get specific version if requested
      let prompt = promptTemplate.prompt;
      if (version) {
        const versionData = await versioning.getVersion(carrierId, version);
        if (versionData) {
          prompt = versionData.prompt;
        }
      }

      // Initialize Gemini
      const model = this.genAI.getGenerativeModel({ model: "gemini-pro" });

      // Prepare the test data
      const testPrompt = `${prompt}\n\nTest Data:\n${sampleData}`;

      // Generate mapping
      const result = await model.generateContent(testPrompt);
      const response = await result.response;
      const mappingResult = response.text();

      // Parse and validate the result
      try {
        const parsedResult = JSON.parse(mappingResult);
        return {
          success: true,
          result: parsedResult,
          metadata: {
            carrier: carrierId,
            version: version || promptTemplate.version,
            timestamp: new Date().toISOString()
          }
        };
      } catch (parseError) {
        return {
          success: false,
          error: 'Failed to parse mapping result as JSON',
          rawResult: mappingResult,
          metadata: {
            carrier: carrierId,
            version: version || promptTemplate.version,
            timestamp: new Date().toISOString()
          }
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        metadata: {
          carrier: carrierId,
          version: version,
          timestamp: new Date().toISOString()
        }
      };
    }
  }

  async validateMapping(mappingResult) {
    // Basic validation rules
    const validations = {
      hasRequiredFields: (data) => {
        const required = ['recordType', 'carrier', 'costs'];
        return required.every(field => data.hasOwnProperty(field));
      },
      hasValidCosts: (data) => {
        return data.costs && typeof data.costs === 'object';
      },
      hasValidAddresses: (data) => {
        return data.origin && data.destination &&
               typeof data.origin === 'object' &&
               typeof data.destination === 'object';
      }
    };

    const results = {};
    for (const [key, validator] of Object.entries(validations)) {
      results[key] = validator(mappingResult);
    }

    return {
      isValid: Object.values(results).every(v => v === true),
      validationResults: results
    };
  }
}

module.exports = new MappingTest(); 