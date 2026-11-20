import { chatIdentifierToString, type ChatIdentifier, type VersionedRules } from "@client";
import { SvelteMap } from "svelte/reactivity";

// The rules the native pages show for the selected chat: the server's details', or, for the
// minute after a save here, the rules as saved. The client's own local update for a save
// (selectedChatRulesStore) isn't read: its undo puts back the rules it replaced, so two saves
// within its minute leave the first save's rules held for good over the server's. That's every
// tree's client, and the old trees' behaviour is left as it is, so the native pages keep their
// own minute instead.

/** How long a save's rules are shown over the server's: the client's local updates' lifetime. */
export const SAVED_RULES_MS = 60_000;

type Saved = { rules: VersionedRules; at: number };

export class SavedRules {
    #saved = new SvelteMap<string, Saved>();

    /** A save of `id`'s rules has gone through, with these rules. */
    remember(id: ChatIdentifier, rules: VersionedRules, now = Date.now()) {
        this.#saved.set(chatIdentifierToString(id), { rules, at: now });
    }

    /** `id`'s rules as the pages show them: as saved here within the minute, else `server`'s. */
    shown(
        id: ChatIdentifier,
        server: VersionedRules | undefined,
        now = Date.now(),
    ): VersionedRules | undefined {
        const saved = this.#saved.get(chatIdentifierToString(id));
        return saved !== undefined && now - saved.at < SAVED_RULES_MS ? saved.rules : server;
    }
}

export const savedRules = new SavedRules();
