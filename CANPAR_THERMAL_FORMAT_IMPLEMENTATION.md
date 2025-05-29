# Canpar Thermal Format Implementation

## 🎯 **Overview**

This document outlines the complete implementation of thermal format support for Canpar label generation. The enhancement allows users to choose between standard and thermal label formats when booking Canpar shipments.

## 🔧 **Implementation Details**

### **1. Backend Changes (generateCanparLabel.js)**

#### **Enhanced SOAP Envelope Builder**
The `buildCanparLabelSoapEnvelope` function already supported thermal format but was hardcoded to `false`. Now it properly accepts and uses the `thermalFormat` parameter:

```xml
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:ws="http://ws.business.canshipws.canpar.com"
                  xmlns:xsd="http://dto.canshipws.canpar.com/xsd">
  <soapenv:Header/>
  <soapenv:Body>
    <ws:getLabels>
      <ws:request>
        <xsd:user_id>47500055@47500055.com</xsd:user_id>
        <xsd:password>47500055</xsd:password>
        <xsd:id>71359832</xsd:id>
        <xsd:thermal>true</xsd:thermal>  <!-- NOW DYNAMIC -->
      </ws:request>
    </ws:getLabels>
  </soapenv:Body>
</soapenv:Envelope>
```

#### **Updated Function Signature**
```javascript
const generateCanparLabel = onCall(async (request) => {
    const { shipmentId, firebaseDocId, carrier, thermalFormat = false } = request.data;
    // ... rest of implementation
});
```

#### **Enhanced Document Storage**
Labels are now stored with proper thermal format metadata:

```javascript
const documentData = {
    // ... existing fields
    metadata: {
        canparShipmentId: shipmentId,
        labelFormat: 'PDF',
        thermalCompatible: thermalFormat,      // NEW
        labelType: labelType,                  // NEW: 'thermal' or 'standard'
        originalFormat: 'PNG'
    },
    // ... rest of document data
};
```

#### **Filename Differentiation**
Generated files now include label type in the filename:
- Standard: `canpar-label-standard-71359832-2025-01-29T15-30-45-123Z.pdf`
- Thermal: `canpar-label-thermal-71359832-2025-01-29T15-30-45-123Z.pdf`

### **2. Frontend Changes (Review.jsx)**

#### **State Management**
Added thermal format preference state:
```javascript
const [canparThermalFormat, setCanparThermalFormat] = useState(false);
```

#### **Enhanced Label Generation Function**
```javascript
const generateCanparLabel = async (canparShipmentId, docIdToProcess, carrierName, thermalFormat = false) => {
    // ... enhanced implementation with thermal support
    const payload = {
        shipmentId: canparShipmentId,
        firebaseDocId: docIdToProcess,
        carrier: carrierName,
        thermalFormat: thermalFormat  // NEW PARAMETER
    };
};
```

#### **UI Enhancement**
Added thermal format toggle in the Service Options section:

```jsx
{/* Canpar Thermal Format Option */}
{(carrierIsCanpar) && (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="subtitle2" color="text.secondary">
            Canpar Thermal Labels
        </Typography>
        <FormControlLabel
            control={
                <Switch
                    checked={canparThermalFormat}
                    onChange={(e) => setCanparThermalFormat(e.target.checked)}
                    size="small"
                    color="primary"
                />
            }
            label={canparThermalFormat ? "Thermal" : "Standard"}
            labelPlacement="end"
        />
    </Box>
)}
```

## 📋 **Feature Specifications**

### **Thermal Format Detection Logic**
The UI toggle appears when Canpar is detected as the selected carrier through multiple detection methods:

```javascript
const carrierIsCanpar = (
    fullRateDetails?.carrier?.name?.toLowerCase().includes('canpar') ||
    fullRateDetails?.carrier?.toLowerCase().includes('canpar') ||
    formData.selectedRate?.carrier?.name?.toLowerCase().includes('canpar') ||
    formData.selectedRate?.carrierName?.toLowerCase().includes('canpar') ||
    formData.selectedRate?.carrier?.toLowerCase().includes('canpar')
);
```

### **Label Generation Flow**
1. **User Selection** → User toggles thermal format in Review step
2. **Booking Process** → Canpar booking completes successfully
3. **Automatic Detection** → System detects Canpar carrier
4. **3-Second Delay** → Required wait time before label generation
5. **SOAP Request** → Calls Canpar API with `thermal: true/false`
6. **PNG Response** → Receives label in PNG format
7. **PDF Conversion** → Converts PNG to PDF for consistency
8. **Storage** → Stores with thermal format metadata
9. **Document Classification** → Properly categorized as label

### **Status Messages**
Enhanced status messages provide clear feedback:
- **Standard**: "Generating shipping label..."
- **Thermal**: "Generating thermal shipping label..."
- **Success**: "Thermal label generated successfully!" or "Label generated successfully!"

## 🗂️ **Document Metadata Structure**

### **Storage Metadata**
```javascript
{
    contentType: 'application/pdf',
    metadata: {
        shipmentId: 'SHIP123',
        carrier: 'Canpar',
        documentType: 'label',
        generatedAt: '2025-01-29T15:30:45.123Z',
        thermalFormat: true,        // NEW
        labelType: 'thermal'        // NEW
    }
}
```

### **Document Record**
```javascript
{
    shipmentId: 'SHIP123',
    filename: 'canpar-label-thermal-71359832-2025-01-29T15-30-45-123Z.pdf',
    docType: 2,
    carrier: 'Canpar',
    documentType: 'label',
    metadata: {
        canparShipmentId: '71359832',
        labelFormat: 'PDF',
        thermalCompatible: true,     // NEW
        labelType: 'thermal',        // NEW
        originalFormat: 'PNG'
    }
    // ... other fields
}
```

## 🎯 **User Experience**

### **Standard Workflow**
1. User creates Canpar shipment
2. Sees "Canpar Thermal Labels" toggle in Service Options (default: Standard)
3. Proceeds with booking
4. System generates standard label automatically
5. Label appears in ShipmentDetail page

### **Thermal Workflow**
1. User creates Canpar shipment
2. Toggles "Canpar Thermal Labels" to **Thermal**
3. Proceeds with booking
4. System generates thermal-compatible label
5. Enhanced status shows "Generating thermal shipping label..."
6. Thermal label stored with proper metadata

### **Visual Indicators**
- **Toggle State**: Clear "Standard" vs "Thermal" labels
- **Status Messages**: Specific thermal generation messages
- **File Naming**: Thermal labels clearly identified in filename
- **Success Feedback**: "Thermal label generated successfully!"

## 📈 **Benefits**

### **For Users**
- ✅ **Choice**: Standard vs thermal format selection
- ✅ **Clarity**: Clear visual indication of selected format
- ✅ **Feedback**: Enhanced status messages during generation
- ✅ **Compatibility**: Works with thermal printers

### **For System**
- ✅ **Metadata**: Proper thermal format tracking
- ✅ **Consistency**: Unified document storage structure
- ✅ **Flexibility**: Easy to extend to other carriers
- ✅ **Backward Compatibility**: Existing labels unchanged

### **For Support**
- ✅ **Identification**: Easy to identify thermal vs standard labels
- ✅ **Troubleshooting**: Clear metadata for debugging
- ✅ **Reporting**: Can track thermal usage patterns

## 🚀 **Deployment Status**

- ✅ **Backend Functions** - Successfully deployed
- ✅ **Frontend Hosting** - Successfully deployed
- ✅ **Live Application** - https://solushipx.web.app
- ✅ **Backward Compatibility** - Maintained
- ✅ **Testing Ready** - Full end-to-end functionality

## 🔍 **Testing Verification**

### **Standard Label Test**
1. Create Canpar shipment
2. Keep thermal toggle OFF (Standard)
3. Complete booking
4. Verify: Label generated with `thermalFormat: false`
5. Check: Filename contains "standard"

### **Thermal Label Test**
1. Create Canpar shipment
2. Toggle thermal ON (Thermal)
3. Complete booking
4. Verify: Label generated with `thermalFormat: true`
5. Check: Filename contains "thermal"
6. Confirm: Enhanced status messages displayed

## 🔄 **Future Enhancements**

### **Potential Improvements**
- **User Preferences**: Remember thermal format preference per user
- **Carrier Extension**: Apply thermal format to other carriers
- **Batch Generation**: Support thermal format in bulk operations
- **Quality Selection**: Different thermal resolutions/qualities

### **Integration Opportunities**
- **Printer Detection**: Auto-detect thermal printers
- **Preview Mode**: Show thermal vs standard preview
- **Settings Page**: Global thermal format preferences

---

**Implementation Complete**: Canpar thermal format support is now live and fully functional across the entire SolushipX platform. 