const initializeFirebaseAdmin = require('../config/firebase-admin');

// Example function to get a document from Firestore using Firebase Admin
const getDocumentFromFirestore = async (collection, documentId) => {
  try {
    // Initialize Firebase Admin
    const admin = initializeFirebaseAdmin();
    const db = admin.firestore();
    
    // Get the document
    const docRef = db.collection(collection).doc(documentId);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      console.log('No such document!');
      return null;
    }
    
    return doc.data();
  } catch (error) {
    console.error('Error getting document:', error);
    throw error;
  }
};

// Example function to update a document in Firestore using Firebase Admin
const updateDocumentInFirestore = async (collection, documentId, data) => {
  try {
    // Initialize Firebase Admin
    const admin = initializeFirebaseAdmin();
    const db = admin.firestore();
    
    // Update the document
    const docRef = db.collection(collection).doc(documentId);
    await docRef.update(data);
    
    console.log('Document successfully updated!');
    return true;
  } catch (error) {
    console.error('Error updating document:', error);
    throw error;
  }
};

module.exports = {
  getDocumentFromFirestore,
  updateDocumentInFirestore
}; 