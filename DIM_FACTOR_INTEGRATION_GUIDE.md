# DIM Factor System Integration Guide

## Overview

The DIM (Dimensional) Weight Factor system enables accurate carrier rating by calculating volumetric weight and using the higher of actual or volumetric weight for rate calculations. This system integrates seamlessly with our existing simple carrier templates and rating engine.

## 🏗️ Architecture

### Database Collections

#### 1. `dimFactors` Collection
```javascript
{
  id: "auto-generated",
  carrierId: "carrier-123",
  carrierName: "FedEx",
  serviceType: "express", // or "all", "ground", "priority", etc.
  zone: "all", // or "local", "regional", "national", "international"
  dimFactor: 139, // Volume divisor (in³/lb, cm³/kg, etc.)
  unit: "in³/lb", // "in³/lb", "cm³/kg", "in³/kg", "cm³/lb"
  effectiveDate: "2025-01-01T00:00:00Z",
  expiryDate: null, // Optional expiry date
  isActive: true,
  notes: "Standard FedEx Express DIM factor",
  createdAt: "timestamp",
  createdBy: "user-id",
  updatedAt: "timestamp"
}
```

#### 2. `customerDimFactorOverrides` Collection
```javascript
{
  id: "auto-generated",
  customerId: "customer-123",
  carrierId: "carrier-123",
  serviceType: "all", // or specific service
  zone: "all", // or specific zone
  dimFactor: 150, // Negotiated rate
  unit: "in³/lb",
  effectiveDate: "2025-01-01T00:00:00Z",
  expiryDate: "2025-12-31T23:59:59Z",
  isActive: true,
  notes: "Negotiated rate for high-volume customer",
  reason: "Volume discount agreement",
  createdAt: "timestamp",
  createdBy: "user-id"
}
```

## 🔧 Cloud Functions

### Core DIM Factor Functions

1. **`createDimFactor`** - Create new DIM factor
2. **`getDimFactors`** - Query DIM factors with filtering
3. **`updateDimFactor`** - Update existing DIM factor
4. **`deleteDimFactor`** - Delete DIM factor
5. **`calculateVolumetricWeight`** - Calculate DIM weight for packages
6. **`createCustomerDimFactorOverride`** - Create customer-specific overrides

### Enhanced Rating Functions

1. **`calculateEnhancedRates`** - Rate calculation with DIM weight integration
2. **`testDimWeight`** - Test DIM weight calculations

## 📊 DIM Weight Calculation Logic

### Formula
```javascript
volumetric_weight = (length × width × height) / dim_factor
chargeable_weight = max(actual_weight, volumetric_weight)
// Always round up to nearest billing unit
```

### Priority System
1. **Customer Override** - Customer-specific negotiated rates
2. **Service + Zone Specific** - Exact service and zone match
3. **Service + All Zones** - Service match, any zone
4. **All Services + Zone** - Any service, zone match  
5. **All Services + All Zones** - Default fallback

### Unit Conversions
- **Imperial**: in³/lb (inches cubed per pound)
- **Metric**: cm³/kg (centimeters cubed per kilogram)
- **Mixed**: in³/kg, cm³/lb (for international shipping)

## 🎯 Integration Points

### 1. Simple Carrier Templates Integration

The DIM factor system works with existing simple carrier templates:

```javascript
// Enhanced rate calculation considers both weight and dimensions
const enhancedRate = await calculateEnhancedRates({
  carrierId: "carrier-123",
  serviceType: "express",
  fromLocation: { city: "Toronto", state: "ON" },
  toLocation: { city: "Montreal", state: "QC" },
  packages: [
    {
      quantity: 1,
      weight: 10,
      length: 24,
      width: 18, 
      height: 12,
      dimensionUnit: "in",
      weightUnit: "lbs"
    }
  ]
});
```

### 2. QuickShip Integration

Add DIM weight calculation to QuickShip forms:

```javascript
// In QuickShip.jsx - add DIM weight display
const [dimWeightInfo, setDimWeightInfo] = useState(null);

// Calculate DIM weight when package details change
useEffect(() => {
  if (selectedCarrier && packages.length > 0) {
    calculateDimWeight();
  }
}, [selectedCarrier, packages]);

const calculateDimWeight = async () => {
  const result = await calculateVolumetricWeight({
    carrierId: selectedCarrier.id,
    packages: packages
  });
  setDimWeightInfo(result.data);
};
```

### 3. Rate Display Enhancement

Show DIM weight information in rate displays:

```jsx
// Enhanced rate display component
<Box sx={{ p: 2, border: '1px solid #e5e7eb', borderRadius: 1 }}>
  <Typography variant="h6">Rate: ${rate.totalRate}</Typography>
  
  {dimWeightInfo?.dimWeightApplied && (
    <Alert severity="info" sx={{ mt: 1, fontSize: '12px' }}>
      DIM Weight Applied: {dimWeightInfo.totalActualWeight} lbs actual → {dimWeightInfo.totalChargeableWeight} lbs chargeable 
      (+{dimWeightInfo.weightPenalty} lbs)
    </Alert>
  )}
  
  <Typography variant="caption" sx={{ fontSize: '11px', color: '#6b7280' }}>
    {dimWeightInfo?.calculation}
  </Typography>
</Box>
```

## 🚀 Admin UI Integration

### Carrier Management Enhancement

Add DIM Factor Management tab to existing Carrier detail pages:

```jsx
// In CarrierDetail.jsx
import DimFactorManagement from './components/DimFactorManagement';

// Add tab for DIM factors
<Tab label="DIM Factors" value="dimFactors" />

// Add panel content
<TabPanel value="dimFactors">
  <DimFactorManagement carrier={carrier} />
</TabPanel>
```

### Features Included

1. **DIM Factor CRUD Operations**
   - Create/Edit/Delete DIM factors
   - Service and zone-specific configuration
   - Effective date management
   - Status management (active/inactive)

2. **Test Calculator**
   - Real-time DIM weight calculations
   - Package dimension input
   - Visual calculation breakdown
   - Unit conversion support

3. **Customer Override Management**
   - Negotiated rate tracking
   - Override reason documentation
   - Expiry date management

## 📈 Business Benefits

### 1. Accurate Rating
- **Proper volumetric weight calculations** prevent revenue loss
- **Industry-standard DIM factors** (FedEx: 139, UPS: 166)
- **Customer-specific overrides** for negotiated rates

### 2. Operational Efficiency  
- **Automated calculations** reduce manual work
- **Real-time testing** validates configurations
- **Audit trails** track all changes

### 3. Competitive Advantage
- **Transparent pricing** builds customer trust
- **Flexible configuration** adapts to carrier changes
- **Professional presentation** enhances credibility

## 🔄 Implementation Steps

### Phase 1: Core System Deployment
1. Deploy DIM factor Cloud Functions
2. Set up database collections
3. Configure initial DIM factors for major carriers

### Phase 2: UI Integration
1. Add DIM Factor Management to admin carriers
2. Integrate test calculator
3. Add customer override capabilities

### Phase 3: Rating Engine Integration
1. Update QuickShip to use enhanced ratings
2. Add DIM weight display to rate results
3. Integrate with simple carrier templates

### Phase 4: Customer Features
1. Add customer-specific DIM factor overrides
2. Implement negotiated rate tracking
3. Add DIM weight transparency in invoicing

## 📋 Common DIM Factors

### Major Carriers
| Carrier | Service | DIM Factor | Unit |
|---------|---------|------------|------|
| FedEx | Express | 139 | in³/lb |
| FedEx | Ground | 166 | in³/lb |
| UPS | Express | 139 | in³/lb |
| UPS | Ground | 166 | in³/lb |
| Purolator | Express | 139 | in³/lb |
| Canada Post | Expedited | 166 | in³/lb |

### International
| Region | Standard | Unit |
|--------|----------|------|
| Europe | 200 | cm³/kg |
| Asia | 166 | cm³/kg |
| Australia | 250 | cm³/kg |

## 🧪 Testing Examples

### Test Case 1: Light, Bulky Package
```javascript
// Package: 24"×18"×12", 5 lbs
// Volume: 5,184 in³
// DIM Weight (139 factor): 5,184 ÷ 139 = 37.3 lbs
// Chargeable Weight: max(5, 37.3) = 37.3 lbs
```

### Test Case 2: Heavy, Compact Package  
```javascript
// Package: 12"×12"×12", 50 lbs
// Volume: 1,728 in³
// DIM Weight (139 factor): 1,728 ÷ 139 = 12.4 lbs
// Chargeable Weight: max(50, 12.4) = 50 lbs
```

## 🔒 Security & Validation

### Data Validation
- DIM factors must be positive numbers
- Effective dates must be logical
- Unit types must be from approved list
- Customer overrides require proper authorization

### Access Control
- Admin-only DIM factor management
- Customer-specific override visibility
- Audit logging for all changes
- Role-based permissions

## 📞 Support & Maintenance

### Monitoring
- Track DIM weight calculation frequency
- Monitor rate accuracy improvements
- Alert on configuration errors
- Performance metrics collection

### Maintenance Tasks
- Update carrier DIM factors annually
- Review customer overrides quarterly
- Archive expired configurations
- Performance optimization reviews

---

This DIM Factor system provides enterprise-grade dimensional weight calculation capabilities that integrate seamlessly with SolushipX's existing carrier rating infrastructure, ensuring accurate pricing and competitive advantage in the logistics market.
