"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAIStore } from '@/app/store/useAIStore';
import { useAuthStore } from '@/app/store/useAuthStore';

/* ═══════════════════════════════════════════
   TYPES & CONFIG (unchanged)
   ═══════════════════════════════════════════ */
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

/* ═══════════════════════════════════════════
   AUDIO PROCESSOR CLASS (unchanged)
   ═══════════════════════════════════════════ */
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
    this.dataArray = new Uint8Array(this.analyser.frequencyBinCount) as unknown as Uint8Array;
  }

  getVolume(): number {
    this.analyser.getByteFrequencyData(this.dataArray as any);
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

/* ═══════════════════════════════════════════
   COMPONENT
   ═══════════════════════════════════════════ */
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

  /* ─── Start Listening (unchanged logic) ─── */
  const startListening = useCallback(async () => {
    try {
      setError(null);
      const audioStream = await navigator.mediaDevices.getUserMedia({
        audio: AUDIO_CONFIG
      });
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
      if (err.name === 'NotAllowedError') errorMessage = 'Microphone access denied.';
      else if (err.name === 'NotFoundError') errorMessage = 'No microphone found.';
      else if (err.name === 'NotReadableError') errorMessage = 'Microphone is in use.';
      setError(errorMessage);
      setIsMicrophoneEnabled(false);
    }
  }, [onVolumeChange]);

  /* ─── Stop Recording (unchanged logic) ─── */
  const stopRecording = useCallback(() => {
    if (!isRecording || !mediaRecorderRef.current) return;
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (maxDurationTimerRef.current) clearTimeout(maxDurationTimerRef.current);
    if (mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingDuration(0);
  }, [isRecording]);

  /* ─── Silence Detection (unchanged logic) ─── */
  const startSilenceDetection = useCallback(() => {
    if (!ENABLE_AUTO_STOP) return;
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

  /* ─── Start Recording (unchanged logic) ─── */
  const startRecording = useCallback(() => {
    if (!stream || !audioProcessorRef.current || isRecording || !session?.access_token) return;
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
      if (duration < VAD_CONFIG.minRecordingDuration) return;
      if (audioChunksRef.current.length === 0) return;
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      if (audioBlob.size < 1000) return;
      if (!session?.access_token) return;
      try {
        await sendAudio(audioBlob, session.access_token);
      } catch (err) {
        console.error('❌ Send audio error:', err);
      }
    };

    mediaRecorder.start();

    const updateDuration = () => {
      if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
        if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
        return;
      }
      setRecordingDuration(Date.now() - recordingStartTimeRef.current);
    };
    recordingTimerRef.current = setInterval(updateDuration, 100);
    startSilenceDetection();

    maxDurationTimerRef.current = setTimeout(() => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        setRecordingDuration(0);
      }
    }, VAD_CONFIG.maxRecordingDuration);
  }, [stream, isRecording, session, sendAudio, startSilenceDetection]);

  const toggleRecording = useCallback(() => {
    if (isRecording) stopRecording();
    else startRecording();
  }, [isRecording, stopRecording, startRecording]);

  /* ─── Stop Listening (unchanged logic) ─── */
  const stopListening = useCallback(() => {
    if (isRecording) stopRecording();
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

  /* ─── Helpers ─── */
  const isDisabled = status === 'processing' || isPlaying;

  const getStatusText = () => {
    if (status === 'listening') return 'Listening…';
    if (status === 'processing') return 'Processing…';
    if (status === 'responding') return 'Responding…';
    if (status === 'speaking') return 'Speaking…';
    return null;
  };

  const statusText = getStatusText();

  /* ═══════════════════════════════════════════
     RENDER — Floating Control Bar (Left-center)
     ═══════════════════════════════════════════ */
  return (
    <div className="fixed left-6 top-1/2 -translate-y-1/2 z-50 flex flex-col items-center gap-3">

      {/* ── Microphone Enable/Disable ── */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        onClick={isMicrophoneEnabled ? stopListening : startListening}
        disabled={isDisabled}
        className="group relative"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        <div
          className="w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300"
          style={{
            background: isMicrophoneEnabled ? 'var(--success)' : 'var(--surface)',
            border: `1px solid ${isMicrophoneEnabled ? 'var(--success)' : 'var(--border-strong)'}`,
            boxShadow: isMicrophoneEnabled
              ? '0 0 0 4px var(--success-subtle), var(--shadow-md)'
              : 'var(--shadow-md)',
            opacity: isDisabled ? 0.4 : 1,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
          }}
        >
          <motion.div animate={isMicrophoneEnabled ? { rotate: 0 } : { rotate: 0 }} transition={{ duration: 0.3 }}>
            {isMicrophoneEnabled ? (
              /* Mic ON icon */
              <svg className="w-5 h-5" fill="none" stroke="#ffffff" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
              </svg>
            ) : (
              /* Mic OFF icon */
              <svg className="w-5 h-5" fill="none" stroke="var(--foreground-secondary)" viewBox="0 0 24 24" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 9.75L19.5 12m0 0l2.25 2.25M19.5 12l2.25-2.25M19.5 12l-2.25 2.25m-10.5-6l4.72-4.72a.75.75 0 011.28.531V19.94a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.506-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.757 3.63 8.25 4.51 8.25H6.75z" />
              </svg>
            )}
          </motion.div>
        </div>

        {/* Tooltip */}
        <div
          className="tooltip-elite absolute left-full ml-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        >
          {isMicrophoneEnabled ? 'Disable Microphone' : 'Enable Microphone'}
        </div>
      </motion.button>

      {/* ── Record Button ── */}
      <AnimatePresence mode="wait">
        {isMicrophoneEnabled && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            onClick={toggleRecording}
            disabled={!stream || error !== null || isDisabled}
            className="group relative"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <motion.div
              className="w-12 h-12 flex items-center justify-center rounded-full transition-all duration-300"
              style={{
                background: isRecording ? 'var(--error)' : 'var(--surface)',
                border: `1px solid ${isRecording ? 'var(--error)' : 'var(--border-strong)'}`,
                boxShadow: isRecording
                  ? '0 0 0 4px var(--error-subtle), var(--shadow-md)'
                  : 'var(--shadow-md)',
                opacity: (!stream || error !== null || isDisabled) ? 0.4 : 1,
                cursor: (!stream || error !== null || isDisabled) ? 'not-allowed' : 'pointer',
              }}
              animate={isRecording ? {
                boxShadow: [
                  '0 0 0 0px rgba(155, 44, 44, 0.3), var(--shadow-md)',
                  '0 0 0 12px rgba(155, 44, 44, 0), var(--shadow-md)',
                ],
              } : {}}
              transition={isRecording ? { repeat: Infinity, duration: 2, ease: 'easeInOut' } : {}}
            >
              {isRecording ? (
                /* Stop icon */
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="w-4 h-4 rounded-[3px]"
                  style={{ background: '#ffffff' }}
                />
              ) : (
                /* Mic icon */
                <svg className="w-5 h-5" fill="none" stroke="var(--foreground-secondary)" viewBox="0 0 24 24" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
                </svg>
              )}
            </motion.div>

            {/* Recording Timer Badge */}
            <AnimatePresence>
              {isRecording && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="absolute -bottom-1.5 left-1/2 -translate-x-1/2"
                >
                  <div
                    className="px-2 py-0.5 rounded-full text-[10px] font-medium tabular-nums"
                    style={{
                      background: 'var(--error)',
                      color: '#ffffff',
                      fontFamily: 'var(--font-mono)',
                      boxShadow: 'var(--shadow-sm)',
                    }}
                  >
                    {(recordingDuration / 1000).toFixed(1)}s
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Tooltip */}
            <div className="tooltip-elite absolute left-full ml-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </div>
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Error Toast ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-full ml-4 top-0"
          >
            <div
              className="flex items-start gap-2.5 px-4 py-3 rounded-[var(--radius-md)] max-w-xs"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--error)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="var(--error)" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
              </svg>
              <div>
                <p
                  className="text-xs font-semibold mb-0.5"
                  style={{ color: 'var(--error)', fontFamily: 'var(--font-body)' }}
                >
                  Error
                </p>
                <p
                  className="text-xs"
                  style={{ color: 'var(--foreground-secondary)', fontFamily: 'var(--font-body)' }}
                >
                  {error}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Status Indicator ── */}
      <AnimatePresence>
        {statusText && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 4 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                background: 'var(--surface-glass)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <motion.div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: 'var(--accent)' }}
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
              />
              <span
                className="text-[11px] font-medium"
                style={{
                  color: 'var(--foreground-secondary)',
                  fontFamily: 'var(--font-body)',
                  letterSpacing: '0.02em',
                }}
              >
                {statusText}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}