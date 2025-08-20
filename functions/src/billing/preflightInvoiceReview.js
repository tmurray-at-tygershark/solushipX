const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

try { initializeApp(); } catch (_) {}
const db = getFirestore();

const {
  getSimpleShipmentCharges,
  getSimpleChargeBreakdown,
  calculateInvoiceTotals,
  getCustomerBillingInfo
} = require('./bulkInvoiceGenerator');

function toBool(v) { return !!v; }
function normalizeStatus(s) { return String(s || '').toLowerCase(); }

exports.preflightInvoiceReview = onRequest({ cors: true, timeoutSeconds: 300 }, async (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).send('');

  try {
    const { companyId, shipmentIds = [] } = req.body || {};
    if (!companyId || !Array.isArray(shipmentIds) || shipmentIds.length === 0) {
      return res.status(400).json({ error: 'companyId and shipmentIds[] are required' });
    }

    const results = [];

    for (const inputId of shipmentIds) {
      let shipment = null;
      let firestoreId = inputId;

      try {
        // Dual lookup: first try doc ID, then query by shipmentID field
        const direct = await db.collection('shipments').doc(inputId).get();
        if (direct.exists) {
          shipment = { id: direct.id, ...direct.data() };
        } else {
          const snap = await db.collection('shipments').where('shipmentID', '==', inputId).limit(1).get();
          if (!snap.empty) {
            const doc = snap.docs[0];
            shipment = { id: doc.id, ...doc.data() };
            firestoreId = doc.id;
          }
        }
      } catch (_) {}

      if (!shipment) {
        results.push({ shipmentIdInput: inputId, found: false, pass: false, reasons: ['NOT_FOUND'] });
        continue;
      }

      const reasons = [];
      const status = normalizeStatus(shipment.status);
      const invoiceStatus = normalizeStatus(shipment.invoiceStatus || shipment.billingDetails?.invoiceStatus);

      // 3,6,7: status checks
      if (status.includes('exception')) reasons.push('STATUS_EXCEPTION');
      if (status.includes('cancel') || status.includes('void')) reasons.push('STATUS_CANCELLED_OR_VOIDED');
      if (status.includes('draft') || status.includes('pending_review')) reasons.push('STATUS_DRAFT_OR_PENDING_REVIEW');

      // 8: already invoiced
      if (invoiceStatus === 'invoiced' || invoiceStatus === 'paid') reasons.push('ALREADY_INVOICED');

      // 1,2: charges checks
      let chargesOk = false;
      let allChargesHaveAmount = true;
      try {
        const totalCharges = getSimpleShipmentCharges(shipment);
        const breakdown = getSimpleChargeBreakdown(shipment, totalCharges, 'CAD');
        const amounts = breakdown.map(b => Number(b?.amount ?? 0));
        chargesOk = amounts.some(a => a > 0) || Number(totalCharges) > 0;
        allChargesHaveAmount = breakdown.every(b => b.hasOwnProperty('amount'));
      } catch (e) {
        reasons.push('CHARGES_PARSE_ERROR');
      }
      if (!chargesOk) reasons.push('NO_POSITIVE_CHARGE');
      if (!allChargesHaveAmount) reasons.push('MISSING_ACTUAL_CHARGE_FIELD');

      // 4: BILL TO completeness
      let billToOk = false;
      try {
        const billTo = await getCustomerBillingInfo(shipment, companyId);
        const addr = billTo?.billingAddress || billTo?.address || {};
        const requiredAddr = [addr.street, addr.city, addr.state, addr.postalCode, addr.country].every(toBool);
        const hasEmail = !!(billTo?.billingEmail || billTo?.email);
        billToOk = requiredAddr && hasEmail && !!billTo?.companyName;
        if (!billToOk) reasons.push('BILLTO_INCOMPLETE');
      } catch (e) {
        reasons.push('BILLTO_LOOKUP_FAILED');
      }

      const pass = reasons.length === 0;
      results.push({
        shipmentIdInput: inputId,
        firestoreId,
        companyId: shipment.companyID,
        customerId: shipment.shipTo?.customerID || shipment.customerID || null,
        pass,
        reasons
      });
    }

    const summary = {
      total: results.length,
      passed: results.filter(r => r.pass).length,
      failed: results.filter(r => !r.pass).length
    };

    return res.json({ success: true, summary, results });
  } catch (err) {
    console.error('preflightInvoiceReview error:', err);
    return res.status(500).json({ error: err.message || 'Failed to run preflight review' });
  }
});


