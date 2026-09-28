import type { Principal } from "@icp-sdk/core/principal";
import type { IcrcAccount } from "@shared";

export type ApiIcrcAccount = {
    owner: Principal;
    subaccount: [] | [Uint8Array];
};

// An account in the shape the candid interfaces take
export function apiIcrcAccount({ owner, subaccount }: IcrcAccount): ApiIcrcAccount {
    return { owner, subaccount: subaccount === undefined ? [] : [subaccount] };
}
