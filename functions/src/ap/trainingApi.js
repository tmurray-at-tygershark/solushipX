const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { Storage } = require('@google-cloud/storage');
const axios = require('axios');
const crypto = require('crypto');
const { VertexAI } = require('@google-cloud/vertexai');

const db = admin.firestore();
const storage = new Storage();
const bucket = storage.bucket('solushipx.firebasestorage.app');

function makeId(prefix = 'ex') {
  return `${prefix}_${Math.random().toString(36).slice(2,10)}_${Date.now()}`;
}

function hashText(text) {
  return crypto.createHash('sha1').update(text || '').digest('hex').slice(0,16);
}

exports.uploadTrainingSamples = onCall({ cors: true, timeoutSeconds: 300 }, async (request) => {
  if (!request.auth) throw new Error('Authentication required');
  const { carrierId, samples } = request.data || {};
  if (!carrierId || !Array.isArray(samples) || samples.length === 0) {
    return { success: false, message: 'carrierId and samples[] are required' };
  }
  const results = [];
  for (const s of samples) {
    const { fileName, base64 } = s;
    const id = makeId('sample');
    const path = `ap-training/${carrierId}/${id}_${(fileName||'sample.pdf').replace(/[^a-zA-Z0-9_.-]/g,'_')}`;
    const file = bucket.file(path);
    await file.save(Buffer.from(base64, 'base64'), { metadata: { contentType: 'application/pdf' } });
    await file.makePublic();
    const downloadURL = `https://storage.googleapis.com/${bucket.name}/${path}`;
    const ref = db.collection('carrierInvoiceExamples').doc(carrierId).collection('examples').doc(id);
    await ref.set({
      carrierId, fileName, filePath: path, downloadURL,
      status: 'uploaded', createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    results.push({ exampleId: id, downloadURL });
  }
  return { success: true, results };
});

exports.extractTrainingFeatures = onCall({ cors: true, timeoutSeconds: 300 }, async (request) => {
  if (!request.auth) throw new Error('Authentication required');
  const { carrierId, exampleId } = request.data || {};
  if (!carrierId || !exampleId) return { success: false, message: 'carrierId and exampleId required' };
  const ref = db.collection('carrierInvoiceExamples').doc(carrierId).collection('examples').doc(exampleId);
  const snap = await ref.get();
  if (!snap.exists) return { success: false, message: 'example not found' };
  const ex = snap.data();

  const vertex_ai = new VertexAI({ project: 'solushipx', location: 'us-central1', keyFilename: './service-account.json' });
  const model = vertex_ai.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const arr = (await axios.get(ex.downloadURL, { responseType: 'arraybuffer' })).data;
  const requestPayload = {
    contents: [{
      role: 'user',
      parts: [
        { text: 'From this PDF, extract: 1) header tokens, 2) table column headers, 3) any invoice number(s) visible on the document, and 4) a regex that would match this style of invoice number. Return compact JSON strictly in the form { headerTokens:[..], columnHeaders:[..], invoiceNumbers:[..], invoiceNumberRegex:"..." } without extra commentary.' },
        { inlineData: { mimeType: 'application/pdf', data: Buffer.from(arr).toString('base64') } }
      ]
    }]
  };
  let headerTokens = [], columnHeaders = [], invoiceNumbers = [], invoiceNumberRegex = '';
  try {
    const resp = await model.generateContent(requestPayload);
    const txt = resp?.response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = JSON.parse(txt.trim());
    headerTokens = Array.isArray(parsed.headerTokens) ? parsed.headerTokens : [];
    columnHeaders = Array.isArray(parsed.columnHeaders) ? parsed.columnHeaders : [];
    invoiceNumbers = Array.isArray(parsed.invoiceNumbers) ? parsed.invoiceNumbers : [];
    invoiceNumberRegex = typeof parsed.invoiceNumberRegex === 'string' ? parsed.invoiceNumberRegex : '';
  } catch (e) {
    // fallback to empty tokens
  }
  const signature = hashText((headerTokens.join('|') + '::' + columnHeaders.join('|')).toUpperCase());
  await ref.set({
    anchors: { headerTokens, columnHeaders },
    layoutHash: signature,
    status: 'features_extracted',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    patternHints: { invoiceNumberRegex: invoiceNumberRegex || null },
    detected: { invoiceNumbers }
  }, { merge: true });
  return { success: true, anchors: { headerTokens, columnHeaders }, layoutHash: signature };
});

exports.upsertCarrierTemplate = onCall({ cors: true, timeoutSeconds: 300 }, async (request) => {
  if (!request.auth) throw new Error('Authentication required');
  const { carrierId, exampleIds = [], confidenceThreshold = 0.85, templateName = '' } = request.data || {};
  if (!carrierId || exampleIds.length === 0) return { success: false, message: 'carrierId and exampleIds[] required' };
  const examplesSnap = await db.getAll(...exampleIds.map(id => db.collection('carrierInvoiceExamples').doc(carrierId).collection('examples').doc(id)));
  const headerSet = new Set(); const columnSet = new Set();
  const regexVotes = new Map();
  for (const s of examplesSnap) {
    const d = s.data();
    (d?.anchors?.headerTokens||[]).forEach(t => headerSet.add(t));
    (d?.anchors?.columnHeaders||[]).forEach(t => columnSet.add(t));
    const regex = d?.patternHints?.invoiceNumberRegex;
    if (regex && typeof regex === 'string') {
      regexVotes.set(regex, (regexVotes.get(regex) || 0) + 1);
    }
  }
  const layoutHash = examplesSnap[0]?.data()?.layoutHash || 'default';
  // Choose the most frequent regex or a sensible generic fallback
  const bestRegex = Array.from(regexVotes.entries()).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'Invoice\s*#\s*([A-Za-z0-9-]+)';
  const tmplCol = db.collection('carrierInvoiceTemplates').doc(carrierId).collection('templates');
  const newRef = tmplCol.doc();
  await newRef.set({
    carrierId, version: 1, layoutHash, confidenceThreshold,
    name: templateName || `Template ${newRef.id.slice(0,6)}`,
    anchors: { headerTokens: Array.from(headerSet), columnHeaders: Array.from(columnSet) },
    patterns: { invoiceNumber: bestRegex, tracking: '', customerRef: '', total: '', taxes: '' },
    tableSchema: Array.from(columnSet).map(h => ({ key: h.toLowerCase().replace(/[^a-z0-9]+/g,'_'), header: h, type: 'string' })),
    fewShotPromptSnippets: [], stats: { used: 0, avgConfidence: 0, lastUsedAt: null },
    createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { success: true, templateId: newRef.id };
});

exports.getBestTemplateForPdf = onCall({ cors: true, timeoutSeconds: 120 }, async (request) => {
  const { carrierId, layoutSignature } = request.data || {};
  if (!carrierId) return { success: false, message: 'carrierId required' };
  const tmplCol = db.collection('carrierInvoiceTemplates').doc(carrierId).collection('templates');
  let best = null;
  if (layoutSignature) {
    const q = await tmplCol.where('layoutHash', '==', layoutSignature).limit(1).get();
    if (!q.empty) best = { id: q.docs[0].id, ...q.docs[0].data() };
  }
  if (!best) {
    const q = await tmplCol.orderBy('createdAt','desc').limit(1).get();
    if (!q.empty) best = { id: q.docs[0].id, ...q.docs[0].data() };
  }
  return { success: true, template: best };
});

exports.recordExtractionFeedback = onCall({ cors: true, timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) throw new Error('Authentication required');
  const { carrierId, exampleId, expectedJson } = request.data || {};
  if (!carrierId || !exampleId) return { success: false, message: 'carrierId & exampleId required' };
  const ref = db.collection('carrierInvoiceExamples').doc(carrierId).collection('examples').doc(exampleId);
  await ref.set({ expectedJson: expectedJson || null, humanFeedback: 'accepted', updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  return { success: true };
});

exports.listTrainingSamples = onCall({ cors: true, timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) throw new Error('Authentication required');
  const { carrierId, limit = 100 } = request.data || {};
  if (!carrierId) return { success: false, message: 'carrierId required' };
  const snap = await db.collection('carrierInvoiceExamples').doc(carrierId).collection('examples').orderBy('createdAt','desc').limit(limit).get();
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return { success: true, items };
});

exports.listCarrierTemplates = onCall({ cors: true, timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) throw new Error('Authentication required');
  const { carrierId, limit = 50 } = request.data || {};
  if (!carrierId) return { success: false, message: 'carrierId required' };
  const snap = await db.collection('carrierInvoiceTemplates').doc(carrierId).collection('templates').orderBy('createdAt','desc').limit(limit).get();
  const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return { success: true, items };
});

// Aggregate list over carriers and per-carrier summary
exports.listTrainedCarriers = onCall({ cors: true, timeoutSeconds: 300 }, async (request) => {
  if (!request.auth) throw new Error('Authentication required');
  // IMPORTANT: Invoice carriers are independent of system carriers.
  // Use collectionGroup queries to find carriers with training data even if parent docs were not created.
  const NAME_BY_ID = {
    purolator: 'Purolator',
    canadapost: 'Canada Post',
    fedex: 'FedEx',
    ups: 'UPS',
    canpar: 'Canpar',
    dhl: 'DHL',
    tnt: 'TNT',
    landliner: 'Landliner Inc'
  };

  // Aggregate templates stats by carrierId
  const templateSnap = await db.collectionGroup('templates').get();
  const byCarrier = new Map();
  templateSnap.forEach(doc => {
    const carrierId = doc.ref.parent.parent.id; // carrierInvoiceTemplates/{carrierId}/templates/{id}
    const data = doc.data() || {};
    const stats = data.stats || {};
    const rec = byCarrier.get(carrierId) || { templates: 0, avgSum: 0, used: 0, lastUsedAt: null };
    rec.templates += 1;
    if (typeof stats.avgConfidence === 'number') rec.avgSum += stats.avgConfidence;
    if (typeof stats.used === 'number') rec.used += stats.used;
    if (stats.lastUsedAt?.toDate) {
      const d = stats.lastUsedAt.toDate();
      if (!rec.lastUsedAt || d > rec.lastUsedAt) rec.lastUsedAt = d;
    }
    byCarrier.set(carrierId, rec);
  });

  // Also include carriers that have only examples
  const examplesSnap = await db.collectionGroup('examples').get();
  examplesSnap.forEach(doc => {
    const carrierId = doc.ref.parent.parent.id; // carrierInvoiceExamples/{carrierId}/examples/{id}
    if (!byCarrier.has(carrierId)) byCarrier.set(carrierId, { templates: 0, avgSum: 0, used: 0, lastUsedAt: null });
  });

  const rows = Array.from(byCarrier.entries()).map(([carrierId, rec]) => ({
    carrierId,
    name: NAME_BY_ID[carrierId] || carrierId,
    templates: rec.templates || 0,
    avgConfidence: (rec.templates ? rec.avgSum / rec.templates : 0),
    used: rec.used || 0,
    lastUsedAt: rec.lastUsedAt || null
  }));

  return { success: true, items: rows };
});

exports.getTrainingSummary = onCall({ cors: true, timeoutSeconds: 300 }, async (request) => {
  if (!request.auth) throw new Error('Authentication required');
  const { carrierId } = request.data || {};
  if (!carrierId) return { success: false, message: 'carrierId required' };
  const exSnap = await db.collection('carrierInvoiceExamples').doc(carrierId).collection('examples').get();
  const tmplSnap = await db.collection('carrierInvoiceTemplates').doc(carrierId).collection('templates').get();
  const total = exSnap.size;
  const coverage = [];
  tmplSnap.forEach(t => {
    const th = t.data().layoutHash;
    const covered = exSnap.docs.filter(e => (e.data().layoutHash||'') === th).length;
    coverage.push({ templateId: t.id, layoutHash: th, covered, total, percent: total ? covered/total : 0 });
  });
  return { success: true, coverage, totalExamples: total };
});

exports.updateCarrierTemplateMetadata = onCall({ cors: true, timeoutSeconds: 120 }, async (request) => {
  if (!request.auth) throw new Error('Authentication required');
  const { carrierId, templateId, name, confidenceThreshold, invoiceNumberPattern } = request.data || {};
  if (!carrierId || !templateId) return { success: false, message: 'carrierId & templateId required' };
  const ref = db.collection('carrierInvoiceTemplates').doc(carrierId).collection('templates').doc(templateId);
  const updates = { updatedAt: admin.firestore.FieldValue.serverTimestamp() };
  if (typeof name === 'string') updates.name = name;
  if (typeof confidenceThreshold === 'number') updates.confidenceThreshold = confidenceThreshold;
  if (typeof invoiceNumberPattern === 'string') updates['patterns.invoiceNumber'] = invoiceNumberPattern;
  await ref.set(updates, { merge: true });
  return { success: true };
});


