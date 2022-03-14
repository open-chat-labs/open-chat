import type { ICP } from "../domain/crypto/crypto";
import { derived, writable } from "svelte/store";
import { E8S_PER_ICP } from "domain/user/user";

export const icpBalanceE8sStore = writable<ICP>({
    e8s: BigInt(0),
});

export const icpBalanceStore = derived(icpBalanceE8sStore, ($icp) => {
    return Number($icp.e8s) / E8S_PER_ICP;
});
