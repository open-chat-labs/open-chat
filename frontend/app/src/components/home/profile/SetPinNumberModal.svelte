<script lang="ts">
    import { createEventDispatcher, getContext, onMount } from "svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import ModalContent from "../../ModalContent.svelte";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Button from "../../Button.svelte";
    import { AuthProvider, pinNumberFailureStore, type OpenChat } from "openchat-client";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import { toastStore } from "../../../stores/toast";
    import { pinNumberErrorMessageStore, type PinOperation } from "../../../stores/pinNumber";
    import Pincode from "../../pincode/Pincode.svelte";
    import ReAuthenticate from "./ReAuthenticate.svelte";
    import type { DelegationChain, ECDSAKeyIdentity } from "@dfinity/identity";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    // if we forgot pin we need to also capture what we were trying to do when we clicked forgot.
    // if we were trying to change or clear, we stay here, if we were simply trying to enter our pin
    // we go back and try that again

    export let type: PinOperation;

    $: operationType = type.kind;

    // export let type: "set" | "clear" | "change" | "forgot";

    let busy = false;
    let currPinArray: string[] = [];
    let newPinArray: string[] = [];
    let delegation: DelegationChain | undefined = undefined;

    $: title = i18nKey(`pinNumber.${operationType}PinTitle`);
    $: message =
        operationType === "change" ? undefined : i18nKey(`pinNumber.${operationType}PinMessage`);
    $: action = i18nKey(`pinNumber.${operationType}Pin`);
    $: isValid =
        operationType === "forgot" ||
        ((operationType === "clear" || isPinValid(newPinArray)) &&
            (operationType === "set" || isPinValid(currPinArray)));

    $: errorMessage = $pinNumberErrorMessageStore;

    $: console.log("Operation type: ", type);

    onMount(() => {
        pinNumberFailureStore.set(undefined);
    });

    function isPinValid(pin: string[]): boolean {
        return pin.filter((c) => /^[0-9]$/.test(c)).length === 6;
    }

    function changePin(): Promise<void> {
        const newPin = operationType === "clear" ? undefined : newPinArray.join("");
        const currPin = operationType === "set" ? undefined : currPinArray.join("");

        busy = true;

        return client
            .setPinNumber(currPin, newPin)
            .then((resp) => {
                if (resp.kind === "success") {
                    toastStore.showSuccessToast(i18nKey(`pinNumber.${operationType}PinSuccess`));
                    close();
                }
            })
            .finally(() => {
                busy = false;
            });
    }

    function reauthenticated(
        ev: CustomEvent<{
            key: ECDSAKeyIdentity;
            delegation: DelegationChain;
            provider: AuthProvider;
        }>,
    ) {
        if (type.kind !== "forgot") return;

        delegation = ev.detail.delegation;
        switch (type.while.kind) {
            case "clear":
                type = { kind: "clear" };
                break;
            default:
                type = { kind: "change" };
        }
    }

    function close() {
        dispatch("close");
    }
</script>

{#if operationType === "forgot"}
    <ModalContent closeIcon fixedWidth={false} on:close>
        <div class="header" slot="header">
            <Translatable resourceKey={title} />
        </div>
        <div class="body" slot="body">
            {#if message !== undefined}
                <ReAuthenticate on:success={reauthenticated} {message} />
            {/if}
        </div>
        <div class="footer" slot="footer">
            <ButtonGroup align="center">
                <Button disabled={busy} secondary on:click={close}
                    ><Translatable resourceKey={i18nKey("cancel")} /></Button>
            </ButtonGroup>
        </div>
    </ModalContent>
{:else}
    <ModalContent closeIcon fixedWidth={false} on:close>
        <div class="header" slot="header">
            <Translatable resourceKey={title} />
        </div>
        <div class="body" slot="body">
            {#if message !== undefined}
                <p>
                    <Translatable resourceKey={message} />
                </p>
            {/if}
            {#if operationType !== "set"}
                <div class="code">
                    {#if operationType === "change"}
                        <div><Translatable resourceKey={i18nKey("pinNumber.currentPin")} /></div>
                    {/if}
                    <Pincode type="numeric" length={6} bind:code={currPinArray} />
                </div>
            {/if}
            {#if operationType !== "clear"}
                <div class="code">
                    {#if operationType === "change"}
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
        </div>
        <div class="footer" slot="footer">
            <ButtonGroup align="center">
                <Button disabled={busy} secondary on:click={close}
                    ><Translatable resourceKey={i18nKey("cancel")} /></Button>
                <Button loading={busy} disabled={busy || !isValid} on:click={changePin}
                    ><Translatable resourceKey={action} /></Button>
            </ButtonGroup>
        </div>
    </ModalContent>
{/if}

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
