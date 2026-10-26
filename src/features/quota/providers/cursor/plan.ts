/**
 * Cursor 套餐档位：Ultra 用液态铂金，Pro / Business 用金卡。
 */

import type { TFunction } from 'i18next';
import { normalizePlanType } from '@/utils/quota';
import type { CodexPlanTier } from '@/utils/quota/planTier';

export function resolveCursorPlanTier(planName: string | null | undefined): CodexPlanTier {
  const normalized = normalizePlanType(planName);
  if (!normalized) return 'plain';
  if (normalized === 'ultra') return 'elite';
  if (
    normalized === 'pro' ||
    normalized === 'pro+' ||
    normalized === 'proplus' ||
    normalized === 'pro_plus' ||
    normalized === 'pro-plus' ||
    normalized === 'business' ||
    normalized === 'team'
  ) {
    return 'premium';
  }
  return 'plain';
}

export function getCursorPlanLabel(planName: string | null | undefined, t: TFunction): string | null {
  const raw = planName?.trim();
  if (!raw) return null;
  const normalized = normalizePlanType(raw);
  if (normalized === 'pro') return t('cursor_quota.plan_pro');
  if (normalized === 'pro+' || normalized === 'proplus' || normalized === 'pro_plus' || normalized === 'pro-plus') {
    return t('cursor_quota.plan_pro_plus');
  }
  if (normalized === 'ultra') return t('cursor_quota.plan_ultra');
  if (normalized === 'business' || normalized === 'team') return t('cursor_quota.plan_business');
  if (normalized === 'free' || normalized === 'hobby') return t('cursor_quota.plan_free');
  return raw;
}

export function formatCursorDollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
