import type { ChatSummary, FontScale, RightPanelContent } from "openchat-shared";
import { get } from "svelte/store";
import { fontScaleStore, navOpen, rightPanelHistory } from "./stores";

export class UIState {
    constructor() {
        this.popRightPanelHistory = this.popRightPanelHistory.bind(this);
    }

    set fontScale(scale: FontScale) {
        fontScaleStore.set(scale);
    }

    toggleNav() {
        navOpen.update((v) => !v);
    }

    closeNavIfOpen() {
        navOpen.update((open) => {
            if (open) {
                return false;
            }
            return open;
        });
    }

    filterRightPanelHistory(fn: (state: RightPanelContent) => boolean) {
        rightPanelHistory.update((h) => h.filter(fn));
    }

    filterRightPanelHistoryByChatType(chat?: ChatSummary) {
        if (chat === undefined) return;

        return this.filterRightPanelHistory((p) => {
            if (chat.kind === "direct_chat") {
                return ["new_group_panel", "user_profile"].includes(p.kind);
            }
            if (
                chat.kind === "group_chat" &&
                (chat.previewed ||
                    (!(chat.subtype?.isNns ?? false) && p.kind === "proposal_filters"))
            ) {
                return false;
            }
            return true;
        });
    }

    pushRightPanelHistory(val: RightPanelContent) {
        rightPanelHistory.update((h) => {
            return [...h, val];
        });
    }

    popRightPanelHistory() {
        rightPanelHistory.update((h) => {
            return h.slice(0, h.length - 1);
        });
    }

    rightPanelContains(kind: RightPanelContent["kind"]) {
        return get(rightPanelHistory).find((p) => p.kind === kind) !== undefined;
    }
}

export const ui = new UIState();
