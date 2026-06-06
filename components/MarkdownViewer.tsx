import React, { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, BookOpen } from 'lucide-react';

interface MarkdownViewerProps {
  isOpen: boolean;
  onClose: () => void;
  markdownFile: string;
  title: string;
}

type MarkdownLanguage = 'zh-TW' | 'zh-CN' | 'en';

const LANGUAGE_OPTIONS: Array<{ value: MarkdownLanguage; label: string; shortLabel: string }> = [
  { value: 'zh-TW', label: '繁體中文', shortLabel: '繁' },
  { value: 'zh-CN', label: '简体中文', shortLabel: '简' },
  { value: 'en', label: 'English', shortLabel: 'EN' },
];

const DEFAULT_MARKDOWN_LANGUAGE: MarkdownLanguage = 'zh-TW';
const MARKDOWN_LANGUAGE_STORAGE_KEY = 'flowsim-doc-language';

const DOC_LANGUAGE_ALTERNATES: Record<string, Partial<Record<MarkdownLanguage, string>>> = {
  'USER_GUIDE_ZH_EN.md': {
    'zh-TW': 'USER_GUIDE_ZH_EN.md',
    'zh-CN': 'USER_GUIDE_ZH_EN.md',
    en: 'USER_GUIDE_ZH_EN.md',
  },
  'WAIT_TIME_MODE_CONFIGURATION_ZH_TW.md': {
    'zh-TW': 'WAIT_TIME_MODE_CONFIGURATION_ZH_TW.md',
    'zh-CN': 'WAIT_TIME_MODE_CONFIGURATION.md',
  },
  'WAIT_TIME_MODE_CONFIGURATION.md': {
    'zh-CN': 'WAIT_TIME_MODE_CONFIGURATION.md',
    'zh-TW': 'WAIT_TIME_MODE_CONFIGURATION_ZH_TW.md',
  },
  'WAIT_TIME_QUICK_REFERENCE_ZH_TW.md': {
    'zh-TW': 'WAIT_TIME_QUICK_REFERENCE_ZH_TW.md',
  },
  'DOCUMENTATION_INDEX_ZH_TW.md': {
    'zh-TW': 'DOCUMENTATION_INDEX_ZH_TW.md',
  },
  'DUAL_WAIT_TIME_METRICS.md': {
    'zh-CN': 'DUAL_WAIT_TIME_METRICS.md',
  },
};

const USER_GUIDE_SECTIONS: Record<MarkdownLanguage, { heading: string; title: string }> = {
  'zh-CN': { heading: '## 中文版', title: '# FlowSim 用户文档' },
  'zh-TW': { heading: '## 繁體中文版', title: '# FlowSim 使用者文件' },
  en: { heading: '## English Version', title: '# FlowSim User Guide' },
};

const getInitialLanguage = (): MarkdownLanguage => {
  if (typeof window === 'undefined') {
    return DEFAULT_MARKDOWN_LANGUAGE;
  }

  const savedLanguage = window.localStorage.getItem(MARKDOWN_LANGUAGE_STORAGE_KEY);
  return LANGUAGE_OPTIONS.some((option) => option.value === savedLanguage)
    ? savedLanguage as MarkdownLanguage
    : DEFAULT_MARKDOWN_LANGUAGE;
};

const getAvailableLanguages = (markdownFile: string): MarkdownLanguage[] => {
  const alternates = DOC_LANGUAGE_ALTERNATES[markdownFile];
  if (alternates) {
    return LANGUAGE_OPTIONS
      .map((option) => option.value)
      .filter((language) => Boolean(alternates[language]));
  }

  if (markdownFile.includes('_ZH_TW')) {
    return ['zh-TW'];
  }

  return ['zh-CN'];
};

const getResolvedMarkdownFile = (markdownFile: string, language: MarkdownLanguage) => (
  DOC_LANGUAGE_ALTERNATES[markdownFile]?.[language] || markdownFile
);

const extractSectionAfterHeading = (content: string, heading: string) => {
  const startIndex = content.indexOf(heading);
  if (startIndex < 0) {
    return undefined;
  }

  const contentAfterHeading = content.slice(startIndex + heading.length);
  const nextLanguageHeadingMatch = contentAfterHeading.match(/\n## (中文版|繁體中文版|English Version|等待時間計算模式 \/ Wait Time Calculation Modes)/);
  const section = nextLanguageHeadingMatch?.index !== undefined
    ? contentAfterHeading.slice(0, nextLanguageHeadingMatch.index)
    : contentAfterHeading;

  return section.trim();
};

const localizeMarkdownContent = (markdownFile: string, content: string, language: MarkdownLanguage) => {
  if (markdownFile !== 'USER_GUIDE_ZH_EN.md') {
    return content;
  }

  const sectionConfig = USER_GUIDE_SECTIONS[language];
  const localizedSection = extractSectionAfterHeading(content, sectionConfig.heading);
  if (!localizedSection) {
    return content;
  }

  const updatedLine = content.match(/^更新时间.*$/m)?.[0];
  return [sectionConfig.title, updatedLine, '---', localizedSection]
    .filter(Boolean)
    .join('\n\n');
};

export function MarkdownViewer({ isOpen, onClose, markdownFile, title }: MarkdownViewerProps) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<MarkdownLanguage>(getInitialLanguage);

  const availableLanguages = useMemo(() => getAvailableLanguages(markdownFile), [markdownFile]);
  const activeLanguage = availableLanguages.includes(selectedLanguage)
    ? selectedLanguage
    : availableLanguages[0] || DEFAULT_MARKDOWN_LANGUAGE;
  const shouldShowLanguageSelector = availableLanguages.length > 1;
  const resolvedMarkdownFile = getResolvedMarkdownFile(markdownFile, activeLanguage);
  const localizedContent = useMemo(
    () => localizeMarkdownContent(resolvedMarkdownFile, content, activeLanguage),
    [activeLanguage, content, resolvedMarkdownFile]
  );

  const selectLanguage = (language: MarkdownLanguage) => {
    setSelectedLanguage(language);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(MARKDOWN_LANGUAGE_STORAGE_KEY, language);
    }
  };

  useEffect(() => {
    if (isOpen && resolvedMarkdownFile) {
      setLoading(true);
      setError('');

      fetch(resolvedMarkdownFile)
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
  }, [isOpen, resolvedMarkdownFile]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="relative w-full h-full max-w-5xl max-h-[90vh] m-4 bg-slate-900 rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-gradient-to-r from-blue-600/20 to-emerald-600/20">
          <div className="flex min-w-0 items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <BookOpen size={20} className="text-blue-400" />
            </div>
            <h2 className="truncate text-lg font-bold text-slate-100">{title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {shouldShowLanguageSelector && (
              <>
                <div className="hidden rounded-full border border-slate-700 bg-slate-950/60 p-1 sm:flex" aria-label="Document language">
                  {LANGUAGE_OPTIONS.map((option) => {
                    const isAvailable = availableLanguages.includes(option.value);
                    const isActive = activeLanguage === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => selectLanguage(option.value)}
                        disabled={!isAvailable}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${isActive ? 'bg-blue-500 text-white' : isAvailable ? 'text-slate-300 hover:bg-slate-800 hover:text-white' : 'cursor-not-allowed text-slate-600'}`}
                        title={isAvailable ? `切換到 ${option.label}` : `${option.label} 版本暫不可用`}
                      >
                        {option.shortLabel}
                      </button>
                    );
                  })}
                </div>
                <select
                  value={activeLanguage}
                  onChange={(event) => selectLanguage(event.target.value as MarkdownLanguage)}
                  className="rounded-lg border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 outline-none focus:border-blue-500 sm:hidden"
                  aria-label="Document language"
                >
                  {LANGUAGE_OPTIONS.filter((option) => availableLanguages.includes(option.value)).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors text-slate-400 hover:text-white"
              title="關閉"
            >
              <X size={20} />
            </button>
          </div>
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
                {localizedContent}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
