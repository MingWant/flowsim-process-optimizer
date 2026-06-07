import React, { useState, useEffect, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { X, BookOpen } from 'lucide-react';
import { MARKDOWN_DOCS_BY_PATH, type DocLanguage } from '../constants/documents';

interface MarkdownViewerProps {
  isOpen: boolean;
  onClose: () => void;
  markdownFile: string;
  title: string;
}

type MarkdownLanguage = DocLanguage;

const LANGUAGE_OPTIONS: Array<{ value: MarkdownLanguage; label: string; shortLabel: string }> = [
  { value: 'zh-TW', label: '繁體中文', shortLabel: '繁' },
  { value: 'zh-CN', label: '简体中文', shortLabel: '简' },
  { value: 'en', label: 'English', shortLabel: 'EN' },
];

const DEFAULT_MARKDOWN_LANGUAGE: MarkdownLanguage = 'zh-TW';
const MARKDOWN_LANGUAGE_STORAGE_KEY = 'flowsim-doc-language';

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
  const doc = MARKDOWN_DOCS_BY_PATH[markdownFile];
  return doc?.alternates.map((alternate) => alternate.language) || ['zh-TW'];
};

const getResolvedMarkdownFile = (markdownFile: string, language: MarkdownLanguage) => (
  MARKDOWN_DOCS_BY_PATH[markdownFile]?.alternates.find((alternate) => alternate.language === language)?.path || markdownFile
);

const resolveInternalMarkdownPath = (sourceFile: string, href?: string) => {
  if (!href || href.startsWith('#') || href.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(href) || !href.includes('.md')) {
    return undefined;
  }

  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    const sourceUrl = new URL(sourceFile, window.location.origin);
    const resolvedUrl = new URL(href, sourceUrl);
    return resolvedUrl.pathname;
  } catch {
    return undefined;
  }
};

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
  if (!markdownFile.endsWith('/user-guide.md')) {
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

const resolveMarkdownHref = (sourceFile: string, href?: string) => {
  if (!href || href.startsWith('#') || href.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(href)) {
    return href;
  }

  if (typeof window === 'undefined') {
    return href;
  }

  try {
    const sourceUrl = new URL(sourceFile, window.location.origin);
    const resolvedUrl = new URL(href, sourceUrl);
    return `${resolvedUrl.pathname}${resolvedUrl.search}${resolvedUrl.hash}`;
  } catch {
    return href;
  }
};

export function MarkdownViewer({ isOpen, onClose, markdownFile, title }: MarkdownViewerProps) {
  const [currentMarkdownFile, setCurrentMarkdownFile] = useState(markdownFile);
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<MarkdownLanguage>(getInitialLanguage);

  const availableLanguages = useMemo(() => getAvailableLanguages(currentMarkdownFile), [currentMarkdownFile]);
  const activeLanguage = availableLanguages.includes(selectedLanguage)
    ? selectedLanguage
    : availableLanguages[0] || DEFAULT_MARKDOWN_LANGUAGE;
  const shouldShowLanguageSelector = availableLanguages.length > 1;
  const resolvedMarkdownFile = getResolvedMarkdownFile(currentMarkdownFile, activeLanguage);
  const activeDocTitle = MARKDOWN_DOCS_BY_PATH[currentMarkdownFile]?.title || title;
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

  const navigateToMarkdown = (targetPath: string) => {
    const targetDoc = MARKDOWN_DOCS_BY_PATH[targetPath];
    const targetLanguage = targetDoc?.alternates.find((alternate) => alternate.path === targetPath)?.language;

    if (targetLanguage) {
      selectLanguage(targetLanguage);
    }

    setCurrentMarkdownFile(targetPath);
  };

  const handleMarkdownLinkClick = (event: React.MouseEvent<HTMLAnchorElement>, href?: string) => {
    const targetPath = resolveInternalMarkdownPath(resolvedMarkdownFile, href);
    if (!targetPath) {
      return;
    }

    event.preventDefault();
    navigateToMarkdown(targetPath);
  };

  useEffect(() => {
    if (isOpen) {
      setCurrentMarkdownFile(markdownFile);
    }
  }, [isOpen, markdownFile]);

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
            <h2 className="truncate text-lg font-bold text-slate-100">{activeDocTitle}</h2>
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
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ node: _node, href, children, ...props }) => (
                    <a
                      {...props}
                      href={resolveMarkdownHref(resolvedMarkdownFile, href)}
                      onClick={(event) => handleMarkdownLinkClick(event, href)}
                      target={href?.startsWith('#') || resolveInternalMarkdownPath(resolvedMarkdownFile, href) ? undefined : '_blank'}
                      rel={href?.startsWith('#') || resolveInternalMarkdownPath(resolvedMarkdownFile, href) ? undefined : 'noopener noreferrer'}
                    >
                      {children}
                    </a>
                  ),
                }}
              >
                {localizedContent}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
