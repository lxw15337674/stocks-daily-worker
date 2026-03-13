import type { Metadata } from "next";

import { getFixedT, type Language } from "@/lib/i18n";

type AssetKey = "stocks" | "crypto";

export function buildPlatformMetadata(lang: Language): Metadata {
  const commonT = getFixedT(lang, "common");
  return {
    title: commonT("platformHome"),
    description: commonT("assetHubSubtitle")
  };
}

export function buildAssetLayoutMetadata(lang: Language, asset: AssetKey): Metadata {
  const commonT = getFixedT(lang, "common");
  const assetLabel = commonT(`assets.${asset}.label`);

  return {
    title: {
      default: assetLabel,
      template: `%s | ${assetLabel}`
    }
  };
}

export function buildAssetHomeMetadata(lang: Language, asset: AssetKey): Metadata {
  const commonT = getFixedT(lang, "common");
  return {
    title: commonT(`assets.${asset}.label`),
    description: commonT(`assets.${asset}.description`)
  };
}

export function buildAssetArchiveMetadata(lang: Language, asset: AssetKey): Metadata {
  const channelT = getFixedT(lang, "channel", asset);
  return {
    title: channelT("archiveTitle"),
    description: channelT("archiveDescription")
  };
}

export function buildStocksMarketMetadata(lang: Language): Metadata {
  const t = getFixedT(lang, "stocks", "market");
  return {
    title: t("pageTitle"),
    description: t("pageSubtitle")
  };
}

export function buildStocksCompareMetadata(lang: Language): Metadata {
  const t = getFixedT(lang, "stocks", "compare");
  return {
    title: t("pageTitle"),
    description: t("pageSubtitle", { date: "latest", compareDate: "previous" })
  };
}

export function buildStocksAdminMetadata(lang: Language): Metadata {
  const commonT = getFixedT(lang, "common");
  return {
    title: commonT("stocksAdmin"),
    description: commonT("assets.stocks.description")
  };
}

export function buildStockInstrumentMetadata(lang: Language, symbol: string): Metadata {
  const commonT = getFixedT(lang, "common");
  return {
    title: `${symbol.toUpperCase()} · ${commonT("assets.stocks.label")}`,
    description: commonT("assets.stocks.description")
  };
}

export function buildCryptoAdminMetadata(lang: Language): Metadata {
  const commonT = getFixedT(lang, "common");
  return {
    title: commonT("cryptoAdmin"),
    description: commonT("assets.crypto.description")
  };
}

export function buildCryptoReportMetadata(lang: Language, date: string): Metadata {
  const commonT = getFixedT(lang, "common");
  return {
    title: `${date} · ${commonT("assets.crypto.label")}`,
    description: commonT("archiveDescription")
  };
}

export function buildCryptoInstrumentMetadata(lang: Language, code: string): Metadata {
  const commonT = getFixedT(lang, "common");
  return {
    title: `${code.toUpperCase()} · ${commonT("assets.crypto.label")}`,
    description: commonT("assets.crypto.description")
  };
}

export function buildCryptoEventMetadata(lang: Language, clusterId: number): Metadata {
  const commonT = getFixedT(lang, "common");
  return {
    title: `${commonT("crypto.eventDetailTitle")} #${clusterId}`,
    description: commonT("assets.crypto.description")
  };
}
