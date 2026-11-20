import { createPrivateGroup } from "../fixtures/groups";
import { openGroup } from "../fixtures/routes";
import { expect, freshUsername, signUp, test, userIdOf } from "../fixtures/users";

// #10557 invariant 1: loading the app at a chat's URL opens that chat, whatever the app selected
// before. A chat the list doesn't hold yet (here a group the guest is invited to, which has to be
// previewed) is still loading when the chat list's first updates come in, and those mustn't count
// it as gone. Holding the group's own requests back makes sure they come in first.
test("a chat's URL opens that chat while the chat list updates around it", async ({ users }) => {
    const [owner, guest] = await Promise.all([users.add("owner"), users.add("guest")]);
    await Promise.all([
        signUp(owner, freshUsername("e2eurlo")),
        signUp(guest, freshUsername("e2eurlg")),
    ]);
    const guestId = await userIdOf(guest);
    const groupId = await createPrivateGroup(owner, `e2e ${Date.now().toString(36)}`, [guestId!]);

    await guest.context.route(`**/canister/${groupId}/**`, async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 5_000));
        await route.continue();
    });
    await openGroup(guest, groupId);

    await expect(guest.page.getByRole("button", { name: /^Join/ }).first()).toBeVisible();
    expect(guest.page.url()).toContain(groupId);
});
