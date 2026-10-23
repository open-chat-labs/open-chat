import type { OpenChat, PublicProfile, UserSummary } from "@client";

/**
 * A profile card's user and public profile, loaded as the card opens. `onGone` is called when
 * either can't be loaded, and the card closes. The user id is the one the card opened with, so a
 * card closed while loading never loads another user.
 */
export class ProfileCardData {
    #user = $state<UserSummary>();
    #profile = $state<PublicProfile>();
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

    async #load(client: OpenChat, userId: string, onGone: () => void, loaded: () => void) {
        try {
            this.#user = await client.getUser(userId);
        } catch (e) {
            client.logError("Failed to load user profile", e);
            onGone();
            return;
        }
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
