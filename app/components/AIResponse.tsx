"use client";

import { useAIStore } from '@/app/store/useAIStore';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AIResponse() {
  const {
    currentResponse,
    messages,
    status,
    metrics,
    isPlaying,
    playAudio,
    stopAudio,
    currentAudioUrl,
    autoPlayAudio,
    setAutoPlayAudio,
  } = useAIStore();

  const [showMessages, setShowMessages] = useState(false);
  const [showMetrics, setShowMetrics] = useState(false);

  /* Auto-dismiss response card */
  useEffect(() => {
    if (status === 'responding' && !isPlaying) {
      const timer = setTimeout(() => {
        useAIStore.setState({ currentResponse: null });
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [status, isPlaying]);

  /* ─── Emotion Mapping ─── */
  const getEmotionIcon = (emotion?: string) => {
    switch (emotion) {
      case 'calm': return '◆';
      case 'excited': return '✦';
      case 'thinking': return '◇';
      case 'error': return '✕';
      default: return '◈';
    }
  };

  const getEmotionAccent = (emotion?: string) => {
    switch (emotion) {
      case 'calm': return 'var(--accent)';
      case 'excited': return 'var(--success)';
      case 'thinking': return 'var(--info)';
      case 'error': return 'var(--error)';
      default: return 'var(--accent)';
    }
  };

  const getToolLabel = (tool: string) => {
    switch (tool) {
      case 'search_web': return 'Search';
      case 'calculate': return 'Calculate';
      case 'get_weather': return 'Weather';
      case 'set_reminder': return 'Reminder';
      default: return tool;
    }
  };

  if (!currentResponse && messages.length === 0) return null;

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl px-6">
      <div className="space-y-3">

        {/* ═══════════════════════════════════════════
           CURRENT RESPONSE CARD
           ═══════════════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {currentResponse && (
            <motion.div
              key="response-card"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <div
                className="relative overflow-hidden"
                style={{
                  background: 'var(--surface-glass)',
                  backdropFilter: 'blur(32px) saturate(1.3)',
                  WebkitBackdropFilter: 'blur(32px) saturate(1.3)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-xl)',
                  boxShadow: 'var(--shadow-xl)',
                }}
              >
                {/* Top accent line */}
                <div
                  className="h-[2px] w-full"
                  style={{
                    background: `linear-gradient(90deg, transparent 0%, ${getEmotionAccent(currentResponse.emotion)} 50%, transparent 100%)`,
                  }}
                />

                <div className="p-5">
                  {/* Response Header */}
                  <div className="flex items-start gap-4">
                    {/* Emotion Indicator */}
                    <div
                      className="w-9 h-9 flex items-center justify-center rounded-full flex-shrink-0 mt-0.5"
                      style={{
                        background: `${getEmotionAccent(currentResponse.emotion)}12`,
                        border: `1px solid ${getEmotionAccent(currentResponse.emotion)}25`,
                      }}
                    >
                      <motion.span
                        className="text-sm"
                        style={{ color: getEmotionAccent(currentResponse.emotion) }}
                        animate={isPlaying ? { scale: [1, 1.15, 1] } : {}}
                        transition={isPlaying ? { repeat: Infinity, duration: 1.5 } : {}}
                      >
                        {getEmotionIcon(currentResponse.emotion)}
                      </motion.span>
                    </div>

                    {/* Response Content */}
                    <div className="flex-1 min-w-0 space-y-3">
                      {/* Message Text */}
                      <p
                        className="text-[15px] leading-relaxed"
                        style={{
                          color: 'var(--foreground)',
                          fontFamily: 'var(--font-body)',
                          fontWeight: 400,
                        }}
                      >
                        {currentResponse.message}
                      </p>

                      {/* Tool Badges */}
                      {(currentResponse as any).usedTools && (currentResponse as any).usedTools.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {(currentResponse as any).usedTools.map((tool: string, idx: number) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wider"
                              style={{
                                background: 'var(--accent-subtle)',
                                color: 'var(--accent)',
                                fontFamily: 'var(--font-body)',
                                border: '1px solid var(--border-accent)',
                                letterSpacing: '0.06em',
                              }}
                            >
                              <span style={{ fontSize: '8px' }}>●</span>
                              {getToolLabel(tool)}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Meta Row */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {currentResponse.intent && (
                            <span
                              className="text-[10px] font-medium uppercase tracking-wider"
                              style={{
                                color: 'var(--foreground-subtle)',
                                fontFamily: 'var(--font-mono)',
                                letterSpacing: '0.08em',
                              }}
                            >
                              {currentResponse.intent}
                            </span>
                          )}
                          {currentResponse.confidence != null && (
                            <>
                              <span style={{ color: 'var(--border-strong)', fontSize: '8px' }}>●</span>
                              <span
                                className="text-[10px] font-medium tabular-nums"
                                style={{
                                  color: 'var(--foreground-subtle)',
                                  fontFamily: 'var(--font-mono)',
                                }}
                              >
                                {(currentResponse.confidence * 100).toFixed(0)}%
                              </span>
                            </>
                          )}
                          {status === 'speaking' && (
                            <motion.span
                              className="flex items-center gap-1 text-[10px] font-medium"
                              style={{ color: 'var(--success)' }}
                              animate={{ opacity: [1, 0.5, 1] }}
                              transition={{ repeat: Infinity, duration: 1.5 }}
                            >
                              <span className="w-1 h-1 rounded-full" style={{ background: 'var(--success)' }} />
                              Speaking
                            </motion.span>
                          )}
                        </div>

                        {/* Audio Controls */}
                        <div className="flex items-center gap-1.5">
                          {currentAudioUrl && (
                            <>
                              {!isPlaying ? (
                                <button
                                  onClick={() => playAudio(currentAudioUrl)}
                                  className="w-7 h-7 flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer"
                                  style={{
                                    background: 'var(--surface-overlay)',
                                    border: '1px solid var(--border)',
                                  }}
                                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-subtle)'; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-overlay)'; }}
                                  title="Play audio"
                                >
                                  <svg className="w-3 h-3" fill="var(--foreground-secondary)" viewBox="0 0 20 20">
                                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                  </svg>
                                </button>
                              ) : (
                                <button
                                  onClick={stopAudio}
                                  className="w-7 h-7 flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer"
                                  style={{
                                    background: 'var(--accent-subtle)',
                                    border: '1px solid var(--border-accent)',
                                  }}
                                  title="Stop audio"
                                >
                                  <motion.svg
                                    className="w-3 h-3"
                                    fill="var(--accent)"
                                    viewBox="0 0 20 20"
                                    animate={{ scale: [1, 1.1, 1] }}
                                    transition={{ repeat: Infinity, duration: 1 }}
                                  >
                                    <rect x="5" y="5" width="10" height="10" rx="1.5" />
                                  </motion.svg>
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Metrics Toggle */}
                      {metrics && (
                        <button
                          onClick={() => setShowMetrics(!showMetrics)}
                          className="text-[10px] font-medium flex items-center gap-1 transition-colors duration-200 cursor-pointer"
                          style={{
                            color: 'var(--foreground-subtle)',
                            fontFamily: 'var(--font-mono)',
                          }}
                          onMouseEnter={(e) => { (e.target as HTMLElement).style.color = 'var(--foreground-secondary)'; }}
                          onMouseLeave={(e) => { (e.target as HTMLElement).style.color = 'var(--foreground-subtle)'; }}
                        >
                          <motion.span
                            animate={{ rotate: showMetrics ? 90 : 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            ›
                          </motion.span>
                          Metrics
                        </button>
                      )}

                      {/* Metrics Panel */}
                      <AnimatePresence>
                        {showMetrics && metrics && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                            className="overflow-hidden"
                          >
                            <div
                              className="flex gap-6 pt-3 mt-1"
                              style={{ borderTop: '1px solid var(--border)' }}
                            >
                              <div>
                                <p
                                  className="text-[10px] uppercase tracking-wider mb-0.5"
                                  style={{
                                    color: 'var(--foreground-subtle)',
                                    fontFamily: 'var(--font-body)',
                                    letterSpacing: '0.08em',
                                  }}
                                >
                                  Latency
                                </p>
                                <p
                                  className="text-sm font-medium tabular-nums"
                                  style={{
                                    color: 'var(--foreground)',
                                    fontFamily: 'var(--font-mono)',
                                  }}
                                >
                                  {metrics.totalTime}ms
                                </p>
                              </div>
                              <div>
                                <p
                                  className="text-[10px] uppercase tracking-wider mb-0.5"
                                  style={{
                                    color: 'var(--foreground-subtle)',
                                    fontFamily: 'var(--font-body)',
                                    letterSpacing: '0.08em',
                                  }}
                                >
                                  Tokens
                                </p>
                                <p
                                  className="text-sm font-medium tabular-nums"
                                  style={{
                                    color: 'var(--foreground)',
                                    fontFamily: 'var(--font-mono)',
                                  }}
                                >
                                  {metrics.tokensUsed}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════════════════════════════════════════
           CONVERSATION HISTORY TOGGLE
           ═══════════════════════════════════════════ */}
        {messages.length > 0 && (
          <div className="flex justify-center">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowMessages(!showMessages)}
              className="flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer transition-all duration-300"
              style={{
                background: 'var(--surface-glass)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid var(--border)',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              <motion.svg
                animate={{ rotate: showMessages ? 180 : 0 }}
                transition={{ duration: 0.25 }}
                className="w-3 h-3"
                fill="none"
                stroke="var(--foreground-muted)"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
              </motion.svg>

              <span
                className="text-xs font-medium"
                style={{
                  color: 'var(--foreground-secondary)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                Conversation
              </span>

              <span
                className="text-[10px] font-medium tabular-nums px-1.5 py-0.5 rounded-full"
                style={{
                  background: 'var(--accent-subtle)',
                  color: 'var(--accent)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {messages.length}
              </span>
            </motion.button>

            {/* ── Conversation Drawer ── */}
            <AnimatePresence>
              {showMessages && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.98 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute bottom-full mb-3 left-0 right-0"
                >
                  <div
                    className="max-h-80 overflow-hidden flex flex-col"
                    style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-xl)',
                      boxShadow: 'var(--shadow-xl)',
                    }}
                  >
                    {/* Drawer Header */}
                    <div
                      className="flex items-center justify-between px-5 py-3 flex-shrink-0"
                      style={{ borderBottom: '1px solid var(--border)' }}
                    >
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider"
                        style={{
                          color: 'var(--foreground-muted)',
                          fontFamily: 'var(--font-body)',
                          letterSpacing: '0.1em',
                        }}
                      >
                        History
                      </span>

                      {/* Auto-play Toggle */}
                      <button
                        onClick={() => setAutoPlayAudio(!autoPlayAudio)}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <span
                          className="text-[10px] font-medium"
                          style={{ color: 'var(--foreground-muted)', fontFamily: 'var(--font-body)' }}
                        >
                          Auto-play
                        </span>
                        <div
                          className="relative w-8 h-[18px] rounded-full transition-colors duration-300"
                          style={{
                            background: autoPlayAudio ? 'var(--accent)' : 'var(--border-strong)',
                          }}
                        >
                          <motion.div
                            className="absolute top-[3px] w-3 h-3 rounded-full"
                            style={{ background: '#ffffff', boxShadow: 'var(--shadow-sm)' }}
                            animate={{ left: autoPlayAudio ? 17 : 3 }}
                            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
                          />
                        </div>
                      </button>
                    </div>

                    {/* Messages */}
                    <div className="overflow-y-auto p-3 space-y-2 flex-1">
                      {messages.map((msg, idx) => (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.03 }}
                          className="flex gap-3 p-3 rounded-[var(--radius-md)] transition-colors duration-200"
                          style={{
                            background: msg.role === 'user' ? 'var(--surface-overlay)' : 'var(--accent-subtle)',
                          }}
                        >
                          {/* Role Indicator */}
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{
                              background: msg.role === 'user' ? 'var(--foreground)' : 'var(--accent)',
                              color: '#ffffff',
                              fontSize: '10px',
                              fontWeight: 600,
                              fontFamily: 'var(--font-body)',
                            }}
                          >
                            {msg.role === 'user' ? 'Y' : 'N'}
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* Name & Time */}
                            <div className="flex items-center gap-2 mb-1">
                              <span
                                className="text-[10px] font-semibold uppercase tracking-wider"
                                style={{
                                  color: msg.role === 'user' ? 'var(--foreground-secondary)' : 'var(--accent)',
                                  fontFamily: 'var(--font-body)',
                                  letterSpacing: '0.06em',
                                }}
                              >
                                {msg.role === 'user' ? 'You' : 'Sphere'}
                              </span>
                              <span
                                className="text-[10px] tabular-nums"
                                style={{
                                  color: 'var(--foreground-subtle)',
                                  fontFamily: 'var(--font-mono)',
                                }}
                              >
                                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>

                            {/* Message Content */}
                            <p
                              className="text-[13px] leading-relaxed"
                              style={{
                                color: 'var(--foreground)',
                                fontFamily: 'var(--font-body)',
                              }}
                            >
                              {msg.content}
                            </p>
                          </div>

                          {/* Replay Button */}
                          {msg.role === 'assistant' && msg.audioUrl && (
                            <button
                              onClick={() => playAudio(msg.audioUrl!)}
                              className="w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0 mt-0.5 cursor-pointer transition-all duration-200"
                              style={{
                                background: 'var(--surface-overlay)',
                                border: '1px solid var(--border)',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--accent-subtle)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-overlay)'; }}
                              title="Replay"
                            >
                              <svg className="w-2.5 h-2.5" fill="var(--foreground-secondary)" viewBox="0 0 20 20">
                                <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                              </svg>
                            </button>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* ═══════════════════════════════════════════
           PROCESSING STATUS BAR
           ═══════════════════════════════════════════ */}
        <AnimatePresence>
          {status !== 'idle' && status !== 'responding' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="flex justify-center"
            >
              <div
                className="flex items-center gap-2.5 px-4 py-2 rounded-full"
                style={{
                  background: 'var(--surface-glass)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {/* Animated dots */}
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1 h-1 rounded-full"
                      style={{ background: 'var(--accent)' }}
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.4, 1, 0.4],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.2,
                        delay: i * 0.2,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}
                </div>

                <span
                  className="text-xs font-medium"
                  style={{
                    color: 'var(--foreground-secondary)',
                    fontFamily: 'var(--font-body)',
                  }}
                >
                  {status === 'listening' && 'Listening to your voice…'}
                  {status === 'processing' && 'Processing your request…'}
                  {status === 'speaking' && 'Sphere is speaking…'}
                  {status === 'error' && 'Something went wrong'}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}