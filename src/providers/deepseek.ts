import { BaseProvider } from './base';
import { createDeepSeekClient, streamDeepSeekCompletion } from '../shared/api-clients';

/**
 * DeepSeek提供商的实现
 */
export class DeepSeekProvider extends BaseProvider {
  // 存储对话历史消息
  private messages: any[] = [];

  /**
   * 创建DeepSeek客户端
   */
  protected createClient() {
    return createDeepSeekClient(
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
        
        console.log('[DeepSeekProvider] 初始化新对话，系统消息已设置');
      } else {
        console.log(`[DeepSeekProvider] 继续多轮对话，当前历史消息数量: ${this.messages.length}`);
      }
      
      // 添加用户消息到历史记录
      this.messages.push({ role: 'user', content: question });
      
      // 创建客户端
      const deepseekClient = this.createClient();
      console.log('[DeepSeekProvider] DeepSeek客户端创建成功');
      
      // 获取流式响应
      const stream = await streamDeepSeekCompletion(
        deepseekClient,
        this.messages as any,
        this.requestConfig.modelName,
        { signal: this.requestConfig.signal }
      );
      
      console.log('[DeepSeekProvider] 流式请求发送成功，开始接收响应');
      
      // 处理流式响应
      await this.handleStream(stream);
    } catch (error: any) {
      console.error('[DeepSeekProvider] DeepSeek请求失败:', error);
      
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
    }
  }
  
  /**
   * 处理流式响应
   */
  protected async handleStream(stream: any): Promise<void> {
    let fullText = '';
    let reasoningText = ''; // 用于存储推理内容
    let reasoningContainerId = ''; // 存储容器ID
    let hasCreatedReasoningContainer = false; // 标记是否已创建推理容器
    
    try {
      // 检查是否是推理模型
      const isReasoningModel = this.requestConfig.modelName === 'deepseek-reasoner';
      
      // 如果是推理模型，创建推理容器
      if (isReasoningModel) {
        reasoningContainerId = this.createThinkingContainer('R1推理过程');
        hasCreatedReasoningContainer = true;
      }
      
      // 遍历流式响应
      for await (const chunk of stream) {
        console.log('[DeepSeekProvider] 收到DeepSeek原始响应块:', chunk);
        
        // 尝试提取常规内容和推理内容
        let content = '';
        let reasoningContent = '';
        
        if (chunk.choices && chunk.choices[0]) {
          const delta = chunk.choices[0].delta as any;
          
          // 检查是否有推理内容（R1模型特有）
          if (delta.reasoning_content) {
            reasoningContent = delta.reasoning_content;
            reasoningText += reasoningContent;
            console.log('[DeepSeekProvider] 收到R1推理内容:', 
              reasoningContent.substring(0, 30) + (reasoningContent.length > 30 ? '...' : ''));
            
            // 将推理内容添加到已创建的容器中
            if (isReasoningModel && hasCreatedReasoningContainer) {
              console.log(`[DeepSeekProvider] 更新R1推理内容到容器: ${reasoningContainerId}, 内容长度: ${reasoningContent.length}字节`);
              this.handlers.onThinking(reasoningContent, reasoningContainerId);
            }
            
            continue; // 不直接发送推理内容，仅更新容器
          }
          
          // 检查常规内容
          if (delta.content) {
            content = delta.content;
          } else if ((chunk.choices[0] as any).message && (chunk.choices[0] as any).message.content) {
            content = (chunk.choices[0] as any).message.content;
          }
        }
        
        if (content) {
          fullText += content;
          console.log('[DeepSeekProvider] 接收DeepSeek流内容:', content.length, '字节, 内容:', 
            content.substring(0, 20) + (content.length > 20 ? '...' : ''));
          
          // 通知有新的令牌
          this.handlers.onToken(content);
        }
      }
      
      // 流结束，更新推理内容（以防万一容器创建后未能及时更新）
      if (reasoningText && isReasoningModel && hasCreatedReasoningContainer) {
        console.log('[DeepSeekProvider] 流结束，确保推理内容已完全更新, 长度:', reasoningText.length, '字节');
        this.handlers.onFinalUpdate(reasoningText, reasoningContainerId);
      }
      
      // 将assistant的回答添加到消息历史中
      if (fullText || reasoningText) {
        // 对于推理模型，将推理内容和答案内容组合
        let assistantContent = fullText;
        if (isReasoningModel && reasoningText) {
          // 使用特殊格式保存推理内容
          assistantContent = `<thinking>${reasoningText}</thinking>${fullText}`;
        }
        
        this.messages.push({ role: 'assistant', content: assistantContent });
        console.log(`[DeepSeekProvider] 已将assistant回答添加到消息历史，历史消息数量: ${this.messages.length}`);
      }
      
      // 流结束，通知完成
      console.log('[DeepSeekProvider] DeepSeek流响应完成, 总长度:', fullText.length);
      this.handlers.onComplete(fullText);
    } catch (error: any) {
      console.error('[DeepSeekProvider] 处理流式响应出错:', error);
      this.handlers.onError(error);
    }
  }
} 