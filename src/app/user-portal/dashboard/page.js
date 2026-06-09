'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardPage() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('multi_user_token');
    if (!token) {
      router.replace('/user-portal/login');
      return;
    }

    const headers = { Authorization: `Bearer ${token}` };

    Promise.all([
      fetch('/api/multi/profile', { headers }).then((r) => {
        if (!r.ok) throw new Error('Unauthorized');
        return r.json();
      }),
      fetch('/api/multi/usage?period=24h', { headers }).then((r) => {
        if (!r.ok) return null;
        return r.json();
      }),
    ])
      .then(([profileData, usageData]) => {
        setProfile(profileData.user || profileData);
        setUsage(usageData);
      })
      .catch(() => {
        localStorage.removeItem('multi_user_token');
        router.replace('/user-portal/login');
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/50 border border-red-700 rounded text-red-300">{error}</div>
    );
  }

  const totalRequests = usage?.totalRequests ?? usage?.requests ?? 0;
  const totalTokens = usage?.totalTokens ?? usage?.tokens ?? 0;
  const quota = profile?.quota;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {/* Profile Section */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Profile</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-400">Username</p>
            <p className="font-medium">{profile?.username || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Display Name</p>
            <p className="font-medium">{profile?.displayName || '-'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-400">Email</p>
            <p className="font-medium">{profile?.email || '-'}</p>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <p className="text-sm text-gray-400">Requests (24h)</p>
          <p className="text-2xl font-bold text-blue-400">{totalRequests.toLocaleString()}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <p className="text-sm text-gray-400">Tokens Used (24h)</p>
          <p className="text-2xl font-bold text-green-400">{totalTokens.toLocaleString()}</p>
        </div>
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <p className="text-sm text-gray-400">Quota Remaining</p>
          <p className="text-2xl font-bold text-yellow-400">
            {quota?.remaining != null ? quota.remaining.toLocaleString() : (quota?.limit != null ? `${quota.limit.toLocaleString()} limit` : 'Unlimited')}
          </p>
        </div>
      </div>
    </div>
  );
}
