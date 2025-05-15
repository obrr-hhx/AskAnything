# 项目架构

AskAnything 采用模块化的架构，主要组件分布在 `src/` 目录下。

## 主要模块

根据项目的源代码结构，可以将系统划分为以下主要模块：

- **Service Worker (`service-worker.ts`)**: 
  - 作为浏览器扩展的后台核心，负责处理后台任务、事件监听（如消息传递、浏览器事件）、状态管理以及与外部API的通信等。
  - 更多详情请参考 [Service Worker 文档](./service-worker.md)。

- **Content Script (`content-script.ts`)**: 
  - 注入到网页中，负责与页面DOM进行交互，提取页面信息，或者在页面上修改内容、响应用户操作，并将信息传递给 Service Worker 或 Sidepanel。
  - 更多详情请参考 [Content Script 文档](./content-script.md)。

- **侧边栏 (Sidepanel - `src/sidepanel/`)**: 
  - 提供用户交互界面，展示信息，接收用户输入。它很可能使用React构建（基于项目依赖）。
  - 负责与 Service Worker 通信以获取数据或发送指令。
  - 更多详情请参考 [侧边栏文档](./sidepanel.md)。

- **选项页面 (Options - `src/options/`)**: 
  - （推测）提供用户配置插件行为的界面。

- **共享模块 (Shared - `src/shared/`)**: 
  - 包含项目中多个部分（如 Service Worker, Content Script, Sidepanel）共用的代码、工具函数、常量或类型定义。
  - 更多详情请参考 [共享模块文档](./shared.md)。

- **服务 (Services - `src/services/`)**: 
  - （推测）封装了与外部API的交互逻辑，或者提供特定的业务功能服务。

- **数据模型 (Models - `src/models/`)**: 
  - （推测）定义了项目中使用的数据结构和类型。

- **类型定义 (Types - `src/types/`)**: 
  - 存放项目全局的TypeScript类型声明。

- **提供者 (Providers - `src/providers/`)**: 
  - （推测，若使用React Context API等）提供状态管理或依赖注入的功能。

- **工厂 (Factories - `src/factories/`)**: 
  - （推测）用于创建和初始化特定类型的对象实例。

## 通信机制

浏览器扩展的各个组件（Service Worker, Content Script, Sidepanel, Options Page）之间主要通过 Chrome Extension Message Passing API进行通信。

*此架构描述基于对项目文件结构的初步分析，具体实现细节可能更为复杂。* 