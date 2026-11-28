import { writeFileSync } from "node:fs";
import path from "node:path";
import { test } from "@playwright/test";
import { freshUsername, newUser, passkeyOf, signUp, userIdOf } from "../fixtures/users";

// One sign-up per pool user, each saved as <i>.json: { username, userId, passkey }
const size = Number(process.env.OC_E2E_POOL_SIZE);
const poolDir = process.env.OC_E2E_POOL_DIR!;

for (let i = 0; i < size; i++) {
    test(`pool user ${i}`, async ({ browser }) => {
        const options = {
            baseURL: test.info().project.use.baseURL,
            viewport: { width: 1400, height: 900 },
        };
        const user = await newUser(browser, options, `pool${i}`, "desktop");
        const username = freshUsername("pool");
        await signUp(user, username);
        const userId = await userIdOf(user);
        const passkey = await passkeyOf(user);
        writeFileSync(
            path.join(poolDir, `${i}.json`),
            JSON.stringify({ username, userId, passkey }),
        );
        await user.context.close();
    });
}
