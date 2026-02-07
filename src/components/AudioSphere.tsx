"use client";

import { useRef, useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { Play, Pause } from 'lucide-react';
import VoiceSphere from './VoiceSphere';

interface AudioSphereProps {
  url: string;
  author: string;
  color?: string;
  color2?: string;
  isCurrentlyPlaying?: boolean;
  onPlay?: () => void;
  onStop?: () => void;
}

export default function AudioSphere({ url, author, color, color2, isCurrentlyPlaying, onPlay, onStop }: AudioSphereProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isActuallyPlaying, setIsActuallyPlaying] = useState(false); // Only true when audio is actually playing
  const [isLoading, setIsLoading] = useState(false);
  const sphereColor1 = color || '#00ed8eff';
  const sphereColor2 = color2 || '#0066ff';
  const [volume, setVolume] = useState(0);
  const [hasError, setHasError] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const authorLabel = author && author !== '想和你說' ? `${author} 的留言` : '我想說';

  // Stop playback when another audio starts playing
  useEffect(() => {
    if (isCurrentlyPlaying === false && isPlaying && audioRef.current) {
      audioRef.current.pause();
    }
  }, [isCurrentlyPlaying, isPlaying]);

  // Simulate volume animation only when actually playing (not loading)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isActuallyPlaying) {
      let time = 0;
      interval = setInterval(() => {
        time += 0.08;
        const pulse = 0.6 + Math.sin(time * 2.9) * 0.45 + Math.sin(time * 5.6) * 0.4;
        setVolume(Math.min(1, Math.max(0, pulse)));
      }, 50);
    } else {
      setVolume(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isActuallyPlaying]);

  const resetAudioRef = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    audioRef.current = null;
  };

  const handlePlaybackError = (error: unknown) => {
    const isAbortError = typeof DOMException !== 'undefined' && error instanceof DOMException &&
      ['AbortError', 'NotAllowedError', 'NotSupportedError'].includes(error.name);
    if (isAbortError) {
      setIsLoading(false);
      return;
    }
    console.error("Audio playback error:", error);
    setHasError(true);
    setIsLoading(false);
    resetAudioRef();
  };

  const togglePlay = async () => {
    setHasError(false);
    if (!audioRef.current) {
      setIsLoading(true);
      onPlay?.(); // Notify parent that this audio wants to play
      const audio = new Audio();
      audio.preload = 'auto';
      audio.src = url;
      audio.onplay = () => setIsPlaying(true);
      audio.onplaying = () => {
        setIsLoading(false);
        setIsActuallyPlaying(true); // Only animate when actually playing
      };
      audio.onpause = () => {
        setIsPlaying(false);
        setIsActuallyPlaying(false);
        setIsLoading(false);
        onStop?.();
      };
      audio.onended = () => {
        setIsPlaying(false);
        setIsActuallyPlaying(false);
        onStop?.();
      };
      audio.onerror = (e) => {
        console.error("Audio error:", e);
        setHasError(true);
        setIsLoading(false);
        setIsActuallyPlaying(false);
        onStop?.();
      };
      audioRef.current = audio;

      try {
        await audio.play();
      } catch (error) {
        handlePlaybackError(error);
      }
      return;
    }

    if (audioRef.current.paused) {
      setIsLoading(true);
      onPlay?.(); // Notify parent that this audio wants to play
      try {
        await audioRef.current.play();
      } catch (error) {
        handlePlaybackError(error);
      }
    } else {
      audioRef.current.pause();
      setIsLoading(false);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    togglePlay();
  };

  return (
    <div className="relative group cursor-pointer">
      <div className="w-[85vw] h-[85vw] md:w-72 md:h-72 overflow-hidden rounded-full bg-zinc-900 relative shadow-xl shadow-white/10" onClick={handleClick}>
        <div className="w-full h-full pointer-events-none">
          <Canvas camera={{ position: [0, 0, 5] }}>
            <VoiceSphere volume={volume} scale={3} color1={sphereColor1} color2={sphereColor2} />
          </Canvas>
        </div>
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 rounded-full pointer-events-none">
          {isPlaying ? <Pause size={32} className="text-white" /> : <Play size={32} className="text-white" />}
        </div>
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
            <span className="text-xs text-white/80 animate-pulse">留言下載中...</span>
          </div>
        )}
        {hasError && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full">
            <span className="text-xs text-red-400">無法播放</span>
          </div>
        )}
      </div>
      <div className="mt-4 text-center">
        <p className="text-xs tracking-widest text-white-500 uppercase drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">{authorLabel}</p>
      </div>
    </div>
  );
}
