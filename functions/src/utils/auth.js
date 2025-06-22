const functions = require('firebase-functions');

/**
 * Validates that the user is authenticated
 * @param {Object} context - Firebase Functions context object
 * @throws {HttpsError} If user is not authenticated
 */
exports.validateAuth = (context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User must be authenticated to perform this action'
        );
    }
};

/**
 * Validates that the user has one of the required roles
 * @param {Object} context - Firebase Functions context object
 * @param {Array<string>} requiredRoles - Array of allowed roles
 * @throws {HttpsError} If user doesn't have required role
 */
exports.validateRole = (context, requiredRoles) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User must be authenticated to perform this action'
        );
    }

    const userRole = context.auth.token.role || 'user';
    
    if (!requiredRoles.includes(userRole)) {
        throw new functions.https.HttpsError(
            'permission-denied',
            `This action requires one of the following roles: ${requiredRoles.join(', ')}`
        );
    }
};

/**
 * Validates that the user belongs to a specific company
 * @param {Object} context - Firebase Functions context object
 * @param {string} companyId - Company ID to check
 * @throws {HttpsError} If user doesn't belong to the company
 */
exports.validateCompany = (context, companyId) => {
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User must be authenticated to perform this action'
        );
    }

    const userCompanyId = context.auth.token.companyId;
    const userRole = context.auth.token.role || 'user';
    
    // Super admins and admins can access any company
    if (userRole === 'superadmin' || userRole === 'admin') {
        return;
    }
    
    if (userCompanyId !== companyId) {
        throw new functions.https.HttpsError(
            'permission-denied',
            'You do not have permission to access this company\'s data'
        );
    }
};

/**
 * Gets user information from auth context
 * @param {Object} context - Firebase Functions context object
 * @returns {Object} User information
 */
exports.getUserInfo = (context) => {
    if (!context.auth) {
        return null;
    }

    return {
        uid: context.auth.uid,
        email: context.auth.token.email,
        role: context.auth.token.role || 'user',
        companyId: context.auth.token.companyId,
        name: context.auth.token.name
    };
}; 