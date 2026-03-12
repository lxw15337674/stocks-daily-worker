"use client";

import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import type { CoinNewsItem, MarketNewsItem } from "@/lib/crypto/types";
import { formatDateTime } from "@/lib/crypto/format";
import type { Language } from "@/lib/i18n";

type NewsItem = MarketNewsItem | CoinNewsItem;

type Props = {
  lang: Language;
  title: string;
  emptyText: string;
  items: NewsItem[];
};

function isMarketNews(item: NewsItem): item is MarketNewsItem {
  return "topics" in item;
}

function humanizeEventType(value: string): string {
  return value
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

function topicTone(topic: string): "default" | "secondary" | "outline" {
  switch (topic) {
    case "regulation":
    case "security":
      return "default";
    case "stablecoin":
    case "exchange":
      return "secondary";
    default:
      return "outline";
  }
}

function humanizeStance(value: NewsItem["stance"], t: (key: string) => string): string {
  switch (value) {
    case "bullish":
      return t("crypto.stanceBullish");
    case "bearish":
      return t("crypto.stanceBearish");
    default:
      return t("crypto.stanceNeutral");
  }
}

export function NewsSectionCard(props: Props) {
  const { lang, title, emptyText, items } = props;
  const { t } = useTranslation("common");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <Empty className="border border-dashed border-border/70 bg-background/20 py-8">
            <EmptyHeader>
              <EmptyTitle>{emptyText}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {items.map((item) => {
              const summary = lang === "zh" ? item.summaryZh : item.summaryEn;
              return (
                <article key={`news-${item.id}`} className="rounded-2xl border border-border/70 bg-background/45 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                        className="line-clamp-2 text-sm font-semibold text-foreground transition-colors hover:text-primary hover:underline"
                      >
                        {item.title}
                      </a>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {item.source} · {formatDateTime(item.publishedAt, lang)}
                      </p>
                    </div>
                    <Badge variant="outline">{t("crypto.signalLabel")}: {item.signalScore}</Badge>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-foreground/90">{summary}</p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Badge variant="outline">{humanizeStance(item.stance, t)}</Badge>
                    <Badge variant="secondary">{humanizeEventType(item.eventType)}</Badge>
                    {isMarketNews(item)
                      ? item.topics.slice(0, 3).map((topic) => (
                          <Badge key={`${item.id}-${topic}`} variant={topicTone(topic)}>
                            {topic}
                          </Badge>
                        ))
                      : item.isPrimary
                        ? <Badge variant="outline">{t("crypto.primaryLabel")}</Badge>
                        : null}
                  </div>

                  <div className="mt-4">
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-primary transition-colors hover:text-primary/80 hover:underline"
                    >
                      {t("crypto.readCoverage")}
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
