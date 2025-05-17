import { AIModel } from '../models/config';
import { ProviderFactory } from '../factories/provider-factory';
import { ConfigService } from './config';
import { StreamEventHandlers, RequestConfig } from '../providers/base';

/**
 * 活动流记录
 */
interface ActiveStream {
  abortController: AbortController;
  model: AIModel;
  timestamp: number;
}

/**
 * 流管理服务
 * 处理流式响应和管理活动流
 */
export class StreamService {
  // 活动流记录
  private static activeStreams: Record<string, ActiveStream> = {};
  
  /**
   * 处理流式响应
   * @param model AI模型
   * @param question 用户问题
   * @param context 上下文
   * @returns 响应流ID
   */
  public static async handleStreamingResponse(
    model: AIModel, 
    question: string, 
    context: any = null
  ): Promise<string> {
    // 生成响应流ID
    const responseStreamId = Date.now().toString();
    let abortController: AbortController | null = null;
    
    try {
      // 检查问题是否为空
      if (!question || question.trim() === '') {
        throw new Error('问题内容为空');
      }
      
      // 获取API配置
      console.log('[StreamService] 正在获取API配置...');
      const apiConfig = await ConfigService.getApiConfig(model);
      
      // 详细记录API配置信息（隐藏API密钥细节）
      console.log(`[StreamService] API配置检查:`, {
        provider: apiConfig.provider,
        modelName: apiConfig.modelName,
        hasApiKey: !!apiConfig.apiKey,
        apiKeyPrefix: apiConfig.apiKey ? apiConfig.apiKey.substring(0, 5) + '...' : 'undefined',
        endpoint: apiConfig.endpoint || 'default endpoint',
        // 记录是否启用思考模式
        enableThinking: context?.enableThinking
      });
      
      // 记录请求的提供商和模型
      console.log(`[StreamService] 使用API提供商: ${apiConfig.provider}, 模型: ${apiConfig.modelName}`);
      
      // 发送流开始标记
      chrome.runtime.sendMessage({
        type: 'STREAM_START',
        id: responseStreamId,
        responseStreamId: responseStreamId
      });
      console.log('[StreamService] 已发送流开始标记');
      
      // 创建AbortController
      abortController = new AbortController();
      
      // 记录请求信息到activeStreams
      this.activeStreams[responseStreamId] = {
        abortController,
        model,
        timestamp: Date.now()
      };
      
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
      
      // 创建请求配置
      const requestConfig: RequestConfig = {
        apiKey: apiConfig.apiKey,
        endpoint: apiConfig.endpoint,
        modelName: apiConfig.modelName,
        provider: apiConfig.provider,
        signal: abortController.signal,
        enableThinking: context?.enableThinking,
        useMCP: context?.useMCP
      };
      
      // 创建事件处理器
      const handlers: StreamEventHandlers = {
        onToken: (token: string) => {
          chrome.runtime.sendMessage({
            type: 'ANSWER_TOKEN',
            token,
            responseStreamId
          });
        },
        
        onThinking: (content: string, containerId: string) => {
          chrome.runtime.sendMessage({
            type: 'UPDATE_REASONING',
            content,
            containerId,
            responseStreamId
          });
        },
        
        onFinalUpdate: (content: string, containerId: string) => {
          chrome.runtime.sendMessage({
            type: 'FINAL_REASONING_UPDATE',
            content,
            containerId,
            responseStreamId
          });
        },
        
        onToolCall: (toolCall: any) => {
          chrome.runtime.sendMessage({
            type: 'TOOL_CALL',
            toolCall,
            responseStreamId
          });
        },
        
        onToolResult: (result: any) => {
          chrome.runtime.sendMessage({
            type: 'TOOL_RESULT',
            result,
            responseStreamId
          });
        },
        
        onError: (error: Error) => {
          console.error('[StreamService] 处理出错:', error);
          chrome.runtime.sendMessage({
            type: 'STREAM_ERROR',
            error: error.message,
            responseStreamId
          });
          
          // 清理活动流
          if (this.activeStreams[responseStreamId]) {
            delete this.activeStreams[responseStreamId];
          }
        },
        
        onComplete: (fullText: string) => {
          console.log('[StreamService] 流响应完成, 总长度:', fullText.length);
          chrome.runtime.sendMessage({
            type: 'STREAM_END',
            text: fullText,
            responseStreamId
          });
          
          // 清理活动流
          if (this.activeStreams[responseStreamId]) {
            delete this.activeStreams[responseStreamId];
          }
        },
        
        onCreate: (containerId: string, label: string) => {
          chrome.runtime.sendMessage({
            type: 'CREATE_THINKING_CONTAINER',
            containerId,
            label,
            responseStreamId
          });
        }
      };
      
      // 创建提供商并处理问题
      const provider = ProviderFactory.createProvider(requestConfig, responseStreamId, handlers);
      await provider.processQuestion(question, context);
      
      return responseStreamId;
    } catch (error: any) {
      console.error('[StreamService] 处理流式响应出错:', error);
      
      // 发送错误消息
      chrome.runtime.sendMessage({
        type: 'STREAM_ERROR',
        error: error.message,
        responseStreamId
      });
      
      // 清理活动流
      if (this.activeStreams[responseStreamId]) {
        delete this.activeStreams[responseStreamId];
      }
      
      return responseStreamId;
    }
  }
  
  /**
   * 停止流式生成
   * @param streamId 响应流ID
   * @returns 是否成功停止
   */
  public static stopGeneration(streamId: string): boolean {
    console.log('[StreamService] 收到停止生成请求, streamId:', streamId);
    
    // 检查是否有对应的流
    if (streamId && this.activeStreams[streamId]) {
      // 获取并销毁Provider实例
      const provider = ProviderFactory.getProviderInstance(streamId);
      if (provider) {
        console.log('[StreamService] 正在销毁Provider实例, streamId:', streamId);
        provider.destroy();
      }
      
      // 取消请求
      this.activeStreams[streamId].abortController.abort();
      console.log('[StreamService] 已中止生成请求:', streamId);
      
      // 发送结束消息
      chrome.runtime.sendMessage({
        type: 'STREAM_END',
        responseStreamId: streamId,
        forceStopped: true
      });
      
      // 移除活动流记录
      delete this.activeStreams[streamId];
      return true;
    } else {
      console.log('[StreamService] 未找到对应的流:', streamId);
      return false;
    }
  }
  
  /**
   * 清理过期的流
   * @param maxAgeMs 最大年龄(毫秒)
   */
  public static cleanupExpiredStreams(maxAgeMs: number = 30 * 60 * 1000) {
    const now = Date.now();
    
    for (const [streamId, stream] of Object.entries(this.activeStreams)) {
      // 检查是否过期
      if (now - stream.timestamp > maxAgeMs) {
        console.log(`[StreamService] 清理过期流: ${streamId}, 已存在 ${Math.floor((now - stream.timestamp) / 1000)} 秒`);
        
        // 获取并销毁Provider实例
        const provider = ProviderFactory.getProviderInstance(streamId);
        if (provider) {
          console.log(`[StreamService] 销毁过期流的Provider实例: ${streamId}`);
          provider.destroy();
        }
        
        // 取消请求
        try {
          stream.abortController.abort();
        } catch (error) {
          console.error(`[StreamService] 取消流 ${streamId} 时出错:`, error);
        }
        
        // 移除记录
        delete this.activeStreams[streamId];
      }
    }
  }
} 