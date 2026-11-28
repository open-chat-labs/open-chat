import { groupOfTwo } from "../fixtures/groups";
import { expect, test } from "../fixtures/pair";
import { poll, pollAnswer, postPoll } from "../fixtures/polls";
import { openGroup } from "../fixtures/routes";
import type { User } from "../fixtures/users";

// Polls (#10550 phase 3): a poll one person makes, and the votes on it, are what the other sees.
// v3 mobile has no poll builder yet (N9, #10376), so making one is desktop only.

const unique = (label: string) =>
    `${label} ${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function builder(user: User) {
    return user.page.getByRole("dialog", { name: "Create a poll" });
}

async function openBuilder(user: User) {
    await user.page.getByRole("button", { name: "Add to message" }).click();
    await user.page.getByRole("menuitem", { name: "Poll" }).click();
    // it focuses the question once it's open, which would take keys typed into an answer before then
    await expect(builder(user).getByRole("textbox", { name: "Poll question" })).toBeFocused();
}

const publish = (user: User) => builder(user).getByRole("button", { name: "Publish" });

test("a poll made in the builder reaches the group with its question, answers and rules @desktop-only", async ({
    pair,
}) => {
    const { a, b, idB } = pair;
    const question = unique("which colour");
    const groupId = await groupOfTwo(a, b, idB, unique("polls"));
    await openGroup(a, groupId);

    await openBuilder(a);
    await builder(a).getByRole("textbox", { name: "Poll question" }).fill(question);
    await builder(a).getByRole("textbox", { name: "Answer 1" }).fill("Red");
    await builder(a).getByRole("textbox", { name: "Answer 2" }).fill("Blue");
    await builder(a).getByRole("radio", { name: "1 week" }).click();
    await builder(a)
        .getByRole("button", { name: /Settings/ })
        .click();
    await builder(a).getByRole("switch", { name: "Allow multiple answers" }).click();
    await publish(a).click();
    await expect(builder(a)).toBeHidden();

    await openGroup(b, groupId);
    await expect(pollAnswer(b, question, "Red", "checkbox")).toBeVisible();
    await expect(pollAnswer(b, question, "Blue", "checkbox")).toBeVisible();
    await expect(poll(b, question)).toContainText("Pick any");
});

test("a vote reaches the poll's author, and so does changing it", async ({ pair }) => {
    const { a, b, idB } = pair;
    const question = unique("which day");
    const groupId = await groupOfTwo(a, b, idB, unique("polls"));
    await postPoll(a, groupId, question, ["Monday", "Friday"]);
    await openGroup(a, groupId);
    await expect(poll(a, question)).toBeVisible();

    await pollAnswer(b, question, "Friday").click();
    await expect(pollAnswer(a, question, "Friday")).toHaveAccessibleName(/100%/);
    await expect(poll(a, question)).toContainText("1 vote");

    await pollAnswer(b, question, "Monday").click();
    await expect(pollAnswer(a, question, "Monday")).toHaveAccessibleName(/100%/);
    await expect(pollAnswer(a, question, "Friday")).toHaveAccessibleName(/\b0%/);
});

test("the builder holds a poll back until it has a question and two different answers @desktop-only", async ({
    pair,
}) => {
    const { a, b, idB } = pair;
    const groupId = await groupOfTwo(a, b, idB, unique("polls"));
    await openGroup(a, groupId);
    await openBuilder(a);
    const dialog = builder(a);

    await expect(publish(a)).toHaveAttribute("aria-disabled", "true");
    await expect(dialog).toContainText("Add a question");

    await dialog.getByRole("textbox", { name: "Poll question" }).fill("lunch?");
    await dialog.getByRole("textbox", { name: "Answer 1" }).fill("Soup");
    await expect(dialog).toContainText("Add at least two answers");

    // the same answer, ignoring case
    await dialog.getByRole("textbox", { name: "Answer 2" }).fill("SOUP");
    await expect(dialog).toContainText("Answers must be different");
    await expect(publish(a)).toHaveAttribute("aria-disabled", "true");

    await dialog.getByRole("textbox", { name: "Answer 2" }).fill("Salad");
    await expect(publish(a)).not.toHaveAttribute("aria-disabled", "true");
});
