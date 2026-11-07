<!-- Deleting the account (You → Account), once the user has confirmed it: they sign in again to show
     it's them (logic/auth/reAuthentication, as the old trees' ReAuthenticate), with one of the ways
     linked to the account this phone can use (a passkey, Internet Identity, Google via NFID, or an
     emailed link), then the account is deleted with that sign-in (logic/auth/deleteAccount) and the
     client signs out. A wallet's sign-in (Ethereum, Solana) isn't offered here (GAPS.md). The host
     mounts it again each time it opens. -->
<script lang="ts">
    import { AuthProvider, signInOptions, type OpenChat } from "@client";
    import Button from "@openchat/ui/src/lib/components/Button.svelte";
    import Spinner from "@openchat/ui/src/lib/components/Spinner.svelte";
    import BottomSheet from "@openchat/ui/src/native/BottomSheet.svelte";
    import { interpolate } from "@src/i18n/i18n";
    import { deleteAccount } from "@src/logic/auth/deleteAccount";
    import { ReAuthentication, type ReAuthSuccess } from "@src/logic/auth/reAuthentication.svelte";
    import { getContext, onDestroy, onMount } from "svelte";
    import { _ } from "svelte-i18n";

    type Props = { open: boolean; onClose: () => void };

    let { open, onClose }: Props = $props();

    const client = getContext<OpenChat>("client");

    const reAuth = new ReAuthentication(client);
    onMount(() => void reAuth.loadProviders());
    onDestroy(() => reAuth.destroy());

    // the ways this phone can sign in again with: no wallets here
    const WALLETS: AuthProvider[] = [AuthProvider.ETH, AuthProvider.SOL];
    const options = $derived(
        signInOptions(reAuth.providers, {
            webAuthn: "PublicKeyCredential" in window,
            native: client.isNativeApp(),
        }).filter((p) => !WALLETS.includes(p)),
    );

    const LABELS: Record<AuthProvider, string> = {
        [AuthProvider.PASSKEY]: "native.you.account.passkey",
        [AuthProvider.II]: "native.you.account.ii",
        [AuthProvider.EMAIL]: "native.you.account.email",
        [AuthProvider.NFID]: "native.you.account.nfid",
        [AuthProvider.ETH]: "native.you.account.eth",
        [AuthProvider.SOL]: "native.you.account.sol",
    };

    let email = $state(reAuth.lastEmail());
    let busy = $state(false);
    // deleting, or why it failed
    let deleting = $state(false);
    let failed = $state(false);

    const error = $derived(
        failed
            ? $_("danger.deleteAccountFailed")
            : reAuth.error !== undefined
              ? interpolate($_, reAuth.error)
              : undefined,
    );

    async function signIn(provider: AuthProvider) {
        if (busy || deleting) return;
        if (provider === AuthProvider.EMAIL && !email.includes("@")) return;
        busy = true;
        failed = false;
        try {
            const success = await reAuth.login(provider, email.trim());
            if (success !== undefined) await remove(success);
        } finally {
            busy = false;
        }
    }

    // the client signs out once it's gone, which takes the app to the start
    async function remove(signedInAgain: ReAuthSuccess) {
        deleting = true;
        try {
            if (await deleteAccount(client, signedInAgain)) return;
        } catch (err) {
            console.warn("Unable to delete the account", err);
        }
        deleting = false;
        failed = true;
    }

    function close() {
        if (deleting) return;
        reAuth.destroy();
        onClose();
    }
</script>

<BottomSheet {open} onClose={close} title={$_("danger.deleteAccount")}>
    <div class="body">
        {#if deleting}
            <div class="state">
                <Spinner />
                <span>{$_("native.you.account.deleting")}</span>
            </div>
        {:else if reAuth.step === "signing_in_with_email"}
            <div class="state">
                <Spinner />
                <span>{$_("native.you.account.checkEmail", { values: { email } })}</span>
                {#if reAuth.verificationCode !== undefined}
                    <span class="code">{reAuth.verificationCode}</span>
                {/if}
            </div>
            <Button
                label={$_("cancel")}
                variant="secondary"
                size="lg"
                fullWidth
                onClick={() => reAuth.cancelEmail()} />
        {:else}
            <p class="lead">{$_("native.you.account.signInAgain")}</p>
            {#each options as provider (provider)}
                {#if provider === AuthProvider.EMAIL}
                    <label class="field">
                        <input
                            type="email"
                            value={email}
                            oninput={(e) => (email = e.currentTarget.value)}
                            placeholder={$_("native.you.account.emailPlaceholder")}
                            aria-label={$_("native.you.account.email")}
                            autocomplete="email"
                            autocapitalize="none" />
                    </label>
                    <Button
                        label={$_("native.you.account.sendLink")}
                        icon="mail"
                        variant="secondary"
                        size="lg"
                        fullWidth
                        disabled={busy || !email.includes("@")}
                        onClick={() => void signIn(provider)} />
                {:else}
                    <Button
                        label={$_(LABELS[provider])}
                        icon={provider === AuthProvider.PASSKEY ? "passkey" : "key"}
                        variant={provider === options[0] ? "primary" : "secondary"}
                        size="lg"
                        fullWidth
                        disabled={busy}
                        onClick={() => void signIn(provider)} />
                {/if}
            {:else}
                <p class="lead">{$_("native.you.account.noSignIn")}</p>
            {/each}
        {/if}
        {#if error !== undefined && !deleting}
            <p class="error">{error}</p>
        {/if}
    </div>
</BottomSheet>

<style lang="scss">
    @use "@openchat/ui/src/lib/styles/mixins" as *;

    .body {
        display: flex;
        flex-direction: column;
        gap: var(--space-12);
        padding: var(--space-4) var(--space-16) var(--space-16);
    }

    .lead,
    .error {
        margin: 0;
        padding: 0 4px;
        font: var(--weight-regular) text-size(14px) / 1.5 var(--font-sans);
        color: var(--ink-3);
        text-wrap: pretty;
    }

    .error {
        color: var(--status-danger);
    }

    .state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--space-12);
        padding: var(--space-16) 0;
        text-align: center;
        font: var(--weight-medium) text-size(14px) / 1.5 var(--font-sans);
        color: var(--ink-2);
    }

    .code {
        font: var(--weight-bold) text-size(22px) / 1 var(--font-mono);
        letter-spacing: 0.12em;
        color: var(--ink);
    }

    .field {
        display: flex;
        align-items: center;
        height: 52px;
        padding: 0 var(--space-16);
        border-radius: 14px;
        background: var(--overlay-1);

        &:focus-within {
            box-shadow: inset 0 0 0 1.5px var(--accent);
        }
    }

    input {
        flex: 1;
        min-width: 0;
        height: 100%;
        padding: 0;
        border: 0;
        outline: 0;
        background: transparent;
        color: var(--ink);
        font: var(--weight-medium) text-size(16px) / 1 var(--font-sans);

        &::placeholder {
            color: var(--ink-4);
        }
    }
</style>
