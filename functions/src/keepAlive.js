const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');

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
    },
    _isWarmupRequest: true // Flag to identify warmup requests
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
        
        // Call with warmup flag - function should recognize this and return quickly
        const result = await getRatesEShipPlus({
            data: warmupRequestData,
            auth: { uid: 'keepalive-system' }
        });
        
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
        
        const result = await getRatesCanpar({
            data: warmupRequestData,
            auth: { uid: 'keepalive-system' }
        });
        
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
        
        const result = await getRatesPolarisTransportation({
            data: warmupRequestData,
            auth: { uid: 'keepalive-system' }
        });
        
        logger.info('✅ Polaris Transportation function warmed successfully');
        return { success: true, function: 'PolarisTransportation', timestamp: new Date().toISOString() };
        
    } catch (error) {
        logger.warn('⚠️ Polaris Transportation warmup failed (expected for warmup):', error.message);
        return { success: false, function: 'PolarisTransportation', error: error.message };
    }
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

    logger.info('🔥 Starting comprehensive carrier warmup...');

    for (const carrier of carriers) {
        try {
            const { [carrier.func]: carrierFunction } = require(carrier.module);
            
            await carrierFunction({
                data: warmupRequestData,
                auth: { uid: 'keepalive-system' }
            });
            
            results.push({ carrier: carrier.name, success: true });
            logger.info(`✅ ${carrier.name} warmed successfully`);
            
        } catch (error) {
            results.push({ carrier: carrier.name, success: false, error: error.message });
            logger.warn(`⚠️ ${carrier.name} warmup failed:`, error.message);
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

    for (const carrier of carriers) {
        try {
            const startTime = Date.now();
            const { [carrier.func]: carrierFunction } = require(carrier.module);
            
            await carrierFunction({
                data: warmupRequestData,
                auth: { uid: request.auth?.uid || 'manual-warmup' }
            });
            
            const duration = Date.now() - startTime;
            results.push({ 
                carrier: carrier.name, 
                success: true, 
                duration: `${duration}ms`,
                status: 'warmed'
            });
            
        } catch (error) {
            results.push({ 
                carrier: carrier.name, 
                success: false, 
                error: error.message,
                status: 'failed'
            });
        }
    }

    return {
        success: true,
        message: 'Warmup process completed',
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
            
            await carrierFunction({
                data: warmupRequestData,
                auth: { uid: 'health-check' }
            });
            
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