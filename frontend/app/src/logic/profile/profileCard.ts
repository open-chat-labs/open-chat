import type { DirectChatIdentifier, UserSummary } from "@client";
import type { ProfileLinkClickedEvent } from "@webcomponents/profileLink";

// A <profile-link> click opens the user's profile card (UserDialog in the web UI), every tree alike.

export type ProfileCard = ProfileLinkClickedEvent;

/** The card a profile link click shows, or nothing for a bot. `user` is the clicked user, if loaded. */
export function profileCard(
    clicked: ProfileLinkClickedEvent,
    user: UserSummary | undefined,
): ProfileCard | undefined {
    if (user?.kind === "bot") return undefined;
    return {
        userId: clicked.userId,
        chatButton: clicked.chatButton,
        inGlobalContext: clicked.inGlobalContext,
    };
}

/** The DM the card's Chat button asks for (the view publishes it as `chatWith` and closes the card). */
export function profileCardChat(card: ProfileCard): DirectChatIdentifier {
    return { kind: "direct_chat", userId: card.userId };
}
