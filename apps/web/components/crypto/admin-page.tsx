"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatDateTime } from "@/lib/crypto/format";
import type { Language } from "@/lib/i18n";
import { assetEventPath, assetInstrumentPath } from "@/lib/platform-routes";

type AdminOverview = {
  pendingRawCount: number;
  processedRawCount: number;
  rejectedRawCount: number;
  failedRawCount: number;
  displayItemCount: number;
  hiddenItemCount: number;
  latestFetchedAt: string | null;
  latestPublishedAt: string | null;
};

type MacroSnapshot = {
  asOf: string | null;
  refreshedAt: string | null;
  regime: {
    code: string;
    labelZh: string;
    labelEn: string;
    summaryZh: string;
    summaryEn: string;
  };
  fearGreed: {
    value: number | null;
    change: number | null;
    classification: string | null;
    status: "available" | "stale" | "unavailable";
  };
  btcDominance: {
    value: number | null;
    change: number | null;
    status: "available" | "stale" | "unavailable";
  };
};

type MacroObservationItem = {
  indicatorKey: string;
  assetCode: string | null;
  metricValue: number | null;
  valueText: string | null;
  unit: "index" | "percent";
  classification: string | null;
  sourceName: string;
  sourceUrl: string;
  observedAt: string;
  fetchedAt: string;
};

type MacroAdminOverview = {
  snapshot: MacroSnapshot;
  recentObservations: MacroObservationItem[];
};

type AdminRawItem = {
  id: number;
  sourceName: string;
  sourceType: string;
  title: string;
  canonicalUrl: string;
  publishedAt: string;
  fetchedAt: string;
  ingestStatus: string;
};

type AdminCuratedItem = {
  id: number;
  rawId: number;
  title: string;
  canonicalUrl: string;
  sourceName: string;
  publishedAt: string;
  relevanceType: string;
  eventType: string;
  signalScore: number;
  noiseScore: number;
  confidence: number;
  shouldDisplay: boolean;
  isMarketWide: boolean;
  reason: string;
  relatedCoins: string[];
  topics: string[];
};

type AdminClusterListItem = {
  clusterId: number;
  label: string;
  importanceScore: number;
  marketImpact: "low" | "medium" | "high";
  representativeNewsItemId: number;
  representativeTitle: string;
  representativeSource: string;
  representativePublishedAt: string;
  relatedCoins: string[];
  topics: string[];
  sourceCount: number;
  memberCount: number;
  updatedAt: string;
};

type AdminClusterDetail = {
  cluster: {
    clusterId: number;
    label: string;
    importanceScore: number;
    marketImpact: "low" | "medium" | "high";
    stance: "bullish" | "bearish" | "neutral";
    associationScore: number | null;
    representative: {
      id: number;
      title: string;
      url: string;
      source: string;
      publishedAt: string;
    };
    relatedCoins: string[];
    topics: string[];
    sourceCount: number;
    reportDate: string;
    coverage: Array<{
      id: number;
      title: string;
      url: string;
      source: string;
      publishedAt: string;
      summaryZh: string;
      summaryEn: string;
      eventType: string;
      stance: "bullish" | "bearish" | "neutral";
      signalScore: number;
      relatedCoins: string[];
      isRepresentative: boolean;
    }>;
    coinSnapshots: Array<{
      reportDate: string;
      code: string;
      priceUsdt: number;
      change24hPct: number;
      quoteVolume24hUsdt: number;
      tradeSharePct: number;
    }>;
  };
  representativeNewsItemId: number;
  members: Array<{
    id: number;
    rawId: number;
    title: string;
    canonicalUrl: string;
    sourceName: string;
    sourceType: string;
    publishedAt: string;
    summaryZh: string;
    summaryEn: string;
    eventType: string;
    stance: "bullish" | "bearish" | "neutral";
    signalScore: number;
    noiseScore: number;
    confidence: number;
    shouldDisplay: boolean;
    isMarketWide: boolean;
    reason: string;
    relatedCoins: string[];
    topics: string[];
    isRepresentative: boolean;
  }>;
};

type CryptoAdminPageProps = {
  lang: Language;
};

type Copy = {
  title: string;
  subtitle: string;
  tokenLabel: string;
  tokenPlaceholder: string;
  loadData: string;
  manualRun: string;
  reprocess: string;
  loading: string;
  noData: string;
  overview: string;
  macroOverview: string;
  macroRefresh: string;
  macroRecent: string;
  macroRegime: string;
  macroAsOf: string;
  macroRefreshed: string;
  macroIndicator: string;
  macroValue: string;
  macroClass: string;
  macroProvider: string;
  macroStatus: string;
  rawQueue: string;
  curatedItems: string;
  pending: string;
  processed: string;
  rejected: string;
  failed: string;
  display: string;
  hidden: string;
  latestFetch: string;
  latestPublish: string;
  source: string;
  titleCol: string;
  status: string;
  publishedAt: string;
  fetchedAt: string;
  eventType: string;
  signal: string;
  noise: string;
  relevance: string;
  reason: string;
  authRequired: string;
  actionOk: string;
  actionFailed: string;
  openSource: string;
  allItems: string;
  displayOnly: string;
  clusters: string;
  clusterSearchLabel: string;
  clusterSearchPlaceholder: string;
  clusterCoinLabel: string;
  clusterCoinPlaceholder: string;
  clusterSearchAction: string;
  clusterInspectAction: string;
  clusterUpdatedAt: string;
  clusterMembers: string;
  clusterRepresentative: string;
  clusterDetailTitle: string;
  clusterVerificationTitle: string;
  clusterAssociationScore: string;
  clusterPromoteAction: string;
  clusterEmptySelection: string;
  clusterOpenDetail: string;
  clusterOpenApi: string;
  clusterOpenRepresentativeSource: string;
  clusterOpenCoinPage: string;
};

function getCopy(lang: Language): Copy {
  if (lang === "zh") {
    return {
      title: "Crypto 新闻管理",
      subtitle: "查看候选新闻、清洗结果，并手动触发抓取或重跑 AI 处理。",
      tokenLabel: "管理员令牌",
      tokenPlaceholder: "输入 CRYPTO_ADMIN_TOKEN",
      loadData: "加载数据",
      manualRun: "手动抓取",
      reprocess: "重跑最近 72 小时",
      loading: "加载中...",
      noData: "暂无数据。",
      overview: "概览",
      macroOverview: "宏观概览",
      macroRefresh: "刷新宏观",
      macroRecent: "最近观测",
      macroRegime: "市场状态",
      macroAsOf: "指标时间",
      macroRefreshed: "抓取时间",
      macroIndicator: "指标",
      macroValue: "值",
      macroClass: "分类",
      macroProvider: "数据源",
      macroStatus: "状态",
      rawQueue: "原始候选",
      curatedItems: "清洗结果",
      pending: "待处理",
      processed: "已处理",
      rejected: "已拒绝",
      failed: "失败",
      display: "展示中",
      hidden: "隐藏",
      latestFetch: "最近抓取",
      latestPublish: "最近发布时间",
      source: "来源",
      titleCol: "标题",
      status: "状态",
      publishedAt: "发布时间",
      fetchedAt: "抓取时间",
      eventType: "事件类型",
      signal: "信号",
      noise: "噪音",
      relevance: "相关性",
      reason: "原因",
      authRequired: "先输入管理员令牌再执行后台操作。",
      actionOk: "操作执行成功。",
      actionFailed: "操作执行失败。",
      openSource: "打开原文",
      allItems: "全部条目",
      displayOnly: "只看展示项",
      clusters: "Cluster 调试",
      clusterSearchLabel: "标题检索",
      clusterSearchPlaceholder: "按 cluster 标题或来源搜索",
      clusterCoinLabel: "币种过滤",
      clusterCoinPlaceholder: "例如 BTC",
      clusterSearchAction: "搜索 cluster",
      clusterInspectAction: "查看详情",
      clusterUpdatedAt: "更新时间",
      clusterMembers: "成员数",
      clusterRepresentative: "代表新闻",
      clusterDetailTitle: "Cluster 详情",
      clusterVerificationTitle: "人工验收",
      clusterAssociationScore: "关联分",
      clusterPromoteAction: "设为代表",
      clusterEmptySelection: "先从列表中选择一个 cluster。",
      clusterOpenDetail: "打开前台事件页",
      clusterOpenApi: "打开事件 API",
      clusterOpenRepresentativeSource: "打开代表原文",
      clusterOpenCoinPage: "打开币种页"
    };
  }

  return {
    title: "Crypto News Admin",
    subtitle: "Inspect raw candidates, curated items, and manually run ingestion or AI reprocessing.",
    tokenLabel: "Admin token",
    tokenPlaceholder: "Enter CRYPTO_ADMIN_TOKEN",
    loadData: "Load data",
    manualRun: "Run ingestion",
    reprocess: "Reprocess last 72h",
    loading: "Loading...",
    noData: "No data available.",
    overview: "Overview",
    macroOverview: "Macro overview",
    macroRefresh: "Refresh macro",
    macroRecent: "Recent observations",
    macroRegime: "Market regime",
    macroAsOf: "As of",
    macroRefreshed: "Fetched",
    macroIndicator: "Indicator",
    macroValue: "Value",
    macroClass: "Class",
    macroProvider: "Provider",
    macroStatus: "Status",
    rawQueue: "Raw candidates",
    curatedItems: "Curated items",
    pending: "Pending",
    processed: "Processed",
    rejected: "Rejected",
    failed: "Failed",
    display: "Display",
    hidden: "Hidden",
    latestFetch: "Latest fetch",
    latestPublish: "Latest publish",
    source: "Source",
    titleCol: "Title",
    status: "Status",
    publishedAt: "Published",
    fetchedAt: "Fetched",
    eventType: "Event type",
    signal: "Signal",
    noise: "Noise",
    relevance: "Relevance",
    reason: "Reason",
    authRequired: "Enter the admin token before using admin actions.",
    actionOk: "Action completed successfully.",
    actionFailed: "Action failed.",
    openSource: "Open source",
    allItems: "All items",
    displayOnly: "Display items only",
    clusters: "Cluster debug",
    clusterSearchLabel: "Title search",
    clusterSearchPlaceholder: "Search by cluster label or source",
    clusterCoinLabel: "Coin filter",
    clusterCoinPlaceholder: "e.g. BTC",
    clusterSearchAction: "Search clusters",
    clusterInspectAction: "Inspect",
    clusterUpdatedAt: "Updated",
    clusterMembers: "Members",
    clusterRepresentative: "Representative",
    clusterDetailTitle: "Cluster detail",
    clusterVerificationTitle: "Manual verification",
    clusterAssociationScore: "Association",
    clusterPromoteAction: "Promote",
    clusterEmptySelection: "Select a cluster from the list first.",
    clusterOpenDetail: "Open event page",
    clusterOpenApi: "Open event API",
    clusterOpenRepresentativeSource: "Open representative source",
    clusterOpenCoinPage: "Open coin page"
  };
}

async function fetchAdminJson<T>(path: string, token: string): Promise<T> {
  const response = await fetch(path, {
    method: "GET",
    cache: "no-store",
    headers: {
      accept: "application/json",
      "x-admin-token": token
    }
  });

  if (!response.ok) {
    throw new Error(await response.text() || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

function formatMacroMetricValue(item: { metricValue: number | null; valueText?: string | null; unit: "index" | "percent" }): string {
  if (item.metricValue === null) {
    return item.valueText?.trim() || "-";
  }
  if (item.unit === "percent") {
    return `${item.metricValue.toFixed(2)}%`;
  }
  if (item.unit === "index") {
    return item.metricValue.toFixed(0);
  }
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2
  }).format(item.metricValue);
}

function humanizeMacroIndicator(indicatorKey: string, assetCode: string | null, lang: Language): string {
  switch (indicatorKey) {
    case "fear_and_greed":
      return lang === "zh" ? "恐慌与贪婪" : "Fear & Greed";
    case "btc_dominance":
      return lang === "zh" ? "BTC 市占率" : "BTC dominance";
    default:
      return assetCode ? `${indicatorKey} (${assetCode})` : indicatorKey;
  }
}

function humanizeMacroStatus(status: "available" | "stale" | "unavailable", lang: Language): string {
  if (lang === "zh") {
    switch (status) {
      case "available":
        return "最新";
      case "stale":
        return "有延迟";
      default:
        return "暂无";
    }
  }

  switch (status) {
    case "available":
      return "Live";
    case "stale":
      return "Stale";
    default:
      return "Unavailable";
  }
}

function humanizeStance(status: "bullish" | "bearish" | "neutral", lang: Language): string {
  if (lang === "zh") {
    switch (status) {
      case "bullish":
        return "利好";
      case "bearish":
        return "利空";
      default:
        return "中性";
    }
  }

  switch (status) {
    case "bullish":
      return "Bullish";
    case "bearish":
      return "Bearish";
    default:
      return "Neutral";
  }
}

function humanizeEventType(value: string): string {
  return value
    .split("_")
    .filter((part) => part.length > 0)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function CryptoAdminPage(props: CryptoAdminPageProps) {
  const copy = useMemo(() => getCopy(props.lang), [props.lang]);
  const [token, setToken] = useState("");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [macroOverview, setMacroOverview] = useState<MacroAdminOverview | null>(null);
  const [rawItems, setRawItems] = useState<AdminRawItem[]>([]);
  const [curatedItems, setCuratedItems] = useState<AdminCuratedItem[]>([]);
  const [clusterItems, setClusterItems] = useState<AdminClusterListItem[]>([]);
  const [clusterQuery, setClusterQuery] = useState("");
  const [clusterCoinCode, setClusterCoinCode] = useState("");
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);
  const [clusterDetail, setClusterDetail] = useState<AdminClusterDetail | null>(null);
  const [displayOnly, setDisplayOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("crypto-admin-token") ?? "";
    if (saved) {
      setToken(saved);
    }
  }, []);

  async function loadData(
    nextToken = token,
    nextDisplayOnly = displayOnly,
    nextSelectedClusterId = selectedClusterId,
    nextClusterQuery = clusterQuery,
    nextClusterCoinCode = clusterCoinCode
  ) {
    const normalizedToken = nextToken.trim();
    if (!normalizedToken) {
      setMessage({ kind: "error", text: copy.authRequired });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const normalizedClusterQuery = nextClusterQuery.trim();
      const normalizedClusterCoinCode = nextClusterCoinCode.trim().toUpperCase();
      const [nextOverview, nextMacroOverview, rawResponse, curatedResponse, clusterResponse, nextClusterDetail] = await Promise.all([
        fetchAdminJson<AdminOverview>("/api/crypto/news/admin/overview", normalizedToken),
        fetchAdminJson<MacroAdminOverview>("/api/crypto/macro/admin/overview", normalizedToken),
        fetchAdminJson<{ items: AdminRawItem[] }>("/api/crypto/news/admin/raw?limit=50", normalizedToken),
        fetchAdminJson<{ items: AdminCuratedItem[] }>(
          `/api/crypto/news/admin/items?limit=50&displayOnly=${nextDisplayOnly ? "true" : "false"}`,
          normalizedToken
        ),
        fetchAdminJson<{ items: AdminClusterListItem[] }>(
          `/api/crypto/news/admin/clusters?limit=30&query=${encodeURIComponent(normalizedClusterQuery)}&coinCode=${encodeURIComponent(normalizedClusterCoinCode)}`,
          normalizedToken
        ),
        nextSelectedClusterId
          ? fetchAdminJson<AdminClusterDetail>(`/api/crypto/news/admin/cluster/${nextSelectedClusterId}`, normalizedToken)
          : Promise.resolve(null)
      ]);

      window.localStorage.setItem("crypto-admin-token", normalizedToken);
      setOverview(nextOverview);
      setMacroOverview(nextMacroOverview);
      setRawItems(rawResponse.items ?? []);
      setCuratedItems(curatedResponse.items ?? []);
      setClusterItems(clusterResponse.items ?? []);
      setSelectedClusterId(nextSelectedClusterId);
      setClusterDetail(nextClusterDetail);
    } catch (error) {
      setMessage({
        kind: "error",
        text: `${copy.actionFailed} ${error instanceof Error ? error.message : String(error)}`
      });
    } finally {
      setLoading(false);
    }
  }

  async function runAction(path: string) {
    const normalizedToken = token.trim();
    if (!normalizedToken) {
      setMessage({ kind: "error", text: copy.authRequired });
      return;
    }

    setLoading(true);
    setMessage(null);
    try {
      await fetchAdminJson(path, normalizedToken);
      setMessage({ kind: "success", text: copy.actionOk });
      await loadData(normalizedToken, displayOnly, selectedClusterId, clusterQuery, clusterCoinCode);
    } catch (error) {
      setMessage({
        kind: "error",
        text: `${copy.actionFailed} ${error instanceof Error ? error.message : String(error)}`
      });
      setLoading(false);
    }
  }

  function renderMetricSkeleton(count: number, className: string) {
    return (
      <div className={className}>
        {Array.from({ length: count }, (_, index) => (
          <div key={`metric-skeleton-${count}-${index}`} className="rounded-2xl border border-border/70 bg-background/45 p-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="mt-3 h-7 w-24" />
            <Skeleton className="mt-3 h-4 w-full" />
          </div>
        ))}
      </div>
    );
  }

  function renderEmptyState(message: string) {
    return (
      <Empty className="border border-dashed border-border/70 bg-background/20 py-8">
        <EmptyHeader>
          <EmptyTitle>{message}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <main className="page-shell space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{copy.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{copy.subtitle}</p>
          <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto]">
            <FieldGroup className="gap-0">
              <Field className="gap-2">
                <FieldContent>
                  <FieldLabel>{copy.tokenLabel}</FieldLabel>
                  <Input
                    type="password"
                    value={token}
                    onChange={(event) => setToken(event.target.value)}
                    placeholder={copy.tokenPlaceholder}
                  />
                </FieldContent>
              </Field>
            </FieldGroup>
            <Button className="self-end" onClick={() => void loadData()} disabled={loading}>
              {loading ? copy.loading : copy.loadData}
            </Button>
            <div className="flex self-end gap-2">
              <Button variant="outline" onClick={() => void runAction("/api/crypto/news/admin/run")} disabled={loading}>
                {copy.manualRun}
              </Button>
              <Button variant="outline" onClick={() => void runAction("/api/crypto/news/admin/reprocess?hours=72&limit=80")} disabled={loading}>
                {copy.reprocess}
              </Button>
            </div>
          </div>
          {message ? <Separator /> : null}
          {message ? (
            <Alert variant={message.kind === "error" ? "destructive" : "default"}>
              <AlertTitle>{message.kind === "error" ? copy.actionFailed : copy.actionOk}</AlertTitle>
              <AlertDescription>{message.text}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>{copy.macroOverview}</CardTitle>
            <Button variant="outline" onClick={() => void runAction("/api/crypto/macro/admin/refresh")} disabled={loading}>
              {copy.macroRefresh}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {!macroOverview ? (
            loading ? renderMetricSkeleton(4, "grid gap-3 md:grid-cols-2 xl:grid-cols-4") : renderEmptyState(copy.noData)
          ) : (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-border/70 bg-background/45 p-4">
                  <p className="text-xs text-muted-foreground">{copy.macroRegime}</p>
                  <p className="mt-2 text-lg font-semibold">
                    {props.lang === "zh" ? macroOverview.snapshot.regime.labelZh : macroOverview.snapshot.regime.labelEn}
                  </p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {props.lang === "zh" ? macroOverview.snapshot.regime.summaryZh : macroOverview.snapshot.regime.summaryEn}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/45 p-4">
                  <p className="text-xs text-muted-foreground">{copy.macroAsOf}</p>
                  <p className="mt-2 text-sm font-medium">
                    {macroOverview.snapshot.asOf ? formatDateTime(macroOverview.snapshot.asOf, props.lang) : "-"}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">{copy.macroRefreshed}</p>
                  <p className="mt-1 text-sm font-medium">
                    {macroOverview.snapshot.refreshedAt ? formatDateTime(macroOverview.snapshot.refreshedAt, props.lang) : "-"}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/45 p-4">
                  <p className="text-xs text-muted-foreground">{humanizeMacroIndicator("fear_and_greed", null, props.lang)}</p>
                  <p className="mt-2 text-2xl font-semibold">{formatMacroMetricValue({
                    metricValue: macroOverview.snapshot.fearGreed.value,
                    unit: "index"
                  })}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline">{humanizeMacroStatus(macroOverview.snapshot.fearGreed.status, props.lang)}</Badge>
                    {macroOverview.snapshot.fearGreed.classification ? <Badge variant="secondary">{macroOverview.snapshot.fearGreed.classification}</Badge> : null}
                  </div>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/45 p-4">
                  <p className="text-xs text-muted-foreground">{humanizeMacroIndicator("btc_dominance", null, props.lang)}</p>
                  <p className="mt-2 text-2xl font-semibold">{formatMacroMetricValue({
                    metricValue: macroOverview.snapshot.btcDominance.value,
                    unit: "percent"
                  })}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline">{humanizeMacroStatus(macroOverview.snapshot.btcDominance.status, props.lang)}</Badge>
                  </div>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium text-foreground">{copy.macroRecent}</p>
              </div>
              <div className="overflow-x-auto">
                <Table className="min-w-[980px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{copy.macroIndicator}</TableHead>
                      <TableHead>{copy.macroValue}</TableHead>
                      <TableHead>{copy.macroClass}</TableHead>
                      <TableHead>{copy.macroProvider}</TableHead>
                      <TableHead>{copy.macroStatus}</TableHead>
                      <TableHead>{copy.macroAsOf}</TableHead>
                      <TableHead>{copy.macroRefreshed}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {macroOverview.recentObservations.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          {copy.noData}
                        </TableCell>
                      </TableRow>
                    ) : (
                      macroOverview.recentObservations.map((item, index) => (
                        <TableRow key={`${item.indicatorKey}-${item.assetCode ?? "global"}-${item.observedAt}-${index}`}>
                          <TableCell className="min-w-[220px] font-medium">
                            {humanizeMacroIndicator(item.indicatorKey, item.assetCode, props.lang)}
                          </TableCell>
                          <TableCell>{formatMacroMetricValue(item)}</TableCell>
                          <TableCell>{item.classification ?? "-"}</TableCell>
                          <TableCell>
                            <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                              {item.sourceName}
                            </a>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {humanizeMacroStatus(
                                Date.now() - new Date(item.observedAt).getTime() > 24 * 60 * 60 * 1000 ? "stale" : "available",
                                props.lang
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDateTime(item.observedAt, props.lang)}</TableCell>
                          <TableCell>{formatDateTime(item.fetchedAt, props.lang)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{copy.overview}</CardTitle>
        </CardHeader>
        <CardContent>
          {!overview ? (
            loading ? renderMetricSkeleton(8, "grid gap-3 md:grid-cols-4 xl:grid-cols-8") : renderEmptyState(copy.noData)
          ) : (
            <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
              <div className="rounded-2xl border border-border/70 bg-background/45 p-4"><p className="text-xs text-muted-foreground">{copy.pending}</p><p className="mt-2 text-2xl font-semibold">{overview.pendingRawCount}</p></div>
              <div className="rounded-2xl border border-border/70 bg-background/45 p-4"><p className="text-xs text-muted-foreground">{copy.processed}</p><p className="mt-2 text-2xl font-semibold">{overview.processedRawCount}</p></div>
              <div className="rounded-2xl border border-border/70 bg-background/45 p-4"><p className="text-xs text-muted-foreground">{copy.rejected}</p><p className="mt-2 text-2xl font-semibold">{overview.rejectedRawCount}</p></div>
              <div className="rounded-2xl border border-border/70 bg-background/45 p-4"><p className="text-xs text-muted-foreground">{copy.failed}</p><p className="mt-2 text-2xl font-semibold">{overview.failedRawCount}</p></div>
              <div className="rounded-2xl border border-border/70 bg-background/45 p-4"><p className="text-xs text-muted-foreground">{copy.display}</p><p className="mt-2 text-2xl font-semibold">{overview.displayItemCount}</p></div>
              <div className="rounded-2xl border border-border/70 bg-background/45 p-4"><p className="text-xs text-muted-foreground">{copy.hidden}</p><p className="mt-2 text-2xl font-semibold">{overview.hiddenItemCount}</p></div>
              <div className="rounded-2xl border border-border/70 bg-background/45 p-4"><p className="text-xs text-muted-foreground">{copy.latestFetch}</p><p className="mt-2 text-sm font-medium">{overview.latestFetchedAt ? formatDateTime(overview.latestFetchedAt, props.lang) : "-"}</p></div>
              <div className="rounded-2xl border border-border/70 bg-background/45 p-4"><p className="text-xs text-muted-foreground">{copy.latestPublish}</p><p className="mt-2 text-sm font-medium">{overview.latestPublishedAt ? formatDateTime(overview.latestPublishedAt, props.lang) : "-"}</p></div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{copy.clusters}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_220px_auto]">
            <FieldGroup className="gap-0">
              <Field className="gap-2">
                <FieldContent>
                  <FieldLabel>{copy.clusterSearchLabel}</FieldLabel>
                  <Input
                    value={clusterQuery}
                    onChange={(event) => setClusterQuery(event.target.value)}
                    placeholder={copy.clusterSearchPlaceholder}
                  />
                </FieldContent>
              </Field>
            </FieldGroup>
            <FieldGroup className="gap-0">
              <Field className="gap-2">
                <FieldContent>
                  <FieldLabel>{copy.clusterCoinLabel}</FieldLabel>
                  <Input
                    value={clusterCoinCode}
                    onChange={(event) => setClusterCoinCode(event.target.value.toUpperCase())}
                    placeholder={copy.clusterCoinPlaceholder}
                  />
                </FieldContent>
              </Field>
            </FieldGroup>
            <Button
              className="self-end"
              variant="outline"
              onClick={() => {
                setSelectedClusterId(null);
                void loadData(token, displayOnly, null, clusterQuery, clusterCoinCode);
              }}
              disabled={loading}
            >
              {copy.clusterSearchAction}
            </Button>
          </div>

          {clusterItems.length === 0 ? (
            renderEmptyState(loading ? copy.loading : copy.noData)
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1120px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{copy.titleCol}</TableHead>
                    <TableHead>{copy.clusterRepresentative}</TableHead>
                    <TableHead>{copy.publishedAt}</TableHead>
                    <TableHead>{copy.signal}</TableHead>
                    <TableHead>{copy.clusterMembers}</TableHead>
                    <TableHead>{copy.clusterUpdatedAt}</TableHead>
                    <TableHead>{copy.status}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clusterItems.map((item) => (
                    <TableRow key={`cluster-${item.clusterId}`}>
                      <TableCell className="min-w-[320px]">
                        <p className="font-medium text-foreground">{item.label}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.relatedCoins.slice(0, 4).map((coinCode) => (
                            <Badge key={`${item.clusterId}-${coinCode}`} variant="outline">{coinCode}</Badge>
                          ))}
                          {item.topics.slice(0, 3).map((topic) => (
                            <Badge key={`${item.clusterId}-${topic}`} variant="secondary">{topic}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{item.representativeSource}</TableCell>
                      <TableCell>{formatDateTime(item.representativePublishedAt, props.lang)}</TableCell>
                      <TableCell>{item.importanceScore}</TableCell>
                      <TableCell>{item.memberCount}</TableCell>
                      <TableCell>{formatDateTime(item.updatedAt, props.lang)}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant={selectedClusterId === item.clusterId ? "default" : "outline"}
                          onClick={() => {
                            setSelectedClusterId(item.clusterId);
                            void loadData(token, displayOnly, item.clusterId, clusterQuery, clusterCoinCode);
                          }}
                          disabled={loading}
                        >
                          {copy.clusterInspectAction}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="rounded-2xl border border-border/70 bg-background/40 p-4">
            {!clusterDetail ? (
              <p className="text-sm text-muted-foreground">{copy.clusterEmptySelection}</p>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{copy.clusterDetailTitle}</p>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-base font-semibold text-foreground">{clusterDetail.cluster.label}</p>
                  <Badge variant="outline">{humanizeStance(clusterDetail.cluster.stance, props.lang)}</Badge>
                  <Badge variant="secondary">{clusterDetail.cluster.marketImpact}</Badge>
                  <Badge variant="outline">{copy.clusterMembers}: {clusterDetail.members.length}</Badge>
                  {clusterDetail.cluster.associationScore !== null ? (
                    <Badge variant="secondary">{copy.clusterAssociationScore}: {clusterDetail.cluster.associationScore}</Badge>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                  <p>{copy.clusterRepresentative}: {clusterDetail.cluster.representative.source}</p>
                  <p>{copy.publishedAt}: {formatDateTime(clusterDetail.cluster.representative.publishedAt, props.lang)}</p>
                  <p>{copy.clusterUpdatedAt}: {formatDateTime(clusterItems.find((item) => item.clusterId === clusterDetail.cluster.clusterId)?.updatedAt ?? clusterDetail.cluster.representative.publishedAt, props.lang)}</p>
                </div>

                <Separator />

                <div className="rounded-2xl border border-border/70 bg-background/55 p-4">
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{copy.clusterVerificationTitle}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Link
                      href={assetEventPath(props.lang, clusterDetail.cluster.clusterId)}
                      className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      {copy.clusterOpenDetail}
                    </Link>
                    <a
                      href={`/api/crypto/news/event/${clusterDetail.cluster.clusterId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      {copy.clusterOpenApi}
                    </a>
                    <a
                      href={clusterDetail.cluster.representative.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      {copy.clusterOpenRepresentativeSource}
                    </a>
                    {clusterDetail.cluster.relatedCoins.slice(0, 3).map((coinCode) => (
                      <Link
                        key={`cluster-verify-${coinCode}`}
                        href={assetInstrumentPath(props.lang, "crypto", coinCode)}
                        className="inline-flex items-center rounded-full border border-border/70 bg-background/70 px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:text-primary"
                      >
                        {copy.clusterOpenCoinPage}: {coinCode}
                      </Link>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="grid gap-3 xl:grid-cols-2">
                  {clusterDetail.members.map((member) => (
                    <article key={`cluster-member-${member.id}`} className="rounded-2xl border border-border/70 bg-background/55 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {member.isRepresentative ? <Badge>{copy.clusterRepresentative}</Badge> : null}
                        <Badge variant="outline">{humanizeStance(member.stance, props.lang)}</Badge>
                        <Badge variant="secondary">{humanizeEventType(member.eventType)}</Badge>
                        <Badge variant="outline">{copy.signal}: {member.signalScore}</Badge>
                        {member.shouldDisplay ? <Badge variant="secondary">{copy.display}</Badge> : <Badge variant="outline">{copy.hidden}</Badge>}
                      </div>
                      <a
                        href={member.canonicalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 block text-sm font-semibold text-foreground transition-colors hover:text-primary hover:underline"
                      >
                        {member.title}
                      </a>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {member.sourceName} · {formatDateTime(member.publishedAt, props.lang)}
                      </p>
                      <p className="mt-3 text-sm leading-6 text-foreground/90">
                        {props.lang === "zh" ? member.summaryZh : member.summaryEn}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {member.relatedCoins.slice(0, 4).map((coinCode) => (
                          <Badge key={`${member.id}-${coinCode}`} variant="outline">{coinCode}</Badge>
                        ))}
                        {member.topics.slice(0, 3).map((topic) => (
                          <Badge key={`${member.id}-${topic}`} variant="secondary">{topic}</Badge>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">{copy.reason}: {member.reason}</p>
                        {!member.isRepresentative ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void runAction(`/api/crypto/news/admin/cluster/${clusterDetail.cluster.clusterId}/promote/${member.id}`)}
                            disabled={loading}
                          >
                            {copy.clusterPromoteAction}
                          </Button>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3">
            <CardTitle>{copy.curatedItems}</CardTitle>
            <ToggleGroup
              type="single"
              value={displayOnly ? "display" : "all"}
              onValueChange={(value) => {
                if (value !== "all" && value !== "display") {
                  return;
                }

                const nextValue = value === "display";
                setDisplayOnly(nextValue);
                if (token.trim()) {
                  void loadData(token, nextValue, selectedClusterId, clusterQuery, clusterCoinCode);
                }
              }}
              variant="outline"
              size="sm"
            >
              <ToggleGroupItem value="all" aria-label={copy.allItems}>
                {copy.allItems}
              </ToggleGroupItem>
              <ToggleGroupItem value="display" aria-label={copy.displayOnly}>
                {copy.displayOnly}
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </CardHeader>
        <CardContent>
          {curatedItems.length === 0 ? (
            renderEmptyState(loading ? copy.loading : copy.noData)
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[1100px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{copy.titleCol}</TableHead>
                    <TableHead>{copy.source}</TableHead>
                    <TableHead>{copy.publishedAt}</TableHead>
                    <TableHead>{copy.relevance}</TableHead>
                    <TableHead>{copy.eventType}</TableHead>
                    <TableHead>{copy.signal}</TableHead>
                    <TableHead>{copy.noise}</TableHead>
                    <TableHead>{copy.reason}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {curatedItems.map((item) => (
                    <TableRow key={`curated-${item.id}`}>
                      <TableCell className="min-w-[360px]">
                        <a href={item.canonicalUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                          {item.title}
                        </a>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {item.shouldDisplay ? <Badge>{copy.display}</Badge> : <Badge variant="outline">{copy.hidden}</Badge>}
                          {item.isMarketWide ? <Badge variant="secondary">market</Badge> : null}
                          {item.relatedCoins.slice(0, 4).map((coinCode) => (
                            <Badge key={`${item.id}-${coinCode}`} variant="outline">{coinCode}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>{item.sourceName}</TableCell>
                      <TableCell>{formatDateTime(item.publishedAt, props.lang)}</TableCell>
                      <TableCell>{item.relevanceType}</TableCell>
                      <TableCell>{item.eventType}</TableCell>
                      <TableCell>{item.signalScore}</TableCell>
                      <TableCell>{item.noiseScore}</TableCell>
                      <TableCell className="text-muted-foreground">{item.reason}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>{copy.rawQueue}</CardTitle>
        </CardHeader>
        <CardContent>
          {rawItems.length === 0 ? (
            renderEmptyState(loading ? copy.loading : copy.noData)
          ) : (
            <div className="overflow-x-auto">
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{copy.titleCol}</TableHead>
                    <TableHead>{copy.source}</TableHead>
                    <TableHead>{copy.status}</TableHead>
                    <TableHead>{copy.publishedAt}</TableHead>
                    <TableHead>{copy.fetchedAt}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rawItems.map((item) => (
                    <TableRow key={`raw-${item.id}`}>
                      <TableCell className="min-w-[380px]">
                        <a href={item.canonicalUrl} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                          {item.title}
                        </a>
                      </TableCell>
                      <TableCell>{item.sourceName}</TableCell>
                      <TableCell>{item.ingestStatus}</TableCell>
                      <TableCell>{formatDateTime(item.publishedAt, props.lang)}</TableCell>
                      <TableCell>{formatDateTime(item.fetchedAt, props.lang)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
