import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { hasPermission, hasAnyPermission, hasAllPermissions } from '../utils/rolePermissions';

/**
 * PermissionGate component to control access to features based on user permissions
 * 
 * @param {string|string[]} permission - Required permission(s)
 * @param {string} requireAll - If true, requires all permissions. If false, requires any permission
 * @param {React.ReactNode} children - Content to render if permission check passes
 * @param {React.ReactNode} fallback - Content to render if permission check fails
 * @param {boolean} hideIfUnauthorized - If true, renders nothing when unauthorized (default: true)
 */
export const PermissionGate = ({
    permission,
    requireAll = false,
    children,
    fallback = null,
    hideIfUnauthorized = true
}) => {
    const { userRole } = useAuth();

    // Handle single permission or array of permissions
    const permissions = Array.isArray(permission) ? permission : [permission];

    // Check permissions based on requireAll flag
    const hasAccess = requireAll
        ? hasAllPermissions(userRole, permissions)
        : hasAnyPermission(userRole, permissions);

    // If user has access, render children
    if (hasAccess) {
        return <>{children}</>;
    }

    // If user doesn't have access and hideIfUnauthorized is true, render nothing
    if (hideIfUnauthorized && !fallback) {
        return null;
    }

    // Otherwise render fallback content
    return <>{fallback}</>;
};

/**
 * Hook to check permissions programmatically
 */
export const usePermission = () => {
    const { userRole } = useAuth();

    return {
        hasPermission: (permission) => hasPermission(userRole, permission),
        hasAnyPermission: (permissions) => hasAnyPermission(userRole, permissions),
        hasAllPermissions: (permissions) => hasAllPermissions(userRole, permissions),
        userRole
    };
}; 