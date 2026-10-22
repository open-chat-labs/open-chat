<!-- One waiting PIN request (pinNumberResolverStore), answered once (PinAnswer). AppScreen keys it
     by the request, so each request starts fresh. "I've forgotten my pin" swaps the prompt for
     signing in again and choosing a new PIN, which answers the request; closing that goes back to
     the prompt, still waiting. -->
<script lang="ts">
    import {
        selectedAuthProviderStore,
        signInOptions,
        type OpenChat,
        type ResourceKey,
    } from "@client";
    import AuthDialog from "@openchat/ui/src/features/components/AuthDialog.svelte";
    import type { PinNumberResolver } from "@shared";
    import { pinNumberErrorMessageStore } from "@src/stores/pinNumber";
    import { toastStore } from "@src/stores/toast";
    import { i18nKey } from "@i18n/i18n";
    import { getContext, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import { OPTIONS } from "../auth/auth.adapter";
    import { AUTH_WALLETS } from "../auth/signIn";
    import { ForgotPin } from "./forgotPin.svelte";
    import NewPinDialog from "./NewPinDialog.svelte";
    import PinDialog from "./PinDialog.svelte";
    import { PinAnswer } from "./pinPrompt";

    let { request }: { request: PinNumberResolver } = $props();

    const client = getContext<OpenChat>("client");
    const answer = new PinAnswer(untrack(() => request));
    const translate = (key: ResourceKey) => $_(key.key, { values: key.params });

    let forgot = $state<ForgotPin | undefined>();

    function openForgot() {
        forgot = new ForgotPin(client, translate);
    }

    function closeForgot() {
        forgot?.dispose();
        forgot = undefined;
    }

    async function saveNewPin(flow: ForgotPin) {
        const outcome = await flow.save();
        if (outcome.kind !== "saved" || outcome.pin === undefined) return;
        toastStore.showSuccessToast(i18nKey(`pinNumber.${outcome.operation}PinSuccess`));
        answer.enter(outcome.pin);
    }

    // the ways to sign in again, the last one used first
    const methods = signInOptions(
        [],
        { webAuthn: "PublicKeyCredential" in window, native: client.isNativeApp() },
        selectedAuthProviderStore.value,
    ).map((o) => OPTIONS[o]);

    const saveError = $derived.by(() => {
        const error = forgot?.form.error ?? $pinNumberErrorMessageStore;
        return error === undefined ? undefined : translate(error);
    });
</script>

{#if forgot === undefined}
    <PinDialog
        onEnter={(pin) => answer.enter(pin)}
        onClose={() => answer.close()}
        onForgot={openForgot} />
{:else if !forgot.signedIn}
    {@const flow = forgot}
    {#key flow.attempt}
        <!-- TODO(design): signing in again has no design; the sign-in dialog, with why it's asked -->
        <AuthDialog
            kind="login"
            reason={flow.linkFailure ?? $_("pinNumber.forgotPinMessage")}
            {methods}
            passkeySignup={false}
            email={flow.lastEmail()}
            wallets={AUTH_WALLETS}
            onMethod={flow.onMethod}
            onRequestEmailLink={flow.onRequestEmailLink}
            onCancelEmailLink={flow.dispose}
            onClose={closeForgot} />
    {/key}
{:else}
    {@const flow = forgot}
    <NewPinDialog
        error={saveError}
        canSave={flow.form.valid && !flow.form.busy}
        onInput={(pin) => (flow.form.newPin = pin.split(""))}
        onSave={() => saveNewPin(flow)}
        onClose={closeForgot} />
{/if}
