/**
 * We need to make sure that we have one and only one video call in progress at any one time. For this reason we will keep the
 * DailyCall object in a store
 */

import { type DailyCall, type DailyThemeConfig } from "@daily-co/daily-js";
import { type ChatIdentifier } from "openchat-client";
import { writable } from "svelte/store";

export type IncomingVideoCall = {
    chatId: ChatIdentifier;
    userId: string;
};

export type ActiveVideoCall = {
    status: "joining" | "joined";
    chatId: ChatIdentifier;
    call?: DailyCall;
    fullscreen: boolean;
    threadOpen: boolean;
};

const activeStore = writable<ActiveVideoCall | undefined>(undefined);
export const incomingVideoCall = writable<IncomingVideoCall | undefined>(undefined);

export const microphone = writable<boolean>(false);
export const camera = writable<boolean>(false);
export const sharing = writable<boolean>(false);

export const activeVideoCall = {
    subscribe: activeStore.subscribe,
    setCall: (chatId: ChatIdentifier, call: DailyCall) => {
        return activeStore.set({
            status: "joined",
            chatId,
            call,
            fullscreen: false,
            threadOpen: false,
        });
    },
    fullscreen: (fullscreen: boolean) => {
        return activeStore.update((current) => {
            return current === undefined
                ? undefined
                : {
                      ...current,
                      fullscreen,
                  };
        });
    },
    threadOpen: (threadOpen: boolean) => {
        return activeStore.update((current) => {
            return current === undefined
                ? undefined
                : {
                      ...current,
                      threadOpen,
                  };
        });
    },
    endCall: () => {
        return activeStore.update((current) => {
            current?.call?.destroy();
            microphone.set(false);
            camera.set(false);
            sharing.set(false);
            return undefined;
        });
    },
    changeTheme: (theme: DailyThemeConfig) => {
        return activeStore.update((current) => {
            current?.call?.setTheme(theme);
            return current;
        });
    },
    joining: (chatId: ChatIdentifier) => {
        return activeStore.set({
            status: "joining",
            chatId,
            fullscreen: false,
            threadOpen: false,
        });
    },
};
