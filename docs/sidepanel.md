# 侧边栏 (Sidepanel - `src/sidepanel/`)

侧边栏是 AskAnything 的主要用户交互界面，它作为一个独立的 HTML 页面 (`src/sidepanel/index.html`) 在浏览器的侧边区域打开。该界面使用 **React** 构建，并采用 **Zustand** (`src/sidepanel/store.ts`) 进行状态管理。

## 主要组件与功能

1.  **`App.tsx` (根组件)**:
    *   **布局**: 定义了侧边栏的基本布局，包括一个固定的头部 (`app-header`) 和一个可滚动的内容区域 (`app-main`)。
    *   **头部 (`app-header`)**:
        *   显示应用标题 (例如 "AskAnything")。
        *   包含一个 `ModelSelector` 组件，允许用户选择要使用的AI模型。
        *   提供一个设置按钮，点击后会调用 `chrome.runtime.openOptionsPage()` 打开扩展的选项页面，供用户配置API密钥等。
    *   **主内容区 (`app-main`)**:
        *   在状态初始化完成 (`isReady`) 后，渲染核心的 `ChatInterface` 组件。
        *   在初始化期间显示 "加载中..." 状态。
    *   **初始化**: 在 `useEffect` Hook 中调用 `initializeStore()` (来自 `store.ts`) 来加载初始状态、用户设置和历史记录，并设置与Service Worker的消息监听器。
    *   启动时会向 Service Worker 请求当前活动标签页的上下文信息。

2.  **`store.ts` (Zustand 状态管理)**:
    *   **状态 (State)**: 集中管理了侧边栏应用的所有动态数据，包括：
        *   `messages`: 当前聊天会话的消息列表 (用户输入和AI回复)。
        *   `isLoading`:布尔值，指示当前是否正在等待AI响应。
        *   `currentStreamId`: 当前活动的AI响应流的ID，用于跟踪和中止。
        *   `currentModel`: 用户当前选择的AI模型。
        *   `currentContext`: 从内容脚本或上下文菜单获取的页面上下文信息（如选中文本、URL、标题）。
        *   `enableThinking`, `useMCPMode`: 控制特定高级功能（如显示思考过程、使用MCP协议）的开关状态。
        *   `history`: 从 `chrome.storage.local` 加载的聊天历史记录列表。
        *   `isLoadingHistory`, `searchQuery`: 历史记录加载状态和搜索查询词。
    *   **操作 (Actions)**: 定义了用于修改状态的各种函数：
        *   消息管理: `setMessages`, `addMessage` (添加新消息), `updateLastMessage` (追加AI流式响应的token), `clearMessages`。
        *   模型与上下文: `setModel` (切换AI模型并保存偏好), `setContext`。
        *   模式切换: `toggleThinking`, `toggleMCPMode`。
        *   历史记录: `loadHistory` (加载), `saveSessionToHistory` (保存当前会话), `searchHistory`, `loadSessionFromHistory` (从历史恢复会话), `clearHistory`。这些函数通常会调用 `src/shared/history.ts` 中的辅助函数与浏览器存储交互。
    *   **Service Worker 通信 (导出函数)**:
        *   `sendQuestion(question: string)`: 核心函数，当用户提交问题时被调用。它会收集当前聊天状态、选定模型、上下文信息，然后构造一个 `ASK_QUESTION` 类型的消息发送给 Service Worker。
        *   `stopGeneration()`: 当用户请求停止AI响应时，发送 `STOP_GENERATION` 消息给 Service Worker (包含 `currentStreamId`)。
        *   `answerAIQuestion(userResponse: string)`: 当AI通过工具调用向用户提问，并且用户提供了回答后，此函数会将用户的回答通过 `ANSWER_AI_QUESTION` 消息发送给Service Worker。
    *   **消息监听器 (`setupMessageListener` / `chrome.runtime.onMessage`)**: 监听来自 Service Worker 的消息，并根据消息类型更新 Zustand store 中的状态，从而驱动UI变化：
        *   `CONTEXT_SELECTION`: 接收到通过右键菜单选中的文本，并更新 `currentContext`。
        *   `STREAM_START`: AI开始流式响应。UI进入加载状态，并准备接收tokens。
        *   `ANSWER_TOKEN`: 收到AI响应的文本片段 (token)，追加到聊天记录的最后一条AI消息中。
        *   `STREAM_END`: AI响应流结束。UI退出加载状态。如果不是被用户手动停止的，则当前会话会被保存到历史记录。
        *   `STREAM_ERROR`: AI响应过程中发生错误。在UI上显示错误信息，并退出加载状态。
        *   `AI_QUESTION_TO_USER`: AI通过工具调用向用户提问。在聊天界面显示AI的问题，并允许用户输入回答。
        *   `UPDATE_REASONING`, `CREATE_THINKING_CONTAINER`: （如果启用了思考模式）用于在UI上动态创建和更新显示AI思考过程的区域。
        *   `CLOSE_SIDEPANEL_COMMAND`: 收到Service Worker发来的关闭指令。如果当前有正在进行的AI请求，会先尝试停止，然后调用 `window.close()` 关闭侧边栏。
    *   **初始化函数 (`initializeStore`)**: 在侧边栏加载时被 `App.tsx` 调用，负责从 `chrome.storage.sync` 加载用户设置（如偏好的AI模型），从 `chrome.storage.local` 加载聊天历史，并设置好消息监听器。

3.  **`components/` 目录**:
    *   包含构成侧边栏界面的可重用React组件，例如：
        *   `ChatInterface.tsx`: 核心聊天界面，负责展示消息列表、用户输入框、发送按钮、停止按钮等。
        *   `ModelSelector.tsx`: 模型选择下拉菜单。
        *   `MarkdownRenderer.tsx`: (推测) 用于将AI返回的Markdown格式的响应渲染成HTML。
        *   `HistoryList.tsx`: (推测) 用于展示和与聊天历史记录交互的组件。
        *   `MCPToolsViewer.tsx`: (推测) 可能用于展示MCP协议相关的工具调用信息。

## 工作流程示例 (用户提问)

1.  用户在 `ChatInterface` 的输入框中输入问题，点击发送。
2.  `ChatInterface` 调用 `store.ts` 中的 `sendQuestion()` 函数。
3.  `sendQuestion()` 从Zustand store获取当前状态（消息历史、选定模型、上下文），然后向Service Worker发送 `ASK_QUESTION` 消息。
4.  Service Worker 处理该请求，并开始与AI模型交互。
5.  Service Worker 通过消息将 `STREAM_START`, `ANSWER_TOKEN`, `STREAM_END`/`STREAM_ERROR` 等事件发送回侧边栏。
6.  侧边栏的 `store.ts` 中的消息监听器接收这些事件，更新Zustand store中的状态。
7.  React组件 (如 `ChatInterface`) 响应Zustand store的状态变化，自动重新渲染以显示最新的聊天内容、加载状态等。

*本文档基于对 `src/sidepanel/` 目录结构和关键文件代码的分析，具体实现可能包含更多细节。*
