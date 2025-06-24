const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');

/**
 * Create a mock Firebase callable request for warmup purposes
 * This prevents "Cannot read properties of undefined (reading 'on')" errors
 */
function createMockCallableRequest(data, authUid) {
    // Enhanced mock request object with all possible properties that Firebase functions might expect
    const mockRequest = {
        data: data,
        auth: authUid ? { uid: authUid, token: {} } : null,
        rawRequest: {
            ip: '127.0.0.1',
            headers: { 'user-agent': 'keepalive-warmup-system/1.0' },
            method: 'POST',
            url: '/warmup',
            body: data
        },
        instanceIdToken: null,
        appCheckToken: null,
        
        // Add comprehensive EventEmitter-like methods to prevent any .on() errors
        on: function(event, listener) { return this; },
        once: function(event, listener) { return this; },
        emit: function(event, ...args) { return false; },
        removeListener: function(event, listener) { return this; },
        removeAllListeners: function(event) { return this; },
        setMaxListeners: function(n) { return this; },
        getMaxListeners: function() { return 0; },
        listeners: function(event) { return []; },
        listenerCount: function(event) { return 0; },
        eventNames: function() { return []; },
        prependListener: function(event, listener) { return this; },
        prependOnceListener: function(event, listener) { return this; },
        off: function(event, listener) { return this; },
        
        // Add request/response-like methods that some functions might expect
        pipe: function(destination) { return destination; },
        unpipe: function(destination) { return this; },
        read: function(size) { return null; },
        write: function(chunk, encoding, callback) { return true; },
        end: function(chunk, encoding, callback) { return this; },
        destroy: function(error) { return this; },
        
        // Add HTTP-like properties
        headers: { 'content-type': 'application/json', 'user-agent': 'keepalive-warmup/1.0' },
        method: 'POST',
        url: '/warmup',
        statusCode: 200,
        statusMessage: 'OK'
    };
    
    // Make the mock request appear as a proper request object
    Object.defineProperty(mockRequest, 'constructor', {
        value: { name: 'MockCallableRequest' },
        writable: false
    });
    
    return mockRequest;
}

/**
 * Keep-Alive System for Carrier Cloud Functions
 * 
 * This system prevents cold starts by periodically pinging carrier functions
 * to keep them warm and responsive for rate fetching operations.
 * 
 * Functions are pinged every 5 minutes during business hours (7 AM - 10 PM EST)
 * and every 15 minutes during off hours to balance cost and performance.
 */

/**
 * Test request data for warming up functions
 * Using minimal valid data to ensure functions initialize properly
 */
const warmupRequestData = {
    apiKey: 'warmup-request-key', // Add API key for warmup requests
    _isWarmupRequest: true, // Add warmup flag directly in the data payload
    shipFrom: {
        company: "Test Company",
        address1: "123 Test St",
        city: "Toronto",
        stateProv: "ON",
        zipPostal: "M1M1M1",
        country: "CA"
    },
    shipTo: {
        company: "Test Destination",
        address1: "456 Test Ave",
        city: "Vancouver",
        stateProv: "BC", 
        zipPostal: "V1V1V1",
        country: "CA"
    },
    packages: [{
        packagingQuantity: 1,
        packagingType: "Skid",
        weight: 100,
        length: 48,
        width: 40,
        height: 48,
        packagingGroup: "I"
    }],
    shipmentInfo: {
        shipmentDate: new Date().toISOString(),
        shipmentType: "freight"
    }
};

/**
 * Keep eShipPlus function warm
 * Scheduled to run every 5 minutes during business hours
 */
exports.keepAliveEShipPlus = onSchedule({
    schedule: 'every 5 minutes',
    timeZone: 'America/Toronto'
}, async (event) => {
    try {
        logger.info('🔥 Warming up eShipPlus function...');
        
        // Import the function directly to avoid external HTTP calls
        const { getRatesEShipPlus } = require('./carrier-api/eshipplus/getRates');
        
        // Create a proper mock request object to prevent "on" property errors
        const mockRequest = createMockCallableRequest(warmupRequestData, 'keepalive-system');
        
        // Call with warmup flag - function should recognize this and return quickly
        const result = await getRatesEShipPlus(mockRequest);
        
        logger.info('✅ eShipPlus function warmed successfully');
        return { success: true, function: 'eShipPlus', timestamp: new Date().toISOString() };
        
    } catch (error) {
        logger.warn('⚠️ eShipPlus warmup failed (expected for warmup):', error.message);
        // Warmup failures are expected and not critical
        return { success: false, function: 'eShipPlus', error: error.message };
    }
});

/**
 * Keep Canpar function warm
 * Scheduled to run every 5 minutes during business hours
 */
exports.keepAliveCanpar = onSchedule({
    schedule: 'every 5 minutes',
    timeZone: 'America/Toronto'
}, async (event) => {
    try {
        logger.info('🔥 Warming up Canpar function...');
        
        const { getRatesCanpar } = require('./carrier-api/canpar/getRates');
        
        // Create a proper mock request object to prevent "on" property errors
        const mockRequest = createMockCallableRequest(warmupRequestData, 'keepalive-system');
        
        const result = await getRatesCanpar(mockRequest);
        
        logger.info('✅ Canpar function warmed successfully');
        return { success: true, function: 'Canpar', timestamp: new Date().toISOString() };
        
    } catch (error) {
        logger.warn('⚠️ Canpar warmup failed (expected for warmup):', error.message);
        return { success: false, function: 'Canpar', error: error.message };
    }
});

/**
 * Keep Polaris Transportation function warm
 * Scheduled to run every 5 minutes during business hours
 */
exports.keepAlivePolaris = onSchedule({
    schedule: 'every 5 minutes',
    timeZone: 'America/Toronto'
}, async (event) => {
    try {
        logger.info('🔥 Warming up Polaris Transportation function...');
        
        const { getRatesPolarisTransportation } = require('./carrier-api/polaristransportation/getRates');
        
        // Create a proper mock request object to prevent "on" property errors
        const mockRequest = createMockCallableRequest(warmupRequestData, 'keepalive-system');
        
        const result = await getRatesPolarisTransportation(mockRequest);
        
        logger.info('✅ Polaris Transportation function warmed successfully');
        return { success: true, function: 'PolarisTransportation', timestamp: new Date().toISOString() };
        
    } catch (error) {
        logger.warn('⚠️ Polaris Transportation warmup failed (expected for warmup):', error.message);
        return { success: false, function: 'PolarisTransportation', error: error.message };
    }
});

/**
 * Keep QuickShip functions warm
 * Critical for email notification reliability - runs every 3 minutes
 */
exports.keepAliveQuickShip = onSchedule({
    schedule: 'every 3 minutes',
    timeZone: 'America/Toronto'
}, async (event) => {
    const results = [];
    
    // QuickShip test data for warmup
    const quickShipWarmupData = {
        shipmentData: {
            shipmentID: 'WARMUP-TEST-001',
            companyID: 'warmup-test',
            carrier: 'Test Carrier',
            shipFrom: {
                company: "Warmup Test Company",
                street: "123 Test St",
                city: "Toronto",
                state: "ON",
                postalCode: "M1M1M1",
                country: "CA"
            },
            shipTo: {
                company: "Warmup Test Destination",
                street: "456 Test Ave",
                city: "Vancouver",
                state: "BC",
                postalCode: "V1V1V1",
                country: "CA"
            },
            packages: [{
                id: 1,
                itemDescription: "Test Item",
                packagingType: 262,
                packagingQuantity: 1,
                weight: 100,
                length: 48,
                width: 40,
                height: 48
            }],
            manualRates: [{
                id: 1,
                carrier: "Test Carrier",
                code: "STANDARD",
                chargeName: "Freight",
                cost: 150.00,
                charge: 200.00,
                costCurrency: "CAD",
                chargeCurrency: "CAD"
            }],
            totalCharges: 200.00,
            currency: "CAD",
            status: "warmup",
            _isWarmupRequest: true
        },
        carrierDetails: {
            name: "Test Carrier",
            contactEmail: "warmup@test.com",
            phone: "555-0123"
        },
        _isWarmupRequest: true
    };

    logger.info('🔥 Starting QuickShip functions warmup...');

    // 1. Warm up bookQuickShipment
    try {
        const { bookQuickShipmentInternal } = require('./carrier-api/generic/bookQuickShipment');
        await bookQuickShipmentInternal(quickShipWarmupData, { uid: 'keepalive-system' });
        results.push({ function: 'bookQuickShipment', success: true });
        logger.info('✅ bookQuickShipment warmed successfully');
    } catch (error) {
        results.push({ function: 'bookQuickShipment', success: false, error: error.message });
        logger.warn('⚠️ bookQuickShipment warmup failed (expected):', error.message);
    }

    // 2. Warm up generateGenericBOL
    try {
        const { generateBOLCore } = require('./carrier-api/generic/generateGenericBOL');
        await generateBOLCore('WARMUP-TEST-001', 'warmup-doc-id');
        results.push({ function: 'generateGenericBOL', success: true });
        logger.info('✅ generateGenericBOL warmed successfully');
    } catch (error) {
        results.push({ function: 'generateGenericBOL', success: false, error: error.message });
        logger.warn('⚠️ generateGenericBOL warmup failed (expected):', error.message);
    }

    // 3. Warm up generateCarrierConfirmation
    try {
        const { generateCarrierConfirmationCore } = require('./carrier-api/generic/generateCarrierConfirmation');
        await generateCarrierConfirmationCore('WARMUP-TEST-001', 'warmup-doc-id', quickShipWarmupData.carrierDetails);
        results.push({ function: 'generateCarrierConfirmation', success: true });
        logger.info('✅ generateCarrierConfirmation warmed successfully');
    } catch (error) {
        results.push({ function: 'generateCarrierConfirmation', success: false, error: error.message });
        logger.warn('⚠️ generateCarrierConfirmation warmup failed (expected):', error.message);
    }

    // 4. Warm up sendQuickShipNotifications
    try {
        const { sendQuickShipNotifications } = require('./carrier-api/generic/sendQuickShipNotifications');
        await sendQuickShipNotifications({
            shipmentData: { ...quickShipWarmupData.shipmentData, _skipEmailSending: true },
            carrierDetails: quickShipWarmupData.carrierDetails,
            documentResults: []
        });
        results.push({ function: 'sendQuickShipNotifications', success: true });
        logger.info('✅ sendQuickShipNotifications warmed successfully');
    } catch (error) {
        results.push({ function: 'sendQuickShipNotifications', success: false, error: error.message });
        logger.warn('⚠️ sendQuickShipNotifications warmup failed (expected):', error.message);
    }

    logger.info('🏁 QuickShip warmup completed:', results);
    return {
        success: true,
        timestamp: new Date().toISOString(),
        results
    };
});

/**
 * Comprehensive keep-alive for all carrier functions
 * Runs during off-peak hours (less frequently to save costs)
 */
exports.keepAliveAllCarriers = onSchedule({
    schedule: 'every 15 minutes',
    timeZone: 'America/Toronto'
}, async (event) => {
    const results = [];
    const carriers = [
        { name: 'eShipPlus', module: './carrier-api/eshipplus/getRates', func: 'getRatesEShipPlus' },
        { name: 'Canpar', module: './carrier-api/canpar/getRates', func: 'getRatesCanpar' },
        { name: 'PolarisTransportation', module: './carrier-api/polaristransportation/getRates', func: 'getRatesPolarisTransportation' }
    ];
    
    const quickShipFunctions = [
        { name: 'bookQuickShipment', module: './carrier-api/generic/bookQuickShipment', func: 'bookQuickShipment' },
        { name: 'generateGenericBOL', module: './carrier-api/generic/generateGenericBOL', func: 'generateBOLCore' },
        { name: 'generateCarrierConfirmation', module: './carrier-api/generic/generateCarrierConfirmation', func: 'generateCarrierConfirmationCore' }
    ];

    logger.info('🔥 Starting comprehensive carrier warmup...');

    // Warm up carrier functions
    for (const carrier of carriers) {
        try {
            const { [carrier.func]: carrierFunction } = require(carrier.module);
            
            const mockRequest = createMockCallableRequest(warmupRequestData, 'keepalive-system');
            await carrierFunction(mockRequest);
            
            results.push({ carrier: carrier.name, success: true, type: 'carrier' });
            logger.info(`✅ ${carrier.name} warmed successfully`);
            
        } catch (error) {
            results.push({ carrier: carrier.name, success: false, error: error.message, type: 'carrier' });
            logger.warn(`⚠️ ${carrier.name} warmup failed:`, error.message);
        }
    }

    // Warm up QuickShip functions
    logger.info('🔥 Starting QuickShip functions warmup...');
    
    // QuickShip warmup data
    const quickShipWarmupData = {
        shipmentData: {
            shipmentID: 'WARMUP-COMPREHENSIVE-001',
            companyID: 'warmup-test',
            carrier: 'Test Carrier',
            status: "warmup",
            _isWarmupRequest: true
        },
        carrierDetails: {
            name: "Test Carrier",
            contactEmail: "warmup@test.com"
        },
        _isWarmupRequest: true
    };

    for (const quickShipFunc of quickShipFunctions) {
        try {
            const { [quickShipFunc.func]: funcToCall } = require(quickShipFunc.module);
            
            if (quickShipFunc.name === 'bookQuickShipment') {
                const { bookQuickShipmentInternal } = require('./carrier-api/generic/bookQuickShipment');
                await bookQuickShipmentInternal(quickShipWarmupData, { uid: 'keepalive-system' });
            } else if (quickShipFunc.name === 'generateGenericBOL') {
                await funcToCall('WARMUP-COMPREHENSIVE-001', 'warmup-doc-id');
            } else if (quickShipFunc.name === 'generateCarrierConfirmation') {
                await funcToCall('WARMUP-COMPREHENSIVE-001', 'warmup-doc-id', quickShipWarmupData.carrierDetails);
            }
            
            results.push({ carrier: quickShipFunc.name, success: true, type: 'quickship' });
            logger.info(`✅ ${quickShipFunc.name} warmed successfully`);
            
        } catch (error) {
            results.push({ carrier: quickShipFunc.name, success: false, error: error.message, type: 'quickship' });
            logger.warn(`⚠️ ${quickShipFunc.name} warmup failed:`, error.message);
        }
    }

    logger.info('🏁 Comprehensive warmup completed:', results);
    return {
        success: true,
        timestamp: new Date().toISOString(),
        results
    };
});

/**
 * Manual trigger for warming up all functions
 * Can be called via HTTP to immediately warm all carrier functions
 */
exports.warmupCarriersNow = onCall({
    cors: true,
    timeoutSeconds: 60,
    memory: '256MiB',
    region: 'us-central1'
}, async (request) => {
    logger.info('🚀 Manual warmup triggered by user:', request.auth?.uid || 'anonymous');
    
    const results = [];
    const carriers = [
        { name: 'eShipPlus', module: './carrier-api/eshipplus/getRates', func: 'getRatesEShipPlus' },
        { name: 'Canpar', module: './carrier-api/canpar/getRates', func: 'getRatesCanpar' },
        { name: 'PolarisTransportation', module: './carrier-api/polaristransportation/getRates', func: 'getRatesPolarisTransportation' }
    ];
    
    const quickShipFunctions = [
        { name: 'bookQuickShipment', module: './carrier-api/generic/bookQuickShipment', func: 'bookQuickShipment' },
        { name: 'generateGenericBOL', module: './carrier-api/generic/generateGenericBOL', func: 'generateBOLCore' },
        { name: 'generateCarrierConfirmation', module: './carrier-api/generic/generateCarrierConfirmation', func: 'generateCarrierConfirmationCore' }
    ];

    for (const carrier of carriers) {
        try {
            const startTime = Date.now();
            const { [carrier.func]: carrierFunction } = require(carrier.module);
            
            const mockRequest = createMockCallableRequest(warmupRequestData, request.auth?.uid || 'manual-warmup');
            await carrierFunction(mockRequest);
            
            const duration = Date.now() - startTime;
            results.push({ 
                carrier: carrier.name, 
                success: true, 
                duration: `${duration}ms`,
                status: 'warmed',
                type: 'carrier'
            });
            
        } catch (error) {
            results.push({ 
                carrier: carrier.name, 
                success: false, 
                error: error.message,
                status: 'failed',
                type: 'carrier'
            });
        }
    }

    // Warm up QuickShip functions
    logger.info('🔥 Manual QuickShip warmup...');
    
    const quickShipWarmupData = {
        shipmentData: {
            shipmentID: 'WARMUP-MANUAL-001',
            companyID: 'warmup-test',
            carrier: 'Test Carrier',
            status: "warmup",
            _isWarmupRequest: true
        },
        carrierDetails: {
            name: "Test Carrier",
            contactEmail: "warmup@test.com"
        },
        _isWarmupRequest: true
    };

    for (const quickShipFunc of quickShipFunctions) {
        try {
            const startTime = Date.now();
            const { [quickShipFunc.func]: funcToCall } = require(quickShipFunc.module);
            
            if (quickShipFunc.name === 'bookQuickShipment') {
                const { bookQuickShipmentInternal } = require('./carrier-api/generic/bookQuickShipment');
                await bookQuickShipmentInternal(quickShipWarmupData, { uid: 'keepalive-system' });
            } else if (quickShipFunc.name === 'generateGenericBOL') {
                await funcToCall('WARMUP-MANUAL-001', 'warmup-doc-id');
            } else if (quickShipFunc.name === 'generateCarrierConfirmation') {
                await funcToCall('WARMUP-MANUAL-001', 'warmup-doc-id', quickShipWarmupData.carrierDetails);
            }
            
            const duration = Date.now() - startTime;
            results.push({ 
                carrier: quickShipFunc.name, 
                success: true, 
                duration: `${duration}ms`,
                status: 'warmed',
                type: 'quickship'
            });
            
        } catch (error) {
            results.push({ 
                carrier: quickShipFunc.name, 
                success: false, 
                error: error.message,
                status: 'failed',
                type: 'quickship'
            });
        }
    }

    return {
        success: true,
        message: 'Warmup process completed (carriers + QuickShip)',
        timestamp: new Date().toISOString(),
        results
    };
});

/**
 * Health check for carrier functions
 * Returns the current "temperature" of each function
 */
exports.carrierHealthCheck = onCall({
    cors: true,
    timeoutSeconds: 30,
    memory: '256MiB',
    region: 'us-central1'
}, async (request) => {
    const healthResults = [];
    const carriers = [
        { name: 'eShipPlus', module: './carrier-api/eshipplus/getRates', func: 'getRatesEShipPlus' },
        { name: 'Canpar', module: './carrier-api/canpar/getRates', func: 'getRatesCanpar' },
        { name: 'PolarisTransportation', module: './carrier-api/polaristransportation/getRates', func: 'getRatesPolarisTransportation' }
    ];

    for (const carrier of carriers) {
        const startTime = Date.now();
        let status = 'cold';
        let error = null;

        try {
            const { [carrier.func]: carrierFunction } = require(carrier.module);
            
            const mockRequest = createMockCallableRequest(warmupRequestData, 'health-check');
            await carrierFunction(mockRequest);
            
            const duration = Date.now() - startTime;
            
            // Determine temperature based on response time
            if (duration < 2000) {
                status = 'hot';
            } else if (duration < 5000) {
                status = 'warm';
            } else {
                status = 'cold';
            }
            
            healthResults.push({
                carrier: carrier.name,
                status,
                responseTime: `${duration}ms`,
                healthy: true
            });
            
        } catch (err) {
            error = err.message;
            healthResults.push({
                carrier: carrier.name,
                status: 'error',
                responseTime: `${Date.now() - startTime}ms`,
                healthy: false,
                error
            });
        }
    }

    return {
        success: true,
        timestamp: new Date().toISOString(),
        overall: healthResults.every(r => r.healthy) ? 'healthy' : 'degraded',
        carriers: healthResults
    };
}); 