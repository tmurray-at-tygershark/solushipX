const functions = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { PubSub } = require('@google-cloud/pubsub');
const cors = require('cors')({ origin: true }); // Import CORS middleware

// Initialize the admin app if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// Initialize Pub/Sub
const pubsub = new PubSub();
const TOPIC_NAME = process.env.PUBSUB_TOPIC || 'edi-processing';

// Get Firestore instance for the (default) database
const db = admin.firestore();

exports.checkEdiUploads = functions.https.onRequest(async (req, res) => {
  // Wrap the entire function with CORS middleware
  return cors(req, res, async () => {
    try {
      const docId = req.query.docId;
      const resultId = req.query.resultId;
      const action = req.query.action || 'check';
      
      if (action === 'diagnoseQueue') {
        // Check for stuck EDI uploads in the default database
        
        try {
          // Get timestamp for 15 minutes ago
          const fifteenMinutesAgo = new Date();
          fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);
          
          const queuedSnapshot = await db.collection('ediUploads')
            .where('processingStatus', '==', 'queued')
            .limit(20)
            .get();
          
          const processingSnapshot = await db.collection('ediUploads')
            .where('processingStatus', '==', 'processing') 
            .limit(20)
            .get();
          
          const stuckQueued = [];
          queuedSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.queuedAt && data.queuedAt.toDate() < fifteenMinutesAgo) {
              const stuckTime = Math.round((Date.now() - data.queuedAt.toDate().getTime()) / (1000 * 60));
              stuckQueued.push({
                id: doc.id,
                fileName: data.fileName,
                queuedAt: data.queuedAt ? data.queuedAt.toDate().toISOString() : null,
                minutesInQueue: stuckTime,
                carrier: data.carrier || 'Not specified'
              });
            }
          });
          
          const stuckProcessing = [];
          processingSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.processingStartedAt && data.processingStartedAt.toDate() < fifteenMinutesAgo) {
              const stuckTime = Math.round((Date.now() - data.processingStartedAt.toDate().getTime()) / (1000 * 60));
              stuckProcessing.push({
                id: doc.id,
                fileName: data.fileName,
                processingStartedAt: data.processingStartedAt ? data.processingStartedAt.toDate().toISOString() : null,
                minutesInProcessing: stuckTime,
                carrier: data.carrier || 'Not specified'
              });
            }
          });
          
          return res.status(200).json({
            stuckQueued,
            stuckProcessing,
            queuedCount: stuckQueued.length,
            processingCount: stuckProcessing.length,
            diagnosticTime: new Date().toISOString(),
            threshold: '15 minutes'
          });
        } catch (error) {
          console.error('Error in diagnose queue:', error);
          return res.status(500).json({ 
            error: `Error diagnosing queue: ${error.message}`,
            stack: error.stack
          });
        }
      }
      
      if (action === 'fixStuckQueue') {
        try {
          const limit = parseInt(req.query.limit) || 3;
          
          const fifteenMinutesAgo = new Date();
          fifteenMinutesAgo.setMinutes(fifteenMinutesAgo.getMinutes() - 15);
          
          const queuedSnapshot = await db.collection('ediUploads')
            .where('processingStatus', '==', 'queued')
            .limit(limit * 2)
            .get();
          
          const stuckDocs = [];
          queuedSnapshot.forEach(doc => {
            const data = doc.data();
            if (data.queuedAt && data.queuedAt.toDate() < fifteenMinutesAgo) {
              stuckDocs.push(doc);
            }
          });
          
          const docsToFix = stuckDocs.slice(0, limit);
          const fixed = [];
          
          for (const doc of docsToFix) {
            try {
              const data = doc.data();
              console.log(`Attempting to fix stuck document ${doc.id}`, data);
              
              const messageData = {
                docId: doc.id,
                storagePath: data.storagePath,
                fileName: data.fileName,
                isAdmin: false,
                carrier: data.carrier
              };
              
              const dataBuffer = Buffer.from(JSON.stringify(messageData));
              await pubsub.topic(TOPIC_NAME).publish(dataBuffer);
              
              await db.collection('ediUploads').doc(doc.id).update({
                processingStatus: 'queued',
                queuedAt: admin.firestore.FieldValue.serverTimestamp(),
                reprocessed: true,
                fixedAt: admin.firestore.FieldValue.serverTimestamp(),
                error: null
              });
              
              fixed.push({
                id: doc.id,
                fileName: data.fileName,
                stuckFor: data.queuedAt ? 
                  Math.round((Date.now() - data.queuedAt.toDate().getTime()) / (1000 * 60)) + ' minutes' : 'unknown',
                status: 'requeued'
              });
            } catch (error) {
              console.error(`Error fixing document ${doc.id}:`, error);
            }
          }
          
          return res.status(200).json({
            success: true,
            message: `Fixed ${fixed.length} stuck documents`,
            fixedDocuments: fixed
          });
        } catch (error) {
          console.error('Error fixing stuck queue:', error);
          return res.status(500).json({ 
            error: `Error fixing stuck queue: ${error.message}`,
            stack: error.stack
          });
        }
      }
      
      if (action === 'listResults' && !resultId) {
        // List all results in the default database
        const resultSnapshot = await db.collection('ediResults').limit(20).get();
        
        const results = [];
        resultSnapshot.forEach(doc => {
          const data = doc.data();
          results.push({
            id: doc.id,
            fileName: data.fileName,
            uploadId: data.uploadId,
            processedAt: data.processedAt ? data.processedAt.toDate().toISOString() : null,
            recordCount: data.records ? data.records.length : (data.shipments ? data.shipments.length : 0)
          });
        });
        
        return res.status(200).json({
          results,
          count: results.length
        });
      }
      
      if (action === 'viewResult' && resultId) {
        // Get detailed information about a specific result document from default database
        const resultDoc = await db.collection('ediResults').doc(resultId).get();
        
        if (!resultDoc.exists) {
          return res.status(404).json({ error: `Result document ${resultId} not found` });
        }
        
        const resultData = resultDoc.data();
        const recordsArray = resultData.records || resultData.shipments || [];
        
        return res.status(200).json({
          id: resultDoc.id,
          fileName: resultData.fileName,
          uploadId: resultData.uploadId,
          processedAt: resultData.processedAt ? resultData.processedAt.toDate().toISOString() : null,
          recordCount: recordsArray.length,
          recordSample: recordsArray.slice(0, 5),
          hasRecordsArray: !!resultData.records,
          hasShipmentsArray: !!resultData.shipments,
          documentKeys: Object.keys(resultData)
        });
      }
      
      if (!docId && action === 'check') {
        return res.status(400).json({ error: 'Missing docId parameter' });
      }
      
      if (action === 'check') {
        console.log(`Checking document ${docId} in default database`);
        
        const docRef = db.collection('ediUploads').doc(docId);
        const docSnapshot = await docRef.get();
        
        const result = {
          exists: docSnapshot.exists,
          data: docSnapshot.exists ? sanitizeData(docSnapshot.data()) : null
        };
        
        return res.status(200).json(result);
      }
      
      if (action === 'reprocess' && docId) {
        // Get document directly from the default database
        const docRef = db.collection('ediUploads').doc(docId);
        const docSnapshot = await docRef.get();
        
        if (!docSnapshot.exists) {
          return res.status(404).json({ 
            error: `Document ${docId} not found in default database` 
          });
        }
        
        const fileData = docSnapshot.data();
        console.log(`Reprocessing document: ${docId}`, fileData);
        
        const currentStatus = fileData.processingStatus;
        let shouldReprocess = true;
        
        if (currentStatus === 'queued' || currentStatus === 'processing') {
          const statusTimestamp = fileData.queuedAt || fileData.processingStartedAt;
          if (statusTimestamp) {
            const stuckTimeMs = Date.now() - statusTimestamp.toDate().getTime();
            const stuckMinutes = stuckTimeMs / (1000 * 60);
            console.log(`Document has been in ${currentStatus} state for ${stuckMinutes.toFixed(2)} minutes`);
            
            if (stuckMinutes < 10 && req.query.force !== 'true') {
              shouldReprocess = false;
              return res.status(400).json({
                error: `Document is not stuck (only ${stuckMinutes.toFixed(2)} minutes in ${currentStatus} state). Use force=true to override.`,
                currentStatus,
                stuckMinutes: stuckMinutes.toFixed(2)
              });
            }
          }
        }
        
        if (shouldReprocess) {
          try {
            const messageData = {
              docId,
              storagePath: fileData.storagePath,
              fileName: fileData.fileName,
              isAdmin: false,
              carrier: fileData.carrier
            };
            
            console.log('Publishing reprocess message with data:', messageData);
            
            const dataBuffer = Buffer.from(JSON.stringify(messageData));
            await pubsub.topic(TOPIC_NAME).publish(dataBuffer);
            
            await docRef.update({
              processingStatus: 'queued',
              queuedAt: admin.firestore.FieldValue.serverTimestamp(),
              reprocessed: true,
              previousStatus: currentStatus,
              reprocessedAt: admin.firestore.FieldValue.serverTimestamp(),
              error: null
            });
            
            return res.status(200).json({
              success: true,
              message: `Document ${docId} has been queued for reprocessing`,
              previousStatus: currentStatus,
              queuedAt: new Date().toISOString()
            });
          } catch (error) {
            console.error('Error reprocessing document:', error);
            return res.status(500).json({
              error: `Error reprocessing document: ${error.message}`,
              docId
            });
          }
        }
      }
      
      return res.status(400).json({ error: 'Invalid action parameter' });
      
    } catch (error) {
      console.error('Error checking upload status:', error);
      return res.status(500).json({ 
        error: error.message,
        stack: error.stack
      });
    }
  });
});

// Helper function to sanitize data for response
function sanitizeData(data) {
  if (!data) return null;
  const result = {};
  Object.keys(data).forEach(key => {
    if (data[key] && typeof data[key].toDate === 'function') {
      result[key] = data[key].toDate().toISOString();
    } else {
      result[key] = data[key];
    }
  });
  return result;
} 