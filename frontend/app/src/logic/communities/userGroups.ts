// A community's user group being made or changed (the native User groups pages): the rules its name
// and members go by, as the old desktop and mobile editors had them (3 to 25 characters, no
// spaces, which become underscores, as its @mention is the name; at least one member; not another
// group's name).

export const USER_GROUP_NAME_MIN = 3;
export const USER_GROUP_NAME_MAX = 25;

/** The name as it's saved and mentioned: trimmed, its spaces underscores. */
export function userGroupName(name: string): string {
    return name.trim().replace(/\s+/g, "_");
}

/** Why a user group can't be saved yet, or undefined if it can. */
export type UserGroupProblem = "name_length" | "name_taken" | "no_members";

/**
 * What stops a save: the name (as it's saved, `userGroupName`) too short or long, another of the
 * community's groups' (`taken`, theirs, case aside), or no one in it.
 */
export function userGroupProblem(
    name: string,
    members: number,
    taken: readonly string[],
): UserGroupProblem | undefined {
    const saved = userGroupName(name);
    if (saved.length < USER_GROUP_NAME_MIN || saved.length > USER_GROUP_NAME_MAX) {
        return "name_length";
    }
    const lower = saved.toLowerCase();
    if (taken.some((n) => n.toLowerCase() === lower)) return "name_taken";
    if (members === 0) return "no_members";
    return undefined;
}

/** Whether the group differs from what it was: its name (as saved) or who's in it. */
export function userGroupChanged(
    original: { name: string; members: ReadonlySet<string> } | undefined,
    name: string,
    members: ReadonlySet<string>,
): boolean {
    if (original === undefined) return userGroupName(name) !== "" || members.size > 0;
    if (userGroupName(name) !== original.name) return true;
    if (members.size !== original.members.size) return true;
    return [...members].some((m) => !original.members.has(m));
}
