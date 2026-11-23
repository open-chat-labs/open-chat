import type {
    BridgedUserSummary,
    CommunityIdentifier,
    MessageFormatter,
    OpenChat,
    UserLookup,
} from "@client";
import { interpolateNewUi } from "@src/i18n/i18n";
import { messageAuthorName } from "@src/logic/chats/latestMessagePreview";
import { typedMentions } from "@src/logic/conversation/typedMentions";
import { buildDisplayName } from "@src/utils/user";
import { activityFeedState } from "./activity.svelte";
import { activityChatName } from "./activityChatName";
import type { ActivityContext } from "./activityItem";

// What the web's feed (web/features/activity) and the native Activity tab (native/features/activity)
// share besides the items: the context the items are made in, the feed's loading, and marking it
// read.

/** What `activityContext` reads: the client and the stores' values, as a screen has them. */
export type ActivityContextDeps = {
    client: Pick<
        OpenChat,
        | "displayName"
        | "getDisplayName"
        | "lookupChatSummary"
        | "getContentAsText"
        | "formatMessageDate"
        | "toShortTimeString"
    >;
    /** The app's translator ($_). */
    formatter: MessageFormatter;
    /** The signed-in user (currentUserIdStore). */
    me: string;
    /** allUsersStore. */
    users: UserLookup;
    /** bridgedUsersStore. */
    bridgedUsers: { get(key: string): BridgedUserSummary | undefined };
    /** userGroupSummariesStore: every community's groups, for a mention of one. */
    userGroups: { get(id: number): { name: string } | undefined };
    /** communitiesStore, for a channel's community's name. */
    communityName: (id: CommunityIdentifier) => string | undefined;
    /** The feed's read-up-to time (messageActivitySummaryStore). */
    readUpTo: bigint;
};

/** The lookups and wording the feed's items are made with (`activityItem`). */
export function activityContext(deps: ActivityContextDeps): ActivityContext {
    const { client, formatter, me, users } = deps;
    return {
        me,
        you: formatter("you"),
        anon: formatter("activity.anon"),
        missing: formatter("activity.missingMessage"),
        userName: (userId) => client.displayName(users.get(userId)),
        author: (message) =>
            messageAuthorName(message, {
                formatter,
                me,
                displayName: (userId, kind) => buildDisplayName(users, userId, kind, false),
                bridgedUsers: deps.bridgedUsers,
                users,
            }),
        chatName: (context) =>
            activityChatName(client.lookupChatSummary(context.chatId), context, {
                displayName: (userId) => client.getDisplayName(userId),
                communityName: deps.communityName,
                thread: formatter("thread.title"),
            }),
        contentText: (content) => client.getContentAsText(formatter, content),
        // the feed can be any community's channels': every community's groups, looked up
        // only for a message that mentions one
        mentionsAsTyped: typedMentions({ users, userGroups: deps.userGroups }),
        text: (key) => interpolateNewUi(formatter, key),
        day: (timestamp) =>
            client.formatMessageDate(timestamp, formatter("today"), formatter("yesterday")),
        time: (timestamp) => client.toShortTimeString(new Date(Number(timestamp))),
        readUpTo: deps.readUpTo,
    };
}

/**
 * The feed's loading, as the old feed loaded it: (again) whenever the summary says there's newer
 * activity than it has. A load that fails says so (`failed`, with Retry) rather than loading for
 * ever. Retry only clears the failure, and the screen loads again, so one load runs at a time; a
 * load that's been superseded can't mark a later one failed.
 */
export class ActivityFeedLoad {
    #failed = $state(false);
    #attempt = 0;
    #client: Pick<OpenChat, "subscribeToMessageActivityFeed">;

    constructor(client: Pick<OpenChat, "subscribeToMessageActivityFeed">) {
        this.#client = client;
    }

    get failed(): boolean {
        return this.#failed;
    }

    /** Whether to load now: the summary's `latest` is newer than the feed has, and nothing failed. */
    needed(latest: bigint): boolean {
        const upToDate =
            activityFeedState.initialised && latest <= activityFeedState.latestTimestamp;
        return !upToDate && !this.#failed;
    }

    load(): void {
        const mine = ++this.#attempt;
        this.#client.subscribeToMessageActivityFeed(
            (response) => (activityFeedState.activityEvents = response.events),
            () => {
                if (mine === this.#attempt) this.#failed = true;
            },
        );
    }

    retry(): void {
        this.#failed = false;
    }
}

/**
 * Marks the feed read up to `upTo` (`readUpTo`: the server's read-up-to time). The client undoes a
 * mark that failed and says so, and a mark that didn't stick rejects here, for the feed to roll its
 * own back and say so. Nothing to do (no time, or one already read) resolves at once.
 *
 * It used to check the summary store's read-up-to time after the mark instead, which stays the
 * server's until the next sync: a mark that worked was taken for one that hadn't ("Couldn't update
 * that" after Mark all read).
 */
export async function markActivityRead(
    client: Pick<OpenChat, "markActivityFeedRead">,
    upTo: bigint | undefined,
    readUpTo: bigint,
): Promise<void> {
    if (upTo === undefined || upTo <= readUpTo) return;
    if (!(await client.markActivityFeedRead(upTo))) {
        throw new Error("markActivityFeedRead");
    }
}
