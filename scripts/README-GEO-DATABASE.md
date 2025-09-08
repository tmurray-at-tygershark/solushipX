# Geographic Locations Database for SolushipX

## Overview

This system imports and manages comprehensive geographic location data for the QuickShip zone mapping system. It includes ~500,000 Canadian postal codes and ~3,000,000 US zip codes with normalized data structure for efficient zone-based rate calculations.

## Database Structure

### Collections Created

1. **`geoLocations`** - Complete postal/zip code database
2. **`geoCities`** - Unique cities summary for faster lookups  
3. **`geoProvincesStates`** - Provinces/states summary for regional queries

### Data Schema

#### geoLocations Collection
```javascript
{
  // Location identification
  city: "Calgary",
  provinceState: "AB", 
  provinceStateName: "Alberta",
  country: "CA",
  countryName: "Canada",
  
  // Postal/Zip code
  postalZipCode: "T2E6M4",
  postalZipType: "postal", // or "zip"
  
  // Geographic coordinates
  latitude: 51.0478,
  longitude: -114.0585,
  
  // Search and filtering fields
  searchKey: "calgary-ab-ca",
  regionKey: "CA-AB",
  cityRegionKey: "calgary-ab-ca",
  
  // Zone mapping fields
  isCanada: true,
  isUS: false,
  isDomesticCanada: true,
  isDomesticUS: false,
  
  // Metadata
  dataSource: "canada-postal-codes",
  importedAt: "2024-01-15T10:30:00Z",
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

#### geoCities Collection
```javascript
{
  city: "Calgary",
  provinceState: "AB",
  provinceStateName: "Alberta", 
  country: "CA",
  countryName: "Canada",
  regionKey: "CA-AB",
  cityRegionKey: "calgary-ab-ca",
  isCanada: true,
  isUS: false,
  postalZipCodes: ["T2E6M4", "T2G2B3", ...],
  locationCount: 150,
  createdAt: Timestamp
}
```

#### geoProvincesStates Collection
```javascript
{
  provinceState: "AB",
  provinceStateName: "Alberta",
  country: "CA", 
  countryName: "Canada",
  regionKey: "CA-AB",
  isCanada: true,
  isUS: false,
  cities: ["Calgary", "Edmonton", "Red Deer", ...],
  cityCount: 85,
  locationCount: 12450,
  createdAt: Timestamp
}
```

## Usage Instructions

### 1. Test the Import (Recommended)

First, run the test script to validate the data structure:

```bash
node scripts/test-geo-import.js
```

This will:
- Test data normalization functions
- Analyze file sizes and import requirements
- Run a small batch import test
- Clean up test data
- Provide import estimates

### 2. Run the Full Import

After successful testing, run the full import:

```bash
node scripts/import-geographic-locations.js
```

**⚠️ Important Notes:**
- Import takes approximately 30-60 minutes
- Requires ~3.5M Firestore write operations
- Uses ~500MB of Firestore storage
- Clears existing geographic data (uncomment clearing section if needed)

### 3. Monitor Progress

The import script provides real-time progress updates:

```
🗺️  Starting Geographic Locations Import...
📍 Importing Canadian postal codes...
   📊 Found 497,570 Canadian locations
🚀 Starting batch import of 497,570 Canada locations...
   ⏳ Canada: 500/497,570 (0.1%) - Batch 1 committed
   ⏳ Canada: 1,000/497,570 (0.2%) - Batch 2 committed
   ...
✅ Canada import complete: 497,570 imported, 0 errors

📍 Importing US zip codes...
   📊 Found 2,920,970 US locations
   ...
✅ Import Complete!
🇨🇦 Canada: 497,570 locations imported
🇺🇸 USA: 2,920,970 locations imported
📊 Total: 3,418,540 locations
```

## Querying the Database

### Common Query Patterns

#### Find locations by city
```javascript
const locations = await db.collection('geoLocations')
  .where('cityRegionKey', '==', 'toronto-on-ca')
  .get();
```

#### Find all cities in a province/state
```javascript
const cities = await db.collection('geoCities')
  .where('regionKey', '==', 'CA-ON')
  .get();
```

#### Find domestic Canadian locations
```javascript
const canadianLocations = await db.collection('geoLocations')
  .where('isDomesticCanada', '==', true)
  .get();
```

#### Search locations by partial city name
```javascript
const locations = await db.collection('geoLocations')
  .where('searchKey', '>=', 'calg')
  .where('searchKey', '<=', 'calg\uf8ff')
  .get();
```

### Zone Mapping Integration

The geographic database integrates with the QuickShip zone mapping system:

#### Province-to-Province Zones
```javascript
// Find all cities in Ontario for pickup zone
const onCities = await db.collection('geoCities')
  .where('regionKey', '==', 'CA-ON')
  .get();

// Find all cities in Alberta for delivery zone  
const abCities = await db.collection('geoCities')
  .where('regionKey', '==', 'CA-AB')
  .get();
```

#### City-to-City Zones
```javascript
// Find specific city for exact zone matching
const fromCity = await db.collection('geoCities')
  .doc('toronto-on-ca')
  .get();

const toCity = await db.collection('geoCities')
  .doc('vancouver-bc-ca')
  .get();
```

#### Cross-Border Zones
```javascript
// Find Canadian provinces for cross-border pickup
const canadianRegions = await db.collection('geoProvincesStates')
  .where('isCanada', '==', true)
  .get();

// Find US states for cross-border delivery
const usRegions = await db.collection('geoProvincesStates')
  .where('isUS', '==', true)
  .get();
```

## Performance Optimization

### Indexes
The following composite indexes are recommended for optimal performance:

```javascript
// geoLocations collection
{country: 'asc', provinceState: 'asc', city: 'asc'}
{regionKey: 'asc', city: 'asc'}
{cityRegionKey: 'asc'}
{searchKey: 'asc'}
{isCanada: 'asc', isDomesticCanada: 'asc'}
{isUS: 'asc', isDomesticUS: 'asc'}

// geoCities collection  
{country: 'asc', provinceState: 'asc'}
{regionKey: 'asc'}
{cityRegionKey: 'asc'}
{isCanada: 'asc'}
{isUS: 'asc'}

// geoProvincesStates collection
{country: 'asc'}
{regionKey: 'asc'} 
{isCanada: 'asc'}
{isUS: 'asc'}
```

### Query Best Practices

1. **Use regionKey for province/state queries** - More efficient than country + provinceState
2. **Use cityRegionKey for exact city matches** - Fastest single-field lookup
3. **Use summary collections when possible** - geoCities and geoProvincesStates are pre-aggregated
4. **Limit query results** - Use `.limit()` for large result sets
5. **Use pagination** - For UI lists, implement cursor-based pagination

## File Structure

```
scripts/
├── import-geographic-locations.js    # Main import script
├── test-geo-import.js               # Testing and validation script
├── geo-import-config.json           # Configuration and documentation
└── README-GEO-DATABASE.md          # This file

Data files:
├── postal-codes-canada.json        # Canadian postal codes (~500K records)
└── postal-codes-usa.json          # US zip codes (~3M records)
```

## Integration with Zone Mapping

This geographic database powers the QuickShip zone mapping system:

1. **Zone Definition** - Carriers can select cities, provinces/states, or countries for their pickup and delivery zones
2. **Rate Calculation** - Rates are calculated based on origin and destination zones using this geographic data
3. **Address Validation** - Shipping addresses are validated against this comprehensive database
4. **Auto-Complete** - City and postal/zip code auto-complete functionality
5. **Distance Calculation** - Latitude/longitude data enables distance-based calculations

## Maintenance

### Updating Data
To update the geographic database with new postal/zip code data:

1. Replace the source JSON files
2. Run the import script again (will clear and reimport all data)
3. Verify data integrity with the test script

### Monitoring Storage
Monitor Firestore usage in the Firebase Console:
- Document count: ~3.4M documents
- Storage usage: ~500MB
- Read/write operations for billing

### Backup Strategy
Consider exporting geographic data for backup:

```bash
# Export collections (requires Firebase CLI)
firebase firestore:export gs://your-bucket/geo-backup
```

## Troubleshooting

### Common Issues

1. **Out of memory errors** - Reduce BATCH_SIZE in config
2. **Timeout errors** - Implement retry logic for failed batches  
3. **Index creation** - Firestore will auto-create indexes on first use
4. **Permission errors** - Ensure service account has Firestore write permissions

### Performance Issues

1. **Slow queries** - Add composite indexes for query patterns
2. **High costs** - Use summary collections instead of main collection when possible
3. **Large result sets** - Implement pagination and result limiting

For support, see the main SolushipX documentation or contact the development team.
