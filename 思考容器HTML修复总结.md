# 思考容器HTML代码显示问题修复总结

## 问题描述
在历史记录显示中，出现了思考容器的HTML代码（如 `<div class="thinking-containe...`），这些HTML标签不应该在用户界面中直接显示。

## 问题根源分析
基于5-7个可能的问题来源分析后，确定了以下2个最主要的原因：

### 1. 思考容器HTML被错误地添加到消息内容中
- **位置**: `src/sidepanel/store.ts` 第460-466行
- **问题**: `CREATE_THINKING_CONTAINER` 消息处理逻辑将HTML直接添加到消息的 `content` 字段
- **影响**: HTML代码成为消息内容的一部分，被保存到历史记录中

### 2. 历史记录预览未过滤HTML标签
- **位置**: `src/sidepanel/components/HistoryList.tsx` 的 `getSessionPreview` 函数
- **问题**: 直接截取消息内容的前30个字符，未对HTML进行过滤
- **影响**: HTML标签在历史记录列表中直接显示

## 修复措施

### 1. 重构思考容器的创建机制
**修改文件**: `src/sidepanel/store.ts`

将思考容器HTML从消息内容中分离，改为直接在DOM中操作：
- 不再将HTML代码添加到消息的 `content` 字段
- 通过 `document.querySelector` 找到消息容器
- 直接在DOM中创建思考容器元素
- 确保思考容器仅用于UI显示，不影响消息数据

### 2. 增强历史记录预览的内容清理
**修改文件**: `src/sidepanel/components/HistoryList.tsx`

添加了 `cleanContent` 函数来过滤HTML：
- 移除思考容器HTML：`/<div class="thinking-container"[^>]*>[\s\S]*?<\/div>/g`
- 移除所有HTML标签：`/<[^>]*>/g`
- 清理多余空白字符
- 确保历史预览显示纯文本内容

### 3. 历史记录保存时的内容清理
**修改文件**: `src/shared/history.ts`

添加了完整的历史记录清理机制：
- 新增 `cleanMessageContent` 函数
- 在 `addChatSession` 中自动清理新保存的消息
- 新增 `cleanExistingHistory` 函数清理已存在的历史记录
- 在store初始化时执行历史记录清理

### 4. 修正CSS选择器
**修改文件**: `src/sidepanel/store.ts`

- 将错误的 `.message-list` 选择器修正为 `.messages-container`
- 确保DOM操作能够正确找到消息容器元素

## 技术细节

### DOM操作流程
1. 接收到 `CREATE_THINKING_CONTAINER` 消息
2. 查找 `.messages-container` 容器
3. 获取最后一个 `.message` 元素
4. 在消息的 `.message-content` 内创建思考容器
5. 思考内容通过 `UPDATE_REASONING` 消息更新

### 内容清理正则表达式
```javascript
// 移除思考容器HTML
content.replace(/<div class="thinking-container"[^>]*>[\s\S]*?<\/div>/g, '');

// 移除所有HTML标签
content.replace(/<[^>]*>/g, '');
```

## 验证和测试
- 构建成功（npm run build）
- 添加了详细的日志记录来跟踪清理过程
- 向后兼容，自动清理已存在的受影响历史记录

## 预期效果
1. **新的对话**: 思考容器正常显示，但不会出现在历史记录中
2. **历史记录列表**: 只显示纯文本预览，无HTML标签
3. **已存在的历史**: 自动清理，移除HTML内容
4. **用户体验**: 思考功能正常工作，界面更清洁

## 影响范围
- ✅ 新创建的思考容器不再污染消息内容
- ✅ 历史记录预览显示清洁的文本
- ✅ 已存在的受影响历史记录得到清理
- ✅ 思考功能的UI显示不受影响
- ✅ 消息的实际内容（除HTML外）保持完整 