import type { ResourceKey } from "@client";

/** How a console action went, for the screen to toast (each `logic/admin` outcome is one). */
export type ConsoleOutcome =
    | { kind: "success"; message: ResourceKey }
    | { kind: "failed"; message: ResourceKey; err?: unknown };

export type ConsoleReport = (outcome: ConsoleOutcome | undefined) => void;
