# Firebase Functions v1 to v2 Migration

## Overview

Firebase has introduced a new version of Cloud Functions (v2) with improved features, better reliability, and more configuration options. This document outlines our migration strategy to move from v1 to v2 gradually without disruption.

## Why Migrate?

- **Better Performance**: v2 functions have more configuration options for memory, CPU, and timeout settings.
- **Enhanced Security**: Improved security features and isolation.
- **Future Compatibility**: v1 will eventually be deprecated; staying current ensures long-term support.
- **Cost Optimization**: More granular resource control can lead to cost savings.

## Migration Strategy

Because Firebase doesn't allow direct upgrades from v1 to v2 functions with the same name, we're adopting a phased approach:

1. **Dual Deployment**: 
   - Keep the v1 function (`getRatesEShipPlus`) for backward compatibility
   - Deploy a new v2 function with a different name (`getRatesEShipPlusV2`)

2. **Client Updates**:
   - Update client code to use the v2 function name
   - Example change in client code:
     ```javascript
     // Old v1 way
     const getRatesFunction = httpsCallable(functions, 'getRatesEShipPlus');
     
     // New v2 way
     const getRatesFunction = httpsCallable(functions, 'getRatesEShipPlusV2');
     ```

3. **Testing Phase**:
   - Test to ensure v2 functions work identically to v1 functions
   - Address any compatibility issues or performance differences

4. **Complete Migration**:
   - Once all clients are updated to use v2 functions, v1 functions can be safely removed
   - This may require a future Firebase deployment to remove old functions

## Current Status

- The v2 function `getRatesEShipPlusV2` has been deployed and is ready for use
- The `CreateShipment/Rates.jsx` component has been updated to use the v2 function
- All new client code should use the v2 function going forward

## Implementation Notes

- The functionality between v1 and v2 functions is identical - only the deployment mechanism has changed
- V2 functions have better error handling and more consistent behavior
- If you encounter any issues with the v2 function, the v1 function can be used as a fallback until issues are resolved

## Timeline

- **Phase 1** (Complete): Deploy v2 function alongside v1
- **Phase 2** (Current): Update client code to use v2 function
- **Phase 3** (Future): Monitor usage and resolve any issues
- **Phase 4** (Planned): Remove v1 function once all clients are migrated

## Best Practices

When calling Firebase Functions:

```javascript
import { getFunctions, httpsCallable } from 'firebase/functions';

// Get a reference to the Firebase Functions
const functions = getFunctions();

// Call the v2 function
const getRatesFunction = httpsCallable(functions, 'getRatesEShipPlusV2');

// Make the function call
const result = await getRatesFunction(data);

// Handle the result
const responseData = result.data;
``` 