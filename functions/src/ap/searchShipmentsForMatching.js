const { onCall } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

// Simple OCR confusion map for shipment/reference searches
function generateOcrVariations(text) {
  if (!text || typeof text !== 'string') return [];
  const mappings = {
    '0': ['O', '0', 'Q'],
    'O': ['0', 'O', 'Q'],
    'Q': ['0', 'O', 'Q'],
    '1': ['I', '1', 'l'],
    'I': ['1', 'I', 'l'],
    'l': ['1', 'I', 'l'],
    '5': ['S', '5'],
    'S': ['5', 'S'],
    '8': ['B', '8'],
    'B': ['8', 'B'],
    '6': ['G', '6'],
    'G': ['6', 'G'],
    '2': ['Z', '2'],
    'Z': ['2', 'Z'],
    'D': ['0', 'D']
  };
  const variants = new Set();
  const upper = text.toUpperCase();
  for (let i = 0; i < upper.length; i++) {
    const ch = upper[i];
    if (mappings[ch]) {
      for (const rep of mappings[ch]) {
        if (rep !== ch) {
          variants.add(upper.slice(0, i) + rep + upper.slice(i + 1));
        }
      }
    }
  }
  return Array.from(variants);
}

exports.searchShipmentsForMatching = onCall({ cors: true, timeoutSeconds: 60 }, async (request) => {
  try {
    const db = admin.firestore();
    const { searchTerm } = request.data || {};
    if (!request.auth) {
      throw new Error('Authentication required');
    }
    if (!searchTerm || typeof searchTerm !== 'string') {
      return { success: false, message: 'searchTerm is required' };
    }
    const term = searchTerm.trim();
    const candidates = new Set([term.toUpperCase(), ...generateOcrVariations(term)]);

    const matches = [];
    // Try direct shipmentID equality lookups for each variant
    for (const candidate of candidates) {
      const q1 = await db.collection('shipments').where('shipmentID', '==', candidate).limit(5).get();
      q1.forEach(doc => matches.push({ id: doc.id, ...doc.data() }));
      // Tracking number locations (common fields)
      const q2 = await db.collection('shipments').where('shipmentInfo.carrierTrackingNumber', '==', candidate).limit(5).get();
      q2.forEach(doc => matches.push({ id: doc.id, ...doc.data() }));
    }

    // Deduplicate by Firestore doc id
    const seen = new Set();
    const deduped = matches.filter(m => {
      if (seen.has(m.id)) return false;
      seen.add(m.id);
      return true;
    }).slice(0, 20);

    // Map to UI-friendly minimal data
    const results = deduped.map(s => ({
      shipment: {
        id: s.id,
        shipmentID: s.shipmentID || s.id,
        selectedCarrier: s.selectedCarrier || s.selectedRate?.carrier?.name || s.carrier || 'Unknown',
        bookedAt: s.bookedAt || s.createdAt,
        shipFrom: s.shipFrom || s.shipmentInfo?.shipFrom || {},
        shipTo: s.shipTo || s.shipmentInfo?.shipTo || {},
        totalCharges: s.updatedCharges?.totalCharges || s.markupRates?.totalCharges || s.actualRates?.totalCharges || 0
      },
      confidence: 0.7,
      matchStrategy: 'manual_search'
    }));

    return { success: true, matches: results };
  } catch (err) {
    console.error('searchShipmentsForMatching error:', err);
    return { success: false, message: err.message };
  }
});


