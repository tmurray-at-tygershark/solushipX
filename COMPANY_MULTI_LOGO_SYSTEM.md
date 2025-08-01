# Company Multi-Logo System

## Overview
The SolushipX platform now supports multiple logo types for companies, allowing for optimal logo display across different contexts and backgrounds. This system includes three distinct logo types:

1. **Dark Background Logo** - For navigation bars, headers, and dark interfaces
2. **Light Background Logo** - For documents, invoices, and light interfaces  
3. **Circle Logo** - For avatars, favicons, and social media profiles

## Features

### 1. Multi-Logo Upload Interface
- Tabbed interface in Company Form for uploading different logo types
- Real-time preview with context-appropriate backgrounds
- Individual upload/delete functionality for each logo type
- Visual indicators showing which logos are uploaded

### 2. Smart Logo Selection
- Automatic logo selection based on usage context
- Fallback system ensures there's always a logo available
- Backward compatibility with existing single-logo companies

### 3. Organized Storage
- Separate Firebase Storage folders for each logo type
- Organized file naming: `{companyID}-{logoType}-{timestamp}.{extension}`
- Storage paths: `company-logos/dark/`, `company-logos/light/`, `company-logos/circle/`

## Database Structure

### Company Document Structure
```javascript
{
  // Legacy field (maintained for backward compatibility)
  logoUrl: 'https://firebasestorage.googleapis.com/...',
  
  // New multi-logo structure
  logos: {
    dark: 'https://firebasestorage.googleapis.com/v0/b/project/o/company-logos%2Fdark%2FCOMPANY-dark-1234567890.png',
    light: 'https://firebasestorage.googleapis.com/v0/b/project/o/company-logos%2Flight%2FCOMPANY-light-1234567890.png',
    circle: 'https://firebasestorage.googleapis.com/v0/b/project/o/company-logos%2Fcircle%2FCOMPANY-circle-1234567890.png'
  },
  
  // Other company fields...
  name: 'Company Name',
  companyID: 'COMPANY',
  status: 'active'
}
```

## Usage Guide

### 1. Using Logo Utilities
Import the logo utility functions:

```javascript
import { 
  getDarkBackgroundLogo, 
  getLightBackgroundLogo, 
  getCircleLogo,
  getLogoForContext 
} from '../utils/logoUtils';
```

### 2. Context-Specific Logo Selection

#### Navigation/Headers (Dark Background)
```javascript
const logoUrl = getDarkBackgroundLogo(company);
```

#### Documents/Invoices (Light Background)
```javascript
const logoUrl = getLightBackgroundLogo(company);
```

#### Avatars/Icons (Circle Logo)
```javascript
const logoUrl = getCircleLogo(company);
```

#### Automatic Context Detection
```javascript
const logoUrl = getLogoForContext(company, 'navigation'); // Uses dark logo
const logoUrl = getLogoForContext(company, 'avatar');     // Uses circle logo
const logoUrl = getLogoForContext(company, 'document');   // Uses light logo
```

### 3. Component Implementation Examples

#### Dashboard Navigation
```javascript
<img
  src={getDarkBackgroundLogo(companyData) || "/images/default-logo.png"}
  alt={companyData?.name || "Company"}
  style={{ height: 50, objectFit: 'contain' }}
/>
```

#### Company Avatar
```javascript
<Avatar
  src={getCircleLogo(company)}
  sx={{ width: 40, height: 40 }}
>
  <BusinessIcon />
</Avatar>
```

#### Document/Invoice Logo
```javascript
<img
  src={getLightBackgroundLogo(company)}
  alt={company.name}
  style={{ maxHeight: 60, objectFit: 'contain' }}
/>
```

## Available Utility Functions

### Core Functions
- `getCompanyLogo(company, context, fallbackType)` - Get logo with custom context
- `getDarkBackgroundLogo(company)` - Get logo for dark backgrounds
- `getLightBackgroundLogo(company)` - Get logo for light backgrounds  
- `getCircleLogo(company)` - Get circle logo for avatars
- `getLogoForContext(company, uiContext)` - Get logo based on UI context string

### Helper Functions
- `getLogoAvailability(company)` - Check which logos are available
- `getBestAvailableLogo(company, preferenceOrder)` - Get best logo with custom preference
- `LOGO_TYPE_INFO` - Metadata about each logo type

## Context Mappings

The system automatically maps UI contexts to appropriate logo types:

### Dark Background Contexts
- `navigation`, `header`, `sidebar`, `footer-dark`, `dark-theme`

### Light Background Contexts  
- `document`, `invoice`, `email`, `report`, `card`, `modal`, `form`, `table`, `footer-light`, `light-theme`

### Circle Logo Contexts
- `avatar`, `profile`, `favicon`, `icon`, `badge`, `chip`

## Migration Guide

### Existing Components
1. Replace direct logo URL access with utility functions
2. Choose appropriate logo type for your component's context
3. Test with companies that have/don't have specific logo types

### Before (Legacy)
```javascript
const logoUrl = company.logoUrl || company.logo || company.logoURL;
```

### After (Multi-Logo)
```javascript
const logoUrl = getDarkBackgroundLogo(company); // For dark backgrounds
const logoUrl = getLightBackgroundLogo(company); // For light backgrounds
const logoUrl = getCircleLogo(company); // For avatars
```

## Backward Compatibility

The system maintains full backward compatibility:
- Companies with only legacy `logoUrl` continue to work
- Legacy logos are used as fallbacks for missing logo types
- Dark logo defaults to legacy logo if available
- Gradual migration path allows updating components over time

## File Size and Format Guidelines

- **Maximum file size**: 5MB per logo
- **Supported formats**: JPEG, PNG, GIF, WebP
- **Recommended size**: 400x400 pixels or larger
- **Circle logos**: Should work well when cropped to circular shape
- **Dark logos**: Should be visible on dark backgrounds (white/light colored)
- **Light logos**: Should be visible on light backgrounds (dark colored)

## Best Practices

1. **Upload all three logo types** for optimal display across contexts
2. **Design circle logos** to work well in circular crop (avoid text at edges)
3. **Test dark logos** on dark backgrounds and light logos on light backgrounds
4. **Use appropriate utility functions** rather than direct logo URL access
5. **Provide fallbacks** in your components for missing logos
6. **Consider color contrast** when designing logos for specific backgrounds

## Admin Interface

### Company Form Features
- Tabbed interface for each logo type
- Context-appropriate preview backgrounds
- Upload progress and success indicators
- Individual delete functionality
- Visual confirmation of uploaded logos

### Logo Tab Interface
- **Dark Background Tab**: Preview on dark background (#1f2937)
- **Light Background Tab**: Preview on white background (#ffffff)  
- **Circle Logo Tab**: Preview as circular avatar (#f3f4f6)
- Success indicators showing which logos are uploaded
- Context descriptions explaining usage scenarios

This multi-logo system provides a professional, flexible approach to company branding across the entire SolushipX platform while maintaining backward compatibility and ease of use.