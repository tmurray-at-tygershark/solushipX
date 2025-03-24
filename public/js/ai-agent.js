// AI Agent for Rate Analysis
const AIAgent = {
    // Initialize the AI agent
    init() {
        // Bind events
        this.bindEvents();
        
        // Initialize HeyGen session in the background
        this.initializeHeyGen();
        
        // Log initialization
        console.log('AI Agent initialized');
    },

    // Bind event listeners
    bindEvents() {
        // Bind AI Analysis button
        const aiButton = document.getElementById('aiAnalysisBtn');
        if (aiButton) {
            aiButton.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await this.analyzeRates();
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
            analysisContainer.innerHTML = `
                <div class="card">
                    <div class="card-body">
                        <div class="d-flex justify-content-center align-items-center" style="min-height: 200px;">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Loading...</span>
                            </div>
                        </div>
                    </div>
                </div>
            `;
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

    // Initialize HeyGen session
    async initializeHeyGen() {
        try {
            // Get session token first
            console.log('Getting HeyGen session token...');
            const tokenResponse = await fetch('https://api.heygen.com/v1/streaming.create_token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Api-Key': 'Yjk5MmZjYjQ4Y2IwNGExMTlhNDlkNmRmZTBmMGViMTItMTc0MjU4MDc4MQ=='
                }
            });

            if (!tokenResponse.ok) {
                throw new Error(`Failed to get session token: ${tokenResponse.status}`);
            }

            const tokenData = await tokenResponse.json();
            this.sessionToken = tokenData.data.token;
            console.log('Session token obtained');

            // Initialize HeyGen session
            console.log('Initializing HeyGen session...');
            const sessionResponse = await fetch('https://api.heygen.com/v1/streaming.new', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                },
                body: JSON.stringify({
                    quality: "high",
                    avatar_name: "June_HR_public",
                    voice: {
                        rate: 1.0
                    },
                    version: "v2",
                    video_encoding: "H264",
                    background: {
                        type: "color",
                        value: "#000000"
                    },
                    avatar_style: "normal",
                    avatar_angle: "front",
                    avatar_scale: 1.0,
                    avatar_position: {
                        x: 0,
                        y: 0
                    }
                })
            });

            if (!sessionResponse.ok) {
                const errorData = await sessionResponse.json();
                throw new Error(`Failed to create HeyGen session: ${sessionResponse.status} - ${JSON.stringify(errorData)}`);
            }

            this.sessionData = await sessionResponse.json();
            console.log('HeyGen session created:', this.sessionData);

            // Start the streaming session
            const startResponse = await fetch('https://api.heygen.com/v1/streaming.start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.sessionToken}`
                },
                body: JSON.stringify({
                    session_id: this.sessionData.data.session_id
                })
            });

            if (!startResponse.ok) {
                const errorData = await startResponse.json();
                throw new Error(`Failed to start streaming: ${startResponse.status} - ${JSON.stringify(errorData)}`);
            }

            console.log('Streaming session started');

            // Initialize LiveKit room
            this.room = new LivekitClient.Room({
                adaptiveStream: true,
                dynacast: true,
                videoCaptureDefaults: {
                    resolution: LivekitClient.VideoPresets.h720.resolution,
                },
            });

            // Handle media streams
            this.mediaStream = new MediaStream();
            this.room.on(LivekitClient.RoomEvent.TrackSubscribed, (track) => {
                if (track.kind === "video" || track.kind === "audio") {
                    this.mediaStream.addTrack(track.mediaStreamTrack);
                    if (this.mediaStream.getVideoTracks().length > 0 && this.mediaStream.getAudioTracks().length > 0) {
                        if (this.mediaElement) {
                            this.mediaElement.srcObject = this.mediaStream;
                            console.log('Media stream ready');
                        }
                    }
                }
            });

            // Connect to LiveKit room
            await this.room.connect(this.sessionData.data.url, this.sessionData.data.access_token);
            console.log('Connected to room');

            // Send welcome message
            await this.sendTextToAvatar("I'm here to help, let me take a look at the rates for a moment and give you my thoughts...");
            
            console.log('HeyGen initialization complete');
        } catch (error) {
            console.error('Error initializing HeyGen:', error);
        }
    },

    // Send text to avatar
    async sendTextToAvatar(text) {
        if (!this.sessionToken || !this.sessionData) {
            throw new Error('HeyGen session not initialized');
        }

        const textResponse = await fetch('https://api.heygen.com/v1/streaming.task', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.sessionToken}`
            },
            body: JSON.stringify({
                session_id: this.sessionData.data.session_id,
                text: text,
                task_type: "repeat"
            })
        });

        if (!textResponse.ok) {
            throw new Error(`Failed to send text: ${textResponse.status}`);
        }

        console.log('Text sent to avatar:', text);
    },

    // Show analysis results
    async showAnalysis(analysis) {
        const analysisContainer = document.getElementById('aiAnalysisResult');
        
        if (!analysisContainer) {
            console.error('Analysis container not found');
            return;
        }

        console.log('Showing analysis...');
        
        // Set up the container structure with video element
        analysisContainer.innerHTML = `
            <div class="card">
                <div class="card-body">
                    <div class="analysis-content">
                        <div class="analysis-section">
                            <div class="avatar-container mb-4">
                                <video id="mediaElement" autoplay playsinline controls class="w-100 h-100 rounded" style="background: #000; min-height: 300px; object-fit: cover;"></video>
                                <div class="audio-controls mt-2 text-center">
                                    <button id="toggleAudio" class="btn btn-sm btn-outline-primary">
                                        <i class="fas fa-volume-up"></i> Enable Audio
                                    </button>
                                </div>
                            </div>
                            <div id="analysisText" class="mt-4"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Show the container
        analysisContainer.style.display = 'block';
        
        try {
            // Get the video and text elements
            this.mediaElement = document.getElementById('mediaElement');
            const analysisTextContainer = document.getElementById('analysisText');
            const toggleAudioBtn = document.getElementById('toggleAudio');
            
            if (!this.mediaElement || !analysisTextContainer) {
                throw new Error('Failed to initialize UI elements');
            }

            // If media stream is ready, set it to the video element
            if (this.mediaStream) {
                this.mediaElement.srcObject = this.mediaStream;
            }

            // Handle audio toggle
            if (toggleAudioBtn) {
                toggleAudioBtn.addEventListener('click', () => {
                    this.mediaElement.muted = !this.mediaElement.muted;
                    toggleAudioBtn.innerHTML = this.mediaElement.muted ? 
                        '<i class="fas fa-volume-mute"></i> Enable Audio' : 
                        '<i class="fas fa-volume-up"></i> Disable Audio';
                });
            }

            // Format and display the analysis text
            const formattedAnalysis = this.formatAnalysisText(analysis);
            analysisTextContainer.innerHTML = formattedAnalysis;

            // Send the analysis text to the avatar
            await this.sendTextToAvatar(analysis);

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
                .avatar-container {
                    max-width: 800px;
                    margin: 0 auto;
                    background: #000;
                    border-radius: 8px;
                    overflow: hidden;
                    aspect-ratio: 16/9;
                    position: relative;
                }
                .avatar-container video {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                .audio-controls {
                    position: absolute;
                    bottom: 10px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 10;
                }
                .audio-controls .btn {
                    background: rgba(255, 255, 255, 0.9);
                    border: none;
                    padding: 5px 15px;
                    border-radius: 20px;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                }
                .audio-controls .btn:hover {
                    background: rgba(255, 255, 255, 1);
                }
            `;
            document.head.appendChild(style);
        } catch (error) {
            console.error('Error in showAnalysis:', error);
            this.showError(`Failed to display analysis: ${error.message}`);
        } finally {
            // Ensure loading state is cleared
            this.hideLoading();
        }
    },

    // Format the analysis text
    formatAnalysisText(text) {
        // Split the text into lines
        const lines = text.split('\n');
        
        // Process each line
        return lines.map(line => {
            // Handle headings
            if (line.match(/^\d+\./)) {
                return `<h5>${line.replace(/^\d+\.\s*/, '')}</h5>`;
            }
            
            // Handle sub-bullets
            if (line.trim().startsWith('-')) {
                return `<li class="ms-4">${line.replace(/^-\s*/, '')}</li>`;
            }
            
            // Handle regular paragraphs
            if (line.trim()) {
                return `<p>${line}</p>`;
            }
            
            return '';
        }).join('');
    },

    // Analyze rates using AI
    async analyzeRates() {
        try {
            this.showLoading();
            
            // Get current rates data from the form handler
            const ratesData = window.formHandler?.currentRates;
            if (!ratesData || !Array.isArray(ratesData) || ratesData.length === 0) {
                throw new Error('No valid rates data available for analysis. Please calculate rates first.');
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
                console.log('AI analysis successful, showing results...');
                await this.showAnalysis(result.analysis);
            } else {
                throw new Error(result.message || 'Analysis failed');
            }
        } catch (error) {
            console.error('AI Analysis Error:', error);
            this.showError(error.message);
        } finally {
            this.hideLoading();
        }
    }
};

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing AI Agent...');
    AIAgent.init();
}); 