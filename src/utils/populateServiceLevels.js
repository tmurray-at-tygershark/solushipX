const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc } = require('firebase/firestore');

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBVjPMcfPZvD7FNQaVJQzQzCZkqZcqCcBo",
    authDomain: "solushipx.firebaseapp.com",
    projectId: "solushipx",
    storageBucket: "solushipx.appspot.com",
    messagingSenderId: "1062821667623",
    appId: "1:1062821667623:web:b5b6c3c3c3c3c3c3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Load service levels data
const serviceLevelsData = require('./servicelevels-data.json');

async function populateServiceLevels() {
    try {
        console.log('🔄 Starting service levels population...');
        
        const serviceLevels = serviceLevelsData.serviceLevels;
        console.log(`📊 Found ${serviceLevels.length} service levels to populate`);
        
        for (const serviceLevel of serviceLevels) {
            const docId = `${serviceLevel.type}_${serviceLevel.code}`;
            
            const docData = {
                type: serviceLevel.type,
                code: serviceLevel.code,
                label: serviceLevel.label,
                description: serviceLevel.description,
                status: serviceLevel.enabled ? 'active' : 'inactive',
                sortOrder: serviceLevel.sortOrder,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            await setDoc(doc(db, 'serviceLevels', docId), docData);
            console.log(`✅ Added: ${serviceLevel.type} - ${serviceLevel.label}`);
        }
        
        console.log('🎉 Service levels population completed successfully!');
        
    } catch (error) {
        console.error('❌ Error populating service levels:', error);
    }
}

// Run the population
populateServiceLevels(); 