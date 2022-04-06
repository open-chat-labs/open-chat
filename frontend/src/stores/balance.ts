import type { ICP } from "../domain/crypto/crypto";
import { writable } from "svelte/store";

export const icpBalanceE8sStore = writable<ICP>({
    e8s: BigInt(0),
});
