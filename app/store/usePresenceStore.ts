import { create } from 'zustand';
import { supabase } from '@/app/lib/supabase';
import { useAuthStore } from './useAuthStore';
import type { RealtimeChannel } from '@supabase/supabase-js';



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



let globalChannel: RealtimeChannel | null = null;
let isConnecting = false;
let reconnectTimer: NodeJS.Timeout | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;
let keepAliveTimer: NodeJS.Timeout | null = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 100; 



if (typeof window !== 'undefined') {
  
  let actualHidden = document.hidden;
  
  
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: function() {
     
      const stack = new Error().stack || '';
      const isRealtimeCall = stack.includes('phoenix') || 
                             stack.includes('realtime') || 
                             stack.includes('supabase');
      
      if (isRealtimeCall) {
        
        return false;
      }
      
     
      return actualHidden;
    }
  });

  
  const originalVisibilityHandler = () => {
    actualHidden = document.visibilityState === 'hidden';
  };
  
  document.addEventListener('visibilitychange', originalVisibilityHandler);
  

}



function clearTimers() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}

function getReconnectDelay(): number {
 
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
  return delay + Math.random() * 1000; 
}



export const usePresenceStore = create<PresenceState>((set, get) => ({
  connectionState: 'offline',
  onlineUsers: [],
  currentUserId: null,
  channel: null,

  connect: async () => {
  
    if (isConnecting) {
    
      return;
    }

    const { user } = useAuthStore.getState();
    
    if (!user) {
     
      return;
    }

    isConnecting = true;
    set({ connectionState: 'reconnecting' });
    clearTimers();

    try {
      

      
      if (globalChannel) {
        try {
          await globalChannel.untrack();
          supabase.removeChannel(globalChannel);
          globalChannel = null;
        } catch (e) {
          console.warn('Cleanup warning:', e);
        }
      }

      
      const channel = supabase.channel('voice-room', {
        config: {
          presence: { 
            key: user.id,
          },
          broadcast: { 
            self: false,
            ack: false, 
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

      
      channel.subscribe(async (status) => {
        

        if (status === 'SUBSCRIBED') {
          await channel.track(presenceData);
          
          set({ 
            connectionState: 'connected',
            currentUserId: user.id,
            channel,
          });
          
          isConnecting = false;
          reconnectAttempts = 0;
          
         

         
          
        
          heartbeatTimer = setInterval(async () => {
            if (globalChannel && globalChannel.state === 'joined') {
              try {
                await globalChannel.track({
                  ...presenceData,
                  lastSeen: new Date().toISOString(),
                });
              
              } catch (e) {
                console.warn('Heartbeat failed:', e);
              }
            }
          }, 10000);
          
          
          keepAliveTimer = setInterval(() => {
            try {
             
              const conn = (channel as any).socket?.conn;
              if (conn && conn.readyState === 1) { 
                conn.send(JSON.stringify({
                  topic: 'phoenix',
                  event: 'heartbeat',
                  payload: {},
                  ref: Date.now().toString()
                }));
               
              }
            } catch (e) {
              console.warn('WebSocket ping failed:', e);
            }
          }, 15000);
          
          
          const stateMonitor = setInterval(() => {
            if (globalChannel) {
              const state = globalChannel.state;
              
              if (state === 'closed' || state === 'errored') {
                console.warn('⚠️ Channel in bad state:', state);
                clearInterval(stateMonitor);
                
                // Auto-reconnect
                if (navigator.onLine) {
                 
                  setTimeout(() => {
                    set({ connectionState: 'offline' });
                    get().connect();
                  }, 1000);
                }
              }
            }
          }, 5000);
          
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          isConnecting = false;
          set({ connectionState: 'offline' });
          
          // console.warn(`⚠️ Connection ${status}`);
          
         
          if (navigator.onLine && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            const delay = getReconnectDelay();
            
            
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



if (typeof window !== 'undefined') {
  
 
  
  window.addEventListener('online', () => {
    
    reconnectAttempts = 0; 
    const store = usePresenceStore.getState();
    if (store.connectionState !== 'connected') {
      setTimeout(() => store.connect(), 500);
    }
  });

  window.addEventListener('offline', () => {
   
    usePresenceStore.setState({ connectionState: 'offline' });
  });

 
  
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      
    } else {
     
      const store = usePresenceStore.getState();
      if (store.connectionState === 'offline') {
        
        store.connect();
      }
    }
  });


  
  window.addEventListener('beforeunload', () => {
    
    const store = usePresenceStore.getState();
    store.disconnect();
  });


  
  window.addEventListener('focus', () => {
   
    const store = usePresenceStore.getState();
    
    if (store.connectionState === 'offline' && navigator.onLine) {
      
      store.connect();
    }
  });

  
}