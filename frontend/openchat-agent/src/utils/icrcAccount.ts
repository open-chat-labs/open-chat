import type { Principal } from "@icp-sdk/core/principal";
import { userIdToIcrcAccount } from "@shared";

export type ApiIcrcAccount = {
    owner: Principal;
    subaccount: [] | [Uint8Array];
};

// The ledger account holding a user's funds, in the shape the candid interfaces take. Every query
// or instruction which concerns "the user's wallet" - balance, history, deposits being routed to
// them - has to name this account rather than the bare user id: once a canister holds many users,
// the user id is not a principal anyone can sign for, and the funds live in a subaccount of the
// canister. For a user who is alone in their canister the two are the same account.
//
// Accepts a plain canister id too (eg. the translations canister's balance), which maps to its
// default account unchanged.
export function userIdToApiIcrcAccount(userId: string): ApiIcrcAccount {
    const { owner, subaccount } = userIdToIcrcAccount(userId);
    return { owner, subaccount: subaccount === undefined ? [] : [subaccount] };
}
