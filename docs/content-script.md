# 内容脚本 (`content-script.ts`)

内容脚本 (Content Script) 是注入到用户浏览的网页上下文中的 JavaScript 文件。它允许扩展读取和修改网页的DOM，并与父扩展（主要是Service Worker）进行通信。

## 主要职责

1.  **浮动操作按钮 (FAB) 管理**:
    *   **创建与注入**: 在非iframe的顶层页面动态创建并注入一个浮动操作按钮 (ID: `ai-sidepanel-fab`) 到页面的右侧。
    *   **外观与交互**:
        *   按钮具有可拖拽功能。
        *   按钮的背景色会根据系统是否处于暗色模式 (`prefers-color-scheme: dark`) 或页面是否包含特定暗色主题类名进行调整 (`updateButtonTheme`)。
        *   包含悬停效果。
    *   **点击事件**: 当用户点击浮动按钮时：
        *   调用 `getDeepSelection()` 获取当前页面（包括iframe）中用户选择的文本。
        *   获取当前页面的 URL 和标题。
        *   向 Service Worker 发送 `CLOSE_SIDEPANEL_REQUEST` 消息（推测是为了确保唯一性）。
        *   接着向 Service Worker 发送 `OPEN_SIDEPANEL` 消息，并附带收集到的上下文信息（选中文本、URL、标题），请求打开侧边栏。

2.  **页面信息提取**:
    *   **`getDeepSelection()`**: 一个核心辅助函数，用于智能地获取用户在页面上选择的文本。它会尝试从顶层窗口获取选区，如果失败，则会遍历所有子 frames (iframes) 来查找选区，这对于处理例如嵌入式PDF阅读器中的选区非常有用。
    *   响应来自 Service Worker 的 `GET_PAGE_INFO` 消息，返回当前页面的 URL 和标题。
    *   响应来自 Service Worker 的 `GET_SELECTION` 消息，调用 `getDeepSelection()` 并返回选中的文本以及页面 URL 和标题。

3.  **与 Service Worker 通信**:
    *   使用 `chrome.runtime.sendMessage` 向 Service Worker 发送消息（如打开侧边栏、传递上下文）。
    *   使用 `chrome.runtime.onMessage` 监听来自 Service Worker 的消息（如请求页面信息）。

4.  **环境与状态处理**:
    *   **初始化 (`init`)**: 在 `DOMContentLoaded` 事件触发后或文档已加载时执行初始化逻辑，包括创建按钮和设置监听器。
    *   **iframe检测**: 在执行主要功能（如创建FAB、设置DOM观察器）之前，会检查当前脚本是否运行在 iframe 中。如果是，则通常会跳过这些操作，以避免在嵌入式内容中产生不必要的副作用。
    *   **DOM变动观察 (`setupDomObserver`)**: 设置一个 `MutationObserver` 来监控整个文档的DOM变化（如子节点增删、属性更改）。当前主要用于日志记录DOM变动情况，但未来可用于更复杂的上下文感知功能。
    *   **错误通知 (`showErrorNotification`)**: 如果在与扩展核心通信或执行操作时发生错误（例如扩展上下文失效），会在页面顶部显示一个临时的错误通知。
    *   **扩展上下文检查 (`isExtensionContextValid`)**: 在发送消息或执行敏感操作前，会检查 `chrome.runtime.id` 是否可访问，以判断扩展上下文是否依然有效。

## 注意事项

*   Content Script 在一个与网页隔离但又可以访问其DOM的环境中运行。
*   所有与浏览器API的交互（如存储、打开侧边栏的最终决策）通常通过消息传递给Service Worker来完成。

*本文档基于对 `src/content-script.ts` 代码的分析，具体实现可能包含更多细节。* 