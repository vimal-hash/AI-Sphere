// @ts-nocheck
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAIStore } from '@/app/store/useAIStore';
import { useAuthStore } from '@/app/store/useAuthStore';

// ============================================================================
// FIXED: First button slides in from left, stays in place when clicked
// Second button fades in below (no slide animation)
// ============================================================================

interface MicrophoneManagerProps {
  onVolumeChange: (volume: number) => void;
}

const AUDIO_CONFIG = {
  sampleRate: 48000,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
} as const;

const RECORDING_CONFIG = {
  mimeType: 'audio/webm;codecs=opus',
  audioBitsPerSecond: 128000,
} as const;

const VAD_CONFIG = {
  silenceThreshold: 0.008,
  silenceDuration: 3000,
  minRecordingDuration: 500,
  maxRecordingDuration: 60000,
  volumeSmoothingFactor: 0.7,
} as const;

const ENABLE_AUTO_STOP = false;

class AudioProcessor {
  private audioContext: AudioContext;
  private analyser: AnalyserNode;
  private gainNode: GainNode;
  private dataArray: Uint8Array;
  private smoothedVolume: number = 0;

  constructor(stream: MediaStream) {
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    const source = this.audioContext.createMediaStreamSource(stream);
    
    this.gainNode = this.audioContext.createGain();
    this.gainNode.gain.value = 1.2;

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    source.connect(this.gainNode).connect(this.analyser);

    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount) as Uint8Array;
  }

  getVolume(): number {
    this.analyser.getByteFrequencyData(this.dataArray);
    
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      const normalized = this.dataArray[i] / 255;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / this.dataArray.length);

    this.smoothedVolume = 
      VAD_CONFIG.volumeSmoothingFactor * this.smoothedVolume +
      (1 - VAD_CONFIG.volumeSmoothingFactor) * rms;

    return this.smoothedVolume;
  }

  isSilent(): boolean {
    return this.getVolume() < VAD_CONFIG.silenceThreshold;
  }

  cleanup(): void {
    if (this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
  }
}

export default function MicrophoneManager({ onVolumeChange }: MicrophoneManagerProps) {
  
  const [isMicrophoneEnabled, setIsMicrophoneEnabled] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentVolume, setCurrentVolume] = useState<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const { status, sendAudio, stopAudio, isPlaying } = useAIStore();
  const { session } = useAuthStore();

  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const animationFrameRef = useRef<number | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const maxDurationTimerRef = useRef<NodeJS.Timeout | null>(null);
  const recordingStartTimeRef = useRef<number>(0);

  const startListening = useCallback(async () => {
    try {
      setError(null);
      
      console.log('🎤 Requesting microphone access...');
      
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: AUDIO_CONFIG
      });

      console.log('✅ Microphone access granted');

      setStream(audioStream);
      setIsMicrophoneEnabled(true);

      const processor = new AudioProcessor(audioStream);
      audioProcessorRef.current = processor;

      const updateVolume = () => {
        if (!audioProcessorRef.current) return;
        const volume = audioProcessorRef.current.getVolume();
        setCurrentVolume(volume);
        onVolumeChange(volume);
        animationFrameRef.current = requestAnimationFrame(updateVolume);
      };
      updateVolume();

    } catch (err: any) {
      console.error('❌ Microphone error:', err);
      
      let errorMessage = 'Failed to access microphone';
      
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Microphone access denied.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No microphone found.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Microphone is in use.';
      }
      
      setError(errorMessage);
      setIsMicrophoneEnabled(false);
    }
  }, [onVolumeChange]);

  const stopRecording = useCallback(() => {
    if (!isRecording || !mediaRecorderRef.current) return;

    console.log('⏹️ Recording stopped');

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);

    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    setIsRecording(false);
    setRecordingDuration(0);
    
  }, [isRecording]);

  const startSilenceDetection = useCallback(() => {
    if (!ENABLE_AUTO_STOP) {
      console.log('ℹ️ Auto-stop disabled');
      return;
    }

    let checkCount = 0;
    let consecutiveSilenceChecks = 0;
    const REQUIRED_SILENT_CHECKS = 3;
    
    const checkSilence = () => {
      if (!audioProcessorRef.current || !mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') return;

      checkCount++;
      const isSilent = audioProcessorRef.current.isSilent();

      if (isSilent) {
        consecutiveSilenceChecks++;
        
        if (consecutiveSilenceChecks >= REQUIRED_SILENT_CHECKS && !silenceTimerRef.current) {
          silenceTimerRef.current = setTimeout(() => {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop();
              setIsRecording(false);
              setRecordingDuration(0);
            }
          }, VAD_CONFIG.silenceDuration);
        }
      } else {
        consecutiveSilenceChecks = 0;
        
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      }

      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording' && checkCount < 600) {
        setTimeout(checkSilence, 100);
      }
    };

    checkSilence();
  }, []);

  const startRecording = useCallback(() => {
    if (!stream || !audioProcessorRef.current || isRecording || !session?.access_token) {
      return;
    }

    console.log('🔴 Recording started');
    
    setIsRecording(true);
    setRecordingDuration(0);
    audioChunksRef.current = [];
    recordingStartTimeRef.current = Date.now();
    
    useAIStore.getState().setStatus('listening');

    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);

    const mediaRecorder = new MediaRecorder(stream, RECORDING_CONFIG);
    mediaRecorderRef.current = mediaRecorder;

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const duration = Date.now() - recordingStartTimeRef.current;
      
      if (duration < VAD_CONFIG.minRecordingDuration) {
        console.warn('⚠️ Recording too short');
        return;
      }

      if (audioChunksRef.current.length === 0) {
        console.warn('⚠️ No audio data');
        return;
      }

      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      
      if (audioBlob.size < 1000) {
        console.warn('⚠️ Audio too small');
        return;
      }

      console.log('💾 Audio recorded:', audioBlob.size, 'bytes');
      
      if (!session?.access_token) {
        console.error('❌ No auth token');
        return;
      }

      try {
        await sendAudio(audioBlob, session.access_token);
      } catch (err) {
        console.error('❌ Send audio error:', err);
      }
    };

    mediaRecorder.start();

    const updateDuration = () => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
        }
        return;
      }
      setRecordingDuration(Date.now() - recordingStartTimeRef.current);
    };
    
    recordingTimerRef.current = setInterval(updateDuration, 100);

    startSilenceDetection();

    maxDurationTimerRef.current = setTimeout(() => {
      console.log('⏱️ Max duration reached');
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        setRecordingDuration(0);
      }
    }, VAD_CONFIG.maxRecordingDuration);

  }, [stream, isRecording, session, sendAudio, startSilenceDetection]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, stopRecording, startRecording]);

  const stopListening = useCallback(() => {
    console.log('🛑 Stopping microphone');

    if (isRecording) {
      stopRecording();
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (audioProcessorRef.current) {
      audioProcessorRef.current.cleanup();
      audioProcessorRef.current = null;
    }

    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    setCurrentVolume(0);
    setIsMicrophoneEnabled(false);
    onVolumeChange(0);
  }, [stream, isRecording, stopRecording, onVolumeChange]);

  useEffect(() => {
    if (status === 'processing' && isRecording) {
      stopRecording();
    }
  }, [status, isRecording, stopRecording]);

  // ============================================================================
  // ANIMATION VARIANTS - FIXED
  // ============================================================================
  
  // First button: Slides in from LEFT on page load
  const firstButtonVariants = {
    hidden: { x: -100, opacity: 0 },  // Start off-screen left
    visible: { 
      x: 0,                           // End at normal position
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
        damping: 15
      }
    }
  };

  // Second button: Just fades in (NO slide) when mic is enabled
  const secondButtonVariants = {
    hidden: { opacity: 0, scale: 0.9 },  // Start invisible, slightly small
    visible: { 
      opacity: 1,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 200,
        damping: 20
      }
    },
    exit: {
      opacity: 0,
      scale: 0.9,
      transition: { duration: 0.2 }
    }
  };

  const pulseVariants = {
    idle: { scale: 1 },
    recording: { 
      scale: [1, 1.1, 1],
      transition: {
        repeat: Infinity,
        duration: 1.5,
      }
    }
  };

  return (
    <div className="fixed left-8 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-6">
      
      {/* FIRST BUTTON: Enable/Disable Microphone - Slides in from left */}
      <motion.button
        variants={firstButtonVariants}
        initial="hidden"
        animate="visible"
        onClick={isMicrophoneEnabled ? stopListening : startListening}
        disabled={status === 'processing' || isPlaying}
        className="group relative"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div 
          className={`
            w-16 h-16
            flex items-center justify-center
            transition-all duration-300
            ${isMicrophoneEnabled 
              ? 'bg-gradient-to-br from-green-400 to-green-600 shadow-lg shadow-green-500/50' 
              : 'bg-white'
            }
            ${(status === 'processing' || isPlaying) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
          style={{
            borderRadius: '150px',
            ...(!isMicrophoneEnabled && {
              background: 'linear-gradient(145deg, #f0f0f0, #cacaca)',
              boxShadow: '13px 13px 26px #acacac, -13px -13px 26px #ffffff'
            })
          }}
        >
          
          <motion.div
            animate={isMicrophoneEnabled ? { rotate: 0 } : { rotate: -20 }}
            transition={{ duration: 0.3 }}
          >
            {isMicrophoneEnabled ? (
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"/>
              </svg>
            ) : (
              <svg 
  className="w-8 h-8" 
  viewBox="0 0 24 24" 
  fill="black"
>
  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
</svg>
            )}
          </motion.div>

          {/* {isMicrophoneEnabled && (
            <motion.div 
              className="absolute -top-1 -right-1 w-4 h-4 bg-green-400 rounded-full border-2 border-gray-900"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
            />
          )} */}
        </div>

        <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
          {isMicrophoneEnabled ? 'Disable Microphone' : 'Enable Microphone'}
        </div>
      </motion.button>

      {/* SECOND BUTTON: Recording Toggle - Fades in (NO slide) */}
      <AnimatePresence mode="wait">
        {isMicrophoneEnabled && (
          <motion.button
            variants={secondButtonVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={toggleRecording}
            disabled={!stream || error !== null || status === 'processing' || isPlaying}
            className="group relative"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div 
              className={`
                w-16 h-16 
                flex items-center justify-center
                transition-all duration-300
                ${isRecording
                  ? 'bg-gradient-to-br from-red-500 to-red-700 shadow-lg shadow-red-500/50'
                  : 'bg-white'
                }
                ${(!stream || error !== null || status === 'processing' || isPlaying) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
              variants={pulseVariants}
              animate={isRecording ? "recording" : "idle"}
              style={{
                borderRadius: '150px',
                ...(!isRecording && {
                  background: 'linear-gradient(145deg, #f0f0f0, #cacaca)',
                  boxShadow: '13px 13px 26px #acacac, -13px -13px 26px #ffffff'
                })
              }}
            >
              
              {isRecording ? (
                <motion.svg 
                  className="w-8 h-8 text-white" 
                  fill="currentColor" 
                  viewBox="0 0 24 24"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  <rect x="6" y="6" width="12" height="12" rx="2" />
                </motion.svg>
              ) : (
                <motion.svg 
                  className="w-8 h-8 text-white" 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200 }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </motion.svg>
              )}

              {isRecording && (
                <motion.div 
                  className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-mono"
                  initial={{ opacity: 0, y: 0}}
                  animate={{ opacity: 1, y: 0 }}
                >
                  {(recordingDuration / 1000).toFixed(1)}s
                </motion.div>
              )}
            </motion.div>

            <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 bg-gray-800 text-white text-sm px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Error Message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute left-full ml-4 top-0 bg-red-500/90 backdrop-blur-md text-white text-sm px-4 py-3 rounded-xl max-w-xs shadow-lg"
          >
            <p className="font-semibold mb-1">⚠️ Error</p>
            <p>{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Indicator */}
      <AnimatePresence>
        {status !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute left-full ml-4 bottom-0 bg-gray-800/90 backdrop-blur-md text-white text-sm px-4 py-2 rounded-xl whitespace-nowrap"
          >
            <div className="flex items-center space-x-2">
              <motion.div 
                className="w-2 h-2 bg-blue-400 rounded-full"
                animate={{ scale: [1, 1.5, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
              />
              <span>
                {status === 'listening' && 'Listening...'}
                {status === 'processing' && 'Processing...'}
                {status === 'responding' && 'Responding...'}
                {status === 'speaking' && 'Speaking...'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}