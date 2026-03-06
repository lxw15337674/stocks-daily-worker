"use client";

import { useEffect, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
  sortOrder: string;
  isActive: boolean;
};

const EMPTY_FORM: StockFormState = {
  symbol: "",
  name: "",
  displayName: "",
  codes: "",
  businessType: "",
  sortOrder: "",
  isActive: true
};

function buildPayload(form: StockFormState, isCreate: boolean): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  const push = (key: keyof StockFormState, value: string) => {
    const normalized = value.trim();
    if (normalized.length > 0) {
      payload[key] = normalized;
    }
  };

  if (isCreate) {
    payload.symbol = form.symbol.trim();
  } else if (form.symbol.trim()) {
    payload.symbol = form.symbol.trim();
  }
  push("name", form.name);
  push("displayName", form.displayName);
  push("codes", form.codes);
  push("businessType", form.businessType);
  if (form.sortOrder.trim()) {
    payload.sortOrder = Number(form.sortOrder);
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
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<StockFormState>(EMPTY_FORM);

  useEffect(() => {
    const saved = globalThis.localStorage?.getItem("stocks-admin-token");
    if (saved) {
      setToken(saved);
    }
  }, []);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    [items]
  );

  const isCreateMode = editingId === null;

  async function loadStocks(): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const query = includeInactive ? "?includeInactive=true" : "";
      const response = await fetch(`/api/stocks${query}`, {
        headers: token.trim() ? { "x-admin-token": token.trim() } : {}
      });
      if (!response.ok) {
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
    void loadStocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive]);

  async function submitForm(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setError("请先输入 ADMIN_TOKEN。");
      return;
    }
    if (!form.symbol.trim() && isCreateMode) {
      setError("新增时 symbol 必填。");
      return;
    }

    setSaving(true);
    setError("");
    try {
      globalThis.localStorage?.setItem("stocks-admin-token", trimmedToken);
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
        const message = await response.text();
        throw new Error(message || `${method} failed (${response.status})`);
      }

      setForm(EMPTY_FORM);
      setEditingId(null);
      await loadStocks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: StockItem): void {
    setEditingId(item.id);
    setForm({
      symbol: item.symbol,
      name: item.name,
      displayName: item.displayName,
      codes: item.codes,
      businessType: item.businessType,
      sortOrder: String(item.sortOrder),
      isActive: item.isActive
    });
    setError("");
  }

  function cancelEdit(): void {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  async function softDelete(item: StockItem): Promise<void> {
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setError("请先输入 ADMIN_TOKEN。");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/stocks/${item.id}`, {
        method: "DELETE",
        headers: { "x-admin-token": trimmedToken }
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `DELETE failed (${response.status})`);
      }
      await loadStocks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setSaving(false);
    }
  }

  async function regenerateAliases(item: StockItem): Promise<void> {
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      setError("请先输入 ADMIN_TOKEN。");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/stocks/${item.id}/aliases/regenerate`, {
        method: "POST",
        headers: { "x-admin-token": trimmedToken }
      });
      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || `Regenerate failed (${response.status})`);
      }
      await loadStocks();
    } catch (err) {
      setError(err instanceof Error ? err.message : "重生别名失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="page-shell">
      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>{isCreateMode ? "新增股票" : `编辑股票 #${editingId}`}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <form className="space-y-3" onSubmit={submitForm}>
              <Input
                value={token}
                onChange={(event) => setToken(event.target.value)}
                placeholder="ADMIN_TOKEN"
                autoComplete="off"
              />
              <Input
                value={form.symbol}
                onChange={(event) => setForm((prev) => ({ ...prev, symbol: event.target.value }))}
                placeholder="symbol (例如 BABA)"
                disabled={!isCreateMode}
              />
              <Input
                value={form.name}
                onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="name"
              />
              <Input
                value={form.displayName}
                onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                placeholder="displayName"
              />
              <Input
                value={form.codes}
                onChange={(event) => setForm((prev) => ({ ...prev, codes: event.target.value }))}
                placeholder="codes"
              />
              <Input
                value={form.businessType}
                onChange={(event) => setForm((prev) => ({ ...prev, businessType: event.target.value }))}
                placeholder="businessType"
              />
              <Input
                value={form.sortOrder}
                onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
                placeholder="sortOrder (整数)"
                inputMode="numeric"
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
                启用
              </label>

              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {isCreateMode ? "新增并生成 aliases" : "保存并重新生成 aliases"}
                </Button>
                {!isCreateMode ? (
                  <Button type="button" variant="outline" onClick={cancelEdit} disabled={saving}>
                    取消
                  </Button>
                ) : null}
              </div>
            </form>
            {error ? <p className="text-sm text-primary">{error}</p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>股票池管理</CardTitle>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={includeInactive}
                    onChange={(event) => setIncludeInactive(event.target.checked)}
                  />
                  显示停用
                </label>
                <Button variant="outline" size="sm" onClick={() => void loadStocks()} disabled={loading || saving}>
                  刷新
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? <p className="empty">加载中...</p> : null}
            {!loading && sortedItems.length === 0 ? <p className="empty">暂无数据。</p> : null}
            {!loading && sortedItems.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3">排序</th>
                      <th className="py-2 pr-3">Symbol</th>
                      <th className="py-2 pr-3">名称</th>
                      <th className="py-2 pr-3">展示名</th>
                      <th className="py-2 pr-3">Codes</th>
                      <th className="py-2 pr-3">业务</th>
                      <th className="py-2 pr-3">Aliases</th>
                      <th className="py-2 pr-3">状态</th>
                      <th className="py-2">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedItems.map((item) => (
                      <tr key={item.id} className="border-b align-top">
                        <td className="py-2 pr-3">{item.sortOrder}</td>
                        <td className="py-2 pr-3 font-medium">{item.symbol}</td>
                        <td className="py-2 pr-3">{item.name}</td>
                        <td className="py-2 pr-3">{item.displayName}</td>
                        <td className="py-2 pr-3">{item.codes}</td>
                        <td className="py-2 pr-3">{item.businessType}</td>
                        <td className="py-2 pr-3">
                          <div className="flex flex-wrap gap-1">
                            {item.aliases.slice(0, 6).map((alias) => (
                              <Badge key={alias} variant="outline">
                                {alias}
                              </Badge>
                            ))}
                            {item.aliases.length > 6 ? <Badge variant="secondary">+{item.aliases.length - 6}</Badge> : null}
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          {item.isActive ? <Badge>启用</Badge> : <Badge variant="secondary">停用</Badge>}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-2">
                            <Button variant="outline" size="sm" onClick={() => startEdit(item)} disabled={saving}>
                              编辑
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => void regenerateAliases(item)}
                              disabled={saving}
                            >
                              重生 aliases
                            </Button>
                            <Button variant="secondary" size="sm" onClick={() => void softDelete(item)} disabled={saving}>
                              软删除
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

