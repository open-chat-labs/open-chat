import {
    composer,
    confirmDelete,
    editMessage,
    expectMessage,
    forwardTo,
    messageAction,
    messageRow,
    react,
    replyTo,
    sendPhoto,
    sendText,
    submit,
} from "../fixtures/messages";
import { groupOfTwo } from "../fixtures/groups";
import { expect, test } from "../fixtures/pair";
import { openDirectChat, openGroup } from "../fixtures/routes";

// Messaging basics (#10550 phase 3): what one person does to a message is what the other sees.
// The two people are the worker's pair, in their DM; each test works on its own messages.

const unique = (label: string) =>
    `${label} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

// #10568 invariant 1: the edit goes in as soon as Edit is offered, without waiting, and is kept
test("an edited message reaches the other person, marked as edited", async ({ pair }) => {
    const { a, b, idA, idB } = pair;
    const before = unique("before");
    const after = unique("after");
    await openDirectChat(a, idB);
    await sendText(a, before);

    await editMessage(a, before, after);

    await openDirectChat(b, idA);
    await expect(messageRow(b, after)).toContainText("edited");
    await expect(b.page.getByText(before, { exact: true })).toHaveCount(0);
});

test("a deleted message is gone for the other person", async ({ pair }) => {
    const { a, b, idA, idB } = pair;
    const text = unique("doomed");
    await openDirectChat(a, idB);
    await sendText(a, text);
    await openDirectChat(b, idA);
    await expectMessage(b, text);

    await messageAction(a, text, "delete");
    await confirmDelete(a);

    // each tree says so in its own way (desktop folds deleted messages into "1 message deleted")
    await expect(b.page.getByText(text, { exact: true })).toHaveCount(0);
});

test("a reply reaches the other person quoting the message it replies to", async ({ pair }) => {
    const { a, b, idA, idB } = pair;
    const original = unique("question");
    const reply = unique("answer");
    await openDirectChat(b, idA);
    await sendText(b, original);
    await openDirectChat(a, idB);
    await expectMessage(a, original);

    await replyTo(a, original, reply);

    await expect(messageRow(b, reply)).toContainText(original);
});

test("a reaction reaches the other person, and so does taking it back", async ({ pair }) => {
    const { a, b, idA, idB } = pair;
    const text = unique("react to me");
    await openDirectChat(b, idA);
    await sendText(b, text);
    await openDirectChat(a, idB);
    await expectMessage(a, text);

    await react(a, text, "👍️");
    await expect(messageRow(b, text).getByRole("button", { name: /👍️/ })).toBeVisible();

    await react(a, text, "👍️", true);
    await expect(messageRow(b, text).getByRole("button", { name: /👍️/ })).toHaveCount(0);
});

test("markdown in a message reaches the other person formatted", async ({ pair }) => {
    const { a, b, idA, idB } = pair;
    const word = unique("bold");
    await openDirectChat(a, idB);
    await sendText(a, `this is **${word}**`);

    await openDirectChat(b, idA);
    // in the conversation: the chat list's preview is formatted too
    await expect(
        b.page.getByRole("group").getByRole("strong").filter({ hasText: word }),
    ).toBeVisible();
});

test("a forwarded message reaches the chat it was forwarded to, marked as forwarded", async ({
    pair,
}) => {
    const { a, b, idB } = pair;
    const text = unique("pass it on");
    const groupName = unique("forwarded to");
    const groupId = await groupOfTwo(a, b, idB, groupName);
    await openDirectChat(a, idB);
    await sendText(a, text);

    await messageAction(a, text, "forward");
    await forwardTo(a, groupName);

    await openGroup(b, groupId);
    await expect(messageRow(b, text)).toContainText("Forwarded");
});

test("someone mentioned in a group sees the mention by their name", async ({ pair }) => {
    const { a, b, idB, nameB } = pair;
    const groupId = await groupOfTwo(a, b, idB, unique("mentions"));
    const tail = unique("see this");
    await openGroup(a, groupId);

    await composer(a).fill(`@${nameB.slice(0, 8)}`);
    await a.page
        .getByRole("listbox", { name: "People to mention" })
        .getByRole("option", { name: new RegExp(nameB) })
        .click();
    await composer(a).pressSequentially(tail);
    await submit(a);

    await openGroup(b, groupId);
    // a mention is sent as the user's id, so seeing the name means it was recognised as one
    const message = b.page.getByRole("group").filter({ hasText: tail }).last();
    await expect(message).toContainText(`@${nameB}`);
    await expect(message).not.toContainText(idB);
});

test("a photo reaches the other person with its caption", async ({ pair }) => {
    const { a, b, idA, idB } = pair;
    const caption = unique("look");
    await openDirectChat(a, idB);
    await sendPhoto(a, caption);

    await openDirectChat(b, idA);
    // the photo is the tile's background; the tile opens it
    await expect(messageRow(b, caption).getByRole("button", { name: /^Open image/ })).toBeVisible();
});
