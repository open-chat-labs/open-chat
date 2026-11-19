import {
    filePermission,
    type AttachFileOutcome,
    type MessageContext,
    type OpenChat,
    type ResourceKey,
} from "@client";
import { i18nKey } from "@src/i18n/i18n";
import type { ComposerBuilder } from "./composer";

// Whether something attached to the draft in place of what's staged asks first: a prize, a
// transfer or a swap offer holds what the user set up in its builder (amounts, winners, a
// duration), too costly to lose to a stray click, so anything replacing one asks (the user's
// decision, 2026-11-19). A photo, video, file or GIF is replaced without asking, as before.
// Every way something is attached in the web composer goes through `replaceNeedsConfirm`: the "+"
// menu's photo / video and file, a file dropped or pasted, a GIF picked, and another builder.

/** A builder's content staged as the draft's attachment, which is asked about before it goes. */
export type StagedBuilder = "prize" | "transfer" | "swap";

/** What's about to take the staged attachment's place. */
export type IncomingAttachment = "photo" | "video" | "file" | "gif" | StagedBuilder;

/** The builder whose content the draft's attachment is, if it's one. */
export function stagedBuilder(attachment: { kind: string } | undefined): StagedBuilder | undefined {
    switch (attachment?.kind) {
        case "prize_content_initial":
            return "prize";
        case "crypto_content":
            return "transfer";
        case "p2p_swap_content_initial":
            return "swap";
        default:
            return undefined;
    }
}

/** A file picked, dropped or pasted, from its type (an audio file is a file). */
export function incomingFile(mimeType: string): IncomingAttachment {
    switch (filePermission(mimeType)) {
        case "image":
            return "photo";
        case "video":
            return "video";
        default:
            return "file";
    }
}

/**
 * What a builder picked from the "+" menu would attach, if anything: a poll and a meme are sent as
 * they're made, leaving the draft's attachment as it is.
 */
export function incomingBuilder(builder: ComposerBuilder): IncomingAttachment | undefined {
    switch (builder) {
        case "prize":
            return "prize";
        case "crypto":
            return "transfer";
        case "swap":
            return "swap";
        case "poll":
        case "memeFighter":
            return undefined;
    }
}

/** A replacement to ask about: what's staged, and what would take its place. */
export type ReplaceQuestion = { staged: StagedBuilder; incoming: IncomingAttachment };

/**
 * Whether attaching `incoming` in place of the draft's attachment (`staged`) asks first: only when
 * what's staged is a builder's content. The question, if so.
 */
export function replaceNeedsConfirm(
    staged: { kind: string } | undefined,
    incoming: IncomingAttachment,
): ReplaceQuestion | undefined {
    const builder = stagedBuilder(staged);
    return builder === undefined ? undefined : { staged: builder, incoming };
}

/** What a file picked, dropped or pasted does first: refused, asked about, or attached. */
export type FileAttachStep =
    | { kind: "refused"; refusal: Extract<AttachFileOutcome, { kind: "not_permitted" }> }
    | { kind: "confirm"; question: ReplaceQuestion }
    | { kind: "attach" };

/**
 * A file picked, dropped or pasted: one the chat or thread (`context`) doesn't take, from its type
 * (as the client's `attachFile` checks first), is refused without asking, leaving what's staged;
 * one it takes asks first in place of a builder's content (`replaceNeedsConfirm`), before it's
 * prepared (a video's transcode takes a while). Whether what it's made into is permitted too is
 * still the client's to check as it attaches.
 */
export function fileAttachStep(
    client: Pick<OpenChat, "canSendMessage">,
    context: MessageContext,
    mimeType: string,
    staged: { kind: string } | undefined,
): FileAttachStep {
    const permission = filePermission(mimeType);
    const mode = context.threadRootMessageIndex === undefined ? "message" : "thread";
    if (!client.canSendMessage(context.chatId, mode, permission)) {
        return { kind: "refused", refusal: { kind: "not_permitted", permission } };
    }
    const question = replaceNeedsConfirm(staged, incomingFile(mimeType));
    return question === undefined ? { kind: "attach" } : { kind: "confirm", question };
}

/** The confirm's words: what's staged as its title, what takes its place as its message. */
export function replaceQuestionText(question: ReplaceQuestion): {
    title: ResourceKey;
    message: ResourceKey;
} {
    return {
        title: i18nKey(`builders.replace.title.${question.staged}`),
        message: i18nKey(`builders.replace.with.${question.incoming}`),
    };
}
