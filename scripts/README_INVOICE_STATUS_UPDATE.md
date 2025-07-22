# Invoice Status Update Script

This script updates all existing shipments to set their `invoiceStatus` field to `"not_invoiced"` as the default billing status.

## Overview

**Purpose**: Set default invoice status for all shipments to standardize billing workflow.

**Status Code**: `"not_invoiced"` (as requested by user specifications)

**Target**: All shipments in the `shipments` collection that don't already have an `invoiceStatus` field.

## Features

✅ **Batch Processing**: Processes shipments in batches of 500 to stay within Firestore limits  
✅ **Safe Updates**: Only updates shipments that don't already have `invoiceStatus` set  
✅ **Audit Trail**: Adds `invoiceStatusUpdatedAt` and `invoiceStatusUpdatedBy` fields  
✅ **Rate Limiting**: 1-second delay between batches to prevent overwhelming Firestore  
✅ **Verification**: Built-in verification function to check updates  
✅ **Progress Tracking**: Real-time console logging of progress  

## Usage

### Prerequisites

1. Ensure you have Firebase Admin SDK access
2. Make sure `functions/service-account.json` exists with proper permissions
3. Run from the project root directory

### Running the Script

```bash
# Navigate to project root
cd /path/to/solushipX

# Run the script
node scripts/updateInvoiceStatus.js
```

### Expected Output

```
🚀 Starting Invoice Status Update Script
==========================================
🔄 Starting bulk update of shipment invoice status...
📦 Processing batch 1...
✅ Updated 127 shipments in batch 1
📦 Processing batch 2...
✅ Updated 89 shipments in batch 2
✅ No more shipments to process
🎉 Bulk update complete!
📊 Total shipments updated: 216
📦 Total batches processed: 2
🔍 Verifying updates...
✅ Verified: 10 shipments have correct invoice status
⚠️  Missing: 0 shipments still need invoice status
==========================================
✅ Script completed successfully!
```

## What Gets Updated

### Fields Added to Each Shipment:

```javascript
{
  invoiceStatus: 'not_invoiced',
  invoiceStatusUpdatedAt: [Firestore ServerTimestamp],
  invoiceStatusUpdatedBy: 'system_script'
}
```

### Safety Features:

- **No Overwrites**: Only adds `invoiceStatus` if it doesn't already exist
- **Preserves Data**: All existing shipment data remains unchanged
- **Idempotent**: Safe to run multiple times - won't duplicate updates

## Post-Update Behavior

### New QuickShip Shipments:
✅ **Automatically set to `"not_invoiced"`** when created via `bookQuickShipment` function

### Existing Shipments:
✅ **Updated by this script** to have `invoiceStatus: "not_invoiced"`

### Billing Workflow:
- All shipments start with `"not_invoiced"` status
- AP Processing can approve charges for billing
- ChargesTab shows only approved charges
- Invoice generation processes approved charges

## Troubleshooting

### Common Issues:

**Permission Errors:**
```bash
Error: Permission denied
```
**Solution**: Ensure `service-account.json` has Firestore admin permissions

**Script Fails Mid-Process:**
```bash
Error updating shipment invoice status: [error]
```
**Solution**: Re-run the script - it will skip already updated shipments

**No Updates Made:**
```bash
⏭️  No updates needed in batch 1
```
**Solution**: All shipments already have `invoiceStatus` - this is normal

### Verification:

Check random shipments in Firestore console:
```javascript
// Should see these fields
{
  invoiceStatus: "not_invoiced",
  invoiceStatusUpdatedAt: [timestamp],
  invoiceStatusUpdatedBy: "system_script"
}
```

## Integration with Billing System

This script ensures compatibility with the new billing workflow:

1. **AP Processing** → Extract charges from carrier invoices
2. **Review & Approve** → Approve charges for billing (AP Processing screen)
3. **ChargesTab** → Shows only AP-approved charges with invoice status
4. **Invoice Generation** → Creates invoices from approved charges

All shipments now have standardized `invoiceStatus` field for proper billing flow control.

---

**Script Location**: `scripts/updateInvoiceStatus.js`  
**Last Updated**: January 2025  
**Author**: System Migration Script 