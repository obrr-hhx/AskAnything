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
 * 清理消息内容，移除HTML标签和思考容器内容
 */
const cleanMessageContent = (content: string): string => {
  if (!content) return '';
  
  // 移除思考容器HTML
  let cleaned = content.replace(/<div class="thinking-container"[^>]*>[\s\S]*?<\/div>/g, '');
  
  // 移除所有HTML标签
  cleaned = cleaned.replace(/<[^>]*>/g, '');
  
  // 移除多余的空白字符
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  return cleaned;
};

/**
 * 添加新的聊天会话或更新现有会话
 */
export const addChatSession = async (
  messages: ChatMessage[], 
  model: AIModel,
  sessionId?: string
): Promise<void> => {
  if (messages.length === 0) return;

  // 获取现有历史
  const history = await getChatHistory();
  
  // 清理消息内容，移除HTML标签
  const cleanedMessages = messages.map(msg => {
    const originalContent = msg.content;
    const cleanedContent = cleanMessageContent(originalContent);
    
    // 如果内容被清理了，记录日志
    if (originalContent !== cleanedContent) {
      console.log('[History] 清理了消息内容:', {
        role: msg.role,
        originalLength: originalContent.length,
        cleanedLength: cleanedContent.length,
        removed: originalContent.length - cleanedContent.length
      });
    }
    
    return {
      ...msg,
      content: cleanedContent
    };
  });
  
  // 创建新会话对象
  const newSession: ChatHistory = {
    messages: cleanedMessages,
    model,
    lastUpdated: Date.now(),
    sessionId: sessionId // 添加会话ID
  };
  
  if (sessionId) {
    // 如果提供了会话ID，查找并更新现有会话
    const existingIndex = history.findIndex(session => session.sessionId === sessionId);
    if (existingIndex !== -1) {
      // 更新现有会话
      history[existingIndex] = newSession;
      console.log('[History] 更新了现有会话:', sessionId);
    } else {
      // 会话ID不存在，添加为新会话
      history.unshift(newSession);
      console.log('[History] 创建了新会话:', sessionId);
    }
  } else {
    // 没有会话ID，作为新会话添加到开头
    history.unshift(newSession);
    console.log('[History] 添加了新会话（无ID）');
  }
  
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

/**
 * 清理已存在的历史记录中的HTML内容
 */
export const cleanExistingHistory = async (): Promise<void> => {
  console.log('[History] 开始清理已存在的历史记录...');
  
  const history = await getChatHistory();
  let cleanedCount = 0;
  let totalMessagesCleaned = 0;
  
  const cleanedHistory = history.map(session => {
    let sessionCleaned = false;
    const cleanedMessages = session.messages.map(msg => {
      const originalContent = msg.content;
      const cleanedContent = cleanMessageContent(originalContent);
      
      if (originalContent !== cleanedContent) {
        sessionCleaned = true;
        totalMessagesCleaned++;
        console.log('[History] 清理了历史消息:', {
          sessionTimestamp: new Date(session.lastUpdated).toLocaleString(),
          role: msg.role,
          originalLength: originalContent.length,
          cleanedLength: cleanedContent.length,
          removed: originalContent.length - cleanedContent.length
        });
      }
      
      return {
        ...msg,
        content: cleanedContent
      };
    });
    
    if (sessionCleaned) {
      cleanedCount++;
    }
    
    return {
      ...session,
      messages: cleanedMessages
    };
  });
  
  if (cleanedCount > 0) {
    await saveChatHistory(cleanedHistory);
    console.log(`[History] 清理完成: ${cleanedCount} 个会话，${totalMessagesCleaned} 条消息被清理`);
  } else {
    console.log('[History] 没有需要清理的历史记录');
  }
}; 