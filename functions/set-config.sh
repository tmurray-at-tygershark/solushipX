#!/bin/bash

# Script to set Firebase Functions configuration
# WARNING: These credentials are compromised and should be rotated soon!

firebase functions:config:set \
    eshipplus.access_code="TENANT1" \
    eshipplus.username="ryan.blakey" \
    eshipplus.password="Reynard123$" \
    eshipplus.access_key="a33b98de-a066-4766-ac9e-1eab39ce6806" \
    eshipplus.url="https://cloudstaging.eshipplus.com/services/rest/RateShipment.aspx" \
    google.places_api_key="AIzaSyCE80gPZn-Li7V88a-7pzAW1U2fqkcxJsg" \
    google.genai_api_key="AIzaSyCE80gPZn-Li7V88a-7pzAW1U2fqkcxJsg" \
    openai.api_key="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" \
    openai.api_url="https://api.openai.com/v1/chat/completions"

# After setting config, you can view it with:
echo "Configuration set! You can view it with: firebase functions:config:get"
echo "IMPORTANT: Re-deploy your functions (e.g., npm run deploy:functions) for changes to take effect." 