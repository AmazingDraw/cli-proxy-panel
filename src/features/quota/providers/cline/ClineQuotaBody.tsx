/**
 * Cline 额度渲染体：套餐 / 状态 + period/5h/7d 窗口（插件 management quota）。
 */

import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { ClineQuotaState } from '@/types';
import { buildResetDisplay } from '@/utils/quota';
import { useNow } from '@/hooks/useNow';
import { QuotaMeter } from '../../components/QuotaMeter';
import { QuotaResetLabel } from '../../components/QuotaResetLabel';
import { collectQuotaRowInstants, pickUrgentRowId } from '../../resetSchedule';
import type { QuotaBodyProps } from '../../types';

export function ClineQuotaBody({ quota, classes }: QuotaBodyProps<ClineQuotaState>) {
  const { t, i18n } = useTranslation();
  const now = useNow();
  const soonestRowId = useMemo(
    () => pickUrgentRowId(collectQuotaRowInstants('cline', quota), now),
    [quota, now]
  );
  const data = quota.data;
  const windows = data?.windows ?? [];
  const planName = data?.planName?.trim() || '';
  const planPrice = data?.planPrice?.trim() || '';
  const status = data?.status?.trim() || '';
  const planDisplay = planName && planPrice ? `${planName} (${planPrice})` : planName || null;

  if (windows.length === 0 && !planDisplay) {
    return <div className={classes.quotaMessage}>{t('cline_quota.empty_data')}</div>;
  }

  return (
    <>
      {(planDisplay || status) && (
        <div className={classes.codexPlan}>
          {planDisplay && (
            <span className={classes.codexPlanItem}>
              <span className={classes.codexPlanLabel}>{t('cline_quota.plan_label')}</span>
              <span className={classes.codexPlanValue}>{planDisplay}</span>
            </span>
          )}
          {status && (
            <span className={classes.codexPlanItem}>
              <span className={classes.codexPlanLabel}>{t('cline_quota.status_label')}</span>
              <span className={classes.codexPlanValue}>{status}</span>
            </span>
          )}
        </div>
      )}
      {windows.length === 0 ? (
        <div className={classes.quotaMessage}>{t('cline_quota.empty_data')}</div>
      ) : (
        windows.map((window, index) => {
          const used = window.usedPercent;
          const clampedUsed = used === null ? null : Math.max(0, Math.min(100, used));
          const remaining = clampedUsed === null ? null : Math.max(0, Math.min(100, 100 - clampedUsed));
          const percentLabel =
            used === null ? '--' : t('cline_quota.used_percent', { percent: `${Math.round(used)}%` });
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
              title={
                soon
                  ? t('quota_management.soonest_row_hint')
                  : window.description || undefined
              }
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
