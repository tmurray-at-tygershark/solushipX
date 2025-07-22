# Universal Charge Type Classification System

## Overview

The Universal Charge Type Classification System provides standardized categorization and display of shipping charges across all carriers and shipment types in SolushipX.

## Features

✅ **Universal Charge Codes**: Maps 21+ standardized charge codes (FRT, ACC, FUE, HST, etc.)  
✅ **Category Classification**: Groups charges into 9 logical categories  
✅ **Visual Indicators**: Color-coded chips with icons for each category  
✅ **Interactive Details**: Click any charge type cell for detailed breakdown  
✅ **CSV Export**: Includes charge type data in exports  
✅ **Smart Fallbacks**: Handles unknown charge codes gracefully  

## Supported Charge Types

### Core Charges (Most Common)
- **FRT** - Freight (Base freight charges)
- **FUE** - Fuel Surcharge (Fuel surcharge)

### Categories & Charge Types

#### 🚛 **Freight**
- FRT - Base freight charges

#### ⛽ **Fuel** 
- FUE - Fuel surcharge

#### 🔧 **Accessorial**
- ACC - Accessorial services

#### 💰 **Taxes**
- HST - Harmonized Sales Tax
- GST - Goods and Services Tax  
- QST - Quebec Sales Tax
- HST ON - HST Ontario
- HST BC - HST British Columbia
- HST NB - HST New Brunswick
- HST NF - HST Newfoundland and Labrador
- HST NS - HST Nova Scotia
- HST PE - HST Prince Edward Island

#### 📈 **Surcharges**
- SUR - General surcharge
- IC SUR - Integrated Carriers surcharge

#### 📦 **Logistics**
- LOG - Logistics services
- IC LOG - Integrated Carriers logistics services

#### 🏛️ **Government**
- GOVT - Government fees
- GOVD - Government duties
- GSTIMP - GST on imports

#### 🛡️ **Insurance**
- CLAIMS - Insurance claims

#### 📋 **Miscellaneous**
- MSC - Miscellaneous charges

## Implementation

### Core Service: `chargeTypeService.js`

```javascript
import chargeTypeService from '../../../services/chargeTypeService';

// Get charge type information
const chargeType = chargeTypeService.getChargeType('FRT');
console.log(chargeType);
// Output: { code: 'FRT', label: 'Freight', category: 'freight', ... }

// Classify an array of charges
const charges = [
  { code: 'FRT', amount: 100 },
  { code: 'HST ON', amount: 13 }
];
const classified = chargeTypeService.classifyCharges(charges);
```

### Key Methods

| Method | Description |
|--------|-------------|
| `getChargeType(code)` | Get classification for a charge code |
| `classifyCharges(charges)` | Classify array of charges |
| `getCategoryInfo(category)` | Get category details (color, icon, etc.) |
| `getAllChargeTypes()` | Get all available charge types |
| `getCoreChargeTypes()` | Get most commonly used charge types |
| `searchChargeTypes(term)` | Search charge types by code/label |

## UI Integration

### ChargesTab Enhancement

The admin billing charges table now includes a **"Charge Type"** column that:

- **Displays**: Color-coded category chips with icons and counts
- **Interactive**: Click any cell to view detailed breakdown
- **Compact**: Shows up to 2 categories, with "+X more" indicator
- **Hover Effect**: Visual feedback on clickable cells

### Detail Dialog

The `ChargeTypeDetailDialog` provides:

- **Shipment Info**: Header with shipment ID and carrier
- **Category Summary**: Overview chips for all categories
- **Detailed Table**: Complete breakdown with codes, types, amounts
- **Professional Styling**: Consistent with admin design standards

### Example Display

```
🚛 Freight (1)    💰 Taxes (3)
+2 more categories
```

## Data Structure

### Charge Type Object
```javascript
{
  code: 'FRT',
  label: 'Freight',
  description: 'Base freight charges',
  category: 'freight',
  isCore: true,
  displayOrder: 1
}
```

### Category Info Object
```javascript
{
  label: 'Freight',
  color: '#3b82f6',
  icon: '🚛',
  description: 'Base freight and transportation charges'
}
```

### Classified Charge Object
```javascript
{
  code: 'FRT',
  amount: 100,
  currency: 'CAD',
  chargeType: { /* charge type object */ },
  categoryInfo: { /* category info object */ },
  type: 'Freight',        // For backward compatibility
  category: 'freight'     // For backward compatibility
}
```

## CSV Export Enhancement

Charge type data is automatically included in CSV exports:

```csv
Shipment ID,Date,Company,Customer,Carrier,Charge Types,Quoted Cost,...
IC-123-ABC,2025-01-15,Company A,Customer B,FedEx,"Freight, Taxes",100.00,...
```

## Usage Examples

### Basic Classification
```javascript
// Single charge code
const freightType = chargeTypeService.getChargeType('FRT');
console.log(freightType.label); // "Freight"
console.log(freightType.category); // "freight"

// Multiple charges
const charges = [
  { code: 'FRT', amount: 100 },
  { code: 'FUE', amount: 15 },
  { code: 'HST ON', amount: 14.95 }
];

const classified = chargeTypeService.classifyCharges(charges);
const stats = chargeTypeService.getCategoryStatistics(classified);
console.log(stats);
// Output: { "Freight": { count: 1, totalAmount: 100 }, ... }
```

### UI Integration
```jsx
// Display charge types in a component
const ChargeDisplay = ({ charges }) => {
  const classifiedCharges = chargeTypeService.classifyCharges(charges);
  const categories = [...new Set(classifiedCharges.map(c => c.category))];
  
  return (
    <Box>
      {categories.map(category => {
        const categoryInfo = chargeTypeService.getCategoryInfo(category);
        const categoryCharges = classifiedCharges.filter(c => c.category === category);
        
        return (
          <Chip
            label={`${categoryInfo.icon} ${categoryInfo.label} (${categoryCharges.length})`}
            sx={{ backgroundColor: categoryInfo.color + '20' }}
          />
        );
      })}
    </Box>
  );
};
```

## Benefits

1. **Standardization**: Consistent charge type classification across all carriers
2. **Visual Clarity**: Color-coded categories make charge types instantly recognizable  
3. **Detailed Analysis**: Interactive dialogs provide comprehensive breakdowns
4. **Export Ready**: Charge type data included in all data exports
5. **Extensible**: Easy to add new charge types and categories
6. **Smart Fallbacks**: Handles unknown codes gracefully
7. **Performance**: Optimized with caching and efficient lookups

## Live Production

✅ **Deployed**: https://solushipx.web.app  
✅ **Location**: Admin → Billing → Charges tab  
✅ **Interactive**: Click any "Charge Type" cell for details  

---

**Last Updated**: January 2025  
**Version**: 1.0.0  
**Status**: Production Ready 