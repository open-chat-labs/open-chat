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
        endsDismissal,
        nextAuthKind,
        onAuthClosed,
        type AuthDialogKind,
    } from "./auth.adapter";
    import { AuthDialogProps } from "./authDialog.svelte";
    import { createAuth, type Auth } from "./signIn";

    const client = getContext<OpenChat>("client");

    // made when the dialog first opens: most sessions are signed in and never need them
    let auth: Auth | undefined = undefined;
    let dialog = $state<AuthDialogProps | undefined>(undefined);

    let kind = $state<AuthDialogKind | null>(null);
    // closed by the person: stays closed until the client asks for a sign-in again (endsDismissal)
    let dismissed = false;
    $effect(() => {
        const state = $identityStateStore;
        untrack(() => {
            if (dismissed) {
                if (!endsDismissal(state)) return;
                dismissed = false;
            }
            const opening = kind === null;
            kind = nextAuthKind(kind, state);
            if (opening && kind !== null) open();
        });
    });

    // the method last used, read as it opens: starting one doesn't move the tiles
    let last = $state(selectedAuthProviderStore.value);

    function open() {
        auth ??= createAuth(client, { translate: (key) => $_(key) });
        dialog ??= new AuthDialogProps(auth);
        last = selectedAuthProviderStore.value;
    }

    const dialogProps = $derived(dialog?.props($querystringStore.getAll("auth"), last));

    function close() {
        kind = null;
        dismissed = true;
        auth?.cancel();
    }

    onDestroy(() => {
        auth?.dispose();
        if (onAuthClosed(identityStateStore.value) === "anon") {
            client.updateIdentityState({ kind: "anon" });
        }
    });
</script>

{#if kind !== null && dialogProps !== undefined}
    <AuthDialog {kind} {...dialogProps} onClose={close} />
{/if}
