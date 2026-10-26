import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import i18n from '@/i18n';
import { CursorQuotaBody } from '@/features/quota/providers/cursor/CursorQuotaBody';
import {
  parseCursorHardLimit,
  parseCursorPlanInfo,
  parseCursorQuotaPayload,
  parseCursorSandUsage,
} from '@/features/quota/providers/cursor/data';
import { getCursorPlanLabel, resolveCursorPlanTier } from '@/features/quota/providers/cursor/plan';
import { QUOTA_CLASS_KEYS, bindQuotaClasses } from '@/features/quota/types';
import type { CursorQuotaState } from '@/types';

const t = i18n.t.bind(i18n);
const classes = bindQuotaClasses(
  Object.fromEntries(QUOTA_CLASS_KEYS.map((key) => [key, key])),
  'test-host'
);

describe('parseCursorQuotaPayload', () => {
  test('maps period usage windows and spend', () => {
    const parsed = parseCursorQuotaPayload(
      {
        billingCycleEnd: 1790409082000,
        planUsage: {
          totalPercentUsed: 43.2,
          autoPercentUsed: 37.1,
          apiPercentUsed: 99.4,
          includedSpend: 2000,
          limit: 2000,
          bonusSpend: 1965,
        },
      },
      t
    );
    expect(parsed?.windows.map((window) => window.id)).toEqual([
      'total-limit',
      'first-party-models',
      'api-usage',
    ]);
    expect(parsed?.windows[0]?.usedPercent).toBe(43);
    expect(parsed?.windows[0]?.resetAtMs).toBe(1790409082000);
    expect(parsed?.includedSpendCents).toBe(2000);
    expect(parsed?.limitCents).toBe(2000);
    expect(parsed?.bonusSpendCents).toBe(1965);
  });
});

describe('parseCursorPlanInfo', () => {
  test('reads planName and price', () => {
    expect(parseCursorPlanInfo({ planInfo: { planName: 'Pro', price: '$20/mo' } })).toEqual({
      planName: 'Pro',
      planPrice: '$20/mo',
    });
  });
});

describe('parseCursorSandUsage', () => {
  test('maps grok bot percent and ISO weekly reset', () => {
    const window = parseCursorSandUsage(
      {
        usagePercent: 1.448472,
        nextResetTimestampUtc: '2026-09-02T06:31:24.320Z',
        grokPlanLabel: 'Grok Bot Plan',
      },
      t
    );
    expect(window?.id).toBe('grok-bot');
    expect(window?.usedPercent).toBe(1);
    expect(window?.label).toBe('Grok Bot Plan');
    expect(window?.periodHours).toBe(168);
    expect(window?.resetAtMs).toBe(Date.parse('2026-09-02T06:31:24.320Z'));
  });

  test('parses protobuf timestamp objects', () => {
    const window = parseCursorSandUsage(
      { usagePercent: 12, nextResetTimestampUtc: { seconds: 1788321084, nanos: 320000000 } },
      t
    );
    expect(window?.resetAtMs).toBe(1788321084 * 1000 + 320);
  });
});

describe('parseCursorHardLimit', () => {
  test('inverts noUsageBasedAllowed', () => {
    expect(parseCursorHardLimit({ noUsageBasedAllowed: true })).toBe(false);
    expect(parseCursorHardLimit({ noUsageBasedAllowed: false })).toBe(true);
    expect(parseCursorHardLimit({})).toBeUndefined();
  });
});

describe('cursor plan helpers', () => {
  test('tiers Ultra as elite and Pro as premium', () => {
    expect(resolveCursorPlanTier('Ultra')).toBe('elite');
    expect(resolveCursorPlanTier('Pro')).toBe('premium');
    expect(resolveCursorPlanTier('free')).toBe('plain');
  });

  test('translates known plan names', () => {
    expect(getCursorPlanLabel('Pro', t)).toBe('Pro');
    expect(getCursorPlanLabel('Hobby', t)).toBe(t('cursor_quota.plan_free'));
  });
});

describe('CursorQuotaBody', () => {
  test('renders plan chip, grok bot, and included spend', () => {
    const quota: CursorQuotaState = {
      status: 'success',
      data: {
        planName: 'Pro',
        planPrice: '$20/mo',
        onDemandAllowed: false,
        includedSpendCents: 2000,
        limitCents: 2000,
        bonusSpendCents: 1965,
        windows: [
          {
            id: 'grok-bot',
            label: 'Grok Bot Plan',
            usedPercent: 1,
            resetLabel: '09-02 14:31',
            resetAtMs: Date.parse('2026-09-02T06:31:24.320Z'),
            periodHours: 168,
          },
          {
            id: 'total-limit',
            label: '30-Day Limit',
            labelKey: 'cursor_quota.total_limit',
            usedPercent: 43,
            resetLabel: '09-26 15:51',
            resetAtMs: 1790409082000,
            periodHours: 720,
          },
        ],
      },
    };
    const markup = renderToStaticMarkup(createElement(CursorQuotaBody, { quota, classes }));
    expect(markup).toContain('Pro ($20/mo)');
    expect(markup).toContain('Grok Bot Plan');
    expect(markup).toContain('$20.00 / $20.00');
    expect(markup).toContain(t('cursor_quota.on_demand_off'));
  });
});
