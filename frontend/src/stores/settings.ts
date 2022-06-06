import type { ScrollStrategy } from "../domain/chat/chat";
import { writable } from "svelte/store";
import { isTouchDevice } from "../utils/devices";
import { configKeys } from "../utils/config";

function boolFromLS(key: string, def: boolean): boolean {
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
        toggle: (): void =>
            store.update((val) => {
                localStorage.setItem(key, (!val).toString());
                return !val;
            }),
    };
}

const scrollStratStore = writable<ScrollStrategy>(
    (localStorage.getItem(configKeys.scrollStrategy) || "latestMessage") as ScrollStrategy
);

export const scrollStrategy = {
    subscribe: scrollStratStore.subscribe,
    set: (strategy: ScrollStrategy): void => {
        scrollStratStore.set(strategy);
        localStorage.setItem(configKeys.scrollStrategy, strategy);
    },
};
