const { onCall } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const axios = require("axios");
const { parseStringPromise } = require("xml2js");
const { getCarrierApiConfig, validateCarrierEndpoints } = require("../../utils");

exports.getHistoryCanpar = onCall(async (request) => {
  try {
    const data = request.data;
    logger.info("getHistoryCanpar function called");
    
    return {
      success: true,
      data: {
        trackingNumber: data.trackingNumber || data.barcode,
        carrier: "Canpar Express",
        historyEvents: [],
        lastUpdated: new Date().toISOString()
      }
    };
    
  } catch (error) {
    logger.error("Error in getHistoryCanpar function:", error);
    throw new Error(error.message || "An internal error occurred while processing the Canpar tracking request.");
  }
});