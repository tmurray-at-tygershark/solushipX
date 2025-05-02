# EDI Processing Functionality

This document describes the EDI (Electronic Data Interchange) processing functionality in SolushipX, which allows for the automated extraction of shipment data from CSV files using Google's Gemini 1.5 Pro AI model.

## Overview

The EDI processing feature allows users to upload CSV files containing shipment data, which are then processed by an AI model to extract structured information about shipments, including tracking numbers, addresses, carriers, and costs.

## Recent Changes

The EDI processing functionality has been moved from the customer-facing Billing dashboard to the Admin Billing dashboard, as this is an administrative function that should only be accessible to system administrators.

### Changes Made:

1. Moved UI Components:
   - Relocated `EDIUploader.jsx` and `EDIResults.jsx` from `src/components/Billing/` to `src/components/Admin/Billing/`
   - Updated imports and paths in these components

2. Updated Backend Functions:
   - Added `isAdmin` flag to the processing workflow
   - Modified the Firestore document structure to include this flag
   - Updated the Pub/Sub message format

3. Removed EDI Tab from Customer Dashboard:
   - Removed EDI tab from customer-facing Billing component
   - Removed related state and handlers

4. Integrated with Admin Dashboard:
   - Added EDI functionality to the Admin Billing Dashboard
   - Added proper state management for the admin EDI workflow
   - Added history view of processed EDI files

## Usage

### Admin Users

1. Navigate to the Admin Dashboard at `/admin/billing`
2. Click on the "EDI Processing" tab
3. Use the uploader to select and upload EDI CSV files
4. View the processing results and extracted shipment data
5. Access historical EDI uploads and their processed results

## Technical Implementation

- Frontend Components: React components in `src/components/Admin/Billing/`
- Backend Processing: Firebase Functions v2 in `functions/src/edi-processing.js`
- Data Storage: 
  - Uploads stored in Firebase Storage: `edi-uploads/{userId}/{fileId}`
  - Metadata in Firestore: `ediUploads` collection
  - Processing results in Firestore: `ediResults` collection
- Processing Queue: Pub/Sub topic `edi-processing` with subscription `projects/solushipx/subscriptions/edi-processing-sub`
- AI Model: Google's Gemini 1.5 Pro for CSV parsing and data extraction

## Deployment Notes

When deploying this feature, ensure:

1. The environment variables are correctly set, particularly `GOOGLE_GENAI_API_KEY`
2. The Pub/Sub topic and subscription are properly configured
3. Firebase Functions have adequate memory and timeout settings
4. Firebase Storage rules allow appropriate access 