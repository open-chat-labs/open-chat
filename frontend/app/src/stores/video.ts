/**
 * We need to make sure that we have one and only one video call in progress at any one time. For this reason we will keep the
 * DailyCall object in a store
 */

import { type DailyCall, type DailyThemeConfig } from "@daily-co/daily-js";
import { type ChatIdentifier } from "openchat-client";
import { writable } from "svelte/store";

export type ActiveVideoCall = {
    status: "joining" | "joined";
    chatId: ChatIdentifier;
    call?: DailyCall;
    fullscreen: boolean;
};

const store = writable<ActiveVideoCall | undefined>(undefined);

export const microphone = writable<boolean>(false);
export const camera = writable<boolean>(false);
export const sharing = writable<boolean>(false);

export const activeVideoCall = {
    subscribe: store.subscribe,
    setCall: (chatId: ChatIdentifier, call: DailyCall) => {
        return store.set({
            status: "joined",
            chatId,
            call,
            fullscreen: false,
        });
    },
    fullscreen: (fullscreen: boolean) => {
        return store.update((current) => {
            return current === undefined
                ? undefined
                : {
                      ...current,
                      fullscreen,
                  };
        });
    },
    endCall: () => {
        return store.update((current) => {
            if (current !== undefined && current.call) {
                current.call.destroy();
            }
            microphone.set(false);
            camera.set(false);
            sharing.set(false);
            return undefined;
        });
    },
    changeTheme: (theme: DailyThemeConfig) => {
        return store.update((current) => {
            if (current !== undefined && current.call !== undefined) {
                current.call.setTheme(theme);
            }
            return current;
        });
    },
    joining: (chatId: ChatIdentifier) => {
        return store.set({
            status: "joining",
            chatId,
            fullscreen: false,
        });
    },
};
