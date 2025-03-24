import React, { useEffect, useRef } from 'react';
import Globe from 'globe.gl';
import * as THREE from 'three';
import { Box } from '@mui/material';
import './Globe.css';

const ShipmentGlobe = ({ shipments, width = 500, height = 500 }) => {
    const globeEl = useRef();
    const arcsData = useRef([]);

    useEffect(() => {
        // Initialize globe
        const globe = Globe()(globeEl.current)
            .width(width)
            .height(height)
            .backgroundColor('rgba(255, 255, 255, 0)')
            .globeImageUrl('//unpkg.com/three-globe/example/img/earth-dark.jpg')
            .arcColor((d) => {
                const status = d.status;
                return status === 'Delivered' ? '#2e7d32' :
                    status === 'In Transit' ? '#1976d2' :
                        status === 'Awaiting Shipment' ? '#ed6c02' : '#666';
            })
            .arcAltitude((d) => {
                return d.arcAlt;
            })
            .arcStroke((d) => {
                return d.status === 'In Transit' ? 0.5 : 0.25;
            })
            .arcDashLength(0.9)
            .arcDashGap(4)
            .arcDashAnimateTime(1500)
            .arcsTransitionDuration(1000)
            .pointColor(() => '#fff')
            .pointAltitude(0.1)
            .pointRadius(0.05)
            .pointsMerge(true);

        // Add atmosphere effect
        const geometry = new THREE.SphereGeometry(globe.getGlobeRadius() * 1.05, 64, 64);
        const material = new THREE.ShaderMaterial({
            uniforms: {
                color: { value: new THREE.Color('#1976d2') },
                coefficient: { value: 0.1 },
                power: { value: 2 }
            },
            vertexShader: `
                varying vec3 vNormal;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 color;
                uniform float coefficient;
                uniform float power;
                varying vec3 vNormal;
                void main() {
                    float intensity = pow(coefficient - dot(vNormal, vec3(0.0, 0.0, 1.0)), power);
                    gl_FragColor = vec4(color, intensity);
                }
            `,
            blending: THREE.AdditiveBlending,
            transparent: true
        });

        const atmosphereMesh = new THREE.Mesh(geometry, material);
        globe.scene().add(atmosphereMesh);

        // Auto-rotate
        globe.controls().autoRotate = true;
        globe.controls().autoRotateSpeed = 0.35;

        // Update arcs data when shipments change
        if (shipments) {
            arcsData.current = shipments.map(shipment => {
                // Convert city names to coordinates (this is a simplified example)
                const [originCity, originState] = shipment.origin.split(', ');
                const [destCity, destState] = shipment.destination.split(', ');

                // You would need a proper geocoding service here
                // This is just an example using random coordinates
                return {
                    startLat: -30 + Math.random() * 60,
                    startLng: -140 + Math.random() * 280,
                    endLat: -30 + Math.random() * 60,
                    endLng: -140 + Math.random() * 280,
                    arcAlt: 0.1 + Math.random() * 0.3,
                    status: shipment.status
                };
            });

            globe.arcsData(arcsData.current);
        }

        return () => {
            globe.scene().remove(atmosphereMesh);
            geometry.dispose();
            material.dispose();
        };
    }, [shipments, width, height]);

    return (
        <Box
            ref={globeEl}
            sx={{
                position: 'relative',
                cursor: 'grab',
                '&:active': {
                    cursor: 'grabbing'
                }
            }}
        />
    );
};

export default ShipmentGlobe; 