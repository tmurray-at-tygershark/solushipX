import React from 'react';
import CreateShipmentPage from './CreateShipment/CreateShipmentPage';
import { ShipmentFormProvider } from '../contexts/ShipmentFormContext';
import { getFunctions, httpsCallable } from 'firebase/functions';

// API key should be loaded from environment variables with a fallback
const RAW_API_KEY = process.env.REACT_APP_SOLUSHIPX_API_KEY || 'e61c3e150511db70aa0f2d2476ab8511';
const API_KEY = RAW_API_KEY ? RAW_API_KEY.trim() : 'e61c3e150511db70aa0f2d2476ab8511';

// Main component wrapper that uses the ShipmentFormProvider context
const CreateShipmentPageWrapper = () => {
    return (
        <ShipmentFormProvider>
            <CreateShipmentPage apiKey={API_KEY} />
        </ShipmentFormProvider>
    );
};

export default CreateShipmentPageWrapper; 