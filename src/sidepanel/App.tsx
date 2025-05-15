import React, { useState, useEffect } from 'react';
import './App.css';

// 导入组件
import { ModelSelector } from './components/ModelSelector';
import ChatInterface from './components/ChatInterface';
import { initializeStore } from './store';

const App: React.FC = () => {
  const [isReady, setIsReady] = useState(false);

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
        </div>
      </header>
      <main className="app-main">
        {isReady ? (
          <ChatInterface />
        ) : (
          <div className="loading">加载中...</div>
        )}
      </main>
    </div>
  );
};

export default App;