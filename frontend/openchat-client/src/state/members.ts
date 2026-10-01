import type { Member, ReadonlyMap, ReadonlySet } from "@shared";

// The members of a chat or community which are held. If it has more than are loaded at once, these
// are the first page of them and any who have since been looked up, and `moreMembersAfter` is set.
export type HeldMembers = {
    // The time up to which the details are known to be up to date
    timestamp: bigint;
    members: ReadonlyMap<string, Member>;
    lapsedMembers: ReadonlySet<string>;
    moreMembersAfter: string | undefined;
};

// The held members with those added who have been looked up, or undefined if there are none to add.
// Those already held are left as they are, since the updates to the details keep them up to date.
// `asOf` is the time up to which the details were known to be up to date when the lookup was sent.
// If they have been updated since, a member who was looked up may have left, or had their role
// changed, in an update which has already been applied, so none are added.
export function addLookedUpMembers(
    held: HeldMembers,
    found: Member[],
    asOf: bigint,
): Pick<HeldMembers, "members" | "lapsedMembers"> | undefined {
    if (held.timestamp > asOf) {
        return undefined;
    }
    const toAdd = found.filter(
        (m) => !held.members.has(m.userId) && !held.lapsedMembers.has(m.userId),
    );
    if (toAdd.length === 0) {
        return undefined;
    }
    const members = new Map(held.members);
    const lapsedMembers = new Set(held.lapsedMembers);
    for (const member of toAdd) {
        if (member.lapsed) {
            lapsedMembers.add(member.userId);
        } else {
            members.set(member.userId, member);
        }
    }
    return { members, lapsedMembers };
}
