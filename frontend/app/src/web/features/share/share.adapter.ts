import { AVATAR_GRADIENTS } from "@openchat/ui/src/lib/components/Avatar.svelte";
import {
    chatIdentifierToString,
    type ChatIdentifier,
    type ShareableChat,
    type ShareableCommunity,
    type ShareTarget,
    type ShareTargets,
} from "@client";
import { swatchFor } from "@src/logic/chats/chatRow";
import { shareTargetsInSections, type ShareSectionNames } from "@src/logic/share/chatsToShareTo";

// The chat picker's list (ChatPicker) from the chats something can be shared to (@client
// shareTargets): sections, each chat's line and its avatar.

/** A chat as ChatPicker lists it. */
export type PickerChat = {
    id: string;
    name: string;
    sub?: string;
    group?: string;
    grad: string;
    radius?: string;
};

export type PickerChatText<C extends ShareableChat> = {
    /** The sections' headers, translated (the picker shows text outside its own keys as given). */
    sections: ShareSectionNames;
    /** A chat's line under its name: a DM's last seen, a group's description or size. */
    sub: (chat: C) => string;
};

/**
 * The picker's list, in sections as every picker shows them (`shareTargetsInSections`). Each
 * chat's id is its identifier as a string (pickerIds maps it back), and its face the swatch the
 * chat list gives it (swatchFor: the list shows no uploaded avatars either).
 */
export function pickerChats<C extends ShareableChat, M extends ShareableCommunity<C>>(
    targets: ShareTargets<C, M>,
    text: PickerChatText<C>,
): PickerChat[] {
    const chat = (t: ShareTarget<C>, group: string): PickerChat => ({
        id: chatIdentifierToString(t.chat.id),
        name: t.name,
        sub: text.sub(t.chat),
        group,
        grad: AVATAR_GRADIENTS[swatchFor(chatIdentifierToString(t.chat.id))],
        radius: t.chat.kind === "direct_chat" ? "50%" : "10px",
    });
    return shareTargetsInSections(targets, text.sections).map(({ target, section }) =>
        chat(target, section),
    );
}

/** Each listed chat's id as the picker passes it back, to its identifier. */
export function pickerIds<C extends ShareableChat, M extends ShareableCommunity<C>>(
    targets: ShareTargets<C, M>,
): Map<string, ChatIdentifier> {
    const all = [
        ...targets.favourites,
        ...targets.directChats,
        ...targets.groupChats,
        ...targets.communities.flatMap((c) => c.channels),
    ];
    return new Map(all.map((t) => [chatIdentifierToString(t.chat.id), t.chat.id]));
}

/** What sharing a link (an invite) to a chat sends: the user's message, then the link on its own line. */
export function sharedLinkText(message: string, link: string): string {
    return message.trim() === "" ? link : `${message.trim()}\n${link}`;
}
