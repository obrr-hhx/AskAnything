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

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      handleFileSelect(imageFile);
    } else {
      alert('请拖拽图片文件');
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
        title="点击或拖拽上传图片"
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