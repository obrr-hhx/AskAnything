import React, { useState, useRef, useCallback } from 'react';
import './ImageUploader.css';

interface ImageUploaderProps {
  onImageSelect: (file: File, dataUrl: string) => void;
  onRemove: () => void;
  selectedImage?: string;
  disabled?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({
  onImageSelect,
  onRemove,
  selectedImage,
  disabled = false
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理从URL加载图片
  const handleImageFromUrl = useCallback(async (imageUrl: string) => {
    try {
      console.log('[ImageUploader] 开始从URL加载图片:', imageUrl);
      
      // 创建一个临时图片元素来检查图片是否有效
      const img = new Image();
      img.crossOrigin = 'anonymous'; // 尝试处理跨域问题
      
      img.onload = () => {
        // 创建canvas来转换图片为data URL
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          alert('无法处理图片');
          return;
        }
        
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
        
        try {
          const dataUrl = canvas.toDataURL('image/png');
          
          // 创建一个虚拟的File对象
          const fileName = imageUrl.split('/').pop() || 'web-image.png';
          const virtualFile = new File([dataUrl], fileName, { type: 'image/png' });
          
          console.log('[ImageUploader] 网页图片加载成功:', fileName);
          onImageSelect(virtualFile, dataUrl);
        } catch (canvasError) {
          console.error('[ImageUploader] Canvas转换失败:', canvasError);
          alert('无法处理此图片，可能存在跨域限制');
        }
      };
      
      img.onerror = () => {
        console.error('[ImageUploader] 图片加载失败:', imageUrl);
        alert('无法加载图片，请检查图片链接或尝试保存到本地后上传');
      };
      
      img.src = imageUrl;
    } catch (error) {
      console.error('[ImageUploader] 处理网页图片时出错:', error);
      alert('处理图片时出现错误');
    }
  }, [onImageSelect]);

  // 处理文件选择
  const handleFileSelect = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('请选择图片文件');
      return;
    }

    // 检查文件大小 (限制为10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('图片文件大小不能超过10MB');
      return;
    }

    // 读取文件为Data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        onImageSelect(file, e.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  }, [onImageSelect]);

  // 处理点击上传
  const handleClick = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  // 处理文件输入变化
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // 处理拖拽事件
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (disabled) return;

    console.log('[ImageUploader] 拖拽事件数据:', e.dataTransfer);

    // 优先处理文件拖拽（从本地文件系统）
    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      console.log('[ImageUploader] 检测到本地图片文件:', imageFile.name);
      handleFileSelect(imageFile);
      return;
    }

    // 处理从网页拖拽的图片（URL或HTML）
    const htmlData = e.dataTransfer.getData('text/html');
    const urlData = e.dataTransfer.getData('text/uri-list');
    const textData = e.dataTransfer.getData('text/plain');
    
    console.log('[ImageUploader] 拖拽数据类型:', {
      hasHtml: !!htmlData,
      hasUrl: !!urlData, 
      hasText: !!textData
    });

    let imageUrl = '';

    // 从HTML数据中提取图片URL（拖拽网页中的图片）
    if (htmlData) {
      const imgMatch = htmlData.match(/<img[^>]+src=["']([^"']+)["'][^>]*>/i);
      if (imgMatch && imgMatch[1]) {
        imageUrl = imgMatch[1];
        console.log('[ImageUploader] 从HTML提取图片URL:', imageUrl);
      }
    }
    
    // 从URL数据中获取（拖拽地址栏或链接）
    if (!imageUrl && urlData) {
      // 检查URL是否指向图片
      const url = urlData.trim();
      if (url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i)) {
        imageUrl = url;
        console.log('[ImageUploader] 从URL数据获取图片链接:', imageUrl);
      }
    }
    
    // 从纯文本中获取图片URL（作为备选）
    if (!imageUrl && textData) {
      const url = textData.trim();
      if (url.match(/^https?:\/\/.*\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i)) {
        imageUrl = url;
        console.log('[ImageUploader] 从文本数据获取图片链接:', imageUrl);
      }
    }

    if (imageUrl) {
      // 处理相对URL
      if (imageUrl.startsWith('//')) {
        imageUrl = 'https:' + imageUrl;
      } else if (imageUrl.startsWith('/')) {
        // 需要获取当前页面的域名，但在插件中可能无法直接获取
        console.warn('[ImageUploader] 相对路径图片可能无法处理:', imageUrl);
        alert('相对路径的图片无法处理，请尝试右键保存图片后上传');
        return;
      }
      
      console.log('[ImageUploader] 开始处理网页图片:', imageUrl);
      handleImageFromUrl(imageUrl);
    } else {
      console.log('[ImageUploader] 未检测到有效的图片数据');
      alert('请拖拽图片文件或网页中的图片');
    }
  };

  return (
    <>
      {/* 胶囊按钮样式 */}
      <button
        type="button"
        className={`image-upload-button ${selectedImage ? 'has-image' : ''} ${isDragOver ? 'drag-over' : ''} ${disabled ? 'disabled' : ''}`}
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        disabled={disabled}
        title="点击或拖拽上传图片（支持本地文件和网页图片）"
      >
        <span className="upload-icon">📷</span>
        {selectedImage ? (
          <>
            <span>已选择图片</span>
            <button
              type="button"
              className="remove-image-mini-button"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              title="移除图片"
            >
              ×
            </button>
          </>
        ) : (
          <span>上传图片</span>
        )}
      </button>
      
      {/* 隐藏的文件输入 */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        disabled={disabled}
      />
      
      {/* 如果有选择的图片，在按钮下方显示预览 */}
      {selectedImage && (
        <div className="image-preview-popup">
          <img src={selectedImage} alt="已选择的图片" />
        </div>
      )}
    </>
  );
};

export default ImageUploader; 