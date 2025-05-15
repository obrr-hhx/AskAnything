/**
 * AI提供商处理响应的事件处理器
 */
export interface StreamEventHandlers {
  onToken: (token: string) => void;
  onThinking: (content: string, containerId: string) => void;
  onFinalUpdate: (content: string, containerId: string) => void;
  onToolCall: (toolCall: any) => void;
  onToolResult: (result: any) => void;
  onError: (error: Error) => void;
  onComplete: (fullText: string) => void;
  onCreate: (containerId: string, label: string) => void;
}

/**
 * 请求配置
 */
export type RequestConfig = {
  apiKey: string;
  endpoint: string;
  modelName: string;
  provider: string;
  signal: AbortSignal;
  enableThinking?: boolean;
  useMCP?: boolean;
}

// Provider实例注册表，用于根据responseStreamId查找对应的Provider实例
const providerRegistry: Record<string, BaseProvider> = {};

/**
 * 基础AI提供商接口
 */
export abstract class BaseProvider {
  protected requestConfig: RequestConfig;
  protected handlers: StreamEventHandlers;
  protected responseStreamId: string;
  
  constructor(
    requestConfig: RequestConfig,
    responseStreamId: string,
    handlers: StreamEventHandlers
  ) {
    this.requestConfig = requestConfig;
    this.responseStreamId = responseStreamId;
    this.handlers = handlers;
    
    // 注册实例
    providerRegistry[responseStreamId] = this;
    console.log(`[BaseProvider] 注册Provider实例: ${responseStreamId}`);
  }

  /**
   * 处理来自用户的问题请求
   * @param question 用户问题
   * @param context 上下文信息
   */
  public abstract processQuestion(question: string, context?: any): Promise<void>;
  
  /**
   * 创建客户端实例
   */
  protected abstract createClient(): any;
  
  /**
   * 处理流式响应
   * @param stream 响应流
   */
  protected abstract handleStream(stream: any): Promise<void>;
  
  /**
   * 创建思考过程容器
   * @param label 容器标签
   */
  protected createThinkingContainer(label: string): string {
    const containerId = `reasoning-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    this.handlers.onCreate(containerId, label);
    return containerId;
  }

  /**
   * 销毁实例，清理资源
   */
  public destroy(): void {
    // 从注册表中移除
    if (this.responseStreamId && providerRegistry[this.responseStreamId]) {
      delete providerRegistry[this.responseStreamId];
      console.log(`[BaseProvider] 移除Provider实例: ${this.responseStreamId}`);
    }
  }
}

/**
 * 根据responseStreamId获取Provider实例
 * @param responseStreamId 响应流ID
 * @returns Provider实例，若未找到则返回undefined
 */
export function getProviderInstance(responseStreamId: string): BaseProvider | undefined {
  return providerRegistry[responseStreamId];
} 