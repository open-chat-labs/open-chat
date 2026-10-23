import {
    AuthProvider,
    ErrorCode,
    type LinkedAuthenticationPrincipal,
    type LinkIdentitiesResponse,
} from "@client";
import { DelegationChain, ECDSAKeyIdentity } from "@icp-sdk/core/identity";
import {
    confirmsAsSession,
    IdentityLinking,
    linkedAs,
    linkingPrincipal,
    type LinkingIdentity,
} from "./identityLinking.svelte";

// a sign-in as `root`: a session key, and the delegation from `root` to it
async function signIn(root: ECDSAKeyIdentity, provider: AuthProvider): Promise<LinkingIdentity> {
    const key = await ECDSAKeyIdentity.generate();
    const delegation = await DelegationChain.create(root, key.getPublicKey());
    return { key, delegation, provider };
}

// an identity linked to the account, the one this session signed in with or not
function linked(root: ECDSAKeyIdentity, isCurrentIdentity: boolean): LinkedAuthenticationPrincipal {
    return {
        principal: root.getPrincipal().toString(),
        originatingCanister: "zzzxd-webau-thnke-yr7oc-cai",
        isIIPrincipal: false,
        isCurrentIdentity,
        webAuthnKey: undefined,
        provider: AuthProvider.PASSKEY,
    };
}

async function setup(resp: LinkIdentitiesResponse = "success") {
    const session = await ECDSAKeyIdentity.generate();
    const client = {
        AuthPrincipal: session.getPrincipal().toString(),
        getAuthenticationPrincipals: vi.fn(
            async (): Promise<LinkedAuthenticationPrincipal[]> => [],
        ),
        linkIdentities: vi.fn(async () => resp),
    };
    const linking = new IdentityLinking(client);
    const newMethod = await signIn(await ECDSAKeyIdentity.generate(), AuthProvider.II);
    return { client, linking, session, newMethod };
}

describe("linking a sign-in method", () => {
    test("links the new method once the user's own sign-in confirms it", async () => {
        const { client, linking, session, newMethod } = await setup();
        await linking.signedIn(newMethod);
        expect(linking.stage.kind).toBe("approver");
        await linking.signedIn(await signIn(session, AuthProvider.PASSKEY));
        expect(linking.stage.kind).toBe("ready_to_link");
        expect(await linking.link()).toEqual({ kind: "linked", initiator: newMethod });
        expect(client.linkIdentities).toHaveBeenCalledOnce();
    });

    test("a passkey session's confirming sign-in is the linked passkey it signed in with, not its auth principal", async () => {
        const { client, linking, newMethod } = await setup();
        const passkey = await ECDSAKeyIdentity.generate();
        const other = await ECDSAKeyIdentity.generate();
        client.getAuthenticationPrincipals.mockResolvedValue([
            linked(passkey, true),
            linked(other, false),
        ]);
        await linking.signedIn(newMethod);
        // another of the account's methods, not the one this session signed in with
        await linking.signedIn(await signIn(other, AuthProvider.PASSKEY));
        expect(linking.error?.key).toBe("identity.failure.principalMismatch");
        await linking.signedIn(await signIn(passkey, AuthProvider.PASSKEY));
        expect(linking.stage.kind).toBe("ready_to_link");
        expect((await linking.link()).kind).toBe("linked");
    });

    test("identities are linked only when the approving sign-in's principal is the current identity's; on a mismatch linkIdentities is never called", async () => {
        const { client, linking, newMethod } = await setup();
        await linking.signedIn(newMethod);
        // another account's sign-in confirming it
        await linking.signedIn(
            await signIn(await ECDSAKeyIdentity.generate(), AuthProvider.PASSKEY),
        );
        expect(linking.stage.kind).toBe("approver");
        expect(linking.error?.key).toBe("identity.failure.principalMismatch");
        expect((await linking.link()).kind).toBe("failed");
        expect(client.linkIdentities).not.toHaveBeenCalled();
    });

    test("an identity already linked to another account is reported as identity.failure.alreadyLinked and the link flow starts over", async () => {
        const already = {
            kind: "error" as const,
            code: ErrorCode.PrincipalAlreadyUsed,
            message: undefined,
        };
        const { linking, session, newMethod } = await setup(already);
        await linking.signedIn(newMethod);
        await linking.signedIn(await signIn(session, AuthProvider.PASSKEY));
        const outcome = await linking.link();
        expect(outcome.kind === "failed" && outcome.reason.key).toBe(
            "identity.failure.alreadyLinked",
        );
        expect(linking.stage).toEqual({ kind: "initiator" });
        expect(linking.error?.key).toBe("identity.failure.alreadyLinked");
    });

    test("a link that throws starts over and says so", async () => {
        const { client, linking, session, newMethod } = await setup();
        client.linkIdentities.mockRejectedValueOnce(new Error("offline"));
        vi.spyOn(console, "warn").mockImplementation(() => {});
        await linking.signedIn(newMethod);
        await linking.signedIn(await signIn(session, AuthProvider.PASSKEY));
        expect((await linking.link()).kind).toBe("failed");
        expect([linking.stage.kind, linking.linking]).toEqual(["initiator", false]);
    });

    test("when no identity is marked as this session's, any of the account's confirms it, another account's doesn't", async () => {
        const { client, linking, newMethod } = await setup();
        const passkey = await ECDSAKeyIdentity.generate();
        client.getAuthenticationPrincipals.mockResolvedValue([linked(passkey, false)]);
        await linking.signedIn(newMethod);
        await linking.signedIn(
            await signIn(await ECDSAKeyIdentity.generate(), AuthProvider.PASSKEY),
        );
        expect(linking.error?.key).toBe("identity.failure.principalMismatch");
        await linking.signedIn(await signIn(passkey, AuthProvider.PASSKEY));
        expect(linking.stage.kind).toBe("ready_to_link");
    });

    test("a confirming sign-in that can't be checked is refused and says so, without rejecting", async () => {
        const { client, linking, newMethod } = await setup();
        client.getAuthenticationPrincipals.mockRejectedValue(new Error("offline"));
        vi.spyOn(console, "warn").mockImplementation(() => {});
        await linking.signedIn(newMethod);
        await linking.signedIn(
            await signIn(await ECDSAKeyIdentity.generate(), AuthProvider.PASSKEY),
        );
        expect(linking.stage.kind).toBe("approver");
        expect(linking.error?.key).toBe("identity.failure.loginApprover");
        expect(client.linkIdentities).not.toHaveBeenCalled();
    });
});

describe("whose sign-in confirms a link", () => {
    test("the session's auth principal, or only the identity marked as the one it signed in with", async () => {
        const current = await ECDSAKeyIdentity.generate();
        const other = await ECDSAKeyIdentity.generate();
        const account = [linked(current, true), linked(other, false)];
        const principal = (k: ECDSAKeyIdentity) => k.getPrincipal().toString();
        expect(confirmsAsSession("auth", "auth", account)).toBe(true);
        expect(confirmsAsSession(principal(current), "auth", account)).toBe(true);
        expect(confirmsAsSession(principal(other), "auth", account)).toBe(false);
        expect(confirmsAsSession("someone-else", "auth", account)).toBe(false);
    });
});

describe("the linked identity a sign-in became", () => {
    test("a passkey by its credential, anything else by its principal", async () => {
        const root = await ECDSAKeyIdentity.generate();
        const ii = await signIn(root, AuthProvider.II);
        const credentialId = new Uint8Array([1, 2, 3]);
        const passkey: LinkingIdentity = {
            ...(await signIn(await ECDSAKeyIdentity.generate(), AuthProvider.PASSKEY)),
            webAuthnKey: { publicKey: new Uint8Array([9]), credentialId },
        };
        const iiEntry = { ...linked(root, false), principal: linkingPrincipal(ii) };
        const passkeyEntry = {
            ...linked(await ECDSAKeyIdentity.generate(), false),
            webAuthnKey: {
                publicKey: new Uint8Array([9]),
                credentialId: new Uint8Array([1, 2, 3]),
                origin: "https://oc.app",
                crossPlatform: false,
                aaguid: new Uint8Array(16),
            },
        };
        const account = [iiEntry, passkeyEntry];
        expect(linkedAs(account, ii)).toBe(iiEntry);
        // the identity canister gives a passkey a principal of its own
        expect(linkedAs(account, passkey)).toBe(passkeyEntry);
        expect(linkedAs([iiEntry], passkey)).toBeUndefined();
    });
});
