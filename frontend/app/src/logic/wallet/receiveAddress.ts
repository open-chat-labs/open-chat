import { encodeIcrcAccount, userWalletAccount } from "@client";

/**
 * The address the user's own wallet receives ICRC tokens at (CHAT and every token but ICP, which has
 * the legacy account `cryptoAccount`): their user canister's account, or their principal's.
 */
export function userWalletAddress(userId: string, principal: () => string): string {
    return encodeIcrcAccount(userWalletAccount(userId, principal));
}
