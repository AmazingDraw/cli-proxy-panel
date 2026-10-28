/**
 * Cursor 额度数据层。React-free / SCSS-free。
 *
 * 主路径对齐 cursor-telegram-bridge：并行打 DashboardService 的
 * GetCurrentPeriodUsage / GetPlanInfo / GetHardLimit / GetSandUsageStatus。
 */

import type { TFunction } from 'i18next';
import type { AuthFileItem, CursorQuotaData, CursorQuotaState, CursorQuotaWindow } from '@/types';
import { apiCallApi, getApiCallErrorMessage } from '@/services/api';
import {
  CURSOR_AUTH_USAGE_URL,
  CURSOR_HARD_LIMIT_URL,
  CURSOR_PERIOD_USAGE_URL,
  CURSOR_PLAN_INFO_URL,
  CURSOR_REQUEST_HEADERS,
  CURSOR_SAND_USAGE_URL,
  CURSOR_USAGE_SUMMARY_URL,
  createStatusError,
  formatQuotaResetTime,
  getStatusFromError,
  isDisabledAuthFile,
  isCursorFile,
} from '@/utils/quota';
import { normalizeAuthIndex } from '@/utils/authIndex';
import type { QuotaProviderData } from '../types';

const asRecord = (value: unknown): Record<string, unknown> | null => {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
};

const normalizePercent = (value: unknown): number | undefined => {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(100, Math.round(n)));
};

const normalizeCents = (value: unknown): number | undefined => {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.round(n));
};

const normalizeResetAt = (value: unknown): number | undefined => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const seconds = (value as { seconds?: unknown }).seconds;
    if (seconds !== undefined && seconds !== null) {
      const secs = Number(seconds);
      const nanos = Number((value as { nanos?: unknown }).nanos ?? 0);
      if (Number.isFinite(secs)) {
        return secs * 1000 + (Number.isFinite(nanos) ? Math.floor(nanos / 1_000_000) : 0);
      }
    }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 10_000_000_000 ? value : value * 1000;
  }
  if (typeof value === 'string' && value.trim()) {
    const trimmed = value.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const numeric = Number(trimmed);
      if (Number.isFinite(numeric)) return numeric > 10_000_000_000 ? numeric : numeric * 1000;
    }
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

const tryParseJson = (data: unknown): unknown => {
  if (typeof data !== 'string') return data;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
};

const pushWindow = (
  windows: CursorQuotaWindow[],
  window: CursorQuotaWindow
): void => {
  windows.push(window);
};

const resetFields = (resetAt: number | undefined): Pick<CursorQuotaWindow, 'resetLabel' | 'resetAtMs'> => ({
  resetLabel: formatQuotaResetTime(resetAt !== undefined ? new Date(resetAt).toISOString() : undefined),
  resetAtMs: resetAt ?? null,
});

export const parseCursorPlanInfo = (payload: Record<string, unknown> | null): {
  planName?: string;
  planPrice?: string;
} => {
  if (!payload) return {};
  const planInfo = asRecord(payload.planInfo) ?? payload;
  const planName = String(planInfo.planName ?? planInfo.plan_name ?? '').trim();
  const planPrice = String(planInfo.price ?? '').trim();
  return {
    ...(planName ? { planName } : {}),
    ...(planPrice ? { planPrice } : {}),
  };
};

export const parseCursorHardLimit = (payload: Record<string, unknown> | null): boolean | undefined => {
  if (
    !payload ||
    (!('noUsageBasedAllowed' in payload) && !('no_usage_based_allowed' in payload))
  ) {
    return undefined;
  }
  const blocked = Boolean(payload.noUsageBasedAllowed ?? payload.no_usage_based_allowed);
  return !blocked;
};

export const parseCursorSandUsage = (
  payload: Record<string, unknown> | null,
  t: TFunction
): CursorQuotaWindow | null => {
  if (!payload) return null;
  const usedPercent = normalizePercent(payload.usagePercent ?? payload.usage_percent);
  if (usedPercent === undefined) return null;
  const resetAt = normalizeResetAt(payload.nextResetTimestampUtc ?? payload.next_reset_timestamp_utc);
  const apiLabel = String(payload.grokPlanLabel ?? payload.grok_plan_label ?? '').trim();
  return {
    id: 'grok-bot',
    label: apiLabel || t('cursor_quota.grok_bot'),
    labelKey: apiLabel ? undefined : 'cursor_quota.grok_bot',
    usedPercent,
    ...resetFields(resetAt),
    periodHours: 168,
  };
};

export const parseCursorQuotaPayload = (
  payload: Record<string, unknown> | null,
  t: TFunction
): CursorQuotaData | null => {
  if (!payload) return null;

  const planUsage = (payload.planUsage as Record<string, unknown>) ?? payload;
  const resetAt = normalizeResetAt(
    payload.billingCycleEnd ??
      planUsage.billingCycleEnd ??
      payload.periodEnd ??
      payload.startOfMonth ??
      payload.billingCycleStart
  );

  const totalPercent = normalizePercent(
    planUsage.totalPercentUsed ??
      planUsage.percentUsed ??
      payload.totalPercentUsed ??
      payload.percentUsed
  );
  const autoPercent = normalizePercent(planUsage.autoPercentUsed ?? payload.autoPercentUsed);
  const apiPercent = normalizePercent(planUsage.apiPercentUsed ?? payload.apiPercentUsed);

  const windows: CursorQuotaWindow[] = [];

  if (totalPercent !== undefined) {
    pushWindow(windows, {
      id: 'total-limit',
      label: t('cursor_quota.total_limit'),
      labelKey: 'cursor_quota.total_limit',
      usedPercent: totalPercent,
      ...resetFields(resetAt),
      periodHours: 720,
    });
  }

  if (autoPercent !== undefined) {
    pushWindow(windows, {
      id: 'first-party-models',
      label: t('cursor_quota.first_party_models'),
      labelKey: 'cursor_quota.first_party_models',
      usedPercent: autoPercent,
      ...resetFields(resetAt),
      periodHours: 720,
    });
  }

  if (apiPercent !== undefined) {
    pushWindow(windows, {
      id: 'api-usage',
      label: t('cursor_quota.api_usage'),
      labelKey: 'cursor_quota.api_usage',
      usedPercent: apiPercent,
      ...resetFields(resetAt),
      periodHours: 720,
    });
  }

  if (windows.length === 0) return null;

  return {
    windows,
    includedSpendCents: normalizeCents(planUsage.includedSpend ?? payload.includedSpend) ?? null,
    limitCents: normalizeCents(planUsage.limit ?? payload.limit) ?? null,
    bonusSpendCents: normalizeCents(planUsage.bonusSpend ?? payload.bonusSpend) ?? null,
  };
};

const postCursorDashboard = async (authIndex: string, url: string) => {
  return apiCallApi.request({
    authIndex,
    method: 'POST',
    url,
    header: { ...CURSOR_REQUEST_HEADERS },
    data: '{}',
  });
};

const parseDashboardBody = (body: unknown): Record<string, unknown> | null =>
  asRecord(tryParseJson(body));

const enrichFromDashboard = async (
  authIndex: string,
  base: CursorQuotaData,
  t: TFunction
): Promise<CursorQuotaData> => {
  const extras = await Promise.allSettled([
    postCursorDashboard(authIndex, CURSOR_PLAN_INFO_URL),
    postCursorDashboard(authIndex, CURSOR_SAND_USAGE_URL),
    postCursorDashboard(authIndex, CURSOR_HARD_LIMIT_URL),
  ]);

  const next: CursorQuotaData = { ...base, windows: [...base.windows] };

  const planResult = extras[0];
  if (planResult.status === 'fulfilled' && planResult.value.statusCode >= 200 && planResult.value.statusCode < 300) {
    const parsed = parseCursorPlanInfo(parseDashboardBody(planResult.value.body ?? planResult.value.bodyText));
    if (parsed.planName) next.planName = parsed.planName;
    if (parsed.planPrice) next.planPrice = parsed.planPrice;
  }

  const sandResult = extras[1];
  if (sandResult.status === 'fulfilled' && sandResult.value.statusCode >= 200 && sandResult.value.statusCode < 300) {
    const grok = parseCursorSandUsage(
      parseDashboardBody(sandResult.value.body ?? sandResult.value.bodyText),
      t
    );
    if (grok && !next.windows.some((window) => window.id === 'grok-bot')) {
      next.windows.push(grok);
    }
  }

  const hardResult = extras[2];
  if (hardResult.status === 'fulfilled' && hardResult.value.statusCode >= 200 && hardResult.value.statusCode < 300) {
    const allowed = parseCursorHardLimit(
      parseDashboardBody(hardResult.value.body ?? hardResult.value.bodyText)
    );
    if (allowed !== undefined) next.onDemandAllowed = allowed;
  }

  return next;
};

const fetchCursorQuota = async (file: AuthFileItem, t: TFunction): Promise<CursorQuotaData> => {
  const rawAuthIndex = file['auth_index'] ?? file.authIndex;
  const authIndex = normalizeAuthIndex(rawAuthIndex);
  if (!authIndex) {
    throw new Error(t('cursor_quota.missing_auth_index'));
  }

  let lastError = '';
  let lastStatus: number | undefined;

  // 1. Primary: POST GetCurrentPeriodUsage (Connect RPC on api2.cursor.sh)
  try {
    const result = await postCursorDashboard(authIndex, CURSOR_PERIOD_USAGE_URL);

    if (result.statusCode >= 200 && result.statusCode < 300) {
      const payload = parseDashboardBody(result.body ?? result.bodyText);
      const parsed = parseCursorQuotaPayload(payload, t);
      if (parsed) return enrichFromDashboard(authIndex, parsed, t);
    } else {
      lastStatus = result.statusCode;
      lastError = getApiCallErrorMessage(result);
    }
  } catch (err: unknown) {
    lastError = err instanceof Error ? err.message : t('common.unknown_error');
    lastStatus = getStatusFromError(err);
  }

  // 2. Fallback 1: GET /api/usage/summary
  try {
    const result = await apiCallApi.request({
      authIndex,
      method: 'GET',
      url: CURSOR_USAGE_SUMMARY_URL,
      header: { Authorization: 'Bearer $TOKEN$' },
    });

    if (result.statusCode >= 200 && result.statusCode < 300) {
      const payload = parseDashboardBody(result.body ?? result.bodyText);
      const parsed = parseCursorQuotaPayload(payload, t);
      if (parsed) return parsed;
    }
  } catch {
    // Optional endpoint. Keep the previous error and try the next URL.
  }

  // 3. Fallback 2: GET /auth/usage
  try {
    const result = await apiCallApi.request({
      authIndex,
      method: 'GET',
      url: CURSOR_AUTH_USAGE_URL,
      header: { Authorization: 'Bearer $TOKEN$' },
    });

    if (result.statusCode >= 200 && result.statusCode < 300) {
      const payload = parseDashboardBody(result.body ?? result.bodyText);
      const parsed = parseCursorQuotaPayload(payload, t);
      if (parsed) return parsed;
    }
  } catch {
    // Optional endpoint. The error from the primary request is still the one we surface.
  }

  throw createStatusError(lastError || t('cursor_quota.empty_data'), lastStatus);
};

export const CURSOR_CONFIG: QuotaProviderData<CursorQuotaState, CursorQuotaData> = {
  type: 'cursor',
  i18nPrefix: 'cursor_quota',
  filterFn: (file) => isCursorFile(file) && !isDisabledAuthFile(file),
  fetchQuota: fetchCursorQuota,
  storeSelector: (state) => state.cursorQuota,
  storeSetter: 'setCursorQuota',
  buildLoadingState: () => ({ status: 'loading', data: null }),
  buildSuccessState: (data) => ({ status: 'success', data }),
  buildErrorState: (message, status) => ({
    status: 'error',
    data: null,
    error: message,
    errorStatus: status,
  }),
};
