// Shared wallet helpers.

/** The transaction id in what a send's host call resolved with ({ id }), or null. WalletSend's receipt and
 *  WalletMain's pending row both read it here, so they agree on which results carry one. */
export function txIdOf(result: unknown): string | null {
  return result && typeof result === 'object' && 'id' in result && typeof result.id === 'string' ? result.id : null;
}
