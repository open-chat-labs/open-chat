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

/**
 * Where a flow opened from here goes back to (the token picker's pick, and a host request for an extra token; a request
 * naming a token from the wallet goes back to that token's page): where the user was when it opened.
 * From Recipients, Recipients; from All activity, All activity. A token with a page of its own (one in the wallet's
 * tokens) goes back to that page, also when it replaces an open flow (a request starts afresh). An extra token (no page)
 * goes back where the user was: the open flow's way back, else the page shown, else All activity.
 */
export function flowReturn(p: WalletPlace, tokenHasPage: boolean): 'recipients' | 'all' | 'token' {
  if (p.view === 'recipients') return 'recipients';
  if (p.view === 'all') return 'all';
  if (tokenHasPage) return 'token';
  return returnPlace(p);
}

/** WalletMain's state after a token is picked for a flow in the token picker. */
export interface PickedFlow extends WalletPlace {
  view: 'send' | 'receive';
  /** A receivable token outside the wallet's tokens, received by its symbol; null for one of the wallet's. */
  extTok: string | null;
  /** The Send's address: always cleared, a picked flow starts afresh. */
  sendAddr: '';
}

/**
 * A token picked in the token picker for Send or Receive: the flow opens on it and goes back to where it was opened
 * (flowReturn). One of the wallet's tokens (`inTokens`) becomes the shown token; an extra token is only received, so
 * the page shown stays for Receive to go back to.
 */
export function pickedFlow(p: WalletPlace, picked: { id: string; inTokens: boolean; flow: 'send' | 'receive' }): PickedFlow {
  const back = flowReturn(p, picked.inTokens);
  return {
    view: picked.flow,
    sym: picked.inTokens ? picked.id : p.sym,
    extTok: picked.inTokens ? null : picked.id,
    fromAll: false,
    backToAll: back === 'all',
    backToRecipients: back === 'recipients',
    sendAddr: '',
  };
}
