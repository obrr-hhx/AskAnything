import { BaseProvider } from './base';
import { createOpenAIClient, streamOpenAICompletion } from '../shared/api-clients';

/**
 * OpenAI提供商的实现
 */
export class OpenAIProvider extends BaseProvider {
  // 存储当前对话的工具调用
  private toolCalls: Map<string, any> = new Map();
  // 存储对话历史消息
  private messages: any[] = [];
  
  /**
   * 创建OpenAI客户端
   */
  protected createClient() {
    return createOpenAIClient(
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
      
      if (isFirstMessage) {
        // 构建系统消息
        let systemMessage = '你是AskAnything, 一个有帮助的AI助手。主要职责是帮助用户更高效的学习，回答用户的问题。';
        if (context) {
          if (context.text) {
            systemMessage += `用户选择的文本是: "${context.text}". `;
          }
          if (context.url && context.title) {
            systemMessage += `当前网页是: ${context.title} (${context.url}). `;
          }
        }
        
        // 初始化消息数组（仅首次）
        this.messages = [
          { role: 'system', content: systemMessage }
        ];
        
        console.log('[OpenAIProvider] 初始化新对话，系统消息已设置');
      } else {
        console.log(`[OpenAIProvider] 继续多轮对话，当前历史消息数量: ${this.messages.length}`);
      }
      
      // 添加用户消息到历史记录
      this.messages.push({ role: 'user', content: question });

      // 创建客户端
      const openaiClient = this.createClient();
      console.log('[OpenAIProvider] OpenAI客户端创建成功');
      
      // 获取流式响应
      const stream = await streamOpenAICompletion(
        openaiClient,
        this.messages,
        this.requestConfig.modelName,
        { signal: this.requestConfig.signal }
      );

      // 处理流式响应
      await this.handleStream(stream);
    } catch (error: any) {
      console.error('[OpenAIProvider] OpenAI请求失败:', error);
      
      // 检查是否有API响应错误
      if (error.response) {
        try {
          const errorText = await error.response.text();
          console.error('- API响应错误:', errorText);
        } catch (e) {
          console.error('- 无法读取API响应:', e);
        }
      }
      
      // 通知错误
      this.handlers.onError(error);
      
      // 注意：不在这里调用destroy()，以保持对话历史
    }
  }

  /**
   * 处理流式响应
   */
  protected async handleStream(stream: any): Promise<void> {
    let fullText = '';
    
    try {
      // 遍历流式响应
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        const toolCalls = chunk.choices[0]?.delta?.tool_calls || [];
        
        // 处理内容
        if (content) {
          fullText += content;
          // 通知有新的令牌
          this.handlers.onToken(content);
        }
        
        // 处理工具调用
        if (toolCalls && toolCalls.length > 0) {
          for (const toolCall of toolCalls) {
            const toolCallId = toolCall.id;
            if (toolCallId) {
              // 将工具调用存储到映射中
              if (!this.toolCalls.has(toolCallId)) {
                this.toolCalls.set(toolCallId, {
                  id: toolCallId,
                  type: toolCall.type,
                  function: {
                    name: toolCall.function?.name || '',
                    arguments: toolCall.function?.arguments || '{}'
                  }
                });
              } else {
                // 更新已存在的工具调用
                const existingToolCall = this.toolCalls.get(toolCallId);
                if (toolCall.function?.arguments) {
                  existingToolCall.function.arguments += toolCall.function.arguments;
                }
              }
              
              // 当工具调用完整后，通知处理器
              const completeToolCall = this.toolCalls.get(toolCallId);
              if (completeToolCall && completeToolCall.function?.name && completeToolCall.function?.arguments) {
                console.log('[OpenAIProvider] 收到工具调用:', completeToolCall);
                this.handlers.onToolCall(completeToolCall);
              }
            }
          }
        }
      }
      
      // 将assistant的回答添加到消息历史中
      if (fullText) {
        this.messages.push({ role: 'assistant', content: fullText });
        console.log(`[OpenAIProvider] 已将assistant回答添加到消息历史，历史消息数量: ${this.messages.length}`);
      }
      
      // 流结束，通知完成
      console.log('[OpenAIProvider] OpenAI流响应完成, 总长度:', fullText.length);
      this.handlers.onComplete(fullText);
      
      // 注意：不再在这里调用destroy()，因为我们要保持对话历史
    } catch (error: any) {
      console.error('[OpenAIProvider] 处理流式响应出错:', error);
      this.handlers.onError(error);
      
      // 清理资源
      this.destroy();
    }
  }
  
  /**
   * 提交工具执行结果
   * 将用户对工具调用的响应发送回OpenAI，以便AI继续对话
   */
  public async submitToolResult(toolCallId: string, result: string): Promise<void> {
    try {
      if (!toolCallId) {
        throw new Error('工具调用ID不能为空');
      }
      
      console.log(`[OpenAIProvider] 提交工具结果: toolCallId=${toolCallId}, result=${result}`);
      
      // 检查是否有对应的工具调用
      const toolCall = this.toolCalls.get(toolCallId);
      if (!toolCall) {
        throw new Error(`未找到对应的工具调用: ${toolCallId}`);
      }
      
      // 这里应该实现调用OpenAI API提交工具结果并接收进一步的回复
      // 创建客户端但不保存局部变量(否则会有未使用警告)
      this.createClient();
      
      // 通知处理器有工具结果
      this.handlers.onToolResult({
        toolCallId,
        result
      });
      
      // 通知UI有新令牌
      this.handlers.onToken(`\n\n用户回答: ${result}\n\nAI继续回复中...\n`);
      
      // 这里应该是调用实际的OpenAI API
      console.log('[OpenAIProvider] TODO: 实现实际调用OpenAI API提交工具结果的逻辑');
      
      // 模拟响应
      setTimeout(() => {
        this.handlers.onToken("感谢您提供的信息。我将继续基于您的回答为您服务。");
        this.handlers.onComplete("感谢您提供的信息。我将继续基于您的回答为您服务。");
      }, 500);
      
    } catch (error: any) {
      console.error('[OpenAIProvider] 提交工具结果失败:', error);
      this.handlers.onError(error);
    }
  }
  
  /**
   * 重写销毁方法，添加额外资源的清理
   */
  public override destroy(): void {
    // 清除保存的工具调用
    this.toolCalls.clear();
    
    // 调用基类的销毁方法
    super.destroy();
  }
} 