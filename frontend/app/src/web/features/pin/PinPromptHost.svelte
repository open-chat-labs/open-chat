<!-- One waiting PIN request (pinNumberResolverStore), answered once (PinAnswer). AppScreen keys it
     by the request, so each request starts fresh. "I've forgotten my pin" swaps the prompt for
     signing in again and choosing a new PIN, which answers the request; closing that goes back to
     the prompt, still waiting. -->
<script lang="ts">
    import { type OpenChat, type ResourceKey } from "@client";
    import type { PinNumberResolver } from "@shared";
    import { pinNumberErrorMessageStore } from "@src/stores/pinNumber";
    import { toastStore } from "@src/stores/toast";
    import { i18nKey, interpolate } from "@i18n/i18n";
    import { getContext, onDestroy, untrack } from "svelte";
    import { _ } from "svelte-i18n";
    import SignInAgainDialog from "../auth/SignInAgainDialog.svelte";
    import { ForgotPin } from "./forgotPin.svelte";
    import NewPinDialog from "./NewPinDialog.svelte";
    import PinDialog from "./PinDialog.svelte";
    import { PinAnswer } from "./pinPrompt";

    let { request }: { request: PinNumberResolver } = $props();

    const client = getContext<OpenChat>("client");
    const answer = new PinAnswer(untrack(() => request));
    const translate = (key: ResourceKey) => interpolate($_, key);

    let forgot = $state<ForgotPin | undefined>();

    function openForgot() {
        forgot = new ForgotPin(client, translate);
    }

    function closeForgot() {
        forgot?.dispose();
        forgot = undefined;
    }

    // going away mid-way (signed out, or a new request) stops waiting on an emailed link
    onDestroy(() => forgot?.dispose());

    async function saveNewPin(flow: ForgotPin) {
        const outcome = await flow.save();
        if (outcome.kind !== "saved" || outcome.pin === undefined) return;
        toastStore.showSuccessToast(i18nKey(`pinNumber.${outcome.operation}PinSuccess`));
        answer.enter(outcome.pin);
    }

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
    <SignInAgainDialog
        flow={forgot.signIn}
        reason={$_("pinNumber.forgotPinMessage")}
        onClose={closeForgot} />
{:else}
    {@const flow = forgot}
    <NewPinDialog
        error={saveError}
        canSave={flow.form.valid && !flow.form.busy}
        onInput={(pin) => (flow.form.newPin = pin.split(""))}
        onSave={() => saveNewPin(flow)}
        onClose={closeForgot} />
{/if}
