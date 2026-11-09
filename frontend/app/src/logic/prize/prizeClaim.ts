import {
    isTrustedClick,
    type MultiUserChatIdentifier,
    type OpenChat,
    type ResourceKey,
} from "@client";
import { claimsStore } from "@src/stores/claims";

/**
 * Claims a prize from the reader's click. The prize is in claimsStore while its claim is in
 * flight, and another click then claims nothing. What to tell the reader, if anything: a script's
 * click claims nothing and says nothing.
 */
export async function claimPrizeFromClick(
    client: Pick<OpenChat, "claimPrize">,
    chatId: MultiUserChatIdentifier,
    messageId: bigint,
    e: MouseEvent,
): Promise<ResourceKey | undefined> {
    if (!isTrustedClick(e) || !claimsStore.add(messageId)) return undefined;

    try {
        const outcome = await client.claimPrize(chatId, messageId, e);
        return outcome.kind === "success" ? undefined : outcome.message;
    } finally {
        claimsStore.delete(messageId);
    }
}
