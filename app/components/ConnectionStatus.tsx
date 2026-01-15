"use client";

import { useEffect, useState, useRef } from 'react';
import { usePresenceStore } from '@/app/store/usePresenceStore';

// ============================================================================
// ADVANCED CONNECTION STATUS
// Shows connection state based on REAL internet connectivity
// Ignores tab visibility - stays connected in background
// ============================================================================

export default function ConnectionStatus() {
  const connectionState = usePresenceStore((state) => state.connectionState);
  const [isOnline, setIsOnline] = useState(true);
  const [lastCheckTime, setLastCheckTime] = useState<Date>(new Date());
  const [checkCount, setCheckCount] = useState(0);
  
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const failureCountRef = useRef(0);

  useEffect(() => {
    // Advanced internet connectivity check
    const checkInternetConnection = async () => {
      try {
        // Use multiple endpoints for reliability
        const endpoints = [
          'https://www.google.com/favicon.ico',
          'https://www.cloudflare.com/favicon.ico',
          'https://www.github.com/favicon.ico',
        ];

        // Pick random endpoint to avoid rate limiting
        const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(endpoint, {
          method: 'HEAD',
          signal: controller.signal,
          cache: 'no-store',
          mode: 'no-cors',
        });

        clearTimeout(timeoutId);
        
        // Connection successful
        if (failureCountRef.current > 0) {
          console.log('✅ Internet connection restored');
        }
        
        failureCountRef.current = 0;
        setIsOnline(true);
        setLastCheckTime(new Date());
        setCheckCount(prev => prev + 1);
        
        // If we were offline but now online, trigger reconnect
        if (connectionState === 'offline') {
          console.log('🔄 Triggering reconnect after connectivity restored');
          usePresenceStore.getState().connect();
        }

      } catch (error) {
        failureCountRef.current++;
        
        // Only set offline after multiple failures to avoid false positives
        if (failureCountRef.current >= 2) {
          console.warn('⚠️ Internet connection issue detected');
          setIsOnline(false);
          
          if (connectionState === 'connected') {
            usePresenceStore.setState({ connectionState: 'offline' });
          }
        }
      }
    };

    // Initial check
    checkInternetConnection();

    // Check every 30 seconds (not too aggressive)
    checkIntervalRef.current = setInterval(checkInternetConnection, 30000);

    // Handle browser online/offline events
    const handleOnline = () => {
      console.log('🌐 Browser detected network online');
      failureCountRef.current = 0;
      setIsOnline(true);
      checkInternetConnection();
      
      // Trigger reconnect if needed
      if (connectionState !== 'connected') {
        setTimeout(() => usePresenceStore.getState().connect(), 1000);
      }
    };

    const handleOffline = () => {
      console.log('🌐 Browser detected network offline');
      failureCountRef.current = 3; // Set high to immediately trigger offline state
      setIsOnline(false);
      usePresenceStore.setState({ connectionState: 'offline' });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup
    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [connectionState]);

  // Get status display info
  const getStatusInfo = () => {
    // Only show status if there's an actual issue
    if (!isOnline || connectionState === 'offline') {
      return {
        color: 'bg-red-500',
        text: 'No Internet Connection',
        bgColor: 'bg-red-500/95',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
          </svg>
        ),
      };
    }
    
    if (connectionState === 'reconnecting') {
      return {
        color: 'bg-yellow-500 animate-pulse',
        text: 'Reconnecting...',
        bgColor: 'bg-yellow-500/95',
        icon: (
          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ),
      };
    }
    
    // Connected - don't show anything (clean UI)
    return null;
  };

  const status = getStatusInfo();
  
  // Don't render if everything is fine
  if (!status) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
      <div 
        className={`${status.bgColor} backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl flex items-center space-x-3 transition-all duration-300 border border-white/20`}
      >
        <div className={`w-2 h-2 rounded-full ${status.color}`} />
        {status.icon}
        <div>
          <p className="text-sm font-semibold">{status.text}</p>
          {!isOnline && (
            <p className="text-xs text-white/70">
              Checked {Math.floor((Date.now() - lastCheckTime.getTime()) / 1000)}s ago
            </p>
          )}
        </div>
      </div>
    </div>
  );
}