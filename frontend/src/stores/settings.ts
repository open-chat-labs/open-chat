import type { ScrollStrategy } from "../domain/chat/chat";
import { writable } from "svelte/store";
import { isTouchDevice } from "../utils/devices";
import { configKeys } from "../utils/config";

const test = process.env.NODE_ENV === "test";

function boolFromLS(key: string, def: boolean): boolean {
    if (test) return def;

    const val = localStorage.getItem(key);
    switch (val) {
        case "true":
            return true;
        case "false":
            return false;
        default:
            return def;
    }
}

export const enterSend = createLsBoolStore(configKeys.enterSend, !isTouchDevice);
export const userCreatedStore = createLsBoolStore(configKeys.userCreated, false);
export const fullScreen = createLsBoolStore(configKeys.fullScreen, false);

export const userInfoOpen = createLsBoolStore(configKeys.userInfoSection, true);
export const appearanceSectionOpen = createLsBoolStore(configKeys.appearanceSection, false);
export const chatsSectionOpen = createLsBoolStore(configKeys.chatsSection, false);
export const accountSectionOpen = createLsBoolStore(configKeys.accountSection, false);
export const referralOpen = createLsBoolStore(configKeys.referralSection, false);
export const storageSectionOpen = createLsBoolStore(configKeys.storageSection, false);
export const statsSectionOpen = createLsBoolStore(configKeys.userStatsSection, false);

export const groupInfoOpen = createLsBoolStore(configKeys.groupInfoSection, true);
export const groupVisibilityOpen = createLsBoolStore(configKeys.groupVisibilitySection, true);
export const groupPermissionsOpen = createLsBoolStore(configKeys.groupPermissionSection, false);
export const groupStatsOpen = createLsBoolStore(configKeys.groupStatsSection, false);
export const groupInviteUsersOpen = createLsBoolStore(configKeys.groupInviteUsersSections, false);
export const groupAdvancedOpen = createLsBoolStore(configKeys.groupAdvancedSection, false);

function createLsBoolStore(key: string, def: boolean) {
    const store = writable<boolean>(boolFromLS(key, def));
    return {
        subscribe: store.subscribe,
        set: (state: boolean): void =>
            store.update((_) => {
                if (!test) {
                    localStorage.setItem(key, state.toString());
                }
                return state;
            }),
        toggle: (): void =>
            store.update((val) => {
                if (!test) {
                    localStorage.setItem(key, (!val).toString());
                }
                return !val;
            }),
    };
}

const scrollStratStore = writable<ScrollStrategy>(
    (test
        ? null
        : localStorage.getItem(configKeys.scrollStrategy) || "latestMessage") as ScrollStrategy
);

export const scrollStrategy = {
    subscribe: scrollStratStore.subscribe,
    set: (strategy: ScrollStrategy): void => {
        scrollStratStore.set(strategy);
        if (!test) {
            localStorage.setItem(configKeys.scrollStrategy, strategy);
        }
    },
};
