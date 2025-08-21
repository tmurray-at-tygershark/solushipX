const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const axios = require('axios');
const { VertexAI } = require('@google-cloud/vertexai');

// Reuse DB
const db = admin.firestore();

// Local page classifier (duplicated lightweight logic)
async function classifyPagesWithAIInline(pdfUrl) {
  const vertex_ai = new VertexAI({ project: 'solushipx', location: 'us-central1', keyFilename: './service-account.json' });
  const model = vertex_ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const buffer = (await axios.get(pdfUrl, { responseType: 'arraybuffer' })).data;
  const request = {
    contents: [
      {
        role: 'user',
        parts: [
          { text: 'Classify each page as invoice|bol|confirmation|other; return JSON { pages: [{ index, type }], multiDocument }' },
          { inlineData: { mimeType: 'application/pdf', data: Buffer.from(buffer).toString('base64') } }
        ]
      }
    ]
  };
  const res = await model.generateContent(request);
  const txt = res?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  try {
    const parsed = JSON.parse(txt.trim());
    if (Array.isArray(parsed.pages)) return parsed;
  } catch (_) {}
  return { pages: [{ index: 1, type: 'unknown' }], multiDocument: false };
}

// Simple reconciliation stub (will be expanded): compares invoice total to existing quote total
function reconcileInvoiceAgainstShipment(invoice, shipment) {
  const quoted = Number(shipment?.markupRates?.totalCharges || shipment?.updatedCharges?.totalCharges || 0);
  const actual = Number(invoice?.totalAmount || 0);
  const variance = actual - quoted;
  const matches = Math.abs(variance) < 0.01; // exact within 1 cent
  return {
    quoted,
    actual,
    variance,
    status: matches ? 'balanced' : 'exception'
  };
}

exports.processApUpload = onCall({ timeoutSeconds: 540, memory: '1GiB', cors: true }, async (request) => {
  const { uploadUrl, fileName, apUploadId } = request.data || {};
  if (!request.auth) throw new Error('Authentication required');
  if (!uploadUrl) throw new Error('uploadUrl is required');

  // Fetch apUploads doc if id provided
  const apRef = apUploadId ? db.collection('apUploads').doc(apUploadId) : null;

  // Step 1: classify pages
  let pageClassification = null;
  try {
    pageClassification = await classifyPagesWithAIInline(uploadUrl);
  } catch (e) {
    console.warn('AP Orchestrator page classification failed:', e.message);
  }

  // Step 2: minimal structured output placeholder (we rely on existing pdfResults for now)
  const result = {
    success: true,
    fileName,
    uploadUrl,
    pageClassification,
  };

  // Persist classification onto apUploads for UI consumption
  if (apRef) {
    await apRef.set({
      metadata: {
        ...(pageClassification ? { pageClassification } : {})
      }
    }, { merge: true });
  }

  return result;
});

// Reconcile parsed invoice data against matched shipments and optionally update invoiceStatus
exports.processApReconcile = onCall({ timeoutSeconds: 300, memory: '512MiB', cors: true }, async (request) => {
  const { pdfResultsId, apply = false } = request.data || {};
  if (!request.auth) throw new Error('Authentication required');
  if (!pdfResultsId) throw new Error('pdfResultsId is required');

  const resultsRef = db.collection('pdfResults').doc(pdfResultsId);
  const snap = await resultsRef.get();
  if (!snap.exists) return { success: false, message: 'pdfResults not found' };
  const data = snap.data();

  const matches = data?.matchingResults?.matches || [];
  const outcomes = [];
  let balanced = 0, exceptions = 0, errors = 0;

  for (const match of matches) {
    try {
      if (!match?.bestMatch?.shipment) {
        outcomes.push({ status: 'error', reason: 'No matched shipment', invoice: match?.invoiceShipment?.references?.customerRef || match?.invoiceShipment?.shipmentId });
        errors++;
        continue;
      }
      const invoice = match.invoiceShipment || {};
      const shipHint = match.bestMatch.shipment;

      // Dual lookup: Firestore doc id, then shipmentID field
      let shipDoc = await db.collection('shipments').doc(shipHint.id || '').get();
      if (!shipDoc.exists) {
        const q = await db.collection('shipments').where('shipmentID', '==', shipHint.shipmentID || shipHint.id).limit(1).get();
        if (!q.empty) shipDoc = q.docs[0];
      }
      if (!shipDoc.exists) {
        outcomes.push({ status: 'error', reason: 'Shipment not found', invoice: invoice?.references?.customerRef || invoice?.shipmentId, candidate: shipHint });
        errors++;
        continue;
      }

      const shipment = shipDoc.data();
      const quoted = Number(shipment?.markupRates?.totalCharges || shipment?.updatedCharges?.totalCharges || shipment?.selectedRate?.totalCharges || 0);
      const invoiceAmount = Number(invoice?.totalAmount || 0);
      const variance = invoiceAmount - quoted;
      const isBalanced = Math.abs(variance) < 0.01; // within 1 cent

      const detail = {
        shipmentId: shipment.shipmentID || shipDoc.id,
        quoted,
        actual: invoiceAmount,
        variance,
        status: isBalanced ? 'balanced' : 'exception',
        reasons: isBalanced ? [] : [
          `Quoted ${quoted.toFixed(2)} vs Invoice ${invoiceAmount.toFixed(2)} (${variance > 0 ? '+' : ''}${variance.toFixed(2)})`
        ]
      };

      if (apply) {
        const newStatus = isBalanced ? 'draft' : 'exception';
        await shipDoc.ref.set({ invoiceStatus: newStatus }, { merge: true });
        detail.applied = true;
        detail.newInvoiceStatus = newStatus;
      }
      outcomes.push(detail);
      if (isBalanced) balanced++; else exceptions++;
    } catch (e) {
      outcomes.push({ status: 'error', reason: e.message });
      errors++;
    }
  }

  return { success: true, counts: { balanced, exceptions, errors }, details: outcomes };
});


