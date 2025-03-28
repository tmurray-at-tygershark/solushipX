#!/bin/bash

# Set environment variables for Firebase Functions
firebase functions:config:set \
  eshipplus.access_code="your-access-code" \
  eshipplus.username="your-username" \
  eshipplus.password="your-password" \
  eshipplus.access_key="your-access-key" \
  google.places_api_key="your-google-places-api-key" \
  genkit.api_key="your-genkit-api-key" 