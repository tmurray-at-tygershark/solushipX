// Dynamic Role Service
// Handles loading roles from Firestore while maintaining backward compatibility

import { collection, getDocs, doc, getDoc, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { ROLES as HARDCODED_ROLES, ROLE_PERMISSIONS as HARDCODED_ROLE_PERMISSIONS, PERMISSIONS } from '../utils/rolePermissions';

class RoleService {
  constructor() {
    this.roles = new Map();
    this.rolePermissions = new Map();
    this.isInitialized = false;
    this.listeners = [];
    this.initPromise = null;
  }

  // Initialize the service by loading roles from Firestore
  async init() {
    if (this.initPromise) return this.initPromise;
    
    this.initPromise = this._loadRolesFromDatabase();
    return this.initPromise;
  }

  // Load roles from Firestore database
  async _loadRolesFromDatabase() {
    try {
      console.log('🔄 Loading roles from Firestore...');
      
      // Load roles
      const rolesSnapshot = await getDocs(
        query(collection(db, 'roles'), orderBy('name'))
      );
      
      // Load role permissions
      const rolePermissionsSnapshot = await getDocs(collection(db, 'rolePermissions'));
      
      // Process roles
      rolesSnapshot.docs.forEach(doc => {
        const roleData = doc.data();
        this.roles.set(roleData.id, {
          id: roleData.id,
          name: roleData.name,
          description: roleData.description,
          color: roleData.color || '#757575',
          isSystem: roleData.isSystem || false,
          isActive: roleData.isActive !== false, // Default to true
          createdAt: roleData.createdAt,
          updatedAt: roleData.updatedAt
        });
      });

      // Process role permissions
      const permissionsByRole = new Map();
      rolePermissionsSnapshot.docs.forEach(doc => {
        const permData = doc.data();
        if (permData.granted) {
          if (!permissionsByRole.has(permData.roleId)) {
            permissionsByRole.set(permData.roleId, []);
          }
          permissionsByRole.get(permData.roleId).push(permData.permissionId);
        }
      });

      // Convert to role permissions format
      permissionsByRole.forEach((permissions, roleId) => {
        const rolePermissions = {};
        permissions.forEach(permission => {
          rolePermissions[permission] = true;
        });
        this.rolePermissions.set(roleId, rolePermissions);
      });

      this.isInitialized = true;
      console.log(`✅ Loaded ${this.roles.size} roles from database`);
      
    } catch (error) {
      console.warn('⚠️ Failed to load roles from database, using hardcoded fallback:', error);
      this._loadHardcodedRoles();
    }
  }

  // Fallback to hardcoded roles if database load fails
  _loadHardcodedRoles() {
    console.log('📋 Using hardcoded roles as fallback');
    
    // Load hardcoded roles
    Object.entries(HARDCODED_ROLES).forEach(([key, roleId]) => {
      this.roles.set(roleId, {
        id: roleId,
        name: this._getRoleDisplayName(roleId),
        description: this._getRoleDescription(roleId),
        color: this._getRoleColor(roleId),
        isSystem: true,
        isActive: true
      });
    });

    // Load hardcoded permissions
    Object.entries(HARDCODED_ROLE_PERMISSIONS).forEach(([roleId, permissions]) => {
      this.rolePermissions.set(roleId, permissions);
    });

    this.isInitialized = true;
  }

  // Get role display name for hardcoded roles
  _getRoleDisplayName(roleId) {
    const displayNames = {
      'superadmin': 'Super Administrator',
      'admin': 'System Administrator', 
      'user': 'Company Administrator',
      'accounting': 'Accounting Staff',
      'company_staff': 'Company Staff',
      'manufacturer': 'Manufacturer Portal'
    };
    return displayNames[roleId] || roleId;
  }

  // Get role description for hardcoded roles
  _getRoleDescription(roleId) {
    const descriptions = {
      'superadmin': 'Full system access with all privileges',
      'admin': 'Administrative access to manage system resources',
      'user': 'Company-level administrative access',
      'accounting': 'Access to billing and financial features', 
      'company_staff': 'Limited access for company staff members',
      'manufacturer': 'Limited access for manufacturing partners'
    };
    return descriptions[roleId] || 'System role';
  }

  // Get role color for hardcoded roles
  _getRoleColor(roleId) {
    const colors = {
      'superadmin': '#ff4444',
      'admin': '#2196f3',
      'user': '#4caf50',
      'accounting': '#ff9800',
      'company_staff': '#9c27b0',
      'manufacturer': '#607d8b'
    };
    return colors[roleId] || '#757575';
  }

  // Get all available roles
  getAllRoles() {
    if (!this.isInitialized) {
      console.warn('RoleService not initialized, using hardcoded roles');
      return Object.values(HARDCODED_ROLES).map(roleId => ({
        id: roleId,
        name: this._getRoleDisplayName(roleId),
        description: this._getRoleDescription(roleId),
        isSystem: true
      }));
    }
    
    return Array.from(this.roles.values()).filter(role => role.isActive);
  }

  // Get role by ID
  getRole(roleId) {
    if (!this.isInitialized) {
      console.warn('RoleService not initialized, checking hardcoded roles');
      if (Object.values(HARDCODED_ROLES).includes(roleId)) {
        return {
          id: roleId,
          name: this._getRoleDisplayName(roleId),
          description: this._getRoleDescription(roleId),
          isSystem: true
        };
      }
      return null;
    }
    
    return this.roles.get(roleId) || null;
  }

  // Get permissions for a role
  getRolePermissions(roleId) {
    if (!this.isInitialized) {
      console.warn('RoleService not initialized, using hardcoded permissions');
      return HARDCODED_ROLE_PERMISSIONS[roleId] || {};
    }
    
    return this.rolePermissions.get(roleId) || {};
  }

  // Check if user has permission (with backward compatibility)
  hasPermission(userRole, permission) {
    if (!userRole || !permission) return false;
    
    const rolePermissions = this.getRolePermissions(userRole);
    
    // Super admin has all permissions
    if (rolePermissions['*'] === true) return true;
    
    // Check specific permission
    return rolePermissions[permission] === true;
  }

  // Check if user has any of the specified permissions
  hasAnyPermission(userRole, permissions) {
    if (!userRole || !permissions || !Array.isArray(permissions)) return false;
    return permissions.some(permission => this.hasPermission(userRole, permission));
  }

  // Check if user has all of the specified permissions
  hasAllPermissions(userRole, permissions) {
    if (!userRole || !permissions || !Array.isArray(permissions)) return false;
    return permissions.every(permission => this.hasPermission(userRole, permission));
  }

  // Get all permissions for a role
  getAllPermissionsForRole(roleId) {
    const rolePermissions = this.getRolePermissions(roleId);
    
    // If super admin, return all permissions
    if (rolePermissions['*'] === true) {
      return Object.values(PERMISSIONS);
    }
    
    // Return only granted permissions
    return Object.entries(rolePermissions)
      .filter(([_, granted]) => granted === true)
      .map(([permission]) => permission);
  }

  // Set up real-time listener for role changes
  subscribeToRoleChanges(callback) {
    if (typeof callback !== 'function') return;

    const unsubscribeRoles = onSnapshot(
      query(collection(db, 'roles'), orderBy('name')),
      (snapshot) => {
        console.log('🔄 Roles updated, reloading...');
        this._loadRolesFromDatabase().then(() => {
          callback();
        });
      },
      (error) => {
        console.error('Error listening to role changes:', error);
      }
    );

    const unsubscribePermissions = onSnapshot(
      collection(db, 'rolePermissions'),
      (snapshot) => {
        console.log('🔄 Role permissions updated, reloading...');
        this._loadRolesFromDatabase().then(() => {
          callback();
        });
      },
      (error) => {
        console.error('Error listening to role permission changes:', error);
      }
    );

    this.listeners.push(unsubscribeRoles, unsubscribePermissions);
    
    return () => {
      unsubscribeRoles();
      unsubscribePermissions();
    };
  }

  // Cleanup listeners
  cleanup() {
    this.listeners.forEach(unsubscribe => unsubscribe());
    this.listeners = [];
  }

  // Check if role exists
  roleExists(roleId) {
    if (!this.isInitialized) {
      return Object.values(HARDCODED_ROLES).includes(roleId);
    }
    return this.roles.has(roleId);
  }

  // Get role display information
  getRoleDisplayInfo(roleId) {
    const role = this.getRole(roleId);
    if (!role) return { name: roleId, color: '#757575', isSystem: false };
    
    return {
      name: role.name,
      color: role.color,
      isSystem: role.isSystem,
      description: role.description
    };
  }
}

// Create singleton instance
const roleService = new RoleService();

export default roleService;