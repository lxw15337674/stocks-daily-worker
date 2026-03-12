"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Field, FieldContent, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { MarketAdminPanel } from "@/components/stocks/market-admin-panel";
import { resolveLanguage, type Language } from "@/lib/i18n";

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

type AdminPageProps = {
  lang?: Language;
};

type AdminPageCopy = {
  authTitle: string;
  authSessionChecking: string;
  adminTokenLabel: string;
  adminTokenPlaceholder: string;
  authSubmitting: string;
  authSubmit: string;
  authFailedTitle: string;
  sessionActiveHint: string;
  createStock: string;
  logout: string;
  actionFailedTitle: string;
  actionSucceededTitle: string;
  stockPoolTitle: string;
  includeInactive: string;
  refresh: string;
  loading: string;
  emptyData: string;
  tableSortOrder: string;
  tableSymbol: string;
  tableName: string;
  tableDisplayName: string;
  tableExchangeCodes: string;
  tableBusinessType: string;
  tableAliases: string;
  tableStatus: string;
  tableActions: string;
  active: string;
  inactive: string;
  processing: string;
  createDialogTitle: string;
  editDialogTitle: (editingId: number | null) => string;
  createDialogDescription: string;
  stockNameLabel: string;
  stockNamePlaceholder: string;
  previewGenerating: string;
  previewGenerate: string;
  previewHintTitle: string;
  previewCandidatesLabel: string;
  previewCandidateLabel: (index: number) => string;
  previewWarningsTitle: string;
  previewRationaleTitle: string;
  symbolLabel: string;
  symbolEditablePlaceholder: string;
  symbolPlaceholder: string;
  displayNameLabel: string;
  displayNamePlaceholder: string;
  exchangeCodesLabel: string;
  exchangeCodesPlaceholder: string;
  businessTypeLabel: string;
  businessTypePlaceholder: string;
  aliasesLabel: string;
  aliasesPlaceholder: string;
  sortOrderLabel: string;
  sortOrderOptionalPlaceholder: string;
  sortOrderPlaceholder: string;
  cancel: string;
  creating: string;
  saving: string;
  confirmCreate: string;
  saveAndRegenerateAliases: string;
  actionDialogTitle: (symbol: string | null) => string;
  actionDialogFallbackTitle: string;
  editInfo: string;
  regenerating: string;
  regenerateAliases: string;
  deleting: string;
  softDelete: string;
  close: string;
  sessionLoginFailed: (status: number) => string;
  sessionCheckFailed: (status: number) => string;
  sessionExpired: string;
  loadFailed: string;
  sessionCheckFailedGeneric: string;
  missingAdminToken: string;
  authFailedGeneric: string;
  previewNameRequired: string;
  previewFailed: (status: number) => string;
  previewEmpty: string;
  previewFailedGeneric: string;
  createNameRequired: string;
  createPreviewRequired: string;
  saveFailed: string;
  createSuccess: (item: StockItem) => string;
  updateSuccess: (item: StockItem) => string;
  deleteFailed: string;
  deleteSuccess: (item: StockItem) => string;
  regenerateFailed: string;
  regenerateSuccess: (item: StockItem) => string;
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

function resolvePageLanguage(inputLang: Language | undefined, pathname: string | null): Language {
  if (inputLang) {
    return resolveLanguage(inputLang);
  }

  const segment = pathname?.split("/").filter(Boolean)[0] ?? null;
  return resolveLanguage(segment);
}

function getCopy(t: TFunction<"stocks">): AdminPageCopy {
  return {
    authTitle: t("admin.authTitle"),
    authSessionChecking: t("admin.authSessionChecking"),
    adminTokenLabel: t("admin.adminTokenLabel"),
    adminTokenPlaceholder: t("admin.adminTokenPlaceholder"),
    authSubmitting: t("admin.authSubmitting"),
    authSubmit: t("admin.authSubmit"),
    authFailedTitle: t("admin.authFailedTitle"),
    sessionActiveHint: t("admin.sessionActiveHint"),
    createStock: t("admin.createStock"),
    logout: t("admin.logout"),
    actionFailedTitle: t("admin.actionFailedTitle"),
    actionSucceededTitle: t("admin.actionSucceededTitle"),
    stockPoolTitle: t("admin.stockPoolTitle"),
    includeInactive: t("admin.includeInactive"),
    refresh: t("admin.refresh"),
    loading: t("admin.loading"),
    emptyData: t("admin.emptyData"),
    tableSortOrder: t("admin.tableSortOrder"),
    tableSymbol: t("admin.tableSymbol"),
    tableName: t("admin.tableName"),
    tableDisplayName: t("admin.tableDisplayName"),
    tableExchangeCodes: t("admin.tableExchangeCodes"),
    tableBusinessType: t("admin.tableBusinessType"),
    tableAliases: t("admin.tableAliases"),
    tableStatus: t("admin.tableStatus"),
    tableActions: t("admin.tableActions"),
    active: t("admin.active"),
    inactive: t("admin.inactive"),
    processing: t("admin.processing"),
    createDialogTitle: t("admin.createDialogTitle"),
    editDialogTitle: (editingId) => t("admin.editDialogTitle", { id: editingId ?? "" }),
    createDialogDescription: t("admin.createDialogDescription"),
    stockNameLabel: t("admin.stockNameLabel"),
    stockNamePlaceholder: t("admin.stockNamePlaceholder"),
    previewGenerating: t("admin.previewGenerating"),
    previewGenerate: t("admin.previewGenerate"),
    previewHintTitle: t("admin.previewHintTitle"),
    previewCandidatesLabel: t("admin.previewCandidatesLabel"),
    previewCandidateLabel: (index) => t("admin.previewCandidateLabel", { index: index + 1 }),
    previewWarningsTitle: t("admin.previewWarningsTitle"),
    previewRationaleTitle: t("admin.previewRationaleTitle"),
    symbolLabel: t("admin.symbolLabel"),
    symbolEditablePlaceholder: t("admin.symbolEditablePlaceholder"),
    symbolPlaceholder: t("admin.symbolPlaceholder"),
    displayNameLabel: t("admin.displayNameLabel"),
    displayNamePlaceholder: t("admin.displayNamePlaceholder"),
    exchangeCodesLabel: t("admin.exchangeCodesLabel"),
    exchangeCodesPlaceholder: t("admin.exchangeCodesPlaceholder"),
    businessTypeLabel: t("admin.businessTypeLabel"),
    businessTypePlaceholder: t("admin.businessTypePlaceholder"),
    aliasesLabel: t("admin.aliasesLabel"),
    aliasesPlaceholder: t("admin.aliasesPlaceholder"),
    sortOrderLabel: t("admin.sortOrderLabel"),
    sortOrderOptionalPlaceholder: t("admin.sortOrderOptionalPlaceholder"),
    sortOrderPlaceholder: t("admin.sortOrderPlaceholder"),
    cancel: t("admin.cancel"),
    creating: t("admin.creating"),
    saving: t("admin.saving"),
    confirmCreate: t("admin.confirmCreate"),
    saveAndRegenerateAliases: t("admin.saveAndRegenerateAliases"),
    actionDialogTitle: (symbol) => t("admin.actionDialogTitle", { symbol: symbol ?? "" }),
    actionDialogFallbackTitle: t("admin.actionDialogFallbackTitle"),
    editInfo: t("admin.editInfo"),
    regenerating: t("admin.regenerating"),
    regenerateAliases: t("admin.regenerateAliases"),
    deleting: t("admin.deleting"),
    softDelete: t("admin.softDelete"),
    close: t("admin.close"),
    sessionLoginFailed: (status) => t("admin.sessionLoginFailed", { status }),
    sessionCheckFailed: (status) => t("admin.sessionCheckFailed", { status }),
    sessionExpired: t("admin.sessionExpired"),
    loadFailed: t("admin.loadFailed"),
    sessionCheckFailedGeneric: t("admin.sessionCheckFailedGeneric"),
    missingAdminToken: t("admin.missingAdminToken"),
    authFailedGeneric: t("admin.authFailedGeneric"),
    previewNameRequired: t("admin.previewNameRequired"),
    previewFailed: (status) => t("admin.previewFailed", { status }),
    previewEmpty: t("admin.previewEmpty"),
    previewFailedGeneric: t("admin.previewFailedGeneric"),
    createNameRequired: t("admin.createNameRequired"),
    createPreviewRequired: t("admin.createPreviewRequired"),
    saveFailed: t("admin.saveFailed"),
    createSuccess: (item) => t("admin.createSuccess", { name: item.name, symbol: item.symbol }),
    updateSuccess: (item) => t("admin.updateSuccess", { name: item.name, symbol: item.symbol }),
    deleteFailed: t("admin.deleteFailed"),
    deleteSuccess: (item) => t("admin.deleteSuccess", { symbol: item.symbol }),
    regenerateFailed: t("admin.regenerateFailed"),
    regenerateSuccess: (item) => t("admin.regenerateSuccess", { symbol: item.symbol })
  };
}

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

export default function StocksPage(props: AdminPageProps) {
  const pathname = usePathname();
  const lang = resolvePageLanguage(props.lang, pathname);
  const { t, i18n } = useTranslation("stocks");
  const copy = useMemo(() => getCopy(t), [t]);
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

  useEffect(() => {
    if (i18n.resolvedLanguage !== lang) {
      void i18n.changeLanguage(lang);
    }
  }, [i18n, lang]);

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
  }

  async function createAdminSession(candidateToken: string): Promise<void> {
    const response = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: candidateToken })
    });
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || copy.sessionLoginFailed(response.status));
    }
  }

  async function checkAdminSession(): Promise<boolean> {
    const response = await fetch("/api/admin/session", {
      cache: "no-store"
    });
    if (response.status === 401) {
      return false;
    }
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || copy.sessionCheckFailed(response.status));
    }
    return true;
  }

  async function destroyAdminSession(): Promise<void> {
    await fetch("/api/admin/session", {
      method: "DELETE"
    });
  }

  async function loadStocks(nextIncludeInactive?: boolean): Promise<void> {
    setLoading(true);
    setError("");
    try {
      const useIncludeInactive = nextIncludeInactive ?? includeInactive;
      const query = useIncludeInactive ? "?includeInactive=true" : "";
      const response = await fetch(`/api/stocks${query}`);
      if (!response.ok) {
        if (response.status === 401) {
          revokeAuthorization(copy.sessionExpired);
          return;
        }
        const message = await response.text();
        throw new Error(message || copy.loadFailed);
      }
      const data = (await response.json()) as { items: StockItem[] };
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.loadFailed);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    setAuthChecking(true);
    setAuthError("");

    void (async () => {
      try {
        const authenticated = await checkAdminSession();
        if (!authenticated) {
          if (!cancelled) {
            setIsAuthorized(false);
            setItems([]);
          }
          return;
        }
        if (cancelled) {
          return;
        }
        setIsAuthorized(true);
        setSuccessMessage("");
        await loadStocks(includeInactive);
      } catch (err) {
        if (cancelled) {
          return;
        }
        revokeAuthorization(err instanceof Error ? err.message : copy.sessionCheckFailedGeneric);
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
      setAuthError(copy.missingAdminToken);
      return;
    }

    setAuthChecking(true);
    setAuthError("");
    try {
      await createAdminSession(trimmedToken);
      setToken("");
      setIsAuthorized(true);
      setSuccessMessage("");
      await loadStocks(includeInactive);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : copy.authFailedGeneric);
    } finally {
      setAuthChecking(false);
    }
  }

  async function logout(): Promise<void> {
    try {
      await destroyAdminSession();
    } finally {
      revokeAuthorization();
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
    const normalizedName = form.name.trim();
    if (!normalizedName) {
      setError(copy.previewNameRequired);
      return;
    }

    setPreviewLoading(true);
    setError("");
    setSuccessMessage("");
    try {
      const response = await fetch("/api/stocks/preview", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ name: normalizedName })
      });

      if (!response.ok) {
        if (response.status === 401) {
          revokeAuthorization(copy.sessionExpired);
          return;
        }
        const message = await response.text();
        throw new Error(message || copy.previewFailed(response.status));
      }

      const payload = (await response.json()) as {
        candidates?: StockPreviewCandidate[];
        globalWarnings?: string[];
      };

      const candidates = payload.candidates ?? [];
      if (candidates.length === 0) {
        throw new Error(copy.previewEmpty);
      }

      setPreviewCandidates(candidates);
      setPreviewGlobalWarnings(payload.globalWarnings ?? []);
      setSelectedPreviewIndex(0);
      applyCandidateToForm(candidates[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.previewFailedGeneric);
      resetCreatePreviewState();
    } finally {
      setPreviewLoading(false);
    }
  }

  async function submitForm(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (isCreateMode && !form.name.trim()) {
      setError(copy.createNameRequired);
      return;
    }
    if (isCreateMode && previewCandidates.length === 0) {
      setError(copy.createPreviewRequired);
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
          "content-type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        if (response.status === 401) {
          revokeAuthorization(copy.sessionExpired);
          return;
        }
        const message = await response.text();
        throw new Error(message || `${copy.saveFailed} (${response.status})`);
      }

      const updatedItem = (await response.json()) as StockItem;
      setFormDialogOpen(false);
      resetFormState();
      await loadStocks(includeInactive);
      setSuccessMessage(isCreateMode ? copy.createSuccess(updatedItem) : copy.updateSuccess(updatedItem));
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.saveFailed);
    } finally {
      setFormSaving(false);
    }
  }

  async function softDelete(item: StockItem): Promise<void> {

    setRowAction({ id: item.id, type: "delete" });
    setError("");
    setSuccessMessage("");
    try {
      const response = await fetch(`/api/stocks/${item.id}`, {
        method: "DELETE"
      });
      if (!response.ok) {
        if (response.status === 401) {
          revokeAuthorization(copy.sessionExpired);
          return;
        }
        const message = await response.text();
        throw new Error(message || `${copy.deleteFailed} (${response.status})`);
      }
      setActionDialogId(null);
      await loadStocks(includeInactive);
      setSuccessMessage(copy.deleteSuccess(item));
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.deleteFailed);
    } finally {
      setRowAction(null);
    }
  }

  async function regenerateAliases(item: StockItem): Promise<void> {

    setRowAction({ id: item.id, type: "regenerate" });
    setError("");
    setSuccessMessage("");
    try {
      const response = await fetch(`/api/stocks/${item.id}/aliases/regenerate`, {
        method: "POST"
      });
      if (!response.ok) {
        if (response.status === 401) {
          revokeAuthorization(copy.sessionExpired);
          return;
        }
        const message = await response.text();
        throw new Error(message || `${copy.regenerateFailed} (${response.status})`);
      }
      setActionDialogId(null);
      await loadStocks(includeInactive);
      setSuccessMessage(copy.regenerateSuccess(item));
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.regenerateFailed);
    } finally {
      setRowAction(null);
    }
  }

  if (!isAuthorized) {
    return (
      <main className="page-shell">
        <Card className="mx-auto max-w-lg">
          <CardHeader className="pb-3">
            <CardTitle>{copy.authTitle}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {authChecking ? (
              <Alert>
                <AlertDescription>{copy.authSessionChecking}</AlertDescription>
              </Alert>
            ) : null}
            <form className="flex flex-col gap-3" onSubmit={submitAuth}>
              <FieldGroup className="gap-0">
                <Field className="gap-1">
                  <FieldContent>
                    <FieldLabel htmlFor="admin-token">{copy.adminTokenLabel}</FieldLabel>
                    <Input
                      id="admin-token"
                      value={token}
                      onChange={(event) => setToken(event.target.value)}
                      placeholder={copy.adminTokenPlaceholder}
                      autoComplete="off"
                    />
                  </FieldContent>
                </Field>
              </FieldGroup>
              <Button type="submit" className="w-full" disabled={authChecking}>
                {authChecking ? copy.authSubmitting : copy.authSubmit}
              </Button>
            </form>
            {authError ? (
              <Alert variant="destructive">
                <AlertTitle>{copy.authFailedTitle}</AlertTitle>
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
        <p className="meta">{copy.sessionActiveHint}</p>
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={openCreateDialog} disabled={isBusy}>
            {copy.createStock}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void logout()}>
            {copy.logout}
          </Button>
        </div>
      </div>

      {error ? (
        <Alert variant="destructive" className="mb-3">
          <AlertTitle>{copy.actionFailedTitle}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {successMessage ? (
        <Alert variant="success" className="mb-3">
          <AlertTitle>{copy.actionSucceededTitle}</AlertTitle>
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-4">
        <MarketAdminPanel lang={lang} onUnauthorized={() => revokeAuthorization(copy.sessionExpired)} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>{copy.stockPoolTitle}</CardTitle>
                <div className="flex items-center gap-2">
                  <Field orientation="horizontal" className="w-auto items-center gap-2">
                    <Checkbox
                      id="include-inactive"
                      checked={includeInactive}
                      onCheckedChange={(checked) => {
                        const next = checked === true;
                        setIncludeInactive(next);
                        void loadStocks(next);
                      }}
                    />
                    <FieldLabel htmlFor="include-inactive" className="font-normal">
                      {copy.includeInactive}
                    </FieldLabel>
                  </Field>
                  <Button variant="outline" size="sm" onClick={() => void loadStocks()} disabled={loading || isBusy}>
                    {copy.refresh}
                  </Button>
                </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <Alert>
              <AlertDescription>{copy.loading}</AlertDescription>
            </Alert>
          ) : null}
          {!loading && sortedItems.length === 0 ? (
            <Alert>
              <AlertDescription>{copy.emptyData}</AlertDescription>
            </Alert>
          ) : null}
          {!loading && sortedItems.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="min-w-[840px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>{copy.tableSortOrder}</TableHead>
                    <TableHead>{copy.tableSymbol}</TableHead>
                    <TableHead>{copy.tableName}</TableHead>
                    <TableHead>{copy.tableDisplayName}</TableHead>
                    <TableHead>{copy.tableExchangeCodes}</TableHead>
                    <TableHead>{copy.tableBusinessType}</TableHead>
                    <TableHead>{copy.tableAliases}</TableHead>
                    <TableHead>{copy.tableStatus}</TableHead>
                    <TableHead>{copy.tableActions}</TableHead>
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
                      <TableCell>{item.isActive ? <Badge>{copy.active}</Badge> : <Badge variant="secondary">{copy.inactive}</Badge>}</TableCell>
                      <TableCell>
                        <Button variant="outline" size="sm" onClick={() => setActionDialogId(item.id)} disabled={isBusy}>
                          {rowAction?.id === item.id ? copy.processing : copy.tableActions}
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
            <DialogTitle>{isCreateMode ? copy.createDialogTitle : copy.editDialogTitle(editingId)}</DialogTitle>
            {isCreateMode ? <DialogDescription>{copy.createDialogDescription}</DialogDescription> : null}
          </DialogHeader>
          <form className="flex flex-col gap-3" onSubmit={submitForm}>
            {isCreateMode ? (
              <>
                <FieldGroup className="gap-2">
                  <Field className="gap-2">
                    <FieldContent>
                      <FieldLabel htmlFor="preview-name">{copy.stockNameLabel}</FieldLabel>
                      <Input
                        id="preview-name"
                        value={form.name}
                        onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                        placeholder={copy.stockNamePlaceholder}
                      />
                    </FieldContent>
                  </Field>
                  <Button type="button" variant="secondary" onClick={() => void generatePreviewCandidates()} disabled={isBusy}>
                    {previewLoading ? copy.previewGenerating : copy.previewGenerate}
                  </Button>
                </FieldGroup>

                {previewGlobalWarnings.length > 0 ? (
                  <Alert>
                    <AlertTitle>{copy.previewHintTitle}</AlertTitle>
                    <AlertDescription>{previewGlobalWarnings.join("；")}</AlertDescription>
                  </Alert>
                ) : null}

                {previewCandidates.length > 0 ? (
                  <div className="flex flex-col gap-3">
                    <FieldSet className="gap-2">
                      <FieldLegend variant="label">{copy.previewCandidatesLabel}</FieldLegend>
                      <ToggleGroup
                        type="single"
                        value={selectedPreviewIndex >= 0 ? String(selectedPreviewIndex) : ""}
                        onValueChange={(value) => {
                          if (!value) {
                            return;
                          }

                          const nextIndex = Number(value);
                          if (Number.isInteger(nextIndex)) {
                            choosePreviewCandidate(nextIndex);
                          }
                        }}
                        variant="outline"
                        className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2"
                      >
                        {previewCandidates.map((candidate, index) => (
                          <ToggleGroupItem
                            key={`${candidate.symbol}-${index}`}
                            value={String(index)}
                            aria-label={`${copy.previewCandidateLabel(index)} ${candidate.symbol}`}
                            className="h-auto min-h-[86px] w-full flex-col items-start justify-start gap-1 whitespace-normal px-3 py-2 text-left"
                            disabled={isBusy}
                          >
                            <span className="block text-xs text-muted-foreground">{copy.previewCandidateLabel(index)}</span>
                            <span className="block break-all font-medium leading-tight">{candidate.symbol}</span>
                            <span className="block break-words text-xs leading-tight">{candidate.displayName}</span>
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    </FieldSet>

                    {selectedPreviewCandidate?.warnings && selectedPreviewCandidate.warnings.length > 0 ? (
                      <Alert>
                        <AlertTitle>{copy.previewWarningsTitle}</AlertTitle>
                        <AlertDescription>{selectedPreviewCandidate.warnings.join("；")}</AlertDescription>
                      </Alert>
                    ) : null}

                    {selectedPreviewCandidate?.rationale ? (
                      <Alert>
                        <AlertTitle>{copy.previewRationaleTitle}</AlertTitle>
                        <AlertDescription>{selectedPreviewCandidate.rationale}</AlertDescription>
                      </Alert>
                    ) : null}

                    <Separator />

                    <FieldGroup className="gap-3">
                      <Field className="gap-1">
                        <FieldContent>
                          <FieldLabel htmlFor="create-symbol">{copy.symbolLabel}</FieldLabel>
                          <Input
                            id="create-symbol"
                            value={form.symbol}
                            onChange={(event) => setForm((prev) => ({ ...prev, symbol: event.target.value }))}
                            placeholder={copy.symbolEditablePlaceholder}
                          />
                        </FieldContent>
                      </Field>
                      <Field className="gap-1">
                        <FieldContent>
                          <FieldLabel htmlFor="create-display-name">{copy.displayNameLabel}</FieldLabel>
                          <Input
                            id="create-display-name"
                            value={form.displayName}
                            onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                            placeholder={copy.displayNamePlaceholder}
                          />
                        </FieldContent>
                      </Field>
                      <Field className="gap-1">
                        <FieldContent>
                          <FieldLabel htmlFor="create-codes">{copy.exchangeCodesLabel}</FieldLabel>
                          <Input
                            id="create-codes"
                            value={form.codes}
                            onChange={(event) => setForm((prev) => ({ ...prev, codes: event.target.value }))}
                            placeholder={copy.exchangeCodesPlaceholder}
                          />
                        </FieldContent>
                      </Field>
                      <Field className="gap-1">
                        <FieldContent>
                          <FieldLabel htmlFor="create-business-type">{copy.businessTypeLabel}</FieldLabel>
                          <Input
                            id="create-business-type"
                            value={form.businessType}
                            onChange={(event) => setForm((prev) => ({ ...prev, businessType: event.target.value }))}
                            placeholder={copy.businessTypePlaceholder}
                          />
                        </FieldContent>
                      </Field>
                      <Field className="gap-1">
                        <FieldContent>
                          <FieldLabel htmlFor="create-aliases">{copy.aliasesLabel}</FieldLabel>
                          <Input
                            id="create-aliases"
                            value={form.aliasesText}
                            onChange={(event) => setForm((prev) => ({ ...prev, aliasesText: event.target.value }))}
                            placeholder={copy.aliasesPlaceholder}
                          />
                        </FieldContent>
                      </Field>
                      <Field className="gap-1">
                        <FieldContent>
                          <FieldLabel htmlFor="create-sort-order">{copy.sortOrderLabel}</FieldLabel>
                          <Input
                            id="create-sort-order"
                            value={form.sortOrder}
                            onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
                            placeholder={copy.sortOrderOptionalPlaceholder}
                            inputMode="numeric"
                          />
                        </FieldContent>
                      </Field>
                    </FieldGroup>
                    <Field orientation="horizontal" className="w-auto items-center gap-2">
                      <Checkbox
                        id="create-stock-active"
                        checked={form.isActive}
                        onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked === true }))}
                      />
                      <FieldLabel htmlFor="create-stock-active" className="font-normal">
                        {copy.active}
                      </FieldLabel>
                    </Field>
                  </div>
                ) : null}
              </>
            ) : (
              <>
                <FieldGroup className="gap-3">
                  <Field className="gap-1">
                    <FieldContent>
                      <FieldLabel htmlFor="edit-symbol">{copy.symbolLabel}</FieldLabel>
                      <Input
                        id="edit-symbol"
                        value={form.symbol}
                        onChange={(event) => setForm((prev) => ({ ...prev, symbol: event.target.value }))}
                        placeholder={copy.symbolPlaceholder}
                      />
                    </FieldContent>
                  </Field>
                  <Field className="gap-1">
                    <FieldContent>
                      <FieldLabel htmlFor="edit-name">{copy.stockNameLabel}</FieldLabel>
                      <Input
                        id="edit-name"
                        value={form.name}
                        onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                        placeholder={copy.stockNamePlaceholder}
                      />
                    </FieldContent>
                  </Field>
                  <Field className="gap-1">
                    <FieldContent>
                      <FieldLabel htmlFor="edit-display-name">{copy.displayNameLabel}</FieldLabel>
                      <Input
                        id="edit-display-name"
                        value={form.displayName}
                        onChange={(event) => setForm((prev) => ({ ...prev, displayName: event.target.value }))}
                        placeholder={copy.displayNamePlaceholder}
                      />
                    </FieldContent>
                  </Field>
                  <Field className="gap-1">
                    <FieldContent>
                      <FieldLabel htmlFor="edit-codes">{copy.exchangeCodesLabel}</FieldLabel>
                      <Input
                        id="edit-codes"
                        value={form.codes}
                        onChange={(event) => setForm((prev) => ({ ...prev, codes: event.target.value }))}
                        placeholder={copy.exchangeCodesPlaceholder}
                      />
                    </FieldContent>
                  </Field>
                  <Field className="gap-1">
                    <FieldContent>
                      <FieldLabel htmlFor="edit-business-type">{copy.businessTypeLabel}</FieldLabel>
                      <Input
                        id="edit-business-type"
                        value={form.businessType}
                        onChange={(event) => setForm((prev) => ({ ...prev, businessType: event.target.value }))}
                        placeholder={copy.businessTypePlaceholder}
                      />
                    </FieldContent>
                  </Field>
                  <Field className="gap-1">
                    <FieldContent>
                      <FieldLabel htmlFor="edit-aliases">{copy.aliasesLabel}</FieldLabel>
                      <Input
                        id="edit-aliases"
                        value={form.aliasesText}
                        onChange={(event) => setForm((prev) => ({ ...prev, aliasesText: event.target.value }))}
                        placeholder={copy.aliasesPlaceholder}
                      />
                    </FieldContent>
                  </Field>
                  <Field className="gap-1">
                    <FieldContent>
                      <FieldLabel htmlFor="edit-sort-order">{copy.sortOrderLabel}</FieldLabel>
                      <Input
                        id="edit-sort-order"
                        value={form.sortOrder}
                        onChange={(event) => setForm((prev) => ({ ...prev, sortOrder: event.target.value }))}
                        placeholder={copy.sortOrderPlaceholder}
                        inputMode="numeric"
                      />
                    </FieldContent>
                  </Field>
                </FieldGroup>
                <Field orientation="horizontal" className="w-auto items-center gap-2">
                  <Checkbox
                    id="stock-active"
                    checked={form.isActive}
                    onCheckedChange={(checked) => setForm((prev) => ({ ...prev, isActive: checked === true }))}
                  />
                  <FieldLabel htmlFor="stock-active" className="font-normal">
                    {copy.active}
                  </FieldLabel>
                </Field>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeFormDialog} disabled={isBusy}>
                {copy.cancel}
              </Button>
              <Button type="submit" disabled={isBusy}>
                {formSaving
                  ? isCreateMode
                    ? copy.creating
                    : copy.saving
                  : isCreateMode
                    ? copy.confirmCreate
                    : copy.saveAndRegenerateAliases}
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
            <DialogTitle>{actionTarget ? copy.actionDialogTitle(actionTarget.symbol) : copy.actionDialogFallbackTitle}</DialogTitle>
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
                {copy.editInfo}
              </Button>
              <Button
                type="button"
                className="w-full"
                variant="outline"
                onClick={() => void regenerateAliases(actionTarget)}
                disabled={isBusy}
              >
                {isRowActionPending(actionTarget.id, "regenerate") ? copy.regenerating : copy.regenerateAliases}
              </Button>
              <Button
                type="button"
                className="w-full"
                variant="secondary"
                onClick={() => void softDelete(actionTarget)}
                disabled={isBusy}
              >
                {isRowActionPending(actionTarget.id, "delete") ? copy.deleting : copy.softDelete}
              </Button>
              <DialogFooter>
                <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => setActionDialogId(null)} disabled={isBusy}>
                  {copy.close}
                </Button>
              </DialogFooter>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </main>
  );
}

