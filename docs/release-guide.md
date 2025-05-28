# 发布指南

本文档说明如何为 AskAnything 创建 GitHub Release。

## 发布前准备

### 1. 更新版本号

在发布前，需要更新以下文件中的版本号：

- `package.json` 中的 `version` 字段
- `dist/manifest.json` 中的 `version` 字段

确保两个文件中的版本号保持一致。

### 2. 更新 CHANGELOG

如果有 CHANGELOG.md 文件，请添加新版本的更新内容。

### 3. 测试构建

确保项目可以正常构建：

```bash
npm run build
```

## 创建发布包

### 1. 生成发布包

运行打包命令：

```bash
npm run package
```

这将生成 `askanything.zip` 文件。

### 2. 验证发布包

解压生成的 zip 文件，确保包含以下必要文件：
- `manifest.json`
- `service-worker.js`
- `content-script.js`
- `sidepanel.html`
- `sidepanel.js`
- `options.html`
- `options.js`
- `assets/` 目录（包含图标和样式文件）

确保不包含：
- `*.map` 文件（source maps）
- `src/` 目录

## 创建 GitHub Release

### 1. 推送代码

确保所有更改都已提交并推送到 GitHub：

```bash
git add .
git commit -m "chore: prepare for release v1.x.x"
git push origin main
```

### 2. 创建 Release

1. 访问 GitHub 仓库页面
2. 点击右侧的 "Releases" 链接
3. 点击 "Create a new release" 按钮
4. 填写以下信息：
   - **Tag version**: `v1.x.x` (例如 `v1.2.1`)
   - **Release title**: `AskAnything v1.x.x`
   - **Description**: 描述此版本的新功能、改进和修复
5. 上传 `askanything.zip` 文件到 "Attach binaries" 区域
6. 如果是预发布版本，勾选 "This is a pre-release"
7. 点击 "Publish release"

### 3. Release 描述模板

```markdown
## 🚀 新功能
- 新增功能描述

## 🐛 修复
- 修复的问题描述

## 🔧 改进
- 改进的功能描述

## 📦 安装方式

### 从 Release 安装（推荐）
1. 下载下方的 `askanything.zip` 文件
2. 解压到任意目录
3. 在 Chrome 浏览器中访问 `chrome://extensions`
4. 启用"开发者模式"
5. 点击"加载已解压的扩展程序"
6. 选择解压后的文件夹

### ⚠️ 重要提醒
安装后请务必在扩展选项页面中配置你的 API 密钥才能使用 AI 功能。

## 🔗 相关链接
- [使用文档](../README.md)
- [API 密钥配置指南](../README.md#api密钥配置)
```

## 发布后

### 1. 更新 README

确保 README.md 中的 GitHub Releases 链接指向正确的仓库地址。

### 2. 通知用户

如果有用户群体，可以通过适当的渠道通知新版本发布。

### 3. 监控反馈

关注 GitHub Issues 中的用户反馈和问题报告。

## 版本号规范

建议使用语义化版本号 (Semantic Versioning)：

- **主版本号 (MAJOR)**: 不兼容的 API 修改
- **次版本号 (MINOR)**: 向下兼容的功能性新增
- **修订号 (PATCH)**: 向下兼容的问题修正

例如：`1.2.1`
- `1`: 主版本
- `2`: 次版本  
- `1`: 修订版本 