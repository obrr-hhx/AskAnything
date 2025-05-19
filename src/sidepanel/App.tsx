import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// 导入组件
import { ModelSelector } from './components/ModelSelector';
import ChatInterface from './components/ChatInterface';
import NoteBrowser from './components/NoteBrowser';
import { initializeStore } from './store';

const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);
  const [showNoteBrowser, setShowNoteBrowser] = useState(false);
  const [splitRatio, setSplitRatio] = useState(60); // 默认AI聊天占60%
  const [isChatCollapsed, setIsChatCollapsed] = useState(false); // 聊天框是否收缩
  const splitDivRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const previousSplitRatio = useRef(splitRatio); // 保存收缩前的宽度比例

  useEffect(() => {
    // 初始化存储并从后台连接获取数据
    const init = async () => {
      try {
        await initializeStore();
        
        // 获取当前页面信息
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          const tab = tabs[0];
          if (tab?.url) {
            // 将URL和标题发送到store
            chrome.runtime.sendMessage({
              type: 'GET_PAGE_INFO',
              tabId: tab.id
            });
          }
        });
        
        setIsReady(true);
      } catch (error) {
        console.error('初始化错误:', error);
        // 即使发生错误，仍然将状态设置为就绪，以便显示UI
        setIsReady(true);
      }
    };
    
    init();
  }, []);

  // 打开选项页面的函数
  const openOptionsPage = () => {
    try {
      chrome.runtime.openOptionsPage();
    } catch (error) {
      console.error('打开选项页面失败:', error);
      // 备用方法打开选项页面
      chrome.tabs.create({ url: 'options.html' });
    }
  };

  // 处理分隔条拖动
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); // 防止默认行为
    isDraggingRef.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDraggingRef.current || !splitDivRef.current) return;
    
    const container = splitDivRef.current.parentElement;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const newRatio = ((e.clientX - containerRect.left) / containerRect.width) * 100;
    
    // 设置最小宽度限制
    if (newRatio >= 5 && newRatio <= 95) {
      setSplitRatio(newRatio);
      // 如果聊天框被收缩，则取消收缩状态
      if (isChatCollapsed) {
        setIsChatCollapsed(false);
      }
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };

  // 切换聊天框收缩状态
  const toggleChatCollapse = () => {
    if (isChatCollapsed) {
      // 展开聊天框，恢复先前的宽度
      setSplitRatio(previousSplitRatio.current);
      setIsChatCollapsed(false);
    } else {
      // 收缩聊天框，保存当前宽度以便恢复
      previousSplitRatio.current = splitRatio;
      setIsChatCollapsed(true);
    }
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>AskAnything</h1>
        <div className="header-controls">
          <ModelSelector />
          <button 
            className="settings-button" 
            onClick={openOptionsPage}
            title="设置API密钥"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
          <button 
            className={`notes-button ${showNoteBrowser ? 'active' : ''}`}
            onClick={() => setShowNoteBrowser(!showNoteBrowser)}
            title={showNoteBrowser ? "关闭笔记" : "打开笔记"}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="16" y1="13" x2="8" y2="13"></line>
              <line x1="16" y1="17" x2="8" y2="17"></line>
              <polyline points="10 9 9 9 8 9"></polyline>
            </svg>
          </button>
        </div>
      </header>
      
      <div className={`app-content ${showNoteBrowser ? 'split-view' : ''} ${isChatCollapsed ? 'chat-collapsed' : ''}`}>
        {/* 收缩状态下的展开按钮 */}
        {isChatCollapsed && showNoteBrowser && (
          <button 
            className="expand-chat-button"
            onClick={toggleChatCollapse}
            title="展开聊天"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        )}
        
        {(!isChatCollapsed || !showNoteBrowser) && (
          <div 
            className="chat-panel"
            style={{ width: showNoteBrowser ? `${splitRatio}%` : '100%' }}
          >
            {/* 在聊天框中添加收缩按钮 */}
            {showNoteBrowser && !isChatCollapsed && (
              <button 
                className="collapse-chat-button"
                onClick={toggleChatCollapse}
                title="收缩聊天"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"></polyline>
                </svg>
              </button>
            )}
            <main className="app-main">
              {isReady ? (
                <ChatInterface />
              ) : (
                <div className="loading">加载中...</div>
              )}
            </main>
          </div>
        )}
        
        {showNoteBrowser && (
          <>
            {!isChatCollapsed && (
              <div 
                className="split-divider" 
                ref={splitDivRef}
                onMouseDown={handleMouseDown}
              >
                <div className="divider-handle"></div>
              </div>
            )}
            <div 
              className="notes-panel"
              style={{ width: isChatCollapsed ? '100%' : `${100 - splitRatio}%` }}
            >
              <NoteBrowser onBack={() => setShowNoteBrowser(false)} />
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default App;