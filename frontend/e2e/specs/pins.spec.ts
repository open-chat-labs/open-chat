import { groupOfTwo } from "../fixtures/groups";
import { expectMessage, messageAction, sendText } from "../fixtures/messages";
import { expect, test } from "../fixtures/pair";
import { openGroup } from "../fixtures/routes";
import type { User } from "../fixtures/users";

// Pins (#10550 phase 3): a message one person pins is in the other's pinned messages, until it's
// unpinned.

const unique = (label: string) =>
    `${label} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/**
 * What shows the open group has pins: desktop's header pin button, a phone's strip above the
 * conversation. Neither is there when nothing is pinned.
 */
function pinsIndicator(user: User) {
    return user.tree === "desktop"
        ? user.page.getByRole("main").getByRole("button", { name: "Pin", exact: true })
        : user.page.getByRole("button", { name: "All pinned messages" });
}

/**
 * The open list of pinned messages: desktop's items have Go to message, a phone's screen is titled
 * by how many there are (its items' Unpin is only for someone allowed to pin).
 */
function pinnedList(user: User) {
    return user.tree === "desktop"
        ? user.page.getByRole("button", { name: "Go to message" })
        : user.page.getByText("1 pinned message");
}

test("a pinned message is in the other person's pinned messages, until it's unpinned", async ({
    pair,
}) => {
    const { a, b, idB } = pair;
    const text = unique("pin me");
    const groupId = await groupOfTwo(a, b, idB, unique("pins"));
    await openGroup(a, groupId);
    await sendText(a, text);
    await expectMessage(b, text);

    await messageAction(a, text, "pin");

    await openGroup(b, groupId);
    await expectMessage(b, text);
    await pinsIndicator(b).click();
    await expect(pinnedList(b)).toBeVisible();
    await expect(b.page.getByText(text).first()).toBeVisible();

    await messageAction(a, text, "unpin");
    await openGroup(b, groupId);
    await expectMessage(b, text);
    await expect(pinsIndicator(b)).toHaveCount(0);
});
