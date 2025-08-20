const { getFirestore } = require('firebase-admin/firestore');
const db = getFirestore();

// Reuse core helpers and templates
const { generateInvoicePDF, generateInvoiceEmailHTML, generateInvoiceEmailText, getNextInvoiceNumber, getPeekInvoiceNumber } = require('../generateInvoicePDFAndEmail');

// Import shared billing helpers for consistent totals and references
const {
  getSimpleShipmentCharges,
  getSimpleChargeBreakdown,
  calculateInvoiceTotals,
  detectSimpleCurrency,
  calculateTotalWeight,
  getActualCustomerName,
  getCustomerBillingInfo,
  getInvoiceCompanyInfo,
  getAllReferenceNumbers
} = require('./bulkInvoiceGenerator');

// Build invoice data for a single shipment
async function buildInvoiceForShipment({ shipment, companyId, customerName, currency, companyInfo, issueDate, invoiceNumberOverride, sequenceNumber, numberingOptions }) {
  const charges = getSimpleShipmentCharges(shipment);
  const shipmentId = shipment.shipmentID || shipment.id;

  // Decide invoice number strategy
  let invoiceNumber;
  if (invoiceNumberOverride && invoiceNumberOverride.trim()) {
    invoiceNumber = sequenceNumber ? `${invoiceNumberOverride.trim()}-${sequenceNumber}` : invoiceNumberOverride.trim();
  } else {
    if (numberingOptions?.isOfficialSend) {
      invoiceNumber = await getNextInvoiceNumber();
    } else if (numberingOptions?.useOfficialForTest) {
      // Peek without reserving so actual send can reuse the same numbers
      const peek = await getPeekInvoiceNumber();
      invoiceNumber = sequenceNumber ? `${peek}-${sequenceNumber}` : peek;
    } else {
      const base = `TEST-${Date.now()}`;
      invoiceNumber = sequenceNumber ? `${base}-${sequenceNumber}` : base;
    }
  }

  const breakdown = getSimpleChargeBreakdown(shipment, charges, currency);
  const totals = calculateInvoiceTotals(breakdown);
  const filteredCharges = totals.total;

  // Build BILL TO using the proven helper so field mapping matches prior perfect output
  let billTo = null;
  try {
    billTo = await getCustomerBillingInfo(shipment, companyId);
  } catch (_) {}

  return {
    invoiceNumber,
    companyId,
    customerId: shipment?.shipTo?.customerID || shipment?.customerID || null,
    companyName: (billTo?.companyName) || companyInfo.companyName || customerName || companyId,
    billTo,
    lineItems: [{
      shipmentId,
      orderNumber: shipmentId,
      trackingNumber: shipment.trackingNumber || shipment.carrierTrackingNumber || 'Pending',
      description: `Shipment from ${shipment.shipFrom?.city || 'N/A'} to ${shipment.shipTo?.city || 'N/A'}`,
      carrier: companyInfo?.billingInfo?.companyDisplayName || companyInfo?.name || 'Integrated Carriers',
      service: shipment.service || 'Standard',
      date: shipment.shipmentDate || shipment.bookedAt || shipment.createdAt || new Date(),
      charges: filteredCharges,
      chargeBreakdown: breakdown,
      packages: shipment.packages?.length || shipment.packageCount || 1,
      weight: calculateTotalWeight(shipment),
      weightUnit: shipment.weightUnit || 'lbs',
      shipFrom: shipment.shipFrom,
      shipTo: shipment.shipTo,
      allReferenceNumbers: getAllReferenceNumbers(shipment)
    }],
    currency,
    issueDate: issueDate ? new Date(issueDate) : new Date(),
    dueDate: issueDate ? new Date(new Date(issueDate).getTime() + 30 * 24 * 60 * 60 * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    paymentTerms: 'NET 30',
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total,
    taxBreakdown: totals.taxBreakdown,
    hasQuebecTaxes: totals.hasQuebecTaxes
  };
}

// Build combined invoice data for a customer
async function buildCombinedInvoiceForCustomer({ customerName, shipments, companyId, currency, companyInfo, issueDate, invoiceNumberOverride, numberingOptions }) {
  const lineItems = [];
  const allBreakdowns = [];

  for (const shipment of shipments) {
    const charges = getSimpleShipmentCharges(shipment);
    const shipmentId = shipment.shipmentID || shipment.id;
    const breakdown = getSimpleChargeBreakdown(shipment, charges, currency);
    allBreakdowns.push(...breakdown);

    const shipmentTotals = calculateInvoiceTotals(breakdown);
    const filteredCharges = shipmentTotals.total;

    lineItems.push({
      shipmentId,
      orderNumber: shipmentId,
      trackingNumber: shipment.trackingNumber || shipment.carrierTrackingNumber || 'Pending',
      description: `Shipment from ${shipment.shipFrom?.city || 'N/A'} to ${shipment.shipTo?.city || 'N/A'}`,
      carrier: companyInfo?.billingInfo?.companyDisplayName || companyInfo?.name || 'Integrated Carriers',
      service: shipment.service || 'Standard',
      date: shipment.shipmentDate || shipment.bookedAt || shipment.createdAt || new Date(),
      charges: filteredCharges,
      chargeBreakdown: breakdown,
      packages: shipment.packages?.length || shipment.packageCount || 1,
      weight: calculateTotalWeight(shipment),
      weightUnit: shipment.weightUnit || 'lbs',
      shipFrom: shipment.shipFrom,
      shipTo: shipment.shipTo,
      allReferenceNumbers: getAllReferenceNumbers(shipment)
    });
  }

  let invoiceNumber;
  if (invoiceNumberOverride && invoiceNumberOverride.trim()) {
    invoiceNumber = invoiceNumberOverride.trim();
  } else {
    if (numberingOptions?.isOfficialSend) {
      invoiceNumber = await getNextInvoiceNumber();
    } else if (numberingOptions?.useOfficialForTest) {
      invoiceNumber = await getPeekInvoiceNumber();
    } else {
      invoiceNumber = `TEST-${Date.now()}`;
    }
  }

  const totals = calculateInvoiceTotals(allBreakdowns);

  // BILL TO from first shipment using the same proven logic
  let billTo = null;
  try {
    billTo = await getCustomerBillingInfo(shipments[0], companyId);
  } catch (_) {}

  return {
    invoiceNumber,
    companyId,
    customerId: shipments?.[0]?.shipTo?.customerID || shipments?.[0]?.customerID || null,
    companyName: (billTo?.companyName) || companyInfo?.companyName || customerName || companyId,
    billTo,
    lineItems,
    currency,
    issueDate: issueDate ? new Date(issueDate) : new Date(),
    dueDate: issueDate ? new Date(new Date(issueDate).getTime() + 30 * 24 * 60 * 60 * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    paymentTerms: 'NET 30',
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total,
    taxBreakdown: totals.taxBreakdown,
    hasQuebecTaxes: totals.hasQuebecTaxes
  };
}

// Build invoice data array based on mode
async function buildInvoiceDatas({ shipments, companyId, invoiceMode = 'separate', invoiceIssueDate = null, invoiceNumberOverride = null, numberingOptions = {} }) {
  const currency = detectSimpleCurrency(shipments);
  const companyInfo = await getInvoiceCompanyInfo(companyId);
  const invoiceDatas = [];

  // Setup simulated sequential numbers for test/preview (no reservation)
  let simulateNext = null;
  if (numberingOptions?.useOfficialForTest && !invoiceNumberOverride) {
    const peekStr = await getPeekInvoiceNumber();
    let currentNum = parseInt(peekStr, 10);
    if (isNaN(currentNum)) currentNum = 1000000;
    simulateNext = () => {
      const val = String(currentNum).padStart(7, '0');
      currentNum += 1;
      return val;
    };
  }

  if (invoiceMode === 'separate') {
    let globalSeq = 1;
    const customerGroups = {};
    for (const shipment of shipments) {
      const customerName = await getActualCustomerName(shipment, companyId);
      if (!customerGroups[customerName]) customerGroups[customerName] = [];
      customerGroups[customerName].push(shipment);
    }
    const totalInvoices = Object.values(customerGroups).reduce((sum, arr) => sum + arr.length, 0);
    for (const [customerName, customerShipments] of Object.entries(customerGroups)) {
      for (const shipment of customerShipments) {
        const sequenceNumber = (invoiceNumberOverride && totalInvoices > 1) ? globalSeq : null;
        const perInvoiceOverride = invoiceNumberOverride || (simulateNext ? simulateNext() : null);
        const invoiceData = await buildInvoiceForShipment({
          shipment,
          companyId,
          customerName,
          currency,
          companyInfo,
          issueDate: invoiceIssueDate,
          invoiceNumberOverride: perInvoiceOverride,
          sequenceNumber,
          numberingOptions
        });
        invoiceDatas.push(invoiceData);
        globalSeq++;
      }
    }
  } else {
    // combined
    const customerName = await getActualCustomerName(shipments[0], companyId);
    const perInvoiceOverride = invoiceNumberOverride || (simulateNext ? simulateNext() : null);
    const invoiceData = await buildCombinedInvoiceForCustomer({
      customerName,
      shipments,
      companyId,
      currency,
      companyInfo,
      issueDate: invoiceIssueDate,
      invoiceNumberOverride: perInvoiceOverride,
      numberingOptions
    });
    invoiceDatas.push(invoiceData);
  }

  return { invoiceDatas, currency, companyInfo };
}

// Generate PDFs for all invoice data
async function generatePDFs({ invoiceDatas, companyInfo }) {
  const attachments = [];
  for (const inv of invoiceDatas) {
    const customerBillingInfo = inv.billTo || null;
    const pdfBuffer = await generateInvoicePDF(inv, companyInfo, customerBillingInfo);
    attachments.push({
      content: pdfBuffer.toString('base64'),
      filename: `Invoice_${inv.invoiceNumber}.pdf`,
      type: 'application/pdf',
      disposition: 'attachment',
      invoiceData: inv
    });
  }
  return attachments;
}

// Deliver email with all invoices attached to explicit recipients
async function deliverInvoices({ companyId, recipients, attachments, invoiceMode }) {
  const companyInfo = await getInvoiceCompanyInfo(companyId);
  const sgMail = require('@sendgrid/mail');
  const functions = require('firebase-functions');
  const sendgridApiKey = process.env.SENDGRID_API_KEY || functions.config().sendgrid?.api_key;
  if (!sendgridApiKey) throw new Error('SendGrid API key not configured');
  sgMail.setApiKey(sendgridApiKey);

  const firstInvoiceData = attachments[0]?.invoiceData || {
    invoiceNumber: 'INV-MULTI',
    companyId,
    lineItems: [],
    currency: 'CAD',
    issueDate: new Date(),
    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    paymentTerms: 'NET 30',
    subtotal: 0,
    tax: 0,
    total: 0
  };

  const formatCurrency = (amount, currency = 'USD') => {
    const formatted = parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${currency} $${formatted}`;
  };

  const emailContent = {
    to: recipients?.to || [],
    cc: recipients?.cc && recipients.cc.length > 0 ? recipients.cc : undefined,
    bcc: recipients?.bcc && recipients.bcc.length > 0 ? recipients.bcc : undefined,
    from: {
      email: companyInfo?.billingInfo?.accountsReceivable?.email?.[0] || 'soluship@integratedcarriers.com',
      name: companyInfo?.billingInfo?.companyDisplayName || companyInfo?.name || 'Integrated Carriers'
    },
    subject: `${companyInfo?.billingInfo?.companyDisplayName || companyInfo?.name || 'Integrated Carriers'} - Invoice Notification`,
    html: generateInvoiceEmailHTML(firstInvoiceData, companyInfo, false, formatCurrency),
    text: generateInvoiceEmailText(firstInvoiceData, companyInfo, false, formatCurrency),
    attachments: attachments.map(a => ({ content: a.content, filename: a.filename, type: a.type, disposition: a.disposition }))
  };

  await sgMail.send(emailContent);
}

module.exports = {
  buildInvoiceDatas,
  generatePDFs,
  deliverInvoices
};


