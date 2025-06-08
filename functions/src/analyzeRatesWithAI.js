const { onCall } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');

exports.analyzeRatesWithAI = onCall({
    cors: true,
    timeoutSeconds: 60,
    memory: "512MiB",
    region: 'us-central1'
}, async (request) => {
    try {
        const { rates } = request.data;
        
        if (!rates || !Array.isArray(rates) || rates.length === 0) {
            throw new Error('No valid rates provided for analysis');
        }

        logger.info(`Analyzing ${rates.length} rates with AI`);

        // Format rates for analysis
        const formattedRates = rates.map((rate, index) => ({
            index: index + 1,
            carrier: rate.carrier || rate.carrierName || 'Unknown',
            service: rate.serviceLevel || rate.serviceMode || rate.service || 'Standard',
            cost: rate.totalCharges || rate.total || 0,
            transitDays: rate.transitDays || rate.transitTime || 'Unknown',
            estimatedDelivery: rate.estimatedDelivery || rate.estimatedDeliveryDate || 'Not specified',
            guaranteedService: rate.guaranteedService || false,
            guaranteeCharge: rate.guaranteeCharge || rate.guaranteedAmount || 0,
            baseRate: rate.baseRate || rate.freightCharges || 0,
            fuelSurcharge: rate.fuelSurcharge || rate.fuelCharges || 0,
            accessorials: rate.accessorials || []
        }));

        // Sort rates by cost for analysis
        const sortedByCost = [...formattedRates].sort((a, b) => a.cost - b.cost);
        const sortedBySpeed = [...formattedRates].filter(r => r.transitDays !== 'Unknown')
            .sort((a, b) => parseInt(a.transitDays) - parseInt(b.transitDays));

        // Calculate statistics
        const costs = formattedRates.map(r => r.cost).filter(c => c > 0);
        const avgCost = costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
        const minCost = Math.min(...costs);
        const maxCost = Math.max(...costs);
        const costRange = maxCost - minCost;
        const costSavings = maxCost - minCost;

        // Analyze transit times
        const transitTimes = formattedRates
            .map(r => parseInt(r.transitDays))
            .filter(t => !isNaN(t));
        const avgTransit = transitTimes.length > 0 
            ? transitTimes.reduce((sum, time) => sum + time, 0) / transitTimes.length 
            : 0;

        // Generate intelligent analysis
        let analysis = `# 🚚 **AI Rate Analysis Report**\n\n`;
        
        analysis += `## 📊 **Summary Statistics**\n`;
        analysis += `- **Total Rates Analyzed:** ${formattedRates.length}\n`;
        analysis += `- **Average Cost:** $${avgCost.toFixed(2)}\n`;
        analysis += `- **Cost Range:** $${minCost.toFixed(2)} - $${maxCost.toFixed(2)}\n`;
        analysis += `- **Potential Savings:** $${costSavings.toFixed(2)} (${((costSavings/maxCost)*100).toFixed(1)}%)\n`;
        if (avgTransit > 0) {
            analysis += `- **Average Transit Time:** ${avgTransit.toFixed(1)} days\n`;
        }
        analysis += `\n`;

        // Cost Analysis
        analysis += `## 💰 **Cost Analysis**\n\n`;
        analysis += `### **Most Economical Options:**\n`;
        sortedByCost.slice(0, 3).forEach((rate, index) => {
            const savingsFromMax = maxCost - rate.cost;
            const percentSavings = ((savingsFromMax / maxCost) * 100).toFixed(1);
            analysis += `${index + 1}. **${rate.carrier}** - ${rate.service}\n`;
            analysis += `   - Cost: $${rate.cost.toFixed(2)}`;
            if (savingsFromMax > 0) {
                analysis += ` *(Save $${savingsFromMax.toFixed(2)} - ${percentSavings}%)*`;
            }
            analysis += `\n`;
            if (rate.transitDays !== 'Unknown') {
                analysis += `   - Transit: ${rate.transitDays} days\n`;
            }
            if (rate.guaranteedService) {
                analysis += `   - ✅ Guaranteed Service (+$${rate.guaranteeCharge.toFixed(2)})\n`;
            }
            analysis += `\n`;
        });

        // Speed Analysis
        if (sortedBySpeed.length > 0) {
            analysis += `## ⚡ **Speed Analysis**\n\n`;
            analysis += `### **Fastest Delivery Options:**\n`;
            sortedBySpeed.slice(0, 3).forEach((rate, index) => {
                const costPremium = rate.cost - minCost;
                const percentPremium = minCost > 0 ? ((costPremium / minCost) * 100).toFixed(1) : '0';
                analysis += `${index + 1}. **${rate.carrier}** - ${rate.service}\n`;
                analysis += `   - Transit: ${rate.transitDays} days\n`;
                analysis += `   - Cost: $${rate.cost.toFixed(2)}`;
                if (costPremium > 0) {
                    analysis += ` *(+$${costPremium.toFixed(2)} premium - ${percentPremium}%)*`;
                }
                analysis += `\n`;
                if (rate.guaranteedService) {
                    analysis += `   - ✅ Guaranteed Service\n`;
                }
                analysis += `\n`;
            });
        }

        // Value Analysis
        analysis += `## 🎯 **Value Recommendations**\n\n`;
        
        // Best value calculation (cost vs speed ratio)
        const valueRates = formattedRates
            .filter(r => r.transitDays !== 'Unknown' && r.cost > 0)
            .map(r => ({
                ...r,
                valueScore: r.cost / parseInt(r.transitDays) // Lower is better
            }))
            .sort((a, b) => a.valueScore - b.valueScore);

        if (valueRates.length > 0) {
            const bestValue = valueRates[0];
            analysis += `### **🏆 Best Overall Value:**\n`;
            analysis += `**${bestValue.carrier}** - ${bestValue.service}\n`;
            analysis += `- Cost: $${bestValue.cost.toFixed(2)}\n`;
            analysis += `- Transit: ${bestValue.transitDays} days\n`;
            analysis += `- Value Score: $${bestValue.valueScore.toFixed(2)} per day\n`;
            if (bestValue.guaranteedService) {
                analysis += `- ✅ Guaranteed Service Available\n`;
            }
            analysis += `\n`;
        }

        // Special considerations
        analysis += `### **💡 Special Considerations:**\n`;
        
        const guaranteedRates = formattedRates.filter(r => r.guaranteedService);
        if (guaranteedRates.length > 0) {
            analysis += `- **${guaranteedRates.length} carrier(s) offer guaranteed service** for critical shipments\n`;
            const cheapestGuaranteed = guaranteedRates.sort((a, b) => a.cost - b.cost)[0];
            analysis += `- Cheapest guaranteed option: **${cheapestGuaranteed.carrier}** at $${cheapestGuaranteed.cost.toFixed(2)}\n`;
        }

        // Check for eShipPlus freight
        const freightRates = formattedRates.filter(r => 
            r.carrier.toLowerCase().includes('freight') ||
            r.carrier.toLowerCase().includes('ltl') ||
            r.service.toLowerCase().includes('freight')
        );
        if (freightRates.length > 0) {
            analysis += `- **${freightRates.length} freight/LTL option(s)** available for larger shipments\n`;
        }

        // Cost spread analysis
        if (costRange > avgCost * 0.3) {
            analysis += `- **High cost variation** detected (${((costRange/avgCost)*100).toFixed(1)}%) - carrier selection significantly impacts cost\n`;
        }

        analysis += `\n`;

        // Detailed rate breakdown
        analysis += `## 📋 **Detailed Rate Breakdown**\n\n`;
        formattedRates.forEach((rate, index) => {
            analysis += `### **${index + 1}. ${rate.carrier}** - ${rate.service}\n`;
            analysis += `- **Total Cost:** $${rate.cost.toFixed(2)}\n`;
            if (rate.baseRate > 0) {
                analysis += `- Base Rate: $${rate.baseRate.toFixed(2)}\n`;
            }
            if (rate.fuelSurcharge > 0) {
                analysis += `- Fuel Surcharge: $${rate.fuelSurcharge.toFixed(2)}\n`;
            }
            if (rate.transitDays !== 'Unknown') {
                analysis += `- **Transit Time:** ${rate.transitDays} days\n`;
            }
            if (rate.estimatedDelivery !== 'Not specified') {
                analysis += `- Estimated Delivery: ${rate.estimatedDelivery}\n`;
            }
            if (rate.guaranteedService) {
                analysis += `- ✅ **Guaranteed Service:** +$${rate.guaranteeCharge.toFixed(2)}\n`;
            }
            if (rate.accessorials && rate.accessorials.length > 0) {
                analysis += `- Accessorials: ${rate.accessorials.length} service(s)\n`;
            }
            analysis += `\n`;
        });

        analysis += `---\n`;
        analysis += `*Analysis generated by SolushipX AI • ${new Date().toLocaleString()}*\n`;

        logger.info('AI analysis completed successfully');

        return {
            success: true,
            analysis: analysis,
            metadata: {
                rateCount: formattedRates.length,
                avgCost: avgCost,
                costRange: costRange,
                avgTransitTime: avgTransit,
                guaranteedOptionsAvailable: guaranteedRates.length > 0,
                freightOptionsAvailable: freightRates.length > 0
            }
        };

    } catch (error) {
        logger.error('Error in AI rate analysis:', error);
        return {
            success: false,
            error: error.message,
            analysis: `# ❌ Analysis Error\n\nSorry, we encountered an error while analyzing your rates:\n\n**${error.message}**\n\nPlease try again or contact support if the issue persists.`
        };
    }
}); 