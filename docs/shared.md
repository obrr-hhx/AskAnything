# 共享模块 (`src/shared/`)

`src/shared/` 目录包含项目中多个部分（如 Service Worker, Sidepanel, Options Page）共用的代码、工具函数、类型定义和配置。

## 主要文件及其功能

1.  **`models.ts`**: 
    *   定义了项目中核心的 TypeScript 数据结构和类型。
    *   例如：`ChatMessage` (聊天消息的结构), `ChatHistory` (聊天历史记录的结构), `AIModel` (支持的AI模型枚举或类型), `ContextData` (页面上下文数据的结构), `APIProvider` (API提供商类型) 等。
    *   这些类型确保了项目不同部分之间数据交换的一致性。

2.  **`history.ts`**: 
    *   封装了与浏览器本地存储 (`chrome.storage.local`) 交互以管理聊天历史记录的逻辑。
    *   提供函数如：
        *   `getChatHistory()`: 从存储中加载所有聊天历史会话。
        *   `addChatSession(messages: ChatMessage[], model: AIModel)`: 将当前的聊天会话（消息列表和使用的模型）保存到历史记录中。
        *   `searchChatHistory(query: string)`: (推测) 根据查询词搜索历史记录。
        *   `clearChatHistory()`: 清除所有存储的聊天历史。
    *   这些函数被侧边栏的 `store.ts` 调用以实现历史记录功能。

3.  **`settings.ts`**: 
    *   封装了与浏览器同步存储 (`chrome.storage.sync`) 交互以管理用户设置的逻辑。
    *   提供函数如：
        *   `getSettings()`: 从存储中加载用户的设置（例如，`preferredModel`）。
        *   `setPreferredModel(model: AIModel)`: 将用户偏好的AI模型保存到存储中。
    *   这些函数被侧边栏的 `store.ts` 和 Service Worker 调用。

4.  **`api-clients.ts`**: 
    *   （推测）包含与不同第三方AI服务API进行通信的底层客户端逻辑。
    *   可能封装了 `fetch` 请求、认证头设置、请求体构建以及对特定API响应格式的初步处理。
    *   这些客户端可能被 Service Worker 中的 `StreamService` 或 `ProviderFactory` 使用。

5.  **`custom-tools.ts`**: 
    *   （推测）定义了AI模型在特定情况下可以调用的自定义工具函数。
    *   例如，如果AI需要执行网页搜索或获取实时信息，这里可能包含了实现这些功能的函数，以及它们如何被AI的工具调用机制触发和返回结果的逻辑。
    *   Service Worker 在处理AI响应时，如果检测到工具调用请求，可能会调用此文件中的相应函数。

6.  **`mcp-client.ts`**: 
    *   （推测）与模型通信协议 (Model Communication Protocol - MCP) 相关的客户端实现。
    *   如果项目支持通过MCP与某些模型或服务进行交互，此文件将包含建立连接、发送消息、接收响应等逻辑。

## 重要性

共享模块通过提供集中的、可重用的功能和类型定义，减少了代码重复，提高了代码的可维护性，并确保了项目各个部分之间数据和行为的一致性。

*本文档基于对 `src/shared/` 目录下文件名的推测和常见项目实践的分析，具体实现可能包含更多细节或略有不同。* 