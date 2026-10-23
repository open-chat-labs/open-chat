<!-- Signing in again (SignInAgain) in the sign-in dialog, with why it's asked: before resetting a
     forgotten pin, before deleting the account, to confirm linking another sign-in method. -->
<script lang="ts">
    import {
        selectedAuthProviderStore,
        signInOptions,
        type AuthProvider,
        type OpenChat,
    } from "@client";
    import AuthDialog from "@openchat/ui/src/features/components/AuthDialog.svelte";
    import { getContext } from "svelte";
    import { OPTIONS } from "./auth.adapter";
    import { AUTH_WALLETS } from "./signIn";
    import type { SignInAgain } from "./signInAgain.svelte";

    interface Props {
        flow: SignInAgain;
        // why the user is asked to sign in again
        reason: string;
        // the only way offered, when it has to be the way this session signed in
        only?: AuthProvider;
        onClose: () => void;
    }

    let { flow, reason, only, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    // the ways to sign in again, the last one used first
    const methods = $derived(
        signInOptions(
            only === undefined ? [] : [only],
            { webAuthn: "PublicKeyCredential" in window, native: client.isNativeApp() },
            selectedAuthProviderStore.value,
        ).map((o) => OPTIONS[o]),
    );
</script>

{#key flow.attempt}
    <!-- TODO(design): signing in again has no design; the sign-in dialog, with why it's asked -->
    <AuthDialog
        kind="login"
        reason={flow.linkFailure ?? reason}
        {methods}
        passkeySignup={false}
        email={flow.lastEmail()}
        wallets={AUTH_WALLETS}
        onMethod={flow.onMethod}
        onRequestEmailLink={flow.onRequestEmailLink}
        onCancelEmailLink={flow.dispose}
        {onClose} />
{/key}
