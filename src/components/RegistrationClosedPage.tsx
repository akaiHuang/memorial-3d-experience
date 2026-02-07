"use client";

import React, { useCallback } from 'react';
import { motion } from 'framer-motion';
import gsap from 'gsap';
import ParticleBackground from '@/components/ParticleBackground';

interface RegistrationClosedPageProps {
  onNavigateToUpload?: () => void;
}

export default function RegistrationClosedPage({ onNavigateToUpload }: RegistrationClosedPageProps) {
  // GSAP 元素依序淡入動畫
  const animateContent = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    
    const elements = node.querySelectorAll('.gsap-fade-in');
    if (!elements.length) return;
    
    gsap.set(elements, { opacity: 0, y: 30 });
    
    gsap.to(elements, {
      opacity: 1,
      y: 0,
      duration: 0.8,
      stagger: 0.15,
      ease: 'power3.out',
      delay: 0.1,
    });
  }, []);

  return (
    <div className="relative flex items-center justify-center p-4 overflow-hidden bg-[#f5f3f0]" style={{ minHeight: '100dvh' }}>
      {/* Subtle Background Pattern */}
      <div className="fixed inset-0 z-0 opacity-30">
        <ParticleBackground isSuccess={false} showSpheres={true} showGalaxy={false} transparent={true} />
      </div>
      
      {/* Warm gradient overlay */}
      <div className="fixed inset-0 z-[1] pointer-events-none bg-gradient-to-b from-[#f5f3f0] via-transparent to-[#f5f3f0]" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-[150] w-[88%] max-w-[400px] flex flex-col"
      >
        <div 
          className="rounded-[3rem] border border-black/5 p-10" 
          style={{ 
            backgroundColor: "rgba(255,255,255,0.85)", 
            backdropFilter: "blur(10px)", 
            boxShadow: "0px 0px 60px 0px rgba(0,0,0,0.08)" 
          }}
        >
          <div ref={animateContent} className="flex flex-col items-center justify-center text-center space-y-6">
            {/* 標題 */}
            <h1 className="gsap-fade-in text-xl font-light tracking-[0.08em] text-black/80 opacity-0 leading-relaxed">
              這份想來的心，<br/>我們很珍惜
            </h1>
            
            {/* 第一段 */}
            <p className="gsap-fade-in text-black/60 text-sm leading-relaxed tracking-wide opacity-0">
              我們收到好多溫暖的心意，<br/>
              由衷感謝大家想來陪游老師。
            </p>

            {/* 第二段 - 報名額滿（強調） */}
            <p className="gsap-fade-in text-black/70 text-sm leading-relaxed tracking-wide opacity-0">
              因場地空間考量，<br/>
              <span className="underline underline-offset-4 decoration-black/40 italic">
                登記人數已達上限，先暫停實體報名。
              </span>
            </p>

            {/* 分隔線 */}
            <div className="gsap-fade-in w-8 h-px bg-black/20 opacity-0" />

            {/* 第三段 - 線上直播 */}
            <p className="gsap-fade-in text-black/60 text-sm leading-relaxed tracking-wide opacity-0">
              追思會當天將提供線上直播，<br/>
              連結將公告於游老師的{' '}
              <a 
                href="https://www.facebook.com/yingchang.yu" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-black/70 underline underline-offset-2 hover:text-black/90 transition-colors"
              >
                Facebook
              </a>，<br/>
              讓我們在同一個時間，一起想念。
            </p>

            {/* 分隔線 */}
            <div className="gsap-fade-in w-8 h-px bg-black/20 opacity-0" />

            {/* 第四段 - 投稿邀請 */}
            <p className="gsap-fade-in text-black/60 text-sm leading-relaxed tracking-wide opacity-0">
              想給游老師的文字與照片，<br/>
              投稿仍持續收件中，<br/>
              愛與祝福，都會被好好接住。
            </p>

            {/* CTA 按鈕 */}
            <div className="gsap-fade-in pt-4 w-full opacity-0">
              <button 
                onClick={onNavigateToUpload}
                className="w-full px-12 py-4 bg-black/80 text-white rounded-full text-sm tracking-[0.1em] hover:bg-black/70 transition-all"
              >
                我想投稿
              </button>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
