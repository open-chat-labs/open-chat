import type { DailyPuzzleConfig, GameConfig } from "@client";

/**
 * The enabled flag is the one series setting an operator changes from the app. Everything else
 * in the config is sent back exactly as the canister reported it, so a save changes nothing but
 * the flag (#9334 invariant 52).
 */
export function withEnabled(config: DailyPuzzleConfig, enabled: boolean): DailyPuzzleConfig {
    return { ...config, enabled };
}

export type RegenerateOption = { value: string; label: string };

/**
 * What "Regenerate today" may be asked for: as scheduled, or one of the games the canister
 * reports a config for. Nothing else is offered (#9334 invariant 54).
 */
export function regenerateOptions(gameConfigs: [string, GameConfig][]): RegenerateOption[] {
    return [
        { value: "", label: "As scheduled" },
        ...gameConfigs.map(([gameId]) => ({ value: gameId, label: gameId })),
    ];
}
