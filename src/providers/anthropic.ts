import { BaseProvider, RequestConfig, StreamEventHandlers } from './base';
import { createAnthropicClient, streamAnthropicCompletion } from '../shared/api-clients';

/**
 * Anthropic提供商的实现
 */
export class AnthropicProvider extends BaseProvider {
  // 存储对话历史消息
  private messages: any[] = [];

  constructor(
    requestConfig: RequestConfig,
    responseStreamId: string,
    handlers: StreamEventHandlers
  ) {
    super(requestConfig, responseStreamId, handlers);
  }

  /**
   * 创建Anthropic客户端
   */
  protected createClient() {
    return createAnthropicClient(
      this.requestConfig.apiKey, 
      this.requestConfig.endpoint
    );
  }
  
  /**
   * 处理用户提问
   */
  public async processQuestion(question: string, context?: any): Promise<void> {
    try {
      // 检查是否是首次对话（消息数组为空）
      const isFirstMessage = this.messages.length === 0;
      
      let systemMessage = '你是AI助手。';
      
      if (isFirstMessage) {
        // 使用context参数增强系统提示
        if (context) {
          if (context.text) {
            systemMessage += ` 用户选择的文本是: "${context.text}".`;
          }
          if (context.url && context.title) {
            systemMessage += ` 当前网页是: ${context.title} (${context.url}).`;
          }
        }
        
        console.log('[AnthropicProvider] 初始化新对话，系统消息已设置');
      } else {
        console.log(`[AnthropicProvider] 继续多轮对话，当前历史消息数量: ${this.messages.length}`);
      }
      
      // 添加用户消息到历史记录
      this.messages.push({ role: 'user', content: question });
      
      const anthropicClient = this.createClient();
      const response = await streamAnthropicCompletion(
        anthropicClient,
        systemMessage,
        question, // 注意：这里可能需要传递完整的消息历史，取决于API实现
        this.requestConfig.modelName,
        { signal: this.requestConfig.signal }
      );
      await this.handleStream(response);
    } catch (error: any) {
      this.handlers.onError(error);
    }
  }
  
  /**
   * 处理流式响应
   */
  protected async handleStream(response: Response): Promise<void> {
    let fullText = '';
    
    try {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsedData = JSON.parse(data);
              const content = parsedData.delta?.text || '';
              
              if (content) {
                fullText += content;
                this.handlers.onToken(content);
              }
            } catch (error) {
              console.error('解析错误:', error);
            }
          }
        }
      }
      
      // 将assistant的回答添加到消息历史中
      if (fullText) {
        this.messages.push({ role: 'assistant', content: fullText });
        console.log(`[AnthropicProvider] 已将assistant回答添加到消息历史，历史消息数量: ${this.messages.length}`);
      }
      
      this.handlers.onComplete(fullText);
    } catch (error: any) {
      this.handlers.onError(error);
    }
  }
}
