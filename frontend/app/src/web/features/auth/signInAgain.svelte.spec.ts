import { type OpenChat, type ReAuthMethod, type ReAuthOutcome } from "@client";
import { SignInAgain } from "./signInAgain.svelte";

function setup(sessionsOwn?: boolean) {
    const reAuthenticate = vi.fn(
        async (_method: ReAuthMethod): Promise<ReAuthOutcome> => ({ kind: "cancelled" }),
    );
    const client: Pick<OpenChat, "reAuthenticate"> = { reAuthenticate };
    const flow = new SignInAgain(
        client as OpenChat,
        () => "",
        async () => undefined,
        sessionsOwn,
    );
    return { flow, reAuthenticate };
}

describe("signing in again with a passkey", () => {
    test("takes any of the user's passkeys", async () => {
        const { flow, reAuthenticate } = setup();
        await flow.onMethod("passkey", undefined).catch(() => {});
        expect(reAuthenticate.mock.calls[0][0]).toEqual({ kind: "passkey" });
    });

    /** Invariant: confirming a link can't offer the passkey being linked, which isn't one yet. */
    test("takes only the session's own when it has to be", async () => {
        const { flow, reAuthenticate } = setup(true);
        await flow.onMethod("passkey", undefined).catch(() => {});
        expect(reAuthenticate.mock.calls[0][0]).toEqual({ kind: "session_passkey" });
    });
});
