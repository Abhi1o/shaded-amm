'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PortfolioPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to account page since portfolio is now merged with account
    router.replace('/account');
  }, [router]);

  return (
    <div className="bg-black min-h-screen flex items-center justify-center">
      <div className="text-white text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        <p>Redirecting to Account...</p>
      </div>
    </div>
  );
}
