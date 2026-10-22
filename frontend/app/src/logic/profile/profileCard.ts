import type { DirectChatIdentifier, UserSummary } from "@client";
import type { ProfileLinkClickedEvent } from "@webcomponents/profileLink";

// A user's profile card, opened by a name clicked in a message (`<profile-link>`): one card at a
// time, in every tree.

/** The card a clicked name asks for. */
export type ProfileCard = {
    userId: string;
    // what the link allows: a Chat button, and the user's global profile rather than the chat's
    chatButton: boolean;
    inGlobalContext: boolean;
};

/** The card for a `profile-clicked` event. */
export function profileCard(event: ProfileLinkClickedEvent): ProfileCard {
    return {
        userId: event.userId,
        chatButton: event.chatButton,
        inGlobalContext: event.inGlobalContext,
    };
}

/**
 * Whether the card shows for its user, as far as the user is known yet: a bot has no card. Checked
 * as the user loads, so a card for a user who turns out to be a bot closes.
 */
export function profileCardShows(user: UserSummary | undefined): boolean {
    return user?.kind !== "bot";
}

/** The chat the card's Chat button opens (`chatWith`): a DM with its user. */
export function profileCardChat(card: ProfileCard): DirectChatIdentifier {
    return { kind: "direct_chat", userId: card.userId };
}
