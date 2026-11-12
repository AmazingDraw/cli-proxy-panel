import { describe, expect, test } from 'bun:test';
import { createElement } from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { createInstance } from 'i18next';
import { OAuthPage } from '@/features/oauth/OAuthPage';
import { OAuthFlowDialog } from '@/features/oauth/components/OAuthFlowDialog';
import type { ProviderFlowState } from '@/features/oauth/hooks/useOAuthFlows';
import { OAUTH_PROVIDERS, supportsManualCallback } from '@/features/oauth/providers';
import { resolveOAuthUserCode } from '@/features/oauth/userCode';
import en from '@/i18n/locales/en.json';

const i18n = createInstance();
await i18n.init({ lng: 'en', resources: { en: { translation: en } } });

const CLINE_KEYS = [
  'oauth_hint',
  'open_link',
  'copy_link',
  'oauth_status_waiting',
  'oauth_status_success',
  'oauth_status_error',
  'oauth_start_error',
  'oauth_polling_error',
] as const;

describe('Cline OAuth login UI', () => {
  test('renders a gallery tile without leftover translation keys', () => {
    const page = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(MemoryRouter, null, createElement(OAuthPage))
      )
    );
    expect(page).toContain('Cline');
    expect(page).not.toContain('auth_login.');
  });

  test('fills the device-code dialog from the verification URL when the API omits user_code', () => {
    const cline = OAUTH_PROVIDERS.find((provider) => provider.id === 'cline');
    expect(cline?.flow).toBe('device');
    expect(cline && supportsManualCallback(cline)).toBe(false);

    const url = 'https://authkit.cline.bot/device?user_code=ZPMX-NDCT';
    expect(resolveOAuthUserCode(undefined, url)).toBe('ZPMX-NDCT');
    expect(resolveOAuthUserCode('  KEEP-1  ', url)).toBe('KEEP-1');

    const state: ProviderFlowState = {
      url,
      userCode: resolveOAuthUserCode(undefined, url),
      state: 'cline-device-1',
      status: 'waiting',
      polling: true,
    };
    const markup = renderToStaticMarkup(
      createElement(
        I18nextProvider,
        { i18n },
        createElement(OAuthFlowDialog, {
          open: true,
          providerId: 'cline',
          heading: { title: i18n.t(cline!.titleKey), caption: 'Device code', icon: '' },
          state,
          text: (suffix: string) => i18n.t(`auth_login.cline_${suffix}`),
          supportsCallback: false,
          onStart: () => {},
          onCancel: () => {},
          onCallbackChange: () => {},
          onCallbackSubmit: () => {},
          onViewAuthFiles: () => {},
          onClose: () => {},
        })
      )
    );
    expect(markup).toContain(en.auth_login.cline_oauth_hint);
    expect(markup).toContain(en.auth_login.cline_open_link);
    expect(markup).toContain(en.auth_login.cline_oauth_status_waiting);
    expect(markup).toContain('ZPMX-NDCT');
    expect(markup).not.toContain('auth_login.');
    expect(markup).not.toContain(en.auth_login.oauth_callback_label);
  });

  for (const locale of ['en', 'zh-CN', 'zh-TW', 'ru', 'vi', 'ko']) {
    test(`provides complete Cline login translations (${locale})`, () => {
      const { auth_login: messages } = JSON.parse(
        readFileSync(`src/i18n/locales/${locale}.json`, 'utf8')
      ) as { auth_login: Record<string, string> };
      for (const suffix of CLINE_KEYS) {
        expect(messages[`cline_${suffix}`]).toBeTruthy();
        expect(messages[`cline_${suffix}`]).not.toContain('auth_login.');
      }
    });
  }
});
