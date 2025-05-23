import { create } from 'zustand';
import { AIModel, ChatMessage, ChatHistory, ContextData } from '../shared/models';
import { getSettings, setPreferredModel } from '../shared/settings';
import { getChatHistory, addChatSession, searchChatHistory, clearChatHistory, cleanExistingHistory } from '../shared/history';
import { MCPService } from '../services/mcp';

// 定义状态类型
interface ChatState {
  // 聊天相关
  messages: ChatMessage[];
  isLoading: boolean;
  currentStreamId: string | null;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (message: ChatMessage) => void;
  updateLastMessage: (content: string) => void;
  clearMessages: () => void;
  setIsLoading: (loading: boolean) => void;
  setCurrentStreamId: (id: string | null) => void;
  
  // 模型相关
  currentModel: AIModel;
  setModel: (model: AIModel) => void;
  
  // 上下文相关
  currentContext: ContextData | null;
  setContext: (context: ContextData) => void;
  
  // 思考模式和MCP相关
  enableThinking: boolean;
  useMCPMode: boolean;
  toggleThinking: () => void;
  toggleMCPMode: () => void;
  
  // 历史记录相关
  history: ChatHistory[];
  isLoadingHistory: boolean;
  searchQuery: string;
  currentSessionId: string | null; // 当前会话ID
  loadHistory: () => Promise<void>;
  saveSessionToHistory: () => Promise<void>;
  searchHistory: (query: string) => Promise<void>;
  loadSessionFromHistory: (sessionIndex: number) => void;
  clearHistory: () => Promise<void>;
  startNewSession: () => void; // 开始新会话
}

// 创建存储
export const useChatStore = create<ChatState>((set, get) => ({
  // 初始状态
  messages: [],
  isLoading: false,
  currentStreamId: null,
  currentModel: 'chatgpt',
  currentContext: null,
  enableThinking: false,
  useMCPMode: false,
  history: [],
  isLoadingHistory: false,
  searchQuery: '',
  currentSessionId: null,
  
  // Actions
  setMessages: (messages) => {
    console.log('[Store] 设置消息:', messages);
    set({ messages });
  },
  
  addMessage: (message) => {
    console.log('[Store] 添加消息:', message);
    set(state => ({ messages: [...state.messages, message] }));
  },
  
  updateLastMessage: (content) => {
    set(state => {
      if (state.messages.length === 0) return state;
      const lastMessage = state.messages[state.messages.length - 1];
      if (lastMessage.role === 'assistant') {
        return {
          messages: [
            ...state.messages.slice(0, -1),
            { ...lastMessage, content: lastMessage.content + content }
          ]
        };
      }
      return state;
    });
  },
  
  clearMessages: () => {
    console.log('[Store] 清空消息');
    set({ messages: [], currentContext: null, currentSessionId: null });
  },
  
  setIsLoading: (loading) => {
    console.log('[Store] 设置加载状态:', loading);
    set({ isLoading: loading });
    if (!loading) {
      set({ currentStreamId: null });
    }
  },
  
  setCurrentStreamId: (id) => {
    set({ currentStreamId: id });
  },
  
  setModel: (model) => {
    console.log('[Store] 切换模型:', model);
    set({ currentModel: model });
    setPreferredModel(model).catch(error => {
      console.error('[Store] 设置模型时出错:', error);
    });
  },
  
  setContext: (context) => set({
    currentContext: context
  }),
  
  // 思考模式和MCP模式切换
  toggleThinking: () => {
    set(state => {
      console.log('[Store] 切换思考模式:', !state.enableThinking);
      return { enableThinking: !state.enableThinking };
    });
  },
  
  toggleMCPMode: () => {
    set(state => {
      console.log('[Store] 切换MCP模式:', !state.useMCPMode);
      return { useMCPMode: !state.useMCPMode };
    });
  },
  
  // 历史记录功能
  loadHistory: async () => {
    console.log('[Store] 开始加载历史记录 (using shared func)');
    set({ isLoadingHistory: true });
    try {
      const history = await getChatHistory();
      console.log('[Store] 历史记录数据:', history.length, 'items');
      set({ history, isLoadingHistory: false });
    } catch (error) {
      console.error('[Store] 加载历史记录失败:', error);
      set({ isLoadingHistory: false });
    }
  },
  
  saveSessionToHistory: async () => {
    const { messages, currentModel, currentSessionId } = get();
    if (messages.length === 0 || messages.filter(m => m.role === 'assistant').length === 0) {
      console.log('[Store] No messages or no assistant messages to save to history.');
      return;
    }

    console.log('[Store] 保存当前会话到历史', { currentSessionId, messagesCount: messages.length });
    try {
      // 如果当前没有会话ID，创建一个新的
      let sessionId = currentSessionId;
      if (!sessionId) {
        sessionId = Date.now().toString();
        set({ currentSessionId: sessionId });
        console.log('[Store] 创建新的会话ID:', sessionId);
      }
      
      await addChatSession(messages, currentModel, sessionId);
      console.log('[Store] 历史记录保存成功');
    } catch (error) {
      console.error('[Store] 保存历史记录失败:', error);
    }
  },
  
  searchHistory: async (query) => {
    console.log('[Store] 搜索历史记录 (using shared func)', query);
    set({ isLoadingHistory: true, searchQuery: query });
    try {
      const results = await searchChatHistory(query);
      set({ history: results, isLoadingHistory: false });
    } catch (error) {
      console.error('搜索历史记录失败:', error);
      set({ isLoadingHistory: false });
    }
  },
  
  loadSessionFromHistory: (sessionIndex) => {
    const { history } = get();
    if (sessionIndex >= 0 && sessionIndex < history.length) {
      const session = history[sessionIndex];
      console.log('[Store] 从历史加载会话:', sessionIndex, '会话ID:', session.sessionId);
      set({
        messages: [...session.messages],
        currentModel: session.model,
        currentContext: session.messages[0]?.context || null,
        currentSessionId: session.sessionId || null
      });
    }
  },
  
  clearHistory: async () => {
    console.log('[Store] 清除历史记录 (using shared func)');
    try {
      await clearChatHistory();
      set({ history: [] });
    } catch (error) {
      console.error('清除历史记录失败:', error);
    }
  },
  
  startNewSession: () => {
    set({ currentSessionId: Date.now().toString() });
  }
}));

// 确保监听器只添加一次
let messageListenerAdded = false;

// 添加一个当前响应流的ID以便跟踪和中止
let currentResponseStreamId: string | null = null;

// 存储等待用户回答的AI问题
interface PendingAIQuestion {
  question: string;
  toolCallId: string;
  functionName: string;
  originalResponseStreamId: string;
  isAnswered: boolean;
}

// 当前等待用户回答的AI问题
let currentPendingAIQuestion: PendingAIQuestion | null = null;

let pendingQuestions: Map<string, PendingAIQuestion> = new Map();

export async function getPendingQuestionsFromStorage(): Promise<Map<string, PendingAIQuestion>> {
  return new Promise((resolve) => {
    chrome.storage.local.get('pendingQuestions', (result) => {
      let storedQuestions = new Map<string, PendingAIQuestion>();
      if (result.pendingQuestions) {
        // 从对象转换回Map
        storedQuestions = new Map(Object.entries(result.pendingQuestions));
      }
      console.log('[Store] 已从存储获取pendingQuestions:', storedQuestions);
      pendingQuestions = storedQuestions; // 同时更新本地变量
      resolve(storedQuestions);
    });
  });
}
// Helper function to set pending questions to session storage
export function setPendingQuestionsToStorage(toolCallId:string, pendingQuestion:PendingAIQuestion): void {
  try {
    pendingQuestions.set(toolCallId, pendingQuestion);
    chrome.storage.local.set({ pendingQuestions: Object.fromEntries(pendingQuestions) });
    console.log('[Store] 已设置pendingAIQusetions', pendingQuestions);
  } catch (error) {
    console.error('[Store] Error setting pending questions to storage:', error);
  }
}

function setupMessageListener() {
  if (messageListenerAdded) {
    console.log('[Store] 消息监听器已经存在，跳过设置');
    return;
  }
  
  console.log('[Store] 设置Service Worker消息监听器');
  
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('[Store] 收到消息:', message.type, 'source:', sender);
    
    // 先获取当前状态
    const state = useChatStore.getState();
    
    // 处理AI提问给用户的消息
    if (message.type === 'AI_QUESTION_TO_USER') {
      console.log('[Store] 收到AI提问:', message);
      
      const { question, toolCallId, originalResponseStreamId, functionName } = message;
      
      // 获取当前等待中的问题
      const currentPendingQuestions =  getPendingQuestionsFromStorage();
      console.log('[ServiceWorker] 当前pendingQuestions (from storage):', JSON.stringify(currentPendingQuestions));      
      // 添加新问题
      currentPendingAIQuestion = {
        question,
        toolCallId,
        functionName: functionName || 'ask_question',
        originalResponseStreamId,
        isAnswered: false
      };
      // 保存到存储
      setPendingQuestionsToStorage(toolCallId, currentPendingAIQuestion);

      // 向用户显示AI的问题
      state.addMessage({
        id: `ai-question-${Date.now()}`,
        role: 'assistant',
        content: `💡 **AI提问**: ${message.question}\n\n👇 请在下方输入框中回答这个问题...`,
        timestamp: Date.now(),
        isAIQuestion: true,
        toolCallId: message.toolCallId,
        originalResponseStreamId: message.originalResponseStreamId
      });

      

      // 关键修改：禁用加载状态，让用户可以在输入框中回答问题
      state.setIsLoading(false);
      console.log('[Store] AI提问模式：已禁用加载状态，启用输入框允许用户回答');
      
      // 将页面滚动到底部以显示问题
      setTimeout(() => {
        const messagesContainer = document.querySelector('.messages-container');
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // 尝试让输入框获得焦点，提示用户可以输入
        const inputTextarea = document.querySelector('textarea');
        if (inputTextarea) {
          inputTextarea.focus();
        }
      }, 100);
      
      sendResponse?.({ success: true });
      return true;
    }
    
    // 处理来自服务工作线程的消息
    if (message.type === 'STREAM_START') {
      console.log('[Store] 流式开始, ID:', message.id);
      state.setIsLoading(true);
      state.setCurrentStreamId(message.id);
      currentResponseStreamId = message.id;
      
      // 添加一个空的助手消息来接收流式内容
      state.addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      });
      
      sendResponse?.({ success: true });
      return true;
    }
    
    if (message.type === 'ANSWER_TOKEN') {
      console.log('[Store] 接收答案令牌');
      
      // 确保我们正在加载且有当前流ID
      if (!state.isLoading || state.currentStreamId !== message.responseStreamId) {
        console.warn('[Store] 未处于加载状态或流ID不匹配, 忽略令牌');
        return true;
      }
      
      // 检查是否是AI提问
      const token = message.token || '';
      if (token.startsWith('【AI提问】')) {
        const question = token.replace('【AI提问】', '').trim();  
        console.log('[Store] 检测到AI提问，问题为:', question);
      }
      
      // 将令牌添加到最后一条AI消息
      state.updateLastMessage(message.token);
      
      sendResponse?.({ success: true });
      return true;
    }
    
    if (message.type === 'STREAM_END') {
      console.log('[Store] 流结束');
      
      // 重置流状态
      state.setIsLoading(false);
      state.setCurrentStreamId(null);
      currentResponseStreamId = null;
      
      // 如果有完整内容，替换最后一条消息（可选择保留历史追加内容）
      if (message.text) {
        // 这里暂时没使用，因为我们采用增量添加的方式
      }
      
      // 保存会话到历史记录
      if (!message.forceStopped) {
        state.saveSessionToHistory();
      }
      
      sendResponse?.({ success: true });
      return true;
    }
    
    if (message.type === 'STREAM_ERROR') {
      console.log('[Store] 流错误:', message.error);
      
      // 重置流状态
      state.setIsLoading(false);
      state.setCurrentStreamId(null);
      currentResponseStreamId = null;
      
      // 添加错误消息
      state.addMessage({
        id: Date.now().toString(),
        role: 'assistant',
        content: `请求处理出错: ${message.error || '未知错误'}`,
        timestamp: Date.now()
      });
      
      sendResponse?.({ success: true });
      return true;
    }
    
    if (message.type === 'CLOSE_SIDEPANEL_COMMAND') {
      console.log('[Store] 收到关闭侧边栏消息');
      
      // 如果当前有生成中的响应，先停止生成
      if (state.isLoading && currentResponseStreamId) {
        console.log('[Store] 停止正在进行的生成');
        stopGeneration();
      }
      
      // 关闭MCP客户端连接
      console.log('[Store] 关闭所有MCP客户端连接');
      MCPService.closeAllMCPClients().catch(error => {
        console.error('[Store] 关闭MCP客户端时出错:', error);
      });
      
      // 延迟一点执行关闭，确保前面的操作有时间完成
      setTimeout(() => {
        console.log('[Store] 执行侧边栏关闭');
        window.close();
      }, 100);
      
      sendResponse?.({ success: true, closing: true });
      return true;
    }
    
    if (message.type === 'UPDATE_REASONING') {
      // 处理思考过程更新的消息
      const containerId = message.containerId;
      const content = message.content;
      console.log('[Store] 更新思考内容:', containerId, '内容长度:', content.length);
      
      // 查找元素并更新
      const reasoningContentElement = document.getElementById(`${containerId}-content`);
      if (reasoningContentElement) {
        console.log('[Store] 找到推理内容元素，更新内容');
        
        if (message.type === 'FINAL_REASONING_UPDATE') {
          // 最终更新，直接替换全部内容
          reasoningContentElement.innerHTML = '';
          reasoningContentElement.appendChild(document.createTextNode(content));
        } else {
          // 增量更新，添加到已有内容
          reasoningContentElement.appendChild(document.createTextNode(content));
        }
      } else {
        console.warn('[Store] 未找到推理内容容器元素:', containerId);
      }
      
      sendResponse?.({ success: true });
      return true;
    }
    
    if (message.type === 'CREATE_THINKING_CONTAINER') {
      // 处理创建思考容器的消息
      const containerId = message.containerId;
      const label = message.label || '思考过程';
      console.log('[Store] 创建思考容器:', containerId, '标签:', label);
      
      // 不再将HTML添加到消息内容中，而是通过DOM直接操作
      // 查找消息列表容器
      const messagesContainer = document.querySelector('.messages-container');
      if (messagesContainer) {
        const lastMessageElement = messagesContainer.lastElementChild;
        if (lastMessageElement && lastMessageElement.classList.contains('message')) {
          // 检查是否已存在思考容器
          let existingContainer = lastMessageElement.querySelector(`#container-${containerId}`);
          if (!existingContainer) {
            // 创建思考容器DOM元素
            const containerDiv = document.createElement('div');
            containerDiv.className = 'thinking-container';
            containerDiv.id = `container-${containerId}`;
            containerDiv.innerHTML = `
              <details class="thinking-details" id="${containerId}">
                <summary>${label}</summary>
                <div class="thinking-content" id="${containerId}-content"></div>
              </details>
            `;
            
            // 将容器插入到消息内容的开头
            const messageContent = lastMessageElement.querySelector('.message-content');
            if (messageContent) {
              messageContent.insertBefore(containerDiv, messageContent.firstChild);
            }
          }
          console.log('[Store] 思考容器已创建并添加到DOM');
        } else {
          console.warn('[Store] 未找到合适的消息元素来添加思考容器');
        }
      } else {
        console.warn('[Store] 未找到消息列表容器');
      }
      
      sendResponse?.({ success: true });
      return true;
    }
    
    if (message.type === 'CONTEXT_SELECTION') {
      if (message.text) {
        console.log('[Store] 设置选定文本上下文:', message.text);
        state.setContext({ text: message.text });
      }
      sendResponse?.({ success: true });
      return true;
    }
    
    return false;
  });
  
  messageListenerAdded = true;
  console.log('[Store] 消息监听器已添加');
}

// 确保在store初始化时设置监听器
if (typeof window !== 'undefined') {
  setupMessageListener();
}

// 初始化存储并从后台获取选定文本、设置等
export async function initializeStore() {
  console.log('[Store] 开始初始化...');
  
  try {
    // 获取保存的设置
    const settings = await getSettings();
    console.log('[Store] 获取到设置:', settings);
    useChatStore.setState({ currentModel: settings.preferredModel });
    
    // 清理已存在的历史记录中的HTML内容
    await cleanExistingHistory();
    
    // 加载历史记录
    await useChatStore.getState().loadHistory();
    console.log('[Store] 历史记录加载完成');
    
    // 添加消息监听器
    setupMessageListener();
    
    console.log('[Store] 初始化完成');
  } catch (error) {
    console.error('[Store] 初始化过程中出错:', error);
  }
}

export async function sendQuestion(question: string) {
  const state = useChatStore.getState();
  const model = state.currentModel;
  const messages = state.messages;
  
  if (state.isLoading || !messages.length) return;
  
  const userMessage = messages[messages.length - 1];
  if (userMessage.role !== 'user') return;
  
  // 如果当前没有会话ID，说明这是一个新对话的开始，创建新的会话ID
  if (!state.currentSessionId) {
    const newSessionId = Date.now().toString();
    useChatStore.setState({ currentSessionId: newSessionId });
    console.log('[Store] 创建新对话会话ID:', newSessionId);
  }
  
  // 设置加载状态
  state.setIsLoading(true);
  
  // 获取当前状态
  const enableThinking = state.enableThinking;
  const useMCPMode = state.useMCPMode;
  
  // 如果使用通义千问3模型，需要添加思考模式和MCP模式参数
  let contextData: ContextData = {};
  if (model === 'qwen3') {
    contextData.enableThinking = enableThinking;
    contextData.useMCP = useMCPMode;
  }
  
  // 添加上下文信息
  if (state.currentContext) {
    contextData = {
      ...contextData,
      ...state.currentContext
    };
  }
  
  console.log('使用模型:', model, 
              '思考模式:', contextData.enableThinking, 
              'MCP模式:', contextData.useMCP);
  
  // 记录请求详情
  console.log(`[Store] 发送请求到Service Worker, 模型: ${model}, 内容: `, question);
  
  try {
    // 发送请求到Service Worker
    console.log('[Store] 准备发送ASK_QUESTION消息，参数:', {
      model: model,
      question: question,
      messagesCount: messages.slice(0, -1).length,
      context: contextData
    });
    
    chrome.runtime.sendMessage({
      type: 'ASK_QUESTION',
      model: model,
      question: question,
      messages: messages.slice(0, -1),
      context: contextData
    }, (response) => {
      // 检查是否有错误
      if (chrome.runtime.lastError) {
        console.error('[Store] Service Worker响应错误:', chrome.runtime.lastError);
        state.setIsLoading(false);
        
        // 添加错误消息
        state.addMessage({
          id: Date.now().toString(),
          role: 'assistant',
          content: `请求处理出错: ${chrome.runtime.lastError.message || '未知错误'}`,
          timestamp: Date.now()
        });
        return;
      }
      
      console.log('[Store] 收到Service Worker响应:', response);
      
      if (!response || !response.success) {
        console.error('[Store] Service Worker请求失败:', response?.error || '未知错误');
        state.setIsLoading(false);
        
        // 添加错误消息
        state.addMessage({
          id: Date.now().toString(),
          role: 'assistant',
          content: `请求失败: ${response?.error || '未知错误'}`,
          timestamp: Date.now()
        });
      }
      
      // 成功的响应会通过我们的消息监听器处理，不需要在这里处理
      console.log('[Store] 请求已发送到Service Worker，等待流式响应');
    });
  } catch (error) {
    console.error('[Store] 发送请求时发生异常:', error);
    state.setIsLoading(false);
    
    // 添加错误消息
    state.addMessage({
      id: Date.now().toString(),
      role: 'assistant',
      content: `发送请求时出错: ${error instanceof Error ? error.message : '未知错误'}`,
      timestamp: Date.now()
    });
  }
}

export function stopGeneration() {
  if (currentResponseStreamId) {
    console.log('[Store] 停止生成，响应ID:', currentResponseStreamId);
    chrome.runtime.sendMessage({
      type: 'STOP_GENERATION',
      responseStreamId: currentResponseStreamId
    }, (response) => {
      console.log('[Store] 停止生成响应:', response);
      
      if (chrome.runtime.lastError) {
        console.error('[Store] 停止生成出错:', chrome.runtime.lastError);
      }
      
      // 无论成功与否，都重置状态
      const state = useChatStore.getState();
      state.setIsLoading(false);
      currentResponseStreamId = null;
    });
  } else {
    console.warn('[Store] 没有正在进行的生成可以停止');
    const state = useChatStore.getState();
    state.setIsLoading(false);
  }
}

// 发送用户对AI提问的回答
export async function answerAIQuestion(userResponse: string) {
  // 获取当前状态
  const state = useChatStore.getState();
  
  try {
    // 检查是否有待回答的AI问题
    if (!currentPendingAIQuestion) {
      console.error('[Store] 无法回答AI问题：未找到当前等待回答的AI问题');
      state.addMessage({
        id: Date.now().toString(),
        role: 'system',
        content: '无法处理您的回答，找不到相关的AI问题。',
        timestamp: Date.now()
      });
      state.setIsLoading(false);
      return;
    }
    
    console.log('[Store] 准备回答AI问题:', currentPendingAIQuestion);
    
    // 设置加载状态
    state.setIsLoading(true);
    
    // 添加用户回复消息
    state.addMessage({
      id: Date.now().toString(),
      role: 'user',
      content: userResponse,
      timestamp: Date.now(),
      isAnswer: true
    });
    
    const { toolCallId, originalResponseStreamId } = currentPendingAIQuestion;
    
    if (!toolCallId || !originalResponseStreamId) {
      console.error('[Store] 回答AI问题失败：缺少toolCallId或originalResponseStreamId', currentPendingAIQuestion);
      state.addMessage({
        id: Date.now().toString(),
        role: 'system',
        content: '无法处理您的回答，工具调用信息不完整。',
        timestamp: Date.now()
      });
      state.setIsLoading(false);
      return;
    }

    
    console.log(`[Store] 发送用户回答到Service Worker, toolCallId=${toolCallId}, originalStreamId=${originalResponseStreamId}`);
    
    // 发送用户回答到服务工作线程
    const response = await chrome.runtime.sendMessage({
      type: 'ANSWER_AI_QUESTION',
      user_response: userResponse,
      toolCallId: toolCallId,
      originalResponseStreamId: originalResponseStreamId
    });
    
    console.log('[Store] 发送用户回答响应:', response);
    
    // 注意：不设置isLoading为false，让AI继续生成回复
    // 流式响应结束时会自动设置isLoading为false
  } catch (error) {
    console.error('[Store] 发送用户回答时出错:', error);
    state.setIsLoading(false);
  }
} 