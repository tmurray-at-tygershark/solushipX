const canparPrompt = require('../canpar/prompt_csv');
const fedexPrompt = require('../fedex/prompt_csv');

const promptTemplates = {
  canpar: {
    name: 'CANPAR CSV',
    description: 'Template for parsing CANPAR CSV files with comprehensive cost mapping',
    version: '1.0.0',
    prompt: canparPrompt,
    metadata: {
      carrier: 'CANPAR',
      format: 'CSV',
      features: ['cost-mapping', 'address-parsing', 'reference-tracking']
    }
  },
  fedex: {
    name: 'FedEx CSV',
    description: 'Template for parsing FedEx CSV files with detailed charge mapping',
    version: '1.0.0',
    prompt: fedexPrompt,
    metadata: {
      carrier: 'FedEx',
      format: 'CSV',
      features: ['cost-mapping', 'address-parsing', 'reference-tracking']
    }
  }
};

module.exports = promptTemplates; 