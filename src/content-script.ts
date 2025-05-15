/**
 * 获取当前页面及其所有子 frame / iframe 中的选中文本，
 * 兼容 Chrome 内置 PDF Viewer（选区位于嵌套的 viewer frame 里）。
 */
function getDeepSelection(): string {
  const timestamp = new Date().toISOString();
  console.log(`[ContentScript][${timestamp}] 开始获取深度选择文本`);
  
  // 1) 尝试直接读取顶层窗口的选区
  try {
    console.log('[ContentScript] 尝试获取顶层窗口选区');
    const selection = window.getSelection();
    const topSel = selection?.toString();
    console.log('[ContentScript] 顶层选区:', {
      有选区对象: !!selection,
      选区范围数量: selection?.rangeCount || 0,
      选区文本长度: topSel?.length || 0
    });
    
    if (topSel) {
      console.log('[ContentScript] 在顶层窗口找到选区文本');
      return topSel;
    }
  } catch (err) {
    console.warn('[ContentScript] 获取顶层窗口选区失败:', err);
  }

  // 2) 递归遍历所有子 frame，找到非空选区即返回
  try {
    console.log('[ContentScript] 尝试在子框架中寻找选区, 框架数量:', window.frames.length);
    
    // 记录每个框架的URL，调试用
    for (let i = 0; i < window.frames.length; i++) {
      try {
        const frameUrl = window.frames[i].location.href;
        console.log(`[ContentScript] 框架 #${i} URL:`, frameUrl);
      } catch (crossOriginErr) {
        console.log(`[ContentScript] 框架 #${i} 跨域无法访问URL`);
      }
    }
    
    for (let i = 0; i < window.frames.length; i++) {
      const frame = window.frames[i];
      // content scripts 与跨域 frame 之间可能存在同源限制，需 try / catch
      try {
        console.log(`[ContentScript] 尝试获取框架 #${i} 的选区`);
        const frameSelection = frame.getSelection?.();
        const frameSel = frameSelection?.toString();
        
        console.log(`[ContentScript] 框架 #${i} 选区:`, {
          有选区对象: !!frameSelection,
          选区范围数量: frameSelection?.rangeCount || 0,
          选区文本长度: frameSel?.length || 0
        });
        
        if (frameSel) {
          console.log(`[ContentScript] 在框架 #${i} 中找到选区文本`);
          return frameSel;
        }
      } catch (frameErr) {
        console.log(`[ContentScript] 无法访问框架 #${i} 的选区 (可能是跨域限制):`, frameErr);
      }
      
      // 检查框架内是否有嵌套框架
      try {
        if (frame.frames && frame.frames.length > 0) {
          console.log(`[ContentScript] 框架 #${i} 包含 ${frame.frames.length} 个嵌套框架，但当前版本不递归处理`);
          // 未来可以考虑递归处理
        }
      } catch (nestedErr) {
        // 忽略
      }
    }
  } catch (framesErr) {
    console.warn('[ContentScript] 处理框架时出错:', framesErr);
  }

  // 3) 若依然获取不到，则返回空串
  console.log('[ContentScript] 未找到任何选区文本');
  return '';
}

// 创建浮动按钮
let buttonCreationCount = 0; // 记录按钮创建次数
function createFloatingButton() {
  buttonCreationCount++;
  const timestamp = new Date().toISOString();
  console.log(`[ContentScript][${timestamp}] 创建浮动按钮 (第${buttonCreationCount}次调用)`);
  
  // 检查是否在弹窗/iframe中 - 如果是则不创建浮标
  if (window !== window.top) {
    console.log(`[ContentScript][${timestamp}] 检测到当前在iframe/弹窗中，不创建浮标`);
    return null;
  }
  
  // 检查是否已经存在浮动按钮
  const existingButton = document.getElementById('ai-sidepanel-fab');
  if (existingButton) {
    console.log(`[ContentScript][${timestamp}] 浮动按钮已存在，不重复创建`);
    return existingButton;
  }
  
  const fab = document.createElement('div');
  fab.id = 'ai-sidepanel-fab';
  fab.innerHTML = `
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10"></circle>
      <path d="M12 8v8"></path>
      <path d="M8 12h8"></path>
    </svg>
  `;
  
  // 样式设置
  fab.style.cssText = `
    position: fixed;
    right: 20px;
    top: 50%;
    transform: translateY(-50%);
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background-color: #4285f4;
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    z-index: 9999;
    transition: all 0.3s ease;
  `;

  // 添加悬停效果
  fab.addEventListener('mouseenter', () => {
    fab.style.backgroundColor = '#1a73e8';
  });

  fab.addEventListener('mouseleave', () => {
    fab.style.backgroundColor = '#4285f4';
  });

  // 支持拖拽（简单实现）
  let isDragging = false;
  let initialX: number, initialY: number;
  let currentX: number, currentY: number;

  fab.addEventListener('mousedown', startDrag);
  document.addEventListener('mousemove', drag);
  document.addEventListener('mouseup', endDrag);

  function startDrag(e: MouseEvent) {
    initialX = e.clientX;
    initialY = e.clientY;
    const rect = fab.getBoundingClientRect();
    currentX = rect.left;
    currentY = rect.top;
    isDragging = true;
  }

  function drag(e: MouseEvent) {
    if (!isDragging) return;
    e.preventDefault();
    
    const deltaX = e.clientX - initialX;
    const deltaY = e.clientY - initialY;
    
    fab.style.left = `${currentX + deltaX}px`;
    fab.style.top = `${currentY + deltaY}px`;
    fab.style.right = 'auto';
    fab.style.transform = 'none';
  }

  function endDrag() {
    isDragging = false;
  }

  // 点击打开侧边栏
  fab.addEventListener('click', () => {
    console.log('[ContentScript] 浮动按钮被点击');
    
    try {
      // 检查扩展上下文是否有效
      if (!isExtensionContextValid()) {
        console.warn('[ContentScript] 扩展上下文无效，无法发送消息');
        showErrorNotification('无法与扩展通信，可能是在本地文件中使用扩展受限。请尝试在URL栏输入 chrome://extensions 并确保已启用"允许访问文件网址"选项。');
        return;
      }
      
      // 安全获取当前选中的文本
      let selectedText = '';
      try {
        console.log('[ContentScript] 通过按钮点击获取选中文本');
        selectedText = getDeepSelection();
      } catch (selectionError) {
        console.warn('[ContentScript] 获取选中文本失败:', selectionError);
      }
      
      // 安全获取URL和标题
      let currentUrl = '';
      let currentTitle = '';
      try {
        currentUrl = window.location.href || '';
        currentTitle = document.title || '';
      } catch (urlError) {
        console.warn('[ContentScript] 获取URL或标题失败:', urlError);
      }
      
      console.log('[ContentScript] 当前选中文本:', selectedText ? '有内容' : '无内容', 
        selectedText ? `(前50个字符: ${selectedText.substring(0, 50)}...)` : '');
      
      // 先尝试关闭侧边栏，如果侧边栏没有打开会失败，然后再打开侧边栏
      chrome.runtime.sendMessage({
        type: 'CLOSE_SIDEPANEL_REQUEST',
        tabId: chrome.runtime.id // 唯一标识这个请求
      }, (closeResponse) => {
        console.log('[ContentScript] 尝试关闭侧边栏响应:', closeResponse);
        
        // 如果没有响应（侧边栏没有打开）或者响应表示侧边栏未打开，则打开侧边栏
        if (!closeResponse || closeResponse.notOpen) {
          // 打开侧边栏并传递上下文
          try {
            chrome.runtime.sendMessage({
              type: 'OPEN_SIDEPANEL',
              context: {
                text: selectedText,
                url: currentUrl,
                title: currentTitle
              }
            }, (response) => {
              // 检查扩展上下文是否有效
              if (chrome.runtime.lastError) {
                console.error('[ContentScript] 打开侧边栏错误:', chrome.runtime.lastError);
                
                // 处理特定的Extension context invalidated错误
                if (chrome.runtime.lastError.message?.includes('Extension context invalidated')) {
                  showErrorNotification('扩展上下文无效，请尝试刷新页面或重新启动浏览器。如果在本地PDF文件中使用，需要在扩展设置中允许访问文件URL。');
                }
                return;
              }
              
              if (!response) {
                console.log('[ContentScript] 未收到侧边栏响应');
                return;
              }
              console.log('[ContentScript] 打开侧边栏响应:', response);
            });
          } catch (sendError) {
            console.error('[ContentScript] 发送消息失败:', sendError);
            showErrorNotification('无法与扩展通信，可能是扩展上下文已失效。');
          }
        }
      });
    } catch (error) {
      console.error('[ContentScript] 处理按钮点击失败:', error);
      showErrorNotification('处理操作时出错');
    }
  });

  document.body.appendChild(fab);
  console.log(`[ContentScript][${timestamp}] 浮动按钮已添加到页面, ID=${fab.id}`);
  return fab;
}

// 检查扩展上下文是否有效
function isExtensionContextValid() {
  try {
    // 尝试访问chrome.runtime.id，如果上下文无效会抛出异常
    return typeof chrome.runtime.id === 'string';
  } catch (e) {
    console.error('[ContentScript] 扩展上下文检查失败:', e);
    return false;
  }
}

// 显示错误通知
function showErrorNotification(message: string) {
  // 创建通知元素
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background-color: #f44336;
    color: white;
    padding: 12px 16px;
    border-radius: 4px;
    box-shadow: 0 4px 8px rgba(0,0,0,0.2);
    z-index: 10000;
    max-width: 350px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    font-size: 14px;
  `;
  notification.textContent = message;
  
  // 添加到页面并设置自动消失
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s ease';
    setTimeout(() => {
      document.body.removeChild(notification);
    }, 500);
  }, 5000);
}

// 根据系统主题或网站主题调整浮标颜色
let themeUpdateCount = 0; // 记录主题更新次数
function updateButtonTheme() {
  themeUpdateCount++;
  const timestamp = new Date().toISOString();
  console.log(`[ContentScript][${timestamp}] 更新按钮主题 (第${themeUpdateCount}次调用)`);
  
  // 检查是否在iframe/弹窗中 - 如果是则跳过操作
  if (window !== window.top) {
    console.log(`[ContentScript][${timestamp}] 检测到当前在iframe/弹窗中，跳过更新主题`);
    return;
  }
  
  const fab = document.getElementById('ai-sidepanel-fab');
  if (!fab) {
    console.log(`[ContentScript][${timestamp}] 未找到浮标按钮，跳过更新主题`);
    return;
  }
  
  // 检测暗色模式
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches ||
    document.documentElement.classList.contains('dark') ||
    document.body.classList.contains('dark-theme');
  
  console.log(`[ContentScript][${timestamp}] 检测到主题: ${isDarkMode ? '暗色' : '亮色'}`);
  
  if (isDarkMode) {
    fab.style.backgroundColor = '#8ab4f8';
    fab.addEventListener('mouseenter', () => {
      fab.style.backgroundColor = '#aecbfa';
    });
    fab.addEventListener('mouseleave', () => {
      fab.style.backgroundColor = '#8ab4f8';
    });
  } else {
    fab.style.backgroundColor = '#4285f4';
    fab.addEventListener('mouseenter', () => {
      fab.style.backgroundColor = '#1a73e8';
    });
    fab.addEventListener('mouseleave', () => {
      fab.style.backgroundColor = '#4285f4';
    });
  }
}

// 添加防止重复处理的时间戳记录
let lastSelectionTimestamp = 0;
const SELECTION_DEBOUNCE_TIME = 500; // 毫秒

// DOM变动观察器，用于检测页面结构变化
let domChangeCount = 0;
function setupDomObserver() {
  const timestamp = new Date().toISOString();
  console.log(`[ContentScript][${timestamp}] 设置DOM变动观察器`);
  
  // 检查是否在iframe/弹窗中 - 如果是则不设置观察器
  if (window !== window.top) {
    console.log(`[ContentScript][${timestamp}] 检测到当前在iframe/弹窗中，跳过设置DOM观察器`);
    return null;
  }
  
  const observer = new MutationObserver((mutations) => {
    domChangeCount++;
    // 限制日志频率，避免日志爆炸
    if (domChangeCount % 5 === 0) {
      const observerTimestamp = new Date().toISOString();
      console.log(`[ContentScript][${observerTimestamp}] 检测到DOM变动 #${domChangeCount}, 变动数量: ${mutations.length}`);
      
      // 分析变动类型
      let addedNodes = 0;
      let removedNodes = 0;
      let attributeChanges = 0;
      
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          addedNodes += mutation.addedNodes.length;
          removedNodes += mutation.removedNodes.length;
        } else if (mutation.type === 'attributes') {
          attributeChanges++;
        }
      });
      
      console.log(`[ContentScript][${observerTimestamp}] DOM变动详情: 新增节点=${addedNodes}, 移除节点=${removedNodes}, 属性变化=${attributeChanges}`);
      
      // 检查是否有上下文更新触发
      const contextUpdateElements = document.querySelectorAll('[data-context-update]');
      if (contextUpdateElements.length > 0) {
        console.log(`[ContentScript][${observerTimestamp}] 发现可能的上下文更新元素: ${contextUpdateElements.length}个`);
      }
    }
  });
  
  // 观察整个文档
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true
  });
  
  console.log(`[ContentScript][${timestamp}] DOM变动观察器已设置`);
  return observer;
}

// 初始化
let initCount = 0; // 记录初始化次数
function init() {
  initCount++;
  const timestamp = new Date().toISOString();
  console.log(`[ContentScript][${timestamp}] 开始初始化 (第${initCount}次调用)`);
  console.log(`[ContentScript][${timestamp}] 当前页面URL: ${window.location.href}`);
  console.log(`[ContentScript][${timestamp}] 当前页面域名: ${window.location.hostname}`);
  console.log(`[ContentScript][${timestamp}] Document Ready State: ${document.readyState}`);
  
  // 检查是否在iframe/弹窗中 - 如果是则不初始化浮标
  if (window !== window.top) {
    console.log(`[ContentScript][${timestamp}] 检测到当前在iframe/弹窗中，跳过初始化浮标`);
    return;
  }
  
  createFloatingButton();
  updateButtonTheme();
  
  // 设置DOM观察器来监控变化
  setupDomObserver(); // 直接调用而不存储返回值
  
  // 监听系统主题变化
  try {
    window.matchMedia('(prefers-color-scheme: dark)')
      .addEventListener('change', () => {
        const themeChangeTimestamp = new Date().toISOString();
        console.log(`[ContentScript][${themeChangeTimestamp}] 检测到主题变化`);
        updateButtonTheme();
      });
  } catch (error) {
    console.error(`[ContentScript][${timestamp}] 监听主题变化失败:`, error);
  }
  
  console.log(`[ContentScript][${timestamp}] 初始化完成`);
}

// 确保DOM完全加载后再初始化
if (document.readyState === 'loading') {
  const timestamp = new Date().toISOString();
  console.log(`[ContentScript][${timestamp}] DOM加载中，等待DOMContentLoaded事件`);
  document.addEventListener('DOMContentLoaded', init);
} else {
  const timestamp = new Date().toISOString();
  console.log(`[ContentScript][${timestamp}] DOM已加载，立即初始化`);
  init();
}

// 记录消息处理统计
interface MessageCounter {
  GET_SELECTION: number;
  GET_PAGE_INFO: number;
  OPEN_SIDEPANEL: number;
  other: number;
  [key: string]: number; // 添加索引签名，允许任何字符串键
}

let messageCounter: MessageCounter = {
  GET_SELECTION: 0,
  GET_PAGE_INFO: 0,
  OPEN_SIDEPANEL: 0,
  other: 0
};

// 监听来自后台脚本的消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const timestamp = new Date().toISOString();
  
  // 更新消息计数
  if (message.type) {
    if (messageCounter[message.type] !== undefined) {
      messageCounter[message.type]++;
    } else {
      messageCounter.other++;
    }
  }
  
  console.log(`[ContentScript][${timestamp}] 收到消息: ${message.type || '未知类型'}, 消息统计:`, messageCounter);
  
  // 首先检查扩展上下文是否有效
  if (!isExtensionContextValid()) {
    console.warn(`[ContentScript][${timestamp}] 收到消息但扩展上下文无效，无法处理`);
    try {
      sendResponse({ error: 'Extension context invalidated' });
    } catch (e) {
      console.error(`[ContentScript][${timestamp}] 无法发送响应:`, e);
    }
    return false;
  }

  if (message.type === 'GET_SELECTION') {
    try {
      console.log('[ContentScript] 收到GET_SELECTION请求');
      
      // 防止重复处理 - 检查时间戳
      const now = Date.now();
      if (now - lastSelectionTimestamp < SELECTION_DEBOUNCE_TIME) {
        console.log(`[ContentScript] 忽略频繁的选择文本请求 (间隔: ${now - lastSelectionTimestamp}ms < ${SELECTION_DEBOUNCE_TIME}ms)`);
        sendResponse({ ignored: true });
        return true;
      }
      lastSelectionTimestamp = now;
      
      // 获取选中文本
      const selectedText = getDeepSelection();
      console.log('[ContentScript] GET_SELECTION获取到选中文本:', selectedText ? '有内容' : '无内容', 
        selectedText ? `(前50个字符: ${selectedText.substring(0, 50)}...)` : '');
      
      // 安全获取当前URL（处理PDF和特殊URL）
      let currentUrl = '';
      let currentTitle = '';
      
      try {
        currentUrl = window.location.href || '';
        currentTitle = document.title || '';
      } catch (urlError) {
        console.warn('[ContentScript] 获取URL或标题失败:', urlError);
      }
      
      // 返回完整上下文（确保不会因为任何一个属性出错而中断）
      const response = {
        text: selectedText,
        url: currentUrl,
        title: currentTitle
      };
      console.log('[ContentScript] 发送GET_SELECTION响应:', response);
      sendResponse(response);
    } catch (error) {
      console.error('[ContentScript] 获取选中文本失败:', error);
      // 确保即使出错也返回有效响应
      sendResponse({ 
        text: '无法获取选中文本',
        url: '',
        title: '',
        error: String(error) 
      });
    }
    return true;
  }
  
  if (message.type === 'GET_PAGE_INFO') {
    try {
      // 安全获取页面信息
      let currentUrl = '';
      let currentTitle = '';
      
      try {
        currentUrl = window.location.href || '';
        currentTitle = document.title || '';
      } catch (urlError) {
        console.warn('[ContentScript] 获取URL或标题失败:', urlError);
      }
      
      const pageInfo = {
        url: currentUrl,
        title: currentTitle
      };
      console.log('[ContentScript] 获取页面信息:', pageInfo);
      sendResponse(pageInfo);
    } catch (error) {
      console.error('[ContentScript] 获取页面信息失败:', error);
      sendResponse({ 
        url: '',
        title: '',
        error: String(error)
      });
    }
    return true;
  }
});