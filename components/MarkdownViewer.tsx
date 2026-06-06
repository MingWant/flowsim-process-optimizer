import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, BookOpen } from 'lucide-react';

interface MarkdownViewerProps {
  isOpen: boolean;
  onClose: () => void;
  markdownFile: string;
  title: string;
}

export function MarkdownViewer({ isOpen, onClose, markdownFile, title }: MarkdownViewerProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && markdownFile) {
      setLoading(true);
      setError('');

      fetch(markdownFile)
        .then(response => {
          if (!response.ok) throw new Error('Failed to load document');
          return response.text();
        })
        .then(text => {
          setContent(text);
          setLoading(false);
        })
        .catch(err => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [isOpen, markdownFile]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full h-full max-w-5xl max-h-[90vh] m-4 bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-gradient-to-r from-blue-600/20 to-emerald-600/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <BookOpen size={20} className="text-blue-400" />
            </div>
            <h2 className="text-lg font-bold text-slate-100">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
            title="關閉"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {loading && (
            <div className="flex items-center justify-center h-full">
              <div className="text-slate-400">載入中...</div>
            </div>
          )}

          {error && (
            <div className="flex items-center justify-center h-full">
              <div className="text-red-400">錯誤: {error}</div>
            </div>
          )}

          {!loading && !error && (
            <div className="markdown-content prose prose-invert prose-slate max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
