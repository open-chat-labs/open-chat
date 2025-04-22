import {
    type ChatIdentifier,
    type CommunityIdentifier,
    type DirectChatIdentifier,
    type ExternalBotPermissions,
    type IdentityState,
    type Member,
    type MessageContext,
    type PublicApiKeyDetails,
    type UserGroupDetails,
    type VersionedRules,
    chatIdentifiersEqual,
    chatListScopesEqual,
    communityIdentifiersEqual,
    messageContextsEqual,
} from "openchat-shared";
import { ChatDetailsMergedState } from "./chat_details";
import { ChatDetailsServerState } from "./chat_details/server";
import { CommunityMergedState } from "./community_details/merged.svelte";
import { CommunityServerState } from "./community_details/server";
import { pathState } from "./path.svelte";
import { withEqCheck } from "./reactivity.svelte";

class AppState {
    constructor() {
        $effect.root(() => {
            $effect(() => {
                if (this.#selectedCommunityId === undefined) {
                    this.#selectedCommunity = new CommunityMergedState(
                        CommunityServerState.empty(),
                    );
                }
            });

            $effect(() => {
                if (this.#selectedChatId === undefined) {
                    console.log("SelectedChatId is undefined - clear state");
                    this.#selectedChat = new ChatDetailsMergedState(ChatDetailsServerState.empty());
                }
            });
        });
    }

    #identityState = $state<IdentityState>({ kind: "loading_user" });

    #chatsInitialised = $state(false);

    // TODO - this does not seem to be working as intended - investigate why
    #chatListScope = $derived.by(withEqCheck(() => pathState.route.scope, chatListScopesEqual));

    // TODO - not sure this currently works with *starting* threads
    // I feel uneasy about this as a *concept* because if I have a chat open *and* a thread open then there are two
    // selected message contexts. So this is at best misleading and at worst meaningless.
    #selectedMessageContext = $derived.by<MessageContext | undefined>(
        withEqCheck(() => {
            switch (pathState.route.kind) {
                case "selected_channel_route":
                case "global_chat_selected_route":
                    return {
                        chatId: pathState.route.chatId,
                        threadRootMessageIndex: pathState.route.open
                            ? pathState.route.messageIndex
                            : undefined,
                    };
                default:
                    return undefined;
            }
        }, messageContextsEqual),
    );

    #selectedChatId = $derived.by<ChatIdentifier | undefined>(
        withEqCheck(() => this.#selectedMessageContext?.chatId, chatIdentifiersEqual),
    );

    #selectedCommunityId = $derived.by<CommunityIdentifier | undefined>(
        withEqCheck(() => {
            switch (pathState.route.scope.kind) {
                case "community":
                    return pathState.route.scope.id;
                case "favourite":
                    return pathState.route.scope.communityId;
                default:
                    return undefined;
            }
        }, communityIdentifiersEqual),
    );

    #selectedCommunity = $state<CommunityMergedState>(
        new CommunityMergedState(CommunityServerState.empty()),
    );

    #selectedChat = $state<ChatDetailsMergedState>(
        new ChatDetailsMergedState(ChatDetailsServerState.empty()),
    );

    get identityState(): Readonly<IdentityState> {
        return this.#identityState;
    }

    updateIdentityState(fn: (prev: IdentityState) => IdentityState) {
        this.#identityState = fn(this.#identityState);
    }

    get chatsInitialised() {
        return this.#chatsInitialised;
    }

    get chatListScope() {
        return this.#chatListScope;
    }

    set chatsInitialised(val: boolean) {
        this.#chatsInitialised = val;
    }

    get selectedCommunityId() {
        return this.#selectedCommunityId;
    }

    get selectedChatId() {
        return this.#selectedChatId;
    }

    get selectedMessageContext() {
        return this.#selectedMessageContext;
    }

    get selectedCommunity() {
        return this.#selectedCommunity;
    }

    get selectedChat() {
        return this.#selectedChat;
    }

    setDirectChatDetails(chatId: DirectChatIdentifier, currentUserId: string) {
        const serverState = ChatDetailsServerState.empty(chatId);
        if (chatIdentifiersEqual(chatId, this.#selectedChat.chatId)) {
            this.#selectedChat.overwriteServerState(serverState);
        } else {
            this.#selectedChat = new ChatDetailsMergedState(serverState);
        }
        this.#selectedChat.addUserIds([currentUserId]);
    }

    setChatDetailsFromServer(
        chatId: ChatIdentifier,
        members: Map<string, Member>,
        lapsedMembers: Set<string>,
        blockedUsers: Set<string>,
        invitedUsers: Set<string>,
        pinnedMessages: Set<number>,
        rules: VersionedRules,
        bots: Map<string, ExternalBotPermissions>,
        apiKeys: Map<string, PublicApiKeyDetails>,
    ) {
        const serverState = new ChatDetailsServerState(
            chatId,
            members,
            lapsedMembers,
            blockedUsers,
            invitedUsers,
            pinnedMessages,
            rules,
            bots,
            apiKeys,
        );

        // if the chatId is still the same just overwrite the server state, otherwise splat the whole thing
        if (chatIdentifiersEqual(chatId, this.#selectedChat.chatId)) {
            this.#selectedChat.overwriteServerState(serverState);
        } else {
            this.#selectedChat = new ChatDetailsMergedState(serverState);
        }
    }

    setCommunityDetailsFromServer(
        communityId: CommunityIdentifier,
        userGroups: Map<number, UserGroupDetails>,
        members: Map<string, Member>,
        blockedUsers: Set<string>,
        lapsedMembers: Set<string>,
        invitedUsers: Set<string>,
        referrals: Set<string>,
        bots: Map<string, ExternalBotPermissions>,
        apiKeys: Map<string, PublicApiKeyDetails>,
        rules?: VersionedRules,
    ) {
        const serverState = new CommunityServerState(
            communityId,
            userGroups,
            members,
            blockedUsers,
            lapsedMembers,
            invitedUsers,
            referrals,
            bots,
            apiKeys,
            rules,
        );
        if (communityIdentifiersEqual(communityId, this.#selectedCommunity.communityId)) {
            this.#selectedCommunity.overwriteServerState(serverState);
        } else {
            this.#selectedCommunity = new CommunityMergedState(serverState);
        }
    }
}

export const app = new AppState();
