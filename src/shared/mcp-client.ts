// MCP客户端实现 - 使用ModelContextProtocol SDK
import { Client as MCPSDKClient } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { ChatCompletionTool } from "openai/resources/chat/completions";

// 用于MCP服务器接口
export interface MCPServer {
  // 服务器名称
  name?: string;
  // 服务器URL
  serverUrl: string;
}

// MCP客户端配置
export interface MCPClientConfig {
  serverConfig: MCPServer; 
  clientInfo: {
    name: string;
    version: string;
  };
}

// MCP客户端类
export class MCPClient {
  private sdkClient: MCPSDKClient | null = null;
  private transport: SSEClientTransport | StreamableHTTPClientTransport | null = null;
  private serverConfig: MCPServer | null = null;
  private clientInfo: { name: string; version: string };

  constructor(config: MCPClientConfig) {
    this.clientInfo = config.clientInfo;
    this.serverConfig = config.serverConfig;
    console.log('[MCP-Client] 初始化MCP客户端', config.clientInfo);
  }

  // 连接到服务器
  async connect(serverConfig?: MCPServer): Promise<void> {
    if (serverConfig) {
      this.serverConfig = serverConfig;
    }
    
    if (!this.serverConfig?.serverUrl) {
      throw new Error('未提供服务器URL');
    }
    
    console.log('[MCP-Client] 正在连接到服务器:', this.serverConfig.name || this.serverConfig.serverUrl);
    
    // 如果已经连接，返回
    if (this.sdkClient && this.isConnected()) {
      console.log('[MCP-Client] 已经连接到服务器');
      return;
    }
    
    try {
      // 创建SDK客户端
      this.sdkClient = new MCPSDKClient(this.clientInfo);
      
      try {
        // 先尝试使用StreamableHTTP连接
        console.log('[MCP-Client] 尝试使用StreamableHTTP传输连接到:', this.serverConfig.serverUrl);
        this.transport = new StreamableHTTPClientTransport(
          new URL(this.serverConfig.serverUrl)
        );
        await this.sdkClient.connect(this.transport);
        console.log('[MCP-Client] StreamableHTTP连接成功');
      } catch (error) {
        console.log('[MCP-Client] StreamableHTTP连接失败，降级到SSE传输:', error);
        
        // 如果StreamableHTTP连接失败，尝试SSE连接
        this.transport = new SSEClientTransport(
          new URL(this.serverConfig.serverUrl)
        );
        await this.sdkClient.connect(this.transport);
        console.log('[MCP-Client] SSE连接成功');
      }
      
      console.log('[MCP-Client] 连接已建立');
    } catch (error) {
      console.error('[MCP-Client] 所有连接方式尝试失败:', error);
      throw new Error(`连接MCP服务器失败: ${error}`);
    }
  }
   
  // 获取可用工具列表
  async listTools(): Promise<ChatCompletionTool[]> {
    console.log('[MCP-Client] 获取工具列表');
    
    if (!this.sdkClient) {
      throw new Error('MCP客户端尚未初始化');
    }
    
    try {
      // 使用SDK获取工具列表
      const toolsInfo: any = await this.sdkClient.listTools();
      
      // 转换工具格式
      const tools: ChatCompletionTool[] = toolsInfo.tools.map((tool: any) => {
        return {
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: {
                ... tool.inputSchema,
                additionalProperties: false
            },
          }
        }
      });
      
      console.log('[MCP-Client] 获取到工具:', tools.map((t: ChatCompletionTool) => t.function.name).join(', '));
      return tools;
    } catch (error) {
      console.error('[MCP-Client] 获取工具列表失败:', error);
      throw new Error(`获取工具列表失败: ${error}`);
    }
  }

  // 调用工具
  async callTool(toolName: string, args: Record<string, any>): Promise<any> {
    console.log(`[MCP-Client] 调用工具: ${toolName}`, args);
    
    if (!this.sdkClient) {
      throw new Error('MCP客户端尚未初始化');
    }
    
    try {
      // 使用SDK调用工具
      const result = await this.sdkClient.callTool({
        name: toolName,
        arguments: args
      });
      
      console.log(`[MCP-Client] 工具调用结果:`, result);
      return result;
    } catch (error) {
      console.error(`[MCP-Client] 调用工具 ${toolName} 失败:`, error);
      throw new Error(`调用工具失败: ${error}`);
    }
  }

  // 是否已连接
  isConnected(): boolean {
    return !!this.sdkClient;
  }

  // 关闭连接
  async close(): Promise<void> {
    if (this.sdkClient) {
      try {
        await this.sdkClient.close();
      } catch (error) {
        console.error('[MCP-Client] 关闭连接出错:', error);
      }
      this.sdkClient = null;
    }
    
    this.transport = null;
    console.log('[MCP-Client] 连接已关闭');
  }
}