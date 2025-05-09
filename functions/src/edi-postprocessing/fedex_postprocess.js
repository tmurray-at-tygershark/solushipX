const { parseFloatSafe } = require('../utils'); // Assuming utils.js exists or will be created
const csv = require('csv-parser');
const { Readable } = require('stream');

async function postProcessFedexCsv(aiRecords, originalCsvString, fileNameForLogging = 'unknown_file') {
  console.log(`FedEx Post-Process V3: Starting for ${fileNameForLogging}. AI Records: ${aiRecords.length}`);
  let originalCsvRows = [];

  if (!originalCsvString) {
    console.warn(`FedEx Post-Process: Original CSV string is empty for ${fileNameForLogging}. Skipping corrections.`);
    return aiRecords;
  }

  try {
    const stream = Readable.from(originalCsvString);
    await new Promise((resolve, reject) => {
      stream.pipe(csv({strict: true}))
        .on('data', (row) => originalCsvRows.push(row))
        .on('end', resolve)
        .on('error', (err) => {
            console.error(`FedEx Post-Process: Error parsing original CSV for ${fileNameForLogging}:`, err);
            reject(err); 
        });
    });
    console.log(`FedEx Post-Process: Successfully parsed ${originalCsvRows.length} original CSV rows for ${fileNameForLogging}.`);
  } catch (csvParseError) {
    console.error(`FedEx Post-Process: CSV parsing failed catastrophically for ${fileNameForLogging}. Records will not be post-processed. Error:`, csvParseError);
    return aiRecords; 
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

      const trackingNumber = aiRecord.trackingNumber || originalCsvRow['Tracking Number'] || `ROW_${index + 1}`;
      console.log(`--- FedEx Post-Process START for Row ${index + 1} (Track: ${trackingNumber}) ---`);
      // console.log(`Original CSV Data for Row ${index + 1}:`, JSON.stringify(originalCsvRow));
      // console.log(`AI Record Before for Row ${index + 1}:`, JSON.stringify(aiRecord));

      // --- Dimensions --- 
      const csvLength = parseFloatSafe(originalCsvRow['Length']);
      const csvWidth = parseFloatSafe(originalCsvRow['Width']);
      const csvHeight = parseFloatSafe(originalCsvRow['Height']);
      const csvDimUnit = originalCsvRow['Dim Unit'];

      // console.log(`CSV Dimensions: L=${csvLength}, W=${csvWidth}, H=${csvHeight}, Unit=${csvDimUnit}`);

      if ((csvLength > 0 || csvWidth > 0 || csvHeight > 0) && (!isNaN(csvLength) && !isNaN(csvWidth) && !isNaN(csvHeight))) {
        aiRecord.dimensions = {
          length: csvLength || 0,
          width: csvWidth || 0,
          height: csvHeight || 0,
          unit: csvDimUnit || 'IN' // Default to IN if unit is missing
        };
        // console.log(`FedEx Post-Process: Set/Updated dimensions for ${trackingNumber}:`, aiRecord.dimensions);
      } else {
        // If all CSV dimensions are zero/invalid, ensure no dimensions object on AI record
        if (aiRecord.dimensions) {
            // console.log(`FedEx Post-Process: CSV dimensions were zero/invalid for ${trackingNumber}. Removing dimensions from AI record.`);
            delete aiRecord.dimensions;
        }
      }
      
      // --- Actual Weight ---
      const csvActualWeight = parseFloatSafe(originalCsvRow['Bill Wt']);
      if (csvActualWeight !== undefined && !isNaN(csvActualWeight)) {
          if (aiRecord.actualWeight !== csvActualWeight) {
              // console.log(`FedEx Post-Process: Correcting actualWeight for ${trackingNumber}. AI: ${aiRecord.actualWeight}, CSV: ${csvActualWeight}`);
              aiRecord.actualWeight = csvActualWeight;
          }
      } else {
          if (aiRecord.actualWeight !== undefined) {
              // console.log(`FedEx Post-Process: CSV actualWeight (Bill Wt) was empty/invalid for ${trackingNumber}. Removing from AI record.`);
              delete aiRecord.actualWeight;
          }
      }

      const processCharge = (chargeName, csvColumnName, aiCostsKey) => {
        const csvValue = parseFloatSafe(originalCsvRow[csvColumnName]);
        // console.log(`FedEx Post-Process: ${trackingNumber} - ${chargeName} (${csvColumnName}): CSV raw '${originalCsvRow[csvColumnName]}', parsed: ${csvValue}`);
        if (csvValue !== undefined && !isNaN(csvValue) && csvValue !== 0) {
          if (aiRecord.costs[aiCostsKey] !== csvValue) {
            // console.warn(`FedEx Post-Process: Correcting ${chargeName} for ${trackingNumber}. AI had: ${aiRecord.costs[aiCostsKey]}, CSV has: ${csvValue}`);
            aiRecord.costs[aiCostsKey] = csvValue;
          }
        } else {
          if (aiRecord.costs[aiCostsKey] !== undefined) {
            // console.warn(`FedEx Post-Process: ${chargeName} from CSV was zero/undefined for ${trackingNumber}, but AI had ${aiRecord.costs[aiCostsKey]}. Deleting from AI costs.`);
            delete aiRecord.costs[aiCostsKey];
          }
        }
      };
      
      processCharge('Freight', 'Freight Amt', 'freight');
      processCharge('Fuel', 'Fuel Amt', 'fuel');
      processCharge('Misc 1', 'Misc 1 Amt', 'misc1');
      processCharge('Misc 2', 'Misc 2 Amt', 'misc2');
      processCharge('Misc 3', 'Misc 3 Amt', 'misc3');
      processCharge('Advancement Fee', 'Adv Fee Amt', 'advancementFee');
      processCharge('VAT', 'Orig VAT Amt', 'vat');

      const fuelAmtInCsv = parseFloatSafe(originalCsvRow['Fuel Amt']);
      if (fuelAmtInCsv === undefined || fuelAmtInCsv === 0 || isNaN(fuelAmtInCsv)) {
        const misc1Csv = parseFloatSafe(originalCsvRow['Misc 1 Amt']);
        const misc2Csv = parseFloatSafe(originalCsvRow['Misc 2 Amt']);
        const misc3Csv = parseFloatSafe(originalCsvRow['Misc 3 Amt']);

        if (aiRecord.costs.fuel === misc1Csv && misc1Csv !== 0 && misc1Csv !== undefined && !isNaN(misc1Csv)) { 
            console.warn(`FedEx Post-Process: Final check - Fuel (${aiRecord.costs.fuel}) was Misc1 (${misc1Csv}) for ${trackingNumber}. Correcting.`); 
            if(aiRecord.costs.misc1 === undefined && misc1Csv !==0) aiRecord.costs.misc1 = misc1Csv; 
            delete aiRecord.costs.fuel; 
        }
        if (aiRecord.costs.fuel === misc2Csv && misc2Csv !== 0 && misc2Csv !== undefined && !isNaN(misc2Csv)) { 
            console.warn(`FedEx Post-Process: Final check - Fuel (${aiRecord.costs.fuel}) was Misc2 (${misc2Csv}) for ${trackingNumber}. Correcting.`); 
            if(aiRecord.costs.misc2 === undefined && misc2Csv !==0) aiRecord.costs.misc2 = misc2Csv;
            delete aiRecord.costs.fuel; 
        }
        if (aiRecord.costs.fuel === misc3Csv && misc3Csv !== 0 && misc3Csv !== undefined && !isNaN(misc3Csv)) { 
            console.warn(`FedEx Post-Process: Final check - Fuel (${aiRecord.costs.fuel}) was Misc3 (${misc3Csv}) for ${trackingNumber}. Correcting.`); 
            if(aiRecord.costs.misc3 === undefined && misc3Csv !==0) aiRecord.costs.misc3 = misc3Csv;
            delete aiRecord.costs.fuel; 
        }
      }
      // console.log(`FedEx Post-Process: Row ${index}, AI Record After:`, JSON.stringify(aiRecord));
      console.log(`--- FedEx Post-Process END for Row ${index + 1} (Track: ${trackingNumber}) ---`);
      return aiRecord;
    });
  } else if (originalCsvRows.length > 0 && originalCsvRows.length !== aiRecords.length) {
    console.warn(`FedEx Post-Process: AI record count (${aiRecords.length}) mismatch with CSV row count (${originalCsvRows.length}) for ${fileNameForLogging}. Skipping corrections.`);
  }
  return aiRecords;
}

module.exports = { postProcessFedexCsv }; 