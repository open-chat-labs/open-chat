<script lang="ts">
    import type { OpenChat } from "openchat-client";
    import { _ } from "svelte-i18n";
    import ModalContent from "../../ModalContent.svelte";
    import Overlay from "../../Overlay.svelte";
    import Translatable from "../../Translatable.svelte";
    import { Pincode, PincodeInput } from "svelte-pincode";
    import { getContext } from "svelte";
    import Button from "../../Button.svelte";
    import { toastStore } from "../../../stores/toast";
    import AreYouSure from "../../AreYouSure.svelte";
    import ErrorMessage from "../../ErrorMessage.svelte";
    import { i18nKey } from "../../../i18n/i18n";
    import { pinNumberErrorMessageStore } from "../../../stores/pinNumber";

    const client = getContext<OpenChat>("client");

    let newPinArray: string[] = [];
    let setting = false;
    let clearing = false;
    let showWarning = false;

    $: pinNumberRequiredStore = client.pinNumberRequiredStore;
    $: hasPin = $pinNumberRequiredStore;
    $: pinValid = isPinValid(newPinArray);
    $: errorMessage = $pinNumberErrorMessageStore;

    function isPinValid(pin: string[]): boolean {
        return pin.filter((c) => /^[0-9]$/.test(c)).length === 6;
    }

    function onClearConfirmation(yes: boolean): Promise<void> {
        showWarning = false;

        if (yes) {
            return changePin(true);
        } else {
            return Promise.resolve();
        }
    }

    function changePin(clear: boolean): Promise<void> {
        const newPin = clear ? undefined : newPinArray.join("");
        const isNewPin = !hasPin;

        if (clear) {
            clearing = true;
        } else {
            setting = true;
        }

        return client
            .setPinNumber(newPin)
            .then((resp) => {
                if (resp.kind === "success") {
                    newPinArray = ["", "", "", "", "", ""];

                    const message = isNewPin
                        ? "newPinSuccess"
                        : newPin !== undefined
                          ? "changePinSuccess"
                          : "clearPinSuccess";

                    toastStore.showSuccessToast(i18nKey("pinNumber." + message));
                }
            })
            .finally(() => {
                clearing = false;
                setting = false;
            });
    }
</script>

<Overlay dismissible on:close>
    <ModalContent hideFooter closeIcon on:close>
        <div class="header" slot="header">
            <Translatable resourceKey={i18nKey("pinNumber.title")} />
        </div>
        <div slot="body">
            <section>
                <p><Translatable resourceKey={i18nKey("pinNumber.info")} /></p>
                <div class="actions">
                    {#if hasPin}
                        <div class="action clear">
                            <div class="pin">******</div>
                            <div>
                                <Button
                                    small
                                    loading={clearing}
                                    disabled={setting || clearing}
                                    on:click={() => (showWarning = true)}
                                    ><Translatable
                                        resourceKey={i18nKey("pinNumber.clear")} /></Button>
                            </div>
                        </div>
                    {/if}

                    <div class="action">
                        <Pincode bind:code={newPinArray}>
                            <PincodeInput />
                            <PincodeInput />
                            <PincodeInput />
                            <PincodeInput />
                            <PincodeInput />
                            <PincodeInput />
                        </Pincode>
                        <div>
                            <Button
                                small
                                loading={setting}
                                disabled={!pinValid}
                                on:click={() => changePin(false)}
                                ><Translatable
                                    resourceKey={i18nKey(
                                        hasPin ? "pinNumber.change" : "pinNumber.new",
                                    )} /></Button>
                        </div>
                    </div>
                </div>

                {#if errorMessage !== undefined}
                    <div class="error">
                        <ErrorMessage><Translatable resourceKey={errorMessage} /></ErrorMessage>
                    </div>
                {/if}
            </section>
        </div>
    </ModalContent>
</Overlay>

{#if showWarning}
    <AreYouSure message={i18nKey("pinNumber.clearWarning")} action={onClearConfirmation} />
{/if}

<style lang="scss">
    :global([data-pincode]) {
        gap: $sp3;
        border: none !important;
    }

    p {
        margin-bottom: $sp4;
    }

    .pin {
        font-family: Menlo, Monaco, "Courier New", monospace;
    }

    .actions {
        display: flex;
        flex-direction: column;
        gap: $sp6;
    }

    .action {
        display: flex;
        flex-direction: column;
        gap: $sp4;

        &.clear {
            gap: $sp3;
        }
    }

    .error {
        display: flex;
        justify-content: center;
        align-content: center;
        margin-top: $sp4;
    }
</style>
