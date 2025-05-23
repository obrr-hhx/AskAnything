import React, { useState, useEffect, useRef, useCallback } from 'react';
import MarkdownRenderer from './MarkdownRenderer';
import './NoteBrowser.css';

interface NoteBrowserProps {
  onBack: () => void; // 返回到主页面的回调
}

// 定义笔记类型
interface Note {
  id: string;
  title: string;
  content: string;
  lastModified: Date;
  fileName?: string; // 改为可选的文件名字段
}

const NoteBrowser: React.FC<NoteBrowserProps> = ({ onBack: _ }) => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [showNotesList, setShowNotesList] = useState(false);
  const [editorMode, setEditorMode] = useState<'split' | 'normal'>('normal'); // 编辑器模式
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 加载笔记列表
  useEffect(() => {
    const loadNotes = async () => {
      try {
        // 从本地存储加载笔记
        const storedNotes = await chrome.storage.local.get('markdown_notes');
        if (storedNotes.markdown_notes) {
          setNotes(storedNotes.markdown_notes);
        }
      } catch (error) {
        console.error('加载笔记失败:', error);
      }
    };

    loadNotes();
  }, []);

  // 打开文件选择器
  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  // 处理文件选择
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const importedNotes: Note[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // 检查是否为Markdown文件
      if (!file.name.toLowerCase().endsWith('.md')) {
        console.warn(`跳过非Markdown文件: ${file.name}`);
        continue;
      }
      
      try {
        // 读取文件内容
        const content = await readFileAsText(file);
        
        // 从内容提取标题，默认使用文件名
        let title = file.name.replace(/\.md$/i, '');
        const titleMatch = content.match(/^# (.+)$/m);
        if (titleMatch && titleMatch[1]) {
          title = titleMatch[1];
        }
        
        // 创建新笔记对象
        const newNote: Note = {
          id: `local-${Date.now()}-${i}`,
          title,
          content,
          lastModified: new Date(file.lastModified),
          fileName: file.name
        };
        
        importedNotes.push(newNote);
      } catch (error) {
        console.error(`读取文件 ${file.name} 时出错:`, error);
      }
    }
    
    if (importedNotes.length > 0) {
      const updatedNotes = [...notes, ...importedNotes];
      
      // 保存到存储
      await chrome.storage.local.set({ markdown_notes: updatedNotes });
      
      // 更新状态
      setNotes(updatedNotes);
      
      // 选择第一个导入的笔记
      setSelectedNote(importedNotes[0]);
      setEditContent(importedNotes[0].content);
      // 导入完成后隐藏笔记列表
      setShowNotesList(false);
    }
    
    // 重置文件输入框
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 读取文件内容为文本
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        if (event.target?.result) {
          resolve(event.target.result as string);
        } else {
          reject(new Error('读取文件失败，未返回内容'));
        }
      };
      
      reader.onerror = (error) => {
        reject(error);
      };
      
      reader.readAsText(file);
    });
  };

  // 保存笔记
  const saveNote = async (noteToSave: Note) => {
    try {
      const updatedNotes = notes.map(note => 
        note.id === noteToSave.id ? noteToSave : note
      );
      
      // 如果是新笔记，添加到列表
      if (!notes.find(note => note.id === noteToSave.id)) {
        updatedNotes.push(noteToSave);
      }
      
      await chrome.storage.local.set({ markdown_notes: updatedNotes });
      setNotes(updatedNotes);
      return true;
    } catch (error) {
      console.error('保存笔记失败:', error);
      return false;
    }
  };

  // 创建新笔记
  const createNewNote = () => {
    const newNote: Note = {
      id: Date.now().toString(),
      title: '新笔记',
      content: '# 新笔记\n\n开始编写你的笔记...',
      lastModified: new Date()
    };
    
    setSelectedNote(newNote);
    setEditContent(newNote.content);
    setIsEditing(true);
    setShowNotesList(false);
  };

  // 保存编辑内容
  const saveEdit = async () => {
    if (!selectedNote) return;
    
    const updatedNote = {
      ...selectedNote,
      content: editContent,
      lastModified: new Date()
    };
    
    // 从标题行提取标题
    const titleMatch = editContent.match(/^# (.+)$/m);
    if (titleMatch && titleMatch[1]) {
      updatedNote.title = titleMatch[1];
    }
    
    const success = await saveNote(updatedNote);
    if (success) {
      setSelectedNote(updatedNote);
      setIsEditing(false);
    }
  };

  // 取消编辑
  const cancelEdit = () => {
    setIsEditing(false);
    if (selectedNote) {
      setEditContent(selectedNote.content);
    }
  };

  // 处理选择笔记
  const handleSelectNote = (note: Note) => {
    setSelectedNote(note);
    setEditContent(note.content);
    setIsEditing(false);
    setShowNotesList(false); // 选择笔记后隐藏笔记列表
  };

  // 导出当前笔记
  const exportCurrentNote = () => {
    if (!selectedNote) return;
    
    // 创建Blob对象
    const blob = new Blob([selectedNote.content], { type: 'text/markdown' });
    
    // 创建临时下载链接
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedNote.fileName || `${selectedNote.title.replace(/[/\\?%*:|"<>]/g, '-')}.md`;
    
    // 触发下载
    document.body.appendChild(a);
    a.click();
    
    // 清理
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 0);
  };

  // 处理编辑内容变更
  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setEditContent(e.target.value);
  };

  // 监听键盘事件
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 处理特殊键
    if (e.key === 'Tab') {
      e.preventDefault();
      
      // 在光标位置插入制表符或空格
      const textarea = textareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        
        // 使用2个空格代替制表符
        const newValue = editContent.substring(0, start) + '  ' + editContent.substring(end);
        setEditContent(newValue);
        
        // 重新设置光标位置
        setTimeout(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        }, 0);
      }
    }
  };

  // 同步滚动
  const syncScroll = useCallback((sourceElement: HTMLElement, targetElement: HTMLElement) => {
    const percentage = sourceElement.scrollTop / 
                      (sourceElement.scrollHeight - sourceElement.clientHeight);
    
    const targetScrollTop = percentage * 
                           (targetElement.scrollHeight - targetElement.clientHeight);
    
    targetElement.scrollTop = targetScrollTop;
  }, []);

  // 处理分屏编辑模式的滚动同步
  useEffect(() => {
    if (editorMode === 'split' && isEditing) {
      const textarea = textareaRef.current;
      const previewDiv = document.querySelector('.preview-side');
      
      if (!textarea || !previewDiv) return;
      
      const handleEditorScroll = () => syncScroll(textarea, previewDiv as HTMLElement);
      const handlePreviewScroll = () => syncScroll(previewDiv as HTMLElement, textarea);
      
      textarea.addEventListener('scroll', handleEditorScroll);
      previewDiv.addEventListener('scroll', handlePreviewScroll);
      
      return () => {
        textarea.removeEventListener('scroll', handleEditorScroll);
        previewDiv.removeEventListener('scroll', handlePreviewScroll);
      };
    }
  }, [editorMode, isEditing, syncScroll]);

  // 保持用户手动滚动的位置，防止输入时发生位置跳动
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !isEditing) return;

    // 只保存滚动位置，不进行自动滚动
    let savedScrollTop = textarea.scrollTop;

    const handleScroll = () => {
      savedScrollTop = textarea.scrollTop;
    };

    const handleInput = () => {
      // 在输入时保持滚动位置，防止位置跳动
      requestAnimationFrame(() => {
        if (textarea.scrollTop !== savedScrollTop) {
          textarea.scrollTop = savedScrollTop;
        }
      });
    };

    textarea.addEventListener('scroll', handleScroll);
    textarea.addEventListener('input', handleInput);

    return () => {
      textarea.removeEventListener('scroll', handleScroll);
      textarea.removeEventListener('input', handleInput);
    };
  }, [isEditing]);

  // 显示笔记列表页面
  const NotesListPage = () => (
    <div className="notes-list-page">
      <div className="notes-list-header">
        <h2>选择笔记</h2>
        <button className="close-button" onClick={() => setShowNotesList(false)}>
          返回
        </button>
      </div>
      <div className="notes-list-actions">
        <button className="import-note-button" onClick={handleImportClick}>
          导入笔记
        </button>
        <button className="new-note-button" onClick={createNewNote}>
          新建笔记
        </button>
      </div>
      <div className="notes-list-content">
        {notes.length === 0 ? (
          <div className="no-notes">
            <h3>没有笔记</h3>
            <p>点击新建按钮创建一个或导入现有笔记</p>
            <div className="no-selection-buttons" style={{ marginTop: '20px' }}>
              <button className="new-note-button" onClick={createNewNote}>
                新建笔记
              </button>
              <button className="import-note-button" onClick={handleImportClick}>
                导入笔记
              </button>
            </div>
          </div>
        ) : (
          notes.map(note => (
            <div 
              key={note.id} 
              className={`note-item ${selectedNote?.id === note.id ? 'selected' : ''}`}
              onClick={() => handleSelectNote(note)}
            >
              <div className="note-title">{note.title}</div>
              {note.fileName && (
                <div className="note-filename">文件: {note.fileName}</div>
              )}
              <div className="note-date">
                {new Date(note.lastModified).toLocaleString()}
              </div>
            </div>
          ))
        )}
      </div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        accept=".md"
        multiple
      />
    </div>
  );

  // 主页面内容
  const renderMainContent = () => {
    if (!selectedNote) {
      return (
        <div className="no-selection">
          <h3>没有选择笔记</h3>
          <div className="no-selection-buttons">
            <button className="new-note-button" onClick={createNewNote}>
              新建笔记
            </button>
            <button className="browse-notes-button" onClick={() => setShowNotesList(true)}>
              浏览笔记
            </button>
          </div>
        </div>
      );
    }

    return isEditing ? (
      <div className="note-editor">
        <div className="editor-controls">
          <div className="editor-mode-toggle">
            <button 
              className={`mode-button ${editorMode === 'normal' ? 'active' : ''}`}
              onClick={() => setEditorMode('normal')}
              title="纯编辑模式"
            >
              纯编辑模式
            </button>
            <button 
              className={`mode-button ${editorMode === 'split' ? 'active' : ''}`}
              onClick={() => setEditorMode('split')}
              title="分屏模式"
            >
              分屏模式
            </button>
          </div>
          <div className="action-buttons">
            <button onClick={saveEdit}>保存</button>
            <button onClick={cancelEdit}>取消</button>
          </div>
        </div>

        {editorMode === 'normal' ? (
          <div className="normal-editor">
            <textarea
              ref={textareaRef}
              value={editContent}
              onChange={handleContentChange}
              onKeyDown={handleKeyDown}
              className="note-textarea"
              autoFocus
            />
          </div>
        ) : (
          <div className="split-editor">
            <div className="preview-side">
              <MarkdownRenderer content={editContent} />
            </div>
            <div className="editor-side">
              <textarea
                ref={textareaRef}
                value={editContent}
                onChange={handleContentChange}
                onKeyDown={handleKeyDown}
                className="note-textarea"
                autoFocus
              />
            </div>
          </div>
        )}
      </div>
    ) : (
      <div className="note-display">
        <div className="note-display-header">
          <div className="note-title-display">
            <h3>{selectedNote.title}</h3>
          </div>
          <div className="note-actions">
            <button className="browse-notes-button" onClick={() => setShowNotesList(true)}>
              所有笔记
            </button>
            <button onClick={exportCurrentNote} className="export-button">导出</button>
            <button onClick={() => setIsEditing(true)}>编辑</button>
          </div>
        </div>
        <div className="note-content">
          <MarkdownRenderer content={selectedNote.content} />
        </div>
      </div>
    );
  };

  return (
    <div className="note-browser split-mode">
      <div className="note-browser-header">
        <h2>Markdown笔记</h2>
        {!showNotesList && selectedNote && (
          <div className="current-note-info">
            <span className="current-note-title">{selectedNote.title}</span>
          </div>
        )}
      </div>

      <div className="note-browser-content">
        {showNotesList ? (
          <NotesListPage />
        ) : (
          renderMainContent()
        )}
      </div>
    </div>
  );
};

export default NoteBrowser; 