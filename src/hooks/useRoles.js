import { useState, useEffect, useCallback } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * Custom hook for managing roles
 * Provides dynamic role loading, caching, and role operations
 */
export const useRoles = () => {
    const [roles, setRoles] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const functions = getFunctions();

    // Hardcoded fallback roles for reliability
    const fallbackRoles = {
        superadmin: {
            roleId: 'superadmin',
            displayName: 'Super Administrator',
            description: 'Full system access with no limitations',
            color: '#9c27b0',
            isSystemRole: true
        },
        admin: {
            roleId: 'admin',
            displayName: 'Administrator',
            description: 'Administrative access to manage the system',
            color: '#2196f3',
            isSystemRole: true
        },
        user: {
            roleId: 'user',
            displayName: 'Company Administrator',
            description: 'Company-level access for daily operations',
            color: '#4caf50',
            isSystemRole: true
        },
        accounting: {
            roleId: 'accounting',
            displayName: 'Accounting',
            description: 'Access to billing, invoicing, and financial reports',
            color: '#ff9800',
            isSystemRole: true
        },
        company_staff: {
            roleId: 'company_staff',
            displayName: 'Company Staff',
            description: 'Basic operational access for company staff',
            color: '#00bcd4',
            isSystemRole: true
        },
        manufacturer: {
            roleId: 'manufacturer',
            displayName: 'Manufacturer',
            description: 'Limited access for manufacturing partners',
            color: '#607d8b',
            isSystemRole: false
        }
    };

    // Load roles from database
    const loadRoles = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            
            const getRolesFunction = httpsCallable(functions, 'getRoles');
            const result = await getRolesFunction();
            
            if (result.data?.success && result.data?.roles) {
                // Merge dynamic roles with fallback roles
                const mergedRoles = {
                    ...fallbackRoles,
                    ...result.data.roles
                };
                setRoles(mergedRoles);
            } else {
                // Use fallback roles if API fails
                console.warn('Failed to load dynamic roles, using fallback');
                setRoles(fallbackRoles);
            }
        } catch (error) {
            console.error('Error loading roles:', error);
            setError(error.message);
            // Use fallback roles on error
            setRoles(fallbackRoles);
        } finally {
            setLoading(false);
        }
    }, [functions]);

    // Assign role to user
    const assignRole = useCallback(async (userId, newRole, reason = '') => {
        try {
            const assignUserRoleFunction = httpsCallable(functions, 'assignUserRole');
            const result = await assignUserRoleFunction({
                userId,
                newRole,
                reason
            });
            
            if (result.data?.success) {
                return { success: true, data: result.data };
            } else {
                throw new Error(result.data?.message || 'Failed to assign role');
            }
        } catch (error) {
            console.error('Error assigning role:', error);
            throw error;
        }
    }, [functions]);

    // Get role display name
    const getRoleDisplayName = useCallback((roleId) => {
        if (!roleId || !roles[roleId]) {
            return roleId || 'Unknown Role';
        }
        return roles[roleId].displayName || roleId;
    }, [roles]);

    // Get role color
    const getRoleColor = useCallback((roleId) => {
        if (!roleId || !roles[roleId]) {
            return '#757575'; // Default gray
        }
        return roles[roleId].color || '#757575';
    }, [roles]);

    // Get role description
    const getRoleDescription = useCallback((roleId) => {
        if (!roleId || !roles[roleId]) {
            return '';
        }
        return roles[roleId].description || '';
    }, [roles]);

    // Check if role is a system role
    const isSystemRole = useCallback((roleId) => {
        if (!roleId || !roles[roleId]) {
            return false;
        }
        return roles[roleId].isSystemRole === true;
    }, [roles]);

    // Get roles as array for dropdowns
    const getRolesArray = useCallback(() => {
        return Object.values(roles).sort((a, b) => {
            // Sort system roles first, then by display name
            if (a.isSystemRole && !b.isSystemRole) return -1;
            if (!a.isSystemRole && b.isSystemRole) return 1;
            return a.displayName.localeCompare(b.displayName);
        });
    }, [roles]);

    // Get active roles only
    const getActiveRoles = useCallback(() => {
        return Object.values(roles)
            .filter(role => role.isActive !== false)
            .sort((a, b) => {
                if (a.isSystemRole && !b.isSystemRole) return -1;
                if (!a.isSystemRole && b.isSystemRole) return 1;
                return a.displayName.localeCompare(b.displayName);
            });
    }, [roles]);

    // Refresh roles (useful after creating/updating roles)
    const refreshRoles = useCallback(() => {
        loadRoles();
    }, [loadRoles]);

    // Load roles on mount
    useEffect(() => {
        loadRoles();
    }, [loadRoles]);

    return {
        roles,
        loading,
        error,
        assignRole,
        getRoleDisplayName,
        getRoleColor,
        getRoleDescription,
        isSystemRole,
        getRolesArray,
        getActiveRoles,
        refreshRoles,
        loadRoles
    };
};

export default useRoles;