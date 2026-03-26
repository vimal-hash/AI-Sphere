'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/app/store/useAuthStore';

export default function UserProfile() {
  const { user, signOut } = useAuthStore();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    }
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showMenu]);

  if (!user) return null;

  const handleSignOut = async () => {
    await signOut();
    setShowMenu(false);
  };

  const displayName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
  const avatarUrl = user.user_metadata?.avatar_url
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=B8860B&color=fff&bold=true&size=80`;

  return (
    <div ref={menuRef} className="relative">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-3 glass rounded-full py-2 pl-2 pr-4 transition-all duration-300 cursor-pointer"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <img
          src={avatarUrl}
          alt={displayName}
          className="w-8 h-8 rounded-full object-cover"
          style={{ border: '2px solid var(--border-accent)' }}
        />
        <div className="text-left hidden sm:block">
          <p
            className="text-[13px] font-medium leading-tight"
            style={{ color: 'var(--foreground)', fontFamily: 'var(--font-body)' }}
          >
            {displayName}
          </p>
        </div>

        {/* Chevron */}
        <motion.svg
          animate={{ rotate: showMenu ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-3.5 h-3.5 hidden sm:block"
          fill="none"
          stroke="var(--foreground-muted)"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </motion.svg>
      </motion.button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full left-0 mt-2 w-64 overflow-hidden"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-xl)',
              zIndex: 100,
            }}
          >
            {/* User Info Header */}
            <div
              className="px-4 py-4"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <div className="flex items-center gap-3">
                <img
                  src={avatarUrl}
                  alt={displayName}
                  className="w-10 h-10 rounded-full object-cover"
                  style={{ border: '2px solid var(--border-accent)' }}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className="text-sm font-semibold truncate"
                    style={{ color: 'var(--foreground)', fontFamily: 'var(--font-body)' }}
                  >
                    {displayName}
                  </p>
                  <p
                    className="text-xs truncate"
                    style={{ color: 'var(--foreground-muted)' }}
                  >
                    {user.email}
                  </p>
                </div>
              </div>
            </div>

            {/* Sign Out Button */}
            <div className="p-2">
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-md)] text-left transition-all duration-200 cursor-pointer"
                style={{
                  color: 'var(--error)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '13px',
                  fontWeight: 500,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--error-subtle)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                <span>Sign Out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}