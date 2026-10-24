import { bridgedFrom, type Message, type MessageActivityEvent, type ResourceKey } from "@client";
import { i18nKey } from "@src/i18n/i18n";
import { totalVotes } from "@src/utils/polls";

export type SummaryNames = {
    /** The signed-in user's id: they are never counted among the others who reacted. */
    me: string;
    /** The event's user as the feed shows them ("An anonymous user" when there is none). */
    username: string;
    /** Another user's name as the feed shows it ("you" for the reader). */
    displayName: (userId: string) => string;
};

/**
 * What happened, the same in every tree: who did it, and for reactions, tips and poll votes, how
 * many others did too. The message comes separately because the mobile feed keeps it apart from
 * the event.
 */
export function activitySummary(
    event: Omit<MessageActivityEvent, "message">,
    message: Message | undefined,
    { me, username, displayName }: SummaryNames,
): ResourceKey {
    switch (event.activity) {
        case "reaction":
            return withOthers("reaction", username, otherReactors(event, message, me), displayName);
        case "mention":
            return i18nKey("activity.mention", { username });
        case "quote_reply":
            return i18nKey("activity.quoteReply", { username });
        case "tip":
            return withOthers("tip", username, otherTippers(event, message), displayName);
        case "crypto":
            return i18nKey("activity.crypto", { username });
        case "poll_vote": {
            const voters =
                message?.content.kind === "poll_content" ? totalVotes(message.content) : 1;
            return voters > 1
                ? i18nKey("activity.pollVoteN", { username, number: voters - 1 })
                : i18nKey("activity.pollVote", { username });
        }
        case "p2p_swap_accepted":
            return i18nKey("activity.p2pSwapAccepted", { username });
    }
}

/** The activities whose message is the one the event's user sent, eg. a reply. */
const SENT_BY_ACTOR: ReadonlySet<MessageActivityEvent["activity"]> = new Set<
    MessageActivityEvent["activity"]
>(["mention", "quote_reply", "crypto"]);

/**
 * Whether the event's user is a bridge bot which relayed the event's message from another
 * platform, so whoever did it is the message's relayed author, and is named as the message's
 * author is (see `messageAuthorName`), not as the bot. Only for an activity whose message is the
 * one its user sent: a reaction's or a tip's message is the reader's own. A name from another
 * platform is only checked for length, so wherever it's rendered as Markdown, links are suppressed.
 */
export function isByRelayedAuthor(
    event: Omit<MessageActivityEvent, "message">,
    message: Message | undefined,
): boolean {
    return (
        message !== undefined &&
        SENT_BY_ACTOR.has(event.activity) &&
        event.userId === message.sender &&
        bridgedFrom(message.senderContext) !== undefined
    );
}

function withOthers(
    root: "tip" | "reaction",
    username: string,
    others: Set<string>,
    displayName: (userId: string) => string,
): ResourceKey {
    switch (others.size) {
        case 0:
            return i18nKey(`activity.${root}One`, { username });
        case 1:
            return i18nKey(`activity.${root}Two`, {
                username,
                other: displayName([...others][0]),
            });
        default:
            return i18nKey(`activity.${root}N`, { username, n: others.size });
    }
}

function otherReactors(
    event: Omit<MessageActivityEvent, "message">,
    message: Message | undefined,
    me: string,
): Set<string> {
    return new Set(
        (message?.reactions ?? []).flatMap((r) =>
            [...r.userIds].filter((u) => u !== event.userId && u !== me),
        ),
    );
}

function otherTippers(
    event: Omit<MessageActivityEvent, "message">,
    message: Message | undefined,
): Set<string> {
    return new Set(
        Object.values(message?.tips ?? {}).flatMap((tips) =>
            Object.keys(tips).filter((u) => u !== event.userId),
        ),
    );
}
