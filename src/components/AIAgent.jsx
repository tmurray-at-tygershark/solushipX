import React, { useState, useEffect, useRef } from 'react';
import { Room, RoomEvent, RemoteParticipant, RemoteTrackPublication, RemoteTrack } from 'livekit-client';

const AIAgent = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [isHeyGenInitialized, setIsHeyGenInitialized] = useState(false);

    // Refs for HeyGen session management
    const mediaElementRef = useRef(null);
    const sessionTokenRef = useRef(null);
    const sessionDataRef = useRef(null);
    const roomRef = useRef(null);
    const mediaStreamRef = useRef(null);

    // Initialize HeyGen session
    const initializeHeyGen = async () => {
        try {
            // Get session token
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
            sessionTokenRef.current = tokenData.data.token;

            // Initialize HeyGen session
            const sessionResponse = await fetch('https://api.heygen.com/v1/streaming.new', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionTokenRef.current}`
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

            sessionDataRef.current = await sessionResponse.json();

            // Start streaming session
            const startResponse = await fetch('https://api.heygen.com/v1/streaming.start', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${sessionTokenRef.current}`
                },
                body: JSON.stringify({
                    session_id: sessionDataRef.current.data.session_id
                })
            });

            if (!startResponse.ok) {
                const errorData = await startResponse.json();
                throw new Error(`Failed to start streaming: ${startResponse.status} - ${JSON.stringify(errorData)}`);
            }

            // Initialize LiveKit room
            roomRef.current = new Room({
                adaptiveStream: true,
                dynacast: true,
                videoCaptureDefaults: {
                    resolution: Room.VideoPresets.h720.resolution,
                },
            });

            // Handle media streams
            mediaStreamRef.current = new MediaStream();
            roomRef.current.on(RoomEvent.TrackSubscribed, (track) => {
                if (track.kind === "video" || track.kind === "audio") {
                    mediaStreamRef.current.addTrack(track.mediaStreamTrack);
                    if (mediaStreamRef.current.getVideoTracks().length > 0 &&
                        mediaStreamRef.current.getAudioTracks().length > 0) {
                        if (mediaElementRef.current) {
                            mediaElementRef.current.srcObject = mediaStreamRef.current;
                        }
                    }
                }
            });

            // Connect to LiveKit room
            await roomRef.current.connect(
                sessionDataRef.current.data.url,
                sessionDataRef.current.data.access_token
            );

            // Send welcome message
            await sendTextToAvatar("I'm here to help, let me take a look at the rates for a moment and give you my thoughts...");

            setIsHeyGenInitialized(true);
        } catch (error) {
            console.error('Error initializing HeyGen:', error);
            setError(error.message);
        }
    };

    // Send text to avatar
    const sendTextToAvatar = async (text) => {
        if (!sessionTokenRef.current || !sessionDataRef.current) {
            throw new Error('HeyGen session not initialized');
        }

        const textResponse = await fetch('https://api.heygen.com/v1/streaming.task', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${sessionTokenRef.current}`
            },
            body: JSON.stringify({
                session_id: sessionDataRef.current.data.session_id,
                text: text,
                task_type: "repeat"
            })
        });

        if (!textResponse.ok) {
            throw new Error(`Failed to send text: ${textResponse.status}`);
        }
    };

    // Format analysis text
    const formatAnalysisText = (text) => {
        const lines = text.split('\n');
        return lines.map((line, index) => {
            if (line.startsWith('#')) {
                return <h5 key={index} className="text-primary fw-semibold mt-4">{line.substring(1)}</h5>;
            } else if (line.startsWith('-')) {
                return <li key={index} className="ms-4 mb-2">{line.substring(1)}</li>;
            } else if (line.trim()) {
                return <p key={index} className="mb-3">{line}</p>;
            }
            return null;
        });
    };

    // Handle AI analysis
    const handleAIAnalysis = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch('/api/analyze-rates', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    origin: document.getElementById('origin').value,
                    destination: document.getElementById('destination').value,
                    weight: document.getElementById('weight').value,
                    dimensions: {
                        length: document.getElementById('length').value,
                        width: document.getElementById('width').value,
                        height: document.getElementById('height').value
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Failed to analyze rates: ${response.status}`);
            }

            const data = await response.json();
            setAnalysis(data.analysis);

            // Send analysis to avatar
            if (isHeyGenInitialized) {
                await sendTextToAvatar(data.analysis);
            }
        } catch (error) {
            console.error('AI Analysis Error:', error);
            setError(error.message);
        } finally {
            setIsLoading(false);
        }
    };

    // Initialize HeyGen on component mount
    useEffect(() => {
        initializeHeyGen();
    }, []);

    return (
        <div className="ai-agent">
            <button
                className="btn btn-primary"
                onClick={handleAIAnalysis}
                disabled={isLoading}
            >
                {isLoading ? 'Analyzing...' : 'AI Analysis'}
            </button>

            {isLoading && (
                <div className="loading-spinner">
                    <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                </div>
            )}

            {error && (
                <div className="alert alert-danger mt-3">
                    {error}
                </div>
            )}

            {analysis && (
                <div id="aiAnalysisResult" className="mt-4">
                    <div className="card">
                        <div className="card-body">
                            <div className="analysis-content">
                                <div className="analysis-section">
                                    <div className="avatar-container mb-4">
                                        <video
                                            ref={mediaElementRef}
                                            autoPlay
                                            playsInline
                                            controls
                                            className="w-100 h-100 rounded"
                                            style={{ background: '#000', minHeight: '300px', objectFit: 'cover' }}
                                        />
                                        <div className="audio-controls mt-2 text-center">
                                            <button
                                                className="btn btn-sm btn-outline-primary"
                                                onClick={() => {
                                                    if (mediaElementRef.current) {
                                                        mediaElementRef.current.muted = !mediaElementRef.current.muted;
                                                    }
                                                }}
                                            >
                                                <i className="fas fa-volume-up"></i> Enable Audio
                                            </button>
                                        </div>
                                    </div>
                                    <div className="mt-4">
                                        {formatAnalysisText(analysis)}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AIAgent; 