import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useChatStore, sendQuestion, stopGeneration, answerAIQuestion } from '../store';
import { ChatMessage } from '../../shared/models';
import MarkdownRenderer from './MarkdownRenderer';
import HistoryList from './HistoryList';
import MCPToolsViewer from './MCPToolsViewer';
import './ChatInterface.css';
import { debounce } from 'lodash';

const ChatInterface: React.FC = () => {
  // 从Zustand获取状态
  const {
    messages,
    isLoading,
    currentModel,
    currentContext,
    setContext,
    enableThinking,
    clearMessages,
    saveSessionToHistory
  } = useChatStore();
  
  const [userInput, setUserInput] = useState('');
  const [hasSelectedText, setHasSelectedText] = useState(false);
  const [showContext, setShowContext] = useState(false);
  const [isContextExpanded, setIsContextExpanded] = useState(false);
  const [contextSegments, setContextSegments] = useState<string[]>([]);
  const [showMCPTools, setShowMCPTools] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 浏览器窗口中的选择变化监听 - 自动添加模式
  const handleSelectionChange = useCallback(
    debounce(() => {
      // 向活动标签页发送消息获取当前选中文本
      try {
        const timestamp = new Date().toISOString();
        console.log(`[ChatInterface][${timestamp}] 开始获取选中文本`);
        
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          console.log('[ChatInterface] 查询到活动标签页:', tabs && tabs.length > 0 ? tabs[0].url : '未找到标签');
          
          if (tabs && tabs[0] && tabs[0].id) {
            console.log('[ChatInterface] 发送GET_SELECTION消息到标签页:', tabs[0].id);
            
            chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_SELECTION' }, (response) => {
              const responseTimestamp = new Date().toISOString();
              if (chrome.runtime.lastError) {
                console.error(`[ChatInterface][${responseTimestamp}] 获取选中文本时出错:`, chrome.runtime.lastError);
                return;
              }
              
              // 忽略被content-script标记为忽略的响应（防止重复处理）
              if (response?.ignored) {
                console.log(`[ChatInterface][${responseTimestamp}] 忽略重复的选择文本请求`);
                return;
              }
              
              console.log(`[ChatInterface][${responseTimestamp}] 收到GET_SELECTION响应:`, response);
              
              if (response && response.text) {
                const newSelectedText = response.text;
                
                // 检查文本是否为空白
                if (!newSelectedText.trim()) {
                  console.log(`[ChatInterface][${responseTimestamp}] 忽略空白文本`);
                  return;
                }
                
                // 检查是否已经包含了这段文本
                if (contextSegments.includes(newSelectedText)) {
                  console.log(`[ChatInterface][${responseTimestamp}] 该文本段已存在于上下文中`);
                  return;
                }
                
                console.log(`[ChatInterface][${responseTimestamp}] 监测到新选中文本:`, 
                  newSelectedText.substring(0, 50) + (newSelectedText.length > 50 ? '...' : ''),
                  '长度:', newSelectedText.length, 
                  '当前上下文段落数:', contextSegments.length);
                
                // 先创建新段落数组副本
                const newSegments = [...contextSegments, newSelectedText];
                console.log(`[ChatInterface][${responseTimestamp}] 创建新段落数组:`, {
                  旧段落数: contextSegments.length,
                  新段落数: newSegments.length,
                  新段落MD5: hashString(newSelectedText.substring(0, 100))
                });
                
                // 直接添加文本到上下文
                setContextSegments(prevSegments => {
                  console.log(`[ChatInterface][${responseTimestamp}] setContextSegments调用:`, {
                    prevLength: prevSegments.length,
                    newLength: newSegments.length,
                    相同引用: prevSegments === contextSegments
                  });
                  return newSegments;
                });
                
                // 记录当前上下文状态
                console.log(`[ChatInterface][${responseTimestamp}] 当前上下文状态:`, {
                  有无上下文: !!currentContext,
                  当前URL: currentContext?.url || '无',
                  当前标题: currentContext?.title || '无',
                  思考模式: currentContext?.enableThinking
                });
                
                // 创建新上下文对象
                const newContext = {
                  text: newSegments.join('\n\n'),
                  url: response.url || currentContext?.url || '',
                  title: response.title || currentContext?.title || '',
                  textSegments: newSegments,
                  enableThinking: currentContext?.enableThinking
                };
                
                console.log(`[ChatInterface][${responseTimestamp}] 设置新上下文:`, {
                  textSegmentCount: newContext.textSegments.length,
                  totalTextLength: newContext.text.length,
                  lastSegmentHash: hashString(newSelectedText.substring(0, 100))
                });
                
                setContext(newContext);
                
                setHasSelectedText(true);
                setShowContext(true);
              } else {
                console.log(`[ChatInterface][${responseTimestamp}] 未获取到任何选中文本`);
              }
            });
          } else {
            console.warn('[ChatInterface] 未找到活动标签页');
          }
        });
      } catch (error) {
        console.error('[ChatInterface] 获取选中文本失败:', error);
      }
    }, 800),
    [contextSegments, currentContext, setContext]
  );
  
  // 监听选中文本变化
  useEffect(() => {
    // 添加鼠标抬起事件处理，因为这通常是选择完成的时刻
    const handleMouseUp = (e: MouseEvent) => {
      // 检查点击是否发生在上下文区域内
      const selectionContext = document.querySelector('.selection-context');
      if (selectionContext && selectionContext.contains(e.target as Node)) {
        // 如果点击发生在上下文区域内，则不处理选择变化
        return;
      }
      
      // 延迟处理以避免与点击事件冲突
      setTimeout(() => {
        handleSelectionChange();
      }, 100);
    };

    // 页面初始化时尝试获取当前选择（只执行一次）
    const initialSelectionTimeout = setTimeout(() => {
      handleSelectionChange();
    }, 800);

    // 添加事件监听器
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      clearTimeout(initialSelectionTimeout);
      handleSelectionChange.cancel?.();
    };
  }, [handleSelectionChange]);
  
  // 监听contextSegments变化时的处理
  useEffect(() => {
    const timestamp = new Date().toISOString();
    console.log(`[ChatInterface][${timestamp}] contextSegments变化`, {
      段落数量: contextSegments.length,
      段落内容哈希: contextSegments.map((seg, i) => ({
        索引: i,
        哈希: hashString(seg.substring(0, 100)),
        长度: seg.length
      }))
    });
    
    // 检测是否与currentContext保持一致
    if (currentContext?.textSegments) {
      console.log(`[ChatInterface][${timestamp}] 与currentContext比较:`, {
        contextSegments长度: contextSegments.length,
        currentContext段落数: currentContext.textSegments.length,
        长度相等: contextSegments.length === currentContext.textSegments.length,
        段落引用相同: contextSegments === currentContext.textSegments
      });
    }
  }, [contextSegments, currentContext]);

  useEffect(() => {
    const timestamp = new Date().toISOString();
    console.log(`[ChatInterface][${timestamp}] currentContext变化`, {
      hasContext: !!currentContext,
      hasTextSegments: !!currentContext?.textSegments,
      textSegmentsLength: currentContext?.textSegments?.length,
      textSegmentsHash: currentContext?.textSegments ? 
        currentContext.textSegments.map(seg => hashString(seg.substring(0, 100))) : 
        '无段落'
    });
  }, [currentContext]);

  // 清除选中文本上下文
  const clearSelectedContext = (e?: React.MouseEvent) => {
    if (e) {
      // 阻止事件冒泡，防止触发document上的mouseup事件处理器
      e.stopPropagation();
      // 阻止默认行为
      e.preventDefault();
    }
    setContext({ text: '' });
    setContextSegments([]);
    setHasSelectedText(false);
    setShowContext(false);
    setIsContextExpanded(false);
  };

  // 移除单个上下文段落
  const removeContextSegment = (index: number, e: React.MouseEvent) => {
    // 阻止事件冒泡和默认行为
    e.stopPropagation();
    e.preventDefault();
    
    const timestamp = new Date().toISOString();
    console.log(`[ChatInterface][${timestamp}] 点击删除段落`, index, '当前段落数:', contextSegments.length);
    
    // 记录当前状态用于对比
    const oldSegmentsLength = contextSegments.length;
    const segmentToRemoveHash = hashString(contextSegments[index]?.substring(0, 100) || '空段落');
    
    // 直接创建新数组而不引用旧数组
    const newSegments = contextSegments.filter((_, i) => i !== index);
    
    console.log(`[ChatInterface][${timestamp}] 创建段落数组:`, {
      删除索引: index,
      删除段落哈希: segmentToRemoveHash,
      原段落数: oldSegmentsLength,
      新段落数: newSegments.length
    });
    
    // 立即应用段落更新
    setContextSegments(prevSegments => {
      console.log(`[ChatInterface][${timestamp}] setContextSegments执行:`, {
        原段落引用相同: prevSegments === contextSegments,
        原段落数: prevSegments.length,
        新段落数: newSegments.length
      });
      return newSegments;
    });
    
    // 延迟处理后续状态更新，确保段落更新已渲染
    setTimeout(() => {
      const timeoutTimestamp = new Date().toISOString();
      // 检查是否删除了所有段落
      if (newSegments.length === 0) {
        console.log(`[ChatInterface][${timeoutTimestamp}] 删除了最后一个段落，清除所有上下文`);
        
        // 记录当前状态
        console.log(`[ChatInterface][${timeoutTimestamp}] 清除上下文:`, {
          原有上下文: !!currentContext,
          原段落数: currentContext?.textSegments?.length || 0
        });
        
        // 直接传递对象，不使用函数式更新
        setContext({ text: '' });
        setHasSelectedText(false);
        setShowContext(false);
        setIsContextExpanded(false);
      } else {
        console.log(`[ChatInterface][${timeoutTimestamp}] 更新上下文，剩余段落数:`, newSegments.length);
        
        const newContext = {
          text: newSegments.join('\n\n'),
          textSegments: newSegments,
          url: currentContext?.url || '',
          title: currentContext?.title || '',
          enableThinking: currentContext?.enableThinking
        };
        
        console.log(`[ChatInterface][${timeoutTimestamp}] 新上下文:`, {
          段落数: newContext.textSegments.length,
          文本总长度: newContext.text.length
        });
        
        // 直接传递对象
        setContext(newContext);
      }
    }, 0);
  };

  // 根据展开状态获取上下文显示文本
  const getDisplayedContextText = () => {
    // 如果没有段落，显示空内容
    if (contextSegments.length === 0) {
      return null;
    }
    
    // 合并所有段落，每段之间加分隔线
    return contextSegments.map((segment, index) => (
      <div key={`segment-${index}-${Date.now()}`} className="context-segment">
        <div className="context-segment-header">
          <span className="context-segment-number">段落 {index + 1}</span>
          <button 
            className="remove-segment-button"
            onClick={(e) => removeContextSegment(index, e)}
            onMouseDown={(e) => e.stopPropagation()} // 阻止按钮点击引起的mousedown事件
            onTouchStart={(e) => e.stopPropagation()} // 阻止触摸事件传播
            title="删除此段落"
            tabIndex={0}
            aria-label={`删除段落 ${index + 1}`}
            data-index={index}
          >
            ×
          </button>
        </div>
        <div className="context-segment-content">
          {isContextExpanded ? segment : (segment.length > 200 ? segment.substring(0, 200) + '...' : segment)}
        </div>
      </div>
    ));
  };

  // 切换上下文显示状态
  const toggleContextDisplay = (e: React.MouseEvent) => {
    // 阻止事件冒泡，防止触发document上的mouseup事件处理器
    e.stopPropagation();
    // 阻止默认行为
    e.preventDefault();
    setShowContext(!showContext);
  };

  // 切换上下文展开/折叠状态
  const toggleContextExpansion = (e: React.MouseEvent) => {
    // 阻止事件冒泡，防止触发document上的mouseup事件处理器
    e.stopPropagation();
    // 阻止默认行为
    e.preventDefault();
    setIsContextExpanded(!isContextExpanded);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 监听消息变化，重置上下文展开状态
  useEffect(() => {
    setIsContextExpanded(false);
  }, [messages]);

  // 重置textarea高度
  useEffect(() => {
    if (!userInput.trim()) {
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }, [userInput]);

  // 添加ESC键盘监听器停止生成
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isLoading) {
        handleStopGeneration();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isLoading]);

  // 复制消息内容
  const handleCopyMessage = (content: string) => {
    navigator.clipboard.writeText(content)
      .then(() => {
        console.log('复制成功');
      })
      .catch(err => {
        console.error('复制失败:', err);
      });
  };

  // 处理停止生成
  const handleStopGeneration = () => {
    stopGeneration();
  };

  // 处理发送消息
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!userInput.trim() || isLoading) return;
    
    // 获取最新消息，检查是否是AI提问
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      
      // 如果最后一条消息是AI提问，则将用户输入作为对AI提问的回答发送
      if (lastMessage.isAIQuestion) {
        console.log('[ChatInterface] 发送对AI提问的回答');
        try {
          await answerAIQuestion(userInput);
        } catch (error) {
          console.error('[ChatInterface] 提交AI问题回答失败:', error);
        }
        
        setUserInput('');
        return; // 不执行后续的发送消息逻辑
      }
    }
    
    // 添加用户消息
    useChatStore.getState().addMessage({
      id: Date.now().toString(),
      role: 'user',
      content: userInput,
      timestamp: Date.now(),
      context: currentContext || undefined
    });
    
    // 清空输入
    setUserInput('');
    
    // 延迟发送问题，确保UI更新后再处理
    setTimeout(() => {
      try {
        sendQuestion(userInput);
      } catch(error) {
        console.error('[ChatInterface] 发送问题失败:', error);
      }
    }, 10);
  };

  // 滚动到最新消息
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // 自动调整文本框高度
  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  };

  // 更新输入文本时调整高度
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUserInput(e.target.value);
    adjustTextareaHeight();
  };

  // 处理键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Shift+Enter 添加换行
    if (e.key === 'Enter' && e.shiftKey) {
      // 不阻止默认行为，允许添加换行符
      return;
    }
    
    // 仅按Enter键发送消息
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e as any);
    }
  };

  // 处理深度思考开关变更
  const handleThinkingToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    console.log('[ChatInterface] 用户设置深度思考模式:', newValue);
    
    try {
      // 直接设置Zustand状态，而不是toggle
      useChatStore.setState({ enableThinking: newValue });
      
      // 更新上下文中的思考模式设置
      if (currentContext) {
        setContext({
          ...currentContext,
          enableThinking: newValue
        });
      } else {
        setContext({
          text: '',
          enableThinking: newValue
        });
      }
      
      // 保存到Chrome存储
      chrome.storage.sync.set({ enableThinking: newValue }, () => {
        const error = chrome.runtime.lastError;
        if (error) {
          console.error('[ChatInterface] 保存思考模式设置出错:', error);
        } else {
          console.log('[ChatInterface] 思考模式设置已保存到chrome.storage');
        }
      });
    } catch (error) {
      console.error('[ChatInterface] 切换思考模式时出错:', error);
    }
  };

  // 处理MCP工具查看按钮点击
  const handleShowMCPTools = () => {
    setShowMCPTools(true);
  };

  // 关闭MCP工具查看器
  const handleCloseMCPTools = () => {
    setShowMCPTools(false);
  };

  // 开始新对话
  const handleNewConversation = async () => {
    // 在清空之前，先检查是否有需要保存的对话
    // 如果有消息且包含AI回答，则保存到历史记录
    if (messages.length > 0 && messages.some(m => m.role === 'assistant' && m.content.trim())) {
      console.log('[ChatInterface] 保存当前对话到历史记录后再开始新对话');
      try {
        await saveSessionToHistory();
        console.log('[ChatInterface] 当前对话已保存到历史记录');
      } catch (error) {
        console.warn('[ChatInterface] 保存对话到历史记录失败:', error);
      }
    }
    
    // 清空当前消息和上下文
    clearMessages();
    // 清空输入框
    setUserInput('');
    // 清空上下文
    setHasSelectedText(false);
    setShowContext(false);
    setContextSegments([]);
    setIsContextExpanded(false);
    // 聚焦到输入框
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
    
    // 发送清空会话消息给service worker，清空Provider的对话历史
    chrome.runtime.sendMessage({
      type: 'CLEAR_CONVERSATION'
    }, (response) => {
      if (response?.success) {
        console.log('[ChatInterface] Provider会话历史已清空:', response.cleared ? '成功' : '未找到会话');
      } else {
        console.warn('[ChatInterface] 清空Provider会话历史失败:', response?.error);
      }
    });
    
    console.log('[ChatInterface] 开始新对话');
  };

  return (
    <div className="chat-interface">
      <div className="messages-container">
        {messages.map((message: ChatMessage, index: number) => (
          <div key={message.id} className={`message ${message.role}`}>
            <div className="message-content">
              {message.role === 'assistant' ? (
                // 检查是否是最后一条Assistant消息且正在加载
                index === messages.length - 1 && 
                message.role === 'assistant' && 
                isLoading ? (
                  // 在加载中的最后一条消息中显示加载指示器
                  <>
                    {message.content && <MarkdownRenderer content={message.content} />}
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <div className="keyboard-hint">
                      按 <kbd>ESC</kbd> 键可以停止生成
                    </div>
                  </>
                ) : (
                  // 正常显示已完成的消息
                  <MarkdownRenderer content={message.content} />
                )
              ) : (
                message.content
              )}
            </div>
            <div className="message-actions">
              {message.role === 'assistant' && (
                <>
                  {/* 仅在非加载状态或不是最后一条消息时显示复制按钮 */}
                  {(!isLoading || index !== messages.length - 1) && (
                    <button 
                      className="copy-button"
                      onClick={() => handleCopyMessage(message.content)}
                      title="复制内容"
                    >
                      复制
                    </button>
                  )}
                  {/* 最后一条消息且加载中时显示停止按钮 */}
                  {isLoading && index === messages.length - 1 && (
                    <button 
                      className="stop-button"
                      onClick={handleStopGeneration}
                      title="停止生成"
                    >
                      停止
                    </button>
                  )}
                </>
              )}
              <div className="message-timestamp">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}
        
        {/* 如果messages为空且isLoading为true，显示初始加载状态 */}
        {messages.length === 0 && isLoading && (
          <div className="message assistant loading">
            <div className="message-content">
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <div className="keyboard-hint">
                按 <kbd>ESC</kbd> 键可以停止生成
              </div>
            </div>
            <div className="message-actions">
              <button 
                className="stop-button"
                onClick={handleStopGeneration}
                title="停止生成"
              >
                停止
              </button>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {hasSelectedText && contextSegments.length > 0 && (
        <div className="selection-context">
          <div className="context-indicator">
            <span className="context-icon">📑</span>
            <button 
              className="context-toggle-button" 
              onClick={(e) => toggleContextDisplay(e)}
            >
              已选中 {contextSegments.length} 段文本作为上下文
              <span className="context-toggle">
                {showContext ? '▼' : '▶'}
              </span>
            </button>
            <button 
              className="clear-context-button"
              onClick={(e) => clearSelectedContext(e)}
              title="清除所有上下文"
            >
              ×
            </button>
          </div>
          
          {showContext && (
            <div className="context-preview">
              {getDisplayedContextText()}
              {contextSegments.some(seg => seg.length > 200) && (
                <div className="context-expand-control">
                  <button 
                    className="context-expand-button"
                    onClick={(e) => toggleContextExpansion(e)}
                  >
                    {isContextExpanded ? '显示较少 ▲' : '显示更多 ▼'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      <form className="input-container" onSubmit={handleSendMessage}>
        <textarea
          value={userInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder={
            // 检查最后一条消息是否是AI提问
            messages.length > 0 && messages[messages.length - 1].isAIQuestion
              ? "请在此输入您的回答..." 
              : isLoading 
                ? "AI正在生成回答..." 
                : hasSelectedText 
                  ? "基于选中文本提问...(按Shift+Enter换行)" 
                  : "输入您的问题...(按Shift+Enter换行)"
          }
          // 如果最后一条消息是AI提问，即使isLoading也不禁用输入框
          disabled={isLoading && !(messages.length > 0 && messages[messages.length - 1].isAIQuestion)}
          ref={textareaRef}
          rows={1}
        />
        
        {isLoading && !(messages.length > 0 && messages[messages.length - 1].isAIQuestion) ? (
          <button 
            type="button" 
            className="stop-generate-button" 
            onClick={handleStopGeneration}
            title="停止AI生成 (按ESC)"
          >
            停止
          </button>
        ) : (
          <button 
            type="submit" 
            disabled={
              // 如果是AI提问模式，只要有输入内容就允许提交
              (messages.length > 0 && messages[messages.length - 1].isAIQuestion)
                ? !userInput.trim()
                : isLoading || !userInput.trim()
            }
          >
            发送
          </button>
        )}
        
        {/* 新对话按钮移动到这里 */}
        <button 
          type="button"
          className="new-conversation-button-small"
          onClick={handleNewConversation}
          title="创建新对话"
          disabled={isLoading}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
      </form>
      
      <div className="chat-controls">
        {/* 仅当选择qwen3模型时显示控制项 */}
        {currentModel === 'qwen3' && (
          <>
            <div className="thinking-toggle-container">
              <label className="pill-toggle">
                <input
                  type="checkbox"
                  checked={enableThinking}
                  onChange={handleThinkingToggle}
                />
                <span className="pill-toggle-slider"></span>
              </label>
              <span className="pill-toggle-label">思考模式</span>
            </div>

            <button 
              className="mcp-tools-button"
              onClick={handleShowMCPTools}
              title="查看MCP服务器和工具"
            >
              🔧
              MCP工具
            </button>
          </>
        )}
      </div>
      
      <HistoryList />
      
      {/* MCP工具查看器 */}
      <MCPToolsViewer
        isOpen={showMCPTools}
        onClose={handleCloseMCPTools}
      />
    </div>
  );
};

export default ChatInterface;

// 添加这些辅助函数
// 简单的字符串哈希函数，用于生成文本片段的标识符而不暴露完整内容
function hashString(str: string): string {
  let hash = 0;
  if (str.length === 0) return '空文本';
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(16).padStart(8, '0');  // 转换为16进制
} 