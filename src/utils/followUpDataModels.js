// ===================================================================
// SHIPMENT FOLLOW-UPS SYSTEM - DATA MODELS
// ===================================================================
// Enterprise-grade follow-up system to replace manual spreadsheets
// Handles automated checkpoints, manual tasks, and staff assignments

// ===================================================================
// 1. FOLLOW-UP RULES ENGINE
// ===================================================================

/**
 * Follow-Up Rule Configuration
 * Defines automated checkpoints and their triggers
 */
export const FollowUpRuleSchema = {
    // Rule Identity
    id: 'string',                    // Unique rule identifier
    name: 'string',                  // Human-readable rule name
    description: 'string',           // Rule description
    
    // Rule Scope & Conditions
    scope: {
        type: 'global|company|shipment_type|service_level|carrier', // Rule application scope
        value: 'string',             // Scope value (e.g., company ID, shipment type)
        conditions: [{
            field: 'string',         // Field to check (status, eta, shipment_type, etc.)
            operator: 'equals|contains|greater_than|less_than|between',
            value: 'any',            // Comparison value
            logicalOperator: 'and|or' // For multiple conditions
        }]
    },
    
    // Checkpoint Definition
    checkpoint: {
        name: 'string',              // Checkpoint name (e.g., "Confirm delivery ETA")
        category: 'pickup|delivery|documentation|exception|communication',
        priority: 'low|medium|high|urgent',
        description: 'string'
    },
    
    // Timing Configuration
    timing: {
        trigger: 'status_change|time_before_eta|time_after_eta|fixed_time|manual',
        offset: 'number',            // Hours/minutes offset
        offsetUnit: 'minutes|hours|days',
        specificTime: 'string',      // For fixed_time triggers (HH:MM format)
        businessHoursOnly: 'boolean' // Only trigger during business hours
    },
    
    // Actions to Execute
    actions: [{
        id: 'string',
        type: 'email|sms|call|document_upload|status_update|notification',
        config: {
            template: 'string',      // Email/SMS template ID
            recipients: ['string'],  // Email addresses or phone numbers
            subject: 'string',       // For emails
            message: 'string',       // Template message
            documentType: 'string',  // For document uploads
            statusValue: 'string',   // For status updates
            assignTo: 'string'       // Staff member to assign task to
        },
        required: 'boolean',         // Must be completed to mark checkpoint done
        order: 'number'              // Execution order
    }],
    
    // Assignment Rules
    assignment: {
        method: 'round_robin|specific_user|department|skill_based',
        assignTo: 'string',          // User ID or department
        fallbackAssignee: 'string',  // If primary assignee unavailable
        escalationRules: [{
            condition: 'overdue|no_response',
            timeLimit: 'number',     // Hours before escalation
            escalateTo: 'string'     // User ID or department
        }]
    },
    
    // Rule Status & Metadata
    isActive: 'boolean',
    createdAt: 'timestamp',
    updatedAt: 'timestamp',
    createdBy: 'string',
    version: 'number'
};

// ===================================================================
// 2. TASK MANAGEMENT SYSTEM
// ===================================================================

/**
 * Follow-Up Task
 * Individual tasks generated from rules or created manually
 */
export const FollowUpTaskSchema = {
    // Task Identity
    id: 'string',                    // Unique task identifier
    shipmentId: 'string',           // Reference to shipment
    ruleId: 'string',               // Rule that generated this task (null for manual)
    parentTaskId: 'string',         // For subtasks
    
    // Task Details
    title: 'string',                // Task title
    description: 'string',          // Detailed description
    category: 'pickup|delivery|documentation|exception|communication|manual',
    priority: 'low|medium|high|urgent',
    
    // Checkpoint Information
    checkpoint: {
        name: 'string',
        expectedOutcome: 'string',
        instructions: 'string'
    },
    
    // Assignment & Scheduling
    assignedTo: 'string',           // User ID
    assignedBy: 'string',           // Who assigned the task
    dueDate: 'timestamp',           // When task is due
    scheduledFor: 'timestamp',      // When task should be worked on
    estimatedDuration: 'number',    // Minutes
    
    // Status & Progress
    status: 'pending|in_progress|completed|cancelled|overdue|escalated',
    progress: 'number',             // 0-100 percentage
    completedAt: 'timestamp',
    completedBy: 'string',
    
    // Actions & Results
    actions: [{
        id: 'string',
        type: 'email|sms|call|document_upload|status_update|note',
        status: 'pending|completed|failed|skipped',
        completedAt: 'timestamp',
        result: 'string',            // Action outcome
        metadata: 'object'           // Action-specific data
    }],
    
    // Communication Log
    communications: [{
        id: 'string',
        type: 'email|sms|call|note',
        direction: 'inbound|outbound',
        timestamp: 'timestamp',
        from: 'string',
        to: 'string',
        subject: 'string',
        content: 'string',
        attachments: ['string']
    }],
    
    // Document Attachments
    documents: [{
        id: 'string',
        name: 'string',
        type: 'proof_of_delivery|invoice|receipt|photo|document',
        url: 'string',
        uploadedBy: 'string',
        uploadedAt: 'timestamp',
        size: 'number',
        metadata: 'object'
    }],
    
    // Notes & Comments
    notes: [{
        id: 'string',
        content: 'string',
        type: 'internal|customer_facing|carrier_facing',
        addedBy: 'string',
        addedAt: 'timestamp',
        isPrivate: 'boolean'
    }],
    
    // Escalation & Reminders
    escalation: {
        level: 'number',             // 0 = no escalation
        escalatedAt: 'timestamp',
        escalatedTo: 'string',
        reason: 'string'
    },
    
    reminders: [{
        id: 'string',
        type: 'email|sms|notification',
        scheduledFor: 'timestamp',
        sent: 'boolean',
        sentAt: 'timestamp'
    }],
    
    // Metadata
    createdAt: 'timestamp',
    updatedAt: 'timestamp',
    tags: ['string'],
    customFields: 'object'
};

// ===================================================================
// 3. STAFF ASSIGNMENT SYSTEM
// ===================================================================

/**
 * Staff Member Configuration
 * Defines team members and their capabilities
 */
export const StaffMemberSchema = {
    // Identity
    id: 'string',                    // User ID
    email: 'string',
    name: 'string',
    role: 'string',
    department: 'string',
    
    // Capabilities & Skills
    skills: ['string'],              // e.g., ['customer_service', 'carrier_relations', 'documentation']
    languages: ['string'],           // Supported languages
    certifications: ['string'],      // Relevant certifications
    
    // Availability & Workload
    availability: {
        schedule: {
            monday: { start: 'string', end: 'string', available: 'boolean' },
            tuesday: { start: 'string', end: 'string', available: 'boolean' },
            wednesday: { start: 'string', end: 'string', available: 'boolean' },
            thursday: { start: 'string', end: 'string', available: 'boolean' },
            friday: { start: 'string', end: 'string', available: 'boolean' },
            saturday: { start: 'string', end: 'string', available: 'boolean' },
            sunday: { start: 'string', end: 'string', available: 'boolean' }
        },
        timezone: 'string',
        maxConcurrentTasks: 'number',
        currentTaskLoad: 'number'
    },
    
    // Performance Metrics
    performance: {
        tasksCompleted: 'number',
        averageCompletionTime: 'number', // Minutes
        onTimeCompletionRate: 'number',  // Percentage
        customerSatisfactionScore: 'number',
        lastPerformanceReview: 'timestamp'
    },
    
    // Contact Preferences
    contactPreferences: {
        email: 'boolean',
        sms: 'boolean',
        inApp: 'boolean',
        urgentOnly: 'boolean'
    },
    
    // Status
    isActive: 'boolean',
    isOnline: 'boolean',
    lastSeen: 'timestamp'
};

// ===================================================================
// 4. NOTIFICATION SYSTEM
// ===================================================================

/**
 * Notification Configuration
 * Manages automated reminders and alerts
 */
export const NotificationSchema = {
    // Identity
    id: 'string',
    taskId: 'string',               // Associated task
    recipientId: 'string',          // Staff member
    
    // Notification Details
    type: 'reminder|escalation|assignment|completion|overdue',
    channel: 'email|sms|push|in_app',
    priority: 'low|medium|high|urgent',
    
    // Content
    subject: 'string',
    message: 'string',
    templateId: 'string',
    templateData: 'object',
    
    // Scheduling
    scheduledFor: 'timestamp',
    sent: 'boolean',
    sentAt: 'timestamp',
    deliveredAt: 'timestamp',
    readAt: 'timestamp',
    
    // Retry Logic
    retryCount: 'number',
    maxRetries: 'number',
    retryInterval: 'number',        // Minutes
    
    // Status
    status: 'pending|sent|delivered|read|failed',
    error: 'string',
    
    // Metadata
    createdAt: 'timestamp',
    updatedAt: 'timestamp'
};

// ===================================================================
// 5. ACTIVITY LOG & AUDIT TRAIL
// ===================================================================

/**
 * Activity Log Entry
 * Complete audit trail for all follow-up activities
 */
export const ActivityLogSchema = {
    // Identity
    id: 'string',
    shipmentId: 'string',
    taskId: 'string',
    userId: 'string',
    
    // Activity Details
    action: 'created|updated|completed|cancelled|assigned|escalated|commented',
    entity: 'task|rule|assignment|document|communication',
    description: 'string',
    
    // Changes Made
    changes: [{
        field: 'string',
        oldValue: 'any',
        newValue: 'any'
    }],
    
    // Context
    context: {
        ip: 'string',
        userAgent: 'string',
        source: 'web|mobile|api|system',
        automated: 'boolean'
    },
    
    // Metadata
    timestamp: 'timestamp',
    metadata: 'object'
};

// ===================================================================
// 6. DOCUMENT MANAGEMENT
// ===================================================================

/**
 * Document Schema
 * Manages all follow-up related documents
 */
export const DocumentSchema = {
    // Identity
    id: 'string',
    taskId: 'string',
    shipmentId: 'string',
    
    // Document Details
    name: 'string',
    originalName: 'string',
    type: 'proof_of_delivery|invoice|receipt|photo|email|contract|other',
    category: 'pickup|delivery|billing|exception|communication',
    
    // File Information
    url: 'string',
    thumbnailUrl: 'string',
    size: 'number',                 // Bytes
    mimeType: 'string',
    extension: 'string',
    
    // Upload Information
    uploadedBy: 'string',
    uploadedAt: 'timestamp',
    source: 'manual|email|api|mobile',
    
    // Processing
    processed: 'boolean',
    extractedText: 'string',        // OCR results
    extractedData: 'object',        // Structured data
    
    // Access Control
    visibility: 'private|internal|customer|carrier|public',
    allowedUsers: ['string'],
    
    // Status
    status: 'uploaded|processing|processed|failed|deleted',
    
    // Metadata
    tags: ['string'],
    description: 'string',
    customFields: 'object',
    createdAt: 'timestamp',
    updatedAt: 'timestamp'
};

// ===================================================================
// 7. TEMPLATE SYSTEM
// ===================================================================

/**
 * Communication Template
 * Reusable templates for emails, SMS, etc.
 */
export const TemplateSchema = {
    // Identity
    id: 'string',
    name: 'string',
    description: 'string',
    
    // Template Details
    type: 'email|sms|notification',
    category: 'pickup|delivery|exception|reminder|escalation',
    
    // Content
    subject: 'string',              // For emails
    body: 'string',                 // Template content with variables
    variables: [{
        name: 'string',
        description: 'string',
        required: 'boolean',
        defaultValue: 'string'
    }],
    
    // Formatting
    format: 'plain|html|markdown',
    
    // Usage
    isActive: 'boolean',
    usageCount: 'number',
    
    // Metadata
    createdAt: 'timestamp',
    updatedAt: 'timestamp',
    createdBy: 'string',
    version: 'number'
};

// ===================================================================
// EXAMPLE DATA STRUCTURES
// ===================================================================

export const ExampleFollowUpRule = {
    id: 'rule_eta_confirmation',
    name: 'ETA Confirmation - 3 Hours Before Delivery',
    description: 'Automatically create task to confirm delivery ETA with carrier 3 hours before scheduled delivery',
    
    scope: {
        type: 'global',
        value: '*',
        conditions: [{
            field: 'status',
            operator: 'equals',
            value: 'in_transit',
            logicalOperator: 'and'
        }, {
            field: 'shipment_type',
            operator: 'equals',
            value: 'freight',
            logicalOperator: 'and'
        }]
    },
    
    checkpoint: {
        name: 'Confirm Delivery ETA',
        category: 'delivery',
        priority: 'high',
        description: 'Contact carrier to confirm delivery ETA and notify customer'
    },
    
    timing: {
        trigger: 'time_before_eta',
        offset: 3,
        offsetUnit: 'hours',
        businessHoursOnly: true
    },
    
    actions: [{
        id: 'action_call_carrier',
        type: 'call',
        config: {
            assignTo: 'logistics_team',
            template: 'eta_confirmation_script'
        },
        required: true,
        order: 1
    }, {
        id: 'action_email_customer',
        type: 'email',
        config: {
            template: 'customer_eta_update',
            recipients: ['customer'],
            subject: 'Delivery Update - {{shipmentId}}'
        },
        required: false,
        order: 2
    }],
    
    assignment: {
        method: 'round_robin',
        assignTo: 'logistics_team',
        fallbackAssignee: 'supervisor',
        escalationRules: [{
            condition: 'overdue',
            timeLimit: 1,
            escalateTo: 'supervisor'
        }]
    },
    
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: 'admin',
    version: 1
};

export const ExampleFollowUpTask = {
    id: 'task_eta_conf_IC001',
    shipmentId: 'IC-DWSLOGISTICS-22OC79',
    ruleId: 'rule_eta_confirmation',
    
    title: 'Confirm Delivery ETA with Carrier',
    description: 'Contact carrier to confirm delivery ETA for shipment IC-DWSLOGISTICS-22OC79 scheduled for delivery at 2:00 PM today',
    category: 'delivery',
    priority: 'high',
    
    checkpoint: {
        name: 'Confirm Delivery ETA',
        expectedOutcome: 'Confirmed ETA and customer notification sent',
        instructions: 'Call carrier using provided contact info, confirm delivery window, update ETA if changed, notify customer'
    },
    
    assignedTo: 'tanya_logistics',
    assignedBy: 'system',
    dueDate: new Date(Date.now() + 1 * 60 * 60 * 1000), // 1 hour from now
    scheduledFor: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
    estimatedDuration: 15,
    
    status: 'pending',
    progress: 0,
    
    actions: [{
        id: 'action_call_carrier',
        type: 'call',
        status: 'pending',
        metadata: {
            carrierPhone: '+1-555-0123',
            carrierContact: 'Marcin',
            currentETA: '2025-01-14T14:00:00Z'
        }
    }, {
        id: 'action_email_customer',
        type: 'email',
        status: 'pending',
        metadata: {
            customerEmail: 'customer@example.com',
            templateId: 'customer_eta_update'
        }
    }],
    
    communications: [],
    documents: [],
    notes: [],
    
    escalation: {
        level: 0
    },
    
    reminders: [{
        id: 'reminder_1',
        type: 'email',
        scheduledFor: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes from now
        sent: false
    }],
    
    createdAt: new Date(),
    updatedAt: new Date(),
    tags: ['eta_confirmation', 'freight', 'high_priority'],
    customFields: {}
};

export default {
    FollowUpRuleSchema,
    FollowUpTaskSchema,
    StaffMemberSchema,
    NotificationSchema,
    ActivityLogSchema,
    DocumentSchema,
    TemplateSchema,
    ExampleFollowUpRule,
    ExampleFollowUpTask
}; 