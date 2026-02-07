"use client";

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function TextCard({ content, author, color, color2 }: { content: string, author: string, color?: string, color2?: string }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const maxLength = 70;
  const shouldTruncate = content.length > maxLength;
  const displayContent = shouldTruncate ? content.slice(0, maxLength) + '...' : content;

  return (
    <>
      <motion.div
        whileHover={{ y: -5, boxShadow: '0 10px 40px rgba(255,255,255,0.1)' }}
        className="w-[85vw] md:w-72 p-8 bg-zinc-900/80 border border-white/10 rounded-lg backdrop-blur-md flex flex-col justify-between min-h-[320px] shadow-xl relative overflow-hidden"
      >
        {color && (
          <div 
            className="absolute inset-0 -z-10 opacity-40"
            style={{
              background: `radial-gradient(circle at top left, ${color}60 0%, transparent 50%), radial-gradient(circle at bottom right, ${color2 || color}50 0%, transparent 50%)`
            }}
          />
        )}
        <div className="space-y-6 relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-[1px] bg-gradient-to-r from-white/50 to-transparent" />
            <div className="w-2 h-2 rounded-full bg-white/30" />
          </div>
          <div className="space-y-2">
            <p className="text-lg font-light leading-relaxed tracking-wide text-white-100 whitespace-pre-wrap drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]" style={{ fontFamily: "'Noto Serif TC', serif" }}>
              「{displayContent}」
            </p>
            {shouldTruncate && (
              <button 
                onClick={() => setIsExpanded(true)}
                className="text-xs text-white-400 hover:text-white transition-colors tracking-widest border-b border-transparent hover:border-white/50 pb-0.5"
              >
                閱讀更多...
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 pt-6 border-t border-white/5 relative z-10">
          <p className="text-[11px] tracking-[0.15em] text-white-400 drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)]">— {author}</p>
        </div>
      </motion.div>

      {/* Fullscreen Modal */}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-6"
              onClick={() => setIsExpanded(false)}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative max-w-2xl w-full bg-zinc-900/50 border border-white/10 rounded-2xl p-8 md:p-12 shadow-2xl overflow-y-auto max-h-[80vh] custom-scrollbar"
                onClick={e => e.stopPropagation()}
              >
                <button
                  onClick={() => setIsExpanded(false)}
                  className="absolute top-6 right-6 text-white-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
                
                <div className="space-y-8">
                  <div className="flex items-center gap-3 justify-center opacity-50">
                    <div className="w-10 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent" />
                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                    <div className="w-10 h-[1px] bg-gradient-to-r from-transparent via-white to-transparent" />
                  </div>
                  
                  <p className="text-xl md:text-2xl font-light leading-loose tracking-wide text-white-100 whitespace-pre-wrap text-center" style={{ fontFamily: "'Noto Serif TC', serif" }}>
                    {content}
                  </p>
                  
                  <div className="text-right pt-8 border-t border-white/10">
                    <p className="text-s tracking-[0.1em] text-white-400">— {author}</p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
