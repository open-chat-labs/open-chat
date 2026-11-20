import { expectMessage, sendText } from "../fixtures/conversation";
import { openDirectChat } from "../fixtures/routes";
import { freshUsername, signUp, test, userIdOf } from "../fixtures/users";

test("a direct message reaches the person it was sent to", async ({ users }) => {
    const [a, b] = await Promise.all([users.add("a"), users.add("b")]);
    await Promise.all([signUp(a, freshUsername("e2edma")), signUp(b, freshUsername("e2edmb"))]);
    const [idA, idB] = await Promise.all([userIdOf(a), userIdOf(b)]);

    await openDirectChat(a, idB!);
    const text = `hello ${Date.now().toString(36)}`;
    await sendText(a, text);

    await openDirectChat(b, idA!);
    await expectMessage(b, text);
});
