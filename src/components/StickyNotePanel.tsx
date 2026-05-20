import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, GripHorizontal } from 'lucide-react';

interface Note {
  id: string;
  content: string;
}

interface StickyNotePanelProps {
  notes: Note[];
  onNotesChange: (notes: Note[]) => void;
  onClose: () => void;
  isOpen: boolean;
  storageKey: string;
}

const MIN_WIDTH = 250;
const MIN_HEIGHT = 200;
const HANDLE_SIZE = 20;

type ResizeHandle = 'nw' | 'n' | 'ne' | 'w' | 'e' | 'sw' | 's' | 'se';

const getHandleCursor = (handle: ResizeHandle): string => {
  switch (handle) {
    case 'nw': return 'nwse-resize';
    case 'n': return 'ns-resize';
    case 'ne': return 'nesw-resize';
    case 'w': return 'ew-resize';
    case 'e': return 'ew-resize';
    case 'sw': return 'nesw-resize';
    case 's': return 'ns-resize';
    case 'se': return 'nwse-resize';
  }
};

const getHandlePosition = (handle: ResizeHandle): React.CSSProperties => {
  const half = HANDLE_SIZE / 2;
  const style: React.CSSProperties = {
    position: 'absolute',
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    zIndex: 10,
  };

  if (handle.includes('n')) style.top = -half;
  if (handle.includes('s')) style.bottom = -half;
  if (handle.includes('w')) style.left = -half;
  if (handle.includes('e')) style.right = -half;

  if (handle === 'n' || handle === 's') {
    style.left = '50%';
    style.transform = 'translateX(-50%)';
  }
  if (handle === 'w' || handle === 'e') {
    style.top = '50%';
    style.transform = 'translateY(-50%)';
  }
  if (handle === 'nw') style.transform = 'none';
  if (handle === 'ne') style.transform = 'none';
  if (handle === 'sw') style.transform = 'none';
  if (handle === 'se') style.transform = 'none';

  return style;
};

const RESIZE_HANDLES: ResizeHandle[] = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];

export function StickyNotePanel({ notes, onNotesChange, onClose, isOpen, storageKey }: StickyNotePanelProps) {
  const [activeNoteId, setActiveNoteId] = useState<string>('');
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 400, height: 350 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  const [resizeStartMouse, setResizeStartMouse] = useState({ x: 0, y: 0 });
  const [resizeStartSize, setResizeStartSize] = useState({ width: 400, height: 350 });
  const [resizeStartPos, setResizeStartPos] = useState({ x: 100, y: 100 });
  const [isTouchDragging, setIsTouchDragging] = useState(false);
  const [isTouchResizing, setIsTouchResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    
    // Initialize activeNoteId when panel opens and notes are available
    if (!activeNoteId && notes.length > 0) {
      setActiveNoteId(notes[0].id);
    }
    
    // Reset activeNoteId if current one doesn't exist in notes anymore
    if (activeNoteId && notes.length > 0 && !notes.find(n => n.id === activeNoteId)) {
      setActiveNoteId(notes[0].id);
    }
  }, [isOpen, notes.length, activeNoteId]);

  useEffect(() => {
    if (notes.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(notes));
    }
  }, [notes, storageKey]);

  const activeNote = notes.find(n => n.id === activeNoteId);

  // === Mouse Dragging ===

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.note-content-area')) {
      return;
    }
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y,
    });
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // === Touch Dragging ===

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.note-content-area')) {
      return;
    }
    if ((e.target as HTMLElement).closest('.resize-handle')) {
      return;
    }
    e.preventDefault();
    setIsTouchDragging(true);
    const touch = e.touches[0];
    setDragOffset({
      x: touch.clientX - position.x,
      y: touch.clientY - position.y,
    });
  }, [position]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isTouchDragging) return;
    e.preventDefault();
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragOffset.x,
      y: touch.clientY - dragOffset.y,
    });
  }, [isTouchDragging, dragOffset]);

  const handleTouchEnd = useCallback(() => {
    setIsTouchDragging(false);
  }, []);

  useEffect(() => {
    if (isTouchDragging) {
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      return () => {
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isTouchDragging, handleTouchMove, handleTouchEnd]);

  // === Resize Logic ===

  const applyResize = useCallback((dx: number, dy: number, handle: ResizeHandle) => {
    let newWidth = resizeStartSize.width;
    let newHeight = resizeStartSize.height;
    let newX = resizeStartPos.x;
    let newY = resizeStartPos.y;

    switch (handle) {
      case 'e':
        newWidth = Math.max(MIN_WIDTH, resizeStartSize.width + dx);
        break;
      case 'w':
        newWidth = Math.max(MIN_WIDTH, resizeStartSize.width - dx);
        newX = resizeStartPos.x + (resizeStartSize.width - newWidth);
        break;
      case 's':
        newHeight = Math.max(MIN_HEIGHT, resizeStartSize.height + dy);
        break;
      case 'n':
        newHeight = Math.max(MIN_HEIGHT, resizeStartSize.height - dy);
        newY = resizeStartPos.y + (resizeStartSize.height - newHeight);
        break;
      case 'se':
        newWidth = Math.max(MIN_WIDTH, resizeStartSize.width + dx);
        newHeight = Math.max(MIN_HEIGHT, resizeStartSize.height + dy);
        break;
      case 'sw':
        newWidth = Math.max(MIN_WIDTH, resizeStartSize.width - dx);
        newX = resizeStartPos.x + (resizeStartSize.width - newWidth);
        newHeight = Math.max(MIN_HEIGHT, resizeStartSize.height + dy);
        break;
      case 'ne':
        newWidth = Math.max(MIN_WIDTH, resizeStartSize.width + dx);
        newHeight = Math.max(MIN_HEIGHT, resizeStartSize.height - dy);
        newY = resizeStartPos.y + (resizeStartSize.height - newHeight);
        break;
      case 'nw':
        newWidth = Math.max(MIN_WIDTH, resizeStartSize.width - dx);
        newX = resizeStartPos.x + (resizeStartSize.width - newWidth);
        newHeight = Math.max(MIN_HEIGHT, resizeStartSize.height - dy);
        newY = resizeStartPos.y + (resizeStartSize.height - newHeight);
        break;
    }

    setSize({ width: newWidth, height: newHeight });
    setPosition({ x: newX, y: newY });
  }, [resizeStartSize, resizeStartPos]);

  // === Mouse Resize ===

  const handleResizeMouseDown = useCallback((e: React.MouseEvent, handle: ResizeHandle) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeHandle(handle);
    setResizeStartMouse({ x: e.clientX, y: e.clientY });
    setResizeStartSize({ width: size.width, height: size.height });
    setResizeStartPos({ x: position.x, y: position.y });
  }, [size, position]);

  const handleResizeMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !resizeHandle) return;

    const dx = e.clientX - resizeStartMouse.x;
    const dy = e.clientY - resizeStartMouse.y;

    applyResize(dx, dy, resizeHandle);
  }, [isResizing, resizeHandle, resizeStartMouse, resizeStartSize, resizeStartPos, applyResize]);

  const handleResizeMouseUp = useCallback(() => {
    setIsResizing(false);
    setResizeHandle(null);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMouseMove);
      document.addEventListener('mouseup', handleResizeMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleResizeMouseMove);
        document.removeEventListener('mouseup', handleResizeMouseUp);
      };
    }
  }, [isResizing, handleResizeMouseMove, handleResizeMouseUp]);

  // === Touch Resize ===

  const handleResizeTouchStart = useCallback((e: React.TouchEvent, handle: ResizeHandle) => {
    e.preventDefault();
    e.stopPropagation();
    setIsTouchResizing(true);
    setResizeHandle(handle);
    const touch = e.touches[0];
    setResizeStartMouse({ x: touch.clientX, y: touch.clientY });
    setResizeStartSize({ width: size.width, height: size.height });
    setResizeStartPos({ x: position.x, y: position.y });
  }, [size, position]);

  const handleResizeTouchMove = useCallback((e: TouchEvent) => {
    if (!isTouchResizing || !resizeHandle) return;
    e.preventDefault();

    const touch = e.touches[0];
    const dx = touch.clientX - resizeStartMouse.x;
    const dy = touch.clientY - resizeStartMouse.y;

    applyResize(dx, dy, resizeHandle);
  }, [isTouchResizing, resizeHandle, resizeStartMouse, resizeStartSize, resizeStartPos, applyResize]);

  const handleResizeTouchEnd = useCallback(() => {
    setIsTouchResizing(false);
    setResizeHandle(null);
  }, []);

  useEffect(() => {
    if (isTouchResizing) {
      document.addEventListener('touchmove', handleResizeTouchMove, { passive: false });
      document.addEventListener('touchend', handleResizeTouchEnd);
      return () => {
        document.removeEventListener('touchmove', handleResizeTouchMove);
        document.removeEventListener('touchend', handleResizeTouchEnd);
      };
    }
  }, [isTouchResizing, handleResizeTouchMove, handleResizeTouchEnd]);

  const handleAddNote = () => {
    const newNote: Note = {
      id: `note_${Date.now()}`,
      content: '',
    };
    const updatedNotes = [...notes, newNote];
    onNotesChange(updatedNotes);
    setActiveNoteId(newNote.id);
  };

  const handleDeleteNote = (noteId: string) => {
    if (notes.length <= 1) return;
    const updatedNotes = notes.filter(n => n.id !== noteId);
    onNotesChange(updatedNotes);
    if (activeNoteId === noteId) {
      setActiveNoteId(updatedNotes[0]?.id || '');
    }
  };

  const handleNoteContentChange = (noteId: string, content: string) => {
    const updatedNotes = notes.map(n =>
      n.id === noteId ? { ...n, content } : n
    );
    onNotesChange(updatedNotes);
  };

  const handleCloseNote = (noteId: string) => {
    handleDeleteNote(noteId);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={panelRef}
      className="fixed bg-amber-100 rounded-lg shadow-2xl z-[60] flex overflow-hidden select-none"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        cursor: isDragging ? 'grabbing' : isResizing ? getHandleCursor(resizeHandle!) : 'default',
        touchAction: 'none',
      }}
      onTouchStart={handleTouchStart}
    >
      {/* Resize Handles */}
      {RESIZE_HANDLES.map((handle) => (
        <div
          key={handle}
          className="resize-handle"
          style={{
            ...getHandlePosition(handle),
            cursor: getHandleCursor(handle),
          }}
          onMouseDown={(e) => handleResizeMouseDown(e, handle)}
          onTouchStart={(e) => handleResizeTouchStart(e, handle)}
        >
          {/* Visual indicator for handles - visible dots */}
          <div
            className="absolute rounded-full bg-amber-500 border-2 border-white shadow-md"
            style={{
              width: 10,
              height: 10,
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              opacity: isResizing || isTouchResizing ? 1 : 0.6,
              transition: 'opacity 0.15s',
            }}
          />
        </div>
      ))}

      <div
        className="w-10 bg-amber-200 border-r border-amber-300 flex flex-col py-1"
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <button
          onClick={handleAddNote}
          className="w-8 h-8 mx-auto flex items-center justify-center bg-amber-400 hover:bg-amber-500 text-amber-900 rounded transition-colors mb-1"
          title="Новая заметка"
        >
          <Plus className="w-4 h-4" />
        </button>
        <div className="flex-1 overflow-y-auto flex flex-col gap-1 px-1">
          {notes.map((note, index) => (
            <div
              key={note.id}
              onClick={() => setActiveNoteId(note.id)}
              className={`relative group cursor-pointer p-1.5 rounded transition-colors ${
                activeNoteId === note.id
                  ? 'bg-amber-100 border border-amber-400'
                  : 'bg-amber-50 hover:bg-amber-100 border border-transparent'
              }`}
            >
              <div
                className={`w-full h-10 flex items-center justify-center text-xs font-medium text-amber-800 truncate ${
                  activeNoteId === note.id ? 'bg-amber-200 rounded' : ''
                }`}
              >
                {note.content ? note.content.substring(0, 15) : `Заметка ${index + 1}`}
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseNote(note.id);
                }}
                className={`absolute -top-1 -right-1 w-4 h-4 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-[8px] leading-none ${notes.length <= 1 ? 'invisible' : ''}`}
                title="Закрыть"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col bg-amber-100">
        <div
          className="h-6 bg-amber-200 px-2 flex items-center justify-between cursor-grab select-none"
          onMouseDown={handleMouseDown}
        >
          <GripHorizontal className="w-3 h-3 text-amber-600" />
          <div className="flex gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (activeNote && notes.length > 1) {
                  handleDeleteNote(activeNote.id);
                }
              }}
              className={`w-5 h-5 flex items-center justify-center text-amber-700 hover:text-red-600 hover:bg-red-100 rounded transition-colors ${notes.length <= 1 ? 'invisible' : ''}`}
              title="Удалить заметку"
            >
              <Trash2 className="w-3 h-3" />
            </button>
            <button
              onClick={onClose}
              className="w-5 h-5 flex items-center justify-center text-amber-700 hover:text-red-600 hover:bg-red-100 rounded transition-colors"
              title="Закрыть панель"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
        <div className="flex-1 p-2 note-content-area">
          {activeNote && (
            <textarea
              value={activeNote.content}
              onChange={(e) => handleNoteContentChange(activeNote.id, e.target.value)}
              placeholder="Введите текст заметки..."
              className="w-full h-full bg-amber-50 border border-amber-300 rounded p-2 text-sm text-amber-900 placeholder-amber-500 resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
            />
          )}
        </div>
      </div>
    </div>
  );
}