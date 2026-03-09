export type ReportMeta = {
  generatedAt?: string;
  sampleScope?: string;
  validQuotes?: string;
};

export type StockLookupItem = {
  symbol: string;
  name: string;
  displayName: string;
  aliases: string[];
};

export type ParsedReportStockRow = {
  company: string;
  code: string;
  symbol: string | null;
  businessType?: string | null;
  detailUrl: string | null;
  xueqiuUrl: string | null;
  closeText: string;
  closeValue: number | null;
  changeText: string;
  changeValue: number | null;
  newsCount?: number;
  streak?: {
    direction: "up" | "down" | "flat";
    count: number;
  };
  recentFiveDayReturn?: number | null;
  recentFiveDayNewsCount?: number;
  recentPositiveDays?: number;
  recentNegativeDays?: number;
};

export type ParsedStockTable = {
  beforeMarkdown: string;
  afterMarkdown: string;
  rows: ParsedReportStockRow[];
};

export type AiOverviewSections = {
  stockParagraph: string | null;
  newsParagraph: string | null;
};

export type ParsedCompanyNewsSection = {
  symbol: string;
  companyLabel: string;
  changeLabel: string;
  newsCount: number;
  hasNews: boolean;
};

export function extractReportMeta(markdown: string): ReportMeta {
  const generatedAt = markdown.match(/^>\s*生成时间：(.+)$/m)?.[1]?.trim();
  const sampleScope = markdown.match(/^>\s*样本范围：(.+)$/m)?.[1]?.trim();
  const validQuotes = markdown.match(/^>\s*有效行情：(.+)$/m)?.[1]?.trim();
  return { generatedAt, sampleScope, validQuotes };
}

export function stripReportMetaQuoteBlock(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((line) => /^>\s*生成时间：/.test(line));
  if (start === -1) {
    return markdown;
  }

  const hasScope = /^>\s*样本范围：/.test(lines[start + 1] ?? "");
  const hasValidQuotes = /^>\s*有效行情：/.test(lines[start + 2] ?? "");
  if (!hasScope || !hasValidQuotes) {
    return markdown;
  }

  let end = start + 3;
  while (end < lines.length && lines[end].trim() === "") {
    end += 1;
  }

  return [...lines.slice(0, start), ...lines.slice(end)].join("\n");
}

export function trimSegment(markdown: string): string {
  return markdown.replace(/^\s+|\s+$/g, "");
}

export function splitMarkdownTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function parseNumericValue(input: string): number | null {
  const match = input.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) {
    return null;
  }

  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

export function buildExternalStockLink(code: string): string | null {
  const normalized = code.trim();
  if (!normalized) {
    return null;
  }

  return `https://xueqiu.com/S/${encodeURIComponent(normalized)}`;
}

export function stripParentheticalContent(value: string): string {
  return value.replace(/\([^)]*\)|（[^）]*）/g, " ").replace(/\s+/g, " ").trim();
}

export function normalizeStockLabel(value: string): string {
  return stripParentheticalContent(value)
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "");
}

export function buildStockDetailLookup(items: StockLookupItem[]): Map<string, string> {
  const lookup = new Map<string, string>();

  for (const item of items) {
    const candidates = new Set<string>([
      item.symbol,
      item.name,
      item.displayName,
      stripParentheticalContent(item.displayName),
      ...item.aliases
    ]);

    for (const candidate of candidates) {
      const normalized = normalizeStockLabel(candidate);
      if (normalized) {
        lookup.set(normalized, item.symbol);
      }
    }
  }

  return lookup;
}

export function buildStockDetailUrl(symbol: string | null): string | null {
  if (!symbol) {
    return null;
  }

  return `/stock/${encodeURIComponent(symbol)}`;
}

function extractSection(markdown: string, headingPattern: RegExp): string | null {
  const lines = markdown.split(/\r?\n/);
  const startIndex = lines.findIndex((line) => headingPattern.test(line.trim()));
  if (startIndex === -1) {
    return null;
  }

  let endIndex = startIndex + 1;
  while (endIndex < lines.length && !/^##\s+/.test(lines[endIndex].trim())) {
    endIndex += 1;
  }

  return trimSegment(lines.slice(startIndex + 1, endIndex).join("\n"));
}

export function parseAiOverview(markdown: string): AiOverviewSections {
  const section = extractSection(markdown, /^##\s+一、AI总览\s*$/);
  if (!section) {
    return { stockParagraph: null, newsParagraph: null };
  }

  const stockParagraph = section.match(/(?:^|\n)股票市场[:：]\s*([\s\S]*?)(?=\n相关新闻[:：]|$)/)?.[1]?.trim() ?? null;
  const newsParagraph = section.match(/(?:^|\n)相关新闻[:：]\s*([\s\S]*?)$/)?.[1]?.trim() ?? null;

  if (stockParagraph || newsParagraph) {
    return { stockParagraph, newsParagraph };
  }

  const paragraphs = section
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);

  return {
    stockParagraph: paragraphs[0] ?? null,
    newsParagraph: paragraphs[1] ?? null
  };
}

export function parseCompanyNewsSections(markdown: string): ParsedCompanyNewsSection[] {
  const lines = markdown.split(/\r?\n/);
  const sectionIndex = lines.findIndex((line) => /^##\s+三、相关新闻（按公司）\s*$/.test(line.trim()));
  if (sectionIndex === -1) {
    return [];
  }

  const sections: ParsedCompanyNewsSection[] = [];
  let index = sectionIndex + 1;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (/^##\s+/.test(line)) {
      break;
    }

    const headingMatch = line.match(/^###\s+(.+?)（(.+?)）\s+(.+)$/);
    if (!headingMatch) {
      index += 1;
      continue;
    }

    const symbol = headingMatch[1]?.trim() ?? "";
    const companyLabel = headingMatch[2]?.trim() ?? "";
    const changeLabel = headingMatch[3]?.trim() ?? "";
    index += 1;

    let newsCount = 0;
    let hasNews = false;
    while (index < lines.length) {
      const current = lines[index].trim();
      if (current.startsWith("### ") || current.startsWith("## ")) {
        break;
      }

      if (current.startsWith("- ")) {
        if (!/^-+\s*暂无相关新闻\s*$/.test(current)) {
          newsCount += 1;
          hasNews = true;
        }
      }

      index += 1;
    }

    sections.push({
      symbol,
      companyLabel,
      changeLabel,
      newsCount,
      hasNews
    });
  }

  return sections;
}

export function parseReportStockTable(markdown: string, stockItems: StockLookupItem[]): ParsedStockTable | null {
  const lines = markdown.split(/\r?\n/);
  const sectionIndex = lines.findIndex((line) => /^##\s+二、股票数据\s*$/.test(line.trim()));
  if (sectionIndex === -1) {
    return null;
  }

  let headerIndex = sectionIndex + 1;
  while (headerIndex < lines.length && lines[headerIndex].trim() === "") {
    headerIndex += 1;
  }

  const separatorIndex = headerIndex + 1;
  if (separatorIndex >= lines.length || !lines[headerIndex]?.trim().startsWith("|") || !lines[separatorIndex]?.trim().startsWith("|")) {
    return null;
  }

  let tableEndIndex = separatorIndex + 1;
  while (tableEndIndex < lines.length && lines[tableEndIndex].trim().startsWith("|")) {
    tableEndIndex += 1;
  }

  const headerCells = splitMarkdownTableRow(lines[headerIndex]);
  const companyIndex = headerCells.findIndex((cell) => /^公司名称$/.test(cell));
  const codeIndex = headerCells.findIndex((cell) => /^股票代码/.test(cell));
  const closeIndex = headerCells.findIndex((cell) => /^收盘价$/.test(cell));
  const changeIndex = headerCells.findIndex((cell) => /^涨跌幅$/.test(cell));
  if (companyIndex === -1 || closeIndex === -1 || changeIndex === -1) {
    return null;
  }

  const stockLookup = buildStockDetailLookup(stockItems);
  const rows = lines
    .slice(separatorIndex + 1, tableEndIndex)
    .map((line) => splitMarkdownTableRow(line))
    .filter((cells) => cells.length >= headerCells.length)
    .map((cells) => {
      const company = cells[companyIndex] ?? "";
      const code = codeIndex >= 0 ? (cells[codeIndex] ?? "") : "";
      const closeText = cells[closeIndex] ?? "-";
      const changeText = cells[changeIndex] ?? "-";
      const symbol = stockLookup.get(normalizeStockLabel(company)) ?? null;

      return {
        company,
        code,
        symbol,
        detailUrl: buildStockDetailUrl(symbol),
        xueqiuUrl: buildExternalStockLink(code),
        closeText,
        closeValue: parseNumericValue(closeText),
        changeText,
        changeValue: parseNumericValue(changeText)
      };
    })
    .filter((row) => row.company.length > 0);

  if (rows.length === 0) {
    return null;
  }

  return {
    beforeMarkdown: trimSegment(lines.slice(0, headerIndex).join("\n")),
    afterMarkdown: trimSegment(lines.slice(tableEndIndex).join("\n")),
    rows
  };
}
