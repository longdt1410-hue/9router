'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('multi_user_token');
}

function removeToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('multi_user_token');
}

export default function UserPortalLayout({ children }) {
  const router = useRouter();
  const pathname = usePathname();
  const [username, setUsername] = useState('');

  const isAuthPage = pathname === '/user-portal/login' || pathname === '/user-portal/register';

  useEffect(() => {
    const token = getToken();
    if (token && !isAuthPage) {
      fetch('/api/multi/profile', {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (res.ok) return res.json();
          throw new Error('Unauthorized');
        })
        .then((data) => {
          setUsername(data.user?.username || data.username || '');
        })
        .catch(() => {
          removeToken();
          router.push('/user-portal/login');
        });
    }
  }, [pathname, isAuthPage, router]);

  function handleLogout() {
    removeToken();
    router.push('/user-portal/login');
  }

  const navLinks = [
    { href: '/user-portal/dashboard', label: 'Dashboard' },
    { href: '/user-portal/keys', label: 'Keys' },
    { href: '/user-portal/usage', label: 'Usage' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {!isAuthPage && (
        <nav className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="text-lg font-bold text-blue-400">9Router Portal</span>
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm hover:text-blue-300 ${
                  pathname === link.href ? 'text-blue-400 font-medium' : 'text-gray-300'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-4">
            {username && (
              <span className="text-sm text-gray-400">
                Logged in as <span className="text-white font-medium">{username}</span>
              </span>
            )}
            <button
              onClick={handleLogout}
              className="text-sm text-red-400 hover:text-red-300"
            >
              Logout
            </button>
          </div>
        </nav>
      )}
      <main className="p-6">{children}</main>
    </div>
  );
}
