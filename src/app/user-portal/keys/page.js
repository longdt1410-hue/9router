'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function KeysPage() {
  const router = useRouter();
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newKeyName, setNewKeyName] = useState('');
  const [createdKey, setCreatedKey] = useState(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  function getToken() {
    return localStorage.getItem('multi_user_token');
  }

  function authHeaders() {
    return { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/json' };
  }

  async function fetchKeys() {
    const token = getToken();
    if (!token) {
      router.replace('/user-portal/login');
      return;
    }

    try {
      const res = await fetch('/api/multi/keys', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Unauthorized');
      const data = await res.json();
      setKeys(data.keys || data || []);
    } catch {
      localStorage.removeItem('multi_user_token');
      router.replace('/user-portal/login');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchKeys();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    setCreating(true);
    setError('');
    setCreatedKey(null);

    try {
      const res = await fetch('/api/multi/keys', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create key');
        return;
      }
      setCreatedKey(data.key || data.apiKey || data);
      setNewKeyName('');
      await fetchKeys();
    } catch {
      setError('Network error');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this API key?')) return;

    try {
      const res = await fetch('/api/multi/keys', {
        method: 'DELETE',
        headers: authHeaders(),
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to delete key');
        return;
      }
      setKeys(keys.filter((k) => k.id !== id));
    } catch {
      setError('Network error');
    }
  }

  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).catch(() => {});
  }

  function maskKey(key) {
    if (!key) return '';
    if (key.length <= 8) return key;
    return key.slice(0, 4) + '...' + key.slice(-4);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">API Keys</h1>

      {/* Create Key */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h2 className="text-lg font-semibold mb-4">Create New Key</h2>
        <form onSubmit={handleCreate} className="flex gap-3">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
            placeholder="Key name (e.g., My App)"
            required
          />
          <button
            type="submit"
            disabled={creating}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 rounded font-medium transition-colors"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </form>

        {error && (
          <p className="mt-3 text-sm text-red-400">{error}</p>
        )}

        {createdKey && (
          <div className="mt-4 p-4 bg-green-900/30 border border-green-700 rounded">
            <p className="text-sm text-green-300 mb-2">
              Key created! Copy it now - it will not be shown again.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 bg-gray-900 rounded text-sm font-mono text-green-400 break-all">
                {typeof createdKey === 'string' ? createdKey : createdKey.key || createdKey.apiKey || JSON.stringify(createdKey)}
              </code>
              <button
                onClick={() => copyToClipboard(typeof createdKey === 'string' ? createdKey : createdKey.key || createdKey.apiKey || '')}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Keys List */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold">Your Keys</h2>
        </div>
        {keys.length === 0 ? (
          <div className="p-6 text-center text-gray-400">
            No API keys yet. Create one above.
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {keys.map((key) => (
              <div key={key.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">{key.name || 'Unnamed'}</p>
                  <p className="text-sm text-gray-400 font-mono">
                    {maskKey(key.key || key.maskedKey || key.prefix || '')}
                  </p>
                  {key.createdAt && (
                    <p className="text-xs text-gray-500 mt-1">
                      Created: {new Date(key.createdAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(key.id)}
                  className="px-3 py-1 bg-red-900/50 hover:bg-red-800 border border-red-700 rounded text-sm text-red-300 transition-colors"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
