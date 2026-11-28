import { groupOfTwo } from "../fixtures/groups";
import { expectMessage, sendText } from "../fixtures/messages";
import { expect, test } from "../fixtures/pair";
import { openDirectChat, openGroup } from "../fixtures/routes";
import type { User } from "../fixtures/users";

// Search (#10550 phase 3): the chat list's search, and a phone's search in a chat. Desktop has no
// search in a chat yet.

const unique = (label: string) =>
    `${label} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

/** The chat list's search box: desktop's is always there, a phone's opens from a button. */
async function chatListSearch(user: User) {
    if (user.tree === "desktop") return user.page.getByPlaceholder("Search conversations");
    await user.page.getByRole("button", { name: "Search chats, people and groups" }).click();
    return user.page.getByPlaceholder("Search chats, people and groups");
}

test("the chat list's search finds a group by its name, and leaves out the chats it doesn't match", async ({
    pair,
}) => {
    const { a, b, idA, idB, nameA } = pair;
    const name = unique("findable");
    await groupOfTwo(a, b, idB, name);
    // a chat the search won't match (OpenChatBot's would: its invite names the group)
    await openDirectChat(a, idB);
    await sendText(a, unique("hello"));
    await openDirectChat(b, idA);
    await b.page.goto("/");
    const dmRow = b.page.getByRole("button", { name: new RegExp(`^${nameA} \\d`) });
    await expect(dmRow).toBeVisible();

    await (await chatListSearch(b)).fill(name.split(" ")[1]);

    await expect(b.page.getByRole("button", { name: new RegExp(name) }).first()).toBeVisible();
    // a phone's results cover the list rather than replacing it, and count what they found
    if (b.tree === "desktop") await expect(dmRow).toHaveCount(0);
    else await expect(b.page.getByText(/^Chats\s*·\s*1$/i)).toBeVisible();
});

test("searching a chat finds its messages and steps between them @mobile-only", async ({
    pair,
}) => {
    const { a, b, idB } = pair;
    const word = unique("needle").split(" ")[1];
    const groupId = await groupOfTwo(a, b, idB, unique("search"));
    await openGroup(a, groupId);
    await sendText(a, `first ${word}`);
    await sendText(a, "nothing to see");
    await sendText(a, `second ${word}`);
    await expectMessage(b, `second ${word}`);

    await b.page.getByRole("button", { name: "Chat options" }).click();
    await b.page.getByRole("menuitem", { name: "Search in chat" }).click();
    await b.page.getByPlaceholder("Search in this chat").fill(word);

    await expect(b.page.getByText("1 of 2")).toBeVisible();
    await b.page.getByRole("button", { name: "Older match" }).click();
    await expect(b.page.getByText("2 of 2")).toBeVisible();
});
