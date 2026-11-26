import { expectMessage, sendText } from "../fixtures/messages";
import { createPrivateGroup, groupOfTwo } from "../fixtures/groups";
import { openGroup } from "../fixtures/routes";
import { expect, freshUsername, signUp, test, userIdOf } from "../fixtures/users";

test("someone invited to a private group joins it, and the members see what they send", async ({
    users,
}) => {
    const [owner, guest] = await Promise.all([users.add("owner"), users.add("guest")]);
    await Promise.all([
        signUp(owner, freshUsername("e2egro")),
        signUp(guest, freshUsername("e2egrg")),
    ]);
    const guestId = await userIdOf(guest);
    const groupId = await createPrivateGroup(owner, `e2e ${Date.now().toString(36)}`, [guestId!]);

    await openGroup(guest, groupId);
    await guest.page.getByRole("button", { name: /^Join/ }).first().click();
    const text = `joined ${Date.now().toString(36)}`;
    await sendText(guest, text);

    await openGroup(owner, groupId);
    await expectMessage(owner, text);
});

// #10579 invariant 1: a member who loads a group they belong to sees it as a member, never as a
// preview. A group joined just before a reload may not be in the cached chat list the page starts
// from, so the page previews it while the chat list's updates bring it in. Holding the preview's
// own request back until they have makes sure its answer comes in last.
test("a group joined just before a reload opens as a member, not a preview", async ({ users }) => {
    const [owner, guest] = await Promise.all([users.add("owner"), users.add("guest")]);
    await Promise.all([
        signUp(owner, freshUsername("e2egjo")),
        signUp(guest, freshUsername("e2egjg")),
    ]);
    const guestId = await userIdOf(guest);
    const groupId = await groupOfTwo(owner, guest, guestId!, `e2e ${Date.now().toString(36)}`);

    let releasePreview!: () => void;
    const previewReleased = new Promise<void>((resolve) => (releasePreview = resolve));
    let held = 0;
    await guest.context.route(`**/canister/${groupId}/**`, async (route) => {
        if (route.request().postDataBuffer()?.includes("public_summary")) {
            held++;
            await previewReleased;
        }
        await route.continue();
    });
    // Keeps the app's last call to open the chat the URL names, so the test can wait for it
    await guest.page.addInitScript(() => {
        let hook: Window["__ocTest"];
        Object.defineProperty(window, "__ocTest", {
            get: () => hook,
            set: (value: NonNullable<Window["__ocTest"]>) => {
                hook = value;
                const select = value.client.setSelectedChat.bind(value.client);
                value.client.setSelectedChat = (...args) =>
                    (window.__ocSelecting = select(...args));
            },
        });
    });
    await openGroup(guest, groupId);

    // the chat list's updates have brought the group in, with the guest a member
    await expect(guest.page.getByRole("textbox", { name: /message/i })).toBeVisible();
    // the race was forced: the preview's request was held back (renaming the method, or the page
    // no longer previewing the group, would otherwise leave this passing without testing anything)
    expect(held).toBeGreaterThan(0);
    releasePreview();
    await guest.page.evaluate(() => window.__ocSelecting);

    const previewing = await guest.page.evaluate(
        (groupId) => window.__ocTest!.client.isPreviewing({ kind: "group_chat", groupId }),
        groupId,
    );
    expect(previewing).toBe(false);
    await expect(guest.page.getByRole("textbox", { name: /message/i })).toBeVisible();
});
