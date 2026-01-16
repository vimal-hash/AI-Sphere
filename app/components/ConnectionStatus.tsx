"use client";

import { useEffect, useState, useRef } from 'react';
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
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

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
        } else {
          
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
      
      consecutiveFailuresRef.current = 5; // Set high to immediately mark offline
      setIsOnline(false);
      usePresenceStore.setState({ connectionState: 'offline' });
    };

    window.addEventListener('online', handleBrowserOnline);
    window.addEventListener('offline', handleBrowserOffline);

    
    const handleVisibilityChange = () => {
      
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    
    // const handleWindowBlur = () => {
    
     
    // };

    const handleWindowFocus = () => {
     
      
      checkRealInternetConnection();
    };

    // window.addEventListener('blur', handleWindowBlur);
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
      
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
      
      clearInterval(keepConnectionAlive);
      
      window.removeEventListener('online', handleBrowserOnline);
      window.removeEventListener('offline', handleBrowserOffline);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('focus', handleWindowFocus);
    };
  }, [isOnline]);

 
  const getStatusInfo = () => {
    
    if (!isOnline) {
      return {
        color: 'bg-red-500',
        text: 'No Internet Connection',
        bgColor: 'bg-red-500/95',
        icon: (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
          </svg>
        ),
        subtext: 'Attempting to reconnect...'
      };
    }
    
   
    if (connectionState === 'reconnecting' && isOnline) {
      return {
        color: 'bg-yellow-500 animate-pulse',
        text: 'Reconnecting to server...',
        bgColor: 'bg-yellow-500/95',
        icon: (
          <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ),
        subtext: 'This should only take a moment'
      };
    }
    
   
    return null;
  };

  const status = getStatusInfo();
  
 
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
          {status.subtext && (
            <p className="text-xs text-white/70">{status.subtext}</p>
          )}
          {isChecking && (
            <p className="text-xs text-white/60 mt-1">Checking connection...</p>
          )}
        </div>
      </div>
    </div>
  );
}