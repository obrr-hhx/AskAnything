import React, { useEffect, useState } from 'react';
import { useChatStore } from '../store';
import { ChatHistory } from '../../shared/models';
import './HistoryList.css';

const HistoryList: React.FC = () => {
  const {
    history,
    isLoadingHistory,
    searchQuery,
    loadHistory,
    searchHistory,
    loadSessionFromHistory,
    clearHistory
  } = useChatStore();
  
  const [showHistory, setShowHistory] = useState(false);
  const [localSearchQuery, setLocalSearchQuery] = useState('');
  
  useEffect(() => {
    if (showHistory && history.length === 0) {
      loadHistory();
    }
  }, [showHistory, history.length, loadHistory]);
  
  // 处理搜索
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    searchHistory(localSearchQuery);
  };
  
  // 格式化日期
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };
  
  // 获取会话预览文本（尝试获取第一条AI回复）
  const getSessionPreview = (session: ChatHistory) => {
    const assistantMessage = session.messages.find(msg => msg.role === 'assistant');
    const userMessage = session.messages.find(msg => msg.role === 'user');
    
    // 函数：移除HTML标签和思考容器内容
    const cleanContent = (content: string): string => {
      if (!content) return '';
      
      // 移除思考容器HTML
      let cleaned = content.replace(/<div class="thinking-container"[^>]*>[\s\S]*?<\/div>/g, '');
      
      // 移除所有HTML标签
      cleaned = cleaned.replace(/<[^>]*>/g, '');
      
      // 移除多余的空白字符
      cleaned = cleaned.replace(/\s+/g, ' ').trim();
      
      return cleaned;
    };
    
    if (assistantMessage) {
      const cleanedContent = cleanContent(assistantMessage.content);
      if (cleanedContent) {
        return cleanedContent.substring(0, 30) + (cleanedContent.length > 30 ? '...' : '');
      }
    }
    
    if (userMessage) {
      const cleanedContent = cleanContent(userMessage.content);
      if (cleanedContent) {
        return cleanedContent.substring(0, 30) + (cleanedContent.length > 30 ? '...' : '');
      }
    }
    
    return '空会话';
  };

  return (
    <div className="history-container">
      <div className="history-header">
        <button 
          className="toggle-history-btn"
          onClick={() => setShowHistory(!showHistory)}
        >
          {showHistory ? '隐藏历史' : '显示历史'}
        </button>
      </div>
      
      {showHistory && (
        <>
          <form className="history-search" onSubmit={handleSearch}>
            <input
              type="text"
              value={localSearchQuery}
              onChange={e => setLocalSearchQuery(e.target.value)}
              placeholder="搜索历史..."
            />
            <button type="submit">搜索</button>
          </form>
          
          <div className="history-list">
            {isLoadingHistory ? (
              <div className="history-loading">加载中...</div>
            ) : history.length === 0 ? (
              <div className="history-empty">
                {searchQuery ? '没有找到匹配的历史记录' : '暂无历史记录'}
              </div>
            ) : (
              <>
                {history.map((session, index) => (
                  <div 
                    key={session.lastUpdated}
                    className="history-item"
                    onClick={() => loadSessionFromHistory(index)}
                  >
                    <div className="history-item-preview">
                      {getSessionPreview(session)}
                    </div>
                    <div className="history-item-info">
                      <span className="history-item-model">{session.model}</span>
                      <span className="history-item-date">
                        {formatDate(session.lastUpdated)}
                      </span>
                    </div>
                  </div>
                ))}
                
                <button 
                  className="clear-history-btn"
                  onClick={() => {
                    if (window.confirm('确定要清除所有历史记录吗？此操作不可撤销。')) {
                      clearHistory();
                    }
                  }}
                >
                  清除所有历史
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default HistoryList; 