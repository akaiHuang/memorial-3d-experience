"use client";

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';

function Galaxy({ isSuccess = false, showGalaxy = true, showSpheres = true, seed = 42 }) {
  const pointsRef = useRef<THREE.Points>(null!);
  const pointsRef2 = useRef<THREE.Points>(null!);
  const largePointsRef = useRef<THREE.Points>(null!);
  
  const count = 500;
  const largeCount = showSpheres ? 0 : 0;

  // Create main dust particles with size based on distance
  const [positions, colors, sizes] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const cols = new Float32Array(count * 3);
    const siz = new Float32Array(count);
    
    const colorInside = new THREE.Color("#f0e6d1"); // Warm cream
    const colorOutside = new THREE.Color("#d4c9b8"); // Slightly darker warm tone
    
    // Use a simple seeded random for galaxy too to keep it consistent if needed
    const random = (s: number) => {
      const x = Math.sin(s) * 10000;
      return x - Math.floor(x);
    };

    for (let i = 0; i < count; i++) {
      // More dense central distribution
      const r1 = random(seed + i * 0.15);
      const r2 = random(seed + i * 0.17);
      const r3 = random(seed + i * 0.19);
      
      const radius = Math.pow(r1, 1.2) * 18;
      const spin = 0.7;
      const angle = radius * spin + (i / count) * Math.PI * 40;
      
      const spread = 3.0;
      const x = Math.cos(angle) * radius + (r2 - 0.5) * spread;
      const y = (r3 - 0.5) * spread * (1 + radius * 0.08);
      const z = Math.sin(angle) * radius + (random(seed + i * 0.21) - 0.5) * spread;
      
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      
      // Color: white at center, fading to gray at edges
      const dist = Math.sqrt(x*x + y*y + z*z);
      const normalizedDist = Math.min(dist / 15, 1);
      const mixedColor = colorInside.clone().lerp(colorOutside, normalizedDist * 0.5);
      cols[i * 3] = mixedColor.r;
      cols[i * 3 + 1] = mixedColor.g;
      cols[i * 3 + 2] = mixedColor.b;
      
      // Size: larger at center, smaller at edges
      const maxSize = 2.0544;
      const minSize = 0.02275;
      siz[i] = maxSize - (maxSize - minSize) * normalizedDist;
    }
    return [pos, cols, siz];
  }, [count, seed]);

  // Create floating large particles (replacing spheres)
  const [largePositions, largeSizes, largeOffsets] = useMemo(() => {
    const pos = new Float32Array(largeCount * 3);
    const siz = new Float32Array(largeCount);
    const off = new Float32Array(largeCount * 4); // speed, offset, x_amp, y_amp
    
    const random = (s: number) => {
      const x = Math.sin(s) * 10000;
      return x - Math.floor(x);
    };

    for (let i = 0; i < largeCount; i++) {
      const s = seed + i * 1.5;
      pos[i * 3] = (random(s + 0.1) - 0.5) * 20; // Centered spread for visibility
      pos[i * 3 + 1] = (random(s + 0.2) - 0.5) * 25; // Centered spread
      pos[i * 3 + 2] = random(s + 0.3) * 3 + 3; // Z: 3 to 6, very close to camera
      
      siz[i] = (random(s + 0.5) * 1.0) * 1.0; // Reduced by 50%
      
      off[i * 4] = random(s + 0.4) * 0.05 + 0.01; // slower speed
      off[i * 4 + 1] = random(s + 0.6) * Math.PI * 2; // offset
      off[i * 4 + 2] = 5.0; // x_amp
      off[i * 4 + 3] = 6.0; // y_amp
    }
    return [pos, siz, off];
  }, [largeCount, seed]);

  useFrame((state) => {
    const time = performance.now() * 0.001;
    
    if (pointsRef.current) {
      pointsRef.current.rotation.y = time * (isSuccess ? 0.06 : 0.024);
      pointsRef.current.rotation.z = Math.sin(time * 0.04) * 0.05;
      if (pointsRef.current.material) {
        (pointsRef.current.material as any).uniforms.uTime.value = time * 0.8;
      }
    }
    if (pointsRef2.current) {
      pointsRef2.current.rotation.y = -time * 0.012;
      pointsRef2.current.rotation.x = Math.sin(time * 0.04) * 0.075;
    }

    // Animate large particles using shader uniforms or attribute updates
    if (largePointsRef.current && largePointsRef.current.material) {
      (largePointsRef.current.material as any).uniforms.uTime.value = time * 0.8;
    }
  });

  return (
    <group>
      {/* Main dense galaxy */}
      {showGalaxy && (
        <>
          <points ref={pointsRef}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={count}
                array={positions}
                itemSize={3}
                args={[positions, 3]}
              />
              <bufferAttribute
                attach="attributes-color"
                count={count}
                array={colors}
                itemSize={3}
                args={[colors, 3]}
              />
              <bufferAttribute
                attach="attributes-size"
                count={count}
                array={sizes}
                itemSize={1}
                args={[sizes, 1]}
              />
            </bufferGeometry>
            <shaderMaterial
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              vertexColors
              uniforms={{
                uPixelRatio: { value: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1 },
                uTime: { value: 0 }
              }}
              vertexShader={`
                attribute float size;
                varying vec3 vColor;
                varying float vFlicker;
                uniform float uPixelRatio;
                uniform float uTime;
                
                float hash(float n) {
                  return fract(sin(n) * 43758.5453123);
                }
                
                void main() {
                  vColor = color;
                  
                  float particleId = position.x * 1000.0 + position.y * 100.0 + position.z * 10.0;
                  float flickerSpeed = hash(particleId) * 2.0 + 1.0;
                  float flickerOffset = hash(particleId + 1.0) * 6.28;
                  
                  vFlicker = 0.6 + 0.4 * (sin(uTime * flickerSpeed + flickerOffset) * 0.5 + 0.5);
                  
                  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                  gl_PointSize = size * uPixelRatio * (300.0 / -mvPosition.z) * vFlicker;
                  gl_Position = projectionMatrix * mvPosition;
                }
              `}
              fragmentShader={`
                varying vec3 vColor;
                varying float vFlicker;
                
                void main() {
                  float dist = length(gl_PointCoord - vec2(0.5));
                  float alpha = 1.0 - smoothstep(0.4, 0.5, dist);
                  if (alpha <= 0.0) discard;
                  
                  gl_FragColor = vec4(vColor, alpha * 0.8 * vFlicker);
                }
              `}
            />
          </points>

          {/* Outer faint dust */}
          <points ref={pointsRef2}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={count / 2}
                array={positions.slice(0, Math.floor(count * 1.5))}
                itemSize={3}
                args={[positions.slice(0, Math.floor(count * 1.5)), 3]}
              />
            </bufferGeometry>
            <shaderMaterial
              transparent
              depthWrite={false}
              blending={THREE.AdditiveBlending}
              uniforms={{
                uColor: { value: new THREE.Color("#ffffff") },
                uOpacity: { value: 0.15 },
                uSize: { value: 0.015 },
                uPixelRatio: { value: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1 }
              }}
              vertexShader={`
                uniform float uSize;
                uniform float uPixelRatio;
                void main() {
                  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                  gl_PointSize = uSize * uPixelRatio * (300.0 / -mvPosition.z);
                  gl_Position = projectionMatrix * mvPosition;
                }
              `}
              fragmentShader={`
                uniform vec3 uColor;
                uniform float uOpacity;
                void main() {
                  float dist = length(gl_PointCoord - vec2(0.5));
                  if (dist > 0.5) discard;
                  float alpha = 1.0 - smoothstep(0.0, 0.5, dist);
                  gl_FragColor = vec4(uColor, alpha * uOpacity);
                }
              `}
            />
          </points>
        </>
      )}
      
      {/* Large floating particles with same shader as galaxy for consistent Bloom */}
      {showSpheres && (
        <points ref={largePointsRef}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={largeCount}
              array={largePositions}
              itemSize={3}
              args={[largePositions, 3]}
            />
            <bufferAttribute
              attach="attributes-size"
              count={largeCount}
              array={largeSizes}
              itemSize={1}
              args={[largeSizes, 1]}
            />
            <bufferAttribute
              attach="attributes-offset"
              count={largeCount}
              array={largeOffsets}
              itemSize={4}
              args={[largeOffsets, 4]}
            />
          </bufferGeometry>
          <shaderMaterial
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            uniforms={{
              uTime: { value: 0 },
              uPixelRatio: { value: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1 },
              uColor: { value: new THREE.Color("#ffffff") }
            }}
            vertexShader={`
              attribute float size;
              attribute vec4 offset; // speed, offset, x_amp, y_amp
              uniform float uTime;
              uniform float uPixelRatio;
              varying float vAlpha;
              
              void main() {
                float speed = offset.x;
                float timeOffset = offset.y;
                float xAmp = offset.z;
                float yAmp = offset.w;
                
                vec3 pos = position;
                pos.x += sin(uTime * speed + timeOffset) * xAmp;
                pos.y += cos(uTime * speed * 0.7 + timeOffset) * yAmp;
                pos.z += sin(uTime * speed * 0.5 + timeOffset) * 3.0;
                
                // Pulsing size
                float s = size * (1.0 + sin(uTime * speed * 0.8 + timeOffset) * 0.3);
                
                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                gl_PointSize = s * uPixelRatio * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
                
                // Always visible
                vAlpha = 1.0;
              }
            `}
            fragmentShader={`
              uniform vec3 uColor;
              varying float vAlpha;
              
              void main() {
                float dist = length(gl_PointCoord - vec2(0.5));
                // Soft circular shape with glow
                float strength = 1.0 - smoothstep(0.0, 0.5, dist);
                strength = pow(strength, 1.5); // Softer falloff for more glow
                
                gl_FragColor = vec4(uColor, strength * 0.8 * vAlpha);
              }
            `}
          />
        </points>
      )}
    </group>
  );
}

export default function ParticleBackground({ 
  isSuccess = false, 
  showGalaxy = true, 
  showSpheres = true,
  transparent = false,
  seed = 42,
  fixed = false
}: { 
  isSuccess?: boolean;
  showGalaxy?: boolean;
  showSpheres?: boolean;
  transparent?: boolean;
  seed?: number;
  fixed?: boolean;
}) {
  return (
    <div className={`${fixed ? 'fixed' : 'absolute'} inset-0 bg-transparent pointer-events-none`}>
      <Canvas camera={{ position: [0, 0, 8], fov: 60 }} gl={{ alpha: transparent }}>
        {!transparent && <color attach="background" args={['#000000']} />}
        {/* Lighting for 3D spheres */}
        <ambientLight intensity={0.3} />
        <pointLight position={[10, 10, 10]} intensity={1} color="#ffffff" />
        <pointLight position={[-10, -10, -5]} intensity={0.5} color="#aaaaff" />
        <Galaxy isSuccess={isSuccess} showGalaxy={showGalaxy} showSpheres={showSpheres} seed={seed} />
        <fog attach="fog" args={['#000000', 8, 25]} />
        
        <EffectComposer enableNormalPass={false}>
          <Bloom 
            intensity={1.5} 
            luminanceThreshold={0.1} 
            luminanceSmoothing={0.9} 
            mipmapBlur 
          />
        </EffectComposer>
      </Canvas>
      {/* Vignette overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.4) 100%)'
        }}
      />
    </div>
  );
}
