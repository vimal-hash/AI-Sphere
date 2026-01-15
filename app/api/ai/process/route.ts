// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

// ============================================================================
// ADVANCED AI WITH DATABASE MEMORY - FIXED
// No more constraint errors! Check-then-update pattern.
// ============================================================================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  // process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ============================================================================
// DATABASE MEMORY FUNCTIONS - FIXED
// ============================================================================

interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  tools?: string[];
}

async function getSessionMemory(sessionId: string, userId: string): Promise<ConversationTurn[]> {
  try {
    const { data, error } = await supabase
      .from('session_memory')
      .select('turns')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (error || !data) {
      console.log('📭 No previous memory found');
      return [];
    }

    console.log('💾 Loaded from database:', data.turns.length, 'turns');
    return data.turns.slice(-10); // Last 10 turns
  } catch (error) {
    console.error('❌ Memory fetch error:', error);
    return [];
  }
}

async function saveSessionTurn(
  sessionId: string,
  userId: string,
  turn: ConversationTurn,
  existingTurns: ConversationTurn[]
) {
  try {
    const allTurns = [...existingTurns, turn];
    const recentTurns = allTurns.slice(-10); // Keep last 10

    // ✅ FIX: Check if record exists first
    const { data: existing } = await supabase
      .from('session_memory')
      .select('*')
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .maybeSingle(); // Use maybeSingle to avoid errors when not found

    if (existing) {
      // Update existing record
      const { error } = await supabase
        .from('session_memory')
        .update({
          turns: recentTurns,
          current_intent: 'general_query',
          intent_confidence: 0.7,
          last_activity: new Date().toISOString(),
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        })
        .eq('user_id', userId)
        .eq('session_id', sessionId);

      if (error) {
        console.error('❌ Update error:', error);
      } else {
        console.log('✅ Updated in database');
      }
    } else {
      // Insert new record
      const { error } = await supabase
        .from('session_memory')
        .insert({
          user_id: userId,
          session_id: sessionId,
          turns: recentTurns,
          current_intent: 'general_query',
          intent_confidence: 0.7,
          last_activity: new Date().toISOString(),
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        });

      if (error) {
        console.error('❌ Insert error:', error);
      } else {
        console.log('✅ Inserted to database');
      }
    }
  } catch (error) {
    console.error('❌ Save turn error:', error);
  }
}

async function saveIntentMemory(userId: string, goal: string, confidence: number) {
  try {
    // Check if user already has an active intent
    const { data: existing } = await supabase
      .from('intent_memory')
      .select('*')
      .eq('user_id', userId)
      .eq('goal_status', 'active')
      .maybeSingle();

    if (existing && existing.current_goal === goal) {
      // Update existing
      await supabase
        .from('intent_memory')
        .update({
          goal_confidence: confidence,
          last_updated: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('current_goal', goal)
        .eq('goal_status', 'active');
    } else {
      // Create new
      await supabase
        .from('intent_memory')
        .insert({
          user_id: userId,
          current_goal: goal,
          goal_status: 'active',
          goal_confidence: confidence,
          key_entities: [],
          preferred_output_style: 'balanced',
          interaction_mode: 'voice',
          goal_started_at: new Date().toISOString(),
          last_updated: new Date().toISOString(),
        });
    }

    console.log('✅ Intent saved:', goal);
  } catch (error) {
    console.error('❌ Intent save error:', error);
  }
}

async function updateUserMemory(userId: string) {
  try {
    const { data: existing } = await supabase
      .from('user_memory')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      // Update stats
      await supabase
        .from('user_memory')
        .update({
          total_turns: existing.total_turns + 1,
          last_interaction: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);
    } else {
      // Create new user memory
      await supabase
        .from('user_memory')
        .insert({
          user_id: userId,
          preferences: {
            response_length: 'moderate',
            formality: 'casual',
            detail_level: 'balanced',
            uses_voice: true,
            auto_play_audio: true,
          },
          patterns: {
            common_topics: [],
            typical_session_length: 5,
            preferred_tools: [],
            common_follow_up_types: [],
          },
          total_sessions: 1,
          total_turns: 1,
          avg_session_length: 5.0,
          first_interaction: new Date().toISOString(),
          last_interaction: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
    }

    console.log('✅ User stats updated');
  } catch (error) {
    console.error('❌ User memory error:', error);
  }
}

// ============================================================================
// BUILD CONTEXT
// ============================================================================

function buildContextPrompt(history: ConversationTurn[]): string {
  if (history.length === 0) return '';

  const contextLines = history.map((turn, idx) => {
    const toolInfo = turn.tools?.length ? ` [Used: ${turn.tools.join(', ')}]` : '';
    return `${turn.role.toUpperCase()}: ${turn.content}${toolInfo}`;
  });

  return `
CONVERSATION HISTORY (Last ${history.length} turns):
${contextLines.join('\n')}
`;
}

// ============================================================================
// TOOLS
// ============================================================================

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_web',
      description: 'Search internet for current information',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate',
      description: 'Perform mathematical calculations',
      parameters: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'Math expression' },
        },
        required: ['expression'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get current weather for any location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name' },
        },
        required: ['location'],
      },
    },
  },
];

async function searchWeb(query: string): Promise<string> {
  try {
    const response = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    );
    const data = await response.json();
    return data.Abstract || data.RelatedTopics?.[0]?.Text || 'No results found.';
  } catch (error) {
    return 'Search failed.';
  }
}

async function calculate(expression: string): Promise<string> {
  try {
    const sanitized = expression.replace(/[^0-9+\-*/().sqrt,pow,sin,cos,tan,log,abs,Math.\s]/gi, '');
    const result = new Function('Math', `return ${sanitized}`)(Math);
    return `The answer is ${result}`;
  } catch (error) {
    return 'Calculation failed.';
  }
}

async function getWeather(location: string): Promise<string> {
  try {
    const response = await fetch(
      `https://wttr.in/${encodeURIComponent(location)}?format=j1`
    );
    const data = await response.json();
    const current = data.current_condition[0];
    return `Current weather in ${location}: ${current.temp_C}°C, ${current.weatherDesc[0].value}. Humidity: ${current.humidity}%, Wind: ${current.windspeedKmph} km/h.`;
  } catch (error) {
    return `Unable to get weather for ${location}.`;
  }
}

async function executeFunctionCall(functionName: string, functionArgs: any): Promise<string> {
  switch (functionName) {
    case 'search_web': return await searchWeb(functionArgs.query);
    case 'calculate': return await calculate(functionArgs.expression);
    case 'get_weather': return await getWeather(functionArgs.location);
    default: return 'Unknown function.';
  }
}

// ============================================================================
// MAIN API HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    console.log('\n===== DATABASE MEMORY AI =====');

    // Auth
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = user.id;

    // Get audio and session
    const formData = await request.formData();
    const audioFile = formData.get('audio') as File;
    const sessionId = (formData.get('sessionId') as string) || `session_${Date.now()}`;

    if (!audioFile) {
      return NextResponse.json({ error: 'No audio' }, { status: 400 });
    }

    console.log('📁 Audio:', audioFile.size, 'bytes | Session:', sessionId);
    console.log('👤 User:', userId);

    // Load from database
    const conversationHistory = await getSessionMemory(sessionId, userId);

    // Transcribe
    const buffer = await audioFile.arrayBuffer();
    const blob = new Blob([buffer], { type: 'audio/webm' });
    const file = new File([blob], 'audio.webm', { type: 'audio/webm' });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
    });

    console.log('✅ Transcription:', transcription.text);

    if (!transcription.text || transcription.text.trim() === '') {
      return NextResponse.json({
        transcription: '[No speech detected]',
        response: {
          intent: 'clarify',
          message: "I didn't catch that.",
          emotion: 'thinking',
        },
        audioUrl: '',
        sessionId,
        tokensUsed: 0,
        processingTime: Date.now() - startTime,
        usedTools: [],
      });
    }

    // Build context
    const contextPrompt = buildContextPrompt(conversationHistory);

    // Generate AI response
    const usedTools: string[] = [];
    
    const messages: any[] = [
      {
        role: 'system',
        content: `You are Nova, an advanced AI voice assistant with perfect memory stored in a database.

CURRENT DATE & TIME:
${new Date().toLocaleString('en-US', { 
  weekday: 'long', 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
})}
${contextPrompt}
YOUR CAPABILITIES:
1. Web Search - Search internet for current information
2. Calculator - Perform mathematical calculations  
3. Weather - Get real-time weather worldwide

MEMORY SYSTEM:
- Your conversation history is SAVED TO DATABASE
- You have PERFECT recall of previous messages
- Use context to understand follow-up questions
- NEVER ask for clarification when context is obvious

CRITICAL RULES:
- If user asks "What about Paris?" after "Weather in London?", you KNOW they want Paris weather
- Use the SAME TOOL for similar follow-up questions
- Be PROACTIVE and SMART

Respond in JSON: {"intent":"respond","message":"your response","emotion":"calm"}`,
      },
      {
        role: 'user',
        content: transcription.text,
      },
    ];

    let totalTokens = 0;
    let finalResponse: any = null;

    // First AI call
    const firstCompletion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      tools,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 500,
    });

    totalTokens += firstCompletion.usage?.total_tokens || 0;
    const firstMessage = firstCompletion.choices[0].message;

    // Handle tool calls
    if (firstMessage.tool_calls && firstMessage.tool_calls.length > 0) {
      console.log('🛠️ Tools:', firstMessage.tool_calls.map(t => t.function.name).join(', '));

      messages.push(firstMessage);

      for (const toolCall of firstMessage.tool_calls) {
        const functionName = toolCall.function.name;
        const functionArgs = JSON.parse(toolCall.function.arguments || '{}');
        
        usedTools.push(functionName);
        
        const functionResult = await executeFunctionCall(functionName, functionArgs);

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: functionResult,
        });
      }

      const secondCompletion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages,
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 300,
      });

      totalTokens += secondCompletion.usage?.total_tokens || 0;
      const rawResponse = secondCompletion.choices[0].message.content || '{}';

      try {
        finalResponse = JSON.parse(rawResponse);
      } catch (e) {
        finalResponse = {
          intent: 'respond',
          message: rawResponse.substring(0, 200),
          emotion: 'calm',
        };
      }

    } else {
      if (firstMessage.content) {
        try {
          finalResponse = JSON.parse(firstMessage.content);
        } catch (e) {
          finalResponse = {
            intent: 'respond',
            message: firstMessage.content,
            emotion: 'calm',
          };
        }
      }
    }

    // Save user turn to database
    await saveSessionTurn(sessionId, userId, {
      role: 'user',
      content: transcription.text,
      timestamp: new Date().toISOString(),
    }, conversationHistory);

    // Save assistant turn to database
    await saveSessionTurn(sessionId, userId, {
      role: 'assistant',
      content: finalResponse.message,
      timestamp: new Date().toISOString(),
      tools: usedTools,
    }, [...conversationHistory, {
      role: 'user',
      content: transcription.text,
      timestamp: new Date().toISOString(),
    }]);

    // Save intent
    await saveIntentMemory(userId, 'general_query', 0.7);

    // Update user stats
    await updateUserMemory(userId);

    // Generate TTS
    let audioUrl = '';
    try {
      const mp3 = await openai.audio.speech.create({
        model: 'tts-1-hd',
        voice: 'nova',
        input: finalResponse.message,
        speed: 1.0,
      });

      const audioBuffer = Buffer.from(await mp3.arrayBuffer());
      audioUrl = `data:audio/mp3;base64,${audioBuffer.toString('base64')}`;
    } catch (ttsError: any) {
      console.error('⚠️ TTS error:', ttsError.message);
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ ===== Completed in ${processingTime}ms =====\n`);

    return NextResponse.json({
      transcription: transcription.text,
      response: {
        intent: finalResponse.intent || 'respond',
        message: finalResponse.message || 'I understand.',
        emotion: finalResponse.emotion || 'calm',
        usedTools,
      },
      audioUrl,
      sessionId,
      tokensUsed: totalTokens,
      processingTime,
      contextUsed: conversationHistory.length > 0,
    });

  } catch (error: any) {
    console.error('❌ ERROR:', error.message);

    return NextResponse.json(
      { 
        error: error.message || 'Unknown error',
        code: 'SERVER_ERROR',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Check database status
  const { count } = await supabase
    .from('session_memory')
    .select('*', { count: 'exact', head: true });

  return NextResponse.json({ 
    status: 'ok',
    features: [
      'voice_transcription',
      'database_memory',
      'conversation_persistence',
      'web_search',
      'calculations',
      'weather',
      'text_to_speech',
    ],
    memory_system: 'supabase_database',
    active_sessions: count || 0,
    timestamp: new Date().toISOString(),
  });
}