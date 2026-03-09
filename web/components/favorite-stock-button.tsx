"use client";

import { Star } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { getFavoriteStocks, isFavoriteStock, subscribeFavoriteStocks, toggleFavoriteStock } from "@/lib/favorite-stocks";

type FavoriteStockButtonProps = {
  symbol: string;
  showLabel?: boolean;
  size?: "sm" | "default";
  variant?: "ghost" | "outline" | "secondary";
  className?: string;
};

export function FavoriteStockButton(props: FavoriteStockButtonProps) {
  const { symbol, showLabel = false, size = "sm", variant = "ghost", className } = props;
  const normalizedSymbol = useMemo(() => symbol.trim().toUpperCase(), [symbol]);
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    if (!normalizedSymbol) {
      setFavorite(false);
      return;
    }

    setFavorite(isFavoriteStock(normalizedSymbol, getFavoriteStocks()));
    return subscribeFavoriteStocks((symbols) => {
      setFavorite(isFavoriteStock(normalizedSymbol, symbols));
    });
  }, [normalizedSymbol]);

  if (!normalizedSymbol) {
    return null;
  }

  const label = favorite ? "已关注" : "加入关注";

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      className={className}
      onClick={() => {
        const next = toggleFavoriteStock(normalizedSymbol);
        setFavorite(isFavoriteStock(normalizedSymbol, next));
      }}
      aria-pressed={favorite}
      title={label}
    >
      <Star className={`h-4 w-4 ${favorite ? "fill-current text-primary" : "text-muted-foreground"}`} />
      {showLabel ? <span>{label}</span> : null}
    </Button>
  );
}
