/**
 * Cursor 额度渲染体：套餐 chip、Grok Bot 周额度、30 天限额 / 官方模型 / API 用量。
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { CursorQuotaState } from '@/types';
import { buildResetDisplay } from '@/utils/quota';
import { useNow } from '@/hooks/useNow';
import { QuotaMeter } from '../../components/QuotaMeter';
import { QuotaResetLabel } from '../../components/QuotaResetLabel';
import { collectQuotaRowInstants, pickUrgentRowId } from '../../resetSchedule';
import type { QuotaBodyProps, QuotaClassMap } from '../../types';
import { formatCursorDollars, getCursorPlanLabel, resolveCursorPlanTier } from './plan';

const getPlanValueClass = (planName: string | null | undefined, classes: QuotaClassMap): string => {
  const tier = resolveCursorPlanTier(planName);
  if (tier === 'elite') return classes.elitePlanValue;
  if (tier === 'premium') return classes.premiumPlanValue;
  return classes.codexPlanValue;
};

export function CursorQuotaBody({ quota, classes }: QuotaBodyProps<CursorQuotaState>) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const soonestRowId = useMemo(
    () => pickUrgentRowId(collectQuotaRowInstants('cursor', quota), now),
    [quota, now]
  );
  const data = quota.data;
  const windows = data?.windows ?? [];
  const planLabel = getCursorPlanLabel(data?.planName, t);
  const planDisplay =
    planLabel && data?.planPrice ? `${planLabel} (${data.planPrice})` : planLabel;
  const includedSpend = data?.includedSpendCents ?? null;
  const limitCents = data?.limitCents ?? null;
  const bonusSpend = data?.bonusSpendCents ?? null;

  if (windows.length === 0 && !planDisplay) {
    return <div className={classes.quotaMessage}>{t('cursor_quota.empty_data')}</div>;
  }

  return (
    <>
      {(planDisplay || data?.onDemandAllowed === false || (includedSpend !== null && limitCents !== null)) && (
        <div className={classes.codexPlan}>
          {planDisplay && (
            <span className={classes.codexPlanItem}>
              <span className={classes.codexPlanLabel}>{t('cursor_quota.plan_label')}</span>
              <span className={getPlanValueClass(data?.planName, classes)}>{planDisplay}</span>
            </span>
          )}
          {includedSpend !== null && limitCents !== null && (
            <span className={classes.codexPlanItem}>
              <span className={classes.codexPlanLabel}>{t('cursor_quota.included_spend_label')}</span>
              <span className={classes.codexPlanValue}>
                {t('cursor_quota.included_spend', {
                  used: formatCursorDollars(includedSpend),
                  limit: formatCursorDollars(limitCents),
                })}
              </span>
            </span>
          )}
          {bonusSpend !== null && bonusSpend > 0 && (
            <span className={classes.codexPlanItem}>
              <span className={classes.codexPlanLabel}>{t('cursor_quota.bonus_spend_label')}</span>
              <span className={classes.codexPlanValue}>{formatCursorDollars(bonusSpend)}</span>
            </span>
          )}
          {data?.onDemandAllowed === false && (
            <span className={classes.codexPlanItem}>
              <span className={classes.codexPlanValue}>{t('cursor_quota.on_demand_off')}</span>
            </span>
          )}
        </div>
      )}
      {windows.length === 0 ? (
        <div className={classes.quotaMessage}>{t('cursor_quota.empty_data')}</div>
      ) : (
        windows.map((window, index) => {
          const used = window.usedPercent;
          const clampedUsed = used === null ? null : Math.max(0, Math.min(100, used));
          const remaining = clampedUsed === null ? null : Math.max(0, Math.min(100, 100 - clampedUsed));
          const percentLabel =
            used === null
              ? '--'
              : t('cursor_quota.used_percent', { percent: `${Math.round(used)}%` });
          const windowLabel = window.labelKey ? t(window.labelKey) : window.label;
          const resetDisplay = buildResetDisplay(
            window.resetLabel !== '-' ? window.resetLabel : null,
            window.resetAtMs ?? null,
            now,
            i18n.resolvedLanguage
          );
          const soon = window.id === soonestRowId;

          return (
            <div
              key={window.id}
              className={classes.quotaRow}
              title={soon ? t('quota_management.soonest_row_hint') : undefined}
            >
              <div className={classes.quotaRowHeader}>
                <span className={classes.quotaModel}>{windowLabel}</span>
                <div className={classes.quotaMeta}>
                  <span className={classes.quotaPercent}>{percentLabel}</span>
                  {resetDisplay && (
                    <QuotaResetLabel display={resetDisplay} classes={classes} soon={soon} />
                  )}
                </div>
              </div>
              <QuotaMeter percent={remaining} classes={classes} index={index} />
            </div>
          );
        })
      )}
    </>
  );
}
