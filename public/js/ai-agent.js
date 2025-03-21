// AI Agent for Rate Analysis
const AIAgent = {
    // Initialize the AI agent
    init() {
        this.bindEvents();
    },

    // Bind event listeners
    bindEvents() {
        const aiButton = document.getElementById('aiAnalysisBtn');
        if (aiButton) {
            aiButton.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent form submission
                e.stopPropagation(); // Stop event bubbling
                this.analyzeRates();
            });
        }
    },

    // Show loading state
    showLoading() {
        const aiButton = document.getElementById('aiAnalysisBtn');
        const analysisContainer = document.getElementById('aiAnalysisResult');
        if (aiButton) {
            aiButton.disabled = true;
            aiButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analyzing...';
        }
        if (analysisContainer) {
            analysisContainer.style.display = 'block';
        }
    },

    // Hide loading state
    hideLoading() {
        const aiButton = document.getElementById('aiAnalysisBtn');
        if (aiButton) {
            aiButton.disabled = false;
            aiButton.innerHTML = '<i class="fas fa-robot"></i> AI Analysis';
        }
    },

    // Show error state
    showError(message) {
        const aiButton = document.getElementById('aiAnalysisBtn');
        if (aiButton) {
            aiButton.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
            console.error('AI Analysis Error:', message);
        }

        // Show error message to user
        const analysisContainer = document.getElementById('aiAnalysisResult');
        if (analysisContainer) {
            analysisContainer.innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <div class="alert alert-danger mb-0">
                            <i class="fas fa-exclamation-triangle"></i> ${message}
                        </div>
                    </div>
                </div>
            `;
        }
    },

    // Show analysis results
    showAnalysis(analysis) {
        const analysisContainer = document.getElementById('aiAnalysisResult');
        if (analysisContainer) {
            // Format the analysis text
            const formattedAnalysis = analysis
                .split('\n')
                .map(line => {
                    // Convert numbered lists to bullet points
                    if (line.match(/^\d+\./)) {
                        return `<li>${line.replace(/^\d+\.\s*/, '')}</li>`;
                    }
                    // Convert sub-bullets
                    if (line.match(/^\s*-\s /)) {
                        return `<li class="ms-4">${line.replace(/^\s*-\s*/, '')}</li>`;
                    }
                    return line;
                })
                .join('\n');

            analysisContainer.innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <h5 class="card-title mb-3">AI Rate Analysis</h5>
                        <div class="analysis-content">
                            <div class="analysis-section">
                                <div class="analysis-text">
                                    ${formattedAnalysis}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;

            // Add some CSS to style the analysis
            const style = document.createElement('style');
            style.textContent = `
                .analysis-content {
                    font-size: 1rem;
                    line-height: 1.6;
                    color: #333;
                }
                .analysis-section {
                    background-color: #f8f9fa;
                    border-radius: 8px;
                    padding: 1.5rem;
                }
                .analysis-text {
                    margin-bottom: 1rem;
                }
                .analysis-text ul {
                    list-style-type: none;
                    padding-left: 0;
                    margin-bottom: 1rem;
                }
                .analysis-text li {
                    margin-bottom: 0.5rem;
                    position: relative;
                    padding-left: 1.5rem;
                }
                .analysis-text li:before {
                    content: "•";
                    position: absolute;
                    left: 0;
                    color: #0d6efd;
                }
                .analysis-text li.ms-4:before {
                    content: "◦";
                }
            `;
            document.head.appendChild(style);
        }
    },

    // Analyze rates using AI
    async analyzeRates() {
        try {
            this.showLoading();
            
            // Get current rates data from the form handler
            const ratesData = window.formHandler?.currentRates;
            if (!ratesData) {
                throw new Error('No rates data available for analysis');
            }

            // Format the rates data for AI analysis
            const formattedRates = ratesData.map(rate => ({
                carrier: rate.carrier,
                transitDays: rate.transitDays,
                estimatedDelivery: rate.estimatedDelivery,
                serviceLevel: rate.serviceLevel,
                baseRate: rate.baseRate,
                fuelSurcharge: rate.fuelSurcharge,
                accessorials: rate.accessorials,
                totalCharges: rate.totalCharges,
                guaranteedService: rate.guaranteedService,
                guaranteeCharge: rate.guaranteeCharge
            }));

            console.log('Sending rates data to AI:', formattedRates);

            // Call the Firebase function endpoint
            const response = await fetch('https://us-central1-solushipx.cloudfunctions.net/analyzeRatesWithAI', {
                method: 'POST',
                mode: 'cors',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ rates: formattedRates })
            });

            console.log('Response status:', response.status);
            const result = await response.json();
            console.log('Response data:', result);

            if (!response.ok) {
                throw new Error(result.message || `HTTP error! status: ${response.status}`);
            }
            
            if (result.success) {
                this.showAnalysis(result.analysis);
            } else {
                throw new Error(result.message || 'Analysis failed');
            }
        } catch (error) {
            console.error('Full error:', error);
            this.showError(error.message);
        } finally {
            this.hideLoading();
        }
    }
};

// Test function to simulate rate data
function testAIAnalysis() {
    const testRates = {
        availableRates: [
            {
                carrierName: "Fast Shipping Co",
                transitTime: 2,
                estimatedDeliveryDate: "2025-03-23",
                serviceMode: "Express",
                freightCharges: 150.00,
                fuelCharges: 25.00,
                accessorialCharges: 10.00,
                serviceCharges: 20.00,
                totalCharges: 205.00
            },
            {
                carrierName: "Economy Shipping Co",
                transitTime: 5,
                estimatedDeliveryDate: "2025-03-26",
                serviceMode: "Standard",
                freightCharges: 100.00,
                fuelCharges: 15.00,
                accessorialCharges: 5.00,
                serviceCharges: 10.00,
                totalCharges: 130.00
            },
            {
                carrierName: "Premium Shipping Co",
                transitTime: 3,
                estimatedDeliveryDate: "2025-03-24",
                serviceMode: "Priority",
                freightCharges: 180.00,
                fuelCharges: 30.00,
                accessorialCharges: 15.00,
                serviceCharges: 25.00,
                totalCharges: 250.00
            }
        ]
    };

    // Call the AI analysis function with test data
    AIAgent.analyzeRates(testRates);
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    AIAgent.init();
    
    // Add test button to the page
    const testButton = document.createElement('button');
    testButton.className = 'btn btn-secondary ms-2';
    testButton.innerHTML = '<i class="fas fa-vial"></i> Test AI Analysis';
    testButton.onclick = testAIAnalysis;
    
    const header = document.querySelector('.d-flex.align-items-center');
    if (header) {
        header.appendChild(testButton);
    }
}); 