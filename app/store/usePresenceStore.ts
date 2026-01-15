import { create } from 'zustand';
import { supabase } from '@/app/lib/supabase';
import { useAuthStore } from './useAuthStore';
import type { RealtimeChannel } from '@supabase/supabase-js';

// ============================================================================
// BULLETPROOF PRESENCE - NEVER DISCONNECTS ON TAB SWITCH
// Uses aggressive keepalive and ignores visibility changes completely
// ============================================================================

export type ConnectionState = 'connected' | 'reconnecting' | 'offline';

export interface PresenceUser {
  userId: string;
  email?: string;
  name?: string;
  avatar?: string;
  joinedAt: string;
  lastSeen: string;
}

interface PresenceState {
  connectionState: ConnectionState;
  onlineUsers: PresenceUser[];
  currentUserId: string | null;
  channel: RealtimeChannel | null;
  
  connect: () => Promise<void>;
  disconnect: () => void;
  getOnlineCount: () => number;
}

// ============================================================================
// GLOBAL STATE (outside React)
// ============================================================================

let globalChannel: RealtimeChannel | null = null;
let isConnecting = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 50; // Very high - we want to keep trying

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function clearTimers() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function getReconnectDelay(): number {
  // Exponential backoff: 1s, 2s, 4s, 8s, max 30s
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
  return delay + Math.random() * 1000; // Add jitter
}

// ============================================================================
// STORE
// ============================================================================

export const usePresenceStore = create<PresenceState>((set, get) => ({
  connectionState: 'offline',
  onlineUsers: [],
  currentUserId: null,
  channel: null,

  connect: async () => {
    // Prevent multiple simultaneous connections
    if (isConnecting) {
      console.log('⏳ Already connecting, skipping...');
      return;
    }

    const { user } = useAuthStore.getState();
    
    if (!user) {
      console.log('❌ No user, cannot connect');
      return;
    }

    isConnecting = true;
    set({ connectionState: 'reconnecting' });
    clearTimers();

    try {
      console.log('🔌 Connecting to presence...');

      // Clean up old channel
      if (globalChannel) {
        try {
          await globalChannel.untrack();
          supabase.removeChannel(globalChannel);
          globalChannel = null;
        } catch (e) {
          console.warn('Cleanup warning:', e);
        }
      }

      // Create new channel
      const channel = supabase.channel('voice-room', {
        config: {
          presence: { 
            key: user.id,
          },
          broadcast: { 
            self: false,
            ack: false, // Don't wait for acknowledgment
          },
        },
      });

      globalChannel = channel;

      const presenceData = {
        userId: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || user.email?.split('@')[0],
        avatar: user.user_metadata?.avatar_url,
        joinedAt: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        online: true,
      };

      // Handle presence sync
      channel.on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        const users: PresenceUser[] = [];
        
        Object.keys(presenceState).forEach((key) => {
          const presences = presenceState[key];
          presences.forEach((presence: any) => {
            if (presence.userId) {
              users.push({
                userId: presence.userId,
                email: presence.email,
                name: presence.name,
                avatar: presence.avatar,
                joinedAt: presence.joinedAt,
                lastSeen: presence.lastSeen || presence.joinedAt,
              });
            }
          });
        });

        const uniqueUsers = users.filter((user, index, self) =>
          index === self.findIndex((u) => u.userId === user.userId)
        );

        set({ onlineUsers: uniqueUsers });
      });

      // Subscribe with retry logic
      channel.subscribe(async (status) => {
        console.log('📡 Channel status:', status);

        if (status === 'SUBSCRIBED') {
          await channel.track(presenceData);
          
          set({ 
            connectionState: 'connected',
            currentUserId: user.id,
            channel,
          });
          
          isConnecting = false;
          reconnectAttempts = 0;
          
          console.log('✅ Connected successfully!');

          // Start aggressive heartbeat (every 10 seconds)
          heartbeatTimer = setInterval(async () => {
            if (globalChannel && globalChannel.state === 'joined') {
              try {
                await globalChannel.track({
                  ...presenceData,
                  lastSeen: new Date().toISOString(),
                });
                console.log('💓 Heartbeat sent');
              } catch (e) {
                console.warn('Heartbeat failed:', e);
              }
            }
          }, 10000);
          
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          isConnecting = false;
          set({ connectionState: 'offline' });
          
          console.warn(`⚠️ Connection ${status}`);
          
          // Auto-reconnect if online
          if (navigator.onLine && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delay = getReconnectDelay();
            console.log(`🔄 Reconnecting in ${(delay / 1000).toFixed(1)}s (attempt ${reconnectAttempts})`);
            
            reconnectTimer = setTimeout(() => {
              get().connect();
            }, delay);
          }
        }
      });

    } catch (error) {
      console.error('❌ Connection error:', error);
      isConnecting = false;
      set({ connectionState: 'offline' });
      
      // Retry on error
      if (navigator.onLine && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        const delay = getReconnectDelay();
        reconnectTimer = setTimeout(() => {
          get().connect();
        }, delay);
      }
    }
  },

  disconnect: () => {
    console.log('👋 Disconnecting...');
    
    isConnecting = false;
    clearTimers();
    
    if (globalChannel) {
      try {
        globalChannel.untrack();
        supabase.removeChannel(globalChannel);
        globalChannel = null;
      } catch (e) {
        console.warn('Disconnect warning:', e);
      }
    }
    
    set({ 
      connectionState: 'offline',
      onlineUsers: [],
      currentUserId: null,
      channel: null,
    });
  },

  getOnlineCount: () => get().onlineUsers.length,
}));

// ============================================================================
// BROWSER EVENT HANDLERS (outside React to prevent re-renders)
// ============================================================================

if (typeof window !== 'undefined') {
  
  // ========================================================================
  // NETWORK ONLINE/OFFLINE
  // ========================================================================
  
  window.addEventListener('online', () => {
    console.log('🌐 Network back online');
    reconnectAttempts = 0; // Reset attempts
    const store = usePresenceStore.getState();
    if (store.connectionState !== 'connected') {
      setTimeout(() => store.connect(), 500);
    }
  });

  window.addEventListener('offline', () => {
    console.log('🌐 Network offline');
    usePresenceStore.setState({ connectionState: 'offline' });
  });

  // ========================================================================
  // PAGE VISIBILITY - DO NOTHING! THIS IS THE FIX!
  // We keep the connection alive regardless of tab visibility
  // ========================================================================
  
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      console.log('👁️ Tab hidden - keeping connection alive');
      // DO NOTHING - this is intentional!
      // The heartbeat will keep the connection alive
    } else {
      console.log('👁️ Tab visible again');
      // Just verify connection is still alive
      const store = usePresenceStore.getState();
      if (store.connectionState === 'offline') {
        console.log('🔄 Connection lost while hidden, reconnecting...');
        store.connect();
      }
    }
  });

  // ========================================================================
  // BEFORE UNLOAD - Only disconnect when page is actually closing
  // ========================================================================
  
  window.addEventListener('beforeunload', () => {
    console.log('👋 Page closing, disconnecting...');
    const store = usePresenceStore.getState();
    store.disconnect();
  });

  // ========================================================================
  // FOCUS/BLUR - Additional check
  // ========================================================================
  
  window.addEventListener('focus', () => {
    console.log('🎯 Window focused');
    const store = usePresenceStore.getState();
    // Only reconnect if we're actually disconnected
    if (store.connectionState === 'offline' && navigator.onLine) {
      console.log('🔄 Reconnecting on focus...');
      store.connect();
    }
  });

  // Don't disconnect on blur!
  window.addEventListener('blur', () => {
    console.log('🎯 Window blurred - staying connected');
    // DO NOTHING - keep connection alive
  });
}