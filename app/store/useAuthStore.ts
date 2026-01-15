import { create } from 'zustand';
import { supabase } from '@/app/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  
  // Actions
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => Promise<void>;
  setUser: (user: User | null) => void;
  setSession: (session: Session | null) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  loading: true,
  initialized: false,

  initialize: async () => {
    try {
      // Get initial session
      const { data: { session } } = await supabase.auth.getSession();
      
      set({ 
        session,
        user: session?.user ?? null,
        loading: false,
        initialized: true,
      });

      // Listen for auth changes
      supabase.auth.onAuthStateChange((_event, session) => {
        console.log('🔐 Auth state changed:', _event, session?.user?.email);
        set({
          session,
          user: session?.user ?? null,
          loading: false,
        });
      });
    } catch (error) {
      console.error('❌ Auth initialization error:', error);
      set({ loading: false, initialized: true });
    }
  },

  signInWithGoogle: async () => {
    try {
      set({ loading: true });
      
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) throw error;
    } catch (error) {
      console.error('❌ Sign in error:', error);
      set({ loading: false });
    }
  },

  signOut: async () => {
    try {
      set({ loading: true });
      
      const { error } = await supabase.auth.signOut();
      
      if (error) throw error;
      
      set({
        user: null,
        session: null,
        loading: false,
      });
      
      console.log('👋 Signed out successfully');
    } catch (error) {
      console.error('❌ Sign out error:', error);
      set({ loading: false });
    }
  },

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
}));