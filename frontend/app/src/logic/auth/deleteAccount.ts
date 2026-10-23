// Deleting the user's account, in every tree: only with the key and delegation of the user signing
// in again (ReAuthentication, or the client's reAuthenticate, which refuses another account). The
// client logs out once it's gone.

import type { OpenChat } from "@client";

type DeleteCurrentUser = OpenChat["deleteCurrentUser"];

/** What signing in again gave (a ReAuthSuccess): its key, and the delegation to it. */
export type SignedInAgain = {
    key: { getKeyPair(): Parameters<DeleteCurrentUser>[0] };
    delegation: { toJSON(): Parameters<DeleteCurrentUser>[1] };
};

/** Whether the account was deleted. */
export function deleteAccount(
    client: Pick<OpenChat, "deleteCurrentUser">,
    signedInAgain: SignedInAgain,
): Promise<boolean> {
    return client.deleteCurrentUser(
        signedInAgain.key.getKeyPair(),
        signedInAgain.delegation.toJSON(),
    );
}
