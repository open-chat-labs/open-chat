import {
    test as base,
    expect,
    type Browser,
    type BrowserContext,
    type BrowserContextOptions,
    type CDPSession,
    type Page,
    type TestInfo,
} from "@playwright/test";

/** The new UI's two trees: src/web (desktop) and src/native (phones and the native apps). */
export type Tree = "v3" | "v4";

/** A passkey, as the virtual authenticator holds it. */
type Credential = {
    credentialId: string;
    isResidentCredential: boolean;
    rpId?: string;
    privateKey: string;
    userHandle?: string;
    signCount: number;
};

/** One person: their own browser context (storage) and their own virtual passkey authenticator. */
export type User = {
    label: string;
    tree: Tree;
    context: BrowserContext;
    page: Page;
    cdp: CDPSession;
    authenticatorId: string;
};

export type Users = {
    tree: Tree;
    /** A new person with an empty authenticator, in this project's browser. */
    add(label: string): Promise<User>;
};

export function treeOf(testInfo: TestInfo): Tree {
    return testInfo.project.name.startsWith("v4") ? "v4" : "v3";
}

// the project's device, for a context the test makes itself
function contextOptions(testInfo: TestInfo): BrowserContextOptions {
    const { baseURL, viewport, isMobile, hasTouch, userAgent, deviceScaleFactor } =
        testInfo.project.use;
    return { baseURL, viewport, isMobile, hasTouch, userAgent, deviceScaleFactor };
}

async function newUser(
    browser: Browser,
    options: BrowserContextOptions,
    label: string,
    tree: Tree,
): Promise<User> {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    // the passkey lives on this session: read it (passkeyOf) before the page closes
    const cdp = await context.newCDPSession(page);
    await cdp.send("WebAuthn.enable");
    const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
        options: {
            protocol: "ctap2",
            transport: "internal",
            hasResidentKey: true,
            hasUserVerification: true,
            isUserVerified: true,
            automaticPresenceSimulation: true,
        },
    });
    return { label, tree, context, page, cdp, authenticatorId };
}

/** A username no earlier run has taken: 5–20 letters, digits and underscores. */
export function freshUsername(prefix: string): string {
    const stamp = Date.now().toString(36);
    const salt = Math.floor(Math.random() * 36 ** 3)
        .toString(36)
        .padStart(3, "0");
    return `${prefix}_${stamp}${salt}`.slice(0, 20);
}

/** Signs a new user up with a passkey, through the tree's own sign-up, and waits for the app. */
export async function signUp(user: User, username: string): Promise<void> {
    const page = user.page;
    if (user.tree === "v3") {
        await page.goto("/home");
        await page.getByRole("button", { name: "Create account" }).first().click();
        const dialog = page.getByRole("dialog", { name: "Create your account" });
        await dialog.getByPlaceholder("Choose a username").fill(username);
        await expect(dialog.getByRole("status")).toHaveText("Available");
        await dialog.getByRole("button", { name: "Continue" }).click();
        await page.waitForURL("**/chats**", { timeout: 90_000 });
    } else {
        await page.goto("/");
        await page.getByRole("button", { name: "Create account" }).click();
        await page.getByRole("textbox", { name: "Username" }).fill(username);
        await expect(page.getByText(`@${username} is available`)).toBeVisible();
        await page.getByRole("button", { name: "Continue" }).click();
    }
    await expect.poll(() => userIdOf(user), { timeout: 90_000 }).not.toBeUndefined();
}

/** Signs in with a passkey this user's authenticator was given (passkeyOf another user). */
export async function signIn(user: User, passkey: Credential): Promise<void> {
    await user.cdp.send("WebAuthn.addCredential", {
        authenticatorId: user.authenticatorId,
        credential: passkey,
    });
    const page = user.page;
    if (user.tree === "v3") {
        await page.goto("/home");
        await page.getByRole("button", { name: "Sign in" }).first().click();
        await page.getByRole("button", { name: "Sign in with Passkey" }).click();
    } else {
        await page.goto("/");
        await page.getByRole("button", { name: "I already have an account" }).click();
        await page
            .getByRole("button", { name: /passkey/i })
            .first()
            .click();
    }
    await expect.poll(() => userIdOf(user), { timeout: 90_000 }).not.toBeUndefined();
}

/** The passkey a user signed up with. */
export async function passkeyOf(user: User): Promise<Credential> {
    const { credentials } = await user.cdp.send("WebAuthn.getCredentials", {
        authenticatorId: user.authenticatorId,
    });
    expect(credentials).toHaveLength(1);
    return credentials[0];
}

/** The signed-in user's id, from their own client (the OC_E2E hook); undefined until signed in. */
export async function userIdOf(user: User): Promise<string | undefined> {
    try {
        return await user.page.evaluate(async () => {
            const client = window.__ocTest?.client;
            if (client === undefined) return undefined;
            const current = await client.getCurrentUser();
            return current.kind === "created_user" ? current.userId : undefined;
        });
    } catch (err) {
        // the app reloads itself after signing in; ask the page that follows
        if (err instanceof Error && /context was destroyed|navigation/i.test(err.message)) {
            return undefined;
        }
        throw err;
    }
}

/** The suite's `test`: `users.add(label)` makes each person a test needs, closed after it. */
export const test = base.extend<{ users: Users }>({
    users: async ({ browser }, use, testInfo) => {
        const made: User[] = [];
        const tree = treeOf(testInfo);
        await use({
            tree,
            async add(label) {
                const user = await newUser(browser, contextOptions(testInfo), label, tree);
                made.push(user);
                return user;
            },
        });
        for (const user of made) await user.context.close();
    },
});

export { expect };
