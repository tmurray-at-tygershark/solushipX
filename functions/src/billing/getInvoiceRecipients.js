const { onRequest } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Admin once
try { initializeApp(); } catch (_) {}
const db = getFirestore();

const orchestrator = require('./invoiceOrchestrator');

function splitEmails(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  // Split on semicolons or commas
  return String(value)
    .split(/[;,]/)
    .map(s => s.trim())
    .filter(Boolean);
}

function normalizeEmails(target) {
  const set = new Set();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  (target || []).forEach(e => {
    if (emailRegex.test(e)) set.add(e.toLowerCase());
  });
  return Array.from(set);
}

exports.getInvoiceRecipients = onRequest({ cors: ['https://solushipx.web.app', 'http://localhost:3000'], timeoutSeconds: 120 }, async (req, res) => {
  const origin = req.headers.origin;
  if (origin && ['https://solushipx.web.app','http://localhost:3000'].includes(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
  } else {
    res.set('Access-Control-Allow-Origin', '*');
  }
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.set('Vary', 'Origin');
  if (req.method === 'OPTIONS') return res.status(200).send('');

  try {
    const { companyId, invoiceMode = 'separate', invoiceIssueDate = null, invoiceNumberOverride = null, filters = {} } = req.body || {};
    if (!companyId) return res.status(400).json({ error: 'Company ID required' });

    // Build shipments query (same logic as preview)
    let baseQuery = db.collection('shipments')
      .where('companyID', '==', companyId)
      .where('status', '!=', 'draft');

    let shipments = [];

    if (filters.shipmentIds && filters.shipmentIds.length > 0) {
      const batches = [];
      for (let i = 0; i < filters.shipmentIds.length; i += 10) {
        batches.push(filters.shipmentIds.slice(i, i + 10));
      }
      for (const batch of batches) {
        const snap = await baseQuery.where('shipmentID', 'in', batch).get();
        shipments.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } else {
      const snap = await baseQuery.get();
      shipments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    if (filters.customers && filters.customers.length > 0) {
      shipments = shipments.filter(s => {
        const cid = s.shipTo?.customerID || s.customerID;
        return filters.customers.includes(cid);
      });
    }

    if (shipments.length === 0) {
      return res.json({ success: true, recipients: { to: [] }, details: [] });
    }

    // Build invoice datas (peek numbers; we don't need reservation here)
    const { invoiceDatas } = await orchestrator.buildInvoiceDatas({
      shipments,
      companyId,
      invoiceMode,
      invoiceIssueDate,
      invoiceNumberOverride,
      numberingOptions: { useOfficialForTest: true }
    });

    const allEmails = [];
    const details = [];
    for (const inv of invoiceDatas) {
      const billTo = inv.billTo || {};
      const candidates = [
        ...splitEmails(billTo.billingEmail),
        ...splitEmails(billTo.email),
        ...splitEmails(billTo?.billingInfo?.email),
      ];
      const normalized = normalizeEmails(candidates);
      normalized.forEach(e => allEmails.push(e));
      details.push({ invoiceNumber: inv.invoiceNumber, billToEmails: normalized });
    }
    const to = normalizeEmails(allEmails);

    return res.json({ success: true, recipients: { to }, details });
  } catch (err) {
    console.error('getInvoiceRecipients error:', err);
    return res.status(500).json({ error: err.message || 'Failed to determine recipients' });
  }
});


