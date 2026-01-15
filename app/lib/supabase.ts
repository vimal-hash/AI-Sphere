import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

// ============================================================================
// CUSTOM SUPABASE CLIENT WITH AGGRESSIVE REALTIME SETTINGS
// This prevents disconnection on tab visibility changes
// ============================================================================

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    // CRITICAL: These settings prevent disconnection
    heartbeatIntervalMs: 15000, // Send heartbeat every 15s
    timeout: 60000, // 60s timeout (very generous)
  },
  global: {
    headers: {
      'x-client-info': 'voice-ai-app',
    },
  },
});

// ============================================================================
// AGGRESSIVE CONNECTION KEEPER
// Prevents Supabase from auto-disconnecting on tab hide
// ============================================================================

if (typeof window !== 'undefined') {
  // Override Supabase's internal visibility handler
  const originalAddEventListener = document.addEventListener;
  
  // @ts-ignore - Monkey patch to prevent Supabase from listening to visibility
  document.addEventListener = function(type: string, listener: any, options?: any) {
    // Block Supabase's visibility change listener
    if (type === 'visibilitychange') {
      // Check if this is Supabase's internal listener
      const listenerStr = listener?.toString() || '';
      if (listenerStr.includes('hidden') || listenerStr.includes('visibility')) {
        console.log('🚫 Blocked Supabase visibility listener');
        return; // Don't add the listener
      }
    }
    
    // Allow all other event listeners
    return originalAddEventListener.call(this, type, listener, options);
  };
}

// Helper to get current user
export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Helper to get session
export const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};