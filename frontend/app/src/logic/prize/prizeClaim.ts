import {
    isTrustedClick,
    type MultiUserChatIdentifier,
    type OpenChat,
    type ResourceKey,
} from "@client";
import { claimsStore } from "@src/stores/claims";
import type { HumanCheck } from "./humanCheck.svelte";

/**
 * Claims a prize from the reader's click, running the prize's human check and claiming with its
 * token. A check that fails still claims, without a token, for the backend to refuse once it
 * requires one. The prize is in claimsStore while its claim is in flight, and another click then
 * claims nothing. What to tell the reader, if anything: a script's click claims nothing and says
 * nothing, and doesn't start the check.
 */
export async function claimPrizeWithHumanCheck(
    client: Pick<OpenChat, "claimPrize">,
    check: HumanCheck,
    chatId: MultiUserChatIdentifier,
    messageId: bigint,
    e: MouseEvent,
): Promise<ResourceKey | undefined> {
    if (!isTrustedClick(e) || !claimsStore.add(messageId)) return undefined;

    try {
        const pass = await check.take();
        const outcome = await client.claimPrize(chatId, messageId, e, pass);
        return outcome.kind === "success" ? undefined : outcome.message;
    } finally {
        claimsStore.delete(messageId);
    }
}
