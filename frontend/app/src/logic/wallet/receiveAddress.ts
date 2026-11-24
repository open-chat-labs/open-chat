import {
    CKBTC_SYMBOL,
    CKSOL_SYMBOL,
    encodeIcrcAccount,
    ICP_SYMBOL,
    userWalletAccount,
} from "@client";

/**
 * The address the user's own wallet receives ICRC tokens at (CHAT and every token but ICP, which has
 * the legacy account `cryptoAccount`): their user canister's account, or their principal's.
 */
export function userWalletAddress(userId: string, principal: () => string): string {
    return encodeIcrcAccount(userWalletAccount(userId, principal));
}

/**
 * Of a token's networks (`ReceiveAccount.networks`), the one that arrives straight in the user's
 * OpenChat account on the IC: ckBTC rather than BTC, ckSOL rather than SOL, ICP rather than a
 * oneSec token's EVM chains. No minter, no network fee and nothing to fetch. Undefined for a token
 * with no networks to choose from, which only ever arrives on the IC.
 */
export function icNetwork(networks: readonly string[]): string | undefined {
    return networks.find((n) => n === ICP_SYMBOL || n === CKBTC_SYMBOL || n === CKSOL_SYMBOL);
}
