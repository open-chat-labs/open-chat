import { type ChatListScope, type CommunityIdentifier } from "openchat-shared";
import { CommunityState } from "./community.svelte";

/**
 * AppState is basically all data that comes from the backend
 */
class AppState {
    #selectedCommunity = $state<CommunityState | undefined>();

    // TODO - this *should* be derived from the route and the chats data but we can't do that until we have the relevant state migrated
    // until then we have to have a parallel system of runes and stores that we keep in sync manually
    #chatListScope = $state<ChatListScope>({ kind: "none" });

    #selectedCommunityId = $derived.by<CommunityIdentifier | undefined>(() => {
        switch (this.#chatListScope.kind) {
            case "community":
                return this.#chatListScope.id;
            case "favourite":
                return this.#chatListScope.communityId;
            default:
                return undefined;
        }
    });

    set chatListScope(scope: ChatListScope) {
        this.#chatListScope = scope;
    }

    get selectedCommunityId() {
        return this.#selectedCommunityId;
    }
}

export const app = new AppState();
