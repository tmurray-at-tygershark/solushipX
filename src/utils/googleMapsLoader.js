import { getMapsApiKey } from './maps';

let loadingPromise = null;
let isLoaded = false;

export const loadGoogleMaps = async () => {
    if (isLoaded) {
        console.log('✅ [Loader] Google Maps API already loaded.');
        const drawingNs = await ensureDrawingLibrary(100, 250);
        return { maps: window.google.maps, drawing: drawingNs };
    }

    if (loadingPromise) {
        console.log('⏳ [Loader] Google Maps API already loading, returning existing promise.');
        return loadingPromise;
    }

    loadingPromise = new Promise(async (resolve, reject) => {
        try {
            const apiKey = await getMapsApiKey();

            if (window.google && window.google.maps) {
                console.log('✅ [Loader] Google Maps base API already present.');
                isLoaded = true;
                // Ensure drawing library is available even if base was loaded elsewhere
                const drawingNs = await ensureDrawingLibrary(100, 250);
                resolve({ maps: window.google.maps, drawing: drawingNs });
                return;
            }

            const script = document.createElement('script');
            // Use weekly channel to guarantee importLibrary availability and include required libraries
            script.src = `https://maps.googleapis.com/maps/api/js?v=weekly&key=${apiKey}&libraries=places,geometry,drawing`;
            script.async = true;
            script.defer = true;

            script.onload = async () => {
                console.log('✅ [Loader] Google Maps script loaded. Now waiting for drawing library...');
                isLoaded = true;
                const drawingNs = await ensureDrawingLibrary(100, 250);
                resolve({ maps: window.google.maps, drawing: drawingNs });
            };

            script.onerror = (error) => {
                console.error('❌ [Loader] Failed to load Google Maps API script:', error);
                loadingPromise = null;
                reject(new Error('Failed to load Google Maps API'));
            };

            document.head.appendChild(script);
            console.log('🚀 [Loader] Appending Google Maps script to head.');
        } catch (error) {
            console.error('❌ [Loader] Error during Google Maps API loading initialization:', error);
            loadingPromise = null;
            reject(error);
        }
    });

    return loadingPromise;
};

export const isGoogleMapsLoaded = () => isLoaded;

// Try multiple strategies to ensure the Drawing library is available
const ensureDrawingLibrary = async (maxAttempts, interval) => {
    // Strategy 1: Already present
    if (window.google?.maps?.drawing?.DrawingManager) {
        return window.google.maps.drawing;
    }

    // Strategy 2: New Loader API
    try {
        if (window.google?.maps?.importLibrary) {
            const drawingLib = await window.google.maps.importLibrary('drawing');
            // Some builds expose classes via returned namespace rather than window.google.maps.drawing
            if (drawingLib?.DrawingManager || window.google?.maps?.drawing?.DrawingManager) {
                return window.google.maps.drawing || drawingLib;
            }
        }
    } catch (e) {
        console.warn('⚠️ [Loader] importLibrary("drawing") failed or unavailable:', e);
    }

    // Strategy 3: Poll for drawing namespace (in case libraries finish loading slightly later)
    const ok = await waitForDrawingLibrary(maxAttempts, interval);
    return ok ? (window.google?.maps?.drawing || null) : null;
};

const waitForDrawingLibrary = (maxAttempts, interval) => {
    let attempts = 0;
    return new Promise((resolve) => {
        const checkDrawing = () => {
            // First check if drawing object exists, then if DrawingManager class is there
            if (window.google?.maps?.drawing && window.google.maps.drawing.DrawingManager) {
                console.log(`✅ [Loader] Drawing library (DrawingManager) class found after ${attempts} attempts.`);
                resolve(true);
            } else if (attempts < maxAttempts) {
                attempts++;
                // console.log(`⏳ [Loader] Waiting for drawing library... Attempt ${attempts}/${maxAttempts}`);
                setTimeout(checkDrawing, interval);
            } else {
                console.error(`❌ [Loader] Drawing library (DrawingManager) NOT found after ${maxAttempts} attempts.`);
                console.warn('Current state of window.google.maps.drawing:', window.google?.maps?.drawing);
                resolve(false);
            }
        };
        checkDrawing();
    });
}; 