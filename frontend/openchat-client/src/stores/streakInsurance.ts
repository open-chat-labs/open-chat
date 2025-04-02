import type { StreakInsurance } from "openchat-shared";
import { derived, writable } from "svelte/store";
import { localGlobalUpdates } from "./localGlobalUpdates";

export const serverStreakInsuranceStore = writable<StreakInsurance>({
    daysInsured: 0,
    daysMissed: 0,
});

export const streakInsuranceStore = derived(
    [serverStreakInsuranceStore, localGlobalUpdates],
    ([$serverInsurance, $local]) => $local.get("global")?.streakInsurance ?? $serverInsurance,
);
