import { getFunctions, httpsCallable } from 'firebase/functions';
import { getMapsApiKey } from '../utils/maps';

class GooglePlacesService {
    constructor() {
        this.functions = getFunctions();
        this.apiKey = null;
        this.autocompleteService = null;
        this.placesService = null;
        this.sessionToken = null;
    }

    async initialize() {
        try {
            // Use the getMapsApiKey function from utils/maps.js
            this.apiKey = await getMapsApiKey();
            
            // Load Google Maps JavaScript API
            await this.loadGoogleMapsScript();
            
            // Initialize services
            this.autocompleteService = new window.google.maps.places.AutocompleteService();
            this.placesService = new window.google.maps.places.PlacesService(
                document.createElement('div')
            );
            
            return true;
        } catch (error) {
            console.error('Error initializing Google Places Service:', error);
            return false;
        }
    }

    loadGoogleMapsScript() {
        return new Promise((resolve, reject) => {
            if (window.google && window.google.maps) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${this.apiKey}&libraries=places`;
            script.async = true;
            script.defer = true;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    async getPlacePredictions(input, types = ['address']) {
        if (!this.autocompleteService) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            this.autocompleteService.getPlacePredictions(
                {
                    input,
                    types,
                    sessionToken: this.sessionToken
                },
                (predictions, status) => {
                    if (status === window.google.maps.places.PlacesServiceStatus.OK) {
                        resolve(predictions);
                    } else {
                        reject(new Error(`Places API Error: ${status}`));
                    }
                }
            );
        });
    }

    async getPlaceDetails(placeId) {
        if (!this.placesService) {
            await this.initialize();
        }

        return new Promise((resolve, reject) => {
            this.placesService.getDetails(
                {
                    placeId,
                    fields: [
                        'address_components',
                        'formatted_address',
                        'geometry',
                        'name',
                        'place_id'
                    ],
                    sessionToken: this.sessionToken
                },
                (place, status) => {
                    if (status === window.google.maps.places.PlacesServiceStatus.OK) {
                        resolve(this.formatPlaceDetails(place));
                    } else {
                        reject(new Error(`Places API Error: ${status}`));
                    }
                }
            );
        });
    }

    formatPlaceDetails(place) {
        const addressComponents = place.address_components.reduce((acc, component) => {
            acc[component.types[0]] = component.long_name;
            return acc;
        }, {});

        return {
            street: this.getStreetAddress(place.address_components),
            city: addressComponents.locality || addressComponents.administrative_area_level_2,
            state: addressComponents.administrative_area_level_1,
            postalCode: addressComponents.postal_code,
            country: addressComponents.country,
            formattedAddress: place.formatted_address,
            placeId: place.place_id,
            coordinates: {
                lat: place.geometry.location.lat(),
                lng: place.geometry.location.lng()
            }
        };
    }

    getStreetAddress(components) {
        const streetNumber = components.find(c => c.types.includes('street_number'))?.long_name || '';
        const route = components.find(c => c.types.includes('route'))?.long_name || '';
        return `${streetNumber} ${route}`.trim();
    }

    validatePostalCode(postalCode, country) {
        const postalCodePatterns = {
            US: /^\d{5}(-\d{4})?$/,
            CA: /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/,
            GB: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/,
            AU: /^\d{4}$/,
            DE: /^\d{5}$/,
            FR: /^\d{5}$/,
            IT: /^\d{5}$/,
            ES: /^\d{5}$/,
            JP: /^\d{3}-\d{4}$/,
            CN: /^\d{6}$/,
            IN: /^\d{6}$/,
            BR: /^\d{5}-\d{3}$/
        };

        const pattern = postalCodePatterns[country.toUpperCase()] || /^.+$/;
        return pattern.test(postalCode);
    }

    generateNewSessionToken() {
        this.sessionToken = new window.google.maps.places.AutocompleteSessionToken();
    }
}

export default new GooglePlacesService(); 