"use client";

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePresenceStore } from '@/app/store/usePresenceStore';

export default function ConnectionStatus() {
  const connectionState = usePresenceStore((state) => state.connectionState);
  const [isOnline, setIsOnline] = useState(true);
  const [isChecking, setIsChecking] = useState(false);

  const consecutiveFailuresRef = useRef(0);
  const isComponentMountedRef = useRef(true);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastSuccessfulCheckRef = useRef<Date>(new Date());

  useEffect(() => {
    isComponentMountedRef.current = true;

    const checkRealInternetConnection = async (): Promise<boolean> => {
      if (!isComponentMountedRef.current) return true;

      setIsChecking(true);

      try {
        const testUrl = 'https://1.1.1.1/cdn-cgi/trace';
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const response = await fetch(testUrl, {
          method: 'GET',
          signal: controller.signal,
          cache: 'no-store',
          mode: 'cors',
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          consecutiveFailuresRef.current = 0;
          lastSuccessfulCheckRef.current = new Date();

          if (!isOnline) {
            setIsOnline(true);
            const currentState = usePresenceStore.getState().connectionState;
            if (currentState !== 'connected') {
              setTimeout(() => {
                usePresenceStore.getState().connect();
              }, 500);
            }
          }

          setIsChecking(false);
          return true;
        }

        throw new Error('Non-OK response');
      } catch (error) {
        consecutiveFailuresRef.current++;

        if (consecutiveFailuresRef.current >= 3) {
          if (isOnline) {
            console.warn('⚠️ Internet connection lost (3 consecutive failures)');
            setIsOnline(false);
            usePresenceStore.setState({ connectionState: 'offline' });
          }
        }

        setIsChecking(false);
        return false;
      }
    };

    checkRealInternetConnection();

    checkIntervalRef.current = setInterval(() => {
      if (isComponentMountedRef.current) {
        checkRealInternetConnection();
      }
    }, 60000);

    const handleBrowserOnline = async () => {
      consecutiveFailuresRef.current = 0;
      setIsOnline(true);
      await checkRealInternetConnection();
    };

    const handleBrowserOffline = () => {
      consecutiveFailuresRef.current = 5;
      setIsOnline(false);
      usePresenceStore.setState({ connectionState: 'offline' });
    };

    window.addEventListener('online', handleBrowserOnline);
    window.addEventListener('offline', handleBrowserOffline);

    const handleWindowFocus = () => {
      checkRealInternetConnection();
    };
    window.addEventListener('focus', handleWindowFocus);

    const keepConnectionAlive = setInterval(() => {
      const currentState = usePresenceStore.getState().connectionState;
      if (isOnline && currentState === 'offline') {
        usePresenceStore.getState().connect();
      }
      if (!isOnline && currentState === 'connected') {
        usePresenceStore.setState({ connectionState: 'offline' });
      }
    }, 5000);

    return () => {
      isComponentMountedRef.current = false;
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      clearInterval(keepConnectionAlive);
      window.removeEventListener('online', handleBrowserOnline);
      window.removeEventListener('offline', handleBrowserOffline);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [isOnline]);

  /* ─── Determine what to show ─── */
  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        type: 'error' as const,
        title: 'Connection Lost',
        subtitle: 'Attempting to reconnect…',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
        ),
      };
    }

    if (connectionState === 'reconnecting' && isOnline) {
      return {
        type: 'warning' as const,
        title: 'Reconnecting',
        subtitle: 'Restoring connection…',
        icon: (
          <motion.svg
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.5, ease: 'linear' }}
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
          </motion.svg>
        ),
      };
    }

    return null;
  };

  const status = getStatusInfo();

  if (!status) return null;

  const colorMap = {
    error: {
      bg: 'var(--error-subtle)',
      border: 'var(--error)',
      text: 'var(--error)',
      subtitleColor: 'var(--error-light)',
      dotColor: 'var(--error)',
    },
    warning: {
      bg: 'var(--warning-subtle)',
      border: 'var(--warning)',
      text: 'var(--warning)',
      subtitleColor: 'var(--foreground-muted)',
      dotColor: 'var(--warning)',
    },
  };

  const colors = colorMap[status.type];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.95 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
      >
        <div
          className="flex items-center gap-3 px-5 py-3 rounded-full"
          style={{
            background: 'var(--surface-glass)',
            backdropFilter: 'blur(24px) saturate(1.2)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
            border: `1px solid ${colors.border}20`,
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {/* Status Dot */}
          <div
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              background: colors.dotColor,
              boxShadow: `0 0 8px ${colors.dotColor}40`,
            }}
          />

          {/* Icon */}
          <div style={{ color: colors.text }}>
            {status.icon}
          </div>

          {/* Text */}
          <div>
            <p
              className="text-xs font-semibold leading-tight"
              style={{
                color: colors.text,
                fontFamily: 'var(--font-body)',
              }}
            >
              {status.title}
            </p>
            <p
              className="text-[10px] leading-tight mt-0.5"
              style={{
                color: colors.subtitleColor,
                fontFamily: 'var(--font-body)',
              }}
            >
              {status.subtitle}
            </p>
          </div>

          {isChecking && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="ml-1"
            >
              <div
                className="w-3 h-3 rounded-full border-[1.5px] animate-spin"
                style={{
                  borderColor: 'var(--border)',
                  borderTopColor: colors.text,
                }}
              />
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}