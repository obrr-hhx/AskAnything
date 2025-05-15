import { AIModel, MODEL_CONFIG, DEFAULT_ENDPOINTS } from '../models/config';

/**
 * API配置服务
 * 管理和获取API配置
 */
export class ConfigService {
  /**
   * 获取API配置
   * @param model AI模型
   * @returns API配置
   */
  public static async getApiConfig(model: AIModel) {
    try {
      // 检查模型是否有效
      if (!model || !MODEL_CONFIG[model]) {
        console.error(`[ConfigService] 无效的模型: ${model}`);
        throw new Error(`无效的模型: ${model}`);
      }
    
      const modelConfig = MODEL_CONFIG[model];
      const provider = modelConfig.provider;
      
      console.log(`[ConfigService] 为模型 ${model} 获取API配置, 提供商: ${provider}`);
      
      try {
        // 获取API密钥和端点
        console.log(`[ConfigService] 从存储中获取API密钥和端点...`);
        const data = await chrome.storage.local.get(['apiKeys', 'apiEndpoints']);
        const apiKeys = data.apiKeys || {};
        const apiEndpoints = data.apiEndpoints || {};
        
        console.log(`[ConfigService] API密钥检查 (${provider}):`, {
          exists: !!apiKeys[provider],
          keyLength: apiKeys[provider] ? apiKeys[provider].length : 0,
          endpointConfigured: !!apiEndpoints[provider]
        });
        
        // 检查是否有该提供者的API密钥
        if (!apiKeys[provider]) {
          console.error(`[ConfigService] 未找到${provider}的API密钥`);
          throw new Error(`未找到${provider}的API密钥，请在选项页面设置`);
        }
        
        // API密钥基本格式验证
        if (provider === 'openai' && !apiKeys[provider].startsWith('sk-')) {
          console.warn('[ConfigService] OpenAI API密钥格式似乎不正确，通常应以sk-开头');
        }
        
        if (provider === 'deepseek' && !apiKeys[provider].startsWith('sk-')) {
          console.warn('[ConfigService] DeepSeek API密钥格式似乎不正确，正常应以sk-开头');
        }
        
        // 确定API端点
        const endpoint = apiEndpoints[provider] || DEFAULT_ENDPOINTS[provider] || '';
        console.log(`[ConfigService] 使用API端点: ${endpoint || '(默认端点)'}`);
        
        return {
          apiKey: apiKeys[provider],
          endpoint,
          modelName: modelConfig.model,
          provider
        };
      } catch (error: any) {
        console.error(`[ConfigService] 获取${model}的API配置失败:`, error);
        throw error;
      }
    } catch (error: any) {
      console.error(`[ConfigService] 获取API配置过程中出错:`, error);
      throw new Error(`获取API配置失败: ${error.message}`);
    }
  }
} 