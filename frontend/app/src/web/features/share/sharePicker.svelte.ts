import {
    allUsersStore,
    communitiesStore,
    favouritesStore,
    groupMembersLine,
    lastOnlineStatus,
    selectedChatIdStore,
    serverDirectChatsStore,
    serverGroupChatsStore,
    shareTargets,
    type ChatIdentifier,
    type ChatSummary,
    type CommunitySummary,
    type MessageFormatter,
    type OpenChat,
    type ShareTargets,
} from "@client";
import { interpolate } from "@src/i18n/i18n";
import { buildDisplayName } from "@src/utils/user";
import { SvelteMap } from "svelte/reactivity";
import { pickedChat, pickerChats, type PickerChat } from "./share.adapter";

/**
 * The chats a picker offers to share into (ChatPicker, and the pickers InviteDialog and
 * WalletReceive embed): the user's chats they can send text in (@client shareTargets), the open one
 * left out unless `excludeCurrent` is off, in sections, with each DM's last seen as it loads.
 */
export class SharePicker {
    #lastSeen = new SvelteMap<string, string>();

    constructor(
        private client: OpenChat,
        private translate: MessageFormatter,
        private excludeCurrent = true,
    ) {}

    /** Loads each DM's last seen (its line in the list), "offline" when it isn't known. */
    loadLastSeen(): void {
        const now = Date.now();
        for (const chat of serverDirectChatsStore.value.values()) {
            const userId = chat.them.userId;
            this.client
                .getLastOnlineDate(userId, now)
                .then((ms) =>
                    this.#lastSeen.set(
                        userId,
                        lastOnlineStatus(this.translate, now, ms)[0] || this.translate("offline"),
                    ),
                )
                .catch(() => this.#lastSeen.set(userId, this.translate("offline")));
        }
    }

    #targets(search: string): ShareTargets {
        const users = allUsersStore.value;
        const favourites = favouritesStore.value;
        return shareTargets<ChatSummary, CommunitySummary>({
            directChats: [...serverDirectChatsStore.value.values()],
            groupChats: [...serverGroupChatsStore.value.values()],
            communities: [...communitiesStore.value.values()],
            isFavourite: (id) => favourites.has(id),
            directChatName: (userId) => ({
                name: buildDisplayName(users, userId, "user"),
                username: users.get(userId)?.username,
            }),
            canSendText: (id) => this.client.canSendMessage(id, "message", "text"),
            selectedChatId: selectedChatIdStore.value,
            excludeCurrent: this.excludeCurrent,
            search,
        });
    }

    /** The picker's list for a search (none: all of them). */
    chats(search = ""): PickerChat[] {
        return pickerChats(this.#targets(search), {
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
    }

    /** The chat the picker passed back. */
    chatId(id: string): ChatIdentifier | undefined {
        return pickedChat(this.#targets(""), id);
    }
}
