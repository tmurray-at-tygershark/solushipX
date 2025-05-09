const { parseFloatSafe } = require('../utils'); // Assuming utils.js exists or will be created
const csv = require('csv-parser');
const { Readable } = require('stream');

async function postProcessFedexCsv(aiRecords, originalCsvString, fileNameForLogging = 'unknown_file') {
  console.log(`FedEx Post-Process: Starting for ${fileNameForLogging}`);
  let originalCsvRows = [];

  if (!originalCsvString) {
    console.warn('FedEx Post-Process: Original CSV string is empty. Skipping corrections.');
    return aiRecords;
  }

  try {
    const stream = Readable.from(originalCsvString);
    await new Promise((resolve, reject) => {
      stream.pipe(csv({strict: true})) // Added strict to potentially catch CSV format issues earlier
        .on('data', (row) => originalCsvRows.push(row))
        .on('end', resolve)
        .on('error', (err) => {
            console.error(`FedEx Post-Process: Error parsing original CSV for ${fileNameForLogging}:`, err);
            reject(err); // Reject promise on CSV parsing error
        });
    });
  } catch (csvParseError) {
    console.error(`FedEx Post-Process: CSV parsing failed catastrophically for ${fileNameForLogging}. Records will not be post-processed for cost correction. Error:`, csvParseError);
    return aiRecords; // Return AI records as is if CSV parsing fails
  }

  if (aiRecords.length > 0 && originalCsvRows.length === aiRecords.length) {
    console.log(`FedEx Post-Process: Processing ${aiRecords.length} records for ${fileNameForLogging}.`);
    return aiRecords.map((aiRecord, index) => {
      const originalCsvRow = originalCsvRows[index];
      if (!aiRecord.costs) aiRecord.costs = {};
      if (!originalCsvRow) {
        console.warn(`FedEx Post-Process: Missing original CSV row for AI record index ${index} in ${fileNameForLogging}.`);
        return aiRecord;
      }

      const trackingNumber = aiRecord.trackingNumber || originalCsvRow['Tracking Number'] || 'N/A';

      // Helper to get, parse, and set a charge, deleting if zero/undefined in CSV
      const setOrDeleteCharge = (chargeKeyInAiCosts, csvColumnName, chargeDisplayName) => {
        const csvValue = parseFloatSafe(originalCsvRow[csvColumnName]);
        if (csvValue !== undefined && !isNaN(csvValue) && csvValue !== 0) {
          if (aiRecord.costs[chargeKeyInAiCosts] !== csvValue) {
            console.warn(`FedEx Post-Process: Correcting ${chargeDisplayName} for ${trackingNumber}. AI: ${aiRecord.costs[chargeKeyInAiCosts]}, CSV: ${csvValue}`);
            aiRecord.costs[chargeKeyInAiCosts] = csvValue;
          }
        } else {
          // If CSV value is zero/undefined/NaN, delete it from AI's costs if present
          if (aiRecord.costs[chargeKeyInAiCosts] !== undefined) {
            console.warn(`FedEx Post-Process: ${chargeDisplayName} from CSV was zero/undefined, but AI had ${aiRecord.costs[chargeKeyInAiCosts]} for ${trackingNumber}. Deleting from AI costs.`);
            delete aiRecord.costs[chargeKeyInAiCosts];
          }
        }
      };

      // Explicitly set/correct freight based on 'Freight Amt' or clear it
      const freightAmtCsv = parseFloatSafe(originalCsvRow['Freight Amt']);
      if (freightAmtCsv !== undefined && !isNaN(freightAmtCsv) && freightAmtCsv !== 0) {
        if (aiRecord.costs.freight !== freightAmtCsv) {
            console.warn(`FedEx Post-Process: Correcting FREIGHT for ${trackingNumber}. AI: ${aiRecord.costs.freight}, CSV: ${freightAmtCsv}`);
            aiRecord.costs.freight = freightAmtCsv;
        }
      } else {
        // If Freight Amt is not in CSV or is zero, ensure AI's costs.freight is also removed/zeroed
        // This also handles the case where AI might have put Misc 1 Amt into freight.
        if (aiRecord.costs.freight !== undefined && aiRecord.costs.freight !== 0) {
            console.warn(`FedEx Post-Process: CSV Freight Amt was zero/empty, but AI had ${aiRecord.costs.freight} for ${trackingNumber}. Clearing AI freight.`);
            delete aiRecord.costs.freight;
        }
      }
      
      // Set/Correct other specific charges
      setOrDeleteCharge('fuel', 'Fuel Amt', 'Fuel');
      setOrDeleteCharge('misc1', 'Misc 1 Amt', 'Misc 1');
      setOrDeleteCharge('misc2', 'Misc 2 Amt', 'Misc 2');
      setOrDeleteCharge('misc3', 'Misc 3 Amt', 'Misc 3');
      setOrDeleteCharge('advancementFee', 'Adv Fee Amt', 'Advancement Fee');
      setOrDeleteCharge('vat', 'Orig VAT Amt', 'VAT');
      
      // Re-check fuel miscategorization *after* all specific charges are set
      const currentFuelInAi = aiRecord.costs.fuel;
      const csvFuel = parseFloatSafe(originalCsvRow['Fuel Amt']);
      const csvMisc1 = parseFloatSafe(originalCsvRow['Misc 1 Amt']);
      const csvMisc2 = parseFloatSafe(originalCsvRow['Misc 2 Amt']);
      const csvMisc3 = parseFloatSafe(originalCsvRow['Misc 3 Amt']);

      if ( (csvFuel === undefined || csvFuel === 0 || isNaN(csvFuel)) ) {
          if (currentFuelInAi === csvMisc1 && csvMisc1 !== 0 && csvMisc1 !== undefined && !isNaN(csvMisc1) ) {
              console.warn(`FedEx Post-Process: Final check - Fuel (${currentFuelInAi}) was Misc1 (${csvMisc1}) for ${trackingNumber}. Correcting.`);
              if(aiRecord.costs.misc1 === undefined) aiRecord.costs.misc1 = csvMisc1; // Ensure misc1 has the value
              delete aiRecord.costs.fuel;
          } else if (currentFuelInAi === csvMisc2 && csvMisc2 !== 0 && csvMisc2 !== undefined && !isNaN(csvMisc2)) {
              console.warn(`FedEx Post-Process: Final check - Fuel (${currentFuelInAi}) was Misc2 (${csvMisc2}) for ${trackingNumber}. Correcting.`);
              if(aiRecord.costs.misc2 === undefined) aiRecord.costs.misc2 = csvMisc2;
              delete aiRecord.costs.fuel;
          } else if (currentFuelInAi === csvMisc3 && csvMisc3 !== 0 && csvMisc3 !== undefined && !isNaN(csvMisc3)) {
              console.warn(`FedEx Post-Process: Final check - Fuel (${currentFuelInAi}) was Misc3 (${csvMisc3}) for ${trackingNumber}. Correcting.`);
              if(aiRecord.costs.misc3 === undefined) aiRecord.costs.misc3 = csvMisc3;
              delete aiRecord.costs.fuel;
          }
      }
      
      return aiRecord;
    });
  } else if (originalCsvRows.length > 0 && originalCsvRows.length !== aiRecords.length) {
    console.warn(`FedEx Post-Process: AI record count (${aiRecords.length}) mismatch with CSV row count (${originalCsvRows.length}) for ${fileNameForLogging}. Skipping corrections.`);
  }
  return aiRecords; // Return records, possibly modified
}

module.exports = { postProcessFedexCsv }; 