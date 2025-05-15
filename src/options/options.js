// 在页面加载时获取已保存的API密钥
document.addEventListener('DOMContentLoaded', async () => {
  console.log('选项页面加载完成，正在获取已保存的API密钥');
  
  try {
    // 加载保存的API密钥
    const { apiKeys = {} } = await chrome.storage.local.get('apiKeys');
    if (apiKeys.openai) document.getElementById('openai-api-key').value = apiKeys.openai;
    if (apiKeys.anthropic) document.getElementById('anthropic-api-key').value = apiKeys.anthropic;
    if (apiKeys.deepseek) document.getElementById('deepseek-api-key').value = apiKeys.deepseek;
    if (apiKeys.qwen3) document.getElementById('qwen3-api-key').value = apiKeys.qwen3;
    if (apiKeys.zhipu) document.getElementById('zhipu-api-key').value = apiKeys.zhipu;
    
    // 加载保存的API端点
    const { apiEndpoints = {} } = await chrome.storage.local.get('apiEndpoints');
    if (apiEndpoints.openai) document.getElementById('openai-endpoint').value = apiEndpoints.openai;
    if (apiEndpoints.anthropic) document.getElementById('anthropic-endpoint').value = apiEndpoints.anthropic;
    if (apiEndpoints.deepseek) document.getElementById('deepseek-endpoint').value = apiEndpoints.deepseek;
    if (apiEndpoints.qwen3) document.getElementById('qwen3-endpoint').value = apiEndpoints.qwen3;
    
    // 加载MCP服务器配置
    const { mcpServerConfigs = [] } = await chrome.storage.local.get('mcpServerConfigs');
    console.log('已加载MCP服务器配置:', mcpServerConfigs);
    
    // 清空服务器容器
    const serversContainer = document.getElementById('mcp-servers-container');
    serversContainer.innerHTML = '';
    
    // 添加已保存的MCP服务器
    if (mcpServerConfigs.length > 0) {
      // 转换旧版配置（如果需要）
      const updatedConfigs = mcpServerConfigs.map(config => {
        // 如果已经有serverUrl，则直接使用
        if (config.serverUrl) {
          return config;
        }
        
        // 转换旧版配置
        return {
          name: config.name,
          serverUrl: config.streamableHttpUrl || config.sseUrl || ''
        };
      });
      
      // 添加所有服务器配置
      updatedConfigs.forEach((config, index) => {
        addMcpServerItem(config);
      });
      
      // 尝试保存更新后的配置
      if (JSON.stringify(mcpServerConfigs) !== JSON.stringify(updatedConfigs)) {
        console.log('更新MCP服务器配置格式');
        await chrome.storage.local.set({ mcpServerConfigs: updatedConfigs });
      }
    } else {
      // 兼容旧版配置
      const { mcpServerConfig } = await chrome.storage.local.get('mcpServerConfig');
      if (mcpServerConfig) {
        console.log('发现旧版MCP服务器配置，正在转换:', mcpServerConfig);
        
        // 转换旧版配置为新格式
        const newConfig = {
          name: mcpServerConfig.name || '',
          serverUrl: mcpServerConfig.serverUrl || mcpServerConfig.streamableHttpUrl || mcpServerConfig.sseUrl || mcpServerConfig.wsUrl || ''
        };
        
        if (newConfig.serverUrl) {
          addMcpServerItem(newConfig);
          
          // 保存到新的格式
          const newConfigs = [newConfig];
          await chrome.storage.local.set({ mcpServerConfigs: newConfigs });
          
          // 更新默认配置
          await chrome.storage.local.set({ mcpServerConfig: newConfig });
        } else {
          // 如果没有有效的URL，添加一个空白服务器
          addMcpServerItem();
        }
      } else {
        // 如果没有任何配置，添加一个空白服务器
        addMcpServerItem();
      }
    }
    
    console.log('设置已加载');
  } catch (error) {
    console.error('加载设置出错:', error);
    showMessage('加载设置失败: ' + error.message, 'error');
  }
  
  // 添加保存按钮点击事件监听器
  document.getElementById('save-button').addEventListener('click', saveApiKeys);
  document.getElementById('save-endpoints-button').addEventListener('click', saveApiEndpoints);
  document.getElementById('save-mcp-button').addEventListener('click', saveMcpConfigs);
  document.getElementById('add-mcp-server-button').addEventListener('click', () => addMcpServerItem());
  
  // 添加事件监听
  document.addEventListener('click', function(event) {
    if (event.target.classList.contains('toggle-password')) {
      togglePasswordVisibility(event);
    } else if (event.target.classList.contains('remove-server-btn')) {
      removeServerItem(event.target.closest('.mcp-server-item'));
    } else if (event.target.classList.contains('test-mcp-button')) {
      testMcpConnection(event.target.closest('.mcp-server-item'));
    }
  });
});

// 为每个MCP服务器生成唯一ID
function generateServerId() {
  return Date.now() + '-' + Math.random().toString(36).substring(2, 10);
}

// 添加MCP服务器配置项
function addMcpServerItem(config = null) {
  const serversContainer = document.getElementById('mcp-servers-container');
  const template = document.getElementById('mcp-server-template');
  const serverId = generateServerId();
  
  // 克隆模板
  const serverItem = template.cloneNode(true).firstElementChild;
  
  // 计算服务器编号
  const serverNumber = serversContainer.children.length + 1;
  serverItem.querySelector('.server-number').textContent = `#${serverNumber}`;
  
  // 替换ID占位符
  serverItem.innerHTML = serverItem.innerHTML.replace(/{id}/g, serverId);
  
  // 添加到容器
  serversContainer.appendChild(serverItem);
  
  // 如果有配置数据，填充表单
  if (config) {
    // 填充基本信息
    serverItem.querySelector('.mcp-server-name').value = config.name || '';
    
    // 填充服务器URL
    if (config.serverUrl) {
      serverItem.querySelector('.mcp-server-url').value = config.serverUrl;
    } else if (config.streamableHttpUrl) {
      // 兼容旧版配置
      serverItem.querySelector('.mcp-server-url').value = config.streamableHttpUrl;
    } else if (config.sseUrl) {
      // 兼容旧版配置
      serverItem.querySelector('.mcp-server-url').value = config.sseUrl;
    }
  }
  
  return serverItem;
}

// 移除服务器配置项
function removeServerItem(serverItem) {
  if (confirm('确定要删除这个MCP服务器配置吗？')) {
    // 移除服务器项
    serverItem.remove();
    
    // 更新剩余服务器的编号
    const serversContainer = document.getElementById('mcp-servers-container');
    Array.from(serversContainer.children).forEach((item, index) => {
      item.querySelector('.server-number').textContent = `#${index + 1}`;
    });
    
    // 如果没有服务器配置，添加一个空白的
    if (serversContainer.children.length === 0) {
      addMcpServerItem();
    }
  }
}

// 保存MCP服务器配置
async function saveMcpConfigs() {
  console.log('正在保存MCP服务器配置');
  
  // 获取所有服务器配置项
  const serverItems = document.querySelectorAll('#mcp-servers-container .mcp-server-item');
  const mcpServerConfigs = [];
  
  let hasValidServer = false;
  
  // 遍历所有服务器配置
  for (const serverItem of serverItems) {
    // 获取服务器基本信息
    const name = serverItem.querySelector('.mcp-server-name').value.trim();
    const serverUrl = serverItem.querySelector('.mcp-server-url').value.trim();
    
    // 如果URL为空，跳过此项
    if (!serverUrl) continue;
    
    // 验证URL格式
    if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
      showMessage(`服务器 #${Array.from(serverItems).indexOf(serverItem) + 1} URL格式错误，必须以http://或https://开头`, 'error');
      return;
    }
    
    // 添加到配置数组
    mcpServerConfigs.push({
      name: name || null,
      serverUrl
    });
    
    hasValidServer = true;
  }
  
  if (!hasValidServer) {
    showMessage('请至少提供一个有效的MCP服务器配置', 'error');
    return;
  }
  
  // 保存到storage.local
  try {
    // 保存新的配置数组
    await chrome.storage.local.set({ mcpServerConfigs });
    
    // 为了向后兼容，也保存第一个服务器作为默认配置
    if (mcpServerConfigs.length > 0) {
      const firstConfig = mcpServerConfigs[0];
      
      const mcpServerConfig = {
        name: firstConfig.name,
        serverUrl: firstConfig.serverUrl
      };
      await chrome.storage.local.set({ mcpServerConfig });
    }
    
    console.log('MCP服务器配置已保存:', mcpServerConfigs);
    showMessage('MCP服务器配置已保存成功!', 'success');
  } catch (error) {
    console.error('保存MCP服务器配置出错:', error);
    showMessage('保存MCP服务器配置失败: ' + error.message, 'error');
  }
}

// 测试MCP服务器连接
function testMcpConnection(serverItem) {
  console.log('测试MCP服务器连接');
  
  const serverUrl = serverItem.querySelector('.mcp-server-url').value.trim();
  
  // 验证必填字段
  if (!serverUrl) {
    showMessage('请输入服务器URL', 'error');
    return;
  }
  
  // 验证URL格式
  if (!serverUrl.startsWith('http://') && !serverUrl.startsWith('https://')) {
    showMessage('服务器URL必须以http://或https://开头', 'error');
    return;
  }
  
  const statusContainer = serverItem.querySelector('.mcp-status');
  const statusElement = serverItem.querySelector('.mcp-connection-status');
  statusContainer.classList.remove('hidden');
  statusElement.innerHTML = '正在连接到MCP服务器...';
  statusElement.className = 'connection-testing';
  
  // 先尝试StreamableHTTP连接
  testStreamableHTTPConnection(serverUrl, statusElement).catch(error => {
    console.log('StreamableHTTP连接测试失败，尝试SSE连接:', error);
    
    // 如果StreamableHTTP失败，尝试SSE连接
    testSSEConnection(serverUrl, statusElement).catch(sseError => {
      console.error('所有连接方式测试失败:', sseError);
      statusElement.innerHTML = '连接失败: 所有连接方式均无法连接到服务器';
      statusElement.className = 'connection-error';
    });
  });
}

// 测试StreamableHTTP连接
async function testStreamableHTTPConnection(serverUrl, statusElement) {
  try {
    // 使用fetch API测试连接
    const response = await fetch(`${serverUrl}/ping`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP状态码: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('StreamableHTTP服务器响应:', data);
    statusElement.innerHTML = '连接成功! 使用StreamableHTTP传输';
    statusElement.className = 'connection-success';
    
    // 尝试获取工具列表
    const toolsResponse = await fetch(`${serverUrl}/listTools`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now().toString(),
        method: "listTools",
        params: {}
      })
    });
    
    if (!toolsResponse.ok) {
      throw new Error(`获取工具列表失败, HTTP状态码: ${toolsResponse.status}`);
    }
    
    const toolsData = await toolsResponse.json();
    console.log('获取到工具列表:', toolsData);
    
    if (toolsData.result && toolsData.result.tools) {
      const toolCount = toolsData.result.tools.length;
      statusElement.innerHTML = `连接成功! 服务器提供了 ${toolCount} 个工具。`;
    }
    
    return true;
  } catch (error) {
    console.error('StreamableHTTP测试错误:', error);
    throw error;
  }
}

// 测试SSE连接
async function testSSEConnection(serverUrl, statusElement) {
  return new Promise((resolve, reject) => {
    try {
      // 尝试创建SSE连接
      const eventSource = new EventSource(serverUrl);
      
      // 设置超时
      let connectionTimeout = setTimeout(() => {
        eventSource.close();
        reject(new Error('连接超时，请检查服务器地址是否正确'));
      }, 5000);
      
      // 连接打开事件
      eventSource.onopen = () => {
        clearTimeout(connectionTimeout);
        statusElement.innerHTML = '连接成功! 使用SSE传输';
        statusElement.className = 'connection-success';
        
        // 3秒后关闭连接
        setTimeout(() => {
          eventSource.close();
          resolve(true);
        }, 3000);
      };
      
      // 消息事件
      eventSource.onmessage = (event) => {
        console.log('收到SSE服务器消息:', event.data);
        
        try {
          // 尝试解析JSON
          const data = JSON.parse(event.data);
          statusElement.innerHTML += `<br>收到消息: ${JSON.stringify(data).substring(0, 50)}${JSON.stringify(data).length > 50 ? '...' : ''}`;
        } catch (error) {
          // 如果不是JSON，直接显示文本
          statusElement.innerHTML += `<br>收到消息: ${event.data.substring(0, 50)}${event.data.length > 50 ? '...' : ''}`;
        }
      };
      
      // 错误事件
      eventSource.onerror = (error) => {
        clearTimeout(connectionTimeout);
        console.error('SSE服务器连接错误:', error);
        eventSource.close();
        reject(new Error('SSE连接失败'));
      };
      
    } catch (error) {
      console.error('创建SSE连接出错:', error);
      reject(error);
    }
  });
}

// 显示状态消息
function showMessage(message, type) {
  const statusElement = document.getElementById('status-message');
  statusElement.textContent = message;
  statusElement.className = `alert alert-${type}`;
  
  // 2秒后隐藏消息
  setTimeout(() => {
    statusElement.className = 'alert hidden';
  }, 3000);
}

// 切换密码可见性
function togglePasswordVisibility(event) {
  const targetId = event.target.dataset.target;
  const inputElement = document.getElementById(targetId);
  
  if (inputElement.type === 'password') {
    inputElement.type = 'text';
  } else {
    inputElement.type = 'password';
  }
}

// 保存API密钥
async function saveApiKeys() {
  console.log('正在保存API密钥');
  
  const openai = document.getElementById('openai-api-key').value.trim();
  const anthropic = document.getElementById('anthropic-api-key').value.trim();
  const deepseek = document.getElementById('deepseek-api-key').value.trim();
  const qwen3 = document.getElementById('qwen3-api-key').value.trim();
  const zhipu = document.getElementById('zhipu-api-key').value.trim();
  
  // 创建API密钥对象
  const apiKeys = {
    openai,
    anthropic,
    deepseek,
    qwen3,
    zhipu
  };
  
  // 清理空值
  Object.keys(apiKeys).forEach(key => {
    if (!apiKeys[key]) {
      delete apiKeys[key];
    }
  });
  
  // 检查是否至少有一个API密钥
  if (Object.keys(apiKeys).length === 0) {
    showMessage('请至少提供一个API密钥', 'error');
    return;
  }
  
  // 保存到storage.local
  try {
    await chrome.storage.local.set({ apiKeys });
    console.log('API密钥已保存');
    showMessage('API密钥已保存成功!', 'success');
  } catch (error) {
    console.error('保存API密钥出错:', error);
    showMessage('保存API密钥失败: ' + error.message, 'error');
  }
}

// 保存API端点
async function saveApiEndpoints() {
  console.log('正在保存API端点');
  
  const openai = document.getElementById('openai-endpoint').value.trim();
  const anthropic = document.getElementById('anthropic-endpoint').value.trim();
  const deepseek = document.getElementById('deepseek-endpoint').value.trim();
  const qwen3 = document.getElementById('qwen3-endpoint').value.trim();
  
  // 创建API端点对象
  const apiEndpoints = {};
  if (openai) apiEndpoints.openai = openai;
  if (anthropic) apiEndpoints.anthropic = anthropic;
  if (deepseek) apiEndpoints.deepseek = deepseek;
  if (qwen3) apiEndpoints.qwen3 = qwen3;
  
  // 保存到storage.local
  try {
    await chrome.storage.local.set({ apiEndpoints });
    console.log('API端点已保存');
    showMessage('API端点已保存成功!', 'success');
  } catch (error) {
    console.error('保存API端点出错:', error);
    showMessage('保存API端点失败: ' + error.message, 'error');
  }
} 