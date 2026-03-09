"use client";

const FAVORITE_STOCKS_STORAGE_KEY = "china-stocks.favorite-symbols";
const FAVORITE_STOCKS_EVENT = "favorite-stocks:changed";

type FavoriteStocksListener = (symbols: string[]) => void;

function normalizeSymbol(value: string): string {
  return value.trim().toUpperCase();
}

function dedupeSymbols(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = normalizeSymbol(value);
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function readFromStorage(): string[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(FAVORITE_STOCKS_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? dedupeSymbols(parsed.filter((item): item is string => typeof item === "string")) : [];
  } catch {
    return [];
  }
}

function emitChange(symbols: string[]): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent<string[]>(FAVORITE_STOCKS_EVENT, { detail: symbols }));
}

export function getFavoriteStocks(): string[] {
  return readFromStorage();
}

export function isFavoriteStock(symbol: string, favorites = readFromStorage()): boolean {
  const normalized = normalizeSymbol(symbol);
  return normalized.length > 0 && favorites.includes(normalized);
}

export function setFavoriteStocks(symbols: string[]): string[] {
  const next = dedupeSymbols(symbols);
  if (typeof window === "undefined") {
    return next;
  }

  window.localStorage.setItem(FAVORITE_STOCKS_STORAGE_KEY, JSON.stringify(next));
  emitChange(next);
  return next;
}

export function toggleFavoriteStock(symbol: string): string[] {
  const normalized = normalizeSymbol(symbol);
  if (!normalized) {
    return getFavoriteStocks();
  }

  const current = readFromStorage();
  return current.includes(normalized)
    ? setFavoriteStocks(current.filter((item) => item !== normalized))
    : setFavoriteStocks([...current, normalized]);
}

export function subscribeFavoriteStocks(listener: FavoriteStocksListener): () => void {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key && event.key !== FAVORITE_STOCKS_STORAGE_KEY) {
      return;
    }
    listener(readFromStorage());
  };

  const handleCustom = (event: Event) => {
    const customEvent = event as CustomEvent<string[]>;
    listener(Array.isArray(customEvent.detail) ? dedupeSymbols(customEvent.detail) : readFromStorage());
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(FAVORITE_STOCKS_EVENT, handleCustom as EventListener);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(FAVORITE_STOCKS_EVENT, handleCustom as EventListener);
  };
}
