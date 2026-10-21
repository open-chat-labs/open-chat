<script lang="ts">
    import type { DelegationChain, ECDSAKeyIdentity } from "@icp-sdk/core/identity";
    import {
        AuthProvider,
        mobileWidth,
        pinNumberFailureStore,
        type OpenChat,
    } from "@client";
    import { getContext, onMount, untrack } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { pinNumberErrorMessageStore, type PinOperation } from "../../../stores/pinNumber";
    import {
        PinNumberForm,
        type PinSaveOutcome,
    } from "@src/logic/pin/pinNumberForm.svelte";
    import { toastStore } from "../../../stores/toast";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Pincode from "../../pincode/Pincode.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import ForgotPinLabel from "../ForgotPinLabel.svelte";
    import ReAuthenticate from "./ReAuthenticate.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        type: PinOperation;
        onPinSet?: (pin: string | undefined) => void;
        onClose: () => void;
    }

    let { type, onClose, onPinSet }: Props = $props();

    const form = new PinNumberForm(
        client,
        untrack(() => type),
    );

    onMount(() => {
        pinNumberFailureStore.set(undefined);
    });

    function onSaved(outcome: PinSaveOutcome | undefined) {
        if (outcome?.kind === "saved") {
            toastStore.showSuccessToast(i18nKey(`pinNumber.${outcome.operation}PinSuccess`));
            onPinSet?.(outcome.pin);
            onClose();
        }
    }

    async function changePin() {
        onSaved(await form.save());
    }

    async function reauthenticated(detail: {
        key: ECDSAKeyIdentity;
        delegation: DelegationChain;
        provider: AuthProvider;
        signInProofJwt: string | undefined;
    }) {
        onSaved(await form.reauthenticated(detail.signInProofJwt));
    }

    let operation = $derived(form.operation);
    let title = $derived(i18nKey(`pinNumber.${operation.kind}PinTitle`));
    let message = $derived(
        operation.kind === "change" ? undefined : i18nKey(`pinNumber.${operation.kind}PinMessage`),
    );
    let action = $derived(i18nKey(`pinNumber.${operation.kind}Pin`));
    let errorMessage = $derived(form.error ?? $pinNumberErrorMessageStore);
</script>

<ModalContent closeIcon fitToContent={!$mobileWidth} fixedWidth={false} {onClose}>
    {#snippet header()}
        <div class="header">
            <Translatable resourceKey={title} />
        </div>
    {/snippet}
    {#snippet body()}
        <div class="body">
            {#if operation.kind === "forgot"}
                {#if message !== undefined}
                    <ReAuthenticate onSuccess={reauthenticated} {message} />
                {/if}
                {#if errorMessage !== undefined}
                    <ErrorMessage>
                        <Translatable resourceKey={errorMessage} />
                    </ErrorMessage>
                {/if}
            {:else}
                {#if message !== undefined}
                    <p>
                        <Translatable resourceKey={message} />
                    </p>
                {/if}
                {#if form.showCurrentPin}
                    <div class="code">
                        {#if operation.kind === "change"}
                            <div>
                                <Translatable resourceKey={i18nKey("pinNumber.currentPin")} />
                            </div>
                        {/if}
                        <Pincode type="numeric" length={6} bind:code={form.currentPin} />
                        <ForgotPinLabel onForgot={() => form.forgot()} />
                    </div>
                {/if}
                {#if operation.kind !== "clear"}
                    <div class="code">
                        {#if operation.kind === "change"}
                            <div><Translatable resourceKey={i18nKey("pinNumber.newPin")} /></div>
                        {/if}
                        <Pincode type="numeric" length={6} bind:code={form.newPin} />
                    </div>
                {/if}
                {#if errorMessage !== undefined}
                    <ErrorMessage>
                        <Translatable resourceKey={errorMessage} />
                    </ErrorMessage>
                {/if}
            {/if}
        </div>
    {/snippet}
    {#snippet footer()}
        <div class="footer">
            {#if operation.kind === "forgot"}
                <ButtonGroup align="center">
                    <Button disabled={form.busy} secondary onClick={onClose}
                        ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                </ButtonGroup>
            {:else}
                <ButtonGroup align="center">
                    <Button disabled={form.busy} secondary onClick={onClose}
                        ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                    <Button loading={form.busy} disabled={form.busy || !form.valid} onClick={changePin}
                        ><Translatable resourceKey={action} /></Button>
                </ButtonGroup>
            {/if}
        </div>
    {/snippet}
</ModalContent>

<style lang="scss">
    .header {
        text-align: center;
    }

    .body {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: $sp4;
        max-width: 500px;
    }

    .code {
        display: flex;
        flex-direction: column;
        gap: $sp3;
    }
</style>
