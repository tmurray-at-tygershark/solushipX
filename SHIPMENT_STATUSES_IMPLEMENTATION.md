# Shipment Statuses Configuration System

## Overview

A comprehensive shipment statuses management system has been implemented in the admin configuration section at `/admin/configuration/shipment-statuses`. This system allows administrators to configure and manage all possible shipment statuses that can be set manually on shipments in ShipmentDetailX.

## Key Features

### 🎯 **Two-Level Status Hierarchy**
- **Master Statuses**: High-level categories (e.g., "In Transit", "Delivered", "Exception")
- **Shipment Statuses**: Granular statuses that map to master statuses (e.g., "In Customs" → "In Transit")

### 🔧 **Full CRUD Operations**
- Create, read, update, and delete both master statuses and shipment statuses
- Professional form validation and error handling
- Real-time status code generation and uniqueness checking

### 🎨 **Professional Admin UI**
- Tab-based interface for Master Statuses and Shipment Statuses
- Consistent 12px font sizing and admin design standards
- Search, filter, and pagination capabilities
- Color-coded status indicators

## Architecture

### Database Collections

#### `masterStatuses` Collection
```javascript
{
  label: "in_transit",           // System identifier
  displayLabel: "In Transit",    // Human-readable name
  description: "Shipment is currently being transported",
  color: "#10b981",             // Hex color for UI display
  sortOrder: 3,                 // Display order
  enabled: true,                // Active status
  createdAt: timestamp,
  createdBy: "user@email.com",
  updatedAt: timestamp,
  updatedBy: "user@email.com"
}
```

#### `shipmentStatuses` Collection
```javascript
{
  masterStatus: "masterStatusDocId",  // Reference to master status
  statusLabel: "In customs",          // Display name
  statusMeaning: "Your shipment is at border customs inspection",
  statusCode: 25,                     // Unique numeric code
  enabled: true,                      // Active status
  createdAt: timestamp,
  createdBy: "user@email.com",
  updatedAt: timestamp,
  updatedBy: "user@email.com"
}
```

### Cloud Functions

#### Master Status Functions
- `createMasterStatus` - Create new master status with validation
- `updateMasterStatus` - Update existing master status
- `deleteMasterStatus` - Delete master status (with dependency checks)
- `getMasterStatuses` - Fetch all master statuses with sorting

#### Shipment Status Functions
- `createShipmentStatus` - Create new shipment status with code generation
- `updateShipmentStatus` - Update existing shipment status
- `deleteShipmentStatus` - Delete shipment status
- `getShipmentStatuses` - Fetch all shipment statuses with master status data

### Frontend Components

#### Main Component
- `ShipmentStatuses.jsx` - Main configuration interface with tabs

#### Dialog Components
- `MasterStatusDialog.jsx` - Create/edit master statuses with color picker
- `ShipmentStatusDialog.jsx` - Create/edit shipment statuses with master status selection
- `DeleteConfirmationDialog.jsx` - Professional delete confirmation with warnings

## Default Status Structure

### Master Statuses (8 total)
1. **Pending** (`#f59e0b`) - Shipment being prepared
2. **Booked** (`#3b82f6`) - Shipment booked with carrier
3. **Scheduled** (`#6366f1`) - Pickup/delivery scheduled
4. **In Transit** (`#10b981`) - Currently being transported
5. **Completed** (`#059669`) - Successfully delivered
6. **Exception** (`#ef4444`) - Issues or delays encountered
7. **On Hold** (`#f97316`) - Temporarily stopped
8. **Cancelled** (`#6b7280`) - Shipment cancelled

### Shipment Statuses (32 total)
Organized by master status category:

#### Pending (6 statuses)
- Ready for shipping (Code: 10)
- Ready to process (Code: 80)
- Sent to warehouse (Code: 100)
- Received by warehouse (Code: 110)
- Request Quote (Code: 111)
- Quoted (Code: 112)

#### Scheduled (5 statuses)
- Scheduled for pick up (Code: 16)
- Booking appointment (Code: 22)
- Appointment (Code: 122)
- Awaiting appointment (Code: 250)
- Appointment confirmed (Code: 260)

#### Booked (2 statuses)
- Booking confirmed (Code: 309)
- Booking requested (Code: 319)

#### In Transit (7 statuses)
- Out for pickup (Code: 12)
- Picked up (Code: 19)
- In transit (Code: 20)
- On route (Code: 21)
- In customs (Code: 25)
- At terminal (Code: 26)
- Out for delivery (Code: 23)

#### Completed (2 statuses)
- Delivered (Code: 30)
- Closed (Code: 70)

#### Exception (6 statuses)
- Exception (Code: 50)
- Undelivered (Code: 113)
- Attempted delivery (Code: 114)
- Refused (Code: 115)
- Weather delay (Code: 120)
- Delay (Code: 300)

#### On Hold (3 statuses)
- On hold (Code: 290)
- Hold for appointment (Code: 270)
- Held for pick up (Code: 280)

#### Cancelled (1 status)
- Cancelled (Code: 40)

## Usage in ShipmentDetailX

The configured statuses are used in the manual status override system in ShipmentDetailX.jsx:

1. **ManualStatusOverride Component** - Loads statuses from database
2. **Dynamic Dropdown** - Populates with configured shipment statuses
3. **Master Status Grouping** - Organizes statuses by master category
4. **Status Validation** - Ensures only valid, enabled statuses can be selected

## Integration Points

### Routes
- `/admin/configuration/shipment-statuses` - Main configuration interface
- Integrated into SystemConfiguration.jsx with navigation button

### Permissions
- Requires admin role (`admin` or `superadmin`)
- Full CRUD operations protected by role validation

### Error Handling
- Comprehensive validation for all operations
- User-friendly error messages
- Rollback capabilities for failed operations

## Deployment

### Cloud Functions
```bash
firebase deploy --only functions:createMasterStatus,functions:updateMasterStatus,functions:deleteMasterStatus,functions:getMasterStatuses,functions:createShipmentStatus,functions:updateShipmentStatus,functions:deleteShipmentStatus,functions:getShipmentStatuses
```

### Frontend
```bash
npm run deploy:hosting
```

### Database Initialization
```bash
node scripts/initializeShipmentStatuses.js
```

## Benefits

✅ **Flexibility** - Admins can create custom statuses for specific business needs
✅ **Hierarchy** - Two-level system provides both high-level and granular tracking
✅ **Validation** - Comprehensive validation prevents duplicate codes and invalid data
✅ **Professional UI** - Consistent admin design standards throughout
✅ **Integration** - Seamlessly integrates with existing manual status override system
✅ **Scalability** - Database-driven approach supports unlimited status configurations

## Future Enhancements

- **Status Transitions** - Define allowed status transition rules
- **Notifications** - Configure notifications for specific status changes
- **Automation** - Set up automatic status updates based on carrier data
- **Reporting** - Generate reports based on custom status configurations
- **Import/Export** - Bulk management of status configurations

---

**Implementation Complete**: The system is now live at https://solushipx.web.app/admin/configuration/shipment-statuses and ready for production use. 