import { loadGoogleMaps } from '../utils/googleMapsLoader';

useEffect(() => {
    const initializeAutocomplete = async () => {
        try {
            const maps = await loadGoogleMaps();
            const input = document.getElementById('address-input');
            if (input) {
                const autocomplete = new maps.places.Autocomplete(input, {
                    types: ['address'],
                    componentRestrictions: { country: 'us' }
                });

                autocomplete.addListener('place_changed', () => {
                    const place = autocomplete.getPlace();
                    if (place.geometry) {
                        const addressComponents = {};
                        place.address_components.forEach(component => {
                            const type = component.types[0];
                            addressComponents[type] = component.long_name;
                        });

                        const formattedAddress = {
                            street: addressComponents.street_number 
                                ? `${addressComponents.street_number} ${addressComponents.route || ''}`.trim()
                                : addressComponents.route || '',
                            city: addressComponents.locality || addressComponents.administrative_area_level_2 || '',
                            state: addressComponents.administrative_area_level_1 || '',
                            postalCode: addressComponents.postal_code || '',
                            country: addressComponents.country || '',
                            formattedAddress: place.formatted_address
                        };

                        onAddressSelect(formattedAddress);
                    }
                });
            }
        } catch (error) {
            console.error('Error initializing Google Places Autocomplete:', error);
        }
    };

    initializeAutocomplete();
}, [onAddressSelect]); 