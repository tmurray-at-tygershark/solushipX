import { getMapsApiKey } from './maps';

let loadingPromise = null;
let isLoaded = false;

export const loadGoogleMaps = async () => {
    // If already loaded, return immediately
    if (isLoaded) {
        return window.google.maps;
    }

    // If already loading, return the existing promise
    if (loadingPromise) {
        return loadingPromise;
    }

    // Start loading process
    loadingPromise = new Promise(async (resolve, reject) => {
        try {
            // Get API key
            const apiKey = await getMapsApiKey();

            // If Google Maps is already loaded, just resolve
            if (window.google && window.google.maps) {
                isLoaded = true;
                resolve(window.google.maps);
                return;
            }

            // Load Google Maps script
            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry`;
            script.async = true;
            script.defer = true;

            script.onload = () => {
                isLoaded = true;
                resolve(window.google.maps);
            };

            script.onerror = (error) => {
                loadingPromise = null;
                reject(new Error('Failed to load Google Maps API'));
            };

            document.head.appendChild(script);
        } catch (error) {
            loadingPromise = null;
            reject(error);
        }
    });

    return loadingPromise;
};

export const isGoogleMapsLoaded = () => isLoaded; 