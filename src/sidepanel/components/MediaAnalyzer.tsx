import React, { useState, useRef, useCallback } from 'react';

interface MediaAnalyzerProps {
  onImageSelect: (file: File, dataUrl: string) => void;
  onImageRemove: () => void;
  onVideoAnalyze: (videoUrl: string, analysisType?: string, focusKeywords?: string) => void;
  selectedImage: string;
  disabled?: boolean;
}

const MediaAnalyzer: React.FC<MediaAnalyzerProps> = ({
  onImageSelect,
  onImageRemove,
  onVideoAnalyze,
  selectedImage,
  disabled = false
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'image' | 'video'>('image');
  const [videoUrl, setVideoUrl] = useState('');
  const [analysisType, setAnalysisType] = useState('summary');
  const [focusKeywords, setFocusKeywords] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropSuccessMessage, setDropSuccessMessage] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  // 检查是否为有效的B站URL
  const isValidBilibiliUrl = (url: string): boolean => {
    return url.includes('bilibili.com') || url.includes('b23.tv');
  };

  // 处理文件选择
  const handleFileSelect = useCallback((file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        onImageSelect(file, dataUrl);
      };
      reader.readAsDataURL(file);
    }
  }, [onImageSelect]);

  // 处理文件输入变化
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
      setIsExpanded(false);
    }
  };

  // 处理拖拽
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (disabled) return;

    // 处理拖拽的文件（本地文件）
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      handleFileSelect(imageFile);
      setActiveTab('image');
      setIsExpanded(true);
      setDropSuccessMessage('✅ 图片上传成功！');
      setTimeout(() => setDropSuccessMessage(''), 2000);
      return;
    }

    // 处理拖拽的URI列表（网页图片或链接）
    const uriList = e.dataTransfer.getData('text/uri-list');
    
    if (uriList) {
      const urls = uriList.split('\n').filter(url => url.trim() && !url.startsWith('#'));
      
      for (const url of urls) {
        const trimmedUrl = url.trim();
        
        // 检查是否是图片URL
        if (trimmedUrl.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i)) {
          // 创建一个临时的图片元素来加载网络图片
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            // 将图片转换为canvas然后转为blob
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx?.drawImage(img, 0, 0);
            
            canvas.toBlob((blob) => {
              if (blob) {
                const reader = new FileReader();
                reader.onload = (e) => {
                  const dataUrl = e.target?.result as string;
                  onImageSelect(new File([blob], 'dragged-image.png', { type: blob.type }), dataUrl);
                };
                reader.readAsDataURL(blob);
              }
            });
          };
          img.onerror = () => {
            // 如果图片加载失败，当作普通URL处理
            if (isValidBilibiliUrl(trimmedUrl)) {
              setVideoUrl(trimmedUrl);
              setActiveTab('video');
              setIsExpanded(true);
              setDropSuccessMessage('✅ 视频链接已添加！');
              setTimeout(() => setDropSuccessMessage(''), 2000);
            }
          };
          img.src = trimmedUrl;
          
          setActiveTab('image');
          setIsExpanded(true);
          setDropSuccessMessage('✅ 网络图片已添加！');
          setTimeout(() => setDropSuccessMessage(''), 2000);
          return;
        }
        
        // 检查是否是B站视频链接
        if (isValidBilibiliUrl(trimmedUrl)) {
          setVideoUrl(trimmedUrl);
          setActiveTab('video');
          setIsExpanded(true);
          setDropSuccessMessage('✅ 视频链接已添加！');
          setTimeout(() => setDropSuccessMessage(''), 2000);
          return;
        }
      }
    }

    // 处理拖拽的纯文本（备用方案）
    const droppedText = e.dataTransfer.getData('text/plain');
    if (droppedText && isValidBilibiliUrl(droppedText)) {
      setVideoUrl(droppedText.trim());
      setActiveTab('video');
      setIsExpanded(true);
      setDropSuccessMessage('✅ 视频链接已添加！');
      setTimeout(() => setDropSuccessMessage(''), 2000);
      return;
    }

    // 如果有文本内容但不是有效的B站链接
    if (droppedText && droppedText.trim()) {
      setVideoUrl(droppedText.trim());
      setActiveTab('video');
      setIsExpanded(true);
      setDropSuccessMessage('⚠️ 请检查视频链接格式');
      setTimeout(() => setDropSuccessMessage(''), 3000);
    } else {
      setDropSuccessMessage('⚠️ 不支持的内容类型');
      setTimeout(() => setDropSuccessMessage(''), 2000);
    }
  };

  // 处理视频分析
  const handleVideoAnalyze = () => {
    if (!videoUrl.trim()) {
      alert('请输入B站视频链接');
      return;
    }

    if (!isValidBilibiliUrl(videoUrl)) {
      alert('请输入有效的B站视频链接');
      return;
    }

    onVideoAnalyze(videoUrl.trim(), analysisType, focusKeywords.trim() || undefined);
    setIsExpanded(false);
  };

  // 处理粘贴事件
  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && isValidBilibiliUrl(text)) {
        setVideoUrl(text);
      }
    } catch (error) {
      console.error('读取剪贴板失败:', error);
    }
  };

  // 清空输入
  const handleClear = () => {
    if (activeTab === 'image') {
      onImageRemove();
    } else {
      setVideoUrl('');
      setFocusKeywords('');
      setAnalysisType('summary');
    }
  };

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="media-analyzer">
      {/* 主按钮 */}
      <button
        className={`media-analyzer-button ${disabled ? 'disabled' : ''} ${isDragOver ? 'drag-over' : ''}`}
        onClick={handleToggle}
        disabled={disabled}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        title="多媒体分析 - 拖拽图片或视频链接到此处"
      >
        <span className="media-icon">🎭</span>
        {(selectedImage || videoUrl) && (
          <span className="selected-indicator">
            {selectedImage ? '📷' : '🎬'}
          </span>
        )}
      </button>

      {/* 拖拽成功提示 */}
      {dropSuccessMessage && (
        <div className={`drop-success-message ${dropSuccessMessage.includes('⚠️') ? 'warning' : 'success'}`}>
          {dropSuccessMessage}
        </div>
      )}

      {/* 展开的分析面板 */}
      {isExpanded && (
        <div className="media-analyzer-panel">
          {/* 标签切换 */}
          <div className="media-tabs" data-active-tab={activeTab}>
            <button
              type="button"
              className={`tab-button ${activeTab === 'image' ? 'active' : ''}`}
              onClick={() => setActiveTab('image')}
              disabled={disabled}
            >
              📷 图片分析
            </button>
            <button
              type="button"
              className={`tab-button ${activeTab === 'video' ? 'active' : ''}`}
              onClick={() => setActiveTab('video')}
              disabled={disabled}
            >
              🎬 视频分析
            </button>
          </div>

          {/* 图片分析面板 */}
          {activeTab === 'image' && (
            <div className="image-panel">
              {selectedImage ? (
                <div className="selected-image-preview">
                  <img src={selectedImage} alt="选择的图片" />
                  <button
                    type="button"
                    onClick={handleClear}
                    className="remove-image-button"
                    title="移除图片"
                    disabled={disabled}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div className="image-upload-area">
                  <div
                    className={`upload-zone ${isDragOver ? 'drag-over' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <div className="upload-icon">📷</div>
                    <div className="upload-text">
                      <p>点击上传图片或拖拽到此处</p>
                      <p className="upload-hint">支持 JPG、PNG、GIF、WebP、BMP、SVG</p>
                      <p className="upload-hint">💡 也可以直接拖拽到下方的多媒体分析按钮</p>
                    </div>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileInputChange}
                    style={{ display: 'none' }}
                    disabled={disabled}
                  />
                </div>
              )}
            </div>
          )}

          {/* 视频分析面板 */}
          {activeTab === 'video' && (
            <div className="video-panel">
              <div className="video-url-input-group">
                <input
                  ref={videoInputRef}
                  type="text"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="粘贴B站视频链接 (bilibili.com 或 b23.tv)"
                  className="video-url-input"
                  disabled={disabled}
                />
                <button
                  type="button"
                  onClick={handlePaste}
                  className="paste-button"
                  title="从剪贴板粘贴"
                  disabled={disabled}
                >
                  📋
                </button>
                <button
                  type="button"
                  onClick={handleClear}
                  className="clear-button"
                  title="清空"
                  disabled={disabled}
                >
                  ✕
                </button>
              </div>

              <div className="analysis-options">
                <div className="option-group">
                  <label htmlFor="analysis-type">分析类型:</label>
                  <select
                    id="analysis-type"
                    value={analysisType}
                    onChange={(e) => setAnalysisType(e.target.value)}
                    className="analysis-type-select"
                    disabled={disabled}
                  >
                    <option value="summary">内容摘要</option>
                    <option value="chapters">章节划分</option>
                    <option value="highlights">重点时刻</option>
                    <option value="full">完整分析</option>
                  </select>
                </div>

                <div className="option-group">
                  <label htmlFor="focus-keywords">关注关键词:</label>
                  <input
                    id="focus-keywords"
                    type="text"
                    value={focusKeywords}
                    onChange={(e) => setFocusKeywords(e.target.value)}
                    placeholder="可选：输入你关注的关键词"
                    className="keywords-input"
                    disabled={disabled}
                  />
                </div>
              </div>

              <div className="analyzer-actions">
                <button
                  type="button"
                  onClick={handleVideoAnalyze}
                  className="analyze-button"
                  disabled={disabled || !videoUrl.trim()}
                >
                  开始分析
                </button>
              </div>

              <div className="analyzer-tips">
                <p>💡 支持的链接格式：</p>
                <ul>
                  <li>https://www.bilibili.com/video/BV...</li>
                  <li>https://b23.tv/BV...</li>
                  <li>https://www.bilibili.com/video/av...</li>
                </ul>
                <p className="upload-hint">💡 也可以直接拖拽视频链接到下方的多媒体分析按钮</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MediaAnalyzer; 