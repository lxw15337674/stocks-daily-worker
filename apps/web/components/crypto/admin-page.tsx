"use client";

import { useEffect, useMemo, useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/crypto/format";
import type { Language } from "@/lib/i18n";

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
  displayOnly: string;
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
      displayOnly: "只看展示项"
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
    displayOnly: "Display items only"
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

export default function CryptoAdminPage(props: CryptoAdminPageProps) {
  const copy = useMemo(() => getCopy(props.lang), [props.lang]);
  const [token, setToken] = useState("");
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [rawItems, setRawItems] = useState<AdminRawItem[]>([]);
  const [curatedItems, setCuratedItems] = useState<AdminCuratedItem[]>([]);
  const [displayOnly, setDisplayOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    const saved = window.localStorage.getItem("crypto-admin-token") ?? "";
    if (saved) {
      setToken(saved);
    }
  }, []);

  async function loadData(nextToken = token, nextDisplayOnly = displayOnly) {
    const normalizedToken = nextToken.trim();
    if (!normalizedToken) {
      setMessage({ kind: "error", text: copy.authRequired });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const [nextOverview, rawResponse, curatedResponse] = await Promise.all([
        fetchAdminJson<AdminOverview>("/api/crypto/news/admin/overview", normalizedToken),
        fetchAdminJson<{ items: AdminRawItem[] }>("/api/crypto/news/admin/raw?limit=50", normalizedToken),
        fetchAdminJson<{ items: AdminCuratedItem[] }>(
          `/api/crypto/news/admin/items?limit=50&displayOnly=${nextDisplayOnly ? "true" : "false"}`,
          normalizedToken
        )
      ]);

      window.localStorage.setItem("crypto-admin-token", normalizedToken);
      setOverview(nextOverview);
      setRawItems(rawResponse.items ?? []);
      setCuratedItems(curatedResponse.items ?? []);
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
      await loadData(normalizedToken, displayOnly);
    } catch (error) {
      setMessage({
        kind: "error",
        text: `${copy.actionFailed} ${error instanceof Error ? error.message : String(error)}`
      });
      setLoading(false);
    }
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
            <div className="space-y-2">
              <Label>{copy.tokenLabel}</Label>
              <Input
                type="password"
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder={copy.tokenPlaceholder}
              />
            </div>
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
          <CardTitle>{copy.overview}</CardTitle>
        </CardHeader>
        <CardContent>
          {!overview ? (
            <p className="empty">{loading ? copy.loading : copy.noData}</p>
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
          <div className="flex items-center justify-between gap-3">
            <CardTitle>{copy.curatedItems}</CardTitle>
            <Button variant={displayOnly ? "default" : "outline"} size="sm" onClick={() => {
              const nextValue = !displayOnly;
              setDisplayOnly(nextValue);
              if (token.trim()) {
                void loadData(token, nextValue);
              }
            }}>
              {copy.displayOnly}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {curatedItems.length === 0 ? (
            <p className="empty">{loading ? copy.loading : copy.noData}</p>
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
            <p className="empty">{loading ? copy.loading : copy.noData}</p>
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
