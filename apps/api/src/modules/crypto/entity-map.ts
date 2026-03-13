import type { IntelligenceKeywordAlias } from "@china-stocks/contracts";

type CryptoEntityAliasEntry = IntelligenceKeywordAlias & {
  keywords: string[];
};

const CRYPTO_COIN_ALIAS_ENTRIES: readonly CryptoEntityAliasEntry[] = [
  {
    assetClass: "crypto",
    targetType: "asset",
    targetId: "BTC",
    labelZh: "比特币",
    labelEn: "Bitcoin",
    keyword: "bitcoin",
    keywords: ["bitcoin", " btc ", "比特币", "spot bitcoin etf", "btcetf"]
  },
  {
    assetClass: "crypto",
    targetType: "asset",
    targetId: "ETH",
    labelZh: "以太坊",
    labelEn: "Ethereum",
    keyword: "ethereum",
    keywords: ["ethereum", " ether ", " eth ", "以太坊", "spot ether etf"]
  },
  {
    assetClass: "crypto",
    targetType: "asset",
    targetId: "USDC",
    labelZh: "美元硬币",
    labelEn: "USD Coin",
    keyword: "usdc",
    keywords: ["usdc", "usd coin", "circle stablecoin", "circle", "美元硬币"]
  },
  {
    assetClass: "crypto",
    targetType: "asset",
    targetId: "SOL",
    labelZh: "索拉纳",
    labelEn: "Solana",
    keyword: "solana",
    keywords: ["solana", " sol ", "索拉纳"]
  },
  {
    assetClass: "crypto",
    targetType: "asset",
    targetId: "XRP",
    labelZh: "瑞波币",
    labelEn: "XRP",
    keyword: "xrp",
    keywords: ["xrp", "ripple", "瑞波", "瑞波币"]
  },
  {
    assetClass: "crypto",
    targetType: "asset",
    targetId: "FDUSD",
    labelZh: "第一数字美元",
    labelEn: "First Digital USD",
    keyword: "fdusd",
    keywords: ["fdusd", "first digital usd", "first digital", "第一数字美元"]
  },
  {
    assetClass: "crypto",
    targetType: "asset",
    targetId: "DOGE",
    labelZh: "狗狗币",
    labelEn: "Dogecoin",
    keyword: "dogecoin",
    keywords: ["dogecoin", " doge ", "狗狗币", "老马", "musk coin", "elon"]
  },
  {
    assetClass: "crypto",
    targetType: "asset",
    targetId: "BNB",
    labelZh: "币安币",
    labelEn: "BNB",
    keyword: "bnb",
    keywords: ["bnb", "binance coin", "bnb chain", "binance ecosystem", "币安币"]
  },
  {
    assetClass: "crypto",
    targetType: "asset",
    targetId: "SUI",
    labelZh: "Sui",
    labelEn: "Sui",
    keyword: "sui",
    keywords: ["sui", "sui network"]
  },
  {
    assetClass: "crypto",
    targetType: "asset",
    targetId: "TRUMP",
    labelZh: "官方特朗普币",
    labelEn: "Official Trump",
    keyword: "official trump",
    keywords: ["official trump", "trump token", "trump meme coin", "trump crypto", "特朗普币"]
  }
];

const CRYPTO_MARKET_ALIAS_ENTRIES: readonly CryptoEntityAliasEntry[] = [
  {
    assetClass: "macro",
    targetType: "market",
    targetId: "fed",
    labelZh: "美联储",
    labelEn: "Federal Reserve",
    keyword: "federal reserve",
    keywords: ["federal reserve", "fed", "fomc", "美联储"]
  },
  {
    assetClass: "macro",
    targetType: "market",
    targetId: "sec",
    labelZh: "美国证监会",
    labelEn: "SEC",
    keyword: "sec",
    keywords: ["sec", "u.s. securities and exchange commission", "美国证监会"]
  },
  {
    assetClass: "macro",
    targetType: "market",
    targetId: "spot_etf",
    labelZh: "现货 ETF",
    labelEn: "Spot ETF",
    keyword: "etf",
    keywords: ["etf", "spot bitcoin etf", "spot ether etf", "现货etf", "现货 etf"]
  },
  {
    assetClass: "macro",
    targetType: "market",
    targetId: "stablecoin",
    labelZh: "稳定币流动性",
    labelEn: "Stablecoin Liquidity",
    keyword: "stablecoin",
    keywords: ["stablecoin", "稳定币", "reserve", "attestation", "mint", "redeem"]
  }
];

export const CRYPTO_ENTITY_KEYWORD_MAP: readonly CryptoEntityAliasEntry[] = [
  ...CRYPTO_COIN_ALIAS_ENTRIES,
  ...CRYPTO_MARKET_ALIAS_ENTRIES
];

export function getCryptoKeywordAliases(): IntelligenceKeywordAlias[] {
  return CRYPTO_ENTITY_KEYWORD_MAP.map(({ keywords: _keywords, ...alias }) => alias);
}

export function detectMappedCoins(haystack: string, allowedCoinCodes: string[], hints: string[]): string[] {
  const allowed = new Set(allowedCoinCodes.map((value) => value.trim().toUpperCase()));
  const out = new Set(hints.filter((value) => allowed.has(value)));

  for (const entry of CRYPTO_COIN_ALIAS_ENTRIES) {
    if (!allowed.has(entry.targetId)) {
      continue;
    }

    if (
      entry.keywords.some((keyword) => haystack.includes(keyword.trim().toLowerCase())) &&
      (entry.targetId !== "TRUMP" || /\b(token|coin|crypto|solana|meme)\b/i.test(haystack))
    ) {
      out.add(entry.targetId);
    }
  }

  return [...out];
}

export function collectMatchingKeywords(haystack: string, targetIds: string[], topics: string[]): string[] {
  const normalizedHaystack = haystack.toLowerCase();
  const allowedTargets = new Set(targetIds.map((value) => value.trim().toUpperCase()));
  const topicSet = new Set(topics.map((value) => value.trim().toLowerCase()));
  const matched = new Set<string>();

  for (const entry of CRYPTO_ENTITY_KEYWORD_MAP) {
    if (entry.targetType === "asset" && !allowedTargets.has(entry.targetId)) {
      continue;
    }
    if (entry.targetType === "market" && !entry.keywords.some((keyword) => normalizedHaystack.includes(keyword.trim().toLowerCase()))) {
      continue;
    }

    const keyword = entry.keywords.find((value) => normalizedHaystack.includes(value.trim().toLowerCase()));
    if (keyword) {
      matched.add(keyword.trim());
    }
  }

  for (const topic of topicSet) {
    matched.add(topic);
  }

  return [...matched];
}
