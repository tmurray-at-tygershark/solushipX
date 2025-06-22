# Role Permissions CRUD System - Implementation Guide

## Overview

The Role Permissions CRUD system provides comprehensive management of roles and permissions in SolushipX. This system allows Super Admins to create, read, update, and delete roles and permissions, as well as manage user role assignments.

## Architecture

### Database Schema

#### Collections

1. **roles**
   ```javascript
   {
     id: string,              // Role identifier (e.g., 'admin', 'user', 'custom_role')
     name: string,            // Display name (e.g., 'Admin', 'Company Admin')
     description: string,     // Role description
     color: string,           // HEX color for UI (e.g., '#2196f3')
     isSystem: boolean,       // Whether it's a system role (cannot be deleted)
     createdAt: timestamp,
     updatedAt: timestamp,
     createdBy: string        // User ID who created the role
   }
   ```

2. **permissions**
   ```javascript
   {
     id: string,              // Permission identifier (e.g., 'view_users')
     key: string,             // Permission key (e.g., 'VIEW_USERS')
     name: string,            // Display name (e.g., 'view users')
     category: string,        // Category for grouping (e.g., 'User Management')
     description: string,     // Permission description
     isSystem: boolean,       // Whether it's a system permission
     createdAt: timestamp,
     updatedAt: timestamp
   }
   ```

3. **rolePermissions**
   ```javascript
   {
     roleId: string,          // Role ID
     permissionId: string,    // Permission ID
     granted: boolean,        // Whether permission is granted
     isOverride: boolean,     // For system roles, indicates override
     updatedAt: timestamp,
     updatedBy: string        // User ID who made the change
   }
   ```

### Cloud Functions

Located in `functions/src/admin-role-management.js`:

1. **adminCreateRole** - Creates a new custom role
2. **adminUpdateRole** - Updates an existing role
3. **adminDeleteRole** - Deletes a custom role
4. **adminUpdateRolePermissions** - Updates permissions for a role
5. **adminCreatePermission** - Creates a new permission
6. **adminBulkAssignRole** - Assigns multiple users to a role
7. **adminGetRolePermissions** - Retrieves all permissions for a role

### Frontend Component

`src/components/Admin/Roles/RolePermissionsView.jsx` provides:

- Role summary cards with user counts
- Permission matrix with category grouping
- User role assignment interface
- CRUD dialogs for roles and permissions

## Features

### 1. Role Management

#### Create Role
- Only Super Admins can create roles
- Custom roles are created with:
  - Unique name (converted to lowercase with underscores)
  - Description
  - Color for UI theming
  - Initial permissions (optional)

#### Update Role
- Edit role name, description, and color
- Super Admin role cannot be modified
- System roles have limited modification options

#### Delete Role
- Only custom roles can be deleted
- System roles (superadmin, admin, user) are protected
- Cannot delete roles with assigned users

### 2. Permission Management

#### Permission Categories
- Dashboard & Access
- User Management
- Company Management
- Organization Management
- Shipment Management
- Customer Management
- Billing & Invoicing
- Carrier Management
- Reports & Analytics
- System Settings
- Advanced Features

#### Permission Toggle
- Click permissions in the matrix to toggle
- Super Admin permissions cannot be modified (always has all)
- System role permissions can be overridden (stored in database)
- Custom role permissions are fully configurable

### 3. User Assignment

#### Bulk Assignment
- Select multiple users
- Assign them to a role
- Cannot bulk assign Super Admin role
- Updates are batched for performance

## Security

### Authentication
- All functions require authentication
- Role management requires Super Admin role
- User assignment requires Admin or Super Admin role

### Validation
- Role names must be unique
- Permission keys must be unique
- Cannot delete system roles
- Cannot modify Super Admin permissions

## Usage Examples

### Creating a Custom Role

```javascript
// Frontend call
const createRole = httpsCallable(functions, 'adminCreateRole');
const result = await createRole({
  name: 'Regional Manager',
  description: 'Manages specific regions',
  color: '#ff9800',
  permissions: {
    'view_shipments': true,
    'create_shipments': true,
    'view_customers': true
  }
});
```

### Updating Role Permissions

```javascript
// Toggle a permission
const updateRolePermissions = httpsCallable(functions, 'adminUpdateRolePermissions');
await updateRolePermissions({
  roleId: 'regional_manager',
  permissions: {
    'delete_shipments': true,  // Grant permission
    'view_billing': false      // Revoke permission
  }
});
```

### Assigning Users to Role

```javascript
// Bulk assign users
const bulkAssignRole = httpsCallable(functions, 'adminBulkAssignRole');
await bulkAssignRole({
  userIds: ['user1', 'user2', 'user3'],
  roleId: 'regional_manager'
});
```

## System Roles

### Super Admin (superadmin)
- Has all permissions (wildcard: *)
- Cannot be modified or deleted
- Can manage all other roles

### Admin (admin)
- Has most permissions except system-critical ones
- Can be modified (permissions can be overridden)
- Cannot be deleted

### Company Admin (user)
- Limited to company-level operations
- Can be modified (permissions can be overridden)
- Cannot be deleted

## Best Practices

1. **Role Naming**
   - Use descriptive names
   - Avoid spaces (will be converted to underscores)
   - Keep names concise but clear

2. **Permission Assignment**
   - Follow principle of least privilege
   - Group related permissions
   - Document custom permissions

3. **User Management**
   - Regularly audit role assignments
   - Remove users from roles when no longer needed
   - Use bulk assignment for efficiency

## Deployment

1. Deploy cloud functions:
   ```bash
   firebase deploy --only functions:adminCreateRole,functions:adminUpdateRole,functions:adminDeleteRole,functions:adminUpdateRolePermissions,functions:adminCreatePermission,functions:adminBulkAssignRole,functions:adminGetRolePermissions
   ```

2. Deploy frontend:
   ```bash
   npm run deploy:hosting
   ```

## Troubleshooting

### Common Issues

1. **"Permission denied" errors**
   - Ensure user has Super Admin role
   - Check authentication state

2. **"Role not found" errors**
   - Role may have been deleted
   - Check role ID spelling

3. **Permission changes not reflecting**
   - Refresh the page
   - Check browser console for errors
   - Verify cloud function deployment

### Debugging

Enable debug logging in browser console:
```javascript
localStorage.setItem('debug', 'roles:*');
```

Check cloud function logs:
```bash
firebase functions:log --only adminUpdateRolePermissions
```

## Future Enhancements

1. **Permission Templates**
   - Pre-defined permission sets
   - Quick role creation from templates

2. **Role Hierarchy**
   - Inherited permissions
   - Role dependencies

3. **Audit Trail**
   - Complete history of changes
   - Who changed what and when

4. **API Access**
   - REST API for role management
   - Programmatic role assignment

## Migration from Hardcoded Roles

The system automatically migrates from hardcoded roles on first load:
1. Checks if roles/permissions exist in database
2. If not, creates them from `rolePermissions.js`
3. Sets up real-time listeners for updates

This ensures backward compatibility while enabling dynamic management. 