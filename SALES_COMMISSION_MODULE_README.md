# Sales Commission Module - SolushipX

## Overview

The Sales Commission Module is an enterprise-grade system for managing sales teams, representatives, and commission calculations within the SolushipX logistics platform. This module is fully integrated into the `/admin/billing` system and provides comprehensive commission management capabilities.

## Features

### 🧑‍💼 Sales Person Management
- **CRUD Operations**: Create, read, update, and delete sales representatives
- **Company Assignment**: Assign sales persons to multiple companies/customers
- **Commission Configuration**: Set individual commission percentages for different service types:
  - LTL (Less Than Truckload) Commission %
  - Courier Commission %
  - Services Commission %
- **Status Management**: Active/Inactive status tracking
- **Contact Information**: Full contact details including email and phone

### 👥 Sales Team Management
- **Team Structure**: Organize sales persons into teams
- **Company Assignment**: Assign teams to specific companies
- **Member Management**: Add/remove team members
- **Team Performance Tracking**: (Coming in future updates)

### 💰 Commission Calculation Engine
- **Automatic Revenue Detection**: Intelligently extracts revenue data from shipments:
  - Gross Revenue: `markupRates.totalCharges` (customer charges)
  - Net Revenue: `actualRates.totalCharges` (carrier costs)
  - Fallback Logic: Handles various shipment data structures
- **Service Type Classification**: Automatically categorizes shipments as:
  - LTL (freight shipments)
  - Courier (ground/express shipments)
  - Services (other shipment types)
- **Commission Calculation**: Applies appropriate commission percentages based on service type and sales person settings
- **Date Range Filtering**: Calculate commissions for specific time periods
- **Company/Person Filtering**: Filter calculations by specific companies or sales persons

### 📊 Reporting System
- **On-Demand Reports**: Generate commission reports with custom filters
- **CSV Export**: Download detailed commission data
- **Email Distribution**: Automatically send reports to tyler@tygershark.com
- **Report Scheduling**: Set up recurring commission reports (monthly, quarterly, etc.)
- **Comprehensive Data**: Reports include:
  - Shipment ID and details
  - Sales person information
  - Company information
  - Revenue breakdown (gross vs net)
  - Commission percentage and amount
  - Payment status

### 🔐 Role-Based Access Control
- **Admin/Super Admin Only**: Commission management restricted to billing admins
- **Permission-Based Access**: Granular permissions for different commission functions:
  - `VIEW_COMMISSIONS`: View commission data
  - `MANAGE_SALES_PERSONS`: Create/edit sales representatives
  - `MANAGE_SALES_TEAMS`: Manage sales teams
  - `CALCULATE_COMMISSIONS`: Run commission calculations
  - `GENERATE_COMMISSION_REPORTS`: Create and export reports
  - `SCHEDULE_COMMISSION_REPORTS`: Set up recurring reports

## Technical Architecture

### Database Schema

#### Sales Persons Collection (`salesPersons`)
```javascript
{
  firstName: String,
  lastName: String,
  email: String (unique),
  phone: String,
  assignedCompanies: [String], // Company IDs
  assignedTeams: [String], // Team IDs
  active: Boolean,
  commissionSettings: {
    ltlGrossPercent: Number,
    ltlNetPercent: Number,
    courierGrossPercent: Number,
    courierNetPercent: Number,
    servicesGrossPercent: Number,
    servicesNetPercent: Number
  },
  totalCommissionPaid: Number,
  totalCommissionOutstanding: Number,
  createdAt: Timestamp,
  createdBy: String,
  updatedAt: Timestamp
}
```

#### Sales Teams Collection (`salesTeams`)
```javascript
{
  teamName: String (unique),
  assignedCompanies: [String], // Company IDs
  createdAt: Timestamp,
  createdBy: String,
  updatedAt: Timestamp
}
```

#### Sales Team Memberships Collection (`salesTeamMemberships`)
```javascript
{
  teamId: String,
  salesPersonId: String,
  joinedAt: Timestamp,
  active: Boolean
}
```

#### Commission Reports Collection (`salesCommissionReports`)
```javascript
{
  reportName: String,
  reportType: String, // 'commission'
  generatedAt: Timestamp,
  generatedBy: String,
  dateRange: {
    startDate: Date,
    endDate: Date
  },
  filters: Object,
  summary: {
    totalCommissionAmount: Number,
    totalShipments: Number,
    totalCommissions: Number,
    averageCommissionPerShipment: Number
  },
  commissions: [Object] // Commission calculation results
}
```

### Cloud Functions

#### Sales Person Management
- `createSalesPerson`: Create new sales representative
- `updateSalesPerson`: Update existing sales representative
- `getSalesPersons`: Retrieve sales persons with filtering
- `deleteSalesPerson`: Remove sales representative

#### Commission Calculation
- `calculateCommissions`: Calculate commissions for specified criteria
- `generateCommissionReport`: Generate and email commission reports
- `scheduleCommissionReport`: Set up recurring reports

### Frontend Components

#### Main Module
- `SalesCommissionsTab.jsx`: Main container component with tab navigation
- `SalesPersonsManagement.jsx`: CRUD interface for sales representatives
- `SalesTeamsManagement.jsx`: Team management interface
- `CommissionCalculator.jsx`: Commission calculation and preview
- `CommissionReports.jsx`: Report generation and scheduling

## Installation & Setup

### 1. Deploy Cloud Functions
```bash
# Deploy individual commission functions
firebase deploy --only functions:createSalesPerson,functions:getSalesPersons,functions:calculateCommissions,functions:generateCommissionReport

# Or deploy all functions
npm run deploy:functions
```

### 2. Database Indexes
Create the following Firestore indexes:
```
Collection: salesPersons
- email (ascending), active (ascending)
- assignedCompanies (array), active (ascending)

Collection: salesTeamMemberships
- teamId (ascending), active (ascending)
- salesPersonId (ascending), active (ascending)

Collection: shipments
- status (ascending), createdAt (ascending)
- companyId (ascending), createdAt (ascending)
```

### 3. Access the Module
1. Navigate to `/admin/billing` in your SolushipX instance
2. Click on the "Sales Commissions" tab
3. Ensure you have admin or super admin permissions

## Usage Guide

### Setting Up Sales Representatives

1. **Navigate to Sales Commissions**:
   - Go to `/admin/billing`
   - Click "Sales Commissions" tab
   - Select "Sales Persons" tab

2. **Add Sales Person**:
   - Click "Add Sales Person"
   - Fill in personal information (name, email, phone)
   - Select assigned companies
   - Set commission percentages for each service type
   - Set status to Active
   - Click "Create"

3. **Configure Commission Rates**:
   - LTL Commission %: Commission for freight shipments
   - Courier Commission %: Commission for ground/express shipments
   - Services Commission %: Commission for other services

### Calculating Commissions

1. **Use Commission Calculator**:
   - Go to "Commission Calculator" tab
   - Set date range for calculation
   - Select specific companies (optional)
   - Select specific sales persons (optional)
   - Click "Calculate Commissions"

2. **Review Results**:
   - View summary statistics
   - Review detailed commission breakdown
   - Export results to CSV if needed

### Generating Reports

1. **Generate On-Demand Report**:
   - Go to "Reports & Scheduling" tab
   - Configure report filters
   - Click "Generate Report"
   - Report will be emailed to configured recipients

2. **Schedule Recurring Reports**:
   - Set up weekly, monthly, or quarterly reports
   - Configure email recipients
   - Reports will be automatically generated and sent

## Revenue Calculation Logic

The commission system uses intelligent revenue detection from shipments:

### Priority Order:
1. **Dual Rate System** (Preferred):
   - Gross Revenue: `shipment.markupRates.totalCharges`
   - Net Revenue: `shipment.actualRates.totalCharges`

2. **Single Rate with Markup Metadata**:
   - Gross Revenue: `shipment.selectedRate.markupMetadata.markupTotal`
   - Net Revenue: `shipment.selectedRate.markupMetadata.originalTotal`

3. **Fallback Calculations**:
   - If only total charges available, assumes 20% margin
   - Handles various shipment data structures
   - Supports both regular and QuickShip shipments

### Service Type Detection:
- **LTL**: Detected via `shipmentInfo.shipmentType` or service names containing "ltl", "freight"
- **Courier**: Detected via carrier names (Canpar) or service names containing "ground", "express"
- **Services**: Default category for other shipment types

## Email Configuration

### Default Recipients
- All commission reports are sent to: `tyler@tygershark.com`
- Additional recipients can be configured per report

### Email Templates
- Professional HTML email with company branding
- CSV attachment with detailed commission data
- Summary statistics in email body
- SendGrid integration for reliable delivery

## Security & Permissions

### Role Requirements
- **Admin** or **Super Admin** role required
- Standard users cannot access commission features
- Permission-based access control for granular security

### Data Protection
- All commission data encrypted in transit and at rest
- Audit trails for all commission calculations
- Secure API endpoints with authentication validation

## Troubleshooting

### Common Issues

1. **"No commission data found"**:
   - Verify sales persons are assigned to correct companies
   - Check date range covers periods with shipments
   - Ensure commission percentages are set > 0

2. **"Failed to calculate commissions"**:
   - Check Firebase function logs
   - Verify user has admin permissions
   - Ensure database indexes are created

3. **Email reports not sending**:
   - Verify SendGrid configuration
   - Check email recipient addresses
   - Review cloud function logs for errors

### Debug Information
Enable debug logging by setting `console.log` statements in:
- Commission calculation functions
- Revenue extraction logic
- Email sending functions

## Future Enhancements

### Planned Features
- **Payment Tracking**: Mark commissions as paid/unpaid
- **Commission Adjustments**: Manual adjustments and overrides
- **Advanced Team Features**: Team performance metrics and hierarchy
- **Integration with Accounting**: Export to accounting systems
- **Commission Splits**: Multiple sales persons per shipment
- **Historical Reporting**: Year-over-year commission analysis

### API Extensions
- REST API endpoints for external integrations
- Webhook notifications for commission events
- Real-time commission calculations
- Mobile app support

## Support

For technical support or feature requests:
- **System Administration**: Contact your system administrator
- **Development Issues**: Review cloud function logs and error messages
- **Feature Requests**: Submit through your internal ticketing system

---

**Version**: 1.0.0  
**Last Updated**: December 2024  
**Compatibility**: SolushipX Enterprise Platform v2.0+ 