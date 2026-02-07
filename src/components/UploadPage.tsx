"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, MessageSquare, Mic, Plus, Square, ArrowLeft, Play } from 'lucide-react';
import gsap from 'gsap';
import ParticleBackground from '@/components/ParticleBackground';
import ParticleText from '@/components/ParticleText';
import VoiceSphere from '@/components/VoiceSphere';
import { Canvas } from '@react-three/fiber';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import type { Memory } from '@/types';
import { db, storage } from '@/lib/firebase';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { compressImage } from '@/lib/mediaCompression';

type Step = 
  | 'theme' 
  | 'instructions' 
  | 'selection' 
  | 'form-photo' 
  | 'form-photo-text'
  | 'form-photo-name'
  | 'form-text' 
  | 'preview' 
  | 'contact' 
  | 'thank-you' 
  | 'initial' | 'recording' | 'preview-recording' | 'success';

// Generate random colors with same hue but different saturation/lightness
function generateRandomSphereColors(): { color1: string; color2: string } {
  const hue = Math.floor(Math.random() * 360);
  return {
    color1: `hsl(${hue}, 50%, 84%)`,
    color2: `hsl(${(hue + 80) % 360}, 16%, 50%)`  // 色相偏移80度
  };
}

export default function UploadPage({ onComplete }: { onComplete: (memory: Memory) => void }) {
  const [step, setStep] = useState<Step>('theme');
  const [type, setType] = useState<'photo' | 'text' | 'audio' | null>(null);
  const [content, setContent] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [sphereColors, setSphereColors] = useState<{ color1: string; color2: string }>(generateRandomSphereColors());
  const [name, setName] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [docId, setDocId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null); // 暫存圖片文件
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string>(''); // 本地預覽 URL
  const [initialKey, setInitialKey] = useState(0); // Key to force remount on return
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const [previewVolume, setPreviewVolume] = useState(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [isSavingRecording, setIsSavingRecording] = useState(false);
  const [bgImageIndex, setBgImageIndex] = useState(0);
  const [isProcessingImage, setIsProcessingImage] = useState(false);
  const rsvpUrl = process.env.NEXT_PUBLIC_RSVP_URL;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioContextRef = useRef<AudioContext | null>(null);
  const previewAnalyserRef = useRef<AnalyserNode | null>(null);
  const previewAnimationRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const photoTextRef = useRef<HTMLTextAreaElement>(null);
  const { isRecording, startRecording, stopRecording, audioBlob, volume, resetRecording, requestPermission } = useAudioRecorder();

  // 背景圖片輪播
  useEffect(() => {
    const interval = setInterval(() => {
      setBgImageIndex((prev) => (prev % 10) + 1);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (step !== 'form-photo-text') return;
    if (!photoTextRef.current) return;
    photoTextRef.current.style.height = 'auto';
    photoTextRef.current.style.height = `${photoTextRef.current.scrollHeight}px`;
  }, [step, description]);

  // GSAP 首頁元素依序淡入動畫
  const animateContent = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    
    const elements = node.querySelectorAll('.gsap-fade-in');
    if (!elements.length) return;
    
    // Reset elements to initial state first
    gsap.set(elements, { opacity: 0, y: 30 });
    
    gsap.to(
      elements,
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        stagger: 0.15,
        ease: 'power3.out',
        delay: 0.1,
      }
    );
  }, []);

  useEffect(() => {
    if (step === 'initial') {
       setInitialKey(prev => prev + 1);
    }
  }, [step]);

  const handleUpload = (selectedType: 'photo' | 'text' | 'audio') => {
    setType(selectedType);
    if (selectedType === 'text') {
      setSphereColors(generateRandomSphereColors());
      setStep('form-text');
    } else if (selectedType === 'audio') {
      setSphereColors(generateRandomSphereColors()); // New random color each time
      setStep('recording');
    } else {
      setDescription('');
      setName('');
      setLocalPreviewUrl('');
      setPendingImageFile(null);
      setStep('form-photo');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIsProcessingImage(true);
      try {
        // Compress image to target 1-2MB (1.5MB target)
        const compressedFile = await compressImage(file, { 
          maxWidth: 1600, 
          quality: 85,
          targetSize: 1.5 * 1024 * 1024 // 1.5MB
        });
        console.log(`Image compressed: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB`);
        
        // 使用壓縮後的圖片做預覽
        const previewUrl = URL.createObjectURL(compressedFile);
        setLocalPreviewUrl(previewUrl);
        setPendingImageFile(compressedFile);
        setStep('form-photo');
      } catch (error) {
        console.error('Image compression failed, using original:', error);
        // Fallback to original file
        const previewUrl = URL.createObjectURL(file);
        setLocalPreviewUrl(previewUrl);
        setPendingImageFile(file);
        setStep('form-photo');
      } finally {
        setIsProcessingImage(false);
      }
    }
  };

  const handleStartRecordingWithCountdown = async () => {
    // Request microphone permission first
    const granted = await requestPermission();
    if (!granted) {
      alert('無法取得麥克風權限，請允許使用麥克風後再試一次');
      return;
    }
    
    // Start countdown after permission is granted
    setCountdown(3);
    let count = 3;
    const countdownInterval = setInterval(() => {
      count--;
      if (count > 0) {
        setCountdown(count);
      } else {
        setCountdown(null);
        clearInterval(countdownInterval);
        startRecording();
      }
    }, 1000);
  };

  const handleFinishRecording = async () => {
    setIsSavingRecording(true);
    stopRecording();
    setTimeout(() => {
      setIsSavingRecording(false);
      setStep('preview-recording');
    }, 1000);
  };

  const handleFinalSubmit = async () => {
    if (!type) return;

    let finalContent = content;
    setIsSubmitting(true);

    try {
      // 處理圖片上傳（延遲到這裡才上傳）
      if (type === 'photo' && pendingImageFile) {
        const storageRef = ref(storage, `memories/${Date.now()}_${pendingImageFile.name}`);
        await uploadBytes(storageRef, pendingImageFile);
        finalContent = await getDownloadURL(storageRef);
        // 釋放本地預覽 URL
        if (localPreviewUrl) {
          URL.revokeObjectURL(localPreviewUrl);
        }
      }
      
      // 處理音頻上傳
      if (type === 'audio' && audioBlob) {
        // Determine file extension from MIME type
        const mimeType = audioBlob.type;
        let ext = 'webm';
        if (mimeType.includes('mp4')) ext = 'm4a';
        else if (mimeType.includes('ogg')) ext = 'ogg';
        else if (mimeType.includes('webm')) ext = 'webm';
        
        const storageRef = ref(storage, `memories/${Date.now()}.${ext}`);
        await uploadBytes(storageRef, audioBlob);
        finalContent = await getDownloadURL(storageRef);
      }

      const memoryData: Omit<Memory, 'id'> = {
        type,
        content: finalContent,
        author: name || '想和你說',
        timestamp: Date.now(),
        phone,
        email,
        ...(type === 'audio' || type === 'text' ? { color: sphereColors.color1, color2: sphereColors.color2 } : {}),
        ...(type === 'photo' ? { description } : {}),
      };

      if (docId) {
        // Update existing document
        await updateDoc(doc(db, "memories", docId), memoryData);
        onComplete({
          id: docId,
          ...memoryData
        });
      } else {
        // Create new document
        const docRef = await addDoc(collection(db, "memories"), memoryData);
        setDocId(docRef.id);
        onComplete({
          id: docRef.id,
          ...memoryData
        });
      }
      
      if (step === 'contact') {
        setStep('thank-you');
      }
    } catch (error) {
      console.error("Submit failed:", error);
      alert("儲存失敗，請檢查 Firebase 設定");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex items-center justify-center p-4 overflow-hidden bg-black" style={{ minHeight: '100dvh' }}>
      {/* Background Particles - Deepest Layer (Stars only) */}
      <div className="fixed inset-0 z-0" style={{ top: 0, bottom: 0, left: 0, right: 0 }}>
        <ParticleBackground isSuccess={step === 'success'} showSpheres={false} />
      </div>
      
      {/* Background Image Layer */}
      <AnimatePresence>
        <motion.div
          key={bgImageIndex}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.25 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 2 }}
          className="fixed inset-0 z-[2] pointer-events-none"
          style={{
            backgroundImage: `url(/images/memorial/bg${bgImageIndex || 1}.webp)`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: 'grayscale(20%) contrast(110%)',
          }}
        />
      </AnimatePresence>
      
      {/* Foreground Particles - Floating over everything (Spheres only) */}
      <div className="fixed inset-0 z-[100] pointer-events-none" style={{ top: 0, bottom: 0, left: 0, right: 0 }}>
        <ParticleBackground isSuccess={step === 'success'} showGalaxy={false} showSpheres={true} transparent={true} />
      </div>
      {/* Vignette Overlay */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.6)_100%)] z-[5]" />
      
      <AnimatePresence mode="wait">
        {step === 'theme' && (
          <motion.div
            key="theme"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-[150] w-[90%] max-w-[400px] aspect-[11/16] flex flex-col"
          >
            <div className="absolute inset-0 rounded-[3rem] border border-white/10 z-0" style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)", boxShadow: "0px 0px 40px 0px white" }} />
            <div ref={animateContent} className="relative z-10 flex-1 flex flex-col items-center justify-center text-center p-7 space-y-4">
              <div className="space-y-2">
                <h1 className="gsap-fade-in text-2xl font-light tracking-[0.1em] text-white opacity-0">溫暖如光的建築人</h1>
                <h2 className="gsap-fade-in text-xl font-light tracking-[0.1em] text-white/90 opacity-0">游瑛樟老師追思會</h2>
              </div>
              <div className="space-y-4">
                <p className="gsap-fade-in text-white/50 text-sm leading-relaxed tracking-wide opacity-0">
                  如果你願意，<br/>請把記得的他，與我們分享。
                </p>
                <p className="gsap-fade-in text-white/50 text-sm leading-relaxed tracking-wide opacity-0">
                  我們正在準備追思會的主題展覽，<br/>
                  想邀請曾經走進游老師生命裡的你，<br/>
                  留下一張照片，與一段文字。<br/><br/>
                  也許很短暫，也許很深刻，<br/>
                  但，都是他生命裡，重要的一部分。
                </p>
              </div>
              <div className="gsap-fade-in pt-8 space-y-4 opacity-0">
                <button 
                  onClick={() => setStep('selection')}
                  className="w-full px-12 py-4 bg-white text-black rounded-full text-s tracking-[0.1em] hover:bg-white/90 transition-all"
                >
                  我要投稿
                </button>
                <button 
                  onClick={() => setStep('instructions')}
                  className="w-full px-12 py-4 border border-white/20 rounded-full text-s tracking-[0.1em] hover:bg-white/10 transition-all"
                >
                  想先看說明
                </button>
              </div>
              <p className="gsap-fade-in text-[11px] text-white/50 tracking-widest opacity-0">
                每一則投稿，都將被製作成展覽中的一件作品。
              </p>
            </div>
          </motion.div>
        )}

        {step === 'instructions' && (
          <motion.div
            key="instructions"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-[150] w-[90%] max-w-[400px] flex flex-col"
          >
            <button
              onClick={() => setStep('theme')}
              className="self-start mb-4 flex items-center gap-2 text-xs tracking-widest text-white/60 hover:text-white transition-colors px-6 py-3 rounded-full border border-white/10"
              style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)" }}
            >
              <ArrowLeft size={14} /> 返回
            </button>
            <div className="rounded-[3rem] border border-white/10 px-6 py-8" style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)", boxShadow: "0px 0px 40px 0px white" }}>
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <h3 className="text-lg font-light tracking-[0.1em]">你可以這樣留下回憶</h3>
              
              {/* Sample Image */}
              <div className="w-full aspect-video rounded-2xl overflow-hidden border border-white/10">
                <img src="/images/memorial/bg3.webp" alt="Sample" className="w-full h-full object-cover opacity-60" />
              </div>

              <div className="space-y-2 text-left w-full px-2">
                <div className="flex items-start gap-3 text-white-300">
                  <span className="text-white">✔</span>
                  <p className="text-sm tracking-wide">一張照片 ＋ 一段文字</p>
                </div>
                <div className="flex items-start gap-3 text-white-300">
                  <span className="text-white">✔</span>
                  <p className="text-sm tracking-wide">只寫一段文字，也可以</p>
                </div>
                <div className="flex items-start gap-3 text-white-300">
                  <span className="text-white">✔</span>
                  <p className="text-sm tracking-wide">不需要很完整、不需要很漂亮</p>
                </div>
              </div>
              <p className="text-white/70 text-sm leading-relaxed">
                如果不知道怎麼開始，<br/>只要寫下「你記得的他」，<br/>就夠了。
              </p>
              <button 
                onClick={() => setStep('selection')}
                className="w-full px-12 py-3 bg-white text-black rounded-full text-sm tracking-[0.1em] hover:bg-white/90 transition-all"
              >
                開始投稿
              </button>
            </div>
            </div>
          </motion.div>
        )}

        {step === 'selection' && (
          <motion.div
            key="selection"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-[150] w-[90%] max-w-[400px] flex flex-col"
          >
            <button
              onClick={() => setStep('theme')}
              className="self-start mb-4 flex items-center gap-2 text-xs tracking-widest text-white/60 hover:text-white transition-colors px-6 py-3 rounded-full border border-white/10"
              style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)" }}
            >
              <ArrowLeft size={14} /> 返回
            </button>
            <div className="rounded-[3rem] border border-white/10 p-8" style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)", boxShadow: "0px 0px 40px 0px white" }}>
            <div className="flex flex-col items-center justify-center text-center space-y-8">
              <div className="space-y-4">
                <p className="text-white/70 text-sm leading-relaxed tracking-wide">
                  有些故事，藏在照片裡，<br/>有些愛，可以好好地用文字梳理，<br/>形式不同，但，都是同一份記得。
                </p>
                <p className="text-white text-base tracking-widest">請選擇你最自在的方式。</p>
              </div>
              <div className="grid grid-cols-2 gap-4 w-full">
                <button onClick={() => handleUpload('photo')} className="flex flex-col items-center gap-3 p-5 rounded-3xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all group">
                  <Camera size={28} className="text-white/70 group-hover:text-white" />
                  <span className="text-sm tracking-wide whitespace-nowrap">照片＋文字</span>
                </button>
                <button onClick={() => handleUpload('text')} className="flex flex-col items-center gap-3 p-5 rounded-3xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all group">
                  <MessageSquare size={28} className="text-white/70 group-hover:text-white" />
                  <span className="text-sm tracking-wide whitespace-nowrap">純文字</span>
                </button>
              </div>
            </div>
            </div>
          </motion.div>
        )}

        {step === 'form-photo' && (
          <motion.div
            key="form-photo"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-[150] w-[90%] max-w-[400px] flex flex-col"
          >
            <button
              onClick={() => setStep('selection')}
              className="self-start mb-4 flex items-center gap-2 text-xs tracking-widest text-white/60 hover:text-white transition-colors px-6 py-3 rounded-full border border-white/10"
              style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)" }}
            >
              <ArrowLeft size={14} /> 返回
            </button>
            <div className="rounded-[3rem] border border-white/10 p-8" style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)", boxShadow: "0px 0px 40px 0px white" }}>
            <div className="flex flex-col">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-s tracking-widest text-white/80">上傳一張照片</label>
                  <p className="text-[13px] text-white-500 tracking-wide">任何一張，與游老師有關、對你有意義的照片，就算照片裡沒有游老師，也沒有關係。</p>
                  <div className="relative aspect-video rounded-2xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    {localPreviewUrl ? (
                      <img src={localPreviewUrl} alt="Preview" className="w-full h-full object-contain" />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-white/40 group-hover:text-white/70 transition-all">
                        <Camera size={24} />
                        <span className="text-[13px] tracking-widest">點擊，上傳照片</span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setStep('form-photo-text')}
                  disabled={!localPreviewUrl}
                  className="w-full py-4 bg-white text-black rounded-full text-s tracking-[0.1em] hover:bg-white/90 transition-all disabled:opacity-30"
                >
                  下一步
                </button>
              </div>
            </div>
            </div>
          </motion.div>
        )}

        {step === 'form-photo-text' && (
          <motion.div
            key="form-photo-text"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-[150] w-[90%] max-w-[400px] flex flex-col"
          >
            <button
              onClick={() => setStep('form-photo')}
              className="self-start mb-4 flex items-center gap-2 text-xs tracking-widest text-white/60 hover:text-white transition-colors px-6 py-3 rounded-full border border-white/10"
              style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)" }}
            >
              <ArrowLeft size={14} /> 返回
            </button>
            <div className="rounded-[3rem] border border-white/10 p-8" style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)", boxShadow: "0px 0px 40px 0px white" }}>
            <div className="flex flex-col space-y-6">
              <div className="space-y-2">
                <label className="text-s tracking-widest text-white/80">寫下你想說的話</label>
                <p className="text-[13px] text-white-500 tracking-wide">來不及說的，我們就用寫的。</p>
                <textarea
                  ref={photoTextRef}
                  value={description}
                  onChange={(e) => {
                    setDescription(e.target.value);
                    e.currentTarget.style.height = 'auto';
                    e.currentTarget.style.height = `${e.currentTarget.scrollHeight}px`;
                  }}
                  placeholder="開始寫下想說的話..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-base font-light resize-none min-h-[180px] max-h-[45vh] overflow-y-auto focus:border-white/30 outline-none transition-all"
                  rows={3}
                  autoFocus
                />
              </div>
              <button
                onClick={() => setStep('form-photo-name')}
                disabled={!description}
                className="w-full py-4 bg-white text-black rounded-full text-s tracking-[0.1em] hover:bg-white/90 transition-all disabled:opacity-30"
              >
                下一步
              </button>
            </div>
            </div>
          </motion.div>
        )}

        {step === 'form-photo-name' && (
          <motion.div
            key="form-photo-name"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-[150] w-[90%] max-w-[400px] flex flex-col"
          >
            <button
              onClick={() => setStep('form-photo-text')}
              className="self-start mb-4 flex items-center gap-2 text-xs tracking-widest text-white/60 hover:text-white transition-colors px-6 py-3 rounded-full border border-white/10"
              style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)" }}
            >
              <ArrowLeft size={14} /> 返回
            </button>
            <div className="rounded-[3rem] border border-white/10 p-8" style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)", boxShadow: "0px 0px 40px 0px white" }}>
            <div className="flex flex-col space-y-6">
              <div className="space-y-2">
                <label className="text-s tracking-widest text-white/80">署名</label>
                <p className="text-[13px] text-white-500 tracking-wide">你的名字 或 你希望呈現的稱呼。</p>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="你的名字"
                  className="w-full bg-white/5 border border-white/10 rounded-full px-6 py-3 text-s font-light focus:border-white/30 outline-none transition-all"
                  autoFocus
                />
              </div>
              <button
                onClick={() => setStep('preview')}
                disabled={!name}
                className="w-full py-4 bg-white text-black rounded-full text-s tracking-[0.1em] hover:bg-white/90 transition-all disabled:opacity-30"
              >
                看看預覽
              </button>
            </div>
            </div>
          </motion.div>
        )}

        {step === 'form-text' && (
          <motion.div
            key="form-text"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-[150] w-[90%] max-w-[400px] flex flex-col"
          >
            <button
              onClick={() => setStep('selection')}
              className="self-start mb-4 flex items-center gap-2 text-xs tracking-widest text-white/60 hover:text-white transition-colors px-6 py-3 rounded-full border border-white/10"
              style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)" }}
            >
              <ArrowLeft size={14} /> 返回
            </button>
            <div className="rounded-[3rem] border border-white/10 p-8" style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)", boxShadow: "0px 0px 40px 0px white" }}>
            <div className="flex flex-col space-y-6">
              <div className="space-y-2">
                <label className="text-s tracking-widest text-white/100">寫下你想說的話</label>
                <p className="text-[13px] text-white/70 tracking-wide">來不及說的，我們就用寫的。</p>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="寫下你想說的話..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl p-6 text-lg font-light resize-none h-64 focus:border-white/30 outline-none transition-all"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <label className="text-s tracking-widest text-white/80">署名</label>
                <p className="text-[13px] text-white-500 tracking-wide">你的名字 或 你希望呈現的稱呼。</p>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="你的名字"
                  className="w-full bg-white/5 border border-white/10 rounded-full px-6 py-3 text-s font-light focus:border-white/30 outline-none transition-all"
                />
              </div>
              <button
                onClick={() => setStep('preview')}
                disabled={!content || !name}
                className="w-full py-4 bg-white text-black rounded-full text-s tracking-[0.1em] hover:bg-white/90 transition-all disabled:opacity-30"
              >
                下一步
              </button>
            </div>
            </div>
          </motion.div>
        )}

        {step === 'preview' && (
          <motion.div
            key="preview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-[150] w-[90%] max-w-[400px] flex flex-col "
          >
              <button
                onClick={() => {
                if (type === 'photo') setStep('form-photo-name');
                else if (type === 'text') setStep('form-text');
                else if (type === 'audio') setStep('preview-recording');
              }}
              className="absolute -top-16 left-0 flex items-center gap-2 text-xs tracking-widest text-white-400 hover:text-white transition-colors px-7 py-3.5 rounded-full border border-white/10"
              style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)" }}
            >
              <ArrowLeft size={14} /> 返回
            </button>
            <div className="absolute inset-0 rounded-[3rem] border border-white/10 z-0" style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)", boxShadow: "0px 0px 40px 0px white" }} />
            <div className="relative z-10 flex-1 flex flex-col p-6 overflow-hidden">
              <h3 className="text-center text-s tracking-[0.1em] mb-4 text-white-400 shrink-0">預覽您的投稿</h3>
              
              <div className="flex-1 flex items-center justify-center min-h-0 overflow-y-auto custom-scrollbar">
                <div className="w-full bg-white/5 border border-white/10 rounded-3xl p-5 space-y-4 shadow-2xl">
                  {type === 'photo' && localPreviewUrl && (
                    <div className="aspect-square rounded-xl overflow-hidden border border-white/10">
                      <img src={localPreviewUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div className="space-y-3">
                    <p className="text-base font-light leading-relaxed text-white-200 italic break-words whitespace-pre-wrap max-h-[20vh] overflow-y-auto custom-scrollbar">
                      「{type === 'photo' ? description : content}」
                    </p>
                    <p className="text-right text-s tracking-widest text-white/60">— {name}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-3 shrink-0">
                <button
                  onClick={() => setStep('contact')}
                  className="w-full py-3.5 bg-white text-black rounded-full text-s tracking-[0.1em] hover:bg-white/90 transition-all"
                >
                  確認送出
                </button>
              <button
                  onClick={() => setStep(type === 'photo' ? 'form-photo-text' : 'form-text')}
                  className="w-full py-3.5 border border-white/20 rounded-full text-s tracking-[0.1em] hover:bg-white/10 transition-all"
                >
                  我想修改
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'contact' && (
          <motion.div
            key="contact"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-[150] w-[90%] max-w-[400px] flex flex-col "
          >
            <button
              onClick={() => setStep('preview')}
              className="absolute -top-16 left-0 flex items-center gap-2 text-xs tracking-widest text-white-400 hover:text-white transition-colors px-7 py-3.5 rounded-full border border-white/10"
              style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)" }}
            >
              <ArrowLeft size={14} /> 返回
            </button>
            <div className="absolute inset-0 rounded-[3rem] border border-white/10 z-0" style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)", boxShadow: "0px 0px 40px 0px white" }} />
            <div className="relative z-10 flex-1 flex flex-col p-6 space-y-6">
              <div className="space-y-4 text-center">
                <h3 className="text-xl font-light tracking-[0.1em]">留下可以找到你的方式</h3>
                {/* <p className="text-white-400 text-xs tracking-wide">我們會盡快送出追思會的活動邀請通知☺️</p> */}
              </div>
              
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-xs tracking-widest text-white/60 ml-4">電話</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="您的聯絡電話"
                    className="w-full bg-white/5 border border-white/10 rounded-full px-6 py-3 text-s font-light focus:border-white/30 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs tracking-widest text-white/60 ml-4">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="您的電子郵件"
                    className="w-full bg-white/5 border border-white/10 rounded-full px-6 py-3 text-s font-light focus:border-white/30 outline-none transition-all"
                  />
                </div>
              </div>

              <button
                onClick={() => handleFinalSubmit()}
                disabled={isSubmitting || !phone || !email}
                className="w-full py-4 bg-white text-black rounded-full text-s tracking-[0.1em] hover:bg-white/90 transition-all disabled:opacity-30 mt-auto"
              >
                {isSubmitting ? '傳送中...' : '送出'}
              </button>
            </div>
          </motion.div>
        )}

        {step === 'thank-you' && (
          <motion.div
            key="thank-you"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-[150] w-[90%] max-w-[400px] aspect-[11/16] flex flex-col"
          >
            <div className="absolute inset-0 rounded-[3rem] border border-white/10 z-0" style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)", boxShadow: "0px 0px 40px 0px white" }} />
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center p-8 space-y-8">
              <div className="space-y-4">
                <p className="text-xl font-light tracking-[0.1em]">
                  謝謝你，<br/>留下這一段美好時光，<br/>也留給游老師，<br/>這麼多的愛❤️
                </p>
                <p className="text-white/70 text-s leading-relaxed tracking-wide">
                  這份記憶，<br/>將成為追思會很重要的一部分。
                </p>
              </div>
              <div className="pt-8 w-full">
                <a
                  href="/rsvp?v=4"
                  className="block w-full px-8 py-4 bg-white text-black rounded-full text-s tracking-[0.1em] hover:bg-white/90 transition-all"
                >
                  1/24 追思會<br/>我想登記出席
                </a>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'initial' && (
          <motion.div
            key="initial"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-[150] w-[90%] max-w-[400px] aspect-[11/16] flex flex-col"
          >
            {/* Background Layer - Independent Opacity */}
            <div className="absolute inset-0 rounded-[3rem] border border-white/10 z-0" style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)", boxShadow: "0px 0px 40px 0px white" }} />
            
            {/* Content Layer */}
            <div ref={animateContent} className="relative z-10 flex-1 flex flex-col items-center justify-center text-center p-14 space-y-4">
              <div className="space-y-4">
                <div className="gsap-fade-in opacity-0 h-40 flex items-center justify-center" style={{ marginBottom: "calc(var(--spacing) * 7.5)" }}>
                  <ParticleText key={initialKey} text="Say" scale={1.5} />
                </div>
                <p className="gsap-fade-in text-white-300/80 text-s leading-relaxed tracking-wide px-4 opacity-0">
                  在這裡，思念會化作星辰。<br/>留下你想對他說的話、照片或聲音。
                </p>
              </div>

              <div className="gsap-fade-in flex justify-center gap-10 pt-8 opacity-0">
                <button onClick={() => handleUpload('photo')} disabled={isSubmitting} className="flex flex-col items-center gap-3 group disabled:opacity-50">
                  <div className="p-5 rounded-full border border-white/10 bg-white/5 group-hover:bg-white/10 group-hover:border-white/30 transition-all duration-500">
                    <Camera size={28} className="text-white/70 group-hover:text-white" />
                  </div>
                  <span className="text-s tracking-widest text-white group-hover:text-white/80 transition-colors">照片</span>
                </button>
                
                <button onClick={() => handleUpload('text')} disabled={isSubmitting} className="flex flex-col items-center gap-3 group disabled:opacity-50">
                  <div className="p-5 rounded-full border border-white/10 bg-white/5 group-hover:bg-white/10 group-hover:border-white/30 transition-all duration-500">
                    <MessageSquare size={28} className="text-white/70 group-hover:text-white" />
                  </div>
                  <span className="text-s tracking-widest text-white group-hover:text-white/80 transition-colors">文字</span>
                </button>

                <button onClick={() => handleUpload('audio')} disabled={isSubmitting} className="flex flex-col items-center gap-3 group disabled:opacity-50">
                  <div className="p-5 rounded-full border border-white/10 bg-white/5 group-hover:bg-white/10 group-hover:border-white/30 transition-all duration-500">
                    <Mic size={28} className="text-white/70 group-hover:text-white" />
                  </div>
                  <span className="text-s tracking-widest text-white group-hover:text-white/80 transition-colors">聲音</span>
                </button>
              </div>
              
            </div>
          </motion.div>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
          accept="image/*"
        />

        {step === 'recording' && (
          <motion.div
            key="recording"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-[150] w-[90%] max-w-[400px] aspect-[11/16] flex flex-col"
          >
            {/* Back Button - Outside Card */}
            <button
              onClick={() => setStep('selection')}
              className="absolute -top-16 left-0 flex items-center gap-2 text-xs tracking-widest text-white-400 hover:text-white transition-colors px-7 py-3.5 rounded-full border border-white/10"
              style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)" }}
            >
              <ArrowLeft size={14} /> 返回
            </button>
            
            {/* Background Layer */}
            <div className="absolute inset-0 rounded-[3rem] border border-white/10 z-0" style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)", boxShadow: "0px 0px 40px 0px white" }} />
            

            {/* Content Layer */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center p-12 space-y-12">
              <div className="relative w-full aspect-square max-w-[320px] mx-auto overflow-visible">
                <div className="absolute inset-[-20%] overflow-visible">
                  <Canvas camera={{ position: [0, 0, 8] }}>
                    <VoiceSphere volume={volume} scale={2} color1={sphereColors.color1} color2={sphereColors.color2} />
                  </Canvas>
                </div>
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  {countdown !== null ? (
                    <motion.div
                      key={countdown}
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 1.5, opacity: 0 }}
                      className="w-20 h-20 rounded-full bg-black/40 border border-white/10 flex items-center justify-center"
                    >
                      <span className="text-4xl font-light text-white">{countdown}</span>
                    </motion.div>
                  ) : (
                    <motion.div
                      animate={{ scale: isRecording ? [1, 1.1, 1] : 1 }}
                      transition={{ repeat: Infinity, duration: 2 }}
                      onClick={isRecording ? handleFinishRecording : handleStartRecordingWithCountdown}
                      className="w-20 h-20 rounded-full bg-black/40 border border-white/10 flex items-center justify-center cursor-pointer hover:bg-black/60 transition-colors"
                    >
                      <Mic size={32} className={isRecording ? 'text-red-500' : 'text-white'} />
                    </motion.div>
                  )}
                </div>
                {isRecording && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute -top-8 left-1/2 -translate-x-1/2 text-red-500 text-xs tracking-widest"
                  >
                    REC
                  </motion.div>
                )}
                {countdown !== null && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute -top-8 left-1/2 -translate-x-1/2 text-white/60 text-xs tracking-widest"
                  >
                    準備中...
                  </motion.div>
                )}
              </div>
              
              <div className="space-y-4">
                {isSavingRecording ? (
                  <button
                    disabled
                    className="px-10 py-4 rounded-full border border-white/10 text-s tracking-[0.1em] text-white/40 flex items-center gap-3 mx-auto cursor-not-allowed"
                  >
                    <span className="animate-pulse">儲存中...</span>
                  </button>
                ) : countdown !== null ? (
                  <div className="px-10 py-4 text-white/60 text-s tracking-[0.1em]">
                    即將開始錄音
                  </div>
                ) : isRecording ? (
                  <button
                    onClick={handleFinishRecording}
                    className="px-10 py-4 rounded-full border border-white/20 text-s tracking-[0.1em] hover:bg-white/10 transition-all flex items-center gap-3 mx-auto"
                  >
                    <Square size={16} /> 停止並儲存
                  </button>
                ) : (
                  <button
                    onClick={handleStartRecordingWithCountdown}
                    className="px-10 py-4 rounded-full bg-white text-black text-s tracking-[0.1em] hover:bg-gray-200 transition-all shadow-lg"
                  >
                    開始錄音
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {step === 'preview-recording' && (
          <motion.div
            key="preview-recording"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-[150] w-[90%] max-w-[400px] aspect-[11/16] flex flex-col"
          >
            <button
              onClick={() => setStep('recording')}
              className="absolute -top-16 left-0 flex items-center gap-2 text-xs tracking-widest text-white-400 hover:text-white transition-colors px-7 py-3.5 rounded-full border border-white/10"
              style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)" }}
            >
              <ArrowLeft size={14} /> 返回
            </button>
            {/* Background Layer */}
            <div className="absolute inset-0 rounded-[3rem] border border-white/10 z-0" style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)", boxShadow: "0px 0px 40px 0px white" }} />
            
            {/* Content Layer */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="space-y-4 mb-4">
                <p className="text-2xl font-light tracking-wide">聽聽看</p>
                <p className="text-white-400 text-s tracking-widest">確認你的錄音</p>
              </div>
              
              {/* VoiceSphere with Play Button */}
              <div className="relative w-full aspect-square max-w-[280px] mx-auto overflow-visible mb-4">
                <div className="absolute inset-[-20%] overflow-visible">
                  <Canvas camera={{ position: [0, 0, 8] }}>
                    <VoiceSphere volume={previewVolume} scale={2} color1={sphereColors.color1} color2={sphereColors.color2} />
                  </Canvas>
                </div>
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <motion.div
                    animate={{ scale: isPlayingPreview ? [1, 1.1, 1] : 1 }}
                    transition={{ repeat: Infinity, duration: 2 }}
                    onClick={() => {
                      if (!audioBlob) return;
                      
                      if (isPlayingPreview && audioRef.current) {
                        audioRef.current.pause();
                        audioRef.current.currentTime = 0;
                        setIsPlayingPreview(false);
                        setPreviewVolume(0);
                        if (previewAnimationRef.current) {
                          cancelAnimationFrame(previewAnimationRef.current);
                        }
                        if (previewAudioContextRef.current) {
                          previewAudioContextRef.current.close();
                        }
                      } else {
                        const url = URL.createObjectURL(audioBlob);
                        const audio = new Audio(url);
                        audioRef.current = audio;
                        
                        // Set up audio analysis for preview
                        const AudioContextClass = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
                        if (!AudioContextClass) return;
                        const audioCtx = new AudioContextClass();
                        const source = audioCtx.createMediaElementSource(audio);
                        const analyser = audioCtx.createAnalyser();
                        analyser.fftSize = 256;
                        source.connect(analyser);
                        analyser.connect(audioCtx.destination);
                        previewAudioContextRef.current = audioCtx;
                        previewAnalyserRef.current = analyser;
                        
                        const updatePreviewVolume = () => {
                          if (previewAnalyserRef.current) {
                            const dataArray = new Uint8Array(previewAnalyserRef.current.frequencyBinCount);
                            previewAnalyserRef.current.getByteFrequencyData(dataArray);
                            const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length / 255;
                            setPreviewVolume(avg);
                          }
                          previewAnimationRef.current = requestAnimationFrame(updatePreviewVolume);
                        };
                        updatePreviewVolume();
                        
                        audio.onended = () => {
                          setIsPlayingPreview(false);
                          setPreviewVolume(0);
                          URL.revokeObjectURL(url);
                          if (previewAnimationRef.current) {
                            cancelAnimationFrame(previewAnimationRef.current);
                          }
                          if (previewAudioContextRef.current) {
                            previewAudioContextRef.current.close();
                          }
                        };
                        audio.play();
                        setIsPlayingPreview(true);
                      }
                    }}
                    className="w-20 h-20 rounded-full bg-black/40 border border-white/10 flex items-center justify-center cursor-pointer hover:bg-black/60 transition-colors"
                  >
                    {isPlayingPreview ? (
                      <Square size={28} className="text-white" />
                    ) : (
                      <Play size={32} className="text-white ml-1" />
                    )}
                  </motion.div>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="space-y-4 w-full max-w-[280px] relative z-20">
                <button
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.pause();
                    }
                    setIsPlayingPreview(false);
                    setPreviewVolume(0);
                    if (previewAnimationRef.current) {
                      cancelAnimationFrame(previewAnimationRef.current);
                    }
                    if (previewAudioContextRef.current) {
                      previewAudioContextRef.current.close();
                    }
                    setStep('preview');
                  }}
                  className="w-full px-8 py-4 rounded-full bg-white/10 border border-white/20 text-s tracking-[0.1em] hover:bg-white/20 transition-all"
                >
                  確認送出
                </button>
                <button
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.pause();
                    }
                    setIsPlayingPreview(false);
                    setPreviewVolume(0);
                    if (previewAnimationRef.current) {
                      cancelAnimationFrame(previewAnimationRef.current);
                    }
                    if (previewAudioContextRef.current) {
                      previewAudioContextRef.current.close();
                    }
                    resetRecording();
                    setStep('recording');
                  }}
                  className="w-full px-8 py-3 rounded-full border border-white/10 text-s tracking-[0.1em] text-white-400 hover:text-white hover:border-white/20 transition-all"
                >
                  重新錄製
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {step === 'success' && (
          <motion.div
            key="success"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-[150] w-[90%] max-w-[400px] aspect-[11/16] flex flex-col"
          >
            {/* Background Layer */}
            <div className="absolute inset-0 rounded-[3rem] border border-white/10 z-0" style={{ backgroundColor: "color-mix(in oklab, #141414 81%, transparent)", backdropFilter: "blur(5px)", boxShadow: "0px 0px 40px 0px white" }} />
            

            {/* Content Layer */}
            <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center p-12 space-y-12">
              <div className="space-y-6">
                <div className="w-16 h-16 rounded-full border border-white/20 flex items-center justify-center mx-auto mb-8">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 12 }}
                  >
                    <Plus size={32} className="rotate-45" />
                  </motion.div>
                </div>
                <p className="text-3xl font-light tracking-[0.1em]">思念已化作星辰</p>
              </div>

              <div className="flex flex-col items-center gap-6 mt-8">
                <button
                  onClick={() => {
                    setStep('initial');
                    setContent('');
                    setName('');
                    setType(null);
                  }}
                  className="flex items-center gap-3 text-s tracking-[0.1em] text-white hover:text-white-300 transition-colors"
                >
                  <Plus size={18} /> 我還有話想說
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Processing Overlay */}
      {isProcessingImage && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-white text-lg tracking-[0.1em] font-light animate-pulse">
            上傳中...
          </div>
        </div>
      )}
    </div>
  );
}
