/// <reference types="chrome"/>

// 处理JSX元素类型错误
interface Window {
  // 扩展Window接口
  chrome: typeof chrome;
}

// 处理Node.js相关变量
declare const __dirname: string;

// 解决模块导入问题
declare module '*.css' {
  const classes: { [key: string]: string };
  export default classes;
}

declare module '*.svg' {
  const ReactComponent: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  export default ReactComponent;
} 