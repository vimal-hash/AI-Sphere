'use client';

import { useState } from 'react';
import { useAuthStore } from '@/app/store/useAuthStore';

export default function UserProfile() {
  const { user, signOut } = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);

  if (!user) return null;

  const handleSignOut = async () => {
    await signOut();
    setShowMenu(false);
  };

  return (
    <div className="absolute top-4 left-4 z-10">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center space-x-3 bg-white/10 backdrop-blur-md rounded-full p-2 pr-4 hover:bg-white/20 transition-all duration-300"
      >
        <img
          src={user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${user.email}&background=random`}
          alt={user.email || 'User'}
          className="w-10 h-10 rounded-full border-2 border-white/50"
        />
        <div className="text-left text-white">
          <p className="text-sm font-semibold">
            {user.user_metadata?.full_name || user.email?.split('@')[0]}
          </p>
          <p className="text-xs text-white/70">{user.email}</p>
        </div>
      </button>

     
      {showMenu && (
        <>
         
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setShowMenu(false)}
          />
          
        
          <div className="absolute top-16 left-0 bg-white/95 backdrop-blur-md rounded-lg shadow-2xl p-2 w-64 z-50">
            <div className="px-4 py-3 border-b border-gray-200">
              <p className="text-sm font-semibold text-gray-900">
                {user.user_metadata?.full_name || 'User'}
              </p>
              <p className="text-xs text-gray-600">{user.email}</p>
            </div>
            
            <button
              onClick={handleSignOut}
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 rounded transition-colors flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span>Sign Out</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
}