import { ProviderFactory } from './factories/provider-factory';
import { MCPService } from './services/mcp';
import { StreamService } from './services/stream';
import { getPendingQuestionsFromStorage, setPendingQuestionsToStorage } from './sidepanel/store';

// 立即执行的初始化代码，但不使用 chrome.action.onClicked - 使用侧边栏
console.log('[ServiceWorker] 开始初始化...');

// 跟踪已发送恢复消息的标签页，避免重复发送
let notifiedTabs = new Set<number>();

// 跟踪每个标签页的侧边栏状态
let sidepanelStates = new Map<number, boolean>(); // tabId -> isOpen

// 强制同步浮标状态
function enforceFabState(tabId: number, sidepanelOpen: boolean) {
  const messageType = sidepanelOpen ? 'SIDEPANEL_OPENED' : 'SIDEPANEL_CLOSED';
  console.log(`[ServiceWorker] 强制同步标签页 ${tabId} 浮标状态: ${sidepanelOpen ? '隐藏' : '显示'}`);
  
  chrome.tabs.sendMessage(tabId, { type: messageType })
    .then(() => {
      sidepanelStates.set(tabId, sidepanelOpen);
      console.log(`[ServiceWorker] 标签页 ${tabId} 状态已同步: sidepanel=${sidepanelOpen}`);
    })
    .catch(error => {
      console.log(`[ServiceWorker] 标签页 ${tabId} 状态同步失败:`, error.message || error);
    });
}

// 监听标签页更新，确保浮标正确显示
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 只在页面完全加载且URL有效时处理
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://')) {
    console.log('[ServiceWorker] 标签页加载完成:', tabId, tab.url);
    
    // 清除该标签页的通知记录，允许重新发送
    notifiedTabs.delete(tabId);
    
    // 延迟检查状态，确保content-script已加载
    setTimeout(() => {
      if (!notifiedTabs.has(tabId)) {
        // 检查该标签页是否有侧边栏打开
        const sidepanelOpen = sidepanelStates.get(tabId) || false;
        console.log(`[ServiceWorker] 标签页 ${tabId} 当前侧边栏状态: ${sidepanelOpen}`);
        
        // 根据侧边栏状态决定浮标显示
        enforceFabState(tabId, sidepanelOpen);
        notifiedTabs.add(tabId);
      }
    }, 1000);
  }
});

// 监听标签页关闭，清理状态
chrome.tabs.onRemoved.addListener((tabId) => {
  console.log(`[ServiceWorker] 标签页 ${tabId} 已关闭，清理状态`);
  sidepanelStates.delete(tabId);
  notifiedTabs.delete(tabId);
});

// 当扩展首次安装或更新时触发
chrome.runtime.onInstalled.addListener(() => {
  console.log('[ServiceWorker] 扩展已安装或更新');
  
  // 注册上下文菜单
  try {
    chrome.contextMenus.create({
      id: 'askAI',
      title: 'AskAnything: %s',
      contexts: ['selection']
    });
    console.log('[ServiceWorker] 上下文菜单已注册');
  } catch (error) {
    console.error('[ServiceWorker] 注册上下文菜单失败:', error);
  }

  // 初始化存储（默认设置）
  chrome.storage.sync.get('preferredModel', (result) => {
    console.log('[ServiceWorker] 获取首选模型:', result);
    if (!result.preferredModel) {
      chrome.storage.sync.set({ preferredModel: 'chatgpt' }, () => {
        console.log('[ServiceWorker] 已设置默认模型为 chatgpt');
        if (chrome.runtime.lastError) {
          console.error('[ServiceWorker] 设置默认模型出错:', chrome.runtime.lastError);
        }
      });
    }
  });
});

// 监听上下文菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  console.log('[ServiceWorker] 上下文菜单被点击:', info);
  if (info.menuItemId === 'askAI' && tab?.id) {
    try {
      // 打开侧边栏并传递所选文本
      chrome.sidePanel.open({ tabId: tab.id });
      console.log('[ServiceWorker] 已打开侧边栏');
      
      // 延迟发送消息确保侧边栏已加载
      setTimeout(() => {
        try {
          chrome.runtime.sendMessage({
            type: 'CONTEXT_SELECTION',
            text: info.selectionText
          }, (response) => {
            console.log('[ServiceWorker] 选择文本消息响应:', response);
            if (chrome.runtime.lastError) {
              console.error('[ServiceWorker] 发送选择文本出错:', chrome.runtime.lastError);
            }
          });
        } catch (error) {
          console.error('[ServiceWorker] 发送选择文本消息失败:', error);
        }
      }, 500);
    } catch (error) {
      console.error('[ServiceWorker] 打开侧边栏失败:', error);
    }
  }
});

// 监听来自侧边栏的请求
chrome.runtime.onMessage.addListener((message: any, sender, sendResponse) => {
  console.log('[ServiceWorker] 收到新消息:', message.type, '来源:', sender?.id || '未知');
  console.log('[ServiceWorker] 收到消息:', message, '发送者:', sender);
  const messageType = message.type;
  
  (async () => { // Wrap in async IIFE to use await for storage operations
    if (messageType === 'OPEN_SIDEPANEL') {
      console.log('[ServiceWorker] 收到打开侧边栏请求');
      
      if (sender.tab?.id) {
        try {
          chrome.sidePanel.open({ tabId: sender.tab.id }).then(() => {
            console.log('[ServiceWorker] 侧边栏已成功打开');
            // 更新状态跟踪并强制隐藏浮标
            if (sender.tab?.id) {
              enforceFabState(sender.tab.id, true);
            }
            sendResponse({ success: true });
          }).catch((error: any) => {
            console.error('[ServiceWorker] 打开侧边栏失败:', error);
            sendResponse({ success: false, error: error.toString() });
          });
        } catch (error: any) {
          console.error('[ServiceWorker] 处理打开侧边栏请求时发生异常:', error);
          sendResponse({ success: false, error: error.toString() });
        }
        return true; // 保持sendResponse的有效性
      } else {
        console.error('[ServiceWorker] 无法获取打开侧边栏的标签页ID');
        sendResponse({ success: false, error: '无法获取标签页ID' });
      }
    }
    
    if (messageType === 'CLOSE_SIDEPANEL_REQUEST') {
      console.log('[ServiceWorker] 收到关闭侧边栏请求');
      
      // 关闭所有MCP客户端连接
      try {
        console.log('[ServiceWorker] 正在关闭所有MCP客户端连接');
        await MCPService.closeAllMCPClients();
      } catch (error) {
        console.error('[ServiceWorker] 关闭MCP客户端连接时发生错误:', error);
      }
      
      // 转发这个消息给所有侧边栏页面，让侧边栏自己关闭
      chrome.runtime.sendMessage({
        type: 'CLOSE_SIDEPANEL_COMMAND',
        tabId: message.tabId || null // 传递tabId以便侧边栏知道这是哪个标签页的关闭请求
      }).then(response => {
        console.log('[ServiceWorker] 侧边栏关闭请求已发送:', response);
        
        // 获取当前标签页ID并更新状态
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            enforceFabState(tabs[0].id, false);
          }
        });
        
        sendResponse({ success: true, closed: true });
      }).catch(error => {
        console.log('[ServiceWorker] 没有侧边栏接收关闭消息:', error);
        
        // 即使没有侧边栏响应，也要确保浮标显示
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]?.id) {
            enforceFabState(tabs[0].id, false);
          }
        });
        
        sendResponse({ success: false, notOpen: true, error: String(error) });
      });
      
      return true; // 保持sendResponse的有效性
    }
    
    if (messageType === 'SET_MODEL') {
      // 存储首选模型
      console.log('[ServiceWorker] 设置首选模型:', message.model);
      // 为DeepSeek-R1模型添加特殊日志
      if (message.model === 'deepseek-r1') {
        console.log('[ServiceWorker] 选择了DeepSeek-R1推理模型 (deepseek-reasoner)');
      }
      chrome.storage.sync.set({ preferredModel: message.model }, () => {
        if (chrome.runtime.lastError) {
          console.error('[ServiceWorker] 保存模型设置出错:', chrome.runtime.lastError);
          sendResponse({ success: false, error: chrome.runtime.lastError });
        } else {
          console.log('[ServiceWorker] 模型设置已保存');
          sendResponse({ success: true });
        }
      });
      return true;
    }
    
    if (messageType === 'GET_PAGE_INFO') {
      // 获取当前标签的信息
      if (message.tabId) {
        console.log('[ServiceWorker] 获取页面信息, tabId:', message.tabId);
        try {
          chrome.tabs.sendMessage(message.tabId, { type: 'GET_PAGE_INFO' }, (response) => {
            console.log('[ServiceWorker] 页面信息响应:', response);
            sendResponse(response);
          });
        } catch (error) {
          console.error('[ServiceWorker] 获取页面信息失败:', error);
          sendResponse({ error: '获取页面信息失败' });
        }
        return true;
      }
    }
    
    if (messageType === 'ASK_QUESTION') {
      // 获取当前选择的模型
      const model = message.model || 'chatgpt';
      const question = message.question || '';
      
      console.log('[ServiceWorker] 处理提问请求, 模型:', model, '问题内容:', question.substring(0, 50) + '...');
      console.log('[ServiceWorker] 消息参数:', {
        type: message.type,
        model: message.model,
        questionExists: !!message.question,
        questionLength: message.question ? message.question.length : 0,
        messagesCount: message.messages ? message.messages.length : 0,
        contextExists: !!message.context
      });
      
      // 检查关键参数
      if (!question) {
        console.error('[ServiceWorker] 缺少问题内容!');
        sendResponse({ success: false, error: '缺少问题内容' });
        return true;
      }
      
      // 立即返回一个响应，表示已收到请求
      sendResponse({ success: true, received: true });
      
      // 获取当前标签页ID作为sessionId，以保持多轮对话历史
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const sessionId = tabs[0]?.id ? `tab-${tabs[0].id}` : `session-${Date.now()}`;
        console.log(`[ServiceWorker] 使用sessionId: ${sessionId} 进行多轮对话`);
        
        // 使用StreamService处理流式响应
        StreamService.handleStreamingResponse(model, question, message.context, sessionId)
          .then(responseStreamId => {
            console.log('[ServiceWorker] 流处理已启动，streamId:', responseStreamId);
          })
          .catch(error => {
            console.error('[ServiceWorker] 启动流处理出错:', error);
          });
      });
      
      // 必须返回true以保持sendResponse有效
      return true;
    }
    
    if (messageType === 'STOP_GENERATION') {
      console.log('[ServiceWorker] 收到停止生成请求, streamId:', message.responseStreamId);
      
      // 使用StreamService停止生成
      const stopped = StreamService.stopGeneration(message.responseStreamId);
      if (!stopped) {
        console.log('[ServiceWorker] 未找到对应的流:', message.responseStreamId);
        
        // 尝试额外获取并销毁Provider实例
        const provider = ProviderFactory.getProviderInstance(message.responseStreamId);
        if (provider) {
          console.log('[ServiceWorker] 找到Provider实例，正在销毁:', message.responseStreamId);
          provider.destroy();
        }
      }
      
      sendResponse({ success: true });
      return true;
    }
    
    if (messageType === 'CLEAR_CONVERSATION') {
      console.log('[ServiceWorker] 收到清空对话请求');
      
      // 获取当前标签页ID作为sessionId
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const sessionId = tabs[0]?.id ? `tab-${tabs[0].id}` : null;
        if (sessionId) {
          const cleared = StreamService.clearProviderSession(sessionId);
          console.log(`[ServiceWorker] 清理会话 ${sessionId}:`, cleared ? '成功' : '未找到');
          sendResponse({ success: true, cleared });
        } else {
          console.warn('[ServiceWorker] 无法获取当前标签页ID');
          sendResponse({ success: false, error: '无法获取当前标签页ID' });
        }
      });
      
      return true;
    }
    
    if (messageType === 'TEST_MCP_SERVER') {
      console.log('[ServiceWorker] 收到测试MCP服务器请求:', message.serverConfig);
      MCPService.testMCPServer(message.serverConfig)
        .then(result => {
          console.log('[ServiceWorker] MCP服务器测试结果:', result);
          sendResponse(result);
        })
        .catch(error => {
          console.error('[ServiceWorker] 测试MCP服务器出错:', error);
          sendResponse({ 
            success: false, 
            error: error instanceof Error ? error.message : String(error) 
          });
        });
      return true; // 保持sendResponse有效
    }

    if (messageType === 'ANSWER_AI_QUESTION') {
      const userResponseText = message.user_response || '';
      const toolCallId = message.toolCallId;
      const originalResponseStreamId = message.originalResponseStreamId;

      console.log(`[ServiceWorker] 收到用户对AI提问的回答: toolCallId='${toolCallId}', originalStreamId='${originalResponseStreamId}', response='${userResponseText}'`);
      
      if (!toolCallId || !originalResponseStreamId) {
        console.error('[ServiceWorker] ANSWER_AI_QUESTION missing toolCallId or originalResponseStreamId');
        sendResponse({ success: false, error: 'Missing toolCallId or originalResponseStreamId' });
        return; // Exit early if parameters are missing
      }

      const allPendingQuestions = await getPendingQuestionsFromStorage();
      console.log('[ServiceWorker] 当前所有pendingQuestions:', JSON.stringify(allPendingQuestions));
      const pendingQuestion = allPendingQuestions.get(toolCallId);
      
      if (pendingQuestion && pendingQuestion.originalResponseStreamId === originalResponseStreamId) {
        console.log('[ServiceWorker] 找到匹配的AI提问:', pendingQuestion);
        pendingQuestion.isAnswered = true;
        const providerInstance = ProviderFactory.getProviderInstance(originalResponseStreamId);
        if (providerInstance) {
          try {
            if (typeof (providerInstance as any).submitToolResult === 'function') {
              console.log(`[ServiceWorker] 提交用户回答到Provider实例: toolCallId=${toolCallId}, originalStreamId=${originalResponseStreamId}`);
              (providerInstance as any).submitToolResult(toolCallId, userResponseText)
                .then(() => {
                  console.log(`[ServiceWorker] 成功提交工具结果: toolCallId=${toolCallId}`);
                  // 在成功提交工具结果后再删除pendingQuestion
                  if(pendingQuestion.isAnswered){
                    allPendingQuestions.delete(toolCallId);
                    setPendingQuestionsToStorage(toolCallId, pendingQuestion);
                  }
                })
                .catch((error: any) => {
                  console.error(`[ServiceWorker] 提交工具结果失败:`, error);
                  chrome.runtime.sendMessage({
                    type: 'STREAM_ERROR',
                    error: `提交回答失败: ${error.message || '未知错误'}`,
                    responseStreamId: originalResponseStreamId
                  });
                });
              sendResponse({ success: true, processed: true });
            } else {
              console.warn(`[ServiceWorker] Provider不支持submitToolResult方法: ${providerInstance.constructor.name}`);
              sendResponse({ 
                success: false, 
                error: `当前AI模型不支持工具回调功能。请尝试使用其他模型。`
              });
            }
          } catch (error: any) {
            console.error(`[ServiceWorker] 处理用户回答时出错:`, error);
            sendResponse({ success: false, error: `处理回答时出错: ${error.message || '未知错误'}` });
          }
        } else {
          console.error(`[ServiceWorker] 未找到对应的Provider实例: ${originalResponseStreamId}`);
          sendResponse({ 
            success: false, 
            error: `未找到对应的AI会话，可能会话已过期或已结束。请开始新对话。`
          });
        }
      } else {
        console.warn(`[ServiceWorker] 未找到匹配的AI提问, toolCallId: ${toolCallId}, originalResponseStreamId: ${originalResponseStreamId}. Current pending questions:`, JSON.stringify(allPendingQuestions));
        sendResponse({ success: false, processed: false, error: 'No matching pending AI question found.' });
      }
      return true;
    }

    // 处理笔记相关消息
    if (messageType === 'ASK_AI_ABOUT_NOTE') {
      console.log('[ServiceWorker] 收到笔记AI查询请求:', message.query);
      
      try {
        // 获取当前选择的模型
        const { preferredModel } = await chrome.storage.sync.get('preferredModel');
        const model = preferredModel || 'chatgpt';
        
        // 创建查询提示
        const prompt = `以下是一篇Markdown笔记内容:
\`\`\`markdown
${message.noteContent}
\`\`\`

用户的问题是: ${message.query}

请针对这篇笔记内容回答用户的问题。`;
        
        // 使用StreamService来处理请求
        const responseStreamId = await StreamService.handleStreamingResponse(model, prompt);
        
        // 立即返回一个响应，表示已收到请求
        sendResponse({ success: true, received: true, responseStreamId });
        
        // 设置监听器以捕获完整响应
        const responseListener = (msg: any) => {
          if (msg.type === 'STREAM_END' && msg.responseStreamId === responseStreamId) {
            // 移除监听器
            chrome.runtime.onMessage.removeListener(responseListener);
            
            // 发送完整响应给笔记页面
            chrome.runtime.sendMessage({
              type: 'NOTE_AI_RESPONSE',
              answer: msg.text,
              originalQuery: message.query,
              responseStreamId
            });
          }
        };
        
        // 添加监听器
        chrome.runtime.onMessage.addListener(responseListener);
      } catch (error) {
        console.error('[ServiceWorker] 处理笔记AI查询失败:', error);
        sendResponse({ success: false, error: String(error) });
      }
      
      return true; // 保持sendResponse的有效性
    }

    if (messageType === 'SIDEPANEL_STATE_UPDATE') {
      console.log(`[ServiceWorker] 收到侧边栏状态更新: 标签页${message.tabId}, 状态=${message.isOpen ? '开启' : '关闭'}`);
      if (message.tabId) {
        sidepanelStates.set(message.tabId, message.isOpen);
        console.log(`[ServiceWorker] 已更新标签页 ${message.tabId} 侧边栏状态: ${message.isOpen}`);
      }
      sendResponse({ success: true });
      return true;
    }

    if (messageType === 'GET_SIDEPANEL_STATE') {
      console.log(`[ServiceWorker] 收到侧边栏状态查询请求`);
      
      // 获取当前活动标签页ID
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id) {
          const tabId = tabs[0].id;
          const isOpen = sidepanelStates.get(tabId) || false;
          console.log(`[ServiceWorker] 标签页 ${tabId} 侧边栏状态: ${isOpen}`);
          sendResponse({ success: true, isOpen, tabId });
        } else {
          console.log('[ServiceWorker] 无法获取当前标签页ID');
          sendResponse({ success: false, error: '无法获取当前标签页ID' });
        }
      });
      
      return true; // 保持sendResponse有效
    }

    // 如果没有匹配的消息类型，默认响应
    sendResponse({ success: false, error: '未知的消息类型' });
  })().catch(error => {
    console.error('[ServiceWorker] 处理消息时发生错误:', error);
    sendResponse({ success: false, error: String(error) });
  });
  
  return true; // 保持sendResponse的有效性，所有消息都是异步处理的
});

// 添加快捷键支持
chrome.commands.onCommand.addListener((command) => {
  console.log('[ServiceWorker] 检测到命令:', command);
  if (command === '_execute_action') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        try {
          chrome.sidePanel.open({ tabId: tabs[0].id });
          console.log('[ServiceWorker] 通过快捷键打开侧边栏');
        } catch (error) {
          console.error('[ServiceWorker] 通过快捷键打开侧边栏失败:', error);
        }
      }
    });
  }
});

// 定期清理过期流
setInterval(() => {
  StreamService.cleanupExpiredStreams();
  StreamService.cleanupProviderPool(); // 同时清理Provider实例池
}, 10 * 60 * 1000); // 每10分钟清理一次