# SoluShipX

An AI-enhanced Transportation Management System (TMS) for intelligent shipment management.

## Configuration Setup

This application uses Firebase Functions for both production and development environments. All sensitive configuration is managed through Firebase Functions Config.

### Production Setup

1. Set up Firebase Functions configuration:
```bash
# Navigate to functions directory
cd functions

# Make the configuration script executable
chmod +x set-config.sh

# Edit the script with your actual values
nano set-config.sh

# Run the script to set Firebase Functions config
./set-config.sh
```

### Local Development Setup

1. Create a `.runtimeconfig.json` file in the `functions` directory:
```json
{
    "eshipplus": {
        "access_code": "your-access-code",
        "username": "your-username",
        "password": "your-password",
        "access_key": "your-access-key",
        "url": "https://www.eshipplus.com/services/eShipPlusWSv4.asmx"
    },
    "google": {
        "places_api_key": "your-places-api-key",
        "genai_api_key": "your-genai-api-key"
    },
    "openai": {
        "api_key": "your-openai-api-key",
        "api_url": "https://api.openai.com/v1/chat/completions"
    }
}
```

### Required Configuration Values

- **EShipPlus Configuration**
  - `eshipplus.access_code`: Your EShipPlus tenant code
  - `eshipplus.username`: Your EShipPlus username
  - `eshipplus.password`: Your EShipPlus password
  - `eshipplus.access_key`: Your EShipPlus access key
  - `eshipplus.url`: EShipPlus API endpoint

- **Google Configuration**
  - `google.places_api_key`: Google Places API key
  - `google.genai_api_key`: Google Generative AI API key

- **OpenAI Configuration**
  - `openai.api_key`: OpenAI API key
  - `openai.api_url`: OpenAI API endpoint

### Security Notes

1. Never commit `.runtimeconfig.json` to version control
2. Rotate API keys regularly
3. Use different API keys for development and production
4. Set appropriate restrictions on API keys
5. Monitor API usage and set up alerts

## Development

```bash
# Install dependencies
npm install

# Start local development server
npm run serve

# Deploy to production
npm run deploy
```

## API Documentation

[Add API documentation here]