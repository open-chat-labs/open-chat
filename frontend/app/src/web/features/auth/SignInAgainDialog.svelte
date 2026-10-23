<!-- Signing in again (SignInAgain) in the sign-in dialog, with why it's asked: before resetting a
     forgotten pin, before deleting the account. -->
<script lang="ts">
    import { selectedAuthProviderStore, signInOptions, type OpenChat } from "@client";
    import AuthDialog from "@openchat/ui/src/features/components/AuthDialog.svelte";
    import { getContext } from "svelte";
    import { OPTIONS } from "./auth.adapter";
    import { AUTH_WALLETS } from "./signIn";
    import type { SignInAgain } from "./signInAgain.svelte";

    interface Props {
        flow: SignInAgain;
        // why the user is asked to sign in again
        reason: string;
        onClose: () => void;
    }

    let { flow, reason, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    // the ways to sign in again, the last one used first
    const methods = signInOptions(
        [],
        { webAuthn: "PublicKeyCredential" in window, native: client.isNativeApp() },
        selectedAuthProviderStore.value,
    ).map((o) => OPTIONS[o]);
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
