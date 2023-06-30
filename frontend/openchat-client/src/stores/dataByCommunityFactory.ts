/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import { derived, get, Readable, writable, Writable } from "svelte/store";
import { type CommunityIdentifier, CommunityMap } from "openchat-shared";
import { chatListScopeStore } from "./global";

function setDataForCommunity<T>(
    store: Writable<CommunityMap<T>>,
    communityId: CommunityIdentifier,
    data: T
): void {
    store.update((s) => {
        s.set(communityId, data);
        return s;
    });
}

function updateDataForCommunity<T>(
    store: Writable<CommunityMap<T>>,
    communityId: CommunityIdentifier,
    fn: (events: T) => T,
    empty: T
): void {
    store.update((s) => {
        s.set(communityId, fn(s.get(communityId) ?? empty));
        return s;
    });
}

// export type UpdatableCommunityStore<T> = {
//     update: (communityId: string, fn: (data: T) => T) => void;
//     set: (chatId: string, data: T) => void;
// };

export function createCommunitySpecificObjectStore<T extends Record<string, unknown>>(
    init: () => T
) {
    const all: Writable<CommunityMap<T>> = writable<CommunityMap<T>>(new CommunityMap());
    const byCommunity: Readable<T> = derived(
        [chatListScopeStore, all],
        ([$chatListScope, $all]) => {
            if ($chatListScope.kind !== "community") return init();
            return $all.get($chatListScope.id) ?? init();
        }
    );
    return {
        all,
        subscribe: byCommunity.subscribe,
        get: (communityId: CommunityIdentifier): T => get(all).get(communityId) ?? init(),
        update: (communityId: CommunityIdentifier, fn: (data: T) => T) =>
            updateDataForCommunity(all, communityId, fn, init()),
        set: (communityId: CommunityIdentifier, data: T) =>
            setDataForCommunity(all, communityId, data),
        clear: (communityId: CommunityIdentifier): void =>
            setDataForCommunity(all, communityId, init()),
        getProp: <P extends keyof T>(communityId: CommunityIdentifier, prop: P) =>
            (get(all).get(communityId) ?? init())[prop],
        updateProp: <P extends keyof T>(
            communityId: CommunityIdentifier,
            prop: P,
            updateFn: (data: T[P]) => T[P]
        ) => {
            updateDataForCommunity(
                all,
                communityId,
                (data) => {
                    if (data !== undefined) {
                        data[prop] = updateFn(data[prop]);
                        return data;
                    }
                    return data;
                },
                init()
            );
        },
        setProp: <P extends keyof T>(communityId: CommunityIdentifier, prop: P, value: T[P]) => {
            updateDataForCommunity(
                all,
                communityId,
                (data) => {
                    if (data !== undefined) {
                        data[prop] = value;
                        return data;
                    }
                    return data;
                },
                init()
            );
        },
    };
}
