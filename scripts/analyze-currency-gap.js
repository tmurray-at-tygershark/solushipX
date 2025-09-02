const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = require('../functions/service-account.json');

initializeApp({
    credential: cert(serviceAccount),
    projectId: 'solushipx'
});

const db = getFirestore();

async function analyzeCurrencyGap() {
    console.log('🔍 CURRENCY BACKFILL ANALYSIS');
    console.log('============================\n');
    
    try {
        // Get all shipments to find date range
        console.log('📦 Loading all shipments...');
        const shipmentsSnapshot = await db.collection('shipments').get();
        console.log(`   Found ${shipmentsSnapshot.size} shipments\n`);
        
        let earliestDate = null;
        let latestDate = null;
        let totalShipments = 0;
        const shipmentsByYear = {};
        
        shipmentsSnapshot.docs.forEach(doc => {
            const shipment = doc.data();
            totalShipments++;
            
            // Check multiple date fields in priority order
            const dates = [
                shipment.bookedAt,
                shipment.createdAt,
                shipment.shipmentDate,
                shipment.scheduledDate
            ].filter(date => date);
            
            dates.forEach(dateField => {
                let dateValue;
                if (dateField && typeof dateField.toDate === 'function') {
                    dateValue = dateField.toDate();
                } else if (dateField instanceof Date) {
                    dateValue = dateField;
                } else if (typeof dateField === 'string') {
                    dateValue = new Date(dateField);
                }
                
                if (dateValue && !isNaN(dateValue.getTime())) {
                    if (!earliestDate || dateValue < earliestDate) {
                        earliestDate = dateValue;
                    }
                    if (!latestDate || dateValue > latestDate) {
                        latestDate = dateValue;
                    }
                    
                    // Group by year for analysis
                    const year = dateValue.getFullYear();
                    shipmentsByYear[year] = (shipmentsByYear[year] || 0) + 1;
                }
            });
        });
        
        console.log('📅 SHIPMENT DATE ANALYSIS:');
        console.log('─'.repeat(40));
        if (earliestDate) {
            console.log(`   Earliest shipment: ${earliestDate.toISOString().split('T')[0]}`);
            console.log(`   Latest shipment:   ${latestDate.toISOString().split('T')[0]}`);
            console.log(`   Date range: ${Math.ceil((latestDate - earliestDate) / (1000 * 60 * 60 * 24))} days`);
        } else {
            console.log('   No valid dates found in shipments');
        }
        
        console.log('\n📊 Shipments by year:');
        Object.keys(shipmentsByYear).sort().forEach(year => {
            console.log(`   ${year}: ${shipmentsByYear[year]} shipments`);
        });
        
        // Check current currency rates coverage
        console.log('\n💱 CURRENT CURRENCY RATES ANALYSIS:');
        console.log('─'.repeat(40));
        const ratesSnapshot = await db.collection('currencyRates').orderBy('timestamp', 'asc').get();
        console.log(`   Total currency records: ${ratesSnapshot.size}`);
        
        if (ratesSnapshot.size > 0) {
            const firstRate = ratesSnapshot.docs[0].data();
            const lastRate = ratesSnapshot.docs[ratesSnapshot.docs.length - 1].data();
            
            const firstRateDate = firstRate.timestamp?.toDate();
            const lastRateDate = lastRate.timestamp?.toDate();
            
            console.log(`   Earliest rate: ${firstRateDate ? firstRateDate.toISOString().split('T')[0] : 'Unknown'}`);
            console.log(`   Latest rate:   ${lastRateDate ? lastRateDate.toISOString().split('T')[0] : 'Unknown'}`);
            console.log(`   Provider: ${firstRate.provider || 'Unknown'}`);
            console.log(`   Base currency: ${firstRate.baseCurrency || 'Unknown'}`);
            console.log(`   Sample currencies: ${Object.keys(firstRate.rates || {}).slice(0, 5).join(', ')}...`);
            
            // Check for gaps
            if (earliestDate && firstRateDate) {
                if (earliestDate < firstRateDate) {
                    const gapDays = Math.ceil((firstRateDate - earliestDate) / (1000 * 60 * 60 * 24));
                    console.log('\n🚨 CURRENCY BACKFILL NEEDED:');
                    console.log('─'.repeat(40));
                    console.log(`   Gap detected: ${gapDays} days`);
                    console.log(`   Backfill from: ${earliestDate.toISOString().split('T')[0]}`);
                    console.log(`   Backfill to:   ${firstRateDate.toISOString().split('T')[0]}`);
                    
                    // Calculate years needing backfill
                    const backfillYears = [];
                    for (let year = earliestDate.getFullYear(); year <= firstRateDate.getFullYear(); year++) {
                        if (shipmentsByYear[year]) {
                            backfillYears.push(`${year} (${shipmentsByYear[year]} shipments)`);
                        }
                    }
                    console.log(`   Years needing backfill: ${backfillYears.join(', ')}`);
                    
                } else {
                    console.log('\n✅ CURRENCY COVERAGE ADEQUATE:');
                    console.log('─'.repeat(40));
                    console.log('   Currency rates cover all shipment dates');
                }
            }
            
            // Check for daily coverage gaps
            console.log('\n🔍 CHECKING DAILY COVERAGE:');
            console.log('─'.repeat(40));
            const ratesByDate = {};
            ratesSnapshot.docs.forEach(doc => {
                const data = doc.data();
                if (data.timestamp && data.success) {
                    const dateStr = data.timestamp.toDate().toISOString().split('T')[0];
                    ratesByDate[dateStr] = true;
                }
            });
            
            console.log(`   Unique rate dates: ${Object.keys(ratesByDate).length}`);
            
            if (firstRateDate && lastRateDate) {
                const totalDays = Math.ceil((lastRateDate - firstRateDate) / (1000 * 60 * 60 * 24)) + 1;
                const coverage = ((Object.keys(ratesByDate).length / totalDays) * 100).toFixed(1);
                console.log(`   Daily coverage: ${coverage}% (${Object.keys(ratesByDate).length}/${totalDays} days)`);
                
                if (coverage < 90) {
                    console.log(`   ⚠️  Consider implementing daily rate fetching`);
                }
            }
            
        } else {
            console.log('   No currency rates found!');
            console.log('\n🚨 CRITICAL: No currency data available');
            console.log('   Need to set up currency rate fetching system');
        }
        
        console.log('\n💡 RECOMMENDATIONS:');
        console.log('─'.repeat(40));
        if (earliestDate && ratesSnapshot.size > 0) {
            const firstRate = ratesSnapshot.docs[0].data();
            const firstRateDate = firstRate.timestamp?.toDate();
            
            if (earliestDate < firstRateDate) {
                console.log('1. Backfill historical rates for missing dates');
                console.log('2. Set up daily rate fetching to prevent future gaps');
                console.log('3. Consider using fallback rates for very old shipments');
            } else {
                console.log('1. Set up automated daily rate fetching');
                console.log('2. Monitor rate coverage regularly');
                console.log('3. Consider rate caching strategies');
            }
        } else {
            console.log('1. Set up initial currency rate system');
            console.log('2. Implement automated daily rate fetching');
            console.log('3. Backfill historical data as needed');
        }
        
    } catch (error) {
        console.error('Error analyzing currency gap:', error);
    }
}

analyzeCurrencyGap();
