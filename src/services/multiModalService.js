// Multi-Modal AI Service - Phase 2A Enhanced Intelligence
// Manages multi-modal analysis capabilities and feature display

export const MultiModalService = {
    
    // Phase 2A Feature Set
    features: {
        aiVision: {
            name: 'AI Vision Analysis',
            description: 'Advanced visual layout and structure analysis',
            icon: '👁️',
            enabled: true,
            confidence: 0.92
        },
        logoDetection: {
            name: 'Carrier Logo Detection',
            description: 'Automatic identification of carrier logos and branding',
            icon: '🏷️',
            enabled: true,
            confidence: 0.89
        },
        tableIntelligence: {
            name: 'Table Intelligence',
            description: 'Smart table structure recognition and data extraction',
            icon: '📊',
            enabled: true,
            confidence: 0.91
        },
        layoutAnalysis: {
            name: 'Layout Analysis',
            description: 'Document structure and formatting pattern recognition',
            icon: '🎨',
            enabled: true,
            confidence: 0.88
        },
        formatClassification: {
            name: 'Format Classification',
            description: 'Intelligent document type identification',
            icon: '📋',
            enabled: true,
            confidence: 0.90
        }
    },

    // Get multi-modal capabilities summary
    getCapabilitiesSummary() {
        const enabledFeatures = Object.entries(this.features)
            .filter(([_, feature]) => feature.enabled)
            .map(([key, feature]) => ({
                key,
                ...feature
            }));

        const averageConfidence = enabledFeatures
            .reduce((sum, feature) => sum + feature.confidence, 0) / enabledFeatures.length;

        return {
            totalFeatures: enabledFeatures.length,
            averageConfidence: Math.round(averageConfidence * 100),
            capabilities: enabledFeatures,
            phase: '2A',
            version: '2.1-multimodal'
        };
    },

    // Generate processing strategy based on document characteristics
    determineProcessingStrategy(documentAnalysis) {
        const { complexity, hasLogo, hasStructuredTables, documentType } = documentAnalysis;

        if (complexity === 'simple' && hasLogo && documentType === 'invoice') {
            return {
                strategy: 'fast-track-multimodal',
                confidence: 0.95,
                features: ['logoDetection', 'tableIntelligence'],
                estimatedTime: '15-30 seconds'
            };
        } else if (complexity === 'complex' || hasStructuredTables) {
            return {
                strategy: 'comprehensive-multimodal',
                confidence: 0.88,
                features: ['aiVision', 'logoDetection', 'tableIntelligence', 'layoutAnalysis'],
                estimatedTime: '45-60 seconds'
            };
        } else {
            return {
                strategy: 'standard-multimodal',
                confidence: 0.90,
                features: ['aiVision', 'logoDetection', 'formatClassification'],
                estimatedTime: '30-45 seconds'
            };
        }
    },

    // Get enhanced carrier confidence based on multi-modal consensus
    calculateEnhancedConfidence(textConfidence, logoConfidence, layoutConfidence) {
        // Weighted average with emphasis on different modes
        const weights = {
            text: 0.4,    // 40% weight for text analysis
            logo: 0.35,   // 35% weight for logo detection
            layout: 0.25  // 25% weight for layout analysis
        };

        const weightedScore = 
            (textConfidence * weights.text) +
            (logoConfidence * weights.logo) +
            (layoutConfidence * weights.layout);

        // Apply multi-modal agreement bonus
        const scores = [textConfidence, logoConfidence, layoutConfidence];
        const variance = this.calculateVariance(scores);
        const agreementBonus = Math.max(0, 0.05 - variance); // Up to 5% bonus for agreement

        return Math.min(weightedScore + agreementBonus, 1.0);
    },

    // Calculate variance for agreement bonus
    calculateVariance(scores) {
        const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
        const squaredDiffs = scores.map(score => Math.pow(score - mean, 2));
        return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / scores.length;
    },

    // Get user-friendly feature descriptions
    getFeatureDescriptions() {
        return Object.entries(this.features).map(([key, feature]) => ({
            id: key,
            title: feature.name,
            description: feature.description,
            icon: feature.icon,
            enabled: feature.enabled,
            confidence: `${Math.round(feature.confidence * 100)}%`
        }));
    },

    // Generate processing status updates
    generateStatusUpdate(phase, progress) {
        const statusMessages = {
            'text_extraction': {
                message: '📝 Extracting text content...',
                detail: 'Reading document text and structure'
            },
            'layout_analysis': {
                message: '🎨 Analyzing visual layout...',
                detail: 'Understanding document structure and formatting'
            },
            'logo_detection': {
                message: '🏷️ Detecting carrier logos...',
                detail: 'Identifying branding and visual elements'
            },
            'table_intelligence': {
                message: '📊 Processing table data...',
                detail: 'Extracting structured information from tables'
            },
            'format_classification': {
                message: '📋 Classifying document format...',
                detail: 'Determining document type and processing strategy'
            },
            'multi_modal_fusion': {
                message: '🔗 Combining analysis results...',
                detail: 'Merging insights from all analysis modes'
            },
            'confidence_calculation': {
                message: '🎯 Calculating confidence scores...',
                detail: 'Determining accuracy and reliability metrics'
            },
            'shipment_matching': {
                message: '🔍 Matching shipments...',
                detail: 'Finding corresponding shipments in database'
            }
        };

        return {
            phase,
            progress: Math.round(progress),
            ...statusMessages[phase],
            timestamp: new Date().toISOString()
        };
    },

    // Validate multi-modal settings
    validateSettings(settings) {
        const requiredSettings = [
            'useMultiModalAnalysis',
            'aiVisionEnabled',
            'logoDetectionEnabled',
            'tableIntelligenceEnabled'
        ];

        const missingSettings = requiredSettings.filter(setting => !settings[setting]);
        
        return {
            valid: missingSettings.length === 0,
            missingSettings,
            recommendations: this.getSettingsRecommendations(settings)
        };
    },

    // Get recommendations for optimal settings
    getSettingsRecommendations(currentSettings) {
        const recommendations = [];

        if (!currentSettings.useMultiModalAnalysis) {
            recommendations.push({
                setting: 'useMultiModalAnalysis',
                recommendation: 'Enable for enhanced accuracy and carrier detection',
                impact: 'High - significantly improves processing quality'
            });
        }

        if (!currentSettings.logoDetectionEnabled) {
            recommendations.push({
                setting: 'logoDetectionEnabled',
                recommendation: 'Enable for automatic carrier identification',
                impact: 'Medium - improves carrier detection accuracy'
            });
        }

        if (!currentSettings.tableIntelligenceEnabled) {
            recommendations.push({
                setting: 'tableIntelligenceEnabled',
                recommendation: 'Enable for better charge extraction from tables',
                impact: 'High - essential for complex invoice processing'
            });
        }

        return recommendations;
    }
};

export default MultiModalService; 