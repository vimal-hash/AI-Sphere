import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================================================
// MEMORY-ENHANCED AI STORE
// ============================================================================

export type AIStatus = 
  | 'idle' 
  | 'listening' 
  | 'processing' 
  | 'responding' 
  | 'speaking'
  | 'error';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  audioUrl?: string;
  confidence?: number;
  intent?: string;
}

export interface AIResponse {
  intent: string;
  message: string;
  emotion: 'calm' | 'excited' | 'thinking' | 'error';
  action?: string;
  confidence?: number;
  usedTools?: string[]; // ✅ For tool badges
}

export interface ProcessingMetrics {
  totalTime: number;
  tokensUsed: number;
  contextUsed?: boolean;
}

// ============================================================================
// STATE INTERFACE
// ============================================================================

interface AIState {
  // Status
  status: AIStatus;
  isProcessing: boolean;
  error: string | null;
  
  // Session tracking (NEW!)
  sessionId: string | null;
  
  // Messages & Context
  messages: AIMessage[];
  currentResponse: AIResponse | null;
  conversationId: string | null;
  
  // Audio
  currentAudioUrl: string | null;
  isPlaying: boolean;
  audioElement: HTMLAudioElement | null;
  
  // Metrics
  metrics: ProcessingMetrics | null;
  
  // Settings
  autoPlayAudio: boolean;
  maxMessages: number;
  
  // Actions
  setStatus: (status: AIStatus) => void;
  sendAudio: (audioBlob: Blob, authToken: string) => Promise<void>;
  addMessage: (role: 'user' | 'assistant', content: string, audioUrl?: string, intent?: string) => void;
  playAudio: (audioUrl: string) => Promise<void>;
  stopAudio: () => void;
  clearMessages: () => void;
  setError: (error: string | null) => void;
  setAutoPlayAudio: (enabled: boolean) => void;
  startNewSession: () => void; // NEW!
  reset: () => void;
}

// ============================================================================
// AUDIO MANAGER
// ============================================================================

class AudioManager {
  private static instance: HTMLAudioElement | null = null;

  static getAudioElement(): HTMLAudioElement {
    if (!this.instance) {
      this.instance = new Audio();
      this.instance.preload = 'auto';
    }
    return this.instance;
  }

  static async play(audioUrl: string): Promise<void> {
    const audio = this.getAudioElement();
    audio.pause();
    audio.currentTime = 0;
    audio.src = audioUrl;
    
    try {
      await audio.play();
    } catch (error: any) {
      console.error('🔊 Audio playback error:', error);
      throw new Error('Failed to play audio');
    }
  }

  static stop(): void {
    if (this.instance) {
      this.instance.pause();
      this.instance.currentTime = 0;
    }
  }

  static setOnEnded(callback: () => void): void {
    const audio = this.getAudioElement();
    audio.onended = callback;
  }
}

// ============================================================================
// ZUSTAND STORE
// ============================================================================

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      // ======================================================================
      // INITIAL STATE
      // ======================================================================
      
      status: 'idle',
      isProcessing: false,
      error: null,
      sessionId: null, // Will be generated on first message
      messages: [],
      currentResponse: null,
      conversationId: null,
      currentAudioUrl: null,
      isPlaying: false,
      audioElement: null,
      metrics: null,
      autoPlayAudio: true,
      maxMessages: 20,

      // ======================================================================
      // ACTIONS
      // ======================================================================

      setStatus: (status) => {
        set({ status });
        console.log('📊 AI Status:', status);
      },

      addMessage: (role, content, audioUrl, intent) => {
        const message: AIMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          role,
          content,
          timestamp: new Date().toISOString(),
          audioUrl,
          intent,
        };

        set((state) => {
          const messages = [...state.messages, message];
          
          // Keep only last N messages
          if (messages.length > state.maxMessages) {
            return { messages: messages.slice(-state.maxMessages) };
          }
          
          return { messages };
        });
      },

      sendAudio: async (audioBlob: Blob, authToken: string) => {
        try {
          set({ 
            isProcessing: true, 
            status: 'processing', 
            error: null,
            currentResponse: null,
          });

          // ✅ Generate or reuse session ID
          let sessionId = get().sessionId;
          if (!sessionId) {
            sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            set({ sessionId });
            console.log('🆕 New session:', sessionId);
          }

          console.log('🎤 Sending audio with session:', sessionId);

          // Create FormData with sessionId
          const formData = new FormData();
          formData.append('audio', audioBlob, 'recording.webm');
          formData.append('sessionId', sessionId); // ✅ Pass session ID!

          // Send to API with auth
          const response = await fetch('/api/ai/process', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authToken}`,
            },
            body: formData,
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'AI processing failed');
          }

          const data = await response.json();

          console.log('✅ AI Response received:', {
            transcription: data.transcription,
            emotion: data.response.emotion,
            contextUsed: data.contextUsed,
            intent: data.intent,
          });

          // Add messages to history
          get().addMessage('user', data.transcription, undefined, data.intent?.goal);
          get().addMessage(
            'assistant', 
            data.response.message, 
            data.audioUrl,
            data.response.intent
          );

          // Update state
          set({
            currentResponse: {
              ...data.response,
              usedTools: data.response.usedTools || [],
            },
            conversationId: data.sessionId,
            currentAudioUrl: data.audioUrl,
            status: 'responding',
            isProcessing: false,
            metrics: {
              totalTime: data.processingTime,
              tokensUsed: data.tokensUsed,
              contextUsed: data.contextUsed,
            },
          });

          // Auto-play TTS if enabled
          if (get().autoPlayAudio && data.audioUrl) {
            await get().playAudio(data.audioUrl);
          } else {
            // If not auto-playing, return to idle after delay
            setTimeout(() => {
              if (get().status === 'responding') {
                set({ status: 'idle' });
              }
            }, 3000);
          }

        } catch (error: any) {
          console.error('❌ AI Error:', error);
          
          const errorMessage = error.message || 'Failed to process audio';
          
          set({
            error: errorMessage,
            status: 'error',
            isProcessing: false,
            currentResponse: {
              intent: 'error',
              message: errorMessage,
              emotion: 'error',
              confidence: 0,
            },
          });

          // Auto-clear error after 5 seconds
          setTimeout(() => {
            if (get().status === 'error') {
              set({ status: 'idle', error: null });
            }
          }, 5000);
        }
      },

      playAudio: async (audioUrl: string) => {
        try {
          set({ 
            status: 'speaking', 
            isPlaying: true,
            currentAudioUrl: audioUrl,
          });

          // Setup audio end callback
          AudioManager.setOnEnded(() => {
            set({ 
              status: 'idle', 
              isPlaying: false,
              currentAudioUrl: null,
            });
          });

          await AudioManager.play(audioUrl);

          console.log('🔊 Audio playback started');

        } catch (error: any) {
          console.error('🔊 Audio playback error:', error);
          set({ 
            status: 'idle', 
            isPlaying: false,
            error: 'Failed to play audio',
          });
        }
      },

      stopAudio: () => {
        AudioManager.stop();
        set({ 
          status: 'idle', 
          isPlaying: false,
          currentAudioUrl: null,
        });
        console.log('🔊 Audio stopped');
      },

      clearMessages: () => {
        set({ 
          messages: [], 
          currentResponse: null,
          conversationId: null,
          metrics: null,
        });
        console.log('🗑️ Messages cleared');
      },

      setError: (error) => set({ error }),

      setAutoPlayAudio: (enabled) => {
        set({ autoPlayAudio: enabled });
        console.log('🔊 Auto-play audio:', enabled);
      },

      // ✅ NEW: Start a new session (clears context)
      startNewSession: () => {
        const newSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        set({
          sessionId: newSessionId,
          messages: [],
          currentResponse: null,
          conversationId: null,
          metrics: null,
        });
        console.log('🆕 New session started:', newSessionId);
      },

      reset: () => {
        AudioManager.stop();
        set({
          status: 'idle',
          isProcessing: false,
          error: null,
          sessionId: null,
          messages: [],
          currentResponse: null,
          conversationId: null,
          currentAudioUrl: null,
          isPlaying: false,
          metrics: null,
        });
        console.log('🔄 AI Store reset');
      },
    }),
    {
      name: 'ai-store-v2', // Changed name to reset cache
      partialize: (state) => ({
        // Persist these fields
        messages: state.messages,
        sessionId: state.sessionId,
        autoPlayAudio: state.autoPlayAudio,
        maxMessages: state.maxMessages,
      }),
    }
  )
);

// ============================================================================
// HELPER HOOKS
// ============================================================================

export const useAIStatus = () => useAIStore((state) => state.status);
export const useAIMessages = () => useAIStore((state) => state.messages);
export const useAIResponse = () => useAIStore((state) => state.currentResponse);
export const useAIMetrics = () => useAIStore((state) => state.metrics);
export const useIsAIProcessing = () => useAIStore((state) => state.isProcessing);
export const useSessionId = () => useAIStore((state) => state.sessionId);