"use client";

import UploadPage from '@/components/UploadPage';
import type { Memory } from '@/types';

export default function Home() {
  const handleAddMemory = (_memory: Memory) => {};

  return (
    <main className="bg-black min-h-full text-white" style={{ minHeight: '100dvh' }}>
      <UploadPage onComplete={handleAddMemory} />
    </main>
  );
}
