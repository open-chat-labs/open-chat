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
        afterAbandoned,
        nextAuthKind,
        onAuthClosed,
        withoutAccount,
        type AuthDialogKind,
    } from "./auth.adapter";
    import { AuthDialogProps } from "./authDialog.svelte";
    import { createAuth, signInAbandoned, type Auth } from "./signIn";

    const client = getContext<OpenChat>("client");

    // made when the dialog first opens: most sessions are signed in and never need them
    let auth: Auth | undefined = undefined;
    let dialog = $state<AuthDialogProps | undefined>(undefined);

    let kind = $state<AuthDialogKind | null>(null);
    $effect(() => {
        const state = $identityStateStore;
        untrack(() => {
            // a sign-in someone walked away from (closed this dialog, or Landing's) doesn't open it
            // again: only the client asking for a sign-in does (afterAbandoned)
            if (signInAbandoned() && afterAbandoned(state) !== "end") return;
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
        dialog.opening();
        last = selectedAuthProviderStore.value;
    }

    const dialogProps = $derived(dialog?.props($querystringStore.getAll("auth"), last));

    function close() {
        kind = null;
        auth?.cancel();
    }

    // leaving the app with the dialog open walks away from its sign-in, as closing it does; an
    // identity without an account keeps it, for the sign-up form when the app is back
    onDestroy(() => {
        const state = identityStateStore.value;
        if (kind !== null && !withoutAccount(state)) {
            auth?.cancel();
        } else if (onAuthClosed(state) === "anon") {
            client.updateIdentityState({ kind: "anon" });
        }
        auth?.dispose();
    });
</script>

{#if kind !== null && dialogProps !== undefined}
    <AuthDialog {kind} {...dialogProps} onClose={close} />
{/if}
