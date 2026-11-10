import { candidateGroupFromChat, type MultiUserChat, type OpenChat } from "@client";

// A group's or channel's disappearing messages, which the native details switch on and off and
// set the length of (for those its settings let change them: `canChangeDisappearing`), as a DM's
// are (`dmSettings`). Only the TTL is sent: the group as it is with the new TTL, through the
// client's updateGroup (which sends only what differs, so the rules it's given don't matter), and
// it shows the change once it's saved.

/**
 * Switches the chat's disappearing messages on (for `afterMs`) or off. Rejects when it isn't
 * saved, so the view rolls the field back and says so.
 */
export async function setGroupDisappearing(
    client: Pick<OpenChat, "updateGroup">,
    chat: MultiUserChat,
    setting: { on: boolean; afterMs: number },
): Promise<void> {
    const original = candidateGroupFromChat(chat, undefined);
    const eventsTTL = setting.on ? BigInt(setting.afterMs) : undefined;
    const outcome = await client.updateGroup(original, { ...original, eventsTTL });
    if (outcome.kind !== "success" && outcome.kind !== "unchanged") {
        throw new Error(`not saved: ${outcome.kind}`);
    }
}
