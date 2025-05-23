import { AIModel } from '../models/config';

// 消息类型
export type MessageType = 
  | 'ASK_QUESTION'
  | 'ANSWER_TOKEN'
  | 'STREAM_START'
  | 'STREAM_END'
  | 'STREAM_ERROR'
  | 'GET_SELECTION'
  | 'GET_PAGE_INFO'
  | 'OPEN_SIDEPANEL'
  | 'CLOSE_SIDEPANEL'
  | 'STOP_GENERATION'
  | 'CONTEXT_SELECTION'
  | 'SET_MODEL'
  | 'CREATE_THINKING_CONTAINER'
  | 'UPDATE_REASONING'
  | 'FINAL_REASONING_UPDATE'
  | 'TEST_MCP_SERVER'
  | 'AI_QUESTION_TO_USER'
  | 'ANSWER_AI_QUESTION';

// 上下文数据
export interface ContextData {
  text?: string;
  url?: string;
  title?: string;
  textSegments?: string[];
  enableThinking?: boolean;
  useMCP?: boolean;
}

// 消息结构
export interface Message {
  type: MessageType;
  [key: string]: any;
}

// 聊天消息
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  context?: ContextData;
  
  // AI提问相关字段
  isAIQuestion?: boolean;
  toolCallId?: string;
  originalResponseStreamId?: string;
  
  // 用户回答相关字段
  isAnswer?: boolean;
}

// 聊天历史
export interface ChatHistory {
  messages: ChatMessage[];
  model: AIModel;
  lastUpdated: number;
  sessionId?: string; // 会话ID，用于识别和更新同一对话会话
}

// 用户设置
export interface UserSettings {
  preferredModel: AIModel;
}

// 从models/config导出AIModel类型以避免循环引用
export type { AIModel }; 