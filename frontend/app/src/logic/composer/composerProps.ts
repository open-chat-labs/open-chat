import {
    formatFileSize,
    mentionCandidateKey,
    mentionName,
    type AttachmentContent,
    type EnhancedReplyContext,
    type EventWrapper,
    type Message,
    type UserOrUserGroup,
    type UserSummary,
} from "@client";
import type {
    ComposerAttachment,
    ComposerContext,
    ComposerMention,
} from "@openchat/ui/src/lib/types";
import { messageText, type ConversationContext } from "@src/logic/conversation/messageRow";

// The composer's props as every tree's composer (MessageComposer) takes them: the text it starts
// from, the reply or edit strip, the staged attachment and who it offers to mention.

/**
 * The text the composer starts from when it mounts (`MessageComposer`'s `text`): the chat's draft,
 * or mid-edit what was being written before the edit (the edited message's text comes in the
 * strip, and the composer goes back to this when the edit ends).
 */
export function composerStartText(
    draft:
        | {
              editingEvent?: EventWrapper<Message>;
              textContent?: string;
              beforeEdit?: { textContent?: string };
          }
        | undefined,
): string {
    if (draft?.editingEvent !== undefined) return draft.beforeEdit?.textContent ?? "";
    return draft?.textContent ?? "";
}

/**
 * The composer's strip for the chat's draft: the message being edited (with `editText`, the text
 * it starts from: logic/composer's `editStartText`), else the one being replied to, with who
 * wrote it.
 */
export function composerContext(
    draft:
        | {
              editingEvent?: EventWrapper<Message>;
              replyingTo?: EnhancedReplyContext;
          }
        | undefined,
    ctx: Pick<ConversationContext, "me" | "you" | "userName" | "contentText">,
    editText: string | undefined,
): ComposerContext | null {
    const editing = draft?.editingEvent;
    if (editing !== undefined) {
        return {
            key: `edit:${editing.event.messageId}`,
            mode: "edit",
            quote: messageText(editing.event.content, ctx),
            text: editText ?? "",
        };
    }
    const reply = draft?.replyingTo;
    if (reply === undefined) return null;
    return {
        key: `reply:${reply.messageId}`,
        mode: "reply",
        name: reply.senderId === ctx.me ? ctx.you : ctx.userName(reply.senderId),
        quote: messageText(reply.content, ctx),
    };
}

/**
 * The draft's attachment as the composer stages it: a photo, video or GIF in its media tray, a
 * file or audio clip as a chip. None for what the composer doesn't show yet (5d's prize, transfer
 * and swap offer, a puzzle result), which isn't sent with the text either.
 */
export function composerAttachment(
    content: AttachmentContent | undefined,
    ctx: Pick<ConversationContext, "contentText">,
): ComposerAttachment | null {
    switch (content?.kind) {
        case "image_content":
            return {
                type: "media",
                items: [{ kind: "image", src: content.blobUrl ?? content.thumbnailData }],
            };
        case "giphy_content":
            // the desktop rendition is a video; the tray shows the GIF image
            return { type: "media", items: [{ kind: "image", src: content.mobile.url }] };
        case "video_content":
            // the tray shows the clip's first frame
            return { type: "media", items: [{ kind: "video", src: content.videoData.blobUrl }] };
        case "file_content":
            return { type: "file", title: content.name, summary: formatFileSize(content.fileSize) };
        case "audio_content":
            return {
                type: "file",
                title: ctx.contentText(content),
                summary: formatFileSize(content.blobData?.byteLength ?? 0),
            };
        // TODO(phase 5, 5d): the "+" builders' contents
        default:
            return null;
    }
}

/**
 * Someone (or a group, or everyone) the composer offers to mention: `mentionCandidates`' order,
 * picked as `@` and the name typed to mention them (`mentionName`), shown by their display name.
 */
export function composerMention(
    candidate: UserOrUserGroup,
    avatarUrl: (user: UserSummary) => string | undefined,
): ComposerMention {
    const handle = mentionName(candidate);
    switch (candidate.kind) {
        case "user_group":
        case "everyone":
            return { key: mentionCandidateKey(candidate), handle, name: handle, group: true };
        default:
            return {
                key: mentionCandidateKey(candidate),
                handle,
                name: candidate.displayName ?? candidate.username,
                avatar: avatarUrl(candidate),
            };
    }
}
