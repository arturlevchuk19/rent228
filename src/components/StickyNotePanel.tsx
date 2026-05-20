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

export function StickyNotePanel({ notes, onNotesChange, onClose, isOpen, storageKey }: StickyNotePanelProps) {
  const [activeNoteId, setActiveNoteId] = useState<string>(notes[0]?.id || '');
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && notes.length > 0 && !activeNoteId) {
      setActiveNoteId(notes[0].id);
    }
    if (isOpen && notes.length > 0 && !notes.find(n => n.id === activeNoteId)) {
      setActiveNoteId(notes[0].id);
    }
  }, [isOpen, notes, activeNoteId]);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(notes));
  }, [notes, storageKey]);

  const activeNote = notes.find(n => n.id === activeNoteId);

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
      className="fixed bg-amber-100 rounded-lg shadow-2xl z-[60] flex overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        width: '400px',
        height: '350px',
        cursor: isDragging ? 'grabbing' : 'default',
      }}
    >
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