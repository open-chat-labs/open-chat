import {
    disappearingMessagesUpdate,
    type DirectChatSummary,
    type MessageFormatter,
    type OpenChat,
} from "@client";
import type { DisappearSetting } from "@openchat/ui/src/features/components/DmChatSettings.svelte";
import { muteChat } from "@src/logic/chats/muteChat";

// A DM's own settings, which DmPanel and the user card's "This chat" tab both change: mute,
// favourite and disappearing messages. Each rejects when the change fails, so the component rolls
// the field back and shows its own error.

function succeeded(success: boolean) {
    if (!success) throw new Error("not saved");
}

export async function muteDm(
    client: OpenChat,
    chat: DirectChatSummary,
    mute: boolean,
    formatter: MessageFormatter,
) {
    succeeded((await muteChat(client, chat.id, mute, undefined, formatter)) === undefined);
}

export async function favouriteDm(client: OpenChat, chat: DirectChatSummary, favourite: boolean) {
    succeeded(
        await (favourite ? client.addToFavourites(chat.id) : client.removeFromFavourites(chat.id)),
    );
}

export async function setDmDisappearing(
    client: OpenChat,
    chat: DirectChatSummary,
    setting: DisappearSetting,
) {
    succeeded(
        await client.updateDirectChatSettings(
            chat,
            disappearingMessagesUpdate(setting.on, setting.afterMs, chat.eventsTTL),
        ),
    );
}
