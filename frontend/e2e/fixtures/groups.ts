import { expect } from "@playwright/test";
import { openGroup } from "./routes";
import type { User } from "./users";

/**
 * Creates a private group owned by `owner`, inviting `invitees`, through the owner's client: the
 * setup for specs about something else. Creating a group through the UI is its own spec.
 */
export async function createPrivateGroup(
    owner: User,
    name: string,
    invitees: string[],
): Promise<string> {
    const outcome = await owner.page.evaluate(
        async ({ name, invitees }) => {
            const client = window.__ocTest!.client;
            const candidate = { ...client.createCandidateGroup("group", false), name };
            return client.createGroup(candidate, invitees);
        },
        { name, invitees },
    );
    expect(outcome.kind).toBe("created");
    return outcome.chatId!.groupId;
}

/**
 * A private group `owner` makes for the two of them, which `member` joins through the app (an
 * invited user's Join). Returns its id.
 */
export async function groupOfTwo(
    owner: User,
    member: User,
    memberId: string,
    name: string,
): Promise<string> {
    const groupId = await createPrivateGroup(owner, name, [memberId]);
    await openGroup(member, groupId);
    await member.page.getByRole("button", { name: /^Join/ }).first().click();
    await expect(member.page.getByRole("textbox", { name: /message/i })).toBeVisible();
    return groupId;
}
