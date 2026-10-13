import {
    selectedChatBlockedUsersStore,
    selectedChatBotsStore,
    selectedChatInvitedUsersStore,
    selectedChatLapsedMembersStore,
    selectedChatMembersStore,
    selectedChatWebhooksStore,
    type MultiUserChat,
    type OpenChat,
} from "@client";
import { flushSync, tick } from "svelte";
import { afterEach, expect, test, vi } from "vitest";
import { MemberManagement } from "./membersState.svelte";

afterEach(() => vi.restoreAllMocks());

// One is built each time a members, invite or group details page opens, so one that kept its
// subscriptions after the page closed would keep updating for the rest of the session
test("a MemberManagement holds no store subscription once nothing renders it", async () => {
    const stores = [
        selectedChatMembersStore,
        selectedChatLapsedMembersStore,
        selectedChatBlockedUsersStore,
        selectedChatInvitedUsersStore,
        selectedChatBotsStore,
        selectedChatWebhooksStore,
    ];
    let live = 0;
    for (const store of stores) {
        // A derived store's `.value` keeps one subscription of its own, once per store
        void store.value;
        const subscribe = store.subscribe.bind(store as never);
        vi.spyOn(store, "subscribe").mockImplementation(((
            run: (value: unknown) => void,
            invalidate?: () => void,
        ) => {
            live++;
            const unsubscribe = subscribe(run as never, invalidate);
            return () => {
                live--;
                unsubscribe();
            };
        }) as never);
    }

    const membersState = new MemberManagement(
        {} as OpenChat,
        {
            kind: "group_chat",
            id: { kind: "group_chat", groupId: "bbbbb-bb" },
        } as MultiUserChat,
    );
    let rendered = 0;
    const stop = $effect.root(() => {
        $effect(() => {
            rendered =
                membersState.members.size +
                membersState.lapsed.size +
                membersState.blocked.size +
                membersState.invited.size +
                membersState.bots.size +
                membersState.webhooks.size;
        });
    });
    flushSync();
    expect(rendered).toBe(0);
    expect(live).toBe(stores.length);

    stop();
    // createSubscriber lets go of the store a microtask after the last reader goes
    await tick();
    expect(live).toBe(0);
});
