"use client";

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Calendar, Clock, MapPin, Shirt, Users, Check } from 'lucide-react';
import gsap from 'gsap';
import ParticleBackground from '@/components/ParticleBackground';
import { db } from '@/lib/firebase';
import { collection, addDoc } from 'firebase/firestore';

type Step = 
  | 'theme' 
  | 'info' 
  | 'schedule' 
  | 'form' 
  | 'story-ask'
  | 'story-form'
  | 'thank-you';

type Relationship = 'student' | 'friend' | 'colleague' | 'classmate' | 'other';

interface RSVPData {
  name: string;
  phone: string;
  email: string;
  attendeeCount: number;
  note: string;
  wantToShare: boolean;
  relationship?: Relationship;
  relationshipOther?: string;
}

export default function RSVPPage({ onNavigateToUpload }: { onNavigateToUpload?: () => void }) {
  const [step, setStep] = useState<Step>('theme');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<RSVPData>({
    name: '',
    phone: '',
    email: '',
    attendeeCount: 1,
    note: '',
    wantToShare: false,
    relationship: undefined,
    relationshipOther: '',
  });

  // GSAP 首頁元素依序淡入動畫
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

  const handleSubmitRSVP = async () => {
    if (!formData.name || !formData.phone) return;
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "rsvp"), {
        name: formData.name,
        phone: formData.phone,
        email: formData.email || '',
        attendeeCount: formData.attendeeCount,
        note: formData.note || '',
        timestamp: Date.now(),
      });
      
      setStep('story-ask');
    } catch (error) {
      console.error("Submit failed:", error);
      alert("報名失敗，請稍後再試");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitStory = async () => {
    if (!formData.relationship) return;
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "story-sharing"), {
        name: formData.name,
        phone: formData.phone,
        email: formData.email || '',
        relationship: formData.relationship,
        relationshipOther: formData.relationshipOther || '',
        timestamp: Date.now(),
      });
      
      setStep('thank-you');
    } catch (error) {
      console.error("Submit failed:", error);
      alert("報名失敗，請稍後再試");
    } finally {
      setIsSubmitting(false);
    }
  };

  const relationshipOptions: { value: Relationship; label: string }[] = [
    { value: 'student', label: '學生' },
    { value: 'friend', label: '朋友' },
    { value: 'colleague', label: '同事' },
    { value: 'classmate', label: '同學' },
    { value: 'other', label: '其他' },
  ];

  return (
    <div className="relative flex items-center justify-center p-4 overflow-hidden bg-[#f5f3f0]" style={{ minHeight: '100dvh' }}>
      {/* Subtle Background Pattern */}
      <div className="fixed inset-0 z-0 opacity-30">
        <ParticleBackground isSuccess={false} showSpheres={true} showGalaxy={false} transparent={true} />
      </div>
      
      {/* Warm gradient overlay */}
      <div className="fixed inset-0 z-[1] pointer-events-none bg-gradient-to-b from-[#f5f3f0] via-transparent to-[#f5f3f0]" />
      
      <AnimatePresence mode="wait">
        {/* 主題頁 */}
        {step === 'theme' && (
          <motion.div
            key="theme"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-[150] w-[88%] max-w-[400px] flex flex-col"
          >
            <div className="rounded-[3rem] border border-black/5 p-10" style={{ backgroundColor: "rgba(255,255,255,0.85)", backdropFilter: "blur(10px)", boxShadow: "0px 0px 60px 0px rgba(0,0,0,0.08)" }}>
              <div ref={animateContent} className="flex flex-col items-center justify-center text-center space-y-6">
                <div className="space-y-2">
                  <h1 className="gsap-fade-in text-2xl font-light tracking-[0.1em] text-black/80 opacity-0">溫暖如光的建築人</h1>
                  <h2 className="gsap-fade-in text-xl font-light tracking-[0.1em] text-black/70 opacity-0">游瑛樟老師追思會</h2>
                </div>
                
                <div className="space-y-4">
                  <p className="gsap-fade-in text-black/60 text-base leading-relaxed tracking-wide opacity-0">
                    <span className="text-lg font-medium text-black/80">1/24</span> 我們想邀請你，<br/>
                    一起來坐一下，<br/>
                    把對游老師的想念，好好說給他聽。
                  </p>
                  <p className="gsap-fade-in text-black/50 text-sm leading-relaxed tracking-wide opacity-0">
                    這是一場紀念與分享的追思聚會，<br/>
                    邀請曾經與他相遇、同行、<br/>
                    以及受他影響的你 出席。
                  </p>
                </div>

                <div className="gsap-fade-in pt-6 w-full opacity-0">
                  <button 
                    onClick={() => setStep('info')}
                    className="w-full px-12 py-4 bg-black/80 text-white rounded-full text-sm tracking-[0.1em] hover:bg-black/70 transition-all"
                  >
                    查看活動資訊
                  </button>
                </div>

                <p className="gsap-fade-in text-[11px] text-black/40 leading-relaxed tracking-wide opacity-0">
                  像是一次回來坐坐，<br/>
                  和游老師一起在學校裡聊聊天。
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* 活動資訊頁 */}
        {step === 'info' && (
          <motion.div
            key="info"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-[150] w-[88%] max-w-[400px] flex flex-col"
          >
            <button
              onClick={() => setStep('theme')}
              className="self-start mb-4 flex items-center gap-2 text-xs tracking-widest text-black/50 hover:text-black/80 transition-colors px-6 py-3 rounded-full border border-black/10"
              style={{ backgroundColor: "rgba(255,255,255,0.8)", backdropFilter: "blur(5px)" }}
            >
              <ArrowLeft size={14} /> 返回
            </button>
            <div className="rounded-[3rem] border border-black/5 p-10" style={{ backgroundColor: "rgba(255,255,255,0.85)", backdropFilter: "blur(10px)", boxShadow: "0px 0px 60px 0px rgba(0,0,0,0.08)" }}>
              <div className="flex flex-col space-y-6">
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <Calendar size={20} className="text-black/40 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-black/50 tracking-wide">日期</p>
                      <p className="text-lg font-medium text-black/80">1 / 24（六）</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <Clock size={20} className="text-black/40 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-black/50 tracking-wide">時間</p>
                      <p className="text-base text-black/80">13:30 開放進場</p>
                      <p className="text-base text-black/80">14:35 活動開始</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <MapPin size={20} className="text-black/40 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-black/50 tracking-wide">地點</p>
                      <p className="text-base text-black/80">淡江大學 黑天鵝展廳</p>
                      <p className="text-sm text-black/50">（建築系館對面）</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <Shirt size={20} className="text-black/40 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-black/50 tracking-wide">服裝</p>
                      <p className="text-base text-black/80">黑色</p>
                      <p className="text-sm text-black/50">（一起穿游老師最愛的穿搭色）</p>
                    </div>
                  </div>
                  
                  <div className="flex items-start gap-4">
                    <Users size={20} className="text-black/40 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-black/50 tracking-wide">形式</p>
                      <p className="text-base text-black/80">分享與紀念時刻</p>
                      <p className="text-base text-black/80">靜態展區參與</p>
                      <p className="text-base text-black/80">系館前大合照</p>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-black/50 tracking-wide text-center">
                  👉 現場備有下午茶點，<br/>我們一起邊吃喝邊聊天。
                </p>

                <button 
                  onClick={() => setStep('schedule')}
                  className="w-full px-12 py-4 bg-black/80 text-white rounded-full text-sm tracking-[0.0em] hover:bg-black/70 transition-all"
                >
                  查看活動內容與流程
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* 活動流程頁 */}
        {step === 'schedule' && (
          <motion.div
            key="schedule"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-[150] w-[88%] max-w-[400px] flex flex-col"
          >
            <button
              onClick={() => setStep('info')}
              className="self-start mb-4 flex items-center gap-2 text-xs tracking-widest text-black/50 hover:text-black/80 transition-colors px-6 py-3 rounded-full border border-black/10"
              style={{ backgroundColor: "rgba(255,255,255,0.8)", backdropFilter: "blur(5px)" }}
            >
              <ArrowLeft size={14} /> 返回
            </button>
            <div className="rounded-[3rem] border border-black/5 p-8" style={{ backgroundColor: "rgba(255,255,255,0.85)", backdropFilter: "blur(10px)", boxShadow: "0px 0px 60px 0px rgba(0,0,0,0.08)" }}>
              <div className="flex flex-col space-y-6">
                {/* 入場時間 */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-black/40 tracking-wider">13:30-14:35</span>
                    <span className="text-sm font-medium text-black/70">入場時間</span>
                  </div>
                  <div className="pl-4 border-l-2 border-black/10 space-y-1">
                    <p className="text-sm text-black/60">在他生命中的你-回憶主題展</p>
                    <p className="text-sm text-black/60">寫給瑛樟的信-留言書寫</p>
                    <p className="text-sm text-black/60">茶敘聊瑛樟</p>
                  </div>
                </div>

                {/* 活動開始 */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-black/40 tracking-wider">14:35-15:20</span>
                    <span className="text-sm font-medium text-black/70">活動開始</span>
                  </div>
                  <div className="pl-4 border-l-2 border-black/10 space-y-1">
                    <p className="text-sm text-black/60">影片播放</p>
                    <p className="text-sm text-black/60">我們與他的故事-致詞與分享</p>
                    <p className="text-sm text-black/60">現場互動時間-還有誰想說愛他?</p>
                  </div>
                </div>

                {/* 儀式時間 */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-black/40 tracking-wider">15:20-15:25</span>
                    <span className="text-sm font-medium text-black/70">儀式時間</span>
                  </div>
                  <div className="pl-4 border-l-2 border-black/10 space-y-1">
                    <p className="text-sm text-black/60">點亮真情樹</p>
                    <p className="text-sm text-black/60">送給你們的小禮物</p>
                  </div>
                </div>

                {/* 大合照 */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-medium text-black/40 tracking-wider">15:25-15:35</span>
                    <span className="text-sm font-medium text-black/70">系館大合照</span>
                  </div>
                  <div className="pl-4 border-l-2 border-black/10 space-y-1">
                    <p className="text-sm text-black/60">我們一起留一張合照給瑛樟</p>
                  </div>
                </div>

                <button 
                  onClick={() => setStep('form')}
                  className="w-full px-12 py-4 bg-black/80 text-white rounded-full text-sm tracking-[0.1em] hover:bg-black/70 transition-all"
                >
                  我想登記出席
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* 報名表單頁 */}
        {step === 'form' && (
          <motion.div
            key="form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-[150] w-[88%] max-w-[400px] flex flex-col"
          >
            <button
              onClick={() => setStep('schedule')}
              className="self-start mb-4 flex items-center gap-2 text-xs tracking-widest text-black/50 hover:text-black/80 transition-colors px-6 py-3 rounded-full border border-black/10"
              style={{ backgroundColor: "rgba(255,255,255,0.8)", backdropFilter: "blur(5px)" }}
            >
              <ArrowLeft size={14} /> 返回
            </button>
            <div className="rounded-[3rem] border border-black/5 p-8" style={{ backgroundColor: "rgba(255,255,255,0.85)", backdropFilter: "blur(10px)", boxShadow: "0px 0px 60px 0px rgba(0,0,0,0.08)" }}>
              <div className="flex flex-col space-y-6">
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-light tracking-[0.1em] text-black/80">留一個位置給你</h3>
                  <p className="text-sm text-black/50 leading-relaxed">
                    為了準備座位與場地安排，<br/>請留下簡單的出席資訊。
                  </p>
                  <p className="text-xs text-black/40">
                    （資料只用於本次活動聯繫，請不用擔心。）
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm text-black/60 tracking-wide">姓名 *</label>
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="你的名字"
                      className="w-full bg-black/5 border border-black/10 rounded-full px-6 py-3 text-sm text-black/80 placeholder:text-black/30 focus:border-black/30 outline-none transition-all"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm text-black/60 tracking-wide">電話 *</label>
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="聯絡電話"
                      className="w-full bg-black/5 border border-black/10 rounded-full px-6 py-3 text-sm text-black/80 placeholder:text-black/30 focus:border-black/30 outline-none transition-all"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm text-black/60 tracking-wide">Email</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="電子郵件"
                      className="w-full bg-black/5 border border-black/10 rounded-full px-6 py-3 text-sm text-black/80 placeholder:text-black/30 focus:border-black/30 outline-none transition-all"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm text-black/60 tracking-wide">出席人數</label>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setFormData({ ...formData, attendeeCount: Math.max(1, formData.attendeeCount - 1) })}
                        className="w-10 h-10 rounded-full border border-black/10 bg-black/5 text-black/60 hover:bg-black/10 transition-all"
                      >
                        -
                      </button>
                      <span className="text-lg font-medium text-black/80 w-8 text-center">{formData.attendeeCount}</span>
                      <button
                        onClick={() => setFormData({ ...formData, attendeeCount: formData.attendeeCount + 1 })}
                        className="w-10 h-10 rounded-full border border-black/10 bg-black/5 text-black/60 hover:bg-black/10 transition-all"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm text-black/60 tracking-wide">備註</label>
                    <textarea
                      value={formData.note}
                      onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                      placeholder="有什麼想跟我們說的..."
                      className="w-full bg-black/5 border border-black/10 rounded-2xl px-6 py-4 text-sm text-black/80 placeholder:text-black/30 focus:border-black/30 outline-none transition-all resize-none h-24"
                    />
                  </div>
                </div>

                <button 
                  onClick={handleSubmitRSVP}
                  disabled={!formData.name || !formData.phone || isSubmitting}
                  className="w-full px-12 py-4 bg-black/80 text-white rounded-full text-sm tracking-[0.1em] hover:bg-black/70 transition-all disabled:opacity-30"
                >
                  {isSubmitting ? '送出中...' : '送出報名'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* 故事分享邀請頁 */}
        {step === 'story-ask' && (
          <motion.div
            key="story-ask"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-[150] w-[88%] max-w-[400px] flex flex-col"
          >
            <div className="rounded-[3rem] border border-black/5 p-6" style={{ backgroundColor: "rgba(255,255,255,0.85)", backdropFilter: "blur(10px)", boxShadow: "0px 0px 60px 0px rgba(0,0,0,0.08)" }}>
              <div className="flex flex-col items-center text-center space-y-6">
                <div className="space-y-4">
                  <p className="text-black/50 text-sm leading-relaxed tracking-wide">
                    也許曾經是學生、朋友、同事，<br/>
                    也許你只是在人生某個路口，<br/>
                    讓他陪你走了一小段。
                  </p>
                  <p className="text-black/50 text-sm leading-relaxed tracking-wide">
                    我們想留一個午後，<br/>
                    讓大家把這些片刻，<br/>
                    放回心裡。
                  </p>
                </div>

                <div className="space-y-2 pt-4">
                  <h3 className="text-xl font-light tracking-[0.1em] text-black/80">如果你願意，</h3>
                  <h3 className="text-xl font-light tracking-[0.1em] text-black/80">我們想聽你說一段故事。</h3>
                </div>

                <p className="text-sm text-black/50 leading-relaxed">
                  追思會當天，<br/>
                  會有一個 2 分鐘的說故事分享，<br/>
                  想邀請你，分享你與游老師的相處時刻，<br/>
                  那一定是一段很有趣的回憶。
                </p>

                <div className="pt-4 w-full space-y-3">
                  <button 
                    onClick={() => setStep('story-form')}
                    className="w-full px-5 py-4 bg-black/80 text-white rounded-full text-sm tracking-[0.1em] hover:bg-black/70 transition-all"
                  >
                    我想加碼報名親口說故事分享
                  </button>
                  <button 
                    onClick={() => setStep('thank-you')}
                    className="w-full px-12 py-4 border border-black/20 text-black/60 rounded-full text-sm tracking-[0.1em] hover:bg-black/5 transition-all"
                  >
                    先不用，謝謝
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* 故事分享報名頁 */}
        {step === 'story-form' && (
          <motion.div
            key="story-form"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-[150] w-[88%] max-w-[400px] flex flex-col"
          >
            <button
              onClick={() => setStep('story-ask')}
              className="self-start mb-4 flex items-center gap-2 text-xs tracking-widest text-black/50 hover:text-black/80 transition-colors px-6 py-3 rounded-full border border-black/10"
              style={{ backgroundColor: "rgba(255,255,255,0.8)", backdropFilter: "blur(5px)" }}
            >
              <ArrowLeft size={14} /> 返回
            </button>
            <div className="rounded-[3rem] border border-black/5 p-10" style={{ backgroundColor: "rgba(255,255,255,0.85)", backdropFilter: "blur(10px)", boxShadow: "0px 0px 60px 0px rgba(0,0,0,0.08)" }}>
              <div className="flex flex-col space-y-6">
                <div className="space-y-2">
                  <h3 className="text-lg font-light tracking-[0.1em] text-black/80">你與游老師的關係</h3>
                </div>

                <div className="space-y-3">
                  {relationshipOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setFormData({ ...formData, relationship: option.value })}
                      className={`w-full px-6 py-4 rounded-2xl border text-left text-sm tracking-wide transition-all flex items-center justify-between ${
                        formData.relationship === option.value
                          ? 'border-black/30 bg-black/10 text-black/80'
                          : 'border-black/10 bg-black/5 text-black/60 hover:bg-black/10'
                      }`}
                    >
                      {option.label}
                      {formData.relationship === option.value && <Check size={16} />}
                    </button>
                  ))}
                </div>

                {formData.relationship === 'other' && (
                  <input
                    type="text"
                    value={formData.relationshipOther}
                    onChange={(e) => setFormData({ ...formData, relationshipOther: e.target.value })}
                    placeholder="請說明您與游老師的關係"
                    className="w-full bg-black/5 border border-black/10 rounded-full px-6 py-3 text-sm text-black/80 placeholder:text-black/30 focus:border-black/30 outline-none transition-all"
                  />
                )}

                <p className="text-xs text-black/40 text-center">
                  我們會儘快與您聯繫相關事宜。
                </p>

                <button 
                  onClick={handleSubmitStory}
                  disabled={!formData.relationship || (formData.relationship === 'other' && !formData.relationshipOther) || isSubmitting}
                  className="w-full px-12 py-4 bg-black/80 text-white rounded-full text-sm tracking-[0.1em] hover:bg-black/70 transition-all disabled:opacity-30"
                >
                  {isSubmitting ? '送出中...' : '送出報名'}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* 感謝頁 */}
        {step === 'thank-you' && (
          <motion.div
            key="thank-you"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative z-[150] w-[88%] max-w-[400px] flex flex-col"
          >
            <div className="rounded-[3rem] border border-black/5 p-10" style={{ backgroundColor: "rgba(255,255,255,0.85)", backdropFilter: "blur(10px)", boxShadow: "0px 0px 60px 0px rgba(0,0,0,0.08)" }}>
              <div ref={animateContent} className="flex flex-col items-center text-center space-y-6">
                <div className="space-y-4">
                  <p className="gsap-fade-in text-black/60 text-base leading-relaxed tracking-wide opacity-0">
                    謝謝你，願意來，<br/>
                    把想念，好好放在這裡。
                  </p>
                  <p className="gsap-fade-in text-black/80 text-lg font-medium leading-relaxed tracking-wide opacity-0">
                    1/24 追思會，<br/>
                    我們一起，和游老師，<br/>
                    好好說再見。
                  </p>
                </div>

                {onNavigateToUpload && (
                  <div className="gsap-fade-in pt-6 w-full space-y-3 opacity-0">
                    <button 
                      onClick={onNavigateToUpload}
                      className="w-full px-12 py-4 bg-black/80 text-white rounded-full text-sm tracking-[0.1em] hover:bg-black/70 transition-all"
                    >
                      我想投稿
                    </button>
                    <p className="text-xs text-black/40 leading-relaxed">
                      也想邀請你，留下照片與文字，<br/>
                      分享你和游老師的吉光片羽，<br/>
                      那會是追思會，很重要的一部分。
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
