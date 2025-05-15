# Service Worker (`service-worker.ts`)

Service Worker 是 AskAnything 扩展的后台核心脚本。它在浏览器后台持续运行（除非被挂起），负责处理核心逻辑、事件管理和与扩展其他部分的通信。

## 主要职责

1.  **初始化与设置**:
    *   在扩展安装或更新时 (`chrome.runtime.onInstalled`)：
        *   注册右键上下文菜单项 "AskAnything: %s"，允许用户通过选择文本快速提问。
        *   初始化并设置默认的AI模型（例如，'chatgpt'）。

2.  **事件监听与处理**:
    *   **上下文菜单点击 (`chrome.contextMenus.onClicked`)**: 当用户点击通过选中文本触发的上下文菜单时，Service Worker 会打开侧边栏，并将选中的文本作为上下文传递给侧边栏。
    *   **消息处理 (`chrome.runtime.onMessage`)**: 监听并处理来自扩展其他部分（如侧边栏、内容脚本）的消息。这是各组件间通信的主要方式。
        *   `OPEN_SIDEPANEL`: 响应打开侧边栏的请求。
        *   `CLOSE_SIDEPANEL_REQUEST`: 处理关闭侧边栏的请求。
        *   `SET_MODEL`: 接收并存储用户选择的AI模型配置到 `chrome.storage.sync`。
        *   `GET_PAGE_INFO`: 请求内容脚本提供当前页面的URL和标题等信息。
        *   `ASK_QUESTION`: 这是核心的提问处理流程。
            *   接收来自侧边栏的问题、上下文信息和选定模型。
            *   调用 `StreamService` 来处理与后端AI模型的流式通信。
        *   `STOP_GENERATION`: 接收停止当前AI响应生成的请求，并通知 `StreamService` 中止相应的流。
        *   `TEST_MCP_SERVER`: （推测）用于测试与模型通信协议 (MCP) 服务器的连接状态。
        *   `ANSWER_AI_QUESTION`: 处理用户对AI通过工具调用提出的问题的回答，并将回答提交给相应的AI Provider。
    *   **快捷键命令 (`chrome.commands.onCommand`)**: 监听通过快捷键（如扩展的默认操作按钮）触发的命令，通常用于快速打开侧边栏。

3.  **AI交互管理 (`StreamService`)**:
    *   Service Worker 依赖 `StreamService` 来管理与不同AI模型提供商的流式数据交换。
    *   `StreamService` 负责建立连接、发送请求、接收和解析流式响应，并将数据块（tokens）、思考过程更新、工具调用请求、错误或完成信号通过消息传递给侧边栏进行展示。
    *   支持中止正在进行的AI响应流。

4.  **配置与服务获取**:
    *   使用 `ConfigService` 获取AI模型的API密钥和端点配置。
    *   使用 `ProviderFactory` 根据选定的模型创建相应的AI服务提供者实例，以处理特定模型的API交互。

5.  **状态与周期管理**:
    *   通过 `StreamService.cleanupExpiredStreams` 定期清理可能已过期或未正常关闭的AI响应流，以释放资源。

## 通信机制

Service Worker 主要通过 `chrome.runtime.sendMessage` 和 `chrome.runtime.onMessage` 与侧边栏 (Sidepanel) 和内容脚本 (Content Script) 进行双向通信。

*本文档基于对 `src/service-worker.ts` 代码的分析，具体实现可能包含更多细节。* 