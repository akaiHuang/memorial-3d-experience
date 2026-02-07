"use client";

import RSVPPage from '@/components/RSVPPage';
import { useRouter } from 'next/navigation';

export default function RSVP() {
  const router = useRouter();

  const handleNavigateToUpload = () => {
    router.push('/');
  };

  return (
    <main className="bg-[#f5f3f0] min-h-full" style={{ minHeight: '100dvh' }}>
      <RSVPPage onNavigateToUpload={handleNavigateToUpload} />
    </main>
  );
}
