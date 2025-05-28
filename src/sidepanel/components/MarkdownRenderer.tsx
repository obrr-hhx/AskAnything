import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import rehypeRaw from 'rehype-raw';
import remarkMath from 'remark-math';
import remarkGfm from 'remark-gfm';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import './MarkdownRenderer.css';
import './katex-override.css';

interface MarkdownRendererProps {
  content: string;
}

// 与ReactMarkdown组件兼容的代码组件接口
interface CodeProps {
  node?: any;
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
  [key: string]: any;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  // 预处理内容，确保<details>标签在Markdown中正确显示
  const processedContent = content;
  
  return (
    <div className="markdown-content">
      <ReactMarkdown
        rehypePlugins={[
          rehypeRaw, 
          [rehypeKatex, { 
            output: 'html', 
            throwOnError: false,
            trust: true,
            strict: false,
            macros: {
              // 添加常用的数学宏
              "\\P": "\\mathbb{P}"
            }
          }]
        ]} 
        remarkPlugins={[
          remarkGfm,
          [remarkMath, { 
            singleDollarTextMath: true 
          }]
        ]}
        components={{
          code({ node, inline, className, children, ...props }: CodeProps) {
            const match = /language-(\w+)/.exec(className || '');
            return !inline && match ? (
              <SyntaxHighlighter
                style={vscDarkPlus as { [key: string]: React.CSSProperties }}
                language={match[1]}
                PreTag="div"
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          // 自定义表格组件
          table: ({ node, ...props }) => (
            <div className="table-container">
              <table {...props} />
            </div>
          ),
          // 自定义span标签的渲染，确保行内公式正确显示
          span: ({ node, className, children, ...props }) => {
            // 为行内公式元素添加特殊处理
            if (className && className.includes('math-inline')) {
              return (
                <span 
                  className={className} 
                  {...props} 
                  style={{ 
                    display: 'inline', 
                    whiteSpace: 'nowrap',
                    position: 'relative',
                    verticalAlign: 'baseline',
                    top: '0.5em' // 保持行内公式的下移
                  }}
                >
                  {children}
                </span>
              );
            }
            // 为块级公式添加特殊处理
            else if (className && className.includes('math-display')) {
              return (
                <span 
                  className={className} 
                  {...props} 
                  style={{ 
                    display: 'block', 
                    overflow: 'visible',
                    padding: '0.5em 0',
                    margin: '1em 0',
                    position: 'relative',
                    width: '100%'
                  }}
                >
                  {children}
                </span>
              );
            }
            return <span className={className} {...props}>{children}</span>;
          },
          // 自定义其他元素的渲染
          a: ({ node, ...props }) => (
            <a target="_blank" rel="noopener noreferrer" {...props} />
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer; 