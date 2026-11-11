import {
    chatIdentifierToString,
    type ChatIdentifier,
    type ChatSummary,
    type EventWrapper,
    type Message,
    type ThreadPreview,
} from "@client";
import { AVATAR_GRADIENTS } from "@openchat/ui/src/lib/components/Avatar.svelte";
import type ThreadList from "@openchat/ui/src/features/components/ThreadList.svelte";
import type ThreadPanel from "@openchat/ui/src/features/components/ThreadPanel.svelte";
import { swatchFor } from "@src/logic/chats/chatRow";
import type { ComponentProps } from "svelte";
import { senderColor, type ConversationContext } from "@src/logic/conversation/messageRow";

// The thread panel's summary of the open thread, and the list of threads, as the library's
// ThreadPanel and ThreadList take them.

/** What the thread panel says about the thread above its replies. */
export type ThreadSummaryProps = Pick<
    ComponentProps<typeof ThreadPanel>,
    "root" | "faces" | "replyCount"
>;

/**
 * The thread's root as the panel's card shows it (who wrote it, its text with its mentions as the
 * @names typed, when), the colours of those in the thread, and how many replies it has.
 */
export function threadSummaryProps(
    root: EventWrapper<Message>,
    ctx: Pick<ConversationContext, "userName" | "contentText" | "mentionsAsTyped" | "date">,
): ThreadSummaryProps {
    const msg = root.event;
    return {
        root: {
            author: ctx.userName(msg.sender),
            color: senderColor(msg.sender),
            text: ctx.mentionsAsTyped(ctx.contentText(msg.content)),
            time: ctx.date(root.timestamp),
        },
        faces: [...(msg.thread?.participantIds ?? [])].map(senderColor),
        replyCount: msg.thread?.numberOfReplies ?? 0,
    };
}

type ThreadListGroup = ComponentProps<typeof ThreadList>["groups"][number];

/** What the list of threads needs to know about each thread, and the chats they're in. */
export type ThreadListContext = Pick<
    ConversationContext,
    "userName" | "contentText" | "mentionsAsTyped" | "date"
> & {
    chat: (chatId: ChatIdentifier) => ChatSummary | undefined;
    /** "N replies", in the app's language. */
    replies: (count: number) => string;
    /** The thread's replies the reader hasn't read (none for a thread they don't follow). */
    unread: (thread: ThreadPreview) => number;
    /** Whether it's the thread open in the right column. */
    selected: (thread: ThreadPreview) => boolean;
    open: (thread: ThreadPreview) => void;
};

// a group's or channel's mark: the design's rounded square
const CHAT_RADIUS = "11px";

/**
 * The followed threads, a group per chat in the order their threads come (`client.threadPreviews`
 * orders them), each thread its root (who wrote it, when, its text with its mentions as the @names
 * typed) with its reply count and unread replies. A thread whose chat isn't in the list (left
 * since) isn't shown.
 */
export function threadListGroups(
    threads: ThreadPreview[],
    ctx: ThreadListContext,
): ThreadListGroup[] {
    const groups = new Map<string, ThreadListGroup>();
    for (const thread of threads) {
        const chat = ctx.chat(thread.chatId);
        if (chat === undefined || chat.kind === "direct_chat") continue;
        const key = chatIdentifierToString(chat.id);
        let group = groups.get(key);
        if (group === undefined) {
            group = {
                name: chat.name,
                grad: AVATAR_GRADIENTS[swatchFor(key)],
                radius: CHAT_RADIUS,
                threads: [],
            };
            groups.set(key, group);
        }
        const root = thread.rootMessage;
        const unread = ctx.unread(thread);
        group.threads.push({
            author: ctx.userName(root.event.sender),
            grad: AVATAR_GRADIENTS[swatchFor(root.event.sender)],
            time: ctx.date(root.timestamp),
            text: ctx.mentionsAsTyped(ctx.contentText(root.event.content)),
            count: ctx.replies(thread.totalReplies),
            unread: unread > 0 ? unread : undefined,
            selected: ctx.selected(thread),
            onOpen: () => ctx.open(thread),
        });
    }
    return [...groups.values()];
}
