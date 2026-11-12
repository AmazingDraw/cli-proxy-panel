/** Device-code logins may put the code on the URL when the management API omits user_code. */
export function resolveOAuthUserCode(userCode?: string, url?: string): string | undefined {
  const fromApi = userCode?.trim();
  if (fromApi) return fromApi;
  if (!url) return undefined;
  try {
    const code = new URL(url).searchParams.get('user_code')?.trim();
    return code || undefined;
  } catch {
    const match = url.match(/[?&]user_code=([^&]+)/i);
    if (!match?.[1]) return undefined;
    try {
      return decodeURIComponent(match[1]).trim() || undefined;
    } catch {
      return match[1].trim() || undefined;
    }
  }
}
