"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import PhotoCard from '@/components/PhotoCard';
import AudioSphere from '@/components/AudioSphere';
import TextCard from '@/components/TextCard';
import ParticleBackground from '@/components/ParticleBackground';
import type { Memory } from '@/types';
import { ArrowLeft, X, Trash2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

export default function GalleryPage({ memories, isLoading }: { memories: Memory[]; isLoading?: boolean }) {
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  const [bgImageIndex] = useState(Math.floor(Math.random() * 10) + 1);

  return (
    <div className="min-h-screen bg-black p-8 md:p-20 relative overflow-hidden">
      <ParticleBackground fixed />
      
      {/* Background Image Layer */}
      <div 
        className="fixed inset-0 z-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `url(/images/memorial/bg${bgImageIndex}.jpg)`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          filter: 'grayscale(30%) blur(2px)',
        }}
      />
      
      <div className="max-w-7xl mx-auto relative z-10">
        <header className="flex justify-between items-center mb-20">
          <button
            onClick={() => window.location.hash = ''}
            className="flex items-center gap-2 text-xs tracking-widest text-white-400 hover:text-white transition-colors px-7 py-3.5 rounded-full border border-white/10 drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]"
            style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)" }}
          >
            <ArrowLeft size={14} /> 返回
          </button>
          <h2 className="text-2xl font-light tracking-[0.5em] uppercase drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">藝廊</h2>
          <div className="w-[88px]" /> {/* Spacer for layout balance */}
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-16 justify-items-center">
          {isLoading ? (
            <div className="col-span-full text-center py-40 text-s tracking-[0.4em] text-white/40 uppercase">
              資料載入中，請稍候...
            </div>
          ) : memories.length > 0 ? (
            memories.map((memory, index) => (
              <motion.div
                key={memory.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.1 }}
                className="relative group/card"
              >
                {memory.type === 'photo' && (
                  <PhotoCard url={memory.content} author={memory.author || '想和你說'} description={memory.description} />
                )}
                {memory.type === 'audio' && (
                  <AudioSphere 
                    url={memory.content} 
                    author={memory.author || '想和你說'} 
                    color={memory.color} 
                    color2={memory.color2}
                    isCurrentlyPlaying={currentlyPlayingId === memory.id}
                    onPlay={() => setCurrentlyPlayingId(memory.id)}
                    onStop={() => setCurrentlyPlayingId(prev => prev === memory.id ? null : prev)}
                  />
                )}
                {memory.type === 'text' && (
                  <TextCard content={memory.content} author={memory.author || '想和你說'} color={memory.color} color2={memory.color2} />
                )}
              </motion.div>
            ))
          ) : (
            <div className="col-span-full text-center py-40 flex flex-col items-center gap-8">
              <p className="text-white font-light tracking-widest" style={{ textShadow: "0 0px 5px rgba(0, 0, 0, 0.9)" }}>開始留下你的思念</p>
              <button
                onClick={() => window.location.hash = ''}
                className="px-8 py-3 text-s tracking-[0.1em] text-white-300 hover:text-white transition-colors rounded-full border border-white/20 hover:border-white/40"
                style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)" }}
              >
                開始
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
