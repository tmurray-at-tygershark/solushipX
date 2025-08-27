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

/**
 * COMPREHENSIVE ACTUAL CHARGES VALIDATION
 * Checks all possible storage formats for actual charges:
 * 1. actualRates.charges (AI/AP processing)
 * 2. manualRates (QuickShip shipments)
 * 3. updatedCharges/chargesBreakdown (inline editing)
 * 4. markupRates.charges (dual rate system)
 */
function checkForActualCharges(shipment) {
  // 1. Check actualRates.charges (AI/AP processing format)
  if (shipment.actualRates?.totalCharges) {
    const actualTotal = parseFloat(shipment.actualRates.totalCharges) || 0;
    if (actualTotal > 0) {
      const actualChargesArray = shipment.actualRates.charges || [];
      const actualAmounts = actualChargesArray.map(c => parseFloat(c.amount) || parseFloat(c.actualCharge) || 0);
      if (actualAmounts.some(a => a > 0)) return true;
    }
  }

  // 2. Check manualRates (QuickShip format)
  if (shipment.manualRates && Array.isArray(shipment.manualRates)) {
    const manualAmounts = shipment.manualRates.map(r => {
      // Check both actualCharge and charge/cost fields
      return parseFloat(r.actualCharge) || parseFloat(r.charge) || parseFloat(r.cost) || 0;
    });
    if (manualAmounts.some(a => a > 0)) return true;
  }

  // 3. Check updatedCharges/chargesBreakdown (inline editing format)
  const chargesArrays = [
    shipment.updatedCharges,
    shipment.chargesBreakdown,
    shipment.charges
  ].filter(arr => Array.isArray(arr));
  
  for (const chargesArray of chargesArrays) {
    const amounts = chargesArray.map(c => {
      // Check multiple possible actual charge fields
      return parseFloat(c.actualCharge) || parseFloat(c.actualCost) || 
             parseFloat(c.amount) || parseFloat(c.charge) || 0;
    });
    if (amounts.some(a => a > 0)) return true;
  }

  // 4. Check markupRates.charges (dual rate system)
  if (shipment.markupRates?.totalCharges) {
    const markupTotal = parseFloat(shipment.markupRates.totalCharges) || 0;
    if (markupTotal > 0) {
      const markupChargesArray = shipment.markupRates.charges || [];
      const markupAmounts = markupChargesArray.map(c => parseFloat(c.amount) || parseFloat(c.actualCharge) || 0);
      if (markupAmounts.some(a => a > 0)) return true;
    }
  }

  // 5. Check legacy format totalCharges fields
  const legacyTotals = [
    shipment.totalCharges,
    shipment.totalActualCharges,
    shipment.actualTotalCharges
  ];
  for (const total of legacyTotals) {
    if (parseFloat(total) > 0) return true;
  }

  // 6. Check if shipment has been marked as having actual costs
  if (shipment.hasActualCosts === true) return true;

  return false;
}

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
      let actualChargesOk = false;
      try {
        const totalCharges = getSimpleShipmentCharges(shipment);
        const breakdown = getSimpleChargeBreakdown(shipment, totalCharges, 'CAD');
        const amounts = breakdown.map(b => Number(b?.amount ?? 0));
        chargesOk = amounts.some(a => a > 0) || Number(totalCharges) > 0;
        allChargesHaveAmount = breakdown.every(b => b.hasOwnProperty('amount'));
        
        // ✅ ENHANCED: Check for actual charges across ALL possible storage formats
        actualChargesOk = checkForActualCharges(shipment);
      } catch (e) {
        reasons.push('CHARGES_PARSE_ERROR');
      }
      if (!chargesOk) reasons.push('NO_POSITIVE_CHARGE');
      if (!allChargesHaveAmount) reasons.push('MISSING_ACTUAL_CHARGE_FIELD');
      // ✅ ENHANCED: Block invoicing only if NO actual charges found in ANY format
      if (!actualChargesOk) reasons.push('NO_ACTUAL_CHARGES_SET');

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


