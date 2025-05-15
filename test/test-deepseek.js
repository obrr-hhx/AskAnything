require('dotenv').config();
const fetch = require('node-fetch');

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_KEY;
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/v1/chat/completions';

// 检查API密钥是否存在
if (!DEEPSEEK_API_KEY) {
  console.error('错误: 请在.env文件中设置DEEPSEEK_KEY环境变量');
  process.exit(1);
}

// 打印API密钥前几个字符用于验证
console.log(`DeepSeek API密钥前几个字符: ${DEEPSEEK_API_KEY.substring(0, 5)}...${DEEPSEEK_API_KEY.substring(DEEPSEEK_API_KEY.length - 5)}`);

// 测试普通请求
async function testDeepSeekAPI() {
  console.log('开始测试DeepSeek API (普通请求)...');
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
  };
  
  const body = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: '你是一个有帮助的AI助手。' },
      { role: 'user', content: '请简短介绍一下DeepSeek模型。' }
    ],
    temperature: 0.7,
    stream: false
  };
  
  try {
    // 输出详细信息用于调试
    console.log('DeepSeek API请求详情:');
    console.log(`- 端点: ${DEEPSEEK_ENDPOINT}`);
    console.log(`- 头部: ${JSON.stringify(headers, null, 2)}`);
    console.log(`- 请求体: ${JSON.stringify(body, null, 2)}`);
    
    // 发送请求
    const response = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    
    // 检查HTTP状态码
    console.log(`HTTP响应状态码: ${response.status} (${response.statusText})`);
    
    // 解析响应
    const data = await response.json();
    
    if (!response.ok) {
      console.error('API请求失败:');
      console.error(JSON.stringify(data, null, 2));
      return false;
    }
    
    console.log('API请求成功!');
    console.log('响应结构:', JSON.stringify(data, null, 2));
    
    // 显示生成的内容
    const content = data.choices?.[0]?.message?.content;
    console.log('\n生成的内容:');
    console.log('-------------------');
    console.log(content);
    console.log('-------------------');
    
    return true;
  } catch (error) {
    console.error('测试过程中发生错误:', error);
    return false;
  }
}

// 测试流式响应
async function testDeepSeekStreamAPI() {
  console.log('\n开始测试DeepSeek API (流式响应)...');
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
  };
  
  const body = {
    model: 'deepseek-chat',
    messages: [
      { role: 'system', content: '你是一个有帮助的AI助手。' },
      { role: 'user', content: '请列出5个编程的好习惯。' }
    ],
    temperature: 0.7,
    stream: true
  };
  
  try {
    console.log('发送流式请求...');
    
    const response = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('流式API请求失败:');
      console.error(JSON.stringify(errorData, null, 2));
      return false;
    }
    
    console.log('流式响应开始接收:');
    console.log('-------------------');
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim() !== '');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            console.log('[流结束]');
            continue;
          }
          
          try {
            const parsedData = JSON.parse(data);
            const content = parsedData.choices?.[0]?.delta?.content || '';
            
            if (content) {
              fullText += content;
              process.stdout.write(content); // 实时打印内容
            }
          } catch (error) {
            console.error('解析流响应出错:', error);
          }
        }
      }
    }
    
    console.log('\n-------------------');
    console.log('流式响应完成，总长度:', fullText.length);
    
    return true;
  } catch (error) {
    console.error('流式测试过程中发生错误:', error);
    return false;
  }
}

// 执行测试
async function runTests() {
  const normalTestResult = await testDeepSeekAPI();
  console.log(`\n普通请求测试结果: ${normalTestResult ? '成功' : '失败'}`);
  
  const streamTestResult = await testDeepSeekStreamAPI();
  console.log(`\n流式请求测试结果: ${streamTestResult ? '成功' : '失败'}`);
  
  // 扩展测试：检查浏览器扩展中可能存在的问题
  console.log('\n扩展测试建议:');
  console.log('1. 确认浏览器扩展中的API密钥格式与测试中使用的一致');
  console.log('2. 确认base URL设置为 https://api.deepseek.com 而不是带v1的版本');
  console.log('3. 确认请求格式和响应解析与此测试文件中的一致');
  
  if (normalTestResult && streamTestResult) {
    console.log('\n✅ 所有测试通过！DeepSeek API运行正常。');
    console.log('如果扩展仍然不工作，问题可能在于浏览器扩展的集成部分。');
  } else {
    console.log('\n❌ 测试失败。请检查API密钥和请求格式。');
  }
}

runTests(); 