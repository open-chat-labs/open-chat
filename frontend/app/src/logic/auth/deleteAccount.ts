// Deleting the user's account, in every tree: only with what signing in again gave (a ReAuthSuccess,
// from ReAuthentication or the client's reAuthenticate, which refuses another account), its key and
// the delegation to it. The client logs out once the account is gone.

import type { OpenChat } from "@client";
import type { ReAuthSuccess } from "./reAuthentication.svelte";

/** Whether the account was deleted. */
export function deleteAccount(
    client: Pick<OpenChat, "deleteCurrentUser">,
    signedInAgain: ReAuthSuccess,
): Promise<boolean> {
    return client.deleteCurrentUser(
        signedInAgain.key.getKeyPair(),
        signedInAgain.delegation.toJSON(),
    );
}
