const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

function nowTs() {
  return admin.firestore.FieldValue.serverTimestamp();
}

exports.migrateCarrierTemplates = onRequest({ timeoutSeconds: 300, memory: '512MiB', cors: true }, async (req, res) => {
  try {
    const db = admin.firestore();
    // Load carriers mapped in the system
    const carriersSnap = await db.collection('carriers').get();
    const batch = db.batch();
    let created = 0;

    for (const doc of carriersSnap.docs) {
      const carrier = doc.data();
      const carrierId = carrier?.key || carrier?.id || doc.id;
      if (!carrierId) continue;

      // Create a default v1 template if none exists
      const tmplCol = db.collection('carrierInvoiceTemplates').doc(carrierId).collection('templates');
      const existing = await tmplCol.limit(1).get();
      if (!existing.empty) continue;

      const tmplRef = tmplCol.doc();
      batch.set(tmplRef, {
        carrierId,
        version: 1,
        layoutHash: 'default',
        confidenceThreshold: 0.85,
        anchors: { headerTokens: [], columnHeaders: [] },
        patterns: { invoiceNumber: '', tracking: '', customerRef: '', total: '', taxes: '' },
        tableSchema: [],
        fewShotPromptSnippets: [],
        stats: { used: 0, avgConfidence: 0, lastUsedAt: null },
        createdAt: nowTs(),
        updatedAt: nowTs(),
      });
      created += 1;
    }

    if (created > 0) await batch.commit();
    return res.status(200).json({ success: true, created, carriers: carriersSnap.size });
  } catch (e) {
    console.error('migrateCarrierTemplates error:', e);
    return res.status(500).json({ success: false, error: e.message });
  }
});


