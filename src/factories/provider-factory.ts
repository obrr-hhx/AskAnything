import { BaseProvider, RequestConfig, StreamEventHandlers, getProviderInstance } from '../providers/base';
import { OpenAIProvider } from '../providers/openai';
import { DeepSeekProvider } from '../providers/deepseek';
import { AnthropicProvider } from '../providers/anthropic';
import { QwenProvider } from '../providers/qwen';

/**
 * AI提供商工厂
 * 负责创建不同类型的AI提供商实例
 */
export class ProviderFactory {
  /**
   * 创建AI提供商实例
   * @param config 请求配置
   * @param responseStreamId 响应流ID
   * @param handlers 事件处理器
   * @returns 提供商实例
   */
  public static createProvider(
    config: RequestConfig,
    responseStreamId: string,
    handlers: StreamEventHandlers
  ): BaseProvider {
    switch (config.provider) {
      case 'openai':
        return new OpenAIProvider(config, responseStreamId, handlers);
      
      case 'anthropic':
        return new AnthropicProvider(config, responseStreamId, handlers);
      
      case 'deepseek':
        return new DeepSeekProvider(config, responseStreamId, handlers);
      
      case 'qwen3':
        return new QwenProvider(config, responseStreamId, handlers);
      
      default:
        throw new Error(`不支持的API提供商: ${config.provider}`);
    }
  }

  /**
   * 获取现有的Provider实例
   * @param responseStreamId 响应流ID
   * @returns Provider实例，若未找到则返回undefined
   */
  public static getProviderInstance(responseStreamId: string): OpenAIProvider | DeepSeekProvider | AnthropicProvider | QwenProvider | undefined {
    return getProviderInstance(responseStreamId) as OpenAIProvider | DeepSeekProvider | AnthropicProvider | QwenProvider | undefined;
  }
} 