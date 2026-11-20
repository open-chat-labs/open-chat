import { expect } from "@playwright/test";
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
