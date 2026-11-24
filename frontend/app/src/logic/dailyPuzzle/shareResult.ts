import {
    chatIdentifiersEqual,
    type AttachmentContent,
    type ChatIdentifier,
    type MessageContext,
    type SharedToChat,
} from "@client";
import {
    incomingContent,
    replaceNeedsConfirm,
    type IncomingAttachment,
    type ReplaceQuestion,
} from "@src/logic/composer/replaceStaged";

// Something shared into a chat from outside its conversation (`sharedToChatStore`: a daily
// puzzle result from the puzzle's chat picker), taken into that chat's draft by its conversation.
// The picker asks first in place of a staged payment (`shareStep`), as anything attached in the
// composer does, in its own place over the same backdrop, so the conversation takes only a share
// already agreed to.

/** The drafts a share goes into (`localUpdates.draftMessages`). */
export type SharedDrafts = {
    setAttachment: (key: MessageContext, attachment?: AttachmentContent) => void;
    setTextContent: (key: MessageContext, textContent?: string) => void;
};

/** Whether the share waiting (if any) is for this chat's conversation (not a thread's). */
export function sharedHere(
    shared: SharedToChat | undefined,
    chatId: ChatIdentifier,
    inThread: boolean,
): shared is SharedToChat {
    return shared !== undefined && !inThread && chatIdentifiersEqual(shared.chatId, chatId);
}

/** What a shared attachment is, as the replace confirm words it. */
export function incomingShared(attachment: { kind: string }): IncomingAttachment {
    return attachment.kind === "daily_result" ? "result" : incomingContent(attachment);
}

/** What taking a share into the draft does first: asks in place of a staged payment, or attaches. */
export type ShareStep = { kind: "attach" } | { kind: "confirm"; question: ReplaceQuestion };

export function shareStep(
    staged: { kind: string } | undefined,
    shared: Pick<SharedToChat, "attachment">,
): ShareStep {
    const question = replaceNeedsConfirm(staged, incomingShared(shared.attachment));
    return question === undefined ? { kind: "attach" } : { kind: "confirm", question };
}

/**
 * Takes a share into the draft: its attachment, and its text where it has one (the draft's text is
 * left as it was otherwise). Whether the text was written, so the composer starts again from it.
 */
export function applyShared(
    drafts: SharedDrafts,
    context: MessageContext,
    shared: Pick<SharedToChat, "attachment" | "text">,
): boolean {
    drafts.setAttachment(context, shared.attachment);
    const text = shared.text.trim();
    if (text === "") return false;
    drafts.setTextContent(context, text);
    return true;
}
