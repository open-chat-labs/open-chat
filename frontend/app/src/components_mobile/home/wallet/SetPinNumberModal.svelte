<script lang="ts">
    import type { DelegationChain, ECDSAKeyIdentity } from "@icp-sdk/core/identity";
    import { Body, Button, Container, Subtitle } from "component-lib";
    import {
        AuthProvider,
        pinNumberFailureStore,
        type OpenChat,
    } from "@client";
    import { getContext, onMount, untrack } from "svelte";
    import Lock from "svelte-material-icons/Lock.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { pinNumberErrorMessageStore, type PinOperation } from "../../../stores/pinNumber";
    import {
        PinNumberForm,
        type PinSaveOutcome,
    } from "@shared_components/home/pin/pinNumberForm.svelte";
    import { toastStore } from "../../../stores/toast";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import Pincode from "../../pincode/Pincode.svelte";
    import Translatable from "@shared_components/Translatable.svelte";
    import ForgotPinLabel from "../ForgotPinLabel.svelte";
    import ReAuthenticate from "../profile/ReAuthenticate.svelte";

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

<Container height={"hug"} padding={"xl"} gap={"xl"} direction={"vertical"}>
    <Subtitle fontWeight={"bold"}>
        <Translatable resourceKey={title} />
    </Subtitle>

    <Container direction={"vertical"} gap={"lg"}>
        {#if operation.kind === "forgot"}
            {#if message !== undefined}
                <ReAuthenticate onSuccess={reauthenticated} {message} />
            {/if}
        {:else}
            {#if message !== undefined}
                <Body colour={"textSecondary"}>
                    <Translatable resourceKey={message} />
                </Body>
            {/if}
            {#if form.showCurrentPin}
                <Container
                    overflow={"visible"}
                    crossAxisAlignment={"center"}
                    direction={"vertical"}>
                    <Pincode
                        subtext={operation.kind === "change"
                            ? i18nKey("pinNumber.currentPin")
                            : undefined}
                        length={6}
                        bind:code={form.currentPin} />
                </Container>
            {/if}
            {#if operation.kind !== "clear"}
                <Pincode
                    subtext={operation.kind === "change" ? i18nKey("pinNumber.newPin") : undefined}
                    length={6}
                    bind:code={form.newPin} />
            {/if}
        {/if}
    </Container>

    {#if operation.kind !== "forgot"}
        <Container
            padding={["xl", "zero", "zero", "zero"]}
            direction={"vertical"}
            gap={"xs"}
            crossAxisAlignment={"center"}>
            <Button loading={form.busy} disabled={form.busy || !form.valid} onClick={changePin}>
                {#snippet icon(color)}
                    <Lock {color} />
                {/snippet}
                <Translatable resourceKey={action} />
            </Button>
            {#if operation.kind !== "set"}
                <ForgotPinLabel onForgot={() => form.forgot()} />
            {/if}
        </Container>
    {/if}

    {#if errorMessage !== undefined}
        <ErrorMessage>
            <Translatable resourceKey={errorMessage} />
        </ErrorMessage>
    {/if}

    <!-- <Container gap={"md"} crossAxisAlignment={"end"} mainAxisAlignment={"end"}>
        {#if operation.kind === "forgot"}
            <CommonButton disabled={form.busy} onClick={onClose} size={"medium"}>
                <Translatable resourceKey={i18nKey("cancel")} />
            </CommonButton>
        {:else}
            <CommonButton disabled={form.busy} onClick={onClose} size={"small_text"}>
                <Translatable resourceKey={i18nKey("cancel")} />
            </CommonButton>
            <CommonButton
                loading={form.busy}
                disabled={form.busy || !form.valid}
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
