<script lang="ts">
    import { createEventDispatcher, getContext } from "svelte";
    import Translatable from "../../Translatable.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import ModalContent from "../../ModalContent.svelte";
    import { Pincode, PincodeInput } from "svelte-pincode";
    import ButtonGroup from "../../ButtonGroup.svelte";
    import Button from "../../Button.svelte";
    import { type OpenChat } from "openchat-client";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import { toastStore } from "../../../stores/toast";
    import { pinNumberErrorMessageStore } from "../../../stores/pinNumber";

    const client = getContext<OpenChat>("client");
    const dispatch = createEventDispatcher();

    export let type: "set" | "clear" | "change";

    let busy = false;
    let currPinArray: string[] = [];
    let newPinArray: string[] = [];

    $: title = i18nKey(`pinNumber.${type}PinTitle`);
    $: message = type === "change" ? undefined : i18nKey(`pinNumber.${type}PinMessage`);
    $: action = i18nKey(`pinNumber.${type}Pin`);
    $: isValid =
        (type === "clear" || isPinValid(newPinArray)) &&
        (type === "set" || isPinValid(currPinArray));

    $: errorMessage = $pinNumberErrorMessageStore;

    function isPinValid(pin: string[]): boolean {
        return pin.filter((c) => /^[0-9]$/.test(c)).length === 6;
    }

    function changePin(): Promise<void> {
        const newPin = type === "clear" ? undefined : newPinArray.join("");
        const currPin = type === "set" ? undefined : currPinArray.join("");

        busy = true;

        return client
            .setPinNumber(currPin, newPin)
            .then((resp) => {
                if (resp.kind === "success") {
                    toastStore.showSuccessToast(i18nKey(`pinNumber.${type}PinSuccess`));
                    close();
                }
            })
            .finally(() => {
                busy = false;
            });
    }

    function close() {
        dispatch("close");
    }
</script>

<ModalContent closeIcon fitToContent fixedWidth={false} on:close>
    <div class="header" slot="header">
        <Translatable resourceKey={title} />
    </div>
    <div class="body" slot="body">
        {#if message !== undefined}
            <p>
                <Translatable resourceKey={message} />
            </p>
        {/if}
        {#if type !== "set"}
            <div class="code">
                {#if type === "change"}
                    <div><Translatable resourceKey={i18nKey("pinNumber.currentPin")} /></div>
                {/if}
                <Pincode bind:code={currPinArray}>
                    <PincodeInput />
                    <PincodeInput />
                    <PincodeInput />
                    <PincodeInput />
                    <PincodeInput />
                    <PincodeInput />
                </Pincode>
            </div>
        {/if}
        {#if type !== "clear"}
            <div class="code">
                {#if type === "change"}
                    <div><Translatable resourceKey={i18nKey("pinNumber.newPin")} /></div>
                    <!-- <Legend label={i18nKey("pinNumber.newPin")}></Legend> -->
                {/if}
                <Pincode bind:code={newPinArray}>
                    <PincodeInput />
                    <PincodeInput />
                    <PincodeInput />
                    <PincodeInput />
                    <PincodeInput />
                    <PincodeInput />
                </Pincode>
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

<style lang="scss">
    :global([data-pincode]) {
        gap: $sp3;
        border: none !important;
    }

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
