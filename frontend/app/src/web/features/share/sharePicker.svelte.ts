import {
    allUsersStore,
    communitiesStore,
    favouritesStore,
    groupMembersLine,
    lastOnlineStatus,
    selectedChatIdStore,
    serverDirectChatsStore,
    serverGroupChatsStore,
    type ChatIdentifier,
    type MessageFormatter,
    type OpenChat,
} from "@client";
import { interpolate } from "@src/i18n/i18n";
import { chatsToShareTo } from "@src/logic/share/chatsToShareTo";
import { createSubscriber, SvelteMap } from "svelte/reactivity";
import { pickerChats, pickerIds, type PickerChat } from "./share.adapter";

/**
 * The chats a picker offers to share into (ChatPicker, and the pickers InviteDialog and
 * WalletReceive embed): the user's chats they can send text in (chatsToShareTo), less the one
 * `leaveOut` names, in sections, with each DM's last seen once the picker searches.
 */
export class SharePicker {
    #lastSeen = new SvelteMap<string, string>();
    #lastSeenLoading = false;
    // each listed chat's id as the picker passes it back
    #ids = new Map<string, ChatIdentifier>();

    // the list follows the chats, the favourites, the users (a DM's name) and the open chat. Each
    // store emits on subscribe, which is skipped.
    #subscribe = createSubscriber((update) => {
        const unsubs = [
            serverDirectChatsStore,
            serverGroupChatsStore,
            communitiesStore,
            favouritesStore,
            allUsersStore,
            selectedChatIdStore,
        ].map((store) => {
            let first = true;
            return store.subscribe(() => (first ? (first = false) : update()));
        });
        return () => unsubs.forEach((unsub) => unsub());
    });

    constructor(
        private client: OpenChat,
        private translate: MessageFormatter,
        /** The chat not to offer, read as the list is built (the open one, when sharing from it). */
        private leaveOut: () => ChatIdentifier | undefined,
    ) {}

    /** The picker's list for a search (none: all of them). */
    chats(search = ""): PickerChat[] {
        this.#subscribe();
        const targets = chatsToShareTo(
            this.client,
            {
                directChats: serverDirectChatsStore.value.values(),
                groupChats: serverGroupChatsStore.value.values(),
                communities: communitiesStore.value.values(),
                favourites: favouritesStore.value,
                users: allUsersStore.value,
            },
            this.leaveOut(),
            search,
        );
        const list = pickerChats(targets, {
            sections: {
                favourites: this.translate("communities.favourites"),
                directChats: this.translate("communities.directChats"),
                groupChats: this.translate("communities.groupChats"),
            },
            sub: (chat) =>
                chat.kind === "direct_chat"
                    ? (this.#lastSeen.get(chat.them.userId) ?? "")
                    : chat.description || interpolate(this.translate, groupMembersLine(chat)),
        });
        for (const [id, chatId] of pickerIds(targets)) this.#ids.set(id, chatId);
        return list;
    }

    /**
     * The picker's own search: as `chats`, and the first one loads each DM's last seen, so it's
     * fetched only once a picker is showing (an Invite page that never opens one fetches nothing).
     */
    search(query: string): PickerChat[] {
        if (!this.#lastSeenLoading) {
            this.#lastSeenLoading = true;
            void this.#loadLastSeen();
        }
        return this.chats(query);
    }

    /** The chat the picker passed back. */
    chatId(id: string): ChatIdentifier | undefined {
        return this.#ids.get(id);
    }

    // each DM's last seen ("offline" when it isn't known), written at once so the list is built once
    async #loadLastSeen(): Promise<void> {
        const now = Date.now();
        const offline = this.translate("offline");
        const seen = await Promise.all(
            [...serverDirectChatsStore.value.values()].map(async (chat) => {
                const userId = chat.them.userId;
                try {
                    const ms = await this.client.getLastOnlineDate(userId, now);
                    return [userId, lastOnlineStatus(this.translate, now, ms)[0] || offline];
                } catch {
                    return [userId, offline];
                }
            }),
        );
        for (const [userId, line] of seen) this.#lastSeen.set(userId, line);
    }
}
