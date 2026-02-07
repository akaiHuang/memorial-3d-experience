"use client";

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Seeded random number generator for consistent results
function seededRandom(seed: number): () => number {
  return function() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

interface ParticleTextMeshProps {
  text: string;
  fontSize?: number;
  particleCount?: number;
  color?: string;
  seed?: number;
}

function ParticleTextMesh({ 
  text, 
  fontSize = 120, 
  particleCount = 3000,
  color = '#ffffff',
  seed = 12345
}: ParticleTextMeshProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const startTimeRef = useRef<number | null>(null);
  const hasAnimatedRef = useRef(false);
  
  // Generate particle positions from text
  const { positions, targetPositions, randomPositions } = useMemo(() => {
    const random = seededRandom(seed);
    
    // Create offscreen canvas to render text
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    
    // Set canvas size
    canvas.width = 512;
    canvas.height = 256;
    
    // Draw text
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${fontSize}px "Noto Serif TC", serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    
    // Get pixel data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const pixels = imageData.data;
    
    // Find all white pixels (text pixels)
    const textPixels: { x: number; y: number }[] = [];
    for (let y = 0; y < canvas.height; y += 2) {
      for (let x = 0; x < canvas.width; x += 2) {
        const i = (y * canvas.width + x) * 4;
        if (pixels[i] > 128) {
          textPixels.push({ x, y });
        }
      }
    }
    
    // Create particle arrays
    const positions = new Float32Array(particleCount * 3);
    const targetPositions = new Float32Array(particleCount * 3);
    const randomPositions = new Float32Array(particleCount * 3);
    
    const scale = 0.008; // Scale factor to fit in view
    const offsetX = canvas.width / 2;
    const offsetY = canvas.height / 2;
    
    for (let i = 0; i < particleCount; i++) {
      // Target position (text shape) - evenly distribute particles across all text pixels
      let targetX = 0, targetY = 0, targetZ = 0;
      if (textPixels.length > 0) {
        // Use evenly spaced index to cover all text pixels
        const pixelIndex = Math.floor((i / particleCount) * textPixels.length);
        const pixel = textPixels[pixelIndex];
        // Add small random offset to break grid pattern
        const jitter = 0.012;
        targetX = (pixel.x - offsetX) * scale + (random() - 0.5) * jitter;
        targetY = -(pixel.y - offsetY) * scale + (random() - 0.5) * jitter;
        targetZ = (random() - 0.5) * 0.1;
      }
      
      // Random initial position - scatter 30px from target (about 0.24 in 3D space)
      const scatter = 0.24;
      const randomX = targetX + (random() - 0.5) * scatter;
      const randomY = targetY + (random() - 0.5) * scatter;
      const randomZ = targetZ + (random() - 0.5) * scatter;
      
      randomPositions[i * 3] = randomX;
      randomPositions[i * 3 + 1] = randomY;
      randomPositions[i * 3 + 2] = randomZ;
      
      // Set initial position to random
      positions[i * 3] = randomX;
      positions[i * 3 + 1] = randomY;
      positions[i * 3 + 2] = randomZ;
      
      // Store target position
      targetPositions[i * 3] = targetX;
      targetPositions[i * 3 + 1] = targetY;
      targetPositions[i * 3 + 2] = targetZ;
    }
    
    return { positions, targetPositions, randomPositions };
  }, [text, fontSize, particleCount, seed]);
  
  // Custom shader material for particles
  const shaderMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: 0 },
        uMotionTime: { value: 0 },
        uColor: { value: new THREE.Color(color) },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
      },
      vertexShader: `
        uniform float uTime;
        uniform float uProgress;
        uniform float uMotionTime;
        uniform float uPixelRatio;
        
        attribute vec3 aTarget;
        attribute vec3 aRandom;
        
        varying float vAlpha;
        
        void main() {
          // Interpolate between random and target position
          vec3 pos = mix(aRandom, aTarget, uProgress);
          
          // Each particle has unique random circular/brownian motion
          // Motion starts 0.5s after formation, gradually increases
          float motionIntensity = smoothstep(0.0, 1.5, uMotionTime);
          
          // Use position as seed for randomness
          float seed = pos.x * 12.9898 + pos.y * 78.233;
          float rand1 = fract(sin(seed) * 43758.5453);
          float rand2 = fract(sin(seed * 1.5) * 43758.5453);
          float rand3 = fract(sin(seed * 2.3) * 43758.5453);
          
          // Random speed and phase for each particle
          float speed = 0.8 + rand1 * 1.2;
          float phase = rand2 * 6.28318;
          
          // Use motionTime for smooth start
          float radius = 0.006 * motionIntensity;
          
          // Small circular motion with varying radius
          pos.x += cos(uMotionTime * speed + phase) * radius * (0.5 + rand3);
          pos.y += sin(uMotionTime * speed * 1.3 + phase) * radius * (0.5 + rand1);
          
          vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          
          // Size grows 3x as particles aggregate, reduced 30% (0.875 -> 2.625)
          float size = (0.875 + 1.75 * uProgress) * uPixelRatio;
          gl_PointSize = size * (1.0 / -mvPosition.z);
          
          // Alpha starts from 0 and increases with progress
          vAlpha = uProgress;
        }
      `,
      fragmentShader: `
        uniform vec3 uColor;
        varying float vAlpha;
        
        void main() {
          // Circular particle shape
          float dist = length(gl_PointCoord - vec2(0.5));
          if (dist > 0.5) discard;
          
          // Soft edges
          float alpha = 1.0 - smoothstep(0.3, 0.5, dist);
          alpha *= vAlpha;
          
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }, [color]);
  
  useFrame(() => {
    if (!materialRef.current) return;
    
    // Initialize start time on first frame
    if (startTimeRef.current === null) {
      startTimeRef.current = Date.now();
    }
    
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    materialRef.current.uniforms.uTime.value = elapsed;
    
    // Animate progress from 0 to 1 over 2.5 seconds after 0.5s delay
    if (elapsed > 0.5 && !hasAnimatedRef.current) {
      const animProgress = Math.min((elapsed - 0.5) / 2.5, 1);
      // Ease out cubic
      const easedProgress = 1 - Math.pow(1 - animProgress, 3);
      materialRef.current.uniforms.uProgress.value = easedProgress;
      
      if (animProgress >= 1) {
        hasAnimatedRef.current = true;
      }
    }
    
    // Motion time starts 0.5s after formation is complete
    // Formation completes at elapsed = 0.5 + 2.5 = 3.0 seconds
    // Motion starts at elapsed = 3.5 seconds
    const formationCompleteTime = 3.0;
    const motionDelay = 0.5;
    const motionStartTime = formationCompleteTime + motionDelay;
    
    if (elapsed > motionStartTime) {
      materialRef.current.uniforms.uMotionTime.value = elapsed - motionStartTime;
    }
  });
  
  // Create geometry with attributes
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aTarget', new THREE.BufferAttribute(targetPositions, 3));
    geo.setAttribute('aRandom', new THREE.BufferAttribute(randomPositions, 3));
    return geo;
  }, [positions, targetPositions, randomPositions]);
  
  return (
    <points ref={pointsRef} geometry={geometry}>
      <primitive object={shaderMaterial} ref={materialRef} attach="material" />
    </points>
  );
}

interface ParticleTextProps {
  text?: string;
  className?: string;
  scale?: number;
}

export default function ParticleText({ text = "Say", className = "", scale = 1 }: ParticleTextProps) {
  return (
    <div className={`w-full h-48 ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 2], fov: 50 }}
        dpr={[1, 2]}
        gl={{ alpha: true, antialias: true }}
        style={{ background: 'transparent' }}
      >
        <group scale={[scale, scale, scale]} position={[0, 0.15, 0]}>
          <ParticleTextMesh text={text} particleCount={2000} />
        </group>
      </Canvas>
    </div>
  );
}
