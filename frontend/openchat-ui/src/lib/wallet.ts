// Shared wallet helpers.

/** The transaction id in what a send's host call resolved with ({ id }), or null. WalletSend's receipt and
 *  WalletMain's pending row both read it here, so they agree on which results carry one. */
export function txIdOf(result: unknown): string | null {
  return result && typeof result === 'object' && 'id' in result && typeof result.id === 'string' ? result.id : null;
}

/** Where WalletMain is: its view, and how an open flow was reached. */
export interface WalletPlace {
  view: 'all' | 'token' | 'send' | 'receive' | 'swap' | 'recipients';
  /** The flow was opened from All activity without a token. */
  fromAll: boolean;
  /** The flow goes back to All activity when it ends. */
  backToAll: boolean;
  /** The flow goes back to Recipients when it ends. */
  backToRecipients: boolean;
  /** The token whose page is shown, or '' for none. */
  sym: string;
}

/**
 * Where a flow opened from here goes back to when it ends: Recipients (or a flow opened from it), All activity (or a
 * flow opened from it, however its token was picked, or with no token page to go back to), else the token page.
 */
export function returnPlace(p: WalletPlace): 'recipients' | 'all' | 'token' {
  const flow = p.view === 'send' || p.view === 'receive' || p.view === 'swap';
  if (p.view === 'recipients' || (flow && p.backToRecipients)) return 'recipients';
  if (p.view === 'all' || (flow && (p.fromAll || p.backToAll)) || !p.sym) return 'all';
  return 'token';
}
