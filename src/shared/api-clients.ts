// 导入OpenAI SDK
import OpenAI from 'openai';

// 创建OpenAI API客户端
export function createOpenAIClient(apiKey: string, baseURL?: string) {
  try {
    console.log('[API-Client] 创建OpenAI客户端');
    console.log('[API-Client] 基础URL:', baseURL || 'https://api.openai.com/v1');
    console.log('[API-Client] API密钥前5个字符:', apiKey.substring(0, 5) + '...');
    
    // 创建客户端实例
    return new OpenAI({
      baseURL: baseURL || 'https://api.openai.com/v1',
      apiKey,
      dangerouslyAllowBrowser: true
    });
  } catch (error) {
    console.error('[API-Client] 创建OpenAI客户端失败:', error);
    throw error;
  }
}

// 创建Anthropic API客户端
export function createAnthropicClient(apiKey: string, baseURL?: string) {
  try {
    console.log('[API-Client] 创建Anthropic客户端');
    console.log('[API-Client] 基础URL:', baseURL || 'https://api.anthropic.com/v1');
    console.log('[API-Client] API密钥前5个字符:', apiKey.substring(0, 5) + '...');
    
    // 创建自定义客户端实例（Anthropic暂无官方SDK或使用OpenAI SDK的兼容方式）
    return {
      apiKey,
      baseURL: baseURL || 'https://api.anthropic.com/v1',
      // 自定义方法将在streamAnthropicCompletion中使用
    };
  } catch (error) {
    console.error('[API-Client] 创建Anthropic客户端失败:', error);
    throw error;
  }
}

// 创建DeepSeek API客户端
export function createDeepSeekClient(apiKey: string, baseURL?: string) {
  try {
    console.log('[API-Client] 创建DeepSeek客户端');
    console.log('[API-Client] 基础URL:', baseURL || 'https://api.deepseek.com');
    console.log('[API-Client] API密钥前5个字符:', apiKey.substring(0, 5) + '...');
    
    // 创建客户端实例
    return new OpenAI({
      baseURL: baseURL || 'https://api.deepseek.com',
      apiKey,
      dangerouslyAllowBrowser: true
    });
  } catch (error) {
    console.error('[API-Client] 创建DeepSeek客户端失败:', error);
    throw error;
  }
}

// 创建Qwen API客户端
export function createQwenClient(apiKey: string, baseURL?: string) {
  try {
    console.log('[API-Client] 创建通义千问客户端');
    console.log('[API-Client] 基础URL:', baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1');
    console.log('[API-Client] API密钥前5个字符:', apiKey.substring(0, 5) + '...');
    
    // 创建客户端实例
    return new OpenAI({
      baseURL: baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      apiKey,
      dangerouslyAllowBrowser: true
    });
  } catch (error) {
    console.error('[API-Client] 创建通义千问客户端创建失败:', error);
    throw error;
  }
}

// 流式处理OpenAI请求
export async function streamOpenAICompletion(
  client: OpenAI,
  messages: any[],
  model: string,
  options?: { 
    temperature?: number, 
    signal?: AbortSignal,
    maxTokens?: number
  }
) {
  try {
    console.log('[API-Client] 发起OpenAI流式请求');
    console.log('[API-Client] 模型:', model);
    console.log('[API-Client] 消息数量:', messages.length);
    
    // 创建请求参数
    const requestOptions = options?.signal 
      ? { signal: options.signal } 
      : undefined;
    
    // 发送请求
    return await client.chat.completions.create(
      {
        model,
        messages,
        temperature: options?.temperature || 0.7,
        stream: true,
        max_tokens: options?.maxTokens
      },
      requestOptions
    );
  } catch (error) {
    console.error('[API-Client] OpenAI流式请求失败:', error);
    throw error;
  }
}

// 流式处理Anthropic请求 (使用fetch API，因为没有官方SDK或OpenAI兼容方式)
export async function streamAnthropicCompletion(
  client: any,
  systemPrompt: string,
  userMessage: string,
  model: string,
  options?: { 
    temperature?: number, 
    signal?: AbortSignal,
    maxTokens?: number
  }
) {
  try {
    console.log('[API-Client] 发起Anthropic流式请求');
    console.log('[API-Client] 模型:', model);
    console.log('[API-Client] 系统提示长度:', systemPrompt.length);
    console.log('[API-Client] 用户消息长度:', userMessage.length);
    
    // 发送请求
    const response = await fetch(`${client.baseURL}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': client.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
        stream: true,
        max_tokens: options?.maxTokens || 1000,
        temperature: options?.temperature || 0.7
      }),
      signal: options?.signal
    });
    
    if (!response.ok) {
      let errorDetail = '';
      try {
        const errorData = await response.json();
        errorDetail = errorData.error?.message || JSON.stringify(errorData);
      } catch (e) {
        try {
          const errorText = await response.text();
          errorDetail = `无法解析错误详情: ${e}. 原始响应: ${errorText.substring(0, 200)}`;
        } catch (textError) {
          errorDetail = `无法解析错误详情: ${e}. 无法读取错误响应文本: ${textError}`;
        }
      }
      
      throw new Error(`Anthropic API请求失败: ${response.status} ${response.statusText}. ${errorDetail}`);
    }
    
    return response;
  } catch (error) {
    console.error('[API-Client] Anthropic流式请求失败:', error);
    throw error;
  }
}

// 流式处理DeepSeek请求
export async function streamDeepSeekCompletion(
  client: OpenAI,
  messages: any[],
  model: string,
  options?: { 
    temperature?: number, 
    signal?: AbortSignal 
  }
) {
  try {
    console.log('[API-Client] 发起DeepSeek流式请求');
    console.log('[API-Client] 模型:', model);
    console.log('[API-Client] 消息数量:', messages.length);
    
    // 创建请求参数
    const requestOptions = options?.signal 
      ? { signal: options.signal } 
      : undefined;
    
    // 发送请求
    return await client.chat.completions.create(
      {
        model,
        messages,
        temperature: options?.temperature || 0.7,
        stream: true,
      },
      requestOptions
    );
  } catch (error) {
    console.error('[API-Client] DeepSeek流式请求失败:', error);
    throw error;
  }
}

// 流式处理Qwen请求
export async function streamQwenCompletion(
  client: OpenAI,
  messages: any[],
  model: string,
  options?: { 
    temperature?: number, 
    signal?: AbortSignal,
    enableThinking?: boolean,
    tools?: any[],
    tool_choice?: string,
    parallel_tool_calls?: boolean
  }
) {
  try {
    console.log('[API-Client] 发起通义千问流式请求');
    console.log('[API-Client] 模型:', model);
    console.log('[API-Client] 消息数量:', messages.length);
    console.log('[API-Client] 是否启用思考模式:', options?.enableThinking || false);
    console.log('[API-Client] 是否使用工具:', options?.tools ? options.tools.length + '个工具' : '否');
    console.log('[API-Client] 工具选择:', options?.tool_choice || 'auto');
    console.log('[API-Client] 是否并行调用工具:', options?.parallel_tool_calls || false);
    
    // 创建请求参数
    const requestOptions = options?.signal 
      ? { signal: options.signal } 
      : undefined;
    
    // 是否为qwen3模型并启用思考
    const isQwen3WithThinking = model === 'qwen3-235b-a22b' && options?.enableThinking;
    
    // 构建请求参数
    const requestParams: any = {
      model,
      messages,
      temperature: options?.temperature || 0.7,
      stream: true
    };
    
    // 如果启用思考模式，添加相关参数（适用于qwen3模型）
    if (isQwen3WithThinking) {
      requestParams.enable_thinking = true;
      requestParams.thinking_budget = 10240;
    }

    // 如果有工具，添加工具参数
    if (options?.tools && options.tools.length > 0) {
      requestParams.tools = options.tools;
      console.log('[API-Client] 添加工具到请求:', options.tools.length, '个工具');
    }
    
    console.log('[API-Client] 请求参数:', JSON.stringify({
      ...requestParams,
      messages: `[${messages.length} messages]` // 不记录具体内容，避免日志过大
    }));
    
    // 发送请求
    return await client.chat.completions.create(
      requestParams,
      requestOptions
    );
  } catch (error) {
    console.error('[API-Client] 通义千问流式请求失败:', error);
    throw error;
  }
} 