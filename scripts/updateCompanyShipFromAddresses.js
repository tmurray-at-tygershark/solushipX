const admin = require('firebase-admin');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

// Check if service account file exists
const serviceAccountPath = path.join(__dirname, 'service-account.json');
let serviceAccount;

try {
  if (fs.existsSync(serviceAccountPath)) {
    serviceAccount = require(serviceAccountPath);
    console.log('Using service account file for authentication');
  } else {
    console.error('Service account file not found. Please place your service-account.json file in the scripts directory.');
    process.exit(1);
  }
} catch (error) {
  console.error('Error loading service account:', error);
  process.exit(1);
}

// Initialize Firebase Admin with service account
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// Sample addresses to add to each company
const additionalAddresses = [
  {
    id: uuidv4(),
    name: 'Warehouse',
    company: 'SolushipX Inc.',
    street: '456 Industrial Ave',
    city: 'Oakland',
    state: 'CA',
    postalCode: '94623',
    country: 'US',
    contactName: 'Jane Smith',
    contactPhone: '510-555-0124',
    contactEmail: 'jane@solushipx.com',
    isDefault: false
  },
  {
    id: uuidv4(),
    name: 'Distribution Center',
    company: 'SolushipX Inc.',
    street: '789 Logistics Blvd',
    city: 'San Jose',
    state: 'CA',
    postalCode: '95112',
    country: 'US',
    contactName: 'Mike Johnson',
    contactPhone: '408-555-0125',
    contactEmail: 'mike@solushipx.com',
    isDefault: false
  },
  {
    id: uuidv4(),
    name: 'Retail Store',
    company: 'SolushipX Inc.',
    street: '321 Market St',
    city: 'San Francisco',
    state: 'CA',
    postalCode: '94103',
    country: 'US',
    contactName: 'Sarah Williams',
    contactPhone: '415-555-0126',
    contactEmail: 'sarah@solushipx.com',
    isDefault: false
  }
];

async function updateCompanyShipFromAddresses() {
  console.log('Starting company ship from addresses update...');
  
  try {
    // Get all companies
    const companiesSnapshot = await db.collection('companies').get();
    console.log(`Found ${companiesSnapshot.size} companies`);

    let updatedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const doc of companiesSnapshot.docs) {
      try {
        const companyData = doc.data();
        const companyId = doc.id;
        const companyName = companyData.name || 'Unknown Company';
        
        console.log(`Processing company: ${companyName} (${companyId})`);
        
        // Check if company already has ship from addresses
        if (companyData.shipFromAddresses && companyData.shipFromAddresses.length > 0) {
          console.log(`Company ${companyName} already has ${companyData.shipFromAddresses.length} addresses`);
          
          // Check if we need to add more addresses
          if (companyData.shipFromAddresses.length >= 4) {
            console.log(`Skipping company ${companyName} - already has enough addresses`);
            skippedCount++;
            continue;
          }
          
          // Create new addresses with company-specific information
          const companySpecificAddresses = additionalAddresses.map(addr => ({
            ...addr,
            id: uuidv4(),
            company: companyName
          }));
          
          // Add only the needed number of addresses to reach 4 total
          const addressesToAdd = companySpecificAddresses.slice(0, 4 - companyData.shipFromAddresses.length);
          
          // Update company document with additional addresses
          await doc.ref.update({
            shipFromAddresses: [...companyData.shipFromAddresses, ...addressesToAdd]
          });
          
          console.log(`Added ${addressesToAdd.length} addresses to company ${companyName}`);
          updatedCount++;
        } else {
          // Create default address from company data
          const defaultAddress = {
            id: uuidv4(),
            name: 'Headquarters',
            company: companyName,
            street: companyData.address?.street || '',
            street2: companyData.address?.street2 || '',
            city: companyData.address?.city || '',
            state: companyData.address?.state || '',
            postalCode: companyData.address?.postalCode || '',
            country: companyData.address?.country || 'US',
            contactName: companyData.contact?.name || '',
            contactPhone: companyData.contact?.phone || '',
            contactEmail: companyData.contact?.email || '',
            isDefault: true
          };
          
          // Create company-specific additional addresses
          const companySpecificAddresses = additionalAddresses.map(addr => ({
            ...addr,
            id: uuidv4(),
            company: companyName
          }));
          
          // Update company document with addresses
          await doc.ref.update({
            shipFromAddresses: [defaultAddress, ...companySpecificAddresses]
          });
          
          console.log(`Added ${companySpecificAddresses.length + 1} addresses to company ${companyName}`);
          updatedCount++;
        }
      } catch (error) {
        console.error(`Error updating company ${doc.id}:`, error);
        errorCount++;
      }
    }

    console.log('\nUpdate completed:');
    console.log(`- Companies processed: ${companiesSnapshot.size}`);
    console.log(`- Companies updated: ${updatedCount}`);
    console.log(`- Companies skipped: ${skippedCount}`);
    console.log(`- Errors encountered: ${errorCount}`);

  } catch (error) {
    console.error('Error updating companies:', error);
  } finally {
    // Clean up Firebase Admin
    admin.app().delete();
  }
}

// Run the update
updateCompanyShipFromAddresses()
  .then(() => console.log('Script completed'))
  .catch(error => console.error('Script failed:', error)); 