const path = require('path');

const getPromptForCarrier = (carrierName, fileType) => {
  // *** Log the directory name at runtime ***
  console.log('[getPromptForCarrier] Executing in directory:', __dirname);
  
  console.log(`[getPromptForCarrier] Called with carrier: ${carrierName}, fileType: ${fileType}`);
  // Normalize file type for file naming
  const fileTypeSuffix = fileType === 'application/pdf' ? 'pdf' : 'csv';
  
  // Normalize carrier name: lowercase, replace spaces/special chars with underscore
  // Basic sanitization to prevent path traversal - allow only alphanumeric and underscore
  const normalizedCarrierName = carrierName 
    ? carrierName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') 
    : 'default';
  console.log(`[getPromptForCarrier] Normalized carrier: ${normalizedCarrierName}`);

  let prompt;
  let promptIdentifier = `default_${fileTypeSuffix}`;

  // 1. Try to load carrier-specific prompt first
  if (normalizedCarrierName !== 'default') {
    // *** Look for prompt_*.js file directly ***
    const specificPromptFileName = `prompt_${fileTypeSuffix}.js`; 
    const specificPromptPath = path.resolve(__dirname, normalizedCarrierName, specificPromptFileName);
    try {
      console.log(`[getPromptForCarrier] Attempting to load specific prompt: ${specificPromptPath}`);
      prompt = require(specificPromptPath);
      promptIdentifier = `${normalizedCarrierName}_${fileTypeSuffix}`;
      console.log(`[getPromptForCarrier] Successfully loaded specific prompt: ${promptIdentifier}`);
      // *** Return the specific prompt directly, replacing the base ***
      return { prompt, identifier: promptIdentifier }; 
    } catch (error) {
      if (error.code !== 'MODULE_NOT_FOUND') {
          console.error(`[getPromptForCarrier] Error loading specific prompt ${carrierName} (${fileTypeSuffix}) from ${specificPromptPath}:`, error);
          // Optional: Rethrow or handle unexpected errors differently
      } else {
          console.log(`[getPromptForCarrier] No specific prompt found for carrier: ${carrierName} (${fileTypeSuffix}). Falling back to default base prompt.`);
      }
      // Fall through to load default base if specific prompt fails
    }
  }

  // 2. Load default base prompt if specific one wasn't found or carrier was 'default'
  const basePromptPath = path.resolve(__dirname, 'default', `base_prompt_${fileTypeSuffix}.js`);
  try {
    console.log(`[getPromptForCarrier] Loading default base prompt from: ${basePromptPath}`);
    prompt = require(basePromptPath);
    // Identifier remains 'default_...' in this case
    console.log(`[getPromptForCarrier] Successfully loaded default base prompt: ${promptIdentifier}`);
    return { prompt, identifier: promptIdentifier };
  } catch (error) {
    console.error(`[getPromptForCarrier] FATAL: Could not load default base prompt (${fileTypeSuffix}) from path ${basePromptPath}:`, error);
    throw new Error(`Default base ${fileTypeSuffix} prompt file is missing or could not be loaded.`);
  }
};

module.exports = { getPromptForCarrier }; 