import { MCPClient, MCPServer } from '../shared/mcp-client';
import { CustomToolExecutor, customTools } from '../shared/custom-tools';
import { ChatCompletionTool } from 'openai/resources/chat/completions';
/**
 * MCP服务
 * 管理MCP客户端和相关功能
 */
export class MCPService {
  /**
   * 测试MCP服务器连接
   * @param serverConfig 服务器配置
   * @returns 测试结果
   */
  public static async testMCPServer(serverConfig: MCPServer): Promise<{success: boolean, tools?: ChatCompletionTool[], error?: string}> {
    console.log('[MCPService] 开始测试MCP服务器连接:', serverConfig.name || serverConfig.serverUrl);
    
    let mcpClient: MCPClient | null = null;
    
    try {
      // 创建MCP客户端
      mcpClient = new MCPClient({
        serverConfig,
        clientInfo: {
          name: 'askanything-browser-extension',
          version: '1.0.0'
        }
      });
      
      // 连接到MCP服务器
      await mcpClient.connect(serverConfig);
      console.log('[MCPService] MCP服务器连接成功');
      
      // 获取工具列表
      const tools = await mcpClient.listTools();
      console.log('[MCPService] 获取MCP工具列表成功, 数量:', tools.length);
      
      // 关闭连接
      await mcpClient.close();
      
      return {
        success: true,
        tools
      };
    } catch (error) {
      console.error('[MCPService] MCP服务器连接测试失败:', error);
      
      // 尝试关闭可能存在的连接
      if (mcpClient) {
        try {
          await mcpClient.close();
        } catch (closeError) {
          console.warn('[MCPService] 关闭MCP客户端失败:', closeError);
        }
      }
      
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }
  
  /**
   * 获取所有MCP服务器配置
   * @returns MCP服务器配置列表
   */
  public static async getAllMCPServerConfigs(): Promise<MCPServer[]> {
    try {
      const data = await chrome.storage.local.get(['mcpServerConfigs', 'mcpServerConfig']);
      const mcpServerConfigsFromStorage = data.mcpServerConfigs || [];
      
      // 如果有新版多配置
      if (mcpServerConfigsFromStorage && mcpServerConfigsFromStorage.length > 0) {
        console.log('[MCPService] 加载了多个MCP服务器配置, 数量:', mcpServerConfigsFromStorage.length);
        
        // 过滤有效的配置
        return mcpServerConfigsFromStorage
          .filter((config: MCPServer) => {
            // 只保留有serverUrl的配置
            if (!config.serverUrl) {
              console.warn('[MCPService] 忽略缺少serverUrl的MCP服务器配置:', config.name || 'unnamed');
              return false;
            }
            return true;
          });
      }
      
      // 回退到旧版配置，转换为新格式
      if (data.mcpServerConfig) {
        console.log('[MCPService] 使用旧版单一MCP服务器配置');
        const oldConfig = data.mcpServerConfig;
        
        // 适配旧版配置
        const serverUrl = oldConfig.serverUrl || oldConfig.wsUrl || oldConfig.sseUrl;
        if (!serverUrl) {
          console.warn('[MCPService] 旧版MCP配置缺少有效的服务器URL');
          return [];
        }
        
        return [{
          name: oldConfig.name || '旧版配置',
          serverUrl: serverUrl
        }];
      }
      
      // 没有配置
      return [];
    } catch (error) {
      console.error('[MCPService] 获取MCP服务器配置失败:', error);
      return [];
    }
  }
  
  /**
   * 创建MCP客户端
   * @param serverConfig 服务器配置
   * @returns MCP客户端实例
   */
  public static async createMCPClient(serverConfig: MCPServer): Promise<MCPClient> {
    const client = new MCPClient({
      serverConfig,
      clientInfo: {
        name: 'askanything-browser-extension',
        version: '1.0.0'
      }
    });
    return client;
  }
  
  /**
   * 处理用户对AI问题的回答
   * @param pendingQuestion 待回答的问题
   * @param userResponse 用户的回答
   */
  public static async processUserResponse(pendingQuestion: any, userResponse: string): Promise<void> {
    // 创建一个包含用户回答的新对象
    const updatedArgs = {
      question: pendingQuestion.question,
      user_response: userResponse
    };
    
    // 获取当前使用的工具执行器
    const currentExecutor = new CustomToolExecutor(customTools, async (content: string) => {
      chrome.runtime.sendMessage({
        type: 'ANSWER_TOKEN',
        token: content,
        responseStreamId: 'ai-response-' + Date.now()
      });
      return { success: true };
    });
    
    try {
      // 再次调用askQuestion工具，但这次带上用户回答
      const result = await currentExecutor.executeTool('ask_question', updatedArgs);
      console.log('[MCPService] 使用用户回答重新调用工具结果:', result);
    } catch (error: any) {
      console.error('[MCPService] 处理用户回答时出错:', error);
    }
  }
} 