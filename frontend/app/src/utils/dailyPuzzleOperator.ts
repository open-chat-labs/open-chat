export type RegenerateOption = { value: string; label: string };

/**
 * What "Regenerate today" may be asked for: as scheduled, or one of the games this build can
 * render. Nothing else is offered (#9334 invariant 54): the canister can force a game the app
 * cannot draw, and nobody could play it.
 */
export function regenerateOptions(gameIds: string[]): RegenerateOption[] {
    return [
        { value: "", label: "As scheduled" },
        ...gameIds.map((gameId) => ({ value: gameId, label: gameId })),
    ];
}
