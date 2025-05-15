import { ProviderFactory } from './factories/provider-factory';
import { MCPService } from './services/mcp';
import { StreamService } from './services/stream';
import { getPendingQuestionsFromStorage, setPendingQuestionsToStorage } from './sidepanel/store';

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
      
      // 转发这个消息给所有侧边栏页面，让侧边栏自己关闭
      chrome.runtime.sendMessage({
        type: 'CLOSE_SIDEPANEL_COMMAND',
        tabId: message.tabId || null // 传递tabId以便侧边栏知道这是哪个标签页的关闭请求
      }).then(response => {
        console.log('[ServiceWorker] 侧边栏关闭请求已发送:', response);
        sendResponse({ success: true, closed: true });
      }).catch(error => {
        console.log('[ServiceWorker] 没有侧边栏接收关闭消息:', error);
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
      
      // 使用StreamService处理流式响应
      StreamService.handleStreamingResponse(model, question, message.context)
        .then(responseStreamId => {
          console.log('[ServiceWorker] 流处理已启动，streamId:', responseStreamId);
        })
        .catch(error => {
          console.error('[ServiceWorker] 启动流处理出错:', error);
        });
      
      // 必须返回true以保持sendResponse有效
      return true;
    }
    
    if (messageType === 'STOP_GENERATION') {
      console.log('[ServiceWorker] 收到停止生成请求, streamId:', message.streamId);
      
      // 使用StreamService停止生成
      const stopped = StreamService.stopGeneration(message.streamId);
      if (!stopped) {
        console.log('[ServiceWorker] 未找到对应的流:', message.streamId);
      }
      
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
  })(); // End of async IIFE
  
  // Return true for message types that will respond asynchronously if they are outside the IIFE
  // For message types handled within the IIFE, sendResponse is called, so returning true is not strictly needed
  // for them to keep the message channel open, but it doesn't hurt.
  // However, to be safe and cover all paths, especially if some handlers are not in the IIFE:
  if (messageType === 'ANSWER_AI_QUESTION' 
      || messageType === 'OPEN_SIDEPANEL' 
      || messageType === 'CLOSE_SIDEPANEL' 
      || messageType === 'SET_MODEL' 
      || messageType === 'GET_PAGE_INFO' 
      || messageType === 'ASK_QUESTION' 
      || messageType === 'TEST_MCP_SERVER') {
      return true; // Keep channel open for async response
  }
  // For other synchronous message types, you might not need to return true.
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
}, 10 * 60 * 1000); // 每10分钟清理一次