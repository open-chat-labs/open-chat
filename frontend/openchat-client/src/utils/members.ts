import {
    compareRoles,
    i18nKey,
    type ExternalBot,
    type FullMember,
    type Member,
    type MemberRole,
    type MessageFormatter,
    type ReadonlySet,
    type ResourceKey,
    type UserLookup,
    type UserSummary,
} from "@shared";
import { roleAsText } from "./permissions";

/** The members whose user is held, each with their display name in the chat or community. */
export function knownMembers(users: UserLookup, members: Iterable<Member>): FullMember[] {
    const known: FullMember[] = [];
    for (const m of members) {
        const user = users.get(m.userId);
        if (user) {
            known.push({
                ...user,
                ...m,
                displayName: m.displayName ?? user.displayName,
            });
        }
    }
    return known;
}

/** The held users among `ids`. */
export function usersFromIds(users: UserLookup, ids: ReadonlySet<string>): UserSummary[] {
    const found: UserSummary[] = [];
    for (const id of ids) {
        const user = users.get(id);
        if (user) {
            found.push(user);
        }
    }
    return found;
}

export function memberMatchesSearch(
    searchTermLower: string,
    user: UserSummary | ExternalBot,
): boolean {
    if (searchTermLower === "") return true;
    if (user.kind === "external_bot") {
        return (
            user.name.toLowerCase().includes(searchTermLower) ||
            (user.definition.description !== undefined &&
                user.definition.description.toLocaleLowerCase().includes(searchTermLower))
        );
    }

    if (user.username === undefined) return true;
    return (
        user.username.toLowerCase().includes(searchTermLower) ||
        (user.displayName !== undefined && user.displayName.toLowerCase().includes(searchTermLower))
    );
}

/** Highest role first. */
export function compareMembers(a: FullMember, b: FullMember): number {
    return b.role - a.role;
}

/** The message to show when changing a member's role from `oldRole` to `newRole` fails. */
export function roleChangeFailureMessage(
    newRole: MemberRole,
    oldRole: MemberRole,
    formatter: MessageFormatter,
): ResourceKey {
    const promotion = compareRoles(newRole, oldRole) > 0;
    return i18nKey(promotion ? "promoteFailed" : "demoteFailed", {
        role: formatter(roleAsText(newRole)),
    });
}
