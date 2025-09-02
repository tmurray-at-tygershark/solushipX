const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

// Initialize Firebase Admin
const serviceAccount = require('../functions/service-account.json');

initializeApp({
    credential: cert(serviceAccount),
    projectId: 'solushipx'
});

const db = getFirestore();

async function checkTemspecCustomers() {
    console.log('🔍 CHECKING TEMSPEC CUSTOMERS IN DATABASE');
    console.log('==========================================\n');
    
    try {
        // Get all customers
        console.log('👥 Loading all customers...');
        const customersSnapshot = await db.collection('customers').get();
        
        console.log(`📊 Found ${customersSnapshot.size} total customers\n`);
        
        // Find TEMSPEC-related customers
        const temspecCustomers = [];
        const allCustomers = {};
        
        customersSnapshot.docs.forEach(doc => {
            const customer = { id: doc.id, ...doc.data() };
            allCustomers[doc.id] = customer;
            
            // Check if customer is TEMSPEC-related
            const searchableText = JSON.stringify(customer).toLowerCase();
            if (searchableText.includes('temspec')) {
                temspecCustomers.push(customer);
            }
        });
        
        console.log(`🎯 Found ${temspecCustomers.length} TEMSPEC-related customers:`);
        console.log('='.repeat(60));
        
        temspecCustomers.forEach((customer, index) => {
            console.log(`\n📋 Customer ${index + 1}:`);
            console.log(`  ID (Document): "${customer.id}"`);
            console.log(`  CustomerID: "${customer.customerID || 'NOT SET'}"`);
            console.log(`  Name: "${customer.name || customer.companyName || 'NOT SET'}"`);
            console.log(`  Company: "${customer.companyName || 'NOT SET'}"`);
            console.log(`  Company ID: "${customer.companyId || customer.companyID || 'NOT SET'}"`);
        });
        
        // Check the three customer IDs we found in shipments
        console.log('\n\n🔍 CHECKING SPECIFIC CUSTOMER IDS FROM SHIPMENTS:');
        console.log('='.repeat(60));
        
        const shipmentCustomerIds = ['TEMSPE', '65MQ6skvMVZ6Z9Zj2Sk5', 'ULDN1uchaFsc4e30xZQZ'];
        
        for (const customerId of shipmentCustomerIds) {
            console.log(`\n🔍 Checking customer ID: "${customerId}"`);
            
            // Check if it exists as document ID
            if (allCustomers[customerId]) {
                const customer = allCustomers[customerId];
                console.log(`  ✅ Found as document ID:`);
                console.log(`    Name: "${customer.name || customer.companyName || 'NOT SET'}"`);
                console.log(`    CustomerID field: "${customer.customerID || 'NOT SET'}"`);
            } else {
                // Check if it exists as customerID field
                const customerByField = Object.values(allCustomers).find(c => c.customerID === customerId);
                if (customerByField) {
                    console.log(`  ✅ Found as customerID field:`);
                    console.log(`    Document ID: "${customerByField.id}"`);
                    console.log(`    Name: "${customerByField.name || customerByField.companyName || 'NOT SET'}"`);
                } else {
                    console.log(`  ❌ NOT FOUND in customers collection`);
                }
            }
        }
        
        // Suggest the correct customer value for the dropdown
        console.log('\n\n💡 SOLUTION:');
        console.log('='.repeat(30));
        
        const temspecMainCustomer = temspecCustomers.find(c => 
            c.customerID === 'TEMSPE' || 
            c.id === 'TEMSPE' ||
            (c.name && c.name.toLowerCase().includes('temspec'))
        );
        
        if (temspecMainCustomer) {
            console.log(`✅ Use this customer in the dropdown:`);
            console.log(`   Customer ID: "${temspecMainCustomer.customerID || temspecMainCustomer.id}"`);
            console.log(`   Display Name: "${temspecMainCustomer.name || temspecMainCustomer.companyName}"`);
        } else {
            console.log(`❌ No clear TEMSPEC customer found in customers collection`);
            console.log(`💡 The shipments reference customer IDs that don't exist as customers`);
            console.log(`   This explains why the dropdown filter doesn't work`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
    }
}

checkTemspecCustomers();
