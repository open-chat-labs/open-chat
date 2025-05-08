<script lang="ts">
    import type { DelegationChain, ECDSAKeyIdentity } from "@dfinity/identity";
    import { AuthProvider, app, ui, type OpenChat, type Verification } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import {
        pinNumberErrorMessageStore,
        supportsForgot,
        type PinOperation,
    } from "../../../stores/pinNumber";
    import { toastStore } from "../../../stores/toast";
    import Button from "../../Button.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import ModalContent from "../../ModalContent.svelte";
    import Pincode from "../../pincode/Pincode.svelte";
    import Translatable from "../../Translatable.svelte";
    import ForgotPinLabel from "../ForgotPinLabel.svelte";
    import ReAuthenticate from "./ReAuthenticate.svelte";

    const client = getContext<OpenChat>("client");

    interface Props {
        type: PinOperation;
        onPinSet?: (pin: string | undefined) => void;
        onClose: () => void;
    }

    let { type = $bindable(), onClose, onPinSet }: Props = $props();

    let busy = $state(false);
    let currPinArray: string[] = $state([]);
    let newPinArray: string[] = $state([]);
    let delegation: DelegationChain | undefined = $state(undefined);

    onMount(() => {
        app.pinNumberFailure = undefined;
    });

    function isPinValid(pin: string[]): boolean {
        return pin.filter((c) => /^[0-9]$/.test(c)).length === 6;
    }

    function getVerification(): Verification {
        if (delegation !== undefined) {
            return {
                kind: "delegation_verification",
                delegation: delegation.toJSON(),
            };
        }

        if (type.kind === "clear" || type.kind === "change") {
            return {
                kind: "pin_verification",
                pin: currPinArray.join(""),
            };
        }

        return { kind: "no_verification" };
    }

    function changePin(): Promise<void> {
        const newPin = type.kind === "clear" ? undefined : newPinArray.join("");

        busy = true;

        return client
            .setPinNumber(getVerification(), newPin)
            .then((resp) => {
                if (resp.kind === "success") {
                    toastStore.showSuccessToast(i18nKey(`pinNumber.${type.kind}PinSuccess`));
                    onPinSet?.(newPin);
                    onClose();
                } else {
                    console.log("SetPinNumber failed", resp);
                }
            })
            .finally(() => {
                busy = false;
            });
    }

    function reauthenticated(detail: {
        key: ECDSAKeyIdentity;
        delegation: DelegationChain;
        provider: AuthProvider;
    }) {
        if (type.kind !== "forgot") return;

        delegation = detail.delegation;
        switch (type.while.kind) {
            case "clear":
                type = { kind: "clear" };
                changePin(); // no further input is required so just do it
                break;
            default:
                type = { kind: "change" };
        }
    }

    function onForgot() {
        if (supportsForgot(type)) {
            type = {
                kind: "forgot",
                while: type,
            };
        }
    }

    let title = $derived(i18nKey(`pinNumber.${type.kind}PinTitle`));
    let message = $derived(
        type.kind === "change" ? undefined : i18nKey(`pinNumber.${type.kind}PinMessage`),
    );
    let action = $derived(i18nKey(`pinNumber.${type.kind}Pin`));
    let verificationValid = $derived(isPinValid(currPinArray) || delegation !== undefined);
    let changeValid = $derived(
        type.kind === "change" && isPinValid(newPinArray) && verificationValid,
    );
    let setValid = $derived(type.kind === "set" && isPinValid(newPinArray));
    let clearValid = $derived(type.kind === "clear" && verificationValid);
    let isValid = $derived(type.kind === "forgot" || changeValid || setValid || clearValid);
    let showCurrentPin = $derived(type.kind !== "set" && delegation === undefined);
    let errorMessage = $derived($pinNumberErrorMessageStore);
</script>

<ModalContent closeIcon fitToContent={!ui.mobileWidth} fixedWidth={false} {onClose}>
    {#snippet header()}
        <div class="header">
            <Translatable resourceKey={title} />
        </div>
    {/snippet}
    {#snippet body()}
        <div class="body">
            {#if type.kind === "forgot"}
                {#if message !== undefined}
                    <ReAuthenticate onSuccess={reauthenticated} {message} />
                {/if}
            {:else}
                {#if message !== undefined}
                    <p>
                        <Translatable resourceKey={message} />
                    </p>
                {/if}
                {#if showCurrentPin}
                    <div class="code">
                        {#if type.kind === "change"}
                            <div>
                                <Translatable resourceKey={i18nKey("pinNumber.currentPin")} />
                            </div>
                        {/if}
                        <Pincode type="numeric" length={6} bind:code={currPinArray} />
                        <ForgotPinLabel {onForgot} />
                    </div>
                {/if}
                {#if type.kind !== "clear"}
                    <div class="code">
                        {#if type.kind === "change"}
                            <div><Translatable resourceKey={i18nKey("pinNumber.newPin")} /></div>
                        {/if}
                        <Pincode type="numeric" length={6} bind:code={newPinArray} />
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
            {#if type.kind === "forgot"}
                <ButtonGroup align="center">
                    <Button disabled={busy} secondary onClick={onClose}
                        ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                </ButtonGroup>
            {:else}
                <ButtonGroup align="center">
                    <Button disabled={busy} secondary onClick={onClose}
                        ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                    <Button loading={busy} disabled={busy || !isValid} onClick={changePin}
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
