const functions = require('firebase-functions/v2');
const express = require('express');
const cors = require('cors');
const { generateEdiMapping } = require("./mapping_functions");
const mappingTestRouter = require('./api/edi-mapping-test');

// Initialize Express app
const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Mount the mapping test router
app.use('/api/edi-mapping', mappingTestRouter);

// Export the Express app as a Firebase Function
exports.api = functions.https.onRequest(app);

// Export the existing generateEdiMapping function
exports.generateEdiMapping = generateEdiMapping; 