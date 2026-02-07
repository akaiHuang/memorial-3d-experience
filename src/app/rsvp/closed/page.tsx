"use client";

import RegistrationClosedPage from '@/components/RegistrationClosedPage';
import { useRouter } from 'next/navigation';

export default function RSVPClosed() {
  const router = useRouter();

  const handleNavigateToUpload = () => {
    router.push('/');
  };

  return (
    <main className="bg-[#f5f3f0] min-h-full" style={{ minHeight: '100dvh' }}>
      <RegistrationClosedPage onNavigateToUpload={handleNavigateToUpload} />
    </main>
  );
}
