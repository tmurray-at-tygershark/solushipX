import { getFunctions, httpsCallable } from 'firebase/functions';
import { getMapsApiKey } from '../utils/maps';

class GooglePlacesService {
    constructor() {
        this.functions = getFunctions();
        this.apiKey = null;
        this.autocompleteService = null;
        this.placesService = null;
        this.sessionToken = null;
        this.distanceService = null;
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
            // Check if the input looks like a postal code
            const isPostalCodeSearch = /^[A-Za-z\d\s]{3,7}$/.test(input.trim());
            
            // If it looks like a postal code, prioritize postal code search
            const searchTypes = isPostalCodeSearch ? ['postal_code'] : ['address'];
            
            this.autocompleteService.getPlacePredictions(
                {
                    input,
                    types: searchTypes,
                    sessionToken: this.sessionToken,
                    componentRestrictions: { country: ['us', 'ca'] },
                    fields: ['address_components', 'formatted_address', 'geometry', 'name', 'place_id']
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

    validateAddress(placeDetails) {
        const components = placeDetails.addressComponents || [];
        const requiredComponents = {
            street_number: false,
            route: false,
            locality: false,
            administrative_area_level_1: false,
            country: false,
            postal_code: false
        };

        // Check for required components
        components.forEach(component => {
            component.types.forEach(type => {
                if (requiredComponents.hasOwnProperty(type)) {
                    requiredComponents[type] = true;
                }
            });
        });

        // Validate each required component
        const missingComponents = Object.entries(requiredComponents)
            .filter(([_, present]) => !present)
            .map(([type]) => type);

        if (missingComponents.length > 0) {
            return {
                isValid: false,
                error: `Missing required address components: ${missingComponents.join(', ')}`
            };
        }

        // Validate postal code format if present
        const postalCode = components.find(c => c.types.includes('postal_code'))?.long_name;
        if (postalCode && !this.validatePostalCode(postalCode)) {
            return {
                isValid: false,
                error: 'Invalid postal code format'
            };
        }

        return {
            isValid: true,
            error: null
        };
    }

    validatePostalCode(postalCode) {
        // Add postal code validation patterns for different countries
        const patterns = {
            US: /^\d{5}(-\d{4})?$/,
            CA: /^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$/,
            GB: /^[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}$/,
            // Add more country patterns as needed
        };

        // Default to US pattern if country is not specified
        return patterns.US.test(postalCode);
    }

    formatPlaceDetails(placeDetails) {
        const components = placeDetails.addressComponents || [];
        const formatted = {
            streetNumber: '',
            route: '',
            city: '',
            state: '',
            country: '',
            postalCode: '',
            formattedAddress: placeDetails.formatted_address || '',
            placeId: placeDetails.place_id,
            location: placeDetails.geometry?.location || null
        };

        components.forEach(component => {
            const value = component.long_name;
            component.types.forEach(type => {
                switch (type) {
                    case 'street_number':
                        formatted.streetNumber = value;
                        break;
                    case 'route':
                        formatted.route = value;
                        break;
                    case 'locality':
                        formatted.city = value;
                        break;
                    case 'administrative_area_level_1':
                        formatted.state = value;
                        break;
                    case 'country':
                        formatted.country = value;
                        break;
                    case 'postal_code':
                        formatted.postalCode = value;
                        break;
                }
            });
        });

        return formatted;
    }

    generateNewSessionToken() {
        this.sessionToken = new window.google.maps.places.AutocompleteSessionToken();
    }

    async verifyAddress(placeDetails) {
        try {
            // Check if the address is complete
            const validationResult = this.validateAddress(placeDetails);
            if (!validationResult.isValid) {
                return {
                    isDeliverable: false,
                    issues: [validationResult.error]
                };
            }

            // Check if the address is in a deliverable area
            const formattedAddress = this.formatPlaceDetails(placeDetails);
            
            // Check for common delivery issues
            const issues = [];
            
            // Check if it's a PO Box (some carriers don't deliver to PO Boxes)
            if (formattedAddress.formattedAddress.toLowerCase().includes('p.o. box') || 
                formattedAddress.formattedAddress.toLowerCase().includes('po box')) {
                issues.push('PO Box addresses may have delivery restrictions with some carriers');
            }
            
            // Check if it's a military base (may require special handling)
            if (formattedAddress.formattedAddress.toLowerCase().includes('afb') || 
                formattedAddress.formattedAddress.toLowerCase().includes('army base') ||
                formattedAddress.formattedAddress.toLowerCase().includes('naval base')) {
                issues.push('Military base addresses may require special handling and documentation');
            }
            
            // Check if it's in a remote area
            const isRemote = await this.checkIfRemoteArea(placeDetails);
            if (isRemote) {
                issues.push('This address appears to be in a remote area, which may affect delivery times and costs');
            }
            
            // Check if it's in a restricted country
            const restrictedCountries = ['North Korea', 'Iran', 'Syria', 'Cuba'];
            if (restrictedCountries.includes(formattedAddress.country)) {
                issues.push(`Shipping to ${formattedAddress.country} may be restricted by international regulations`);
            }

            return {
                isDeliverable: issues.length === 0,
                issues: issues.length > 0 ? issues : ['Address appears to be deliverable']
            };
        } catch (error) {
            console.error('Error verifying address:', error);
            return {
                isDeliverable: false,
                issues: ['Unable to verify address deliverability']
            };
        }
    }

    async checkIfRemoteArea(placeDetails) {
        // This is a simplified check - in a real implementation, you would:
        // 1. Check against a database of remote areas
        // 2. Use a service like Google Maps Distance Matrix API to check distance to nearest major city
        // 3. Check population density data
        
        // For now, we'll just check if the address contains keywords that might indicate a remote area
        const addressString = placeDetails.formatted_address.toLowerCase();
        const remoteKeywords = [
            'rural', 'route', 'county road', 'farm', 'ranch', 'cabin', 'cottage', 
            'wilderness', 'forest', 'mountain', 'desert', 'island', 'remote'
        ];
        
        return remoteKeywords.some(keyword => addressString.includes(keyword));
    }
}

export default new GooglePlacesService(); 