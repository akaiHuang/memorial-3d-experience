"use client";

import React, { useRef, useEffect, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ImageParticlesProps {
  url: string;
  count?: number;
  size?: number;
  spread?: number;
}

export default function ImageParticles({ url, count = 10000, size = 0.02, spread = 5 }: ImageParticlesProps) {
  const mesh = useRef<THREE.Points>(null!);
  const [positions, setPositions] = useState<Float32Array | null>(null);
  const [colors, setColors] = useState<Float32Array | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const w = 100;
      const h = Math.floor(100 * (img.height / img.width));
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h).data;

      const pos = new Float32Array(count * 3);
      const cols = new Float32Array(count * 3);

      const spreadX = spread;
      const spreadY = spread * (h / w);

      for (let i = 0; i < count; i++) {
        let x, y, r, g, b, a;
        let found = false;
        let attempts = 0;

        while (!found && attempts < 50) {
          const ix = Math.floor(Math.random() * w);
          const iy = Math.floor(Math.random() * h);
          const idx = (iy * w + ix) * 4;
          
          r = imageData[idx] / 255;
          g = imageData[idx + 1] / 255;
          b = imageData[idx + 2] / 255;
          a = imageData[idx + 3] / 255;

          if (a > 0.1) {
            x = (ix / w - 0.5) * spreadX;
            y = (0.5 - iy / h) * spreadY;
            found = true;
          }
          attempts++;
        }

        if (!found) {
          x = (Math.random() - 0.5) * spreadX;
          y = (Math.random() - 0.5) * spreadY;
          r = g = b = 0;
        }

        pos[i * 3] = x!;
        pos[i * 3 + 1] = y!;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 0.2;

        cols[i * 3] = r!;
        cols[i * 3 + 1] = g!;
        cols[i * 3 + 2] = b!;
      }

      setPositions(pos);
      setColors(cols);
    };
  }, [url, count, spread]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (mesh.current) {
      mesh.current.rotation.y = Math.sin(time * 0.2) * 0.1;
      mesh.current.rotation.x = Math.cos(time * 0.2) * 0.1;
    }
  });

  if (!positions || !colors) return null;

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={size}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
