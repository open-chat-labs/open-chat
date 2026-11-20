import {
    freshUsername,
    passkeyOf,
    signIn,
    signUp,
    test,
    userIdOf,
    expect,
} from "../fixtures/users";

test("a new user signs up with a passkey and signs back in with it on another device", async ({
    users,
}) => {
    const first = await users.add("first");
    await signUp(first, freshUsername("e2eauth"));
    const userId = await userIdOf(first);

    const again = await users.add("again");
    await signIn(again, await passkeyOf(first));
    expect(await userIdOf(again)).toBe(userId);
});
