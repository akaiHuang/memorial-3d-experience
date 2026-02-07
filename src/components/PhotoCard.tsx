"use client";

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

export default function PhotoCard({ url, author, description }: { url: string, author: string, description?: string }) {
  const [imageError, setImageError] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const fullscreenModal = (
    <AnimatePresence>
      {isFullscreen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-sm"
          onClick={() => setIsFullscreen(false)}
        >
          <motion.img
            src={url}
            alt="Memory fullscreen"
            className="max-w-[95vw] max-h-[80vh] object-contain rounded-lg mb-12 md:mb-0"
            crossOrigin="anonymous"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={(e) => e.stopPropagation()}
          />
          
          <button
            className="absolute top-6 right-6 text-white/60 hover:text-white transition-colors z-50 p-2 bg-black/20 rounded-full backdrop-blur-sm"
            onClick={() => setIsFullscreen(false)}
          >
            <X size={32} />
          </button>

          {description && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ delay: 0.1 }}
              className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="max-h-[35vh] overflow-y-auto p-6">
                <p className="text-center text-white font-light italic leading-relaxed whitespace-pre-wrap text-lg drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  {description}
                </p>
                <div className="mt-4 text-center pt-2">
                  <span className="text-xs text-white/80 tracking-widest uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">— {author}</span>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <>
      <motion.div 
        className="relative group flex flex-col items-center"
        whileHover={{ y: -5 }}
        onHoverStart={() => !isFullscreen && setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
    >
      <div 
        className="w-[85vw] h-[106vw] md:w-64 md:h-80 overflow-hidden rounded-lg bg-zinc-900 relative shadow-xl cursor-pointer"
        onClick={() => !imageError && setIsFullscreen(true)}
      >
        {!imageError ? (
          <motion.img 
            src={url} 
            alt="Memory" 
            className="w-full h-full object-cover"
            crossOrigin="anonymous"
            onError={() => setImageError(true)}
            animate={{
              filter: isHovered 
                ? 'saturate(1.2) contrast(1.1)' 
                : 'saturate(1) contrast(1)',
              scale: isHovered ? 1.05 : 1
            }}
            transition={{ duration: 0.3 }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white-500">
            <span>無法載入圖片</span>
          </div>
        )}
        {/* Hover overlay */}
        <motion.div 
          className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent pointer-events-none"
          animate={{ opacity: isHovered ? 1 : 0.3 }}
          transition={{ duration: 0.3 }}
        />
      </div>
      <div 
        className="mt-4 space-y-2 cursor-pointer group/text w-full max-w-[85vw] md:max-w-64"
        onClick={() => !imageError && setIsFullscreen(true)}
      >
        {description && (
          <p className="text-s font-light text-white-200 line-clamp-2 px-2 italic drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)] group-hover/text:text-white transition-colors">
            「{description}」
          </p>
        )}
        <p className="text-[13px] tracking-widest text-white-500 uppercase drop-shadow-[0_1.2px_1.2px_rgba(0,0,0,0.8)] px-2">— {author}</p>
      </div>
    </motion.div>

    {/* Fullscreen Modal - rendered via portal */}
    {typeof document !== 'undefined' && createPortal(fullscreenModal, document.body)}
    </>
  );
}
