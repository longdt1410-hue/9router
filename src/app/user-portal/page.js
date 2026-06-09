'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UserPortalIndex() {
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem('multi_user_token');
    if (token) {
      router.replace('/user-portal/dashboard');
    } else {
      router.replace('/user-portal/login');
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <p className="text-gray-400">Redirecting...</p>
    </div>
  );
}
