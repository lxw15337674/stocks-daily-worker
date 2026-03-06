"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type StockItem = {
  id: number;
  symbol: string;
  name: string;
  displayName: string;
  codes: string;
  businessType: string;
  aliases: string[];
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

type StockFormState = {
  symbol: string;
  name: string;
  displayName: string;
  codes: string;
  businessType: string;
  aliasesText: string;
  sortOrder: string;
  isActive: boolean;
};

type RowAction = {
  id: number;
  type: "delete" | "regenerate";
};

type StockPreviewCandidate = {
  symbol: string;
  name: string;
  displayName: string;
  codes: string;
  businessType: string;
  aliases: string[];
  warnings: string[];
  rationale?: string;
};

const EMPTY_FORM: StockFormState = {
  symbol: "",
  name: "",
  displayName: "",
  codes: "",
  businessType: "",
  aliasesText: "",
  sortOrder: "",
  isActive: true
};

const ADMIN_TOKEN_STORAGE_KEY = "stocks-admin-token";

function parseAliasesInput(raw: string): string[] {
  const seen = new Set<string>();
  return raw
    .split(/[,，\n]+/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .filter((item) => {
      const lower = item.toLowerCase();
      if (seen.has(lower)) {
        return false;
      }
      seen.add(lower);
      return true;
    })
    .slice(0, 24);
}

function buildPayload(form: StockFormState, isCreate: boolean): Record<string, unknown> {
  const aliases = parseAliasesInput(form.aliasesText);
  if (isCreate) {
    const payload: Record<string, unknown> = {};
    const name = form.name.trim();
    if (name) {
      payload.name = name;
    }
    if (form.symbol.trim()) {
      payload.symbol = form.symbol.trim();
    }
    if (form.displayName.trim()) {
      payload.displayName = form.displayName.trim();
    }
    if (form.codes.trim()) {
      payload.codes = form.codes.trim();
    }
    if (form.businessType.trim()) {
      payload.businessType = form.businessType.trim();
    }
    if (aliases.length > 0) {
      payload.aliases = aliases;
    }
    if (form.sortOrder.trim()) {
      payload.sortOrder = Number(form.sortOrder);
    }
    payload.isActive = form.isActive;
    return payload;
  }

  const payload: Record<string, unknown> = {};
  const push = (key: keyof StockFormState, value: string) => {
    const normalized = value.trim();
    if (normalized.length > 0) {
      payload[key] = normalized;
    }
  };

  if (form.symbol.trim()) {
    payload.symbol = form.symbol.trim();
  }
  push("name", form.name);
  push("displayName", form.displayName);
  push("codes", form.codes);
  push("businessType", form.businessType);
  if (form.sortOrder.trim()) {
    payload.sortOrder = Number(form.sortOrder);
  }
  if (aliases.length > 0) {
    payload.aliases = aliases;
  }
  payload.isActive = form.isActive;
  return payload;
}

export default function StocksPage() {
  const [token, setToken] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [items, setItems] = useState<StockItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authError, setAuthError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [formSaving, setFormSaving] = useState(false);
  const [rowAction, setRowAction] = useState<RowAction | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<StockFormState>(EMPTY_FORM);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [authChecking, setAuthChecking] = useState(false);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [actionDialogId, setActionDialogId] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewCandidates, setPreviewCandidates] = useState<StockPreviewCandidate[]>([]);
  const [previewGlobalWarnings, setPreviewGlobalWarnings] = useState<string[]>([]);
  const [selectedPreviewIndex, setSelectedPreviewIndex] = useState(0);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    [items]
  );
  const actionTarget = useMemo(
    () => sortedItems.find((item) => item.id === actionDialogId) ?? null,
    [actionDialogId, sortedItems]
  );

  const isCreateMode = editingId === null;
  const isBusy = formSaving || rowAction !== null || previewLoading;

  function isRowActionPending(stockId: number, actionType: RowAction["type"]): boolean {
    return rowAction?.id === stockId && rowAction.type === actionType;
  }

  const selectedPreviewCandidate =
    previewCandidates.length > 0 ? previewCandidates[Math.max(0, Math.min(selectedPreviewIndex, previewCandidates.length - 1))] : null;

  function applyCandidateToForm(candidate: StockPreviewCandidate): void {
    setForm((prev) => ({
      ...prev,
      symbol: candidate.symbol,
      name: candidate.name,
      displayName: candidate.displayName,
      codes: candidate.codes,
      businessType: candidate.businessType,
      aliasesText: candidate.aliases.join(", ")
    }));
  }

  function resetCreatePreviewState(): void {
    setPreviewCandidates([]);
    setPreviewGlobalWarnings([]);
    setSelectedPreviewIndex(0);
  }

  function choosePreviewCandidate(index: number): void {
    if (index < 0 || index >= previewCandidates.length) {
      return;
    }
    setSelectedPreviewIndex(index);
    applyCandidateToForm(previewCandidates[index]);
  }

  function resetFormState(): void {
    setEditingId(null);
    setForm(EMPTY_FORM);
    resetCreatePreviewState();
  }

  function revokeAuthorization(nextAuthError = ""): void {
    setIsAuthorized(false);
    setToken("");
    setItems([]);
    resetFormState();
    setFormDialogOpen(false);
    setActionDialogId(null);
    setLoading(false);
    setError("");
    setSuccessMessage("");
    setAuthError(nextAuthError);
    resetCreatePreviewState();
    globalThis.localStorage?.removeItem(ADMIN_TOKEN_STORAGE_KEY);
  }

  async function verifyAdminToken(candidateToken: string): Promise<void> {
    const response = await fetch("/api/stocks?includeInactive=true", {
      headers: { "x-admin-token": candidateToken }
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Token validation failed (${response.status})`);
    }
  }

  async function loadStocks(nextIncludeInactive?: boolean, tokenOverride?: string): Promise<void> {
    const trimmedToken = (tokenOverride ?? token).trim();
    if (!trimmedToken) {
      revokeAuthorization("管理员令牌缺失，请重新输入。");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const useIncludeInactive = nextIncludeInactive ?? includeInactive;
      const query = useIncludeInactive ? "?includeInactive=true" : "";
      const response = await fetch(`/api/stocks${query}`, {
        headers: { "x-admin-token": trimmedToken }
      });
      if (!response.ok) {
        if (response.status === 401) {
          revokeAuthorization("管理员令牌无效，请重新输入。");
          return;
        }
        const message = await response.text();
        throw new Error(message || `Load failed (${response.status})`);
      }
      const data = (await response.json()) as { items: StockItem[] };
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const savedToken = globalThis.localStorage?.getItem(ADMIN_TOKEN_STORAGE_KEY)?.trim();
    if (!savedToken) {
      return;
    }

    let cancelled = false;
    setAuthChecking(true);
    setAuthError("");
    setToken(savedToken);

    void (async () => {
      try {
        await verifyAdminToken(savedToken);
        if (cancelled) {
          return;
        }
        setIsAuthorized(true);
        setSuccessMessage("");
        await loadStocks(includeInactive, savedToken);
      } catch {
        if (cancelled) {
          return;
        }
        revokeAuthorization("登录已失效，请重新输入管理员令牌。");
      } finally {
        if (!cancelled) {
          setAuthChecking(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitAuth(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setAuthError("请先输入管理员令牌。");
      return;
    }

    setAuthChecking(true);
    setAuthError("");
    try {
      await verifyAdminToken(trimmedToken);
      setToken(trimmedToken);
      globalThis.localStorage?.setItem(ADMIN_TOKEN_STORAGE_KEY, trimmedToken);
      setIsAuthorized(true);
      setSuccessMessage("");
      await loadStocks(includeInactive, trimmedToken);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "管理员令牌校验失败。");
    } finally {
      setAuthChecking(false);
    }
  }

  function openCreateDialog(): void {
    setEditingId(null);
    setForm(EMPTY_FORM);
    resetCreatePreviewState();
    setError("");
    setSuccessMessage("");
    setFormDialogOpen(true);
  }

  function openEditDialog(item: StockItem): void {
    setEditingId(item.id);
    setForm({
      symbol: item.symbol,
      name: item.name,
      displayName: item.displayName,
      codes: item.codes,
      businessType: item.businessType,
      aliasesText: item.aliases.join(", "),
      sortOrder: String(item.sortOrder),
      isActive: item.isActive
    });
    resetCreatePreviewState();
    setError("");
    setSuccessMessage("");
    setFormDialogOpen(true);
  }

  function closeFormDialog(): void {
    if (isBusy) {
      return;
    }
    setFormDialogOpen(false);
    resetFormState();
  }

  async function generatePreviewCandidates(): Promise<void> {
    const trimmedToken = token.trim();
    const normalizedName = form.name.trim();
    if (!trimmedToken) {
      setError("请先输入管理员令牌。");
      return;
    }
    if (!normalizedName) {
      setError("请先填写股票名称，再生成 AI 预览。");
      return;
    }

    setPreviewLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      const response = await fetch("/api/stocks/preview", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-admin-token": trimmedToken
        },
        body: JSON.stringify({ name: normalizedName })
      });

      if (!response.ok) {
        if (response.status === 401) {
          revokeAuthorization("管理员令牌无效，请重新输入。");
          return;
        }
        const message = await response.text();
        throw new Error(message || `Preview failed (${response.status})`);
      }

      const payload = (await response.json()) as {
        candidates?: StockPreviewCandidate[];
        globalWarnings?: string[];
      };

      const candidates = payload.candidates ?? [];
      if (candidates.length === 0) {
        throw new Error("AI 预览未返回候选，请重试。");
      }

      setPreviewCandidates(candidates);
      setPreviewGlobalWarnings(payload.globalWarnings ?? []);
      setSelectedPreviewIndex(0);
      applyCandidateToForm(candidates[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 预览失败");
      resetCreatePreviewState();
    } finally {
      setPreviewLoading(false);
    }
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setError("请先输入管理员令牌。");
      return;
    }
    if (isCreateMode && !form.name.trim()) {
      setError("新增时股票名称必填。");
      return;
    }
    if (isCreateMode && previewCandidates.length === 0) {
      setError("请先使用 AI 生成预览候选后再确认新增。");
      return;
    }

    setFormSaving(true);
    setError("");
    setSuccessMessage("");
    try {
      const payload = buildPayload(form, isCreateMode);
      const url = isCreateMode ? "/api/stocks" : `/api/stocks/${editingId}`;
      const method = isCreateMode ? "POST" : "PUT";
      const response = await fetch(url, {
        method,
        headers: {
          "content-type": "application/json",
          "x-admin-token": trimmedToken
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        if (response.status === 401) {
          revokeAuthorization("管理员令牌无效，请重新输入。");
          return;
        }
        const message = await response.text();
        throw new Error(message || `${method} failed (${response.status})`);
      }

      const updatedItem = (await response.json()) as StockItem;
      setFormDialogOpen(false);
      resetFormState();
      await loadStocks(includeInactive);
      setSuccessMessage(
        isCreateMode
          ? `新增成功：${updatedItem.name}（${updatedItem.symbol}）。`
          : `保存成功：${updatedItem.name}（${updatedItem.symbol}）。`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setFormSaving(false);
    }
  }

  async function softDelete(item: StockItem): Promise<void> {
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setError("请先输入管理员令牌。");
      return;
    }

    setRowAction({ id: item.id, type: "delete" });
    setError("");
    setSuccessMessage("");
    try {
      const response = await fetch(`/api/stocks/${item.id}`, {
        method: "DELETE",
        headers: { "x-admin-token": trimmedToken }
      });
      if (!response.ok) {
        if (response.status === 401) {
          revokeAuthorization("管理员令牌无效，请重新输入。");
          return;
        }
        const message = await response.text();
        throw new Error(message || `DELETE failed (${response.status})`);
      }
      setActionDialogId(null);
      await loadStocks(includeInactive);
      setSuccessMessage(`已软删除 ${item.symbol}。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setRowAction(null);
    }
  }

  async function regenerateAliases(item: StockItem): Promise<void> {
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setError("请先输入管理员令牌。");
      return;
    }

    setRowAction({ id: item.id, type: "regenerate" });
    setError("");
    setSuccessMessage("");
    try {
      const response = await fetch(`/api/stocks/${item.id}/aliases/regenerate`, {
        method: "POST",
        headers: { "x-admin-token": trimmedToken }
      });
      if (!response.ok) {
        if (response.status === 401) {
          revokeAuthorization("管理员令牌无效，请重新输入。");
          return;
        }
        const message = await response.text();
        throw new Error(message || `Regenerate failed (${response.status})`);
      }
      setActionDialogId(null);
      await loadStocks(includeInactive);
      setSuccessMessage(`${item.symbol} 的别名已重建。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "重建别名失败");
    } finally {
      setRowAction(null);
    }
  }

  if (!isAuthorized) {
    return (
      <main className="page-shell">
        <Card className="mx-auto max-w-lg">
          <CardHeader className="pb-3">
            <CardTitle>股票管理登录</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {authChecking ? (
              <Alert>
                <AlertDescription>正在校验管理员令牌...</AlertDescription>
              </Alert>
            ) : null}
            <form className="space-y-3" onSubmit={submitAuth}>
              <div className="space-y-1">
                <Label htmlFor="admin-token">管理员令牌</Label>
                <Input
                  id="admin-token"
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="请输入管理员令牌"
                  autoComplete="off"
                />
              </div>
              <Button type="submit" className="w-full" disabled={authChecking}>
                {authChecking ? "验证中..." : "进入股票管理"}
              </Button>
            </form>
            {authError ? (
              <Alert variant="destructive">
                <AlertTitle>验证失败</AlertTitle>
                <AlertDescription>{authError}</AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="meta">已验证管理员令牌，可进行股票管理。</p>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={openCreateDialog} disabled={isBusy}>
            新增股票
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => revokeAuthorization()}>
            退出管理
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="mb-3">
          <AlertTitle>操作失败</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {successMessage ? (
        <Alert variant="success" className="mb-3">
          <AlertTitle>操作成功</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>股票池管理</CardTitle>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="include-inactive"
                    checked={includeInactive}
                    onCheckedChange={(checked) => {
                      const next = checked === true;
                      setIncludeInactive(next);
                      void loadStocks(next);
                    }}
                  />
                  <Label htmlFor="include-inactive" className="font-normal">
                    显示停用
                  </Label>
                </div>
                <Button variant="outline" size="sm" onClick={() => void loadStocks()} disabled={loading || isBusy}>
                  刷新
                </Button>
              </div>
            </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Alert>
              <AlertDescription>加载中...</AlertDescription>
            </Alert>
          ) : null}
          {!loading && sortedItems.length === 0 ? (
            <Alert>
              <AlertDescription>暂无数据。</AlertDescription>
            </Alert>
          ) : null}
          {!loading && sortedItems.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="min-w-[840px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>排序</TableHead>
                    <TableHead>股票代码</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>展示名</TableHead>
                    <TableHead>交易所代码</TableHead>
                    <TableHead>业务</TableHead>
                    <TableHead>别名</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.sortOrder}</TableCell>
                      <TableCell className="font-medium">{item.symbol}</TableCell>
                      <TableCell>{item.name}</TableCell>
                      <TableCell>{item.displayName}</TableCell>
                      <TableCell>{item.codes}</TableCell>
                      <TableCell>{item.businessType}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {item.aliases.slice(0, 3).map((alias) => (
                            <Badge key={alias} variant="outline">
                              {alias}
                            </Badge>
                          ))}
                          {item.aliases.length > 3 ? <Badge variant="secondary">+{item.aliases.length - 3}</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell>{item.isActive ? <Badge>启用</Badge> : <Badge variant="secondary">停用</Badge>}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => setActionDialogId(item.id)} disabled={isBusy}>
                          {rowAction?.id === item.id ? "处理中..." : "操作"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Dialog
        open={formDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeFormDialog();
            return;
          }
          setFormDialogOpen(true);
        }}
      >
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isCreateMode ? "新增股票" : `编辑股票 #${editingId}`}</DialogTitle>
            {isCreateMode ? <DialogDescription>创建时先生成 AI 预览候选，再确认新增。</DialogDescription> : null}
          </DialogHeader>
          <form className="space-y-3" onSubmit={submitForm}>
            {isCreateMode ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="preview-name">股票名称</Label>
                  <Input
                    id="preview-name"
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="请输入股票名称"
                  />
                  <Button type="button" variant="secondary" onClick={() => void generatePreviewCandidates()} disabled={isBusy}>
                    {previewLoading ? "生成中..." : "AI 生成预览"}
                  </Button>
                </div>

                {previewGlobalWarnings.length > 0 ? (
                  <Alert>
                    <AlertTitle>预览提示</AlertTitle>
                    <AlertDescription>{previewGlobalWarnings.join("；")}</AlertDescription>
                  </Alert>
                ) : null}

                {previewCandidates.length > 0 ? (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label>候选方案</Label>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {previewCandidates.map((candidate, index) => (
                          <Button
                            key={`${candidate.symbol}-${index}`}
                            type="button"
                            variant={selectedPreviewIndex === index ? "default" : "outline"}
                            className="h-auto min-h-[86px] w-full flex-col items-start justify-start gap-1 whitespace-normal py-2 text-left"
                            onClick={() => choosePreviewCandidate(index)}
                            disabled={isBusy}
                          >
                            <span className="block text-xs text-muted-foreground">{`候选 ${index + 1}`}</span>
                            <span className="block break-all font-medium leading-tight">{candidate.symbol}</span>
                            <span className="block break-words text-xs leading-tight">{candidate.displayName}</span>
                          </Button>
                        ))}
                      </div>
                    </div>

                    {selectedPreviewCandidate?.warnings && selectedPreviewCandidate.warnings.length > 0 ? (
                      <Alert>
                        <AlertTitle>候选告警</AlertTitle>
                        <AlertDescription>{selectedPreviewCandidate.warnings.join("；")}</AlertDescription>
                      </Alert>
                    ) : null}

                    {selectedPreviewCandidate?.rationale ? (
                      <Alert>
                        <AlertTitle>AI 说明</AlertTitle>
                        <AlertDescription>{selectedPreviewCandidate.rationale}</AlertDescription>
                      </Alert>
                    ) : null}

                    <div className="space-y-1">
                      <Label htmlFor="create-symbol">股票代码</Label>
                      <Input
                        id="create-symbol"
                        value={form.symbol}
                        onChange={(event) => setForm((prev) => ({ ...prev, symbol: event.target.value }))}
                        placeholder="例如 BABA（可编辑）"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="create-display-name">展示名称</Label>
                      <Input
                        id="create-display-name"
                        value={form.displayName}
                        onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                        placeholder="例如 阿里巴巴"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="create-codes">交易所代码</Label>
                      <Input
                        id="create-codes"
                        value={form.codes}
                        onChange={(event) => setForm((prev) => ({ ...prev, codes: event.target.value }))}
                        placeholder="例如 HK09988, USBABA"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="create-business-type">业务类型</Label>
                      <Input
                        id="create-business-type"
                        value={form.businessType}
                        onChange={(event) => setForm((prev) => ({ ...prev, businessType: event.target.value }))}
                        placeholder="例如 电商"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="create-aliases">别名</Label>
                      <Input
                        id="create-aliases"
                        value={form.aliasesText}
                        onChange={(event) => setForm((prev) => ({ ...prev, aliasesText: event.target.value }))}
                        placeholder="多个别名用逗号分隔"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="create-sort-order">排序值</Label>
                      <Input
                        id="create-sort-order"
                        value={form.sortOrder}
                        onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
                        placeholder="整数，可选"
                        inputMode="numeric"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="create-stock-active"
                        checked={form.isActive}
                        onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked === true }))}
                      />
                      <Label htmlFor="create-stock-active" className="font-normal">
                        启用
                      </Label>
                    </div>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <Label htmlFor="edit-symbol">股票代码</Label>
                  <Input
                    id="edit-symbol"
                    value={form.symbol}
                    onChange={(event) => setForm((prev) => ({ ...prev, symbol: event.target.value }))}
                    placeholder="例如 BABA"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-name">股票名称</Label>
                  <Input
                    id="edit-name"
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="请输入股票名称"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-display-name">展示名称</Label>
                  <Input
                    id="edit-display-name"
                    value={form.displayName}
                    onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                    placeholder="例如 阿里巴巴"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-codes">交易所代码</Label>
                  <Input
                    id="edit-codes"
                    value={form.codes}
                    onChange={(event) => setForm((prev) => ({ ...prev, codes: event.target.value }))}
                    placeholder="例如 HK09988, USBABA"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-business-type">业务类型</Label>
                  <Input
                    id="edit-business-type"
                    value={form.businessType}
                    onChange={(event) => setForm((prev) => ({ ...prev, businessType: event.target.value }))}
                    placeholder="例如 电商"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-aliases">别名</Label>
                  <Input
                    id="edit-aliases"
                    value={form.aliasesText}
                    onChange={(event) => setForm((prev) => ({ ...prev, aliasesText: event.target.value }))}
                    placeholder="多个别名用逗号分隔"
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit-sort-order">排序值</Label>
                  <Input
                    id="edit-sort-order"
                    value={form.sortOrder}
                    onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
                    placeholder="整数"
                    inputMode="numeric"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="stock-active"
                    checked={form.isActive}
                    onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked === true }))}
                  />
                  <Label htmlFor="stock-active" className="font-normal">
                    启用
                  </Label>
                </div>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeFormDialog} disabled={isBusy}>
                取消
              </Button>
              <Button type="submit" disabled={isBusy}>
                {formSaving
                  ? isCreateMode
                    ? "新增中..."
                    : "保存中..."
                  : isCreateMode
                    ? "确认新增"
                    : "保存并重建别名"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={actionDialogId !== null && actionTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isBusy) {
            setActionDialogId(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionTarget ? `${actionTarget.symbol} 操作` : "操作"}</DialogTitle>
          </DialogHeader>
          {actionTarget ? (
            <div className="space-y-3">
              <Button
                type="button"
                className="w-full"
                variant="outline"
                onClick={() => {
                  setActionDialogId(null);
                  openEditDialog(actionTarget);
                }}
                disabled={isBusy}
              >
                编辑信息
              </Button>
              <Button
                type="button"
                className="w-full"
                variant="outline"
                onClick={() => void regenerateAliases(actionTarget)}
                disabled={isBusy}
              >
                {isRowActionPending(actionTarget.id, "regenerate") ? "重建中..." : "重建别名"}
              </Button>
              <Button
                type="button"
                className="w-full"
                variant="secondary"
                onClick={() => void softDelete(actionTarget)}
                disabled={isBusy}
              >
                {isRowActionPending(actionTarget.id, "delete") ? "删除中..." : "软删除"}
              </Button>
              <DialogFooter>
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setActionDialogId(null)} disabled={isBusy}>
                  关闭
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}
