import { v4 as uuidv4 } from 'uuid';
import { ChatCompletionTool } from 'openai/resources/chat/completions';

/**
 * 工具调用类型定义
 * 表示一个已经解析的工具调用请求
 */
export type ToolCall = {
    /** 工具调用的索引 */
    index: number;
    /** 工具调用的唯一ID */
    id: string;
    /** 被调用的工具名称 */
    name: string;
    /** 工具调用的参数，通常是JSON字符串 */
    args: string;
};

/**
 * 工具响应统一类型定义
 * 所有工具必须返回此类型的结果，确保结果格式一致
 */
export type ToolResponse = {
    /** 
     * 响应状态:
     * - success: 成功完成
     * - error: 执行出错
     * - pending: 等待中/未完成
     * - completed: 任务标记为已完成
     */
    status: 'success' | 'error' | 'pending' | 'completed';
    
    /** 
     * 结果内容，可以是字符串或对象
     * 对于错误状态，可能为null
     */
    content: any;
    
    /** 可选的描述信息，用于提供更多上下文 */
    message?: string;
    
    /** 可选的错误信息，仅在status为error时使用 */
    error?: string;
    
    /** 工具特定的元数据，可用于传递额外信息 */
    metadata?: Record<string, any>;
};

// 任务完成工具
export const taskCompletionTool: ChatCompletionTool = {
    type: "function",
    function: {
        name: "task_complete",
        description: "当用户的任务完成时调用此工具",
        parameters: {
            type: "object",
            properties: {},
        },
    },
};

// 提问工具
export const askQuestionTool: ChatCompletionTool = {
    type: "function",
    function: {
        name: "ask_question",
        description: "向用户提问以获取更多信息，解决或澄清他们的问题，尤其是在用户询问的问题中带有调研，研究等深度研究的词汇时，请使用此工具，列出所有问题，并等待用户回答",
        parameters: {
            type: "object",
            properties: {
                question: {
                    type: "string",
                    description: "要向用户提出的问题"
                }
            },
            required: ["question"]
        },
    },
};

// 网络搜索工具
export const webSearchTool: ChatCompletionTool = {
    type: "function",
    function: {
        name: "web_search",
        description: "搜索网络获取信息",
        parameters: {
            type: "object",
            properties: {
                search_engine: {
                    type: "string",
                    description: "使用的搜索引擎，search_std为智谱基础搜索引擎，search_pro为智谱高级搜索引擎，search_pro_sogou为搜狗搜索引擎，search_pro_quark为夸克搜索引擎，search_pro_jina为Jina搜索引擎，search_pro_bing为Bing搜索引擎",
                    enum: ["search_std", "search_pro", "search_pro_sogou", "search_pro_quark", "search_pro_jina", "search_pro_bing"],
                },
                search_query: {
                    type: "string",
                    description: "要搜索的内容，搜索查询不应超过78个字符，必须使用中文"
                }
            },
            required: ["search_engine", "search_query"]
        },
    },
};

// 图片理解工具
export const imageUnderstandingTool: ChatCompletionTool = {
    type: "function",
    function: {
        name: "understand_image",
        description: "分析和理解用户上传的图片内容，提供详细的描述和解读",
        parameters: {
            type: "object",
            properties: {
                image_url: {
                    type: "string",
                    description: "图片的base64数据URL或网络URL"
                },
                question: {
                    type: "string", 
                    description: "用户对图片提出的具体问题，如果没有具体问题则使用'请描述这张图片'"
                }
            },
            required: ["image_url"]
        },
    },
};

// 所有自定义工具列表
export const customTools = [taskCompletionTool, askQuestionTool, webSearchTool, imageUnderstandingTool];

// 生成唯一用户ID
const user_id = uuidv4();

// 网络搜索工具实现
export async function webSearch(toolArg: any): Promise<ToolResponse> {
    const http_endpoint = "https://open.bigmodel.cn/api/paas/v4/web_search";
    
    // 获取API密钥
    const data = await chrome.storage.local.get(['apiKeys']);
    const apiKeys = data.apiKeys || {};
    const api_key = apiKeys['zhipu'] || '';
    
    if(!api_key) {
        return {
            status: 'error',
            content: null,
            error: "未设置智谱API密钥",
            message: "请在选项页面设置智谱API密钥"
        };
    }

    toolArg["request_id"] = toolArg["request_id"] || uuidv4();
    toolArg["user_id"] = user_id;
    
    console.log("[浏览器扩展] 执行网络搜索:", toolArg);

    try {
        const response = await fetch(http_endpoint, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${api_key}`
            },
            body: JSON.stringify(toolArg)
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            return {
                status: 'error',
                content: null,
                error: `搜索请求失败: ${response.status} ${response.statusText}`,
                message: errorText
            };
        }
        
        const data = await response.json();
        return {
            status: 'success',
            content: data,
            metadata: {
                answer_require: "回答用户时，请附上参考链接"
            }
        };
    } catch (error) {
        console.error("[浏览器扩展] 网络搜索失败:", error);
        return {
            status: 'error',
            content: null,
            error: error instanceof Error ? error.message : String(error),
            message: "搜索过程中发生错误"
        };
    }
}

// 向用户提问工具实现
export async function askQuestion(toolArg: any, sendMessage: (content: string) => Promise<any>): Promise<ToolResponse> {
    // 获取问题和用户回答
    const question = toolArg.question || "请提供更多信息";
    const user_response = toolArg.user_response || null;
    
    try {
        // 如果有用户回答，说明这是第二次调用（携带了用户的回答）
        if (user_response) {
            console.log("[askQuestion工具] 收到用户回答:", user_response);
            // 返回问题和用户回答的组合结果
            return {
                status: 'success',
                content: { 
                    question,
                    user_response 
                },
                message: "用户已回答问题"
            };
        }
        
        // 这是第一次调用，只发送问题
        console.log("[askQuestion工具] 向用户发送问题:", question);
        await sendMessage(`【AI提问】${question}`);
        
        // 返回pending状态，表示等待用户回复
        return {
            status: 'pending',
            content: { question },
            message: "问题已发送给用户，等待用户回复"
        };
    } catch (error) {
        console.error("[askQuestion工具] 发送问题失败:", error);
        return {
            status: 'error',
            content: null,
            error: error instanceof Error ? error.message : String(error),
            message: "发送问题到界面失败"
        };
    }
}

// 任务完成工具实现
export async function taskComplete(): Promise<ToolResponse> {
    return {
        status: 'completed',
        content: { completed: true },
        message: "任务已完成，无需调用其他工具，直接回答用户"
    };
}

// 图片理解工具实现
export async function understandImage(toolArg: any): Promise<ToolResponse> {
    try {
        console.log("[图片理解工具] 开始分析图片");
        
        // 获取API密钥 - 修正为使用qwen而不是qwen3
        const data = await chrome.storage.local.get(['apiKeys']);
        const apiKeys = data.apiKeys || {};
        const api_key = apiKeys['qwen3'] || '';
        
        if (!api_key) {
            return {
                status: 'error',
                content: null,
                error: "未设置通义千问API密钥",
                message: "请在选项页面设置通义千问API密钥以使用图片理解功能"
            };
        }

        const image_url = toolArg.image_url;
        const question = toolArg.question || "请详细描述这张图片的内容";

        if (!image_url) {
            return {
                status: 'error',
                content: null,
                error: "缺少图片URL",
                message: "请提供要分析的图片"
            };
        }

        // 调用DashScope VLM API - 修正为正确的格式
        const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${api_key}`
            },
            body: JSON.stringify({
                model: "qwen-vl-plus",
                messages: [
                    {
                        role: "system",
                        content: [
                            {
                                type: "text", 
                                text: "你是一个有帮助的AI助手，擅长分析和描述图片内容。"
                            }
                        ]
                    },
                    {
                        role: "user",
                        content: [
                            {
                                type: "image_url",
                                image_url: {
                                    url: image_url
                                }
                            },
                            {
                                type: "text",
                                text: question
                            }
                        ]
                    }
                ]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("[图片理解工具] API请求失败:", errorText);
            return {
                status: 'error',
                content: null,
                error: `DashScope API请求失败: ${response.status} ${response.statusText}`,
                message: errorText
            };
        }

        const result = await response.json();
        console.log("[图片理解工具] API响应:", result);

        // 修正响应解析 - 直接使用choices而不是output.choices
        if (result.choices && result.choices[0]) {
            const analysis = result.choices[0].message.content;
            return {
                status: 'success',
                content: {
                    analysis,
                    image_url: image_url,
                    question: question
                },
                message: "图片分析完成"
            };
        } else {
            return {
                status: 'error',
                content: null,
                error: "API返回格式异常",
                message: "无法解析图片分析结果"
            };
        }

    } catch (error) {
        console.error("[图片理解工具] 执行失败:", error);
        return {
            status: 'error',
            content: null,
            error: error instanceof Error ? error.message : String(error),
            message: "图片分析过程中发生错误"
        };
    }
}

// 自定义工具执行器类
export class CustomToolExecutor {
    private tools: ChatCompletionTool[];
    private toolsMap: {[name: string]: Function};
    private messageSender: (content: string) => Promise<any>;
    
    constructor(tools: ChatCompletionTool[], messageSender: (content: string) => Promise<any>) {
        this.tools = tools;
        this.messageSender = messageSender;
        
        // 初始化工具映射
        this.toolsMap = {
            "web_search": webSearch,
            "ask_question": (args: any) => askQuestion(args, this.messageSender),
            "task_complete": taskComplete,
            "understand_image": understandImage
        };
    }

    // 检查是否为自定义工具
    isCustomTool(toolName: string): boolean {
        return this.toolsMap[toolName] ? true : false;
    }

    // 获取所有自定义工具
    getTools(): ChatCompletionTool[] {
        return this.tools;
    }

    // 执行自定义工具
    async executeTool(toolName: string, toolArg: any): Promise<ToolResponse> {
        if (this.toolsMap[toolName]) {
            console.log(`[浏览器扩展] 执行自定义工具: ${toolName}`);
            try {
                return await this.toolsMap[toolName](toolArg);
            } catch (error) {
                console.error(`[浏览器扩展] 执行工具 ${toolName} 失败:`, error);
                return {
                    status: 'error',
                    content: null,
                    error: error instanceof Error ? error.message : String(error),
                    message: `执行工具 ${toolName} 时发生错误`
                };
            }
        }
        
        return {
            status: 'error',
            content: null,
            error: `未找到名为 ${toolName} 的工具`,
            message: `未在工具映射中找到 ${toolName} 工具`
        };
    }
} 