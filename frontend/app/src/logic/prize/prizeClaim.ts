import {
    isTrustedClick,
    type MultiUserChatIdentifier,
    type OpenChat,
    type ResourceKey,
} from "@client";
import type { HumanCheck } from "./humanCheck.svelte";

/**
 * Claims a prize from the reader's click, with the token of the prize's human check (waiting for
 * it if the check is still running). A check that fails still claims, without a token, for the
 * backend to refuse once it requires one. What to tell the reader, if anything: a script's click
 * claims nothing and says nothing, and takes no token.
 */
export async function claimPrizeWithHumanCheck(
    client: Pick<OpenChat, "claimPrize">,
    check: HumanCheck,
    chatId: MultiUserChatIdentifier,
    messageId: bigint,
    e: MouseEvent,
): Promise<ResourceKey | undefined> {
    if (!isTrustedClick(e)) return undefined;

    const token = await check.take();
    const outcome = await client.claimPrize(chatId, messageId, e, token);
    return outcome.kind === "success" ? undefined : outcome.message;
}
