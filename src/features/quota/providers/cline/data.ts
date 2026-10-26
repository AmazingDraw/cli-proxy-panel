/**
 * Cline 额度数据层：走 host management quota/fetch（插件 quota_provider）。
 * React-free / SCSS-free。
 */

import type { TFunction } from 'i18next';
import type { AuthFileItem, ClineQuotaData, ClineQuotaState, ClineQuotaWindow } from '@/types';
import { apiClient } from '@/services/api/client';
import { useAuthStore } from '@/stores';
import { normalizeApiBase } from '@/utils/connection';
import {
  createStatusError,
  formatQuotaResetTime,
  getStatusFromError,
  isClineFile,
  isDisabledAuthFile,
} from '@/utils/quota';
import { normalizeAuthIndex } from '@/utils/authIndex';
import type { QuotaProviderData } from '../types';

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const asString = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : value == null ? '' : String(value).trim();

const normalizeFraction = (value: unknown): number | null => {
  const n = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(1, n));
};

const normalizeResetAt = (value: unknown): number | null => {
  const text = asString(value);
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : null;
};

const periodHoursForWindow = (windowKey: string): number | null => {
  const key = windowKey.toLowerCase();
  if (key === '5h' || key === 'five_hour' || key === 'five-hour') return 5;
  if (key === '7d' || key === 'seven_day' || key === 'seven-day') return 168;
  if (key === 'period' || key === '30d' || key === 'monthly') return 720;
  return null;
};

export const parseClineQuotaPayload = (payload: unknown, t: TFunction): ClineQuotaData | null => {
  const root = asRecord(payload);
  if (!root) return null;

  const subscription = asRecord(root.subscription);
  const planName = asString(subscription?.plan ?? subscription?.tierName) || null;
  const summary = Array.isArray(root.summary) ? root.summary : [];
  let planPrice: string | null = null;
  let status: string | null = null;
  for (const item of summary) {
    const row = asRecord(item);
    if (!row) continue;
    const key = asString(row.key).toLowerCase();
    if (key === 'price') {
      const value = row.value;
      const currency = asString(row.currency) || 'USD';
      if (typeof value === 'number' && Number.isFinite(value)) {
        planPrice = currency === 'USD' ? `$${value.toFixed(2)}` : `${value} ${currency}`;
      } else if (asString(value)) {
        planPrice = asString(value);
      }
    }
    if (key === 'status') {
      status = asString(row.unit) || asString(row.value) || null;
    }
  }

  const windows: ClineQuotaWindow[] = [];
  const groups = Array.isArray(root.groups) ? root.groups : [];
  for (const group of groups) {
    const g = asRecord(group);
    const buckets = Array.isArray(g?.buckets) ? g!.buckets : [];
    for (const bucket of buckets) {
      const b = asRecord(bucket);
      if (!b) continue;
      const windowKey = asString(b.window) || `bucket-${windows.length + 1}`;
      const remaining = normalizeFraction(b.remainingFraction ?? b.remaining_fraction);
      const resetAtMs = normalizeResetAt(b.resetTime ?? b.reset_time);
      const description = asString(b.description);
      const labelFromKey =
        windowKey === 'period' || windowKey === 'monthly'
          ? t('cline_quota.window_monthly')
          : windowKey === '5h' || windowKey === 'five_hour'
            ? t('cline_quota.window_5h')
            : windowKey === '7d' || windowKey === 'weekly'
              ? t('cline_quota.window_weekly')
              : windowKey;
      // Prefer short i18n title over long API description.
      const label = labelFromKey || description || windowKey;
      windows.push({
        id: windowKey,
        label,
        usedPercent: remaining === null ? null : Math.round((1 - remaining) * 100),
        resetLabel: formatQuotaResetTime(resetAtMs !== null ? new Date(resetAtMs).toISOString() : undefined),
        resetAtMs,
        periodHours: periodHoursForWindow(windowKey),
        description: description || undefined,
      });
    }
  }

  if (!planName && windows.length === 0) return null;
  return { windows, planName, planPrice, status };
};

const fetchClineQuota = async (file: AuthFileItem, t: TFunction): Promise<ClineQuotaData> => {
  const rawAuthIndex = file['auth_index'] ?? file.authIndex;
  const authIndex = normalizeAuthIndex(rawAuthIndex);
  if (!authIndex) {
    throw new Error(t('cline_quota.missing_auth_index'));
  }

  try {
    const apiBase = normalizeApiBase(useAuthStore.getState().apiBase);
    const payload = await apiClient.post<unknown>(`${apiBase}/v0/management/quota/fetch`, {
      auth_index: authIndex,
      provider: 'cline',
    });
    const parsed = parseClineQuotaPayload(payload, t);
    if (!parsed) {
      throw new Error(t('cline_quota.empty_data'));
    }
    return parsed;
  } catch (err: unknown) {
    const status = getStatusFromError(err);
    const message = err instanceof Error ? err.message : t('common.unknown_error');
    throw createStatusError(message || t('cline_quota.empty_data'), status);
  }
};

export const CLINE_CONFIG: QuotaProviderData<ClineQuotaState, ClineQuotaData> = {
  type: 'cline',
  i18nPrefix: 'cline_quota',
  filterFn: (file) => isClineFile(file) && !isDisabledAuthFile(file),
  fetchQuota: fetchClineQuota,
  storeSelector: (state) => state.clineQuota,
  storeSetter: 'setClineQuota',
  buildLoadingState: () => ({ status: 'loading', data: null }),
  buildSuccessState: (data) => ({ status: 'success', data }),
  buildErrorState: (message, status) => ({
    status: 'error',
    data: null,
    error: message,
    errorStatus: status,
  }),
};
