import {
    blockedUsersStore,
    currentUserIdStore,
    profileBlock,
    selectedChatBlockedUsersStore,
    selectedChatSummaryStore,
    selectedCommunityBlockedUsersStore,
    selectedCommunitySummaryStore,
    type OpenChat,
    type ProfileBlock,
    type PublicProfile,
    type UserSummary,
} from "@client";
import { reactiveValue } from "@src/utils/reactiveValue";

/**
 * A profile card's user and public profile, loaded as the card opens. `onGone` is called when
 * either can't be loaded, and the card closes. The user id is the one the card opened with, so a
 * card closed while loading never loads another user.
 */
export class ProfileCardData {
    #user = $state<UserSummary>();
    #profile = $state<PublicProfile>();
    // when they were last online (ms), once known
    #lastOnline = $state<number>();
    /** Resolves once the public profile has loaded. */
    readonly loaded: Promise<void>;

    constructor(client: OpenChat, userId: string, onGone: () => void) {
        let resolveLoaded: () => void = () => undefined;
        this.loaded = new Promise((resolve) => (resolveLoaded = resolve));
        void this.#load(client, userId, onGone, resolveLoaded);
    }

    get user(): UserSummary | undefined {
        return this.#user;
    }

    get profile(): PublicProfile | undefined {
        return this.#profile;
    }

    get lastOnline(): number | undefined {
        return this.#lastOnline;
    }

    async #loadLastOnline(client: OpenChat, userId: string) {
        try {
            this.#lastOnline = await client.getLastOnlineDate(userId, Date.now());
        } catch (e) {
            console.log("Failed to load when the user was last online", e);
        }
    }

    async #load(client: OpenChat, userId: string, onGone: () => void, loaded: () => void) {
        try {
            this.#user = await client.getUser(userId);
        } catch (e) {
            client.logError("Failed to load user profile", e);
            onGone();
            return;
        }
        void this.#loadLastOnline(client, userId);
        client.getPublicProfile(userId).subscribe({
            onResult: (profile) => {
                this.#profile = profile;
                if (profile === undefined) {
                    onGone();
                } else {
                    loaded();
                }
            },
        });
    }
}

/**
 * What a profile card offers to block or unblock (`profileBlock`), from the selected chat and
 * community and their blocked lists, following them as they change.
 */
export class ProfileCardBlock {
    #me = reactiveValue(currentUserIdStore);
    #chat = reactiveValue(selectedChatSummaryStore);
    #community = reactiveValue(selectedCommunitySummaryStore);
    #blockedUsers = reactiveValue(blockedUsersStore);
    #blockedChatUsers = reactiveValue(selectedChatBlockedUsersStore);
    #blockedCommunityUsers = reactiveValue(selectedCommunityBlockedUsersStore);

    constructor(
        private client: OpenChat,
        private userId: string,
        private inGlobalContext: boolean,
    ) {}

    get current(): ProfileBlock {
        return profileBlock({
            userId: this.userId,
            isMe: this.userId === this.#me(),
            inGlobalContext: this.inGlobalContext,
            chat: this.#chat(),
            community: this.#community(),
            blockedUsers: this.#blockedUsers(),
            blockedChatUsers: this.#blockedChatUsers(),
            blockedCommunityUsers: this.#blockedCommunityUsers(),
            canBlockUsers: (id) => this.client.canBlockUsers(id),
        });
    }
}
