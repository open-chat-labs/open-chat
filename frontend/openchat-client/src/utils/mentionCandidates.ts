import type { UserOrUserGroup } from "@shared";

/** The most a mention picker that lists them all at once (rather than as they scroll) offers. */
export const MAX_MENTION_CANDIDATES_SHOWN = 200;

/** How a mention picker offers who can be mentioned. */
export type MentionCandidateOptions = {
    /** The user picking, left out unless `mentionSelf`. */
    me: string;
    mentionSelf: boolean;
    /** User groups are offered for what's typed (a picker without them still offers them all
     * while nothing is typed). */
    supportsUserGroups: boolean;
    /** Only users (and bots): no groups, no @everyone. */
    usersOnly: boolean;
    /** Users are kept in the order given (a list the caller has ordered itself), not by name. */
    keepUserOrder: boolean;
};

/**
 * Who a mention picker offers for what's been typed after the "@" (`prefix`; all of them while
 * there's none): @everyone first, then user groups, then users and bots, each by the shortest name
 * first, then alphabetically. A user matches on their username or display name, a group on its
 * name, @everyone on "everyone". The user picking is never offered unless `mentionSelf`.
 */
export function mentionCandidates(
    usersAndGroups: readonly UserOrUserGroup[],
    prefix: string | undefined,
    options: MentionCandidateOptions,
): UserOrUserGroup[] {
    const typed = prefix?.toLowerCase();
    const matches = (name: string | undefined) =>
        typed === undefined || (name?.toLowerCase().startsWith(typed) ?? false);
    return usersAndGroups
        .filter((candidate) => {
            switch (candidate.kind) {
                case "user_group":
                    return (
                        !options.usersOnly &&
                        (typed === undefined ||
                            (options.supportsUserGroups && matches(candidate.name)))
                    );
                case "everyone":
                    return !options.usersOnly && matches("everyone");
                default:
                    return (
                        (options.mentionSelf || candidate.userId !== options.me) &&
                        (matches(candidate.username) || matches(candidate.displayName))
                    );
            }
        })
        .map((candidate, given) => ({ candidate, given }))
        .sort((a, b) => {
            const rank = RANK[a.candidate.kind] - RANK[b.candidate.kind];
            if (rank !== 0) return rank;
            if (options.keepUserOrder && isUser(a.candidate)) return a.given - b.given;
            return compareMatchNames(mentionName(a.candidate), mentionName(b.candidate));
        })
        .map(({ candidate }) => candidate);
}

/** A mention candidate's key, the same as long as it's the same user, group or @everyone. */
export function mentionCandidateKey(candidate: UserOrUserGroup): string {
    switch (candidate.kind) {
        case "user_group":
            return candidate.id.toString();
        case "everyone":
            return "everyone";
        default:
            return candidate.userId;
    }
}

/** What's typed after the "@" to mention a candidate: a username, a group's name, "everyone". */
export function mentionName(candidate: UserOrUserGroup): string {
    switch (candidate.kind) {
        case "user_group":
            return candidate.name;
        case "everyone":
            return "everyone";
        default:
            return candidate.username;
    }
}

// @everyone, then user groups, then users and bots
const RANK: Record<UserOrUserGroup["kind"], number> = {
    everyone: 0,
    user_group: 1,
    user: 2,
    bot: 2,
};

function isUser(candidate: UserOrUserGroup): boolean {
    return candidate.kind === "user" || candidate.kind === "bot";
}

// the shortest first, then alphabetically
function compareMatchNames(a: string, b: string): number {
    if (a === b) return 0;
    if (a.length === b.length) return a < b ? -1 : 1;
    return a.length < b.length ? -1 : 1;
}
