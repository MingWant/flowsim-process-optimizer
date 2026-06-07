export type DocLanguage = 'zh-TW' | 'zh-CN' | 'en';

export interface DocLanguageAlternate {
  language: DocLanguage;
  path: string;
}

export interface MarkdownDocEntry {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: string;
  toneClass: string;
  category: 'guide' | 'technical';
  defaultPath: string;
  alternates: DocLanguageAlternate[];
}

export const DOCS_BASE_PATH = '/docs';
export const DOCS_HOME_PATH = `${DOCS_BASE_PATH}/index.html`;

const guide = (file: string) => `${DOCS_BASE_PATH}/guide/${file}`;
const technical = (file: string) => `${DOCS_BASE_PATH}/technical/${file}`;

const languageAlternates = (folder: 'guide' | 'technical', name: string): DocLanguageAlternate[] => {
  const resolve = folder === 'guide' ? guide : technical;
  return [
    { language: 'zh-TW', path: resolve(`${name}.zh-TW.md`) },
    { language: 'zh-CN', path: resolve(`${name}.zh-CN.md`) },
    { language: 'en', path: resolve(`${name}.en.md`) },
  ];
};

export const MARKDOWN_DOCS: MarkdownDocEntry[] = [
  {
    id: 'user-guide',
    title: '📚 完整使用手冊 / User Guide',
    shortTitle: '完整使用手冊',
    description: '繁中 / 简中 / English，一份文件统一管理',
    icon: '📚',
    toneClass: 'from-purple-500 to-pink-500',
    category: 'guide',
    defaultPath: guide('user-guide.md'),
    alternates: [
      { language: 'zh-TW', path: guide('user-guide.md') },
      { language: 'zh-CN', path: guide('user-guide.md') },
      { language: 'en', path: guide('user-guide.md') },
    ],
  },
  {
    id: 'documentation-index',
    title: '🗂️ 文檔索引 / Documentation Index',
    shortTitle: '文檔索引',
    description: '三語文檔入口與閱讀路徑',
    icon: '🗂️',
    toneClass: 'bg-purple-500/20',
    category: 'guide',
    defaultPath: guide('documentation-index.zh-TW.md'),
    alternates: languageAlternates('guide', 'documentation-index'),
  },
  {
    id: 'wait-time-quick-reference',
    title: '⚡ 快速參考 - 等待時間指標',
    shortTitle: '等待時間快速參考',
    description: '三語版本，5 分鐘快速上手',
    icon: '⚡',
    toneClass: 'bg-emerald-500/20',
    category: 'guide',
    defaultPath: guide('wait-time-quick-reference.zh-TW.md'),
    alternates: languageAlternates('guide', 'wait-time-quick-reference'),
  },
  {
    id: 'wait-time-mode-configuration',
    title: '📖 完整指南 - 等待時間模式配置',
    shortTitle: '等待時間模式指南',
    description: '三語版本，含模式、場景與 FAQ',
    icon: '📖',
    toneClass: 'bg-blue-500/20',
    category: 'guide',
    defaultPath: guide('wait-time-mode-configuration.zh-TW.md'),
    alternates: languageAlternates('guide', 'wait-time-mode-configuration'),
  },
  {
    id: 'dual-wait-time-metrics',
    title: '🔬 Dual Wait Time Metrics',
    shortTitle: '雙等待時間技術詳解',
    description: '三語版本，等待時間指標口徑',
    icon: '🔬',
    toneClass: 'bg-amber-500/20',
    category: 'technical',
    defaultPath: technical('dual-wait-time-metrics.zh-TW.md'),
    alternates: languageAlternates('technical', 'dual-wait-time-metrics'),
  },
  {
    id: 'simulation-algorithm',
    title: '🧮 Simulation Algorithm',
    shortTitle: '模擬算法詳解',
    description: 'Tick、到達、資源、日曆與統計算法',
    icon: '🧮',
    toneClass: 'bg-violet-500/20',
    category: 'technical',
    defaultPath: technical('simulation-algorithm.zh-TW.md'),
    alternates: languageAlternates('technical', 'simulation-algorithm'),
  },
  {
    id: 'simulation-mode-guide',
    title: '🎛️ Simulation Mode Guide',
    shortTitle: '模擬模式指南',
    description: 'Realistic、Worst-Case 與 Process 模式',
    icon: '🎛️',
    toneClass: 'bg-cyan-500/20',
    category: 'technical',
    defaultPath: technical('simulation-mode-guide.zh-TW.md'),
    alternates: languageAlternates('technical', 'simulation-mode-guide'),
  },
  {
    id: 'multi-segment-business-hours',
    title: '🕘 Multi-Segment Business Hours',
    shortTitle: '多段工作時間',
    description: '三語版本，工作日曆與時段設定',
    icon: '🕘',
    toneClass: 'bg-indigo-500/20',
    category: 'technical',
    defaultPath: technical('multi-segment-business-hours.zh-TW.md'),
    alternates: languageAlternates('technical', 'multi-segment-business-hours'),
  },
  {
    id: 'troubleshooting',
    title: '🛠️ Troubleshooting',
    shortTitle: '排障指南',
    description: '三語版本，常見配置與顯示問題',
    icon: '🛠️',
    toneClass: 'bg-rose-500/20',
    category: 'technical',
    defaultPath: technical('troubleshooting.zh-TW.md'),
    alternates: languageAlternates('technical', 'troubleshooting'),
  },
  {
    id: 'configuration-reference',
    title: '🧾 Configuration Reference',
    shortTitle: '配置與資料模型',
    description: '三語版本，配置、導入導出與資料模型',
    icon: '🧾',
    toneClass: 'bg-slate-500/20',
    category: 'technical',
    defaultPath: technical('configuration-reference.zh-TW.md'),
    alternates: languageAlternates('technical', 'configuration-reference'),
  },
];

export const MARKDOWN_DOCS_BY_PATH = MARKDOWN_DOCS.reduce<Record<string, MarkdownDocEntry>>((acc, doc) => {
  acc[doc.defaultPath] = doc;
  doc.alternates.forEach((alternate) => {
    acc[alternate.path] = doc;
  });
  return acc;
}, {});
