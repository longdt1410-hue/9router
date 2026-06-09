'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UsagePage() {
  const router = useRouter();
  const [period, setPeriod] = useState('24h');
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function getToken() {
    return localStorage.getItem('multi_user_token');
  }

  async function fetchUsage(selectedPeriod) {
    const token = getToken();
    if (!token) {
      router.replace('/user-portal/login');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/multi/usage?period=${selectedPeriod}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 401) {
          localStorage.removeItem('multi_user_token');
          router.replace('/user-portal/login');
          return;
        }
        throw new Error('Failed to load usage');
      }
      const data = await res.json();
      setUsage(data);
    } catch (err) {
      setError(err.message || 'Failed to load usage data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsage(period);
  }, [period]);

  const periods = [
    { value: '24h', label: 'Last 24 Hours' },
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
  ];

  const totalRequests = usage?.totalRequests ?? usage?.requests ?? 0;
  const totalTokens = usage?.totalTokens ?? usage?.tokens ?? 0;
  const totalCost = usage?.totalCost ?? usage?.cost ?? 0;
  const breakdown = usage?.breakdown || usage?.byModel || usage?.details || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usage</h1>
        <div className="flex gap-2">
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                period === p.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-900/50 border border-red-700 rounded text-red-300">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <p className="text-gray-400">Loading...</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <p className="text-sm text-gray-400">Total Requests</p>
              <p className="text-2xl font-bold text-blue-400">{totalRequests.toLocaleString()}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <p className="text-sm text-gray-400">Total Tokens</p>
              <p className="text-2xl font-bold text-green-400">{totalTokens.toLocaleString()}</p>
            </div>
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <p className="text-sm text-gray-400">Estimated Cost</p>
              <p className="text-2xl font-bold text-yellow-400">
                ${typeof totalCost === 'number' ? totalCost.toFixed(4) : '0.0000'}
              </p>
            </div>
          </div>

          {/* Breakdown Table */}
          {Array.isArray(breakdown) && breakdown.length > 0 && (
            <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
              <div className="p-4 border-b border-gray-700">
                <h2 className="text-lg font-semibold">Breakdown by Model/Provider</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-750">
                    <tr className="border-b border-gray-700">
                      <th className="text-left p-3 text-gray-400 font-medium">Model</th>
                      <th className="text-left p-3 text-gray-400 font-medium">Provider</th>
                      <th className="text-right p-3 text-gray-400 font-medium">Requests</th>
                      <th className="text-right p-3 text-gray-400 font-medium">Tokens</th>
                      <th className="text-right p-3 text-gray-400 font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {breakdown.map((item, idx) => (
                      <tr key={idx} className="hover:bg-gray-700/50">
                        <td className="p-3">{item.model || '-'}</td>
                        <td className="p-3 text-gray-400">{item.provider || '-'}</td>
                        <td className="p-3 text-right">{(item.requests ?? 0).toLocaleString()}</td>
                        <td className="p-3 text-right">{(item.tokens ?? 0).toLocaleString()}</td>
                        <td className="p-3 text-right">
                          ${typeof item.cost === 'number' ? item.cost.toFixed(4) : '0.0000'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {(!Array.isArray(breakdown) || breakdown.length === 0) && (
            <div className="bg-gray-800 rounded-lg p-8 border border-gray-700 text-center text-gray-400">
              No detailed breakdown available for this period.
            </div>
          )}
        </>
      )}
    </div>
  );
}
