const express = require('express');
const router = express.Router();
const mappingTest = require('../edi-prompts/mapping-test');
const versioning = require('../edi-prompts/versioning');
const promptTemplates = require('../edi-prompts/prompt-library');

// Test a mapping with sample data
router.post('/test', async (req, res) => {
  try {
    const { carrierId, sampleData, version } = req.body;
    
    if (!carrierId || !sampleData) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const result = await mappingTest.testMapping(carrierId, sampleData, version);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// List available prompt templates
router.get('/templates', (req, res) => {
  const templates = Object.entries(promptTemplates).map(([key, template]) => ({
    id: key,
    name: template.name,
    description: template.description,
    version: template.version,
    metadata: template.metadata
  }));
  
  res.json(templates);
});

// List versions for a carrier
router.get('/versions/:carrierId', async (req, res) => {
  try {
    const { carrierId } = req.params;
    const versions = await versioning.listVersions(carrierId);
    res.json(versions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rollback to a specific version
router.post('/versions/:carrierId/rollback', async (req, res) => {
  try {
    const { carrierId } = req.params;
    const { version } = req.body;
    
    if (!version) {
      return res.status(400).json({ error: 'Version parameter is required' });
    }

    const result = await versioning.rollbackToVersion(carrierId, version);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Save a new version
router.post('/versions/:carrierId', async (req, res) => {
  try {
    const { carrierId } = req.params;
    const { prompt, version, metadata } = req.body;
    
    if (!prompt || !version) {
      return res.status(400).json({ error: 'Prompt and version are required' });
    }

    const result = await versioning.saveVersion(carrierId, {
      prompt,
      version,
      metadata
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router; 