import { ChatMessage, ChatHistory, AIModel } from './models';

// 本地存储键
const HISTORY_STORAGE_KEY = 'chatHistory';
const MAX_HISTORY_ITEMS = 50;

/**
 * 获取聊天历史记录
 */
export const getChatHistory = (): Promise<ChatHistory[]> => {
  return new Promise((resolve) => {
    chrome.storage.local.get(HISTORY_STORAGE_KEY, (result) => {
      const history = result[HISTORY_STORAGE_KEY] || [];
      resolve(history as ChatHistory[]);
    });
  });
};

/**
 * 保存聊天历史记录
 */
export const saveChatHistory = (history: ChatHistory[]): Promise<void> => {
  // 确保历史记录不超过最大数量
  const limitedHistory = history.slice(0, MAX_HISTORY_ITEMS);
  
  return new Promise((resolve) => {
    chrome.storage.local.set({ [HISTORY_STORAGE_KEY]: limitedHistory }, () => {
      resolve();
    });
  });
};

/**
 * 添加新的聊天会话
 */
export const addChatSession = async (
  messages: ChatMessage[], 
  model: AIModel
): Promise<void> => {
  if (messages.length === 0) return;

  // 获取现有历史
  const history = await getChatHistory();
  
  // 创建新会话
  const newSession: ChatHistory = {
    messages,
    model,
    lastUpdated: Date.now()
  };
  
  // 添加到开头
  history.unshift(newSession);
  
  // 保存回存储
  await saveChatHistory(history);
};

/**
 * 搜索聊天历史
 */
export const searchChatHistory = async (query: string): Promise<ChatHistory[]> => {
  if (!query.trim()) {
    return getChatHistory();
  }
  
  const history = await getChatHistory();
  const lowerQuery = query.toLowerCase();
  
  // 搜索消息内容和上下文
  return history.filter(session => 
    session.messages.some(msg => 
      msg.content.toLowerCase().includes(lowerQuery) ||
      msg.context?.text?.toLowerCase().includes(lowerQuery) ||
      msg.context?.title?.toLowerCase().includes(lowerQuery) ||
      msg.context?.url?.toLowerCase().includes(lowerQuery)
    )
  );
};

/**
 * 删除所有历史记录
 */
export const clearChatHistory = (): Promise<void> => {
  return new Promise((resolve) => {
    chrome.storage.local.remove(HISTORY_STORAGE_KEY, () => {
      resolve();
    });
  });
}; 