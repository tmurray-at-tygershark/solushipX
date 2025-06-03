import { LicenseInfo } from '@mui/x-license';

// Set MUI X License Key immediately when this module is loaded
LicenseInfo.setLicenseKey(process.env.REACT_APP_MUI_X_LICENSE_KEY || '');
 
export default true; 