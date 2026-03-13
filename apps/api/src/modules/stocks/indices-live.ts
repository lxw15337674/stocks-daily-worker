import type { MarketIndexHistoryResponse, MarketIndexLatestResponse, MarketIndexRange, MarketIndexSnapshot } from "@china-stocks/contracts";
import {
  compareSnapshots,
  fetchLatestMarketSnapshots,
  fetchMarketIndexHistorySeries,
  REGION_ORDER,
  resolveRequestedIndices,
  TRACKED_MARKET_INDICES
} from "./indices-core.ts";

export { REGION_ORDER, TRACKED_MARKET_INDICES } from "./indices-core.ts";
export type { TrackedMarketIndex } from "./indices-core.ts";

export async function getLiveMarketIndicesLatest(): Promise<MarketIndexLatestResponse> {
  const items = await fetchLatestMarketSnapshots();
  const updatedAt =
    items.length > 0
      ? [...items]
          .map((item) => item.quoteTimestamp)
          .sort((left, right) => right.localeCompare(left))[0] ?? null
      : null;

  return {
    updatedAt,
    regions: REGION_ORDER.map((region) => {
      const definitions = TRACKED_MARKET_INDICES.filter((item) => item.region === region);
      return {
        region,
        primaryIndexKey: definitions.find((item) => item.isPrimary)?.indexKey ?? definitions[0]?.indexKey ?? "",
        items: definitions.map((definition) => {
          const snapshot = items.find((item) => item.indexKey === definition.indexKey) ?? null;
          return {
            indexKey: definition.indexKey,
            symbol: definition.symbol,
            region: definition.region,
            nameZh: definition.nameZh,
            nameEn: definition.nameEn,
            price: snapshot?.close ?? null,
            previousClose: snapshot?.previousClose ?? null,
            changeAbs: snapshot?.changeAbs ?? null,
            changePct: snapshot?.changePct ?? null,
            currency: snapshot?.currency ?? null,
            quoteTimestamp: snapshot?.quoteTimestamp ?? null,
            isPrimary: definition.isPrimary
          };
        })
      };
    })
  };
}

export async function getLiveMarketIndicesHistory(
  requestedIndexKeys: string[],
  range: MarketIndexRange
): Promise<MarketIndexHistoryResponse> {
  const selected = resolveRequestedIndices(requestedIndexKeys);
  const series = (
    await Promise.all(selected.map((definition) => fetchMarketIndexHistorySeries(definition, range)))
  ).filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    range,
    series
  };
}

export function sortMarketSnapshots(items: MarketIndexSnapshot[]): MarketIndexSnapshot[] {
  return [...items].sort(compareSnapshots);
}
