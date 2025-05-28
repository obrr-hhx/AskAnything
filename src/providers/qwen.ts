import { BaseProvider, RequestConfig, StreamEventHandlers } from './base';
import { createQwenClient, streamQwenCompletion } from '../shared/api-clients';
import { CustomToolExecutor, customTools, ToolResponse } from '../shared/custom-tools';
import { MCPService } from '../services/mcp';
import { MCPClient } from '../shared/mcp-client';
import { ChatCompletionTool } from 'openai/resources/chat/completions';

/**
 * 通义千问提供商的实现
 */
export class QwenProvider extends BaseProvider {
  private messages: any[] = [];
  private mcps: MCPClient[] = [];
  private isMcpServerExist: {[name: string]: boolean} = {};
  private tools: ChatCompletionTool[] = [];
  private toolsMap: {[name: string]: MCPClient} = {};

  constructor(requestConfig: RequestConfig, responseStreamId: string, handlers: StreamEventHandlers) {
    super(requestConfig, responseStreamId, handlers);
    this.mcps = [];
    this.tools = [];
    this.toolsMap = {};
    this.isMcpServerExist = {};
    
    //先加载自定义工具
    this.tools.push(...customTools);
    console.log('[QwenProvider] 自定义工具加载完成, 数量:', this.tools.length);
  }

  /**
   * 创建通义千问客户端
   */
  protected createClient() {
    return createQwenClient(
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
        
        console.log('[QwenProvider] 初始化新对话，系统消息已设置');
      } else {
        console.log(`[QwenProvider] 继续多轮对话，当前历史消息数量: ${this.messages.length}`);
      }
      
      // 检查是否包含图片，如果有则自动调用图片理解工具
      if (context?.hasImage && context?.imageUrl) {
        console.log('[QwenProvider] 检测到图片，自动调用图片理解工具');
        
        // 添加用户消息到历史记录
        this.messages.push({ role: 'user', content: question });
        
        // 创建自定义工具执行器
        const messageSender = async (content: string) => {
          this.handlers.onToken(content);
          return { success: true };
        };
        const customToolExecutor = new CustomToolExecutor(customTools, messageSender);
        
        console.log('[QwenProvider] 执行图片理解工具调用');
        
        // 执行图片理解工具
        try {
          const toolResult = await customToolExecutor.executeTool('understand_image', {
            image_url: context.imageUrl,
            question: context.originalQuestion || question
          });
          
          // 通知工具结果
          this.handlers.onToolResult(toolResult);
          
          if (toolResult.status === 'success') {
            // 将图片分析结果作为AI回答返回
            const analysisResult = typeof toolResult.content === 'object' 
              ? toolResult.content.analysis || JSON.stringify(toolResult.content)
              : toolResult.content;
            
            console.log('[QwenProvider] 图片理解完成，返回分析结果');
            
            // 添加AI助手的响应到消息历史
            this.messages.push({
              role: 'assistant',
              content: analysisResult
            });
            
            console.log(`[QwenProvider] 图片分析结果已保存到messages历史，当前历史长度: ${this.messages.length}`);
            console.log(`[QwenProvider] 最新助手消息预览: ${analysisResult.substring(0, 100)}...`);
            
            // 逐字输出分析结果
            for (let i = 0; i < analysisResult.length; i++) {
              this.handlers.onToken(analysisResult[i]);
              // 添加小的延迟以模拟打字效果
              await new Promise(resolve => setTimeout(resolve, 20));
            }
            
            this.handlers.onComplete(analysisResult);
          } else {
            // 处理工具执行错误
            const errorMessage = `图片分析失败: ${toolResult.error || toolResult.message || '未知错误'}`;
            console.error('[QwenProvider] 图片理解失败:', toolResult);
            
            this.messages.push({
              role: 'assistant',
              content: errorMessage
            });
            
            console.log(`[QwenProvider] 图片分析错误信息已保存到messages历史，当前历史长度: ${this.messages.length}`);
            
            this.handlers.onToken(errorMessage);
            this.handlers.onComplete(errorMessage);
          }
        } catch (error) {
          console.error('[QwenProvider] 图片理解工具执行异常:', error);
          const errorMessage = `图片分析过程中出现异常: ${error instanceof Error ? error.message : '未知错误'}`;
          
          this.messages.push({
            role: 'assistant',
            content: errorMessage
          });
          
          console.log(`[QwenProvider] 图片分析错误信息已保存到messages历史，当前历史长度: ${this.messages.length}`);
          
          this.handlers.onToken(errorMessage);
          this.handlers.onComplete(errorMessage);
        }
        
        return; // 图片处理完成，直接返回
      }
      
      // 检查是否包含B站视频链接，如果有则自动调用视频理解工具
      const bilibiliUrlPattern = /(https?:\/\/)?(www\.)?(bilibili\.com\/video\/(BV[a-zA-Z0-9]{10}|av\d+)|b23\.tv\/[a-zA-Z0-9]+)/;
      const videoUrlMatch = question.match(bilibiliUrlPattern);
      
      if (videoUrlMatch) {
        // 提取完整的URL，包括可能的参数
        const fullUrlMatch = question.match(/(https?:\/\/)?(www\.)?bilibili\.com\/video\/(BV[a-zA-Z0-9]{10}|av\d+)(\?[^\s]*)?/);
        let videoUrl;
        
        if (fullUrlMatch) {
          videoUrl = fullUrlMatch[0].startsWith('http') ? fullUrlMatch[0] : `https://${fullUrlMatch[0]}`;
          // 移除时间参数，只保留基本的视频URL
          videoUrl = videoUrl.replace(/[?&]t=\d+/, '').replace(/[?&]p=\d+/, '');
        } else {
          videoUrl = videoUrlMatch[0].startsWith('http') ? videoUrlMatch[0] : `https://${videoUrlMatch[0]}`;
        }
        
        console.log('[QwenProvider] 检测到B站视频链接，自动调用视频理解工具:', videoUrl);
        
        // 创建自定义工具执行器
        const messageSender = async (content: string) => {
          this.handlers.onToken(content);
          return { success: true };
        };
        const customToolExecutor = new CustomToolExecutor(customTools, messageSender);
        
        console.log('[QwenProvider] 执行视频理解工具调用');
        
        // 执行视频理解工具，使用默认参数，让AI自己理解用户问题
        try {
          const toolResult = await customToolExecutor.executeTool('understand_video', {
            video_url: videoUrl,
            analysis_type: 'summary', // 使用默认类型
            focus_keywords: undefined // 不预设关键词
          });
          
          // 通知工具结果
          this.handlers.onToolResult(toolResult);
          
          if (toolResult.status === 'success') {
            // 获取视频信息和字幕
            const videoData = toolResult.content;
            const subtitles = videoData.subtitles || [];
            
            // 构建包含字幕的用户消息内容
            let userMessageContent = `视频链接: ${videoUrl}\n用户问题: ${question}\n\n`;
            
            if (subtitles.length > 0) {
              userMessageContent += `视频字幕:\n`;
              userMessageContent += `视频标题: ${videoData.title}\n`;
              userMessageContent += `视频时长: ${videoData.duration}\n`;
              userMessageContent += `UP主: ${videoData.uploader}\n\n`;
              userMessageContent += `字幕内容:\n`;
              
              // 格式化字幕信息
              subtitles.forEach((subtitle: any) => {
                const startTime = this.formatTime(subtitle.startTime);
                const endTime = this.formatTime(subtitle.endTime);
                userMessageContent += `[${startTime}-${endTime}] ${subtitle.text}\n`;
              });
            } else {
              userMessageContent += `视频信息:\n`;
              userMessageContent += `标题: ${videoData.title}\n`;
              userMessageContent += `时长: ${videoData.duration}\n`;
              userMessageContent += `UP主: ${videoData.uploader}\n`;
              userMessageContent += `描述: ${videoData.video_info?.desc || '无描述'}\n`;
              userMessageContent += `注意: 该视频没有字幕信息\n`;
            }
            
            // 将包含字幕的用户消息添加到历史记录
            this.messages.push({ 
              role: 'user', 
              content: userMessageContent 
            });
            
            // 将视频分析结果作为AI回答返回
            const analysisResult = typeof toolResult.content === 'object' 
              ? toolResult.content.analysis || JSON.stringify(toolResult.content)
              : toolResult.content;
            
            console.log('[QwenProvider] 视频理解完成，返回分析结果');
            
            // 添加AI助手的响应到消息历史
            this.messages.push({
              role: 'assistant',
              content: analysisResult
            });
            
            console.log(`[QwenProvider] 视频分析结果已保存到messages历史，当前历史长度: ${this.messages.length}`);
            console.log(`[QwenProvider] 用户消息包含字幕信息，长度: ${userMessageContent.length} 字符`);
            console.log(`[QwenProvider] 最新助手消息预览: ${analysisResult.substring(0, 100)}...`);
            
            // 逐字输出分析结果
            for (let i = 0; i < analysisResult.length; i++) {
              this.handlers.onToken(analysisResult[i]);
              // 添加小的延迟以模拟打字效果
              await new Promise(resolve => setTimeout(resolve, 20));
            }
            
            this.handlers.onComplete(analysisResult);
          } else {
            // 处理工具执行错误
            const errorMessage = `视频分析失败: ${toolResult.error || toolResult.message || '未知错误'}`;
            console.error('[QwenProvider] 视频理解失败:', toolResult);
            
            this.messages.push({
              role: 'user',
              content: question
            });
            
            this.messages.push({
              role: 'assistant',
              content: errorMessage
            });
            
            console.log(`[QwenProvider] 视频分析错误信息已保存到messages历史，当前历史长度: ${this.messages.length}`);
            
            this.handlers.onToken(errorMessage);
            this.handlers.onComplete(errorMessage);
          }
        } catch (error) {
          console.error('[QwenProvider] 视频理解工具执行异常:', error);
          const errorMessage = `视频分析过程中出现异常: ${error instanceof Error ? error.message : '未知错误'}`;
          
          this.messages.push({
            role: 'user',
            content: question
          });
          
          this.messages.push({
            role: 'assistant',
            content: errorMessage
          });
          
          console.log(`[QwenProvider] 视频分析错误信息已保存到messages历史，当前历史长度: ${this.messages.length}`);
          
          this.handlers.onToken(errorMessage);
          this.handlers.onComplete(errorMessage);
        }
        
        return; // 视频处理完成，直接返回
      }
      
      // 普通文本消息处理
      // 添加用户消息到历史记录
      this.messages.push({ role: 'user', content: question });
      
      console.log(`[QwenProvider] 普通文本消息已添加到历史，当前历史长度: ${this.messages.length}`);
      console.log(`[QwenProvider] 当前对话历史摘要:`, 
        this.messages.slice(-3).map(msg => `${msg.role}: ${msg.content.substring(0, 50)}...`));
      
      await this.prepareMCPMode();

      // 创建客户端
      const qwenClient = this.createClient();
      console.log('[QwenProvider] 通义千问客户端创建成功');
      
      // 确定是否启用思考模式
      const enableThinking = !!context?.enableThinking;
      
      // 检查是否要使用MCP模式
      // const useMCPMode = !!context?.useMCP;
      
      let requestOptions: any = { 
        signal: this.requestConfig.signal,
        enableThinking: enableThinking,
        tools: this.tools,
        tool_choice: 'auto',
        parallel_tool_calls: true
      };
      
      // 发送请求
      const stream = await streamQwenCompletion(
        qwenClient,
        this.messages,
        this.requestConfig.modelName,
        requestOptions
      );
      
      console.log('[QwenProvider] 通义千问流式请求发送成功，开始接收响应');
      
      // 处理流式响应
      await this.handleStream(stream);
    } catch (error: any) {
      console.error('[QwenProvider] 通义千问请求失败:', error);
      
      // 检查是否有API响应错误
      if (error.response) {
        try {
          const errorText = await error.response.text();
          console.error('- API响应错误:', errorText);
        } catch (e) {
          console.error('- 无法读取API响应:', e);
        }
      }
      
      this.handlers.onError(error);
    }
  }
  
  /**
   * 准备MCP模式，连接MCP服务器，并准备工具
   */
  private async prepareMCPMode(): Promise<void> {
    try {
      console.log('[QwenProvider] 启用MCP模式，尝试连接MCP服务器');
      
      // 获取所有MCP服务器配置
      const mcpConfigs = await MCPService.getAllMCPServerConfigs();
      
      // 尝试依次连接MCP服务器
      let connectedServerName:string[] = [];
      
      // 遍历所有服务器配置尝试连接
      for (const mcpConfig of mcpConfigs) {
        if(this.isMcpServerExist[mcpConfig.name + mcpConfig.serverUrl]){
          continue;
        }
        this.isMcpServerExist[mcpConfig.name + mcpConfig.serverUrl] = true;
        try {
          console.log('[QwenProvider] 尝试连接MCP服务器:', 
            mcpConfig.name || mcpConfig.serverUrl);
          
          // 创建MCP客户端
          const mcpClient = await MCPService.createMCPClient(mcpConfig);
          await mcpClient.connect(mcpConfig);
          this.mcps.push(mcpClient);
          // 获取可用工具
          const tools = await mcpClient.listTools();
          const tool2mcpMap: {[name: string]: MCPClient} = {};  
          tools.forEach((tool: ChatCompletionTool) => {
            tool2mcpMap[tool.function.name] = mcpClient;
          });
          this.tools.push(...tools);
          this.toolsMap = {...this.toolsMap, ...tool2mcpMap};
          connectedServerName.push(mcpConfig.name || mcpConfig.serverUrl || '未命名服务器');
          console.log(`[QwenProvider] MCP服务器 "${mcpConfig.name || mcpConfig.serverUrl || '未命名服务器'}" 连接成功，可用工具:`, tools.map((t: ChatCompletionTool) => t.function.name).join(', '));
        } catch (error) {
          console.error(`[QwenProvider] 连接MCP服务器 "${mcpConfig.name || mcpConfig.serverUrl || '未命名服务器'}" 失败:`, error);
        }
      }
      console.log(`[QwenProvider] MCP模式已启用，服务器: ${connectedServerName.join(', ')}, 工具数量: ${this.tools.length}`);
    } catch (error: any) {
      console.error('[QwenProvider] MCP服务器连接失败:', error);
      this.handlers.onError(error);
      throw error;
    }
  }
  
  /**
   * 处理流式响应
   * @param stream The stream object from the API
   * @param existingReasoningContainerId Optional ID of an existing reasoning container to reuse
   * @param useExistingContainer Optional flag to indicate if an existing container ID is being used
   */
  protected async handleStream(
    stream: any, 
    existingReasoningContainerId?: string, 
    useExistingContainer?: boolean
  ): Promise<void> {
    let answerText = '';
    let reasoningText = ''; // Used to accumulate reasoning content within this stream part
    
    // Determine if we are using an existing container or creating a new one
    let currentReasoningContainerId = existingReasoningContainerId || '';
    let currentHasCreatedContainer = useExistingContainer || false;
    
    try {
      // Determine if thinking mode should be active for this part of the stream
      const enableThinkingForThisStream = this.requestConfig.enableThinking || false;
      
      // If thinking is enabled and no existing container is being used, create one now.
      if (enableThinkingForThisStream && !currentHasCreatedContainer) {
        currentReasoningContainerId = this.createThinkingContainer('通义千问思考过程');
        currentHasCreatedContainer = true;
      } else if (enableThinkingForThisStream && currentHasCreatedContainer) {
        // If using an existing container, we might want to add a separator or note
        this.handlers.onThinking("\n---\n继续思考...\n", currentReasoningContainerId);
      }
      
      const messageSender = async (content: string) => {
        this.handlers.onToken(content);
        return { success: true };
      };
      const customToolExecutor = new CustomToolExecutor(customTools, messageSender);
      
      let toolCallsInProgress = false;
      let currentToolCall: any = null;
      let currentToolCalls: any[] = [];
      let accumulatedContentForMessages = ''; // Content that will form the main part of the assistant's message
      let accumulatedReasoningForMessages = ''; // Reasoning content that will be part of the assistant's message
      
      for await (const chunk of stream as any) {
        // console.log('[QwenProvider] 收到通义千问原始响应块:', chunk);
        
        // Handle reasoning_content
        if (enableThinkingForThisStream && currentHasCreatedContainer) {
          let thinkingContentChunk = null;
          if (chunk.choices && chunk.choices[0]?.delta && (chunk.choices[0].delta as any).reasoning_content !== undefined && (chunk.choices[0].delta as any).reasoning_content !== null) {
            thinkingContentChunk = (chunk.choices[0].delta as any).reasoning_content;
          }
          if (thinkingContentChunk) {
            reasoningText += thinkingContentChunk;
            accumulatedReasoningForMessages += thinkingContentChunk;
            this.handlers.onThinking(thinkingContentChunk, currentReasoningContainerId);
          }
        }

        // Handle regular content
        let contentChunk = '';
        if (chunk.choices && chunk.choices[0]?.delta?.content !== undefined && !toolCallsInProgress) {
          contentChunk = chunk.choices[0].delta.content || '';
        }
        if (contentChunk) {
          answerText += contentChunk;
          accumulatedContentForMessages += contentChunk;
          this.handlers.onToken(contentChunk);
        }
        
        // Handle tool_calls
        if (this.tools && this.tools.length > 0 && chunk.choices && chunk.choices[0]?.delta?.tool_calls) {
          const toolCallDeltas = chunk.choices[0].delta.tool_calls;
          for (const toolCallDelta of toolCallDeltas) {
            if (chunk.choices[0].finish_reason === 'tool_calls') {
              toolCallsInProgress = true;
              continue;
            }
            if (toolCallDelta.function.name != null && toolCallDelta.function.name != "") {
              toolCallsInProgress = true;
              currentToolCall = {
                id: toolCallDelta.id,
                index: toolCallDelta.index,
                function: { name: toolCallDelta.function?.name || '', arguments: toolCallDelta.function?.arguments || '' }
              };
              currentToolCalls.push(currentToolCall);
              if (currentHasCreatedContainer) {
                this.handlers.onThinking(`\n正在准备工具调用 #${toolCallDelta.index + 1}: ${currentToolCall.function.name}\n参数: `, currentReasoningContainerId);
              }
              this.handlers.onToolCall(currentToolCall);
            } else if (currentToolCall) { // Ensure currentToolCall is not null
              currentToolCall.function.arguments += toolCallDelta.function.arguments;
              if (currentHasCreatedContainer) {
                this.handlers.onThinking(toolCallDelta.function.arguments, currentReasoningContainerId);
              }
            }
          }
        }
      }

      // After loop: if tool calls were made
      if (currentToolCalls.length > 0) {
        toolCallsInProgress = false;
        const assistantToolCalls = currentToolCalls.map(tc => ({ id: tc.id, type: "function", function: { name: tc.function.name, arguments: tc.function.arguments }, index: tc.index }));
        const toolResponses: Array<{role: string; tool_call_id: string; name: string; content: string;}> = [];
      
        for (const toolCall of currentToolCalls) {
          await this.executeToolCall(toolCall, customToolExecutor, this.toolsMap[toolCall.function.name], toolResponses, currentReasoningContainerId, currentHasCreatedContainer, existingReasoningContainerId);
        }
      
        if (toolResponses.length > 0) {
          // Pass accumulated reasoning and answer text from THIS stream part
          await this.handleToolResponses(toolResponses, assistantToolCalls, accumulatedReasoningForMessages, accumulatedContentForMessages, currentReasoningContainerId, currentHasCreatedContainer);
          return; // Important: The recursive call to handleStream will handle onComplete/onFinalUpdate
        }
      } else {
        this.messages.push({
          role: 'assistant',
          content: "<think>" + reasoningText + "</think>" + answerText,
        });
      }
    
      // If this stream is completing (no further tool calls from this part)
      if (reasoningText && currentHasCreatedContainer) {
        // This onFinalUpdate is for the reasoning text accumulated in *this* stream segment.
        // If it's part of a larger chain, the UI should just append.
        this.handlers.onFinalUpdate(reasoningText, currentReasoningContainerId);
      }
      
      // Only call onComplete if this is the end of the entire interaction chain
      // (i.e., no tool calls were made that will lead to another handleStream call)
      if (currentToolCalls.length === 0) {
          this.handlers.onComplete(answerText);
      }
      console.log('[QwenProvider] 通义千问流响应完成 (部分或全部), 总答案长度:', answerText.length);

    } catch (error: any) {
      console.error('[QwenProvider] 处理流式响应出错:', error);
      this.handlers.onError(error);
    }
  }
  
  /**
   * 执行单个工具调用
   * @param toolCall 工具调用对象
   * @param customToolExecutor 自定义工具执行器
   * @param mcpClient MCP客户端
   * @param mcpTools MCP工具列表
   * @param toolResponses 工具响应列表（将被修改）
   * @param reasoningContainerId 推理容器ID
   * @param hasCreatedReasoningContainer 是否已创建推理容器
   * @param existingReasoningContainerId 可选的现有推理容器ID（用于工具调用间的连续性）
   */
  private async executeToolCall(
    toolCall: any,
    customToolExecutor: CustomToolExecutor,
    mcpClient: MCPClient | null,
    toolResponses: any[],
    reasoningContainerId: string,
    hasCreatedReasoningContainer: boolean,
    existingReasoningContainerId?: string
  ): Promise<void> {
    try {
      let toolArgs: any = {};
      let rawArgs = toolCall.function.arguments || '';
      try {
        // 清理参数字符串中的尾随null字符和其他非法字符
        rawArgs = rawArgs.replace(/\u0000/g, ''); // 删除所有null字符
        
        // 查找最后一个有效的JSON闭合括号，删除之后的内容
        const lastBraceIndex = rawArgs.lastIndexOf('}');
        if (lastBraceIndex !== -1 && lastBraceIndex < rawArgs.length - 1) {
          const trailingChars = rawArgs.substring(lastBraceIndex + 1).trim();
          if (trailingChars.toLowerCase() === 'null' || trailingChars === '') {
            rawArgs = rawArgs.substring(0, lastBraceIndex + 1);
            console.log(`[QwenProvider] 清理后的工具参数: ${rawArgs}`);
          }
        }
        toolArgs = JSON.parse(rawArgs);
        console.log('[QwenProvider] 工具参数解析成功:', toolArgs);
      } catch (e) {
        console.error('[QwenProvider] 工具参数解析失败:', e, '原始参数:', toolCall.function.arguments, '处理后尝试解析:', rawArgs);
        // 后备方案：如果解析仍然失败，对于ask_question工具尝试用正则表达式提取问题
        if (toolCall.function.name === 'ask_question') {
          const questionMatch = /"question":\s*"(.*?)"/g.exec(toolCall.function.arguments || '');
          if (questionMatch && questionMatch[1]) {
            toolArgs = { question: questionMatch[1] };
            console.log('[QwenProvider] 后备方案: 通过正则表达式提取问题:', toolArgs.question);
          } else {
            toolArgs = { question: '请提供更多信息' }; // 如果正则也失败则使用默认值
          }
        } else {
          toolArgs = {}; // 其他工具解析失败时的默认值
        }
      }
      
      // 执行工具调用
      console.log(`[QwenProvider] 执行工具调用 #${toolCall.index + 1}:`, toolCall.function.name, toolArgs);
      
      // 更新思考容器显示工具调用执行中
      if (hasCreatedReasoningContainer) {
        // 使用提供的现有容器ID(如果有)，或默认的容器ID
        const containerToUse = existingReasoningContainerId || reasoningContainerId;
        this.handlers.onThinking(
          `\n\n执行工具调用 #${toolCall.index + 1}...\n`,
          containerToUse
        );
      }
      
      let toolResult: ToolResponse;
      // 检查是否为自定义工具
      if (customToolExecutor.isCustomTool(toolCall.function.name)) {
        // 如果是askQuestion工具，保存问题以等待用户回答
        if (toolCall.function.name === 'ask_question' && !toolArgs.user_response) {
          console.log('[QwenProvider] 检测到ask_question工具调用，保存问题等待用户回答');
          
          // 获取问题内容
          const question = toolArgs.question || '请提供更多信息';
          
          // 发送问题到前端UI以展示给用户
          chrome.runtime.sendMessage({
            type: 'AI_QUESTION_TO_USER',
            question: question,
            toolCallId: toolCall.id,
            originalResponseStreamId: this.responseStreamId,
            functionName: 'ask_question', // 添加functionName字段，与service worker中的结构匹配
          }, response => {
            console.log('[QwenProvider] AI_QUESTION_TO_USER sendMessage 回调被触发', '原始响应:', response);
            try {
              // 首先检查是否有错误
              if (chrome.runtime.lastError) {
                console.error('[QwenProvider] 发送AI_QUESTION_TO_USER时出错 (lastError):', chrome.runtime.lastError, '响应内容:', response);
                return;
              }
              console.log('[QwenProvider] AI问题发送响应:', response);
              if (response && response.success) {
                console.log('[QwenProvider] AI问题已成功发送到store并注册');
              } else {
                console.warn('[QwenProvider] AI问题发送响应异常:', response);
              }
            } catch (error) {
              console.error('[QwenProvider] 处理AI问题发送响应时出错:', error);
            }
          });
          
          console.log(`[QwenProvider] 已将AI问题发送到store: toolCallId=${toolCall.id}, question="${question}"`);
        
          // 重要：立即将这个临时工具响应添加到消息历史中，确保不丢失
          console.log("[QwenProvider] ask_question process: toolCall ", toolCall)
          this.messages.push({
            role: 'assistant',
            content: "",
            tool_calls: [toolCall]
          });
          
          // 更新思考容器显示等待用户回答
          if (hasCreatedReasoningContainer) {
            // 使用提供的现有容器ID(如果有)，或默认的容器ID
            const containerToUse = existingReasoningContainerId || reasoningContainerId;
            this.handlers.onThinking(
              `\n工具调用 #${toolCall.index + 1} 正在等待用户回答问题: "${question}"\n工具调用ID: ${toolCall.id}\n`,
              containerToUse
            );
          }
          
          // 不再继续执行工具，等待用户回答
          return;
        }
        
        // 调用自定义工具
        console.log(`[QwenProvider] 调用自定义工具: ${toolCall.function.name}`);
        toolResult = await customToolExecutor.executeTool(toolCall.function.name, toolArgs);
      } else {
        // 调用MCP工具
        if (!mcpClient) {
          throw new Error(`MCPClient not found for tool ${toolCall.function.name}. This tool might be a custom tool or MCP did not initialize correctly.`);
        }
        console.log(`[QwenProvider] 调用MCP工具: ${toolCall.function.name}`);
        const mcpResult = await mcpClient!.callTool(
          toolCall.function.name,
          toolArgs
        );
        
        // 将MCP结果转换为统一的ToolResponse格式
        toolResult = {
          status: 'success',
          content: mcpResult.content,
          message: mcpResult.message || "MCP工具执行成功"
        };
      }
      
      // 添加工具响应
      const toolResponse = {
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: typeof toolResult.content === 'string' 
          ? toolResult.content 
          : JSON.stringify(toolResult.content)
      };
      
      toolResponses.push(toolResponse);
      
      // 通知工具结果
      this.handlers.onToolResult(toolResult);
      
      // 更新思考容器显示工具调用结果
      if (hasCreatedReasoningContainer) {
        // 使用提供的现有容器ID(如果有)，或默认的容器ID
        const containerToUse = existingReasoningContainerId || reasoningContainerId;
        this.handlers.onThinking(
          `\n工具调用 #${toolCall.index + 1} 结果:\n${JSON.stringify(toolResult.content, null, 2)}\n`,
          containerToUse
        );
      }
    } catch (error: any) {
      console.error('[QwenProvider] 工具调用执行失败:', error);
      
      // 构造错误响应
      const errorToolResult: ToolResponse = {
        status: 'error',
        content: {
          error: true,
          message: error.message || '未知错误',
          details: error.stack || ''
        },
        error: error.message || '未知错误',
        message: `执行工具 ${toolCall.function.name} 失败`
      };
      
      // 添加错误响应
      const errorResponse = {
        role: 'tool',
        tool_call_id: toolCall.id,
        name: toolCall.function.name,
        content: JSON.stringify(errorToolResult.content)
      };
      
      toolResponses.push(errorResponse);
      
      // 更新思考容器显示工具调用错误
      if (hasCreatedReasoningContainer) {
        // 使用提供的现有容器ID(如果有)，或默认的容器ID
        const containerToUse = existingReasoningContainerId || reasoningContainerId;
        this.handlers.onThinking(
          `\n工具调用 #${toolCall.index + 1} 失败: ${errorToolResult.error}\n`,
          containerToUse
        );
      }
    }
  }
  
  /**
   * 处理工具响应
   * @param toolResponses 工具响应列表
   * @param assistantToolCalls 助手工具调用列表
   * @param reasoningText 推理文本
   * @param answerText 答案文本
   * @param reasoningContainerId 推理容器ID
   * @param hasCreatedReasoningContainer 是否已创建推理容器
   */
  private async handleToolResponses(
    toolResponses: Array<{role: string; tool_call_id: string; name: string; content: string;}>,
    assistantToolCalls: any[],
    reasoningText: string,
    answerText: string,
    reasoningContainerId: string,
    hasCreatedReasoningContainer: boolean
  ): Promise<void> {
    try {
      // Update thinking container (if it exists)
      if (hasCreatedReasoningContainer) {
        this.handlers.onThinking(
          `\n处理工具响应，准备生成最终回答...\n`,
          reasoningContainerId
        );
      }
      // Add prior reasoning and answer to messages if they exist
      if(reasoningText.length > 0){
        this.messages.push({
          role: 'assistant',
          content: "<think>" + reasoningText + "</think>" + (answerText || "") // Combine with any answer text gathered so far
        });
      } else if(answerText.length > 0) { // If no reasoning, but there was answer text
        this.messages.push({
          role: 'assistant',
          content: answerText
        });
      }

      // Filter out pending tool responses (should not happen here if logic is correct elsewhere, but good safeguard)
      const validToolResponses = toolResponses.filter(tr => {
        try {
          const content = JSON.parse(tr.content);
          return content.status !== 'pending';
        } catch (e) {
          return true; 
        }
      });

      if (validToolResponses.length === 0 && assistantToolCalls.length > 0) {
        console.log('[QwenProvider] 所有工具调用都处于待用户交互状态或无有效响应，不发送新请求');
        // If there was initial answerText, ensure it's completed.
        // Otherwise, if only reasoning or nothing, this stream leg might end here.
        if (answerText && !this.requestConfig.enableThinking) { 
            this.handlers.onComplete(answerText); 
        } else if (hasCreatedReasoningContainer && reasoningText) {
            this.handlers.onFinalUpdate(reasoningText, reasoningContainerId);
        }
        return;
      }

      this.messages.push(
        {
          role: 'assistant',
          content: null, // Qwen: content can be null when tool_calls are present
          tool_calls: assistantToolCalls
        },
        ...validToolResponses.map(tr => ({ 
            role: 'tool' as const, 
            tool_call_id: tr.tool_call_id, 
            content: tr.content,
            // name: tr.name // Qwen API for tool role message might not need/want name field
        }))
      );
      const qwenClient = this.createClient();

      let nextRequestOptions: any = {
        signal: this.requestConfig.signal,
        enableThinking: this.requestConfig.enableThinking, // Preserve original thinking mode setting
      };
      if(this.tools && this.tools.length > 0) {
        nextRequestOptions.tools = this.tools;
      }

      const toolResponseStream = await streamQwenCompletion(
        qwenClient,
        this.messages,
        this.requestConfig.modelName,
        nextRequestOptions
      );
      // Pass the existing reasoningContainerId and its status to the next handleStream call
      await this.handleStream(toolResponseStream, reasoningContainerId, hasCreatedReasoningContainer);
    } catch (error: any) {
      console.error('[QwenProvider] 处理工具响应失败:', error);
      this.handlers.onError(error);
    }
  }

  /**
   * 提交工具执行结果
   * 将用户对工具调用的响应发送回通义千问，以便AI继续对话
   */
  public async submitToolResult(toolCallId: string, result: string): Promise<void> {
    console.log(`[QwenProvider] submitToolResult 调用开始: toolCallId=${toolCallId}, result=${result.substring(0, 50)}...`);
    try {
      console.log(`[QwenProvider] 提交工具结果: toolCallId=${toolCallId}, result=${result}`);
      
      // 检查是否有匹配的工具调用ID
      if (!toolCallId) {
        throw new Error('工具调用ID不能为空');
      }

      // 记录当前消息数组状态，用于调试
      console.log(`[QwenProvider] 当前消息历史长度: ${this.messages.length}`);
      let foundToolCall = false;
      
      // 查找与用户回答相关的思考容器ID
      let existingReasoningContainerId = '';
      let hasCreatedReasoningContainer = false;
      
      this.messages.forEach((msg, index) => {
        if (msg.role === 'tool' && msg.tool_call_id === toolCallId) {
          console.log(`[QwenProvider] 找到匹配的工具调用: index=${index}, id=${msg.tool_call_id}`);
          foundToolCall = true;
          
          // 通过分析前面的消息尝试寻找思考容器ID
          // 一般来说，在工具调用之前会有一个assistant消息包含思考内容
          if (index > 0 && this.messages[index-1].role === 'assistant') {
            const assistantContent = this.messages[index-1].content || '';
            if (typeof assistantContent === 'string' && assistantContent.includes('thinking-container')) {
              // 通过正则表达式尝试提取容器ID
              const containerMatch = /container-([a-zA-Z0-9-_]+)/g.exec(assistantContent);
              if (containerMatch && containerMatch[1]) {
                existingReasoningContainerId = containerMatch[1];
                hasCreatedReasoningContainer = true;
                console.log(`[QwenProvider] 找到与工具调用关联的思考容器ID: ${existingReasoningContainerId}`);
              }
            }
          }
        }
      });

      if (!foundToolCall) {
        console.warn(`[QwenProvider] 在消息历史中未找到匹配的工具调用ID: ${toolCallId}`);
      }

      // 检查消息历史中是否已存在这个工具调用的响应
      const existingToolResponseIndex = this.messages.findIndex(msg => 
        msg.role === 'tool' && msg.tool_call_id === toolCallId
      );

      // 获取原始问题内容（如果有）
      let originalQuestion = '您的问题';
      if (existingToolResponseIndex !== -1) {
        try {
          const pendingResponse = this.messages[existingToolResponseIndex];
          console.log(`[QwenProvider] 找到临时工具响应: index=${existingToolResponseIndex}`, pendingResponse);
          const content = JSON.parse(pendingResponse.content);
          if (content.question) {
            originalQuestion = content.question;
          }
        } catch (e) {
          console.error('[QwenProvider] 无法解析工具响应内容:', e);
        }

        // 移除临时响应
        console.log(`[QwenProvider] 移除临时工具响应: index=${existingToolResponseIndex}`);
        this.messages.splice(existingToolResponseIndex, 1);
      } else {
        console.warn(`[QwenProvider] 未找到匹配的工具调用ID: ${toolCallId}`);
        // 即使找不到对应记录，仍然尝试处理响应
      }
      
      // 通知处理器有工具结果
      this.handlers.onToolResult({
        toolCallId,
        result
      });
      
      // 发送流开始消息，使UI创建新的消息气泡
      chrome.runtime.sendMessage({
        type: 'STREAM_START',
        id: this.responseStreamId,
        responseStreamId: this.responseStreamId
      });
      
      // 通知思考容器显示用户回答信息（如果存在）
      if (hasCreatedReasoningContainer && existingReasoningContainerId) {
        this.handlers.onThinking(
          `\n接收到用户回答: "${result}"\n`,
          existingReasoningContainerId
        );
      }
      
      // 如果是ask_question工具，构造带有用户回答的参数
      const toolArgs = {
        question: originalQuestion, // 现在使用记录的原始问题
        user_response: result
      };
      
      // 获取自定义工具执行器
      const customToolExecutor = new CustomToolExecutor(customTools, async (content: string) => {
        this.handlers.onToken(content);
        return true;
      });
      
      // 执行ask_question工具，传入用户回答
      const toolResult = await customToolExecutor.executeTool('ask_question', toolArgs);
      console.log('[QwenProvider] 使用用户回答重新执行ask_question工具结果:', toolResult);
      
      // 将结果作为工具调用结果添加到消息历史
      const toolResponse = {
        role: 'tool',
        tool_call_id: toolCallId,
        content: typeof toolResult.content === 'string' 
          ? toolResult.content 
          : JSON.stringify(toolResult.content)
      };
      
      console.log("[QwenProvider] submitToolResult process: toolResponse ", toolResponse)
      
      // 创建客户端
      const qwenClient = this.createClient();
      
      // 将工具调用结果添加到消息历史
      this.messages.push(toolResponse);

      let nextRequestOptions: any = {
        signal: this.requestConfig.signal,
        enableThinking: this.requestConfig.enableThinking,
      };
      if (this.tools && this.tools.length > 0) {
        nextRequestOptions.tools = this.tools;
      }
      
      // 发送带有工具结果的请求
      console.log(`[QwenProvider] submitToolResult 即将调用 streamQwenCompletion: toolCallId=${toolCallId}`);
      const stream = await streamQwenCompletion(
        qwenClient,
        this.messages,
        this.requestConfig.modelName,
        nextRequestOptions
      );
      
      // 处理返回的流，传递已存在的思考容器ID和状态以确保连续性
      await this.handleStream(stream, existingReasoningContainerId, hasCreatedReasoningContainer);
      
    } catch (error: any) {
      console.error('[QwenProvider] 提交工具结果失败:', error);
      this.handlers.onError(error);
    }
  }

  /**
   * 销毁实例，清理资源
   * 重写基类方法，确保MCP客户端正确关闭
   */
  public override destroy(): void {
    // 关闭所有MCP客户端连接
    if (this.mcps.length > 0) {
      console.log(`[QwenProvider] 正在关闭 ${this.mcps.length} 个MCP客户端连接`);
      
      this.mcps.forEach(async (client) => {
        try {
          await client.close();
          console.log(`[QwenProvider] MCP客户端已关闭`);
        } catch (error) {
          console.error(`[QwenProvider] 关闭MCP客户端时出错:`, error);
        }
      });
      
      // 清空MCP客户端列表
      this.mcps = [];
      this.toolsMap = {};
      this.tools = [...customTools]; // 仅保留自定义工具
      console.log(`[QwenProvider] 已清空MCP客户端列表`);
    }
    
    // 调用基类销毁方法
    super.destroy();
  }

  /**
   * 格式化时间（秒转为 mm:ss 格式）
   */
  private formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  }
}