// Role Permissions Configuration
// This file defines all permissions for each role in the application

export const ROLES = {
  SUPER_ADMIN: 'superadmin',
  ADMIN: 'admin', 
  USER: 'user', // Company Admin
  ACCOUNTING: 'accounting',
  COMPANY_STAFF: 'company_staff',
  MANUFACTURER: 'manufacturer' // NEW: Manufacturing Partner Role
};

// Define all available permissions in the system
export const PERMISSIONS = {
  // Dashboard & General Access
  VIEW_DASHBOARD: 'view_dashboard',
  VIEW_ADMIN_DASHBOARD: 'view_admin_dashboard',
  
  // User Management
  VIEW_USERS: 'view_users',
  CREATE_USERS: 'create_users',
  EDIT_USERS: 'edit_users',
  DELETE_USERS: 'delete_users',
  MANAGE_USER_ROLES: 'manage_user_roles',
  INVITE_USERS: 'invite_users',
  RESET_USER_PASSWORD: 'reset_user_password',
  
  // Company Management
  VIEW_COMPANIES: 'view_companies',
  CREATE_COMPANIES: 'create_companies',
  EDIT_COMPANIES: 'edit_companies',
  DELETE_COMPANIES: 'delete_companies',
  VIEW_ALL_COMPANIES: 'view_all_companies', // Super admin can see all companies
  
  // Organization Management
  VIEW_ORGANIZATIONS: 'view_organizations',
  CREATE_ORGANIZATIONS: 'create_organizations',
  EDIT_ORGANIZATIONS: 'edit_organizations',
  DELETE_ORGANIZATIONS: 'delete_organizations',
  
  // Shipment Management
  VIEW_SHIPMENTS: 'view_shipments',
  CREATE_SHIPMENTS: 'create_shipments',
  USE_QUICKSHIP: 'use_quickship', // Specific permission for QuickShip functionality
  EDIT_SHIPMENTS: 'edit_shipments',
  DELETE_SHIPMENTS: 'delete_shipments',
  VIEW_ALL_SHIPMENTS: 'view_all_shipments', // Admin can see all shipments
  EXPORT_SHIPMENTS: 'export_shipments',
  MANAGE_DRAFT_SHIPMENTS: 'manage_draft_shipments',
  
  // Financial Information
  VIEW_SHIPMENT_COSTS: 'view_shipment_costs', // NEW: View cost and profit information
  VIEW_SHIPMENT_FINANCIALS: 'view_shipment_financials', // NEW: View detailed financial breakdown
  
  // Carrier Confirmations
  VIEW_CARRIER_CONFIRMATIONS: 'view_carrier_confirmations', // NEW: View carrier confirmations
  GENERATE_CARRIER_CONFIRMATIONS: 'generate_carrier_confirmations', // NEW: Generate/regenerate carrier confirmations
  
  // Customer Management
  VIEW_CUSTOMERS: 'view_customers',
  CREATE_CUSTOMERS: 'create_customers',
  EDIT_CUSTOMERS: 'edit_customers',
  DELETE_CUSTOMERS: 'delete_customers',
  VIEW_ALL_CUSTOMERS: 'view_all_customers',
  
  // Address Book Management
  VIEW_ADDRESSES: 'view_addresses',
  CREATE_ADDRESSES: 'create_addresses',
  EDIT_ADDRESSES: 'edit_addresses',
  DELETE_ADDRESSES: 'delete_addresses',
  VIEW_ALL_ADDRESSES: 'view_all_addresses',
  EXPORT_ADDRESSES: 'export_addresses',
  
  // Billing & Invoicing
  VIEW_BILLING: 'view_billing',
  CREATE_INVOICES: 'create_invoices',
  EDIT_INVOICES: 'edit_invoices',
  DELETE_INVOICES: 'delete_invoices',
  VIEW_ALL_INVOICES: 'view_all_invoices',
  MANAGE_PAYMENT_TERMS: 'manage_payment_terms',
  GENERATE_INVOICES: 'generate_invoices',
  VIEW_PAYMENTS: 'view_payments',
  MANAGE_AP_PROCESSING: 'manage_ap_processing',
  
  // Sales Commission Management
  VIEW_COMMISSIONS: 'view_commissions',
  MANAGE_SALES_PERSONS: 'manage_sales_persons',
  MANAGE_SALES_TEAMS: 'manage_sales_teams',
  CALCULATE_COMMISSIONS: 'calculate_commissions',
  GENERATE_COMMISSION_REPORTS: 'generate_commission_reports',
  SCHEDULE_COMMISSION_REPORTS: 'schedule_commission_reports',
  
  // Carrier Management
  VIEW_CARRIERS: 'view_carriers',
  CREATE_CARRIERS: 'create_carriers',
  EDIT_CARRIERS: 'edit_carriers',
  DELETE_CARRIERS: 'delete_carriers',
  MANAGE_CARRIER_KEYS: 'manage_carrier_keys',
  MANAGE_EDI_MAPPING: 'manage_edi_mapping',
  MANAGE_CARRIERS: 'manage_carriers', // Combined carrier management permission
  
  // Address Management (Combined permission for address book access)
  MANAGE_ADDRESSES: 'manage_addresses',
  
  // Broker Management
  MANAGE_BROKERS: 'manage_brokers',
  
  // Reports & Analytics
  VIEW_REPORTS: 'view_reports',
  CREATE_REPORTS: 'create_reports',
  SCHEDULE_REPORTS: 'schedule_reports',
  VIEW_ALL_REPORTS: 'view_all_reports',
  EXPORT_REPORTS: 'export_reports',
  VIEW_ANALYTICS: 'view_analytics',
  VIEW_FOLLOWUPS: 'view_followups',
  
  // Tracking
  VIEW_TRACKING: 'view_tracking',
  UPDATE_TRACKING: 'update_tracking',
  
  // Profile Management
  VIEW_PROFILE: 'view_profile',
  EDIT_PROFILE: 'edit_profile',
  
  // Notification Management
  VIEW_NOTIFICATIONS: 'view_notifications',
  MANAGE_NOTIFICATIONS: 'manage_notifications',
  
  // System Settings
  VIEW_SETTINGS: 'view_settings',
  MANAGE_SETTINGS: 'manage_settings',
  MANAGE_ROLES: 'manage_roles',
  MANAGE_MARKUPS: 'manage_markups',
  
  // Advanced Features
  USE_QUICKSHIP: 'use_quickship',
  USE_AI_AGENT: 'use_ai_agent',
  USE_ADVANCED_ROUTING: 'use_advanced_routing',
  MANAGE_INTEGRATIONS: 'manage_integrations',
  
  // Rate and Pricing Visibility
  VIEW_RATE_PRICING: 'view_rate_pricing',
  VIEW_RATE_BREAKDOWN: 'view_rate_breakdown',
  
  // Shipment Information Fields
  VIEW_BILL_TYPE: 'view_bill_type',
  VIEW_ETA_FIELDS: 'view_eta_fields',
  
  // Package Information Fields  
  VIEW_DECLARED_VALUE: 'view_declared_value',
  VIEW_FREIGHT_CLASS: 'view_freight_class',
};

// Define role-based permissions
export const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: {
    // Super admin has ALL permissions - no limitations
    '*': true, // Special flag indicating all permissions
    
    // EXPLICIT PERMISSIONS FOR CRITICAL ROUTES (FALLBACK)
    [PERMISSIONS.VIEW_ADMIN_DASHBOARD]: true,
    [PERMISSIONS.MANAGE_ROLES]: true,
    [PERMISSIONS.VIEW_USERS]: true,
    [PERMISSIONS.CREATE_USERS]: true,
    [PERMISSIONS.EDIT_USERS]: true,
    [PERMISSIONS.DELETE_USERS]: true,
    [PERMISSIONS.VIEW_COMPANIES]: true,
    [PERMISSIONS.CREATE_COMPANIES]: true,
    [PERMISSIONS.EDIT_COMPANIES]: true,
    [PERMISSIONS.DELETE_COMPANIES]: true,
  },
  
  [ROLES.ADMIN]: {
    // Dashboard & General Access
    [PERMISSIONS.VIEW_DASHBOARD]: true,
    [PERMISSIONS.VIEW_ADMIN_DASHBOARD]: true,
    
    // User Management
    [PERMISSIONS.VIEW_USERS]: true,
    [PERMISSIONS.CREATE_USERS]: true,
    [PERMISSIONS.EDIT_USERS]: true,
    [PERMISSIONS.DELETE_USERS]: true,
    [PERMISSIONS.MANAGE_USER_ROLES]: true,
    [PERMISSIONS.INVITE_USERS]: true,
    [PERMISSIONS.RESET_USER_PASSWORD]: true,
    
    // Company Management
    [PERMISSIONS.VIEW_COMPANIES]: true,
    [PERMISSIONS.CREATE_COMPANIES]: true,
    [PERMISSIONS.EDIT_COMPANIES]: true,
    [PERMISSIONS.DELETE_COMPANIES]: true,
    [PERMISSIONS.VIEW_ALL_COMPANIES]: true,
    
    // Organization Management
    [PERMISSIONS.VIEW_ORGANIZATIONS]: true,
    [PERMISSIONS.CREATE_ORGANIZATIONS]: true,
    [PERMISSIONS.EDIT_ORGANIZATIONS]: true,
    [PERMISSIONS.DELETE_ORGANIZATIONS]: true,
    
    // Shipment Management
    [PERMISSIONS.VIEW_SHIPMENTS]: true,
    [PERMISSIONS.CREATE_SHIPMENTS]: true,
    [PERMISSIONS.USE_QUICKSHIP]: true,
    [PERMISSIONS.EDIT_SHIPMENTS]: true,
    [PERMISSIONS.DELETE_SHIPMENTS]: true,
    [PERMISSIONS.VIEW_ALL_SHIPMENTS]: true,
    [PERMISSIONS.EXPORT_SHIPMENTS]: true,
    [PERMISSIONS.MANAGE_DRAFT_SHIPMENTS]: true,
    
    // Financial Information - Full access for Admin
    [PERMISSIONS.VIEW_SHIPMENT_COSTS]: true,
    [PERMISSIONS.VIEW_SHIPMENT_FINANCIALS]: true,
    
    // Carrier Confirmations - Full access for Admin
    [PERMISSIONS.VIEW_CARRIER_CONFIRMATIONS]: true,
    [PERMISSIONS.GENERATE_CARRIER_CONFIRMATIONS]: true,
    
    // Customer Management
    [PERMISSIONS.VIEW_CUSTOMERS]: true,
    [PERMISSIONS.CREATE_CUSTOMERS]: true,
    [PERMISSIONS.EDIT_CUSTOMERS]: true,
    [PERMISSIONS.DELETE_CUSTOMERS]: true,
    [PERMISSIONS.VIEW_ALL_CUSTOMERS]: true,
    
    // Address Book Management
    [PERMISSIONS.VIEW_ADDRESSES]: true,
    [PERMISSIONS.CREATE_ADDRESSES]: true,
    [PERMISSIONS.EDIT_ADDRESSES]: true,
    [PERMISSIONS.DELETE_ADDRESSES]: true,
    [PERMISSIONS.VIEW_ALL_ADDRESSES]: true,
    [PERMISSIONS.EXPORT_ADDRESSES]: true,
    
    // Billing & Invoicing
    [PERMISSIONS.VIEW_BILLING]: true,
    [PERMISSIONS.CREATE_INVOICES]: true,
    [PERMISSIONS.EDIT_INVOICES]: true,
    [PERMISSIONS.DELETE_INVOICES]: true,
    [PERMISSIONS.VIEW_ALL_INVOICES]: true,
    [PERMISSIONS.MANAGE_PAYMENT_TERMS]: true,
    [PERMISSIONS.GENERATE_INVOICES]: true,
    [PERMISSIONS.VIEW_PAYMENTS]: true,
    [PERMISSIONS.MANAGE_AP_PROCESSING]: true,
    
    // Sales Commission Management
    [PERMISSIONS.VIEW_COMMISSIONS]: true,
    [PERMISSIONS.MANAGE_SALES_PERSONS]: true,
    [PERMISSIONS.MANAGE_SALES_TEAMS]: true,
    [PERMISSIONS.CALCULATE_COMMISSIONS]: true,
    [PERMISSIONS.GENERATE_COMMISSION_REPORTS]: true,
    [PERMISSIONS.SCHEDULE_COMMISSION_REPORTS]: true,
    
    // Carrier Management
    [PERMISSIONS.VIEW_CARRIERS]: true,
    [PERMISSIONS.CREATE_CARRIERS]: true,
    [PERMISSIONS.EDIT_CARRIERS]: true,
    [PERMISSIONS.DELETE_CARRIERS]: true,
    [PERMISSIONS.MANAGE_CARRIER_KEYS]: true,
    [PERMISSIONS.MANAGE_EDI_MAPPING]: true,
    
    // Reports & Analytics
    [PERMISSIONS.VIEW_REPORTS]: true,
    [PERMISSIONS.CREATE_REPORTS]: true,
    [PERMISSIONS.SCHEDULE_REPORTS]: true,
    [PERMISSIONS.VIEW_ALL_REPORTS]: true,
    [PERMISSIONS.EXPORT_REPORTS]: true,
    [PERMISSIONS.VIEW_ANALYTICS]: true,
    [PERMISSIONS.VIEW_FOLLOWUPS]: true,
    
    // Tracking
    [PERMISSIONS.VIEW_TRACKING]: true,
    [PERMISSIONS.UPDATE_TRACKING]: true,
    
    // Profile Management
    [PERMISSIONS.VIEW_PROFILE]: true,
    [PERMISSIONS.EDIT_PROFILE]: true,
    
    // Notification Management
    [PERMISSIONS.VIEW_NOTIFICATIONS]: true,
    [PERMISSIONS.MANAGE_NOTIFICATIONS]: true,
    
    // System Settings
    [PERMISSIONS.VIEW_SETTINGS]: true,
    [PERMISSIONS.MANAGE_SETTINGS]: true,
    [PERMISSIONS.MANAGE_ROLES]: true,
    [PERMISSIONS.MANAGE_MARKUPS]: true,
    
    // Advanced Features
    [PERMISSIONS.USE_QUICKSHIP]: true,
    [PERMISSIONS.USE_AI_AGENT]: true,
    [PERMISSIONS.USE_ADVANCED_ROUTING]: true,
    [PERMISSIONS.MANAGE_INTEGRATIONS]: true,
  },
  
  // ADMIN ROLE - Administrative access to manage the system
  [ROLES.ADMIN]: {
    // Dashboard & General Access
    [PERMISSIONS.VIEW_DASHBOARD]: true,
    [PERMISSIONS.VIEW_ADMIN_DASHBOARD]: true,
    
    // User Management
    [PERMISSIONS.VIEW_USERS]: true,
    [PERMISSIONS.CREATE_USERS]: true,
    [PERMISSIONS.EDIT_USERS]: true,
    [PERMISSIONS.DELETE_USERS]: true,
    [PERMISSIONS.MANAGE_USER_ROLES]: true,
    [PERMISSIONS.INVITE_USERS]: true,
    [PERMISSIONS.RESET_USER_PASSWORD]: true,
    
    // Company Management
    [PERMISSIONS.VIEW_COMPANIES]: true,
    [PERMISSIONS.CREATE_COMPANIES]: true,
    [PERMISSIONS.EDIT_COMPANIES]: true,
    [PERMISSIONS.DELETE_COMPANIES]: false, // Only super admin can delete
    [PERMISSIONS.VIEW_ALL_COMPANIES]: true,
    
    // Organization Management
    [PERMISSIONS.VIEW_ORGANIZATIONS]: true,
    [PERMISSIONS.CREATE_ORGANIZATIONS]: true,
    [PERMISSIONS.EDIT_ORGANIZATIONS]: true,
    [PERMISSIONS.DELETE_ORGANIZATIONS]: false, // Only super admin can delete
    
    // Customer Management
    [PERMISSIONS.VIEW_CUSTOMERS]: true,
    [PERMISSIONS.CREATE_CUSTOMERS]: true,
    [PERMISSIONS.EDIT_CUSTOMERS]: true,
    [PERMISSIONS.DELETE_CUSTOMERS]: true,
    [PERMISSIONS.VIEW_ALL_CUSTOMERS]: true,
    
    // Shipment Management
    [PERMISSIONS.VIEW_SHIPMENTS]: true,
    [PERMISSIONS.CREATE_SHIPMENTS]: true,
    [PERMISSIONS.USE_QUICKSHIP]: true,
    [PERMISSIONS.EDIT_SHIPMENTS]: true,
    [PERMISSIONS.DELETE_SHIPMENTS]: true,
    [PERMISSIONS.VIEW_ALL_SHIPMENTS]: true,
    [PERMISSIONS.MANUAL_STATUS_OVERRIDE]: true,
    
    // Address Management
    [PERMISSIONS.VIEW_ADDRESSES]: true,
    [PERMISSIONS.CREATE_ADDRESSES]: true,
    [PERMISSIONS.EDIT_ADDRESSES]: true,
    [PERMISSIONS.DELETE_ADDRESSES]: true,
    [PERMISSIONS.VIEW_ALL_ADDRESSES]: true,
    [PERMISSIONS.EXPORT_ADDRESSES]: true,
    
    // Billing & Invoicing
    [PERMISSIONS.VIEW_BILLING]: true,
    [PERMISSIONS.CREATE_INVOICES]: true,
    [PERMISSIONS.EDIT_INVOICES]: true,
    [PERMISSIONS.DELETE_INVOICES]: true,
    [PERMISSIONS.VIEW_ALL_INVOICES]: true,
    [PERMISSIONS.MANAGE_PAYMENT_TERMS]: true,
    [PERMISSIONS.GENERATE_INVOICES]: true,
    [PERMISSIONS.VIEW_PAYMENTS]: true,
    [PERMISSIONS.MANAGE_AP_PROCESSING]: true,
    
    // Sales Commission Management
    [PERMISSIONS.VIEW_COMMISSIONS]: true,
    [PERMISSIONS.MANAGE_SALES_PERSONS]: true,
    [PERMISSIONS.MANAGE_SALES_TEAMS]: true,
    [PERMISSIONS.CALCULATE_COMMISSIONS]: true,
    [PERMISSIONS.GENERATE_COMMISSION_REPORTS]: true,
    [PERMISSIONS.SCHEDULE_COMMISSION_REPORTS]: true,
    
    // Carrier Management
    [PERMISSIONS.VIEW_CARRIERS]: true,
    [PERMISSIONS.CREATE_CARRIERS]: true,
    [PERMISSIONS.EDIT_CARRIERS]: true,
    [PERMISSIONS.DELETE_CARRIERS]: true,
    [PERMISSIONS.MANAGE_CARRIER_KEYS]: true,
    [PERMISSIONS.MANAGE_EDI_MAPPING]: true,
    
    // Reports & Analytics
    [PERMISSIONS.VIEW_REPORTS]: true,
    [PERMISSIONS.CREATE_REPORTS]: true,
    [PERMISSIONS.SCHEDULE_REPORTS]: true,
    [PERMISSIONS.VIEW_ALL_REPORTS]: true,
    [PERMISSIONS.EXPORT_REPORTS]: true,
    [PERMISSIONS.VIEW_ANALYTICS]: true,
    [PERMISSIONS.VIEW_FOLLOWUPS]: true,
    
    // Tracking
    [PERMISSIONS.VIEW_TRACKING]: true,
    [PERMISSIONS.UPDATE_TRACKING]: true,
    
    // Profile Management
    [PERMISSIONS.VIEW_PROFILE]: true,
    [PERMISSIONS.EDIT_PROFILE]: true,
    
    // Notification Management
    [PERMISSIONS.VIEW_NOTIFICATIONS]: true,
    [PERMISSIONS.MANAGE_NOTIFICATIONS]: true,
    
    // System Settings - Limited (no role management)
    [PERMISSIONS.MANAGE_SETTINGS]: true,
    [PERMISSIONS.MANAGE_ROLES]: false, // Only super admin can manage roles
    [PERMISSIONS.MANAGE_MARKUPS]: true,
    
    // Advanced Features
    [PERMISSIONS.USE_QUICKSHIP]: true,
    [PERMISSIONS.USE_AI_AGENT]: true,
    [PERMISSIONS.USE_ADVANCED_ROUTING]: true,
    [PERMISSIONS.MANAGE_INTEGRATIONS]: true,
    
    // Rate and Pricing Visibility - FULL ACCESS for admins
    [PERMISSIONS.VIEW_RATE_PRICING]: true,
    [PERMISSIONS.VIEW_RATE_BREAKDOWN]: true,
    
    // Shipment Information Fields - FULL ACCESS for admins
    [PERMISSIONS.VIEW_BILL_TYPE]: true,
    [PERMISSIONS.VIEW_ETA_FIELDS]: true,
    
    // Package Information Fields - FULL ACCESS for admins
    [PERMISSIONS.VIEW_DECLARED_VALUE]: true,
    [PERMISSIONS.VIEW_FREIGHT_CLASS]: true,
  },
  
  [ROLES.USER]: { // Company Admin
    // Dashboard & General Access
    [PERMISSIONS.VIEW_DASHBOARD]: true,
    [PERMISSIONS.VIEW_ADMIN_DASHBOARD]: false,
    
    // User Management - Limited to their company
    [PERMISSIONS.VIEW_USERS]: false,
    [PERMISSIONS.CREATE_USERS]: false,
    [PERMISSIONS.EDIT_USERS]: false,
    [PERMISSIONS.DELETE_USERS]: false,
    [PERMISSIONS.MANAGE_USER_ROLES]: false,
    [PERMISSIONS.INVITE_USERS]: false,
    [PERMISSIONS.RESET_USER_PASSWORD]: false,
    
    // Company Management - Can only view/edit their own company
    [PERMISSIONS.VIEW_COMPANIES]: true, // Only their company
    [PERMISSIONS.CREATE_COMPANIES]: false,
    [PERMISSIONS.EDIT_COMPANIES]: true, // Only their company
    [PERMISSIONS.DELETE_COMPANIES]: false,
    [PERMISSIONS.VIEW_ALL_COMPANIES]: false,
    
    // Organization Management
    [PERMISSIONS.VIEW_ORGANIZATIONS]: false,
    [PERMISSIONS.CREATE_ORGANIZATIONS]: false,
    [PERMISSIONS.EDIT_ORGANIZATIONS]: false,
    [PERMISSIONS.DELETE_ORGANIZATIONS]: false,
    
    // Shipment Management - Only their company's shipments
    [PERMISSIONS.VIEW_SHIPMENTS]: true,
    [PERMISSIONS.CREATE_SHIPMENTS]: true,
    [PERMISSIONS.USE_QUICKSHIP]: true,
    [PERMISSIONS.EDIT_SHIPMENTS]: true,
    [PERMISSIONS.DELETE_SHIPMENTS]: true,
    [PERMISSIONS.VIEW_ALL_SHIPMENTS]: false,
    [PERMISSIONS.EXPORT_SHIPMENTS]: true,
    [PERMISSIONS.MANAGE_DRAFT_SHIPMENTS]: true,
    
    // Financial Information - Company admins can see costs/profits for their company
    [PERMISSIONS.VIEW_SHIPMENT_COSTS]: true,
    [PERMISSIONS.VIEW_SHIPMENT_FINANCIALS]: true,
    
    // Carrier Confirmations - Can view but not generate/regenerate
    [PERMISSIONS.VIEW_CARRIER_CONFIRMATIONS]: true,
    [PERMISSIONS.GENERATE_CARRIER_CONFIRMATIONS]: true, // Allow regular users to regenerate carrier confirmations
    
    // Customer Management - Only their company's customers
    [PERMISSIONS.VIEW_CUSTOMERS]: true,
    [PERMISSIONS.CREATE_CUSTOMERS]: true,
    [PERMISSIONS.EDIT_CUSTOMERS]: true,
    [PERMISSIONS.DELETE_CUSTOMERS]: true,
    [PERMISSIONS.VIEW_ALL_CUSTOMERS]: false,
    
    // Address Book Management - Only their company's addresses
    [PERMISSIONS.VIEW_ADDRESSES]: true,
    [PERMISSIONS.CREATE_ADDRESSES]: true,
    [PERMISSIONS.EDIT_ADDRESSES]: true,
    [PERMISSIONS.DELETE_ADDRESSES]: true,
    [PERMISSIONS.VIEW_ALL_ADDRESSES]: false,
    [PERMISSIONS.EXPORT_ADDRESSES]: true,
    
    // Billing & Invoicing - Only their company's billing
    [PERMISSIONS.VIEW_BILLING]: true,
    [PERMISSIONS.CREATE_INVOICES]: false,
    [PERMISSIONS.EDIT_INVOICES]: false,
    [PERMISSIONS.DELETE_INVOICES]: false,
    [PERMISSIONS.VIEW_ALL_INVOICES]: false,
    [PERMISSIONS.MANAGE_PAYMENT_TERMS]: false,
    [PERMISSIONS.GENERATE_INVOICES]: false,
    
    // Carrier Management - View only
    [PERMISSIONS.VIEW_CARRIERS]: true,
    [PERMISSIONS.CREATE_CARRIERS]: false,
    [PERMISSIONS.EDIT_CARRIERS]: false,
    [PERMISSIONS.DELETE_CARRIERS]: false,
    [PERMISSIONS.MANAGE_CARRIER_KEYS]: false,
    [PERMISSIONS.MANAGE_EDI_MAPPING]: false,
    
    // Reports & Analytics - Only their company's data
    [PERMISSIONS.VIEW_REPORTS]: true,
    [PERMISSIONS.CREATE_REPORTS]: true,
    [PERMISSIONS.SCHEDULE_REPORTS]: true,
    [PERMISSIONS.VIEW_ALL_REPORTS]: false,
    [PERMISSIONS.EXPORT_REPORTS]: true,
    [PERMISSIONS.VIEW_ANALYTICS]: true,
    
    // Tracking
    [PERMISSIONS.VIEW_TRACKING]: true,
    [PERMISSIONS.UPDATE_TRACKING]: false,
    
    // Profile Management
    [PERMISSIONS.VIEW_PROFILE]: true,
    [PERMISSIONS.EDIT_PROFILE]: true,
    
    // Notification Management
    [PERMISSIONS.VIEW_NOTIFICATIONS]: true,
    [PERMISSIONS.MANAGE_NOTIFICATIONS]: true,
    
    // System Settings
    [PERMISSIONS.VIEW_SETTINGS]: true, // Allow company admins to view settings
    [PERMISSIONS.MANAGE_SETTINGS]: true, // Allow company admins to manage settings (shipment statuses)
    [PERMISSIONS.MANAGE_ROLES]: false,
    [PERMISSIONS.MANAGE_MARKUPS]: false,
    
    // Advanced Features
    [PERMISSIONS.USE_QUICKSHIP]: true,
    [PERMISSIONS.USE_AI_AGENT]: true,
    [PERMISSIONS.USE_ADVANCED_ROUTING]: true,
    [PERMISSIONS.MANAGE_INTEGRATIONS]: false,
    
    // Rate and Pricing Visibility - FULL ACCESS for company admins
    [PERMISSIONS.VIEW_RATE_PRICING]: true,
    [PERMISSIONS.VIEW_RATE_BREAKDOWN]: true,
    
    // Shipment Information Fields - FULL ACCESS for company admins
    [PERMISSIONS.VIEW_BILL_TYPE]: true,
    [PERMISSIONS.VIEW_ETA_FIELDS]: true,
    
    // Package Information Fields - FULL ACCESS for company admins
    [PERMISSIONS.VIEW_DECLARED_VALUE]: true,
    [PERMISSIONS.VIEW_FREIGHT_CLASS]: true,
  },
  
  [ROLES.ACCOUNTING]: { // Accounting role - focused on billing and invoicing
    // Dashboard & General Access
    [PERMISSIONS.VIEW_DASHBOARD]: true,
    [PERMISSIONS.VIEW_ADMIN_DASHBOARD]: true,
    
    // User Management - Limited
    [PERMISSIONS.VIEW_USERS]: false,
    [PERMISSIONS.CREATE_USERS]: false,
    [PERMISSIONS.EDIT_USERS]: false,
    [PERMISSIONS.DELETE_USERS]: false,
    [PERMISSIONS.MANAGE_USER_ROLES]: false,
    [PERMISSIONS.INVITE_USERS]: false,
    [PERMISSIONS.RESET_USER_PASSWORD]: false,
    
    // Company Management - View only for context
    [PERMISSIONS.VIEW_COMPANIES]: true,
    [PERMISSIONS.CREATE_COMPANIES]: false,
    [PERMISSIONS.EDIT_COMPANIES]: false,
    [PERMISSIONS.DELETE_COMPANIES]: false,
    [PERMISSIONS.VIEW_ALL_COMPANIES]: true,
    
    // Organization Management
    [PERMISSIONS.VIEW_ORGANIZATIONS]: false,
    [PERMISSIONS.CREATE_ORGANIZATIONS]: false,
    [PERMISSIONS.EDIT_ORGANIZATIONS]: false,
    [PERMISSIONS.DELETE_ORGANIZATIONS]: false,
    
    // Shipment Management - View only for billing context
    [PERMISSIONS.VIEW_SHIPMENTS]: true,
    [PERMISSIONS.CREATE_SHIPMENTS]: false,
    [PERMISSIONS.EDIT_SHIPMENTS]: false,
    [PERMISSIONS.DELETE_SHIPMENTS]: false,
    [PERMISSIONS.VIEW_ALL_SHIPMENTS]: true,
    [PERMISSIONS.EXPORT_SHIPMENTS]: true,
    [PERMISSIONS.MANAGE_DRAFT_SHIPMENTS]: false,
    
    // Financial Information - Accounting needs to see costs for billing
    [PERMISSIONS.VIEW_SHIPMENT_COSTS]: true,
    [PERMISSIONS.VIEW_SHIPMENT_FINANCIALS]: true,
    
    // Carrier Confirmations - Can view but not generate (read-only for billing context)
    [PERMISSIONS.VIEW_CARRIER_CONFIRMATIONS]: true,
    [PERMISSIONS.GENERATE_CARRIER_CONFIRMATIONS]: false,
    
    // Customer Management - View only for billing context
    [PERMISSIONS.VIEW_CUSTOMERS]: true,
    [PERMISSIONS.CREATE_CUSTOMERS]: false,
    [PERMISSIONS.EDIT_CUSTOMERS]: false,
    [PERMISSIONS.DELETE_CUSTOMERS]: false,
    [PERMISSIONS.VIEW_ALL_CUSTOMERS]: true,
    
    // Address Book Management - View only for billing context
    [PERMISSIONS.VIEW_ADDRESSES]: true,
    [PERMISSIONS.CREATE_ADDRESSES]: false,
    [PERMISSIONS.EDIT_ADDRESSES]: false,
    [PERMISSIONS.DELETE_ADDRESSES]: false,
    [PERMISSIONS.VIEW_ALL_ADDRESSES]: true,
    [PERMISSIONS.EXPORT_ADDRESSES]: true,
    
    // Billing & Invoicing - Full access
    [PERMISSIONS.VIEW_BILLING]: true,
    [PERMISSIONS.CREATE_INVOICES]: true,
    [PERMISSIONS.EDIT_INVOICES]: true,
    [PERMISSIONS.DELETE_INVOICES]: true,
    [PERMISSIONS.VIEW_ALL_INVOICES]: true,
    [PERMISSIONS.MANAGE_PAYMENT_TERMS]: true,
    [PERMISSIONS.GENERATE_INVOICES]: true,
    
    // Carrier Management - View only
    [PERMISSIONS.VIEW_CARRIERS]: true,
    [PERMISSIONS.CREATE_CARRIERS]: false,
    [PERMISSIONS.EDIT_CARRIERS]: false,
    [PERMISSIONS.DELETE_CARRIERS]: false,
    [PERMISSIONS.MANAGE_CARRIER_KEYS]: false,
    [PERMISSIONS.MANAGE_EDI_MAPPING]: false,
    
    // Reports & Analytics - Financial reports
    [PERMISSIONS.VIEW_REPORTS]: true,
    [PERMISSIONS.CREATE_REPORTS]: true,
    [PERMISSIONS.SCHEDULE_REPORTS]: true,
    [PERMISSIONS.VIEW_ALL_REPORTS]: true,
    [PERMISSIONS.EXPORT_REPORTS]: true,
    [PERMISSIONS.VIEW_ANALYTICS]: true,
    
    // Tracking - View only
    [PERMISSIONS.VIEW_TRACKING]: true,
    [PERMISSIONS.UPDATE_TRACKING]: false,
    
    // Profile Management
    [PERMISSIONS.VIEW_PROFILE]: true,
    [PERMISSIONS.EDIT_PROFILE]: true,
    
    // Notification Management
    [PERMISSIONS.VIEW_NOTIFICATIONS]: true,
    [PERMISSIONS.MANAGE_NOTIFICATIONS]: true,
    
    // System Settings - Limited
    [PERMISSIONS.VIEW_SETTINGS]: false,
    [PERMISSIONS.MANAGE_SETTINGS]: false,
    [PERMISSIONS.MANAGE_ROLES]: false,
    [PERMISSIONS.MANAGE_MARKUPS]: true, // Can manage markups for billing
    
    // Advanced Features
    [PERMISSIONS.USE_QUICKSHIP]: false,
    [PERMISSIONS.USE_AI_AGENT]: false,
    [PERMISSIONS.USE_ADVANCED_ROUTING]: false,
    [PERMISSIONS.MANAGE_INTEGRATIONS]: false,
    
    // Rate and Pricing Visibility - FULL ACCESS for accounting (they need pricing info)
    [PERMISSIONS.VIEW_RATE_PRICING]: true,
    [PERMISSIONS.VIEW_RATE_BREAKDOWN]: true,
    
    // Shipment Information Fields - FULL ACCESS for accounting
    [PERMISSIONS.VIEW_BILL_TYPE]: true,
    [PERMISSIONS.VIEW_ETA_FIELDS]: true,
    
    // Package Information Fields - FULL ACCESS for accounting
    [PERMISSIONS.VIEW_DECLARED_VALUE]: true,
    [PERMISSIONS.VIEW_FREIGHT_CLASS]: true,
  },
  
  [ROLES.COMPANY_STAFF]: { // Company Staff - basic operational access
    // Dashboard & General Access
    [PERMISSIONS.VIEW_DASHBOARD]: true,
    [PERMISSIONS.VIEW_ADMIN_DASHBOARD]: false,
    
    // User Management - No access
    [PERMISSIONS.VIEW_USERS]: false,
    [PERMISSIONS.CREATE_USERS]: false,
    [PERMISSIONS.EDIT_USERS]: false,
    [PERMISSIONS.DELETE_USERS]: false,
    [PERMISSIONS.MANAGE_USER_ROLES]: false,
    [PERMISSIONS.INVITE_USERS]: false,
    [PERMISSIONS.RESET_USER_PASSWORD]: false,
    
    // Company Management - View only their company
    [PERMISSIONS.VIEW_COMPANIES]: true, // Only their company
    [PERMISSIONS.CREATE_COMPANIES]: false,
    [PERMISSIONS.EDIT_COMPANIES]: false,
    [PERMISSIONS.DELETE_COMPANIES]: false,
    [PERMISSIONS.VIEW_ALL_COMPANIES]: false,
    
    // Organization Management
    [PERMISSIONS.VIEW_ORGANIZATIONS]: false,
    [PERMISSIONS.CREATE_ORGANIZATIONS]: false,
    [PERMISSIONS.EDIT_ORGANIZATIONS]: false,
    [PERMISSIONS.DELETE_ORGANIZATIONS]: false,
    
    // Shipment Management - Basic operations only
    [PERMISSIONS.VIEW_SHIPMENTS]: true,
    [PERMISSIONS.CREATE_SHIPMENTS]: true,
    [PERMISSIONS.USE_QUICKSHIP]: true,
    [PERMISSIONS.EDIT_SHIPMENTS]: false, // Cannot edit existing shipments
    [PERMISSIONS.DELETE_SHIPMENTS]: false,
    [PERMISSIONS.VIEW_ALL_SHIPMENTS]: false,
    [PERMISSIONS.EXPORT_SHIPMENTS]: true,
    [PERMISSIONS.MANAGE_DRAFT_SHIPMENTS]: true,
    
    // Financial Information - RESTRICTED: Company staff cannot see costs/profits
    [PERMISSIONS.VIEW_SHIPMENT_COSTS]: false,
    [PERMISSIONS.VIEW_SHIPMENT_FINANCIALS]: false,
    
    // Carrier Confirmations - RESTRICTED: Company staff cannot view or manage carrier confirmations
    [PERMISSIONS.VIEW_CARRIER_CONFIRMATIONS]: false,
    [PERMISSIONS.GENERATE_CARRIER_CONFIRMATIONS]: false,
    
    // Customer Management - View and create only
    [PERMISSIONS.VIEW_CUSTOMERS]: true,
    [PERMISSIONS.CREATE_CUSTOMERS]: true,
    [PERMISSIONS.EDIT_CUSTOMERS]: false,
    [PERMISSIONS.DELETE_CUSTOMERS]: false,
    [PERMISSIONS.VIEW_ALL_CUSTOMERS]: false,
    
    // Address Book Management - View and create only
    [PERMISSIONS.VIEW_ADDRESSES]: true,
    [PERMISSIONS.CREATE_ADDRESSES]: true,
    [PERMISSIONS.EDIT_ADDRESSES]: false,
    [PERMISSIONS.DELETE_ADDRESSES]: false,
    [PERMISSIONS.VIEW_ALL_ADDRESSES]: false,
    [PERMISSIONS.EXPORT_ADDRESSES]: true,
    
    // Billing & Invoicing - View only
    [PERMISSIONS.VIEW_BILLING]: true,
    [PERMISSIONS.CREATE_INVOICES]: false,
    [PERMISSIONS.EDIT_INVOICES]: false,
    [PERMISSIONS.DELETE_INVOICES]: false,
    [PERMISSIONS.VIEW_ALL_INVOICES]: false,
    [PERMISSIONS.MANAGE_PAYMENT_TERMS]: false,
    [PERMISSIONS.GENERATE_INVOICES]: false,
    
    // Carrier Management - View only
    [PERMISSIONS.VIEW_CARRIERS]: true,
    [PERMISSIONS.CREATE_CARRIERS]: false,
    [PERMISSIONS.EDIT_CARRIERS]: false,
    [PERMISSIONS.DELETE_CARRIERS]: false,
    [PERMISSIONS.MANAGE_CARRIER_KEYS]: false,
    [PERMISSIONS.MANAGE_EDI_MAPPING]: false,
    
    // Reports & Analytics - Basic reports only
    [PERMISSIONS.VIEW_REPORTS]: true,
    [PERMISSIONS.CREATE_REPORTS]: false,
    [PERMISSIONS.SCHEDULE_REPORTS]: false,
    [PERMISSIONS.VIEW_ALL_REPORTS]: false,
    [PERMISSIONS.EXPORT_REPORTS]: true,
    [PERMISSIONS.VIEW_ANALYTICS]: false,
    
    // Tracking
    [PERMISSIONS.VIEW_TRACKING]: true,
    [PERMISSIONS.UPDATE_TRACKING]: false,
    
    // Profile Management
    [PERMISSIONS.VIEW_PROFILE]: true,
    [PERMISSIONS.EDIT_PROFILE]: true,
    
    // Notification Management
    [PERMISSIONS.VIEW_NOTIFICATIONS]: true,
    [PERMISSIONS.MANAGE_NOTIFICATIONS]: false,
    
    // System Settings
    [PERMISSIONS.VIEW_SETTINGS]: false,
    [PERMISSIONS.MANAGE_SETTINGS]: false,
    [PERMISSIONS.MANAGE_ROLES]: false,
    [PERMISSIONS.MANAGE_MARKUPS]: false,
    
    // Advanced Features
    [PERMISSIONS.USE_QUICKSHIP]: true,
    [PERMISSIONS.USE_AI_AGENT]: false,
    [PERMISSIONS.USE_ADVANCED_ROUTING]: false,
    [PERMISSIONS.MANAGE_INTEGRATIONS]: false,
    
    // Rate and Pricing Visibility - FULL ACCESS for company staff (operational need)
    [PERMISSIONS.VIEW_RATE_PRICING]: true,
    [PERMISSIONS.VIEW_RATE_BREAKDOWN]: true,
    
    // Shipment Information Fields - FULL ACCESS for company staff
    [PERMISSIONS.VIEW_BILL_TYPE]: true,
    [PERMISSIONS.VIEW_ETA_FIELDS]: true,
    
    // Package Information Fields - FULL ACCESS for company staff
    [PERMISSIONS.VIEW_DECLARED_VALUE]: true,
    [PERMISSIONS.VIEW_FREIGHT_CLASS]: true,
  },

  // NEW: MANUFACTURER ROLE - Limited access for manufacturing partners
  [ROLES.MANUFACTURER]: {
    // Dashboard & General Access - LIMITED: Read-only dashboard access
    [PERMISSIONS.VIEW_DASHBOARD]: true,
    [PERMISSIONS.VIEW_ADMIN_DASHBOARD]: false,
    
    // User Management - RESTRICTED: No user management capabilities
    [PERMISSIONS.VIEW_USERS]: false,
    [PERMISSIONS.CREATE_USERS]: false,
    [PERMISSIONS.EDIT_USERS]: false,
    [PERMISSIONS.DELETE_USERS]: false,
    [PERMISSIONS.MANAGE_USER_ROLES]: false,
    [PERMISSIONS.INVITE_USERS]: false,
    [PERMISSIONS.RESET_USER_PASSWORD]: false,
    
    // Company Management - RESTRICTED: No company management
    [PERMISSIONS.VIEW_COMPANIES]: false,
    [PERMISSIONS.CREATE_COMPANIES]: false,
    [PERMISSIONS.EDIT_COMPANIES]: false,
    [PERMISSIONS.DELETE_COMPANIES]: false,
    [PERMISSIONS.VIEW_ALL_COMPANIES]: false,
    
    // Organization Management - RESTRICTED: No organization management
    [PERMISSIONS.VIEW_ORGANIZATIONS]: false,
    [PERMISSIONS.CREATE_ORGANIZATIONS]: false,
    [PERMISSIONS.EDIT_ORGANIZATIONS]: false,
    [PERMISSIONS.DELETE_ORGANIZATIONS]: false,
    
    // Shipment Management - LIMITED: Can create and view shipments but not edit existing ones
    [PERMISSIONS.VIEW_SHIPMENTS]: true, // Can view shipments they're involved in
    [PERMISSIONS.CREATE_SHIPMENTS]: true, // Can create new shipments (but not QuickShip)
    [PERMISSIONS.USE_QUICKSHIP]: false, // Cannot use QuickShip - only regular shipment creation
    [PERMISSIONS.EDIT_SHIPMENTS]: false, // Cannot edit shipments
    [PERMISSIONS.DELETE_SHIPMENTS]: false,
    [PERMISSIONS.VIEW_ALL_SHIPMENTS]: false, // Cannot see all shipments
    [PERMISSIONS.EXPORT_SHIPMENTS]: false,
    [PERMISSIONS.MANAGE_DRAFT_SHIPMENTS]: false,
    
    // Financial Information - RESTRICTED: No financial access
    [PERMISSIONS.VIEW_SHIPMENT_COSTS]: false,
    [PERMISSIONS.VIEW_SHIPMENT_FINANCIALS]: false,
    
    // Carrier Confirmations - RESTRICTED: No carrier confirmation access
    [PERMISSIONS.VIEW_CARRIER_CONFIRMATIONS]: false,
    [PERMISSIONS.GENERATE_CARRIER_CONFIRMATIONS]: false,
    
    // Customer Management - RESTRICTED: No customer management
    [PERMISSIONS.VIEW_CUSTOMERS]: false,
    [PERMISSIONS.CREATE_CUSTOMERS]: false,
    [PERMISSIONS.EDIT_CUSTOMERS]: false,
    [PERMISSIONS.DELETE_CUSTOMERS]: false,
    [PERMISSIONS.VIEW_ALL_CUSTOMERS]: false,
    
    // Address Book Management - LIMITED: Basic address management
    [PERMISSIONS.VIEW_ADDRESSES]: true, // Can view their own addresses
    [PERMISSIONS.CREATE_ADDRESSES]: true, // Can create new addresses
    [PERMISSIONS.EDIT_ADDRESSES]: true, // Can edit their own addresses
    [PERMISSIONS.DELETE_ADDRESSES]: false, // Cannot delete addresses
    [PERMISSIONS.VIEW_ALL_ADDRESSES]: false, // Cannot see all addresses
    [PERMISSIONS.EXPORT_ADDRESSES]: false, // Cannot export addresses
    
    // Billing & Invoicing - RESTRICTED: No billing access
    [PERMISSIONS.VIEW_BILLING]: false,
    [PERMISSIONS.CREATE_INVOICES]: false,
    [PERMISSIONS.EDIT_INVOICES]: false,
    [PERMISSIONS.DELETE_INVOICES]: false,
    [PERMISSIONS.VIEW_ALL_INVOICES]: false,
    [PERMISSIONS.MANAGE_PAYMENT_TERMS]: false,
    [PERMISSIONS.GENERATE_INVOICES]: false,
    
    // Sales Commission Management - RESTRICTED: No commission access
    [PERMISSIONS.VIEW_COMMISSIONS]: false,
    [PERMISSIONS.MANAGE_SALES_PERSONS]: false,
    [PERMISSIONS.MANAGE_SALES_TEAMS]: false,
    [PERMISSIONS.CALCULATE_COMMISSIONS]: false,
    [PERMISSIONS.GENERATE_COMMISSION_REPORTS]: false,
    [PERMISSIONS.SCHEDULE_COMMISSION_REPORTS]: false,
    
    // Carrier Management - LIMITED: View only for transparency
    [PERMISSIONS.VIEW_CARRIERS]: true, // Can see which carriers are being used
    [PERMISSIONS.CREATE_CARRIERS]: false,
    [PERMISSIONS.EDIT_CARRIERS]: false,
    [PERMISSIONS.DELETE_CARRIERS]: false,
    [PERMISSIONS.MANAGE_CARRIER_KEYS]: false,
    [PERMISSIONS.MANAGE_EDI_MAPPING]: false,
    [PERMISSIONS.MANAGE_CARRIERS]: true,
    
    // Address Management - LIMITED: Basic address book access
    [PERMISSIONS.MANAGE_ADDRESSES]: true,
    
    // Broker Management - RESTRICTED: No broker management  
    [PERMISSIONS.MANAGE_BROKERS]: true,
    
    // Reports & Analytics - LIMITED: Basic tracking reports only
    [PERMISSIONS.VIEW_REPORTS]: false,
    [PERMISSIONS.CREATE_REPORTS]: false,
    [PERMISSIONS.SCHEDULE_REPORTS]: false,
    [PERMISSIONS.VIEW_ALL_REPORTS]: false,
    [PERMISSIONS.EXPORT_REPORTS]: false,
    [PERMISSIONS.VIEW_ANALYTICS]: false,
    
    // Tracking - LIMITED: Read-only tracking for assigned shipments
    [PERMISSIONS.VIEW_TRACKING]: true, // Can track shipments they're involved in
    [PERMISSIONS.UPDATE_TRACKING]: false, // Cannot update tracking status
    
    // Profile Management - LIMITED: Can view and edit own profile only
    [PERMISSIONS.VIEW_PROFILE]: true,
    [PERMISSIONS.EDIT_PROFILE]: true,
    
    // Notification Management - LIMITED: View notifications, no management
    [PERMISSIONS.VIEW_NOTIFICATIONS]: true,
    [PERMISSIONS.MANAGE_NOTIFICATIONS]: false,
    
    // System Settings - RESTRICTED: No system access
    [PERMISSIONS.VIEW_SETTINGS]: false,
    [PERMISSIONS.MANAGE_SETTINGS]: false,
    [PERMISSIONS.MANAGE_ROLES]: false,
    [PERMISSIONS.MANAGE_MARKUPS]: false,
    
    // Advanced Features - RESTRICTED: No advanced features
    [PERMISSIONS.USE_QUICKSHIP]: false,
    [PERMISSIONS.USE_AI_AGENT]: false,
    [PERMISSIONS.USE_ADVANCED_ROUTING]: false,
    [PERMISSIONS.MANAGE_INTEGRATIONS]: false,
    
    // Rate and Pricing Visibility - RESTRICTED: No pricing visibility
    [PERMISSIONS.VIEW_RATE_PRICING]: false,
    [PERMISSIONS.VIEW_RATE_BREAKDOWN]: false,
    
    // Shipment Information Fields - RESTRICTED: Limited field access
    [PERMISSIONS.VIEW_BILL_TYPE]: false,
    [PERMISSIONS.VIEW_ETA_FIELDS]: false,
    
    // Package Information Fields - RESTRICTED: Limited package details
    [PERMISSIONS.VIEW_DECLARED_VALUE]: false,
    [PERMISSIONS.VIEW_FREIGHT_CLASS]: false,
  },
};

// Import dynamic role service (lazy import to avoid circular dependencies)
let roleServicePromise = null;
let roleServiceInstance = null;

// Create the service immediately
const createRoleService = async () => {
  const { default: roleService } = await import('../services/roleService');
  await roleService.init();
  roleServiceInstance = roleService;
  console.log('🔥 roleServiceInstance created and stored:', !!roleServiceInstance);
  return roleService;
};

// Start loading immediately
roleServicePromise = createRoleService();

export const getRoleService = async () => {
  return roleServicePromise;
};

// Helper function to check if a user has a specific permission
export const hasPermission = (userRole, permission) => {
  if (!userRole || !permission) return false;
  

  
  // DYNAMIC ROLE SERVICE - PRIMARY CHECK
  if (roleServiceInstance) {
    try {
      const result = roleServiceInstance.hasPermission(userRole, permission);
      

      return result;
    } catch (error) {
      console.error('Error using role service:', error);
      // Fall through to hardcoded fallback
    }
  }
  
  // FALLBACK while role service loads
  
  if (userRole === 'superadmin') {
    return true;
  }
  
  if (userRole === 'admin') {
    const adminPermissions = ROLE_PERMISSIONS[ROLES.ADMIN];
    return adminPermissions && adminPermissions[permission] === true;
  }
  
  if (userRole === 'user') {
    const userPermissions = ROLE_PERMISSIONS[ROLES.USER];
    return userPermissions && userPermissions[permission] === true;
  }
  
  if (userRole === 'manufacturer') {
    const manufacturerPermissions = ROLE_PERMISSIONS[ROLES.MANUFACTURER];
    return manufacturerPermissions && manufacturerPermissions[permission] === true;
  }
  
  return false;
};

// Helper function to check if user has any of the specified permissions (DATABASE ONLY)
export const hasAnyPermission = (userRole, permissions) => {
  if (!userRole || !permissions || !Array.isArray(permissions)) return false;
  
  // Use the hasPermission function which now only uses database
  return permissions.some(permission => hasPermission(userRole, permission));
};

// Helper function to check if user has all of the specified permissions (DATABASE ONLY)
export const hasAllPermissions = (userRole, permissions) => {
  if (!userRole || !permissions || !Array.isArray(permissions)) return false;
  
  // Use the hasPermission function which now only uses database
  return permissions.every(permission => hasPermission(userRole, permission));
};

// Initialize role service (call this during app startup)
export const initializeRoleService = async () => {
  try {
    const service = await getRoleService();
    console.log('✅ Role service initialized successfully');
    return service;
  } catch (error) {
    console.warn('⚠️ Failed to initialize role service, using hardcoded fallback:', error);
    return null;
  }
};

// Helper function to get all permissions for a role
export const getRolePermissions = (role) => {
  const permissions = ROLE_PERMISSIONS[role];
  if (!permissions) return [];
  
  // If super admin, return all permissions
  if (permissions['*'] === true) {
    return Object.values(PERMISSIONS);
  }
  
  // Return only granted permissions
  return Object.entries(permissions)
    .filter(([_, granted]) => granted === true)
    .map(([permission]) => permission);
};

// Route access configuration
export const ROUTE_PERMISSIONS = {
  // Public routes - no permissions needed
  '/': null,
  '/login': null,
  '/signup': null,
  '/set-password': null,
  '/pricing': null,
  
  // Protected routes
  '/dashboard': [PERMISSIONS.VIEW_DASHBOARD],
  '/shipments': [PERMISSIONS.VIEW_SHIPMENTS],
  '/create-shipment': [PERMISSIONS.CREATE_SHIPMENTS],
  '/tracking': [PERMISSIONS.VIEW_TRACKING],
  '/customers': [PERMISSIONS.VIEW_CUSTOMERS],
  '/reports': [PERMISSIONS.VIEW_REPORTS],
  '/billing': [PERMISSIONS.VIEW_BILLING],
  '/profile': [PERMISSIONS.VIEW_PROFILE],
  '/carriers': [PERMISSIONS.VIEW_CARRIERS],
  '/notifications': [PERMISSIONS.VIEW_NOTIFICATIONS],
  
  // Admin routes
  '/admin': [PERMISSIONS.VIEW_ADMIN_DASHBOARD],
  '/admin/dashboard': [PERMISSIONS.VIEW_ADMIN_DASHBOARD],
  
  // Company Management
  '/admin/companies': [PERMISSIONS.VIEW_COMPANIES, PERMISSIONS.VIEW_ALL_COMPANIES],
  '/admin/companies/new': [PERMISSIONS.CREATE_COMPANIES],
  '/admin/companies/:id': [PERMISSIONS.VIEW_COMPANIES, PERMISSIONS.VIEW_ALL_COMPANIES],
  '/admin/companies/:id/edit': [PERMISSIONS.EDIT_COMPANIES],
  
  // Customer Management
  '/admin/customers': [PERMISSIONS.VIEW_CUSTOMERS, PERMISSIONS.VIEW_ALL_CUSTOMERS],
  '/admin/customers/new': [PERMISSIONS.CREATE_CUSTOMERS],
  '/admin/customers/:id': [PERMISSIONS.VIEW_CUSTOMERS, PERMISSIONS.VIEW_ALL_CUSTOMERS],
  '/admin/customers/:id/edit': [PERMISSIONS.EDIT_CUSTOMERS],
  
  // Broker Management
  '/admin/brokers': [PERMISSIONS.VIEW_ORGANIZATIONS],
  '/admin/brokers/new': [PERMISSIONS.CREATE_ORGANIZATIONS],
  '/admin/brokers/:id': [PERMISSIONS.VIEW_ORGANIZATIONS],
  '/admin/brokers/:id/edit': [PERMISSIONS.EDIT_ORGANIZATIONS],
  
  // Organization Management
  '/admin/organizations': [PERMISSIONS.VIEW_ORGANIZATIONS],
  '/admin/organizations/new': [PERMISSIONS.CREATE_ORGANIZATIONS],
  '/admin/organizations/:id': [PERMISSIONS.VIEW_ORGANIZATIONS],
  '/admin/organizations/:id/edit': [PERMISSIONS.EDIT_ORGANIZATIONS],
  
  // User Management
  '/admin/users': [PERMISSIONS.VIEW_USERS],
  '/admin/users/new': [PERMISSIONS.CREATE_USERS],
  '/admin/users/:id': [PERMISSIONS.VIEW_USERS],
  '/admin/users/:id/edit': [PERMISSIONS.EDIT_USERS],
  '/admin/users/:id/companies': [PERMISSIONS.VIEW_USERS, PERMISSIONS.VIEW_COMPANIES],
  '/admin/users/:id/reset-password': [PERMISSIONS.EDIT_USERS],
  
  // Shipment Management
  '/admin/shipments': [PERMISSIONS.VIEW_ALL_SHIPMENTS],
  '/admin/shipment/:id': [PERMISSIONS.VIEW_ALL_SHIPMENTS],
  
  // Billing Management
  '/admin/billing': [PERMISSIONS.VIEW_BILLING, PERMISSIONS.VIEW_ALL_INVOICES],
  '/admin/billing/overview': [PERMISSIONS.VIEW_BILLING, PERMISSIONS.VIEW_ALL_INVOICES],
  '/admin/billing/charges': [PERMISSIONS.VIEW_BILLING, PERMISSIONS.VIEW_ALL_INVOICES],
  '/admin/billing/invoice/new': [PERMISSIONS.CREATE_INVOICES],
  '/admin/billing/invoice/:id': [PERMISSIONS.VIEW_BILLING, PERMISSIONS.EDIT_INVOICES],
  '/admin/billing/ap-processing': [PERMISSIONS.VIEW_BILLING, PERMISSIONS.MANAGE_AP_PROCESSING],
  '/admin/billing/generate': [PERMISSIONS.GENERATE_INVOICES],
  '/admin/billing/business': [PERMISSIONS.VIEW_BILLING, PERMISSIONS.VIEW_ALL_INVOICES],
  '/admin/billing/payments': [PERMISSIONS.VIEW_PAYMENTS, PERMISSIONS.VIEW_BILLING],
  '/admin/billing/commissions': [PERMISSIONS.VIEW_COMMISSIONS, PERMISSIONS.VIEW_BILLING],
  '/admin/billing/payment-terms': [PERMISSIONS.MANAGE_PAYMENT_TERMS],
  
  // System Management
  // '/admin/role-permissions': [PERMISSIONS.VIEW_ADMIN_DASHBOARD], // TEMPORARILY DISABLED FOR TESTING
  '/admin/settings': [PERMISSIONS.MANAGE_SETTINGS],
  '/admin/configuration': [PERMISSIONS.MANAGE_SETTINGS],
  
  // Carrier Management
  '/admin/carrier-keys': [PERMISSIONS.MANAGE_CARRIER_KEYS],
  '/admin/carriers': [PERMISSIONS.VIEW_CARRIERS, PERMISSIONS.MANAGE_CARRIER_KEYS],
  '/admin/carriers/new': [PERMISSIONS.CREATE_CARRIERS],
  '/admin/carriers/:carrierId': [PERMISSIONS.VIEW_CARRIERS],
  '/admin/carriers/:carrierId/edit': [PERMISSIONS.EDIT_CARRIERS],
  
  // Pricing & Markups
  '/admin/markups': [PERMISSIONS.MANAGE_MARKUPS],
  '/admin/edi-mapping': [PERMISSIONS.MANAGE_EDI_MAPPING],
  
  // Address Management
  '/admin/addresses': [PERMISSIONS.VIEW_ADDRESSES, PERMISSIONS.VIEW_ALL_ADDRESSES],
  
  // Other Admin Features
  '/admin/followups': [PERMISSIONS.VIEW_FOLLOWUPS],
  '/admin/profile': [PERMISSIONS.VIEW_PROFILE],
};

// Helper function to check if user can access a route
export const canAccessRoute = (userRole, route) => {
  // BULLETPROOF: SUPERADMIN ALWAYS HAS ACCESS - NO EXCEPTIONS
  if (userRole === 'superadmin') {
    return true;
  }
  
  // FORCE ALLOW role-permissions route for ANY admin user
  if (route === '/admin/role-permissions') {
    return true;
  }
  
  const requiredPermissions = ROUTE_PERMISSIONS[route];
  
  // Public routes
  if (!requiredPermissions) return true;
  
  // Check if user has any of the required permissions
  return hasAnyPermission(userRole, requiredPermissions);
};

// Navigation menu configuration based on permissions
export const getNavigationMenu = (userRole) => {
  const menu = [];
  
  // Dashboard
  if (hasPermission(userRole, PERMISSIONS.VIEW_DASHBOARD)) {
    menu.push({
      label: 'Dashboard',
      path: '/dashboard',
      icon: 'Dashboard',
    });
  }
  
  // Shipments
  if (hasPermission(userRole, PERMISSIONS.VIEW_SHIPMENTS)) {
    menu.push({
      label: 'Shipments',
      path: '/shipments',
      icon: 'LocalShipping',
    });
  }
  
  // Create Shipment
  if (hasPermission(userRole, PERMISSIONS.CREATE_SHIPMENTS)) {
    menu.push({
      label: 'Create Shipment',
      path: '/create-shipment',
      icon: 'Add',
    });
  }
  
  // Customers
  if (hasPermission(userRole, PERMISSIONS.VIEW_CUSTOMERS)) {
    menu.push({
      label: 'Customers',
      path: '/customers',
      icon: 'People',
    });
  }
  
  // Tracking
  if (hasPermission(userRole, PERMISSIONS.VIEW_TRACKING)) {
    menu.push({
      label: 'Tracking',
      path: '/tracking',
      icon: 'LocationOn',
    });
  }
  
  // Reports
  if (hasPermission(userRole, PERMISSIONS.VIEW_REPORTS)) {
    menu.push({
      label: 'Reports',
      path: '/reports',
      icon: 'Assessment',
    });
  }
  
  // Billing
  if (hasPermission(userRole, PERMISSIONS.VIEW_BILLING)) {
    menu.push({
      label: 'Billing',
      path: '/billing',
      icon: 'Receipt',
    });
  }
  
  // Carriers
  if (hasPermission(userRole, PERMISSIONS.VIEW_CARRIERS)) {
    menu.push({
      label: 'Carriers',
      path: '/carriers',
      icon: 'LocalShipping',
    });
  }
  
  // Admin Menu
  if (hasPermission(userRole, PERMISSIONS.VIEW_ADMIN_DASHBOARD)) {
    menu.push({
      label: 'Admin',
      path: '/admin',
      icon: 'AdminPanelSettings',
      submenu: getAdminSubmenu(userRole),
    });
  }
  
  return menu;
};

// Get admin submenu based on permissions
export const getAdminSubmenu = (userRole) => {
  const submenu = [];
  
  if (hasPermission(userRole, PERMISSIONS.VIEW_ADMIN_DASHBOARD)) {
    submenu.push({
      label: 'Dashboard',
      path: '/admin/dashboard',
      icon: 'Dashboard',
    });
  }
  
  if (hasPermission(userRole, PERMISSIONS.VIEW_COMPANIES)) {
    submenu.push({
      label: 'Companies',
      path: '/admin/companies',
      icon: 'Business',
    });
  }
  
  if (hasPermission(userRole, PERMISSIONS.VIEW_USERS)) {
    submenu.push({
      label: 'Users',
      path: '/admin/users',
      icon: 'People',
    });
  }
  
  if (hasPermission(userRole, PERMISSIONS.VIEW_ORGANIZATIONS)) {
    submenu.push({
      label: 'Organizations',
      path: '/admin/organizations',
      icon: 'AccountTree',
    });
  }
  
  if (hasPermission(userRole, PERMISSIONS.VIEW_ALL_SHIPMENTS)) {
    submenu.push({
      label: 'Shipments',
      path: '/admin/shipments',
      icon: 'LocalShipping',
    });
  }
  
  if (hasPermission(userRole, PERMISSIONS.VIEW_ALL_ADDRESSES)) {
    submenu.push({
      label: 'Addresses',
      path: '/admin/addresses',
      icon: 'ContactMail',
    });
  }
  
  if (hasPermission(userRole, PERMISSIONS.VIEW_ALL_INVOICES)) {
    submenu.push({
      label: 'Billing',
      path: '/admin/billing',
      icon: 'Receipt',
    });
  }
  
  if (hasPermission(userRole, PERMISSIONS.MANAGE_CARRIERS)) {
    submenu.push({
      label: 'Carriers',
      path: '/admin/carriers',
      icon: 'LocalShipping',
    });
  }
  
  if (hasPermission(userRole, PERMISSIONS.MANAGE_MARKUPS)) {
    submenu.push({
      label: 'Markups',
      path: '/admin/markups',
      icon: 'AttachMoney',
    });
  }
  
  if (hasPermission(userRole, PERMISSIONS.MANAGE_ROLES)) {
    submenu.push({
      label: 'Permissions',
      path: '/admin/role-permissions',
      icon: 'Security',
    });
  }
  
  if (hasPermission(userRole, PERMISSIONS.MANAGE_SETTINGS)) {
    submenu.push({
      label: 'Settings',
      path: '/admin/settings',
      icon: 'Settings',
    });
  }
  
  return submenu;
};

// Feature flags based on permissions
export const FEATURE_FLAGS = {
  SHOW_QUICKSHIP: PERMISSIONS.USE_QUICKSHIP,
  SHOW_AI_AGENT: PERMISSIONS.USE_AI_AGENT,
  SHOW_ADVANCED_ROUTING: PERMISSIONS.USE_ADVANCED_ROUTING,
  SHOW_EXPORT_BUTTONS: PERMISSIONS.EXPORT_SHIPMENTS,
  SHOW_ADMIN_BUTTON: PERMISSIONS.VIEW_ADMIN_DASHBOARD,
  SHOW_COMPANY_SWITCHER: PERMISSIONS.VIEW_ALL_COMPANIES,
  SHOW_GLOBAL_SEARCH: PERMISSIONS.VIEW_ALL_SHIPMENTS,
  SHOW_BULK_ACTIONS: PERMISSIONS.EDIT_SHIPMENTS,
  SHOW_MANUAL_STATUS_UPDATE: PERMISSIONS.UPDATE_TRACKING,
};

// Helper to check feature availability
export const isFeatureEnabled = (userRole, featureFlag) => {
  const permission = FEATURE_FLAGS[featureFlag];
  return permission ? hasPermission(userRole, permission) : false;
}; 