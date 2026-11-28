import { groupOfTwo } from "../fixtures/groups";
import { expectMessage, messageAction, messageRow, sendText } from "../fixtures/messages";
import { expect, test } from "../fixtures/pair";
import { openGroup } from "../fixtures/routes";
import type { User } from "../fixtures/users";

// Threads (#10550 phase 3): a reply in a thread reaches the other members, and the message it
// hangs off says so.

const unique = (label: string) =>
    `${label} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** The open thread's composer, named "Reply to …" by the thread's first sender. */
function threadComposer(user: User) {
    return user.page.getByRole("textbox", { name: /^Reply to/ });
}

async function sendInThread(user: User, text: string) {
    await threadComposer(user).fill(text);
    if (user.tree === "desktop") {
        await threadComposer(user).press("Enter");
    } else {
        await user.page.getByRole("button", { name: "Send message" }).click();
    }
}

test("a reply in a thread reaches the message's author, counted on its replies link", async ({
    pair,
}) => {
    const { a, b, idB } = pair;
    const root = unique("start a thread");
    const reply = unique("in the thread");
    const groupId = await groupOfTwo(a, b, idB, unique("threads"));
    await openGroup(a, groupId);
    await sendText(a, root);
    await expectMessage(b, root);

    await messageAction(b, root, "thread");
    await sendInThread(b, reply);

    const link = messageRow(a, root).getByRole("button", { name: /^Open thread, 1 repl/ });
    await expect(link).toBeVisible();
    await link.click();
    await expect(a.page.getByText(reply)).toBeVisible();
});
