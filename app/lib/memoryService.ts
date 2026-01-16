import { createClient } from '@supabase/supabase-js';



const supabase = createClient(
  'https://uyzlaiqfmufmcpdupoou.supabase.co',
  'sb_publishable_fvtnsRZqURB9L13Hz884YA_D5de6xur'
);



export interface ConversationTurn {
  role: 'user' | 'assistant';
  content: string;
  intent?: string;
  timestamp: string;
  tools_used?: string[];
}

export interface SessionMemory {
  session_id: string;
  turns: ConversationTurn[];
  current_intent: string | null;
  intent_confidence: number;
  unresolved_references: string[];
}

export interface IntentMemory {
  current_goal: string;
  goal_status: 'active' | 'completed' | 'abandoned';
  goal_confidence: number;
  key_entities: string[];
  preferred_output_style: 'concise' | 'detailed' | 'simple' | 'technical';
  interaction_mode: 'voice' | 'text';
}

export interface UserMemory {
  preferences: {
    response_length: 'short' | 'moderate' | 'long';
    formality: 'casual' | 'professional';
    detail_level: 'basic' | 'balanced' | 'comprehensive';
    uses_voice: boolean;
    auto_play_audio: boolean;
  };
  patterns: {
    common_topics: string[];
    typical_session_length: number;
    preferred_tools: string[];
    common_follow_up_types: string[];
  };
  total_sessions: number;
  total_turns: number;
}

export interface ContextPack {
  session: SessionMemory | null;
  intent: IntentMemory | null;
  user: UserMemory | null;
}



export class SessionMemoryService {
  
  static async getSession(userId: string, sessionId: string): Promise<SessionMemory | null> {
    try {
      const { data, error } = await supabase
        .from('session_memory')
        .select('*')
        .eq('user_id', userId)
        .eq('session_id', sessionId)
        .gt('expires_at', new Date().toISOString())
        .order('last_activity', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ Session fetch error:', error);
        return null;
      }

      return data ? {
        session_id: data.session_id,
        turns: data.turns || [],
        current_intent: data.current_intent,
        intent_confidence: data.intent_confidence || 0.5,
        unresolved_references: data.unresolved_references || [],
      } : null;
    } catch (error) {
      console.error('❌ Session service error:', error);
      return null;
    }
  }

  
  static async addTurn(
    userId: string,
    sessionId: string,
    turn: ConversationTurn,
    intent?: string,
    confidence?: number
  ): Promise<void> {
    try {
      const session = await this.getSession(userId, sessionId);
      
      const turns = session?.turns || [];
      turns.push(turn);
      
      
      const recentTurns = turns.slice(-5);

      const sessionData = {
        user_id: userId,
        session_id: sessionId,
        turns: recentTurns,
        current_intent: intent || session?.current_intent || null,
        intent_confidence: confidence || session?.intent_confidence || 0.5,
        last_activity: new Date().toISOString(),
        expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours
      };

      const { error } = await supabase
        .from('session_memory')
        .upsert(sessionData, {
          onConflict: 'user_id,session_id',
        });

      if (error) {
        console.error('❌ Session update error:', error);
      }
    } catch (error) {
      console.error('❌ Add turn error:', error);
    }
  }

  
  static async updateReferences(
    userId: string,
    sessionId: string,
    references: string[]
  ): Promise<void> {
    try {
      const { error } = await supabase
        .from('session_memory')
        .update({
          unresolved_references: references,
          last_activity: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('session_id', sessionId);

      if (error) {
        console.error('❌ Reference update error:', error);
      }
    } catch (error) {
      console.error('❌ Update references error:', error);
    }
  }

  
  static async cleanupExpired(): Promise<void> {
    try {
      const { error } = await supabase
        .from('session_memory')
        .delete()
        .lt('expires_at', new Date().toISOString());

      if (error) {
        console.error('❌ Cleanup error:', error);
      } else {
       
      }
    } catch (error) {
      console.error('❌ Cleanup service error:', error);
    }
  }
}



export class IntentMemoryService {
  
  static async getCurrentIntent(userId: string): Promise<IntentMemory | null> {
    try {
      const { data, error } = await supabase
        .from('intent_memory')
        .select('*')
        .eq('user_id', userId)
        .eq('goal_status', 'active')
        .order('last_updated', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ Intent fetch error:', error);
        return null;
      }

      return data ? {
        current_goal: data.current_goal,
        goal_status: data.goal_status,
        goal_confidence: data.goal_confidence,
        key_entities: data.key_entities || [],
        preferred_output_style: data.preferred_output_style || 'balanced',
        interaction_mode: data.interaction_mode || 'voice',
      } : null;
    } catch (error) {
      console.error('❌ Intent service error:', error);
      return null;
    }
  }

  
  static async updateIntent(
    userId: string,
    goal: string,
    confidence: number,
    entities?: string[],
    outputStyle?: string
  ): Promise<void> {
    try {
      
      const current = await this.getCurrentIntent(userId);

      if (current && current.current_goal === goal) {
        
        const { error } = await supabase
          .from('intent_memory')
          .update({
            goal_confidence: confidence,
            key_entities: entities || current.key_entities,
            preferred_output_style: outputStyle || current.preferred_output_style,
            last_updated: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .eq('current_goal', goal)
          .eq('goal_status', 'active');

        if (error) {
          console.error('❌ Intent update error:', error);
        }
      } else {
        
        const { error } = await supabase
          .from('intent_memory')
          .insert({
            user_id: userId,
            current_goal: goal,
            goal_status: 'active',
            goal_confidence: confidence,
            key_entities: entities || [],
            preferred_output_style: outputStyle || 'balanced',
            interaction_mode: 'voice',
            goal_started_at: new Date().toISOString(),
            last_updated: new Date().toISOString(),
          });

        if (error) {
          console.error('❌ Intent creation error:', error);
        }
      }
    } catch (error) {
      console.error('❌ Update intent error:', error);
    }
  }

  
  static async completeIntent(userId: string, goal: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('intent_memory')
        .update({
          goal_status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('current_goal', goal)
        .eq('goal_status', 'active');

      if (error) {
        console.error('❌ Complete intent error:', error);
      }
    } catch (error) {
      console.error('❌ Complete intent service error:', error);
    }
  }
}



export class UserMemoryService {
  
  static async getUserMemory(userId: string): Promise<UserMemory | null> {
    try {
      const { data, error } = await supabase
        .from('user_memory')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('❌ User memory fetch error:', error);
        return null;
      }

      return data || null;
    } catch (error) {
      console.error('❌ User memory service error:', error);
      return null;
    }
  }

  
  static async updateUserMemory(
    userId: string,
    updates: Partial<UserMemory>
  ): Promise<void> {
    try {
      const current = await this.getUserMemory(userId);

      const memoryData = {
        user_id: userId,
        preferences: updates.preferences || current?.preferences,
        patterns: updates.patterns || current?.patterns,
        total_sessions: updates.total_sessions ?? current?.total_sessions ?? 0,
        total_turns: updates.total_turns ?? current?.total_turns ?? 0,
        last_interaction: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('user_memory')
        .upsert(memoryData, {
          onConflict: 'user_id',
        });

      if (error) {
        console.error('❌ User memory update error:', error);
      }
    } catch (error) {
      console.error('❌ Update user memory error:', error);
    }
  }

 
  static async recordToolUsage(userId: string, tools: string[]): Promise<void> {
    try {
      const memory = await this.getUserMemory(userId);
      
      if (memory) {
        const preferredTools = memory.patterns.preferred_tools || [];
        
        
        tools.forEach(tool => {
          if (!preferredTools.includes(tool)) {
            preferredTools.push(tool);
          }
        });

        await this.updateUserMemory(userId, {
          patterns: {
            ...memory.patterns,
            preferred_tools: preferredTools.slice(0, 10), // Keep top 10
          },
        });
      }
    } catch (error) {
      console.error('❌ Record tool usage error:', error);
    }
  }
}



export class ContextService {
  
  static async getContextPack(
    userId: string,
    sessionId: string
  ): Promise<ContextPack> {
    try {
      const [session, intent, user] = await Promise.all([
        SessionMemoryService.getSession(userId, sessionId),
        IntentMemoryService.getCurrentIntent(userId),
        UserMemoryService.getUserMemory(userId),
      ]);

      return {
        session,
        intent,
        user,
      };
    } catch (error) {
      console.error('❌ Context assembly error:', error);
      return {
        session: null,
        intent: null,
        user: null,
      };
    }
  }

  
  static buildContextualPrompt(context: ContextPack): string {
    const parts: string[] = [];

    
    if (context.session && context.session.turns.length > 0) {
      const recentTurns = context.session.turns
        .slice(-3)
        .map(t => `${t.role === 'user' ? 'User' : 'You'}: ${t.content}`)
        .join('\n');
      
      parts.push(`RECENT CONVERSATION:\n${recentTurns}`);
    }

   
    if (context.intent) {
      parts.push(
        `CURRENT USER GOAL: ${context.intent.current_goal}`,
        `CONFIDENCE: ${(context.intent.goal_confidence * 100).toFixed(0)}%`,
        `PREFERRED STYLE: ${context.intent.preferred_output_style}`
      );

      if (context.intent.key_entities.length > 0) {
        parts.push(`KEY ENTITIES: ${context.intent.key_entities.join(', ')}`);
      }
    }

  
    if (context.user) {
      const prefs = context.user.preferences;
      parts.push(
        `USER PREFERENCES:`,
        `- Response length: ${prefs.response_length}`,
        `- Detail level: ${prefs.detail_level}`,
        `- Formality: ${prefs.formality}`
      );
    }

  
    if (context.session && context.session.unresolved_references.length > 0) {
      parts.push(
        `UNRESOLVED REFERENCES: ${context.session.unresolved_references.join(', ')}`
      );
    }

    return parts.join('\n\n');
  }

  
  static extractIntent(userMessage: string, aiResponse: string): {
    goal: string;
    confidence: number;
    entities: string[];
  } {
    
    
    let goal = 'general_query';
    let confidence = 0.5;
    const entities: string[] = [];

    const lowerMessage = userMessage.toLowerCase();

    
    if (lowerMessage.match(/what|how|why|when|where|who/)) {
      goal = 'seeking_information';
      confidence = 0.8;
    }

    
    if (lowerMessage.match(/calculate|compute|find|search|tell me/)) {
      goal = 'perform_action';
      confidence = 0.9;
    }

    
    if (lowerMessage.match(/that|this|it|they|them|those/)) {
      goal = 'follow_up_question';
      confidence = 0.95;
    }

    
    if (lowerMessage.match(/weather|temperature|forecast/)) {
      goal = 'check_weather';
      confidence = 0.95;
    }

    
    const words = userMessage.split(' ');
    const capitalizedWords = words.filter(w => w[0] === w[0].toUpperCase() && w.length > 2);
    entities.push(...capitalizedWords);

    return { goal, confidence, entities };
  }
}

export default {
  SessionMemoryService,
  IntentMemoryService,
  UserMemoryService,
  ContextService,
};