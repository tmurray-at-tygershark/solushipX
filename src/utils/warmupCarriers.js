import { getFunctions, httpsCallable } from 'firebase/functions';

/**
 * Client-side carrier warm-up utility
 * Helps prevent cold start issues by pre-warming carriers before rate requests
 */

/**
 * Warm up eShip Plus function to prevent cold start
 * @param {boolean} force - Force warmup even if recently warmed
 * @returns {Promise<Object>} - Warmup result
 */
export async function warmupEShipPlus(force = false) {
    // Check if we've warmed up recently (within last 3 minutes)
    const lastWarmup = localStorage.getItem('eshipplus_last_warmup');
    const now = Date.now();
    
    if (!force && lastWarmup && (now - parseInt(lastWarmup)) < 180000) { // 3 minutes
        console.log('🔥 eShip Plus recently warmed, skipping warmup');
        return { success: true, cached: true, lastWarmup: new Date(parseInt(lastWarmup)) };
    }
    
    try {
        console.log('🔥 Warming up eShip Plus function...');
        const startTime = Date.now();
        
        const functions = getFunctions();
        const warmupFunction = httpsCallable(functions, 'getRatesEShipPlus');
        
        // Send warmup request
        const result = await warmupFunction({
            _isWarmupRequest: true,
            timestamp: now
        });
        
        const duration = Date.now() - startTime;
        console.log(`🔥 eShip Plus warmup completed in ${duration}ms`);
        
        // Store warmup timestamp
        localStorage.setItem('eshipplus_last_warmup', now.toString());
        
        return {
            success: true,
            duration,
            timestamp: new Date(),
            cached: false
        };
        
    } catch (error) {
        console.warn('⚠️ eShip Plus warmup failed:', error.message);
        // Don't fail the process if warmup fails
        return {
            success: false,
            error: error.message,
            timestamp: new Date()
        };
    }
}

/**
 * Smart warmup strategy that warms carriers based on shipment data
 * @param {Object} shipmentData - Shipment information to determine which carriers to warm
 * @returns {Promise<Object>} - Warmup results
 */
export async function smartWarmupCarriers(shipmentData) {
    const results = {};
    
    // Determine if we need eShip Plus based on shipment type
    const isFreightShipment = shipmentData?.shipmentInfo?.shipmentType === 'freight';
    const isLargePackage = shipmentData?.packages?.some(pkg => 
        pkg.weight > 150 || 
        (pkg.length * pkg.width * pkg.height) > 10000
    );
    
    if (isFreightShipment || isLargePackage) {
        console.log('🚛 Freight shipment detected, warming up eShip Plus...');
        results.eShipPlus = await warmupEShipPlus();
    }
    
    return {
        success: Object.values(results).some(r => r.success),
        results,
        timestamp: new Date()
    };
}

/**
 * Check if carriers need warming up based on usage patterns
 * @returns {Promise<Object>} - Health check results
 */
export async function checkCarrierTemperature() {
    try {
        const functions = getFunctions();
        const healthCheck = httpsCallable(functions, 'carrierHealthCheck');
        
        const result = await healthCheck({});
        console.log('🌡️ Carrier temperature check:', result.data);
        
        return result.data;
        
    } catch (error) {
        console.warn('⚠️ Carrier health check failed:', error.message);
        return {
            success: false,
            error: error.message,
            carriers: []
        };
    }
}

/**
 * Pre-emptive warmup strategy for optimal performance
 * Call this when user starts interacting with rate forms
 */
export async function preemptiveWarmup() {
    console.log('🚀 Starting preemptive carrier warmup...');
    
    try {
        // Check current temperature first
        const healthCheck = await checkCarrierTemperature();
        
        // Warm up cold carriers
        const warmupPromises = [];
        
        if (healthCheck.carriers) {
            const eShipPlusHealth = healthCheck.carriers.find(c => c.carrier === 'eShipPlus');
            
            if (!eShipPlusHealth || eShipPlusHealth.status === 'cold' || eShipPlusHealth.status === 'error') {
                console.log('🔥 eShip Plus is cold, warming up...');
                warmupPromises.push(warmupEShipPlus(true));
            }
        }
        
        const results = await Promise.allSettled(warmupPromises);
        
        return {
            success: true,
            healthCheck,
            warmupResults: results.map(r => r.status === 'fulfilled' ? r.value : { success: false, error: r.reason?.message })
        };
        
    } catch (error) {
        console.warn('⚠️ Preemptive warmup failed:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
} 