import type { PuzzleHost } from "@src/logic/dailyPuzzle/dailyPuzzle.svelte";
import { toastStore } from "@src/stores/toast";

/**
 * What a puzzle screen gives its play session (DailyPuzzleGame): a failure toasted, and the game's
 * strings in the screen's language (`translate`, `locale`, read when used, so they follow a change
 * of language). One for every tree's puzzle screen, so they say failures the same way.
 */
export function toastingPuzzleHost(
    translate: (key: string) => string,
    locale: () => string | null | undefined,
): PuzzleHost {
    return {
        onFailure: (reason, detail) => toastStore.showFailureToast(reason, detail),
        translate,
        locale: () => locale() ?? "en",
    };
}
