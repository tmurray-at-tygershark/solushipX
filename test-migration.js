const { initializeApp } = require('firebase/app');
const { getFunctions, httpsCallable } = require('firebase/functions');

// Initialize Firebase
const firebaseConfig = {
    projectId: 'solushipx'
};

const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);

async function runMigration() {
    try {
        console.log('🔄 Starting migration to collection-based notification system...');
        
        // Call the migration function for IC company
        const migrateToCollectionSystem = httpsCallable(functions, 'migrateToCollectionSystem');
        
        const result = await migrateToCollectionSystem({
            companyId: 'IC'
        });
        
        console.log('✅ Migration completed successfully!');
        console.log(`📊 Migrated ${result.data.migratedCount} subscription records`);
        console.log('📝 Details:', result.data);
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Full error:', error);
    }
}

// Run the migration
runMigration(); 