import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { writeFileSync, copyFileSync, mkdirSync, existsSync, readFileSync } from 'fs';

// 自定义插件：复制必要文件到dist目录
const copyManifestPlugin = () => {
  return {
    name: 'copy-manifest',
    closeBundle: () => {
      // 复制manifest.json
      copyFileSync('manifest.json', 'dist/manifest.json');
      
      // 复制options.html，而不是硬编码创建
      if (existsSync('src/options/options.html')) {
        console.log('复制options.html文件到dist目录');
        copyFileSync('src/options/options.html', 'dist/options.html');
      } else {
        console.warn('src/options/options.html文件不存在，使用默认options.html');
        // 创建默认的options.html
        const optionsHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AskAnything 选项</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      color: #2c3e50;
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      font-weight: bold;
    }
    input[type="text"], 
    input[type="password"] {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 16px;
    }
    button {
      background-color: #3498db;
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 16px;
    }
    button:hover {
      background-color: #2980b9;
    }
    .alert {
      padding: 10px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .alert-success {
      background-color: #d4edda;
      color: #155724;
      border: 1px solid #c3e6cb;
    }
    .alert-error {
      background-color: #f8d7da;
      color: #721c24;
      border: 1px solid #f5c6cb;
    }
    .hidden {
      display: none;
    }
    .model-section {
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }
    .toggle-password {
      background: none;
      border: none;
      color: #3498db;
      padding: 0;
      font-size: 14px;
      margin-top: 5px;
      cursor: pointer;
    }
  </style>
  <script type="module" src="./options.js"></script>
</head>
<body>
  <h1>AskAnything - API密钥设置</h1>
  
  <div id="status-message" class="alert hidden"></div>
  
  <div class="form-group">
    <label for="openai-api-key">OpenAI API密钥 (ChatGPT)</label>
    <input type="password" id="openai-api-key" placeholder="sk-..." autocomplete="off">
    <button class="toggle-password" data-target="openai-api-key">显示/隐藏</button>
    <p>用于ChatGPT模型的调用。<a href="https://platform.openai.com/account/api-keys" target="_blank">获取OpenAI API密钥</a></p>
  </div>
  
  <div class="form-group">
    <label for="anthropic-api-key">Anthropic API密钥 (Claude)</label>
    <input type="password" id="anthropic-api-key" placeholder="sk-ant-..." autocomplete="off">
    <button class="toggle-password" data-target="anthropic-api-key">显示/隐藏</button>
    <p>用于Claude模型的调用。<a href="https://console.anthropic.com/settings/keys" target="_blank">获取Anthropic API密钥</a></p>
  </div>
  
  <div class="form-group">
    <label for="deepseek-api-key">DeepSeek API密钥</label>
    <input type="password" id="deepseek-api-key" placeholder="..." autocomplete="off">
    <button class="toggle-password" data-target="deepseek-api-key">显示/隐藏</button>
    <p>用于DeepSeek模型的调用。<a href="https://platform.deepseek.com/" target="_blank">获取DeepSeek API密钥</a></p>
  </div>
  
  <div class="form-group">
    <label for="qwen-api-key">通义千问 API密钥</label>
    <input type="password" id="qwen-api-key" placeholder="..." autocomplete="off">
    <button class="toggle-password" data-target="qwen-api-key">显示/隐藏</button>
    <p>用于通义千问模型的调用。<a href="https://help.aliyun.com/document_detail/611472.html" target="_blank">获取通义千问API密钥</a></p>
  </div>
  
  <button id="save-button">保存设置</button>
  
  <div class="model-section">
    <h2>API端点设置 (可选)</h2>
    <p>如果你使用自定义API端点，可以在下方设置。如不填写，将使用默认设置。</p>
    
    <div class="form-group">
      <label for="openai-endpoint">OpenAI API端点</label>
      <input type="text" id="openai-endpoint" placeholder="https://api.openai.com/v1">
    </div>
    
    <div class="form-group">
      <label for="anthropic-endpoint">Anthropic API端点</label>
      <input type="text" id="anthropic-endpoint" placeholder="https://api.anthropic.com/v1">
    </div>
    
    <div class="form-group">
      <label for="deepseek-endpoint">DeepSeek API端点</label>
      <input type="text" id="deepseek-endpoint" placeholder="https://api.deepseek.com/v1">
    </div>
    
    <div class="form-group">
      <label for="qwen-endpoint">通义千问 API端点</label>
      <input type="text" id="qwen-endpoint" placeholder="https://dashscope.aliyuncs.com/api/v1">
    </div>
    
    <button id="save-endpoints-button">保存端点设置</button>
  </div>
</body>
</html>`;
      
        writeFileSync('dist/options.html', optionsHtml);
      }
      
      // 创建图标目录
      if (!existsSync('dist/assets')) {
        mkdirSync('dist/assets', { recursive: true });
      }
      
      // 复制图标文件
      if (existsSync('assets/icon16.png')) {
        copyFileSync('assets/icon16.png', 'dist/assets/icon16.png');
      }
      if (existsSync('assets/icon48.png')) {
        copyFileSync('assets/icon48.png', 'dist/assets/icon48.png');
      }
      if (existsSync('assets/icon128.png')) {
        copyFileSync('assets/icon128.png', 'dist/assets/icon128.png');
      }
      if (existsSync('assets/icon.svg')) {
        copyFileSync('assets/icon.svg', 'dist/assets/icon.svg');
      }
      
      // 创建sidepanel.html文件
      const sidepanelHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AskAnything</title>
  <link rel="stylesheet" href="./assets/sidepanel.css" />
  <script type="module" src="./sidepanel.js"></script>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;
      
      writeFileSync('dist/sidepanel.html', sidepanelHtml);
    }
  };
};

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), copyManifestPlugin()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    rollupOptions: {
      input: {
        'service-worker': resolve(__dirname, 'src/service-worker.ts'),
        'content-script': resolve(__dirname, 'src/content-script.ts'),
        'options': resolve(__dirname, 'src/options/options.js'),
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[ext]',
      },
      external: [],
    },
    // 确保OpenAI SDK正确打包
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    sourcemap: true,
  },
}); 