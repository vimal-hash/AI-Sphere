"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePresenceStore } from '@/app/store/usePresenceStore';
import { useAuthStore } from '@/app/store/useAuthStore';

export default function PresenceIndicator() {
  const onlineUsers = usePresenceStore((state) => state.onlineUsers);
  const connectionState = usePresenceStore((state) => state.connectionState);
  const { user } = useAuthStore();
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusClass = () => {
    switch (connectionState) {
      case 'connected': return 'status-dot--connected';
      case 'reconnecting': return 'status-dot--reconnecting';
      case 'offline': return 'status-dot--offline';
    }
  };

  const getStatusLabel = () => {
    switch (connectionState) {
      case 'connected': return 'Live';
      case 'reconnecting': return 'Reconnecting';
      case 'offline': return 'Offline';
    }
  };

  return (
    <div className="relative">
      {/* Compact Chip */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setIsExpanded(!isExpanded)}
        className="glass rounded-full flex items-center gap-2.5 py-2 px-3.5 cursor-pointer transition-all duration-300"
        style={{ boxShadow: 'var(--shadow-sm)' }}
      >
        <div className={`status-dot ${getStatusClass()}`} />

        <span
          className="text-xs font-medium"
          style={{
            color: 'var(--foreground-secondary)',
            fontFamily: 'var(--font-body)',
            letterSpacing: '0.02em',
          }}
        >
          {getStatusLabel()}
        </span>

        <div
          className="w-px h-3.5"
          style={{ background: 'var(--border)' }}
        />

        {/* Stacked Avatars */}
        <div className="flex items-center -space-x-1.5">
          {onlineUsers.slice(0, 3).map((u) => (
            <img
              key={u.userId}
              src={u.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.name || u.email || 'U')}&background=B8860B&color=fff&bold=true&size=40`}
              alt={u.name || ''}
              className="w-5 h-5 rounded-full object-cover"
              style={{
                border: '1.5px solid var(--surface)',
                boxShadow: 'var(--shadow-sm)',
              }}
            />
          ))}
          {onlineUsers.length > 3 && (
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold"
              style={{
                background: 'var(--accent-subtle)',
                color: 'var(--accent)',
                border: '1.5px solid var(--surface)',
                fontFamily: 'var(--font-body)',
              }}
            >
              +{onlineUsers.length - 3}
            </div>
          )}
        </div>

        <span
          className="text-xs font-medium tabular-nums"
          style={{
            color: 'var(--foreground-muted)',
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
          }}
        >
          {onlineUsers.length}
        </span>
      </motion.button>

      {/* Expanded User List */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute top-full right-0 mt-2 w-60 overflow-hidden"
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-xl)',
              zIndex: 100,
            }}
          >
            {/* Header */}
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: '1px solid var(--border)' }}
            >
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{
                  color: 'var(--foreground-muted)',
                  fontFamily: 'var(--font-body)',
                  fontSize: '10px',
                  letterSpacing: '0.1em',
                }}
              >
                Active Users
              </span>
              <span
                className="text-xs font-medium tabular-nums"
                style={{
                  color: 'var(--accent)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                }}
              >
                {onlineUsers.length}
              </span>
            </div>

            {/* User List */}
            <div className="p-2 max-h-64 overflow-y-auto">
              {onlineUsers.length === 0 ? (
                <p
                  className="text-center py-4 text-xs"
                  style={{ color: 'var(--foreground-muted)' }}
                >
                  No users online
                </p>
              ) : (
                <div className="space-y-0.5">
                  {onlineUsers.map((presenceUser, idx) => {
                    const isCurrentUser = presenceUser.userId === user?.id;
                    const name = presenceUser.name || presenceUser.email?.split('@')[0] || 'User';

                    return (
                      <motion.div
                        key={presenceUser.userId}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className="flex items-center gap-2.5 px-2.5 py-2 rounded-[var(--radius-md)] transition-colors duration-200"
                        style={{
                          background: isCurrentUser ? 'var(--accent-subtle)' : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (!isCurrentUser) e.currentTarget.style.background = 'var(--surface-overlay)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isCurrentUser) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div className="relative flex-shrink-0">
                          <img
                            src={presenceUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=B8860B&color=fff&bold=true&size=40`}
                            alt={name}
                            className="w-7 h-7 rounded-full object-cover"
                          />
                          <div
                            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
                            style={{
                              background: 'var(--success)',
                              border: '2px solid var(--surface)',
                            }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-xs font-medium truncate"
                            style={{
                              color: 'var(--foreground)',
                              fontFamily: 'var(--font-body)',
                            }}
                          >
                            {name}
                            {isCurrentUser && (
                              <span
                                className="ml-1.5 text-[10px] font-normal"
                                style={{ color: 'var(--accent)' }}
                              >
                                you
                              </span>
                            )}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}