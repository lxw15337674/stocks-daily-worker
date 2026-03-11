import { createInstance, type Resource, type TFunction } from "i18next";

export const SUPPORTED_LANGUAGES = ["zh", "en"] as const;
export const MARKET_LANG_COOKIE = "market_lang";

export type Language = (typeof SUPPORTED_LANGUAGES)[number];

type CommonBaseCopy = {
  platformTitle: string;
  platformSubtitle: string;
  platformHome: string;
  switchLanguage: string;
  assetHubTitle: string;
  assetHubSubtitle: string;
  openChannel: string;
  comingSoon: string;
  stocksHome: string;
  cryptoHome: string;
  stocksArchive: string;
  cryptoArchive: string;
  cryptoAdmin: string;
  stocksCompare: string;
  stocksAdmin: string;
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

type CommonNamespace = CommonBaseCopy & {
  loading: string;
  notFound: {
    title: string;
    description: string;
    backHome: string;
    openArchive: string;
    openAdmin: string;
  };
  forms: {
    lookupByDateLabel: string;
    lookupSubmitLabel: string;
    invalidDateError: string;
    selectDatePlaceholder: string;
  };
  assets: {
    stocks: {
      label: string;
      description: string;
    };
    crypto: {
      label: string;
      description: string;
    };
    gold: {
      label: string;
      description: string;
    };
    bonds: {
      label: string;
      description: string;
    };
  };
  crypto: {
    breadthSummary: string;
    focusMoveSummary: string;
    pairLabel: string;
    marketNewsTitle: string;
    coinNewsTitle: string;
    eventClustersTitle: string;
    sourceLabel: string;
    signalLabel: string;
    noMarketNews: string;
    noCoinNews: string;
    readCoverage: string;
    clusterSources: string;
    clusterImpact: string;
    primaryLabel: string;
    focusCoverageTitle: string;
    noFocusCoverage: string;
    dateScopedNewsLabel: string;
  };
};

export type ChannelCopy = {
  archiveTitle: string;
  archiveDescription: string;
  emptyArchive: string;
  missingReportTitle: string;
  missingReportDescription: string;
  backToChannelHome: string;
  loading: string;
};

type StocksRankMetaType =
  | "newsCount"
  | "streakUp"
  | "streakDown"
  | "fiveDayReturn"
  | "recentFiveDayNewsCount"
  | "recentPositiveDays"
  | "recentNegativeDays";

type StocksNamespace = {
  home: {
    tabs: {
      report: string;
      movers: string;
    };
    tabsAriaLabel: string;
    previousDay: string;
    nextDay: string;
    chooseDate: string;
    jump: string;
    dailyFocus: string;
    featuredTitle: string;
    featuredDescription: string;
    featuredCount: string;
    featuredEmpty: string;
    fiveDayLabel: string;
    newsLabel: string;
    streakUp: string;
    streakDown: string;
    noStreak: string;
    tradingDate: string;
    fullReport: string;
    aiOverviewTitle: string;
    aiOverviewBadge: string;
    stockOverviewTitle: string;
    newsOverviewTitle: string;
    stockTableTitle: string;
    stockTableDescription: string;
    companyNewsTitle: string;
    noCompanyNews: string;
    sampleScope: string;
    validQuotes: string;
    labels: {
      todayWatch: string;
      newsDriven: string;
      sustainedStrength: string;
      sustainedWeakness: string;
      fiveDayStrength: string;
      fiveDayPullback: string;
      singleDayMove: string;
    };
    summaries: {
      default: string;
      newsDriven: string;
      streakUp: string;
      streakDown: string;
      fiveDay: string;
      singleDayMove: string;
    };
  };
  movers: {
    currentDayPrefix: string;
    noData: string;
    unmappedCode: string;
    compareWith: string;
    currentDayMetric: string;
    groups: Array<{
      title: string;
      description: string;
      sections: Array<{
        title: string;
        description: string;
        metaType?: StocksRankMetaType;
      }>;
    }>;
    leaderboards: string;
    title: string;
    description: string;
    sampleStocks: string;
    currentDayBoards: string;
    fiveDayBoards: string;
    topCount: string;
    boardCount: string;
    newsCount: string;
    streakUp: string;
    streakDown: string;
    fiveDayReturn: string;
    recentFiveDayNewsCount: string;
    recentPositiveDays: string;
    recentNegativeDays: string;
  };
  compare: Record<string, string>;
  instrument: Record<string, string>;
  admin: Record<string, string>;
};

export const COMMON_DICTIONARIES: Record<Language, CommonNamespace> = {
  zh: {
    platformTitle: "Market Daily",
    platformSubtitle: "统一多资产市场日报平台",
    platformHome: "平台首页",
    switchLanguage: "English",
    assetHubTitle: "选择要查看的资产频道",
    assetHubSubtitle: "股票与数字货币已经接入统一平台，黄金和债券会按相同频道结构继续扩展。",
    openChannel: "进入频道",
    comingSoon: "即将上线",
    stocksHome: "股票首页",
    cryptoHome: "数字货币首页",
    stocksArchive: "股票归档",
    cryptoArchive: "币种归档",
    cryptoAdmin: "币种管理",
    stocksCompare: "股票对比",
    stocksAdmin: "股票管理",
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
    today: "回到今天",
    loading: "加载中...",
    notFound: {
      title: "未找到对应日报",
      description: "请确认日期格式为 YYYY-MM-DD，并且该交易日已经生成报告。",
      backHome: "返回首页",
      openArchive: "历史日报",
      openAdmin: "股票管理"
    },
    forms: {
      lookupByDateLabel: "按日期查询（美东交易日）",
      lookupSubmitLabel: "查看日报",
      invalidDateError: "请输入 YYYY-MM-DD 格式，例如 2026-03-06。",
      selectDatePlaceholder: "选择日期"
    },
    assets: {
      stocks: {
        label: "股票",
        description: "股票日报、股票池管理、历史归档和对比复盘。"
      },
      crypto: {
        label: "数字货币",
        description: "固定 Top 10 币种的结构化日报、归档与币种详情。"
      },
      gold: {
        label: "黄金",
        description: "黄金资产频道会沿用同样的日报、归档和标的详情结构。"
      },
      bonds: {
        label: "债券",
        description: "债券资产频道会在统一平台下接入。"
      }
    },
    crypto: {
      breadthSummary: "涨 {{upCount}} / 跌 {{downCount}} / 平 {{flatCount}}",
      focusMoveSummary:
        "{{code}} 当前价格 {{price}}，24 小时交易额 {{volume}}，在观察池中的交易占比为 {{share}}。",
      pairLabel: "交易对",
      marketNewsTitle: "市场新闻",
      coinNewsTitle: "相关新闻",
      eventClustersTitle: "重点事件",
      sourceLabel: "来源",
      signalLabel: "信号分",
      noMarketNews: "最近时段还没有可展示的市场新闻。",
      noCoinNews: "最近时段还没有可展示的相关新闻。",
      readCoverage: "查看原文",
      clusterSources: "{{count}} 个来源",
      clusterImpact: "市场影响: {{impact}}",
      primaryLabel: "主关联",
      focusCoverageTitle: "焦点币种新闻",
      noFocusCoverage: "这些焦点币种在对应日期没有筛选出可展示的相关新闻。",
      dateScopedNewsLabel: "新闻日期"
    }
  },
  en: {
    platformTitle: "Market Daily",
    platformSubtitle: "Unified multi-asset market report platform",
    platformHome: "Platform",
    switchLanguage: "中文",
    assetHubTitle: "Choose an asset channel",
    assetHubSubtitle:
      "Stocks and crypto now share one platform shell. Gold and bonds will follow the same channel model.",
    openChannel: "Open channel",
    comingSoon: "Coming soon",
    stocksHome: "Stocks",
    cryptoHome: "Crypto",
    stocksArchive: "Stocks Archive",
    cryptoArchive: "Crypto Archive",
    cryptoAdmin: "Crypto Admin",
    stocksCompare: "Stocks Compare",
    stocksAdmin: "Stocks Admin",
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
    today: "Today",
    loading: "Loading...",
    notFound: {
      title: "Report Not Found",
      description: "Check that the date uses YYYY-MM-DD and that the report for that date has already been generated.",
      backHome: "Back Home",
      openArchive: "Archive",
      openAdmin: "Stocks Admin"
    },
    forms: {
      lookupByDateLabel: "Look up by date (ET trading day)",
      lookupSubmitLabel: "Open report",
      invalidDateError: "Use YYYY-MM-DD, for example 2026-03-06.",
      selectDatePlaceholder: "Select date"
    },
    assets: {
      stocks: {
        label: "Stocks",
        description: "Stock reports, stock pool management, archive, and comparison workflows."
      },
      crypto: {
        label: "Crypto",
        description: "Structured reports, archive, and instrument detail views for the fixed Top 10 crypto universe."
      },
      gold: {
        label: "Gold",
        description: "The gold channel will reuse the same report, archive, and instrument detail structure."
      },
      bonds: {
        label: "Bonds",
        description: "The bonds channel will be added under the same unified platform."
      }
    },
    crypto: {
      breadthSummary: "Up {{upCount}} / Down {{downCount}} / Flat {{flatCount}}",
      focusMoveSummary:
        "{{code}} is trading at {{price}} with {{volume}} of 24h traded value, representing {{share}} of the tracked universe.",
      pairLabel: "Pair",
      marketNewsTitle: "Market News",
      coinNewsTitle: "Related Coverage",
      eventClustersTitle: "Key Events",
      sourceLabel: "Source",
      signalLabel: "Signal",
      noMarketNews: "No market-wide crypto news is available for the selected window.",
      noCoinNews: "No related news is available for this coin in the selected window.",
      readCoverage: "Read source",
      clusterSources: "{{count}} sources",
      clusterImpact: "Market impact: {{impact}}",
      primaryLabel: "Primary",
      focusCoverageTitle: "Focus Coin Coverage",
      noFocusCoverage: "No curated related coverage is available for the focus coins in this report window.",
      dateScopedNewsLabel: "News date"
    }
  }
};

export const CHANNEL_DICTIONARIES: Record<Language, Record<"stocks" | "crypto", ChannelCopy>> = {
  zh: {
    stocks: {
      archiveTitle: "历史日报",
      archiveDescription: "按美东交易日归档，点击日期可查看完整内容。",
      emptyArchive: "暂无历史数据。",
      missingReportTitle: "未找到对应日报",
      missingReportDescription: "请确认日期格式为 YYYY-MM-DD，并且该交易日已经生成报告。",
      backToChannelHome: "返回股票首页",
      loading: "加载中..."
    },
    crypto: {
      archiveTitle: "历史日报",
      archiveDescription: "查看已生成的结构化日报记录。",
      emptyArchive: "暂无数据。",
      missingReportTitle: "暂无日报",
      missingReportDescription: "当前还没有可展示的数字货币日报。",
      backToChannelHome: "返回数字货币首页",
      loading: "加载中..."
    }
  },
  en: {
    stocks: {
      archiveTitle: "Stocks Archive",
      archiveDescription: "Archived by U.S. Eastern trading day. Open any date to view the full report.",
      emptyArchive: "No archived reports yet.",
      missingReportTitle: "Report Not Found",
      missingReportDescription:
        "Check that the date uses YYYY-MM-DD and that the trading-day report has already been generated.",
      backToChannelHome: "Back to Stocks",
      loading: "Loading..."
    },
    crypto: {
      archiveTitle: "Archive",
      archiveDescription: "Browse previously generated structured reports.",
      emptyArchive: "No data available.",
      missingReportTitle: "No Report Available",
      missingReportDescription: "There is no crypto daily report available to display yet.",
      backToChannelHome: "Back to Crypto",
      loading: "Loading..."
    }
  }
};

export const STOCKS_DICTIONARIES: Record<Language, StocksNamespace> = {
  zh: {
    home: {
      tabs: {
        report: "日报正文",
        movers: "异动榜"
      },
      tabsAriaLabel: "首页主功能切换",
      previousDay: "前一天",
      nextDay: "后一天",
      chooseDate: "选择交易日",
      jump: "跳转",
      dailyFocus: "Daily Focus",
      featuredTitle: "今日重点股票",
      featuredDescription: "从固定股票池里挑出今天最值得先看的几只，先看它们，再决定深入哪一页。",
      featuredCount: "{{count}} 只重点跟踪",
      featuredEmpty: "当前样本不足，暂时无法生成重点股票。",
      fiveDayLabel: "5 日",
      newsLabel: "新闻: {{count}} 条",
      streakUp: "连涨 {{count}} 天",
      streakDown: "连跌 {{count}} 天",
      noStreak: "暂无连续信号",
      tradingDate: "美东交易日",
      fullReport: "完整日报",
      aiOverviewTitle: "AI 总览",
      aiOverviewBadge: "结构化摘要",
      stockOverviewTitle: "股票市场",
      newsOverviewTitle: "相关新闻",
      stockTableTitle: "股票数据",
      stockTableDescription: "按结构化行情数据浏览当日样本，并支持按价格或涨跌幅排序。",
      companyNewsTitle: "相关新闻（按公司）",
      noCompanyNews: "当前报告没有可展示的公司新闻。",
      sampleScope: "样本范围",
      validQuotes: "有效行情",
      labels: {
        todayWatch: "今日值得看",
        newsDriven: "消息驱动",
        sustainedStrength: "连续走强",
        sustainedWeakness: "连续承压",
        fiveDayStrength: "区间走强",
        fiveDayPullback: "区间回撤",
        singleDayMove: "单日异动"
      },
      summaries: {
        default: "{{company}} 今日录得 {{changeText}}，适合从盘中强弱和新闻反馈继续跟踪。",
        newsDriven:
          "{{company}} 当日相关新闻达到 {{newsCount}} 条，价格表现为 {{changeText}}，适合优先确认消息催化是否还在发酵。",
        streakUp:
          "{{company}} 已连涨 {{streakCount}} 天，今日继续收在 {{changeText}}，更像是趋势延续而非单日脉冲。",
        streakDown:
          "{{company}} 已连跌 {{streakCount}} 天，今日表现 {{changeText}}，需要判断是阶段回撤还是热度退潮。",
        fiveDay:
          "{{company}} 近 5 日累计 {{fiveDayReturnText}}，今天为 {{changeText}}，适合结合短周期强弱继续观察。",
        singleDayMove:
          "{{company}} 当日波动达到 {{changeText}}，已经进入固定股票池里值得复盘的显著变动区间。"
      }
    },
    movers: {
      currentDayPrefix: "今日",
      noData: "暂无可用数据。",
      unmappedCode: "未映射代码",
      compareWith: "对比 {{company}}",
      currentDayMetric: "今日 {{value}}",
      groups: [
        {
          title: "当日异动",
          description: "聚焦当天涨跌、波动和新闻热度，适合快速判断盘面焦点。",
          sections: [
            { title: "涨幅居前", description: "当日涨幅最高的股票。" },
            { title: "跌幅居前", description: "当日跌幅最大的股票。" },
            { title: "波动关注", description: "绝对涨跌幅最大，适合观察情绪冲击。" },
            { title: "新闻最多", description: "新闻曝光最多，便于追踪催化。", metaType: "newsCount" },
            { title: "连续上涨", description: "短期走势连续走强。", metaType: "streakUp" },
            { title: "连续下跌", description: "短期走势连续承压。", metaType: "streakDown" }
          ]
        },
        {
          title: "近 5 日跟踪",
          description: "关注短周期强弱、持续性和消息累积，更适合连续观察。",
          sections: [
            { title: "近 5 日最强", description: "5 日累计表现最强。", metaType: "fiveDayReturn" },
            { title: "近 5 日最弱", description: "5 日累计表现最弱。", metaType: "fiveDayReturn" },
            { title: "近 5 日消息最多", description: "5 日内新闻密度最高。", metaType: "recentFiveDayNewsCount" },
            { title: "近 5 日持续走强", description: "上涨天数和区间收益同时占优。", metaType: "recentPositiveDays" },
            { title: "近 5 日持续走弱", description: "下跌天数和区间收益同时偏弱。", metaType: "recentNegativeDays" }
          ]
        }
      ],
      leaderboards: "Leaderboards",
      title: "异动榜",
      description: "用更扁平的榜单视图快速浏览当日强弱、波动和近 5 日持续性。",
      sampleStocks: "样本股票",
      currentDayBoards: "当日榜单",
      fiveDayBoards: "5 日榜单",
      topCount: "前 {{count}} 名",
      boardCount: "{{count}} 个榜单",
      newsCount: "{{count}} 条相关新闻",
      streakUp: "已连涨 {{count}} 天",
      streakDown: "已连跌 {{count}} 天",
      fiveDayReturn: "区间收益 {{value}}",
      recentFiveDayNewsCount: "{{count}} 条近 5 日新闻",
      recentPositiveDays: "{{count}}/5 日上涨",
      recentNegativeDays: "{{count}}/5 日下跌"
    },
    compare: {
      nameCount: "{{count}} 只",
      listSeparator: "、",
      emptyHistoryTitle: "暂无足够历史日报可供对比",
      missingReportsTitle: "未找到可对比的日报",
      missingReportsDescription: "请确认两天都已生成日报后再进行对比。",
      backHome: "返回日报首页",
      pageTitle: "日报对比",
      pageSubtitle: "当前对比 {{date}} 与 {{compareDate}}",
      currentReportLabel: "当前日报",
      compareReportLabel: "对比日报",
      updateComparison: "更新对比",
      overlapTitle: "重叠样本",
      overlapDescription: "两天都存在可比行情",
      improvedTitle: "转强个股",
      improvedDescription: "当日涨跌幅优于对比日",
      newSamplesTitle: "新增样本",
      newSamplesDescription: "{{date}} 独有样本",
      droppedSamplesTitle: "缺失样本",
      droppedSamplesDescription: "{{date}} 独有样本",
      aiSummaryTitle: "AI 总览变化摘要",
      comparisonNotesBadge: "对比结论",
      watchlistTitle: "最值得关注的 3 只股票",
      watchlistBadge: "关注名单",
      watchlistEmpty: "当前没有足够样本生成关注名单。",
      deltaPriorityBadge: "差值优先",
      noneLabel: "暂无",
      unmappedSymbol: "未映射 symbol",
      watchSummary: "{{company}} 当前涨跌幅 {{currentChangeText}}，相对对比日变化 {{deltaText}}，新闻 {{newsCount}} 条。",
      aiOverviewTitle: "{{date}} AI 总览",
      stocksSectionTitle: "股票市场",
      newsSectionTitle: "相关新闻",
      noStockOverview: "暂无股票市场总览。",
      noNewsOverview: "暂无新闻总览。",
      changeBoardTitle: "股票变化榜",
      changeBoardDescription: "按两天涨跌幅差值排序",
      noOverlapSamples: "两天之间暂无可重叠的股票样本。",
      companyColumn: "公司",
      changeDeltaColumn: "涨跌幅差值",
      onlyInTitle: "{{date}} 独有样本",
      noNewSamples: "没有新增样本。",
      noDroppedSamples: "没有缺失样本。",
      summaryNoOverlap: "两天之间暂无足够重叠样本，无法判断 {{date}} 相对 {{compareDate}} 的整体强弱变化。",
      summaryImproved: "{{date}} 相比 {{compareDate}}，重叠样本平均涨跌幅提升 {{delta}}。",
      summaryWeakened: "{{date}} 相比 {{compareDate}}，重叠样本平均涨跌幅回落 {{delta}}。",
      summaryFlat: "两天重叠样本平均涨跌幅基本持平。",
      leadershipSummary: "转强代表：{{stronger}}；转弱代表：{{weaker}}。",
      overviewSummary: "当前日报股票概览：{{stockOverview}}；新闻概览：{{newsOverview}}。",
      coverageSummary: "{{date}} 独有样本 {{newlyAdded}} 只，{{compareDate}} 独有样本 {{removed}} 只。"
    },
    instrument: {
      backHome: "返回日报首页",
      codeMapping: "代码映射：",
      latestReport: "最近日报：",
      notAvailable: "暂无",
      compareLabel: "个股对比",
      comparePlaceholder: "选择对比标的",
      updateCompare: "更新对比",
      clearCompare: "清除对比",
      latestCloseTitle: "最新收盘价",
      noChangeData: "无涨跌幅数据",
      universePositionTitle: "固定池定位",
      universeRankValue: "第 {{rank}}/{{total}}",
      currentDayWithStreak: "当日 {{changeText}}，{{streak}}",
      stockNotMatchedLatestReport: "最近日报未匹配到该股票",
      recentReportEntriesTitle: "最近日报记录",
      entryCount: "{{count}} 次",
      latestEntryNews: "最近一次 {{count}} 条新闻",
      noReportRecordYet: "当前还没有日报留痕",
      newsCoverageTitle: "新闻覆盖",
      headlineCount: "{{count}} 条",
      aliasesPrefix: "别名 ",
      dailyChangeLabel: "当日涨跌幅",
      dailyChangeHint: "按当日日表现排序",
      newsIntensityLabel: "新闻热度",
      newsIntensityHint: "按日报中的公司新闻条数排序",
      strength5dLabel: "5日强弱",
      strength5dHint: "按近 5 个交易日累计收益排序",
      streakUp: "连涨 {{count}} 天",
      streakDown: "连跌 {{count}} 天",
      flatClose: "平收",
      noStreakSignal: "暂无连续信号",
      relativePositionTitle: "固定池相对位置",
      universeNames: "{{count}} 只样本",
      universeSummary: "{{symbol}} 在最近一期日报里属于 {{company}}，{{streak}}。",
      universeRank: "固定池第 {{rank}}/{{total}}",
      noComparableUniverseSample: "暂无可比较样本",
      currentDaySnapshot: "当日收盘 {{closeText}}，涨跌幅 {{changeText}}，新闻 {{newsCount}} 条，近 5 日累计 {{fiveDayReturn}}。",
      currentDaySnapshotNo5d: "当日收盘 {{closeText}}，涨跌幅 {{changeText}}，新闻 {{newsCount}} 条，近 5 日暂无累计收益数据。",
      aiOverviewTitle: "AI 个股总览",
      noAiSummary: "当前还没有可展示的 AI 个股摘要。",
      recentReportRecordsTitle: "最近几次日报记录",
      noReportRecords: "暂无日报记录。",
      newsBadge: "新闻 {{count}} 条",
      reportRecapNode: "日报复盘节点",
      noItemAiSummary: "该次日报暂无 AI 个股摘要，建议结合当天正文和新闻列表继续查看。",
      recentNewsTitle: "最近新闻",
      noRecentNews: "暂无可展示的相关新闻。",
      comparisonSummaryTitle: "对比摘要: {{primary}} vs {{secondary}}",
      overlapSessions: "{{count}} 个重叠交易日",
      periodReturnLabel: "{{symbol}} 区间收益",
      relativeOutperformanceLabel: "相对超额",
      noOverlapHistory: "两只股票暂无可重叠的历史数据。",
      dateColumn: "日期",
      dailySpreadColumn: "单日差值",
      priceHistoryTitle: "历史行情",
      latestSessions: "最近 {{count}} 个交易日",
      noHistory: "暂无历史行情数据。",
      closeColumn: "收盘价",
      prevCloseColumn: "前收",
      changeColumn: "涨跌幅",
      volumeColumn: "成交量",
      estTurnoverColumn: "估算成交额"
    },
    admin: {
      authTitle: "股票管理登录",
      authSessionChecking: "正在校验管理会话...",
      adminTokenLabel: "管理员令牌",
      adminTokenPlaceholder: "请输入管理员令牌",
      authSubmitting: "验证中...",
      authSubmit: "进入股票管理",
      authFailedTitle: "验证失败",
      sessionActiveHint: "已建立安全管理会话，可进行股票管理。",
      createStock: "新增股票",
      logout: "退出管理",
      actionFailedTitle: "操作失败",
      actionSucceededTitle: "操作成功",
      stockPoolTitle: "股票池管理",
      includeInactive: "显示停用",
      refresh: "刷新",
      loading: "加载中...",
      emptyData: "暂无数据。",
      tableSortOrder: "排序",
      tableSymbol: "股票代码",
      tableName: "名称",
      tableDisplayName: "展示名",
      tableExchangeCodes: "交易所代码",
      tableBusinessType: "业务",
      tableAliases: "别名",
      tableStatus: "状态",
      tableActions: "操作",
      active: "启用",
      inactive: "停用",
      processing: "处理中...",
      createDialogTitle: "新增股票",
      editDialogTitle: "编辑股票 #{{id}}",
      createDialogDescription: "创建时先生成 AI 预览候选，再确认新增。",
      stockNameLabel: "股票名称",
      stockNamePlaceholder: "请输入股票名称",
      previewGenerating: "生成中...",
      previewGenerate: "AI 生成预览",
      previewHintTitle: "预览提示",
      previewCandidatesLabel: "候选方案",
      previewCandidateLabel: "候选 {{index}}",
      previewWarningsTitle: "候选告警",
      previewRationaleTitle: "AI 说明",
      symbolLabel: "股票代码",
      symbolEditablePlaceholder: "例如 BABA（可编辑）",
      symbolPlaceholder: "例如 BABA",
      displayNameLabel: "展示名称",
      displayNamePlaceholder: "例如 阿里巴巴",
      exchangeCodesLabel: "交易所代码",
      exchangeCodesPlaceholder: "例如 HK09988, USBABA",
      businessTypeLabel: "业务类型",
      businessTypePlaceholder: "例如 电商",
      aliasesLabel: "别名",
      aliasesPlaceholder: "多个别名用逗号分隔",
      sortOrderLabel: "排序值",
      sortOrderOptionalPlaceholder: "整数，可选",
      sortOrderPlaceholder: "整数",
      cancel: "取消",
      creating: "新增中...",
      saving: "保存中...",
      confirmCreate: "确认新增",
      saveAndRegenerateAliases: "保存并重建别名",
      actionDialogTitle: "{{symbol}} 操作",
      actionDialogFallbackTitle: "操作",
      editInfo: "编辑信息",
      regenerating: "重建中...",
      regenerateAliases: "重建别名",
      deleting: "删除中...",
      softDelete: "软删除",
      close: "关闭",
      sessionLoginFailed: "会话登录失败（{{status}}）",
      sessionCheckFailed: "会话校验失败（{{status}}）",
      sessionExpired: "登录已失效，请重新输入管理员令牌。",
      loadFailed: "加载失败",
      sessionCheckFailedGeneric: "管理员会话校验失败。",
      missingAdminToken: "请先输入管理员令牌。",
      authFailedGeneric: "管理员令牌校验失败。",
      previewNameRequired: "请先填写股票名称，再生成 AI 预览。",
      previewFailed: "AI 预览失败（{{status}}）",
      previewEmpty: "AI 预览未返回候选，请重试。",
      previewFailedGeneric: "AI 预览失败",
      createNameRequired: "新增时股票名称必填。",
      createPreviewRequired: "请先使用 AI 生成预览候选后再确认新增。",
      saveFailed: "保存失败",
      createSuccess: "新增成功：{{name}}（{{symbol}}）。",
      updateSuccess: "保存成功：{{name}}（{{symbol}}）。",
      deleteFailed: "删除失败",
      deleteSuccess: "已软删除 {{symbol}}。",
      regenerateFailed: "重建别名失败",
      regenerateSuccess: "{{symbol}} 的别名已重建。"
    }
  },
  en: {
    home: {
      tabs: {
        report: "Report",
        movers: "Movers"
      },
      tabsAriaLabel: "Home primary tabs",
      previousDay: "Previous",
      nextDay: "Next",
      chooseDate: "Choose trading day",
      jump: "Go",
      dailyFocus: "Daily Focus",
      featuredTitle: "Featured Stocks",
      featuredDescription:
        "Start with the names that matter most today, then decide which detail page deserves a deeper read.",
      featuredCount: "{{count}} names to watch",
      featuredEmpty: "Not enough samples to generate featured stocks yet.",
      fiveDayLabel: "5d",
      newsLabel: "News: {{count}}",
      streakUp: "{{count}}-day up streak",
      streakDown: "{{count}}-day down streak",
      noStreak: "No streak signal",
      tradingDate: "ET trading day",
      fullReport: "Full Report",
      aiOverviewTitle: "AI Overview",
      aiOverviewBadge: "Structured Summary",
      stockOverviewTitle: "Stock Market",
      newsOverviewTitle: "Related Coverage",
      stockTableTitle: "Quote Table",
      stockTableDescription: "Browse the day's tracked names from structured quote data, with sortable price and change columns.",
      companyNewsTitle: "Company Coverage",
      noCompanyNews: "There is no company news to display for this report.",
      sampleScope: "Coverage",
      validQuotes: "Valid quotes",
      labels: {
        todayWatch: "Watch Today",
        newsDriven: "News Driven",
        sustainedStrength: "Trend Strength",
        sustainedWeakness: "Trend Pressure",
        fiveDayStrength: "5d Strength",
        fiveDayPullback: "5d Pullback",
        singleDayMove: "Daily Move"
      },
      summaries: {
        default:
          "{{company}} posted {{changeText}} today and is worth tracking through price action and news follow-through.",
        newsDriven:
          "{{company}} logged {{newsCount}} related headlines today with {{changeText}} price action, making it a good candidate to validate whether the catalyst is still carrying.",
        streakUp:
          "{{company}} is now on a {{streakCount}}-session winning streak and still closed at {{changeText}}, which looks more like continuation than a one-day spike.",
        streakDown:
          "{{company}} has now fallen for {{streakCount}} straight sessions and printed {{changeText}} today, so this is more about judging pullback versus fading momentum.",
        fiveDay:
          "{{company}} is up {{fiveDayReturnText}} over the last five sessions and sits at {{changeText}} today, making it useful for short-cycle strength checks.",
        singleDayMove:
          "{{company}} moved {{changeText}} on the day and has entered the range of names worth reviewing inside the fixed stock universe."
      }
    },
    movers: {
      currentDayPrefix: "Today",
      noData: "No data available.",
      unmappedCode: "Unmapped code",
      compareWith: "Compare {{company}}",
      currentDayMetric: "Today {{value}}",
      groups: [
        {
          title: "Daily Movers",
          description: "Focus on single-session gainers, decliners, volatility, and headline intensity.",
          sections: [
            { title: "Top Gainers", description: "Highest percentage gainers for the session." },
            { title: "Top Decliners", description: "Largest percentage losers for the session." },
            { title: "High Volatility", description: "Biggest absolute moves, useful for sentiment shock." },
            { title: "Most News", description: "Highest headline density for catalyst tracking.", metaType: "newsCount" },
            { title: "Up Streaks", description: "Names with sustained short-term strength.", metaType: "streakUp" },
            { title: "Down Streaks", description: "Names under sustained short-term pressure.", metaType: "streakDown" }
          ]
        },
        {
          title: "5-Day Tracking",
          description: "Watch short-cycle strength, persistence, and accumulated news flow.",
          sections: [
            { title: "Strongest 5d", description: "Best cumulative return over five sessions.", metaType: "fiveDayReturn" },
            { title: "Weakest 5d", description: "Worst cumulative return over five sessions.", metaType: "fiveDayReturn" },
            { title: "Most News 5d", description: "Highest five-day news density.", metaType: "recentFiveDayNewsCount" },
            { title: "Sustained Strength", description: "Leading on both up days and cumulative return.", metaType: "recentPositiveDays" },
            { title: "Sustained Weakness", description: "Weak on both down days and cumulative return.", metaType: "recentNegativeDays" }
          ]
        }
      ],
      leaderboards: "Leaderboards",
      title: "Movers Board",
      description: "Use a flatter leaderboard view to scan daily strength, volatility, and five-session persistence.",
      sampleStocks: "Universe",
      currentDayBoards: "Daily Boards",
      fiveDayBoards: "5d Boards",
      topCount: "Top {{count}}",
      boardCount: "{{count}} boards",
      newsCount: "{{count}} related headlines",
      streakUp: "{{count}}-day up streak",
      streakDown: "{{count}}-day down streak",
      fiveDayReturn: "5d return {{value}}",
      recentFiveDayNewsCount: "{{count}} headlines in 5d",
      recentPositiveDays: "{{count}}/5 up days",
      recentNegativeDays: "{{count}}/5 down days"
    },
    compare: {
      nameCount: "{{count}} names",
      listSeparator: ", ",
      emptyHistoryTitle: "Not enough archived reports to compare",
      missingReportsTitle: "Comparable reports were not found",
      missingReportsDescription: "Make sure both dates have generated reports before comparing them.",
      backHome: "Back to Reports",
      pageTitle: "Report Compare",
      pageSubtitle: "Comparing {{date}} against {{compareDate}}",
      currentReportLabel: "Current report",
      compareReportLabel: "Compare report",
      updateComparison: "Update comparison",
      overlapTitle: "Overlap",
      overlapDescription: "Names with comparable prints on both dates",
      improvedTitle: "Improved",
      improvedDescription: "Current-day change beat the compare date",
      newSamplesTitle: "New Samples",
      newSamplesDescription: "Only in {{date}}",
      droppedSamplesTitle: "Dropped Samples",
      droppedSamplesDescription: "Only in {{date}}",
      aiSummaryTitle: "AI Change Summary",
      comparisonNotesBadge: "Comparison Notes",
      watchlistTitle: "3 Names to Watch",
      watchlistBadge: "Watchlist",
      watchlistEmpty: "There is not enough sample coverage to build a watchlist.",
      deltaPriorityBadge: "Delta priority",
      noneLabel: "none",
      unmappedSymbol: "Unmapped symbol",
      watchSummary: "{{company}} printed {{currentChangeText}} on the current day, moved {{deltaText}} versus the compare date, and carries {{newsCount}} current-day news items.",
      aiOverviewTitle: "{{date}} AI Overview",
      stocksSectionTitle: "Stocks",
      newsSectionTitle: "News",
      noStockOverview: "No stock-market overview available.",
      noNewsOverview: "No news overview available.",
      changeBoardTitle: "Change Board",
      changeBoardDescription: "Sorted by change delta between the two dates",
      noOverlapSamples: "There are no overlapping stock samples between the two dates.",
      companyColumn: "Company",
      changeDeltaColumn: "Change Delta",
      onlyInTitle: "Only in {{date}}",
      noNewSamples: "No newly added samples.",
      noDroppedSamples: "No dropped samples.",
      summaryNoOverlap: "There are not enough overlapping names to judge the overall strength shift from {{compareDate}} to {{date}}.",
      summaryImproved: "Versus {{compareDate}}, overlapping names improved by {{delta}} on average on {{date}}.",
      summaryWeakened: "Versus {{compareDate}}, overlapping names weakened by {{delta}} on average on {{date}}.",
      summaryFlat: "Overlapping names are broadly flat between the two dates.",
      leadershipSummary: "Leading improvers: {{stronger}}; leading laggards: {{weaker}}.",
      overviewSummary: "Current stock overview: {{stockOverview}}; current news overview: {{newsOverview}}.",
      coverageSummary: "{{date}} has {{newlyAdded}} unique names, while {{compareDate}} has {{removed}}."
    },
    instrument: {
      backHome: "Back to Reports",
      codeMapping: "Code Mapping: ",
      latestReport: "Latest Report: ",
      notAvailable: "N/A",
      compareLabel: "Instrument Compare",
      comparePlaceholder: "Select a compare name",
      updateCompare: "Update Compare",
      clearCompare: "Clear Compare",
      latestCloseTitle: "Latest Close",
      noChangeData: "No change data",
      universePositionTitle: "Universe Position",
      universeRankValue: "#{{rank}}/{{total}}",
      currentDayWithStreak: "{{changeText}} on the day, {{streak}}",
      stockNotMatchedLatestReport: "This stock did not match the latest report universe",
      recentReportEntriesTitle: "Recent Report Entries",
      entryCount: "{{count}} entries",
      latestEntryNews: "Latest entry with {{count}} headlines",
      noReportRecordYet: "No report records yet",
      newsCoverageTitle: "News Coverage",
      headlineCount: "{{count}} headlines",
      aliasesPrefix: "Aliases ",
      dailyChangeLabel: "Daily change",
      dailyChangeHint: "Ranked by same-day move",
      newsIntensityLabel: "News intensity",
      newsIntensityHint: "Ranked by report headline count",
      strength5dLabel: "5d strength",
      strength5dHint: "Ranked by 5-session cumulative return",
      streakUp: "{{count}}-day up streak",
      streakDown: "{{count}}-day down streak",
      flatClose: "Flat close",
      noStreakSignal: "No streak signal",
      relativePositionTitle: "Universe Relative Position",
      universeNames: "{{count}} names",
      universeSummary: "{{symbol}} maps to {{company}} in the latest report, with {{streak}}.",
      universeRank: "Ranked #{{rank}}/{{total}} in universe",
      noComparableUniverseSample: "No comparable universe sample",
      currentDaySnapshot: "Closed at {{closeText}} with {{changeText}} on the day, {{newsCount}} headlines, and {{fiveDayReturn}} over the last 5 sessions.",
      currentDaySnapshotNo5d: "Closed at {{closeText}} with {{changeText}} on the day, {{newsCount}} headlines, and no 5-session cumulative return data.",
      aiOverviewTitle: "AI Stock Overview",
      noAiSummary: "No AI stock summary is available yet.",
      recentReportRecordsTitle: "Recent Report Records",
      noReportRecords: "No report records yet.",
      newsBadge: "{{count}} headlines",
      reportRecapNode: "Report recap node",
      noItemAiSummary: "No AI stock summary was generated for this report. Review the report body and news list for context.",
      recentNewsTitle: "Recent News",
      noRecentNews: "No related news is available.",
      comparisonSummaryTitle: "Comparison Summary: {{primary}} vs {{secondary}}",
      overlapSessions: "{{count}} overlapping sessions",
      periodReturnLabel: "{{symbol}} period return",
      relativeOutperformanceLabel: "Relative Outperformance",
      noOverlapHistory: "These two stocks do not share overlapping history yet.",
      dateColumn: "Date",
      dailySpreadColumn: "Daily Spread",
      priceHistoryTitle: "Price History",
      latestSessions: "Latest {{count}} sessions",
      noHistory: "No historical quote data yet.",
      closeColumn: "Close",
      prevCloseColumn: "Prev Close",
      changeColumn: "Change",
      volumeColumn: "Volume",
      estTurnoverColumn: "Est. Turnover"
    },
    admin: {
      authTitle: "Stock Admin Login",
      authSessionChecking: "Checking admin session...",
      adminTokenLabel: "Admin Token",
      adminTokenPlaceholder: "Enter admin token",
      authSubmitting: "Verifying...",
      authSubmit: "Open Stock Admin",
      authFailedTitle: "Authentication Failed",
      sessionActiveHint: "A secure admin session is active. You can now manage stocks.",
      createStock: "Create Stock",
      logout: "Log Out",
      actionFailedTitle: "Action Failed",
      actionSucceededTitle: "Action Succeeded",
      stockPoolTitle: "Stock Universe Admin",
      includeInactive: "Show inactive",
      refresh: "Refresh",
      loading: "Loading...",
      emptyData: "No data yet.",
      tableSortOrder: "Order",
      tableSymbol: "Symbol",
      tableName: "Name",
      tableDisplayName: "Display Name",
      tableExchangeCodes: "Exchange Codes",
      tableBusinessType: "Business",
      tableAliases: "Aliases",
      tableStatus: "Status",
      tableActions: "Actions",
      active: "Active",
      inactive: "Inactive",
      processing: "Processing...",
      createDialogTitle: "Create Stock",
      editDialogTitle: "Edit Stock #{{id}}",
      createDialogDescription: "Generate AI preview candidates first, then confirm creation.",
      stockNameLabel: "Stock Name",
      stockNamePlaceholder: "Enter stock name",
      previewGenerating: "Generating...",
      previewGenerate: "Generate AI Preview",
      previewHintTitle: "Preview Notes",
      previewCandidatesLabel: "Candidates",
      previewCandidateLabel: "Candidate {{index}}",
      previewWarningsTitle: "Candidate Warnings",
      previewRationaleTitle: "AI Notes",
      symbolLabel: "Symbol",
      symbolEditablePlaceholder: "For example BABA (editable)",
      symbolPlaceholder: "For example BABA",
      displayNameLabel: "Display Name",
      displayNamePlaceholder: "For example Alibaba",
      exchangeCodesLabel: "Exchange Codes",
      exchangeCodesPlaceholder: "For example HK09988, USBABA",
      businessTypeLabel: "Business Type",
      businessTypePlaceholder: "For example E-commerce",
      aliasesLabel: "Aliases",
      aliasesPlaceholder: "Separate multiple aliases with commas",
      sortOrderLabel: "Sort Order",
      sortOrderOptionalPlaceholder: "Integer, optional",
      sortOrderPlaceholder: "Integer",
      cancel: "Cancel",
      creating: "Creating...",
      saving: "Saving...",
      confirmCreate: "Confirm Create",
      saveAndRegenerateAliases: "Save and Regenerate Aliases",
      actionDialogTitle: "{{symbol}} Actions",
      actionDialogFallbackTitle: "Actions",
      editInfo: "Edit Details",
      regenerating: "Regenerating...",
      regenerateAliases: "Regenerate Aliases",
      deleting: "Deleting...",
      softDelete: "Soft Delete",
      close: "Close",
      sessionLoginFailed: "Session login failed ({{status}})",
      sessionCheckFailed: "Session check failed ({{status}})",
      sessionExpired: "Your session has expired. Please enter the admin token again.",
      loadFailed: "Load failed",
      sessionCheckFailedGeneric: "Admin session validation failed.",
      missingAdminToken: "Enter the admin token first.",
      authFailedGeneric: "Admin token validation failed.",
      previewNameRequired: "Enter a stock name before generating an AI preview.",
      previewFailed: "AI preview failed ({{status}})",
      previewEmpty: "The AI preview returned no candidates. Please try again.",
      previewFailedGeneric: "AI preview failed",
      createNameRequired: "Stock name is required when creating a new entry.",
      createPreviewRequired: "Generate AI preview candidates before confirming creation.",
      saveFailed: "Save failed",
      createSuccess: "Created successfully: {{name}} ({{symbol}}).",
      updateSuccess: "Saved successfully: {{name}} ({{symbol}}).",
      deleteFailed: "Delete failed",
      deleteSuccess: "Soft-deleted {{symbol}}.",
      regenerateFailed: "Alias regeneration failed",
      regenerateSuccess: "Aliases regenerated for {{symbol}}."
    }
  }
};

export const I18N_NAMESPACES = ["common", "channel", "stocks"] as const;

export type I18nNamespace = (typeof I18N_NAMESPACES)[number];

export const I18N_RESOURCES = {
  zh: {
    common: COMMON_DICTIONARIES.zh,
    channel: CHANNEL_DICTIONARIES.zh,
    stocks: STOCKS_DICTIONARIES.zh
  },
  en: {
    common: COMMON_DICTIONARIES.en,
    channel: CHANNEL_DICTIONARIES.en,
    stocks: STOCKS_DICTIONARIES.en
  }
} satisfies Resource;

export function isLanguage(value: string): value is Language {
  return SUPPORTED_LANGUAGES.includes(value as Language);
}

export function resolveLanguage(value: string | null | undefined): Language {
  const normalized = value ?? "";
  return isLanguage(normalized) ? normalized : "zh";
}

export function getI18nOptions(language: Language) {
  return {
    lng: resolveLanguage(language),
    fallbackLng: "zh",
    supportedLngs: [...SUPPORTED_LANGUAGES],
    defaultNS: "common",
    ns: [...I18N_NAMESPACES],
    resources: I18N_RESOURCES,
    interpolation: {
      escapeValue: false
    },
    returnObjects: true,
    initImmediate: false
  } as const;
}

export function createI18nInstance(language: Language) {
  const instance = createInstance();
  void instance.init(getI18nOptions(language));
  return instance;
}

export function getFixedT(language: Language, namespace: I18nNamespace, keyPrefix?: string): TFunction {
  return createI18nInstance(language).getFixedT(resolveLanguage(language), namespace, keyPrefix);
}
