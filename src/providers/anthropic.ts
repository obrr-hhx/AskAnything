import { BaseProvider, RequestConfig, StreamEventHandlers } from './base';
import { createAnthropicClient, streamAnthropicCompletion } from '../shared/api-clients';

/**
 * Anthropic提供商的实现
 */
export class AnthropicProvider extends BaseProvider {
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
      let systemMessage = '你是AI助手。';
      
      // 使用context参数增强系统提示
      if (context) {
        if (context.text) {
          systemMessage += ` 用户选择的文本是: "${context.text}".`;
        }
        if (context.url && context.title) {
          systemMessage += ` 当前网页是: ${context.title} (${context.url}).`;
        }
      }
      
      const anthropicClient = this.createClient();
      const response = await streamAnthropicCompletion(
        anthropicClient,
        systemMessage,
        question,
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
      
      this.handlers.onComplete(fullText);
    } catch (error: any) {
      this.handlers.onError(error);
    }
  }
}
