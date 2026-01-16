"use client";

import { useAIStore } from '@/app/store/useAIStore';
import { useEffect, useState } from 'react';



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
  const [usedTools, setUsedTools] = useState<string[]>([]);


  useEffect(() => {
    if (status === 'responding' && !isPlaying) {
      const timer = setTimeout(() => {
        useAIStore.setState({ currentResponse: null });
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [status, isPlaying]);

  const getEmotionEmoji = (emotion?: string) => {
    switch (emotion) {
      case 'calm': return '😊';
      case 'excited': return '🎉';
      case 'thinking': return '🤔';
      case 'error': return '😅';
      default: return '💬';
    }
  };

  const getEmotionColor = (emotion?: string) => {
    switch (emotion) {
      case 'calm': return 'from-blue-500/20 to-cyan-500/20 border-blue-500/50';
      case 'excited': return 'from-green-500/20 to-emerald-500/20 border-green-500/50';
      case 'thinking': return 'from-purple-500/20 to-pink-500/20 border-purple-500/50';
      case 'error': return 'from-red-500/20 to-orange-500/20 border-red-500/50';
      default: return 'from-gray-500/20 to-slate-500/20 border-gray-500/50';
    }
  };

  const getStatusAnimation = () => {
    if (isPlaying) return 'animate-pulse';
    if (status === 'processing') return 'animate-bounce';
    return '';
  };

  const getToolIcon = (tool: string) => {
    switch (tool) {
      case 'search_web': return '🔍';
      case 'calculate': return '🧮';
      case 'get_weather': return '🌤️';
      case 'set_reminder': return '⏰';
      default: return '🛠️';
    }
  };

  const getToolName = (tool: string) => {
    switch (tool) {
      case 'search_web': return 'Web Search';
      case 'calculate': return 'Calculator';
      case 'get_weather': return 'Weather';
      case 'set_reminder': return 'Reminder';
      default: return tool;
    }
  };

  if (!currentResponse && messages.length === 0) return null;

  return (
    <div className="fixed bottom-[3%] left-1/2 translate-x-[26%] z-40 max-w-3xl w-full px-6">
      <div className="space-y-4">
        
       
        
        {currentResponse && (
          <div 
            className={`bg-gradient-to-r ${getEmotionColor(currentResponse.emotion)} backdrop-blur-xl rounded-2xl p-6 shadow-2xl border animate-in fade-in slide-in-from-bottom-4 duration-500`}
          >
            <div className="flex items-start space-x-4">
              
              <div className={`text-5xl ${getStatusAnimation()}`}>
                {getEmotionEmoji(currentResponse.emotion)}
              </div>

             
              <div className="flex-1 space-y-3">
                
                <p className="text-white text-lg leading-relaxed font-medium">
                  {currentResponse.message}
                </p>

                
                {(currentResponse as any).usedTools && (currentResponse as any).usedTools.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {(currentResponse as any).usedTools.map((tool: string, idx: number) => (
                      <div
                        key={idx}
                        className="flex items-center space-x-1 px-3 py-1 bg-white/10 rounded-full text-xs text-white/90 border border-white/20"
                      >
                        <span>{getToolIcon(tool)}</span>
                        <span>{getToolName(tool)}</span>
                      </div>
                    ))}
                  </div>
                )}

               
                <div className="flex items-center justify-between text-xs text-white/60">
                  <div className="flex items-center space-x-4">
                    {currentResponse.intent && (
                      <span className="px-2 py-1 bg-white/10 rounded">
                        Intent: {currentResponse.intent}
                      </span>
                    )}
                    {currentResponse.confidence && (
                      <span className="px-2 py-1 bg-white/10 rounded">
                        Confidence: {(currentResponse.confidence * 100).toFixed(0)}%
                      </span>
                    )}
                    {status === 'speaking' && (
                      <span className="px-2 py-1 bg-green-500/30 rounded flex items-center space-x-1">
                        <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                        <span>Speaking</span>
                      </span>
                    )}
                  </div>

                
                  <div className="flex items-center space-x-2">
                    {currentAudioUrl && (
                      <>
                        {!isPlaying ? (
                          <button
                            onClick={() => playAudio(currentAudioUrl)}
                            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                            title="Play audio"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                            </svg>
                          </button>
                        ) : (
                          <button
                            onClick={stopAudio}
                            className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors animate-pulse"
                            title="Stop audio"
                          >
                            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                
                {metrics && (
                  <button
                    onClick={() => setShowMetrics(!showMetrics)}
                    className="text-xs text-white/50 hover:text-white/80 transition-colors"
                  >
                    {showMetrics ? '▼' : '▶'} Performance Metrics
                  </button>
                )}

               
                {showMetrics && metrics && (
                  <div className="grid grid-cols-2 gap-3 p-4 bg-black/30 rounded-lg">
                    <div>
                      <p className="text-xs text-white/60">Processing Time</p>
                      <p className="text-sm font-mono text-white">
                        {metrics.totalTime}ms
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-white/60">Tokens Used</p>
                      <p className="text-sm font-mono text-white">
                        {metrics.tokensUsed}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        
        
        {messages.length > 0 && (
          <div className="text-center">
            <button
              onClick={() => setShowMessages(!showMessages)}
              className="px-4 py-2 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white/80 hover:text-white rounded-full text-sm transition-all duration-300 border border-white/10"
            >
              {showMessages ? '▼ Hide' : '▲ Show'} Conversation ({messages.length})
            </button>
            
            {showMessages && (
              <div className="mt-4 bg-black/80 backdrop-blur-xl rounded-2xl p-6 max-h-96 overflow-y-auto space-y-3 border border-white/10 shadow-2xl">
               
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <span className="text-sm text-white/80">Auto-play responses</span>
                  <button
                    onClick={() => setAutoPlayAudio(!autoPlayAudio)}
                    className={`relative w-12 h-6 rounded-full transition-colors ${
                      autoPlayAudio ? 'bg-green-600' : 'bg-gray-600'
                    }`}
                  >
                    <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      autoPlayAudio ? 'translate-x-6' : 'translate-x-0'
                    }`} />
                  </button>
                </div>

               
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`text-left p-4 rounded-xl transition-all duration-300 ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-r from-blue-500/20 to-cyan-500/20 border border-blue-500/30'
                        : 'bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-xs font-semibold mb-2 text-white/70">
                          {msg.role === 'user' ? '🗣️ You' : '🤖 AI Assistant'}
                          <span className="ml-2 text-white/50">
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </span>
                        </p>
                        <p className="text-sm text-white leading-relaxed">
                          {msg.content}
                        </p>
                      </div>

                     
                      {msg.role === 'assistant' && msg.audioUrl && (
                        <button
                          onClick={() => playAudio(msg.audioUrl!)}
                          className="ml-3 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex-shrink-0"
                          title="Replay"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      
        
        {status !== 'idle' && status !== 'responding' && (
          <div className="flex justify-center">
            <div className="px-6 py-3 bg-black/60 backdrop-blur-md rounded-full border border-white/20">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                <span className="text-sm text-white/90">
                  {status === 'listening' && 'Listening to your voice...'}
                  {status === 'processing' && 'Processing your request...'}
                  {status === 'speaking' && 'AI is speaking...'}
                  {status === 'error' && 'An error occurred'}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}