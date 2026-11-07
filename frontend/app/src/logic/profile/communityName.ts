// The name the user goes by in a community, in place of their display name: the web's profile
// (Communities) and the native You → Communities set it the same way, as the old screens'
// DisplayNameInput did. Clearing it removes it.

import {
    isDisplayNameValid,
    memberDisplayNameResult,
    type OpenChat,
    type ProfileFieldResult,
} from "@client";

/**
 * The name to set in a community, without the spaces around it: clearing it (no name, or a blank
 * one) sends none, removing it.
 */
export function memberDisplayNameOf(name: string | null): string | undefined {
    const trimmed = name?.trim() ?? "";
    return trimmed === "" ? undefined : trimmed;
}

/**
 * Sets the user's name in the community, or removes it for none. A name the backend would turn
 * down isn't sent: it's rejected here with the reason, as the backend would.
 */
export async function saveCommunityName(
    client: Pick<OpenChat, "setMemberDisplayName">,
    communityId: string,
    name: string | null,
): Promise<ProfileFieldResult> {
    const displayName = memberDisplayNameOf(name);
    if (displayName !== undefined && !isDisplayNameValid(displayName)) {
        return { kind: "rejected", message: "register.displayNameInvalid" };
    }
    const resp = await client.setMemberDisplayName(
        { kind: "community", communityId },
        displayName,
    );
    return memberDisplayNameResult(resp);
}
