import { LocalStorageStore } from "@client";
import { PAGE_ACCENTS, type PageAccent } from "@openchat/ui/src/pages/types";
import { configKeys } from "@shared";

// The accent colour picked on Landing's theme controls, kept in this browser, for the whole of the
// new web UI (App.svelte puts it on <html>; Landing and Learn are their own theme roots).

/** A stored accent, or the design's default for none or one the design doesn't have (any more). */
export function accentOf(stored: string | null | undefined): PageAccent {
    return PAGE_ACCENTS.find((a) => a === stored) ?? "pink";
}

export const accentStore = new LocalStorageStore<PageAccent>(
    configKeys.webAccent,
    "pink",
    (accent) => accent,
    accentOf,
);
