/**
 * We need to make sure that we have one and only one video call in progress at any one time. For this reason we will keep the
 * DailyCall object in a store
 */

import { type DailyCall, type DailyThemeConfig } from "@daily-co/daily-js";
import { type ChatIdentifier } from "openchat-client";
import { get, writable } from "svelte/store";

export type ActiveVideoCall = {
    chatId: ChatIdentifier;
    call?: DailyCall;
};

const store = writable<ActiveVideoCall | undefined>(undefined);

export const activeVideoCall = {
    subscribe: store.subscribe,
    setCall: (chatId: ChatIdentifier, call: DailyCall) => {
        return store.set({
            chatId,
            call,
        });
    },
    endCall: () => {
        return store.update((current) => {
            if (current !== undefined && current.call) {
                current.call.destroy();
            }
            return undefined;
        });
    },
    alignTo: (rect: DOMRect) => {
        const active = get(store);
        if (active && active.call) {
            const frame = active.call.iframe();
            if (frame) {
                frame.style.setProperty("left", `${rect.left}px`);
                frame.style.setProperty("width", `${rect.width}px`);
                frame.style.setProperty("top", `${rect.top}px`);
                frame.style.setProperty("height", `${rect.height}px`);
            }
        }
    },
    changeTheme: (theme: DailyThemeConfig) => {
        return store.update((current) => {
            if (current !== undefined && current.call !== undefined) {
                current.call.setTheme(theme);
            }
            return current;
        });
    },
    join: (chatId: ChatIdentifier) => {
        return store.set({
            chatId,
        });
    },
};
