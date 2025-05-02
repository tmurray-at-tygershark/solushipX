const functions = require('firebase-functions/v2');
const admin = require('firebase-admin');
const { PubSub } = require('@google-cloud/pubsub');

// Initialize the admin app if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

// Initialize Pub/Sub
const pubsub = new PubSub();
const TOPIC_NAME = process.env.PUBSUB_TOPIC || 'edi-processing';

// Get Firestore instances
const db = admin.firestore();

// Initialize admin database with proper databaseId
const adminDb = admin.firestore();
try {
  // Just set the databaseId directly on when constructing the reference
  adminDb._databaseId = 'admin';
} catch (err) {
  console.error('Error setting admin database ID:', err);
}

exports.checkEdiUploads = functions.https.onRequest(async (req, res) => {
  try {
    const docId = req.query.docId;
    const resultId = req.query.resultId;
    const action = req.query.action || 'check';
    
    if (action === 'listResults' && !resultId) {
      // List all results in the admin database
      const directAdminDb = admin.firestore(admin.app(), 'admin');
      const resultSnapshot = await directAdminDb.collection('ediResults').limit(20).get();
      
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
      // Get detailed information about a specific result document
      const directAdminDb = admin.firestore(admin.app(), 'admin');
      const resultDoc = await directAdminDb.collection('ediResults').doc(resultId).get();
      
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
    
    if (action === 'listDefaultResults') {
      // List all results in the default database
      const defaultResultSnapshot = await db.collection('ediResults').limit(20).get();
      
      const results = [];
      defaultResultSnapshot.forEach(doc => {
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
    
    if (!docId && action === 'check') {
      return res.status(400).json({ error: 'Missing docId parameter' });
    }
    
    if (action === 'check') {
      console.log(`Checking document ${docId} in both databases`);
      
      // Check in default database
      const docRef = db.collection('ediUploads').doc(docId);
      const docSnapshot = await docRef.get();
      
      // Check in admin database
      const directAdminDb = admin.firestore(admin.app(), 'admin');
      const adminDocRef = directAdminDb.collection('ediUploads').doc(docId);
      const adminDocSnapshot = await adminDocRef.get();
      
      const result = {
        exists: {
          default: docSnapshot.exists,
          admin: adminDocSnapshot.exists
        },
        data: {
          default: docSnapshot.exists ? sanitizeData(docSnapshot.data()) : null,
          admin: adminDocSnapshot.exists ? sanitizeData(adminDocSnapshot.data()) : null
        }
      };
      
      return res.status(200).json(result);
    }
    
    if (action === 'reprocess' && docId) {
      // Get document directly from the admin database
      const directAdminDb = admin.firestore(admin.app(), 'admin');
      const docRef = directAdminDb.collection('ediUploads').doc(docId);
      const docSnapshot = await docRef.get();
      
      if (!docSnapshot.exists) {
        return res.status(404).json({ 
          error: `Document ${docId} not found in admin database` 
        });
      }
      
      const fileData = docSnapshot.data();
      
      // Create the message data
      const messageData = {
        docId,
        storagePath: fileData.storagePath,
        fileName: fileData.fileName,
        isAdmin: true
      };
      
      // Publish a message to the EDI processing topic
      const dataBuffer = Buffer.from(JSON.stringify(messageData));
      const pubsub = new PubSub();
      const TOPIC_NAME = process.env.PUBSUB_TOPIC || 'edi-processing';
      await pubsub.topic(TOPIC_NAME).publish(dataBuffer);
      
      // Update status to queued
      await docRef.update({
        processingStatus: 'queued',
        queuedAt: admin.firestore.FieldValue.serverTimestamp(),
        reprocessed: true
      });
      
      return res.status(200).json({
        success: true,
        message: `Document ${docId} has been queued for reprocessing`,
        queuedAt: new Date().toISOString()
      });
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

// Helper function to sanitize data for response
function sanitizeData(data) {
  if (!data) return null;
  
  // Convert timestamps to ISO strings
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