import { expectMessage, sendText } from "../fixtures/messages";
import { createPrivateGroup } from "../fixtures/groups";
import { openGroup } from "../fixtures/routes";
import { freshUsername, signUp, test, userIdOf } from "../fixtures/users";

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
