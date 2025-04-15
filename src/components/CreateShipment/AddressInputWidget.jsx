import React, { useState, useEffect, useRef } from 'react';
import { Box, TextField, CircularProgress, Autocomplete } from '@mui/material';
import { styled } from '@mui/material/styles';

const AutocompleteContainer = styled(Box)(({ theme }) => ({
    position: 'relative',
    width: '100%',
    marginBottom: theme.spacing(2),
}));

const AddressInputWidget = ({ onAddressSelect, placeholder = 'Enter address...' }) => {
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const autocompleteService = useRef(null);
    const placesService = useRef(null);

    useEffect(() => {
        // Initialize Google Places services
        if (window.google && window.google.maps) {
            autocompleteService.current = new window.google.maps.places.AutocompleteService();
            placesService.current = new window.google.maps.places.PlacesService(
                document.createElement('div')
            );
        }
    }, []);

    const handleInputChange = async (event, newInputValue) => {
        setInputValue(newInputValue);

        if (!newInputValue || !autocompleteService.current) {
            setSuggestions([]);
            return;
        }

        setIsLoading(true);
        try {
            const response = await autocompleteService.current.getPlacePredictions({
                input: newInputValue,
                types: ['address'],
                componentRestrictions: { country: ['us', 'ca'] } // Allow US and Canada addresses
            });
            setSuggestions(response.predictions || []);
        } catch (error) {
            console.error('Error fetching suggestions:', error);
            setSuggestions([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSuggestionSelect = async (event, selectedSuggestion) => {
        if (!selectedSuggestion || !placesService.current) return;

        try {
            const place = await new Promise((resolve, reject) => {
                placesService.current.getDetails(
                    {
                        placeId: selectedSuggestion.place_id,
                        fields: [
                            'address_components',
                            'formatted_address',
                            'geometry',
                            'name',
                            'place_id'
                        ],
                    },
                    (result, status) => {
                        if (status === 'OK') resolve(result);
                        else reject(status);
                    }
                );
            });

            // Format the address components
            const addressComponents = place.address_components.reduce((acc, component) => {
                component.types.forEach(type => {
                    acc[type] = component.long_name;
                });
                return acc;
            }, {});

            const formattedAddress = {
                street: `${addressComponents.street_number || ''} ${addressComponents.route || ''}`.trim(),
                street2: addressComponents.subpremise || '',
                city: addressComponents.locality || addressComponents.sublocality || addressComponents.administrative_area_level_2 || '',
                state: addressComponents.administrative_area_level_1 || '',
                postalCode: addressComponents.postal_code || '',
                country: addressComponents.country || '',
                formatted_address: place.formatted_address,
                place_id: place.place_id,
                location: place.geometry.location
            };

            onAddressSelect(formattedAddress);
            setInputValue(place.formatted_address);
            setSuggestions([]);
        } catch (error) {
            console.error('Error fetching place details:', error);
        }
    };

    return (
        <AutocompleteContainer>
            <Autocomplete
                freeSolo
                options={suggestions}
                getOptionLabel={(option) =>
                    typeof option === 'string' ? option : option.description
                }
                value={inputValue}
                onChange={handleSuggestionSelect}
                onInputChange={handleInputChange}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        fullWidth
                        placeholder={placeholder}
                        variant="outlined"
                        InputProps={{
                            ...params.InputProps,
                            endAdornment: (
                                <>
                                    {isLoading && <CircularProgress size={20} />}
                                    {params.InputProps.endAdornment}
                                </>
                            ),
                        }}
                    />
                )}
            />
        </AutocompleteContainer>
    );
};

export default AddressInputWidget; 