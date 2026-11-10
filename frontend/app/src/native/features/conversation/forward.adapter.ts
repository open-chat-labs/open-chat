import {
    chatIdentifierToString,
    type ChatIdentifier,
    type ShareableChat,
    type ShareableCommunity,
    type ShareTargets,
} from "@client";
import { swatchFor, type Swatch } from "@src/logic/chats/chatRow";
import { shareTargetsInSections, type ShareSectionNames } from "@src/logic/share/chatsToShareTo";

// The forward sheet's rows (native design notes §3.3): the chats a message can be forwarded to
// (`chatsToShareTo`), in the sections every picker lists them in.

export type ForwardRow = {
    /** The chat's identifier as a string: what's picked, the same in every section it's listed in. */
    id: string;
    chatId: ChatIdentifier;
    name: string;
    /** The line under its name: a DM's @username, a group's description or size. */
    sub: string;
    /** The header of its section, which starts where the one before it is another. */
    section: string;
    color: Swatch;
    /** A DM's face is round; a group's or channel's a rounded square. */
    round: boolean;
};

export function forwardRows<C extends ShareableChat, M extends ShareableCommunity<C>>(
    targets: ShareTargets<C, M>,
    sections: ShareSectionNames,
    /** A group's or channel's line under its name. */
    groupLine: (chat: C) => string,
): ForwardRow[] {
    return shareTargetsInSections(targets, sections).map(({ target, section }) => {
        const chat = target.chat;
        const id = chatIdentifierToString(chat.id);
        const direct = chat.kind === "direct_chat";
        return {
            id,
            chatId: chat.id,
            name: target.name,
            sub: direct
                ? target.username === undefined
                    ? ""
                    : `@${target.username}`
                : groupLine(chat),
            section,
            color: swatchFor(id),
            round: direct,
        };
    });
}
