export const SUPPORTED_LANGUAGES = ["zh", "en"] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export type Dictionary = {
  siteTitle: string;
  siteSubtitle: string;
  navHome: string;
  navArchive: string;
  navLatest: string;
  languageLabel: string;
  reportTitle: string;
  reportSummaryLabel: string;
  marketSnapshot: string;
  totalVolume: string;
  breadth: string;
  leader: string;
  laggard: string;
  generatedAt: string;
  reportDate: string;
  tableRank: string;
  tableName: string;
  tableCode: string;
  tablePrice: string;
  tableChange24h: string;
  tableVolume24h: string;
  tableShare: string;
  focusMoves: string;
  annualShare: string;
  annualVolume: string;
  archiveTitle: string;
  archiveDescription: string;
  latestReport: string;
  viewReport: string;
  coinProfile: string;
  corePosition: string;
  latestSnapshot: string;
  recentHistory: string;
  noData: string;
  today: string;
};

const dictionaries: Record<Language, Dictionary> = {
  zh: {
    siteTitle: "加密货币日报",
    siteSubtitle: "固定 Top 10 币种，结构化日报，币安行情驱动",
    navHome: "日报首页",
    navArchive: "历史日报",
    navLatest: "最新一期",
    languageLabel: "English",
    reportTitle: "今日市场总览",
    reportSummaryLabel: "AI 总览",
    marketSnapshot: "市场快照",
    totalVolume: "24h 总交易额",
    breadth: "涨跌分布",
    leader: "最强币种",
    laggard: "最弱币种",
    generatedAt: "生成时间",
    reportDate: "报告日期",
    tableRank: "排名",
    tableName: "名称",
    tableCode: "代码",
    tablePrice: "价格",
    tableChange24h: "24h",
    tableVolume24h: "24h 交易额",
    tableShare: "交易占比",
    focusMoves: "焦点异动",
    annualShare: "全年交易占比",
    annualVolume: "2025 年全年交易额",
    archiveTitle: "历史日报",
    archiveDescription: "查看已生成的结构化日报记录。",
    latestReport: "最新日报",
    viewReport: "查看日报",
    coinProfile: "币种档案",
    corePosition: "核心定位",
    latestSnapshot: "最新快照",
    recentHistory: "最近历史",
    noData: "暂无数据。",
    today: "回到今天"
  },
  en: {
    siteTitle: "Crypto Daily",
    siteSubtitle: "Fixed Top 10 coverage with structured reports powered by Binance market data",
    navHome: "Daily Report",
    navArchive: "Archive",
    navLatest: "Latest",
    languageLabel: "中文",
    reportTitle: "Today's Market Brief",
    reportSummaryLabel: "AI Summary",
    marketSnapshot: "Market Snapshot",
    totalVolume: "24h Traded Value",
    breadth: "Breadth",
    leader: "Leader",
    laggard: "Laggard",
    generatedAt: "Generated",
    reportDate: "Report Date",
    tableRank: "Rank",
    tableName: "Name",
    tableCode: "Code",
    tablePrice: "Price",
    tableChange24h: "24h",
    tableVolume24h: "24h Volume",
    tableShare: "Trade Share",
    focusMoves: "Focus Movers",
    annualShare: "Annual Trade Share",
    annualVolume: "2025 Annual Traded Value",
    archiveTitle: "Archive",
    archiveDescription: "Browse previously generated structured reports.",
    latestReport: "Latest Report",
    viewReport: "Open Report",
    coinProfile: "Coin Profile",
    corePosition: "Core Position",
    latestSnapshot: "Latest Snapshot",
    recentHistory: "Recent History",
    noData: "No data available.",
    today: "Today"
  }
};

export function isLanguage(value: string): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language);
}

export function getDictionary(language: Language): Dictionary {
  return dictionaries[language];
}
