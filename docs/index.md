# AskAnything 文档

欢迎来到 AskAnything 项目文档！

## 项目简介

AskAnything 是一个AI侧边浮标浏览器插件，旨在提供智能化的辅助功能。
(信息来自 package.json: "description": "AI侧边浮标浏览器插件")

## 文档导航

- [项目架构](./architecture.md)
- [Service Worker](./service-worker.md)
- [Content Script](./content-script.md)
- [侧边栏 (Sidepanel)](./sidepanel.md)
- [共享模块 (Shared)](./shared.md)

本文档旨在帮助开发者和用户理解项目的各个方面。

## 文档结构

- **[项目概述 (本文档)](#askanything-文档)**: 包含功能特点、开发设置、本地测试和项目结构概览。
- **[架构概览](./architecture.md)**: 插件的整体技术架构说明。
- **组件详解**:
    - **[Content Script](./content-script.md)**: 负责注入页面浮标和与页面交互的脚本。
    - **[Service Worker](./service-worker.md)**: 扩展的后台核心，处理事件和通信。
    - **[Side Panel](./sidepanel.md)**: 用户交互界面 (React + Zustand)。
    - **[共享模块](./shared.md)**: 跨组件共享的类型和工具函数。

## 功能特点

- 🎯 **浮动按钮** - 页面右侧随时可见的浮标，支持拖拽
- 🧠 **多模型支持** - 支持ChatGPT, Claude, DeepSeek, 通义千问 (需要用户在选项页配置API密钥)
- 📝 **上下文感知** - 自动获取选中文本或页面信息，并包含在API请求中
- 📊 **流式回复** - 实时流式显示AI回答 (通过真实API调用)
- 🔍 **本地历史** - 使用 `chrome.storage.local` 存储最近50条对话历史
- ⌨️ **快捷键支持** - Alt+Shift+A快速访问
- 📑 **右键菜单** - 选中文本右键询问

## 开发设置

### 前提条件

- Node.js v18+
- npm v8+

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建扩展

```bash
npm run build
```

构建的扩展将位于`dist`目录中。

## 本地测试

1. 打开Chrome浏览器，导航至`chrome://extensions`
2. 启用"开发者模式"
3. 点击"加载已解压的扩展程序"
4. 选择项目的`dist`目录

## 项目结构 (简述)

```
├── assets/              # 图标和静态资源
├── dist/                # 构建输出目录
├── docs/                # 文档目录
│   ├── index.md
│   ├── architecture.md
│   ├── content-script.md
│   ├── service-worker.md
│   ├── sidepanel.md
│   └── shared.md
├── src/
│   ├── content-script.ts  # 内容脚本 (浮标、页面交互)
│   ├── service-worker.ts  # 后台脚本 (事件处理、通信、API模拟)
│   ├── shared/          # 共享类型和工具 (models.ts, history.ts, settings.ts)
│   └── sidepanel/       # 侧边栏UI (React, Zustand, components/)
├── vite.config.ts       # Vite构建配置
├── manifest.json        # 扩展清单
└── ...
```

## 参与贡献

1. Fork项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建Pull Request

## 许可证

MIT 