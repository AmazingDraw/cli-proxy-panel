import { describe, expect, spyOn, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { apiClient } from '@/services/api/client';
import { oauthApi } from '@/services/api/oauth';
import { createOAuthAttempts } from '@/features/oauth/oauthAttempts';
import { isSponsor, OAUTH_PROVIDERS } from '@/features/oauth/providers';
import { KIMI_CHINESE_AFFILIATE_URL } from '@/features/providers/kimi';

describe('Kimi regional login', () => {
  test('uses separate provider parameters and preserves cancellation', async () => {
    const get = spyOn(apiClient, 'get').mockResolvedValue({ url: 'https://example.test' });
    const controller = new AbortController();
    try {
      await oauthApi.startAuth('kimi', controller.signal);
      expect(get).toHaveBeenLastCalledWith('/oauth/auth-url', {
        params: { provider: 'kimi' },
        signal: controller.signal,
      });
      await oauthApi.startAuth('kimi-ai', controller.signal);
      expect(get).toHaveBeenLastCalledWith('/oauth/auth-url', {
        params: { provider: 'kimi-ai' },
        signal: controller.signal,
      });
    } finally {
      get.mockRestore();
    }
  });

  test('keeps regional login attempts independent', () => {
    const attempts = createOAuthAttempts({ setTimeout: () => 0, clearTimeout: () => {} });
    try {
      const china = attempts.begin('kimi');
      const international = attempts.begin('kimi-ai');
      attempts.begin('kimi-ai');
      expect(china.signal.aborted).toBe(false);
      expect(international.signal.aborted).toBe(true);
    } finally {
      attempts.invalidateAll();
    }
  });

  test('offers a single Kimi tile without a sponsor banner or international entry', () => {
    const kimi = OAUTH_PROVIDERS.find((provider) => provider.id === 'kimi');
    expect(kimi).toMatchObject({ flow: 'device', domain: 'kimi.com' });
    expect(kimi?.sponsor).toBeUndefined();
    expect(OAUTH_PROVIDERS.some((provider) => provider.id === 'kimi-ai')).toBe(false);
    expect(OAUTH_PROVIDERS[0]?.id).toBe('kimi');
    expect(OAUTH_PROVIDERS.filter(isSponsor)).toEqual([]);
    expect(new URL(KIMI_CHINESE_AFFILIATE_URL).hostname).toBe('platform.kimi.com');
  });

  for (const locale of ['en', 'zh-CN', 'zh-TW', 'ru']) {
    test(`names the login tile Kimi without a regional suffix (${locale})`, () => {
      const { auth_login: messages } = JSON.parse(
        readFileSync(`src/i18n/locales/${locale}.json`, 'utf8')
      ) as { auth_login: Record<string, string> };
      expect(messages.kimi_oauth_name).toBe('Kimi');
      expect(messages.kimi_oauth_title).not.toMatch(/国内站|中國站|China|Китай|중국/);
      expect(messages.kimi_oauth_hint).not.toMatch(/kimi\.ai|国际站|國際站|International/);
    });
  }
});
