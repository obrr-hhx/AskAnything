require('dotenv').config();
const { OpenAI } = require('openai');

// 获取API密钥
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_KEY;

// 检查API密钥是否存在
if (!DEEPSEEK_API_KEY) {
  console.error('错误: 请在.env文件中设置DEEPSEEK_KEY环境变量');
  process.exit(1);
}

// 创建OpenAI客户端实例，但指向DeepSeek API
const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: DEEPSEEK_API_KEY,
});

async function testWithSDK() {
  console.log('开始使用OpenAI SDK测试DeepSeek API...');
  
  try {
    // 不使用流式响应
    console.log('发送普通请求...');
    const completion = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一个有帮助的AI助手。' },
        { role: 'user', content: '请简短介绍一下DeepSeek模型。' }
      ],
      temperature: 0.7,
    });
    
    console.log('响应结构:', JSON.stringify(completion, null, 2));
    console.log('\n生成的内容:');
    console.log('-------------------');
    console.log(completion.choices[0].message.content);
    console.log('-------------------');
    
    // 使用流式响应
    console.log('\n发送流式请求...');
    const stream = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: '你是一个有帮助的AI助手。' },
        { role: 'user', content: '请列出3个学习编程的技巧。' }
      ],
      temperature: 0.7,
      stream: true,
    });
    
    console.log('流式响应开始接收:');
    console.log('-------------------');
    let fullText = '';
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) {
        fullText += content;
        process.stdout.write(content);
      }
    }
    
    console.log('\n-------------------');
    console.log('流式响应完成，总长度:', fullText.length);
    
    console.log('\n✅ OpenAI SDK测试成功！');
    console.log('如果浏览器扩展仍不工作，请确认以下几点:');
    console.log('1. 扩展中的baseURL设置为 https://api.deepseek.com (不带v1)');
    console.log('2. API密钥格式正确 (与本测试相同)');
    
    return true;
  } catch (error) {
    console.error('使用SDK测试时出错:', error);
    console.error('\nAPI调用详情:', {
      message: error.message,
      status: error.status,
      type: error.type,
    });
    
    if (error.response) {
      console.error('错误响应:', await error.response.text());
    }
    
    console.log('\n❌ OpenAI SDK测试失败。');
    console.log('建议:');
    console.log('1. 检查API密钥是否正确');
    console.log('2. 确认密钥有效且具有足够权限');
    console.log('3. 检查网络连接');
    
    return false;
  }
}

testWithSDK(); 