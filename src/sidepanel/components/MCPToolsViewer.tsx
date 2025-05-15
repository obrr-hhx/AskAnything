import React, { useState, useEffect } from 'react';
import './MCPToolsViewer.css';

// MCP服务器类型定义
interface MCPServer {
  name?: string;
  serverUrl: string;
}

// MCP工具类型定义
interface MCPTool {
  type?: string;
  function?: {
    name: string;
    description: string;
    parameters?: {
      type: string;
      properties: Record<string, any>;
      required: string[];
      additionalProperties?: boolean;
    };
  };
  // 兼容旧版本格式
  name?: string;
  description?: string;
  parameters?: {
    type: string;
    properties: Record<string, any>;
    required: string[];
    additionalProperties?: boolean;
  };
  inputSchema?: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
}

interface MCPToolsViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

const MCPToolsViewer: React.FC<MCPToolsViewerProps> = ({ isOpen, onClose }) => {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<MCPServer | null>(null);
  const [tools, setTools] = useState<MCPTool[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 加载MCP服务器配置
  useEffect(() => {
    if (isOpen) {
      loadMCPServers();
    }
  }, [isOpen]);

  const loadMCPServers = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // 从Chrome存储中获取MCP服务器配置
      const data = await chrome.storage.local.get(['mcpServerConfigs']);
      const serverConfigs = data.mcpServerConfigs || [];
      
      console.log('[MCPToolsViewer] 加载了MCP服务器配置:', serverConfigs.length);
      setServers(serverConfigs);
      
      // 如果没有服务器配置
      if (serverConfigs.length === 0) {
        setError('未找到MCP服务器配置，请先在选项页面配置MCP服务器');
      }
    } catch (error) {
      console.error('[MCPToolsViewer] 加载MCP服务器配置失败:', error);
      setError(`加载服务器配置失败: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 测试服务器连接并获取工具列表
  const testServerConnection = async (server: MCPServer) => {
    setIsLoading(true);
    setError(null);
    setSelectedServer(server);
    setTools([]);
    
    try {
      // 发送消息到Service Worker测试连接
      const response = await chrome.runtime.sendMessage({
        type: 'TEST_MCP_SERVER',
        serverConfig: server
      });
      
      console.log('[MCPToolsViewer] 测试服务器响应:', response);
      
      if (response.success && response.tools) {
        setTools(response.tools);
      } else {
        setError(response.error || '无法连接到服务器');
      }
    } catch (error) {
      console.error('[MCPToolsViewer] 测试服务器连接失败:', error);
      setError(`连接失败: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  // 如果对话框未打开，不渲染任何内容
  if (!isOpen) return null;

  return (
    <div className="mcp-tools-viewer-overlay">
      <div className="mcp-tools-viewer">
        <div className="mcp-tools-header">
          <h2>可用的MCP服务器和工具</h2>
          <button className="mcp-close-button" onClick={onClose}>
            ×
          </button>
        </div>
        
        <div className="mcp-tools-content">
          {isLoading && <div className="mcp-loading">正在加载...</div>}
          
          {error && <div className="mcp-error">{error}</div>}
          
          {!isLoading && servers.length > 0 && (
            <div className="mcp-servers-list">
              <h3>MCP服务器</h3>
              <ul>
                {servers.map((server, index) => (
                  <li 
                    key={index} 
                    className={selectedServer === server ? 'selected' : ''}
                    onClick={() => testServerConnection(server)}
                  >
                    <div className="server-name">
                      {server.name || '未命名服务器'}
                    </div>
                    <div className="server-url">
                      {server.serverUrl}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {selectedServer && tools.length > 0 && (
            <div className="mcp-tools-list">
              <h3>
                可用工具 
                <span className="tools-count">({tools.length})</span>
              </h3>
              <ul>
                {tools.map((tool, index) => {
                  // 获取tool的属性，兼容新旧格式
                  const name = tool.function?.name || tool.name || '';
                  const description = tool.function?.description || tool.description || '';
                  const parameters = tool.function?.parameters || tool.parameters || tool.inputSchema;
                  
                  return (
                    <li key={index}>
                      <div className="tool-name">{name}</div>
                      <div className="tool-description">{description}</div>
                      {parameters && (
                        <div className="tool-parameters">
                          <div className="parameters-title">参数:</div>
                          <ul className="parameters-list">
                            {Object.entries(parameters?.properties || {}).map(([paramName, paramInfo]: [string, any]) => (
                              <li key={paramName} className="parameter-item">
                                <span className="parameter-name">{paramName}</span>
                                <span className="parameter-type">({paramInfo.type})</span>
                                {(parameters?.required || []).includes(paramName) && 
                                  <span className="parameter-required">*必填</span>
                                }
                                {paramInfo.description && 
                                  <div className="parameter-description">{paramInfo.description}</div>
                                }
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          
          {selectedServer && !isLoading && tools.length === 0 && !error && (
            <div className="no-tools-message">
              此服务器未提供任何工具
            </div>
          )}
        </div>
        
        <div className="mcp-tools-footer">
          <button onClick={onClose}>关闭</button>
          <a 
            href="#" 
            onClick={(e) => {
              e.preventDefault();
              try {
                chrome.runtime.openOptionsPage();
              } catch (err) {
                chrome.tabs.create({ url: 'options.html' });
              }
            }}
          >
            管理MCP服务器
          </a>
        </div>
      </div>
    </div>
  );
};

export default MCPToolsViewer; 