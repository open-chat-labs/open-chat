<script lang="ts">
    import type { DelegationChain, ECDSAKeyIdentity } from "@icp-sdk/core/identity";
    import { Body, Button, Container, Subtitle } from "component-lib";
    import {
        AuthProvider,
        pinNumberFailureStore,
        type OpenChat,
        type Verification,
    } from "openchat-client";
    import { getContext, onMount } from "svelte";
    import Lock from "svelte-material-icons/Lock.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import {
        pinNumberErrorMessageStore,
        supportsForgot,
        type PinOperation,
    } from "../../../stores/pinNumber";
    import { toastStore } from "../../../stores/toast";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Pincode from "../../pincode/Pincode.svelte";
    import Translatable from "../../Translatable.svelte";
    import ForgotPinLabel from "../ForgotPinLabel.svelte";
    import ReAuthenticate from "../profile/ReAuthenticate.svelte";

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
        pinNumberFailureStore.set(undefined);
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

<Container height={"hug"} padding={"xl"} gap={"xl"} direction={"vertical"}>
    <Subtitle fontWeight={"bold"}>
        <Translatable resourceKey={title} />
    </Subtitle>

    <Container direction={"vertical"} gap={"lg"}>
        {#if type.kind === "forgot"}
            {#if message !== undefined}
                <ReAuthenticate onSuccess={reauthenticated} {message} />
            {/if}
        {:else}
            {#if message !== undefined}
                <Body colour={"textSecondary"}>
                    <Translatable resourceKey={message} />
                </Body>
            {/if}
            {#if showCurrentPin}
                <Container
                    overflow={"visible"}
                    crossAxisAlignment={"center"}
                    direction={"vertical"}>
                    <Pincode
                        subtext={type.kind === "change"
                            ? i18nKey("pinNumber.currentPin")
                            : undefined}
                        type="numeric"
                        length={6}
                        bind:code={currPinArray} />
                </Container>
            {/if}
            {#if type.kind !== "clear"}
                <Pincode
                    subtext={type.kind === "change" ? i18nKey("pinNumber.newPin") : undefined}
                    type="numeric"
                    length={6}
                    bind:code={newPinArray} />
            {/if}
        {/if}
    </Container>

    {#if type.kind !== "forgot"}
        <Container
            padding={["xl", "zero", "zero", "zero"]}
            direction={"vertical"}
            gap={"xs"}
            crossAxisAlignment={"center"}>
            <Button loading={busy} disabled={busy || !isValid} onClick={changePin}>
                {#snippet icon(color)}
                    <Lock {color} />
                {/snippet}
                <Translatable resourceKey={action} />
            </Button>
            {#if type.kind !== "set"}
                <ForgotPinLabel {onForgot} />
            {/if}
        </Container>
    {/if}

    {#if errorMessage !== undefined}
        <ErrorMessage>
            <Translatable resourceKey={errorMessage} />
        </ErrorMessage>
    {/if}

    <!-- <Container gap={"md"} crossAxisAlignment={"end"} mainAxisAlignment={"end"}>
        {#if type.kind === "forgot"}
            <CommonButton disabled={busy} onClick={onClose} size={"medium"}>
                <Translatable resourceKey={i18nKey("cancel")} />
            </CommonButton>
        {:else}
            <CommonButton disabled={busy} onClick={onClose} size={"small_text"}>
                <Translatable resourceKey={i18nKey("cancel")} />
            </CommonButton>
            <CommonButton
                loading={busy}
                disabled={busy || !isValid}
                onClick={changePin}
                mode={"active"}
                size={"medium"}>
                {#snippet icon(color)}
                    <ShieldPlusOutline {color} />
                {/snippet}
                <Translatable resourceKey={action} />
            </CommonButton>
        {/if}
    </Container> -->
</Container>

<style lang="scss">
    .code {
        display: flex;
        flex-direction: column;
        gap: $sp3;
    }
</style>
