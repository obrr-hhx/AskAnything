/**
 * 支持的AI模型类型
 */
export type AIModel = 'chatgpt' | 'claude' | 'deepseek' | 'deepseek-r1' | 'qwen3';

/**
 * API提供商类型
 */
export type APIProvider = 'openai' | 'anthropic' | 'deepseek' | 'qwen3';

/**
 * 默认API端点配置
 */
export const DEFAULT_ENDPOINTS: Record<string, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  deepseek: 'https://api.deepseek.com',
  qwen3: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
};

/**
 * 模型配置表
 */
export const MODEL_CONFIG: Record<AIModel, { model: string, provider: APIProvider }> = {
  chatgpt: {
    model: 'gpt-3.5-turbo',
    provider: 'openai'
  },
  claude: {
    model: 'claude-3-sonnet-20240229',
    provider: 'anthropic'
  },
  deepseek: {
    model: 'deepseek-chat',
    provider: 'deepseek'
  },
  'deepseek-r1': {
    model: 'deepseek-reasoner',
    provider: 'deepseek'
  },
  qwen3: {
    model: 'qwen3-235b-a22b',
    provider: 'qwen3'
  }
};