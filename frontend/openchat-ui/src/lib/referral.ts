// Referral links: OpenChat's invite links carry who sent them as `?ref=<code>` (the referrer's user id).

/**
 * The referral code a pasted invite link carries (its `ref` parameter), or undefined when the text isn't one. Takes the
 * link with or without its scheme ("oc.app/?ref=…", "https://oc.app/community/x?ref=…").
 */
export function referralCode(text: string): string | undefined {
  const match = text.trim().match(/[?&]ref=([^&#\s]+)/);
  if (!match) return undefined;
  try {
    const code = decodeURIComponent(match[1]).trim();
    return code === '' ? undefined : code;
  } catch {
    return undefined;
  }
}
