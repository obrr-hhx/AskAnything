import React, { useState, useEffect } from 'react';
import { useChatStore } from '../store';
import './ModelSelector.css';

export const ModelSelector: React.FC = () => {
  const { 
    currentModel, 
    setModel, 
    useMCPMode, 
    toggleMCPMode 
  } = useChatStore();
  const [hasMCPConfig, setHasMCPConfig] = useState(false);
  
  useEffect(() => {
    // 加载用户首选的模型
    chrome.storage.sync.get('preferredModel', (result) => {
      if (result.preferredModel) {
        setModel(result.preferredModel);
      }
    });
    
    // 检查是否存在MCP配置
    chrome.storage.local.get('mcpServerConfig', (result) => {
      setHasMCPConfig(!!result.mcpServerConfig);
    });
  }, [setModel]);
  
  const handleModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newModel = event.target.value as any;
    setModel(newModel);
    
    // 将模型选择保存到扩展存储
    chrome.storage.sync.set({ preferredModel: newModel });
    
    // 通知background脚本
    chrome.runtime.sendMessage({ type: 'SET_MODEL', model: newModel });
  };
  
  const isQwen3Selected = currentModel === 'qwen3';
  
  return (
    <div className="model-selector">
      <select 
        value={currentModel} 
        onChange={handleModelChange}
        className="model-select"
      >
        <option value="chatgpt">ChatGPT</option>
        <option value="claude">Claude</option>
        <option value="deepseek">DeepSeek</option>
        <option value="deepseek-r1">DeepSeek-R1</option>
        <option value="qwen3">通义千问3</option>
      </select>
      
      {isQwen3Selected && hasMCPConfig && (
        <div className="model-options">
          <label className="mcp-toggle">
            <input 
              type="checkbox" 
              checked={useMCPMode}
              onChange={toggleMCPMode}
              title="使用MCP工具"
            />
            <span>启用MCP工具</span>
          </label>
        </div>
      )}
    </div>
  );
};
