import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useRevealGroup } from '@/hooks/motion';
import { useAuthStore, useThemeStore } from '@/stores';
import { KIMI_DISPLAY_NAME } from '@/features/providers/kimi';
import { OAuthHeader } from './components/OAuthHeader';
import { ProviderTile } from './components/ProviderTile';
import { SponsorCard, type SponsorCardSite } from './components/SponsorCard';
import { OAuthFlowDialog, type DialogHeading } from './components/OAuthFlowDialog';
import {
  useOAuthFlows,
  usePluginOAuthProviders,
  type ProviderFlowState,
} from './hooks/useOAuthFlows';
import {
  isSponsor,
  OAUTH_PROVIDERS,
  resolveThemedIcon,
  supportsManualCallback,
  type OAuthProviderCard,
} from './providers';
import styles from './OAuthPage.module.scss';

/**
 * OAuth 登录：提供商画廊（一屏看全）+ 聚焦的授权对话框。
 *
 * 点磁贴即开始登录；对话框可随时关闭，授权在后台继续，磁贴副行实时反映进度。
 * 对话框关闭后保留最后一个目标，让退出动画期间内容不消失。
 */
export function OAuthPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const apiBase = useAuthStore((state) => state.apiBase);
  const resolvedTheme = useThemeStore((state) => state.resolvedTheme);
  const revealRef = useRevealGroup<HTMLDivElement>();

  const pluginProviders = usePluginOAuthProviders(apiBase);
  const providerCards = useMemo<OAuthProviderCard[]>(
    () => [...OAUTH_PROVIDERS, ...pluginProviders],
    [pluginProviders]
  );

  const focusedRef = useRef<string | null>(null);
  const [dialogID, setDialogID] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const flows = useOAuthFlows({
    providerCards,
    isFocused: (provider) => focusedRef.current === provider,
  });

  const labelOf = (card: OAuthProviderCard) =>
    card.kind === 'plugin'
      ? card.title
      : typeof card.label === 'string'
        ? card.label
        : t(card.label.key);

  const captionOf = (card: OAuthProviderCard) => {
    if (card.kind === 'plugin') return t('auth_login.method_plugin');
    const method = t(
      card.flow === 'device' ? 'auth_login.method_device' : 'auth_login.method_browser'
    );
    return card.domain ? `${card.domain} · ${method}` : method;
  };

  const iconOf = (card: OAuthProviderCard) =>
    card.kind === 'plugin' ? card.icon : resolveThemedIcon(card.icon, resolvedTheme);

  const headingOf = (card: OAuthProviderCard): DialogHeading => ({
    title:
      card.kind === 'plugin'
        ? t('auth_login.plugin_oauth_title', { name: card.title })
        : t(card.titleKey),
    caption: captionOf(card),
    icon: iconOf(card),
  });

  const sponsorOf = (card: OAuthProviderCard) =>
    isSponsor(card)
      ? { url: card.sponsor.signUpUrl, label: t('auth_login.kimi_sign_up_button') }
      : undefined;

  const tileStatusLabel = (status: ProviderFlowState['status']) =>
    status === 'waiting'
      ? t('auth_login.tile_waiting')
      : status === 'success'
        ? t('auth_login.tile_success')
        : status === 'error'
          ? t('auth_login.tile_error')
          : undefined;

  const openProvider = (card: OAuthProviderCard) => {
    focusedRef.current = card.id;
    setDialogID(card.id);
    setDialogOpen(true);
    // 已有进行中/失败/刚成功的尝试 → 只是重新打开查看；否则立即开始登录
    if (!flows.states[card.id]?.status) void flows.startAuth(card.id);
  };

  const closeDialog = () => {
    if (dialogID) flows.dismissSuccess(dialogID);
    focusedRef.current = null;
    setDialogOpen(false);
  };

  const viewAuthFiles = () => navigate('/auth-files');

  const dialogCard = dialogID
    ? providerCards.find((card) => card.id === dialogID)
    : undefined;
  const providerCount = providerCards.length;
  const sponsorCards = providerCards.filter(isSponsor);
  const regularCards = providerCards.filter((card) => !isSponsor(card));
  // 赞助商卡占级联的第 0 位，其余磁贴顺延
  const tileIndexOffset = sponsorCards.length > 0 ? 1 : 0;

  const sponsorSites: SponsorCardSite[] = sponsorCards.map((card) => {
    const status = flows.states[card.id]?.status;
    return {
      id: card.id,
      name: labelOf(card),
      region: t(card.sponsor.siteKey),
      domain: card.domain ?? '',
      status,
      statusLabel: tileStatusLabel(status),
      signUpUrl: card.sponsor.signUpUrl,
    };
  });

  const renderTile = (card: OAuthProviderCard, index: number) => {
    const status = flows.states[card.id]?.status;
    return (
      <ProviderTile
        key={card.id}
        label={labelOf(card)}
        caption={captionOf(card)}
        icon={iconOf(card)}
        index={index + tileIndexOffset}
        status={status}
        statusLabel={tileStatusLabel(status)}
        onOpen={() => openProvider(card)}
      />
    );
  };
  const waitingCount = Object.values(flows.states).filter(
    (state) => state.status === 'waiting'
  ).length;

  return (
    <div className={styles.page} ref={revealRef}>
      <OAuthHeader
        providerCount={providerCount}
        waitingCount={waitingCount}
        addedCount={flows.addedCount}
      />

      {/* 赞助商独占首行：一张品牌卡收拢两站入口，其余提供商在下方紧凑网格 */}
      {sponsorCards.length > 0 && (
        <SponsorCard
          title={KIMI_DISPLAY_NAME}
          caption={t('auth_login.sponsor_kimi_caption')}
          icon={iconOf(sponsorCards[0])}
          signUpLabel={t('auth_login.sponsor_sign_up')}
          sites={sponsorSites}
          onOpen={(siteId) => {
            const card = sponsorCards.find((sponsor) => sponsor.id === siteId);
            if (card) openProvider(card);
          }}
        />
      )}
      <div className={styles.grid}>{regularCards.map(renderTile)}</div>

      {dialogCard && (
        <OAuthFlowDialog
          open={dialogOpen}
          providerId={dialogCard.id}
          heading={headingOf(dialogCard)}
          state={flows.states[dialogCard.id] ?? {}}
          text={(suffix) => flows.providerText(dialogCard.id, suffix)}
          supportsCallback={supportsManualCallback(dialogCard)}
          sponsor={sponsorOf(dialogCard)}
          onStart={() => void flows.startAuth(dialogCard.id)}
          onCancel={() => void flows.cancelAuth(dialogCard.id)}
          onCallbackChange={(value) => flows.setCallbackInput(dialogCard.id, value)}
          onCallbackSubmit={() => void flows.submitCallback(dialogCard.id)}
          onViewAuthFiles={viewAuthFiles}
          onClose={closeDialog}
        />
      )}
    </div>
  );
}
