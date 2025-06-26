/**
 * Sales Commission Module - Cloud Functions
 * Enterprise-grade sales commission management system
 */

const functions = require('firebase-functions');
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require('firebase-admin');
const db = admin.firestore();
const { sendNotificationEmail } = require('./email/sendgridService');

// Helper function to check admin permissions
const checkAdminPermissions = async (uid) => {
    const userDoc = await db.collection('users').doc(uid).get();
    if (!userDoc.exists) {
        throw new HttpsError('unauthenticated', 'User not found');
    }
    const userData = userDoc.data();
    if (!['admin', 'superadmin'].includes(userData.role)) {
        throw new HttpsError('permission-denied', 'Insufficient permissions');
    }
    return userData;
};

// ===============================
// SALES PERSON CRUD OPERATIONS
// ===============================

/**
 * Create a new sales person
 */
exports.createSalesPerson = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Must be authenticated');
        }

        await checkAdminPermissions(request.auth.uid);

        const {
            firstName,
            lastName,
            email,
            phone,
            assignedCompanies = [],
            assignedTeams = [],
            active = true,
            commissionSettings = {
                ltlGrossPercent: 0,
                ltlNetPercent: 0,
                courierGrossPercent: 0,
                courierNetPercent: 0,
                servicesGrossPercent: 0,
                servicesNetPercent: 0
            },
            // Additional contact fields
            title,
            employeeId,
            hireDate,
            mobile,
            workPhone,
            fax,
            address,
            emergencyContact,
            department,
            territory,
            manager,
            notes
        } = request.data;

        // Validate required fields
        if (!firstName || !lastName || !email) {
            throw new HttpsError('invalid-argument', 'First name, last name, and email are required');
        }

        // Check for duplicate email
        const existingSalesPersonQuery = await db.collection('salesPersons')
            .where('email', '==', email.toLowerCase())
            .limit(1)
            .get();

        if (!existingSalesPersonQuery.empty) {
            throw new HttpsError('already-exists', 'A sales person with this email already exists');
        }

        // Create sales person document with comprehensive contact information
        const salesPersonData = {
            // Personal Information
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            title: title ? title.trim() : '',
            employeeId: employeeId ? employeeId.trim() : '',
            hireDate: hireDate || '',
            
            // Contact Information
            email: email.toLowerCase().trim(),
            phone: phone ? phone.trim() : '',
            mobile: mobile ? mobile.trim() : '',
            workPhone: workPhone ? workPhone.trim() : '',
            fax: fax ? fax.trim() : '',
            
            // Address Information
            address: {
                street: address?.street?.trim() || '',
                addressLine2: address?.addressLine2?.trim() || '',
                city: address?.city?.trim() || '',
                state: address?.state?.trim() || '',
                postalCode: address?.postalCode?.trim() || '',
                country: address?.country || 'US'
            },
            
            // Emergency Contact
            emergencyContact: {
                name: emergencyContact?.name?.trim() || '',
                relationship: emergencyContact?.relationship?.trim() || '',
                phone: emergencyContact?.phone?.trim() || '',
                email: emergencyContact?.email?.trim() || ''
            },
            
            // Professional Information
            department: department ? department.trim() : '',
            territory: territory ? territory.trim() : '',
            manager: manager ? manager.trim() : '',
            notes: notes ? notes.trim() : '',
            
            // System Information
            assignedCompanies: Array.isArray(assignedCompanies) ? assignedCompanies : [],
            assignedTeams: Array.isArray(assignedTeams) ? assignedTeams : [],
            active,
            commissionSettings,
            totalCommissionPaid: 0,
            totalCommissionOutstanding: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: request.auth.uid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const salesPersonRef = await db.collection('salesPersons').add(salesPersonData);

        // Update team memberships if teams are assigned
        if (assignedTeams.length > 0) {
            const batch = db.batch();
            for (const teamId of assignedTeams) {
                const membershipRef = db.collection('salesTeamMemberships').doc();
                batch.set(membershipRef, {
                    teamId,
                    salesPersonId: salesPersonRef.id,
                    joinedAt: admin.firestore.FieldValue.serverTimestamp(),
                    active: true
                });
            }
            await batch.commit();
        }

        return {
            success: true,
            salesPersonId: salesPersonRef.id,
            message: `Sales person ${firstName} ${lastName} created successfully`
        };

    } catch (error) {
        console.error('Error creating sales person:', error);
        throw error;
    }
});

/**
 * Update sales person
 */
exports.updateSalesPerson = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Must be authenticated');
        }

        await checkAdminPermissions(request.auth.uid);

        const { salesPersonId, updateData } = request.data;

        if (!salesPersonId) {
            throw new HttpsError('invalid-argument', 'Sales person ID is required');
        }

        // Get existing sales person
        const salesPersonRef = db.collection('salesPersons').doc(salesPersonId);
        const salesPersonDoc = await salesPersonRef.get();

        if (!salesPersonDoc.exists) {
            throw new HttpsError('not-found', 'Sales person not found');
        }

        const currentData = salesPersonDoc.data();

        // Check for email uniqueness if email is being updated
        if (updateData.email && updateData.email.toLowerCase() !== currentData.email) {
            const existingSalesPersonQuery = await db.collection('salesPersons')
                .where('email', '==', updateData.email.toLowerCase())
                .limit(1)
                .get();

            if (!existingSalesPersonQuery.empty) {
                throw new HttpsError('already-exists', 'A sales person with this email already exists');
            }
        }

        // Prepare update data
        const updateFields = {
            ...updateData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: request.auth.uid
        };

        // Handle email normalization
        if (updateData.email) {
            updateFields.email = updateData.email.toLowerCase().trim();
        }

        // Handle team membership changes
        if (updateData.assignedTeams) {
            const currentTeams = currentData.assignedTeams || [];
            const newTeams = updateData.assignedTeams;

            // Find teams to add and remove
            const teamsToAdd = newTeams.filter(teamId => !currentTeams.includes(teamId));
            const teamsToRemove = currentTeams.filter(teamId => !newTeams.includes(teamId));

            const batch = db.batch();

            // Add new team memberships
            for (const teamId of teamsToAdd) {
                const membershipRef = db.collection('salesTeamMemberships').doc();
                batch.set(membershipRef, {
                    teamId,
                    salesPersonId,
                    joinedAt: admin.firestore.FieldValue.serverTimestamp(),
                    active: true
                });
            }

            // Remove old team memberships
            for (const teamId of teamsToRemove) {
                const membershipQuery = await db.collection('salesTeamMemberships')
                    .where('teamId', '==', teamId)
                    .where('salesPersonId', '==', salesPersonId)
                    .get();

                membershipQuery.docs.forEach(doc => {
                    batch.delete(doc.ref);
                });
            }

            // Update sales person
            batch.update(salesPersonRef, updateFields);

            await batch.commit();
        } else {
            await salesPersonRef.update(updateFields);
        }

        return {
            success: true,
            message: 'Sales person updated successfully'
        };

    } catch (error) {
        console.error('Error updating sales person:', error);
        throw error;
    }
});

/**
 * Get all sales persons with filters
 */
exports.getSalesPersons = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Must be authenticated');
        }

        await checkAdminPermissions(request.auth.uid);

        const { filters = {}, limit = 100 } = request.data || {};

        let query = db.collection('salesPersons');

        // Apply filters
        if (filters.active !== undefined) {
            query = query.where('active', '==', filters.active);
        }

        // Check if collection exists and has documents before ordering
        const countSnapshot = await query.limit(1).get();
        
        if (countSnapshot.empty) {
            // Return empty array if no documents exist
            return {
                success: true,
                data: {
                    salesPersons: []
                }
            };
        }

        // Add ordering only if documents exist
        query = query.orderBy('lastName').limit(limit);
        const snapshot = await query.get();

        const salesPersons = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                // Personal Information
                firstName: data.firstName || '',
                lastName: data.lastName || '',
                title: data.title || '',
                employeeId: data.employeeId || '',
                hireDate: data.hireDate || '',
                
                // Contact Information
                email: data.email || '',
                phone: data.phone || '',
                mobile: data.mobile || '',
                workPhone: data.workPhone || '',
                fax: data.fax || '',
                
                // Address Information
                address: {
                    street: data.address?.street || '',
                    addressLine2: data.address?.addressLine2 || '',
                    city: data.address?.city || '',
                    state: data.address?.state || '',
                    postalCode: data.address?.postalCode || '',
                    country: data.address?.country || 'US'
                },
                
                // Emergency Contact
                emergencyContact: {
                    name: data.emergencyContact?.name || '',
                    relationship: data.emergencyContact?.relationship || '',
                    phone: data.emergencyContact?.phone || '',
                    email: data.emergencyContact?.email || ''
                },
                
                // Professional Information
                department: data.department || '',
                territory: data.territory || '',
                manager: data.manager || '',
                notes: data.notes || '',
                
                // System Information
                active: data.active !== undefined ? data.active : true,
                assignedCompanies: data.assignedCompanies || [],
                assignedTeams: data.assignedTeams || [],
                commissionSettings: data.commissionSettings || {},
                totalCommissionPaid: data.totalCommissionPaid || 0,
                totalCommissionOutstanding: data.totalCommissionOutstanding || 0,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt
            };
        });

        return {
            success: true,
            data: {
                salesPersons
            }
        };

    } catch (error) {
        console.error('Error getting sales persons:', error);
        
        // Return empty array instead of throwing error if it's just an empty collection
        if (error.code === 'failed-precondition' || error.message.includes('requires an index')) {
            return {
                success: true,
                data: {
                    salesPersons: []
                }
            };
        }
        
        throw new HttpsError('internal', 'Failed to fetch sales persons: ' + error.message);
    }
});

/**
 * Delete sales person
 */
exports.deleteSalesPerson = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Must be authenticated');
        }

        await checkAdminPermissions(request.auth.uid);

        const { salesPersonId } = request.data;

        if (!salesPersonId) {
            throw new HttpsError('invalid-argument', 'Sales person ID is required');
        }

        const batch = db.batch();

        // Delete sales person
        const salesPersonRef = db.collection('salesPersons').doc(salesPersonId);
        batch.delete(salesPersonRef);

        // Delete team memberships
        const membershipsQuery = await db.collection('salesTeamMemberships')
            .where('salesPersonId', '==', salesPersonId)
            .get();

        membershipsQuery.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        return {
            success: true,
            message: 'Sales person deleted successfully'
        };

    } catch (error) {
        console.error('Error deleting sales person:', error);
        throw error;
    }
});

// ===============================
// SALES TEAM CRUD OPERATIONS
// ===============================

/**
 * Create a new sales team
 */
exports.createSalesTeam = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Must be authenticated');
        }

        await checkAdminPermissions(request.auth.uid);

        const {
            teamName,
            assignedCompanies = [],
            teamMembers = []
        } = request.data;

        if (!teamName) {
            throw new HttpsError('invalid-argument', 'Team name is required');
        }

        // Check for duplicate team name
        const existingTeamQuery = await db.collection('salesTeams')
            .where('teamName', '==', teamName.trim())
            .limit(1)
            .get();

        if (!existingTeamQuery.empty) {
            throw new HttpsError('already-exists', 'A team with this name already exists');
        }

        // Create sales team document
        const salesTeamData = {
            teamName: teamName.trim(),
            assignedCompanies: Array.isArray(assignedCompanies) ? assignedCompanies : [],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: request.auth.uid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        const salesTeamRef = await db.collection('salesTeams').add(salesTeamData);

        // Add team members
        if (teamMembers.length > 0) {
            const batch = db.batch();
            for (const salesPersonId of teamMembers) {
                const membershipRef = db.collection('salesTeamMemberships').doc();
                batch.set(membershipRef, {
                    teamId: salesTeamRef.id,
                    salesPersonId,
                    joinedAt: admin.firestore.FieldValue.serverTimestamp(),
                    active: true
                });
            }
            await batch.commit();
        }

        return {
            success: true,
            salesTeamId: salesTeamRef.id,
            message: `Sales team "${teamName}" created successfully`
        };

    } catch (error) {
        console.error('Error creating sales team:', error);
        throw error;
    }
});

/**
 * Update sales team
 */
exports.updateSalesTeam = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Must be authenticated');
        }

        await checkAdminPermissions(request.auth.uid);

        const { salesTeamId, updateData } = request.data;

        if (!salesTeamId) {
            throw new HttpsError('invalid-argument', 'Sales team ID is required');
        }

        const salesTeamRef = db.collection('salesTeams').doc(salesTeamId);
        const salesTeamDoc = await salesTeamRef.get();

        if (!salesTeamDoc.exists) {
            throw new HttpsError('not-found', 'Sales team not found');
        }

        // Check for name uniqueness if name is being updated
        if (updateData.teamName) {
            const existingTeamQuery = await db.collection('salesTeams')
                .where('teamName', '==', updateData.teamName.trim())
                .limit(1)
                .get();

            if (!existingTeamQuery.empty && existingTeamQuery.docs[0].id !== salesTeamId) {
                throw new HttpsError('already-exists', 'A team with this name already exists');
            }
        }

        const updateFields = {
            ...updateData,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: request.auth.uid
        };

        await salesTeamRef.update(updateFields);

        return {
            success: true,
            message: 'Sales team updated successfully'
        };

    } catch (error) {
        console.error('Error updating sales team:', error);
        throw error;
    }
});

/**
 * Get all sales teams
 */
exports.getSalesTeams = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Must be authenticated');
        }

        await checkAdminPermissions(request.auth.uid);

        const { limit = 100 } = request.data || {};

        // Check if collection exists first
        const countSnapshot = await db.collection('salesTeams').limit(1).get();
        
        if (countSnapshot.empty) {
            // Return empty array if no documents exist
            return {
                success: true,
                data: {
                    salesTeams: []
                }
            };
        }

        const snapshot = await db.collection('salesTeams')
            .limit(limit)
            .orderBy('teamName')
            .get();

        const salesTeams = [];

        for (const doc of snapshot.docs) {
            const data = doc.data();
            const teamData = {
                id: doc.id,
                teamName: data.teamName || '',
                assignedCompanies: data.assignedCompanies || [],
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
                ...data
            };

            // Get team member count
            try {
                const membershipQuery = await db.collection('salesTeamMemberships')
                    .where('teamId', '==', doc.id)
                    .where('active', '==', true)
                    .get();

                teamData.memberCount = membershipQuery.size;
                teamData.teamMembers = membershipQuery.docs.map(memberDoc => memberDoc.data().salesPersonId);
            } catch (memberError) {
                console.log('Error getting team memberships:', memberError);
                teamData.memberCount = 0;
                teamData.teamMembers = [];
            }

            salesTeams.push(teamData);
        }

        return {
            success: true,
            data: {
                salesTeams
            }
        };

    } catch (error) {
        console.error('Error getting sales teams:', error);
        
        // Return empty array instead of throwing error if it's just an empty collection
        if (error.code === 'failed-precondition' || error.message.includes('requires an index')) {
            return {
                success: true,
                data: {
                    salesTeams: []
                }
            };
        }
        
        throw new HttpsError('internal', 'Failed to fetch sales teams: ' + error.message);
    }
});

/**
 * Delete sales team
 */
exports.deleteSalesTeam = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Must be authenticated');
        }

        await checkAdminPermissions(request.auth.uid);

        const { salesTeamId } = request.data;

        if (!salesTeamId) {
            throw new HttpsError('invalid-argument', 'Sales team ID is required');
        }

        const batch = db.batch();

        // Delete sales team
        const salesTeamRef = db.collection('salesTeams').doc(salesTeamId);
        batch.delete(salesTeamRef);

        // Delete team memberships
        const membershipsQuery = await db.collection('salesTeamMemberships')
            .where('teamId', '==', salesTeamId)
            .get();

        membershipsQuery.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();

        return {
            success: true,
            message: 'Sales team deleted successfully'
        };

    } catch (error) {
        console.error('Error deleting sales team:', error);
        throw error;
    }
});

// ===============================
// COMMISSION CALCULATIONS
// ===============================

/**
 * Calculate commissions for given criteria
 */
exports.calculateCommissions = onCall({
    cors: true,
    timeoutSeconds: 120,
}, async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Must be authenticated');
        }

        await checkAdminPermissions(request.auth.uid);

        const {
            startDate,
            endDate,
            companyIds = [],
            salesPersonIds = [],
            salesTeamIds = [],
            includeUnpaidInvoices = false // New parameter to optionally include unpaid invoices
        } = request.data;

        if (!startDate || !endDate) {
            throw new HttpsError('invalid-argument', 'Start date and end date are required');
        }

        // Build shipments query - only include shipments with PAID invoices by default
        let shipmentsQuery = db.collection('shipments')
            .where('createdAt', '>=', new Date(startDate))
            .where('createdAt', '<=', new Date(endDate));

        // Add filter for paid invoices only (unless specifically requesting unpaid)
        if (!includeUnpaidInvoices) {
            shipmentsQuery = shipmentsQuery.where('invoiceStatus', '==', 'paid');
        }

        const shipmentsSnapshot = await shipmentsQuery.get();
        const shipments = shipmentsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Get all sales persons for filtering
        const salesPersonsSnapshot = await db.collection('salesPersons').where('active', '==', true).get();
        const salesPersons = salesPersonsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Calculate commissions
        const commissionResults = [];

        for (const shipment of shipments) {
            // Skip if company filter is specified and doesn't match
            if (companyIds.length > 0 && !companyIds.includes(shipment.companyId)) {
                continue;
            }

            // Find applicable sales persons for this shipment
            const applicableSalesPersons = salesPersons.filter(sp => {
                // Check if sales person is assigned to this company
                if (!sp.assignedCompanies.includes(shipment.companyId)) {
                    return false;
                }

                // Apply sales person filter if specified
                if (salesPersonIds.length > 0 && !salesPersonIds.includes(sp.id)) {
                    return false;
                }

                return true;
            });

            // Calculate commission for each applicable sales person
            for (const salesPerson of applicableSalesPersons) {
                const commissionData = await calculateShipmentCommission(shipment, salesPerson);
                if (commissionData.commissionAmount > 0) {
                    commissionResults.push(commissionData);
                }
            }
        }

        // Separate paid vs unpaid commissions
        const paidCommissions = commissionResults.filter(c => c.invoiceStatus === 'paid');
        const unpaidCommissions = commissionResults.filter(c => c.invoiceStatus !== 'paid');

        return {
            success: true,
            commissions: commissionResults,
            paidCommissions,
            unpaidCommissions,
            totalCommissionAmount: commissionResults.reduce((sum, c) => sum + c.commissionAmount, 0),
            payableCommissionAmount: paidCommissions.reduce((sum, c) => sum + c.commissionAmount, 0),
            pendingCommissionAmount: unpaidCommissions.reduce((sum, c) => sum + c.commissionAmount, 0),
            shipmentCount: shipments.length,
            commissionsCount: commissionResults.length,
            payableCommissionsCount: paidCommissions.length,
            pendingCommissionsCount: unpaidCommissions.length
        };

    } catch (error) {
        console.error('Error calculating commissions:', error);
        throw error;
    }
});

/**
 * Helper function to calculate commission for a single shipment
 */
async function calculateShipmentCommission(shipment, salesPerson) {
    try {
        const shipmentType = getShipmentType(shipment);
        const { grossRevenue, netRevenue } = getShipmentRevenue(shipment);

        // Get commission settings for this service type
        const commissionSettings = salesPerson.commissionSettings || {};
        let commissionPercent = 0;
        let revenueBase = 0;

        switch (shipmentType.toLowerCase()) {
            case 'ltl':
                commissionPercent = commissionSettings.ltlGrossPercent || 0;
                revenueBase = grossRevenue;
                break;
            case 'courier':
            case 'spd': // Handle SPD service type from sample data
                commissionPercent = commissionSettings.courierGrossPercent || 0;
                revenueBase = grossRevenue;
                break;
            case 'log': // Handle LOG service type from sample data
            case 'services':
            default:
                commissionPercent = commissionSettings.servicesGrossPercent || 0;
                revenueBase = grossRevenue;
                break;
        }

        const commissionAmount = (revenueBase * commissionPercent) / 100;

        // Determine commission status based on invoice payment status
        const invoiceStatus = shipment.invoiceStatus || 'unpaid';
        const commissionStatus = invoiceStatus === 'paid' ? 'payable' : 'pending';

        return {
            shipmentId: shipment.id,
            salesPersonId: salesPerson.id,
            salesPersonName: `${salesPerson.firstName} ${salesPerson.lastName}`,
            companyId: shipment.companyId,
            companyName: shipment.companyName || shipment.shipTo?.companyName || 'Unknown',
            shipmentType,
            grossRevenue,
            netRevenue,
            commissionPercent,
            revenueBase,
            commissionAmount,
            invoiceStatus, // Track invoice payment status
            commissionStatus, // payable, pending, or paid
            calculatedAt: admin.firestore.FieldValue.serverTimestamp(),
            shipmentDate: shipment.createdAt || shipment.bookedAt,
            invoiceNumber: shipment.invoiceNumber || null,
            invoiceDate: shipment.invoiceDate || null,
            isPaid: invoiceStatus === 'paid' // Commission is only payable if invoice is paid
        };

    } catch (error) {
        console.error('Error calculating commission for shipment:', shipment.id, error);
        return {
            shipmentId: shipment.id,
            salesPersonId: salesPerson.id,
            error: error.message,
            commissionAmount: 0,
            commissionStatus: 'error'
        };
    }
}

/**
 * Helper function to determine shipment type
 */
function getShipmentType(shipment) {
    if (shipment.shipmentInfo?.shipmentType) {
        return shipment.shipmentInfo.shipmentType.toUpperCase();
    }
    if (shipment.type) {
        return shipment.type.toUpperCase();
    }
    return 'SERVICES'; // Default
}

/**
 * Helper function to extract revenue data from shipment
 */
function getShipmentRevenue(shipment) {
    let grossRevenue = 0;
    let netRevenue = 0;

    try {
        // Priority 1: markupRates and actualRates (current system)
        if (shipment.markupRates?.totalCharges && shipment.actualRates?.totalCharges) {
            grossRevenue = parseFloat(shipment.markupRates.totalCharges) || 0;
            netRevenue = parseFloat(shipment.actualRates.totalCharges) || 0;
        }
        // Priority 2: totalCharges (assume this is gross)
        else if (shipment.totalCharges) {
            grossRevenue = parseFloat(shipment.totalCharges) || 0;
            netRevenue = grossRevenue * 0.8; // Assume 20% margin if no actual cost available
        }
        // Priority 3: selectedRate total
        else if (shipment.selectedRate?.totalCharges || shipment.selectedRate?.pricing?.total) {
            grossRevenue = parseFloat(shipment.selectedRate.totalCharges || shipment.selectedRate.pricing.total) || 0;
            netRevenue = grossRevenue * 0.8; // Assume 20% margin
        }

    } catch (error) {
        console.error('Error extracting revenue from shipment:', shipment.id, error);
    }

    return { grossRevenue, netRevenue };
}

// ===============================
// COMMISSION REPORTS
// ===============================

/**
 * Generate commission report
 */
exports.generateCommissionReport = onCall({
    cors: true,
    timeoutSeconds: 120,
}, async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Must be authenticated');
        }

        await checkAdminPermissions(request.auth.uid);

        const {
            reportName,
            startDate,
            endDate,
            filters = {},
            emailRecipients = ['tyler@tygershark.com'],
            saveReport = false,
            includeUnpaidInvoices = false // Option to include unpaid invoices in report
        } = request.data;

        // Calculate commissions
        const commissionResults = await exports.calculateCommissions({
            data: {
                startDate,
                endDate,
                companyIds: filters.companyIds || [],
                salesPersonIds: filters.salesPersonIds || [],
                salesTeamIds: filters.salesTeamIds || [],
                includeUnpaidInvoices
            },
            auth: request.auth
        });

        if (!commissionResults.success) {
            throw new HttpsError('internal', 'Failed to calculate commissions');
        }

        // Generate enhanced report document
        const reportData = {
            reportName: reportName || `Commission Report ${new Date().toLocaleDateString()}`,
            reportType: 'commission',
            generatedAt: admin.firestore.FieldValue.serverTimestamp(),
            generatedBy: request.auth.uid,
            dateRange: {
                startDate: new Date(startDate),
                endDate: new Date(endDate)
            },
            filters: {
                ...filters,
                includeUnpaidInvoices
            },
            summary: {
                totalCommissionAmount: commissionResults.totalCommissionAmount,
                payableCommissionAmount: commissionResults.payableCommissionAmount,
                pendingCommissionAmount: commissionResults.pendingCommissionAmount,
                totalShipments: commissionResults.shipmentCount,
                totalCommissions: commissionResults.commissionsCount,
                payableCommissionsCount: commissionResults.payableCommissionsCount,
                pendingCommissionsCount: commissionResults.pendingCommissionsCount,
                averageCommissionPerShipment: commissionResults.shipmentCount > 0 
                    ? commissionResults.totalCommissionAmount / commissionResults.shipmentCount 
                    : 0,
                payablePercentage: commissionResults.totalCommissionAmount > 0
                    ? (commissionResults.payableCommissionAmount / commissionResults.totalCommissionAmount * 100).toFixed(1)
                    : 0
            },
            commissions: commissionResults.commissions,
            paidCommissions: commissionResults.paidCommissions,
            unpaidCommissions: commissionResults.unpaidCommissions
        };

        let reportId = null;

        // Save report if requested
        if (saveReport) {
            const reportRef = await db.collection('salesCommissionReports').add(reportData);
            reportId = reportRef.id;
        }

        // Send email report
        if (emailRecipients.length > 0) {
            await sendCommissionReportEmail(reportData, emailRecipients);
        }

        return {
            success: true,
            reportId,
            reportData,
            message: includeUnpaidInvoices 
                ? 'Comprehensive commission report generated (includes unpaid invoices)'
                : 'Commission report generated (payable commissions only)',
            businessNote: 'Commissions are only payable on invoices that have been paid'
        };

    } catch (error) {
        console.error('Error generating commission report:', error);
        throw error;
    }
});

/**
 * Helper function to send commission report email
 */
async function sendCommissionReportEmail(reportData, recipients) {
    try {
        const emailSubject = `${reportData.reportName} - Sales Commission Report`;
        
        // Create CSV content with enhanced fields
        const csvHeaders = [
            'Shipment ID',
            'Sales Person',
            'Company',
            'Shipment Type',
            'Gross Revenue',
            'Net Revenue',
            'Commission %',
            'Commission Amount',
            'Invoice Status',
            'Commission Status',
            'Invoice Number',
            'Shipment Date'
        ];

        const csvRows = reportData.commissions.map(comm => [
            comm.shipmentId,
            comm.salesPersonName,
            comm.companyName,
            comm.shipmentType,
            `$${comm.grossRevenue.toFixed(2)}`,
            `$${comm.netRevenue.toFixed(2)}`,
            `${comm.commissionPercent}%`,
            `$${comm.commissionAmount.toFixed(2)}`,
            comm.invoiceStatus || 'unpaid',
            comm.commissionStatus || 'pending',
            comm.invoiceNumber || 'N/A',
            comm.shipmentDate ? new Date(comm.shipmentDate.toDate()).toLocaleDateString() : 'N/A'
        ]);

        const csvContent = [csvHeaders, ...csvRows]
            .map(row => row.join(','))
            .join('\n');

        // Calculate summary metrics
        const payableAmount = reportData.summary.payableCommissionAmount || 0;
        const pendingAmount = reportData.summary.pendingCommissionAmount || 0;
        const totalAmount = reportData.summary.totalCommissionAmount || 0;
        const payableCount = reportData.summary.payableCommissionsCount || 0;
        const pendingCount = reportData.summary.pendingCommissionsCount || 0;

        // Create enhanced HTML email content
        const emailHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto;">
                <h2 style="color: #1976d2; border-bottom: 2px solid #1976d2; padding-bottom: 10px;">
                    ${reportData.reportName}
                </h2>
                
                <div style="background-color: #f5f5f5; padding: 20px; margin: 20px 0; border-radius: 8px;">
                    <h3 style="margin-top: 0; color: #333;">Commission Summary</h3>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px;">
                        <div>
                            <strong>💰 Payable Commissions (Paid Invoices):</strong><br/>
                            <span style="font-size: 24px; color: #4caf50;">$${payableAmount.toFixed(2)}</span><br/>
                            <small style="color: #666;">${payableCount} commissions ready for payment</small>
                        </div>
                        <div>
                            <strong>⏳ Pending Commissions (Unpaid Invoices):</strong><br/>
                            <span style="font-size: 20px; color: #ff9800;">$${pendingAmount.toFixed(2)}</span><br/>
                            <small style="color: #666;">${pendingCount} commissions pending invoice payment</small>
                        </div>
                    </div>
                    <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
                        <strong>📊 Total Commission Value:</strong>
                        <span style="font-size: 18px; color: #2196f3; margin-left: 10px;">$${totalAmount.toFixed(2)}</span>
                    </div>
                </div>

                <div style="background-color: #fff3cd; padding: 15px; margin: 20px 0; border-radius: 8px; border-left: 4px solid #ffc107;">
                    <h4 style="margin-top: 0; color: #856404;">💡 Important Note</h4>
                    <p style="margin-bottom: 0; color: #856404;">
                        <strong>Commissions are only payable on invoices that have been paid.</strong><br/>
                        Pending commissions will become payable once their corresponding invoices are collected.
                    </p>
                </div>

                <div style="margin: 20px 0;">
                    <h3 style="color: #333;">Report Period</h3>
                    <p><strong>From:</strong> ${new Date(reportData.dateRange.startDate).toLocaleDateString()}</p>
                    <p><strong>To:</strong> ${new Date(reportData.dateRange.endDate).toLocaleDateString()}</p>
                    <p><strong>Total Shipments:</strong> ${reportData.summary.totalShipments || 0}</p>
                </div>

                <div style="margin: 20px 0;">
                    <p>The detailed commission report is attached as a CSV file with complete breakdown by invoice payment status.</p>
                    <p style="color: #666; font-size: 12px;">
                        This report was automatically generated by the SolushipX Sales Commission System.<br/>
                        Only commissions on paid invoices are eligible for immediate payment.
                    </p>
                </div>
            </div>
        `;

        // Send email with enhanced CSV attachment
        await sendNotificationEmail({
            to: recipients,
            subject: emailSubject,
            html: emailHtml,
            attachments: [{
                content: Buffer.from(csvContent).toString('base64'),
                filename: `commission-report-${new Date().toISOString().split('T')[0]}.csv`,
                type: 'text/csv',
                disposition: 'attachment'
            }]
        });

        console.log('Enhanced commission report email sent successfully to:', recipients);

    } catch (error) {
        console.error('Error sending commission report email:', error);
        throw error;
    }
}

/**
 * Schedule recurring commission reports
 */
exports.scheduleCommissionReport = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Must be authenticated');
        }

        await checkAdminPermissions(request.auth.uid);

        const {
            reportName,
            schedule, // 'weekly', 'monthly', 'quarterly'
            filters = {},
            emailRecipients = ['tyler@tygershark.com'],
            active = true
        } = request.data;

        if (!reportName || !schedule) {
            throw new HttpsError('invalid-argument', 'Report name and schedule are required');
        }

        const scheduleData = {
            reportName,
            reportType: 'commission',
            schedule,
            filters,
            emailRecipients,
            active,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            createdBy: request.auth.uid,
            lastRunAt: null,
            nextRunAt: calculateNextRunDate(schedule)
        };

        const scheduleRef = await db.collection('reportSchedules').add(scheduleData);

        return {
            success: true,
            scheduleId: scheduleRef.id,
            message: `Commission report scheduled successfully (${schedule})`
        };

    } catch (error) {
        console.error('Error scheduling commission report:', error);
        throw error;
    }
});

/**
 * Helper function to calculate next run date
 */
function calculateNextRunDate(schedule) {
    const now = new Date();
    const nextRun = new Date(now);

    switch (schedule) {
        case 'weekly':
            nextRun.setDate(now.getDate() + 7);
            break;
        case 'monthly':
            nextRun.setMonth(now.getMonth() + 1);
            break;
        case 'quarterly':
            nextRun.setMonth(now.getMonth() + 3);
            break;
        default:
            nextRun.setDate(now.getDate() + 7); // Default to weekly
    }

    return nextRun;
}

// ===============================
// ADDITIONAL HELPER FUNCTIONS
// ===============================

/**
 * Get commission summary for a sales person
 */
exports.getSalesPersonCommissionSummary = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Must be authenticated');
        }

        await checkAdminPermissions(request.auth.uid);

        const { salesPersonId, startDate, endDate } = request.data;

        if (!salesPersonId) {
            throw new HttpsError('invalid-argument', 'Sales person ID is required');
        }

        // Get sales person
        const salesPersonDoc = await db.collection('salesPersons').doc(salesPersonId).get();
        if (!salesPersonDoc.exists) {
            throw new HttpsError('not-found', 'Sales person not found');
        }

        const salesPerson = { id: salesPersonDoc.id, ...salesPersonDoc.data() };

        // Calculate commissions for this sales person
        const commissionResults = await exports.calculateCommissions({
            data: {
                startDate,
                endDate,
                salesPersonIds: [salesPersonId]
            },
            auth: request.auth
        });

        return {
            success: true,
            salesPerson,
            commissionSummary: {
                totalCommissionAmount: commissionResults.totalCommissionAmount,
                commissionsCount: commissionResults.commissionsCount,
                averageCommission: commissionResults.commissionsCount > 0 
                    ? commissionResults.totalCommissionAmount / commissionResults.commissionsCount 
                    : 0,
                commissionsByType: groupCommissionsByType(commissionResults.commissions)
            },
            commissions: commissionResults.commissions
        };

    } catch (error) {
        console.error('Error getting sales person commission summary:', error);
        throw error;
    }
});

/**
 * Helper function to group commissions by type
 */
function groupCommissionsByType(commissions) {
    const groups = commissions.reduce((acc, comm) => {
        if (!acc[comm.shipmentType]) {
            acc[comm.shipmentType] = {
                count: 0,
                totalAmount: 0,
                averagePercent: 0
            };
        }
        acc[comm.shipmentType].count++;
        acc[comm.shipmentType].totalAmount += comm.commissionAmount;
        acc[comm.shipmentType].averagePercent += comm.commissionPercent;
        return acc;
    }, {});

    // Calculate averages
    Object.keys(groups).forEach(type => {
        groups[type].averagePercent = groups[type].averagePercent / groups[type].count;
        groups[type].averageAmount = groups[type].totalAmount / groups[type].count;
    });

    return groups;
}

/**
 * Mark commissions as paid
 */
exports.markCommissionsAsPaid = onCall({
    cors: true,
    timeoutSeconds: 60,
}, async (request) => {
    try {
        if (!request.auth) {
            throw new HttpsError('unauthenticated', 'Must be authenticated');
        }

        await checkAdminPermissions(request.auth.uid);

        const {
            commissionIds = [],
            salesPersonId,
            paymentDate,
            paymentMethod = 'bank_transfer',
            paymentReference,
            notes
        } = request.data;

        if (commissionIds.length === 0 && !salesPersonId) {
            throw new HttpsError('invalid-argument', 'Must provide either commission IDs or sales person ID');
        }

        const batch = db.batch();
        const paidCommissions = [];

        // If paying specific commissions
        if (commissionIds.length > 0) {
            for (const commissionId of commissionIds) {
                const commissionRef = db.collection('salesCommissions').doc(commissionId);
                const commissionDoc = await commissionRef.get();
                
                if (commissionDoc.exists) {
                    const commissionData = commissionDoc.data();
                    
                    // Only mark as paid if commission is payable (invoice is paid)
                    if (commissionData.commissionStatus === 'payable') {
                        batch.update(commissionRef, {
                            commissionStatus: 'paid',
                            paidAt: admin.firestore.FieldValue.serverTimestamp(),
                            paidBy: request.auth.uid,
                            paymentDate: paymentDate ? new Date(paymentDate) : admin.firestore.FieldValue.serverTimestamp(),
                            paymentMethod,
                            paymentReference: paymentReference || null,
                            paymentNotes: notes || null
                        });
                        
                        paidCommissions.push({
                            id: commissionId,
                            amount: commissionData.commissionAmount,
                            salesPersonName: commissionData.salesPersonName
                        });
                    }
                }
            }
        }

        // If paying all payable commissions for a sales person
        if (salesPersonId && commissionIds.length === 0) {
            const payableCommissionsQuery = await db.collection('salesCommissions')
                .where('salesPersonId', '==', salesPersonId)
                .where('commissionStatus', '==', 'payable')
                .get();

            payableCommissionsQuery.docs.forEach(doc => {
                const commissionData = doc.data();
                
                batch.update(doc.ref, {
                    commissionStatus: 'paid',
                    paidAt: admin.firestore.FieldValue.serverTimestamp(),
                    paidBy: request.auth.uid,
                    paymentDate: paymentDate ? new Date(paymentDate) : admin.firestore.FieldValue.serverTimestamp(),
                    paymentMethod,
                    paymentReference: paymentReference || null,
                    paymentNotes: notes || null
                });

                paidCommissions.push({
                    id: doc.id,
                    amount: commissionData.commissionAmount,
                    salesPersonName: commissionData.salesPersonName
                });
            });
        }

        if (paidCommissions.length === 0) {
            throw new HttpsError('failed-precondition', 'No payable commissions found to mark as paid');
        }

        // Update sales person total paid commissions
        if (salesPersonId || (paidCommissions.length > 0 && paidCommissions[0].salesPersonId)) {
            const targetSalesPersonId = salesPersonId || paidCommissions[0].salesPersonId;
            const totalPaid = paidCommissions.reduce((sum, c) => sum + c.amount, 0);
            
            const salesPersonRef = db.collection('salesPersons').doc(targetSalesPersonId);
            batch.update(salesPersonRef, {
                totalCommissionPaid: admin.firestore.FieldValue.increment(totalPaid),
                totalCommissionOutstanding: admin.firestore.FieldValue.increment(-totalPaid),
                lastPaymentAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        await batch.commit();

        return {
            success: true,
            paidCommissions,
            totalAmount: paidCommissions.reduce((sum, c) => sum + c.amount, 0),
            message: `Successfully marked ${paidCommissions.length} commissions as paid`
        };

    } catch (error) {
        console.error('Error marking commissions as paid:', error);
        throw error;
    }
}); 