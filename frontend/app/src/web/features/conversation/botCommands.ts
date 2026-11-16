import type { ComposerAttachKind } from "@openchat/ui/src/lib/types";

// The built-in bot's commands this tree carries out. The client runs each by publishing what the
// old trees open for it (`executeInternalBotCommand`); here, those that post on their own (the
// Diamond link, an FAQ), a poll and a transfer where the "+" menu offers them (their builders),
// and registering a webhook (its dialog). The others aren't offered: /gif (the GIF picker is the
// composer's own), /search (no search in the conversation yet), and the bot developers' and the
// seasonal ones (/register_bot, /update_bot, /remove_bot, /witch, /test-msg), whose screens the
// new web UI doesn't have (GAPS, "Bot commands").
const POSTS_ITSELF = ["diamond", "faq"];
const BUILDERS: Partial<Record<string, ComposerAttachKind>> = { poll: "poll", crypto: "crypto" };

/** Whether the new web UI carries out a built-in command, given what the "+" menu offers here. */
export function carriesOutCommand(
    name: string,
    attachKinds: readonly ComposerAttachKind[],
): boolean {
    if (POSTS_ITSELF.includes(name) || name === "register_webhook") return true;
    const builder = BUILDERS[name];
    return builder !== undefined && attachKinds.includes(builder);
}
