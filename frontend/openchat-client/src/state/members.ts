import type { Member, ReadonlyMap, ReadonlySet } from "@shared";

// The members of a chat or community which are held. If it has more than are loaded at once, these
// are the first page of them, any later pages which have been loaded, and any who have been looked
// up, and `moreMembersAfter` is the user id after which the next page starts.
export type HeldMembers = {
    members: ReadonlyMap<string, Member>;
    lapsedMembers: ReadonlySet<string>;
    moreMembersAfter: string | undefined;
};

// Where a page of members started, and where the members after it start
export type MembersPagePosition = { after: string; moreMembersAfter: string | undefined };

// The held members with those added which have since been loaded. A page only moves on where the
// members not yet held start if it carries on from where those held stop, since pages can arrive
// twice or out of order.
export function addLoadedMembers(
    held: HeldMembers,
    loaded: Member[],
    page?: MembersPagePosition,
): HeldMembers {
    const members = new Map(held.members);
    const lapsedMembers = new Set(held.lapsedMembers);
    for (const member of loaded) {
        if (member.lapsed) {
            members.delete(member.userId);
            lapsedMembers.add(member.userId);
        } else {
            members.set(member.userId, member);
            lapsedMembers.delete(member.userId);
        }
    }
    return {
        members,
        lapsedMembers,
        moreMembersAfter:
            page !== undefined && page.after === held.moreMembersAfter
                ? page.moreMembersAfter
                : held.moreMembersAfter,
    };
}
