const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

try { initializeApp(); } catch (_) {}
const db = getFirestore();

exports.markShipmentsReadyToInvoice = onRequest({ cors: true, timeoutSeconds: 300 }, async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).send('');

  try {
    const { companyId, shipmentIds = [] } = req.body || {};
    if (!companyId || !Array.isArray(shipmentIds) || shipmentIds.length === 0) {
      return res.status(400).json({ error: 'companyId and shipmentIds[] are required' });
    }

    // Desired status values (from invoice statuses table example)
    const statusCode = 'ready_to_invoice';
    const statusLabel = 'Ready To Invoice';

    let updated = 0;
    for (const inputId of shipmentIds) {
      // Dual lookup shipment doc
      let targetDoc = await db.collection('shipments').doc(inputId).get();
      if (!targetDoc.exists) {
        const snap = await db.collection('shipments').where('shipmentID', '==', inputId).limit(1).get();
        if (!snap.empty) targetDoc = snap.docs[0];
      }
      if (!targetDoc.exists) continue;
      const data = targetDoc.data();
      if (data.companyID !== companyId) continue;

      await db.collection('shipments').doc(targetDoc.id).update({
        invoiceStatus: statusCode,
        invoiceStatusLabel: statusLabel,
        invoiceStatusUpdatedAt: FieldValue.serverTimestamp()
      });
      updated += 1;
    }

    return res.json({ success: true, updated });
  } catch (err) {
    console.error('markShipmentsReadyToInvoice error:', err);
    return res.status(500).json({ error: err.message || 'Failed to update shipments' });
  }
});


