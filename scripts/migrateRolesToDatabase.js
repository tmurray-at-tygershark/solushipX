const admin = require('firebase-admin');
const serviceAccount = require('../functions/service-account.json');

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Define roles to migrate (based on current hardcoded roles)
const ROLES_TO_MIGRATE = {
  superadmin: {
    roleId: 'superadmin',
    displayName: 'Super Admin',
    description: 'Full system access with no limitations',
    color: '#9c27b0',
    permissions: { '*': true }, // Special flag indicating all permissions
    isActive: true,
    isSystemRole: true, // Mark as system role to prevent deletion
    createdAt: new Date(),
    createdBy: 'system',
    updatedAt: new Date(),
    updatedBy: 'system'
  },
  admin: {
    roleId: 'admin',
    displayName: 'Admin',
    description: 'Administrative access to manage the system',
    color: '#2196f3',
    permissions: {
      // All permissions except super admin exclusive ones
      view_admin_dashboard: true,
      view_users: true,
      create_users: true,
      edit_users: true,
      delete_users: true,
      view_companies: true,
      create_companies: true,
      edit_companies: true,
      view_organizations: true,
      create_organizations: true,
      edit_organizations: true,
      view_shipments: true,
      create_shipments: true,
      use_quickship: true,
      edit_shipments: true,
      delete_shipments: true,
      view_customers: true,
      create_customers: true,
      edit_customers: true,
      delete_customers: true,
      view_billing: true,
      create_invoices: true,
      edit_invoices: true,
      view_payments: true,
      manage_payment_terms: true,
      generate_invoices: true,
      manage_ap_processing: true,
      view_carriers: true,
      create_carriers: true,
      edit_carriers: true,
      delete_carriers: true,
      manage_carrier_keys: true,
      manage_edi_mapping: true,
      manage_carriers: true,
      manage_addresses: true,
      manage_brokers: true,
      view_reports: true,
      create_reports: true,
      view_analytics: true,
      view_tracking: true,
      view_profile: true,
      edit_profile: true,
      view_notifications: true,
      edit_notifications: true,
      view_settings: true,
      edit_settings: true,
      view_markups: true,
      edit_markups: true,
      view_followups: true,
      use_quickship: true,
      use_ai_features: true,
      use_advanced_routing: true,
      
      // Rate and Pricing Visibility - FULL ACCESS for admins
      view_rate_pricing: true,
      view_rate_breakdown: true,
      
      // Shipment Information Fields - FULL ACCESS for admins
      view_bill_type: true,
      view_eta_fields: true,
      
      // Package Information Fields - FULL ACCESS for admins
      view_declared_value: true,
      view_freight_class: true
    },
    isActive: true,
    isSystemRole: true,
    createdAt: new Date(),
    createdBy: 'system',
    updatedAt: new Date(),
    updatedBy: 'system'
  },
  user: {
    roleId: 'user',
    displayName: 'Company Admin',
    description: 'Company-level access for daily operations',
    color: '#4caf50',
    permissions: {
      view_dashboard: true,
      view_shipments: true,
      create_shipments: true,
      use_quickship: true,
      edit_shipments: true,
      view_customers: true,
      create_customers: true,
      edit_customers: true,
      view_billing: true,
      view_carriers: true,
      manage_addresses: true,
      view_reports: true,
      create_reports: true,
      view_tracking: true,
      view_profile: true,
      edit_profile: true,
      view_notifications: true,
      edit_notifications: true,
      use_quickship: true,
      
      // Rate and Pricing Visibility - FULL ACCESS for company admins
      view_rate_pricing: true,
      view_rate_breakdown: true,
      
      // Shipment Information Fields - FULL ACCESS for company admins
      view_bill_type: true,
      view_eta_fields: true,
      
      // Package Information Fields - FULL ACCESS for company admins
      view_declared_value: true,
      view_freight_class: true
    },
    isActive: true,
    isSystemRole: true,
    createdAt: new Date(),
    createdBy: 'system',
    updatedAt: new Date(),
    updatedBy: 'system'
  },
  accounting: {
    roleId: 'accounting',
    displayName: 'Accounting',
    description: 'Access to billing, invoicing, and financial reports',
    color: '#ff9800',
    permissions: {
      view_dashboard: true,
      view_shipments: true,
      view_customers: true,
      view_billing: true,
      create_invoices: true,
      edit_invoices: true,
      view_payments: true,
      manage_payment_terms: true,
      generate_invoices: true,
      manage_ap_processing: true,
      view_carriers: true,
      manage_addresses: true,
      view_reports: true,
      create_reports: true,
      view_profile: true,
      edit_profile: true,
      view_notifications: true,
      edit_notifications: true,
      
      // Rate and Pricing Visibility - FULL ACCESS for accounting (they need pricing info)
      view_rate_pricing: true,
      view_rate_breakdown: true,
      
      // Shipment Information Fields - FULL ACCESS for accounting
      view_bill_type: true,
      view_eta_fields: true,
      
      // Package Information Fields - FULL ACCESS for accounting
      view_declared_value: true,
      view_freight_class: true
    },
    isActive: true,
    isSystemRole: true,
    createdAt: new Date(),
    createdBy: 'system',
    updatedAt: new Date(),
    updatedBy: 'system'
  },
  company_staff: {
    roleId: 'company_staff',
    displayName: 'Company Staff',
    description: 'Basic operational access for company staff',
    color: '#00bcd4',
    permissions: {
      view_dashboard: true,
      view_shipments: true,
      create_shipments: true,
      view_customers: true,
      manage_addresses: true,
      view_tracking: true,
      view_profile: true,
      edit_profile: true,
      view_notifications: true,
      use_quickship: true,
      
      // Rate and Pricing Visibility - FULL ACCESS for company staff (operational need)
      view_rate_pricing: true,
      view_rate_breakdown: true,
      
      // Shipment Information Fields - FULL ACCESS for company staff
      view_bill_type: true,
      view_eta_fields: true,
      
      // Package Information Fields - FULL ACCESS for company staff
      view_declared_value: true,
      view_freight_class: true
    },
    isActive: true,
    isSystemRole: true,
    createdAt: new Date(),
    createdBy: 'system',
    updatedAt: new Date(),
    updatedBy: 'system'
  },
  manufacturer: {
    roleId: 'manufacturer',
    displayName: 'Manufacturer',
    description: 'Limited access for manufacturing partners',
    color: '#607d8b',
    permissions: {
      view_dashboard: true,
      view_shipments: true,
      create_shipments: true,
      use_quickship: false, // Manufacturers cannot use QuickShip
      view_tracking: true,
      view_profile: true,
      edit_profile: true,
      view_notifications: true,
      manage_addresses: true,
      view_addresses: true,
      create_addresses: true,
      edit_addresses: true,
      
      // Rate and Pricing Visibility - RESTRICTED: No pricing visibility
      view_rate_pricing: false,
      view_rate_breakdown: false,
      
      // Shipment Information Fields - RESTRICTED: Limited field access
      view_bill_type: false,
      view_eta_fields: false,
      
      // Package Information Fields - RESTRICTED: Limited package details
      view_declared_value: false,
      view_freight_class: false
    },
    isActive: true,
    isSystemRole: false, // Custom role that can be modified
    createdAt: new Date(),
    createdBy: 'system',
    updatedAt: new Date(),
    updatedBy: 'system'
  }
};

async function migrateRoles() {
  try {
    console.log('🔄 Starting role migration to database...');
    
    const batch = db.batch();
    let migrationCount = 0;
    
    for (const [roleId, roleData] of Object.entries(ROLES_TO_MIGRATE)) {
      // Check if role already exists
      const roleDoc = await db.collection('roles').doc(roleId).get();
      
      if (!roleDoc.exists) {
        console.log(`➕ Adding role: ${roleData.displayName} (${roleId})`);
        const roleRef = db.collection('roles').doc(roleId);
        batch.set(roleRef, roleData);
        migrationCount++;
      } else {
        // Update existing role with new permissions
        console.log(`🔄 Updating existing role: ${roleData.displayName} (${roleId})`);
        const roleRef = db.collection('roles').doc(roleId);
        batch.update(roleRef, {
          permissions: roleData.permissions,
          updatedAt: new Date(),
          updatedBy: 'migration-script'
        });
        migrationCount++;
      }
    }
    
    if (migrationCount > 0) {
      await batch.commit();
      console.log(`✅ Successfully migrated ${migrationCount} roles to database`);
    } else {
      console.log('✅ All roles already exist in database');
    }
    
    console.log('\n📋 Migration Summary:');
    console.log(`- Total roles processed: ${Object.keys(ROLES_TO_MIGRATE).length}`);
    console.log(`- New roles added: ${migrationCount}`);
    console.log(`- Existing roles skipped: ${Object.keys(ROLES_TO_MIGRATE).length - migrationCount}`);
    
    console.log('\n🎉 Role migration completed successfully!');
    console.log('🔗 You can now view and manage roles at: https://solushipx.web.app/admin/role-permissions');
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error during role migration:', error);
    process.exit(1);
  }
}

// Run the migration
migrateRoles();