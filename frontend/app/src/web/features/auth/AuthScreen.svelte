<!-- Sign-in inside the app: AuthDialog opens whenever the client asks for a sign-in (identityStateStore
     goes to "logging_in": the rail's Sign in, a guest action), and turns into sign-up once someone
     is signed in without an account. Landing and Learn host their own dialog. -->
<script lang="ts">
    import { identityStateStore, querystringStore, type OpenChat } from "@client";
    import AuthDialog from "@openchat/ui/src/features/components/AuthDialog.svelte";
    import { getContext, onDestroy, untrack } from "svelte";
    import { authOptions, nextAuthKind, type AuthDialogKind } from "./auth.adapter";
    import { createAuth } from "./signIn";

    const client = getContext<OpenChat>("client");
    const auth = createAuth(client);
    onDestroy(auth.stopEmail);

    let kind = $state<AuthDialogKind | null>(null);
    $effect(() => {
        const state = $identityStateStore;
        untrack(() => (kind = nextAuthKind(kind, state)));
    });

    const methods = $derived(
        authOptions($querystringStore.getAll("auth"), "PublicKeyCredential" in window),
    );

    function close() {
        auth.stopEmail();
        kind = null;
        // as the old onboarding modal: a sign-in given up on goes back to anonymous, and so does
        // an identity that never got an account
        const state = identityStateStore.value;
        if (state.kind === "logging_in") {
            client.updateIdentityState({ kind: "anon" });
        } else if (state.kind === "registering") {
            client.logout();
        }
    }
</script>

{#if kind !== null}
    <AuthDialog
        {kind}
        {methods}
        wallets={auth.wallets}
        termsUrl={auth.termsUrl}
        checkUsername={auth.checkUsername}
        searchReferrers={auth.searchReferrers}
        onMethod={auth.onMethod}
        onRequestEmailLink={auth.onRequestEmailLink}
        onSignup={auth.onSignup}
        onClose={close} />
{/if}
