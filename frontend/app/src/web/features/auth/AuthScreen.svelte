<!-- Sign-in inside the app: AuthDialog opens whenever the client asks for a sign-in (identityStateStore
     goes to "logging_in": the rail's Sign in, a guest action), and turns into sign-up once someone
     is signed in without an account. Landing and Learn host their own dialog. -->
<script lang="ts">
    import {
        identityStateStore,
        querystringStore,
        selectedAuthProviderStore,
        type OpenChat,
    } from "@client";
    import AuthDialog from "@openchat/ui/src/features/components/AuthDialog.svelte";
    import { getContext, onDestroy, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import {
        afterClosedSignup,
        nextAuthKind,
        onAuthClosed,
        onAuthLeft,
        type AuthDialogKind,
    } from "./auth.adapter";
    import { AuthDialogProps } from "./authDialog.svelte";
    import { createAuth, type Auth } from "./signIn";

    const client = getContext<OpenChat>("client");

    // made when the dialog first opens: most sessions are signed in and never need them
    let auth: Auth | undefined = undefined;
    let dialog = $state<AuthDialogProps | undefined>(undefined);

    let kind = $state<AuthDialogKind | null>(null);
    // a sign-up closed while its user loaded, to sign out once it has (afterClosedSignup)
    let signOutOnceLoaded = false;
    $effect(() => {
        const state = $identityStateStore;
        untrack(() => {
            if (signOutOnceLoaded) {
                const next = afterClosedSignup(state);
                if (next === "wait") return;
                signOutOnceLoaded = false;
                if (next === "sign_out") {
                    client.logout();
                    return;
                }
            }
            const opening = kind === null;
            kind = nextAuthKind(kind, state);
            if (opening && kind !== null) open();
        });
    });

    function open() {
        auth ??= createAuth(client, { translate: (key) => $_(key) });
        dialog = new AuthDialogProps(auth, selectedAuthProviderStore.value);
    }

    const dialogProps = $derived(dialog?.props($querystringStore.getAll("auth")));

    function close() {
        auth?.stopEmail();
        auth?.cancelSignup();
        kind = null;
        switch (onAuthClosed(identityStateStore.value)) {
            case "anon":
                client.updateIdentityState({ kind: "anon" });
                break;
            case "sign_out":
                client.logout();
                break;
            case "sign_out_once_loaded":
                signOutOnceLoaded = true;
                break;
        }
    }

    onDestroy(() => {
        auth?.stopEmail();
        if (onAuthLeft(identityStateStore.value) === "anon") {
            client.updateIdentityState({ kind: "anon" });
        }
    });
</script>

{#if kind !== null && dialogProps !== undefined}
    <AuthDialog {kind} {...dialogProps} onClose={close} />
{/if}
