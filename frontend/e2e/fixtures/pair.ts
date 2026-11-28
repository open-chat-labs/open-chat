import { test as base } from "./users";
import {
    contextOptions,
    expect,
    newUser,
    signInPooled,
    treeOf,
    userIdOf,
    type User,
} from "./users";

/** Two people signed in in this worker's browser, with each one's user id and username. */
export type Pair = { a: User; b: User; idA: string; idB: string; nameA: string; nameB: string };

/**
 * The suite's `test` with `pair`: two people a worker's tests share, so that each test doesn't pay
 * for two sign-ins. Only for tests that can't disturb each other through them: each one works on
 * its own messages (unique text), and starts by opening the chat it needs.
 */
export const test = base.extend<object, { pair: Pair }>({
    pair: [
        async ({ browser }, use, workerInfo) => {
            const tree = treeOf(workerInfo);
            const [a, b] = await Promise.all(
                ["a", "b"].map((label) =>
                    newUser(browser, contextOptions(workerInfo), label, tree),
                ),
            );
            await Promise.all([signInPooled(a), signInPooled(b)]);
            const [idA, idB] = await Promise.all([userIdOf(a), userIdOf(b)]);
            await use({ a, b, idA: idA!, idB: idB!, nameA: a.username!, nameB: b.username! });
            await Promise.all([a.context.close(), b.context.close()]);
        },
        { scope: "worker", timeout: 180_000 },
    ],
});

export { expect };
