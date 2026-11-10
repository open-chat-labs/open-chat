import { notEq } from "../state/utils";
import { writable } from "../utils/stores";
import { createMapStore } from "./mapStore";

/**
 * This session's last disappearing-messages length per chat (its TTL in ms, keyed by
 * `chatIdentifierToString`): the one switching them on again goes back to, after they were
 * switched off. The app's `logic/chats/chatDisappearing` keeps it, for every screen that sets
 * them (the native details' switch and the conversation menu's submenu).
 */
export const disappearingLengthsStore = createMapStore(
    writable(new Map<string, bigint>(), undefined, notEq),
);
