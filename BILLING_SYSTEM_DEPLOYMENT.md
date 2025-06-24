# Enterprise Billing & Invoicing System Deployment Guide

This document outlines the deployment and configuration of the enterprise-level billing and invoicing system for SolushipX.

## Overview

The system includes:
- Customer billing dashboard with credit tracking
- Professional PDF invoice generation
- Email notifications with attachments
- Admin invoice management
- Automatic billing based on shipment charges
- Stripe-inspired UI/UX

## Components Created/Modified

### Frontend Components

#### Customer Billing (`/src/components/Billing/`)
- **BillingDashboard.jsx** - NEW: Credit overview and shipment charges table
- **Billing.jsx** - UPDATED: Added new dashboard tab

#### Admin Billing (`/src/components/Admin/Billing/`)
- **GenerateInvoicesPage.jsx** - ENHANCED: Multi-step invoice generation with real data
- **InvoiceManagement.jsx** - NEW: Complete invoice management interface
- **BillingDashboard.jsx** - UPDATED: Added new components

### Backend Components

#### Cloud Functions (`/functions/src/`)
- **generateInvoicePDFAndEmail.js** - NEW: PDF generation and email sending
- **email/sendgridService.js** - ENHANCED: Added attachment support and invoice templates
- **index.js** - UPDATED: Registered new cloud function

## Features Implemented

### 1. Customer Billing Dashboard

**Location**: `/billing` (first tab: "Dashboard & Charges")

**Features**:
- Credit status overview (Active/On Hold)
- Credit limit tracking
- Current balance (uninvoiced charges)
- Available credit calculation
- Monthly charge summaries
- Detailed shipment charges table with breakdown tooltips
- Search and filtering capabilities

**Data Sources**:
- Company payment terms from `companies` collection
- Shipment data from `shipments` collection
- Uses markup rates (what customer pays) vs actual rates

### 2. Professional Invoice Generation

**Location**: `/admin/billing/generate`

**Features**:
- 4-step invoice generation process
- Real-time uninvoiced shipment fetching
- Company grouping and selection
- Configurable invoice settings (prefix, payment terms, etc.)
- Professional PDF generation matching provided sample
- Automatic email delivery with PDF attachment
- Progress tracking and error handling

**PDF Features**:
- Company branding and letterhead
- Detailed shipment line items
- Charge breakdowns (freight, fuel, accessorial, etc.)
- Tax calculations (configurable HST/GST)
- Payment instructions
- Professional formatting and styling

### 3. Email Notification System

**Features**:
- Professional email templates matching existing system style
- PDF attachment support
- Invoice delivery notifications
- Automatic recipient detection (primary contact, billing contact)
- Error handling and fallback mechanisms

### 4. Admin Invoice Management

**Location**: `/admin/billing/invoices`

**Features**:
- Complete invoice dashboard with metrics
- Status tracking (Pending, Paid, Overdue, Cancelled)
- Search and filtering capabilities
- Detailed invoice views
- Status update functionality
- Resend capabilities
- Export functionality

## Database Structure

### New Collections

#### `invoices`
```javascript
{
  invoiceNumber: "INV-123456",
  companyId: "COMP001",
  companyName: "Company Name",
  issueDate: Date,
  dueDate: Date,
  status: "pending|paid|overdue|cancelled",
  lineItems: [
    {
      shipmentId: "SHIP123",
      description: "Shipment description",
      carrier: "Carrier Name",
      service: "Service Type",
      date: Date,
      charges: 100.00,
      chargeBreakdown: [
        { name: "Freight", amount: 80.00 },
        { name: "Fuel", amount: 20.00 }
      ]
    }
  ],
  subtotal: 100.00,
  tax: 13.00,
  total: 113.00,
  currency: "CAD",
  paymentTerms: "Net 30",
  settings: {},
  createdAt: Date,
  shipmentIds: ["shipment1", "shipment2"]
}
```

### Updated Collections

#### `shipments` - Enhanced with billing fields
```javascript
{
  // Existing fields...
  
  // NEW: Dual rate storage for billing
  actualRates: {
    totalCharges: 100.00,
    freightCharges: 80.00,
    fuelCharges: 15.00,
    serviceCharges: 5.00,
    currency: "CAD"
  },
  markupRates: {
    totalCharges: 110.00,  // What customer pays
    freightCharges: 88.00,
    fuelCharges: 15.00,
    serviceCharges: 7.00,
    markupAmount: 10.00,
    currency: "CAD"
  },
  
  // NEW: Invoice tracking
  invoiced: false,
  invoiceNumber: "INV-123456",
  invoicedAt: Date
}
```

#### `companies` - Enhanced payment terms
```javascript
{
  // Existing fields...
  
  paymentTerms: {
    creditLimit: 5000.00,
    netTerms: 30,
    onCreditHold: false,
    enablePaymentReminders: true,
    lateFeePercentage: 0,
    discountPercentage: 0,
    discountDays: 0,
    notes: "Special terms"
  }
}
```

## Deployment Steps

### 1. Frontend Deployment

1. **Update Components**:
   ```bash
   # All component files are already created/updated
   # Deploy to hosting
   npm run deploy:hosting
   ```

2. **Update Routes** (if needed):
   Ensure routes are configured for:
   - `/billing` - Customer billing dashboard
   - `/admin/billing/generate` - Invoice generation
   - `/admin/billing/invoices` - Invoice management

### 2. Backend Deployment

1. **Deploy Cloud Functions**:
   ```bash
   npm run deploy:functions
   ```

2. **Required Dependencies**:
   All dependencies are already in `package.json`:
   - `pdfkit` - PDF generation
   - `@sendgrid/mail` - Email with attachments
   - `firebase-admin` - Firestore operations

### 3. Email Configuration

1. **SendGrid Setup**:
   - Ensure SendGrid API key is configured
   - Verify sender email domains
   - Test email delivery

2. **Template Verification**:
   The new `invoice_generated` template is added to the existing email system.

### 4. Storage Configuration

1. **Firebase Storage**:
   - PDF invoices are stored in `invoices/` folder
   - Ensure proper security rules
   - Configure cleanup policies if needed

### 5. Database Indexes

Create required Firestore indexes:

```javascript
// Composite indexes needed:
// invoices: createdAt (desc)
// shipments: companyID (asc), invoiced (asc), createdAt (desc)
// shipments: invoiced (asc), createdAt (desc)
```

## Configuration

### 1. Invoice Settings

Default settings in `GenerateInvoicesPage.jsx`:
```javascript
{
  includeShipmentDetails: true,
  includeChargeBreakdown: true,
  emailToCustomers: true,
  paymentTerms: 'Net 30',
  invoicePrefix: 'INV',
  groupByCompany: true
}
```

### 2. Tax Configuration

Currently set to 13% HST (Canada). Update in `generateInvoicePDFAndEmail.js`:
```javascript
const taxRate = 0.13; // Update as needed
```

### 3. Credit Limits

Default credit limit: $5,000. Configure per company in payment terms.

## Testing

### 1. Customer Dashboard
- [ ] Credit status displays correctly
- [ ] Shipment charges load and calculate properly
- [ ] Search and filtering work
- [ ] Charge breakdowns show in tooltips

### 2. Invoice Generation
- [ ] Uninvoiced shipments load correctly
- [ ] Invoice settings save and apply
- [ ] PDF generation works and matches sample format
- [ ] Email delivery succeeds with attachments
- [ ] Shipments marked as invoiced after generation

### 3. Admin Management
- [ ] Invoice list loads with proper metrics
- [ ] Status updates work
- [ ] Invoice details display correctly
- [ ] Resend functionality works

## Production Considerations

### 1. Performance
- Implement pagination for large shipment lists
- Add caching for frequently accessed data
- Optimize PDF generation for large invoices

### 2. Security
- Validate all input data
- Ensure proper access controls
- Audit invoice modifications

### 3. Monitoring
- Track invoice generation success/failure rates
- Monitor email delivery
- Alert on payment term violations

### 4. Backup & Recovery
- Regular database backups
- PDF storage redundancy
- Invoice regeneration capabilities

## Support

### Common Issues

1. **PDF Generation Fails**:
   - Check PDFKit dependency
   - Verify Firebase Storage permissions
   - Check cloud function logs

2. **Email Delivery Issues**:
   - Verify SendGrid configuration
   - Check recipient email validity
   - Review email templates

3. **Charge Calculations**:
   - Verify markup engine integration
   - Check dual rate storage
   - Validate shipment data

### Monitoring

Key metrics to monitor:
- Invoice generation success rate
- Email delivery rate
- Payment collection efficiency
- Outstanding balance trends

## Future Enhancements

1. **Payment Integration**:
   - Online payment gateway
   - Automatic payment processing
   - Payment plan management

2. **Advanced Reporting**:
   - Revenue analytics
   - Aging reports
   - Customer payment behavior

3. **Automation**:
   - Scheduled invoice generation
   - Automatic reminders
   - Late fee calculations

4. **Multi-currency Support**:
   - Currency conversion
   - Regional tax handling
   - Localized formats

This completes the enterprise billing system deployment. The system provides a professional, Stripe-inspired billing experience with comprehensive invoice management capabilities. 