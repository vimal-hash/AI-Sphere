import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}



export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    
    heartbeatIntervalMs: 10000, 
    timeout: 120000, 
  },
  global: {
    headers: {
      'x-client-info': 'voice-ai-persistent',
    },
  },
});



if (typeof window !== 'undefined') {
 
  const originalAddEventListener = document.addEventListener.bind(document);
  
  document.addEventListener = function(type: string, listener: any, options?: any) {
    
    if (type === 'visibilitychange') {
      const listenerString = listener?.toString() || '';
      
     
      if (
        listenerString.includes('hidden') || 
        listenerString.includes('disconnect') ||
        listenerString.includes('realtime')
      ) {
        
        return; 
      }
    }
    
    
    return originalAddEventListener(type, listener, options);
  };


  let realHiddenState = document.hidden;
  
  Object.defineProperty(document, 'hidden', {
    configurable: true,
    get: function() {
     
      const actualHidden = realHiddenState;
      
      
      const stack = new Error().stack || '';
      const isSupabaseCall = stack.includes('supabase') || 
                             stack.includes('realtime') ||
                             stack.includes('phoenix');
      
      if (isSupabaseCall) {
        
        return false;
      }
      
     
      return actualHidden;
    }
  });

  
  document.addEventListener('visibilitychange', () => {
    realHiddenState = document.visibilityState === 'hidden';
    
  });


  const maintainConnection = () => {
    try {
     
      const channels = (supabase as any).realtime?.channels || [];
      
      channels.forEach((channel: any) => {
        
        if (channel.state === 'closed' || channel.state === 'errored') {
         
          channel.rejoin();
        }
      });
    } catch (error) {
      
    }
  };

  
  setInterval(maintainConnection, 15000);


  const preventUnloadDisconnect = () => {
    
    return;
  };

  window.addEventListener('beforeunload', preventUnloadDisconnect);


  const keepWebSocketAlive = () => {
    try {
      const realtime = (supabase as any).realtime;
      
      if (realtime?.conn?.socket) {
        
        realtime.conn.socket.send(JSON.stringify({
          event: 'heartbeat',
          topic: 'phoenix',
          payload: {},
          ref: Date.now()
        }));
      }
    } catch (error) {
  
    }
  };


  setInterval(keepWebSocketAlive, 20000);


}




export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};


export const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};


export const forceReconnect = () => {
  
  
  try {
    const realtime = (supabase as any).realtime;
    
    if (realtime) {
      
      realtime.disconnect();
      
      setTimeout(() => {
        realtime.connect();
       
      }, 1000);
    }
  } catch (error) {
    console.error('❌ Force reconnect failed:', error);
  }
};

// Check connection status
export const checkConnectionStatus = () => {
  try {
    const realtime = (supabase as any).realtime;
    
    if (!realtime) return 'no realtime';
    
    const connectionState = realtime.connectionState?.();
    const channels = realtime.channels || [];
    
   
    
    return connectionState;
  } catch (error) {
    console.error('❌ Status check failed:', error);
    return 'error';
  }
};